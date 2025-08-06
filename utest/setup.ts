/**
 * Jest测试全局设置
 * 用于配置测试环境和全局变量
 */

// import 'jest-extended';

// 首先设置Vue全局对象和编译器
import * as Vue from 'vue';
import * as VueCompilerDOM from '@vue/compiler-dom';
import * as VueServerRenderer from '@vue/server-renderer';

// 设置Vue全局对象和编译器
(global as any).Vue = Vue;
(global as any).VueCompilerDOM = VueCompilerDOM;
(global as any).VueServerRenderer = VueServerRenderer;

// 设置完整的DOM环境
global.window = global.window || ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  innerWidth: 1024,
  innerHeight: 768,
  outerWidth: 1024,
  outerHeight: 768,
  scrollX: 0,
  scrollY: 0,
  pageXOffset: 0,
  pageYOffset: 0,
  localStorage: {
    getItem: jest.fn((key) => {
      const mockData: Record<string, string> = {
        'theme': 'light',
        'language': 'zh-CN',
        'layout-preset': '{"version": 1}'
      };
      return mockData[key] || null;
    }),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  performance: {
    now: jest.fn(() => Date.now() + Math.random()),
    mark: jest.fn(),
    measure: jest.fn()
  },
  requestAnimationFrame: jest.fn((callback) => {
    setTimeout(callback, 16);
    return Math.random();
  }),
  cancelAnimationFrame: jest.fn(),
  setTimeout: jest.fn((fn, ms) => {
    const id = Math.random();
    if (ms <= 100) {
      try { fn(); } catch (e) { /* ignore */ }
    }
    return id;
  }),
  clearTimeout: jest.fn(),
  setInterval: jest.fn(),
  clearInterval: jest.fn()
} as any);

global.document = global.document || ({
  documentElement: {
    lang: 'en',
    style: {}
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    style: {},
    clientWidth: 1024,
    clientHeight: 768
  },
  createElement: jest.fn(() => ({
    style: {},
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    getAttribute: jest.fn(),
    setAttribute: jest.fn(),
    getContext: jest.fn(() => ({
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
    })),
    width: 1920,
    height: 1080
  }))
} as any);

// 确保localStorage全局可用
global.localStorage = global.localStorage || {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// 完整的Vue 3测试环境设置
let config: any = {};
try {
  // 尝试导入Vue Test Utils配置
  const vueTestUtils = require('@vue/test-utils');
  config = vueTestUtils.config || {};
  
  // 确保config.global存在
  if (!config.global) {
    config.global = {};
  }
  
  // 配置Vue Test Utils全局配置
  config.global.mocks = {
    // Element Plus组件模拟
    $message: {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn()
    },
    $loading: {
      service: jest.fn(() => ({
        close: jest.fn()
      }))
    },
    $confirm: jest.fn(() => Promise.resolve()),
    $alert: jest.fn(() => Promise.resolve()),
    
    // Vue Router模拟
    $router: {
      push: jest.fn(),
      replace: jest.fn(),
      go: jest.fn(),
      back: jest.fn(),
      forward: jest.fn()
    },
    $route: {
      path: '/',
      name: 'test',
      params: {},
      query: {},
      meta: {}
    },
    
    // i18n模拟
    $t: jest.fn((key: string) => key),
    $tc: jest.fn((key: string) => key),
    $te: jest.fn(() => true),
    $d: jest.fn((value: any) => value),
    $n: jest.fn((value: any) => value)
  };

  // 配置全局组件模拟
  config.global.stubs = {
    // Element Plus组件存根
    'el-button': true,
    'el-input': true,
    'el-select': true,
    'el-dropdown': true,
    'el-dropdown-menu': true,
    'el-dropdown-item': true,
    'el-icon': true,
    'el-message': true,
    'el-dialog': true,
    'el-table': true,
    'el-table-column': true,
    'el-pagination': true,
    'el-form': true,
    'el-form-item': true,
    'el-loading': true,
    
    // 自定义组件存根
    'router-link': true,
    'router-view': true,
    'transition': false,
    'transition-group': false
  };

  // 配置全局插件
  config.global.plugins = [];

  // 设置Vue全局对象
  (global as any).Vue = require('vue');
  
} catch (e) {
  console.warn('Vue test configuration failed:', e);
}

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

// 确保requestAnimationFrame全局可用
global.requestAnimationFrame = global.requestAnimationFrame || global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.cancelAnimationFrame || global.window.cancelAnimationFrame;

// 模拟Path2D构造函数
global.Path2D = global.Path2D || jest.fn().mockImplementation(() => ({
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  quadraticCurveTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  closePath: jest.fn(),
  rect: jest.fn(),
  ellipse: jest.fn(),
  addPath: jest.fn()
}));

// 增强的事件Mock
global.MouseEvent = global.MouseEvent || jest.fn().mockImplementation((type, options = {}) => ({
  type,
  button: options.button || 0,
  buttons: options.buttons || 0,
  clientX: options.clientX || 0,
  clientY: options.clientY || 0,
  screenX: options.screenX || 0,
  screenY: options.screenY || 0,
  ctrlKey: options.ctrlKey || false,
  shiftKey: options.shiftKey || false,
  altKey: options.altKey || false,
  metaKey: options.metaKey || false,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  stopImmediatePropagation: jest.fn(),
  target: options.target || null,
  currentTarget: options.currentTarget || null
}));

global.KeyboardEvent = global.KeyboardEvent || jest.fn().mockImplementation((type, options = {}) => ({
  type,
  key: options.key || '',
  keyCode: options.keyCode || 0,
  which: options.which || options.keyCode || 0,
  ctrlKey: options.ctrlKey || false,
  shiftKey: options.shiftKey || false,
  altKey: options.altKey || false,
  metaKey: options.metaKey || false,
  repeat: options.repeat || false,
  code: options.code || '',
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  stopImmediatePropagation: jest.fn(),
  target: options.target || null,
  currentTarget: options.currentTarget || null
}));

global.WheelEvent = global.WheelEvent || jest.fn().mockImplementation((type, options = {}) => ({
  type,
  deltaX: options.deltaX || 0,
  deltaY: options.deltaY || 0,
  deltaZ: options.deltaZ || 0,
  deltaMode: options.deltaMode || 0,
  clientX: options.clientX || 0,
  clientY: options.clientY || 0,
  ctrlKey: options.ctrlKey || false,
  shiftKey: options.shiftKey || false,
  altKey: options.altKey || false,
  metaKey: options.metaKey || false,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: options.target || null,
  currentTarget: options.currentTarget || null
}));

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