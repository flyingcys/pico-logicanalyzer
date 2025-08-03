/**
 * 性能基准测试工具
 * 用于Week 8集成测试中的性能和稳定性验证
 */

interface BenchmarkResult {
  testName: string;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  operations: number;
  opsPerSecond: number;
  success: boolean;
  error?: string;
}

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private memorySnapshots: MemorySnapshot[] = [];

  /**
   * 执行性能基准测试
   */
  async runBenchmark<T>(
    testName: string, 
    operation: () => Promise<T>, 
    operations: number = 1
  ): Promise<BenchmarkResult> {
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage();
    const startTime = performance.now();

    let success = true;
    let error: string | undefined;

    try {
      // 执行指定次数的操作
      for (let i = 0; i < operations; i++) {
        await operation();
      }
    } catch (e) {
      success = false;
      error = e instanceof Error ? e.message : String(e);
    }

    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    const duration = endTime - startTime;

    const result: BenchmarkResult = {
      testName,
      duration,
      memoryUsage: finalMemory,
      operations,
      opsPerSecond: operations / (duration / 1000),
      success,
      error
    };

    this.results.push(result);
    return result;
  }

  /**
   * 内存泄漏检测测试
   */
  async memoryLeakTest<T>(
    testName: string,
    operation: () => Promise<T>,
    iterations: number = 100,
    snapshotInterval: number = 10
  ): Promise<{
    leaked: boolean;
    memoryGrowth: number;
    snapshots: MemorySnapshot[];
    finalResult: BenchmarkResult;
  }> {
    this.memorySnapshots = [];
    
    // 初始内存快照
    if (global.gc) global.gc();
    this.takeMemorySnapshot();

    const result = await this.runBenchmark(testName, async () => {
      for (let i = 0; i < iterations; i++) {
        await operation();
        
        // 定期拍摄内存快照
        if (i % snapshotInterval === 0) {
          if (global.gc) global.gc();
          this.takeMemorySnapshot();
        }
      }
    });

    // 最终内存快照
    if (global.gc) global.gc();
    this.takeMemorySnapshot();

    // 分析内存泄漏
    const initialMemory = this.memorySnapshots[0].heapUsed;
    const finalMemory = this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    const growthMB = memoryGrowth / (1024 * 1024);

    // 如果内存增长超过50MB且呈持续上升趋势，判定为内存泄漏
    const leaked = growthMB > 50 && this.isMemoryGrowthTrend();

    return {
      leaked,
      memoryGrowth,
      snapshots: this.memorySnapshots,
      finalResult: result
    };
  }

  /**
   * 并发性能测试
   */
  async concurrencyTest<T>(
    testName: string,
    operation: () => Promise<T>,
    concurrency: number = 10,
    operationsPerWorker: number = 10
  ): Promise<BenchmarkResult[]> {
    const workers: Promise<BenchmarkResult>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const workerPromise = this.runBenchmark(
        `${testName}_Worker${i}`,
        operation,
        operationsPerWorker
      );
      workers.push(workerPromise);
    }

    const results = await Promise.all(workers);
    return results;
  }

  /**
   * 缓存和重复操作性能测试
   */
  async cachePerformanceTest<T>(
    testName: string,
    coldOperation: () => Promise<T>, // 冷启动操作
    warmOperation: () => Promise<T>, // 预热后操作
    repetitions: number = 50
  ): Promise<{
    coldStart: BenchmarkResult;
    warmRuns: BenchmarkResult;
    improvement: number;
  }> {
    // 冷启动测试
    const coldResult = await this.runBenchmark(`${testName}_Cold`, coldOperation, 1);

    // 预热操作
    for (let i = 0; i < 5; i++) {
      await warmOperation();
    }

    // 预热后性能测试
    const warmResult = await this.runBenchmark(`${testName}_Warm`, warmOperation, repetitions);

    const improvement = coldResult.duration / (warmResult.duration / repetitions);

    return {
      coldStart: coldResult,
      warmRuns: warmResult,
      improvement
    };
  }

  /**
   * 数据量伸缩性测试
   */
  async scalabilityTest<T>(
    testName: string,
    operationFactory: (dataSize: number) => () => Promise<T>,
    dataSizes: number[] = [1000, 10000, 100000, 500000]
  ): Promise<{
    results: BenchmarkResult[];
    scalability: 'linear' | 'logarithmic' | 'quadratic' | 'unknown';
    efficiency: number;
  }> {
    const results: BenchmarkResult[] = [];

    for (const size of dataSizes) {
      const operation = operationFactory(size);
      const result = await this.runBenchmark(`${testName}_Size${size}`, operation, 1);
      results.push(result);
    }

    // 分析伸缩性特征
    const scalability = this.analyzeScalability(dataSizes, results);
    const efficiency = this.calculateEfficiency(dataSizes, results);

    return {
      results,
      scalability,
      efficiency
    };
  }

  /**
   * 获取测试报告
   */
  getReport(): {
    summary: {
      totalTests: number;
      successfulTests: number;
      failedTests: number;
      averageDuration: number;
      totalDuration: number;
    };
    results: BenchmarkResult[];
    memoryAnalysis: {
      peakMemoryUsage: number;
      averageMemoryUsage: number;
      memoryGrowthTrend: boolean;
    };
  } {
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.length - successfulTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalDuration / this.results.length || 0;

    // 内存分析
    const memoryUsages = this.results.map(r => r.memoryUsage.heapUsed);
    const peakMemoryUsage = Math.max(...memoryUsages);
    const averageMemoryUsage = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length || 0;

    return {
      summary: {
        totalTests: this.results.length,
        successfulTests,
        failedTests,
        averageDuration,
        totalDuration
      },
      results: this.results,
      memoryAnalysis: {
        peakMemoryUsage,
        averageMemoryUsage,
        memoryGrowthTrend: this.isMemoryGrowthTrend()
      }
    };
  }

  /**
   * 导出性能报告为JSON
   */
  exportReport(): string {
    const report = this.getReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * 清理测试结果
   */
  clear(): void {
    this.results = [];
    this.memorySnapshots = [];
  }

  /**
   * 拍摄内存快照
   */
  private takeMemorySnapshot(): void {
    const memory = process.memoryUsage();
    this.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss
    });
  }

  /**
   * 检查内存增长趋势
   */
  private isMemoryGrowthTrend(): boolean {
    if (this.memorySnapshots.length < 3) return false;

    let growthCount = 0;
    for (let i = 1; i < this.memorySnapshots.length; i++) {
      if (this.memorySnapshots[i].heapUsed > this.memorySnapshots[i - 1].heapUsed) {
        growthCount++;
      }
    }

    // 如果超过70%的快照显示内存增长，认为存在增长趋势
    return growthCount / (this.memorySnapshots.length - 1) > 0.7;
  }

  /**
   * 分析算法复杂度/伸缩性
   */
  private analyzeScalability(
    dataSizes: number[], 
    results: BenchmarkResult[]
  ): 'linear' | 'logarithmic' | 'quadratic' | 'unknown' {
    if (results.length < 2) return 'unknown';

    const ratios: number[] = [];
    
    for (let i = 1; i < results.length; i++) {
      const sizeRatio = dataSizes[i] / dataSizes[i - 1];
      const timeRatio = results[i].duration / results[i - 1].duration;
      ratios.push(timeRatio / sizeRatio);
    }

    const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;

    if (avgRatio < 0.5) return 'logarithmic';
    if (avgRatio >= 0.8 && avgRatio <= 1.2) return 'linear';
    if (avgRatio > 1.5) return 'quadratic';
    
    return 'unknown';
  }

  /**
   * 计算效率指数
   */
  private calculateEfficiency(dataSizes: number[], results: BenchmarkResult[]): number {
    if (results.length === 0) return 0;

    // 计算每个数据点的效率（操作数/时间）
    const efficiencies = results.map((result, index) => {
      return dataSizes[index] / result.duration;
    });

    // 返回平均效率
    return efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
  }
}

/**
 * 性能测试断言
 */
export class PerformanceAssertions {
  /**
   * 断言执行时间在预期范围内
   */
  static assertExecutionTime(result: BenchmarkResult, maxDurationMs: number): void {
    if (result.duration > maxDurationMs) {
      throw new Error(
        `Performance assertion failed: ${result.testName} took ${result.duration}ms, expected < ${maxDurationMs}ms`
      );
    }
  }

  /**
   * 断言内存使用在预期范围内
   */
  static assertMemoryUsage(result: BenchmarkResult, maxMemoryMB: number): void {
    const memoryMB = result.memoryUsage.heapUsed / (1024 * 1024);
    if (memoryMB > maxMemoryMB) {
      throw new Error(
        `Memory assertion failed: ${result.testName} used ${memoryMB.toFixed(2)}MB, expected < ${maxMemoryMB}MB`
      );
    }
  }

  /**
   * 断言操作吞吐量在预期范围内
   */
  static assertThroughput(result: BenchmarkResult, minOpsPerSecond: number): void {
    if (result.opsPerSecond < minOpsPerSecond) {
      throw new Error(
        `Throughput assertion failed: ${result.testName} achieved ${result.opsPerSecond.toFixed(2)} ops/sec, expected >= ${minOpsPerSecond} ops/sec`
      );
    }
  }

  /**
   * 断言没有内存泄漏
   */
  static assertNoMemoryLeak(leakTestResult: {leaked: boolean, memoryGrowth: number}): void {
    if (leakTestResult.leaked) {
      const growthMB = leakTestResult.memoryGrowth / (1024 * 1024);
      throw new Error(
        `Memory leak detected: ${growthMB.toFixed(2)}MB growth detected`
      );
    }
  }

  /**
   * 断言伸缩性在预期范围内
   */
  static assertScalability(
    scalabilityResult: {scalability: string, efficiency: number},
    expectedScalability: string,
    minEfficiency: number
  ): void {
    if (scalabilityResult.scalability !== expectedScalability) {
      throw new Error(
        `Scalability assertion failed: got ${scalabilityResult.scalability}, expected ${expectedScalability}`
      );
    }

    if (scalabilityResult.efficiency < minEfficiency) {
      throw new Error(
        `Efficiency assertion failed: got ${scalabilityResult.efficiency.toFixed(2)}, expected >= ${minEfficiency}`
      );
    }
  }
}

/**
 * 性能测试助手函数
 */
export const PerformanceTestHelpers = {
  /**
   * 生成大数据集用于测试
   */
  generateLargeDataSet(size: number): string[] {
    const data: string[] = [];
    for (let i = 0; i < size; i++) {
      // 生成128位数据（32个十六进制字符）
      let value = BigInt(0);
      for (let bit = 0; bit < 32; bit++) {
        if (Math.random() > 0.5) {
          value |= BigInt(1) << BigInt(bit);
        }
      }
      data.push(value.toString(16).padStart(32, '0'));
    }
    return data;
  },

  /**
   * 创建CPU密集型任务
   */
  createCPUIntensiveTask(iterations: number): () => number {
    return () => {
      let result = 0;
      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i) * Math.sin(i);
      }
      return result;
    };
  },

  /**
   * 创建内存密集型任务
   */
  createMemoryIntensiveTask(arraySize: number): () => number[] {
    return () => {
      const array: number[] = [];
      for (let i = 0; i < arraySize; i++) {
        array.push(Math.random() * 1000);
      }
      return array;
    };
  },

  /**
   * 模拟异步I/O操作
   */
  simulateAsyncIO(delayMs: number): () => Promise<string> {
    return () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(`IO operation completed after ${delayMs}ms`);
        }, delayMs);
      });
    };
  }
};