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
 * Rigol/Siglent逻辑分析器驱动实现
 * 基于SCPI (Standard Commands for Programmable Instruments) 协议
 * 支持设备型号：Rigol DS1000Z系列, Siglent SDS系列等
 */
export class RigolSiglentDriver extends AnalyzerDriverBase {
  // SCPI端口配置
  private static readonly SCPI_PORT = 5555;
  private static readonly VXI11_PORT = 111;

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
    return this._isNetwork;
  }
  get isCapturing(): boolean {
    return this._capturing;
  }
  get driverType(): AnalyzerDriverType {
    return this._isNetwork ? AnalyzerDriverType.Network : AnalyzerDriverType.Serial;
  }

  // 私有变量
  private _capturing: boolean = false;
  private _isNetwork: boolean = true; // 大多数现代设备支持网络
  private _version: string | null = null;
  private _channelCount: number = 16; // 默认16通道
  private _maxFrequency: number = 1000000000; // 1GHz默认
  private _blastFrequency: number = 2000000000; // 2GHz默认
  private _bufferSize: number = 56000000; // 56M样本默认
  private _host: string;
  private _port: number;
  private _manufacturer: 'rigol' | 'siglent' | 'unknown' = 'unknown';

  // 通信对象
  private _socket: Socket | undefined = undefined;
  private _isConnected: boolean = false;
  private _commandQueue: Array<{
    command: string;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  }> = [];
  private _isProcessingCommand: boolean = false;

  constructor(connectionString: string) {
    super();

    if (!connectionString) {
      throw new Error('连接字符串不能为空');
    }

    // 解析连接字符串 "host:port" 或 "host"
    if (connectionString.includes(':')) {
      const parts = connectionString.split(':');
      this._host = parts[0];
      this._port = parseInt(parts[1], 10);
    } else {
      this._host = connectionString;
      this._port = RigolSiglentDriver.SCPI_PORT;
    }
  }

  /**
   * 连接设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      await this.initializeSocket();
      await this.queryDeviceInfo();
      await this.initializeLogicAnalyzer();

      this._isConnected = true;

      return {
        success: true,
        deviceInfo: {
          name: this._version || 'Rigol/Siglent Logic Analyzer',
          version: this._version ?? undefined,
          type: this.driverType,
          connectionPath: `${this._host}:${this._port}`,
          isNetwork: this._isNetwork,
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

    this._commandQueue = [];
    this._isProcessingCommand = false;
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    try {
      const status = await this.sendSCPICommand('SYST:ERR?');
      return {
        isConnected: this._isConnected,
        isCapturing: this._capturing,
        batteryVoltage: 'N/A', // 台式设备通常不使用电池
        lastError: status !== '+0,"No error"' ? status : undefined
      };
    } catch (error) {
      return {
        isConnected: this._isConnected,
        isCapturing: this._capturing,
        batteryVoltage: 'N/A',
        lastError: error instanceof Error ? error.message : '状态查询失败'
      };
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

    if (!this._isConnected || !this._socket) {
      return CaptureError.HardwareError;
    }

    try {
      this._capturing = true;

      // 配置逻辑分析器设置
      await this.configureLogicAnalyzer(session);

      // 启动采集
      await this.startSCPICapture();

      // 设置捕获完成处理器
      if (captureCompletedHandler) {
        this.once('captureCompleted', captureCompletedHandler);
      }

      // 监控采集状态
      this.monitorCaptureStatus(session);

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('Rigol/Siglent采集启动失败:', error);
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
      // 发送停止命令
      await this.sendSCPICommand('LA:STOP');
      this._capturing = false;
      return true;
    } catch (error) {
      console.error('停止Rigol/Siglent采集失败:', error);
      return false;
    }
  }

  /**
   * 进入引导加载程序模式（不支持）
   */
  async enterBootloader(): Promise<boolean> {
    return false; // Rigol/Siglent设备不支持引导加载程序模式
  }

  /**
   * 初始化Socket连接
   */
  private async initializeSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket = new Socket();

      this._socket.connect(this._port, this._host, () => {
        console.log(`已连接到Rigol/Siglent设备: ${this._host}:${this._port}`);
        resolve();
      });

      this._socket.on('error', error => {
        reject(new Error(`Socket连接失败: ${error.message}`));
      });

      this._socket.on('close', () => {
        this._isConnected = false;
        console.log('Rigol/Siglent连接已关闭');
      });

      this._socket.on('data', data => {
        this.handleIncomingData(data);
      });
    });
  }

  /**
   * 查询设备信息
   */
  private async queryDeviceInfo(): Promise<void> {
    try {
      // 查询设备身份信息
      const idn = await this.sendSCPICommand('*IDN?');
      this.parseIDNResponse(idn);

      // 查询逻辑分析器能力
      await this.queryLogicAnalyzerCapabilities();
    } catch (error) {
      throw new Error(`查询设备信息失败: ${error}`);
    }
  }

  /**
   * 解析IDN响应
   */
  private parseIDNResponse(idn: string): void {
    // IDN格式: "厂商,型号,序列号,固件版本"
    const parts = idn.split(',');
    if (parts.length >= 4) {
      const manufacturer = parts[0].toLowerCase();
      const model = parts[1];
      const firmware = parts[3];

      this._version = `${parts[0]} ${model} (${firmware})`;

      // 识别制造商
      if (manufacturer.includes('rigol')) {
        this._manufacturer = 'rigol';
      } else if (manufacturer.includes('siglent')) {
        this._manufacturer = 'siglent';
      }

      // 根据型号设置默认参数
      this.setModelCapabilities(model);
    }
  }

  /**
   * 根据型号设置能力参数
   */
  private setModelCapabilities(model: string): void {
    const modelLower = model.toLowerCase();

    // Rigol设备
    if (modelLower.includes('ds1000z') || modelLower.includes('ds2000') || modelLower.includes('ds4000')) {
      this._channelCount = 16;
      this._maxFrequency = 1000000000; // 1GHz
      this._blastFrequency = 2000000000; // 2GHz
      this._bufferSize = 56000000; // 56M样本
    }
    // Siglent设备
    else if (modelLower.includes('sds') || modelLower.includes('sps')) {
      this._channelCount = 16;
      this._maxFrequency = 1000000000; // 1GHz
      this._blastFrequency = 2000000000; // 2GHz
      this._bufferSize = 100000000; // 100M样本
    }
    // 默认配置
    else {
      this._channelCount = 16;
      this._maxFrequency = 500000000; // 500MHz
      this._blastFrequency = 1000000000; // 1GHz
      this._bufferSize = 28000000; // 28M样本
    }
  }

  /**
   * 查询逻辑分析器能力
   */
  private async queryLogicAnalyzerCapabilities(): Promise<void> {
    try {
      // 查询逻辑分析器是否可用
      const laAvailable = await this.sendSCPICommand('LA:STAT?');
      if (!laAvailable.includes('1') && !laAvailable.toLowerCase().includes('on')) {
        console.warn('逻辑分析器功能可能不可用或未激活');
      }

      // 查询通道数
      try {
        const channels = await this.sendSCPICommand('LA:CHAN?');
        const channelMatch = channels.match(/\\d+/);
        if (channelMatch) {
          this._channelCount = parseInt(channelMatch[0], 10);
        }
      } catch (error) {
        console.warn('无法查询逻辑分析器通道数:', error);
      }

      // 查询采样率范围
      try {
        const sampleRate = await this.sendSCPICommand('LA:SRAT:MAX?');
        const rateMatch = sampleRate.match(/([0-9.]+)[E]?([+-]?[0-9]+)?/);
        if (rateMatch) {
          const baseRate = parseFloat(rateMatch[1]);
          const exponent = rateMatch[2] ? parseInt(rateMatch[2], 10) : 0;
          this._maxFrequency = baseRate * Math.pow(10, exponent);
        }
      } catch (error) {
        console.warn('无法查询最大采样率:', error);
      }

      // 查询内存深度
      try {
        const memDepth = await this.sendSCPICommand('LA:MDEP?');
        const depthMatch = memDepth.match(/([0-9.]+)[E]?([+-]?[0-9]+)?/);
        if (depthMatch) {
          const baseDepth = parseFloat(depthMatch[1]);
          const exponent = depthMatch[2] ? parseInt(depthMatch[2], 10) : 0;
          this._bufferSize = baseDepth * Math.pow(10, exponent);
        }
      } catch (error) {
        console.warn('无法查询内存深度:', error);
      }
    } catch (error) {
      console.warn('查询逻辑分析器能力失败:', error);
    }
  }

  /**
   * 初始化逻辑分析器
   */
  private async initializeLogicAnalyzer(): Promise<void> {
    try {
      // 重置逻辑分析器
      await this.sendSCPICommand('LA:RST');

      // 设置为逻辑分析模式
      await this.sendSCPICommand('LA:STAT ON');

      // 等待设备稳定
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn('初始化逻辑分析器失败:', error);
    }
  }

  /**
   * 配置逻辑分析器
   */
  private async configureLogicAnalyzer(session: CaptureSession): Promise<void> {
    try {
      // 配置采样率
      await this.sendSCPICommand(`LA:SRAT ${session.frequency}`);

      // 配置内存深度
      const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
      await this.sendSCPICommand(`LA:MDEP ${totalSamples}`);

      // 配置通道
      for (const channel of session.captureChannels) {
        const channelNum = channel.channelNumber + 1; // SCPI通常从1开始编号
        await this.sendSCPICommand(`LA:D${channelNum}:DISP ON`);

        if (channel.channelName) {
          await this.sendSCPICommand(`LA:D${channelNum}:LAB "${channel.channelName}"`);
        }
      }

      // 配置触发
      if (session.triggerType !== undefined && session.triggerChannel !== undefined) {
        await this.configureTrigger(session);
      }

      // 配置时基
      const timeRange = totalSamples / session.frequency;
      await this.sendSCPICommand(`LA:SCAL ${timeRange}`);

    } catch (error) {
      throw new Error(`配置逻辑分析器失败: ${error}`);
    }
  }

  /**
   * 配置触发
   */
  private async configureTrigger(session: CaptureSession): Promise<void> {
    const triggerChannel = session.triggerChannel! + 1; // SCPI从1开始编号

    try {
      // 设置触发源
      await this.sendSCPICommand(`LA:TRIG:SOUR D${triggerChannel}`);

      // 设置触发类型
      let triggerSlope = 'POS'; // 默认上升沿
      if (session.triggerInverted) {
        triggerSlope = 'NEG';
      }

      await this.sendSCPICommand(`LA:TRIG:SLOP ${triggerSlope}`);

      // 设置触发模式
      switch (session.triggerType) {
        case 0: // Edge
          await this.sendSCPICommand('LA:TRIG:TYP EDGE');
          break;
        case 1: // Complex/Pattern
          await this.sendSCPICommand('LA:TRIG:TYP PATT');
          if (session.triggerPattern !== undefined) {
            // 将触发模式转换为SCPI格式
            const pattern = session.triggerPattern.toString(2).padStart(16, '0');
            await this.sendSCPICommand(`LA:TRIG:PATT:DATA "${pattern}"`);
          }
          break;
        default:
          await this.sendSCPICommand('LA:TRIG:TYP EDGE');
      }

      // 设置触发位置
      if (session.preTriggerSamples > 0) {
        const triggerPosition = session.preTriggerSamples /
          (session.preTriggerSamples + session.postTriggerSamples);
        await this.sendSCPICommand(`LA:TRIG:POS ${triggerPosition * 100}`);
      }

    } catch (error) {
      console.warn('配置触发失败:', error);
    }
  }

  /**
   * 启动SCPI采集
   */
  private async startSCPICapture(): Promise<void> {
    try {
      // 清除错误状态
      await this.sendSCPICommand('*CLS');

      // 启动单次采集
      await this.sendSCPICommand('LA:RUN');

      console.log('Rigol/Siglent逻辑分析器采集已启动');
    } catch (error) {
      throw new Error(`启动采集失败: ${error}`);
    }
  }

  /**
   * 监控采集状态
   */
  private async monitorCaptureStatus(session: CaptureSession): Promise<void> {
    const checkInterval = setInterval(async () => {
      try {
        if (!this._capturing) {
          clearInterval(checkInterval);
          return;
        }

        // 查询采集状态
        const status = await this.sendSCPICommand('LA:STAT?');

        if (status.includes('STOP') || status.includes('0')) {
          clearInterval(checkInterval);
          await this.processCaptureResults(session);
        }
      } catch (error) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, `监控采集状态失败: ${error}`);
      }
    }, 500); // 每500ms检查一次状态

    // 设置超时保护
    setTimeout(() => {
      if (this._capturing) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, '采集超时');
      }
    }, 60000); // 60秒超时
  }

  /**
   * 处理采集结果
   */
  private async processCaptureResults(session: CaptureSession): Promise<void> {
    try {
      // 读取采集数据
      for (const channel of session.captureChannels) {
        const channelNum = channel.channelNumber + 1;

        // 请求通道数据
        const dataCommand = `LA:D${channelNum}:DATA?`;
        const rawData = await this.sendSCPICommand(dataCommand);

        // 解析数据
        channel.samples = this.parseSCPIBinaryData(rawData);
      }

      this._capturing = false;

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
   * 解析SCPI二进制数据
   */
  private parseSCPIBinaryData(rawData: string): Uint8Array {
    // SCPI二进制数据格式通常是: #<digit><count><data>
    if (rawData.startsWith('#')) {
      const digitCount = parseInt(rawData[1], 10);
      const dataLength = parseInt(rawData.substring(2, 2 + digitCount), 10);
      const binaryStart = 2 + digitCount;

      // 提取二进制数据部分
      const binaryData = rawData.substring(binaryStart, binaryStart + dataLength);

      // 转换为Uint8Array
      const samples = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        samples[i] = binaryData.charCodeAt(i) !== 0 ? 1 : 0;
      }

      return samples;
    }

    // 如果不是二进制格式，尝试解析为ASCII格式
    const values = rawData.split(',').map(val => parseInt(val.trim(), 10));
    const samples = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++) {
      samples[i] = values[i] ? 1 : 0;
    }

    return samples;
  }

  /**
   * 处理采集错误
   */
  private handleCaptureError(session: CaptureSession, errorMessage: string): void {
    this._capturing = false;
    console.error('Rigol/Siglent采集错误:', errorMessage);

    const eventArgs: CaptureEventArgs = {
      success: false,
      session
    };

    this.emitCaptureCompleted(eventArgs);
  }

  /**
   * 发送SCPI命令
   */
  private async sendSCPICommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this._commandQueue.push({ command, resolve, reject });
      this.processCommandQueue();
    });
  }

  /**
   * 处理命令队列
   */
  private async processCommandQueue(): Promise<void> {
    if (this._isProcessingCommand || this._commandQueue.length === 0) {
      return;
    }

    this._isProcessingCommand = true;
    const { command, resolve, reject } = this._commandQueue.shift()!;

    try {
      if (!this._socket) {
        reject(new Error('Socket未连接'));
        return;
      }

      let responseData = '';
      const isQuery = command.includes('?');

      // 数据接收处理器
      const dataHandler = (data: Buffer) => {
        responseData += data.toString();

        // 检查响应是否完整（以换行符结束）
        if (responseData.includes('\\n')) {
          this._socket!.off('data', dataHandler);
          clearTimeout(timeoutId);
          resolve(responseData.trim());

          // 继续处理队列中的其他命令
          this._isProcessingCommand = false;
          setTimeout(() => this.processCommandQueue(), 10);
        }
      };

      // 设置超时
      const timeoutId = setTimeout(() => {
        this._socket!.off('data', dataHandler);
        reject(new Error(`SCPI命令超时: ${command}`));
        this._isProcessingCommand = false;
        setTimeout(() => this.processCommandQueue(), 10);
      }, 5000);

      // 如果是查询命令，设置数据接收器
      if (isQuery) {
        this._socket.on('data', dataHandler);
      } else {
        // 非查询命令，直接返回
        setTimeout(() => {
          resolve('OK');
          this._isProcessingCommand = false;
          setTimeout(() => this.processCommandQueue(), 10);
        }, 100);
      }

      // 发送命令
      this._socket.write(`${command}\\n`, error => {
        if (error) {
          if (isQuery) {
            this._socket!.off('data', dataHandler);
          }
          clearTimeout(timeoutId);
          reject(new Error(`发送SCPI命令失败: ${error.message}`));
          this._isProcessingCommand = false;
          setTimeout(() => this.processCommandQueue(), 10);
        }
      });

    } catch (error) {
      reject(error);
      this._isProcessingCommand = false;
      setTimeout(() => this.processCommandQueue(), 10);
    }
  }

  /**
   * 处理接收到的数据
   */
  private handleIncomingData(data: Buffer): void {
    // 这个方法主要用于处理异步数据或状态更新
    const dataStr = data.toString();

    // 可以在这里处理设备主动发送的状态信息
    if (dataStr.includes('ERROR') || dataStr.includes('FAIL')) {
      console.warn('设备报告错误:', dataStr);
    }
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
        types: [0, 1, 2], // Edge, Pattern, Complex
        maxChannels: this._channelCount,
        patternWidth: 16,
        sequentialSupport: true,
        conditions: ['rising', 'falling', 'high', 'low', 'change']
      },
      connectivity: {
        interfaces: ['ethernet', 'usb'],
        protocols: ['scpi', 'vxi11']
      },
      features: {
        signalGeneration: false,
        powerSupply: false,
        voltageMonitoring: false,
        mathFunctions: true,
        protocolDecoding: true
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
