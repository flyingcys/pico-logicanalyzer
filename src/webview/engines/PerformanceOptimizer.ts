/**
 * 性能优化器
 * 实现LOD、异步渲染、帧率控制等性能优化功能
 */

export interface PerformanceConfig {
  // 帧率控制
  targetFrameRate: number; // 目标帧率 (fps)
  maxFrameTime: number; // 最大帧时间 (ms)
  adaptiveFrameRate: boolean; // 自适应帧率

  // LOD控制
  enableLOD: boolean; // 启用LOD
  lodThresholds: number[]; // LOD阈值
  lodStrategies: string[]; // LOD策略

  // 异步渲染
  enableAsyncRender: boolean; // 启用异步渲染
  maxConcurrentTasks: number; // 最大并发任务数
  taskTimeSlice: number; // 任务时间片 (ms)

  // 内存管理
  maxMemoryUsage: number; // 最大内存使用 (MB)
  enableGarbageCollection: boolean; // 启用垃圾回收
  gcInterval: number; // GC间隔 (ms)

  // 缓存控制
  enableRenderCache: boolean; // 启用渲染缓存
  cacheSize: number; // 缓存大小 (MB)
  cacheStrategy: 'lru' | 'lfu' | 'adaptive'; // 缓存策略
}

export interface PerformanceMetrics {
  // 帧率指标
  currentFPS: number;
  averageFPS: number;
  frameTime: number;
  frameTimeHistory: number[];

  // 渲染指标
  renderTime: number;
  updateTime: number;
  drawCalls: number;

  // 内存指标
  memoryUsage: number;
  cacheHitRate: number;
  gcCount: number;

  // LOD指标
  currentLOD: number;
  lodSwitches: number;
  qualityScore: number;
}

export interface RenderTask {
  id: string;
  priority: number;
  estimatedTime: number;
  deadline: number;
  execute: () => Promise<void>;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;

  // 帧率控制
  private lastFrameTime = 0;
  private frameTimeHistory: number[] = [];
  private frameCount = 0;
  private fpsUpdateTime = 0;

  // 任务调度
  private taskQueue: RenderTask[] = [];
  private runningTasks: Map<string, Promise<void>> = new Map();
  private isScheduling = false;

  // LOD管理
  private currentLOD = 0;
  private lodHistory: number[] = [];
  private qualityScore = 1.0;

  // 内存管理
  private memoryUsage = 0;
  private lastGCTime = 0;
  private gcCount = 0;

  // 缓存管理
  private renderCache: Map<string, any> = new Map();
  private cacheHits = 0;
  private cacheMisses = 0;

  // 性能监控
  private performanceObserver: PerformanceObserver | null = null;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      targetFrameRate: 60,
      maxFrameTime: 16.67, // 60fps
      adaptiveFrameRate: true,
      enableLOD: true,
      lodThresholds: [16.67, 33.33, 50, 100], // ms
      lodStrategies: ['full', 'downsample', 'minmax', 'skip'],
      enableAsyncRender: true,
      maxConcurrentTasks: 4,
      taskTimeSlice: 5,
      maxMemoryUsage: 512, // MB
      enableGarbageCollection: true,
      gcInterval: 30000, // 30s
      enableRenderCache: true,
      cacheSize: 100, // MB
      cacheStrategy: 'lru',
      ...config
    };

    this.metrics = {
      currentFPS: 0,
      averageFPS: 0,
      frameTime: 0,
      frameTimeHistory: [],
      renderTime: 0,
      updateTime: 0,
      drawCalls: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      gcCount: 0,
      currentLOD: 0,
      lodSwitches: 0,
      qualityScore: 1.0
    };

    this.setupPerformanceMonitoring();
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'measure') {
              this.updatePerformanceMetrics(entry);
            }
          }
        });

        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }

  /**
   * 开始帧测量
   */
  public startFrame(): void {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('frame-start');
    }
    this.lastFrameTime = performance.now();
  }

  /**
   * 结束帧测量
   */
  public endFrame(): void {
    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;

    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure('frame-duration', 'frame-start');
      } catch (error) {
        // Ignore measurement errors
      }
    }

    this.updateFrameMetrics(frameTime);
    this.frameCount++;
  }

  /**
   * 更新帧指标
   */
  private updateFrameMetrics(frameTime: number): void {
    this.metrics.frameTime = frameTime;
    this.frameTimeHistory.push(frameTime);

    // 保持历史记录在合理范围内
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    // 更新FPS
    const currentTime = performance.now();
    if (currentTime - this.fpsUpdateTime >= 1000) {
      const fps = this.frameCount * 1000 / (currentTime - this.fpsUpdateTime);
      this.metrics.currentFPS = fps;

      // 计算平均FPS
      if (this.frameTimeHistory.length > 0) {
        const avgFrameTime = this.frameTimeHistory.reduce((sum, t) => sum + t, 0) / this.frameTimeHistory.length;
        this.metrics.averageFPS = 1000 / avgFrameTime;
      }

      this.frameCount = 0;
      this.fpsUpdateTime = currentTime;
    }

    this.metrics.frameTimeHistory = [...this.frameTimeHistory];
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(entry: PerformanceEntry): void {
    if (entry.name === 'frame-duration') {
      this.metrics.frameTime = entry.duration;
    }
  }

  /**
   * 获取性能指标
   */
  public getMetrics(): PerformanceMetrics {
    // 更新缓存命中率
    const totalRequests = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return { ...this.metrics };
  }

  /**
   * 获取当前LOD级别
   */
  public getCurrentLOD(): number {
    return this.currentLOD;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 停止性能监控
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    // 清理缓存
    this.renderCache.clear();

    // 清理任务队列
    this.taskQueue = [];
    this.runningTasks.clear();

    // 重置状态
    this.isScheduling = false;
  }
}
