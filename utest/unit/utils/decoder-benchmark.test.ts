/**
 * DecoderBenchmark 单元测试
 * 测试解码器性能基准测试工具的完整功能，包括基准测试、性能分析、报告生成等
 */

import { 
  DecoderBenchmark, 
  BenchmarkConfiguration, 
  DecoderPerformanceResult, 
  BenchmarkReport,
  DefaultBenchmarkConfigurations 
} from '../../src/utils/DecoderBenchmark';

// 模拟解码器类
class MockDecoder {
  private processingDelay: number;
  private shouldFail: boolean;
  private memoryUsage: number;
  private resultCount: number;

  constructor(options: {
    processingDelay?: number;
    shouldFail?: boolean;
    memoryUsage?: number;
    resultCount?: number;
  } = {}) {
    this.processingDelay = options.processingDelay || 10;
    this.shouldFail = options.shouldFail || false;
    this.memoryUsage = options.memoryUsage || 1024;
    this.resultCount = options.resultCount || 5;
  }

  async decode(sampleRate: number, channels: any[], options: any[]): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, this.processingDelay));
    
    if (this.shouldFail) {
      throw new Error('解码失败模拟');
    }

    return {
      results: Array.from({ length: this.resultCount }, (_, i) => ({
        id: i,
        startSample: i * 100,
        endSample: (i + 1) * 100,
        data: `Result ${i}`
      }))
    };
  }

  async streamingDecode(sampleRate: number, channels: any[], options: any[], chunkOptions: any[]): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, this.processingDelay / 2)); // 流式处理更快
    
    if (this.shouldFail) {
      throw new Error('流式解码失败模拟');
    }

    return {
      results: Array.from({ length: this.resultCount * 2 }, (_, i) => ({
        id: i,
        startSample: i * 50,
        endSample: (i + 1) * 50,
        data: `Streaming Result ${i}`
      }))
    };
  }
}

class MockHighPerformanceDecoder extends MockDecoder {
  constructor() {
    super({
      processingDelay: 5,
      memoryUsage: 512,
      resultCount: 10
    });
  }
}

class MockSlowDecoder extends MockDecoder {
  constructor() {
    super({
      processingDelay: 100,
      memoryUsage: 4096,
      resultCount: 2
    });
  }
}

class MockFailingDecoder extends MockDecoder {
  constructor() {
    super({
      shouldFail: true,
      processingDelay: 20
    });
  }
}

// 模拟performance API
const mockPerformance = {
  now: jest.fn(),
  memory: {
    usedJSHeapSize: 10 * 1024 * 1024
  }
};

describe('DecoderBenchmark', () => {
  let benchmark: DecoderBenchmark;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    // 清除console输出以避免测试污染
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockProgressCallback = jest.fn();
    benchmark = new DecoderBenchmark(mockProgressCallback);

    // 模拟performance.now()返回递增的时间
    let currentTime = 0;
    mockPerformance.now.mockImplementation(() => {
      currentTime += 10; // 每次调用增加10ms
      return currentTime;
    });
    (global as any).performance = mockPerformance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化基准测试实例', () => {
      const testBenchmark = new DecoderBenchmark();
      expect(testBenchmark).toBeInstanceOf(DecoderBenchmark);
      
      const status = testBenchmark.getStatus();
      expect(status.running).toBe(false);
      expect(status.currentTest).toBe('');
    });

    it('应该接受进度回调函数', () => {
      const progressCallback = jest.fn();
      const testBenchmark = new DecoderBenchmark(progressCallback);
      expect(testBenchmark).toBeInstanceOf(DecoderBenchmark);
    });

    it('应该提供默认的基准测试配置', () => {
      expect(DefaultBenchmarkConfigurations).toBeDefined();
      expect(DefaultBenchmarkConfigurations.length).toBeGreaterThan(0);
      
      DefaultBenchmarkConfigurations.forEach(config => {
        expect(config.name).toBeDefined();
        expect(config.sampleCount).toBeGreaterThan(0);
        expect(config.sampleRate).toBeGreaterThan(0);
        expect(config.channelCount).toBeGreaterThan(0);
        expect(config.iterations).toBeGreaterThan(0);
        expect(typeof config.useStreaming).toBe('boolean');
      });
    });
  });

  describe('单个解码器基准测试', () => {
    const testConfig: BenchmarkConfiguration = {
      name: '测试配置',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 2,
      iterations: 3,
      useStreaming: false
    };

    it('应该成功运行基准测试', async () => {
      const decoder = new MockDecoder();
      const result = await benchmark.runDecoderBenchmark('testDecoder', decoder, testConfig);

      expect(result.decoderId).toBe('testDecoder');
      expect(result.configuration).toBe(testConfig);
      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.processingSpeed).toBeGreaterThan(0);
      expect(result.resultCount).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('应该正确计算统计信息', async () => {
      const decoder = new MockDecoder();
      const result = await benchmark.runDecoderBenchmark('testDecoder', decoder, testConfig);

      expect(result.statistics.averageIterationTime).toBeGreaterThan(0);
      expect(result.statistics.minIterationTime).toBeGreaterThan(0);
      expect(result.statistics.maxIterationTime).toBeGreaterThan(0);
      expect(result.statistics.standardDeviation).toBeGreaterThanOrEqual(0);
      expect(result.statistics.throughput).toBeGreaterThan(0);
    });

    it('应该处理流式解码', async () => {
      const decoder = new MockDecoder();
      const streamingConfig = { ...testConfig, useStreaming: true, chunkSize: 100 };
      
      const result = await benchmark.runDecoderBenchmark('streamingDecoder', decoder, streamingConfig);

      expect(result.success).toBe(true);
      expect(result.resultCount).toBeGreaterThan(0);
    });

    it('应该处理解码器错误', async () => {
      const failingDecoder = new MockFailingDecoder();
      const result = await benchmark.runDecoderBenchmark('failingDecoder', failingDecoder, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('解码失败模拟');
    });

    it('应该处理不支持标准接口的解码器', async () => {
      const invalidDecoder = {}; // 没有decode方法
      const result = await benchmark.runDecoderBenchmark('invalidDecoder', invalidDecoder, testConfig);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('解码器不支持标准接口');
    });

    it('应该正确调用进度回调', async () => {
      const decoder = new MockDecoder();
      await benchmark.runDecoderBenchmark('testDecoder', decoder, testConfig);

      expect(mockProgressCallback).toHaveBeenCalledTimes(testConfig.iterations);
      
      // 验证进度回调的参数
      const lastCall = mockProgressCallback.mock.calls[mockProgressCallback.mock.calls.length - 1][0];
      expect(lastCall.current).toBe(testConfig.iterations);
      expect(lastCall.total).toBe(testConfig.iterations);
      expect(lastCall.test).toContain('testDecoder');
    });

    it('应该处理内存使用测量', async () => {
      // 模拟内存使用变化
      let memoryUsage = 10 * 1024 * 1024;
      jest.spyOn(benchmark as any, 'getMemoryUsage').mockImplementation(() => {
        memoryUsage += 1024 * 1024; // 每次增加1MB
        return memoryUsage;
      });

      const decoder = new MockDecoder();
      const result = await benchmark.runDecoderBenchmark('testDecoder', decoder, testConfig);

      expect(result.peakMemoryUsage).toBeGreaterThan(0);
    });
  });

  describe('基准测试套件', () => {
    const testDecoders = [
      { id: 'fastDecoder', instance: new MockHighPerformanceDecoder() },
      { id: 'slowDecoder', instance: new MockSlowDecoder() },
      { id: 'failingDecoder', instance: new MockFailingDecoder() }
    ];

    const testConfigs: BenchmarkConfiguration[] = [
      {
        name: '小数据集',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 2,
        useStreaming: false
      },
      {
        name: '大数据集',
        sampleCount: 10000,
        sampleRate: 1000000,
        channelCount: 4,
        iterations: 1,
        useStreaming: true,
        chunkSize: 1000
      }
    ];

    it('应该成功运行完整的基准测试套件', async () => {
      const report = await benchmark.runBenchmarkSuite(testDecoders, testConfigs);

      expect(report.startTime).toBeGreaterThan(0);
      expect(report.endTime).toBeGreaterThan(report.startTime);
      expect(report.totalDuration).toBeGreaterThan(0);
      expect(report.configurations).toEqual(testConfigs);
      expect(report.results).toHaveLength(testDecoders.length * testConfigs.length);
    });

    it('应该正确计算性能排名', async () => {
      const report = await benchmark.runBenchmarkSuite(testDecoders, testConfigs);

      expect(report.rankings.bySpeed).toBeDefined();
      expect(report.rankings.byMemoryEfficiency).toBeDefined();
      expect(report.rankings.byThroughput).toBeDefined();

      // 验证排名顺序（成功的结果应该被包含）
      const successfulResults = report.results.filter(r => r.success);
      expect(report.rankings.bySpeed.length).toBe(successfulResults.length);
      expect(report.rankings.byMemoryEfficiency.length).toBe(successfulResults.length);
      expect(report.rankings.byThroughput.length).toBe(successfulResults.length);

      // 验证速度排名（从高到低）
      if (report.rankings.bySpeed.length > 1) {
        for (let i = 0; i < report.rankings.bySpeed.length - 1; i++) {
          expect(report.rankings.bySpeed[i].processingSpeed)
            .toBeGreaterThanOrEqual(report.rankings.bySpeed[i + 1].processingSpeed);
        }
      }

      // 验证内存效率排名（从低到高）
      if (report.rankings.byMemoryEfficiency.length > 1) {
        for (let i = 0; i < report.rankings.byMemoryEfficiency.length - 1; i++) {
          expect(report.rankings.byMemoryEfficiency[i].peakMemoryUsage)
            .toBeLessThanOrEqual(report.rankings.byMemoryEfficiency[i + 1].peakMemoryUsage);
        }
      }
    });

    it('应该生成性能基线', async () => {
      const report = await benchmark.runBenchmarkSuite(testDecoders, testConfigs);

      expect(report.baselines).toBeDefined();
      
      // 检查成功的解码器是否有基线
      const successfulDecoders = [...new Set(report.results.filter(r => r.success).map(r => r.decoderId))];
      successfulDecoders.forEach(decoderId => {
        expect(report.baselines[decoderId]).toBeDefined();
        expect(report.baselines[decoderId].expectedSpeed).toBeGreaterThan(0);
        expect(report.baselines[decoderId].acceptableMemory).toBeGreaterThan(0);
        expect(report.baselines[decoderId].reliabilityScore).toBeGreaterThanOrEqual(0);
        expect(report.baselines[decoderId].reliabilityScore).toBeLessThanOrEqual(100);
      });
    });

    it('应该处理并发限制', async () => {
      const status1 = benchmark.getStatus();
      expect(status1.running).toBe(false);

      const promise1 = benchmark.runBenchmarkSuite(testDecoders, testConfigs);
      
      const status2 = benchmark.getStatus();
      expect(status2.running).toBe(true);

      // 尝试同时运行另一个测试应该失败
      await expect(benchmark.runBenchmarkSuite(testDecoders, testConfigs))
        .rejects.toThrow('基准测试正在进行中');

      await promise1;

      const status3 = benchmark.getStatus();
      expect(status3.running).toBe(false);
    });

    it('应该在测试过程中更新进度', async () => {
      await benchmark.runBenchmarkSuite(testDecoders, testConfigs);

      const totalTests = testDecoders.length * testConfigs.length;
      expect(mockProgressCallback).toHaveBeenCalled();
      
      // 检查最后一次进度回调
      const calls = mockProgressCallback.mock.calls;
      const lastProgressCall = calls.find(call => call[0].current === totalTests);
      expect(lastProgressCall).toBeDefined();
    });

    it('应该在测试间添加延迟', async () => {
      const originalSetTimeout = global.setTimeout;
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await benchmark.runBenchmarkSuite(testDecoders.slice(0, 1), testConfigs.slice(0, 1));

      expect(setTimeoutSpy).toHaveBeenCalled();
      
      setTimeoutSpy.mockRestore();
    });
  });

  describe('测试数据生成', () => {
    it('应该生成基准测试数据', () => {
      const sampleCount = 1000;
      const channelCount = 4;
      const data = (benchmark as any).generateBenchmarkData(sampleCount, channelCount);

      expect(data).toHaveLength(channelCount);
      data.forEach((channel, index) => {
        expect(channel.channelNumber).toBe(index);
        expect(channel.samples).toBeInstanceOf(Uint8Array);
        expect(channel.samples.length).toBe(sampleCount);
        expect(channel.name).toBe(`CH${index}`);
      });
    });

    it('应该生成不同协议的测试模式', () => {
      const protocols = ['i2c', 'spi', 'uart'];
      
      protocols.forEach(protocol => {
        for (let i = 0; i < 100; i++) {
          const pattern = (benchmark as any).generateProtocolPattern(i, protocol);
          expect(pattern).toBeGreaterThanOrEqual(0);
          expect(pattern).toBeLessThanOrEqual(1);
        }
      });
    });

    it('应该为时钟信号生成正确的模式', () => {
      const sampleCount = 100;
      const data = (benchmark as any).generateBenchmarkData(sampleCount, 4);
      
      // 第一个通道应该是时钟信号
      const clockChannel = data[0];
      const samples = clockChannel.samples;
      
      // 验证时钟模式
      for (let i = 0; i < sampleCount - 10; i += 10) {
        const currentValue = samples[i];
        const nextValue = samples[i + 10];
        expect(currentValue).not.toBe(nextValue); // 时钟应该有变化
      }
    });
  });

  describe('性能计算', () => {
    it('应该正确计算吞吐量', () => {
      const config: BenchmarkConfiguration = {
        name: '测试',
        sampleCount: 10000,
        sampleRate: 1000000,
        channelCount: 8,
        iterations: 5,
        useStreaming: false
      };
      const totalTime = 1000; // 1秒

      const throughput = (benchmark as any).calculateThroughput(config, totalTime);

      const expectedTotalBytes = config.sampleCount * config.channelCount * config.iterations;
      const expectedThroughput = expectedTotalBytes / 1 / (1024 * 1024); // MB/s

      expect(throughput).toBeCloseTo(expectedThroughput, 2);
    });

    it('应该处理内存使用测量', () => {
      // 测试有performance.memory的情况
      const memoryUsage1 = (benchmark as any).getMemoryUsage();
      expect(memoryUsage1).toBe(mockPerformance.memory.usedJSHeapSize);

      // 测试没有performance.memory的情况
      delete (global as any).performance.memory;
      const memoryUsage2 = (benchmark as any).getMemoryUsage();
      expect(memoryUsage2).toBe(0);
    });
  });

  describe('报告生成', () => {
    let mockReport: BenchmarkReport;

    beforeEach(() => {
      const mockResult1: DecoderPerformanceResult = {
        decoderId: 'fastDecoder',
        configuration: {
          name: '小数据集',
          sampleCount: 1000,
          sampleRate: 1000000,
          channelCount: 2,
          iterations: 3,
          useStreaming: false
        },
        executionTime: 50,
        processingSpeed: 60000,
        peakMemoryUsage: 1024 * 1024,
        resultCount: 10,
        errors: [],
        success: true,
        statistics: {
          averageIterationTime: 16.67,
          minIterationTime: 15,
          maxIterationTime: 20,
          standardDeviation: 2.5,
          throughput: 1.2
        }
      };

      const mockResult2: DecoderPerformanceResult = {
        decoderId: 'slowDecoder',
        configuration: {
          name: '小数据集',
          sampleCount: 1000,
          sampleRate: 1000000,
          channelCount: 2,
          iterations: 3,
          useStreaming: false
        },
        executionTime: 200,
        processingSpeed: 15000,
        peakMemoryUsage: 2048 * 1024,
        resultCount: 5,
        errors: [],
        success: true,
        statistics: {
          averageIterationTime: 66.67,
          minIterationTime: 60,
          maxIterationTime: 80,
          standardDeviation: 10,
          throughput: 0.3
        }
      };

      mockReport = {
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDuration: 5000,
        configurations: [mockResult1.configuration],
        results: [mockResult1, mockResult2],
        rankings: {
          bySpeed: [mockResult1, mockResult2],
          byMemoryEfficiency: [mockResult1, mockResult2],
          byThroughput: [mockResult1, mockResult2]
        },
        baselines: {
          fastDecoder: {
            expectedSpeed: 60000,
            acceptableMemory: 1228800, // 1024*1024*1.2
            reliabilityScore: 100
          },
          slowDecoder: {
            expectedSpeed: 15000,
            acceptableMemory: 2457600, // 2048*1024*1.2
            reliabilityScore: 100
          }
        }
      };
    });

    it('应该生成完整的基准测试报告', () => {
      const report = benchmark.generateReport(mockReport);

      expect(report).toContain('# 解码器性能基准测试报告');
      expect(report).toContain('## 测试概览');
      expect(report).toContain('## 性能排名');
      expect(report).toContain('## 性能基线');
      expect(report).toContain('## 详细测试结果');
    });

    it('应该包含测试概览信息', () => {
      const report = benchmark.generateReport(mockReport);

      expect(report).toContain('测试开始时间:');
      expect(report).toContain('测试总时长: 5.0秒');
      expect(report).toContain('测试配置数: 1');
      expect(report).toContain('测试结果数: 2');
      expect(report).toContain('成功率: 100.0%');
    });

    it('应该包含性能排名信息', () => {
      const report = benchmark.generateReport(mockReport);

      expect(report).toContain('### 处理速度排名');
      expect(report).toContain('1. fastDecoder: 60.0K样本/秒');
      expect(report).toContain('2. slowDecoder: 15.0K样本/秒');

      expect(report).toContain('### 内存效率排名');
      expect(report).toContain('1. fastDecoder: 1024.0KB');
      expect(report).toContain('2. slowDecoder: 2048.0KB');

      expect(report).toContain('### 吞吐量排名');
      expect(report).toContain('1. fastDecoder: 1.20MB/s');
      expect(report).toContain('2. slowDecoder: 0.30MB/s');
    });

    it('应该包含性能基线信息', () => {
      const report = benchmark.generateReport(mockReport);

      expect(report).toContain('### fastDecoder');
      expect(report).toContain('期望处理速度: 60.0K样本/秒');
      expect(report).toContain('可接受内存使用: 1200.0KB');
      expect(report).toContain('可靠性评分: 100.0%');
    });

    it('应该包含详细测试结果', () => {
      const report = benchmark.generateReport(mockReport);

      expect(report).toContain('### fastDecoder - 小数据集');
      expect(report).toContain('状态: ✅ 成功');
      expect(report).toContain('执行时间: 50.00ms');
      expect(report).toContain('平均迭代时间: 16.67ms');
      expect(report).toContain('标准差: 2.50ms');
    });

    it('应该包含错误信息', () => {
      const failedResult = {
        ...mockReport.results[0],
        success: false,
        errors: ['测试错误1', '测试错误2']
      };
      const reportWithErrors = {
        ...mockReport,
        results: [failedResult]
      };

      const report = benchmark.generateReport(reportWithErrors);

      expect(report).toContain('状态: ❌ 失败');
      expect(report).toContain('错误信息: 测试错误1, 测试错误2');
    });

    it('应该正确限制排名显示数量', () => {
      // 创建6个测试结果
      const manyResults = Array.from({ length: 6 }, (_, i) => ({
        ...mockReport.results[0],
        decoderId: `decoder${i}`,
        processingSpeed: 1000 * (6 - i)
      }));

      const reportWithManyResults = {
        ...mockReport,
        results: manyResults,
        rankings: {
          bySpeed: manyResults,
          byMemoryEfficiency: manyResults,
          byThroughput: manyResults
        }
      };

      const report = benchmark.generateReport(reportWithManyResults);

      // 应该只显示前5名
      expect(report).toContain('5. decoder4:');
      expect(report).not.toContain('6. decoder5:');
    });
  });

  describe('状态管理', () => {
    it('应该正确跟踪测试状态', () => {
      const initialStatus = benchmark.getStatus();
      expect(initialStatus.running).toBe(false);
      expect(initialStatus.currentTest).toBe('');
    });

    it('应该能够停止测试', () => {
      benchmark.stop();
      
      const status = benchmark.getStatus();
      expect(status.running).toBe(false);
    });

    it('应该在测试过程中更新当前测试信息', async () => {
      const decoder = new MockDecoder();
      const config: BenchmarkConfiguration = {
        name: '状态测试',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      };

      const testPromise = benchmark.runBenchmarkSuite([{ id: 'testDecoder', instance: decoder }], [config]);
      
      // 在测试运行时检查状态
      const runningStatus = benchmark.getStatus();
      expect(runningStatus.running).toBe(true);
      
      await testPromise;

      // 测试完成后检查状态
      const completedStatus = benchmark.getStatus();
      expect(completedStatus.running).toBe(false);
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理零迭代次数', async () => {
      const decoder = new MockDecoder();
      const config: BenchmarkConfiguration = {
        name: '零迭代测试',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 0,
        useStreaming: false
      };

      const result = await benchmark.runDecoderBenchmark('testDecoder', decoder, config);
      
      expect(result.statistics.averageIterationTime).toBe(0);
      expect(result.resultCount).toBe(0);
    });

    it('应该处理极小的样本数', async () => {
      const decoder = new MockDecoder();
      const config: BenchmarkConfiguration = {
        name: '小样本测试',
        sampleCount: 1,
        sampleRate: 1000000,
        channelCount: 1,
        iterations: 1,
        useStreaming: false
      };

      const result = await benchmark.runDecoderBenchmark('testDecoder', decoder, config);
      expect(result.success).toBe(true);
    });

    it('应该处理极大的样本数', async () => {
      const decoder = new MockDecoder();
      const config: BenchmarkConfiguration = {
        name: '大样本测试',
        sampleCount: 10000000,
        sampleRate: 1000000,
        channelCount: 16,
        iterations: 1,
        useStreaming: true,
        chunkSize: 1000
      };

      const result = await benchmark.runDecoderBenchmark('testDecoder', decoder, config);
      expect(result.success).toBe(true);
      expect(result.statistics.throughput).toBeGreaterThan(0);
    });

    it('应该处理空的解码器数组', async () => {
      const config: BenchmarkConfiguration = {
        name: '测试',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      };

      const report = await benchmark.runBenchmarkSuite([], [config]);
      
      expect(report.results).toHaveLength(0);
      expect(report.rankings.bySpeed).toHaveLength(0);
      expect(Object.keys(report.baselines)).toHaveLength(0);
    });

    it('应该处理空的配置数组', async () => {
      const decoder = new MockDecoder();
      const report = await benchmark.runBenchmarkSuite([{ id: 'test', instance: decoder }], []);
      
      expect(report.results).toHaveLength(0);
      expect(report.configurations).toHaveLength(0);
    });

    it('应该处理解码器抛出的异常', async () => {
      const throwingDecoder = {
        decode: jest.fn().mockRejectedValue(new Error('意外错误'))
      };

      const config: BenchmarkConfiguration = {
        name: '异常测试',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      };

      const result = await benchmark.runDecoderBenchmark('throwingDecoder', throwingDecoder, config);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('迭代 1: 意外错误');
    });

    it('应该处理无效的协议模式', () => {
      const invalidPattern = (benchmark as any).generateProtocolPattern(0, 'invalid_protocol');
      expect(invalidPattern).toBeGreaterThanOrEqual(0);
      expect(invalidPattern).toBeLessThanOrEqual(1);
    });
  });

  describe('性能验证', () => {
    it('应该在合理时间内完成小规模基准测试', async () => {
      const decoder = new MockHighPerformanceDecoder();
      const config: BenchmarkConfiguration = {
        name: '性能测试',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 4,
        iterations: 5,
        useStreaming: false
      };

      const startTime = Date.now();
      const result = await benchmark.runDecoderBenchmark('perfDecoder', decoder, config);
      const endTime = Date.now();

      const actualTime = endTime - startTime;
      expect(actualTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(result.success).toBe(true);
    });

    it('应该正确处理并发基准测试', async () => {
      const decoders = [
        { id: 'decoder1', instance: new MockHighPerformanceDecoder() },
        { id: 'decoder2', instance: new MockHighPerformanceDecoder() },
        { id: 'decoder3', instance: new MockHighPerformanceDecoder() }
      ];

      const config: BenchmarkConfiguration = {
        name: '并发测试',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 2,
        useStreaming: false
      };

      const promises = decoders.map(decoder => {
        const benchmarkInstance = new DecoderBenchmark();
        return benchmarkInstance.runDecoderBenchmark(decoder.id, decoder.instance, config);
      });

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});