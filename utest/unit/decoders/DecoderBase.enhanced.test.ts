/**
 * DecoderBase.ts 增强测试 - 100%覆盖率突破
 * 专门针对第240行 checkSingleCondition 中的 skip 分支
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

// 测试解码器实现
class EnhancedTestDecoder extends DecoderBase {
  readonly id = 'enhanced-test-decoder';
  readonly name = 'Enhanced Test Decoder';
  readonly longname = 'Enhanced Test Protocol Decoder';
  readonly desc = 'An enhanced test decoder for complete coverage';
  readonly license = 'MIT';
  readonly inputs = ['logic'];
  readonly outputs = ['annotation'];
  readonly tags = ['test', 'enhanced'];
  
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
    }
  ];

  readonly options: DecoderOption[] = [];

  readonly annotations: Array<[string, string, string?]> = [
    ['data', 'Data', 'Data bytes']
  ];

  readonly annotationRows: Array<[string, string, number[]]> = [
    ['data-row', 'Data', [0]]
  ];

  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    this.sampleRate = sampleRate;
    this.start();
    
    // 准备通道数据
    const selectedChannels: DecoderSelectedChannel[] = [
      { decoderIndex: 0, captureIndex: 0 },
      { decoderIndex: 1, captureIndex: 1 }
    ];
    this.prepareChannelData(channels, selectedChannels);
    
    return this.results;
  }

  // 暴露私有方法用于测试
  public testCheckConditions(conditions: WaitCondition): boolean[] {
    return (this as any).checkConditions(conditions);
  }
  
  public testCheckSingleCondition(channelIndex: number, conditionType: any): boolean {
    return (this as any).checkSingleCondition(channelIndex, conditionType);
  }

  public testUpdateCurrentState(): void {
    (this as any).updateCurrentState();
  }

  public setSampleIndex(index: number): void {
    this.sampleIndex = index;
  }

  public setChannelData(data: Uint8Array[]): void {
    this.channelData = data;
  }

  public setCurrentState(state: Map<number, number>): void {
    this.currentState = state;
  }

  public setLastState(state: Map<number, number>): void {
    this.lastState = state;
  }
}

describe('DecoderBase Enhanced Coverage Tests', () => {
  let decoder: EnhancedTestDecoder;

  beforeEach(() => {
    decoder = new EnhancedTestDecoder();
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('checkSingleCondition skip分支覆盖测试 (第240行)', () => {
    it('应该直接通过checkSingleCondition测试skip条件', () => {
      // 设置测试数据
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1]),
        new Uint8Array([1, 0, 1, 0])
      ]);
      decoder.setSampleIndex(0);
      
      // 设置当前状态和上一状态
      const currentState = new Map<number, number>();
      currentState.set(0, 0);
      currentState.set(1, 1);
      decoder.setCurrentState(currentState);
      
      const lastState = new Map<number, number>();
      lastState.set(0, 1);
      lastState.set(1, 0);
      decoder.setLastState(lastState);
      
      // 直接测试 checkSingleCondition 中的 skip 分支 (第240行)
      const result = decoder.testCheckSingleCondition(0, 'skip');
      
      // skip 条件应该总是返回 true
      expect(result).toBe(true);
    });
    
    it('应该通过checkConditions调用checkSingleCondition的skip分支', () => {
      // 设置测试数据
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1]),
        new Uint8Array([1, 0, 1, 0])
      ]);
      decoder.setSampleIndex(0);
      
      // 设置状态
      decoder.testUpdateCurrentState();
      
      // 测试包含skip条件的多条件组合
      const conditions: WaitCondition = {
        0: 'skip',  // 这会调用 checkSingleCondition 的 skip 分支
        1: 'high'   // 这会调用其他分支
      };
      
      const results = decoder.testCheckConditions(conditions);
      
      // skip 条件应该返回 true，high 条件在当前状态下应该返回 true (值为1)
      expect(results).toHaveLength(2);
      expect(results[0]).toBe(true);  // skip 条件
    });

    it('应该在不同通道索引上测试skip条件', () => {
      // 设置测试数据
      decoder.setChannelData([
        new Uint8Array([0, 1]),
        new Uint8Array([1, 0]),
        new Uint8Array([0, 0])
      ]);
      decoder.setSampleIndex(0);
      
      // 测试不同通道的skip条件
      expect(decoder.testCheckSingleCondition(0, 'skip')).toBe(true);
      expect(decoder.testCheckSingleCondition(1, 'skip')).toBe(true);
      expect(decoder.testCheckSingleCondition(2, 'skip')).toBe(true);
    });

    it('应该测试超出范围通道的skip条件', () => {
      // 设置只有2个通道的数据
      decoder.setChannelData([
        new Uint8Array([0, 1]),
        new Uint8Array([1, 0])
      ]);
      decoder.setSampleIndex(0);
      
      // 测试超出范围的通道索引，但条件是skip
      // 即使通道不存在，skip条件也应该返回true，但由于第218-220行的检查，会先返回false
      const result = decoder.testCheckSingleCondition(5, 'skip');
      expect(result).toBe(false); // 因为第218行检查 channelIndex >= this.channelData.length
    });

    it('应该在wait方法中通过复杂条件组合测试skip分支', () => {
      // 设置测试数据  
      decoder.setChannelData([
        new Uint8Array([0, 1, 0, 1])
      ]);
      decoder.setSampleIndex(0);
      
      // 创建复杂的条件组合，包含skip但不是单纯的skip条件
      // 这样会绕过第119行的 isSkipCondition 检查，进入正常的条件匹配流程
      const complexConditions: WaitCondition[] = [
        { 0: 'skip' },    // 第一个条件组合
        { 0: 'high' }     // 第二个条件组合  
      ];
      
      // 通过wait方法间接调用checkSingleCondition的skip分支
      const result = (decoder as any).wait(complexConditions);
      
      // 应该匹配第一个条件组合（skip总是匹配）
      expect(result.sampleNumber).toBe(0);
      expect(result.matchedIndex).toBe(0);
    });

    it('应该验证skip条件在所有通道状态下都返回true', () => {
      // 测试各种状态组合
      const testCases = [
        { current: 0, last: 0 },
        { current: 0, last: 1 },
        { current: 1, last: 0 },
        { current: 1, last: 1 }
      ];

      for (const testCase of testCases) {
        decoder.setChannelData([new Uint8Array([testCase.current])]);
        decoder.setSampleIndex(0);
        
        const currentState = new Map<number, number>();
        currentState.set(0, testCase.current);
        decoder.setCurrentState(currentState);
        
        const lastState = new Map<number, number>();
        lastState.set(0, testCase.last);
        decoder.setLastState(lastState);
        
        const result = decoder.testCheckSingleCondition(0, 'skip');
        expect(result).toBe(true);
      }
    });
  });

  describe('其他边界条件覆盖测试', () => {
    it('应该测试checkSingleCondition的所有分支', () => {
      decoder.setChannelData([new Uint8Array([1])]);
      decoder.setSampleIndex(0);
      
      const currentState = new Map<number, number>();
      currentState.set(0, 1);
      decoder.setCurrentState(currentState);
      
      const lastState = new Map<number, number>();
      lastState.set(0, 0);
      decoder.setLastState(lastState);
      
      // 测试所有条件类型
      expect(decoder.testCheckSingleCondition(0, 'low')).toBe(false);    // current = 1
      expect(decoder.testCheckSingleCondition(0, 'high')).toBe(true);    // current = 1
      expect(decoder.testCheckSingleCondition(0, 'rising')).toBe(true);  // 0->1
      expect(decoder.testCheckSingleCondition(0, 'falling')).toBe(false); // 0->1
      expect(decoder.testCheckSingleCondition(0, 'edge')).toBe(true);    // 0≠1
      expect(decoder.testCheckSingleCondition(0, 'stable')).toBe(false); // 0≠1
      expect(decoder.testCheckSingleCondition(0, 'skip')).toBe(true);    // 总是true
      expect(decoder.testCheckSingleCondition(0, 'invalid' as any)).toBe(false); // default分支
    });

    it('应该测试没有lastState的默认值情况', () => {
      decoder.setChannelData([new Uint8Array([1])]);
      decoder.setSampleIndex(0);
      
      const currentState = new Map<number, number>();
      currentState.set(0, 1);
      decoder.setCurrentState(currentState);
      
      // 清空lastState，测试第224行的默认值逻辑
      decoder.setLastState(new Map());
      
      // 当lastState为空时，应该使用默认值0
      expect(decoder.testCheckSingleCondition(0, 'rising')).toBe(true);  // 0->1 (默认值0)
      expect(decoder.testCheckSingleCondition(0, 'stable')).toBe(false); // 0≠1 (默认值0)
    });

    it('应该测试updateCurrentState中超出数组长度的默认值0分支 (第265行)', () => {
      // 设置短数组，但设置sampleIndex超出数组长度
      decoder.setChannelData([
        new Uint8Array([1, 0]),  // 长度为2
        new Uint8Array([0, 1])   // 长度为2
      ]);
      
      // 设置sampleIndex为2，超出数组长度
      decoder.setSampleIndex(2);
      
      // 调用updateCurrentState，这会触发第265行的": 0"分支
      decoder.testUpdateCurrentState();
      
      // 验证超出范围的值被设置为0
      const currentState = (decoder as any).currentState;
      expect(currentState.get(0)).toBe(0); // 超出范围，应该是0
      expect(currentState.get(1)).toBe(0); // 超出范围，应该是0
    });

    it('应该测试updateCurrentState在正常范围内的情况', () => {
      // 设置测试数据
      decoder.setChannelData([
        new Uint8Array([1, 0, 1]),
        new Uint8Array([0, 1, 0])
      ]);
      
      // 设置在范围内的sampleIndex
      decoder.setSampleIndex(1);
      
      // 调用updateCurrentState
      decoder.testUpdateCurrentState();
      
      // 验证正常范围内的值被正确设置
      const currentState = (decoder as any).currentState;
      expect(currentState.get(0)).toBe(0); // channelData[0][1] = 0
      expect(currentState.get(1)).toBe(1); // channelData[1][1] = 1
    });
  });
});