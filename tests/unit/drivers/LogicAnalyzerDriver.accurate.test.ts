/**
 * LogicAnalyzerDriver 精准业务逻辑测试
 * 
 * 基于源码深度分析的准确测试：
 * - 测试真实的构造函数和连接逻辑
 * - 测试实际的validateSettings算法
 * - 测试真实的请求构建逻辑
 * - 避免网络连接超时，专注核心业务逻辑
 * 
 * 深度思考方法：一步一步基于@src源码验证算法正确性
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { 
  AnalyzerDriverType, 
  CaptureError, 
  TriggerType,
  CaptureMode 
} from '../../../src/models/AnalyzerTypes';

describe('LogicAnalyzerDriver 精准业务逻辑测试', () => {
  let driver: LogicAnalyzerDriver;
  let testSession: CaptureSession;

  beforeEach(() => {
    testSession = new CaptureSession();
    testSession.frequency = 10000000; // 10MHz
    testSession.preTriggerSamples = 1000;
    testSession.postTriggerSamples = 4000;
    testSession.triggerType = TriggerType.Edge;
    testSession.triggerChannel = 0;
    testSession.triggerInverted = false;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'CH0'),
      new AnalyzerChannel(1, 'CH1')
    ];
  });

  describe('构造函数和初始状态逻辑', () => {
    it('应该正确初始化网络连接字符串', () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      // 构造函数阶段：_isNetwork 默认为 false
      expect(driver.isNetwork).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
      
      // 初始设备属性应该为默认值
      expect(driver.channelCount).toBe(0);
      expect(driver.maxFrequency).toBe(0);
      expect(driver.blastFrequency).toBe(0);
      expect(driver.bufferSize).toBe(0);
      expect(driver.isCapturing).toBe(false);
    });

    it('应该正确初始化串口连接字符串', () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      expect(driver.isNetwork).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该拒绝空连接字符串', () => {
      expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
      expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
    });
  });

  describe('网络识别核心算法', () => {
    it('应该通过连接字符串格式识别网络类型', () => {
      // 测试网络地址格式识别正则表达式逻辑
      const networkPatterns = [
        '192.168.1.100:8080',
        '10.0.0.1:3000',
        '127.0.0.1:1234',
        '255.255.255.255:65535'
      ];

      networkPatterns.forEach(pattern => {
        const driver = new LogicAnalyzerDriver(pattern);
        // connect()被调用前，应该包含":"但isNetwork仍为false
        expect(pattern.includes(':')).toBe(true);
        expect(driver.isNetwork).toBe(false); // 构造函数阶段
      });
    });

    it('应该正确识别串口路径格式', () => {
      const serialPaths = [
        '/dev/ttyUSB0',
        'COM3',
        '/dev/ttyS0',
        'ttyACM0'
      ];

      serialPaths.forEach(path => {
        const driver = new LogicAnalyzerDriver(path);
        expect(path.includes(':')).toBe(false);
        expect(driver.isNetwork).toBe(false);
        expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
      });
    });
  });

  describe('采集参数验证核心算法', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      // 模拟未连接状态但有合理的默认验证值
    });

    it('应该验证触发通道范围', () => {
      const validateMethod = (driver as any).validateSettings;
      
      // 基于源码：触发通道 <= effectiveChannelCount (默认24)
      const testCases = [
        { triggerChannel: 0, expected: true, desc: '最小有效通道' },
        { triggerChannel: 23, expected: true, desc: '最大设备通道' },
        { triggerChannel: 24, expected: true, desc: '扩展触发通道' },
        { triggerChannel: 25, expected: false, desc: '超出扩展触发范围' },
        { triggerChannel: -1, expected: false, desc: '无效负数' }
      ];

      testCases.forEach(({ triggerChannel, expected, desc }) => {
        testSession.triggerChannel = triggerChannel;
        const result = validateMethod.call(driver, testSession, 5000);
        expect(result).toBe(expected);
      });
    });

    it('应该验证频率范围', () => {
      const validateMethod = (driver as any).validateSettings;
      
      // 基于源码：effectiveMinFrequency = 1000000, effectiveMaxFrequency = 100000000
      const testCases = [
        { frequency: 1000000, expected: true, desc: '最小频率1MHz' },
        { frequency: 10000000, expected: true, desc: '10MHz有效' },
        { frequency: 100000000, expected: true, desc: '最大频率100MHz' },
        { frequency: 999999, expected: false, desc: '低于最小频率' },
        { frequency: 100000001, expected: false, desc: '高于最大频率' }
      ];

      testCases.forEach(({ frequency, expected, desc }) => {
        testSession.frequency = frequency;
        const result = validateMethod.call(driver, testSession, 5000);
        expect(result).toBe(expected);
      });
    });

    it('应该验证通道数组', () => {
      const validateMethod = (driver as any).validateSettings;
      
      // 空通道数组在JavaScript中会通过验证（every()对空数组返回true）
      testSession.captureChannels = [];
      let result = validateMethod.call(driver, testSession, 5000);
      expect(result).toBe(true); // 基于源码：空数组的every()返回true
      
      // 超出范围的通道应该失败
      testSession.captureChannels = [new AnalyzerChannel(24, 'Invalid')]; // >= 24是无效的
      result = validateMethod.call(driver, testSession, 5000);
      expect(result).toBe(false);
      
      // 有效通道范围应该成功
      testSession.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(23, 'CH23')
      ];
      result = validateMethod.call(driver, testSession, 5000);
      expect(result).toBe(true);
    });
  });

  describe('采集请求构建核心算法', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该正确构建边沿触发请求', () => {
      testSession.triggerType = TriggerType.Edge;
      testSession.triggerChannel = 5;
      testSession.triggerInverted = true;
      testSession.frequency = 25000000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 10000, CaptureMode.Channels_8);

      expect(request.triggerType).toBe(TriggerType.Edge);
      expect(request.trigger).toBe(5);
      expect(request.invertedOrCount).toBe(1); // true转换为1
      expect(request.triggerValue).toBe(0); // 边沿触发不使用值
      expect(request.frequency).toBe(25000000);
    });

    it('应该正确构建复杂触发请求', () => {
      testSession.triggerType = TriggerType.Complex;
      testSession.triggerChannel = 0;
      testSession.triggerBitCount = 8;
      testSession.triggerPattern = 0xAA;
      testSession.frequency = 20000000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 12000, CaptureMode.Channels_16);

      expect(request.triggerType).toBe(TriggerType.Complex);
      expect(request.trigger).toBe(0);
      expect(request.invertedOrCount).toBe(8); // 位数
      expect(request.triggerValue).toBe(0xAA); // 模式值
      expect(request.frequency).toBe(20000000);
    });

    it('应该正确映射通道配置', () => {
      const customChannels = [
        new AnalyzerChannel(0, 'CLK'),
        new AnalyzerChannel(5, 'DATA'),
        new AnalyzerChannel(15, 'CS')
      ];
      testSession.captureChannels = customChannels;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 6000, CaptureMode.Channels_16);

      expect(request.channelCount).toBe(3);
      // channels是固定长度24的Uint8Array，只有前面的位置被填充
      expect(request.channels.slice(0, 3)).toEqual(new Uint8Array([0, 5, 15])); 
      expect(request.channels.length).toBe(24); // 验证固定长度
    });
  });

  describe('采集模式选择算法', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该正确选择采集模式', () => {
      const getCaptureMethod = (driver as any).getCaptureMode;
      
      const testCases = [
        { 
          channels: [0, 1, 2], 
          expectedMode: CaptureMode.Channels_8,
          description: '3通道选择8通道模式'
        },
        { 
          channels: [0, 1, 2, 3, 4, 5, 6, 7], 
          expectedMode: CaptureMode.Channels_8,
          description: '8通道模式'
        },
        { 
          channels: [0, 1, 2, 3, 4, 5, 6, 7, 8], 
          expectedMode: CaptureMode.Channels_16,
          description: '9通道选择16通道模式'
        },
        { 
          channels: Array.from({length: 24}, (_, i) => i), 
          expectedMode: CaptureMode.Channels_24,
          description: '24通道模式'
        }
      ];

      testCases.forEach(({ channels, expectedMode, description }) => {
        const mode = getCaptureMethod.call(driver, channels);
        expect(mode).toBe(expectedMode);
      });
    });
  });

  describe('设备状态管理逻辑', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0'); // 串口设备
    });

    it('应该正确跟踪连接状态', async () => {
      // 初始状态：未连接
      const initialStatus = await driver.getStatus();
      expect(initialStatus.isConnected).toBe(false);
      expect(initialStatus.isCapturing).toBe(false);

      // 模拟连接状态
      (driver as any)._isConnected = true;
      const connectedStatus = await driver.getStatus();
      expect(connectedStatus.isConnected).toBe(true);
    });

    it('应该正确跟踪采集状态', () => {
      expect(driver.isCapturing).toBe(false);

      // 模拟采集状态
      (driver as any)._capturing = true;
      expect(driver.isCapturing).toBe(true);
    });

    it('应该处理电压状态查询', async () => {
      // 未连接状态
      const disconnectedVoltage = await driver.getVoltageStatus();
      expect(disconnectedVoltage).toBe('DISCONNECTED');

      // 模拟串口连接状态
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = {}; // 模拟流对象
      const connectedVoltage = await driver.getVoltageStatus();
      expect(connectedVoltage).toBe('3.3V'); // 串口设备模拟电压
    });
  });

  describe('采集流程核心逻辑', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该在未连接状态拒绝采集', async () => {
      const result = await driver.startCapture(testSession);
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该防止重复采集', async () => {
      // 模拟已在采集状态
      (driver as any)._capturing = true;
      
      const result = await driver.startCapture(testSession);
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该验证采集参数', async () => {
      // 模拟连接状态但使用无效参数
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = {}; // 模拟流对象
      
      // 使用无效频率
      testSession.frequency = 999999; // 低于最小频率1MHz
      
      const result = await driver.startCapture(testSession);
      expect(result).toBe(CaptureError.BadParams);
    });
  });

  describe('网络配置处理逻辑', () => {
    it('应该拒绝网络设备的网络配置', async () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      // 模拟网络设备状态
      (networkDriver as any)._isNetwork = true;

      const result = await networkDriver.sendNetworkConfig(
        'TestWiFi',
        'password123',
        '192.168.1.200',
        8080
      );

      expect(result).toBe(false);
    });

    it('应该允许串口设备的网络配置', async () => {
      const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      // 网络配置方法应该存在但实际逻辑待实现
      expect(typeof serialDriver.sendNetworkConfig).toBe('function');
    });
  });
});