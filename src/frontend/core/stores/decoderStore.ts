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

export interface UARTMappingState {
  rxCaptureIndex: number | null;
  txCaptureIndex: number | null;
}

export interface UARTOptionState {
  baudrate: number;
  dataBits: string;
  parity: string;
  stopBits: string;
  invertRx: boolean;
  invertTx: boolean;
  samplePoint: number;
}

export type FrontendDecoderId = 'i2c' | 'uart';

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
  uartMapping: UARTMappingState;
  uartOptions: UARTOptionState;
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
const UART_MAPPING_CONFLICT = 'RX 和 TX 不能映射到同一采集通道';
const UART_CHANNEL_REQUIRED = 'UART 解码需要至少一个 RX 或 TX 通道';
const NO_DECODABLE_SAMPLES = '当前文件没有可解码样本';

const DEFAULT_UART_OPTIONS: UARTOptionState = {
  baudrate: 115200,
  dataBits: '8',
  parity: 'none',
  stopBits: '1.0',
  invertRx: false,
  invertTx: false,
  samplePoint: 50
};

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
      { decoderId: 'uart', label: 'UART' }
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
    uartMapping: {
      rxCaptureIndex: null,
      txCaptureIndex: null
    },
    uartOptions: { ...DEFAULT_UART_OPTIONS }
  }),
  actions: {
    setSelectedDecoder(decoderId: FrontendDecoderId) {
      this.selectedDecoderId = decoderId;
      this.recalculateChannelConflicts();
    },

    initializeChannelMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeI2CMapping(channels);
      this.initializeUARTMapping(channels);
      this.recalculateChannelConflicts();
    },

    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = {
        sclCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        sdaCaptureIndex: visibleChannels[1]?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
    },

    initializeUARTMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const rxChannel = visibleChannels.find(entry => /(^|\b)rx(\b|$)/i.test(entry.channel.channelName));
      const txChannel = visibleChannels.find(entry => /(^|\b)tx(\b|$)/i.test(entry.channel.channelName));

      this.uartMapping = {
        rxCaptureIndex: rxChannel?.captureIndex ?? visibleChannels[0]?.captureIndex ?? null,
        txCaptureIndex: txChannel?.captureIndex ?? visibleChannels.find(entry =>
          entry.captureIndex !== (rxChannel?.captureIndex ?? visibleChannels[0]?.captureIndex)
        )?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
    },

    setI2CMapping(role: 'scl' | 'sda', captureIndex: number | null) {
      if (role === 'scl') {
        this.i2cMapping.sclCaptureIndex = captureIndex;
      } else {
        this.i2cMapping.sdaCaptureIndex = captureIndex;
      }

      this.recalculateChannelConflicts();
    },

    setUARTMapping(role: 'rx' | 'tx', captureIndex: number | null) {
      if (role === 'rx') {
        this.uartMapping.rxCaptureIndex = captureIndex;
      } else {
        this.uartMapping.txCaptureIndex = captureIndex;
      }

      this.recalculateChannelConflicts();
    },

    setUARTOption<K extends keyof UARTOptionState>(option: K, value: UARTOptionState[K]) {
      this.uartOptions[option] = value;
    },

    recalculateChannelConflicts() {
      const conflicts: string[] = [];

      if (this.selectedDecoderId === 'i2c') {
        const { sclCaptureIndex, sdaCaptureIndex } = this.i2cMapping;

        if (
          sclCaptureIndex !== null
          && sdaCaptureIndex !== null
          && sclCaptureIndex === sdaCaptureIndex
        ) {
          conflicts.push(I2C_MAPPING_CONFLICT);
        }
      }

      if (this.selectedDecoderId === 'uart') {
        const { rxCaptureIndex, txCaptureIndex } = this.uartMapping;

        if (
          rxCaptureIndex !== null
          && txCaptureIndex !== null
          && rxCaptureIndex === txCaptureIndex
        ) {
          conflicts.push(UART_MAPPING_CONFLICT);
        }
      }

      this.channelConflicts = conflicts;
    },

    recalculateI2CConflicts() {
      this.selectedDecoderId = 'i2c';
      this.recalculateChannelConflicts();
    },

    clearDecoderResults() {
      this.decoderResults = [];
      this.decoderErrors = [];
      this.lastExecutionTime = null;
      this.lastDecoderName = null;
    },

    async runI2CDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'i2c';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runUARTDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'uart';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runSelectedDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.recalculateChannelConflicts();
      this.decoderErrors = [];

      const visibleChannels = getVisibleChannelEntries(sessionStore.channels);
      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      if (this.selectedDecoderId === 'i2c' && (
        visibleChannels.length < 2
        || this.i2cMapping.sclCaptureIndex === null
        || this.i2cMapping.sdaCaptureIndex === null
      )) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [I2C_CHANNELS_REQUIRED];
        return;
      }

      if (this.selectedDecoderId === 'uart' && (
        visibleChannels.length < 1
        || (this.uartMapping.rxCaptureIndex === null && this.uartMapping.txCaptureIndex === null)
      )) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [UART_CHANNEL_REQUIRED];
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
        const decoderId = this.selectedDecoderId;
        const commandResult = await host.sendCommand<RunDecoderResponse>('runDecoder', {
          decoderId,
          channelMapping: this.createChannelMapping(decoderId),
          options: this.createDecoderOptions(decoderId)
        });
        const response = normalizeDecoderResponse(commandResult);
        const failureLabel = `${decoderId.toUpperCase()} 解码失败`;

        if (!('decoderId' in commandResult) && !commandResult.success) {
          this.decoderResults = [];
          this.lastExecutionTime = response?.executionTime ?? null;
          this.lastDecoderName = response?.decoderName ?? null;
          this.decoderErrors = [commandResult.error ?? failureLabel];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.decoderErrors = [failureLabel];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;

        if (!response.success) {
          this.decoderResults = [];
          this.decoderErrors = [response.error ?? failureLabel];
          return;
        }

        this.decoderResults = response.results;
        this.decoderErrors = [];
      } catch (error) {
        this.decoderResults = [];
        this.lastExecutionTime = null;
        this.lastDecoderName = null;
        this.decoderErrors = [error instanceof Error ? error.message : `${this.selectedDecoderId.toUpperCase()} 解码失败`];
      } finally {
        this.isDecoding = false;
      }
    },

    createChannelMapping(decoderId: FrontendDecoderId) {
      if (decoderId === 'i2c') {
        return [
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
        ];
      }

      const mapping = [];
      if (this.uartMapping.rxCaptureIndex !== null) {
        mapping.push({
          captureIndex: this.uartMapping.rxCaptureIndex,
          decoderIndex: 0,
          name: 'RX'
        });
      }
      if (this.uartMapping.txCaptureIndex !== null) {
        mapping.push({
          captureIndex: this.uartMapping.txCaptureIndex,
          decoderIndex: 1,
          name: 'TX'
        });
      }

      return mapping;
    },

    createDecoderOptions(decoderId: FrontendDecoderId): Array<{ optionIndex: number; value: unknown }> {
      if (decoderId === 'i2c') {
        return [];
      }

      return [
        { optionIndex: 0, value: this.uartOptions.baudrate },
        { optionIndex: 1, value: this.uartOptions.dataBits },
        { optionIndex: 2, value: this.uartOptions.parity },
        { optionIndex: 3, value: this.uartOptions.stopBits },
        { optionIndex: 6, value: this.uartOptions.invertRx ? 'yes' : 'no' },
        { optionIndex: 7, value: this.uartOptions.invertTx ? 'yes' : 'no' },
        { optionIndex: 8, value: this.uartOptions.samplePoint }
      ];
    }
  }
});
