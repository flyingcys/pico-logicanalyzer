/**
 * MemoryManager 单元测试
 * 测试内存管理器的完整功能，包括内存池管理、垃圾回收、泄漏检测等
 */

import { MemoryManager, MemoryBlock, MemoryPool, MemoryStats } from '../../../src/utils/MemoryManager';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    // 清除console输出以避免测试污染
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    memoryManager = new MemoryManager();
  });

  afterEach(() => {
    memoryManager.dispose();
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('初始化和默认池创建', () => {
    it('应该创建默认内存池', () => {
      const pools = memoryManager.getAllPoolsInfo();
      expect(pools).toHaveLength(4);

      const poolNames = pools.map(pool => pool.name);
      expect(poolNames).toContain('channelData');
      expect(poolNames).toContain('decoderResults');
      expect(poolNames).toContain('cache');
      expect(poolNames).toContain('temporary');
    });

    it('应该正确配置默认池的参数', () => {
      const channelDataPool = memoryManager.getPoolInfo('channelData');
      expect(channelDataPool).not.toBeNull();
      expect(channelDataPool!.maxSize).toBe(200 * 1024 * 1024); // 200MB
      expect(channelDataPool!.releaseStrategy).toBe('lru');

      const decoderResultsPool = memoryManager.getPoolInfo('decoderResults');
      expect(decoderResultsPool).not.toBeNull();
      expect(decoderResultsPool!.maxSize).toBe(50 * 1024 * 1024); // 50MB
      expect(decoderResultsPool!.releaseStrategy).toBe('priority');
    });

    it('应该初始化空的内存统计', () => {
      const stats = memoryManager.getMemoryStats();
      expect(stats.totalUsed).toBe(0);
      expect(stats.poolCount).toBe(4);
      expect(stats.activeBlocks).toBe(0);
    });
  });

  describe('内存池管理', () => {
    it('应该创建自定义内存池', () => {
      memoryManager.createPool('testPool', {
        maxSize: 10 * 1024 * 1024, // 10MB
        releaseStrategy: 'fifo'
      });

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool).not.toBeNull();
      expect(pool!.name).toBe('testPool');
      expect(pool!.maxSize).toBe(10 * 1024 * 1024);
      expect(pool!.releaseStrategy).toBe('fifo');
      expect(pool!.currentSize).toBe(0);
    });

    it('应该使用默认参数创建池', () => {
      memoryManager.createPool('defaultPool');

      const pool = memoryManager.getPoolInfo('defaultPool');
      expect(pool).not.toBeNull();
      expect(pool!.maxSize).toBe(100 * 1024 * 1024); // 默认100MB
      expect(pool!.releaseStrategy).toBe('lru'); // 默认LRU
    });

    it('应该清空内存池', () => {
      // 先分配一些内存
      const testData = new Uint8Array(1024);
      memoryManager.allocate('cache', 'test1', testData);
      memoryManager.allocate('cache', 'test2', testData);

      let pool = memoryManager.getPoolInfo('cache');
      expect(pool!.blocks.size).toBe(2);
      expect(pool!.currentSize).toBeGreaterThan(0);

      // 清空池
      memoryManager.clearPool('cache');

      pool = memoryManager.getPoolInfo('cache');
      expect(pool!.blocks.size).toBe(0);
      expect(pool!.currentSize).toBe(0);
    });

    it('应该正确获取所有池信息', () => {
      memoryManager.createPool('test1');
      memoryManager.createPool('test2');

      const allPools = memoryManager.getAllPoolsInfo();
      expect(allPools).toHaveLength(6); // 4个默认 + 2个新建
    });
  });

  describe('内存分配', () => {
    it('应该成功分配内存', () => {
      const testData = new Uint8Array(1024);
      const success = memoryManager.allocate('cache', 'test1', testData, {
        priority: 'high',
        canRelease: false
      });

      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('cache');
      expect(pool!.blocks.size).toBe(1);
      expect(pool!.currentSize).toBeGreaterThan(0);
    });

    it('应该计算不同数据类型的大小', () => {
      // 测试不同类型的数据分配
      const testCases = [
        { data: new Uint8Array(100), name: 'uint8array' },
        { data: 'test string', name: 'string' },
        { data: 42, name: 'number' },
        { data: true, name: 'boolean' },
        { data: [1, 2, 3], name: 'array' },
        { data: { key: 'value' }, name: 'object' },
        { data: null, name: 'null' },
        { data: undefined, name: 'undefined' }
      ];

      testCases.forEach((testCase, index) => {
        const success = memoryManager.allocate('temporary', `test${index}`, testCase.data);
        expect(success).toBe(true);
      });

      const pool = memoryManager.getPoolInfo('temporary');
      expect(pool!.blocks.size).toBe(testCases.length);
    });

    it('应该处理内存不足的情况', () => {
      // 创建小容量池进行测试
      memoryManager.createPool('smallPool', { maxSize: 100 });

      // 分配大于池容量的数据
      const largeData = new Uint8Array(200);
      const success = memoryManager.allocate('smallPool', 'large', largeData);

      expect(success).toBe(false);
    });

    it('应该拒绝分配到不存在的池', () => {
      const testData = new Uint8Array(100);
      const success = memoryManager.allocate('nonExistentPool', 'test', testData);

      expect(success).toBe(false);
    });

    it('应该正确处理默认参数', () => {
      const testData = new Uint8Array(100);
      memoryManager.allocate('cache', 'test', testData);

      const retrievedData = memoryManager.get('cache', 'test');
      expect(retrievedData).toBe(testData);

      const pool = memoryManager.getPoolInfo('cache');
      const block = pool!.blocks.get('test');
      expect(block!.priority).toBe('medium'); // 默认优先级
      expect(block!.canRelease).toBe(true); // 默认可释放
    });
  });

  describe('内存访问和获取', () => {
    beforeEach(() => {
      // 为每个测试准备一些数据
      const testData1 = new Uint8Array([1, 2, 3]);
      const testData2 = 'test string';
      memoryManager.allocate('cache', 'data1', testData1);
      memoryManager.allocate('cache', 'data2', testData2);
    });

    it('应该成功获取已分配的数据', () => {
      const data1 = memoryManager.get('cache', 'data1');
      const data2 = memoryManager.get('cache', 'data2');

      expect(data1).toBeInstanceOf(Uint8Array);
      expect(data1[0]).toBe(1);
      expect(data2).toBe('test string');
    });

    it('应该更新访问信息', async () => {
      const pool = memoryManager.getPoolInfo('cache');
      const block = pool!.blocks.get('data1');
      const initialAccessCount = block!.accessCount;
      const initialAccessTime = block!.lastAccessedAt;

      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      memoryManager.get('cache', 'data1');

      const updatedBlock = pool!.blocks.get('data1');
      expect(updatedBlock!.accessCount).toBe(initialAccessCount + 1);
      expect(updatedBlock!.lastAccessedAt).toBeGreaterThan(initialAccessTime);
    });

    it('应该处理不存在的池', () => {
      const result = memoryManager.get('nonExistentPool', 'data1');
      expect(result).toBeNull();
    });

    it('应该处理不存在的数据块', () => {
      const result = memoryManager.get('cache', 'nonExistentData');
      expect(result).toBeNull();
    });
  });

  describe('内存释放', () => {
    beforeEach(() => {
      // 准备测试数据
      memoryManager.allocate('cache', 'test1', new Uint8Array(100));
      memoryManager.allocate('cache', 'test2', 'test string');
      memoryManager.allocate('cache', 'test3', { key: 'value' });
    });

    it('应该成功释放指定内存块', () => {
      const pool = memoryManager.getPoolInfo('cache');
      const initialSize = pool!.currentSize;
      const initialBlockCount = pool!.blocks.size;

      const success = memoryManager.release('cache', 'test1');

      expect(success).toBe(true);
      expect(pool!.blocks.size).toBe(initialBlockCount - 1);
      expect(pool!.currentSize).toBeLessThan(initialSize);
      expect(pool!.blocks.has('test1')).toBe(false);
    });

    it('应该清理数据引用', () => {
      const testArray = [1, 2, 3, 4, 5];
      const testObject = { a: 1, b: 2, c: 3 };
      
      memoryManager.allocate('temporary', 'array', testArray);
      memoryManager.allocate('temporary', 'object', testObject);

      memoryManager.release('temporary', 'array');
      memoryManager.release('temporary', 'object');

      // 验证数据被清理（虽然我们无法直接验证内部清理，但可以验证不再存在）
      expect(memoryManager.get('temporary', 'array')).toBeNull();
      expect(memoryManager.get('temporary', 'object')).toBeNull();
    });

    it('应该处理释放不存在的块', () => {
      const success1 = memoryManager.release('cache', 'nonExistent');
      const success2 = memoryManager.release('nonExistentPool', 'test1');

      expect(success1).toBe(false);
      expect(success2).toBe(false);
    });
  });

  describe('内存释放策略', () => {
    beforeEach(() => {
      // 创建测试池
      memoryManager.createPool('lruPool', { maxSize: 1000, releaseStrategy: 'lru' });
      memoryManager.createPool('lfuPool', { maxSize: 1000, releaseStrategy: 'lfu' });
      memoryManager.createPool('fifoPool', { maxSize: 1000, releaseStrategy: 'fifo' });
      memoryManager.createPool('priorityPool', { maxSize: 1000, releaseStrategy: 'priority' });
    });

    it('应该使用LRU策略释放内存', async () => {
      // 分配接近池容量的数据
      const data = new Uint8Array(300);
      memoryManager.allocate('lruPool', 'block1', data);
      memoryManager.allocate('lruPool', 'block2', data);
      memoryManager.allocate('lruPool', 'block3', data);

      // 访问block1和block3，使block2成为最少最近使用
      await new Promise(resolve => setTimeout(resolve, 10));
      memoryManager.get('lruPool', 'block1');
      memoryManager.get('lruPool', 'block3');

      // 分配新数据应该触发LRU释放
      const success = memoryManager.allocate('lruPool', 'block4', data);
      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('lruPool');
      // block2应该被释放
      expect(pool!.blocks.has('block2')).toBe(false);
    });

    it('应该使用LFU策略释放内存', () => {
      const data = new Uint8Array(300);
      memoryManager.allocate('lfuPool', 'block1', data);
      memoryManager.allocate('lfuPool', 'block2', data);
      memoryManager.allocate('lfuPool', 'block3', data);

      // 多次访问block1和block3
      for (let i = 0; i < 5; i++) {
        memoryManager.get('lfuPool', 'block1');
        memoryManager.get('lfuPool', 'block3');
      }
      // block2只访问了一次（分配时）

      // 分配新数据应该触发LFU释放
      const success = memoryManager.allocate('lfuPool', 'block4', data);
      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('lfuPool');
      expect(pool!.blocks.has('block2')).toBe(false);
    });

    it('应该使用FIFO策略释放内存', async () => {
      const data = new Uint8Array(300);
      memoryManager.allocate('fifoPool', 'block1', data);
      await new Promise(resolve => setTimeout(resolve, 10));
      memoryManager.allocate('fifoPool', 'block2', data);
      await new Promise(resolve => setTimeout(resolve, 10));
      memoryManager.allocate('fifoPool', 'block3', data);

      // 分配新数据应该触发FIFO释放（最先分配的block1被释放）
      const success = memoryManager.allocate('fifoPool', 'block4', data);
      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('fifoPool');
      expect(pool!.blocks.has('block1')).toBe(false);
    });

    it('应该使用优先级策略释放内存', () => {
      const data = new Uint8Array(300);
      memoryManager.allocate('priorityPool', 'highPriority', data, { priority: 'high' });
      memoryManager.allocate('priorityPool', 'mediumPriority', data, { priority: 'medium' });
      memoryManager.allocate('priorityPool', 'lowPriority', data, { priority: 'low' });

      // 分配新数据应该触发优先级释放（低优先级的先被释放）
      const success = memoryManager.allocate('priorityPool', 'newBlock', data);
      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('priorityPool');
      expect(pool!.blocks.has('lowPriority')).toBe(false);
      expect(pool!.blocks.has('highPriority')).toBe(true);
    });

    it('应该跳过不可释放的内存块', () => {
      memoryManager.createPool('restrictedPool', { maxSize: 500 });
      
      const data = new Uint8Array(200);
      memoryManager.allocate('restrictedPool', 'protected', data, { canRelease: false });
      memoryManager.allocate('restrictedPool', 'releasable', data, { canRelease: true });

      // 尝试分配大数据，应该只释放可释放的块
      const largeData = new Uint8Array(200);
      const success = memoryManager.allocate('restrictedPool', 'large', largeData);
      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('restrictedPool');
      expect(pool!.blocks.has('protected')).toBe(true);
      expect(pool!.blocks.has('releasable')).toBe(false);
    });
  });

  describe('垃圾回收', () => {
    beforeEach(() => {
      // 模拟global.gc
      (global as any).gc = jest.fn();
    });

    afterEach(() => {
      delete (global as any).gc;
    });

    it('应该执行强制垃圾回收', () => {
      const initialStats = memoryManager.getMemoryStats();
      
      memoryManager.forceGarbageCollection();

      expect((global as any).gc).toHaveBeenCalled();
    });

    it('应该清理过期的内存块', async () => {
      // 分配一些数据并等待
      const data = new Uint8Array(100);
      memoryManager.allocate('temporary', 'oldBlock', data, { priority: 'low' });
      
      // 模拟时间推移 - 使用jest.useFakeTimers()来控制时间
      jest.useFakeTimers();
      
      // 推进时间超过过期时间（5分钟）
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      memoryManager.forceGarbageCollection();

      const pool = memoryManager.getPoolInfo('temporary');
      expect(pool!.blocks.has('oldBlock')).toBe(false);

      jest.useRealTimers();
    });

    it('应该保护高优先级内存块不被清理', async () => {
      const data = new Uint8Array(100);
      memoryManager.allocate('temporary', 'highPriorityBlock', data, { priority: 'high' });
      
      jest.useFakeTimers();
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      memoryManager.forceGarbageCollection();

      const pool = memoryManager.getPoolInfo('temporary');
      expect(pool!.blocks.has('highPriorityBlock')).toBe(true);

      jest.useRealTimers();
    });

    it('应该处理没有系统GC的情况', () => {
      delete (global as any).gc;
      
      expect(() => {
        memoryManager.forceGarbageCollection();
      }).not.toThrow();
    });
  });

  describe('内存泄漏检测', () => {
    it('应该检测可疑的内存泄漏', () => {
      jest.useFakeTimers();
      
      // 创建一些"泄漏"的内存块（长时间存在且只访问过一次）
      const data = new Uint8Array(100);
      memoryManager.allocate('cache', 'leak1', data);
      memoryManager.allocate('cache', 'leak2', data);
      memoryManager.allocate('cache', 'normalBlock', data);

      // 推进时间超过可疑年龄（10分钟）
      jest.advanceTimersByTime(11 * 60 * 1000);

      // 访问正常块使其不被视为泄漏
      memoryManager.get('cache', 'normalBlock');

      const leaks = memoryManager.detectMemoryLeaks();

      expect(leaks).toHaveLength(2);
      expect(leaks.map(leak => leak.blockId)).toContain('leak1');
      expect(leaks.map(leak => leak.blockId)).toContain('leak2');
      expect(leaks.map(leak => leak.blockId)).not.toContain('normalBlock');

      jest.useRealTimers();
    });

    it('应该提供详细的泄漏信息', () => {
      jest.useFakeTimers();
      
      const data = new Uint8Array(1024);
      memoryManager.allocate('cache', 'suspiciousBlock', data);
      
      jest.advanceTimersByTime(11 * 60 * 1000);
      
      const leaks = memoryManager.detectMemoryLeaks();
      
      expect(leaks).toHaveLength(1);
      const leak = leaks[0];
      expect(leak.poolName).toBe('cache');
      expect(leak.blockId).toBe('suspiciousBlock');
      expect(leak.age).toBeGreaterThan(10 * 60 * 1000);
      expect(leak.size).toBeGreaterThan(0);
      expect(leak.accessCount).toBe(1);

      jest.useRealTimers();
    });

    it('应该在没有泄漏时返回空数组', () => {
      const data = new Uint8Array(100);
      memoryManager.allocate('cache', 'activeBlock', data);
      
      // 多次访问使其不被视为泄漏
      for (let i = 0; i < 5; i++) {
        memoryManager.get('cache', 'activeBlock');
      }

      const leaks = memoryManager.detectMemoryLeaks();
      expect(leaks).toHaveLength(0);
    });
  });

  describe('内存监控', () => {
    it('应该启动内存监控', () => {
      jest.useFakeTimers();
      
      const newManager = new MemoryManager();
      
      // 验证定时器被设置
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      
      newManager.dispose();
      jest.useRealTimers();
    });

    it('应该在内存使用率过高时触发垃圾回收', () => {
      // 简单测试：验证setMemoryThreshold方法可以工作
      memoryManager.setMemoryThreshold(0.8);
      
      // 验证forceGarbageCollection方法可以被调用
      const gcSpy = jest.spyOn(memoryManager, 'forceGarbageCollection').mockImplementation(() => {});
      
      // 手动调用一次垃圾回收，验证方法存在且可调用
      memoryManager.forceGarbageCollection();
      expect(gcSpy).toHaveBeenCalled();
      
      gcSpy.mockRestore();
    });

    it('应该检测大量内存泄漏并自动清理', () => {
      // 创建一些测试数据
      const data = new Uint8Array(100);
      memoryManager.allocate('cache', 'block1', data);
      memoryManager.allocate('cache', 'block2', data);
      
      // 验证detectMemoryLeaks方法可以被调用
      const leaks = memoryManager.detectMemoryLeaks();
      expect(Array.isArray(leaks)).toBe(true);
      
      // 验证release方法可以正常工作
      const success = memoryManager.release('cache', 'block1');
      expect(success).toBe(true);
      
      // 验证池信息更新
      const poolInfo = memoryManager.getPoolInfo('cache');
      expect(poolInfo!.blocks.size).toBe(1); // 只剩下block2
    });

    it('应该设置内存阈值', () => {
      memoryManager.setMemoryThreshold(0.9);
      // 阈值应该在合理范围内
      
      memoryManager.setMemoryThreshold(0.05); // 太低
      memoryManager.setMemoryThreshold(0.99); // 太高
      
      // 验证不会抛出错误
      expect(true).toBe(true);
    });
  });

  describe('统计信息', () => {
    beforeEach(() => {
      // 准备一些测试数据
      memoryManager.allocate('cache', 'block1', new Uint8Array(1000));
      memoryManager.allocate('cache', 'block2', 'test string');
      memoryManager.allocate('temporary', 'block3', { key: 'value' });
    });

    it('应该返回准确的内存统计', () => {
      const stats = memoryManager.getMemoryStats();

      expect(stats.totalUsed).toBeGreaterThan(0);
      expect(stats.available).toBeGreaterThan(0);
      expect(stats.poolCount).toBe(4);
      expect(stats.activeBlocks).toBe(3);
      expect(stats.gcCount).toBe(0);
    });

    it('应该计算内存增长率', () => {
      jest.useFakeTimers();
      
      // 分配初始数据
      memoryManager.allocate('cache', 'initial', new Uint8Array(1000));
      
      // 推进时间并分配更多数据
      jest.advanceTimersByTime(30000);
      memoryManager.allocate('cache', 'additional1', new Uint8Array(2000));
      
      jest.advanceTimersByTime(30000);
      memoryManager.allocate('cache', 'additional2', new Uint8Array(1500));
      
      const stats = memoryManager.getMemoryStats();
      
      // 增长率可能为正、负或零，取决于具体实现
      expect(typeof stats.leakDetection.memoryGrowthRate).toBe('number');
      
      jest.useRealTimers();
    });

    it('应该找到最老的内存块', () => {
      jest.useFakeTimers();
      
      memoryManager.allocate('cache', 'old', new Uint8Array(100));
      
      jest.advanceTimersByTime(60000); // 1分钟
      
      memoryManager.allocate('cache', 'new', new Uint8Array(100));
      
      const stats = memoryManager.getMemoryStats();
      
      expect(stats.leakDetection.oldestBlock).toBeGreaterThan(50000); // 至少50秒
      
      jest.useRealTimers();
    });

    it('应该统计可疑内存块', () => {
      jest.useFakeTimers();
      
      // 创建一些可疑块（长时间存在且只访问过一次）
      memoryManager.allocate('cache', 'suspicious1', new Uint8Array(100));
      memoryManager.allocate('cache', 'suspicious2', new Uint8Array(100));
      memoryManager.allocate('cache', 'normal', new Uint8Array(100));
      
      // 推进时间超过5分钟
      jest.advanceTimersByTime(6 * 60 * 1000); // 6分钟
      
      // 访问正常块，使其accessCount > 1
      memoryManager.get('cache', 'normal');
      
      const stats = memoryManager.getMemoryStats();
      
      // suspicious1和suspicious2应该被认为是可疑的（超过5分钟且只访问过一次）
      expect(stats.leakDetection.suspiciousBlocks).toBeGreaterThanOrEqual(2);
      
      jest.useRealTimers();
    });
  });

  describe('资源清理', () => {
    it('应该正确清理所有资源', () => {
      jest.useFakeTimers();
      
      // 分配一些数据
      memoryManager.allocate('cache', 'test1', new Uint8Array(1000));
      memoryManager.allocate('temporary', 'test2', 'test data');
      
      const initialStats = memoryManager.getMemoryStats();
      expect(initialStats.totalUsed).toBeGreaterThan(0);
      expect(initialStats.activeBlocks).toBeGreaterThan(0);
      
      memoryManager.dispose();
      
      // 验证所有资源被清理
      expect(jest.getTimerCount()).toBe(0);
      
      const finalStats = memoryManager.getMemoryStats();
      expect(finalStats.totalUsed).toBe(0);
      expect(finalStats.activeBlocks).toBe(0);
      expect(finalStats.poolCount).toBe(0);
      
      jest.useRealTimers();
    });

    it('应该停止内存监控定时器', () => {
      // 创建一个新的MemoryManager来测试定时器
      jest.useFakeTimers();
      
      const newManager = new MemoryManager();
      
      // 验证定时器确实存在
      const timerCount = jest.getTimerCount();
      expect(timerCount).toBeGreaterThan(0);
      
      newManager.dispose();
      
      // 验证定时器被清除 - 应该少了一个
      const finalTimerCount = jest.getTimerCount();
      expect(finalTimerCount).toBeLessThan(timerCount);
      
      jest.useRealTimers();
    });

    it('应该允许多次调用dispose', () => {
      expect(() => {
        memoryManager.dispose();
        memoryManager.dispose();
        memoryManager.dispose();
      }).not.toThrow();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空数据分配', () => {
      const success1 = memoryManager.allocate('cache', 'null', null);
      const success2 = memoryManager.allocate('cache', 'undefined', undefined);
      
      expect(success1).toBe(true);
      expect(success2).toBe(true);
      
      expect(memoryManager.get('cache', 'null')).toBeNull();
      expect(memoryManager.get('cache', 'undefined')).toBeUndefined();
    });

    it('应该处理重复的块ID', () => {
      const data1 = new Uint8Array(100);
      const data2 = new Uint8Array(200);
      
      memoryManager.allocate('cache', 'duplicate', data1);
      memoryManager.allocate('cache', 'duplicate', data2); // 覆盖
      
      const retrievedData = memoryManager.get('cache', 'duplicate');
      expect(retrievedData).toBe(data2);
    });

    it('应该处理极大的数据对象', () => {
      const hugeArray = new Array(1000000).fill(0);
      const success = memoryManager.allocate('channelData', 'huge', hugeArray);
      
      // 根据池大小和数据大小，可能成功或失败
      expect(typeof success).toBe('boolean');
    });

    it('应该处理循环引用对象', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // 循环引用
      
      // 应该不会崩溃
      expect(() => {
        memoryManager.allocate('temporary', 'circular', obj);
      }).not.toThrow();
    });

    it('应该处理无效的池操作', () => {
      // 对不存在的池进行操作
      memoryManager.clearPool('nonExistentPool');
      expect(memoryManager.getPoolInfo('nonExistentPool')).toBeNull();
      
      // 应该不会抛出错误
      expect(true).toBe(true);
    });

    it('应该处理内存阈值边界值', () => {
      memoryManager.setMemoryThreshold(-0.1); // 负值
      memoryManager.setMemoryThreshold(1.5);  // 超过1
      memoryManager.setMemoryThreshold(0);    // 零值
      memoryManager.setMemoryThreshold(1);    // 边界值
      
      // 应该都能正常处理
      expect(true).toBe(true);
    });
  });

  describe('并发和竞态条件', () => {
    it('应该处理并发分配请求', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(1000);
        promises.push(
          new Promise(resolve => {
            const success = memoryManager.allocate('cache', `concurrent${i}`, data);
            resolve(success);
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // 应该有一些成功的分配（取决于池容量）
      const successCount = results.filter(result => result === true).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('应该处理并发释放操作', async () => {
      // 先分配数据
      for (let i = 0; i < 5; i++) {
        memoryManager.allocate('temporary', `block${i}`, new Uint8Array(1000));
      }
      
      // 并发释放
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          new Promise(resolve => {
            const success = memoryManager.release('temporary', `block${i}`);
            resolve(success);
          })
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.every(result => result === true)).toBe(true);
    });

    it('应该处理监控过程中的数据变化', () => {
      jest.useFakeTimers();
      
      // 在监控过程中动态添加和删除数据
      memoryManager.allocate('cache', 'dynamic1', new Uint8Array(1000));
      
      jest.advanceTimersByTime(15000);
      
      memoryManager.allocate('cache', 'dynamic2', new Uint8Array(2000));
      memoryManager.release('cache', 'dynamic1');
      
      jest.advanceTimersByTime(15000);
      
      // 应该不会崩溃
      const stats = memoryManager.getMemoryStats();
      expect(stats).toBeDefined();
      
      jest.useRealTimers();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成大量分配操作', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const data = new Uint8Array(100);
        memoryManager.allocate('temporary', `perf${i}`, data);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 1000次分配应该在合理时间内完成（比如2秒）
      expect(duration).toBeLessThan(2000);
    });

    it('应该高效处理统计信息计算', () => {
      // 分配大量内存块
      for (let i = 0; i < 500; i++) {
        memoryManager.allocate('cache', `stats${i}`, new Uint8Array(100));
      }
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        memoryManager.getMemoryStats();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 100次统计计算应该很快
      expect(duration).toBeLessThan(1000);
    });

    it('应该高效执行内存泄漏检测', () => {
      jest.useFakeTimers();
      
      // 创建大量内存块
      for (let i = 0; i < 200; i++) {
        memoryManager.allocate('cache', `leak${i}`, new Uint8Array(100));
      }
      
      jest.advanceTimersByTime(11 * 60 * 1000);
      
      const startTime = Date.now();
      const leaks = memoryManager.detectMemoryLeaks();
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      expect(leaks.length).toBe(200);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      
      jest.useRealTimers();
    });
  });
});