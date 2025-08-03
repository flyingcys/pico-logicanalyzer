/**
 * LogicAnalyzerDriver 覆盖率提升专项测试
 * 针对未覆盖代码路径的精准测试，目标达到95%+覆盖率
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel, TriggerType } from '../../../src/models/AnalyzerTypes';
import { VersionValidator } from '../../../src/drivers/VersionValidator';

// Mock SerialPort
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    open: jest.fn((callback) => callback && callback()),
    close: jest.fn((callback) => callback && callback()),
    write: jest.fn((data, callback) => callback && callback()),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    isOpen: true
  }))
}));

// Mock ReadlineParser
jest.mock('@serialport/parser-readline', () => ({
  ReadlineParser: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn()
  }))
}));

// Mock Socket
jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn()
  }))
}));

// Mock VersionValidator
jest.mock('../../../src/drivers/VersionValidator', () => ({
  VersionValidator: {
    validateVersion: jest.fn().mockReturnValue(true)
  },
  DeviceConnectionException: class extends Error {}
}));

// 设置假定时器以控制异步操作
jest.useFakeTimers();

describe('LogicAnalyzerDriver 覆盖率提升测试', () => {
  let driver: LogicAnalyzerDriver;
  let mockSerial: any;
  let mockSocket: any;
  let mockLineParser: any;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    jest.clearAllTimers();

    // 获取已经Mock的构造函数
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');
    const { Socket } = require('net');

    // 创建driver实例
    driver = new LogicAnalyzerDriver('COM3');
    
    // 获取Mock实例引用
    mockSerial = (SerialPort as jest.Mock).mock.results[SerialPort.mock.results.length - 1].value;
    mockLineParser = (ReadlineParser as jest.Mock).mock.results[ReadlineParser.mock.results.length - 1].value;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('事件回调处理测试 (覆盖187行)', () => {
    it('应该正确处理captureCompleted事件回调', async () => {
      // 设置设备属性
      (driver as any)._connected = true;
      (driver as any)._capturing = false;
      (driver as any)._version = '1.0.0';
      (driver as any)._channelCount = 8;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._bufferSize = 50000;
      (driver as any)._currentStream = mockSerial;

      // 创建采集会话
      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      // 创建回调函数
      const captureCompletedHandler = jest.fn();

      // Mock writeData方法
      jest.spyOn(driver as any, 'writeData').mockResolvedValue(true);
      
      // Mock startDataReading方法
      jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {
        // 模拟异步触发事件
        setTimeout(() => {
          driver.emit('captureCompleted', { session, data: new Uint8Array(100) });
        }, 100);
      });

      // Mock once方法以验证事件监听器注册
      const onceSpy = jest.spyOn(driver, 'once');

      // 启动采集
      await driver.startCapture(session, captureCompletedHandler);

      // 验证once方法被调用了（覆盖187行）
      expect(onceSpy).toHaveBeenCalledWith('captureCompleted', captureCompletedHandler);

      // 快进时间以触发事件
      jest.advanceTimersByTime(100);

      // 验证回调被调用
      expect(captureCompletedHandler).toHaveBeenCalled();
    });
  });

  describe('错误处理路径测试 (覆盖195-196行)', () => {
    it('应该在异常时正确处理错误并重置capturing状态', async () => {
      // 设置设备属性
      (driver as any)._connected = true;
      (driver as any)._capturing = false;
      (driver as any)._version = '1.0.0';
      (driver as any)._channelCount = 8;
      (driver as any)._currentStream = mockSerial;

      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      // Mock writeData抛出异常
      jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('通信错误'));

      // 启动采集
      const result = await driver.startCapture(session);

      // 验证错误处理（覆盖195-196行）
      expect(result).toBe(1); // CaptureError.UnexpectedError
      expect((driver as any)._capturing).toBe(false);
    });
  });

  describe('网络模式电压状态获取测试 (覆盖268-286行)', () => {
    it('应该正确处理网络设备的电压状态查询', async () => {
      // 创建网络设备
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._connected = true;
      (driver as any)._currentStream = mockSocket;
      (driver as any)._lineParser = mockLineParser;

      // Mock writeData方法
      jest.spyOn(driver as any, 'writeData').mockResolvedValue(true);

      // 启动异步操作
      const voltagePromise = driver.getVoltageStatus();

      // 模拟数据响应
      setTimeout(() => {
        const dataCallback = mockLineParser.once.mock.calls.find(
          call => call[0] === 'data'
        )?.[1];
        if (dataCallback) {
          dataCallback('3.3V');
        }
      }, 100);

      // 快进时间
      jest.advanceTimersByTime(100);

      const voltage = await voltagePromise;

      // 验证网络模式电压查询（覆盖268-286行）
      expect(voltage).toBe('3.3V');
      expect(mockLineParser.once).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('应该处理网络电压查询超时', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._connected = true;
      (driver as any)._currentStream = mockSocket;
      (driver as any)._lineParser = mockLineParser;

      jest.spyOn(driver as any, 'writeData').mockResolvedValue(true);

      const voltagePromise = driver.getVoltageStatus();

      // 快进到超时
      jest.advanceTimersByTime(5000);

      const voltage = await voltagePromise;

      // 验证超时处理（覆盖276-278行）
      expect(voltage).toBe('TIMEOUT');
    });

    it('应该处理网络电压查询异常', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._connected = true;
      (driver as any)._currentStream = mockSocket;

      // Mock writeData抛出异常
      jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('网络错误'));

      const voltage = await driver.getVoltageStatus();

      // 验证异常处理（覆盖285-286行）
      expect(voltage).toBe('ERROR');
    });
  });

  describe('数据读取流程测试 (覆盖623-762行)', () => {
    it('应该正确处理网络模式数据读取', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._connected = true;
      (driver as any)._currentStream = mockSocket;

      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel,
          { channelNumber: 1, channelName: 'Ch1' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      // 创建模拟数据
      const sampleCount = 2000;
      const timestampBytes = 16;
      const dataBuffer = Buffer.alloc(4 + sampleCount + timestampBytes);
      
      // 写入数据长度
      dataBuffer.writeUInt32LE(sampleCount + timestampBytes, 0);
      
      // 写入样本数据
      for (let i = 0; i < sampleCount; i++) {
        dataBuffer.writeUInt8(i % 256, 4 + i);
      }

      // 启动异步读取
      const readPromise = (driver as any).readCaptureData(session);

      // 模拟数据分块到达
      setTimeout(() => {
        const dataCallback = mockSocket.on.mock.calls.find(
          call => call[0] === 'data'
        )?.[1];
        
        if (dataCallback) {
          // 分两次发送数据来测试数据拼接逻辑
          dataCallback(dataBuffer.slice(0, 100));
          dataCallback(dataBuffer.slice(100));
        }
      }, 100);

      jest.advanceTimersByTime(100);

      const result = await readPromise;

      // 验证网络数据读取（覆盖645-700行）
      expect(result).toBeDefined();
      expect(result.samples).toBeInstanceOf(Uint32Array);
    });

    it('应该正确处理串口模式数据读取', async () => {
      (driver as any)._isNetwork = false;
      (driver as any)._connected = true;
      (driver as any)._currentStream = mockSerial;

      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      // 创建串口数据
      const sampleCount = 2000;
      const expectedLength = sampleCount + 16;
      const bufferData = Buffer.alloc(expectedLength + 6);

      // 写入分片头部
      bufferData.writeUInt16LE(0xAA55, 0);
      bufferData.writeUInt32LE(expectedLength, 2);

      // 启动异步读取
      const readPromise = (driver as any).readCaptureData(session);

      // 模拟串口数据到达
      setTimeout(() => {
        const dataCallback = mockSerial.on.mock.calls.find(
          call => call[0] === 'data'
        )?.[1];
        
        if (dataCallback) {
          dataCallback(bufferData);
        }
      }, 100);

      jest.advanceTimersByTime(100);

      const result = await readPromise;

      // 验证串口数据读取（覆盖700-763行）
      expect(result).toBeDefined();
    });

    it('应该处理数据读取超时', async () => {
      (driver as any)._connected = true;
      (driver as any)._currentStream = mockSerial;

      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      const readPromise = (driver as any).readCaptureData(session);

      // 快进到超时
      jest.advanceTimersByTime(60000);

      try {
        await readPromise;
        fail('应该抛出超时错误');
      } catch (error) {
        expect((error as Error).message).toContain('超时');
      }
    });

    it('应该处理通信流未初始化错误', async () => {
      (driver as any)._currentStream = null;

      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      try {
        await (driver as any).readCaptureData(session);
        fail('应该抛出通信流未初始化错误');
      } catch (error) {
        expect((error as Error).message).toContain('通信流未初始化');
      }
    });
  });

  describe('数据解析和处理测试 (覆盖769-900行)', () => {
    it('应该正确解析8通道模式数据', () => {
      const sampleCount = 1000;
      const data = Buffer.alloc(4 + sampleCount + 16);
      
      // 写入长度
      data.writeUInt32LE(sampleCount + 16, 0);
      
      // 写入8通道样本数据
      for (let i = 0; i < sampleCount; i++) {
        data.writeUInt8(i % 256, 4 + i);
      }

      const session: CaptureSession = {
        preTriggerSamples: 500,
        postTriggerSamples: 500,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      const result = (driver as any).parseCaptureData(data, session, 0, sampleCount);

      // 验证8通道解析（覆盖784-789行）
      expect(result.samples).toBeInstanceOf(Uint32Array);
      expect(result.samples.length).toBe(sampleCount);
    });

    it('应该正确解析16通道模式数据', () => {
      const sampleCount = 1000;
      const data = Buffer.alloc(4 + sampleCount * 2 + 16);
      
      // 写入长度
      data.writeUInt32LE(sampleCount * 2 + 16, 0);
      
      // 写入16通道样本数据（每个样本2字节）
      for (let i = 0; i < sampleCount; i++) {
        data.writeUInt16LE(i % 65536, 4 + i * 2);
      }

      const session: CaptureSession = {
        preTriggerSamples: 500,
        postTriggerSamples: 500,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: Array.from({ length: 16 }, (_, i) => ({
          channelNumber: i,
          channelName: `Ch${i}`
        })) as AnalyzerChannel[],
        loopCount: 0
      };

      const result = (driver as any).parseCaptureData(data, session, 1, sampleCount);

      // 验证16通道解析（覆盖790-795行）
      expect(result.samples).toBeInstanceOf(Uint32Array);
      expect(result.samples.length).toBe(sampleCount);
    });

    it('应该正确解析24通道模式数据', () => {
      const sampleCount = 1000;
      const data = Buffer.alloc(4 + sampleCount * 3 + 16);
      
      // 写入长度
      data.writeUInt32LE(sampleCount * 3 + 16, 0);
      
      // 写入24通道样本数据（每个样本3字节）
      for (let i = 0; i < sampleCount; i++) {
        const value = i % 16777216; // 24位最大值
        data.writeUInt8(value & 0xFF, 4 + i * 3);
        data.writeUInt8((value >> 8) & 0xFF, 4 + i * 3 + 1);
        data.writeUInt8((value >> 16) & 0xFF, 4 + i * 3 + 2);
      }

      const session: CaptureSession = {
        preTriggerSamples: 500,
        postTriggerSamples: 500,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: Array.from({ length: 24 }, (_, i) => ({
          channelNumber: i,
          channelName: `Ch${i}`
        })) as AnalyzerChannel[],
        loopCount: 0
      };

      const result = (driver as any).parseCaptureData(data, session, 2, sampleCount);

      // 验证24通道解析（覆盖796-801行）
      expect(result.samples).toBeInstanceOf(Uint32Array);
      expect(result.samples.length).toBe(sampleCount);
    });
  });

  describe('边界条件和异常处理测试', () => {
    it('应该处理数据不足的情况', () => {
      const data = Buffer.alloc(10); // 很小的数据
      const session: CaptureSession = {
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      const result = (driver as any).parseCaptureData(data, session, 0, 1000);

      // 验证数据不足处理
      expect(result).toBeDefined();
    });

    it('应该处理时间戳数据解析', () => {
      const sampleCount = 100;
      const timestampBytes = 16;
      const data = Buffer.alloc(4 + sampleCount + timestampBytes);
      
      // 写入长度
      data.writeUInt32LE(sampleCount + timestampBytes, 0);
      
      // 写入样本数据
      for (let i = 0; i < sampleCount; i++) {
        data.writeUInt8(i % 256, 4 + i);
      }
      
      // 写入时间戳数据
      for (let i = 0; i < timestampBytes; i += 8) {
        data.writeBigUInt64LE(BigInt(i * 1000), 4 + sampleCount + i);
      }

      const session: CaptureSession = {
        preTriggerSamples: 50,
        postTriggerSamples: 50,
        frequency: 1000000,
        triggerType: TriggerType.RisingEdge,
        triggerValue: 0x01,
        triggerPosition: 50,
        captureChannels: [
          { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
        ],
        loopCount: 0
      };

      const result = (driver as any).parseCaptureData(data, session, 0, sampleCount);

      // 验证时间戳解析
      expect(result.timestamps).toBeInstanceOf(BigUint64Array);
    });
  });
});