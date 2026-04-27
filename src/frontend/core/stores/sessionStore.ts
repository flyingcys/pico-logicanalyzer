import { defineStore } from 'pinia';
import type { FrontendDocumentData } from '../../platform/host/types';

interface SessionState {
  fileName: string;
  sampleRate: number;
  totalSamples: number;
  hasData: boolean;
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
  const explicitTotalSamples = readNumber(sessionPayload.totalSamples);
  if (explicitTotalSamples > 0) {
    return explicitTotalSamples;
  }

  const preTriggerSamples = readNumber(sessionPayload.preTriggerSamples);
  const postTriggerSamples = readNumber(sessionPayload.postTriggerSamples);
  const loopCount = readNumber(sessionPayload.loopCount);

  if (preTriggerSamples > 0 || postTriggerSamples > 0) {
    return preTriggerSamples + postTriggerSamples * (loopCount + 1);
  }

  return 0;
}

function hasRootSamples(rootPayload: JsonRecord): boolean {
  return Array.isArray(rootPayload.Samples) && rootPayload.Samples.length > 0;
}

function hasChannelSamples(sessionPayload: JsonRecord): boolean {
  const { captureChannels } = sessionPayload;
  if (!Array.isArray(captureChannels)) {
    return false;
  }

  return captureChannels.some(channel => {
    if (!isRecord(channel)) {
      return false;
    }

    const { samples } = channel;
    if (Array.isArray(samples)) {
      return samples.length > 0;
    }

    if (typeof samples === 'string') {
      return samples.length > 0;
    }

    return false;
  });
}

function detectHasData(rootPayload: JsonRecord, sessionPayload: JsonRecord, totalSamples: number): boolean {
  if (totalSamples > 0) {
    return true;
  }

  return hasRootSamples(rootPayload) || hasChannelSamples(sessionPayload);
}

function createEmptyState(fileName = ''): SessionState {
  return {
    fileName,
    sampleRate: 0,
    totalSamples: 0,
    hasData: false
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
        Object.assign(this, createEmptyState(fileName));
        return;
      }

      const sessionPayload = readSessionPayload(rootPayload);
      const metadata = isRecord(sessionPayload.metadata) ? sessionPayload.metadata : null;
      const sampleRate = readNumber(
        sessionPayload.frequency,
        sessionPayload.sampleRate,
        metadata?.sampleRate
      );
      const totalSamples = readNumber(sessionPayload.totalSamples, metadata?.totalSamples)
        || deriveTotalSamples(sessionPayload);

      Object.assign(this, {
        fileName,
        sampleRate,
        totalSamples,
        hasData: detectHasData(rootPayload, sessionPayload, totalSamples)
      });
    }
  }
});
