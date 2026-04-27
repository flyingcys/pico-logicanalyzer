import { defineStore } from 'pinia';

export const useWaveformStore = defineStore('frontend-waveform', {
  state: () => ({
    zoomLevel: 1,
    panOffset: 0,
    viewRange: {
      firstSample: 0,
      visibleSamples: 1000
    }
  })
});
