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

export interface CANMappingState {
  rxCaptureIndex: number | null;
}

export interface CANOptionState {
  bitrate: number;
  samplePoint: number;
}

export type FrontendDecoderId = 'i2c' | 'can';

interface FrontendDecoderState {
  activeDecoderConfigs: Array<{ decoderId: FrontendDecoderId; label: string }>;
  selectedDecoderId: FrontendDecoderId;
  decoderResults: FrontendDecoderResult[];
  decoderErrors: string[];
  channelConflicts: string[];
  isDecoding: boolean;
  lastExecutionTime: number | null;
  lastDecoderName: string | null;
  i2cMapping: I2CMappingState;
  canMapping: CANMappingState;
  canOptions: CANOptionState;
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
const CAN_CHANNELS_REQUIRED = 'CAN 解码需要 CAN RX 通道';
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
      { decoderId: 'can', label: 'CAN' }
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
    canMapping: {
      rxCaptureIndex: null
    },
    canOptions: {
      bitrate: 500000,
      samplePoint: 75
    }
  }),
  actions: {
    setSelectedDecoder(decoderId: FrontendDecoderId) {
      this.selectedDecoderId = decoderId;
      if (decoderId === 'i2c') {
        this.recalculateI2CConflicts();
      } else {
        this.channelConflicts = [];
      }
    },

    initializeDecoderMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeI2CMapping(channels);
      this.initializeCANMapping(channels);
      if (this.selectedDecoderId === 'can') {
        this.channelConflicts = [];
      }
    },

    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = {
        sclCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        sdaCaptureIndex: visibleChannels[1]?.captureIndex ?? null
      };
      this.recalculateI2CConflicts();
    },

    initializeCANMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const namedCan = visibleChannels.find(entry =>
        /can|rx/i.test(entry.channel.channelName)
      );

      this.canMapping = {
        rxCaptureIndex: namedCan?.captureIndex ?? visibleChannels[0]?.captureIndex ?? null
      };
    },

    setI2CMapping(role: 'scl' | 'sda', captureIndex: number | null) {
      if (role === 'scl') {
        this.i2cMapping.sclCaptureIndex = captureIndex;
      } else {
        this.i2cMapping.sdaCaptureIndex = captureIndex;
      }

      this.recalculateI2CConflicts();
    },

    setCANMapping(captureIndex: number | null) {
      this.canMapping.rxCaptureIndex = captureIndex;
      if (this.selectedDecoderId === 'can') {
        this.channelConflicts = [];
      }
    },

    setCANOption(option: keyof CANOptionState, value: number) {
      if (!Number.isFinite(value)) {
        return;
      }

      if (option === 'bitrate') {
        this.canOptions.bitrate = Math.max(1, Math.round(value));
      } else {
        this.canOptions.samplePoint = Math.min(99, Math.max(1, Math.round(value)));
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

    clearDecoderResults() {
      this.decoderResults = [];
      this.decoderErrors = [];
      this.lastExecutionTime = null;
      this.lastDecoderName = null;
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

    async runCANDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.channelConflicts = [];
      this.decoderErrors = [];

      const visibleChannels = getVisibleChannelEntries(sessionStore.channels);
      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      if (visibleChannels.length < 1 || this.canMapping.rxCaptureIndex === null) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [CAN_CHANNELS_REQUIRED];
        return;
      }

      this.isDecoding = true;

      try {
        const commandResult = await host.sendCommand<RunDecoderResponse>('runDecoder', {
          decoderId: 'can',
          channelMapping: [
            {
              captureIndex: this.canMapping.rxCaptureIndex,
              decoderIndex: 0,
              name: 'CAN RX'
            }
          ],
          options: [
            { optionIndex: 0, value: this.canOptions.bitrate },
            { optionIndex: 1, value: this.canOptions.samplePoint }
          ]
        });
        const response = normalizeDecoderResponse(commandResult);

        if (!('decoderId' in commandResult) && !commandResult.success) {
          this.decoderResults = [];
          this.lastExecutionTime = response?.executionTime ?? null;
          this.lastDecoderName = response?.decoderName ?? null;
          this.decoderErrors = [commandResult.error ?? 'CAN 解码失败'];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.decoderErrors = ['CAN 解码失败'];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;

        if (!response.success) {
          this.decoderResults = [];
          this.decoderErrors = [response.error ?? 'CAN 解码失败'];
          return;
        }

        this.decoderResults = response.results;
        this.decoderErrors = [];
      } catch (error) {
        this.decoderResults = [];
        this.lastExecutionTime = null;
        this.lastDecoderName = null;
        this.decoderErrors = [error instanceof Error ? error.message : 'CAN 解码失败'];
      } finally {
        this.isDecoding = false;
      }
    }
  }
});
