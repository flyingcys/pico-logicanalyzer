import { Socket } from 'net';
import { AnalyzerDriverBase } from './AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  CaptureEventArgs,
  CaptureCompletedHandler,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus,
  CaptureMode
} from '../models/AnalyzerTypes';

/**
 * Saleae Logic兼容驱动实现
 * 基于Saleae Logic 2 Socket API
 */
export class SaleaeLogicDriver extends AnalyzerDriverBase {
  // Saleae Logic 2 默认端口
  private static readonly DEFAULT_PORT = 10429;
  private static readonly DEFAULT_HOST = 'localhost';

  // 属性实现
  get deviceVersion(): string | null {
    return this._version;
  }
  get channelCount(): number {
    return this._channelCount;
  }
  get maxFrequency(): number {
    return this._maxFrequency;
  }
  get blastFrequency(): number {
    return this._blastFrequency;
  }
  get bufferSize(): number {
    return this._bufferSize;
  }
  get isNetwork(): boolean {
    return true; // Saleae Logic总是通过网络API通信
  }
  get isCapturing(): boolean {
    return this._capturing;
  }
  get driverType(): AnalyzerDriverType {
    return AnalyzerDriverType.Network;
  }

  // 私有变量
  private _capturing: boolean = false;
  private _version: string | null = null;
  private _channelCount: number = 8; // 默认8通道，实际会从设备查询
  private _maxFrequency: number = 100000000; // 100MHz，默认值
  private _blastFrequency: number = 500000000; // 500MHz，默认值
  private _bufferSize: number = 10000000; // 默认10M样本
  private _host: string;
  private _port: number;

  // 通信对象
  private _socket: Socket | undefined = undefined;
  private _isConnected: boolean = false;
  private _deviceId: string | null = null;
  private _currentCaptureId: string | null = null;

  constructor(connectionString?: string) {
    super();

    // 解析连接字符串 "host:port" 或使用默认值
    if (connectionString && connectionString.includes(':')) {
      const parts = connectionString.split(':');
      this._host = parts[0];
      this._port = parseInt(parts[1], 10);
    } else {
      this._host = SaleaeLogicDriver.DEFAULT_HOST;
      this._port = SaleaeLogicDriver.DEFAULT_PORT;
    }
  }

  /**
   * 连接设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      await this.initializeSocket();
      await this.queryDeviceInfo();

      this._isConnected = true;

      return {
        success: true,
        deviceInfo: {
          name: this._version || 'Saleae Logic Analyzer',
          version: this._version ?? undefined,
          type: this.driverType,
          connectionPath: `${this._host}:${this._port}`,
          isNetwork: true,
          capabilities: this.buildCapabilities()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败'
      };
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this._isConnected = false;

    if (this._socket) {
      this._socket.destroy();
      this._socket = undefined;
    }

    this._deviceId = null;
    this._currentCaptureId = null;
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: this._isConnected,
      isCapturing: this._capturing,
      batteryVoltage: 'N/A' // Saleae Logic通常是USB供电
    };
  }

  /**
   * 开始采集
   */
  async startCapture(
    session: CaptureSession,
    captureCompletedHandler?: CaptureCompletedHandler
  ): Promise<CaptureError> {
    if (this._capturing) {
      return CaptureError.Busy;
    }

    if (!this._isConnected || !this._socket) {
      return CaptureError.HardwareError;
    }

    try {
      this._capturing = true;

      // 设置捕获配置
      await this.configureCaptureSettings(session);

      // 开始采集
      const captureId = await this.startSaleaeCapture();
      this._currentCaptureId = captureId;

      // 设置捕获完成处理器
      if (captureCompletedHandler) {
        this.once('captureCompleted', captureCompletedHandler);
      }

      // 监控采集状态
      this.monitorCaptureProgress(session);

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('Saleae采集启动失败:', error);
      return CaptureError.UnexpectedError;
    }
  }

  /**
   * 停止采集
   */
  async stopCapture(): Promise<boolean> {
    if (!this._capturing) {
      return true;
    }

    try {
      if (this._currentCaptureId) {
        await this.sendCommand({
          command: 'STOP_CAPTURE',
          capture_id: this._currentCaptureId
        });
      }

      this._capturing = false;
      this._currentCaptureId = null;
      return true;
    } catch (error) {
      console.error('停止Saleae采集失败:', error);
      return false;
    }
  }

  /**
   * 进入引导加载程序模式（Saleae不支持）
   */
  async enterBootloader(): Promise<boolean> {
    return false; // Saleae Logic不支持引导加载程序模式
  }

  /**
   * 初始化Socket连接
   */
  private async initializeSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket = new Socket();

      this._socket.connect(this._port, this._host, () => {
        console.log(`已连接到Saleae Logic API: ${this._host}:${this._port}`);
        resolve();
      });

      this._socket.on('error', error => {
        reject(new Error(`Socket连接失败: ${error.message}`));
      });

      this._socket.on('close', () => {
        this._isConnected = false;
        console.log('Saleae Logic连接已关闭');
      });
    });
  }

  /**
   * 查询设备信息
   */
  private async queryDeviceInfo(): Promise<void> {
    try {
      // 获取连接的设备列表
      const devicesResponse = await this.sendCommand({ command: 'GET_CONNECTED_DEVICES' });

      if (devicesResponse.connected_devices && devicesResponse.connected_devices.length > 0) {
        const device = devicesResponse.connected_devices[0];
        this._deviceId = device.device_id;
        this._version = `Saleae Logic ${device.device_type}`;

        // 根据设备类型设置通道数和频率
        this.setDeviceCapabilities(device.device_type);
      } else {
        throw new Error('未发现连接的Saleae Logic设备');
      }

      // 获取详细的设备能力信息
      if (this._deviceId) {
        const capabilitiesResponse = await this.sendCommand({
          command: 'GET_DEVICE_CAPABILITIES',
          device_id: this._deviceId
        });

        if (capabilitiesResponse.capabilities) {
          this.parseDeviceCapabilities(capabilitiesResponse.capabilities);
        }
      }
    } catch (error) {
      throw new Error(`查询Saleae设备信息失败: ${error}`);
    }
  }

  /**
   * 根据设备类型设置能力参数
   */
  private setDeviceCapabilities(deviceType: string): void {
    // 根据Saleae Logic设备类型设置默认参数
    switch (deviceType.toLowerCase()) {
      case 'logic 4':
        this._channelCount = 4;
        this._maxFrequency = 12500000; // 12.5MHz
        this._blastFrequency = 25000000; // 25MHz
        break;
      case 'logic 8':
        this._channelCount = 8;
        this._maxFrequency = 100000000; // 100MHz
        this._blastFrequency = 500000000; // 500MHz
        break;
      case 'logic 16':
        this._channelCount = 16;
        this._maxFrequency = 100000000; // 100MHz
        this._blastFrequency = 500000000; // 500MHz
        break;
      case 'logic pro 8':
        this._channelCount = 8;
        this._maxFrequency = 500000000; // 500MHz
        this._blastFrequency = 1000000000; // 1GHz
        break;
      case 'logic pro 16':
        this._channelCount = 16;
        this._maxFrequency = 500000000; // 500MHz
        this._blastFrequency = 1000000000; // 1GHz
        break;
      default:
        this._channelCount = 8;
        this._maxFrequency = 100000000;
        this._blastFrequency = 500000000;
    }
  }

  /**
   * 解析设备能力信息
   */
  private parseDeviceCapabilities(capabilities: any): void {
    if (capabilities.digital_channels) {
      this._channelCount = capabilities.digital_channels.length;
    }

    if (capabilities.supported_sample_rates) {
      const rates = capabilities.supported_sample_rates;
      this._maxFrequency = Math.max(...rates);
      this._blastFrequency = this._maxFrequency;
    }

    if (capabilities.memory_size) {
      this._bufferSize = capabilities.memory_size;
    }
  }

  /**
   * 配置采集设置
   */
  private async configureCaptureSettings(session: CaptureSession): Promise<void> {
    if (!this._deviceId) {
      throw new Error('设备ID未设置');
    }

    // 配置数字通道
    const digitalChannels = session.captureChannels.map(ch => ({
      index: ch.channelNumber,
      enabled: true,
      label: ch.channelName || `Channel ${ch.channelNumber + 1}`
    }));

    await this.sendCommand({
      command: 'SET_CAPTURE_CONFIGURATION',
      device_id: this._deviceId,
      configuration: {
        digital_channels: digitalChannels,
        sample_rate: session.frequency,
        capture_mode: this.getSaleaeCaptureMode(session),
        trigger_settings: this.buildTriggerSettings(session)
      }
    });
  }

  /**
   * 获取Saleae采集模式
   */
  private getSaleaeCaptureMode(session: CaptureSession): string {
    // Saleae Logic 2的采集模式
    if (session.measureBursts || session.loopCount > 0) {
      return 'LOOPING';
    }
    return 'NORMAL';
  }

  /**
   * 构建触发设置
   */
  private buildTriggerSettings(session: CaptureSession): any {
    const triggers = [];

    // 基于原始触发类型构建Saleae触发设置
    if (session.triggerType !== undefined && session.triggerChannel !== undefined) {
      triggers.push({
        channel_index: session.triggerChannel,
        trigger_type: session.triggerInverted ? 'FALLING_EDGE' : 'RISING_EDGE',
        minimum_pulse_width_seconds: 0
      });
    }

    return {
      triggers,
      capture_mode: 'ALWAYS' // 始终捕获，或根据触发条件调整
    };
  }

  /**
   * 开始Saleae采集
   */
  private async startSaleaeCapture(): Promise<string> {
    const response = await this.sendCommand({
      command: 'START_CAPTURE',
      device_id: this._deviceId
    });

    if (!response.capture_id) {
      throw new Error('Saleae采集启动失败：未收到capture_id');
    }

    return response.capture_id;
  }

  /**
   * 监控采集进度
   */
  private async monitorCaptureProgress(session: CaptureSession): Promise<void> {
    const checkInterval = setInterval(async () => {
      try {
        if (!this._currentCaptureId || !this._capturing) {
          clearInterval(checkInterval);
          return;
        }

        const statusResponse = await this.sendCommand({
          command: 'GET_CAPTURE_STATUS',
          capture_id: this._currentCaptureId
        });

        if (statusResponse.status === 'COMPLETE') {
          clearInterval(checkInterval);
          await this.processCaptureResults(session);
        } else if (statusResponse.status === 'ERROR') {
          clearInterval(checkInterval);
          this.handleCaptureError(session, statusResponse.error_message);
        }
      } catch (error) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, `监控采集进度失败: ${error}`);
      }
    }, 100); // 每100ms检查一次状态
  }

  /**
   * 处理采集结果
   */
  private async processCaptureResults(session: CaptureSession): Promise<void> {
    try {
      // 获取采集数据
      const dataResponse = await this.sendCommand({
        command: 'GET_CAPTURE_DATA',
        capture_id: this._currentCaptureId,
        format: 'BINARY'
      });

      // 解析数据到session.captureChannels
      this.parseSaleaeData(session, dataResponse);

      this._capturing = false;
      this._currentCaptureId = null;

      const eventArgs: CaptureEventArgs = {
        success: true,
        session
      };

      this.emitCaptureCompleted(eventArgs);
    } catch (error) {
      this.handleCaptureError(session, `处理采集结果失败: ${error}`);
    }
  }

  /**
   * 解析Saleae数据格式
   */
  private parseSaleaeData(session: CaptureSession, dataResponse: any): void {
    // Saleae Logic 2 API返回的数据格式处理
    if (dataResponse.digital_samples) {
      const samples = dataResponse.digital_samples;

      for (let channelIndex = 0; channelIndex < session.captureChannels.length; channelIndex++) {
        const channel = session.captureChannels[channelIndex];
        const channelData = samples[channel.channelNumber];

        if (channelData && channelData.samples) {
          // 转换Saleae的时间序列数据为样本数组
          channel.samples = this.convertSaleaeTimeSeriesToSamples(
            channelData.samples,
            channelData.sample_rate || session.frequency
          );
        }
      }
    }
  }

  /**
   * 转换Saleae时间序列数据为样本数组
   */
  private convertSaleaeTimeSeriesToSamples(
    timeSeries: Array<{ time: number; value: boolean }>,
    sampleRate: number
  ): Uint8Array {
    if (timeSeries.length === 0) return new Uint8Array(0);

    // 计算总样本数
    const lastTime = timeSeries[timeSeries.length - 1].time;
    const totalSamples = Math.ceil(lastTime * sampleRate) + 1;
    const samples = new Uint8Array(totalSamples);

    // 填充样本数据
    let currentValue = 0;
    let timeSeriesIndex = 0;

    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex++) {
      const currentTime = sampleIndex / sampleRate;

      // 检查是否需要更新当前值
      while (timeSeriesIndex < timeSeries.length &&
             timeSeries[timeSeriesIndex].time <= currentTime) {
        currentValue = timeSeries[timeSeriesIndex].value ? 1 : 0;
        timeSeriesIndex++;
      }

      samples[sampleIndex] = currentValue;
    }

    return samples;
  }

  /**
   * 处理采集错误
   */
  private handleCaptureError(session: CaptureSession, errorMessage: string): void {
    this._capturing = false;
    this._currentCaptureId = null;

    console.error('Saleae采集错误:', errorMessage);

    const eventArgs: CaptureEventArgs = {
      success: false,
      session
    };

    this.emitCaptureCompleted(eventArgs);
  }

  /**
   * 发送命令到Saleae Logic API
   */
  private async sendCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this._socket) {
        reject(new Error('Socket未连接'));
        return;
      }

      const commandStr = `${JSON.stringify(command)}\n`;

      // 设置响应处理器
      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          this._socket!.off('data', responseHandler);

          if (response.success === false) {
            reject(new Error(response.error_message || '命令执行失败'));
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error}`));
        }
      };

      this._socket.once('data', responseHandler);

      // 发送命令
      this._socket.write(commandStr, error => {
        if (error) {
          reject(new Error(`发送命令失败: ${error.message}`));
        }
      });

      // 设置超时
      setTimeout(() => {
        this._socket!.off('data', responseHandler);
        reject(new Error('命令执行超时'));
      }, 10000);
    });
  }

  /**
   * 构建硬件能力描述
   */
  private buildCapabilities(): any {
    return {
      channels: {
        digital: this._channelCount,
        maxVoltage: 5.0,
        inputImpedance: 1000000
      },
      sampling: {
        maxRate: this._maxFrequency,
        minRate: this.minFrequency,
        supportedRates: [this._maxFrequency, this._blastFrequency],
        bufferSize: this._bufferSize,
        streamingSupport: true
      },
      triggers: {
        types: [0, 1], // Edge triggers primarily
        maxChannels: this._channelCount,
        patternWidth: this._channelCount,
        sequentialSupport: true,
        conditions: ['rising', 'falling', 'high', 'low', 'change']
      },
      connectivity: {
        interfaces: ['usb'],
        protocols: ['saleae_api']
      },
      features: {
        signalGeneration: false,
        powerSupply: false,
        voltageMonitoring: false
      }
    };
  }

  /**
   * 资源清理
   */
  override dispose(): void {
    this.disconnect();
    super.dispose();
  }
}
