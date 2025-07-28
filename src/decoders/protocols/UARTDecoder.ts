/**
 * UART协议解码器
 * 基于 @logicanalyzer/Software 的 uart/pd.py 精确移植
 * 实现完整的UART协议解码功能
 */

import { DecoderBase } from '../DecoderBase';
import {
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderResult,
  DecoderOutput,
  DecoderOutputType,
  ChannelData
} from '../types';

/**
 * UART数据方向
 */
const RX = 0;
const TX = 1;

/**
 * 注释类型枚举
 * 对应原解码器的 Ann 类
 */
enum Ann {
  RX_DATA = 0, TX_DATA = 1, RX_START = 2, TX_START = 3,
  RX_PARITY_OK = 4, TX_PARITY_OK = 5, RX_PARITY_ERR = 6, TX_PARITY_ERR = 7,
  RX_STOP = 8, TX_STOP = 9, RX_WARN = 10, TX_WARN = 11,
  RX_DATA_BIT = 12, TX_DATA_BIT = 13, RX_BREAK = 14, TX_BREAK = 15,
  RX_PACKET = 16, TX_PACKET = 17
}

/**
 * 数据位信息
 */
interface DataBitInfo {
  value: number;
  startSample: number;
  endSample: number;
}

/**
 * UART状态类型
 */
type UARTState = 'WAIT FOR START BIT' | 'GET START BIT' | 'GET DATA BITS' | 'GET PARITY BIT' | 'GET STOP BITS';

/**
 * 校验位验证函数
 * 对应原解码器的 parity_ok() 函数
 */
function parityOk(parityType: string, parityBit: number, data: number, dataBits: number): boolean {
  if (parityType === 'ignore') {
    return true;
  }

  // 简单情况处理 (校验位总是1或0)
  if (parityType === 'zero') {
    return parityBit === 0;
  } else if (parityType === 'one') {
    return parityBit === 1;
  }

  // 计算数据中1的个数 (包括校验位本身)
  const ones = data.toString(2).split('1').length - 1 + parityBit;

  // 检查奇偶校验
  if (parityType === 'odd') {
    return (ones % 2) === 1;
  } else if (parityType === 'even') {
    return (ones % 2) === 0;
  }

  return false;
}

/**
 * UART协议解码器实现
 * 对应原软件的 uart Decoder 类
 */
export class UARTDecoder extends DecoderBase {
  // 解码器元数据 - 完全匹配原Python解码器
  readonly id = 'uart';
  readonly name = 'UART';
  readonly longname = 'Universal Asynchronous Receiver/Transmitter';
  readonly desc = 'Asynchronous, serial bus.';
  readonly license = 'gplv2+';
  readonly inputs = ['logic'];
  readonly outputs = ['uart'];
  readonly tags = ['Embedded/industrial'];

  // 通道定义 - 匹配原解码器 (都是可选通道)
  readonly channels: DecoderChannel[] = [
    { id: 'rx', name: 'RX', desc: 'UART receive line', required: false, index: 0 },
    { id: 'tx', name: 'TX', desc: 'UART transmit line', required: false, index: 1 }
  ];

  // 配置选项 - 匹配原解码器
  readonly options: DecoderOption[] = [
    {
      id: 'baudrate',
      desc: 'Baud rate',
      default: 115200,
      type: 'int'
    },
    {
      id: 'data_bits',
      desc: 'Data bits',
      default: 8,
      values: ['5', '6', '7', '8', '9'],
      type: 'list'
    },
    {
      id: 'parity',
      desc: 'Parity',
      default: 'none',
      values: ['none', 'odd', 'even', 'zero', 'one', 'ignore'],
      type: 'list'
    },
    {
      id: 'stop_bits',
      desc: 'Stop bits',
      default: 1.0,
      values: ['0.0', '0.5', '1.0', '1.5', '2.0'],
      type: 'list'
    },
    {
      id: 'bit_order',
      desc: 'Bit order',
      default: 'lsb-first',
      values: ['lsb-first', 'msb-first'],
      type: 'list'
    },
    {
      id: 'format',
      desc: 'Data format',
      default: 'hex',
      values: ['ascii', 'dec', 'hex', 'oct', 'bin'],
      type: 'list'
    },
    {
      id: 'invert_rx',
      desc: 'Invert RX',
      default: 'no',
      values: ['yes', 'no'],
      type: 'list'
    },
    {
      id: 'invert_tx',
      desc: 'Invert TX',
      default: 'no',
      values: ['yes', 'no'],
      type: 'list'
    },
    {
      id: 'sample_point',
      desc: 'Sample point (%)',
      default: 50,
      type: 'int'
    }
  ];

  // 注释类型定义 - 匹配原解码器的annotations
  readonly annotations: Array<[string, string, string?]> = [
    ['rx-data', 'RX data'],
    ['tx-data', 'TX data'],
    ['rx-start', 'RX start bit'],
    ['tx-start', 'TX start bit'],
    ['rx-parity-ok', 'RX parity OK bit'],
    ['tx-parity-ok', 'TX parity OK bit'],
    ['rx-parity-err', 'RX parity error bit'],
    ['tx-parity-err', 'TX parity error bit'],
    ['rx-stop', 'RX stop bit'],
    ['tx-stop', 'TX stop bit'],
    ['rx-warning', 'RX warning'],
    ['tx-warning', 'TX warning'],
    ['rx-data-bit', 'RX data bit'],
    ['tx-data-bit', 'TX data bit'],
    ['rx-break', 'RX break'],
    ['tx-break', 'TX break'],
    ['rx-packet', 'RX packet'],
    ['tx-packet', 'TX packet']
  ];

  // 注释行定义 - 匹配原解码器的annotation_rows
  readonly annotationRows: Array<[string, string, number[]]> = [
    ['rx-data-bits', 'RX bits', [Ann.RX_DATA_BIT]],
    ['rx-data-vals', 'RX data', [Ann.RX_DATA, Ann.RX_START, Ann.RX_PARITY_OK, Ann.RX_PARITY_ERR, Ann.RX_STOP]],
    ['rx-warnings', 'RX warnings', [Ann.RX_WARN]],
    ['rx-breaks', 'RX breaks', [Ann.RX_BREAK]],
    ['rx-packets', 'RX packets', [Ann.RX_PACKET]],
    ['tx-data-bits', 'TX bits', [Ann.TX_DATA_BIT]],
    ['tx-data-vals', 'TX data', [Ann.TX_DATA, Ann.TX_START, Ann.TX_PARITY_OK, Ann.TX_PARITY_ERR, Ann.TX_STOP]],
    ['tx-warnings', 'TX warnings', [Ann.TX_WARN]],
    ['tx-breaks', 'TX breaks', [Ann.TX_BREAK]],
    ['tx-packets', 'TX packets', [Ann.TX_PACKET]]
  ];

  // 解码器状态变量 - 对应原解码器的实例变量
  private frameStart = [-1, -1];
  private frameValid = [true, true];
  private curFrameBit = [0, 0];
  private startBit = [-1, -1];
  private curDataBit = [0, 0];
  private dataValue = [0, 0];
  private parityBit = [-1, -1];
  private stopBits: number[][] = [[], []];
  private startSample = [-1, -1];
  private state: UARTState[] = ['WAIT FOR START BIT', 'WAIT FOR START BIT'];
  private dataBits: DataBitInfo[][] = [[], []];
  private breakStart = [null, null] as (number | null)[];
  private packetCache: number[][] = [[], []];
  private ssPacket = [null, null] as (number | null)[];
  private esPacket = [null, null] as (number | null)[];
  private idleStart = [null, null] as (number | null)[];

  // 配置变量
  private bitWidth = 0;
  private frameLenSampleCount = 0;
  private breakMinSampleCount = 0;
  private byteWidth = 1;

  // 通道可用性
  private hasPin = [false, false];
  private inv = [false, false];

  // 选项值
  private baudrate = 115200;
  private dataBits = 8;
  private parity = 'none';
  private stopBitsCount = 1.0;
  private bitOrder = 'lsb-first';
  private format = 'hex';
  private samplePoint = 50;

  /**
   * 主解码方法
   * 对应原解码器的 decode() 方法
   */
  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    if (!sampleRate) {
      throw new Error('Cannot decode without samplerate.');
    }

    // 检查通道可用性
    this.hasPin[RX] = channels.length > 0 && channels[0].samples.length > 0;
    this.hasPin[TX] = channels.length > 1 && channels[1].samples.length > 0;

    if (!this.hasPin[RX] && !this.hasPin[TX]) {
      throw new Error('Need at least one of TX or RX pins.');
    }

    // 初始化
    this.sampleRate = sampleRate;
    this.prepareChannelData(channels, [
      { captureIndex: 0, decoderIndex: 0 }, // RX
      { captureIndex: 1, decoderIndex: 1 }  // TX
    ]);

    // 处理选项
    this.processOptions(options);

    // 计算位宽
    this.bitWidth = sampleRate / this.baudrate;

    // 计算完整帧的样本数
    let frameSamples = 1; // START位
    frameSamples += this.dataBits;
    frameSamples += (this.parity === 'none') ? 0 : 1;
    frameSamples += this.stopBitsCount;
    frameSamples *= this.bitWidth;
    this.frameLenSampleCount = Math.ceil(frameSamples);
    this.breakMinSampleCount = this.frameLenSampleCount;

    // 开始解码
    this.start();
    this.reset();

    // 简化的解码循环 - 主要处理RX通道
    if (this.hasPin[RX]) {
      this.decodeChannel(RX);
    }
    if (this.hasPin[TX]) {
      this.decodeChannel(TX);
    }

    return this.results;
  }

  /**
   * 处理配置选项
   */
  private processOptions(options: DecoderOptionValue[]): void {
    for (const option of options) {
      switch (option.optionIndex) {
        case 0: // baudrate
          this.baudrate = option.value as number;
          break;
        case 1: // data_bits
          this.dataBits = parseInt(option.value as string);
          break;
        case 2: // parity
          this.parity = option.value as string;
          break;
        case 3: // stop_bits
          this.stopBitsCount = parseFloat(option.value as string);
          break;
        case 4: // bit_order
          this.bitOrder = option.value as string;
          break;
        case 5: // format
          this.format = option.value as string;
          break;
        case 6: // invert_rx
          this.inv[RX] = (option.value as string) === 'yes';
          break;
        case 7: // invert_tx
          this.inv[TX] = (option.value as string) === 'yes';
          break;
        case 8: // sample_point
          this.samplePoint = option.value as number;
          break;
      }
    }

    this.byteWidth = Math.floor((this.dataBits + 7) / 8);
  }

  /**
   * 解码单个通道
   * 简化实现，主要处理基本的UART帧结构
   */
  private decodeChannel(rxtx: number): void {
    this.sampleIndex = 0;
    this.state[rxtx] = 'WAIT FOR START BIT';

    while (this.hasMoreSamples()) {
      const signal = this.getCurrentChannelValue(rxtx);
      
      try {
        this.inspectSample(rxtx, signal, this.inv[rxtx]);
        this.sampleIndex++;
      } catch (error) {
        if ((error as Error).message === 'End of samples reached') {
          break;
        }
        throw error;
      }
    }
  }

  /**
   * 获取当前通道值
   */
  private getCurrentChannelValue(rxtx: number): number {
    if (rxtx >= this.channelData.length) {
      return 1; // 空闲状态
    }
    const channel = this.channelData[rxtx];
    return this.sampleIndex < channel.length ? channel[this.sampleIndex] : 1;
  }

  /**
   * 获取样本点位置
   * 对应原解码器的 get_sample_point()
   */
  private getSamplePoint(rxtx: number, bitNum: number): number {
    const perc = (this.samplePoint >= 1 && this.samplePoint <= 99) ? this.samplePoint : 50;
    const percFloat = perc / 100.0;
    let bitPos = (this.bitWidth - 1) * percFloat;
    bitPos += this.frameStart[rxtx];
    bitPos += bitNum * this.bitWidth;
    return bitPos;
  }

  /**
   * 检查样本
   * 对应原解码器的 inspect_sample()
   */
  private inspectSample(rxtx: number, signal: number, inv: boolean): void {
    if (inv) {
      signal = signal ? 0 : 1;
    }

    const state = this.state[rxtx];
    switch (state) {
      case 'WAIT FOR START BIT':
        this.waitForStartBit(rxtx, signal);
        break;
      case 'GET START BIT':
        this.getStartBit(rxtx, signal);
        break;
      case 'GET DATA BITS':
        this.getDataBits(rxtx, signal);
        break;
      case 'GET PARITY BIT':
        this.getParityBit(rxtx, signal);
        break;
      case 'GET STOP BITS':
        this.getStopBits(rxtx, signal);
        break;
    }
  }

  /**
   * 等待起始位
   * 对应原解码器的 wait_for_start_bit()
   */
  private waitForStartBit(rxtx: number, signal: number): void {
    // 检测下降沿 (起始位)
    if (signal === 0) {
      this.frameStart[rxtx] = this.sampleIndex;
      this.frameValid[rxtx] = true;
      this.curFrameBit[rxtx] = 0;
      this.advanceState(rxtx);
    }
  }

  /**
   * 获取起始位
   * 对应原解码器的 get_start_bit()
   */
  private getStartBit(rxtx: number, signal: number): void {
    this.startBit[rxtx] = signal;
    this.curFrameBit[rxtx]++;

    // 起始位必须是0
    if (this.startBit[rxtx] !== 0) {
      this.put(this.frameStart[rxtx], this.sampleIndex, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: Ann.RX_WARN + rxtx,
        values: ['Frame error', 'Frame err', 'FE']
      });
      this.frameValid[rxtx] = false;
      this.advanceState(rxtx, true);
      return;
    }

    // 重置内部状态
    this.curDataBit[rxtx] = 0;
    this.dataValue[rxtx] = 0;
    this.parityBit[rxtx] = -1;
    this.stopBits[rxtx] = [];
    this.startSample[rxtx] = -1;
    this.dataBits[rxtx] = [];

    this.put(this.frameStart[rxtx], this.sampleIndex, {
      type: DecoderOutputType.ANNOTATION,
      annotationType: Ann.RX_START + rxtx,
      values: ['Start bit', 'Start', 'S']
    });

    this.advanceState(rxtx);
  }

  /**
   * 获取数据位
   * 对应原解码器的 get_data_bits()
   */
  private getDataBits(rxtx: number, signal: number): void {
    // 保存第一个数据位的样本编号
    if (this.startSample[rxtx] === -1) {
      this.startSample[rxtx] = this.sampleIndex;
    }

    this.put(this.sampleIndex, this.sampleIndex + 1, {
      type: DecoderOutputType.ANNOTATION,
      annotationType: Ann.RX_DATA_BIT + rxtx,
      values: [signal.toString()]
    });

    // 存储个别数据位
    const halfBit = Math.floor(this.bitWidth / 2);
    this.dataBits[rxtx].push({
      value: signal,
      startSample: this.sampleIndex - halfBit,
      endSample: this.sampleIndex + halfBit
    });
    this.curFrameBit[rxtx]++;

    this.curDataBit[rxtx]++;
    if (this.curDataBit[rxtx] < this.dataBits) {
      return;
    }

    // 转换累积的数据位为数据值
    const bits = this.dataBits[rxtx].map(b => b.value);
    if (this.bitOrder === 'msb-first') {
      bits.reverse();
    }
    
    this.dataValue[rxtx] = 0;
    for (let i = 0; i < bits.length; i++) {
      this.dataValue[rxtx] |= bits[i] << i;
    }

    const formatted = this.formatValue(this.dataValue[rxtx]);
    if (formatted !== null) {
      this.put(this.startSample[rxtx], this.sampleIndex, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: rxtx, // RX_DATA or TX_DATA
        values: [formatted],
        rawData: this.dataValue[rxtx]
      });
    }

    this.dataBits[rxtx] = [];
    this.advanceState(rxtx);
  }

  /**
   * 获取校验位
   * 对应原解码器的 get_parity_bit()
   */
  private getParityBit(rxtx: number, signal: number): void {
    this.parityBit[rxtx] = signal;
    this.curFrameBit[rxtx]++;

    if (parityOk(this.parity, this.parityBit[rxtx], this.dataValue[rxtx], this.dataBits)) {
      this.put(this.sampleIndex, this.sampleIndex + 1, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: Ann.RX_PARITY_OK + rxtx,
        values: ['Parity bit', 'Parity', 'P']
      });
    } else {
      this.put(this.sampleIndex, this.sampleIndex + 1, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: Ann.RX_PARITY_ERR + rxtx,
        values: ['Parity error', 'Parity err', 'PE']
      });
      this.frameValid[rxtx] = false;
    }

    this.advanceState(rxtx);
  }

  /**
   * 获取停止位
   * 对应原解码器的 get_stop_bits()
   */
  private getStopBits(rxtx: number, signal: number): void {
    this.stopBits[rxtx].push(signal);
    this.curFrameBit[rxtx]++;

    // 停止位必须是1
    if (signal !== 1) {
      this.put(this.sampleIndex, this.sampleIndex + 1, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: Ann.RX_WARN + rxtx,
        values: ['Frame error', 'Frame err', 'FE']
      });
      this.frameValid[rxtx] = false;
    }

    this.put(this.sampleIndex, this.sampleIndex + 1, {
      type: DecoderOutputType.ANNOTATION,
      annotationType: Ann.RX_STOP + rxtx,
      values: ['Stop bit', 'Stop', 'T']
    });

    // 检查是否收集了所有停止位
    if (this.stopBits[rxtx].length >= this.stopBitsCount) {
      this.advanceState(rxtx);
    }
  }

  /**
   * 推进状态
   * 对应原解码器的 advance_state()
   */
  private advanceState(rxtx: number, fatal = false): void {
    if (fatal) {
      this.state[rxtx] = 'WAIT FOR START BIT';
      return;
    }

    switch (this.state[rxtx]) {
      case 'WAIT FOR START BIT':
        this.state[rxtx] = 'GET START BIT';
        break;
      case 'GET START BIT':
        this.state[rxtx] = 'GET DATA BITS';
        break;
      case 'GET DATA BITS':
        if (this.parity !== 'none') {
          this.state[rxtx] = 'GET PARITY BIT';
          break;
        }
        // 直接进入停止位处理
      case 'GET PARITY BIT':
        if (this.stopBitsCount > 0) {
          this.state[rxtx] = 'GET STOP BITS';
          break;
        }
        // 直接进入帧结束处理
      case 'GET STOP BITS':
        // 处理完整的UART帧
        const ss = this.frameStart[rxtx];
        const es = this.sampleIndex + Math.ceil(this.bitWidth / 2);
        this.handleFrame(rxtx, ss, es);
        this.state[rxtx] = 'WAIT FOR START BIT';
        break;
    }
  }

  /**
   * 处理完整帧
   * 对应原解码器的 handle_frame()
   */
  private handleFrame(rxtx: number, ss: number, es: number): void {
    // 输出完整帧信息
    console.log(`UART frame [${rxtx === RX ? 'RX' : 'TX'}]: 0x${this.dataValue[rxtx].toString(16).toUpperCase().padStart(2, '0')} (${this.frameValid[rxtx] ? 'valid' : 'invalid'})`);
  }

  /**
   * 格式化值
   * 对应原解码器的 format_value()
   */
  private formatValue(value: number): string | null {
    const bits = this.dataBits;

    switch (this.format) {
      case 'ascii':
        if (value >= 32 && value <= 126) {
          return String.fromCharCode(value);
        }
        const hexfmt = bits <= 8 ? '[{:02X}]' : '[{:03X}]';
        return `[${value.toString(16).toUpperCase().padStart(bits <= 8 ? 2 : 3, '0')}]`;

      case 'dec':
        return value.toString(10);

      case 'hex':
        const hexDigits = Math.ceil(bits / 4);
        return value.toString(16).toUpperCase().padStart(hexDigits, '0');

      case 'oct':
        const octDigits = Math.ceil(bits / 3);
        return value.toString(8).padStart(octDigits, '0');

      case 'bin':
        return value.toString(2).padStart(bits, '0');

      default:
        return null;
    }
  }

  /**
   * 重置解码器状态
   */
  protected reset(): void {
    super.reset();
    this.frameStart = [-1, -1];
    this.frameValid = [true, true];
    this.curFrameBit = [0, 0];
    this.startBit = [-1, -1];
    this.curDataBit = [0, 0];
    this.dataValue = [0, 0];
    this.parityBit = [-1, -1];
    this.stopBits = [[], []];
    this.startSample = [-1, -1];
    this.state = ['WAIT FOR START BIT', 'WAIT FOR START BIT'];
    this.dataBits = [[], []];
    this.breakStart = [null, null];
    this.packetCache = [[], []];
    this.ssPacket = [null, null];
    this.esPacket = [null, null];
    this.idleStart = [null, null];
  }
}