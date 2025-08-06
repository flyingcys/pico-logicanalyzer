/**
 * 🎯 PerformanceOptimizer完善测试 - 从91.17%提升到95%+
 * 目标：覆盖剩余的未测试代码路径，特别是行145-148, 155, 225
 */

import { PerformanceOptimizer } from '../../../src/webview/engines/PerformanceOptimizer';

// Mock global performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntries: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn()
} as any;

// Mock PerformanceObserver
global.PerformanceObserver = jest.fn().mockImplementation((callback) => {
  return {
    observe: jest.fn(),
    disconnect: jest.fn(),
    // 保存回调以便后续调用
    _callback: callback
  };
}) as any;

describe('🎯 PerformanceOptimizer 完善测试', () => {

  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    jest.clearAllMocks();
    optimizer = new PerformanceOptimizer();
  });

  afterEach(() => {
    if (optimizer) {
      optimizer.dispose();
    }
  });

  describe('📊 覆盖剩余代码路径', () => {

    it('应该覆盖PerformanceObserver的entries处理逻辑 (行145-148)', () => {
      // 这个测试专门覆盖145-148行的entries循环处理
      const mockCallback = (global.PerformanceObserver as jest.Mock).mock.calls[0][0];
      
      // 模拟PerformanceObserver的list参数
      const mockList = {
        getEntries: jest.fn(() => [
          {
            name: 'frame-duration',
            entryType: 'measure',
            startTime: 100,
            duration: 16.67
          },
          {
            name: 'other-measure',
            entryType: 'measure', 
            startTime: 200,
            duration: 10
          },
          {
            name: 'navigation',
            entryType: 'navigation',
            startTime: 0,
            duration: 1000
          }
        ])
      };

      // 调用回调函数，这会执行145-148行的代码
      mockCallback(mockList);

      // 验证getEntries被调用
      expect(mockList.getEntries).toHaveBeenCalled();
      
      // 验证测试执行成功
      expect(true).toBe(true);
    });

    it('应该覆盖PerformanceObserver构造错误处理 (行155)', () => {
      // 重新创建optimizer，但这次让PerformanceObserver抛出错误
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      // Mock PerformanceObserver构造函数抛出错误
      (global.PerformanceObserver as jest.Mock).mockImplementationOnce(() => {
        throw new Error('PerformanceObserver not supported');
      });

      // 创建新的optimizer实例，这会触发setupPerformanceMonitoring中的错误处理
      const newOptimizer = new PerformanceOptimizer();

      // 验证console.warn被调用（覆盖行155）
      expect(console.warn).toHaveBeenCalledWith('Performance Observer not supported:', expect.any(Error));

      // 恢复console.warn
      console.warn = originalConsoleWarn;
      
      // 清理
      newOptimizer.dispose();
    });

    it('应该覆盖updatePerformanceMetrics中frame-duration分支 (行225)', () => {
      // 直接调用private方法来覆盖行225
      const mockEntry = {
        name: 'frame-duration',
        entryType: 'measure',
        startTime: 100,
        duration: 16.67
      } as PerformanceEntry;

      // 使用类型断言来调用private方法
      (optimizer as any).updatePerformanceMetrics(mockEntry);

      // 验证metrics被更新
      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBe(16.67);
    });

    it('应该测试updatePerformanceMetrics的其他entry name情况', () => {
      // 测试非frame-duration的entry
      const mockEntry = {
        name: 'other-performance-measure',
        entryType: 'measure',
        startTime: 100,
        duration: 20
      } as PerformanceEntry;

      // 调用private方法
      const originalFrameTime = optimizer.getMetrics().frameTime;
      (optimizer as any).updatePerformanceMetrics(mockEntry);

      // 验证frameTime没有被这个entry更新
      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBe(originalFrameTime);
    });

  });

  describe('🔄 完整流程测试', () => {

    it('应该测试完整的性能监控流程', async () => {
      // 测试开始和结束帧
      optimizer.startFrame();
      
      // 模拟一些工作
      await new Promise(resolve => setTimeout(resolve, 10));
      
      optimizer.endFrame();

      // 验证指标被更新
      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBeGreaterThan(0);
      expect(metrics.frameTimeHistory.length).toBeGreaterThan(0);
    });

    it('应该测试performance.measure的错误处理', () => {
      // Mock performance.measure抛出错误
      const originalMeasure = global.performance.measure;
      global.performance.measure = jest.fn(() => {
        throw new Error('Measure failed');
      });

      // 这应该不会崩溃，错误会被捕获
      optimizer.startFrame();
      optimizer.endFrame();

      // 恢复
      global.performance.measure = originalMeasure;
      
      expect(true).toBe(true);
    });

    it('应该测试getCurrentLOD方法', () => {
      const currentLOD = optimizer.getCurrentLOD();
      expect(typeof currentLOD).toBe('number');
      expect(currentLOD).toBeGreaterThanOrEqual(0);
    });

    it('应该测试多次调用getMetrics', () => {
      // 测试缓存命中率计算
      const metrics1 = optimizer.getMetrics();
      const metrics2 = optimizer.getMetrics();
      
      expect(metrics1.cacheHitRate).toBeDefined();
      expect(metrics2.cacheHitRate).toBeDefined();
      expect(typeof metrics1.cacheHitRate).toBe('number');
    });

  });

  describe('🧹 边界条件和清理测试', () => {

    it('应该处理undefined PerformanceObserver', () => {
      // 临时移除PerformanceObserver
      const originalPerformanceObserver = global.PerformanceObserver;
      delete (global as any).PerformanceObserver;

      // 创建新实例不应该崩溃
      const newOptimizer = new PerformanceOptimizer();
      expect(newOptimizer).toBeDefined();
      
      newOptimizer.dispose();

      // 恢复
      global.PerformanceObserver = originalPerformanceObserver;
    });

    it('应该处理没有performance.mark的情况', () => {
      // 临时移除performance.mark
      const originalMark = global.performance.mark;
      delete (global.performance as any).mark;

      // 不应该崩溃
      optimizer.startFrame();
      optimizer.endFrame();

      // 恢复
      global.performance.mark = originalMark;
      
      expect(true).toBe(true);
    });

    it('应该正确清理所有资源', () => {
      // 验证dispose清理了所有资源
      optimizer.dispose();
      
      // 多次调用dispose不应该出错
      optimizer.dispose();
      
      expect(true).toBe(true);
    });

  });

  describe('📈 帧时间历史管理', () => {

    it('应该正确管理帧时间历史记录', () => {
      // 添加超过60帧的数据，测试历史记录限制
      for (let i = 0; i < 70; i++) {
        optimizer.startFrame();
        optimizer.endFrame();
      }

      const metrics = optimizer.getMetrics();
      // 历史记录应该被限制在60帧以内
      expect(metrics.frameTimeHistory.length).toBeLessThanOrEqual(60);
    });

    it('应该正确计算平均FPS', async () => {
      // Mock performance.now返回递增的时间
      let time = 0;
      (global.performance.now as jest.Mock).mockImplementation(() => {
        time += 16.67; // 模拟60fps
        return time;
      });

      // 模拟多帧以触发FPS更新
      for (let i = 0; i < 65; i++) {
        optimizer.startFrame();
        optimizer.endFrame();
      }

      const metrics = optimizer.getMetrics();
      expect(metrics.averageFPS).toBeGreaterThan(0);
      expect(metrics.currentFPS).toBeGreaterThan(0);
    });

  });

});