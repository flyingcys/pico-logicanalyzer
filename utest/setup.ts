/**
 * Jest测试全局设置 - 修复版本
 * 修复了 Mock 对象的类型定义问题
 */

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
    clear: jest.fn(),
    length: 0,
    key: jest.fn().mockReturnValue(null)
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn().mockReturnValue(null)
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

// 修复 localStorage 全局对象
global.localStorage = global.localStorage || {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn().mockReturnValue(null)
} as Storage;

// 修复 KeyboardEvent Mock
global.KeyboardEvent = class MockKeyboardEvent extends Event {
  static readonly DOM_KEY_LOCATION_STANDARD = 0;
  static readonly DOM_KEY_LOCATION_LEFT = 1;
  static readonly DOM_KEY_LOCATION_RIGHT = 2;
  static readonly DOM_KEY_LOCATION_NUMPAD = 3;
  
  key: string;
  keyCode: number;
  which: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  code: string;
  
  constructor(type: string, eventInitDict?: KeyboardEventInit) {
    super(type, eventInitDict);
    this.key = eventInitDict?.key || '';
    this.keyCode = eventInitDict?.keyCode || 0;
    this.which = this.keyCode;
    this.ctrlKey = eventInitDict?.ctrlKey || false;
    this.shiftKey = eventInitDict?.shiftKey || false;
    this.altKey = eventInitDict?.altKey || false;
    this.metaKey = eventInitDict?.metaKey || false;
    this.repeat = eventInitDict?.repeat || false;
    this.code = eventInitDict?.code || '';
  }
} as any;

// 修复 WheelEvent Mock
global.WheelEvent = class MockWheelEvent extends Event {
  static readonly DOM_DELTA_PIXEL = 0;
  static readonly DOM_DELTA_LINE = 1;
  static readonly DOM_DELTA_PAGE = 2;
  
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  deltaMode: number;
  clientX: number;
  clientY: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  
  constructor(type: string, eventInitDict?: WheelEventInit) {
    super(type, eventInitDict);
    this.deltaX = eventInitDict?.deltaX || 0;
    this.deltaY = eventInitDict?.deltaY || 0;
    this.deltaZ = eventInitDict?.deltaZ || 0;
    this.deltaMode = eventInitDict?.deltaMode || 0;
    this.clientX = eventInitDict?.clientX || 0;
    this.clientY = eventInitDict?.clientY || 0;
    this.ctrlKey = eventInitDict?.ctrlKey || false;
    this.shiftKey = eventInitDict?.shiftKey || false;
    this.altKey = eventInitDict?.altKey || false;
    this.metaKey = eventInitDict?.metaKey || false;
  }
} as any;

// 修复 MouseEvent Mock
global.MouseEvent = class MockMouseEvent extends Event {
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  
  constructor(type: string, options: any = {}) {
    super(type, options);
    this.button = options.button || 0;
    this.buttons = options.buttons || 0;
    this.clientX = options.clientX || 0;
    this.clientY = options.clientY || 0;
    this.screenX = options.screenX || 0;
    this.screenY = options.screenY || 0;
    this.ctrlKey = options.ctrlKey || false;
    this.shiftKey = options.shiftKey || false;
    this.altKey = options.altKey || false;
    this.metaKey = options.metaKey || false;
  }
} as any;

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

// 清理每个测试之间的状态
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
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

export {};
