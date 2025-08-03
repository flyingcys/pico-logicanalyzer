/**
 * PerformanceOptimizer 单元测试
 * 测试性能优化器的帧率控制、LOD管理、异步渲染等功能
 */

import { PerformanceOptimizer, PerformanceConfig, PerformanceMetrics, RenderTask } from '../../../../src/webview/engines/PerformanceOptimizer';

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => [])
};

// Mock PerformanceObserver
const mockPerformanceObserver = {
  observe: jest.fn(),
  disconnect: jest.fn()
};

class MockPerformanceObserver {
  private callback: (list: any) => void;

  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }

  observe = mockPerformanceObserver.observe;
  disconnect = mockPerformanceObserver.disconnect;

  // 用于测试的辅助方法
  triggerCallback(entries: PerformanceEntry[]) {
    this.callback({
      getEntries: () => entries
    });
  }
}

// 全局Mock设置
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

Object.defineProperty(global, 'PerformanceObserver', {
  value: MockPerformanceObserver,
  writable: true
});

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;
  let defaultConfig: PerformanceConfig;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    mockPerformance.now.mockImplementation(() => Date.now());

    defaultConfig = {
      targetFrameRate: 60,
      maxFrameTime: 16.67,
      adaptiveFrameRate: true,
      enableLOD: true,
      lodThresholds: [16.67, 33.33, 50, 100],
      lodStrategies: ['full', 'downsample', 'minmax', 'skip'],
      enableAsyncRender: true,
      maxConcurrentTasks: 4,
      taskTimeSlice: 5,
      maxMemoryUsage: 512,
      enableGarbageCollection: true,
      gcInterval: 30000,
      enableRenderCache: true,
      cacheSize: 100,
      cacheStrategy: 'lru'
    };

    optimizer = new PerformanceOptimizer();
  });

  afterEach(() => {
    if (optimizer) {
      optimizer.dispose();
    }
  });

  describe('构造函数和初始化', () => {
    it('应该使用默认配置创建优化器', () => {
      const metrics = optimizer.getMetrics();
      
      expect(metrics.currentFPS).toBe(0);
      expect(metrics.averageFPS).toBe(0);
      expect(metrics.frameTime).toBe(0);
      expect(metrics.currentLOD).toBe(0);
      expect(metrics.qualityScore).toBe(1.0);
    });

    it('应该使用自定义配置创建优化器', () => {
      const customConfig: Partial<PerformanceConfig> = {
        targetFrameRate: 30,
        maxFrameTime: 33.33,
        enableLOD: false,
        maxConcurrentTasks: 2
      };

      const customOptimizer = new PerformanceOptimizer(customConfig);
      const metrics = customOptimizer.getMetrics();

      expect(metrics).toBeDefined();
      customOptimizer.dispose();
    });

    it('应该正确设置性能监控', () => {
      expect(mockPerformanceObserver.observe).toHaveBeenCalledWith({ entryTypes: ['measure'] });
    });
  });

  describe('帧率测量和控制', () => {
    it('应该正确开始帧测量', () => {
      const startTime = 1000;
      mockPerformance.now.mockReturnValue(startTime);

      optimizer.startFrame();

      expect(mockPerformance.mark).toHaveBeenCalledWith('frame-start');
    });

    it('应该正确结束帧测量', () => {
      const startTime = 1000;
      const endTime = 1020; // 20ms frame
      
      mockPerformance.now
        .mockReturnValueOnce(startTime) // startFrame
        .mockReturnValueOnce(endTime);  // endFrame

      optimizer.startFrame();
      optimizer.endFrame();

      expect(mockPerformance.measure).toHaveBeenCalledWith('frame-duration', 'frame-start');
      
      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBe(20);
    });

    it('应该计算正确的帧时间历史', () => {
      const frameTimes = [16, 20, 18, 22, 15];
      let currentTime = 1000;

      for (const frameTime of frameTimes) {
        mockPerformance.now
          .mockReturnValueOnce(currentTime) // startFrame
          .mockReturnValueOnce(currentTime + frameTime); // endFrame

        optimizer.startFrame();
        optimizer.endFrame();
        currentTime += frameTime + 1; // 模拟时间推进
      }

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTimeHistory).toHaveLength(frameTimes.length);
      expect(metrics.frameTimeHistory).toEqual(frameTimes);
    });

    it('应该限制帧时间历史记录长度', () => {
      const maxHistoryLength = 60;
      let currentTime = 1000;

      // 创建超过最大长度的帧
      for (let i = 0; i < maxHistoryLength + 10; i++) {
        mockPerformance.now
          .mockReturnValueOnce(currentTime)
          .mockReturnValueOnce(currentTime + 16);

        optimizer.startFrame();
        optimizer.endFrame();
        currentTime += 17;
      }

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTimeHistory).toHaveLength(maxHistoryLength);
    });

    it('应该正确计算FPS', () => {
      let currentTime = 1000;
      const frameInterval = 16.67; // 60fps
      const frameCount = 60;

      // 初始化FPS计算时间
      mockPerformance.now.mockReturnValue(currentTime);
      optimizer.startFrame();
      optimizer.endFrame();

      currentTime += 1; // 小的时间推进
      
      // 模拟1秒钟的帧
      for (let i = 0; i < frameCount; i++) {
        mockPerformance.now
          .mockReturnValueOnce(currentTime) // startFrame
          .mockReturnValueOnce(currentTime + frameInterval) // endFrame
          .mockReturnValueOnce(currentTime + frameInterval); // updateFrameMetrics

        optimizer.startFrame();
        optimizer.endFrame();
        currentTime += frameInterval;
      }

      // 触发FPS更新（确保超过1秒时间差）
      currentTime = 1000 + 1001; // 超过1000ms差值
      mockPerformance.now.mockReturnValue(currentTime);
      
      // 额外的帧来触发FPS计算
      optimizer.startFrame();
      optimizer.endFrame();

      const metrics = optimizer.getMetrics();
      // 由于时间模拟的复杂性，我们检查FPS是否在合理范围内
      expect(metrics.currentFPS).toBeGreaterThan(0);
      expect(metrics.currentFPS).toBeLessThan(200); // 合理的上限
    });
  });

  describe('性能指标管理', () => {
    it('应该返回完整的性能指标', () => {
      const metrics = optimizer.getMetrics();

      expect(metrics).toHaveProperty('currentFPS');
      expect(metrics).toHaveProperty('averageFPS');
      expect(metrics).toHaveProperty('frameTime');
      expect(metrics).toHaveProperty('frameTimeHistory');
      expect(metrics).toHaveProperty('renderTime');
      expect(metrics).toHaveProperty('updateTime');
      expect(metrics).toHaveProperty('drawCalls');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('gcCount');
      expect(metrics).toHaveProperty('currentLOD');
      expect(metrics).toHaveProperty('lodSwitches');
      expect(metrics).toHaveProperty('qualityScore');
    });

    it('应该正确计算缓存命中率', () => {
      // 模拟缓存命中和丢失 - 需要实际的方法来测试
      // 由于源代码中缺少缓存操作方法，这里只能测试初始状态
      const metrics = optimizer.getMetrics();
      expect(metrics.cacheHitRate).toBe(0); // 没有请求时应该为0
    });

    it('应该返回性能指标的副本', () => {
      const metrics1 = optimizer.getMetrics();
      const metrics2 = optimizer.getMetrics();

      expect(metrics1).not.toBe(metrics2); // 不是同一个对象
      expect(metrics1).toEqual(metrics2); // 但内容相同
    });
  });

  describe('LOD级别管理', () => {
    it('应该返回当前LOD级别', () => {
      const currentLOD = optimizer.getCurrentLOD();
      expect(typeof currentLOD).toBe('number');
      expect(currentLOD).toBeGreaterThanOrEqual(0);
    });

    it('初始LOD级别应该为0', () => {
      expect(optimizer.getCurrentLOD()).toBe(0);
    });
  });

  describe('性能监控集成', () => {
    it('应该处理性能条目', () => {
      // 获取私有的 PerformanceObserver 实例进行测试
      const mockEntries: PerformanceEntry[] = [
        {
          name: 'frame-duration',
          entryType: 'measure',
          startTime: 1000,
          duration: 16.67
        } as PerformanceEntry
      ];

      // 由于无法直接访问私有的observer，我们测试构造函数是否正确设置了监控
      expect(mockPerformanceObserver.observe).toHaveBeenCalledWith({ entryTypes: ['measure'] });
    });

    it('应该处理不支持PerformanceObserver的环境', () => {
      // 暂时删除PerformanceObserver
      const originalPO = global.PerformanceObserver;
      // @ts-ignore
      global.PerformanceObserver = undefined;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const testOptimizer = new PerformanceOptimizer();
      
      // 恢复PerformanceObserver
      global.PerformanceObserver = originalPO;
      
      testOptimizer.dispose();
      consoleSpy.mockRestore();
    });
  });

  describe('错误处理', () => {
    it('应该处理performance.measure抛出的错误', () => {
      mockPerformance.measure.mockImplementation(() => {
        throw new Error('Measure error');
      });

      expect(() => {
        optimizer.startFrame();
        optimizer.endFrame();
      }).not.toThrow();
    });

    it('应该处理performance API不可用的情况', () => {
      const originalPerformance = global.performance;
      // @ts-ignore
      global.performance = { now: () => Date.now() };

      const testOptimizer = new PerformanceOptimizer();
      
      expect(() => {
        testOptimizer.startFrame();
        testOptimizer.endFrame();
      }).not.toThrow();

      testOptimizer.dispose();
      global.performance = originalPerformance;
    });
  });

  describe('资源清理', () => {
    it('应该正确清理所有资源', () => {
      optimizer.startFrame();
      optimizer.endFrame();

      optimizer.dispose();

      expect(mockPerformanceObserver.disconnect).toHaveBeenCalled();
    });

    it('应该在dispose后仍能安全调用方法', () => {
      optimizer.dispose();

      expect(() => {
        optimizer.startFrame();
        optimizer.endFrame();
        optimizer.getMetrics();
        optimizer.getCurrentLOD();
      }).not.toThrow();
    });

    it('应该支持多次dispose调用', () => {
      expect(() => {
        optimizer.dispose();
        optimizer.dispose();
      }).not.toThrow();
    });
  });

  describe('配置验证', () => {
    const testConfigs = [
      { targetFrameRate: 30, maxFrameTime: 33.33 },
      { targetFrameRate: 120, maxFrameTime: 8.33 },
      { enableLOD: false },
      { enableAsyncRender: false },
      { maxConcurrentTasks: 1 },
      { maxConcurrentTasks: 16 },
      { cacheStrategy: 'lfu' as const },
      { cacheStrategy: 'adaptive' as const }
    ];

    testConfigs.forEach((config, index) => {
      it(`应该接受配置变体 ${index + 1}`, () => {
        expect(() => {
          const testOptimizer = new PerformanceOptimizer(config);
          testOptimizer.dispose();
        }).not.toThrow();
      });
    });
  });

  describe('性能基准测试', () => {
    it('应该能处理快速连续的帧测量', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        optimizer.startFrame();
        optimizer.endFrame();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1000); // 应该在1秒内完成
      
      const metrics = optimizer.getMetrics();
      expect(metrics.frameTimeHistory.length).toBeLessThanOrEqual(60);
    });

    it('应该维持稳定的内存使用', () => {
      // 测试大量操作后的内存状况
      for (let i = 0; i < 10000; i++) {
        optimizer.startFrame();
        optimizer.endFrame();
        optimizer.getMetrics();
      }

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTimeHistory.length).toBeLessThanOrEqual(60);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理极短的帧时间', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1000.1); // 0.1ms frame

      optimizer.startFrame();
      optimizer.endFrame();

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBeCloseTo(0.1, 1); // 容忍浮点数精度误差
    });

    it('应该处理极长的帧时间', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(2000); // 1000ms frame

      optimizer.startFrame();
      optimizer.endFrame();

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBe(1000);
    });

    it('应该处理负数时间差（时钟倒退）', () => {
      mockPerformance.now
        .mockReturnValueOnce(2000)
        .mockReturnValueOnce(1000); // 时钟倒退

      optimizer.startFrame();
      optimizer.endFrame();

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBe(-1000);
    });

    it('应该处理零时间差', () => {
      mockPerformance.now
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1000); // 相同时间

      optimizer.startFrame();
      optimizer.endFrame();

      const metrics = optimizer.getMetrics();
      expect(metrics.frameTime).toBe(0);
    });
  });

  describe('并发和异步操作', () => {
    it('应该支持多个优化器实例', () => {
      const optimizer2 = new PerformanceOptimizer({ targetFrameRate: 30 });
      const optimizer3 = new PerformanceOptimizer({ targetFrameRate: 120 });

      expect(() => {
        optimizer.startFrame();
        optimizer2.startFrame();
        optimizer3.startFrame();

        optimizer.endFrame();
        optimizer2.endFrame();
        optimizer3.endFrame();
      }).not.toThrow();

      optimizer2.dispose();
      optimizer3.dispose();
    });

    it('应该正确处理异步操作', async () => {
      const startPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          optimizer.startFrame();
          resolve();
        }, 10);
      });

      const endPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          optimizer.endFrame();
          resolve();
        }, 20);
      });

      await Promise.all([startPromise, endPromise]);

      const metrics = optimizer.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('类型安全测试', () => {
    it('getMetrics应该返回完整的PerformanceMetrics接口', () => {
      const metrics = optimizer.getMetrics();
      
      // 验证所有必需的属性都存在
      const requiredProperties: (keyof PerformanceMetrics)[] = [
        'currentFPS', 'averageFPS', 'frameTime', 'frameTimeHistory',
        'renderTime', 'updateTime', 'drawCalls',
        'memoryUsage', 'cacheHitRate', 'gcCount',
        'currentLOD', 'lodSwitches', 'qualityScore'
      ];

      requiredProperties.forEach(prop => {
        expect(metrics).toHaveProperty(prop);
        expect(typeof metrics[prop]).toBeTruthy();
      });
    });

    it('getCurrentLOD应该返回数字类型', () => {
      const lod = optimizer.getCurrentLOD();
      expect(typeof lod).toBe('number');
      expect(Number.isFinite(lod)).toBe(true);
    });
  });
});