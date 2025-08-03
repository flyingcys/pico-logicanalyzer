/**
 * 采集进度监控和状态报告系统
 * 提供实时的采集进度跟踪、性能监控和状态报告功能
 * 支持多设备同步采集的进度统一管理
 */

import { EventEmitter } from 'events';
import { CaptureSession, AnalyzerChannel } from './CaptureModels';
import { DeviceInfo, CaptureError } from './AnalyzerTypes';

/**
 * 采集阶段
 */
export enum CapturePhase {
  Idle = 'idle',
  Initializing = 'initializing',
  Configuring = 'configuring',
  WaitingForTrigger = 'waiting_for_trigger',
  Capturing = 'capturing',
  ProcessingData = 'processing_data',
  Completed = 'completed',
  Error = 'error',
  Cancelled = 'cancelled'
}

/**
 * 设备状态
 */
export enum DeviceStatus {
  Disconnected = 'disconnected',
  Connected = 'connected',
  Busy = 'busy',
  Capturing = 'capturing',
  Error = 'error',
  Overheating = 'overheating',
  LowBattery = 'low_battery'
}

/**
 * 采集进度信息
 */
export interface CaptureProgress {
  // 基本信息
  sessionId: string;
  deviceId: string;
  phase: CapturePhase;

  // 进度数据
  currentSample: number;
  totalSamples: number;
  progressPercentage: number;

  // 时间信息
  startTime: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  estimatedCompletionTime: number;

  // 性能指标
  samplesPerSecond: number;
  dataRate: number; // 字节/秒
  bufferUtilization: number; // 缓冲区使用率 0-1

  // 通道信息
  activeChannels: number;
  completedChannels: number;

  // 质量指标
  lostSamples: number;
  errorCount: number;
  signalQuality: number; // 0-100
}

/**
 * 设备状态信息
 */
export interface DeviceStatusInfo {
  deviceId: string;
  deviceName: string;
  status: DeviceStatus;

  // 硬件状态
  temperature?: number; // 摄氏度
  batteryLevel?: number; // 0-100
  voltage?: number; // 伏特

  // 连接信息
  connectionType: 'serial' | 'network' | 'usb';
  connectionQuality: number; // 0-100
  lastHeartbeat: number; // 时间戳

  // 采集统计
  totalCaptures: number;
  successfulCaptures: number;
  failedCaptures: number;

  // 错误信息
  lastError?: string;
  errorCount: number;
}

/**
 * 系统状态报告
 */
export interface SystemStatusReport {
  timestamp: number;

  // 整体状态
  overallStatus: 'normal' | 'warning' | 'error';
  activeCaptures: number;
  connectedDevices: number;

  // 性能指标
  cpuUsage: number; // 0-100
  memoryUsage: number; // 字节
  diskUsage: number; // 字节
  networkLatency: number; // 毫秒

  // 设备状态
  devices: DeviceStatusInfo[];

  // 警告和错误
  warnings: string[];
  errors: string[];

  // 统计信息
  statistics: {
    totalSamplesProcessed: number;
    totalDataProcessed: number; // 字节
    averageProcessingTime: number; // 毫秒
    uptimeSeconds: number;
  };
}

/**
 * 进度监控配置
 */
export interface ProgressMonitorConfig {
  updateInterval: number; // 更新间隔 (毫秒)
  enableRealtime: boolean; // 启用实时更新
  maxHistoryEntries: number; // 最大历史记录数
  warningThresholds: {
    memoryUsage: number; // 内存使用警告阈值 (字节)
    cpuUsage: number; // CPU使用警告阈值 (%)
    errorRate: number; // 错误率警告阈值 (%)
    temperatureC: number; // 温度警告阈值 (摄氏度)
  };
}

/**
 * 采集进度监控器
 */
export class CaptureProgressMonitor extends EventEmitter {
  private config: ProgressMonitorConfig;
  private activeCaptures = new Map<string, CaptureProgress>();
  private deviceStatuses = new Map<string, DeviceStatusInfo>();
  private progressHistory = new Map<string, CaptureProgress[]>();
  private systemStartTime: number;
  private updateTimer?: NodeJS.Timeout;

  // 统计数据
  private totalSamplesProcessed = 0;
  private totalDataProcessed = 0;
  private totalProcessingTime = 0;
  private processedCaptureCount = 0;

  constructor(config: Partial<ProgressMonitorConfig> = {}) {
    super();

    this.config = {
      updateInterval: 100, // 100ms
      enableRealtime: true,
      maxHistoryEntries: 1000,
      warningThresholds: {
        memoryUsage: 1024 * 1024 * 1024, // 1GB
        cpuUsage: 80, // 80%
        errorRate: 5, // 5%
        temperatureC: 70 // 70°C
      },
      ...config
    };

    this.systemStartTime = Date.now();

    if (this.config.enableRealtime) {
      this.startRealtimeUpdates();
    }
  }

  /**
   * 开始监控采集会话
   */
  public startMonitoring(
    sessionId: string,
    deviceId: string,
    session: CaptureSession
  ): void {

    const progress: CaptureProgress = {
      sessionId,
      deviceId,
      phase: CapturePhase.Initializing,
      currentSample: 0,
      totalSamples: session.totalSamples,
      progressPercentage: 0,
      startTime: Date.now(),
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      estimatedCompletionTime: 0,
      samplesPerSecond: 0,
      dataRate: 0,
      bufferUtilization: 0,
      activeChannels: session.captureChannels.length,
      completedChannels: 0,
      lostSamples: 0,
      errorCount: 0,
      signalQuality: 100
    };

    this.activeCaptures.set(sessionId, progress);
    this.progressHistory.set(sessionId, []);

    this.emit('captureStarted', progress);
  }

  /**
   * 更新采集进度
   */
  public updateProgress(
    sessionId: string,
    updates: Partial<CaptureProgress>
  ): void {

    const progress = this.activeCaptures.get(sessionId);
    if (!progress) {
      return;
    }

    // 更新时间信息
    const currentTime = Date.now();
    const elapsedTime = currentTime - progress.startTime;

    // 应用更新
    Object.assign(progress, updates, { elapsedTime });

    // 重新计算进度百分比（在应用更新后）
    progress.progressPercentage = progress.totalSamples > 0 ?
      Math.min(100, Math.round((progress.currentSample / progress.totalSamples) * 10000) / 100) : 0;

    // 计算性能指标
    if (elapsedTime > 0) {
      progress.samplesPerSecond = (progress.currentSample / elapsedTime) * 1000;
      progress.dataRate = progress.samplesPerSecond * progress.activeChannels;

      // 估算剩余时间
      if (progress.samplesPerSecond > 0) {
        const remainingSamples = progress.totalSamples - progress.currentSample;
        progress.estimatedTimeRemaining = (remainingSamples / progress.samplesPerSecond) * 1000;
        progress.estimatedCompletionTime = currentTime + progress.estimatedTimeRemaining;
      }
    }

    // 更新历史记录
    this.addToHistory(sessionId, { ...progress });

    this.emit('progressUpdated', progress);
  }

  /**
   * 更新采集阶段
   */
  public updatePhase(sessionId: string, phase: CapturePhase): void {
    this.updateProgress(sessionId, { phase });
  }

  /**
   * 完成采集监控
   */
  public completeCapture(
    sessionId: string,
    success: boolean,
    error?: string
  ): void {

    const progress = this.activeCaptures.get(sessionId);
    if (!progress) {
      return;
    }

    // 更新最终状态
    progress.phase = success ? CapturePhase.Completed : CapturePhase.Error;
    progress.progressPercentage = success ? 100 : progress.progressPercentage;
    progress.elapsedTime = Date.now() - progress.startTime;

    if (!success && error) {
      progress.errorCount++;
    }

    // 更新统计数据
    this.totalSamplesProcessed += progress.currentSample;
    this.totalDataProcessed += progress.currentSample * progress.activeChannels;
    this.totalProcessingTime += progress.elapsedTime;
    this.processedCaptureCount++;

    // 最后一次历史记录更新
    this.addToHistory(sessionId, { ...progress });

    // 移除活跃采集
    this.activeCaptures.delete(sessionId);

    this.emit('captureCompleted', {
      progress,
      success,
      error
    });
  }

  /**
   * 更新设备状态
   */
  public updateDeviceStatus(
    deviceId: string,
    deviceInfo: DeviceInfo,
    status: Partial<DeviceStatusInfo>
  ): void {

    const currentStatus = this.deviceStatuses.get(deviceId) || {
      deviceId,
      deviceName: deviceInfo.name,
      status: DeviceStatus.Disconnected,
      connectionType: deviceInfo.type === 'Network' ? 'network' : 'serial',
      connectionQuality: 0,
      lastHeartbeat: 0,
      totalCaptures: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      errorCount: 0
    };

    // 更新状态
    Object.assign(currentStatus, status, {
      lastHeartbeat: Date.now()
    });

    this.deviceStatuses.set(deviceId, currentStatus);

    this.emit('deviceStatusUpdated', currentStatus);
  }

  /**
   * 生成系统状态报告
   */
  public generateStatusReport(): SystemStatusReport {
    const currentTime = Date.now();
    const connectedDevices = Array.from(this.deviceStatuses.values())
      .filter(device => device.status !== DeviceStatus.Disconnected);

    const warnings: string[] = [];
    const errors: string[] = [];

    // 检查设备状态警告
    for (const device of connectedDevices) {
      if (device.status === DeviceStatus.Error) {
        errors.push(`Device ${device.deviceName} is in error state: ${device.lastError || 'Unknown error'}`);
      }

      if (device.temperature && device.temperature > this.config.warningThresholds.temperatureC) {
        warnings.push(`Device ${device.deviceName} temperature is high: ${device.temperature}°C`);
      }

      if (device.batteryLevel && device.batteryLevel < 20) {
        warnings.push(`Device ${device.deviceName} battery is low: ${device.batteryLevel}%`);
      }
    }

    // 系统性能指标
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 检查内存使用警告（只在实际使用时检查）
    if (memoryUsage.heapUsed > this.config.warningThresholds.memoryUsage) {
      warnings.push(`High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }

    // 确定整体状态
    let overallStatus: 'normal' | 'warning' | 'error' = 'normal';
    if (errors.length > 0) {
      overallStatus = 'error';
    } else if (warnings.length > 0) {
      overallStatus = 'warning';
    }

    return {
      timestamp: currentTime,
      overallStatus,
      activeCaptures: this.activeCaptures.size,
      connectedDevices: connectedDevices.length,
      cpuUsage: this.calculateCPUUsage(cpuUsage),
      memoryUsage: memoryUsage.heapUsed,
      diskUsage: 0, // 需要实现磁盘使用监控
      networkLatency: this.calculateAverageNetworkLatency(),
      devices: Array.from(this.deviceStatuses.values()),
      warnings,
      errors,
      statistics: {
        totalSamplesProcessed: this.totalSamplesProcessed,
        totalDataProcessed: this.totalDataProcessed,
        averageProcessingTime: this.processedCaptureCount > 0 ?
          this.totalProcessingTime / this.processedCaptureCount : 0,
        uptimeSeconds: Math.floor((currentTime - this.systemStartTime) / 1000)
      }
    };
  }

  /**
   * 获取活跃采集列表
   */
  public getActiveCaptures(): CaptureProgress[] {
    return Array.from(this.activeCaptures.values());
  }

  /**
   * 获取设备状态列表
   */
  public getDeviceStatuses(): DeviceStatusInfo[] {
    return Array.from(this.deviceStatuses.values());
  }

  /**
   * 获取采集历史
   */
  public getCaptureHistory(sessionId: string): CaptureProgress[] {
    return this.progressHistory.get(sessionId) || [];
  }

  /**
   * 启动实时更新
   */
  private startRealtimeUpdates(): void {
    this.updateTimer = setInterval(() => {
      // 更新活跃采集的时间信息
      for (const [sessionId, progress] of this.activeCaptures) {
        if (progress.phase === CapturePhase.Capturing ||
            progress.phase === CapturePhase.ProcessingData) {

          this.updateProgress(sessionId, {});
        }
      }

      // 发出系统状态更新
      if (this.listenerCount('systemStatusUpdated') > 0) {
        this.emit('systemStatusUpdated', this.generateStatusReport());
      }

    }, this.config.updateInterval);
  }

  /**
   * 停止实时更新
   */
  private stopRealtimeUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(sessionId: string, progress: CaptureProgress): void {
    const history = this.progressHistory.get(sessionId);
    if (history) {
      history.push(progress);

      // 限制历史记录数量
      if (history.length > this.config.maxHistoryEntries) {
        history.splice(0, history.length - this.config.maxHistoryEntries);
      }
    }
  }

  /**
   * 计算CPU使用率
   */
  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // 简化的CPU使用率计算
    const totalTime = cpuUsage.user + cpuUsage.system;
    return Math.min(100, totalTime / 10000); // 粗略估算
  }

  /**
   * 计算平均网络延迟
   */
  private calculateAverageNetworkLatency(): number {
    const networkDevices = Array.from(this.deviceStatuses.values())
      .filter(device => device.connectionType === 'network');

    if (networkDevices.length === 0) {
      return 0;
    }

    // 基于连接质量估算延迟
    const averageQuality = networkDevices.reduce((sum, device) =>
      sum + device.connectionQuality, 0) / networkDevices.length;

    return Math.max(1, 100 - averageQuality); // 简化的延迟估算
  }

  /**
   * 取消采集监控
   */
  public cancelCapture(sessionId: string): void {
    const progress = this.activeCaptures.get(sessionId);
    if (progress) {
      // 设置取消状态，然后调用特殊的完成逻辑
      progress.phase = CapturePhase.Cancelled;
      progress.elapsedTime = Date.now() - progress.startTime;

      // 更新统计数据
      this.totalSamplesProcessed += progress.currentSample;
      this.totalDataProcessed += progress.currentSample * progress.activeChannels;
      this.totalProcessingTime += progress.elapsedTime;
      this.processedCaptureCount++;

      // 最后一次历史记录更新
      this.addToHistory(sessionId, { ...progress });

      // 移除活跃采集
      this.activeCaptures.delete(sessionId);

      this.emit('captureCompleted', {
        progress,
        success: false,
        error: 'Cancelled by user'
      });
    }
  }

  /**
   * 清除历史记录
   */
  public clearHistory(sessionId?: string): void {
    if (sessionId) {
      this.progressHistory.delete(sessionId);
    } else {
      this.progressHistory.clear();
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ProgressMonitorConfig>): void {
    const wasRealtime = this.config.enableRealtime;
    this.config = { ...this.config, ...config };

    // 处理实时更新状态变化
    if (this.config.enableRealtime && !wasRealtime) {
      this.startRealtimeUpdates();
    } else if (!this.config.enableRealtime && wasRealtime) {
      this.stopRealtimeUpdates();
    }
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStatistics(): {
    totalCaptures: number;
    averageCaptureTime: number;
    samplesPerSecond: number;
    dataRateMBps: number;
    successRate: number;
  } {

    const totalCaptures = this.processedCaptureCount;
    const averageCaptureTime = totalCaptures > 0 ? this.totalProcessingTime / totalCaptures : 0;
    const samplesPerSecond = this.totalProcessingTime > 0 ?
      (this.totalSamplesProcessed / this.totalProcessingTime) * 1000 : 0;
    const dataRateMBps = (this.totalDataProcessed / (1024 * 1024)) /
      Math.max(1, (this.totalProcessingTime / 1000));

    // 计算成功率
    let totalAttempts = 0;
    let successfulAttempts = 0;

    for (const device of this.deviceStatuses.values()) {
      totalAttempts += device.totalCaptures;
      successfulAttempts += device.successfulCaptures;
    }

    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 100;

    return {
      totalCaptures,
      averageCaptureTime,
      samplesPerSecond,
      dataRateMBps,
      successRate
    };
  }

  /**
   * 销毁监控器
   */
  public destroy(): void {
    this.stopRealtimeUpdates();
    this.activeCaptures.clear();
    this.deviceStatuses.clear();
    this.progressHistory.clear();
    this.removeAllListeners();
  }
}

/**
 * 进度监控器工厂
 */
export class ProgressMonitorFactory {
  /**
   * 创建默认监控器
   */
  public static createDefault(): CaptureProgressMonitor {
    return new CaptureProgressMonitor();
  }

  /**
   * 创建高性能监控器
   */
  public static createHighPerformance(): CaptureProgressMonitor {
    return new CaptureProgressMonitor({
      updateInterval: 50, // 50ms 更新
      enableRealtime: true,
      maxHistoryEntries: 500
    });
  }

  /**
   * 创建低资源监控器
   */
  public static createLowResource(): CaptureProgressMonitor {
    return new CaptureProgressMonitor({
      updateInterval: 500, // 500ms 更新
      enableRealtime: false,
      maxHistoryEntries: 100
    });
  }

  /**
   * 创建调试监控器
   */
  public static createDebug(): CaptureProgressMonitor {
    return new CaptureProgressMonitor({
      updateInterval: 10, // 10ms 更新，用于调试
      enableRealtime: true,
      maxHistoryEntries: 2000,
      warningThresholds: {
        memoryUsage: 512 * 1024 * 1024, // 512MB
        cpuUsage: 50, // 50%
        errorRate: 1, // 1%
        temperatureC: 50 // 50°C
      }
    });
  }
}
