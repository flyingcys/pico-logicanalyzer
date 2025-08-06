/**
 * 测试环境全局设置
 * 基于utest/setup.ts，为decoders测试提供必要的环境配置
 */

// 模拟Performance API
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    clearMarks: () => {},
    clearMeasures: () => {},
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    }
  } as any;
}

// 设置测试超时
jest.setTimeout(30000);

// 全局错误处理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// 清理每个测试之间的状态
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  
  // 清理任何可能的内存泄漏
  if (global.gc) {
    global.gc();
  }
});

// 全局测试工具
global.waitFor = (condition: () => boolean, timeout: number = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
};

// 异步延迟工具
global.delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 性能测试工具
global.measureTime = async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();
  return {
    result,
    duration: endTime - startTime
  };
};

export {};