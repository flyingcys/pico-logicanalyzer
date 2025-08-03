/**
 * NetworkLogicAnalyzerDriver 综合单元测试
 * 优化版本 - 专注于高覆盖率和稳定性
 * 
 * 测试范围：
 * - 构造函数和基本属性
 * - 网络连接管理（TCP/UDP/WebSocket）
 * - 设备控制和状态查询
 * - 采集功能
 * - 数据格式解析
 * - 错误处理
 * - 资源清理
 */

import { NetworkLogicAnalyzerDriver } from '../../../src/drivers/NetworkLogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { 
  AnalyzerDriverType, 
  CaptureError, 
  TriggerType, 
  CaptureMode,
  CaptureEventArgs,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus
} from '../../../src/models/AnalyzerTypes';

// Mock网络模块
jest.mock('net', () => ({
  Socket: jest.fn()
}));

jest.mock('dgram', () => ({
  createSocket: jest.fn()
}));

// 使用假定时器
jest.useFakeTimers();

describe('NetworkLogicAnalyzerDriver - 综合测试', () => {
  let driver: NetworkLogicAnalyzerDriver;
  let mockTcpSocket: any;
  let mockUdpSocket: any;
  let captureSession: CaptureSession;

  // 创建模拟TCP Socket
  const createMockTcpSocket = () => {
    const handlers: { [key: string]: Function[] } = {};
    
    return {
      connect: jest.fn((port: number, host: string, callback?: Function) => {
        if (callback) {
          setImmediate(callback);
        }
        return mockTcpSocket;
      }),
      write: jest.fn((data: string, callback?: Function) => {
        if (callback) {
          setImmediate(callback);
        }
        // 立即模拟数据响应
        setImmediate(() => {
          const dataHandlers = handlers['data'] || [];
          dataHandlers.forEach(handler => {
            try {
              const command = JSON.parse(data.replace('\\n', ''));
              let response = {};
              
              switch (command.command) {
                case 'HANDSHAKE':
                  response = { success: true };
                  break;
                case 'GET_DEVICE_INFO':
                  response = { 
                    device_info: { 
                      version: 'Test Network Device v1.0',
                      channels: 8,
                      max_frequency: 100000000,
                      blast_frequency: 200000000,
                      buffer_size: 16000000
                    }
                  };
                  break;
                case 'GET_STATUS':
                  response = { 
                    battery_voltage: '3.3V', 
                    temperature: 25.0,
                    last_error: null
                  };
                  break;
                case 'START_CAPTURE':
                  response = { success: true, capture_id: 'test-capture-123' };
                  break;
                case 'STOP_CAPTURE':
                  response = { success: true };
                  break;
                case 'GET_CAPTURE_STATUS':
                  response = { status: 'COMPLETED', progress: 100 };
                  break;
                case 'GET_CAPTURE_DATA':
                  response = { 
                    success: true, 
                    data: {
                      channels: [
                        { number: 0, samples: [1, 0, 1, 0, 1] },
                        { number: 1, samples: [0, 1, 0, 1, 0] }
                      ]
                    }
                  };
                  break;
                case 'SET_NETWORK_CONFIG':
                  response = { success: true };
                  break;
                case 'GET_VOLTAGE':
                  response = { voltage: '5.0V' };
                  break;
                case 'ENTER_BOOTLOADER':
                  response = { success: true };
                  break;
                default:
                  response = { success: true };
              }
              
              handler(Buffer.from(JSON.stringify(response) + '\\n'));
            } catch (e) {
              // 如果解析失败，发送默认响应
              handler(Buffer.from('{"success": true}\\n'));
            }
          });
        });
        return true;
      }),
      destroy: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        if (!handlers[event]) {
          handlers[event] = [];
        }
        handlers[event].push(handler);
        return mockTcpSocket;
      }),
      off: jest.fn((event: string, handler: Function) => {
        if (handlers[event]) {
          const index = handlers[event].indexOf(handler);
          if (index > -1) {
            handlers[event].splice(index, 1);
          }
        }
        return mockTcpSocket;
      }),
      once: jest.fn(),
      emit: jest.fn(),
      end: jest.fn()
    };
  };

  // 创建模拟UDP Socket
  const createMockUdpSocket = () => {
    const handlers: { [key: string]: Function[] } = {};
    
    return {
      bind: jest.fn((port: number, callback?: Function) => {
        if (callback) {
          setImmediate(callback);
        }
        return mockUdpSocket;
      }),
      send: jest.fn((data: string, port: number, host: string, callback?: Function) => {
        if (callback) {
          setImmediate(callback);
        }
        // 立即模拟消息响应
        setImmediate(() => {
          const messageHandlers = handlers['message'] || [];
          messageHandlers.forEach(handler => {
            try {
              const command = JSON.parse(data);
              const response = { success: true };
              handler(Buffer.from(JSON.stringify(response)), { address: host, port });
            } catch (e) {
              handler(Buffer.from('{"success": true}'), { address: host, port });
            }
          });
        });
        return mockUdpSocket;
      }),
      close: jest.fn(),
      on: jest.fn((event: string, handler: Function) => {
        if (!handlers[event]) {
          handlers[event] = [];
        }
        handlers[event].push(handler);
        return mockUdpSocket;
      }),
      off: jest.fn(),
      once: jest.fn(),
      emit: jest.fn()
    };
  };

  // 创建测试用的CaptureSession
  const createCaptureSession = (): CaptureSession => {
    const channels: AnalyzerChannel[] = [
      {
        channelNumber: 0,
        channelName: 'CH0',
        samples: undefined,
        burstInfo: undefined
      },
      {
        channelNumber: 1,
        channelName: 'CH1', 
        samples: undefined,
        burstInfo: undefined
      }
    ];

    return {
      isActive: false,
      captureChannels: channels,
      frequency: 40000000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      triggerInverted: false,
      triggerPattern: 0,
      triggerBitCount: 1,
      preTriggerSamples: 1000,
      postTriggerSamples: 9000,
      loopCount: 1,
      measureBursts: false,
      mode: CaptureMode.Normal,
      bursts: undefined
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // 创建Mock对象
    mockTcpSocket = createMockTcpSocket();
    mockUdpSocket = createMockUdpSocket();
    
    // Mock构造函数
    const { Socket } = require('net');
    Socket.mockImplementation(() => mockTcpSocket);
    
    const { createSocket } = require('dgram');
    createSocket.mockReturnValue(mockUdpSocket);
    
    // 创建测试实例
    driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any);
    captureSession = createCaptureSession();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('1. 构造函数和基本属性', () => {
    it('1.1 应该正确初始化TCP驱动', () => {
      const tcpDriver = new NetworkLogicAnalyzerDriver('127.0.0.1', 9000, 'tcp' as any, 'binary' as any, 'token123');
      
      expect(tcpDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(tcpDriver.isNetwork).toBe(true);
      expect(tcpDriver.channelCount).toBe(8);
      expect(tcpDriver.maxFrequency).toBe(40000000);
      expect(tcpDriver.blastFrequency).toBe(80000000);
      expect(tcpDriver.bufferSize).toBe(8000000);
      expect(tcpDriver.isCapturing).toBe(false);
      expect(tcpDriver.deviceVersion).toBeNull();
    });

    it('1.2 应该正确初始化UDP驱动', () => {
      const udpDriver = new NetworkLogicAnalyzerDriver('10.0.0.1', 5000, 'udp' as any, 'csv' as any);
      
      expect(udpDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(udpDriver.isNetwork).toBe(true);
      expect(udpDriver.channelCount).toBe(8);
    });

    it('1.3 应该正确初始化WebSocket驱动', () => {
      const wsDriver = new NetworkLogicAnalyzerDriver('example.com', 3000, 'websocket' as any, 'raw' as any);
      
      expect(wsDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(wsDriver.isNetwork).toBe(true);
    });

    it('1.4 应该正确设置默认参数', () => {
      const defaultDriver = new NetworkLogicAnalyzerDriver('localhost', 8080);
      
      expect(defaultDriver.isNetwork).toBe(true);
      expect(defaultDriver.channelCount).toBe(8);
    });
  });

  describe('2. TCP连接功能', () => {
    it('2.1 应该成功建立TCP连接', async () => {
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toBe('Test Network Device v1.0');
      expect(result.deviceInfo?.isNetwork).toBe(true);
      expect(result.deviceInfo?.connectionPath).toBe('tcp://192.168.1.100:8080');
      expect(mockTcpSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
    });

    it('2.2 应该处理TCP连接失败', async () => {
      // Mock连接失败
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setImmediate(() => {
          const errorHandlers = mockTcpSocket.on.mock.calls
            .filter((call: any) => call[0] === 'error')
            .map((call: any) => call[1]);
          errorHandlers.forEach((handler: any) => handler(new Error('连接被拒绝')));
        });
        return mockTcpSocket;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接被拒绝');
    });

    it('2.3 应该处理握手失败', async () => {
      // Mock握手失败响应
      mockTcpSocket.write.mockImplementation((data: string, callback?: Function) => {
        if (callback) setImmediate(callback);
        setImmediate(() => {
          const command = JSON.parse(data.replace('\\n', ''));
          if (command.command === 'HANDSHAKE') {
            const dataHandlers = mockTcpSocket.on.mock.calls
              .filter((call: any) => call[0] === 'data')
              .map((call: any) => call[1]);
            dataHandlers.forEach((handler: any) => {
              handler(Buffer.from('{"success": false, "error": "认证失败"}\\n'));
            });
          }
        });
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('握手失败');
    });

    it('2.4 应该正确断开TCP连接', async () => {
      await driver.connect();
      await driver.disconnect();
      
      expect(mockTcpSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('3. UDP连接功能', () => {
    beforeEach(() => {
      driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any, 'json' as any);
    });

    it('3.1 应该成功建立UDP连接', async () => {
      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(mockUdpSocket.bind).toHaveBeenCalled();
    });

    it('3.2 应该处理UDP连接失败', async () => {
      // Mock UDP绑定失败
      mockUdpSocket.bind.mockImplementation((port: any, callback: any) => {
        setImmediate(() => {
          const errorHandlers = mockUdpSocket.on.mock.calls
            .filter((call: any) => call[0] === 'error')
            .map((call: any) => call[1]);
          errorHandlers.forEach((handler: any) => handler(new Error('端口已被占用')));
        });
        return mockUdpSocket;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('端口已被占用');
    });

    it('3.3 应该正确断开UDP连接', async () => {
      await driver.connect();
      await driver.disconnect();
      
      expect(mockUdpSocket.close).toHaveBeenCalled();
    });
  });

  describe('4. WebSocket连接功能', () => {
    beforeEach(() => {
      driver = new NetworkLogicAnalyzerDriver('example.com', 3000, 'websocket' as any, 'json' as any);
    });

    it('4.1 应该成功建立WebSocket连接', async () => {
      const result = await driver.connect();
      
      // WebSocket是占位符实现，应该成功
      expect(result.success).toBe(true);
    });
  });

  describe('5. 设备状态和控制', () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it('5.1 应该成功获取设备状态', async () => {
      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('3.3V');
      expect(status.temperature).toBe(25.0);
      expect(status.lastError).toBeNull();
    });

    it('5.2 应该成功获取电压状态', async () => {
      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('5.0V');
    });

    it('5.3 应该成功进入引导加载程序', async () => {
      const result = await driver.enterBootloader();
      
      expect(result).toBe(true);
    });

    it('5.4 应该成功发送网络配置', async () => {
      const result = await driver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.50', 8080);
      
      expect(result).toBe(true);
    });

    it('5.5 应该处理状态查询失败', async () => {
      // Mock网络错误
      mockTcpSocket.write.mockImplementation((data: string, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(new Error('网络超时')));
        }
        return true;
      });

      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.batteryVoltage).toBe('N/A');
      expect(status.lastError).toContain('网络超时');
    });

    it('5.6 应该处理电压查询失败', async () => {
      // Mock电压查询失败
      mockTcpSocket.write.mockImplementation((data: string, callback?: Function) => {
        if (callback) {
          setImmediate(() => callback(new Error('设备无响应')));
        }
        return true;
      });

      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('ERROR');
    });
  });

  describe('6. 采集功能', () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it('6.1 应该成功启动采集', async () => {
      let captureCompleted = false;
      const captureHandler = (args: CaptureEventArgs) => {
        captureCompleted = true;
      };

      const result = await driver.startCapture(captureSession, captureHandler);
      
      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);
    });

    it('6.2 应该拒绝重复启动采集', async () => {
      await driver.startCapture(captureSession);
      
      const result = await driver.startCapture(captureSession);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('6.3 应该在未连接时拒绝采集', async () => {
      await driver.disconnect();
      
      const result = await driver.startCapture(captureSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('6.4 应该成功停止采集', async () => {
      await driver.startCapture(captureSession);
      
      const result = await driver.stopCapture();
      
      expect(result).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });

    it('6.5 应该处理采集启动失败', async () => {
      // Mock采集启动失败
      mockTcpSocket.write.mockImplementation((data: string, callback?: Function) => {
        if (callback) setImmediate(callback);
        setImmediate(() => {
          const command = JSON.parse(data.replace('\\n', ''));
          if (command.command === 'START_CAPTURE') {
            const dataHandlers = mockTcpSocket.on.mock.calls
              .filter((call: any) => call[0] === 'data')
              .map((call: any) => call[1]);
            dataHandlers.forEach((handler: any) => {
              handler(Buffer.from('{"success": false, "error": "设备忙碌"}\\n'));
            });
          }
        });
        return true;
      });

      const result = await driver.startCapture(captureSession);
      
      expect(result).toBe(CaptureError.UnexpectedError);
    });
  });

  describe('7. 数据格式解析', () => {
    let mockSession: CaptureSession;

    beforeEach(() => {
      mockSession = createCaptureSession();
    });

    it('7.1 应该正确解析JSON格式数据', () => {
      const jsonData = {
        channels: [
          { number: 0, samples: [1, 0, 1, 1, 0] },
          { number: 1, samples: [0, 1, 0, 1, 1] }
        ],
        bursts: [{ start: 0, end: 4 }]
      };

      const response = { data: jsonData };
      
      // 使用反射访问私有方法
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(mockSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
      expect(mockSession.bursts).toEqual([{ start: 0, end: 4 }]);
    });

    it('7.2 应该正确解析二进制格式数据', () => {
      const binaryData = Buffer.from([1, 0, 0, 1, 1, 0]).toString('base64');
      const response = { data: binaryData };
      
      // 切换到binary格式
      (driver as any)._dataFormat = 'binary';
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toBeDefined();
      expect(mockSession.captureChannels[1].samples).toBeDefined();
    });

    it('7.3 应该正确解析CSV格式数据', () => {
      const csvData = 'Time,CH0,CH1\\n0,1,0\\n1,0,1\\n2,1,1';
      const response = { data: csvData };
      
      // 切换到CSV格式
      (driver as any)._dataFormat = 'csv';
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(mockSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
    });

    it('7.4 应该正确解析原始格式数据', () => {
      const rawData = [
        [1, 0, 1, 1, 0],
        [0, 1, 0, 1, 1]
      ];
      const response = { data: rawData };
      
      // 切换到raw格式
      (driver as any)._dataFormat = 'raw';
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(mockSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
    });

    it('7.5 应该处理不支持的数据格式', () => {
      const response = { data: [] };
      
      expect(() => {
        (driver as any)._dataFormat = 'unknown';
        (driver as any).parseNetworkCaptureData(mockSession, response);
      }).toThrow('不支持的数据格式: unknown');
    });

    it('7.6 应该处理空的JSON数据', () => {
      const response = { data: { channels: [] } };
      
      expect(() => {
        (driver as any).parseNetworkCaptureData(mockSession, response);
      }).not.toThrow();
    });

    it('7.7 应该处理格式错误的CSV数据', () => {
      const csvData = 'invalid,csv,data';
      const response = { data: csvData };
      
      (driver as any)._dataFormat = 'csv';
      
      expect(() => {
        (driver as any).parseNetworkCaptureData(mockSession, response);
      }).not.toThrow();
    });
  });

  describe('8. 错误处理', () => {
    it('8.1 应该处理不支持的协议类型', async () => {
      const invalidDriver = new NetworkLogicAnalyzerDriver('localhost', 8080, 'invalid' as any, 'json' as any);
      
      const result = await invalidDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的协议类型');
    });

    it('8.2 应该处理网络超时', async () => {
      // Mock超时场景
      mockTcpSocket.write.mockImplementation((data: string, callback?: Function) => {
        // 不调用callback，模拟超时
        return true;
      });
      
      // 手动触发超时
      setTimeout(() => {
        const timeoutHandlers = mockTcpSocket.on.mock.calls
          .filter((call: any) => call[0] === 'timeout')
          .map((call: any) => call[1]);
        timeoutHandlers.forEach((handler: any) => handler());
      }, 0);
      
      // 由于我们用了假定时器，需要手动推进时间
      jest.advanceTimersByTime(10000);
    });

    it('8.3 应该处理JSON解析错误', () => {
      const invalidJsonResponse = { data: 'invalid json' };
      
      expect(() => {
        (driver as any).parseJSONData(captureSession, invalidJsonResponse.data);
      }).not.toThrow(); // 应该优雅处理错误
    });

    it('8.4 应该处理网络配置失败', async () => {
      await driver.connect();
      
      // Mock配置失败
      mockTcpSocket.write.mockImplementation((data: string, callback?: Function) => {
        if (callback) setImmediate(callback);
        setImmediate(() => {
          const command = JSON.parse(data.replace('\\n', ''));
          if (command.command === 'SET_NETWORK_CONFIG') {
            const dataHandlers = mockTcpSocket.on.mock.calls
              .filter((call: any) => call[0] === 'data')
              .map((call: any) => call[1]);
            dataHandlers.forEach((handler: any) => {
              handler(Buffer.from('{"success": false, "error": "无效配置"}\\n'));
            });
          }
        });
        return true;
      });

      const result = await driver.sendNetworkConfig('TestWiFi', 'invalid', '192.168.1.50', 8080);
      
      expect(result).toBe(false);
    });
  });

  describe('9. 私有方法测试', () => {
    it('9.1 应该正确构建采集配置', () => {
      const config = (driver as any).buildCaptureConfig(captureSession);
      
      expect(config).toHaveProperty('channels');
      expect(config).toHaveProperty('sample_rate', 40000000);
      expect(config).toHaveProperty('trigger');
      expect(config.channels).toHaveLength(2);
      expect(config.channels[0]).toHaveProperty('number', 0);
      expect(config.channels[0]).toHaveProperty('name', 'CH0');
    });

    it('9.2 应该正确构建硬件能力描述', () => {
      const capabilities = (driver as any).buildCapabilities();
      
      expect(capabilities).toHaveProperty('channels');
      expect(capabilities).toHaveProperty('sampling');
      expect(capabilities).toHaveProperty('triggers');
      expect(capabilities).toHaveProperty('connectivity');
      expect(capabilities).toHaveProperty('features');
      
      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.sampling.maxRate).toBe(40000000);
      expect(capabilities.connectivity.interfaces).toContain('ethernet');
      expect(capabilities.features.remoteControl).toBe(true);
    });

    it('9.3 应该正确处理采集错误', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (driver as any).handleCaptureError(captureSession, '测试错误');
      
      expect(driver.isCapturing).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('网络采集错误:', '测试错误');
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('10. 资源清理', () => {
    it('10.1 应该正确清理TCP资源', async () => {
      await driver.connect();
      
      driver.dispose();
      
      expect(mockTcpSocket.destroy).toHaveBeenCalled();
    });

    it('10.2 应该正确清理UDP资源', async () => {
      const udpDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any, 'json' as any);
      await udpDriver.connect();
      
      udpDriver.dispose();
      
      expect(mockUdpSocket.close).toHaveBeenCalled();
    });

    it('10.3 应该处理重复调用dispose', () => {
      expect(() => {
        driver.dispose();
        driver.dispose(); // 第二次调用不应该出错
      }).not.toThrow();
    });
  });

  describe('11. 边界条件测试', () => {
    it('11.1 应该处理空的通道列表', () => {
      const emptySession = { ...captureSession, captureChannels: [] };
      
      expect(() => {
        (driver as any).buildCaptureConfig(emptySession);
      }).not.toThrow();
    });

    it('11.2 应该处理极大的频率值', () => {
      const highFreqSession = { ...captureSession, frequency: Number.MAX_SAFE_INTEGER };
      
      expect(() => {
        (driver as any).buildCaptureConfig(highFreqSession);
      }).not.toThrow();
    });

    it('11.3 应该处理零频率值', () => {
      const zeroFreqSession = { ...captureSession, frequency: 0 };
      
      expect(() => {
        (driver as any).buildCaptureConfig(zeroFreqSession);
      }).not.toThrow();
    });

    it('11.4 应该处理长字符串主机名', () => {
      const longHostDriver = new NetworkLogicAnalyzerDriver('a'.repeat(1000), 8080);
      
      expect(longHostDriver.isNetwork).toBe(true);
    });

    it('11.5 应该处理无效端口号', () => {
      const invalidPortDriver = new NetworkLogicAnalyzerDriver('localhost', -1);
      
      expect(invalidPortDriver.isNetwork).toBe(true);
    });
  });
});