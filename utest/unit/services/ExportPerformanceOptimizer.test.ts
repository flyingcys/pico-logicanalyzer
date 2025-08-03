/**
 * ExportPerformanceOptimizer 单元测试
 * 测试导出性能优化器的所有功能模块
 */

import { ExportPerformanceOptimizer, PerformanceConfig, PerformanceMetrics } from '../../../src/services/ExportPerformanceOptimizer';

describe('ExportPerformanceOptimizer', () => {
  let optimizer: ExportPerformanceOptimizer;
  let defaultConfig: PerformanceConfig;

  beforeEach(() => {
    defaultConfig = {
      maxMemoryUsage: 512,
      chunkSize: 50000,
      enableCompression: true,
      useWebWorkers: false,
      maxConcurrentChunks: 3
    };
    optimizer = new ExportPerformanceOptimizer(defaultConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该使用默认配置创建优化器', () => {
      const defaultOptimizer = new ExportPerformanceOptimizer();
      expect(defaultOptimizer).toBeDefined();
    });

    it('应该使用自定义配置创建优化器', () => {
      const customConfig = {
        maxMemoryUsage: 1024,
        chunkSize: 100000,
        enableCompression: false
      };
      const customOptimizer = new ExportPerformanceOptimizer(customConfig);
      expect(customOptimizer).toBeDefined();
    });

    it('应该正确合并默认配置和自定义配置', () => {
      const partialConfig = {
        maxMemoryUsage: 256,
        enableCompression: false
      };
      const customOptimizer = new ExportPerformanceOptimizer(partialConfig);
      expect(customOptimizer).toBeDefined();
    });
  });

  describe('optimizeConfig 方法', () => {
    it('应该为小数据集优化配置', () => {
      const optimized = optimizer.optimizeConfig(5000, 8);
      expect(optimized.chunkSize).toBe(5000); // 小于10000时设置为数据大小
      expect(optimized.maxConcurrentChunks).toBe(1);
    });

    it('应该为超大数据集启用激进优化', () => {
      const optimized = optimizer.optimizeConfig(2000000, 16);
      expect(optimized.enableCompression).toBe(true);
      expect(optimized.maxConcurrentChunks).toBeLessThanOrEqual(5);
    });

    it('应该根据内存压力调整块大小', () => {
      // 创建一个内存限制很小的优化器
      const restrictedOptimizer = new ExportPerformanceOptimizer({
        maxMemoryUsage: 64, // 很小的内存限制
        chunkSize: 50000
      });
      
      const optimized = restrictedOptimizer.optimizeConfig(1000000, 32);
      expect(optimized.chunkSize).toBeLessThan(50000); // 应该减小块大小
      expect(optimized.chunkSize).toBeGreaterThanOrEqual(1000); // 但不能小于最小值
    });

    it('应该保持最小块大小限制', () => {
      const restrictedOptimizer = new ExportPerformanceOptimizer({
        maxMemoryUsage: 1, // 极小的内存限制
        chunkSize: 50000
      });
      
      const optimized = restrictedOptimizer.optimizeConfig(1000000, 64);
      expect(optimized.chunkSize).toBe(1000); // 应该达到最小限制
    });

    it('应该为中等数据集保持原始配置', () => {
      const optimized = optimizer.optimizeConfig(100000, 8);
      expect(optimized.chunkSize).toBe(50000); // 保持默认值
      expect(optimized.maxConcurrentChunks).toBe(3);
    });
  });

  describe('processLargeDataset 方法', () => {
    it('应该成功处理小数据集', async () => {
      const testData = Array.from({ length: 1000 }, (_, i) => ({ value: i }));
      const mockProcessor = jest.fn().mockResolvedValue('processed');
      const mockProgress = jest.fn();

      const results = await optimizer.processLargeDataset(
        testData,
        mockProcessor,
        mockProgress
      );

      expect(results).toHaveLength(1); // 小数据集应该只有一个块
      expect(mockProcessor).toHaveBeenCalledTimes(1);
      expect(mockProgress).toHaveBeenCalled();
    });

    it('应该正确分块处理大数据集', async () => {
      const testData = Array.from({ length: 150000 }, (_, i) => ({ value: i }));
      const mockProcessor = jest.fn().mockResolvedValue('processed');

      const results = await optimizer.processLargeDataset(
        testData,
        mockProcessor
      );

      expect(results.length).toBeGreaterThan(1); // 应该分成多个块
      expect(mockProcessor.mock.calls.length).toBeGreaterThan(1);
    });

    it('应该报告处理进度', async () => {
      const testData = Array.from({ length: 10000 }, (_, i) => ({ value: i }));
      const mockProcessor = jest.fn().mockResolvedValue('processed');
      const mockProgress = jest.fn();

      await optimizer.processLargeDataset(
        testData,
        mockProcessor,
        mockProgress
      );

      expect(mockProgress).toHaveBeenCalled();
      const lastCall = mockProgress.mock.calls[mockProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBeCloseTo(100); // 最后应该是100%
      expect(lastCall[1]).toHaveProperty('processingTime');
      expect(lastCall[1]).toHaveProperty('throughput');
    });

    it('应该处理处理器抛出的错误', async () => {
      const testData = Array.from({ length: 1000 }, (_, i) => ({ value: i }));
      const mockProcessor = jest.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(
        optimizer.processLargeDataset(testData, mockProcessor)
      ).rejects.toThrow('Processing failed');
    });

    it('应该限制并发处理数量', async () => {
      const testData = Array.from({ length: 100000 }, (_, i) => ({ value: i }));
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const mockProcessor = jest.fn().mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 10));
        
        concurrentCount--;
        return 'processed';
      });

      await optimizer.processLargeDataset(testData, mockProcessor);

      expect(maxConcurrent).toBeLessThanOrEqual(defaultConfig.maxConcurrentChunks);
    });
  });

  describe('compressData 方法', () => {
    it('应该处理禁用压缩的情况', async () => {
      const disabledOptimizer = new ExportPerformanceOptimizer({
        enableCompression: false
      });
      
      const testData = 'test data';
      const result = await disabledOptimizer.compressData(testData, 'csv');
      
      expect(result.data).toBe(testData);
      expect(result.compressionRatio).toBe(1);
    });

    it('应该压缩VCD格式数据', async () => {
      const vcdData = `$version test $end
#0
1a
0b
#0
1c
#1
0a
1b`;
      
      const result = await optimizer.compressData(vcdData, 'vcd');
      expect(result.data).not.toContain('#0\n1c'); // 重复时间戳应该被移除
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('应该压缩CSV格式数据', async () => {
      const csvData = `time,ch1,ch2,ch3
0,1,0,1
1,1,0,1
2,0,0,1
3,0,1,1`;
      
      const result = await optimizer.compressData(csvData, 'csv');
      expect(result.data).toContain('"'); // 重复值应该用引号表示
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('应该压缩JSON格式数据', async () => {
      const jsonData = `{
        "samples": [
          {"time": 0, "value": 1},
          {"time": 1, "value": 0}
        ]
      }`;
      
      const result = await optimizer.compressData(jsonData, 'json');
      expect(result.data).not.toContain('\n'); // 空白字符应该被移除
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('应该处理未知格式', async () => {
      const testData = '  test   data  with  spaces  ';
      const result = await optimizer.compressData(testData, 'unknown');
      
      expect(result.data).toBe('test data with spaces'); // 空白字符压缩
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('应该处理无效JSON数据', async () => {
      const invalidJson = '{ invalid json data }';
      const result = await optimizer.compressData(invalidJson, 'json');
      
      expect(result.data).toBe(invalidJson); // 应该返回原始数据
      expect(result.compressionRatio).toBe(1);
    });

    it('应该正确计算压缩比', async () => {
      const testData = 'aaaaaaaaaa'; // 重复字符
      const result = await optimizer.compressData(testData, 'unknown');
      
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('内存估算功能', () => {
    it('应该正确估算小数据集的内存使用', () => {
      // 使用反射访问私有方法进行测试
      const estimateMemoryUsage = (optimizer as any).estimateMemoryUsage.bind(optimizer);
      const memory = estimateMemoryUsage(1000, 8);
      
      expect(memory).toBeGreaterThan(0);
      expect(memory).toBeLessThan(1); // 小数据集应该小于1MB
    });

    it('应该正确估算大数据集的内存使用', () => {
      const estimateMemoryUsage = (optimizer as any).estimateMemoryUsage.bind(optimizer);
      const memory = estimateMemoryUsage(1000000, 32);
      
      expect(memory).toBeGreaterThan(50); // 大数据集应该需要更多内存
    });

    it('应该考虑通道数量对内存的影响', () => {
      const estimateMemoryUsage = (optimizer as any).estimateMemoryUsage.bind(optimizer);
      const memory1 = estimateMemoryUsage(10000, 8);
      const memory2 = estimateMemoryUsage(10000, 16);
      
      expect(memory2).toBeGreaterThan(memory1); // 更多通道需要更多内存
    });
  });

  describe('性能指标计算', () => {
    it('应该正确计算性能指标', () => {
      const calculateMetrics = (optimizer as any).calculateMetrics.bind(optimizer);
      const startTime = Date.now() - 1000; // 1秒前开始
      const metrics = calculateMetrics(startTime, 50000, 100000);
      
      expect(metrics.processingTime).toBeGreaterThan(0);
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('MemoryMonitor', () => {
  // 由于MemoryMonitor是内部类，我们通过ExportPerformanceOptimizer来测试
  let optimizer: ExportPerformanceOptimizer;

  beforeEach(() => {
    optimizer = new ExportPerformanceOptimizer({
      maxMemoryUsage: 100
    });
  });

  it('应该监控内存使用情况', () => {
    // Mock performance.memory
    Object.defineProperty(global.performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024
      },
      configurable: true
    });

    const memoryMonitor = (optimizer as any).memoryMonitor;
    const usage = memoryMonitor.getCurrentUsage();
    
    expect(usage).toBeCloseTo(50, 1); // 应该是50MB左右
  });

  it('应该在没有memory API时返回0', () => {
    // 移除memory属性
    delete (global.performance as any).memory;

    const memoryMonitor = (optimizer as any).memoryMonitor;
    const usage = memoryMonitor.getCurrentUsage();
    
    expect(usage).toBe(0);
  });
});

describe('ChunkProcessor', () => {
  let optimizer: ExportPerformanceOptimizer;

  beforeEach(() => {
    optimizer = new ExportPerformanceOptimizer({
      chunkSize: 1000
    });
  });

  it('应该正确分割数据为块', () => {
    const testData = Array.from({ length: 2500 }, (_, i) => i);
    const chunkProcessor = (optimizer as any).chunkProcessor;
    const chunks = chunkProcessor.splitIntoChunks(testData);
    
    expect(chunks).toHaveLength(3); // 2500 / 1000 = 3块
    expect(chunks[0]).toHaveLength(1000);
    expect(chunks[1]).toHaveLength(1000);
    expect(chunks[2]).toHaveLength(500);
  });

  it('应该处理空数据', () => {
    const testData: any[] = [];
    const chunkProcessor = (optimizer as any).chunkProcessor;
    const chunks = chunkProcessor.splitIntoChunks(testData);
    
    expect(chunks).toHaveLength(0);
  });

  it('应该处理小于块大小的数据', () => {
    const testData = Array.from({ length: 500 }, (_, i) => i);
    const chunkProcessor = (optimizer as any).chunkProcessor;
    const chunks = chunkProcessor.splitIntoChunks(testData);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(500);
  });
});

describe('Semaphore', () => {
  it('应该限制并发执行数量', async () => {
    const optimizer = new ExportPerformanceOptimizer({
      maxConcurrentChunks: 2,
      chunkSize: 1000 // 确保会分块
    });
    
    let runningTasks = 0;
    let maxConcurrent = 0;
    const results: number[] = [];

    // 使用足够大的数据集确保分块处理
    const largeDataset = Array.from({ length: 5000 }, (_, i) => ({ value: i }));

    await optimizer.processLargeDataset(
      largeDataset,
      async (chunk, index) => {
        runningTasks++;
        maxConcurrent = Math.max(maxConcurrent, runningTasks);
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        runningTasks--;
        results.push(index);
        return `result-${index}`;
      }
    );
    
    expect(maxConcurrent).toBeLessThanOrEqual(2); // 不应超过信号量限制
    expect(results.length).toBeGreaterThan(1); // 应该有多个块
  });

  it('应该正确处理任务队列', async () => {
    const optimizer = new ExportPerformanceOptimizer({
      maxConcurrentChunks: 1,
      chunkSize: 1000
    });
    
    const executionOrder: number[] = [];
    // 使用足够大的数据集确保分块
    const testData = Array.from({ length: 3000 }, (_, i) => ({ value: i }));

    await optimizer.processLargeDataset(
      testData,
      async (chunk, index) => {
        executionOrder.push(index);
        await new Promise(resolve => setTimeout(resolve, 5));
        return `result-${index}`;
      }
    );

    expect(executionOrder[0]).toBe(0); // 第一个应该是0
    expect(executionOrder.length).toBeGreaterThan(1); // 应该有多个块
  });
});

describe('集成测试', () => {
  it('应该完整执行导出优化流程', async () => {
    const optimizer = new ExportPerformanceOptimizer({
      maxMemoryUsage: 256,
      chunkSize: 1000,
      enableCompression: true,
      maxConcurrentChunks: 2
    });

    // 生成足够大的测试数据确保分块处理
    const testData = Array.from({ length: 10000 }, (_, i) => ({
      time: i,
      channels: [i % 2, (i + 1) % 2, i % 3, (i + 2) % 3]
    }));

    let progressReports = 0;
    
    // 处理数据
    const results = await optimizer.processLargeDataset(
      testData,
      async (chunk) => {
        // 模拟导出为CSV格式
        const csv = chunk.map(item => 
          `${item.time},${item.channels.join(',')}`
        ).join('\n');
        return csv;
      },
      (progress, metrics) => {
        progressReports++;
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
        expect(metrics.processingTime).toBeGreaterThan(0);
        expect(metrics.throughput).toBeGreaterThan(0);
      }
    );

    expect(results.length).toBeGreaterThan(1); // 应该产生多个块的结果
    expect(progressReports).toBeGreaterThan(0); // 应该有进度报告

    // 压缩结果
    const combinedResult = results.join('\n');
    const compressed = await optimizer.compressData(combinedResult, 'csv');
    
    expect(compressed.data).toBeDefined();
    expect(compressed.compressionRatio).toBeGreaterThan(0);
    expect(compressed.compressionRatio).toBeLessThanOrEqual(1);
  });

  it('应该处理异常情况', async () => {
    const optimizer = new ExportPerformanceOptimizer();

    // 测试处理器异常
    const testData = [{ value: 1 }, { value: 2 }];
    await expect(
      optimizer.processLargeDataset(
        testData,
        async () => {
          throw new Error('Simulated processing error');
        }
      )
    ).rejects.toThrow('Simulated processing error');

    // 测试压缩异常恢复
    const invalidData = '{ invalid json }';
    const result = await optimizer.compressData(invalidData, 'json');
    expect(result.data).toBe(invalidData);
  });
});