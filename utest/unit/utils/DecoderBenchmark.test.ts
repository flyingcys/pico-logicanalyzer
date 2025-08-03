/**
 * DecoderBenchmark 单元测试
 * 测试解码器性能基准测试工具的完整功能：基准测试执行、报告生成、性能统计
 */

import { 
  DecoderBenchmark, 
  BenchmarkConfiguration, 
  DecoderPerformanceResult, 
  BenchmarkReport,
  DefaultBenchmarkConfigurations
} from '../../src/utils/DecoderBenchmark';

// Mock性能API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000000
  }
};

// 替换全局performance对象
Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

describe('DecoderBenchmark', () => {
  let benchmark: DecoderBenchmark;
  let mockDecoder: any;
  let progressSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    progressSpy = jest.fn();
    benchmark = new DecoderBenchmark(progressSpy);
    
    // 重置performance.now的计数器
    let performanceTime = 1000; // 从非零值开始
    mockPerformance.now.mockImplementation(() => {
      const currentTime = performanceTime;
      performanceTime += 10; // 每次调用递增10ms
      return currentTime;
    });

    // 创建模拟解码器
    mockDecoder = {
      decode: jest.fn().mockResolvedValue({
        results: [
          { type: 'data', startSample: 0, endSample: 100, value: 'test' },
          { type: 'data', startSample: 100, endSample: 200, value: 'data' }
        ],
        success: true
      }),
      streamingDecode: jest.fn().mockResolvedValue({
        results: [
          { type: 'stream', startSample: 0, endSample: 50, value: 'stream1' },
          { type: 'stream', startSample: 50, endSample: 100, value: 'stream2' }
        ],
        success: true
      })
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    mockPerformance.now.mockClear();
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      const benchmarkWithCallback = new DecoderBenchmark(progressSpy);
      expect(benchmarkWithCallback).toBeInstanceOf(DecoderBenchmark);

      const benchmarkWithoutCallback = new DecoderBenchmark();
      expect(benchmarkWithoutCallback).toBeInstanceOf(DecoderBenchmark);
    });

    it('应该设置进度回调', () => {
      const callback = jest.fn();
      const benchmarkInstance = new DecoderBenchmark(callback);
      
      // 通过状态检查验证回调是否设置
      const status = benchmarkInstance.getStatus();
      expect(status.running).toBe(false);
      expect(status.currentTest).toBe('');
    });
  });

  describe('单个解码器基准测试', () => {
    const testConfig: BenchmarkConfiguration = {
      name: '测试配置',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 4,
      iterations: 3,
      useStreaming: false
    };

    it('应该成功运行常规解码器基准测试', async () => {
      const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, testConfig);

      expect(result.decoderId).toBe('TestDecoder');
      expect(result.configuration).toBe(testConfig);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.processingSpeed).toBeGreaterThan(0);
      expect(result.resultCount).toBe(2); // 每次迭代返回2个结果
      expect(result.statistics.averageIterationTime).toBeGreaterThan(0);
      expect(result.statistics.minIterationTime).toBeGreaterThan(0);
      expect(result.statistics.maxIterationTime).toBeGreaterThan(0);
      
      // 验证解码器被调用了正确次数
      expect(mockDecoder.decode).toHaveBeenCalledTimes(3);
      expect(mockDecoder.streamingDecode).not.toHaveBeenCalled();
    });

    it('应该成功运行流式解码器基准测试', async () => {
      const streamingConfig = { ...testConfig, useStreaming: true, chunkSize: 100 };
      
      const result = await benchmark.runDecoderBenchmark('StreamingDecoder', mockDecoder, streamingConfig);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.resultCount).toBe(2); // 每次迭代返回2个结果
      
      // 验证流式解码器被调用
      expect(mockDecoder.streamingDecode).toHaveBeenCalledTimes(3);
      expect(mockDecoder.decode).not.toHaveBeenCalled();
    });

    it('应该处理解码器错误', async () => {
      mockDecoder.decode.mockRejectedValue(new Error('解码失败'));

      const result = await benchmark.runDecoderBenchmark('FailingDecoder', mockDecoder, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3); // 3次迭代都失败
      expect(result.errors[0]).toContain('解码失败');
    });

    it('应该处理不支持的解码器接口', async () => {
      const invalidDecoder = {}; // 没有decode方法

      const result = await benchmark.runDecoderBenchmark('InvalidDecoder', invalidDecoder, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toContain('解码器不支持标准接口');
    });

    it('应该正确计算统计信息', async () => {
      // 模拟不同的执行时间
      let callCount = 0;
      mockPerformance.now.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) { // 开始时间
          return callCount * 10;
        } else { // 结束时间
          return callCount * 10 + Math.random() * 50 + 20; // 20-70ms的随机执行时间
        }
      });

      const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, testConfig);

      expect(result.statistics.averageIterationTime).toBeGreaterThan(0);
      expect(result.statistics.minIterationTime).toBeGreaterThan(0);
      expect(result.statistics.maxIterationTime).toBeGreaterThan(0);
      expect(result.statistics.standardDeviation).toBeGreaterThanOrEqual(0);
      expect(result.statistics.throughput).toBeGreaterThan(0);
    });

    it('应该调用进度回调', async () => {
      await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, testConfig);

      expect(progressSpy).toHaveBeenCalledTimes(3); // 每次迭代调用一次
      expect(progressSpy).toHaveBeenCalledWith({
        current: 1,
        total: 3,
        test: 'TestDecoder - 测试配置'
      });
    });

    it('应该跟踪内存使用', async () => {
      // 模拟内存使用变化
      let memoryUsage = 1000000;
      Object.defineProperty(mockPerformance, 'memory', {
        get: () => ({
          usedJSHeapSize: memoryUsage += 100000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 4000000000
        }),
        configurable: true
      });

      const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, testConfig);

      expect(result.peakMemoryUsage).toBeGreaterThan(0);
    });
  });

  describe('基准测试套件', () => {
    const testConfigs: BenchmarkConfiguration[] = [
      {
        name: '小数据测试',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 2,
        useStreaming: false
      },
      {
        name: '流式测试',
        sampleCount: 200,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: true,
        chunkSize: 50
      }
    ];

    const testDecoders = [
      { id: 'Decoder1', instance: mockDecoder },
      { id: 'Decoder2', instance: { ...mockDecoder } }
    ];

    it('应该成功运行完整的基准测试套件', async () => {
      jest.useRealTimers();
      
      const report = await benchmark.runBenchmarkSuite(testDecoders, testConfigs);

      expect(report.results).toHaveLength(4); // 2个解码器 × 2个配置
      expect(report.configurations).toBe(testConfigs);
      expect(report.startTime).toBeGreaterThan(0);
      expect(report.endTime).toBeGreaterThan(report.startTime);
      expect(report.totalDuration).toBeGreaterThan(0);
      
      // 验证排名
      expect(report.rankings.bySpeed).toBeDefined();
      expect(report.rankings.byMemoryEfficiency).toBeDefined();  
      expect(report.rankings.byThroughput).toBeDefined();
      
      // 验证基线
      expect(report.baselines).toBeDefined();
      expect(Object.keys(report.baselines)).toContain('Decoder1');
      expect(Object.keys(report.baselines)).toContain('Decoder2');
    }, 15000);

    it('应该防止并发测试执行', async () => {
      // 创建一个简单的配置来加快测试
      const simpleConfig = [{
        name: '简单测试',
        sampleCount: 10,
        sampleRate: 1000,
        channelCount: 1,
        iterations: 1,
        useStreaming: false
      }];
      
      const simpleDecoders = [{ id: 'SimpleDecoder', instance: mockDecoder }];
      
      const promise1 = benchmark.runBenchmarkSuite(simpleDecoders, simpleConfig);
      
      await expect(
        benchmark.runBenchmarkSuite(simpleDecoders, simpleConfig)
      ).rejects.toThrow('基准测试正在进行中');

      // 等待第一个测试完成
      await promise1;
    }, 5000);

    it('应该正确计算性能排名', async () => {
      // 创建具有不同性能特征的解码器
      const fastDecoder = {
        decode: jest.fn().mockResolvedValue({ results: [{ type: 'fast' }] })
      };
      const slowDecoder = {
        decode: jest.fn().mockImplementation(async () => {
          // 模拟慢解码器
          await new Promise(resolve => setTimeout(resolve, 100));
          return { results: [{ type: 'slow' }] };
        })
      };

      const decoders = [
        { id: 'FastDecoder', instance: fastDecoder },
        { id: 'SlowDecoder', instance: slowDecoder }
      ];

      const promise = benchmark.runBenchmarkSuite(decoders, [testConfigs[0]]);
      
      // 推进计时器
      for (let i = 0; i < 20; i++) {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
      }

      const report = await promise;

      expect(report.rankings.bySpeed).toHaveLength(2);
      expect(report.rankings.byMemoryEfficiency).toHaveLength(2);
      expect(report.rankings.byThroughput).toHaveLength(2);
      
      // 验证排名顺序（快的在前）
      expect(report.rankings.bySpeed[0].processingSpeed).toBeGreaterThanOrEqual(
        report.rankings.bySpeed[1].processingSpeed
      );
    });

    it('应该生成准确的性能基线', async () => {
      jest.useRealTimers();
      
      const report = await benchmark.runBenchmarkSuite(testDecoders, testConfigs);

      const decoder1Baseline = report.baselines['Decoder1'];
      expect(decoder1Baseline).toBeDefined();
      expect(decoder1Baseline.expectedSpeed).toBeGreaterThan(0);
      expect(decoder1Baseline.acceptableMemory).toBeGreaterThan(0);
      expect(decoder1Baseline.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(decoder1Baseline.reliabilityScore).toBeLessThanOrEqual(100);
    }, 10000);

    it('应该调用套件进度回调', async () => {
      const promise = benchmark.runBenchmarkSuite(testDecoders, testConfigs);
      
      // 推进计时器
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      }

      await promise;

      // 验证套件级别的进度回调被调用
      expect(progressSpy).toHaveBeenCalled();
      
      // 验证调用参数格式
      const calls = progressSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toHaveProperty('current');
      expect(calls[0][0]).toHaveProperty('total');
      expect(calls[0][0]).toHaveProperty('test');
    });
  });

  describe('测试数据生成', () => {
    it('应该生成正确数量的通道和样本', () => {
      const testConfig: BenchmarkConfiguration = {
        name: '数据生成测试',
        sampleCount: 500,
        sampleRate: 1000000,
        channelCount: 6,
        iterations: 1,
        useStreaming: false
      };

      // 通过实际运行来验证数据生成
      const promise = benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, testConfig);
      
      return promise.then(result => {
        expect(result.success).toBe(true);
        // 验证解码器被调用时传入了正确的通道数据
        expect(mockDecoder.decode).toHaveBeenCalled();
        const callArgs = mockDecoder.decode.mock.calls[0];
        const channels = callArgs[1]; // 通道数据是第二个参数
        
        expect(channels).toHaveLength(6);
        channels.forEach((channel: any, index: number) => {
          expect(channel.channelNumber).toBe(index);
          expect(channel.samples).toHaveLength(500);
          expect(channel.name).toBe(`CH${index}`);
        });
      });
    });

    it('应该生成不同的协议模式', () => {
      const promise = benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, {
        name: '协议模式测试',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 4,
        iterations: 1,
        useStreaming: false
      });

      return promise.then(() => {
        const callArgs = mockDecoder.decode.mock.calls[0];
        const channels = callArgs[1];
        
        // 验证不同通道有不同的数据模式
        expect(channels[0].samples).toBeInstanceOf(Uint8Array);
        expect(channels[1].samples).toBeInstanceOf(Uint8Array);
        expect(channels[2].samples).toBeInstanceOf(Uint8Array);
        expect(channels[3].samples).toBeInstanceOf(Uint8Array);
        
        // 验证数据不全为0（应该有模式变化）
        const channel0Sum = Array.from(channels[0].samples).reduce((a: number, b: number) => a + b, 0);
        const channel1Sum = Array.from(channels[1].samples).reduce((a: number, b: number) => a + b, 0);
        
        expect(channel0Sum).toBeGreaterThan(0);
        expect(channel1Sum).toBeGreaterThan(0);
      });
    });
  });

  describe('报告生成', () => {
    let sampleReport: BenchmarkReport;

    beforeEach(() => {
      const sampleResult: DecoderPerformanceResult = {
        decoderId: 'SampleDecoder',
        configuration: {
          name: '示例测试',
          sampleCount: 1000,
          sampleRate: 1000000,
          channelCount: 4,
          iterations: 2,
          useStreaming: false
        },
        executionTime: 150.5,
        processingSpeed: 13245.7,
        peakMemoryUsage: 1048576,
        resultCount: 5,
        errors: [],
        success: true,
        statistics: {
          averageIterationTime: 75.25,
          minIterationTime: 70.1,
          maxIterationTime: 80.4,
          standardDeviation: 5.15,
          throughput: 2.5
        }
      };

      sampleReport = {
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDuration: 5000,
        configurations: [sampleResult.configuration],
        results: [sampleResult],
        rankings: {
          bySpeed: [sampleResult],
          byMemoryEfficiency: [sampleResult],
          byThroughput: [sampleResult]
        },
        baselines: {
          'SampleDecoder': {
            expectedSpeed: 13245.7,
            acceptableMemory: 1258291.2,
            reliabilityScore: 100
          }
        }
      };
    });

    it('应该生成格式正确的Markdown报告', () => {
      const reportText = benchmark.generateReport(sampleReport);

      expect(reportText).toContain('# 解码器性能基准测试报告');
      expect(reportText).toContain('## 测试概览');
      expect(reportText).toContain('## 性能排名');
      expect(reportText).toContain('## 性能基线');
      expect(reportText).toContain('## 详细测试结果');
      
      // 验证具体数据
      expect(reportText).toContain('SampleDecoder');
      expect(reportText).toContain('13.2K样本/秒');
      expect(reportText).toContain('1024.0KB');
      expect(reportText).toContain('2.50MB/s');
      expect(reportText).toContain('✅ 成功');
    });

    it('应该处理失败的测试结果', () => {
      const failedResult: DecoderPerformanceResult = {
        ...sampleReport.results[0],
        success: false,
        errors: ['错误1', '错误2']
      };

      const failedReport = {
        ...sampleReport,
        results: [failedResult]
      };

      const reportText = benchmark.generateReport(failedReport);

      expect(reportText).toContain('❌ 失败');
      expect(reportText).toContain('错误1, 错误2');
    });

    it('应该正确计算成功率', () => {
      const mixedResults = [
        { ...sampleReport.results[0], success: true },
        { ...sampleReport.results[0], success: false, errors: ['失败'] },
        { ...sampleReport.results[0], success: true }
      ];

      const mixedReport = {
        ...sampleReport,
        results: mixedResults
      };

      const reportText = benchmark.generateReport(mixedReport);

      expect(reportText).toContain('成功率: 66.7%');
    });
  });

  describe('状态管理', () => {
    it('应该正确报告运行状态', () => {
      const initialStatus = benchmark.getStatus();
      expect(initialStatus.running).toBe(false);
      expect(initialStatus.currentTest).toBe('');
    });

    it('应该能够停止正在运行的测试', () => {
      benchmark.stop();
      const status = benchmark.getStatus();
      expect(status.running).toBe(false);
    });
  });

  describe('默认配置', () => {
    it('应该提供预定义的基准测试配置', () => {
      expect(DefaultBenchmarkConfigurations).toBeDefined();
      expect(Array.isArray(DefaultBenchmarkConfigurations)).toBe(true);
      expect(DefaultBenchmarkConfigurations.length).toBeGreaterThan(0);

      // 验证配置结构
      DefaultBenchmarkConfigurations.forEach(config => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('sampleCount');
        expect(config).toHaveProperty('sampleRate');
        expect(config).toHaveProperty('channelCount');
        expect(config).toHaveProperty('iterations');
        expect(config).toHaveProperty('useStreaming');
        
        if (config.useStreaming) {
          expect(config).toHaveProperty('chunkSize');
        }
      });
    });

    it('应该包含不同规模的测试配置', () => {
      const sampleCounts = DefaultBenchmarkConfigurations.map(config => config.sampleCount);
      const uniqueSampleCounts = [...new Set(sampleCounts)];
      
      // 应该有多种不同的样本数量
      expect(uniqueSampleCounts.length).toBeGreaterThan(1);
      
      // 应该包含流式和非流式配置
      const streamingConfigs = DefaultBenchmarkConfigurations.filter(config => config.useStreaming);
      const regularConfigs = DefaultBenchmarkConfigurations.filter(config => !config.useStreaming);
      
      expect(streamingConfigs.length).toBeGreaterThan(0);
      expect(regularConfigs.length).toBeGreaterThan(0);
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理极小的样本数量', async () => {
      const tinyConfig: BenchmarkConfiguration = {
        name: '极小测试',
        sampleCount: 1,
        sampleRate: 1000,
        channelCount: 1,
        iterations: 1,
        useStreaming: false
      };

      const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, tinyConfig);
      expect(result.success).toBe(true);
    });

    it('应该处理零迭代的情况', async () => {
      const zeroIterConfig: BenchmarkConfiguration = {
        name: '零迭代测试',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 0,
        useStreaming: false
      };

      const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, zeroIterConfig);
      expect(result.success).toBe(true);
      // 零迭代时，平均时间应该是0或NaN，但成功标志应该为true
      expect(result.statistics.averageIterationTime === 0 || isNaN(result.statistics.averageIterationTime)).toBe(true);
    });

    it('应该处理performance.memory不可用的情况', async () => {
      // 临时移除performance.memory
      const originalMemory = mockPerformance.memory;
      delete (mockPerformance as any).memory;

      try {
        const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, {
          name: '无内存API测试',
          sampleCount: 100,
          sampleRate: 1000000,
          channelCount: 2,
          iterations: 1,
          useStreaming: false
        });

        expect(result.success).toBe(true);
        expect(result.peakMemoryUsage).toBe(0);
      } finally {
        // 恢复performance.memory
        (mockPerformance as any).memory = originalMemory;
      }
    });

    it('应该处理解码器返回null结果的情况', async () => {
      mockDecoder.decode.mockResolvedValue(null);

      const result = await benchmark.runDecoderBenchmark('NullDecoder', mockDecoder, {
        name: 'Null结果测试',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      });

      expect(result.success).toBe(true);
      expect(result.resultCount).toBe(0);
    });

    it('应该处理解码器返回无results属性的情况', async () => {
      mockDecoder.decode.mockResolvedValue({ success: true });

      const result = await benchmark.runDecoderBenchmark('NoResultsDecoder', mockDecoder, {
        name: '无Results测试',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      });

      expect(result.success).toBe(true);
      expect(result.resultCount).toBe(0);
    });
  });
});