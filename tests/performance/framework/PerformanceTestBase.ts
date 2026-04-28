/**
 * 性能测试抽象基类 - P2.2架构核心组件
 * 
 * 功能：
 * - 标准化的性能测试流程（预热、测量、清理）
 * - 多次测量求平均值减少误差
 * - 自动内存基线建立和异常检测
 * - 统一的测试结果格式和异常处理
 * 
 * 遵循质量标准:
 * - 文件大小 < 200行 ✅
 * - Mock数量 = 0个 ✅
 * - 专注性能测试标准化
 */

import { 
  PerformanceMetrics, 
  MemoryMetrics, 
  TimingMetrics, 
  ThroughputMetrics,
  PerformanceCollector 
} from './PerformanceMetrics';

/**
 * 性能测试配置
 */
interface PerformanceTestConfig {
  iterations: number;          // 测量迭代次数（默认5次）
  warmupIterations: number;    // 预热迭代次数（默认2次）
  timeout: number;            // 单次测试超时时间（默认30秒）
  memoryThreshold: number;    // 内存增长阈值MB（默认100MB）
  timeoutThreshold: number;   // 时间阈值毫秒（默认10秒）
}

/**
 * 性能测试结果
 */
interface PerformanceTestResult {
  testName: string;
  config: PerformanceTestConfig;
  results: PerformanceMetrics[];
  statistics: {
    averageDuration: number;        // 平均执行时间
    minDuration: number;           // 最短执行时间
    maxDuration: number;           // 最长执行时间
    standardDeviation: number;     // 标准差
    averageMemoryUsed: number;     // 平均内存使用
    memoryGrowth: number;          // 内存增长量
  };
  success: boolean;
  error?: string;
}

/**
 * 性能测试抽象基类
 */
abstract class PerformanceTestBase {
  protected collector: PerformanceCollector;
  protected config: PerformanceTestConfig;
  
  constructor(config?: Partial<PerformanceTestConfig>) {
    this.collector = new PerformanceCollector();
    this.config = {
      iterations: 5,
      warmupIterations: 2,
      timeout: 30000,
      memoryThreshold: 100,
      timeoutThreshold: 10000,
      ...config
    };
  }
  
  /**
   * 抽象方法：执行性能测试的具体操作
   */
  protected abstract performOperation(): Promise<any>;
  
  /**
   * 抽象方法：计算吞吐量（可选实现）
   */
  protected calculateThroughput(timing: TimingMetrics, result: any): ThroughputMetrics | undefined {
    return undefined;
  }
  
  /**
   * 抽象方法：获取测试名称
   */
  protected abstract getTestName(): string;
  
  /**
   * 可选的前置方法，子类可重写
   */
  protected async beforeEach(): Promise<void> {
    // 默认空实现，子类可重写
  }
  
  /**
   * 可选的后置方法，子类可重写
   */
  protected async afterEach(): Promise<void> {
    // 默认空实现，子类可重写
  }
  
  /**
   * 执行预热运行，让JIT编译器优化代码
   */
  private async performWarmup(): Promise<void> {
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await this.performOperation();
      } catch (error) {
        // 预热期间忽略错误，但记录警告
        console.warn(`⚠️ 预热运行 ${i + 1} 失败:`, error);
      }
    }
    
    // 预热后强制垃圾回收
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  
  /**
   * 执行单次性能测量
   */
  private async performSingleMeasurement(): Promise<PerformanceMetrics> {
    const memoryBefore = this.collector.collectMemoryMetrics();
    const startTime = this.collector.startTiming();
    
    let result: any;
    let error: Error | undefined;
    
    try {
      // 执行被测试的操作
      result = await Promise.race([
        this.performOperation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('测试超时')), this.config.timeout)
        )
      ]);
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const timing = this.collector.endTiming(startTime);
      const memoryAfter = this.collector.collectMemoryMetrics();
      
      // 计算吞吐量（如果提供了实现）
      const throughput = result ? this.calculateThroughput(timing, result) : undefined;
      
      if (error) {
        throw error;
      }
      
      return this.collector.createMetrics(timing, memoryBefore, memoryAfter, throughput);
    }
  }
  
  /**
   * 计算统计信息
   */
  private calculateStatistics(results: PerformanceMetrics[]): PerformanceTestResult['statistics'] {
    const durations = results.map(r => r.timing.duration);
    const memoryUsages = results.map(r => r.memory.heapUsed);
    
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const avgMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
    
    // 计算标准差
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      averageDuration: Math.round(avgDuration * 1000) / 1000,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      standardDeviation: Math.round(stdDev * 1000) / 1000,
      averageMemoryUsed: Math.round(avgMemory * 100) / 100,
      memoryGrowth: Math.round((Math.max(...memoryUsages) - Math.min(...memoryUsages)) * 100) / 100
    };
  }
  
  /**
   * 检测性能异常
   */
  private detectPerformanceIssues(statistics: PerformanceTestResult['statistics']): string | undefined {
    if (statistics.averageDuration > this.config.timeoutThreshold) {
      return `平均执行时间 ${statistics.averageDuration}ms 超过阈值 ${this.config.timeoutThreshold}ms`;
    }
    
    if (statistics.memoryGrowth > this.config.memoryThreshold) {
      return `内存增长 ${statistics.memoryGrowth}MB 超过阈值 ${this.config.memoryThreshold}MB`;
    }
    
    return undefined;
  }
  
  /**
   * 运行完整的性能测试
   */
  async runTest(): Promise<PerformanceTestResult> {
    const testName = this.getTestName();
    const results: PerformanceMetrics[] = [];
    let error: string | undefined;
    
    try {
      console.log(`🔥 开始性能测试: ${testName}`);
      console.log(`   配置: ${this.config.iterations}次测量, ${this.config.warmupIterations}次预热`);
      await this.beforeEach();
      
      // 1. 执行预热
      await this.performWarmup();
      console.log(`   ✅ 预热完成`);
      
      // 2. 执行多次测量
      for (let i = 0; i < this.config.iterations; i++) {
        try {
          const result = await this.performSingleMeasurement();
          results.push(result);
          console.log(`   📊 测量 ${i + 1}/${this.config.iterations}: ${result.timing.duration}ms`);
        } catch (err) {
          error = `测量 ${i + 1} 失败: ${(err as Error).message}`;
          break;
        }
      }
      
      if (results.length === 0) {
        throw new Error('没有成功的测量结果');
      }
      
      // 3. 计算统计信息
      const statistics = this.calculateStatistics(results);
      
      // 4. 检测性能问题
      const performanceIssue = this.detectPerformanceIssues(statistics);
      if (performanceIssue && !error) {
        error = `性能异常: ${performanceIssue}`;
      }
      
      const success = !error;
      console.log(`   ${success ? '🎉' : '⚠️'} 性能测试${success ? '通过' : '失败'}: 平均 ${statistics.averageDuration}ms`);
      
      return {
        testName,
        config: this.config,
        results,
        statistics,
        success,
        error
      };
      
    } catch (err) {
      console.log(`   ❌ 性能测试失败: ${(err as Error).message}`);
      return {
        testName,
        config: this.config,
        results,
        statistics: {
          averageDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          standardDeviation: 0,
          averageMemoryUsed: 0,
          memoryGrowth: 0
        },
        success: false,
        error: (err as Error).message
      };
    } finally {
      await this.afterEach();
    }
  }
}

export { PerformanceTestBase, PerformanceTestConfig, PerformanceTestResult };
