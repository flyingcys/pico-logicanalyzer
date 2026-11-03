/**
 * PerformanceOptimizer 资源清理测试
 * 验证内部延迟定时器（批次间延迟、内存优化延迟）可被 dispose 清理，
 * 不在异常/停止路径残留 setTimeout。
 */

import { PerformanceOptimizer } from '../../../src/decoders/PerformanceOptimizer';
import type { DecoderResult } from '../../../src/decoders/types';

describe('PerformanceOptimizer 资源清理', () => {
  it('dispose 清理 performMemoryOptimization 进行中的延迟定时器', async () => {
    jest.useFakeTimers();
    const optimizer = new PerformanceOptimizer();
    const clearSpy = jest.spyOn(globalThis, 'clearTimeout');

    const promise = optimizer.performMemoryOptimization();
    // 推进微任务，让 performMemoryOptimization 执行到内部 delay(100)
    await Promise.resolve();

    // 此时 delay 定时器处于 pending，dispose 应 clearTimeout
    optimizer.dispose();
    expect(clearSpy).toHaveBeenCalled();

    // dispose 释放了 delay 等待，promise 应能完成
    await promise;

    clearSpy.mockRestore();
    jest.useRealTimers();
  });

  it('processBatch 正常完成且结果完整', async () => {
    const optimizer = new PerformanceOptimizer(
      {},
      { batchSize: 2, batchInterval: 1, maxBatches: 10 }
    );
    const items = [1, 2, 3, 4];
    const processor = async (item: number): Promise<DecoderResult[]> => [
      { startSample: item, endSample: item, values: [String(item)] }
    ];

    const results = await optimizer.processBatch(items, processor);
    expect(results).toHaveLength(4);
    expect(results[0].values).toEqual(['1']);
  });

  it('dispose 幂等，多次调用不抛错', () => {
    const optimizer = new PerformanceOptimizer();
    expect(() => {
      optimizer.dispose();
      optimizer.dispose();
    }).not.toThrow();
  });

  it('processBatch 完成后内部延迟定时器被清理', async () => {
    const optimizer = new PerformanceOptimizer(
      {},
      { batchSize: 1, batchInterval: 1, maxBatches: 5 }
    );
    const clearSpy = jest.spyOn(globalThis, 'clearTimeout');

    await optimizer.processBatch([1, 2], async () => []);

    // 完成路径触发 finally 清理（防御性 clearTimeout）
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
