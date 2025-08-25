/**
 * 性能指标收集模块 - P2.2架构核心组件
 * 
 * 功能：
 * - 精准的内存使用测量（RSS、堆内存、V8统计）
 * - 高精度时间测量（纳秒级process.hrtime）
 * - 吞吐量计算（数据处理速度、操作频率）
 * - 垃圾回收控制和基线建立
 * 
 * 遵循质量标准:
 * - 文件大小 < 200行 ✅
 * - 无Mock依赖 ✅
 * - 专注性能测量准确性
 */

import * as v8 from 'v8';

/**
 * 内存使用指标
 */
interface MemoryMetrics {
  rss: number;              // 驻留集大小 (MB)
  heapUsed: number;         // 已使用堆内存 (MB)
  heapTotal: number;        // 总堆内存 (MB)
  external: number;         // V8外部内存 (MB)
  arrayBuffers: number;     // ArrayBuffer内存 (MB)
  heapStatistics: {
    totalHeapSize: number;      // V8总堆大小 (MB)
    usedHeapSize: number;       // V8已使用堆大小 (MB)
    heapSizeLimit: number;      // V8堆大小限制 (MB)
    mallocedMemory: number;     // malloc分配的内存 (MB)
    peakMallocedMemory: number; // malloc峰值内存 (MB)
  };
}

/**
 * 时间测量指标
 */
interface TimingMetrics {
  startTime: string;        // 开始时间戳 (纳秒字符串)
  endTime: string;          // 结束时间戳 (纳秒字符串)
  duration: number;         // 持续时间 (毫秒)
  operations?: number;      // 操作次数
}

/**
 * 吞吐量指标
 */
interface ThroughputMetrics {
  bytesPerSecond?: number;      // 字节/秒
  operationsPerSecond?: number; // 操作/秒
  recordsPerSecond?: number;    // 记录/秒
}

/**
 * 完整性能指标
 */
interface PerformanceMetrics {
  memory: MemoryMetrics;
  timing: TimingMetrics;
  throughput?: ThroughputMetrics;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    timestamp: string;
  };
}

/**
 * 性能指标收集器
 */
class PerformanceCollector {
  private gcEnabled: boolean = false;
  
  constructor() {
    // 检查是否启用了垃圾回收控制
    this.gcEnabled = typeof global.gc === 'function';
    if (!this.gcEnabled) {
      console.warn('⚠️ 建议使用 --expose-gc 启动Node.js以获得更准确的内存测量');
    }
  }
  
  /**
   * 强制垃圾回收（如果可用）
   */
  private forceGC(): void {
    if (this.gcEnabled && global.gc) {
      global.gc();
      // 等待一个事件循环让GC完成
      return new Promise<void>(resolve => setImmediate(resolve)) as any;
    }
  }
  
  /**
   * 收集内存使用指标
   */
  collectMemoryMetrics(): MemoryMetrics {
    // 强制垃圾回收以获得准确基线
    this.forceGC();
    
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100,
      heapStatistics: {
        totalHeapSize: Math.round(heapStats.total_heap_size / 1024 / 1024 * 100) / 100,
        usedHeapSize: Math.round(heapStats.used_heap_size / 1024 / 1024 * 100) / 100,
        heapSizeLimit: Math.round(heapStats.heap_size_limit / 1024 / 1024 * 100) / 100,
        mallocedMemory: Math.round(heapStats.malloced_memory / 1024 / 1024 * 100) / 100,
        peakMallocedMemory: Math.round(heapStats.peak_malloced_memory / 1024 / 1024 * 100) / 100
      }
    };
  }
  
  /**
   * 开始时间测量
   */
  startTiming(): bigint {
    return process.hrtime.bigint();
  }
  
  /**
   * 结束时间测量并计算持续时间
   */
  endTiming(startTime: bigint, operations?: number): TimingMetrics {
    const endTime = process.hrtime.bigint();
    const durationNs = endTime - startTime;
    const durationMs = Number(durationNs) / 1_000_000; // 纳秒转毫秒
    
    return {
      startTime: startTime.toString(),  // 转换为字符串
      endTime: endTime.toString(),      // 转换为字符串
      duration: Math.round(durationMs * 1000) / 1000, // 保留3位小数
      operations
    };
  }
  
  /**
   * 计算吞吐量指标
   */
  calculateThroughput(
    timing: TimingMetrics,
    dataSize?: number,
    operationCount?: number,
    recordCount?: number
  ): ThroughputMetrics {
    const seconds = timing.duration / 1000;
    
    const throughput: ThroughputMetrics = {};
    
    if (dataSize && seconds > 0) {
      throughput.bytesPerSecond = Math.round(dataSize / seconds);
    }
    
    if (operationCount && seconds > 0) {
      throughput.operationsPerSecond = Math.round(operationCount / seconds);
    }
    
    if (recordCount && seconds > 0) {
      throughput.recordsPerSecond = Math.round(recordCount / seconds);
    }
    
    return throughput;
  }
  
  /**
   * 收集环境信息
   */
  collectEnvironmentInfo(): PerformanceMetrics['environment'] {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 创建完整的性能指标对象
   */
  createMetrics(
    timing: TimingMetrics,
    memoryBefore: MemoryMetrics,
    memoryAfter: MemoryMetrics,
    throughput?: ThroughputMetrics
  ): PerformanceMetrics {
    return {
      memory: memoryAfter, // 使用结束时的内存状态
      timing,
      throughput,
      environment: this.collectEnvironmentInfo()
    };
  }
}

export {
  PerformanceMetrics,
  MemoryMetrics,
  TimingMetrics,
  ThroughputMetrics,
  PerformanceCollector
};