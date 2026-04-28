<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
  import { useWaveformViewport } from '../composables/useWaveformViewport';
  import { createWaveformService } from '../../core/services/waveformService';
  import { useSessionStore } from '../../core/stores/sessionStore';
  import { useWaveformStore } from '../../core/stores/waveformStore';

  const sessionStore = useSessionStore();
  const waveformStore = useWaveformStore();
  const { containerRef, canvasRef, renderer } = useWaveformViewport();

  const title = computed(() => sessionStore.fileName || 'Logic Analyzer');
  const hasSamples = computed(
    () => waveformStore.totalSamples > 0 && waveformStore.channels.length > 0
  );
  const centerSample = computed(
    () =>
      waveformStore.viewRange.firstSample + Math.floor(waveformStore.viewRange.visibleSamples / 2)
  );
  const previewMax = computed(() =>
    Math.max(0, waveformStore.totalSamples - waveformStore.viewRange.visibleSamples)
  );
  const previewStartPercent = computed(() => {
    if (waveformStore.totalSamples <= 0) {
      return 0;
    }

    return (waveformStore.viewRange.firstSample / waveformStore.totalSamples) * 100;
  });
  const previewWidthPercent = computed(() => {
    if (waveformStore.totalSamples <= 0) {
      return 100;
    }

    return Math.max(2, (waveformStore.viewRange.visibleSamples / waveformStore.totalSamples) * 100);
  });
  const documentStateText = computed(() => {
    if (sessionStore.documentState === 'invalid') {
      return '文件内容无效';
    }

    if (sessionStore.documentState === 'settings-only') {
      return '当前文件只有采集设置';
    }

    if (sessionStore.documentState === 'empty') {
      return '未加载捕获文件';
    }

    if (!hasSamples.value) {
      return '当前文件没有可渲染样本';
    }

    return '';
  });
  const measurementText = computed(() => {
    const measurement = waveformStore.lastMeasurement;
    if (!measurement) {
      return '';
    }

    const time = `${(measurement.timeSeconds * 1000).toFixed(3)} ms`;
    const frequency = measurement.frequencyHz ? `${measurement.frequencyHz.toFixed(2)} Hz` : '-';
    const duty =
      measurement.dutyCycle !== null ? `${(measurement.dutyCycle * 100).toFixed(1)}%` : '-';
    const pulse =
      measurement.pulseWidthSeconds !== null
        ? `${(measurement.pulseWidthSeconds * 1000).toFixed(3)} ms`
        : '-';

    return `${measurement.sampleCount} samples / ${time} / ${frequency} / ${duty} / ${pulse}`;
  });

  const draggingSelection = ref(false);
  const draggingPreview = ref(false);
  const selectionAnchor = ref(0);

  let stopBinding: (() => void) | null = null;

  const loadSessionIntoWaveformStore = () => {
    const hasRenderableSamples = sessionStore.channels.some(
      channel => channel.samples && channel.samples.length > 0
    );
    if (!sessionStore.hasData || !hasRenderableSamples) {
      return;
    }

    waveformStore.loadCaptureContext({
      sampleRate: sessionStore.sampleRate,
      channels: sessionStore.channels as any,
      totalSamples: sessionStore.totalSamples,
      preTriggerSamples: sessionStore.preTriggerSamples,
      bursts: sessionStore.bursts ?? undefined
    });

    if (sessionStore.selectedRegions.length > 0) {
      waveformStore.restoreInteractions({
        selectedRegions: sessionStore.selectedRegions.map(region => ({
          id: `lac_${region.firstSample}_${region.lastSample}_${region.regionName}`,
          name: region.regionName,
          startSample: region.firstSample,
          endSample: region.lastSample,
          sampleCount: Math.max(0, region.lastSample - region.firstSample + 1),
          color: region.color
        }))
      });
    }
  };

  const syncRendererState = () => {
    const nextRenderer = renderer.value;
    if (!nextRenderer) {
      return;
    }

    nextRenderer.beginUpdate();
    nextRenderer.setChannels(
      waveformStore.channels.length > 0 ? waveformStore.channels : null,
      waveformStore.sampleRate || sessionStore.sampleRate
    );
    nextRenderer.setSelection(waveformStore.selection);
    nextRenderer.setMarkers(waveformStore.markers);
    nextRenderer.clearRegions();
    nextRenderer.addRegions(
      waveformStore.regions.map(region => ({
        firstSample: region.startSample,
        lastSample: region.endSample,
        sampleCount: region.sampleCount,
        regionName: region.name,
        regionColor: region.color
      }))
    );
    nextRenderer.endUpdate();
  };

  const sampleFromPointer = (event: PointerEvent): number => {
    const canvas = canvasRef.value;
    if (!canvas || waveformStore.totalSamples <= 0) {
      return 0;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const sample =
      waveformStore.viewRange.firstSample +
      Math.floor(Math.max(0, Math.min(1, ratio)) * waveformStore.viewRange.visibleSamples);

    return Math.max(0, Math.min(sample, waveformStore.totalSamples - 1));
  };

  const addMarker = () => {
    if (!hasSamples.value) {
      return;
    }

    waveformStore.addMarker(centerSample.value, 'user');
  };

  const createRegion = () => {
    if (!hasSamples.value) {
      return;
    }

    if (!waveformStore.selection) {
      const start = waveformStore.viewRange.firstSample;
      const end = Math.min(
        waveformStore.totalSamples - 1,
        start + Math.max(1, Math.floor(waveformStore.viewRange.visibleSamples / 4))
      );
      waveformStore.selectRange(start, end);
    }

    waveformStore.createRegionFromSelection();
  };

  const measureSelection = () => {
    waveformStore.measureSelection(waveformStore.selection?.channelIndex ?? 0);
  };

  const copySelection = () => {
    waveformStore.copySelection();
  };

  const cutSelection = () => {
    waveformStore.cutSelection();
  };

  const pasteClipboard = () => {
    waveformStore.pasteClipboard(centerSample.value, 'insert');
  };

  const pasteClipboardOverwrite = () => {
    waveformStore.pasteClipboard(centerSample.value, 'overwrite');
  };

  const deleteSelection = () => {
    waveformStore.deleteSelection();
  };

  const undoLastEdit = () => {
    waveformStore.undoLastEdit();
  };

  const redoLastEdit = () => {
    waveformStore.redoLastEdit();
  };

  const zoomIn = () => waveformStore.zoom(2);
  const zoomOut = () => waveformStore.zoom(0.5);
  const fitToWindow = () =>
    waveformStore.setViewRange(0, Math.max(1, waveformStore.totalSamples || 1));
  const panLeft = () =>
    waveformStore.pan(-Math.max(1, Math.floor(waveformStore.viewRange.visibleSamples / 10)));
  const panRight = () =>
    waveformStore.pan(Math.max(1, Math.floor(waveformStore.viewRange.visibleSamples / 10)));

  const handleWaveformAction = (event: Event) => {
    const action = (event as CustomEvent<string>).detail;
    const actions: Record<string, () => void> = {
      zoomIn,
      zoomOut,
      fitToWindow,
      panLeft,
      panRight,
      addMarker,
      createRegion,
      measureSelection,
      copySelection,
      cutSelection,
      pasteClipboard,
      pasteClipboardOverwrite,
      deleteSelection,
      undoLastEdit,
      redoLastEdit
    };

    actions[action]?.();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (!hasSamples.value || event.button !== 0) {
      return;
    }

    draggingSelection.value = true;
    selectionAnchor.value = sampleFromPointer(event);
    waveformStore.selectRange(selectionAnchor.value, selectionAnchor.value);
    canvasRef.value?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!draggingSelection.value) {
      return;
    }

    waveformStore.selectRange(selectionAnchor.value, sampleFromPointer(event));
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (!draggingSelection.value) {
      return;
    }

    draggingSelection.value = false;
    waveformStore.selectRange(selectionAnchor.value, sampleFromPointer(event));
    waveformStore.measureSelection(waveformStore.selection?.channelIndex ?? 0);
    canvasRef.value?.releasePointerCapture?.(event.pointerId);
  };

  const handlePreviewInput = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    waveformStore.setViewRange(value, waveformStore.viewRange.visibleSamples);
  };

  const updatePreviewFromPointer = (event: PointerEvent) => {
    if (!hasSamples.value) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const centerSample = Math.round(
      Math.max(0, Math.min(1, ratio)) * waveformStore.totalSamples
    );
    const firstSample = centerSample - Math.floor(waveformStore.viewRange.visibleSamples / 2);

    waveformStore.setViewRange(firstSample, waveformStore.viewRange.visibleSamples);
  };

  const handlePreviewPointerDown = (event: PointerEvent) => {
    if (!hasSamples.value || event.button !== 0) {
      return;
    }

    draggingPreview.value = true;
    updatePreviewFromPointer(event);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const handlePreviewPointerMove = (event: PointerEvent) => {
    if (!draggingPreview.value) {
      return;
    }

    updatePreviewFromPointer(event);
  };

  const handlePreviewPointerUp = (event: PointerEvent) => {
    if (!draggingPreview.value) {
      return;
    }

    draggingPreview.value = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  watch(
    () => ({
      sampleRate: sessionStore.sampleRate,
      totalSamples: sessionStore.totalSamples,
      preTriggerSamples: sessionStore.preTriggerSamples,
      bursts: sessionStore.bursts ? sessionStore.bursts.join(',') : '',
      channels: sessionStore.channels
        .map(channel => `${channel.channelNumber}:${channel.hidden ? 1 : 0}:${channel.samples?.length ?? 0}`)
        .join('|'),
      regions: sessionStore.selectedRegions
        .map(region => `${region.firstSample}:${region.lastSample}:${region.regionName}`)
        .join('|')
    }),
    loadSessionIntoWaveformStore,
    {
      immediate: true
    }
  );

  watch(
    renderer,
    nextRenderer => {
      stopBinding?.();
      stopBinding = null;

      if (!nextRenderer) {
        return;
      }

      stopBinding = createWaveformService(nextRenderer).bindViewRange(waveformStore, sessionStore);
      syncRendererState();
    },
    {
      immediate: true
    }
  );

  watch(
    () => ({
      sampleRate: waveformStore.sampleRate,
      channels: waveformStore.channels,
      selection: waveformStore.selection,
      markers: waveformStore.markers,
      regions: waveformStore.regions
    }),
    syncRendererState,
    {
      deep: true,
      immediate: true
    }
  );

  onMounted(() => {
    window.addEventListener('waveform-action', handleWaveformAction);
    window.addEventListener('pointerup', handlePreviewPointerUp);
  });

  onUnmounted(() => {
    stopBinding?.();
    stopBinding = null;
    window.removeEventListener('waveform-action', handleWaveformAction);
    window.removeEventListener('pointerup', handlePreviewPointerUp);
  });
</script>

<template>
  <section ref="containerRef" class="waveform-stage">
    <canvas
      ref="canvasRef"
      class="waveform-stage__canvas"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
    />

    <div
      v-if="documentStateText"
      class="waveform-stage__state"
      data-testid="waveform-state"
    >
      {{ documentStateText }}
    </div>

    <div class="waveform-stage__toolbar">
      <div class="waveform-stage__titlebar">
        <span class="waveform-stage__title">{{ title }}</span>
        <span class="waveform-stage__meta">{{ waveformStore.totalSamples }} samples</span>
      </div>
      <div class="waveform-stage__actions">
        <button class="tool-button" title="缩小" :disabled="!hasSamples" @click="zoomOut">-</button>
        <button class="tool-button" title="放大" :disabled="!hasSamples" @click="zoomIn">+</button>
        <button class="tool-button" title="适应窗口" :disabled="!hasSamples" @click="fitToWindow">
          1:1
        </button>
        <button class="tool-button" title="添加标记" :disabled="!hasSamples" @click="addMarker">
          M
        </button>
        <button class="tool-button" title="创建区域" :disabled="!hasSamples" @click="createRegion">
          R
        </button>
        <button
          class="tool-button"
          title="测量选区"
          :disabled="!waveformStore.selection"
          @click="measureSelection"
        >
          Hz
        </button>
        <button
          class="tool-button"
          title="复制"
          :disabled="!waveformStore.selection"
          @click="copySelection"
        >
          C
        </button>
        <button
          class="tool-button"
          title="剪切"
          :disabled="!waveformStore.selection"
          @click="cutSelection"
        >
          X
        </button>
        <button
          class="tool-button"
          title="粘贴"
          :disabled="!waveformStore.clipboard"
          @click="pasteClipboard"
        >
          V
        </button>
        <button
          class="tool-button"
          title="覆盖粘贴"
          :disabled="!waveformStore.clipboard"
          @click="pasteClipboardOverwrite"
        >
          Ovr
        </button>
        <button
          class="tool-button"
          title="删除"
          :disabled="!waveformStore.selection"
          @click="deleteSelection"
        >
          Del
        </button>
        <button
          class="tool-button"
          title="撤销编辑"
          :disabled="waveformStore.undoStack.length === 0"
          @click="undoLastEdit"
        >
          Undo
        </button>
        <button
          class="tool-button"
          title="重做编辑"
          :disabled="waveformStore.redoStack.length === 0"
          @click="redoLastEdit"
        >
          Redo
        </button>
      </div>
    </div>

    <div class="waveform-stage__preview">
      <div
        class="waveform-stage__preview-track"
        data-testid="waveform-preview-track"
        @pointerdown="handlePreviewPointerDown"
        @pointermove="handlePreviewPointerMove"
        @pointerup="handlePreviewPointerUp"
        @pointercancel="handlePreviewPointerUp"
      >
        <div
          class="waveform-stage__preview-window"
          :style="{
            left: `${previewStartPercent}%`,
            width: `${previewWidthPercent}%`
          }"
        />
      </div>
      <input
        class="waveform-stage__preview-input"
        type="range"
        min="0"
        :max="previewMax"
        :value="waveformStore.viewRange.firstSample"
        :disabled="!hasSamples"
        @input="handlePreviewInput"
      />
    </div>

    <div v-if="measurementText" class="waveform-stage__measurement">
      {{ measurementText }}
    </div>
  </section>
</template>

<style scoped>
  .waveform-stage {
    position: relative;
    min-height: 100%;
    overflow: hidden;
    background: #111827;
  }

  .waveform-stage__canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .waveform-stage__state {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 48px;
    color: #cbd5e1;
    font-size: 14px;
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(17, 24, 39, 0.9));
    pointer-events: none;
  }

  .waveform-stage__toolbar {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 6px;
    background: rgba(17, 24, 39, 0.88);
  }

  .waveform-stage__titlebar {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .waveform-stage__title {
    overflow: hidden;
    color: #f8fafc;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .waveform-stage__meta {
    color: #94a3b8;
    font-size: 12px;
    white-space: nowrap;
  }

  .waveform-stage__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
  }

  .tool-button {
    min-width: 34px;
    height: 28px;
    border: 1px solid rgba(148, 163, 184, 0.26);
    border-radius: 5px;
    background: rgba(31, 41, 55, 0.92);
    color: #e5e7eb;
    font: 12px/1 monospace;
  }

  .tool-button:not(:disabled):hover {
    border-color: rgba(56, 189, 248, 0.7);
    color: #ffffff;
  }

  .tool-button:disabled {
    color: #64748b;
    cursor: not-allowed;
  }

  .waveform-stage__preview {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    height: 28px;
  }

  .waveform-stage__preview-track {
    position: absolute;
    inset: 8px 0;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.82);
    touch-action: none;
  }

  .waveform-stage__preview-window {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 3px;
    background: rgba(56, 189, 248, 0.34);
  }

  .waveform-stage__preview-input {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
  }

  .waveform-stage__measurement {
    position: absolute;
    left: 12px;
    bottom: 48px;
    max-width: calc(100% - 24px);
    padding: 6px 8px;
    border-radius: 5px;
    background: rgba(3, 7, 18, 0.78);
    color: #d1fae5;
    font: 12px/1.4 monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
