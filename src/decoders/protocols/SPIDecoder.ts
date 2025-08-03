/**
 * SPI协议解码器
 * 基于 @logicanalyzer/Software 的 spi/pd.py 精确移植
 * 实现完整的SPI协议解码功能
 */

import { DecoderBase } from '../DecoderBase';
import {
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderResult,
  DecoderOutputType,
  ChannelData
} from '../types';

/**
 * SPI模式定义
 * 基于CPOL和CPHA组合
 */
const _SPI_MODES = {
  '0,0': 0, // Mode 0: CPOL=0, CPHA=0
  '0,1': 1, // Mode 1: CPOL=0, CPHA=1
  '1,0': 2, // Mode 2: CPOL=1, CPHA=0
  '1,1': 3  // Mode 3: CPOL=1, CPHA=1
} as const;

/**
 * 数据传输信息
 * 对应原解码器的 Data namedtuple
 */
interface SPIDataTransfer {
  startSample: number;
  endSample: number;
  value: number;
}

/**
 * 位信息结构
 * 对应原解码器的位数组
 */
interface SPIBitInfo {
  value: number;
  startSample: number;
  endSample: number;
}

/**
 * SPI协议解码器实现
 * 对应原软件的 spi Decoder 类
 */
export class SPIDecoder extends DecoderBase {
  // 解码器元数据 - 完全匹配原Python解码器
  readonly id = 'spi';
  readonly name = 'SPI';
  readonly longname = 'Serial Peripheral Interface';
  readonly desc = 'Full-duplex, synchronous, serial bus.';
  readonly license = 'gplv2+';
  readonly inputs = ['logic'];
  readonly outputs = ['spi'];
  readonly tags = ['Embedded/industrial'];

  // 通道定义 - 匹配原解码器
  readonly channels: DecoderChannel[] = [
    { id: 'clk', name: 'CLK', desc: 'Clock', required: true, index: 0 },
    { id: 'miso', name: 'MISO', desc: 'Master in, slave out', required: false, index: 1 },
    { id: 'mosi', name: 'MOSI', desc: 'Master out, slave in', required: false, index: 2 },
    { id: 'cs', name: 'CS#', desc: 'Chip-select', required: false, index: 3 }
  ];

  // 配置选项 - 匹配原解码器
  readonly options: DecoderOption[] = [
    {
      id: 'cs_polarity',
      desc: 'CS# polarity',
      default: 'active-low',
      values: ['active-low', 'active-high'],
      type: 'list'
    },
    {
      id: 'cpol',
      desc: 'Clock polarity',
      default: 0,
      values: ['0', '1'],
      type: 'list'
    },
    {
      id: 'cpha',
      desc: 'Clock phase',
      default: 0,
      values: ['0', '1'],
      type: 'list'
    },
    {
      id: 'bitorder',
      desc: 'Bit order',
      default: 'msb-first',
      values: ['msb-first', 'lsb-first'],
      type: 'list'
    },
    {
      id: 'wordsize',
      desc: 'Word size',
      default: 8,
      type: 'int'
    }
  ];

  // 注释类型定义 - 匹配原解码器的annotations
  readonly annotations: Array<[string, string, string?]> = [
    ['miso-data', 'MISO data'],
    ['mosi-data', 'MOSI data'],
    ['miso-bit', 'MISO bit'],
    ['mosi-bit', 'MOSI bit'],
    ['warning', 'Warning'],
    ['miso-transfer', 'MISO transfer'],
    ['mosi-transfer', 'MOSI transfer']
  ];

  // 注释行定义 - 匹配原解码器的annotation_rows
  readonly annotationRows: Array<[string, string, number[]]> = [
    ['miso-bits', 'MISO bits', [2]],
    ['miso-data-vals', 'MISO data', [0]],
    ['miso-transfers', 'MISO transfers', [5]],
    ['mosi-bits', 'MOSI bits', [3]],
    ['mosi-data-vals', 'MOSI data', [1]],
    ['mosi-transfers', 'MOSI transfers', [6]],
    ['other', 'Other', [4]]
  ];

  // 解码器状态变量
  private bitCount = 0;
  private misoData = 0;
  private mosiData = 0;

  private misoBits: SPIBitInfo[] = [];
  private mosiBits: SPIBitInfo[] = [];
  private misoBytes: SPIDataTransfer[] = [];
  private mosiBytes: SPIDataTransfer[] = [];

  private ssBlock = -1;
  private ssTransfer = -1;
  private csWasDeasserted = false;
  private lastCS = -1; // 跟踪上一次CS值

  // 通道可用性标志
  private haveMiso = false;
  private haveMosi = false;
  private haveCS = false;

  // 选项值
  private csPolarity = 'active-low';
  private cpol = 0;
  private cpha = 0;
  private bitOrder = 'msb-first';
  private wordSize = 8;
  private byteWidth = 1; // (wordSize + 7) // 8

  /**
   * 主解码方法
   * 对应原解码器的 decode() 方法
   */
  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    // 初始化
    this.sampleRate = sampleRate;

    // 检查CLK是否可用（必需）
    if (channels.length === 0 || !channels[0].samples || channels[0].samples.length === 0) {
      return []; // 没有数据时返回空结果，不抛出错误
    }

    // 检查通道可用性（对应原版 lines 322-326）
    this.haveMiso = channels.length > 1 && channels[1].samples && channels[1].samples.length > 0;
    this.haveMosi = channels.length > 2 && channels[2].samples && channels[2].samples.length > 0;
    this.haveCS = channels.length > 3 && channels[3].samples && channels[3].samples.length > 0;

    // 验证至少有MISO或MOSI（对应原版 lines 324-325）
    if (!this.haveMiso && !this.haveMosi) {
      throw new Error('Either MISO or MOSI (or both) pins required.');
    }

    // 准备通道数据映射
    const channelMapping = [
      { captureIndex: 0, decoderIndex: 0 } // CLK - 必需
    ];

    if (this.haveMiso) {
      channelMapping.push({ captureIndex: 1, decoderIndex: 1 }); // MISO
    }
    if (this.haveMosi) {
      channelMapping.push({ captureIndex: 2, decoderIndex: 2 }); // MOSI
    }
    if (this.haveCS) {
      channelMapping.push({ captureIndex: 3, decoderIndex: 3 }); // CS
    }

    this.prepareChannelData(channels, channelMapping);

    // 处理选项
    this.processOptions(options);

    // 开始解码
    this.start();
    this.reset();

    // 如果没有CS信号，发送初始CS状态（对应原版 lines 327-328）
    if (!this.haveCS) {
      this.putCSChange(null, null);
    }

    // 构造等待条件（对应原版 lines 333-336）
    // 我们想要所有CLK变化，如果使用CS的话还要所有CS变化
    const waitConditions = [
      { 0: 'edge' } // 时钟的所有边沿
    ];

    let csConditionIndex = -1;
    if (this.haveCS) {
      csConditionIndex = waitConditions.length;
      waitConditions.push({ 3: 'edge' }); // CS的所有边沿
    }

    // "像素兼容性"获取第一个样本（对应原版 lines 338-343）
    if (this.hasMoreSamples()) {
      const pins = this.getCurrentPins();
      const clk = pins[0] || 0;
      const miso = pins[1] || 0;
      const mosi = pins[2] || 0;
      const cs = pins[3] || 0;

      this.findClockEdge(miso, mosi, clk, cs, true, null);
    }

    // 主解码循环（对应原版 lines 345-347）
    while (this.hasMoreSamples()) {
      try {
        const waitResult = this.wait(waitConditions);
        const matched = waitResult.matched!;

        const clk = waitResult.pins[0] || 0;
        const miso = waitResult.pins[1] || 0;
        const mosi = waitResult.pins[2] || 0;
        const cs = waitResult.pins[3] || 0;

        this.findClockEdge(miso, mosi, clk, cs, false, matched);
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
      switch (option.optionIndex) {
        case 0: // cs_polarity
          this.csPolarity = option.value as string;
          break;
        case 1: // cpol
          this.cpol = parseInt(option.value as string);
          break;
        case 2: // cpha
          this.cpha = parseInt(option.value as string);
          break;
        case 3: // bitorder
          this.bitOrder = option.value as string;
          break;
        case 4: // wordsize
          this.wordSize = option.value as number;
          this.byteWidth = Math.floor((this.wordSize + 7) / 8);
          break;
      }
    }
  }

  /**
   * 检查CS是否被断言
   * 对应原解码器的 cs_asserted()
   */
  private csAsserted(cs: number): boolean {
    const activeLow = this.csPolarity === 'active-low';
    return activeLow ? (cs === 0) : (cs === 1);
  }

  /**
   * 处理单个位
   * 对应原解码器的 handle_bit()
   */
  private handleBit(miso: number, mosi: number, clk: number, cs: number): void {
    // 如果是数据字的第一位，保存其样本编号
    if (this.bitCount === 0) {
      this.ssBlock = this.sampleIndex;
      this.csWasDeasserted = this.haveCS ? !this.csAsserted(cs) : false;
    }

    // 接收MISO位到移位寄存器
    if (this.haveMiso) {
      if (this.bitOrder === 'msb-first') {
        this.misoData |= miso << (this.wordSize - 1 - this.bitCount);
      } else {
        this.misoData |= miso << this.bitCount;
      }
    }

    // 接收MOSI位到移位寄存器
    if (this.haveMosi) {
      if (this.bitOrder === 'msb-first') {
        this.mosiData |= mosi << (this.wordSize - 1 - this.bitCount);
      } else {
        this.mosiData |= mosi << this.bitCount;
      }
    }

    // 估算此位的结束样本
    let es = this.sampleIndex;
    if (this.bitCount > 0) {
      if (this.haveMiso && this.misoBits.length > 0) {
        es += this.sampleIndex - this.misoBits[0].startSample;
      } else if (this.haveMosi && this.mosiBits.length > 0) {
        es += this.sampleIndex - this.mosiBits[0].startSample;
      }
    }

    // 保存位信息
    if (this.haveMiso) {
      this.misoBits.unshift({ value: miso, startSample: this.sampleIndex, endSample: es });
    }
    if (this.haveMosi) {
      this.mosiBits.unshift({ value: mosi, startSample: this.sampleIndex, endSample: es });
    }

    // 更新前一位的结束样本
    if (this.bitCount > 0) {
      if (this.haveMiso && this.misoBits.length > 1) {
        this.misoBits[1].endSample = this.sampleIndex;
      }
      if (this.haveMosi && this.mosiBits.length > 1) {
        this.mosiBits[1].endSample = this.sampleIndex;
      }
    }

    this.bitCount++;

    // 如果还没有收集到足够的位，继续接收
    if (this.bitCount !== this.wordSize) {
      return;
    }

    // 输出数据
    this.putData();

    // 计算比特率元数据
    if (this.sampleRate) {
      const elapsed = (this.sampleIndex - this.ssBlock + 1) / this.sampleRate;
      const _bitrate = Math.floor(this.wordSize / elapsed);
      // 可以在这里输出比特率信息或记录到日志
    }

    // 检查CS状态警告
    if (this.haveCS && this.csWasDeasserted) {
      this.put(this.ssBlock, this.sampleIndex, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 4, // warning
        values: ['CS# was deasserted during this data word!']
      });
    }

    // 重置解码器状态
    this.resetDecoderState();
  }

  /**
   * 输出数据
   * 对应原解码器的 putdata() (lines 159-196)
   */
  private putData(): void {
    // 传递MISO和MOSI位以及数据到堆栈上的下一个PD（对应原版 lines 160-164）
    const so = this.haveMiso ? this.misoData : null;
    const si = this.haveMosi ? this.mosiData : null;
    const soBits = this.haveMiso ? this.misoBits : null;
    const siBits = this.haveMosi ? this.mosiBits : null;

    // 计算时间范围（对应原版 lines 167-171）
    let ss: number, es: number;

    if (this.haveMiso && this.misoBits.length > 0) {
      ss = this.misoBits[this.misoBits.length - 1].startSample;
      es = this.misoBits[0].endSample;
    } else if (this.haveMosi && this.mosiBits.length > 0) {
      ss = this.mosiBits[this.mosiBits.length - 1].startSample;
      es = this.mosiBits[0].endSample;
    } else {
      return; // 没有数据
    }

    // 保存字节数据用于传输注释（对应原版 lines 178-181）
    if (this.haveMiso) {
      this.misoBytes.push({ startSample: ss, endSample: es, value: this.misoData });
    }
    if (this.haveMosi) {
      this.mosiBytes.push({ startSample: ss, endSample: es, value: this.mosiData });
    }

    // 位注释（对应原版 lines 183-189）
    if (this.haveMiso && this.misoBits.length > 0) {
      for (const bit of this.misoBits) {
        this.put(bit.startSample, bit.endSample, {
          type: DecoderOutputType.ANNOTATION,
          annotationType: 2, // miso-bit
          values: [bit.value.toString()]
        });
      }
    }

    if (this.haveMosi && this.mosiBits.length > 0) {
      for (const bit of this.mosiBits) {
        this.put(bit.startSample, bit.endSample, {
          type: DecoderOutputType.ANNOTATION,
          annotationType: 3, // mosi-bit
          values: [bit.value.toString()]
        });
      }
    }

    // 数据字注释（对应原版 lines 191-195）
    if (this.haveMiso) {
      this.put(ss, es, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0, // miso-data
        values: [this.misoData.toString(16).toUpperCase().padStart(2, '0')],
        rawData: this.misoData
      });
    }

    if (this.haveMosi) {
      this.put(ss, es, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 1, // mosi-data
        values: [this.mosiData.toString(16).toUpperCase().padStart(2, '0')],
        rawData: this.mosiData
      });
    }
  }

  /**
   * 重置解码器状态
   * 对应原解码器的 reset_decoder_state()
   */
  private resetDecoderState(): void {
    this.misoData = this.haveMiso ? 0 : 0;
    this.mosiData = this.haveMosi ? 0 : 0;
    this.misoBits = [];
    this.mosiBits = [];
    this.bitCount = 0;
  }

  /**
   * 查找时钟边沿
   * 对应原解码器的 find_clk_edge() (lines 270-314)
   */
  private findClockEdge(miso: number, mosi: number, clk: number, cs: number, first: boolean, matched: boolean[] | null): void {
    // 处理CS变化（对应原版 lines 271-292）
    if (this.haveCS && (first || (matched && matched.length > 1 && matched[1]))) {
      // 发送所有CS#引脚值变化（对应原版 lines 272-275）
      const oldCS = first ? null : (1 - cs); // 原版: oldcs = None if first else 1 - cs
      this.putCSChange(oldCS, cs);

      if (this.csAsserted(cs)) {
        // CS被断言，开始传输（对应原版 lines 277-280）
        this.ssTransfer = this.sampleIndex;
        this.misoBytes = [];
        this.mosiBytes = [];
      } else if (this.ssTransfer !== -1) {
        // CS被取消断言，结束传输（对应原版 lines 281-289）
        if (this.haveMiso && this.misoBytes.length > 0) {
          const misoTransfer = this.misoBytes.map(x =>
            x.value.toString(16).toUpperCase().padStart(2, '0')
          ).join(' ');
          this.put(this.ssTransfer, this.sampleIndex, {
            type: DecoderOutputType.ANNOTATION,
            annotationType: 5, // miso-transfer
            values: [misoTransfer]
          });
        }

        if (this.haveMosi && this.mosiBytes.length > 0) {
          const mosiTransfer = this.mosiBytes.map(x =>
            x.value.toString(16).toUpperCase().padStart(2, '0')
          ).join(' ');
          this.put(this.ssTransfer, this.sampleIndex, {
            type: DecoderOutputType.ANNOTATION,
            annotationType: 6, // mosi-transfer
            values: [mosiTransfer]
          });
        }

        // 输出Python OUTPUT（对应原版 line 288-289）
        // 这里可以添加 TRANSFER Python 输出，暂时注释
      }

      // 当CS#变化时重置解码器状态（对应原版 lines 291-292）
      this.resetDecoderState();
    }

    // 只关心CS#断言时的样本（对应原版 lines 294-296）
    if (this.haveCS && !this.csAsserted(cs)) {
      return;
    }

    // 忽略时钟引脚未变化的样本（对应原版 lines 298-300）
    if (first || !(matched && matched[0])) {
      return;
    }

    // 在上升/下降时钟边沿采样数据（取决于模式）（对应原版 lines 302-314）
    const mode = this.getSPIMode();

    // 根据SPI模式和当前时钟状态决定是否采样
    // 由于我们等待的是边沿，所以我们知道时钟状态已经改变
    // 我们根据当前状态和模式来决定是否在此边沿采样
    let shouldSample = false;
    switch (mode) {
      case 0: // CPOL=0, CPHA=0: 在上升沿采样 (clk从0变为1)
        shouldSample = clk === 1;
        break;
      case 1: // CPOL=0, CPHA=1: 在下降沿采样 (clk从1变为0)
        shouldSample = clk === 0;
        break;
      case 2: // CPOL=1, CPHA=0: 在下降沿采样 (clk从1变为0)
        shouldSample = clk === 0;
        break;
      case 3: // CPOL=1, CPHA=1: 在上升沿采样 (clk从0变为1)
        shouldSample = clk === 1;
        break;
    }

    if (!shouldSample) {
      return;
    }

    // 找到正确的时钟边沿，现在获取SPI位（对应原版 lines 313-314）
    this.handleBit(miso, mosi, clk, cs);
  }

  /**
   * 获取SPI模式
   * 对应原版的 spi_mode 字典 (lines 66-71)
   */
  private getSPIMode(): number {
    // Key: (CPOL, CPHA). Value: SPI mode.
    // Clock polarity (CPOL) = 0/1: Clock is low/high when inactive.
    // Clock phase (CPHA) = 0/1: Data is valid on the leading/trailing clock edge.
    const key = `${this.cpol},${this.cpha}` as keyof typeof _SPI_MODES;
    return _SPI_MODES[key] || 0;
  }

  /**
   * 输出CS变化
   * 对应原版的 put CS-CHANGE (lines 274-275)
   */
  private putCSChange(oldCS: number | null, newCS: number | null): void {
    // 发送CS-CHANGE Python输出（对应原版 lines 274-275）
    // 在TypeScript版本中，我们通过注释来输出CS变化信息
    // 这里可以添加具体的CS变化注释输出
  }

  /**
   * 重置解码器状态
   */
  protected reset(): void {
    super.reset();
    this.bitCount = 0;
    this.misoData = 0;
    this.mosiData = 0;
    this.misoBits = [];
    this.mosiBits = [];
    this.misoBytes = [];
    this.mosiBytes = [];
    this.ssBlock = -1;
    this.ssTransfer = -1;
    this.csWasDeasserted = false;
    this.lastCS = -1;
  }
}
