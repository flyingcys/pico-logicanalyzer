import * as Vue from 'vue';
import * as VueCompilerDOM from '@vue/compiler-dom';
import * as VueServerRenderer from '@vue/server-renderer';

(global as any).Vue = Vue;
(global as any).VueCompilerDOM = VueCompilerDOM;
(global as any).VueServerRenderer = VueServerRenderer;

if (!global.localStorage) {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn().mockReturnValue(null)
  } as Storage;
}

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

(global as any).ResizeObserver = MockResizeObserver;

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => ({
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
    }))
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: jest.fn(() => ({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      left: 0,
      right: 1280,
      bottom: 720,
      toJSON: () => ({})
    }))
  });
}

afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
