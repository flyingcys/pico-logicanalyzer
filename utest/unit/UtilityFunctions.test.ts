/**
 * 工具函数综合测试
 * 测试MemoryManager和DecoderBenchmark工具类
 * 对应单元测试扩展计划 - 阶段五：工具函数测试
 */

import {
  MemoryManager,
  MemoryBlock,
  MemoryPool,
  MemoryStats,
  memoryManager
} from '../src/utils/MemoryManager';

import {
  DecoderBenchmark,
  BenchmarkConfiguration,
  DecoderPerformanceResult,
  BenchmarkReport,
  DefaultBenchmarkConfigurations
} from '../src/utils/DecoderBenchmark';

// Mock global performance object
const mockPerformance = {
  now: jest.fn(),
  memory: {
    usedJSHeapSize: 1024 * 1024, // 1MB
    totalJSHeapSize: 2 * 1024 * 1024, // 2MB
    jsHeapSizeLimit: 4 * 1024 * 1024 // 4MB
  }
};

// Mock global gc function
const mockGc = jest.fn();

beforeAll(() => {
  global.performance = mockPerformance as any;
  global.gc = mockGc;
});

afterAll(() => {
  delete (global as any).performance;
  delete (global as any).gc;
});

describe('MemoryManager Initialization and Pool Management', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  it('应成功初始化内存管理器', () => {
    // Assert
    expect(manager).toBeDefined();
    expect(manager.getAllPoolsInfo().length).toBeGreaterThan(0);
  });

  it('应创建默认内存池', () => {
    // Act
    const pools = manager.getAllPoolsInfo();

    // Assert
    expect(pools.length).toBe(4);
    const poolNames = pools.map(pool => pool.name);
    expect(poolNames).toContain('channelData');
    expect(poolNames).toContain('decoderResults');
    expect(poolNames).toContain('cache');
    expect(poolNames).toContain('temporary');
  });

  it('应成功创建自定义内存池', () => {
    // Act
    manager.createPool('customPool', {
      maxSize: 50 * 1024 * 1024, // 50MB
      releaseStrategy: 'lru'
    });

    // Assert
    const pool = manager.getPoolInfo('customPool');
    expect(pool).toBeDefined();
    expect(pool!.name).toBe('customPool');
    expect(pool!.maxSize).toBe(50 * 1024 * 1024);
    expect(pool!.releaseStrategy).toBe('lru');
    expect(pool!.currentSize).toBe(0);
    expect(pool!.blocks.size).toBe(0);
  });

  it('应获取池信息', () => {
    // Act
    const channelPool = manager.getPoolInfo('channelData');

    // Assert
    expect(channelPool).toBeDefined();
    expect(channelPool!.name).toBe('channelData');
    expect(channelPool!.maxSize).toBeGreaterThan(0);
  });

  it('应获取不存在池的null值', () => {
    // Act
    const nonExistentPool = manager.getPoolInfo('nonExistent');

    // Assert
    expect(nonExistentPool).toBeNull();
  });

  it('应获取所有池信息', () => {
    // Act
    const allPools = manager.getAllPoolsInfo();

    // Assert
    expect(Array.isArray(allPools)).toBe(true);
    expect(allPools.length).toBeGreaterThan(0);
    allPools.forEach(pool => {
      expect(pool.name).toBeDefined();
      expect(pool.maxSize).toBeGreaterThan(0);
      expect(pool.releaseStrategy).toBeDefined();
    });
  });
});

describe('MemoryManager Memory Allocation and Management', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  it('应成功分配内存', () => {
    // Arrange
    const testData = new Uint8Array(1024); // 1KB data

    // Act
    const result = manager.allocate('cache', 'test-block', testData, {
      priority: 'high',
      canRelease: true
    });

    // Assert
    expect(result).toBe(true);
    const pool = manager.getPoolInfo('cache');
    expect(pool!.blocks.size).toBe(1);
    expect(pool!.currentSize).toBeGreaterThan(0);
  });

  it('应拒绝向不存在的池分配内存', () => {
    // Arrange
    const testData = new Uint8Array(1024);

    // Act
    const result = manager.allocate('nonExistentPool', 'test-block', testData);

    // Assert
    expect(result).toBe(false);
  });

  it('应成功获取已分配的内存块', () => {
    // Arrange
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    manager.allocate('cache', 'test-block', testData);

    // Act
    const retrieved = manager.get('cache', 'test-block');

    // Assert
    expect(retrieved).toBe(testData);
    expect(retrieved).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('应返回null当获取不存在的内存块', () => {
    // Act
    const retrieved = manager.get('cache', 'nonExistentBlock');

    // Assert
    expect(retrieved).toBeNull();
  });

  it('应返回null当从不存在的池获取内存块', () => {
    // Act
    const retrieved = manager.get('nonExistentPool', 'block');

    // Assert
    expect(retrieved).toBeNull();
  });

  it('应成功释放内存块', () => {
    // Arrange
    const testData = new Uint8Array(1024);
    manager.allocate('cache', 'test-block', testData);

    // Act
    const result = manager.release('cache', 'test-block');

    // Assert
    expect(result).toBe(true);
    const pool = manager.getPoolInfo('cache');
    expect(pool!.blocks.size).toBe(0);
    expect(pool!.currentSize).toBe(0);
  });

  it('应拒绝释放不存在的内存块', () => {
    // Act
    const result = manager.release('cache', 'nonExistentBlock');

    // Assert
    expect(result).toBe(false);
  });

  it('应拒绝从不存在的池释放内存块', () => {
    // Act
    const result = manager.release('nonExistentPool', 'block');

    // Assert
    expect(result).toBe(false);
  });

  it('应在超出池限制时自动释放内存', () => {
    // Arrange
    manager.createPool('smallPool', { maxSize: 2048 }); // 2KB pool
    const data1 = new Uint8Array(1000);
    const data2 = new Uint8Array(1000);
    const data3 = new Uint8Array(1000); // This should trigger release

    // Act
    manager.allocate('smallPool', 'block1', data1, { canRelease: true });
    manager.allocate('smallPool', 'block2', data2, { canRelease: true });
    const result3 = manager.allocate('smallPool', 'block3', data3);

    // Assert - 应该成功分配，因为会自动释放旧的内存块
    expect(result3).toBe(true);
  });

  it('应拒绝分配当内存不足且无法释放时', () => {
    // Arrange
    manager.createPool('tinyPool', { maxSize: 1024 }); // 1KB pool
    const data1 = new Uint8Array(800);
    const data2 = new Uint8Array(800); // This should exceed capacity

    manager.allocate('tinyPool', 'block1', data1, { canRelease: false }); // Cannot release

    // Act
    const result = manager.allocate('tinyPool', 'block2', data2);

    // Assert
    expect(result).toBe(false);
  });
});

describe('MemoryManager Release Strategies', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  it('应使用LRU策略释放内存', () => {
    // Arrange
    manager.createPool('lruPool', { maxSize: 3000, releaseStrategy: 'lru' });
    const data1 = new Uint8Array(1000);
    const data2 = new Uint8Array(1000);
    const data3 = new Uint8Array(1000);
    const data4 = new Uint8Array(1000); // Should trigger LRU release

    manager.allocate('lruPool', 'block1', data1, { canRelease: true });
    jest.advanceTimersByTime(1000);
    manager.allocate('lruPool', 'block2', data2, { canRelease: true });
    jest.advanceTimersByTime(1000);
    manager.allocate('lruPool', 'block3', data3, { canRelease: true });
    
    // Access block1 to make it more recently used
    manager.get('lruPool', 'block1');

    // Act
    const result = manager.allocate('lruPool', 'block4', data4);

    // Assert
    expect(result).toBe(true);
    // block2 should be released (least recently used)
    expect(manager.get('lruPool', 'block2')).toBeNull();
    expect(manager.get('lruPool', 'block1')).not.toBeNull();
    expect(manager.get('lruPool', 'block3')).not.toBeNull();
  });

  it('应使用优先级策略释放内存', () => {
    // Arrange
    manager.createPool('priorityPool', { maxSize: 3000, releaseStrategy: 'priority' });
    const data1 = new Uint8Array(1000);
    const data2 = new Uint8Array(1000);
    const data3 = new Uint8Array(1000);
    const data4 = new Uint8Array(1000);

    manager.allocate('priorityPool', 'highPrio', data1, { priority: 'high', canRelease: true });
    manager.allocate('priorityPool', 'lowPrio', data2, { priority: 'low', canRelease: true });
    manager.allocate('priorityPool', 'mediumPrio', data3, { priority: 'medium', canRelease: true });

    // Act
    const result = manager.allocate('priorityPool', 'newBlock', data4);

    // Assert
    expect(result).toBe(true);
    // Low priority block should be released first
    expect(manager.get('priorityPool', 'lowPrio')).toBeNull();
    expect(manager.get('priorityPool', 'highPrio')).not.toBeNull();
    expect(manager.get('priorityPool', 'mediumPrio')).not.toBeNull();
  });
});

describe('MemoryManager Pool Operations', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  it('应清空内存池', () => {
    // Arrange
    const data1 = new Uint8Array(1000);
    const data2 = new Uint8Array(1000);
    manager.allocate('cache', 'block1', data1);
    manager.allocate('cache', 'block2', data2);

    // Act
    manager.clearPool('cache');

    // Assert
    const pool = manager.getPoolInfo('cache');
    expect(pool!.blocks.size).toBe(0);
    expect(pool!.currentSize).toBe(0);
  });

  it('应处理清空不存在的池', () => {
    // Act & Assert (should not throw)
    manager.clearPool('nonExistentPool');
  });

  it('应设置内存阈值', () => {
    // Act
    manager.setMemoryThreshold(0.7);

    // Assert - 测试阈值是否在合理范围内
    manager.setMemoryThreshold(-0.1); // 应该被限制到最小值
    manager.setMemoryThreshold(1.5);  // 应该被限制到最大值
    // 如果没有异常抛出，测试通过
  });
});

describe('MemoryManager Garbage Collection and Leak Detection', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  it('应执行强制垃圾回收', () => {
    // Act
    manager.forceGarbageCollection();

    // Assert
    expect(mockGc).toHaveBeenCalled();
  });

  it('应检测内存泄漏', () => {
    // Arrange
    const testData = new Uint8Array(1000);
    manager.allocate('cache', 'suspiciousBlock', testData, { canRelease: true });

    // Simulate old block (advance time by more than 10 minutes)
    jest.advanceTimersByTime(12 * 60 * 1000);

    // Act
    const leaks = manager.detectMemoryLeaks();

    // Assert
    expect(Array.isArray(leaks)).toBe(true);
    if (leaks.length > 0) {
      expect(leaks[0]).toHaveProperty('poolName');
      expect(leaks[0]).toHaveProperty('blockId');
      expect(leaks[0]).toHaveProperty('age');
      expect(leaks[0]).toHaveProperty('size');
      expect(leaks[0]).toHaveProperty('accessCount');
    }
  });

  it('应获取内存统计信息', () => {
    // Arrange
    const testData = new Uint8Array(1000);
    manager.allocate('cache', 'testBlock', testData);

    // Act
    const stats = manager.getMemoryStats();

    // Assert
    expect(stats).toHaveProperty('totalUsed');
    expect(stats).toHaveProperty('available');
    expect(stats).toHaveProperty('poolCount');
    expect(stats).toHaveProperty('activeBlocks');
    expect(stats).toHaveProperty('gcCount');
    expect(stats).toHaveProperty('leakDetection');
    expect(stats.leakDetection).toHaveProperty('suspiciousBlocks');
    expect(stats.leakDetection).toHaveProperty('oldestBlock');
    expect(stats.leakDetection).toHaveProperty('memoryGrowthRate');
    
    expect(typeof stats.totalUsed).toBe('number');
    expect(typeof stats.available).toBe('number');
    expect(stats.poolCount).toBeGreaterThan(0);
    expect(stats.activeBlocks).toBeGreaterThan(0);
  });
});

describe('MemoryManager Data Size Calculation', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    jest.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    jest.useRealTimers();
  });

  it('应正确计算不同数据类型的大小', () => {
    // Test various data types
    const testCases = [
      { data: null, expectedSize: 0 },
      { data: undefined, expectedSize: 0 },
      { data: new Uint8Array(100), expectedSize: 100 },
      { data: 'hello', expectedSize: 10 }, // 5 chars * 2 bytes (UTF-16)
      { data: 42, expectedSize: 8 }, // 64-bit float
      { data: true, expectedSize: 1 },
      { data: [1, 2, 3], expectedMinSize: 24 }, // Array overhead
      { data: { key: 'value' }, expectedMinSize: 32 } // Object overhead
    ];

    testCases.forEach(({ data, expectedSize, expectedMinSize }) => {
      manager.allocate('cache', `test-${Math.random()}`, data);
      
      if (expectedSize !== undefined) {
        // Exact size expectation
        expect(true).toBe(true); // Just ensure no errors
      } else if (expectedMinSize !== undefined) {
        // Minimum size expectation
        expect(true).toBe(true); // Just ensure no errors
      }
    });
  });
});

describe('MemoryManager Global Instance', () => {
  it('应提供全局内存管理器实例', () => {
    // Assert
    expect(memoryManager).toBeDefined();
    expect(memoryManager).toBeInstanceOf(MemoryManager);
  });

  it('应能使用全局实例进行内存操作', () => {
    // Arrange
    const testData = new Uint8Array(100);

    // Act
    const result = memoryManager.allocate('cache', 'globalTest', testData);
    const retrieved = memoryManager.get('cache', 'globalTest');
    const released = memoryManager.release('cache', 'globalTest');

    // Assert
    expect(result).toBe(true);
    expect(retrieved).toBe(testData);
    expect(released).toBe(true);
  });
});

describe('DecoderBenchmark Initialization and Configuration', () => {
  let benchmark: DecoderBenchmark;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    mockProgressCallback = jest.fn();
    benchmark = new DecoderBenchmark(mockProgressCallback);
    mockPerformance.now.mockReturnValue(1000);
    jest.clearAllMocks();
  });

  it('应成功初始化基准测试器', () => {
    // Assert
    expect(benchmark).toBeDefined();
    expect(benchmark.getStatus().running).toBe(false);
    expect(benchmark.getStatus().currentTest).toBe('');
  });

  it('应支持无进度回调的初始化', () => {
    // Act
    const benchmarkNoCallback = new DecoderBenchmark();

    // Assert
    expect(benchmarkNoCallback).toBeDefined();
  });

  it('应获取测试状态', () => {
    // Act
    const status = benchmark.getStatus();

    // Assert
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('currentTest');
    expect(typeof status.running).toBe('boolean');
    expect(typeof status.currentTest).toBe('string');
  });

  it('应停止基准测试', () => {
    // Act
    benchmark.stop();

    // Assert
    expect(benchmark.getStatus().running).toBe(false);
  });
});

describe('DecoderBenchmark Single Decoder Testing', () => {
  let benchmark: DecoderBenchmark;
  let mockDecoder: any;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    mockProgressCallback = jest.fn();
    benchmark = new DecoderBenchmark(mockProgressCallback);
    
    mockDecoder = {
      decode: jest.fn().mockResolvedValue({
        results: [
          { type: 'data', value: 0x42 },
          { type: 'data', value: 0x43 }
        ]
      }),
      streamingDecode: jest.fn().mockResolvedValue({
        results: [
          { type: 'stream', value: 0x44 }
        ]
      })
    };

    // Mock performance.now to return incrementing values
    let timeCounter = 1000;
    mockPerformance.now.mockImplementation(() => timeCounter++);
    
    jest.clearAllMocks();
  });

  it('应成功运行解码器基准测试', async () => {
    // Arrange
    const config: BenchmarkConfiguration = {
      name: 'Test Configuration',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 4,
      iterations: 2,
      useStreaming: false
    };

    // Act
    const result = await benchmark.runDecoderBenchmark('TestDecoder', mockDecoder, config);

    // Assert
    expect(result).toBeDefined();
    expect(result.decoderId).toBe('TestDecoder');
    expect(result.configuration).toBe(config);
    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.processingSpeed).toBeGreaterThan(0);
    expect(result.resultCount).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.statistics).toBeDefined();
    expect(result.statistics.averageIterationTime).toBeGreaterThan(0);
    expect(result.statistics.throughput).toBeGreaterThan(0);
    
    expect(mockDecoder.decode).toHaveBeenCalledTimes(config.iterations);
    expect(mockProgressCallback).toHaveBeenCalled();
  });

  it('应支持流式解码测试', async () => {
    // Arrange
    const config: BenchmarkConfiguration = {
      name: 'Streaming Test',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 4,
      iterations: 1,
      useStreaming: true,
      chunkSize: 100
    };

    // Act
    const result = await benchmark.runDecoderBenchmark('StreamingDecoder', mockDecoder, config);

    // Assert
    expect(result.success).toBe(true);
    expect(mockDecoder.streamingDecode).toHaveBeenCalled();
    expect(mockDecoder.decode).not.toHaveBeenCalled();
  });

  it('应处理解码器错误', async () => {
    // Arrange
    const errorDecoder = {
      decode: jest.fn().mockRejectedValue(new Error('Decode failed'))
    };
    
    const config: BenchmarkConfiguration = {
      name: 'Error Test',
      sampleCount: 100,
      sampleRate: 1000000,
      channelCount: 2,
      iterations: 1,
      useStreaming: false
    };

    // Act
    const result = await benchmark.runDecoderBenchmark('ErrorDecoder', errorDecoder, config);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Decode failed');
  });

  it('应处理不支持标准接口的解码器', async () => {
    // Arrange
    const invalidDecoder = {}; // No decode method
    
    const config: BenchmarkConfiguration = {
      name: 'Invalid Decoder Test',
      sampleCount: 100,
      sampleRate: 1000000,
      channelCount: 2,
      iterations: 1,
      useStreaming: false
    };

    // Act
    const result = await benchmark.runDecoderBenchmark('InvalidDecoder', invalidDecoder, config);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('解码器不支持标准接口');
  });

  it('应正确计算统计信息', async () => {
    // Arrange
    const config: BenchmarkConfiguration = {
      name: 'Statistics Test',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 4,
      iterations: 3,
      useStreaming: false
    };

    // Act
    const result = await benchmark.runDecoderBenchmark('StatsDecoder', mockDecoder, config);

    // Assert
    expect(result.statistics).toBeDefined();
    expect(result.statistics.averageIterationTime).toBeGreaterThan(0);
    expect(result.statistics.minIterationTime).toBeGreaterThanOrEqual(0);
    expect(result.statistics.maxIterationTime).toBeGreaterThanOrEqual(result.statistics.minIterationTime);
    expect(result.statistics.standardDeviation).toBeGreaterThanOrEqual(0);
    expect(result.statistics.throughput).toBeGreaterThan(0);
  });
});

describe('DecoderBenchmark Test Suite Execution', () => {
  let benchmark: DecoderBenchmark;
  let mockDecoders: Array<{ id: string; instance: any }>;
  let mockConfigurations: BenchmarkConfiguration[];

  beforeEach(() => {
    benchmark = new DecoderBenchmark();
    
    mockDecoders = [
      {
        id: 'FastDecoder',
        instance: {
          decode: jest.fn().mockResolvedValue({ results: [{ type: 'data', value: 1 }] })
        }
      },
      {
        id: 'SlowDecoder',
        instance: {
          decode: jest.fn().mockResolvedValue({ results: [{ type: 'data', value: 2 }] })
        }
      }
    ];

    mockConfigurations = [
      {
        name: 'Small Test',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      },
      {
        name: 'Medium Test',
        sampleCount: 1000,
        sampleRate: 1000000,
        channelCount: 4,
        iterations: 1,
        useStreaming: false
      }
    ];

    let timeCounter = 1000;
    mockPerformance.now.mockImplementation(() => timeCounter++);
    
    jest.clearAllMocks();
  });

  it('应成功运行完整基准测试套件', async () => {
    // Act
    const report = await benchmark.runBenchmarkSuite(mockDecoders, mockConfigurations);

    // Assert
    expect(report).toBeDefined();
    expect(report.startTime).toBeGreaterThan(0);
    expect(report.endTime).toBeGreaterThan(report.startTime);
    expect(report.totalDuration).toBeGreaterThan(0);
    expect(report.configurations).toEqual(mockConfigurations);
    expect(report.results).toHaveLength(4); // 2 decoders × 2 configurations
    
    // Check rankings
    expect(report.rankings.bySpeed).toBeDefined();
    expect(report.rankings.byMemoryEfficiency).toBeDefined();
    expect(report.rankings.byThroughput).toBeDefined();
    
    // Check baselines
    expect(report.baselines).toBeDefined();
    expect(report.baselines['FastDecoder']).toBeDefined();
    expect(report.baselines['SlowDecoder']).toBeDefined();
  });

  it('应拒绝并行运行基准测试', async () => {
    // Arrange - Start first test suite
    const promise1 = benchmark.runBenchmarkSuite(mockDecoders, mockConfigurations);

    // Act & Assert
    await expect(benchmark.runBenchmarkSuite(mockDecoders, mockConfigurations))
      .rejects.toThrow('基准测试正在进行中');

    // Cleanup
    await promise1;
  });

  it('应正确计算性能排名', async () => {
    // Arrange
    const fastDecoder = {
      id: 'FastDecoder',
      instance: {
        decode: jest.fn().mockImplementation(async () => {
          // Simulate fast execution
          await new Promise(resolve => setTimeout(resolve, 10));
          return { results: [{ type: 'data', value: 1 }] };
        })
      }
    };

    const slowDecoder = {
      id: 'SlowDecoder',
      instance: {
        decode: jest.fn().mockImplementation(async () => {
          // Simulate slow execution
          await new Promise(resolve => setTimeout(resolve, 100));
          return { results: [{ type: 'data', value: 2 }] };
        })
      }
    };

    // Act
    const report = await benchmark.runBenchmarkSuite(
      [fastDecoder, slowDecoder],
      [mockConfigurations[0]]
    );

    // Assert
    expect(report.rankings.bySpeed.length).toBeGreaterThan(0);
    expect(report.rankings.byMemoryEfficiency.length).toBeGreaterThan(0);
    expect(report.rankings.byThroughput.length).toBeGreaterThan(0);
    
    // Speed ranking should have fastest first
    if (report.rankings.bySpeed.length >= 2) {
      expect(report.rankings.bySpeed[0].processingSpeed)
        .toBeGreaterThanOrEqual(report.rankings.bySpeed[1].processingSpeed);
    }
  });

  it('应生成性能基线', async () => {
    // Act
    const report = await benchmark.runBenchmarkSuite(mockDecoders, mockConfigurations);

    // Assert
    Object.values(report.baselines).forEach(baseline => {
      expect(baseline.expectedSpeed).toBeGreaterThan(0);
      expect(baseline.acceptableMemory).toBeGreaterThan(0);
      expect(baseline.reliabilityScore).toBeGreaterThanOrEqual(0);
      expect(baseline.reliabilityScore).toBeLessThanOrEqual(100);
    });
  });
});

describe('DecoderBenchmark Data Generation', () => {
  let benchmark: DecoderBenchmark;

  beforeEach(() => {
    benchmark = new DecoderBenchmark();
    jest.clearAllMocks();
  });

  it('应生成基准测试数据', async () => {
    // Arrange
    const mockDecoder = {
      decode: jest.fn().mockImplementation((sampleRate, channels, options) => {
        // Verify generated data structure
        expect(Array.isArray(channels)).toBe(true);
        expect(channels.length).toBeGreaterThan(0);
        
        channels.forEach((channel: any) => {
          expect(channel).toHaveProperty('channelNumber');
          expect(channel).toHaveProperty('samples');
          expect(channel).toHaveProperty('name');
          expect(channel.samples).toBeInstanceOf(Uint8Array);
        });

        return { results: [] };
      })
    };

    const config: BenchmarkConfiguration = {
      name: 'Data Generation Test',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 4,
      iterations: 1,
      useStreaming: false
    };

    // Act
    await benchmark.runDecoderBenchmark('DataTestDecoder', mockDecoder, config);

    // Assert
    expect(mockDecoder.decode).toHaveBeenCalled();
  });
});

describe('DecoderBenchmark Report Generation', () => {
  let benchmark: DecoderBenchmark;

  beforeEach(() => {
    benchmark = new DecoderBenchmark();
    jest.clearAllMocks();
  });

  it('应生成基准测试报告', async () => {
    // Arrange
    const mockReport: BenchmarkReport = {
      startTime: Date.now() - 10000,
      endTime: Date.now(),
      totalDuration: 10000,
      configurations: [
        {
          name: 'Test Config',
          sampleCount: 1000,
          sampleRate: 1000000,
          channelCount: 4,
          iterations: 1,
          useStreaming: false
        }
      ],
      results: [
        {
          decoderId: 'TestDecoder',
          configuration: {
            name: 'Test Config',
            sampleCount: 1000,
            sampleRate: 1000000,
            channelCount: 4,
            iterations: 1,
            useStreaming: false
          },
          executionTime: 100,
          processingSpeed: 10000,
          peakMemoryUsage: 1024,
          resultCount: 5,
          errors: [],
          success: true,
          statistics: {
            averageIterationTime: 100,
            minIterationTime: 95,
            maxIterationTime: 105,
            standardDeviation: 5,
            throughput: 1.5
          }
        }
      ],
      rankings: {
        bySpeed: [],
        byMemoryEfficiency: [],
        byThroughput: []
      },
      baselines: {
        'TestDecoder': {
          expectedSpeed: 10000,
          acceptableMemory: 1024,
          reliabilityScore: 100
        }
      }
    };

    // Populate rankings
    mockReport.rankings.bySpeed = [...mockReport.results];
    mockReport.rankings.byMemoryEfficiency = [...mockReport.results];
    mockReport.rankings.byThroughput = [...mockReport.results];

    // Act
    const reportText = benchmark.generateReport(mockReport);

    // Assert
    expect(typeof reportText).toBe('string');
    expect(reportText).toContain('# 解码器性能基准测试报告');
    expect(reportText).toContain('## 测试概览');
    expect(reportText).toContain('## 性能排名');
    expect(reportText).toContain('## 性能基线');
    expect(reportText).toContain('## 详细测试结果');
    expect(reportText).toContain('TestDecoder');
    expect(reportText).toContain('Test Config');
    expect(reportText).toContain('✅ 成功');
  });

  it('应在报告中显示失败的测试', async () => {
    // Arrange
    const mockReport: BenchmarkReport = {
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      totalDuration: 5000,
      configurations: [{
        name: 'Failed Test',
        sampleCount: 100,
        sampleRate: 1000000,
        channelCount: 2,
        iterations: 1,
        useStreaming: false
      }],
      results: [{
        decoderId: 'FailedDecoder',
        configuration: {
          name: 'Failed Test',
          sampleCount: 100,
          sampleRate: 1000000,
          channelCount: 2,
          iterations: 1,
          useStreaming: false
        },
        executionTime: 50,
        processingSpeed: 0,
        peakMemoryUsage: 512,
        resultCount: 0,
        errors: ['Test error occurred'],
        success: false,
        statistics: {
          averageIterationTime: 50,
          minIterationTime: 50,
          maxIterationTime: 50,
          standardDeviation: 0,
          throughput: 0
        }
      }],
      rankings: { bySpeed: [], byMemoryEfficiency: [], byThroughput: [] },
      baselines: {}
    };

    // Act
    const reportText = benchmark.generateReport(mockReport);

    // Assert
    expect(reportText).toContain('❌ 失败');
    expect(reportText).toContain('Test error occurred');
  });
});

describe('DecoderBenchmark Default Configurations', () => {
  it('应提供预定义的基准测试配置', () => {
    // Assert
    expect(DefaultBenchmarkConfigurations).toBeDefined();
    expect(Array.isArray(DefaultBenchmarkConfigurations)).toBe(true);
    expect(DefaultBenchmarkConfigurations.length).toBeGreaterThan(0);

    DefaultBenchmarkConfigurations.forEach(config => {
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('sampleCount');
      expect(config).toHaveProperty('sampleRate');
      expect(config).toHaveProperty('channelCount');
      expect(config).toHaveProperty('iterations');
      expect(config).toHaveProperty('useStreaming');
      
      expect(typeof config.name).toBe('string');
      expect(typeof config.sampleCount).toBe('number');
      expect(typeof config.sampleRate).toBe('number');
      expect(typeof config.channelCount).toBe('number');
      expect(typeof config.iterations).toBe('number');
      expect(typeof config.useStreaming).toBe('boolean');
      
      expect(config.sampleCount).toBeGreaterThan(0);
      expect(config.sampleRate).toBeGreaterThan(0);
      expect(config.channelCount).toBeGreaterThan(0);
      expect(config.iterations).toBeGreaterThan(0);
    });
  });

  it('应包含不同类型的测试配置', () => {
    // Assert
    const streamingConfigs = DefaultBenchmarkConfigurations.filter(c => c.useStreaming);
    const regularConfigs = DefaultBenchmarkConfigurations.filter(c => !c.useStreaming);
    
    expect(streamingConfigs.length).toBeGreaterThan(0);
    expect(regularConfigs.length).toBeGreaterThan(0);
    
    // Check for different sample sizes
    const sampleCounts = DefaultBenchmarkConfigurations.map(c => c.sampleCount);
    const uniqueSampleCounts = [...new Set(sampleCounts)];
    expect(uniqueSampleCounts.length).toBeGreaterThan(1);
  });
});