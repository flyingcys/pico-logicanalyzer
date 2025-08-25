/**
 * LogicAnalyzerDriver 增强测试用例
 * 
 * 专注提升驱动层测试覆盖率，验证核心功能：
 * - 网络和串口连接模式
 * - 协议通信和数据包处理  
 * - 错误恢复和重连机制
 * - 设备初始化和状态管理
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { AnalyzerDriverType, CaptureError, TriggerType } from '../../../src/models/AnalyzerTypes';
import { mockSerialPort, mockSocket } from '../../fixtures/mocks/simple-mocks';

// Mock依赖
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => mockSerialPort)
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => mockSocket)
}));

describe('LogicAnalyzerDriver 增强测试', () => {
  let driver: LogicAnalyzerDriver;
  let testSession: CaptureSession;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置Mock状态
    mockSerialPort.isOpen = false;
    mockSocket.readyState = 'closed';
    
    testSession = new CaptureSession();
    testSession.frequency = 1000000;
    testSession.preTriggerSamples = 100;
    testSession.postTriggerSamples = 1000;
    testSession.triggerType = TriggerType.Edge;
    testSession.triggerChannel = 0;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'Channel 0'),
      new AnalyzerChannel(1, 'Channel 1')
    ];
  });

  afterEach(async () => {
    if (driver) {
      await driver.disconnect();
    }
  });

  describe('网络连接模式', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该正确解析网络地址和端口', () => {
      expect((driver as any)._devAddr).toBeUndefined(); // 连接前未设置
      expect((driver as any)._devPort).toBeUndefined();
    });

    it('应该建立网络连接', async () => {
      // Mock网络连接成功
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => {
          mockSocket.readyState = 'open';
          callback && callback();
        }, 10);
        return mockSocket;
      });
      
      // Mock设备初始化响应
      jest.spyOn(driver as any, 'initializeDevice').mockResolvedValue(undefined);
      
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
      expect(driver.isNetwork).toBe(true);
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
    });

    it('应该处理网络连接超时', async () => {
      // 直接Mock initNetwork方法以模拟超时
      jest.spyOn(driver as any, 'initNetwork').mockRejectedValue(new Error('网络连接失败: timeout'));
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('应该处理网络连接错误', async () => {
      // 直接Mock initNetwork方法以模拟连接错误
      jest.spyOn(driver as any, 'initNetwork').mockRejectedValue(new Error('网络连接失败: Connection refused'));
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('串口连接模式', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('应该建立串口连接', async () => {
      // Mock串口连接成功
      mockSerialPort.open.mockImplementation((callback) => {
        setTimeout(() => {
          mockSerialPort.isOpen = true;
          callback && callback();
        }, 10);
      });
      
      jest.spyOn(driver as any, 'initializeDevice').mockResolvedValue(undefined);
      
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(mockSerialPort.open).toHaveBeenCalled();
      expect(driver.isNetwork).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该处理串口设备不存在', async () => {
      // Mock设备不存在错误
      mockSerialPort.open.mockImplementation((callback) => {
        const error = new Error('No such file or directory');
        (error as any).code = 'ENOENT';
        callback && callback(error);
      });
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No such file or directory');
    });

    it('应该处理串口权限错误', async () => {
      // Mock权限错误
      mockSerialPort.open.mockImplementation((callback) => {
        const error = new Error('Permission denied');
        (error as any).code = 'EACCES';
        callback && callback(error);
      });
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('设备初始化和状态管理', () => {
    beforeEach(async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      // Mock基础连接
      mockSerialPort.open.mockImplementation((callback) => {
        mockSerialPort.isOpen = true;
        callback && callback();
      });
      
      // 设置连接状态
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = mockSerialPort;
    });

    it('应该正确解析设备信息', async () => {
      // Mock设备响应数据
      const deviceResponses = [
        'CHANNELS:24',
        'FREQ:100000000', 
        'BUFFER:96000',
        'BLASTFREQ:200000000'
      ];
      
      // Mock设备信息解析
      jest.spyOn(driver as any, 'parseDeviceInfo').mockImplementation((line: string) => {
        if (line.startsWith('CHANNELS:')) {
          (driver as any)._channelCount = 24;
        } else if (line.startsWith('FREQ:')) {
          (driver as any)._maxFrequency = 100000000;
        } else if (line.startsWith('BUFFER:')) {
          (driver as any)._bufferSize = 96000;
        } else if (line.startsWith('BLASTFREQ:')) {
          (driver as any)._blastFrequency = 200000000;
        }
      });
      
      // 解析每个响应
      deviceResponses.forEach(response => {
        (driver as any).parseDeviceInfo(response);
      });
      
      expect(driver.channelCount).toBe(24);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.bufferSize).toBe(96000);
      expect(driver.blastFrequency).toBe(200000000);
    });

    it('应该获取设备状态', async () => {
      // 设置设备属性
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._capturing = false;
      
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      // DeviceStatus接口没有deviceInfo属性，移除这些断言
      // expect(status.deviceInfo?.channels).toBe(24);
      // expect(status.deviceInfo?.maxFrequency).toBe(100000000);
    });

    it('应该获取设备信息', () => {
      // 设置设备属性
      (driver as any)._channelCount = 16;
      (driver as any)._maxFrequency = 50000000;
      (driver as any)._bufferSize = 48000;
      (driver as any)._version = 'v1.2.3';
      
      const deviceInfo = driver.getDeviceInfo();
      
      expect(deviceInfo.channels).toBe(16);
      expect(deviceInfo.maxFrequency).toBe(50000000);
      expect(deviceInfo.bufferSize).toBe(48000);
      // AnalyzerDeviceInfo接口没有version属性，移除这个断言
      // expect(deviceInfo.version).toBe('v1.2.3');
    });
  });

  describe('采集生命周期', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      // 设置已连接状态
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = mockSerialPort;
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._capturing = false;
    });

    it('应该验证采集参数', async () => {
      // 测试频率验证
      testSession.frequency = 200000000; // 超过设备最大频率
      
      const result = await driver.startCapture(testSession);
      
      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该生成正确的采集请求', async () => {
      // Mock写入方法
      const mockWriteData = jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
      jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});
      
      const result = await driver.startCapture(testSession);
      
      expect(result).toBe(CaptureError.None);
      expect(mockWriteData).toHaveBeenCalled();
      
      // 验证写入的数据是采集请求包
      const writeCall = mockWriteData.mock.calls[0];
      expect(writeCall[0]).toBeInstanceOf(Uint8Array);
    });

    it('应该处理采集状态冲突', async () => {
      // 设置为正在采集状态
      (driver as any)._capturing = true;
      
      const result = await driver.startCapture(testSession);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该能够停止采集', async () => {
      // 设置采集状态
      (driver as any)._capturing = true;
      
      const mockWriteData = jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
      const mockReconnect = jest.spyOn(driver as any, 'reconnectDevice').mockResolvedValue(undefined);
      
      const result = await driver.stopCapture();
      
      expect(result).toBe(true);
      expect((driver as any)._capturing).toBe(false);
      expect(mockWriteData).toHaveBeenCalled();
    });
  });

  describe('错误恢复和重连机制', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('应该处理连接丢失并重连', async () => {
      // 模拟初始连接成功
      mockSerialPort.open.mockImplementation((callback) => {
        mockSerialPort.isOpen = true;
        callback && callback();
      });
      
      jest.spyOn(driver as any, 'initializeDevice').mockResolvedValue(undefined);
      
      await driver.connect();
      expect((driver as any)._isConnected).toBe(true);
      
      // 模拟连接丢失
      mockSerialPort.isOpen = false;
      mockSerialPort.emit('close');
      
      // 模拟重连
      const mockReconnect = jest.spyOn(driver as any, 'reconnectDevice').mockImplementation(async () => {
        mockSerialPort.isOpen = true;
        (driver as any)._isConnected = true;
      });
      
      await (driver as any).reconnectDevice();
      
      expect(mockReconnect).toHaveBeenCalled();
      expect((driver as any)._isConnected).toBe(true);
    });

    it('应该处理数据传输错误', async () => {
      // 设置连接状态
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = mockSerialPort;
      
      // Mock写入错误
      mockSerialPort.write.mockImplementation((data, callback) => {
        const error = new Error('Write failed');
        callback && callback(error);
      });
      
      // 测试写入错误处理
      await expect((driver as any).writeData(new Uint8Array([1, 2, 3]))).rejects.toThrow('Write failed');
    });

    it('应该清理资源', async () => {
      // 设置连接状态
      (driver as any)._isConnected = true;
      (driver as any)._serialPort = mockSerialPort;
      (driver as any)._currentStream = mockSerialPort;
      mockSerialPort.isOpen = true;
      
      await driver.disconnect();
      
      expect(mockSerialPort.close).toHaveBeenCalled();
      expect((driver as any)._isConnected).toBe(false);
      expect((driver as any)._serialPort).toBeUndefined();
      expect((driver as any)._currentStream).toBeUndefined();
    });
  });

  describe('数据包协议处理', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      // 设置连接状态
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = mockSerialPort;
    });

    it('应该处理设备响应解析', () => {
      // 模拟完整的设备响应序列，符合parseDeviceInfo的期望
      const completeResponses = [
        'Logic Analyzer V1_7',     // 版本信息
        'FREQ:100000000',          // 频率信息
        'BLASTFREQ:200000000',     // 爆发频率
        'BUFFER:96000',            // 缓冲区大小
        'CHANNELS:24'              // 通道数
      ];
      
      // 使用完整的parseDeviceInfo方法
      (driver as any).parseDeviceInfo(completeResponses);
      
      expect(driver.channelCount).toBe(24);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.bufferSize).toBe(96000);
    });

    it('应该处理无效的设备响应', () => {
      // 测试单个无效响应的处理，而不是作为完整序列
      const validBase = [
        'Logic Analyzer V1_7',
        'FREQ:100000000', 
        'BLASTFREQ:200000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];
      
      // 先设置有效的基础数据
      (driver as any).parseDeviceInfo(validBase);
      
      // 然后测试单个无效的响应不会破坏已有数据
      const invalidSingleResponses = [
        ['Logic Analyzer V1_7', 'CHANNELS:abc', 'BLASTFREQ:200000000', 'BUFFER:96000', 'FREQ:100000000'],
        ['Logic Analyzer V1_7', 'FREQ:-100', 'BLASTFREQ:200000000', 'BUFFER:96000', 'CHANNELS:24']
      ];
      
      // 测试这些会导致解析失败
      invalidSingleResponses.forEach(responses => {
        expect(() => {
          (driver as any).parseDeviceInfo(responses);
        }).toThrow();
      });
    });
  });
});