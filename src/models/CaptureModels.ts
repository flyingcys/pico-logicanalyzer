/**
 * 数据采集核心模型实现
 * 基于原版 C# SharedDriver 模块的精确移植
 * 严格遵循原版的数据结构和逻辑
 */

import {
  TriggerType,
  CaptureMode,
  CaptureError,
  CaptureLimits,
  AnalyzerDeviceInfo,
  TriggerDelays
} from './AnalyzerTypes';

/**
 * 采集会话类 - 基于C# CaptureSession的精确实现
 */
export class CaptureSession {
  // 基础采集参数
  public frequency: number = 1000000; // 采样频率 (Hz)
  public preTriggerSamples: number = 0; // 触发前样本数
  public postTriggerSamples: number = 1000; // 触发后样本数

  // 突发采集系统
  public loopCount: number = 0; // 突发采集次数 (0-255)
  public measureBursts: boolean = false; // 是否测量突发间隔

  // 通道配置
  public captureChannels: AnalyzerChannel[] = [];

  // 突发信息数组 (采集完成后填充)
  public bursts?: BurstInfo[];

  // 触发系统配置
  public triggerType: TriggerType = TriggerType.Edge;
  public triggerChannel: number = 0; // 触发通道 (0-23)
  public triggerInverted: boolean = false; // 触发极性反转
  public triggerBitCount: number = 1; // 触发位宽
  public triggerPattern: number = 0; // 复杂触发模式 (16位)

  /**
   * 总样本数计算 - 对应C#的只读属性
   */
  public get totalSamples(): number {
    return this.postTriggerSamples * (this.loopCount + 1) + this.preTriggerSamples;
  }

  /**
   * 深拷贝包含样本数据 - 对应C#的Clone()方法
   */
  public clone(): CaptureSession {
    const newInst = new CaptureSession();

    // 复制基础属性
    newInst.frequency = this.frequency;
    newInst.preTriggerSamples = this.preTriggerSamples;
    newInst.postTriggerSamples = this.postTriggerSamples;
    newInst.loopCount = this.loopCount;
    newInst.measureBursts = this.measureBursts;
    newInst.triggerType = this.triggerType;
    newInst.triggerChannel = this.triggerChannel;
    newInst.triggerInverted = this.triggerInverted;
    newInst.triggerBitCount = this.triggerBitCount;
    newInst.triggerPattern = this.triggerPattern;

    // 深拷贝通道数组
    newInst.captureChannels = this.captureChannels.map(ch => ch.clone());

    // 深拷贝突发信息
    if (this.bursts) {
      newInst.bursts = this.bursts.map(burst => {
        const newBurst = new BurstInfo();
        newBurst.burstSampleStart = burst.burstSampleStart;
        newBurst.burstSampleEnd = burst.burstSampleEnd;
        newBurst.burstSampleGap = burst.burstSampleGap;
        newBurst.burstTimeGap = burst.burstTimeGap;
        return newBurst;
      });
    }

    return newInst;
  }

  /**
   * 只拷贝设置，不含样本数据 - 对应C#的CloneSettings()方法
   */
  public cloneSettings(): CaptureSession {
    const newInst = new CaptureSession();

    // 复制基础属性
    newInst.frequency = this.frequency;
    newInst.preTriggerSamples = this.preTriggerSamples;
    newInst.postTriggerSamples = this.postTriggerSamples;
    newInst.loopCount = this.loopCount;
    newInst.measureBursts = this.measureBursts;
    newInst.triggerType = this.triggerType;
    newInst.triggerChannel = this.triggerChannel;
    newInst.triggerInverted = this.triggerInverted;
    newInst.triggerBitCount = this.triggerBitCount;
    newInst.triggerPattern = this.triggerPattern;

    // 复制通道设置，但清空样本数据
    newInst.captureChannels = this.captureChannels.map(ch => {
      const clonedChannel = ch.clone();
      clonedChannel.samples = undefined; // 清空样本数据
      return clonedChannel;
    });

    return newInst;
  }
}

/**
 * 分析器通道类 - 基于C# AnalyzerChannel的精确实现
 */
export class AnalyzerChannel {
  public channelNumber: number = 0;
  public channelName: string = '';
  public channelColor?: number; // uint? 对应TypeScript的number | undefined
  public hidden: boolean = false;
  public samples?: Uint8Array; // byte[] 对应TypeScript的Uint8Array

  constructor(channelNumber: number = 0, channelName: string = '') {
    this.channelNumber = channelNumber;
    this.channelName = channelName || this.textualChannelNumber;
  }

  /**
   * 文本化通道号 - 对应C#的TextualChannelNumber getter
   */
  public get textualChannelNumber(): string {
    return `Channel ${this.channelNumber + 1}`;
  }

  /**
   * ToString方法 - 对应C#的ToString()重写
   */
  public toString(): string {
    return this.channelName || this.textualChannelNumber;
  }

  /**
   * 克隆方法 - 对应C#的Clone()方法，包含深拷贝支持
   */
  public clone(): AnalyzerChannel {
    const newInst = new AnalyzerChannel();
    newInst.channelNumber = this.channelNumber;
    newInst.channelName = this.channelName;
    newInst.channelColor = this.channelColor;
    newInst.hidden = this.hidden;

    // 深拷贝样本数据
    if (this.samples) {
      newInst.samples = new Uint8Array(this.samples);
    }

    return newInst;
  }
}

/**
 * 突发信息类 - 基于C# BurstInfo的精确实现
 */
export class BurstInfo {
  public burstSampleStart: number = 0; // 突发开始样本位置
  public burstSampleEnd: number = 0; // 突发结束样本位置
  public burstSampleGap: number = 0; // 样本间隔数量 (ulong)
  public burstTimeGap: number = 0; // 时间间隔 (纳秒, ulong)

  /**
   * 时间格式化方法 - 对应C#的GetTime()方法
   */
  public getTime(): string {
    const nanoInMicro = 1000.0;
    const nanoInMilli = 1000000.0;
    const nanoInSecond = 1000000000.0;

    if (this.burstTimeGap < nanoInMicro) {
      return `${this.burstTimeGap} ns`;
    } else if (this.burstTimeGap < nanoInMilli) {
      const microseconds = this.burstTimeGap / nanoInMicro;
      return `${microseconds.toFixed(3)} µs`;
    } else if (this.burstTimeGap < nanoInSecond) {
      const milliseconds = this.burstTimeGap / nanoInMilli;
      return `${milliseconds.toFixed(3)} ms`;
    } else {
      const seconds = this.burstTimeGap / nanoInSecond;
      return `${seconds.toFixed(3)} s`;
    }
  }

  /**
   * ToString方法 - 对应C#的ToString()重写
   */
  public toString(): string {
    return `Burst: ${this.burstSampleStart} to ${this.burstSampleEnd}\nGap: ${this.getTime()} (${this.burstSampleGap} samples)`;
  }
}

/**
 * 采集限制类 - 基于C# CaptureLimits的实现，添加了计算属性
 */
export class CaptureLimitsImpl implements CaptureLimits {
  public minPreSamples: number = 2;
  public maxPreSamples: number = 1000;
  public minPostSamples: number = 2;
  public maxPostSamples: number = 10000;

  /**
   * 最大总样本数 - 对应C#的MaxTotalSamples getter
   * 应该是maxPreSamples + maxPostSamples
   */
  public get maxTotalSamples(): number {
    return this.maxPreSamples + this.maxPostSamples;
  }
}

/**
 * 输出数据包类 - 基于C# OutputPacket的精确实现
 * 🚀 关键的通信协议实现，包含转义机制
 */
export class OutputPacket {
  private dataBuffer: number[] = [];

  /**
   * 添加单个字节
   */
  public addByte(newByte: number): void {
    this.dataBuffer.push(newByte & 0xFF);
  }

  /**
   * 添加字节数组
   */
  public addBytes(newBytes: Uint8Array | number[]): void {
    if (newBytes instanceof Uint8Array) {
      for (let i = 0; i < newBytes.length; i++) {
        this.dataBuffer.push(newBytes[i]);
      }
    } else {
      this.dataBuffer.push(...newBytes.map(b => b & 0xFF));
    }
  }

  /**
   * 添加ASCII字符串
   */
  public addString(newString: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(newString);
    this.addBytes(bytes);
  }

  /**
   * 添加结构体 - TypeScript版本使用ArrayBuffer
   */
  public addStruct(structData: ArrayBuffer | Uint8Array): void {
    if (structData instanceof ArrayBuffer) {
      this.addBytes(new Uint8Array(structData));
    } else {
      this.addBytes(structData);
    }
  }

  /**
   * 清空缓冲区
   */
  public clear(): void {
    this.dataBuffer = [];
  }

  /**
   * 序列化数据包 - 对应C#的关键协议实现
   * 协议格式: 0x55 0xAA [转义后的数据] 0xAA 0x55
   * 转义规则: 0xAA/0x55/0xF0 -> 0xF0 + (原值 ^ 0xF0)
   */
  public serialize(): Uint8Array {
    const finalData: number[] = [];

    // 添加起始标记
    finalData.push(0x55);
    finalData.push(0xAA);

    // 对数据进行转义处理
    for (const byte of this.dataBuffer) {
      if (byte === 0xAA || byte === 0x55 || byte === 0xF0) {
        finalData.push(0xF0);
        finalData.push(byte ^ 0xF0);
      } else {
        finalData.push(byte);
      }
    }

    // 添加结束标记
    finalData.push(0xAA);
    finalData.push(0x55);

    return new Uint8Array(finalData);
  }
}

/**
 * 采集请求结构 - 基于C# CaptureRequest的精确内存布局
 */
export interface CaptureRequestStruct {
  triggerType: number; // byte
  trigger: number; // byte
  invertedOrCount: number; // byte
  triggerValue: number; // ushort (16位)
  channels: Uint8Array; // byte[24]
  channelCount: number; // byte
  frequency: number; // uint32 (32位)
  preSamples: number; // uint32 (32位)
  postSamples: number; // uint32 (32位)
  loopCount: number; // byte
  measure: number; // byte (0/1)
  captureMode: number; // byte
}

/**
 * 网络配置结构 - 基于C# NetConfig的固定大小缓冲区
 */
export interface NetConfigStruct {
  accessPointName: string; // 33字节固定长度
  password: string; // 64字节固定长度
  ipAddress: string; // 16字节固定长度
  port: number; // ushort (16位)
}

/**
 * 采集请求构建器 - 用于构建符合C#结构体布局的二进制数据
 */
export class CaptureRequestBuilder {
  /**
   * 构建采集请求的二进制数据
   */
  public static buildCaptureRequest(session: CaptureSession): Uint8Array {
    const buffer = new ArrayBuffer(64); // 预分配足够的空间
    const view = new DataView(buffer);
    let offset = 0;

    // 按照C#结构体的精确布局写入数据
    view.setUint8(offset++, session.triggerType); // triggerType: byte
    view.setUint8(offset++, session.triggerChannel); // trigger: byte
    view.setUint8(offset++, session.triggerInverted ? 1 : 0); // invertedOrCount: byte
    view.setUint16(offset, session.triggerPattern, true); // triggerValue: ushort, little endian
    offset += 2;

    // channels: byte[24] - 通道配置数组
    const channelArray = new Uint8Array(24);
    session.captureChannels.forEach(ch => {
      if (ch.channelNumber >= 0 && ch.channelNumber < 24) {
        channelArray[ch.channelNumber] = 1;
      }
    });
    for (let i = 0; i < 24; i++) {
      view.setUint8(offset++, channelArray[i]);
    }

    view.setUint8(offset++, session.captureChannels.length); // channelCount: byte
    view.setUint32(offset, session.frequency, true); // frequency: uint32, little endian
    offset += 4;
    view.setUint32(offset, session.preTriggerSamples, true); // preSamples: uint32, little endian
    offset += 4;
    view.setUint32(offset, session.postTriggerSamples, true); // postSamples: uint32, little endian
    offset += 4;
    view.setUint8(offset++, session.loopCount); // loopCount: byte
    view.setUint8(offset++, session.measureBursts ? 1 : 0); // measure: byte

    // 计算采集模式
    const maxChannel = Math.max(...session.captureChannels.map(ch => ch.channelNumber));
    const captureMode = maxChannel < 8 ? CaptureMode.Channels_8 :
                       (maxChannel < 16 ? CaptureMode.Channels_16 : CaptureMode.Channels_24);
    view.setUint8(offset++, captureMode); // captureMode: byte

    return new Uint8Array(buffer, 0, offset);
  }

  /**
   * 构建网络配置的二进制数据
   */
  public static buildNetConfig(config: NetConfigStruct): Uint8Array {
    const buffer = new ArrayBuffer(115); // 33 + 64 + 16 + 2 = 115字节
    const view = new DataView(buffer);
    let offset = 0;

    // AccessPointName: 33字节固定长度
    const apNameBytes = new TextEncoder().encode(config.accessPointName.slice(0, 32));
    for (let i = 0; i < 33; i++) {
      view.setUint8(offset++, i < apNameBytes.length ? apNameBytes[i] : 0);
    }

    // Password: 64字节固定长度
    const passwordBytes = new TextEncoder().encode(config.password.slice(0, 63));
    for (let i = 0; i < 64; i++) {
      view.setUint8(offset++, i < passwordBytes.length ? passwordBytes[i] : 0);
    }

    // IPAddress: 16字节固定长度
    const ipBytes = new TextEncoder().encode(config.ipAddress.slice(0, 15));
    for (let i = 0; i < 16; i++) {
      view.setUint8(offset++, i < ipBytes.length ? ipBytes[i] : 0);
    }

    // Port: ushort (16位)
    view.setUint16(offset, config.port, true); // little endian

    return new Uint8Array(buffer);
  }
}

/**
 * 数据采集事件参数
 */
export class CaptureEventArgs {
  public success: boolean = false;
  public session: CaptureSession;

  constructor(success: boolean, session: CaptureSession) {
    this.success = success;
    this.session = session;
  }
}

/**
 * 采集完成处理器类型
 */
export type CaptureCompletedHandler = (args: CaptureEventArgs) => void;
