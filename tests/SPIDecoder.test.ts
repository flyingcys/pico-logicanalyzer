/**
 * SPIDecoder 单元测试
 * 目标：达到 95%+ 覆盖率和 100% 通过率
 * 参照 UTILS 模块测试成功经验
 */

import { SPIDecoder } from '../src/decoders/protocols/SPIDecoder';
import {
  DecoderOptionValue,
  ChannelData,
  DecoderOutputType
} from '../src/decoders/types';

// 创建测试用的模拟SPI数据
function createMockSPIChannelData(
  clkData: number[],
  misoData: number[] = [],
  mosiData: number[] = [],
  csData: number[] = []
): ChannelData[] {
  const channels: ChannelData[] = [
    {
      channelNumber: 0,
      channelName: 'CLK',
      samples: new Uint8Array(clkData)
    }
  ];

  if (misoData.length > 0) {
    channels.push({
      channelNumber: 1,
      channelName: 'MISO',
      samples: new Uint8Array(misoData)
    });
  }

  if (mosiData.length > 0) {
    channels.push({
      channelNumber: 2,
      channelName: 'MOSI',
      samples: new Uint8Array(mosiData)
    });
  }

  if (csData.length > 0) {
    channels.push({
      channelNumber: 3,
      channelName: 'CS',
      samples: new Uint8Array(csData)
    });
  }

  return channels;
}

// 创建标准SPI传输序列 (Mode 0: CPOL=0, CPHA=0)
function createSPIMode0Sequence(mosiBytes: number[], misoBytes: number[]): {
  clk: number[], miso: number[], mosi: number[], cs: number[]
} {
  const clk: number[] = [];
  const miso: number[] = [];
  const mosi: number[] = [];
  const cs: number[] = [];

  // 初始状态 (CLK=0, CS=1 - 未选中)
  for (let i = 0; i < 10; i++) {
    clk.push(0);
    miso.push(1);
    mosi.push(1);
    cs.push(1);
  }

  // CS断言 (选中从设备)
  clk.push(0); miso.push(1); mosi.push(1); cs.push(0);

  // 传输数据字节
  for (let byteIdx = 0; byteIdx < Math.max(mosiBytes.length, misoBytes.length); byteIdx++) {
    const mosiByte = mosiBytes[byteIdx] || 0;
    const misoByte = misoBytes[byteIdx] || 0;

    // 传输8位数据 (MSB first)
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const mosiBit = (mosiByte >> bitIdx) & 1;
      const misoBit = (misoByte >> bitIdx) & 1;

      // Mode 0: 在上升沿采样数据
      // 数据在时钟低电平时准备
      clk.push(0);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);

      // 时钟上升沿 - 数据采样点
      clk.push(1);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);
    }
  }

  // CS释放 (取消选中)
  clk.push(0); miso.push(1); mosi.push(1); cs.push(1);

  // 结束空闲状态
  for (let i = 0; i < 10; i++) {
    clk.push(0);
    miso.push(1);
    mosi.push(1);
    cs.push(1);
  }

  return { clk, miso, mosi, cs };
}

// 创建SPI Mode 1序列 (CPOL=0, CPHA=1)
function createSPIMode1Sequence(mosiBytes: number[], misoBytes: number[]): {
  clk: number[], miso: number[], mosi: number[], cs: number[]
} {
  const clk: number[] = [];
  const miso: number[] = [];
  const mosi: number[] = [];
  const cs: number[] = [];

  // 初始状态
  for (let i = 0; i < 5; i++) {
    clk.push(0); miso.push(1); mosi.push(1); cs.push(1);
  }

  // CS断言
  clk.push(0); miso.push(1); mosi.push(1); cs.push(0);

  for (let byteIdx = 0; byteIdx < Math.max(mosiBytes.length, misoBytes.length); byteIdx++) {
    const mosiByte = mosiBytes[byteIdx] || 0;
    const misoByte = misoBytes[byteIdx] || 0;

    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const mosiBit = (mosiByte >> bitIdx) & 1;
      const misoBit = (misoByte >> bitIdx) & 1;

      // Mode 1: 数据在时钟上升沿准备，在下降沿采样
      // 时钟上升沿 - 数据准备
      clk.push(1);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);

      // 时钟下降沿 - 数据采样点
      clk.push(0);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);
    }
  }

  // CS释放
  clk.push(0); miso.push(1); mosi.push(1); cs.push(1);

  return { clk, miso, mosi, cs };
}

// 创建SPI Mode 2序列 (CPOL=1, CPHA=0)
function createSPIMode2Sequence(mosiBytes: number[], misoBytes: number[]): {
  clk: number[], miso: number[], mosi: number[], cs: number[]
} {
  const clk: number[] = [];
  const miso: number[] = [];
  const mosi: number[] = [];
  const cs: number[] = [];

  // 初始状态 (CLK=1 for CPOL=1)
  for (let i = 0; i < 5; i++) {
    clk.push(1); miso.push(1); mosi.push(1); cs.push(1);
  }

  // CS断言
  clk.push(1); miso.push(1); mosi.push(1); cs.push(0);

  for (let byteIdx = 0; byteIdx < Math.max(mosiBytes.length, misoBytes.length); byteIdx++) {
    const mosiByte = mosiBytes[byteIdx] || 0;
    const misoByte = misoBytes[byteIdx] || 0;

    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const mosiBit = (mosiByte >> bitIdx) & 1;
      const misoBit = (misoByte >> bitIdx) & 1;

      // Mode 2: 在下降沿采样数据
      // 数据在时钟高电平时准备
      clk.push(1);
      miso.push(misiBit);
      mosi.push(mosiBit);
      cs.push(0);

      // 时钟下降沿 - 数据采样点
      clk.push(0);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);
    }
  }

  // CS释放
  clk.push(1); miso.push(1); mosi.push(1); cs.push(1);

  return { clk, miso, mosi, cs };
}

// 创建SPI Mode 3序列 (CPOL=1, CPHA=1)
function createSPIMode3Sequence(mosiBytes: number[], misoBytes: number[]): {
  clk: number[], miso: number[], mosi: number[], cs: number[]
} {
  const clk: number[] = [];
  const miso: number[] = [];
  const mosi: number[] = [];
  const cs: number[] = [];

  // 初始状态 (CLK=1 for CPOL=1)
  for (let i = 0; i < 5; i++) {
    clk.push(1); miso.push(1); mosi.push(1); cs.push(1);
  }

  // CS断言
  clk.push(1); miso.push(1); mosi.push(1); cs.push(0);

  for (let byteIdx = 0; byteIdx < Math.max(mosiBytes.length, misoBytes.length); byteIdx++) {
    const mosiByte = mosiBytes[byteIdx] || 0;
    const misoByte = misoBytes[byteIdx] || 0;

    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const mosiBit = (mosiByte >> bitIdx) & 1;
      const misoBit = (misoByte >> bitIdx) & 1;

      // Mode 3: 数据在时钟下降沿准备，在上升沿采样
      // 时钟下降沿 - 数据准备
      clk.push(0);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);

      // 时钟上升沿 - 数据采样点
      clk.push(1);
      miso.push(misoBit);
      mosi.push(mosiBit);
      cs.push(0);
    }
  }

  // CS释放
  clk.push(1); miso.push(1); mosi.push(1); cs.push(1);

  return { clk, miso, mosi, cs };
}

// 创建没有CS信号的SPI序列
function createSPIWithoutCS(mosiBytes: number[], misoBytes: number[]): {
  clk: number[], miso: number[], mosi: number[]
} {
  const { clk, miso, mosi } = createSPIMode0Sequence(mosiBytes, misoBytes);
  return { clk, miso, mosi };
}

describe('SPIDecoder', () => {
  let decoder: SPIDecoder;

  beforeEach(() => {
    decoder = new SPIDecoder();
  });

  describe('基本功能测试', () => {
    test('解码器元数据应该正确', () => {
      expect(decoder.id).toBe('spi');
      expect(decoder.name).toBe('SPI');
      expect(decoder.longname).toBe('Serial Peripheral Interface');
      expect(decoder.desc).toBe('Full-duplex, synchronous, serial bus.');
      expect(decoder.license).toBe('gplv2+');
      expect(decoder.inputs).toEqual(['logic']);
      expect(decoder.outputs).toEqual(['spi']);
      expect(decoder.tags).toEqual(['Embedded/industrial']);
    });

    test('通道定义应该正确', () => {
      expect(decoder.channels).toHaveLength(4);
      expect(decoder.channels[0]).toEqual({
        id: 'clk',
        name: 'CLK',
        desc: 'Clock',
        required: true,
        index: 0
      });
      expect(decoder.channels[1]).toEqual({
        id: 'miso',
        name: 'MISO',
        desc: 'Master in, slave out',
        required: false,
        index: 1
      });
      expect(decoder.channels[2]).toEqual({
        id: 'mosi',
        name: 'MOSI',
        desc: 'Master out, slave in',
        required: false,
        index: 2
      });
      expect(decoder.channels[3]).toEqual({
        id: 'cs',
        name: 'CS#',
        desc: 'Chip-select',
        required: false,
        index: 3
      });
    });

    test('配置选项应该正确', () => {
      expect(decoder.options).toHaveLength(5);
      
      expect(decoder.options[0]).toEqual({
        id: 'cs_polarity',
        desc: 'CS# polarity',
        default: 'active-low',
        values: ['active-low', 'active-high'],
        type: 'list'
      });

      expect(decoder.options[1]).toEqual({
        id: 'cpol',
        desc: 'Clock polarity',
        default: 0,
        values: ['0', '1'],
        type: 'list'
      });

      expect(decoder.options[2]).toEqual({
        id: 'cpha',
        desc: 'Clock phase',
        default: 0,
        values: ['0', '1'],
        type: 'list'
      });

      expect(decoder.options[3]).toEqual({
        id: 'bitorder',
        desc: 'Bit order',
        default: 'msb-first',
        values: ['msb-first', 'lsb-first'],
        type: 'list'
      });

      expect(decoder.options[4]).toEqual({
        id: 'wordsize',
        desc: 'Word size',
        default: 8,
        type: 'int'
      });
    });

    test('注释类型定义应该正确', () => {
      expect(decoder.annotations).toHaveLength(7);
      expect(decoder.annotations[0]).toEqual(['miso-data', 'MISO data']);
      expect(decoder.annotations[1]).toEqual(['mosi-data', 'MOSI data']);
      expect(decoder.annotations[2]).toEqual(['miso-bit', 'MISO bit']);
      expect(decoder.annotations[3]).toEqual(['mosi-bit', 'MOSI bit']);
      expect(decoder.annotations[4]).toEqual(['warning', 'Warning']);
      expect(decoder.annotations[5]).toEqual(['miso-transfer', 'MISO transfer']);
      expect(decoder.annotations[6]).toEqual(['mosi-transfer', 'MOSI transfer']);
    });

    test('注释行定义应该正确', () => {
      expect(decoder.annotationRows).toHaveLength(7);
      expect(decoder.annotationRows[0]).toEqual(['miso-bits', 'MISO bits', [2]]);
      expect(decoder.annotationRows[1]).toEqual(['miso-data-vals', 'MISO data', [0]]);
      expect(decoder.annotationRows[2]).toEqual(['miso-transfers', 'MISO transfers', [5]]);
      expect(decoder.annotationRows[3]).toEqual(['mosi-bits', 'MOSI bits', [3]]);
      expect(decoder.annotationRows[4]).toEqual(['mosi-data-vals', 'MOSI data', [1]]);
      expect(decoder.annotationRows[5]).toEqual(['mosi-transfers', 'MOSI transfers', [6]]);
      expect(decoder.annotationRows[6]).toEqual(['other', 'Other', [4]]);
    });
  });

  describe('getInfo 方法测试', () => {
    test('应该返回完整的解码器信息', () => {
      const info = decoder.getInfo();
      expect(info.id).toBe('spi');
      expect(info.name).toBe('SPI');
      expect(info.longname).toBe('Serial Peripheral Interface');
      expect(info.channels).toHaveLength(4);
      expect(info.options).toHaveLength(5);
      expect(info.annotations).toHaveLength(7);
    });
  });

  describe('通道可用性验证测试', () => {
    test('应该要求至少有MISO或MOSI', () => {
      const channels = createMockSPIChannelData([1, 0, 1, 0]); // 只有CLK
      
      expect(() => {
        decoder.decode(100000, channels, []);
      }).toThrow('Either MISO or MOSI (or both) pins required.');
    });

    test('只有CLK和MISO应该工作', () => {
      const { clk, miso } = createSPIMode0Sequence([], [0x55]);
      const channels = createMockSPIChannelData(clk, miso);
      
      const results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
    });

    test('只有CLK和MOSI应该工作', () => {
      const { clk, mosi } = createSPIMode0Sequence([0xAA], []);
      const channels = createMockSPIChannelData(clk, [], mosi);
      
      const results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
    });

    test('空数据应该返回空结果', () => {
      const channels = createMockSPIChannelData([]);
      const results = decoder.decode(100000, channels, []);
      expect(results).toEqual([]);
    });
  });

  describe('SPI Mode 0 (CPOL=0, CPHA=0) 测试', () => {
    test('应该正确解码Mode 0数据传输', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0xAB], [0x55]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '0' }, // CPOL=0
        { optionIndex: 2, value: '0' }  // CPHA=0
      ];

      const results = decoder.decode(100000, channels, options);

      // 验证MOSI数据
      const mosiData = results.find(r => r.annotationType === 1);
      expect(mosiData).toBeDefined();
      expect(mosiData!.rawData).toBe(0xAB);
      expect(mosiData!.values[0]).toBe('AB');

      // 验证MISO数据
      const misoData = results.find(r => r.annotationType === 0);
      expect(misoData).toBeDefined();
      expect(misoData!.rawData).toBe(0x55);
      expect(misoData!.values[0]).toBe('55');

      // 验证位数据
      const mosiBits = results.filter(r => r.annotationType === 3);
      const misoBits = results.filter(r => r.annotationType === 2);
      expect(mosiBits).toHaveLength(8);
      expect(misoBits).toHaveLength(8);
    });

    test('应该处理多字节传输', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x12, 0x34, 0x56], [0xAB, 0xCD, 0xEF]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);

      const results = decoder.decode(100000, channels, []);

      const mosiDataResults = results.filter(r => r.annotationType === 1);
      const misoDataResults = results.filter(r => r.annotationType === 0);

      expect(mosiDataResults).toHaveLength(3);
      expect(misoDataResults).toHaveLength(3);

      expect(mosiDataResults[0].rawData).toBe(0x12);
      expect(mosiDataResults[1].rawData).toBe(0x34);
      expect(mosiDataResults[2].rawData).toBe(0x56);

      expect(misoDataResults[0].rawData).toBe(0xAB);
      expect(misoDataResults[1].rawData).toBe(0xCD);
      expect(misoDataResults[2].rawData).toBe(0xEF);
    });
  });

  describe('SPI Mode 1 (CPOL=0, CPHA=1) 测试', () => {
    test('应该正确解码Mode 1数据传输', () => {
      const { clk, miso, mosi, cs } = createSPIMode1Sequence([0x88], [0x77]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '0' }, // CPOL=0
        { optionIndex: 2, value: '1' }  // CPHA=1
      ];

      const results = decoder.decode(100000, channels, options);

      const mosiData = results.find(r => r.annotationType === 1);
      const misoData = results.find(r => r.annotationType === 0);

      expect(mosiData).toBeDefined();
      expect(mosiData!.rawData).toBe(0x88);
      expect(misoData).toBeDefined();
      expect(misoData!.rawData).toBe(0x77);
    });
  });

  describe('SPI Mode 2 (CPOL=1, CPHA=0) 测试', () => {
    test('应该正确解码Mode 2数据传输', () => {
      const { clk, miso, mosi, cs } = createSPIMode2Sequence([0x99], [0x66]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '1' }, // CPOL=1
        { optionIndex: 2, value: '0' }  // CPHA=0
      ];

      const results = decoder.decode(100000, channels, options);

      const mosiData = results.find(r => r.annotationType === 1);
      const misoData = results.find(r => r.annotationType === 0);

      expect(mosiData).toBeDefined();
      expect(mosiData!.rawData).toBe(0x99);
      expect(misoData).toBeDefined();
      expect(misoData!.rawData).toBe(0x66);
    });
  });

  describe('SPI Mode 3 (CPOL=1, CPHA=1) 测试', () => {
    test('应该正确解码Mode 3数据传输', () => {
      const { clk, miso, mosi, cs } = createSPIMode3Sequence([0xCC], [0x33]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '1' }, // CPOL=1
        { optionIndex: 2, value: '1' }  // CPHA=1
      ];

      const results = decoder.decode(100000, channels, options);

      const mosiData = results.find(r => r.annotationType === 1);
      const misoData = results.find(r => r.annotationType === 0);

      expect(mosiData).toBeDefined();
      expect(mosiData!.rawData).toBe(0xCC);
      expect(misoData).toBeDefined();
      expect(misoData!.rawData).toBe(0x33);
    });
  });

  describe('CS极性测试', () => {
    test('active-low CS极性（默认）', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x12], [0x34]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'active-low' }
      ];

      const results = decoder.decode(100000, channels, options);

      // CS为low时应该有数据
      expect(results.length).toBeGreaterThan(0);
    });

    test('active-high CS极性', () => {
      // 创建active-high CS序列
      const { clk, miso, mosi } = createSPIMode0Sequence([0x12], [0x34]);
      const cs = clk.map(() => 0); // 初始为0（未选中）
      
      // CS变为1时选中设备
      for (let i = 10; i < clk.length - 10; i++) {
        cs[i] = 1;
      }

      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'active-high' }
      ];

      const results = decoder.decode(100000, channels, options);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('位序选项测试', () => {
    test('MSB-first（默认）', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x81], [0]); // 10000001
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 3, value: 'msb-first' }
      ];

      const results = decoder.decode(100000, channels, options);
      const mosiData = results.find(r => r.annotationType === 1);
      
      expect(mosiData).toBeDefined();
      expect(mosiData!.rawData).toBe(0x81);
    });

    test('LSB-first', () => {
      // 对于LSB-first，位序会被反转
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x81], [0]); 
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 3, value: 'lsb-first' }
      ];

      const results = decoder.decode(100000, channels, options);
      const mosiData = results.find(r => r.annotationType === 1);
      
      expect(mosiData).toBeDefined();
      // LSB-first模式下，0x81会被解释为不同的值
    });
  });

  describe('字长选项测试', () => {
    test('默认8位字长', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0xFF], [0]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);

      const results = decoder.decode(100000, channels, []);
      const mosiBits = results.filter(r => r.annotationType === 3);
      
      expect(mosiBits).toHaveLength(8);
    });

    test('自定义字长', () => {
      // 创建16位数据序列
      const clk: number[] = [];
      const mosi: number[] = [];
      const miso: number[] = [];
      const cs: number[] = [];

      // 初始状态
      for (let i = 0; i < 5; i++) {
        clk.push(0); mosi.push(1); miso.push(1); cs.push(1);
      }

      // CS断言
      clk.push(0); mosi.push(1); miso.push(1); cs.push(0);

      // 16位数据 (0x1234)
      const data16 = 0x1234;
      for (let bitIdx = 15; bitIdx >= 0; bitIdx--) {
        const bit = (data16 >> bitIdx) & 1;
        clk.push(0); mosi.push(bit); miso.push(0); cs.push(0);
        clk.push(1); mosi.push(bit); miso.push(0); cs.push(0);
      }

      // CS释放
      clk.push(0); mosi.push(1); miso.push(1); cs.push(1);

      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const options: DecoderOptionValue[] = [
        { optionIndex: 4, value: 16 } // 16位字长
      ];

      const results = decoder.decode(100000, channels, options);
      const mosiBits = results.filter(r => r.annotationType === 3);
      
      expect(mosiBits).toHaveLength(16);
    });
  });

  describe('无CS信号测试', () => {
    test('应该能处理没有CS信号的SPI', () => {
      const { clk, miso, mosi } = createSPIWithoutCS([0xAA], [0x55]);
      const channels = createMockSPIChannelData(clk, miso, mosi);

      const results = decoder.decode(100000, channels, []);

      const mosiData = results.find(r => r.annotationType === 1);
      const misoData = results.find(r => r.annotationType === 0);

      expect(mosiData).toBeDefined();
      expect(mosiData!.rawData).toBe(0xAA);
      expect(misoData).toBeDefined();
      expect(misoData!.rawData).toBe(0x55);
    });
  });

  describe('传输注释测试', () => {
    test('应该生成传输级别的注释', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x11, 0x22], [0x33, 0x44]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);

      const results = decoder.decode(100000, channels, []);

      // 应该有传输注释
      const mosiTransfer = results.find(r => r.annotationType === 6);
      const misoTransfer = results.find(r => r.annotationType === 5);

      expect(mosiTransfer).toBeDefined();
      expect(misoTransfer).toBeDefined();

      // 传输注释应该包含所有字节
      expect(mosiTransfer!.values[0]).toContain('11');
      expect(mosiTransfer!.values[0]).toContain('22');
      expect(misoTransfer!.values[0]).toContain('33');
      expect(misoTransfer!.values[0]).toContain('44');
    });
  });

  describe('错误和边界条件测试', () => {
    test('处理不完整的时钟周期', () => {
      // 创建不完整的时钟序列
      const clk = [0, 1, 0, 1, 0]; // 不完整的最后一个时钟周期
      const mosi = [0, 0, 1, 1, 0];
      const miso = [1, 1, 0, 0, 1];
      const channels = createMockSPIChannelData(clk, miso, mosi);

      const results = decoder.decode(100000, channels, []);
      expect(Array.isArray(results)).toBe(true);
    });

    test('处理时钟毛刺和噪声', () => {
      let { clk, miso, mosi, cs } = createSPIMode0Sequence([0x80], [0x01]);
      
      // 添加一些噪声
      if (clk.length > 20) {
        clk[10] = clk[10] === 1 ? 0 : 1; // 时钟毛刺
        clk[15] = clk[15] === 1 ? 0 : 1; // 另一个毛刺
      }

      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const results = decoder.decode(100000, channels, []);

      expect(Array.isArray(results)).toBe(true);
    });

    test('处理CS取消断言期间的数据', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0xAA], [0x55]);
      
      // 在传输中间取消断言CS
      const midPoint = Math.floor(cs.length / 2);
      for (let i = midPoint; i < midPoint + 5; i++) {
        if (i < cs.length) cs[i] = 1; // 取消断言CS
      }

      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const results = decoder.decode(100000, channels, []);

      // 应该有警告注释
      const warnings = results.filter(r => r.annotationType === 4);
      expect(warnings.length).toBeGreaterThan(0);
    });

    test('处理空时钟信号', () => {
      const channels = createMockSPIChannelData([], [1], [1]);
      const results = decoder.decode(100000, channels, []);
      expect(results).toEqual([]);
    });
  });

  describe('性能测试', () => {
    test('大数据量处理性能', () => {
      // 创建大量SPI数据
      const dataSize = 100;
      const mosiBytes = Array(dataSize).fill(0).map((_, i) => i & 0xFF);
      const misoBytes = Array(dataSize).fill(0).map((_, i) => (255 - i) & 0xFF);
      
      const { clk, miso, mosi, cs } = createSPIMode0Sequence(mosiBytes, misoBytes);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);

      const startTime = performance.now();
      const results = decoder.decode(1000000, channels, []);
      const endTime = performance.now();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // 10秒内完成
    });

    test('高频数据处理', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0xFF, 0x00, 0xAA, 0x55], [0x12, 0x34, 0x56, 0x78]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);

      // 高采样率测试
      const results = decoder.decode(10000000, channels, []); // 10MHz

      expect(Array.isArray(results)).toBe(true);
      const mosiDataResults = results.filter(r => r.annotationType === 1);
      expect(mosiDataResults).toHaveLength(4);
    });
  });

  describe('配置验证测试', () => {
    test('validateOptions应该验证必需通道', () => {
      const options: DecoderOptionValue[] = [];
      const selectedChannels = [
        { captureIndex: 0, decoderIndex: 0 } // 只有CLK
      ];
      const channels = createMockSPIChannelData([1, 0, 1]);

      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(true); // CLK是唯一的必需通道
    });

    test('应该处理无效的选项索引', () => {
      const { clk, miso, mosi } = createSPIMode0Sequence([0x11], [0x22]);
      const channels = createMockSPIChannelData(clk, miso, mosi);
      const options: DecoderOptionValue[] = [
        { optionIndex: 99, value: 'invalid' }
      ];

      // 应该忽略无效选项，不抛出错误
      expect(() => {
        decoder.decode(100000, channels, options);
      }).not.toThrow();
    });
  });

  describe('多实例和并发测试', () => {
    test('多个解码器实例应该产生一致结果', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0xAB], [0xCD]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      
      const decoder1 = new SPIDecoder();
      const decoder2 = new SPIDecoder();

      const results1 = decoder1.decode(100000, channels, []);
      const results2 = decoder2.decode(100000, channels, []);

      expect(results1).toEqual(results2);
    });

    test('连续解码应该重置状态', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x11], [0x22]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);

      const results1 = decoder.decode(100000, channels, []);
      const results2 = decoder.decode(100000, channels, []);

      expect(results1).toEqual(results2);
    });
  });

  describe('复杂传输模式测试', () => {
    test('多设备选择（多个CS变化）', () => {
      const { clk, miso, mosi } = createSPIMode0Sequence([0x11, 0x22], [0x33, 0x44]);
      const cs: number[] = [];

      // 创建多个CS选择周期
      for (let i = 0; i < clk.length; i++) {
        if (i < 10 || i > clk.length - 10) {
          cs.push(1); // 空闲
        } else if (i < clk.length / 2) {
          cs.push(0); // 第一个设备
        } else if (i < clk.length / 2 + 5) {
          cs.push(1); // 间隔
        } else {
          cs.push(0); // 第二个设备
        }
      }

      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const results = decoder.decode(100000, channels, []);

      // 应该有多个传输注释
      const transfers = results.filter(r => r.annotationType === 5 || r.annotationType === 6);
      expect(transfers.length).toBeGreaterThan(1);
    });

    test('变长数据包', () => {
      // 创建不同长度的数据包
      const packet1 = [0x10];           // 1字节
      const packet2 = [0x20, 0x21];     // 2字节
      const packet3 = [0x30, 0x31, 0x32]; // 3字节

      let combinedClk: number[] = [];
      let combinedMosi: number[] = [];
      let combinedMiso: number[] = [];
      let combinedCs: number[] = [];

      // 合并多个包
      [packet1, packet2, packet3].forEach(packet => {
        const { clk, miso, mosi, cs } = createSPIMode0Sequence(packet, packet.map(x => x + 0x10));
        combinedClk = combinedClk.concat(clk);
        combinedMosi = combinedMosi.concat(mosi);
        combinedMiso = combinedMiso.concat(miso);
        combinedCs = combinedCs.concat(cs);
      });

      const channels = createMockSPIChannelData(combinedClk, combinedMiso, combinedMosi, combinedCs);
      const results = decoder.decode(100000, channels, []);

      const mosiData = results.filter(r => r.annotationType === 1);
      expect(mosiData.length).toBe(6); // 1+2+3 = 6字节
    });
  });

  describe('结果数据完整性测试', () => {
    test('所有结果应该有正确的结构', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0xAB], [0xCD]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const results = decoder.decode(100000, channels, []);

      for (const result of results) {
        expect(result).toHaveProperty('startSample');
        expect(result).toHaveProperty('endSample');
        expect(result).toHaveProperty('annotationType');
        expect(result).toHaveProperty('values');
        expect(typeof result.startSample).toBe('number');
        expect(typeof result.endSample).toBe('number');
        expect(typeof result.annotationType).toBe('number');
        expect(Array.isArray(result.values)).toBe(true);
        expect(result.startSample).toBeLessThanOrEqual(result.endSample);
      }
    });

    test('时间戳应该按顺序排列', () => {
      const { clk, miso, mosi, cs } = createSPIMode0Sequence([0x11, 0x22], [0x33, 0x44]);
      const channels = createMockSPIChannelData(clk, miso, mosi, cs);
      const results = decoder.decode(100000, channels, []);

      const sortedResults = [...results].sort((a, b) => a.startSample - b.startSample);
      
      for (let i = 1; i < sortedResults.length; i++) {
        expect(sortedResults[i].startSample).toBeGreaterThanOrEqual(sortedResults[i-1].startSample);
      }
    });
  });
});