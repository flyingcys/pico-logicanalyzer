/**
 * 测试环境设置文件
 * 为所有测试提供统一的环境配置
 */

// 设置全局测试超时时间
jest.setTimeout(30000);

// 模拟性能API（如果在Node.js环境中不存在）
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000
    }
  } as any;
}

// 模拟console方法以避免测试输出噪音
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// 模拟Web API (如果需要)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// 设置测试环境变量
process.env.NODE_ENV = 'test';