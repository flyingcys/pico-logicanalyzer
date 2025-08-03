/**
 * 测量工具 - 基于原版的MeasureDialog功能
 * 提供脉冲宽度、频率、占空比等高级测量功能
 */

import { AnalyzerChannel } from '../../models/CaptureModels';

export interface PulseInfo {
  startSample: number;
  endSample: number;
  width: number; // 脉冲宽度（秒）
  level: boolean; // 高电平(true)或低电平(false)
  channelIndex: number;
}

export interface FrequencyMeasurement {
  frequency: number; // Hz
  period: number; // 秒
  accuracy: number; // 测量精度
  sampleCount: number; // 用于测量的样本数
  confidence: number; // 置信度 (0-1)
}

export interface DutyCycleMeasurement {
  dutyCycle: number; // 占空比 (0-1)
  highTime: number; // 高电平时间（秒）
  lowTime: number; // 低电平时间（秒）
  period: number; // 周期（秒）
  frequency: number; // 频率 (Hz)
}

export interface EdgeMeasurement {
  type: 'rising' | 'falling';
  startSample: number;
  endSample: number;
  riseTime?: number; // 上升时间（秒）
  fallTime?: number; // 下降时间（秒）
  amplitude?: number; // 幅度
}

export interface StatisticalMeasurement {
  min: number;
  max: number;
  mean: number;
  rms: number;
  standardDeviation: number;
  sampleCount: number;
}

export interface MeasurementConfig {
  edgeThreshold: number; // 边沿检测阈值 (0-1)
  minimumPulseWidth: number; // 最小脉冲宽度（样本数）
  maximumPulseWidth: number; // 最大脉冲宽度（样本数）
  hysteresis: number; // 滞后量（样本数）
  autoRange: boolean; // 自动范围选择
  statisticalSamples: number; // 统计测量的样本数
}

export class MeasurementTools {
  private config: MeasurementConfig;
  private sampleRate = 1000000; // 默认1MHz
  private channels: AnalyzerChannel[] = [];

  constructor(config?: Partial<MeasurementConfig>) {
    this.config = {
      edgeThreshold: 0.5,
      minimumPulseWidth: 2,
      maximumPulseWidth: 1000000,
      hysteresis: 1,
      autoRange: true,
      statisticalSamples: 10000,
      ...config
    };
  }

  /**
   * 设置采样信息
   */
  public setSampleInfo(sampleRate: number, channels: AnalyzerChannel[]): void {
    this.sampleRate = sampleRate;
    this.channels = channels;
  }

  /**
   * 检测边沿 - 基于原版的边沿检测逻辑
   */
  public detectEdges(
    channelIndex: number,
    startSample: number = 0,
    endSample?: number,
    edgeType: 'rising' | 'falling' | 'both' = 'both'
  ): EdgeMeasurement[] {
    if (channelIndex >= this.channels.length) {
      throw new Error(`Channel ${channelIndex} not found`);
    }

    const channel = this.channels[channelIndex];
    if (!channel.samples) {
      return [];
    }

    const { samples } = channel;
    const actualEndSample = endSample || samples.length;
    const edges: EdgeMeasurement[] = [];

    let lastValue = samples[startSample];

    for (let i = startSample + 1; i < actualEndSample; i++) {
      const currentValue = samples[i];

      // 检测上升沿
      if (currentValue > lastValue && (edgeType === 'rising' || edgeType === 'both')) {
        edges.push({
          type: 'rising',
          startSample: i - 1,
          endSample: i
        });
      }

      // 检测下降沿
      if (currentValue < lastValue && (edgeType === 'falling' || edgeType === 'both')) {
        edges.push({
          type: 'falling',
          startSample: i - 1,
          endSample: i
        });
      }

      lastValue = currentValue;
    }

    return edges;
  }

  /**
   * 测量频率
   */
  public measureFrequency(
    channelIndex: number,
    startSample: number = 0,
    endSample?: number
  ): FrequencyMeasurement | null {
    const edges = this.detectEdges(channelIndex, startSample, endSample, 'rising');

    if (edges.length < 2) {
      return null;
    }

    const periods: number[] = [];

    for (let i = 1; i < edges.length; i++) {
      const periodSamples = edges[i].startSample - edges[i - 1].startSample;
      const period = periodSamples / this.sampleRate;
      periods.push(period);
    }

    if (periods.length === 0) {
      return null;
    }

    const avgPeriod = periods.reduce((sum, p) => sum + p, 0) / periods.length;
    const frequency = 1 / avgPeriod;

    const variance = periods.reduce((sum, p) => sum + Math.pow(p - avgPeriod, 2), 0) / periods.length;
    const stdDev = Math.sqrt(variance);
    const accuracy = stdDev / avgPeriod;

    const confidence = Math.min(0.95, Math.max(0.1, periods.length / 10 * (1 - accuracy)));

    return {
      frequency,
      period: avgPeriod,
      accuracy,
      sampleCount: edges.length,
      confidence
    };
  }

  /**
   * 测量占空比 - 基于原版的占空比计算算法
   */
  public measureDutyCycle(
    channelIndex: number,
    startSample: number = 0,
    endSample?: number
  ): DutyCycleMeasurement | null {
    if (channelIndex >= this.channels.length) {
      throw new Error(`Channel ${channelIndex} not found`);
    }

    const channel = this.channels[channelIndex];
    if (!channel.samples) {
      return null;
    }

    const { samples } = channel;
    const actualEndSample = endSample || samples.length;

    // 检测完整的脉冲周期
    const pulses = this.detectPulses(channelIndex, startSample, actualEndSample);

    if (pulses.length < 2) {
      return null;
    }

    // 计算高电平和低电平脉冲的持续时间
    const highPulses = pulses.filter(p => p.level);
    const lowPulses = pulses.filter(p => !p.level);

    if (highPulses.length === 0 && lowPulses.length === 0) {
      return null;
    }

    // 计算总高电平时间和总低电平时间
    const totalHighTime = highPulses.reduce((sum, p) => sum + p.width, 0);
    const totalLowTime = lowPulses.reduce((sum, p) => sum + p.width, 0);
    const totalTime = totalHighTime + totalLowTime;

    if (totalTime === 0) {
      return null;
    }

    const dutyCycle = totalHighTime / totalTime;
    const period = totalTime / Math.max(highPulses.length, lowPulses.length);
    const frequency = period > 0 ? 1 / period : 0;

    return {
      dutyCycle,
      highTime: totalHighTime,
      lowTime: totalLowTime,
      period,
      frequency
    };
  }

  /**
   * 检测脉冲 - 基于原版的脉冲检测算法
   */
  public detectPulses(
    channelIndex: number,
    startSample: number = 0,
    endSample?: number
  ): PulseInfo[] {
    if (channelIndex >= this.channels.length) {
      throw new Error(`Channel ${channelIndex} not found`);
    }

    const channel = this.channels[channelIndex];
    if (!channel.samples) {
      return [];
    }

    const { samples } = channel;
    const actualEndSample = endSample || samples.length;
    const pulses: PulseInfo[] = [];

    let currentLevel = samples[startSample];
    let pulseStart = startSample;

    for (let i = startSample + 1; i < actualEndSample; i++) {
      const sample = samples[i];

      if (sample !== currentLevel) {
        // 结束当前脉冲
        const pulseEnd = i - 1;
        const pulseSamples = pulseEnd - pulseStart + 1;

        // 过滤掉太短的脉冲（可能是噪声）
        if (pulseSamples >= this.config.minimumPulseWidth) {
          const width = pulseSamples / this.sampleRate;

          pulses.push({
            startSample: pulseStart,
            endSample: pulseEnd,
            width,
            level: currentLevel === 1,
            channelIndex
          });
        }

        // 开始新的脉冲
        currentLevel = sample;
        pulseStart = i;
      }
    }

    // 添加最后一个脉冲
    if (pulseStart < actualEndSample - 1) {
      const pulseSamples = actualEndSample - pulseStart;
      if (pulseSamples >= this.config.minimumPulseWidth) {
        const width = pulseSamples / this.sampleRate;

        pulses.push({
          startSample: pulseStart,
          endSample: actualEndSample - 1,
          width,
          level: currentLevel === 1,
          channelIndex
        });
      }
    }

    return pulses;
  }

  /**
   * 测量时间间隔 - 两个样本点之间的时间差
   */
  public measureTimeInterval(startSample: number, endSample: number): number {
    const sampleDiff = Math.abs(endSample - startSample);
    return sampleDiff / this.sampleRate;
  }

  /**
   * 统计测量 - 对指定范围的数据进行统计分析
   */
  public measureStatistics(
    channelIndex: number,
    startSample: number = 0,
    endSample?: number
  ): StatisticalMeasurement | null {
    if (channelIndex >= this.channels.length) {
      throw new Error(`Channel ${channelIndex} not found`);
    }

    const channel = this.channels[channelIndex];
    if (!channel.samples) {
      return null;
    }

    const { samples } = channel;
    const actualEndSample = endSample || samples.length;
    const sampleRange = samples.slice(startSample, actualEndSample);

    if (sampleRange.length === 0) {
      return null;
    }

    // 基础统计计算
    const min = Math.min(...Array.from(sampleRange));
    const max = Math.max(...Array.from(sampleRange));
    const sum = Array.from(sampleRange).reduce((acc, val) => acc + val, 0);
    const mean = sum / sampleRange.length;

    // RMS计算
    const squareSum = Array.from(sampleRange).reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(squareSum / sampleRange.length);

    // 标准差计算
    const variance = Array.from(sampleRange).reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sampleRange.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      min,
      max,
      mean,
      rms,
      standardDeviation,
      sampleCount: sampleRange.length
    };
  }

  /**
   * 高级频率分析 - 使用FFT算法进行频谱分析
   */
  public analyzeFrequencySpectrum(
    channelIndex: number,
    startSample: number = 0,
    endSample?: number,
    windowSize: number = 1024
  ): { frequency: number; magnitude: number }[] {
    if (channelIndex >= this.channels.length) {
      throw new Error(`Channel ${channelIndex} not found`);
    }

    const channel = this.channels[channelIndex];
    if (!channel.samples) {
      return [];
    }

    const { samples } = channel;
    const actualEndSample = endSample || samples.length;
    const sampleRange = samples.slice(startSample, actualEndSample);

    // 简化的频谱分析（不使用完整的FFT）
    // 这里实现一个基础的频率检测算法
    const spectrum: { frequency: number; magnitude: number }[] = [];
    const nyquistFreq = this.sampleRate / 2;
    const freqBins = 50; // 频率分析的箱数

    for (let bin = 1; bin < freqBins; bin++) {
      const targetFreq = (bin * nyquistFreq) / freqBins;
      const magnitude = this.calculateMagnitudeAtFrequency(sampleRange, targetFreq, this.sampleRate);

      spectrum.push({
        frequency: targetFreq,
        magnitude
      });
    }

    // 按幅度排序，找出主要频率分量
    return spectrum.sort((a, b) => b.magnitude - a.magnitude);
  }

  /**
   * 计算特定频率的幅度 - 简化的频率域分析
   */
  private calculateMagnitudeAtFrequency(samples: Uint8Array, frequency: number, sampleRate: number): number {
    let realSum = 0;
    let imagSum = 0;

    for (let i = 0; i < samples.length; i++) {
      const angle = 2 * Math.PI * frequency * i / sampleRate;
      realSum += samples[i] * Math.cos(angle);
      imagSum += samples[i] * Math.sin(angle);
    }

    return Math.sqrt(realSum * realSum + imagSum * imagSum) / samples.length;
  }

  /**
   * 自动测量 - 自动检测并测量所有可能的参数
   */
  public autoMeasure(channelIndex: number, startSample: number = 0, endSample?: number): {
    frequency?: FrequencyMeasurement;
    dutyCycle?: DutyCycleMeasurement;
    statistics?: StatisticalMeasurement;
    pulses?: PulseInfo[];
    edges?: EdgeMeasurement[];
    dominantFrequencies?: { frequency: number; magnitude: number }[];
  } {
    const results: any = {};

    try {
      // 频率测量
      results.frequency = this.measureFrequency(channelIndex, startSample, endSample);

      // 占空比测量
      results.dutyCycle = this.measureDutyCycle(channelIndex, startSample, endSample);

      // 统计测量
      results.statistics = this.measureStatistics(channelIndex, startSample, endSample);

      // 脉冲检测
      results.pulses = this.detectPulses(channelIndex, startSample, endSample);

      // 边沿检测
      results.edges = this.detectEdges(channelIndex, startSample, endSample);

      // 频谱分析
      const spectrum = this.analyzeFrequencySpectrum(channelIndex, startSample, endSample);
      results.dominantFrequencies = spectrum.slice(0, 5); // 前5个主要频率

    } catch (error) {
      console.error('Auto measurement error:', error);
    }

    return results;
  }

  /**
   * 格式化时间值 - 自动选择合适的单位
   */
  public formatTime(seconds: number): string {
    if (seconds >= 1) {
      return `${seconds.toFixed(3)}s`;
    } else if (seconds >= 0.001) {
      return `${(seconds * 1000).toFixed(3)}ms`;
    } else if (seconds >= 0.000001) {
      return `${(seconds * 1000000).toFixed(3)}μs`;
    } else {
      return `${(seconds * 1000000000).toFixed(3)}ns`;
    }
  }

  /**
   * 格式化频率值 - 自动选择合适的单位
   */
  public formatFrequency(hz: number): string {
    if (hz >= 1000000000) {
      return `${(hz / 1000000000).toFixed(3)}GHz`;
    } else if (hz >= 1000000) {
      return `${(hz / 1000000).toFixed(3)}MHz`;
    } else if (hz >= 1000) {
      return `${(hz / 1000).toFixed(3)}kHz`;
    }
    return `${hz.toFixed(3)}Hz`;
  }

  /**
   * 导出测量结果 - 将测量结果导出为JSON格式
   */
  public exportMeasurements(measurements: any[]): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      sampleRate: this.sampleRate,
      config: this.config,
      measurements,
      version: '1.0.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<MeasurementConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  public getConfig(): MeasurementConfig {
    return { ...this.config };
  }
}
