import { defineStore } from 'pinia';

export const useWaveformStore = defineStore('frontend-waveform', {
  state: () => ({
    zoomLevel: 1,
    panOffset: 0,
    viewRange: {
      firstSample: 0,
      visibleSamples: 1000
    }
  }),
  actions: {
    setViewRange(firstSample: number, visibleSamples: number) {
      this.viewRange = {
        firstSample: Math.max(0, Math.floor(firstSample) || 0),
        visibleSamples: Math.max(1, Math.floor(visibleSamples) || 1)
      };
      this.panOffset = this.viewRange.firstSample;
      this.zoomLevel = 1000 / this.viewRange.visibleSamples;
    },
    panBySamples(deltaSamples: number) {
      this.setViewRange(
        this.viewRange.firstSample + Math.floor(deltaSamples),
        this.viewRange.visibleSamples
      );
    },
    zoomAt(centerSample: number, scale: number, totalSamples: number) {
      const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      const nextVisibleSamples = Math.max(
        1,
        Math.min(totalSamples || Number.MAX_SAFE_INTEGER, Math.round(this.viewRange.visibleSamples / safeScale))
      );
      const centerRatio = this.viewRange.visibleSamples > 0
        ? (centerSample - this.viewRange.firstSample) / this.viewRange.visibleSamples
        : 0.5;
      const nextFirstSample = Math.round(centerSample - nextVisibleSamples * centerRatio);

      this.setViewRange(nextFirstSample, nextVisibleSamples);
    },
    jumpToTrigger(preTriggerSamples: number, totalSamples: number) {
      const visibleSamples = Math.min(this.viewRange.visibleSamples, Math.max(1, totalSamples));
      const firstSample = Math.max(0, preTriggerSamples - Math.floor(visibleSamples / 2));
      this.setViewRange(firstSample, visibleSamples);
    }
  }
});
