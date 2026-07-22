/**
 * 性能优化工具类
 * 基于 @logicanalyzer/Software 的性能优化策略
 * 提供内存管理、数据压缩和处理优化功能
 */

import type { ChannelData, DecoderResult } from './types';
import { getPerformanceMemory } from './performanceMemory';

/**
 * 内存使用统计
 */
export interface MemoryStats {
  /** 已使用堆内存（字节） */
  usedHeapSize: number;
  /** 总堆内存（字节） */
  totalHeapSize: number;
  /** 堆使用率（百分比） */
  heapUsagePercent: number;
  /** 堆内存限制（字节） */
  heapSizeLimit: number;
  /** 外部内存使用（字节） */
  externalMemory?: number;
}

/**
 * 处理性能统计
 */
export interface ProcessingStats {
  /** 处理开始时间 */
  startTime: number;
  /** 处理结束时间 */
  endTime: number;
  /** 总处理时间（毫秒） */
  totalTime: number;
  /** 处理的样本数 */
  samplesProcessed: number;
  /** 处理速度（样本/秒） */
  processingSpeed: number;
  /** 产生的结果数 */
  resultsGenerated: number;
  /** 内存使用峰值 */
  peakMemoryUsage: number;
}

/**
 * 数据压缩选项
 */
export interface CompressionOptions {
  /** 压缩算法 */
  algorithm: 'rle' | 'delta' | 'lz4' | 'none';
  /** 压缩阈值（字节） */
  threshold: number;
  /** 是否启用压缩 */
  enabled: boolean;
}

/**
 * 批处理配置
 */
export interface BatchConfig {
  /** 批处理大小 */
  batchSize: number;
  /** 批处理间隔（毫秒） */
  batchInterval: number;
  /** 最大批处理数量 */
  maxBatches: number;
}

/**
 * 性能优化器类
 */
export class PerformanceOptimizer {
  private memoryThreshold = 0.8; // 80% 内存使用阈值
  private gcTriggerThreshold = 0.9; // 90% 触发垃圾回收
  private compressionOptions: CompressionOptions;
  private batchConfig: BatchConfig;
  /** 进行中的延迟定时器句柄，用于 dispose/异常路径 clearTimeout */
  private delayTimer: ReturnType<typeof setTimeout> | undefined;
  /** 进行中 delay 的 resolver，dispose 时释放等待方 */
  private delayResolver: (() => void) | null = null;

  constructor(
    compressionOptions: Partial<CompressionOptions> = {},
    batchConfig: Partial<BatchConfig> = {}
  ) {
    this.compressionOptions = {
      algorithm: 'rle',
      threshold: 1024 * 1024, // 1MB
      enabled: true,
      ...compressionOptions
    };

    this.batchConfig = {
      batchSize: 1000,
      batchInterval: 10,
      maxBatches: 10,
      ...batchConfig
    };
  }

  /**
   * 清理进行中的延迟定时器，避免异常/停止路径残留 setTimeout。
   */
  public dispose(): void {
    clearTimeout(this.delayTimer);
    this.delayTimer = undefined;
    if (this.delayResolver) {
      const resolve = this.delayResolver;
      this.delayResolver = null;
      resolve();
    }
  }

  /**
   * 可清理的延迟：记录 timer 与 resolver，便于 dispose 中断等待。
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>(resolve => {
      this.delayResolver = resolve;
      this.delayTimer = setTimeout(() => {
        this.delayTimer = undefined;
        this.delayResolver = null;
        resolve();
      }, ms);
    });
  }

  /**
   * 获取内存使用统计
   */
  public getMemoryStats(): MemoryStats {
    const memory = getPerformanceMemory();
    if (memory) {
      return {
        usedHeapSize: memory.usedJSHeapSize,
        totalHeapSize: memory.totalJSHeapSize,
        heapUsagePercent: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        heapSizeLimit: memory.jsHeapSizeLimit,
        externalMemory: memory.externalMemory
      };
    }

    // 浏览器不支持 performance.memory 时的模拟值
    return {
      usedHeapSize: 0,
      totalHeapSize: 0,
      heapUsagePercent: 0,
      heapSizeLimit: 0
    };
  }

  /**
   * 检查是否需要内存优化
   */
  public shouldOptimizeMemory(): boolean {
    const stats = this.getMemoryStats();
    return stats.heapUsagePercent > this.memoryThreshold * 100;
  }

  /**
   * 建议垃圾回收
   */
  public suggestGarbageCollection(): boolean {
    const stats = this.getMemoryStats();
    return stats.heapUsagePercent > this.gcTriggerThreshold * 100;
  }

  /**
   * 压缩通道数据
   */
  public compressChannelData(data: ChannelData[]): ChannelData[] {
    if (!this.compressionOptions.enabled) {
      return data;
    }

    return data.map(channel => {
      if (!channel.samples || channel.samples.length < this.compressionOptions.threshold) {
        return channel;
      }

      const compressedSamples = this.compressUint8Array(
        channel.samples,
        this.compressionOptions.algorithm
      );

      console.log(
        `📦 通道 ${channel.channelNumber} 压缩: ${channel.samples.length} -> ${compressedSamples.length} 字节 (${((1 - compressedSamples.length / channel.samples.length) * 100).toFixed(1)}% 节省)`
      );

      return {
        ...channel,
        samples: compressedSamples,
        compressed: true,
        compressionAlgorithm: this.compressionOptions.algorithm
      } as ChannelData & { compressed: boolean; compressionAlgorithm: string };
    });
  }

  /**
   * 解压通道数据
   */
  public decompressChannelData(data: ChannelData[]): ChannelData[] {
    return data.map(channel => {
      const compressedChannel = channel as ChannelData & { compressed?: boolean; compressionAlgorithm?: string };

      if (!compressedChannel.compressed || !channel.samples) {
        return channel;
      }

      const decompressedSamples = this.decompressUint8Array(
        channel.samples,
        compressedChannel.compressionAlgorithm || 'rle'
      );

      return {
        ...channel,
        samples: decompressedSamples
      };
    });
  }

  /**
   * RLE 压缩
   */
  private compressRLE(data: Uint8Array): Uint8Array {
    const compressed: number[] = [];
    let i = 0;

    while (i < data.length) {
      const value = data[i];
      let count = 1;

      // 计算连续相同值的数量
      while (i + count < data.length && data[i + count] === value && count < 255) {
        count++;
      }

      compressed.push(count, value);
      i += count;
    }

    return new Uint8Array(compressed);
  }

  /**
   * RLE 解压
   */
  private decompressRLE(data: Uint8Array): Uint8Array {
    const decompressed: number[] = [];

    for (let i = 0; i < data.length; i += 2) {
      const count = data[i];
      const value = data[i + 1];

      for (let j = 0; j < count; j++) {
        decompressed.push(value);
      }
    }

    return new Uint8Array(decompressed);
  }

  /**
   * Delta 压缩（适用于缓慢变化的信号）
   */
  private compressDelta(data: Uint8Array): Uint8Array {
    if (data.length === 0) return data;

    const compressed: number[] = [data[0]]; // 第一个值不压缩

    for (let i = 1; i < data.length; i++) {
      const delta = data[i] - data[i - 1];
      compressed.push(delta + 128); // 偏移到 0-255 范围
    }

    return new Uint8Array(compressed);
  }

  /**
   * Delta 解压
   */
  private decompressDelta(data: Uint8Array): Uint8Array {
    if (data.length === 0) return data;

    const decompressed: number[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
      const delta = data[i] - 128;
      const value = decompressed[i - 1] + delta;
      decompressed.push(Math.max(0, Math.min(255, value)));
    }

    return new Uint8Array(decompressed);
  }

  /**
   * 压缩 Uint8Array
   */
  private compressUint8Array(data: Uint8Array, algorithm: string): Uint8Array {
    switch (algorithm) {
      case 'rle':
        return this.compressRLE(data);
      case 'delta':
        return this.compressDelta(data);
      case 'lz4':
        // 简化的 LZ4 实现（实际项目中应使用专业库）
        return this.compressRLE(data); // 暂时回退到 RLE
      case 'none':
      default:
        return data;
    }
  }

  /**
   * 解压 Uint8Array
   */
  private decompressUint8Array(data: Uint8Array, algorithm: string): Uint8Array {
    switch (algorithm) {
      case 'rle':
        return this.decompressRLE(data);
      case 'delta':
        return this.decompressDelta(data);
      case 'lz4':
        return this.decompressRLE(data); // 暂时回退到 RLE
      case 'none':
      default:
        return data;
    }
  }

  /**
   * 批处理解码结果
   */
  public async processBatch<T>(
    items: T[],
    processor: (_item: T) => Promise<DecoderResult[]>,
    onBatchComplete?: (_results: DecoderResult[], _batchIndex: number) => void
  ): Promise<DecoderResult[]> {
    const allResults: DecoderResult[] = [];
    const batches = this.createBatches(items, this.batchConfig.batchSize);

    console.log(`🔄 开始批处理: ${batches.length}个批次, 每批${this.batchConfig.batchSize}项`);

    try {
      for (let i = 0; i < batches.length && i < this.batchConfig.maxBatches; i++) {
        const batch = batches[i];
        const batchResults: DecoderResult[] = [];

        for (const item of batch) {
          const results = await processor(item);
          batchResults.push(...results);
        }

        allResults.push(...batchResults);

        if (onBatchComplete) {
          onBatchComplete(batchResults, i);
        }

        // 检查内存使用并在需要时暂停
        if (this.shouldOptimizeMemory()) {
          console.log('⚠️ 内存使用过高，暂停批处理进行优化...');
          await this.performMemoryOptimization();
        }

        // 批次间延迟（使用可清理的 delay，避免异常路径残留 setTimeout）
        if (i < batches.length - 1) {
          await this.delay(this.batchConfig.batchInterval);
        }
      }

      console.log(`✅ 批处理完成: 处理了${batches.length}个批次, 产生${allResults.length}个结果`);
      return allResults;
    } catch (error) {
      // 异常路径清理悬挂的批次间定时器
      this.dispose();
      throw error;
    } finally {
      // 防御性清理：无论成功/失败都释放可能残留的定时器
      this.dispose();
    }
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * 执行内存优化
   */
  public async performMemoryOptimization(): Promise<void> {
    const beforeStats = this.getMemoryStats();

    console.log(`🧹 开始内存优化: 当前使用 ${(beforeStats.usedHeapSize / 1024 / 1024).toFixed(1)}MB`);

    // 建议垃圾回收
    const manualGc = (global as unknown as { gc?: () => void }).gc;
    if (this.suggestGarbageCollection() && manualGc) {
      manualGc();
      console.log('♻️ 手动触发垃圾回收');
    }

    // 等待一段时间让垃圾回收完成（可清理的 delay）
    await this.delay(100);

    const afterStats = this.getMemoryStats();
    const memorySaved = beforeStats.usedHeapSize - afterStats.usedHeapSize;

    console.log(
      `✅ 内存优化完成: 释放 ${(memorySaved / 1024 / 1024).toFixed(1)}MB, 当前使用 ${(afterStats.usedHeapSize / 1024 / 1024).toFixed(1)}MB`
    );
  }

  /**
   * 优化解码结果
   * 移除重复和冗余的结果
   */
  public optimizeDecoderResults(results: DecoderResult[]): DecoderResult[] {
    if (results.length === 0) return results;

    const optimized: DecoderResult[] = [];
    let lastResult: DecoderResult | null = null;

    for (const result of results) {
      // 检查是否与上一个结果重复
      if (lastResult && this.areResultsSimilar(lastResult, result)) {
        // 合并相似的结果
        lastResult.endSample = result.endSample;
        continue;
      }

      // 检查结果是否有效
      if (this.isValidResult(result)) {
        optimized.push(result);
        lastResult = result;
      }
    }

    const optimizationRatio = ((results.length - optimized.length) / results.length) * 100;

    if (optimizationRatio > 5) { // 只有优化超过5%时才记录
      console.log(
        `🎯 解码结果优化: ${results.length} -> ${optimized.length} (${optimizationRatio.toFixed(1)}% 优化)`
      );
    }

    return optimized;
  }

  /**
   * 检查两个结果是否相似
   */
  private areResultsSimilar(result1: DecoderResult, result2: DecoderResult): boolean {
    return (
      result1.annotationType === result2.annotationType &&
      result1.values.length === result2.values.length &&
      result1.values.every((value, index) => value === result2.values[index]) &&
      result2.startSample - result1.endSample <= 1 // 相邻或重叠
    );
  }

  /**
   * 验证结果是否有效
   */
  private isValidResult(result: DecoderResult): boolean {
    return (
      result.startSample >= 0 &&
      result.endSample >= result.startSample &&
      (result.annotationType === undefined || result.annotationType >= 0) &&
      result.values.length > 0 &&
      result.values.every(value => typeof value === 'string' && value.length > 0)
    );
  }

  /**
   * 生成处理性能报告
   */
  public generatePerformanceReport(
    startTime: number,
    endTime: number,
    samplesProcessed: number,
    resultsGenerated: number,
    peakMemoryUsage: number
  ): ProcessingStats {
    const totalTime = endTime - startTime;
    const processingSpeed = samplesProcessed / (totalTime / 1000);

    return {
      startTime,
      endTime,
      totalTime,
      samplesProcessed,
      processingSpeed,
      resultsGenerated,
      peakMemoryUsage
    };
  }

  /**
   * 获取优化建议
   */
  public getOptimizationSuggestions(stats: ProcessingStats): string[] {
    const suggestions: string[] = [];

    if (stats.processingSpeed < 100000) { // 低于10万样本/秒
      suggestions.push('考虑增加块大小以提高处理效率');
    }

    if (stats.peakMemoryUsage > 100 * 1024 * 1024) { // 大于100MB
      suggestions.push('启用数据压缩以减少内存使用');
    }

    if (stats.totalTime > 10000) { // 超过10秒
      suggestions.push('考虑使用流式处理以提高响应性');
    }

    if (stats.resultsGenerated === 0) {
      suggestions.push('检查解码器配置和输入数据');
    }

    return suggestions;
  }

  /**
   * 设置内存阈值
   */
  public setMemoryThreshold(threshold: number): void {
    this.memoryThreshold = Math.max(0.1, Math.min(0.95, threshold));
  }

  /**
   * 设置压缩选项
   */
  public setCompressionOptions(options: Partial<CompressionOptions>): void {
    this.compressionOptions = { ...this.compressionOptions, ...options };
  }

  /**
   * 设置批处理配置
   */
  public setBatchConfig(config: Partial<BatchConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config };
  }
}

// 创建全局性能优化器实例
export const performanceOptimizer = new PerformanceOptimizer();
