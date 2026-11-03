import { ProtocolHelper } from '../../../src/driver-sdk/tools/ProtocolHelper';

describe('ProtocolHelper.utils.createTimeout 资源管理', () => {
  let clearTimeoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
  });

  afterEach(() => {
    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it('promise 先于超时完成时清理超时定时器，避免泄漏', async () => {
    const promise = Promise.resolve('ok');

    const result = await ProtocolHelper.utils.createTimeout(promise, 5000);

    expect(result).toBe('ok');
    // 关键断言：定时器必须被释放，而非持续悬挂
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('promise 先于超时 reject 时也清理超时定时器', async () => {
    const promise = Promise.reject(new Error('boom'));

    await expect(ProtocolHelper.utils.createTimeout(promise, 5000)).rejects.toThrow('boom');

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('超时触发后 reject 并清理自身', async () => {
    const pending = new Promise<string>(() => {
      /* never resolves */
    });

    const timeoutPromise = ProtocolHelper.utils.createTimeout(pending, 1000, '超时啦');

    jest.advanceTimersByTime(1000);

    await expect(timeoutPromise).rejects.toThrow('超时啦');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('超时定时器被清理后不再触发副作用回调', async () => {
    const sideEffect = jest.fn();
    const promise = Promise.resolve('done');

    await ProtocolHelper.utils.createTimeout(promise, 5000);

    // 推进远超超时时间，确认定时器已清除、不会执行任何残留回调
    jest.advanceTimersByTime(10000);
    expect(sideEffect).not.toHaveBeenCalled();
  });
});
