import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  CaptureEventArgs,
  CaptureCompletedHandler,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus
} from '../../models/AnalyzerTypes';
import { ProtocolHelper } from '../tools/ProtocolHelper';

/**
 * 串口驱动模板
 * 专门用于串口连接的逻辑分析器设备
 * 包含完整的串口通信处理逻辑
 */
export class SerialDriverTemplate extends AnalyzerDriverBase {
  // 设备属性
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
    return false; // 串口设备
  }

  get isCapturing(): boolean {
    return this._capturing;
  }

  get driverType(): AnalyzerDriverType {
    return AnalyzerDriverType.Serial;
  }

  // 私有变量
  private _version: string | null = null;
  private _channelCount: number = 8;
  private _maxFrequency: number = 24000000; // 24MHz
  private _blastFrequency: number = 100000000; // 100MHz
  private _bufferSize: number = 1000000; // 1M samples
  private _capturing: boolean = false;
  private _portPath: string;
  private _serialPort: any = null; // SerialPort实例
  private _isConnected: boolean = false;
  private _serialConfig: any;

  // 通信相关
  private _commandQueue: Array<{
    command: Buffer;
    resolve: (data: Buffer) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private _isProcessingCommand: boolean = false;
  private _responseBuffer: Buffer = Buffer.alloc(0);

  constructor(portPath: string, baudRate: number = 115200) {
    super();
    this._portPath = portPath;

    // 获取串口配置
    this._serialConfig = ProtocolHelper.serial.getBaudRateConfig(baudRate);

    console.log(`初始化串口驱动: ${portPath} @ ${baudRate}`);
  }

  /**
   * 连接设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      console.log(`连接串口设备: ${this._portPath}`);

      // 动态导入serialport（如果可用）
      const { SerialPort } = await this.loadSerialPort();

      // 配置串口参数
      const portConfig = {
        path: this._portPath,
        baudRate: this._serialConfig.baudRate,
        dataBits: this._serialConfig.dataBits,
        stopBits: this._serialConfig.stopBits,
        parity: this._serialConfig.parity,
        autoOpen: false
      };

      this._serialPort = new SerialPort(portConfig);

      // 打开串口
      await this.openSerialPort();

      // 设置数据接收处理器
      this._serialPort.on('data', this.handleSerialData.bind(this));
      this._serialPort.on('error', this.handleSerialError.bind(this));
      this._serialPort.on('close', this.handleSerialClose.bind(this));

      // 初始化设备
      await this.initializeDevice();

      // 查询设备信息
      await this.queryDeviceInfo();

      this._isConnected = true;

      return {
        success: true,
        deviceInfo: {
          name: this._version || 'Serial Logic Analyzer',
          version: this._version ?? undefined,
          type: this.driverType,
          connectionPath: this._portPath,
          isNetwork: false,
          capabilities: this.buildCapabilities()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '串口连接失败'
      };
    }
  }

  /**
   * 动态加载serialport库
   */
  private async loadSerialPort(): Promise<any> {
    try {
      return await import('serialport');
    } catch (error) {
      throw new Error('serialport库未安装。请运行: npm install serialport');
    }
  }

  /**
   * 打开串口
   */
  private async openSerialPort(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._serialPort.open((error: Error | null) => {
        if (error) {
          reject(new Error(`串口打开失败: ${error.message}`));
        } else {
          console.log(`串口已打开: ${this._portPath}`);
          resolve();
        }
      });
    });
  }

  /**
   * 处理串口数据接收
   */
  private handleSerialData(data: Buffer): void {
    this._responseBuffer = Buffer.concat([this._responseBuffer, data]);

    // 处理完整的数据包
    this.processResponseBuffer();
  }

  /**
   * 处理响应缓冲区
   */
  private processResponseBuffer(): void {
    // TODO: 根据设备协议实现数据包解析
    // 这里提供一个基于换行符的简单示例

    let newlineIndex;
    while ((newlineIndex = this._responseBuffer.indexOf('\\n')) !== -1) {
      const packet = this._responseBuffer.subarray(0, newlineIndex);
      this._responseBuffer = this._responseBuffer.subarray(newlineIndex + 1);

      // 处理完整的响应包
      this.handleResponse(packet);
    }
  }

  /**
   * 处理响应包
   */
  private handleResponse(data: Buffer): void {
    if (this._commandQueue.length > 0) {
      const pendingCommand = this._commandQueue.shift()!;
      clearTimeout(pendingCommand.timeout);
      pendingCommand.resolve(data);

      // 处理队列中的下一个命令
      this.processCommandQueue();
    }
  }

  /**
   * 处理串口错误
   */
  private handleSerialError(error: Error): void {
    console.error('串口错误:', error);
    this._isConnected = false;

    // 拒绝所有待处理的命令
    this._commandQueue.forEach(cmd => {
      clearTimeout(cmd.timeout);
      cmd.reject(error);
    });
    this._commandQueue = [];
  }

  /**
   * 处理串口关闭
   */
  private handleSerialClose(): void {
    console.log('串口连接已关闭');
    this._isConnected = false;
  }

  /**
   * 初始化设备
   */
  private async initializeDevice(): Promise<void> {
    console.log('初始化串口设备...');

    // 发送复位命令
    await this.sendRawCommand(Buffer.from('*RST\\n'));

    // 等待设备稳定
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 清除状态
    await this.sendRawCommand(Buffer.from('*CLS\\n'));
  }

  /**
   * 查询设备信息
   */
  private async queryDeviceInfo(): Promise<void> {
    try {
      // 查询设备标识
      const idnResponse = await this.sendRawCommand(Buffer.from('*IDN?\\n'));
      this.parseDeviceIdentification(idnResponse.toString());

      // 查询设备能力
      await this.queryDeviceCapabilities();
    } catch (error) {
      console.warn('设备信息查询失败:', error);
      this._version = 'Unknown Serial Device';
    }
  }

  /**
   * 解析设备标识信息
   */
  private parseDeviceIdentification(idn: string): void {
    // 标准格式: \"厂商,型号,序列号,固件版本\"
    const parts = idn.trim().split(',');
    if (parts.length >= 2) {
      this._version = `${parts[0]} ${parts[1]}`;
      if (parts.length >= 4) {
        this._version += ` (${parts[3]})`;
      }
    } else {
      this._version = idn.trim();
    }
  }

  /**
   * 查询设备能力
   */
  private async queryDeviceCapabilities(): Promise<void> {
    try {
      // 查询通道数
      const channelsResponse = await this.sendRawCommand(Buffer.from('CHANNELS?\\n'));
      const channels = parseInt(channelsResponse.toString().trim());
      if (channels > 0) {
        this._channelCount = channels;
      }

      // 查询最大采样率
      const maxRateResponse = await this.sendRawCommand(Buffer.from('MAXRATE?\\n'));
      const maxRate = parseInt(maxRateResponse.toString().trim());
      if (maxRate > 0) {
        this._maxFrequency = maxRate;
      }

      // 查询缓冲区大小
      const bufferResponse = await this.sendRawCommand(Buffer.from('BUFFER?\\n'));
      const bufferSize = parseInt(bufferResponse.toString().trim());
      if (bufferSize > 0) {
        this._bufferSize = bufferSize;
      }
    } catch (error) {
      console.warn('设备能力查询失败:', error);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log('断开串口连接...');

    if (this._capturing) {
      await this.stopCapture();
    }

    // 拒绝所有待处理的命令
    this._commandQueue.forEach(cmd => {
      clearTimeout(cmd.timeout);
      cmd.reject(new Error('设备已断开连接'));
    });
    this._commandQueue = [];

    if (this._serialPort && this._serialPort.isOpen) {
      return new Promise((resolve) => {
        this._serialPort.close(() => {
          this._isConnected = false;
          this._serialPort = null;
          resolve();
        });
      });
    }

    this._isConnected = false;
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    try {
      if (!this._isConnected) {
        return {
          isConnected: false,
          isCapturing: this._capturing,
          batteryVoltage: 'N/A'
        };
      }

      // 查询设备状态
      const statusResponse = await this.sendRawCommand(Buffer.from('STATUS?\\n'));
      const statusText = statusResponse.toString().trim();

      return {
        isConnected: this._isConnected,
        isCapturing: this._capturing,
        batteryVoltage: await this.getBatteryVoltage(),
        errorStatus: statusText.includes('ERROR') ? statusText : undefined
      };
    } catch (error) {
      return {
        isConnected: this._isConnected,
        isCapturing: this._capturing,
        batteryVoltage: 'N/A',
        errorStatus: error instanceof Error ? error.message : '状态查询失败'
      };
    }
  }

  /**
   * 获取电池电压
   */
  private async getBatteryVoltage(): Promise<string> {
    try {
      const voltageResponse = await this.sendRawCommand(Buffer.from('VOLTAGE?\\n'));
      return voltageResponse.toString().trim();
    } catch (error) {
      return 'N/A';
    }
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

    if (!this._isConnected) {
      return CaptureError.HardwareError;
    }

    try {
      console.log('开始串口采集...');
      this._capturing = true;

      // 设置捕获完成处理器
      if (captureCompletedHandler) {
        this.once('captureCompleted', captureCompletedHandler);
      }

      // 配置采集参数
      await this.configureCaptureSession(session);

      // 启动采集
      await this.sendRawCommand(Buffer.from('START\\n'));

      // 监控采集进度
      this.monitorCapture(session);

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('串口采集启动失败:', error);
      return CaptureError.UnexpectedError;
    }
  }

  /**
   * 配置采集会话
   */
  private async configureCaptureSession(session: CaptureSession): Promise<void> {
    // 设置采样率
    const rateCommand = `RATE ${session.frequency}\\n`;
    await this.sendRawCommand(Buffer.from(rateCommand));

    // 设置通道
    const channelNumbers = session.captureChannels.map(ch => ch.channelNumber);
    const channelCommand = `CHANNELS ${channelNumbers.join(',')}\\n`;
    await this.sendRawCommand(Buffer.from(channelCommand));

    // 设置样本数
    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
    const samplesCommand = `SAMPLES ${totalSamples}\\n`;
    await this.sendRawCommand(Buffer.from(samplesCommand));

    // 配置触发
    if (session.triggerType !== undefined && session.triggerChannel !== undefined) {
      const triggerCommand = `TRIGGER ${session.triggerType} ${session.triggerChannel}\\n`;
      await this.sendRawCommand(Buffer.from(triggerCommand));
    }
  }

  /**
   * 监控采集进度
   */
  private async monitorCapture(session: CaptureSession): Promise<void> {
    const checkInterval = setInterval(async () => {
      try {
        if (!this._capturing) {
          clearInterval(checkInterval);
          return;
        }

        // 检查采集状态
        const statusResponse = await this.sendRawCommand(Buffer.from('CAPTURE_STATUS?\\n'));
        const status = statusResponse.toString().trim();

        if (status === 'COMPLETE') {
          clearInterval(checkInterval);
          await this.readCaptureData(session);
        } else if (status === 'ERROR') {
          clearInterval(checkInterval);
          this.handleCaptureError(session, '设备报告采集错误');
        }
      } catch (error) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, `监控采集失败: ${error}`);
      }
    }, 100);

    // 设置超时保护
    setTimeout(() => {
      if (this._capturing) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, '采集超时');
      }
    }, 30000);
  }

  /**
   * 读取采集数据
   */
  private async readCaptureData(session: CaptureSession): Promise<void> {
    try {
      console.log('读取串口采集数据...');

      for (const channel of session.captureChannels) {
        // 请求通道数据
        const dataCommand = `DATA ${channel.channelNumber}\\n`;
        const dataResponse = await this.sendRawCommand(Buffer.from(dataCommand));

        // 解析数据
        channel.samples = this.parseChannelData(dataResponse);
      }

      this._capturing = false;

      const eventArgs: CaptureEventArgs = {
        success: true,
        session
      };

      this.emitCaptureCompleted(eventArgs);
    } catch (error) {
      this.handleCaptureError(session, `读取数据失败: ${error}`);
    }
  }

  /**
   * 解析通道数据
   */
  private parseChannelData(rawData: Buffer): Uint8Array {
    // TODO: 根据设备的数据格式实现解析
    // 这里提供一个基本的二进制数据解析示例

    const samples = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      samples[i] = rawData[i] !== 0 ? 1 : 0;
    }

    return samples;
  }

  /**
   * 处理采集错误
   */
  private handleCaptureError(session: CaptureSession, errorMessage: string): void {
    this._capturing = false;
    console.error('串口采集错误:', errorMessage);

    const eventArgs: CaptureEventArgs = {
      success: false,
      session
    };

    this.emitCaptureCompleted(eventArgs);
  }

  /**
   * 停止采集
   */
  async stopCapture(): Promise<boolean> {
    if (!this._capturing) {
      return true;
    }

    try {
      console.log('停止串口采集...');
      await this.sendRawCommand(Buffer.from('STOP\\n'));
      this._capturing = false;
      return true;
    } catch (error) {
      console.error('停止串口采集失败:', error);
      return false;
    }
  }

  /**
   * 进入引导加载程序模式
   */
  async enterBootloader(): Promise<boolean> {
    try {
      console.log('进入引导加载程序模式...');
      await this.sendRawCommand(Buffer.from('BOOTLOADER\\n'));

      // 等待设备进入引导模式
      await new Promise(resolve => setTimeout(resolve, 2000));

      return true;
    } catch (error) {
      console.error('进入引导加载程序失败:', error);
      return false;
    }
  }

  /**
   * 发送原始命令
   */
  private async sendRawCommand(command: Buffer, timeoutMs: number = 5000): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('命令超时'));
      }, timeoutMs);

      this._commandQueue.push({
        command,
        resolve: (data: Buffer) => {
          clearTimeout(timeout);
          resolve(data);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout
      });

      this.processCommandQueue();
    });
  }

  /**
   * 处理命令队列
   */
  private processCommandQueue(): void {
    if (this._isProcessingCommand || this._commandQueue.length === 0 || !this._serialPort) {
      return;
    }

    this._isProcessingCommand = true;
    const command = this._commandQueue[0];

    this._serialPort.write(command.command, (error: Error | null) => {
      this._isProcessingCommand = false;

      if (error) {
        const cmd = this._commandQueue.shift();
        if (cmd) {
          clearTimeout(cmd.timeout);
          cmd.reject(error);
        }
      }

      // 如果还有命令，继续处理
      if (this._commandQueue.length > 1) {
        setTimeout(() => this.processCommandQueue(), 10);
      }
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
        streamingSupport: false
      },
      triggers: {
        types: [0, 1], // Edge, Complex
        maxChannels: this._channelCount,
        patternWidth: 16,
        sequentialSupport: false,
        conditions: ['rising', 'falling', 'high', 'low']
      },
      connectivity: {
        interfaces: ['serial'],
        protocols: ['custom']
      },
      features: {
        signalGeneration: false,
        powerSupply: false,
        voltageMonitoring: true,
        protocolDecoding: false
      }
    };
  }

  /**
   * 资源清理
   */
  override dispose(): void {
    console.log('清理串口驱动资源...');

    if (this._isConnected) {
      this.disconnect();
    }

    super.dispose();
  }

  /**
   * 获取可用串口列表（静态方法）
   */
  static async getAvailablePorts(): Promise<Array<{ path: string; manufacturer?: string; serialNumber?: string }>> {
    try {
      const { SerialPort } = await import('serialport');
      const ports = await SerialPort.list();

      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber
      }));
    } catch (error) {
      console.warn('获取串口列表失败:', error);
      return [];
    }
  }
}
