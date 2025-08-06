/**
 * PerformanceOptimizer.ts 单元测试
 * 快速提高 DECODERS 模块覆盖率
 */

import '../tests/setup';
import {
  DecodingPerformanceOptimizer,
  DecodingWorkerPool,
  PerformanceProfiler
} from '../decoders/PerformanceOptimizer';
import type { ChannelData, DecoderResult } from '../decoders/types';

describe('PerformanceOptimizer', () => {
  describe('DecodingPerformanceOptimizer', () => {
    let optimizer: DecodingPerformanceOptimizer;
    let mockChannelData: ChannelData[];

    beforeEach(() => {
      optimizer = new DecodingPerformanceOptimizer();
      mockChannelData = [
        {
          channelNumber: 0,
          channelName: 'CH0',
          samples: new Uint8Array([1, 0, 1, 0, 1])
        }
      ];
    });

    test('应该创建实例', () => {
      expect(optimizer).toBeDefined();
    });

    test('应该估计复杂度', () => {
      const complexity = optimizer.estimateComplexity(mockChannelData, 'i2c');
      expect(typeof complexity).toBe('number');
      expect(complexity).toBeGreaterThanOrEqual(0);
    });

    test('应该推荐策略', () => {
      const strategy = optimizer.recommendStrategy(mockChannelData, 'i2c');
      expect(strategy).toBeDefined();
      expect(['sequential', 'parallel', 'streaming']).toContain(strategy.type);
    });

    test('应该优化数据', () => {
      const optimized = optimizer.optimizeData(mockChannelData);
      expect(optimized).toBeDefined();
      expect(Array.isArray(optimized)).toBe(true);
    });
  });

  describe('DecodingWorkerPool', () => {
    let workerPool: DecodingWorkerPool;

    beforeEach(() => {
      workerPool = new DecodingWorkerPool(2); // 2 workers
    });

    afterEach(() => {
      workerPool.terminate();
    });

    test('应该创建工作池', () => {
      expect(workerPool).toBeDefined();
    });

    test('应该获取池状态', () => {
      const status = workerPool.getPoolStatus();
      expect(status).toBeDefined();
      expect(typeof status.totalWorkers).toBe('number');
      expect(typeof status.activeWorkers).toBe('number');
      expect(typeof status.queuedTasks).toBe('number');
    });
  });

  describe('PerformanceProfiler', () => {
    let profiler: PerformanceProfiler;

    beforeEach(() => {
      profiler = new PerformanceProfiler();
    });

    test('应该创建实例', () => {
      expect(profiler).toBeDefined();
    });

    test('应该开始和结束性能监控', () => {
      profiler.start('test-profile');
      expect(() => profiler.end('test-profile')).not.toThrow();
    });

    test('应该生成性能报告', () => {
      profiler.start('test-profile');
      profiler.end('test-profile');
      const report = profiler.generateReport();
      
      expect(report).toBeDefined();
      expect(report.profiles).toBeDefined();
      expect(Array.isArray(report.profiles)).toBe(true);
    });

    test('应该清空数据', () => {
      profiler.start('test-profile');
      profiler.end('test-profile');
      profiler.clear();
      
      const report = profiler.generateReport();
      expect(report.profiles.length).toBe(0);
    });
  });
});

export {};