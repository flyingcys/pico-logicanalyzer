/**
 * LogicAnalyzerDriver 覆盖率增强测试
 * 专门针对未覆盖的代码路径进行测试
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError } from '../../../src/models/AnalyzerTypes';
import { VersionValidator, DeviceConnectionException } from '../../../src/drivers/VersionValidator';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');

describe('LogicAnalyzerDriver - 覆盖率增强测试', () => {
  let driver: LogicAnalyzerDriver;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (driver) {
      try {
        await driver.disconnect();
      } catch (error) {
        // 忽略清理错误
      }
    }
  });

  describe('网络连接初始化测试', () => {
    it('initNetwork应该成功建立网络连接', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      const mockSocket = {
        connect: jest.fn((port, address, callback) => {
          setTimeout(callback, 0);
        }),
        pipe: jest.fn(),
        on: jest.fn(),
        destroy: jest.fn()
      };
      
      (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket as any);
      
      const mockParser = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // 模拟设备信息响应
            setTimeout(() => {
              callback('Pico Logic Analyzer v1.7');
              callback('FREQ:100000000');
              callback('BLASTFREQ:100000000');
              callback('BUFFER:96000');
              callback('CHANNELS:24');
            }, 10);
          }
        }),
        off: jest.fn(),
        once: jest.fn()
      };
      
      (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockParser as any);
      
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(driver.isNetwork).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
    });

    it('initNetwork应该处理无效的地址格式', async () => {
      driver = new LogicAnalyzerDriver('invalid-address-format');
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接失败');
    });

    it('initNetwork应该处理无效的端口号', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:99999');
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接失败');
    });

    it('initNetwork应该处理网络连接错误', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      const mockSocket = {
        connect: jest.fn((port, address, callback) => {
          // 不调用callback，模拟连接超时
        }),
        pipe: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Connection refused')), 10);
          }
        }),
        destroy: jest.fn()
      };
      
      (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket as any);
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('网络连接失败');
    });
  });

  describe('串口连接初始化测试', () => {
    it('initSerialPort应该成功建立串口连接', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      const mockSerialPort = {
        open: jest.fn((callback) => {
          setTimeout(callback, 10);
        }),
        pipe: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
        isOpen: true
      };
      
      (SerialPort as jest.MockedClass<typeof SerialPort>).mockImplementation(() => mockSerialPort as any);
      
      const mockParser = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              callback('Pico Logic Analyzer v1.7');
              callback('FREQ:100000000');
              callback('BLASTFREQ:100000000');
              callback('BUFFER:96000');
              callback('CHANNELS:24');
            }, 10);
          }
        }),
        off: jest.fn(),
        once: jest.fn()
      };
      
      (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockParser as any);
      
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(driver.isNetwork).toBe(false);
      expect(mockSerialPort.open).toHaveBeenCalled();
    });

    it('initSerialPort应该处理串口连接错误', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      
      const mockSerialPort = {
        open: jest.fn((callback) => {
          setTimeout(() => callback(new Error('Port not found')), 10);
        }),
        pipe: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };
      
      (SerialPort as jest.MockedClass<typeof SerialPort>).mockImplementation(() => mockSerialPort as any);
      
      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('串口连接失败');
    });
  });

  describe('设备信息解析增强测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('parseDeviceInfo应该处理无效的突发频率响应', () => {
      const responses = [
        'Pico Logic Analyzer v1.7',
        'FREQ:100000000',
        'INVALID_BLASTFREQ_RESPONSE',
        'BUFFER:96000',
        'CHANNELS:24'
      ];
      
      expect(() => {
        (driver as any).parseDeviceInfo(responses);
      }).toThrow(DeviceConnectionException);
    });

    it('parseDeviceInfo应该处理无效的缓冲区大小响应', () => {
      const responses = [
        'Pico Logic Analyzer v1.7',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'INVALID_BUFFER_RESPONSE',
        'CHANNELS:24'
      ];
      
      expect(() => {
        (driver as any).parseDeviceInfo(responses);
      }).toThrow(DeviceConnectionException);
    });

    it('parseDeviceInfo应该处理无效的通道数响应', () => {
      const responses = [
        'Pico Logic Analyzer v1.7',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'INVALID_CHANNELS_RESPONSE'
      ];
      
      expect(() => {
        (driver as any).parseDeviceInfo(responses);
      }).toThrow(DeviceConnectionException);
    });

    it('parseDeviceInfo应该处理超出范围的通道数', () => {
      const responses = [
        'Pico Logic Analyzer v1.7',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:25' // 超过24通道限制
      ];
      
      expect(() => {
        (driver as any).parseDeviceInfo(responses);
      }).toThrow(DeviceConnectionException);
    });

    it('parseDeviceInfo应该处理无效的设备版本', () => {
      const responses = [
        'Invalid Version v0.9', // 版本过低
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];
      
      expect(() => {
        (driver as any).parseDeviceInfo(responses);
      }).toThrow(DeviceConnectionException);
    });

    it('parseDeviceInfo应该处理无效的数值', () => {
      const responses = [
        'Pico Logic Analyzer v1.7',
        'FREQ:invalid_number',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];
      
      expect(() => {
        (driver as any).parseDeviceInfo(responses);
      }).toThrow(DeviceConnectionException);
    });
  });

  describe('数据读取和解析测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      // 设置基础属性
      (driver as any)._isConnected = true;
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._bufferSize = 96000;
    });

    it('readDeviceInfo应该处理超时', async () => {
      const mockParser = {
        on: jest.fn((event, callback) => {
          // 不触发任何回调，模拟超时
        }),
        off: jest.fn()
      };
      
      (driver as any)._lineParser = mockParser;
      
      await expect((driver as any).readDeviceInfo()).rejects.toThrow('设备信息读取超时');
    });

    it('startDataReading应该处理采集启动失败', async () => {
      const session = new CaptureSession();
      session.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.triggerType = TriggerType.Edge;
      
      const mockStream = {
        write: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      };
      
      const mockParser = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // 模拟启动失败响应
            setTimeout(() => callback('CAPTURE_FAILED'), 10);
          }
        }),
        off: jest.fn()
      };
      
      (driver as any)._currentStream = mockStream;
      (driver as any)._lineParser = mockParser;
      
      // Mock waitForResponse to simulate failure
      (driver as any).waitForResponse = jest.fn().mockRejectedValue(new Error('采集启动失败'));
      
      const captureCompletedSpy = jest.spyOn(driver, 'emitCaptureCompleted');
      
      await (driver as any).startDataReading(session);
      
      expect(captureCompletedSpy).toHaveBeenCalledWith({
        success: false,
        session
      });
    });

    it('parseCaptureData应该正确解析16通道数据', () => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      // 创建16通道数据
      const dataBuffer = Buffer.alloc(30);
      dataBuffer.writeUInt32LE(10, 0); // 样本数量
      
      // 写入10个16位样本
      for (let i = 0; i < 10; i++) {
        dataBuffer.writeUInt16LE(i * 0x0101, 4 + i * 2); // 每个样本都有模式
      }
      
      dataBuffer.writeUInt8(0, 24); // 时间戳长度
      
      const result = (driver as any).parseCaptureData(dataBuffer, session, 1, 10);
      
      expect(result.samples).toHaveLength(10);
      expect(result.samples[0]).toBe(0);
      expect(result.samples[1]).toBe(0x0101);
    });

    it('parseCaptureData应该正确解析24通道数据', () => {
      const session = new CaptureSession();
      session.loopCount = 2;
      session.measureBursts = true;
      session.frequency = 24000000;
      session.postTriggerSamples = 1000;
      
      // 创建24通道数据
      const dataBuffer = Buffer.alloc(60);
      dataBuffer.writeUInt32LE(5, 0); // 样本数量
      
      // 写入5个32位样本
      for (let i = 0; i < 5; i++) {
        dataBuffer.writeUInt32LE(i * 0x01010101, 4 + i * 4);
      }
      
      dataBuffer.writeUInt8(16, 24); // 时间戳长度 = (loopCount + 2) * 4
      
      // 写入时间戳数据
      for (let i = 0; i < 4; i++) {
        dataBuffer.writeUInt32LE(1000000 + i * 50000, 25 + i * 4);
      }
      
      const result = (driver as any).parseCaptureData(dataBuffer, session, 2, 5);
      
      expect(result.samples).toHaveLength(5);
      expect(result.timestamps).toHaveLength(4);
      expect(result.bursts).toHaveLength(3); // loopCount + 1
    });
  });

  describe('网络数据读取测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._isConnected = true;
    });

    it('readNetworkCaptureData应该正确处理网络数据', (done) => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // 模拟网络数据接收
            setTimeout(() => {
              const buffer = Buffer.alloc(20);
              buffer.writeUInt32LE(10, 0); // 数据长度
              // 填充10字节数据
              for (let i = 0; i < 10; i++) {
                buffer.writeUInt8(i, 4 + i);
              }
              buffer.writeUInt8(0, 14); // 时间戳长度
              callback(buffer);
            }, 10);
          }
        }),
        off: jest.fn()
      };
      
      (driver as any)._currentStream = mockStream;
      
      const resolve = jest.fn((result) => {
        expect(result.samples).toHaveLength(10);
        done();
      });
      const reject = jest.fn();
      
      (driver as any).readNetworkCaptureData(session, 0, 10, resolve, reject);
    });

    it('readNetworkCaptureData应该设置正确的事件监听器', () => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const mockStream = {
        on: jest.fn(),
        off: jest.fn()
      };
      
      (driver as any)._currentStream = mockStream;
      
      const resolve = jest.fn();
      const reject = jest.fn();
      
      (driver as any).readNetworkCaptureData(session, 0, 10, resolve, reject);
      
      expect(mockStream.on).toHaveBeenCalledWith('data', expect.any(Function));
    });
  });

  describe('串口数据读取测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      (driver as any)._isNetwork = false;
      (driver as any)._isConnected = true; 
    });

    it('readSerialCaptureData应该正确处理串口数据', (done) => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              // 先发送长度头部
              const headerBuffer = Buffer.alloc(4);
              headerBuffer.writeUInt32LE(10, 0);
              callback(headerBuffer);
              
              // 然后发送数据
              const dataBuffer = Buffer.alloc(11);
              for (let i = 0; i < 10; i++) {
                dataBuffer.writeUInt8(i, i);
              }
              dataBuffer.writeUInt8(0, 10); // 时间戳长度
              callback(dataBuffer);
            }, 10);
          }
        }),
        off: jest.fn()
      };
      
      (driver as any)._currentStream = mockStream;
      
      const resolve = jest.fn((result) => {
        expect(result.samples).toHaveLength(10);
        done();
      });
      const reject = jest.fn();
      
      (driver as any).readSerialCaptureData(session, 0, 10, resolve, reject);
    });

    it('readSerialCaptureData应该设置正确的事件监听器', () => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const mockStream = {
        on: jest.fn(),
        off: jest.fn()
      };
      
      (driver as any)._currentStream = mockStream;
      
      const resolve = jest.fn();
      const reject = jest.fn();
      
      (driver as any).readSerialCaptureData(session, 0, 10, resolve, reject);
      
      expect(mockStream.on).toHaveBeenCalledWith('data', expect.any(Function));
    });
  });

  describe('突发时间戳处理测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
    });

    it('processBurstTimestamps应该正确处理时间戳', () => {
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.postTriggerSamples = 1000;
      
      const timestamps = new BigUint64Array([
        0x12345678n,  // 第一个时间戳
        0x12346000n,  // 第二个时间戳  
        0x12347000n,  // 第三个时间戳
        0x12348000n   // 第四个时间戳
      ]);
      
      const bursts: any[] = [];
      
      (driver as any).processBurstTimestamps(timestamps, session, bursts);
      
      expect(bursts.length).toBeGreaterThan(0);
      expect(bursts[0]).toHaveProperty('burstSampleStart');
      expect(bursts[0]).toHaveProperty('burstSampleEnd');
    });

    it('processBurstTimestamps应该处理计数器回绕', () => {
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.postTriggerSamples = 1000;
      
      const timestamps = new BigUint64Array([
        0xFFFFFFF0n,  // 接近最大值
        0x00000010n,  // 回绕后的值
        0x00001000n   // 正常递增
      ]);
      
      const bursts: any[] = [];
      
      (driver as any).processBurstTimestamps(timestamps, session, bursts);
      
      expect(bursts.length).toBeGreaterThan(0);
    });
  });

  describe('设备重连测试', () => {
    it('reconnectDevice应该成功重连网络设备', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._devAddr = '192.168.1.100';
      (driver as any)._devPort = 8080;
      
      const mockSocket = {
        destroy: jest.fn(),
        connect: jest.fn((port, address, callback) => {
          setTimeout(callback, 0);
        }),
        pipe: jest.fn(),
        on: jest.fn()
      };
      
      (driver as any)._tcpSocket = mockSocket;
      (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket as any);
      
      const mockParser = {
        on: jest.fn(),
        off: jest.fn()
      };
      (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockParser as any);
      
      await (driver as any).reconnectDevice();
      
      expect(mockSocket.destroy).toHaveBeenCalled();
      expect(mockSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
    });

    it('reconnectDevice应该成功重连串口设备', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      (driver as any)._isNetwork = false;
      
      const mockSerialPort = {
        isOpen: true,
        close: jest.fn(),
        open: jest.fn((callback) => {
          setTimeout(callback, 0);
        }),
        pipe: jest.fn()
      };
      
      (driver as any)._serialPort = mockSerialPort;
      
      const mockParser = {
        on: jest.fn(),
        off: jest.fn()
      };
      (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockParser as any);
      
      await (driver as any).reconnectDevice();
      
      expect(mockSerialPort.close).toHaveBeenCalled();
      expect(mockSerialPort.open).toHaveBeenCalled();
    });

    it('reconnectDevice应该处理重连错误', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._devAddr = '192.168.1.100';
      (driver as any)._devPort = 8080;
      
      const mockSocket = {
        destroy: jest.fn(),
        connect: jest.fn((port, address, callback) => {
          // 不调用callback
        }),
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Connection failed')), 10);
          }
        })
      };
      
      (driver as any)._tcpSocket = mockSocket;
      (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket as any);
      
      await expect((driver as any).reconnectDevice()).rejects.toThrow('网络重连失败');
    });
  });

  describe('网络配置发送测试 - 串口设备', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      (driver as any)._isNetwork = false;
      (driver as any)._isConnected = true;
      
      const mockStream = {
        write: jest.fn((data, callback) => {
          setTimeout(callback, 10);
        })
      };
      (driver as any)._currentStream = mockStream;
    });

    it('sendNetworkConfig应该成功发送网络配置', async () => {
      const mockParser = {
        once: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      };
      (driver as any)._lineParser = mockParser;

      // Mock waitForResponse
      (driver as any).waitForResponse = jest.fn().mockResolvedValue('SETTINGS_SAVED');
      
      const result = await driver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.100', 8080);
      
      expect(result).toBe(true);
      expect((driver as any).waitForResponse).toHaveBeenCalledWith('SETTINGS_SAVED', 5000);
    });

    it('sendNetworkConfig应该处理配置失败', async () => {
      const mockParser = {
        once: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      };
      (driver as any)._lineParser = mockParser;

      // Mock waitForResponse to fail
      (driver as any).waitForResponse = jest.fn().mockResolvedValue('SETTINGS_FAILED');
      
      const result = await driver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.100', 8080);
      
      expect(result).toBe(false);
    });

    it('sendNetworkConfig应该处理异常', async () => {
      // 设置为未连接状态
      (driver as any)._currentStream = null;
      
      const result = await driver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.100', 8080);
      
      expect(result).toBe(false);
    });
  });

  describe('电压状态获取测试 - 网络设备', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      (driver as any)._isNetwork = true;
      (driver as any)._isConnected = true;
      
      const mockStream = {
        write: jest.fn((data, callback) => {
          setTimeout(callback, 10);
        })
      };
      (driver as any)._currentStream = mockStream;
    });

    it('getVoltageStatus应该获取网络设备电压', async () => {
      const mockParser = {
        once: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => callback('Battery: 4.2V'), 100);
          }
        })
      };
      (driver as any)._lineParser = mockParser;
      
      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('Battery: 4.2V');
    });

    it('getVoltageStatus应该处理超时', async () => {
      const mockParser = {
        once: jest.fn() // 不调用callback
      };
      (driver as any)._lineParser = mockParser;
      
      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('TIMEOUT');
    });
  });

  describe('设备验证测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      (driver as any)._channelCount = 24;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._blastFrequency = 100000000;
      (driver as any)._bufferSize = 96000;
    });

    it('validateSettings应该验证Edge触发设置', () => {
      const session = new CaptureSession();
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 5;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.frequency = 24000000;
      session.loopCount = 5;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      const result = (driver as any).validateSettings(session, 10000);
      
      expect(result).toBe(true);
    });

    it('validateSettings应该验证Blast触发设置', () => {
      const session = new CaptureSession();
      session.triggerType = TriggerType.Blast;
      session.triggerChannel = 5;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.frequency = 24000000;
      session.loopCount = 10;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0')
      ];
      
      const result = (driver as any).validateSettings(session, 10000);
      
      expect(result).toBe(true);
    });

    it('validateSettings应该验证Complex触发设置', () => {
      const session = new CaptureSession();
      session.triggerType = TriggerType.Complex;
      session.triggerChannel = 5;
      session.triggerBitCount = 8;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.frequency = 24000000;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0')
      ];
      
      const result = (driver as any).validateSettings(session, 10000);
      
      expect(result).toBe(true);
    });

    it('validateSettings应该验证Fast触发设置', () => {
      const session = new CaptureSession();
      session.triggerType = TriggerType.Fast;
      session.triggerChannel = 2;
      session.triggerBitCount = 3;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.frequency = 24000000;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0')
      ];
      
      const result = (driver as any).validateSettings(session, 10000);
      
      expect(result).toBe(true);
    });
  });

  describe('采集请求构建测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
      (driver as any)._maxFrequency = 100000000;
    });

    it('composeRequest应该构建Complex触发请求', () => {
      const session = new CaptureSession();
      session.triggerType = TriggerType.Complex;
      session.triggerChannel = 5;
      session.triggerBitCount = 8;
      session.triggerPattern = 0xAB;
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      const request = (driver as any).composeRequest(session, 10000, 0);
      
      expect(request.triggerType).toBe(TriggerType.Complex);
      expect(request.triggerValue).toBe(0xAB);
      expect(request.invertedOrCount).toBe(8);
      expect(request.loopCount).toBe(0); // Complex触发不支持循环
    });

    it('composeRequest应该构建Fast触发请求', () => {
      const session = new CaptureSession();
      session.triggerType = TriggerType.Fast;
      session.triggerChannel = 2;
      session.triggerBitCount = 3;
      session.triggerPattern = 0x5;
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0')
      ];
      
      const request = (driver as any).composeRequest(session, 10000, 0);
      
      expect(request.triggerType).toBe(TriggerType.Fast);
      expect(request.triggerValue).toBe(0x5);
      expect(request.invertedOrCount).toBe(3);
      expect(request.measure).toBe(0);
    });
  });
});