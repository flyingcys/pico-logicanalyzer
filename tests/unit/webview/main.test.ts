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
            executionTime: 4,
            results: [
              { startSample: 1, endSample: 2, annotationType: 0, values: ['START'] },
              { startSample: 3, endSample: 4, annotationType: 1, values: ['ACK'] },
              { startSample: 5, endSample: 6, annotationType: 2, values: ['STOP'] }
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

  it('HTML host runDecoder 应拒绝未知 decoder', async () => {
    await jest.isolateModulesAsync(async () => {
      const actual = await import('../../../src/frontend/platform/host/browserHost');
      const host = actual.createBrowserHost();

      await expect(host.sendCommand('runDecoder', {
        decoderId: 'uart'
      })).resolves.toEqual({
        success: true,
        data: {
          decoderId: 'uart',
          decoderName: 'uart',
          success: false,
          executionTime: 0,
          results: [],
          error: 'Decoder not found: uart'
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
