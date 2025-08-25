/**
 * NetworkLogicAnalyzerDriver 精准业务逻辑测试
 * 
 * 基于深度思考方法论和Drivers层突破成功经验:
 * - 专注测试@src源码真实业务逻辑，不偏移方向
 * - 最小化Mock使用，验证核心网络通信算法
 * - 应用错误驱动学习，发现真实接口行为
 * - 系统性覆盖协议选择、握手认证、数据解析等8大核心功能
 * 
 * 目标: 基于MultiAnalyzerDriver成功经验
 * 将NetworkLogicAnalyzerDriver覆盖率实现Drivers层进一步突破
 */

import { NetworkLogicAnalyzerDriver } from '../../../src/drivers/NetworkLogicAnalyzerDriver';
import {
  AnalyzerDriverType,
  CaptureError,
  TriggerType,
  CaptureMode,
  CaptureSession,
  AnalyzerChannel,
  ConnectionParams,
  CaptureEventArgs
} from '../../../src/models/AnalyzerTypes';

// 最小化Mock：只Mock Node.js网络模块，保留NetworkLogicAnalyzerDriver业务逻辑
jest.mock('net');
jest.mock('dgram');

import { Socket } from 'net';
import { createSocket } from 'dgram';

describe('NetworkLogicAnalyzerDriver 精准业务逻辑测试', () => {
  let networkDriver: NetworkLogicAnalyzerDriver;
  let mockTcpSocket: jest.Mocked<Socket>;
  let mockUdpSocket: any;

  // 创建测试用的真实采集会话数据
  const createTestSession = (overrides: Partial<CaptureSession> = {}): CaptureSession => ({
    frequency: 1000000,
    preTriggerSamples: 1000,
    postTriggerSamples: 1000,
    triggerType: TriggerType.Complex,
    triggerChannel: 0,
    triggerInverted: false,
    loopCount: 1,
    measureBursts: false,
    captureChannels: [
      createTestChannel(0),
      createTestChannel(1),
      createTestChannel(2),
      createTestChannel(3)
    ],
    get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
    clone() { return { ...this }; },
    cloneSettings() { return { ...this }; },
    ...overrides
  });

  // 创建测试通道
  const createTestChannel = (channelNumber: number): AnalyzerChannel => ({
    channelNumber,
    channelName: `Channel ${channelNumber}`,
    textualChannelNumber: channelNumber.toString(),
    hidden: false,
    channelColor: 0xFF0000,
    enabled: true,
    minimized: false,
    clone() { return { ...this }; }
  });

  // 设置Mock Socket行为
  const setupMockSockets = () => {
    mockTcpSocket = {
      connect: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnValue(true),
      destroy: jest.fn(),
      on: jest.fn().mockReturnThis(),
      off: jest.fn().mockReturnThis()
    } as jest.Mocked<Socket>;

    mockUdpSocket = {
      bind: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockTcpSocket);
    (createSocket as jest.MockedFunction<typeof createSocket>).mockReturnValue(mockUdpSocket);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockSockets();
  });

  describe('构造函数和网络驱动核心逻辑', () => {
    it('应该正确创建TCP网络驱动实例', () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      
      expect(networkDriver).toBeDefined();
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(networkDriver.isNetwork).toBe(true);
      expect(networkDriver.isCapturing).toBe(false);
    });

    it('应该正确创建UDP网络驱动实例', () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any);
      
      expect(networkDriver).toBeDefined();
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(networkDriver.isNetwork).toBe(true);
    });

    it('应该正确设置默认设备属性', () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      
      expect(networkDriver.channelCount).toBe(8); // 默认8通道
      expect(networkDriver.maxFrequency).toBe(40000000); // 40MHz默认
      expect(networkDriver.bufferSize).toBe(8000000); // 8M样本默认
    });

    it('应该正确处理认证token参数', () => {
      const authToken = 'test-auth-token-123';
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any, authToken);
      
      expect(networkDriver).toBeDefined();
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
    });
  });

  describe('网络协议连接管理核心算法', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该正确处理TCP连接流程', async () => {
      // Mock TCP连接成功
      mockTcpSocket.connect.mockImplementation((port: number, host: string, callback?: () => void) => {
        if (callback) callback();
        return true;
        return mockTcpSocket;
      });
      
      // Mock握手和设备信息查询响应
      let responseCount = 0;
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          // 延迟触发响应以模拟网络通信
          setTimeout(() => {
            responseCount++;
            if (responseCount === 1) {
              // 握手响应
              handler(Buffer.from('{"success": true, "message": "handshake ok"}\\n'));
            } else if (responseCount === 2) {
              // 设备信息响应
              handler(Buffer.from('{"device_info": {"version": "NetworkLA-v1.2.3", "channels": 16, "max_frequency": 50000000}}\\n'));
            }
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toContain('NetworkLA-v1.2.3');
      expect(result.deviceInfo?.connectionPath).toBe('tcp://192.168.1.100:8080');
      expect(result.deviceInfo?.isNetwork).toBe(true);
      
      // 验证连接流程被调用
      expect(mockTcpSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
      expect(mockTcpSocket.on).toHaveBeenCalled();
    });

    it('应该正确处理UDP连接流程', async () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any);
      
      // Mock UDP连接成功
      mockUdpSocket.bind.mockImplementation((port: number, callback?: () => void) => {
        if (callback) callback();
        return true;
      });
      
      // Mock UDP响应
      let responseCount = 0;
      mockUdpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') {
          setTimeout(() => {
            responseCount++;
            if (responseCount === 1) {
              // 握手响应
              handler(Buffer.from('{"success": true, "message": "handshake ok"}'), {});
            } else if (responseCount === 2) {
              // 设备信息响应
              handler(Buffer.from('{"device_info": {"version": "UDP-NetworkLA-v2.0", "channels": 32}}'), {});
            }
          }, 10);
        }
        return mockUdpSocket;
      });

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo?.connectionPath).toBe('udp://192.168.1.100:8080');
      expect(mockUdpSocket.bind).toHaveBeenCalled();
    });

    it('应该处理连接失败情况', async () => {
      // Mock TCP连接失败
      mockTcpSocket.connect.mockImplementation((port: number, host: string, callback?: () => void) => {
        // 不调用callback，而是触发error事件
      });
      
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'error') {
          setTimeout(() => {
            handler(new Error('Connection refused'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('TCP连接失败');
    });

    it('应该正确处理不支持的协议类型', async () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'invalid-protocol' as any);

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的协议类型');
    });
  });

  describe('握手认证和设备查询核心算法', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any, 'auth-token-123');
    });

    it('应该发送正确的握手命令', async () => {
      // Mock成功的TCP连接
      mockTcpSocket.connect.mockImplementation((port: number, host: string, callback?: () => void) => {
        if (callback) callback();
        return true;
      });
      
      // 监听写入的数据以验证握手内容
      let handshakeCommand: any = null;
      mockTcpSocket.write.mockImplementation((data: string | Uint8Array, callback?: (error?: Error) => void) => {
        const commandStr = data.toString().replace('\\n', '');
        try {
          handshakeCommand = JSON.parse(commandStr);
        } catch (e) {
          // 忽略解析错误
        }
        if (callback) callback();
        return true;
      });

      // Mock响应
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            // 首次调用：握手响应
            handler(Buffer.from('{"success": true}\\n'));
            setTimeout(() => {
              // 第二次调用：设备信息响应
              handler(Buffer.from('{"device_info": {"version": "TestDevice"}}\\n'));
            }, 5);
          }, 10);
        }
        return mockTcpSocket;
      });

      await networkDriver.connect();
      
      // 验证握手命令的内容
      expect(handshakeCommand).toBeTruthy();
      expect(handshakeCommand.command).toBe('HANDSHAKE');
      expect(handshakeCommand.version).toBe('1.0');
      expect(handshakeCommand.client_type).toBe('vscode-logic-analyzer');
      expect(handshakeCommand.auth_token).toBe('auth-token-123');
      expect(handshakeCommand.timestamp).toBeGreaterThan(0);
    });

    it('应该处理握手失败', async () => {
      mockTcpSocket.connect.mockImplementation((port: number, host: string, callback?: () => void) => {
        if (callback) callback();
        return true;
      });
      
      // Mock握手失败响应
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": false, "error": "Invalid auth token"}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('握手失败');
    });

    it('应该正确解析设备信息并更新属性', async () => {
      mockTcpSocket.connect.mockImplementation((port: number, host: string, callback?: () => void) => {
        if (callback) callback();
        return true;
      });
      
      // Mock详细的设备信息响应
      let responseCount = 0;
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            responseCount++;
            if (responseCount === 1) {
              handler(Buffer.from('{"success": true}\\n'));
            } else if (responseCount === 2) {
              const deviceInfo = {
                device_info: {
                  version: 'AdvancedNetworkLA-v3.1.4',
                  channels: 64,
                  max_frequency: 100000000,
                  blast_frequency: 200000000,
                  buffer_size: 16000000,
                  config: {
                    signal_generation: true,
                    power_supply: true,
                    voltage_monitoring: true
                  }
                }
              };
              handler(Buffer.from(JSON.stringify(deviceInfo) + '\\n'));
            }
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(true);
      // 验证设备属性被正确更新
      expect(networkDriver.deviceVersion).toBe('AdvancedNetworkLA-v3.1.4');
      expect(networkDriver.channelCount).toBe(64);
      expect(networkDriver.maxFrequency).toBe(100000000);
      expect(networkDriver.bufferSize).toBe(16000000);
    });
  });

  describe('采集控制和状态管理核心算法', () => {
    beforeEach(async () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      
      // 预先建立连接
      mockTcpSocket.connect.mockImplementation((port: number, host: string, callback?: () => void) => {
        if (callback) callback();
        return true;
      });
      
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": true}\\n'));
            setTimeout(() => {
              handler(Buffer.from('{"device_info": {"version": "TestDevice"}}\\n'));
            }, 5);
          }, 10);
        }
        return mockTcpSocket;
      });

      await networkDriver.connect();
      jest.clearAllMocks();
    });

    it('应该正确构建采集配置', async () => {
      const testSession = createTestSession({
        frequency: 2000000,
        preTriggerSamples: 500,
        postTriggerSamples: 1500,
        triggerType: TriggerType.Complex,
        triggerChannel: 2,
        triggerInverted: true
      });

      let captureConfig: any = null;
      mockTcpSocket.write.mockImplementation((data: string | Uint8Array, callback?: (error?: Error) => void) => {
        try {
          const command = JSON.parse(data.toString().replace('\\n', ''));
          if (command.command === 'START_CAPTURE') {
            captureConfig = command.config;
          }
        } catch (e) {
          // 忽略解析错误
        }
        if (callback) callback();
        return true;
      });

      // Mock采集启动成功响应
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": true, "capture_id": "cap-123"}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.startCapture(testSession);
      
      expect(result).toBe(CaptureError.None);
      expect(captureConfig).toBeTruthy();
      expect(captureConfig.sample_rate).toBe(2000000);
      expect(captureConfig.pre_trigger_samples).toBe(500);
      expect(captureConfig.post_trigger_samples).toBe(1500);
      expect(captureConfig.trigger.type).toBe(TriggerType.Complex);
      expect(captureConfig.trigger.channel).toBe(2);
      expect(captureConfig.trigger.inverted).toBe(true);
      expect(captureConfig.channels).toHaveLength(4);
      expect(captureConfig.data_format).toBe('json');
    });

    it('应该拒绝忙状态下的采集请求', async () => {
      // 设置为采集状态
      (networkDriver as any)._capturing = true;

      const result = await networkDriver.startCapture(createTestSession());
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该拒绝未连接状态下的采集请求', async () => {
      // 设置为未连接状态
      (networkDriver as any)._isConnected = false;

      const result = await networkDriver.startCapture(createTestSession());
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该正确处理采集启动失败', async () => {
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": false, "error": "Device busy"}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.startCapture(createTestSession());
      
      expect(result).toBe(CaptureError.UnexpectedError);
      expect(networkDriver.isCapturing).toBe(false);
    });
  });

  describe('设备状态查询核心算法', () => {
    beforeEach(async () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      (networkDriver as any)._isConnected = true;
    });

    it('应该正确查询设备状态', async () => {
      // Mock状态响应
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            const statusResponse = {
              success: true,
              battery_voltage: '4.2V',
              temperature: 45.6,
              last_error: null
            };
            handler(Buffer.from(JSON.stringify(statusResponse) + '\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const status = await networkDriver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBe('4.2V');
      expect(status.temperature).toBe(45.6);
      expect(status.lastError).toBeNull();
    });

    it('应该处理状态查询失败', async () => {
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            throw new Error('Network timeout');
          }, 10);
        }
        return mockTcpSocket;
      });

      const status = await networkDriver.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.batteryVoltage).toBe('N/A');
      expect(status.lastError).toContain('状态查询失败');
    });
  });

  describe('网络配置和电压状态核心功能', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      (networkDriver as any)._isConnected = true;
    });

    it('应该正确发送网络配置', async () => {
      let networkConfig: any = null;
      mockTcpSocket.write.mockImplementation((data: string | Uint8Array, callback?: (error?: Error) => void) => {
        try {
          const command = JSON.parse(data.toString().replace('\\n', ''));
          if (command.command === 'SET_NETWORK_CONFIG') {
            networkConfig = command.config;
          }
        } catch (e) {
          // 忽略解析错误
        }
        if (callback) callback();
        return true;
      });

      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": true}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.sendNetworkConfig('TestNetwork', 'password123', '192.168.1.50', 9090);
      
      expect(result).toBe(true);
      expect(networkConfig).toBeTruthy();
      expect(networkConfig.ssid).toBe('TestNetwork');
      expect(networkConfig.password).toBe('password123');
      expect(networkConfig.ip_address).toBe('192.168.1.50');
      expect(networkConfig.port).toBe(9090);
    });

    it('应该正确查询电压状态', async () => {
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"voltage": "3.3V"}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const voltage = await networkDriver.getVoltageStatus();
      
      expect(voltage).toBe('3.3V');
    });

    it('应该处理电压查询失败', async () => {
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            throw new Error('Command timeout');
          }, 10);
        }
        return mockTcpSocket;
      });

      const voltage = await networkDriver.getVoltageStatus();
      
      expect(voltage).toBe('ERROR');
    });
  });

  describe('数据格式解析核心算法', () => {
    let testSession: CaptureSession;

    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'tcp' as any, 'json' as any);
      testSession = createTestSession();
    });

    it('应该正确解析JSON格式数据', () => {
      const parseJSONData = (networkDriver as any).parseJSONData.bind(networkDriver);
      
      const jsonData = {
        channels: [
          { number: 0, samples: [1, 0, 1, 1, 0] },
          { number: 1, samples: [0, 1, 0, 1, 1] },
          { number: 2, samples: [1, 1, 0, 0, 1] },
          { number: 3, samples: [0, 0, 1, 1, 0] }
        ],
        bursts: [
          { channel: 0, start: 10, end: 20 },
          { channel: 1, start: 30, end: 40 }
        ]
      };

      parseJSONData(testSession, jsonData);
      
      // 验证通道数据被正确设置
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 1, 0, 0, 1]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 0, 1, 1, 0]));
      
      // 验证突发信息被正确设置
      expect(testSession.bursts).toEqual(jsonData.bursts);
    });

    it('应该正确解析Binary格式数据', () => {
      const parseBinaryData = (networkDriver as any).parseBinaryData.bind(networkDriver);
      
      // 创建测试二进制数据 (Base64编码)
      const binaryArray = new Uint8Array([
        1, 0, 1, 0,  // 第一个样本：CH0=1, CH1=0, CH2=1, CH3=0
        0, 1, 0, 1,  // 第二个样本：CH0=0, CH1=1, CH2=0, CH3=1
        1, 1, 0, 0   // 第三个样本：CH0=1, CH1=1, CH2=0, CH3=0
      ]);
      const base64Data = Buffer.from(binaryArray).toString('base64');

      parseBinaryData(testSession, base64Data);
      
      // 验证每个通道的数据
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 0, 0]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 1, 0]));
    });

    it('应该正确解析CSV格式数据', () => {
      const parseCSVData = (networkDriver as any).parseCSVData.bind(networkDriver);
      
      const csvData = `Time,CH0,CH1,CH2,CH3\\n` +
                     `0.1,1,0,1,0\\n` +
                     `0.2,0,1,0,1\\n` +
                     `0.3,1,1,0,0\\n`;

      parseCSVData(testSession, csvData);
      
      // 验证CSV数据被正确解析
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 0, 0]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 1, 0]));
    });

    it('应该正确解析Raw格式数据', () => {
      const parseRawData = (networkDriver as any).parseRawData.bind(networkDriver);
      
      const rawData = [
        [1, 0, 1, 1, 0],  // CH0数据
        [0, 1, 0, 1, 1],  // CH1数据
        [1, 1, 0, 0, 1],  // CH2数据
        [0, 0, 1, 1, 0]   // CH3数据
      ];

      parseRawData(testSession, rawData);
      
      // 验证原始数据被正确设置
      expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1, 1]));
      expect(testSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 1, 0, 0, 1]));
      expect(testSession.captureChannels[3].samples).toEqual(new Uint8Array([0, 0, 1, 1, 0]));
    });
  });

  describe('引导加载程序和停止采集功能', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
      (networkDriver as any)._isConnected = true;
    });

    it('应该正确进入引导加载程序模式', async () => {
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": true}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.enterBootloader();
      
      expect(result).toBe(true);
    });

    it('应该处理引导加载程序进入失败', async () => {
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": false, "error": "Bootloader not available"}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.enterBootloader();
      
      expect(result).toBe(false);
    });

    it('应该正确停止采集', async () => {
      // 设置为采集状态
      (networkDriver as any)._capturing = true;

      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from('{"success": true}\\n'));
          }, 10);
        }
        return mockTcpSocket;
      });

      const result = await networkDriver.stopCapture();
      
      expect(result).toBe(true);
      expect(networkDriver.isCapturing).toBe(false);
    });

    it('应该处理非采集状态下的停止请求', async () => {
      // 确保未处于采集状态
      expect(networkDriver.isCapturing).toBe(false);

      const result = await networkDriver.stopCapture();
      
      expect(result).toBe(true);
    });
  });

  describe('连接断开和资源清理', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该正确断开TCP连接', async () => {
      // 模拟已建立连接的状态
      (networkDriver as any)._tcpSocket = mockTcpSocket;
      (networkDriver as any)._isConnected = true;

      await networkDriver.disconnect();
      
      expect(mockTcpSocket.destroy).toHaveBeenCalled();
      expect((networkDriver as any)._tcpSocket).toBeUndefined();
      expect((networkDriver as any)._isConnected).toBe(false);
    });

    it('应该正确断开UDP连接', async () => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080, 'udp' as any);
      (networkDriver as any)._udpSocket = mockUdpSocket;
      (networkDriver as any)._isConnected = true;

      await networkDriver.disconnect();
      
      expect(mockUdpSocket.close).toHaveBeenCalled();
      expect((networkDriver as any)._udpSocket).toBeUndefined();
      expect((networkDriver as any)._isConnected).toBe(false);
    });

    it('应该正确处理资源清理', () => {
      const disposeSpy = jest.spyOn(networkDriver as any, 'disconnect').mockResolvedValue(undefined);
      
      networkDriver.dispose();
      
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('硬件能力构建算法', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该构建正确的基础硬件能力描述', () => {
      const buildCapabilities = (networkDriver as any).buildCapabilities.bind(networkDriver);
      
      const capabilities = buildCapabilities();
      
      expect(capabilities).toHaveProperty('channels');
      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.channels.maxVoltage).toBe(5.0);
      expect(capabilities.channels.inputImpedance).toBe(1000000);
      
      expect(capabilities).toHaveProperty('sampling');
      expect(capabilities.sampling.maxRate).toBe(40000000);
      expect(capabilities.sampling.bufferSize).toBe(8000000);
      expect(capabilities.sampling.streamingSupport).toBe(true);
      
      expect(capabilities).toHaveProperty('triggers');
      expect(capabilities.triggers.types).toEqual([0, 1, 2, 3]);
      expect(capabilities.triggers.maxChannels).toBe(8);
      expect(capabilities.triggers.conditions).toContain('rising');
      expect(capabilities.triggers.conditions).toContain('falling');
      
      expect(capabilities).toHaveProperty('connectivity');
      expect(capabilities.connectivity.interfaces).toContain('ethernet');
      expect(capabilities.connectivity.protocols).toContain('tcp');
      
      expect(capabilities).toHaveProperty('features');
      expect(capabilities.features.remoteControl).toBe(true);
    });

    it('应该根据设备配置调整能力描述', () => {
      // 设置设备配置
      (networkDriver as any)._deviceConfig = {
        signal_generation: true,
        power_supply: true,
        voltage_monitoring: true,
        firmware_update: true
      };
      
      const buildCapabilities = (networkDriver as any).buildCapabilities.bind(networkDriver);
      const capabilities = buildCapabilities();
      
      expect(capabilities.features.signalGeneration).toBe(true);
      expect(capabilities.features.powerSupply).toBe(true);
      expect(capabilities.features.voltageMonitoring).toBe(true);
      expect(capabilities.features.firmwareUpdate).toBe(true);
    });
  });

  describe('边界条件和错误处理', () => {
    beforeEach(() => {
      networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    it('应该处理无效的数据格式', () => {
      const parseNetworkCaptureData = (networkDriver as any).parseNetworkCaptureData.bind(networkDriver);
      const testSession = createTestSession();
      
      // 设置无效的数据格式
      (networkDriver as any)._dataFormat = 'invalid-format';
      
      expect(() => {
        parseNetworkCaptureData(testSession, { data: {} });
      }).toThrow('不支持的数据格式: invalid-format');
    });

    it('应该处理网络命令超时', async () => {
      // 设置TCP连接但不响应
      (networkDriver as any)._protocol = 'tcp';
      (networkDriver as any)._tcpSocket = mockTcpSocket;
      
      mockTcpSocket.on.mockImplementation((event: string, handler: any) => {
        // 不触发data事件，模拟超时
      });

      const sendNetworkCommand = (networkDriver as any).sendNetworkCommand.bind(networkDriver);
      
      await expect(sendNetworkCommand({ command: 'TEST' })).rejects.toThrow('网络命令超时');
    });

    it('应该处理无效的网络连接', async () => {
      const sendNetworkCommand = (networkDriver as any).sendNetworkCommand.bind(networkDriver);
      
      // 没有设置socket连接
      await expect(sendNetworkCommand({ command: 'TEST' })).rejects.toThrow('无效的网络连接');
    });
  });
});