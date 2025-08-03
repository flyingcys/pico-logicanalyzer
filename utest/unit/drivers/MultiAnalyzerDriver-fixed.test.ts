/**
 * MultiAnalyzerDriver 修复版完美覆盖率测试
 * 目标：从95.29%提升到100%覆盖率
 * 专门针对未覆盖的行100-105,263,288-289,313-314,478进行测试
 */

import { MultiAnalyzerDriver } from '../../../src/drivers/MultiAnalyzerDriver';
import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, CaptureError, TriggerType, ConnectionParams, ConnectionResult, AnalyzerChannel } from '../../../src/models/AnalyzerTypes';

// 需要先Mock LogicAnalyzerDriver
jest.mock('../../../src/drivers/LogicAnalyzerDriver', () => {
  return {
    LogicAnalyzerDriver: jest.fn().mockImplementation(() => ({
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
    }))
  };
});

const MockLogicAnalyzerDriver = LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>;

describe('MultiAnalyzerDriver - 修复版100%完美覆盖率测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('未覆盖代码行的精准测试', () => {
    it('应该覆盖构造函数中的设备创建失败和清理逻辑 - 行100-105', () => {
      // 设置LogicAnalyzerDriver构造函数在第二次调用时抛出错误
      MockLogicAnalyzerDriver
        .mockImplementationOnce(() => ({
          on: jest.fn(),
          dispose: jest.fn(),
          tag: 0
        } as any))
        .mockImplementationOnce(() => {
          throw new Error('设备创建失败');
        });

      // 构造函数应该抛出错误
      expect(() => {
        new MultiAnalyzerDriver(['device1', 'device2']);
      }).toThrow('设备连接失败');
    });

    it('应该覆盖startCapture中第一个设备无通道的错误处理 - 行263', async () => {
      const driver = new MultiAnalyzerDriver(['device1', 'device2']);
      
      // 创建一个会话，所有通道都分配给第二个设备（8-15），第一个设备没有通道
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: [
          { channelNumber: 8, channelName: 'Channel 9', hidden: false },
          { channelNumber: 9, channelName: 'Channel 10', hidden: false }
        ],
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        triggerType: TriggerType.Fast,
        triggerChannel: 0,
        triggerValue: 1,
        triggerInverted: false,
        deviceTag: 0
      };

      // 应该返回BadParams错误，因为第一个设备没有分配到通道
      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该覆盖设备通道长度为0的跳过逻辑 - 行288-289', async () => {
      const driver = new MultiAnalyzerDriver(['device1', 'device2', 'device3']);
      
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: [
          { channelNumber: 0, channelName: 'Channel 1', hidden: false },
          { channelNumber: 1, channelName: 'Channel 2', hidden: false },
          // 只为第一个设备分配通道，第二、三个设备没有通道
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
      expect(result).toBe(CaptureError.None);
      
      // 验证只有第一个设备被调用了startCapture
      const mockInstances = MockLogicAnalyzerDriver.mock.instances;
      if (mockInstances.length > 0) {
        const firstDevice = mockInstances[0] as any;
        expect(firstDevice.startCapture).toHaveBeenCalled();
      }
    });

    it('应该覆盖主设备启动失败时的停止逻辑 - 行313-314', async () => {
      // 创建Mock设备，主设备启动失败
      MockLogicAnalyzerDriver.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue({ success: true }),
        disconnect: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
        startCapture: jest.fn().mockResolvedValue(CaptureError.HardwareError), // 主设备失败
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
        getLimits: jest.fn().mockReturnValue({
          minPreSamples: 100,
          maxPreSamples: 50000,
          minPostSamples: 100,
          maxPostSamples: 50000,
          maxTotalSamples: 100000
        })
      } as any));

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

      // 验证stopCapture被调用
      const mockInstances = MockLogicAnalyzerDriver.mock.instances;
      for (const instance of mockInstances) {
        expect((instance as any).stopCapture).toHaveBeenCalled();
      }
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
      
      // 模拟采集完成事件
      const mockEventArgs = {
        success: false,  // 失败的采集会触发不同的代码路径
        session: session
      };

      // 直接调用私有方法模拟设备采集完成
      (driver as any).handleDeviceCaptureCompleted(mockEventArgs);

      // 验证自定义处理器被调用
      expect(mockHandler).toHaveBeenCalled();
    });
  });

  describe('边界条件和完整性测试', () => {
    it('应该处理各种异常情况', async () => {
      // 测试无效连接字符串数量
      expect(() => new MultiAnalyzerDriver([])).toThrow('无效的设备数量');
      expect(() => new MultiAnalyzerDriver(['single'])).toThrow('无效的设备数量');
      expect(() => new MultiAnalyzerDriver(new Array(6).fill('device'))).toThrow('无效的设备数量');

      // 测试有效的设备数量
      const driver = new MultiAnalyzerDriver(['device1', 'device2']);
      expect(driver).toBeDefined();
    });

    it('应该正确处理Edge触发类型', async () => {
      const driver = new MultiAnalyzerDriver(['device1', 'device2']);
      
      const session: CaptureSession = {
        frequency: 1000000,
        captureChannels: [
          { channelNumber: 0, channelName: 'Channel 1', hidden: false }
        ],
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        triggerType: TriggerType.Edge, // 不支持的触发类型
        triggerChannel: 0,
        triggerValue: 1,
        triggerInverted: false,
        deviceTag: 0
      };

      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该正确处理正在采集状态', async () => {
      const driver = new MultiAnalyzerDriver(['device1', 'device2']);
      
      // 设置为正在采集状态
      (driver as any)._capturing = true;
      
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

      const result = await driver.startCapture(session);
      expect(result).toBe(CaptureError.Busy);
    });
  });
});