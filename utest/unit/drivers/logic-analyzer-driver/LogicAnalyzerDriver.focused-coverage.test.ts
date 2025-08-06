import { LogicAnalyzerDriver } from '../../../../src/drivers/LogicAnalyzerDriver';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { Socket } from 'net';
import { VersionValidator } from '../../../../src/drivers/VersionValidator';
import {
  CaptureSession,
  TriggerType,
  CaptureError,
  AnalyzerChannel
} from '../../../../src/models/AnalyzerTypes';

// Mock dependencies
jest.mock('serialport');
jest.mock('@serialport/parser-readline');
jest.mock('net');
jest.mock('../../../../src/drivers/VersionValidator');

const MockedSerialPort = SerialPort as jest.MockedClass<typeof SerialPort>;
const MockedReadlineParser = ReadlineParser as jest.MockedClass<typeof ReadlineParser>;
const MockedSocket = Socket as jest.MockedClass<typeof Socket>;
const MockedVersionValidator = VersionValidator as jest.MockedClass<typeof VersionValidator>;

describe('LogicAnalyzerDriver 专项覆盖率测试', () => {
  let driver: LogicAnalyzerDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    MockedVersionValidator.getVersion.mockReturnValue({ isValid: true });
    MockedVersionValidator.getMinimumVersionString.mockReturnValue('1.0.0');
  });

  describe('基础功能测试', () => {
    it('应该正确识别网络设备类型', () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      expect(driver.driverType).toBeDefined();
    });

    it('应该正确识别串口设备类型', () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      expect(driver.driverType).toBeDefined();
    });

    it('应该处理空连接字符串错误', () => {
      expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
    });

    it('应该测试连接失败的网络地址解析', () => {
      // 同步测试，避免超时问题
      driver = new LogicAnalyzerDriver('invalid-format');
      // 直接测试内部地址解析逻辑
      const result = LogicAnalyzerDriver['regAddressPort'].exec('invalid-format');
      expect(result).toBeNull();
    });

    it('应该测试无效端口号', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:99999');
      const result = await driver.connect();
      expect(result.success).toBe(false);
      expect(result.error).toContain('指定的端口号无效');
    });

    it('应该测试负端口号', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:-1');
      const result = await driver.connect();
      expect(result.success).toBe(false);
      expect(result.error).toContain('指定的地址/端口格式无效');
    });
  });

  describe('断开连接测试', () => {
    it('应该正确处理未连接时的断开', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      await driver.disconnect();
      // 应该没有抛出错误
      expect(true).toBe(true);
    });

    it('应该正确处理dispose调用', () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      driver.dispose();
      // 应该没有抛出错误
      expect(true).toBe(true);
    });
  });

  describe('设备状态测试', () => {
    it('应该为未连接设备返回正确状态', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      const status = await driver.getStatus();
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('DISCONNECTED');
    });

    it('应该为串口设备返回模拟电压', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      const voltage = await driver.getVoltageStatus();
      expect(voltage).toBe('DISCONNECTED');
    });
  });

  describe('采集参数测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('应该拒绝设备忙时的采集', async () => {
      const mockSession: CaptureSession = {
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        frequency: 10000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      // 模拟设备忙状态
      (driver as any)._capturing = true;

      const result = await driver.startCapture(mockSession);
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝未连接设备的采集', async () => {
      const mockSession: CaptureSession = {
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        frequency: 10000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const result = await driver.startCapture(mockSession);
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该正确处理未采集时的停止请求', async () => {
      const result = await driver.stopCapture();
      expect(result).toBe(true);
    });
  });

  describe('特殊功能测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('应该拒绝未连接设备的引导加载程序', async () => {
      const result = await driver.enterBootloader();
      expect(result).toBe(false);
    });

    it('应该为网络设备拒绝网络配置', async () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      // 模拟网络设备已连接状态
      (networkDriver as any)._isNetwork = true;

      const result = await networkDriver.sendNetworkConfig(
        'TestWiFi',
        'password123',
        '192.168.1.200',
        8080
      );
      expect(result).toBe(false);
    });
  });

  describe('内部方法测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('应该测试getCaptureMode方法', () => {
      const mode8 = (driver as any).getCaptureMode([0, 1, 2]);
      expect(mode8).toBe(0); // 8通道模式

      const mode16 = (driver as any).getCaptureMode([0, 1, 8, 9]);
      expect(mode16).toBe(1); // 16通道模式

      const mode24 = (driver as any).getCaptureMode([0, 1, 16, 17]);
      expect(mode24).toBe(2); // 24通道模式
    });

    it('应该测试getLimits方法', () => {
      // 设置一些默认值以便测试
      (driver as any)._bufferSize = 96000;

      const limits = (driver as any).getLimits([0, 1]);
      expect(limits.minPreSamples).toBe(2);
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPreSamples).toBeGreaterThan(0);
      expect(limits.maxPostSamples).toBeGreaterThan(0);
      expect(limits.maxTotalSamples).toBeGreaterThan(0);
    });

    it('应该测试validateSettings方法', () => {
      // 设置默认设备参数
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._blastFrequency = 200000000;
      (driver as any)._bufferSize = 96000;

      const validSession: CaptureSession = {
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        frequency: 10000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const isValid = (driver as any).validateSettings(validSession, 1100);
      expect(isValid).toBe(true);
    });

    it('应该测试buildCapabilities方法', () => {
      // 设置默认设备参数
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._blastFrequency = 200000000;
      (driver as any)._bufferSize = 96000;
      (driver as any)._isNetwork = false;

      const capabilities = (driver as any).buildCapabilities();
      expect(capabilities.channels.digital).toBe(24);
      expect(capabilities.sampling.maxRate).toBe(100000000);
      expect(capabilities.connectivity.interfaces).toContain('serial');
    });

    it('应该测试网络设备的能力构建', () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (networkDriver as any)._channelCount = 24;
      (networkDriver as any)._maxFrequency = 100000000;
      (networkDriver as any)._isNetwork = true;

      const capabilities = (networkDriver as any).buildCapabilities();
      expect(capabilities.connectivity.interfaces).toContain('ethernet');
    });

    it('应该为Edge触发构建正确的请求', () => {
      const session: CaptureSession = {
        triggerType: TriggerType.Edge,
        triggerChannel: 1,
        triggerInverted: true,
        frequency: 10000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 2,
        measureBursts: true,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel,
          { channelNumber: 1, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const request = (driver as any).composeRequest(session, 3100, 0);
      expect(request.triggerType).toBe(TriggerType.Edge);
      expect(request.trigger).toBe(1);
      expect(request.invertedOrCount).toBe(1);
      expect(request.triggerValue).toBe(0);
      expect(request.channelCount).toBe(2);
      expect(request.frequency).toBe(10000000);
      expect(request.loopCount).toBe(2);
      expect(request.measure).toBe(1);
    });

    it('应该为Blast触发构建正确的请求', () => {
      const session: CaptureSession = {
        triggerType: TriggerType.Blast,
        triggerChannel: 2,
        triggerInverted: false,
        frequency: 50000000,
        preTriggerSamples: 200,
        postTriggerSamples: 800,
        loopCount: 5,
        measureBursts: true,
        captureChannels: [
          { channelNumber: 2, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const request = (driver as any).composeRequest(session, 4200, 0);
      expect(request.triggerType).toBe(TriggerType.Blast);
      expect(request.trigger).toBe(2);
      expect(request.invertedOrCount).toBe(0);
      expect(request.loopCount).toBe(5);
      expect(request.measure).toBe(1);
    });

    it('应该为Complex触发构建带偏移的请求', () => {
      // 设置最大频率以计算偏移
      (driver as any)._maxFrequency = 100000000;

      const session: CaptureSession = {
        triggerType: TriggerType.Complex,
        triggerChannel: 0,
        triggerInverted: false,
        triggerBitCount: 8,
        triggerPattern: 0xAA,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const request = (driver as any).composeRequest(session, 1100, 0);
      expect(request.triggerType).toBe(TriggerType.Complex);
      expect(request.triggerValue).toBe(0xAA);
      expect(request.invertedOrCount).toBe(8);
      expect(request.loopCount).toBe(0);
      expect(request.measure).toBe(0);
      expect(request.preSamples).toBeGreaterThan(session.preTriggerSamples);
      expect(request.postSamples).toBeLessThan(session.postTriggerSamples);
    });

    it('应该为Fast触发构建带偏移的请求', () => {
      // 设置最大频率以计算偏移
      (driver as any)._maxFrequency = 100000000;

      const session: CaptureSession = {
        triggerType: TriggerType.Fast,
        triggerChannel: 2,
        triggerInverted: false,
        triggerBitCount: 3,
        triggerPattern: 0x5,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 2, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const request = (driver as any).composeRequest(session, 1100, 1);
      expect(request.triggerType).toBe(TriggerType.Fast);
      expect(request.triggerValue).toBe(0x5);
      expect(request.invertedOrCount).toBe(3);
      expect(request.trigger).toBe(2);
      expect(request.preSamples).toBeGreaterThan(session.preTriggerSamples);
      expect(request.postSamples).toBeLessThan(session.postTriggerSamples);
    });
  });

  describe('参数验证详细测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      // 设置默认设备参数
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._blastFrequency = 200000000;
      (driver as any)._bufferSize = 96000;
    });

    it('应该验证Blast触发的参数范围', () => {
      const blastSession: CaptureSession = {
        triggerType: TriggerType.Blast,
        triggerChannel: 0,
        triggerInverted: false,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 800,
        loopCount: 10, // 合理的循环次数
        measureBursts: true,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const requestedSamples = blastSession.preTriggerSamples + (blastSession.postTriggerSamples * (blastSession.loopCount + 1));
      const isValid = (driver as any).validateSettings(blastSession, requestedSamples);
      expect(isValid).toBe(true);
    });

    it('应该拒绝超出循环次数限制的Blast触发', () => {
      const invalidBlastSession: CaptureSession = {
        triggerType: TriggerType.Blast,
        triggerChannel: 0,
        triggerInverted: false,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 256, // 超出最大值255
        measureBursts: true,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const isValid = (driver as any).validateSettings(invalidBlastSession, 256100);
      expect(isValid).toBe(false);
    });

    it('应该验证Complex触发的位数限制', () => {
      const complexSession: CaptureSession = {
        triggerType: TriggerType.Complex,
        triggerChannel: 0,
        triggerInverted: false,
        triggerBitCount: 16, // 最大位数
        triggerPattern: 0xFFFF,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const isValid = (driver as any).validateSettings(complexSession, 1100);
      expect(isValid).toBe(true);
    });

    it('应该验证Fast触发的通道和位数组合', () => {
      const fastSession: CaptureSession = {
        triggerType: TriggerType.Fast,
        triggerChannel: 1, // 通道1 + 位数4 = 5 (在限制内)
        triggerInverted: false,
        triggerBitCount: 4,
        triggerPattern: 0xF,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 1, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const isValid = (driver as any).validateSettings(fastSession, 1100);
      expect(isValid).toBe(true);
    });

    it('应该拒绝超出通道范围的Fast触发', () => {
      const invalidFastSession: CaptureSession = {
        triggerType: TriggerType.Fast,
        triggerChannel: 3, // 通道3 + 位数3 = 6 (超出最大5)
        triggerInverted: false,
        triggerBitCount: 3,
        triggerPattern: 0x7,
        frequency: 50000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        measureBursts: false,
        captureChannels: [
          { channelNumber: 3, samples: new Uint8Array(0) } as AnalyzerChannel
        ]
      };

      const isValid = (driver as any).validateSettings(invalidFastSession, 1100);
      expect(isValid).toBe(false);
    });
  });

  describe('最小频率属性测试', () => {
    it('应该返回正确的最小频率', () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      // 设置最大频率以便计算最小频率
      (driver as any)._maxFrequency = 100000000; // 100MHz
      // minFrequency = floor((100000000 * 2) / 65535) = floor(3051.85) = 3051
      expect(driver.minFrequency).toBe(3051);
    });
  });
});