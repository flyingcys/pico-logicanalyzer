/**
 * DecoderBase.ts 单元测试
 * 测试TypeScript解码器基类的所有核心功能
 */

import { DecoderBase } from '../../../src/decoders/DecoderBase';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';
import { 
  DecoderChannel, 
  DecoderOption, 
  DecoderOptionValue, 
  DecoderResult, 
  WaitCondition, 
  WaitResult, 
  DecoderOutputType,
  DecoderSelectedChannel,
  ChannelData,
  DecoderOutput
} from '../../../src/decoders/types';

// Mock console methods to avoid log output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// 创建测试用的具体解码器实现
class TestDecoder extends DecoderBase {
  readonly id = 'test-decoder';
  readonly name = 'Test Decoder';
  readonly longname = 'Test Protocol Decoder';
  readonly desc = 'A test decoder for unit testing';
  readonly license = 'MIT';
  readonly inputs = ['logic'];
  readonly outputs = ['annotation'];
  readonly tags = ['test', 'mock'];
  
  readonly channels: DecoderChannel[] = [
    {
      id: 'data',
      name: 'DATA',
      desc: 'Data line',
      required: true,
      index: 0
    },
    {
      id: 'clock',
      name: 'CLOCK',
      desc: 'Clock line',
      required: true,
      index: 1
    },
    {
      id: 'enable',
      name: 'ENABLE',
      desc: 'Enable signal',
      required: false,
      index: 2
    }
  ];

  readonly options: DecoderOption[] = [
    {
      id: 'bitorder',
      desc: 'Bit order',
      default: 'msb-first',
      values: ['msb-first', 'lsb-first']
    }
  ];

  readonly annotations: Array<[string, string, string?]> = [
    ['data', 'Data', 'Data bytes'],
    ['warning', 'Warning', 'Warning messages'],
    ['error', 'Error', 'Error messages']
  ];

  readonly annotationRows: Array<[string, string, number[]]> = [
    ['data-row', 'Data', [0]],
    ['warnings-row', 'Warnings', [1]],
    ['errors-row', 'Errors', [2]]
  ];

  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    this.sampleRate = sampleRate;
    this.start();
    
    // 简单的解码逻辑用于测试
    try {
      while (this.hasMoreSamples()) {
        const waitResult = this.wait({ 0: 'rising' });
        if (waitResult.sampleNumber !== undefined) {
          this.put(waitResult.sampleNumber, waitResult.sampleNumber + 1, {
            annotationType: 0,
            values: ['test-data'],
            rawData: new Uint8Array([1])
          });
        }
      }
    } catch (error) {
      // 正常结束
    }
    
    return this.results;
  }

  // 暴露protected方法用于测试
  public testStart(): void {
    this.start();
  }

  public testReset(): void {
    this.reset();
  }

  public testRegister(outputType: DecoderOutputType): number {
    return this.register(outputType);
  }

  public testWait(conditions: WaitCondition): WaitResult {
    return this.wait(conditions);
  }

  public testPut(startSample: number, endSample: number, data: DecoderOutput): void {
    this.put(startSample, endSample, data);
  }

  public testHasMoreSamples(): boolean {
    return this.hasMoreSamples();
  }

  public testGetCurrentPins(): number[] {
    return this.getCurrentPins();
  }

  public testMatchesCondition(pins: number[], conditions: { [key: number]: import('../../../src/decoders/types').WaitConditionType }): boolean {
    return this.matchesCondition(pins, conditions);
  }

  public testPrepareChannelData(channels: ChannelData[], selectedChannels: DecoderSelectedChannel[]): void {
    this.prepareChannelData(channels, selectedChannels);
  }

  // 访问受保护的属性用于测试
  public get testSampleIndex(): number {
    return this.sampleIndex;
  }

  public get testChannelData(): Uint8Array[] {
    return this.channelData;
  }

  public get testResults(): DecoderResult[] {
    return this.results;
  }

  public get testRegisteredOutputs(): Map<DecoderOutputType, number> {
    return this.registeredOutputs;
  }

  public get testCurrentState(): Map<number, number> {
    return this.currentState;
  }

  public get testLastState(): Map<number, number> {
    return this.lastState;
  }

  public setSampleIndex(index: number): void {
    this.sampleIndex = index;
  }

  public setChannelData(data: Uint8Array[]): void {
    this.channelData = data;
  }
}

describe('DecoderBase', () => {
  let decoder: TestDecoder;
  let mockChannelData: ChannelData[];

  beforeEach(() => {
    decoder = new TestDecoder();
    
    // 创建模拟通道数据
    mockChannelData = [
      {
        name: 'CH0',
        samples: new Uint8Array([0, 1, 0, 1, 1, 0, 1, 0])
      },
      {
        name: 'CH1', 
        samples: new Uint8Array([0, 0, 1, 1, 0, 0, 1, 1])
      },
      {
        name: 'CH2',
        samples: new Uint8Array([1, 1, 1, 0, 0, 1, 1, 0])
      }
    ];

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });
  describe('解码器元数据', () => {
    it('应该正确提供解码器基本信息', () => {
      expect(decoder.id).toBe('test-decoder');
      expect(decoder.name).toBe('Test Decoder');
      expect(decoder.longname).toBe('Test Protocol Decoder');
      expect(decoder.desc).toBe('A test decoder for unit testing');
      expect(decoder.license).toBe('MIT');
    });

    it('应该正确定义输入输出类型', () => {
      expect(decoder.inputs).toEqual(['logic']);
      expect(decoder.outputs).toEqual(['annotation']);
      expect(decoder.tags).toContain('test');
      expect(decoder.tags).toContain('mock');
    });

    it('应该正确定义通道配置', () => {
      expect(decoder.channels).toHaveLength(3);
      
      const dataChannel = decoder.channels[0];
      expect(dataChannel.id).toBe('data');
      expect(dataChannel.name).toBe('DATA');
      expect(dataChannel.required).toBe(true);
      expect(dataChannel.index).toBe(0);

      const clockChannel = decoder.channels[1];
      expect(clockChannel.id).toBe('clock');
      expect(clockChannel.required).toBe(true);

      const enableChannel = decoder.channels[2];
      expect(enableChannel.id).toBe('enable');
      expect(enableChannel.required).toBe(false);
    });

    it('应该正确定义选项配置', () => {
      expect(decoder.options).toHaveLength(1);
      
      const bitOrderOption = decoder.options[0];
      expect(bitOrderOption.id).toBe('bitorder');
      expect(bitOrderOption.desc).toBe('Bit order');
      expect(bitOrderOption.default).toBe('msb-first');
      expect(bitOrderOption.values).toContain('msb-first');
      expect(bitOrderOption.values).toContain('lsb-first');
    });

    it('应该正确定义注释类型', () => {
      expect(decoder.annotations).toHaveLength(3);
      
      expect(decoder.annotations[0]).toEqual(['data', 'Data', 'Data bytes']);
      expect(decoder.annotations[1]).toEqual(['warning', 'Warning', 'Warning messages']);
      expect(decoder.annotations[2]).toEqual(['error', 'Error', 'Error messages']);
    });

    it('应该正确定义注释行', () => {
      expect(decoder.annotationRows).toHaveLength(3);
      
      expect(decoder.annotationRows![0]).toEqual(['data-row', 'Data', [0]]);
      expect(decoder.annotationRows![1]).toEqual(['warnings-row', 'Warnings', [1]]);
      expect(decoder.annotationRows![2]).toEqual(['errors-row', 'Errors', [2]]);
    });
  });

  describe('初始化和重置', () => {
    it('应该正确初始化解码器', () => {
      decoder.testStart();

      expect(decoder.testRegisteredOutputs.size).toBeGreaterThan(0);
      expect(decoder.testRegisteredOutputs.has(DecoderOutputType.ANNOTATION)).toBe(true);
      expect(decoder.testRegisteredOutputs.has(DecoderOutputType.PYTHON)).toBe(true);
    });

    it('应该正确重置解码器状态', () => {
      // 设置一些状态
      decoder.setSampleIndex(5);
      decoder.testPut(0, 1, { annotationType: 0, values: ['test'] });
      decoder.testCurrentState.set(0, 1);
      decoder.testLastState.set(0, 0);

      // 重置
      decoder.testReset();

      expect(decoder.testSampleIndex).toBe(0);
      expect(decoder.testResults).toHaveLength(0);
      expect(decoder.testCurrentState.size).toBe(0);
      expect(decoder.testLastState.size).toBe(0);
    });

    it('应该正确注册输出类型', () => {
      const annotationId = decoder.testRegister(DecoderOutputType.ANNOTATION);
      const pythonId = decoder.testRegister(DecoderOutputType.PYTHON);

      expect(annotationId).toBe(0);
      expect(pythonId).toBe(1);
      expect(decoder.testRegisteredOutputs.get(DecoderOutputType.ANNOTATION)).toBe(0);
      expect(decoder.testRegisteredOutputs.get(DecoderOutputType.PYTHON)).toBe(1);
    });
  });

  describe('通道数据管理', () => {
    it('应该正确准备通道数据', () => {
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 },
        { decoderIndex: 1, captureIndex: 1 },
        { decoderIndex: 2, captureIndex: 2 }
      ];

      decoder.testPrepareChannelData(mockChannelData, selectedChannels);

      expect(decoder.testChannelData).toHaveLength(3);
      expect(decoder.testChannelData[0]).toEqual(mockChannelData[0].samples);
      expect(decoder.testChannelData[1]).toEqual(mockChannelData[1].samples);
      expect(decoder.testChannelData[2]).toEqual(mockChannelData[2].samples);
    });

    it('应该处理缺失的通道映射', () => {
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 },
        { decoderIndex: 2, captureIndex: 1 }
        // 缺少第1个通道的映射，但有第0和第2个
      ];

      decoder.testPrepareChannelData(mockChannelData, selectedChannels);

      expect(decoder.testChannelData[0]).toEqual(mockChannelData[0].samples);
      expect(decoder.testChannelData[1]).toEqual(new Uint8Array(8)); // 应该是空数据
      expect(decoder.testChannelData[2]).toEqual(mockChannelData[1].samples);
    });

    it('应该正确检测是否有更多样本', () => {
      decoder.setChannelData([new Uint8Array([1, 0, 1])]);
      
      expect(decoder.testHasMoreSamples()).toBe(true);
      
      decoder.setSampleIndex(2);
      expect(decoder.testHasMoreSamples()).toBe(true);
      
      decoder.setSampleIndex(3);
      expect(decoder.testHasMoreSamples()).toBe(false);
    });

    it('应该正确获取当前引脚状态', () => {
      decoder.setChannelData([
        new Uint8Array([0, 1, 0]),
        new Uint8Array([1, 0, 1])
      ]);

      decoder.setSampleIndex(0);
      expect(decoder.testGetCurrentPins()).toEqual([0, 1]);

      decoder.setSampleIndex(1);
      expect(decoder.testGetCurrentPins()).toEqual([1, 0]);

      decoder.setSampleIndex(2);
      expect(decoder.testGetCurrentPins()).toEqual([0, 1]);
    });
  });

  describe('等待条件 (wait)', () => {
    beforeEach(() => {
      decoder.setChannelData([
        new Uint8Array([0, 1, 1, 0, 1, 0, 0, 1]),
        new Uint8Array([0, 0, 1, 1, 0, 1, 1, 0])
      ]);
      decoder.setSampleIndex(0);
    });

    it('应该等待上升沿条件', () => {
      const result = decoder.testWait({ 0: 'rising' });

      expect(result.sampleNumber).toBe(1); // 第一个上升沿
      expect(result.pins).toEqual([1, 0]);
    });

    it('应该等待下降沿条件', () => {
      decoder.setSampleIndex(2); // 从索引2开始
      const result = decoder.testWait({ 0: 'falling' });

      expect(result.sampleNumber).toBe(3); // 第一个下降沿
      expect(result.pins).toEqual([0, 1]);
    });

    it('应该等待高电平条件', () => {
      const result = decoder.testWait({ 0: 'high' });

      expect(result.sampleNumber).toBe(1); // 第一个高电平
      expect(result.pins).toEqual([1, 0]);
    });

    it('应该等待低电平条件', () => {
      const result = decoder.testWait({ 0: 'low' });

      expect(result.sampleNumber).toBe(0); // 初始低电平
      expect(result.pins).toEqual([0, 0]);
    });

    it('应该等待边沿变化条件', () => {
      const result = decoder.testWait({ 0: 'edge' });

      expect(result.sampleNumber).toBe(1); // 第一个边沿变化
      expect(result.pins).toEqual([1, 0]);
    });

    it('应该等待多通道条件', () => {
      // 设置特殊数据让两个通道在同一位置都有上升沿
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1]),
        new Uint8Array([0, 1, 0, 1])
      ]);
      decoder.setSampleIndex(0);
      
      const result = decoder.testWait({ 0: 'rising', 1: 'rising' });

      expect(result.sampleNumber).toBe(1); // 两个通道都上升的位置
      expect(result.pins).toEqual([1, 1]);
    });

    it('应该在样本结束时抛出异常', () => {
      decoder.setSampleIndex(8); // 超出数组范围 
      
      expect(() => {
        decoder.testWait({ 0: 'rising' });
      }).toThrow('End of samples reached');
    });

    it('应该在没有通道数据时抛出异常', () => {
      decoder.setChannelData([]);
      
      expect(() => {
        decoder.testWait({ 0: 'high' });
      }).toThrow('No channel data available');
    });

    it('应该处理跳过条件的特殊情况', () => {
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1])
      ]);
      decoder.setSampleIndex(2);
      
      const result = decoder.testWait({ 0: 'skip' });
      
      expect(result.sampleNumber).toBe(2);
      expect(result.pins).toEqual([0]);
    });

    it('应该等待稳定条件', () => {
      decoder.setChannelData([
        new Uint8Array([0, 0, 1, 1, 1, 0]) // 在索引0时，lastState默认0，current也是0，所以匹配stable
      ]);
      decoder.setSampleIndex(0);
      
      const result = decoder.testWait({ 0: 'stable' });
      
      expect(result.sampleNumber).toBe(0); // 第一个稳定位置（0->0）
      expect(result.pins).toEqual([0]);
    });

    it('应该处理通道索引超出范围的情况', () => {
      decoder.setChannelData([
        new Uint8Array([0, 1])
      ]);
      decoder.setSampleIndex(0);
      
      // 等待不存在的通道2，应该到样本末尾
      expect(() => {
        decoder.testWait({ 2: 'high' });
      }).toThrow('End of samples reached');
    });

    it('应该在wait条件中处理skip和default类型', () => {
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1])
      ]);
      decoder.setSampleIndex(1);
      
      // 测试skip条件，会立即匹配
      const skipResult = decoder.testWait({ 0: 'skip' });
      expect(skipResult.sampleNumber).toBe(1);
      
      // 重置位置测试无效条件类型
      decoder.setSampleIndex(0);
      expect(() => {
        decoder.testWait({ 0: 'invalid' as any });
      }).toThrow('End of samples reached');
    });
  });

  describe('输出处理 (put)', () => {
    it('应该正确输出解码结果', () => {
      const outputData: DecoderOutput = {
        annotationType: 0,
        values: ['test-value'],
        rawData: new Uint8Array([0x42])
      };

      decoder.testPut(10, 20, outputData);

      expect(decoder.testResults).toHaveLength(1);
      const result = decoder.testResults[0];
      expect(result.startSample).toBe(10);
      expect(result.endSample).toBe(20);
      expect(result.annotationType).toBe(0);
      expect(result.values).toEqual(['test-value']);
      expect(result.rawData).toEqual(new Uint8Array([0x42]));
      expect(result.shape).toBe('hexagon'); // 默认形状
    });

    it('应该支持多个输出结果', () => {
      decoder.testPut(0, 5, { annotationType: 0, values: ['first'] });
      decoder.testPut(5, 10, { annotationType: 1, values: ['second'] });
      decoder.testPut(10, 15, { annotationType: 2, values: ['third'] });

      expect(decoder.testResults).toHaveLength(3);
      expect(decoder.testResults[0].values).toEqual(['first']);
      expect(decoder.testResults[1].values).toEqual(['second']);
      expect(decoder.testResults[2].values).toEqual(['third']);
    });

    it('应该处理缺少注释类型的输出', () => {
      const outputData: DecoderOutput = {
        values: ['no-annotation-type']
      };

      decoder.testPut(0, 1, outputData);

      const result = decoder.testResults[0];
      expect(result.annotationType).toBe(0); // 默认值
    });
  });

  describe('条件匹配', () => {
    it('应该正确匹配引脚条件', () => {
      const pins = [1, 0, 1];
      decoder.testLastState.set(0, 0);
      decoder.testLastState.set(1, 1);
      decoder.testLastState.set(2, 1);

      // 测试各种条件
      expect(decoder.testMatchesCondition(pins, { 0: 'high' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 1: 'low' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 0: 'rising' })).toBe(true); // 0->1
      expect(decoder.testMatchesCondition(pins, { 1: 'falling' })).toBe(true); // 1->0
      expect(decoder.testMatchesCondition(pins, { 2: 'stable' })).toBe(true); // 1->1
    });

    it('应该正确拒绝不匹配的条件', () => {
      const pins = [1, 0, 1];
      decoder.testLastState.set(0, 0);

      expect(decoder.testMatchesCondition(pins, { 0: 'low' })).toBe(false);
      expect(decoder.testMatchesCondition(pins, { 1: 'high' })).toBe(false);
      expect(decoder.testMatchesCondition(pins, { 0: 'falling' })).toBe(false);
    });

    it('应该处理跳过条件', () => {
      const pins = [0, 1, 0];
      
      expect(decoder.testMatchesCondition(pins, { 0: 'skip' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 1: 'skip' })).toBe(true);
    });

    it('应该要求所有条件都匹配', () => {
      const pins = [1, 1];
      
      // 两个条件都匹配
      expect(decoder.testMatchesCondition(pins, { 0: 'high', 1: 'high' })).toBe(true);
      
      // 一个匹配，一个不匹配
      expect(decoder.testMatchesCondition(pins, { 0: 'high', 1: 'low' })).toBe(false);
    });

    it('应该处理稳定条件匹配', () => {
      const pins = [1, 0];
      decoder.testLastState.set(0, 1); // 相同值，稳定
      decoder.testLastState.set(1, 1); // 不同值，不稳定
      
      expect(decoder.testMatchesCondition(pins, { 0: 'stable' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 1: 'stable' })).toBe(false);
    });

    it('应该处理边沿条件匹配', () => {
      const pins = [1, 0, 1];
      decoder.testLastState.set(0, 0); // 0->1 边沿
      decoder.testLastState.set(1, 0); // 0->0 无边沿
      decoder.testLastState.set(2, 1); // 1->1 无边沿
      
      expect(decoder.testMatchesCondition(pins, { 0: 'edge' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 1: 'edge' })).toBe(false);
      expect(decoder.testMatchesCondition(pins, { 2: 'edge' })).toBe(false);
    });

    it('应该处理超出范围的通道索引', () => {
      const pins = [1, 0]; // 只有2个通道
      
      // 尝试访问不存在的通道2
      expect(decoder.testMatchesCondition(pins, { 2: 'high' })).toBe(false);
    });

    it('应该处理无效的条件类型', () => {
      const pins = [1];
      
      // 测试default分支 - 使用无效的条件类型
      expect(decoder.testMatchesCondition(pins, { 0: 'invalid' as any })).toBe(false);
    });
  });

  describe('选项验证', () => {
    it('应该验证有效的选项配置', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'msb-first' }
      ];
      
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 }, // DATA channel (required)
        { decoderIndex: 1, captureIndex: 1 }  // CLOCK channel (required)
      ];

      const isValid = decoder.validateOptions(options, selectedChannels, mockChannelData);
      expect(isValid).toBe(true);
    });

    it('应该拒绝缺少必需通道的配置', () => {
      const options: DecoderOptionValue[] = [];
      
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 } // 只有DATA，缺少CLOCK
      ];

      const isValid = decoder.validateOptions(options, selectedChannels, mockChannelData);
      expect(isValid).toBe(false);
    });

    it('应该拒绝无效的选项索引', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 10, value: 'invalid' } // 超出选项范围
      ];
      
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 },
        { decoderIndex: 1, captureIndex: 1 }
      ];

      const isValid = decoder.validateOptions(options, selectedChannels, mockChannelData);
      expect(isValid).toBe(false);
    });
  });

  describe('解码器信息', () => {
    it('应该返回完整的解码器信息', () => {
      const info = decoder.getInfo();

      expect(info.id).toBe('test-decoder');
      expect(info.name).toBe('Test Decoder');
      expect(info.longname).toBe('Test Protocol Decoder');
      expect(info.description).toBe('A test decoder for unit testing');
      expect(info.license).toBe('MIT');
      expect(info.inputs).toEqual(['logic']);
      expect(info.outputs).toEqual(['annotation']);
      expect(info.tags).toEqual(['test', 'mock']);
      expect(info.channels).toBe(decoder.channels);
      expect(info.options).toBe(decoder.options);
      expect(info.annotations).toBe(decoder.annotations);
      expect(info.annotationRows).toBe(decoder.annotationRows);
    });
  });

  describe('完整的解码流程', () => {
    it('应该成功执行完整的解码流程', () => {
      const options: DecoderOptionValue[] = [
        { optionIndex: 0, value: 'msb-first' }
      ];

      const results = decoder.decode(1000000, mockChannelData, options);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(decoder.sampleRate).toBe(1000000);
    });

    it('应该处理没有数据的解码', () => {
      const emptyChannels: ChannelData[] = [
        { name: 'CH0', samples: new Uint8Array([]) }
      ];

      const results = decoder.decode(1000000, emptyChannels, []);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理极大的样本索引', () => {
      decoder.setSampleIndex(Number.MAX_SAFE_INTEGER);
      decoder.setChannelData([
        new Uint8Array([1, 0, 1]),
        new Uint8Array([0, 1, 0]),
        new Uint8Array([1, 1, 0])
      ]);

      expect(decoder.testHasMoreSamples()).toBe(false);
      expect(decoder.testGetCurrentPins()).toEqual([0, 0, 0]); // 超出范围返回0
    });

    it('应该处理空的通道数据数组', () => {
      decoder.setChannelData([]);

      expect(decoder.testHasMoreSamples()).toBe(false);
      expect(decoder.testGetCurrentPins()).toEqual([]);
    });

    it('应该处理不同长度的通道数据', () => {
      decoder.setChannelData([
        new Uint8Array([1, 0]),      // 长度2
        new Uint8Array([1, 0, 1]),   // 长度3
        new Uint8Array([1])          // 长度1
      ]);

      decoder.setSampleIndex(0);
      expect(decoder.testGetCurrentPins()).toEqual([1, 1, 1]);

      decoder.setSampleIndex(1);
      expect(decoder.testGetCurrentPins()).toEqual([0, 0, 0]); // 第三个通道超出范围

      decoder.setSampleIndex(2);
      expect(decoder.testGetCurrentPins()).toEqual([0, 1, 0]); // 前两个通道超出范围
    });

    it('应该处理数组形式的等待条件', () => {
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1]),
        new Uint8Array([0, 0, 1, 1])
      ]);
      decoder.setSampleIndex(0);
      
      // 测试传递数组形式的条件（覆盖第116行的Array.isArray分支）
      const arrayConditions = [{ 0: 'rising' }, { 1: 'rising' }];
      const result = decoder.testWait(arrayConditions);
      
      expect(result.sampleNumber).toBe(1); // 第一个匹配的条件
      expect(result.pins).toEqual([1, 0]);
    });

    it('应该测试checkSingleCondition中的skip条件', () => {
      const pins = [1, 0];
      
      // 通过matchesCondition间接测试checkSingleCondition的skip分支（覆盖第240行）
      expect(decoder.testMatchesCondition(pins, { 0: 'skip' })).toBe(true);
      expect(decoder.testMatchesCondition(pins, { 1: 'skip' })).toBe(true);
    });

    it('应该处理超出样本索引范围的updateCurrentState', () => {
      decoder.setChannelData([
        new Uint8Array([1, 0]),  // 长度2
        new Uint8Array([0, 1])   // 长度2
      ]);
      
      // 设置超出范围的索引以覆盖第265行的else分支
      decoder.setSampleIndex(5); // 超出数组长度
      
      // 调用wait方法会触发updateCurrentState
      expect(() => {
        decoder.testWait({ 0: 'high' });
      }).toThrow('End of samples reached');
    });

    it('应该处理prepareChannelData中的空samples', () => {
      // 测试channels[0].samples为undefined的情况（覆盖第345行的||0分支）
      const channelsWithoutSamples: ChannelData[] = [
        { name: 'CH0' }, // 没有samples属性
        { name: 'CH1', samples: new Uint8Array([1, 0]) }
      ];
      
      const selectedChannels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 },
        { decoderIndex: 1, captureIndex: 1 }
      ];

      decoder.testPrepareChannelData(channelsWithoutSamples, selectedChannels);
      
      // 应该创建长度为0的数组
      expect(decoder.testChannelData[0]).toEqual(new Uint8Array(0));
      expect(decoder.testChannelData[1]).toEqual(new Uint8Array([1, 0]));
    });
  });
});