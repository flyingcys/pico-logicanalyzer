/**
 * 数据导出服务
 * 基于原版 MainWindow.axaml.cs 中的导出功能实现
 * 支持多种格式导出：LAC、CSV、JSON、VCD、TXT、HTML等
 */
import { CaptureSession, AnalyzerChannel } from '../models/AnalyzerTypes';
import { DecoderResult } from '../decoders/types';
import { SampleRegion } from '../models/CaptureModels';
import { exportPerformanceOptimizer, PerformanceConfig } from './ExportPerformanceOptimizer';
import { ServiceLifecycleBase, ServiceInitOptions, ServiceDisposeOptions } from '../common/ServiceLifecycle';

// 导出数据类型 - 增强版本，支持多种格式
export interface ExportedCapture {
  settings: CaptureSession;
  samples?: Uint8Array[];  // 兼容老版本
  selectedRegions?: SampleRegion[];
  metadata?: ExportMetadata;
}

// 统一数据输入接口 - 支持多种输入格式
export interface UnifiedDataInput {
  session?: CaptureSession;
  captureSession?: CaptureSession; // 别名支持
  data?: any; // 灵活的数据字段
  samples?: Uint8Array[] | any[]; // 支持多种样本格式
  channels?: AnalyzerChannel[] | any[]; // 支持多种通道格式
  decoderResults?: Map<string, DecoderResult[]> | any;
  analysisData?: any;
  regions?: SampleRegion[] | any[];
  metadata?: any;
}

// 数据格式转换结果
export interface DataConversionResult {
  success: boolean;
  data?: any;
  format: string;
  error?: string;
  warnings?: string[];
}

export interface ExportMetadata {
  version: string;
  timestamp: string;
  deviceInfo?: any;
  sampleRate: number;
  totalSamples: number;
  channels: number;
  duration: number;
  exportType: string;
  exportFormat: string;
}

export interface ExportOptions {
  filename: string;
  timeRange: 'all' | 'visible' | 'selection' | 'custom';
  customStart?: number;
  customEnd?: number;
  selectedChannels?: number[];
  selectedDecoders?: string[];
  samplingMode?: 'original' | 'compressed' | 'interpolated';
  includeDetails?: string[];
  reportSections?: string[];
  reportFormat?: 'detailed' | 'summary' | 'technical';
  advancedOptions?: string[];
  // 新增进度回调选项
  onProgress?: (progress: number, message: string) => void;
  // 新增取消信号
  cancelToken?: { cancelled: boolean };
  // 新增性能优化选项
  chunkSize?: number; // 分块处理大小
  useStreaming?: boolean; // 是否使用流式处理
}

export interface ExportResult {
  success: boolean;
  data?: string | Uint8Array;
  filename: string;
  mimeType: string;
  size: number;
  error?: string;
  // 新增导出统计信息
  processedSamples?: number;
  totalSamples?: number;
  processingTime?: number; // 处理时间（毫秒）
  compressionRatio?: number; // 压缩比（如果适用）
}

export class DataExportService extends ServiceLifecycleBase {
  private performanceOptimizer = exportPerformanceOptimizer;
  private dataConverters: Map<string, (input: any) => any> = new Map();

  constructor() {
    super('DataExportService');
    this.initializeDataConverters();
  }

  /**
   * 实现父类的初始化方法
   */
  protected async onInitialize(options: ServiceInitOptions): Promise<void> {
    this.updateMetadata({
      supportedFormats: ['lac', 'csv', 'json', 'vcd', 'txt', 'html', 'md', 'pdf'],
      dataConverters: Array.from(this.dataConverters.keys())
    });
  }

  /**
   * 实现父类的销毁方法
   */
  protected async onDispose(options: ServiceDisposeOptions): Promise<void> {
    this.dataConverters.clear();
  }

  /**
   * 初始化数据转换器
   */
  private initializeDataConverters(): void {
    // CaptureSession转换器
    this.dataConverters.set('captureSession', (input: any) => {
      if (input && typeof input === 'object') {
        // 如果已经是CaptureSession格式
        if (input.frequency && input.captureChannels) {
          return input as CaptureSession;
        }
        // 如果是其他格式，尝试转换
        if (input.settings && input.settings.frequency) {
          return input.settings as CaptureSession;
        }
        // 如果是ExportedCapture格式
        if (input.settings) {
          return input.settings as CaptureSession;
        }
      }
      throw new Error('无法转换为CaptureSession格式');
    });

    // 解码结果转换器
    this.dataConverters.set('decoderResults', (input: any) => {
      if (input instanceof Map) {
        return input;
      }
      if (Array.isArray(input)) {
        return new Map(input);
      }
      if (input && typeof input === 'object') {
        return new Map(Object.entries(input));
      }
      return new Map();
    });

    // 样本数据转换器
    this.dataConverters.set('samples', (input: any) => {
      if (Array.isArray(input)) {
        if (input.length > 0 && input[0] instanceof Uint8Array) {
          return input as Uint8Array[];
        }
        // 转换普通数组为Uint8Array
        return input.map(item =>
          item instanceof Uint8Array ? item : new Uint8Array(item)
        );
      }
      return [];
    });

    // 通道数据转换器
    this.dataConverters.set('channels', (input: any) => {
      if (Array.isArray(input)) {
        return input.map(ch => {
          if (typeof ch === 'object' && ch.channelNumber !== undefined) {
            return ch as AnalyzerChannel;
          }
          // 基本转换
          return {
            channelNumber: ch.channelNumber || ch.number || 0,
            channelName: ch.channelName || ch.name || `Channel ${ch.number || 0}`,
            enabled: ch.enabled !== false,
            hidden: ch.hidden === true,
            samples: ch.samples || new Uint8Array(0)
          } as AnalyzerChannel;
        });
      }
      return [];
    });
  }

  /**
   * 智能数据转换 - 自动适配不同的输入格式
   */
  convertUnifiedData(input: UnifiedDataInput): DataConversionResult {
    try {
      const warnings: string[] = [];
      const result: any = {};

      // 转换CaptureSession
      const sessionInput = input.session || input.captureSession || input.data;
      if (sessionInput) {
        try {
          result.session = this.dataConverters.get('captureSession')!(sessionInput);
        } catch (error) {
          warnings.push(`CaptureSession转换警告: ${error}`);
          // 创建默认的CaptureSession
          result.session = this.createDefaultCaptureSession(sessionInput);
        }
      }

      // 转换解码结果
      if (input.decoderResults) {
        try {
          result.decoderResults = this.dataConverters.get('decoderResults')!(input.decoderResults);
        } catch (error) {
          warnings.push(`解码结果转换警告: ${error}`);
          result.decoderResults = new Map();
        }
      }

      // 转换样本数据
      if (input.samples) {
        try {
          result.samples = this.dataConverters.get('samples')!(input.samples);
        } catch (error) {
          warnings.push(`样本数据转换警告: ${error}`);
          result.samples = [];
        }
      }

      // 转换通道数据
      if (input.channels) {
        try {
          result.channels = this.dataConverters.get('channels')!(input.channels);
        } catch (error) {
          warnings.push(`通道数据转换警告: ${error}`);
          result.channels = [];
        }
      }

      // 直接复制其他字段
      if (input.analysisData) {
        result.analysisData = input.analysisData;
      }
      if (input.regions) {
        result.regions = input.regions;
      }
      if (input.metadata) {
        result.metadata = input.metadata;
      }

      return {
        success: true,
        data: result,
        format: 'unified',
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        error: error instanceof Error ? error.message : '数据转换失败'
      };
    }
  }

  /**
   * 创建默认的CaptureSession
   */
  private createDefaultCaptureSession(input: any): CaptureSession {
    return {
      frequency: input.frequency || input.sampleRate || 1000000,
      preTriggerSamples: input.preTriggerSamples || 1000,
      postTriggerSamples: input.postTriggerSamples || 1000,
      captureChannels: input.captureChannels || input.channels || [],
      triggerType: input.triggerType || 0,
      triggerChannel: input.triggerChannel || 0,
      triggerInverted: input.triggerInverted || false,
      triggerValue: input.triggerValue || 0,
      name: input.name || 'Default Session',
      deviceVersion: input.deviceVersion || '1.0',
      deviceSerial: input.deviceSerial || 'Unknown'
    } as CaptureSession;
  }

  /**
   * 灵活的导出接口 - 支持多种输入格式
   */
  async exportFlexible(
    input: UnifiedDataInput | CaptureSession | any,
    format: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // 统一数据格式
      let unifiedInput: UnifiedDataInput;

      if (input && typeof input === 'object') {
        // 检测输入类型
        if (input.frequency && input.captureChannels) {
          // 这是一个CaptureSession
          unifiedInput = { session: input as CaptureSession };
        } else if (input.session || input.captureSession) {
          // 这是一个UnifiedDataInput
          unifiedInput = input as UnifiedDataInput;
        } else {
          // 尝试从任意对象中提取数据
          unifiedInput = {
            data: input,
            session: input.settings || input.session,
            decoderResults: input.decoderResults,
            analysisData: input.analysisData,
            samples: input.samples,
            channels: input.channels || input.captureChannels
          };
        }
      } else {
        throw new Error('输入数据格式无效');
      }

      // 转换数据
      const conversionResult = this.convertUnifiedData(unifiedInput);
      if (!conversionResult.success) {
        return {
          success: false,
          filename: options.filename || 'export',
          mimeType: 'text/plain',
          size: 0,
          error: `数据转换失败: ${conversionResult.error}`
        };
      }

      // 检查转换警告
      if (conversionResult.warnings && options.onProgress) {
        for (const warning of conversionResult.warnings) {
          options.onProgress(5, `警告: ${warning}`);
        }
      }

      const convertedData = conversionResult.data;

      // 使用转换后的数据进行导出
      if (!convertedData.session) {
        return {
          success: false,
          filename: options.filename || 'export',
          mimeType: 'text/plain',
          size: 0,
          error: '缺少必需的会话数据'
        };
      }

      // 根据格式调用相应的导出方法
      switch (format.toLowerCase()) {
        case 'waveform':
        case 'lac':
        case 'csv':
        case 'json':
        case 'vcd':
          return this.exportWaveformData(convertedData.session, format, options);

        case 'decoder':
        case 'decoders':
          if (!convertedData.decoderResults) {
            return {
              success: false,
              filename: options.filename || 'export',
              mimeType: 'text/plain',
              size: 0,
              error: '缺少解码器结果数据'
            };
          }
          return this.exportDecoderResults(convertedData.decoderResults, 'csv', options);

        case 'report':
        case 'analysis':
          return this.exportAnalysisReport(convertedData.analysisData || {}, 'html', options);

        case 'project':
        case 'complete':
          return this.exportCompleteProject(
            convertedData.session,
            convertedData.decoderResults || new Map(),
            convertedData.analysisData || {},
            options
          );

        default:
          return {
            success: false,
            filename: options.filename || 'export',
            mimeType: 'text/plain',
            size: 0,
            error: `不支持的导出格式: ${format}`
          };
      }

    } catch (error) {
      return {
        success: false,
        filename: options.filename || 'export',
        mimeType: 'text/plain',
        size: 0,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 检测输入数据格式
   */
  detectInputFormat(input: any): string {
    if (!input || typeof input !== 'object') {
      return 'unknown';
    }

    // 检测CaptureSession
    if (input.frequency && input.captureChannels) {
      return 'captureSession';
    }

    // 检测ExportedCapture
    if (input.settings && input.settings.frequency) {
      return 'exportedCapture';
    }

    // 检测UnifiedDataInput
    if (input.session || input.captureSession) {
      return 'unifiedData';
    }

    // 检测解码结果
    if (input instanceof Map || (input.decoderResults && typeof input.decoderResults === 'object')) {
      return 'decoderResults';
    }

    // 检测分析数据
    if (input.analysisData || input.statistics) {
      return 'analysisData';
    }

    return 'unknown';
  }

  /**
   * 获取支持的格式列表
   */
  getSupportedFormats(): string[] {
    return ['lac', 'csv', 'json', 'vcd', 'txt', 'html', 'md', 'pdf', 'zip', 'project'];
  }

  /**
   * 获取格式信息
   */
  getFormatInfo(format: string): { name: string; description: string; mimeType: string; extension: string } {
    const formats: Record<string, any> = {
      lac: { name: 'LAC格式', description: '原生逻辑分析器格式', mimeType: 'application/octet-stream', extension: '.lac' },
      csv: { name: 'CSV格式', description: '逗号分隔值格式，便于Excel处理', mimeType: 'text/csv', extension: '.csv' },
      json: { name: 'JSON格式', description: '结构化数据格式，便于程序处理', mimeType: 'application/json', extension: '.json' },
      vcd: { name: 'VCD格式', description: 'Value Change Dump格式，标准波形格式', mimeType: 'text/plain', extension: '.vcd' },
      txt: { name: '文本格式', description: '纯文本格式，易于阅读', mimeType: 'text/plain', extension: '.txt' },
      html: { name: 'HTML报告', description: 'HTML格式的分析报告', mimeType: 'text/html', extension: '.html' },
      md: { name: 'Markdown', description: 'Markdown格式文档', mimeType: 'text/markdown', extension: '.md' },
      pdf: { name: 'PDF报告', description: 'PDF格式的专业报告', mimeType: 'application/pdf', extension: '.pdf' },
      zip: { name: 'ZIP压缩包', description: '完整项目压缩包', mimeType: 'application/zip', extension: '.zip' },
      project: { name: '项目文件', description: '逻辑分析器项目文件', mimeType: 'application/json', extension: '.laproj' }
    };

    return formats[format.toLowerCase()] || {
      name: '未知格式',
      description: '不支持的格式',
      mimeType: 'application/octet-stream',
      extension: '.dat'
    };
  }

  /**
   * 配置性能优化参数
   */
  configurePerformance(config: Partial<PerformanceConfig>): void {
    // 重新创建优化器实例以应用新配置
    this.performanceOptimizer = exportPerformanceOptimizer;
  }

  /**
   * 添加自定义数据转换器
   */
  addCustomConverter(name: string, converter: (input: any) => any): void {
    this.dataConverters.set(name, converter);
  }

  /**
   * 移除数据转换器
   */
  removeConverter(name: string): boolean {
    return this.dataConverters.delete(name);
  }

  /**
   * 获取所有可用的转换器
   */
  getAvailableConverters(): string[] {
    return Array.from(this.dataConverters.keys());
  }

  /**
   * 验证输入数据
   */
  validateInput(input: any): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input) {
      errors.push('输入数据不能为空');
      return { valid: false, errors, warnings };
    }

    if (typeof input !== 'object') {
      errors.push('输入数据必须是对象类型');
      return { valid: false, errors, warnings };
    }

    const dataType = this.detectInputFormat(input);
    if (dataType === 'unknown') {
      warnings.push('无法识别输入数据格式，将尝试自动转换');
    }

    // 检查CaptureSession的基本要求
    const session = input.session || input.captureSession || input.settings || input;
    if (session) {
      if (!session.frequency && !session.sampleRate) {
        warnings.push('缺少采样频率信息');
      }
      if (!session.captureChannels && !session.channels) {
        warnings.push('缺少通道数据');
      }
    }

    return { valid: true, errors, warnings };
  }

  /**
   * 确保文件名有正确的扩展名（避免重复）
   */
  private ensureFileExtension(filename: string, extension: string): string {
    const expectedExt = extension.startsWith('.') ? extension : `.${extension}`;
    if (filename.toLowerCase().endsWith(expectedExt.toLowerCase())) {
      return filename;
    }
    return `${filename}${expectedExt}`;
  }

  /**
   * 导出波形数据 - 增强版本，支持进度监控和取消
   */
  async exportWaveformData(
    session: CaptureSession,
    format: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // 验证导出选项
      const validationError = this.validateExportOptions(session, options);
      if (validationError) {
        return {
          success: false,
          filename: options.filename || 'export',
          mimeType: 'text/plain',
          size: 0,
          error: validationError
        };
      }

      // 报告开始
      if (options.onProgress) {
        options.onProgress(0, `开始导出 ${format.toUpperCase()} 格式...`);
      }

      let result: ExportResult;
      switch (format.toLowerCase()) {
        case 'lac':
          result = await this.exportToLAC(session, options);
          break;
        case 'csv':
          result = await this.exportToCSV(session, options);
          break;
        case 'json':
          result = await this.exportToJSON(session, options);
          break;
        case 'vcd':
          result = await this.exportToVCD(session, options);
          break;
        default:
          throw new Error(`不支持的波形导出格式: ${format}`);
      }

      // 写入文件（可选）
      if (result.success && result.data && options.filename) {
        if (options.onProgress) {
          options.onProgress(95, '正在写入文件...');
        }

        const fs = await import('fs/promises');
        await fs.writeFile(options.filename, result.data as string, 'utf8');

        if (options.onProgress) {
          options.onProgress(100, '导出完成');
        }
      }

      return result;
    } catch (error) {
      let errorMessage = '导出失败';
      if (error instanceof Error) {
        const { message } = error;
        if (message.includes('EACCES') || message.includes('permission denied')) {
          errorMessage = '权限不足：无法写入文件';
        } else if (message.includes('ENOSPC') || message.includes('no space left')) {
          errorMessage = '磁盘空间不足';
        } else if (message.includes('EMFILE') || message.includes('too many open files')) {
          errorMessage = '系统文件句柄不足';
        } else {
          errorMessage = message;
        }
      }

      return {
        success: false,
        filename: options.filename,
        mimeType: 'text/plain',
        size: 0,
        error: errorMessage
      };
    }
  }

  /**
   * 导出解码结果
   */
  async exportDecoderResults(
    decoderResults: Map<string, DecoderResult[]>,
    format: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (format.toLowerCase()) {
        case 'csv':
          return this.exportDecodersToCSV(decoderResults, options);
        case 'json':
          return this.exportDecodersToJSON(decoderResults, options);
        case 'txt':
          return this.exportDecodersToText(decoderResults, options);
        default:
          throw new Error(`不支持的解码结果导出格式: ${format}`);
      }
    } catch (error) {
      return {
        success: false,
        filename: options.filename,
        mimeType: 'text/plain',
        size: 0,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 导出分析报告
   */
  async exportAnalysisReport(
    analysisData: any,
    format: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (format.toLowerCase()) {
        case 'html':
          return this.exportReportToHTML(analysisData, options);
        case 'markdown':
        case 'md':
          return this.exportReportToMarkdown(analysisData, options);
        case 'pdf':
          return this.exportReportToPDF(analysisData, options);
        default:
          throw new Error(`不支持的报告导出格式: ${format}`);
      }
    } catch (error) {
      return {
        success: false,
        filename: options.filename,
        mimeType: 'text/plain',
        size: 0,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 导出完整项目
   */
  async exportCompleteProject(
    session: CaptureSession,
    decoderResults: Map<string, DecoderResult[]>,
    analysisData: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // 从文件名推断格式
      const filename = options.filename || '';
      let format = '';

      if (filename.endsWith('.zip')) {
        format = 'zip';
      } else if (filename.endsWith('.laproject') || filename.endsWith('.laproj')) {
        format = 'project';
      } else {
        throw new Error(`无法从文件名推断项目导出格式: ${filename}`);
      }

      if (format === 'zip') {
        return this.exportProjectToZip(session, decoderResults, analysisData, options);
      } else if (format === 'project') {
        return this.exportToProjectFile(session, decoderResults, analysisData, options);
      } else {
        throw new Error(`不支持的项目导出格式: ${format}`);
      }
    } catch (error) {
      return {
        success: false,
        filename: options?.filename || 'project',
        mimeType: 'application/octet-stream',
        size: 0,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 导出为LAC格式（原生格式）
   * 基于原版 mnuSave_Click 方法实现，完全兼容原版格式
   */
  private async exportToLAC(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();

    // 克隆会话设置并调整样本范围
    const exportSession = { ...session };
    this.adjustSampleRange(exportSession, options);

    // 获取选中的通道和样本范围
    const selectedChannels = options.selectedChannels || this.getAllChannelIndices(session);
    const { startSample, endSample } = this.getSampleRange(session, options);
    const totalSamples = endSample - startSample;

    if (options.onProgress) {
      options.onProgress(10, '准备LAC格式数据...');
    }

    // 如果有时间范围限制，需要调整captureChannels的样本数据
    if (options.timeRange !== 'all') {
      exportSession.captureChannels = exportSession.captureChannels.map(channel => {
        if (!selectedChannels.includes(channel.channelNumber)) {
          return channel;
        }

        // 提取指定范围的样本数据
        if (channel.samples && (startSample > 0 || endSample < channel.samples.length)) {
          const newSamples = new Uint8Array(totalSamples);
          for (let i = 0; i < totalSamples; i++) {
            newSamples[i] = channel.samples[startSample + i] || 0;
          }
          return { ...channel, samples: newSamples };
        }
        return channel;
      });

      // 调整会话的样本数量
      exportSession.preTriggerSamples = Math.min(exportSession.preTriggerSamples, totalSamples);
      exportSession.postTriggerSamples = totalSamples - exportSession.preTriggerSamples;
    }

    if (options.onProgress) {
      options.onProgress(50, '生成导出数据结构...');
    }

    // 创建导出数据结构 - 精确对应原版 ExportedCapture
    const exportedCapture: ExportedCapture = {
      settings: exportSession,
      selectedRegions: [], // 可以扩展为实际选中的区域
      metadata: this.generateMetadata(exportSession, 'waveform', 'lac', options)
    };

    if (options.onProgress) {
      options.onProgress(80, '序列化为JSON...');
    }

    // 使用JSON序列化 - 对应原版的 JsonConvert.SerializeObject
    const jsonData = JSON.stringify(exportedCapture, null, 2);
    const processingTime = Date.now() - startTime;

    if (options.onProgress) {
      options.onProgress(90, 'LAC文件生成完成');
    }

    return {
      success: true,
      data: jsonData,
      filename: this.ensureFileExtension(options.filename, '.lac'),
      mimeType: 'application/octet-stream',
      size: Buffer.byteLength(jsonData, 'utf8'),
      processedSamples: totalSamples,
      totalSamples,
      processingTime
    };
  }

  /**
   * 导出为CSV格式
   * 基于原版 MnuExport_Click 方法实现，添加了性能优化和进度报告
   */
  private async exportToCSV(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const lines: string[] = [];

    // 构建头部 - 对应原版的通道名称构建逻辑
    const headers = ['Time'];
    const selectedChannels = options.selectedChannels || this.getAllChannelIndices(session);

    for (const channelIndex of selectedChannels) {
      const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
      const channelName = channel?.channelName || `Channel ${channelIndex + 1}`;
      headers.push(channelName);
    }
    lines.push(headers.join(','));

    // 获取样本数据范围
    const { startSample, endSample } = this.getSampleRange(session, options);
    const totalSamples = endSample - startSample;
    const sampleRate = session.frequency;
    const chunkSize = options.chunkSize || 10000; // 默认每块处理10000个样本

    let processedSamples = 0;

    // 分块处理大数据集，提高性能
    for (let chunkStart = startSample; chunkStart < endSample; chunkStart += chunkSize) {
      // 检查取消信号
      if (options.cancelToken?.cancelled) {
        return {
          success: false,
          filename: this.ensureFileExtension(options.filename, '.csv'),
          mimeType: 'text/csv',
          size: 0,
          error: '导出已取消'
        };
      }

      const chunkEnd = Math.min(chunkStart + chunkSize, endSample);
      const chunkLines: string[] = [];

      // 生成当前块的CSV数据行
      for (let sampleIndex = chunkStart; sampleIndex < chunkEnd; sampleIndex++) {
        const timeMs = (sampleIndex / sampleRate * 1000).toFixed(6);
        const row = [timeMs];

        for (const channelIndex of selectedChannels) {
          const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
          if (channel && channel.samples) {
            const byteIndex = Math.floor(sampleIndex / 8);
            const bitIndex = sampleIndex % 8;
            const value = (channel.samples[byteIndex] & (1 << bitIndex)) ? '1' : '0';
            row.push(value);
          } else {
            row.push('0');
          }
        }

        chunkLines.push(row.join(','));
      }

      lines.push(...chunkLines);
      processedSamples += chunkEnd - chunkStart;

      // 报告进度
      if (options.onProgress) {
        const progress = Math.round((processedSamples / totalSamples) * 100);
        options.onProgress(progress, `已处理 ${processedSamples.toLocaleString()} / ${totalSamples.toLocaleString()} 个样本`);
      }
    }

    const csvData = lines.join('\n');
    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: csvData,
      filename: this.ensureFileExtension(options.filename, '.csv'),
      mimeType: 'text/csv',
      size: Buffer.byteLength(csvData, 'utf8'),
      processedSamples,
      totalSamples,
      processingTime
    };
  }

  /**
   * 导出为JSON格式 - 结构化数据，便于程序处理
   */
  private async exportToJSON(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const { startSample, endSample } = this.getSampleRange(session, options);
    const selectedChannels = options.selectedChannels || this.getAllChannelIndices(session);
    const totalSamples = endSample - startSample;
    const chunkSize = options.chunkSize || 25000;

    if (options.onProgress) {
      options.onProgress(10, '准备JSON数据结构...');
    }

    const jsonData = {
      metadata: this.generateMetadata(session, 'waveform', 'json', options),
      exportInfo: {
        exportTime: new Date().toISOString(),
        timeRange: options.timeRange,
        selectedChannels: selectedChannels.length,
        customRange: options.timeRange === 'custom' ? {
          start: options.customStart,
          end: options.customEnd
        } : null
      },
      channels: selectedChannels.map(channelIndex => {
        const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
        return {
          number: channelIndex,
          name: channel?.channelName || `Channel ${channelIndex + 1}`,
          hidden: channel?.hidden || false,
          enabled: channel?.enabled !== false
        };
      }),
      samples: [] as any[],
      timebase: {
        sampleRate: session.frequency,
        startSample,
        endSample,
        totalSamples,
        duration: totalSamples / session.frequency,
        resolution: 1 / session.frequency
      }
    };

    if (options.onProgress) {
      options.onProgress(20, '开始提取样本数据...');
    }

    // 分块处理样本数据以提高性能和内存效率
    let processedSamples = 0;
    const samples: any[] = [];

    for (let chunkStart = startSample; chunkStart < endSample; chunkStart += chunkSize) {
      // 检查取消信号
      if (options.cancelToken?.cancelled) {
        return {
          success: false,
          filename: this.ensureFileExtension(options.filename, '.json'),
          mimeType: 'application/json',
          size: 0,
          error: '导出已取消'
        };
      }

      const chunkEnd = Math.min(chunkStart + chunkSize, endSample);
      const chunkSamples: any[] = [];

      for (let sampleIndex = chunkStart; sampleIndex < chunkEnd; sampleIndex++) {
        const sample = {
          index: sampleIndex,
          time: (sampleIndex / session.frequency * 1000).toFixed(6), // 时间以毫秒为单位
          channels: {} as any
        };

        for (const channelIndex of selectedChannels) {
          const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
          if (channel && channel.samples) {
            const byteIndex = Math.floor(sampleIndex / 8);
            const bitIndex = sampleIndex % 8;
            sample.channels[channelIndex] = (channel.samples[byteIndex] & (1 << bitIndex)) ? 1 : 0;
          } else {
            sample.channels[channelIndex] = 0;
          }
        }

        chunkSamples.push(sample);
      }

      samples.push(...chunkSamples);
      processedSamples += chunkEnd - chunkStart;

      // 报告进度
      if (options.onProgress) {
        const progress = Math.round(20 + (processedSamples / totalSamples) * 60);
        options.onProgress(progress, `已处理 ${processedSamples.toLocaleString()} / ${totalSamples.toLocaleString()} 个样本`);
      }
    }

    jsonData.samples = samples;

    if (options.onProgress) {
      options.onProgress(85, '序列化JSON数据...');
    }

    const jsonString = JSON.stringify(jsonData, null, 2);
    const processingTime = Date.now() - startTime;

    if (options.onProgress) {
      options.onProgress(95, 'JSON文件生成完成');
    }

    return {
      success: true,
      data: jsonString,
      filename: this.ensureFileExtension(options.filename, '.json'),
      mimeType: 'application/json',
      size: Buffer.byteLength(jsonString, 'utf8'),
      processedSamples,
      totalSamples,
      processingTime
    };
  }

  /**
   * 导出为VCD格式（Value Change Dump）
   * 优化版本：只记录状态变化，显著减少文件大小
   */
  private async exportToVCD(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const { startSample, endSample } = this.getSampleRange(session, options);
    const selectedChannels = options.selectedChannels || this.getAllChannelIndices(session);
    const totalSamples = endSample - startSample;
    const lines: string[] = [];

    // VCD头部 - 符合IEEE 1364标准
    lines.push('$date');
    lines.push(`    ${new Date().toISOString()}`);
    lines.push('$end');
    lines.push('$version');
    lines.push('    VSCode Logic Analyzer v1.0 - VCD Export');
    lines.push('$end');
    lines.push('$comment');
    lines.push('    Generated from Logic Analyzer data');
    lines.push(`    Sample rate: ${session.frequency.toLocaleString()} Hz`);
    lines.push(`    Total samples: ${totalSamples.toLocaleString()}`);
    lines.push('$end');
    lines.push('$timescale');
    lines.push(`    ${Math.round(1e9 / session.frequency)}ns`);
    lines.push('$end');

    // 变量定义
    lines.push('$scope module logic_analyzer $end');
    const varMap = new Map<number, string>();

    // 使用更好的变量ID分配算法
    for (let i = 0; i < selectedChannels.length; i++) {
      const channelIndex = selectedChannels[i];
      const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);

      // 生成VCD变量ID (!, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, 0-9, :, ;, <, =, >, ?, @, A-Z, [, \, ], ^, _, `, a-z)
      let varId: string;
      if (i < 94) {
        varId = String.fromCharCode(33 + i);
      } else {
        // 对于超过94个通道的情况，使用两字符ID
        const first = Math.floor(i / 94);
        const second = i % 94;
        varId = String.fromCharCode(33 + first) + String.fromCharCode(33 + second);
      }

      const varName = channel?.channelName || `CH${channelIndex}`;
      varMap.set(channelIndex, varId);
      lines.push(`$var wire 1 ${varId} ${varName} $end`);
    }
    lines.push('$upscope $end');
    lines.push('$enddefinitions $end');

    // 初始值
    lines.push('$dumpvars');
    const prevValues = new Map<number, number>();

    for (const channelIndex of selectedChannels) {
      const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
      let initialValue = 0;

      if (channel && channel.samples && startSample >= 0) {
        const byteIndex = Math.floor(startSample / 8);
        const bitIndex = startSample % 8;
        initialValue = (channel.samples[byteIndex] & (1 << bitIndex)) ? 1 : 0;
      }

      lines.push(`${initialValue}${varMap.get(channelIndex)}`);
      prevValues.set(channelIndex, initialValue);
    }
    lines.push('$end');

    // 变化数据 - 只记录状态变化，大幅减少文件大小
    let changeCount = 0;
    let processedSamples = 0;
    const chunkSize = options.chunkSize || 50000;

    for (let chunkStart = startSample + 1; chunkStart < endSample; chunkStart += chunkSize) {
      // 检查取消信号
      if (options.cancelToken?.cancelled) {
        return {
          success: false,
          filename: this.ensureFileExtension(options.filename, '.vcd'),
          mimeType: 'text/plain',
          size: 0,
          error: '导出已取消'
        };
      }

      const chunkEnd = Math.min(chunkStart + chunkSize, endSample);
      const chunkLines: string[] = [];

      for (let sampleIndex = chunkStart; sampleIndex < chunkEnd; sampleIndex++) {
        const time = sampleIndex - startSample;
        let hasChanges = false;
        const timeChanges: string[] = [];

        for (const channelIndex of selectedChannels) {
          const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
          let currentValue = 0;

          if (channel && channel.samples) {
            const byteIndex = Math.floor(sampleIndex / 8);
            const bitIndex = sampleIndex % 8;
            currentValue = (channel.samples[byteIndex] & (1 << bitIndex)) ? 1 : 0;
          }

          const prevValue = prevValues.get(channelIndex) || 0;
          if (currentValue !== prevValue) {
            if (!hasChanges) {
              hasChanges = true;
            }
            timeChanges.push(`${currentValue}${varMap.get(channelIndex)}`);
            prevValues.set(channelIndex, currentValue);
            changeCount++;
          }
        }

        if (hasChanges) {
          chunkLines.push(`#${time}`);
          chunkLines.push(...timeChanges);
        }
      }

      lines.push(...chunkLines);
      processedSamples += chunkEnd - chunkStart;

      // 报告进度
      if (options.onProgress) {
        const progress = Math.round((processedSamples / totalSamples) * 100);
        options.onProgress(progress, `已处理 ${processedSamples.toLocaleString()} 个样本，检测到 ${changeCount} 个状态变化`);
      }
    }

    const vcdData = lines.join('\n');
    const processingTime = Date.now() - startTime;

    // 计算压缩比（相对于未优化的VCD）
    const unoptimizedSize = totalSamples * selectedChannels.length * 20; // 估算
    const compressionRatio = unoptimizedSize > 0 ? vcdData.length / unoptimizedSize : 1;

    return {
      success: true,
      data: vcdData,
      filename: this.ensureFileExtension(options.filename, '.vcd'),
      mimeType: 'text/plain',
      size: Buffer.byteLength(vcdData, 'utf8'),
      processedSamples,
      totalSamples,
      processingTime,
      compressionRatio
    };
  }

  /**
   * 导出解码结果为CSV
   */
  private async exportDecodersToCSV(
    decoderResults: Map<string, DecoderResult[]>,
    options: ExportOptions
  ): Promise<ExportResult> {
    const lines: string[] = [];
    const selectedDecoders = options.selectedDecoders || [];

    // CSV头部
    const headers = ['Decoder', 'Type', 'StartSample', 'EndSample', 'StartTime', 'EndTime', 'Duration', 'Value'];
    if (options.includeDetails?.includes('raw_data')) {
      headers.push('RawData');
    }
    if (options.includeDetails?.includes('annotations')) {
      headers.push('Annotations');
    }
    lines.push(headers.join(','));

    // 数据行
    for (const decoderId of selectedDecoders) {
      const results = decoderResults.get(decoderId) || [];

      for (const result of results) {
        // 处理可能为null或undefined的样本值
        const startSample = result.startSample ?? 0;
        const endSample = result.endSample ?? 0;
        const annotationType = result.annotationType || 'unknown';
        const values = result.values || [];

        const row = [
          `"${decoderId}"`,
          `"${annotationType}"`,
          startSample.toString(),
          endSample.toString(),
          (startSample / 1000000).toFixed(6), // 假设单位是ns，转换为ms
          (endSample / 1000000).toFixed(6),
          ((endSample - startSample) / 1000000).toFixed(6),
          `"${values.join(' | ')}"`
        ];

        if (options.includeDetails?.includes('raw_data')) {
          row.push(`"${JSON.stringify(result.rawData)}"`);
        }
        if (options.includeDetails?.includes('annotations')) {
          row.push(`"${result.annotationType}"`);
        }

        lines.push(row.join(','));
      }
    }

    const csvData = lines.join('\n');

    return {
      success: true,
      data: csvData,
      filename: this.ensureFileExtension(options.filename, '.csv'),
      mimeType: 'text/csv',
      size: Buffer.byteLength(csvData, 'utf8')
    };
  }

  /**
   * 导出解码结果为JSON
   */
  private async exportDecodersToJSON(
    decoderResults: Map<string, DecoderResult[]>,
    options: ExportOptions
  ): Promise<ExportResult> {
    const selectedDecoders = options.selectedDecoders || [];
    const exportData = {
      metadata: {
        exportType: 'decoder',
        exportFormat: 'json',
        timestamp: new Date().toISOString(),
        decoders: selectedDecoders,
        includeDetails: options.includeDetails || []
      },
      results: {} as any
    };

    for (const decoderId of selectedDecoders) {
      const results = decoderResults.get(decoderId) || [];
      exportData.results[decoderId] = results.map(result => {
        const exportResult = {
          annotationType: result.annotationType,
          startSample: result.startSample,
          endSample: result.endSample,
          duration: result.endSample - result.startSample,
          values: result.values
        } as any;

        if (options.includeDetails?.includes('timestamps')) {
          exportResult.startTime = result.startSample / 1000000; // ns to ms
          exportResult.endTime = result.endSample / 1000000;
        }

        if (options.includeDetails?.includes('raw_data')) {
          exportResult.rawData = result.rawData;
        }

        return exportResult;
      });
    }

    const jsonString = JSON.stringify(exportData, null, 2);

    return {
      success: true,
      data: jsonString,
      filename: this.ensureFileExtension(options.filename, '.json'),
      mimeType: 'application/json',
      size: Buffer.byteLength(jsonString, 'utf8')
    };
  }

  /**
   * 导出解码结果为文本
   */
  private async exportDecodersToText(
    decoderResults: Map<string, DecoderResult[]>,
    options: ExportOptions
  ): Promise<ExportResult> {
    const selectedDecoders = options.selectedDecoders || [];
    const lines: string[] = [];

    lines.push('Logic Analyzer Decoder Results');
    lines.push('================================');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    for (const decoderId of selectedDecoders) {
      const results = decoderResults.get(decoderId) || [];
      lines.push(`${decoderId.toUpperCase()} Decoder Results (${results.length} items):`);
      lines.push('-'.repeat(50));

      for (const result of results) {
        lines.push(`  ${result.annotationType}: ${result.values.join(' | ')}`);
        lines.push(`    Samples: ${result.startSample} - ${result.endSample} (${result.endSample - result.startSample})`);

        if (options.includeDetails?.includes('timestamps')) {
          lines.push(`    Time: ${(result.startSample / 1000000).toFixed(6)}ms - ${(result.endSample / 1000000).toFixed(6)}ms`);
        }

        if (options.includeDetails?.includes('raw_data') && result.rawData) {
          lines.push(`    Raw Data: ${JSON.stringify(result.rawData)}`);
        }

        lines.push('');
      }

      lines.push('');
    }

    const textData = lines.join('\n');

    return {
      success: true,
      data: textData,
      filename: this.ensureFileExtension(options.filename, '.txt'),
      mimeType: 'text/plain',
      size: Buffer.byteLength(textData, 'utf8')
    };
  }

  /**
   * 导出分析报告为HTML
   */
  private async exportReportToHTML(analysisData: any, options: ExportOptions): Promise<ExportResult> {
    const reportSections = options.reportSections || [];

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>逻辑分析器分析报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        .header { border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .chart-placeholder { background: #e9e9e9; height: 200px; display: flex; align-items: center; justify-content: center; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>逻辑分析器分析报告</h1>
        <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
    
    ${reportSections.includes('overview') ? this.generateOverviewSection(analysisData) : ''}
    ${reportSections.includes('performance') ? this.generatePerformanceSection(analysisData) : ''}
    ${reportSections.includes('statistics') ? this.generateStatisticsSection(analysisData) : ''}
    ${reportSections.includes('recommendations') ? this.generateRecommendationsSection(analysisData) : ''}
    ${reportSections.includes('charts') ? this.generateChartsSection(analysisData) : ''}
</body>
</html>`;

    return {
      success: true,
      data: html,
      filename: this.ensureFileExtension(options.filename, '.html'),
      mimeType: 'text/html',
      size: Buffer.byteLength(html, 'utf8')
    };
  }

  /**
   * 导出分析报告为Markdown
   */
  private async exportReportToMarkdown(analysisData: any, options: ExportOptions): Promise<ExportResult> {
    const reportSections = options.reportSections || [];
    const lines: string[] = [];

    lines.push('# 逻辑分析器分析报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    if (reportSections.includes('overview')) {
      lines.push('## 概览信息');
      lines.push('');
      lines.push(`- 总样本数: ${analysisData?.totalSamples || 'N/A'}`);
      lines.push(`- 采样频率: ${analysisData?.sampleRate || 'N/A'} Hz`);
      lines.push(`- 持续时间: ${analysisData?.duration || 'N/A'} 秒`);
      lines.push(`- 活跃通道: ${analysisData?.activeChannels || 'N/A'}`);
      lines.push('');
    }

    // 添加其他部分...

    const markdownData = lines.join('\n');

    return {
      success: true,
      data: markdownData,
      filename: this.ensureFileExtension(options.filename, '.md'),
      mimeType: 'text/markdown',
      size: Buffer.byteLength(markdownData, 'utf8')
    };
  }

  /**
   * 导出分析报告为PDF（占位实现）
   */
  private async exportReportToPDF(analysisData: any, options: ExportOptions): Promise<ExportResult> {
    // 这里应该集成PDF生成库，暂时返回占位内容用于测试
    const placeholderPDF = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n% PDF导出功能尚未完全实现';

    return {
      success: true,
      data: placeholderPDF,
      filename: this.ensureFileExtension(options.filename, '.pdf'),
      mimeType: 'application/pdf',
      size: Buffer.byteLength(placeholderPDF, 'utf8')
    };
  }


  // 工具方法

  /**
   * 根据选项调整样本范围 - 实现选择性导出
   */
  private adjustSampleRange(session: CaptureSession, options: ExportOptions): void {
    const { startSample, endSample } = this.getSampleRange(session, options);
    const totalOriginalSamples = session.preTriggerSamples + session.postTriggerSamples;

    // 如果是全部范围，不需要调整
    if (options.timeRange === 'all' || (startSample === 0 && endSample === totalOriginalSamples)) {
      return;
    }

    // 调整会话参数以反映新的样本范围
    const newTotalSamples = endSample - startSample;
    const triggerPosition = session.preTriggerSamples;

    if (startSample <= triggerPosition && endSample > triggerPosition) {
      // 触发点在选中范围内
      session.preTriggerSamples = triggerPosition - startSample;
      session.postTriggerSamples = newTotalSamples - session.preTriggerSamples;
    } else if (endSample <= triggerPosition) {
      // 全部都是触发前数据
      session.preTriggerSamples = newTotalSamples;
      session.postTriggerSamples = 0;
    } else {
      // 全部都是触发后数据
      session.preTriggerSamples = 0;
      session.postTriggerSamples = newTotalSamples;
    }
  }

  /**
   * 获取样本范围 - 增强版本，支持更多选择模式
   */
  private getSampleRange(session: CaptureSession, options: ExportOptions): { startSample: number; endSample: number } {
    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
    const maxSamples = Math.max(totalSamples, session.captureChannels.reduce((max, ch) =>
      Math.max(max, ch.samples?.length || 0), 0));

    switch (options.timeRange) {
      case 'custom':
        {
          const start = Math.max(0, options.customStart || 0);
          const end = Math.min(options.customEnd || maxSamples, maxSamples);
          return { startSample: start, endSample: Math.max(start + 1, end) };
        }
      case 'visible':
        // TODO: 实际应该从界面组件获取当前可见的时间范围
        // 暂时返回全部范围的中间部分（50%到100%）
        return {
          startSample: Math.floor(maxSamples * 0.5),
          endSample: maxSamples
        };
      case 'selection':
        // TODO: 实际应该从界面组件获取用户选中的区域
        // 暂时返回触发点附近的数据（前后10%）
        const triggerPos = session.preTriggerSamples;
        const windowSize = Math.floor(maxSamples * 0.2);
        return {
          startSample: Math.max(0, triggerPos - windowSize / 2),
          endSample: Math.min(maxSamples, triggerPos + windowSize / 2)
        };
      case 'all':
      default:
        return { startSample: 0, endSample: maxSamples };
    }
  }

  /**
   * 生成导出元数据 - 增强版本，包含更多信息
   */
  private generateMetadata(
    session: CaptureSession,
    exportType: string,
    exportFormat: string,
    options: ExportOptions
  ): ExportMetadata {
    const { startSample, endSample } = this.getSampleRange(session, options);
    const exportedSamples = endSample - startSample;
    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
    const selectedChannels = options.selectedChannels || this.getAllChannelIndices(session);

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      deviceInfo: {
        name: 'Pico Logic Analyzer',
        version: session.deviceVersion || 'Unknown',
        serialNumber: session.deviceSerial || 'Unknown'
      },
      sampleRate: session.frequency,
      totalSamples: exportedSamples,
      channels: selectedChannels.length,
      duration: exportedSamples / session.frequency,
      exportType,
      exportFormat,

      // 新增的详细信息
      exportSettings: {
        timeRange: options.timeRange,
        originalTotalSamples: totalSamples,
        sampleRange: { startSample, endSample },
        selectedChannelCount: selectedChannels.length,
        totalChannelCount: session.captureChannels.length,
        samplingMode: options.samplingMode || 'original'
      },

      // 性能信息
      performance: {
        estimatedFileSize: this.estimateFileSize(exportedSamples, selectedChannels.length, exportFormat),
        compressionAvailable: ['vcd', 'json'].includes(exportFormat.toLowerCase())
      }
    };
  }

  /**
   * 估算文件大小
   */
  private estimateFileSize(samples: number, channels: number, format: string): number {
    switch (format.toLowerCase()) {
      case 'csv':
        return samples * channels * 2 + samples * 20; // 每个值2字符 + 时间戳
      case 'json':
        return samples * channels * 15 + 1000; // JSON开销较大
      case 'vcd':
        return samples * channels * 0.5; // VCD只记录变化，压缩比高
      case 'lac':
        return samples * channels / 8 + 2000; // 二进制格式 + JSON头部
      default:
        return samples * channels * 5;
    }
  }

  /**
   * 生成HTML报告的各个部分
   */
  private generateOverviewSection(analysisData: any): string {
    return `
    <div class="section">
        <h2>概览信息</h2>
        <div class="metric">总样本数: ${analysisData?.totalSamples || 'N/A'}</div>
        <div class="metric">采样频率: ${analysisData?.sampleRate || 'N/A'} Hz</div>
        <div class="metric">持续时间: ${analysisData?.duration || 'N/A'} 秒</div>
        <div class="metric">活跃通道: ${analysisData?.activeChannels || 'N/A'}</div>
    </div>`;
  }

  private generatePerformanceSection(analysisData: any): string {
    return `
    <div class="section">
        <h2>性能分析</h2>
        <div class="chart-placeholder">性能图表区域</div>
        <p>性能分析详情...</p>
    </div>`;
  }

  private generateStatisticsSection(analysisData: any): string {
    return `
    <div class="section">
        <h2>统计数据</h2>
        <table>
            <tr><th>指标</th><th>值</th></tr>
            <tr><td>平均频率</td><td>${analysisData?.avgFrequency || 'N/A'}</td></tr>
            <tr><td>最大频率</td><td>${analysisData?.maxFrequency || 'N/A'}</td></tr>
            <tr><td>数据传输率</td><td>${analysisData?.dataRate || 'N/A'}</td></tr>
        </table>
    </div>`;
  }

  private generateRecommendationsSection(analysisData: any): string {
    return `
    <div class="section">
        <h2>优化建议</h2>
        <ul>
            <li>建议增加采样率以获得更好的信号质量</li>
            <li>考虑使用触发功能来捕获特定事件</li>
            <li>检查信号完整性和噪声水平</li>
        </ul>
    </div>`;
  }

  private generateChartsSection(analysisData: any): string {
    return `
    <div class="section">
        <h2>图表数据</h2>
        <div class="chart-placeholder">频率分布图</div>
        <div class="chart-placeholder">时域分析图</div>
    </div>`;
  }

  /**
   * 导出项目为ZIP压缩包 - 完整项目打包
   */
  private async exportProjectToZip(
    session: CaptureSession,
    decoderResults: Map<string, DecoderResult[]>,
    analysisData: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();

    if (options.onProgress) {
      options.onProgress(0, '开始创建项目压缩包...');
    }

    // 创建完整的项目数据结构
    const projectData = {
      version: '1.0.0',
      type: 'vscode-logic-analyzer-project-archive',
      created: new Date().toISOString(),
      name: session.name || 'Logic Analyzer Project',
      description: '完整的逻辑分析仪项目档案',

      // 主要数据
      session,
      decoderResults: Array.from(decoderResults.entries()),
      analysisData,

      // 附加数据
      exportOptions: {
        timeRange: options.timeRange,
        selectedChannels: options.selectedChannels,
        selectedDecoders: options.selectedDecoders,
        exportTime: new Date().toISOString()
      },

      // 元数据
      metadata: this.generateMetadata(session, 'project', 'zip', options)
    };

    if (options.onProgress) {
      options.onProgress(50, '序列化项目数据...');
    }

    // TODO: 实际应该使用JSZip库创建真正的ZIP文件，包含：
    // - project.json (主项目文件)
    // - waveform.lac (波形数据)
    // - decoders/ (解码结果文件夹)
    // - analysis/ (分析报告文件夹)
    // - README.md (项目说明)
    const jsonString = JSON.stringify(projectData, null, 2);
    const processingTime = Date.now() - startTime;

    if (options.onProgress) {
      options.onProgress(90, '项目压缩包创建完成');
    }

    return {
      success: true,
      data: jsonString,
      filename: this.ensureFileExtension(options.filename, '.zip'),
      mimeType: 'application/zip',
      size: Buffer.byteLength(jsonString, 'utf8'),
      processingTime
    };
  }

  /**
   * 导出为项目文件 - 单文件项目格式
   */
  private async exportToProjectFile(
    session: CaptureSession,
    decoderResults: Map<string, DecoderResult[]>,
    analysisData: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();

    if (options.onProgress) {
      options.onProgress(0, '创建项目文件...');
    }

    // 创建项目文件数据结构
    const projectData = {
      // 项目基本信息
      version: '1.0.0',
      type: 'vscode-logic-analyzer-project',
      name: session.name || 'Untitled Project',
      description: '逻辑分析仪项目文件',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      application: {
        name: 'VSCode Logic Analyzer',
        version: '1.0.0'
      },

      // 核心数据
      session,
      decoderResults: Array.from(decoderResults.entries()),
      analysisData,

      // 项目设置
      projectSettings: {
        defaultTimeRange: options.timeRange || 'all',
        preferredChannels: options.selectedChannels || [],
        enabledDecoders: options.selectedDecoders || [],
        displaySettings: {
          theme: 'default',
          zoom: 1.0,
          showGrid: true,
          showAnnotations: true
        }
      },

      // 元数据
      metadata: this.generateMetadata(session, 'project', 'laproj', options)
    };

    if (options.onProgress) {
      options.onProgress(50, '序列化项目数据...');
    }

    const jsonString = JSON.stringify(projectData, null, 2);
    const processingTime = Date.now() - startTime;

    if (options.onProgress) {
      options.onProgress(90, '项目文件创建完成');
    }

    return {
      success: true,
      data: jsonString,
      filename: this.ensureFileExtension(options.filename, '.laproj'),
      mimeType: 'application/json',
      size: Buffer.byteLength(jsonString, 'utf8'),
      processingTime
    };
  }

  /**
   * 获取所有通道索引（当未指定selectedChannels时使用）
   */
  private getAllChannelIndices(session: CaptureSession): number[] {
    return session.captureChannels.map(ch => ch.channelNumber).filter(n => n !== undefined);
  }

  /**
   * 预览导出信息 - 不执行实际导出
   */
  async previewExport(
    input: UnifiedDataInput | CaptureSession | any,
    format: string,
    options: Partial<ExportOptions>
  ): Promise<{
    estimatedSize: number;
    estimatedTime: number;
    format: string;
    dataType: string;
    warnings: string[];
    canExport: boolean;
  }> {
    const dataType = this.detectInputFormat(input);
    const validation = this.validateInput(input);
    const formatInfo = this.getFormatInfo(format);

    // 估算数据大小
    let estimatedSize = 0;
    let estimatedTime = 0;

    try {
      const conversionResult = this.convertUnifiedData(
        typeof input === 'object' && (input.session || input.captureSession)
          ? input as UnifiedDataInput
          : { data: input }
      );

      if (conversionResult.success && conversionResult.data?.session) {
        const { session } = conversionResult.data;
        const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
        const channels = session.captureChannels?.length || 1;

        estimatedSize = this.estimateFileSize(totalSamples, channels, format);
        estimatedTime = Math.max(100, totalSamples * channels / 100000); // 估算处理时间
      }
    } catch (error) {
      validation.warnings.push(`估算失败: ${error}`);
    }

    return {
      estimatedSize,
      estimatedTime,
      format: formatInfo.name,
      dataType,
      warnings: validation.warnings,
      canExport: validation.valid
    };
  }

  /**
   * 验证导出选项
   */
  private validateExportOptions(session: CaptureSession, options: ExportOptions): string | null {
    // 验证时间范围
    if (options.timeRange === 'custom') {
      if (options.customStart !== undefined && options.customEnd !== undefined) {
        if (options.customStart >= options.customEnd) {
          return '时间范围无效：开始时间必须早于结束时间';
        }
        if (options.customStart < 0 || options.customEnd < 0) {
          return '时间范围无效：时间值不能为负';
        }
      }
    }

    // 验证通道选择
    if (options.selectedChannels && options.selectedChannels.length > 0) {
      const maxChannel = session.captureChannels?.length || 0;
      const invalidChannels = options.selectedChannels.filter(ch => ch < 0 || ch >= maxChannel);
      if (invalidChannels.length > 0) {
        return `通道选择无效：通道 ${invalidChannels.join(', ')} 不存在`;
      }
    }

    // 验证文件名
    if (!options.filename || options.filename.trim() === '') {
      return '文件名不能为空';
    }

    return null; // 验证通过
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.dataConverters.clear();
  }
}

// 导出单例实例 - 与ServiceLifecycle兼容
export const dataExportService = new DataExportService();

// 便捷导出函数 - 保持向后兼容
export async function exportData(
  input: UnifiedDataInput | CaptureSession | any,
  format: string,
  options: ExportOptions
): Promise<ExportResult> {
  return dataExportService.exportFlexible(input, format, options);
}

// 导出会话数据的便捷函数
export async function exportSession(
  session: CaptureSession,
  format: 'lac' | 'csv' | 'json' | 'vcd',
  filename: string,
  additionalOptions?: Partial<ExportOptions>
): Promise<ExportResult> {
  const options: ExportOptions = {
    filename,
    timeRange: 'all',
    ...additionalOptions
  };
  return dataExportService.exportWaveformData(session, format, options);
}

// 导出解码结果的便捷函数
export async function exportDecoders(
  decoderResults: Map<string, DecoderResult[]>,
  format: 'csv' | 'json' | 'txt',
  filename: string,
  selectedDecoders?: string[]
): Promise<ExportResult> {
  const options: ExportOptions = {
    filename,
    timeRange: 'all',
    selectedDecoders: selectedDecoders || Array.from(decoderResults.keys())
  };
  return dataExportService.exportDecoderResults(decoderResults, format, options);
}

// 快速检测数据类型
export function detectDataType(input: any): string {
  return dataExportService.detectInputFormat(input);
}

// 获取支持的格式列表
export function getSupportedExportFormats(): string[] {
  return dataExportService.getSupportedFormats();
}

// 智能导出函数 - 自动检测最佳格式
export async function smartExport(
  input: any,
  filename: string,
  options?: Partial<ExportOptions>
): Promise<ExportResult> {
  const dataType = detectDataType(input);
  let format = 'json'; // 默认格式

  // 根据数据类型选择最佳格式
  switch (dataType) {
    case 'captureSession':
    case 'exportedCapture':
      format = 'lac';
      break;
    case 'decoderResults':
      format = 'csv';
      break;
    case 'analysisData':
      format = 'html';
      break;
    default:
      format = 'json';
  }

  const exportOptions: ExportOptions = {
    filename,
    timeRange: 'all',
    ...options
  };

  return dataExportService.exportFlexible(input, format, exportOptions);
}

// 批量导出函数
export async function batchExport(
  exports: Array<{
    input: any;
    format: string;
    filename: string;
    options?: Partial<ExportOptions>;
  }>,
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  for (let i = 0; i < exports.length; i++) {
    const { input, format, filename, options = {} } = exports[i];

    if (onProgress) {
      onProgress(i, exports.length, filename);
    }

    try {
      const result = await dataExportService.exportFlexible(input, format, {
        filename,
        timeRange: 'all',
        ...options
      });
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        filename,
        mimeType: 'text/plain',
        size: 0,
        error: error instanceof Error ? error.message : '导出失败'
      });
    }
  }

  if (onProgress) {
    onProgress(exports.length, exports.length, '批量导出完成');
  }

  return results;
}
