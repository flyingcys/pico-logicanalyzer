/**
 * 单元测试基础框架
 * P0-P1层核心单元测试的统一基类
 */

export abstract class UnitTestBase {
  protected readonly timeout = 30000; // 30秒超时
  protected testStartTime: number = 0;
  
  protected beforeEach(): void {
    this.testStartTime = Date.now();
  }
  
  protected afterEach(): void {
    const duration = Date.now() - this.testStartTime;
    if (duration > 5000) { // 5秒警告
      console.warn(`⚠️ 测试执行时间过长: ${duration}ms`);
    }
  }
  
  // 标准化断言方法
  protected assertSuccess(result: { success: boolean; error?: string }): void {
    if (!result.success) {
      throw new Error(`操作失败: ${result.error || '未知错误'}`);
    }
  }
  
  // 标准化错误检查
  protected assertError(result: { success: boolean; error?: string }, expectedError: string): void {
    expect(result.success).toBe(false);
    expect(result.error).toContain(expectedError);
  }
  
  // 统一的Mock清理
  protected cleanupMocks(): void {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  }
  
  // 内存使用检查
  protected checkMemoryUsage(maxGrowthMB: number = 10): void {
    if (global.gc) {
      global.gc();
    }
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > maxGrowthMB) {
      console.warn(`⚠️ 内存使用较高: ${heapUsedMB.toFixed(2)}MB`);
    }
  }
  
  // 性能检查
  protected async measurePerformance<T>(
    operation: () => Promise<T>,
    maxDurationMs: number = 1000
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;
    
    if (duration > maxDurationMs) {
      console.warn(`⚠️ 操作耗时过长: ${duration.toFixed(2)}ms`);
    }
    
    return { result, duration };
  }
}