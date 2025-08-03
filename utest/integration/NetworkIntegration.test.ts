import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WiFiDeviceDiscovery, WiFiDeviceInfo, NetworkScanResult } from '../../src/services/WiFiDeviceDiscovery';
import { NetworkStabilityService, ConnectionQuality } from '../../src/services/NetworkStabilityService';
import { NetworkLogicAnalyzerDriver } from '../../src/drivers/NetworkLogicAnalyzerDriver';
import { Socket } from 'net';
import { createSocket } from 'dgram';

// Mock网络模块
jest.mock('net');
jest.mock('dgram');
jest.mock('os');

const MockSocket = Socket as jest.MockedClass<typeof Socket>;
const mockCreateSocket = createSocket as jest.MockedFunction<typeof createSocket>;

describe('网络连接功能集成测试', () => {
  let wifiDiscovery: WiFiDeviceDiscovery;
  let networkStability: NetworkStabilityService;
  let networkDriver: NetworkLogicAnalyzerDriver;
  let mockSocket: jest.Mocked<Socket>;
  let mockUdpSocket: any;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // 创建mock socket
    mockSocket = {
      connect: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      setNoDelay: jest.fn(),
      setKeepAlive: jest.fn(),
      setDefaultEncoding: jest.fn(),
      pipe: jest.fn()
    } as any;

    // 创建mock UDP socket
    mockUdpSocket = {
      bind: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      setBroadcast: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    // 设置mock返回值
    (MockSocket as any).mockImplementation(() => mockSocket);
    mockCreateSocket.mockReturnValue(mockUdpSocket);

    // Mock网络接口
    const mockNetworkInterfaces = jest.requireMock('os').networkInterfaces;
    mockNetworkInterfaces.mockReturnValue({
      'eth0': [{
        family: 'IPv4',
        address: '192.168.1.10',
        internal: false
      }]
    });

    // 初始化服务
    wifiDiscovery = new WiFiDeviceDiscovery();
    networkStability = new NetworkStabilityService();
    networkDriver = new NetworkLogicAnalyzerDriver('192.168.1.100', 4045);
  });

  afterEach(async () => {
    // 清理资源
    if (wifiDiscovery) {
      wifiDiscovery.stopScan();
      wifiDiscovery.clearCache();
    }
    
    if (networkStability) {
      await networkStability.disconnect();
    }

    if (networkDriver) {
      await networkDriver.disconnect();
    }
  });

  describe('WiFi设备发现功能', () => {
    it('应该能够扫描并发现网络设备', async () => {
      // 模拟UDP广播响应
      const mockDeviceResponse = JSON.stringify({
        device_type: 'pico-logic-analyzer',
        name: 'Test Pico Device',
        version: 'v1.2.3',
        port: 4045,
        serial: 'TEST123456'
      });

      // 设置UDP socket mock行为
      mockUdpSocket.bind.mockImplementation((port: number, callback: () => void) => {
        callback();
      });

      mockUdpSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'message') {
          // 模拟接收到设备广播响应
          setTimeout(() => {
            handler(Buffer.from(mockDeviceResponse), {
              address: '192.168.1.100',
              port: 4046
            });
          }, 100);
        }
      });

      // 模拟TCP连接成功（用于设备验证）
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      // 模拟设备信息响应
      const deviceInfoResponse = [
        'LogicAnalyzer Pico v1.2.3',
        'FREQ:40000000',
        'BLASTFREQ:80000000', 
        'BUFFER:8000000',
        'CHANNELS:8'
      ].join('\n');

      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from(deviceInfoResponse));
          }, 100);
        }
      });

      // 执行扫描
      const result = await wifiDiscovery.scanForDevices({
        timeout: 2000,
        concurrency: 10,
        deepScan: true,
        enableBroadcast: true
      });

      // 验证结果
      expect(result.status).toBe('completed');
      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].deviceName).toBe('Test Pico Device');
      expect(result.devices[0].ipAddress).toBe('192.168.1.100');
      expect(result.devices[0].port).toBe(4045);
      expect(result.devices[0].version).toBeDefined();
    });

    it('应该能够处理扫描超时', async () => {
      // 设置UDP socket超时
      mockUdpSocket.bind.mockImplementation((port: number, callback: () => void) => {
        callback();
      });

      mockUdpSocket.on.mockImplementation((event: string, handler: any) => {
        // 不发送任何响应，模拟超时
      });

      const result = await wifiDiscovery.scanForDevices({
        timeout: 500, // 短超时
        concurrency: 5,
        deepScan: false,
        enableBroadcast: true
      });

      expect(result.status).toBe('completed');
      expect(result.devices).toHaveLength(0);
      expect(result.scanDuration).toBeGreaterThan(400);
    });

    it('应该能够缓存和管理设备列表', async () => {
      // 添加模拟设备到缓存
      const mockDevice: WiFiDeviceInfo = {
        ipAddress: '192.168.1.100',
        port: 4045,
        version: 'v1.2.3',
        deviceName: 'Test Device',
        responseTime: 50,
        deviceType: 'Pico Logic Analyzer',
        lastSeen: new Date(),
        isOnline: true
      };

      // 通过刷新设备功能模拟添加设备
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      const deviceInfoResponse = [
        'LogicAnalyzer Pico v1.2.3',
        'FREQ:40000000', 
        'BLASTFREQ:80000000',
        'BUFFER:8000000',
        'CHANNELS:8'
      ].join('\n');

      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            handler(Buffer.from(deviceInfoResponse));
          }, 100);
        }
      });

      const refreshedDevice = await wifiDiscovery.refreshDevice('192.168.1.100', 4045);
      
      expect(refreshedDevice).toBeTruthy();
      expect(refreshedDevice?.ipAddress).toBe('192.168.1.100');

      const cachedDevices = wifiDiscovery.getCachedDevices();
      expect(cachedDevices).toHaveLength(1);

      const onlineDevices = wifiDiscovery.getOnlineDevices();
      expect(onlineDevices).toHaveLength(1);
    });
  });

  describe('网络连接稳定性功能', () => {
    it('应该能够建立和管理网络连接', async () => {
      // 模拟成功连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 100);
        return mockSocket;
      });

      const connected = await networkStability.connect('192.168.1.100', 4045);
      
      expect(connected).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(4045, '192.168.1.100', expect.any(Function));
      expect(mockSocket.setNoDelay).toHaveBeenCalledWith(true);
      expect(mockSocket.setKeepAlive).toHaveBeenCalledWith(true, 30000);
    });

    it('应该能够监控连接质量', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      mockSocket.write.mockImplementation((data: any, callback?: (error?: Error) => void) => {
        if (callback) setTimeout(() => callback(), 50);
        return true;
      });

      await networkStability.connect('192.168.1.100', 4045);
      
      // 等待质量监控启动
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const quality = networkStability.getConnectionQuality();
      
      expect(quality).toBeDefined();
      expect(quality.stabilityScore).toBeGreaterThan(0);
      expect(quality.lastTestTime).toBeInstanceOf(Date);
    });

    it('应该能够执行网络诊断', async () => {
      // 模拟各种网络测试场景
      let connectCallCount = 0;
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        connectCallCount++;
        if (callback) setTimeout(callback, 50 + Math.random() * 100); // 模拟不同延迟
        return mockSocket;
      });

      const diagnostics = await networkStability.runDiagnostics('192.168.1.100', 4045);
      
      expect(diagnostics).toBeInstanceOf(Array);
      expect(diagnostics.length).toBeGreaterThan(0);
      
      // 检查各种诊断测试
      const testNames = diagnostics.map(d => d.testName);
      expect(testNames).toContain('连接测试');
      expect(testNames).toContain('延迟测试');
      expect(testNames).toContain('网络配置检查');
      
      // 验证诊断结果结构
      diagnostics.forEach(result => {
        expect(result).toHaveProperty('testName');
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('details');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('severity');
      });
    });

    it('应该能够处理连接错误和重连', async () => {
      let connectionAttempts = 0;
      
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        connectionAttempts++;
        if (connectionAttempts === 1) {
          // 第一次连接失败
          setTimeout(() => {
            const error = new Error('Connection refused');
            mockSocket.on.mock.calls.forEach(([event, handler]) => {
              if (event === 'error') handler(error);
            });
          }, 50);
        } else {
          // 后续连接成功
          if (callback) setTimeout(callback, 50);
        }
        return mockSocket;
      });

      // 配置自动重连
      networkStability.setConfiguration({
        autoReconnect: true,
        maxRetries: 3,
        retryInterval: 100
      });

      try {
        await networkStability.connect('192.168.1.100', 4045);
        expect(false).toBe(true); // 不应该到达这里
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // 检查事件历史
      const events = networkStability.getNetworkEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'error')).toBe(true);
    });
  });

  describe('网络逻辑分析器驱动集成', () => {
    it('应该能够通过网络驱动连接设备', async () => {
      // 模拟TCP连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 100);
        return mockSocket;
      });

      // 模拟握手响应
      const handshakeResponse = JSON.stringify({
        success: true,
        message: 'Handshake successful'
      });

      // 模拟设备信息响应
      const deviceInfoResponse = JSON.stringify({
        device_info: {
          version: 'v1.2.3',
          channels: 8,
          max_frequency: 40000000,
          blast_frequency: 80000000,
          buffer_size: 8000000
        }
      });

      let responseCount = 0;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            responseCount++;
            if (responseCount === 1) {
              handler(Buffer.from(handshakeResponse + '\n'));
            } else if (responseCount === 2) {
              handler(Buffer.from(deviceInfoResponse + '\n'));
            }
          }, 50);
        }
      });

      const result = await networkDriver.connect();
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.deviceInfo?.name).toBeDefined();
      expect(result.deviceInfo?.isNetwork).toBe(true);
    });

    it('应该能够发送网络配置到设备', async () => {
      // 首先建立连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      // 模拟握手和设备信息响应
      let responseCount = 0;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            responseCount++;
            if (responseCount <= 2) {
              handler(Buffer.from(JSON.stringify({ success: true }) + '\n'));
            } else {
              // 网络配置响应
              handler(Buffer.from(JSON.stringify({ success: true }) + '\n'));
            }
          }, 50);
        }
      });

      await networkDriver.connect();
      
      const configResult = await networkDriver.sendNetworkConfig(
        'TestWiFi',
        'password123',
        '192.168.1.200',
        4045
      );
      
      expect(configResult).toBe(true);
      expect(mockSocket.write).toHaveBeenCalled();
    });

    it('应该能够处理网络数据采集', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      // 模拟各种响应
      let responseCount = 0;
      mockSocket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'data') {
          setTimeout(() => {
            responseCount++;
            let response;
            switch (responseCount) {
              case 1: // 握手
              case 2: // 设备信息
                response = { success: true };
                break;
              case 3: // 采集启动
                response = { success: true, capture_id: 'test123' };
                break;
              case 4: // 采集状态
                response = { status: 'COMPLETED', progress: 100 };
                break;
              case 5: // 采集数据
                response = {
                  success: true,
                  data: {
                    channels: [
                      { number: 0, samples: [1, 0, 1, 1, 0] },
                      { number: 1, samples: [0, 1, 0, 1, 1] }
                    ]
                  }
                };
                break;
            }
            handler(Buffer.from(JSON.stringify(response) + '\n'));
          }, 50);
        }
      });

      await networkDriver.connect();

      // 创建模拟采集会话
      const mockSession = {
        captureChannels: [
          { channelNumber: 0, channelName: 'CH0', samples: undefined },
          { channelNumber: 1, channelName: 'CH1', samples: undefined }
        ],
        frequency: 1000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 1000,
        triggerType: 0,
        triggerChannel: 0,
        triggerInverted: false,
        triggerPattern: 0,
        triggerBitCount: 1,
        loopCount: 1,
        measureBursts: false
      };

      const captureResult = await networkDriver.startCapture(mockSession);
      
      expect(captureResult).toBe(0); // CaptureError.None
      
      // 等待采集完成
      await new Promise(resolve => {
        networkDriver.once('captureCompleted', (args) => {
          expect(args.success).toBe(true);
          expect(args.session).toBe(mockSession);
          resolve(undefined);
        });
      });
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该能够处理网络连接超时', async () => {
      mockSocket.connect.mockImplementation(() => {
        // 不调用callback，模拟连接超时
        return mockSocket;
      });

      const connectPromise = networkStability.connect('192.168.1.100', 4045);
      
      await expect(connectPromise).rejects.toThrow();
    });

    it('应该能够处理无效的网络地址', async () => {
      const invalidIPs = ['256.256.256.256', 'invalid.ip', '192.168.1'];
      
      for (const ip of invalidIPs) {
        const diagnostics = await networkStability.runDiagnostics(ip, 4045);
        const configTest = diagnostics.find(d => d.testName === '网络配置检查');
        
        expect(configTest).toBeDefined();
        expect(configTest?.passed).toBe(false);
      }
    });

    it('应该能够处理端口范围错误', async () => {
      const invalidPorts = [0, 70000, -1];
      
      for (const port of invalidPorts) {
        const diagnostics = await networkStability.runDiagnostics('192.168.1.100', port);
        const configTest = diagnostics.find(d => d.testName === '网络配置检查');
        
        expect(configTest).toBeDefined();
        expect(configTest?.passed).toBe(false);
      }
    });

    it('应该能够优雅地处理设备断开连接', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      await networkStability.connect('192.168.1.100', 4045);
      
      // 模拟连接断开
      setTimeout(() => {
        const closeHandler = mockSocket.on.mock.calls.find(([event]) => event === 'close')?.[1];
        if (closeHandler) closeHandler();
      }, 100);

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const events = networkStability.getNetworkEvents();
      expect(events.some(e => e.type === 'disconnected')).toBe(true);
    });
  });

  describe('性能和资源管理', () => {
    it('应该能够正确清理资源', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((_port: number, _host: string, callback?: () => void) => {
        if (callback) setTimeout(callback, 50);
        return mockSocket;
      });

      await networkStability.connect('192.168.1.100', 4045);
      await networkDriver.connect();
      
      // 清理资源
      await networkStability.disconnect();
      await networkDriver.disconnect();
      wifiDiscovery.stopScan();
      wifiDiscovery.clearCache();
      
      expect(mockSocket.destroy).toHaveBeenCalled();
      expect(wifiDiscovery.getCachedDevices()).toHaveLength(0);
    });

    it('应该能够处理并发扫描请求', async () => {
      const scanPromises = [];
      
      // 模拟多个并发扫描
      for (let i = 0; i < 3; i++) {
        const promise = wifiDiscovery.scanForDevices({
          timeout: 1000,
          concurrency: 5,
          deepScan: false,
          enableBroadcast: false
        });
        scanPromises.push(promise);
      }
      
      // 第一个扫描应该正常执行，其他的应该抛出错误
      const results = await Promise.allSettled(scanPromises);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);
    });

    it('应该能够限制事件历史大小', async () => {
      // 生成大量事件
      for (let i = 0; i < 1100; i++) {
        networkStability.emit('quality_changed', { test: i });
      }
      
      const events = networkStability.getNetworkEvents();
      expect(events.length).toBeLessThanOrEqual(1000); // 应该被限制在1000以内
    });
  });
});