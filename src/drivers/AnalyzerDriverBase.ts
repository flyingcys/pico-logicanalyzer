import { EventEmitter } from 'events';
import {
  AnalyzerDriverType,
  CaptureMode,
  CaptureError,
  CaptureLimits,
  AnalyzerDeviceInfo,
  CaptureSession,
  CaptureConfiguration,
  CaptureResult,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus,
  CaptureEventArgs,
  CaptureCompletedHandler
} from '../models/AnalyzerTypes';

/**
 * 逻辑分析器驱动抽象基类
 * 基于C# AnalyzerDriverBase的TypeScript移植
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

  // 计算属性
  get minFrequency(): number {
    return Math.floor((this.maxFrequency * 2) / 65535);
  }

  // 可选属性
  public tag?: any;

  // 抽象方法 - 子类必须实现
  abstract startCapture(
    session: CaptureSession,
    captureCompletedHandler?: CaptureCompletedHandler
  ): Promise<CaptureError>;

  abstract stopCapture(): Promise<boolean>;
  abstract enterBootloader(): Promise<boolean>;
  abstract connect(params: ConnectionParams): Promise<ConnectionResult>;
  abstract disconnect(): Promise<void>;
  abstract getStatus(): Promise<DeviceStatus>;

  // 设备信息方法
  getCaptureMode(channels: number[]): CaptureMode {
    const maxChannel = Math.max(...channels, 0);
    if (maxChannel < 8) return CaptureMode.Channels_8;
    if (maxChannel < 16) return CaptureMode.Channels_16;
    return CaptureMode.Channels_24;
  }

  getLimits(channels: number[]): CaptureLimits {
    const mode = this.getCaptureMode(channels);

    // 根据通道模式计算总样本数
    let divisor: number;
    switch (mode) {
      case CaptureMode.Channels_8:
        divisor = 1;
        break;
      case CaptureMode.Channels_16:
        divisor = 2;
        break;
      case CaptureMode.Channels_24:
        divisor = 4;
        break;
    }

    const totalSamples = Math.floor(this.bufferSize / divisor);

    const limits: CaptureLimits = {
      minPreSamples: 2,
      maxPreSamples: Math.floor(totalSamples / 10),
      minPostSamples: 2,
      maxPostSamples: totalSamples - 2,
      get maxTotalSamples(): number {
        return this.minPreSamples + this.maxPostSamples;
      }
    };

    return limits;
  }

  getDeviceInfo(): AnalyzerDeviceInfo {
    const limits: CaptureLimits[] = [
      this.getLimits(Array.from({ length: 8 }, (_, i) => i)), // 0-7
      this.getLimits(Array.from({ length: 16 }, (_, i) => i)), // 0-15
      this.getLimits(Array.from({ length: 24 }, (_, i) => i)) // 0-23
    ];

    return {
      name: this.deviceVersion ?? 'Unknown',
      maxFrequency: this.maxFrequency,
      blastFrequency: this.blastFrequency,
      channels: this.channelCount,
      bufferSize: this.bufferSize,
      modeLimits: limits
    };
  }

  // 网络方法 - 虚拟实现，子类可以重写
  getVoltageStatus(): Promise<string> {
    return Promise.resolve('UNSUPPORTED');
  }

  sendNetworkConfig(
    accessPointName: string,
    password: string,
    ipAddress: string,
    port: number
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  // 资源清理
  dispose(): void {
    this.removeAllListeners();
  }

  // 事件触发辅助方法
  protected emitCaptureCompleted(args: CaptureEventArgs): void {
    this.emit('captureCompleted', args);
  }

  protected emitError(error: Error): void {
    this.emit('error', error);
  }

  protected emitStatusChanged(status: DeviceStatus): void {
    this.emit('statusChanged', status);
  }
}

/**
 * 输出数据包类
 * 实现C#版本的OutputPacket功能，包括转义机制
 */
export class OutputPacket {
  private dataBuffer: number[] = [];

  addByte(value: number): void {
    this.dataBuffer.push(value & 0xff);
  }

  addBytes(values: number[] | Uint8Array): void {
    for (const value of values) {
      this.addByte(value);
    }
  }

  addString(text: string): void {
    // ASCII编码
    for (let i = 0; i < text.length; i++) {
      this.addByte(text.charCodeAt(i));
    }
  }

  addStruct(struct: any): void {
    // TypeScript中的结构体序列化
    const buffer = this.serializeStruct(struct);
    this.addBytes(buffer);
  }

  clear(): void {
    this.dataBuffer = [];
  }

  /**
   * 序列化数据包，包含转义机制
   * 协议格式: 0x55 0xAA [转义后的数据] 0xAA 0x55
   * 转义规则: 0xAA/0x55/0xF0 -> 0xF0 + (原值 ^ 0xF0)
   */
  serialize(): Uint8Array {
    const finalData: number[] = [];

    // 起始标记
    finalData.push(0x55, 0xaa);

    // 转义数据
    for (let i = 0; i < this.dataBuffer.length; i++) {
      const byte = this.dataBuffer[i];
      if (byte === 0xaa || byte === 0x55 || byte === 0xf0) {
        finalData.push(0xf0);
        finalData.push(byte ^ 0xf0);
      } else {
        finalData.push(byte);
      }
    }

    // 结束标记
    finalData.push(0xaa, 0x55);

    return new Uint8Array(finalData);
  }

  /**
   * 结构体序列化辅助方法
   */
  private serializeStruct(struct: any): Uint8Array {
    // 这里需要根据具体的结构体类型进行序列化
    // 实际实现会在具体的结构体类中完成
    if (struct && typeof struct.serialize === 'function') {
      return struct.serialize();
    }
    throw new Error('结构体必须实现serialize方法');
  }
}

/**
 * 采集请求结构
 * 对应C#的CaptureRequest结构体，必须保持精确的内存布局
 */
export class CaptureRequest {
  public triggerType: number = 0; // byte
  public trigger: number = 0; // byte
  public invertedOrCount: number = 0; // byte
  public triggerValue: number = 0; // ushort (16位)
  public channels: Uint8Array; // byte[24]
  public channelCount: number = 0; // byte
  public frequency: number = 0; // uint32 (32位)
  public preSamples: number = 0; // uint32 (32位)
  public postSamples: number = 0; // uint32 (32位)
  public loopCount: number = 0; // byte
  public measure: number = 0; // byte
  public captureMode: number = 0; // byte

  constructor() {
    this.channels = new Uint8Array(24);
  }

  /**
   * 从CaptureConfiguration创建CaptureRequest
   */
  static fromConfiguration(config: CaptureConfiguration): CaptureRequest {
    const request = new CaptureRequest();

    request.triggerType = config.triggerType;
    request.trigger = config.triggerChannel;
    request.invertedOrCount = config.triggerInverted ? 1 : 0;
    request.triggerValue = config.triggerPattern || 0;
    request.channelCount = config.captureChannels.length;
    request.frequency = config.frequency;
    request.preSamples = config.preTriggerSamples;
    request.postSamples = config.postTriggerSamples;
    request.loopCount = config.loopCount;
    request.measure = config.measureBursts ? 1 : 0;
    request.captureMode = config.captureMode || CaptureMode.Channels_8;

    // 设置通道数组
    for (let i = 0; i < config.captureChannels.length && i < 24; i++) {
      request.channels[config.captureChannels[i]] = 1;
    }

    return request;
  }

  /**
   * 序列化为字节数组，保持与C#版本的精确布局
   */
  serialize(): Uint8Array {
    const buffer = new ArrayBuffer(this.getSize());
    const view = new DataView(buffer);
    let offset = 0;

    // 按照C#结构体的精确顺序写入
    view.setUint8(offset++, this.triggerType);
    view.setUint8(offset++, this.trigger);
    view.setUint8(offset++, this.invertedOrCount);
    view.setUint16(offset, this.triggerValue, true); // little-endian
    offset += 2;

    // 通道数组
    for (let i = 0; i < 24; i++) {
      view.setUint8(offset++, this.channels[i]);
    }

    view.setUint8(offset++, this.channelCount);
    view.setUint32(offset, this.frequency, true); // little-endian
    offset += 4;
    view.setUint32(offset, this.preSamples, true); // little-endian
    offset += 4;
    view.setUint32(offset, this.postSamples, true); // little-endian
    offset += 4;
    view.setUint8(offset++, this.loopCount);
    view.setUint8(offset++, this.measure);
    view.setUint8(offset++, this.captureMode);

    return new Uint8Array(buffer);
  }

  /**
   * 获取结构体大小（字节）
   */
  private getSize(): number {
    // 1 + 1 + 1 + 2 + 24 + 1 + 4 + 4 + 4 + 1 + 1 + 1 = 45 bytes
    return 45;
  }
}

/**
 * 网络配置结构
 * 对应C#的NetConfig结构体
 */
export class NetConfig {
  public accessPointName: string = ''; // 33字节固定长度
  public password: string = ''; // 64字节固定长度
  public ipAddress: string = ''; // 16字节固定长度
  public port: number = 0; // ushort (16位)

  constructor(
    accessPointName: string = '',
    password: string = '',
    ipAddress: string = '',
    port: number = 0
  ) {
    this.accessPointName = accessPointName;
    this.password = password;
    this.ipAddress = ipAddress;
    this.port = port;
  }

  /**
   * 序列化为字节数组
   */
  serialize(): Uint8Array {
    const buffer = new ArrayBuffer(this.getSize());
    const view = new DataView(buffer);
    let offset = 0;

    // AccessPointName - 33字节固定长度
    const apNameBytes = new TextEncoder().encode(this.accessPointName);
    for (let i = 0; i < 33; i++) {
      view.setUint8(offset++, i < apNameBytes.length ? apNameBytes[i] : 0);
    }

    // Password - 64字节固定长度
    const passwordBytes = new TextEncoder().encode(this.password);
    for (let i = 0; i < 64; i++) {
      view.setUint8(offset++, i < passwordBytes.length ? passwordBytes[i] : 0);
    }

    // IPAddress - 16字节固定长度
    const ipBytes = new TextEncoder().encode(this.ipAddress);
    for (let i = 0; i < 16; i++) {
      view.setUint8(offset++, i < ipBytes.length ? ipBytes[i] : 0);
    }

    // Port - 2字节
    view.setUint16(offset, this.port, true); // little-endian

    return new Uint8Array(buffer);
  }

  /**
   * 获取结构体大小（字节）
   */
  private getSize(): number {
    // 33 + 64 + 16 + 2 = 115 bytes
    return 115;
  }
}
