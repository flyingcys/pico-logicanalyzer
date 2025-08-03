/**
 * Jest测试全局设置
 * 用于配置测试环境和全局变量
 */

// import 'jest-extended';

// 模拟Performance API
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    clearMarks: () => {},
    clearMeasures: () => {}
  } as any;
}

// 模拟Canvas API用于波形渲染测试
class MockCanvas {
  width = 1920;
  height = 1080;
  
  getContext(contextId: string) {
    if (contextId === '2d') {
      return {
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fillText: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        scale: jest.fn(),
        translate: jest.fn(),
        strokeStyle: '#000000',
        fillStyle: '#000000',
        lineWidth: 1,
        font: '12px Arial'
      };
    }
    return null;
  }
}

// 模拟HTMLCanvasElement
if (typeof window !== 'undefined') {
  window.HTMLCanvasElement = MockCanvas as any;
} else {
  global.HTMLCanvasElement = MockCanvas as any;
}

// 模拟DOM APIs
if (typeof document !== 'undefined') {
  document.createElement = jest.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return new MockCanvas() as any;
    }
    return {
      style: {},
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      getAttribute: jest.fn(),
      setAttribute: jest.fn()
    } as any;
  });
}

// 设置测试超时
jest.setTimeout(10000);

// 全局错误处理
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// 禁用console.warn在测试中的输出（避免干扰测试结果）
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
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