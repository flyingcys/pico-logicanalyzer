/**
 * TriggerProcessor 核心功能测试
 * 
 * 专注测试@src源码中的真实触发处理逻辑：
 * - 触发设置验证
 * - 触发模式转换
 * - 触发请求构建
 * - 电平管理
 * 
 * 设计原则：
 * - 测试真实业务逻辑，不追求覆盖率数字
 * - 最小化Mock，专注源码验证
 * - 验证触发处理的核心算法
 */

import { 
  TriggerProcessor, 
  TriggerProcessorFactory,
  TriggerValidationResult, 
  TriggerValidationError,
  TriggerCondition,
  TriggerLevelConfig,
  TriggerProcessorConfig 
} from '../../../src/models/TriggerProcessor';
import { 
  TriggerType, 
  CaptureMode 
} from '../../../src/models/AnalyzerTypes';
import { 
  CaptureSession, 
  AnalyzerChannel 
} from '../../../src/models/CaptureModels';

describe('TriggerProcessor 核心功能测试', () => {
  let triggerProcessor: TriggerProcessor;
  let standardConfig: TriggerProcessorConfig;
  let testSession: CaptureSession;

  beforeEach(() => {
    // 标准的24通道配置
    standardConfig = {
      channelCount: 24,
      maxFrequency: 100000000, // 100MHz
      minFrequency: 1000,      // 1KHz
      blastFrequency: 200000000, // 200MHz
      bufferSize: 96000,
      maxVoltage: 5.0,
      minVoltage: 0.0,
      defaultThreshold: 2.5
    };

    triggerProcessor = new TriggerProcessor(standardConfig);

    // 创建标准测试会话
    testSession = new CaptureSession();
    testSession.frequency = 1000000; // 1MHz
    testSession.preTriggerSamples = 1000;
    testSession.postTriggerSamples = 9000;
    testSession.triggerType = TriggerType.Edge;
    testSession.triggerChannel = 0;
    testSession.triggerInverted = false;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'CLK'),
      new AnalyzerChannel(1, 'DATA'),
      new AnalyzerChannel(2, 'CS')
    ];
  });

  describe('触发设置验证核心逻辑', () => {
    it('应该验证有效的边沿触发设置', () => {
      const captureLimits = {
        minPreSamples: 0,
        maxPreSamples: 50000,
        minPostSamples: 1000,
        maxPostSamples: 90000,
        maxTotalSamples: 96000
      };

      const result = triggerProcessor.validateTriggerSettings(
        testSession, 
        10000, 
        captureLimits
      );

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('应该拒绝超出通道范围的设置', () => {
      // 添加无效通道（超出0-23范围）
      testSession.captureChannels.push(new AnalyzerChannel(25, 'INVALID'));

      const captureLimits = {
        minPreSamples: 0,
        maxPreSamples: 50000,
        minPostSamples: 1000,
        maxPostSamples: 90000,
        maxTotalSamples: 96000
      };

      const result = triggerProcessor.validateTriggerSettings(
        testSession,
        10000,
        captureLimits
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidChannelRange);
      expect(result.errorMessage).toContain('Channel numbers must be between 0 and 23');
    });

    it('应该拒绝空的通道列表', () => {
      testSession.captureChannels = [];

      const captureLimits = {
        minPreSamples: 0,
        maxPreSamples: 50000,
        minPostSamples: 1000,
        maxPostSamples: 90000,
        maxTotalSamples: 96000
      };

      const result = triggerProcessor.validateTriggerSettings(
        testSession,
        10000,
        captureLimits
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidChannelRange);
    });

    it('应该处理不支持的触发类型', () => {
      testSession.triggerType = 999 as TriggerType; // 无效类型

      const captureLimits = {
        minPreSamples: 0,
        maxPreSamples: 50000,
        minPostSamples: 1000,
        maxPostSamples: 90000,
        maxTotalSamples: 96000
      };

      const result = triggerProcessor.validateTriggerSettings(
        testSession,
        10000,
        captureLimits
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toContain('Unsupported trigger type');
    });
  });

  describe('边沿触发验证业务逻辑', () => {
    it('应该验证有效的边沿触发通道', () => {
      const result = triggerProcessor.validateEdgeTrigger(
        12, // 有效通道
        false, // 正沿触发
        false, // 不启用Blast
        false  // 不启用Burst
      );

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('应该拒绝超出范围的触发通道', () => {
      const result = triggerProcessor.validateEdgeTrigger(
        25, // 无效通道（超出0-23）
        false,
        false,
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toContain('Trigger channel must be between 0 and 23');
    });

    it('应该拒绝负数触发通道', () => {
      const result = triggerProcessor.validateEdgeTrigger(
        -1, // 负数通道
        false,
        false,
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
    });

    it('应该验证边界通道（0和23）', () => {
      const result0 = triggerProcessor.validateEdgeTrigger(0, false, false, false);
      const result23 = triggerProcessor.validateEdgeTrigger(23, false, false, false);

      expect(result0.isValid).toBe(true);
      expect(result23.isValid).toBe(true);
    });
  });

  describe('模式转换核心算法', () => {
    it('应该正确转换二进制模式到触发值', () => {
      const pattern1 = '10101010';
      const result1 = triggerProcessor.convertPatternToTriggerValue(pattern1);
      expect(result1).toBe(0xAA); // 10101010 = 0xAA

      const pattern2 = '11110000';
      const result2 = triggerProcessor.convertPatternToTriggerValue(pattern2);
      expect(result2).toBe(0xF0); // 11110000 = 0xF0
    });

    it('应该正确转换触发值到二进制模式', () => {
      const result1 = triggerProcessor.convertTriggerValueToPattern(0xAA, 8);
      expect(result1).toBe('10101010');

      const result2 = triggerProcessor.convertTriggerValueToPattern(0xF0, 8);
      expect(result2).toBe('11110000');
    });

    it('应该处理不同位长度的模式转换', () => {
      const result4bit = triggerProcessor.convertTriggerValueToPattern(0x0F, 4);
      expect(result4bit).toBe('1111');

      const result16bit = triggerProcessor.convertTriggerValueToPattern(0xFFFF, 16);
      expect(result16bit).toBe('1111111111111111');
    });

    it('应该验证模式转换的往返一致性', () => {
      const originalPattern = '11001100';
      const triggerValue = triggerProcessor.convertPatternToTriggerValue(originalPattern);
      const convertedPattern = triggerProcessor.convertTriggerValueToPattern(triggerValue, 8);
      
      expect(convertedPattern).toBe(originalPattern);
    });
  });

  describe('触发条件转换逻辑', () => {
    it('应该正确转换上升沿条件', () => {
      const result = triggerProcessor.convertTriggerCondition(TriggerCondition.RisingEdge);
      
      expect(result.triggerType).toBe(TriggerType.Edge);
      expect(result.triggerInverted).toBe(false);
    });

    it('应该正确转换下降沿条件', () => {
      const result = triggerProcessor.convertTriggerCondition(TriggerCondition.FallingEdge);
      
      expect(result.triggerType).toBe(TriggerType.Edge);
      expect(result.triggerInverted).toBe(true);
    });

    it('应该正确转换高电平条件', () => {
      const result = triggerProcessor.convertTriggerCondition(TriggerCondition.HighLevel);
      
      expect(result.triggerType).toBe(TriggerType.Complex);
      expect(result.triggerInverted).toBe(false);
    });

    it('应该正确转换低电平条件', () => {
      const result = triggerProcessor.convertTriggerCondition(TriggerCondition.LowLevel);
      
      expect(result.triggerType).toBe(TriggerType.Complex);
      expect(result.triggerInverted).toBe(true);
    });
  });

  describe('触发电平验证逻辑', () => {
    it('应该验证有效的触发电平', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: 2.5, // 在0-5V范围内
        hysteresis: 0.1,
        inputImpedance: 1000000
      };

      const result = triggerProcessor.validateTriggerLevel(levelConfig);

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('应该拒绝超出电压范围的触发电平', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: 6.0, // 超出最大5V
        hysteresis: 0.1
      };

      const result = triggerProcessor.validateTriggerLevel(levelConfig);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('threshold');
    });

    it('应该拒绝负电压触发电平', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: -1.0, // 负电压
        hysteresis: 0.1
      };

      const result = triggerProcessor.validateTriggerLevel(levelConfig);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('threshold');
    });

    it('应该验证边界电压值', () => {
      const levelConfig0V: TriggerLevelConfig = { threshold: 0.0 };
      const levelConfig5V: TriggerLevelConfig = { threshold: 5.0 };

      const result0V = triggerProcessor.validateTriggerLevel(levelConfig0V);
      const result5V = triggerProcessor.validateTriggerLevel(levelConfig5V);

      expect(result0V.isValid).toBe(true);
      expect(result5V.isValid).toBe(true);
    });
  });

  describe('推荐触发电平生成', () => {
    it('应该为TTL信号提供正确的触发电平', () => {
      const ttlLevel = triggerProcessor.getRecommendedTriggerLevel('TTL');

      expect(ttlLevel.threshold).toBeCloseTo(1.4); // TTL标准阈值
      expect(ttlLevel.hysteresis).toBeDefined();
      expect(ttlLevel.inputImpedance).toBeDefined();
    });

    it('应该为CMOS信号提供正确的触发电平', () => {
      const cmosLevel = triggerProcessor.getRecommendedTriggerLevel('CMOS');

      expect(cmosLevel.threshold).toBeGreaterThan(0);
      expect(cmosLevel.threshold).toBeLessThan(5.0);
    });

    it('应该为LVDS信号提供正确的触发电平', () => {
      const lvdsLevel = triggerProcessor.getRecommendedTriggerLevel('LVDS');

      expect(lvdsLevel.threshold).toBeGreaterThan(0);
      expect(lvdsLevel.inputImpedance).toBeDefined();
    });

    it('应该为自定义信号提供默认触发电平', () => {
      const customLevel = triggerProcessor.getRecommendedTriggerLevel('Custom');

      expect(customLevel.threshold).toBe(2.5); // 默认中间值
    });
  });

  describe('配置管理功能', () => {
    it('应该能够更新处理器配置', () => {
      const newConfig = {
        maxFrequency: 200000000, // 更新最大频率
        defaultThreshold: 3.3     // 更新默认阈值
      };

      triggerProcessor.updateConfig(newConfig);

      // 通过创建需要高频率的会话来验证配置更新
      const highFreqSession = new CaptureSession();
      highFreqSession.frequency = 150000000;
      highFreqSession.captureChannels = [new AnalyzerChannel(0, 'TEST')];
      highFreqSession.triggerType = TriggerType.Edge;

      // 配置更新后应该能处理更高频率
      const result = triggerProcessor.validateTriggerSettings(
        highFreqSession,
        1000,
        {
          minPreSamples: 0,
          maxPreSamples: 50000,
          minPostSamples: 1000,
          maxPostSamples: 90000,
          maxTotalSamples: 96000
        }
      );

      expect(result.isValid).toBe(true);
    });

    it('应该提供工厂方法创建设备特定的处理器', () => {
      const deviceInfo = {
        channelCount: 16,
        maxFrequency: 50000000,
        minFrequency: 500,
        blastFrequency: 100000000,
        bufferSize: 48000
      };

      const processor = TriggerProcessorFactory.createForDevice(deviceInfo);

      expect(processor).toBeInstanceOf(TriggerProcessor);
    });
  });

  describe('触发类型描述功能', () => {
    it('应该提供准确的触发类型描述', () => {
      const edgeDesc = triggerProcessor.getTriggerTypeDescription(TriggerType.Edge);
      const blastDesc = triggerProcessor.getTriggerTypeDescription(TriggerType.Blast);
      const complexDesc = triggerProcessor.getTriggerTypeDescription(TriggerType.Complex);

      expect(edgeDesc).toContain('Edge Trigger');
      expect(blastDesc).toContain('Blast');
      expect(complexDesc).toContain('Complex');
    });

    it('应该处理未知的触发类型', () => {
      const unknownDesc = triggerProcessor.getTriggerTypeDescription(999 as TriggerType);

      expect(unknownDesc).toContain('Unknown');
    });
  });

  describe('触发延迟计算', () => {
    it('应该为边沿触发返回零延迟', () => {
      testSession.triggerType = TriggerType.Edge;
      
      const delay = triggerProcessor.getTriggerDelayOffset(testSession);
      
      expect(delay).toBe(0);
    });

    it('应该为Blast触发返回零延迟', () => {
      testSession.triggerType = TriggerType.Blast;
      
      const delay = triggerProcessor.getTriggerDelayOffset(testSession);
      
      expect(delay).toBe(0);
    });

    it('应该为Fast触发计算适当的延迟', () => {
      testSession.triggerType = TriggerType.Fast;
      
      const delay = triggerProcessor.getTriggerDelayOffset(testSession);
      
      expect(typeof delay).toBe('number');
    });
  });

  describe('触发请求构建核心功能', () => {
    beforeEach(() => {
      // 重置为标准测试会话
      testSession.triggerType = TriggerType.Edge;
      testSession.triggerChannel = 0;
      testSession.triggerInverted = false;
      testSession.triggerBitCount = 1;
      testSession.triggerPattern = 0;
      testSession.loopCount = 0;
      testSession.measureBursts = false;
    });

    it('应该正确构建简单边沿触发请求', () => {
      testSession.triggerType = TriggerType.Edge;
      testSession.triggerChannel = 5;
      testSession.triggerInverted = true;
      
      const request = triggerProcessor.composeTriggerRequest(
        testSession,
        10000,
        CaptureMode.Channels_24
      );

      expect(request).toBeInstanceOf(Uint8Array);
      expect(request.length).toBeGreaterThan(0);
      
      // 验证触发类型字节
      expect(request[0]).toBe(TriggerType.Edge);
      // 验证触发通道字节
      expect(request[1]).toBe(5);
      // 验证反转标志字节
      expect(request[2]).toBe(1);
    });

    it('应该正确构建突发触发请求', () => {
      testSession.triggerType = TriggerType.Blast;
      testSession.triggerChannel = 10;
      testSession.triggerInverted = false;
      testSession.frequency = 50000000; // 50MHz
      
      const request = triggerProcessor.composeTriggerRequest(
        testSession,
        10000,
        CaptureMode.Channels_24
      );

      expect(request).toBeInstanceOf(Uint8Array);
      expect(request[0]).toBe(TriggerType.Blast);
      expect(request[1]).toBe(10);
      expect(request[2]).toBe(0); // 不反转
    });

    it('应该正确构建复杂触发请求', () => {
      testSession.triggerType = TriggerType.Complex;
      testSession.triggerChannel = 2;
      testSession.triggerBitCount = 4;
      testSession.triggerPattern = 0xA; // 1010
      testSession.frequency = 10000000; // 10MHz
      
      const request = triggerProcessor.composeTriggerRequest(
        testSession,
        10000,
        CaptureMode.Channels_24
      );

      expect(request).toBeInstanceOf(Uint8Array);
      expect(request[0]).toBe(TriggerType.Complex);
      expect(request[1]).toBe(2);
      expect(request[2]).toBe(4); // 位数
      
      // 验证触发值的字节序（小端）
      const triggerValue = request[3] | (request[4] << 8);
      expect(triggerValue).toBe(0xA);
    });

    it('应该正确构建快速触发请求', () => {
      testSession.triggerType = TriggerType.Fast;
      testSession.triggerChannel = 0;
      testSession.triggerBitCount = 3;
      testSession.triggerPattern = 0x5; // 101
      testSession.frequency = 100000000; // 100MHz
      
      const request = triggerProcessor.composeTriggerRequest(
        testSession,
        10000,
        CaptureMode.Channels_24
      );

      expect(request).toBeInstanceOf(Uint8Array);
      expect(request[0]).toBe(TriggerType.Fast);
      expect(request[1]).toBe(0);
      expect(request[2]).toBe(3); // 位数
    });

    it('应该在复杂触发请求中包含通道配置', () => {
      testSession.triggerType = TriggerType.Complex;
      testSession.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(5, 'CH5'),
        new AnalyzerChannel(15, 'CH15')
      ];
      
      const request = triggerProcessor.composeTriggerRequest(
        testSession,
        10000,
        CaptureMode.Channels_24
      );

      // 通道配置从第5字节开始（24字节数组）
      const channelOffset = 5;
      expect(request[channelOffset]).toBe(0); // 第一个通道
      expect(request[channelOffset + 1]).toBe(5); // 第二个通道
      expect(request[channelOffset + 2]).toBe(15); // 第三个通道
      
      // 通道数量（在通道数组后）
      const channelCountOffset = channelOffset + 24;
      expect(request[channelCountOffset]).toBe(3);
    });

    it('应该正确包含频率和样本数配置', () => {
      testSession.frequency = 25000000; // 25MHz
      testSession.preTriggerSamples = 2000;
      testSession.postTriggerSamples = 8000;
      
      const request = triggerProcessor.composeTriggerRequest(
        testSession,
        10000,
        CaptureMode.Channels_24
      );

      // 频率是32位小端整数，在通道数量后
      const freqOffset = 5 + 24 + 1; // 通道配置 + 通道数量
      const frequency = request[freqOffset] | 
                       (request[freqOffset + 1] << 8) |
                       (request[freqOffset + 2] << 16) |
                       (request[freqOffset + 3] << 24);
      expect(frequency).toBe(25000000);
      
      // 前置样本数
      const preSamplesOffset = freqOffset + 4;
      const preSamples = request[preSamplesOffset] | 
                        (request[preSamplesOffset + 1] << 8) |
                        (request[preSamplesOffset + 2] << 16) |
                        (request[preSamplesOffset + 3] << 24);
      expect(preSamples).toBe(2000);
    });
  });

  describe('模式触发功能测试', () => {
    it('应该验证有效的模式触发设置', () => {
      const result = triggerProcessor.validatePatternTrigger(
        2, // 起始通道
        '1010', // 4位模式
        false // 不使用Fast触发
      );

      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeUndefined();
    });

    it('应该拒绝超过16位的模式', () => {
      const longPattern = '10101010101010101'; // 17位
      
      const result = triggerProcessor.validatePatternTrigger(0, longPattern, false);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidPatternLength);
      expect(result.errorMessage).toContain('16 bits');
    });

    it('应该拒绝Fast触发的长模式', () => {
      const result = triggerProcessor.validatePatternTrigger(
        0,
        '101010', // 6位，超过Fast触发5位限制
        true // 使用Fast触发
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.FastTriggerPatternTooLong);
      expect(result.errorMessage).toContain('5 bits');
    });

    it('应该拒绝包含无效字符的模式', () => {
      const result = triggerProcessor.validatePatternTrigger(0, '102X', false);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toContain('0 and 1');
    });

    it('应该应用模式触发到会话', () => {
      const pattern = '11001100';
      
      const result = triggerProcessor.applyPatternTrigger(
        testSession,
        4, // 起始通道
        pattern,
        false // 不使用Fast触发
      );

      expect(result.isValid).toBe(true);
      expect(testSession.triggerType).toBe(TriggerType.Complex);
      expect(testSession.triggerChannel).toBe(4);
      expect(testSession.triggerBitCount).toBe(8);
      expect(testSession.triggerPattern).toBe(0xCC); // 11001100 = 0xCC
      expect(testSession.triggerInverted).toBe(false);
    });

    it('应该应用Fast触发模式到会话', () => {
      const pattern = '101';
      
      const result = triggerProcessor.applyPatternTrigger(
        testSession,
        0,
        pattern,
        true // 使用Fast触发
      );

      expect(result.isValid).toBe(true);
      expect(testSession.triggerType).toBe(TriggerType.Fast);
      expect(testSession.triggerBitCount).toBe(3);
      expect(testSession.triggerPattern).toBe(0x5); // 101 = 0x5
    });
  });

  describe('边沿触发应用功能', () => {
    it('应该应用标准边沿触发', () => {
      const result = triggerProcessor.applyEdgeTrigger(
        testSession,
        8, // 触发通道
        true, // 负沿触发
        false, // 不启用Blast
        false, // 不启用Burst
        1, // Burst计数
        false // 不测量延迟
      );

      expect(result.isValid).toBe(true);
      expect(testSession.triggerType).toBe(TriggerType.Edge);
      expect(testSession.triggerChannel).toBe(8);
      expect(testSession.triggerInverted).toBe(true);
      expect(testSession.triggerBitCount).toBe(1);
      expect(testSession.triggerPattern).toBe(0);
      expect(testSession.loopCount).toBe(0);
      expect(testSession.measureBursts).toBe(false);
    });

    it('应该应用Blast模式边沿触发', () => {
      const result = triggerProcessor.applyEdgeTrigger(
        testSession,
        12,
        false, // 正沿触发
        true, // 启用Blast
        false, // 不启用Burst
        1,
        false
      );

      expect(result.isValid).toBe(true);
      expect(testSession.triggerType).toBe(TriggerType.Blast);
      expect(testSession.triggerChannel).toBe(12);
      expect(testSession.triggerInverted).toBe(false);
      expect(testSession.loopCount).toBe(0); // Blast模式不支持循环
    });

    it('应该应用Burst模式边沿触发', () => {
      const burstCount = 5;
      
      const result = triggerProcessor.applyEdgeTrigger(
        testSession,
        3,
        false,
        false, // 不启用Blast
        true, // 启用Burst
        burstCount,
        true // 测量延迟
      );

      expect(result.isValid).toBe(true);
      expect(testSession.triggerType).toBe(TriggerType.Edge);
      expect(testSession.triggerChannel).toBe(3);
      expect(testSession.loopCount).toBe(burstCount - 1); // LoopCount = BurstCount - 1
      expect(testSession.measureBursts).toBe(true);
    });

    it('应该拒绝同时启用Blast和Burst', () => {
      const result = triggerProcessor.applyEdgeTrigger(
        testSession,
        0,
        false,
        true, // 启用Blast
        true, // 同时启用Burst - 应该失败
        1,
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('simultaneously');
    });

    it('应该拒绝无效的Burst计数', () => {
      const result = triggerProcessor.applyEdgeTrigger(
        testSession,
        0,
        false,
        false,
        true,
        300, // 超过254的限制
        false
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidLoopCount);
      expect(result.errorMessage).toContain('254');
    });
  });
});