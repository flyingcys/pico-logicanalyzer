/**
 * TriggerProcessor.ts 终极覆盖率测试
 * 专门针对剩余的6.25%未覆盖分支，争取达到100%分支覆盖率
 * 
 * 目标覆盖分支：
 * - 第185-189行：applyEdgeTrigger默认参数分支
 * - 第206行：enableBurst为false时的条件分支
 * - 第463行：measureBursts为false时的条件分支  
 * - 第492行：validatePatternTrigger默认参数useFastTrigger=false
 * - 第588行：applyPatternTrigger默认参数useFastTrigger=false
 */

import {
  TriggerProcessor,
  TriggerProcessorConfig,
  TriggerValidationResult
} from '../../../src/models/TriggerProcessor';
import {
  TriggerType,
  CaptureMode
} from '../../../src/models/AnalyzerTypes';
import {
  CaptureSession,
  AnalyzerChannel
} from '../../../src/models/CaptureModels';

describe('TriggerProcessor 终极分支覆盖测试', () => {
  let processor: TriggerProcessor;
  let mockConfig: TriggerProcessorConfig;
  let mockSession: CaptureSession;

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
    
    // 设置捕获通道
    mockSession.captureChannels = [
      { channelNumber: 0, enabled: true, label: 'CH0' },
      { channelNumber: 1, enabled: true, label: 'CH1' }
    ];
  });

  describe('覆盖第185-189行：applyEdgeTrigger默认参数分支', () => {
    
    it('应该使用所有默认参数调用applyEdgeTrigger', () => {
      // 测试只传递必需参数，所有可选参数使用默认值
      const result = processor.applyEdgeTrigger(mockSession, 5);
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerChannel).toBe(5);
      expect(mockSession.triggerType).toBe(TriggerType.Edge);
      expect(mockSession.triggerInverted).toBe(false); // negativeEdge默认false
      expect(mockSession.loopCount).toBe(0); // enableBurst默认false，所以loopCount=0
      expect(mockSession.measureBursts).toBe(false); // measureDelay默认false
    });

    it('应该使用部分默认参数调用applyEdgeTrigger', () => {
      // 测试只传递前几个参数，后面使用默认值
      const result = processor.applyEdgeTrigger(mockSession, 3, true);
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerChannel).toBe(3);
      expect(mockSession.triggerInverted).toBe(true);
      expect(mockSession.triggerType).toBe(TriggerType.Edge); // enableBlast默认false
      expect(mockSession.loopCount).toBe(0); // enableBurst默认false
      expect(mockSession.measureBursts).toBe(false); // measureDelay默认false
    });

    it('应该测试更多默认参数组合', () => {
      // 测试enableBlast=true，其他使用默认值
      const result = processor.applyEdgeTrigger(mockSession, 2, false, true);
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerChannel).toBe(2);
      expect(mockSession.triggerType).toBe(TriggerType.Blast);
      expect(mockSession.loopCount).toBe(0); // Blast模式强制为0
    });
  });

  describe('覆盖第206行：enableBurst为false时的条件分支', () => {
    
    it('应该在enableBurst=false时设置loopCount=0', () => {
      // 确保enableBurst=false时，loopCount被设置为0（条件表达式的else分支）
      const result = processor.applyEdgeTrigger(
        mockSession,
        5,           // triggerChannel
        false,       // negativeEdge
        false,       // enableBlast
        false,       // enableBurst = false (触发第206行的else分支)
        10,          // burstCount (应该被忽略)
        false        // measureDelay
      );
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerType).toBe(TriggerType.Edge);
      expect(mockSession.loopCount).toBe(0); // enableBurst=false时应该为0，不管burstCount是什么
    });

    it('应该验证enableBurst=true时loopCount=burstCount-1', () => {
      // 对比测试：确保enableBurst=true时确实使用burstCount-1
      const result = processor.applyEdgeTrigger(
        mockSession,
        5,           // triggerChannel
        false,       // negativeEdge
        false,       // enableBlast
        true,        // enableBurst = true (触发第206行的if分支)
        5,           // burstCount
        false        // measureDelay
      );
      
      expect(result.isValid).toBe(true);
      expect(mockSession.loopCount).toBe(4); // burstCount - 1 = 5 - 1 = 4
    });
  });

  describe('覆盖第463行：measureBursts为false时的条件分支', () => {
    
    it('应该在measureBursts=false时序列化为0', () => {
      // 设置复杂触发以触发composeComplexTriggerRequest方法
      mockSession.triggerType = TriggerType.Complex;
      mockSession.triggerBitCount = 4;
      mockSession.measureBursts = false; // 确保触发第463行的else分支

      const request = processor.composeTriggerRequest(
        mockSession,
        3000,
        CaptureMode.Normal
      );
      
      expect(request).toBeInstanceOf(Uint8Array);
      expect(request.length).toBeGreaterThan(0);
      
      // 检查第463行的序列化结果：measureBursts=false应该序列化为0
      const measureByteIndex = 1 + 1 + 1 + 2 + 24 + 1 + 4 + 4 + 4 + 1; // 根据结构体布局计算measure字节位置
      expect(request[measureByteIndex]).toBe(0); // measureBursts=false应该序列化为0
    });

    it('应该在measureBursts=true时序列化为1', () => {
      // 对比测试：确保measureBursts=true时确实序列化为1
      mockSession.triggerType = TriggerType.Complex;
      mockSession.triggerBitCount = 4;
      mockSession.measureBursts = true; // 测试true分支

      const request = processor.composeTriggerRequest(
        mockSession,
        3000,
        CaptureMode.Normal
      );
      
      const measureByteIndex = 1 + 1 + 1 + 2 + 24 + 1 + 4 + 4 + 4 + 1;
      expect(request[measureByteIndex]).toBe(1); // measureBursts=true应该序列化为1
    });

    it('应该在Fast触发中测试measureBursts=false分支', () => {
      // 测试Fast触发类型下的measureBursts分支
      mockSession.triggerType = TriggerType.Fast;
      mockSession.triggerBitCount = 3;
      mockSession.measureBursts = false;

      const request = processor.composeTriggerRequest(
        mockSession,
        2000,
        CaptureMode.Streaming
      );
      
      const measureByteIndex = 1 + 1 + 1 + 2 + 24 + 1 + 4 + 4 + 4 + 1;
      expect(request[measureByteIndex]).toBe(0);
    });
  });

  describe('覆盖第492行：validatePatternTrigger默认参数useFastTrigger=false', () => {
    
    it('应该使用默认useFastTrigger=false参数', () => {
      // 只传递必需参数，useFastTrigger使用默认值false
      const result = processor.validatePatternTrigger(
        5,          // firstChannel
        '1010'      // pattern
        // useFastTrigger使用默认值false
      );
      
      expect(result.isValid).toBe(true);
    });

    it('应该在默认useFastTrigger=false时允许长模式', () => {
      // 测试长模式在useFastTrigger=false时应该被允许
      const result = processor.validatePatternTrigger(
        0,          // firstChannel
        '1010101010' // 10位模式，在useFastTrigger=false时应该允许
        // useFastTrigger使用默认值false
      );
      
      expect(result.isValid).toBe(true);
    });

    it('应该对比useFastTrigger=true时拒绝长模式', () => {
      // 对比测试：确保useFastTrigger=true时确实会拒绝长模式
      const result = processor.validatePatternTrigger(
        0,          // firstChannel
        '1010101010', // 10位模式
        true        // useFastTrigger=true应该拒绝>5位的模式
      );
      
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('Fast trigger can only be used with patterns up to 5 bits');
    });
  });

  describe('覆盖第588行：applyPatternTrigger默认参数useFastTrigger=false', () => {
    
    it('应该使用默认useFastTrigger=false参数', () => {
      // 只传递必需参数，useFastTrigger使用默认值false
      const result = processor.applyPatternTrigger(
        mockSession,
        2,          // firstChannel
        '1100'      // pattern
        // useFastTrigger使用默认值false
      );
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerType).toBe(TriggerType.Complex); // 默认应该是Complex，不是Fast
      expect(mockSession.triggerChannel).toBe(2);
      expect(mockSession.triggerBitCount).toBe(4);
    });

    it('应该在默认useFastTrigger=false时设置Complex触发', () => {
      const result = processor.applyPatternTrigger(
        mockSession,
        1,          // firstChannel
        '101'       // pattern
        // useFastTrigger使用默认值false
      );
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerType).toBe(TriggerType.Complex);
      expect(mockSession.triggerInverted).toBe(false); // Pattern触发不使用反转
    });

    it('应该对比useFastTrigger=true时设置Fast触发', () => {
      // 对比测试：确保useFastTrigger=true时确实设置Fast触发
      const result = processor.applyPatternTrigger(
        mockSession,
        1,          // firstChannel
        '101',      // pattern
        true        // useFastTrigger=true
      );
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerType).toBe(TriggerType.Fast);
    });
  });

  describe('边界情况和组合测试', () => {
    
    it('应该测试所有默认参数的完整组合', () => {
      // 创建一个新的session确保干净的状态
      const cleanSession = new CaptureSession();
      cleanSession.frequency = 1000000;
      cleanSession.preTriggerSamples = 1000;
      cleanSession.postTriggerSamples = 2000;
      cleanSession.captureChannels = [
        { channelNumber: 0, enabled: true, label: 'CH0' }
      ];

      // 测试applyEdgeTrigger的所有默认参数
      const result1 = processor.applyEdgeTrigger(cleanSession, 10);
      expect(result1.isValid).toBe(true);
      
      // 测试validatePatternTrigger的默认参数
      const result2 = processor.validatePatternTrigger(5, '1011');
      expect(result2.isValid).toBe(true);
      
      // 测试applyPatternTrigger的默认参数
      const result3 = processor.applyPatternTrigger(cleanSession, 3, '0110');
      expect(result3.isValid).toBe(true);
    });

    it('应该测试measureBursts在简单触发中的false分支', () => {
      // 测试简单触发（Edge/Blast）中measureBursts=false的序列化
      mockSession.triggerType = TriggerType.Edge;
      mockSession.measureBursts = false;

      const request = processor.composeTriggerRequest(
        mockSession,
        1000,
        CaptureMode.Normal
      );
      
      // 简单触发的measure字节位置
      const measureByteIndex = 1 + 1 + 1 + 2 + 24 + 1 + 4 + 4 + 4 + 1;
      expect(request[measureByteIndex]).toBe(0);
    });

    it('应该测试极端参数组合的默认值处理', () => {
      // 测试边界通道号与默认参数的组合
      const result = processor.applyEdgeTrigger(
        mockSession,
        23          // 最大通道号
        // 所有其他参数使用默认值
      );
      
      expect(result.isValid).toBe(true);
      expect(mockSession.triggerChannel).toBe(23);
      expect(mockSession.loopCount).toBe(0); // enableBurst默认false
    });
  });
});