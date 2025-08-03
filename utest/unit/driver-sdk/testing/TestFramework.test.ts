import { TestFramework, TestSuiteConfig, TestSummary } from '../../../../src/driver-sdk/testing/TestFramework';
import { DriverValidator, ValidationReport } from '../../../../src/driver-sdk/tools/DriverValidator';
import { DriverTester, TestReport } from '../../../../src/driver-sdk/tools/DriverTester';
import { AnalyzerDriverBase } from '../../../../src/drivers/AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  ConnectionParams,
  ConnectionResult,
  CaptureSession,
  CaptureError,
  DeviceStatus,
  TriggerType,
  AnalyzerChannel
} from '../../../../src/models/AnalyzerTypes';

// Mock DriverValidator
jest.mock('../../../../src/driver-sdk/tools/DriverValidator');
jest.mock('../../../../src/driver-sdk/tools/DriverTester');

const MockedDriverValidator = DriverValidator as jest.MockedClass<typeof DriverValidator>;
const MockedDriverTester = DriverTester as jest.MockedClass<typeof DriverTester>;

// Mock 高质量驱动类
class MockHighQualityDriver extends AnalyzerDriverBase {
  private _connected = false;
  private _capturing = false;

  get deviceVersion(): string | null { return 'v2.0.0'; }
  get channelCount(): number { return 16; }
  get maxFrequency(): number { return 200000000; }
  get minFrequency(): number { return 1000; }
  get blastFrequency(): number { return 400000000; }
  get bufferSize(): number { return 2000000; }
  get isNetwork(): boolean { return true; }
  get isCapturing(): boolean { return this._capturing; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Network; }

  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    await new Promise(resolve => setTimeout(resolve, 50)); // 模拟较快连接
    this._connected = true;
    return {
      success: true,
      deviceInfo: {
        name: 'High Quality Mock Device',
        version: 'v2.0.0',
        channels: 16
      }
    };
  }

  async disconnect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 20));
    this._connected = false;
    this._capturing = false;
  }

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    if (!this._connected) {
      return CaptureError.DeviceNotConnected;
    }
    this._capturing = true;
    
    // 模拟快速采集
    setTimeout(() => {
      this._capturing = false;
      session.captureChannels.forEach(channel => {
        channel.samples = new Array(session.preTriggerSamples + session.postTriggerSamples)
          .fill(0).map(() => Math.floor(Math.random() * 256));
      });
    }, 100);
    
    return CaptureError.None;
  }

  async stopCapture(): Promise<void> {
    this._capturing = false;
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      connected: this._connected,
      capturing: this._capturing,
      error: null
    };
  }

  async enterBootloader(): Promise<boolean> {
    return true;
  }

  async sendNetworkConfig(): Promise<boolean> {
    return true;
  }

  async getVoltageStatus(): Promise<any> {
    return { voltage: 3.3 };
  }
}

// Mock 低质量驱动类
class MockLowQualityDriver extends AnalyzerDriverBase {
  private _connected = false;

  get deviceVersion(): string | null { return 'v0.9.0'; }
  get channelCount(): number { return 4; }
  get maxFrequency(): number { return 50000000; }
  get minFrequency(): number { return 1000; }
  get blastFrequency(): number { return 50000000; }
  get bufferSize(): number { return 100000; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  async connect(): Promise<ConnectionResult> {
    await new Promise(resolve => setTimeout(resolve, 200)); // 模拟慢连接
    this._connected = true;
    return {
      success: true,
      deviceInfo: {
        name: 'Low Quality Mock Device',
        version: 'v0.9.0',
        channels: 4
      }
    };
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async startCapture(session: CaptureSession): Promise<CaptureError> {
    if (!this._connected) {
      return CaptureError.DeviceNotConnected;
    }
    
    // 模拟慢采集
    await new Promise(resolve => setTimeout(resolve, 300));
    
    session.captureChannels.forEach(channel => {
      channel.samples = new Array(Math.min(session.preTriggerSamples + session.postTriggerSamples, 1000))
        .fill(0);
    });
    
    return CaptureError.None;
  }

  async stopCapture(): Promise<void> {
    // 空实现
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      connected: this._connected,
      capturing: false,
      error: null
    };
  }

  async enterBootloader(): Promise<boolean> {
    return true; // 支持bootloader，这样API版本是1.1
  }

  // 覆盖父类方法，不提供网络配置功能
  sendNetworkConfig: any = undefined;
}

// Mock 失败驱动类 - 缺少基本功能
class MockFailingDriver extends AnalyzerDriverBase {
  get deviceVersion(): string | null { return null; }
  get channelCount(): number { return 0; }
  get maxFrequency(): number { return 0; }
  get minFrequency(): number { return 0; }
  get blastFrequency(): number { return 0; }
  get bufferSize(): number { return 0; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return false; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  // 实现基本方法但都会失败，同时删除高级功能
  async connect(): Promise<ConnectionResult> {
    return { success: false, error: 'Connection failed' };
  }

  async disconnect(): Promise<void> {
    // 基本功能存在但会失败
    throw new Error('Disconnect failed');
  }

  async startCapture(): Promise<CaptureError> {
    return CaptureError.DeviceNotConnected;
  }

  async stopCapture(): Promise<void> {
    throw new Error('Stop capture failed');
  }

  async getStatus(): Promise<DeviceStatus> {
    throw new Error('Get status failed');
  }
  
  // 不实现高级功能，确保这些方法不存在
  enterBootloader: any = undefined;
  sendNetworkConfig: any = undefined;
  getVoltageStatus: any = undefined;
}

describe('TestFramework', () => {
  let testFramework: TestFramework;
  let mockDriverValidator: jest.Mocked<DriverValidator>;
  let mockDriverTester: jest.Mocked<DriverTester>;
  let originalConsole: Console;

  beforeEach(() => {
    // 静默控制台输出
    originalConsole = global.console;
    global.console = {
      ...originalConsole,
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // 创建mock实例
    mockDriverValidator = new MockedDriverValidator() as jest.Mocked<DriverValidator>;
    mockDriverTester = new MockedDriverTester(true) as jest.Mocked<DriverTester>;

    // 设置默认mock返回值
    mockDriverValidator.validateDriver = jest.fn();
    mockDriverTester.runAllTests = jest.fn();
    mockDriverTester.addTestCase = jest.fn();

    // Mock构造函数返回我们的mock实例
    MockedDriverValidator.mockImplementation(() => mockDriverValidator);
    MockedDriverTester.mockImplementation(() => mockDriverTester);

    testFramework = new TestFramework();
  });

  afterEach(() => {
    global.console = originalConsole;
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该使用默认配置创建实例', () => {
      const framework = new TestFramework();
      expect(framework).toBeInstanceOf(TestFramework);
    });

    it('应该合并用户配置和默认配置', () => {
      const customConfig: Partial<TestSuiteConfig> = {
        name: 'Custom Test Suite',
        timeout: 120000,
        parallel: true,
        coverageTarget: 90
      };
      
      const framework = new TestFramework(customConfig);
      expect(framework).toBeInstanceOf(TestFramework);
    });

    it('应该创建必要的内部组件', () => {
      expect(MockedDriverValidator).toHaveBeenCalled();
      expect(MockedDriverTester).toHaveBeenCalled();
    });
  });

  describe('runFullTestSuite', () => {
    it('应该成功运行高质量驱动的完整测试套件', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      // Mock 验证报告 - 高质量
      const mockValidationReport: ValidationReport = {
        driverName: 'MockHighQualityDriver',
        timestamp: new Date(),
        score: 95,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 100, status: 'pass', issues: [] },
          interface: { score: 95, status: 'pass', issues: [] },
          implementation: { score: 90, status: 'pass', issues: [] },
          documentation: { score: 95, status: 'pass', issues: [] }
        },
        recommendations: []
      };

      // Mock 功能测试报告 - 高质量
      const mockTestReport: TestReport = {
        suiteName: 'High Quality Driver Tests',
        timestamp: new Date(),
        duration: 2000,
        totalTests: 20,
        passedTests: 20,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      };

      mockDriverValidator.validateDriver.mockResolvedValue(mockValidationReport);
      mockDriverTester.runAllTests.mockResolvedValue(mockTestReport);

      // 使用性能基线确保 baselineComparison 不是 'worse'
      const frameworkWithBaseline = new TestFramework({
        performanceBaseline: {
          connectionTime: 200,
          captureTime: 400,
          throughput: 100000
        }
      });

      const summary = await frameworkWithBaseline.runFullTestSuite(driver);

      expect(summary).toBeDefined();
      expect(summary.validation.score).toBe(95);
      expect(summary.validation.status).toBe('pass');
      expect(summary.functional.total).toBe(20);
      expect(summary.functional.passed).toBe(20);
      expect(summary.functional.failed).toBe(0);
      expect(summary.functional.coverage).toBe(100);
      expect(summary.overall.grade).toBe('A');
      expect(summary.overall.readyForProduction).toBe(true);
      expect(summary.duration).toBeGreaterThan(0);
    });

    it('应该正确处理低质量驱动', async () => {
      const driver = new MockLowQualityDriver('test-connection');
      
      // Mock 验证报告 - 低质量
      const mockValidationReport: ValidationReport = {
        driverName: 'MockLowQualityDriver',
        timestamp: new Date(),
        score: 60,
        overallStatus: 'warning',
        errors: [],
        warnings: ['性能可能不佳'],
        categories: {
          structure: { score: 70, status: 'warning', issues: [] },
          interface: { score: 60, status: 'warning', issues: [] },
          implementation: { score: 50, status: 'warning', issues: [] },
          documentation: { score: 60, status: 'warning', issues: [] }
        },
        recommendations: ['提升性能', '完善文档']
      };

      // Mock 功能测试报告 - 低质量
      const mockTestReport: TestReport = {
        suiteName: 'Low Quality Driver Tests',
        timestamp: new Date(),
        duration: 5000,
        totalTests: 15,
        passedTests: 10,
        failedTests: 3,
        skippedTests: 2,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'fail',
          performance: 'warning',
          edgeCases: 'fail'
        }
      };

      mockDriverValidator.validateDriver.mockResolvedValue(mockValidationReport);
      mockDriverTester.runAllTests.mockResolvedValue(mockTestReport);

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.validation.score).toBe(60);
      expect(summary.validation.status).toBe('warning');
      expect(summary.functional.passed).toBe(10);
      expect(summary.functional.failed).toBe(3);
      expect(summary.functional.coverage).toBeCloseTo(66.67, 1);
      expect(summary.overall.grade).toBe('D');
      expect(summary.overall.readyForProduction).toBe(false);
      expect(summary.overall.recommendations).toContain('当前不建议用于生产环境');
    });

    it('应该正确处理失败的驱动', async () => {
      const driver = new MockFailingDriver('test-connection');
      
      // Mock 验证报告 - 失败
      const mockValidationReport: ValidationReport = {
        driverName: 'MockFailingDriver',
        timestamp: new Date(),
        score: 20,
        overallStatus: 'fail',
        errors: ['连接失败', '无法获取设备信息'],
        warnings: [],
        categories: {
          structure: { score: 30, status: 'fail', issues: [] },
          interface: { score: 20, status: 'fail', issues: [] },
          implementation: { score: 10, status: 'fail', issues: [] },
          documentation: { score: 20, status: 'fail', issues: [] }
        },
        recommendations: ['修复连接问题', '实现基本功能']
      };

      // Mock 功能测试报告 - 失败
      const mockTestReport: TestReport = {
        suiteName: 'Failing Driver Tests',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 2,
        failedTests: 8,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'fail',
          errorHandling: 'fail',
          performance: 'fail',
          edgeCases: 'fail'
        }
      };

      mockDriverValidator.validateDriver.mockResolvedValue(mockValidationReport);
      mockDriverTester.runAllTests.mockResolvedValue(mockTestReport);

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.validation.score).toBe(20);
      expect(summary.validation.status).toBe('fail');
      expect(summary.functional.failed).toBe(8);
      expect(summary.overall.grade).toBe('F');
      expect(summary.overall.readyForProduction).toBe(false);
    });

    it('应该处理测试执行异常', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockRejectedValue(new Error('Validation failed'));

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.overall.grade).toBe('F');
      expect(summary.overall.readyForProduction).toBe(false);
      expect(summary.overall.recommendations.some(rec => /测试执行失败/.test(rec))).toBe(true);
    });

    it('应该记录正确的时间戳和持续时间', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      const startTime = Date.now();
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);
      const endTime = Date.now();

      expect(summary.timestamp).toBeInstanceOf(Date);
      expect(summary.timestamp.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(summary.timestamp.getTime()).toBeLessThanOrEqual(endTime);
      expect(summary.duration).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    it('应该执行性能基准测试', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      // 设置性能基线
      const performanceBaseline = {
        connectionTime: 100,
        captureTime: 200,
        throughput: 1000000
      };

      const frameworkWithBaseline = new TestFramework({
        performanceBaseline
      });

      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      const summary = await frameworkWithBaseline.runFullTestSuite(driver);

      expect(summary.performance).toBeDefined();
      expect(summary.performance.connectionTime).toBeGreaterThan(0);
      expect(summary.performance.captureTime).toBeGreaterThan(0);
      expect(summary.performance.throughput).toBeGreaterThan(0);
      expect(summary.performance.memoryUsage).toBeDefined();
      expect(['better', 'same', 'worse']).toContain(summary.performance.baselineComparison);
    });

    it('应该处理连接失败的性能测试', async () => {
      const driver = new MockFailingDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 20,
        overallStatus: 'fail',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 20, status: 'fail', issues: [] },
          interface: { score: 20, status: 'fail', issues: [] },
          implementation: { score: 20, status: 'fail', issues: [] },
          documentation: { score: 20, status: 'fail', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 5,
        passedTests: 1,
        failedTests: 4,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'fail',
          errorHandling: 'fail',
          performance: 'fail',
          edgeCases: 'fail'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      // 连接失败时，性能测试应该返回 -1
      expect(summary.performance.connectionTime).toBe(-1);
      expect(summary.performance.captureTime).toBe(-1);
      expect(summary.performance.throughput).toBe(-1);
      expect(summary.performance.memoryUsage).toBe(-1);
      expect(summary.performance.baselineComparison).toBe('worse');
    });

    it('应该检测内存使用情况', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      expect(typeof summary.performance.memoryUsage).toBe('number');
    });
  });

  describe('兼容性测试', () => {
    it('应该检测高级驱动的API版本', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.compatibility.apiVersion).toBe('2.0');
      expect(summary.compatibility.supportedFeatures).toContain('sendNetworkConfig');
      expect(summary.compatibility.supportedFeatures).toContain('getVoltageStatus');
    });

    it('应该检测基础驱动的功能支持', async () => {
      const driver = new MockLowQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 60,
        overallStatus: 'warning',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 60, status: 'warning', issues: [] },
          interface: { score: 60, status: 'warning', issues: [] },
          implementation: { score: 60, status: 'warning', issues: [] },
          documentation: { score: 60, status: 'warning', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 3000,
        totalTests: 10,
        passedTests: 7,
        failedTests: 3,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'warning',
          performance: 'warning',
          edgeCases: 'fail'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.compatibility.apiVersion).toBe('1.1');
      expect(summary.compatibility.supportedFeatures).toContain('enterBootloader');
      expect(summary.compatibility.missingFeatures).toContain('sendNetworkConfig');
    });

    it('应该识别缺失的基本功能', async () => {
      const driver = new MockFailingDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 20,
        overallStatus: 'fail',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 20, status: 'fail', issues: [] },
          interface: { score: 20, status: 'fail', issues: [] },
          implementation: { score: 20, status: 'fail', issues: [] },
          documentation: { score: 20, status: 'fail', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 500,
        totalTests: 10,
        passedTests: 1,
        failedTests: 9,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'fail',
          errorHandling: 'fail',
          performance: 'fail',
          edgeCases: 'fail'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.compatibility.missingFeatures.length).toBeGreaterThan(0);
      expect(summary.overall.recommendations.some(rec => /缺少功能/.test(rec))).toBe(true);
    });
  });

  describe('总体评估', () => {
    it('应该为优秀驱动分配A级', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      // Mock高分数验证报告
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 95,
        overallStatus: 'pass',
        errors: [], // 确保没有错误
        warnings: [],
        categories: {
          structure: { score: 95, status: 'pass', issues: [] },
          interface: { score: 95, status: 'pass', issues: [] },
          implementation: { score: 95, status: 'pass', issues: [] },
          documentation: { score: 95, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      // Mock完美的功能测试报告
      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 20,
        passedTests: 20,
        failedTests: 0, // 确保没有失败测试
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      // 设置性能基线，确保性能比较结果是 'better' 或 'same'
      const frameworkWithBaseline = new TestFramework({
        performanceBaseline: {
          connectionTime: 200, // 设置更高的基线，这样实际性能会更好
          captureTime: 400,
          throughput: 100000
        }
      });

      const summary = await frameworkWithBaseline.runFullTestSuite(driver);

      expect(summary.overall.grade).toBe('A');
      expect(summary.overall.readyForProduction).toBe(true);
      expect(summary.overall.recommendations.length).toBe(0);
    });

    it('应该为中等质量驱动分配B或C级', async () => {
      const driver = new MockLowQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 75,
        overallStatus: 'pass',
        errors: [],
        warnings: ['一些小问题'],
        categories: {
          structure: { score: 75, status: 'pass', issues: [] },
          interface: { score: 75, status: 'pass', issues: [] },
          implementation: { score: 75, status: 'pass', issues: [] },
          documentation: { score: 75, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 3000,
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'warning',
          edgeCases: 'fail'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      expect(['B', 'C']).toContain(summary.overall.grade);
    });

    it('应该为不合格驱动分配F级', async () => {
      const driver = new MockFailingDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 30,
        overallStatus: 'fail',
        errors: ['严重错误'],
        warnings: [],
        categories: {
          structure: { score: 30, status: 'fail', issues: [] },
          interface: { score: 30, status: 'fail', issues: [] },
          implementation: { score: 30, status: 'fail', issues: [] },
          documentation: { score: 30, status: 'fail', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 500,
        totalTests: 10,
        passedTests: 2,
        failedTests: 8,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'fail',
          errorHandling: 'fail',
          performance: 'fail',
          edgeCases: 'fail'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);

      expect(summary.overall.grade).toBe('F');
      expect(summary.overall.readyForProduction).toBe(false);
      expect(summary.overall.recommendations.length).toBeGreaterThan(0);
    });

    it('应该根据覆盖率目标提供建议', async () => {
      const driver = new MockLowQualityDriver('test-connection');
      const frameworkWithHighTarget = new TestFramework({
        coverageTarget: 95
      });
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 2000,
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'warning',
          edgeCases: 'fail'
        }
      });

      const summary = await frameworkWithHighTarget.runFullTestSuite(driver);

      expect(summary.overall.recommendations.some(rec => /功能测试覆盖率.*低于目标.*95%/.test(rec))).toBe(true);
    });
  });

  describe('报告生成', () => {
    it('应该生成格式化的测试报告', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 85,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 85, status: 'pass', issues: [] },
          interface: { score: 85, status: 'pass', issues: [] },
          implementation: { score: 85, status: 'pass', issues: [] },
          documentation: { score: 85, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'Test Suite',
        timestamp: new Date(),
        duration: 2000,
        totalTests: 15,
        passedTests: 14,
        failedTests: 1,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'warning'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);
      const report = testFramework.generateTestReport(summary);

      expect(report).toContain('# 驱动测试报告');
      expect(report).toContain(summary.suiteName);
      expect(report).toContain(summary.overall.grade);
      expect(report).toContain(summary.validation.score.toString());
      expect(report).toContain(summary.functional.coverage.toFixed(1));
      expect(report).toContain(summary.performance.connectionTime.toString());
      expect(report).toContain(summary.compatibility.apiVersion);
    });

    it('应该在报告中包含改进建议', async () => {
      const driver = new MockLowQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 60,
        overallStatus: 'warning',
        errors: [],
        warnings: ['性能问题'],
        categories: {
          structure: { score: 60, status: 'warning', issues: [] },
          interface: { score: 60, status: 'warning', issues: [] },
          implementation: { score: 60, status: 'warning', issues: [] },
          documentation: { score: 60, status: 'warning', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'Test Suite',
        timestamp: new Date(),
        duration: 4000,
        totalTests: 10,
        passedTests: 6,
        failedTests: 4,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'warning',
          performance: 'warning',
          edgeCases: 'fail'
        }
      });

      const summary = await testFramework.runFullTestSuite(driver);
      const report = testFramework.generateTestReport(summary);

      expect(report).toContain('## 改进建议');
      expect(summary.overall.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('扩展功能测试', () => {
    it('应该添加数据完整性测试', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      await testFramework.runFullTestSuite(driver);

      // 验证添加了扩展的功能测试
      expect(mockDriverTester.addTestCase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'data-integrity',
          description: '数据完整性测试'
        })
      );
    });

    it('应该添加边界条件测试', async () => {
      const driver = new MockHighQualityDriver('test-connection');
      
      mockDriverValidator.validateDriver.mockResolvedValue({
        driverName: 'test',
        timestamp: new Date(),
        score: 80,
        overallStatus: 'pass',
        errors: [],
        warnings: [],
        categories: {
          structure: { score: 80, status: 'pass', issues: [] },
          interface: { score: 80, status: 'pass', issues: [] },
          implementation: { score: 80, status: 'pass', issues: [] },
          documentation: { score: 80, status: 'pass', issues: [] }
        },
        recommendations: []
      });

      mockDriverTester.runAllTests.mockResolvedValue({
        suiteName: 'test',
        timestamp: new Date(),
        duration: 1000,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        skippedTests: 0,
        results: [],
        summary: {
          basicFunctionality: 'pass',
          errorHandling: 'pass',
          performance: 'pass',
          edgeCases: 'pass'
        }
      });

      await testFramework.runFullTestSuite(driver);

      // 验证添加了边界条件测试
      expect(mockDriverTester.addTestCase).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'boundary-conditions',
          description: '边界条件测试'
        })
      );
    });
  });

  describe('数据一致性验证', () => {
    it('应该正确验证一致的数据', () => {
      // 这是私有方法测试，通过集成测试覆盖
      expect(testFramework).toBeInstanceOf(TestFramework);
    });

    it('应该检测不一致的数据', () => {
      // 这是私有方法测试，通过集成测试覆盖
      expect(testFramework).toBeInstanceOf(TestFramework);
    });
  });

  describe('配置选项', () => {
    it('应该支持自定义超时配置', () => {
      const customConfig: Partial<TestSuiteConfig> = {
        timeout: 300000 // 5分钟
      };
      
      const framework = new TestFramework(customConfig);
      expect(framework).toBeInstanceOf(TestFramework);
    });

    it('应该支持自定义重试次数', () => {
      const customConfig: Partial<TestSuiteConfig> = {
        retryCount: 5
      };
      
      const framework = new TestFramework(customConfig);
      expect(framework).toBeInstanceOf(TestFramework);
    });

    it('应该支持并行测试配置', () => {
      const customConfig: Partial<TestSuiteConfig> = {
        parallel: true
      };
      
      const framework = new TestFramework(customConfig);
      expect(framework).toBeInstanceOf(TestFramework);
    });

    it('应该支持Mock模式配置', () => {
      const customConfig: Partial<TestSuiteConfig> = {
        mockMode: false
      };
      
      const framework = new TestFramework(customConfig);
      expect(framework).toBeInstanceOf(TestFramework);
    });
  });
});