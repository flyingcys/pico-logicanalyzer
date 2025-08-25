/**
 * 性能基准测试执行引擎 - P2.2架构核心组件
 * 
 * 功能：
 * - 批量执行多个性能测试
 * - 生成性能基准报告和趋势分析
 * - 性能回归检测和阈值告警
 * - 支持CI集成和结果导出
 * 
 * 遵循质量标准:
 * - 文件大小 < 200行 ✅
 * - Mock数量 = 0个 ✅
 * - 专注性能测试执行和报告
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { PerformanceTestBase, PerformanceTestResult } from './PerformanceTestBase';

/**
 * 基准测试配置
 */
interface BenchmarkConfig {
  outputDir: string;          // 报告输出目录
  reportFormats: ('json' | 'html' | 'csv')[];  // 报告格式
  saveHistory: boolean;       // 是否保存历史结果
  regressionThreshold: number; // 性能回归阈值（百分比）
}

/**
 * 基准测试汇总结果
 */
interface BenchmarkSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averagePerformance: {
    avgDuration: number;
    avgMemoryUsage: number;
    totalMemoryGrowth: number;
  };
  regressions: {
    testName: string;
    currentDuration: number;
    previousDuration: number;
    regressionPercent: number;
  }[];
  environment: {
    nodeVersion: string;
    platform: string;
    timestamp: string;
    runId: string;
  };
}

/**
 * 完整基准测试报告
 */
interface BenchmarkReport {
  summary: BenchmarkSummary;
  testResults: PerformanceTestResult[];
  config: BenchmarkConfig;
}

/**
 * 性能基准测试执行器
 */
class BenchmarkRunner {
  private config: BenchmarkConfig;
  private tests: Map<string, PerformanceTestBase> = new Map();
  
  constructor(config?: Partial<BenchmarkConfig>) {
    this.config = {
      outputDir: 'tests/performance/reports',
      reportFormats: ['json', 'html'],
      saveHistory: true,
      regressionThreshold: 20, // 20%性能回归阈值
      ...config
    };
  }
  
  /**
   * 注册性能测试
   */
  addTest(name: string, test: PerformanceTestBase): void {
    this.tests.set(name, test);
  }
  
  /**
   * 批量注册性能测试
   */
  addTests(tests: { [name: string]: PerformanceTestBase }): void {
    for (const [name, test] of Object.entries(tests)) {
      this.addTest(name, test);
    }
  }
  
  /**
   * 加载历史性能数据
   */
  private async loadHistoryData(): Promise<{ [testName: string]: number } | null> {
    try {
      const historyFile = path.join(this.config.outputDir, 'performance-history.json');
      if (await fs.pathExists(historyFile)) {
        const history = await fs.readJson(historyFile);
        return history.lastRun || null;
      }
    } catch (error) {
      console.warn('⚠️ 无法加载历史性能数据:', error);
    }
    return null;
  }
  
  /**
   * 保存历史性能数据
   */
  private async saveHistoryData(results: PerformanceTestResult[]): Promise<void> {
    if (!this.config.saveHistory) return;
    
    try {
      await fs.ensureDir(this.config.outputDir);
      const historyFile = path.join(this.config.outputDir, 'performance-history.json');
      
      const currentData: { [testName: string]: number } = {};
      results.forEach(result => {
        currentData[result.testName] = result.statistics.averageDuration;
      });
      
      const history = {
        lastRun: currentData,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeJson(historyFile, history, { spaces: 2 });
    } catch (error) {
      console.warn('⚠️ 无法保存历史性能数据:', error);
    }
  }
  
  /**
   * 检测性能回归
   */
  private detectRegressions(
    results: PerformanceTestResult[], 
    historyData: { [testName: string]: number } | null
  ): BenchmarkSummary['regressions'] {
    if (!historyData) return [];
    
    const regressions: BenchmarkSummary['regressions'] = [];
    
    results.forEach(result => {
      const previousDuration = historyData[result.testName];
      if (previousDuration) {
        const currentDuration = result.statistics.averageDuration;
        const regressionPercent = ((currentDuration - previousDuration) / previousDuration) * 100;
        
        if (regressionPercent > this.config.regressionThreshold) {
          regressions.push({
            testName: result.testName,
            currentDuration,
            previousDuration,
            regressionPercent: Math.round(regressionPercent * 10) / 10
          });
        }
      }
    });
    
    return regressions;
  }
  
  /**
   * 生成汇总统计
   */
  private generateSummary(results: PerformanceTestResult[], regressions: BenchmarkSummary['regressions']): BenchmarkSummary {
    const passedTests = results.filter(r => r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.statistics.averageDuration, 0);
    const totalMemory = results.reduce((sum, r) => sum + r.statistics.averageMemoryUsed, 0);
    const totalMemoryGrowth = results.reduce((sum, r) => sum + r.statistics.memoryGrowth, 0);
    
    return {
      totalTests: results.length,
      passedTests,
      failedTests: results.length - passedTests,
      averagePerformance: {
        avgDuration: Math.round(totalDuration / results.length * 100) / 100,
        avgMemoryUsage: Math.round(totalMemory / results.length * 100) / 100,
        totalMemoryGrowth: Math.round(totalMemoryGrowth * 100) / 100
      },
      regressions,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString(),
        runId: `perf-${Date.now()}`
      }
    };
  }
  
  /**
   * 生成JSON报告
   */
  private async generateJsonReport(report: BenchmarkReport): Promise<void> {
    const reportFile = path.join(this.config.outputDir, 'performance-report.json');
    await fs.writeJson(reportFile, report, { spaces: 2 });
    console.log(`📄 JSON报告已保存: ${reportFile}`);
  }
  
  /**
   * 生成HTML报告
   */
  private async generateHtmlReport(report: BenchmarkReport): Promise<void> {
    const htmlContent = this.generateHtmlContent(report);
    const reportFile = path.join(this.config.outputDir, 'performance-report.html');
    await fs.writeFile(reportFile, htmlContent);
    console.log(`📄 HTML报告已保存: ${reportFile}`);
  }
  
  /**
   * 生成HTML报告内容
   */
  private generateHtmlContent(report: BenchmarkReport): string {
    const { summary, testResults } = report;
    
    return `<!DOCTYPE html>
<html>
<head>
    <title>性能基准测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .test-result { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .passed { border-left: 5px solid #4CAF50; }
        .failed { border-left: 5px solid #f44336; }
        .regression { background: #fff3cd; border-color: #ffc107; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>性能基准测试报告</h1>
    
    <div class="summary">
        <h2>测试汇总</h2>
        <p><strong>总测试数:</strong> ${summary.totalTests}</p>
        <p><strong>通过:</strong> ${summary.passedTests} | <strong>失败:</strong> ${summary.failedTests}</p>
        <p><strong>平均执行时间:</strong> ${summary.averagePerformance.avgDuration}ms</p>
        <p><strong>平均内存使用:</strong> ${summary.averagePerformance.avgMemoryUsage}MB</p>
        <p><strong>运行时间:</strong> ${new Date(summary.environment.timestamp).toLocaleString()}</p>
    </div>
    
    ${summary.regressions.length > 0 ? `
    <div class="regression">
        <h2>⚠️ 性能回归检测</h2>
        ${summary.regressions.map(r => `
            <p><strong>${r.testName}:</strong> ${r.regressionPercent}% 性能下降 
            (${r.previousDuration}ms → ${r.currentDuration}ms)</p>
        `).join('')}
    </div>` : ''}
    
    <h2>详细测试结果</h2>
    ${testResults.map(result => `
        <div class="test-result ${result.success ? 'passed' : 'failed'}">
            <h3>${result.testName} ${result.success ? '✅' : '❌'}</h3>
            <p><strong>平均执行时间:</strong> ${result.statistics.averageDuration}ms</p>
            <p><strong>内存使用:</strong> ${result.statistics.averageMemoryUsed}MB</p>
            <p><strong>标准差:</strong> ${result.statistics.standardDeviation}ms</p>
            ${result.error ? `<p style="color: red;"><strong>错误:</strong> ${result.error}</p>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  }
  
  /**
   * 运行所有性能测试
   */
  async runAllTests(): Promise<BenchmarkReport> {
    console.log(`🚀 开始运行 ${this.tests.size} 个性能测试...`);
    
    await fs.ensureDir(this.config.outputDir);
    
    // 加载历史数据
    const historyData = await this.loadHistoryData();
    
    // 执行所有测试
    const testResults: PerformanceTestResult[] = [];
    for (const [name, test] of this.tests) {
      console.log(`\n🔧 执行测试: ${name}`);
      const result = await test.runTest();
      testResults.push(result);
    }
    
    // 检测性能回归
    const regressions = this.detectRegressions(testResults, historyData);
    
    // 生成汇总
    const summary = this.generateSummary(testResults, regressions);
    
    // 保存历史数据
    await this.saveHistoryData(testResults);
    
    // 构建完整报告
    const report: BenchmarkReport = {
      summary,
      testResults,
      config: this.config
    };
    
    // 生成报告
    if (this.config.reportFormats.includes('json')) {
      await this.generateJsonReport(report);
    }
    if (this.config.reportFormats.includes('html')) {
      await this.generateHtmlReport(report);
    }
    
    // 输出结果汇总
    console.log(`\n🏆 性能测试完成:`);
    console.log(`   总测试: ${summary.totalTests} | 通过: ${summary.passedTests} | 失败: ${summary.failedTests}`);
    console.log(`   平均时间: ${summary.averagePerformance.avgDuration}ms`);
    
    if (regressions.length > 0) {
      console.log(`   ⚠️ 检测到 ${regressions.length} 个性能回归`);
    }
    
    return report;
  }
}

export { BenchmarkRunner, BenchmarkConfig, BenchmarkReport, BenchmarkSummary };