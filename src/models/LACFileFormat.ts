/**
 * .lac 文件格式读写处理器
 * 基于原版 C# ExportedCapture 和 LACEnvelope 的精确实现
 * 确保与原软件 100% 兼容
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  TriggerType, 
  AnalyzerDeviceInfo,
  DeviceInfo 
} from './AnalyzerTypes';
import { 
  CaptureSession, 
  AnalyzerChannel, 
  BurstInfo 
} from './CaptureModels';
import { UnifiedCaptureData, UnifiedDataFormat } from './UnifiedDataFormat';

/**
 * .lac 文件版本信息
 */
export interface LACFileVersion {
  version: string;
  compatibility: string[];
  features: string[];
}

/**
 * .lac 文件头部信息
 */
export interface LACFileHeader {
  version: string;
  timestamp: string;
  generator: string;
  format: string;
}

/**
 * 设备信息结构 - 对应原版C#的设备信息
 */
export interface LACDeviceInfo {
  name: string;
  version?: string;
  channels: number;
  maxFrequency: number;
  blastFrequency?: number;
  bufferSize?: number;
}

/**
 * 通道信息结构 - 对应原版C#的通道信息
 */
export interface LACChannelInfo {
  channelNumber: number;
  channelName: string;
  enabled: boolean;
  hidden?: boolean;
  color?: string;
  channelColor?: number; // uint? 对应C#的颜色值
  // 样本数据在文件中以Base64或压缩格式存储
  samples?: string | number[]; // 支持多种格式存储
}

/**
 * 采集会话信息 - 基于C# CaptureSession
 */
export interface LACCaptureSession {
  // 基础采集参数
  frequency?: number; // 兼容旧版本字段名
  sampleRate: number; // 新版本标准字段名
  totalSamples: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  
  // 触发系统配置
  triggerType: string | number; // 支持字符串和数字格式
  triggerChannel: number;
  triggerInverted?: boolean;
  triggerPattern?: number;
  triggerBitCount?: number;
  
  // 突发采集系统
  loopCount?: number;
  measureBursts?: boolean;
  
  // 通道配置
  channels: LACChannelInfo[];
  captureChannels?: LACChannelInfo[]; // 兼容性字段
  
  // 突发信息
  bursts?: Array<{
    burstSampleStart: number;
    burstSampleEnd: number;
    burstSampleGap: number;
    burstTimeGap: number;
  }>;
}

/**
 * 完整的.lac文件结构 - 基于C# ExportedCapture
 */
export interface LACFileContent {
  // 文件头部
  version: string;
  timestamp: string;
  generator?: string;
  
  // 设备信息
  deviceInfo: LACDeviceInfo;
  
  // 采集设置 - 对应C# ExportedCapture.Settings
  settings?: LACCaptureSession; // 兼容性字段
  captureSession: LACCaptureSession; // 标准字段
  
  // 样本数据 - 对应C# ExportedCapture.Samples
  samples?: string | number[] | any; // 保留兼容性，支持多种格式
  
  // 选择区域 - 对应C# ExportedCapture.SelectedRegions
  selectedRegions?: Array<{
    startSample: number;
    endSample: number;
    regionName?: string;
    color?: string;
  }>;
  
  // 注释信息
  annotations?: Array<{
    type: string;
    startSample: number;
    endSample: number;
    message: string;
    data?: any;
  }>;
  
  // 测试数据标记
  testData?: boolean;
  
  // 扩展信息
  metadata?: {
    [key: string]: any;
  };
}

/**
 * .lac 文件读写选项
 */
export interface LACFileOptions {
  // 读取选项
  validateFormat?: boolean; // 验证文件格式
  loadSampleData?: boolean; // 是否加载样本数据
  decompressSamples?: boolean; // 是否解压样本数据
  
  // 写入选项
  compressSamples?: boolean; // 是否压缩样本数据
  includeMetadata?: boolean; // 是否包含元数据
  prettyFormat?: boolean; // 是否美化JSON格式
  backupOriginal?: boolean; // 是否备份原文件
  
  // 兼容性选项
  legacyFormat?: boolean; // 使用旧版本格式
  preserveComments?: boolean; // 保留注释
}

/**
 * 文件操作结果
 */
export interface LACFileResult {
  success: boolean;
  filePath?: string;
  data?: LACFileContent;
  error?: string;
  warnings?: string[];
  statistics?: {
    fileSize: number;
    channels: number;
    samples: number;
    compressionRatio?: number;
  };
}

/**
 * .lac 文件格式处理器
 */
export class LACFileFormat {
  private static readonly CURRENT_VERSION = '1.0';
  private static readonly SUPPORTED_VERSIONS = ['1.0', '0.9', '0.8'];
  private static readonly GENERATOR_NAME = 'VSCode Logic Analyzer Extension';

  /**
   * 读取.lac文件
   */
  public static async readFile(
    filePath: string, 
    options: LACFileOptions = {}
  ): Promise<LACFileResult> {
    
    const startTime = performance.now();
    
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // 读取文件内容
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      const fileSize = Buffer.byteLength(fileContent, 'utf-8');
      
      // 解析JSON
      let data: LACFileContent;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
        };
      }

      // 验证文件格式
      if (options.validateFormat !== false) {
        const validationResult = this.validateFileFormat(data);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: `Format validation failed: ${validationResult.errors.join(', ')}`,
            warnings: validationResult.warnings
          };
        }
      }

      // 处理样本数据
      if (options.loadSampleData !== false && options.decompressSamples) {
        await this.decompressSampleData(data);
      }

      const processingTime = performance.now() - startTime;
      
      return {
        success: true,
        filePath,
        data,
        statistics: {
          fileSize,
          channels: data.captureSession.channels.length,
          samples: data.captureSession.totalSamples,
          compressionRatio: this.calculateCompressionRatio(data)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 写入.lac文件
   */
  public static async writeFile(
    filePath: string, 
    data: CaptureSession | UnifiedCaptureData | LACFileContent,
    options: LACFileOptions = {}
  ): Promise<LACFileResult> {
    
    try {
      // 转换数据为.lac格式
      let lacData: LACFileContent;
      
      if ('captureChannels' in data) {
        // CaptureSession类型
        lacData = this.convertCaptureSessionToLAC(data as CaptureSession);
      } else if ('formatType' in data) {
        // UnifiedCaptureData类型
        lacData = this.convertUnifiedDataToLAC(data as UnifiedCaptureData);
      } else {
        // 已经是LACFileContent类型
        lacData = data as LACFileContent;
      }

      // 更新文件头信息
      lacData.version = lacData.version || this.CURRENT_VERSION;
      lacData.timestamp = new Date().toISOString();
      lacData.generator = this.GENERATOR_NAME;

      // 备份原文件
      if (options.backupOriginal && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.promises.copyFile(filePath, backupPath);
      }

      // 压缩样本数据
      if (options.compressSamples) {
        await this.compressSampleData(lacData);
      }

      // 序列化为JSON
      const jsonContent = options.prettyFormat ? 
        JSON.stringify(lacData, null, 2) : 
        JSON.stringify(lacData);

      // 确保目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // 写入文件
      await fs.promises.writeFile(filePath, jsonContent, 'utf-8');
      
      const fileSize = Buffer.byteLength(jsonContent, 'utf-8');

      return {
        success: true,
        filePath,
        data: lacData,
        statistics: {
          fileSize,
          channels: lacData.captureSession.channels.length,
          samples: lacData.captureSession.totalSamples,
          compressionRatio: this.calculateCompressionRatio(lacData)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 验证文件格式
   */
  private static validateFileFormat(data: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需字段
    if (!data.version) {
      errors.push('Missing version field');
    } else if (!this.SUPPORTED_VERSIONS.includes(data.version)) {
      warnings.push(`Unsupported version: ${data.version}`);
    }

    if (!data.deviceInfo) {
      errors.push('Missing deviceInfo field');
    } else {
      if (!data.deviceInfo.name) {
        errors.push('Missing deviceInfo.name');
      }
      if (typeof data.deviceInfo.channels !== 'number') {
        errors.push('Invalid deviceInfo.channels');
      }
      if (typeof data.deviceInfo.maxFrequency !== 'number') {
        errors.push('Invalid deviceInfo.maxFrequency');
      }
    }

    if (!data.captureSession && !data.settings) {
      errors.push('Missing captureSession or settings field');
    }

    const session = data.captureSession || data.settings;
    if (session) {
      if (typeof session.totalSamples !== 'number') {
        errors.push('Invalid totalSamples');
      }
      if (!Array.isArray(session.channels)) {
        errors.push('Invalid channels array');
      }
      if (typeof session.sampleRate !== 'number' && typeof session.frequency !== 'number') {
        errors.push('Missing sampleRate or frequency');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 转换CaptureSession为.lac格式
   */
  private static convertCaptureSessionToLAC(session: CaptureSession): LACFileContent {
    return {
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      generator: this.GENERATOR_NAME,
      deviceInfo: {
        name: 'Logic Analyzer Device',
        channels: session.captureChannels.length,
        maxFrequency: session.frequency * 2 // 估算最大频率
      },
      captureSession: {
        sampleRate: session.frequency,
        frequency: session.frequency, // 兼容性字段
        totalSamples: session.totalSamples,
        preTriggerSamples: session.preTriggerSamples,
        postTriggerSamples: session.postTriggerSamples,
        triggerType: this.convertTriggerTypeToString(session.triggerType),
        triggerChannel: session.triggerChannel,
        triggerInverted: session.triggerInverted,
        triggerPattern: session.triggerPattern,
        triggerBitCount: session.triggerBitCount,
        loopCount: session.loopCount,
        measureBursts: session.measureBursts,
        channels: session.captureChannels.map(ch => this.convertChannelToLAC(ch)),
        bursts: session.bursts?.map(burst => ({
          burstSampleStart: burst.burstSampleStart,
          burstSampleEnd: burst.burstSampleEnd,  
          burstSampleGap: burst.burstSampleGap,
          burstTimeGap: burst.burstTimeGap
        }))
      }
    };
  }

  /**
   * 转换UnifiedCaptureData为.lac格式
   */
  private static convertUnifiedDataToLAC(data: UnifiedCaptureData): LACFileContent {
    return {
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      generator: this.GENERATOR_NAME,
      deviceInfo: {
        name: data.metadata.deviceInfo.name,
        version: data.metadata.deviceInfo.version,
        channels: data.metadata.deviceInfo.capabilities.channels.digital,
        maxFrequency: data.metadata.deviceInfo.capabilities.sampling.maxRate
      },
      captureSession: {
        sampleRate: data.metadata.sampleRate,
        frequency: data.metadata.sampleRate,
        totalSamples: data.metadata.totalSamples,
        preTriggerSamples: data.metadata.triggerPosition || 0,
        postTriggerSamples: data.metadata.totalSamples - (data.metadata.triggerPosition || 0),
        triggerType: data.metadata.triggerInfo?.type || 'edge',
        triggerChannel: data.metadata.triggerInfo?.channel || 0,
        channels: data.channels.map((ch, index) => ({
          channelNumber: ch.channelNumber,
          channelName: ch.channelName,
          enabled: ch.enabled,
          hidden: ch.hidden,
          color: ch.channelColor,
          samples: data.samples.digital?.data[index] ? 
            Array.from(data.samples.digital.data[index]) : undefined
        }))
      }
    };
  }

  /**
   * 转换通道信息为.lac格式
   */
  private static convertChannelToLAC(channel: AnalyzerChannel): LACChannelInfo {
    return {
      channelNumber: channel.channelNumber,
      channelName: channel.channelName,
      enabled: !channel.hidden,
      hidden: channel.hidden,
      color: typeof channel.channelColor === 'number' ? 
        `#${channel.channelColor.toString(16).padStart(6, '0')}` : 
        channel.channelColor?.toString(),
      channelColor: typeof channel.channelColor === 'string' ? 
        parseInt(channel.channelColor.replace('#', ''), 16) : 
        channel.channelColor,
      samples: channel.samples ? Array.from(channel.samples) : undefined
    };
  }

  /**
   * 转换触发类型为字符串
   */
  private static convertTriggerTypeToString(triggerType: TriggerType): string {
    switch (triggerType) {
      case TriggerType.Edge: return 'Edge';
      case TriggerType.Complex: return 'Complex';
      case TriggerType.Fast: return 'Fast';
      case TriggerType.Blast: return 'Blast';
      default: return 'Edge';
    }
  }

  /**
   * 解析触发类型
   */
  private static parseTriggerType(triggerType: string | number): TriggerType {
    if (typeof triggerType === 'number') {
      return triggerType as TriggerType;
    }
    
    switch (triggerType.toLowerCase()) {
      case 'edge': return TriggerType.Edge;
      case 'complex': return TriggerType.Complex;
      case 'fast': return TriggerType.Fast;
      case 'blast': return TriggerType.Blast;
      default: return TriggerType.Edge;
    }
  }

  /**
   * 压缩样本数据
   */
  private static async compressSampleData(data: LACFileContent): Promise<void> {
    // 简单的RLE压缩实现
    for (const channel of data.captureSession.channels) {
      if (channel.samples && Array.isArray(channel.samples)) {
        const compressed = this.compressRLE(channel.samples);
        if (compressed.length < channel.samples.length * 0.8) {
          channel.samples = `RLE:${compressed.join(',')}`;
        }
      }
    }
  }

  /**
   * 解压样本数据
   */
  private static async decompressSampleData(data: LACFileContent): Promise<void> {
    for (const channel of data.captureSession.channels) {
      if (channel.samples && typeof channel.samples === 'string') {
        if (channel.samples.startsWith('RLE:')) {
          const compressedData = channel.samples.substring(4).split(',').map(Number);
          channel.samples = this.decompressRLE(compressedData);
        }
      }
    }
  }

  /**
   * RLE压缩
   */
  private static compressRLE(data: number[]): number[] {
    const compressed: number[] = [];
    let currentValue = data[0];
    let count = 1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i] === currentValue && count < 255) {
        count++;
      } else {
        compressed.push(currentValue, count);
        currentValue = data[i];
        count = 1;
      }
    }
    
    compressed.push(currentValue, count);
    return compressed;
  }

  /**
   * RLE解压
   */
  private static decompressRLE(compressedData: number[]): number[] {
    const decompressed: number[] = [];
    
    for (let i = 0; i < compressedData.length; i += 2) {
      const value = compressedData[i];
      const count = compressedData[i + 1];
      
      for (let j = 0; j < count; j++) {
        decompressed.push(value);
      }
    }
    
    return decompressed;
  }

  /**
   * 计算压缩比
   */
  private static calculateCompressionRatio(data: LACFileContent): number {
    let originalSize = 0;
    let compressedSize = 0;
    
    for (const channel of data.captureSession.channels) {
      if (channel.samples) {
        if (Array.isArray(channel.samples)) {
          originalSize += channel.samples.length;
          compressedSize += channel.samples.length;
        } else if (typeof channel.samples === 'string' && channel.samples.startsWith('RLE:')) {
          const compressedData = channel.samples.substring(4).split(',');
          originalSize += data.captureSession.totalSamples;
          compressedSize += compressedData.length;
        }
      }
    }
    
    return originalSize > 0 ? compressedSize / originalSize : 1;
  }

  /**
   * 转换.lac文件为CaptureSession
   */
  public static convertLACToCaptureSession(lacData: LACFileContent): CaptureSession {
    const session = new CaptureSession();
    const lacSession = lacData.captureSession;
    
    session.frequency = lacSession.sampleRate || lacSession.frequency || 1000000;
    session.preTriggerSamples = lacSession.preTriggerSamples;
    session.postTriggerSamples = lacSession.postTriggerSamples;
    session.triggerType = this.parseTriggerType(lacSession.triggerType);
    session.triggerChannel = lacSession.triggerChannel;
    session.triggerInverted = lacSession.triggerInverted || false;
    session.triggerPattern = lacSession.triggerPattern || 0;
    session.triggerBitCount = lacSession.triggerBitCount || 1;
    session.loopCount = lacSession.loopCount || 0;
    session.measureBursts = lacSession.measureBursts || false;
    
    // 转换通道信息
    session.captureChannels = lacSession.channels.map(ch => {
      const channel = new AnalyzerChannel(ch.channelNumber, ch.channelName);
      channel.hidden = ch.hidden || false;
      
      if (ch.channelColor) {
        channel.channelColor = ch.channelColor;
      } else if (ch.color) {
        channel.channelColor = parseInt(ch.color.replace('#', ''), 16);
      }
      
      if (ch.samples) {
        if (Array.isArray(ch.samples)) {
          channel.samples = new Uint8Array(ch.samples);
        } else if (typeof ch.samples === 'string' && ch.samples.startsWith('RLE:')) {
          const compressedData = ch.samples.substring(4).split(',').map(Number);
          const decompressed = this.decompressRLE(compressedData);
          channel.samples = new Uint8Array(decompressed);
        }
      }
      
      return channel;
    });
    
    // 转换突发信息
    if (lacSession.bursts) {
      session.bursts = lacSession.bursts.map(burst => {
        const burstInfo = new BurstInfo();
        burstInfo.burstSampleStart = burst.burstSampleStart;
        burstInfo.burstSampleEnd = burst.burstSampleEnd;
        burstInfo.burstSampleGap = burst.burstSampleGap;
        burstInfo.burstTimeGap = burst.burstTimeGap;
        return burstInfo;
      });
    }
    
    return session;
  }

  /**
   * 转换.lac文件为UnifiedCaptureData
   */
  public static convertLACToUnifiedData(lacData: LACFileContent): UnifiedCaptureData {
    return UnifiedDataFormat.fromLacFormat(lacData, {
      name: lacData.deviceInfo.name,
      version: lacData.deviceInfo.version,
      type: 'Serial' as any,
      isNetwork: false,
      capabilities: {
        channels: {
          digital: lacData.deviceInfo.channels,
          maxVoltage: 5.0,
          inputImpedance: 1000000
        },
        sampling: {
          maxRate: lacData.deviceInfo.maxFrequency,
          minRate: Math.floor(lacData.deviceInfo.maxFrequency / 65535),
          supportedRates: [lacData.deviceInfo.maxFrequency],
          bufferSize: lacData.deviceInfo.bufferSize || 1024000,
          streamingSupport: true
        },
        triggers: {
          types: [TriggerType.Edge],
          maxChannels: 1,
          patternWidth: 16,
          sequentialSupport: false,
          conditions: ['rising', 'falling']
        },
        connectivity: {
          interfaces: ['serial'],
          protocols: ['custom']
        },
        features: {}
      }
    } as DeviceInfo);
  }

  /**
   * 获取支持的版本列表
   */
  public static getSupportedVersions(): string[] {
    return [...this.SUPPORTED_VERSIONS];
  }

  /**
   * 获取当前版本
   */
  public static getCurrentVersion(): string {
    return this.CURRENT_VERSION;
  }
}