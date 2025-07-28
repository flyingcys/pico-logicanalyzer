/**
 * 逻辑分析器类型定义
 * 基于C# SharedDriver模块的TypeScript移植
 */

// 枚举类型定义
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

export enum CaptureError {
  None = 'None',
  Busy = 'Busy',
  BadParams = 'BadParams',
  HardwareError = 'HardwareError',
  UnexpectedError = 'UnexpectedError'
}

export enum TriggerType {
  Edge = 0,
  Complex = 1,
  Fast = 2,
  Blast = 3
}

// 数据结构定义
export interface CaptureLimits {
  minPreSamples: number;
  maxPreSamples: number;
  minPostSamples: number;
  maxPostSamples: number;

  // 计算属性
  readonly maxTotalSamples: number;
}

export interface AnalyzerDeviceInfo {
  name: string;
  maxFrequency: number;
  blastFrequency: number;
  channels: number;
  bufferSize: number;
  modeLimits: CaptureLimits[];
}

export interface DeviceInfo {
  name: string;
  version?: string | undefined;
  type: AnalyzerDriverType;
  connectionPath?: string;
  isNetwork: boolean;
  capabilities: HardwareCapabilities;
}

export interface HardwareCapabilities {
  // 通道规格
  channels: {
    digital: number;
    analog?: number;
    mixed?: boolean;
    maxVoltage: number;
    inputImpedance: number;
  };

  // 采样能力
  sampling: {
    maxRate: number;
    minRate: number;
    supportedRates: number[];
    bufferSize: number;
    streamingSupport: boolean;
  };

  // 触发能力
  triggers: {
    types: TriggerType[];
    maxChannels: number;
    patternWidth: number;
    sequentialSupport: boolean;
    conditions: TriggerCondition[];
  };

  // 连接方式
  connectivity: {
    interfaces: ('usb' | 'ethernet' | 'serial' | 'bluetooth')[];
    protocols: ('custom' | 'scpi' | 'sigrok' | 'saleae')[];
    networkConfig?: NetworkCapability;
  };

  // 特殊功能
  features: {
    signalGeneration?: boolean;
    powerSupply?: boolean;
    i2cSniffer?: boolean;
    canSupport?: boolean;
    customDecoders?: boolean;
    voltageMonitoring?: boolean;
  };
}

export interface NetworkCapability {
  supportsWiFi: boolean;
  supportsEthernet: boolean;
  maxConnections: number;
  defaultPort: number;
}

export type TriggerCondition = 'rising' | 'falling' | 'high' | 'low' | 'any' | 'none';

export interface ConnectionParams {
  devicePath?: string;
  networkConfig?: {
    host: string;
    port: number;
    timeout?: number;
  };
  serialConfig?: {
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: string;
  };
  autoDetect?: boolean;
}

export interface ConnectionResult {
  success: boolean;
  error?: string;
  deviceInfo?: DeviceInfo;
}

export interface CaptureConfiguration {
  frequency: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  triggerType: TriggerType;
  triggerChannel: number;
  triggerInverted: boolean;
  triggerPattern?: number;
  triggerBitCount?: number;
  loopCount: number;
  measureBursts: boolean;
  captureChannels: number[];
  captureMode?: CaptureMode | undefined;
}

export interface CaptureResult {
  success: boolean;
  error?: CaptureError;
  session?: CaptureSession;
}

export interface CaptureSession {
  // 基础采集参数
  frequency: number;
  preTriggerSamples: number;
  postTriggerSamples: number;

  // 计算属性
  get totalSamples(): number;

  // 触发系统配置
  triggerType: TriggerType;
  triggerChannel: number;
  triggerInverted: boolean;
  triggerPattern?: number;
  triggerBitCount?: number;

  // 突发采集系统
  loopCount: number;
  measureBursts: boolean;

  // 通道配置
  captureChannels: AnalyzerChannel[];
  captureMode?: CaptureMode;

  // 突发信息数组
  bursts?: BurstInfo[];

  // 方法接口
  clone(): CaptureSession;
  cloneSettings(): CaptureSession;
}

export interface AnalyzerChannel {
  channelNumber: number;
  channelName: string;
  channelColor?: string;
  hidden: boolean;
  samples?: Uint8Array;

  // 显示属性
  get textualChannelNumber(): string;

  // 克隆方法
  clone(): AnalyzerChannel;
}

export interface BurstInfo {
  burstSampleStart: number;
  burstSampleEnd: number;
  burstSampleGap: number;
  burstTimeGap: number; // 纳秒

  // 时间格式化方法
  getTime(): string;
}

export interface DeviceStatus {
  isConnected: boolean;
  isCapturing: boolean;
  batteryVoltage?: string;
  temperature?: number;
  errorStatus?: string;
}

export interface CaptureEventArgs {
  success: boolean;
  session: CaptureSession;
}

// 事件类型定义
export type CaptureCompletedHandler = (args: CaptureEventArgs) => void;

// 常量定义
export const TriggerDelays = {
  ComplexTriggerDelay: 5, // 复杂触发延迟 (纳秒)
  FastTriggerDelay: 3 // 快速触发延迟 (纳秒)
} as const;
