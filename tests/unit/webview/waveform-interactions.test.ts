/**
 * @jest-environment jsdom
 */

import { createPinia, setActivePinia } from 'pinia';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';
import { WaveformRenderer } from '../../../src/frontend/core/engines/WaveformRenderer';
import { useWaveformStore } from '../../../src/frontend/core/stores/waveformStore';

function createChannel(channelNumber: number, samples: number[]): AnalyzerChannel {
  const channel = new AnalyzerChannel(channelNumber, `CH${channelNumber}`);
  channel.samples = Uint8Array.from(samples);
  return channel;
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
});
