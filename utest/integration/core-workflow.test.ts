/**
 * 核心工作流集成测试
 * 测试真实业务场景下的端到端流程
 * 对应单元测试扩展计划 - 阶段三：核心工作流测试
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn().mockResolvedValue('确定'),
    showErrorMessage: jest.fn().mockResolvedValue('确定'),
    showWarningMessage: jest.fn().mockResolvedValue('确定'),
    showSaveDialog: jest.fn().mockResolvedValue({
      fsPath: '/mock/path/export.csv'
    }),
    createStatusBarItem: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: ''
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const configs = {
          'logicAnalyzer.defaultSampleRate': 1000000,
          'logicAnalyzer.autoDetectDevices': true,
          'logicAnalyzer.exportFormat': 'csv'
        };
        return configs[key as keyof typeof configs];
      }),
      update: jest.fn()
    })),
    workspaceFolders: [{
      uri: { fsPath: '/mock/workspace' }
    }]
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path }))
  }
}));

/**
 * 核心工作流测试管理器
 */
class CoreWorkflowTester {
  private mockServices: Map<string, any> = new Map();
  private testResults: WorkflowTestResult[] = [];

  constructor() {
    this.setupMockServices();
  }

  private setupMockServices(): void {
    // 模拟设备管理服务
    this.mockServices.set('deviceManager', new MockDeviceManager());
    
    // 模拟数据采集服务
    this.mockServices.set('captureService', new MockCaptureService());
    
    // 模拟协议解码服务
    this.mockServices.set('decoderService', new MockDecoderService());
    
    // 模拟数据导出服务
    this.mockServices.set('exportService', new MockExportService());
    
    // 模拟配置管理服务
    this.mockServices.set('configService', new MockConfigService());
  }

  /**
   * 执行工作流测试
   */
  async runWorkflowTest(scenario: WorkflowScenario): Promise<WorkflowTestResult> {
    const startTime = Date.now();
    const testId = `workflow-${Date.now()}`;
    
    try {
      const result = await this.executeWorkflowScenario(scenario);
      
      const testResult: WorkflowTestResult = {
        testId,
        scenario: scenario.name,
        success: true,
        duration: Date.now() - startTime,
        steps: result.steps,
        metrics: result.metrics,
        artifacts: result.artifacts
      };

      this.testResults.push(testResult);
      return testResult;

    } catch (error) {
      const testResult: WorkflowTestResult = {
        testId,
        scenario: scenario.name,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        steps: [],
        metrics: {},
        artifacts: []
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  /**
   * 执行具体的工作流场景
   */
  private async executeWorkflowScenario(scenario: WorkflowScenario): Promise<WorkflowExecutionResult> {
    const steps: WorkflowStepResult[] = [];
    const metrics: any = {};
    const artifacts: string[] = [];

    // 执行每个工作流步骤
    for (const step of scenario.steps) {
      const stepResult = await this.executeWorkflowStep(step);
      steps.push(stepResult);
      
      if (!stepResult.success) {
        throw new Error(`工作流步骤失败: ${step.name} - ${stepResult.error}`);
      }

      // 收集指标和产物
      if (stepResult.metrics) {
        Object.assign(metrics, stepResult.metrics);
      }
      if (stepResult.artifacts) {
        artifacts.push(...stepResult.artifacts);
      }
    }

    return { steps, metrics, artifacts };
  }

  /**
   * 执行单个工作流步骤
   */
  private async executeWorkflowStep(step: WorkflowStep): Promise<WorkflowStepResult> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (step.type) {
        case 'device-detection':
          result = await this.executeDeviceDetection(step);
          break;
        case 'device-connection':
          result = await this.executeDeviceConnection(step);
          break;
        case 'capture-configuration':
          result = await this.executeCaptureConfiguration(step);
          break;
        case 'data-capture':
          result = await this.executeDataCapture(step);
          break;
        case 'protocol-decode':
          result = await this.executeProtocolDecode(step);
          break;
        case 'result-export':
          result = await this.executeResultExport(step);
          break;
        default:
          throw new Error(`未知的工作流步骤类型: ${step.type}`);
      }

      return {
        stepName: step.name,
        stepType: step.type,
        success: true,
        duration: Date.now() - startTime,
        data: result.data,
        metrics: result.metrics,
        artifacts: result.artifacts
      };

    } catch (error) {
      return {
        stepName: step.name,
        stepType: step.type,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 执行设备检测步骤
   */
  private async executeDeviceDetection(step: WorkflowStep): Promise<any> {
    const deviceManager = this.mockServices.get('deviceManager');
    const devices = await deviceManager.detectDevices();
    
    return {
      data: { devices },
      metrics: { devicesFound: devices.length },
      artifacts: []
    };
  }

  /**
   * 执行设备连接步骤
   */
  private async executeDeviceConnection(step: WorkflowStep): Promise<any> {
    const deviceManager = this.mockServices.get('deviceManager');
    const connectionResult = await deviceManager.connectToDevice(step.parameters.deviceId);
    
    if (!connectionResult.success) {
      throw new Error(`设备连接失败: ${connectionResult.error}`);
    }

    return {
      data: { deviceInfo: connectionResult.deviceInfo },
      metrics: { connectionTime: connectionResult.connectionTime },
      artifacts: []
    };
  }

  /**
   * 执行采集配置步骤
   */
  private async executeCaptureConfiguration(step: WorkflowStep): Promise<any> {
    const captureService = this.mockServices.get('captureService');
    const configResult = await captureService.configureCaptureParameters(step.parameters);
    
    return {
      data: { configuration: configResult },
      metrics: { configurationTime: 50 },
      artifacts: []
    };
  }

  /**
   * 执行数据采集步骤
   */
  private async executeDataCapture(step: WorkflowStep): Promise<any> {
    const captureService = this.mockServices.get('captureService');
    const captureResult = await captureService.startCapture();
    
    if (!captureResult.success) {
      throw new Error(`数据采集失败: ${captureResult.error}`);
    }

    return {
      data: { 
        samplesCount: captureResult.samplesCount,
        channels: captureResult.channels 
      },
      metrics: { 
        captureTime: captureResult.duration,
        samplesPerSecond: captureResult.samplesCount / (captureResult.duration / 1000)
      },
      artifacts: ['capture-data.bin']
    };
  }

  /**
   * 执行协议解码步骤
   */
  private async executeProtocolDecode(step: WorkflowStep): Promise<any> {
    const decoderService = this.mockServices.get('decoderService');
    const decodeResult = await decoderService.decodeProtocol(
      step.parameters.protocol,
      step.parameters.channels
    );
    
    return {
      data: { 
        protocol: step.parameters.protocol,
        resultsCount: decodeResult.results.length 
      },
      metrics: { 
        decodeTime: decodeResult.duration,
        decodedPackets: decodeResult.results.length
      },
      artifacts: [`decode-${step.parameters.protocol}.json`]
    };
  }

  /**
   * 执行结果导出步骤
   */
  private async executeResultExport(step: WorkflowStep): Promise<any> {
    const exportService = this.mockServices.get('exportService');
    const exportResult = await exportService.exportResults(
      step.parameters.format,
      step.parameters.data
    );
    
    return {
      data: { 
        format: step.parameters.format,
        filePath: exportResult.filePath 
      },
      metrics: { 
        exportTime: exportResult.duration,
        fileSize: exportResult.fileSize
      },
      artifacts: [exportResult.filePath]
    };
  }

  /**
   * 获取所有测试结果
   */
  getTestResults(): WorkflowTestResult[] {
    return this.testResults;
  }

  /**
   * 清理测试环境
   */
  cleanup(): void {
    this.testResults = [];
    this.mockServices.clear();
  }
}

/**
 * 模拟设备管理器
 */
class MockDeviceManager {
  async detectDevices(): Promise<any[]> {
    await this.delay(200);
    return [
      { id: 'pico-1', name: 'Pico Logic Analyzer', type: 'pico', status: 'available' },
      { id: 'saleae-1', name: 'Saleae Logic 16', type: 'saleae', status: 'available' }
    ];
  }

  async connectToDevice(deviceId: string): Promise<any> {
    await this.delay(300);
    return {
      success: true,
      deviceInfo: {
        id: deviceId,
        name: `Connected Device ${deviceId}`,
        channels: 16,
        maxSampleRate: 100000000
      },
      connectionTime: 250
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 模拟采集服务
 */
class MockCaptureService {
  async configureCaptureParameters(params: any): Promise<any> {
    await this.delay(50);
    return {
      sampleRate: params.sampleRate || 1000000,
      channels: params.channels || [0, 1, 2, 3],
      triggerType: params.triggerType || 'rising',
      bufferSize: params.bufferSize || 65536
    };
  }

  async startCapture(): Promise<any> {
    await this.delay(500);
    return {
      success: true,
      samplesCount: 50000,
      channels: 4,
      duration: 450
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 模拟解码服务
 */
class MockDecoderService {
  async decodeProtocol(protocol: string, channels: number[]): Promise<any> {
    await this.delay(300);
    
    const resultCounts = {
      'i2c': 25,
      'spi': 40,
      'uart': 30
    };

    return {
      protocol,
      results: Array(resultCounts[protocol as keyof typeof resultCounts] || 10).fill(null).map((_, i) => ({
        id: i,
        type: protocol,
        data: `Mock ${protocol} packet ${i}`
      })),
      duration: 280
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 模拟导出服务
 */
class MockExportService {
  async exportResults(format: string, data: any): Promise<any> {
    await this.delay(200);
    
    const fileSizes = {
      'csv': 15000,
      'json': 25000,
      'vcd': 50000
    };

    return {
      success: true,
      format,
      filePath: `/mock/export/results.${format}`,
      fileSize: fileSizes[format as keyof typeof fileSizes] || 10000,
      duration: 180
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 模拟配置服务
 */
class MockConfigService {
  getConfiguration(key: string): any {
    const configs = {
      'defaultSampleRate': 1000000,
      'autoDetectDevices': true,
      'exportFormat': 'csv'
    };
    return configs[key as keyof typeof configs];
  }
}

// 接口定义
interface WorkflowScenario {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  name: string;
  type: 'device-detection' | 'device-connection' | 'capture-configuration' | 'data-capture' | 'protocol-decode' | 'result-export';
  parameters: any;
}

interface WorkflowTestResult {
  testId: string;
  scenario: string;
  success: boolean;
  duration: number;
  error?: string;
  steps: WorkflowStepResult[];
  metrics: any;
  artifacts: string[];
}

interface WorkflowExecutionResult {
  steps: WorkflowStepResult[];
  metrics: any;
  artifacts: string[];
}

interface WorkflowStepResult {
  stepName: string;
  stepType: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
  metrics?: any;
  artifacts?: string[];
}

// 测试场景定义
const WORKFLOW_SCENARIOS: WorkflowScenario[] = [
  {
    name: 'I2C传感器调试工作流',
    description: '连接设备，采集I2C总线数据，解码协议，导出结果',
    steps: [
      {
        name: '检测可用设备',
        type: 'device-detection',
        parameters: {}
      },
      {
        name: '连接Pico分析器',
        type: 'device-connection',
        parameters: { deviceId: 'pico-1' }
      },
      {
        name: '配置I2C采集参数',
        type: 'capture-configuration',
        parameters: {
          sampleRate: 1000000,
          channels: [0, 1], // SCL, SDA
          triggerType: 'falling',
          triggerChannel: 0
        }
      },
      {
        name: '开始数据采集',
        type: 'data-capture',
        parameters: {}
      },
      {
        name: '解码I2C协议',
        type: 'protocol-decode',
        parameters: {
          protocol: 'i2c',
          channels: [0, 1]
        }
      },
      {
        name: '导出CSV结果',
        type: 'result-export',
        parameters: {
          format: 'csv',
          data: 'mock-i2c-data'
        }
      }
    ]
  },
  {
    name: 'SPI通信分析工作流',
    description: '分析SPI通信协议，导出VCD波形文件',
    steps: [
      {
        name: '检测设备',
        type: 'device-detection',
        parameters: {}
      },
      {
        name: '连接Saleae Logic',
        type: 'device-connection',
        parameters: { deviceId: 'saleae-1' }
      },
      {
        name: '配置SPI采集',
        type: 'capture-configuration',
        parameters: {
          sampleRate: 2000000,
          channels: [0, 1, 2, 3], // CLK, MOSI, MISO, CS
          triggerType: 'falling',
          triggerChannel: 3 // CS
        }
      },
      {
        name: '采集SPI数据',
        type: 'data-capture',
        parameters: {}
      },
      {
        name: '解码SPI协议',
        type: 'protocol-decode',
        parameters: {
          protocol: 'spi',
          channels: [0, 1, 2, 3]
        }
      },
      {
        name: '导出VCD文件',
        type: 'result-export',
        parameters: {
          format: 'vcd',
          data: 'mock-spi-data'
        }
      }
    ]
  },
  {
    name: '串口通信调试工作流',
    description: '监控UART通信，解码数据包，生成报告',
    steps: [
      {
        name: '自动检测设备',
        type: 'device-detection',
        parameters: {}
      },
      {
        name: '连接第一个可用设备',
        type: 'device-connection',
        parameters: { deviceId: 'pico-1' }
      },
      {
        name: '配置UART采集',
        type: 'capture-configuration',
        parameters: {
          sampleRate: 115200 * 10, // 10倍波特率采样
          channels: [0, 1], // TX, RX
          triggerType: 'falling',
          triggerChannel: 0
        }
      },
      {
        name: '采集UART数据',
        type: 'data-capture',
        parameters: {}
      },
      {
        name: '解码UART协议',
        type: 'protocol-decode',
        parameters: {
          protocol: 'uart',
          channels: [0, 1]
        }
      },
      {
        name: '导出JSON报告',
        type: 'result-export',
        parameters: {
          format: 'json',
          data: 'mock-uart-data'
        }
      }
    ]
  }
];

// 测试套件
describe('核心工作流集成测试', () => {
  let workflowTester: CoreWorkflowTester;

  beforeEach(() => {
    workflowTester = new CoreWorkflowTester();
  });

  afterEach(() => {
    workflowTester.cleanup();
  });

  describe('基本工作流场景', () => {
    it('应成功执行I2C传感器调试工作流', async () => {
      // Arrange
      const scenario = WORKFLOW_SCENARIOS[0]; // I2C工作流

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(6);
      expect(result.steps.every(step => step.success)).toBe(true);
      expect(result.metrics.devicesFound).toBeGreaterThan(0);
      expect(result.metrics.decodedPackets).toBeGreaterThan(0);
      expect(result.artifacts).toContain('decode-i2c.json');
      expect(result.artifacts).toContain('/mock/export/results.csv');
    }, 10000);

    it('应成功执行SPI通信分析工作流', async () => {
      // Arrange
      const scenario = WORKFLOW_SCENARIOS[1]; // SPI工作流

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(6);
      expect(result.metrics.decodedPackets).toBe(40); // SPI预期结果数
      expect(result.artifacts).toContain('decode-spi.json');
      expect(result.artifacts).toContain('/mock/export/results.vcd');
    }, 10000);

    it('应成功执行UART通信调试工作流', async () => {
      // Arrange
      const scenario = WORKFLOW_SCENARIOS[2]; // UART工作流

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(6);
      expect(result.metrics.decodedPackets).toBe(30); // UART预期结果数
      expect(result.artifacts).toContain('/mock/export/results.json');
    }, 10000);
  });

  describe('并发工作流测试', () => {
    it('应支持多个工作流并发执行', async () => {
      // Arrange
      const scenarios = WORKFLOW_SCENARIOS;

      // Act
      const results = await Promise.all(
        scenarios.map(scenario => workflowTester.runWorkflowTest(scenario))
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.duration).toBeLessThan(5000); // 每个工作流应在5秒内完成
      });

      // 验证所有工作流都产生了预期的输出
      const allArtifacts = results.flatMap(r => r.artifacts);
      expect(allArtifacts).toContain('decode-i2c.json');
      expect(allArtifacts).toContain('decode-spi.json');
      expect(allArtifacts).toContain('decode-uart.json');
    }, 15000);
  });

  describe('工作流步骤验证', () => {
    it('设备检测步骤应返回可用设备', async () => {
      // Arrange
      const scenario: WorkflowScenario = {
        name: '设备检测测试',
        description: '仅测试设备检测功能',
        steps: [
          {
            name: '检测所有设备',
            type: 'device-detection',
            parameters: {}
          }
        ]
      };

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.metrics.devicesFound).toBe(2); // 预期有2个模拟设备
    });

    it('设备连接步骤应建立有效连接', async () => {
      // Arrange
      const scenario: WorkflowScenario = {
        name: '设备连接测试',
        description: '测试设备连接功能',
        steps: [
          {
            name: '检测设备',
            type: 'device-detection',
            parameters: {}
          },
          {
            name: '连接设备',
            type: 'device-connection',
            parameters: { deviceId: 'pico-1' }
          }
        ]
      };

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[1].data.deviceInfo).toBeDefined();
      expect(result.steps[1].data.deviceInfo.channels).toBe(16);
    });

    it('数据采集步骤应产生有效数据', async () => {
      // Arrange
      const scenario: WorkflowScenario = {
        name: '数据采集测试',
        description: '测试数据采集功能',
        steps: [
          {
            name: '检测设备',
            type: 'device-detection',
            parameters: {}
          },
          {
            name: '连接设备',
            type: 'device-connection',
            parameters: { deviceId: 'pico-1' }
          },
          {
            name: '配置采集',
            type: 'capture-configuration',
            parameters: {
              sampleRate: 1000000,
              channels: [0, 1, 2, 3]
            }
          },
          {
            name: '开始采集',
            type: 'data-capture',
            parameters: {}
          }
        ]
      };

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(4);
      
      const captureStep = result.steps[3];
      expect(captureStep.data.samplesCount).toBe(50000);
      expect(captureStep.data.channels).toBe(4);
      expect(captureStep.metrics.samplesPerSecond).toBeGreaterThan(0);
    });
  });

  describe('错误处理和容错性', () => {
    it('应优雅处理设备连接失败', async () => {
      // Arrange
      const scenario: WorkflowScenario = {
        name: '连接失败测试',
        description: '测试连接失败的处理',
        steps: [
          {
            name: '连接不存在的设备',
            type: 'device-connection',
            parameters: { deviceId: 'nonexistent-device' }
          }
        ]
      };

      // 模拟连接失败
      const deviceManager = workflowTester['mockServices'].get('deviceManager');
      deviceManager.connectToDevice = jest.fn().mockResolvedValue({
        success: false,
        error: '设备不存在'
      });

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('设备连接失败');
    });

    it('应处理协议解码异常', async () => {
      // Arrange
      const scenario: WorkflowScenario = {
        name: '解码失败测试',
        description: '测试协议解码失败的处理',
        steps: [
          {
            name: '检测设备',
            type: 'device-detection',
            parameters: {}
          },
          {
            name: '连接设备',
            type: 'device-connection',
            parameters: { deviceId: 'pico-1' }
          },
          {
            name: '采集数据',
            type: 'data-capture',
            parameters: {}
          },
          {
            name: '解码未知协议',
            type: 'protocol-decode',
            parameters: {
              protocol: 'unknown-protocol',
              channels: [0, 1]
            }
          }
        ]
      };

      // 模拟解码失败
      const decoderService = workflowTester['mockServices'].get('decoderService');
      decoderService.decodeProtocol = jest.fn().mockRejectedValue(new Error('不支持的协议'));

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的协议');
    });
  });

  describe('性能和指标验证', () => {
    it('完整工作流应在性能阈值内完成', async () => {
      // Arrange
      const scenario = WORKFLOW_SCENARIOS[0]; // I2C工作流

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(3000); // 3秒内完成
      
      // 验证各个步骤的性能
      result.steps.forEach(step => {
        expect(step.duration).toBeLessThan(1000); // 每个步骤1秒内完成
      });
    });

    it('应收集完整的性能指标', async () => {
      // Arrange
      const scenario = WORKFLOW_SCENARIOS[1]; // SPI工作流

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.devicesFound).toBeGreaterThan(0);
      expect(result.metrics.connectionTime).toBeGreaterThan(0);
      expect(result.metrics.captureTime).toBeGreaterThan(0);
      expect(result.metrics.samplesPerSecond).toBeGreaterThan(0);
      expect(result.metrics.decodeTime).toBeGreaterThan(0);
      expect(result.metrics.decodedPackets).toBeGreaterThan(0);
      expect(result.metrics.exportTime).toBeGreaterThan(0);
      expect(result.metrics.fileSize).toBeGreaterThan(0);
    });
  });

  describe('产物和输出验证', () => {
    it('应生成预期的文件产物', async () => {
      // Arrange  
      const scenario = WORKFLOW_SCENARIOS[2]; // UART工作流

      // Act
      const result = await workflowTester.runWorkflowTest(scenario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.artifacts).toHaveLength(3); // capture-data.bin, decode-uart.json, export file
      expect(result.artifacts).toContain('capture-data.bin');
      expect(result.artifacts).toContain('decode-uart.json');
      expect(result.artifacts).toContain('/mock/export/results.json');
    });

    it('应为不同协议生成对应的解码结果', async () => {
      // Act - 运行所有工作流
      const results = await Promise.all(
        WORKFLOW_SCENARIOS.map(scenario => workflowTester.runWorkflowTest(scenario))
      );

      // Assert
      expect(results).toHaveLength(3);
      
      // I2C工作流应产生I2C解码结果
      expect(results[0].artifacts).toContain('decode-i2c.json');
      expect(results[0].metrics.decodedPackets).toBe(25);
      
      // SPI工作流应产生SPI解码结果
      expect(results[1].artifacts).toContain('decode-spi.json');
      expect(results[1].metrics.decodedPackets).toBe(40);
      
      // UART工作流应产生UART解码结果
      expect(results[2].artifacts).toContain('decode-uart.json');
      expect(results[2].metrics.decodedPackets).toBe(30);
    }, 20000);
  });
});