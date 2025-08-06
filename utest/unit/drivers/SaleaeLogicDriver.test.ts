import { SaleaeLogicDriver } from '../../../src/drivers/SaleaeLogicDriver';
import { AnalyzerDriverType, CaptureError, CaptureMode } from '../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('net');

const mockSocket = Socket as jest.MockedClass<typeof Socket>;

describe('SaleaeLogicDriver', () => {
  let driver: SaleaeLogicDriver;
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
    
    driver = new SaleaeLogicDriver();
  });

  afterEach(() => {
    if (driver) {
      driver.disconnect();
    }
  });

  describe('构造函数和基础属性', () => {
    it('应该使用默认参数创建SaleaeLogicDriver实例', () => {
      const driver = new SaleaeLogicDriver();
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
      expect(driver.isCapturing).toBe(false);
      expect(driver.channelCount).toBe(8);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(500000000);
      expect(driver.bufferSize).toBe(10000000);
    });

    it('应该使用自定义连接字符串创建实例', () => {
      const driver = new SaleaeLogicDriver('192.168.1.100:10430');
      expect(driver).toBeInstanceOf(SaleaeLogicDriver);
      expect((driver as any)._host).toBe('192.168.1.100');
      expect((driver as any)._port).toBe(10430);
    });

    it('应该使用默认主机和端口', () => {
      const driver = new SaleaeLogicDriver();
      expect((driver as any)._host).toBe('localhost');
      expect((driver as any)._port).toBe(10429);
    });

    it('应该正确解析连接字符串', () => {
      const driver = new SaleaeLogicDriver('example.com:12345');
      expect((driver as any)._host).toBe('example.com');
      expect((driver as any)._port).toBe(12345);
    });

    it('应该处理无效的连接字符串', () => {
      const driver = new SaleaeLogicDriver('invalid-format');
      expect((driver as any)._host).toBe('localhost');
      expect((driver as any)._port).toBe(10429);
    });

    it('应该返回正确的设备版本', () => {
      expect(driver.deviceVersion).toBeNull();
      // 设置版本后应该返回正确值
      (driver as any)._version = 'Logic 2.4.0';
      expect(driver.deviceVersion).toBe('Logic 2.4.0');
    });
  });

  describe('Socket连接管理', () => {
    it('应该成功初始化Socket连接', async () => {
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.readyState = 'open';
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      await (driver as any).initializeSocket();
      
      expect(mockSocketInstance.connect).toHaveBeenCalledWith(10429, 'localhost', expect.any(Function));
      expect(mockSocketInstance.setTimeout).toHaveBeenCalledWith(5000);
    });

    it('应该处理Socket连接失败', async () => {
      mockSocketInstance.connect.mockImplementation(() => {
        setTimeout(() => {
          mockSocketInstance.emit('error', new Error('连接被拒绝'));
        }, 10);
        return mockSocketInstance;
      });

      await expect((driver as any).initializeSocket()).rejects.toThrow('连接被拒绝');
    });

    it('应该处理连接超时', async () => {
      mockSocketInstance.connect.mockImplementation(() => {
        setTimeout(() => {
          mockSocketInstance.emit('timeout');
        }, 10);
        return mockSocketInstance;
      });

      await expect((driver as any).initializeSocket()).rejects.toThrow('连接超时');
    });

    it('应该设置正确的Socket事件监听器', async () => {
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      await (driver as any).initializeSocket();

      expect(mockSocketInstance.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockSocketInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocketInstance.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocketInstance.on).toHaveBeenCalledWith('timeout', expect.any(Function));
    });
  });

  describe('Saleae Logic API通信', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该正确发送API命令', async () => {
      const expectedResponse = '{"result": "success"}';
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', expectedResponse + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const response = await (driver as any).sendCommand({ method: 'get_app_info' });
      
      expect(JSON.parse(response)).toEqual({ result: 'success' });
      expect(mockSocketInstance.write).toHaveBeenCalledWith(
        expect.stringContaining('get_app_info'),
        expect.any(Function)
      );
    });

    it('应该处理JSON响应解析', async () => {
      const apiResponse = {
        result: {
          app_name: "Logic 2",
          app_version: "2.4.0"
        }
      };
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', JSON.stringify(apiResponse) + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const response = await (driver as any).sendCommand({ method: 'get_app_info' });
      
      expect(JSON.parse(response)).toEqual(apiResponse);
    });

    it('应该处理多行JSON响应', async () => {
      const response1 = '{"part1": "data1"}';
      const response2 = '{"part2": "data2"}';
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', response1 + '\n');
          mockSocketInstance.emit('data', response2 + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const response = await (driver as any).sendCommand({ method: 'test' });
      
      expect(response).toBe(response1);
    });

    it('应该处理API错误响应', async () => {
      const errorResponse = {
        error: {
          code: -1,
          message: "Method not found"
        }
      };
      
      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', JSON.stringify(errorResponse) + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      await expect((driver as any).sendCommand({ method: 'invalid_method' }))
        .rejects.toThrow('Method not found');
    });

    it('应该处理命令超时', async () => {
      // 设置很短的超时时间
      (driver as any).commandTimeout = 50;
      
      mockSocketInstance.write.mockImplementation(() => {
        // 不触发任何响应，导致超时
        return true;
      });

      await expect((driver as any).sendCommand({ method: 'test' }))
        .rejects.toThrow('命令执行超时');
    });
  });

  describe('设备连接功能', () => {
    it('应该成功连接到Saleae Logic设备', async () => {
      // Mock初始化Socket成功
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.readyState = 'open';
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      // Mock设备信息查询
      const deviceInfo = {
        result: {
          app_name: "Logic 2",
          app_version: "2.4.0",
          devices: [{
            device_id: "device-123",
            device_type: "logic_8",
            device_name: "Logic 8",
            max_sample_rate: 100000000,
            channel_count: 8
          }]
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('get_devices')) {
            mockSocketInstance.emit('data', JSON.stringify(deviceInfo) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo!.name).toContain('Logic');
      expect(result.deviceInfo!.type).toBe(AnalyzerDriverType.Network);
      expect(result.deviceInfo!.isNetwork).toBe(true);
    });

    it('应该处理没有设备连接的情况', async () => {
      mockSocketInstance.connect.mockImplementation((port: number, host: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      const noDevicesResponse = {
        result: {
          devices: []
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', JSON.stringify(noDevicesResponse) + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('未发现Saleae Logic设备');
    });

    it('应该处理Logic 2应用未运行的情况', async () => {
      mockSocketInstance.connect.mockImplementation(() => {
        setTimeout(() => {
          mockSocketInstance.emit('error', new Error('ECONNREFUSED'));
        }, 10);
        return mockSocketInstance;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接失败');
    });

    it('应该正确选择最佳设备', () => {
      const devices = [
        { device_id: '1', device_type: 'logic_4', max_sample_rate: 24000000, channel_count: 4 },
        { device_id: '2', device_type: 'logic_8', max_sample_rate: 100000000, channel_count: 8 },
        { device_id: '3', device_type: 'logic_pro_8', max_sample_rate: 500000000, channel_count: 8 }
      ];
      
      const bestDevice = (driver as any).selectBestDevice(devices);
      
      expect(bestDevice.device_id).toBe('3'); // 应该选择Logic Pro 8（最高性能）
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

      await expect(driver.disconnect()).resolves.toBeUndefined();
    });

    it('应该在断开连接时停止当前采集', async () => {
      (driver as any)._capturing = true;
      (driver as any)._currentCaptureId = 'capture-123';

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return true;
      });

      mockSocketInstance.end.mockImplementation((callback?: Function) => {
        setTimeout(() => {
          if (callback) callback();
        }, 10);
        return mockSocketInstance;
      });

      await driver.disconnect();

      expect(mockSocketInstance.write).toHaveBeenCalledWith(
        expect.stringContaining('stop_capture'),
        expect.any(Function)
      );
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

    it('应该查询设备详细状态', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
      (driver as any)._deviceId = 'device-123';

      const statusResponse = {
        result: {
          is_processing: false,
          performance: {
            cpu_usage: 15.5,
            memory_usage: 234567890
          }
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('get_capture_status')) {
            mockSocketInstance.emit('data', JSON.stringify(statusResponse) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const detailedStatus = await (driver as any).getDetailedDeviceStatus();
      
      expect(detailedStatus.is_processing).toBe(false);
      expect(detailedStatus.performance.cpu_usage).toBe(15.5);
    });
  });

  describe('数据采集功能', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
      (driver as any)._deviceId = 'device-123';
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

    it('应该成功启动数据采集', async () => {
      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 10000000,
        channels: [0, 1, 2, 3]
      };

      const captureResponse = {
        result: {
          capture_id: "capture-456"
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('start_capture')) {
            mockSocketInstance.emit('data', JSON.stringify(captureResponse) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.startCapture(session);
      
      expect(result).toBe(CaptureError.None);
      expect((driver as any)._capturing).toBe(true);
      expect((driver as any)._currentCaptureId).toBe('capture-456');
    });

    it('应该正确配置采集参数', async () => {
      const session = {
        totalSamples: 5000,
        trigger: { type: 1, value: 0xFF },
        frequency: 50000000,
        channels: [0, 1, 2, 3, 4, 5, 6, 7]
      };

      let captureConfig: any = null;

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        const command = JSON.parse(data);
        if (command.method === 'start_capture') {
          captureConfig = command.params;
          setTimeout(() => {
            mockSocketInstance.emit('data', JSON.stringify({ result: { capture_id: 'test' } }) + '\n');
            if (callback) callback();
          }, 10);
        }
        return true;
      });

      await driver.startCapture(session);
      
      expect(captureConfig).toBeDefined();
      expect(captureConfig.sample_rate).toBe(50000000);
      expect(captureConfig.enabled_channels).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('应该处理不同的触发类型', async () => {
      const sessions = [
        { trigger: { type: 0, value: 0 } }, // None
        { trigger: { type: 1, value: 0xFF } }, // Digital Pattern
        { trigger: { type: 2, value: 0 } }  // Other
      ];

      for (const sessionData of sessions) {
        const session = {
          totalSamples: 1000,
          frequency: 10000000,
          channels: [0, 1, 2, 3],
          ...sessionData
        };

        mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
          setTimeout(() => {
            mockSocketInstance.emit('data', JSON.stringify({ result: { capture_id: 'test' } }) + '\n');
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

    it('应该能够停止正在进行的采集', async () => {
      (driver as any)._capturing = true;
      (driver as any)._currentCaptureId = 'capture-789';

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('stop_capture')) {
            mockSocketInstance.emit('data', JSON.stringify({ result: "success" }) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.stopCapture();
      
      expect(result).toBe(CaptureError.None);
      expect((driver as any)._capturing).toBe(false);
      expect((driver as any)._currentCaptureId).toBeNull();
    });

    it('应该处理采集配置失败', async () => {
      const session = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000,
        channels: [0, 1, 2, 3]
      };

      const errorResponse = {
        error: {
          code: -2,
          message: "Invalid sample rate"
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', JSON.stringify(errorResponse) + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const result = await driver.startCapture(session);
      
      expect(result).toBe(CaptureError.HardwareError);
    });
  });

  describe('数据读取和处理', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
      (driver as any)._currentCaptureId = 'capture-123';
    });

    it('应该正确读取采集数据', async () => {
      const dataResponse = {
        result: {
          data: {
            digital_samples: [
              { time: 0.0, channels: [true, false, true, false, true, false, true, false] },
              { time: 0.000000001, channels: [false, true, false, true, false, true, false, true] }
            ]
          }
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('get_capture_data')) {
            mockSocketInstance.emit('data', JSON.stringify(dataResponse) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const captureData = await (driver as any).readCaptureData();
      
      expect(captureData).toBeDefined();
      expect(captureData.digital_samples).toHaveLength(2);
      expect(captureData.digital_samples[0].channels).toHaveLength(8);
    });

    it('应该正确转换数据格式', () => {
      const saleaeData = {
        digital_samples: [
          { time: 0.0, channels: [true, false, true, false, true, false, true, false] },
          { time: 0.000000001, channels: [false, true, false, true, false, true, false, true] }
        ]
      };

      const convertedData = (driver as any).convertSaleaeDataToStandard(saleaeData);
      
      expect(convertedData.samples).toBeDefined();
      expect(convertedData.samples.length).toBe(8); // 8个通道
      expect(convertedData.samples[0]).toBeInstanceOf(Uint8Array);
    });

    it('应该处理大数据集的分块读取', async () => {
      const largeDataResponse = {
        result: {
          data: {
            digital_samples: Array.from({ length: 10000 }, (_, i) => ({
              time: i * 0.000000001,
              channels: Array.from({ length: 8 }, (_, j) => (i + j) % 2 === 0)
            }))
          }
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('get_capture_data')) {
            // 分块发送大数据
            const chunkSize = 1000;
            const totalChunks = Math.ceil(largeDataResponse.result.data.digital_samples.length / chunkSize);
            
            for (let i = 0; i < totalChunks; i++) {
              const start = i * chunkSize;
              const end = Math.min(start + chunkSize, largeDataResponse.result.data.digital_samples.length);
              const chunk = {
                result: {
                  data: {
                    digital_samples: largeDataResponse.result.data.digital_samples.slice(start, end)
                  }
                }
              };
              setTimeout(() => {
                mockSocketInstance.emit('data', JSON.stringify(chunk) + '\n');
              }, i * 5);
            }
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const captureData = await (driver as any).readCaptureData();
      
      expect(captureData.digital_samples.length).toBeGreaterThan(1000);
    });

    it('应该处理数据读取错误', async () => {
      const errorResponse = {
        error: {
          code: -3,
          message: "Capture data not available"
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', JSON.stringify(errorResponse) + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      await expect((driver as any).readCaptureData()).rejects.toThrow('Capture data not available');
    });
  });

  describe('设备能力和配置', () => {
    it('应该构建正确的设备能力描述', () => {
      (driver as any)._channelCount = 8;
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._bufferSize = 10000000;

      const capabilities = (driver as any).buildCapabilities();
      
      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.sampling.maxRate).toBe(100000000);
      expect(capabilities.sampling.bufferSize).toBe(10000000);
      expect(capabilities.features.protocolDecoding).toBe(true);
    });

    it('应该根据设备类型调整能力', () => {
      // Logic Pro 16设备
      (driver as any)._deviceType = 'logic_pro_16';
      (driver as any)._channelCount = 16;
      (driver as any)._maxFrequency = 500000000;

      const capabilities = (driver as any).buildCapabilities();
      
      expect(capabilities.channels.digital).toBe(16);
      expect(capabilities.sampling.maxRate).toBe(500000000);
    });

    it('应该正确解析设备信息', () => {
      const deviceInfo = {
        device_id: "device-456",
        device_type: "logic_8",
        device_name: "Logic 8",
        max_sample_rate: 100000000,
        channel_count: 8,
        connected_interface: "USB 3.0"
      };

      (driver as any).updateDeviceInfo(deviceInfo);
      
      expect((driver as any)._deviceId).toBe('device-456');
      expect((driver as any)._channelCount).toBe(8);
      expect((driver as any)._maxFrequency).toBe(100000000);
    });

    it('应该验证采集参数的有效性', () => {
      (driver as any)._maxFrequency = 100000000;
      (driver as any)._channelCount = 8;

      const validSession = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 50000000,
        channels: [0, 1, 2, 3]
      };

      expect((driver as any).validateCaptureSession(validSession)).toBe(true);

      const invalidSession = {
        totalSamples: -1,
        trigger: { type: 0, value: 0 },
        frequency: 200000000, // 超出最大频率
        channels: [0, 1, 2, 3, 4, 5, 6, 7, 8] // 超出通道数
      };

      expect((driver as any).validateCaptureSession(invalidSession)).toBe(false);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理无效的连接参数', () => {
      expect(() => {
        new SaleaeLogicDriver('invalid:port');
      }).not.toThrow(); // 应该回退到默认值
    });

    it('应该处理Socket意外关闭', () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      const closeHandler = jest.fn();
      driver.on('disconnected', closeHandler);

      // 模拟Socket意外关闭
      mockSocketInstance.emit('close');

      expect((driver as any)._isConnected).toBe(false);
    });

    it('应该处理JSON解析错误', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', 'invalid json response\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      await expect((driver as any).sendCommand({ method: 'test' }))
        .rejects.toThrow('响应解析失败');
    });

    it('应该处理超出范围的采集参数', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._maxFrequency = 100000000;

      const invalidSession = {
        totalSamples: 1000,
        trigger: { type: 0, value: 0 },
        frequency: 1000000000, // 10倍于最大频率
        channels: [0, 1, 2, 3]
      };

      const result = await driver.startCapture(invalidSession);
      
      expect(result).toBe(CaptureError.InvalidParameter);
    });

    it('应该处理内存不足的情况', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      const memoryErrorResponse = {
        error: {
          code: -4,
          message: "Not enough memory to complete capture"
        }
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          mockSocketInstance.emit('data', JSON.stringify(memoryErrorResponse) + '\n');
          if (callback) callback();
        }, 10);
        return true;
      });

      const largeSession = {
        totalSamples: 100000000, // 100M样本
        trigger: { type: 0, value: 0 },
        frequency: 100000000,
        channels: [0, 1, 2, 3, 4, 5, 6, 7]
      };

      const result = await driver.startCapture(largeSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });
  });

  describe('高级功能', () => {
    beforeEach(() => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;
    });

    it('应该支持协议分析功能', async () => {
      const protocolConfig = {
        protocol: 'i2c',
        sda_channel: 0,
        scl_channel: 1
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('add_analyzer')) {
            mockSocketInstance.emit('data', JSON.stringify({ result: { analyzer_id: 'analyzer-123' } }) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const analyzerId = await (driver as any).addProtocolAnalyzer(protocolConfig);
      
      expect(analyzerId).toBe('analyzer-123');
    });

    it('应该支持导出功能', async () => {
      const exportConfig = {
        format: 'csv',
        filename: 'capture_data.csv',
        include_headers: true
      };

      mockSocketInstance.write.mockImplementation((data: string, callback?: Function) => {
        setTimeout(() => {
          if (data.includes('export_data')) {
            mockSocketInstance.emit('data', JSON.stringify({ result: { export_id: 'export-456' } }) + '\n');
          }
          if (callback) callback();
        }, 10);
        return true;
      });

      const exportId = await (driver as any).exportCaptureData(exportConfig);
      
      expect(exportId).toBe('export-456');
    });

    it('应该支持实时数据流', () => {
      const streamHandler = jest.fn();
      driver.on('realtimeData', streamHandler);

      // 模拟实时数据事件
      const realtimeData = {
        timestamp: Date.now(),
        samples: new Uint8Array([0x01, 0x02, 0x03, 0x04])
      };

      (driver as any).emitRealtimeData(realtimeData);
      
      expect(streamHandler).toHaveBeenCalledWith(realtimeData);
    });
  });

  describe('性能和内存管理', () => {
    it('应该正确管理连接池', () => {
      const maxConnections = (driver as any).getMaxConnections();
      expect(typeof maxConnections).toBe('number');
      expect(maxConnections).toBeGreaterThan(0);
    });

    it('应该在dispose时清理所有资源', async () => {
      (driver as any)._isConnected = true;
      (driver as any)._socket = mockSocketInstance;

      await driver.dispose();

      expect(mockSocketInstance.removeAllListeners).toHaveBeenCalled();
      expect(mockSocketInstance.destroy).toHaveBeenCalled();
      expect((driver as any)._socket).toBeUndefined();
    });

    it('应该处理大数据集而不造成内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 模拟处理大数据集
      const largeDataSet = new Uint8Array(1000000);
      largeDataSet.fill(0xFF);
      
      const result = (driver as any).processLargeDataSet(largeDataSet);
      
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

    it('应该正确触发设备状态变化事件', () => {
      const handler = jest.fn();
      driver.on('deviceStatusChanged', handler);

      (driver as any).emitDeviceStatusChanged({ isConnected: true, isCapturing: false });
      
      expect(handler).toHaveBeenCalledWith({ isConnected: true, isCapturing: false });
    });
  });
});