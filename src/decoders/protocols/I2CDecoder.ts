/**
 * I2C协议解码器
 * 基于 @logicanalyzer/Software 的 i2c/pd.py 精确移植
 * 实现完整的I2C协议解码功能
 */

import { DecoderBase } from '../DecoderBase';
import {
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderResult,
  DecoderOutputType,
  ChannelData,
  WaitConditions
} from '../types';

/**
 * I2C解码器状态
 * 对应原Python解码器的状态管理
 */
enum I2CDecoderState {
  IDLE = 'IDLE',
  START = 'START',
  ADDRESS = 'ADDRESS',
  DATA = 'DATA',
  ACK = 'ACK'
}

/**
 * 数据位信息
 * 对应原解码器的 data_bits 数组
 */
interface DataBit {
  value: number;
  startSample: number;
  endSample: number;
}

/**
 * I2C协议解码器实现
 * 对应原软件的 i2c Decoder 类
 */
export class I2CDecoder extends DecoderBase {
  // 解码器元数据 - 完全匹配原Python解码器
  readonly id = 'i2c';
  readonly name = 'I²C';
  readonly longname = 'Inter-Integrated Circuit';
  readonly desc = 'Two-wire, multi-master, serial bus.';
  readonly license = 'gplv2+';
  readonly inputs = ['logic'];
  readonly outputs = ['i2c'];
  readonly tags = ['Embedded/industrial'];

  // 通道定义 - 匹配原解码器
  readonly channels: DecoderChannel[] = [
    { id: 'scl', name: 'SCL', desc: 'Serial clock line', required: true, index: 0 },
    { id: 'sda', name: 'SDA', desc: 'Serial data line', required: true, index: 1 }
  ];

  // 配置选项 - 匹配原解码器
  readonly options: DecoderOption[] = [
    {
      id: 'address_format',
      desc: 'Displayed slave address format',
      default: 'shifted',
      values: ['shifted', 'unshifted'],
      type: 'list'
    }
  ];

  // 注释类型定义 - 匹配原解码器的annotations
  readonly annotations: Array<[string, string, string?]> = [
    ['start', 'Start condition', 'S'],
    ['repeat-start', 'Repeat start condition', 'Sr'],
    ['stop', 'Stop condition', 'P'],
    ['ack', 'ACK', 'A'],
    ['nack', 'NACK', 'N'],
    ['bit', 'Data/address bit'],
    ['address-read', 'Address read'],
    ['address-write', 'Address write'],
    ['data-read', 'Data read'],
    ['data-write', 'Data write'],
    ['warning', 'Warning']
  ];

  // 注释行定义 - 匹配原解码器的annotation_rows
  readonly annotationRows: Array<[string, string, number[]]> = [
    ['bits', 'Bits', [5]],
    ['addr-data', 'Address/data', [0, 1, 2, 3, 4, 6, 7, 8, 9]],
    ['warnings', 'Warnings', [10]]
  ];

  // 解码器状态变量
  private state: I2CDecoderState = I2CDecoderState.IDLE;
  private isWrite: boolean | null = null;
  private remAddrBytes: number | null = null;
  private slaveAddr7: number | null = null;
  private slaveAddr10: number | null = null;
  private isRepeatStart = false;
  private pduStart: number | null = null;
  private pduBits = 0;
  private dataBits: DataBit[] = [];
  private bitWidth = 0;
  private addressFormat = 'shifted';

  /**
   * 主解码方法
   * 对应原解码器的 decode() 方法
   */
  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    // 验证通道数据
    if (channels.length < 2) {
      throw new Error('I2C decoder requires both SCL and SDA channels');
    }

    const sclChannel = channels.find(ch => ch.channelName?.toLowerCase().includes('scl') || ch.channelNumber === 0);
    const sdaChannel = channels.find(ch => ch.channelName?.toLowerCase().includes('sda') || ch.channelNumber === 1);

    if (!sclChannel) {
      throw new Error('I2C decoder requires SCL channel');
    }
    if (!sdaChannel) {
      throw new Error('I2C decoder requires SDA channel');
    }

    // 初始化
    this.sampleRate = sampleRate;
    this.prepareChannelData(channels, [
      { captureIndex: 0, decoderIndex: 0 }, // SCL
      { captureIndex: 1, decoderIndex: 1 } // SDA
    ]);

    // 处理选项
    this.processOptions(options);

    // 开始解码
    this.start();
    this.reset();

    // 主解码循环 - 精确对应原解码器的状态机实现
    while (this.hasMoreSamples()) {
      try {
        // 状态机 - 完全基于原版 decode() 方法 (lines 317-364)
        if (this.wantsStart()) {
          // 等待START条件: SCL=高, SDA=下降沿 (line 332)
          const pins = this.wait({ 0: 'high', 1: 'falling' });
          const ss = pins.sampleNumber;
          const es = pins.sampleNumber;
          this.handleStart(ss, es);
        } else if (this.collectsAddress() && this.collectsByte()) {
          // 等待数据位: SCL=上升沿 (line 337)
          const pins = this.wait({ 0: 'rising' });
          const sda = pins.pins[1];
          const ss = pins.sampleNumber;
          const es = pins.sampleNumber + this.bitWidth;
          this.handleAddressOrData(ss, es, sda);
        } else if (this.collectsByte()) {
          // 等待多种条件的组合 (lines 341-358)
          const conditions: WaitConditions = [
            { 0: 'rising' },              // 数据采样 - SCL上升沿
            { 0: 'high', 1: 'falling' },  // START条件 - SCL高，SDA下降沿
            { 0: 'high', 1: 'rising' }    // STOP条件 - SCL高，SDA上升沿
          ];

          const pins = this.wait(conditions);
          const matched = pins.matched!;

          // 检查哪个条件匹配了 (对应原版的 self.matched[0/1/2])
          if (matched[0]) {
            // SCL上升沿 - 数据采样 (lines 349-352)
            const sda = pins.pins[1];
            const ss = pins.sampleNumber;
            const es = pins.sampleNumber + this.bitWidth;
            this.handleAddressOrData(ss, es, sda);
          } else if (matched[1]) {
            // START条件 (lines 353-355)
            const ss = pins.sampleNumber;
            const es = pins.sampleNumber;
            this.handleStart(ss, es);
          } else if (matched[2]) {
            // STOP条件 (lines 356-358)
            const ss = pins.sampleNumber;
            const es = pins.sampleNumber;
            this.handleStop(ss, es);
          }
        } else {
          // 等待ACK/NACK位: SCL=上升沿 (lines 360-364)
          const pins = this.wait({ 0: 'rising' });
          const sda = pins.pins[1];
          const ss = pins.sampleNumber;
          const es = pins.sampleNumber + this.bitWidth;
          this.getAck(ss, es, sda);
        }
      } catch (error) {
        if ((error as Error).message === 'End of samples reached') {
          break;
        }
        throw error;
      }
    }

    return this.results;
  }

  /**
   * 处理配置选项
   */
  private processOptions(options: DecoderOptionValue[]): void {
    for (const option of options) {
      if (option.optionIndex === 0) {
        // address_format
        this.addressFormat = option.value as string;
      }
    }
  }

  /**
   * 检查是否需要START条件
   * 对应原解码器的 _wants_start()
   */
  private wantsStart(): boolean {
    return this.pduStart === null;
  }

  /**
   * 检查是否在收集地址
   * 对应原解码器的 _collects_address()
   */
  private collectsAddress(): boolean {
    return this.remAddrBytes === null || this.remAddrBytes !== 0;
  }

  /**
   * 检查是否在收集字节
   * 对应原解码器的 _collects_byte()
   */
  private collectsByte(): boolean {
    return this.dataBits.length < 8;
  }

  /**
   * 处理START条件
   * 对应原解码器的 handle_start()
   */
  private handleStart(ss: number, es: number): void {
    const _cmd = this.isRepeatStart ? 'START REPEAT' : 'START';
    const annotationType = this.isRepeatStart ? 1 : 0; // repeat-start : start

    if (!this.isRepeatStart) {
      this.pduStart = ss;
      this.pduBits = 0;
    }

    // 输出注释
    this.put(ss, es, {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values: this.isRepeatStart ? ['Start repeat', 'Sr'] : ['Start', 'S']
    });

    // 重置状态
    this.isRepeatStart = true;
    this.isWrite = null;
    this.slaveAddr7 = null;
    this.slaveAddr10 = null;
    this.remAddrBytes = null;
    this.dataBits = [];
    this.bitWidth = 0;
  }

  /**
   * 处理地址或数据
   * 对应原解码器的 handle_address_or_data()
   */
  private handleAddressOrData(ss: number, es: number, value: number): void {
    this.pduBits++;

    // 累积位数据
    if (this.dataBits.length > 0) {
      this.dataBits[this.dataBits.length - 1].endSample = ss;
    }
    this.dataBits.push({ value, startSample: ss, endSample: es });

    if (this.dataBits.length < 8) {
      return;
    }

    // 计算位宽 - 基于原版实现 (lines 198-199)
    if (this.dataBits.length >= 3) {
      this.bitWidth = this.dataBits[this.dataBits.length - 2].endSample -
                     this.dataBits[this.dataBits.length - 3].endSample;
      this.dataBits[this.dataBits.length - 1].endSample =
        this.dataBits[this.dataBits.length - 1].startSample + this.bitWidth;
    }

    // 获取字节值 (MSB first)
    let byteValue = 0;
    for (let i = 0; i < 8; i++) {
      byteValue = (byteValue << 1) | this.dataBits[i].value;
    }


    const ssByte = this.dataBits[0].startSample;
    const esByte = this.dataBits[7].endSample;

    // 处理地址字节
    const isAddress = this.collectsAddress();
    if (isAddress) {
      this.processAddressByte(byteValue, ssByte, esByte);
    } else {
      this.processDataByte(byteValue, ssByte, esByte);
    }
  }

  /**
   * 处理地址字节
   */
  private processAddressByte(addrByte: number, ssByte: number, esByte: number): void {
    if (this.remAddrBytes === null) {
      if ((addrByte & 0xf8) === 0xf0) {
        // 10位地址
        this.remAddrBytes = 2;
        this.slaveAddr7 = null;
        this.slaveAddr10 = (addrByte & 0x06) << 7;
      } else {
        // 7位地址
        this.remAddrBytes = 1;
        this.slaveAddr7 = addrByte >> 1;
        this.slaveAddr10 = null;
      }
    }

    const hasRwBit = this.isWrite === null;
    if (this.isWrite === null) {
      const readBit = !!(addrByte & 1);
      this.isWrite = !readBit;
    } else if (this.slaveAddr10 !== null) {
      this.slaveAddr10 |= addrByte;
    }

    // 确定注释类型
    const _cmd = this.isWrite ? 'ADDRESS WRITE' : 'ADDRESS READ';
    const annotationType = this.isWrite ? 7 : 6; // address-write : address-read

    // 输出注释 - 基于原版实现确定显示值
    let addressValue: number;
    if (this.slaveAddr10 !== null) {
      // 10位地址情况
      addressValue = this.slaveAddr10;
    } else if (this.slaveAddr7 !== null) {
      // 7位地址情况
      if (this.addressFormat === 'shifted') {
        // shifted 格式：显示7位地址（不包含R/W位）
        addressValue = this.slaveAddr7;
      } else {
        // unshifted 格式：显示8位地址（包含R/W位）
        addressValue = addrByte;
      }
    } else {
      // fallback: 使用原始地址字节
      addressValue = addrByte;
    }


    this.put(ssByte, esByte, {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values: [
        `Address ${this.isWrite ? 'write' : 'read'}: ${addressValue
          .toString(16)
          .toUpperCase()
          .padStart(2, '0')}`,
        `A${this.isWrite ? 'W' : 'R'}: ${addressValue.toString(16).toUpperCase().padStart(2, '0')}`,
        addressValue.toString(16).toUpperCase().padStart(2, '0')
      ],
      rawData: addressValue
    });
  }

  /**
   * 处理数据字节
   */
  private processDataByte(dataByte: number, ssByte: number, esByte: number): void {
    const _cmd = this.isWrite ? 'DATA WRITE' : 'DATA READ';
    const annotationType = this.isWrite ? 9 : 8; // data-write : data-read

    this.put(ssByte, esByte, {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values: [
        `Data ${this.isWrite ? 'write' : 'read'}: ${dataByte
          .toString(16)
          .toUpperCase()
          .padStart(2, '0')}`,
        `D${this.isWrite ? 'W' : 'R'}: ${dataByte.toString(16).toUpperCase().padStart(2, '0')}`,
        dataByte.toString(16).toUpperCase().padStart(2, '0')
      ],
      rawData: dataByte
    });
  }

  /**
   * 处理ACK/NACK
   * 对应原解码器的 get_ack()
   */
  private getAck(ss: number, es: number, value: number): void {
    const _cmd = value === 0 ? 'ACK' : 'NACK';
    const annotationType = value === 0 ? 3 : 4; // ack : nack

    this.put(ss, es, {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values: value === 0 ? ['ACK', 'A'] : ['NACK', 'N']
    });

    // 更新地址字节计数
    if (this.remAddrBytes && this.remAddrBytes > 0) {
      this.remAddrBytes--;
    }

    this.dataBits = [];
  }

  /**
   * 处理STOP条件
   * 对应原解码器的 handle_stop()
   */
  private handleStop(ss: number, es: number): void {
    // 计算比特率元数据
    if (this.sampleRate && this.pduStart !== null) {
      const elapsed = (es - this.pduStart + 1) / this.sampleRate;
      const bitrate = Math.floor(this.pduBits / elapsed);
      console.log(`I2C bitrate: ${bitrate} bps`);
    }

    this.put(ss, es, {
      type: DecoderOutputType.ANNOTATION,
      annotationType: 2, // stop
      values: ['Stop', 'P']
    });

    // 重置状态
    this.isRepeatStart = false;
    this.isWrite = null;
    this.dataBits = [];
    this.pduStart = null;
    this.pduBits = 0;
  }


  /**
   * 重置解码器状态
   */
  protected reset(): void {
    super.reset();
    this.state = I2CDecoderState.IDLE;
    this.isWrite = null;
    this.remAddrBytes = null;
    this.slaveAddr7 = null;
    this.slaveAddr10 = null;
    this.isRepeatStart = false;
    this.pduStart = null;
    this.pduBits = 0;
    this.dataBits = [];
    this.bitWidth = 0;
  }
}
