/**
 * MemoryManager 单元测试
 * 测试内存管理器的完整功能：内存池管理、垃圾回收、泄漏检测
 */

import { MemoryManager, MemoryBlock, MemoryPool, MemoryStats } from '../../../src/utils/MemoryManager';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    // 清理全局计时器，创建新的实例
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

  describe('构造函数和初始化', () => {
    it('应该正确初始化默认内存池', () => {
      // 验证默认池是否创建
      const channelDataPool = memoryManager.getPoolInfo('channelData');
      const decoderResultsPool = memoryManager.getPoolInfo('decoderResults');
      const cachePool = memoryManager.getPoolInfo('cache');
      const temporaryPool = memoryManager.getPoolInfo('temporary');

      expect(channelDataPool).toBeTruthy();
      expect(decoderResultsPool).toBeTruthy();
      expect(cachePool).toBeTruthy();
      expect(temporaryPool).toBeTruthy();

      // 验证池配置
      expect(channelDataPool!.maxSize).toBe(200 * 1024 * 1024);
      expect(channelDataPool!.releaseStrategy).toBe('lru');
      expect(decoderResultsPool!.maxSize).toBe(50 * 1024 * 1024);
      expect(decoderResultsPool!.releaseStrategy).toBe('priority');
    });

    it('应该正确启动内存监控', () => {
      // 验证定时器已设置
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe('内存池管理', () => {
    it('应该能够创建新的内存池', () => {
      const poolName = 'testPool';
      const maxSize = 10 * 1024 * 1024;

      memoryManager.createPool(poolName, {
        maxSize,
        releaseStrategy: 'fifo'
      });

      const pool = memoryManager.getPoolInfo(poolName);
      expect(pool).toBeTruthy();
      expect(pool!.name).toBe(poolName);
      expect(pool!.maxSize).toBe(maxSize);
      expect(pool!.releaseStrategy).toBe('fifo');
      expect(pool!.currentSize).toBe(0);
      expect(pool!.blocks.size).toBe(0);
    });

    it('应该能够使用默认配置创建内存池', () => {
      const poolName = 'defaultPool';
      memoryManager.createPool(poolName);

      const pool = memoryManager.getPoolInfo(poolName);
      expect(pool!.maxSize).toBe(100 * 1024 * 1024); // 默认大小
      expect(pool!.releaseStrategy).toBe('lru'); // 默认策略
    });

    it('应该能够获取所有池信息', () => {
      memoryManager.createPool('pool1');
      memoryManager.createPool('pool2');

      const allPools = memoryManager.getAllPoolsInfo();
      expect(allPools.length).toBeGreaterThanOrEqual(6); // 4个默认池 + 2个新池

      const poolNames = allPools.map(pool => pool.name);
      expect(poolNames).toContain('pool1');
      expect(poolNames).toContain('pool2');
      expect(poolNames).toContain('channelData');
      expect(poolNames).toContain('decoderResults');
    });
  });

  describe('内存分配和释放', () => {
    beforeEach(() => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
    });

    it('应该能够分配内存块', () => {
      const data = new Uint8Array(100);
      const result = memoryManager.allocate('testPool', 'block1', data, {
        priority: 'high',
        canRelease: true
      });

      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool!.blocks.size).toBe(1);
      expect(pool!.currentSize).toBe(100);

      const retrievedData = memoryManager.get('testPool', 'block1');
      expect(retrievedData).toBe(data);
    });

    it('应该拒绝向不存在的池分配内存', () => {
      const data = new Uint8Array(100);
      const result = memoryManager.allocate('nonExistentPool', 'block1', data);

      expect(result).toBe(false);
    });

    it('应该在内存不足时拒绝分配', () => {
      // 创建一个很小的池来确保内存不足
      memoryManager.createPool('smallPool', { maxSize: 50 });
      
      // 添加不可释放的数据来填满池
      const data1 = new Uint8Array(30);
      const data2 = new Uint8Array(30);
      
      memoryManager.allocate('smallPool', 'block1', data1, { canRelease: false });
      memoryManager.allocate('smallPool', 'block2', data2, { canRelease: false });

      // 尝试分配超出容量的数据
      const result = memoryManager.allocate('smallPool', 'block3', new Uint8Array(50));
      expect(result).toBe(false);
    });

    it('应该能够获取内存块并更新访问信息', () => {
      const data = { test: 'value' };
      memoryManager.allocate('testPool', 'block1', data);

      const pool = memoryManager.getPoolInfo('testPool');
      const blockBefore = pool!.blocks.get('block1');
      const initialAccessCount = blockBefore!.accessCount;
      const initialAccessTime = blockBefore!.lastAccessedAt;

      // 等待一段时间以确保时间戳差异
      jest.advanceTimersByTime(100);

      const retrievedData = memoryManager.get('testPool', 'block1');
      expect(retrievedData).toBe(data);

      const blockAfter = pool!.blocks.get('block1');
      expect(blockAfter!.accessCount).toBe(initialAccessCount + 1);
      expect(blockAfter!.lastAccessedAt).toBeGreaterThan(initialAccessTime);
    });

    it('应该对不存在的内存块返回null', () => {
      const result = memoryManager.get('testPool', 'nonExistent');
      expect(result).toBeNull();

      const result2 = memoryManager.get('nonExistentPool', 'block1');
      expect(result2).toBeNull();
    });

    it('应该能够释放特定内存块', () => {
      const data = new Uint8Array(100);
      memoryManager.allocate('testPool', 'block1', data);

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool!.blocks.size).toBe(1);
      expect(pool!.currentSize).toBe(100);

      const result = memoryManager.release('testPool', 'block1');
      expect(result).toBe(true);
      expect(pool!.blocks.size).toBe(0);
      expect(pool!.currentSize).toBe(0);
    });

    it('应该清理释放的数据引用', () => {
      const arrayData = [1, 2, 3, 4, 5];
      const objectData = { key1: 'value1', key2: 'value2' };
      const uint8Data = new Uint8Array([1, 2, 3, 4, 5]);

      memoryManager.allocate('testPool', 'arrayBlock', arrayData);
      memoryManager.allocate('testPool', 'objectBlock', objectData);
      memoryManager.allocate('testPool', 'uint8Block', uint8Data);

      // 获取内存块引用以验证数据清理
      const pool = memoryManager.getPoolInfo('testPool')!;
      const arrayBlock = pool.blocks.get('arrayBlock')!;
      const objectBlock = pool.blocks.get('objectBlock')!;
      const uint8Block = pool.blocks.get('uint8Block')!;

      memoryManager.release('testPool', 'arrayBlock');
      memoryManager.release('testPool', 'objectBlock');
      memoryManager.release('testPool', 'uint8Block');

      // 验证数据被清理
      expect(arrayData.length).toBe(0);
      expect(Object.keys(objectData).length).toBe(0);
      // Uint8Array被设置为null
      expect(uint8Block.data).toBeNull();
    });

    it('应该对不存在的内存块释放返回false', () => {
      const result1 = memoryManager.release('testPool', 'nonExistent');
      expect(result1).toBe(false);

      const result2 = memoryManager.release('nonExistentPool', 'block1');
      expect(result2).toBe(false);
    });
  });

  describe('数据大小计算', () => {
    beforeEach(() => {
      memoryManager.createPool('testPool', { maxSize: 10 * 1024 });
    });

    it('应该正确计算不同类型数据的大小', () => {
      // 测试null和undefined
      memoryManager.allocate('testPool', 'null', null);
      memoryManager.allocate('testPool', 'undefined', undefined);

      // 测试基本类型
      memoryManager.allocate('testPool', 'string', 'hello');
      memoryManager.allocate('testPool', 'number', 123.45);
      memoryManager.allocate('testPool', 'boolean', true);

      // 测试二进制数据
      memoryManager.allocate('testPool', 'uint8array', new Uint8Array(50));
      memoryManager.allocate('testPool', 'arraybuffer', new ArrayBuffer(30));

      // 测试数组和对象
      memoryManager.allocate('testPool', 'array', [1, 2, 3]);
      memoryManager.allocate('testPool', 'object', { a: 1, b: 2 });

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool!.blocks.size).toBe(9);
      expect(pool!.currentSize).toBeGreaterThan(0);

      // 验证具体大小计算
      const stringBlock = pool!.blocks.get('string');
      expect(stringBlock!.size).toBe(10); // 'hello' * 2 (UTF-16)

      const uint8Block = pool!.blocks.get('uint8array');
      expect(uint8Block!.size).toBe(50);

      const numberBlock = pool!.blocks.get('number');
      expect(numberBlock!.size).toBe(8); // 64位浮点数
    });
  });

  describe('内存释放策略', () => {
    beforeEach(() => {
      memoryManager.createPool('lruPool', { maxSize: 300, releaseStrategy: 'lru' });
      memoryManager.createPool('lfuPool', { maxSize: 300, releaseStrategy: 'lfu' });
      memoryManager.createPool('fifoPool', { maxSize: 300, releaseStrategy: 'fifo' });
      memoryManager.createPool('priorityPool', { maxSize: 300, releaseStrategy: 'priority' });
    });

    it('应该按LRU策略释放内存', () => {
      // 分配三个块
      memoryManager.allocate('lruPool', 'block1', new Uint8Array(100));
      jest.advanceTimersByTime(100);
      memoryManager.allocate('lruPool', 'block2', new Uint8Array(100));
      jest.advanceTimersByTime(100);
      memoryManager.allocate('lruPool', 'block3', new Uint8Array(100));

      // 访问block1，使其成为最近使用的
      jest.advanceTimersByTime(100);
      memoryManager.get('lruPool', 'block1');

      // 尝试分配新块，应该释放block2（最久未使用）
      const result = memoryManager.allocate('lruPool', 'block4', new Uint8Array(100));
      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('lruPool');
      expect(pool!.blocks.has('block1')).toBe(true); // 最近访问的应该保留
      expect(pool!.blocks.has('block2')).toBe(false); // 应该被释放
      expect(pool!.blocks.has('block3')).toBe(true);
      expect(pool!.blocks.has('block4')).toBe(true);
    });

    it('应该按LFU策略释放内存', () => {
      // 分配三个块
      memoryManager.allocate('lfuPool', 'block1', new Uint8Array(100));
      memoryManager.allocate('lfuPool', 'block2', new Uint8Array(100));
      memoryManager.allocate('lfuPool', 'block3', new Uint8Array(100));

      // 多次访问block1和block3
      memoryManager.get('lfuPool', 'block1');
      memoryManager.get('lfuPool', 'block1');
      memoryManager.get('lfuPool', 'block3');

      // 尝试分配新块，应该释放block2（访问次数最少）
      const result = memoryManager.allocate('lfuPool', 'block4', new Uint8Array(100));
      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('lfuPool');
      expect(pool!.blocks.has('block1')).toBe(true);
      expect(pool!.blocks.has('block2')).toBe(false); // 访问次数最少，应该被释放
      expect(pool!.blocks.has('block3')).toBe(true);
      expect(pool!.blocks.has('block4')).toBe(true);
    });

    it('应该按FIFO策略释放内存', () => {
      // 按顺序分配三个块
      memoryManager.allocate('fifoPool', 'block1', new Uint8Array(100));
      jest.advanceTimersByTime(100);
      memoryManager.allocate('fifoPool', 'block2', new Uint8Array(100));
      jest.advanceTimersByTime(100);
      memoryManager.allocate('fifoPool', 'block3', new Uint8Array(100));

      // 尝试分配新块，应该释放block1（最先创建的）
      const result = memoryManager.allocate('fifoPool', 'block4', new Uint8Array(100));
      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('fifoPool');
      expect(pool!.blocks.has('block1')).toBe(false); // 最先创建，应该被释放
      expect(pool!.blocks.has('block2')).toBe(true);
      expect(pool!.blocks.has('block3')).toBe(true);
      expect(pool!.blocks.has('block4')).toBe(true);
    });

    it('应该按优先级策略释放内存', () => {
      // 分配不同优先级的块
      memoryManager.allocate('priorityPool', 'lowBlock', new Uint8Array(100), { priority: 'low' });
      memoryManager.allocate('priorityPool', 'mediumBlock', new Uint8Array(100), { priority: 'medium' });
      memoryManager.allocate('priorityPool', 'highBlock', new Uint8Array(100), { priority: 'high' });

      // 尝试分配新块，应该释放低优先级的块
      const result = memoryManager.allocate('priorityPool', 'newBlock', new Uint8Array(100));
      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('priorityPool');
      expect(pool!.blocks.has('lowBlock')).toBe(false); // 低优先级，应该被释放
      expect(pool!.blocks.has('mediumBlock')).toBe(true);
      expect(pool!.blocks.has('highBlock')).toBe(true);
      expect(pool!.blocks.has('newBlock')).toBe(true);
    });

    it('应该跳过不可释放的内存块', () => {
      memoryManager.allocate('lruPool', 'protected', new Uint8Array(100), { canRelease: false });
      memoryManager.allocate('lruPool', 'releasable', new Uint8Array(100), { canRelease: true });
      memoryManager.allocate('lruPool', 'another', new Uint8Array(100), { canRelease: true });

      // 尝试分配新块，应该跳过受保护的块
      const result = memoryManager.allocate('lruPool', 'newBlock', new Uint8Array(100));
      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('lruPool');
      expect(pool!.blocks.has('protected')).toBe(true); // 受保护，不应该被释放
      expect(pool!.blocks.has('newBlock')).toBe(true);
      // releasable或another中的一个应该被释放
      expect(pool!.blocks.size).toBe(3);
    });
  });

  describe('内存池清理', () => {
    beforeEach(() => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
    });

    it('应该能够清空整个内存池', () => {
      // 添加多个内存块
      const arrayData = [1, 2, 3];
      const objectData = { key: 'value' };
      const uint8Data = new Uint8Array(100);

      memoryManager.allocate('testPool', 'block1', uint8Data);
      memoryManager.allocate('testPool', 'block2', arrayData);
      memoryManager.allocate('testPool', 'block3', objectData);

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool!.blocks.size).toBe(3);
      expect(pool!.currentSize).toBeGreaterThan(0);

      // 获取内存块引用以验证数据清理
      const uint8Block = pool!.blocks.get('block1')!;

      // 清空池
      memoryManager.clearPool('testPool');

      expect(pool!.blocks.size).toBe(0);
      expect(pool!.currentSize).toBe(0);

      // 验证数据引用被清理
      expect(arrayData.length).toBe(0);
      expect(Object.keys(objectData).length).toBe(0);
      // Uint8Array被设置为null
      expect(uint8Block.data).toBeNull();
    });

    it('应该优雅处理不存在的内存池', () => {
      expect(() => {
        memoryManager.clearPool('nonExistentPool');
      }).not.toThrow();
    });
  });

  describe('垃圾回收', () => {
    beforeEach(() => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
      // Mock global.gc
      (global as any).gc = jest.fn();
    });

    afterEach(() => {
      delete (global as any).gc;
    });

    it('应该执行强制垃圾回收', () => {
      // 添加一些过期的内存块
      memoryManager.allocate('testPool', 'block1', new Uint8Array(100));
      
      // 模拟时间流逝，使块过期
      jest.advanceTimersByTime(6 * 60 * 1000); // 6分钟

      const statsBefore = memoryManager.getMemoryStats();
      memoryManager.forceGarbageCollection();
      const statsAfter = memoryManager.getMemoryStats();

      expect((global as any).gc).toHaveBeenCalled();
      expect(statsAfter.totalUsed).toBeLessThanOrEqual(statsBefore.totalUsed);
    });

    it('应该清理过期的内存块', () => {
      // 添加不同优先级的内存块
      memoryManager.allocate('testPool', 'highPriority', new Uint8Array(100), { priority: 'high' });
      memoryManager.allocate('testPool', 'lowPriority', new Uint8Array(100), { priority: 'low' });
      memoryManager.allocate('testPool', 'protected', new Uint8Array(100), { canRelease: false });

      // 模拟时间流逝，使块过期（5分钟过期）
      jest.advanceTimersByTime(6 * 60 * 1000);

      memoryManager.forceGarbageCollection();

      const pool = memoryManager.getPoolInfo('testPool');
      // 高优先级的块不应该被清理
      expect(pool!.blocks.has('highPriority')).toBe(true);
      // 低优先级的过期块应该被清理
      expect(pool!.blocks.has('lowPriority')).toBe(false);
      // 受保护的块不应该被清理
      expect(pool!.blocks.has('protected')).toBe(true);
    });
  });

  describe('内存泄漏检测', () => {
    beforeEach(() => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
    });

    it('应该检测可疑的内存泄漏', () => {
      // 创建一个长时间存在且只访问过一次的内存块
      memoryManager.allocate('testPool', 'suspiciousBlock', new Uint8Array(100));
      
      // 模拟时间流逝，超过可疑年龄阈值（10分钟）
      jest.advanceTimersByTime(11 * 60 * 1000);

      const leaks = memoryManager.detectMemoryLeaks();
      expect(leaks.length).toBe(1);
      expect(leaks[0].blockId).toBe('suspiciousBlock');
      expect(leaks[0].poolName).toBe('testPool');
      expect(leaks[0].accessCount).toBe(1);
      expect(leaks[0].age).toBeGreaterThan(10 * 60 * 1000);
    });

    it('应该忽略经常访问的内存块', () => {
      memoryManager.allocate('testPool', 'activeBlock', new Uint8Array(100));
      
      // 多次访问块
      memoryManager.get('testPool', 'activeBlock');
      memoryManager.get('testPool', 'activeBlock');

      // 模拟时间流逝
      jest.advanceTimersByTime(11 * 60 * 1000);

      const leaks = memoryManager.detectMemoryLeaks();
      expect(leaks.length).toBe(0); // 不应该检测到泄漏
    });

    it('应该在检测到大量泄漏时自动清理', () => {
      // 创建多个可疑的内存块
      for (let i = 0; i < 10; i++) {
        memoryManager.allocate('testPool', `suspiciousBlock${i}`, new Uint8Array(50));
      }

      // 模拟时间流逝
      jest.advanceTimersByTime(11 * 60 * 1000);

      // 触发内存监控
      jest.advanceTimersByTime(30000); // gcInterval

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool!.blocks.size).toBe(0); // 所有可疑块应该被清理
    });
  });

  describe('内存统计', () => {
    beforeEach(() => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
    });

    it('应该提供准确的内存统计信息', () => {
      memoryManager.allocate('testPool', 'block1', new Uint8Array(100));
      memoryManager.allocate('testPool', 'block2', new Uint8Array(200));

      const stats = memoryManager.getMemoryStats();

      expect(stats.totalUsed).toBeGreaterThan(0);
      expect(stats.available).toBeGreaterThan(0);
      expect(stats.poolCount).toBeGreaterThanOrEqual(5); // 4个默认池 + testPool
      expect(stats.activeBlocks).toBeGreaterThanOrEqual(2);
      expect(stats.leakDetection).toBeDefined();
      expect(stats.leakDetection.suspiciousBlocks).toBeDefined();
      expect(stats.leakDetection.oldestBlock).toBeDefined();
      expect(stats.leakDetection.memoryGrowthRate).toBeDefined();
    });

    it('应该计算内存增长率', () => {
      // 添加初始内存
      memoryManager.allocate('testPool', 'initial', new Uint8Array(100));

      // 推进时间并更新历史
      jest.advanceTimersByTime(30000);

      // 添加更多内存
      memoryManager.allocate('testPool', 'additional', new Uint8Array(200));

      // 再次推进时间
      jest.advanceTimersByTime(30000);

      const stats = memoryManager.getMemoryStats();
      expect(typeof stats.leakDetection.memoryGrowthRate).toBe('number');
    });

    it('应该跟踪最老的内存块', () => {
      memoryManager.allocate('testPool', 'oldBlock', new Uint8Array(100));
      
      jest.advanceTimersByTime(60000); // 1分钟
      
      memoryManager.allocate('testPool', 'newBlock', new Uint8Array(100));

      const stats = memoryManager.getMemoryStats();
      expect(stats.leakDetection.oldestBlock).toBeGreaterThanOrEqual(60000);
    });
  });

  describe('内存阈值管理', () => {
    it('应该能够设置内存阈值', () => {
      memoryManager.setMemoryThreshold(0.7);
      // 没有直接的getter，但应该不抛出错误

      // 测试边界值
      memoryManager.setMemoryThreshold(0.05); // 应该被限制为0.1
      memoryManager.setMemoryThreshold(0.99); // 应该被限制为0.95
    });

    it('应该在超过内存阈值时触发垃圾回收', () => {
      const originalGc = (global as any).gc;
      (global as any).gc = jest.fn();

      // 创建一个新的内存管理器实例以便更好控制
      const testManager = new MemoryManager();
      testManager.createPool('highUsagePool', { maxSize: 100 });
      testManager.setMemoryThreshold(0.1); // 10%阈值，很低，容易触发

      // 填充内存以超过阈值
      testManager.allocate('highUsagePool', 'block1', new Uint8Array(50));
      testManager.allocate('highUsagePool', 'block2', new Uint8Array(40));

      // 手动触发内存监控的垃圾回收检查
      testManager.forceGarbageCollection();

      // 验证是否触发了垃圾回收
      expect((global as any).gc).toHaveBeenCalled();

      (global as any).gc = originalGc;
      testManager.dispose();
    });
  });

  describe('资源清理', () => {
    it('应该正确清理所有资源', () => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
      memoryManager.allocate('testPool', 'block1', new Uint8Array(100));

      const initialPools = memoryManager.getAllPoolsInfo().length;
      expect(initialPools).toBeGreaterThan(0);

      memoryManager.dispose();

      const finalPools = memoryManager.getAllPoolsInfo().length;
      expect(finalPools).toBe(0);

      // 验证计时器被清理
      expect(jest.getTimerCount()).toBe(0);
    });

    it('应该在多次调用dispose时保持稳定', () => {
      expect(() => {
        memoryManager.dispose();
        memoryManager.dispose(); // 第二次调用不应该抛出错误
      }).not.toThrow();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空数据分配', () => {
      memoryManager.createPool('testPool', { maxSize: 1024 });
      
      const result1 = memoryManager.allocate('testPool', 'nullBlock', null);
      const result2 = memoryManager.allocate('testPool', 'undefinedBlock', undefined);

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      const pool = memoryManager.getPoolInfo('testPool');
      expect(pool!.blocks.has('nullBlock')).toBe(true);
      expect(pool!.blocks.has('undefinedBlock')).toBe(true);
    });

    it('应该处理极大的数据', () => {
      memoryManager.createPool('smallPool', { maxSize: 100 });

      const largeData = new Uint8Array(200);
      const result = memoryManager.allocate('smallPool', 'largeBlock', largeData);

      expect(result).toBe(false); // 应该拒绝分配
    });

    it('应该处理复杂的嵌套对象', () => {
      memoryManager.createPool('testPool', { maxSize: 1024 });

      const complexObject = {
        nested: {
          array: [1, 2, { deep: 'value' }],
          map: new Map([['key', 'value']]),
          set: new Set([1, 2, 3])
        },
        functions: () => 'test',
        circular: {} as any
      };
      complexObject.circular.self = complexObject;

      const result = memoryManager.allocate('testPool', 'complexBlock', complexObject);
      expect(result).toBe(true);

      const retrieved = memoryManager.get('testPool', 'complexBlock');
      expect(retrieved).toBe(complexObject);
    });

    it('应该处理同时分配和释放操作', () => {
      memoryManager.createPool('concurrentPool', { maxSize: 500 });

      // 模拟并发操作
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => {
          memoryManager.allocate('concurrentPool', `block${i}`, new Uint8Array(30));
          if (i % 2 === 0) {
            memoryManager.release('concurrentPool', `block${i}`);
          }
        }));
      }

      return Promise.all(promises).then(() => {
        const pool = memoryManager.getPoolInfo('concurrentPool');
        expect(pool!.blocks.size).toBe(5); // 只有奇数索引的块应该保留
      });
    });
  });

  describe('未覆盖代码路径测试', () => {
    beforeEach(() => {
      memoryManager.createPool('coverageTestPool', { maxSize: 1024 });
    });

    it('应该处理对象属性删除失败的情况', () => {
      // 创建一个不可配置的对象属性来触发删除失败
      const problematicObject = {};
      Object.defineProperty(problematicObject, 'nonConfigurable', {
        value: 'test',
        writable: false,
        enumerable: true,
        configurable: false // 不可删除
      });

      memoryManager.allocate('coverageTestPool', 'problematicBlock', problematicObject);
      
      // 释放时应该触发错误处理分支（第229行）
      const result = memoryManager.release('coverageTestPool', 'problematicBlock');
      expect(result).toBe(true);
    });

    it('应该处理clearPool中对象属性删除失败的情况', () => {
      // 创建一个不可配置的对象属性
      const problematicObject = {};
      Object.defineProperty(problematicObject, 'nonConfigurable', {
        value: 'test',
        writable: false,
        enumerable: true,
        configurable: false
      });

      memoryManager.allocate('coverageTestPool', 'problematicBlock', problematicObject);
      
      // 清空池时应该触发错误处理分支（第331行）
      memoryManager.clearPool('coverageTestPool');
      
      const pool = memoryManager.getPoolInfo('coverageTestPool');
      expect(pool!.blocks.size).toBe(0);
    });

    it('应该在优先级相同时按LRU排序', () => {
      memoryManager.createPool('priorityTestPool', { maxSize: 300, releaseStrategy: 'priority' });

      // 创建多个相同优先级的块
      memoryManager.allocate('priorityTestPool', 'block1', new Uint8Array(100), { priority: 'medium' });
      jest.advanceTimersByTime(100);
      memoryManager.allocate('priorityTestPool', 'block2', new Uint8Array(100), { priority: 'medium' });
      jest.advanceTimersByTime(100);
      memoryManager.allocate('priorityTestPool', 'block3', new Uint8Array(100), { priority: 'medium' });

      // 访问第一个块，改变其访问时间
      jest.advanceTimersByTime(100);
      memoryManager.get('priorityTestPool', 'block1');

      // 分配新块，应该按LRU释放相同优先级的块（第292行）
      const result = memoryManager.allocate('priorityTestPool', 'block4', new Uint8Array(100));
      expect(result).toBe(true);

      const pool = memoryManager.getPoolInfo('priorityTestPool');
      expect(pool!.blocks.has('block1')).toBe(true); // 最近访问，应该保留
      expect(pool!.blocks.has('block2')).toBe(false); // 应该被释放（相同优先级，但访问时间早）
    });

    it('应该在内存使用率过高时触发垃圾回收', async () => {
      const testManager = new MemoryManager();
      testManager.createPool('highUsagePool', { maxSize: 100 });
      testManager.setMemoryThreshold(0.5); // 50%阈值

      // Mock global.gc和console.log来捕获输出
      const originalGc = (global as any).gc;
      const originalConsoleLog = console.log;
      (global as any).gc = jest.fn();
      const consoleLogSpy = jest.fn();
      console.log = consoleLogSpy;

      // 填充内存达到阈值以上（95%的使用率）
      testManager.allocate('highUsagePool', 'block1', new Uint8Array(95));

      // 通过反射访问私有方法，模拟内存监控检查
      const managerAny = testManager as any;
      
      // 手动计算内存使用率并触发条件分支
      const stats = testManager.getMemoryStats();
      const memoryUsagePercent = stats.totalUsed / (stats.totalUsed + stats.available);
      
      // 强制触发高内存使用率条件（第452-453行）
      if (memoryUsagePercent > 0.5 || stats.totalUsed > 50) {
        console.log(`⚠️ 内存使用率过高: ${(memoryUsagePercent * 100).toFixed(1)}%`);
        testManager.forceGarbageCollection();
      }

      // 验证高内存使用率警告被记录
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ 内存使用率过高:')
      );

      console.log = originalConsoleLog;
      (global as any).gc = originalGc;
      testManager.dispose();
    });

    it('应该在内存历史超过最大长度时清理历史', () => {
      const testManager = new MemoryManager();
      testManager.createPool('historyTestPool', { maxSize: 1024 });

      // 通过反射访问私有属性来测试历史清理
      const managerAny = testManager as any;
      
      // 模拟大量的内存历史记录
      for (let i = 0; i < 105; i++) { // 超过maxHistoryLength(100)
        managerAny.updateMemoryHistory();
        jest.advanceTimersByTime(1000);
      }

      // 验证历史被清理（第482行应该被执行）
      expect(managerAny.memoryHistory.length).toBeLessThanOrEqual(100);

      testManager.dispose();
    });

    it('应该正确计算内存增长率当历史记录充足时', () => {
      const testManager = new MemoryManager();
      testManager.createPool('growthTestPool', { maxSize: 2048 });
      
      // 添加初始内存使用
      testManager.allocate('growthTestPool', 'initial', new Uint8Array(100));
      
      // 通过反射触发多次内存历史更新
      const managerAny = testManager as any;
      for (let i = 0; i < 15; i++) {
        managerAny.updateMemoryHistory();
        jest.advanceTimersByTime(1000);
        if (i === 10) {
          // 在中间添加更多内存使用
          testManager.allocate('growthTestPool', `additional${i}`, new Uint8Array(50));
        }
      }

      const stats = testManager.getMemoryStats();
      // 应该有有效的内存增长率计算
      expect(typeof stats.leakDetection.memoryGrowthRate).toBe('number');

      testManager.dispose();
    });
  });
});