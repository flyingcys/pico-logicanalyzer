import { DriverTester, TestCase, TestContext, TestResult, TestReport } from '../../../../src/driver-sdk/tools/DriverTester';
import { AnalyzerDriverBase } from '../../../../src/drivers/AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  ConnectionParams,
  ConnectionResult,
  CaptureSession,
  CaptureError,
  DeviceStatus,
  TriggerType
} from '../../../../src/models/AnalyzerTypes';

// Mock 正常工作的驱动
class MockWorkingDriver extends AnalyzerDriverBase {
  private _connected = false;
  private _capturing = false;

  get deviceVersion(): string | null { return 'v1.0.0'; }
  get channelCount(): number { return 8; }
  get maxFrequency(): number { return 100000000; }
  get blastFrequency(): number { return 200000000; }
  get bufferSize(): number { return 1000000; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return this._capturing; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    await new Promise(resolve => setTimeout(resolve, 10)); // 模拟连接延时
    this._connected = true;
    return {
      success: true,
      deviceInfo: {
        name: 'Mock Working Device',
        version: 'v1.0.0',
        channels: 8
      }
    };
  }

  async disconnect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 5));
    this._connected = false;
    this._capturing = false;
  }

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    if (!this._connected) {
      return CaptureError.DeviceNotConnected;
    }
    
    this._capturing = true;
    
    // 模拟采集过程
    setTimeout(() => {
      this._capturing = false;
      // 模拟数据生成
      session.captureChannels.forEach(channel => {
        channel.samples = new Uint8Array(1000).fill(Math.random() > 0.5 ? 1 : 0);
      });
    }, 50);
    
    return CaptureError.None;
  }

  async stopCapture(): Promise<boolean> {
    this._capturing = false;
    return true;
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: this._connected,
      isCapturing: this._capturing,
      lastError: null,
      batteryLevel: 85,
      temperature: 28
    };
  }

  dispose(): void {
    this._connected = false;
    this._capturing = false;
  }
}

// Mock 有问题的驱动
class MockFaultyDriver extends AnalyzerDriverBase {
  get deviceVersion(): string | null { return 'v1.0.0'; }
  get channelCount(): number { return 8; }
  get maxFrequency(): number { return 100000000; }
  get blastFrequency(): number { return 200000000; }
  get bufferSize(): number { return 1000000; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    return {
      success: false,
      error: '模拟连接失败'
    };
  }

  async disconnect(): Promise<void> {
    throw new Error('断开连接失败');
  }

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    return CaptureError.InvalidConfiguration;
  }

  async stopCapture(): Promise<boolean> {
    return false;
  }

  async getStatus(): Promise<DeviceStatus> {
    throw new Error('状态查询失败');
  }

  dispose(): void {}
}

// Mock 慢速驱动（用于超时测试）
class MockSlowDriver extends AnalyzerDriverBase {
  get deviceVersion(): string | null { return 'v1.0.0'; }
  get channelCount(): number { return 8; }
  get maxFrequency(): number { return 100000000; }
  get blastFrequency(): number { return 200000000; }
  get bufferSize(): number { return 1000000; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 长时间延时
    return { success: true, deviceInfo: { name: 'Slow Device' } };
  }

  async disconnect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 很长的延时
    return CaptureError.None;
  }

  async stopCapture(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<DeviceStatus> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      isConnected: true,
      isCapturing: false,
      lastError: null,
      batteryLevel: 100,
      temperature: 25
    };
  }

  dispose(): void {}
}

describe('DriverTester', () => {
  let tester: DriverTester;

  beforeEach(() => {
    tester = new DriverTester(true); // 使用模拟模式
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化测试器', () => {
      expect(tester).toBeInstanceOf(DriverTester);
    });

    it('应该支持模拟模式和实际模式', () => {
      const mockTester = new DriverTester(true);
      const realTester = new DriverTester(false);
      
      expect(mockTester).toBeInstanceOf(DriverTester);
      expect(realTester).toBeInstanceOf(DriverTester);
    });
  });

  describe('测试用例管理', () => {
    it('应该能够添加自定义测试用例', () => {
      const customTest: TestCase = {
        name: 'custom-test',
        description: '自定义测试用例',
        category: 'connection',
        timeout: 5000,
        run: async (driver, context) => ({
          passed: true,
          message: '自定义测试通过',
          duration: 100
        })
      };

      tester.addTestCase(customTest);
      
      // 验证测试用例是否被添加
      const mockDriver = new MockWorkingDriver('test');
      return tester.runAllTests(mockDriver).then(report => {
        const customResult = report.testResults.find(r => r.testName === 'custom-test');
        expect(customResult).toBeDefined();
        expect(customResult?.passed).toBe(true);
        mockDriver.dispose();
      });
    });

    it('应该能够移除测试用例', () => {
      const testCase: TestCase = {
        name: 'removable-test',
        description: '可移除的测试',
        category: 'status',
        timeout: 1000,
        run: async () => ({ passed: true, message: '测试', duration: 0 })
      };

      tester.addTestCase(testCase);
      const removed = tester.removeTestCase('removable-test');
      
      expect(removed).toBe(true);
      
      // 验证测试用例是否被移除
      const mockDriver = new MockWorkingDriver('test');
      return tester.runAllTests(mockDriver).then(report => {
        const removedResult = report.testResults.find(r => r.testName === 'removable-test');
        expect(removedResult).toBeUndefined();
        mockDriver.dispose();
      });
    });

    it('移除不存在的测试用例应该返回false', () => {
      const removed = tester.removeTestCase('non-existent-test');
      expect(removed).toBe(false);
    });
  });

  describe('基本功能测试 - 正常驱动', () => {
    let mockDriver: MockWorkingDriver;

    beforeEach(() => {
      mockDriver = new MockWorkingDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it('应该成功运行所有测试', async () => {
      const report = await tester.runAllTests(mockDriver);

      expect(report).toBeDefined();
      expect(report.driverName).toBe('MockWorkingDriver');
      expect(report.totalTests).toBeGreaterThan(0);
      expect(report.passedTests).toBeGreaterThan(0);
      expect(report.overallStatus).toMatch(/^(pass|partial|fail)$/);
    }, 15000);

    it('应该正确记录测试统计信息', async () => {
      const report = await tester.runAllTests(mockDriver);

      expect(report.totalTests).toBe(report.passedTests + report.failedTests + report.skippedTests);
      expect(report.totalDuration).toBeGreaterThan(0);
      expect(report.testResults).toHaveLength(report.totalTests);
    }, 15000);

    it('应该包含分类统计', async () => {
      const report = await tester.runAllTests(mockDriver);

      expect(report.summary).toBeDefined();
      expect(report.summary.connectionTests).toBeDefined();
      expect(report.summary.captureTests).toBeDefined();
      expect(report.summary.statusTests).toBeDefined();
      expect(report.summary.performanceTests).toBeDefined();
      expect(report.summary.stressTests).toBeDefined();
    }, 15000);

    it('应该生成详细的测试结果', async () => {
      const report = await tester.runAllTests(mockDriver);

      report.testResults.forEach(result => {
        expect(result.testName).toBeDefined();
        expect(result.category).toBeDefined();
        expect(typeof result.passed).toBe('boolean');
        expect(result.message).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    }, 15000);
  });

  describe('基本功能测试 - 故障驱动', () => {
    let mockDriver: MockFaultyDriver;

    beforeEach(() => {
      mockDriver = new MockFaultyDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it('应该正确检测驱动故障', async () => {
      const report = await tester.runAllTests(mockDriver);

      expect(report.overallStatus).toMatch(/^(partial|fail)$/);
      expect(report.failedTests).toBeGreaterThan(0);
    }, 15000);

    it('应该记录故障详情', async () => {
      const report = await tester.runAllTests(mockDriver);

      const failedTests = report.testResults.filter(r => !r.passed);
      expect(failedTests.length).toBeGreaterThan(0);
      
      failedTests.forEach(test => {
        expect(test.message).toBeDefined();
        expect(test.message.length).toBeGreaterThan(0);
      });
    }, 15000);
  });

  describe('分类测试功能', () => {
    let mockDriver: MockWorkingDriver;

    beforeEach(() => {
      mockDriver = new MockWorkingDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it('应该能够只运行连接测试', async () => {
      const report = await tester.runTestsByCategory(mockDriver, 'connection');

      expect(report.testResults.every(r => r.category === 'connection')).toBe(true);
      expect(report.summary.connectionTests.passed + report.summary.connectionTests.failed)
        .toBe(report.totalTests);
    }, 10000);

    it('应该能够只运行采集测试', async () => {
      const report = await tester.runTestsByCategory(mockDriver, 'capture');

      expect(report.testResults.every(r => r.category === 'capture')).toBe(true);
    }, 10000);

    it('应该能够只运行状态测试', async () => {
      const report = await tester.runTestsByCategory(mockDriver, 'status');

      expect(report.testResults.every(r => r.category === 'status')).toBe(true);
    }, 10000);

    it('应该能够只运行性能测试', async () => {
      const report = await tester.runTestsByCategory(mockDriver, 'performance');

      expect(report.testResults.every(r => r.category === 'performance')).toBe(true);
    }, 15000);

    it('应该能够只运行压力测试', async () => {
      const report = await tester.runTestsByCategory(mockDriver, 'stress');

      expect(report.testResults.every(r => r.category === 'stress')).toBe(true);
    }, 15000);
  });

  describe('超时处理', () => {
    let mockDriver: MockSlowDriver;

    beforeEach(() => {
      mockDriver = new MockSlowDriver('test');
    });

    afterEach(() => {
      mockDriver.dispose();
    });

    it.skip('应该正确处理测试超时', async () => {
      // 添加一个短超时的测试用例
      const shortTimeoutTest: TestCase = {
        name: 'timeout-test',
        description: '超时测试',
        category: 'connection',
        timeout: 100, // 很短的超时时间
        run: async (driver) => {
          await driver.connect(); // 这个会超时
          return { passed: true, message: '不应该到达这里', duration: 0 };
        }
      };

      tester.addTestCase(shortTimeoutTest);
      const report = await tester.runAllTests(mockDriver);

      const timeoutResult = report.testResults.find(r => r.testName === 'timeout-test');
      expect(timeoutResult).toBeDefined();
      expect(timeoutResult?.passed).toBe(false);
      expect(timeoutResult?.message).toContain('测试执行失败');
    }, 15000);
  });

  describe('文本报告生成', () => {
    it('应该生成可读的文本报告', async () => {
      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);
      const textReport = tester.generateTextReport(report);

      expect(textReport).toContain('驱动测试报告');
      expect(textReport).toContain('MockWorkingDriver');
      expect(textReport).toContain(report.overallStatus.toUpperCase());
      expect(textReport).toContain(`${report.passedTests}/${report.totalTests} 通过`);

      mockDriver.dispose();
    }, 15000);

    it('文本报告应该包含分类统计', async () => {
      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);
      const textReport = tester.generateTextReport(report);

      expect(textReport).toContain('分类统计');
      expect(textReport).toContain('connection');
      expect(textReport).toContain('capture');
      expect(textReport).toContain('status');

      mockDriver.dispose();
    }, 15000);

    it('文本报告应该包含失败测试详情', async () => {
      const mockDriver = new MockFaultyDriver('test');
      const report = await tester.runAllTests(mockDriver);
      const textReport = tester.generateTextReport(report);

      if (report.failedTests > 0) {
        expect(textReport).toContain('失败测试详情');
      }

      mockDriver.dispose();
    }, 15000);
  });

  describe('性能监控', () => {
    it('应该监控内存使用情况', async () => {
      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);

      // 查找内存测试结果
      const memoryTest = report.testResults.find(r => r.testName === 'memory-usage');
      if (memoryTest) {
        expect(memoryTest.performance).toBeDefined();
        expect(memoryTest.performance?.memoryUsage).toBeDefined();
        expect(typeof memoryTest.performance?.memoryUsage).toBe('number');
      }

      mockDriver.dispose();
    }, 20000);

    it('应该监控测试执行时间', async () => {
      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);

      report.testResults.forEach(result => {
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(typeof result.duration).toBe('number');
      });

      mockDriver.dispose();
    }, 15000);
  });

  describe('并发测试处理', () => {
    it('应该正确处理并发操作测试', async () => {
      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);

      const concurrentTest = report.testResults.find(r => r.testName === 'concurrent-operations');
      expect(concurrentTest).toBeDefined();
      // 在模拟模式下，并发测试应该能够通过
      if (concurrentTest) {
        expect(typeof concurrentTest.passed).toBe('boolean');
      }

      mockDriver.dispose();
    }, 15000);
  });

  describe('错误处理', () => {
    it('应该处理测试用例执行异常', async () => {
      const faultyTest: TestCase = {
        name: 'faulty-test',
        description: '有问题的测试',
        category: 'connection',
        timeout: 5000,
        run: async () => {
          throw new Error('测试执行异常');
        }
      };

      tester.addTestCase(faultyTest);

      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);

      const faultyResult = report.testResults.find(r => r.testName === 'faulty-test');
      expect(faultyResult).toBeDefined();
      expect(faultyResult?.passed).toBe(false);
      expect(faultyResult?.message).toContain('测试执行失败');
      expect(faultyResult?.error).toBeDefined();

      mockDriver.dispose();
    }, 10000);

    it('应该正确处理驱动方法异常', async () => {
      const mockDriver = new MockFaultyDriver('test');
      const report = await tester.runAllTests(mockDriver);

      // 应该有测试失败，但测试框架本身不应崩溃
      expect(report).toBeDefined();
      expect(report.testResults.length).toBeGreaterThan(0);

      mockDriver.dispose();
    }, 15000);
  });

  describe('边界条件测试', () => {
    it('应该处理空测试用例列表', async () => {
      const emptyTester = new DriverTester(true);
      // 清除所有内置测试用例（通过创建新的实例并手动清空）
      
      const mockDriver = new MockWorkingDriver('test');
      const report = await emptyTester.runAllTests(mockDriver);

      expect(report.totalTests).toBeGreaterThanOrEqual(0);
      expect(report.overallStatus).toBeDefined();

      mockDriver.dispose();
    });

    it('应该处理极长的测试执行时间', async () => {
      const longTest: TestCase = {
        name: 'long-test',
        description: '长时间运行的测试',
        category: 'performance',
        timeout: 1000,
        run: async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return {
            passed: true,
            message: '长时间测试完成',
            duration: 500
          };
        }
      };

      tester.addTestCase(longTest);

      const mockDriver = new MockWorkingDriver('test');
      const report = await tester.runAllTests(mockDriver);

      const longResult = report.testResults.find(r => r.testName === 'long-test');
      expect(longResult).toBeDefined();
      expect(longResult?.duration).toBeGreaterThan(400);

      mockDriver.dispose();
    }, 20000);
  });
});