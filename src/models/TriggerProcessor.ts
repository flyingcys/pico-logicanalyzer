/**
 * 触发条件处理器
 * 基于原版 C# LogicAnalyzerDriver 中的触发处理逻辑精确移植
 * 负责触发验证、请求构建和触发延迟计算
 */

import {
  TriggerType,
  CaptureMode,
  TriggerDelays
} from './AnalyzerTypes';
import {
  CaptureSession
} from './CaptureModels';

/**
 * 触发验证结果
 */
export interface TriggerValidationResult {
  isValid: boolean;
  errorMessage?: string;
  errorCode?: TriggerValidationError;
}

/**
 * 触发验证错误类型
 */
export enum TriggerValidationError {
  InvalidChannelRange = 'InvalidChannelRange',
  InvalidTriggerBitCount = 'InvalidTriggerBitCount',
  InvalidTriggerChannel = 'InvalidTriggerChannel',
  InvalidTriggerChannelRange = 'InvalidTriggerChannelRange',
  InvalidSampleCount = 'InvalidSampleCount',
  InvalidFrequency = 'InvalidFrequency',
  InvalidLoopCount = 'InvalidLoopCount',
  InvalidTriggerPattern = 'InvalidTriggerPattern',
  InvalidPatternLength = 'InvalidPatternLength',
  FastTriggerPatternTooLong = 'FastTriggerPatternTooLong'
}

/**
 * 触发处理器配置
 */
export interface TriggerProcessorConfig {
  channelCount: number;
  maxFrequency: number;
  minFrequency: number;
  blastFrequency: number;
  bufferSize: number;
  // 电平设置相关
  maxVoltage?: number;
  minVoltage?: number;
  defaultThreshold?: number;
}

/**
 * 触发电平设置
 */
export interface TriggerLevelConfig {
  threshold: number; // 触发阈值电压 (V)
  hysteresis?: number; // 滞回电压 (V)
  inputImpedance?: number; // 输入阻抗 (Ohms)
}

/**
 * 触发条件枚举 - 基于原版触发条件
 */
export enum TriggerCondition {
  RisingEdge = 'rising',
  FallingEdge = 'falling',
  BothEdges = 'both',
  HighLevel = 'high',
  LowLevel = 'low',
  AnyChange = 'any'
}

/**
 * 触发条件处理器类
 * 基于C# LogicAnalyzerDriver的触发处理逻辑
 */
export class TriggerProcessor {
  private config: TriggerProcessorConfig;

  constructor(config: TriggerProcessorConfig) {
    this.config = config;
  }

  /**
   * 验证触发设置 - 基于C# ValidateSettings方法
   */
  public validateTriggerSettings(
    session: CaptureSession,
    requestedSamples: number,
    captureLimits: {
      minPreSamples: number;
      maxPreSamples: number;
      minPostSamples: number;
      maxPostSamples: number;
      maxTotalSamples: number;
    }
  ): TriggerValidationResult {

    const channelNumbers = session.captureChannels.map(ch => ch.channelNumber);

    // 基础通道范围检查
    if (channelNumbers.length === 0 ||
        Math.min(...channelNumbers) < 0 ||
        Math.max(...channelNumbers) > this.config.channelCount - 1) {
      return {
        isValid: false,
        errorMessage: `Channel numbers must be between 0 and ${this.config.channelCount - 1}`,
        errorCode: TriggerValidationError.InvalidChannelRange
      };
    }

    // 根据触发类型进行不同的验证
    switch (session.triggerType) {
      case TriggerType.Edge:
      case TriggerType.Fast:
        return this.validateEdgeOrFastTrigger(session, requestedSamples, captureLimits);

      case TriggerType.Blast:
        return this.validateBlastTrigger(session, requestedSamples, captureLimits);

      case TriggerType.Complex:
        return this.validateComplexTrigger(session, requestedSamples, captureLimits);

      default:
        return {
          isValid: false,
          errorMessage: `Unsupported trigger type: ${session.triggerType}`,
          errorCode: TriggerValidationError.InvalidTriggerChannel
        };
    }
  }

  /**
   * 验证边沿触发 - 基于原版 EdgeTriggerStep 验证逻辑，增强对 Blast/Burst 模式的支持
   */
  public validateEdgeTrigger(
    triggerChannel: number,
    negativeEdge: boolean = false,
    enableBlast: boolean = false,
    enableBurst: boolean = false,
    burstCount: number = 1,
    measureDelay: boolean = false
  ): TriggerValidationResult {

    // 基本通道验证 (0-23)
    if (triggerChannel < 0 || triggerChannel > 23) {
      return {
        isValid: false,
        errorMessage: 'Trigger channel must be between 0 and 23',
        errorCode: TriggerValidationError.InvalidTriggerChannel
      };
    }

    // Blast 和 Burst 模式不能同时启用
    if (enableBlast && enableBurst) {
      return {
        isValid: false,
        errorMessage: 'Blast mode and Burst mode cannot be enabled simultaneously',
        errorCode: TriggerValidationError.InvalidLoopCount
      };
    }

    // Burst 计数验证 (1-254)
    if (enableBurst && (burstCount < 1 || burstCount > 254)) {
      return {
        isValid: false,
        errorMessage: 'Burst count must be between 1 and 254',
        errorCode: TriggerValidationError.InvalidLoopCount
      };
    }

    return { isValid: true };
  }

  /**
   * 应用 Edge 触发到 CaptureSession - 基于原版 EdgeTriggerStep 逻辑
   */
  public applyEdgeTrigger(
    session: CaptureSession,
    triggerChannel: number,
    negativeEdge: boolean = false,
    enableBlast: boolean = false,
    enableBurst: boolean = false,
    burstCount: number = 1,
    measureDelay: boolean = false
  ): TriggerValidationResult {

    // 首先验证 Edge 触发参数
    const validation = this.validateEdgeTrigger(
      triggerChannel, negativeEdge, enableBlast, enableBurst, burstCount, measureDelay
    );
    if (!validation.isValid) {
      return validation;
    }

    // 设置触发类型
    if (enableBlast) {
      session.triggerType = TriggerType.Blast;
      session.loopCount = 0; // Blast 模式不支持循环
    } else {
      session.triggerType = TriggerType.Edge;
      session.loopCount = enableBurst ? (burstCount - 1) : 0; // LoopCount = BurstCount - 1
    }

    session.triggerChannel = triggerChannel;
    session.triggerInverted = negativeEdge;
    session.triggerBitCount = 1; // Edge 触发只使用单个位
    session.triggerPattern = 0; // Edge 触发不使用模式
    session.measureBursts = measureDelay;

    return { isValid: true };
  }

  /**
   * 验证边沿或快速触发 - 基于C#代码中的Edge/Fast触发验证逻辑
   */
  private validateEdgeOrFastTrigger(
    session: CaptureSession,
    requestedSamples: number,
    captureLimits: any
  ): TriggerValidationResult {

    // 基本验证
    if (session.triggerChannel < 0 || session.triggerChannel > this.config.channelCount - 1) {
      return {
        isValid: false,
        errorMessage: `Trigger channel must be between 0 and ${this.config.channelCount - 1}`,
        errorCode: TriggerValidationError.InvalidTriggerChannel
      };
    }

    // 样本数验证
    if (session.preTriggerSamples < captureLimits.minPreSamples ||
        session.postTriggerSamples < captureLimits.minPostSamples ||
        session.preTriggerSamples > captureLimits.maxPreSamples ||
        session.postTriggerSamples > captureLimits.maxPostSamples ||
        requestedSamples > captureLimits.maxTotalSamples) {
      return {
        isValid: false,
        errorMessage: 'Sample count exceeds device limits',
        errorCode: TriggerValidationError.InvalidSampleCount
      };
    }

    // 频率验证
    if (session.frequency < this.config.minFrequency ||
        session.frequency > this.config.maxFrequency) {
      return {
        isValid: false,
        errorMessage: `Frequency must be between ${this.config.minFrequency} and ${this.config.maxFrequency} Hz`,
        errorCode: TriggerValidationError.InvalidFrequency
      };
    }

    // 循环计数验证
    if (session.loopCount > 254) {
      return {
        isValid: false,
        errorMessage: 'Loop count cannot exceed 254',
        errorCode: TriggerValidationError.InvalidLoopCount
      };
    }

    return { isValid: true };
  }

  /**
   * 验证突发触发 - 基于C#代码中的Blast触发验证逻辑
   */
  private validateBlastTrigger(
    session: CaptureSession,
    requestedSamples: number,
    captureLimits: any
  ): TriggerValidationResult {

    // 突发触发的特殊限制
    if (session.triggerChannel < 0 || session.triggerChannel > this.config.channelCount - 1) {
      return {
        isValid: false,
        errorMessage: `Trigger channel must be between 0 and ${this.config.channelCount - 1}`,
        errorCode: TriggerValidationError.InvalidTriggerChannel
      };
    }

    // 样本数验证
    if (session.preTriggerSamples < captureLimits.minPreSamples ||
        session.postTriggerSamples < captureLimits.minPostSamples ||
        session.preTriggerSamples > captureLimits.maxPreSamples ||
        session.postTriggerSamples > captureLimits.maxPostSamples ||
        requestedSamples > captureLimits.maxTotalSamples) {
      return {
        isValid: false,
        errorMessage: 'Sample count exceeds device limits',
        errorCode: TriggerValidationError.InvalidSampleCount
      };
    }

    // 突发触发频率限制
    if (session.frequency < this.config.minFrequency ||
        session.frequency > this.config.blastFrequency) {
      return {
        isValid: false,
        errorMessage: `Blast trigger frequency must be between ${this.config.minFrequency} and ${this.config.blastFrequency} Hz`,
        errorCode: TriggerValidationError.InvalidFrequency
      };
    }

    // 突发触发不支持循环
    if (session.loopCount !== 0) {
      return {
        isValid: false,
        errorMessage: 'Blast trigger does not support loop count',
        errorCode: TriggerValidationError.InvalidLoopCount
      };
    }

    return { isValid: true };
  }

  /**
   * 验证复杂触发 - 基于C#代码中的Complex触发验证逻辑
   */
  private validateComplexTrigger(
    session: CaptureSession,
    requestedSamples: number,
    captureLimits: any
  ): TriggerValidationResult {

    // 复杂触发的特殊验证
    if (session.triggerBitCount < 1 || session.triggerBitCount > 16) {
      return {
        isValid: false,
        errorMessage: 'Complex trigger bit count must be between 1 and 16',
        errorCode: TriggerValidationError.InvalidTriggerBitCount
      };
    }

    if (session.triggerChannel < 0 || session.triggerChannel > 15) {
      return {
        isValid: false,
        errorMessage: 'Complex trigger channel must be between 0 and 15',
        errorCode: TriggerValidationError.InvalidTriggerChannel
      };
    }

    if (session.triggerChannel + session.triggerBitCount > 16) {
      return {
        isValid: false,
        errorMessage: 'Complex trigger channel range exceeds 16 channels',
        errorCode: TriggerValidationError.InvalidTriggerChannelRange
      };
    }

    // 其余验证与Edge触发相同
    return this.validateEdgeOrFastTrigger(session, requestedSamples, captureLimits);
  }

  /**
   * 构建触发请求 - 基于C# ComposeRequest方法
   */
  public composeTriggerRequest(
    session: CaptureSession,
    requestedSamples: number,
    mode: CaptureMode
  ): Uint8Array {

    if (session.triggerType === TriggerType.Edge || session.triggerType === TriggerType.Blast) {
      // 简单触发请求
      return this.composeSimpleTriggerRequest(session, mode);
    } else {
      // 复杂触发请求 (Complex/Fast)
      return this.composeComplexTriggerRequest(session, mode);
    }
  }

  /**
   * 构建简单触发请求 (Edge/Blast)
   */
  private composeSimpleTriggerRequest(session: CaptureSession, mode: CaptureMode): Uint8Array {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    let offset = 0;

    // 按照C#结构体的精确布局
    view.setUint8(offset++, session.triggerType); // triggerType: byte
    view.setUint8(offset++, session.triggerChannel); // trigger: byte
    view.setUint8(offset++, session.triggerInverted ? 1 : 0); // invertedOrCount: byte
    view.setUint16(offset, 0, true); // triggerValue: ushort (对于简单触发为0)
    offset += 2;

    // channels: byte[24] - 通道配置数组
    const channelArray = new Uint8Array(24);
    session.captureChannels.forEach((ch, index) => {
      if (index < 24) {
        channelArray[index] = ch.channelNumber;
      }
    });
    for (let i = 0; i < 24; i++) {
      view.setUint8(offset++, channelArray[i]);
    }

    view.setUint8(offset++, session.captureChannels.length); // channelCount: byte
    view.setUint32(offset, session.frequency, true); // frequency: uint32
    offset += 4;
    view.setUint32(offset, session.preTriggerSamples, true); // preSamples: uint32
    offset += 4;
    view.setUint32(offset, session.postTriggerSamples, true); // postSamples: uint32
    offset += 4;
    view.setUint8(offset++, session.loopCount); // loopCount: byte
    view.setUint8(offset++, session.measureBursts ? 1 : 0); // measure: byte
    view.setUint8(offset++, mode); // captureMode: byte

    return new Uint8Array(buffer, 0, offset);
  }

  /**
   * 构建复杂触发请求 (Complex/Fast) - 包含触发延迟补偿
   */
  private composeComplexTriggerRequest(session: CaptureSession, mode: CaptureMode): Uint8Array {
    // 计算触发延迟补偿 - 基于C#代码中的延迟计算逻辑
    const samplePeriod = 1000000000.0 / session.frequency; // 纳秒
    const delay = session.triggerType === TriggerType.Fast ?
      TriggerDelays.FastTriggerDelay :
      TriggerDelays.ComplexTriggerDelay;
    const delayPeriod = (1.0 / this.config.maxFrequency) * 1000000000.0 * delay;
    const offset = Math.round((delayPeriod / samplePeriod) + 0.3);

    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    let bufOffset = 0;

    // 按照C#结构体的精确布局
    view.setUint8(bufOffset++, session.triggerType); // triggerType: byte
    view.setUint8(bufOffset++, session.triggerChannel); // trigger: byte
    view.setUint8(bufOffset++, session.triggerBitCount); // invertedOrCount: byte (对于复杂触发是位数)
    view.setUint16(bufOffset, session.triggerPattern, true); // triggerValue: ushort (触发模式)
    bufOffset += 2;

    // channels: byte[24] - 通道配置数组
    const channelArray = new Uint8Array(24);
    session.captureChannels.forEach((ch, index) => {
      if (index < 24) {
        channelArray[index] = ch.channelNumber;
      }
    });
    for (let i = 0; i < 24; i++) {
      view.setUint8(bufOffset++, channelArray[i]);
    }

    view.setUint8(bufOffset++, session.captureChannels.length); // channelCount: byte
    view.setUint32(bufOffset, session.frequency, true); // frequency: uint32
    bufOffset += 4;
    // 应用触发延迟补偿
    view.setUint32(bufOffset, Math.max(0, session.preTriggerSamples + offset), true); // preSamples: uint32
    bufOffset += 4;
    view.setUint32(bufOffset, Math.max(0, session.postTriggerSamples - offset), true); // postSamples: uint32
    bufOffset += 4;
    view.setUint8(bufOffset++, session.loopCount); // loopCount: byte
    view.setUint8(bufOffset++, session.measureBursts ? 1 : 0); // measure: byte
    view.setUint8(bufOffset++, mode); // captureMode: byte

    return new Uint8Array(buffer, 0, bufOffset);
  }

  /**
   * 获取触发延迟补偿值 - 用于UI显示和调试
   */
  public getTriggerDelayOffset(session: CaptureSession): number {
    if (session.triggerType === TriggerType.Edge || session.triggerType === TriggerType.Blast) {
      return 0;
    }

    const samplePeriod = 1000000000.0 / session.frequency;
    const delay = session.triggerType === TriggerType.Fast ?
      TriggerDelays.FastTriggerDelay :
      TriggerDelays.ComplexTriggerDelay;
    const delayPeriod = (1.0 / this.config.maxFrequency) * 1000000000.0 * delay;

    return Math.round((delayPeriod / samplePeriod) + 0.3);
  }

  /**
   * 验证 Pattern 触发模式 - 基于原版 PatternTriggerStep 验证逻辑
   */
  public validatePatternTrigger(
    firstChannel: number,
    pattern: string,
    useFastTrigger: boolean = false
  ): TriggerValidationResult {

    // 检查模式是否为空
    if (!pattern || pattern.trim().length === 0) {
      return {
        isValid: false,
        errorMessage: 'Pattern cannot be empty',
        errorCode: TriggerValidationError.InvalidTriggerPattern
      };
    }

    // 检查模式只包含 0 和 1
    if (!/^[01]+$/.test(pattern)) {
      return {
        isValid: false,
        errorMessage: 'Pattern can only contain 0 and 1',
        errorCode: TriggerValidationError.InvalidTriggerPattern
      };
    }

    // 检查模式长度限制 (最大16位)
    if (pattern.length > 16) {
      return {
        isValid: false,
        errorMessage: 'Pattern cannot exceed 16 bits',
        errorCode: TriggerValidationError.InvalidPatternLength
      };
    }

    // 检查第一个通道范围 (0-15，因为复杂触发只支持前16个通道)
    if (firstChannel < 0 || firstChannel > 15) {
      return {
        isValid: false,
        errorMessage: 'First channel must be between 0 and 15',
        errorCode: TriggerValidationError.InvalidTriggerChannel
      };
    }

    // 检查模式通道范围不超过16个通道
    if (firstChannel + pattern.length > 16) {
      return {
        isValid: false,
        errorMessage: 'Pattern trigger can only be used in the first 16 channels',
        errorCode: TriggerValidationError.InvalidTriggerChannelRange
      };
    }

    // Fast 触发模式的特殊限制 (最大5位)
    if (useFastTrigger && pattern.length > 5) {
      return {
        isValid: false,
        errorMessage: 'Fast trigger can only be used with patterns up to 5 bits',
        errorCode: TriggerValidationError.FastTriggerPatternTooLong
      };
    }

    return { isValid: true };
  }

  /**
   * 将模式字符串转换为触发值 - 基于原版逻辑
   */
  public convertPatternToTriggerValue(pattern: string): number {
    let triggerValue = 0;

    // 从左到右处理每个位 (MSB first)
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') {
        triggerValue |= (1 << (pattern.length - 1 - i));
      }
    }

    return triggerValue;
  }

  /**
   * 将触发值转换为模式字符串 - 用于UI显示
   */
  public convertTriggerValueToPattern(triggerValue: number, bitCount: number): string {
    let pattern = '';

    for (let i = bitCount - 1; i >= 0; i--) {
      pattern += ((triggerValue >> i) & 1) ? '1' : '0';
    }

    return pattern;
  }

  /**
   * 应用 Pattern 触发到 CaptureSession
   */
  public applyPatternTrigger(
    session: CaptureSession,
    firstChannel: number,
    pattern: string,
    useFastTrigger: boolean = false
  ): TriggerValidationResult {

    // 首先验证模式
    const validation = this.validatePatternTrigger(firstChannel, pattern, useFastTrigger);
    if (!validation.isValid) {
      return validation;
    }

    // 设置触发类型
    session.triggerType = useFastTrigger ? TriggerType.Fast : TriggerType.Complex;
    session.triggerChannel = firstChannel;
    session.triggerBitCount = pattern.length;
    session.triggerPattern = this.convertPatternToTriggerValue(pattern);
    session.triggerInverted = false; // Pattern 触发不使用反转

    return { isValid: true };
  }

  /**
   * 验证触发电平设置
   */
  public validateTriggerLevel(levelConfig: TriggerLevelConfig): TriggerValidationResult {
    const maxVoltage = this.config.maxVoltage || 5.0; // 默认最大5V
    const minVoltage = this.config.minVoltage || 0.0; // 默认最小0V

    // 检查阈值电压范围
    if (levelConfig.threshold < minVoltage || levelConfig.threshold > maxVoltage) {
      return {
        isValid: false,
        errorMessage: `Trigger threshold must be between ${minVoltage}V and ${maxVoltage}V`,
        errorCode: TriggerValidationError.InvalidTriggerPattern
      };
    }

    // 检查滞回电压（如果提供）
    if (levelConfig.hysteresis !== undefined) {
      if (levelConfig.hysteresis < 0 || levelConfig.hysteresis > 1.0) {
        return {
          isValid: false,
          errorMessage: 'Hysteresis voltage must be between 0V and 1.0V',
          errorCode: TriggerValidationError.InvalidTriggerPattern
        };
      }

      // 确保阈值±滞回不超出范围
      if (levelConfig.threshold - levelConfig.hysteresis < minVoltage ||
          levelConfig.threshold + levelConfig.hysteresis > maxVoltage) {
        return {
          isValid: false,
          errorMessage: 'Trigger threshold ± hysteresis exceeds voltage range',
          errorCode: TriggerValidationError.InvalidTriggerPattern
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 获取推荐的触发电平 - 基于信号类型
   */
  public getRecommendedTriggerLevel(signalType: 'TTL' | 'CMOS' | 'LVDS' | 'Custom'): TriggerLevelConfig {
    switch (signalType) {
      case 'TTL':
        return {
          threshold: 1.4, // TTL 标准阈值
          hysteresis: 0.4,
          inputImpedance: 1000000 // 1MΩ
        };
      case 'CMOS':
        return {
          threshold: 1.65, // CMOS 3.3V 阈值
          hysteresis: 0.2,
          inputImpedance: 1000000 // 1MΩ
        };
      case 'LVDS':
        return {
          threshold: 1.2, // LVDS 差分阈值
          hysteresis: 0.1,
          inputImpedance: 100 // 100Ω
        };
      default:
        return {
          threshold: this.config.defaultThreshold || 1.65,
          hysteresis: 0.2,
          inputImpedance: 1000000
        };
    }
  }

  /**
   * 转换触发条件到内部表示
   */
  public convertTriggerCondition(condition: TriggerCondition): {
    triggerType: TriggerType;
    triggerInverted: boolean;
  } {
    switch (condition) {
      case TriggerCondition.RisingEdge:
        return { triggerType: TriggerType.Edge, triggerInverted: false };
      case TriggerCondition.FallingEdge:
        return { triggerType: TriggerType.Edge, triggerInverted: true };
      case TriggerCondition.BothEdges:
        // 需要特殊处理，可能需要两个单独的触发
        return { triggerType: TriggerType.Edge, triggerInverted: false };
      case TriggerCondition.HighLevel:
        return { triggerType: TriggerType.Complex, triggerInverted: false };
      case TriggerCondition.LowLevel:
        return { triggerType: TriggerType.Complex, triggerInverted: true };
      case TriggerCondition.AnyChange:
        return { triggerType: TriggerType.Edge, triggerInverted: false };
      default:
        return { triggerType: TriggerType.Edge, triggerInverted: false };
    }
  }

  /**
   * 获取触发类型的描述信息
   */
  public getTriggerTypeDescription(triggerType: TriggerType): string {
    switch (triggerType) {
      case TriggerType.Edge:
        return 'Edge Trigger - Triggers on rising or falling edge of a single channel';
      case TriggerType.Complex:
        return 'Complex Trigger - Triggers on specific bit pattern across multiple channels';
      case TriggerType.Fast:
        return 'Fast Trigger - High-speed pattern trigger with minimal delay';
      case TriggerType.Blast:
        return 'Blast Trigger - High-frequency burst capture trigger';
      default:
        return 'Unknown trigger type';
    }
  }

  /**
   * 更新处理器配置
   */
  public updateConfig(config: Partial<TriggerProcessorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 触发处理器工厂类
 */
export class TriggerProcessorFactory {
  /**
   * 为特定设备创建触发处理器
   */
  public static createForDevice(deviceInfo: {
    channelCount: number;
    maxFrequency: number;
    minFrequency?: number;
    blastFrequency: number;
    bufferSize: number;
  }): TriggerProcessor {

    const config: TriggerProcessorConfig = {
      channelCount: deviceInfo.channelCount,
      maxFrequency: deviceInfo.maxFrequency,
      minFrequency: deviceInfo.minFrequency || Math.floor((deviceInfo.maxFrequency * 2) / 65535),
      blastFrequency: deviceInfo.blastFrequency,
      bufferSize: deviceInfo.bufferSize
    };

    return new TriggerProcessor(config);
  }
}
