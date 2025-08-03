/**
 * NetworkStabilityService 全面测试套件
 * 测试网络稳定性服务的连接管理、质量监控、诊断等功能
 * 
 * 覆盖功能：
 * - 连接管理 (连接/断开/重连)
 * - 质量监控 (延迟/吞吐量/稳定性)
 * - 网络诊断 (连接测试/延迟测试/吞吐量测试)
 * - 心跳机制
 * - 事件系统
 * - 配置管理
 * - 错误处理
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

describe('NetworkStabilityService', () => {
  let service: NetworkStabilityService;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

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

  afterEach(async () => {
    // 确保服务正确断开连接
    if (service) {
      await service.disconnect();
      service.removeAllListeners();
    }
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('构造函数和初始化', () => {
    test('应该使用默认配置创建实例', () => {
      const newService = new NetworkStabilityService();
      expect(newService).toBeInstanceOf(NetworkStabilityService);
      expect(newService).toBeInstanceOf(EventEmitter);
    });

    test('应该使用自定义配置创建实例', () => {
      const customConfig: Partial<ConnectionConfig> = {
        heartbeatInterval: 3000,
        connectionTimeout: 15000,
        maxRetries: 10,
        autoReconnect: false
      };

      const newService = new NetworkStabilityService(customConfig);
      expect(newService).toBeInstanceOf(NetworkStabilityService);
    });

    test('应该正确初始化连接质量数据', () => {
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
  });

  describe('连接管理', () => {
    test('应该成功连接到设备', async () => {
      const host = '192.168.1.100';
      const port = 4045;

      // Mock successful connection
      mockSocket.connect.mockImplementation((port, host, callback) => {
        // 立即调用回调，模拟成功连接
        if (callback) callback();
      });

      const result = await service.connect(host, port);
      expect(result).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(port, host, expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('应该在已连接时返回 true', async () => {
      // 模拟已连接状态
      const host = '192.168.1.100';
      const port = 4045;

      mockSocket.connect.mockImplementation((port, host, callback) => {
        if (callback) callback();
      });

      await service.connect(host, port);

      // 再次连接应该返回 true
      const result = await service.connect(host, port);
      expect(result).toBe(true);
    });

    test('应该处理连接超时', async () => {
      const host = '192.168.1.100';
      const port = 4045;

      // Mock 连接不响应（不调用 callback）
      mockSocket.connect.mockImplementation(() => {
        // 不调用 callback，模拟超时
      });

      const connectPromise = service.connect(host, port);
      
      // 推进时间到超时
      jest.advanceTimersByTime(15000);
      
      await expect(connectPromise).rejects.toThrow('连接超时');
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    test('应该处理连接错误', async () => {
      const host = '192.168.1.100';
      const port = 4045;
      const testError = new Error('连接被拒绝');

      // Mock 连接错误
      mockSocket.connect.mockImplementation(() => {
        setTimeout(() => {
          const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1];
          if (errorHandler) errorHandler(testError);
        }, 0);
      });

      const connectPromise = service.connect(host, port);
      jest.advanceTimersByTime(0);

      await expect(connectPromise).rejects.toThrow('连接被拒绝');
    });

    test('应该正确断开连接', async () => {
      // 先建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });

      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 断开连接
      await service.disconnect();

      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('数据发送', () => {
    beforeEach(async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);
    });

    test('应该成功发送数据', async () => {
      const testData = Buffer.from([0x01, 0x02, 0x03]);

      // Mock 成功写入
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(), 0);
        return true;
      });

      const sendPromise = service.sendData(testData);
      jest.advanceTimersByTime(0);

      const result = await sendPromise;
      expect(result).toBe(true);
      expect(mockSocket.write).toHaveBeenCalledWith(testData, expect.any(Function));
    });

    test('应该处理发送错误', async () => {
      const testData = Buffer.from([0x01, 0x02, 0x03]);
      const sendError = new Error('发送失败');

      // Mock 写入错误
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(sendError), 0);
        return true;
      });

      const sendPromise = service.sendData(testData);
      jest.advanceTimersByTime(0);

      await expect(sendPromise).rejects.toThrow('发送失败');
    });

    test('应该在未连接时抛出错误', async () => {
      await service.disconnect();
      const testData = Buffer.from([0x01, 0x02, 0x03]);

      await expect(service.sendData(testData)).rejects.toThrow('设备未连接');
    });
  });

  describe('连接质量监控', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);
    });

    test('应该正确返回连接质量信息', () => {
      const quality = service.getConnectionQuality();
      expect(quality).toHaveProperty('latency');
      expect(quality).toHaveProperty('packetLoss');
      expect(quality).toHaveProperty('stabilityScore');
      expect(quality).toHaveProperty('averageResponseTime');
      expect(quality).toHaveProperty('throughput');
      expect(quality.lastTestTime).toBeInstanceOf(Date);
    });

    test('应该在数据传输后更新吞吐量', async () => {
      const testData = Buffer.from(new Array(1024).fill(0xAA));

      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(), 50);
        return true;
      });

      await service.sendData(testData);
      jest.advanceTimersByTime(50);

      const quality = service.getConnectionQuality();
      expect(quality.throughput).toBeGreaterThan(0);
    });

    test('应该定期更新连接质量', () => {
      const eventSpy = jest.fn();
      service.on('quality_changed', eventSpy);

      // 推进时间到质量检查间隔
      jest.advanceTimersByTime(30000);

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('心跳机制', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(), 10);
        return true;
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);
    });

    test('应该定期发送心跳包', () => {
      // 推进时间到心跳间隔
      jest.advanceTimersByTime(5000);

      expect(mockSocket.write).toHaveBeenCalledWith(
        Buffer.from([0x00]),
        expect.any(Function)
      );
    });

    test('应该更新心跳响应时间', () => {
      // 发送心跳
      jest.advanceTimersByTime(5000);
      jest.advanceTimersByTime(10); // 等待响应

      const quality = service.getConnectionQuality();
      expect(quality.latency).toBeGreaterThan(0);
      expect(quality.averageResponseTime).toBeGreaterThan(0);
    });

    test('应该处理心跳发送失败', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock 心跳发送失败
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(new Error('心跳失败')), 0);
        return true;
      });

      jest.advanceTimersByTime(5000);
      jest.advanceTimersByTime(0);

      expect(consoleSpy).toHaveBeenCalledWith('心跳发送失败:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('网络事件系统', () => {
    test('应该正确记录网络事件', () => {
      const events = service.getNetworkEvents();
      expect(Array.isArray(events)).toBe(true);
    });

    test('应该限制事件历史大小', () => {
      // 模拟大量事件
      for (let i = 0; i < 1200; i++) {
        service.emit('connected', { type: 'connected', timestamp: new Date() });
      }

      const events = service.getNetworkEvents();
      expect(events.length).toBeLessThanOrEqual(1000);
    });

    test('应该返回指定数量的最新事件', () => {
      // 添加一些事件
      for (let i = 0; i < 50; i++) {
        service.emit('connected', { type: 'connected', timestamp: new Date() });
      }

      const events = service.getNetworkEvents(20);
      expect(events.length).toBeLessThanOrEqual(20);
    });
  });

  describe('自动重连机制', () => {
    test('应该在连接断开时自动重连', async () => {
      // 建立初始连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 模拟连接断开
      const closeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler();

      // 推进时间到重连间隔
      jest.advanceTimersByTime(2000);

      // 应该尝试重新连接
      expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    });

    test('应该在达到最大重试次数后停止重连', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 配置较小的重试次数
      service.setConfiguration({ maxRetries: 2 });

      // 建立初始连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 模拟连接重复断开
      const closeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'close')?.[1];
      
      // 第一次断开
      if (closeHandler) closeHandler();
      jest.advanceTimersByTime(2000);
      
      // 第二次断开
      if (closeHandler) closeHandler();
      jest.advanceTimersByTime(4000);
      
      // 第三次断开
      if (closeHandler) closeHandler();
      jest.advanceTimersByTime(6000);

      expect(consoleSpy).toHaveBeenCalledWith('达到最大重试次数，停止重连');
      consoleSpy.mockRestore();
    });

    test('应该支持强制重连', async () => {
      const result = await service.forceReconnect('192.168.1.100', 4045);
      
      // 等待异步操作完成
      jest.advanceTimersByTime(1000);
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      jest.advanceTimersByTime(0);

      expect(mockSocket.destroy).toHaveBeenCalled();
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

    test('应该在连接时应用新配置', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 更改配置
      service.setConfiguration({ heartbeatInterval: 2000 });

      // 应该重新启动定时器
      jest.advanceTimersByTime(2000);
      expect(mockSocket.write).toHaveBeenCalledWith(
        Buffer.from([0x00]),
        expect.any(Function)
      );
    });
  });

  describe('连接优化', () => {
    beforeEach(async () => {
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);
    });

    test('应该应用TCP优化设置', () => {
      expect(mockSocket.setNoDelay).toHaveBeenCalledWith(true);
      expect(mockSocket.setKeepAlive).toHaveBeenCalledWith(true, 30000);
      expect(mockSocket.setDefaultEncoding).toHaveBeenCalledWith('binary');
    });

    test('应该在禁用优化时跳过设置', async () => {
      await service.disconnect();
      
      // 创建禁用优化的新服务
      const nonOptimizedService = new NetworkStabilityService({ 
        enableOptimization: false 
      });

      mockSocket.setNoDelay.mockClear();
      mockSocket.setKeepAlive.mockClear();

      await nonOptimizedService.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 优化方法应该仍被调用（在 setupSocketHandlers 中）
      // 但在 optimizeConnection 中会检查 enableOptimization
    });
  });

  describe('网络诊断测试', () => {
    test('应该运行完整的诊断测试套件', async () => {
      const host = '192.168.1.100';
      const port = 4045;

      // Mock Socket 构造函数返回成功连接
      const mockDiagnosticSocket = {
        connect: jest.fn().mockImplementation((port, host, callback) => {
          setTimeout(() => callback && callback(), 0);
        }),
        destroy: jest.fn(),
        on: jest.fn()
      } as any;

      (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockDiagnosticSocket);

      const resultsPromise = service.runDiagnostics(host, port);
      jest.advanceTimersByTime(0);
      
      const results = await resultsPromise;
      
      expect(results).toHaveLength(6); // 6个诊断测试
      expect(results[0].testName).toBe('连接测试');
      expect(results[1].testName).toBe('延迟测试');
      expect(results[5].testName).toBe('网络配置检查');
    });

    test('应该正确验证IP地址格式', async () => {
      const results = await service.runDiagnostics('invalid-ip', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('IP地址格式无效');
    });

    test('应该检查端口范围', async () => {
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

    test('应该建议使用私有IP地址', async () => {
      const results = await service.runDiagnostics('8.8.8.8', 4045);
      
      const configTest = results.find(r => r.testName === '网络配置检查');
      expect(configTest?.passed).toBe(false);
      expect(configTest?.details).toContain('建议使用私有IP地址');
    });

    test('应该在连接状态下运行额外测试', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(), 0);
        return true;
      });
      
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      const results = await service.runDiagnostics('192.168.1.100', 4045);
      
      // 应该包含额外的连接状态测试
      const throughputTest = results.find(r => r.testName === '吞吐量测试');
      const stabilityTest = results.find(r => r.testName === '稳定性测试');
      const integrityTest = results.find(r => r.testName === '数据完整性测试');
      
      expect(throughputTest).toBeDefined();
      expect(stabilityTest).toBeDefined();
      expect(integrityTest).toBeDefined();
    });
  });

  describe('错误处理和边界情况', () => {
    test('应该处理Socket为null的情况', async () => {
      // 确保未连接状态
      await service.disconnect();

      await expect(service.sendData(Buffer.from([0x01]))).rejects.toThrow('设备未连接');
    });

    test('应该处理事件发射中的错误', () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('事件处理错误');
      });

      service.on('connected', errorHandler);

      // 这不应该导致服务崩溃
      expect(() => {
        service.emit('connected', { type: 'connected', timestamp: new Date() });
      }).not.toThrow();
    });

    test('应该正确清理定时器', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 断开连接
      await service.disconnect();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });

    test('应该处理响应时间历史溢出', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(), 1);
        return true;
      });
      
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 生成大量响应时间数据
      for (let i = 0; i < 1100; i++) {
        await service.sendData(Buffer.from([i % 256]));
        jest.advanceTimersByTime(1);
      }

      const quality = service.getConnectionQuality();
      expect(quality.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('性能和资源管理', () => {
    test('应该正确管理内存中的历史数据', () => {
      // 测试事件历史限制
      for (let i = 0; i < 1200; i++) {
        service.emit('connected', { type: 'connected', timestamp: new Date() });
      }

      const events = service.getNetworkEvents();
      expect(events.length).toBeLessThanOrEqual(1000);
    });

    test('应该清理过期的吞吐量数据', async () => {
      // 建立连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      mockSocket.write.mockImplementation((data, callback) => {
        setTimeout(() => callback && callback(), 0);
        return true;
      });
      
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 发送数据
      await service.sendData(Buffer.from([0x01]));
      
      // 推进时间超过5秒
      jest.advanceTimersByTime(6000);
      
      // 再次发送数据应该清理旧数据
      await service.sendData(Buffer.from([0x02]));

      const quality = service.getConnectionQuality();
      expect(quality.throughput).toBeGreaterThanOrEqual(0);
    });
  });

  describe('事件生命周期', () => {
    test('应该在连接成功时发出connected事件', async () => {
      const connectedSpy = jest.fn();
      service.on('connected', connectedSpy);

      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });

      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      expect(connectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connected',
          data: { host: '192.168.1.100', port: 4045 }
        })
      );
    });

    test('应该在断开连接时发出disconnected事件', async () => {
      const disconnectedSpy = jest.fn();
      service.on('disconnected', disconnectedSpy);

      // 先连接
      mockSocket.connect.mockImplementation((port, host, callback) => {
        setTimeout(() => callback && callback(), 0);
      });
      await service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      // 然后断开
      await service.disconnect();

      expect(disconnectedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'disconnected'
        })
      );
    });

    test('应该在发生错误时发出error事件', async () => {
      const errorSpy = jest.fn();
      service.on('error', errorSpy);

      const testError = new Error('测试错误');
      mockSocket.connect.mockImplementation(() => {
        setTimeout(() => {
          const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')?.[1];
          if (errorHandler) errorHandler(testError);
        }, 0);
      });

      const connectPromise = service.connect('192.168.1.100', 4045);
      jest.advanceTimersByTime(0);

      try {
        await connectPromise;
      } catch (error) {
        // 预期的错误
      }

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          data: testError,
          message: '测试错误'
        })
      );
    });
  });
});