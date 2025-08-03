/**
 * 统一数据格式定义
 * 基于 plan.md 中的设计，用于多硬件数据适配
 * 必须与原 @logicanalyzer/Software 的 .lac 格式 100% 兼容
 */

import { DeviceInfo } from './AnalyzerTypes';

// 时基信息
export interface TimebaseInfo {
  sampleRate: number; // 实际采样率 (Hz)
  sampleInterval: number; // 采样间隔 (ns)
  timeOffset: number; // 时间起始偏移 (ns)
  precision: number; // 时间精度 (ns)
}

// 通道信息
export interface ChannelInfo {
  channelNumber: number; // 通道编号 (0-based)
  channelName: string; // 通道名称
  channelColor?: string; // 显示颜色 (hex)
  enabled: boolean; // 是否启用
  threshold?: number; // 逻辑阈值电压 (V)
  coupling?: 'DC' | 'AC'; // 耦合方式
  scale?: number; // 缩放因子
  offset?: number; // 偏移量
  hidden: boolean; // 是否隐藏显示
}

// 数字信号数据
export interface DigitalSampleData {
  data: Uint8Array[]; // 每个通道的二进制数据
  encoding: 'binary' | 'rle'; // 数据编码格式
  compression?: 'none' | 'zip' | 'lz4'; // 压缩算法
}

// 模拟信号数据 (预留)
export interface AnalogSampleData {
  data: Float32Array[]; // 模拟通道数据
  resolution: number; // ADC分辨率 (bits)
  range: [number, number]; // 量程范围 [min, max] (V)
  units: string; // 单位 (V, mV, etc.)
}

// 时序数据 (用于时间间隔测量)
export interface TimingData {
  intervals: number[]; // 时间间隔数组 (ns)
  precision: number; // 时间精度 (ns)
  events: TimingEvent[]; // 时序事件
}

// 时序事件
export interface TimingEvent {
  timestamp: number; // 时间戳 (ns)
  channelMask: number; // 通道掩码
  eventType: 'edge' | 'pulse' | 'burst'; // 事件类型
  duration?: number; // 持续时间 (ns)
}

// 数据质量信息
export interface DataQuality {
  lostSamples: number; // 丢失样本数
  errorRate: number; // 错误率 (0-1)
  noiseLevel?: number; // 噪声水平
  calibrationStatus: boolean; // 校准状态
  overruns: number; // 缓冲区溢出次数
  underruns: number; // 缓冲区欠载次数
  signalIntegrity: number; // 信号完整性评分 (0-100)
}

// 采集元数据
export interface CaptureMetadata {
  deviceInfo: DeviceInfo; // 设备信息
  captureId: string; // 采集会话ID
  timestamp: number; // 采集时间戳 (ms since epoch)
  duration: number; // 采集持续时间 (ms)
  sampleRate: number; // 实际采样率 (Hz)
  totalSamples: number; // 总样本数
  triggerPosition?: number; // 触发位置 (样本索引)
  timebase: TimebaseInfo; // 时基信息
  captureMode: string; // 采集模式
  triggerInfo?: TriggerInfo; // 触发信息
}

// 触发信息
export interface TriggerInfo {
  type: 'edge' | 'level' | 'pattern' | 'pulse'; // 触发类型
  channel: number; // 触发通道
  condition: 'rising' | 'falling' | 'high' | 'low' | 'any'; // 触发条件
  level?: number; // 触发电平 (V)
  pattern?: number; // 触发模式 (bit pattern)
  hysteresis?: number; // 滞回电压 (V)
  holdoff?: number; // 触发禁止时间 (ns)
}

// 扩展数据 (硬件特定)
export interface ExtensionData {
  [deviceType: string]: any; // 硬件特定的扩展数据
}

// 统一采集数据格式 - 核心接口
export interface UnifiedCaptureData {
  // 版本信息
  version: string; // 数据格式版本
  formatType: 'unified-v1'; // 格式类型标识

  // 元数据
  metadata: CaptureMetadata;

  // 通道信息
  channels: ChannelInfo[];

  // 样本数据
  samples: {
    digital?: DigitalSampleData;
    analog?: AnalogSampleData;
    timing?: TimingData;
  };

  // 扩展数据（硬件特定）
  extensions?: ExtensionData;

  // 质量信息
  quality: DataQuality;

  // 处理状态
  processed?: {
    decoded: boolean; // 是否已解码
    analyzed: boolean; // 是否已分析
    validated: boolean; // 是否已验证
    lastModified: number; // 最后修改时间
  };
}

// 视图范围 (用于渲染)
export interface ViewRange {
  startSample: number; // 起始样本索引
  endSample: number; // 结束样本索引
  samplesPerPixel: number; // 每像素样本数
  timePerPixel: number; // 每像素时间 (ns)
  zoomLevel: number; // 缩放级别
}

// 渲染参数
export interface RenderParams {
  viewRange: ViewRange;
  channelHeight: number; // 通道高度 (pixels)
  channelSpacing: number; // 通道间距 (pixels)
  colors: {
    background: string; // 背景色
    grid: string; // 网格色
    signal: string; // 信号色
    trigger: string; // 触发标记色
    cursor: string; // 光标色
  };
  showGrid: boolean; // 是否显示网格
  showLabels: boolean; // 是否显示标签
  antialiasing: boolean; // 是否抗锯齿
}

// 工具函数
export class UnifiedDataFormat {
  private static idCounter = 0;

  /**
   * 验证数据格式
   */
  static validate(data: UnifiedCaptureData): boolean {
    try {
      // 基本结构检查
      if (
        !data.version ||
        !data.formatType ||
        !data.metadata ||
        !data.channels ||
        !data.samples ||
        !data.quality
      ) {
        return false;
      }

      // 版本兼容性检查
      if (data.formatType !== 'unified-v1') {
        return false;
      }

      // 数据一致性检查
      if (data.channels.length === 0) {
        return false;
      }

      if (data.samples.digital) {
        if (data.samples.digital.data.length !== data.channels.filter(ch => ch.enabled).length) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 创建空的采集数据
   */
  static createEmpty(deviceInfo: DeviceInfo): UnifiedCaptureData {
    return {
      version: '1.0.0',
      formatType: 'unified-v1',
      metadata: {
        deviceInfo,
        captureId: `capture-${Date.now()}-${++UnifiedDataFormat.idCounter}`,
        timestamp: Date.now(),
        duration: 0,
        sampleRate: 1000000, // 1MHz 默认
        totalSamples: 0,
        timebase: {
          sampleRate: 1000000,
          sampleInterval: 1000, // 1us
          timeOffset: 0,
          precision: 1
        },
        captureMode: 'normal'
      },
      channels: [],
      samples: {},
      quality: {
        lostSamples: 0,
        errorRate: 0,
        calibrationStatus: true,
        overruns: 0,
        underruns: 0,
        signalIntegrity: 100
      }
    };
  }

  /**
   * 转换为.lac兼容格式
   */
  static toLacFormat(data: UnifiedCaptureData): any {
    // 转换为与原软件兼容的.lac格式
    return {
      captureSession: {
        frequency: data.metadata.sampleRate,
        totalSamples: data.metadata.totalSamples,
        preTriggerSamples: data.metadata.triggerPosition || 0,
        postTriggerSamples: data.metadata.totalSamples - (data.metadata.triggerPosition || 0),
        captureChannels: data.channels.map((ch, index) => ({
          channelNumber: ch.channelNumber,
          channelName: ch.channelName,
          channelColor: ch.channelColor,
          hidden: ch.hidden,
          samples: data.samples.digital?.data[index] || new Uint8Array()
        }))
      },
      deviceInfo: data.metadata.deviceInfo,
      quality: data.quality
    };
  }

  /**
   * 从.lac格式转换
   */
  static fromLacFormat(lacData: any, deviceInfo: DeviceInfo): UnifiedCaptureData {
    const session = lacData.captureSession || lacData;

    return {
      version: '1.0.0',
      formatType: 'unified-v1',
      metadata: {
        deviceInfo,
        captureId: `imported-${Date.now()}`,
        timestamp: Date.now(),
        duration: 0,
        sampleRate: session.frequency !== undefined ? session.frequency : 1000000,
        totalSamples: session.totalSamples || 0,
        triggerPosition: session.preTriggerSamples || 0,
        timebase: {
          sampleRate: session.frequency !== undefined ? session.frequency : 1000000,
          sampleInterval: session.frequency !== undefined && session.frequency > 0 ? 1000000000 / session.frequency : 0,
          timeOffset: 0,
          precision: 1
        },
        captureMode: 'imported'
      },
      channels: (session.captureChannels || []).map((ch: any) => ({
        channelNumber: ch.channelNumber || 0,
        channelName: ch.channelName || `Channel ${ch.channelNumber + 1}`,
        channelColor: ch.channelColor,
        enabled: !ch.hidden,
        hidden: ch.hidden || false
      })),
      samples: {
        digital: {
          data: (session.captureChannels || []).map((ch: any) => ch.samples || new Uint8Array()),
          encoding: 'binary'
        }
      },
      quality: lacData.quality || {
        lostSamples: 0,
        errorRate: 0,
        calibrationStatus: true,
        overruns: 0,
        underruns: 0,
        signalIntegrity: 100
      }
    };
  }
}
