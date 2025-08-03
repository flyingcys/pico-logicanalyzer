/**
 * 数据压缩和优化存储系统
 * 专门针对逻辑分析器数据的特点进行优化
 * 支持多种压缩算法和存储策略
 */

import { AnalyzerChannel, CaptureSession } from './CaptureModels';
import { UnifiedCaptureData, DigitalSampleData } from './UnifiedDataFormat';

/**
 * 压缩算法类型
 */
export enum CompressionAlgorithm {
  None = 'none',
  RLE = 'rle',              // 行程长度编码 - 适合逻辑信号
  Delta = 'delta',          // 差分编码 - 适合缓慢变化的信号
  Huffman = 'huffman',      // 霍夫曼编码 - 通用压缩
  LZ4 = 'lz4',              // LZ4 - 快速压缩解压
  Dictionary = 'dictionary'  // 字典压缩 - 适合重复模式
}

/**
 * 压缩质量级别
 */
export enum CompressionQuality {
  Fastest = 'fastest',      // 最快速度
  Balanced = 'balanced',    // 平衡模式
  BestRatio = 'best_ratio'  // 最佳压缩比
}

/**
 * 压缩配置
 */
export interface CompressionConfig {
  algorithm: CompressionAlgorithm;
  quality: CompressionQuality;
  threshold: number;        // 压缩阈值 (字节)
  chunkSize: number;       // 分块大小
  enableAdaptive: boolean; // 自适应压缩
  preserveOriginal: boolean; // 保留原始数据
}

/**
 * 压缩结果
 */
export interface CompressionResult {
  success: boolean;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number; // 毫秒
  data: Uint8Array | string;
  metadata?: {
    [key: string]: any;
  };
}

/**
 * 解压结果
 */
export interface DecompressionResult {
  success: boolean;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  decompressedSize: number;
  decompressionTime: number;
  data: Uint8Array;
  isValid: boolean;
}

/**
 * 存储优化配置
 */
export interface StorageOptimizationConfig {
  enableTiered: boolean;    // 分层存储
  hotDataThreshold: number; // 热数据阈值 (访问次数)
  coldDataDelay: number;    // 冷数据压缩延迟 (毫秒)
  enableDeduplication: boolean; // 去重
  enableIndexing: boolean;  // 索引优化
}

/**
 * 数据压缩器
 */
export class DataCompressor {
  private config: CompressionConfig;

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      algorithm: CompressionAlgorithm.RLE,
      quality: CompressionQuality.Balanced,
      threshold: 1024,      // 1KB
      chunkSize: 64 * 1024, // 64KB
      enableAdaptive: true,
      preserveOriginal: false,
      ...config
    };
  }

  /**
   * 压缩通道数据
   */
  public async compressChannelData(
    channelData: Uint8Array,
    algorithm?: CompressionAlgorithm
  ): Promise<CompressionResult> {

    const startTime = performance.now();
    const originalSize = channelData.length;
    const useAlgorithm = algorithm || this.config.algorithm;

    try {
      // 小数据直接返回
      if (originalSize < this.config.threshold) {
        return {
          success: true,
          algorithm: CompressionAlgorithm.None,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
          compressionTime: performance.now() - startTime,
          data: channelData
        };
      }

      let compressedData: Uint8Array | string;
      let metadata: any = {};

      // 根据算法选择压缩方法
      switch (useAlgorithm) {
        case CompressionAlgorithm.RLE:
          const rleResult = this.compressRLE(channelData);
          compressedData = rleResult.data;
          metadata = rleResult.metadata;
          break;

        case CompressionAlgorithm.Delta:
          const deltaResult = this.compressDelta(channelData);
          compressedData = deltaResult.data;
          metadata = deltaResult.metadata;
          break;

        case CompressionAlgorithm.Dictionary:
          const dictResult = this.compressDictionary(channelData);
          compressedData = dictResult.data;
          metadata = dictResult.metadata;
          break;

        case CompressionAlgorithm.Huffman:
          const huffmanResult = this.compressHuffman(channelData);
          compressedData = huffmanResult.data;
          metadata = huffmanResult.metadata;
          break;

        default:
          compressedData = channelData;
      }

      const compressedSize = compressedData instanceof Uint8Array ?
        compressedData.length :
        new TextEncoder().encode(compressedData).length;

      const compressionRatio = compressedSize / originalSize;
      const compressionTime = performance.now() - startTime;

      return {
        success: true,
        algorithm: useAlgorithm,
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime,
        data: compressedData,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        algorithm: useAlgorithm,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        compressionTime: performance.now() - startTime,
        data: channelData,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * 解压通道数据
   */
  public async decompressChannelData(
    compressedData: Uint8Array | string,
    algorithm: CompressionAlgorithm,
    originalSize: number,
    metadata?: any
  ): Promise<DecompressionResult> {

    const startTime = performance.now();

    try {
      let decompressedData: Uint8Array;

      switch (algorithm) {
        case CompressionAlgorithm.RLE:
          decompressedData = this.decompressRLE(compressedData, metadata);
          break;

        case CompressionAlgorithm.Delta:
          decompressedData = this.decompressDelta(compressedData, metadata);
          break;

        case CompressionAlgorithm.Dictionary:
          decompressedData = this.decompressDictionary(compressedData, metadata);
          break;

        case CompressionAlgorithm.Huffman:
          decompressedData = this.decompressHuffman(compressedData, metadata);
          break;

        case CompressionAlgorithm.None:
        default:
          decompressedData = compressedData instanceof Uint8Array ?
            compressedData :
            new TextEncoder().encode(compressedData);
      }

      const decompressionTime = performance.now() - startTime;
      const isValid = decompressedData.length === originalSize;

      return {
        success: true,
        algorithm,
        originalSize,
        decompressedSize: decompressedData.length,
        decompressionTime,
        data: decompressedData,
        isValid
      };

    } catch (error) {
      return {
        success: false,
        algorithm,
        originalSize,
        decompressedSize: 0,
        decompressionTime: performance.now() - startTime,
        data: new Uint8Array(),
        isValid: false
      };
    }
  }

  /**
   * RLE压缩 - 针对逻辑信号优化
   */
  private compressRLE(data: Uint8Array): { data: Uint8Array; metadata: any } {
    const compressed: number[] = [];
    const metadata = { runs: 0, maxRun: 0 };

    if (data.length === 0) {
      return { data: new Uint8Array(), metadata };
    }

    let currentValue = data[0];
    let runLength = 1;

    for (let i = 1; i < data.length; i++) {
      if (data[i] === currentValue && runLength < 255) {
        runLength++;
      } else {
        // 写入值和长度
        compressed.push(currentValue, runLength);
        metadata.runs++;
        metadata.maxRun = Math.max(metadata.maxRun, runLength);

        currentValue = data[i];
        runLength = 1;
      }
    }

    // 写入最后一段
    compressed.push(currentValue, runLength);
    metadata.runs++;
    metadata.maxRun = Math.max(metadata.maxRun, runLength);

    return {
      data: new Uint8Array(compressed),
      metadata
    };
  }

  /**
   * RLE解压
   */
  private decompressRLE(compressedData: Uint8Array | string, metadata?: any): Uint8Array {
    const data = compressedData instanceof Uint8Array ?
      compressedData :
      new TextEncoder().encode(compressedData);

    const decompressed: number[] = [];

    for (let i = 0; i < data.length; i += 2) {
      if (i + 1 >= data.length) break;

      const value = data[i];
      const count = data[i + 1];

      for (let j = 0; j < count; j++) {
        decompressed.push(value);
      }
    }

    return new Uint8Array(decompressed);
  }

  /**
   * 差分压缩 - 适合缓慢变化的信号
   */
  private compressDelta(data: Uint8Array): { data: Uint8Array; metadata: any } {
    if (data.length === 0) {
      return { data: new Uint8Array(), metadata: {} };
    }

    const compressed: number[] = [];
    const metadata = { changes: 0, maxDelta: 0 };

    // 第一个值直接存储
    compressed.push(data[0]);
    let previousValue = data[0];

    for (let i = 1; i < data.length; i++) {
      const delta = data[i] - previousValue;
      // 正确处理负数转换为无符号字节
      const deltaByte = delta < 0 ? (256 + delta) : delta;
      compressed.push(deltaByte & 0xFF);

      if (delta !== 0) {
        metadata.changes++;
        metadata.maxDelta = Math.max(metadata.maxDelta, Math.abs(delta));
      }

      previousValue = data[i];
    }

    return {
      data: new Uint8Array(compressed),
      metadata
    };
  }

  /**
   * 差分解压
   */
  private decompressDelta(compressedData: Uint8Array | string, metadata?: any): Uint8Array {
    const data = compressedData instanceof Uint8Array ?
      compressedData :
      new TextEncoder().encode(compressedData);

    if (data.length === 0) {
      return new Uint8Array();
    }

    const decompressed: number[] = [];
    let currentValue = data[0];
    decompressed.push(currentValue);

    for (let i = 1; i < data.length; i++) {
      const delta = data[i] > 127 ? data[i] - 256 : data[i]; // 处理负数
      currentValue = (currentValue + delta) & 0xFF;
      decompressed.push(currentValue);
    }

    return new Uint8Array(decompressed);
  }

  /**
   * 字典压缩 - 适合重复模式
   */
  private compressDictionary(data: Uint8Array): { data: Uint8Array; metadata: any } {
    const patternMap = new Map<string, number>();
    const patterns: string[] = [];
    const compressed: number[] = [];
    const metadata = { dictSize: 0, patterns: 0 };

    // 构建字典 - 使用固定长度模式
    const patternLength = 4;

    for (let i = 0; i <= data.length - patternLength; i++) {
      const pattern = Array.from(data.slice(i, i + patternLength)).join(',');

      if (!patternMap.has(pattern) && patterns.length < 256) {
        patternMap.set(pattern, patterns.length);
        patterns.push(pattern);
      }
    }

    metadata.dictSize = patterns.length;

    // 编码数据
    let i = 0;
    while (i < data.length) {
      let matched = false;

      // 尝试匹配最长模式
      if (i <= data.length - patternLength) {
        const pattern = Array.from(data.slice(i, i + patternLength)).join(',');
        const patternIndex = patternMap.get(pattern);

        if (patternIndex !== undefined) {
          compressed.push(255, patternIndex); // 255作为转义符
          i += patternLength;
          matched = true;
          metadata.patterns++;
        }
      }

      if (!matched) {
        compressed.push(data[i]);
        i++;
      }
    }

    // 将字典和压缩数据合并
    const dictData = patterns.flatMap(p => p.split(',').map(Number));
    const result = new Uint8Array([
      patterns.length, // 字典大小
      patternLength,   // 模式长度
      ...dictData,     // 字典数据
      254,             // 分隔符
      ...compressed    // 压缩数据
    ]);

    return { data: result, metadata };
  }

  /**
   * 字典解压
   */
  private decompressDictionary(compressedData: Uint8Array | string, metadata?: any): Uint8Array {
    const data = compressedData instanceof Uint8Array ?
      compressedData :
      new TextEncoder().encode(compressedData);

    if (data.length < 3) {
      return new Uint8Array();
    }

    let offset = 0;
    const dictSize = data[offset++];
    const patternLength = data[offset++];

    // 重建字典
    const patterns: number[][] = [];
    for (let i = 0; i < dictSize; i++) {
      const pattern: number[] = [];
      for (let j = 0; j < patternLength; j++) {
        pattern.push(data[offset++]);
      }
      patterns.push(pattern);
    }

    // 跳过分隔符
    if (data[offset] === 254) {
      offset++;
    }

    // 解压数据
    const decompressed: number[] = [];
    while (offset < data.length) {
      if (data[offset] === 255 && offset + 1 < data.length) {
        // 字典引用
        const patternIndex = data[offset + 1];
        if (patternIndex < patterns.length) {
          decompressed.push(...patterns[patternIndex]);
        }
        offset += 2;
      } else {
        // 直接数据
        decompressed.push(data[offset]);
        offset++;
      }
    }

    return new Uint8Array(decompressed);
  }

  /**
   * 简单的霍夫曼压缩实现
   */
  private compressHuffman(data: Uint8Array): { data: Uint8Array; metadata: any } {
    // 统计频率
    const frequency = new Map<number, number>();
    for (const byte of data) {
      frequency.set(byte, (frequency.get(byte) || 0) + 1);
    }

    // 构建霍夫曼编码表（简化版本）
    const codes = new Map<number, string>();
    const sortedFreq = Array.from(frequency.entries()).sort((a, b) => b[1] - a[1]);

    // 为最频繁的值分配最短编码
    if (sortedFreq.length === 1) {
      // 只有一个值的特殊情况
      codes.set(sortedFreq[0][0], '0');
    } else {
      // 简单的编码分配：频率越高，编码越短
      for (let i = 0; i < sortedFreq.length; i++) {
        const [value] = sortedFreq[i];
        const codeLength = Math.max(1, Math.ceil(Math.log2(sortedFreq.length)));
        codes.set(value, i.toString(2).padStart(codeLength, '0'));
      }
    }

    // 编码数据
    let encodedBits = '';
    for (const byte of data) {
      encodedBits += codes.get(byte) || '0';
    }

    // 计算需要的字节数（向上取整）
    const byteCount = Math.ceil(encodedBits.length / 8);

    // 转换为字节数组
    const encodedBytes: number[] = [];
    for (let i = 0; i < byteCount; i++) {
      const chunk = encodedBits.slice(i * 8, (i + 1) * 8).padEnd(8, '0');
      encodedBytes.push(parseInt(chunk, 2));
    }

    const metadata = {
      codes: Array.from(codes.entries()),
      originalLength: data.length,
      encodedBits: encodedBits.length
    };

    return { data: new Uint8Array(encodedBytes), metadata };
  }

  /**
   * 霍夫曼解压
   */
  private decompressHuffman(compressedData: Uint8Array | string, metadata: any): Uint8Array {
    const data = compressedData instanceof Uint8Array ?
      compressedData :
      new TextEncoder().encode(compressedData);

    // 重建编码表
    const codes = new Map<string, number>();
    for (const [value, code] of metadata.codes) {
      codes.set(code, value);
    }

    // 转换为位字符串
    let bits = '';
    for (const byte of data) {
      bits += byte.toString(2).padStart(8, '0');
    }

    // 截取到编码的实际长度
    bits = bits.slice(0, metadata.encodedBits);

    // 解码
    const decoded: number[] = [];
    let currentCode = '';

    for (const bit of bits) {
      currentCode += bit;
      const value = codes.get(currentCode);
      if (value !== undefined) {
        decoded.push(value);
        currentCode = '';

        // 如果已经解码到预期长度，停止
        if (decoded.length >= metadata.originalLength) {
          break;
        }
      }
    }

    return new Uint8Array(decoded);
  }

  /**
   * 自适应压缩 - 自动选择最佳算法
   */
  public async compressAdaptive(data: Uint8Array): Promise<CompressionResult> {
    const algorithms = [
      CompressionAlgorithm.RLE,
      CompressionAlgorithm.Delta,
      CompressionAlgorithm.Dictionary
    ];

    let bestResult: CompressionResult | null = null;

    // 测试各种算法
    for (const algorithm of algorithms) {
      const result = await this.compressChannelData(data, algorithm);

      if (result.success) {
        if (!bestResult || result.compressionRatio < bestResult.compressionRatio) {
          bestResult = result;
        }
      }
    }

    // 如果没有找到合适的压缩算法，返回原始数据
    if (!bestResult) {
      bestResult = {
        success: true,
        algorithm: CompressionAlgorithm.None,
        originalSize: data.length,
        compressedSize: data.length,
        compressionRatio: 1.0,
        compressionTime: 0,
        data
      };
    }

    return bestResult;
  }

  /**
   * 批量压缩多个通道
   */
  public async compressMultipleChannels(
    channels: AnalyzerChannel[],
    algorithm?: CompressionAlgorithm
  ): Promise<{
    results: CompressionResult[];
    totalOriginalSize: number;
    totalCompressedSize: number;
    overallRatio: number;
    totalTime: number;
  }> {

    const results: CompressionResult[] = [];
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let totalTime = 0;

    for (const channel of channels) {
      if (channel.samples) {
        const result = await this.compressChannelData(channel.samples, algorithm);
        results.push(result);

        totalOriginalSize += result.originalSize;
        totalCompressedSize += result.compressedSize;
        totalTime += result.compressionTime;
      }
    }

    return {
      results,
      totalOriginalSize,
      totalCompressedSize,
      overallRatio: totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1.0,
      totalTime
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  public getConfig(): CompressionConfig {
    return { ...this.config };
  }
}

/**
 * 存储优化器
 */
export class StorageOptimizer {
  private config: StorageOptimizationConfig;
  private accessCounters = new Map<string, number>();
  private lastAccessTime = new Map<string, number>();

  constructor(config: Partial<StorageOptimizationConfig> = {}) {
    this.config = {
      enableTiered: true,
      hotDataThreshold: 10,
      coldDataDelay: 5 * 60 * 1000, // 5分钟
      enableDeduplication: true,
      enableIndexing: true,
      ...config
    };
  }

  /**
   * 优化存储布局
   */
  public async optimizeStorage(data: UnifiedCaptureData): Promise<{
    optimizedData: UnifiedCaptureData;
    savings: {
      sizeBefore: number;
      sizeAfter: number;
      compressionRatio: number;
      deduplicationSavings: number;
    };
  }> {

    const sizeBefore = this.calculateDataSize(data);
    let deduplicationSavings = 0;

    // 去重处理
    if (this.config.enableDeduplication && data.samples.digital) {
      const dedupResult = this.deduplicateChannelData(data.samples.digital);
      data.samples.digital = dedupResult.data;
      deduplicationSavings = dedupResult.savings;
    }

    // 分层存储处理
    if (this.config.enableTiered) {
      await this.applyTieredStorage(data);
    }

    const sizeAfter = this.calculateDataSize(data);
    const compressionRatio = sizeBefore > 0 ? sizeAfter / sizeBefore : 1.0;

    return {
      optimizedData: data,
      savings: {
        sizeBefore,
        sizeAfter,
        compressionRatio,
        deduplicationSavings
      }
    };
  }

  /**
   * 去重通道数据
   */
  private deduplicateChannelData(digitalData: DigitalSampleData): {
    data: DigitalSampleData;
    savings: number;
  } {

    const uniqueChannels = new Map<string, Uint8Array>();
    const channelHashes: string[] = [];
    let totalSavings = 0;

    // 计算每个通道的哈希值
    for (let i = 0; i < digitalData.data.length; i++) {
      const channelData = digitalData.data[i];
      const hash = this.calculateDataHash(channelData);

      if (uniqueChannels.has(hash)) {
        // 重复通道
        channelHashes.push(hash);
        totalSavings += channelData.length;
      } else {
        // 唯一通道
        uniqueChannels.set(hash, channelData);
        channelHashes.push(hash);
      }
    }

    // 构建去重后的数据数组（只包含唯一通道）
    const deduplicatedData = Array.from(uniqueChannels.values());

    return {
      data: {
        ...digitalData,
        data: deduplicatedData
      },
      savings: totalSavings
    };
  }

  /**
   * 应用分层存储
   */
  private async applyTieredStorage(data: UnifiedCaptureData): Promise<void> {
    const currentTime = Date.now();

    // 根据访问频率决定存储层级
    if (data.samples.digital) {
      for (let i = 0; i < data.samples.digital.data.length; i++) {
        const channelKey = `channel_${i}`;
        const accessCount = this.accessCounters.get(channelKey) || 0;
        const lastAccess = this.lastAccessTime.get(channelKey) || currentTime;

        // 冷数据压缩
        if (accessCount < this.config.hotDataThreshold &&
            currentTime - lastAccess > this.config.coldDataDelay) {

          const compressor = new DataCompressor({
            algorithm: CompressionAlgorithm.RLE,
            quality: CompressionQuality.BestRatio
          });

          const result = await compressor.compressChannelData(data.samples.digital.data[i]);
          if (result.success && result.compressionRatio < 0.8) {
            // 将压缩数据存储在扩展字段中
            if (!data.extensions) {
              data.extensions = {};
            }
            data.extensions[`compressed_${channelKey}`] = {
              data: result.data,
              algorithm: result.algorithm,
              metadata: result.metadata
            };
          }
        }
      }
    }
  }

  /**
   * 计算数据大小
   */
  private calculateDataSize(data: UnifiedCaptureData): number {
    let totalSize = 0;

    // 计算样本数据大小
    if (data.samples.digital) {
      for (const channelData of data.samples.digital.data) {
        totalSize += channelData.byteLength;
      }
    }

    // 计算元数据大小（估算）
    totalSize += JSON.stringify(data.metadata).length;
    totalSize += JSON.stringify(data.channels).length;

    return totalSize;
  }

  /**
   * 计算数据哈希值
   */
  private calculateDataHash(data: Uint8Array): string {
    // 简单的哈希算法
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) & 0xffffffff;
    }
    return hash.toString(36);
  }

  /**
   * 记录数据访问
   */
  public recordAccess(channelKey: string): void {
    this.accessCounters.set(channelKey, (this.accessCounters.get(channelKey) || 0) + 1);
    this.lastAccessTime.set(channelKey, Date.now());
  }

  /**
   * 获取存储统计信息
   */
  public getStorageStatistics(): {
    totalChannels: number;
    hotChannels: number;
    coldChannels: number;
    averageAccessCount: number;
    totalAccesses: number;
  } {

    const totalChannels = this.accessCounters.size;
    let hotChannels = 0;
    let totalAccesses = 0;

    for (const [key, count] of this.accessCounters) {
      totalAccesses += count;
      if (count >= this.config.hotDataThreshold) {
        hotChannels++;
      }
    }

    return {
      totalChannels,
      hotChannels,
      coldChannels: totalChannels - hotChannels,
      averageAccessCount: totalChannels > 0 ? totalAccesses / totalChannels : 0,
      totalAccesses
    };
  }
}

/**
 * 压缩工厂类
 */
export class CompressionFactory {
  /**
   * 创建针对逻辑信号优化的压缩器
   */
  public static createForLogicSignals(): DataCompressor {
    return new DataCompressor({
      algorithm: CompressionAlgorithm.RLE,
      quality: CompressionQuality.Balanced,
      threshold: 1024,
      enableAdaptive: true
    });
  }

  /**
   * 创建高性能压缩器
   */
  public static createHighPerformance(): DataCompressor {
    return new DataCompressor({
      algorithm: CompressionAlgorithm.RLE,
      quality: CompressionQuality.Fastest,
      threshold: 4096,
      enableAdaptive: false
    });
  }

  /**
   * 创建最佳压缩比压缩器
   */
  public static createBestRatio(): DataCompressor {
    return new DataCompressor({
      algorithm: CompressionAlgorithm.Dictionary,
      quality: CompressionQuality.BestRatio,
      threshold: 512,
      enableAdaptive: true
    });
  }
}
