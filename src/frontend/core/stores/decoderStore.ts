import { defineStore } from 'pinia';
import type { HostAdapter, HostCommandResult } from '../../platform/host/types';
import type { FrontendAnalyzerChannel } from './sessionStore';

export interface FrontendDecoderResult {
  startSample: number;
  endSample: number;
  annotationType: number;
  values: string[];
  rawData?: unknown;
  shape?: 'hexagon' | 'rectangle' | 'diamond';
}

export interface I2CMappingState {
  sclCaptureIndex: number | null;
  sdaCaptureIndex: number | null;
}

interface FrontendDecoderState {
  activeDecoderConfigs: Array<{ decoderId: 'i2c'; label: string }>;
  decoderResults: FrontendDecoderResult[];
  decoderErrors: string[];
  channelConflicts: string[];
  isDecoding: boolean;
  lastExecutionTime: number | null;
  lastDecoderName: string | null;
  lastExecutionMode: 'regular' | 'streaming' | null;
  lastChunksProcessed: number | null;
  i2cMapping: I2CMappingState;
}

interface RunDecoderResponse {
  decoderId: string;
  decoderName: string;
  success: boolean;
  isStreaming?: boolean;
  executionTime: number;
  results: FrontendDecoderResult[];
  error?: string;
  performanceStats?: {
    totalSamples: number;
    processingSpeed: number;
    memoryUsage?: number;
    chunksProcessed?: number;
  };
}

interface SessionLike {
  hasData: boolean;
  sampleRate: number;
  channels: FrontendAnalyzerChannel[];
}

interface VisibleChannelEntry {
  captureIndex: number;
  channel: FrontendAnalyzerChannel;
}

const I2C_MAPPING_CONFLICT = 'SCL 和 SDA 不能映射到同一采集通道';
const I2C_CHANNELS_REQUIRED = 'I2C 解码需要 SCL 和 SDA 两个通道';
const NO_DECODABLE_SAMPLES = '当前文件没有可解码样本';

function getVisibleChannelEntries(channels: FrontendAnalyzerChannel[]): VisibleChannelEntry[] {
  return channels
    .map((channel, captureIndex) => ({ captureIndex, channel }))
    .filter(entry => !entry.channel.hidden);
}

function findNamedI2CChannel(
  channels: VisibleChannelEntry[],
  role: 'scl' | 'sda',
  usedCaptureIndexes: Set<number>
): VisibleChannelEntry | undefined {
  return channels.find(entry =>
    !usedCaptureIndexes.has(entry.captureIndex) &&
    entry.channel.channelName?.toLowerCase().includes(role)
  );
}

function findFallbackI2CChannel(
  channels: VisibleChannelEntry[],
  fallbackPosition: number,
  usedCaptureIndexes: Set<number>
): VisibleChannelEntry | undefined {
  const numberedChannel = channels.find(entry =>
    !usedCaptureIndexes.has(entry.captureIndex) &&
    entry.channel.channelNumber === fallbackPosition
  );
  if (numberedChannel) {
    return numberedChannel;
  }

  const positionalChannel = channels[fallbackPosition];
  if (positionalChannel && !usedCaptureIndexes.has(positionalChannel.captureIndex)) {
    return positionalChannel;
  }

  return channels.find(entry => !usedCaptureIndexes.has(entry.captureIndex));
}

function resolveI2CMapping(channels: VisibleChannelEntry[]): I2CMappingState {
  const usedCaptureIndexes = new Set<number>();
  let sclChannel = findNamedI2CChannel(channels, 'scl', usedCaptureIndexes);
  if (sclChannel) {
    usedCaptureIndexes.add(sclChannel.captureIndex);
  }

  let sdaChannel = findNamedI2CChannel(channels, 'sda', usedCaptureIndexes);
  if (sdaChannel) {
    usedCaptureIndexes.add(sdaChannel.captureIndex);
  }

  if (!sclChannel) {
    sclChannel = findFallbackI2CChannel(channels, 0, usedCaptureIndexes);
    if (sclChannel) {
      usedCaptureIndexes.add(sclChannel.captureIndex);
    }
  }

  if (!sdaChannel) {
    sdaChannel = findFallbackI2CChannel(channels, 1, usedCaptureIndexes);
  }

  return {
    sclCaptureIndex: sclChannel?.captureIndex ?? null,
    sdaCaptureIndex: sdaChannel?.captureIndex ?? null
  };
}

function normalizeDecoderResponse(
  commandResult: HostCommandResult<RunDecoderResponse> | RunDecoderResponse
): RunDecoderResponse | null {
  if ('data' in commandResult && commandResult.data) {
    return commandResult.data;
  }

  if ('decoderId' in commandResult) {
    return commandResult;
  }

  return null;
}

export const useDecoderStore = defineStore('frontend-decoder', {
  state: (): FrontendDecoderState => ({
    activeDecoderConfigs: [{ decoderId: 'i2c', label: 'I2C' }],
    decoderResults: [],
    decoderErrors: [],
    channelConflicts: [],
    isDecoding: false,
    lastExecutionTime: null,
    lastDecoderName: null,
    lastExecutionMode: null,
    lastChunksProcessed: null,
    i2cMapping: {
      sclCaptureIndex: null,
      sdaCaptureIndex: null
    }
  }),
  actions: {
    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = resolveI2CMapping(visibleChannels);
      this.recalculateI2CConflicts();
    },

    setI2CMapping(role: 'scl' | 'sda', captureIndex: number | null) {
      if (role === 'scl') {
        this.i2cMapping.sclCaptureIndex = captureIndex;
      } else {
        this.i2cMapping.sdaCaptureIndex = captureIndex;
      }

      this.recalculateI2CConflicts();
    },

    recalculateI2CConflicts() {
      const conflicts: string[] = [];
      const { sclCaptureIndex, sdaCaptureIndex } = this.i2cMapping;

      if (
        sclCaptureIndex !== null
        && sdaCaptureIndex !== null
        && sclCaptureIndex === sdaCaptureIndex
      ) {
        conflicts.push(I2C_MAPPING_CONFLICT);
      }

      this.channelConflicts = conflicts;
    },

    clearDecoderResults() {
      this.decoderResults = [];
      this.decoderErrors = [];
      this.lastExecutionTime = null;
      this.lastDecoderName = null;
      this.lastExecutionMode = null;
      this.lastChunksProcessed = null;
    },

    async runI2CDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.recalculateI2CConflicts();
      this.decoderErrors = [];

      const visibleChannels = getVisibleChannelEntries(sessionStore.channels);
      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.lastExecutionMode = null;
        this.lastChunksProcessed = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      if (visibleChannels.length < 2 || this.i2cMapping.sclCaptureIndex === null || this.i2cMapping.sdaCaptureIndex === null) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.lastExecutionMode = null;
        this.lastChunksProcessed = null;
        this.decoderErrors = [I2C_CHANNELS_REQUIRED];
        return;
      }

      if (this.channelConflicts.length > 0) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.lastExecutionMode = null;
        this.lastChunksProcessed = null;
        this.decoderErrors = [...this.channelConflicts];
        return;
      }

      this.isDecoding = true;

      try {
        const commandResult = await host.sendCommand<RunDecoderResponse>('runDecoder', {
          decoderId: 'i2c',
          channelMapping: [
            {
              captureIndex: this.i2cMapping.sclCaptureIndex,
              decoderIndex: 0,
              name: 'SCL'
            },
            {
              captureIndex: this.i2cMapping.sdaCaptureIndex,
              decoderIndex: 1,
              name: 'SDA'
            }
          ],
          options: []
        });
        const response = normalizeDecoderResponse(commandResult);

        if (!('decoderId' in commandResult) && !commandResult.success) {
          this.decoderResults = [];
          this.lastExecutionTime = response?.executionTime ?? null;
          this.lastDecoderName = response?.decoderName ?? null;
          this.lastExecutionMode = response ? (response.isStreaming ? 'streaming' : 'regular') : null;
          this.lastChunksProcessed = response?.performanceStats?.chunksProcessed ?? null;
          this.decoderErrors = [commandResult.error ?? 'I2C 解码失败'];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.lastExecutionMode = null;
          this.lastChunksProcessed = null;
          this.decoderErrors = ['I2C 解码失败'];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;
        this.lastExecutionMode = response.isStreaming ? 'streaming' : 'regular';
        this.lastChunksProcessed = response.performanceStats?.chunksProcessed ?? null;

        if (!response.success) {
          this.decoderResults = [];
          this.decoderErrors = [response.error ?? 'I2C 解码失败'];
          return;
        }

        this.decoderResults = response.results;
        this.decoderErrors = [];
      } catch (error) {
        this.decoderResults = [];
        this.lastExecutionTime = null;
        this.lastDecoderName = null;
        this.lastExecutionMode = null;
        this.lastChunksProcessed = null;
        this.decoderErrors = [error instanceof Error ? error.message : 'I2C 解码失败'];
      } finally {
        this.isDecoding = false;
      }
    }
  }
});
