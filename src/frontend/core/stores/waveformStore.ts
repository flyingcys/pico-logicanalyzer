import { defineStore } from 'pinia';
import { AnalyzerChannel } from '../../../models/CaptureModels';

export type WaveformMarkerType = 'user' | 'trigger' | 'burst';

export interface WaveformSelection {
  startSample: number;
  endSample: number;
  channelIndex?: number;
}

export interface WaveformMarker {
  id: string;
  name: string;
  sample: number;
  type: WaveformMarkerType;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface WaveformRegion {
  id: string;
  name: string;
  startSample: number;
  endSample: number;
  sampleCount: number;
  color: string;
}

export interface WaveformMeasurement {
  channelIndex: number;
  startSample: number;
  endSample: number;
  sampleCount: number;
  timeSeconds: number;
  frequencyHz: number | null;
  dutyCycle: number | null;
  pulseWidthSeconds: number | null;
}

export interface SerializedWaveformInteractions {
  selectedRegions: WaveformRegion[];
  markers: WaveformMarker[];
}

interface LoadCaptureContextOptions {
  sampleRate: number;
  channels: AnalyzerChannel[];
  totalSamples?: number;
  preTriggerSamples?: number;
  bursts?: number[];
}

type PasteMode = 'insert' | 'overwrite';

const MARKER_COLORS: Record<WaveformMarkerType, string> = {
  user: '#00ffff',
  trigger: '#ffffff',
  burst: '#f0ffff'
};

function cloneChannel(channel: AnalyzerChannel): AnalyzerChannel {
  const cloned = channel.clone
    ? channel.clone()
    : new AnalyzerChannel(channel.channelNumber, channel.channelName);
  cloned.channelNumber = channel.channelNumber;
  cloned.channelName = channel.channelName;
  cloned.channelColor = channel.channelColor;
  cloned.hidden = channel.hidden;
  cloned.minimized = channel.minimized;
  cloned.samples = channel.samples ? new Uint8Array(channel.samples) : undefined;
  return cloned;
}

function clampSample(sample: number, totalSamples: number): number {
  const maxSample = Math.max(0, totalSamples - 1);
  return Math.max(0, Math.min(Math.floor(sample) || 0, maxSample));
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRange(
  startSample: number,
  endSample: number,
  totalSamples: number
): { startSample: number; endSample: number; sampleCount: number } {
  const start = clampSample(Math.min(startSample, endSample), totalSamples);
  const end = clampSample(Math.max(startSample, endSample), totalSamples);

  return {
    startSample: start,
    endSample: end,
    sampleCount: end - start + 1
  };
}

function spliceSamples(
  source: Uint8Array,
  startSample: number,
  deleteCount: number,
  insertSamples: Uint8Array = new Uint8Array()
): Uint8Array {
  const before = source.slice(0, startSample);
  const after = source.slice(startSample + deleteCount);
  const result = new Uint8Array(before.length + insertSamples.length + after.length);
  result.set(before, 0);
  result.set(insertSamples, before.length);
  result.set(after, before.length + insertSamples.length);
  return result;
}

function calculateTotalSamples(channels: AnalyzerChannel[], fallback = 0): number {
  return channels.reduce(
    (maxSamples, channel) => Math.max(maxSamples, channel.samples?.length ?? 0),
    fallback
  );
}

function calculateFrequency(
  samples: Uint8Array,
  sampleRate: number,
  startSample: number,
  endSample: number
): number | null {
  const risingEdges: number[] = [];

  for (let sample = startSample + 1; sample <= endSample; sample++) {
    if ((samples[sample - 1] ?? 0) === 0 && (samples[sample] ?? 0) !== 0) {
      risingEdges.push(sample);
    }
  }

  if (risingEdges.length < 2 || sampleRate <= 0) {
    return null;
  }

  const periods: number[] = [];
  for (let index = 1; index < risingEdges.length; index++) {
    periods.push(risingEdges[index] - risingEdges[index - 1]);
  }

  const averagePeriodSamples = periods.reduce((sum, period) => sum + period, 0) / periods.length;
  return averagePeriodSamples > 0 ? sampleRate / averagePeriodSamples : null;
}

function calculateDutyCycle(
  samples: Uint8Array,
  startSample: number,
  endSample: number
): number | null {
  const sampleCount = endSample - startSample + 1;
  if (sampleCount <= 0) {
    return null;
  }

  let highSamples = 0;
  for (let sample = startSample; sample <= endSample; sample++) {
    if ((samples[sample] ?? 0) !== 0) {
      highSamples++;
    }
  }

  return highSamples / sampleCount;
}

function calculatePulseWidth(
  samples: Uint8Array,
  sampleRate: number,
  startSample: number,
  endSample: number
): number | null {
  if (sampleRate <= 0) {
    return null;
  }

  let longestHighRun = 0;
  let currentRun = 0;

  for (let sample = startSample; sample <= endSample; sample++) {
    if ((samples[sample] ?? 0) !== 0) {
      currentRun++;
      longestHighRun = Math.max(longestHighRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return longestHighRun > 0 ? longestHighRun / sampleRate : null;
}

export const useWaveformStore = defineStore('frontend-waveform', {
  state: () => ({
    zoomLevel: 1,
    panOffset: 0,
    viewRange: {
      firstSample: 0,
      visibleSamples: 1000
    },
    sampleRate: 0,
    totalSamples: 0,
    channels: [] as AnalyzerChannel[],
    selection: null as WaveformSelection | null,
    markers: [] as WaveformMarker[],
    regions: [] as WaveformRegion[],
    clipboard: null as Uint8Array[] | null,
    lastMeasurement: null as WaveformMeasurement | null
  }),
  actions: {
    loadCaptureContext(options: LoadCaptureContextOptions) {
      this.sampleRate = options.sampleRate;
      this.channels = options.channels.map(cloneChannel);
      this.totalSamples = calculateTotalSamples(this.channels, options.totalSamples ?? 0);
      this.selection = null;
      this.clipboard = null;
      this.lastMeasurement = null;
      this.markers = [];
      this.regions = [];

      if (options.preTriggerSamples !== undefined) {
        this.setTriggerMarker(options.preTriggerSamples);
      }

      if (options.bursts) {
        this.setBurstMarkers(options.bursts);
      }

      this.setViewRange(
        0,
        Math.min(this.viewRange.visibleSamples, Math.max(1, this.totalSamples || 1))
      );
    },

    setViewRange(firstSample: number, visibleSamples: number) {
      const safeVisibleSamples = Math.max(1, Math.floor(visibleSamples) || 1);
      const clampedVisibleSamples =
        this.totalSamples > 0
          ? Math.min(safeVisibleSamples, this.totalSamples)
          : safeVisibleSamples;
      const maxFirstSample =
        this.totalSamples > 0
          ? Math.max(0, this.totalSamples - clampedVisibleSamples)
          : Number.MAX_SAFE_INTEGER;
      const clampedFirstSample = Math.max(
        0,
        Math.min(Math.floor(firstSample) || 0, maxFirstSample)
      );

      this.viewRange = {
        firstSample: clampedFirstSample,
        visibleSamples: clampedVisibleSamples
      };
      this.zoomLevel =
        this.totalSamples > 0 ? this.totalSamples / clampedVisibleSamples : this.zoomLevel;
      this.panOffset = clampedFirstSample;
    },

    zoom(factor: number, anchorSample?: number) {
      const nextVisibleSamples = Math.max(1, Math.round(this.viewRange.visibleSamples / factor));
      const anchor =
        anchorSample ?? this.viewRange.firstSample + Math.floor(this.viewRange.visibleSamples / 2);
      const relative =
        this.viewRange.visibleSamples > 0
          ? (anchor - this.viewRange.firstSample) / this.viewRange.visibleSamples
          : 0.5;
      const nextFirstSample = Math.round(anchor - nextVisibleSamples * relative);
      this.setViewRange(nextFirstSample, nextVisibleSamples);
    },

    pan(deltaSamples: number) {
      this.setViewRange(this.viewRange.firstSample + deltaSamples, this.viewRange.visibleSamples);
    },

    selectRange(startSample: number, endSample: number, channelIndex?: number) {
      const range = normalizeRange(startSample, endSample, Math.max(1, this.totalSamples));
      this.selection = {
        startSample: range.startSample,
        endSample: range.endSample,
        channelIndex
      };
    },

    clearSelection() {
      this.selection = null;
    },

    addMarker(
      sample: number,
      type: WaveformMarkerType = 'user',
      options: Partial<Pick<WaveformMarker, 'name' | 'color' | 'visible' | 'locked'>> = {}
    ) {
      const marker: WaveformMarker = {
        id: makeId(type),
        name:
          options.name ||
          (type === 'trigger'
            ? 'T'
            : type === 'burst'
            ? 'B'
            : `M${this.markers.filter(item => item.type === 'user').length + 1}`),
        sample: clampSample(sample, Math.max(1, this.totalSamples)),
        type,
        color: options.color || MARKER_COLORS[type],
        visible: options.visible ?? true,
        locked: options.locked ?? type !== 'user'
      };

      this.markers.push(marker);
      return marker;
    },

    removeMarker(markerId: string): boolean {
      const beforeCount = this.markers.length;
      this.markers = this.markers.filter(marker => marker.id !== markerId);
      return this.markers.length !== beforeCount;
    },

    moveMarker(markerId: string, sample: number): boolean {
      const marker = this.markers.find(item => item.id === markerId);
      if (!marker || marker.locked) {
        return false;
      }

      marker.sample = clampSample(sample, Math.max(1, this.totalSamples));
      return true;
    },

    setTriggerMarker(preTriggerSamples: number) {
      this.markers = this.markers.filter(marker => marker.type !== 'trigger');
      this.addMarker(preTriggerSamples, 'trigger', {
        name: 'T',
        locked: true
      });
    },

    setBurstMarkers(bursts: number[]) {
      this.markers = this.markers.filter(marker => marker.type !== 'burst');
      bursts.forEach((sample, index) => {
        this.addMarker(sample, 'burst', {
          name: `B${index + 1}`,
          locked: true
        });
      });
    },

    addRegion(
      startSample: number,
      endSample: number,
      name?: string,
      color = 'rgba(34, 197, 94, 0.22)'
    ) {
      const range = normalizeRange(startSample, endSample, Math.max(1, this.totalSamples));
      const region: WaveformRegion = {
        id: makeId('region'),
        name: name || `区域 ${this.regions.length + 1}`,
        startSample: range.startSample,
        endSample: range.endSample,
        sampleCount: range.sampleCount,
        color
      };

      this.regions.push(region);
      return region;
    },

    createRegionFromSelection(name?: string, color?: string) {
      if (!this.selection) {
        return null;
      }

      return this.addRegion(this.selection.startSample, this.selection.endSample, name, color);
    },

    removeRegion(regionId: string): boolean {
      const beforeCount = this.regions.length;
      this.regions = this.regions.filter(region => region.id !== regionId);
      return this.regions.length !== beforeCount;
    },

    renameRegion(regionId: string, name: string): boolean {
      const region = this.regions.find(item => item.id === regionId);
      if (!region) {
        return false;
      }

      region.name = name;
      return true;
    },

    setRegionColor(regionId: string, color: string): boolean {
      const region = this.regions.find(item => item.id === regionId);
      if (!region) {
        return false;
      }

      region.color = color;
      return true;
    },

    serializeInteractions(): SerializedWaveformInteractions {
      return {
        selectedRegions: this.regions.map(region => ({ ...region })),
        markers: this.markers.map(marker => ({ ...marker }))
      };
    },

    restoreInteractions(payload: Partial<SerializedWaveformInteractions>) {
      this.regions = (payload.selectedRegions || []).map(region => ({ ...region }));
      this.markers = (payload.markers || []).map(marker => ({ ...marker }));
    },

    measureSelection(channelIndex?: number): WaveformMeasurement | null {
      if (!this.selection) {
        return null;
      }

      const selectedChannelIndex = channelIndex ?? this.selection.channelIndex ?? 0;
      const channel = this.channels[selectedChannelIndex];
      if (!channel?.samples) {
        return null;
      }

      const range = normalizeRange(
        this.selection.startSample,
        this.selection.endSample,
        channel.samples.length
      );
      const measurement: WaveformMeasurement = {
        channelIndex: selectedChannelIndex,
        startSample: range.startSample,
        endSample: range.endSample,
        sampleCount: range.sampleCount,
        timeSeconds: this.sampleRate > 0 ? range.sampleCount / this.sampleRate : 0,
        frequencyHz: calculateFrequency(
          channel.samples,
          this.sampleRate,
          range.startSample,
          range.endSample
        ),
        dutyCycle: calculateDutyCycle(channel.samples, range.startSample, range.endSample),
        pulseWidthSeconds: calculatePulseWidth(
          channel.samples,
          this.sampleRate,
          range.startSample,
          range.endSample
        )
      };

      this.lastMeasurement = measurement;
      return measurement;
    },

    copySelection(): Uint8Array[] {
      if (!this.selection) {
        return [];
      }

      const range = normalizeRange(
        this.selection.startSample,
        this.selection.endSample,
        Math.max(1, this.totalSamples)
      );
      this.clipboard = this.channels.map(channel => {
        const samples = channel.samples || new Uint8Array();
        return samples.slice(range.startSample, range.endSample + 1);
      });

      return this.clipboard.map(samples => new Uint8Array(samples));
    },

    cutSelection(): Uint8Array[] {
      const copied = this.copySelection();
      this.deleteSelection();
      return copied;
    },

    deleteSelection(): boolean {
      if (!this.selection) {
        return false;
      }

      const range = normalizeRange(
        this.selection.startSample,
        this.selection.endSample,
        Math.max(1, this.totalSamples)
      );
      const deleteCount = range.sampleCount;
      this.channels = this.channels.map(channel => {
        const cloned = cloneChannel(channel);
        cloned.samples = spliceSamples(
          cloned.samples || new Uint8Array(),
          range.startSample,
          deleteCount
        );
        return cloned;
      });

      this.totalSamples = calculateTotalSamples(this.channels);
      this.clearSelection();
      this.setViewRange(this.viewRange.firstSample, this.viewRange.visibleSamples);
      return true;
    },

    insertSamples(sampleIndex: number, sampleCount: number, fillValue = 0) {
      const safeCount = Math.max(0, Math.floor(sampleCount) || 0);
      const insertAt = Math.max(0, Math.min(Math.floor(sampleIndex) || 0, this.totalSamples));
      const fillSamples = new Uint8Array(safeCount);
      fillSamples.fill(fillValue ? 1 : 0);

      this.channels = this.channels.map(channel => {
        const cloned = cloneChannel(channel);
        cloned.samples = spliceSamples(
          cloned.samples || new Uint8Array(),
          insertAt,
          0,
          fillSamples
        );
        return cloned;
      });
      this.totalSamples = calculateTotalSamples(this.channels);
      this.setViewRange(this.viewRange.firstSample, this.viewRange.visibleSamples);
    },

    pasteClipboard(sampleIndex: number, mode: PasteMode = 'insert'): boolean {
      if (!this.clipboard || this.clipboard.length === 0) {
        return false;
      }

      const pasteAt = Math.max(0, Math.min(Math.floor(sampleIndex) || 0, this.totalSamples));
      const pasteLength = this.clipboard[0]?.length ?? 0;
      this.channels = this.channels.map((channel, index) => {
        const cloned = cloneChannel(channel);
        const samples = cloned.samples || new Uint8Array();
        const inserted = this.clipboard![index] || new Uint8Array(pasteLength);
        cloned.samples =
          mode === 'insert'
            ? spliceSamples(samples, pasteAt, 0, inserted)
            : spliceSamples(
                samples,
                pasteAt,
                Math.min(inserted.length, Math.max(0, samples.length - pasteAt)),
                inserted
              );
        return cloned;
      });
      this.totalSamples = calculateTotalSamples(this.channels);
      this.setViewRange(this.viewRange.firstSample, this.viewRange.visibleSamples);
      return true;
    },

    shiftSelection(channelIndex: number, offsetSamples: number, fillValue = 0): boolean {
      if (!this.selection) {
        return false;
      }

      const channel = this.channels[channelIndex];
      if (!channel?.samples) {
        return false;
      }

      const range = normalizeRange(
        this.selection.startSample,
        this.selection.endSample,
        channel.samples.length
      );
      const segment = channel.samples.slice(range.startSample, range.endSample + 1);
      const shifted = new Uint8Array(segment.length);
      shifted.fill(fillValue ? 1 : 0);

      for (let index = 0; index < segment.length; index++) {
        const target = index + offsetSamples;
        if (target >= 0 && target < shifted.length) {
          shifted[target] = segment[index];
        }
      }

      const cloned = cloneChannel(channel);
      cloned.samples = new Uint8Array(channel.samples);
      cloned.samples.set(shifted, range.startSample);
      this.channels.splice(channelIndex, 1, cloned);
      return true;
    },

    panBySamples(deltaSamples: number) {
      this.pan(Math.floor(deltaSamples));
    },

    zoomAt(centerSample: number, scale: number, totalSamples = this.totalSamples) {
      const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
      const nextVisibleSamples = Math.max(
        1,
        Math.min(
          totalSamples || Number.MAX_SAFE_INTEGER,
          Math.round(this.viewRange.visibleSamples / safeScale)
        )
      );
      const centerRatio = this.viewRange.visibleSamples > 0
        ? (centerSample - this.viewRange.firstSample) / this.viewRange.visibleSamples
        : 0.5;
      const nextFirstSample = Math.round(centerSample - nextVisibleSamples * centerRatio);

      this.setViewRange(nextFirstSample, nextVisibleSamples);
    },

    jumpToTrigger(preTriggerSamples: number, totalSamples = this.totalSamples) {
      const visibleSamples = Math.min(this.viewRange.visibleSamples, Math.max(1, totalSamples));
      const firstSample = Math.max(0, preTriggerSamples - Math.floor(visibleSamples / 2));
      this.setViewRange(firstSample, visibleSamples);
    }
  }
});
