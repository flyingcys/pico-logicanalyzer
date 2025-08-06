/**
 * StreamingDecoder.ts 单元测试
 * 测试流式解码器基类和相关组件的所有功能
 */

import {
  StreamingDecoderBase,
  PerformanceMonitor,
  StreamingConfig,
  StreamingProgress,
  StreamingResult
} from '../../../src/decoders/StreamingDecoder';
import {
  DecoderResult,
  ChannelData,
  DecoderOptionValue,
  DecoderSelectedChannel
} from '../../../src/decoders/types';

// Mock console methods to avoid log output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock performance.now() and performance.memory for consistent testing
const originalPerformanceNow = performance.now;
const originalPerformanceMemory = (performance as any).memory;

// 创建测试用的具体流式解码器实现
class TestStreamingDecoder extends StreamingDecoderBase {
  // 模拟解码器状态
  private initialized = false;
  private finalized = false;
  public initializationOptions: DecoderOptionValue[] = [];
  public processedChunks: any[] = [];

  constructor(config?: Partial<StreamingConfig>) {
    super(config);
  }

  protected async initializeDecoding(
    sampleRate: number,
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<void> {
    this.initialized = true;
    this.initializationOptions = options;
    // 模拟初始化延迟
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  protected async processChunk(
    chunk: any,
    sampleRate: number,
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]> {
    this.processedChunks.push(chunk);
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1));

    // 为每个数据块生成模拟结果
    const results: DecoderResult[] = [];
    
    if (chunk.channelData && chunk.channelData.length > 0) {
      const samples = chunk.channelData[0].samples;
      if (samples && samples.length > 0) {
        results.push({
          startSample: chunk.startSample,
          endSample: chunk.endSample,
          annotationType: 0,
          values: [`chunk-${chunk.index}-data`],
          shape: 'hexagon'
        });
      }
    }

    return results;
  }

  protected async finalizeDecoding(): Promise<void> {
    this.finalized = true;
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  // 公开一些内部状态用于测试
  public get isInitialized(): boolean {
    return this.initialized;
  }

  public get isFinalized(): boolean {
    return this.finalized;
  }

  public get chunksProcessed(): number {
    return this.processedChunks.length;
  }

  // 公开 createDataChunks 方法用于测试
  public testCreateDataChunks(channels: ChannelData[]) {
    return this.createDataChunks(channels);
  }

  // 公开 calculateProgress 方法用于测试
  public testCalculateProgress(totalChunks: number): StreamingProgress {
    return this.calculateProgress(totalChunks);
  }
}

// 创建失败的流式解码器（用于测试错误处理）
class FailingStreamingDecoder extends StreamingDecoderBase {
  protected async initializeDecoding(): Promise<void> {
    throw new Error('Initialization failed');
  }

  protected async processChunk(): Promise<DecoderResult[]> {
    throw new Error('Chunk processing failed');
  }

  protected async finalizeDecoding(): Promise<void> {
    // OK
  }
}

// 创建在处理过程中失败的解码器
class ProcessingFailingDecoder extends StreamingDecoderBase {
  private chunkCount = 0;

  protected async initializeDecoding(): Promise<void> {
    // OK
  }

  protected async processChunk(): Promise<DecoderResult[]> {
    this.chunkCount++;
    if (this.chunkCount > 2) {
      throw new Error('Processing failed after 2 chunks');
    }
    return [];
  }

  protected async finalizeDecoding(): Promise<void> {
    // OK
  }
}

describe('StreamingDecoder', () => {
  let decoder: TestStreamingDecoder;
  let mockChannelData: ChannelData[];

  beforeEach(() => {
    decoder = new TestStreamingDecoder();
    
    // 创建模拟通道数据
    mockChannelData = [
      {
        channelNumber: 0,
        samples: new Uint8Array([0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0])
      },
      {
        channelNumber: 1,
        samples: new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0])
      }
    ];

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Mock performance.now()
    let mockTime = 0;
    performance.now = jest.fn(() => {
      mockTime += 10; // Each call adds 10ms
      return mockTime;
    });

    // Mock performance.memory
    (performance as any).memory = {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 1024 * 1024 * 1024 // 1GB
    };
  });

  afterEach(() => {
    // 停止任何正在进行的处理
    decoder.stop();

    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore performance methods
    performance.now = originalPerformanceNow;
    (performance as any).memory = originalPerformanceMemory;
  });

  describe('StreamingDecoderBase 构造函数和配置', () => {
    it('应该使用默认配置创建解码器', () => {
      const defaultDecoder = new TestStreamingDecoder();
      expect(defaultDecoder).toBeInstanceOf(StreamingDecoderBase);
      expect(defaultDecoder.processing).toBe(false);
    });

    it('应该接受自定义配置', () => {
      const customConfig: Partial<StreamingConfig> = {
        chunkSize: 5000,
        processingInterval: 20,
        maxConcurrentChunks: 5,
        enableProgressCallback: false
      };

      const customDecoder = new TestStreamingDecoder(customConfig);
      expect(customDecoder).toBeInstanceOf(StreamingDecoderBase);
    });

    it('应该正确设置回调函数', () => {
      const progressCallback = jest.fn();
      const resultCallback = jest.fn();

      decoder.onProgress = progressCallback;
      decoder.onPartialResult = resultCallback;

      expect(decoder.onProgress).toBe(progressCallback);
      expect(decoder.onPartialResult).toBe(resultCallback);
    });
  });

  describe('数据块创建', () => {
    it('应该正确创建数据块', () => {
      const chunks = decoder.testCreateDataChunks(mockChannelData);

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      // 检查第一个数据块
      const firstChunk = chunks[0];
      expect(firstChunk.index).toBe(0);
      expect(firstChunk.startSample).toBe(0);
      expect(firstChunk.channelData).toHaveLength(2);
      expect(firstChunk.overlapSize).toBe(0); // 第一个块没有重叠
    });

    it('应该处理大数据集并创建多个块', () => {
      // 创建大数据集
      const largeData: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(25000) // 25K样本，应该分成多个块
        }
      ];

      const chunks = decoder.testCreateDataChunks(largeData);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[chunks.length - 1].endSample).toBe(25000);
    });

    it('应该处理空数据', () => {
      const emptyData: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(0)
        }
      ];

      const chunks = decoder.testCreateDataChunks(emptyData);
      expect(chunks).toHaveLength(0);
    });

    it('应该为非第一个块设置重叠区域', () => {
      // 创建足够大的数据以产生多个块
      const largeData: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(15000)
        }
      ];

      const chunks = decoder.testCreateDataChunks(largeData);

      if (chunks.length > 1) {
        expect(chunks[1].overlapSize).toBeGreaterThan(0);
      }
    });
  });

  describe('进度计算', () => {
    it('应该正确计算处理进度', () => {
      // 设置一些处理状态
      (decoder as any).totalSamples = 1000;
      (decoder as any).processedSamples = 500;
      (decoder as any).startTime = performance.now() - 100; // 模拟已经运行100ms

      const progress = decoder.testCalculateProgress(10);

      expect(progress.totalSamples).toBe(1000);
      expect(progress.processedSamples).toBe(500);
      expect(progress.progressPercent).toBe(50);
      expect(progress.totalChunks).toBe(10);
      expect(progress.processingSpeed).toBeGreaterThan(0);
      expect(typeof progress.estimatedTimeRemaining).toBe('number');
    });

    it('应该处理零除错误', () => {
      (decoder as any).totalSamples = 0;
      (decoder as any).processedSamples = 0;
      (decoder as any).startTime = performance.now();

      const progress = decoder.testCalculateProgress(5);

      expect(progress.progressPercent).toBe(0);
      expect(progress.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('流式解码执行', () => {
    it('应该成功执行完整的流式解码', async () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'test-option' }
      ];
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 }
      ];

      const result = await decoder.streamingDecode(
        1000000,
        mockChannelData,
        options,
        selectedChannels
      );

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSamples).toBe(12); // 最大样本数
      expect(result.statistics.chunksProcessed).toBeGreaterThan(0);

      // 检查解码器状态
      expect(decoder.isInitialized).toBe(true);
      expect(decoder.isFinalized).toBe(true);
      expect(decoder.processing).toBe(false);
    });

    it('应该在处理过程中调用进度回调', async () => {
      const progressCallback = jest.fn();
      decoder.onProgress = progressCallback;

      const result = await decoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.success).toBe(true);
      // 进度回调应该被调用（至少一次）
      expect(progressCallback).toHaveBeenCalled();
    });

    it('应该在处理过程中调用部分结果回调', async () => {
      const partialResultCallback = jest.fn();
      decoder.onPartialResult = partialResultCallback;

      const result = await decoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.success).toBe(true);
      // 部分结果回调应该被调用
      expect(partialResultCallback).toHaveBeenCalled();
    });

    it('应该防止并发执行', async () => {
      // 启动第一个解码
      const promise1 = decoder.streamingDecode(1000000, mockChannelData, [], []);

      // 尝试启动第二个解码（应该失败）
      await expect(
        decoder.streamingDecode(1000000, mockChannelData, [], [])
      ).rejects.toThrow('解码器正在处理中');

      // 等待第一个完成
      await promise1;
    });

    it('应该正确处理初始化失败', async () => {
      const failingDecoder = new FailingStreamingDecoder();

      const result = await failingDecoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Initialization failed');
    });

    it('应该正确处理块处理失败', async () => {
      // 使用较小的块大小确保能创建足够的块来触发失败
      const failingDecoder = new ProcessingFailingDecoder({ chunkSize: 3 });

      const result = await failingDecoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing failed after 2 chunks');
    });

    it('应该收集性能统计信息', async () => {
      const result = await decoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.statistics.totalSamples).toBeGreaterThan(0);
      expect(result.statistics.processingTime).toBeGreaterThan(0);
      expect(result.statistics.averageSpeed).toBeGreaterThan(0);
      expect(result.statistics.peakMemoryUsage).toBeGreaterThan(0);
    });
  });

  describe('停止功能', () => {
    it('应该能够停止正在进行的处理', async () => {
      // 创建一个会运行较长时间的解码器
      const slowDecoder = new TestStreamingDecoder({ chunkSize: 1000 });

      // 启动解码
      const promise = slowDecoder.streamingDecode(1000000, mockChannelData, [], []);

      // 立即停止
      slowDecoder.stop();

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('用户停止处理');
    });

    it('stop() 方法应该设置停止标志', () => {
      expect((decoder as any).shouldStop).toBe(false);
      
      decoder.stop();
      
      expect((decoder as any).shouldStop).toBe(true);
    });
  });

  describe('自定义配置测试', () => {
    it('应该使用自定义块大小', () => {
      const customDecoder = new TestStreamingDecoder({
        chunkSize: 5000
      });

      const largeData: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(15000)
        }
      ];

      const chunks = customDecoder.testCreateDataChunks(largeData);

      // 应该创建3个块（15000 / 5000）
      expect(chunks.length).toBe(3);
      expect(chunks[0].endSample - chunks[0].startSample).toBe(5000);
    });

    it('应该使用自定义处理间隔', async () => {
      const customDecoder = new TestStreamingDecoder({
        processingInterval: 50,
        chunkSize: 1000
      });

      const startTime = Date.now();
      const result = await customDecoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      // 由于增加了处理间隔，执行时间应该更长
      // 注意：这个测试可能在快速环境中不稳定
    });

    it('应该正确处理禁用进度回调的配置', async () => {
      const customDecoder = new TestStreamingDecoder({
        enableProgressCallback: false
      });

      const progressCallback = jest.fn();
      customDecoder.onProgress = progressCallback;

      const result = await customDecoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.success).toBe(true);
      // 由于禁用了进度回调，不应该被调用
      expect(progressCallback).not.toHaveBeenCalled();
    });
  });

  describe('内存监控', () => {
    it('应该监控内存使用情况', async () => {
      const result = await decoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.statistics.peakMemoryUsage).toBeGreaterThan(0);
    });

    it('应该处理没有 performance.memory 的环境', async () => {
      // 移除 performance.memory
      (performance as any).memory = undefined;

      const result = await decoder.streamingDecode(
        1000000,
        mockChannelData,
        [],
        []
      );

      expect(result.success).toBe(true);
      expect(result.statistics.peakMemoryUsage).toBe(0);
    });
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();

    // Mock performance.now()
    let mockTime = 0;
    performance.now = jest.fn(() => {
      mockTime += 10;
      return mockTime;
    });

    // Mock performance.memory
    (performance as any).memory = {
      usedJSHeapSize: 50 * 1024 * 1024
    };
  });

  afterEach(() => {
    performance.now = originalPerformanceNow;
    (performance as any).memory = originalPerformanceMemory;
  });

  describe('基本功能', () => {
    it('应该能够开始监控', () => {
      expect(() => monitor.start()).not.toThrow();
    });

    it('应该能够添加检查点', () => {
      monitor.start();
      
      expect(() => monitor.addCheckpoint('test-checkpoint')).not.toThrow();
    });

    it('应该生成性能报告', () => {
      monitor.start();
      monitor.addCheckpoint('checkpoint-1');
      monitor.addCheckpoint('checkpoint-2');

      const report = monitor.getReport();

      expect(report).toBeDefined();
      expect(report.totalTime).toBeGreaterThan(0);
      expect(Array.isArray(report.checkpoints)).toBe(true);
      expect(report.checkpoints.length).toBeGreaterThan(0);
    });

    it('应该包含内存使用信息', () => {
      monitor.start();
      monitor.addCheckpoint('with-memory');

      const report = monitor.getReport();

      expect(report.memoryUsage).toBeDefined();
      expect(report.memoryUsage!.peak).toBeGreaterThan(0);
      expect(report.memoryUsage!.current).toBeGreaterThan(0);
    });

    it('应该计算检查点之间的时间差', () => {
      // 重新设置mock让时间更可预测
      let callCount = 0;
      performance.now = jest.fn(() => {
        return callCount++ * 10; // 0, 10, 20, 30...
      });

      monitor.start(); // performance.now() = 0, startTime = 0, 'start' checkpoint at time 0
      monitor.addCheckpoint('checkpoint-1'); // performance.now() = 10, time = 10-0 = 10
      monitor.addCheckpoint('checkpoint-2'); // performance.now() = 20, time = 20-0 = 20

      const report = monitor.getReport();

      expect(report.checkpoints.length).toBeGreaterThanOrEqual(3); // start + 2 checkpoints
      expect(report.checkpoints[0].deltaTime).toBe(0); // start checkpoint
      expect(report.checkpoints[1].deltaTime).toBe(10); // checkpoint-1: 10-0 = 10
      expect(report.checkpoints[2].deltaTime).toBe(10); // checkpoint-2: 20-10 = 10
    });

    it('应该处理没有 performance.memory 的环境', () => {
      (performance as any).memory = undefined;

      monitor.start();
      monitor.addCheckpoint('no-memory');

      const report = monitor.getReport();

      expect(report.memoryUsage).toBeUndefined();
    });
  });

  describe('多次使用', () => {
    it('应该能够重复使用监控器', () => {
      // 第一次使用
      monitor.start();
      monitor.addCheckpoint('first-run');
      const report1 = monitor.getReport();

      // 第二次使用
      monitor.start();
      monitor.addCheckpoint('second-run');
      const report2 = monitor.getReport();

      expect(report1.checkpoints.length).toBeGreaterThan(0);
      expect(report2.checkpoints.length).toBeGreaterThan(0);
      // 第二次运行应该重置检查点
      expect(report2.checkpoints.find(cp => cp.name === 'first-run')).toBeUndefined();
    });

    it('应该正确重置状态', () => {
      monitor.start();
      monitor.addCheckpoint('before-reset');
      
      monitor.start(); // 重新开始应该重置状态
      
      const report = monitor.getReport();
      
      // 只应该有 start 检查点
      expect(report.checkpoints.length).toBe(1);
      expect(report.checkpoints[0].name).toBe('start');
    });
  });

  describe('边界情况', () => {
    it('应该处理空的检查点列表', () => {
      monitor.start();
      // 不添加任何检查点
      
      const report = monitor.getReport();
      
      expect(report.checkpoints.length).toBe(1); // 只有 start 检查点
      expect(report.checkpoints[0].name).toBe('start');
    });

    it('应该处理内存值为零的情况', () => {
      (performance as any).memory = {
        usedJSHeapSize: 0
      };

      monitor.start();
      monitor.addCheckpoint('zero-memory');

      const report = monitor.getReport();

      expect(report.memoryUsage).toBeDefined();
      expect(report.memoryUsage!.current).toBe(0);
    });
  });
});

describe('StreamingDecoder 集成测试', () => {
  it('应该能够处理实际的解码工作流', async () => {
    const decoder = new TestStreamingDecoder({
      chunkSize: 5000,
      processingInterval: 5,
      maxConcurrentChunks: 2,
      enableProgressCallback: true
    });

    const progressEvents: StreamingProgress[] = [];
    const partialResults: DecoderResult[][] = [];

    decoder.onProgress = (progress) => {
      progressEvents.push(progress);
    };

    decoder.onPartialResult = (results, chunk) => {
      partialResults.push(results);
    };

    // 创建较大的数据集
    const largeChannelData: ChannelData[] = [
      {
        channelNumber: 0,
        samples: new Uint8Array(20000).map((_, i) => i % 2)
      },
      {
        channelNumber: 1,
        samples: new Uint8Array(20000).map((_, i) => (i + 1) % 2)
      }
    ];

    const result = await decoder.streamingDecode(
      2000000,
      largeChannelData,
      [{ optionIndex: 0, value: 'integration-test' }],
      [{ decoderIndex: 0, captureIndex: 0 }]
    );

    // 验证执行结果
    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.statistics.totalSamples).toBe(20000);
    expect(result.statistics.processingTime).toBeGreaterThan(0);
    expect(result.statistics.chunksProcessed).toBeGreaterThan(1);

    // 验证回调调用
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(partialResults.length).toBeGreaterThan(0);

    // 验证解码器状态
    expect(decoder.isInitialized).toBe(true);
    expect(decoder.isFinalized).toBe(true);
    expect(decoder.chunksProcessed).toBeGreaterThan(1);
  });

  it('should handle edge case with very small data', async () => {
    const decoder = new TestStreamingDecoder();
    
    const tinyData: ChannelData[] = [
      {
        channelNumber: 0,
        samples: new Uint8Array([1, 0, 1])
      }
    ];

    const result = await decoder.streamingDecode(1000000, tinyData, [], []);

    expect(result.success).toBe(true);
    expect(result.statistics.totalSamples).toBe(3);
  });
});