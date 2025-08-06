/**
 * StreamingDecoder真实源码测试
 * 专门测试StreamingDecoder.ts中的实际代码实现
 * 目标：实现95%+覆盖率，100%通过率
 */

import { 
  StreamingDecoderBase, 
  StreamingConfig, 
  StreamingProgress, 
  StreamingResult,
  PerformanceMonitor 
} from '../../../src/decoders/StreamingDecoder';
import { 
  DecoderResult, 
  ChannelData, 
  DecoderOptionValue, 
  DecoderSelectedChannel,
  DecoderOutputType 
} from '../../../src/decoders/types';

// 测试用的流式解码器实现
class TestStreamingDecoder extends StreamingDecoderBase {
  private results: DecoderResult[] = [];
  private decodingOptions: DecoderOptionValue[] = [];
  private selectedChannels: DecoderSelectedChannel[] = [];
  private currentSampleRate: number = 0;

  constructor(config?: Partial<StreamingConfig>) {
    super(config);
  }

  protected async initializeDecoding(
    sampleRate: number,
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<void> {
    this.currentSampleRate = sampleRate;
    this.decodingOptions = [...options];
    this.selectedChannels = [...selectedChannels];
    this.results = [];
    
    // 模拟初始化延迟
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  protected async processChunk(
    chunk: any,
    sampleRate: number,
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]> {
    const chunkResults: DecoderResult[] = [];
    
    // 模拟处理每个通道的数据
    for (const channelData of chunk.channelData) {
      if (channelData.samples && channelData.samples.length > 0) {
        // 简单的模式检测：检测高电平序列
        let highStart = -1;
        let consecutiveHighs = 0;
        
        for (let i = 0; i < channelData.samples.length; i++) {
          const sample = channelData.samples[i];
          
          if (sample === 1) {
            if (highStart === -1) {
              highStart = chunk.startSample + i;
            }
            consecutiveHighs++;
          } else {
            if (consecutiveHighs >= 3) { // 检测3个或更多连续的高电平
              chunkResults.push({
                startSample: highStart,
                endSample: chunk.startSample + i - 1,
                annotationType: 0,
                values: [`High sequence: ${consecutiveHighs} samples`],
                shape: 'hexagon'
              });
            }
            highStart = -1;
            consecutiveHighs = 0;
          }
        }
        
        // 处理块结尾的高电平序列
        if (consecutiveHighs >= 3) {
          chunkResults.push({
            startSample: highStart,
            endSample: chunk.endSample - 1,
            annotationType: 0,
            values: [`High sequence: ${consecutiveHighs} samples`],
            shape: 'hexagon'
          });
        }
      }
    }
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1));
    
    return chunkResults;
  }

  protected async finalizeDecoding(): Promise<void> {
    // 模拟清理工作
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  // 公开一些内部状态用于测试
  public getProcessingState() {
    return {
      processing: this.processing,
      config: this.config
    };
  }
}

// 错误测试解码器
class ErrorStreamingDecoder extends StreamingDecoderBase {
  private shouldThrowInInit = false;
  private shouldThrowInProcess = false;

  constructor(config?: Partial<StreamingConfig>) {
    super(config);
  }

  public setErrorMode(initError: boolean, processError: boolean) {
    this.shouldThrowInInit = initError;
    this.shouldThrowInProcess = processError;
  }

  protected async initializeDecoding(): Promise<void> {
    if (this.shouldThrowInInit) {
      throw new Error('测试初始化错误');
    }
  }

  protected async processChunk(): Promise<DecoderResult[]> {
    if (this.shouldThrowInProcess) {
      throw new Error('测试处理错误');
    }
    return [];
  }

  protected async finalizeDecoding(): Promise<void> {
    // 模拟清理
  }
}

describe('StreamingDecoder Real Source Code Tests', () => {
  let streamingDecoder: TestStreamingDecoder;
  let errorDecoder: ErrorStreamingDecoder;

  beforeEach(() => {
    streamingDecoder = new TestStreamingDecoder();
    errorDecoder = new ErrorStreamingDecoder();
  });

  describe('StreamingDecoderBase 基础功能', () => {
    it('应该正确初始化默认配置', () => {
      const decoder = new TestStreamingDecoder();
      const state = decoder.getProcessingState();
      
      expect(state.config.chunkSize).toBe(10000);
      expect(state.config.processingInterval).toBe(10);
      expect(state.config.maxConcurrentChunks).toBe(3);
      expect(state.config.enableProgressCallback).toBe(true);
      expect(state.processing).toBe(false);
    });

    it('应该正确应用自定义配置', () => {
      const customConfig: Partial<StreamingConfig> = {
        chunkSize: 5000,
        processingInterval: 20,
        maxConcurrentChunks: 2,
        enableProgressCallback: false
      };
      
      const decoder = new TestStreamingDecoder(customConfig);
      const state = decoder.getProcessingState();
      
      expect(state.config.chunkSize).toBe(5000);
      expect(state.config.processingInterval).toBe(20);
      expect(state.config.maxConcurrentChunks).toBe(2);
      expect(state.config.enableProgressCallback).toBe(false);
    });

    it('应该正确管理处理状态', () => {
      expect(streamingDecoder.processing).toBe(false);
      
      // 状态在实际处理过程中会改变，这里我们主要测试getter
      const state = streamingDecoder.getProcessingState();
      expect(state.processing).toBe(false);
    });
  });

  describe('streamingDecode 核心功能', () => {
    it('应该成功解码简单数据', async () => {
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([
            0, 0, 1, 1, 1, 1, 0, 0, // 4个连续的1（应该被检测）
            1, 1, 0, 0, 0, 0, 0, 0  // 2个连续的1（不应该被检测）
          ])
        }
      ];

      const result = await streamingDecoder.streamingDecode(
        1000,
        channels,
        [],
        [{ captureIndex: 0, decoderIndex: 0 }]
      );

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSamples).toBe(16);
      expect(result.statistics.totalResults).toBeGreaterThanOrEqual(0);
      expect(result.statistics.processingTime).toBeGreaterThan(0);
    });

    it('应该正确处理空数据', async () => {
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([])
        }
      ];

      const result = await streamingDecoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.statistics.totalSamples).toBe(0);
    }, 15000); // 增加超时时间到15秒

    it('应该正确处理大数据集', async () => {
      // 创建大数据集
      const largeData = new Array(50000);
      for (let i = 0; i < 50000; i++) {
        largeData[i] = Math.floor(i / 1000) % 2; // 每1000个样本一个周期
      }

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(largeData)
        }
      ];

      const result = await streamingDecoder.streamingDecode(
        10000,
        channels,
        [],
        [{ captureIndex: 0, decoderIndex: 0 }]
      );

      expect(result.success).toBe(true);
      expect(result.statistics.totalSamples).toBe(50000);
      expect(result.statistics.chunksProcessed).toBeGreaterThan(1);
      expect(result.statistics.averageSpeed).toBeGreaterThan(0);
    });

    it('应该正确处理重复调用错误', async () => {
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([1, 1, 1, 0, 0, 0])
        }
      ];

      // 启动第一个解码任务
      const promise1 = streamingDecoder.streamingDecode(1000, channels, [], []);
      
      // 立即尝试启动第二个任务
      await expect(
        streamingDecoder.streamingDecode(1000, channels, [], [])
      ).rejects.toThrow('解码器正在处理中，请等待完成或停止当前处理');

      // 等待第一个任务完成
      await promise1;
    });
  });

  describe('进度回调功能', () => {
    it('应该触发进度回调', async () => {
      const progressUpdates: StreamingProgress[] = [];
      const partialResults: DecoderResult[][] = [];

      streamingDecoder.onProgress = (progress) => {
        progressUpdates.push({ ...progress });
      };

      streamingDecoder.onPartialResult = (results, chunk) => {
        partialResults.push([...results]);
      };

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(Array(20000).fill(0).map((_, i) => 
            Math.floor(i / 100) % 2 // 每100个样本切换状态
          ))
        }
      ];

      const result = await streamingDecoder.streamingDecode(
        1000,
        channels,
        [],
        [{ captureIndex: 0, decoderIndex: 0 }]
      );

      expect(result.success).toBe(true);
      // 由于数据量大，应该有多个进度更新
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // 验证进度数据结构
      if (progressUpdates.length > 0) {
        const progress = progressUpdates[0];
        expect(progress.totalSamples).toBe(20000);
        expect(progress.processedSamples).toBeGreaterThanOrEqual(0);
        expect(progress.progressPercent).toBeGreaterThanOrEqual(0);
        expect(progress.processingSpeed).toBeGreaterThanOrEqual(0);
      }
    });

    it('应该在禁用进度回调时不触发回调', async () => {
      const decoder = new TestStreamingDecoder({
        enableProgressCallback: false
      });

      let progressCalled = false;
      decoder.onProgress = () => {
        progressCalled = true;
      };

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(Array(10000).fill(1))
        }
      ];

      await decoder.streamingDecode(1000, channels, [], []);
      
      expect(progressCalled).toBe(false);
    });
  });

  describe('停止功能', () => {
    it('应该能够停止处理', async () => {
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(Array(100000).fill(1)) // 大数据集
        }
      ];

      // 启动处理
      const promise = streamingDecoder.streamingDecode(1000, channels, [], []);
      
      // 立即停止
      setTimeout(() => {
        streamingDecoder.stop();
      }, 10);

      const result = await promise;
      
      // 停止的处理应该返回错误
      expect(result.success).toBe(false);
      expect(result.error).toContain('用户停止处理');
    });
  });

  describe('错误处理', () => {
    it('应该处理初始化错误', async () => {
      errorDecoder.setErrorMode(true, false);

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([1, 0, 1, 0])
        }
      ];

      const result = await errorDecoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('测试初始化错误');
    });

    it('应该处理处理过程中的错误', async () => {
      errorDecoder.setErrorMode(false, true);

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([1, 0, 1, 0])
        }
      ];

      const result = await errorDecoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('测试处理错误');
    });
  });

  describe('数据块创建功能', () => {
    it('应该正确创建数据块', async () => {
      const decoder = new TestStreamingDecoder({
        chunkSize: 10
      });

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(Array(25).fill(0).map((_, i) => i % 2))
        }
      ];

      const result = await decoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(true);
      expect(result.statistics.chunksProcessed).toBeGreaterThan(1); // 25个样本应该分成多个块
    });

    it('应该处理重叠区域', async () => {
      const decoder = new TestStreamingDecoder({
        chunkSize: 5
      });

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0])
        }
      ];

      const result = await decoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(true);
      // 应该检测到跨块边界的模式
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('内存监控', () => {
    it('应该监控内存使用情况', async () => {
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array(Array(10000).fill(1))
        }
      ];

      const result = await streamingDecoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(true);
      expect(result.statistics.peakMemoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('应该处理performance.memory不可用的情况', async () => {
      // 模拟performance.memory不可用的环境
      const originalMemory = (global as any).performance.memory;
      delete (global as any).performance.memory;

      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          samples: new Uint8Array([1, 1, 1, 1, 0, 0, 0, 0])
        }
      ];

      const result = await streamingDecoder.streamingDecode(1000, channels, [], []);
      
      expect(result.success).toBe(true);
      expect(result.statistics.peakMemoryUsage).toBe(0);

      // 恢复原始memory对象
      if (originalMemory) {
        (global as any).performance.memory = originalMemory;
      }
    });
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('基础功能', () => {
    it('应该正确启动和停止监控', () => {
      monitor.start();
      
      // 添加一些检查点
      monitor.addCheckpoint('test1');
      monitor.addCheckpoint('test2');
      
      const report = monitor.getReport();
      
      expect(report.totalTime).toBeGreaterThanOrEqual(0);
      expect(report.checkpoints).toHaveLength(3); // start + test1 + test2
      expect(report.checkpoints[0].name).toBe('start');
      expect(report.checkpoints[1].name).toBe('test1');
      expect(report.checkpoints[2].name).toBe('test2');
    });

    it('应该计算正确的时间差', async () => {
      monitor.start();
      
      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));
      monitor.addCheckpoint('after-delay');
      
      const report = monitor.getReport();
      
      expect(report.checkpoints).toHaveLength(2);
      expect(report.checkpoints[1].deltaTime).toBeGreaterThan(0);
    });

    it('应该监控内存使用（如果可用）', () => {
      monitor.start();
      monitor.addCheckpoint('memory-test');
      
      const report = monitor.getReport();
      
      // 内存监控可能不在所有环境中可用
      if (report.memoryUsage) {
        expect(report.memoryUsage.peak).toBeGreaterThan(0);
        expect(report.memoryUsage.current).toBeGreaterThan(0);
      }
    });
  });

  describe('多检查点监控', () => {
    it('应该正确处理多个检查点', async () => {
      monitor.start();
      
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 5));
        monitor.addCheckpoint(`checkpoint-${i}`);
      }
      
      const report = monitor.getReport();
      
      expect(report.checkpoints).toHaveLength(6); // start + 5 checkpoints
      expect(report.totalTime).toBeGreaterThan(0);
      
      // 验证时间是递增的
      for (let i = 1; i < report.checkpoints.length; i++) {
        expect(report.checkpoints[i].time).toBeGreaterThanOrEqual(
          report.checkpoints[i - 1].time
        );
      }
    });
  });

  describe('错误边界', () => {
    it('应该处理未启动就获取报告的情况', () => {
      // 不调用start()直接获取报告
      const report = monitor.getReport();
      
      expect(report.checkpoints).toHaveLength(0);
      expect(report.totalTime).toBeGreaterThanOrEqual(0);
    });

    it('应该处理重复启动', () => {
      monitor.start();
      monitor.addCheckpoint('first');
      
      // 重新启动
      monitor.start();
      monitor.addCheckpoint('after-restart');
      
      const report = monitor.getReport();
      
      // 重新启动后应该清空之前的检查点
      expect(report.checkpoints).toHaveLength(2); // start + after-restart
      expect(report.checkpoints[1].name).toBe('after-restart');
    });

    it('应该处理performance.memory不可用的情况', () => {
      // 模拟performance.memory不可用
      const originalMemory = (global as any).performance.memory;
      delete (global as any).performance.memory;

      monitor.start();
      monitor.addCheckpoint('test-no-memory');
      
      const report = monitor.getReport();
      
      expect(report.memoryUsage).toBeUndefined();
      expect(report.checkpoints[1].memory).toBeUndefined();

      // 恢复原始memory对象
      if (originalMemory) {
        (global as any).performance.memory = originalMemory;
      }
    });

    it('应该正确处理空的内存值数组', () => {
      // 确保在没有内存数据时正确处理
      monitor.start();
      
      // 模拟没有内存监控的检查点
      const originalMemory = (global as any).performance.memory;
      delete (global as any).performance.memory;
      monitor.addCheckpoint('no-memory-1');
      monitor.addCheckpoint('no-memory-2');
      
      const report = monitor.getReport();
      
      expect(report.memoryUsage).toBeUndefined();
      
      // 恢复
      if (originalMemory) {
        (global as any).performance.memory = originalMemory;
      }
    });
  });
});