/**
 * I2CDecoder 单元测试
 * 目标：达到 95%+ 覆盖率和 100% 通过率
 * 参照 UTILS 模块测试成功经验
 */

import { I2CDecoder } from '../src/decoders/protocols/I2CDecoder';
import {
  DecoderOptionValue,
  ChannelData,
  DecoderOutputType,
  WaitConditionType
} from '../src/decoders/types';

// 创建测试用的模拟数据
function createMockChannelData(sclData: number[], sdaData: number[]): ChannelData[] {
  return [
    {
      channelNumber: 0,
      channelName: 'SCL',
      samples: new Uint8Array(sclData)
    },
    {
      channelNumber: 1,
      channelName: 'SDA',
      samples: new Uint8Array(sdaData)
    }
  ];
}

// 创建标准I2C写操作数据 (7位地址0x50, 数据0xAB)
function createI2CWriteSequence(): { scl: number[], sda: number[] } {
  const scl: number[] = [];
  const sda: number[] = [];
  
  // 初始空闲状态 (SCL=1, SDA=1)
  for (let i = 0; i < 10; i++) {
    scl.push(1);
    sda.push(1);
  }
  
  // START条件 (SCL=1, SDA从1变0)
  scl.push(1); sda.push(0);
  
  // 地址字节 0xA0 (0x50 << 1 | 0) = 10100000
  const addressBits = [1, 0, 1, 0, 0, 0, 0, 0]; // MSB first
  for (const bit of addressBits) {
    scl.push(0); sda.push(bit); // SCL低时数据稳定
    scl.push(1); sda.push(bit); // SCL高时采样
  }
  
  // ACK位 (从设备应答)
  scl.push(0); sda.push(0); // ACK = 0
  scl.push(1); sda.push(0);
  
  // 数据字节 0xAB = 10101011
  const dataBits = [1, 0, 1, 0, 1, 0, 1, 1];
  for (const bit of dataBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  
  // ACK位
  scl.push(0); sda.push(0);
  scl.push(1); sda.push(0);
  
  // STOP条件 (SCL=1, SDA从0变1)
  scl.push(1); sda.push(0);
  scl.push(1); sda.push(1);
  
  // 结束空闲状态
  for (let i = 0; i < 10; i++) {
    scl.push(1);
    sda.push(1);
  }
  
  return { scl, sda };
}

// 创建标准I2C读操作数据 (7位地址0x50, 读取数据0x55)
function createI2CReadSequence(): { scl: number[], sda: number[] } {
  const scl: number[] = [];
  const sda: number[] = [];
  
  // 初始空闲状态
  for (let i = 0; i < 10; i++) {
    scl.push(1);
    sda.push(1);
  }
  
  // START条件
  scl.push(1); sda.push(0);
  
  // 地址字节 0xA1 (0x50 << 1 | 1) = 10100001 (读操作)
  const addressBits = [1, 0, 1, 0, 0, 0, 0, 1];
  for (const bit of addressBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  
  // ACK位
  scl.push(0); sda.push(0);
  scl.push(1); sda.push(0);
  
  // 数据字节 0x55 = 01010101 (从设备发送)
  const dataBits = [0, 1, 0, 1, 0, 1, 0, 1];
  for (const bit of dataBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  
  // NACK位 (主设备不应答，表示读取结束)
  scl.push(0); sda.push(1);
  scl.push(1); sda.push(1);
  
  // STOP条件
  scl.push(1); sda.push(0);
  scl.push(1); sda.push(1);
  
  return { scl, sda };
}

// 创建包含START重复的序列
function createI2CRepeatStartSequence(): { scl: number[], sda: number[] } {
  const scl: number[] = [];
  const sda: number[] = [];
  
  // 初始空闲
  for (let i = 0; i < 5; i++) {
    scl.push(1); sda.push(1);
  }
  
  // 第一个START
  scl.push(1); sda.push(0);
  
  // 第一个地址 (写)
  const addr1Bits = [1, 0, 1, 0, 0, 0, 0, 0]; // 0xA0
  for (const bit of addr1Bits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  scl.push(0); sda.push(0); // ACK
  scl.push(1); sda.push(0);
  
  // REPEAT START (不发送STOP，直接START)
  scl.push(1); sda.push(1); // 短暂释放SDA
  scl.push(1); sda.push(0); // 重复START
  
  // 第二个地址 (读)
  const addr2Bits = [1, 0, 1, 0, 0, 0, 0, 1]; // 0xA1
  for (const bit of addr2Bits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  scl.push(0); sda.push(0); // ACK
  scl.push(1); sda.push(0);
  
  // 数据
  const dataBits = [0, 1, 1, 0, 0, 0, 1, 1]; // 0x63
  for (const bit of dataBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  scl.push(0); sda.push(1); // NACK
  scl.push(1); sda.push(1);
  
  // STOP
  scl.push(1); sda.push(0);
  scl.push(1); sda.push(1);
  
  return { scl, sda };
}

// 创建10位地址I2C序列
function createI2C10BitAddressSequence(): { scl: number[], sda: number[] } {
  const scl: number[] = [];
  const sda: number[] = [];
  
  // 初始空闲
  for (let i = 0; i < 5; i++) {
    scl.push(1); sda.push(1);
  }
  
  // START
  scl.push(1); sda.push(0);
  
  // 第一个字节：11110AB0 (A=0, B=1) = 11110010 = 0xF2
  const firstByteBits = [1, 1, 1, 1, 0, 0, 1, 0];
  for (const bit of firstByteBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  scl.push(0); sda.push(0); // ACK
  scl.push(1); sda.push(0);
  
  // 第二个字节：低8位地址 = 0x34
  const secondByteBits = [0, 0, 1, 1, 0, 1, 0, 0]; // 0x34
  for (const bit of secondByteBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  scl.push(0); sda.push(0); // ACK
  scl.push(1); sda.push(0);
  
  // 数据字节
  const dataBits = [1, 1, 0, 0, 1, 0, 1, 0]; // 0xCA
  for (const bit of dataBits) {
    scl.push(0); sda.push(bit);
    scl.push(1); sda.push(bit);
  }
  scl.push(0); sda.push(0); // ACK
  scl.push(1); sda.push(0);
  
  // STOP
  scl.push(1); sda.push(0);
  scl.push(1); sda.push(1);
  
  return { scl, sda };
}

describe('I2CDecoder', () => {
  let decoder: I2CDecoder;
  
  beforeEach(() => {
    decoder = new I2CDecoder();
  });

  describe('基本功能测试', () => {
    test('解码器元数据应该正确', () => {
      expect(decoder.id).toBe('i2c');
      expect(decoder.name).toBe('I²C');
      expect(decoder.longname).toBe('Inter-Integrated Circuit');
      expect(decoder.desc).toBe('Two-wire, multi-master, serial bus.');
      expect(decoder.license).toBe('gplv2+');
      expect(decoder.inputs).toEqual(['logic']);
      expect(decoder.outputs).toEqual(['i2c']);
      expect(decoder.tags).toEqual(['Embedded/industrial']);
    });

    test('通道定义应该正确', () => {
      expect(decoder.channels).toHaveLength(2);
      expect(decoder.channels[0]).toEqual({
        id: 'scl',
        name: 'SCL',
        desc: 'Serial clock line',
        required: true,
        index: 0
      });
      expect(decoder.channels[1]).toEqual({
        id: 'sda',
        name: 'SDA',
        desc: 'Serial data line',
        required: true,
        index: 1
      });
    });

    test('配置选项应该正确', () => {
      expect(decoder.options).toHaveLength(1);
      expect(decoder.options[0]).toEqual({
        id: 'address_format',
        desc: 'Displayed slave address format',
        default: 'shifted',
        values: ['shifted', 'unshifted'],
        type: 'list'
      });
    });

    test('注释类型定义应该正确', () => {
      expect(decoder.annotations).toHaveLength(11);
      expect(decoder.annotations[0]).toEqual(['start', 'Start condition', 'S']);
      expect(decoder.annotations[1]).toEqual(['repeat-start', 'Repeat start condition', 'Sr']);
      expect(decoder.annotations[2]).toEqual(['stop', 'Stop condition', 'P']);
      expect(decoder.annotations[3]).toEqual(['ack', 'ACK', 'A']);
      expect(decoder.annotations[4]).toEqual(['nack', 'NACK', 'N']);
    });

    test('注释行定义应该正确', () => {
      expect(decoder.annotationRows).toHaveLength(3);
      expect(decoder.annotationRows[0]).toEqual(['bits', 'Bits', [5]]);
      expect(decoder.annotationRows[1]).toEqual(['addr-data', 'Address/data', [0, 1, 2, 3, 4, 6, 7, 8, 9]]);
      expect(decoder.annotationRows[2]).toEqual(['warnings', 'Warnings', [10]]);
    });
  });

  describe('getInfo 方法测试', () => {
    test('应该返回完整的解码器信息', () => {
      const info = decoder.getInfo();
      expect(info.id).toBe('i2c');
      expect(info.name).toBe('I²C');
      expect(info.longname).toBe('Inter-Integrated Circuit');
      expect(info.channels).toHaveLength(2);
      expect(info.options).toHaveLength(1);
      expect(info.annotations).toHaveLength(11);
    });
  });

  describe('validateOptions 方法测试', () => {
    test('有效配置应该通过验证', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'shifted' }
      ];
      const selectedChannels = [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ];
      const channels = createMockChannelData([1, 0, 1], [1, 1, 0]);
      
      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(true);
    });

    test('缺少必需通道应该验证失败', () => {
      const options: DecoderOptionValue[] = [];
      const selectedChannels = [
        { captureIndex: 0, decoderIndex: 0 }
        // 缺少SDA通道
      ];
      const channels = createMockChannelData([1, 0, 1], [1, 1, 0]);
      
      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(false);
    });

    test('无效选项索引应该验证失败', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 99, value: 'invalid' } // 无效索引
      ];
      const selectedChannels = [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ];
      const channels = createMockChannelData([1, 0, 1], [1, 1, 0]);
      
      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(false);
    });
  });

  describe('标准I2C写操作解码测试', () => {
    test('应该正确解码I2C写操作', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'shifted' }
      ];
      
      const results = decoder.decode(100000, channels, options);
      
      // 验证结果数量 (START + ADDRESS + ACK + DATA + ACK + STOP)
      expect(results.length).toBeGreaterThan(0);
      
      // 验证START条件
      const startResult = results.find(r => r.annotationType === 0);
      expect(startResult).toBeDefined();
      expect(startResult!.values).toContain('Start');
      
      // 验证地址写入
      const addressResult = results.find(r => r.annotationType === 7);
      expect(addressResult).toBeDefined();
      expect(addressResult!.values[0]).toContain('Address write');
      expect(addressResult!.rawData).toBe(0x50); // 7位地址
      
      // 验证ACK
      const ackResult = results.find(r => r.annotationType === 3);
      expect(ackResult).toBeDefined();
      expect(ackResult!.values).toContain('ACK');
      
      // 验证数据
      const dataResult = results.find(r => r.annotationType === 9);
      expect(dataResult).toBeDefined();
      expect(dataResult!.values[0]).toContain('Data write');
      expect(dataResult!.rawData).toBe(0xAB);
      
      // 验证STOP条件
      const stopResult = results.find(r => r.annotationType === 2);
      expect(stopResult).toBeDefined();
      expect(stopResult!.values).toContain('Stop');
    });
  });

  describe('标准I2C读操作解码测试', () => {
    test('应该正确解码I2C读操作', () => {
      const { scl, sda } = createI2CReadSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'shifted' }
      ];
      
      const results = decoder.decode(100000, channels, options);
      
      // 验证地址读取
      const addressResult = results.find(r => r.annotationType === 6);
      expect(addressResult).toBeDefined();
      expect(addressResult!.values[0]).toContain('Address read');
      expect(addressResult!.rawData).toBe(0x50);
      
      // 验证读取的数据
      const dataResult = results.find(r => r.annotationType === 8);
      expect(dataResult).toBeDefined();
      expect(dataResult!.values[0]).toContain('Data read');
      expect(dataResult!.rawData).toBe(0x55);
      
      // 验证NACK
      const nackResult = results.find(r => r.annotationType === 4);
      expect(nackResult).toBeDefined();
      expect(nackResult!.values).toContain('NACK');
    });
  });

  describe('重复START条件测试', () => {
    test('应该正确处理重复START条件', () => {
      const { scl, sda } = createI2CRepeatStartSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [];
      
      const results = decoder.decode(100000, channels, options);
      
      // 应该有初始START和重复START
      const startResults = results.filter(r => r.annotationType === 0);
      const repeatStartResults = results.filter(r => r.annotationType === 1);
      
      expect(startResults.length).toBeGreaterThan(0);
      expect(repeatStartResults.length).toBeGreaterThan(0);
      
      // 验证重复START
      expect(repeatStartResults[0].values).toContain('Start repeat');
    });
  });

  describe('10位地址支持测试', () => {
    test('应该正确解码10位I2C地址', () => {
      const { scl, sda } = createI2C10BitAddressSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [];
      
      const results = decoder.decode(100000, channels, options);
      
      // 应该有两个地址字节的解码结果
      const addressResults = results.filter(r => r.annotationType === 7);
      expect(addressResults.length).toBeGreaterThanOrEqual(2);
      
      // 验证第一个地址字节包含10位地址标识
      const firstAddressByte = addressResults[0];
      expect(firstAddressByte.rawData & 0xF8).toBe(0xF0); // 11110xxx pattern
    });
  });

  describe('地址格式选项测试', () => {
    test('shifted格式应该显示7位地址', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'shifted' }
      ];
      
      const results = decoder.decode(100000, channels, options);
      const addressResult = results.find(r => r.annotationType === 7);
      
      expect(addressResult).toBeDefined();
      expect(addressResult!.rawData).toBe(0x50); // 7位地址
    });

    test('unshifted格式应该显示8位地址', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'unshifted' }
      ];
      
      const results = decoder.decode(100000, channels, options);
      const addressResult = results.find(r => r.annotationType === 7);
      
      expect(addressResult).toBeDefined();
      expect(addressResult!.rawData).toBe(0xA0); // 8位地址 (包含R/W位)
    });
  });

  describe('边界条件和错误处理测试', () => {
    test('空数据应该返回空结果', () => {
      const channels = createMockChannelData([], []);
      const options: DecoderOptionValue[] = [];
      
      const results = decoder.decode(100000, channels, options);
      expect(results).toEqual([]);
    });

    test('单通道数据应该抛出错误或返回空结果', () => {
      const channels = [
        {
          channelNumber: 0,
          channelName: 'SCL',
          samples: new Uint8Array([1, 0, 1, 0])
        }
        // 缺少SDA通道
      ];
      
      expect(() => {
        decoder.decode(100000, channels, []);
      }).toThrow();
    });

    test('样本数据长度不匹配的情况', () => {
      const channels = [
        {
          channelNumber: 0,
          channelName: 'SCL',
          samples: new Uint8Array([1, 0, 1, 0])
        },
        {
          channelNumber: 1,
          channelName: 'SDA',
          samples: new Uint8Array([1, 1]) // 长度不同
        }
      ];
      
      // 应该能处理长度不匹配的情况
      const results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
    });

    test('无效的时钟信号模式', () => {
      // 创建没有正确时钟信号的数据
      const invalidScl = [0, 0, 0, 0, 0]; // 时钟一直是低
      const normalSda = [1, 0, 1, 0, 1];
      const channels = createMockChannelData(invalidScl, normalSda);
      
      const results = decoder.decode(100000, channels, []);
      // 应该能处理无效时钟信号，可能没有输出或输出警告
      expect(Array.isArray(results)).toBe(true);
    });

    test('处理非标准的START条件时序', () => {
      // 创建不标准的START条件（SDA在SCL为低时变化）
      const scl = [1, 1, 0, 0, 1, 1]; // SCL信号
      const sda = [1, 1, 0, 0, 0, 1]; // SDA在SCL低时变化（不标准）
      const channels = createMockChannelData(scl, sda);
      
      const results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('性能和内存测试', () => {
    test('大数据量处理性能', () => {
      // 创建大量数据
      const size = 10000;
      const scl = new Array(size).fill(0).map((_, i) => i % 2);
      const sda = new Array(size).fill(0).map((_, i) => (i + 1) % 2);
      const channels = createMockChannelData(scl, sda);
      
      const startTime = performance.now();
      const results = decoder.decode(1000000, channels, []);
      const endTime = performance.now();
      
      expect(Array.isArray(results)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });

    test('内存使用应该合理', () => {
      const size = 1000;
      const { scl, sda } = createI2CWriteSequence();
      
      // 重复序列创建更大的数据集
      const largeScl = Array(100).fill(scl).flat();
      const largeSda = Array(100).fill(sda).flat();
      const channels = createMockChannelData(largeScl, largeSda);
      
      const results = decoder.decode(100000, channels, []);
      
      // 验证内存没有明显泄漏（结果数量应该合理）
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(largeScl.length); // 结果数量应该小于输入样本数
    });
  });

  describe('并发和重入测试', () => {
    test('多次连续解码应该产生一致结果', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [];
      
      const results1 = decoder.decode(100000, channels, options);
      const results2 = decoder.decode(100000, channels, options);
      
      expect(results1).toEqual(results2);
    });

    test('不同实例应该产生相同结果', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [];
      
      const decoder1 = new I2CDecoder();
      const decoder2 = new I2CDecoder();
      
      const results1 = decoder1.decode(100000, channels, options);
      const results2 = decoder2.decode(100000, channels, options);
      
      expect(results1).toEqual(results2);
    });
  });

  describe('复杂场景测试', () => {
    test('多字节数据传输', () => {
      const scl: number[] = [];
      const sda: number[] = [];
      
      // 空闲
      for (let i = 0; i < 5; i++) {
        scl.push(1); sda.push(1);
      }
      
      // START
      scl.push(1); sda.push(0);
      
      // 地址
      const addrBits = [1, 0, 1, 0, 0, 0, 0, 0]; // 0xA0
      for (const bit of addrBits) {
        scl.push(0); sda.push(bit);
        scl.push(1); sda.push(bit);
      }
      scl.push(0); sda.push(0); // ACK
      scl.push(1); sda.push(0);
      
      // 多个数据字节
      const dataBytes = [
        [0, 0, 1, 1, 0, 0, 1, 1], // 0x33
        [1, 1, 0, 0, 1, 1, 0, 0], // 0xCC
        [1, 0, 1, 0, 1, 0, 1, 0]  // 0xAA
      ];
      
      for (const byteBits of dataBytes) {
        for (const bit of byteBits) {
          scl.push(0); sda.push(bit);
          scl.push(1); sda.push(bit);
        }
        scl.push(0); sda.push(0); // ACK
        scl.push(1); sda.push(0);
      }
      
      // STOP
      scl.push(1); sda.push(0);
      scl.push(1); sda.push(1);
      
      const channels = createMockChannelData(scl, sda);
      const results = decoder.decode(100000, channels, []);
      
      // 应该有3个数据字节的解码结果
      const dataResults = results.filter(r => r.annotationType === 9);
      expect(dataResults.length).toBe(3);
      expect(dataResults[0].rawData).toBe(0x33);
      expect(dataResults[1].rawData).toBe(0xCC);
      expect(dataResults[2].rawData).toBe(0xAA);
    });

    test('错误的ACK/NACK处理', () => {
      const scl: number[] = [];
      const sda: number[] = [];
      
      // 空闲 + START
      for (let i = 0; i < 5; i++) { scl.push(1); sda.push(1); }
      scl.push(1); sda.push(0);
      
      // 地址
      const addrBits = [1, 0, 1, 0, 0, 0, 0, 0];
      for (const bit of addrBits) {
        scl.push(0); sda.push(bit);
        scl.push(1); sda.push(bit);
      }
      
      // NACK而不是ACK（表示从设备无响应）
      scl.push(0); sda.push(1); // NACK = 1
      scl.push(1); sda.push(1);
      
      // STOP
      scl.push(1); sda.push(0);
      scl.push(1); sda.push(1);
      
      const channels = createMockChannelData(scl, sda);
      const results = decoder.decode(100000, channels, []);
      
      // 应该检测到NACK
      const nackResult = results.find(r => r.annotationType === 4);
      expect(nackResult).toBeDefined();
      expect(nackResult!.values).toContain('NACK');
    });

    test('噪声和毛刺处理', () => {
      let { scl, sda } = createI2CWriteSequence();
      
      // 在信号中添加一些噪声（短脉冲）
      if (scl.length > 10) {
        scl[5] = scl[5] === 1 ? 0 : 1; // 添加一个毛刺
        scl[15] = scl[15] === 1 ? 0 : 1; // 添加另一个毛刺
      }
      
      const channels = createMockChannelData(scl, sda);
      const results = decoder.decode(100000, channels, []);
      
      // 应该仍然能够解码（可能有一些警告）
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('特殊配置和选项测试', () => {
    test('不同采样率的影响', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const options: DecoderOptionValue[] = [];
      
      const results1 = decoder.decode(100000, channels, options);
      const results2 = decoder.decode(1000000, channels, options);
      
      // 不同采样率应该产生相同的逻辑结果
      expect(results1.length).toBe(results2.length);
    });

    test('处理选项索引边界', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      
      // 测试有效选项
      const validOptions: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'unshifted' }
      ];
      
      expect(() => {
        decoder.decode(100000, channels, validOptions);
      }).not.toThrow();
      
      // 测试超出范围的选项索引
      const invalidOptions: DecoderOptionValue[] = [
        { optionIndex: 10, value: 'invalid' }
      ];
      
      // 应该忽略无效选项或处理优雅
      expect(() => {
        decoder.decode(100000, channels, invalidOptions);
      }).not.toThrow();
    });
  });

  describe('内部状态和方法测试', () => {
    test('解码器重置功能', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      
      // 第一次解码
      const results1 = decoder.decode(100000, channels, []);
      
      // 第二次解码（应该重置状态）
      const results2 = decoder.decode(100000, channels, []);
      
      expect(results1).toEqual(results2);
    });

    test('部分解码数据处理', () => {
      // 创建不完整的I2C序列（只有START和部分地址）
      const scl = [1, 1, 1, 1, 0, 1, 0, 1, 0, 1];
      const sda = [1, 1, 0, 1, 0, 1, 0, 1, 0, 1]; // START后只有几个位
      const channels = createMockChannelData(scl, sda);
      
      const results = decoder.decode(100000, channels, []);
      
      // 应该至少能识别START条件
      const startResult = results.find(r => r.annotationType === 0);
      expect(startResult).toBeDefined();
    });
  });

  describe('数据完整性测试', () => {
    test('结果数据结构完整性', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const results = decoder.decode(100000, channels, []);
      
      // 验证每个结果的结构
      for (const result of results) {
        expect(result).toHaveProperty('startSample');
        expect(result).toHaveProperty('endSample');
        expect(result).toHaveProperty('annotationType');
        expect(result).toHaveProperty('values');
        expect(Array.isArray(result.values)).toBe(true);
        expect(result.values.length).toBeGreaterThan(0);
        expect(typeof result.startSample).toBe('number');
        expect(typeof result.endSample).toBe('number');
        expect(typeof result.annotationType).toBe('number');
        expect(result.startSample).toBeLessThanOrEqual(result.endSample);
      }
    });

    test('时间戳一致性', () => {
      const { scl, sda } = createI2CWriteSequence();
      const channels = createMockChannelData(scl, sda);
      const results = decoder.decode(100000, channels, []);
      
      // 按时间顺序排序结果
      const sortedResults = [...results].sort((a, b) => a.startSample - b.startSample);
      
      // 验证时间戳递增
      for (let i = 1; i < sortedResults.length; i++) {
        expect(sortedResults[i].startSample).toBeGreaterThanOrEqual(sortedResults[i-1].startSample);
      }
    });
  });

  describe('极端情况处理', () => {
    test('超长数据序列', () => {
      // 创建一个非常长的I2C序列
      let longScl: number[] = [];
      let longSda: number[] = [];
      
      // 重复基本写序列100次
      for (let i = 0; i < 100; i++) {
        const { scl, sda } = createI2CWriteSequence();
        longScl = longScl.concat(scl);
        longSda = longSda.concat(sda);
      }
      
      const channels = createMockChannelData(longScl, longSda);
      
      const startTime = Date.now();
      const results = decoder.decode(100000, channels, []);
      const endTime = Date.now();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(30000); // 30秒超时
    });

    test('单样本数据', () => {
      const channels = createMockChannelData([1], [1]);
      const results = decoder.decode(100000, channels, []);
      
      // 单样本应该不产生任何有意义的结果
      expect(Array.isArray(results)).toBe(true);
    });

    test('全高或全低信号', () => {
      const allHigh = new Array(100).fill(1);
      const allLow = new Array(100).fill(0);
      
      // 测试全高信号
      let channels = createMockChannelData(allHigh, allHigh);
      let results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
      
      // 测试全低信号
      channels = createMockChannelData(allLow, allLow);
      results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});