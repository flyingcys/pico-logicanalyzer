/**
 * I2C 流式解码器
 * 基于 @logicanalyzer/Software 的 I2C 解码器实现
 * 提供大数据量的流式处理能力
 */

import { decoderDebugLog, StreamingDecoderBase, StreamingConfig } from '../StreamingDecoder';
import type {
  DecoderResult,
  ChannelData,
  DecoderOptionValue,
  DecoderSelectedChannel,
  DecoderInfo,
  DecoderChannel,
  DecoderOption
} from '../types';

/**
 * I2C 解码状态
 */
enum I2CState {
  IDLE = 'idle',
  START = 'start',
  ADDRESS = 'address',
  ACK_NACK = 'ack_nack',
  DATA = 'data',
  STOP = 'stop'
}

/**
 * I2C 数据块状态
 */
interface I2CChunkState {
  /** 当前状态 */
  state: I2CState;
  /** 当前字节数据 */
  currentByte: number;
  /** 当前位计数 */
  bitCount: number;
  /** 地址字节 */
  address: number;
  /** 读写标志 */
  isRead: boolean;
  /** 当前数据字节 */
  dataBytes: number[];
  /** 当前字节的 bit 注释信息 */
  currentBits: Array<{ value: number; startSample: number; endSample: number }>;
  /** 当前字节起始样本 */
  currentByteStartSample: number | null;
  /** 上一个SCL状态 */
  lastSCL: number;
  /** 上一个SDA状态 */
  lastSDA: number;
  /** 开始样本位置 */
  startSample: number;
}

/**
 * I2C 流式解码器实现
 */
export class StreamingI2CDecoder extends StreamingDecoderBase {
  private channels: { scl: number; sda: number } = { scl: 0, sda: 1 };
  private globalState: I2CChunkState;
  private resultCounter = 0;

  constructor(config: Partial<StreamingConfig> = {}) {
    super({
      chunkSize: 5000, // I2C 适中的块大小
      processingInterval: 5, // 较短的处理间隔
      enableProgressCallback: true,
      ...config,
      maxConcurrentChunks: 1 // I2C 依赖跨块状态，必须按顺序处理
    });

    // 初始化全局状态
    this.globalState = this.createInitialState();
  }

  /**
   * 获取解码器信息
   */
  public getInfo(): DecoderInfo {
    return {
      id: 'streaming_i2c',
      name: 'I²C (Streaming)',
      longname: 'Inter-Integrated Circuit (Streaming)',
      description: 'I²C two-wire serial bus decoder with streaming support for large datasets',
      license: 'MIT',
      inputs: ['logic'],
      outputs: ['i2c'],
      tags: ['Embedded', 'Protocol', 'Serial', 'Streaming'],
      channels: [
        {
          id: 'scl',
          name: 'SCL',
          desc: 'Serial clock line',
          required: true
        },
        {
          id: 'sda',
          name: 'SDA',
          desc: 'Serial data line',
          required: true
        }
      ] as DecoderChannel[],
      options: [
        {
          id: 'address_format',
          desc: 'Address format',
          default: 'shifted',
          values: ['shifted', 'unshifted']
        }
      ] as DecoderOption[],
      annotations: [
        ['start', 'Start condition'],
        ['repeat-start', 'Repeat start condition'],
        ['stop', 'Stop condition'],
        ['ack', 'ACK'],
        ['nack', 'NACK'],
        ['bit', 'Data/address bit'],
        ['address-read', 'Address read'],
        ['address-write', 'Address write'],
        ['data-read', 'Data read'],
        ['data-write', 'Data write'],
        ['warning', 'Warning'],
        ['error', 'Error']
      ],
      annotationRows: [
        ['bits', 'Bits', [5]],
        ['addr-data', 'Address/data', [0, 1, 2, 3, 4, 6, 7, 8, 9]],
        ['warnings', 'Warnings', [10, 11]]
      ]
    };
  }

  /**
   * 初始化解码状态
   */
  protected async initializeDecoding(
    sampleRate: number,
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<void> {
    this.channels = { scl: 0, sda: 1 };

    // 设置通道映射，兼容 Manager 的 captureIndex/decoderIndex 和旧 name/channel 字段
    for (const channel of selectedChannels) {
      const captureIndex = Number.isInteger(channel.captureIndex)
        ? channel.captureIndex
        : channel.channel;
      if (captureIndex === undefined) {
        continue;
      }

      const channelName = channel.name?.toLowerCase();
      if (channel.decoderIndex === 0 || channelName === 'scl') {
        this.channels.scl = captureIndex;
      } else if (channel.decoderIndex === 1 || channelName === 'sda') {
        this.channels.sda = captureIndex;
      }
    }

    // 重置全局状态
    this.globalState = this.createInitialState();
    this.resultCounter = 0;

    decoderDebugLog(`📡 I2C流式解码器初始化: SCL=CH${this.channels.scl + 1}, SDA=CH${this.channels.sda + 1}`);
  }

  /**
   * 处理单个数据块
   */
  protected async processChunk(
    chunk: any,
    sampleRate: number,
    options: DecoderOptionValue[],
    _selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]> {
    const results: DecoderResult[] = [];

    // 获取通道数据
    const sclData = this.getChannelData(chunk.channelData, this.channels.scl);
    const sdaData = this.getChannelData(chunk.channelData, this.channels.sda);

    if (!sclData || !sdaData) {
      console.warn(`⚠️ I2C解码器: 块 ${chunk.index} 缺少必需的通道数据`);
      return results;
    }

    const minLength = Math.min(sclData.length, sdaData.length);
    const chunkState = { ...this.globalState };

    // 逐样本处理
    for (let i = chunk.overlapSize; i < minLength; i++) {
      if (this.shouldStop) {
        throw new Error('用户停止处理');
      }

      const sampleIndex = chunk.startSample + i - chunk.overlapSize;
      const scl = sclData[i];
      const sda = sdaData[i];

      // 检测 I2C 条件
      const condition = this.detectI2CCondition(chunkState, scl, sda);

      if (condition) {
        const result = this.processI2CCondition(
          condition,
          sampleIndex,
          chunkState,
          options,
          sda
        );

        if (result) {
          for (const item of result) {
            item.startSample = Math.max(0, item.startSample); // 确保样本索引有效
            results.push(item);
          }
          this.resultCounter += result.length;
        }
      }

      // 更新状态
      chunkState.lastSCL = scl;
      chunkState.lastSDA = sda;
    }

    // 更新全局状态（保留跨块状态）
    this.globalState = chunkState;

    // 更新结果计数用于进度显示
    if (this.onProgress) {
      const progress = this.calculateProgress(0); // totalChunks 将在父类中设置
      progress.resultCount = this.resultCounter;
      // 进度更新在父类中处理
    }

    return results;
  }

  /**
   * 完成解码处理
   */
  protected async finalizeDecoding(): Promise<void> {
    decoderDebugLog(`✅ I2C流式解码完成: 共产生 ${this.resultCounter} 个结果`);

    // 如果有未完成的事务，可以在这里处理
    if (this.globalState.state !== I2CState.IDLE) {
      decoderDebugLog(`⚠️ I2C解码结束时状态非空闲: ${this.globalState.state}`);
    }
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): I2CChunkState {
    return {
      state: I2CState.IDLE,
      currentByte: 0,
      bitCount: 0,
      address: 0,
      isRead: false,
      dataBytes: [],
      currentBits: [],
      currentByteStartSample: null,
      lastSCL: 1,
      lastSDA: 1,
      startSample: 0
    };
  }

  /**
   * 获取通道数据
   */
  private getChannelData(channelData: ChannelData[], channelIndex: number): Uint8Array | null {
    const channelByCaptureIndex = channelData[channelIndex];
    if (channelByCaptureIndex?.samples) {
      return channelByCaptureIndex.samples;
    }

    const channel = channelData.find(ch => ch.channelNumber === channelIndex);
    return channel?.samples || null;
  }

  /**
   * 检测 I2C 条件
   */
  private detectI2CCondition(
    state: I2CChunkState,
    scl: number,
    sda: number
  ): 'start' | 'stop' | 'bit' | null {
    // START 条件: SCL 高电平时 SDA 下降沿
    if (state.lastSCL === 1 && scl === 1 && state.lastSDA === 1 && sda === 0) {
      return 'start';
    }

    // STOP 条件: SCL 高电平时 SDA 上升沿
    if (state.lastSCL === 1 && scl === 1 && state.lastSDA === 0 && sda === 1) {
      return 'stop';
    }

    // 数据位: SCL 上升沿
    if (state.lastSCL === 0 && scl === 1) {
      return 'bit';
    }

    return null;
  }

  /**
   * 处理 I2C 条件
   */
  private processI2CCondition(
    condition: 'start' | 'stop' | 'bit',
    sampleIndex: number,
    state: I2CChunkState,
    options: DecoderOptionValue[],
    bitValue: number
  ): DecoderResult[] | null {
    switch (condition) {
      case 'start':
        return [this.processStartCondition(sampleIndex, state)];

      case 'stop':
        return [this.processStopCondition(sampleIndex, state)];

      case 'bit':
        return this.processBit(sampleIndex, state, options, bitValue);

      default:
        return null;
    }
  }

  /**
   * 处理 START 条件
   */
  private processStartCondition(sampleIndex: number, state: I2CChunkState): DecoderResult {
    const isRepeatStart = state.state !== I2CState.IDLE;

    state.state = I2CState.START;
    state.currentByte = 0;
    state.bitCount = 0;
    state.currentBits = [];
    state.currentByteStartSample = null;
    state.dataBytes = [];
    state.startSample = sampleIndex;

    return {
      startSample: sampleIndex,
      endSample: sampleIndex,
      annotationType: isRepeatStart ? 1 : 0, // repeat-start : start
      values: isRepeatStart ? ['Start repeat', 'Sr'] : ['Start', 'S'],
      rawData: null
    };
  }

  /**
   * 处理 STOP 条件
   */
  private processStopCondition(sampleIndex: number, state: I2CChunkState): DecoderResult {
    state.state = I2CState.IDLE;
    state.currentByte = 0;
    state.bitCount = 0;
    state.dataBytes = [];
    state.currentBits = [];
    state.currentByteStartSample = null;

    return {
      startSample: sampleIndex,
      endSample: sampleIndex,
      annotationType: 2, // stop
      values: ['Stop', 'P'],
      rawData: null
    };
  }

  /**
   * 处理数据位
   */
  private processBit(
    sampleIndex: number,
    state: I2CChunkState,
    options: DecoderOptionValue[],
    bit: number
  ): DecoderResult[] | null {
    if (state.state === I2CState.IDLE) {
      return null;
    }

    switch (state.state) {
      case I2CState.START:
        return this.processAddressBit(sampleIndex, state, bit, options);

      case I2CState.ADDRESS:
        return this.processAddressBit(sampleIndex, state, bit, options);

      case I2CState.ACK_NACK:
        return [this.processAckNackBit(sampleIndex, state, bit)];

      case I2CState.DATA:
        return this.processDataBit(sampleIndex, state, bit);

      default:
        return null;
    }
  }

  /**
   * 处理地址位
   */
  private processAddressBit(
    sampleIndex: number,
    state: I2CChunkState,
    bit: number,
    options: DecoderOptionValue[]
  ): DecoderResult[] | null {
    state.state = I2CState.ADDRESS;
    if (state.bitCount === 0) {
      state.currentByteStartSample = sampleIndex;
      state.currentBits = [];
    }

    state.currentByte = (state.currentByte << 1) | bit;
    state.currentBits.push({ value: bit, startSample: sampleIndex, endSample: sampleIndex + 1 });
    state.bitCount++;

    if (state.bitCount === 8) {
      // 地址字节完成
      const addressByte = state.currentByte;
      state.address = addressByte >> 1; // 7位地址
      state.isRead = (addressByte & 1) === 1;
      state.state = I2CState.ACK_NACK;
      state.bitCount = 0;

      const addressFormat = this.getOptionValue(options, 0, 'shifted');
      const displayAddress = addressFormat === 'shifted' ? state.address : addressByte;
      const addressHex = displayAddress.toString(16).toUpperCase().padStart(2, '0');
      const bitAnnotations = this.createBitAnnotations(state.currentBits);
      const startSample = state.currentByteStartSample ?? state.startSample;

      state.currentByte = 0;
      state.currentBits = [];
      state.currentByteStartSample = null;

      return [
        ...bitAnnotations,
        {
          startSample,
          endSample: sampleIndex,
          annotationType: state.isRead ? 6 : 7, // address-read : address-write
          values: [
            `Address ${state.isRead ? 'read' : 'write'}: ${addressHex}`,
            `A${state.isRead ? 'R' : 'W'}: ${addressHex}`,
            addressHex
          ],
          rawData: displayAddress
        }
      ];
    }

    return null;
  }

  /**
   * 处理 ACK/NACK 位
   */
  private processAckNackBit(sampleIndex: number, state: I2CChunkState, bit: number): DecoderResult {
    const isAck = bit === 0;
    state.state = I2CState.DATA;
    state.currentByte = 0;
    state.bitCount = 0;
    state.currentBits = [];
    state.currentByteStartSample = null;
    state.startSample = sampleIndex;

    return {
      startSample: sampleIndex,
      endSample: sampleIndex,
      annotationType: isAck ? 3 : 4, // ack : nack
      values: isAck ? ['ACK', 'A'] : ['NACK', 'N']
    };
  }

  /**
   * 处理数据位
   */
  private processDataBit(sampleIndex: number, state: I2CChunkState, bit: number): DecoderResult[] | null {
    if (state.bitCount === 0) {
      state.currentByteStartSample = sampleIndex;
      state.currentBits = [];
    }

    state.currentByte = (state.currentByte << 1) | bit;
    state.currentBits.push({ value: bit, startSample: sampleIndex, endSample: sampleIndex + 1 });
    state.bitCount++;

    if (state.bitCount === 8) {
      // 数据字节完成
      const dataByte = state.currentByte;
      state.dataBytes.push(dataByte);
      state.state = I2CState.ACK_NACK;
      state.bitCount = 0;
      const dataHex = dataByte.toString(16).toUpperCase().padStart(2, '0');
      const bitAnnotations = this.createBitAnnotations(state.currentBits);
      const startSample = state.currentByteStartSample ?? sampleIndex;

      state.currentByte = 0;
      state.currentBits = [];
      state.currentByteStartSample = null;

      return [
        ...bitAnnotations,
        {
          startSample,
          endSample: sampleIndex,
          annotationType: state.isRead ? 8 : 9, // data-read : data-write
          values: [
            `Data ${state.isRead ? 'read' : 'write'}: ${dataHex}`,
            `D${state.isRead ? 'R' : 'W'}: ${dataHex}`,
            dataHex
          ],
          rawData: dataByte
        }
      ];
    }

    return null;
  }

  private createBitAnnotations(
    bits: Array<{ value: number; startSample: number; endSample: number }>
  ): DecoderResult[] {
    return bits.map(bit => ({
      startSample: bit.startSample,
      endSample: bit.endSample,
      annotationType: 5,
      values: [String(bit.value)]
    }));
  }

  /**
   * 获取选项值
   */
  private getOptionValue(options: DecoderOptionValue[], optionIndex: number, defaultValue: any): any {
    const option = options.find(opt => opt.optionIndex === optionIndex);
    return option ? option.value : defaultValue;
  }
}

// 导出工厂函数
export function createStreamingI2CDecoder(config?: Partial<StreamingConfig>): StreamingI2CDecoder {
  return new StreamingI2CDecoder(config);
}
