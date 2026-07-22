import { ExampleNetworkDriver } from '../../../src/driver-sdk/examples/ExampleNetworkDriver';

describe('ExampleNetworkDriver 资源管理', () => {
  let clearIntervalSpy: jest.SpyInstance;
  let clearTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    clearIntervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it('enableRealTimeStreaming 启动的 interval 在 dispose 时被清理', async () => {
    const driver = new ExampleNetworkDriver('127.0.0.1', 8080);

    const enabled = await driver.enableRealTimeStreaming(() => {
      /* noop */
    });
    expect(enabled).toBe(true);

    // dispose 前先重置 spy，便于断言 dispose 内部的清理调用
    clearIntervalSpy.mockClear();
    clearTimeoutSpy.mockClear();

    driver.dispose();

    // 关键断言：流式 interval 与 10s 停止定时器都必须在 dispose 时被释放
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('dispose 后流式 interval 不再触发回调', async () => {
    const driver = new ExampleNetworkDriver('127.0.0.1', 8080);
    const callback = jest.fn();

    await driver.enableRealTimeStreaming(callback);
    driver.dispose();

    callback.mockClear();
    // 推进远超 interval 周期，确认不再有回调被触发
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
  });
});
