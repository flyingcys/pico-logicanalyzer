/**
 * 测试Mock工具和数据生成器
 * 为解码器测试提供模拟数据和工具类
 */

export interface SignalState {
  [channel: string]: number;
}

/**
 * 信号生成器 - 用于生成测试信号数据
 */
export class SignalGenerator {
  private samples: number[] = [];
  private currentTime = 0;
  
  constructor(private sampleRate: number = 24000000) {}
  
  /**
   * 添加信号状态
   */
  addState(state: SignalState, durationUs: number): this {
    const samplesCount = Math.floor((durationUs * this.sampleRate) / 1000000);
    
    for (let i = 0; i < samplesCount; i++) {
      let sample = 0;
      Object.entries(state).forEach(([channel, value]) => {
        const channelNum = parseInt(channel.replace('ch', ''));
        if (value) {
          sample |= (1 << channelNum);
        }
      });
      this.samples.push(sample);
    }
    
    this.currentTime += durationUs;
    return this;
  }
  
  /**
   * 生成I2C写操作序列
   */
  generateI2CWrite(address: number, data: number[]): this {
    // START条件
    this.addState({ ch0: 1, ch1: 1 }, 1) // SCL=1, SDA=1
        .addState({ ch0: 1, ch1: 0 }, 1) // SDA下降沿
        .addState({ ch0: 0, ch1: 0 }, 1); // SCL下降沿
    
    // 地址字节 (7位地址 + 1位读写位)
    const addressByte = (address << 1) | 0; // 写操作
    this.generateI2CByte(addressByte);
    this.generateI2CAck();
    
    // 数据字节
    data.forEach(byte => {
      this.generateI2CByte(byte);
      this.generateI2CAck();
    });
    
    // STOP条件
    this.addState({ ch0: 0, ch1: 0 }, 1) // SCL=0, SDA=0
        .addState({ ch0: 1, ch1: 0 }, 1) // SCL上升沿
        .addState({ ch0: 1, ch1: 1 }, 1); // SDA上升沿
    
    return this;
  }
  
  /**
   * 生成I2C字节（MSB first）
   */
  private generateI2CByte(byte: number): void {
    for (let bit = 7; bit >= 0; bit--) {
      const bitValue = (byte >> bit) & 1;
      this.addState({ ch0: 0, ch1: bitValue }, 1) // 设置数据
          .addState({ ch0: 1, ch1: bitValue }, 1) // SCL上升沿
          .addState({ ch0: 0, ch1: bitValue }, 1); // SCL下降沿
    }
  }
  
  /**
   * 生成I2C ACK
   */
  private generateI2CAck(): void {
    this.addState({ ch0: 0, ch1: 0 }, 1) // SDA低电平（ACK）
        .addState({ ch0: 1, ch1: 0 }, 1) // SCL上升沿
        .addState({ ch0: 0, ch1: 0 }, 1); // SCL下降沿
  }
  
  /**
   * 生成SPI传输数据
   */
  generateSPI(mosiData: number[], misoData: number[], mode: number = 0): this {
    const cpol = (mode & 2) ? 1 : 0; // 时钟极性
    const cpha = (mode & 1) ? 1 : 0; // 时钟相位
    
    // CS下降沿
    this.addState({ ch0: cpol, ch1: 0, ch2: 0, ch3: 1 }, 1); // CLK, MOSI, MISO, CS
    
    mosiData.forEach((mosiByte, index) => {
      const misoByte = misoData[index] || 0;
      
      for (let bit = 7; bit >= 0; bit--) {
        const mosiBit = (mosiByte >> bit) & 1;
        const misoBit = (misoByte >> bit) & 1;
        
        if (cpha === 0) {
          // CPHA=0: 在时钟上升沿采样
          this.addState({ ch0: cpol, ch1: mosiBit, ch2: misoBit, ch3: 0 }, 1)
              .addState({ ch0: 1-cpol, ch1: mosiBit, ch2: misoBit, ch3: 0 }, 1)
              .addState({ ch0: cpol, ch1: mosiBit, ch2: misoBit, ch3: 0 }, 1);
        } else {
          // CPHA=1: 在时钟下降沿采样
          this.addState({ ch0: 1-cpol, ch1: mosiBit, ch2: misoBit, ch3: 0 }, 1)
              .addState({ ch0: cpol, ch1: mosiBit, ch2: misoBit, ch3: 0 }, 1);
        }
      }
    });
    
    // CS上升沿
    this.addState({ ch0: cpol, ch1: 0, ch2: 0, ch3: 1 }, 1);
    
    return this;
  }
  
  /**
   * 生成UART数据帧
   */
  generateUART(data: number[], baudRate: number = 9600, config: { dataBits?: number; parity?: string; stopBits?: number } = {}): this {
    const { dataBits = 8, parity = 'none', stopBits = 1 } = config;
    const bitDurationUs = 1000000 / baudRate;
    
    data.forEach(byte => {
      // 起始位
      this.addState({ ch0: 0 }, bitDurationUs);
      
      // 数据位
      for (let bit = 0; bit < dataBits; bit++) {
        const bitValue = (byte >> bit) & 1;
        this.addState({ ch0: bitValue }, bitDurationUs);
      }
      
      // 校验位
      if (parity !== 'none') {
        let parityBit = 0;
        if (parity === 'even') {
          let count = 0;
          for (let bit = 0; bit < dataBits; bit++) {
            if (byte & (1 << bit)) count++;
          }
          parityBit = count % 2;
        } else if (parity === 'odd') {
          let count = 0;
          for (let bit = 0; bit < dataBits; bit++) {
            if (byte & (1 << bit)) count++;
          }
          parityBit = 1 - (count % 2);
        }
        this.addState({ ch0: parityBit }, bitDurationUs);
      }
      
      // 停止位
      for (let i = 0; i < stopBits; i++) {
        this.addState({ ch0: 1 }, bitDurationUs);
      }
    });
    
    return this;
  }
  
  /**
   * 获取生成的样本数据
   */
  getSamples(): number[] {
    return [...this.samples];
  }
  
  /**
   * 清空数据
   */
  clear(): this {
    this.samples = [];
    this.currentTime = 0;
    return this;
  }
}

/**
 * 测试工具类
 */
export class TestUtils {
  /**
   * 创建AnalyzerChannel数据
   */
  static createAnalyzerChannel(channelIndex: number, samples: number[]) {
    return {
      channelIndex,
      samples,
      name: `Channel ${channelIndex}`,
      enabled: true
    };
  }
  
  /**
   * 创建解码器选项
   */
  static createDecoderOptions(options: { [key: string]: any }) {
    return Object.entries(options).map(([key, value], index) => ({
      optionIndex: index,
      optionName: key,
      optionValue: value
    }));
  }
  
  /**
   * 验证解码结果的基本结构
   */
  static validateDecoderResult(result: any): boolean {
    return result &&
      typeof result.startSample === 'number' &&
      typeof result.endSample === 'number' &&
      Array.isArray(result.annotations) &&
      result.startSample >= 0 &&
      result.endSample >= result.startSample;
  }
}

/**
 * 测试场景构建器
 */
export class TestScenarioBuilder {
  private scenarios: any[] = [];
  
  /**
   * 添加I2C测试场景
   */
  addI2CScenario(name: string, address: number, data: number[]): this {
    const generator = new SignalGenerator();
    generator.generateI2CWrite(address, data);
    
    this.scenarios.push({
      name,
      type: 'i2c',
      samples: generator.getSamples(),
      expected: {
        address,
        data,
        operations: ['start', 'address', 'data', 'stop']
      }
    });
    
    return this;
  }
  
  /**
   * 添加SPI测试场景
   */
  addSPIScenario(name: string, mosiData: number[], misoData: number[], mode: number = 0): this {
    const generator = new SignalGenerator();
    generator.generateSPI(mosiData, misoData, mode);
    
    this.scenarios.push({
      name,
      type: 'spi',
      samples: generator.getSamples(),
      expected: {
        mosiData,
        misoData,
        mode
      }
    });
    
    return this;
  }
  
  /**
   * 添加UART测试场景
   */
  addUARTScenario(name: string, data: number[], config: any = {}): this {
    const generator = new SignalGenerator();
    generator.generateUART(data, 9600, config);
    
    this.scenarios.push({
      name,
      type: 'uart',
      samples: generator.getSamples(),
      expected: {
        data,
        config
      }
    });
    
    return this;
  }
  
  /**
   * 获取所有场景
   */
  getScenarios(): any[] {
    return [...this.scenarios];
  }
  
  /**
   * 清空场景
   */
  clear(): this {
    this.scenarios = [];
    return this;
  }
}

/**
 * Mock解码器基类
 */
export class MockDecoderBase {
  protected outputResults: any[] = [];
  
  put(startSample: number, endSample: number, annotations: any[]): void {
    this.outputResults.push({
      startSample,
      endSample,
      annotations
    });
  }
  
  getResults(): any[] {
    return [...this.outputResults];
  }
  
  reset(): void {
    this.outputResults = [];
  }
}

export default {
  SignalGenerator,
  TestUtils,
  TestScenarioBuilder,
  MockDecoderBase
};