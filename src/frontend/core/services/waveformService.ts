import { watch, type WatchStopHandle } from 'vue';

interface WaveformViewRange {
  firstSample: number;
  visibleSamples: number;
}

export interface WaveformViewportRenderer {
  updateVisibleSamples(firstSample: number, visibleSamples: number): void;
}

interface WaveformStoreLike {
  viewRange: WaveformViewRange;
  $patch(state: { viewRange: WaveformViewRange }): void;
}

interface SessionStoreLike {
  totalSamples: number;
}

function normalizeViewRange(
  viewRange: WaveformViewRange,
  totalSamples: number
): WaveformViewRange {
  const safeVisibleSamples = Math.max(1, Math.floor(viewRange.visibleSamples) || 1);
  const visibleSamples = totalSamples > 0
    ? Math.min(safeVisibleSamples, totalSamples)
    : safeVisibleSamples;
  const maxFirstSample = totalSamples > 0
    ? Math.max(0, totalSamples - visibleSamples)
    : Number.MAX_SAFE_INTEGER;
  const firstSample = Math.max(
    0,
    Math.min(Math.floor(viewRange.firstSample) || 0, maxFirstSample)
  );

  return {
    firstSample,
    visibleSamples
  };
}

export function createWaveformService(renderer: WaveformViewportRenderer) {
  const applyViewRange = (
    viewRange: WaveformViewRange,
    totalSamples = 0
  ): WaveformViewRange => {
    const normalizedRange = normalizeViewRange(viewRange, totalSamples);
    renderer.updateVisibleSamples(
      normalizedRange.firstSample,
      normalizedRange.visibleSamples
    );
    return normalizedRange;
  };

  const bindViewRange = (
    waveformStore: WaveformStoreLike,
    sessionStore?: SessionStoreLike
  ): WatchStopHandle => watch(
    () => ({
      firstSample: waveformStore.viewRange.firstSample,
      visibleSamples: waveformStore.viewRange.visibleSamples,
      totalSamples: sessionStore?.totalSamples ?? 0
    }),
    ({ firstSample, visibleSamples, totalSamples }) => {
      const normalizedRange = applyViewRange(
        { firstSample, visibleSamples },
        totalSamples
      );

      if (
        normalizedRange.firstSample !== waveformStore.viewRange.firstSample
        || normalizedRange.visibleSamples !== waveformStore.viewRange.visibleSamples
      ) {
        waveformStore.$patch({
          viewRange: normalizedRange
        });
      }
    },
    {
      immediate: true
    }
  );

  return {
    applyViewRange,
    bindViewRange
  };
}
