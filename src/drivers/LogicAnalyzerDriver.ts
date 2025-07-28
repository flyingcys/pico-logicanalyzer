import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { AnalyzerDriverBase, OutputPacket, CaptureRequest } from './AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  CaptureEventArgs,
  CaptureCompletedHandler,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus
} from '../models/AnalyzerTypes';

/**
 * Pico逻辑分析器驱动实现
 * 基于C# LogicAnalyzerDriver的TypeScript移植
 */
export class LogicAnalyzerDriver extends AnalyzerDriverBase {
  // 正则表达式模式（从C#版本移植）
  private static readonly regAddressPort = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)/;
  private static readonly regChan = /^CHANNELS:([0-9]+)$/;
  private static readonly regBuf = /^BUFFER:([0-9]+)$/;
  private static readonly regFreq = /^FREQ:([0-9]+)$/;
  private static readonly regBlast = /^BLASTFREQ:([0-9]+)$/;

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
  private _isNetwork: boolean = false;
  private _version: string | null = null;
  private _channelCount: number = 0;
  private _maxFrequency: number = 0;
  private _blastFrequency: number = 0;
  private _bufferSize: number = 0;
  private _devAddr?: string;
  private _devPort?: number;

  // 通信对象
  private _serialPort: SerialPort | undefined = undefined;
  private _tcpSocket: Socket | undefined = undefined;
  private _currentStream: NodeJS.ReadWriteStream | undefined = undefined;
  private _lineParser: ReadlineParser | undefined = undefined;
  private _isConnected: boolean = false;

  constructor(private connectionString: string) {
    super();

    if (!connectionString) {
      throw new Error('连接字符串不能为空');
    }
  }

  /**
   * 连接设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      if (this.connectionString.includes(':')) {
        await this.initNetwork(this.connectionString);
      } else {
        await this.initSerialPort(this.connectionString, 115200);
      }

      this._isConnected = true;

      return {
        success: true,
        deviceInfo: {
          name: this._version || 'Unknown Device',
          version: this._version ?? undefined,
          type: this.driverType,
          connectionPath: this.connectionString,
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

    if (this._serialPort?.isOpen) {
      this._serialPort.close();
    }

    if (this._tcpSocket) {
      this._tcpSocket.destroy();
    }

    this._serialPort = undefined;
    this._tcpSocket = undefined;
    this._currentStream = undefined;
    this._lineParser = undefined;
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: this._isConnected,
      isCapturing: this._capturing,
      batteryVoltage: await this.getVoltageStatus()
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

    if (!this._isConnected || !this._currentStream) {
      return CaptureError.HardwareError;
    }

    try {
      this._capturing = true;

      // 创建采集请求
      const captureRequest = CaptureRequest.fromConfiguration({
        frequency: session.frequency,
        preTriggerSamples: session.preTriggerSamples,
        postTriggerSamples: session.postTriggerSamples,
        triggerType: session.triggerType,
        triggerChannel: session.triggerChannel,
        triggerInverted: session.triggerInverted,
        triggerPattern: session.triggerPattern ?? 0,
        triggerBitCount: session.triggerBitCount ?? 1,
        loopCount: session.loopCount,
        measureBursts: session.measureBursts,
        captureChannels: session.captureChannels.map(ch => ch.channelNumber),
        captureMode: session.captureMode
      });

      // 发送采集请求
      const packet = new OutputPacket();
      packet.addByte(1); // 采集命令
      packet.addStruct(captureRequest);

      const data = packet.serialize();
      await this.writeData(data);

      // 设置捕获完成处理器
      if (captureCompletedHandler) {
        this.once('captureCompleted', captureCompletedHandler);
      }

      // 开始读取数据（异步）
      this.startDataReading(session);

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('采集启动失败:', error);
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
      const packet = new OutputPacket();
      packet.addByte(2); // 停止命令

      const data = packet.serialize();
      await this.writeData(data);

      this._capturing = false;
      return true;
    } catch (error) {
      console.error('停止采集失败:', error);
      return false;
    }
  }

  /**
   * 进入引导加载程序模式
   */
  async enterBootloader(): Promise<boolean> {
    try {
      const packet = new OutputPacket();
      packet.addByte(3); // 引导加载程序命令

      const data = packet.serialize();
      await this.writeData(data);

      return true;
    } catch (error) {
      console.error('进入引导加载程序失败:', error);
      return false;
    }
  }

  /**
   * 获取电压状态
   */
  override async getVoltageStatus(): Promise<string> {
    try {
      const packet = new OutputPacket();
      packet.addByte(4); // 电压查询命令

      const data = packet.serialize();
      await this.writeData(data);

      // 等待响应
      return new Promise(resolve => {
        const timeout = setTimeout(() => {
          resolve('TIMEOUT');
        }, 5000);

        this._lineParser?.once('data', (line: string) => {
          clearTimeout(timeout);
          resolve(line.trim());
        });
      });
    } catch (error) {
      console.error('获取电压状态失败:', error);
      return 'ERROR';
    }
  }

  /**
   * 发送网络配置
   */
  override async sendNetworkConfig(
    accessPointName: string,
    password: string,
    ipAddress: string,
    port: number
  ): Promise<boolean> {
    try {
      const packet = new OutputPacket();
      packet.addByte(5); // 网络配置命令

      // 创建网络配置结构
      const netConfig = {
        serialize: () => {
          const buffer = new ArrayBuffer(115); // 33 + 64 + 16 + 2
          const view = new DataView(buffer);
          let offset = 0;

          // AccessPointName - 33字节
          const apNameBytes = new TextEncoder().encode(accessPointName);
          for (let i = 0; i < 33; i++) {
            view.setUint8(offset++, i < apNameBytes.length ? apNameBytes[i] : 0);
          }

          // Password - 64字节
          const passwordBytes = new TextEncoder().encode(password);
          for (let i = 0; i < 64; i++) {
            view.setUint8(offset++, i < passwordBytes.length ? passwordBytes[i] : 0);
          }

          // IPAddress - 16字节
          const ipBytes = new TextEncoder().encode(ipAddress);
          for (let i = 0; i < 16; i++) {
            view.setUint8(offset++, i < ipBytes.length ? ipBytes[i] : 0);
          }

          // Port - 2字节
          view.setUint16(offset, port, true); // little-endian

          return new Uint8Array(buffer);
        }
      };

      packet.addStruct(netConfig);

      const data = packet.serialize();
      await this.writeData(data);

      return true;
    } catch (error) {
      console.error('发送网络配置失败:', error);
      return false;
    }
  }

  /**
   * 初始化串口连接
   */
  private async initSerialPort(portName: string, baudRate: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this._serialPort = new SerialPort({
        path: portName,
        baudRate,
        autoOpen: false
      });

      this._serialPort.open(error => {
        if (error) {
          reject(new Error(`串口连接失败: ${error.message}`));
          return;
        }

        this._currentStream = this._serialPort as NodeJS.ReadWriteStream;
        this._lineParser = new ReadlineParser({ delimiter: '\n' });
        this._serialPort!.pipe(this._lineParser);

        this._isNetwork = false;

        // 初始化设备
        this.initializeDevice().then(resolve).catch(reject);
      });
    });
  }

  /**
   * 初始化网络连接
   */
  private async initNetwork(addressPort: string): Promise<void> {
    const match = LogicAnalyzerDriver.regAddressPort.exec(addressPort);

    if (!match || match.length < 3) {
      throw new Error('指定的地址/端口格式无效');
    }

    this._devAddr = match[1];
    const portStr = match[2];
    this._devPort = parseInt(portStr, 10);

    if (isNaN(this._devPort) || this._devPort < 1 || this._devPort > 65535) {
      throw new Error('指定的端口号无效');
    }

    return new Promise((resolve, reject) => {
      this._tcpSocket = new Socket();

      this._tcpSocket.connect(this._devPort!, this._devAddr!, () => {
        this._currentStream = this._tcpSocket as NodeJS.ReadWriteStream;
        this._lineParser = new ReadlineParser({ delimiter: '\n' });
        this._tcpSocket!.pipe(this._lineParser);

        this._isNetwork = true;

        // 初始化设备
        this.initializeDevice().then(resolve).catch(reject);
      });

      this._tcpSocket.on('error', error => {
        reject(new Error(`网络连接失败: ${error.message}`));
      });
    });
  }

  /**
   * 初始化设备（获取设备信息）
   */
  private async initializeDevice(): Promise<void> {
    if (!this._currentStream || !this._lineParser) {
      throw new Error('通信流未初始化');
    }

    // 发送设备信息查询命令
    const packet = new OutputPacket();
    packet.addByte(0); // 设备信息查询命令

    const data = packet.serialize();
    await this.writeData(data);

    // 读取设备信息
    const responses = await this.readDeviceInfo();

    // 解析设备信息
    this.parseDeviceInfo(responses);
  }

  /**
   * 读取设备信息响应
   */
  private async readDeviceInfo(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const responses: string[] = [];
      const timeout = setTimeout(() => {
        reject(new Error('设备信息读取超时'));
      }, 10000);

      const dataHandler = (line: string) => {
        responses.push(line.trim());

        // 预期接收5行响应：版本、频率、突发频率、缓冲区大小、通道数
        if (responses.length >= 5) {
          clearTimeout(timeout);
          this._lineParser!.off('data', dataHandler);
          resolve(responses);
        }
      };

      this._lineParser!.on('data', dataHandler);
    });
  }

  /**
   * 解析设备信息
   */
  private parseDeviceInfo(responses: string[]): void {
    if (responses.length < 5) {
      throw new Error('设备信息响应不完整');
    }

    // 版本信息
    this._version = responses[0];

    // 频率信息
    const freqMatch = LogicAnalyzerDriver.regFreq.exec(responses[1]);
    if (!freqMatch) {
      throw new Error('无效的设备频率响应');
    }
    this._maxFrequency = parseInt(freqMatch[1], 10);

    // 突发频率信息
    const blastMatch = LogicAnalyzerDriver.regBlast.exec(responses[2]);
    if (!blastMatch) {
      throw new Error('无效的突发频率响应');
    }
    this._blastFrequency = parseInt(blastMatch[1], 10);

    // 缓冲区大小信息
    const bufMatch = LogicAnalyzerDriver.regBuf.exec(responses[3]);
    if (!bufMatch) {
      throw new Error('无效的设备缓冲区大小响应');
    }
    this._bufferSize = parseInt(bufMatch[1], 10);

    // 通道数信息
    const chanMatch = LogicAnalyzerDriver.regChan.exec(responses[4]);
    if (!chanMatch) {
      throw new Error('无效的设备通道数响应');
    }
    this._channelCount = parseInt(chanMatch[1], 10);
  }

  /**
   * 写入数据到流
   */
  private async writeData(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._currentStream) {
        reject(new Error('通信流未初始化'));
        return;
      }

      this._currentStream.write(Buffer.from(data), error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 开始数据读取（采集过程）
   * 基于C# ReadCapture方法的完整实现
   */
  private async startDataReading(session: CaptureSession): Promise<void> {
    try {
      if (!this._currentStream) {
        throw new Error('通信流未初始化');
      }

      // 等待采集开始确认
      const startResponse = await this.waitForResponse('CAPTURE_STARTED', 10000);
      if (startResponse !== 'CAPTURE_STARTED') {
        throw new Error('采集启动失败');
      }

      // 读取采集数据
      const captureData = await this.readCaptureData(session);
      
      // 解析数据到通道
      this.extractSamplesToChannels(session, captureData);

      this._capturing = false;

      const eventArgs: CaptureEventArgs = {
        success: true,
        session
      };

      this.emitCaptureCompleted(eventArgs);
    } catch (error) {
      this._capturing = false;
      console.error('数据读取失败:', error);
      
      const eventArgs: CaptureEventArgs = {
        success: false,
        session
      };

      this.emitCaptureCompleted(eventArgs);
    }
  }

  /**
   * 等待特定响应
   */
  private async waitForResponse(expectedResponse: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this._lineParser!.off('data', dataHandler);
        reject(new Error(`等待响应超时: ${expectedResponse}`));
      }, timeout);

      const dataHandler = (line: string) => {
        const response = line.trim();
        if (response === expectedResponse) {
          clearTimeout(timeoutId);
          this._lineParser!.off('data', dataHandler);
          resolve(response);
        }
      };

      this._lineParser!.on('data', dataHandler);
    });
  }

  /**
   * 读取采集数据
   * 基于C# ReadCapture方法实现
   */
  private async readCaptureData(session: CaptureSession): Promise<{
    samples: Uint32Array;
    timestamps: BigUint64Array;
    bursts: any[];
  }> {
    return new Promise((resolve, reject) => {
      if (!this._currentStream) {
        reject(new Error('通信流未初始化'));
        return;
      }

      const mode = this.getCaptureMode(session.captureChannels.map(ch => ch.channelNumber));
      const totalSamples = session.preTriggerSamples + session.postTriggerSamples * (session.loopCount + 1);
      
      // 计算预期数据长度
      let bytesPerSample: number;
      switch (mode) {
        case 0: // Channels_8
          bytesPerSample = 1;
          break;
        case 1: // Channels_16
          bytesPerSample = 2;
          break;
        case 2: // Channels_24
          bytesPerSample = 4;
          break;
        default:
          bytesPerSample = 4;
      }

      const expectedDataLength = 4 + (totalSamples * bytesPerSample) + 1 + 
        (session.loopCount > 0 && session.measureBursts ? (session.loopCount + 2) * 4 : 0);

      let receivedData = Buffer.alloc(0);
      let dataLength: number | null = null;

      const dataHandler = (chunk: Buffer) => {
        receivedData = Buffer.concat([receivedData, chunk]);

        // 如果还没读取到数据长度
        if (dataLength === null && receivedData.length >= 4) {
          dataLength = receivedData.readUInt32LE(0);
        }

        // 检查是否接收完所有数据
        if (dataLength !== null && receivedData.length >= expectedDataLength) {
          this._currentStream!.off('data', dataHandler);
          
          try {
            const result = this.parseCaptureData(receivedData, session, mode, dataLength);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      };

      // 设置超时
      const timeout = setTimeout(() => {
        this._currentStream!.off('data', dataHandler);
        reject(new Error('数据读取超时'));
      }, 30000); // 30秒超时

      this._currentStream.on('data', dataHandler);
    });
  }

  /**
   * 解析采集数据
   * 基于C# ReadCapture方法的数据解析逻辑
   */
  private parseCaptureData(
    data: Buffer, 
    session: CaptureSession, 
    mode: number, 
    sampleCount: number
  ): {
    samples: Uint32Array;
    timestamps: BigUint64Array;
    bursts: any[];
  } {
    let offset = 4; // 跳过长度字段
    const samples = new Uint32Array(sampleCount);
    
    // 读取样本数据
    for (let i = 0; i < sampleCount; i++) {
      switch (mode) {
        case 0: // Channels_8
          samples[i] = data.readUInt8(offset);
          offset += 1;
          break;
        case 1: // Channels_16
          samples[i] = data.readUInt16LE(offset);
          offset += 2;
          break;
        case 2: // Channels_24
          samples[i] = data.readUInt32LE(offset);
          offset += 4;
          break;
      }
    }

    // 读取时间戳长度
    const timestampLength = data.readUInt8(offset);
    offset += 1;

    const timestamps = new BigUint64Array(timestampLength);
    const bursts: any[] = [];

    // 读取时间戳
    if (timestampLength > 0) {
      for (let i = 0; i < session.loopCount + 2; i++) {
        timestamps[i] = BigInt(data.readUInt32LE(offset));
        offset += 4;
      }

      // 处理突发间隔（基于C#的复杂时间戳处理逻辑）
      this.processBurstTimestamps(timestamps, session, bursts);
    }

    return { samples, timestamps, bursts };
  }

  /**
   * 处理突发时间戳
   * 基于C# ReadCapture中的复杂时间戳处理逻辑
   */
  private processBurstTimestamps(
    timestamps: BigUint64Array, 
    session: CaptureSession, 
    bursts: any[]
  ): void {
    if (timestamps.length === 0) return;

    // 反转时间戳的低位部分（SysTick计数器递减）
    for (let i = 0; i < timestamps.length; i++) {
      const tt = timestamps[i];
      timestamps[i] = (tt & 0xFF000000n) | (0x00FFFFFFn - (tt & 0x00FFFFFFn));
    }

    // 计算纳秒每样本和每突发
    const nsPerSample = 1000000000.0 / session.frequency;
    const ticksPerSample = nsPerSample / 5;
    const nsPerBurst = nsPerSample * session.postTriggerSamples;
    const ticksPerBurst = nsPerBurst / 5;

    // 调整时间戳以补偿抖动
    for (let i = 1; i < timestamps.length; i++) {
      let top = timestamps[i] < timestamps[i - 1] ? 
        timestamps[i] + 0xFFFFFFFFn : timestamps[i];

      if (Number(top - timestamps[i - 1]) <= ticksPerBurst) {
        const diff = BigInt(ticksPerBurst - Number(top - timestamps[i - 1]) + (ticksPerSample * 2));
        
        for (let j = i; j < timestamps.length; j++) {
          timestamps[j] += diff;
        }
      }
    }

    // 计算延迟
    const delays = new BigUint64Array(timestamps.length - 2);
    for (let i = 2; i < timestamps.length; i++) {
      let top = timestamps[i] < timestamps[i - 1] ? 
        timestamps[i] + 0xFFFFFFFFn : timestamps[i];
      delays[i - 2] = (top - timestamps[i - 1] - BigInt(ticksPerBurst)) * 5n;
    }

    // 创建突发信息
    for (let i = 1; i < timestamps.length; i++) {
      const burstInfo = {
        burstSampleStart: i === 1 ? session.preTriggerSamples : 
          session.preTriggerSamples + (session.postTriggerSamples * (i - 1)),
        burstSampleEnd: session.preTriggerSamples + (session.postTriggerSamples * i),
        burstSampleGap: i === 1 ? 0n : Number(delays[i - 2]) / nsPerSample,
        burstTimeGap: i === 1 ? 0n : delays[i - 2]
      };
      bursts.push(burstInfo);
    }
  }

  /**
   * 提取样本数据到通道
   * 基于C# ExtractSamples方法
   */
  private extractSamplesToChannels(
    session: CaptureSession, 
    captureData: { samples: Uint32Array; timestamps: BigUint64Array; bursts: any[] }
  ): void {
    const { samples } = captureData;
    
    for (let channelIndex = 0; channelIndex < session.captureChannels.length; channelIndex++) {
      const channel = session.captureChannels[channelIndex];
      const mask = 1 << channelIndex;
      
      channel.samples = new Uint8Array(samples.length);
      for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
        channel.samples[sampleIndex] = (samples[sampleIndex] & mask) !== 0 ? 1 : 0;
      }
    }

    // 设置突发信息
    if (captureData.bursts.length > 0) {
      session.bursts = captureData.bursts;
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
        types: [0, 1, 2, 3], // Edge, Complex, Fast, Blast
        maxChannels: this._channelCount,
        patternWidth: 16,
        sequentialSupport: false,
        conditions: ['rising', 'falling', 'high', 'low']
      },
      connectivity: {
        interfaces: this._isNetwork ? ['ethernet'] : ['serial'],
        protocols: ['custom']
      },
      features: {
        voltageMonitoring: true,
        signalGeneration: false
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
