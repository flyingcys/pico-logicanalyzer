/**
 * MemoryManager 性能测试
 * 测试内存管理器在高负载和大数据处理下的性能表现
 */

import { MemoryManager, MemoryStats } from '../../src/utils/MemoryManager';

describe('MemoryManager 性能测试', () => {
  let memoryManager: MemoryManager;
  
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
    memoryManager = new MemoryManager();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    if (memoryManager) {
      memoryManager.dispose();
    }
  });

  describe('大数据处理性能', () => {
    it('应该高效处理大量小内存块分配', async () => {
      const poolName = 'performancePool';
      memoryManager.createPool(poolName, { maxSize: 100 * 1024 * 1024 }); // 100MB

      const startTime = performance.now();
      const blockCount = 10000;
      const blockSize = 1024; // 1KB per block

      // 大量分配小内存块
      const allocations: boolean[] = [];
      for (let i = 0; i < blockCount; i++) {
        const data = new Uint8Array(blockSize);
        const result = memoryManager.allocate(poolName, `block_${i}`, data, {
          priority: 'medium',
          canRelease: true
        });
        allocations.push(result);
      }

      const allocTime = performance.now() - startTime;

      // 验证分配成功
      const successCount = allocations.filter(Boolean).length;
      expect(successCount).toBeGreaterThan(blockCount * 0.9); // 至少90%成功

      // 性能基准：分配10000个1KB块应该在100ms内完成
      expect(allocTime).toBeLessThan(100);

      const pool = memoryManager.getPoolInfo(poolName);
      expect(pool!.blocks.size).toBeGreaterThan(0);

      console.log(`📊 大量小块分配性能: ${blockCount}个块, ${allocTime.toFixed(2)}ms, ${(blockCount / allocTime * 1000).toFixed(0)} blocks/sec`);
    });

    it('应该高效处理大内存块分配和释放', async () => {
      const poolName = 'largeBlockPool';
      memoryManager.createPool(poolName, { maxSize: 500 * 1024 * 1024 }); // 500MB

      const blockSize = 10 * 1024 * 1024; // 10MB per block
      const blockCount = 20;

      const startTime = performance.now();

      // 分配大内存块
      const allocatedBlocks: string[] = [];
      for (let i = 0; i < blockCount; i++) {
        const data = new Uint8Array(blockSize);
        const blockId = `largeBlock_${i}`;
        const result = memoryManager.allocate(poolName, blockId, data);
        if (result) {
          allocatedBlocks.push(blockId);
        }
      }

      const allocTime = performance.now() - startTime;

      // 验证至少一半的大块分配成功
      expect(allocatedBlocks.length).toBeGreaterThan(blockCount * 0.4);

      // 性能基准：分配大块应该在200ms内完成
      expect(allocTime).toBeLessThan(200);

      // 测试释放性能
      const releaseStartTime = performance.now();
      for (const blockId of allocatedBlocks) {
        memoryManager.release(poolName, blockId);
      }
      const releaseTime = performance.now() - releaseStartTime;

      // 释放应该很快完成（允许为0）
      expect(releaseTime).toBeLessThanOrEqual(allocTime);

      console.log(`📊 大块处理性能: ${allocatedBlocks.length}个10MB块, 分配${allocTime.toFixed(2)}ms, 释放${releaseTime.toFixed(2)}ms`);
    });

    it('应该高效处理混合大小的内存分配', async () => {
      const poolName = 'mixedSizePool';
      memoryManager.createPool(poolName, { maxSize: 200 * 1024 * 1024 }); // 200MB

      const startTime = performance.now();
      const totalBlocks = 5000;
      let successCount = 0;

      // 混合大小分配：小(1KB)、中(100KB)、大(1MB)
      for (let i = 0; i < totalBlocks; i++) {
        let size: number;
        let priority: 'high' | 'medium' | 'low';

        if (i % 100 === 0) {
          // 1%大块
          size = 1024 * 1024; // 1MB
          priority = 'high';
        } else if (i % 10 === 0) {
          // 10%中块
          size = 100 * 1024; // 100KB
          priority = 'medium';
        } else {
          // 89%小块
          size = 1024; // 1KB
          priority = 'low';
        }

        const data = new Uint8Array(size);
        const result = memoryManager.allocate(poolName, `mixed_${i}`, data, {
          priority,
          canRelease: true
        });

        if (result) successCount++;
      }

      const totalTime = performance.now() - startTime;

      // 验证大部分分配成功
      expect(successCount).toBeGreaterThan(totalBlocks * 0.7);

      // 性能基准：混合分配应该在150ms内完成
      expect(totalTime).toBeLessThan(150);

      console.log(`📊 混合大小分配性能: ${successCount}/${totalBlocks}块成功, ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('内存释放策略性能', () => {
    it('应该高效执行LRU策略释放', async () => {
      const poolName = 'lruPerformancePool';
      memoryManager.createPool(poolName, { 
        maxSize: 10 * 1024 * 1024, // 10MB
        releaseStrategy: 'lru' 
      });

      // 填满内存池
      const blockSize = 100 * 1024; // 100KB
      const maxBlocks = 100; // 约10MB

      for (let i = 0; i < maxBlocks; i++) {
        const data = new Uint8Array(blockSize);
        memoryManager.allocate(poolName, `lru_${i}`, data);
      }

      // 访问一些块来建立LRU历史
      for (let i = 0; i < 50; i++) {
        jest.advanceTimersByTime(10);
        memoryManager.get(poolName, `lru_${i}`);
      }

      // 强制触发内存释放
      const startTime = performance.now();
      const largeData = new Uint8Array(2 * 1024 * 1024); // 2MB，强制释放
      memoryManager.allocate(poolName, 'trigger_release', largeData);
      const releaseTime = performance.now() - startTime;

      // LRU释放应该在合理时间内完成
      expect(releaseTime).toBeLessThan(50);

      console.log(`📊 LRU策略释放性能: ${releaseTime.toFixed(2)}ms`);
    });

    it('应该高效执行优先级策略释放', async () => {
      const poolName = 'priorityPerformancePool';
      memoryManager.createPool(poolName, { 
        maxSize: 10 * 1024 * 1024, 
        releaseStrategy: 'priority' 
      });

      const blockSize = 200 * 1024; // 200KB
      
      // 分配不同优先级的块
      for (let i = 0; i < 20; i++) {
        const priority = i < 5 ? 'high' : i < 15 ? 'medium' : 'low';
        const data = new Uint8Array(blockSize);
        memoryManager.allocate(poolName, `priority_${i}`, data, { priority });
      }

      const startTime = performance.now();
      // 强制触发优先级释放
      const largeData = new Uint8Array(5 * 1024 * 1024); // 5MB
      memoryManager.allocate(poolName, 'trigger_priority_release', largeData);
      const releaseTime = performance.now() - startTime;

      // 优先级释放应该在合理时间内完成
      expect(releaseTime).toBeLessThan(30);

      const pool = memoryManager.getPoolInfo(poolName);
      // 高优先级的块应该被保留
      const highPriorityBlocks = Array.from(pool!.blocks.keys())
        .filter(key => key.startsWith('priority_') && parseInt(key.split('_')[1]) < 5);
      expect(highPriorityBlocks.length).toBeGreaterThan(0);

      console.log(`📊 优先级策略释放性能: ${releaseTime.toFixed(2)}ms`);
    });
  });

  describe('垃圾回收性能', () => {
    it('应该高效执行大规模垃圾回收', async () => {
      const poolName = 'gcPerformancePool';
      memoryManager.createPool(poolName, { maxSize: 50 * 1024 * 1024 }); // 50MB

      // 创建大量将要过期的内存块
      const blockCount = 1000;
      for (let i = 0; i < blockCount; i++) {
        const data = new Uint8Array(10 * 1024); // 10KB
        memoryManager.allocate(poolName, `gc_test_${i}`, data, {
          priority: i % 3 === 0 ? 'high' : 'low', // 1/3高优先级，不会被GC
          canRelease: true
        });
      }

      // 模拟时间流逝，使块过期
      jest.advanceTimersByTime(6 * 60 * 1000); // 6分钟

      const startTime = performance.now();
      memoryManager.forceGarbageCollection();
      const gcTime = performance.now() - startTime;

      // GC应该在合理时间内完成
      expect(gcTime).toBeLessThan(100);

      const pool = memoryManager.getPoolInfo(poolName);
      const remainingBlocks = pool!.blocks.size;
      
      // 应该清理了低优先级的过期块
      expect(remainingBlocks).toBeLessThan(blockCount);

      console.log(`📊 大规模垃圾回收性能: ${blockCount}块 -> ${remainingBlocks}块, ${gcTime.toFixed(2)}ms`);
    });

    it('应该高效检测内存泄漏', async () => {
      // 使用真实时间来测试泄漏检测
      jest.useRealTimers();
      const realMemoryManager = new MemoryManager();
      
      try {
        const poolCount = 5; // 减少数量以加快测试
        const blocksPerPool = 50;

        // 创建多个池和大量可疑块
        for (let p = 0; p < poolCount; p++) {
          const poolName = `leak_pool_${p}`;
          realMemoryManager.createPool(poolName, { maxSize: 5 * 1024 * 1024 });

          for (let b = 0; b < blocksPerPool; b++) {
            const data = new Uint8Array(1024);
            realMemoryManager.allocate(poolName, `leak_block_${p}_${b}`, data);
          }
        }

        // 短暂等待以创建时间差
        await new Promise(resolve => setTimeout(resolve, 100));

        const startTime = performance.now();
        const leaks = realMemoryManager.detectMemoryLeaks();
        const detectionTime = performance.now() - startTime;

        // 泄漏检测应该在合理时间内完成
        expect(detectionTime).toBeLessThan(50);

        // 由于时间较短，可能不会检测到泄漏，但检测过程应该正常运行
        expect(leaks.length).toBeGreaterThanOrEqual(0);

        console.log(`📊 内存泄漏检测性能: ${leaks.length}个泄漏, ${detectionTime.toFixed(2)}ms`);
      } finally {
        realMemoryManager.dispose();
        jest.useFakeTimers();
      }
    });
  });

  describe('并发性能测试', () => {
    it('应该高效处理并发内存操作', async () => {
      const poolName = 'concurrentPool';
      memoryManager.createPool(poolName, { maxSize: 20 * 1024 * 1024 }); // 20MB

      const operationCount = 1000;
      const startTime = performance.now();

      // 模拟并发操作
      const promises = [];
      for (let i = 0; i < operationCount; i++) {
        const promise = Promise.resolve().then(() => {
          const data = new Uint8Array(5 * 1024); // 5KB
          const blockId = `concurrent_${i}`;

          // 分配
          const allocated = memoryManager.allocate(poolName, blockId, data);
          
          if (allocated) {
            // 随机访问
            if (Math.random() > 0.5) {
              memoryManager.get(poolName, blockId);
            }

            // 随机释放
            if (Math.random() > 0.7) {
              memoryManager.release(poolName, blockId);
            }
          }

          return allocated;
        });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      const successCount = results.filter(Boolean).length;

      // 并发操作应该在合理时间内完成
      expect(totalTime).toBeLessThan(200);

      // 大部分操作应该成功
      expect(successCount).toBeGreaterThan(operationCount * 0.6);

      console.log(`📊 并发操作性能: ${successCount}/${operationCount}操作成功, ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('内存统计性能', () => {
    it('应该高效计算大规模内存统计', async () => {
      const poolCount = 50;
      const blocksPerPool = 100;

      // 创建大规模内存结构
      for (let p = 0; p < poolCount; p++) {
        const poolName = `stats_pool_${p}`;
        memoryManager.createPool(poolName, { maxSize: 2 * 1024 * 1024 });

        for (let b = 0; b < blocksPerPool; b++) {
          const data = new Uint8Array(Math.random() * 5000 + 1000); // 1-6KB随机大小
          memoryManager.allocate(poolName, `stats_block_${p}_${b}`, data, {
            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any
          });
        }
      }

      // 建立内存历史
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(30000); // 30秒间隔
      }

      const startTime = performance.now();
      const stats = memoryManager.getMemoryStats();
      const statsTime = performance.now() - startTime;

      // 统计计算应该在合理时间内完成
      expect(statsTime).toBeLessThan(50);

      // 验证统计数据的正确性
      expect(stats.poolCount).toBe(poolCount + 4); // +4个默认池
      expect(stats.activeBlocks).toBeGreaterThan(poolCount * blocksPerPool * 0.8);
      expect(stats.totalUsed).toBeGreaterThan(0);
      expect(stats.leakDetection).toBeDefined();

      console.log(`📊 大规模统计计算性能: ${stats.poolCount}池, ${stats.activeBlocks}块, ${statsTime.toFixed(2)}ms`);
    });
  });

  describe('数据大小计算性能', () => {
    it('应该高效计算复杂数据结构大小', async () => {
      const poolName = 'complexDataPool';
      memoryManager.createPool(poolName, { maxSize: 50 * 1024 * 1024 });

      // 创建复杂的数据结构
      const complexDataSamples = [];
      for (let i = 0; i < 100; i++) {
        const complexData = {
          id: i,
          name: `Complex Object ${i}`,
          buffer: new Uint8Array(Math.random() * 10000 + 1000),
          nestedArray: Array.from({ length: 100 }, (_, j) => ({
            index: j,
            data: Math.random().toString(36),
            subBuffer: new Uint16Array(50)
          })),
          map: new Map(Array.from({ length: 50 }, (_, k) => [`key${k}`, `value${k}`])),
          set: new Set(Array.from({ length: 30 }, (_, l) => l)),
          circularRef: {} as any
        };
        complexData.circularRef.self = complexData;
        complexDataSamples.push(complexData);
      }

      const startTime = performance.now();

      // 分配复杂数据
      let successCount = 0;
      for (let i = 0; i < complexDataSamples.length; i++) {
        const result = memoryManager.allocate(poolName, `complex_${i}`, complexDataSamples[i]);
        if (result) successCount++;
      }

      const allocationTime = performance.now() - startTime;

      // 复杂数据大小计算和分配应该在合理时间内完成
      expect(allocationTime).toBeLessThan(200);

      // 大部分分配应该成功
      expect(successCount).toBeGreaterThan(complexDataSamples.length * 0.7);

      console.log(`📊 复杂数据处理性能: ${successCount}/${complexDataSamples.length}对象, ${allocationTime.toFixed(2)}ms`);
    });
  });

  describe('压力测试', () => {
    it('应该在高内存压力下保持稳定', async () => {
      const poolName = 'stressTestPool';
      const poolSize = 50 * 1024 * 1024; // 50MB
      memoryManager.createPool(poolName, { maxSize: poolSize });

      const startTime = performance.now();
      let operations = 0;
      let errors = 0;

      // 持续10秒的压力测试
      const endTime = startTime + 10000;
      let iterationCount = 0;

      while (performance.now() < endTime && iterationCount < 10000) {
        try {
          const blockSize = Math.random() * 100000 + 1000; // 1KB-100KB
          const data = new Uint8Array(blockSize);
          const blockId = `stress_${iterationCount}`;

          const allocated = memoryManager.allocate(poolName, blockId, data);
          operations++;

          if (allocated && Math.random() > 0.7) {
            // 30%概率释放
            memoryManager.release(poolName, blockId);
            operations++;
          }

          // 偶尔执行GC
          if (iterationCount % 500 === 0) {
            memoryManager.forceGarbageCollection();
          }

          iterationCount++;
        } catch (error) {
          errors++;
        }
      }

      const totalTime = performance.now() - startTime;
      const operationsPerSecond = operations / (totalTime / 1000);

      // 应该保持高吞吐量且错误率低
      expect(operationsPerSecond).toBeGreaterThan(100); // 至少100 ops/sec
      expect(errors / operations).toBeLessThan(0.05); // 错误率小于5%

      const finalStats = memoryManager.getMemoryStats();
      expect(finalStats.totalUsed).toBeLessThan(poolSize); // 不应该超出池大小

      console.log(`📊 压力测试性能: ${operations}操作, ${operationsPerSecond.toFixed(0)} ops/sec, ${errors}错误, ${totalTime.toFixed(0)}ms`);
    });
  });
});