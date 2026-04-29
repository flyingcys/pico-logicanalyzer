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

export interface LINMappingState {
  rxCaptureIndex: number | null;
}

export type DecoderProtocolId = 'i2c' | 'lin';
export type LINChecksumMode = 'classic' | 'enhanced' | 'lin1.x' | 'lin2.x';

export interface LINOptionState {
  baudrate: number;
  dataLength: number;
  checksum: LINChecksumMode;
}

interface FrontendDecoderState {
  activeDecoderConfigs: Array<{ decoderId: DecoderProtocolId; label: string }>;
  selectedDecoderId: DecoderProtocolId;
  decoderResults: FrontendDecoderResult[];
  decoderErrors: string[];
  channelConflicts: string[];
  isDecoding: boolean;
  lastExecutionTime: number | null;
  lastDecoderName: string | null;
  i2cMapping: I2CMappingState;
  linMapping: LINMappingState;
  linOptions: LINOptionState;
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
const LIN_CHANNEL_REQUIRED = 'LIN 解码需要 RX 通道';
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
      { decoderId: 'lin', label: 'LIN' }
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
    linMapping: {
      rxCaptureIndex: null
    },
    linOptions: {
      baudrate: 19200,
      dataLength: 2,
      checksum: 'classic'
    }
  }),
  actions: {
    selectDecoder(decoderId: DecoderProtocolId) {
      this.selectedDecoderId = decoderId;
      this.recalculateChannelConflicts();
    },

    initializeProtocolMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeI2CMapping(channels);
      this.initializeLINMapping(channels);
      this.recalculateChannelConflicts();
    },

    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = {
        sclCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        sdaCaptureIndex: visibleChannels[1]?.captureIndex ?? null
      };
      this.recalculateI2CConflicts();
    },

    initializeLINMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.linMapping = {
        rxCaptureIndex: visibleChannels[0]?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
    },

    setI2CMapping(role: 'scl' | 'sda', captureIndex: number | null) {
      if (role === 'scl') {
        this.i2cMapping.sclCaptureIndex = captureIndex;
      } else {
        this.i2cMapping.sdaCaptureIndex = captureIndex;
      }

      this.recalculateI2CConflicts();
    },

    setLINMapping(captureIndex: number | null) {
      this.linMapping.rxCaptureIndex = captureIndex;
      this.recalculateChannelConflicts();
    },

    setLINOption(option: keyof LINOptionState, value: number | LINChecksumMode) {
      if (option === 'baudrate') {
        this.linOptions.baudrate = Math.max(1, Number(value) || 19200);
      } else if (option === 'dataLength') {
        this.linOptions.dataLength = Math.max(0, Math.floor(Number(value) || 0));
      } else if (
        value === 'classic'
        || value === 'enhanced'
        || value === 'lin1.x'
        || value === 'lin2.x'
      ) {
        this.linOptions.checksum = value;
      }
    },

    recalculateChannelConflicts() {
      if (this.selectedDecoderId === 'i2c') {
        this.recalculateI2CConflicts();
      } else {
        this.channelConflicts = [];
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

    async runLINDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.decoderErrors = [];

      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      if (this.linMapping.rxCaptureIndex === null) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [LIN_CHANNEL_REQUIRED];
        return;
      }

      this.isDecoding = true;

      try {
        const commandResult = await host.sendCommand<RunDecoderResponse>('runDecoder', {
          decoderId: 'lin',
          channelMapping: [
            {
              captureIndex: this.linMapping.rxCaptureIndex,
              decoderIndex: 0,
              name: 'LIN RX'
            }
          ],
          options: [
            { optionIndex: 0, value: this.linOptions.baudrate },
            { optionIndex: 1, value: this.linOptions.dataLength },
            { optionIndex: 2, value: this.linOptions.checksum }
          ]
        });
        const response = normalizeDecoderResponse(commandResult);

        if (!('decoderId' in commandResult) && !commandResult.success) {
          this.decoderResults = [];
          this.lastExecutionTime = response?.executionTime ?? null;
          this.lastDecoderName = response?.decoderName ?? null;
          this.decoderErrors = [commandResult.error ?? 'LIN 解码失败'];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.decoderErrors = ['LIN 解码失败'];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;

        if (!response.success) {
          this.decoderResults = [];
          this.decoderErrors = [response.error ?? 'LIN 解码失败'];
          return;
        }

        this.decoderResults = response.results;
        this.decoderErrors = [];
      } catch (error) {
        this.decoderResults = [];
        this.lastExecutionTime = null;
        this.lastDecoderName = null;
        this.decoderErrors = [error instanceof Error ? error.message : 'LIN 解码失败'];
      } finally {
        this.isDecoding = false;
      }
    },

    async runSelectedDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      if (this.selectedDecoderId === 'lin') {
        await this.runLINDecoder(host, sessionStore);
        return;
      }

      await this.runI2CDecoder(host, sessionStore);
    }
  }
});
