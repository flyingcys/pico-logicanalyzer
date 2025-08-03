/**
 * 硬件设备模拟器
 * 用于Week 8集成测试，模拟真实的Pico逻辑分析器设备
 * Week 16 增强版本，支持更多协议和测试场景
 */

import { EventEmitter } from 'events';
import { 
  DeviceInfo, 
  CaptureSession, 
  AnalyzerChannel,
  TriggerType,
  CaptureMode 
} from '../../src/models/AnalyzerTypes';

export interface SimulatorConfig {
  deviceName?: string;
  deviceType?: string;
  version?: string;
  channelCount: number;
  maxFrequency?: number;
  maxSampleRate?: number;
  bufferSize?: number;
  networkMode?: boolean;
  responseDelay?: number; // 模拟网络延迟
  supportedProtocols?: string[];
}

export interface NetworkDevice {
  ip: string;
  port: number;
  deviceType: string;
}

export interface I2CDataConfig {
  address: number;
  data: number[];
  operation?: 'read' | 'write';
  addressBits?: 7 | 10;
  frequency?: number;
}

export interface SPIDataConfig {
  mode: number;
  data: number[];
  frequency: number;
  wordSize: number;
}

export interface UARTDataConfig {
  data: string;
  baudRate: number;
  dataBits: number;
  parity: 'none' | 'even' | 'odd';
  stopBits: number;
  frequency: number;
}

export interface TriggerDataConfig {
  channel?: number;
  edge?: 'rising' | 'falling';
  pattern?: number;
  channels?: number[];
  sampleCount: number;  
  channelCount?: number;
}

export class HardwareSimulator extends EventEmitter {
  private config: SimulatorConfig;
  private isConnected: boolean = false;
  private isCapturing: boolean = false;
  private simulatedData: string[] = [];
  private networkDevices: NetworkDevice[] = [];
  private simulationRunning: boolean = false;

  constructor(config?: SimulatorConfig) {
    super();
    this.config = {
      deviceName: 'Mock Pico Logic Analyzer',
      deviceType: 'pico-logic-analyzer',
      version: '1.0.0',
      maxFrequency: 100000000,
      maxSampleRate: 100000000,
      bufferSize: 1000000,
      responseDelay: 50, // 默认50ms延迟
      supportedProtocols: ['I2C', 'SPI', 'UART'],
      ...(config || { channelCount: 24 })
    };
  }

  /**
   * 启动硬件模拟 (Week 16新增)
   */
  async startSimulation(config: SimulatorConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.simulationRunning = true;
    
    // 模拟启动延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 停止硬件模拟 (Week 16新增)
   */
  async stopSimulation(): Promise<void> {
    this.simulationRunning = false;
    this.networkDevices = [];
    
    if (this.isConnected) {
      await this.disconnect();
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * 添加网络设备 (Week 16新增)
   */
  addNetworkDevice(device: NetworkDevice): void {
    this.networkDevices.push(device);
  }

  /**
   * 获取网络设备列表 (Week 16新增)
   */
  getNetworkDevices(): NetworkDevice[] {
    return [...this.networkDevices];
  }

  /**
   * 模拟设备连接
   */
  async connect(): Promise<DeviceInfo> {
    await this.delay(this.config.responseDelay!);
    
    if (this.isConnected) {
      throw new Error('设备已连接');
    }

    this.isConnected = true;
    this.emit('connected');

    return {
      name: this.config.deviceName,
      version: this.config.version,
      channels: this.config.channelCount,
      maxSampleRate: this.config.maxFrequency,
      bufferSize: this.config.bufferSize,
      supportedModes: ['Normal', 'Fast', 'Burst'],
      firmwareVersion: this.config.version,
      hardwareRevision: 'Rev 1.0'
    };
  }

  /**
   * 模拟设备断开
   */
  async disconnect(): Promise<void> {
    await this.delay(10);
    
    if (this.isCapturing) {
      await this.stopCapture();
    }
    
    this.isConnected = false;
    this.emit('disconnected');
  }

  /**
   * 模拟数据采集
   */
  async startCapture(session: CaptureSession): Promise<void> {
    if (!this.isConnected) {
      throw new Error('设备未连接');
    }

    if (this.isCapturing) {
      throw new Error('设备正在采集中');
    }

    await this.delay(this.config.responseDelay!);
    
    this.isCapturing = true;
    this.emit('captureStarted');

    // 模拟采集过程
    setTimeout(async () => {
      await this.generateSimulatedData(session);
      this.isCapturing = false;
      this.emit('captureCompleted', this.simulatedData);
    }, 100 + session.totalSamples / 1000); // 模拟采集时间与样本数相关
  }

  /**
   * 模拟停止采集
   */
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      return;
    }

    await this.delay(10);
    this.isCapturing = false;
    this.emit('captureStopped');
  }

  /**
   * 获取模拟的采集数据
   */
  getLastCaptureData(): string[] {
    return [...this.simulatedData];
  }

  /**
   * 生成模拟的采集数据
   */
  private async generateSimulatedData(session: CaptureSession): Promise<void> {
    const totalSamples = session.totalSamples;
    const enabledChannels = session.captureChannels.filter(ch => ch.enabled);
    
    this.simulatedData = [];

    // 根据触发类型生成不同的模拟数据
    switch (session.triggerType) {
      case TriggerType.Edge:
        this.generateEdgeTriggerData(totalSamples, enabledChannels);
        break;
      case TriggerType.Pattern:
        this.generatePatternTriggerData(totalSamples, enabledChannels);
        break;
      default:
        this.generateRandomData(totalSamples, enabledChannels);
        break;
    }

    // 模拟I2C协议数据（如果启用了前两个通道）
    if (enabledChannels.length >= 2) {
      this.injectI2CProtocolData(totalSamples);
    }

    // 模拟SPI协议数据（如果启用了4个或更多通道）
    if (enabledChannels.length >= 4) {
      this.injectSPIProtocolData(totalSamples);
    }
  }

  /**
   * 生成边沿触发数据
   */
  private generateEdgeTriggerData(totalSamples: number, channels: AnalyzerChannel[]): void {
    const triggerPoint = Math.floor(totalSamples * 0.3); // 触发点在30%位置

    for (let i = 0; i < totalSamples; i++) {
      let sampleValue = BigInt(0);

      channels.forEach(ch => {
        let bitValue = 0;
        
        if (i === triggerPoint && ch.channelIndex === 0) {
          // 在触发点产生上升沿
          bitValue = 1;
        } else if (i > triggerPoint && ch.channelIndex === 0) {
          // 触发后保持高电平
          bitValue = 1;
        } else {
          // 其他通道生成规律模式
          bitValue = ((i >> (ch.channelIndex % 4)) & 1);
        }

        if (bitValue) {
          sampleValue |= BigInt(1) << BigInt(ch.channelIndex);
        }
      });

      this.simulatedData.push(sampleValue.toString(16).padStart(32, '0'));
    }
  }

  /**
   * 生成模式触发数据
   */
  private generatePatternTriggerData(totalSamples: number, channels: AnalyzerChannel[]): void {
    const triggerPattern = 0b1010; // 目标模式
    const triggerPoint = Math.floor(totalSamples * 0.4);

    for (let i = 0; i < totalSamples; i++) {
      let sampleValue = BigInt(0);

      if (i === triggerPoint) {
        // 在触发点生成目标模式
        channels.slice(0, 4).forEach((ch, idx) => {
          if ((triggerPattern >> idx) & 1) {
            sampleValue |= BigInt(1) << BigInt(ch.channelIndex);
          }
        });
      } else {
        // 其他位置生成随机数据
        channels.forEach(ch => {
          if (Math.random() > 0.5) {
            sampleValue |= BigInt(1) << BigInt(ch.channelIndex);
          }
        });
      }

      this.simulatedData.push(sampleValue.toString(16).padStart(32, '0'));
    }
  }

  /**
   * 生成随机数据
   */
  private generateRandomData(totalSamples: number, channels: AnalyzerChannel[]): void {
    for (let i = 0; i < totalSamples; i++) {
      let sampleValue = BigInt(0);

      channels.forEach(ch => {
        // 生成50%概率的随机位
        if (Math.random() > 0.5) {
          sampleValue |= BigInt(1) << BigInt(ch.channelIndex);
        }
      });

      this.simulatedData.push(sampleValue.toString(16).padStart(32, '0'));
    }
  }

  /**
   * 注入I2C协议数据
   */
  private injectI2CProtocolData(totalSamples: number): void {
    const startPos = Math.floor(totalSamples * 0.2);
    const endPos = Math.floor(totalSamples * 0.8);
    
    // 生成I2C事务：START + ADDRESS(0x50) + ACK + DATA(0x42) + ACK + STOP
    const i2cTransaction = this.generateI2CTransaction(0x50, 0x42);
    
    let transactionIndex = 0;
    const transactionLength = i2cTransaction.length;
    const transactionSpacing = Math.floor((endPos - startPos) / 5); // 5个事务

    for (let pos = startPos; pos < endPos && transactionIndex < 5; pos += transactionSpacing) {
      this.injectI2CTransactionAt(pos, i2cTransaction);
      transactionIndex++;
    }
  }

  /**
   * 注入SPI协议数据
   */
  private injectSPIProtocolData(totalSamples: number): void {
    const startPos = Math.floor(totalSamples * 0.1);
    const endPos = Math.floor(totalSamples * 0.9);
    
    // 在通道2-5上生成SPI数据 (CS, CLK, MOSI, MISO)
    const spiData = [0x55, 0xAA, 0xFF, 0x00]; // 测试数据
    
    let currentPos = startPos;
    spiData.forEach(dataByte => {
      this.injectSPIByteAt(currentPos, dataByte);
      currentPos += 200; // 每字节之间的间隔
    });
  }

  /**
   * 生成I2C事务数据
   */
  private generateI2CTransaction(address: number, data: number): Array<{sda: number, scl: number}> {
    const transaction: Array<{sda: number, scl: number}> = [];
    
    // START条件
    transaction.push({sda: 1, scl: 1}); // 空闲
    transaction.push({sda: 0, scl: 1}); // SDA下降沿
    transaction.push({sda: 0, scl: 0}); // 时钟下降
    
    // 发送地址字节 (7位地址 + 1位R/W)
    const addressByte = (address << 1) | 0; // 写操作
    for (let i = 7; i >= 0; i--) {
      const bit = (addressByte >> i) & 1;
      transaction.push({sda: bit, scl: 0}); // 设置数据
      transaction.push({sda: bit, scl: 1}); // 时钟上升
      transaction.push({sda: bit, scl: 0}); // 时钟下降
    }
    
    // ACK
    transaction.push({sda: 0, scl: 0}); // 从设备拉低SDA
    transaction.push({sda: 0, scl: 1}); // 时钟上升
    transaction.push({sda: 0, scl: 0}); // 时钟下降
    
    // 发送数据字节
    for (let i = 7; i >= 0; i--) {
      const bit = (data >> i) & 1;
      transaction.push({sda: bit, scl: 0});
      transaction.push({sda: bit, scl: 1});
      transaction.push({sda: bit, scl: 0});
    }
    
    // ACK
    transaction.push({sda: 0, scl: 0});
    transaction.push({sda: 0, scl: 1});
    transaction.push({sda: 0, scl: 0});
    
    // STOP条件
    transaction.push({sda: 0, scl: 0});
    transaction.push({sda: 0, scl: 1}); // 时钟上升
    transaction.push({sda: 1, scl: 1}); // SDA上升沿
    
    return transaction;
  }

  /**
   * 在指定位置注入I2C事务
   */
  private injectI2CTransactionAt(startPos: number, transaction: Array<{sda: number, scl: number}>): void {
    transaction.forEach((step, index) => {
      const pos = startPos + index;
      if (pos < this.simulatedData.length) {
        let sampleValue = BigInt('0x' + this.simulatedData[pos]);
        
        // 清除SDA和SCL位（通道0和1）
        sampleValue &= ~(BigInt(3));
        
        // 设置新的SDA和SCL值
        if (step.sda) sampleValue |= BigInt(1);
        if (step.scl) sampleValue |= BigInt(2);
        
        this.simulatedData[pos] = sampleValue.toString(16).padStart(32, '0');
      }
    });
  }

  /**
   * 在指定位置注入SPI字节
   */
  private injectSPIByteAt(startPos: number, dataByte: number): void {
    const bitsPerByte = 16; // 每位需要2个时钟周期
    
    // CS拉低
    for (let i = 0; i < bitsPerByte * 8 + 4; i++) {
      const pos = startPos + i;
      if (pos >= this.simulatedData.length) break;
      
      let sampleValue = BigInt('0x' + this.simulatedData[pos]);
      
      // CS=0 (通道2)
      sampleValue &= ~(BigInt(1) << BigInt(2));
      
      if (i >= 2 && i < bitsPerByte * 8 + 2) {
        const bitIndex = Math.floor((i - 2) / bitsPerByte);
        const clockPhase = ((i - 2) % bitsPerByte) < 8;
        
        // CLK (通道3)
        if (clockPhase) {
          sampleValue |= BigInt(1) << BigInt(3);
        } else {
          sampleValue &= ~(BigInt(1) << BigInt(3));
        }
        
        // MOSI (通道4) - 在时钟上升沿设置数据
        if (clockPhase && bitIndex < 8) {
          const bit = (dataByte >> (7 - bitIndex)) & 1;
          if (bit) {
            sampleValue |= BigInt(1) << BigInt(4);
          } else {
            sampleValue &= ~(BigInt(1) << BigInt(4));
          }
        }
        
        // MISO (通道5) - 模拟从设备响应
        if (clockPhase && bitIndex < 8) {
          const responseByte = dataByte ^ 0xFF; // 简单的响应模式
          const bit = (responseByte >> (7 - bitIndex)) & 1;
          if (bit) {
            sampleValue |= BigInt(1) << BigInt(5);
          } else {
            sampleValue &= ~(BigInt(1) << BigInt(5));
          }
        }
      }
      
      this.simulatedData[pos] = sampleValue.toString(16).padStart(32, '0');
    }
  }

  /**
   * 检查设备状态
   */
  getStatus(): {
    connected: boolean;
    capturing: boolean;
    dataSize: number;
    config: SimulatorConfig;
  } {
    return {
      connected: this.isConnected,
      capturing: this.isCapturing,
      dataSize: this.simulatedData.length,
      config: this.config
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 模拟设备错误
   */
  simulateError(errorType: 'connection' | 'capture' | 'timeout'): void {
    switch (errorType) {
      case 'connection':
        this.emit('error', new Error('设备连接错误'));
        break;
      case 'capture':
        this.isCapturing = false;
        this.emit('error', new Error('采集过程中发生错误'));
        break;
      case 'timeout':
        this.emit('error', new Error('设备响应超时'));
        break;
    }
  }

  /**
   * 重置模拟器状态
   */
  reset(): void {
    this.isConnected = false;
    this.isCapturing = false;
    this.simulatedData = [];
    this.removeAllListeners();
  }

  // Week 16 新增的协议数据生成方法

  /**
   * 生成I2C协议数据 (Week 16新增)
   */
  generateI2CData(config: I2CDataConfig): { sda: Uint8Array; scl: Uint8Array } {
    const frequency = config.frequency || 25000000;
    const clockFreq = 100000; // 100kHz I2C时钟
    const samplesPerBit = Math.floor(frequency / clockFreq);
    
    const data: number[] = [];
    const clock: number[] = [];
    
    // 生成START条件
    this.generateI2CStart(data, clock, samplesPerBit);
    
    // 生成地址字节
    const addressByte = config.addressBits === 10 
      ? this.generate10BitAddress(config.address, config.operation === 'read')
      : this.generate7BitAddress(config.address, config.operation === 'read');
    
    for (const addr of addressByte) {
      this.generateI2CByte(data, clock, addr, samplesPerBit);
      this.generateI2CAck(data, clock, samplesPerBit, true); // ACK
    }
    
    // 生成数据字节
    for (const byte of config.data) {
      this.generateI2CByte(data, clock, byte, samplesPerBit);
      this.generateI2CAck(data, clock, samplesPerBit, true); // ACK
    }
    
    // 生成STOP条件
    this.generateI2CStop(data, clock, samplesPerBit);
    
    return {
      sda: new Uint8Array(data),
      scl: new Uint8Array(clock)
    };
  }

  /**
   * 生成SPI协议数据 (Week 16新增)
   */
  generateSPIData(config: SPIDataConfig): { 
    cs: Uint8Array; 
    clk: Uint8Array; 
    mosi: Uint8Array; 
    miso: Uint8Array 
  } {
    const samplesPerBit = Math.floor(25000000 / config.frequency);
    const totalBits = config.data.length * config.wordSize;
    const totalSamples = totalBits * samplesPerBit + 100; // 额外的空闲时间
    
    const cs: number[] = new Array(totalSamples).fill(1);
    const clk: number[] = new Array(totalSamples).fill(0);
    const mosi: number[] = new Array(totalSamples).fill(0);
    const miso: number[] = new Array(totalSamples).fill(0);
    
    // 配置SPI模式
    const cpol = Math.floor(config.mode / 2);
    const cpha = config.mode % 2;
    
    let sampleIndex = 10; // 开始前的空闲时间
    
    // CS拉低开始传输
    for (let i = sampleIndex; i < sampleIndex + totalBits * samplesPerBit; i++) {
      cs[i] = 0;
    }
    
    // 生成时钟和数据
    for (let byteIndex = 0; byteIndex < config.data.length; byteIndex++) {
      const dataByte = config.data[byteIndex];
      const responseByte = (dataByte + 1) & 0xFF; // 模拟从设备回应
      
      for (let bitIndex = 0; bitIndex < config.wordSize; bitIndex++) {
        const bitValue = (dataByte >> (config.wordSize - 1 - bitIndex)) & 1;
        const responseValue = (responseByte >> (config.wordSize - 1 - bitIndex)) & 1;
        
        for (let sample = 0; sample < samplesPerBit; sample++) {
          const clockPhase = sample < samplesPerBit / 2 ? 0 : 1;
          clk[sampleIndex] = cpol ^ clockPhase;
          
          // 根据CPHA设置数据
          if ((cpha === 0 && clockPhase === 0) || (cpha === 1 && clockPhase === 1)) {
            mosi[sampleIndex] = bitValue;
            miso[sampleIndex] = responseValue;
          }
          
          sampleIndex++;
        }
      }
    }
    
    return {
      cs: new Uint8Array(cs),
      clk: new Uint8Array(clk),
      mosi: new Uint8Array(mosi),
      miso: new Uint8Array(miso)
    };
  }

  /**
   * 生成UART协议数据 (Week 16新增)
   */
  generateUARTData(config: UARTDataConfig): { rx: Uint8Array; tx?: Uint8Array } {
    const bitDuration = Math.floor(config.frequency / config.baudRate);
    const data: number[] = [];
    
    // 初始空闲状态
    for (let i = 0; i < bitDuration * 5; i++) {
      data.push(1);
    }
    
    // 为每个字符生成UART帧
    for (const char of config.data) {
      const charCode = char.charCodeAt(0);
      this.generateUARTFrame(data, charCode, config, bitDuration);
    }
    
    // 结束空闲状态
    for (let i = 0; i < bitDuration * 5; i++) {
      data.push(1);
    }
    
    return {
      rx: new Uint8Array(data)
    };
  }

  /**
   * 生成边沿触发数据 (Week 16新增)
   */
  generateEdgeTriggerData(config: TriggerDataConfig): { [key: string]: Uint8Array } {
    const channelCount = 4;
    const channels: { [key: string]: number[] } = {};
    
    for (let ch = 0; ch < channelCount; ch++) {
      channels[`channel${ch}`] = new Array(config.sampleCount).fill(0);
    }
    
    // 在指定通道生成边沿
    const triggerChannel = config.channel || 0;
    const triggerPosition = Math.floor(config.sampleCount / 2);
    
    if (config.edge === 'rising') {
      for (let i = triggerPosition; i < config.sampleCount; i++) {
        channels[`channel${triggerChannel}`][i] = 1;
      }
    } else {
      for (let i = 0; i < triggerPosition; i++) {
        channels[`channel${triggerChannel}`][i] = 1;
      }
    }
    
    // 转换为Uint8Array
    const result: { [key: string]: Uint8Array } = {};
    for (const [key, values] of Object.entries(channels)) {
      result[key] = new Uint8Array(values);
    }
    
    return result;
  }

  /**
   * 生成模式触发数据 (Week 16新增)
   */
  generatePatternTriggerData(config: TriggerDataConfig): { [key: string]: Uint8Array } {
    const channelCount = config.channels?.length || 4;
    const channels: { [key: string]: number[] } = {};
    
    for (let ch = 0; ch < channelCount; ch++) {
      channels[`channel${ch}`] = new Array(config.sampleCount).fill(0);
    }
    
    // 在中间位置生成模式
    const triggerPosition = Math.floor(config.sampleCount / 2);
    const pattern = config.pattern || 0b1010;
    
    for (let i = triggerPosition; i < triggerPosition + 100; i++) {
      if (i < config.sampleCount) {
        for (let ch = 0; ch < channelCount; ch++) {
          const bitValue = (pattern >> ch) & 1;
          channels[`channel${ch}`][i] = bitValue;
        }
      }
    }
    
    const result: { [key: string]: Uint8Array } = {};
    for (const [key, values] of Object.entries(channels)) {
      result[key] = new Uint8Array(values);
    }
    
    return result;
  }

  /**
   * 生成通用触发数据 (Week 16新增)
   */
  generateGenericTriggerData(config: TriggerDataConfig): { [key: string]: Uint8Array } {
    const channelCount = config.channelCount || 4;
    const channels: { [key: string]: number[] } = {};
    
    for (let ch = 0; ch < channelCount; ch++) {
      const data: number[] = [];
      for (let i = 0; i < config.sampleCount; i++) {
        // 生成有规律的测试数据
        data.push((Math.floor(i / 10) + ch) % 2);
      }
      channels[`channel${ch}`] = data;
    }
    
    const result: { [key: string]: Uint8Array } = {};
    for (const [key, values] of Object.entries(channels)) {
      result[key] = new Uint8Array(values);
    }
    
    return result;
  }

  /**
   * 生成大数据集 (Week 16新增)
   */
  generateLargeDataSet(sampleCount: number, channelCount: number): { [key: string]: Uint8Array } {
    const result: { [key: string]: Uint8Array } = {};
    
    for (let ch = 0; ch < channelCount; ch++) {
      const data = new Uint8Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        // 生成伪随机但确定性的数据
        data[i] = (i * (ch + 1)) % 2;
      }
      result[`channel${ch}`] = data;
    }
    
    return result;
  }

  /**
   * 生成随机数据 (Week 16新增)
   */
  generateRandomData(sampleCount: number): Uint8Array {
    const data = new Uint8Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() > 0.5 ? 1 : 0;
    }
    return data;
  }

  /**
   * 生成模式化数据 (Week 16新增)
   */
  generatePatternedData(config: { 
    pattern: number[]; 
    repeat: number; 
    channelCount: number 
  }): { [key: string]: Uint8Array } {
    const result: { [key: string]: Uint8Array } = {};
    const totalSamples = config.pattern.length * config.repeat;
    
    for (let ch = 0; ch < config.channelCount; ch++) {
      const data = new Uint8Array(totalSamples);
      for (let i = 0; i < totalSamples; i++) {
        const patternIndex = i % config.pattern.length;
        // 每个通道有轻微不同的模式
        data[i] = (config.pattern[patternIndex] + ch) % 2;
      }
      result[`channel${ch}`] = data;
    }
    
    return result;
  }

  // 私有辅助方法 (Week 16新增)

  private generateI2CStart(data: number[], clock: number[], samplesPerBit: number): void {
    // SDA从高到低，SCL保持高
    for (let i = 0; i < samplesPerBit; i++) {
      data.push(i < samplesPerBit / 2 ? 1 : 0);
      clock.push(1);
    }
  }

  private generateI2CStop(data: number[], clock: number[], samplesPerBit: number): void {
    // SDA从低到高，SCL保持高
    for (let i = 0; i < samplesPerBit; i++) {
      data.push(i < samplesPerBit / 2 ? 0 : 1);
      clock.push(1);
    }
  }

  private generateI2CByte(data: number[], clock: number[], byte: number, samplesPerBit: number): void {
    for (let bit = 7; bit >= 0; bit--) {
      const bitValue = (byte >> bit) & 1;
      
      // 每个位包含时钟的低电平和高电平
      for (let i = 0; i < samplesPerBit; i++) {
        data.push(bitValue);
        clock.push(i < samplesPerBit / 2 ? 0 : 1);
      }
    }
  }

  private generateI2CAck(data: number[], clock: number[], samplesPerBit: number, ack: boolean): void {
    for (let i = 0; i < samplesPerBit; i++) {
      data.push(ack ? 0 : 1); // ACK=0, NACK=1
      clock.push(i < samplesPerBit / 2 ? 0 : 1);
    }
  }

  private generate7BitAddress(address: number, read: boolean): number[] {
    return [(address << 1) | (read ? 1 : 0)];
  }

  private generate10BitAddress(address: number, read: boolean): number[] {
    const highByte = 0xF0 | ((address >> 7) & 0x06) | (read ? 1 : 0);
    const lowByte = address & 0xFF;
    return [highByte, lowByte];
  }

  private generateUARTFrame(
    data: number[], 
    charCode: number, 
    config: UARTDataConfig, 
    bitDuration: number
  ): void {
    // 起始位
    for (let i = 0; i < bitDuration; i++) {
      data.push(0);
    }
    
    // 数据位 (LSB first)
    for (let bit = 0; bit < config.dataBits; bit++) {
      const bitValue = (charCode >> bit) & 1;
      for (let i = 0; i < bitDuration; i++) {
        data.push(bitValue);
      }
    }
    
    // 奇偶校验位
    if (config.parity !== 'none') {
      const parityBit = this.calculateParity(charCode, config.dataBits, config.parity);
      for (let i = 0; i < bitDuration; i++) {
        data.push(parityBit);
      }
    }
    
    // 停止位
    for (let stop = 0; stop < config.stopBits; stop++) {
      for (let i = 0; i < bitDuration; i++) {
        data.push(1);
      }
    }
  }

  private calculateParity(value: number, dataBits: number, parity: 'even' | 'odd'): number {
    let count = 0;
    for (let i = 0; i < dataBits; i++) {
      if ((value >> i) & 1) count++;
    }
    
    if (parity === 'even') {
      return count % 2;
    } else {
      return (count + 1) % 2;
    }
  }
}