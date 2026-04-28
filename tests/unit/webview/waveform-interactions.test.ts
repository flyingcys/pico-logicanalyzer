/**
 * @jest-environment jsdom
 */

import { createPinia, setActivePinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import AppWaveformStage from '../../../src/frontend/app/components/AppWaveformStage.vue';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';
import { WaveformRenderer } from '../../../src/frontend/core/engines/WaveformRenderer';
import {
  buildWebviewExportRequest,
  mergeWaveformRegionsIntoLacDocument
} from '../../../src/frontend/core/services/exportRequestService';
import { useSessionStore } from '../../../src/frontend/core/stores/sessionStore';
import { useWaveformStore } from '../../../src/frontend/core/stores/waveformStore';

function createChannel(channelNumber: number, samples: number[]): AnalyzerChannel {
  const channel = new AnalyzerChannel(channelNumber, `CH${channelNumber}`);
  channel.samples = Uint8Array.from(samples);
  return channel;
}

function mountWaveformStage() {
  const mountPoint = document.createElement('div');
  document.body.appendChild(mountPoint);
  const app = createApp(AppWaveformStage);
  app.mount(mountPoint);

  return {
    element: mountPoint,
    async next() {
      await nextTick();
      await Promise.resolve();
    },
    unmount() {
      app.unmount();
      mountPoint.remove();
    }
  };
}

describe('waveformStore 交互状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('应创建选区、marker、trigger marker、burst marker 并可序列化恢复', () => {
    const store = useWaveformStore();
    store.loadCaptureContext({
      sampleRate: 1000000,
      channels: [createChannel(0, [0, 1, 1, 0, 0, 1, 1, 0])],
      preTriggerSamples: 3,
      bursts: [5]
    });

    store.selectRange(6, 2, 0);
    const region = store.createRegionFromSelection('启动窗口', '#22c55e');
    const userMarker = store.addMarker(4, 'user', { name: 'M1' });

    expect(store.selection).toEqual({
      startSample: 2,
      endSample: 6,
      channelIndex: 0
    });
    expect(region).toMatchObject({
      name: '启动窗口',
      startSample: 2,
      endSample: 6,
      sampleCount: 5,
      color: '#22c55e'
    });
    expect(userMarker).toMatchObject({
      name: 'M1',
      sample: 4,
      type: 'user'
    });
    expect(store.markers.map(marker => marker.type)).toEqual(['trigger', 'burst', 'user']);

    const snapshot = store.serializeInteractions();
    const restored = useWaveformStore();
    restored.restoreInteractions(snapshot);

    expect(restored.regions).toHaveLength(1);
    expect(restored.regions[0]).toMatchObject({
      name: '启动窗口',
      startSample: 2,
      endSample: 6
    });
    expect(restored.markers.map(marker => marker.type)).toEqual(['trigger', 'burst', 'user']);
  });

  it('应测量选区的样本数、时间、频率、占空比和脉宽', () => {
    const store = useWaveformStore();
    store.loadCaptureContext({
      sampleRate: 8,
      channels: [createChannel(0, [0, 0, 1, 1, 0, 0, 1, 1])]
    });

    store.selectRange(0, 7, 0);
    const measurement = store.measureSelection(0);

    expect(measurement).toMatchObject({
      channelIndex: 0,
      startSample: 0,
      endSample: 7,
      sampleCount: 8,
      timeSeconds: 1,
      frequencyHz: 2,
      dutyCycle: 0.5,
      pulseWidthSeconds: 0.25
    });
    expect(store.lastMeasurement).toEqual(measurement);
  });

  it('应支持复制、剪切、插入、粘贴、删除和选区移位', () => {
    const store = useWaveformStore();
    store.loadCaptureContext({
      sampleRate: 1000000,
      channels: [createChannel(0, [0, 1, 1, 0, 0, 1]), createChannel(1, [1, 1, 0, 0, 1, 1])]
    });

    store.selectRange(1, 3);
    expect(store.copySelection()).toEqual([Uint8Array.from([1, 1, 0]), Uint8Array.from([1, 0, 0])]);

    store.cutSelection();
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 0, 1]);
    expect(Array.from(store.channels[1].samples!)).toEqual([1, 1, 1]);
    expect(store.totalSamples).toBe(3);

    store.insertSamples(1, 2, 0);
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 0, 0, 0, 1]);

    store.pasteClipboard(2, 'insert');
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 0, 1, 1, 0, 0, 0, 1]);
    expect(Array.from(store.channels[1].samples!)).toEqual([1, 0, 1, 0, 0, 0, 1, 1]);

    store.selectRange(1, 4);
    store.shiftSelection(0, 1, 0);
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 0, 0, 1, 1, 0, 0, 1]);

    store.deleteSelection();
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 0, 0, 1]);
    expect(store.totalSamples).toBe(4);
  });

  it('应支持覆盖粘贴、编辑撤销重做和历史边界', () => {
    const store = useWaveformStore();
    store.loadCaptureContext({
      sampleRate: 1000000,
      channels: [createChannel(0, [0, 1, 0, 1, 0]), createChannel(1, [1, 0, 1, 0, 1])]
    });

    expect(store.undoLastEdit()).toBe(false);
    expect(store.redoLastEdit()).toBe(false);

    store.selectRange(1, 2);
    store.copySelection();
    expect(store.pasteClipboard(3, 'overwrite')).toBe(true);
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 1, 0, 1, 0]);
    expect(Array.from(store.channels[1].samples!)).toEqual([1, 0, 1, 0, 1]);

    store.insertSamples(2, 2, 1);
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 1, 1, 1, 0, 1, 0]);
    expect(store.totalSamples).toBe(7);

    expect(store.undoLastEdit()).toBe(true);
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 1, 0, 1, 0]);
    expect(store.totalSamples).toBe(5);

    expect(store.redoLastEdit()).toBe(true);
    expect(Array.from(store.channels[0].samples!)).toEqual([0, 1, 1, 1, 0, 1, 0]);
    expect(store.totalSamples).toBe(7);
  });

  it('应导出可回写到 lac SelectedRegions 的区域并限制大样本编辑耗时', () => {
    const store = useWaveformStore();
    const samples = new Array(20000).fill(0).map((_, index) => index % 2);
    store.loadCaptureContext({
      sampleRate: 1000000,
      channels: [createChannel(0, samples)]
    });

    store.selectRange(19980, 21000);
    const region = store.createRegionFromSelection('尾部窗口', 'rgba(34, 197, 94, 0.220)');
    expect(region).toMatchObject({
      startSample: 19980,
      endSample: 19999,
      sampleCount: 20
    });

    const startedAt = performance.now();
    store.deleteSelection();
    const elapsedMs = performance.now() - startedAt;

    expect(store.totalSamples).toBe(19980);
    expect(elapsedMs).toBeLessThan(50);
    expect(store.exportSelectedRegionsForLac()).toEqual([
      {
        firstSample: 19980,
        lastSample: 19999,
        regionName: '尾部窗口',
        color: 'rgba(34, 197, 94, 0.220)'
      }
    ]);
  });
});

describe('Webview 导出与区域保存请求', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('应把选区、真实通道号、区域、marker 和测量状态放入导出请求', () => {
    const sessionStore = useSessionStore();
    const waveformStore = useWaveformStore();

    waveformStore.loadCaptureContext({
      sampleRate: 1000000,
      channels: [
        createChannel(2, [0, 1, 0, 1, 0, 1]),
        createChannel(8, [1, 1, 0, 0, 1, 1])
      ]
    });
    waveformStore.selectRange(1, 4, 1);
    waveformStore.createRegionFromSelection('导出窗口', 'rgba(34, 197, 94, 0.220)');
    waveformStore.addMarker(3, 'user', { name: 'M1' });
    waveformStore.measureSelection(1);
    waveformStore.setViewRange(2, 3);

    const payload = buildWebviewExportRequest(sessionStore, waveformStore, 'vcd');

    expect(payload).toMatchObject({
      source: 'webview',
      format: 'vcd',
      timeRange: 'custom',
      customStart: 1,
      customEnd: 5,
      selectedChannels: [2, 8],
      selection: {
        startSample: 1,
        endSample: 4,
        channelIndex: 1
      },
      visibleRange: {
        firstSample: 2,
        visibleSamples: 3
      },
      selectedRegions: [
        {
          firstSample: 1,
          lastSample: 4,
          regionName: '导出窗口',
          color: 'rgba(34, 197, 94, 0.220)'
        }
      ],
      markers: [
        expect.objectContaining({
          name: 'M1',
          sample: 3,
          type: 'user'
        })
      ],
      measurement: expect.objectContaining({
        channelIndex: 1,
        startSample: 1,
        endSample: 4
      })
    });
  });

  it('应把 Webview 区域保存为 .lac SelectedRegions，不把 marker/测量状态写入 .lac', () => {
    const waveformStore = useWaveformStore();
    waveformStore.loadCaptureContext({
      sampleRate: 1000000,
      channels: [createChannel(0, [0, 1, 0, 1, 0])]
    });
    waveformStore.selectRange(1, 3);
    waveformStore.createRegionFromSelection('保存窗口', 'rgba(10, 20, 30, 0.500)');
    waveformStore.addMarker(2, 'user', { name: 'M1' });
    waveformStore.measureSelection(0);

    const savedContent = mergeWaveformRegionsIntoLacDocument(
      JSON.stringify({
        Settings: {
          Frequency: 1000000,
          CaptureChannels: [{ ChannelNumber: 0, ChannelName: 'D0' }]
        },
        Samples: ['0', '1', '0', '1', '0']
      }),
      waveformStore
    );
    const parsed = JSON.parse(savedContent);

    expect(parsed.SelectedRegions).toEqual([
      {
        FirstSample: 1,
        LastSample: 3,
        RegionName: '保存窗口',
        R: 10,
        G: 20,
        B: 30,
        A: 128
      }
    ]);
    expect(parsed.Markers).toBeUndefined();
    expect(parsed.Measurement).toBeUndefined();
  });
});

describe('sessionStore 真实 .lac 样本装载', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('应从 lowercase root samples 推导 totalSamples 并解包到通道样本', () => {
    const sessionStore = useSessionStore();

    sessionStore.applyDocument({
      uri: 'file:///tmp/lowercase-root-samples.lac',
      fileName: 'lowercase-root-samples.lac',
      content: JSON.stringify({
        captureSession: {
          sampleRate: 2000000,
          captureChannels: [
            { channelNumber: 0, channelName: 'D0' },
            { channelNumber: 1, channelName: 'D1' }
          ]
        },
        samples: ['1', '2', '3', '0']
      })
    });

    expect(sessionStore.documentState).toBe('samples');
    expect(sessionStore.totalSamples).toBe(4);
    expect(Array.from(sessionStore.channels[0].samples!)).toEqual([1, 0, 1, 0]);
    expect(Array.from(sessionStore.channels[1].samples!)).toEqual([0, 1, 1, 0]);
  });
});

describe('AppWaveformStage 文档状态', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('应为空文件、settings-only 和 invalid 文件显示对应状态，并在 samples 状态移除状态层', async () => {
    const sessionStore = useSessionStore();

    const wrapper = mountWaveformStage();

    sessionStore.applyDocument({
      uri: 'file:///tmp/empty.lac',
      fileName: 'empty.lac',
      content: ''
    });
    await wrapper.next();
    expect(wrapper.element.querySelector('[data-testid="waveform-state"]')?.textContent).toContain('未加载捕获文件');

    sessionStore.applyDocument({
      uri: 'file:///tmp/settings-only.lac',
      fileName: 'settings-only.lac',
      content: JSON.stringify({
        Settings: {
          Frequency: 1000000,
          CaptureChannels: [{ ChannelNumber: 0, ChannelName: 'D0' }]
        }
      })
    });
    await wrapper.next();
    expect(wrapper.element.querySelector('[data-testid="waveform-state"]')?.textContent).toContain('当前文件只有采集设置');

    sessionStore.applyDocument({
      uri: 'file:///tmp/invalid.lac',
      fileName: 'invalid.lac',
      content: '{bad json'
    });
    await wrapper.next();
    expect(wrapper.element.querySelector('[data-testid="waveform-state"]')?.textContent).toContain('文件内容无效');

    sessionStore.applyDocument({
      uri: 'file:///tmp/samples.lac',
      fileName: 'samples.lac',
      content: JSON.stringify({
        captureSession: {
          sampleRate: 1000000,
          totalSamples: 4,
          captureChannels: [{ channelNumber: 0, channelName: 'D0', samples: [0, 1, 0, 1] }]
        }
      })
    });
    await wrapper.next();
    expect(wrapper.element.querySelector('[data-testid="waveform-state"]')).toBeNull();

    wrapper.unmount();
  });

  it('应支持拖动预览条改变基础视口位置', async () => {
    const sessionStore = useSessionStore();
    sessionStore.applyDocument({
      uri: 'file:///tmp/preview.lac',
      fileName: 'preview.lac',
      content: JSON.stringify({
        captureSession: {
          sampleRate: 1000000,
          totalSamples: 100,
          captureChannels: [
            {
              channelNumber: 0,
              channelName: 'D0',
              samples: Array.from({ length: 100 }, (_, index) => index % 2)
            }
          ]
        }
      })
    });

    const wrapper = mountWaveformStage();
    const waveformStore = useWaveformStore();
    waveformStore.setViewRange(0, 20);
    await wrapper.next();

    const pointerEvent = new MouseEvent('pointerdown', {
      button: 0,
      clientX: 640,
      bubbles: true
    }) as PointerEvent;
    Object.defineProperty(pointerEvent, 'pointerId', {
      value: 1
    });

    const previewTrack = wrapper.element.querySelector('[data-testid="waveform-preview-track"]');
    Object.defineProperty(previewTrack, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        width: 1280,
        height: 16,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 16,
        toJSON: () => ({})
      })
    });

    previewTrack?.dispatchEvent(pointerEvent);
    await wrapper.next();

    expect(waveformStore.viewRange).toEqual({
      firstSample: 40,
      visibleSamples: 20
    });

    wrapper.unmount();
  });
});

describe('WaveformRenderer 交互覆盖层', () => {
  it('应接收选区、多个 marker、区域并参与渲染', () => {
    const canvas = document.createElement('canvas');
    const renderer = new WaveformRenderer(canvas);

    renderer.setChannels([createChannel(0, [0, 1, 0, 1])], 1000000);
    renderer.updateVisibleSamples(0, 4);
    renderer.setSelection({ startSample: 1, endSample: 3, channelIndex: 0 });
    renderer.setMarkers([
      {
        id: 'trigger',
        name: 'T',
        sample: 1,
        type: 'trigger',
        color: '#ffffff',
        visible: true,
        locked: true
      },
      {
        id: 'user',
        name: 'M1',
        sample: 2,
        type: 'user',
        color: '#00ffff',
        visible: true,
        locked: false
      }
    ]);
    renderer.addRegion({
      firstSample: 1,
      lastSample: 3,
      sampleCount: 3,
      regionName: '窗口',
      regionColor: 'rgba(34, 197, 94, 0.2)'
    });

    renderer.render();

    expect(renderer.selection).toEqual({
      startSample: 1,
      endSample: 3,
      channelIndex: 0
    });
    expect(renderer.markers.map(marker => marker.type)).toEqual(['trigger', 'user']);
    expect(renderer.regions).toHaveLength(1);
  });

  it('首个通道无样本时仍应渲染后续可见真实样本通道', () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d') as CanvasRenderingContext2D & {
      stroke: jest.Mock;
    };
    jest.spyOn(canvas, 'getContext').mockReturnValue(context);
    const renderer = new WaveformRenderer(canvas);
    const emptyChannel = createChannel(0, []);
    const dataChannel = createChannel(1, [0, 1, 0, 1]);

    renderer.setChannels([emptyChannel, dataChannel], 1000000);
    renderer.updateVisibleSamples(0, 4);
    renderer.render();

    expect(context.stroke).toHaveBeenCalled();
  });
});
