/**
 * 导出性能优化器
 * 专门处理大数据集导出的性能优化和内存管理
 */

export interface PerformanceConfig {
  maxMemoryUsage: number; // 最大内存使用量 (MB)
  chunkSize: number; // 分块大小
  enableCompression: boolean; // 启用压缩
  useWebWorkers: boolean; // 使用Web Workers
  maxConcurrentChunks: number; // 最大并发处理块数
}

export interface PerformanceMetrics {
  processingTime: number; // 处理时间 (ms)
  memoryUsage: number; // 内存使用 (MB)
  throughput: number; // 吞吐量 (samples/sec)
  compressionRatio?: number; // 压缩比
}

export class ExportPerformanceOptimizer {
  private config: PerformanceConfig;
  private memoryMonitor: MemoryMonitor;
  private chunkProcessor: ChunkProcessor;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = {
      maxMemoryUsage: 512, // 默认512MB
      chunkSize: 50000, // 默认5万样本
      enableCompression: true,
      useWebWorkers: false, // 暂时禁用，需要额外配置
      maxConcurrentChunks: 3,
      ...config
    };

    this.memoryMonitor = new MemoryMonitor(this.config.maxMemoryUsage);
    this.chunkProcessor = new ChunkProcessor(this.config);
  }

  /**
   * 优化导出配置
   */
  optimizeConfig(dataSize: number, channels: number): PerformanceConfig {
    // 根据数据量和系统性能动态调整配置
    const estimatedMemory = this.estimateMemoryUsage(dataSize, channels);

    const optimizedConfig = { ...this.config };

    // 如果估计内存使用量过大，减小块大小
    if (estimatedMemory > this.config.maxMemoryUsage) {
      const reduction = Math.ceil(estimatedMemory / this.config.maxMemoryUsage);
      optimizedConfig.chunkSize = Math.floor(this.config.chunkSize / reduction);
      optimizedConfig.chunkSize = Math.max(1000, optimizedConfig.chunkSize); // 最小1000样本
    }

    // 对于小数据集，禁用分块处理
    if (dataSize < 10000) {
      optimizedConfig.chunkSize = dataSize;
      optimizedConfig.maxConcurrentChunks = 1;
    }

    // 对于超大数据集，启用更激进的优化
    if (dataSize > 1000000) {
      optimizedConfig.enableCompression = true;
      optimizedConfig.maxConcurrentChunks = Math.min(5, optimizedConfig.maxConcurrentChunks);
    }

    return optimizedConfig;
  }

  /**
   * 处理大数据集导出
   */
  async processLargeDataset(
    data: any[],
    processor: (chunk: any[], chunkIndex: number) => Promise<string>,
    onProgress?: (progress: number, metrics: PerformanceMetrics) => void
  ): Promise<string[]> {
    const startTime = Date.now();
    const totalSamples = data.length;

    // 动态优化配置
    const optimizedConfig = this.optimizeConfig(totalSamples, 1);
    this.chunkProcessor.updateConfig(optimizedConfig);

    // 分块处理
    const chunks = this.chunkProcessor.splitIntoChunks(data);
    const results: string[] = [];

    let processedSamples = 0;
    const semaphore = new Semaphore(optimizedConfig.maxConcurrentChunks);

    // 并发处理块
    const chunkPromises = chunks.map(async (chunk, index) => {
      return semaphore.acquire(async () => {
        try {
          // 检查内存使用
          this.memoryMonitor.checkMemoryUsage();

          const result = await processor(chunk, index);
          processedSamples += chunk.length;

          // 报告进度
          if (onProgress) {
            const progress = (processedSamples / totalSamples) * 100;
            const metrics = this.calculateMetrics(startTime, processedSamples, totalSamples);
            onProgress(progress, metrics);
          }

          return result;
        } catch (error) {
          console.error(`Chunk ${index} processing failed:`, error);
          throw error;
        }
      });
    });

    // 等待所有块处理完成
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    return results;
  }

  /**
   * 压缩导出数据
   */
  async compressData(data: string, format: string): Promise<{ data: string; compressionRatio: number }> {
    if (!this.config.enableCompression) {
      return { data, compressionRatio: 1 };
    }

    const originalSize = data.length;
    let compressedData = data;

    try {
      switch (format.toLowerCase()) {
        case 'vcd':
          // VCD格式特殊压缩：移除重复的时间戳
          compressedData = this.compressVCD(data);
          break;
        case 'csv':
          // CSV格式压缩：重复值用省略号表示
          compressedData = this.compressCSV(data);
          break;
        case 'json':
          // JSON格式压缩：移除不必要的空格
          compressedData = JSON.stringify(JSON.parse(data));
          break;
        default:
          // 默认：简单的空白字符压缩
          compressedData = data.replace(/\s+/g, ' ').trim();
      }
    } catch (error) {
      console.warn('Data compression failed, using original data:', error);
      compressedData = data;
    }

    const compressionRatio = originalSize > 0 ? compressedData.length / originalSize : 1;
    return { data: compressedData, compressionRatio };
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(samples: number, channels: number): number {
    // 每个样本每个通道大约占用2字节 (包括JSON开销)
    const baseSizePerSample = channels * 2;
    // 加上JSON结构开销 (约30%)
    const totalSizeBytes = samples * baseSizePerSample * 1.3;
    // 转换为MB
    return totalSizeBytes / (1024 * 1024);
  }

  /**
   * 计算性能指标
   */
  private calculateMetrics(startTime: number, processedSamples: number, totalSamples: number): PerformanceMetrics {
    const processingTime = Date.now() - startTime;
    const throughput = processedSamples / (processingTime / 1000); // samples/sec
    const memoryUsage = this.memoryMonitor.getCurrentUsage();

    return {
      processingTime,
      memoryUsage,
      throughput
    };
  }

  /**
   * VCD格式压缩
   */
  private compressVCD(data: string): string {
    const lines = data.split('\n');
    const compressedLines: string[] = [];
    let lastTimestamp = -1;

    for (const line of lines) {
      if (line.startsWith('#')) {
        // 时间戳行
        const timestamp = parseInt(line.substring(1));
        if (timestamp === lastTimestamp) {
          continue; // 跳过重复的时间戳
        }
        lastTimestamp = timestamp;
      }
      compressedLines.push(line);
    }

    return compressedLines.join('\n');
  }

  /**
   * CSV格式压缩
   */
  private compressCSV(data: string): string {
    const lines = data.split('\n');
    if (lines.length < 2) return data;

    const compressedLines = [lines[0]]; // 保留头部
    let lastValues: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length === lastValues.length) {
        // 检查是否有重复值
        const compressedValues = values.map((value, index) => {
          return value === lastValues[index] ? '"' : value;
        });
        compressedLines.push(compressedValues.join(','));
      } else {
        compressedLines.push(lines[i]);
      }
      lastValues = values;
    }

    return compressedLines.join('\n');
  }
}

/**
 * 内存监控器
 */
class MemoryMonitor {
  private maxMemoryMB: number;
  private lastCheck: number = 0;

  constructor(maxMemoryMB: number) {
    this.maxMemoryMB = maxMemoryMB;
  }

  checkMemoryUsage(): void {
    const now = Date.now();
    if (now - this.lastCheck < 1000) return; // 每秒最多检查一次

    this.lastCheck = now;

    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);

      if (usedMB > this.maxMemoryMB * 0.9) {
        console.warn(`Memory usage high: ${usedMB.toFixed(1)}MB / ${this.maxMemoryMB}MB`);
        this.triggerGarbageCollection();
      }
    }
  }

  getCurrentUsage(): number {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      return memInfo.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  private triggerGarbageCollection(): void {
    // 建议垃圾回收 (仅在Chrome DevTools中有效)
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }
}

/**
 * 分块处理器
 */
class ChunkProcessor {
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  updateConfig(config: PerformanceConfig): void {
    this.config = config;
  }

  splitIntoChunks<T>(data: T[]): T[][] {
    const chunks: T[][] = [];
    const { chunkSize } = this.config;

    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    return chunks;
  }
}

/**
 * 信号量：限制并发数量
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.permits > 0) {
          this.permits--;
          task()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.permits++;
              if (this.waiting.length > 0) {
                const next = this.waiting.shift()!;
                next();
              }
            });
        } else {
          this.waiting.push(tryAcquire);
        }
      };

      tryAcquire();
    });
  }
}

// 导出单例实例
export const exportPerformanceOptimizer = new ExportPerformanceOptimizer();
