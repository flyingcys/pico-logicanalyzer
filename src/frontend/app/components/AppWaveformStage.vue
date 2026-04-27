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

let stopBinding: (() => void) | null = null;

watch(
  renderer,
  nextRenderer => {
    stopBinding?.();
    stopBinding = null;

    if (!nextRenderer) {
      return;
    }

    stopBinding = createWaveformService(nextRenderer).bindViewRange(
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
  stopBinding = null;
});
</script>

<template>
  <section
    ref="containerRef"
    class="waveform-stage"
  >
    <canvas
      ref="canvasRef"
      class="waveform-stage__canvas"
    />

    <div class="waveform-stage__overlay">
      <p class="waveform-stage__label">
        Waveform Stage
      </p>
      <h2 class="waveform-stage__title">
        {{ title }}
      </h2>
      <p class="waveform-stage__description">
        波形画布生命周期已迁入独立组件；通道装载与复杂交互会在后续任务继续接回。
      </p>
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
</style>
