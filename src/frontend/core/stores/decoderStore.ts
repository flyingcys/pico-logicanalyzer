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

export type FrontendDecoderId = 'i2c' | 'spi';
export type SPIMappingRole = 'clk' | 'miso' | 'mosi' | 'cs';
export type SPIOptionKey = 'csPolarity' | 'cpol' | 'cpha' | 'bitOrder' | 'wordSize';

export interface SPIMappingState {
  clkCaptureIndex: number | null;
  misoCaptureIndex: number | null;
  mosiCaptureIndex: number | null;
  csCaptureIndex: number | null;
}

export interface SPIOptionsState {
  csPolarity: 'active-low' | 'active-high';
  cpol: '0' | '1';
  cpha: '0' | '1';
  bitOrder: 'msb-first' | 'lsb-first';
  wordSize: number;
}

interface FrontendDecoderState {
  activeDecoderId: FrontendDecoderId;
  activeDecoderConfigs: Array<{ decoderId: FrontendDecoderId; label: string }>;
  decoderResults: FrontendDecoderResult[];
  decoderErrors: string[];
  channelConflicts: string[];
  isDecoding: boolean;
  lastExecutionTime: number | null;
  lastDecoderName: string | null;
  i2cMapping: I2CMappingState;
  spiMapping: SPIMappingState;
  spiOptions: SPIOptionsState;
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
const SPI_MAPPING_CONFLICT = 'SPI 通道映射不能重复使用同一采集通道';
const SPI_CHANNELS_REQUIRED = 'SPI 解码需要 CLK 和至少一个 MISO/MOSI 通道';
const NO_DECODABLE_SAMPLES = '当前文件没有可解码样本';

const DEFAULT_SPI_OPTIONS: SPIOptionsState = {
  csPolarity: 'active-low',
  cpol: '0',
  cpha: '0',
  bitOrder: 'msb-first',
  wordSize: 8
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

function findChannelByName(
  visibleChannels: VisibleChannelEntry[],
  patterns: RegExp[]
): number | null {
  const entry = visibleChannels.find(item =>
    patterns.some(pattern => pattern.test(item.channel.channelName))
  );

  return entry?.captureIndex ?? null;
}

function hasDuplicateMappedChannels(values: Array<number | null>): boolean {
  const mappedValues = values.filter((value): value is number => value !== null);
  return new Set(mappedValues).size !== mappedValues.length;
}

export const useDecoderStore = defineStore('frontend-decoder', {
  state: (): FrontendDecoderState => ({
    activeDecoderId: 'i2c',
    activeDecoderConfigs: [
      { decoderId: 'i2c', label: 'I2C' },
      { decoderId: 'spi', label: 'SPI' }
    ],
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
    spiMapping: {
      clkCaptureIndex: null,
      misoCaptureIndex: null,
      mosiCaptureIndex: null,
      csCaptureIndex: null
    },
    spiOptions: { ...DEFAULT_SPI_OPTIONS }
  }),
  actions: {
    setActiveDecoder(decoderId: FrontendDecoderId) {
      this.activeDecoderId = decoderId;
      this.recalculateActiveDecoderConflicts();
    },

    initializeDecoderMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeI2CMapping(channels);
      this.initializeSPIMapping(channels);
      this.recalculateActiveDecoderConflicts();
    },

    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);

      this.i2cMapping = {
        sclCaptureIndex: visibleChannels[0]?.captureIndex ?? null,
        sdaCaptureIndex: visibleChannels[1]?.captureIndex ?? null
      };
      this.recalculateI2CConflicts();
    },

    initializeSPIMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const clkCaptureIndex = findChannelByName(visibleChannels, [/clk/i, /sck/i])
        ?? visibleChannels[0]?.captureIndex
        ?? null;
      const misoByName = findChannelByName(visibleChannels, [/miso/i, /cipo/i, /\bso\b/i]);
      const mosiByName = findChannelByName(visibleChannels, [/mosi/i, /copi/i, /\bsi\b/i]);
      const csCaptureIndex = findChannelByName(visibleChannels, [/^cs/i, /cs#/i, /\bss\b/i])
        ?? visibleChannels[3]?.captureIndex
        ?? null;

      this.spiMapping = {
        clkCaptureIndex,
        misoCaptureIndex: misoByName ?? (mosiByName === null ? visibleChannels[1]?.captureIndex ?? null : null),
        mosiCaptureIndex: mosiByName ?? (misoByName === null ? visibleChannels[2]?.captureIndex ?? null : null),
        csCaptureIndex
      };
      this.recalculateSPIConflicts();
    },

    setI2CMapping(role: 'scl' | 'sda', captureIndex: number | null) {
      if (role === 'scl') {
        this.i2cMapping.sclCaptureIndex = captureIndex;
      } else {
        this.i2cMapping.sdaCaptureIndex = captureIndex;
      }

      this.recalculateI2CConflicts();
    },

    setSPIMapping(role: SPIMappingRole, captureIndex: number | null) {
      const key = `${role}CaptureIndex` as keyof SPIMappingState;
      this.spiMapping[key] = captureIndex;
      this.recalculateSPIConflicts();
    },

    setSPIOption(option: SPIOptionKey, value: string | number) {
      if (option === 'wordSize') {
        const parsedValue = typeof value === 'number' ? value : Number(value);
        this.spiOptions.wordSize = Number.isFinite(parsedValue)
          ? Math.max(1, Math.min(32, Math.trunc(parsedValue)))
          : DEFAULT_SPI_OPTIONS.wordSize;
        return;
      }

      if (option === 'csPolarity' && (value === 'active-low' || value === 'active-high')) {
        this.spiOptions.csPolarity = value;
      } else if ((option === 'cpol' || option === 'cpha') && (value === '0' || value === '1')) {
        this.spiOptions[option] = value;
      } else if (option === 'bitOrder' && (value === 'msb-first' || value === 'lsb-first')) {
        this.spiOptions.bitOrder = value;
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

    recalculateSPIConflicts() {
      const conflicts: string[] = [];
      const {
        clkCaptureIndex,
        misoCaptureIndex,
        mosiCaptureIndex,
        csCaptureIndex
      } = this.spiMapping;

      if (hasDuplicateMappedChannels([
        clkCaptureIndex,
        misoCaptureIndex,
        mosiCaptureIndex,
        csCaptureIndex
      ])) {
        conflicts.push(SPI_MAPPING_CONFLICT);
      }

      this.channelConflicts = conflicts;
    },

    recalculateActiveDecoderConflicts() {
      if (this.activeDecoderId === 'spi') {
        this.recalculateSPIConflicts();
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

    async runSPIDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.recalculateSPIConflicts();
      this.decoderErrors = [];

      if (!sessionStore.hasData) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [NO_DECODABLE_SAMPLES];
        return;
      }

      const {
        clkCaptureIndex,
        misoCaptureIndex,
        mosiCaptureIndex,
        csCaptureIndex
      } = this.spiMapping;
      if (clkCaptureIndex === null || (misoCaptureIndex === null && mosiCaptureIndex === null)) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.decoderErrors = [SPI_CHANNELS_REQUIRED];
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
        const channelMapping = [
          { captureIndex: clkCaptureIndex, decoderIndex: 0, name: 'CLK' },
          misoCaptureIndex === null ? null : { captureIndex: misoCaptureIndex, decoderIndex: 1, name: 'MISO' },
          mosiCaptureIndex === null ? null : { captureIndex: mosiCaptureIndex, decoderIndex: 2, name: 'MOSI' },
          csCaptureIndex === null ? null : { captureIndex: csCaptureIndex, decoderIndex: 3, name: 'CS' }
        ].filter((mapping): mapping is { captureIndex: number; decoderIndex: number; name: string } => mapping !== null);
        const commandResult = await host.sendCommand<RunDecoderResponse>('runDecoder', {
          decoderId: 'spi',
          channelMapping,
          options: [
            { optionIndex: 0, value: this.spiOptions.csPolarity },
            { optionIndex: 1, value: this.spiOptions.cpol },
            { optionIndex: 2, value: this.spiOptions.cpha },
            { optionIndex: 3, value: this.spiOptions.bitOrder },
            { optionIndex: 4, value: this.spiOptions.wordSize }
          ]
        });
        const response = normalizeDecoderResponse(commandResult);

        if (!('decoderId' in commandResult) && !commandResult.success) {
          this.decoderResults = [];
          this.lastExecutionTime = response?.executionTime ?? null;
          this.lastDecoderName = response?.decoderName ?? null;
          this.decoderErrors = [commandResult.error ?? 'SPI 解码失败'];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.decoderErrors = ['SPI 解码失败'];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;

        if (!response.success) {
          this.decoderResults = [];
          this.decoderErrors = [response.error ?? 'SPI 解码失败'];
          return;
        }

        this.decoderResults = response.results;
        this.decoderErrors = [];
      } catch (error) {
        this.decoderResults = [];
        this.lastExecutionTime = null;
        this.lastDecoderName = null;
        this.decoderErrors = [error instanceof Error ? error.message : 'SPI 解码失败'];
      } finally {
        this.isDecoding = false;
      }
    }
  }
});
