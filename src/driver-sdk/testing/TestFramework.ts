import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';
import { DriverValidator, ValidationReport } from '../tools/DriverValidator';
import { DriverTester, TestReport } from '../tools/DriverTester';
import {
  CaptureSession,
  AnalyzerChannel,
  TriggerType,
  CaptureError
} from '../../models/AnalyzerTypes';

/**
 * 测试套件配置
 */
export interface TestSuiteConfig {
  name: string;
  description: string;
  timeout: number;
  retryCount: number;
  parallel: boolean;
  mockMode: boolean;
  coverageTarget: number;
  performanceBaseline?: {
    connectionTime: number;
    captureTime: number;
    throughput: number;
  };
}

/**
 * 测试结果摘要
 */
export interface TestSummary {
  suiteName: string;
  timestamp: Date;
  duration: number;

  // 验证结果
  validation: {
    score: number;
    status: 'pass' | 'fail' | 'warning';
    errors: number;
    warnings: number;
  };

  // 功能测试结果
  functional: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
  };

  // 性能测试结果
  performance: {
    connectionTime: number;
    captureTime: number;
    throughput: number;
    memoryUsage: number;
    baselineComparison: 'better' | 'same' | 'worse';
  };

  // 兼容性测试结果
  compatibility: {
    apiVersion: string;
    supportedFeatures: string[];
    missingFeatures: string[];
    deprecatedUsage: string[];
  };

  // 整体评估
  overall: {
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    readyForProduction: boolean;
    recommendations: string[];
  };
}

/**
 * 驱动测试框架
 * 提供完整的驱动测试和验证功能
 */
export class TestFramework {
  private config: TestSuiteConfig;
  private validator: DriverValidator;
  private tester: DriverTester;
  private testDataGenerator: TestDataGenerator;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: Partial<TestSuiteConfig> = {}) {
    this.config = {
      name: 'Driver Test Suite',
      description: 'Comprehensive driver testing',
      timeout: 60000,
      retryCount: 3,
      parallel: false,
      mockMode: true,
      coverageTarget: 80,
      ...config
    };

    this.validator = new DriverValidator();
    this.tester = new DriverTester(this.config.mockMode);
    this.testDataGenerator = new TestDataGenerator();
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * 运行完整测试套件
   */
  async runFullTestSuite(driver: AnalyzerDriverBase): Promise<TestSummary> {
    console.log(`开始运行测试套件: ${this.config.name}`);
    const startTime = Date.now();

    const summary: TestSummary = {
      suiteName: this.config.name,
      timestamp: new Date(),
      duration: 0,
      validation: { score: 0, status: 'fail', errors: 0, warnings: 0 },
      functional: { total: 0, passed: 0, failed: 0, skipped: 0, coverage: 0 },
      performance: {
        connectionTime: 0,
        captureTime: 0,
        throughput: 0,
        memoryUsage: 0,
        baselineComparison: 'same'
      },
      compatibility: {
        apiVersion: '',
        supportedFeatures: [],
        missingFeatures: [],
        deprecatedUsage: []
      },
      overall: {
        grade: 'F',
        readyForProduction: false,
        recommendations: []
      }
    };

    try {
      // 1. 驱动验证
      console.log('步骤 1/5: 驱动验证...');
      const validationReport = await this.runValidation(driver);
      summary.validation = {
        score: validationReport.score,
        status: validationReport.overallStatus,
        errors: validationReport.errors.length,
        warnings: validationReport.warnings.length
      };

      // 2. 功能测试
      console.log('步骤 2/5: 功能测试...');
      const functionalReport = await this.runFunctionalTests(driver);
      summary.functional = {
        total: functionalReport.totalTests,
        passed: functionalReport.passedTests,
        failed: functionalReport.failedTests,
        skipped: functionalReport.skippedTests,
        coverage: (functionalReport.passedTests / functionalReport.totalTests) * 100
      };

      // 3. 性能测试
      console.log('步骤 3/5: 性能测试...');
      const performanceReport = await this.runPerformanceTests(driver);
      summary.performance = performanceReport;

      // 4. 兼容性测试
      console.log('步骤 4/5: 兼容性测试...');
      const compatibilityReport = await this.runCompatibilityTests(driver);
      summary.compatibility = compatibilityReport;

      // 5. 生成总体评估
      console.log('步骤 5/5: 生成评估报告...');
      summary.overall = this.generateOverallAssessment(summary);

    } catch (error) {
      console.error('测试套件执行失败:', error);
      summary.overall.recommendations.push(`测试执行失败: ${error}`);
    }

    summary.duration = Date.now() - startTime;
    console.log(`测试套件完成，耗时: ${summary.duration}ms`);

    return summary;
  }

  /**
   * 运行驱动验证
   */
  private async runValidation(driver: AnalyzerDriverBase): Promise<ValidationReport> {
    return await this.validator.validateDriver(driver);
  }

  /**
   * 运行功能测试
   */
  private async runFunctionalTests(driver: AnalyzerDriverBase): Promise<TestReport> {
    // 添加额外的功能测试
    this.addExtendedFunctionalTests();

    return await this.tester.runAllTests(driver);
  }

  /**
   * 添加扩展的功能测试
   */
  private addExtendedFunctionalTests(): void {
    // 数据完整性测试
    this.tester.addTestCase({
      name: 'data-integrity',
      description: '数据完整性测试',
      category: 'capture',
      timeout: 30000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始数据完整性测试...');

          // 生成测试数据
          const testSession = this.testDataGenerator.generateTestSession();

          // 进行多次采集并验证数据一致性
          const results: Uint8Array[][] = [];

          for (let i = 0; i < 3; i++) {
            const captureError = await driver.startCapture(testSession);
            if (captureError !== CaptureError.None) {
              return {
                passed: false,
                message: `采集 ${i + 1} 失败`,
                duration: Date.now() - startTime
              };
            }

            // 等待采集完成
            while (driver.isCapturing) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 收集数据
            const sessionData = testSession.captureChannels.map(ch =>
              ch.samples ? new Uint8Array(ch.samples) : new Uint8Array()
            );
            results.push(sessionData);
          }

          // 验证数据一致性
          const isConsistent = this.verifyDataConsistency(results);

          return {
            passed: isConsistent,
            message: isConsistent ? '数据完整性验证通过' : '数据不一致',
            duration: Date.now() - startTime,
            details: { consistencyCheck: isConsistent, iterations: results.length }
          };
        } catch (error) {
          return {
            passed: false,
            message: '数据完整性测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });

    // 边界条件测试
    this.tester.addTestCase({
      name: 'boundary-conditions',
      description: '边界条件测试',
      category: 'capture',
      timeout: 20000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始边界条件测试...');

          const tests = [
            { name: '最小采样率', frequency: driver.minFrequency },
            { name: '最大采样率', frequency: driver.maxFrequency },
            { name: '最小样本数', samples: 1 },
            { name: '最大样本数', samples: driver.bufferSize }
          ];

          for (const test of tests) {
            const testSession = this.testDataGenerator.generateBoundaryTestSession(driver, test);
            const captureError = await driver.startCapture(testSession);

            if (captureError !== CaptureError.None) {
              return {
                passed: false,
                message: `边界测试失败: ${test.name}`,
                duration: Date.now() - startTime,
                details: { failedTest: test.name }
              };
            }

            // 等待完成
            while (driver.isCapturing) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          return {
            passed: true,
            message: '边界条件测试通过',
            duration: Date.now() - startTime,
            details: { testsRun: tests.length }
          };
        } catch (error) {
          return {
            passed: false,
            message: '边界条件测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });
  }

  /**
   * 运行性能测试
   */
  private async runPerformanceTests(driver: AnalyzerDriverBase): Promise<TestSummary['performance']> {
    console.log('执行性能基准测试...');

    const initialMemory = process.memoryUsage();

    // 连接性能测试
    const connectionStart = Date.now();
    const connectionResult = await driver.connect();
    const connectionTime = Date.now() - connectionStart;

    if (!connectionResult.success) {
      return {
        connectionTime: -1,
        captureTime: -1,
        throughput: -1,
        memoryUsage: -1,
        baselineComparison: 'worse'
      };
    }

    // 采集性能测试
    const testSession = this.testDataGenerator.generatePerformanceTestSession(driver);
    const captureStart = Date.now();

    await driver.startCapture(testSession);
    while (driver.isCapturing) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const captureTime = Date.now() - captureStart;

    // 计算吞吐量
    const totalSamples = testSession.captureChannels.length * (testSession.preTriggerSamples + testSession.postTriggerSamples);
    const throughput = totalSamples / (captureTime / 1000); // samples/second

    // 内存使用
    const finalMemory = process.memoryUsage();
    const memoryUsage = finalMemory.heapUsed - initialMemory.heapUsed;

    await driver.disconnect();

    // 与基线比较
    let baselineComparison: 'better' | 'same' | 'worse' = 'same';
    if (this.config.performanceBaseline) {
      const baseline = this.config.performanceBaseline;
      if (connectionTime < baseline.connectionTime * 0.9 &&
          captureTime < baseline.captureTime * 0.9 &&
          throughput > baseline.throughput * 1.1) {
        baselineComparison = 'better';
      } else if (connectionTime > baseline.connectionTime * 1.1 ||
                 captureTime > baseline.captureTime * 1.1 ||
                 throughput < baseline.throughput * 0.9) {
        baselineComparison = 'worse';
      }
    }

    return {
      connectionTime,
      captureTime,
      throughput,
      memoryUsage,
      baselineComparison
    };
  }

  /**
   * 运行兼容性测试
   */
  private async runCompatibilityTests(driver: AnalyzerDriverBase): Promise<TestSummary['compatibility']> {
    console.log('执行兼容性测试...');

    const supportedFeatures: string[] = [];
    const missingFeatures: string[] = [];
    const deprecatedUsage: string[] = [];

    // 检查基本功能支持
    const basicFeatures = [
      'connect', 'disconnect', 'getStatus', 'startCapture', 'stopCapture'
    ];

    for (const feature of basicFeatures) {
      if (typeof (driver as any)[feature] === 'function') {
        supportedFeatures.push(feature);
      } else {
        missingFeatures.push(feature);
      }
    }

    // 检查高级功能支持
    const advancedFeatures = [
      'enterBootloader', 'sendNetworkConfig', 'getVoltageStatus'
    ];

    for (const feature of advancedFeatures) {
      if (typeof (driver as any)[feature] === 'function') {
        supportedFeatures.push(feature);
      }
    }

    // 检查API版本兼容性
    const apiVersion = this.detectAPIVersion(driver);

    return {
      apiVersion,
      supportedFeatures,
      missingFeatures,
      deprecatedUsage
    };
  }

  /**
   * 检测API版本
   */
  private detectAPIVersion(driver: AnalyzerDriverBase): string {
    // 基于驱动类型和支持的功能推断API版本
    if (typeof (driver as any).sendNetworkConfig === 'function') {
      return '2.0';
    } else if (typeof driver.enterBootloader === 'function') {
      return '1.1';
    } else {
      return '1.0';
    }
  }

  /**
   * 生成总体评估
   */
  private generateOverallAssessment(summary: TestSummary): TestSummary['overall'] {
    const recommendations: string[] = [];
    let score = 0;

    // 验证评分 (40%)
    score += (summary.validation.score / 100) * 40;
    if (summary.validation.score < 70) {
      recommendations.push('驱动验证评分过低，需要修复基本问题');
    }

    // 功能测试评分 (30%)
    const functionalScore = (summary.functional.passed / summary.functional.total) * 100;
    score += (functionalScore / 100) * 30;
    if (functionalScore < this.config.coverageTarget) {
      recommendations.push(`功能测试覆盖率 ${functionalScore.toFixed(1)}% 低于目标 ${this.config.coverageTarget}%`);
    }

    // 性能评分 (20%)
    let performanceScore = 70; // 基础分
    if (summary.performance.baselineComparison === 'better') {
      performanceScore = 90;
    } else if (summary.performance.baselineComparison === 'worse') {
      performanceScore = 50;
      recommendations.push('性能低于基线，需要性能优化');
    }
    score += (performanceScore / 100) * 20;

    // 兼容性评分 (10%)
    const compatibilityScore = Math.max(0, 100 - summary.compatibility.missingFeatures.length * 10);
    score += (compatibilityScore / 100) * 10;
    if (summary.compatibility.missingFeatures.length > 0) {
      recommendations.push(`缺少功能: ${summary.compatibility.missingFeatures.join(', ')}`);
    }

    // 计算等级
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    // 生产就绪性评估
    const readyForProduction = (
      grade >= 'B' &&
      summary.validation.errors === 0 &&
      summary.functional.failed === 0 &&
      summary.performance.baselineComparison !== 'worse'
    );

    if (!readyForProduction) {
      recommendations.push('当前不建议用于生产环境');
    }

    return { grade, readyForProduction, recommendations };
  }

  /**
   * 验证数据一致性
   */
  private verifyDataConsistency(results: Uint8Array[][]): boolean {
    if (results.length < 2) return true;

    const first = results[0];
    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      if (first.length !== current.length) return false;

      for (let j = 0; j < first.length; j++) {
        if (first[j].length !== current[j].length) return false;

        // 允许小量的差异（模拟真实环境的噪音）
        let differences = 0;
        for (let k = 0; k < first[j].length; k++) {
          if (first[j][k] !== current[j][k]) {
            differences++;
          }
        }

        // 如果差异超过1%，认为不一致
        if (differences > first[j].length * 0.01) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 生成测试报告
   */
  generateTestReport(summary: TestSummary): string {
    let report = '# 驱动测试报告\n\n';
    report += `**测试套件**: ${summary.suiteName}\n`;
    report += `**测试时间**: ${summary.timestamp.toLocaleString()}\n`;
    report += `**总耗时**: ${(summary.duration / 1000).toFixed(2)} 秒\n`;
    report += `**总体评级**: ${summary.overall.grade}\n`;
    report += `**生产就绪**: ${summary.overall.readyForProduction ? '是' : '否'}\n\n`;

    report += '## 验证结果\n';
    report += `- 评分: ${summary.validation.score}/100\n`;
    report += `- 状态: ${summary.validation.status.toUpperCase()}\n`;
    report += `- 错误: ${summary.validation.errors}\n`;
    report += `- 警告: ${summary.validation.warnings}\n\n`;

    report += '## 功能测试\n';
    report += `- 总测试数: ${summary.functional.total}\n`;
    report += `- 通过: ${summary.functional.passed}\n`;
    report += `- 失败: ${summary.functional.failed}\n`;
    report += `- 跳过: ${summary.functional.skipped}\n`;
    report += `- 覆盖率: ${summary.functional.coverage.toFixed(1)}%\n\n`;

    report += '## 性能测试\n';
    report += `- 连接时间: ${summary.performance.connectionTime}ms\n`;
    report += `- 采集时间: ${summary.performance.captureTime}ms\n`;
    report += `- 吞吐量: ${summary.performance.throughput.toFixed(0)} samples/s\n`;
    report += `- 内存使用: ${(summary.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
    report += `- 基线比较: ${summary.performance.baselineComparison}\n\n`;

    report += '## 兼容性\n';
    report += `- API版本: ${summary.compatibility.apiVersion}\n`;
    report += `- 支持功能: ${summary.compatibility.supportedFeatures.length}\n`;
    report += `- 缺失功能: ${summary.compatibility.missingFeatures.length}\n\n`;

    if (summary.overall.recommendations.length > 0) {
      report += '## 改进建议\n';
      summary.overall.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
    }

    return report;
  }
}

/**
 * 测试数据生成器
 */
class TestDataGenerator {
  generateTestSession(): CaptureSession {
    return {
      captureChannels: [
        { channelNumber: 0, channelName: 'Test CH0', hidden: false },
        { channelNumber: 1, channelName: 'Test CH1', hidden: false }
      ],
      frequency: 1000000,
      preTriggerSamples: 1000,
      postTriggerSamples: 1000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      loopCount: 1,
      measureBursts: false
    };
  }

  generateBoundaryTestSession(driver: AnalyzerDriverBase, testCase: any): CaptureSession {
    const session = this.generateTestSession();

    if (testCase.frequency) {
      session.frequency = testCase.frequency;
    }

    if (testCase.samples) {
      session.preTriggerSamples = Math.floor(testCase.samples / 2);
      session.postTriggerSamples = Math.ceil(testCase.samples / 2);
    }

    return session;
  }

  generatePerformanceTestSession(driver: AnalyzerDriverBase): CaptureSession {
    const channels: AnalyzerChannel[] = [];
    const channelCount = Math.min(driver.channelCount, 8);

    for (let i = 0; i < channelCount; i++) {
      channels.push({
        channelNumber: i,
        channelName: `Perf CH${i}`,
        hidden: false
      });
    }

    return {
      captureChannels: channels,
      frequency: Math.min(driver.maxFrequency, 10000000), // 10MHz
      preTriggerSamples: 10000,
      postTriggerSamples: 10000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      loopCount: 1,
      measureBursts: false
    };
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  private startTime: number = 0;
  private startMemory: NodeJS.MemoryUsage | null = null;

  start(): void {
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage();
  }

  stop(): { duration: number; memoryDelta: number } {
    const duration = Date.now() - this.startTime;
    const currentMemory = process.memoryUsage();
    const memoryDelta = this.startMemory ?
      currentMemory.heapUsed - this.startMemory.heapUsed : 0;

    return { duration, memoryDelta };
  }
}
