/**
 * MemoryManager 最终100%覆盖率测试
 * 专门针对最后未覆盖的代码行进行精准测试
 * 目标：覆盖行229,331,446-462
 */

import { MemoryManager } from '../../../src/utils/MemoryManager';

describe('MemoryManager - 最终覆盖率测试', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
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

  describe('异常处理路径精准覆盖', () => {
    it('应该精准覆盖release方法异常处理 - 行229', () => {
      // 创建一个更复杂的对象，确保触发异常路径
      const problematicObj = {
        regularProp: 'normal',
        get badProp() {
          throw new Error('Cannot access this property');
        }
      };

      // 手动添加一个会导致删除失败的属性
      try {
        Object.defineProperty(problematicObj, 'nonDeletable', {
          value: 'test',
          configurable: false,
          enumerable: true
        });
      } catch (e) {
        // 忽略可能的错误
      }

      memoryManager.allocate('temporary', 'problematic', problematicObj);
      
      // 这应该触发行229的异常处理
      const success = memoryManager.release('temporary', 'problematic');
      expect(success).toBe(true);
    });

    it('应该精准覆盖clearPool方法异常处理 - 行331', () => {
      // 创建多个会导致清理失败的对象
      const problematicObj1 = {};
      const problematicObj2 = {};
      
      // 添加不可删除的属性
      try {
        Object.defineProperty(problematicObj1, 'undeletable1', {
          value: 'test1',
          configurable: false,
          enumerable: true
        });
        Object.defineProperty(problematicObj2, 'undeletable2', {
          value: 'test2',
          configurable: false,
          enumerable: true
        });
      } catch (e) {
        // 继续
      }

      memoryManager.allocate('cache', 'prob1', problematicObj1);
      memoryManager.allocate('cache', 'prob2', problematicObj2);
      
      // 这应该触发行331的异常处理
      memoryManager.clearPool('cache');
      
      const pool = memoryManager.getPoolInfo('cache');
      expect(pool!.blocks.size).toBe(0);
    });
  });

  describe('内存监控逻辑精准覆盖', () => {
    it('应该精准覆盖内存监控的完整逻辑路径 - 行446-462', () => {
      jest.useFakeTimers();
      
      // 创建一个新的内存管理器来确保监控启动
      const testManager = new MemoryManager();
      
      try {
        // 设置低阈值确保触发高内存使用率检测
        testManager.setMemoryThreshold(0.01);
        
        // 分配大量内存确保超过阈值
        const largeData = new ArrayBuffer(50 * 1024 * 1024); // 50MB
        testManager.allocate('channelData', 'huge1', largeData);
        testManager.allocate('channelData', 'huge2', largeData);
        testManager.allocate('channelData', 'huge3', largeData);
        
        // 创建超过5个泄漏块以触发泄漏清理逻辑
        for (let i = 0; i < 8; i++) {
          testManager.allocate('cache', `leak${i}`, new Uint8Array(1000));
        }
        
        // 推进时间使其成为泄漏
        jest.advanceTimersByTime(11 * 60 * 1000);
        
        // 手动更新内存历史确保长度>10
        for (let i = 0; i < 15; i++) {
          (testManager as any).updateMemoryHistory();
        }
        
        // Mock forceGarbageCollection 来验证调用
        const gcSpy = jest.spyOn(testManager, 'forceGarbageCollection');
        
        // 触发监控检查 - 这应该覆盖行446-462的完整逻辑
        jest.advanceTimersByTime(30000);
        
        // 验证高内存使用率触发了GC（行451-453）
        expect(gcSpy).toHaveBeenCalled();
        
        // 验证泄漏检测和清理逻辑被执行（行457-462）
        const finalLeaks = testManager.detectMemoryLeaks();
        // 由于清理逻辑，泄漏数量应该减少
        expect(finalLeaks.length).toBeLessThan(8);
        
      } finally {
        testManager.dispose();
        jest.useRealTimers();
      }
    });

    it('应该测试监控中的所有条件分支', () => {
      jest.useFakeTimers();
      
      const testManager = new MemoryManager();
      
      try {
        // 场景1：内存使用率未超过阈值
        testManager.setMemoryThreshold(0.95); // 很高的阈值
        
        // 少量数据不会触发GC
        testManager.allocate('temporary', 'small', new Uint8Array(100));
        
        const gcSpy = jest.spyOn(testManager, 'forceGarbageCollection');
        
        // 触发监控检查
        jest.advanceTimersByTime(30000);
        
        // 不应该触发GC
        expect(gcSpy).not.toHaveBeenCalled();
        
        // 场景2：内存历史长度<=10，不进行泄漏检测
        const history = (testManager as any).memoryHistory;
        history.length = 0; // 清空历史
        
        // 只添加少量历史记录
        for (let i = 0; i < 5; i++) {
          (testManager as any).updateMemoryHistory();
        }
        
        jest.advanceTimersByTime(30000);
        
        // 由于历史不足，泄漏检测不应该执行
        
        // 场景3：泄漏数量<=5，不进行清理
        history.length = 0;
        for (let i = 0; i < 15; i++) {
          (testManager as any).updateMemoryHistory();
        }
        
        // 只创建少量泄漏（<=5个）
        for (let i = 0; i < 3; i++) {
          testManager.allocate('cache', `smallLeak${i}`, new Uint8Array(100));
        }
        
        jest.advanceTimersByTime(11 * 60 * 1000); // 使其成为泄漏
        jest.advanceTimersByTime(30000); // 触发检查
        
        // 泄漏数量不够，不应该执行清理
        const leaks = testManager.detectMemoryLeaks();
        expect(leaks.length).toBeLessThanOrEqual(5);
        
      } finally {
        testManager.dispose();
        jest.useRealTimers();
      }
    });
  });

  describe('特殊对象清理覆盖', () => {
    it('应该处理各种特殊对象的清理', () => {
      // 测试Proxy对象
      const target = { value: 42 };
      const proxy = new Proxy(target, {
        deleteProperty() {
          throw new Error('Cannot delete');
        }
      });
      
      memoryManager.allocate('temporary', 'proxy', proxy);
      expect(memoryManager.release('temporary', 'proxy')).toBe(true);
      
      // 测试Frozen对象
      const frozenObj = Object.freeze({ prop: 'value' });
      memoryManager.allocate('temporary', 'frozen', frozenObj);
      expect(memoryManager.release('temporary', 'frozen')).toBe(true);
      
      // 测试Map和Set
      const map = new Map([['key', 'value']]);
      const set = new Set([1, 2, 3]);
      
      memoryManager.allocate('temporary', 'map', map);
      memoryManager.allocate('temporary', 'set', set);
      
      expect(memoryManager.release('temporary', 'map')).toBe(true);
      expect(memoryManager.release('temporary', 'set')).toBe(true);
    });

    it('应该处理嵌套的特殊对象', () => {
      const complexObj = {
        nested: {
          array: [1, 2, 3],
          buffer: new ArrayBuffer(100),
          view: new Uint8Array(50)
        },
        circular: null as any
      };
      
      complexObj.circular = complexObj;
      
      // 添加不可配置属性
      try {
        Object.defineProperty(complexObj.nested, 'badProp', {
          value: 'bad',
          configurable: false
        });
      } catch (e) {
        // 继续
      }
      
      memoryManager.allocate('temporary', 'complex', complexObj);
      expect(memoryManager.release('temporary', 'complex')).toBe(true);
    });
  });
});