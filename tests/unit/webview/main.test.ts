/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateApp = vi.fn();
const mockUse = vi.fn();
const mockMount = vi.fn();
const mockProvide = vi.fn();
const mockReady = vi.fn();
const mockCreateVsCodeHost = vi.fn();
const mockReadVsCodeBootstrap = vi.fn();

vi.mock('vue', () => ({
  createApp: mockCreateApp
}));

vi.mock('pinia', () => ({
  createPinia: vi.fn(() => ({
    install: vi.fn(),
    _plugin: 'pinia'
  }))
}));

vi.mock('element-plus', () => ({
  __esModule: true,
  default: {
    install: vi.fn(),
    _plugin: 'element-plus'
  }
}));

vi.mock('element-plus/dist/index.css', () => ({}));

vi.mock('../../../src/frontend/shared/i18n', () => ({
  __esModule: true,
  default: {
    install: vi.fn(),
    _plugin: 'i18n'
  }
}));

vi.mock('../../../src/frontend/app/App.vue', () => ({
  __esModule: true,
  default: {
    name: 'App'
  }
}));

vi.mock('../../../src/frontend/platform/host/vscodeHost', () => ({
  createVsCodeHost: mockCreateVsCodeHost,
  readVsCodeBootstrap: mockReadVsCodeBootstrap
}));

describe('frontend vscode 入口', () => {
  let mockApp: any;
  let host: any;
  let bootstrap: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    document.body.innerHTML = '<div id="app"></div>';

    mockApp = {
      use: mockUse,
      mount: mockMount,
      provide: mockProvide
    };

    host = {
      ready: mockReady,
      loadInitialDocument: jest.fn(),
      saveDocument: jest.fn(),
      exportData: jest.fn(),
      connectDevice: jest.fn(),
      startCapture: jest.fn(),
      sendCommand: jest.fn(),
      onMessage: jest.fn()
    };

    bootstrap = {
      host: 'vscode',
      document: {
        uri: 'file:///tmp/test.lac',
        fileName: 'test.lac',
        content: '{"channels":[]}'
      },
      capabilities: {
        canSave: true,
        canExport: true,
        canStartCapture: true,
        canConnectDevice: true
      }
    };

    mockCreateApp.mockReturnValue(mockApp);
    mockCreateVsCodeHost.mockReturnValue(host);
    mockReadVsCodeBootstrap.mockReturnValue(bootstrap);
  });

  it('应创建应用并按顺序安装插件、注入上下文、挂载到 #app', async () => {
    await import('../../../src/frontend/app/main-vscode');

    expect(mockCreateVsCodeHost).toHaveBeenCalledTimes(1);
    expect(mockReadVsCodeBootstrap).toHaveBeenCalledTimes(1);
    expect(mockCreateApp).toHaveBeenCalledTimes(1);

    expect(mockUse).toHaveBeenCalledTimes(3);
    expect(mockUse.mock.calls[0][0]).toHaveProperty('_plugin', 'pinia');
    expect(mockUse.mock.calls[1][0]).toHaveProperty('_plugin', 'element-plus');
    expect(mockUse.mock.calls[2][0]).toHaveProperty('_plugin', 'i18n');

    expect(mockProvide).toHaveBeenCalledWith('host', host);
    expect(mockProvide).toHaveBeenCalledWith('bootstrap', bootstrap);
    expect(mockMount).toHaveBeenCalledWith('#app');
  });

  it('应在挂载后调用 host.ready()', async () => {
    const callOrder: string[] = [];

    mockMount.mockImplementation(() => {
      callOrder.push('mount');
    });

    mockReady.mockImplementation(() => {
      callOrder.push('ready');
    });

    await import('../../../src/frontend/app/main-vscode');

    expect(callOrder).toEqual(['mount', 'ready']);
  });
});

describe('vscodeHost 实现', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as typeof window & { __FRONTEND_BOOTSTRAP__?: unknown }).__FRONTEND_BOOTSTRAP__;
    delete (window as typeof window & { vscode?: unknown }).vscode;
  });

  it('应优先从统一 bootstrap 读取初始文档与能力', async () => {
    const actual = await vi.importActual<typeof import('../../../src/frontend/platform/host/vscodeHost')>(
      '../../../src/frontend/platform/host/vscodeHost'
    );

    window.__FRONTEND_BOOTSTRAP__ = {
      host: 'vscode',
      document: {
        uri: 'file:///tmp/demo.lac',
        fileName: 'demo.lac',
        content: '{"frames":[]}'
      },
      capabilities: {
        canSave: true,
        canExport: true,
        canStartCapture: true,
        canConnectDevice: true
      }
    };

    expect(actual.readVsCodeBootstrap()).toEqual(window.__FRONTEND_BOOTSTRAP__);
  });

  it('ready 应仅通过 HostAdapter 调用 vscode.postMessage', async () => {
    const postMessage = vi.fn();
    const actual = await vi.importActual<typeof import('../../../src/frontend/platform/host/vscodeHost')>(
      '../../../src/frontend/platform/host/vscodeHost'
    );

    window.vscode = {
      postMessage
    };

    actual.createVsCodeHost().ready();

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
  });
});
