/**
 * 信号测量和统计分析服务
 * 基于原版 ChannelMeasures.axaml.cs 和 MeasureDialog.axaml.cs 实现
 * 提供完整的数字信号测量、频率分析、脉冲分析、统计分析功能
 */
import { AnalyzerChannel, CaptureSession } from '../models/AnalyzerTypes';

// 脉冲测量结果
export interface PulseMeasurement {
  count: number;           // 脉冲数量
  averageDuration: number; // 平均持续时间 (秒)
  predictedDuration: number; // 预测持续时间 (秒) - 基于95%统计
  minDuration: number;     // 最小持续时间
  maxDuration: number;     // 最大持续时间
  totalDuration: number;   // 总持续时间
  durations: number[];     // 所有脉冲持续时间数组
}

// 频率测量结果
export interface FrequencyMeasurement {
  averageFrequency: number;    // 平均频率 (Hz)
  predictedFrequency: number;  // 预测频率 (Hz) - 基于95%统计
  dominantFrequency: number;   // 主导频率
  frequencyStability: number; // 频率稳定性 (%)
  period: number;              // 周期 (秒)
  dutyCycle: number;           // 占空比 (%)
}

// 统计分析结果
export interface StatisticalAnalysis {
  totalSamples: number;        // 总样本数
  samplePeriod: number;        // 采样周期 (秒)
  totalDuration: number;       // 总时长 (秒)
  transitions: number;         // 状态转换次数
  highStateTime: number;       // 高电平总时间 (秒)
  lowStateTime: number;        // 低电平总时间 (秒)
  highStateRatio: number;      // 高电平占比 (%)
  lowStateRatio: number;       // 低电平占比 (%)
  glitchCount: number;         // 毛刺数量
  averageTransitionTime: number; // 平均转换时间
}

// 信号质量分析
export interface SignalQuality {
  signalIntegrity: number;     // 信号完整性评分 (0-100)
  noiseLevel: number;          // 噪声水平 (0-100)
  edgeQuality: number;         // 边沿质量 (0-100)
  jitterLevel: number;         // 抖动水平 (ns)
  stabilityScore: number;      // 稳定性评分 (0-100)
  recommendations: string[];   // 优化建议
}

// 通道测量结果
export interface ChannelMeasurementResult {
  channelNumber: number;
  channelName: string;
  positivePulses: PulseMeasurement;
  negativePulses: PulseMeasurement;
  frequency: FrequencyMeasurement;
  statistics: StatisticalAnalysis;
  signalQuality: SignalQuality;
}

// 整体测量结果
export interface MeasurementResult {
  timestamp: string;
  sampleRate: number;
  totalChannels: number;
  measurementDuration: number;
  channels: ChannelMeasurementResult[];
  crossChannelAnalysis?: CrossChannelAnalysis;
}

// 跨通道分析
export interface CrossChannelAnalysis {
  synchronization: SynchronizationAnalysis[];
  correlations: ChannelCorrelation[];
  timingRelationships: TimingRelationship[];
}

export interface SynchronizationAnalysis {
  channel1: number;
  channel2: number;
  synchronizationRate: number; // 同步率 (%)
  phaseOffset: number;         // 相位偏移 (度)
  timeOffset: number;          // 时间偏移 (秒)
}

export interface ChannelCorrelation {
  channel1: number;
  channel2: number;
  correlationCoefficient: number; // 相关系数 (-1 to 1)
  correlationType: 'positive' | 'negative' | 'none';
}

export interface TimingRelationship {
  channel1: number;
  channel2: number;
  relationship: 'master-slave' | 'synchronous' | 'independent';
  confidence: number; // 置信度 (%)
}

export class SignalMeasurementService {

  /**
   * 执行完整的信号测量分析
   * 基于原版 MeasureDialog.SetData 方法
   */
  async performMeasurement(
    channels: AnalyzerChannel[],
    sampleRate: number,
    options?: {
      enableCrossChannelAnalysis?: boolean;
      enableSignalQuality?: boolean;
      glitchDetectionThreshold?: number; // ns
    }
  ): Promise<MeasurementResult> {
    const startTime = Date.now();
    const channelResults: ChannelMeasurementResult[] = [];

    // 分析每个通道
    for (const channel of channels) {
      if (channel.samples && !channel.hidden) {
        const result = await this.analyzeChannel(channel, sampleRate, options);
        channelResults.push(result);
      }
    }

    // 跨通道分析
    let crossChannelAnalysis: CrossChannelAnalysis | undefined;
    if (options?.enableCrossChannelAnalysis && channelResults.length > 1) {
      crossChannelAnalysis = await this.performCrossChannelAnalysis(channelResults, sampleRate);
    }

    const measurementDuration = Date.now() - startTime;

    return {
      timestamp: new Date().toISOString(),
      sampleRate,
      totalChannels: channelResults.length,
      measurementDuration,
      channels: channelResults,
      crossChannelAnalysis
    };
  }

  /**
   * 分析单个通道
   * 基于原版 ChannelMeasures.SetData 方法的精确实现
   */
  private async analyzeChannel(
    channel: AnalyzerChannel,
    sampleRate: number,
    options?: any
  ): Promise<ChannelMeasurementResult> {
    const samples = channel.samples!;
    
    // 基础统计信息
    const statistics = this.calculateStatistics(samples, sampleRate);
    
    // 脉冲分析 - 精确对应原版算法
    const { positivePulses, negativePulses } = this.analyzePulses(samples, sampleRate);
    
    // 频率分析
    const frequency = this.analyzeFrequency(positivePulses, negativePulses, sampleRate);
    
    // 信号质量分析
    let signalQuality: SignalQuality = {
      signalIntegrity: 100,
      noiseLevel: 0,
      edgeQuality: 100,
      jitterLevel: 0,
      stabilityScore: 100,
      recommendations: []
    };
    
    if (options?.enableSignalQuality) {
      signalQuality = this.analyzeSignalQuality(samples, sampleRate, options);
    }

    return {
      channelNumber: channel.channelNumber,
      channelName: channel.channelName,
      positivePulses,
      negativePulses,
      frequency,
      statistics,
      signalQuality
    };
  }

  /**
   * 脉冲分析 - 精确复制原版算法
   * 对应 ChannelMeasures.SetData 中的脉冲检测和分组逻辑
   */
  private analyzePulses(samples: Uint8Array, sampleRate: number): {
    positivePulses: PulseMeasurement;
    negativePulses: PulseMeasurement;
  } {
    let currentPulse = -1;
    let currentCount = 0;
    
    const posLengths: number[] = [];
    const negLengths: number[] = [];

    // 脉冲检测循环 - 精确对应原版
    for (let i = 0; i < samples.length; i++) {
      const sampleValue = samples[i];
      
      if (sampleValue !== currentPulse) {
        if (currentPulse === 1) {
          posLengths.push(currentCount);
        } else if (currentPulse === 0) {
          negLengths.push(currentCount);
        }
        
        currentPulse = sampleValue;
        currentCount = 1;
      } else {
        currentCount++;
      }
    }

    // 处理最后一个脉冲
    if (currentPulse === 1) {
      posLengths.push(currentCount);
    } else if (currentPulse === 0) {
      negLengths.push(currentCount);
    }

    // 统计分析和95%过滤 - 精确对应原版
    const positivePulses = this.calculatePulseMeasurement(posLengths, sampleRate, 'positive');
    const negativePulses = this.calculatePulseMeasurement(negLengths, sampleRate, 'negative');

    return { positivePulses, negativePulses };
  }

  /**
   * 计算脉冲测量结果 - 对应原版的95%统计过滤算法
   */
  private calculatePulseMeasurement(
    lengths: number[], 
    sampleRate: number, 
    type: 'positive' | 'negative'
  ): PulseMeasurement {
    if (lengths.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        predictedDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        totalDuration: 0,
        durations: []
      };
    }

    // 转换为时间单位
    const durations = lengths.map(len => len / sampleRate);
    
    // 原版的分组和过滤算法
    const grouped = this.groupByValue(lengths);
    const orderedByCount = this.flattenGroups(grouped);
    
    // 95%过滤 - 精确对应原版
    const fivePercent = Math.floor(orderedByCount.length * 0.95);
    const filteredSamples = orderedByCount.slice(fivePercent);
    const filteredDurations = filteredSamples.map(len => len / sampleRate);

    // 计算统计值
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const predictedDuration = filteredDurations.length > 0 ? 
      filteredDurations.reduce((sum, d) => sum + d, 0) / filteredDurations.length : 0;
    
    return {
      count: lengths.length,
      averageDuration,
      predictedDuration,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      durations
    };
  }

  /**
   * 分组算法 - 对应原版的 GroupBy 实现
   */
  private groupByValue(values: number[]): Array<{ key: number; items: number[] }> {
    const groups = new Map<number, number[]>();
    
    for (const value of values) {
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value)!.push(value);
    }
    
    return Array.from(groups.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => a.items.length - b.items.length);
  }

  /**
   * 展平分组 - 对应原版的 SelectMany 实现
   */
  private flattenGroups(groups: Array<{ key: number; items: number[] }>): number[] {
    return groups.flatMap(g => g.items);
  }

  /**
   * 频率分析 - 基于原版的频率计算逻辑
   */
  private analyzeFrequency(
    positivePulses: PulseMeasurement,
    negativePulses: PulseMeasurement,
    sampleRate: number
  ): FrequencyMeasurement {
    // 对应原版的频率计算
    const avgPosPeriod = positivePulses.averageDuration;
    const avgNegPeriod = negativePulses.averageDuration;
    const predPosPeriod = positivePulses.predictedDuration;
    const predNegPeriod = negativePulses.predictedDuration;
    
    const period = avgPosPeriod + avgNegPeriod;
    const predPeriod = predPosPeriod + predNegPeriod;
    
    const averageFrequency = period > 0 ? 1.0 / period : 0;
    const predictedFrequency = predPeriod > 0 ? 1.0 / predPeriod : 0;
    
    // 计算占空比
    const dutyCycle = period > 0 ? (avgPosPeriod / period) * 100 : 0;
    
    // 频率稳定性分析
    const frequencyStability = this.calculateFrequencyStability(
      positivePulses.durations, 
      negativePulses.durations, 
      sampleRate
    );
    
    // 主导频率分析
    const dominantFrequency = this.findDominantFrequency(
      positivePulses.durations, 
      negativePulses.durations, 
      sampleRate
    );

    return {
      averageFrequency,
      predictedFrequency,
      dominantFrequency,
      frequencyStability,
      period,
      dutyCycle
    };
  }

  /**
   * 计算基础统计信息
   */
  private calculateStatistics(samples: Uint8Array, sampleRate: number): StatisticalAnalysis {
    const totalSamples = samples.length;
    const samplePeriod = 1.0 / sampleRate;
    const totalDuration = totalSamples * samplePeriod;
    
    let transitions = 0;
    let highSamples = 0;
    let lowSamples = 0;
    let lastState = -1;
    
    for (let i = 0; i < samples.length; i++) {
      const currentState = samples[i];
      
      if (currentState === 1) {
        highSamples++;
      } else if (currentState === 0) {
        lowSamples++;
      }
      
      if (lastState !== -1 && lastState !== currentState) {
        transitions++;
      }
      
      lastState = currentState;
    }
    
    const highStateTime = highSamples * samplePeriod;
    const lowStateTime = lowSamples * samplePeriod;
    const highStateRatio = (highSamples / totalSamples) * 100;
    const lowStateRatio = (lowSamples / totalSamples) * 100;
    
    // 毛刺检测
    const glitchCount = this.detectGlitches(samples, sampleRate);
    
    // 平均转换时间
    const averageTransitionTime = transitions > 0 ? totalDuration / transitions : 0;

    return {
      totalSamples,
      samplePeriod,
      totalDuration,
      transitions,
      highStateTime,
      lowStateTime,
      highStateRatio,
      lowStateRatio,
      glitchCount,
      averageTransitionTime
    };
  }

  /**
   * 信号质量分析
   */
  private analyzeSignalQuality(
    samples: Uint8Array, 
    sampleRate: number, 
    options: any
  ): SignalQuality {
    const recommendations: string[] = [];
    
    // 信号完整性评估
    const signalIntegrity = this.calculateSignalIntegrity(samples);
    
    // 噪声水平检测
    const noiseLevel = this.detectNoiseLevel(samples, sampleRate);
    
    // 边沿质量分析
    const edgeQuality = this.analyzeEdgeQuality(samples, sampleRate);
    
    // 抖动分析
    const jitterLevel = this.measureJitter(samples, sampleRate);
    
    // 稳定性评分
    const stabilityScore = this.calculateStabilityScore(samples, sampleRate);
    
    // 生成建议
    if (signalIntegrity < 80) {
      recommendations.push('检查信号连接和屏蔽');
    }
    if (noiseLevel > 20) {
      recommendations.push('考虑增加滤波或改善接地');
    }
    if (edgeQuality < 70) {
      recommendations.push('检查信号驱动能力和负载匹配');
    }
    if (jitterLevel > 1000) { // 1μs
      recommendations.push('检查时钟质量和电源稳定性');
    }
    if (stabilityScore < 85) {
      recommendations.push('增加采样率或使用触发功能');
    }

    return {
      signalIntegrity,
      noiseLevel,
      edgeQuality,
      jitterLevel,
      stabilityScore,
      recommendations
    };
  }

  /**
   * 跨通道分析
   */
  private async performCrossChannelAnalysis(
    channelResults: ChannelMeasurementResult[], 
    sampleRate: number
  ): Promise<CrossChannelAnalysis> {
    const synchronization: SynchronizationAnalysis[] = [];
    const correlations: ChannelCorrelation[] = [];
    const timingRelationships: TimingRelationship[] = [];
    
    // 两两比较所有通道
    for (let i = 0; i < channelResults.length; i++) {
      for (let j = i + 1; j < channelResults.length; j++) {
        const ch1 = channelResults[i];
        const ch2 = channelResults[j];
        
        // 同步分析
        const syncAnalysis = this.analyzeSynchronization(ch1, ch2, sampleRate);
        synchronization.push(syncAnalysis);
        
        // 相关性分析
        const correlation = this.calculateCorrelation(ch1, ch2);
        correlations.push(correlation);
        
        // 时序关系分析
        const timing = this.analyzeTimingRelationship(ch1, ch2);
        timingRelationships.push(timing);
      }
    }

    return {
      synchronization,
      correlations,
      timingRelationships
    };
  }

  // 辅助方法实现

  private calculateFrequencyStability(
    posDurations: number[], 
    negDurations: number[], 
    sampleRate: number
  ): number {
    const allPeriods = [];
    const minLength = Math.min(posDurations.length, negDurations.length);
    
    for (let i = 0; i < minLength; i++) {
      allPeriods.push(posDurations[i] + negDurations[i]);
    }
    
    if (allPeriods.length === 0) return 100;
    
    const avgPeriod = allPeriods.reduce((sum, p) => sum + p, 0) / allPeriods.length;
    const variance = allPeriods.reduce((sum, p) => sum + Math.pow(p - avgPeriod, 2), 0) / allPeriods.length;
    const standardDeviation = Math.sqrt(variance);
    
    return Math.max(0, Math.min(100, 100 - (standardDeviation / avgPeriod) * 100));
  }

  private findDominantFrequency(
    posDurations: number[], 
    negDurations: number[], 
    sampleRate: number
  ): number {
    const frequencies = new Map<number, number>();
    const minLength = Math.min(posDurations.length, negDurations.length);
    
    for (let i = 0; i < minLength; i++) {
      const period = posDurations[i] + negDurations[i];
      if (period > 0) {
        const freq = Math.round(1.0 / period);
        frequencies.set(freq, (frequencies.get(freq) || 0) + 1);
      }
    }
    
    let maxCount = 0;
    let dominantFreq = 0;
    
    for (const [freq, count] of frequencies.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantFreq = freq;
      }
    }
    
    return dominantFreq;
  }

  private detectGlitches(samples: Uint8Array, sampleRate: number, thresholdNs: number = 100): number {
    let glitchCount = 0;
    const thresholdSamples = Math.max(1, Math.floor((thresholdNs * 1e-9) * sampleRate));
    
    let currentState = -1;
    let stateCount = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      
      if (sample === currentState) {
        stateCount++;
      } else {
        if (currentState !== -1 && stateCount < thresholdSamples) {
          glitchCount++;
        }
        currentState = sample;
        stateCount = 1;
      }
    }
    
    return glitchCount;
  }

  private calculateSignalIntegrity(samples: Uint8Array): number {
    // 简化的信号完整性评估
    const validSamples = Array.from(samples).filter(s => s === 0 || s === 1).length;
    return (validSamples / samples.length) * 100;
  }

  private detectNoiseLevel(samples: Uint8Array, sampleRate: number): number {
    // 简化的噪声检测 - 基于快速状态变化
    let rapidChanges = 0;
    const windowSize = Math.max(1, Math.floor(sampleRate / 1000000)); // 1μs窗口
    
    for (let i = windowSize; i < samples.length - windowSize; i++) {
      let changes = 0;
      for (let j = i - windowSize; j < i + windowSize - 1; j++) {
        if (samples[j] !== samples[j + 1]) changes++;
      }
      if (changes > windowSize) rapidChanges++;
    }
    
    return Math.min(100, (rapidChanges / samples.length) * 10000);
  }

  private analyzeEdgeQuality(samples: Uint8Array, sampleRate: number): number {
    // 简化的边沿质量分析 - 基于转换的陡峭程度
    let goodEdges = 0;
    let totalEdges = 0;
    
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] !== samples[i - 1]) {
        totalEdges++;
        // 假设单个采样周期内的转换是好的边沿
        goodEdges++;
      }
    }
    
    return totalEdges > 0 ? (goodEdges / totalEdges) * 100 : 100;
  }

  private measureJitter(samples: Uint8Array, sampleRate: number): number {
    // 简化的抖动测量 - 基于周期变化
    const periods: number[] = [];
    let lastEdge = -1;
    
    for (let i = 1; i < samples.length; i++) {
      if (samples[i] !== samples[i - 1]) {
        if (lastEdge !== -1) {
          periods.push(i - lastEdge);
        }
        lastEdge = i;
      }
    }
    
    if (periods.length < 2) return 0;
    
    const avgPeriod = periods.reduce((sum, p) => sum + p, 0) / periods.length;
    const jitterSamples = Math.sqrt(
      periods.reduce((sum, p) => sum + Math.pow(p - avgPeriod, 2), 0) / periods.length
    );
    
    return (jitterSamples / sampleRate) * 1e9; // 转换为纳秒
  }

  private calculateStabilityScore(samples: Uint8Array, sampleRate: number): number {
    // 基于信号的规律性和一致性
    const patternLength = Math.min(1000, Math.floor(samples.length / 10));
    let matchingPatterns = 0;
    let totalComparisons = 0;
    
    for (let i = 0; i < samples.length - patternLength * 2; i += patternLength) {
      totalComparisons++;
      let matches = 0;
      
      for (let j = 0; j < patternLength; j++) {
        if (samples[i + j] === samples[i + patternLength + j]) {
          matches++;
        }
      }
      
      if (matches / patternLength > 0.8) {
        matchingPatterns++;
      }
    }
    
    return totalComparisons > 0 ? (matchingPatterns / totalComparisons) * 100 : 100;
  }

  private analyzeSynchronization(
    ch1: ChannelMeasurementResult, 
    ch2: ChannelMeasurementResult, 
    sampleRate: number
  ): SynchronizationAnalysis {
    // 简化的同步分析
    const freq1 = ch1.frequency.averageFrequency;
    const freq2 = ch2.frequency.averageFrequency;
    
    const freqDiff = Math.abs(freq1 - freq2);
    const avgFreq = (freq1 + freq2) / 2;
    const synchronizationRate = avgFreq > 0 ? Math.max(0, 100 - (freqDiff / avgFreq) * 100) : 0;
    
    return {
      channel1: ch1.channelNumber,
      channel2: ch2.channelNumber,
      synchronizationRate,
      phaseOffset: 0, // 需要更复杂的算法来计算
      timeOffset: 0   // 需要更复杂的算法来计算
    };
  }

  private calculateCorrelation(
    ch1: ChannelMeasurementResult, 
    ch2: ChannelMeasurementResult
  ): ChannelCorrelation {
    // 简化的相关性分析 - 基于频率和占空比的相似性
    const freq1 = ch1.frequency.averageFrequency;
    const freq2 = ch2.frequency.averageFrequency;
    const duty1 = ch1.frequency.dutyCycle;
    const duty2 = ch2.frequency.dutyCycle;
    
    const freqSimilarity = freq1 > 0 && freq2 > 0 ? 
      1 - Math.abs(freq1 - freq2) / Math.max(freq1, freq2) : 0;
    const dutySimilarity = 1 - Math.abs(duty1 - duty2) / 100;
    
    const correlationCoefficient = (freqSimilarity + dutySimilarity) / 2;
    
    let correlationType: 'positive' | 'negative' | 'none' = 'none';
    if (correlationCoefficient > 0.7) {
      correlationType = 'positive';
    } else if (correlationCoefficient < -0.7) {
      correlationType = 'negative';
    }

    return {
      channel1: ch1.channelNumber,
      channel2: ch2.channelNumber,
      correlationCoefficient,
      correlationType
    };
  }

  private analyzeTimingRelationship(
    ch1: ChannelMeasurementResult, 
    ch2: ChannelMeasurementResult
  ): TimingRelationship {
    // 简化的时序关系分析
    const freq1 = ch1.frequency.averageFrequency;
    const freq2 = ch2.frequency.averageFrequency;
    
    let relationship: 'master-slave' | 'synchronous' | 'independent' = 'independent';
    let confidence = 0;
    
    if (Math.abs(freq1 - freq2) < Math.min(freq1, freq2) * 0.05) {
      // 频率接近，可能是同步的
      relationship = 'synchronous';
      confidence = 85;
    } else if (freq1 > freq2 * 1.5 && Number.isInteger(freq1 / freq2)) {
      // ch1频率是ch2的整数倍，可能是主从关系
      relationship = 'master-slave';
      confidence = 75;
    } else if (freq2 > freq1 * 1.5 && Number.isInteger(freq2 / freq1)) {
      // ch2频率是ch1的整数倍，可能是主从关系
      relationship = 'master-slave';
      confidence = 75;
    } else {
      relationship = 'independent';
      confidence = 60;
    }

    return {
      channel1: ch1.channelNumber,
      channel2: ch2.channelNumber,
      relationship,
      confidence
    };
  }
}

// 导出单例实例
export const signalMeasurementService = new SignalMeasurementService();