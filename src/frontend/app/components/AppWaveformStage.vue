<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue';
import { useWaveformViewport } from '../composables/useWaveformViewport';
import { createWaveformService } from '../../core/services/waveformService';
import { useSessionStore } from '../../core/stores/sessionStore';
import { useWaveformStore } from '../../core/stores/waveformStore';

const sessionStore = useSessionStore();
const waveformStore = useWaveformStore();
const { containerRef, canvasRef, renderer } = useWaveformViewport();

const title = computed(() => sessionStore.fileName || 'Logic Analyzer');
const hasRenderableSamples = computed(() =>
  sessionStore.channels.some(channel => channel.samples && channel.samples.length > 0)
);
const statusTitle = computed(() => {
  if (sessionStore.documentState === 'invalid') {
    return '文件解析失败';
  }

  if (sessionStore.documentState === 'settings-only') {
    return '已加载采集设置';
  }

  if (sessionStore.documentState === 'samples' && !hasRenderableSamples.value) {
    return '样本不可渲染';
  }

  return '等待采集数据';
});
const statusDescription = computed(() => {
  if (sessionStore.documentState === 'invalid') {
    return '当前 .lac 内容不是有效 JSON，无法装载波形数据。';
  }

  if (sessionStore.documentState === 'settings-only') {
    return '当前文件包含频率、通道和触发设置，但没有样本数组。';
  }

  if (sessionStore.documentState === 'samples' && !hasRenderableSamples.value) {
    return '检测到样本字段，但没有可见通道可用于 canvas 渲染。';
  }

  return '打开 .lac 文件或完成一次采集后会在此显示数字波形。';
});
const sampleSummary = computed(() => {
  if (!sessionStore.hasData) {
    return '';
  }

  return `${sessionStore.channels.length} 个通道 · ${sessionStore.totalSamples} 个样本 · ${sessionStore.sampleRate.toLocaleString()} Hz`;
});

let stopBinding: (() => void) | null = null;
let stopSessionBinding: (() => void) | null = null;

watch(
  renderer,
  nextRenderer => {
    stopBinding?.();
    stopSessionBinding?.();
    stopBinding = null;
    stopSessionBinding = null;

    if (!nextRenderer) {
      return;
    }

    const waveformService = createWaveformService(nextRenderer);
    stopSessionBinding = waveformService.bindSession(sessionStore);
    stopBinding = waveformService.bindViewRange(
      waveformStore,
      sessionStore
    );
  },
  {
    immediate: true
  }
);

onUnmounted(() => {
  stopBinding?.();
  stopSessionBinding?.();
  stopBinding = null;
  stopSessionBinding = null;
});

function handleWheel(event: WheelEvent): void {
  if (!sessionStore.hasData || sessionStore.totalSamples <= 0) {
    return;
  }

  event.preventDefault();

  const rect = canvasRef.value?.getBoundingClientRect();
  const width = rect?.width || 1;
  const pointerRatio = rect
    ? Math.max(0, Math.min(1, (event.clientX - rect.left) / width))
    : 0.5;
  const centerSample = waveformStore.viewRange.firstSample
    + waveformStore.viewRange.visibleSamples * pointerRatio;

  if (event.ctrlKey || event.metaKey) {
    waveformStore.zoomAt(
      centerSample,
      event.deltaY < 0 ? 1.25 : 0.8,
      sessionStore.totalSamples
    );
    return;
  }

  const panSamples = Math.max(1, Math.round(waveformStore.viewRange.visibleSamples / 12));
  waveformStore.panBySamples(event.deltaY > 0 || event.deltaX > 0 ? panSamples : -panSamples);
}

function jumpToTrigger(): void {
  waveformStore.jumpToTrigger(sessionStore.preTriggerSamples, sessionStore.totalSamples);
}
</script>

<template>
  <section
    ref="containerRef"
    class="waveform-stage"
    @wheel="handleWheel"
  >
    <canvas
      ref="canvasRef"
      class="waveform-stage__canvas"
    />

    <div
      v-if="!hasRenderableSamples"
      class="waveform-stage__overlay"
    >
      <p class="waveform-stage__label">
        {{ title }}
      </p>
      <h2 class="waveform-stage__title">
        {{ statusTitle }}
      </h2>
      <p class="waveform-stage__description">
        {{ statusDescription }}
      </p>
    </div>

    <div
      v-else
      class="waveform-stage__hud"
    >
      <span>{{ sampleSummary }}</span>
      <button
        type="button"
        class="waveform-stage__trigger-button"
        @click="jumpToTrigger"
      >
        跳转触发点
      </button>
    </div>
  </section>
</template>

<style scoped>
.waveform-stage {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.98));
}

.waveform-stage__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.waveform-stage__overlay {
  position: absolute;
  left: 24px;
  bottom: 24px;
  width: min(100% - 48px, 720px);
  padding: 20px 24px;
  border: 1px dashed rgba(56, 189, 248, 0.36);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.86);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.waveform-stage__label,
.waveform-stage__description {
  margin: 0;
  color: #94a3b8;
}

.waveform-stage__label {
  text-transform: uppercase;
  font-size: 12px;
}

.waveform-stage__title {
  margin: 8px 0 12px;
  color: #f8fafc;
  font-size: 28px;
  line-height: 1.2;
}

.waveform-stage__hud {
  position: absolute;
  right: 16px;
  top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100% - 32px);
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.78);
  color: #cbd5e1;
  font-size: 12px;
}

.waveform-stage__trigger-button {
  border: 1px solid rgba(56, 189, 248, 0.42);
  border-radius: 4px;
  background: rgba(8, 47, 73, 0.82);
  color: #e0f2fe;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 6px 8px;
}

.waveform-stage__trigger-button:hover {
  background: rgba(14, 116, 144, 0.82);
}
</style>
