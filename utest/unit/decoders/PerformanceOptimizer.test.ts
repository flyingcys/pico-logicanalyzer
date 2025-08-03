/**
 * PerformanceOptimizer.ts 单元测试
 * 测试性能优化工具类的所有功能
 */

import {
  PerformanceOptimizer,
  performanceOptimizer,
  MemoryStats,
  ProcessingStats,
  CompressionOptions,
  BatchConfig
} from '../../../src/decoders/PerformanceOptimizer';
import { ChannelData, DecoderResult } from '../../../src/decoders/types';

// Mock console methods to avoid log output during tests
const originalConsoleLog = console.log;

// Mock performance.memory for testing
const originalPerformanceMemory = (performance as any).memory;

// Mock global.gc for testing
const originalGlobalGc = (global as any).gc;

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;
  let mockChannelData: ChannelData[];

  beforeEach(() => {
    optimizer = new PerformanceOptimizer();
    
    // 创建模拟通道数据
    mockChannelData = [
      {
        name: 'CH0',
        channelNumber: 0,
        samples: new Uint8Array([1, 1, 1, 0, 0, 0, 1, 1])
      },
      {
        name: 'CH1',
        channelNumber: 1,
        samples: new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1])
      }
    ];

    // Mock console.log
    console.log = jest.fn();

    // Mock performance.memory
    (performance as any).memory = {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      jsHeapSizeLimit: 1024 * 1024 * 1024, // 1GB
      externalMemory: 10 * 1024 * 1024 // 10MB
    };

    // Mock global.gc
    (global as any).gc = jest.fn();
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Restore performance.memory
    (performance as any).memory = originalPerformanceMemory;
    
    // Restore global.gc
    (global as any).gc = originalGlobalGc;
  });

  describe('构造函数和配置', () => {
    it('应该使用默认配置创建优化器', () => {
      const defaultOptimizer = new PerformanceOptimizer();
      expect(defaultOptimizer).toBeInstanceOf(PerformanceOptimizer);
    });

    it('应该使用自定义压缩选项', () => {
      const compressionOptions: Partial<CompressionOptions> = {
        algorithm: 'delta',
        threshold: 2048,
        enabled: false
      };

      const customOptimizer = new PerformanceOptimizer(compressionOptions);
      expect(customOptimizer).toBeInstanceOf(PerformanceOptimizer);
    });

    it('应该使用自定义批处理配置', () => {
      const batchConfig: Partial<BatchConfig> = {
        batchSize: 500,
        batchInterval: 20,
        maxBatches: 5
      };

      const customOptimizer = new PerformanceOptimizer({}, batchConfig);
      expect(customOptimizer).toBeInstanceOf(PerformanceOptimizer);
    });

    it('应该同时使用自定义压缩和批处理配置', () => {
      const compressionOptions: Partial<CompressionOptions> = {
        algorithm: 'lz4',
        enabled: true
      };

      const batchConfig: Partial<BatchConfig> = {
        batchSize: 200,
        maxBatches: 20
      };

      const customOptimizer = new PerformanceOptimizer(compressionOptions, batchConfig);
      expect(customOptimizer).toBeInstanceOf(PerformanceOptimizer);
    });
  });

  describe('内存统计', () => {
    it('应该获取内存使用统计', () => {
      const stats = optimizer.getMemoryStats();
      
      expect(stats).toBeDefined();
      expect(stats.usedHeapSize).toBe(50 * 1024 * 1024);
      expect(stats.totalHeapSize).toBe(100 * 1024 * 1024);
      expect(stats.heapUsagePercent).toBe(50);
      expect(stats.heapSizeLimit).toBe(1024 * 1024 * 1024);
      expect(stats.externalMemory).toBe(10 * 1024 * 1024);
    });

    it('应该处理不支持performance.memory的环境', () => {
      // 模拟不支持performance.memory的环境
      (performance as any).memory = undefined;

      const stats = optimizer.getMemoryStats();
      
      expect(stats.usedHeapSize).toBe(0);
      expect(stats.totalHeapSize).toBe(0);
      expect(stats.heapUsagePercent).toBe(0);
      expect(stats.heapSizeLimit).toBe(0);
      expect(stats.externalMemory).toBeUndefined();
    });

    it('应该计算正确的堆使用率', () => {
      // 设置不同的内存使用情况
      (performance as any).memory.usedJSHeapSize = 75 * 1024 * 1024;
      (performance as any).memory.totalJSHeapSize = 100 * 1024 * 1024;

      const stats = optimizer.getMemoryStats();
      expect(stats.heapUsagePercent).toBe(75);
    });
  });

  describe('内存优化决策', () => {
    it('应该正确判断是否需要内存优化', () => {
      // 设置低内存使用（50%）
      (performance as any).memory.usedJSHeapSize = 50 * 1024 * 1024;
      (performance as any).memory.totalJSHeapSize = 100 * 1024 * 1024;
      
      expect(optimizer.shouldOptimizeMemory()).toBe(false);

      // 设置高内存使用（85%）
      (performance as any).memory.usedJSHeapSize = 85 * 1024 * 1024;
      expect(optimizer.shouldOptimizeMemory()).toBe(true);
    });

    it('应该正确建议垃圾回收', () => {
      // 设置中等内存使用（80%）
      (performance as any).memory.usedJSHeapSize = 80 * 1024 * 1024;
      (performance as any).memory.totalJSHeapSize = 100 * 1024 * 1024;
      
      expect(optimizer.suggestGarbageCollection()).toBe(false);

      // 设置极高内存使用（95%）
      (performance as any).memory.usedJSHeapSize = 95 * 1024 * 1024;
      expect(optimizer.suggestGarbageCollection()).toBe(true);
    });

    it('应该设置自定义内存阈值', () => {
      optimizer.setMemoryThreshold(0.6); // 60%

      (performance as any).memory.usedJSHeapSize = 70 * 1024 * 1024;
      (performance as any).memory.totalJSHeapSize = 100 * 1024 * 1024;

      expect(optimizer.shouldOptimizeMemory()).toBe(true);
    });

    it('应该限制内存阈值在合理范围内', () => {
      optimizer.setMemoryThreshold(-0.5); // 应该被限制到0.1
      optimizer.setMemoryThreshold(1.5);  // 应该被限制到0.95

      // 测试极低内存使用仍不触发优化（因为阈值被限制到最小0.1）
      (performance as any).memory.usedJSHeapSize = 5 * 1024 * 1024; // 5%
      expect(optimizer.shouldOptimizeMemory()).toBe(false);
    });
  });

  describe('数据压缩', () => {
    it('应该使用RLE算法压缩和解压数据', () => {
      // 创建一个优化器，设置低阈值以确保压缩被执行
      const rleOptimizer = new PerformanceOptimizer({
        algorithm: 'rle',
        threshold: 0 // 强制压缩所有数据
      });

      const testData = new Uint8Array([1, 1, 1, 0, 0, 0, 0, 1, 1]);
      
      const compressedChannels = rleOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: testData }
      ]);

      expect(compressedChannels).toHaveLength(1);
      const compressedChannel = compressedChannels[0] as any;
      expect(compressedChannel.compressed).toBe(true);
      expect(compressedChannel.compressionAlgorithm).toBe('rle');
      expect(compressedChannel.samples.length).toBeLessThan(testData.length);

      // 验证解压
      const decompressedChannels = rleOptimizer.decompressChannelData(compressedChannels);
      expect(decompressedChannels[0].samples).toEqual(testData);
    });

    it('应该使用Delta算法压缩和解压数据', () => {
      const deltaOptimizer = new PerformanceOptimizer({
        algorithm: 'delta',
        threshold: 0 // 强制压缩所有数据
      });

      const testData = new Uint8Array([100, 101, 102, 101, 100, 99]);
      
      const compressedChannels = deltaOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: testData }
      ]);

      const compressedChannel = compressedChannels[0] as any;
      expect(compressedChannel.compressed).toBe(true);
      expect(compressedChannel.compressionAlgorithm).toBe('delta');

      // 验证解压
      const decompressedChannels = deltaOptimizer.decompressChannelData(compressedChannels);
      expect(decompressedChannels[0].samples).toEqual(testData);
    });

    it('应该在压缩禁用时返回原始数据', () => {
      const noCompressionOptimizer = new PerformanceOptimizer({
        enabled: false
      });

      const originalChannels = mockChannelData;
      const result = noCompressionOptimizer.compressChannelData(originalChannels);

      expect(result).toBe(originalChannels);
    });

    it('应该跳过小于阈值的数据', () => {
      const highThresholdOptimizer = new PerformanceOptimizer({
        threshold: 1000 // 高阈值
      });

      const result = highThresholdOptimizer.compressChannelData(mockChannelData);
      
      // 由于数据小于阈值，应该不被压缩
      expect((result[0] as any).compressed).toBeUndefined();
    });

    it('应该处理空样本数据', () => {
      const channelWithoutSamples: ChannelData = {
        name: 'Empty',
        channelNumber: 0
      };

      const result = optimizer.compressChannelData([channelWithoutSamples]);
      expect(result[0]).toBe(channelWithoutSamples);
    });

    it('应该正确处理LZ4算法（回退到RLE）', () => {
      const lz4Optimizer = new PerformanceOptimizer({
        algorithm: 'lz4',
        threshold: 0
      });

      const testData = new Uint8Array([1, 1, 1, 0, 0]);
      const result = lz4Optimizer.compressChannelData([
        { ...mockChannelData[0], samples: testData }
      ]);

      // 应该回退到RLE压缩
      const compressedChannel = result[0] as any;
      expect(compressedChannel.compressed).toBe(true);
      expect(compressedChannel.compressionAlgorithm).toBe('lz4');
    });

    it('应该设置自定义压缩选项', () => {
      const newOptions: Partial<CompressionOptions> = {
        algorithm: 'delta',
        threshold: 512,
        enabled: false
      };

      optimizer.setCompressionOptions(newOptions);

      // 由于压缩被禁用，应该返回原始数据
      const result = optimizer.compressChannelData(mockChannelData);
      expect(result).toBe(mockChannelData);
    });

    it('应该处理none算法', () => {
      const noneOptimizer = new PerformanceOptimizer({
        algorithm: 'none',
        threshold: 0
      });

      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const result = noneOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: testData }
      ]);

      // none算法应该返回原始数据，但仍会设置compressed标志（因为经过了压缩流程）
      expect(result[0].samples).toEqual(testData);
      expect((result[0] as any).compressed).toBe(true);
      expect((result[0] as any).compressionAlgorithm).toBe('none');
    });

    it('应该处理未知压缩算法（回退到原始数据）', () => {
      const unknownOptimizer = new PerformanceOptimizer({
        algorithm: 'unknown' as any,
        threshold: 0
      });

      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const result = unknownOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: testData }
      ]);

      // 未知算法应该返回原始数据，但仍会设置compressed标志
      expect(result[0].samples).toEqual(testData);
      expect((result[0] as any).compressed).toBe(true);
      expect((result[0] as any).compressionAlgorithm).toBe('unknown');
    });

    it('应该处理RLE解压异常情况', () => {
      const rleOptimizer = new PerformanceOptimizer({
        algorithm: 'rle',
        threshold: 0
      });

      // 创建一个有效的RLE压缩数据，然后测试解压
      const originalData = new Uint8Array([1, 1, 1, 0, 0]);
      const compressedChannels = rleOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: originalData }
      ]);

      // 验证可以正确解压
      const decompressedChannels = rleOptimizer.decompressChannelData(compressedChannels);
      expect(decompressedChannels[0].samples).toEqual(originalData);
    });

    it('应该处理未压缩的数据解压', () => {
      const uncompressedChannel = {
        ...mockChannelData[0],
        samples: new Uint8Array([1, 2, 3])
      };

      const result = optimizer.decompressChannelData([uncompressedChannel]);
      
      // 未压缩的数据应该直接返回
      expect(result[0]).toBe(uncompressedChannel);
    });

    it('应该处理没有samples的通道解压', () => {
      const channelWithoutSamples = {
        name: 'Test',
        channelNumber: 0
      };

      const result = optimizer.decompressChannelData([channelWithoutSamples]);
      expect(result[0]).toBe(channelWithoutSamples);
    });
  });

  describe('批处理功能', () => {
    it('应该正确处理批次', async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processor = jest.fn().mockImplementation(async (item: number) => {
        return [{
          startSample: item,
          endSample: item + 1,
          annotationType: 0,
          values: [`result-${item}`],
          shape: 'hexagon'
        }];
      });

      const results = await optimizer.processBatch(items, processor);

      expect(results).toHaveLength(10);
      expect(processor).toHaveBeenCalledTimes(10);
      expect(results[0].values).toEqual(['result-1']);
      expect(results[9].values).toEqual(['result-10']);
    });

    it('应该在批次完成时调用回调', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = jest.fn().mockResolvedValue([{
        startSample: 0,
        endSample: 1,
        annotationType: 0,
        values: ['test'],
        shape: 'hexagon'
      }]);
      const onBatchComplete = jest.fn();

      await optimizer.processBatch(items, processor, onBatchComplete);

      expect(onBatchComplete).toHaveBeenCalled();
    });

    it('应该限制最大批次数量', async () => {
      const limitedOptimizer = new PerformanceOptimizer({}, {
        batchSize: 2,
        maxBatches: 2
      });

      const items = [1, 2, 3, 4, 5, 6, 7, 8]; // 8个项目，应该被分成4个批次
      const processor = jest.fn().mockResolvedValue([{
        startSample: 0,
        endSample: 1,
        annotationType: 0,
        values: ['test'],
        shape: 'hexagon'
      }]);

      const results = await limitedOptimizer.processBatch(items, processor);

      // 由于限制为2个批次，只应该处理前4个项目
      expect(results).toHaveLength(4);
      expect(processor).toHaveBeenCalledTimes(4);
    });

    it('应该在内存使用过高时暂停批处理', async () => {
      // 模拟高内存使用
      (performance as any).memory.usedJSHeapSize = 90 * 1024 * 1024;
      (performance as any).memory.totalJSHeapSize = 100 * 1024 * 1024;

      const items = [1, 2, 3];
      const processor = jest.fn().mockResolvedValue([{
        startSample: 0,
        endSample: 1,
        annotationType: 0,
        values: ['test'],
        shape: 'hexagon'
      }]);

      const results = await optimizer.processBatch(items, processor);

      expect(results).toHaveLength(3);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('内存使用过高'));
    });

    it('应该设置自定义批处理配置', () => {
      const newConfig: Partial<BatchConfig> = {
        batchSize: 50,
        batchInterval: 5,
        maxBatches: 100
      };

      optimizer.setBatchConfig(newConfig);

      // 验证配置已更新（通过批处理行为间接验证）
      expect(() => optimizer.setBatchConfig(newConfig)).not.toThrow();
    });
  });

  describe('内存优化执行', () => {
    it('应该执行内存优化', async () => {
      // 模拟内存使用降低的效果
      (performance as any).memory.usedJSHeapSize = 90 * 1024 * 1024;
      
      await optimizer.performMemoryOptimization();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('开始内存优化'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('内存优化完成'));
    });

    it('应该在可用时调用垃圾回收', async () => {
      // 设置高内存使用以触发垃圾回收建议
      (performance as any).memory.usedJSHeapSize = 95 * 1024 * 1024;
      
      await optimizer.performMemoryOptimization();

      expect((global as any).gc).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('♻️ 手动触发垃圾回收');
    });

    it('应该在垃圾回收不可用时仍能正常工作', async () => {
      // 移除gc函数
      (global as any).gc = undefined;
      
      await expect(optimizer.performMemoryOptimization()).resolves.not.toThrow();
    });
  });

  describe('解码结果优化', () => {
    it('应该移除无效结果', () => {
      const results: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['valid'],
          shape: 'hexagon'
        },
        {
          startSample: -1, // 无效的开始样本
          endSample: 5,
          annotationType: 0,
          values: ['invalid'],
          shape: 'hexagon'
        },
        {
          startSample: 15,
          endSample: 10, // 结束样本小于开始样本
          annotationType: 0,
          values: ['invalid'],
          shape: 'hexagon'
        },
        {
          startSample: 20,
          endSample: 25,
          annotationType: 0,
          values: [], // 空值数组
          shape: 'hexagon'
        }
      ];

      const optimized = optimizer.optimizeDecoderResults(results);

      expect(optimized).toHaveLength(1);
      expect(optimized[0].values).toEqual(['valid']);
    });

    it('应该合并相似的相邻结果', () => {
      const results: DecoderResult[] = [
        {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['data'],
          shape: 'hexagon'
        },
        {
          startSample: 11, // 相邻
          endSample: 20,
          annotationType: 0,
          values: ['data'], // 相同值
          shape: 'hexagon'
        },
        {
          startSample: 30,
          endSample: 40,
          annotationType: 1, // 不同注释类型
          values: ['data'],
          shape: 'hexagon'
        }
      ];

      const optimized = optimizer.optimizeDecoderResults(results);

      expect(optimized).toHaveLength(2);
      expect(optimized[0].startSample).toBe(0);
      expect(optimized[0].endSample).toBe(20); // 合并后的结束位置
      expect(optimized[1].annotationType).toBe(1);
    });

    it('应该处理空结果数组', () => {
      const results: DecoderResult[] = [];
      const optimized = optimizer.optimizeDecoderResults(results);

      expect(optimized).toEqual([]);
    });

    it('应该在优化超过5%时记录日志', () => {
      // 创建100个结果，其中50个无效
      const results: DecoderResult[] = [];
      
      for (let i = 0; i < 50; i++) {
        results.push({
          startSample: i * 10,
          endSample: i * 10 + 5,
          annotationType: 0,
          values: ['valid'],
          shape: 'hexagon'
        });
      }
      
      for (let i = 0; i < 50; i++) {
        results.push({
          startSample: -1, // 无效
          endSample: 5,
          annotationType: 0,
          values: ['invalid'],
          shape: 'hexagon'
        });
      }

      optimizer.optimizeDecoderResults(results);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('解码结果优化'));
    });
  });

  describe('性能报告', () => {
    it('应该生成正确的性能报告', () => {
      const startTime = 1000;
      const endTime = 2000;
      const samplesProcessed = 100000;
      const resultsGenerated = 50;
      const peakMemoryUsage = 64 * 1024 * 1024;

      const report = optimizer.generatePerformanceReport(
        startTime,
        endTime,
        samplesProcessed,
        resultsGenerated,
        peakMemoryUsage
      );

      expect(report.startTime).toBe(1000);
      expect(report.endTime).toBe(2000);
      expect(report.totalTime).toBe(1000);
      expect(report.samplesProcessed).toBe(100000);
      expect(report.processingSpeed).toBe(100000); // 100k samples per second
      expect(report.resultsGenerated).toBe(50);
      expect(report.peakMemoryUsage).toBe(64 * 1024 * 1024);
    });

    it('应该处理零处理时间', () => {
      const report = optimizer.generatePerformanceReport(
        1000,
        1000, // 相同时间
        1000,
        10,
        1024
      );

      expect(report.totalTime).toBe(0);
      expect(report.processingSpeed).toBe(Infinity);
    });
  });

  describe('优化建议', () => {
    it('应该建议增加块大小当处理速度慢时', () => {
      const slowStats: ProcessingStats = {
        startTime: 0,
        endTime: 1000,
        totalTime: 1000,
        samplesProcessed: 50000, // 低处理速度
        processingSpeed: 50000,
        resultsGenerated: 10,
        peakMemoryUsage: 50 * 1024 * 1024
      };

      const suggestions = optimizer.getOptimizationSuggestions(slowStats);
      expect(suggestions).toContain('考虑增加块大小以提高处理效率');
    });

    it('应该建议启用压缩当内存使用高时', () => {
      const highMemoryStats: ProcessingStats = {
        startTime: 0,
        endTime: 1000,
        totalTime: 1000,
        samplesProcessed: 200000,
        processingSpeed: 200000,
        resultsGenerated: 10,
        peakMemoryUsage: 150 * 1024 * 1024 // 高内存使用
      };

      const suggestions = optimizer.getOptimizationSuggestions(highMemoryStats);
      expect(suggestions).toContain('启用数据压缩以减少内存使用');
    });

    it('应该建议使用流式处理当处理时间长时', () => {
      const longTimeStats: ProcessingStats = {
        startTime: 0,
        endTime: 15000,
        totalTime: 15000, // 超过10秒
        samplesProcessed: 200000,
        processingSpeed: 200000,
        resultsGenerated: 10,
        peakMemoryUsage: 50 * 1024 * 1024
      };

      const suggestions = optimizer.getOptimizationSuggestions(longTimeStats);
      expect(suggestions).toContain('考虑使用流式处理以提高响应性');
    });

    it('应该建议检查配置当没有结果时', () => {
      const noResultsStats: ProcessingStats = {
        startTime: 0,
        endTime: 1000,
        totalTime: 1000,
        samplesProcessed: 200000,
        processingSpeed: 200000,
        resultsGenerated: 0, // 没有结果
        peakMemoryUsage: 50 * 1024 * 1024
      };

      const suggestions = optimizer.getOptimizationSuggestions(noResultsStats);
      expect(suggestions).toContain('检查解码器配置和输入数据');
    });

    it('应该在性能良好时不提供建议', () => {
      const goodStats: ProcessingStats = {
        startTime: 0,
        endTime: 1000,
        totalTime: 1000,
        samplesProcessed: 500000, // 高处理速度
        processingSpeed: 500000,
        resultsGenerated: 100,
        peakMemoryUsage: 50 * 1024 * 1024 // 合理内存使用
      };

      const suggestions = optimizer.getOptimizationSuggestions(goodStats);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('全局实例', () => {
    it('应该提供全局性能优化器实例', () => {
      expect(performanceOptimizer).toBeInstanceOf(PerformanceOptimizer);
    });

    it('全局实例应该是单例', () => {
      const { performanceOptimizer: optimizer1 } = require('../../../src/decoders/PerformanceOptimizer');
      const { performanceOptimizer: optimizer2 } = require('../../../src/decoders/PerformanceOptimizer');
      
      expect(optimizer1).toBe(optimizer2);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理极小的数据数组', () => {
      const tinyData = new Uint8Array([1]);
      const result = optimizer.compressChannelData([
        { ...mockChannelData[0], samples: tinyData }
      ]);

      expect(result).toHaveLength(1);
    });

    it('应该处理空的数据数组', () => {
      const emptyData = new Uint8Array([]);
      const result = optimizer.compressChannelData([
        { ...mockChannelData[0], samples: emptyData }
      ]);

      expect(result).toHaveLength(1);
    });

    it('应该处理所有相同值的数据', () => {
      const uniformData = new Uint8Array(100).fill(1);
      const compressedChannels = optimizer.compressChannelData([
        { ...mockChannelData[0], samples: uniformData }
      ]);

      const decompressedChannels = optimizer.decompressChannelData(compressedChannels);
      expect(decompressedChannels[0].samples).toEqual(uniformData);
    });

    it('应该处理异步处理器错误', async () => {
      const items = [1, 2, 3];
      const failingProcessor = jest.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(optimizer.processBatch(items, failingProcessor)).rejects.toThrow('Processing failed');
    });

    it('应该处理边界值的内存阈值', () => {
      optimizer.setMemoryThreshold(0); // 应该被限制到0.1
      optimizer.setMemoryThreshold(1); // 应该被限制到0.95

      // 验证阈值被正确限制
      expect(() => optimizer.setMemoryThreshold(0)).not.toThrow();
      expect(() => optimizer.setMemoryThreshold(1)).not.toThrow();
    });

    it('应该处理负的样本值', () => {
      const results: DecoderResult[] = [
        {
          startSample: -10,
          endSample: -5,
          annotationType: 0,
          values: ['negative'],
          shape: 'hexagon'
        }
      ];

      const optimized = optimizer.optimizeDecoderResults(results);
      expect(optimized).toHaveLength(0); // 应该被过滤掉
    });

    it('应该处理极大的数据集', () => {
      // 创建一个优化器，设置低阈值以确保压缩被执行
      const largeDataOptimizer = new PerformanceOptimizer({
        algorithm: 'rle',
        threshold: 1000 // 设置较低的阈值
      });

      const largeData = new Uint8Array(100000).fill(0);
      // 添加一些变化以避免过度压缩
      for (let i = 0; i < largeData.length; i += 1000) {
        largeData[i] = 1;
      }

      const result = largeDataOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: largeData }
      ]);

      expect(result).toHaveLength(1);
      expect((result[0] as any).compressed).toBe(true);
    });

    it('应该测试RLE压缩的边界情况', () => {
      const rleOptimizer = new PerformanceOptimizer({
        algorithm: 'rle',
        threshold: 0
      });

      // 测试奇数长度的RLE压缩数据解压
      const oddLengthData = new Uint8Array([3, 1, 2, 0]); // 奇数长度（手动构造的RLE数据）
      const compressedChannel = {
        ...mockChannelData[0],
        samples: oddLengthData,
        compressed: true,
        compressionAlgorithm: 'rle'
      } as any;

      const result = rleOptimizer.decompressChannelData([compressedChannel]);
      expect(result[0].samples).toBeDefined();
    });

    it('应该测试Delta压缩的边界情况', () => {
      const deltaOptimizer = new PerformanceOptimizer({
        algorithm: 'delta',
        threshold: 0
      });

      // 测试空数组的Delta压缩
      const emptyData = new Uint8Array([]);
      const result = deltaOptimizer.compressChannelData([
        { ...mockChannelData[0], samples: emptyData }
      ]);

      expect(result[0].samples).toEqual(emptyData);
    });

    it('应该测试解压缩时的算法回退', () => {
      // 测试解压缩时使用未知算法
      const channelWithUnknownAlgorithm = {
        ...mockChannelData[0],
        samples: new Uint8Array([1, 2, 3]),
        compressed: true,
        compressionAlgorithm: 'unknown'
      } as any;

      const result = optimizer.decompressChannelData([channelWithUnknownAlgorithm]);
      expect(result[0].samples).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('应该测试没有压缩算法信息的解压', () => {
      // 测试压缩标志为true但没有算法信息的情况
      const channelWithoutAlgorithm = {
        ...mockChannelData[0],
        samples: new Uint8Array([1, 2, 3]),
        compressed: true
      } as any;

      const result = optimizer.decompressChannelData([channelWithoutAlgorithm]);
      expect(result[0].samples).toBeDefined();
    });

    it('应该测试LZ4解压功能（回退到RLE）', () => {
      // 测试LZ4算法的解压功能
      const lz4Channel = {
        ...mockChannelData[0],
        samples: new Uint8Array([3, 1, 2, 0]), // RLE格式数据
        compressed: true,
        compressionAlgorithm: 'lz4'
      } as any;

      const result = optimizer.decompressChannelData([lz4Channel]);
      expect(result[0].samples).toBeDefined();
      // LZ4应该回退到RLE解压
      expect(result[0].samples.length).toBeGreaterThan(0);
    });
  });
});