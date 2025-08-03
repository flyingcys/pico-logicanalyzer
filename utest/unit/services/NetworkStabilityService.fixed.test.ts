/**
 * NetworkStabilityService 修复版测试套件
 * 正确处理定时器和异步操作，避免测试超时
 */

import { EventEmitter } from 'events';
import { Socket } from 'net';
import { 
  NetworkStabilityService,
  ConnectionQuality,
  NetworkEvent,
  ConnectionConfig,
  DiagnosticResult
} from '../../../src/services/NetworkStabilityService';

// Mock Node.js net module
jest.mock('net');

// Mock global timers
const mockSetTimeout = jest.fn();
const mockSetInterval = jest.fn();
const mockClearTimeout = jest.fn();
const mockClearInterval = jest.fn();

// Override global timer functions
global.setTimeout = mockSetTimeout as any;
global.setInterval = mockSetInterval as any;
global.clearTimeout = mockClearTimeout as any;
global.clearInterval = mockClearInterval as any;

describe('NetworkStabilityService - 修复版测试', () => {
  let service: NetworkStabilityService;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset timer mocks
    mockSetTimeout.mockImplementation((callback, delay) => {
      // 立即执行回调，避免真实的异步等待
      if (typeof callback === 'function') {
        callback();
      }
      return 123 as any; // 返回假的timer ID
    });

    mockSetInterval.mockImplementation((callback, interval) => {
      // 不自动执行，但返回假的timer ID
      return 456 as any;
    });

    mockClearTimeout.mockImplementation(() => {});
    mockClearInterval.mockImplementation(() => {});

    // 创建 mock socket
    mockSocket = {
      connect: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      setNoDelay: jest.fn(),
      setKeepAlive: jest.fn(),
      setDefaultEncoding: jest.fn(),
    } as any;

    // Mock Socket 构造函数
    (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket);

    // 创建服务实例
    service = new NetworkStabilityService();
  });

  afterEach(() => {
    if (service) {
      service.removeAllListeners();
    }
  });

  describe('基础功能', () => {
    test('应该正确创建实例', () => {
      expect(service).toBeInstanceOf(NetworkStabilityService);
      expect(service).toBeInstanceOf(EventEmitter);
    });

    test('应该使用自定义配置创建实例', () => {
      const customConfig: Partial<ConnectionConfig> = {
        heartbeatInterval: 3000,
        connectionTimeout: 15000,
        maxRetries: 10
      };

      const newService = new NetworkStabilityService(customConfig);
      expect(newService).toBeInstanceOf(NetworkStabilityService);
    });

    test('应该返回初始连接质量', () => {
      const quality = service.getConnectionQuality();
      expect(quality).toMatchObject({
        latency: 0,
        packetLoss: 0,
        stabilityScore: 100,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        retryCount: 0,
        disconnectionCount: 0,
        throughput: 0
      });
      expect(quality.lastTestTime).toBeInstanceOf(Date);
    });

    test('应该返回网络事件历史', () => {
      const events = service.getNetworkEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    test('应该限制返回的事件数量', () => {
      const events = service.getNetworkEvents(5);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  describe('连接管理', () => {
    test('应该成功连接到设备', async () => {
      // Mock 成功连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      const result = await service.connect('192.168.1.100', 4045);

      expect(result).toBe(true);
      expect(Socket).toHaveBeenCalled();
      expect(mockSocket.connect).toHaveBeenCalledWith(4045, '192.168.1.100', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('应该在已连接时返回true', async () => {
      // 先建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });
      await service.connect('192.168.1.100', 4045);

      // 再次连接应该返回 true
      const result = await service.connect('192.168.1.100', 4045);
      expect(result).toBe(true);
    });

    test('应该正确断开连接', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);
      await service.disconnect();

      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    test('应该处理连接错误', async () => {
      const testError = new Error('连接失败');
      
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          // 立即调用错误处理器
          setTimeout(() => handler(testError), 0);
        }
      });

      await expect(service.connect('192.168.1.100', 4045)).rejects.toThrow('连接失败');
    });

    test('应该设置连接超时', async () => {
      mockSocket.connect.mockImplementation(() => {
        // 不调用 callback，模拟连接超时
      });

      // Mock setTimeout 来触发超时
      mockSetTimeout.mockImplementation((callback, delay) => {
        if (delay === 10000) { // 默认连接超时时间
          callback();
        }
        return 123 as any;
      });

      await expect(service.connect('192.168.1.100', 4045)).rejects.toThrow('连接超时');
    });
  });

  describe('数据发送', () => {
    beforeEach(async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });
      await service.connect('192.168.1.100', 4045);
    });

    test('应该成功发送数据', async () => {
      const testData = Buffer.from([0x01, 0x02, 0x03]);
      
      mockSocket.write.mockImplementation((data, callback) => {
        if (callback) callback();
        return true;
      });

      const result = await service.sendData(testData);
      expect(result).toBe(true);
      expect(mockSocket.write).toHaveBeenCalledWith(testData, expect.any(Function));
    });

    test('应该处理发送错误', async () => {
      const testData = Buffer.from([0x01, 0x02, 0x03]);
      const sendError = new Error('发送失败');

      mockSocket.write.mockImplementation((data, callback) => {
        if (callback) callback(sendError);
        return true;
      });

      await expect(service.sendData(testData)).rejects.toThrow('发送失败');
    });

    test('应该在未连接时抛出错误', async () => {
      await service.disconnect();
      const testData = Buffer.from([0x01, 0x02, 0x03]);

      await expect(service.sendData(testData)).rejects.toThrow('设备未连接');
    });
  });

  describe('配置管理', () => {
    test('应该正确设置配置', () => {
      const newConfig: Partial<ConnectionConfig> = {
        heartbeatInterval: 3000,
        connectionTimeout: 15000,
        maxRetries: 10,
        autoReconnect: false
      };

      expect(() => service.setConfiguration(newConfig)).not.toThrow();
    });

    test('应该在连接时重启定时器', async () => {
      // 先建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });
      await service.connect('192.168.1.100', 4045);

      // 清空mock
      mockClearInterval.mockClear();
      mockSetInterval.mockClear();

      // 更新配置
      service.setConfiguration({ heartbeatInterval: 2000 });

      // 应该清除旧定时器并设置新定时器
      expect(mockClearInterval).toHaveBeenCalled();
      expect(mockSetInterval).toHaveBeenCalled();
    });
  });

  describe('连接优化', () => {
    test('应该应用TCP优化设置', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);

      expect(mockSocket.setNoDelay).toHaveBeenCalledWith(true);
      expect(mockSocket.setKeepAlive).toHaveBeenCalledWith(true, 30000);
      expect(mockSocket.setDefaultEncoding).toHaveBeenCalledWith('binary');
    });
  });

  describe('网络诊断', () => {
    test('应该运行网络配置检查', async () => {
      const results = await service.runDiagnostics('192.168.1.100', 4045);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest).toBeDefined();
      expect(configTest?.testName).toBe('网络配置检查');
      expect(configTest?.passed).toBe(true);
    });

    test('应该检测无效IP地址', async () => {
      const results = await service.runDiagnostics('invalid-ip', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('IP地址格式无效');
    });

    test('应该检测无效端口范围', async () => {
      const results = await service.runDiagnostics('192.168.1.100', 70000);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('端口号超出有效范围');
    });

    test('应该检查默认端口', async () => {
      const results = await service.runDiagnostics('192.168.1.100', 8080);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('不是Pico Logic Analyzer的默认端口');
    });

    test('应该接受私有IP地址', async () => {
      const privateIPs = ['10.0.0.1', '172.16.0.1', '192.168.1.1'];

      for (const ip of privateIPs) {
        const results = await service.runDiagnostics(ip, 4045);
        const configTest = results.find(r => r.testName === '网络配置检查');
        expect(configTest?.passed).toBe(true);
      }
    });

    test('应该接受本地地址', async () => {
      const results = await service.runDiagnostics('127.0.0.1', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(true);
    });
  });

  describe('强制重连', () => {
    test('应该支持强制重连', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      const result = await service.forceReconnect('192.168.1.100', 4045);
      
      expect(result).toBe(true);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('事件系统', () => {
    test('应该发出连接事件', async () => {
      const connectedSpy = jest.fn();
      service.on('connected', connectedSpy);

      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);

      expect(connectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connected',
          data: { host: '192.168.1.100', port: 4045 }
        })
      );
    });

    test('应该发出断开连接事件', async () => {
      const disconnectedSpy = jest.fn();
      service.on('disconnected', disconnectedSpy);

      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);
      await service.disconnect();

      expect(disconnectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnected'
        })
      );
    });
  });

  describe('边界情况', () => {
    test('应该处理连接质量数据的返回', () => {
      const quality1 = service.getConnectionQuality();
      const quality2 = service.getConnectionQuality();
      
      // 应该返回不同的对象实例（深拷贝）
      expect(quality1).not.toBe(quality2);
      expect(quality1).toEqual(quality2);
    });

    test('应该正确处理空的网络事件历史', () => {
      const events = service.getNetworkEvents(100);
      expect(Array.isArray(events)).toBe(true);
    });

    test('应该处理多次断开连接', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);
      await service.disconnect();
      await service.disconnect(); // 第二次断开

      expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('定时器管理', () => {
    test('应该启动心跳定时器', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);

      expect(mockSetInterval).toHaveBeenCalled();
    });

    test('应该在断开连接时清理定时器', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);
      await service.disconnect();

      expect(mockClearInterval).toHaveBeenCalled();
    });
  });
});