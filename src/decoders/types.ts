/**
 * 解码器类型定义
 * 基于 @logicanalyzer/Software 的 SigrokDecoderBridge 架构设计
 */

/**
 * 解码器通道定义
 * 对应原软件的 SigrokChannel
 */
export interface DecoderChannel {
  /** 通道标识符 */
  id: string;
  /** 通道名称 */
  name: string;
  /** 通道描述 */
  desc: string;
  /** 是否为必需通道 */
  required?: boolean;
  /** 通道索引 */
  index?: number;
}

/**
 * 解码器选项定义
 * 对应原软件的 SigrokOption
 */
export interface DecoderOption {
  /** 选项标识符 */
  id: string;
  /** 选项描述 */
  desc: string;
  /** 默认值 */
  default?: any;
  /** 可选值列表 */
  values?: string[];
  /** 选项类型 */
  type?: 'string' | 'int' | 'float' | 'bool' | 'list';
}

/**
 * 解码器选项值
 * 对应原软件的 SigrokOptionValue
 */
export interface DecoderOptionValue {
  /** 选项索引 */
  optionIndex: number;
  /** 选项值 */
  value: any;
}

/**
 * 解码器通道选择
 * 对应原软件的 SigrokSelectedChannel
 */
export interface DecoderSelectedChannel {
  /** 采集通道索引 */
  captureIndex: number;
  /** 解码器通道索引 */
  decoderIndex: number;
  /** 通道名称 - 兼容字段 */
  name?: string;
  /** 通道编号 - 兼容字段 */
  channel?: number;
}

/**
 * 等待条件类型
 * 对应原软件的 WaitConditionType
 */
export type WaitConditionType =
  | 'skip' // 跳过样本
  | 'low' // 低电平 'l'
  | 'high' // 高电平 'h'
  | 'rising' // 上升沿 'r'
  | 'falling' // 下降沿 'f'
  | 'edge' // 任意边沿 'e'
  | 'stable'; // 稳定电平 's'

/**
 * 等待条件定义
 * 基于原软件的 wait() 方法参数
 */
export interface WaitCondition {
  [channelIndex: number]: WaitConditionType;
}

/**
 * 多条件等待数组
 * 对应原软件的 wait([condition1, condition2, ...]) 用法
 */
export type WaitConditions = WaitCondition | WaitCondition[];

/**
 * 等待结果
 * 对应原软件的 wait() 方法返回值
 */
export interface WaitResult {
  /** 匹配的引脚状态数组 */
  pins: number[];
  /** 样本编号 */
  sampleNumber: number;
  /** 匹配的条件数组 (对应原版的 self.matched) */
  matched?: boolean[];
  /** 匹配的条件索引 (哪一个条件匹配了) */
  matchedIndex?: number;
}

/**
 * 解码器输出类型
 * 对应原软件的 AnnotationOutputType
 */
export enum DecoderOutputType {
  ANNOTATION = 0, // OUTPUT_ANN
  PYTHON = 1, // OUTPUT_PYTHON
  BINARY = 2, // OUTPUT_BINARY
  LOGIC = 3, // OUTPUT_LOGIC
  META = 4 // OUTPUT_META
}

/**
 * 解码器输出数据
 * 对应原软件的 put() 方法参数
 */
export interface DecoderOutput {
  /** 输出类型 */
  type: DecoderOutputType;
  /** 注释类型ID */
  annotationType?: number;
  /** 输出值数组 */
  values: string[];
  /** 原始数据 */
  rawData?: any;
}

/**
 * 解码器结果
 * 对应原软件的 SigrokAnnotationSegment
 */
export interface DecoderResult {
  /** 开始样本 */
  startSample: number;
  /** 结束样本 */
  endSample: number;
  /** 注释类型 */
  annotationType: number;
  /** 显示值数组（从详细到简化） */
  values: string[];
  /** 原始数据 */
  rawData?: any;
  /** 形状类型 */
  shape?: 'hexagon' | 'rectangle' | 'diamond';
}

/**
 * 解码器注释定义
 * 对应原软件的 SigrokAnnotation
 */
export interface DecoderAnnotation {
  /** 注释名称 */
  name: string;
  /** 结果段数组 */
  segments: DecoderResult[];
}

/**
 * 解码器信息
 * 用于解码器管理和显示
 */
export interface DecoderInfo {
  /** 解码器标识符 */
  id: string;
  /** 解码器名称 */
  name: string;
  /** 完整名称 */
  longname: string;
  /** 描述 */
  description: string;
  /** 许可证 */
  license: string;
  /** 输入类型 */
  inputs: string[];
  /** 输出类型 */
  outputs: string[];
  /** 标签 */
  tags: string[];
  /** 通道定义 */
  channels: DecoderChannel[];
  /** 配置选项 */
  options: DecoderOption[];
  /** 注释类型定义 */
  annotations: Array<[string, string, string?]>;
  /** 注释行定义 */
  annotationRows?: Array<[string, string, number[]]>;
}

/**
 * 通道数据接口
 * 对应原软件的 AnalyzerChannel
 */
export interface ChannelData {
  /** 通道编号 */
  channelNumber: number;
  /** 通道名称 */
  channelName: string;
  /** 样本数据 */
  samples: Uint8Array;
  /** 是否隐藏 */
  hidden?: boolean;
}
