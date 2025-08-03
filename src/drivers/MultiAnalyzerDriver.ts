import { AnalyzerDriverBase } from './AnalyzerDriverBase';
import { LogicAnalyzerDriver } from './LogicAnalyzerDriver';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  CaptureEventArgs,
  CaptureCompletedHandler,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus,
  CaptureMode,
  TriggerType,
  TriggerDelays
} from '../models/AnalyzerTypes';

/**
 * 多设备逻辑分析器同步驱动
 * 基于C# MultiAnalyzerDriver的TypeScript移植
 * 支持2-5个设备的同步采集，提供最多120个通道
 */
export class MultiAnalyzerDriver extends AnalyzerDriverBase {
  // 属性实现 - 基于所有连接设备的最小值
  get deviceVersion(): string | null {
    return this._version;
  }
  get channelCount(): number {
    // 总通道数 = 每个设备的最小通道数 × 设备数量
    const minChannelsPerDevice = Math.min(...this._connectedDevices.map(d => d.channelCount));
    return minChannelsPerDevice * this._connectedDevices.length;
  }
  get maxFrequency(): number {
    // 返回所有设备的最小最大频率（确保所有设备都能支持）
    return Math.min(...this._connectedDevices.map(d => d.maxFrequency));
  }
  get minFrequency(): number {
    // 返回所有设备的最大最小频率（确保所有设备都能支持）
    return Math.max(...this._connectedDevices.map(d => d.minFrequency));
  }
  get blastFrequency(): number {
    // 多设备模式不支持突发采集
    return 0;
  }
  get bufferSize(): number {
    // 返回所有设备的最小缓冲区大小
    return Math.min(...this._connectedDevices.map(d => d.bufferSize));
  }
  get isNetwork(): boolean {
    return false; // 多设备驱动本身不是网络设备
  }
  get isCapturing(): boolean {
    return this._capturing;
  }
  get driverType(): AnalyzerDriverType {
    return AnalyzerDriverType.Multi;
  }

  // 私有变量
  private _capturing: boolean = false;
  private _version: string | null = null;
  private _connectedDevices: LogicAnalyzerDriver[] = [];
  private _deviceCaptures: Array<{
    completed: boolean;
    session: CaptureSession | null;
  }> = [];
  private _sourceSession: CaptureSession | null = null;
  private _currentCaptureHandler?: CaptureCompletedHandler;
  private _locker = {}; // 用于同步控制

  constructor(connectionStrings: string[]) {
    super();

    if (!connectionStrings || connectionStrings.length < 2 || connectionStrings.length > 5) {
      throw new Error('无效的设备数量，必须提供2-5个连接字符串');
    }

    // 第一个连接字符串必须是主设备
    this._connectedDevices = new Array(connectionStrings.length);
    this.initializeDevices(connectionStrings);
  }

  /**
   * 初始化所有设备
   */
  private async initializeDevices(connectionStrings: string[]): Promise<void> {
    try {
      // 连接所有设备
      for (let i = 0; i < connectionStrings.length; i++) {
        this._connectedDevices[i] = new LogicAnalyzerDriver(connectionStrings[i]);
        this._connectedDevices[i].tag = i; // 设置设备标识
      }

      // 为每个设备设置捕获完成事件处理器
      for (const device of this._connectedDevices) {
        device.on('captureCompleted', this.handleDeviceCaptureCompleted.bind(this));
      }

    } catch (error) {
      // 清理已连接的设备
      for (const device of this._connectedDevices) {
        if (device) {
          device.dispose();
        }
      }
      throw new Error(`设备连接失败: ${error}`);
    }
  }

  /**
   * 连接所有设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      // 连接所有设备
      const connectionPromises = this._connectedDevices.map(device => device.connect(params));
      const results = await Promise.all(connectionPromises);

      // 检查所有连接是否成功
      const failedConnections = results.filter(result => !result.success);
      if (failedConnections.length > 0) {
        throw new Error(`设备连接失败: ${failedConnections.map(r => r.error).join(', ')}`);
      }

      // 验证设备版本兼容性
      this.validateDeviceVersions();

      // 设置多设备版本信息
      const masterDevice = this._connectedDevices[0];
      const masterVersion = this.parseVersion(masterDevice.deviceVersion);
      this._version = `MULTI_ANALYZER_${masterVersion.major}_${masterVersion.minor}`;

      return {
        success: true,
        deviceInfo: {
          name: this._version,
          version: this._version,
          type: this.driverType,
          connectionPath: 'Multi-Device',
          isNetwork: false,
          capabilities: this.buildCapabilities()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '多设备连接失败'
      };
    }
  }

  /**
   * 验证设备版本兼容性
   */
  private validateDeviceVersions(): void {
    let masterVersion: { major: number; minor: number } | null = null;

    for (let i = 0; i < this._connectedDevices.length; i++) {
      const device = this._connectedDevices[i];
      const deviceVersion = this.parseVersion(device.deviceVersion);

      if (!deviceVersion.isValid) {
        throw new Error(`设备 ${i} 版本无效: ${device.deviceVersion}`);
      }

      if (masterVersion === null) {
        masterVersion = deviceVersion;
      } else {
        if (masterVersion.major !== deviceVersion.major ||
            masterVersion.minor !== deviceVersion.minor) {
          throw new Error(
            `设备版本不兼容。主设备版本: V${masterVersion.major}_${masterVersion.minor}, ` +
            `设备 ${i} 版本: V${deviceVersion.major}_${deviceVersion.minor}`
          );
        }
      }
    }
  }

  /**
   * 解析版本字符串
   */
  private parseVersion(versionString: string | null): {
    major: number;
    minor: number;
    isValid: boolean;
  } {
    if (!versionString) {
      return { major: 0, minor: 0, isValid: false };
    }

    // 假设版本格式类似 "V1_23" 或 "ANALYZER_V1_23"
    const match = versionString.match(/V(\d+)_(\d+)/);
    if (match) {
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        isValid: true
      };
    }

    return { major: 0, minor: 0, isValid: false };
  }

  /**
   * 断开所有设备连接
   */
  async disconnect(): Promise<void> {
    for (const device of this._connectedDevices) {
      await device.disconnect();
    }
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    // 获取所有设备状态
    const statuses = await Promise.all(
      this._connectedDevices.map(device => device.getStatus())
    );

    return {
      isConnected: statuses.every(status => status.isConnected),
      isCapturing: this._capturing,
      batteryVoltage: 'N/A', // 多设备不报告电池状态
      multiDeviceStatus: statuses
    };
  }

  /**
   * 开始同步采集
   */
  async startCapture(
    session: CaptureSession,
    captureCompletedHandler?: CaptureCompletedHandler
  ): Promise<CaptureError> {
    // 多设备模式不支持边沿触发
    if (session.triggerType === TriggerType.Edge) {
      return CaptureError.BadParams;
    }

    if (this._capturing) {
      return CaptureError.Busy;
    }

    if (!session.captureChannels || session.captureChannels.length === 0) {
      return CaptureError.BadParams;
    }

    try {
      // 验证采集参数
      const validationError = this.validateCaptureParameters(session);
      if (validationError !== CaptureError.None) {
        return validationError;
      }

      // 分配通道到各个设备
      const channelsPerDevice = this.splitChannelsPerDevice(
        session.captureChannels.map(ch => ch.channelNumber)
      );

      if (channelsPerDevice[0].length < 1) {
        return CaptureError.BadParams;
      }

      // 计算触发延迟偏移
      const samplePeriod = 1000000000.0 / session.frequency;
      const delay = session.triggerType === TriggerType.Fast ?
        TriggerDelays.FastTriggerDelay : TriggerDelays.ComplexTriggerDelay;
      const offset = Math.round((delay / samplePeriod) + 0.3);

      // 初始化设备捕获状态
      this._deviceCaptures = new Array(this._connectedDevices.length);
      for (let i = 0; i < this._deviceCaptures.length; i++) {
        this._deviceCaptures[i] = { completed: false, session: null };
      }

      this._currentCaptureHandler = captureCompletedHandler;
      this._sourceSession = session;
      this._capturing = true;

      // 启动从设备采集（除了主设备外的所有设备）
      let channelsCapturing = 1;
      for (let i = 1; i < channelsPerDevice.length; i++) {
        const channels = channelsPerDevice[i];

        if (channels.length === 0) {
          this._deviceCaptures[i].completed = true;
          continue;
        }

        // 创建从设备采集会话
        const slaveSession = this.createSlaveSession(session, channels, offset);

        this._connectedDevices[i].tag = channelsCapturing;
        const error = await this._connectedDevices[i].startCapture(slaveSession);

        if (error !== CaptureError.None) {
          await this.stopCapture();
          return error;
        }

        channelsCapturing++;
      }

      // 启动主设备采集（最后启动，作为同步信号）
      this._connectedDevices[0].tag = 0;
      const masterChannels = channelsPerDevice[0];
      const masterSession = this.createMasterSession(session, masterChannels);

      const masterError = await this._connectedDevices[0].startCapture(masterSession);
      if (masterError !== CaptureError.None) {
        await this.stopCapture();
        return masterError;
      }

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('多设备采集启动失败:', error);
      return CaptureError.UnexpectedError;
    }
  }

  /**
   * 验证采集参数
   */
  private validateCaptureParameters(session: CaptureSession): CaptureError {
    const channelNumbers = session.captureChannels.map(ch => ch.channelNumber);
    const captureLimits = this.getLimits(channelNumbers);

    // 检查基本参数
    if (channelNumbers.some(ch => ch < 0 || ch >= this.channelCount) ||
        (session.triggerBitCount !== undefined && session.triggerBitCount < 1) ||
        (session.triggerBitCount !== undefined && session.triggerBitCount > 16) ||
        (session.triggerChannel !== undefined && (session.triggerChannel < 0 || session.triggerChannel > 15)) ||
        session.preTriggerSamples < captureLimits.minPreSamples ||
        session.postTriggerSamples < captureLimits.minPostSamples ||
        session.preTriggerSamples > captureLimits.maxPreSamples ||
        session.postTriggerSamples > captureLimits.maxPostSamples ||
        (session.preTriggerSamples + session.postTriggerSamples) > captureLimits.maxTotalSamples ||
        session.frequency < this.minFrequency ||
        session.frequency > this.maxFrequency) {
      return CaptureError.BadParams;
    }

    return CaptureError.None;
  }

  /**
   * 将通道分配到各个设备
   */
  private splitChannelsPerDevice(channels: number[]): number[][] {
    const channelsPerDevice: number[][] = [];
    const maxChannelsPerDevice = Math.min(...this._connectedDevices.map(d => d.channelCount));

    for (let deviceIndex = 0; deviceIndex < this._connectedDevices.length; deviceIndex++) {
      const firstChannel = deviceIndex * maxChannelsPerDevice;
      const lastChannel = (deviceIndex + 1) * maxChannelsPerDevice;

      const deviceChannels = channels
        .filter(ch => ch >= firstChannel && ch < lastChannel)
        .map(ch => ch - firstChannel);

      channelsPerDevice.push(deviceChannels);
    }

    return channelsPerDevice;
  }

  /**
   * 创建从设备采集会话
   */
  private createSlaveSession(
    originalSession: CaptureSession,
    channels: number[],
    offset: number
  ): CaptureSession {
    const slaveSession: CaptureSession = {
      ...originalSession,
      captureChannels: channels.map(ch => ({
        channelNumber: ch,
        channelName: `Channel ${ch + 1}`,
        hidden: false
      })),
      triggerChannel: 24, // 使用外部触发
      triggerType: TriggerType.Edge,
      preTriggerSamples: originalSession.preTriggerSamples + offset,
      postTriggerSamples: originalSession.postTriggerSamples - offset,
      loopCount: 0,
      measureBursts: false,
      triggerInverted: false
    };

    return slaveSession;
  }

  /**
   * 创建主设备采集会话
   */
  private createMasterSession(
    originalSession: CaptureSession,
    channels: number[]
  ): CaptureSession {
    const masterSession: CaptureSession = {
      ...originalSession,
      captureChannels: channels.map(ch => ({
        channelNumber: ch,
        channelName: `Channel ${ch + 1}`,
        hidden: false
      }))
    };

    return masterSession;
  }

  /**
   * 停止所有设备采集
   */
  async stopCapture(): Promise<boolean> {
    if (!this._capturing) {
      return true;
    }

    try {
      // 停止所有设备
      const stopPromises = this._connectedDevices.map(device => device.stopCapture());
      await Promise.all(stopPromises);

      this._capturing = false;
      return true;
    } catch (error) {
      console.error('停止多设备采集失败:', error);
      return false;
    }
  }

  /**
   * 进入引导加载程序模式
   */
  async enterBootloader(): Promise<boolean> {
    if (this._capturing) {
      return false;
    }

    try {
      // 所有设备都需要成功进入引导加载程序模式
      const results = await Promise.all(
        this._connectedDevices.map(device => device.enterBootloader())
      );

      return results.every(result => result === true);
    } catch (error) {
      console.error('进入引导加载程序失败:', error);
      return false;
    }
  }

  /**
   * 处理单个设备的采集完成事件
   */
  private handleDeviceCaptureCompleted(args: CaptureEventArgs): void {
    // 同步锁定
    if (!this._capturing || !this._sourceSession) {
      return;
    }

    if (!args.success) {
      this.stopCapture().then(() => {
        this._deviceCaptures = [];

        const eventArgs: CaptureEventArgs = {
          success: false,
          session: this._sourceSession
        };

        if (this._currentCaptureHandler) {
          this._currentCaptureHandler(eventArgs);
        } else {
          this.emitCaptureCompleted(eventArgs);
        }
      });
      return;
    }

    // 获取设备索引
    const deviceIndex = (args.session as any).deviceTag || 0;

    this._deviceCaptures[deviceIndex].session = args.session;
    this._deviceCaptures[deviceIndex].completed = true;

    // 检查所有设备是否都完成采集
    if (this._deviceCaptures.every(capture => capture.completed)) {
      this.combineDeviceResults();
    }
  }

  /**
   * 合并所有设备的采集结果
   */
  private combineDeviceResults(): void {
    if (!this._sourceSession) return;

    const maxChannelsPerDevice = Math.min(...this._connectedDevices.map(d => d.channelCount));

    // 合并所有设备的通道数据
    for (let deviceIndex = 0; deviceIndex < this._deviceCaptures.length; deviceIndex++) {
      const deviceCapture = this._deviceCaptures[deviceIndex];

      if (deviceCapture.session) {
        for (const deviceChannel of deviceCapture.session.captureChannels) {
          // 计算在源会话中的通道索引
          const globalChannelNumber = deviceChannel.channelNumber + deviceIndex * maxChannelsPerDevice;

          // 找到对应的源会话通道
          const sourceChannel = this._sourceSession.captureChannels.find(
            ch => ch.channelNumber === globalChannelNumber
          );

          if (sourceChannel) {
            sourceChannel.samples = deviceChannel.samples;
          }
        }
      }
    }

    this._capturing = false;

    const eventArgs: CaptureEventArgs = {
      success: true,
      session: this._sourceSession
    };

    if (this._currentCaptureHandler) {
      this._currentCaptureHandler(eventArgs);
    } else {
      this.emitCaptureCompleted(eventArgs);
    }
  }

  /**
   * 获取多设备采集模式
   */
  override getCaptureMode(channels: number[]): CaptureMode {
    const splitChannels = this.splitChannelsPerDevice(channels);
    const maxChannelPerDevice = splitChannels
      .map(deviceChannels => Math.max(...deviceChannels, 0))
      .reduce((max, current) => Math.max(max, current), 0);

    if (maxChannelPerDevice < 8) return CaptureMode.Channels_8;
    if (maxChannelPerDevice < 16) return CaptureMode.Channels_16;
    return CaptureMode.Channels_24;
  }

  /**
   * 获取多设备采集限制
   */
  override getLimits(channels: number[]): any {
    const splitChannels = this.splitChannelsPerDevice(channels);
    const deviceLimits = this._connectedDevices.map((device, index) =>
      device.getLimits(splitChannels[index] || [])
    );

    // 返回所有设备的最严格限制
    const minPreSamples = Math.max(...deviceLimits.map(limit => limit.minPreSamples));
    const maxPreSamples = Math.min(...deviceLimits.map(limit => limit.maxPreSamples));
    const minPostSamples = Math.max(...deviceLimits.map(limit => limit.minPostSamples));
    const maxPostSamples = Math.min(...deviceLimits.map(limit => limit.maxPostSamples));

    return {
      minPreSamples,
      maxPreSamples,
      minPostSamples,
      maxPostSamples,
      get maxTotalSamples(): number {
        return maxPreSamples + maxPostSamples;
      }
    };
  }

  /**
   * 网络配置（多设备不支持）
   */
  override async sendNetworkConfig(
    accessPointName: string,
    password: string,
    ipAddress: string,
    port: number
  ): Promise<boolean> {
    return false; // 多设备驱动不支持网络配置
  }

  /**
   * 获取电压状态（多设备不支持）
   */
  override async getVoltageStatus(): Promise<string> {
    return 'UNSUPPORTED'; // 多设备驱动不支持电压监控
  }

  /**
   * 构建硬件能力描述
   */
  private buildCapabilities(): any {
    return {
      channels: {
        digital: this.channelCount,
        maxVoltage: 5.0,
        inputImpedance: 1000000
      },
      sampling: {
        maxRate: this.maxFrequency,
        minRate: this.minFrequency,
        supportedRates: [this.maxFrequency],
        bufferSize: this.bufferSize,
        streamingSupport: false
      },
      triggers: {
        types: [1, 2], // Complex, Fast (不支持Edge和Blast)
        maxChannels: 16,
        patternWidth: 16,
        sequentialSupport: true,
        conditions: ['pattern', 'complex']
      },
      connectivity: {
        interfaces: ['multi-device'],
        protocols: ['custom']
      },
      features: {
        multiDevice: true,
        synchronization: true,
        maxDevices: 5,
        totalChannels: this.channelCount
      }
    };
  }

  /**
   * 资源清理
   */
  override dispose(): void {
    for (const device of this._connectedDevices) {
      device.dispose();
    }
    super.dispose();
  }
}
