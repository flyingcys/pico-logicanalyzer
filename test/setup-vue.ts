/**
 * Vue组件测试设置
 * 用于Webview相关的Vue组件测试
 */

import { config } from '@vue/test-utils';
import { createPinia } from 'pinia';

// 配置Vue Test Utils
config.global.plugins = [createPinia()];

// Mock Element Plus组件
const mockElementPlus = {
  ElButton: { name: 'ElButton', template: '<button><slot /></button>' },
  ElInput: { name: 'ElInput', template: '<input />' },
  ElSelect: { name: 'ElSelect', template: '<select><slot /></select>' },
  ElOption: { name: 'ElOption', template: '<option><slot /></option>' },
  ElForm: { name: 'ElForm', template: '<form><slot /></form>' },
  ElFormItem: { name: 'ElFormItem', template: '<div><slot /></div>' },
  ElTable: { name: 'ElTable', template: '<table><slot /></table>' },
  ElTableColumn: { name: 'ElTableColumn', template: '<td><slot /></td>' },
  ElDialog: { name: 'ElDialog', template: '<div><slot /></div>' },
  ElCard: { name: 'ElCard', template: '<div class="el-card"><slot /></div>' },
  ElTabs: { name: 'ElTabs', template: '<div class="el-tabs"><slot /></div>' },
  ElTabPane: { name: 'ElTabPane', template: '<div class="el-tab-pane"><slot /></div>' },
  ElCheckbox: { name: 'ElCheckbox', template: '<input type="checkbox" />' },
  ElRadio: { name: 'ElRadio', template: '<input type="radio" />' },
  ElSlider: { name: 'ElSlider', template: '<div class="el-slider"></div>' },
  ElProgress: { name: 'ElProgress', template: '<div class="el-progress"></div>' }
};

// 注册全局组件
config.global.components = mockElementPlus;

// Mock Canvas API
const mockCanvas = {
  getContext: jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 10 })),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    translate: jest.fn()
  })),
  toDataURL: jest.fn(() => 'data:image/png;base64,'),
  width: 800,
  height: 600
};

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: mockCanvas.getContext
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: mockCanvas.toDataURL
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock VSCode Webview API
(global as any).acquireVsCodeApi = jest.fn(() => ({
  postMessage: jest.fn(),
  setState: jest.fn(),
  getState: jest.fn(() => ({}))
}));

// 测试工具函数
export function createMockCanvasContext() {
  return mockCanvas.getContext();
}

export function createMockWaveformData(channels: number = 8, samples: number = 1000) {
  const data = [];
  for (let ch = 0; ch < channels; ch++) {
    const channelData = new Uint8Array(samples);
    for (let i = 0; i < samples; i++) {
      // 生成模拟波形数据
      channelData[i] = Math.random() > 0.5 ? 1 : 0;
    }
    data.push({
      channelNumber: ch,
      channelName: `CH${ch}`,
      hidden: false,
      samples: channelData
    });
  }
  return data;
}

export function createMockPiniaStore() {
  return createPinia();
}

// Vue组件测试辅助函数
export function mountWithProviders(component: any, options: any = {}) {
  const { mount } = require('@vue/test-utils');
  
  return mount(component, {
    global: {
      plugins: [createPinia()],
      components: mockElementPlus,
      ...options.global
    },
    ...options
  });
}

// 等待Vue组件更新完成
export async function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// 模拟用户交互
export function simulateUserInput(wrapper: any, selector: string, value: any) {
  const element = wrapper.find(selector);
  element.setValue(value);
  element.trigger('input');
  element.trigger('change');
  return flushPromises();
}

export function simulateClick(wrapper: any, selector: string) {
  const element = wrapper.find(selector);
  element.trigger('click');
  return flushPromises();
}