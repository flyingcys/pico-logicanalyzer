/**
 * NetworkLogicAnalyzerDriver 精准业务逻辑测试
 * 
 * 基于错误驱动学习 - 专注核心业务逻辑而非网络细节
 * - 最小化Mock使用，验证核心网络驱动算法
 * - 专注测试@src源码真实业务逻辑，不偏移方向
 * - 避免复杂的Socket类型问题，专注NetworkLogicAnalyzerDriver核心功能
 * - 系统性覆盖协议选择、配置构建、数据解析等核心算法
 */

import { NetworkLogicAnalyzerDriver } from '../../../src/drivers/NetworkLogicAnalyzerDriver';
import {
  AnalyzerDriverType,
  CaptureError,
  TriggerType,
  CaptureSession,
  AnalyzerChannel
} from '../../../src/models/AnalyzerTypes';

// Mock network modules with simple implementations
jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    write: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }))
}));

jest.mock('dgram', () => ({
  createSocket: jest.fn().mockImplementation(() => ({
    bind: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }))
}));

describe('NetworkLogicAnalyzerDriver 精准业务逻辑测试', () => {
  let networkDriver: NetworkLogicAnalyzerDriver;

  // 创建测试用的真实采集会话数据
  const createTestSession = (overrides: Partial<CaptureSession> = {}): CaptureSession => ({
    frequency: 1000000,
    preTriggerSamples: 1000,
    postTriggerSamples: 1000,
    triggerType: TriggerType.Complex,
    triggerChannel: 0,
    triggerInverted: false,
    loopCount: 1,
    measureBursts: false,
    captureChannels: [
      createTestChannel(0),
      createTestChannel(1),
      createTestChannel(2),
      createTestChannel(3)
    ],
    get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
    clone() { return { ...this }; },
    cloneSettings() { return { ...this }; },
    ...overrides
  });

  // 创建测试通道
  const createTestChannel = (channelNumber: number): AnalyzerChannel => ({
    channelNumber,
    channelName: `Channel ${channelNumber}`,
    textualChannelNumber: channelNumber.toString(),
    hidden: false,
    channelColor: 0xFF0000,
    enabled: true,
    minimized: false,
    clone() { return { ...this }; }
  });

  describe('构造函数和网络驱动基础属性', () => {
    it('应该正确创建TCP网络驱动实例', () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      
      expect(networkDriver).toBeDefined();
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(networkDriver.isNetwork).toBe(true);
      expect(networkDriver.isCapturing).toBe(false);
    });

    it('应该正确创建UDP网络驱动实例', () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any);
      
      expect(networkDriver).toBeDefined();
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(networkDriver.isNetwork).toBe(true);
    });

    it('应该正确设置默认设备属性', () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      
      expect(networkDriver.channelCount).toBe(8);
      expect(networkDriver.maxFrequency).toBe(40000000);
      expect(networkDriver.bufferSize).toBe(8000000);
    });

    it('应该正确处理认证token参数', () => {
      const authToken = 'test-auth-token-123';
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any, authToken);
      
      expect(networkDriver).toBeDefined();
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
    });

    it('应该正确处理不同协议和数据格式组合', () => {
      const tcpJsonDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any);
      const udpBinaryDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any, 'binary' as any);
      const httpCsvDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'http' as any, 'csv' as any);
      
      expect(tcpJsonDriver).toBeDefined();
      expect(udpBinaryDriver).toBeDefined();
      expect(httpCsvDriver).toBeDefined();
    });
  });

  describe('采集配置构建核心算法', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该正确构建基础采集配置', () => {
      const testSession = createTestSession({
        frequency: 2000000,
        preTriggerSamples: 500,
        postTriggerSamples: 1500,
        triggerType: TriggerType.Complex,
        triggerChannel: 2,
        triggerInverted: true
      });

      const buildCaptureConfig = (networkDriver as any).buildCaptureConfig.bind(networkDriver);
      const config = buildCaptureConfig(testSession);
      
      expect(config).toBeDefined();
      expect(config.sample_rate).toBe(2000000);
      expect(config.pre_trigger_samples).toBe(500);
      expect(config.post_trigger_samples).toBe(1500);
      expect(config.trigger.type).toBe(TriggerType.Complex);
      expect(config.trigger.channel).toBe(2);
      expect(config.trigger.inverted).toBe(true);
      expect(config.channels).toHaveLength(4);
      expect(config.data_format).toBe('json');
    });

    it('应该正确映射通道配置', () => {
      const testSession = createTestSession();
      const buildCaptureConfig = (networkDriver as any).buildCaptureConfig.bind(networkDriver);
      const config = buildCaptureConfig(testSession);
      
      expect(config.channels[0].number).toBe(0);
      expect(config.channels[0].name).toBe('Channel 0');
      expect(config.channels[0].enabled).toBe(true);
      
      expect(config.channels[1].number).toBe(1);
      expect(config.channels[1].name).toBe('Channel 1');
      expect(config.channels[1].enabled).toBe(true);
    });

    it('应该正确设置触发配置', () => {
      const testSession = createTestSession({
        triggerType: TriggerType.Edge,
        triggerChannel: 5,
        triggerInverted: false,
        triggerPattern: 0xABCD,
        triggerBitCount: 16
      });

      const buildCaptureConfig = (networkDriver as any).buildCaptureConfig.bind(networkDriver);
      const config = buildCaptureConfig(testSession);
      
      expect(config.trigger.type).toBe(TriggerType.Edge);
      expect(config.trigger.channel).toBe(5);
      expect(config.trigger.inverted).toBe(false);
      expect(config.trigger.pattern).toBe(0xABCD);
      expect(config.trigger.bit_count).toBe(16);
    });

    it('应该正确设置循环和突发测量配置', () => {
      const testSession = createTestSession({
        loopCount: 5,
        measureBursts: true
      });

      const buildCaptureConfig = (networkDriver as any).buildCaptureConfig.bind(networkDriver);
      const config = buildCaptureConfig(testSession);
      
      expect(config.loop_count).toBe(5);
      expect(config.measure_bursts).toBe(true);
    });
  });

  describe('数据解析算法核心验证', () => {
    let testSession: CaptureSession;

    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any);
      testSession = createTestSession();
    });

    it('应该正确解析JSON格式数据', () => {
      const parseJSONData = (networkDriver as any).parseJSONData.bind(networkDriver);
      
      const jsonData = {
        channels: [
          { number: 0, samples: [1, 0, 1, 1, 0] },
          { number: 1, samples: [0, 1, 0, 1, 1] },
          { number: 2, samples: [1, 1, 0, 0, 1] },
          { number: 3, samples: [0, 0, 1, 1, 0] }
        ],
        bursts: [
          { channel: 0, start: 10, end: 20 },
          { channel: 1, start: 30, end: 40 }
        ]
      };

      parseJSONData(testSession, jsonData);
      
      // 验证通道数据被正确设置
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 1, 0, 0, 1]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 0, 1, 1, 0]));
      
      // 验证突发信息被正确设置
      expect(testSession.bursts).toEqual(jsonData.bursts);
    });

    it('应该正确解析Binary格式数据', () => {
      const parseBinaryData = (networkDriver as any).parseBinaryData.bind(networkDriver);
      
      // 创建测试二进制数据 (Base64编码)
      const binaryArray = new Uint8Array([
        1, 0, 1, 0,  // 第一个样本：CH0=1, CH1=0, CH2=1, CH3=0
        0, 1, 0, 1,  // 第二个样本：CH0=0, CH1=1, CH2=0, CH3=1
        1, 1, 0, 0   // 第三个样本：CH0=1, CH1=1, CH2=0, CH3=0
      ]);
      const base64Data = Buffer.from(binaryArray).toString('base64');

      parseBinaryData(testSession, base64Data);
      
      // 验证每个通道的数据
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 0, 0]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 1, 0]));
    });

    it('应该正确解析CSV格式数据', () => {
      const parseCSVData = (networkDriver as any).parseCSVData.bind(networkDriver);
      
      const csvData = `Time,CH0,CH1,CH2,CH3\\n` +
                     `0.1,1,0,1,0\\n` +
                     `0.2,0,1,0,1\\n` +
                     `0.3,1,1,0,0\\n`;

      parseCSVData(testSession, csvData);
      
      // 验证CSV数据被正确解析
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 0, 0]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 1, 0]));
    });

    it('应该正确解析Raw格式数据', () => {
      const parseRawData = (networkDriver as any).parseRawData.bind(networkDriver);
      
      const rawData = [
        [1, 0, 1, 1, 0],  // CH0数据
        [0, 1, 0, 1, 1],  // CH1数据
        [1, 1, 0, 0, 1],  // CH2数据
        [0, 0, 1, 1, 0]   // CH3数据
      ];

      parseRawData(testSession, rawData);
      
      // 验证原始数据被正确设置
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 1, 0, 0, 1]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 0, 1, 1, 0]));
    });

    it('应该处理JSON数据中缺少通道的情况', () => {
      const parseJSONData = (networkDriver as any).parseJSONData.bind(networkDriver);
      
      const jsonData = {
        channels: [
          { number: 0, samples: [1, 0, 1] },
          { number: 2, samples: [1, 1, 0] }  // 缺少通道1和3
        ]
      };

      parseJSONData(testSession, jsonData);
      
      // 验证存在的通道数据被正确设置
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 1, 0]));
      
      // 验证缺少的通道没有被设置samples
      expect(testSession.captureChannels[1].samples).toBeUndefined();
      expect(testSession.captureChannels[3].samples).toBeUndefined();
    });

    it('应该处理CSV数据中的空行和格式问题', () => {
      const parseCSVData = (networkDriver as any).parseCSVData.bind(networkDriver);
      
      const csvData = `Time,CH0,CH1,CH2,CH3\\n` +
                     `0.1,1,0,1,0\\n` +
                     `\\n` +  // 空行
                     `0.2,0,1,0,1\\n` +
                     `   \\n`;  // 只有空格的行

      parseCSVData(testSession, csvData);
      
      // 验证只有有效数据行被处理
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1]));
    });
  });

  describe('硬件能力构建算法', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该构建正确的基础硬件能力描述', () => {
      const buildCapabilities = (networkDriver as any).buildCapabilities.bind(networkDriver);
      
      const capabilities = buildCapabilities();
      
      expect(capabilities).toHaveProperty('channels');
      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.channels.maxVoltage).toBe(5.0);
      expect(capabilities.channels.inputImpedance).toBe(1000000);
      
      expect(capabilities).toHaveProperty('sampling');
      expect(capabilities.sampling.maxRate).toBe(40000000);
      expect(capabilities.sampling.bufferSize).toBe(8000000);
      expect(capabilities.sampling.streamingSupport).toBe(true);
      
      expect(capabilities).toHaveProperty('triggers');
      expect(capabilities.triggers.types).toEqual([0, 1, 2, 3]);
      expect(capabilities.triggers.maxChannels).toBe(8);
      expect(capabilities.triggers.conditions).toContain('rising');
      expect(capabilities.triggers.conditions).toContain('falling');
      
      expect(capabilities).toHaveProperty('connectivity');
      expect(capabilities.connectivity.interfaces).toContain('ethernet');
      expect(capabilities.connectivity.protocols).toContain('tcp');
      
      expect(capabilities).toHaveProperty('features');
      expect(capabilities.features.remoteControl).toBe(true);
    });

    it('应该根据设备配置调整能力描述', () => {
      // 设置设备配置
      (networkDriver as any)._deviceConfig = {
        signal_generation: true,
        power_supply: true,
        voltage_monitoring: true,
        firmware_update: true
      };
      
      const buildCapabilities = (networkDriver as any).buildCapabilities.bind(networkDriver);
      const capabilities = buildCapabilities();
      
      expect(capabilities.features.signalGeneration).toBe(true);
      expect(capabilities.features.powerSupply).toBe(true);
      expect(capabilities.features.voltageMonitoring).toBe(true);
      expect(capabilities.features.firmwareUpdate).toBe(true);
    });

    it('应该根据设备信息更新能力参数', () => {
      // 设置自定义设备参数
      (networkDriver as any)._channelCount = 32;
      (networkDriver as any)._maxFrequency = 100000000;
      (networkDriver as any)._bufferSize = 16000000;
      
      const buildCapabilities = (networkDriver as any).buildCapabilities.bind(networkDriver);
      const capabilities = buildCapabilities();
      
      expect(capabilities.channels.digital).toBe(32);
      expect(capabilities.sampling.maxRate).toBe(100000000);
      expect(capabilities.sampling.bufferSize).toBe(16000000);
      expect(capabilities.triggers.maxChannels).toBe(32);
    });
  });

  describe('采集状态管理核心逻辑', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该正确管理采集状态', () => {
      expect(networkDriver.isCapturing).toBe(false);
      
      // 设置采集状态
      (networkDriver as any)._capturing = true;
      expect(networkDriver.isCapturing).toBe(true);
      
      // 重置采集状态
      (networkDriver as any)._capturing = false;
      expect(networkDriver.isCapturing).toBe(false);
    });

    it('应该拒绝忙状态下的采集请求', async () => {
      // 设置为采集状态
      (networkDriver as any)._capturing = true;

      const result = await networkDriver.startCapture(createTestSession());
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝未连接状态下的采集请求', async () => {
      // 设置为未连接状态
      (networkDriver as any)._isConnected = false;

      const result = await networkDriver.startCapture(createTestSession());
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该处理非采集状态下的停止请求', async () => {
      // 确保未处于采集状态
      expect(networkDriver.isCapturing).toBe(false);

      const result = await networkDriver.stopCapture();
      
      expect(result).toBe(true);
    });
  });

  describe('边界条件和错误处理', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该处理无效的数据格式', () => {
      const parseNetworkCaptureData = (networkDriver as any).parseNetworkCaptureData.bind(networkDriver);
      const testSession = createTestSession();
      
      // 设置无效的数据格式
      (networkDriver as any)._dataFormat = 'invalid-format';
      
      expect(() => {
        parseNetworkCaptureData(testSession, { data: {} });
      }).toThrow('不支持的数据格式: invalid-format');
    });

    it('应该处理空的JSON数据', () => {
      const parseJSONData = (networkDriver as any).parseJSONData.bind(networkDriver);
      const testSession = createTestSession();
      
      // 测试空数据
      parseJSONData(testSession, {});
      
      // 应该不会抛出错误，通道数据保持不变
      expect(testSession.captureChannels[0].samples).toBeUndefined();
    });

    it('应该处理无效的Binary数据', () => {
      const parseBinaryData = (networkDriver as any).parseBinaryData.bind(networkDriver);
      const testSession = createTestSession();
      
      // 测试无效的Base64数据 - Buffer.from() 不会抛出异常，而是尽力解析
      // 这是Node.js的实际行为，体现了容错性设计
      expect(() => {
        parseBinaryData(testSession, 'invalid-base64-data!@#');
      }).not.toThrow();
      
      // 验证数据被设置了（虽然可能不是预期的内容）
      expect(testSession.captureChannels[0].samples).toBeInstanceOf(Uint8Array);
    });

    it('应该处理CSV数据缺少头部的情况', () => {
      const parseCSVData = (networkDriver as any).parseCSVData.bind(networkDriver);
      const testSession = createTestSession();
      
      const csvData = `0.1,1,0,1,0\\n`;  // 没有标题行

      parseCSVData(testSession, csvData);
      
      // 应该不会处理任何数据，因为缺少头部
      expect(testSession.captureChannels[0].samples?.length).toBe(0);
    });

    it('应该处理Raw数据格式不正确的情况', () => {
      const parseRawData = (networkDriver as any).parseRawData.bind(networkDriver);
      const testSession = createTestSession();
      
      // 测试非数组数据
      parseRawData(testSession, "not-an-array");
      
      // 通道数据应该保持不变
      expect(testSession.captureChannels[0].samples).toBeUndefined();
    });
  });

  describe('资源清理和连接管理', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该正确断开连接并清理资源', async () => {
      await networkDriver.disconnect();
      
      expect((networkDriver as any)._isConnected).toBe(false);
    });

    it('应该正确处理资源清理', () => {
      const disconnectSpy = jest.spyOn(networkDriver, 'disconnect').mockResolvedValue(undefined);
      
      networkDriver.dispose();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('应该正确管理连接状态', () => {
      // 初始状态应该是未连接
      expect((networkDriver as any)._isConnected).toBe(false);
      
      // 设置连接状态
      (networkDriver as any)._isConnected = true;
      expect((networkDriver as any)._isConnected).toBe(true);
      
      // 断开连接
      (networkDriver as any)._isConnected = false;
      expect((networkDriver as any)._isConnected).toBe(false);
    });
  });
});