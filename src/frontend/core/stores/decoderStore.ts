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

export interface I2SMappingState {
  sckCaptureIndex: number | null;
  wsCaptureIndex: number | null;
  sdCaptureIndex: number | null;
}

export type FrontendDecoderId = 'i2c' | 'i2s';
export type I2SJustification = 'i2s' | 'left';

interface ActiveDecoderConfig {
  decoderId: FrontendDecoderId;
  label: string;
}

interface I2SOptionsState {
  wordLength: 16 | 24 | 32;
  justification: I2SJustification;
}

interface FrontendDecoderState {
  activeDecoderConfigs: ActiveDecoderConfig[];
  selectedDecoderId: FrontendDecoderId;
  decoderResults: FrontendDecoderResult[];
  decoderErrors: string[];
  channelConflicts: string[];
  isDecoding: boolean;
  lastExecutionTime: number | null;
  lastDecoderName: string | null;
  i2cMapping: I2CMappingState;
  i2sMapping: I2SMappingState;
  i2sOptions: I2SOptionsState;
}

interface RunDecoderResponse {
  decoderId: string;
  decoderName: string;
  success: boolean;
  executionTime: number;
  results: FrontendDecoderResult[];
  error?: string;
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
const I2S_MAPPING_CONFLICT = 'SCK、WS 和 SD 不能映射到同一采集通道';
const I2S_CHANNELS_REQUIRED = 'I2S 解码需要 SCK、WS 和 SD 三个通道';
const NO_DECODABLE_SAMPLES = '当前文件没有可解码样本';

function getVisibleChannelEntries(channels: FrontendAnalyzerChannel[]): VisibleChannelEntry[] {
  return channels
    .map((channel, captureIndex) => ({ captureIndex, channel }))
    .filter(entry => !entry.channel.hidden);
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
    activeDecoderConfigs: [
      { decoderId: 'i2c', label: 'I2C' },
      { decoderId: 'i2s', label: 'I2S' }
    ],
    selectedDecoderId: 'i2c',
    decoderResults: [],
    decoderErrors: [],
    channelConflicts: [],
    isDecoding: false,
    lastExecutionTime: null,
    lastDecoderName: null,
    i2cMapping: {
      sclCaptureIndex: null,
      sdaCaptureIndex: null
    },
    i2sMapping: {
      sckCaptureIndex: null,
      wsCaptureIndex: null,
      sdCaptureIndex: null
    },
    i2sOptions: {
      wordLength: 16,
      justification: 'i2s'
    }
  }),
  actions: {
    selectDecoder(decoderId: FrontendDecoderId) {
      this.selectedDecoderId = decoderId;
      this.recalculateSelectedConflicts();
    },

    initializeProtocolMappings(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = {
        sclCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        sdaCaptureIndex: visibleChannels[1]?.captureIndex ?? null
      };
      this.i2sMapping = {
        sckCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        wsCaptureIndex: visibleChannels[1]?.captureIndex ?? null,
        sdCaptureIndex: visibleChannels[2]?.captureIndex ?? null
      };
      this.recalculateSelectedConflicts();
    },

    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = {
        sclCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        sdaCaptureIndex: visibleChannels[1]?.captureIndex ?? null
      };
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

    setI2SMapping(role: 'sck' | 'ws' | 'sd', captureIndex: number | null) {
      if (role === 'sck') {
        this.i2sMapping.sckCaptureIndex = captureIndex;
      } else if (role === 'ws') {
        this.i2sMapping.wsCaptureIndex = captureIndex;
      } else {
        this.i2sMapping.sdCaptureIndex = captureIndex;
      }

      this.recalculateI2SConflicts();
    },

    setI2SOption(option: 'word_length' | 'justification', value: number | I2SJustification) {
      if (option === 'word_length') {
        this.i2sOptions.wordLength = value === 24 || value === 32 ? value : 16;
      } else {
        this.i2sOptions.justification = value === 'left' ? 'left' : 'i2s';
      }
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

    recalculateI2SConflicts() {
      const conflicts: string[] = [];
      const indexes = [
        this.i2sMapping.sckCaptureIndex,
        this.i2sMapping.wsCaptureIndex,
        this.i2sMapping.sdCaptureIndex
      ];
      const mappedIndexes = indexes.filter((index): index is number => index !== null);

      if (mappedIndexes.length === 3 && new Set(mappedIndexes).size < 3) {
        conflicts.push(I2S_MAPPING_CONFLICT);
      }

      this.channelConflicts = conflicts;
    },

    recalculateSelectedConflicts() {
      if (this.selectedDecoderId === 'i2s') {
        this.recalculateI2SConflicts();
      } else {
        this.recalculateI2CConflicts();
      }
    },

    clearDecoderResults() {
      this.decoderResults = [];
      this.decoderErrors = [];
      this.lastExecutionTime = null;
      this.lastDecoderName = null;
    },

    async runSelectedDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      if (this.selectedDecoderId === 'i2s') {
        await this.runI2SDecoder(host, sessionStore);
        return;
      }

      await this.runI2CDecoder(host, sessionStore);
    },

    async runI2CDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.recalculateI2CConflicts();
      this.decoderErrors = [];

      const visibleChannels = getVisibleChannelEntries(sessionStore.channels);
      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      if (visibleChannels.length < 2 || this.i2cMapping.sclCaptureIndex === null || this.i2cMapping.sdaCaptureIndex === null) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [I2C_CHANNELS_REQUIRED];
        return;
      }

      if (this.channelConflicts.length > 0) {
        this.decoderResults = [];
        this.lastDecoderName = null;
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
          this.decoderErrors = [commandResult.error ?? 'I2C 解码失败'];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.decoderErrors = ['I2C 解码失败'];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;

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
        this.decoderErrors = [error instanceof Error ? error.message : 'I2C 解码失败'];
      } finally {
        this.isDecoding = false;
      }
    },

    async runI2SDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.recalculateI2SConflicts();
      this.decoderErrors = [];

      const visibleChannels = getVisibleChannelEntries(sessionStore.channels);
      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      const { sckCaptureIndex, wsCaptureIndex, sdCaptureIndex } = this.i2sMapping;
      if (
        visibleChannels.length < 3
        || sckCaptureIndex === null
        || wsCaptureIndex === null
        || sdCaptureIndex === null
      ) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [I2S_CHANNELS_REQUIRED];
        return;
      }

      if (this.channelConflicts.length > 0) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [...this.channelConflicts];
        return;
      }

      this.isDecoding = true;

      try {
        const commandResult = await host.sendCommand<RunDecoderResponse>('runDecoder', {
          decoderId: 'i2s',
          channelMapping: [
            { captureIndex: sckCaptureIndex, decoderIndex: 0, name: 'SCK' },
            { captureIndex: wsCaptureIndex, decoderIndex: 1, name: 'WS' },
            { captureIndex: sdCaptureIndex, decoderIndex: 2, name: 'SD' }
          ],
          options: [
            { optionIndex: 0, value: this.i2sOptions.wordLength },
            { optionIndex: 1, value: this.i2sOptions.justification }
          ]
        });
        const response = normalizeDecoderResponse(commandResult);

        if (!('decoderId' in commandResult) && !commandResult.success) {
          this.decoderResults = [];
          this.lastExecutionTime = response?.executionTime ?? null;
          this.lastDecoderName = response?.decoderName ?? null;
          this.decoderErrors = [commandResult.error ?? 'I2S 解码失败'];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.decoderErrors = ['I2S 解码失败'];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;

        if (!response.success) {
          this.decoderResults = [];
          this.decoderErrors = [response.error ?? 'I2S 解码失败'];
          return;
        }

        this.decoderResults = response.results;
        this.decoderErrors = [];
      } catch (error) {
        this.decoderResults = [];
        this.lastExecutionTime = null;
        this.lastDecoderName = null;
        this.decoderErrors = [error instanceof Error ? error.message : 'I2S 解码失败'];
      } finally {
        this.isDecoding = false;
      }
    }
  }
});
