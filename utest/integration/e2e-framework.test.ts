/**
 * 端到端集成测试框架
 * 测试完整的工作流程：设备连接 -> 数据采集 -> 协议解码 -> 结果导出
 * 对应单元测试扩展计划 - 阶段三：集成测试
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

// Mock VSCode环境
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    createStatusBarItem: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: ''
    })),
    createOutputChannel: jest.fn(() => ({
      append: jest.fn(),
      appendLine: jest.fn(),
      clear: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn()
    })),
    workspaceFolders: []
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path, toString: () => path }))
  }
}));

/**
 * 集成测试框架
 * 提供完整的测试环境和工具链
 */
class E2ETestFramework {
  private testResults: Map<string, any> = new Map();
  private mockDevices: Map<string, MockDevice> = new Map();
  private testSessions: Map<string, TestSession> = new Map();

  constructor() {
    this.setupMockEnvironment();
  }

  private setupMockEnvironment(): void {
    // 设置模拟设备
    this.mockDevices.set('pico-analyzer-1', new MockPicoAnalyzer());
    this.mockDevices.set('saleae-logic-1', new MockSaleaeLogic());
    this.mockDevices.set('network-analyzer-1', new MockNetworkAnalyzer());
  }

  /**
   * 创建测试会话
   */
  createTestSession(sessionId: string, config: TestSessionConfig): TestSession {
    const session = new TestSession(sessionId, config, this);
    this.testSessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取模拟设备
   */
  getMockDevice(deviceId: string): MockDevice | undefined {
    return this.mockDevices.get(deviceId);
  }

  /**
   * 记录测试结果
   */
  recordResult(testId: string, result: any): void {
    this.testResults.set(testId, result);
  }

  /**
   * 获取测试结果
   */
  getResult(testId: string): any {
    return this.testResults.get(testId);
  }

  /**
   * 清理测试环境
   */
  cleanup(): void {
    this.testResults.clear();
    this.testSessions.clear();
    this.mockDevices.forEach(device => device.dispose());
  }
}

/**
 * 测试会话配置
 */
interface TestSessionConfig {
  deviceType: 'pico' | 'saleae' | 'network';
  sampleRate: number;
  channels: number[];
  duration: number; // 测试持续时间(ms)
  expectedProtocols: string[];
}

/**
 * 测试会话
 * 管理单个集成测试的完整生命周期
 */
class TestSession extends EventEmitter {
  private framework: E2ETestFramework;
  private config: TestSessionConfig;
  private sessionId: string;
  private startTime: number = 0;
  private endTime: number = 0;
  private capturedData: Uint8Array[] = [];
  private decodedResults: any[] = [];

  constructor(sessionId: string, config: TestSessionConfig, framework: E2ETestFramework) {
    super();
    this.sessionId = sessionId;
    this.config = config;
    this.framework = framework;
  }

  /**
   * 执行完整的工作流测试
   */
  async runFullWorkflow(): Promise<WorkflowResult> {
    try {
      this.startTime = Date.now();
      this.emit('workflowStarted', { sessionId: this.sessionId });

      // 阶段1: 设备检测和连接
      const connectionResult = await this.testDeviceConnection();
      if (!connectionResult.success) {
        throw new Error(`设备连接失败: ${connectionResult.error}`);
      }

      // 阶段2: 数据采集
      const captureResult = await this.testDataCapture();
      if (!captureResult.success) {
        throw new Error(`数据采集失败: ${captureResult.error}`);
      }

      // 阶段3: 协议解码
      const decodeResult = await this.testProtocolDecoding();
      if (!decodeResult.success) {
        throw new Error(`协议解码失败: ${decodeResult.error}`);
      }

      // 阶段4: 结果验证和导出
      const exportResult = await this.testResultExport();
      if (!exportResult.success) {
        throw new Error(`结果导出失败: ${exportResult.error}`);
      }

      this.endTime = Date.now();
      const result: WorkflowResult = {
        success: true,
        sessionId: this.sessionId,
        duration: this.endTime - this.startTime,
        phases: {
          connection: connectionResult,
          capture: captureResult,
          decode: decodeResult,
          export: exportResult
        },
        metrics: this.calculateMetrics()
      };

      this.emit('workflowCompleted', result);
      return result;

    } catch (error) {
      this.endTime = Date.now();
      const result: WorkflowResult = {
        success: false,
        sessionId: this.sessionId,
        duration: this.endTime - this.startTime,
        error: error instanceof Error ? error.message : String(error),
        phases: {},
        metrics: this.calculateMetrics()
      };

      this.emit('workflowFailed', result);
      return result;
    }
  }

  /**
   * 测试设备连接
   */
  private async testDeviceConnection(): Promise<PhaseResult> {
    const startTime = Date.now();
    
    try {
      const device = this.framework.getMockDevice(`${this.config.deviceType}-analyzer-1`);
      if (!device) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: '设备不存在'
        };
      }

      const connected = await device.connect();
      if (!connected) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: '设备连接失败'
        };
      }

      const deviceInfo = await device.getDeviceInfo();
      
      return {
        success: true,
        duration: Date.now() - startTime,
        data: { deviceInfo }
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试数据采集
   */
  private async testDataCapture(): Promise<PhaseResult> {
    const startTime = Date.now();
    
    try {
      const device = this.framework.getMockDevice(`${this.config.deviceType}-analyzer-1`);
      if (!device) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: '设备不存在'
        };
      }

      // 配置采集参数
      const captureConfig = {
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        triggerChannel: this.config.channels[0],
        triggerType: 'rising',
        preSamples: 1000,
        postSamples: 9000
      };

      // 开始采集
      const captureResult = await device.startCapture(captureConfig);
      if (!captureResult.success) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: captureResult.error || '采集启动失败'
        };
      }

      // 等待采集完成
      await this.waitForCapture(device, this.config.duration);
      
      // 获取采集数据
      this.capturedData = await device.getCapturedData();
      
      return {
        success: true,
        duration: Date.now() - startTime,
        data: {
          samplesCount: this.capturedData.reduce((sum, ch) => sum + ch.length, 0),
          channelsCount: this.capturedData.length
        }
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试协议解码
   */
  private async testProtocolDecoding(): Promise<PhaseResult> {
    const startTime = Date.now();
    
    try {
      if (this.capturedData.length === 0) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: '没有采集数据可用于解码'
        };
      }

      // 对每个期望的协议进行解码测试
      const decodeResults: any[] = [];
      
      for (const protocol of this.config.expectedProtocols) {
        const decoder = this.createMockDecoder(protocol);
        const result = decoder.decode(this.config.sampleRate, this.capturedData);
        decodeResults.push({
          protocol,
          success: result.length > 0,
          resultsCount: result.length,
          results: result.slice(0, 10) // 只保留前10个结果用于验证
        });
      }

      this.decodedResults = decodeResults;
      
      return {
        success: decodeResults.some(r => r.success),
        duration: Date.now() - startTime,
        data: { decodeResults }
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 测试结果导出
   */
  private async testResultExport(): Promise<PhaseResult> {
    const startTime = Date.now();
    
    try {
      if (this.decodedResults.length === 0) {
        return {
          success: false,
          duration: Date.now() - startTime,
          error: '没有解码结果可用于导出'
        };
      }

      // 模拟不同格式的导出
      const exportFormats = ['csv', 'json', 'vcd'];
      const exportResults = [];

      for (const format of exportFormats) {
        const exporter = this.createMockExporter(format);
        const result = await exporter.export(this.decodedResults);
        exportResults.push({
          format,
          success: result.success,
          size: result.data?.length || 0
        });
      }

      return {
        success: exportResults.every(r => r.success),
        duration: Date.now() - startTime,
        data: { exportResults }
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 等待采集完成
   */
  private async waitForCapture(device: MockDevice, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('采集超时'));
      }, timeout);

      device.on('captureCompleted', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * 创建模拟解码器
   */
  private createMockDecoder(protocol: string): any {
    return {
      decode: (sampleRate: number, data: Uint8Array[]) => {
        // 模拟解码结果
        const results = [];
        for (let i = 0; i < Math.min(data[0]?.length || 0, 100); i += 10) {
          results.push({
            startSample: i,
            endSample: i + 8,
            type: protocol,
            data: `Mock ${protocol} data at sample ${i}`
          });
        }
        return results;
      }
    };
  }

  /**
   * 创建模拟导出器
   */
  private createMockExporter(format: string): any {
    return {
      export: async (data: any[]) => {
        // 模拟导出过程
        return {
          success: true,
          data: `Mock ${format} export data`
        };
      }
    };
  }

  /**
   * 计算性能指标
   */
  private calculateMetrics(): WorkflowMetrics {
    return {
      totalDuration: this.endTime - this.startTime,
      samplesProcessed: this.capturedData.reduce((sum, ch) => sum + ch.length, 0),
      protocolsDecoded: this.decodedResults.length,
      successRate: this.decodedResults.filter(r => r.success).length / Math.max(this.decodedResults.length, 1)
    };
  }
}

/**
 * 模拟设备基类
 */
abstract class MockDevice extends EventEmitter {
  protected connected = false;
  protected capturing = false;
  protected capturedData: Uint8Array[] = [];

  async connect(): Promise<boolean> {
    await this.delay(100); // 模拟连接延迟
    this.connected = true;
    this.emit('connected');
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.capturing = false;
    this.emit('disconnected');
  }

  abstract getDeviceInfo(): Promise<any>;
  abstract startCapture(config: any): Promise<any>;
  
  async getCapturedData(): Promise<Uint8Array[]> {
    return this.capturedData;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  dispose(): void {
    this.removeAllListeners();
  }
}

/**
 * 模拟Pico分析器
 */
class MockPicoAnalyzer extends MockDevice {
  async getDeviceInfo(): Promise<any> {
    return {
      name: 'Mock Pico Logic Analyzer',
      version: '1.0.0',
      channels: 24,
      maxSampleRate: 100000000
    };
  }

  async startCapture(config: any): Promise<any> {
    this.capturing = true;
    
    // 生成模拟数据
    this.capturedData = config.channels.map((ch: number) => {
      const data = new Uint8Array(10000);
      for (let i = 0; i < data.length; i++) {
        // 生成一些模式化的测试数据
        data[i] = (i + ch) % 2;
      }
      return data;
    });

    // 模拟采集完成
    setTimeout(() => {
      this.capturing = false;
      this.emit('captureCompleted');
    }, 100);

    return { success: true };
  }
}

/**
 * 模拟Saleae Logic
 */
class MockSaleaeLogic extends MockDevice {
  async getDeviceInfo(): Promise<any> {
    return {
      name: 'Mock Saleae Logic 16',
      version: '2.0.0',
      channels: 16,
      maxSampleRate: 100000000
    };
  }

  async startCapture(config: any): Promise<any> {
    this.capturing = true;
    
    this.capturedData = config.channels.map((ch: number) => {
      const data = new Uint8Array(8000);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() > 0.5 ? 1 : 0;
      }
      return data;
    });

    setTimeout(() => {
      this.capturing = false;
      this.emit('captureCompleted');
    }, 150);

    return { success: true };
  }
}

/**
 * 模拟网络分析器
 */
class MockNetworkAnalyzer extends MockDevice {
  async getDeviceInfo(): Promise<any> {
    return {
      name: 'Mock Network Logic Analyzer',
      version: '1.5.0',
      channels: 8,
      maxSampleRate: 50000000
    };
  }

  async startCapture(config: any): Promise<any> {
    this.capturing = true;
    
    this.capturedData = config.channels.map(() => {
      const data = new Uint8Array(5000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 4 < 2 ? 1 : 0; // 生成方波
      }
      return data;
    });

    setTimeout(() => {
      this.capturing = false;
      this.emit('captureCompleted');
    }, 200);

    return { success: true };
  }
}

// 接口定义
interface WorkflowResult {
  success: boolean;
  sessionId: string;
  duration: number;
  error?: string;
  phases: {
    connection?: PhaseResult;
    capture?: PhaseResult;
    decode?: PhaseResult;
    export?: PhaseResult;
  };
  metrics: WorkflowMetrics;
}

interface PhaseResult {
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

interface WorkflowMetrics {
  totalDuration: number;
  samplesProcessed: number;
  protocolsDecoded: number;
  successRate: number;
}

// 测试套件
describe('端到端集成测试框架', () => {
  let framework: E2ETestFramework;

  beforeEach(() => {
    framework = new E2ETestFramework();
  });

  afterEach(() => {
    framework.cleanup();
  });

  describe('基础框架功能', () => {
    it('应成功创建测试会话', () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 1000000,
        channels: [0, 1, 2, 3],
        duration: 1000,
        expectedProtocols: ['i2c', 'spi']
      };

      // Act
      const session = framework.createTestSession('test-session-1', config);

      // Assert
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('test-session-1');
    });

    it('应提供模拟设备', () => {
      // Act
      const picoDevice = framework.getMockDevice('pico-analyzer-1');
      const saleaeDevice = framework.getMockDevice('saleae-logic-1');
      const networkDevice = framework.getMockDevice('network-analyzer-1');

      // Assert
      expect(picoDevice).toBeDefined();
      expect(saleaeDevice).toBeDefined();
      expect(networkDevice).toBeDefined();
    });
  });

  describe('Pico分析器完整工作流', () => {
    it('应成功执行完整的I2C解码工作流', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 100000,
        channels: [0, 1], // SCL, SDA
        duration: 500,
        expectedProtocols: ['i2c']
      };

      const session = framework.createTestSession('pico-i2c-test', config);

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(true);
      expect(result.phases.connection?.success).toBe(true);
      expect(result.phases.capture?.success).toBe(true);
      expect(result.phases.decode?.success).toBe(true);
      expect(result.phases.export?.success).toBe(true);
      expect(result.metrics.totalDuration).toBeGreaterThan(0);
      expect(result.metrics.samplesProcessed).toBeGreaterThan(0);
    }, 10000);

    it('应成功执行SPI解码工作流', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 1000000,
        channels: [0, 1, 2, 3], // CLK, MOSI, MISO, CS
        duration: 300,
        expectedProtocols: ['spi']
      };

      const session = framework.createTestSession('pico-spi-test', config);

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(true);
      expect(result.phases.connection?.success).toBe(true);
      expect(result.phases.capture?.success).toBe(true);
      expect(result.phases.decode?.success).toBe(true);
      expect(result.phases.export?.success).toBe(true);
    }, 10000);
  });

  describe('Saleae Logic工作流', () => {
    it('应成功执行UART解码工作流', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'saleae',
        sampleRate: 9600,
        channels: [0, 1], // TX, RX
        duration: 400,
        expectedProtocols: ['uart']
      };

      const session = framework.createTestSession('saleae-uart-test', config);

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(true);
      expect(result.metrics.protocolsDecoded).toBe(1);
    }, 10000);
  });

  describe('网络分析器工作流', () => {
    it('应成功执行网络协议解码', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'network',
        sampleRate: 50000,
        channels: [0, 1, 2, 3],
        duration: 600,
        expectedProtocols: ['ethernet']
      };

      const session = framework.createTestSession('network-test', config);

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(true);
      expect(result.phases.connection?.success).toBe(true);
    }, 10000);
  });

  describe('并发工作流测试', () => {
    it('应支持多个并发测试会话', async () => {
      // Arrange
      const configs = [
        { deviceType: 'pico' as const, sampleRate: 100000, channels: [0, 1], duration: 300, expectedProtocols: ['i2c'] },
        { deviceType: 'saleae' as const, sampleRate: 200000, channels: [0, 1, 2], duration: 300, expectedProtocols: ['spi'] },
        { deviceType: 'network' as const, sampleRate: 50000, channels: [0, 1], duration: 300, expectedProtocols: ['uart'] }
      ];

      const sessions = configs.map((config, i) => 
        framework.createTestSession(`concurrent-test-${i}`, config)
      );

      // Act
      const results = await Promise.all(
        sessions.map(session => session.runFullWorkflow())
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    }, 15000);
  });

  describe('错误处理和恢复', () => {
    it('应正确处理设备连接失败', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 100000,
        channels: [0, 1],
        duration: 300,
        expectedProtocols: ['i2c']
      };

      const session = framework.createTestSession('connection-fail-test', config);
      
      // 模拟设备连接失败
      const device = framework.getMockDevice('pico-analyzer-1');
      if (device) {
        device.connect = jest.fn().mockResolvedValue(false);
      }

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(false);
      expect(result.phases.connection?.success).toBe(false);
      expect(result.error).toContain('设备连接失败');
    }, 10000);

    it('应正确处理采集超时', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 100000,
        channels: [0, 1],
        duration: 50, // 极短的超时时间
        expectedProtocols: ['i2c']
      };

      const session = framework.createTestSession('capture-timeout-test', config);

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('采集超时');
    }, 10000);
  });

  describe('性能基准测试', () => {
    it('完整工作流应在合理时间内完成', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 1000000,
        channels: [0, 1, 2, 3],
        duration: 500,
        expectedProtocols: ['i2c', 'spi']
      };

      const session = framework.createTestSession('performance-test', config);

      // Act
      const startTime = Date.now();
      const result = await session.runFullWorkflow();
      const totalTime = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(totalTime).toBeLessThan(5000); // 应在5秒内完成
      expect(result.metrics.totalDuration).toBeLessThan(2000); // 内部测量应在2秒内
    }, 10000);

    it('应高效处理大量数据', async () => {
      // Arrange
      const config: TestSessionConfig = {
        deviceType: 'pico',
        sampleRate: 10000000, // 10MHz
        channels: [0, 1, 2, 3, 4, 5, 6, 7], // 8个通道
        duration: 800,
        expectedProtocols: ['i2c', 'spi', 'uart']
      };

      const session = framework.createTestSession('high-throughput-test', config);

      // Act
      const result = await session.runFullWorkflow();

      // Assert
      expect(result.success).toBe(true);
      expect(result.metrics.samplesProcessed).toBeGreaterThan(50000);
      expect(result.metrics.successRate).toBeGreaterThan(0.5);
    }, 15000);
  });
});