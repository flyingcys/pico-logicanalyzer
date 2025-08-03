/**
 * 逻辑分析器硬件抽象层类型定义
 * 基于原始C# SharedDriver模块精确实现
 */

import { EventEmitter } from 'events';

// 基础枚举类型 - 精确对应C#版本
export enum AnalyzerDriverType {
  Serial = 'Serial',
  Network = 'Network',
  Multi = 'Multi',
  Emulated = 'Emulated'
}

export enum CaptureMode {
  Channels_8 = 0,
  Channels_16 = 1,
  Channels_24 = 2
}

export enum TriggerType {
  Edge = 'Edge',
  Complex = 'Complex',
  Fast = 'Fast',
  Blast = 'Blast'
}

export enum CaptureError {
  None = 'None',
  Busy = 'Busy',
  BadParams = 'BadParams',
  HardwareError = 'HardwareError',
  UnexpectedError = 'UnexpectedError'
}

// 触发延迟常量 - 对应C#中的TriggerDelays
export const TriggerDelays = {
  ComplexTriggerDelay: 5, // 纳秒
  FastTriggerDelay: 3 // 纳秒
} as const;

// 核心数据结构

/**
 * 采集限制 - 对应C# CaptureLimits类
 */
export interface CaptureLimits {
  minPreSamples: number; // 最小触发前样本数
  maxPreSamples: number; // 最大触发前样本数
  minPostSamples: number; // 最小触发后样本数
  maxPostSamples: number; // 最大触发后样本数
}

/**
 * 计算属性：最大总样本数
 */
export function getMaxTotalSamples(limits: CaptureLimits): number {
  return limits.minPreSamples + limits.maxPostSamples;
}

/**
 * 分析器通道 - 精确对应C# AnalyzerChannel类
 */
export class AnalyzerChannel {
  public channelNumber: number = 0;
  public channelName: string = '';
  public channelColor?: number; // uint? 对应 - 可选颜色值
  public hidden: boolean = false;
  public samples?: Uint8Array; // byte[] 对应

  /**
   * 计算属性：文本通道编号
   */
  get textualChannelNumber(): string {
    return `Channel ${this.channelNumber + 1}`;
  }

  /**
   * toString 方法 - 对应C#版本
   */
  toString(): string {
    return this.channelName || this.textualChannelNumber;
  }

  /**
   * 克隆方法 - 深拷贝包含样本数据
   */
  clone(): AnalyzerChannel {
    const newChannel = new AnalyzerChannel();
    newChannel.channelNumber = this.channelNumber;
    newChannel.channelName = this.channelName;
    newChannel.channelColor = this.channelColor;
    newChannel.hidden = this.hidden;

    // 深拷贝样本数据
    if (this.samples) {
      newChannel.samples = new Uint8Array(this.samples);
    }

    return newChannel;
  }
}

/**
 * 突发信息 - 精确对应C# BurstInfo类
 */
export class BurstInfo {
  public burstSampleStart: number = 0;
  public burstSampleEnd: number = 0;
  public burstSampleGap: bigint = 0n; // ulong 对应
  public burstTimeGap: bigint = 0n; // ulong 对应

  /**
   * 格式化时间显示 - 对应C# GetTime()方法
   */
  getTime(): string {
    const nanoInMicro = 1000n;
    const nanoInMilli = 1000000n;
    const nanoInSecond = 1000000000n;

    if (this.burstTimeGap < nanoInMicro) {
      return `${this.burstTimeGap} ns`;
    } else if (this.burstTimeGap < nanoInMilli) {
      const microseconds = Number(this.burstTimeGap) / 1000;
      return `${microseconds.toFixed(3)} µs`;
    } else if (this.burstTimeGap < nanoInSecond) {
      const milliseconds = Number(this.burstTimeGap) / 1000000;
      return `${milliseconds.toFixed(3)} ms`;
    } else {
      const seconds = Number(this.burstTimeGap) / 1000000000;
      return `${seconds.toFixed(3)} s`;
    }
  }

  /**
   * toString方法 - 对应C#版本
   */
  toString(): string {
    return `Burst: ${this.burstSampleStart} to ${this.burstSampleEnd}\nGap: ${this.getTime()} (${
      this.burstSampleGap
    } samples)`;
  }
}

/**
 * 采集会话 - 精确对应C# CaptureSession类
 */
export class CaptureSession {
  public frequency: number = 0; // 采样频率
  public preTriggerSamples: number = 0; // 触发前样本数
  public postTriggerSamples: number = 0; // 触发后样本数
  public loopCount: number = 0; // 突发采集次数 (0-255)
  public measureBursts: boolean = false; // 是否测量突发间隔
  public captureChannels: AnalyzerChannel[] = []; // 激活通道列表
  public bursts?: BurstInfo[]; // 突发信息数组 (采集完成后填充)

  // 触发系统配置
  public triggerType: TriggerType = TriggerType.Edge; // 触发类型
  public triggerChannel: number = 0; // 触发通道 (0-23)
  public triggerInverted: boolean = false; // 触发极性反转
  public triggerBitCount: number = 0; // 触发位宽
  public triggerPattern: number = 0; // 复杂触发模式 (16位)

  /**
   * 计算属性：总样本数 - 对应C# TotalSamples
   */
  get totalSamples(): number {
    return this.postTriggerSamples * (this.loopCount + 1) + this.preTriggerSamples;
  }

  /**
   * 克隆方法 - 深拷贝包含样本数据
   */
  clone(): CaptureSession {
    const newSession = new CaptureSession();

    // 基础属性
    newSession.frequency = this.frequency;
    newSession.preTriggerSamples = this.preTriggerSamples;
    newSession.postTriggerSamples = this.postTriggerSamples;
    newSession.loopCount = this.loopCount;
    newSession.measureBursts = this.measureBursts;

    // 触发配置
    newSession.triggerType = this.triggerType;
    newSession.triggerChannel = this.triggerChannel;
    newSession.triggerInverted = this.triggerInverted;
    newSession.triggerBitCount = this.triggerBitCount;
    newSession.triggerPattern = this.triggerPattern;

    // 深拷贝通道数组
    newSession.captureChannels = this.captureChannels.map(ch => ch.clone());

    // 深拷贝突发信息
    if (this.bursts) {
      newSession.bursts = this.bursts.map(burst => {
        const newBurst = new BurstInfo();
        newBurst.burstSampleStart = burst.burstSampleStart;
        newBurst.burstSampleEnd = burst.burstSampleEnd;
        newBurst.burstSampleGap = burst.burstSampleGap;
        newBurst.burstTimeGap = burst.burstTimeGap;
        return newBurst;
      });
    }

    return newSession;
  }

  /**
   * 克隆设置 - 只拷贝设置，不含样本数据
   */
  cloneSettings(): CaptureSession {
    const newSession = this.clone();

    // 清除样本数据
    newSession.captureChannels.forEach(ch => {
      ch.samples = undefined;
    });

    // 清除突发信息
    newSession.bursts = undefined;

    return newSession;
  }
}

/**
 * 采集事件参数 - 对应C# CaptureEventArgs
 */
export interface CaptureEventArgs {
  success: boolean;
  session: CaptureSession;
}

/**
 * 设备信息 - 对应C# AnalyzerDeviceInfo类
 */
export interface AnalyzerDeviceInfo {
  name: string; // 设备名称和版本
  maxFrequency: number; // 最大采样频率
  blastFrequency: number; // 突发采样频率
  channels: number; // 通道数量
  bufferSize: number; // 缓冲区大小
  modeLimits: CaptureLimits[]; // 各模式的采集限制
}

/**
 * 数据包封装类 - 对应C# OutputPacket
 * 实现了关键的转义机制和精确的结构体布局
 */
export class OutputPacket {
  private dataBuffer: number[] = [];

  /**
   * 添加字节
   */
  addByte(value: number): void {
    this.dataBuffer.push(value & 0xff);
  }

  /**
   * 添加字节数组
   */
  addBytes(values: Uint8Array | number[]): void {
    for (const value of values) {
      this.addByte(value);
    }
  }

  /**
   * 添加字符串 (ASCII编码)
   */
  addString(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.addByte(text.charCodeAt(i));
    }
  }

  /**
   * 添加结构体 - 精确序列化
   */
  addStruct(struct: CaptureRequest | NetConfig): void {
    const buffer = this.serializeStruct(struct);
    this.addBytes(buffer);
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.dataBuffer = [];
  }

  /**
   * 序列化数据包 - 精确实现C#版本的转义机制
   * 协议格式: 0x55 0xAA [转义后的数据] 0xAA 0x55
   * 转义规则: 0xAA/0x55/0xF0 -> 0xF0 + (原值 ^ 0xF0)
   */
  serialize(): Uint8Array {
    const finalData: number[] = [];

    // 协议头
    finalData.push(0x55);
    finalData.push(0xaa);

    // 转义数据
    for (const byte of this.dataBuffer) {
      if (byte === 0xaa || byte === 0x55 || byte === 0xf0) {
        finalData.push(0xf0);
        finalData.push(byte ^ 0xf0);
      } else {
        finalData.push(byte);
      }
    }

    // 协议尾
    finalData.push(0xaa);
    finalData.push(0x55);

    return new Uint8Array(finalData);
  }

  /**
   * 结构体序列化 - 精确对应C#内存布局
   */
  private serializeStruct(struct: CaptureRequest | NetConfig): Uint8Array {
    if ('triggerType' in struct) {
      return this.serializeCaptureRequest(struct);
    } else {
      return this.serializeNetConfig(struct);
    }
  }

  /**
   * 序列化采集请求结构
   */
  private serializeCaptureRequest(req: CaptureRequest): Uint8Array {
    const buffer = new ArrayBuffer(50); // 精确的结构体大小
    const view = new DataView(buffer);
    let offset = 0;

    view.setUint8(offset++, req.triggerType);
    view.setUint8(offset++, req.trigger);
    view.setUint8(offset++, req.invertedOrCount);
    view.setUint16(offset, req.triggerValue, true);
    offset += 2; // little-endian

    // 24字节通道数组
    for (let i = 0; i < 24; i++) {
      view.setUint8(offset++, req.channels[i] || 0);
    }

    view.setUint8(offset++, req.channelCount);
    view.setUint32(offset, req.frequency, true);
    offset += 4; // little-endian
    view.setUint32(offset, req.preSamples, true);
    offset += 4; // little-endian
    view.setUint32(offset, req.postSamples, true);
    offset += 4; // little-endian
    view.setUint8(offset++, req.loopCount);
    view.setUint8(offset++, req.measure);
    view.setUint8(offset++, req.captureMode);

    return new Uint8Array(buffer);
  }

  /**
   * 序列化网络配置结构
   */
  private serializeNetConfig(config: NetConfig): Uint8Array {
    const buffer = new ArrayBuffer(115); // 33 + 64 + 16 + 2
    const view = new DataView(buffer);
    let offset = 0;

    // AccessPointName - 33字节固定长度
    const apName = new TextEncoder().encode(config.accessPointName.substring(0, 32));
    for (let i = 0; i < 33; i++) {
      view.setUint8(offset++, i < apName.length ? apName[i] : 0);
    }

    // Password - 64字节固定长度
    const password = new TextEncoder().encode(config.password.substring(0, 63));
    for (let i = 0; i < 64; i++) {
      view.setUint8(offset++, i < password.length ? password[i] : 0);
    }

    // IPAddress - 16字节固定长度
    const ipAddr = new TextEncoder().encode(config.ipAddress.substring(0, 15));
    for (let i = 0; i < 16; i++) {
      view.setUint8(offset++, i < ipAddr.length ? ipAddr[i] : 0);
    }

    // Port - 16位
    view.setUint16(offset, config.port, true); // little-endian

    return new Uint8Array(buffer);
  }
}

/**
 * 采集请求结构 - 对应C# CaptureRequest struct
 * 需要精确的内存布局
 */
export interface CaptureRequest {
  triggerType: number; // byte - 触发类型
  trigger: number; // byte - 触发通道
  invertedOrCount: number; // byte - 反转标志或计数
  triggerValue: number; // ushort - 触发值
  channels: Uint8Array; // byte[24] - 通道配置
  channelCount: number; // byte - 有效通道数
  frequency: number; // uint32 - 采样频率
  preSamples: number; // uint32 - 触发前样本
  postSamples: number; // uint32 - 触发后样本
  loopCount: number; // byte - 循环次数
  measure: number; // byte - 是否测量突发
  captureMode: number; // byte - 采集模式
}

/**
 * 网络配置结构 - 对应C# NetConfig struct
 * WiFi网络配置，需要固定大小缓冲区
 */
export interface NetConfig {
  accessPointName: string; // 33字节固定长度
  password: string; // 64字节固定长度
  ipAddress: string; // 16字节固定长度
  port: number; // ushort (16位)
}

/**
 * 硬件抽象层核心接口
 * 基于原始C# AnalyzerDriverBase类设计
 */
export abstract class AnalyzerDriverBase extends EventEmitter {
  // 抽象属性 - 子类必须实现
  abstract get deviceVersion(): string | null;
  abstract get blastFrequency(): number;
  abstract get maxFrequency(): number;
  abstract get channelCount(): number;
  abstract get bufferSize(): number;
  abstract get driverType(): AnalyzerDriverType;
  abstract get isNetwork(): boolean;
  abstract get isCapturing(): boolean;

  // 可选标签属性
  public tag?: any;

  // 计算属性：最小频率
  get minFrequency(): number {
    return Math.floor((this.maxFrequency * 2) / 65535);
  }

  // 抽象方法 - 子类必须实现
  abstract startCapture(
    session: CaptureSession,
    captureCompletedHandler?: (args: CaptureEventArgs) => void
  ): Promise<CaptureError>;
  abstract stopCapture(): Promise<boolean>;
  abstract enterBootloader(): Promise<boolean>;

  // 虚方法 - 子类可以重写

  /**
   * 获取采集模式 - 基于通道数量
   */
  getCaptureMode(channels: number[]): CaptureMode {
    const maxChannel = channels.length > 0 ? Math.max(...channels) : 0;
    return maxChannel < 8
      ? CaptureMode.Channels_8
      : maxChannel < 16
      ? CaptureMode.Channels_16
      : CaptureMode.Channels_24;
  }

  /**
   * 获取采集限制 - 基于通道配置
   */
  getLimits(channels: number[]): CaptureLimits {
    const mode = this.getCaptureMode(channels);

    const totalSamples =
      this.bufferSize /
      (mode === CaptureMode.Channels_8 ? 1 : mode === CaptureMode.Channels_16 ? 2 : 4);

    return {
      minPreSamples: 2,
      maxPreSamples: Math.floor(totalSamples / 10),
      minPostSamples: 2,
      maxPostSamples: totalSamples - 2
    };
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo(): AnalyzerDeviceInfo {
    const limits: CaptureLimits[] = [];

    // 计算各种模式的限制
    limits.push(this.getLimits(Array.from({ length: 8 }, (_, i) => i))); // 0-7
    limits.push(this.getLimits(Array.from({ length: 16 }, (_, i) => i))); // 0-15
    limits.push(this.getLimits(Array.from({ length: 24 }, (_, i) => i))); // 0-23

    return {
      name: this.deviceVersion ?? 'Unknown',
      maxFrequency: this.maxFrequency,
      blastFrequency: this.blastFrequency,
      channels: this.channelCount,
      bufferSize: this.bufferSize,
      modeLimits: limits
    };
  }

  // 网络方法 - 默认实现

  /**
   * 获取电压状态 - 电池电压监控
   */
  getVoltageStatus(): Promise<string> {
    return Promise.resolve('UNSUPPORTED');
  }

  /**
   * 发送网络配置
   */
  sendNetworkConfig(
    accessPointName: string,
    password: string,
    ipAddress: string,
    port: number
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  // 清理资源
  dispose(): void {
    this.removeAllListeners();
  }
}
