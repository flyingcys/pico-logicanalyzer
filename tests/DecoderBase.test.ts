/**
 * DecoderBase 基类单元测试
 * 目标：达到 95%+ 覆盖率和 100% 通过率
 * 参照 UTILS 模块测试成功经验
 */

import { DecoderBase } from '../src/decoders/DecoderBase';
import {
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderSelectedChannel,
  WaitCondition,
  WaitConditions,
  WaitResult,
  DecoderOutput,
  DecoderResult,
  DecoderOutputType,
  WaitConditionType,
  ChannelData
} from '../src/decoders/types';

// 创建测试用的具体解码器实现
class TestDecoder extends DecoderBase {
  readonly id = 'test';
  readonly name = 'Test Decoder';
  readonly longname = 'Test Protocol Decoder';
  readonly desc = 'A test decoder for unit testing';
  readonly license = 'test';
  readonly inputs = ['logic'];
  readonly outputs = ['test'];
  readonly tags = ['Test'];

  readonly channels: DecoderChannel[] = [
    { id: 'clk', name: 'Clock', desc: 'Clock signal', required: true, index: 0 },
    { id: 'data', name: 'Data', desc: 'Data signal', required: false, index: 1 }
  ];

  readonly options: DecoderOption[] = [
    { id: 'test_option', desc: 'Test option', default: 'default_value', type: 'string' }
  ];

  readonly annotations: Array<[string, string, string?]> = [
    ['test-ann', 'Test annotation', 'T'],
    ['warning', 'Warning', 'W']
  ];

  readonly annotationRows: Array<[string, string, number[]]> = [
    ['test-row', 'Test row', [0]],
    ['warnings', 'Warnings', [1]]
  ];

  // 公开一些受保护的方法用于测试
  public testWait(conditions: WaitConditions): WaitResult {
    return this.wait(conditions);
  }

  public testPut(startSample: number, endSample: number, data: DecoderOutput): void {
    this.put(startSample, endSample, data);
  }

  public testGetCurrentPins(): number[] {
    return this.getCurrentPins();
  }

  public testHasMoreSamples(): boolean {
    return this.hasMoreSamples();
  }

  public testMatchesCondition(pins: number[], conditions: { [key: number]: WaitConditionType }): boolean {
    return this.matchesCondition(pins, conditions);
  }

  public testPrepareChannelData(channels: ChannelData[], channelMapping: DecoderSelectedChannel[]): void {
    this.prepareChannelData(channels, channelMapping);
  }

  public testStart(): void {
    this.start();
  }

  public testReset(): void {
    this.reset();
  }

  public testRegister(outputType: DecoderOutputType): number {
    return this.register(outputType);
  }

  // 获取内部状态用于测试验证
  public getResults(): DecoderResult[] {
    return this.results;
  }

  public getSampleIndex(): number {
    return this.sampleIndex;
  }

  public getChannelData(): Uint8Array[] {
    return this.channelData;
  }

  public getRegisteredOutputs(): Map<DecoderOutputType, number> {
    return this.registeredOutputs;
  }

  // 必须实现的抽象方法
  decode(_sampleRate: number, _channels: ChannelData[], _options: DecoderOptionValue[]): DecoderResult[] {
    return [];
  }
}

// 创建测试用的通道数据
function createTestChannelData(channel0Data: number[], channel1Data: number[] = []): ChannelData[] {
  const channels: ChannelData[] = [
    {
      channelNumber: 0,
      channelName: 'Channel 0',
      samples: new Uint8Array(channel0Data)
    }
  ];

  if (channel1Data.length > 0) {
    channels.push({
      channelNumber: 1,
      channelName: 'Channel 1',
      samples: new Uint8Array(channel1Data)
    });
  }

  return channels;
}

describe('DecoderBase', () => {
  let decoder: TestDecoder;

  beforeEach(() => {
    decoder = new TestDecoder();
  });

  describe('基本属性和方法测试', () => {
    test('抽象属性应该由子类正确实现', () => {
      expect(decoder.id).toBe('test');
      expect(decoder.name).toBe('Test Decoder');
      expect(decoder.longname).toBe('Test Protocol Decoder');
      expect(decoder.desc).toBe('A test decoder for unit testing');
      expect(decoder.license).toBe('test');
      expect(decoder.inputs).toEqual(['logic']);
      expect(decoder.outputs).toEqual(['test']);
      expect(decoder.tags).toEqual(['Test']);
    });

    test('通道定义应该正确', () => {
      expect(decoder.channels).toHaveLength(2);
      expect(decoder.channels[0]).toEqual({
        id: 'clk',
        name: 'Clock',
        desc: 'Clock signal',
        required: true,
        index: 0
      });
      expect(decoder.channels[1]).toEqual({
        id: 'data',
        name: 'Data',
        desc: 'Data signal',
        required: false,
        index: 1
      });
    });

    test('选项定义应该正确', () => {
      expect(decoder.options).toHaveLength(1);
      expect(decoder.options[0]).toEqual({
        id: 'test_option',
        desc: 'Test option',
        default: 'default_value',
        type: 'string'
      });
    });

    test('注释定义应该正确', () => {
      expect(decoder.annotations).toHaveLength(2);
      expect(decoder.annotations[0]).toEqual(['test-ann', 'Test annotation', 'T']);
      expect(decoder.annotations[1]).toEqual(['warning', 'Warning', 'W']);
    });

    test('注释行定义应该正确', () => {
      expect(decoder.annotationRows).toHaveLength(2);
      expect(decoder.annotationRows[0]).toEqual(['test-row', 'Test row', [0]]);
      expect(decoder.annotationRows[1]).toEqual(['warnings', 'Warnings', [1]]);
    });
  });

  describe('getInfo 方法测试', () => {
    test('应该返回完整的解码器信息', () => {
      const info = decoder.getInfo();
      
      expect(info.id).toBe('test');
      expect(info.name).toBe('Test Decoder');
      expect(info.longname).toBe('Test Protocol Decoder');
      expect(info.description).toBe('A test decoder for unit testing');
      expect(info.license).toBe('test');
      expect(info.inputs).toEqual(['logic']);
      expect(info.outputs).toEqual(['test']);
      expect(info.tags).toEqual(['Test']);
      expect(info.channels).toEqual(decoder.channels);
      expect(info.options).toEqual(decoder.options);
      expect(info.annotations).toEqual(decoder.annotations);
      expect(info.annotationRows).toEqual(decoder.annotationRows);
    });
  });

  describe('初始化和重置测试', () => {
    test('start方法应该正确初始化', () => {
      decoder.testStart();
      
      const registeredOutputs = decoder.getRegisteredOutputs();
      expect(registeredOutputs.has(DecoderOutputType.ANNOTATION)).toBe(true);
      expect(registeredOutputs.has(DecoderOutputType.PYTHON)).toBe(true);
      expect(decoder.getSampleIndex()).toBe(0);
      expect(decoder.getResults()).toHaveLength(0);
    });

    test('reset方法应该重置状态', () => {
      // 设置一些状态
      decoder.testStart();
      decoder.testPut(0, 10, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0,
        values: ['test']
      });
      
      // 重置
      decoder.testReset();
      
      expect(decoder.getSampleIndex()).toBe(0);
      expect(decoder.getResults()).toHaveLength(0);
    });

    test('register方法应该注册输出类型', () => {
      const id1 = decoder.testRegister(DecoderOutputType.BINARY);
      const id2 = decoder.testRegister(DecoderOutputType.LOGIC);
      
      expect(id1).not.toBe(id2);
      
      const registeredOutputs = decoder.getRegisteredOutputs();
      expect(registeredOutputs.has(DecoderOutputType.BINARY)).toBe(true);
      expect(registeredOutputs.has(DecoderOutputType.LOGIC)).toBe(true);
    });
  });

  describe('通道数据准备测试', () => {
    test('应该正确准备通道数据', () => {
      const channels = createTestChannelData([1, 0, 1, 0], [0, 1, 0, 1]);
      const channelMapping: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ];

      decoder.testPrepareChannelData(channels, channelMapping);
      
      const channelData = decoder.getChannelData();
      expect(channelData).toHaveLength(2);
      expect(Array.from(channelData[0])).toEqual([1, 0, 1, 0]);
      expect(Array.from(channelData[1])).toEqual([0, 1, 0, 1]);
    });

    test('应该处理稀疏的通道映射', () => {
      const channels = createTestChannelData([1, 0, 1], [0, 1, 0]);
      const channelMapping: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 2 }, // 跳过索引0和1
        { captureIndex: 1, decoderIndex: 0 }  // 映射到索引0
      ];

      decoder.testPrepareChannelData(channels, channelMapping);
      
      const channelData = decoder.getChannelData();
      expect(channelData).toHaveLength(3); // 0, 1, 2
      expect(Array.from(channelData[0])).toEqual([0, 1, 0]); // 来自channel 1
      expect(Array.from(channelData[1])).toEqual([0, 0, 0]); // 默认填充
      expect(Array.from(channelData[2])).toEqual([1, 0, 1]); // 来自channel 0
    });

    test('应该处理空的通道映射', () => {
      const channels = createTestChannelData([1, 0, 1]);
      const channelMapping: DecoderSelectedChannel[] = [];

      decoder.testPrepareChannelData(channels, channelMapping);
      
      const channelData = decoder.getChannelData();
      expect(channelData).toHaveLength(0);
    });

    test('应该处理无效的通道索引', () => {
      const channels = createTestChannelData([1, 0, 1]);
      const channelMapping: DecoderSelectedChannel[] = [
        { captureIndex: 5, decoderIndex: 0 } // 无效的captureIndex
      ];

      decoder.testPrepareChannelData(channels, channelMapping);
      
      const channelData = decoder.getChannelData();
      expect(channelData).toHaveLength(1);
      expect(Array.from(channelData[0])).toEqual([0, 0, 0]); // 默认填充
    });
  });

  describe('getCurrentPins 方法测试', () => {
    test('应该返回当前样本的引脚状态', () => {
      const channels = createTestChannelData([1, 0, 1], [0, 1, 0]);
      decoder.testPrepareChannelData(channels, [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]);

      // 测试不同样本位置
      expect(decoder.testGetCurrentPins()).toEqual([1, 0]); // 初始位置
      
      // 手动设置样本索引（通过内部状态访问）
      (decoder as any).sampleIndex = 1;
      expect(decoder.testGetCurrentPins()).toEqual([0, 1]);
      
      (decoder as any).sampleIndex = 2;
      expect(decoder.testGetCurrentPins()).toEqual([1, 0]);
    });

    test('应该处理超出范围的样本索引', () => {
      const channels = createTestChannelData([1, 0]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      (decoder as any).sampleIndex = 10; // 超出范围
      expect(decoder.testGetCurrentPins()).toEqual([0]);
    });

    test('应该处理空通道数据', () => {
      expect(decoder.testGetCurrentPins()).toEqual([]);
    });
  });

  describe('hasMoreSamples 方法测试', () => {
    test('应该正确检测是否有更多样本', () => {
      const channels = createTestChannelData([1, 0, 1]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      expect(decoder.testHasMoreSamples()).toBe(true);
      
      (decoder as any).sampleIndex = 2;
      expect(decoder.testHasMoreSamples()).toBe(true);
      
      (decoder as any).sampleIndex = 3;
      expect(decoder.testHasMoreSamples()).toBe(false);
    });

    test('应该处理空通道数据', () => {
      expect(decoder.testHasMoreSamples()).toBe(false);
    });
  });

  describe('put 方法测试', () => {
    test('应该正确添加解码结果', () => {
      decoder.testPut(10, 20, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0,
        values: ['Test annotation'],
        rawData: 0x42
      });

      const results = decoder.getResults();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        startSample: 10,
        endSample: 20,
        annotationType: 0,
        values: ['Test annotation'],
        rawData: 0x42,
        shape: 'hexagon'
      });
    });

    test('应该设置默认形状', () => {
      decoder.testPut(0, 5, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 1,
        values: ['Warning']
      });

      const results = decoder.getResults();
      expect(results[0].shape).toBe('hexagon');
    });

    test('应该支持多个结果', () => {
      decoder.testPut(0, 5, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0,
        values: ['First']
      });
      
      decoder.testPut(10, 15, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 1,
        values: ['Second']
      });

      const results = decoder.getResults();
      expect(results).toHaveLength(2);
      expect(results[0].values).toEqual(['First']);
      expect(results[1].values).toEqual(['Second']);
    });
  });

  describe('wait 方法测试', () => {
    test('应该等待单个条件', () => {
      const channels = createTestChannelData([1, 0, 1, 0, 1]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      const condition: WaitCondition = { 0: 'falling' };
      const result = decoder.testWait(condition);

      expect(result.sampleNumber).toBe(1); // 第一个下降沿
      expect(result.pins).toEqual([0]);
    });

    test('应该等待多个条件', () => {
      const channels = createTestChannelData([1, 0, 1, 0], [0, 1, 0, 1]);
      decoder.testPrepareChannelData(channels, [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]);

      const conditions: WaitCondition[] = [
        { 0: 'falling' },
        { 1: 'rising' }
      ];
      
      const result = decoder.testWait(conditions);

      expect(result.matched).toBeDefined();
      expect(result.matchedIndex).toBeDefined();
      expect(result.sampleNumber).toBeGreaterThan(0);
    });

    test('应该处理跳过条件', () => {
      const channels = createTestChannelData([1, 0, 1]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      const condition: WaitCondition = { 0: 'skip' };
      const result = decoder.testWait(condition);

      expect(result.sampleNumber).toBe(0);
      expect(result.pins).toEqual([1]);
    });

    test('应该抛出错误当没有通道数据', () => {
      const condition: WaitCondition = { 0: 'high' };
      
      expect(() => {
        decoder.testWait(condition);
      }).toThrow('No channel data available');
    });

    test('应该抛出错误当到达样本末尾', () => {
      const channels = createTestChannelData([1, 1, 1]); // 全高，无变化
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      const condition: WaitCondition = { 0: 'falling' }; // 等待不存在的下降沿
      
      expect(() => {
        decoder.testWait(condition);
      }).toThrow('End of samples reached');
    });
  });

  describe('matchesCondition 方法测试', () => {
    test('应该匹配高电平条件', () => {
      const pins = [1, 0];
      const conditions = { 0: 'high' as WaitConditionType };
      
      const result = decoder.testMatchesCondition(pins, conditions);
      expect(result).toBe(true);
    });

    test('应该匹配低电平条件', () => {
      const pins = [0, 1];
      const conditions = { 0: 'low' as WaitConditionType };
      
      const result = decoder.testMatchesCondition(pins, conditions);
      expect(result).toBe(true);
    });

    test('应该匹配跳过条件', () => {
      const pins = [0, 1];
      const conditions = { 0: 'skip' as WaitConditionType };
      
      const result = decoder.testMatchesCondition(pins, conditions);
      expect(result).toBe(true);
    });

    test('应该处理无效通道索引', () => {
      const pins = [1];
      const conditions = { 5: 'high' as WaitConditionType }; // 超出范围
      
      const result = decoder.testMatchesCondition(pins, conditions);
      expect(result).toBe(false);
    });

    test('应该匹配多个条件', () => {
      const pins = [1, 0];
      const conditions = { 
        0: 'high' as WaitConditionType,
        1: 'low' as WaitConditionType
      };
      
      const result = decoder.testMatchesCondition(pins, conditions);
      expect(result).toBe(true);
    });

    test('应该失败当任何条件不匹配', () => {
      const pins = [1, 1];
      const conditions = { 
        0: 'high' as WaitConditionType,
        1: 'low' as WaitConditionType  // 这个不匹配
      };
      
      const result = decoder.testMatchesCondition(pins, conditions);
      expect(result).toBe(false);
    });
  });

  describe('waitConditionType 处理测试', () => {
    test('应该正确处理所有条件类型', () => {
      // 模拟设置内部状态
      const channels = createTestChannelData([0, 1, 0]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);
      
      // 设置样本索引和状态
      (decoder as any).sampleIndex = 1;
      (decoder as any).updateCurrentState();

      const pins = [1];
      
      // 测试各种条件类型
      expect(decoder.testMatchesCondition(pins, { 0: 'high' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 0: 'low' })).toBe(false);
      expect(decoder.testMatchesCondition(pins, { 0: 'skip' })).toBe(true);
    });
  });

  describe('validateOptions 方法测试', () => {
    test('应该验证有效配置', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'test_value' }
      ];
      const selectedChannels: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 }
      ];
      const channels = createTestChannelData([1, 0, 1]);

      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(true);
    });

    test('应该拒绝缺少必需通道的配置', () => {
      const options: DecoderOptionValue[] = [];
      const selectedChannels: DecoderSelectedChannel[] = [
        // 缺少必需的时钟通道 (index 0)
        { captureIndex: 1, decoderIndex: 1 }
      ];
      const channels = createTestChannelData([1, 0, 1], [0, 1, 0]);

      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(false);
    });

    test('应该拒绝无效的选项索引', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 99, value: 'invalid' } // 超出范围
      ];
      const selectedChannels: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 }
      ];
      const channels = createTestChannelData([1, 0, 1]);

      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(false);
    });

    test('应该接受空选项', () => {
      const options: DecoderOptionValue[] = [];
      const selectedChannels: DecoderSelectedChannel[] = [
        { captureIndex: 0, decoderIndex: 0 } // 包含必需通道
      ];
      const channels = createTestChannelData([1, 0, 1]);

      const isValid = decoder.validateOptions(options, selectedChannels, channels);
      expect(isValid).toBe(true);
    });
  });

  describe('边界条件和错误处理测试', () => {
    test('应该处理空样本数据', () => {
      const channels = createTestChannelData([]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      expect(decoder.testHasMoreSamples()).toBe(false);
      // 当有一个空通道时，getCurrentPins应该返回[0]而不是[]
      expect(decoder.testGetCurrentPins()).toEqual([0]);
    });

    test('应该处理单样本数据', () => {
      const channels = createTestChannelData([1]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      expect(decoder.testHasMoreSamples()).toBe(true);
      expect(decoder.testGetCurrentPins()).toEqual([1]);
      
      (decoder as any).sampleIndex = 1;
      expect(decoder.testHasMoreSamples()).toBe(false);
    });

    test('应该处理不匹配的通道长度', () => {
      const channels = [
        {
          channelNumber: 0,
          channelName: 'CH0',
          samples: new Uint8Array([1, 0, 1])
        },
        {
          channelNumber: 1,
          channelName: 'CH1',
          samples: new Uint8Array([0, 1]) // 较短
        }
      ];

      decoder.testPrepareChannelData(channels, [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]);

      // 应该能处理不同长度的通道
      expect(decoder.testGetCurrentPins()).toEqual([1, 0]);
      
      (decoder as any).sampleIndex = 2;
      expect(decoder.testGetCurrentPins()).toEqual([1, 0]); // 短通道用默认值填充
    });
  });

  describe('复杂场景测试', () => {
    test('应该处理复杂的等待条件序列', () => {
      // 创建更复杂的信号模式
      const clk = [0, 1, 0, 1, 0, 1, 0, 1];
      const data = [1, 1, 0, 0, 1, 1, 0, 0];
      const channels = createTestChannelData(clk, data);
      
      decoder.testPrepareChannelData(channels, [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]);

      // 等待时钟上升沿且数据为低
      const conditions: WaitCondition[] = [
        { 0: 'rising', 1: 'low' }
      ];

      const result = decoder.testWait(conditions);
      expect(result.matched).toBeDefined();
      expect(result.matchedIndex).toBeDefined();
    });

    test('应该处理多轮等待', () => {
      const channels = createTestChannelData([1, 0, 1, 0, 1, 0]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      // 第一轮等待
      let result1 = decoder.testWait({ 0: 'falling' });
      expect(result1.sampleNumber).toBe(1);

      // 继续从当前位置等待
      let result2 = decoder.testWait({ 0: 'rising' });
      expect(result2.sampleNumber).toBe(2);
      expect(result2.sampleNumber).toBeGreaterThan(result1.sampleNumber);
    });
  });

  describe('性能测试', () => {
    test('应该能处理大量数据', () => {
      const size = 10000;
      const largeData = new Array(size).fill(0).map((_, i) => i % 2);
      const channels = createTestChannelData(largeData);
      
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      const startTime = performance.now();
      
      // 测试基本操作的性能
      expect(decoder.testHasMoreSamples()).toBe(true);
      expect(decoder.testGetCurrentPins()).toHaveLength(1);
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // 应该很快
    });

    test('多个put操作的性能', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        decoder.testPut(i * 10, i * 10 + 5, {
          type: DecoderOutputType.ANNOTATION,
          annotationType: 0,
          values: [`Result ${i}`]
        });
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // 1秒内
      expect(decoder.getResults()).toHaveLength(1000);
    });
  });

  describe('状态管理测试', () => {
    test('应该正确管理内部状态', () => {
      const channels = createTestChannelData([0, 1, 0, 1]);
      decoder.testPrepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);

      // 初始状态
      expect(decoder.getSampleIndex()).toBe(0);
      
      // 执行wait操作应该更新状态
      decoder.testWait({ 0: 'rising' });
      expect(decoder.getSampleIndex()).toBeGreaterThan(0);
      
      // 重置应该恢复初始状态
      decoder.testReset();
      expect(decoder.getSampleIndex()).toBe(0);
    });

    test('应该维护输出注册', () => {
      decoder.testStart();
      
      const outputs = decoder.getRegisteredOutputs();
      expect(outputs.size).toBeGreaterThan(0);
      
      const customOutputId = decoder.testRegister(DecoderOutputType.BINARY);
      expect(outputs.has(DecoderOutputType.BINARY)).toBe(true);
      expect(outputs.get(DecoderOutputType.BINARY)).toBe(customOutputId);
    });
  });

  describe('多实例测试', () => {
    test('不同实例应该有独立的状态', () => {
      const decoder2 = new TestDecoder();
      
      // 为第一个解码器设置状态
      decoder.testPut(0, 5, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 0,
        values: ['Decoder 1']
      });
      
      // 为第二个解码器设置不同状态
      decoder2.testPut(10, 15, {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 1,
        values: ['Decoder 2']
      });
      
      // 验证状态独立
      expect(decoder.getResults()).toHaveLength(1);
      expect(decoder2.getResults()).toHaveLength(1);
      expect(decoder.getResults()[0].values).toEqual(['Decoder 1']);
      expect(decoder2.getResults()[0].values).toEqual(['Decoder 2']);
    });
  });
});