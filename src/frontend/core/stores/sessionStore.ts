import { defineStore } from 'pinia';
import type { FrontendDocumentData } from '../../platform/host/types';

export type FrontendDocumentState = 'empty' | 'invalid' | 'settings-only' | 'samples';

export interface FrontendAnalyzerChannel {
  channelNumber: number;
  channelName: string;
  channelColor?: number;
  hidden: boolean;
  minimized?: boolean;
  samples?: Uint8Array;
}

export interface FrontendSampleRegion {
  firstSample: number;
  lastSample: number;
  regionName: string;
  color: string;
}

interface SessionState {
  fileName: string;
  sampleRate: number;
  totalSamples: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  loopCount: number;
  hasData: boolean;
  documentState: FrontendDocumentState;
  channels: FrontendAnalyzerChannel[];
  selectedRegions: FrontendSampleRegion[];
  bursts: number[] | null;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function readBoolean(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return false;
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

function readArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function readRootPayload(documentContent: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(documentContent);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readSessionPayload(rootPayload: JsonRecord): JsonRecord {
  if (isRecord(rootPayload.Settings)) {
    return rootPayload.Settings;
  }

  if (isRecord(rootPayload.captureSession)) {
    return rootPayload.captureSession;
  }

  return rootPayload;
}

function deriveTotalSamples(sessionPayload: JsonRecord): number {
  const explicitTotalSamples = readNumber(sessionPayload.totalSamples, sessionPayload.TotalSamples);
  if (explicitTotalSamples > 0) {
    return explicitTotalSamples;
  }

  const preTriggerSamples = readNumber(sessionPayload.preTriggerSamples, sessionPayload.PreTriggerSamples);
  const postTriggerSamples = readNumber(sessionPayload.postTriggerSamples, sessionPayload.PostTriggerSamples);
  const loopCount = readNumber(sessionPayload.loopCount, sessionPayload.LoopCount);

  if (preTriggerSamples > 0 || postTriggerSamples > 0) {
    return preTriggerSamples + postTriggerSamples * (loopCount + 1);
  }

  return 0;
}

function inferTotalSamplesFromSamples(
  rootPayload: JsonRecord,
  channels: FrontendAnalyzerChannel[]
): number {
  const rootSamples = readArray(rootPayload.Samples, rootPayload.samples);
  const channelSampleCount = channels.reduce(
    (maxSamples, channel) => Math.max(maxSamples, channel.samples?.length ?? 0),
    0
  );

  return Math.max(rootSamples.length, channelSampleCount);
}

function hasRootSamples(rootPayload: JsonRecord): boolean {
  const samples = readArray(rootPayload.Samples, rootPayload.samples);
  return samples.length > 0;
}

function hasChannelSamples(sessionPayload: JsonRecord): boolean {
  const captureChannels = readArray(
    sessionPayload.captureChannels,
    sessionPayload.CaptureChannels,
    sessionPayload.channels,
    sessionPayload.Channels
  );
  if (captureChannels.length === 0) {
    return false;
  }

  return captureChannels.some(channel => {
    if (!isRecord(channel)) {
      return false;
    }

    const samples = channel.samples ?? channel.Samples;
    if (Array.isArray(samples)) {
      return samples.length > 0;
    }

    if (typeof samples === 'string') {
      return samples.length > 0;
    }

    return false;
  });
}

function detectHasData(rootPayload: JsonRecord, sessionPayload: JsonRecord): boolean {
  return hasRootSamples(rootPayload) || hasChannelSamples(sessionPayload);
}

function normalizeSampleArray(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value.map(sample => sample ? 1 : 0));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[01]+$/.test(trimmed)) {
      return new Uint8Array([...trimmed].map(sample => sample === '1' ? 1 : 0));
    }
  }

  return undefined;
}

function parseUInt128(value: unknown): bigint | null {
  try {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return BigInt(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      if (trimmed.startsWith('0x') || /^[0-9a-fA-F]+$/.test(trimmed)) {
        return BigInt(trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`);
      }
    }
  } catch {
    return null;
  }

  return null;
}

function readChannels(sessionPayload: JsonRecord, rootPayload: JsonRecord): FrontendAnalyzerChannel[] {
  const channelPayloads = readArray(
    sessionPayload.captureChannels,
    sessionPayload.CaptureChannels,
    sessionPayload.channels,
    sessionPayload.Channels
  );
  const rootSamples = readArray(rootPayload.Samples, rootPayload.samples);

  return channelPayloads
    .filter(isRecord)
    .map((channelPayload, index) => {
      const channelNumber = readNumber(channelPayload.channelNumber, channelPayload.ChannelNumber, index);
      const channelName = readString(
        channelPayload.channelName,
        channelPayload.ChannelName,
        `Channel ${channelNumber + 1}`
      );
      const samples = normalizeSampleArray(channelPayload.samples ?? channelPayload.Samples)
        ?? extractChannelSamples(rootSamples, channelNumber);

      const channel: FrontendAnalyzerChannel = {
        channelNumber,
        channelName,
        hidden: readBoolean(channelPayload.hidden, channelPayload.Hidden),
        minimized: readBoolean(channelPayload.minimized, channelPayload.Minimized)
      };

      const channelColor = readNumber(channelPayload.channelColor, channelPayload.ChannelColor);
      if (channelColor > 0) {
        channel.channelColor = channelColor;
      }

      if (samples && samples.length > 0) {
        channel.samples = samples;
      }

      return channel;
    });
}

function extractChannelSamples(rootSamples: unknown[], channelNumber: number): Uint8Array | undefined {
  if (rootSamples.length === 0 || channelNumber < 0 || channelNumber >= 128) {
    return undefined;
  }

  const mask = BigInt(1) << BigInt(channelNumber);
  const samples = new Uint8Array(rootSamples.length);

  rootSamples.forEach((sample, index) => {
    const packedSample = parseUInt128(sample);
    samples[index] = packedSample !== null && (packedSample & mask) !== BigInt(0) ? 1 : 0;
  });

  return samples;
}

function readSelectedRegions(rootPayload: JsonRecord): FrontendSampleRegion[] {
  return readArray(rootPayload.SelectedRegions, rootPayload.selectedRegions)
    .filter(isRecord)
    .map(region => {
      const r = Math.max(0, Math.min(255, readNumber(region.R, region.r)));
      const g = Math.max(0, Math.min(255, readNumber(region.G, region.g)));
      const b = Math.max(0, Math.min(255, readNumber(region.B, region.b)));
      const a = Math.max(0, Math.min(255, readNumber(region.A, region.a, 255)));

      return {
        firstSample: readNumber(region.FirstSample, region.firstSample),
        lastSample: readNumber(region.LastSample, region.lastSample),
        regionName: readString(region.RegionName, region.regionName),
        color: `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
      };
    });
}

function readBursts(sessionPayload: JsonRecord): number[] | null {
  const bursts = readArray(sessionPayload.bursts, sessionPayload.Bursts)
    .map(burst => {
      if (typeof burst === 'number' && Number.isFinite(burst)) {
        return burst;
      }

      if (isRecord(burst)) {
        return readNumber(burst.burstSampleStart, burst.BurstSampleStart);
      }

      return 0;
    })
    .filter(burst => burst > 0);

  return bursts.length > 0 ? bursts : null;
}

function createEmptyState(fileName = ''): SessionState {
  return {
    fileName,
    sampleRate: 0,
    totalSamples: 0,
    preTriggerSamples: 0,
    postTriggerSamples: 0,
    loopCount: 0,
    hasData: false,
    documentState: 'empty',
    channels: [],
    selectedRegions: [],
    bursts: null
  };
}

export const useSessionStore = defineStore('frontend-session', {
  state: (): SessionState => createEmptyState(),
  actions: {
    applyDocument(document?: FrontendDocumentData) {
      const fileName = document?.fileName ?? '';
      if (!document?.content) {
        Object.assign(this, createEmptyState(fileName));
        return;
      }

      const rootPayload = readRootPayload(document.content);
      if (!rootPayload) {
        Object.assign(this, {
          ...createEmptyState(fileName),
          documentState: 'invalid' as FrontendDocumentState
        });
        return;
      }

      const sessionPayload = readSessionPayload(rootPayload);
      const metadata = isRecord(sessionPayload.metadata) ? sessionPayload.metadata : null;
      const sampleRate = readNumber(
        sessionPayload.frequency,
        sessionPayload.Frequency,
        sessionPayload.sampleRate,
        sessionPayload.SampleRate,
        metadata?.sampleRate
      );
      const preTriggerSamples = readNumber(sessionPayload.preTriggerSamples, sessionPayload.PreTriggerSamples);
      const postTriggerSamples = readNumber(sessionPayload.postTriggerSamples, sessionPayload.PostTriggerSamples);
      const loopCount = readNumber(sessionPayload.loopCount, sessionPayload.LoopCount);
      const channels = readChannels(sessionPayload, rootPayload);
      const totalSamples = readNumber(sessionPayload.totalSamples, sessionPayload.TotalSamples, metadata?.totalSamples)
        || deriveTotalSamples(sessionPayload)
        || inferTotalSamplesFromSamples(rootPayload, channels);
      const hasData = detectHasData(rootPayload, sessionPayload);

      Object.assign(this, {
        fileName,
        sampleRate,
        preTriggerSamples,
        postTriggerSamples,
        loopCount,
        totalSamples,
        hasData,
        documentState: hasData ? 'samples' : 'settings-only',
        channels,
        selectedRegions: readSelectedRegions(rootPayload),
        bursts: readBursts(sessionPayload)
      });
    }
  }
});
