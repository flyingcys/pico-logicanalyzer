import { AnalyzerDriverBase } from '../../drivers/AnalyzerDriverBase';
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
} from '../../models/AnalyzerTypes';

/**
 * 通用驱动模板
 * 提供基本的驱动结构和实现示例
 * 开发者可以基于此模板快速创建自定义驱动
 */
export class GenericDriverTemplate extends AnalyzerDriverBase {
  // 必需的属性实现
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
    return this._driverType;
  }

  // 私有变量
  private _version: string | null = null;
  private _channelCount: number = 8;
  private _maxFrequency: number = 100000000; // 100MHz
  private _blastFrequency: number = 200000000; // 200MHz
  private _bufferSize: number = 1000000; // 1M samples
  private _isNetwork: boolean = false;
  private _capturing: boolean = false;
  private _driverType: AnalyzerDriverType = AnalyzerDriverType.Serial;
  private _connectionString: string;
  private _isConnected: boolean = false;

  constructor(connectionString: string) {
    super();
    this._connectionString = connectionString;

    // 解析连接字符串，设置设备参数
    this.parseConnectionString(connectionString);
  }

  /**
   * 解析连接字符串
   * 例如：\"COM3\", \"192.168.1.100:5555\", \"usb:vid:pid\"
   */
  private parseConnectionString(connectionString: string): void {
    console.log(`解析连接字符串: ${connectionString}`);

    // 根据实际设备实现连接字符串解析
    if (connectionString.startsWith('tcp://') || connectionString.includes(':')) {
      // 网络设备：tcp://192.168.1.100:5555 或 192.168.1.100:5555
      this._isNetwork = true;
      this._driverType = AnalyzerDriverType.Network;
      
      // 解析网络地址
      const cleanString = connectionString.replace('tcp://', '');
      const [host, portStr] = cleanString.split(':');
      if (host && portStr) {
        const port = parseInt(portStr);
        if (!isNaN(port) && port > 0 && port <= 65535) {
          console.log(`网络设备配置: ${host}:${port}`);
        } else {
          console.warn(`无效的端口号: ${portStr}`);
        }
      }
    } else if (connectionString.startsWith('COM') || connectionString.startsWith('/dev/')) {
      // 串口设备：COM3, COM10, /dev/ttyUSB0, /dev/ttyACM0
      this._isNetwork = false;
      this._driverType = AnalyzerDriverType.Serial;
      console.log(`串口设备配置: ${connectionString}`);
    } else if (connectionString.startsWith('usb:')) {
      // USB设备：usb:vid:pid 或 usb:1234:5678
      this._isNetwork = false;
      this._driverType = AnalyzerDriverType.USB;
      
      const usbParts = connectionString.split(':');
      if (usbParts.length >= 3) {
        const vid = usbParts[1];
        const pid = usbParts[2];
        console.log(`USB设备配置: VID=${vid}, PID=${pid}`);
      }
    } else if (connectionString === 'auto' || connectionString === 'autodetect') {
      // 自动检测模式
      this._driverType = AnalyzerDriverType.Multi;
      console.log('自动检测模式');
    } else {
      // 默认作为串口处理
      this._isNetwork = false;
      this._driverType = AnalyzerDriverType.Serial;
      console.log(`默认串口模式: ${connectionString}`);
    }
  }

  /**
   * 连接设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      console.log(`连接设备: ${this._connectionString}`);

      // 实现实际的设备连接逻辑
      // 1. 建立物理连接（串口、网络等）
      // 2. 发送初始化命令
      // 3. 查询设备信息
      // 4. 验证设备兼容性

      // 示例实现：
      await this.establishConnection(params);
      await this.initializeDevice();
      await this.queryDeviceInfo();

      this._isConnected = true;

      return {
        success: true,
        deviceInfo: {
          name: this._version || 'Generic Logic Analyzer',
          version: this._version ?? undefined,
          type: this._driverType,
          connectionPath: this._connectionString,
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
   * 建立物理连接
   */
  private async establishConnection(params?: ConnectionParams): Promise<void> {
    // 根据设备类型实现连接逻辑
    if (this._isNetwork) {
      // 网络连接实现
      console.log('建立网络连接...');
      
      const cleanString = this._connectionString.replace('tcp://', '');
      const [host, portStr] = cleanString.split(':');
      
      if (!host || !portStr) {
        throw new Error('无效的网络地址格式');
      }
      
      const port = parseInt(portStr);
      if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error('无效的端口号');
      }
      
      // 使用Node.js内置的net模块进行连接
      const net = require('net');
      const socket = new net.Socket();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error(`连接超时: ${host}:${port}`));
        }, 5000);
        
        socket.connect(port, host, () => {
          clearTimeout(timeout);
          console.log(`网络连接建立成功: ${host}:${port}`);
          resolve();
        });
        
        socket.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`网络连接失败: ${error.message}`));
        });
      });
    } else {
      // 串口连接实现
      console.log('建立串口连接...');
      
      // 验证串口路径格式
      if (!this._connectionString) {
        throw new Error('未指定串口路径');
      }
      
      // 模拟串口连接（实际项目中需要使用serialport库）
      // const SerialPort = require('serialport');
      // const port = new SerialPort(this._connectionString, { baudRate: 115200 });
      
      // 验证串口路径是否有效
      const validSerialPatterns = [
        /^COM\d+$/i,           // Windows: COM1, COM10
        /^\/dev\/tty(USB|ACM)\d+$/, // Linux: /dev/ttyUSB0, /dev/ttyACM0
        /^\/dev\/cu\./         // macOS: /dev/cu.usbserial-*
      ];
      
      const isValidPath = validSerialPatterns.some(pattern => 
        pattern.test(this._connectionString)
      );
      
      if (!isValidPath) {
        console.warn(`可能无效的串口路径: ${this._connectionString}`);
      }
      
      // 模拟连接过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`串口连接建立成功: ${this._connectionString}`);
    }
  }

  /**
   * 初始化设备
   */
  private async initializeDevice(): Promise<void> {
    console.log('初始化设备...');

    try {
      // 发送初始化命令序列
      // 1. 重置设备到默认状态
      console.log('发送设备重置命令...');
      // await this.sendCommand('*RST'); // SCPI reset
      
      // 2. 清除错误状态
      console.log('清除设备错误状态...');
      // await this.sendCommand('*CLS'); // Clear status
      
      // 3. 设置默认参数
      console.log('设置默认参数...');
      // await this.sendCommand('SYST:STAT:DEFAULT'); // 设置默认状态
      
      // 4. 启用状态报告
      console.log('启用状态报告...');
      // await this.sendCommand('*SRE 255'); // 启用服务请求
      
      // 5. 设置超时时间
      console.log('配置通信超时...');
      // await this.sendCommand('SYST:COMM:TIMEOUT 5000'); // 5秒超时
      
      // 模拟初始化延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('设备初始化完成');
    } catch (error) {
      console.error('设备初始化失败:', error);
      throw new Error(`设备初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 查询设备信息
   */
  private async queryDeviceInfo(): Promise<void> {
    console.log('查询设备信息...');

    try {
      // 查询设备信息
      // 1. 设备识别信息
      console.log('查询设备识别信息...');
      // const idn = await this.sendCommand('*IDN?');
      // 模拟IDN响应: "Manufacturer,Model,SerialNumber,FirmwareVersion"
      const mockIdn = 'Generic Logic Analyzer,GLA-1000,SN123456789,FW-1.2.3';
      
      // 2. 硬件能力查询
      console.log('查询硬件能力参数...');
      // const capabilities = await this.sendCommand('SYST:CAP?');
      
      // 3. 固件版本查询
      console.log('查询固件版本...');
      // const firmware = await this.sendCommand('SYST:VERS?');
      
      // 解析设备信息
      this.parseDeviceInfo(mockIdn);
      
      console.log('设备信息查询完成');
    } catch (error) {
      console.error('设备信息查询失败:', error);
      // 设置默认值
      this._version = 'Generic Device v1.0';
      this._channelCount = 8;
      this._maxFrequency = 100000000;
    }
  }

  /**
   * 解析设备信息
   */
  private parseDeviceInfo(idn: string): void {
    try {
      const parts = idn.split(',');
      if (parts.length >= 4) {
        const [manufacturer, model, serial, firmware] = parts;
        this._version = `${model} (${firmware})`;
        console.log(`设备: ${manufacturer} ${model}, 序列号: ${serial}, 固件: ${firmware}`);
        
        // 根据型号设置能力参数
        if (model.includes('1000')) {
          this._channelCount = 16;
          this._maxFrequency = 100000000; // 100MHz
          this._bufferSize = 2000000;
        } else {
          this._channelCount = 8;
          this._maxFrequency = 50000000; // 50MHz
          this._bufferSize = 1000000;
        }
      }
    } catch (error) {
      console.warn('解析设备信息失败:', error);
      this._version = 'Generic Device v1.0';
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log('断开设备连接...');

    try {
      // 实现断开连接逻辑
      // 1. 停止当前操作
      if (this._capturing) {
        console.log('停止当前采集操作...');
        await this.stopCapture();
      }

      // 2. 发送断开命令
      console.log('发送断开命令...');
      // await this.sendCommand('SYST:COMM:CLOSE');
      
      // 3. 关闭物理连接
      console.log('关闭物理连接...');
      if (this._isNetwork) {
        // 关闭网络连接
        // this.socket?.destroy();
      } else {
        // 关闭串口连接
        // this.serialPort?.close();
      }
      
      // 4. 清理资源
      console.log('清理连接资源...');
      this.cleanup();
      
      this._isConnected = false;
      console.log('设备断开连接完成');
    } catch (error) {
      console.error('断开连接失败:', error);
      // 即使失败也要标记为断开
      this._isConnected = false;
    }
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    try {
      // TODO: 查询实际设备状态
      // const statusResponse = await this.sendCommand('STATUS?');

      return {
        isConnected: this._isConnected,
        isCapturing: this._capturing,
        batteryVoltage: 'N/A' // 如果设备支持电池，在此查询
        // temperature: await this.getTemperature(),
        // lastError: await this.getLastError()
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

    if (!this._isConnected) {
      return CaptureError.HardwareError;
    }

    try {
      console.log('开始数据采集...');
      this._capturing = true;

      // 设置捕获完成处理器
      if (captureCompletedHandler) {
        this.once('captureCompleted', captureCompletedHandler);
      }

      // TODO: 实现采集逻辑
      // 1. 验证采集参数
      // 2. 配置设备参数
      // 3. 设置触发条件
      // 4. 启动采集
      // 5. 监控采集状态

      const validationError = this.validateCaptureParameters(session);
      if (validationError !== CaptureError.None) {
        this._capturing = false;
        return validationError;
      }

      await this.configureDevice(session);
      await this.startDeviceCapture();
      this.monitorCaptureProgress(session);

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('采集启动失败:', error);
      return CaptureError.UnexpectedError;
    }
  }

  /**
   * 验证采集参数
   */
  private validateCaptureParameters(session: CaptureSession): CaptureError {
    // TODO: 实现参数验证
    // 检查：
    // - 采样频率是否在支持范围内
    // - 通道配置是否有效
    // - 触发参数是否正确
    // - 内存限制是否满足

    if (session.frequency > this._maxFrequency) {
      return CaptureError.BadParams;
    }

    if (session.captureChannels.length === 0) {
      return CaptureError.BadParams;
    }

    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;
    if (totalSamples > this._bufferSize) {
      return CaptureError.BadParams;
    }

    return CaptureError.None;
  }

  /**
   * 配置设备参数
   */
  private async configureDevice(session: CaptureSession): Promise<void> {
    console.log('配置设备参数...');

    // 实现设备配置
    try {
      // 设置采样率
      console.log(`设置采样频率: ${session.frequency} Hz`);
      // await this.sendCommand(`SRATE ${session.frequency}`);
      
      // 配置活动通道
      const channelList = session.captureChannels.map(ch => ch.channelNumber).join(',');
      console.log(`配置采集通道: ${channelList}`);
      // await this.sendCommand(`CHANNELS ${channelList}`);
      
      // 设置触发条件
      if (session.triggerType !== undefined) {
        console.log(`配置触发: 通道${session.triggerChannel}, 类型${session.triggerType}`);
        // await this.configureTrigger(session);
      }
      
      // 配置采样数量
      console.log(`配置采样数量: 前${session.preTriggerSamples}, 后${session.postTriggerSamples}`);
      
      console.log('设备配置完成');
    } catch (error) {
      throw new Error(`设备配置失败: ${error}`);
    }
  }

  /**
   * 启动设备采集
   */
  private async startDeviceCapture(): Promise<void> {
    console.log('启动设备采集...');

    // 发送启动采集命令
    try {
      this.captureStartTime = Date.now();
      console.log('发送采集命令...');
      // await this.sendCommand('INIT');
      // await this.sendCommand('START');
      console.log('采集启动成功');
    } catch (error) {
      throw new Error(`启动采集失败: ${error}`);
    }
  }

  /**
   * 监控采集进度
   */
  private async monitorCaptureProgress(session: CaptureSession): Promise<void> {
    console.log('监控采集进度...');

    // TODO: 实现采集监控
    // 定期检查采集状态，采集完成后读取数据

    const checkInterval = setInterval(async () => {
      try {
        if (!this._capturing) {
          clearInterval(checkInterval);
          return;
        }

        // 检查采集状态
        const isComplete = await this.checkCaptureStatus();
        if (isComplete) {
          clearInterval(checkInterval);
          await this.readCaptureData(session);
        }
      } catch (error) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, `监控采集失败: ${error}`);
      }
    }, 100); // 每100ms检查一次

    // 设置超时保护
    setTimeout(() => {
      if (this._capturing) {
        clearInterval(checkInterval);
        this.handleCaptureError(session, '采集超时');
      }
    }, 30000); // 30秒超时
  }

  /**
   * 检查采集状态
   */
  private async checkCaptureStatus(): Promise<boolean> {
    // TODO: 查询设备采集状态
    // const status = await this.sendCommand('STATUS?');
    // return status.includes('COMPLETE');

    // 模拟采集完成
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 2000);
    });
  }

  /**
   * 读取采集数据
   */
  private async readCaptureData(session: CaptureSession): Promise<void> {
    console.log('读取采集数据...');

    try {
      // TODO: 实现数据读取
      // 1. 读取原始数据
      // 2. 解析数据格式
      // 3. 分配到各个通道
      // 4. 处理时间戳信息

      for (const channel of session.captureChannels) {
        // 示例：读取通道数据
        // const rawData = await this.sendCommand(`DATA? ${channel.channelNumber}`);
        // channel.samples = this.parseChannelData(rawData);

        // 临时生成测试数据
        const sampleCount = session.preTriggerSamples + session.postTriggerSamples;
        channel.samples = new Uint8Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
          channel.samples[i] = Math.random() > 0.5 ? 1 : 0;
        }
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
   * 处理采集错误
   */
  private handleCaptureError(session: CaptureSession, errorMessage: string): void {
    this._capturing = false;
    console.error('采集错误:', errorMessage);

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
      console.log('停止采集...');

      // TODO: 发送停止命令
      // await this.sendCommand('STOP');

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
      console.log('进入引导加载程序模式...');

      // TODO: 实现引导加载程序模式
      // 注意：不是所有设备都支持此功能
      // await this.sendCommand('BOOTLOADER');

      return false; // 默认不支持
    } catch (error) {
      console.error('进入引导加载程序失败:', error);
      return false;
    }
  }

  /**
   * 发送网络配置（如果支持）
   */
  override async sendNetworkConfig(
    accessPointName: string,
    password: string,
    ipAddress: string,
    port: number
  ): Promise<boolean> {
    if (!this._isNetwork) {
      return false; // 非网络设备不支持
    }

    try {
      console.log('发送网络配置...');

      // TODO: 实现网络配置
      // await this.sendCommand(`WIFI_CONFIG ${accessPointName} ${password}`);
      // await this.sendCommand(`NET_CONFIG ${ipAddress} ${port}`);

      return true;
    } catch (error) {
      console.error('网络配置失败:', error);
      return false;
    }
  }

  /**
   * 获取电压状态（如果支持）
   */
  override async getVoltageStatus(): Promise<string> {
    try {
      // TODO: 查询设备电压状态
      // 当实现具体设备查询时，取消注释以下代码：
      // const voltage = await this.sendCommand('VOLTAGE?');
      // return voltage;

      // 默认返回不支持
      return 'N/A';
    // eslint-disable-next-line no-unreachable
    } catch (error) {
      console.error('电压状态查询失败:', error);
      return 'ERROR';
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
        types: [0, 1], // Edge, Complex
        maxChannels: this._channelCount,
        patternWidth: 16,
        sequentialSupport: false,
        conditions: ['rising', 'falling', 'high', 'low']
      },
      connectivity: {
        interfaces: [this._isNetwork ? 'ethernet' : 'usb'],
        protocols: ['custom']
      },
      features: {
        signalGeneration: false,
        powerSupply: false,
        voltageMonitoring: false,
        protocolDecoding: false
      }
    };
  }

  /**
   * 检查采集状态
   */
  private async checkCaptureStatus(): Promise<boolean> {
    try {
      // 查询设备采集状态
      // const status = await this.sendCommand('STATUS?');
      // return status.includes('COMPLETE');
      
      // 模拟采集完成（实际应该查询设备状态）
      const elapsed = Date.now() - this.captureStartTime;
      return elapsed > 2000; // 模拟2秒后完成
    } catch (error) {
      console.error('查询采集状态失败:', error);
      return false;
    }
  }

  /**
   * 读取采集数据
   */
  private async readCaptureData(session: CaptureSession): Promise<void> {
    try {
      // 实现数据读取
      console.log('读取采集数据...');
      // const data = await this.sendCommand('DATA?');
      
      // 模拟生成数据（实际应该从设备读取）
      session.captureChannels.forEach((channel, index) => {
        const sampleCount = session.totalSamples;
        const mockData = new Uint8Array(sampleCount);
        // 生成模拟数据
        for (let i = 0; i < sampleCount; i++) {
          mockData[i] = Math.random() > 0.5 ? 1 : 0;
        }
        channel.samples = mockData;
      });
      
      console.log(`数据读取完成，共${session.totalSamples}个采样点`);
      
      // 触发采集完成事件
      this._capturing = false;
      this.emit('captureCompleted', true, session);
    } catch (error) {
      console.error('读取数据失败:', error);
      this.handleCaptureError(session, `数据读取失败: ${error}`);
    }
  }

  /**
   * 处理采集错误
   */
  private handleCaptureError(session: CaptureSession, errorMessage: string): void {
    console.error('采集错误:', errorMessage);
    this._capturing = false;
    this.emit('captureCompleted', false, session, errorMessage);
  }

  /**
   * 进入引导加载程序模式
   */
  async enterBootloader(): Promise<boolean> {
    try {
      console.log('进入引导加载程序模式...');
      // 实现引导加载程序模式
      // await this.sendCommand('BOOTLOADER');
      console.log('成功进入引导加载程序模式');
      return true;
    } catch (error) {
      console.error('进入引导加载程序模式失败:', error);
      return false;
    }
  }

  /**
   * 发送网络配置
   */
  async sendNetworkConfig(ssid: string, password: string, ip: string, port: number): Promise<boolean> {
    try {
      console.log('发送网络配置...');
      // 实现网络配置
      // await this.sendCommand(`WIFI:SSID "${ssid}"`);
      // await this.sendCommand(`WIFI:PASS "${password}"`);
      // await this.sendCommand(`NET:IP ${ip}`);
      // await this.sendCommand(`NET:PORT ${port}`);
      console.log('网络配置发送成功');
      return true;
    } catch (error) {
      console.error('网络配置失败:', error);
      return false;
    }
  }

  /**
   * 查询电压状态
   */
  async queryVoltageStatus(): Promise<string> {
    try {
      // 查询设备电压状态
      // const voltage = await this.sendCommand('VOLT?');
      // return voltage;
      
      // 模拟电压状态
      return this._isNetwork ? 'N/A' : '4.2V';
    } catch (error) {
      console.error('电压状态查询失败:', error);
      return 'N/A';
    }
  }

  /**
   * 发送命令（辅助方法）
   */
  private async sendCommand(command: string): Promise<string> {
    // 实现实际的命令发送逻辑
    console.log(`发送命令: ${command}`);

    if (!this._isConnected) {
      throw new Error('设备未连接');
    }

    try {
      // 根据连接类型发送命令
      if (this._isNetwork) {
        // 网络命令发送
        // return await this.sendNetworkCommand(command);
      } else {
        // 串口命令发送
        // return await this.sendSerialCommand(command);
      }
      
      // 模拟命令处理延迟
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 模拟不同命令的响应
      if (command === '*IDN?') {
        return 'Generic Logic Analyzer,GLA-1000,SN123456789,FW-1.2.3';
      } else if (command === 'STATUS?') {
        return this._capturing ? 'RUNNING' : 'IDLE';
      } else if (command.startsWith('SRATE')) {
        return 'OK';
      } else {
        return 'OK';
      }
    } catch (error) {
      throw new Error(`命令发送失败: ${error}`);
    }
  }

  /**
   * 资源清理
   */
  override dispose(): void {
    console.log('清理驱动资源...');

    // 清理资源
    try {
      // 断开连接
      if (this._isConnected) {
        this.disconnect().catch(error => {
          console.error('清理时断开连接失败:', error);
        });
      }
      
      // 取消定时器
      if (this.captureMonitorTimer) {
        clearInterval(this.captureMonitorTimer);
        this.captureMonitorTimer = null;
      }
      
      // 清理事件监听器
      this.removeAllListeners();
      
      // 关闭文件句柄（如果有）
      // if (this.logFile) {
      //   this.logFile.close();
      // }
      
      console.log('驱动资源清理完成');
    } catch (error) {
      console.error('清理资源失败:', error);
    }

    super.dispose();
  }

  // 私有属性声明
  private captureMonitorTimer: NodeJS.Timeout | null = null;
  private captureStartTime: number = 0;
  
  // 清理方法
  private cleanup(): void {
    this._capturing = false;
    this.captureStartTime = 0;
    if (this.captureMonitorTimer) {
      clearInterval(this.captureMonitorTimer);
      this.captureMonitorTimer = null;
    }
  }
}
