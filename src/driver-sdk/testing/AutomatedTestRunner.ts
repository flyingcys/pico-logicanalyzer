import { promises as fs } from 'fs';
import { join } from 'path';
import { TestFramework, TestSummary } from './TestFramework';
import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';

/**
 * 自动化测试配置
 */
export interface AutomatedTestConfig {
  // 测试发现
  testPaths: string[];
  driverPattern: string;
  excludePatterns: string[];

  // 测试执行
  parallel: boolean;
  maxWorkers: number;
  timeout: number;
  retries: number;

  // 报告生成
  outputDir: string;
  reportFormats: ('json' | 'html' | 'xml' | 'markdown')[];
  includePerformanceGraphs: boolean;

  // 质量门控
  qualityGates: {
    minValidationScore: number;
    minFunctionalCoverage: number;
    maxPerformanceRegression: number;
    requiredGrade: 'A' | 'B' | 'C' | 'D';
  };

  // 通知设置
  notifications: {
    enabled: boolean;
    onFailure: boolean;
    onSuccess: boolean;
    webhooks: string[];
    email?: {
      recipients: string[];
      smtpConfig: any;
    };
  };
}

/**
 * 测试结果集合
 */
interface TestResultCollection {
  timestamp: Date;
  totalDrivers: number;
  testedDrivers: number;
  passedDrivers: number;
  failedDrivers: number;
  results: Array<{
    driverName: string;
    filePath: string;
    summary: TestSummary;
    error?: string;
  }>;
  overallQuality: {
    averageScore: number;
    gradeDistribution: Record<string, number>;
    qualityGatesPassed: boolean;
  };
}

/**
 * 自动化测试运行器
 * 提供CI/CD友好的自动化测试功能
 */
export class AutomatedTestRunner {
  private config: AutomatedTestConfig;
  private testFramework: TestFramework;

  constructor(config: Partial<AutomatedTestConfig> = {}) {
    this.config = {
      testPaths: ['./src/drivers', './tests/drivers'],
      driverPattern: '**/*Driver.{ts,js}',
      excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
      parallel: true,
      maxWorkers: 4,
      timeout: 300000, // 5分钟
      retries: 2,
      outputDir: './test-results',
      reportFormats: ['json', 'html', 'markdown'],
      includePerformanceGraphs: true,
      qualityGates: {
        minValidationScore: 70,
        minFunctionalCoverage: 80,
        maxPerformanceRegression: 20, // 百分比
        requiredGrade: 'B'
      },
      notifications: {
        enabled: false,
        onFailure: true,
        onSuccess: false,
        webhooks: []
      },
      ...config
    };

    this.testFramework = new TestFramework({
      timeout: this.config.timeout,
      mockMode: true // 自动化测试使用模拟模式
    });
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<TestResultCollection> {
    console.log('🚀 开始自动化测试运行...');
    const startTime = Date.now();

    // 创建输出目录
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // 发现驱动文件
    const driverFiles = await this.discoverDriverFiles();
    console.log(`📁 发现 ${driverFiles.length} 个驱动文件`);

    const results: TestResultCollection = {
      timestamp: new Date(),
      totalDrivers: driverFiles.length,
      testedDrivers: 0,
      passedDrivers: 0,
      failedDrivers: 0,
      results: [],
      overallQuality: {
        averageScore: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
        qualityGatesPassed: false
      }
    };

    // 执行测试
    if (this.config.parallel) {
      await this.runTestsInParallel(driverFiles, results);
    } else {
      await this.runTestsSequentially(driverFiles, results);
    }

    // 计算总体质量指标
    this.calculateOverallQuality(results);

    // 生成报告
    await this.generateReports(results);

    // 发送通知
    await this.sendNotifications(results);

    const duration = Date.now() - startTime;
    console.log(`✅ 测试完成，耗时: ${(duration / 1000).toFixed(2)}秒`);

    return results;
  }

  /**
   * 发现驱动文件
   */
  private async discoverDriverFiles(): Promise<string[]> {
    const { glob } = await import('glob');
    const allFiles: string[] = [];

    for (const testPath of this.config.testPaths) {
      try {
        const pattern = join(testPath, this.config.driverPattern);
        const files = await glob(pattern, {
          ignore: this.config.excludePatterns
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(`⚠️  路径扫描失败: ${testPath}`, error);
      }
    }

    // 去重
    return [...new Set(allFiles)];
  }

  /**
   * 并行执行测试
   */
  private async runTestsInParallel(
    driverFiles: string[],
    results: TestResultCollection
  ): Promise<void> {
    console.log(`🔄 并行执行测试 (最大工作者: ${this.config.maxWorkers})`);

    const chunks = this.chunkArray(driverFiles, this.config.maxWorkers);
    const promises = chunks.map(chunk => this.processDriverChunk(chunk, results));

    await Promise.all(promises);
  }

  /**
   * 顺序执行测试
   */
  private async runTestsSequentially(
    driverFiles: string[],
    results: TestResultCollection
  ): Promise<void> {
    console.log('🔄 顺序执行测试');

    for (const driverFile of driverFiles) {
      await this.testSingleDriver(driverFile, results);
    }
  }

  /**
   * 处理驱动文件块
   */
  private async processDriverChunk(
    chunk: string[],
    results: TestResultCollection
  ): Promise<void> {
    for (const driverFile of chunk) {
      await this.testSingleDriver(driverFile, results);
    }
  }

  /**
   * 测试单个驱动
   */
  private async testSingleDriver(
    driverFile: string,
    results: TestResultCollection
  ): Promise<void> {
    const driverName = this.extractDriverName(driverFile);
    console.log(`🧪 测试驱动: ${driverName}`);

    try {
      // 动态加载驱动
      const driver = await this.loadDriver(driverFile);

      if (!driver) {
        throw new Error('无法加载驱动或找不到导出的驱动类');
      }

      // 执行测试（带重试）
      let summary: TestSummary | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= this.config.retries; attempt++) {
        try {
          summary = await this.testFramework.runFullTestSuite(driver);
          break;
        } catch (error) {
          lastError = error as Error;
          if (attempt < this.config.retries) {
            console.log(`⚠️  测试失败，重试 ${attempt + 1}/${this.config.retries}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!summary) {
        throw lastError || new Error('测试执行失败');
      }

      // 记录结果
      results.results.push({
        driverName,
        filePath: driverFile,
        summary
      });

      results.testedDrivers++;

      if (summary.overall.readyForProduction) {
        results.passedDrivers++;
        console.log(`✅ ${driverName}: ${summary.overall.grade} 级`);
      } else {
        results.failedDrivers++;
        console.log(`❌ ${driverName}: ${summary.overall.grade} 级 (不适合生产)`);
      }

    } catch (error) {
      console.error(`💥 ${driverName} 测试失败:`, error);

      results.results.push({
        driverName,
        filePath: driverFile,
        summary: this.createFailedSummary(driverName),
        error: error instanceof Error ? error.message : String(error)
      });

      results.testedDrivers++;
      results.failedDrivers++;
    }
  }

  /**
   * 动态加载驱动
   */
  private async loadDriver(driverFile: string): Promise<AnalyzerDriverBase | null> {
    try {
      // 动态导入模块
      const module = await import(driverFile);

      // 查找驱动类
      const exportedClasses = Object.values(module).filter(
        (value): value is new (...args: any[]) => AnalyzerDriverBase =>
          typeof value === 'function' &&
          value.prototype instanceof AnalyzerDriverBase
      );

      if (exportedClasses.length === 0) {
        console.warn(`⚠️  ${driverFile} 中未找到驱动类`);
        return null;
      }

      // 使用第一个找到的驱动类
      const DriverClass = exportedClasses[0];

      // 尝试创建实例（使用测试连接字符串）
      const testConnectionString = this.generateTestConnectionString(DriverClass);
      return new DriverClass(testConnectionString);

    } catch (error) {
      console.error(`❌ 加载驱动失败 ${driverFile}:`, error);
      return null;
    }
  }

  /**
   * 生成测试连接字符串
   */
  private generateTestConnectionString(DriverClass: any): string {
    const className = DriverClass.name.toLowerCase();

    if (className.includes('network') || className.includes('tcp') || className.includes('http')) {
      return 'localhost:8080';
    } else if (className.includes('serial') || className.includes('com')) {
      return 'COM1';
    } else {
      return 'test-connection';
    }
  }

  /**
   * 创建失败摘要
   */
  private createFailedSummary(driverName: string): TestSummary {
    return {
      suiteName: `${driverName} Test Suite`,
      timestamp: new Date(),
      duration: 0,
      validation: { score: 0, status: 'fail', errors: 1, warnings: 0 },
      functional: { total: 0, passed: 0, failed: 1, skipped: 0, coverage: 0 },
      performance: {
        connectionTime: -1,
        captureTime: -1,
        throughput: -1,
        memoryUsage: -1,
        baselineComparison: 'worse'
      },
      compatibility: {
        apiVersion: 'unknown',
        supportedFeatures: [],
        missingFeatures: ['all'],
        deprecatedUsage: []
      },
      overall: {
        grade: 'F',
        readyForProduction: false,
        recommendations: ['驱动加载或执行失败']
      }
    };
  }

  /**
   * 计算总体质量指标
   */
  private calculateOverallQuality(results: TestResultCollection): void {
    if (results.results.length === 0) {
      return;
    }

    // 计算平均分数
    const totalScore = results.results.reduce((sum, result) =>
      sum + result.summary.validation.score, 0
    );
    results.overallQuality.averageScore = totalScore / results.results.length;

    // 统计等级分布
    results.results.forEach(result => {
      const { grade } = result.summary.overall;
      results.overallQuality.gradeDistribution[grade]++;
    });

    // 检查质量门控
    const gates = this.config.qualityGates;
    const passedGates = results.results.filter(result => {
      const { summary } = result;
      return (
        summary.validation.score >= gates.minValidationScore &&
        summary.functional.coverage >= gates.minFunctionalCoverage &&
        this.gradeToNumber(summary.overall.grade) >= this.gradeToNumber(gates.requiredGrade)
      );
    });

    results.overallQuality.qualityGatesPassed =
      passedGates.length / results.results.length >= 0.8; // 80%通过率
  }

  /**
   * 等级转数字
   */
  private gradeToNumber(grade: string): number {
    const mapping: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };
    return mapping[grade] || 0;
  }

  /**
   * 生成报告
   */
  private async generateReports(results: TestResultCollection): Promise<void> {
    console.log('📊 生成测试报告...');

    for (const format of this.config.reportFormats) {
      try {
        switch (format) {
          case 'json':
            await this.generateJSONReport(results);
            break;
          case 'html':
            await this.generateHTMLReport(results);
            break;
          case 'xml':
            await this.generateXMLReport(results);
            break;
          case 'markdown':
            await this.generateMarkdownReport(results);
            break;
        }
      } catch (error) {
        console.error(`❌ 报告生成失败 (${format}):`, error);
        // 报告生成失败不应该阻停整个测试流程
      }
    }
  }

  /**
   * 生成JSON报告
   */
  private async generateJSONReport(results: TestResultCollection): Promise<void> {
    const reportPath = join(this.config.outputDir, 'test-results.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 JSON报告已生成: ${reportPath}`);
  }

  /**
   * 生成HTML报告
   */
  private async generateHTMLReport(results: TestResultCollection): Promise<void> {
    const html = this.buildHTMLReport(results);
    const reportPath = join(this.config.outputDir, 'test-results.html');
    await fs.writeFile(reportPath, html);
    console.log(`📄 HTML报告已生成: ${reportPath}`);
  }

  /**
   * 生成XML报告
   */
  private async generateXMLReport(results: TestResultCollection): Promise<void> {
    const xml = this.buildXMLReport(results);
    const reportPath = join(this.config.outputDir, 'test-results.xml');
    await fs.writeFile(reportPath, xml);
    console.log(`📄 XML报告已生成: ${reportPath}`);
  }

  /**
   * 生成Markdown报告
   */
  private async generateMarkdownReport(results: TestResultCollection): Promise<void> {
    const markdown = this.buildMarkdownReport(results);
    const reportPath = join(this.config.outputDir, 'test-results.md');
    await fs.writeFile(reportPath, markdown);
    console.log(`📄 Markdown报告已生成: ${reportPath}`);
  }

  /**
   * 构建HTML报告
   */
  private buildHTMLReport(results: TestResultCollection): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>驱动测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .grade-A { color: #28a745; }
        .grade-B { color: #17a2b8; }
        .grade-C { color: #ffc107; }
        .grade-D { color: #fd7e14; }
        .grade-F { color: #dc3545; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .pass { background-color: #d4edda; }
        .fail { background-color: #f8d7da; }
    </style>
</head>
<body>
    <h1>驱动测试报告</h1>
    
    <div class="summary">
        <h2>测试摘要</h2>
        <p><strong>测试时间:</strong> ${results.timestamp.toLocaleString()}</p>
        <p><strong>总驱动数:</strong> ${results.totalDrivers}</p>
        <p><strong>已测试:</strong> ${results.testedDrivers}</p>
        <p><strong>通过:</strong> ${results.passedDrivers}</p>
        <p><strong>失败:</strong> ${results.failedDrivers}</p>
        <p><strong>平均分数:</strong> ${results.overallQuality.averageScore.toFixed(1)}</p>
        <p><strong>质量门控:</strong> ${results.overallQuality.qualityGatesPassed ? '通过' : '失败'}</p>
    </div>

    <h2>等级分布</h2>
    <table>
        <tr><th>等级</th><th>数量</th></tr>
        ${Object.entries(results.overallQuality.gradeDistribution)
          .map(([grade, count]) => `<tr><td class="grade-${grade}">${grade}</td><td>${count}</td></tr>`)
          .join('')}
    </table>

    <h2>详细结果</h2>
    <table>
        <tr>
            <th>驱动名称</th>
            <th>等级</th>
            <th>验证分数</th>
            <th>功能覆盖率</th>
            <th>生产就绪</th>
            <th>问题</th>
        </tr>
        ${results.results.map(result => {
          const className = result.summary.overall.readyForProduction ? 'pass' : 'fail';
          return `<tr class="${className}">
            <td>${result.driverName}</td>
            <td class="grade-${result.summary.overall.grade}">${result.summary.overall.grade}</td>
            <td>${result.summary.validation.score}</td>
            <td>${result.summary.functional.coverage.toFixed(1)}%</td>
            <td>${result.summary.overall.readyForProduction ? '是' : '否'}</td>
            <td>${result.error || result.summary.overall.recommendations.join('; ')}</td>
          </tr>`;
        }).join('')}
    </table>
</body>
</html>`;
  }

  /**
   * 构建XML报告（JUnit格式）
   */
  private buildXMLReport(results: TestResultCollection): string {
    const totalTests = results.results.length;
    const failures = results.failedDrivers;
    const time = results.results.reduce((sum, r) => sum + r.summary.duration, 0) / 1000;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="DriverTestSuite" tests="${totalTests}" failures="${failures}" time="${time}">`;

    results.results.forEach(result => {
      const testTime = result.summary.duration / 1000;
      xml += `
  <testcase name="${result.driverName}" classname="DriverTest" time="${testTime}">`;

      if (!result.summary.overall.readyForProduction || result.error) {
        xml += `
    <failure message="${result.error || 'Quality gates failed'}">
      Grade: ${result.summary.overall.grade}
      Validation Score: ${result.summary.validation.score}
      Recommendations: ${result.summary.overall.recommendations.join('; ')}
    </failure>`;
      }

      xml += `
  </testcase>`;
    });

    xml += `
</testsuite>`;

    return xml;
  }

  /**
   * 构建Markdown报告
   */
  private buildMarkdownReport(results: TestResultCollection): string {
    let markdown = '# 驱动测试报告\n\n';
    markdown += `**测试时间**: ${results.timestamp.toLocaleString()}\n`;
    markdown += `**总驱动数**: ${results.totalDrivers}\n`;
    markdown += `**已测试**: ${results.testedDrivers}\n`;
    markdown += `**通过**: ${results.passedDrivers}\n`;
    markdown += `**失败**: ${results.failedDrivers}\n`;
    markdown += `**平均分数**: ${results.overallQuality.averageScore.toFixed(1)}\n`;
    markdown += `**质量门控**: ${results.overallQuality.qualityGatesPassed ? '✅ 通过' : '❌ 失败'}\n\n`;

    markdown += '## 等级分布\n\n';
    markdown += '| 等级 | 数量 |\n|------|------|\n';
    Object.entries(results.overallQuality.gradeDistribution).forEach(([grade, count]) => {
      const emoji = { A: '🏆', B: '👍', C: '⚠️', D: '👎', F: '💥' }[grade] || '❓';
      markdown += `| ${emoji} ${grade} | ${count} |\n`;
    });

    markdown += '\n## 详细结果\n\n';
    markdown += '| 驱动名称 | 等级 | 分数 | 覆盖率 | 生产就绪 | 主要问题 |\n';
    markdown += '|----------|------|------|--------|----------|----------|\n';

    results.results.forEach(result => {
      const { grade } = result.summary.overall;
      const gradeEmoji = { A: '🏆', B: '👍', C: '⚠️', D: '👎', F: '💥' }[grade] || '❓';
      const readyEmoji = result.summary.overall.readyForProduction ? '✅' : '❌';
      const issue = result.error || result.summary.overall.recommendations[0] || '-';

      markdown += `| ${result.driverName} | ${gradeEmoji} ${grade} | ${result.summary.validation.score} | ${result.summary.functional.coverage.toFixed(1)}% | ${readyEmoji} | ${issue} |\n`;
    });

    return markdown;
  }

  /**
   * 发送通知
   */
  private async sendNotifications(results: TestResultCollection): Promise<void> {
    if (!this.config.notifications.enabled) {
      return;
    }

    const shouldNotify = (
      (this.config.notifications.onSuccess && results.overallQuality.qualityGatesPassed) ||
      (this.config.notifications.onFailure && !results.overallQuality.qualityGatesPassed)
    );

    if (!shouldNotify) {
      return;
    }

    console.log('📧 发送测试通知...');

    // Webhook通知
    for (const webhook of this.config.notifications.webhooks) {
      try {
        await this.sendWebhookNotification(webhook, results);
      } catch (error) {
        console.error(`❌ Webhook通知失败 ${webhook}:`, error);
      }
    }

    // 邮件通知
    if (this.config.notifications.email) {
      try {
        await this.sendEmailNotification(results);
      } catch (error) {
        console.error('❌ 邮件通知失败:', error);
      }
    }
  }

  /**
   * 发送Webhook通知
   */
  private async sendWebhookNotification(webhook: string, results: TestResultCollection): Promise<void> {
    const payload = {
      timestamp: results.timestamp,
      summary: {
        total: results.totalDrivers,
        tested: results.testedDrivers,
        passed: results.passedDrivers,
        failed: results.failedDrivers,
        averageScore: results.overallQuality.averageScore,
        qualityGatesPassed: results.overallQuality.qualityGatesPassed
      },
      details: results.results.map(r => ({
        name: r.driverName,
        grade: r.summary.overall.grade,
        ready: r.summary.overall.readyForProduction,
        error: r.error
      }))
    };

    // 这里需要HTTP客户端实现
    console.log(`📤 发送到Webhook: ${webhook}`);
    // await fetch(webhook, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload)
    // });
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(results: TestResultCollection): Promise<void> {
    console.log('📧 发送邮件通知');
    // 邮件发送实现
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 提取驱动名称
   */
  private extractDriverName(filePath: string): string {
    const fileName = filePath.split('/').pop() || filePath;
    return fileName.replace(/\.(ts|js)$/, '');
  }
}
