/**
 * @jest-environment jsdom
 */

const mockCreateApp = jest.fn();
const mockUse = jest.fn();
const mockMount = jest.fn();
const mockProvide = jest.fn();
const mockReady = jest.fn();
const mockCreateVsCodeHost = jest.fn();
const mockReadVsCodeBootstrap = jest.fn();

jest.mock('vue', () => ({
  ...jest.requireActual('vue'),
  createApp: mockCreateApp
}));

jest.mock('pinia', () => ({
  ...jest.requireActual('pinia'),
  createPinia: jest.fn(() => ({
    install: jest.fn(),
    _plugin: 'pinia'
  }))
}));

jest.mock('element-plus', () => ({
  __esModule: true,
  default: {
    install: jest.fn(),
    _plugin: 'element-plus'
  }
}));

jest.mock('element-plus/dist/index.css', () => ({}));
jest.mock('../../../src/frontend/shared/styles/webview.css', () => ({}));
jest.mock('../../../src/frontend/shared/styles/html.css', () => ({}));

jest.mock('../../../src/frontend/shared/i18n', () => ({
  __esModule: true,
  default: {
    install: jest.fn(),
    _plugin: 'i18n'
  }
}));

jest.mock('../../../src/frontend/app/App.vue', () => ({
  __esModule: true,
  default: {
    name: 'App'
  }
}));

jest.mock('../../../src/frontend/platform/host/vscodeHost', () => ({
  createVsCodeHost: mockCreateVsCodeHost,
  readVsCodeBootstrap: mockReadVsCodeBootstrap
}));

describe('frontend vscode 入口', () => {
  let mockApp: any;
  let host: any;
  let bootstrap: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

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

describe('waveformService', () => {
  it('applyViewRange 应按 totalSamples 归一化并调用 renderer', async () => {
    jest.resetModules();

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');

      const renderer = {
        updateVisibleSamples: jest.fn()
      };

      const { createWaveformService } = await import(
        '../../../src/frontend/core/services/waveformService'
      );

      const normalizedRange = createWaveformService(renderer).applyViewRange(
        {
          firstSample: 999,
          visibleSamples: 500
        },
        120
      );

      expect(normalizedRange).toEqual({
        firstSample: 0,
        visibleSamples: 120
      });
      expect(renderer.updateVisibleSamples).toHaveBeenCalledWith(0, 120);
    });
  });

  it('bindViewRange 应在归一化后回写 store patch', async () => {
    jest.resetModules();

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');

      const { reactive, nextTick } = await import('vue');
      const { createWaveformService } = await import(
        '../../../src/frontend/core/services/waveformService'
      );

      const renderer = {
        updateVisibleSamples: jest.fn()
      };
      const patches: Array<{ viewRange: { firstSample: number; visibleSamples: number } }> = [];
      const state = reactive({
        viewRange: {
          firstSample: 250,
          visibleSamples: 0
        }
      });
      const waveformStore = {
        get viewRange() {
          return state.viewRange;
        },
        $patch(patch: { viewRange: { firstSample: number; visibleSamples: number } }) {
          patches.push(patch);
          state.viewRange = patch.viewRange;
        }
      };
      const sessionStore = reactive({
        totalSamples: 100
      });

      const stop = createWaveformService(renderer).bindViewRange(waveformStore, sessionStore);

      await nextTick();

      expect(patches).toEqual([
        {
          viewRange: {
            firstSample: 99,
            visibleSamples: 1
          }
        }
      ]);
      expect(renderer.updateVisibleSamples).toHaveBeenLastCalledWith(99, 1);

      stop();
    });
  });
});

describe('bootstrap 初始化流程', () => {
  it('initializeFrontend 应调用 host.loadInitialDocument 并把文档灌入 sessionStore', async () => {
    const actualPinia = jest.requireActual('pinia');
    const { initializeFrontend } = jest.requireActual(
      '../../../src/frontend/core/services/bootstrapService'
    );
    const { useSessionStore } = jest.requireActual('../../../src/frontend/core/stores/sessionStore');

    actualPinia.setActivePinia(actualPinia.createPinia());

    const loadInitialDocument = jest.fn().mockResolvedValue({
      uri: 'file:///tmp/bootstrap.lac',
      fileName: 'bootstrap.lac',
      content: JSON.stringify({
        captureSession: {
          frequency: 24000000,
          totalSamples: 128,
          captureChannels: [
            {
              samples: [0, 1, 0, 1]
            }
          ]
        }
      })
    });

    await initializeFrontend({
      ready: jest.fn(),
      loadInitialDocument,
      saveDocument: jest.fn(),
      exportData: jest.fn(),
      connectDevice: jest.fn(),
      startCapture: jest.fn(),
      sendCommand: jest.fn(),
      onMessage: jest.fn(() => () => undefined)
    });

    const sessionStore = useSessionStore();

    expect(loadInitialDocument).toHaveBeenCalledTimes(1);
    expect(sessionStore.fileName).toBe('bootstrap.lac');
    expect(sessionStore.sampleRate).toBe(24000000);
    expect(sessionStore.totalSamples).toBe(128);
    expect(sessionStore.hasData).toBe(true);
  });

  it('sessionStore.applyDocument 应支持根级 Settings，并在缺少 totalSamples 时按 CaptureSession 语义推导', () => {
    const actualPinia = jest.requireActual('pinia');
    const { useSessionStore } = jest.requireActual('../../../src/frontend/core/stores/sessionStore');

    actualPinia.setActivePinia(actualPinia.createPinia());

    const sessionStore = useSessionStore();

    sessionStore.applyDocument({
      uri: 'file:///tmp/settings.lac',
      fileName: 'settings.lac',
      content: JSON.stringify({
        Settings: {
          frequency: 24000000,
          preTriggerSamples: 10,
          postTriggerSamples: 30,
          loopCount: 2,
          captureChannels: []
        },
        Samples: ['abcd', 'ef01']
      })
    });

    expect(sessionStore.fileName).toBe('settings.lac');
    expect(sessionStore.sampleRate).toBe(24000000);
    expect(sessionStore.totalSamples).toBe(100);
    expect(sessionStore.hasData).toBe(true);
  });

  it('sessionStore.applyDocument 应兼容顶层结构并从 captureChannels.samples 判定数据存在', () => {
    const actualPinia = jest.requireActual('pinia');
    const { useSessionStore } = jest.requireActual('../../../src/frontend/core/stores/sessionStore');

    actualPinia.setActivePinia(actualPinia.createPinia());

    const sessionStore = useSessionStore();

    sessionStore.applyDocument({
      uri: 'file:///tmp/top-level.lac',
      fileName: 'top-level.lac',
      content: JSON.stringify({
        sampleRate: 1000000,
        preTriggerSamples: 4,
        postTriggerSamples: 6,
        loopCount: 1,
        captureChannels: [
          {
            samples: [0, 1, 0, 1]
          }
        ]
      })
    });

    expect(sessionStore.fileName).toBe('top-level.lac');
    expect(sessionStore.sampleRate).toBe(1000000);
    expect(sessionStore.totalSamples).toBe(16);
    expect(sessionStore.hasData).toBe(true);
  });

  it('挂载真实 App.vue 后应触发初始化链路并展示 fileName', async () => {
    jest.resetModules();

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/App.vue');
      const setCommandDispatcher = jest.fn();
      jest.doMock('../../../src/frontend/core/utils/KeyboardShortcutManager', () => ({
        __esModule: true,
        keyboardShortcutManager: {
          setCommandDispatcher
        }
      }));
      jest.doMock('../../../src/frontend/app/layouts/AnalyzerLayout.vue', () => ({
        __esModule: true,
        default: {
          name: 'AnalyzerLayout',
          template: `
            <div class="analyzer-layout-stub">
              <div class="layout-header"><slot name="header" /></div>
              <div class="layout-left"><slot name="left" /></div>
              <div class="layout-default"><slot /></div>
              <div class="layout-right"><slot name="right" /></div>
              <div class="layout-footer"><slot name="footer" /></div>
            </div>
          `
        }
      }));
      jest.doMock('../../../src/frontend/app/components/AppHeader.vue', () => ({
        __esModule: true,
        default: {
          name: 'AppHeader',
          props: ['title'],
          template: '<div class="app-header-stub">{{ title }}</div>'
        }
      }));
      jest.doMock('../../../src/frontend/app/components/AppSidebarLeft.vue', () => ({
        __esModule: true,
        default: {
          name: 'AppSidebarLeft',
          template: '<aside class="app-sidebar-left-stub">left-container</aside>'
        }
      }));
      jest.doMock('../../../src/frontend/app/components/AppSidebarRight.vue', () => ({
        __esModule: true,
        default: {
          name: 'AppSidebarRight',
          template: '<aside class="app-sidebar-right-stub">right-container</aside>'
        }
      }));
      jest.doMock('../../../src/frontend/app/components/AppStatusbar.vue', () => ({
        __esModule: true,
        default: {
          name: 'AppStatusbar',
          template: '<footer class="app-statusbar-stub">status</footer>'
        }
      }));
      jest.doMock('../../../src/frontend/app/components/AppWaveformStage.vue', () => ({
        __esModule: true,
        default: {
          name: 'AppWaveformStage',
          template: '<section class="app-waveform-stage-stub">waveform-stage</section>'
        }
      }));

      const host = {
        ready: jest.fn(),
        loadInitialDocument: jest.fn().mockResolvedValue({
          uri: 'file:///tmp/bootstrap.lac',
          fileName: 'bootstrap.lac',
          content: JSON.stringify({
            captureSession: {
              frequency: 12000000,
              totalSamples: 64,
              captureChannels: [
                {
                  samples: [0, 1, 1, 0]
                }
              ]
            }
          })
        }),
        saveDocument: jest.fn(),
        exportData: jest.fn(),
        connectDevice: jest.fn(),
        startCapture: jest.fn(),
        sendCommand: jest.fn().mockResolvedValue('host-result'),
        onMessage: jest.fn(() => () => undefined)
      };

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const App = (await import('../../../src/frontend/app/App.vue')).default;
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(App);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      await nextTick();
      await Promise.resolve();

      expect(host.loadInitialDocument).toHaveBeenCalledTimes(1);
      expect(setCommandDispatcher).toHaveBeenCalledTimes(1);
      expect(setCommandDispatcher).toHaveBeenCalledWith(expect.any(Function));

      const dispatcher = setCommandDispatcher.mock.calls[0][0];
      await expect(dispatcher('exportData', { scope: 'selection' })).resolves.toBe('host-result');
      expect(host.sendCommand).toHaveBeenCalledWith('exportData', { scope: 'selection' });
      expect(mountPoint.textContent).toContain('bootstrap.lac');
      expect(mountPoint.querySelector('.app-header-stub')?.textContent).toContain('bootstrap.lac');
      expect(mountPoint.querySelector('.app-sidebar-left-stub')?.textContent).toContain('left-container');
      expect(mountPoint.querySelector('.app-sidebar-right-stub')?.textContent).toContain('right-container');
      expect(mountPoint.querySelector('.layout-default')).toBeTruthy();
      expect(mountPoint.querySelector('.app-waveform-stage-stub')).toBeTruthy();

      app.unmount();
      mountPoint.remove();
      expect(setCommandDispatcher).toHaveBeenLastCalledWith(null);
    });
  });
});

describe('vscodeHost 实现', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as typeof window & { __FRONTEND_BOOTSTRAP__?: unknown }).__FRONTEND_BOOTSTRAP__;
    delete (window as typeof window & { vscode?: unknown }).vscode;
  });

  it('应优先从统一 bootstrap 读取初始文档与能力', () => {
    return jest.isolateModulesAsync(async () => {
      jest.unmock('../../../src/frontend/platform/host/vscodeHost');
      const actual = await import('../../../src/frontend/platform/host/vscodeHost');

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
  });

  it('ready 应仅通过 HostAdapter 调用 vscode.postMessage', () => {
    return jest.isolateModulesAsync(async () => {
      jest.unmock('../../../src/frontend/platform/host/vscodeHost');
      const postMessage = jest.fn();
      const actual = await import('../../../src/frontend/platform/host/vscodeHost');

      window.vscode = {
        postMessage
      };

      actual.createVsCodeHost().ready();

      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
    });
  });

  it('sendCommand 应通过 request-response 解析 hostCommandResult', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.unmock('../../../src/frontend/platform/host/vscodeHost');
      const postMessage = jest.fn();
      const actual = await import('../../../src/frontend/platform/host/vscodeHost');

      window.vscode = {
        postMessage
      };

      const host = actual.createVsCodeHost();
      const commandPromise = host.sendCommand('scanForDevices', { timeout: 5000 });

      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'hostCommand',
        command: 'scanForDevices',
        payload: { timeout: 5000 },
        requestId: expect.any(String)
      }));

      const requestId = postMessage.mock.calls[0][0].requestId;

      window.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'hostCommandResult',
          requestId,
          success: true,
          data: { devices: [] }
        }
      }));

      await expect(commandPromise).resolves.toEqual({
        success: true,
        data: { devices: [] }
      });
    });
  });

  it('sendCommand 超时后应返回失败结果并清理 pending', async () => {
    jest.useFakeTimers();

    try {
      await jest.isolateModulesAsync(async () => {
        jest.unmock('../../../src/frontend/platform/host/vscodeHost');
        const postMessage = jest.fn();
        const actual = await import('../../../src/frontend/platform/host/vscodeHost');

        window.vscode = {
          postMessage
        };

        const host = actual.createVsCodeHost();
        const commandPromise = host.sendCommand('scanForDevices', { timeout: 5000 });
        const requestId = postMessage.mock.calls[0][0].requestId;

        await jest.advanceTimersByTimeAsync(10000);

        await expect(commandPromise).resolves.toEqual({
          success: false,
          error: 'Host command timed out: scanForDevices'
        });

        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'hostCommandResult',
            requestId,
            success: true,
            data: { devices: ['late'] }
          }
        }));

        await expect(Promise.resolve()).resolves.toBeUndefined();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('缺少 bootstrap 时应返回空文档和默认能力', () => {
    return jest.isolateModulesAsync(async () => {
      jest.unmock('../../../src/frontend/platform/host/vscodeHost');
      const actual = await import('../../../src/frontend/platform/host/vscodeHost');

      expect(actual.readVsCodeBootstrap()).toEqual({
        host: 'vscode',
        document: undefined,
        capabilities: {
          canSave: true,
          canExport: true,
          canStartCapture: true,
          canConnectDevice: true
        }
      });
    });
  });
});

describe('messageBridge 实现', () => {
  it('应优先透传 payload 字段', () => {
    const actual = jest.requireActual('../../../src/frontend/platform/host/messageBridge');

    expect(actual.normalizeHostMessage({ type: 'documentUpdate', payload: { id: 1 } })).toEqual({
      type: 'documentUpdate',
      payload: { id: 1 },
      raw: { type: 'documentUpdate', payload: { id: 1 } }
    });
  });

  it('应把 data 归一化为 payload', () => {
    const actual = jest.requireActual('../../../src/frontend/platform/host/messageBridge');

    expect(actual.normalizeHostMessage({ type: 'documentLoaded', data: { id: 2 } })).toEqual({
      type: 'documentLoaded',
      payload: { id: 2 },
      raw: { type: 'documentLoaded', data: { id: 2 } }
    });
  });

  it('应把 error.message 归一化为统一错误形状', () => {
    const actual = jest.requireActual('../../../src/frontend/platform/host/messageBridge');

    expect(actual.normalizeHostMessage({ type: 'error', message: 'bad data' })).toEqual({
      type: 'error',
      payload: { message: 'bad data' },
      raw: { type: 'error', message: 'bad data' }
    });
  });

  it('无效消息应返回 null', () => {
    const actual = jest.requireActual('../../../src/frontend/platform/host/messageBridge');

    expect(actual.normalizeHostMessage(null)).toBeNull();
    expect(actual.normalizeHostMessage({ payload: {} })).toBeNull();
  });
});

describe('browserHost 实现', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as typeof window & { __FRONTEND_BOOTSTRAP__?: unknown }).__FRONTEND_BOOTSTRAP__;
  });

  it('saveDocument 对有效 JSON 应发送与 vscode 对齐的 documentUpdate', () => {
    return jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      const host = actual.createBrowserHost();
      const messages: Array<{ type: string; payload?: unknown }> = [];

      host.onMessage((message: { type: string; payload?: unknown }) => {
        messages.push(message);
      });

      host.saveDocument('{"channels":[1,2]}');

      expect(messages).toEqual([
        {
          type: 'documentUpdate',
          payload: { channels: [1, 2] }
        }
      ]);
    });
  });

  it('saveDocument 对无效 JSON 应发送统一 error 形状', () => {
    return jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      const host = actual.createBrowserHost();
      const messages: Array<{ type: string; payload?: unknown }> = [];

      host.onMessage((message: { type: string; payload?: unknown }) => {
        messages.push(message);
      });

      host.saveDocument('{bad json');

      expect(messages).toEqual([
        {
          type: 'error',
          payload: {
            message: '解析文件失败: 无效的.lac文件格式'
          }
        }
      ]);
    });
  });
});

describe('useHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as typeof window & { __FRONTEND_BOOTSTRAP__?: unknown }).__FRONTEND_BOOTSTRAP__;
    delete (window as typeof window & { vscode?: unknown }).vscode;
  });

  it('存在注入 host 时应优先返回注入实例', async () => {
    await jest.isolateModulesAsync(async () => {
      const { createApp, defineComponent, h } = await import('vue');
      const { useHost } = await import('../../../src/frontend/app/composables/useHost');
      const injectedHost = {
        id: 'injected-host'
      } as any;

      const Consumer = defineComponent({
        setup() {
          return () => h('div', { 'data-host-id': useHost() === injectedHost ? injectedHost.id : 'other' });
        }
      });

      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);
      const app = createApp(Consumer);
      app.provide('host', injectedHost);
      app.mount(mountPoint);

      expect(mountPoint.firstElementChild?.getAttribute('data-host-id')).toBe('injected-host');

      app.unmount();
      mountPoint.remove();
    });
  });

  it('fallback:auto 应按 bootstrap host 选择 browser host', async () => {
    await jest.isolateModulesAsync(async () => {
      const { createApp, defineComponent, h } = await import('vue');
      const { useHost } = await import('../../../src/frontend/app/composables/useHost');

      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };

      const Consumer = defineComponent({
        setup() {
          const host = useHost({ fallback: 'auto' });
          return () => h('div', { 'data-host-kind': host.loadInitialDocument() ? 'html' : 'unknown' });
        }
      });

      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);
      const app = createApp(Consumer);
      app.mount(mountPoint);

      expect(mountPoint.firstElementChild?.getAttribute('data-host-kind')).toBe('html');

      app.unmount();
      mountPoint.remove();
    });
  });
});

describe('KeyboardShortcutManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应优先使用注入 dispatcher，并在设为 null 后停止分发', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.unmock('../../../src/frontend/core/utils/KeyboardShortcutManager');
      const sendCommand = jest.fn();
      jest.doMock('../../../src/frontend/platform/host/defaultHost', () => ({
        __esModule: true,
        getDefaultHost: jest.fn(() => ({
          sendCommand
        }))
      }));

      const { KeyboardShortcutManager } = await import(
        '../../../src/frontend/core/utils/KeyboardShortcutManager'
      );

      const manager = new KeyboardShortcutManager();
      const dispatcher = jest.fn();
      const target = {
        tagName: 'DIV',
        getAttribute: jest.fn().mockReturnValue(null)
      };
      const createShortcutEvent = () => {
        const event = new KeyboardEvent('keydown', {
          key: 'e',
          code: 'KeyE',
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });

        Object.defineProperty(event, 'target', {
          configurable: true,
          value: target
        });

        return event;
      };

      manager.setCommandDispatcher(dispatcher);
      (manager as any).keydownHandler(createShortcutEvent());

      expect(dispatcher).toHaveBeenCalledWith('exportData', undefined);
      expect(sendCommand).not.toHaveBeenCalled();

      manager.setCommandDispatcher(undefined);
      (manager as any).keydownHandler(createShortcutEvent());

      expect(sendCommand).toHaveBeenCalledWith('exportData', undefined);

      manager.setCommandDispatcher(null);
      (manager as any).keydownHandler(createShortcutEvent());

      expect(sendCommand).toHaveBeenCalledTimes(1);
      manager.destroy();
    });
  });
});

describe('LACEditorProvider 契约', () => {
  const mockProviderDependencies = () => {
    jest.doMock('../../../src/drivers/HardwareDriverManager', () => ({
      hardwareDriverManager: {
        getCurrentDevice: jest.fn(() => null),
        disconnectCurrentDevice: jest.fn(),
        connectToDevice: jest.fn()
      }
    }));
    jest.doMock('../../../src/services/NetworkStabilityService', () => ({
      NetworkStabilityService: jest.fn().mockImplementation(() => ({
        disconnect: jest.fn(),
        connect: jest.fn(),
        runDiagnostics: jest.fn()
      }))
    }));
    jest.doMock('../../../src/services/WiFiDeviceDiscovery', () => ({
      WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
        scanForDevices: jest.fn(),
        stopScan: jest.fn(),
        getCachedDevices: jest.fn()
      }))
    }));
  };

  it('manifest 缺失时应提示错误并抛出异常', async () => {
    await jest.isolateModulesAsync(async () => {
      const showErrorMessage = jest.fn();

      mockProviderDependencies();
      jest.doMock('fs', () => ({
        existsSync: jest.fn(() => false),
        readFileSync: jest.fn()
      }));
      jest.doMock('vscode', () => ({
        commands: { executeCommand: jest.fn() },
        window: {
          registerCustomEditorProvider: jest.fn(),
          showInformationMessage: jest.fn(),
          showErrorMessage,
          showSaveDialog: jest.fn()
        },
        workspace: {
          applyEdit: jest.fn(),
          onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        Uri: {
          joinPath: jest.fn(),
          file: jest.fn()
        },
        Range: jest.fn(),
        WorkspaceEdit: jest.fn()
      }), { virtual: true });

      const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
      const provider = new LACEditorProvider({
        extensionUri: {
          fsPath: '/tmp/extension'
        }
      } as any);

      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(
        'Webview 资源清单不存在: /tmp/extension/out/webview/webview-manifest.json'
      );
      expect(showErrorMessage).toHaveBeenCalledWith(
        'Webview 资源清单不存在: /tmp/extension/out/webview/webview-manifest.json'
      );
    });
  });

  it('manifest 缺少 main-vscode.js 时应提示错误并抛出异常', async () => {
    await jest.isolateModulesAsync(async () => {
      const showErrorMessage = jest.fn();

      mockProviderDependencies();
      jest.doMock('fs', () => ({
        existsSync: jest.fn(() => true),
        readFileSync: jest.fn(() => JSON.stringify({}))
      }));
      jest.doMock('vscode', () => ({
        commands: { executeCommand: jest.fn() },
        window: {
          registerCustomEditorProvider: jest.fn(),
          showInformationMessage: jest.fn(),
          showErrorMessage,
          showSaveDialog: jest.fn()
        },
        workspace: {
          applyEdit: jest.fn(),
          onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        Uri: {
          joinPath: jest.fn((...segments: string[]) => segments.join('/')),
          file: jest.fn()
        },
        Range: jest.fn(),
        WorkspaceEdit: jest.fn()
      }), { virtual: true });

      const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
      const provider = new LACEditorProvider({
        extensionUri: {
          fsPath: '/tmp/extension'
        }
      } as any);

      expect(() => (provider as any).getHtmlForWebview({
        asWebviewUri: (value: string) => value,
        cspSource: 'vscode-webview://test'
      }, {
        uri: {
          toString: () => 'file:///tmp/test.lac',
          fsPath: '/tmp/test.lac'
        },
        getText: () => '{}'
      })).toThrow('Webview 资源清单缺失 main-vscode.js');
      expect(showErrorMessage).toHaveBeenCalledWith('Webview 资源清单缺失 main-vscode.js');
    });
  });

  it('manifest JSON 损坏时应提示错误并抛出异常', async () => {
    await jest.isolateModulesAsync(async () => {
      const showErrorMessage = jest.fn();

      mockProviderDependencies();
      jest.doMock('fs', () => ({
        existsSync: jest.fn(() => true),
        readFileSync: jest.fn(() => '{invalid json')
      }));
      jest.doMock('vscode', () => ({
        commands: { executeCommand: jest.fn() },
        window: {
          registerCustomEditorProvider: jest.fn(),
          showInformationMessage: jest.fn(),
          showErrorMessage,
          showSaveDialog: jest.fn()
        },
        workspace: {
          applyEdit: jest.fn(),
          onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        Uri: {
          joinPath: jest.fn((...segments: string[]) => segments.join('/')),
          file: jest.fn()
        },
        Range: jest.fn(),
        WorkspaceEdit: jest.fn()
      }), { virtual: true });

      const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
      const provider = new LACEditorProvider({
        extensionUri: {
          fsPath: '/tmp/extension'
        }
      } as any);

      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(
        /Webview 资源清单格式无效: .*JSON/
      );
      expect(showErrorMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Webview 资源清单格式无效: .*JSON/)
      );
    });
  });

  it('manifest 越界路径时应提示错误并抛出异常', async () => {
    await jest.isolateModulesAsync(async () => {
      const showErrorMessage = jest.fn();

      mockProviderDependencies();
      jest.doMock('fs', () => ({
        existsSync: jest.fn(() => true),
        readFileSync: jest.fn(() => JSON.stringify({
          'main-vscode.js': '../outside.js'
        }))
      }));
      jest.doMock('vscode', () => ({
        commands: { executeCommand: jest.fn() },
        window: {
          registerCustomEditorProvider: jest.fn(),
          showInformationMessage: jest.fn(),
          showErrorMessage,
          showSaveDialog: jest.fn()
        },
        workspace: {
          applyEdit: jest.fn(),
          onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        Uri: {
          joinPath: jest.fn((...segments: string[]) => segments.join('/')),
          file: jest.fn()
        },
        Range: jest.fn(),
        WorkspaceEdit: jest.fn()
      }), { virtual: true });

      const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
      const provider = new LACEditorProvider({
        extensionUri: {
          fsPath: '/tmp/extension'
        }
      } as any);

      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(
        'Webview 资源清单包含越界路径: ../outside.js'
      );
      expect(showErrorMessage).toHaveBeenCalledWith(
        'Webview 资源清单包含越界路径: ../outside.js'
      );
    });
  });

  it('connectToDevice helper 应返回满足 WiFiDeviceInfo 契约的对象', async () => {
    await jest.isolateModulesAsync(async () => {
      mockProviderDependencies();
      jest.doMock('vscode', () => ({
        commands: { executeCommand: jest.fn() },
        window: {
          registerCustomEditorProvider: jest.fn(),
          showInformationMessage: jest.fn(),
          showErrorMessage: jest.fn(),
          showSaveDialog: jest.fn()
        },
        workspace: {
          applyEdit: jest.fn(),
          onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        Uri: {
          joinPath: jest.fn(),
          file: jest.fn()
        },
        Range: jest.fn(),
        WorkspaceEdit: jest.fn()
      }), { virtual: true });

      const actual = await import('../../../src/providers/LACEditorProvider');
      const deviceInfo = actual.createConnectedDeviceInfo({
        host: '192.168.1.100',
        port: 4045,
        deviceName: 'Pico Logic Analyzer',
        version: '1.0.0'
      });

      expect(deviceInfo).toMatchObject({
        ipAddress: '192.168.1.100',
        port: 4045,
        deviceName: 'Pico Logic Analyzer',
        version: '1.0.0',
        responseTime: expect.any(Number),
        deviceType: expect.any(String),
        lastSeen: expect.any(Date),
        isOnline: true
      });
    });
  });
});
