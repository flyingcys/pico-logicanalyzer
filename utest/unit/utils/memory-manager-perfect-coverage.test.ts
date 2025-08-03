/**
 * MemoryManager 100%完美覆盖率测试
 * 专门针对未覆盖的代码路径进行测试，实现100%覆盖率
 */

import { MemoryManager, MemoryBlock, MemoryPool, MemoryStats } from '../../../src/utils/MemoryManager';

describe('MemoryManager - 完美覆盖率测试', () => {
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

  describe('异常处理代码路径覆盖', () => {
    it('应该覆盖release方法中的异常处理路径 - 行229', () => {
      // 创建一个会导致属性删除失败的特殊对象
      const problematicObject = Object.create(null);
      Object.defineProperty(problematicObject, 'testProp', {
        value: 'test',
        writable: false,
        configurable: false // 不可配置，会导致删除失败
      });

      // 分配这个对象
      memoryManager.allocate('temporary', 'problematic', problematicObject);

      // 释放时应该触发异常处理路径
      const success = memoryManager.release('temporary', 'problematic');
      expect(success).toBe(true);
    });

    it('应该覆盖clearPool方法中的异常处理路径 - 行331', () => {
      // 创建会导致清理失败的对象
      const problematicObject = {};
      Object.defineProperty(problematicObject, 'badProp', {
        value: 'test',
        writable: false,
        configurable: false
      });

      memoryManager.allocate('cache', 'problematic', problematicObject);
      
      // clearPool应该触发异常处理路径
      memoryManager.clearPool('cache');
      
      const pool = memoryManager.getPoolInfo('cache');
      expect(pool!.blocks.size).toBe(0);
    });
  });

  describe('优先级策略LRU回退路径覆盖', () => {
    it('应该覆盖相同优先级按LRU排序的代码路径 - 行292', async () => {
      memoryManager.createPool('priorityTestPool', { maxSize: 800, releaseStrategy: 'priority' });
      
      const data = new Uint8Array(250);
      
      // 分配相同优先级的内存块
      memoryManager.allocate('priorityTestPool', 'block1', data, { priority: 'medium' });
      await new Promise(resolve => setTimeout(resolve, 10)); // 确保时间差异
      memoryManager.allocate('priorityTestPool', 'block2', data, { priority: 'medium' });
      await new Promise(resolve => setTimeout(resolve, 10));
      memoryManager.allocate('priorityTestPool', 'block3', data, { priority: 'medium' });

      // 访问block1，使其最近访问时间更新
      memoryManager.get('priorityTestPool', 'block1');

      // 分配新数据应该触发相同优先级按LRU排序（block2最先被释放）
      const success = memoryManager.allocate('priorityTestPool', 'newBlock', data);
      expect(success).toBe(true);

      const pool = memoryManager.getPoolInfo('priorityTestPool');
      expect(pool!.blocks.has('block2')).toBe(false); // block2应该被释放
      expect(pool!.blocks.has('block1')).toBe(true);  // block1被访问过，保留
    });
  });

  describe('内存监控高级场景覆盖', () => {
    it('应该覆盖高内存使用率触发GC的路径 - 行451-453', () => {
      jest.useFakeTimers();
      
      // 设置很低的内存阈值
      memoryManager.setMemoryThreshold(0.01);

      // 分配足够多的内存触发阈值
      const largeData = new Uint8Array(10 * 1024 * 1024); // 10MB
      memoryManager.allocate('channelData', 'large1', largeData);
      memoryManager.allocate('channelData', 'large2', largeData);

      const gcSpy = jest.spyOn(memoryManager, 'forceGarbageCollection');

      // 触发监控检查
      jest.advanceTimersByTime(30000);

      expect(gcSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('应该覆盖大量内存泄漏自动清理路径 - 行459-463', () => {
      jest.useFakeTimers();
      
      // 创建超过5个"泄漏"的内存块
      const data = new Uint8Array(100);
      for (let i = 0; i < 7; i++) {
        memoryManager.allocate('cache', `leak${i}`, data);
      }

      // 推进时间使其成为可疑泄漏
      jest.advanceTimersByTime(11 * 60 * 1000);

      // 手动更新内存历史，确保长度>10
      for (let i = 0; i < 12; i++) {
        // 通过反射访问私有方法来更新历史
        (memoryManager as any).updateMemoryHistory();
      }

      const initialBlockCount = memoryManager.getPoolInfo('cache')!.blocks.size;

      // 触发监控检查，应该自动清理泄漏
      jest.advanceTimersByTime(30000);

      const finalBlockCount = memoryManager.getPoolInfo('cache')!.blocks.size;
      expect(finalBlockCount).toBeLessThan(initialBlockCount);
      
      jest.useRealTimers();
    });

    it('应该覆盖updateMemoryHistory方法 - 行475-482', () => {
      // 通过反射访问私有方法
      const updateMemoryHistory = (memoryManager as any).updateMemoryHistory.bind(memoryManager);
      
      // 初始状态
      let history = (memoryManager as any).memoryHistory;
      const initialLength = history.length;

      // 调用多次，测试历史记录管理
      for (let i = 0; i < 5; i++) {
        updateMemoryHistory();
      }

      expect(history.length).toBeGreaterThan(initialLength);

      // 测试历史记录长度限制 - 需要超过maxHistoryLength(100)
      for (let i = 0; i < 105; i++) {
        updateMemoryHistory();
      }

      // 应该被限制在maxHistoryLength内
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('数据类型计算覆盖', () => {
    it('应该覆盖calculateDataSize中其他类型的路径 - 行533', () => {
      // 测试Symbol类型 - 应该触发"其他类型"的默认大小
      const symbolData = Symbol('test');
      const success = memoryManager.allocate('temporary', 'symbol', symbolData);
      expect(success).toBe(true);

      // 测试BigInt类型
      const bigintData = BigInt(123456789);
      const success2 = memoryManager.allocate('temporary', 'bigint', bigintData);
      expect(success2).toBe(true);

      // 测试Function类型
      const functionData = () => console.log('test');
      const success3 = memoryManager.allocate('temporary', 'function', functionData);
      expect(success3).toBe(true);
    });

    it('应该测试循环引用对象的大小计算', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      circularObj.parent = { child: circularObj };

      // 应该能正确处理复杂的循环引用
      const success = memoryManager.allocate('temporary', 'complex-circular', circularObj);
      expect(success).toBe(true);
    });
  });

  describe('内存增长率计算覆盖', () => {
    it('应该覆盖内存增长率计算路径 - 行549-553', () => {
      // 手动操作内存历史以确保有足够的数据
      const memoryHistory = (memoryManager as any).memoryHistory;
      
      // 清空历史并添加测试数据
      memoryHistory.length = 0;
      
      const baseTime = Date.now();
      // 添加多个历史点模拟内存增长
      for (let i = 0; i < 15; i++) {
        memoryHistory.push({
          timestamp: baseTime + (i * 1000), // 每秒一个记录
          usage: 1000 + (i * 100) // 内存逐渐增长
        });
      }

      const stats = memoryManager.getMemoryStats();
      
      // 应该能计算出正的增长率
      expect(stats.leakDetection.memoryGrowthRate).toBeGreaterThan(0);
      expect(typeof stats.leakDetection.memoryGrowthRate).toBe('number');
    });

    it('应该处理时间差为0的情况', () => {
      const memoryHistory = (memoryManager as any).memoryHistory;
      memoryHistory.length = 0;
      
      const sameTime = Date.now();
      // 添加相同时间戳的记录
      memoryHistory.push({ timestamp: sameTime, usage: 1000 });
      memoryHistory.push({ timestamp: sameTime, usage: 2000 });

      const stats = memoryManager.getMemoryStats();
      
      // 时间差为0时，增长率应该为0
      expect(stats.leakDetection.memoryGrowthRate).toBe(0);
    });

    it('应该处理内存历史不足的情况', () => {
      const memoryHistory = (memoryManager as any).memoryHistory;
      memoryHistory.length = 0;
      
      // 只有一个记录点
      memoryHistory.push({ timestamp: Date.now(), usage: 1000 });

      const stats = memoryManager.getMemoryStats();
      
      // 历史记录不足时，增长率应该为0
      expect(stats.leakDetection.memoryGrowthRate).toBe(0);
    });
  });

  describe('边界条件和特殊场景', () => {
    it('应该处理ArrayBuffer和各种TypedArray的清理', () => {
      // 测试各种TypedArray类型的清理
      const testArrays = [
        new Uint8Array(100),
        new Int8Array(100),
        new Uint16Array(100),
        new Int16Array(100),
        new Uint32Array(100),
        new Int32Array(100),
        new Float32Array(100),
        new Float64Array(100),
        new ArrayBuffer(100)
      ];

      testArrays.forEach((array, index) => {
        memoryManager.allocate('temporary', `array${index}`, array);
      });

      // 释放所有数组，应该正确处理每种类型
      testArrays.forEach((_, index) => {
        const success = memoryManager.release('temporary', `array${index}`);
        expect(success).toBe(true);
      });
    });

    it('应该处理深度嵌套的对象', () => {
      // 创建深度嵌套的对象
      let deepObj: any = {};
      let current = deepObj;
      
      for (let i = 0; i < 10; i++) {
        current.next = { level: i, data: new Array(100).fill(i) };
        current = current.next;
      }

      const success = memoryManager.allocate('temporary', 'deep', deepObj);
      expect(success).toBe(true);

      // 清理应该能正确处理深度嵌套
      const released = memoryManager.release('temporary', 'deep');
      expect(released).toBe(true);
    });

    it('应该正确处理空池的监控', () => {
      jest.useFakeTimers();
      
      // 创建空池
      memoryManager.createPool('emptyPool', { maxSize: 1000 });
      
      // 触发监控，应该不会崩溃
      jest.advanceTimersByTime(30000);
      
      const stats = memoryManager.getMemoryStats();
      expect(stats).toBeDefined();
      
      jest.useRealTimers();
    });

    it('应该处理内存历史的边界情况', () => {
      // 测试最大历史长度边界
      const updateMemoryHistory = (memoryManager as any).updateMemoryHistory.bind(memoryManager);
      const maxHistoryLength = (memoryManager as any).maxHistoryLength;
      
      // 添加超过最大长度的历史记录
      for (let i = 0; i < maxHistoryLength + 10; i++) {
        updateMemoryHistory();
      }
      
      const history = (memoryManager as any).memoryHistory;
      expect(history.length).toBeLessThanOrEqual(maxHistoryLength);
    });
  });

  describe('全面的监控和清理测试', () => {
    it('应该正确模拟完整的监控周期', () => {
      jest.useFakeTimers();
      
      // 设置合理的阈值
      memoryManager.setMemoryThreshold(0.8);
      
      // 分配一些数据
      const data = new Uint8Array(1000);
      memoryManager.allocate('cache', 'test1', data);
      
      // 模拟多个监控周期
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(30000);
        
        // 在监控期间动态添加数据
        if (i === 2) {
          memoryManager.allocate('cache', `dynamic${i}`, data);
        }
      }
      
      // 验证系统仍然正常运行
      const stats = memoryManager.getMemoryStats();
      expect(stats).toBeDefined();
      expect(stats.activeBlocks).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });

    it('应该测试dispose的完整清理过程', () => {
      jest.useFakeTimers();
      
      // 分配各种类型的数据
      memoryManager.allocate('cache', 'string', 'test string');
      memoryManager.allocate('cache', 'array', [1, 2, 3]);
      memoryManager.allocate('cache', 'object', { key: 'value' });
      memoryManager.allocate('cache', 'buffer', new ArrayBuffer(100));
      
      const initialStats = memoryManager.getMemoryStats();
      expect(initialStats.totalUsed).toBeGreaterThan(0);
      
      // 完整的dispose过程
      memoryManager.dispose();
      
      // 验证完全清理
      const finalStats = memoryManager.getMemoryStats();
      expect(finalStats.totalUsed).toBe(0);
      expect(finalStats.activeBlocks).toBe(0);
      expect(finalStats.poolCount).toBe(0);
      
      jest.useRealTimers();
    });
  });
});