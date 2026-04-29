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

export interface CANMappingState {
  rxCaptureIndex: number | null;
}

export interface CANOptionState {
  bitrate: number;
  samplePoint: number;
}

export interface LINMappingState {
  rxCaptureIndex: number | null;
}

export type LINChecksumMode = 'classic' | 'enhanced' | 'lin1.x' | 'lin2.x';

export interface LINOptionState {
  baudrate: number;
  dataLength: number;
  checksum: LINChecksumMode;
}

export interface I2SMappingState {
  sckCaptureIndex: number | null;
  wsCaptureIndex: number | null;
  sdCaptureIndex: number | null;
}

export type I2SJustification = 'i2s' | 'left';

export interface I2SOptionState {
  wordLength: 16 | 24 | 32;
  justification: I2SJustification;
}

export type FrontendDecoderId = 'i2c' | 'spi' | 'uart' | 'can' | 'lin' | 'i2s';
export type DecoderProtocolId = FrontendDecoderId;

interface ActiveDecoderConfig {
  decoderId: FrontendDecoderId;
  label: string;
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
  lastExecutionMode: 'regular' | 'streaming' | null;
  lastChunksProcessed: number | null;
  i2cMapping: I2CMappingState;
  spiMapping: SPIMappingState;
  spiOptions: SPIOptionsState;
  uartMapping: UARTMappingState;
  uartOptions: UARTOptionState;
  canMapping: CANMappingState;
  canOptions: CANOptionState;
  linMapping: LINMappingState;
  linOptions: LINOptionState;
  i2sMapping: I2SMappingState;
  i2sOptions: I2SOptionState;
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
const SPI_MAPPING_CONFLICT = 'SPI 通道映射不能重复使用同一采集通道';
const SPI_CHANNELS_REQUIRED = 'SPI 解码需要 CLK 和至少一个 MISO/MOSI 通道';
const UART_MAPPING_CONFLICT = 'RX 和 TX 不能映射到同一采集通道';
const UART_CHANNEL_REQUIRED = 'UART 解码需要至少一个 RX 或 TX 通道';
const CAN_CHANNELS_REQUIRED = 'CAN 解码需要 CAN RX 通道';
const LIN_CHANNEL_REQUIRED = 'LIN 解码需要 RX 通道';
const I2S_MAPPING_CONFLICT = 'SCK、WS 和 SD 不能映射到同一采集通道';
const I2S_CHANNELS_REQUIRED = 'I2S 解码需要 SCK、WS 和 SD 三个通道';
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

function findNamedChannel(
  channels: VisibleChannelEntry[],
  pattern: RegExp,
  usedCaptureIndexes = new Set<number>()
): VisibleChannelEntry | undefined {
  return channels.find(entry =>
    !usedCaptureIndexes.has(entry.captureIndex)
    && pattern.test(entry.channel.channelName ?? '')
  );
}

function findFallbackChannel(
  channels: VisibleChannelEntry[],
  fallbackPosition: number,
  usedCaptureIndexes: Set<number>
): VisibleChannelEntry | undefined {
  const numberedChannel = channels.find(entry =>
    !usedCaptureIndexes.has(entry.captureIndex)
    && entry.channel.channelNumber === fallbackPosition
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
  let sclChannel = findNamedChannel(channels, /scl/i, usedCaptureIndexes);
  if (sclChannel) {
    usedCaptureIndexes.add(sclChannel.captureIndex);
  }

  let sdaChannel = findNamedChannel(channels, /sda/i, usedCaptureIndexes);
  if (sdaChannel) {
    usedCaptureIndexes.add(sdaChannel.captureIndex);
  }

  if (!sclChannel) {
    sclChannel = findFallbackChannel(channels, 0, usedCaptureIndexes);
    if (sclChannel) {
      usedCaptureIndexes.add(sclChannel.captureIndex);
    }
  }

  if (!sdaChannel) {
    sdaChannel = findFallbackChannel(channels, 1, usedCaptureIndexes);
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

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export const useDecoderStore = defineStore('frontend-decoder', {
  state: (): FrontendDecoderState => ({
    activeDecoderConfigs: [
      { decoderId: 'i2c', label: 'I2C' },
      { decoderId: 'spi', label: 'SPI' },
      { decoderId: 'uart', label: 'UART' },
      { decoderId: 'can', label: 'CAN' },
      { decoderId: 'lin', label: 'LIN' },
      { decoderId: 'i2s', label: 'I2S' }
    ],
    selectedDecoderId: 'i2c',
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
    },
    spiMapping: {
      clkCaptureIndex: null,
      misoCaptureIndex: null,
      mosiCaptureIndex: null,
      csCaptureIndex: null
    },
    spiOptions: { ...DEFAULT_SPI_OPTIONS },
    uartMapping: {
      rxCaptureIndex: null,
      txCaptureIndex: null
    },
    uartOptions: { ...DEFAULT_UART_OPTIONS },
    canMapping: {
      rxCaptureIndex: null
    },
    canOptions: {
      bitrate: 500000,
      samplePoint: 75
    },
    linMapping: {
      rxCaptureIndex: null
    },
    linOptions: {
      baudrate: 19200,
      dataLength: 2,
      checksum: 'classic'
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
    setSelectedDecoder(decoderId: FrontendDecoderId) {
      this.selectedDecoderId = decoderId;
      this.recalculateChannelConflicts();
    },

    setActiveDecoder(decoderId: FrontendDecoderId) {
      this.setSelectedDecoder(decoderId);
    },

    selectDecoder(decoderId: FrontendDecoderId) {
      this.setSelectedDecoder(decoderId);
    },

    initializeChannelMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeI2CMapping(channels);
      this.initializeSPIMapping(channels);
      this.initializeUARTMapping(channels);
      this.initializeCANMapping(channels);
      this.initializeLINMapping(channels);
      this.initializeI2SMapping(channels);
      this.recalculateChannelConflicts();
    },

    initializeDecoderMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeChannelMappings(channels);
    },

    initializeProtocolMappings(channels: FrontendAnalyzerChannel[]) {
      this.initializeChannelMappings(channels);
    },

    initializeI2CMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      this.i2cMapping = resolveI2CMapping(visibleChannels);
      this.recalculateChannelConflicts();
    },

    initializeUARTMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const rxChannel = findNamedChannel(visibleChannels, /(^|\b)rx(\b|$)/i);
      const usedCaptureIndexes = new Set<number>();
      if (rxChannel) {
        usedCaptureIndexes.add(rxChannel.captureIndex);
      }
      const txChannel = findNamedChannel(visibleChannels, /(^|\b)tx(\b|$)/i, usedCaptureIndexes);
      const fallbackRx = rxChannel ?? visibleChannels[0];

      this.uartMapping = {
        rxCaptureIndex: fallbackRx?.captureIndex ?? null,
        txCaptureIndex: txChannel?.captureIndex ?? visibleChannels.find(entry =>
          entry.captureIndex !== fallbackRx?.captureIndex
        )?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
    },

    initializeCANMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const namedCan = findNamedChannel(visibleChannels, /can|rx/i);
      this.canMapping = {
        rxCaptureIndex: namedCan?.captureIndex ?? visibleChannels[0]?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
    },

    initializeLINMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const namedLin = findNamedChannel(visibleChannels, /lin|rx/i);
      this.linMapping = {
        rxCaptureIndex: namedLin?.captureIndex ?? visibleChannels[0]?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
    },

    initializeI2SMapping(channels: FrontendAnalyzerChannel[]) {
      const visibleChannels = getVisibleChannelEntries(channels);
      const usedCaptureIndexes = new Set<number>();
      const sckChannel = findNamedChannel(visibleChannels, /sck|bclk|clock/i, usedCaptureIndexes)
        ?? findFallbackChannel(visibleChannels, 0, usedCaptureIndexes);
      if (sckChannel) {
        usedCaptureIndexes.add(sckChannel.captureIndex);
      }
      const wsChannel = findNamedChannel(visibleChannels, /ws|lrck|word/i, usedCaptureIndexes)
        ?? findFallbackChannel(visibleChannels, 1, usedCaptureIndexes);
      if (wsChannel) {
        usedCaptureIndexes.add(wsChannel.captureIndex);
      }
      const sdChannel = findNamedChannel(visibleChannels, /sd|data/i, usedCaptureIndexes)
        ?? findFallbackChannel(visibleChannels, 2, usedCaptureIndexes);

      this.i2sMapping = {
        sckCaptureIndex: sckChannel?.captureIndex ?? null,
        wsCaptureIndex: wsChannel?.captureIndex ?? null,
        sdCaptureIndex: sdChannel?.captureIndex ?? null
      };
      this.recalculateChannelConflicts();
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

    setCANMapping(captureIndex: number | null) {
      this.canMapping.rxCaptureIndex = captureIndex;
      this.recalculateChannelConflicts();
    },

    setCANOption(option: keyof CANOptionState, value: number) {
      if (!Number.isFinite(value)) {
        return;
      }

      if (option === 'bitrate') {
        this.canOptions.bitrate = normalizePositiveInteger(value, 500000);
      } else {
        this.canOptions.samplePoint = Math.min(99, Math.max(1, Math.round(value)));
      }
    },

    setLINMapping(captureIndex: number | null) {
      this.linMapping.rxCaptureIndex = captureIndex;
      this.recalculateChannelConflicts();
    },

    setLINOption(option: keyof LINOptionState, value: number | LINChecksumMode) {
      if (option === 'baudrate') {
        this.linOptions.baudrate = normalizePositiveInteger(Number(value), 19200);
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

    setI2SMapping(role: 'sck' | 'ws' | 'sd', captureIndex: number | null) {
      if (role === 'sck') {
        this.i2sMapping.sckCaptureIndex = captureIndex;
      } else if (role === 'ws') {
        this.i2sMapping.wsCaptureIndex = captureIndex;
      } else {
        this.i2sMapping.sdCaptureIndex = captureIndex;
      }
      this.recalculateChannelConflicts();
    },

    setI2SOption(option: 'word_length' | 'justification', value: number | I2SJustification) {
      if (option === 'word_length') {
        this.i2sOptions.wordLength = value === 24 || value === 32 ? value : 16;
      } else {
        this.i2sOptions.justification = value === 'left' ? 'left' : 'i2s';
      }
    },

    recalculateChannelConflicts() {
      if (this.selectedDecoderId === 'i2c') {
        this.recalculateI2CConflicts();
        return;
      }

      if (this.selectedDecoderId === 'spi') {
        this.recalculateSPIConflicts();
        return;
      }

      if (this.selectedDecoderId === 'uart') {
        const conflicts: string[] = [];
        const { rxCaptureIndex, txCaptureIndex } = this.uartMapping;
        if (
          rxCaptureIndex !== null
          && txCaptureIndex !== null
          && rxCaptureIndex === txCaptureIndex
        ) {
          conflicts.push(UART_MAPPING_CONFLICT);
        }
        this.channelConflicts = conflicts;
        return;
      }

      if (this.selectedDecoderId === 'i2s') {
        this.recalculateI2SConflicts();
        return;
      }

      this.channelConflicts = [];
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
      this.recalculateChannelConflicts();
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
      this.selectedDecoderId = 'i2c';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runUARTDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'uart';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runCANDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'can';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runLINDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'lin';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runI2SDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'i2s';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runSPIDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.selectedDecoderId = 'spi';
      await this.runSelectedDecoder(host, sessionStore);
    },

    async runSelectedDecoder(host: Pick<HostAdapter, 'sendCommand'>, sessionStore: SessionLike) {
      this.recalculateChannelConflicts();
      this.decoderErrors = [];

      const visibleChannels = getVisibleChannelEntries(sessionStore.channels);
      const validationError = this.validateSelectedDecoder(sessionStore, visibleChannels);
      if (validationError) {
        this.decoderResults = [];
        this.lastDecoderName = null;
        this.lastExecutionMode = null;
        this.lastChunksProcessed = null;
        this.decoderErrors = [validationError];
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
          this.lastExecutionMode = response ? (response.isStreaming ? 'streaming' : 'regular') : null;
          this.lastChunksProcessed = response?.performanceStats?.chunksProcessed ?? null;
          this.decoderErrors = [commandResult.error ?? failureLabel];
          return;
        }

        if (!response) {
          this.decoderResults = [];
          this.lastExecutionTime = null;
          this.lastDecoderName = null;
          this.lastExecutionMode = null;
          this.lastChunksProcessed = null;
          this.decoderErrors = [failureLabel];
          return;
        }

        this.lastExecutionTime = response.executionTime;
        this.lastDecoderName = response.decoderName;
        this.lastExecutionMode = response.isStreaming ? 'streaming' : 'regular';
        this.lastChunksProcessed = response.performanceStats?.chunksProcessed ?? null;

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
        this.lastExecutionMode = null;
        this.lastChunksProcessed = null;
        this.decoderErrors = [error instanceof Error ? error.message : `${this.selectedDecoderId.toUpperCase()} 解码失败`];
      } finally {
        this.isDecoding = false;
      }
    },

    validateSelectedDecoder(sessionStore: SessionLike, visibleChannels: VisibleChannelEntry[]): string | null {
      if (!sessionStore.hasData) {
        return NO_DECODABLE_SAMPLES;
      }

      if (this.selectedDecoderId === 'i2c' && (
        visibleChannels.length < 2
        || this.i2cMapping.sclCaptureIndex === null
        || this.i2cMapping.sdaCaptureIndex === null
      )) {
        return I2C_CHANNELS_REQUIRED;
      }

      if (this.selectedDecoderId === 'spi' && (
        visibleChannels.length < 2
        || this.spiMapping.clkCaptureIndex === null
        || (this.spiMapping.misoCaptureIndex === null && this.spiMapping.mosiCaptureIndex === null)
      )) {
        return SPI_CHANNELS_REQUIRED;
      }

      if (this.selectedDecoderId === 'uart' && (
        visibleChannels.length < 1
        || (this.uartMapping.rxCaptureIndex === null && this.uartMapping.txCaptureIndex === null)
      )) {
        return UART_CHANNEL_REQUIRED;
      }

      if (this.selectedDecoderId === 'can' && (
        visibleChannels.length < 1
        || this.canMapping.rxCaptureIndex === null
      )) {
        return CAN_CHANNELS_REQUIRED;
      }

      if (this.selectedDecoderId === 'lin' && (
        visibleChannels.length < 1
        || this.linMapping.rxCaptureIndex === null
      )) {
        return LIN_CHANNEL_REQUIRED;
      }

      if (this.selectedDecoderId === 'i2s' && (
        visibleChannels.length < 3
        || this.i2sMapping.sckCaptureIndex === null
        || this.i2sMapping.wsCaptureIndex === null
        || this.i2sMapping.sdCaptureIndex === null
      )) {
        return I2S_CHANNELS_REQUIRED;
      }

      return null;
    },

    createChannelMapping(decoderId: FrontendDecoderId) {
      if (decoderId === 'i2c') {
        return [
          { captureIndex: this.i2cMapping.sclCaptureIndex, decoderIndex: 0, name: 'SCL' },
          { captureIndex: this.i2cMapping.sdaCaptureIndex, decoderIndex: 1, name: 'SDA' }
        ];
      }

      if (decoderId === 'spi') {
        const mapping = [
          { captureIndex: this.spiMapping.clkCaptureIndex, decoderIndex: 0, name: 'CLK' },
          this.spiMapping.misoCaptureIndex === null
            ? null
            : { captureIndex: this.spiMapping.misoCaptureIndex, decoderIndex: 1, name: 'MISO' },
          this.spiMapping.mosiCaptureIndex === null
            ? null
            : { captureIndex: this.spiMapping.mosiCaptureIndex, decoderIndex: 2, name: 'MOSI' },
          this.spiMapping.csCaptureIndex === null
            ? null
            : { captureIndex: this.spiMapping.csCaptureIndex, decoderIndex: 3, name: 'CS' }
        ];

        return mapping.filter(
          (item): item is { captureIndex: number; decoderIndex: number; name: string } =>
            item !== null && item.captureIndex !== null
        );
      }

      if (decoderId === 'uart') {
        const mapping = [];
        if (this.uartMapping.rxCaptureIndex !== null) {
          mapping.push({ captureIndex: this.uartMapping.rxCaptureIndex, decoderIndex: 0, name: 'RX' });
        }
        if (this.uartMapping.txCaptureIndex !== null) {
          mapping.push({ captureIndex: this.uartMapping.txCaptureIndex, decoderIndex: 1, name: 'TX' });
        }
        return mapping;
      }

      if (decoderId === 'can') {
        return [
          { captureIndex: this.canMapping.rxCaptureIndex, decoderIndex: 0, name: 'CAN RX' }
        ];
      }

      if (decoderId === 'lin') {
        return [
          { captureIndex: this.linMapping.rxCaptureIndex, decoderIndex: 0, name: 'LIN RX' }
        ];
      }

      return [
        { captureIndex: this.i2sMapping.sckCaptureIndex, decoderIndex: 0, name: 'SCK' },
        { captureIndex: this.i2sMapping.wsCaptureIndex, decoderIndex: 1, name: 'WS' },
        { captureIndex: this.i2sMapping.sdCaptureIndex, decoderIndex: 2, name: 'SD' }
      ];
    },

    createDecoderOptions(decoderId: FrontendDecoderId): Array<{ optionIndex: number; value: unknown }> {
      if (decoderId === 'spi') {
        return [
          { optionIndex: 0, value: this.spiOptions.csPolarity },
          { optionIndex: 1, value: this.spiOptions.cpol },
          { optionIndex: 2, value: this.spiOptions.cpha },
          { optionIndex: 3, value: this.spiOptions.bitOrder },
          { optionIndex: 4, value: this.spiOptions.wordSize }
        ];
      }

      if (decoderId === 'uart') {
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

      if (decoderId === 'can') {
        return [
          { optionIndex: 0, value: this.canOptions.bitrate },
          { optionIndex: 1, value: this.canOptions.samplePoint }
        ];
      }

      if (decoderId === 'lin') {
        return [
          { optionIndex: 0, value: this.linOptions.baudrate },
          { optionIndex: 1, value: this.linOptions.dataLength },
          { optionIndex: 2, value: this.linOptions.checksum }
        ];
      }

      if (decoderId === 'i2s') {
        return [
          { optionIndex: 0, value: this.i2sOptions.wordLength },
          { optionIndex: 1, value: this.i2sOptions.justification }
        ];
      }

      return [];
    }
  }
});
