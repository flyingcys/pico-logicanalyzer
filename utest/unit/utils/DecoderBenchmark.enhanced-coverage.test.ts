/**
 * DecoderBenchmark 增强覆盖率测试
 * 专门测试异常处理和边界条件，确保 100% 代码覆盖率
 */

import { 
  DecoderBenchmark, 
  BenchmarkConfiguration, 
  DecoderPerformanceResult, 
  BenchmarkReport,
  DefaultBenchmarkConfigurations
} from '../../../src/utils/DecoderBenchmark';

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

describe('DecoderBenchmark - 增强覆盖率测试', () => {
  let benchmark: DecoderBenchmark;
  let progressSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    progressSpy = jest.fn();
    benchmark = new DecoderBenchmark(progressSpy);
    
    // 重置performance.now的计数器
    let performanceTime = 1000;
    mockPerformance.now.mockImplementation(() => {
      const currentTime = performanceTime;
      performanceTime += 10;
      return currentTime;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    mockPerformance.now.mockClear();
  });

  describe('异常处理路径覆盖', () => {
    const testConfig: BenchmarkConfiguration = {
      name: '异常测试配置',
      sampleCount: 100,
      sampleRate: 1000000,
      channelCount: 2,
      iterations: 1,
      useStreaming: false
    };

    it('应该覆盖 runDecoderBenchmark 中的 catch 块 - 行213-214', async () => {
      // 创建一个会抛出异常的模拟解码器
      const failingDecoder = {
        decode: jest.fn().mockImplementation(() => {
          throw new Error('模拟基准测试失败');
        })
      };

      // 模拟性能 API 也抛出异常
      mockPerformance.now.mockImplementation(() => {
        throw new Error('性能API失败');
      });

      const result = await benchmark.runDecoderBenchmark('FailingDecoder', failingDecoder, testConfig);

      // 验证异常被正确处理
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('模拟基准测试失败');
    });

    it('应该覆盖 runBenchmarkSuite 中的 catch 块 - 行289-290', async () => {
      // 创建一个会抛出异常的解码器
      const problematicDecoder = {
        decode: jest.fn().mockRejectedValue(new Error('解码器初始化失败'))
      };

      const decoders = [
        { id: 'ProblematicDecoder', instance: problematicDecoder }
      ];

      const configs = [testConfig];

      // 模拟 runDecoderBenchmark 抛出未捕获的异常
      const originalRunDecoderBenchmark = benchmark.runDecoderBenchmark;
      jest.spyOn(benchmark, 'runDecoderBenchmark').mockImplementation(() => {
        throw new Error('基准测试套件内部错误');
      });

      // 验证异常被抛出（这是第290行的行为）
      await expect(benchmark.runBenchmarkSuite(decoders, configs)).rejects.toThrow('基准测试套件内部错误');

      // 恢复原始方法
      benchmark.runDecoderBenchmark = originalRunDecoderBenchmark;
    });

    it('应该在数据生成过程中处理异常', async () => {
      // 创建一个会抛出异常的解码器
      const decoder = {
        decode: jest.fn().mockRejectedValue(new Error('解码器执行失败'))
      };

      const result = await benchmark.runDecoderBenchmark('TestDecoder', decoder, testConfig);

      // 应该处理解码器异常
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it('应该处理解码器数据生成中的边界情况异常', async () => {
      // 模拟一个在特定条件下会失败的解码器
      const conditionalFailDecoder = {
        decode: jest.fn().mockImplementation((sampleRate, channels, options) => {
          if (channels.length > 0 && channels[0].samples.length > 50) {
            throw new Error('数据量过大，解码器无法处理');
          }
          return Promise.resolve({ results: [] });
        })
      };

      const largeSampleConfig = {
        ...testConfig,
        sampleCount: 100, // 大于50，会触发失败
        iterations: 1
      };

      const result = await benchmark.runDecoderBenchmark('ConditionalFailDecoder', conditionalFailDecoder, largeSampleConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('迭代 1: 数据量过大，解码器无法处理');
    });

    it('应该处理内存使用测量异常', async () => {
      const decoder = {
        decode: jest.fn().mockResolvedValue({ results: [] })
      };

      // 模拟 performance.memory 在使用过程中被移除
      let memoryCallCount = 0;
      Object.defineProperty(mockPerformance, 'memory', {
        get: () => {
          memoryCallCount++;
          if (memoryCallCount > 1) {
            throw new Error('内存测量接口异常');
          }
          return {
            usedJSHeapSize: 1000000,
            totalJSHeapSize: 2000000,
            jsHeapSizeLimit: 4000000000
          };
        },
        configurable: true
      });

      // 由于内存测量异常，但不应该影响整体测试结果
      const result = await benchmark.runDecoderBenchmark('TestDecoder', decoder, testConfig);
      
      // 测试应该仍能成功完成
      expect(result.success).toBe(true);
    });
  });

  describe('边界条件和错误恢复', () => {
    it('应该处理套件执行中的部分失败', async () => {
      jest.useRealTimers(); // 使用真实定时器
      
      const workingDecoder = {
        decode: jest.fn().mockResolvedValue({ 
          results: [
            { type: 'data', startSample: 0, endSample: 100, value: 'success' }
          ]
        })
      };

      const failingDecoder = {
        decode: jest.fn().mockRejectedValue(new Error('解码失败'))
      };

      const decoders = [
        { id: 'WorkingDecoder', instance: workingDecoder },
        { id: 'FailingDecoder', instance: failingDecoder }
      ];

      const configs = [{
        name: '混合测试',
        sampleCount: 50,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      }];

      const report = await benchmark.runBenchmarkSuite(decoders, configs);

      // 验证部分成功，部分失败的情况
      expect(report.results).toHaveLength(2);
      
      // 检查结果状态（可能全部成功或部分失败，都是正常的）
      const successCount = report.results.filter(r => r.success).length;
      const failureCount = report.results.filter(r => !r.success).length;
      
      expect(successCount + failureCount).toBe(2);
      expect(failureCount).toBeGreaterThan(0); // 至少有一个应该失败（FailingDecoder）
    }, 15000);

    it('应该处理性能统计计算中的数学异常', async () => {
      const decoder = {
        decode: jest.fn().mockResolvedValue({ results: [] })
      };

      // 模拟返回 NaN 或 Infinity 的性能时间
      let callCount = 0;
      mockPerformance.now.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return NaN; // 返回 NaN 来测试数学异常处理
        }
        return 1000;
      });

      const result = await benchmark.runDecoderBenchmark('MathExceptionDecoder', decoder, {
        name: '数学异常测试',
        sampleCount: 10,
        sampleRate: 1000000,
        channelCount: 1,
        iterations: 2,
        useStreaming: false
      });

      // 即使有数学异常，测试也应该能完成
      expect(result).toBeDefined();
      expect(typeof result.statistics.averageIterationTime).toBe('number');
    });

    it('应该处理空配置数组的边界情况', async () => {
      const decoder = { decode: jest.fn().mockResolvedValue({ results: [] }) };
      const decoders = [{ id: 'TestDecoder', instance: decoder }];
      
      // 空配置数组
      const emptyConfigs: BenchmarkConfiguration[] = [];

      const report = await benchmark.runBenchmarkSuite(decoders, emptyConfigs);

      expect(report.results).toHaveLength(0);
      expect(report.configurations).toHaveLength(0);
      expect(report.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('应该处理空解码器数组的边界情况', async () => {
      const emptyDecoders: Array<{ id: string; instance: any }> = [];
      const configs = [{
        name: '空解码器测试',
        sampleCount: 10,
        sampleRate: 1000000,
        channelCount: 1,
        iterations: 1,
        useStreaming: false
      }];

      const report = await benchmark.runBenchmarkSuite(emptyDecoders, configs);

      expect(report.results).toHaveLength(0);
      expect(report.totalDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('完整性验证', () => {
    it('应该确保所有默认配置都可以使用', () => {
      // 验证所有默认配置的完整性
      DefaultBenchmarkConfigurations.forEach(config => {
        expect(config.name).toBeTruthy();
        expect(config.sampleCount).toBeGreaterThan(0);
        expect(config.sampleRate).toBeGreaterThan(0);
        expect(config.channelCount).toBeGreaterThan(0);
        expect(config.iterations).toBeGreaterThan(0);
        expect(typeof config.useStreaming).toBe('boolean');
        
        if (config.useStreaming) {
          expect(config.chunkSize).toBeGreaterThan(0);
        }
      });
    });

    it('应该正确处理所有支持的协议模式', async () => {
      const decoder = {
        decode: jest.fn().mockResolvedValue({ results: [] })
      };

      const protocolTestConfig = {
        name: '协议模式完整测试',
        sampleCount: 1000, // 足够大以包含所有协议模式
        sampleRate: 1000000,
        channelCount: 5, // 包含所有协议通道
        iterations: 1,
        useStreaming: false
      };

      const result = await benchmark.runDecoderBenchmark('ProtocolDecoder', decoder, protocolTestConfig);

      expect(result.success).toBe(true);
      
      // 验证解码器被调用时传入了正确的通道数据
      expect(decoder.decode).toHaveBeenCalled();
      const callArgs = decoder.decode.mock.calls[0];
      const channels = callArgs[1];
      
      expect(channels).toHaveLength(5);
      // 验证各种协议模式都有数据变化（不全为0）
      channels.forEach((channel: any, index: number) => {
        const sum = Array.from(channel.samples).reduce((a: number, b: number) => a + b, 0);
        if (index < 4) { // 前4个通道应该有协议模式
          expect(sum).toBeGreaterThan(0);
        }
      });
    });
  });
});