/**
 * 解码器类型定义测试
 * 目标：达到 95%+ 覆盖率和 100% 通过率
 * 验证类型定义的正确性和兼容性
 */

import {
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderSelectedChannel,
  WaitConditionType,
  WaitCondition,
  WaitConditions,
  WaitResult,
  DecoderOutputType,
  DecoderOutput,
  DecoderResult,
  DecoderAnnotation,
  DecoderInfo,
  ChannelData
} from '../src/decoders/types';

describe('解码器类型定义测试', () => {
  describe('DecoderChanne 接口测试', () => {
    test('应该能创建有效的通道定义', () => {
      const channel: DecoderChannel = {
        id: 'clk',
        name: 'Clock',
        desc: 'Clock signal',
        required: true,
        index: 0
      };

      expect(channel.id).toBe('clk');
      expect(channel.name).toBe('Clock');
      expect(channel.desc).toBe('Clock signal');
      expect(channel.required).toBe(true);
      expect(channel.index).toBe(0);
    });

    test('应该支持可选字段', () => {
      const channel: DecoderChannel = {
        id: 'data',
        name: 'Data',
        desc: 'Data signal'
        // required 和 index 是可选的
      };

      expect(channel.id).toBe('data');
      expect(channel.name).toBe('Data');
      expect(channel.desc).toBe('Data signal');
      expect(channel.required).toBeUndefined();
      expect(channel.index).toBeUndefined();
    });

    test('应该支持完整字段', () => {
      const channels: DecoderChannel[] = [
        {
          id: 'clk',
          name: 'Clock',
          desc: 'Clock signal',
          required: true,
          index: 0
        },
        {
          id: 'data',
          name: 'Data',
          desc: 'Data signal',
          required: false,
          index: 1
        }
      ];

      expect(channels).toHaveLength(2);
      expect(channels[0].required).toBe(true);
      expect(channels[1].required).toBe(false);
    });
  });

  describe('DecoderOption 接口测试', () => {
    test('应该能创建字符串选项', () => {
      const option: DecoderOption = {
        id: 'format',
        desc: 'Data format',
        default: 'hex',
        values: ['hex', 'dec', 'bin'],
        type: 'string'
      };

      expect(option.id).toBe('format');
      expect(option.desc).toBe('Data format');
      expect(option.default).toBe('hex');
      expect(option.values).toEqual(['hex', 'dec', 'bin']);
      expect(option.type).toBe('string');
    });

    test('应该能创建整数选项', () => {
      const option: DecoderOption = {
        id: 'baudrate',
        desc: 'Baud rate',
        default: 115200,
        type: 'int'
      };

      expect(option.id).toBe('baudrate');
      expect(option.desc).toBe('Baud rate');
      expect(option.default).toBe(115200);
      expect(option.type).toBe('int');
    });

    test('应该能创建列表选项', () => {
      const option: DecoderOption = {
        id: 'parity',
        desc: 'Parity type',
        default: 'none',
        values: ['none', 'odd', 'even'],
        type: 'list'
      };

      expect(option.values).toContain('none');
      expect(option.values).toContain('odd');
      expect(option.values).toContain('even');
    });

    test('应该支持布尔选项', () => {
      const option: DecoderOption = {
        id: 'invert',
        desc: 'Invert signal',
        default: false,
        type: 'bool'
      };

      expect(option.default).toBe(false);
      expect(option.type).toBe('bool');
    });

    test('应该支持浮点选项', () => {
      const option: DecoderOption = {
        id: 'threshold',
        desc: 'Threshold voltage',
        default: 1.2,
        type: 'float'
      };

      expect(option.default).toBe(1.2);
      expect(option.type).toBe('float');
    });
  });

  describe('DecoderOptionValue 接口测试', () => {
    test('应该能存储不同类型的选项值', () => {
      const stringValue: DecoderOptionValue = {
        optionIndex: 0,
        value: 'hex'
      };

      const intValue: DecoderOptionValue = {
        optionIndex: 1,
        value: 115200
      };

      const boolValue: DecoderOptionValue = {
        optionIndex: 2,
        value: true
      };

      expect(stringValue.value).toBe('hex');
      expect(intValue.value).toBe(115200);
      expect(boolValue.value).toBe(true);
    });

    test('应该能创建选项值数组', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'ascii' },
        { optionIndex: 1, value: 9600 },
        { optionIndex: 2, value: false }
      ];

      expect(options).toHaveLength(3);
      expect(options[0].optionIndex).toBe(0);
      expect(options[1].optionIndex).toBe(1);
      expect(options[2].optionIndex).toBe(2);
    });
  });

  describe('DecoderSelectedChannel 接口测试', () => {
    test('应该能映射通道', () => {
      const mapping: DecoderSelectedChannel = {
        captureIndex: 0,
        decoderIndex: 1
      };

      expect(mapping.captureIndex).toBe(0);
      expect(mapping.decoderIndex).toBe(1);
    });

    test('应该能创建通道映射数组', () => {
      const mappings: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 },
        { captureIndex: 3, decoderIndex: 2 } // 跳过索引2
      ];

      expect(mappings).toHaveLength(3);
      expect(mappings[2].captureIndex).toBe(3);
      expect(mappings[2].decoderIndex).toBe(2);
    });
  });

  describe('WaitConditionType 联合类型测试', () => {
    test('应该支持所有等待条件类型', () => {
      const conditions: WaitConditionType[] = [
        'skip',
        'low',
        'high',
        'rising',
        'falling',
        'edge',
        'stable'
      ];

      expect(conditions).toContain('skip');
      expect(conditions).toContain('low');
      expect(conditions).toContain('high');
      expect(conditions).toContain('rising');
      expect(conditions).toContain('falling');
      expect(conditions).toContain('edge');
      expect(conditions).toContain('stable');
    });

    test('应该能在条件对象中使用', () => {
      const condition: WaitCondition = {
        0: 'rising',
        1: 'high',
        2: 'falling'
      };

      expect(condition[0]).toBe('rising');
      expect(condition[1]).toBe('high');
      expect(condition[2]).toBe('falling');
    });
  });

  describe('WaitConditions 联合类型测试', () => {
    test('应该支持单个条件', () => {
      const singleCondition: WaitConditions = {
        0: 'high',
        1: 'low'
      };

      expect(typeof singleCondition).toBe('object');
      expect(Array.isArray(singleCondition)).toBe(false);
    });

    test('应该支持条件数组', () => {
      const multipleConditions: WaitConditions = [
        { 0: 'rising' },
        { 1: 'falling' },
        { 0: 'high', 1: 'low' }
      ];

      expect(Array.isArray(multipleConditions)).toBe(true);
      expect(multipleConditions).toHaveLength(3);
    });
  });

  describe('WaitResult 接口测试', () => {
    test('应该能创建基本等待结果', () => {
      const result: WaitResult = {
        pins: [1, 0, 1],
        sampleNumber: 42
      };

      expect(result.pins).toEqual([1, 0, 1]);
      expect(result.sampleNumber).toBe(42);
      expect(result.matched).toBeUndefined();
      expect(result.matchedIndex).toBeUndefined();
    });

    test('应该能包含匹配信息', () => {
      const result: WaitResult = {
        pins: [0, 1],
        sampleNumber: 100,
        matched: [false, true, false],
        matchedIndex: 1
      };

      expect(result.matched).toEqual([false, true, false]);
      expect(result.matchedIndex).toBe(1);
    });
  });

  describe('DecoderOutputType 枚举测试', () => {
    test('应该包含所有输出类型', () => {
      expect(DecoderOutputType.ANNOTATION).toBe(0);
      expect(DecoderOutputType.PYTHON).toBe(1);
      expect(DecoderOutputType.BINARY).toBe(2);
      expect(DecoderOutputType.LOGIC).toBe(3);
      expect(DecoderOutputType.META).toBe(4);
    });

    test('应该能在输出对象中使用', () => {
      const output: DecoderOutput = {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0,
        values: ['Test output']
      };

      expect(output.type).toBe(DecoderOutputType.ANNOTATION);
    });
  });

  describe('DecoderOutput 接口测试', () => {
    test('应该能创建注释输出', () => {
      const output: DecoderOutput = {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0,
        values: ['Start bit', 'S'],
        rawData: 0
      };

      expect(output.type).toBe(DecoderOutputType.ANNOTATION);
      expect(output.annotationType).toBe(0);
      expect(output.values).toEqual(['Start bit', 'S']);
      expect(output.rawData).toBe(0);
    });

    test('应该能创建Python输出', () => {
      const output: DecoderOutput = {
        type: DecoderOutputType.PYTHON,
        values: ['python-data']
      };

      expect(output.type).toBe(DecoderOutputType.PYTHON);
      expect(output.annotationType).toBeUndefined();
    });

    test('应该能创建二进制输出', () => {
      const output: DecoderOutput = {
        type: DecoderOutputType.BINARY,
        values: ['binary-stream'],
        rawData: new Uint8Array([0x01, 0x02, 0x03])
      };

      expect(output.type).toBe(DecoderOutputType.BINARY);
      expect(output.rawData).toBeInstanceOf(Uint8Array);
    });
  });

  describe('DecoderResult 接口测试', () => {
    test('应该能创建完整的解码结果', () => {
      const result: DecoderResult = {
        startSample: 100,
        endSample: 150,
        annotationType: 0,
        values: ['Data: 0x42', '42', 'D'],
        rawData: 0x42,
        shape: 'hexagon'
      };

      expect(result.startSample).toBe(100);
      expect(result.endSample).toBe(150);
      expect(result.annotationType).toBe(0);
      expect(result.values).toEqual(['Data: 0x42', '42', 'D']);
      expect(result.rawData).toBe(0x42);
      expect(result.shape).toBe('hexagon');
    });

    test('应该支持不同的形状', () => {
      const shapes: Array<'hexagon' | 'rectangle' | 'diamond'> = [
        'hexagon',
        'rectangle', 
        'diamond'
      ];

      for (const shape of shapes) {
        const result: DecoderResult = {
          startSample: 0,
          endSample: 10,
          annotationType: 0,
          values: ['test'],
          shape
        };

        expect(result.shape).toBe(shape);
      }
    });

    test('应该支持可选字段', () => {
      const minimalResult: DecoderResult = {
        startSample: 0,
        endSample: 10,
        annotationType: 0,
        values: ['minimal']
      };

      expect(minimalResult.rawData).toBeUndefined();
      expect(minimalResult.shape).toBeUndefined();
    });
  });

  describe('DecoderAnnotation 接口测试', () => {
    test('应该能创建注释集合', () => {
      const annotation: DecoderAnnotation = {
        name: 'UART Data',
        segments: [
          {
            startSample: 0,
            endSample: 10,
            annotationType: 0,
            values: ['Start bit']
          },
          {
            startSample: 10,
            endSample: 90,
            annotationType: 1,
            values: ['Data: 0x41']
          }
        ]
      };

      expect(annotation.name).toBe('UART Data');
      expect(annotation.segments).toHaveLength(2);
      expect(annotation.segments[0].values).toEqual(['Start bit']);
      expect(annotation.segments[1].values).toEqual(['Data: 0x41']);
    });
  });

  describe('DecoderInfo 接口测试', () => {
    test('应该能创建完整的解码器信息', () => {
      const info: DecoderInfo = {
        id: 'uart',
        name: 'UART',
        longname: 'Universal Asynchronous Receiver/Transmitter',
        description: 'Asynchronous serial communication',
        license: 'GPL',
        inputs: ['logic'],
        outputs: ['uart'],
        tags: ['Serial', 'Communication'],
        channels: [
          {
            id: 'rx',
            name: 'RX',
            desc: 'Receive line',
            required: false,
            index: 0
          }
        ],
        options: [
          {
            id: 'baudrate',
            desc: 'Baud rate',
            default: 115200,
            type: 'int'
          }
        ],
        annotations: [
          ['data', 'Data', 'D'],
          ['error', 'Error', 'E']
        ],
        annotationRows: [
          ['data-row', 'Data', [0]],
          ['error-row', 'Errors', [1]]
        ]
      };

      expect(info.id).toBe('uart');
      expect(info.name).toBe('UART');
      expect(info.channels).toHaveLength(1);
      expect(info.options).toHaveLength(1);
      expect(info.annotations).toHaveLength(2);
      expect(info.annotationRows).toHaveLength(2);
    });

    test('应该支持可选的注释行', () => {
      const infoWithoutRows: DecoderInfo = {
        id: 'simple',
        name: 'Simple',
        longname: 'Simple Decoder',
        description: 'A simple decoder',
        license: 'MIT',
        inputs: ['logic'],
        outputs: ['simple'],
        tags: ['Simple'],
        channels: [],
        options: [],
        annotations: []
        // annotationRows 是可选的
      };

      expect(infoWithoutRows.annotationRows).toBeUndefined();
    });
  });

  describe('ChannelData 接口测试', () => {
    test('应该能创建通道数据', () => {
      const channelData: ChannelData = {
        channelNumber: 0,
        channelName: 'Clock',
        samples: new Uint8Array([1, 0, 1, 0, 1])
      };

      expect(channelData.channelNumber).toBe(0);
      expect(channelData.channelName).toBe('Clock');
      expect(channelData.samples).toBeInstanceOf(Uint8Array);
      expect(channelData.samples.length).toBe(5);
    });

    test('应该支持隐藏通道', () => {
      const hiddenChannel: ChannelData = {
        channelNumber: 1,
        channelName: 'Hidden',
        samples: new Uint8Array([0, 1]),
        hidden: true
      };

      expect(hiddenChannel.hidden).toBe(true);
    });

    test('应该能创建通道数组', () => {
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          channelName: 'CLK',
          samples: new Uint8Array([1, 0, 1, 0])
        },
        {
          channelNumber: 1,
          channelName: 'DATA',
          samples: new Uint8Array([0, 1, 1, 0])
        }
      ];

      expect(channels).toHaveLength(2);
      expect(channels[0].channelNumber).toBe(0);
      expect(channels[1].channelNumber).toBe(1);
    });
  });

  describe('类型兼容性测试', () => {
    test('应该能组合使用不同类型', () => {
      // 模拟一个完整的解码流程
      const channels: ChannelData[] = [
        {
          channelNumber: 0,
          channelName: 'CLK',
          samples: new Uint8Array([1, 0, 1, 0])
        }
      ];

      const selectedChannels: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 }
      ];

      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'hex' }
      ];

      const waitCondition: WaitConditions = [
        { 0: 'rising' },
        { 0: 'falling' }
      ];

      const result: DecoderResult = {
        startSample: 0,
        endSample: 10,
        annotationType: 0,
        values: ['Test result']
      };

      // 验证所有类型都能正确组合
      expect(channels).toHaveLength(1);
      expect(selectedChannels).toHaveLength(1);
      expect(options).toHaveLength(1);
      expect(Array.isArray(waitCondition)).toBe(true);
      expect(result.values).toEqual(['Test result']);
    });

    test('应该能在函数签名中使用', () => {
      // 模拟解码器方法签名
      function mockDecode(
        sampleRate: number,
        channels: ChannelData[],
        options: DecoderOptionValue[]
      ): DecoderResult[] {
        return [
          {
            startSample: 0,
            endSample: sampleRate / 1000,
            annotationType: 0,
            values: [`Rate: ${sampleRate}`]
          }
        ];
      }

      const testChannels: ChannelData[] = [{
        channelNumber: 0,
        channelName: 'Test',
        samples: new Uint8Array([1, 0])
      }];

      const testOptions: DecoderOptionValue[] = [{
        optionIndex: 0,
        value: 'test'
      }];

      const results = mockDecode(100000, testChannels, testOptions);
      
      expect(results).toHaveLength(1);
      expect(results[0].values[0]).toBe('Rate: 100000');
    });
  });

  describe('边界值和特殊情况测试', () => {
    test('应该处理空数组', () => {
      const emptyChannels: ChannelData[] = [];
      const emptyOptions: DecoderOptionValue[] = [];
      const emptyResults: DecoderResult[] = [];

      expect(emptyChannels).toHaveLength(0);
      expect(emptyOptions).toHaveLength(0);
      expect(emptyResults).toHaveLength(0);
    });

    test('应该处理大数值', () => {
      const largeNumbers: DecoderResult = {
        startSample: Number.MAX_SAFE_INTEGER - 1,
        endSample: Number.MAX_SAFE_INTEGER,
        annotationType: 999,
        values: ['Large numbers'],
        rawData: 0xFFFFFFFF
      };

      expect(largeNumbers.startSample).toBe(Number.MAX_SAFE_INTEGER - 1);
      expect(largeNumbers.endSample).toBe(Number.MAX_SAFE_INTEGER);
      expect(largeNumbers.rawData).toBe(0xFFFFFFFF);
    });

    test('应该处理特殊字符串', () => {
      const specialStrings: DecoderResult = {
        startSample: 0,
        endSample: 1,
        annotationType: 0,
        values: [
          '', // 空字符串
          ' ', // 空格
          '\n\t', // 换行和制表符
          '中文测试', // Unicode字符
          '🎯📊✅' // Emoji
        ]
      };

      expect(specialStrings.values).toContain('');
      expect(specialStrings.values).toContain(' ');
      expect(specialStrings.values).toContain('中文测试');
      expect(specialStrings.values).toContain('🎯📊✅');
    });

    test('应该处理零和负数', () => {
      const edgeCases: DecoderResult = {
        startSample: 0,
        endSample: 0, // 相等的开始和结束
        annotationType: 0,
        values: ['Zero duration'],
        rawData: -1 // 负数
      };

      expect(edgeCases.startSample).toBe(0);
      expect(edgeCases.endSample).toBe(0);
      expect(edgeCases.rawData).toBe(-1);
    });
  });

  describe('类型安全测试', () => {
    test('枚举值应该是类型安全的', () => {
      // TypeScript编译时会检查这些
      const validOutputType: DecoderOutputType = DecoderOutputType.ANNOTATION;
      const validCondition: WaitConditionType = 'rising';
      
      expect(typeof validOutputType).toBe('number');
      expect(typeof validCondition).toBe('string');
    });

    test('接口字段应该是类型安全的', () => {
      const channel: DecoderChannel = {
        id: 'test',
        name: 'Test',
        desc: 'Test channel',
        required: true, // 必须是布尔值
        index: 0 // 必须是数字
      };

      expect(typeof channel.required).toBe('boolean');
      expect(typeof channel.index).toBe('number');
    });
  });
});