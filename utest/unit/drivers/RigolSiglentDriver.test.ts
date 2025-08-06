import { RigolSiglentDriver } from '../../../src/drivers/RigolSiglentDriver';
import { AnalyzerDriverType, CaptureError, CaptureMode } from '../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('net');

const mockSocket = Socket as jest.MockedClass<typeof Socket>;

describe('RigolSiglentDriver', () => {
  let driver: RigolSiglentDriver;
  let mockSocketInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Socket实例
    mockSocketInstance = {
      connect: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
      removeAllListeners: jest.fn(),
      setTimeout: jest.fn(),
      readyState: 'closed',
      destroyed: false
    };
    
    mockSocket.mockImplementation(() => mockSocketInstance);
    
    driver = new RigolSiglentDriver('192.168.1.100');
  });

  afterEach(() => {
    if (driver) {
      driver.disconnect();
    }
  });

  describe('构造函数和基础属性', () => {
    it('应该使用IP地址创建RigolSiglentDriver实例', () => {
      const driver = new RigolSiglentDriver('192.168.1.100');
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
      expect(driver.isCapturing).toBe(false);
      expect(driver.channelCount).toBeDefined();
      expect(driver.maxFrequency).toBeGreaterThan(0);
    });

    it('应该使用自定义端口创建实例', () => {
      const driver = new RigolSiglentDriver('192.168.1.100', 5555);
      expect(driver).toBeInstanceOf(RigolSiglentDriver);
    });

    it('应该返回正确的设备类型', () => {
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });

    it('应该有默认的SCPI超时值', () => {
      const timeout = (driver as any).scpiTimeout;
      expect(timeout).toBeGreaterThan(0);
    });
  });

  describe('SCPI命令处理', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该正确发送SCPI查询命令', async () => {
      const expectedResponse = 'RIGOL TECHNOLOGIES,DS1054Z,DS1ZA123456789,00.04.04.04.00';
      
      // Mock socket响应
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', expectedResponse + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const response = await (driver as any).sendSCPIQuery('*IDN?');
      
      expect(response).toBe(expectedResponse);
      expect(mockSocketInstance.write).toHaveBeenCalledWith('*IDN?\n', expect.any(Function));
    });

    it('应该正确发送SCPI命令（无返回值）', async () => {
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return true;
      });

      await (driver as any).sendSCPICommand('*RST');
      
      expect(mockSocketInstance.write).toHaveBeenCalledWith('*RST\n', expect.any(Function));
    });

    it('应该处理SCPI命令超时', async () => {
      // 设置很短的超时时间
      (driver as any).scpiTimeout = 50;
      
      mockSocketInstance.write.mockImplementation(() => {
        // 不触发任何响应，导致超时
        return true;
      });

      await expect((driver as any).sendSCPIQuery('*IDN?')).rejects.toThrow('SCPI命令超时');
    });

    it('应该处理Socket写入错误', async () => {
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback(new Error('网络错误'));
        }, 10);
        return true;
      });

      await expect((driver as any).sendSCPICommand('*RST')).rejects.toThrow('网络错误');
    });

    it('应该正确解析多行SCPI响应', async () => {
      const multiLineResponse = 'Line1\nLine2\nLine3';
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', multiLineResponse + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const response = await (driver as any).sendSCPIQuery('SYST:ERR?');
      
      expect(response).toBe(multiLineResponse);
    });
  });

  describe('设备连接功能', () => {
    it('应该成功连接到Rigol设备', async () => {
      // Mock成功的连接
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.readyState = 'open';
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      // Mock设备识别响应
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('*IDN?')) {
            mockSocketInstance.emit('data', 'RIGOL TECHNOLOGIES,DS1054Z,DS1ZA123456789,00.04.04.04.00\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo!.name).toContain('RIGOL');
      expect(result.deviceInfo!.type).toBe(AnalyzerDriverType.Network);
      expect(result.deviceInfo!.isNetwork).toBe(true);
    });

    it('应该成功连接到Siglent设备', async () => {
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.readyState = 'open';
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('*IDN?')) {
            mockSocketInstance.emit('data', 'Siglent Technologies,SDS1104X-E,SDS1XEAB123456,6.1.29R3\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo!.name).toContain('Siglent');
    });

    it('应该处理连接超时', async () => {
      mockSocketInstance.connect.mockImplementation(() => {
        // 不触发连接事件，导致超时
        return mockSocketInstance;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接超时');
    });

    it('应该处理连接错误', async () => {
      mockSocketInstance.connect.mockImplementation(() => {
        setTimeout(() => {
          mockSocketInstance.emit('error', new Error('连接被拒绝'));
        }, 10);
        return mockSocketInstance;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接被拒绝');
    });

    it('应该处理不支持的设备', async () => {
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.readyState = 'open';
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('*IDN?')) {
            mockSocketInstance.emit('data', 'UNKNOWN,DEVICE,12345,1.0.0\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的设备');
    });
  });

  describe('设备断开连接功能', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该正确断开连接', async () => {
      mockSocketInstance.end.mockImplementation((callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      await driver.disconnect();

      expect(mockSocketInstance.end).toHaveBeenCalled();
      expect((driver as any)._isConnected).toBe(false);
    });

    it('应该处理已销毁的socket', async () => {
      mockSocketInstance.destroyed = true;

      await driver.disconnect();

      expect(mockSocketInstance.end).not.toHaveBeenCalled();
      expect(mockSocketInstance.destroy).toHaveBeenCalled();
    });

    it('应该处理断开连接时的错误', async () => {
      mockSocketInstance.end.mockImplementation((callback?: Function) => {
        setTimeout(() => {
          if (callback) callback(new Error('断开连接失败'));
        }, 10);
        return mockSocketInstance;
      });

      // 应该不抛出异常
      await expect(driver.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('设备状态管理', () => {
    it('应该返回正确的设备状态', async () => {
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A');
    });

    it('应该在连接后返回正确状态', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._capturing = true;

      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(true);
    });

    it('应该能够查询设备系统信息', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('SYST:ERR?')) {
            mockSocketInstance.emit('data', '0,"No error"\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const systemInfo = await (driver as any).querySystemInfo();
      
      expect(systemInfo).toBeDefined();
    });
  });

  describe('数据采集功能', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该拒绝重复的采集请求', async () => {
      (driver as any)._capturing = true;

      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      const result = await driver.startCapture(session);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝未连接设备的采集请求', async () => {
      (driver as any)._isConnected = false;

      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      const result = await driver.startCapture(session);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该成功配置数字采集', async () => {
      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 100000000,
        channels: [0, 1, 2, 3]
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.startCapture(session);
      
      expect(result).toBe(CaptureError.None);
      expect((driver as any)._capturing).toBe(true);
    });

    it('应该正确处理不同的触发类型', async () => {
      const sessions = [
        { trigger: { type: 0, value: 0 } }, // Edge
        { trigger: { type: 1, value: 0xFF } }, // Pattern
        { trigger: { type: 2, value: 0 } }  // Other
      ];

      for (const sessionData of sessions) {
        const session = {
          totalSamples: 1000,
          frequency: 100000000,
          channels: [0, 1, 2, 3],
          ...sessionData
        };

        mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
          setTimeout(() => {
            if (callback) callback();
          }, 10);
          return true;
        });

        const result = await driver.startCapture(session);
        expect(result).toBe(CaptureError.None);
        
        // 重置状态
        (driver as any)._capturing = false;
      }
    });

    it('应该处理SCPI命令失败', async () => {
      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback(new Error('SCPI命令失败'));
        }, 10);
        return true;
      });

      const result = await driver.startCapture(session);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该能够停止正在进行的采集', async () => {
      (driver as any)._capturing = true;

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.stopCapture();
      
      expect(result).toBe(CaptureError.None);
      expect(mockSocketInstance.write).toHaveBeenCalledWith(expect.stringContaining('STOP'), expect.any(Function));
      expect((driver as any)._capturing).toBe(false);
    });

    it('应该处理没有进行中采集的停止请求', async () => {
      const result = await driver.stopCapture();
      
      expect(result).toBe(CaptureError.None);
      expect((driver as any)._capturing).toBe(false);
    });
  });

  describe('数据读取和处理', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该正确读取二进制数据', async () => {
      const mockBinaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('WAV:DATA?')) {
            mockSocketInstance.emit('data', mockBinaryData);
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const data = await (driver as any).readBinaryData();
      
      expect(data).toBeInstanceOf(Uint8Array);
      expect(Array.from(data)).toEqual([0x01, 0x02, 0x03, 0x04]);
    });

    it('应该处理大量数据的分块读取', async () => {
      const largeData = Buffer.alloc(10000, 0xFF);
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('WAV:DATA?')) {
            // 分块发送数据
            const chunkSize = 1000;
            let offset = 0;
            const sendChunk = () => {
              if (offset < largeData.length) {
                const chunk = largeData.slice(offset, offset + chunkSize);
                mockSocketInstance.emit('data', chunk);
                offset += chunkSize;
                setTimeout(sendChunk, 5);
              }
            };
            sendChunk();
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const data = await (driver as any).readBinaryData();
      
      expect(data.length).toBe(10000);
    });

    it('应该正确解析数字波形数据', () => {
      const binaryData = new Uint8Array([0b10101010, 0b11001100, 0b11110000]);
      const channels = [0, 1, 2, 3, 4, 5, 6, 7];
      
      const parsedData = (driver as any).parseDigitalWaveform(binaryData, channels);
      
      expect(parsedData).toBeDefined();
      expect(parsedData.samples).toBeInstanceOf(Array);
      expect(parsedData.samples.length).toBe(channels.length);
    });
  });

  describe('设备能力和配置', () => {
    it('应该构建正确的Rigol设备能力', () => {
      (driver as any)._deviceType = 'rigol';
      (driver as any)._modelInfo = {
        channels: 16,
        maxSampleRate: 1000000000,
        memoryDepth: 12000000
      };

      const capabilities = (driver as any).buildCapabilities();
      
      expect(capabilities.channels.digital).toBe(16);
      expect(capabilities.sampling.maxRate).toBe(1000000000);
      expect(capabilities.sampling.bufferSize).toBe(12000000);
    });

    it('应该构建正确的Siglent设备能力', () => {
      (driver as any)._deviceType = 'siglent';
      (driver as any)._modelInfo = {
        channels: 16,
        maxSampleRate: 1000000000,
        memoryDepth: 14000000
      };

      const capabilities = (driver as any).buildCapabilities();
      
      expect(capabilities.channels.digital).toBe(16);
      expect(capabilities.sampling.maxRate).toBe(1000000000);
      expect(capabilities.features.signalGeneration).toBe(true); // Siglent通常支持信号生成
    });

    it('应该正确解析设备型号信息', () => {
      const rigolIdn = 'RIGOL TECHNOLOGIES,DS1054Z,DS1ZA123456789,00.04.04.04.00';
      const rigolInfo = (driver as any).parseDeviceInfo(rigolIdn);
      
      expect(rigolInfo.manufacturer).toBe('RIGOL TECHNOLOGIES');
      expect(rigolInfo.model).toBe('DS1054Z');
      expect(rigolInfo.serial).toBe('DS1ZA123456789');
      
      const siglentIdn = 'Siglent Technologies,SDS1104X-E,SDS1XEAB123456,6.1.29R3';
      const siglentInfo = (driver as any).parseDeviceInfo(siglentIdn);
      
      expect(siglentInfo.manufacturer).toBe('Siglent Technologies');
      expect(siglentInfo.model).toBe('SDS1104X-E');
    });

    it('应该验证设备兼容性', () => {
      const rigolCompatible = (driver as any).isDeviceSupported('RIGOL TECHNOLOGIES,DS1054Z');
      expect(rigolCompatible).toBe(true);
      
      const siglentCompatible = (driver as any).isDeviceSupported('Siglent Technologies,SDS1104X-E');
      expect(siglentCompatible).toBe(true);
      
      const unsupported = (driver as any).isDeviceSupported('UNKNOWN,DEVICE');
      expect(unsupported).toBe(false);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理无效的IP地址', () => {
      expect(() => {
        new RigolSiglentDriver('invalid-ip');
      }).toThrow('无效的IP地址格式');
    });

    it('应该处理无效的端口号', () => {
      expect(() => {
        new RigolSiglentDriver('192.168.1.100', -1);
      }).toThrow('无效的端口号');
      
      expect(() => {
        new RigolSiglentDriver('192.168.1.100', 65536);
      }).toThrow('无效的端口号');
    });

    it('应该处理网络连接丢失', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      // 模拟网络连接丢失
      mockSocketInstance.emit('close');

      expect((driver as any)._isConnected).toBe(false);
    });

    it('应该处理socket错误', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      const errorHandler = jest.fn();
      driver.on('error', errorHandler);

      // 模拟socket错误
      const error = new Error('网络错误');
      mockSocketInstance.emit('error', error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('应该处理超出范围的采集参数', async () => {
      (driver as any)._isConnected = true;

      const invalidSession = {
        totalSamples: -1,
        trigger: { type: 0, value: 0 },
        frequency: -1000000,
        channels: []
      };

      const result = await driver.startCapture(invalidSession);
      
      expect(result).toBe(CaptureError.InvalidParameter);
    });

    it('应该处理内存不足的情况', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      const largeSession = {
        totalSamples: 1000000000, // 1G样本
        trigger: { type: 0, value: 0 },
        frequency: 1000000000,
        channels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('ACQ:MDEP')) {
            if (callback) callback(new Error('内存不足'));
          } else {
            if (callback) callback();
          }
        }, 10);
        return true;
      });

      const result = await driver.startCapture(largeSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });
  });

  describe('高级功能', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该支持自动校准功能', async () => {
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return true;
      });

      await (driver as any).performAutoCalibration();
      
      expect(mockSocketInstance.write).toHaveBeenCalledWith(expect.stringContaining('CAL'), expect.any(Function));
    });

    it('应该支持自测功能', async () => {
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('TST:ALL?')) {
            mockSocketInstance.emit('data', 'PASS\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const testResult = await (driver as any).performSelfTest();
      
      expect(testResult).toBe('PASS');
    });

    it('应该支持固件更新检查', async () => {
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('SYST:VERS?')) {
            mockSocketInstance.emit('data', '00.04.04.04.00\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const version = await (driver as any).getFirmwareVersion();
      
      expect(version).toBe('00.04.04.04.00');
    });
  });

  describe('性能和内存管理', () => {
    it('应该正确管理连接池', () => {
      const connections = (driver as any).getActiveConnections();
      expect(Array.isArray(connections)).toBe(true);
    });

    it('应该在dispose时清理所有资源', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      await driver.dispose();

      expect(mockSocketInstance.removeAllListeners).toHaveBeenCalled();
      expect(mockSocketInstance.destroy).toHaveBeenCalled();
      expect((driver as any)._socket).toBeNull();
    });

    it('应该处理大数据集而不造成内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 模拟处理大数据集
      const largeData = new Uint8Array(1000000);
      largeData.fill(0xFF);
      
      const result = (driver as any).processLargeDataSet(largeData);
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // 内存增长应该在合理范围内
      expect(memoryGrowth).toBeLessThan(2000000); // 2MB阈值
    });
  });

  describe('事件处理', () => {
    it('应该正确触发采集完成事件', () => {
      const handler = jest.fn();
      driver.on('captureCompleted', handler);

      const eventArgs = {
        session: {
          totalSamples: 1000,
          trigger: { type: 0, value: 0 },
          frequency: 1000000,
          channels: [0, 1, 2, 3]
        },
        samples: new Uint8Array([1, 2, 3, 4]),
        actualSampleRate: 1000000
      };

      (driver as any).emitCaptureCompleted(eventArgs);
      
      expect(handler).toHaveBeenCalledWith(eventArgs);
    });

    it('应该正确触发连接状态变化事件', () => {
      const handler = jest.fn();
      driver.on('connectionStateChanged', handler);

      (driver as any).emitConnectionStateChanged(true);
      
      expect(handler).toHaveBeenCalledWith(true);
    });
  });
});