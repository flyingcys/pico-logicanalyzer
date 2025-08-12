import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';
import {
  ConnectionParams,
  CaptureSession,
  CaptureError,
  DeviceStatus,
  AnalyzerChannel,
  TriggerType
} from '../../models/AnalyzerTypes';

/**
 * 测试用例定义
 */
export interface TestCase {
  name: string;
  description: string;
  category: 'connection' | 'capture' | 'status' | 'performance' | 'stress';
  timeout: number;
  run: (driver: AnalyzerDriverBase, context: TestContext) => Promise<TestResult>;
}

/**
 * 测试上下文
 */
export interface TestContext {
  mockMode: boolean;
  deviceSimulator?: any;
  testData?: any;
  logger: (message: string) => void;
}

/**
 * 测试结果
 */
export interface TestResult {
  passed: boolean;
  message: string;
  duration: number;
  details?: any;
  error?: Error;
  performance?: {
    memoryUsage?: number;
    cpuTime?: number;
    throughput?: number;
  };
}

/**
 * 测试报告
 */
export interface TestReport {
  driverName: string;
  timestamp: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  overallStatus: 'pass' | 'fail' | 'partial';
  testResults: Array<TestResult & { testName: string; category: string }>;
  summary: {
    connectionTests: { passed: number; failed: number };
    captureTests: { passed: number; failed: number };
    statusTests: { passed: number; failed: number };
    performanceTests: { passed: number; failed: number };
    stressTests: { passed: number; failed: number };
  };
}

/**
 * 驱动测试器
 * 提供全面的驱动功能测试
 */
export class DriverTester {
  private testCases: TestCase[] = [];
  private mockMode: boolean = false;

  constructor(mockMode: boolean = false) {
    this.mockMode = mockMode;
    this.initializeBuiltinTests();
  }

  /**
   * 初始化内置测试用例
   */
  private initializeBuiltinTests(): void {
    // 连接测试
    this.addTestCase({
      name: 'basic-connection',
      description: '基本连接功能测试',
      category: 'connection',
      timeout: 10000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始连接测试...');

          // 测试连接
          const connectionParams: ConnectionParams = { timeout: 5000 };
          const result = await driver.connect(connectionParams);

          if (!result.success) {
            return {
              passed: false,
              message: `连接失败: ${result.error}`,
              duration: Date.now() - startTime
            };
          }

          // 验证连接状态
          const status = await driver.getStatus();
          if (!status.isConnected) {
            return {
              passed: false,
              message: '连接成功但状态显示未连接',
              duration: Date.now() - startTime
            };
          }

          context.logger('连接测试通过');
          return {
            passed: true,
            message: '连接功能正常',
            duration: Date.now() - startTime,
            details: { deviceInfo: result.deviceInfo }
          };
        } catch (error) {
          return {
            passed: false,
            message: '连接测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });

    // 断开连接测试
    this.addTestCase({
      name: 'disconnect',
      description: '断开连接功能测试',
      category: 'connection',
      timeout: 5000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始断开连接测试...');

          await driver.disconnect();

          // 验证断开状态
          const status = await driver.getStatus();
          if (status.isConnected) {
            return {
              passed: false,
              message: '断开连接后状态仍显示已连接',
              duration: Date.now() - startTime
            };
          }

          context.logger('断开连接测试通过');
          return {
            passed: true,
            message: '断开连接功能正常',
            duration: Date.now() - startTime
          };
        } catch (error) {
          return {
            passed: false,
            message: '断开连接测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });

    // 基本采集测试
    this.addTestCase({
      name: 'basic-capture',
      description: '基本数据采集功能测试',
      category: 'capture',
      timeout: 30000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始基本采集测试...');

          // 创建测试采集会话
          const testSession: CaptureSession = {
            captureChannels: [
              {
                channelNumber: 0,
                channelName: 'Test CH0',
                textualChannelNumber: 'CH0',
                hidden: false,
                clone() { return { ...this }; }
              }
            ],
            frequency: 1000000, // 1MHz
            preTriggerSamples: 1000,
            postTriggerSamples: 1000,
            get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 1,
            measureBursts: false,
            clone() { return { ...this }; },
            cloneSettings() { return { ...this }; }
          };

          // 启动采集
          const captureError = await driver.startCapture(testSession);
          if (captureError !== CaptureError.None) {
            return {
              passed: false,
              message: `采集启动失败: ${CaptureError[captureError]}`,
              duration: Date.now() - startTime
            };
          }

          // 等待采集完成或超时
          const maxWaitTime = 20000; // 20秒
          const waitStartTime = Date.now();

          while (driver.isCapturing && (Date.now() - waitStartTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          if (driver.isCapturing) {
            await driver.stopCapture();
            return {
              passed: false,
              message: '采集超时',
              duration: Date.now() - startTime
            };
          }

          context.logger('基本采集测试通过');
          return {
            passed: true,
            message: '基本采集功能正常',
            duration: Date.now() - startTime,
            details: { sessionInfo: testSession }
          };
        } catch (error) {
          return {
            passed: false,
            message: '基本采集测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });

    // 状态查询测试
    this.addTestCase({
      name: 'status-query',
      description: '设备状态查询测试',
      category: 'status',
      timeout: 5000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始状态查询测试...');

          const status = await driver.getStatus();

          // 验证状态对象的必需字段
          if (typeof status.isConnected !== 'boolean') {
            return {
              passed: false,
              message: 'isConnected字段类型错误',
              duration: Date.now() - startTime
            };
          }

          if (typeof status.isCapturing !== 'boolean') {
            return {
              passed: false,
              message: 'isCapturing字段类型错误',
              duration: Date.now() - startTime
            };
          }

          context.logger('状态查询测试通过');
          return {
            passed: true,
            message: '状态查询功能正常',
            duration: Date.now() - startTime,
            details: { status }
          };
        } catch (error) {
          return {
            passed: false,
            message: '状态查询测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });

    // 性能测试 - 内存使用
    this.addTestCase({
      name: 'memory-usage',
      description: '内存使用性能测试',
      category: 'performance',
      timeout: 15000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始内存使用测试...');

          const initialMemory = process.memoryUsage();

          // 模拟多次连接/断开操作
          for (let i = 0; i < 10; i++) {
            await driver.connect({ timeout: 1000 });
            await driver.disconnect();
          }

          const finalMemory = process.memoryUsage();
          const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

          // 如果内存增长超过50MB，认为有问题
          const memoryThreshold = 50 * 1024 * 1024; // 50MB
          const passed = memoryIncrease < memoryThreshold;

          context.logger(`内存测试完成，增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

          return {
            passed,
            message: passed
              ? `内存使用正常，增长${Math.round(memoryIncrease / 1024 / 1024)}MB`
              : `内存增长过多: ${Math.round(memoryIncrease / 1024 / 1024)}MB`,
            duration: Date.now() - startTime,
            performance: {
              memoryUsage: memoryIncrease
            }
          };
        } catch (error) {
          return {
            passed: false,
            message: '内存使用测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });

    // 并发测试
    this.addTestCase({
      name: 'concurrent-operations',
      description: '并发操作压力测试',
      category: 'stress',
      timeout: 30000,
      run: async (driver, context) => {
        const startTime = Date.now();

        try {
          context.logger('开始并发操作测试...');

          // 连接设备
          await driver.connect({ timeout: 5000 });

          // 并发状态查询
          const statusPromises = Array(10).fill(0).map(() => driver.getStatus());
          const statusResults = await Promise.allSettled(statusPromises);

          const failedStatus = statusResults.filter(r => r.status === 'rejected').length;
          if (failedStatus > 0) {
            return {
              passed: false,
              message: `${failedStatus}/10 状态查询失败`,
              duration: Date.now() - startTime
            };
          }

          await driver.disconnect();

          context.logger('并发操作测试通过');
          return {
            passed: true,
            message: '并发操作处理正常',
            duration: Date.now() - startTime
          };
        } catch (error) {
          return {
            passed: false,
            message: '并发操作测试异常',
            duration: Date.now() - startTime,
            error: error as Error
          };
        }
      }
    });
  }

  /**
   * 添加测试用例
   */
  addTestCase(testCase: TestCase): void {
    this.testCases.push(testCase);
  }

  /**
   * 移除测试用例
   */
  removeTestCase(testName: string): boolean {
    const index = this.testCases.findIndex(test => test.name === testName);
    if (index >= 0) {
      this.testCases.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 运行所有测试
   */
  async runAllTests(driver: AnalyzerDriverBase): Promise<TestReport> {
    const report: TestReport = {
      driverName: driver.constructor.name,
      timestamp: new Date(),
      totalTests: this.testCases.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      overallStatus: 'pass',
      testResults: [],
      summary: {
        connectionTests: { passed: 0, failed: 0 },
        captureTests: { passed: 0, failed: 0 },
        statusTests: { passed: 0, failed: 0 },
        performanceTests: { passed: 0, failed: 0 },
        stressTests: { passed: 0, failed: 0 }
      }
    };

    const logger = (message: string) => {
      console.log(`[${report.driverName}] ${message}`);
    };

    const context: TestContext = {
      mockMode: this.mockMode,
      logger
    };

    console.log(`开始测试驱动: ${report.driverName} (${this.testCases.length} 个测试用例)`);

    for (const testCase of this.testCases) {
      logger(`运行测试: ${testCase.name}`);

      try {
        const testResult = await Promise.race([
          testCase.run(driver, context),
          new Promise<TestResult>((_, reject) =>
            setTimeout(() => reject(new Error('测试超时')), testCase.timeout)
          )
        ]);

        // 更新统计
        if (testResult.passed) {
          report.passedTests++;
          this.updateCategorySummary(report.summary, testCase.category, true);
        } else {
          report.failedTests++;
          this.updateCategorySummary(report.summary, testCase.category, false);
        }

        report.totalDuration += testResult.duration;
        report.testResults.push({
          ...testResult,
          testName: testCase.name,
          category: testCase.category
        });

        logger(`测试 ${testCase.name} ${testResult.passed ? '通过' : '失败'}: ${testResult.message}`);

      } catch (error) {
        report.failedTests++;
        this.updateCategorySummary(report.summary, testCase.category, false);

        report.testResults.push({
          passed: false,
          message: `测试执行失败: ${error}`,
          duration: testCase.timeout,
          error: error as Error,
          testName: testCase.name,
          category: testCase.category
        });

        logger(`测试 ${testCase.name} 执行失败: ${error}`);
      }
    }

    // 确定总体状态
    if (report.failedTests === 0) {
      report.overallStatus = 'pass';
    } else if (report.passedTests > 0) {
      report.overallStatus = 'partial';
    } else {
      report.overallStatus = 'fail';
    }

    console.log(`测试完成: ${report.passedTests}/${report.totalTests} 通过`);
    return report;
  }

  /**
   * 运行特定类别的测试
   */
  async runTestsByCategory(
    driver: AnalyzerDriverBase,
    category: TestCase['category']
  ): Promise<TestReport> {
    const originalTests = [...this.testCases];
    this.testCases = this.testCases.filter(test => test.category === category);

    const report = await this.runAllTests(driver);

    this.testCases = originalTests;
    return report;
  }

  /**
   * 更新分类统计
   */
  private updateCategorySummary(
    summary: TestReport['summary'],
    category: string,
    passed: boolean
  ): void {
    const categoryKey = `${category}Tests` as keyof TestReport['summary'];
    if (summary[categoryKey]) {
      if (passed) {
        summary[categoryKey].passed++;
      } else {
        summary[categoryKey].failed++;
      }
    }
  }

  /**
   * 生成测试报告文本
   */
  generateTextReport(report: TestReport): string {
    let text = '驱动测试报告\n';
    text += '===============\n';
    text += `驱动名称: ${report.driverName}\n`;
    text += `测试时间: ${report.timestamp.toLocaleString()}\n`;
    text += `总体状态: ${report.overallStatus.toUpperCase()}\n`;
    text += `测试结果: ${report.passedTests}/${report.totalTests} 通过\n`;
    text += `总耗时: ${Math.round(report.totalDuration / 1000)}秒\n\n`;

    // 分类统计
    text += '分类统计:\n';
    text += '---------\n';
    Object.entries(report.summary).forEach(([category, stats]) => {
      const categoryName = category.replace('Tests', '');
      text += `${categoryName}: ${stats.passed}/${stats.passed + stats.failed} 通过\n`;
    });
    text += '\n';

    // 失败的测试详情
    const failedTests = report.testResults.filter(result => !result.passed);
    if (failedTests.length > 0) {
      text += '失败测试详情:\n';
      text += '-------------\n';
      failedTests.forEach((test, index) => {
        text += `${index + 1}. ${test.testName} (${test.category})\n`;
        text += `   错误: ${test.message}\n`;
        if (test.error) {
          text += `   异常: ${test.error.message}\n`;
        }
        text += '\n';
      });
    }

    return text;
  }
}
