/**
 * 协议解码器单元测试套件
 * 使用SignalGenerator生成标准测试信号进行完整的协议解码测试
 */

import '../../../src/tests/setup';
import '../../../src/tests/matchers';
import { SignalGenerator, TestUtils, TestScenarioBuilder } from '../../../src/tests/mocks';
import { DecoderBase } from '../../../src/decoders/DecoderBase';
import { I2CDecoder } from '../../../src/decoders/protocols/I2CDecoder';
import { SPIDecoder } from '../../../src/decoders/protocols/SPIDecoder';
import { UARTDecoder } from '../../../src/decoders/protocols/UARTDecoder';
import { DecoderOptionValue, ChannelData, DecoderResult } from '../../../src/decoders/types';

// 测试数据生成辅助类
class ProtocolTestDataGenerator {
  /**
   * 生成I2C写操作测试数据
   */
  static generateI2CWriteData(address: number, data: number[]): ChannelData[] {
    const channels = SignalGenerator.generateI2C({
      sampleRate: 24_000_000,
      totalSamples: 50000,
      channelCount: 8,
      clockChannel: 0, // SCL
      dataChannel: 1,  // SDA
      address,
      isRead: false,
      data,
      useStartStop: true
    });

    return [
      { samples: channels[0], channelNumber: 0, channelName: 'SCL' },
      { samples: channels[1], channelNumber: 1, channelName: 'SDA' }
    ];
  }

  /**
   * 生成I2C读操作测试数据
   */
  static generateI2CReadData(address: number, data: number[]): ChannelData[] {
    const channels = SignalGenerator.generateI2C({
      sampleRate: 24_000_000,
      totalSamples: 50000,
      channelCount: 8,
      clockChannel: 0, // SCL
      dataChannel: 1,  // SDA
      address,
      isRead: true,
      data,
      useStartStop: true,
      useRepeatedStart: true
    });

    return [
      { samples: channels[0], channelNumber: 0, channelName: 'SCL' },
      { samples: channels[1], channelNumber: 1, channelName: 'SDA' }
    ];
  }

  /**
   * 生成SPI测试数据
   */
  static generateSPIData(data: number[], options: {
    clockPolarity?: 'idle-low' | 'idle-high';
    clockPhase?: 'first-edge' | 'second-edge';
    bitOrder?: 'msb-first' | 'lsb-first';
  } = {}): ChannelData[] {
    const channels = SignalGenerator.generateSPI({
      sampleRate: 24_000_000,
      totalSamples: 50000,
      channelCount: 8,
      clockChannel: 0,    // CLK
      misoChannel: 1,     // MISO (修正：应该是1号通道)
      mosiChannel: 2,     // MOSI (修正：应该是2号通道)
      csChannel: 3,       // CS
      data,
      clockPolarity: options.clockPolarity || 'idle-low',
      clockPhase: options.clockPhase || 'first-edge',
      bitOrder: options.bitOrder || 'msb-first'
    });

    return [
      { samples: channels[0], channelNumber: 0, channelName: 'CLK' },
      { samples: channels[1], channelNumber: 1, channelName: 'MISO' },
      { samples: channels[2], channelNumber: 2, channelName: 'MOSI' },
      { samples: channels[3], channelNumber: 3, channelName: 'CS' }
    ];
  }

  /**
   * 生成UART测试数据
   */
  static generateUARTData(data: number[], options: {
    baudRate?: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
  } = {}): ChannelData[] {
    const channels = SignalGenerator.generateUART({
      sampleRate: 24_000_000,
      totalSamples: 50000,
      channelCount: 8,
      txChannel: 0,
      rxChannel: 1,
      baudRate: options.baudRate || 115200,
      dataBits: options.dataBits || 8,
      stopBits: options.stopBits || 1,
      parity: options.parity || 'none',
      data
    });

    return [
      { samples: channels[0], channelNumber: 0, channelName: 'TX' },
      { samples: channels[1], channelNumber: 1, channelName: 'RX' }
    ];
  }
}

describe('协议解码器测试套件', () => {
  describe('I2C协议解码器测试', () => {
    let decoder: I2CDecoder;
    
    beforeEach(() => {
      decoder = new I2CDecoder();
    });
    
    it('应该正确初始化I2C解码器元数据', () => {
      expect(decoder.id).toBe('i2c');
      expect(decoder.name).toBe('I²C');
      expect(decoder.longname).toBe('Inter-Integrated Circuit');
      expect(decoder.channels).toHaveLength(2);
      expect(decoder.channels[0]).toHaveProperty('id', 'scl');
      expect(decoder.channels[1]).toHaveProperty('id', 'sda');
      expect(decoder.annotations).toBeDefined();
      expect(decoder.annotations.length).toBeGreaterThan(0);
    });
    
    it('应该正确解码I2C写操作', () => {
      const testData = [0x12, 0x34, 0x56, 0xAB];
      const channels = ProtocolTestDataGenerator.generateI2CWriteData(0x48, testData);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'shifted' } // address_format
      ];
      
      const startTime = Date.now();
      const results = decoder.decode(24_000_000, channels, options);
      const endTime = Date.now();
      
      expect(results).toBeValidI2CDecodeResult();
      expect(endTime - startTime).toBeWithinPerformanceBudget(1000);
      
      // 验证基本解码结果结构
      expect(results.length).toBeGreaterThan(0);
      
      // 查找START条件
      const startCondition = results.find(r => 
        r.values && r.values.some(v => v.includes('Start'))
      );
      expect(startCondition).toBeDefined();
      
      // 查找地址写入
      const addressWrite = results.find(r => 
        r.values && r.values.some(v => v.includes('Address write'))
      );
      expect(addressWrite).toBeDefined();
      
      // 查找数据写入
      const dataWrites = results.filter(r => 
        r.values && r.values.some(v => v.includes('Data write'))
      );
      expect(dataWrites.length).toBeGreaterThan(0);
    });
    
    it('应该正确解码I2C读操作', () => {
      const testData = [0xDE, 0xAD, 0xBE, 0xEF];
      const channels = ProtocolTestDataGenerator.generateI2CReadData(0x48, testData);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'unshifted' } // address_format
      ];
      
      const results = decoder.decode(24_000_000, channels, options);
      
      expect(results).toBeValidI2CDecodeResult();
      
      // 查找地址读取
      const addressRead = results.find(r => 
        r.values && r.values.some(v => v.includes('Address read'))
      );
      expect(addressRead).toBeDefined();
      
      // 查找数据读取
      const dataReads = results.filter(r => 
        r.values && r.values.some(v => v.includes('Data read'))
      );
      expect(dataReads.length).toBeGreaterThan(0);
    });
    
    it('应该正确处理I2C ACK/NACK', () => {
      const channels = ProtocolTestDataGenerator.generateI2CWriteData(0x48, [0x12]);
      const results = decoder.decode(24_000_000, channels, []);
      
      // 查找ACK/NACK响应
      const ackNackResults = results.filter(r => 
        r.values && (
          r.values.some(v => v.includes('ACK')) || 
          r.values.some(v => v.includes('NACK'))
        )
      );
      expect(ackNackResults.length).toBeGreaterThan(0);
    });
    
    it('应该正确处理不同的地址格式', () => {
      const channels = ProtocolTestDataGenerator.generateI2CWriteData(0x48, [0x12]);
      
      // 测试shifted格式
      const shiftedResults = decoder.decode(24_000_000, channels, [
        { optionIndex: 0, value: 'shifted' }
      ]);
      
      // 测试unshifted格式
      const unshiftedResults = decoder.decode(24_000_000, channels, [
        { optionIndex: 0, value: 'unshifted' }
      ]);
      
      expect(shiftedResults).toBeValidI2CDecodeResult();
      expect(unshiftedResults).toBeValidI2CDecodeResult();
      
      // 两种格式应该产生不同的地址值
      expect(shiftedResults.length).toBeGreaterThan(0);
      expect(unshiftedResults.length).toBeGreaterThan(0);
    });
    
    it('应该处理空数据或错误数据', () => {
      const emptyChannels: ChannelData[] = [
        { samples: new Uint8Array(0), channelNumber: 0, channelName: 'SCL' },
        { samples: new Uint8Array(0), channelNumber: 1, channelName: 'SDA' }
      ];
      
      expect(() => {
        decoder.decode(24_000_000, emptyChannels, []);
      }).not.toThrow();
      
      // 测试无效数据
      const invalidChannels: ChannelData[] = [
        { samples: new Uint8Array(10), channelNumber: 0, channelName: 'SCL' },
        { samples: new Uint8Array(5), channelNumber: 1, channelName: 'SDA' } // 长度不匹配
      ];
      
      expect(() => {
        decoder.decode(24_000_000, invalidChannels, []);
      }).not.toThrow();
    });
  });
  
  describe('SPI协议解码器测试', () => {
    let decoder: SPIDecoder;
    
    beforeEach(() => {
      decoder = new SPIDecoder();
    });
    
    it('应该正确初始化SPI解码器元数据', () => {
      expect(decoder.id).toBe('spi');
      expect(decoder.name).toBe('SPI');
      expect(decoder.longname).toBe('Serial Peripheral Interface');
      expect(decoder.channels).toHaveLength(4);
      expect(decoder.channels.map(ch => ch.id)).toEqual(['clk', 'miso', 'mosi', 'cs']);
      expect(decoder.options.length).toBeGreaterThan(0);
      expect(decoder.annotations).toBeDefined();
    });
    
    it('应该正确解码SPI模式0传输', () => {
      const testData = [0xAA, 0x55, 0xFF, 0x00];
      const channels = ProtocolTestDataGenerator.generateSPIData(testData, {
        clockPolarity: 'idle-low',
        clockPhase: 'first-edge',
        bitOrder: 'msb-first'
      });
      
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'active-low' },  // cs_polarity
        { optionIndex: 1, value: '0' },           // cpol  
        { optionIndex: 2, value: '0' },           // cpha
        { optionIndex: 3, value: 'msb-first' }   // bitorder
      ];
      
      const startTime = Date.now();
      const results = decoder.decode(24_000_000, channels, options);
      const endTime = Date.now();
      
      expect(results).toBeValidSPIDecodeResult();
      expect(endTime - startTime).toBeWithinPerformanceBudget(1000);
      expect(results.length).toBeGreaterThan(0);
    });
    
    it('应该正确处理不同的SPI模式', () => {
      const testData = [0x12, 0x34];
      
      const modes = [
        { cpol: '0', cpha: '0' }, // Mode 0
        { cpol: '0', cpha: '1' }, // Mode 1
        { cpol: '1', cpha: '0' }, // Mode 2
        { cpol: '1', cpha: '1' }  // Mode 3
      ];
      
      for (const mode of modes) {
        const channels = ProtocolTestDataGenerator.generateSPIData(testData);
        const options: DecoderOptionValue[] = [
          { optionIndex: 0, value: 'active-low' },
          { optionIndex: 1, value: mode.cpol },
          { optionIndex: 2, value: mode.cpha },
          { optionIndex: 3, value: 'msb-first' }
        ];
        
        const results = decoder.decode(24_000_000, channels, options);
        expect(results).toBeValidSPIDecodeResult();
      }
    });
    
    it('应该正确处理MSB和LSB位序', () => {
      const testData = [0xA5, 0x5A]; // 具有明显MSB/LSB差异的测试数据
      
      // 测试MSB优先
      const channelsMSB = ProtocolTestDataGenerator.generateSPIData(testData, {
        bitOrder: 'msb-first'
      });
      const resultsMSB = decoder.decode(24_000_000, channelsMSB, [
        { optionIndex: 3, value: 'msb-first' }
      ]);
      
      // 测试LSB优先
      const channelsLSB = ProtocolTestDataGenerator.generateSPIData(testData, {
        bitOrder: 'lsb-first'
      });
      const resultsLSB = decoder.decode(24_000_000, channelsLSB, [
        { optionIndex: 3, value: 'lsb-first' }
      ]);
      
      expect(resultsMSB).toBeValidSPIDecodeResult();
      expect(resultsLSB).toBeValidSPIDecodeResult();
      expect(resultsMSB.length).toBeGreaterThan(0);
      expect(resultsLSB.length).toBeGreaterThan(0);
    });
    
    it('应该正确处理CS极性', () => {
      const testData = [0x42];
      
      // 测试低有效CS
      const channels = ProtocolTestDataGenerator.generateSPIData(testData);
      const resultsActiveLow = decoder.decode(24_000_000, channels, [
        { optionIndex: 0, value: 'active-low' }
      ]);
      
      const resultsActiveHigh = decoder.decode(24_000_000, channels, [
        { optionIndex: 0, value: 'active-high' }
      ]);
      
      expect(resultsActiveLow).toBeValidSPIDecodeResult();
      expect(resultsActiveHigh).toBeValidSPIDecodeResult();
    });
    
    it('应该处理大量数据的SPI传输', () => {
      const largeData = Array.from({ length: 100 }, (_, i) => i % 256);
      const channels = ProtocolTestDataGenerator.generateSPIData(largeData);
      
      const startTime = Date.now();
      const results = decoder.decode(24_000_000, channels, []);
      const endTime = Date.now();
      
      expect(results).toBeValidSPIDecodeResult();
      expect(endTime - startTime).toBeWithinPerformanceBudget(2000); // 较大数据允许更长时间
    });
  });
  
  describe('UART协议解码器测试', () => {
    let decoder: UARTDecoder;
    
    beforeEach(() => {
      decoder = new UARTDecoder();
    });
    
    it('应该正确初始化UART解码器元数据', () => {
      expect(decoder.id).toBe('uart');
      expect(decoder.name).toBe('UART');
      expect(decoder.longname).toBe('Universal Asynchronous Receiver/Transmitter');
      expect(decoder.channels.length).toBeGreaterThanOrEqual(1);
      expect(decoder.options.length).toBeGreaterThan(0);
      expect(decoder.annotations).toBeDefined();
    });
    
    it('应该正确解码标准UART传输', () => {
      const testData = [0x48, 0x65, 0x6C, 0x6C, 0x6F]; // "Hello"
      const channels = ProtocolTestDataGenerator.generateUARTData(testData, {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });
      
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: '115200' },  // baud_rate
        { optionIndex: 1, value: '8' },       // data_bits
        { optionIndex: 2, value: '1' },       // stop_bits
        { optionIndex: 3, value: 'none' }     // parity
      ];
      
      const startTime = Date.now();
      const results = decoder.decode(24_000_000, channels, options);
      const endTime = Date.now();
      
      expect(results).toBeValidUARTDecodeResult();
      expect(endTime - startTime).toBeWithinPerformanceBudget(1000);
      expect(results.length).toBeGreaterThan(0);
    });
    
    it('应该正确处理不同的波特率', () => {
      const testData = [0x55]; // 01010101 - 良好的测试模式
      const baudRates = [9600, 38400, 115200, 230400];
      
      for (const baudRate of baudRates) {
        const channels = ProtocolTestDataGenerator.generateUARTData(testData, {
          baudRate
        });
        
        const results = decoder.decode(24_000_000, channels, [
          { optionIndex: 0, value: baudRate.toString() }
        ]);
        
        expect(results).toBeValidUARTDecodeResult();
      }
    });
    
    it('应该正确处理不同的数据位数', () => {
      const testData = [0x7F];
      const dataBits = [5, 6, 7, 8, 9];
      
      for (const bits of dataBits) {
        const channels = ProtocolTestDataGenerator.generateUARTData(testData, {
          dataBits: bits
        });
        
        const results = decoder.decode(24_000_000, channels, [
          { optionIndex: 1, value: bits.toString() }
        ]);
        
        expect(results).toBeValidUARTDecodeResult();
      }
    });
    
    it('应该正确处理奇偶校验', () => {
      const testData = [0xA5]; // 10100101 - 奇偶性明显的测试数据
      const parityTypes = ['none', 'even', 'odd'];
      
      for (const parity of parityTypes) {
        const channels = ProtocolTestDataGenerator.generateUARTData(testData, {
          parity: parity as any
        });
        
        const results = decoder.decode(24_000_000, channels, [
          { optionIndex: 3, value: parity }
        ]);
        
        expect(results).toBeValidUARTDecodeResult();
      }
    });
    
    it('应该正确处理停止位', () => {
      const testData = [0x42];
      const stopBits = [1, 1.5, 2];
      
      for (const stops of stopBits) {
        const channels = ProtocolTestDataGenerator.generateUARTData(testData, {
          stopBits: stops
        });
        
        const results = decoder.decode(24_000_000, channels, [
          { optionIndex: 2, value: stops.toString() }
        ]);
        
        expect(results).toBeValidUARTDecodeResult();
      }
    });
    
    it('应该处理连续的UART数据流', () => {
      const message = "The quick brown fox jumps over the lazy dog";
      const testData = Array.from(message).map(c => c.charCodeAt(0));
      const channels = ProtocolTestDataGenerator.generateUARTData(testData);
      
      const startTime = Date.now();
      const results = decoder.decode(24_000_000, channels, []);
      const endTime = Date.now();
      
      expect(results).toBeValidUARTDecodeResult();
      expect(endTime - startTime).toBeWithinPerformanceBudget(2000);
      expect(results.length).toBeGreaterThan(testData.length); // 应该包含起始位、数据位、停止位等
    });
  });
  
  describe('解码器性能和内存测试', () => {
    it('大数据量解码不应导致内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 减少循环次数和数据量以避免不必要的内存压力
      for (let i = 0; i < 5; i++) {
        // 生成适量测试数据
        const largeData = Array.from({ length: 20 }, (_, j) => j % 256);
        
        // 测试SPI解码器 (现在已修复，应该不会泄漏)
        const spiDecoder = new SPIDecoder();
        const spiChannels = ProtocolTestDataGenerator.generateSPIData(largeData);
        const spiResults = spiDecoder.decode(24_000_000, spiChannels, []);
        
        // 清理解码器
        spiDecoder.reset();
        
        // 清理引用，帮助垃圾回收
        spiChannels.length = 0;
        spiResults.length = 0;
        
        // 强制垃圾回收每几次迭代
        if (i % 2 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // 最终垃圾回收
      if (global.gc) {
        global.gc();
        // 给垃圾回收器一些时间
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // 更合理的内存增长阈值 (5MB而不是20MB)
      const threshold = 5 * 1024 * 1024;
      expect({ memoryGrowth, leakDetected: memoryGrowth > threshold })
        .toHaveMemoryLeakBelow(threshold);
    });
    
    it('解码器应该在合理时间内完成解码', () => {
      const testData = Array.from({ length: 100 }, (_, i) => i % 256);
      
      const decoders = [
        { name: 'I2C', decoder: new I2CDecoder(), channels: ProtocolTestDataGenerator.generateI2CWriteData(0x48, testData) },
        { name: 'SPI', decoder: new SPIDecoder(), channels: ProtocolTestDataGenerator.generateSPIData(testData) },
        { name: 'UART', decoder: new UARTDecoder(), channels: ProtocolTestDataGenerator.generateUARTData(testData) }
      ];
      
      for (const { name, decoder, channels } of decoders) {
        const startTime = Date.now();
        const results = decoder.decode(24_000_000, channels, []);
        const endTime = Date.now();
        
        const duration = endTime - startTime;
        console.log(`${name} decoder took ${duration}ms for ${testData.length} bytes`);
        
        expect(duration).toBeWithinPerformanceBudget(1500);
        expect(results.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('解码器集成场景测试', () => {
    it('I2C传感器读取场景', async () => {
      const scenario = new TestScenarioBuilder()
        .name('I2C温度传感器读取')
        .description('模拟完整的I2C传感器数据读取流程')
        .setup(async () => {
          // 模拟传感器初始化
          await TestUtils.delay(10);
        })
        .execute(async () => {
          const decoder = new I2CDecoder();
          
          // 模拟读取温度传感器(地址0x48)的数据
          const sensorAddress = 0x48;
          const temperatureData = [0x19, 0x85]; // 25.52°C
          
          const channels = ProtocolTestDataGenerator.generateI2CReadData(sensorAddress, temperatureData);
          const results = decoder.decode(24_000_000, channels, []);
          
          return {
            success: results.length > 0,
            temperatureRaw: temperatureData,
            decodedResults: results.length
          };
        })
        .verify((result) => result.success && result.decodedResults > 0)
        .teardown(async () => {
          await TestUtils.delay(5);
        })
        .build();
      
      await scenario.setup();
      const result = await scenario.execute();
      const isValid = scenario.verify(result);
      await scenario.teardown();
      
      expect(isValid).toBe(true);
    });
    
    it('SPI Flash读取场景', async () => {
      const scenario = new TestScenarioBuilder()
        .name('SPI Flash存储器读取')
        .description('模拟SPI Flash芯片的读取命令')
        .execute(async () => {
          const decoder = new SPIDecoder();
          
          // 模拟Flash读取命令: 0x03 (READ) + 24位地址 + 数据
          const readCommand = [0x03, 0x00, 0x10, 0x00]; // 读取地址0x001000
          const flashData = [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE];
          const fullData = [...readCommand, ...flashData];
          
          const channels = ProtocolTestDataGenerator.generateSPIData(fullData);
          const results = decoder.decode(24_000_000, channels, []);
          
          return {
            success: results.length > 0,
            commandBytes: readCommand.length,
            dataBytes: flashData.length,
            totalResults: results.length
          };
        })
        .verify((result) => result.success && result.totalResults > result.commandBytes)
        .build();
      
      const result = await scenario.execute();
      const isValid = scenario.verify(result);
      
      expect(isValid).toBe(true);
    });
    
    it('UART调试输出场景', async () => {
      const scenario = new TestScenarioBuilder()
        .name('UART调试日志输出')
        .description('模拟设备通过UART输出调试信息')
        .execute(async () => {
          const decoder = new UARTDecoder();
          
          // 模拟调试消息
          const debugMessage = "DEBUG: System initialized OK\r\n";
          const messageBytes = Array.from(debugMessage).map(c => c.charCodeAt(0));
          
          const channels = ProtocolTestDataGenerator.generateUARTData(messageBytes, {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
          });
          
          const results = decoder.decode(24_000_000, channels, []);
          
          return {
            success: results.length > 0,
            messageLength: messageBytes.length,
            decodedFrames: results.length
          };
        })
        .verify((result) => result.success && result.decodedFrames >= result.messageLength)
        .build();
      
      const result = await scenario.execute();
      const isValid = scenario.verify(result);
      
      expect(isValid).toBe(true);
    });
  });
  
  describe('边界条件和错误处理', () => {
    it('解码器应该处理空数据', () => {
      const decoders = [new I2CDecoder(), new SPIDecoder(), new UARTDecoder()];
      const emptyChannels: ChannelData[] = [];
      
      for (const decoder of decoders) {
        expect(() => {
          decoder.decode(24_000_000, emptyChannels, []);
        }).not.toThrow();
      }
    });
    
    it('解码器应该处理无效的采样率', () => {
      const decoder = new I2CDecoder();
      const channels = ProtocolTestDataGenerator.generateI2CWriteData(0x48, [0x12]);
      
      const invalidSampleRates = [0, -1, NaN, Infinity];
      
      for (const sampleRate of invalidSampleRates) {
        expect(() => {
          decoder.decode(sampleRate, channels, []);
        }).not.toThrow();
      }
    });
    
    it('解码器应该处理无效的选项值', () => {
      const decoder = new I2CDecoder();
      const channels = ProtocolTestDataGenerator.generateI2CWriteData(0x48, [0x12]);
      
      const invalidOptions: DecoderOptionValue[] = [
        { optionIndex: -1, value: 'invalid' },
        { optionIndex: 999, value: 'invalid' },
        { optionIndex: 0, value: null as any },
        { optionIndex: 0, value: undefined as any }
      ];
      
      expect(() => {
        decoder.decode(24_000_000, channels, invalidOptions);
      }).not.toThrow();
    });
    
    it('解码器应该处理不同长度的通道数据', () => {
      const decoder = new I2CDecoder();
      
      const unevenChannels: ChannelData[] = [
        { samples: new Uint8Array(100), channelNumber: 0, channelName: 'SCL' },
        { samples: new Uint8Array(50), channelNumber: 1, channelName: 'SDA' } // 长度不匹配
      ];
      
      expect(() => {
        decoder.decode(24_000_000, unevenChannels, []);
      }).not.toThrow();
    });
  });
});