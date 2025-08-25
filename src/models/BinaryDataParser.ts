/**
 * 二进制数据解析和通道提取器
 * 基于原版 C# 的数据解析逻辑，专门处理逻辑分析器的二进制数据格式
 * 支持多种数据格式和压缩算法
 */

import { CaptureMode } from './AnalyzerTypes';
import { AnalyzerChannel, CaptureSession } from './CaptureModels';
import { UnifiedCaptureData, DigitalSampleData } from './UnifiedDataFormat';

// 设备信息接口
export interface DeviceInfo {
  name: string;
  version: string;
  type: string;
  connectionPath: string;
  isNetwork: boolean;
  capabilities?: {
    channels: number;
    maxFrequency: number;
    bufferSize: number;
  };
}

/**
 * 二进制数据格式
 */
export enum BinaryDataFormat {
  Raw = 'raw',           // 原始二进制数据
  Compressed = 'compressed', // 压缩数据
  RLE = 'rle',          // 行程长度编码
  Delta = 'delta'       // 差分编码
}

/**
 * 数据解析配置
 */
export interface BinaryParserConfig {
  format: BinaryDataFormat;
  compressionThreshold: number; // 压缩阈值 (字节)
  enableOptimization: boolean; // 启用优化
  chunkSize: number; // 处理块大小
  enableValidation: boolean; // 启用数据验证
}

/**
 * 通道提取配置
 */
export interface ChannelExtractionConfig {
  channelMask: number; // 通道掩码
  bitOffset: number; // 位偏移
  invertLogic: boolean; // 逻辑反转
  enableFiltering: boolean; // 启用滤波
  filterWidth: number; // 滤波器宽度
}

/**
 * 数据解析结果
 */
export interface ParseResult {
  success: boolean;
  channels: AnalyzerChannel[];
  totalSamples: number;
  compressionRatio?: number;
  parseTime: number; // 解析耗时 (ms)
  memoryUsage: number; // 内存使用量 (bytes)
  warnings: string[]; // 警告信息
}

/**
 * 二进制数据解析器
 */
export class BinaryDataParser {
  private config: BinaryParserConfig;
  private parseStartTime: number = 0;

  constructor(config: Partial<BinaryParserConfig> = {}) {
    this.config = {
      format: BinaryDataFormat.Raw,
      compressionThreshold: 1024 * 1024, // 1MB
      enableOptimization: true,
      chunkSize: 64 * 1024, // 64KB
      enableValidation: true,
      ...config
    };
  }

  /**
   * 解析二进制数据并提取通道信息
   */
  public async parseBinaryData(
    rawData: Uint8Array,
    session: CaptureSession,
    mode: CaptureMode
  ): Promise<ParseResult> {

    this.parseStartTime = performance.now();
    const warnings: string[] = [];

    try {
      // 数据验证
      if (this.config.enableValidation) {
        const validationResult = this.validateRawData(rawData, session, mode);
        if (!validationResult.isValid) {
          throw new Error(`Data validation failed: ${validationResult.error}`);
        }
        warnings.push(...validationResult.warnings);
      }

      // 解析数据头部
      const headerInfo = this.parseDataHeader(rawData, mode);

      // 根据采集模式提取样本数据
      const sampleData = this.extractSampleData(rawData, headerInfo, mode);

      // 提取各个通道的数据
      const channels = await this.extractChannelData(sampleData, session, mode);

      // 应用优化处理
      if (this.config.enableOptimization) {
        await this.optimizeChannelData(channels);
      }

      const parseTime = performance.now() - this.parseStartTime;
      const memoryUsage = this.calculateMemoryUsage(channels);

      return {
        success: true,
        channels,
        totalSamples: headerInfo.sampleCount,
        parseTime,
        memoryUsage,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        channels: [],
        totalSamples: 0,
        parseTime: performance.now() - this.parseStartTime,
        memoryUsage: 0,
        warnings: [...warnings, `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * 验证原始数据
   */
  private validateRawData(
    data: Uint8Array,
    session: CaptureSession,
    mode: CaptureMode
  ): { isValid: boolean; error?: string; warnings: string[] } {

    const warnings: string[] = [];

    // 最小数据长度检查
    if (data.length < 8) {
      return { isValid: false, error: 'Data too short (minimum 8 bytes required)', warnings };
    }

    // 计算期望的数据长度
    const bytesPerSample = mode === CaptureMode.Channels_8 ? 1 :
                          (mode === CaptureMode.Channels_16 ? 2 : 4);
    const expectedHeaderSize = 4; // uint32 sample count
    const expectedSampleSize = session.totalSamples * bytesPerSample;
    const expectedTotalSize = expectedHeaderSize + expectedSampleSize + 1; // +1 for timestamp length

    if (data.length < expectedTotalSize) {
      warnings.push(`Data length ${data.length} is less than expected ${expectedTotalSize}`);
    }

    // 检查采集模式的合理性
    if (session.captureChannels.length === 0) {
      return { isValid: false, error: 'No capture channels defined', warnings };
    }

    const maxChannelNumber = Math.max(...session.captureChannels.map(ch => ch.channelNumber));
    const maxSupportedChannels = mode === CaptureMode.Channels_8 ? 8 :
                                (mode === CaptureMode.Channels_16 ? 16 : 24);

    if (maxChannelNumber >= maxSupportedChannels) {
      return {
        isValid: false,
        error: `Channel ${maxChannelNumber} exceeds max supported channels ${maxSupportedChannels} for mode ${mode}`,
        warnings
      };
    }

    return { isValid: true, warnings };
  }

  /**
   * 解析数据头部信息
   */
  private parseDataHeader(data: Uint8Array, mode: CaptureMode): {
    sampleCount: number;
    dataOffset: number;
    bytesPerSample: number;
  } {

    const view = new DataView(data.buffer, data.byteOffset);

    // 读取样本数量 (uint32, little endian)
    const sampleCount = view.getUint32(0, true);

    const bytesPerSample = mode === CaptureMode.Channels_8 ? 1 :
                          (mode === CaptureMode.Channels_16 ? 2 : 4);

    return {
      sampleCount,
      dataOffset: 4, // 跳过样本数量字段
      bytesPerSample
    };
  }

  /**
   * 提取样本数据
   */
  private extractSampleData(
    data: Uint8Array,
    headerInfo: { sampleCount: number; dataOffset: number; bytesPerSample: number },
    mode: CaptureMode
  ): Uint32Array {

    const { sampleCount, dataOffset, bytesPerSample } = headerInfo;
    const samples = new Uint32Array(sampleCount);
    const view = new DataView(data.buffer, data.byteOffset + dataOffset);

    // 根据采集模式读取不同大小的数据
    for (let i = 0; i < sampleCount; i++) {
      const offset = i * bytesPerSample;

      switch (mode) {
        case CaptureMode.Channels_8:
          samples[i] = view.getUint8(offset);
          break;
        case CaptureMode.Channels_16:
          samples[i] = view.getUint16(offset, true); // little endian
          break;
        case CaptureMode.Channels_24:
          samples[i] = view.getUint32(offset, true); // little endian
          break;
      }
    }

    return samples;
  }

  /**
   * 提取通道数据 - 基于C# ExtractSamples方法
   */
  private async extractChannelData(
    sampleData: Uint32Array,
    session: CaptureSession,
    mode: CaptureMode
  ): Promise<AnalyzerChannel[]> {

    const channels: AnalyzerChannel[] = [];

    for (let channelIndex = 0; channelIndex < session.captureChannels.length; channelIndex++) {
      const originalChannel = session.captureChannels[channelIndex];
      const newChannel = originalChannel.clone();

      // 提取该通道的样本数据
      const channelSamples = this.extractSingleChannelData(
        sampleData,
        originalChannel.channelNumber,
        mode
      );

      newChannel.samples = channelSamples;
      channels.push(newChannel);
    }

    return channels;
  }

  /**
   * 提取单个通道的数据
   */
  private extractSingleChannelData(
    sampleData: Uint32Array,
    channelNumber: number,
    mode: CaptureMode
  ): Uint8Array {

    const mask = 1 << channelNumber;
    const channelSamples = new Uint8Array(sampleData.length);

    // 使用位掩码提取通道数据
    for (let i = 0; i < sampleData.length; i++) {
      channelSamples[i] = (sampleData[i] & mask) !== 0 ? 1 : 0;
    }

    return channelSamples;
  }

  /**
   * 优化通道数据
   */
  private async optimizeChannelData(channels: AnalyzerChannel[]): Promise<void> {
    for (const channel of channels) {
      if (channel.samples && channel.samples.length > this.config.compressionThreshold) {
        // 应用数据压缩优化
        const optimized = this.compressChannelData(channel.samples);
        if (optimized.length < channel.samples.length * 0.8) { // 压缩率 > 20%
          // 这里可以实现压缩存储，但为了兼容性暂时保持原格式
          // channel.samples = optimized;
        }
      }
    }
  }

  /**
   * 压缩通道数据 - 使用RLE算法
   */
  private compressChannelData(data: Uint8Array): Uint8Array {
    const compressed: number[] = [];
    let currentValue = data[0];
    let count = 1;

    for (let i = 1; i < data.length; i++) {
      if (data[i] === currentValue && count < 255) {
        count++;
      } else {
        // 写入当前值和计数
        compressed.push(currentValue, count);
        currentValue = data[i];
        count = 1;
      }
    }

    // 写入最后一组
    compressed.push(currentValue, count);

    return new Uint8Array(compressed);
  }

  /**
   * 解压缩通道数据 - RLE解压
   */
  private decompressChannelData(compressedData: Uint8Array): Uint8Array {
    const decompressed: number[] = [];

    for (let i = 0; i < compressedData.length; i += 2) {
      const value = compressedData[i];
      const count = compressedData[i + 1];

      for (let j = 0; j < count; j++) {
        decompressed.push(value);
      }
    }

    return new Uint8Array(decompressed);
  }

  /**
   * 计算内存使用量
   */
  private calculateMemoryUsage(channels: AnalyzerChannel[]): number {
    let totalMemory = 0;

    for (const channel of channels) {
      if (channel.samples) {
        totalMemory += channel.samples.byteLength;
      }
      // 加上对象本身的内存估算
      totalMemory += 64; // 估算对象开销
    }

    return totalMemory;
  }

  /**
   * 转换为统一数据格式
   */
  public convertToUnifiedFormat(
    channels: AnalyzerChannel[],
    session: CaptureSession,
    deviceInfo: DeviceInfo
  ): DigitalSampleData {

    return {
      data: channels.map(ch => ch.samples || new Uint8Array()),
      encoding: 'binary',
      compression: 'none'
    };
  }

  /**
   * 从统一数据格式转换
   */
  public convertFromUnifiedFormat(
    digitalData: DigitalSampleData,
    channelInfo: { channelNumber: number; channelName: string }[]
  ): AnalyzerChannel[] {

    const channels: AnalyzerChannel[] = [];

    for (let i = 0; i < digitalData.data.length && i < channelInfo.length; i++) {
      const channel = new AnalyzerChannel(
        channelInfo[i].channelNumber,
        channelInfo[i].channelName
      );

      if (digitalData.encoding === 'rle') {
        channel.samples = this.decompressChannelData(digitalData.data[i]);
      } else {
        channel.samples = digitalData.data[i];
      }

      channels.push(channel);
    }

    return channels;
  }

  /**
   * 高级通道提取 - 支持复杂的通道配置
   */
  public extractChannelsAdvanced(
    sampleData: Uint32Array,
    configs: ChannelExtractionConfig[]
  ): Uint8Array[] {

    const results: Uint8Array[] = [];

    for (const config of configs) {
      const channelData = new Uint8Array(sampleData.length);

      for (let i = 0; i < sampleData.length; i++) {
        let value = (sampleData[i] & config.channelMask) >> config.bitOffset;

        if (config.invertLogic) {
          value = value ? 0 : 1;
        }

        channelData[i] = value & 0xFF;
      }

      // 应用滤波
      if (config.enableFiltering && config.filterWidth > 1) {
        this.applyMedianFilter(channelData, config.filterWidth);
      }

      results.push(channelData);
    }

    return results;
  }

  /**
   * 应用中值滤波器
   */
  private applyMedianFilter(data: Uint8Array, width: number): void {
    const halfWidth = Math.floor(width / 2);
    const filtered = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - halfWidth);
      const end = Math.min(data.length - 1, i + halfWidth);
      const window = Array.from(data.slice(start, end + 1)).sort((a, b) => a - b);
      filtered[i] = window[Math.floor(window.length / 2)];
    }

    data.set(filtered);
  }

  /**
   * 数据完整性检查
   */
  public validateDataIntegrity(channels: AnalyzerChannel[]): {
    isValid: boolean;
    errors: string[];
    statistics: {
      totalSamples: number;
      channelsWithData: number;
      averageSampleRate: number;
    };
  } {

    const errors: string[] = [];
    let totalSamples = 0;
    let channelsWithData = 0;

    for (const channel of channels) {
      if (!channel.samples) {
        errors.push(`Channel ${channel.channelNumber} has no sample data`);
        continue;
      }

      if (channel.samples.length === 0) {
        errors.push(`Channel ${channel.channelNumber} has empty sample data`);
        continue;
      }

      // 检查数据值范围
      for (let i = 0; i < channel.samples.length; i++) {
        if (channel.samples[i] > 1) {
          errors.push(`Channel ${channel.channelNumber} has invalid value ${channel.samples[i]} at sample ${i}`);
          break;
        }
      }

      totalSamples = Math.max(totalSamples, channel.samples.length);
      channelsWithData++;
    }

    // 检查所有通道的样本数量是否一致
    for (const channel of channels) {
      if (channel.samples && channel.samples.length !== totalSamples) {
        errors.push(`Channel ${channel.channelNumber} sample count ${channel.samples.length} differs from expected ${totalSamples}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      statistics: {
        totalSamples,
        channelsWithData,
        averageSampleRate: totalSamples > 0 ? totalSamples / channels.length : 0
      }
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<BinaryParserConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  public getConfig(): BinaryParserConfig {
    return { ...this.config };
  }
}

/**
 * 二进制数据解析工厂
 */
export class BinaryDataParserFactory {
  /**
   * 创建针对特定设备优化的解析器
   */
  public static createForDevice(deviceType: string, channelCount: number): BinaryDataParser {
    const config: Partial<BinaryParserConfig> = {
      enableOptimization: true,
      enableValidation: true
    };

    // 根据设备类型调整配置
    switch (deviceType.toLowerCase()) {
      case 'pico':
        config.chunkSize = 32 * 1024; // 32KB chunks for Pico
        config.compressionThreshold = 512 * 1024; // 512KB
        break;
      case 'saleae':
        config.chunkSize = 128 * 1024; // 128KB chunks for Saleae
        config.compressionThreshold = 2 * 1024 * 1024; // 2MB
        break;
      default:
        config.chunkSize = 64 * 1024; // Default 64KB
        config.compressionThreshold = 1024 * 1024; // Default 1MB
    }

    return new BinaryDataParser(config);
  }

  /**
   * 创建高性能解析器
   */
  public static createHighPerformance(): BinaryDataParser {
    return new BinaryDataParser({
      format: BinaryDataFormat.Raw,
      enableOptimization: true,
      enableValidation: false, // 关闭验证以提高性能
      chunkSize: 256 * 1024, // 大块处理
      compressionThreshold: 10 * 1024 * 1024 // 10MB
    });
  }

  /**
   * 创建调试用解析器
   */
  public static createDebug(): BinaryDataParser {
    return new BinaryDataParser({
      format: BinaryDataFormat.Raw,
      enableOptimization: false,
      enableValidation: true,
      chunkSize: 4 * 1024, // 小块处理便于调试
      compressionThreshold: 64 * 1024 // 64KB
    });
  }
}
