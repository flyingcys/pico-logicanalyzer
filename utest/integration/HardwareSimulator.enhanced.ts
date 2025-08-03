/**
 * 增强版硬件模拟器
 * 支持Week 16全面集成测试的所有功能
 */

export interface SimulationConfig {
  deviceType: string;
  channelCount: number;
  maxSampleRate: number;
  supportedProtocols: string[];
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

export class HardwareSimulator {
  private simulationRunning: boolean = false;
  private networkDevices: NetworkDevice[] = [];
  private config: SimulationConfig | null = null;

  /**
   * 启动硬件模拟
   */
  async startSimulation(config: SimulationConfig): Promise<void> {
    this.config = config;
    this.simulationRunning = true;
    
    // 模拟启动延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 停止硬件模拟
   */
  async stopSimulation(): Promise<void> {
    this.simulationRunning = false;
    this.networkDevices = [];
    this.config = null;
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  /**
   * 添加网络设备
   */
  addNetworkDevice(device: NetworkDevice): void {
    this.networkDevices.push(device);
  }

  /**
   * 获取网络设备列表
   */
  getNetworkDevices(): NetworkDevice[] {
    return [...this.networkDevices];
  }

  /**
   * 生成I2C协议数据
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
   * 生成SPI协议数据
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
   * 生成UART协议数据
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
   * 生成边沿触发数据
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
   * 生成模式触发数据
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
   * 生成通用触发数据
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
   * 生成大数据集
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
   * 生成随机数据
   */
  generateRandomData(sampleCount: number): Uint8Array {
    const data = new Uint8Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() > 0.5 ? 1 : 0;
    }
    return data;
  }

  /**
   * 生成模式化数据
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

  // 私有辅助方法

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