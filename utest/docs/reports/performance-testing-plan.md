# 性能测试专项方案

## 性能测试目标

### 核心性能指标

根据项目需求文档，以下是必须满足的性能基准：

| 性能指标 | 目标值 | 关键程度 | 测试优先级 |
|----------|---------|----------|------------|
| **插件启动时间** | < 2秒 | 🔴 关键 | P0 |
| **波形渲染性能** | 60fps @ 100万数据点 | 🔴 关键 | P0 |
| **设备连接时间** | < 5秒 | 🟡 重要 | P1 |
| **数据采集响应** | 实时处理 | 🔴 关键 | P0 |
| **协议解码速度** | < 1秒 @ 1MB数据 | 🟡 重要 | P1 |
| **内存稳定性** | 24小时无泄漏 | 🔴 关键 | P0 |
| **多设备同步** | 5设备 @ 100MHz | 🟡 重要 | P2 |

### 性能测试分类

#### 1. 启动性能测试 (P0)
- **冷启动**: 插件首次激活时间
- **热启动**: 插件重新激活时间
- **资源加载**: 依赖模块加载时间
- **UI初始化**: Webview创建和渲染时间

#### 2. 渲染性能测试 (P0)
- **帧率测试**: 不同数据量下的渲染帧率
- **缩放性能**: 各种缩放级别下的响应时间
- **滚动性能**: 大数据集滚动流畅度
- **交互响应**: 鼠标操作的响应延迟

#### 3. 数据处理性能测试 (P0)
- **采集性能**: 实时数据处理能力
- **解码性能**: 协议解码速度和准确性
- **存储性能**: 数据序列化和反序列化
- **传输性能**: 数据在进程间的传输效率

#### 4. 内存性能测试 (P0)
- **内存泄漏**: 长时间运行的内存增长
- **内存峰值**: 大数据操作时的内存使用
- **垃圾回收**: GC对性能的影响
- **内存效率**: 数据结构的内存占用优化

## 性能测试框架设计

### 测试基础设施

#### 1. 性能测试基类
```typescript
// src/tests/performance/PerformanceTestBase.ts
export abstract class PerformanceTestBase {
  protected performanceMonitor: PerformanceMonitor;
  protected memoryTracker: MemoryTracker;
  protected fpsCounter: FPSCounter;
  
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.memoryTracker = new MemoryTracker();
    this.fpsCounter = new FPSCounter();
  }
  
  /**
   * 执行性能测试并收集指标
   */
  protected async runPerformanceTest<T>(
    testName: string,
    operation: () => Promise<T>,
    expectations: PerformanceExpectations
  ): Promise<PerformanceResult<T>> {
    // 清理内存
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = this.memoryTracker.getCurrentMemory();
    const startTime = performance.now();
    
    let result: T;
    let error: Error | null = null;
    
    try {
      result = await operation();
    } catch (e) {
      error = e as Error;
      throw e;
    } finally {
      const endTime = performance.now();
      const finalMemory = this.memoryTracker.getCurrentMemory();
      
      const performanceResult: PerformanceResult<T> = {
        testName,
        duration: endTime - startTime,
        memoryUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        memoryPeak: finalMemory.heapUsed,
        result: result!,
        error,
        expectations,
        passed: this.evaluateExpectations(endTime - startTime, expectations)
      };
      
      this.recordResult(performanceResult);
      return performanceResult;
    }
  }
  
  /**
   * 批量运行性能测试
   */
  protected async runBenchmark(
    testName: string,
    operation: () => Promise<any>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const results: number[] = [];
    let totalMemoryUsed = 0;
    
    for (let i = 0; i < iterations; i++) {
      if (global.gc && i % 10 === 0) {
        global.gc(); // 每10次迭代清理一次内存
      }
      
      const startMemory = this.memoryTracker.getCurrentMemory();
      const startTime = performance.now();
      
      await operation();
      
      const endTime = performance.now();
      const endMemory = this.memoryTracker.getCurrentMemory();
      
      results.push(endTime - startTime);
      totalMemoryUsed += endMemory.heapUsed - startMemory.heapUsed;
    }
    
    return this.calculateBenchmarkStats(testName, results, totalMemoryUsed);
  }
  
  private evaluateExpectations(duration: number, expectations: PerformanceExpectations): boolean {
    if (expectations.maxDuration && duration > expectations.maxDuration) {
      return false;
    }
    
    if (expectations.minFPS && this.fpsCounter.getAverageFPS() < expectations.minFPS) {
      return false;
    }
    
    return true;
  }
  
  private calculateBenchmarkStats(
    testName: string, 
    results: number[], 
    totalMemoryUsed: number
  ): BenchmarkResult {
    const sorted = [...results].sort((a, b) => a - b);
    const sum = results.reduce((a, b) => a + b, 0);
    
    return {
      testName,
      iterations: results.length,
      totalTime: sum,
      averageTime: sum / results.length,
      medianTime: sorted[Math.floor(sorted.length / 2)],
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      p95Time: sorted[Math.floor(sorted.length * 0.95)],
      p99Time: sorted[Math.floor(sorted.length * 0.99)],
      standardDeviation: this.calculateStandardDeviation(results, sum / results.length),
      averageMemoryPerIteration: totalMemoryUsed / results.length,
      throughput: results.length / (sum / 1000) // 每秒操作数
    };
  }
  
  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  abstract recordResult(result: PerformanceResult<any>): void;
}

interface PerformanceExpectations {
  maxDuration?: number;
  maxMemory?: number;
  minFPS?: number;
  maxMemoryLeakPerIteration?: number;
}

interface PerformanceResult<T> {
  testName: string;
  duration: number;
  memoryUsed: number;
  memoryPeak: number;
  result: T;
  error: Error | null;
  expectations: PerformanceExpectations;
  passed: boolean;
}

interface BenchmarkResult {
  testName: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  medianTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  standardDeviation: number;
  averageMemoryPerIteration: number;
  throughput: number;
}
```

#### 2. FPS计数器
```typescript
// src/tests/performance/FPSCounter.ts
export class FPSCounter {
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;
  
  startMeasuring(): void {
    this.frameTimes = [];
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
  }
  
  recordFrame(): void {
    const currentTime = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime;
      this.frameTimes.push(frameTime);
    }
    this.lastFrameTime = currentTime;
    this.frameCount++;
  }
  
  stopMeasuring(): FPSStatistics {
    const totalTime = this.frameTimes.reduce((sum, time) => sum + time, 0);
    const averageFrameTime = totalTime / this.frameTimes.length;
    const averageFPS = 1000 / averageFrameTime;
    
    // 计算帧时间分布
    const sortedFrameTimes = [...this.frameTimes].sort((a, b) => a - b);
    
    return {
      averageFPS,
      minFPS: 1000 / sortedFrameTimes[sortedFrameTimes.length - 1],
      maxFPS: 1000 / sortedFrameTimes[0],
      p99FrameTime: sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.99)],
      p95FrameTime: sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)],
      frameCount: this.frameCount,
      droppedFrames: this.frameTimes.filter(time => time > 16.67).length, // >16.67ms = <60fps
      totalMeasuringTime: totalTime
    };
  }
  
  getAverageFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    const averageFrameTime = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
    return 1000 / averageFrameTime;
  }
}

interface FPSStatistics {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  p99FrameTime: number;
  p95FrameTime: number;
  frameCount: number;
  droppedFrames: number;
  totalMeasuringTime: number;
}
```

#### 3. 内存追踪器
```typescript
// src/tests/performance/MemoryTracker.ts
export class MemoryTracker {
  private memorySnapshots: MemorySnapshot[] = [];
  private trackingInterval: NodeJS.Timer | null = null;
  
  startTracking(intervalMs: number = 1000): void {
    this.memorySnapshots = [];
    this.trackingInterval = setInterval(() => {
      this.recordSnapshot();
    }, intervalMs);
  }
  
  stopTracking(): MemoryAnalysis {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    return this.analyzeMemoryUsage();
  }
  
  getCurrentMemory(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    };
  }
  
  private recordSnapshot(): void {
    this.memorySnapshots.push(this.getCurrentMemory());
  }
  
  private analyzeMemoryUsage(): MemoryAnalysis {
    if (this.memorySnapshots.length === 0) {
      throw new Error('No memory snapshots recorded');
    }
    
    const heapUsages = this.memorySnapshots.map(s => s.heapUsed);
    const initial = this.memorySnapshots[0];
    const final = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    // 计算内存泄漏趋势
    const leakDetection = this.detectMemoryLeak();
    
    return {
      initialMemory: initial,
      finalMemory: final,
      peakMemory: Math.max(...heapUsages),
      minMemory: Math.min(...heapUsages),
      averageMemory: heapUsages.reduce((sum, usage) => sum + usage, 0) / heapUsages.length,
      memoryGrowth: final.heapUsed - initial.heapUsed,
      memoryLeakDetected: leakDetection.detected,
      leakRate: leakDetection.rate,
      snapshots: this.memorySnapshots
    };
  }
  
  private detectMemoryLeak(): { detected: boolean; rate: number } {
    if (this.memorySnapshots.length < 10) {
      return { detected: false, rate: 0 };
    }
    
    // 使用线性回归检测内存增长趋势
    const n = this.memorySnapshots.length;
    const x = this.memorySnapshots.map((_, i) => i);
    const y = this.memorySnapshots.map(s => s.heapUsed);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = this.calculateCorrelation(x, y);
    
    // 如果斜率为正且相关性高，则可能存在内存泄漏
    const detected = slope > 1000 && correlation > 0.7; // 每个快照增长>1KB且相关性>0.7
    
    return {
      detected,
      rate: slope
    };
  }
  
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
}

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface MemoryAnalysis {
  initialMemory: MemorySnapshot;
  finalMemory: MemorySnapshot;
  peakMemory: number;
  minMemory: number;
  averageMemory: number;
  memoryGrowth: number;
  memoryLeakDetected: boolean;
  leakRate: number;
  snapshots: MemorySnapshot[];
}
```

## 具体性能测试实现

### 1. 启动性能测试
```typescript
// src/tests/performance/StartupPerformance.test.ts
import { PerformanceTestBase } from './PerformanceTestBase';
import * as vscode from 'vscode';

class StartupPerformanceTest extends PerformanceTestBase {
  recordResult(result: any): void {
    console.log(`启动性能测试结果: ${JSON.stringify(result, null, 2)}`);
  }
}

describe('Startup Performance Tests', () => {
  let perfTest: StartupPerformanceTest;
  
  beforeEach(() => {
    perfTest = new StartupPerformanceTest();
  });
  
  describe('Extension Activation', () => {
    it('should activate extension within 2 seconds (P0)', async () => {
      const result = await perfTest.runPerformanceTest(
        'extension-activation',
        async () => {
          // 模拟扩展激活过程
          const mockContext = new MockExtensionContext();
          const { activate } = await import('../../extension');
          await activate(mockContext);
          return mockContext;
        },
        {
          maxDuration: 2000, // 2秒要求
          maxMemory: 50 * 1024 * 1024 // 50MB内存限制
        }
      );
      
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(2000);
      
      // 记录详细指标
      console.log(`扩展激活时间: ${result.duration.toFixed(2)}ms`);
      console.log(`内存使用: ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    });
    
    it('should have consistent activation times', async () => {
      const benchmark = await perfTest.runBenchmark(
        'activation-consistency',
        async () => {
          const mockContext = new MockExtensionContext();
          const { activate } = await import('../../extension');
          await activate(mockContext);
        },
        50 // 50次迭代
      );
      
      // 验证性能一致性
      expect(benchmark.standardDeviation).toBeLessThan(100); // 标准差<100ms
      expect(benchmark.p95Time).toBeLessThan(2500); // 95%的情况下<2.5s
      
      console.log(`激活时间统计: 平均${benchmark.averageTime.toFixed(2)}ms, P95: ${benchmark.p95Time.toFixed(2)}ms`);
    });
  });
  
  describe('Webview Creation', () => {
    it('should create webview panel within 500ms', async () => {
      const result = await perfTest.runPerformanceTest(
        'webview-creation',
        async () => {
          const panel = vscode.window.createWebviewPanel(
            'logicAnalyzer.lacEditor',
            'Logic Analyzer',
            vscode.ViewColumn.One,
            { enableScripts: true }
          );
          
          // 设置HTML内容
          panel.webview.html = await generateWebviewHTML();
          
          return panel;
        },
        {
          maxDuration: 500,
          maxMemory: 20 * 1024 * 1024
        }
      );
      
      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(500);
    });
  });
  
  describe('Resource Loading', () => {
    it('should load all dependencies within 1 second', async () => {
      const result = await perfTest.runPerformanceTest(
        'dependency-loading',
        async () => {
          // 加载所有核心模块
          const modules = await Promise.all([
            import('../../drivers/AnalyzerDriverBase'),
            import('../../decoders/DecoderManager'),
            import('../../webview/stores/DeviceStore'),
            import('../../webview/engines/WaveformRenderer')
          ]);
          
          return modules;
        },
        {
          maxDuration: 1000,
          maxMemory: 30 * 1024 * 1024
        }
      );
      
      expect(result.passed).toBe(true);
      expect(result.result).toHaveLength(4);
    });
  });
});

// 辅助函数
async function generateWebviewHTML(): Promise<string> {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logic Analyzer</title>
      <style>body { margin: 0; padding: 0; }</style>
    </head>
    <body>
      <div id="app">Loading...</div>
    </body>
    </html>
  `;
}

class MockExtensionContext {
  subscriptions: any[] = [];
  workspaceState = { get: jest.fn(), update: jest.fn() };
  globalState = { get: jest.fn(), update: jest.fn() };
  extensionPath = '/mock/extension';
  storagePath = '/mock/storage';
  globalStoragePath = '/mock/global-storage';
  logPath = '/mock/logs';
}
```

### 2. 渲染性能测试
```typescript
// src/tests/performance/RenderingPerformance.test.ts
import { PerformanceTestBase } from './PerformanceTestBase';
import { WaveformRenderer } from '../../webview/engines/WaveformRenderer';
import { TestDataSets } from '../fixtures/test-data';

class RenderingPerformanceTest extends PerformanceTestBase {
  recordResult(result: any): void {
    console.log(`渲染性能测试结果: ${JSON.stringify(result, null, 2)}`);
  }
}

describe('Rendering Performance Tests', () => {
  let perfTest: RenderingPerformanceTest;
  let renderer: WaveformRenderer;
  let canvas: HTMLCanvasElement;
  
  beforeEach(() => {
    perfTest = new RenderingPerformanceTest();
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    renderer = new WaveformRenderer(canvas);
  });
  
  describe('Large Dataset Rendering (P0)', () => {
    it('should render 1M samples at 60fps', async () => {
      const largeDataset = TestDataSets.performance.largeSample;
      const channels = generateMockChannels(largeDataset.channelCount, largeDataset.sampleCount);
      
      let frameCount = 0;
      const targetFrames = 60; // 测试60帧
      
      const result = await perfTest.runPerformanceTest(
        'large-dataset-rendering',
        async () => {
          perfTest.fpsCounter.startMeasuring();
          
          // 渲染60帧
          for (let frame = 0; frame < targetFrames; frame++) {
            const viewRange = {
              startSample: frame * 1000,
              endSample: (frame + 1) * 1000 + 10000, // 10k样本窗口
              samplesPerPixel: 5.2,
              pixelsPerSample: 0.192
            };
            
            await renderer.renderWaveform(channels, viewRange);
            perfTest.fpsCounter.recordFrame();
            frameCount++;
            
            // 模拟帧间隔
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
          return perfTest.fpsCounter.stopMeasuring();
        },
        {
          maxDuration: 1000, // 1秒内完成60帧
          minFPS: 60,
          maxMemory: 100 * 1024 * 1024
        }
      );
      
      expect(result.passed).toBe(true);
      expect(result.result.averageFPS).toBeGreaterThanOrEqual(60);
      expect(result.result.droppedFrames).toBeLessThan(3); // 允许少量掉帧
      
      console.log(`大数据集渲染: 平均FPS ${result.result.averageFPS.toFixed(2)}, 掉帧 ${result.result.droppedFrames}`);
    });
    
    it('should maintain performance with multiple channels', async () => {
      const channelCounts = [8, 16, 24];
      const sampleCount = 1000000;
      
      for (const channelCount of channelCounts) {
        const channels = generateMockChannels(channelCount, sampleCount);
        
        const result = await perfTest.runPerformanceTest(
          `multi-channel-rendering-${channelCount}ch`,
          async () => {
            const startTime = performance.now();
            
            await renderer.renderWaveform(channels, {
              startSample: 0,
              endSample: 10000,
              samplesPerPixel: 5.2,
              pixelsPerSample: 0.192
            });
            
            return performance.now() - startTime;
          },
          {
            maxDuration: 16.67, // 一帧时间 (60fps)
            maxMemory: 50 * 1024 * 1024
          }
        );
        
        expect(result.passed).toBe(true);
        console.log(`${channelCount}通道渲染时间: ${result.result.toFixed(2)}ms`);
      }
    });
  });
  
  describe('Zoom and Pan Performance', () => {
    it('should handle zoom operations smoothly', async () => {
      const channels = generateMockChannels(8, 100000);
      const zoomLevels = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0, 100.0];
      
      const benchmark = await perfTest.runBenchmark(
        'zoom-operations',
        async () => {
          const zoomLevel = zoomLevels[Math.floor(Math.random() * zoomLevels.length)];
          
          await renderer.setZoom(zoomLevel);
          await renderer.renderWaveform(channels, {
            startSample: 0,
            endSample: Math.floor(100000 / zoomLevel),
            samplesPerPixel: 52.08 / zoomLevel,
            pixelsPerSample: 0.0192 * zoomLevel
          });
        },
        100 // 100次缩放操作
      );
      
      expect(benchmark.p95Time).toBeLessThan(100); // 95%的缩放操作<100ms
      expect(benchmark.averageTime).toBeLessThan(50); // 平均<50ms
      
      console.log(`缩放性能: 平均${benchmark.averageTime.toFixed(2)}ms, P95: ${benchmark.p95Time.toFixed(2)}ms`);
    });
    
    it('should maintain smooth scrolling', async () => {
      const channels = generateMockChannels(8, 1000000);
      let scrollPosition = 0;
      const scrollStep = 1000;
      const scrollIterations = 100;
      
      const result = await perfTest.runPerformanceTest(
        'smooth-scrolling',
        async () => {
          perfTest.fpsCounter.startMeasuring();
          
          for (let i = 0; i < scrollIterations; i++) {
            scrollPosition += scrollStep;
            
            await renderer.renderWaveform(channels, {
              startSample: scrollPosition,
              endSample: scrollPosition + 10000,
              samplesPerPixel: 5.2,
              pixelsPerSample: 0.192
            });
            
            perfTest.fpsCounter.recordFrame();
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
          return perfTest.fpsCounter.stopMeasuring();
        },
        {
          maxDuration: 2000, // 2秒内完成100次滚动
          minFPS: 50, // 允许稍低的帧率
          maxMemory: 80 * 1024 * 1024
        }
      );
      
      expect(result.passed).toBe(true);
      expect(result.result.averageFPS).toBeGreaterThanOrEqual(50);
    });
  });
  
  describe('Memory Usage During Rendering', () => {
    it('should not leak memory during continuous rendering', async () => {
      const channels = generateMockChannels(16, 500000);
      
      perfTest.memoryTracker.startTracking(100); // 每100ms记录一次
      
      const result = await perfTest.runPerformanceTest(
        'rendering-memory-leak',
        async () => {
          // 连续渲染5分钟
          const endTime = Date.now() + 5 * 60 * 1000;
          let frameCount = 0;
          
          while (Date.now() < endTime) {
            await renderer.renderWaveform(channels, {
              startSample: frameCount * 100,
              endSample: frameCount * 100 + 10000,
              samplesPerPixel: 5.2,
              pixelsPerSample: 0.192
            });
            
            frameCount++;
            
            // 每100帧强制GC一次
            if (frameCount % 100 === 0 && global.gc) {
              global.gc();
            }
            
            await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
          }
          
          return frameCount;
        },
        {
          maxDuration: 5 * 60 * 1000 + 10000, // 允许额外10秒
          maxMemoryLeakPerIteration: 1024 // 每次迭代内存增长<1KB
        }
      );
      
      const memoryAnalysis = perfTest.memoryTracker.stopTracking();
      
      expect(memoryAnalysis.memoryLeakDetected).toBe(false);
      expect(memoryAnalysis.memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 总增长<50MB
      
      console.log(`连续渲染内存分析: 增长${(memoryAnalysis.memoryGrowth / 1024 / 1024).toFixed(2)}MB, 泄漏检测: ${memoryAnalysis.memoryLeakDetected}`);
    });
  });
});

// 辅助函数
function generateMockChannels(channelCount: number, sampleCount: number): any[] {
  const channels = [];
  
  for (let i = 0; i < channelCount; i++) {
    const samples = new Uint8Array(Math.ceil(sampleCount / 8));
    
    // 生成模式化数据以获得一致的性能结果
    for (let j = 0; j < samples.length; j++) {
      samples[j] = (j + i) % 256;
    }
    
    channels.push({
      channelNumber: i,
      channelName: `Channel ${i}`,
      hidden: false,
      samples,
      get textualChannelNumber() { return `Channel ${i}`; },
      clone: function() { return { ...this }; }
    });
  }
  
  return channels;
}
```

### 3. 数据处理性能测试
```typescript
// src/tests/performance/DataProcessingPerformance.test.ts
import { PerformanceTestBase } from './PerformanceTestBase';
import { I2CDecoder } from '../../decoders/protocols/I2CDecoder';
import { SignalGenerator } from '../utils/SignalGenerator';

class DataProcessingPerformanceTest extends PerformanceTestBase {
  recordResult(result: any): void {
    console.log(`数据处理性能测试结果: ${JSON.stringify(result, null, 2)}`);
  }
}

describe('Data Processing Performance Tests', () => {
  let perfTest: DataProcessingPerformanceTest;
  
  beforeEach(() => {
    perfTest = new DataProcessingPerformanceTest();
  });
  
  describe('Protocol Decoding Performance (P1)', () => {
    it('should decode 1MB I2C data within 1 second', async () => {
      // 生成1MB的I2C数据
      const largeI2CData = SignalGenerator.generateLargeI2CDataset({
        duration: 10000, // 10秒数据
        clockFrequency: 100000, // 100kHz
        sampleRate: 10000000, // 10MHz采样
        transactionCount: 10000 // 10k个事务
      });
      
      const channels = [
        {
          channelNumber: 0,
          channelName: 'SCL',
          hidden: false,
          samples: largeI2CData.scl,
          get textualChannelNumber() { return 'SCL'; },
          clone: function() { return { ...this }; }
        },
        {
          channelNumber: 1,
          channelName: 'SDA',
          hidden: false,
          samples: largeI2CData.sda,
          get textualChannelNumber() { return 'SDA'; },
          clone: function() { return { ...this }; }
        }
      ];
      
      const decoder = new I2CDecoder();
      
      const result = await perfTest.runPerformanceTest(
        'large-i2c-decoding',
        async () => {
          return decoder.decode(10000000, channels, []);
        },
        {
          maxDuration: 1000, // 1秒要求
          maxMemory: 200 * 1024 * 1024 // 200MB内存限制
        }
      );
      
      expect(result.passed).toBe(true);
      expect(result.result.length).toBeGreaterThan(0);
      
      const dataSize = largeI2CData.scl.length + largeI2CData.sda.length;
      const throughput = dataSize / (result.duration / 1000); // bytes/second
      
      console.log(`I2C解码性能: ${result.duration.toFixed(2)}ms, 吞吐量: ${(throughput / 1024 / 1024).toFixed(2)}MB/s`);
    });
    
    it('should handle concurrent decoding efficiently', async () => {
      const decoderTypes = ['i2c', 'spi', 'uart'];
      const concurrentTests = decoderTypes.map(async (type) => {
        const decoder = createDecoder(type);
        const testData = generateTestData(type, 100000); // 100k样本
        
        return perfTest.runPerformanceTest(
          `concurrent-${type}-decoding`,
          async () => {
            return decoder.decode(1000000, testData.channels, []);
          },
          {
            maxDuration: 500,
            maxMemory: 50 * 1024 * 1024
          }
        );
      });
      
      const results = await Promise.all(concurrentTests);
      
      // 所有解码器都应该在时间限制内完成
      results.forEach(result => {
        expect(result.passed).toBe(true);
      });
      
      console.log('并发解码性能:', results.map(r => `${r.testName}: ${r.duration.toFixed(2)}ms`));
    });
  });
  
  describe('Real-time Data Processing', () => {
    it('should process streaming data without lag', async () => {
      const streamingBenchmark = await perfTest.runBenchmark(
        'streaming-data-processing',
        async () => {
          // 模拟实时数据流处理
          const chunkSize = 1000; // 1000样本/块
          const chunk = generateMockDataChunk(chunkSize);
          
          // 处理数据块（解码、存储、更新UI）
          const decoder = new I2CDecoder();
          const results = decoder.decode(1000000, chunk.channels, []);
          
          // 模拟UI更新
          await new Promise(resolve => setTimeout(resolve, 1));
          
          return results.length;
        },
        1000 // 1000个数据块
      );
      
      // 流处理应该保持低延迟和高吞吐量
      expect(streamingBenchmark.averageTime).toBeLessThan(10); // 平均<10ms/块
      expect(streamingBenchmark.p95Time).toBeLessThan(20); // 95%<20ms
      expect(streamingBenchmark.throughput).toBeGreaterThan(50); // >50块/秒
      
      console.log(`流处理性能: 平均${streamingBenchmark.averageTime.toFixed(2)}ms/块, 吞吐量: ${streamingBenchmark.throughput.toFixed(2)}块/秒`);
    });
  });
  
  describe('Memory Efficiency', () => {
    it('should process large datasets with minimal memory footprint', async () => {
      const largeSampleCount = 10000000; // 1000万样本
      
      perfTest.memoryTracker.startTracking(500);
      
      const result = await perfTest.runPerformanceTest(
        'large-dataset-memory-efficiency',
        async () => {
          // 分批处理大数据集
          const batchSize = 100000;
          const totalBatches = Math.ceil(largeSampleCount / batchSize);
          let processedResults = 0;
          
          for (let batch = 0; batch < totalBatches; batch++) {
            const batchData = generateMockDataChunk(batchSize);
            const decoder = new I2CDecoder();
            const results = decoder.decode(1000000, batchData.channels, []);
            processedResults += results.length;
            
            // 模拟批次间的清理
            if (batch % 10 === 0 && global.gc) {
              global.gc();
            }
          }
          
          return processedResults;
        },
        {
          maxDuration: 30000, // 30秒
          maxMemory: 500 * 1024 * 1024 // 500MB峰值内存
        }
      );
      
      const memoryAnalysis = perfTest.memoryTracker.stopTracking();
      
      expect(result.passed).toBe(true);
      expect(memoryAnalysis.peakMemory).toBeLessThan(500 * 1024 * 1024);
      expect(memoryAnalysis.memoryLeakDetected).toBe(false);
      
      const memoryEfficiency = largeSampleCount / (memoryAnalysis.peakMemory / 1024 / 1024); // 样本数/MB
      console.log(`内存效率: ${memoryEfficiency.toFixed(0)} 样本/MB, 峰值内存: ${(memoryAnalysis.peakMemory / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});

// 辅助函数
function createDecoder(type: string): any {
  switch (type) {
    case 'i2c':
      return new I2CDecoder();
    case 'spi':
      // return new SPIDecoder();
      return { decode: () => [] }; // Mock
    case 'uart':
      // return new UARTDecoder();
      return { decode: () => [] }; // Mock
    default:
      throw new Error(`Unknown decoder type: ${type}`);
  }
}

function generateTestData(type: string, sampleCount: number): any {
  // 为不同协议生成测试数据
  switch (type) {
    case 'i2c':
      return {
        channels: [
          { samples: new Uint8Array(Math.ceil(sampleCount / 8)) },
          { samples: new Uint8Array(Math.ceil(sampleCount / 8)) }
        ]
      };
    default:
      return { channels: [] };
  }
}

function generateMockDataChunk(sampleCount: number): any {
  return {
    channels: [
      {
        channelNumber: 0,
        channelName: 'SCL',
        samples: new Uint8Array(Math.ceil(sampleCount / 8)),
        get textualChannelNumber() { return 'SCL'; },
        clone: function() { return { ...this }; }
      },
      {
        channelNumber: 1,
        channelName: 'SDA', 
        samples: new Uint8Array(Math.ceil(sampleCount / 8)),
        get textualChannelNumber() { return 'SDA'; },
        clone: function() { return { ...this }; }
      }
    ]
  };
}
```

## 性能测试报告和监控

### 性能报告生成器
```typescript
// src/tests/performance/PerformanceReporter.ts
export class PerformanceReporter {
  private results: PerformanceResult<any>[] = [];
  private benchmarks: BenchmarkResult[] = [];
  
  addResult(result: PerformanceResult<any>): void {
    this.results.push(result);
  }
  
  addBenchmark(benchmark: BenchmarkResult): void {
    this.benchmarks.push(benchmark);
  }
  
  generateHTMLReport(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>VSCode 逻辑分析器插件 - 性能测试报告</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background: #007ACC; color: white; padding: 20px; border-radius: 5px; }
          .summary { display: flex; gap: 20px; margin: 20px 0; }
          .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; flex: 1; }
          .metric.passed { border-left: 5px solid #28a745; }
          .metric.failed { border-left: 5px solid #dc3545; }
          .chart { margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <div class="header">
          <h1>性能测试报告</h1>
          <p>生成时间: ${new Date().toLocaleString()}</p>
        </div>
        
        ${this.generateSummarySection()}
        ${this.generateDetailedResults()}
        ${this.generateBenchmarkResults()}
        ${this.generatePerformanceCharts()}
      </body>
      </html>
    `;
  }
  
  private generateSummarySection(): string {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const averageDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    
    return `
      <div class="summary">
        <div class="metric ${passedTests === totalTests ? 'passed' : 'failed'}">
          <h3>测试通过率</h3>
          <div style="font-size: 24px; font-weight: bold;">
            ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)
          </div>
        </div>
        <div class="metric">
          <h3>平均执行时间</h3>
          <div style="font-size: 24px; font-weight: bold;">
            ${averageDuration.toFixed(2)}ms
          </div>
        </div>
        <div class="metric">
          <h3>性能等级</h3>
          <div style="font-size: 24px; font-weight: bold;">
            ${this.calculatePerformanceGrade()}
          </div>
        </div>
      </div>
    `;
  }
  
  private generateDetailedResults(): string {
    const rows = this.results.map(result => `
      <tr class="${result.passed ? 'passed' : 'failed'}">
        <td>${result.testName}</td>
        <td>${result.duration.toFixed(2)}ms</td>
        <td>${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB</td>
        <td>${result.passed ? '✅ 通过' : '❌ 失败'}</td>
        <td>${result.expectations.maxDuration || 'N/A'}ms</td>
      </tr>
    `).join('');
    
    return `
      <h2>详细测试结果</h2>
      <table>
        <thead>
          <tr>
            <th>测试名称</th>
            <th>执行时间</th>
            <th>内存使用</th>
            <th>状态</th>
            <th>性能要求</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }
  
  private generateBenchmarkResults(): string {
    const rows = this.benchmarks.map(benchmark => `
      <tr>
        <td>${benchmark.testName}</td>
        <td>${benchmark.iterations}</td>
        <td>${benchmark.averageTime.toFixed(2)}ms</td>
        <td>${benchmark.p95Time.toFixed(2)}ms</td>
        <td>${benchmark.throughput.toFixed(2)}/s</td>
        <td>${benchmark.standardDeviation.toFixed(2)}ms</td>
      </tr>
    `).join('');
    
    return `
      <h2>基准测试结果</h2>
      <table>
        <thead>
          <tr>
            <th>基准测试</th>
            <th>迭代次数</th>
            <th>平均时间</th>
            <th>P95时间</th>
            <th>吞吐量</th>
            <th>标准差</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }
  
  private generatePerformanceCharts(): string {
    return `
      <h2>性能趋势图</h2>
      <div class="chart">
        <canvas id="performanceChart" width="800" height="400"></canvas>
      </div>
      
      <script>
        const ctx = document.getElementById('performanceChart').getContext('2d');
        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(this.results.map(r => r.testName))},
            datasets: [{
              label: '执行时间 (ms)',
              data: ${JSON.stringify(this.results.map(r => r.duration))},
              borderColor: 'rgb(75, 192, 192)',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      </script>
    `;
  }
  
  private calculatePerformanceGrade(): string {
    const passRate = this.results.filter(r => r.passed).length / this.results.length;
    const avgPerformance = this.results.reduce((sum, r) => {
      const performanceRatio = r.duration / (r.expectations.maxDuration || r.duration);
      return sum + (1 - performanceRatio);
    }, 0) / this.results.length;
    
    const overallScore = (passRate * 0.6 + avgPerformance * 0.4) * 100;
    
    if (overallScore >= 90) return 'A+';
    if (overallScore >= 80) return 'A';
    if (overallScore >= 70) return 'B';
    if (overallScore >= 60) return 'C';
    return 'D';
  }
  
  generateJSONReport(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.passed).length,
        averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
        grade: this.calculatePerformanceGrade()
      },
      results: this.results,
      benchmarks: this.benchmarks
    }, null, 2);
  }
}
```

这个性能测试专项方案提供了：

1. **完整的性能测试框架** - 包括基类、工具和监控系统
2. **关键性能指标验证** - 启动时间、渲染性能、数据处理等
3. **内存泄漏检测** - 自动化的内存使用分析
4. **基准测试能力** - 统计分析和性能趋势监控
5. **详细的性能报告** - HTML和JSON格式的测试报告

通过这个方案，开发团队可以：
- 确保所有性能要求得到满足
- 及时发现性能回归问题
- 优化关键性能瓶颈
- 建立性能基准和监控体系