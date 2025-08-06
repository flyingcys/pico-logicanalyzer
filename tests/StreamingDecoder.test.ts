/**
 * StreamingDecoder 性能测试
 * 目标：达到 95%+ 覆盖率和 100% 通过率
 * 参照 UTILS 模块测试成功经验
 */

import { 
  StreamingDecoderBase, 
  StreamingConfig, 
  StreamingProgress, 
  StreamingResult,
  PerformanceMonitor 
} from '../src/decoders/StreamingDecoder';
import {
  DecoderOptionValue,
  ChannelData,
  DecoderSelectedChannel,
  DecoderResult,
  DecoderOutputType
} from '../src/decoders/types';

// 测试用的具体流式解码器实现
class TestStreamingDecoder extends StreamingDecoderBase {
  private processedChunks: number = 0;
  private shouldThrowError = false;
  private errorMessage = '';
  private processingDelay = 0;

  constructor(config?: Partial<StreamingConfig>) {
    super(config);
  }

  // 设置测试参数
  setTestParameters(shouldThrowError: boolean, errorMessage: string = '', processingDelay: number = 0) {
    this.shouldThrowError = shouldThrowError;
    this.errorMessage = errorMessage;
    this.processingDelay = processingDelay;
  }

  protected async initializeDecoding(
    _sampleRate: number,
    _options: DecoderOptionValue[],
    _selectedChannels: DecoderSelectedChannel[]
  ): Promise<void> {
    this.processedChunks = 0;
    if (this.shouldThrowError && this.errorMessage === 'init') {
      throw new Error('初始化失败');
    }
  }

  protected async processChunk(
    chunk: any,
    _sampleRate: number,
    _options: DecoderOptionValue[],
    _selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]> {
    if (this.shouldThrowError && this.errorMessage === 'process') {
      throw new Error('处理块失败');
    }

    // 模拟处理延时
    if (this.processingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    }

    this.processedChunks++;

    // 模拟生成结果
    const results: DecoderResult[] = [];
    
    // 为每个数据块生成一些模拟结果
    for (let i = 0; i < Math.min(chunk.channelData.length, 3); i++) {
      results.push({
        startSample: chunk.startSample + i * 10,
        endSample: chunk.startSample + i * 10 + 5,
        annotationType: 0,
        values: [`Chunk ${chunk.index} Result ${i}`],
        rawData: chunk.index * 10 + i
      });
    }

    return results;
  }

  protected async finalizeDecoding(): Promise<void> {
    if (this.shouldThrowError && this.errorMessage === 'finalize') {
      throw new Error('完成处理失败');
    }
  }

  // 获取处理的块数量（用于测试验证）
  getProcessedChunks(): number {
    return this.processedChunks;
  }
}

// 创建测试用的通道数据
function createTestChannelData(sampleCount: number, channelCount: number = 2): ChannelData[] {
  const channels: ChannelData[] = [];
  
  for (let ch = 0; ch < channelCount; ch++) {
    const samples = new Uint8Array(sampleCount);
    
    // 填充一些模式数据
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = (i + ch) % 2; // 简单的01模式
    }
    
    channels.push({
      channelNumber: ch,
      channelName: `Channel ${ch}`,
      samples
    });
  }
  
  return channels;
}

describe('StreamingDecoderBase', () => {
  let decoder: TestStreamingDecoder;
  let progressCallback: jest.Mock;
  let partialResultCallback: jest.Mock;

  beforeEach(() => {
    decoder = new TestStreamingDecoder();
    progressCallback = jest.fn();
    partialResultCallback = jest.fn();
    decoder.onProgress = progressCallback;
    decoder.onPartialResult = partialResultCallback;
  });

  afterEach(() => {
    if (decoder.processing) {
      decoder.stop();
    }
  });

  describe('基本功能测试', () => {
    test('默认配置应该正确', () => {
      const config = (decoder as any).config;
      expect(config.chunkSize).toBe(10000);
      expect(config.processingInterval).toBe(10);
      expect(config.maxConcurrentChunks).toBe(3);
      expect(config.enableProgressCallback).toBe(true);
    });

    test('自定义配置应该被应用', () => {
      const customDecoder = new TestStreamingDecoder({
        chunkSize: 5000,
        processingInterval: 20,
        maxConcurrentChunks: 5,
        enableProgressCallback: false
      });

      const config = (customDecoder as any).config;
      expect(config.chunkSize).toBe(5000);
      expect(config.processingInterval).toBe(20);
      expect(config.maxConcurrentChunks).toBe(5);
      expect(config.enableProgressCallback).toBe(false);
    });

    test('应该能检查处理状态', () => {
      expect(decoder.processing).toBe(false);
    });
  });

  describe('数据分块功能测试', () => {
    test('应该正确分割数据为块', () => {
      const channels = createTestChannelData(25000, 2); // 25K样本
      decoder = new TestStreamingDecoder({ chunkSize: 10000 });
      
      const chunks = (decoder as any).createDataChunks(channels);
      
      expect(chunks.length).toBe(3); // 25K / 10K = 3块
      expect(chunks[0].startSample).toBe(0);
      expect(chunks[0].endSample).toBe(10000);
      expect(chunks[1].startSample).toBe(10000);
      expect(chunks[1].endSample).toBe(20000);
      expect(chunks[2].startSample).toBe(20000);
      expect(chunks[2].endSample).toBe(25000);
    });

    test('应该处理重叠区域', () => {
      const channels = createTestChannelData(15000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 10000 });
      
      const chunks = (decoder as any).createDataChunks(channels);
      
      expect(chunks.length).toBe(2);
      // 第二个块应该有重叠区域
      expect(chunks[1].overlapSize).toBeGreaterThan(0);
      expect(chunks[1].overlapSize).toBeLessThanOrEqual(1000); // 最大10%重叠
    });

    test('应该处理小于块大小的数据', () => {
      const channels = createTestChannelData(5000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 10000 });
      
      const chunks = (decoder as any).createDataChunks(channels);
      
      expect(chunks.length).toBe(1);
      expect(chunks[0].startSample).toBe(0);
      expect(chunks[0].endSample).toBe(5000);
    });

    test('应该处理空数据', () => {
      const channels = createTestChannelData(0, 1);
      
      const chunks = (decoder as any).createDataChunks(channels);
      
      expect(chunks.length).toBe(0);
    });
  });

  describe('流式解码核心功能测试', () => {
    test('应该成功完成基本流式解码', async () => {
      const channels = createTestChannelData(1000, 2);
      const options: DecoderOptionValue[] = [];
      const selectedChannels: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ];

      const result = await decoder.streamingDecode(100000, channels, options, selectedChannels);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.statistics.totalSamples).toBe(1000);
      expect(result.statistics.totalResults).toBe(result.results.length);
      expect(result.statistics.processingTime).toBeGreaterThan(0);
      expect(result.statistics.chunksProcessed).toBeGreaterThan(0);
    });

    test('应该调用进度回调', async () => {
      const channels = createTestChannelData(5000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 1000 });
      decoder.onProgress = progressCallback;

      await decoder.streamingDecode(100000, channels, [], []);

      expect(progressCallback).toHaveBeenCalled();
      
      const progressCall = progressCallback.mock.calls[0][0] as StreamingProgress;
      expect(progressCall.totalSamples).toBe(5000);
      expect(progressCall.processedSamples).toBeGreaterThan(0);
      expect(progressCall.progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressCall.progressPercent).toBeLessThanOrEqual(100);
    });

    test('应该调用部分结果回调', async () => {
      const channels = createTestChannelData(2000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 1000 });
      decoder.onPartialResult = partialResultCallback;

      await decoder.streamingDecode(100000, channels, [], []);

      expect(partialResultCallback).toHaveBeenCalled();
      
      const call = partialResultCallback.mock.calls[0];
      expect(Array.isArray(call[0])).toBe(true); // 结果数组
      expect(typeof call[1]).toBe('number'); // 块索引
    });

    test('应该处理大数据量', async () => {
      const channels = createTestChannelData(50000, 2);
      decoder = new TestStreamingDecoder({ 
        chunkSize: 10000,
        maxConcurrentChunks: 2
      });

      const startTime = performance.now();
      const result = await decoder.streamingDecode(100000, channels, [], []);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.statistics.totalSamples).toBe(50000);
      expect(result.statistics.chunksProcessed).toBe(5); // 50K / 10K
      expect(endTime - startTime).toBeLessThan(30000); // 30秒内完成
    });
  });

  describe('并发处理测试', () => {
    test('应该支持配置的最大并发数', async () => {
      const channels = createTestChannelData(10000, 1);
      decoder = new TestStreamingDecoder({ 
        chunkSize: 2000,
        maxConcurrentChunks: 2,
        processingInterval: 50 // 增加间隔以便观察并发
      });

      const startTime = performance.now();
      const result = await decoder.streamingDecode(100000, channels, [], []);
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(result.statistics.chunksProcessed).toBe(5); // 10K / 2K
      
      // 并发处理应该比串行处理快
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('应该处理处理间隔', async () => {
      const channels = createTestChannelData(3000, 1);
      decoder = new TestStreamingDecoder({ 
        chunkSize: 1000,
        processingInterval: 100 // 100ms间隔
      });

      const startTime = performance.now();
      await decoder.streamingDecode(100000, channels, [], []);
      const endTime = performance.now();

      // 应该至少消耗间隔时间 * 块数
      expect(endTime - startTime).toBeGreaterThan(200); // 至少200ms (100ms * 3块 - 一些并发)
    });
  });

  describe('错误处理测试', () => {
    test('应该处理初始化错误', async () => {
      const channels = createTestChannelData(1000, 1);
      decoder.setTestParameters(true, 'init');

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('初始化失败');
      expect(result.results).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    test('应该处理处理块错误', async () => {
      const channels = createTestChannelData(1000, 1);
      decoder.setTestParameters(true, 'process');

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('处理块失败');
    });

    test('应该处理完成处理错误', async () => {
      const channels = createTestChannelData(1000, 1);
      decoder.setTestParameters(true, 'finalize');

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(false);
      expect(result.error).toContain('完成处理失败');
    });

    test('应该防止重复解码', async () => {
      const channels = createTestChannelData(1000, 1);
      
      // 启动第一个解码
      const promise1 = decoder.streamingDecode(100000, channels, [], []);
      
      // 尝试启动第二个解码
      await expect(
        decoder.streamingDecode(100000, channels, [], [])
      ).rejects.toThrow('解码器正在处理中');
      
      // 等待第一个完成
      await promise1;
    });
  });

  describe('停止功能测试', () => {
    test('应该能停止正在进行的处理', async () => {
      const channels = createTestChannelData(10000, 1);
      decoder = new TestStreamingDecoder({ 
        chunkSize: 1000,
        processingInterval: 100 // 慢一点，以便有时间停止
      });
      decoder.setTestParameters(false, '', 50); // 50ms处理延时

      // 启动解码
      const promise = decoder.streamingDecode(100000, channels, [], []);
      
      // 短暂延时后停止
      setTimeout(() => {
        decoder.stop();
      }, 200);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('用户停止处理');
    });

    test('停止后应该能重新开始', async () => {
      const channels = createTestChannelData(2000, 1);
      
      // 第一次处理并停止
      const promise1 = decoder.streamingDecode(100000, channels, [], []);
      setTimeout(() => decoder.stop(), 50);
      const result1 = await promise1;
      
      expect(result1.success).toBe(false);
      
      // 第二次处理应该能正常工作
      const result2 = await decoder.streamingDecode(100000, channels, [], []);
      expect(result2.success).toBe(true);
    });
  });

  describe('进度计算测试', () => {
    test('应该正确计算进度', () => {
      const channels = createTestChannelData(10000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 2000 });
      
      // 模拟进度计算
      (decoder as any).totalSamples = 10000;
      (decoder as any).processedSamples = 4000;
      (decoder as any).startTime = performance.now() - 1000; // 1秒前开始

      const progress = (decoder as any).calculateProgress(5); // 5个总块

      expect(progress.totalSamples).toBe(10000);
      expect(progress.processedSamples).toBe(4000);
      expect(progress.progressPercent).toBe(40);
      expect(progress.currentChunk).toBe(2); // 40% * 5 = 2
      expect(progress.totalChunks).toBe(5);
      expect(progress.processingSpeed).toBeGreaterThan(0);
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    test('应该处理零除情况', () => {
      const channels = createTestChannelData(1000, 1);
      
      (decoder as any).totalSamples = 1000;
      (decoder as any).processedSamples = 0;
      (decoder as any).startTime = performance.now();

      const progress = (decoder as any).calculateProgress(1);

      expect(progress.progressPercent).toBe(0);
      expect(progress.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('内存和性能监控测试', () => {
    test('应该监控内存使用', async () => {
      const channels = createTestChannelData(5000, 1);
      
      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(true);
      expect(result.statistics.peakMemoryUsage).toBeGreaterThanOrEqual(0);
    });

    test('应该记录处理统计', async () => {
      const channels = createTestChannelData(3000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 1000 });

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.statistics.totalSamples).toBe(3000);
      expect(result.statistics.chunksProcessed).toBe(3);
      expect(result.statistics.processingTime).toBeGreaterThan(0);
      expect(result.statistics.averageSpeed).toBeGreaterThan(0);
      expect(result.statistics.totalResults).toBeGreaterThan(0);
    });
  });

  describe('边界条件测试', () => {
    test('应该处理空通道数据', async () => {
      const channels: ChannelData[] = [];

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(true);
      expect(result.statistics.totalSamples).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    test('应该处理单样本数据', async () => {
      const channels = createTestChannelData(1, 1);

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(true);
      expect(result.statistics.totalSamples).toBe(1);
    });

    test('应该处理极大的块大小', async () => {
      const channels = createTestChannelData(1000, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 10000 }); // 比数据大

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(true);
      expect(result.statistics.chunksProcessed).toBe(1);
    });

    test('应该处理极小的块大小', async () => {
      const channels = createTestChannelData(100, 1);
      decoder = new TestStreamingDecoder({ chunkSize: 10 });

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(true);
      expect(result.statistics.chunksProcessed).toBe(10); // 100 / 10
    });
  });

  describe('配置禁用测试', () => {
    test('禁用进度回调时不应该调用', async () => {
      const channels = createTestChannelData(2000, 1);
      decoder = new TestStreamingDecoder({ 
        enableProgressCallback: false,
        chunkSize: 500
      });
      decoder.onProgress = progressCallback;

      await decoder.streamingDecode(100000, channels, [], []);

      expect(progressCallback).not.toHaveBeenCalled();
    });

    test('没有部分结果回调时不应该出错', async () => {
      const channels = createTestChannelData(1000, 1);
      decoder.onPartialResult = undefined;

      const result = await decoder.streamingDecode(100000, channels, [], []);

      expect(result.success).toBe(true);
    });
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('基本功能测试', () => {
    test('应该能开始和添加检查点', () => {
      monitor.start();
      monitor.addCheckpoint('test1');
      monitor.addCheckpoint('test2');

      const report = monitor.getReport();
      
      expect(report.totalTime).toBeGreaterThan(0);
      expect(report.checkpoints).toHaveLength(3); // start + test1 + test2
      expect(report.checkpoints[0].name).toBe('start');
      expect(report.checkpoints[1].name).toBe('test1');
      expect(report.checkpoints[2].name).toBe('test2');
    });

    test('应该计算检查点间的时间差', async () => {
      monitor.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      monitor.addCheckpoint('after50ms');
      await new Promise(resolve => setTimeout(resolve, 50));
      monitor.addCheckpoint('after100ms');

      const report = monitor.getReport();
      
      expect(report.checkpoints[1].deltaTime).toBe(0); // 第一个检查点delta是0
      expect(report.checkpoints[2].deltaTime).toBeGreaterThan(40); // 大约50ms
      expect(report.totalTime).toBeGreaterThan(90); // 大约100ms
    });

    test('应该记录内存信息', () => {
      // 只有在支持performance.memory的环境中测试
      if (typeof performance !== 'undefined' && performance.memory) {
        monitor.start();
        monitor.addCheckpoint('memory-test');

        const report = monitor.getReport();
        
        expect(report.memoryUsage).toBeDefined();
        expect(report.memoryUsage!.peak).toBeGreaterThan(0);
        expect(report.memoryUsage!.current).toBeGreaterThan(0);
      }
    });

    test('应该处理没有内存API的情况', () => {
      // 临时禁用memory API
      const originalMemory = performance.memory;
      (performance as any).memory = undefined;

      try {
        monitor.start();
        monitor.addCheckpoint('no-memory');
        
        const report = monitor.getReport();
        expect(report.memoryUsage).toBeUndefined();
      } finally {
        // 恢复memory API
        (performance as any).memory = originalMemory;
      }
    });
  });

  describe('多次使用测试', () => {
    test('应该能重复使用', () => {
      // 第一次使用
      monitor.start();
      monitor.addCheckpoint('first-run');
      const report1 = monitor.getReport();
      
      // 第二次使用
      monitor.start();
      monitor.addCheckpoint('second-run');
      const report2 = monitor.getReport();

      expect(report1.checkpoints).toHaveLength(2);
      expect(report2.checkpoints).toHaveLength(2);
      expect(report1.checkpoints[1].name).toBe('first-run');
      expect(report2.checkpoints[1].name).toBe('second-run');
    });
  });

  describe('性能基准测试', () => {
    test('监控器本身应该有低开销', () => {
      const iterations = 1000;
      
      const startTime = performance.now();
      
      monitor.start();
      for (let i = 0; i < iterations; i++) {
        monitor.addCheckpoint(`checkpoint-${i}`);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // 1000个检查点应该在合理时间内完成
      expect(totalTime).toBeLessThan(1000); // 1秒内
      
      const report = monitor.getReport();
      expect(report.checkpoints).toHaveLength(iterations + 1); // +1 for start
    });
  });
});

describe('ConcurrentChunkProcessor', () => {
  // 由于ConcurrentChunkProcessor是内部类，我们通过StreamingDecoder来测试它
  
  test('应该支持并发处理', async () => {
    const decoder = new TestStreamingDecoder({ 
      chunkSize: 1000,
      maxConcurrentChunks: 3,
      processingInterval: 50
    });
    
    // 设置处理延时来观察并发效果
    decoder.setTestParameters(false, '', 100);

    const channels = createTestChannelData(5000, 1); // 5个块
    
    const startTime = performance.now();
    const result = await decoder.streamingDecode(100000, channels, [], []);
    const endTime = performance.now();

    expect(result.success).toBe(true);
    expect(result.statistics.chunksProcessed).toBe(5);
    
    // 并发处理应该比5 * 100ms + 5 * 50ms = 750ms要快
    expect(endTime - startTime).toBeLessThan(700);
  });

  test('应该处理处理器异常', async () => {
    const decoder = new TestStreamingDecoder({ chunkSize: 1000 });
    decoder.setTestParameters(true, 'process');

    const channels = createTestChannelData(2000, 1);
    
    const result = await decoder.streamingDecode(100000, channels, [], []);

    expect(result.success).toBe(false);
    expect(result.error).toContain('处理块失败');
  });
});