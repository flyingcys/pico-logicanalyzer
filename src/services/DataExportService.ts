/**
 * 数据导出服务
 * 基于原版 MainWindow.axaml.cs 中的导出功能实现
 * 支持多种格式导出：LAC、CSV、JSON、VCD、TXT、HTML等
 */
import { CaptureSession, AnalyzerChannel } from '../models/AnalyzerTypes';
import { DecoderResult } from '../decoders/types';
import { SampleRegion } from '../models/CaptureModels';

// 导出数据类型
export interface ExportedCapture {
  settings: CaptureSession;
  samples?: Uint8Array[];  // 兼容老版本
  selectedRegions?: SampleRegion[];
  metadata?: ExportMetadata;
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
}

export interface ExportResult {
  success: boolean;
  data?: string | Uint8Array;
  filename: string;
  mimeType: string;
  size: number;
  error?: string;
}

export class DataExportService {
  
  /**
   * 导出波形数据
   */
  async exportWaveformData(
    session: CaptureSession,
    format: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (format.toLowerCase()) {
        case 'lac':
          return this.exportToLAC(session, options);
        case 'csv':
          return this.exportToCSV(session, options);
        case 'json':
          return this.exportToJSON(session, options);
        case 'vcd':
          return this.exportToVCD(session, options);
        default:
          throw new Error(`不支持的波形导出格式: ${format}`);
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
    format: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
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
        filename: options.filename,
        mimeType: 'application/octet-stream',
        size: 0,
        error: error instanceof Error ? error.message : '导出失败'
      };
    }
  }

  /**
   * 导出为LAC格式（原生格式）
   * 基于原版 mnuSave_Click 方法实现
   */
  private async exportToLAC(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    // 克隆会话设置
    const exportSession = { ...session };
    
    // 根据时间范围调整样本数据
    this.adjustSampleRange(exportSession, options);

    // 创建导出数据结构 - 精确对应原版 ExportedCapture
    const exportedCapture: ExportedCapture = {
      settings: exportSession,
      selectedRegions: [], // 可以扩展为实际选中的区域
      metadata: this.generateMetadata(exportSession, 'waveform', 'lac', options)
    };

    // 使用JSON序列化 - 对应原版的 JsonConvert.SerializeObject
    const jsonData = JSON.stringify(exportedCapture, null, 2);
    
    return {
      success: true,
      data: jsonData,
      filename: `${options.filename}.lac`,
      mimeType: 'application/json',
      size: new Blob([jsonData]).size
    };
  }

  /**
   * 导出为CSV格式
   * 基于原版 MnuExport_Click 方法实现
   */
  private async exportToCSV(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const lines: string[] = [];
    
    // 构建头部 - 对应原版的通道名称构建逻辑
    const headers = ['Time'];
    const selectedChannels = options.selectedChannels || [];
    
    for (const channelIndex of selectedChannels) {
      const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
      const channelName = channel?.channelName || `Channel ${channelIndex + 1}`;
      headers.push(channelName);
    }
    lines.push(headers.join(','));

    // 获取样本数据范围
    const { startSample, endSample } = this.getSampleRange(session, options);
    const sampleRate = session.frequency;

    // 生成CSV数据行
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex++) {
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
      
      lines.push(row.join(','));
    }

    const csvData = lines.join('\n');
    
    return {
      success: true,
      data: csvData,
      filename: `${options.filename}.csv`,
      mimeType: 'text/csv',
      size: new Blob([csvData]).size
    };
  }

  /**
   * 导出为JSON格式
   */
  private async exportToJSON(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const { startSample, endSample } = this.getSampleRange(session, options);
    const selectedChannels = options.selectedChannels || [];
    
    const jsonData = {
      metadata: this.generateMetadata(session, 'waveform', 'json', options),
      channels: selectedChannels.map(channelIndex => {
        const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
        return {
          number: channelIndex,
          name: channel?.channelName || `Channel ${channelIndex + 1}`,
          hidden: channel?.hidden || false
        };
      }),
      samples: [],
      timebase: {
        sampleRate: session.frequency,
        startSample,
        endSample,
        duration: (endSample - startSample) / session.frequency
      }
    } as any;

    // 提取样本数据
    const samples = [];
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex++) {
      const sample = {
        time: sampleIndex / session.frequency,
        channels: {} as any
      };
      
      for (const channelIndex of selectedChannels) {
        const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
        if (channel && channel.samples) {
          const byteIndex = Math.floor(sampleIndex / 8);
          const bitIndex = sampleIndex % 8;
          sample.channels[`CH${channelIndex}`] = (channel.samples[byteIndex] & (1 << bitIndex)) ? 1 : 0;
        } else {
          sample.channels[`CH${channelIndex}`] = 0;
        }
      }
      
      samples.push(sample);
    }
    
    jsonData.samples = samples;
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    return {
      success: true,
      data: jsonString,
      filename: `${options.filename}.json`,
      mimeType: 'application/json',
      size: new Blob([jsonString]).size
    };
  }

  /**
   * 导出为VCD格式（Value Change Dump）
   */
  private async exportToVCD(session: CaptureSession, options: ExportOptions): Promise<ExportResult> {
    const { startSample, endSample } = this.getSampleRange(session, options);
    const selectedChannels = options.selectedChannels || [];
    const lines: string[] = [];
    
    // VCD头部
    lines.push('$date');
    lines.push(`    ${new Date().toISOString()}`);
    lines.push('$end');
    lines.push('$version');
    lines.push('    VSCode Logic Analyzer v1.0');
    lines.push('$end');
    lines.push('$timescale');
    lines.push(`    ${Math.round(1e9 / session.frequency)}ns`);
    lines.push('$end');
    
    // 变量定义
    lines.push('$scope module logic $end');
    const varMap = new Map<number, string>();
    for (let i = 0; i < selectedChannels.length; i++) {
      const channelIndex = selectedChannels[i];
      const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
      const varId = String.fromCharCode(33 + i); // 从 ! 开始
      const varName = channel?.channelName || `CH${channelIndex}`;
      varMap.set(channelIndex, varId);
      lines.push(`$var wire 1 ${varId} ${varName} $end`);
    }
    lines.push('$upscope $end');
    lines.push('$enddefinitions $end');
    
    // 初始值
    lines.push('$dumpvars');
    for (const channelIndex of selectedChannels) {
      const channel = session.captureChannels.find(ch => ch.channelNumber === channelIndex);
      if (channel && channel.samples) {
        const byteIndex = Math.floor(startSample / 8);
        const bitIndex = startSample % 8;
        const value = (channel.samples[byteIndex] & (1 << bitIndex)) ? '1' : '0';
        lines.push(`${value}${varMap.get(channelIndex)}`);
      } else {
        lines.push(`0${varMap.get(channelIndex)}`);
      }
    }
    lines.push('$end');
    
    // 变化数据
    const prevValues = new Map<number, number>();
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex++) {
      const time = sampleIndex - startSample;
      let hasChanges = false;
      
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
            lines.push(`#${time}`);
            hasChanges = true;
          }
          lines.push(`${currentValue}${varMap.get(channelIndex)}`);
          prevValues.set(channelIndex, currentValue);
        }
      }
    }
    
    const vcdData = lines.join('\n');
    
    return {
      success: true,
      data: vcdData,
      filename: `${options.filename}.vcd`,
      mimeType: 'text/plain',
      size: new Blob([vcdData]).size
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
        const row = [
          `"${decoderId}"`,
          `"${result.annotationType}"`,
          result.startSample.toString(),
          result.endSample.toString(),
          (result.startSample / 1000000).toFixed(6), // 假设单位是ns，转换为ms
          (result.endSample / 1000000).toFixed(6),
          ((result.endSample - result.startSample) / 1000000).toFixed(6),
          `"${result.values.join(' | ')}"`
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
      filename: `${options.filename}.csv`,
      mimeType: 'text/csv',
      size: new Blob([csvData]).size
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
      filename: `${options.filename}.json`,
      mimeType: 'application/json',
      size: new Blob([jsonString]).size
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
      filename: `${options.filename}.txt`,
      mimeType: 'text/plain',
      size: new Blob([textData]).size
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
      filename: `${options.filename}.html`,
      mimeType: 'text/html',
      size: new Blob([html]).size
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
      lines.push('- 总样本数: ' + (analysisData?.totalSamples || 'N/A'));
      lines.push('- 采样频率: ' + (analysisData?.sampleRate || 'N/A') + ' Hz');
      lines.push('- 持续时间: ' + (analysisData?.duration || 'N/A') + ' 秒');
      lines.push('- 活跃通道: ' + (analysisData?.activeChannels || 'N/A'));
      lines.push('');
    }
    
    // 添加其他部分...
    
    const markdownData = lines.join('\n');
    
    return {
      success: true,
      data: markdownData,
      filename: `${options.filename}.md`,
      mimeType: 'text/markdown',
      size: new Blob([markdownData]).size
    };
  }

  /**
   * 导出分析报告为PDF（占位实现）
   */
  private async exportReportToPDF(analysisData: any, options: ExportOptions): Promise<ExportResult> {
    // 这里应该集成PDF生成库，暂时返回错误
    throw new Error('PDF导出功能尚未实现');
  }

  /**
   * 导出项目为ZIP压缩包
   */
  private async exportProjectToZip(
    session: CaptureSession,
    decoderResults: Map<string, DecoderResult[]>,
    analysisData: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    // 这里应该使用JSZip库来创建压缩包
    // 暂时返回JSON格式的完整项目数据
    const projectData = {
      waveform: await this.exportToLAC(session, options),
      decoders: await this.exportDecodersToJSON(decoderResults, options),
      analysis: await this.exportReportToMarkdown(analysisData, options),
      metadata: this.generateMetadata(session, 'all', 'zip', options)
    };
    
    const jsonString = JSON.stringify(projectData, null, 2);
    
    return {
      success: true,
      data: jsonString,
      filename: `${options.filename}.zip`,
      mimeType: 'application/zip',
      size: new Blob([jsonString]).size
    };
  }

  /**
   * 导出为项目文件
   */
  private async exportToProjectFile(
    session: CaptureSession,
    decoderResults: Map<string, DecoderResult[]>,
    analysisData: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    const projectData = {
      version: '1.0',
      type: 'vscode-logic-analyzer-project',
      session,
      decoderResults: Array.from(decoderResults.entries()),
      analysisData,
      metadata: this.generateMetadata(session, 'all', 'project', options)
    };
    
    const jsonString = JSON.stringify(projectData, null, 2);
    
    return {
      success: true,
      data: jsonString,
      filename: `${options.filename}.laproj`,
      mimeType: 'application/json',
      size: new Blob([jsonString]).size
    };
  }

  // 工具方法

  /**
   * 根据选项调整样本范围
   */
  private adjustSampleRange(session: CaptureSession, options: ExportOptions): void {
    // 这里可以根据时间范围选项调整样本数据
    // 暂时保持原样
  }

  /**
   * 获取样本范围
   */
  private getSampleRange(session: CaptureSession, options: ExportOptions): { startSample: number; endSample: number } {
    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
    
    switch (options.timeRange) {
      case 'custom':
        return {
          startSample: options.customStart || 0,
          endSample: Math.min(options.customEnd || totalSamples, totalSamples)
        };
      case 'visible':
      case 'selection':
        // 这里应该根据实际的可见范围或选中区域来确定
        // 暂时返回全部范围
        return { startSample: 0, endSample: totalSamples };
      case 'all':
      default:
        return { startSample: 0, endSample: totalSamples };
    }
  }

  /**
   * 生成导出元数据
   */
  private generateMetadata(
    session: CaptureSession,
    exportType: string,
    exportFormat: string,
    options: ExportOptions
  ): ExportMetadata {
    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
    
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      sampleRate: session.frequency,
      totalSamples,
      channels: session.captureChannels.length,
      duration: totalSamples / session.frequency,
      exportType,
      exportFormat
    };
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
}

// 导出单例实例
export const dataExportService = new DataExportService();