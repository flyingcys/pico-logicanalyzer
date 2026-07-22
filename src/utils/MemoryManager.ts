/**
 * 内存管理器
 * 基于 @logicanalyzer/Software 的内存优化策略
 * 提供智能内存管理、垃圾回收优化和内存泄漏检测
 */

// 内存数据类型枚举
export enum MemoryDataType {
  SAMPLE_DATA = 'sample_data',
  DECODER_RESULT = 'decoder_result',
  CONFIGURATION = 'configuration',
  ANALYSIS_RESULT = 'analysis_result',
  CACHED_COMPUTATION = 'cached_computation',
  TEMPORARY_BUFFER = 'temporary_buffer'
}

// 支持的内存数据类型
export type MemoryData =
  | Uint8Array          // 采样数据
  | ArrayBuffer         // 原始缓冲区
  | object              // 配置对象
  | Map<string, unknown>// 分析结果
  | Array<unknown>      // 数组数据
  | string              // 字符串数据
  | number              // 数值数据
  | Buffer;             // Node.js Buffer

export interface MemoryBlock<T extends MemoryData = MemoryData> {
  /** 内存块ID */
  id: string;
  /** 数据引用 */
  data: T;
  /** 数据类型 */
  dataType: MemoryDataType;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 访问次数 */
  accessCount: number;
  /** 内存大小（字节） */
  size: number;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 是否可释放 */
  canRelease: boolean;
}

export interface MemoryPool {
  /** 池名称 */
  name: string;
  /** 最大大小（字节） */
  maxSize: number;
  /** 当前使用大小 */
  currentSize: number;
  /** 内存块 */
  blocks: Map<string, MemoryBlock>;
  /** 释放策略 */
  releaseStrategy: 'lru' | 'lfu' | 'fifo' | 'priority';
}

export interface MemoryStats {
  /** 总内存使用 */
  totalUsed: number;
  /** 可用内存 */
  available: number;
  /** 内存池数量 */
  poolCount: number;
  /** 活跃内存块数量 */
  activeBlocks: number;
  /** 垃圾回收次数 */
  gcCount: number;
  /** 内存泄漏检测结果 */
  leakDetection: {
    suspiciousBlocks: number;
    oldestBlock: number; // 最老内存块的年龄（毫秒）
    memoryGrowthRate: number; // 内存增长率（字节/秒）
  };
}

/**
 * 内存管理器类
 */
export class MemoryManager {
  private pools = new Map<string, MemoryPool>();
  private gcTimer: NodeJS.Timeout | null = null;
  private memoryHistory: Array<{ timestamp: number; usage: number }> = [];
  private maxHistoryLength = 100;
  private defaultPoolMaxSize = 100 * 1024 * 1024; // 100MB
  private gcInterval = 30000; // 30秒
  private memoryThreshold = 0.85; // 85%内存使用阈值

  constructor() {
    this.startMemoryMonitoring();
    this.createDefaultPools();
  }

  /**
   * 创建默认内存池
   */
  private createDefaultPools(): void {
    // 通道数据池
    this.createPool('channelData', {
      maxSize: 200 * 1024 * 1024, // 200MB
      releaseStrategy: 'lru'
    });

    // 解码结果池
    this.createPool('decoderResults', {
      maxSize: 50 * 1024 * 1024, // 50MB
      releaseStrategy: 'priority'
    });

    // 缓存池
    this.createPool('cache', {
      maxSize: 30 * 1024 * 1024, // 30MB
      releaseStrategy: 'lfu'
    });

    // 临时数据池
    this.createPool('temporary', {
      maxSize: 20 * 1024 * 1024, // 20MB
      releaseStrategy: 'fifo'
    });

    console.log('🗂️ 默认内存池创建完成：channelData, decoderResults, cache, temporary');
  }

  /**
   * 创建内存池
   */
  public createPool(name: string, options: {
    maxSize?: number;
    releaseStrategy?: 'lru' | 'lfu' | 'fifo' | 'priority';
  } = {}): void {
    const pool: MemoryPool = {
      name,
      maxSize: options.maxSize || this.defaultPoolMaxSize,
      currentSize: 0,
      blocks: new Map(),
      releaseStrategy: options.releaseStrategy || 'lru'
    };

    this.pools.set(name, pool);
    console.log(`📦 内存池 "${name}" 创建完成，最大大小: ${(pool.maxSize / 1024 / 1024).toFixed(1)}MB`);
  }

  /**
   * 分配内存
   */
  public allocate<T extends MemoryData>(
    poolName: string,
    blockId: string,
    data: T,
    options: {
      priority?: 'high' | 'medium' | 'low';
      canRelease?: boolean;
    } = {}
  ): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) {
      console.error(`❌ 内存池 "${poolName}" 不存在`);
      return false;
    }

    // 计算数据大小
    const size = this.calculateDataSize(data);

    // 检查是否需要释放内存
    if (pool.currentSize + size > pool.maxSize) {
      console.log(`⚠️ 内存池 "${poolName}" 即将超出限制，开始释放内存...`);
      this.releaseMemory(poolName, size);
    }

    // 如果仍然超出限制，拒绝分配
    if (pool.currentSize + size > pool.maxSize) {
      console.error(`❌ 内存池 "${poolName}" 空间不足，无法分配 ${(size / 1024).toFixed(1)}KB`);
      return false;
    }

    const now = Date.now();
    const block: MemoryBlock<T> = {
      id: blockId,
      data,
      dataType: this.inferDataType(data),
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      size,
      priority: options.priority || 'medium',
      canRelease: options.canRelease !== false
    };

    pool.blocks.set(blockId, block);
    pool.currentSize += size;

    console.log(`✅ 内存分配成功: ${poolName}/${blockId} (${(size / 1024).toFixed(1)}KB)`);
    return true;
  }

  /**
   * 获取内存块
   */
  public get<T extends MemoryData = MemoryData>(poolName: string, blockId: string): T | null {
    const pool = this.pools.get(poolName);
    if (!pool) return null;

    const block = pool.blocks.get(blockId);
    if (!block) return null;

    // 更新访问信息
    block.lastAccessedAt = Date.now();
    block.accessCount++;

    return block.data as T;
  }

  /**
   * 释放特定内存块
   */
  public release(poolName: string, blockId: string): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) return false;

    const block = pool.blocks.get(blockId);
    if (!block) return false;

    pool.blocks.delete(blockId);
    pool.currentSize -= block.size;

    // 清理数据引用
    if (block.data && typeof block.data === 'object') {
      if (Array.isArray(block.data)) {
        block.data.length = 0;
      } else if (block.data instanceof Uint8Array ||
                 block.data instanceof Int8Array ||
                 block.data instanceof Uint16Array ||
                 block.data instanceof Int16Array ||
                 block.data instanceof Uint32Array ||
                 block.data instanceof Int32Array ||
                 block.data instanceof Float32Array ||
                 block.data instanceof Float64Array ||
                 block.data instanceof ArrayBuffer) {
        // 类型化数组和ArrayBuffer不能使用delete，直接设置为null
        block.data = null;
      } else {
        try {
          Object.keys(block.data).forEach(key => {
            delete block.data[key];
          });
        } catch (error) {
          // 如果删除失败，直接设置为null
          block.data = null;
        }
      }
    }

    console.log(`🗑️ 内存块已释放: ${poolName}/${blockId} (${(block.size / 1024).toFixed(1)}KB)`);
    return true;
  }

  /**
   * 释放内存池中的内存
   */
  private releaseMemory(poolName: string, requiredSize: number): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const blocks = Array.from(pool.blocks.values())
      .filter(block => block.canRelease);

    if (blocks.length === 0) {
      console.log(`⚠️ 内存池 "${poolName}" 中没有可释放的内存块`);
      return;
    }

    // 根据释放策略排序
    this.sortBlocksForRelease(blocks, pool.releaseStrategy);

    let releasedSize = 0;
    let releasedCount = 0;

    for (const block of blocks) {
      if (releasedSize >= requiredSize) break;

      this.release(poolName, block.id);
      releasedSize += block.size;
      releasedCount++;
    }

    console.log(`🧹 内存释放完成: ${poolName} 释放了 ${releasedCount} 个块，${(releasedSize / 1024).toFixed(1)}KB`);
  }

  /**
   * 根据策略排序内存块
   */
  private sortBlocksForRelease(blocks: MemoryBlock[], strategy: string): void {
    switch (strategy) {
      case 'lru': // 最近最少使用
        blocks.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        break;

      case 'lfu': // 最少使用频率
        blocks.sort((a, b) => a.accessCount - b.accessCount);
        break;

      case 'fifo': // 先进先出
        blocks.sort((a, b) => a.createdAt - b.createdAt);
        break;

      case 'priority': // 优先级策略
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        blocks.sort((a, b) => {
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.lastAccessedAt - b.lastAccessedAt; // 相同优先级按LRU
        });
        break;
    }
  }

  /**
   * 清空内存池
   */
  public clearPool(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const blockCount = pool.blocks.size;
    const totalSize = pool.currentSize;

    // 清理所有内存块
    for (const block of pool.blocks.values()) {
      if (block.data && typeof block.data === 'object') {
        if (Array.isArray(block.data)) {
          block.data.length = 0;
        } else if (block.data instanceof Uint8Array ||
                   block.data instanceof Int8Array ||
                   block.data instanceof Uint16Array ||
                   block.data instanceof Int16Array ||
                   block.data instanceof Uint32Array ||
                   block.data instanceof Int32Array ||
                   block.data instanceof Float32Array ||
                   block.data instanceof Float64Array ||
                   block.data instanceof ArrayBuffer) {
          // 类型化数组和ArrayBuffer不能使用delete，直接设置为null
          block.data = null;
        } else {
          try {
            Object.keys(block.data).forEach(key => {
              delete block.data[key];
            });
          } catch (error) {
            // 如果删除失败，直接设置为null
            block.data = null;
          }
        }
      }
    }

    pool.blocks.clear();
    pool.currentSize = 0;

    console.log(`🗑️ 内存池 "${poolName}" 已清空: ${blockCount} 个块，${(totalSize / 1024).toFixed(1)}KB`);
  }

  /**
   * 强制垃圾回收
   */
  public forceGarbageCollection(): void {
    console.log('♻️ 执行强制垃圾回收...');

    const beforeStats = this.getMemoryStats();

    // 清理过期内存块
    this.cleanupExpiredBlocks();

    // 执行系统垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
      console.log('🔄 系统垃圾回收已执行');
    }

    const afterStats = this.getMemoryStats();
    const memoryFreed = beforeStats.totalUsed - afterStats.totalUsed;

    console.log(`✅ 垃圾回收完成，释放内存: ${(memoryFreed / 1024).toFixed(1)}KB`);
  }

  /**
   * 清理过期内存块
   */
  private cleanupExpiredBlocks(): void {
    const now = Date.now();
    const expireTime = 5 * 60 * 1000; // 5分钟过期时间

    let totalCleaned = 0;

    for (const [poolName, pool] of this.pools) {
      const expiredBlocks = Array.from(pool.blocks.values())
        .filter(block =>
          block.canRelease &&
          (now - block.lastAccessedAt) > expireTime &&
          block.priority !== 'high'
        );

      for (const block of expiredBlocks) {
        this.release(poolName, block.id);
        totalCleaned++;
      }
    }

    if (totalCleaned > 0) {
      console.log(`🧹 清理过期内存块: ${totalCleaned} 个`);
    }
  }

  /**
   * 内存泄漏检测
   */
  public detectMemoryLeaks(): Array<{
    poolName: string;
    blockId: string;
    age: number;
    size: number;
    accessCount: number;
  }> {
    const now = Date.now();
    const suspiciousAge = 10 * 60 * 1000; // 10分钟
    const leaks: Array<{
      poolName: string;
      blockId: string;
      age: number;
      size: number;
      accessCount: number;
    }> = [];

    for (const [poolName, pool] of this.pools) {
      for (const [blockId, block] of pool.blocks) {
        const age = now - block.createdAt;

        // 检测可疑的长期存在的内存块
        if (age > suspiciousAge && block.accessCount === 1) {
          leaks.push({
            poolName,
            blockId,
            age,
            size: block.size,
            accessCount: block.accessCount
          });
        }
      }
    }

    if (leaks.length > 0) {
      console.log(`🔍 检测到 ${leaks.length} 个可疑内存泄漏:`);
      leaks.forEach(leak => {
        console.log(`  ${leak.poolName}/${leak.blockId}: ${(leak.age / 1000 / 60).toFixed(1)}分钟, ${(leak.size / 1024).toFixed(1)}KB`);
      });
    }

    return leaks;
  }

  /**
   * 开始内存监控
   */
  private startMemoryMonitoring(): void {
    this.gcTimer = setInterval(() => {
      this.updateMemoryHistory();

      const stats = this.getMemoryStats();
      const memoryUsagePercent = stats.totalUsed / (stats.totalUsed + stats.available);

      if (memoryUsagePercent > this.memoryThreshold) {
        console.log(`⚠️ 内存使用率过高: ${(memoryUsagePercent * 100).toFixed(1)}%`);
        this.forceGarbageCollection();
      }

      // 内存泄漏检测
      if (this.memoryHistory.length > 10) {
        const leaks = this.detectMemoryLeaks();
        if (leaks.length > 5) { // 超过5个可疑泄漏时清理
          console.log('🚨 检测到大量内存泄漏，执行清理...');
          leaks.forEach(leak => {
            this.release(leak.poolName, leak.blockId);
          });
        }
      }
    }, this.gcInterval);

    console.log(`🔍 内存监控已启动，检查间隔: ${this.gcInterval / 1000}秒`);
  }

  /**
   * 更新内存历史
   */
  private updateMemoryHistory(): void {
    const now = Date.now();
    const totalUsed = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.currentSize, 0);

    this.memoryHistory.push({ timestamp: now, usage: totalUsed });

    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }
  }

  /**
   * 根据数据形态推断内存数据类型
   */
  private inferDataType(data: MemoryData): MemoryDataType {
    if (data instanceof Uint8Array) return MemoryDataType.SAMPLE_DATA;
    if (data instanceof ArrayBuffer) return MemoryDataType.TEMPORARY_BUFFER;
    if (data instanceof Map) return MemoryDataType.ANALYSIS_RESULT;
    if (Array.isArray(data)) return MemoryDataType.TEMPORARY_BUFFER;
    if (typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function' && Buffer.isBuffer(data)) {
      return MemoryDataType.TEMPORARY_BUFFER;
    }
    if (typeof data === 'string' || typeof data === 'number') {
      return MemoryDataType.CONFIGURATION;
    }
    return MemoryDataType.CACHED_COMPUTATION;
  }

  /**
   * 计算数据大小
   */
  private calculateDataSize(data: MemoryData, visited = new WeakSet<object>()): number {
    if (data === null || data === undefined) return 0;

    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      return data.byteLength;
    }

    if (typeof data === 'string') {
      return data.length * 2; // UTF-16编码
    }

    if (typeof data === 'number') {
      return 8; // 64位浮点数
    }

    if (typeof data === 'boolean') {
      return 1;
    }

    // 检查循环引用
    if (typeof data === 'object' && visited.has(data)) {
      return 8; // 循环引用的占位大小
    }

    if (Array.isArray(data)) {
      visited.add(data);
      try {
        return data.reduce((sum, item) => sum + this.calculateDataSize(item, visited), 0) + 24; // 数组开销
      } finally {
        visited.delete(data);
      }
    }

    if (typeof data === 'object') {
      visited.add(data);
      try {
        return Object.keys(data).reduce((sum, key) =>
          sum + this.calculateDataSize(key, visited) + this.calculateDataSize(data[key], visited), 0
        ) + 32; // 对象开销
      } finally {
        visited.delete(data);
      }
    }

    return 64; // 其他类型的估计大小
  }

  /**
   * 获取内存统计信息
   */
  public getMemoryStats(): MemoryStats {
    const totalUsed = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.currentSize, 0);

    const activeBlocks = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.blocks.size, 0);

    // 计算内存增长率
    let memoryGrowthRate = 0;
    if (this.memoryHistory.length >= 2) {
      const recent = this.memoryHistory[this.memoryHistory.length - 1];
      const earlier = this.memoryHistory[Math.max(0, this.memoryHistory.length - 10)];
      const timeDiff = (recent.timestamp - earlier.timestamp) / 1000; // 秒
      const usageDiff = recent.usage - earlier.usage;
      memoryGrowthRate = timeDiff > 0 ? usageDiff / timeDiff : 0;
    }

    // 找到最老的内存块
    let oldestBlockAge = 0;
    let suspiciousBlocks = 0;
    const now = Date.now();

    for (const pool of this.pools.values()) {
      for (const block of pool.blocks.values()) {
        const age = now - block.createdAt;
        oldestBlockAge = Math.max(oldestBlockAge, age);

        if (age > 5 * 60 * 1000 && block.accessCount === 1) { // 5分钟且只访问过一次
          suspiciousBlocks++;
        }
      }
    }

    return {
      totalUsed,
      available: this.getTotalPoolCapacity() - totalUsed,
      poolCount: this.pools.size,
      activeBlocks,
      gcCount: 0, // 将来可以添加GC计数器
      leakDetection: {
        suspiciousBlocks,
        oldestBlock: oldestBlockAge,
        memoryGrowthRate
      }
    };
  }

  /**
   * 获取总池容量
   */
  private getTotalPoolCapacity(): number {
    return Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.maxSize, 0);
  }

  /**
   * 获取池信息
   */
  public getPoolInfo(poolName: string): MemoryPool | null {
    return this.pools.get(poolName) || null;
  }

  /**
   * 获取所有池信息
   */
  public getAllPoolsInfo(): MemoryPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * 设置内存阈值
   */
  public setMemoryThreshold(threshold: number): void {
    this.memoryThreshold = Math.max(0.1, Math.min(0.95, threshold));
    console.log(`🎚️ 内存阈值已设置为: ${(this.memoryThreshold * 100).toFixed(1)}%`);
  }

  /**
   * 停止内存监控
   */
  public dispose(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // 清空所有内存池
    for (const poolName of this.pools.keys()) {
      this.clearPool(poolName);
    }

    this.pools.clear();
    this.memoryHistory = [];

    console.log('🛑 内存管理器已停止');
  }
}

// 创建全局内存管理器实例
export const memoryManager = new MemoryManager();
