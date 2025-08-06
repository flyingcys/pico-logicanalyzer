/**
 * NetworkLogicAnalyzerDriver 单元测试
 * 测试网络逻辑分析器驱动的完整功能
 * 包括TCP/UDP/WebSocket协议支持和多种数据格式解析
 */

import { NetworkLogicAnalyzerDriver } from '../../../../src/drivers/NetworkLogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../../src/models/CaptureModels';
import { 
  AnalyzerDriverType, 
  CaptureError, 
  TriggerType, 
  CaptureMode,
  CaptureEventArgs,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus
} from '../../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { Socket as UDPSocket } from 'dgram';

// Mock网络模块
jest.mock('net');
jest.mock('dgram');

// Mock全局定时器 - 只在需要的测试中使用
// jest.useFakeTimers();

describe('NetworkLogicAnalyzerDriver', () => {
  let driver: NetworkLogicAnalyzerDriver;
  let mockTcpSocket: jest.Mocked<Socket>;
  let mockUdpSocket: jest.Mocked<UDPSocket>;
  let captureSession: CaptureSession;

  // 创建Mock TCP Socket
  const createMockTcpSocket = (): jest.Mocked<Socket> => {
    return {
      connect: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      end: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      setTimeout: jest.fn(),
      setNoDelay: jest.fn(),
      setKeepAlive: jest.fn(),
      address: jest.fn(),
      unref: jest.fn(),
      ref: jest.fn(),
    } as any;
  };

  // 创建Mock UDP Socket
  const createMockUdpSocket = (): jest.Mocked<UDPSocket> => {
    return {
      bind: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      address: jest.fn(),
      setBroadcast: jest.fn(),
      setMulticastTTL: jest.fn(),
      setMulticastInterface: jest.fn(),
      setMulticastLoopback: jest.fn(),
      addMembership: jest.fn(),
      dropMembership: jest.fn(),
      setTTL: jest.fn(),
      ref: jest.fn(),
      unref: jest.fn(),
    } as any;
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
    // 清理所有Mock
    jest.clearAllMocks();
    
    // 创建Mock对象
    mockTcpSocket = createMockTcpSocket();
    mockUdpSocket = createMockUdpSocket();
    
    // Mock构造函数
    (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockTcpSocket);
    
    // Mock createSocket函数
    const { createSocket } = require('dgram');
    createSocket.mockReturnValue(mockUdpSocket);
    
    // 创建测试实例
    driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any);
    captureSession = createCaptureSession();
  });

  afterEach(() => {
    // 清理工作
    jest.clearAllMocks();
  });

  describe('构造函数和基本属性', () => {
    it('应该正确初始化TCP驱动', () => {
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

    it('应该正确初始化UDP驱动', () => {
      const udpDriver = new NetworkLogicAnalyzerDriver('10.0.0.1', 5000, 'udp' as any, 'csv' as any);
      
      expect(udpDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(udpDriver.isNetwork).toBe(true);
    });

    it('应该正确初始化WebSocket驱动', () => {
      const wsDriver = new NetworkLogicAnalyzerDriver('example.com', 3000, 'websocket' as any, 'raw' as any);
      
      expect(wsDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(wsDriver.isNetwork).toBe(true);
    });
  });

  describe('TCP连接功能', () => {
    it('应该成功建立TCP连接', async () => {
      // 模拟TCP连接成功
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        process.nextTick(() => callback());
        return mockTcpSocket;
      });

      // 模拟握手成功
      let writeCallCount = 0;
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        process.nextTick(() => {
          // 模拟握手响应
          const dataHandlers = mockTcpSocket.on.mock.calls.filter(call => call[0] === 'data');
          const handshakeHandler = dataHandlers[dataHandlers.length - 1]?.[1];
          if (handshakeHandler) {
            if (writeCallCount === 0) {
              // 第一次是握手
              handshakeHandler(Buffer.from('{"success": true}\n'));
            } else {
              // 后续是设备信息查询
              handshakeHandler(Buffer.from('{"device_info": {"version": "Test Device"}}\n'));
            }
          }
          writeCallCount++;
          callback?.();
        });
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toBe('Test Device');
      expect(result.deviceInfo?.isNetwork).toBe(true);
      expect(mockTcpSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
    });

    it('应该处理TCP连接失败', async () => {
      // 模拟TCP连接失败
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        return mockTcpSocket;
      });
      
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error('连接被拒绝')));
        }
        return mockTcpSocket;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('连接被拒绝');
    });

    it('应该处理握手失败', async () => {
      // 模拟TCP连接成功但握手失败
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });

      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": false, "error": "认证失败"}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('握手失败');
    });
  });

  describe('UDP连接功能', () => {
    beforeEach(() => {
      driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any, 'json' as any);
    });

    it('应该成功建立UDP连接', async () => {
      // 模拟UDP绑定成功
      mockUdpSocket.bind.mockImplementation((port: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockUdpSocket;
      });

      // 模拟握手成功
      mockUdpSocket.send.mockImplementation((data: any, port: any, host: any, callback: any) => {
        setTimeout(() => {
          const messageHandler = mockUdpSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
          if (messageHandler) {
            messageHandler(Buffer.from('{"success": true}'), { address: host, port });
          }
          callback?.();
        }, 0);
        return mockUdpSocket;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(true);
      expect(mockUdpSocket.bind).toHaveBeenCalled();
    });

    it('应该处理UDP连接失败', async () => {
      // 模拟UDP绑定失败
      mockUdpSocket.bind.mockImplementation((port: any, callback: any) => {
        return mockUdpSocket;
      });
      
      mockUdpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('端口已被占用')), 0);
        }
        return mockUdpSocket;
      });

      const result = await driver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('端口已被占用');
    });
  });

  describe('WebSocket连接功能', () => {
    beforeEach(() => {
      driver = new NetworkLogicAnalyzerDriver('example.com', 3000, 'websocket' as any, 'json' as any);
    });

    it('应该成功建立WebSocket连接', async () => {
      const result = await driver.connect();
      
      // WebSocket是占位符实现，应该成功
      expect(result.success).toBe(true);
    });
  });

  describe('设备状态查询', () => {
    beforeEach(async () => {
      // 首先建立连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
    });

    it('应该成功获取设备状态', async () => {
      // 模拟状态查询响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"battery_voltage": "3.7V", "temperature": 25.5}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('3.7V');
      expect(status.temperature).toBe(25.5);
    });

    it('应该处理状态查询失败', async () => {
      // 模拟网络错误
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => callback(new Error('网络错误')), 0);
        return true;
      });

      const status = await driver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('N/A');
      expect(status.lastError).toContain('网络错误');
    });
  });

  describe('采集控制功能', () => {
    beforeEach(async () => {
      // 建立连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
    });

    it('应该成功启动采集', async () => {
      let captureCompleted = false;
      const captureHandler = (args: CaptureEventArgs) => {
        captureCompleted = true;
      };

      // 模拟启动采集响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        const command = JSON.parse(data.replace('\n', ''));
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            if (command.command === 'START_CAPTURE') {
              dataHandler(Buffer.from('{"success": true, "capture_id": "cap123"}\n'));
            } else if (command.command === 'GET_CAPTURE_STATUS') {
              dataHandler(Buffer.from('{"status": "COMPLETED"}\n'));
            } else if (command.command === 'GET_CAPTURE_DATA') {
              dataHandler(Buffer.from('{"success": true, "data": {"channels": []}}\n'));
            }
          }
          callback?.();
        }, 0);
        return true;
      });

      const result = await driver.startCapture(captureSession, captureHandler);
      
      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);

      // 模拟采集进度检查
      jest.advanceTimersByTime(200);
      
      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('应该拒绝重复启动采集', async () => {
      // 先启动一次采集
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"success": true, "capture_id": "cap123"}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      await driver.startCapture(captureSession);
      
      // 尝试再次启动
      const result = await driver.startCapture(captureSession);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该在未连接时拒绝采集', async () => {
      // 断开连接
      await driver.disconnect();
      
      const result = await driver.startCapture(captureSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该成功停止采集', async () => {
      // 先启动采集
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      await driver.startCapture(captureSession);
      
      const result = await driver.stopCapture();
      
      expect(result).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });
  });

  describe('网络配置功能', () => {
    beforeEach(async () => {
      // 建立连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
    });

    it('应该成功发送网络配置', async () => {
      // 模拟配置成功响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const result = await driver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.50', 8080);
      
      expect(result).toBe(true);
    });

    it('应该处理网络配置失败', async () => {
      // 模拟配置失败响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"success": false, "error": "无效的密码"}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const result = await driver.sendNetworkConfig('TestWiFi', 'wrong', '192.168.1.50', 8080);
      
      expect(result).toBe(false);
    });
  });

  describe('电压状态功能', () => {
    beforeEach(async () => {
      // 建立连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
    });

    it('应该成功获取电压状态', async () => {
      // 模拟电压查询响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"voltage": "5.0V"}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('5.0V');
    });

    it('应该处理电压查询失败', async () => {
      // 模拟网络错误
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => callback(new Error('超时')), 0);
        return true;
      });

      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('ERROR');
    });
  });

  describe('引导加载程序功能', () => {
    beforeEach(async () => {
      // 建立连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
    });

    it('应该成功进入引导加载程序', async () => {
      // 模拟成功响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const result = await driver.enterBootloader();
      
      expect(result).toBe(true);
    });

    it('应该处理引导加载程序失败', async () => {
      // 模拟失败响应
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const dataHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler(Buffer.from('{"success": false}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });

      const result = await driver.enterBootloader();
      
      expect(result).toBe(false);
    });
  });

  describe('断开连接功能', () => {
    it('应该正确断开TCP连接', async () => {
      // 建立TCP连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
      
      // 断开连接
      await driver.disconnect();
      
      expect(mockTcpSocket.destroy).toHaveBeenCalled();
    });

    it('应该正确断开UDP连接', async () => {
      // 创建UDP驱动
      const udpDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any, 'json' as any);
      
      // 建立UDP连接
      mockUdpSocket.bind.mockImplementation((port: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockUdpSocket;
      });
      
      mockUdpSocket.send.mockImplementation((data: any, port: any, host: any, callback: any) => {
        setTimeout(() => {
          const messageHandler = mockUdpSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
          if (messageHandler) {
            messageHandler(Buffer.from('{"success": true}'), { address: host, port });
          }
          callback?.();
        }, 0);
        return mockUdpSocket;
      });
      
      await udpDriver.connect();
      
      // 断开连接
      await udpDriver.disconnect();
      
      expect(mockUdpSocket.close).toHaveBeenCalled();
    });
  });

  describe('数据格式解析', () => {
    let mockSession: CaptureSession;

    beforeEach(() => {
      mockSession = createCaptureSession();
    });

    it('应该正确解析JSON格式数据', () => {
      const jsonData = {
        channels: [
          { number: 0, samples: [1, 0, 1, 1, 0] },
          { number: 1, samples: [0, 1, 0, 1, 1] }
        ],
        bursts: [{ start: 0, end: 4 }]
      };

      const response = { data: jsonData };
      
      // 使用反射访问私有方法进行测试
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(mockSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
      expect(mockSession.bursts).toEqual([{ start: 0, end: 4 }]);
    });

    it('应该正确解析二进制格式数据', () => {
      const binaryData = Buffer.from([1, 0, 0, 1, 1, 0]).toString('base64');
      const response = { data: binaryData };
      
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toBeDefined();
      expect(mockSession.captureChannels[1].samples).toBeDefined();
    });

    it('应该正确解析CSV格式数据', () => {
      const csvData = 'Time,CH0,CH1\\n0,1,0\\n1,0,1\\n2,1,1';
      const response = { data: csvData };
      
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(mockSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
    });

    it('应该正确解析原始格式数据', () => {
      const rawData = [
        [1, 0, 1, 1, 0],
        [0, 1, 0, 1, 1]
      ];
      const response = { data: rawData };
      
      (driver as any).parseNetworkCaptureData(mockSession, response);
      
      expect(mockSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(mockSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
    });

    it('应该处理不支持的数据格式', () => {
      const response = { data: [] };
      
      expect(() => {
        (driver as any)._dataFormat = 'unknown';
        (driver as any).parseNetworkCaptureData(mockSession, response);
      }).toThrow('不支持的数据格式: unknown');
    });
  });

  describe('错误处理', () => {
    it('应该处理不支持的协议类型', async () => {
      const invalidDriver = new NetworkLogicAnalyzerDriver('localhost', 8080, 'invalid' as any, 'json' as any);
      
      const result = await invalidDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的协议类型');
    });

    it('应该处理网络超时', async () => {
      // 模拟连接成功但命令超时
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      // 不触发数据事件，让命令超时
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        callback?.();
        return true;
      });
      
      // 快进到超时
      setTimeout(async () => {
        const result = await driver.connect();
        expect(result.success).toBe(false);
      }, 0);
      
      jest.advanceTimersByTime(10000);
    });
  });

  describe('资源清理', () => {
    it('应该正确清理资源', async () => {
      // 建立连接
      mockTcpSocket.connect.mockImplementation((port: any, host: any, callback: any) => {
        setTimeout(() => callback(), 0);
        return mockTcpSocket;
      });
      
      mockTcpSocket.write.mockImplementation((data: any, callback: any) => {
        setTimeout(() => {
          const handshakeHandler = mockTcpSocket.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (handshakeHandler) {
            handshakeHandler(Buffer.from('{"success": true}\n'));
          }
          callback?.();
        }, 0);
        return true;
      });
      
      await driver.connect();
      
      // 清理资源
      driver.dispose();
      
      expect(mockTcpSocket.destroy).toHaveBeenCalled();
    });
  });
});