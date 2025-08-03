/**
 * 信号生成器
 * 为协议解码器测试生成标准的数字信号数据
 */

// 信号生成配置接口
interface SignalConfig {
  sampleRate: number;
  totalSamples: number;
  channelCount: number;
}

interface I2CSignalConfig extends SignalConfig {
  clockChannel: number;
  dataChannel: number;
  address: number;
  isRead: boolean;
  data: number[];
  useStartStop: boolean;
  useRepeatedStart?: boolean;
}

interface SPISignalConfig extends SignalConfig {
  clockChannel: number;
  mosiChannel: number;
  misoChannel: number;
  csChannel: number;
  data: number[];
  clockPolarity: 'idle-low' | 'idle-high';
  clockPhase: 'first-edge' | 'second-edge';
  bitOrder: 'msb-first' | 'lsb-first';
}

interface UARTSignalConfig extends SignalConfig {
  txChannel: number;
  rxChannel?: number;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: 'none' | 'even' | 'odd';
  data: number[];
}

interface AnalogSignalConfig extends SignalConfig {
  channel: number;
  frequency: number;
  amplitude: number;
  offset: number;
  phase: number;
  waveform: 'sine' | 'square' | 'triangle' | 'sawtooth';
}

/**
 * 数字信号生成器
 * 生成各种协议的标准测试信号
 */
export class SignalGenerator {
  /**
   * 生成I2C协议信号
   */
  static generateI2C(config: I2CSignalConfig): Uint8Array[] {
    const { sampleRate, totalSamples, channelCount, clockChannel, dataChannel } = config;
    const channels = Array.from({ length: channelCount }, () => new Uint8Array(totalSamples));
    
    let sampleIndex = 0;
    const samplesPerBit = Math.floor(sampleRate / 100000); // 100kHz I2C
    
    // 初始状态：SCL和SDA都为高
    this._setBitsRange(channels, clockChannel, 0, samplesPerBit, true);
    this._setBitsRange(channels, dataChannel, 0, samplesPerBit, true);
    sampleIndex += samplesPerBit;
    
    if (config.useStartStop) {
      // 生成START条件：SDA从高到低，SCL保持高
      sampleIndex = this._generateI2CStart(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit);
    }
    
    // 生成地址字节 (7位地址 + R/W位)
    const addressByte = (config.address << 1) | (config.isRead ? 1 : 0);
    sampleIndex = this._generateI2CByte(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit, addressByte);
    
    // 生成ACK
    sampleIndex = this._generateI2CAck(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit, true);
    
    // 生成数据字节
    for (const dataByte of config.data) {
      if (config.useRepeatedStart && dataByte === config.data[0] && config.data.length > 1) {
        // 生成重复START条件
        sampleIndex = this._generateI2CRepeatedStart(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit);
      }
      
      sampleIndex = this._generateI2CByte(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit, dataByte);
      sampleIndex = this._generateI2CAck(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit, true);
    }
    
    if (config.useStartStop) {
      // 生成STOP条件：SDA从低到高，SCL保持高
      sampleIndex = this._generateI2CStop(channels, clockChannel, dataChannel, sampleIndex, samplesPerBit);
    }
    
    // 填充剩余样本为高电平
    if (sampleIndex < totalSamples) {
      this._setBitsRange(channels, clockChannel, sampleIndex, totalSamples - sampleIndex, true);
      this._setBitsRange(channels, dataChannel, sampleIndex, totalSamples - sampleIndex, true);
    }
    
    return channels;
  }
  
  /**
   * 生成SPI协议信号
   */
  static generateSPI(config: SPISignalConfig): Uint8Array[] {
    const { sampleRate, totalSamples, channelCount, clockChannel, mosiChannel, misoChannel, csChannel } = config;
    const channels = Array.from({ length: channelCount }, () => new Uint8Array(totalSamples));
    
    let sampleIndex = 0;
    const samplesPerBit = Math.floor(sampleRate / 1000000); // 1MHz SPI
    const clockIdleHigh = config.clockPolarity === 'idle-high';
    const firstEdge = config.clockPhase === 'first-edge';
    
    // 初始状态：CS高，CLK根据极性设置，MOSI/MISO低
    this._setBitsRange(channels, csChannel, 0, totalSamples, true);
    this._setBitsRange(channels, clockChannel, 0, totalSamples, clockIdleHigh);
    this._setBitsRange(channels, mosiChannel, 0, totalSamples, false);
    this._setBitsRange(channels, misoChannel, 0, totalSamples, false);
    
    // 计算SPI传输所需的总时间
    const setupTime = samplesPerBit * 2; // CS拉低前的设置时间
    const bytesTime = config.data.length * samplesPerBit * 8; // 8位每字节
    const holdTime = samplesPerBit * 2; // CS拉高后的保持时间
    const totalTransferTime = setupTime + bytesTime + holdTime;
    
    // 确保有足够的样本空间
    const transferStart = Math.floor((totalSamples - totalTransferTime) / 2);
    sampleIndex = Math.max(transferStart, samplesPerBit);
    
    // CS拉低开始传输 - 保持整个传输期间都为低
    const transferEnd = sampleIndex + bytesTime + samplesPerBit * 4; // 给足够的时间
    this._setBitsRange(channels, csChannel, sampleIndex, transferEnd - sampleIndex, false);
    
    sampleIndex += samplesPerBit; // CS建立时间
    
    // 生成数据字节
    for (let i = 0; i < config.data.length; i++) {
      const mosiData = config.data[i];
      const misoData = config.data[i] ^ 0xAA; // 简单的MISO模拟数据
      
      sampleIndex = this._generateSPIByte(
        channels, clockChannel, mosiChannel, misoChannel,
        sampleIndex, samplesPerBit, mosiData, misoData,
        clockIdleHigh, firstEdge, config.bitOrder === 'msb-first'
      );
    }
    
    sampleIndex += samplesPerBit; // CS保持时间
    
    return channels;
  }
  
  /**
   * 生成UART协议信号
   */
  static generateUART(config: UARTSignalConfig): Uint8Array[] {
    const { sampleRate, totalSamples, channelCount, txChannel, baudRate, dataBits, stopBits, parity } = config;
    const channels = Array.from({ length: channelCount }, () => new Uint8Array(totalSamples));
    
    let sampleIndex = 0;
    const samplesPerBit = Math.floor(sampleRate / baudRate);
    
    // 初始状态：TX线为高（空闲状态）
    this._setBitsRange(channels, txChannel, 0, totalSamples, true);
    if (config.rxChannel !== undefined) {
      this._setBitsRange(channels, config.rxChannel, 0, totalSamples, true);
    }
    
    // 生成每个数据字节
    for (const dataByte of config.data) {
      sampleIndex = this._generateUARTByte(
        channels, txChannel, sampleIndex, samplesPerBit,
        dataByte, dataBits, stopBits, parity
      );
      
      // 字节间间隔
      sampleIndex += samplesPerBit;
    }
    
    return channels;
  }
  
  /**
   * 生成模拟波形信号（用于混合信号测试）
   */
  static generateAnalogWaveform(config: AnalogSignalConfig): Float32Array {
    const { totalSamples, frequency, amplitude, offset, phase, waveform } = config;
    const samples = new Float32Array(totalSamples);
    
    for (let i = 0; i < totalSamples; i++) {
      const t = i / config.sampleRate;
      const angle = 2 * Math.PI * frequency * t + phase;
      
      let value = 0;
      switch (waveform) {
        case 'sine':
          value = Math.sin(angle);
          break;
        case 'square':
          value = Math.sin(angle) >= 0 ? 1 : -1;
          break;
        case 'triangle':
          value = (2 / Math.PI) * Math.asin(Math.sin(angle));
          break;
        case 'sawtooth':
          value = 2 * (angle / (2 * Math.PI) - Math.floor(angle / (2 * Math.PI) + 0.5));
          break;
      }
      
      samples[i] = amplitude * value + offset;
    }
    
    return samples;
  }
  
  /**
   * 生成噪声信号（用于信号质量测试）
   */
  static generateNoise(config: SignalConfig, noiseLevel = 0.1): Uint8Array[] {
    const { channelCount, totalSamples } = config;
    const channels = Array.from({ length: channelCount }, () => new Uint8Array(totalSamples));
    
    for (let ch = 0; ch < channelCount; ch++) {
      for (let i = 0; i < totalSamples; i++) {
        const bit = Math.random() < noiseLevel ? 1 : 0;
        this._setBit(channels, ch, i, bit === 1);
      }
    }
    
    return channels;
  }
  
  /**
   * 生成时钟信号
   */
  static generateClock(config: SignalConfig & { channel: number; frequency: number; dutyCycle?: number }): Uint8Array[] {
    const { channelCount, totalSamples, sampleRate, channel, frequency, dutyCycle = 0.5 } = config;
    const channels = Array.from({ length: channelCount }, () => new Uint8Array(totalSamples));
    
    const samplesPerCycle = Math.floor(sampleRate / frequency);
    const highSamples = Math.floor(samplesPerCycle * dutyCycle);
    
    for (let i = 0; i < totalSamples; i++) {
      const cyclePosition = i % samplesPerCycle;
      const bitValue = cyclePosition < highSamples;
      this._setBit(channels, channel, i, bitValue);
    }
    
    return channels;
  }
  
  // 私有辅助方法
  private static _setBit(channels: Uint8Array[], channel: number, sampleIndex: number, value: boolean): void {
    if (channel >= channels.length || sampleIndex >= channels[channel].length) return;
    
    // 直接设置样本值，每个数组元素代表一个样本
    channels[channel][sampleIndex] = value ? 1 : 0;
  }
  
  private static _setBitsRange(channels: Uint8Array[], channel: number, startIndex: number, count: number, value: boolean): void {
    for (let i = 0; i < count; i++) {
      this._setBit(channels, channel, startIndex + i, value);
    }
  }
  
  private static _generateI2CStart(channels: Uint8Array[], clkCh: number, dataCh: number, startIndex: number, samplesPerBit: number): number {
    let index = startIndex;
    
    // SCL保持高，SDA从高到低
    this._setBitsRange(channels, clkCh, index, samplesPerBit, true);
    this._setBitsRange(channels, dataCh, index, samplesPerBit / 2, true);
    this._setBitsRange(channels, dataCh, index + samplesPerBit / 2, samplesPerBit / 2, false);
    
    return index + samplesPerBit;
  }
  
  private static _generateI2CStop(channels: Uint8Array[], clkCh: number, dataCh: number, startIndex: number, samplesPerBit: number): number {
    let index = startIndex;
    
    // SCL保持高，SDA从低到高
    this._setBitsRange(channels, clkCh, index, samplesPerBit, true);
    this._setBitsRange(channels, dataCh, index, samplesPerBit / 2, false);
    this._setBitsRange(channels, dataCh, index + samplesPerBit / 2, samplesPerBit / 2, true);
    
    return index + samplesPerBit;
  }
  
  private static _generateI2CRepeatedStart(channels: Uint8Array[], clkCh: number, dataCh: number, startIndex: number, samplesPerBit: number): number {
    // 重复START：先将SDA拉高，然后执行START条件
    this._setBitsRange(channels, dataCh, startIndex, samplesPerBit / 2, true);
    return this._generateI2CStart(channels, clkCh, dataCh, startIndex + samplesPerBit / 2, samplesPerBit);
  }
  
  private static _generateI2CByte(channels: Uint8Array[], clkCh: number, dataCh: number, startIndex: number, samplesPerBit: number, data: number): number {
    let index = startIndex;
    
    // 生成8个数据位（MSB优先）
    for (let bit = 7; bit >= 0; bit--) {
      const bitValue = (data >> bit) & 1;
      
      // 时钟低期间设置数据
      this._setBitsRange(channels, clkCh, index, samplesPerBit / 2, false);
      this._setBitsRange(channels, dataCh, index, samplesPerBit / 2, bitValue === 1);
      
      // 时钟高期间保持数据
      this._setBitsRange(channels, clkCh, index + samplesPerBit / 2, samplesPerBit / 2, true);
      this._setBitsRange(channels, dataCh, index + samplesPerBit / 2, samplesPerBit / 2, bitValue === 1);
      
      index += samplesPerBit;
    }
    
    return index;
  }
  
  private static _generateI2CAck(channels: Uint8Array[], clkCh: number, dataCh: number, startIndex: number, samplesPerBit: number, isAck: boolean): number {
    let index = startIndex;
    
    // ACK位：低电平表示ACK，高电平表示NACK
    this._setBitsRange(channels, clkCh, index, samplesPerBit / 2, false);
    this._setBitsRange(channels, dataCh, index, samplesPerBit / 2, !isAck);
    
    this._setBitsRange(channels, clkCh, index + samplesPerBit / 2, samplesPerBit / 2, true);
    this._setBitsRange(channels, dataCh, index + samplesPerBit / 2, samplesPerBit / 2, !isAck);
    
    return index + samplesPerBit;
  }
  
  private static _generateSPIByte(
    channels: Uint8Array[], clkCh: number, mosiCh: number, misoCh: number,
    startIndex: number, samplesPerBit: number, mosiData: number, misoData: number,
    clockIdleHigh: boolean, firstEdge: boolean, msbFirst: boolean
  ): number {
    let index = startIndex;
    
    for (let bit = 0; bit < 8; bit++) {
      const bitIndex = msbFirst ? (7 - bit) : bit;
      const mosiBit = (mosiData >> bitIndex) & 1;
      const misoBit = (misoData >> bitIndex) & 1;
      
      if (firstEdge) {
        // 第一个边沿设置数据
        this._setBitsRange(channels, clkCh, index, samplesPerBit / 2, !clockIdleHigh);
        this._setBitsRange(channels, mosiCh, index, samplesPerBit / 2, mosiBit === 1);
        this._setBitsRange(channels, misoCh, index, samplesPerBit / 2, misoBit === 1);
        
        // 第二个边沿采样数据
        this._setBitsRange(channels, clkCh, index + samplesPerBit / 2, samplesPerBit / 2, clockIdleHigh);
        this._setBitsRange(channels, mosiCh, index + samplesPerBit / 2, samplesPerBit / 2, mosiBit === 1);
        this._setBitsRange(channels, misoCh, index + samplesPerBit / 2, samplesPerBit / 2, misoBit === 1);
      } else {
        // 第一个边沿采样数据
        this._setBitsRange(channels, clkCh, index, samplesPerBit / 2, !clockIdleHigh);
        this._setBitsRange(channels, mosiCh, index, samplesPerBit / 2, mosiBit === 1);
        this._setBitsRange(channels, misoCh, index, samplesPerBit / 2, misoBit === 1);
        
        // 第二个边沿设置数据
        this._setBitsRange(channels, clkCh, index + samplesPerBit / 2, samplesPerBit / 2, clockIdleHigh);
        this._setBitsRange(channels, mosiCh, index + samplesPerBit / 2, samplesPerBit / 2, mosiBit === 1);
        this._setBitsRange(channels, misoCh, index + samplesPerBit / 2, samplesPerBit / 2, misoBit === 1);
      }
      
      index += samplesPerBit;
    }
    
    return index;
  }
  
  private static _generateUARTByte(
    channels: Uint8Array[], txCh: number, startIndex: number, samplesPerBit: number,
    data: number, dataBits: number, stopBits: number, parity: string
  ): number {
    let index = startIndex;
    
    // START位（低电平）
    this._setBitsRange(channels, txCh, index, samplesPerBit, false);
    index += samplesPerBit;
    
    // 数据位（LSB优先）
    let parityBit = 0;
    for (let bit = 0; bit < dataBits; bit++) {
      const bitValue = (data >> bit) & 1;
      this._setBitsRange(channels, txCh, index, samplesPerBit, bitValue === 1);
      index += samplesPerBit;
      
      if (parity !== 'none') {
        parityBit ^= bitValue;
      }
    }
    
    // 奇偶校验位
    if (parity === 'even') {
      this._setBitsRange(channels, txCh, index, samplesPerBit, parityBit === 1);
      index += samplesPerBit;
    } else if (parity === 'odd') {
      this._setBitsRange(channels, txCh, index, samplesPerBit, parityBit === 0);
      index += samplesPerBit;
    }
    
    // STOP位（高电平）
    this._setBitsRange(channels, txCh, index, samplesPerBit * stopBits, true);
    index += samplesPerBit * stopBits;
    
    return index;
  }
}