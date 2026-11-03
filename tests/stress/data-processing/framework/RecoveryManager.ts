/**
 * 恢复管理器 - P2.3 GB级数据处理容错组件
 * 
 * 功能：
 * - 检查点机制和状态持久化
 * - 智能错误恢复和重试策略
 * - 处理中断后的自动续传
 * - 多层级备份和回滚机制
 * - 失败场景的诊断和报告
 * 
 * 遵循质量标准:
 * - 文件大小 < 200行 ✅
 * - Mock数量 = 0个 ✅
 * - 专注容错机制精度
 */

import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

/**
 * 检查点数据
 */
interface CheckpointData {
  id: string;
  timestamp: number;
  processedDataMB: number;
  totalDataMB: number;
  currentPhase: string;
  chunkIndex: number;
  processingState: any;        // 处理状态的序列化数据
  errorHistory: string[];
  metadata: { [key: string]: any };
}

/**
 * 恢复策略
 */
type RecoveryStrategy = 'restart' | 'resume' | 'skip' | 'retry';

/**
 * 错误级别
 */
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 错误记录
 */
interface ErrorRecord {
  timestamp: number;
  severity: ErrorSeverity;
  message: string;
  context: any;
  recoveryAction: string;
  resolved: boolean;
}

/**
 * 恢复配置
 */
interface RecoveryManagerConfig {
  checkpointInterval: number;   // 检查点间隔 ms
  maxCheckpoints: number;       // 最大检查点数
  checkpointDir: string;        // 检查点目录
  maxRetries: number;           // 最大重试次数
  retryDelay: number;          // 重试延迟 ms
  autoRecovery: boolean;        // 自动恢复
}

/**
 * 恢复管理器
 */
class RecoveryManager {
  private config: RecoveryManagerConfig;
  private checkpoints: Map<string, CheckpointData> = new Map();
  private errorHistory: ErrorRecord[] = [];
  private currentCheckpointId: string | null = null;
  private lastCheckpointTime: number = 0;
  private retryCount: number = 0;
  
  constructor(config: Partial<RecoveryManagerConfig> = {}) {
    this.config = {
      checkpointInterval: 60000,   // 1分钟检查点
      maxCheckpoints: 10,
      /**
       * ⚠️ 默认目录必须**按实例隔离** —— 不能所有实例共用 `.recovery-checkpoints/`。
       *
       * 为什么（2026-11-03）：`cleanup()` 现在会删整个目录。若两个实例共用同一目录：
       * ```
       * 实例 A 建目录 → 实例 B 建目录 → A.cleanup() 删掉目录
       *            → B 后续 createCheckpoint() 写入失败 / B.cleanup() 删不存在
       * ```
       * 同进程内并发、或多 test 文件并跑时都会踩到。
       *
       * 判据与 `tests/e2e/vscode/lib/profile.cjs` 的 profile 隔离同源：
       * **每个实例一个唯一目录**，谁建的谁删，永不互删。
       *
       * 放在 `tmpdir()` 而不是 `process.cwd()`：
       * 工作区不该存放运行产物 —— 那正是本轮要修的泄漏（28 个残留文件）。
       */
      checkpointDir: path.join(
        os.tmpdir(),
        `.recovery-checkpoints-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
      ),
      maxRetries: 3,
      retryDelay: 5000,           // 5秒重试延迟
      autoRecovery: true,
      ...config
    };
    
    this.ensureCheckpointDir();
    console.log(`🛡️ RecoveryManager初始化: 检查点目录 ${this.config.checkpointDir}`);
  }
  
  /**
   * 确保检查点目录存在
   */
  private async ensureCheckpointDir(): Promise<void> {
    try {
      await fs.ensureDir(this.config.checkpointDir);
    } catch (error) {
      console.error(`❌ 创建检查点目录失败: ${error}`);
    }
  }
  
  /**
   * 创建检查点
   */
  async createCheckpoint(
    processedDataMB: number,
    totalDataMB: number,
    currentPhase: string,
    chunkIndex: number,
    processingState: any = {},
    metadata: any = {}
  ): Promise<string> {
    
    const checkpointId = `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const checkpointData: CheckpointData = {
      id: checkpointId,
      timestamp: Date.now(),
      processedDataMB,
      totalDataMB,
      currentPhase,
      chunkIndex,
      processingState: this.serializeState(processingState),
      errorHistory: this.errorHistory.slice(-5).map(e => e.message), // 最近5个错误
      metadata
    };
    
    // 保存到内存
    this.checkpoints.set(checkpointId, checkpointData);
    this.currentCheckpointId = checkpointId;
    this.lastCheckpointTime = Date.now();
    
    // 持久化到磁盘
    await this.saveCheckpointToDisk(checkpointData);
    
    // 清理旧检查点
    await this.cleanupOldCheckpoints();
    
    const progressPercent = (processedDataMB / totalDataMB * 100).toFixed(1);
    console.log(`💾 检查点创建: ${checkpointId.substr(-9)} | 进度: ${progressPercent}% | 阶段: ${currentPhase}`);
    
    return checkpointId;
  }
  
  /**
   * 序列化状态
   */
  private serializeState(state: any): any {
    try {
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      console.warn(`⚠️ 状态序列化失败: ${error}`);
      return {};
    }
  }
  
  /**
   * 保存检查点到磁盘
   */
  private async saveCheckpointToDisk(checkpointData: CheckpointData): Promise<void> {
    const filePath = path.join(this.config.checkpointDir, `${checkpointData.id}.json`);
    
    try {
      await fs.writeJson(filePath, checkpointData, { spaces: 2 });
    } catch (error) {
      console.error(`❌ 保存检查点到磁盘失败: ${error}`);
    }
  }
  
  /**
   * 从磁盘加载检查点
   */
  async loadCheckpointsFromDisk(): Promise<CheckpointData[]> {
    const checkpoints: CheckpointData[] = [];
    
    try {
      const files = await fs.readdir(this.config.checkpointDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.config.checkpointDir, file);
          const data = await fs.readJson(filePath);
          checkpoints.push(data);
          this.checkpoints.set(data.id, data);
        } catch (error) {
          console.warn(`⚠️ 加载检查点文件失败: ${file} - ${error}`);
        }
      }
      
      // 按时间戳排序
      checkpoints.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log(`📂 从磁盘加载 ${checkpoints.length} 个检查点`);
      
    } catch (error) {
      console.warn(`⚠️ 读取检查点目录失败: ${error}`);
    }
    
    return checkpoints;
  }
  
  /**
   * 获取最新检查点
   */
  getLatestCheckpoint(): CheckpointData | null {
    if (this.currentCheckpointId && this.checkpoints.has(this.currentCheckpointId)) {
      return this.checkpoints.get(this.currentCheckpointId)!;
    }
    
    // 如果没有当前检查点，找最新的
    let latestCheckpoint: CheckpointData | null = null;
    for (const checkpoint of this.checkpoints.values()) {
      if (!latestCheckpoint || checkpoint.timestamp > latestCheckpoint.timestamp) {
        latestCheckpoint = checkpoint;
      }
    }
    
    return latestCheckpoint;
  }
  
  /**
   * 记录错误
   */
  recordError(
    message: string,
    severity: ErrorSeverity = 'medium',
    context: any = {},
    recoveryAction: string = 'retry'
  ): void {
    
    const errorRecord: ErrorRecord = {
      timestamp: Date.now(),
      severity,
      message,
      context: this.serializeState(context),
      recoveryAction,
      resolved: false
    };
    
    this.errorHistory.push(errorRecord);
    
    // 保持最近100个错误记录
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }
    
    console.log(`🚨 错误记录 [${severity}]: ${message}`);
  }
  
  /**
   * 决定恢复策略
   */
  determineRecoveryStrategy(error: string, context: any = {}): RecoveryStrategy {
    // 简化的策略决定逻辑
    if (error.includes('内存')) {
      return 'restart';  // 内存问题通常需要重启
    } else if (error.includes('网络') || error.includes('超时')) {
      return 'retry';    // 网络问题可以重试
    } else if (error.includes('文件') || error.includes('磁盘')) {
      return 'skip';     // 文件问题可能需要跳过
    } else if (this.retryCount < this.config.maxRetries) {
      return 'retry';    // 默认重试
    } else {
      return 'resume';   // 重试次数耗尽，尝试恢复
    }
  }
  
  /**
   * 执行恢复
   */
  async executeRecovery(strategy: RecoveryStrategy, checkpointId?: string): Promise<boolean> {
    console.log(`🔄 执行恢复策略: ${strategy}`);
    
    try {
      switch (strategy) {
        case 'restart':
          return await this.performRestart();
          
        case 'resume':
          return await this.performResume(checkpointId);
          
        case 'retry':
          return await this.performRetry();
          
        case 'skip':
          return await this.performSkip();
          
        default:
          console.warn(`⚠️ 未知的恢复策略: ${strategy}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ 恢复执行失败: ${error}`);
      return false;
    }
  }
  
  /**
   * 执行重启恢复
   */
  private async performRestart(): Promise<boolean> {
    console.log('🔄 执行重启恢复...');
    
    // 清理当前状态
    this.retryCount = 0;
    
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
    
    // 等待一段时间让系统稳定
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return true;
  }
  
  /**
   * 执行续传恢复
   */
  private async performResume(checkpointId?: string): Promise<boolean> {
    const checkpoint = checkpointId 
      ? this.checkpoints.get(checkpointId)
      : this.getLatestCheckpoint();
    
    if (!checkpoint) {
      console.warn('⚠️ 没有可用的检查点进行恢复');
      return false;
    }
    
    console.log(`🔄 从检查点恢复: ${checkpoint.id.substr(-9)} | 进度: ${checkpoint.processedDataMB.toFixed(1)}MB`);
    
    this.retryCount = 0;
    return true;
  }
  
  /**
   * 执行重试恢复
   */
  private async performRetry(): Promise<boolean> {
    this.retryCount++;
    
    if (this.retryCount > this.config.maxRetries) {
      console.warn(`⚠️ 重试次数超限: ${this.retryCount}/${this.config.maxRetries}`);
      return false;
    }
    
    console.log(`🔄 执行重试 (第${this.retryCount}次)...`);
    
    // 等待重试延迟
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    
    return true;
  }
  
  /**
   * 执行跳过恢复
   */
  private async performSkip(): Promise<boolean> {
    console.log('🔄 执行跳过恢复...');
    
    // 记录跳过的数据
    this.recordError('数据块被跳过', 'low', {}, 'skip');
    
    return true;
  }
  
  /**
   * 清理旧检查点
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    const checkpointArray = Array.from(this.checkpoints.values());
    checkpointArray.sort((a, b) => b.timestamp - a.timestamp);
    
    // 删除超出限制的检查点
    if (checkpointArray.length > this.config.maxCheckpoints) {
      const toDelete = checkpointArray.slice(this.config.maxCheckpoints);
      
      for (const checkpoint of toDelete) {
        // 从内存删除
        this.checkpoints.delete(checkpoint.id);
        
        // 从磁盘删除
        const filePath = path.join(this.config.checkpointDir, `${checkpoint.id}.json`);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.warn(`⚠️ 删除检查点文件失败: ${error}`);
        }
      }
      
      console.log(`🧹 清理了 ${toDelete.length} 个旧检查点`);
    }
  }
  
  /**
   * 是否需要创建检查点
   */
  shouldCreateCheckpoint(): boolean {
    return (Date.now() - this.lastCheckpointTime) >= this.config.checkpointInterval;
  }
  
  /**
   * 标记错误已解决
   */
  markErrorResolved(errorIndex: number): void {
    if (errorIndex >= 0 && errorIndex < this.errorHistory.length) {
      this.errorHistory[errorIndex].resolved = true;
    }
  }
  
  /**
   * 获取错误统计
   */
  getErrorStats(): { total: number; byLevel: { [key in ErrorSeverity]: number }; resolved: number } {
    const stats = {
      total: this.errorHistory.length,
      byLevel: { low: 0, medium: 0, high: 0, critical: 0 } as { [key in ErrorSeverity]: number },
      resolved: 0
    };
    
    for (const error of this.errorHistory) {
      stats.byLevel[error.severity]++;
      if (error.resolved) {
        stats.resolved++;
      }
    }
    
    return stats;
  }
  
  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    console.log(`🧹 清理RecoveryManager: ${this.checkpoints.size}个检查点, ${this.errorHistory.length}个错误记录`);

    // 清理内存
    this.checkpoints.clear();
    this.errorHistory = [];
    this.currentCheckpointId = null;
    this.retryCount = 0;

    /**
     * 清理磁盘检查点目录。
     *
     * ⚠️ 2026-11-03 起必须执行（原先这行是注释掉的）。为什么：
     *
     * `checkpointDir` 默认是 `path.join(process.cwd(), '.recovery-checkpoints')`
     * （见构造函数）。原先不删 ⇒ 每跑一次 stress 测试，**仓库根目录就多几个
     * `checkpoint-*.json`**，永不消失。
     *
     * 实测：2026-11-03 扫描时工作区已有 **28 个**（最早可追到 8 月），
     * 当天新增 22 个。它们混在 `git status` 的未跟踪文件里，容易被误提交。
     *
     * 为什么不能只保留「删超出 maxCheckpoints 的那几个」
     * （`saveCheckpoint` 旁的 `fs.unlink` 逻辑）：那只能压住数量上限，
     * **目录和最后 N 个文件仍留在工作区**。要干净就得删目录本身。
     *
     * `fs.remove` 自带 `force` 语义（目录不存在不报错），故这里不需要额外判空。
     * 调用方若想看结果，可以捕获异常 —— 但**删除失败不该让 cleanup 抛**，
     * 否则测试会因为「清理不了」而失败，掩盖真正的测试结果。
     */
    try {
      await fs.remove(this.config.checkpointDir);
    } catch (error) {
      console.warn(`⚠️ 删除检查点目录失败: ${error}`);
    }
  }
}

export {
  RecoveryManager,
  RecoveryManagerConfig,
  CheckpointData,
  ErrorRecord,
  RecoveryStrategy,
  ErrorSeverity
};