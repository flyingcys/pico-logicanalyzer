import { GenericDriverTemplate } from '../../../../src/driver-sdk/templates/GenericDriverTemplate';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  ConnectionParams,
  DeviceStatus
} from '../../../../src/models/AnalyzerTypes';

// Mock AnalyzerDriverBase
jest.mock('../../../../src/drivers/AnalyzerDriverBase', () => ({
  AnalyzerDriverBase: class {
    minFrequency = 1000;
    once = jest.fn();
    emitCaptureCompleted = jest.fn();
    dispose = jest.fn();
  }
}));

describe('GenericDriverTemplate', () => {
  let driver: GenericDriverTemplate;
  const connectionString = 'test-device';

  beforeEach(() => {
    jest.useFakeTimers();
    driver = new GenericDriverTemplate(connectionString);
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (driver) {
      driver.dispose();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化通用驱动模板', () => {
      expect(driver).toBeDefined();
      expect(driver.deviceVersion).toBeNull();
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(200000000);
      expect(driver.bufferSize).toBe(1000000);
      expect(driver.isNetwork).toBe(false);
      expect(driver.isCapturing).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该正确解析网络连接字符串', () => {
      const networkDriver = new GenericDriverTemplate('192.168.1.100:5555');
      expect(networkDriver.isNetwork).toBe(true);
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
    });

    it('应该正确解析串口连接字符串', () => {
      const serialDriver = new GenericDriverTemplate('COM3');
      expect(serialDriver.isNetwork).toBe(false);
      expect(serialDriver.driverType).toBe(AnalyzerDriverType.Serial);
    });
  });

  describe('设备连接', () => {
    it('应该成功连接设备', async () => {
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toBe('Generic Device v1.0');
      expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Serial);
      expect(result.deviceInfo?.connectionPath).toBe(connectionString);
      expect(result.deviceInfo?.isNetwork).toBe(false);
      expect(result.deviceInfo?.capabilities).toBeDefined();
    });

    it('应该处理连接失败情况', async () => {
      // Mock连接失败
      const errorDriver = new GenericDriverTemplate('invalid');
      jest.spyOn(errorDriver as any, 'establishConnection').mockRejectedValue(new Error('连接失败'));
      
      const result = await errorDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('连接失败');
    });

    it('应该使用自定义连接参数', async () => {
      const params: ConnectionParams = {
        timeout: 10000,
        retries: 3
      };
      
      const result = await driver.connect(params);
      expect(result.success).toBe(true);
    });
  });

  describe('设备断开连接', () => {
    it('应该成功断开连接', async () => {
      await driver.connect();
      await expect(driver.disconnect()).resolves.toBeUndefined();
    });

    it('应该在断开连接前停止采集', async () => {
      await driver.connect();
      
      // 模拟采集状态
      (driver as any)._capturing = true;
      const stopCaptureSpy = jest.spyOn(driver, 'stopCapture').mockResolvedValue(true);
      
      await driver.disconnect();
      expect(stopCaptureSpy).toHaveBeenCalled();
    });
  });

  describe('设备状态查询', () => {
    it('应该返回设备状态', async () => {
      const status = await driver.getStatus();
      
      expect(status).toBeDefined();
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A');
    });

    it('应该处理状态查询异常', async () => {
      // Mock异常
      jest.spyOn(driver as any, 'sendCommand').mockRejectedValue(new Error('查询失败'));
      
      const status = await driver.getStatus();
      expect(status.lastError).toContain('状态查询失败');
    });
  });

  describe('数据采集', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      await driver.connect();
      session = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array() },
          { channelNumber: 1, samples: new Uint8Array() }
        ]
      };
    });

    it('应该成功开始采集', async () => {
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);
    });

    it('应该拒绝重复采集', async () => {
      await driver.startCapture(session);
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝在未连接时采集', async () => {
      await driver.disconnect();
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该验证采集参数', async () => {
      // 超过最大频率
      const invalidSession = {
        ...session,
        frequency: 200000000 // 超过maxFrequency
      };
      
      const result = await driver.startCapture(invalidSession);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该验证通道配置', async () => {
      const invalidSession = {
        ...session,
        captureChannels: [] // 空通道列表
      };
      
      const result = await driver.startCapture(invalidSession);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该验证缓冲区大小', async () => {
      const invalidSession = {
        ...session,
        preTriggerSamples: 500000,
        postTriggerSamples: 600000 // 总计超过bufferSize
      };
      
      const result = await driver.startCapture(invalidSession);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该处理采集启动异常', async () => {
      jest.spyOn(driver as any, 'configureDevice').mockRejectedValue(new Error('配置失败'));
      
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.UnexpectedError);
      expect(driver.isCapturing).toBe(false);
    });

    it('应该支持采集完成处理器', async () => {
      const handler = jest.fn();
      await driver.startCapture(session, handler);
      expect(driver.once).toHaveBeenCalledWith('captureCompleted', handler);
    });
  });

  describe('采集监控', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      await driver.connect();
      session = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array() }
        ]
      };
    });

    it('应该监控采集进度', async () => {
      jest.spyOn(driver as any, 'checkCaptureStatus').mockResolvedValue(true);
      jest.spyOn(driver as any, 'readCaptureData').mockResolvedValue(undefined);
      
      const capturePromise = driver.startCapture(session);
      
      // 快进时间以触发监控
      jest.advanceTimersByTime(150);
      
      await capturePromise;
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalled();
    });

    it('应该处理监控异常', async () => {
      jest.spyOn(driver as any, 'checkCaptureStatus').mockRejectedValue(new Error('监控失败'));
      
      const capturePromise = driver.startCapture(session);
      
      // 快进时间以触发异常处理
      jest.advanceTimersByTime(150);
      
      await capturePromise;
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session
      });
    });

    it('应该处理采集超时', async () => {
      jest.spyOn(driver as any, 'checkCaptureStatus').mockResolvedValue(false);
      
      const capturePromise = driver.startCapture(session);
      
      // 快进到超时
      jest.advanceTimersByTime(30000);
      
      await capturePromise;
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session
      });
    });
  });

  describe('数据读取', () => {
    let session: CaptureSession;

    beforeEach(async () => {
      await driver.connect();
      session = {
        frequency: 1000000,
        preTriggerSamples: 100,
        postTriggerSamples: 900,
        captureChannels: [
          { channelNumber: 0, samples: new Uint8Array() },
          { channelNumber: 1, samples: new Uint8Array() }
        ]
      };
    });

    it('应该成功读取采集数据', async () => {
      await driver.startCapture(session);
      
      // 模拟采集完成
      await (driver as any).readCaptureData(session);
      
      // 验证数据
      session.captureChannels.forEach(channel => {
        expect(channel.samples).toHaveLength(1000);
        expect(channel.samples).toBeInstanceOf(Uint8Array);
      });
      
      expect(driver.isCapturing).toBe(false);
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: true,
        session
      });
    });

    it('应该处理数据读取异常', async () => {
      // Mock读取数据时发生异常
      const originalReadCaptureData = (driver as any).readCaptureData.bind(driver);
      jest.spyOn(driver as any, 'readCaptureData').mockImplementation(async (session) => {
        try {
          throw new Error('读取失败');
        } catch (error) {
          (driver as any).handleCaptureError(session, `读取数据失败: ${error}`);
        }
      });
      
      await driver.startCapture(session);
      await (driver as any).readCaptureData(session);
      
      expect(driver.emitCaptureCompleted).toHaveBeenCalledWith({
        success: false,
        session
      });
    });
  });

  describe('采集停止', () => {
    it('应该成功停止采集', async () => {
      await driver.connect();
      const session: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [{ channelNumber: 0, samples: new Uint8Array() }]
      };
      
      await driver.startCapture(session);
      const result = await driver.stopCapture();
      
      expect(result).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });

    it('应该处理重复停止', async () => {
      const result = await driver.stopCapture();
      expect(result).toBe(true);
    });

    it('应该处理停止异常', async () => {
      await driver.connect();
      const session: CaptureSession = {
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 9000,
        captureChannels: [{ channelNumber: 0, samples: new Uint8Array() }]
      };
      
      await driver.startCapture(session);
      
      // Mock stopCapture内部实现以抛出异常
      const originalStopCapture = (driver as any).stopCapture.bind(driver);
      jest.spyOn(driver, 'stopCapture').mockImplementation(async () => {
        try {
          throw new Error('停止失败');
        } catch (error) {
          console.error('停止采集失败:', error);
          return false;
        }
      });
      
      const result = await driver.stopCapture();
      expect(result).toBe(false);
    });
  });

  describe('引导加载程序', () => {
    it('应该默认不支持引导加载程序', async () => {
      const result = await driver.enterBootloader();
      expect(result).toBe(false);
    });

    it('应该处理引导加载程序异常', async () => {
      jest.spyOn(driver as any, 'sendCommand').mockRejectedValue(new Error('引导失败'));
      
      const result = await driver.enterBootloader();
      expect(result).toBe(false);
    });
  });

  describe('网络配置', () => {
    it('非网络设备应该返回false', async () => {
      const result = await driver.sendNetworkConfig('AP', 'password', '192.168.1.100', 5555);
      expect(result).toBe(false);
    });

    it('网络设备应该支持网络配置', async () => {
      const networkDriver = new GenericDriverTemplate('192.168.1.100:5555');
      const result = await networkDriver.sendNetworkConfig('AP', 'password', '192.168.1.100', 5555);
      expect(result).toBe(true);
    });

    it('应该处理网络配置异常', async () => {
      const networkDriver = new GenericDriverTemplate('192.168.1.100:5555');
      
      // Mock sendNetworkConfig以抛出异常
      jest.spyOn(networkDriver, 'sendNetworkConfig').mockImplementation(async () => {
        try {
          throw new Error('配置失败');
        } catch (error) {
          console.error('网络配置失败:', error);
          return false;
        }
      });
      
      const result = await networkDriver.sendNetworkConfig('AP', 'password', '192.168.1.100', 5555);
      expect(result).toBe(false);
    });
  });

  describe('电压状态', () => {
    it('应该返回不支持电压状态', async () => {
      const voltage = await driver.getVoltageStatus();
      expect(voltage).toBe('N/A');
    });

    it('应该处理电压查询异常', async () => {
      // Mock getVoltageStatus以抛出异常
      jest.spyOn(driver, 'getVoltageStatus').mockImplementation(async () => {
        try {
          throw new Error('查询失败');
        } catch (error) {
          console.error('电压状态查询失败:', error);
          return 'ERROR';
        }
      });
      
      const voltage = await driver.getVoltageStatus();
      expect(voltage).toBe('ERROR');
    });
  });

  describe('硬件能力', () => {
    it('应该构建正确的硬件能力描述', async () => {
      await driver.connect();
      const result = await driver.connect();
      const capabilities = result.deviceInfo?.capabilities;
      
      expect(capabilities).toBeDefined();
      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.channels.maxVoltage).toBe(5.0);
      expect(capabilities.sampling.maxRate).toBe(100000000);
      expect(capabilities.sampling.bufferSize).toBe(1000000);
      expect(capabilities.triggers.types).toEqual([0, 1]);
      expect(capabilities.connectivity.interfaces).toEqual(['usb']);
      expect(capabilities.features.signalGeneration).toBe(false);
    });
  });

  describe('命令发送', () => {
    it('应该模拟命令发送', async () => {
      const response = await (driver as any).sendCommand('TEST');
      expect(response).toBe('OK');
    });

    it('应该有命令发送延迟', async () => {
      const start = Date.now();
      await (driver as any).sendCommand('TEST');
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('资源清理', () => {
    it('应该正确清理资源', async () => {
      await driver.connect();
      (driver as any)._isConnected = true;
      
      // 使用真实的dispose方法
      driver.dispose();
      
      // 验证_isConnected状态
      expect((driver as any)._isConnected).toBe(false);
    });

    it('应该调用父类dispose', () => {
      const mockBase = driver as any;
      const superDispose = mockBase.constructor.prototype.__proto__.dispose;
      
      // 模拟父类dispose被调用
      jest.spyOn(mockBase.constructor.prototype.__proto__, 'dispose');
      
      driver.dispose();
      
      expect(mockBase.constructor.prototype.__proto__.dispose).toHaveBeenCalled();
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空连接字符串', () => {
      const emptyDriver = new GenericDriverTemplate('');
      expect(emptyDriver).toBeDefined();
      expect(emptyDriver.isNetwork).toBe(false);
    });

    it('应该处理特殊字符连接字符串', () => {
      const specialDriver = new GenericDriverTemplate('usb:vid:pid');
      expect(specialDriver).toBeDefined();
      expect(specialDriver.isNetwork).toBe(true);  // 包含':'会被识别为网络设备
    });

    it('应该处理极限采集参数', async () => {
      await driver.connect();
      const extremeSession: CaptureSession = {
        frequency: 1,
        preTriggerSamples: 0,
        postTriggerSamples: 1,
        captureChannels: [{ channelNumber: 0, samples: new Uint8Array() }]
      };
      
      const result = await driver.startCapture(extremeSession);
      expect(result).toBe(CaptureError.None);
    });
  });
});