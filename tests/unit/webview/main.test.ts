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

    jest.doMock('vue', () => ({
      ...jest.requireActual('vue'),
      createApp: mockCreateApp
    }));

    jest.doMock('pinia', () => ({
      ...jest.requireActual('pinia'),
      createPinia: jest.fn(() => ({
        install: jest.fn(),
        _plugin: 'pinia'
      }))
    }));

    jest.doMock('../../../src/frontend/app/App.vue', () => ({
      __esModule: true,
      default: {
        name: 'App'
      }
    }));

    jest.doMock('../../../src/frontend/platform/host/vscodeHost', () => ({
      createVsCodeHost: mockCreateVsCodeHost,
      readVsCodeBootstrap: mockReadVsCodeBootstrap
    }));
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

  it('applySession 应把 sessionStore 的真实通道、采样率和触发位置装载到 renderer', async () => {
    jest.resetModules();

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');

      const renderer = {
        updateVisibleSamples: jest.fn(),
        setChannels: jest.fn(),
        setSampleFrequency: jest.fn(),
        setPreSamples: jest.fn(),
        setBursts: jest.fn()
      };

      const { createWaveformService } = await import(
        '../../../src/frontend/core/services/waveformService'
      );

      const sessionStore = {
        sampleRate: 24000000,
        totalSamples: 4,
        preTriggerSamples: 1,
        bursts: [2],
        channels: [
          {
            channelNumber: 0,
            channelName: 'D0',
            hidden: false,
            samples: new Uint8Array([1, 0, 1, 0])
          }
        ]
      };

      createWaveformService(renderer).applySession(sessionStore);

      expect(renderer.setSampleFrequency).toHaveBeenCalledWith(24000000);
      expect(renderer.setPreSamples).toHaveBeenCalledWith(1);
      expect(renderer.setBursts).toHaveBeenCalledWith([2]);
      expect(renderer.setChannels).toHaveBeenCalledWith(sessionStore.channels, 24000000);
      expect(renderer.updateVisibleSamples).toHaveBeenCalledWith(0, 4);
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

  it('sessionStore.applyDocument 应把原版 PascalCase .lac Samples 解包为前端通道样本', () => {
    const actualPinia = jest.requireActual('pinia');
    const { useSessionStore } = jest.requireActual('../../../src/frontend/core/stores/sessionStore');

    actualPinia.setActivePinia(actualPinia.createPinia());

    const sessionStore = useSessionStore();

    sessionStore.applyDocument({
      uri: 'file:///tmp/original-samples.lac',
      fileName: 'original-samples.lac',
      content: JSON.stringify({
        Settings: {
          Frequency: 24000000,
          PreTriggerSamples: 1,
          PostTriggerSamples: 3,
          LoopCount: 0,
          CaptureChannels: [
            { ChannelNumber: 0, ChannelName: 'D0' },
            { ChannelNumber: 1, ChannelName: 'D1' },
            { ChannelNumber: 2, ChannelName: 'D2', Hidden: true }
          ]
        },
        Samples: [
          '00000000000000000000000000000001',
          '00000000000000000000000000000002',
          '00000000000000000000000000000003',
          '00000000000000000000000000000000'
        ],
        SelectedRegions: [
          {
            FirstSample: 1,
            LastSample: 3,
            RegionName: '窗口',
            R: 255,
            G: 128,
            B: 0,
            A: 96
          }
        ]
      })
    });

    expect(sessionStore.fileName).toBe('original-samples.lac');
    expect(sessionStore.sampleRate).toBe(24000000);
    expect(sessionStore.preTriggerSamples).toBe(1);
    expect(sessionStore.postTriggerSamples).toBe(3);
    expect(sessionStore.totalSamples).toBe(4);
    expect(sessionStore.hasData).toBe(true);
    expect(sessionStore.documentState).toBe('samples');
    expect(sessionStore.channels).toHaveLength(3);
    expect(sessionStore.channels[0].channelName).toBe('D0');
    expect(Array.from(sessionStore.channels[0].samples!)).toEqual([1, 0, 1, 0]);
    expect(Array.from(sessionStore.channels[1].samples!)).toEqual([0, 1, 1, 0]);
    expect(sessionStore.channels[2].hidden).toBe(true);
    expect(Array.from(sessionStore.channels[2].samples!)).toEqual([0, 0, 0, 0]);
    expect(sessionStore.selectedRegions).toEqual([
      {
        firstSample: 1,
        lastSample: 3,
        regionName: '窗口',
        color: 'rgba(255, 128, 0, 0.376)'
      }
    ]);
  });

  it('sessionStore.applyDocument 应把 settings-only 文档标记为无样本状态', () => {
    const actualPinia = jest.requireActual('pinia');
    const { useSessionStore } = jest.requireActual('../../../src/frontend/core/stores/sessionStore');

    actualPinia.setActivePinia(actualPinia.createPinia());

    const sessionStore = useSessionStore();

    sessionStore.applyDocument({
      uri: 'file:///tmp/settings-only.lac',
      fileName: 'settings-only.lac',
      content: JSON.stringify({
        Settings: {
          Frequency: 12000000,
          PreTriggerSamples: 4,
          PostTriggerSamples: 12,
          CaptureChannels: [
            { ChannelNumber: 0, ChannelName: 'D0' }
          ]
        }
      })
    });

    expect(sessionStore.fileName).toBe('settings-only.lac');
    expect(sessionStore.sampleRate).toBe(12000000);
    expect(sessionStore.totalSamples).toBe(16);
    expect(sessionStore.hasData).toBe(false);
    expect(sessionStore.documentState).toBe('settings-only');
    expect(sessionStore.channels).toHaveLength(1);
    expect(sessionStore.channels[0].samples).toBeUndefined();
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
      const { AnalyzerChannel } = await import('../../../src/models/CaptureModels');
      const { useWaveformStore } = await import('../../../src/frontend/core/stores/waveformStore');
      const waveformStore = useWaveformStore();
      const channel2 = new AnalyzerChannel(2, 'D2');
      channel2.samples = Uint8Array.from([0, 1, 0, 1, 0, 1]);
      const channel8 = new AnalyzerChannel(8, 'D8');
      channel8.samples = Uint8Array.from([1, 1, 0, 0, 1, 1]);
      waveformStore.loadCaptureContext({
        sampleRate: 12000000,
        channels: [channel2, channel8]
      });
      waveformStore.selectRange(1, 4, 1);
      waveformStore.createRegionFromSelection('导出窗口', 'rgba(10, 20, 30, 0.500)');

      await expect(dispatcher('exportData', { format: 'vcd' })).resolves.toBe('host-result');
      expect(host.sendCommand).toHaveBeenCalledWith('exportData', expect.objectContaining({
        source: 'webview',
        format: 'vcd',
        timeRange: 'custom',
        customStart: 1,
        customEnd: 5,
        selectedChannels: [2, 8],
        selectedRegions: [
          {
            firstSample: 1,
            lastSample: 4,
            regionName: '导出窗口',
            color: 'rgba(10, 20, 30, 0.500)'
          }
        ]
      }));

      await dispatcher('saveFile');
      const savedContent = JSON.parse(host.saveDocument.mock.calls[0][0]);
      expect(savedContent.SelectedRegions).toEqual([
        {
          FirstSample: 1,
          LastSample: 4,
          RegionName: '导出窗口',
          R: 10,
          G: 20,
          B: 30,
          A: 128
        }
      ]);
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

describe('deviceStore 采集工作流状态', () => {
  it('applyStatus 应保存设备、limits 和采集状态', async () => {
    const actualPinia = jest.requireActual('pinia');
    const { useDeviceStore } = jest.requireActual('../../../src/frontend/core/stores/deviceStore');

    actualPinia.setActivePinia(actualPinia.createPinia());
    const store = useDeviceStore();

    store.applyStatus({
      isConnected: true,
      isCapturing: false,
      currentDevice: {
        id: 'manual-/dev/ttyUSB0',
        name: 'Manual Device',
        connectionPath: '/dev/ttyUSB0',
        type: 'serial'
      },
      limits: {
        minFrequency: 1000,
        maxFrequency: 24000000,
        channelCount: 24,
        modeLimits: [
          {
            minPreSamples: 2,
            maxPreSamples: 100,
            minPostSamples: 2,
            maxPostSamples: 1000,
            maxTotalSamples: 1002
          }
        ]
      },
      lastCaptureConfig: {
        frequency: 1000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        triggerType: 'Edge',
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        channels: [
          {
            number: 0,
            name: 'SDA',
            enabled: true
          }
        ]
      }
    });

    expect(store.isConnected).toBe(true);
    expect(store.deviceLabel).toBe('Manual Device');
    expect(store.limits?.channelCount).toBe(24);
    expect(store.captureConfig.channels[0]).toEqual({
      number: 0,
      name: 'SDA',
      enabled: true
    });
  });

  it('frequencyJitterLevel 应按设备 limits 标记频率风险', async () => {
    const actualPinia = jest.requireActual('pinia');
    const { useDeviceStore } = jest.requireActual('../../../src/frontend/core/stores/deviceStore');

    actualPinia.setActivePinia(actualPinia.createPinia());
    const store = useDeviceStore();

    store.applyStatus({
      isConnected: true,
      isCapturing: false,
      limits: {
        minFrequency: 1000,
        maxFrequency: 1000000,
        channelCount: 8,
        modeLimits: []
      }
    });
    store.captureConfig.frequency = 995000;

    expect(store.frequencyJitterLevel).toBe('high');
  });
});

describe('decoderStore I2C 解码状态', () => {
  beforeEach(() => {
    const actualPinia = jest.requireActual('pinia');
    actualPinia.setActivePinia(actualPinia.createPinia());
  });

  it('decoderStore 应根据当前通道初始化 I2C 映射', () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();

    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'SCL', hidden: false },
      { channelNumber: 1, channelName: 'SDA', hidden: false }
    ]);

    expect(store.i2cMapping).toEqual({
      sclCaptureIndex: 0,
      sdaCaptureIndex: 1
    });
    expect(store.channelConflicts).toEqual([]);
  });

  it('decoderStore 应按通道名初始化逆序 I2C 映射', () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();

    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'SDA', hidden: false },
      { channelNumber: 1, channelName: 'SCL', hidden: false }
    ]);

    expect(store.i2cMapping).toEqual({
      sclCaptureIndex: 1,
      sdaCaptureIndex: 0
    });
    expect(store.channelConflicts).toEqual([]);
  });

  it('decoderStore 应阻止 SCL 和 SDA 同通道', () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();

    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'D0', hidden: false },
      { channelNumber: 1, channelName: 'D1', hidden: false }
    ]);
    store.setI2CMapping('sda', 0);

    expect(store.channelConflicts).toContain('SCL 和 SDA 不能映射到同一采集通道');
  });

  it('runI2CDecoder 成功时应保存结果', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'SCL', hidden: false },
      { channelNumber: 1, channelName: 'SDA', hidden: false }
    ]);
    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I2C',
          success: true,
          executionTime: 3,
          results: [
            { startSample: 1, endSample: 2, annotationType: 0, values: ['START'] },
            { startSample: 3, endSample: 4, annotationType: 1, values: ['ACK'] }
          ]
        }
      })
    };
    const sessionStore = {
      hasData: true,
      sampleRate: 1000000,
      channels: [
        { channelNumber: 0, channelName: 'SCL', hidden: false },
        { channelNumber: 1, channelName: 'SDA', hidden: false }
      ]
    };

    await store.runI2CDecoder(host, sessionStore);

    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'i2c',
      channelMapping: [
        { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
        { captureIndex: 1, decoderIndex: 1, name: 'SDA' }
      ],
      options: []
    });
    expect(store.decoderResults).toHaveLength(2);
    expect(store.lastExecutionTime).toBe(3);
    expect(store.lastDecoderName).toBe('I2C');
    expect(store.decoderErrors).toEqual([]);
  });

  it('runI2CDecoder 应保存 Streaming I2C 执行元信息', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'SCL', hidden: false },
      { channelNumber: 1, channelName: 'SDA', hidden: false }
    ]);
    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I2C',
          success: true,
          isStreaming: true,
          executionTime: 8,
          results: [
            { startSample: 1, endSample: 2, annotationType: 0, values: ['Start', 'S'] }
          ],
          performanceStats: {
            totalSamples: 1000001,
            processingSpeed: 500000,
            chunksProcessed: 201
          }
        }
      })
    };

    await store.runI2CDecoder(host, {
      hasData: true,
      sampleRate: 1000000,
      channels: [
        { channelNumber: 0, channelName: 'SCL', hidden: false },
        { channelNumber: 1, channelName: 'SDA', hidden: false }
      ]
    });

    expect(store.lastExecutionMode).toBe('streaming');
    expect(store.lastChunksProcessed).toBe(201);
    expect(store.decoderResults).toHaveLength(1);
  });

  it('runI2CDecoder 应使用按名称识别出的逆序 I2C 映射', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'SDA', hidden: false },
      { channelNumber: 1, channelName: 'SCL', hidden: false }
    ]);
    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I2C',
          success: true,
          executionTime: 3,
          results: [
            { startSample: 1, endSample: 2, annotationType: 0, values: ['START'] }
          ]
        }
      })
    };
    const sessionStore = {
      hasData: true,
      sampleRate: 1000000,
      channels: [
        { channelNumber: 0, channelName: 'SDA', hidden: false },
        { channelNumber: 1, channelName: 'SCL', hidden: false }
      ]
    };

    await store.runI2CDecoder(host, sessionStore);

    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'i2c',
      channelMapping: [
        { captureIndex: 1, decoderIndex: 0, name: 'SCL' },
        { captureIndex: 0, decoderIndex: 1, name: 'SDA' }
      ],
      options: []
    });
    expect(store.decoderErrors).toEqual([]);
  });

  it('runI2CDecoder 失败时应保存错误', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeI2CMapping([
      { channelNumber: 0, channelName: 'SCL', hidden: false },
      { channelNumber: 1, channelName: 'SDA', hidden: false }
    ]);
    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I2C',
          success: false,
          executionTime: 1,
          results: [],
          error: '采样率无效，无法执行协议解码'
        }
      })
    };

    await store.runI2CDecoder(host, {
      hasData: true,
      sampleRate: 0,
      channels: [
        { channelNumber: 0, channelName: 'SCL', hidden: false },
        { channelNumber: 1, channelName: 'SDA', hidden: false }
      ]
    });

    expect(store.decoderResults).toEqual([]);
    expect(store.decoderErrors[0]).toBe('采样率无效，无法执行协议解码');
    expect(store.lastExecutionTime).toBe(1);
  });

  it('runSPIDecoder 应发送 SPI 映射和核心选项', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeSPIMapping([
      { channelNumber: 0, channelName: 'CLK', hidden: false },
      { channelNumber: 1, channelName: 'MISO', hidden: false },
      { channelNumber: 2, channelName: 'MOSI', hidden: false },
      { channelNumber: 3, channelName: 'CS', hidden: false }
    ]);
    store.setSPIOption('cpol', '1');
    store.setSPIOption('cpha', '1');
    store.setSPIOption('bitOrder', 'lsb-first');
    store.setSPIOption('wordSize', 16);

    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'spi',
          decoderName: 'SPI',
          success: true,
          executionTime: 5,
          results: [
            { startSample: 1, endSample: 16, annotationType: 0, values: ['A5'], rawData: 0xA5 },
            { startSample: 1, endSample: 16, annotationType: 1, values: ['3C'], rawData: 0x3C }
          ]
        }
      })
    };

    await store.runSPIDecoder(host, {
      hasData: true,
      sampleRate: 1000000,
      channels: [
        { channelNumber: 0, channelName: 'CLK', hidden: false },
        { channelNumber: 1, channelName: 'MISO', hidden: false },
        { channelNumber: 2, channelName: 'MOSI', hidden: false },
        { channelNumber: 3, channelName: 'CS', hidden: false }
      ]
    });

    expect(store.activeDecoderConfigs).toEqual(expect.arrayContaining([
      { decoderId: 'spi', label: 'SPI' }
    ]));
    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'spi',
      channelMapping: [
        { captureIndex: 0, decoderIndex: 0, name: 'CLK' },
        { captureIndex: 1, decoderIndex: 1, name: 'MISO' },
        { captureIndex: 2, decoderIndex: 2, name: 'MOSI' },
        { captureIndex: 3, decoderIndex: 3, name: 'CS' }
      ],
      options: [
        { optionIndex: 0, value: 'active-low' },
        { optionIndex: 1, value: '1' },
        { optionIndex: 2, value: '1' },
        { optionIndex: 3, value: 'lsb-first' },
        { optionIndex: 4, value: 16 }
      ]
    });
    expect(store.decoderResults).toHaveLength(2);
    expect(store.decoderErrors).toEqual([]);
  });

  it('decoderStore 应支持 UART RX/TX 映射和核心选项', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();

    store.initializeUARTMapping([
      { channelNumber: 0, channelName: 'TX', hidden: false },
      { channelNumber: 1, channelName: 'RX', hidden: false }
    ]);
    store.setSelectedDecoder('uart');
    store.setUARTOption('baudrate', 9600);
    store.setUARTOption('parity', 'even');
    store.setUARTOption('stopBits', '2.0');
    store.setUARTOption('invertRx', true);

    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'uart',
          decoderName: 'UART',
          success: true,
          executionTime: 5,
          results: [
            { startSample: 1, endSample: 9, annotationType: 0, values: ['55'], rawData: 0x55 }
          ]
        }
      })
    };

    await store.runUARTDecoder(host, {
      hasData: true,
      sampleRate: 115200,
      channels: [
        { channelNumber: 0, channelName: 'TX', hidden: false },
        { channelNumber: 1, channelName: 'RX', hidden: false }
      ]
    });

    expect(store.uartMapping).toEqual({
      rxCaptureIndex: 1,
      txCaptureIndex: 0
    });
    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'uart',
      channelMapping: [
        { captureIndex: 1, decoderIndex: 0, name: 'RX' },
        { captureIndex: 0, decoderIndex: 1, name: 'TX' }
      ],
      options: [
        { optionIndex: 0, value: 9600 },
        { optionIndex: 1, value: '8' },
        { optionIndex: 2, value: 'even' },
        { optionIndex: 3, value: '2.0' },
        { optionIndex: 6, value: 'yes' },
        { optionIndex: 7, value: 'no' },
        { optionIndex: 8, value: 50 }
      ]
    });
    expect(store.decoderResults[0].values).toEqual(['55']);
    expect(store.lastDecoderName).toBe('UART');
  });

  it('decoderStore 应暴露 CAN 配置并执行 CAN 解码', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeDecoderMappings([
      { channelNumber: 0, channelName: 'CAN_RX', hidden: false },
      { channelNumber: 1, channelName: 'AUX', hidden: false }
    ]);
    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'can',
          decoderName: 'CAN',
          success: true,
          executionTime: 5,
          results: [
            { startSample: 1, endSample: 2, annotationType: 1, values: ['ID: 123', '123'], rawData: 0x123 },
            { startSample: 3, endSample: 4, annotationType: 4, values: ['Data[0]: 11', '11'], rawData: 0x11 }
          ]
        }
      })
    };

    await store.runCANDecoder(host, {
      hasData: true,
      sampleRate: 1000000,
      channels: [
        { channelNumber: 0, channelName: 'CAN_RX', hidden: false },
        { channelNumber: 1, channelName: 'AUX', hidden: false }
      ]
    });

    expect(store.activeDecoderConfigs).toEqual(expect.arrayContaining([
      expect.objectContaining({ decoderId: 'can', label: 'CAN' })
    ]));
    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'can',
      channelMapping: [
        { captureIndex: 0, decoderIndex: 0, name: 'CAN RX' }
      ],
      options: [
        { optionIndex: 0, value: 500000 },
        { optionIndex: 1, value: 75 }
      ]
    });
    expect(store.decoderResults).toHaveLength(2);
    expect(store.lastDecoderName).toBe('CAN');
    expect(store.decoderErrors).toEqual([]);
  });

  it('runLINDecoder 成功时应发送 LIN 映射和版本化 checksum 选项', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeLINMapping([
      { channelNumber: 0, channelName: 'LIN_RX', hidden: false }
    ]);
    store.setLINOption('checksum', 'lin2.x');
    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'lin',
          decoderName: 'LIN',
          success: true,
          executionTime: 5,
          results: [
            { startSample: 2, endSample: 15, annotationType: 0, values: ['Break'] },
            { startSample: 16, endSample: 26, annotationType: 1, values: ['Sync: 55', '55'] }
          ]
        }
      })
    };

    await store.runLINDecoder(host, {
      hasData: true,
      sampleRate: 19200,
      channels: [
        { channelNumber: 0, channelName: 'LIN_RX', hidden: false }
      ]
    });

    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'lin',
      channelMapping: [
        { captureIndex: 0, decoderIndex: 0, name: 'LIN RX' }
      ],
      options: [
        { optionIndex: 0, value: 19200 },
        { optionIndex: 1, value: 2 },
        { optionIndex: 2, value: 'lin2.x' }
      ]
    });
    expect(store.decoderResults).toHaveLength(2);
    expect(store.lastDecoderName).toBe('LIN');
    expect(store.decoderErrors).toEqual([]);
  });

  it('decoderStore 应根据当前通道初始化 I2S 映射并执行 I2S 解码', async () => {
    const { useDecoderStore } = jest.requireActual('../../../src/frontend/core/stores/decoderStore');
    const store = useDecoderStore();
    store.initializeProtocolMappings([
      { channelNumber: 0, channelName: 'SCK', hidden: false },
      { channelNumber: 1, channelName: 'WS', hidden: false },
      { channelNumber: 2, channelName: 'SD', hidden: false }
    ]);
    store.selectDecoder('i2s');
    store.setI2SOption('word_length', 32);
    store.setI2SOption('justification', 'i2s');

    const host = {
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {
          decoderId: 'i2s',
          decoderName: 'I2S',
          success: true,
          executionTime: 5,
          results: [
            { startSample: 1, endSample: 65, annotationType: 0, values: ['Left: 80000000'] },
            { startSample: 66, endSample: 130, annotationType: 1, values: ['Right: FEDCBA98'] }
          ]
        }
      })
    };

    await store.runSelectedDecoder(host, {
      hasData: true,
      sampleRate: 2000000,
      channels: [
        { channelNumber: 0, channelName: 'SCK', hidden: false },
        { channelNumber: 1, channelName: 'WS', hidden: false },
        { channelNumber: 2, channelName: 'SD', hidden: false }
      ]
    });

    expect(store.i2sMapping).toEqual({
      sckCaptureIndex: 0,
      wsCaptureIndex: 1,
      sdCaptureIndex: 2
    });
    expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
      decoderId: 'i2s',
      channelMapping: [
        { captureIndex: 0, decoderIndex: 0, name: 'SCK' },
        { captureIndex: 1, decoderIndex: 1, name: 'WS' },
        { captureIndex: 2, decoderIndex: 2, name: 'SD' }
      ],
      options: [
        { optionIndex: 0, value: 32 },
        { optionIndex: 1, value: 'i2s' }
      ]
    });
    expect(store.decoderResults).toHaveLength(2);
    expect(store.lastDecoderName).toBe('I2S');
    expect(store.decoderErrors).toEqual([]);
  });
});

describe('AppSidebarRight 协议解码面板', () => {
  it('AppSidebarRight 应显示 I2C 运行按钮和结果内容', async () => {
    if (!(globalThis as typeof globalThis & { __WEBVIEW_JEST__?: boolean }).__WEBVIEW_JEST__) {
      return;
    }

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/components/AppSidebarRight.vue');

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const { useSessionStore } = await import('../../../src/frontend/core/stores/sessionStore');
      const AppSidebarRight = (await import('../../../src/frontend/app/components/AppSidebarRight.vue')).default;
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decoderId: 'i2c',
            decoderName: 'I²C HTML 模拟',
            success: true,
            isStreaming: true,
            executionTime: 4,
            results: [
              { startSample: 1, endSample: 2, annotationType: 0, values: ['START'] },
              { startSample: 3, endSample: 4, annotationType: 1, values: ['ACK'] },
              { startSample: 5, endSample: 6, annotationType: 2, values: ['STOP'] }
            ],
            performanceStats: {
              totalSamples: 1000001,
              processingSpeed: 500000,
              chunksProcessed: 201
            }
          }
        })
      };
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(AppSidebarRight);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      const sessionStore = useSessionStore();
      sessionStore.applyDocument({
        uri: 'file:///tmp/i2c.lac',
        fileName: 'i2c.lac',
        content: JSON.stringify({
          captureSession: {
            sampleRate: 1000000,
            totalSamples: 8,
            captureChannels: [
              { channelNumber: 0, channelName: 'SCL', samples: [1, 0, 1, 0] },
              { channelNumber: 1, channelName: 'SDA', samples: [1, 1, 0, 0] }
            ]
          }
        })
      });

      await nextTick();
      await Promise.resolve();

      const runButton = Array.from(mountPoint.querySelectorAll('button')).find(button =>
        button.textContent?.includes('运行 I2C 解码')
      ) as HTMLButtonElement | undefined;

      expect(runButton).toBeTruthy();
      expect(runButton?.disabled).toBe(false);

      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await Promise.resolve();
      await nextTick();

      expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', expect.objectContaining({
        decoderId: 'i2c'
      }));
      expect(mountPoint.textContent).toContain('START');
      expect(mountPoint.textContent).toContain('ACK');
      expect(mountPoint.textContent).toContain('STOP');
      expect(mountPoint.textContent).toContain('I²C HTML 模拟');
      expect(mountPoint.textContent).toContain('流式');
      expect(mountPoint.textContent).toContain('201 块');

      app.unmount();
      mountPoint.remove();
    });
  });

  it('AppSidebarRight 应显示 UART 映射、选项并发送解码请求', async () => {
    if (!(globalThis as typeof globalThis & { __WEBVIEW_JEST__?: boolean }).__WEBVIEW_JEST__) {
      return;
    }

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/components/AppSidebarRight.vue');

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const { useSessionStore } = await import('../../../src/frontend/core/stores/sessionStore');
      const AppSidebarRight = (await import('../../../src/frontend/app/components/AppSidebarRight.vue')).default;
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decoderId: 'uart',
            decoderName: 'UART',
            success: true,
            executionTime: 4,
            results: [
              { startSample: 1, endSample: 10, annotationType: 0, values: ['55'], rawData: 0x55 },
              { startSample: 12, endSample: 21, annotationType: 1, values: ['33'], rawData: 0x33 }
            ]
          }
        })
      };
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(AppSidebarRight);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      const sessionStore = useSessionStore();
      sessionStore.applyDocument({
        uri: 'file:///tmp/uart.lac',
        fileName: 'uart.lac',
        content: JSON.stringify({
          captureSession: {
            sampleRate: 115200,
            totalSamples: 16,
            captureChannels: [
              { channelNumber: 0, channelName: 'RX', samples: [1, 0, 1, 0] },
              { channelNumber: 1, channelName: 'TX', samples: [1, 1, 0, 0] }
            ]
          }
        })
      });

      await nextTick();
      await Promise.resolve();

      const protocolSelect = mountPoint.querySelector('[data-testid="decoder-protocol-select"]') as HTMLSelectElement;
      protocolSelect.value = 'uart';
      protocolSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();

      const baudrateInput = mountPoint.querySelector('[data-testid="uart-baudrate-input"]') as HTMLInputElement;
      baudrateInput.value = '9600';
      baudrateInput.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();

      const runButton = mountPoint.querySelector('[data-testid="run-uart-decoder"]') as HTMLButtonElement;
      expect(runButton).toBeTruthy();
      expect(runButton.disabled).toBe(false);

      runButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await Promise.resolve();
      await nextTick();

      expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', expect.objectContaining({
        decoderId: 'uart',
        channelMapping: expect.arrayContaining([
          { captureIndex: 0, decoderIndex: 0, name: 'RX' },
          { captureIndex: 1, decoderIndex: 1, name: 'TX' }
        ]),
        options: expect.arrayContaining([
          { optionIndex: 0, value: 9600 }
        ])
      }));
      expect(mountPoint.textContent).toContain('UART');
      expect(mountPoint.textContent).toContain('55');
      expect(mountPoint.textContent).toContain('33');

      app.unmount();
      mountPoint.remove();
    });
  });

  it('AppSidebarRight 应能选择并运行 CAN 解码', async () => {
    if (!(globalThis as typeof globalThis & { __WEBVIEW_JEST__?: boolean }).__WEBVIEW_JEST__) {
      return;
    }

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/components/AppSidebarRight.vue');

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const { useSessionStore } = await import('../../../src/frontend/core/stores/sessionStore');
      const AppSidebarRight = (await import('../../../src/frontend/app/components/AppSidebarRight.vue')).default;
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decoderId: 'can',
            decoderName: 'CAN',
            success: true,
            executionTime: 6,
            results: [
              { startSample: 1, endSample: 2, annotationType: 1, values: ['ID: 123', '123'], rawData: 0x123 },
              { startSample: 3, endSample: 4, annotationType: 4, values: ['Data[0]: 11', '11'], rawData: 0x11 }
            ]
          }
        })
      };
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(AppSidebarRight);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      const sessionStore = useSessionStore();
      sessionStore.applyDocument({
        uri: 'file:///tmp/can.lac',
        fileName: 'can.lac',
        content: JSON.stringify({
          captureSession: {
            sampleRate: 1000000,
            totalSamples: 8,
            captureChannels: [
              { channelNumber: 0, channelName: 'CAN_RX', samples: [1, 0, 1, 0] },
              { channelNumber: 1, channelName: 'AUX', samples: [1, 1, 1, 1] }
            ]
          }
        })
      });

      await nextTick();
      await Promise.resolve();

      const protocolSelect = mountPoint.querySelector('[data-testid="decoder-protocol-select"]') as HTMLSelectElement | null;
      expect(protocolSelect).toBeTruthy();
      protocolSelect!.value = 'can';
      protocolSelect!.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();

      const runButton = Array.from(mountPoint.querySelectorAll('button')).find(button =>
        button.textContent?.includes('运行 CAN 解码')
      ) as HTMLButtonElement | undefined;

      expect(runButton).toBeTruthy();
      expect(runButton?.disabled).toBe(false);

      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await Promise.resolve();
      await nextTick();

      expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', expect.objectContaining({
        decoderId: 'can'
      }));
      expect(mountPoint.textContent).toContain('ID: 123');
      expect(mountPoint.textContent).toContain('Data[0]: 11');

      app.unmount();
      mountPoint.remove();
    });
  });

  it('AppSidebarRight 应允许切换到 LIN 并运行解码', async () => {
    if (!(globalThis as typeof globalThis & { __WEBVIEW_JEST__?: boolean }).__WEBVIEW_JEST__) {
      return;
    }

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/components/AppSidebarRight.vue');

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const { useSessionStore } = await import('../../../src/frontend/core/stores/sessionStore');
      const AppSidebarRight = (await import('../../../src/frontend/app/components/AppSidebarRight.vue')).default;
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decoderId: 'lin',
            decoderName: 'LIN',
            success: true,
            executionTime: 2,
            results: [
              { startSample: 2, endSample: 15, annotationType: 0, values: ['Break'] },
              { startSample: 16, endSample: 26, annotationType: 1, values: ['Sync: 55', '55'] }
            ]
          }
        })
      };
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(AppSidebarRight);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      const sessionStore = useSessionStore();
      sessionStore.applyDocument({
        uri: 'file:///tmp/lin.lac',
        fileName: 'lin.lac',
        content: JSON.stringify({
          captureSession: {
            sampleRate: 19200,
            totalSamples: 64,
            captureChannels: [
              { channelNumber: 0, channelName: 'LIN_RX', samples: [1, 1, 0, 0, 0, 1] }
            ]
          }
        })
      });

      await nextTick();
      await Promise.resolve();

      const protocolSelect = mountPoint.querySelector('[data-testid="decoder-protocol-select"]') as HTMLSelectElement | null;
      expect(protocolSelect).toBeTruthy();
      protocolSelect!.value = 'lin';
      protocolSelect!.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();

      const runButton = Array.from(mountPoint.querySelectorAll('button')).find(button =>
        button.textContent?.includes('运行 LIN 解码')
      ) as HTMLButtonElement | undefined;

      expect(runButton).toBeTruthy();
      expect(runButton?.disabled).toBe(false);

      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await Promise.resolve();
      await nextTick();

      expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', expect.objectContaining({
        decoderId: 'lin',
        channelMapping: [{ captureIndex: 0, decoderIndex: 0, name: 'LIN RX' }]
      }));
      expect(mountPoint.textContent).toContain('Break');
      expect(mountPoint.textContent).toContain('Sync: 55');

      app.unmount();
      mountPoint.remove();
    });
  });

  it('AppSidebarRight 应支持选择 I2S 并发送 SCK/WS/SD 映射和选项', async () => {
    if (!(globalThis as typeof globalThis & { __WEBVIEW_JEST__?: boolean }).__WEBVIEW_JEST__) {
      return;
    }

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/components/AppSidebarRight.vue');

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const { useSessionStore } = await import('../../../src/frontend/core/stores/sessionStore');
      const AppSidebarRight = (await import('../../../src/frontend/app/components/AppSidebarRight.vue')).default;
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decoderId: 'i2s',
            decoderName: 'I2S',
            success: true,
            executionTime: 6,
            results: [
              { startSample: 1, endSample: 34, annotationType: 0, values: ['Left: A55A'] },
              { startSample: 35, endSample: 68, annotationType: 1, values: ['Right: 5AA5'] }
            ]
          }
        })
      };
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(AppSidebarRight);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      const sessionStore = useSessionStore();
      sessionStore.applyDocument({
        uri: 'file:///tmp/i2s.lac',
        fileName: 'i2s.lac',
        content: JSON.stringify({
          captureSession: {
            sampleRate: 2000000,
            totalSamples: 68,
            captureChannels: [
              { channelNumber: 0, channelName: 'SCK', samples: [0, 1, 0, 1] },
              { channelNumber: 1, channelName: 'WS', samples: [0, 0, 1, 1] },
              { channelNumber: 2, channelName: 'SD', samples: [1, 0, 1, 0] }
            ]
          }
        })
      });

      await nextTick();
      await Promise.resolve();

      const protocolSelect = mountPoint.querySelector('[data-testid="decoder-protocol-select"]') as HTMLSelectElement;
      protocolSelect.value = 'i2s';
      protocolSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();

      const wordLengthSelect = mountPoint.querySelector('[data-testid="i2s-word-length"]') as HTMLSelectElement;
      wordLengthSelect.value = '32';
      wordLengthSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();

      const runButton = Array.from(mountPoint.querySelectorAll('button')).find(button =>
        button.textContent?.includes('运行 I2S 解码')
      ) as HTMLButtonElement | undefined;

      expect(runButton).toBeTruthy();
      expect(runButton?.disabled).toBe(false);

      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await Promise.resolve();
      await nextTick();

      expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', {
        decoderId: 'i2s',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCK' },
          { captureIndex: 1, decoderIndex: 1, name: 'WS' },
          { captureIndex: 2, decoderIndex: 2, name: 'SD' }
        ],
        options: [
          { optionIndex: 0, value: 32 },
          { optionIndex: 1, value: 'i2s' }
        ]
      });
      expect(mountPoint.textContent).toContain('Left: A55A');
      expect(mountPoint.textContent).toContain('Right: 5AA5');

      app.unmount();
      mountPoint.remove();
    });
  });

  it('AppSidebarRight 应支持切换到 SPI 并运行解码', async () => {
    if (!(globalThis as typeof globalThis & { __WEBVIEW_JEST__?: boolean }).__WEBVIEW_JEST__) {
      return;
    }

    await jest.isolateModulesAsync(async () => {
      jest.unmock('vue');
      jest.unmock('pinia');
      jest.unmock('../../../src/frontend/app/components/AppSidebarRight.vue');

      const { createApp, nextTick } = await import('vue');
      const { createPinia } = await import('pinia');
      const { useSessionStore } = await import('../../../src/frontend/core/stores/sessionStore');
      const AppSidebarRight = (await import('../../../src/frontend/app/components/AppSidebarRight.vue')).default;
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decoderId: 'spi',
            decoderName: 'SPI',
            success: true,
            executionTime: 6,
            results: [
              { startSample: 1, endSample: 16, annotationType: 0, values: ['A5'], rawData: 0xA5 },
              { startSample: 1, endSample: 16, annotationType: 1, values: ['3C'], rawData: 0x3C }
            ]
          }
        })
      };
      const mountPoint = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      document.body.appendChild(mountPoint);

      const app = createApp(AppSidebarRight);
      app.use(createPinia());
      app.provide('host', host);
      app.mount(mountPoint);

      const sessionStore = useSessionStore();
      sessionStore.applyDocument({
        uri: 'file:///tmp/spi.lac',
        fileName: 'spi.lac',
        content: JSON.stringify({
          captureSession: {
            sampleRate: 1000000,
            totalSamples: 16,
            captureChannels: [
              { channelNumber: 0, channelName: 'CLK', samples: [0, 1, 0, 1] },
              { channelNumber: 1, channelName: 'MISO', samples: [1, 1, 0, 0] },
              { channelNumber: 2, channelName: 'MOSI', samples: [0, 0, 1, 1] },
              { channelNumber: 3, channelName: 'CS', samples: [0, 0, 0, 0] }
            ]
          }
        })
      });

      await nextTick();
      await Promise.resolve();

      const protocolSelect = mountPoint.querySelector('[data-testid="decoder-protocol-select"]') as HTMLSelectElement;
      protocolSelect.value = 'spi';
      protocolSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await nextTick();

      const runButton = Array.from(mountPoint.querySelectorAll('button')).find(button =>
        button.textContent?.includes('运行 SPI 解码')
      ) as HTMLButtonElement | undefined;

      expect(runButton).toBeTruthy();
      expect(runButton?.disabled).toBe(false);

      runButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await nextTick();
      await Promise.resolve();
      await nextTick();

      expect(host.sendCommand).toHaveBeenCalledWith('runDecoder', expect.objectContaining({
        decoderId: 'spi',
        channelMapping: expect.arrayContaining([
          { captureIndex: 0, decoderIndex: 0, name: 'CLK' },
          { captureIndex: 2, decoderIndex: 2, name: 'MOSI' }
        ])
      }));
      expect(mountPoint.textContent).toContain('A5');
      expect(mountPoint.textContent).toContain('3C');
      expect(mountPoint.textContent).toContain('SPI');

      app.unmount();
      mountPoint.remove();
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

  it('HTML host 应支持设备连接、网络扫描、采集、重复采集和停止采集命令', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      const host = actual.createBrowserHost();
      const messages: Array<{ type: string; payload?: unknown }> = [];
      const captureConfig = {
        frequency: 1000000,
        preTriggerSamples: 2,
        postTriggerSamples: 6,
        triggerType: 'Edge',
        triggerChannel: 0,
        triggerInverted: false,
        loopCount: 0,
        measureBursts: false,
        channels: [
          { number: 0, name: 'D0', enabled: true },
          { number: 1, name: 'D1', enabled: false }
        ]
      };

      host.onMessage((message: { type: string; payload?: unknown }) => {
        messages.push(message);
      });

      await expect(host.sendCommand('scanNetworkDevices', { timeoutMs: 100 })).resolves.toEqual({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'HTML 模拟 Pico',
            type: 'network'
          })
        ])
      });

      await expect(host.sendCommand('connectDevice', {
        type: 'serial',
        address: '/dev/ttyUSB0'
      })).resolves.toEqual({
        success: true,
        data: expect.objectContaining({
          isConnected: true,
          currentDevice: expect.objectContaining({
            connectionPath: '/dev/ttyUSB0'
          })
        })
      });

      await expect(host.sendCommand('startCapture', { config: captureConfig })).resolves.toEqual({
        success: true,
        data: expect.objectContaining({
          isConnected: true,
          isCapturing: false,
          lastCaptureConfig: expect.objectContaining({
            frequency: 1000000
          }),
          capturedDocument: expect.objectContaining({
            fileName: 'demo.lac',
            content: expect.stringContaining('Settings')
          })
        })
      });

      await expect(host.sendCommand('repeatCapture')).resolves.toEqual({
        success: true,
        data: expect.objectContaining({
          capturedDocument: expect.objectContaining({
            content: expect.stringContaining('Samples')
          })
        })
      });

      await expect(host.sendCommand('stopCapture')).resolves.toEqual({
        success: true,
        data: expect.objectContaining({
          isConnected: true,
          isCapturing: false
        })
      });

      expect(messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'documentUpdate',
          payload: expect.objectContaining({
            Settings: expect.any(Object),
            Samples: expect.any(Array)
          })
        })
      ]));
    });
  });

  it('HTML host 在未连接或采集配置非法时应返回错误结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('startCapture', {
        config: {
          frequency: 0,
          preTriggerSamples: 0,
          postTriggerSamples: 0,
          triggerType: 'Edge',
          triggerChannel: 0,
          channels: [
            { number: 0, name: 'D0', enabled: false }
          ]
        }
      })).resolves.toEqual({
        success: false,
        error: '请先连接逻辑分析器设备'
      });

      await host.sendCommand('connectDevice', {
        type: 'serial',
        address: '/dev/ttyUSB0'
      });

      await expect(host.sendCommand('startCapture', {
        config: {
          frequency: 0,
          preTriggerSamples: 0,
          postTriggerSamples: 0,
          triggerType: 'Edge',
          triggerChannel: 0,
          channels: [
            { number: 0, name: 'D0', enabled: false }
          ]
        }
      })).resolves.toEqual({
        success: false,
        error: '采集配置无效'
      });
    });
  });

  it('HTML host runDecoder 应直接返回 I2C fixture 结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/i2c.lac',
          fileName: 'i2c.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 1000000,
              PreTriggerSamples: 0,
              PostTriggerSamples: 84,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'SCL', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'SDA', Hidden: false }
              ]
            },
            Samples: Array.from({ length: 84 }, (_, index) => (index % 2 === 0 ? '3' : '1'))
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      const result: any = await host.sendCommand('runDecoder', {
        decoderId: 'i2c',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
          { captureIndex: 1, decoderIndex: 1, name: 'SDA' }
        ],
        options: []
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          decoderId: 'i2c',
          decoderName: 'I²C HTML 模拟',
          success: true,
          executionTime: expect.any(Number),
          results: expect.any(Array),
          performanceStats: expect.objectContaining({
            totalSamples: 84,
            processingSpeed: expect.any(Number)
          })
        })
      });
      const values = result.data.results.flatMap((item: any) => item.values);
      expect(values).toEqual(expect.arrayContaining([
        'START',
        'Address write: 50',
        'ACK',
        'Data write: 3C',
        'STOP'
      ]));
    });
  });

  it('HTML host runDecoder 应返回 UART 模拟结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/uart.lac',
          fileName: 'uart.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 115200,
              PreTriggerSamples: 0,
              PostTriggerSamples: 16,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'RX', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'TX', Hidden: false }
              ]
            },
            Samples: Array.from({ length: 16 }, (_, index) => (index % 2 === 0 ? '1' : '0'))
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      const result: any = await host.sendCommand('runDecoder', {
        decoderId: 'uart',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'RX' },
          { captureIndex: 1, decoderIndex: 1, name: 'TX' }
        ],
        options: [
          { optionIndex: 0, value: 115200 }
        ]
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          decoderId: 'uart',
          decoderName: 'UART HTML 模拟',
          success: true,
          executionTime: expect.any(Number),
          results: expect.any(Array),
          performanceStats: expect.objectContaining({
            totalSamples: 16,
            processingSpeed: expect.any(Number)
          })
        })
      });
      const values = result.data.results.flatMap((item: any) => item.values);
      expect(values).toEqual(expect.arrayContaining(['55', '33']));
    });
  });

  it('HTML host runDecoder 应返回 CAN fixture 结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/can.lac',
          fileName: 'can.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 1000000,
              PreTriggerSamples: 0,
              PostTriggerSamples: 128,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'CAN_RX', Hidden: false }
              ]
            },
            Samples: Array.from({ length: 128 }, (_, index) => (index % 2 === 0 ? '1' : '0'))
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      const result: any = await host.sendCommand('runDecoder', {
        decoderId: 'can',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'CAN RX' }
        ],
        options: [
          { optionIndex: 0, value: 500000 },
          { optionIndex: 1, value: 75 }
        ]
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          decoderId: 'can',
          decoderName: 'CAN HTML 模拟',
          success: true,
          executionTime: expect.any(Number),
          results: expect.any(Array),
          performanceStats: expect.objectContaining({
            totalSamples: 128,
            processingSpeed: expect.any(Number)
          })
        })
      });
      const values = result.data.results.flatMap((item: any) => item.values);
      expect(values).toEqual(expect.arrayContaining(['ID: 123', 'Data[0]: 11']));
    });
  });

  it('HTML host runDecoder 应返回 LIN fixture 结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/lin.lac',
          fileName: 'lin.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 19200,
              PreTriggerSamples: 0,
              PostTriggerSamples: 84,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'LIN_RX', Hidden: false }
              ]
            },
            Samples: Array.from({ length: 84 }, () => '1')
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      const result: any = await host.sendCommand('runDecoder', {
        decoderId: 'lin',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'LIN RX' }
        ],
        options: [
          { optionIndex: 0, value: 19200 },
          { optionIndex: 1, value: 2 },
          { optionIndex: 2, value: 'classic' }
        ]
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          decoderId: 'lin',
          decoderName: 'LIN HTML 模拟',
          success: true,
          executionTime: expect.any(Number),
          results: expect.any(Array)
        })
      });
      expect(result.data.results.map((item: any) => item.values[0])).toEqual(
        expect.arrayContaining(['Break', 'Sync: 55', 'PID: 50'])
      );
    });
  });

  it('HTML host runDecoder 应返回 I2S smoke 结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/i2s.lac',
          fileName: 'i2s.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 2000000,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'SCK', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'WS', Hidden: false },
                { ChannelNumber: 2, ChannelName: 'SD', Hidden: false }
              ]
            },
            Samples: Array.from({ length: 80 }, (_, index) => (index % 2 === 0 ? '1' : '0'))
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      const result: any = await host.sendCommand('runDecoder', {
        decoderId: 'i2s',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCK' },
          { captureIndex: 1, decoderIndex: 1, name: 'WS' },
          { captureIndex: 2, decoderIndex: 2, name: 'SD' }
        ],
        options: [
          { optionIndex: 0, value: 16 },
          { optionIndex: 1, value: 'i2s' }
        ]
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          decoderId: 'i2s',
          decoderName: 'I2S HTML 模拟',
          success: true,
          results: expect.arrayContaining([
            expect.objectContaining({ values: ['Left: A55A', 'L: A55A', 'A55A'] }),
            expect.objectContaining({ values: ['Right: 5AA5', 'R: 5AA5', '5AA5'] })
          ])
        })
      });
    });
  });

  it('HTML host runDecoder 应拒绝无样本文档', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/settings-only.lac',
          fileName: 'settings-only.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 1000000,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'SCL', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'SDA', Hidden: false }
              ]
            }
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('runDecoder', {
        decoderId: 'i2c',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
          { captureIndex: 1, decoderIndex: 1, name: 'SDA' }
        ]
      })).resolves.toEqual({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I²C HTML 模拟',
          success: false,
          executionTime: 0,
          results: [],
          error: '当前文件没有可解码样本'
        }
      });
    });
  });

  it('HTML host runDecoder 应拒绝无效采样率', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/invalid-rate.lac',
          fileName: 'invalid-rate.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 0,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'SCL', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'SDA', Hidden: false }
              ]
            },
            Samples: ['3', '1', '2', '3']
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('runDecoder', {
        decoderId: 'i2c',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
          { captureIndex: 1, decoderIndex: 1, name: 'SDA' }
        ]
      })).resolves.toEqual({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I²C HTML 模拟',
          success: false,
          executionTime: 0,
          results: [],
          error: '采样率无效，无法执行协议解码'
        }
      });
    });
  });

  it('HTML host runDecoder 应拒绝单通道 I2C 映射', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/single-channel.lac',
          fileName: 'single-channel.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 1000000,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'SCL', Hidden: false }
              ]
            },
            Samples: ['1', '0', '1', '0']
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('runDecoder', {
        decoderId: 'i2c',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
          { captureIndex: 1, decoderIndex: 1, name: 'SDA' }
        ]
      })).resolves.toEqual({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I²C HTML 模拟',
          success: false,
          executionTime: 0,
          results: [],
          error: 'I2C 解码需要 SCL 和 SDA 两个通道'
        }
      });
    });
  });

  it('HTML host runDecoder 应拒绝 SCL/SDA 同通道', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/same-channel.lac',
          fileName: 'same-channel.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 1000000,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'SCL', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'SDA', Hidden: false }
              ]
            },
            Samples: ['3', '1', '2', '3']
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('runDecoder', {
        decoderId: 'i2c',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
          { captureIndex: 0, decoderIndex: 1, name: 'SDA' }
        ]
      })).resolves.toEqual({
        success: true,
        data: {
          decoderId: 'i2c',
          decoderName: 'I²C HTML 模拟',
          success: false,
          executionTime: 0,
          results: [],
          error: 'SCL 和 SDA 不能映射到同一采集通道'
        }
      });
    });
  });

  it('HTML host runDecoder 应返回 SPI fixture 结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      window.__FRONTEND_BOOTSTRAP__ = {
        host: 'html',
        document: {
          uri: 'memory://logic-analyzer/spi.lac',
          fileName: 'spi.lac',
          content: JSON.stringify({
            Settings: {
              Frequency: 1000000,
              CaptureChannels: [
                { ChannelNumber: 0, ChannelName: 'CLK', Hidden: false },
                { ChannelNumber: 1, ChannelName: 'MISO', Hidden: false },
                { ChannelNumber: 2, ChannelName: 'MOSI', Hidden: false },
                { ChannelNumber: 3, ChannelName: 'CS', Hidden: false }
              ]
            },
            Samples: Array.from({ length: 32 }, (_, index) => (index % 2 === 0 ? '8' : '9'))
          })
        },
        capabilities: {
          canSave: false,
          canExport: true,
          canStartCapture: false,
          canConnectDevice: false
        }
      };
      const host = actual.createBrowserHost();

      const result: any = await host.sendCommand('runDecoder', {
        decoderId: 'spi',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0, name: 'CLK' },
          { captureIndex: 1, decoderIndex: 1, name: 'MISO' },
          { captureIndex: 2, decoderIndex: 2, name: 'MOSI' },
          { captureIndex: 3, decoderIndex: 3, name: 'CS' }
        ],
        options: []
      });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          decoderId: 'spi',
          decoderName: 'SPI HTML 模拟',
          success: true,
          executionTime: expect.any(Number),
          results: expect.any(Array)
        })
      });
      const values = result.data.results.flatMap((item: any) => item.values);
      expect(values).toEqual(expect.arrayContaining([
        'MISO: A5',
        'MOSI: 3C',
        'CS asserted'
      ]));
    });
  });

  it('HTML host runDecoder 应拒绝未知 decoder', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('runDecoder', {
        decoderId: 'unknown-protocol'
      })).resolves.toEqual({
        success: true,
        data: {
          decoderId: 'unknown-protocol',
          decoderName: 'unknown-protocol',
          success: false,
          executionTime: 0,
          results: [],
          error: 'Decoder not found: unknown-protocol'
        }
      });
    });
  });
});

describe('deviceCaptureCommands', () => {
  it('startCapture 成功后应应用设备状态并重新装载捕获文档', async () => {
    await jest.isolateModulesAsync(async () => {
      const { createDeviceCaptureCommands } = await import(
        '../../../src/frontend/app/composables/deviceCaptureCommands'
      );
      const deviceStore = {
        isConnected: true,
        isCapturing: false,
        captureConfig: {
          frequency: 1000000,
          preTriggerSamples: 1,
          postTriggerSamples: 3,
          triggerType: 'Edge',
          triggerChannel: 0,
          channels: [
            { number: 0, name: 'D0', enabled: true }
          ]
        },
        setCapturing: jest.fn((value: boolean) => {
          deviceStore.isCapturing = value;
        }),
        applyStatus: jest.fn()
      };
      const sessionStore = {
        applyDocument: jest.fn()
      };
      const notify = {
        error: jest.fn(),
        success: jest.fn()
      };
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: true,
          data: {
            isConnected: true,
            isCapturing: false,
            capturedDocument: {
              uri: 'file:///tmp/capture.lac',
              fileName: 'capture.lac',
              content: '{"Settings":{},"Samples":[]}'
            }
          }
        })
      };

      const actions = createDeviceCaptureCommands({
        host: host as any,
        deviceStore: deviceStore as any,
        sessionStore: sessionStore as any,
        notify
      });

      await actions.startCapture();

      expect(host.sendCommand).toHaveBeenCalledWith('startCapture', {
        config: deviceStore.captureConfig
      });
      expect(deviceStore.setCapturing).toHaveBeenNthCalledWith(1, true);
      expect(deviceStore.setCapturing).toHaveBeenLastCalledWith(false);
      expect(deviceStore.applyStatus).toHaveBeenCalledWith(expect.objectContaining({
        isConnected: true,
        isCapturing: false
      }));
      expect(sessionStore.applyDocument).toHaveBeenCalledWith({
        uri: 'file:///tmp/capture.lac',
        fileName: 'capture.lac',
        content: '{"Settings":{},"Samples":[]}'
      });
      expect(notify.error).not.toHaveBeenCalled();
    });
  });

  it('startCapture 失败时应恢复状态并保留错误反馈', async () => {
    await jest.isolateModulesAsync(async () => {
      const { createDeviceCaptureCommands } = await import(
        '../../../src/frontend/app/composables/deviceCaptureCommands'
      );
      const deviceStore = {
        isConnected: true,
        isCapturing: false,
        captureConfig: {
          frequency: 1000000,
          preTriggerSamples: 1,
          postTriggerSamples: 3,
          triggerType: 'Edge',
          triggerChannel: 0,
          channels: [
            { number: 0, name: 'D0', enabled: true }
          ]
        },
        setCapturing: jest.fn(),
        setError: jest.fn(),
        applyStatus: jest.fn()
      };
      const host = {
        sendCommand: jest.fn().mockResolvedValue({
          success: false,
          error: '采集配置无效'
        })
      };
      const notify = {
        error: jest.fn(),
        success: jest.fn()
      };

      const actions = createDeviceCaptureCommands({
        host: host as any,
        deviceStore: deviceStore as any,
        sessionStore: { applyDocument: jest.fn() } as any,
        notify
      });

      await actions.startCapture();

      expect(deviceStore.setCapturing).toHaveBeenNthCalledWith(1, true);
      expect(deviceStore.setCapturing).toHaveBeenLastCalledWith(false);
      expect(deviceStore.setError).toHaveBeenCalledWith('采集配置无效');
      expect(notify.error).toHaveBeenCalledWith('采集配置无效');
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
  beforeEach(() => {
    jest.resetModules();
    jest.unmock('../../../src/decoders/DecoderManager');
  });

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

  const mockVsCodeForProvider = () => {
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
  };

  const createProvider = async () => {
    mockProviderDependencies();
    mockVsCodeForProvider();

    const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
    return new LACEditorProvider({ extensionUri: { fsPath: '/tmp/extension' } } as any);
  };

  const createLacDocument = (content: unknown) => ({
    getText: () => JSON.stringify(content),
    save: jest.fn().mockResolvedValue(true),
    lineCount: 1,
    uri: { toString: () => 'file:///tmp/i2c.lac', fsPath: '/tmp/i2c.lac' }
  });

  const packDigitalSamples = (channels: Uint8Array[]): string[] => {
    const sampleCount = channels[0]?.length ?? 0;
    const samples: string[] = [];

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      let packed = BigInt(0);

      channels.forEach((channel, channelIndex) => {
        if (channel[sampleIndex]) {
          packed |= BigInt(1) << BigInt(channelIndex);
        }
      });

      samples.push(packed.toString(16).padStart(32, '0'));
    }

    return samples;
  };

  const generateI2CSequence = (sequence: Array<{ type: string; value?: number }>) => {
    const scl: number[] = [1, 1, 1, 1];
    const sda: number[] = [1, 1, 1, 1];

    for (const item of sequence) {
      switch (item.type) {
        case 'start':
          scl.push(1, 1, 1, 1);
          sda.push(1, 1, 0, 0);
          break;

        case 'stop':
          scl.push(1, 1, 1, 1);
          sda.push(0, 0, 1, 1);
          break;

        case 'byte':
          for (let bit = 7; bit >= 0; bit--) {
            const bitValue = ((item.value ?? 0) >> bit) & 1;
            scl.push(0, 0, 1, 1);
            sda.push(bitValue, bitValue, bitValue, bitValue);
          }
          break;

        case 'ack':
          scl.push(0, 0, 1, 1);
          sda.push(0, 0, 0, 0);
          break;

        case 'nack':
          scl.push(0, 0, 1, 1);
          sda.push(1, 1, 1, 1);
          break;
      }
    }

    return {
      scl: new Uint8Array(scl),
      sda: new Uint8Array(sda)
    };
  };

  const generateSPIMode0Transfer = () => {
    const misoBits = [1, 0, 1, 0, 0, 1, 0, 1];
    const mosiBits = [0, 0, 1, 1, 1, 1, 0, 0];
    const clk = new Uint8Array(misoBits.length * 2);
    const miso = new Uint8Array(misoBits.length * 2);
    const mosi = new Uint8Array(mosiBits.length * 2);
    const cs = new Uint8Array(misoBits.length * 2);

    for (let bitIndex = 0; bitIndex < misoBits.length; bitIndex++) {
      const sampleIndex = bitIndex * 2;
      clk[sampleIndex] = 0;
      clk[sampleIndex + 1] = 1;
      miso[sampleIndex] = misoBits[bitIndex];
      miso[sampleIndex + 1] = misoBits[bitIndex];
      mosi[sampleIndex] = mosiBits[bitIndex];
      mosi[sampleIndex + 1] = mosiBits[bitIndex];
      cs[sampleIndex] = 0;
      cs[sampleIndex + 1] = 0;
    }

    return { clk, miso, mosi, cs };
  };

  const generateUART8N1Sequence = (value: number, idlePrefix = 3, idleSuffix = 3): Uint8Array => {
    const bits = Array.from({ length: 8 }, (_, bit) => (value >> bit) & 1);
    return new Uint8Array([
      ...Array(idlePrefix).fill(1),
      0,
      ...bits,
      1,
      ...Array(idleSuffix).fill(1)
    ]);
  };

  const buildCanFrameBits = (identifier: number, data: number[]) => {
    const bits: number[] = [0];
    const pushBits = (value: number, width: number) => {
      for (let bit = width - 1; bit >= 0; bit--) {
        bits.push((value >> bit) & 1);
      }
    };

    pushBits(identifier, 11);
    bits.push(0, 0, 0);
    pushBits(data.length, 4);
    for (const byte of data) {
      pushBits(byte, 8);
    }
    bits.push(...Array.from({ length: 15 }, () => 0));
    bits.push(1, 0, 1, 1, 1, 1, 1, 1, 1);
    return bits;
  };

  const bitsToSamples = (bits: number[], samplesPerBit: number) =>
    new Uint8Array(bits.flatMap(bit => Array.from({ length: samplesPerBit }, () => bit)));

  const createI2CLacPayload = (channels: Array<{ ChannelNumber: number; ChannelName: string }>, samples?: string[]) => ({
    Settings: {
      Frequency: 1000000,
      PreTriggerSamples: 0,
      PostTriggerSamples: samples?.length ?? 0,
      CaptureChannels: channels.map(channel => ({
        ...channel,
        Hidden: false
      }))
    },
    ...(samples ? { Samples: samples } : {})
  });

  const createLINLacPayload = (channels: Array<{ ChannelNumber: number; ChannelName: string }>, samples?: string[]) => ({
    Settings: {
      Frequency: 19200,
      PreTriggerSamples: 0,
      PostTriggerSamples: samples?.length ?? 0,
      CaptureChannels: channels.map(channel => ({
        ...channel,
        Hidden: false
      }))
    },
    ...(samples ? { Samples: samples } : {})
  });

  const defaultI2CPayload = {
    decoderId: 'i2c',
    channelMapping: [
      { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
      { captureIndex: 1, decoderIndex: 1, name: 'SDA' }
    ],
    options: [
      { optionIndex: 0, value: 'shifted' }
    ]
  };

  const defaultUARTPayload = {
    decoderId: 'uart',
    channelMapping: [
      { captureIndex: 0, decoderIndex: 0, name: 'RX' },
      { captureIndex: 1, decoderIndex: 1, name: 'TX' }
    ],
    options: [
      { optionIndex: 0, value: 1000000 },
      { optionIndex: 1, value: '8' },
      { optionIndex: 2, value: 'none' },
      { optionIndex: 3, value: '1.0' }
    ]
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
          joinPath: jest.fn((...segments: Array<string | { fsPath?: string }>) =>
            segments.map(segment => typeof segment === 'string' ? segment : (segment.fsPath ?? String(segment))).join('/')
          ),
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

  it('应按 manifest 顺序注入 VSCode webview 依赖脚本', async () => {
    await jest.isolateModulesAsync(async () => {
      mockProviderDependencies();
      jest.doMock('fs', () => ({
        existsSync: jest.fn(() => true),
        readFileSync: jest.fn(() =>
          JSON.stringify({
            'main-vscode.js': 'main-vscode.js',
            'main-vscode.scripts.0': 'element-plus.js',
            'main-vscode.scripts.1': 'vue-vendor.js',
            'main-vscode.scripts.2': 'main-vscode.js'
          })
        )
      }));
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
          joinPath: jest.fn((...segments: Array<string | { fsPath?: string }>) =>
            segments.map(segment => typeof segment === 'string' ? segment : (segment.fsPath ?? String(segment))).join('/')
          ),
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

      const html = (provider as any).getHtmlForWebview({
        asWebviewUri: (value: string) => `webview:${value}`,
        cspSource: 'vscode-webview://test'
      }, {
        uri: {
          toString: () => 'file:///tmp/test.lac',
          fsPath: '/tmp/test.lac'
        },
        getText: () => '{}'
      });

      expect(html).toContain('src="webview:/tmp/extension/out/webview/element-plus.js"');
      expect(html).toContain('src="webview:/tmp/extension/out/webview/vue-vendor.js"');
      expect(html).toContain('src="webview:/tmp/extension/out/webview/main-vscode.js"');
      expect(html.indexOf('element-plus.js')).toBeLessThan(html.indexOf('vue-vendor.js'));
      expect(html.indexOf('vue-vendor.js')).toBeLessThan(html.indexOf('main-vscode.js'));
    });
  });

  it('旧版 manifest 仅包含 main-vscode.js 时仍应回退注入单脚本', async () => {
    await jest.isolateModulesAsync(async () => {
      mockProviderDependencies();
      jest.doMock('fs', () => ({
        existsSync: jest.fn(() => true),
        readFileSync: jest.fn(() =>
          JSON.stringify({
            'main-vscode.js': 'main-vscode.js'
          })
        )
      }));
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
          joinPath: jest.fn((...segments: Array<string | { fsPath?: string }>) =>
            segments.map(segment => typeof segment === 'string' ? segment : (segment.fsPath ?? String(segment))).join('/')
          ),
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

      const html = (provider as any).getHtmlForWebview({
        asWebviewUri: (value: string) => `webview:${value}`,
        cspSource: 'vscode-webview://test'
      }, {
        uri: {
          toString: () => 'file:///tmp/test.lac',
          fsPath: '/tmp/test.lac'
        },
        getText: () => '{}'
      });

      expect(html.match(/<script nonce=/g)?.length).toBe(2);
      expect(html).toContain('src="webview:/tmp/extension/out/webview/main-vscode.js"');
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

  it('executeHostCommand 应把 scanNetworkDevices 映射到 WiFi 扫描服务', async () => {
    await jest.isolateModulesAsync(async () => {
      const scanForDevices = jest.fn().mockResolvedValue([
        { ipAddress: '192.168.1.20', port: 4045, deviceName: 'Pico W' }
      ]);

      jest.doMock('../../../src/drivers/HardwareDriverManager', () => ({
        hardwareDriverManager: {
          getCurrentDevice: jest.fn(() => null),
          getCurrentDeviceInfo: jest.fn(() => null),
          disconnectCurrentDevice: jest.fn(),
          connectToDevice: jest.fn(),
          detectHardware: jest.fn()
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
          scanForDevices,
          stopScan: jest.fn(),
          getCachedDevices: jest.fn()
        }))
      }));
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

      const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
      const provider = new LACEditorProvider({ extensionUri: { fsPath: '/tmp/extension' } } as any);
      const result = await (provider as any).executeHostCommand(
        { getText: () => '{}', uri: { toString: () => 'file:///tmp/test.lac', fsPath: '/tmp/test.lac' } },
        'scanNetworkDevices',
        { timeoutMs: 250 }
      );

      expect(scanForDevices).toHaveBeenCalledWith({ timeoutMs: 250 });
      expect(result).toEqual({
        success: true,
        data: [
          { ipAddress: '192.168.1.20', port: 4045, deviceName: 'Pico W' }
        ]
      });
    });
  });

  it('startCapture host command 在无设备或非法配置时应返回稳定错误', async () => {
    await jest.isolateModulesAsync(async () => {
      const startCapture = jest.fn();
      let currentDevice: any = null;

      jest.doMock('../../../src/drivers/HardwareDriverManager', () => ({
        hardwareDriverManager: {
          getCurrentDevice: jest.fn(() => currentDevice),
          getCurrentDeviceInfo: jest.fn(() => currentDevice ? { name: 'Pico' } : null),
          disconnectCurrentDevice: jest.fn(),
          connectToDevice: jest.fn(),
          detectHardware: jest.fn()
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

      const { LACEditorProvider } = await import('../../../src/providers/LACEditorProvider');
      const provider = new LACEditorProvider({ extensionUri: { fsPath: '/tmp/extension' } } as any);
      const document = {
        getText: () => '{}',
        uri: { toString: () => 'file:///tmp/test.lac', fsPath: '/tmp/test.lac' }
      };

      await expect((provider as any).executeHostCommand(
        document,
        'startCapture',
        { config: {} }
      )).resolves.toEqual({
        success: false,
        error: '请先连接逻辑分析器设备'
      });

      currentDevice = {
        startCapture,
        isCapturing: false
      };

      await expect((provider as any).executeHostCommand(
        document,
        'startCapture',
        {
          config: {
            frequency: 0,
            preTriggerSamples: 0,
            postTriggerSamples: 0,
            triggerType: 'Edge',
            triggerChannel: 0,
            channels: [
              { number: 0, enabled: false }
            ]
          }
        }
      )).resolves.toEqual({
        success: false,
        error: '采集配置无效'
      });
      expect(startCapture).not.toHaveBeenCalled();
    });
  });

  it('executeHostCommand runDecoder 应返回 I2C 解码结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const i2c = generateI2CSequence([
        { type: 'start' },
        { type: 'byte', value: 0xA0 },
        { type: 'ack' },
        { type: 'byte', value: 0x12 },
        { type: 'ack' },
        { type: 'stop' }
      ]);
      const document = createLacDocument(createI2CLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'CH0' },
          { ChannelNumber: 1, ChannelName: 'CH1' }
        ],
        packDigitalSamples([i2c.scl, i2c.sda])
      ));

      const result = await (provider as any).executeHostCommand(
        document,
        'runDecoder',
        defaultI2CPayload
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decoderId: 'i2c',
        success: true,
        results: expect.any(Array)
      });
      expect(result.data.results.length).toBeGreaterThan(0);
      expect(result.data.results.some((item: any) =>
        item.values.includes('START') || item.values.includes('ACK')
      )).toBe(true);
    });
  });

  it('executeHostCommand runDecoder 应返回 SPI 解码结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const spi = generateSPIMode0Transfer();
      const document = createLacDocument(createI2CLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'CLK' },
          { ChannelNumber: 1, ChannelName: 'MISO' },
          { ChannelNumber: 2, ChannelName: 'MOSI' },
          { ChannelNumber: 3, ChannelName: 'CS' }
        ],
        packDigitalSamples([spi.clk, spi.miso, spi.mosi, spi.cs])
      ));

      const result = await (provider as any).executeHostCommand(
        document,
        'runDecoder',
        {
          decoderId: 'spi',
          channelMapping: [
            { captureIndex: 0, decoderIndex: 0, name: 'CLK' },
            { captureIndex: 1, decoderIndex: 1, name: 'MISO' },
            { captureIndex: 2, decoderIndex: 2, name: 'MOSI' },
            { captureIndex: 3, decoderIndex: 3, name: 'CS' }
          ],
          options: [
            { optionIndex: 0, value: 'active-low' },
            { optionIndex: 1, value: '0' },
            { optionIndex: 2, value: '0' },
            { optionIndex: 3, value: 'msb-first' },
            { optionIndex: 4, value: 8 }
          ]
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decoderId: 'spi',
        success: true,
        results: expect.any(Array)
      });
      expect(result.data.results).toEqual(expect.arrayContaining([
        expect.objectContaining({ annotationType: 0, rawData: 0xA5 }),
        expect.objectContaining({ annotationType: 1, rawData: 0x3C })
      ]));
    });
  });

  it('executeHostCommand runDecoder 应返回 CAN 解码结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const canSamples = bitsToSamples([1, 1, ...buildCanFrameBits(0x123, [0x11]), 1, 1], 2);
      const document = createLacDocument(createI2CLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'CAN_RX' }
        ],
        packDigitalSamples([canSamples])
      ));

      const result = await (provider as any).executeHostCommand(
        document,
        'runDecoder',
        {
          decoderId: 'can',
          channelMapping: [
            { captureIndex: 0, decoderIndex: 0, name: 'CAN RX' }
          ],
          options: [
            { optionIndex: 0, value: 500000 },
            { optionIndex: 1, value: 50 }
          ]
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decoderId: 'can',
        success: true,
        results: expect.any(Array)
      });
      expect(result.data.results).toEqual(expect.arrayContaining([
        expect.objectContaining({ annotationType: 1, values: ['ID: 123', '123'], rawData: 0x123 }),
        expect.objectContaining({ annotationType: 4, values: ['Data[0]: 11', '11'], rawData: 0x11 })
      ]));
    });
  });

  it('executeHostCommand runDecoder 应返回 LIN 解码结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const bits: number[] = [1, 1, ...Array.from({ length: 13 }, () => 0), 1];
      const pushByte = (byte: number) => {
        bits.push(0);
        for (let bit = 0; bit < 8; bit++) {
          bits.push((byte >> bit) & 1);
        }
        bits.push(1);
      };
      pushByte(0x55);
      pushByte(0x50);
      pushByte(0x12);
      pushByte(0x34);
      pushByte(0xb9);
      const linRx = new Uint8Array(bits);
      const document = createLacDocument(createLINLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'LIN_RX' }
        ],
        packDigitalSamples([linRx])
      ));

      const result = await (provider as any).executeHostCommand(
        document,
        'runDecoder',
        {
          decoderId: 'lin',
          channelMapping: [
            { captureIndex: 0, decoderIndex: 0, name: 'LIN RX' }
          ],
          options: [
            { optionIndex: 0, value: 19200 },
            { optionIndex: 1, value: 2 },
            { optionIndex: 2, value: 'classic' }
          ]
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decoderId: 'lin',
        success: true,
        results: expect.any(Array)
      });
      expect(result.data.results).toEqual(expect.arrayContaining([
        expect.objectContaining({ values: ['Break'] }),
        expect.objectContaining({ values: ['Sync: 55', '55'] }),
        expect.objectContaining({ values: ['PID: 50', '50'] }),
        expect.objectContaining({ values: ['Checksum: B9', 'B9'] })
      ]));
    });
  });

  it('executeHostCommand runDecoder 应向 UI 返回 Streaming I2C 元信息', async () => {
    await jest.isolateModulesAsync(async () => {
      const executeDecoder = jest.fn().mockResolvedValue({
        decoderName: 'i2c',
        success: true,
        isStreaming: true,
        executionTime: 7,
        results: [],
        performanceStats: {
          totalSamples: 1000001,
          processingSpeed: 250000,
          chunksProcessed: 201
        }
      });

      jest.doMock('../../../src/decoders/DecoderManager', () => ({
        DecoderManager: jest.fn().mockImplementation(() => ({
          getDecoder: jest.fn(() => ({})),
          getDecoderInfo: jest.fn(() => ({ id: 'i2c' })),
          executeDecoder
        }))
      }));

      const provider = await createProvider();
      const document = createLacDocument(createI2CLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'CH0' },
          { ChannelNumber: 1, ChannelName: 'CH1' }
        ],
        packDigitalSamples([new Uint8Array([1, 1]), new Uint8Array([1, 0])])
      ));

      const result = await (provider as any).executeHostCommand(
        document,
        'runDecoder',
        defaultI2CPayload
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decoderId: 'i2c',
        success: true,
        isStreaming: true,
        performanceStats: {
          totalSamples: 1000001,
          processingSpeed: 250000,
          chunksProcessed: 201
        }
      });
      expect(executeDecoder).toHaveBeenCalledWith(
        'i2c',
        1000000,
        expect.any(Array),
        defaultI2CPayload.options,
        defaultI2CPayload.channelMapping
      );
    });
  });

  it('executeHostCommand runDecoder 应返回 UART 解码结果', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const rx = generateUART8N1Sequence(0x55);
      const tx = generateUART8N1Sequence(0x33);
      const document = createLacDocument(createI2CLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'RX' },
          { ChannelNumber: 1, ChannelName: 'TX' }
        ],
        packDigitalSamples([rx, tx])
      ));

      const result = await (provider as any).executeHostCommand(
        document,
        'runDecoder',
        defaultUARTPayload
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decoderId: 'uart',
        success: true,
        results: expect.any(Array)
      });
      expect(result.data.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ annotationType: 0, values: ['55'], rawData: 0x55 }),
          expect.objectContaining({ annotationType: 1, values: ['33'], rawData: 0x33 })
        ])
      );
    });
  });

  it('runDecoder 应拒绝 settings-only 文档', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const document = createLacDocument(createI2CLacPayload([
        { ChannelNumber: 0, ChannelName: 'CH0' },
        { ChannelNumber: 1, ChannelName: 'CH1' }
      ]));

      await expect((provider as any).executeHostCommand(
        document,
        'runDecoder',
        defaultI2CPayload
      )).resolves.toEqual({
        success: false,
        error: '当前文件没有可解码样本'
      });
    });
  });

  it('runDecoder 应拒绝单通道 I2C 映射', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const samples = packDigitalSamples([new Uint8Array([1, 0, 1, 0])]);
      const document = createLacDocument(createI2CLacPayload([
        { ChannelNumber: 0, ChannelName: 'CH0' }
      ], samples));

      await expect((provider as any).executeHostCommand(
        document,
        'runDecoder',
        defaultI2CPayload
      )).resolves.toEqual({
        success: false,
        error: 'I2C 解码需要 SCL 和 SDA 两个通道'
      });
    });
  });

  it('runDecoder 应拒绝 SCL/SDA 同通道', async () => {
    await jest.isolateModulesAsync(async () => {
      const provider = await createProvider();
      const samples = packDigitalSamples([
        new Uint8Array([1, 0, 1, 0]),
        new Uint8Array([1, 1, 0, 0])
      ]);
      const document = createLacDocument(createI2CLacPayload(
        [
          { ChannelNumber: 0, ChannelName: 'CH0' },
          { ChannelNumber: 1, ChannelName: 'CH1' }
        ],
        samples
      ));

      await expect((provider as any).executeHostCommand(
        document,
        'runDecoder',
        {
          ...defaultI2CPayload,
          channelMapping: [
            { captureIndex: 0, decoderIndex: 0, name: 'SCL' },
            { captureIndex: 0, decoderIndex: 1, name: 'SDA' }
          ]
        }
      )).resolves.toEqual({
        success: false,
        error: 'SCL 和 SDA 不能映射到同一采集通道'
      });
    });
  });

  it('exportData 应从当前 LAC 文档生成真实导出文件', async () => {
    await jest.isolateModulesAsync(async () => {
      const showInformationMessage = jest.fn();
      const showSaveDialog = jest.fn().mockResolvedValue({ fsPath: '/tmp/export.csv' });
      const exportWaveformData = jest.fn().mockResolvedValue({
        success: true,
        filename: '/tmp/export.csv',
        mimeType: 'text/csv',
        size: 32
      });

      mockProviderDependencies();
      jest.doMock('../../../src/services/DataExportService', () => ({
        DataExportService: jest.fn().mockImplementation(() => ({
          initialize: jest.fn().mockResolvedValue(true),
          dispose: jest.fn().mockResolvedValue(true),
          exportWaveformData
        }))
      }));
      jest.doMock('vscode', () => ({
        commands: { executeCommand: jest.fn() },
        window: {
          registerCustomEditorProvider: jest.fn(),
          showInformationMessage,
          showErrorMessage: jest.fn(),
          showSaveDialog
        },
        workspace: {
          applyEdit: jest.fn(),
          onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
        },
        Uri: {
          joinPath: jest.fn(),
          file: jest.fn((filePath: string) => ({ fsPath: filePath }))
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
      const document = {
        getText: () => JSON.stringify({
          Settings: {
            Frequency: 1000,
            PreTriggerSamples: 0,
            PostTriggerSamples: 2,
            CaptureChannels: [
              {
                ChannelNumber: 0,
                ChannelName: 'CH0',
                Hidden: false
              }
            ]
          },
          Samples: [
            '00000000000000000000000000000001',
            '00000000000000000000000000000000'
          ]
        })
      };

      await (provider as any).exportData(document, { format: 'csv' });

      expect(showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({
        defaultUri: { fsPath: 'capture_export.csv' }
      }));
      expect(exportWaveformData).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 1000,
          captureChannels: expect.any(Array)
        }),
        'csv',
        expect.objectContaining({
          filename: '/tmp/export.csv',
          timeRange: 'all'
        })
      );
      expect(showInformationMessage).toHaveBeenCalledWith('数据已导出到: /tmp/export.csv');
    });
  });
});
