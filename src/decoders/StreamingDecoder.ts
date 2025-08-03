/**
 * 流式解码器基类
 * 基于 @logicanalyzer/Software 的解码架构
 * 提供大数据量的流式处理能力，避免UI线程阻塞
 */

import type {
  DecoderResult,
  ChannelData,
  DecoderOptionValue,
  DecoderSelectedChannel
} from './types';

/**
 * 流式处理配置
 */
export interface StreamingConfig {
  /** 数据块大小（样本数） */
  chunkSize: number;
  /** 处理间隔（毫秒） */
  processingInterval: number;
  /** 最大并发处理数 */
  maxConcurrentChunks: number;
  /** 是否启用进度回调 */
  enableProgressCallback: boolean;
}

/**
 * 流式处理进度信息
 */
export interface StreamingProgress {
  /** 总样本数 */
  totalSamples: number;
  /** 已处理的样本数 */
  processedSamples: number;
  /** 处理进度百分比 */
  progressPercent: number;
  /** 当前处理的数据块索引 */
  currentChunk: number;
  /** 总数据块数 */
  totalChunks: number;
  /** 已产生的结果数 */
  resultCount: number;
  /** 处理速度（样本/秒） */
  processingSpeed: number;
  /** 预计剩余时间（毫秒） */
  estimatedTimeRemaining: number;
}

/**
 * 流式处理结果
 */
export interface StreamingResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 所有解码结果 */
  results: DecoderResult[];
  /** 处理统计信息 */
  statistics: {
    totalSamples: number;
    totalResults: number;
    processingTime: number;
    averageSpeed: number;
    peakMemoryUsage: number;
    chunksProcessed: number;
  };
}

/**
 * 数据块
 */
interface DataChunk {
  /** 数据块索引 */
  index: number;
  /** 开始样本位置 */
  startSample: number;
  /** 结束样本位置 */
  endSample: number;
  /** 通道数据 */
  channelData: ChannelData[];
  /** 重叠区域大小（用于连续解码） */
  overlapSize: number;
}

/**
 * 流式解码器抽象基类
 */
export abstract class StreamingDecoderBase {
  protected config: StreamingConfig;
  protected isProcessing = false;
  protected shouldStop = false;
  protected startTime = 0;
  protected processedSamples = 0;
  protected totalSamples = 0;

  /** 进度回调函数 */
  public onProgress?: (_progress: StreamingProgress) => void;

  /** 结果回调函数（实时输出） */
  public onPartialResult?: (_results: DecoderResult[], _chunk: number) => void;

  constructor(config: Partial<StreamingConfig> = {}) {
    this.config = {
      chunkSize: 10000, // 默认每次处理10K样本
      processingInterval: 10, // 10ms间隔
      maxConcurrentChunks: 3, // 最多并发处理3个块
      enableProgressCallback: true,
      ...config
    };
  }

  /**
   * 流式解码入口方法
   */
  public async streamingDecode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<StreamingResult> {
    if (this.isProcessing) {
      throw new Error('解码器正在处理中，请等待完成或停止当前处理');
    }

    this.isProcessing = true;
    this.shouldStop = false;
    this.startTime = performance.now();
    this.processedSamples = 0;

    // 计算总样本数
    this.totalSamples = Math.max(...channels.map(ch => ch.samples?.length || 0));

    const allResults: DecoderResult[] = [];
    const statistics = {
      totalSamples: this.totalSamples,
      totalResults: 0,
      processingTime: 0,
      averageSpeed: 0,
      peakMemoryUsage: 0,
      chunksProcessed: 0
    };

    try {
      // 初始化解码器状态
      await this.initializeDecoding(sampleRate, options, selectedChannels);

      // 将数据分块
      const chunks = this.createDataChunks(channels);

      console.log(`📊 开始流式解码: ${chunks.length}个数据块, 总样本数: ${this.totalSamples}`);

      // 并发处理数据块
      const concurrentProcessor = new ConcurrentChunkProcessor(
        this.config.maxConcurrentChunks,
        this.config.processingInterval
      );

      await concurrentProcessor.processChunks(
        chunks,
        async (chunk: DataChunk) => {
          if (this.shouldStop) {
            throw new Error('用户停止处理');
          }

          // 处理单个数据块
          const chunkResults = await this.processChunk(
            chunk,
            sampleRate,
            options,
            selectedChannels
          );

          // 实时输出结果
          if (this.onPartialResult && chunkResults.length > 0) {
            this.onPartialResult(chunkResults, chunk.index);
          }

          allResults.push(...chunkResults);
          this.processedSamples = chunk.endSample;
          statistics.chunksProcessed++;

          // 更新进度
          if (this.config.enableProgressCallback && this.onProgress) {
            const progress = this.calculateProgress(chunks.length);
            this.onProgress(progress);
          }

          // 内存使用监控
          if (performance.memory) {
            statistics.peakMemoryUsage = Math.max(
              statistics.peakMemoryUsage,
              performance.memory.usedJSHeapSize
            );
          }

          return chunkResults;
        }
      );

      // 完成处理
      const endTime = performance.now();
      statistics.processingTime = endTime - this.startTime;
      statistics.totalResults = allResults.length;
      statistics.averageSpeed = this.totalSamples / (statistics.processingTime / 1000);

      console.log(`✅ 流式解码完成: ${allResults.length}个结果, 耗时: ${statistics.processingTime.toFixed(2)}ms`);

      return {
        success: true,
        results: allResults,
        statistics
      };

    } catch (error) {
      console.error('❌ 流式解码失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        results: allResults,
        statistics
      };
    } finally {
      this.isProcessing = false;
      await this.finalizeDecoding();
    }
  }

  /**
   * 停止流式处理
   */
  public stop(): void {
    this.shouldStop = true;
    console.log('🛑 流式解码停止请求已发送');
  }

  /**
   * 检查是否正在处理
   */
  public get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * 将数据分块
   */
  protected createDataChunks(channels: ChannelData[]): DataChunk[] {
    const chunks: DataChunk[] = [];
    const maxSamples = Math.max(...channels.map(ch => ch.samples?.length || 0));

    // 计算重叠区域大小（用于协议边界处理）
    const overlapSize = Math.min(1000, Math.floor(this.config.chunkSize * 0.1));

    for (let start = 0; start < maxSamples; start += this.config.chunkSize) {
      const end = Math.min(start + this.config.chunkSize, maxSamples);
      const actualStart = Math.max(0, start - overlapSize);

      // 为每个数据块创建通道数据切片
      const chunkChannelData: ChannelData[] = channels.map(channel => ({
        channelNumber: channel.channelNumber,
        samples: channel.samples?.slice(actualStart, end) || new Uint8Array()
      }));

      chunks.push({
        index: chunks.length,
        startSample: start,
        endSample: end,
        channelData: chunkChannelData,
        overlapSize: start > 0 ? overlapSize : 0
      });
    }

    return chunks;
  }

  /**
   * 计算处理进度
   */
  protected calculateProgress(totalChunks: number): StreamingProgress {
    const currentTime = performance.now();
    const elapsedTime = currentTime - this.startTime;
    const progressPercent = (this.processedSamples / this.totalSamples) * 100;
    const processingSpeed = this.processedSamples / (elapsedTime / 1000);
    const remainingSamples = this.totalSamples - this.processedSamples;
    const estimatedTimeRemaining = remainingSamples / processingSpeed * 1000;

    return {
      totalSamples: this.totalSamples,
      processedSamples: this.processedSamples,
      progressPercent,
      currentChunk: Math.floor((this.processedSamples / this.totalSamples) * totalChunks),
      totalChunks,
      resultCount: 0, // 将在具体实现中更新
      processingSpeed,
      estimatedTimeRemaining: isFinite(estimatedTimeRemaining) ? estimatedTimeRemaining : 0
    };
  }

  // 抽象方法 - 子类必须实现

  /**
   * 初始化解码状态
   */
  protected abstract initializeDecoding(
    _sampleRate: number,
    _options: DecoderOptionValue[],
    _selectedChannels: DecoderSelectedChannel[]
  ): Promise<void>;

  /**
   * 处理单个数据块
   */
  protected abstract processChunk(
    _chunk: DataChunk,
    _sampleRate: number,
    _options: DecoderOptionValue[],
    _selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]>;

  /**
   * 完成解码处理
   */
  protected abstract finalizeDecoding(): Promise<void>;
}

/**
 * 并发数据块处理器
 */
class ConcurrentChunkProcessor {
  private maxConcurrency: number;
  private processingInterval: number;
  private activeProcessors = 0;

  constructor(maxConcurrency: number, processingInterval: number) {
    this.maxConcurrency = maxConcurrency;
    this.processingInterval = processingInterval;
  }

  /**
   * 并发处理数据块
   */
  async processChunks<T>(
    chunks: DataChunk[],
    processor: (_chunk: DataChunk) => Promise<T>
  ): Promise<T[]> {
    const results: T[] = [];
    let chunkIndex = 0;

    return new Promise((resolve, reject) => {
      const processNext = async () => {
        if (chunkIndex >= chunks.length) {
          if (this.activeProcessors === 0) {
            resolve(results);
          }
          return;
        }

        if (this.activeProcessors >= this.maxConcurrency) {
          return;
        }

        const chunk = chunks[chunkIndex++];
        this.activeProcessors++;

        try {
          // 添加处理间隔以避免阻塞UI
          await new Promise(resolve => setTimeout(resolve, this.processingInterval));

          const result = await processor(chunk);
          results[chunk.index] = result;

        } catch (error) {
          reject(error);
          return;
        } finally {
          this.activeProcessors--;

          // 继续处理下一个块
          setTimeout(processNext, 0);
        }
      };

      // 启动初始处理器
      for (let i = 0; i < Math.min(this.maxConcurrency, chunks.length); i++) {
        processNext();
      }
    });
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private startTime = 0;
  private checkpoints: Array<{ name: string; time: number; memory?: number }> = [];

  /**
   * 开始监控
   */
  start(): void {
    this.startTime = performance.now();
    this.checkpoints = [];
    this.addCheckpoint('start');
  }

  /**
   * 添加检查点
   */
  addCheckpoint(name: string): void {
    const time = performance.now() - this.startTime;
    const memory = performance.memory?.usedJSHeapSize;

    this.checkpoints.push({ name, time, memory });
  }

  /**
   * 获取性能报告
   */
  getReport(): {
    totalTime: number;
    checkpoints: Array<{ name: string; time: number; deltaTime: number; memory?: number }>;
    memoryUsage?: {
      peak: number;
      current: number;
      growth: number;
    };
  } {
    const totalTime = performance.now() - this.startTime;

    const reportCheckpoints = this.checkpoints.map((checkpoint, index) => ({
      name: checkpoint.name,
      time: checkpoint.time,
      deltaTime: index > 0 ? checkpoint.time - this.checkpoints[index - 1].time : 0,
      memory: checkpoint.memory
    }));

    let memoryUsage;
    if (performance.memory) {
      const memoryValues = this.checkpoints
        .map(cp => cp.memory)
        .filter(m => m !== undefined) as number[];

      if (memoryValues.length > 0) {
        memoryUsage = {
          peak: Math.max(...memoryValues),
          current: performance.memory.usedJSHeapSize,
          growth: memoryValues[memoryValues.length - 1] - memoryValues[0]
        };
      }
    }

    return {
      totalTime,
      checkpoints: reportCheckpoints,
      memoryUsage
    };
  }
}
