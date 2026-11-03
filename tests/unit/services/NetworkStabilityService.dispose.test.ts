/**
 * NetworkStabilityService 资源释放 (dispose) 测试
 *
 * 目标：验证 dispose 显式清理入口能正确释放所有命名定时器，
 * 避免使用方不调用 disconnect() 就放弃实例导致的定时器泄漏。
 *
 * TDD：本文件先于 dispose 实现编写，预期在 dispose 补全前失败。
 */

// Mock 'net' 模块 - 变量名以 mock 开头以便 jest.mock hoist 规则允许引用
const mockSocketInstance = {
  connect: jest.fn(),
  write: jest.fn(),
  destroy: jest.fn(),
  setNoDelay: jest.fn(),
  setKeepAlive: jest.fn(),
  setDefaultEncoding: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('net', () => ({
  Socket: jest.fn(() => mockSocketInstance),
}));

import { NetworkStabilityService } from '../../../src/services/NetworkStabilityService';

/**
 * 私有命名定时器字段的访问类型
 * 用 unknown 避免 any，仅用于断言清理状态
 */
type TimerAccess = {
  heartbeatTimer: unknown;
  qualityTimer: unknown;
  reconnectTimer: unknown;
};

const timersOf = (svc: NetworkStabilityService): TimerAccess =>
  svc as unknown as TimerAccess;

describe('NetworkStabilityService 资源释放 (dispose)', () => {
  let service: NetworkStabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // 连接成功：触发 connect 回调
    mockSocketInstance.connect.mockImplementation(
      (_port: number, _host: string, callback?: () => void) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return mockSocketInstance;
      }
    );
    // 写入成功：触发 callback 无错误
    mockSocketInstance.write.mockImplementation(
      (_data: unknown, callback?: (error?: Error) => void) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return true;
      }
    );
    mockSocketInstance.destroy.mockReset();
    mockSocketInstance.on.mockReset().mockReturnValue(mockSocketInstance);
    mockSocketInstance.off.mockReset().mockReturnValue(mockSocketInstance);
    mockSocketInstance.setNoDelay.mockReset().mockReturnValue(mockSocketInstance);
    mockSocketInstance.setKeepAlive.mockReset().mockReturnValue(mockSocketInstance);
    mockSocketInstance.setDefaultEncoding.mockReset().mockReturnValue(mockSocketInstance);

    service = new NetworkStabilityService({ autoReconnect: false });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('dispose 显式清理入口', () => {
    // 辅助：在 fake timers 下完成连接（connect 回调由 setTimeout 调度，需手动 advance）
    const connectAndWait = async (host = '192.168.1.100', port = 4045): Promise<void> => {
      const p = service.connect(host, port);
      jest.advanceTimersByTime(20); // 触发 connect 回调
      await p;
    };

    it('未连接状态下调用 dispose 不应抛错', async () => {
      await expect(service.dispose()).resolves.not.toThrow();
    });

    it('连接后调用 dispose 应清理所有命名定时器', async () => {
      await connectAndWait();

      const timers = timersOf(service);
      // 连接成功后心跳与质量监控定时器应已建立
      expect(timers.heartbeatTimer).toBeDefined();
      expect(timers.qualityTimer).toBeDefined();

      await service.dispose();

      // dispose 后所有命名定时器都应被清理（undefined）
      expect(timers.heartbeatTimer).toBeUndefined();
      expect(timers.qualityTimer).toBeUndefined();
      expect(timers.reconnectTimer).toBeUndefined();
    });

    it('dispose 后心跳定时器不再触发数据发送', async () => {
      await connectAndWait();

      // 清除连接建立期间累计的 write 调用计数
      (mockSocketInstance.write as jest.Mock).mockClear();

      await service.dispose();

      // 推进远超心跳间隔的时间
      jest.advanceTimersByTime(60000);

      // dispose 后心跳回调不应再触发任何写入
      expect(mockSocketInstance.write).not.toHaveBeenCalled();
    });

    it('dispose 后质量监控定时器不再触发 quality_changed 事件', async () => {
      service.setConfiguration({ qualityCheckInterval: 1000 });
      await connectAndWait();

      await service.dispose();

      // dispose 后再监听，验证质量监控回调不再触发
      const qualityListener = jest.fn();
      service.on('quality_changed', qualityListener);

      jest.advanceTimersByTime(50000);

      expect(qualityListener).not.toHaveBeenCalled();
    });

    it('dispose 应关闭并销毁 socket', async () => {
      await connectAndWait();

      (mockSocketInstance.destroy as jest.Mock).mockClear();

      await service.dispose();

      expect(mockSocketInstance.destroy).toHaveBeenCalled();
    });

    it('dispose 后再次 dispose 不应抛错（幂等）', async () => {
      await connectAndWait();

      await service.dispose();
      await expect(service.dispose()).resolves.not.toThrow();
    });
  });
});
