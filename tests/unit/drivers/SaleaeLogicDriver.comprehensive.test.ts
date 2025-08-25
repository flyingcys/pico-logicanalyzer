/**
 * SaleaeLogicDriver 高质量测试
 * 
 * 测试目标：基于深度思考方法论，专注测试@src源码的真实业务逻辑
 * 测试方法：最小化Mock，验证Saleae API协议、设备能力映射、数据转换算法
 * 覆盖范围：构造逻辑、设备识别、API通信、数据处理、错误处理
 */

import { SaleaeLogicDriver } from '../../../src/drivers/SaleaeLogicDriver';
import { 
  AnalyzerDriverType, 
  CaptureSession, 
  CaptureError,
  ConnectionParams,
  DeviceStatus,
  AnalyzerChannel,
  CaptureMode,
  TriggerType
} from '../../../src/models/AnalyzerTypes';

describe('SaleaeLogicDriver 专注业务逻辑测试', () => {
  let driver: SaleaeLogicDriver;

  afterEach(() => {
    if (driver) {
      driver.dispose();
    }
  });

  describe('构造函数和连接字符串解析核心算法', () => {
    it('应该正确使用默认连接参数', () => {
      // 测试核心算法：无参数构造函数的默认值设置
      driver = new SaleaeLogicDriver();
      
      // 验证默认属性设置
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true); // Saleae总是网络连接
      expect(driver.channelCount).toBe(8); // 默认8通道
      expect(driver.maxFrequency).toBe(100000000); // 100MHz默认
      expect(driver.blastFrequency).toBe(500000000); // 500MHz默认
      expect(driver.isCapturing).toBe(false);
    });

    it('应该正确解析包含端口的连接字符串', () => {
      // 测试核心算法：host:port格式解析
      driver = new SaleaeLogicDriver('192.168.1.100:8080');
      
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
      expect(driver.channelCount).toBe(8);
    });

    it('应该正确处理仅包含主机的连接字符串', () => {
      // 测试核心算法：无端口连接字符串处理
      driver = new SaleaeLogicDriver('saleae-host');
      
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });

    it('应该正确处理空连接字符串', () => {
      // 测试边界条件：空字符串使用默认值
      driver = new SaleaeLogicDriver('');
      
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });

    it('应该正确处理localhost连接', () => {
      // 测试典型场景：本地连接
      driver = new SaleaeLogicDriver('localhost:10429');
      
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });

    it('应该正确处理无冒号的连接字符串', () => {
      // 测试边界条件：无冒号字符串使用默认端口
      driver = new SaleaeLogicDriver('local-saleae');
      
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });
  });

  describe('设备能力属性核心逻辑验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该返回正确的默认设备能力', () => {
      // 验证默认能力设置算法
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(100000000); // 100MHz
      expect(driver.blastFrequency).toBe(500000000); // 500MHz
      expect(driver.bufferSize).toBe(10000000); // 10M
      expect(driver.isNetwork).toBe(true);
    });

    it('应该正确标识Saleae网络驱动类型', () => {
      // 验证驱动类型识别逻辑
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });

    it('应该正确初始化采集状态', () => {
      // 验证初始状态管理
      expect(driver.isCapturing).toBe(false);
    });

    it('应该返回null的初始设备版本', () => {
      // 验证未连接状态的版本信息
      expect(driver.deviceVersion).toBeNull();
    });
  });

  describe('设备类型能力映射核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该正确设置Logic 4设备能力', () => {
      // 测试核心算法：setDeviceCapabilities方法
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('Logic 4');
      
      expect(driver.channelCount).toBe(4);
      expect(driver.maxFrequency).toBe(12500000); // 12.5MHz
      expect(driver.blastFrequency).toBe(25000000); // 25MHz
    });

    it('应该正确设置Logic 8设备能力', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('Logic 8');
      
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(100000000); // 100MHz
      expect(driver.blastFrequency).toBe(500000000); // 500MHz
    });

    it('应该正确设置Logic 16设备能力', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('Logic 16');
      
      expect(driver.channelCount).toBe(16);
      expect(driver.maxFrequency).toBe(100000000); // 100MHz
      expect(driver.blastFrequency).toBe(500000000); // 500MHz
    });

    it('应该正确设置Logic Pro 8设备能力', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('Logic Pro 8');
      
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(500000000); // 500MHz
      expect(driver.blastFrequency).toBe(1000000000); // 1GHz
    });

    it('应该正确设置Logic Pro 16设备能力', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('Logic Pro 16');
      
      expect(driver.channelCount).toBe(16);
      expect(driver.maxFrequency).toBe(500000000); // 500MHz
      expect(driver.blastFrequency).toBe(1000000000); // 1GHz
    });

    it('应该为未知设备类型设置默认能力', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('Unknown Device');
      
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(500000000);
    });

    it('应该正确处理大小写不敏感的设备类型', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('LOGIC PRO 16'); // 大写
      
      expect(driver.channelCount).toBe(16);
      expect(driver.maxFrequency).toBe(500000000);
      expect(driver.blastFrequency).toBe(1000000000);
    });

    it('应该正确处理空设备类型', () => {
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      
      setDeviceCapabilities('');
      
      expect(driver.channelCount).toBe(8); // 默认值
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(500000000);
    });
  });

  describe('设备能力解析核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该正确解析数字通道能力', () => {
      const parseDeviceCapabilities = (driver as any).parseDeviceCapabilities.bind(driver);
      
      const mockCapabilities = {
        digital_channels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // 12通道
      };
      
      parseDeviceCapabilities(mockCapabilities);
      
      expect(driver.channelCount).toBe(12);
    });

    it('应该正确解析支持的采样率', () => {
      const parseDeviceCapabilities = (driver as any).parseDeviceCapabilities.bind(driver);
      
      const mockCapabilities = {
        supported_sample_rates: [1000000, 10000000, 100000000, 500000000]
      };
      
      parseDeviceCapabilities(mockCapabilities);
      
      expect(driver.maxFrequency).toBe(500000000); // 最大值
      expect(driver.blastFrequency).toBe(500000000); // 应该与最大值相同
    });

    it('应该正确解析内存大小', () => {
      const parseDeviceCapabilities = (driver as any).parseDeviceCapabilities.bind(driver);
      
      const mockCapabilities = {
        memory_size: 50000000 // 50M样本
      };
      
      parseDeviceCapabilities(mockCapabilities);
      
      expect(driver.bufferSize).toBe(50000000);
    });

    it('应该正确处理完整的能力信息', () => {
      const parseDeviceCapabilities = (driver as any).parseDeviceCapabilities.bind(driver);
      
      const mockCapabilities = {
        digital_channels: [0, 1, 2, 3], // 4通道
        supported_sample_rates: [100000, 1000000, 25000000],
        memory_size: 20000000
      };
      
      parseDeviceCapabilities(mockCapabilities);
      
      expect(driver.channelCount).toBe(4);
      expect(driver.maxFrequency).toBe(25000000);
      expect(driver.bufferSize).toBe(20000000);
    });

    it('应该正确处理空能力信息', () => {
      const parseDeviceCapabilities = (driver as any).parseDeviceCapabilities.bind(driver);
      
      const originalChannelCount = driver.channelCount;
      const originalMaxFrequency = driver.maxFrequency;
      
      parseDeviceCapabilities({});
      
      // 空能力信息不应该改变现有值
      expect(driver.channelCount).toBe(originalChannelCount);
      expect(driver.maxFrequency).toBe(originalMaxFrequency);
    });
  });

  describe('时间序列数据转换核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该正确转换简单时间序列数据', () => {
      const convertSaleaeTimeSeriesToSamples = (driver as any).convertSaleaeTimeSeriesToSamples.bind(driver);
      
      // 测试基本时间序列：0时刻为低，1ms时刻变高，2ms时刻变低
      const timeSeries = [
        { time: 0, value: false },
        { time: 0.001, value: true },
        { time: 0.002, value: false }
      ];
      
      const sampleRate = 1000; // 1kHz采样率
      const result = convertSaleaeTimeSeriesToSamples(timeSeries, sampleRate);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe(0); // 0时刻为低
      expect(result[1]).toBe(1); // 1ms时刻为高
      expect(result[2]).toBe(0); // 2ms时刻为低
    });

    it('应该正确处理高频采样的时间序列', () => {
      const convertSaleaeTimeSeriesToSamples = (driver as any).convertSaleaeTimeSeriesToSamples.bind(driver);
      
      const timeSeries = [
        { time: 0, value: false },
        { time: 0.00001, value: true }, // 10μs后变高
        { time: 0.00002, value: false } // 20μs后变低
      ];
      
      const sampleRate = 1000000; // 1MHz采样率
      const result = convertSaleaeTimeSeriesToSamples(timeSeries, sampleRate);
      
      expect(result.length).toBeGreaterThan(20); // 至少20个样本
      expect(result[0]).toBe(0);
      expect(result[10]).toBe(1); // 10μs位置应该为高
      expect(result[20]).toBe(0); // 20μs位置应该为低
    });

    it('应该正确处理单次变化的时间序列', () => {
      const convertSaleaeTimeSeriesToSamples = (driver as any).convertSaleaeTimeSeriesToSamples.bind(driver);
      
      const timeSeries = [
        { time: 0, value: false },
        { time: 0.005, value: true } // 5ms后变高并保持
      ];
      
      const sampleRate = 1000; // 1kHz
      const result = convertSaleaeTimeSeriesToSamples(timeSeries, sampleRate);
      
      expect(result.length).toBeGreaterThan(5);
      expect(result[0]).toBe(0); // 初始为低
      expect(result[4]).toBe(0); // 4ms还是低
      expect(result[5]).toBe(1); // 5ms变高
      if (result.length > 6) {
        expect(result[6]).toBe(1); // 6ms仍然高
      }
    });

    it('应该正确处理空时间序列', () => {
      const convertSaleaeTimeSeriesToSamples = (driver as any).convertSaleaeTimeSeriesToSamples.bind(driver);
      
      const timeSeries: Array<{ time: number; value: boolean }> = [];
      const result = convertSaleaeTimeSeriesToSamples(timeSeries, 1000);
      
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });

    it('应该正确处理布尔值转换', () => {
      const convertSaleaeTimeSeriesToSamples = (driver as any).convertSaleaeTimeSeriesToSamples.bind(driver);
      
      const timeSeries = [
        { time: 0, value: true },
        { time: 0.001, value: false },
        { time: 0.002, value: true }
      ];
      
      const result = convertSaleaeTimeSeriesToSamples(timeSeries, 1000);
      
      // 验证布尔值正确转换为0/1
      expect(result[0]).toBe(1); // true -> 1
      expect(result[1]).toBe(0); // false -> 0
      expect(result[2]).toBe(1); // true -> 1
    });

    it('应该正确计算样本数组长度', () => {
      const convertSaleaeTimeSeriesToSamples = (driver as any).convertSaleaeTimeSeriesToSamples.bind(driver);
      
      const timeSeries = [
        { time: 0, value: false },
        { time: 0.01, value: true } // 10ms
      ];
      
      const sampleRate = 100; // 100Hz，每10ms一个样本
      const result = convertSaleaeTimeSeriesToSamples(timeSeries, sampleRate);
      
      // 10ms * 100Hz + 1 = 2个样本
      expect(result.length).toBe(2);
    });
  });

  describe('采集模式选择核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该为普通会话选择NORMAL模式', () => {
      const getSaleaeCaptureMode = (driver as any).getSaleaeCaptureMode.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0, // 无循环
        measureBursts: false, // 无突发测量
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const mode = getSaleaeCaptureMode(mockSession);
      
      expect(mode).toBe('NORMAL');
    });

    it('应该为突发测量选择LOOPING模式', () => {
      const getSaleaeCaptureMode = (driver as any).getSaleaeCaptureMode.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: true, // 启用突发测量
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const mode = getSaleaeCaptureMode(mockSession);
      
      expect(mode).toBe('LOOPING');
    });

    it('应该为多次循环选择LOOPING模式', () => {
      const getSaleaeCaptureMode = (driver as any).getSaleaeCaptureMode.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 5, // 5次循环
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const mode = getSaleaeCaptureMode(mockSession);
      
      expect(mode).toBe('LOOPING');
    });
  });

  describe('触发设置构建核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该构建上升沿触发设置', () => {
      const buildTriggerSettings = (driver as any).buildTriggerSettings.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 3,
        triggerInverted: false, // 上升沿
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const settings = buildTriggerSettings(mockSession);
      
      expect(settings.triggers).toBeDefined();
      expect(settings.triggers.length).toBe(1);
      expect(settings.triggers[0].channel_index).toBe(3);
      expect(settings.triggers[0].trigger_type).toBe('RISING_EDGE');
      expect(settings.triggers[0].minimum_pulse_width_seconds).toBe(0);
      expect(settings.capture_mode).toBe('ALWAYS');
    });

    it('应该构建下降沿触发设置', () => {
      const buildTriggerSettings = (driver as any).buildTriggerSettings.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 7,
        triggerInverted: true, // 下降沿
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const settings = buildTriggerSettings(mockSession);
      
      expect(settings.triggers[0].channel_index).toBe(7);
      expect(settings.triggers[0].trigger_type).toBe('FALLING_EDGE');
    });

    it('应该正确处理无触发配置', () => {
      const buildTriggerSettings = (driver as any).buildTriggerSettings.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: undefined, // 无触发
        triggerChannel: undefined,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const settings = buildTriggerSettings(mockSession);
      
      expect(settings.triggers).toBeDefined();
      expect(settings.triggers.length).toBe(0);
      expect(settings.capture_mode).toBe('ALWAYS');
    });
  });

  describe('硬件能力构建核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该构建正确的硬件能力描述', () => {
      const buildCapabilities = (driver as any).buildCapabilities.bind(driver);
      
      const capabilities = buildCapabilities();
      
      // 验证通道能力
      expect(capabilities.channels).toBeDefined();
      expect(capabilities.channels.digital).toBe(8); // 默认8通道
      expect(capabilities.channels.maxVoltage).toBe(5.0);
      expect(capabilities.channels.inputImpedance).toBe(1000000);
      
      // 验证采样能力
      expect(capabilities.sampling).toBeDefined();
      expect(capabilities.sampling.maxRate).toBe(100000000);
      expect(capabilities.sampling.bufferSize).toBe(10000000);
      expect(capabilities.sampling.supportedRates).toEqual([100000000, 500000000]);
      expect(capabilities.sampling.streamingSupport).toBe(true); // Saleae支持流式传输
      
      // 验证触发能力
      expect(capabilities.triggers).toBeDefined();
      expect(capabilities.triggers.types).toEqual([0, 1]); // 主要是边沿触发
      expect(capabilities.triggers.maxChannels).toBe(8);
      expect(capabilities.triggers.patternWidth).toBe(8);
      expect(capabilities.triggers.sequentialSupport).toBe(true);
      expect(capabilities.triggers.conditions).toEqual(['rising', 'falling', 'high', 'low', 'change']);
      
      // 验证连接能力
      expect(capabilities.connectivity).toBeDefined();
      expect(capabilities.connectivity.interfaces).toEqual(['usb']);
      expect(capabilities.connectivity.protocols).toEqual(['saleae_api']);
      
      // 验证功能特性
      expect(capabilities.features).toBeDefined();
      expect(capabilities.features.signalGeneration).toBe(false);
      expect(capabilities.features.powerSupply).toBe(false);
      expect(capabilities.features.voltageMonitoring).toBe(false);
    });

    it('应该根据设备能力调整能力参数', () => {
      // 先设置Logic Pro 16设备能力
      const setDeviceCapabilities = (driver as any).setDeviceCapabilities.bind(driver);
      setDeviceCapabilities('Logic Pro 16');
      
      const buildCapabilities = (driver as any).buildCapabilities.bind(driver);
      const capabilities = buildCapabilities();
      
      // 验证Logic Pro 16特有的能力参数
      expect(capabilities.channels.digital).toBe(16);
      expect(capabilities.sampling.maxRate).toBe(500000000); // 500MHz
      expect(capabilities.triggers.maxChannels).toBe(16);
      expect(capabilities.triggers.patternWidth).toBe(16);
    });
  });

  describe('采集控制核心逻辑验证（无网络依赖）', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该拒绝在繁忙状态下开始新采集', async () => {
      // 模拟繁忙状态
      (driver as any)._capturing = true;
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const result = await driver.startCapture(mockSession);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝在未连接状态下开始采集', async () => {
      // 确保未连接状态
      (driver as any)._isConnected = false;
      (driver as any)._socket = undefined;
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const result = await driver.startCapture(mockSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该在非采集状态下允许停止操作', async () => {
      // 确保非采集状态
      (driver as any)._capturing = false;
      
      const result = await driver.stopCapture();
      
      expect(result).toBe(true);
    });

    it('应该正确返回引导加载程序不支持', async () => {
      // 测试引导加载程序支持
      const result = await driver.enterBootloader();
      
      expect(result).toBe(false); // Saleae不支持引导加载程序
    });
  });

  describe('错误处理和状态管理验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该正确处理设备状态查询', async () => {
      // 设置已连接状态
      (driver as any)._isConnected = true;
      (driver as any)._capturing = false;
      
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A'); // USB供电
    });

    it('应该正确处理采集错误', () => {
      const handleCaptureError = (driver as any).handleCaptureError.bind(driver);
      
      // 模拟采集状态
      (driver as any)._capturing = true;
      (driver as any)._currentCaptureId = 'test-capture-123';
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      // 处理错误
      handleCaptureError(mockSession, 'Saleae API错误');
      
      // 验证状态重置
      expect(driver.isCapturing).toBe(false);
      expect((driver as any)._currentCaptureId).toBeNull();
    });

    it('应该正确清理资源', async () => {
      // 模拟连接状态
      (driver as any)._isConnected = true;
      (driver as any)._socket = { destroy: jest.fn() };
      (driver as any)._deviceId = 'test-device-123';
      (driver as any)._currentCaptureId = 'test-capture-456';
      
      // 调用disconnect
      await driver.disconnect();
      
      // 验证清理结果
      expect((driver as any)._isConnected).toBe(false);
      expect((driver as any)._socket).toBeUndefined();
      expect((driver as any)._deviceId).toBeNull();
      expect((driver as any)._currentCaptureId).toBeNull();
    });

    it('应该正确处理dispose清理', () => {
      const disconnectSpy = jest.spyOn(driver, 'disconnect');
      
      driver.dispose();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Saleae数据解析核心算法验证', () => {
    beforeEach(() => {
      driver = new SaleaeLogicDriver();
    });

    it('应该正确解析Saleae数字采样数据', () => {
      const parseSaleaeData = (driver as any).parseSaleaeData.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          {
            channelNumber: 0,
            channelName: 'CH0',
            textualChannelNumber: '0',
            hidden: false,
            clone: function() { return this; }
          },
          {
            channelNumber: 1,
            channelName: 'CH1',
            textualChannelNumber: '1',
            hidden: false,
            clone: function() { return this; }
          }
        ],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const mockDataResponse = {
        digital_samples: {
          0: {
            samples: [
              { time: 0, value: false },
              { time: 0.001, value: true },
              { time: 0.002, value: false }
            ],
            sample_rate: 1000
          },
          1: {
            samples: [
              { time: 0, value: true },
              { time: 0.0015, value: false }
            ],
            sample_rate: 1000
          }
        }
      };
      
      parseSaleaeData(mockSession, mockDataResponse);
      
      // 验证通道0数据
      expect(mockSession.captureChannels[0].samples).toBeDefined();
      expect(mockSession.captureChannels[0].samples?.length).toBeGreaterThan(0);
      
      // 验证通道1数据
      expect(mockSession.captureChannels[1].samples).toBeDefined();
      expect(mockSession.captureChannels[1].samples?.length).toBeGreaterThan(0);
    });

    it('应该正确处理无数字采样数据', () => {
      const parseSaleaeData = (driver as any).parseSaleaeData.bind(driver);
      
      const mockSession: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [],
        clone: function() { return this; },
        cloneSettings: function() { return this; }
      };
      
      const mockDataResponse = {}; // 无digital_samples
      
      // 不应该抛出异常
      expect(() => {
        parseSaleaeData(mockSession, mockDataResponse);
      }).not.toThrow();
    });
  });
});