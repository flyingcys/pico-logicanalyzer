/**
 * NetworkStabilityService 简化测试套件
 * 专注于核心功能的测试，避免复杂的异步操作
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

describe('NetworkStabilityService - 简化测试', () => {
  let service: NetworkStabilityService;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    jest.clearAllMocks();

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
      expect(events.length).toBe(0);
    });

    test('应该限制返回的事件数量', () => {
      const events = service.getNetworkEvents(5);
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  describe('连接管理', () => {
    test('应该创建新的Socket连接', async () => {
      // Mock 成功连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      const promise = service.connect('192.168.1.100', 4045);
      const result = await promise;

      expect(result).toBe(true);
      expect(Socket).toHaveBeenCalled();
      expect(mockSocket.connect).toHaveBeenCalledWith(4045, '192.168.1.100', expect.any(Function));
    });

    test('应该设置Socket事件监听器', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);

      expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
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
      
      mockSocket.connect.mockImplementation(() => {
        // 模拟连接错误
        const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1];
        if (errorHandler) {
          setTimeout(() => errorHandler(testError), 0);
        }
      });

      await expect(service.connect('192.168.1.100', 4045)).rejects.toThrow('连接失败');
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

  describe('诊断测试', () => {
    test('应该运行连接诊断', async () => {
      const results = await service.runDiagnostics('192.168.1.100', 4045);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest).toBeDefined();
      expect(configTest?.passed).toBe(true);
    });

    test('应该检测无效IP地址', async () => {
      const results = await service.runDiagnostics('invalid-ip', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('IP地址格式无效');
    });

    test('应该检测无效端口', async () => {
      const results = await service.runDiagnostics('192.168.1.100', 70000);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('端口号超出有效范围');
    });

    test('应该警告非默认端口', async () => {
      const results = await service.runDiagnostics('192.168.1.100', 8080);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('不是Pico Logic Analyzer的默认端口');
    });

    test('应该建议使用私有IP', async () => {
      const results = await service.runDiagnostics('8.8.8.8', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('建议使用私有IP地址');
    });

    test('应该接受本地地址', async () => {
      const results = await service.runDiagnostics('127.0.0.1', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(true);
    });

    test('应该接受私有IP地址', async () => {
      const tests = [
        '10.0.0.1',
        '172.16.0.1',
        '192.168.1.1'
      ];

      for (const ip of tests) {
        const results = await service.runDiagnostics(ip, 4045);
        const configTest = results.find(r => r.testName === '网络配置检查');
        expect(configTest?.passed).toBe(true);
      }
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

    test('应该发出错误事件', async () => {
      const errorSpy = jest.fn();
      service.on('error', errorSpy);

      const testError = new Error('测试错误');
      mockSocket.connect.mockImplementation(() => {
        const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1];
        if (errorHandler) {
          setTimeout(() => errorHandler(testError), 0);
        }
      });

      try {
        await service.connect('192.168.1.100', 4045);
      } catch (error) {
        // 预期的错误
      }

      // 等待异步事件处理
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          data: testError,
          message: '测试错误'
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
      expect(events).toEqual([]);
    });

    test('应该处理null/undefined参数', () => {
      expect(() => service.setConfiguration({})).not.toThrow();
    });
  });

  describe('资源清理', () => {
    test('应该正确清理资源', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);
      await service.disconnect();

      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    test('应该在多次断开连接时保持稳定', async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect('192.168.1.100', 4045);
      await service.disconnect();
      await service.disconnect(); // 第二次断开

      expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
    });
  });
});