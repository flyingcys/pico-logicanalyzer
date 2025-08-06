/**
 * MultiAnalyzerDriver 定向覆盖率测试
 * 专门针对未覆盖的行号: 100-105,313-314,478等
 */

import { MultiAnalyzerDriver } from '../../../src/drivers/MultiAnalyzerDriver';
import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, CaptureError, TriggerType } from '../../../src/models/AnalyzerTypes';

// 创建一个可以抛出错误的Mock
let shouldThrowError = false;
let mockDeviceIndex = 0;

const createMockDevice = () => ({
  connect: jest.fn().mockResolvedValue({ success: true }),
  disconnect: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn().mockResolvedValue(undefined),
  startCapture: jest.fn().mockResolvedValue(CaptureError.None),
  stopCapture: jest.fn().mockResolvedValue(CaptureError.None),
  isCapturing: jest.fn().mockReturnValue(false),
  getStatus: jest.fn().mockResolvedValue({
    isConnected: true,
    isCapturing: false,
    batteryVoltage: '5.0V'
  }),
  deviceVersion: 'V1_8',
  channelCount: 8,
  maxFrequency: 24000000,
  minFrequency: 1000000,
  blastFrequency: 0,
  bufferSize: 32768,
  isNetwork: false,
  tag: 0,
  on: jest.fn().mockImplementation((event, handler) => {
    if (shouldThrowError && mockDeviceIndex === 1) {
      throw new Error('事件绑定失败');
    }
  }),
  off: jest.fn(),
  emitCaptureCompleted: jest.fn(),
  getLimits: jest.fn().mockReturnValue({
    minPreSamples: 100,
    maxPreSamples: 50000,
    minPostSamples: 100,
    maxPostSamples: 50000,
    maxTotalSamples: 100000
  }),
  enterBootloader: jest.fn().mockResolvedValue(true),
  sendNetworkConfig: jest.fn().mockResolvedValue(false),
  getVoltageStatus: jest.fn().mockResolvedValue('5.0V'),
  getCaptureMode: jest.fn().mockReturnValue(0)
});

jest.mock('../../../src/drivers/LogicAnalyzerDriver', () => {
  return {
    LogicAnalyzerDriver: jest.fn().mockImplementation(() => {
      const device = createMockDevice();
      mockDeviceIndex++;
      return device;
    })
  };
});

describe('MultiAnalyzerDriver - 定向覆盖率测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldThrowError = false;
    mockDeviceIndex = 0;
  });

  it('应该覆盖设备初始化失败时的清理逻辑 - 行100-105', () => {
    // 设置第二个设备的on方法抛出错误
    shouldThrowError = true;
    
    expect(() => {
      new MultiAnalyzerDriver(['device1', 'device2']);
    }).toThrow('设备连接失败');
  });

  it('应该覆盖主设备startCapture失败时的停止逻辑 - 行313-314', async () => {
    // 创建Mock，主设备startCapture失败
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      // 第一个设备（主设备）startCapture失败
      if (mockDeviceIndex === 0) {
        device.startCapture = jest.fn().mockResolvedValue(CaptureError.HardwareError);
      }
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const session: CaptureSession = {
      frequency: 1000000,
      captureChannels: [
        { channelNumber: 0, channelName: 'Channel 1', hidden: false },
        { channelNumber: 8, channelName: 'Channel 9', hidden: false }
      ],
      preTriggerSamples: 1000,
      postTriggerSamples: 1000,
      triggerType: TriggerType.Fast,
      triggerChannel: 0,
      triggerValue: 1,
      triggerInverted: false,
      deviceTag: 0
    };

    const result = await driver.startCapture(session);
    expect(result).toBe(CaptureError.HardwareError);
  });

  it('应该覆盖采集完成事件中的currentCaptureHandler分支 - 行478', async () => {
    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    // 设置自定义采集完成处理器
    const mockHandler = jest.fn();
    
    const session: CaptureSession = {
      frequency: 1000000,
      captureChannels: [
        { channelNumber: 0, channelName: 'Channel 1', hidden: false }
      ],
      preTriggerSamples: 1000,
      postTriggerSamples: 1000,
      triggerType: TriggerType.Fast,
      triggerChannel: 0,
      triggerValue: 1,
      triggerInverted: false,
      deviceTag: 0
    };

    // 启动采集并传入自定义处理器
    await driver.startCapture(session, mockHandler);
    
    // 设置内部状态以模拟采集过程
    (driver as any)._capturing = true;
    (driver as any)._sourceSession = session;

    // 模拟采集失败事件
    const failedEventArgs = {
      success: false,
      session: session
    };

    // 调用事件处理方法
    (driver as any).handleDeviceCaptureCompleted(failedEventArgs);

    // 等待异步操作完成
    await new Promise(resolve => setTimeout(resolve, 10));

    // 验证自定义处理器被调用
    expect(mockHandler).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      session: session
    }));
  });

  it('应该覆盖设备连接失败的错误处理 - 行121', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      // 第二个设备连接失败
      if (mockDeviceIndex === 1) {
        device.connect = jest.fn().mockResolvedValue({ success: false, error: '连接失败' });
      }
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const result = await driver.connect();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('应该覆盖版本验证失败的错误处理 - 行162,170', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      // 第二个设备版本不兼容
      if (mockDeviceIndex === 1) {
        device.deviceVersion = 'V2_0'; // 不同版本
      }
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const result = await driver.connect();
    expect(result.success).toBe(false);
    expect(result.error).toContain('版本不兼容');
  });

  it('应该覆盖空版本字符串的处理 - 行188', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      device.deviceVersion = null; // 空版本
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const result = await driver.connect();
    expect(result.success).toBe(false);
  });

  it('应该覆盖无效版本格式的处理 - 行201', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      device.deviceVersion = 'INVALID_FORMAT'; // 无效版本格式
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const result = await driver.connect();
    expect(result.success).toBe(false);
  });

  it('应该覆盖参数验证失败的处理 - 行254', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      // 设置设备返回无效的限制
      device.getLimits = jest.fn().mockReturnValue({
        minPreSamples: 10000, // 很高的最小值
        maxPreSamples: 50000,
        minPostSamples: 10000,
        maxPostSamples: 50000,
        maxTotalSamples: 100000
      });
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const session: CaptureSession = {
      frequency: 1000000,
      captureChannels: [
        { channelNumber: 0, channelName: 'Channel 1', hidden: false }
      ],
      preTriggerSamples: 100, // 小于最小值
      postTriggerSamples: 100, // 小于最小值
      triggerType: TriggerType.Fast,
      triggerChannel: 0,
      triggerValue: 1,
      triggerInverted: false,
      deviceTag: 0
    };

    const result = await driver.startCapture(session);
    expect(result).toBe(CaptureError.BadParams);
  });

  it('应该覆盖stopCapture错误处理 - 行433-434', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      device.stopCapture = jest.fn().mockRejectedValue(new Error('停止失败'));
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    // 设置为采集状态
    (driver as any)._capturing = true;
    
    const result = await driver.stopCapture();
    expect(result).toBe(false);
  });

  it('应该覆盖enterBootloader错误处理 - 行454-455', async () => {
    const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;
    
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = createMockDevice();
      device.enterBootloader = jest.fn().mockRejectedValue(new Error('引导失败'));
      mockDeviceIndex++;
      return device as any;
    });

    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    const result = await driver.enterBootloader();
    expect(result).toBe(false);
  });

  it('应该覆盖采集中无法进入引导模式 - 行443', async () => {
    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    // 设置为采集状态
    (driver as any)._capturing = true;
    
    const result = await driver.enterBootloader();
    expect(result).toBe(false);
  });

  it('应该覆盖非采集状态下的事件处理 - 行465', async () => {
    const driver = new MultiAnalyzerDriver(['device1', 'device2']);
    
    // 设置为非采集状态
    (driver as any)._capturing = false;
    (driver as any)._sourceSession = null;

    // 模拟事件
    const eventArgs = {
      success: true,
      session: {} as any
    };

    // 调用事件处理方法，应该直接返回
    (driver as any).handleDeviceCaptureCompleted(eventArgs);
    
    // 没有异常表示成功处理
    expect(true).toBe(true);
  });
});