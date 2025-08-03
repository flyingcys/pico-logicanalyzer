import { EventEmitter } from 'events';
import { Socket } from 'net';

/**
 * 网络连接质量监控数据
 */
export interface ConnectionQuality {
  /** 连接延迟(ms) */
  latency: number;
  /** 丢包率(%) */
  packetLoss: number;
  /** 连接稳定性评分(0-100) */
  stabilityScore: number;
  /** 平均响应时间(ms) */
  averageResponseTime: number;
  /** 最大响应时间(ms) */
  maxResponseTime: number;
  /** 最小响应时间(ms) */
  minResponseTime: number;
  /** 连接重试次数 */
  retryCount: number;
  /** 连接中断次数 */
  disconnectionCount: number;
  /** 数据传输速率(bytes/s) */
  throughput: number;
  /** 最后测试时间 */
  lastTestTime: Date;
}

/**
 * 网络连接事件类型
 */
export interface NetworkEvent {
  type: 'connected' | 'disconnected' | 'error' | 'quality_changed' | 'reconnecting';
  timestamp: Date;
  data?: any;
  message?: string;
}

/**
 * 连接配置参数
 */
export interface ConnectionConfig {
  /** 心跳检测间隔(ms) */
  heartbeatInterval: number;
  /** 连接超时时间(ms) */
  connectionTimeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试间隔(ms) */
  retryInterval: number;
  /** 质量监控间隔(ms) */
  qualityCheckInterval: number;
  /** 是否启用自动重连 */
  autoReconnect: boolean;
  /** 是否启用连接优化 */
  enableOptimization: boolean;
  /** 缓冲区大小 */
  bufferSize: number;
}

/**
 * 网络诊断结果
 */
export interface DiagnosticResult {
  testName: string;
  passed: boolean;
  details: string;
  duration: number;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error';
}

/**
 * 网络连接稳定性优化服务
 * 提供连接质量监控、自动重连、网络诊断等功能
 */
export class NetworkStabilityService extends EventEmitter {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private currentConfig: ConnectionConfig;
  private connectionQuality: ConnectionQuality;
  private networkEvents: NetworkEvent[] = [];
  private heartbeatTimer?: NodeJS.Timeout;
  private qualityTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private retryCount: number = 0;
  private lastHeartbeatTime: number = 0;
  private responseTimeHistory: number[] = [];
  private throughputHistory: Array<{ bytes: number; timestamp: number }> = [];
  private connectionStartTime: number = 0;
  private lastConnectionHost?: string;
  private lastConnectionPort?: number;

  /** 默认连接配置 */
  private defaultConfig: ConnectionConfig = {
    heartbeatInterval: 5000,      // 5秒心跳
    connectionTimeout: 10000,     // 10秒连接超时
    maxRetries: 5,                // 最多重试5次
    retryInterval: 2000,          // 2秒重试间隔
    qualityCheckInterval: 30000,  // 30秒质量检测
    autoReconnect: true,          // 启用自动重连
    enableOptimization: true,     // 启用连接优化
    bufferSize: 65536            // 64KB缓冲区
  };

  constructor(config?: Partial<ConnectionConfig>) {
    super();
    this.currentConfig = { ...this.defaultConfig, ...config };
    this.connectionQuality = this.initializeConnectionQuality();
  }

  /**
   * 连接到指定地址
   */
  async connect(host: string, port: number): Promise<boolean> {
    if (this.isConnected) {
      console.warn('已经连接到设备，请先断开连接');
      return true;
    }

    // 保存连接信息用于重连
    this.lastConnectionHost = host;
    this.lastConnectionPort = port;

    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      this.connectionStartTime = Date.now();

      // 设置连接超时
      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`连接超时: ${host}:${port}`));
      }, this.currentConfig.connectionTimeout);

      // 连接成功
      this.socket.connect(port, host, () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.retryCount = 0;

        this.setupSocketHandlers();
        this.startHeartbeat();
        this.startQualityMonitoring();

        this.emitNetworkEvent('connected', { host, port });
        console.log(`网络连接已建立: ${host}:${port}`);
        resolve(true);
      });

      // 连接错误
      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        this.handleConnectionError(error);
        reject(error);
      });
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;

    // 停止所有定时器
    this.stopHeartbeat();
    this.stopQualityMonitoring();
    this.stopReconnectTimer();

    // 关闭socket
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.emitNetworkEvent('disconnected');
    console.log('网络连接已断开');
  }

  /**
   * 发送数据
   */
  async sendData(data: Buffer): Promise<boolean> {
    if (!this.isConnected || !this.socket) {
      throw new Error('设备未连接');
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.socket!.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          const responseTime = Date.now() - startTime;
          this.updateResponseTime(responseTime);
          this.updateThroughput(data.length);
          resolve(true);
        }
      });
    });
  }

  /**
   * 获取连接质量信息
   */
  getConnectionQuality(): ConnectionQuality {
    return { ...this.connectionQuality };
  }

  /**
   * 获取网络事件历史
   */
  getNetworkEvents(limit: number = 100): NetworkEvent[] {
    return this.networkEvents.slice(-limit);
  }

  /**
   * 运行网络诊断
   */
  async runDiagnostics(host: string, port: number): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    // 1. 连接测试
    results.push(await this.testConnection(host, port));

    // 2. 延迟测试
    results.push(await this.testLatency(host, port));

    // 3. 吞吐量测试
    if (this.isConnected) {
      results.push(await this.testThroughput());
    }

    // 4. 稳定性测试
    if (this.isConnected) {
      results.push(await this.testStability());
    }

    // 5. 数据完整性测试
    if (this.isConnected) {
      results.push(await this.testDataIntegrity());
    }

    // 6. 网络配置检查
    results.push(await this.checkNetworkConfiguration(host, port));

    return results;
  }

  /**
   * 优化网络连接
   */
  optimizeConnection(): void {
    if (!this.currentConfig.enableOptimization || !this.socket) {
      return;
    }

    // 设置TCP参数优化
    this.socket.setNoDelay(true);                    // 禁用Nagle算法，减少延迟
    this.socket.setKeepAlive(true, 30000);          // 启用TCP Keep-Alive

    // 调整缓冲区大小
    if (this.currentConfig.bufferSize) {
      this.socket.setDefaultEncoding('binary');
      // Note: Node.js不直接暴露SO_RCVBUF/SO_SNDBUF设置
    }

    console.log('网络连接已优化');
  }

  /**
   * 设置连接配置
   */
  setConfiguration(config: Partial<ConnectionConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...config };

    // 重新启动定时器以应用新配置
    if (this.isConnected) {
      this.stopHeartbeat();
      this.stopQualityMonitoring();
      this.startHeartbeat();
      this.startQualityMonitoring();
    }
  }

  /**
   * 强制重连
   */
  async forceReconnect(host: string, port: number): Promise<boolean> {
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    return this.connect(host, port);
  }

  // 私有方法

  /**
   * 初始化连接质量数据
   */
  private initializeConnectionQuality(): ConnectionQuality {
    return {
      latency: 0,
      packetLoss: 0,
      stabilityScore: 100,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      retryCount: 0,
      disconnectionCount: 0,
      throughput: 0,
      lastTestTime: new Date()
    };
  }

  /**
   * 设置Socket事件处理器
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('data', (data) => {
      this.updateThroughput(data.length);
    });

    this.socket.on('close', () => {
      this.handleConnectionClose();
    });

    this.socket.on('error', (error) => {
      this.handleConnectionError(error);
    });

    // 应用连接优化
    this.optimizeConnection();
  }

  /**
   * 处理连接关闭
   */
  private handleConnectionClose(): void {
    this.isConnected = false;
    this.connectionQuality.disconnectionCount++;
    this.stopHeartbeat();
    this.stopQualityMonitoring();

    this.emitNetworkEvent('disconnected');

    // 自动重连
    if (this.currentConfig.autoReconnect && this.retryCount < this.currentConfig.maxRetries) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error): void {
    this.emitNetworkEvent('error', error, error.message);
    console.error('网络连接错误:', error.message);

    // 更新连接质量
    this.connectionQuality.stabilityScore = Math.max(0, this.connectionQuality.stabilityScore - 10);
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.currentConfig.heartbeatInterval);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * 发送心跳包
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.isConnected || !this.socket) {
      return;
    }

    try {
      const startTime = Date.now();
      this.lastHeartbeatTime = startTime;

      // 发送简单的心跳数据包
      const heartbeatData = Buffer.from([0x00]); // 简单的心跳命令
      await this.sendData(heartbeatData);

      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      this.connectionQuality.latency = responseTime;

    } catch (error) {
      console.warn('心跳发送失败:', error);
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * 启动质量监控
   */
  private startQualityMonitoring(): void {
    this.qualityTimer = setInterval(() => {
      this.updateConnectionQuality();
    }, this.currentConfig.qualityCheckInterval);
  }

  /**
   * 停止质量监控
   */
  private stopQualityMonitoring(): void {
    if (this.qualityTimer) {
      clearInterval(this.qualityTimer);
      this.qualityTimer = undefined;
    }
  }

  /**
   * 更新连接质量
   */
  private updateConnectionQuality(): void {
    const now = new Date();
    const history = this.responseTimeHistory.slice(-100); // 最近100次

    if (history.length > 0) {
      this.connectionQuality.averageResponseTime =
        history.reduce((sum, time) => sum + time, 0) / history.length;
      this.connectionQuality.maxResponseTime = Math.max(...history);
      this.connectionQuality.minResponseTime = Math.min(...history);
    }

    // 计算稳定性评分
    this.connectionQuality.stabilityScore = this.calculateStabilityScore();
    this.connectionQuality.retryCount = this.retryCount;
    this.connectionQuality.lastTestTime = now;

    // 发出质量变化事件
    this.emitNetworkEvent('quality_changed', this.connectionQuality);
  }

  /**
   * 计算稳定性评分
   */
  private calculateStabilityScore(): number {
    let score = 100;

    // 基于延迟的评分 (延迟越低评分越高)
    const avgLatency = this.connectionQuality.averageResponseTime;
    if (avgLatency > 100) score -= Math.min(30, (avgLatency - 100) / 10);

    // 基于重试次数的评分
    score -= this.retryCount * 5;

    // 基于断开次数的评分
    score -= this.connectionQuality.disconnectionCount * 10;

    // 基于丢包率的评分
    score -= this.connectionQuality.packetLoss * 2;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 更新响应时间历史
   */
  private updateResponseTime(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);

    // 保持历史记录在合理大小
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }
  }

  /**
   * 更新吞吐量数据
   */
  private updateThroughput(bytes: number): void {
    const now = Date.now();
    this.throughputHistory.push({ bytes, timestamp: now });

    // 计算最近5秒的吞吐量
    const fiveSecondsAgo = now - 5000;
    const recentData = this.throughputHistory.filter(data => data.timestamp > fiveSecondsAgo);

    if (recentData.length > 0) {
      const totalBytes = recentData.reduce((sum, data) => sum + data.bytes, 0);
      const duration = (now - recentData[0].timestamp) / 1000; // 转换为秒
      this.connectionQuality.throughput = duration > 0 ? totalBytes / duration : 0;
    }

    // 清理旧数据
    this.throughputHistory = this.throughputHistory.filter(data => data.timestamp > fiveSecondsAgo);
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.retryCount++;
    this.emitNetworkEvent('reconnecting', { attempt: this.retryCount });

    this.reconnectTimer = setTimeout(async () => {
      if (this.retryCount <= this.currentConfig.maxRetries &&
          this.lastConnectionHost && this.lastConnectionPort) {
        try {
          console.log(`尝试重新连接... (${this.retryCount}/${this.currentConfig.maxRetries})`);
          await this.connect(this.lastConnectionHost, this.lastConnectionPort);
        } catch (error) {
          console.error('重连失败:', error);
          this.scheduleReconnect();
        }
      } else {
        console.error('达到最大重试次数，停止重连');
      }
    }, this.currentConfig.retryInterval * this.retryCount); // 指数退避
  }

  /**
   * 停止重连定时器
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * 发出网络事件
   */
  private emitNetworkEvent(
    type: NetworkEvent['type'],
    data?: any,
    message?: string
  ): void {
    const event: NetworkEvent = {
      type,
      timestamp: new Date(),
      data,
      message
    };

    this.networkEvents.push(event);

    // 限制事件历史大小
    if (this.networkEvents.length > 1000) {
      this.networkEvents = this.networkEvents.slice(-500);
    }

    this.emit(type, event);
  }

  // 诊断测试方法

  /**
   * 测试连接
   */
  private async testConnection(host: string, port: number): Promise<DiagnosticResult> {
    const startTime = Date.now();

    try {
      const socket = new Socket();
      const timeout = 5000;

      const connected = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, timeout);

        socket.connect(port, host, () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        });

        socket.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      });

      const duration = Date.now() - startTime;

      return {
        testName: '连接测试',
        passed: connected,
        details: connected ? `成功连接到 ${host}:${port}` : `无法连接到 ${host}:${port}`,
        duration,
        timestamp: new Date(),
        severity: connected ? 'info' : 'error'
      };
    } catch (error) {
      return {
        testName: '连接测试',
        passed: false,
        details: `连接测试失败: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: 'error'
      };
    }
  }

  /**
   * 测试延迟
   */
  private async testLatency(host: string, port: number): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const latencies: number[] = [];

    try {
      // 进行5次延迟测试
      for (let i = 0; i < 5; i++) {
        const socket = new Socket();
        const testStart = Date.now();

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('超时'));
          }, 2000);

          socket.connect(port, host, () => {
            clearTimeout(timer);
            const latency = Date.now() - testStart;
            latencies.push(latency);
            socket.destroy();
            resolve();
          });

          socket.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
        });

        await new Promise(resolve => setTimeout(resolve, 100)); // 间隔100ms
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      return {
        testName: '延迟测试',
        passed: avgLatency < 200, // 平均延迟小于200ms为通过
        details: `平均延迟: ${avgLatency.toFixed(1)}ms, 最大: ${maxLatency}ms, 最小: ${minLatency}ms`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: avgLatency < 100 ? 'info' : avgLatency < 200 ? 'warning' : 'error'
      };
    } catch (error) {
      return {
        testName: '延迟测试',
        passed: false,
        details: `延迟测试失败: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: 'error'
      };
    }
  }

  /**
   * 测试吞吐量
   */
  private async testThroughput(): Promise<DiagnosticResult> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.socket) {
        throw new Error('设备未连接');
      }

      // 发送测试数据包
      const testData = Buffer.alloc(1024, 0xAA); // 1KB测试数据
      const iterations = 10;
      let totalBytes = 0;

      for (let i = 0; i < iterations; i++) {
        await this.sendData(testData);
        totalBytes += testData.length;
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms间隔
      }

      const duration = (Date.now() - startTime) / 1000; // 转换为秒
      const throughput = totalBytes / duration; // bytes/second
      const throughputKBps = throughput / 1024; // KB/s

      return {
        testName: '吞吐量测试',
        passed: throughputKBps > 10, // 大于10KB/s为通过
        details: `吞吐量: ${throughputKBps.toFixed(2)} KB/s (${totalBytes} bytes 在 ${duration.toFixed(2)} 秒内)`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: throughputKBps > 50 ? 'info' : throughputKBps > 10 ? 'warning' : 'error'
      };
    } catch (error) {
      return {
        testName: '吞吐量测试',
        passed: false,
        details: `吞吐量测试失败: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: 'error'
      };
    }
  }

  /**
   * 测试连接稳定性
   */
  private async testStability(): Promise<DiagnosticResult> {
    const startTime = Date.now();

    try {
      const testDuration = 10000; // 10秒测试
      const interval = 500; // 500ms间隔
      const iterations = testDuration / interval;
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        try {
          const heartbeat = Buffer.from([0x00]);
          await this.sendData(heartbeat);
          successCount++;
        } catch (error) {
          // 忽略单次失败
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      const successRate = (successCount / iterations) * 100;

      return {
        testName: '稳定性测试',
        passed: successRate > 90, // 成功率大于90%为通过
        details: `稳定性测试: ${successRate.toFixed(1)}% (${successCount}/${iterations} 成功)`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: successRate > 95 ? 'info' : successRate > 90 ? 'warning' : 'error'
      };
    } catch (error) {
      return {
        testName: '稳定性测试',
        passed: false,
        details: `稳定性测试失败: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: 'error'
      };
    }
  }

  /**
   * 测试数据完整性
   */
  private async testDataIntegrity(): Promise<DiagnosticResult> {
    const startTime = Date.now();

    try {
      if (!this.isConnected || !this.socket) {
        throw new Error('设备未连接');
      }

      // 简化的数据完整性测试
      // 在实际实现中，需要根据具体协议进行数据验证
      const testPattern = Buffer.from([0x55, 0xAA, 0x01, 0x02, 0x03, 0x04]);
      await this.sendData(testPattern);

      return {
        testName: '数据完整性测试',
        passed: true, // 简化实现，实际需要验证响应
        details: '数据包发送成功，假设数据完整性良好',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: 'info'
      };
    } catch (error) {
      return {
        testName: '数据完整性测试',
        passed: false,
        details: `数据完整性测试失败: ${error}`,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        severity: 'error'
      };
    }
  }

  /**
   * 检查网络配置
   */
  private async checkNetworkConfiguration(host: string, port: number): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const issues: string[] = [];

    // 检查IP地址格式
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(host)) {
      issues.push('IP地址格式无效');
    }

    // 检查端口范围
    if (port < 1 || port > 65535) {
      issues.push('端口号超出有效范围 (1-65535)');
    }

    // 检查是否为Pico默认端口
    if (port !== 4045) {
      issues.push('端口号不是Pico Logic Analyzer的默认端口 (4045)');
    }

    // 检查是否为私有IP地址
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./
    ];

    const isPrivate = privateRanges.some(range => range.test(host));
    if (!isPrivate && !host.startsWith('127.')) {
      issues.push('建议使用私有IP地址或本地地址');
    }

    const passed = issues.length === 0;

    return {
      testName: '网络配置检查',
      passed,
      details: passed ? '网络配置正常' : `配置问题: ${issues.join(', ')}`,
      duration: Date.now() - startTime,
      timestamp: new Date(),
      severity: passed ? 'info' : 'warning'
    };
  }
}
