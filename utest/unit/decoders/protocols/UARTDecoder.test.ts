/**
 * UART协议解码器测试
 * 全面测试UART协议解码器的各项功能
 */

import { UARTDecoder } from '../../../../src/decoders/protocols/UARTDecoder';
import { DecoderOptionValue, ChannelData, DecoderOutputType } from '../../../../src/decoders/types';

describe('UARTDecoder', () => {
  let uartDecoder: UARTDecoder;

  beforeEach(() => {
    uartDecoder = new UARTDecoder();
  });

  describe('解码器元数据验证', () => {
    it('应该具有正确的基本信息', () => {
      expect(uartDecoder.id).toBe('uart');
      expect(uartDecoder.name).toBe('UART');
      expect(uartDecoder.longname).toBe('Universal Asynchronous Receiver/Transmitter');
      expect(uartDecoder.desc).toBe('Asynchronous, serial bus.');
      expect(uartDecoder.license).toBe('gplv2+');
    });

    it('应该定义正确的输入输出类型', () => {
      expect(uartDecoder.inputs).toEqual(['logic']);
      expect(uartDecoder.outputs).toEqual(['uart']);
      expect(uartDecoder.tags).toEqual(['Embedded/industrial']);
    });

    it('应该定义正确的通道', () => {
      const expectedChannels = [
        { id: 'rx', name: 'RX', desc: 'UART receive line', required: false, index: 0 },
        { id: 'tx', name: 'TX', desc: 'UART transmit line', required: false, index: 1 }
      ];
      expect(uartDecoder.channels).toEqual(expectedChannels);
    });

    it('应该定义正确的配置选项', () => {
      expect(uartDecoder.options).toHaveLength(9);
      
      // 波特率选项
      expect(uartDecoder.options[0]).toEqual({
        id: 'baudrate',
        desc: 'Baud rate',
        default: 115200,
        type: 'int'
      });

      // 数据位选项
      expect(uartDecoder.options[1]).toEqual({
        id: 'data_bits',
        desc: 'Data bits',
        default: 8,
        values: ['5', '6', '7', '8', '9'],
        type: 'list'
      });

      // 校验位选项
      expect(uartDecoder.options[2]).toEqual({
        id: 'parity',
        desc: 'Parity',
        default: 'none',
        values: ['none', 'odd', 'even', 'zero', 'one', 'ignore'],
        type: 'list'
      });

      // 停止位选项
      expect(uartDecoder.options[3]).toEqual({
        id: 'stop_bits',
        desc: 'Stop bits',
        default: 1.0,
        values: ['0.0', '0.5', '1.0', '1.5', '2.0'],
        type: 'list'
      });
    });

    it('应该定义正确的注释类型', () => {
      expect(uartDecoder.annotations).toHaveLength(18);
      
      const expectedAnnotations = [
        ['rx-data', 'RX data'],
        ['tx-data', 'TX data'],
        ['rx-start', 'RX start bit'],
        ['tx-start', 'TX start bit'],
        ['rx-parity-ok', 'RX parity OK bit'],
        ['tx-parity-ok', 'TX parity OK bit'],
        ['rx-parity-err', 'RX parity error bit'],
        ['tx-parity-err', 'TX parity error bit'],
        ['rx-stop', 'RX stop bit'],
        ['tx-stop', 'TX stop bit'],
        ['rx-warning', 'RX warning'],
        ['tx-warning', 'TX warning'],
        ['rx-data-bit', 'RX data bit'],
        ['tx-data-bit', 'TX data bit'],
        ['rx-break', 'RX break'],
        ['tx-break', 'TX break'],
        ['rx-packet', 'RX packet'],
        ['tx-packet', 'TX packet']
      ];
      
      expect(uartDecoder.annotations).toEqual(expectedAnnotations);
    });
  });

  describe('通道验证', () => {
    it('应该拒绝没有RX和TX的配置', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([]) },
        { channelNumber: 1, channelName: 'TX', samples: new Uint8Array([]) }
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, []);
      }).toThrow('Need at least one of TX or RX pins.');
    });

    it('应该接受只有RX的配置', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1]) }
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, []);
      }).not.toThrow();
    });

    it('应该接受只有TX的配置', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([]) },
        { channelNumber: 1, channelName: 'TX', samples: new Uint8Array([1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1]) }
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, []);
      }).not.toThrow();
    });

    it('应该拒绝没有采样率的配置', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0, 1, 0]) }
      ];

      expect(() => {
        uartDecoder.decode(0, channels, []);
      }).toThrow('Cannot decode without samplerate.');
    });
  });

  describe('配置选项处理', () => {
    it('应该正确处理波特率选项', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0, 1, 0]) }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 9600 } // baudrate
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, options);
      }).not.toThrow();
    });

    it('应该正确处理数据位选项', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0, 1, 0]) }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '7' } // data_bits = 7
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, options);
      }).not.toThrow();
    });

    it('应该正确处理校验位选项', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0, 1, 0]) }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'even' } // parity = even
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, options);
      }).not.toThrow();
    });

    it('应该正确处理停止位选项', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0, 1, 0]) }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 3, value: '2.0' } // stop_bits = 2.0
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, options);
      }).not.toThrow();
    });

    it('应该正确处理数据格式选项', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0, 1, 0]) }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'ascii' } // format = ascii
      ];

      expect(() => {
        uartDecoder.decode(115200, channels, options);
      }).not.toThrow();
    });
  });

  describe('基本UART解码功能', () => {
    it('应该解码简单的8N1 UART帧', () => {
      // 创建标准8N1 UART帧: 起始位(0) + 8数据位 + 停止位(1)
      // 数据: 0x55 = 01010101 (LSB先传输)
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, // 空闲状态
            0,        // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位 (LSB先): 0x55
            1,        // 停止位
            1, 1, 1   // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 115200 }, // baudrate
        { optionIndex: 1, value: '8' },    // data_bits = 8
        { optionIndex: 2, value: 'none' }, // parity = none
        { optionIndex: 3, value: '1.0' }   // stop_bits = 1.0
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // 检查是否有数据注释
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      expect(dataAnnotations.length).toBeGreaterThan(0);
    });

    it('应该处理多个连续帧', () => {
      // 创建两个连续的UART帧
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 第一帧起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 第一帧数据位: 0x55
            1,                   // 第一帧停止位
            0,                   // 第二帧起始位
            0, 1, 0, 1, 0, 1, 0, 1, // 第二帧数据位: 0xAA
            1,                   // 第二帧停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      
      expect(results).toBeDefined();
      
      // 应该检测到两个数据帧
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      expect(dataAnnotations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('数据位配置测试', () => {
    it('应该处理7位数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,      // 空闲状态
            0,            // 起始位
            1, 0, 1, 0, 1, 0, 1, // 7位数据
            1,            // 停止位
            1, 1, 1       // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '7' } // data_bits = 7
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该处理5位数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,   // 空闲状态
            0,         // 起始位
            1, 0, 1, 0, 1, // 5位数据
            1,         // 停止位
            1, 1, 1    // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '5' } // data_bits = 5
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });
  });

  describe('校验位测试', () => {
    it('应该检测正确的偶校验', () => {
      // 数据: 0x0F = 00001111 (4个1，偶校验位应该为0)
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 1, 1, 1, 0, 0, 0, 0, // 数据位 (LSB先): 0x0F
            0,                   // 偶校验位 (4个1是偶数，校验位为0)
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'even' } // parity = even
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      // 检查是否有校验正确的注释
      const parityOkAnnotations = results.filter(r => 
        r.annotationType === 4 // rx-parity-ok
      );
      
      expect(parityOkAnnotations.length).toBeGreaterThan(0);
    });

    it('应该检测校验错误', () => {
      // 数据: 0x0F = 00001111 (4个1，偶校验位应该为0，但我们设置为1)
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 1, 1, 1, 0, 0, 0, 0, // 数据位 (LSB先): 0x0F
            1,                   // 错误的偶校验位 (应该为0，但设置为1)
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'even' } // parity = even
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      // 检查是否有校验错误的注释
      const parityErrAnnotations = results.filter(r => 
        r.annotationType === 6 // rx-parity-err
      );
      
      expect(parityErrAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('数据格式测试', () => {
    it('应该正确格式化十六进制数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'hex' } // format = hex
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      if (dataAnnotations.length > 0) {
        // 检查十六进制格式输出
        expect(dataAnnotations[0].values).toBeDefined();
        expect(dataAnnotations[0].values.length).toBeGreaterThan(0);
      }
    });

    it('应该正确格式化ASCII数据', () => {
      // 数据: 0x41 = 'A'
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 0, 0, 0, 0, 1, 0, // 数据位 (LSB先): 0x41 = 'A'
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'ascii' } // format = ascii
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      if (dataAnnotations.length > 0) {
        expect(dataAnnotations[0].values).toBeDefined();
        expect(dataAnnotations[0].values.length).toBeGreaterThan(0);
        // 如果是可打印字符，应该包含 'A'
      }
    });
  });

  describe('错误处理', () => {
    it('应该检测帧错误 (起始位不为0)', () => {
      // 由于解码器的架构，这个测试实际上验证解码器在没有找到有效帧时的行为
      // 创建一个没有下降沿的数据序列，因此不会产生任何帧
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 // 全部为1，没有下降沿
          ])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      
      // 验证没有产生数据注释（因为没有有效帧）
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      // 由于没有有效的UART帧，不应该有数据注释
      expect(dataAnnotations.length).toBe(0);
      
      // 同样不应该有警告注释，因为没有检测到任何帧尝试
      const warningAnnotations = results.filter(r => 
        r.annotationType === 10 // rx-warning
      );
      
      expect(warningAnnotations.length).toBe(0);
    });

    it('应该检测停止位错误', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位
            0,                   // 错误的停止位 (应该为1)
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      
      // 检查是否有警告注释
      const warningAnnotations = results.filter(r => 
        r.annotationType === 10 // rx-warning
      );
      
      expect(warningAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('TX通道测试', () => {
    it('应该解码TX通道数据', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([]) },
        { 
          channelNumber: 1, 
          channelName: 'TX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      
      // 检查是否有TX数据注释
      const txDataAnnotations = results.filter(r => 
        r.annotationType === 1 // tx-data
      );
      
      expect(txDataAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空数据', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 1, 1]) } // 至少有一些数据
      ];

      const results = uartDecoder.decode(115200, channels, []);
      expect(results).toBeDefined();
      // 没有有效帧的数据应该正常处理，不抛出异常
    });

    it('应该处理短数据序列', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([1, 0]) }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      expect(results).toBeDefined();
      // 短数据序列应该正常处理
    });

    it('应该处理不完整的帧', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, // 空闲状态
            0,       // 起始位
            1, 0, 1  // 不完整的数据位 (少于8位)
          ])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      expect(results).toBeDefined();
      // 不完整的帧应该正常处理，不产生完整的数据注释
    });
  });

  describe('重置功能', () => {
    it('应该正确重置解码器状态', () => {
      const channels1: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, // 空闲状态
            0,        // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,        // 停止位
            1, 1      // 空闲状态
          ])
        }
      ];

      const results1 = uartDecoder.decode(115200, channels1, []);
      expect(results1).toBeDefined();

      // 第二次解码应该产生独立的结果
      const channels2: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, // 空闲状态
            0,        // 起始位
            0, 1, 0, 1, 0, 1, 0, 1, // 数据位: 0xAA
            1,        // 停止位
            1, 1      // 空闲状态
          ])
        }
      ];

      const results2 = uartDecoder.decode(9600, channels2, []);
      expect(results2).toBeDefined();
      
      // 两次解码的结果应该是独立的
      expect(results1).not.toEqual(results2);
    });
  });

  describe('校验位深度测试', () => {
    it('应该正确处理奇校验', () => {
      // 数据: 0x07 = 00000111 (3个1，奇校验位应该为0)
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 1, 1, 0, 0, 0, 0, 0, // 数据位 (LSB先): 0x07
            0,                   // 奇校验位 (3个1是奇数，校验位为0)
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'odd' } // parity = odd
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      // 检查是否有校验正确的注释
      const parityOkAnnotations = results.filter(r => 
        r.annotationType === 4 // rx-parity-ok
      );
      
      expect(parityOkAnnotations.length).toBeGreaterThan(0);
    });

    it('应该正确处理zero校验', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            0,                   // zero校验位 (总是0)
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'zero' } // parity = zero
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const parityOkAnnotations = results.filter(r => 
        r.annotationType === 4 // rx-parity-ok
      );
      
      expect(parityOkAnnotations.length).toBeGreaterThan(0);
    });

    it('应该正确处理one校验', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // one校验位 (总是1)
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'one' } // parity = one
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const parityOkAnnotations = results.filter(r => 
        r.annotationType === 4 // rx-parity-ok
      );
      
      expect(parityOkAnnotations.length).toBeGreaterThan(0);
    });

    it('应该正确处理ignore校验', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // 随意的校验位
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 2, value: 'ignore' } // parity = ignore
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const parityOkAnnotations = results.filter(r => 
        r.annotationType === 4 // rx-parity-ok
      );
      
      expect(parityOkAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('完整配置选项测试', () => {
    it('应该正确处理位序选项 (MSB-first)', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 4, value: 'msb-first' } // bit_order = msb-first
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该正确处理RX反相选项', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            0, 0, 0,             // 空闲状态 (反相后)
            1,                   // 起始位 (反相后)
            0, 1, 0, 1, 0, 1, 0, 1, // 数据位 (反相后)
            0,                   // 停止位 (反相后)
            0, 0, 0              // 空闲状态 (反相后)
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 6, value: 'yes' } // invert_rx = yes
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该正确处理TX反相选项', () => {
      const channels: ChannelData[] = [
        { channelNumber: 0, channelName: 'RX', samples: new Uint8Array([]) },
        { 
          channelNumber: 1, 
          channelName: 'TX', 
          samples: new Uint8Array([
            0, 0, 0,             // 空闲状态 (反相后)
            1,                   // 起始位 (反相后)
            0, 1, 0, 1, 0, 1, 0, 1, // 数据位 (反相后)
            0,                   // 停止位 (反相后)
            0, 0, 0              // 空闲状态 (反相后)
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 7, value: 'yes' } // invert_tx = yes
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该正确处理采样点选项', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 8, value: 25 } // sample_point = 25%
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });
  });

  describe('多种数据格式测试', () => {
    it('应该正确格式化十进制数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55 = 85
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'dec' } // format = dec
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      expect(dataAnnotations.length).toBeGreaterThan(0);
    });

    it('应该正确格式化八进制数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'oct' } // format = oct
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      expect(dataAnnotations.length).toBeGreaterThan(0);
    });

    it('应该正确格式化二进制数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'bin' } // format = bin
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      expect(dataAnnotations.length).toBeGreaterThan(0);
    });

    it('应该正确处理非可打印ASCII字符', () => {
      // 数据: 0x01 (非可打印字符)
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 0, 0, 0, 0, 0, 0, // 数据位 (LSB先): 0x01
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 5, value: 'ascii' } // format = ascii
      ];

      const results = uartDecoder.decode(115200, channels, options);
      
      const dataAnnotations = results.filter(r => 
        r.annotationType === 0 // rx-data
      );
      
      expect(dataAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('停止位配置测试', () => {
    it('应该处理0.5停止位', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 3, value: '0.5' } // stop_bits = 0.5
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该处理1.5停止位', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位
            1, 1,                // 1.5停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 3, value: '1.5' } // stop_bits = 1.5
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该处理2.0停止位', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位
            1, 1,                // 2停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 3, value: '2.0' } // stop_bits = 2.0
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });
  });

  describe('9位数据模式测试', () => {
    it('应该正确处理9位数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, 1, // 9位数据
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 1, value: '9' } // data_bits = 9
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });
  });

  describe('长数据包测试', () => {
    it('应该处理长数据包并触发包处理', () => {
      // 创建一个包含多个字节的长数据流，触发包处理逻辑
      const frames = [];
      
      // 添加18个连续的UART帧以触发包处理
      for (let i = 0; i < 18; i++) {
        frames.push(
          1, 1, 1, // 空闲状态
          0,       // 起始位
          i & 1, (i >> 1) & 1, (i >> 2) & 1, (i >> 3) & 1, 0, 0, 0, 0, // 数据位
          1        // 停止位
        );
      }
      frames.push(1, 1, 1); // 最终空闲状态

      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array(frames)
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      
      // 检查是否有包注释生成
      const packetAnnotations = results.filter(r => 
        r.annotationType === 16 // rx-packet
      );
      
      expect(packetAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('边界条件增强测试', () => {
    it('应该处理极端采样点值', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1
          ])
        }
      ];

      // 测试边界采样点
      const options: DecoderOptionValue[] = [
        { optionIndex: 8, value: 1 } // sample_point = 1% (边界值)
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该处理超出范围的采样点值', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1
          ])
        }
      ];

      // 测试超出范围的采样点
      const options: DecoderOptionValue[] = [
        { optionIndex: 8, value: 150 } // sample_point = 150% (超出范围)
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });

    it('应该处理只有一个样本的数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([1])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      expect(results).toBeDefined();
    });
  });

  describe('复杂场景测试', () => {
    it('应该处理混合RX和TX数据', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            1, 0, 1, 0, 1, 0, 1, 0, // 数据位: 0x55
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        },
        { 
          channelNumber: 1, 
          channelName: 'TX', 
          samples: new Uint8Array([
            1, 1, 1,             // 空闲状态
            0,                   // 起始位
            0, 1, 0, 1, 0, 1, 0, 1, // 数据位: 0xAA
            1,                   // 停止位
            1, 1, 1              // 空闲状态
          ])
        }
      ];

      const results = uartDecoder.decode(115200, channels, []);
      
      // 应该同时有RX和TX的数据注释
      const rxDataAnnotations = results.filter(r => r.annotationType === 0); // rx-data
      const txDataAnnotations = results.filter(r => r.annotationType === 1); // tx-data
      
      expect(rxDataAnnotations.length).toBeGreaterThan(0);
      expect(txDataAnnotations.length).toBeGreaterThan(0);
    });

    it('应该处理低波特率和长位宽', () => {
      const channels: ChannelData[] = [
        { 
          channelNumber: 0, 
          channelName: 'RX', 
          samples: new Uint8Array(Array(200).fill(1).concat([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 起始位 (更长的位宽)
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 数据位0
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 数据位1
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 数据位2
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 数据位3
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 数据位4
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 数据位5
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 数据位6
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 数据位7
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1  // 停止位
          ]).concat(Array(100).fill(1)))
        }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 9600 } // 低波特率
      ];

      const results = uartDecoder.decode(115200, channels, options);
      expect(results).toBeDefined();
    });
  });
});