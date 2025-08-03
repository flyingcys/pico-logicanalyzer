/**
 * TriggerProcessor.ts 增强测试
 * 专门针对未覆盖的代码行，提升覆盖率到95%+
 * 
 * 未覆盖行号分析：197,282,295,524,533,594,634-636,693,697-701
 */

import {
  TriggerProcessor,
  TriggerProcessorFactory,
  TriggerValidationResult,
  TriggerValidationError,
  TriggerProcessorConfig,
  TriggerCondition,
  TriggerLevelConfig
} from '../../../src/models/TriggerProcessor';
import {
  TriggerType,
  CaptureMode
} from '../../../src/models/AnalyzerTypes';
import {
  CaptureSession,
  AnalyzerChannel
} from '../../../src/models/CaptureModels';

describe('TriggerProcessor 覆盖率增强测试', () => {
  let processor: TriggerProcessor;
  let mockConfig: TriggerProcessorConfig;
  let mockSession: CaptureSession;
  let mockCaptureLimits: any;

  beforeEach(() => {
    mockConfig = {
      channelCount: 24,
      maxFrequency: 100000000, // 100MHz
      minFrequency: 1000,       // 1kHz
      blastFrequency: 200000000, // 200MHz
      bufferSize: 1048576,      // 1MB
      maxVoltage: 5.0,
      minVoltage: 0.0,
      defaultThreshold: 1.65
    };

    processor = new TriggerProcessor(mockConfig);

    mockSession = new CaptureSession();
    mockSession.frequency = 1000000; // 1MHz
    mockSession.preTriggerSamples = 1000;
    mockSession.postTriggerSamples = 2000;
    mockSession.triggerType = TriggerType.Edge;
    mockSession.triggerChannel = 0;
    mockSession.triggerInverted = false;
    mockSession.triggerPattern = 0;
    mockSession.triggerBitCount = 1;
    mockSession.loopCount = 0;
    mockSession.measureBursts = false;
    mockSession.captureChannels = [
      new AnalyzerChannel(0, 'CH0'),
      new AnalyzerChannel(1, 'CH1'),
      new AnalyzerChannel(2, 'CH2')
    ];

    mockCaptureLimits = {
      minPreSamples: 1,
      maxPreSamples: 100000,
      minPostSamples: 1,
      maxPostSamples: 100000,
      maxTotalSamples: 1000000
    };
  });

  describe('覆盖第197行：applyEdgeTrigger验证失败', () => {
    it('应该在applyEdgeTrigger中返回验证失败结果', () => {
      // 使用无效的触发通道导致验证失败
      const result = processor.applyEdgeTrigger(mockSession, -1, false, false, false, 1, false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toBe('Trigger channel must be between 0 and 23');
    });

    it('应该在applyEdgeTrigger中返回Blast和Burst冲突错误', () => {
      // Blast和Burst同时启用导致验证失败
      const result = processor.applyEdgeTrigger(mockSession, 5, false, true, true, 10, false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidLoopCount);
      expect(result.errorMessage).toBe('Blast mode and Burst mode cannot be enabled simultaneously');
    });

    it('应该在applyEdgeTrigger中返回Burst计数错误', () => {
      // Burst计数超出范围导致验证失败
      const result = processor.applyEdgeTrigger(mockSession, 5, false, false, true, 255, false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidLoopCount);
      expect(result.errorMessage).toBe('Burst count must be between 1 and 254');
    });
  });

  describe('覆盖第282行：validateBlastTrigger触发通道验证', () => {
    it('应该拒绝Blast触发的无效触发通道（负数）', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = -1; // 无效通道
      mockSession.loopCount = 0;

      const result = processor.validateTriggerSettings(mockSession, 3000, mockCaptureLimits);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toBe('Trigger channel must be between 0 and 23');
    });

    it('应该拒绝Blast触发的超出范围触发通道', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = 24; // 超出范围
      mockSession.loopCount = 0;

      const result = processor.validateTriggerSettings(mockSession, 3000, mockCaptureLimits);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toBe('Trigger channel must be between 0 and 23');
    });
  });

  describe('覆盖第295行：validateBlastTrigger样本数验证', () => {
    it('应该拒绝Blast触发的前置样本数过少', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = 5;
      mockSession.loopCount = 0;
      mockSession.preTriggerSamples = 0; // 小于minPreSamples

      const result = processor.validateTriggerSettings(mockSession, 3000, mockCaptureLimits);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidSampleCount);
      expect(result.errorMessage).toBe('Sample count exceeds device limits');
    });

    it('应该拒绝Blast触发的后置样本数过少', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = 5;
      mockSession.loopCount = 0;
      mockSession.postTriggerSamples = 0; // 小于minPostSamples

      const result = processor.validateTriggerSettings(mockSession, 3000, mockCaptureLimits);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidSampleCount);
      expect(result.errorMessage).toBe('Sample count exceeds device limits');
    });

    it('应该拒绝Blast触发的前置样本数过多', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = 5;
      mockSession.loopCount = 0;
      mockSession.preTriggerSamples = 200000; // 超过maxPreSamples

      const result = processor.validateTriggerSettings(mockSession, 3000, mockCaptureLimits);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidSampleCount);
      expect(result.errorMessage).toBe('Sample count exceeds device limits');
    });

    it('应该拒绝Blast触发的后置样本数过多', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = 5;
      mockSession.loopCount = 0;
      mockSession.postTriggerSamples = 200000; // 超过maxPostSamples

      const result = processor.validateTriggerSettings(mockSession, 3000, mockCaptureLimits);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidSampleCount);
      expect(result.errorMessage).toBe('Sample count exceeds device limits');
    });

    it('应该拒绝Blast触发的总样本数过多', () => {
      mockSession.triggerType = TriggerType.Blast;
      mockSession.triggerChannel = 5;
      mockSession.loopCount = 0;

      const result = processor.validateTriggerSettings(mockSession, 2000000, mockCaptureLimits); // 超过maxTotalSamples

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidSampleCount);
      expect(result.errorMessage).toBe('Sample count exceeds device limits');
    });
  });

  describe('覆盖第524行：validatePatternTrigger第一个通道验证', () => {
    it('应该拒绝第一个通道为负数的模式触发', () => {
      const result = processor.validatePatternTrigger(-1, '1010', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toBe('First channel must be between 0 and 15');
    });

    it('应该拒绝第一个通道超出15的模式触发', () => {
      const result = processor.validatePatternTrigger(16, '1010', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannel);
      expect(result.errorMessage).toBe('First channel must be between 0 and 15');
    });
  });

  describe('覆盖第533行：validatePatternTrigger通道范围验证', () => {
    it('应该拒绝模式触发的通道范围超出16个通道', () => {
      // 第一个通道为10，模式长度为8，总共需要18个通道（10+8 > 16）
      const result = processor.validatePatternTrigger(10, '11110000', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannelRange);
      expect(result.errorMessage).toBe('Pattern trigger can only be used in the first 16 channels');
    });

    it('应该拒绝模式触发的边界情况超出范围', () => {
      // 第一个通道为15，模式长度为2，总共需要17个通道（15+2 > 16）
      const result = processor.validatePatternTrigger(15, '10', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerChannelRange);
      expect(result.errorMessage).toBe('Pattern trigger can only be used in the first 16 channels');
    });
  });

  describe('覆盖第594行：applyPatternTrigger验证失败', () => {
    it('应该在applyPatternTrigger中返回验证失败结果', () => {
      // 使用空模式导致验证失败
      const result = processor.applyPatternTrigger(mockSession, 0, '', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toBe('Pattern cannot be empty');
    });

    it('应该在applyPatternTrigger中返回无效字符错误', () => {
      // 使用非法字符导致验证失败
      const result = processor.applyPatternTrigger(mockSession, 0, '10X1', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toBe('Pattern can only contain 0 and 1');
    });

    it('应该在applyPatternTrigger中返回模式过长错误', () => {
      // 使用过长模式导致验证失败
      const result = processor.applyPatternTrigger(mockSession, 0, '10101010101010101', false);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidPatternLength);
      expect(result.errorMessage).toBe('Pattern cannot exceed 16 bits');
    });

    it('应该在applyPatternTrigger中返回Fast触发模式过长错误', () => {
      // Fast触发使用过长模式导致验证失败
      const result = processor.applyPatternTrigger(mockSession, 0, '101010', true);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.FastTriggerPatternTooLong);
      expect(result.errorMessage).toBe('Fast trigger can only be used with patterns up to 5 bits');
    });
  });

  describe('覆盖第634-636行：validateTriggerLevel滞回电压验证', () => {
    it('应该拒绝滞回电压导致阈值下限超出范围的情况', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: 0.5,    // 阈值0.5V
        hysteresis: 1.0    // 滞回1.0V，导致下限为-0.5V（小于minVoltage 0V）
      };

      const result = processor.validateTriggerLevel(levelConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toBe('Trigger threshold ± hysteresis exceeds voltage range');
    });

    it('应该拒绝滞回电压导致阈值上限超出范围的情况', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: 4.5,    // 阈值4.5V
        hysteresis: 1.0    // 滞回1.0V，导致上限为5.5V（大于maxVoltage 5.0V）
      };

      const result = processor.validateTriggerLevel(levelConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toBe('Trigger threshold ± hysteresis exceeds voltage range');
    });

    it('应该拒绝过大的滞回电压值', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: 2.5,    // 阈值2.5V
        hysteresis: 3.0    // 滞回3.0V，超过最大允许的1.0V
      };

      const result = processor.validateTriggerLevel(levelConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toBe('Hysteresis voltage must be between 0V and 1.0V');
    });

    it('应该拒绝合法滞回电压但阈值±滞回超出范围的情况', () => {
      const levelConfig: TriggerLevelConfig = {
        threshold: 4.8,    // 阈值4.8V
        hysteresis: 0.5    // 滞回0.5V（在0-1.0范围内），但上限为5.3V（超过maxVoltage 5.0V）
      };

      const result = processor.validateTriggerLevel(levelConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
      expect(result.errorMessage).toBe('Trigger threshold ± hysteresis exceeds voltage range');
    });
  });

  describe('覆盖第693行：convertTriggerCondition的BothEdges条件', () => {
    it('应该正确转换BothEdges触发条件', () => {
      const result = processor.convertTriggerCondition(TriggerCondition.BothEdges);
      
      expect(result.triggerType).toBe(TriggerType.Edge);
      expect(result.triggerInverted).toBe(false);
    });
  });

  describe('覆盖第697-701行：convertTriggerCondition的其他条件', () => {
    it('应该正确转换LowLevel触发条件', () => {
      const result = processor.convertTriggerCondition(TriggerCondition.LowLevel);
      
      expect(result.triggerType).toBe(TriggerType.Complex);
      expect(result.triggerInverted).toBe(true);
    });

    it('应该正确转换AnyChange触发条件', () => {
      const result = processor.convertTriggerCondition(TriggerCondition.AnyChange);
      
      expect(result.triggerType).toBe(TriggerType.Edge);
      expect(result.triggerInverted).toBe(false);
    });

    it('应该正确处理未知的触发条件（default分支）', () => {
      // 使用一个不存在的枚举值来触发default分支
      const unknownCondition = 'UnknownCondition' as TriggerCondition;
      const result = processor.convertTriggerCondition(unknownCondition);
      
      expect(result.triggerType).toBe(TriggerType.Edge);
      expect(result.triggerInverted).toBe(false);
    });
  });

  describe('边界情况和完整性测试', () => {
    it('应该处理所有触发条件的完整转换', () => {
      const conditions = [
        TriggerCondition.RisingEdge,
        TriggerCondition.FallingEdge,
        TriggerCondition.BothEdges,
        TriggerCondition.HighLevel,
        TriggerCondition.LowLevel,
        TriggerCondition.AnyChange
      ];

      conditions.forEach(condition => {
        const result = processor.convertTriggerCondition(condition);
        expect(result).toBeDefined();
        expect(result.triggerType).toBeDefined();
        expect(typeof result.triggerInverted).toBe('boolean');
      });
    });

    it('应该处理极端的触发电平配置', () => {
      // 边界情况：阈值在边界，滞回正好在极限
      const levelConfig: TriggerLevelConfig = {
        threshold: 0.0,     // 最小阈值
        hysteresis: 0.0     // 最小滞回
      };

      const result = processor.validateTriggerLevel(levelConfig);
      expect(result.isValid).toBe(true);
    });

    it('应该处理最大触发电平配置', () => {
      // 边界情况：阈值在最大值，无滞回
      const levelConfig: TriggerLevelConfig = {
        threshold: 5.0      // 最大阈值
        // 不设置滞回
      };

      const result = processor.validateTriggerLevel(levelConfig);
      expect(result.isValid).toBe(true);
    });

    it('应该验证模式触发的边界情况', () => {
      // 边界情况：第一个通道为15，模式长度为1（总共16个通道，正好在限制内）
      const result = processor.validatePatternTrigger(15, '1', false);
      
      expect(result.isValid).toBe(true);
    });

    it('应该验证Fast触发的最大模式长度', () => {
      // 边界情况：Fast触发的最大模式长度为5
      const result = processor.validatePatternTrigger(0, '11111', true);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('额外的错误分支覆盖', () => {
    it('应该处理配置中缺少电压范围的情况', () => {
      // 创建一个没有电压配置的处理器
      const minimalConfig: TriggerProcessorConfig = {
        channelCount: 24,
        maxFrequency: 100000000,
        minFrequency: 1000,
        blastFrequency: 200000000,
        bufferSize: 1048576
        // 没有 maxVoltage, minVoltage, defaultThreshold
      };

      const minimalProcessor = new TriggerProcessor(minimalConfig);
      
      // 验证默认值处理
      const levelConfig: TriggerLevelConfig = {
        threshold: 3.0  // 应该小于默认maxVoltage (5.0)
      };

      const result = minimalProcessor.validateTriggerLevel(levelConfig);
      expect(result.isValid).toBe(true);
    });

    it('应该处理超出默认电压范围的情况', () => {
      const minimalConfig: TriggerProcessorConfig = {
        channelCount: 24,
        maxFrequency: 100000000,
        minFrequency: 1000,
        blastFrequency: 200000000,
        bufferSize: 1048576
      };

      const minimalProcessor = new TriggerProcessor(minimalConfig);
      
      const levelConfig: TriggerLevelConfig = {
        threshold: 6.0  // 超过默认maxVoltage (5.0)
      };

      const result = minimalProcessor.validateTriggerLevel(levelConfig);
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe(TriggerValidationError.InvalidTriggerPattern);
    });
  });
});