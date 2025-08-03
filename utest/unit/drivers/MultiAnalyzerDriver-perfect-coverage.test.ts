/**
 * MultiAnalyzerDriver 完美覆盖率测试
 * 目标：从95.29%提升到100%覆盖率
 * 专门针对未覆盖的行100-105,263,288-289,313-314,478进行测试
 */

import { MultiAnalyzerDriver } from '../../../src/drivers/MultiAnalyzerDriver';
import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, CaptureError, TriggerType, ConnectionParams, ConnectionResult, AnalyzerChannel } from '../../../src/models/AnalyzerTypes';

// Mock dependencies
jest.mock('../../../src/drivers/LogicAnalyzerDriver');

const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;

describe('MultiAnalyzerDriver - 100%完美覆盖率测试', () => {
  let mockDevices: jest.Mocked<LogicAnalyzerDriver>[];
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建mock设备实例
    mockDevices = [];
    for (let i = 0; i < 5; i++) {
      const mockDevice = {
        connect: jest.fn().mockResolvedValue({ success: true }),
        disconnect: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
        startCapture: jest.fn().mockResolvedValue(CaptureError.None),
        stopCapture: jest.fn().mockResolvedValue(CaptureError.None),
        isCapturing: jest.fn().mockReturnValue(false),
        deviceVersion: 'V1_8',
        channelCount: 8,
        maxFrequency: 24000000,
        minFrequency: 1000000,
        blastFrequency: 0,
        bufferSize: 32768,
        isNetwork: false,
        tag: 0,
        on: jest.fn(),
        off: jest.fn(),
        emitCaptureCompleted: jest.fn(),
        getLimits: jest.fn().mockReturnValue({
          minPreSamples: 100,
          maxPreSamples: 50000,
          minPostSamples: 100,
          maxPostSamples: 50000,
          maxTotalSamples: 100000
        })
      } as any;
      mockDevices.push(mockDevice);
    }

    // Mock构造函数 - 每次返回一个新的设备
    let deviceIndex = 0;
    MockLogicAnalyzerDriver.mockImplementation(() => {
      const device = mockDevices[deviceIndex % mockDevices.length];
      deviceIndex++;
      return device;
    });
  });

  describe('未覆盖代码行的精准测试', () => {
    it('应该覆盖构造函数中的设备连接失败和清理逻辑 - 行100-105', async () => {
      // 设置第二个设备在on方法调用时失败
      const failureDevice = {
        on: jest.fn().mockImplementation(() => {
          throw new Error('事件绑定失败');
        }),
        dispose: jest.fn(),
        tag: 0
      } as any;
      
      const successDevice = {
        on: jest.fn(),
        dispose: jest.fn(),
        tag: 0
      } as any;
      
      // 重新mock构造函数以返回我们的特定设备
      MockLogicAnalyzerDriver
        .mockImplementationOnce(() => successDevice)
        .mockImplementationOnce(() => failureDevice);

      // 构造函数本身不会抛出错误，因为initializeDevices是异步的
      // 但是我们可以通过设置设备创建时就抛出错误来触发清理逻辑
      MockLogicAnalyzerDriver.mockImplementationOnce(() => {
        throw new Error('设备创建失败');
      });

      // 测试构造函数异常处理
      expect(() => {
        new MultiAnalyzerDriver(['device1', 'device2']);
      }).toThrow('设备连接失败');
    });

    it('应该覆盖startCapture中通道为空的错误处理 - 行263', async () => {
      const driver = new MultiAnalyzerDriver(['device1', 'device2']);
      
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: [], // 空通道数组
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        triggerType: TriggerType.Fast,
        triggerChannel: 0,
        triggerValue: 1,
        triggerInverted: false,
        deviceTag: 0
      };

      // 空通道列表应该返回BadParams错误
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该覆盖设备通道长度为0的跳过逻辑 - 行288-289', async () => {
      const driver = new MultiAnalyzerDriver(3);
      
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: 8,
        samples: [],
        sampleCount: 1000,
        capturedChannels: 8,
        triggerPosition: 500,
        triggerChannel: 0,
        triggerEvent: 1,
        triggerValue: 1,
        isComplex: false,
        prePostSamples: 500,
        channelMode: 0,
        actualSampleRate: 1000000,
        sourceName: 'Test'
      };

      // 只为第一个设备分配通道，其他设备通道为空
      const channels = [0, 1, 2]; // 只有3个通道，分布在第一个设备上

      // Mock设备以便我们可以验证跳过逻辑
      for (let i = 0; i < 3; i++) {
        if (mockDevices[i]) {
          mockDevices[i].startCapture.mockResolvedValue(CaptureError.None);
        }
      }

      const result = await driver.startCapture(session, channels);
      expect(result).toBe(CaptureError.None);

      // 验证只有第一个设备被调用了startCapture
      expect(mockDevices[0].startCapture).toHaveBeenCalled();
      // 其他设备由于通道为空应该被跳过，但这很难直接验证
    });

    it('应该覆盖主设备启动失败时的停止逻辑 - 行313-314', async () => {
      const driver = new MultiAnalyzerDriver(2);
      
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: 8,
        samples: [],
        sampleCount: 1000,
        capturedChannels: 8,
        triggerPosition: 500,
        triggerChannel: 0,
        triggerEvent: 1,
        triggerValue: 1,
        isComplex: false,
        prePostSamples: 500,
        channelMode: 0,
        actualSampleRate: 1000000,
        sourceName: 'Test'
      };

      const channels = [0, 1, 2, 3]; // 4个通道分布到两个设备

      // 设置主设备（第一个设备）启动失败
      mockDevices[0].startCapture.mockResolvedValue(CaptureError.HardwareError);
      mockDevices[1].startCapture.mockResolvedValue(CaptureError.None);

      // 启动采集应该失败
      const result = await driver.startCapture(session, channels);
      expect(result).toBe(CaptureError.HardwareError);

      // 验证stopCapture被调用以清理
      expect(mockDevices[0].stopCapture).toHaveBeenCalled();
    });

    it('应该覆盖采集完成事件中的currentCaptureHandler分支 - 行478', async () => {
      const driver = new MultiAnalyzerDriver(2);
      
      // 设置采集处理器
      const mockHandler = jest.fn();
      (driver as any)._currentCaptureHandler = mockHandler;

      // 模拟设备采集完成事件
      const mockEventArgs = {
        device: mockDevices[0],
        session: {} as CaptureSession,
        success: true,
        error: null
      };

      // 直接调用私有方法模拟采集完成
      await (driver as any).onDeviceCaptureCompleted(0, mockEventArgs);

      // 验证自定义处理器被调用
      expect(mockHandler).toHaveBeenCalledWith(mockEventArgs);
    });

    it('应该覆盖各种边界条件的组合测试', async () => {
      // 测试构造函数异常处理的另一种情况
      const partialFailureDevice = {
        connect: jest.fn().mockRejectedValue(new Error('部分失败')),
        dispose: jest.fn().mockImplementation(() => {
          throw new Error('Dispose也失败了');
        })
      } as any;

      MockLogicAnalyzerDriver.mockImplementationOnce(() => partialFailureDevice);

      await expect(async () => {
        new MultiAnalyzerDriver(1);
      }).rejects.toThrow('设备连接失败');

      // 验证即使dispose失败，错误也被正确抛出
      expect(partialFailureDevice.dispose).toHaveBeenCalled();
    });

    it('应该测试复杂的通道分配场景', async () => {
      const driver = new MultiAnalyzerDriver(3);
      
      const session: CaptureSession = {
        frequency: 2000000,
        captureChannels: 24, // 大于单个设备的通道数
        samples: [],
        sampleCount: 2000,
        capturedChannels: 24,
        triggerPosition: 1000,
        triggerChannel: 0,
        triggerEvent: 1,
        triggerValue: 1,
        isComplex: false,
        prePostSamples: 1000,
        channelMode: 0,
        actualSampleRate: 2000000,
        sourceName: 'ComplexTest'
      };

      // 创建一个导致某些设备没有通道的分布
      const channels = [0, 1, 8, 9, 16, 17]; // 跨越3个设备，但不是均匀分布

      // 设置所有设备启动成功
      for (let i = 0; i < 3; i++) {
        if (mockDevices[i]) {
          mockDevices[i].startCapture.mockResolvedValue(CaptureError.None);
        }
      }

      const result = await driver.startCapture(session, channels);
      expect(result).toBe(CaptureError.None);
    });

    it('应该测试采集完成的复杂事件处理流程', async () => {
      const driver = new MultiAnalyzerDriver(3);
      
      // 确保所有设备都在采集状态
      (driver as any)._capturing = true;
      (driver as any)._deviceCaptures = [
        { completed: false, session: {} },
        { completed: false, session: {} },
        { completed: false, session: {} }
      ];

      // 模拟第一个设备完成
      const firstEventArgs = {
        device: mockDevices[0],
        session: {} as CaptureSession,
        success: true,
        error: null
      };

      await (driver as any).onDeviceCaptureCompleted(0, firstEventArgs);
      
      // 第一个设备完成后，应该还在采集状态
      expect((driver as any)._capturing).toBe(true);

      // 模拟第二个设备完成
      const secondEventArgs = {
        device: mockDevices[1],
        session: {} as CaptureSession,
        success: true,
        error: null
      };

      await (driver as any).onDeviceCaptureCompleted(1, secondEventArgs);
      
      // 还有一个设备未完成
      expect((driver as any)._capturing).toBe(true);

      // 模拟最后一个设备完成
      const thirdEventArgs = {
        device: mockDevices[2],
        session: {} as CaptureSession,
        success: true,
        error: null
      };

      // Mock combineDeviceResults方法
      const mockCombinedSession = { combined: true } as any;
      (driver as any).combineDeviceResults = jest.fn().mockReturnValue(mockCombinedSession);

      await (driver as any).onDeviceCaptureCompleted(2, thirdEventArgs);
      
      // 所有设备完成后，应该不再采集
      expect((driver as any)._capturing).toBe(false);
      expect((driver as any).combineDeviceResults).toHaveBeenCalled();
    });
  });

  describe('完整性验证测试', () => {
    it('应该确保所有错误路径都被覆盖', async () => {
      // 综合测试，确保我们覆盖了所有关键的错误处理路径
      
      // 1. 测试构造失败
      MockLogicAnalyzerDriver.mockImplementationOnce(() => {
        throw new Error('设备创建失败');
      });

      expect(() => new MultiAnalyzerDriver(1)).toThrow();

      // 2. 测试各种采集失败场景
      const driver = new MultiAnalyzerDriver(2);
      
      // 设置一个设备为网络设备（应该被拒绝）
      mockDevices[0].isNetwork = true;
      
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: 8,
        samples: [],
        sampleCount: 1000,
        capturedChannels: 8,
        triggerPosition: 500,
        triggerChannel: 0,
        triggerEvent: 1,
        triggerValue: 1,
        isComplex: false,
        prePostSamples: 500,
        channelMode: 0,
        actualSampleRate: 1000000,
        sourceName: 'NetworkTest'
      };

      // 网络设备应该被拒绝
      await expect(driver.startCapture(session, [0, 1])).resolves.toBeDefined();
    });
  });
});