/**
 * 脉冲/时序分析工具
 * 提供高级脉冲分析、时序关系分析、协议时序验证等功能
 * 基于原版逻辑分析器的高级分析能力
 */
import { AnalyzerChannel, CaptureSession } from '../models/AnalyzerTypes';

// 脉冲事件类型
export interface PulseEvent {
  type: 'rising' | 'falling' | 'high' | 'low' | 'pulse' | 'glitch';
  startTime: number;    // 开始时间 (秒)
  endTime: number;      // 结束时间 (秒)
  duration: number;     // 持续时间 (秒)
  startSample: number;  // 开始样本索引
  endSample: number;    // 结束样本索引
  amplitude: number;    // 幅度 (0-1)
  channel: number;      // 通道号
}

// 时序关系类型
export interface TimingRelation {
  type: 'setup' | 'hold' | 'clock_to_output' | 'pulse_width' | 'period' | 'duty_cycle' | 'skew';
  source: PulseEvent;
  target?: PulseEvent;
  measured: number;     // 测量值 (秒)
  specification?: number; // 规格值 (秒)
  margin: number;       // 余量 (秒)
  passed: boolean;      // 是否通过
  description: string;
}

// 协议时序模板
export interface ProtocolTimingTemplate {
  name: string;         // 协议名称 (如 'I2C', 'SPI', 'UART')
  requirements: TimingRequirement[];
  clockChannel?: number;
  dataChannels: number[];
}

export interface TimingRequirement {
  name: string;
  type: 'setup' | 'hold' | 'clock_period' | 'pulse_width' | 'rise_time' | 'fall_time';
  minValue?: number;    // 最小值 (秒)
  maxValue?: number;    // 最大值 (秒)
  typicalValue?: number; // 典型值 (秒)
  description: string;
}

// 脉冲特征分析结果
export interface PulseCharacteristics {
  riseTime: number;     // 上升时间 (秒)
  fallTime: number;     // 下降时间 (秒)
  overshoot: number;    // 过冲 (%)
  undershoot: number;   // 下冲 (%)
  ringing: number;      // 振铃频率 (Hz)
  jitter: number;       // 抖动 (秒)
  skew: number;         // 偏移 (秒)
}

// 时序分析结果
export interface TimingAnalysisResult {
  timestamp: string;
  sampleRate: number;
  analyzedChannels: number[];
  pulseEvents: PulseEvent[];
  timingRelations: TimingRelation[];
  protocolCompliance?: ProtocolComplianceResult;
  eyeDiagram?: EyeDiagramData;
  statisticalSummary: TimingStatistics;
}

export interface ProtocolComplianceResult {
  protocol: string;
  overallPassed: boolean;
  passRate: number;     // 通过率 (%)
  violations: TimingViolation[];
  recommendations: string[];
}

export interface TimingViolation {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  location: { startSample: number; endSample: number; channel: number };
  measured: number;
  required: number;
  margin: number;
}

export interface EyeDiagramData {
  width: number;
  height: number;
  data: number[][];     // 2D数组表示眼图
  eyeOpening: number;   // 眼图开度 (%)
  crossingPoints: { time: number; voltage: number }[];
}

export interface TimingStatistics {
  totalPulses: number;
  averagePulseWidth: number;
  pulseWidthVariation: number;
  averagePeriod: number;
  periodJitter: number;
  clockSkew: Map<number, number>; // 通道间时钟偏移
  signalIntegrity: SignalIntegrityMetrics;
}

export interface SignalIntegrityMetrics {
  averageRiseTime: number;
  averageFallTime: number;
  edgeRate: number;       // 边沿速率 (V/s)
  noiseMargin: number;    // 噪声容限 (V)
  powerConsumption: number; // 功耗估算 (mW)
}

export class PulseTimingAnalyzer {

  /**
   * 执行完整的脉冲时序分析
   */
  async analyzeTiming(
    channels: AnalyzerChannel[],
    sampleRate: number,
    options?: {
      protocolTemplate?: ProtocolTimingTemplate;
      generateEyeDiagram?: boolean;
      detectionThreshold?: number;
      glitchThreshold?: number; // ns
    }
  ): Promise<TimingAnalysisResult> {
    const startTime = Date.now();

    // 检测所有脉冲事件
    const pulseEvents = await this.detectPulseEvents(channels, sampleRate, options);

    // 分析时序关系
    const timingRelations = await this.analyzeTimingRelations(pulseEvents, sampleRate);

    // 协议合规性检查
    let protocolCompliance: ProtocolComplianceResult | undefined;
    if (options?.protocolTemplate) {
      protocolCompliance = await this.checkProtocolCompliance(
        pulseEvents,
        timingRelations,
        options.protocolTemplate
      );
    }

    // 生成眼图
    let eyeDiagram: EyeDiagramData | undefined;
    if (options?.generateEyeDiagram) {
      eyeDiagram = await this.generateEyeDiagram(channels, sampleRate);
    }

    // 统计分析
    const statisticalSummary = await this.generateTimingStatistics(
      pulseEvents,
      timingRelations,
      channels,
      sampleRate
    );

    return {
      timestamp: new Date().toISOString(),
      sampleRate,
      analyzedChannels: channels.map(ch => ch.channelNumber),
      pulseEvents,
      timingRelations,
      protocolCompliance,
      eyeDiagram,
      statisticalSummary
    };
  }

  /**
   * 检测脉冲事件
   */
  private async detectPulseEvents(
    channels: AnalyzerChannel[],
    sampleRate: number,
    options?: any
  ): Promise<PulseEvent[]> {
    const events: PulseEvent[] = [];
    const glitchThresholdSamples = options?.glitchThreshold ?
      Math.max(1, Math.floor((options.glitchThreshold * 1e-9) * sampleRate)) :
      Math.max(1, Math.floor(sampleRate / 1000000)); // 默认1μs

    for (const channel of channels) {
      if (!channel.samples || channel.hidden) continue;

      const { samples } = channel;
      let currentState = -1;
      let stateStartSample = 0;
      let stateStartTime = 0;

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        const currentTime = i / sampleRate;

        if (sample !== currentState) {
          // 状态转换
          if (currentState !== -1) {
            const duration = currentTime - stateStartTime;
            const sampleDuration = i - stateStartSample;

            // 检测脉冲类型
            if (sampleDuration < glitchThresholdSamples) {
              // 毛刺
              events.push({
                type: 'glitch',
                startTime: stateStartTime,
                endTime: currentTime,
                duration,
                startSample: stateStartSample,
                endSample: i,
                amplitude: currentState,
                channel: channel.channelNumber
              });
            } else {
              // 正常脉冲
              events.push({
                type: currentState === 1 ? 'high' : 'low',
                startTime: stateStartTime,
                endTime: currentTime,
                duration,
                startSample: stateStartSample,
                endSample: i,
                amplitude: currentState,
                channel: channel.channelNumber
              });
            }
          }

          // 边沿事件
          if (currentState !== -1) {
            events.push({
              type: sample === 1 ? 'rising' : 'falling',
              startTime: currentTime,
              endTime: currentTime,
              duration: 0,
              startSample: i,
              endSample: i,
              amplitude: sample,
              channel: channel.channelNumber
            });
          }

          currentState = sample;
          stateStartSample = i;
          stateStartTime = currentTime;
        }
      }

      // 处理最后一个状态
      if (currentState !== -1) {
        const duration = (samples.length - 1) / sampleRate - stateStartTime;
        events.push({
          type: currentState === 1 ? 'high' : 'low',
          startTime: stateStartTime,
          endTime: (samples.length - 1) / sampleRate,
          duration,
          startSample: stateStartSample,
          endSample: samples.length - 1,
          amplitude: currentState,
          channel: channel.channelNumber
        });
      }
    }

    // 按时间排序
    return events.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * 分析时序关系
   */
  private async analyzeTimingRelations(
    events: PulseEvent[],
    sampleRate: number
  ): Promise<TimingRelation[]> {
    const relations: TimingRelation[] = [];

    // 分析建立时间和保持时间
    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];

      // 跨通道时序关系
      if (currentEvent.channel !== nextEvent.channel) {
        // 时钟到数据的建立时间
        if (currentEvent.type === 'rising' &&
            (nextEvent.type === 'high' || nextEvent.type === 'low')) {
          const setupTime = nextEvent.startTime - currentEvent.startTime;

          relations.push({
            type: 'setup',
            source: currentEvent,
            target: nextEvent,
            measured: setupTime,
            margin: setupTime,
            passed: setupTime > 0,
            description: `CH${currentEvent.channel} to CH${nextEvent.channel} setup time`
          });
        }

        // 保持时间
        if (nextEvent.type === 'rising' &&
            (currentEvent.type === 'high' || currentEvent.type === 'low')) {
          const holdTime = nextEvent.startTime - currentEvent.endTime;

          relations.push({
            type: 'hold',
            source: currentEvent,
            target: nextEvent,
            measured: holdTime,
            margin: holdTime,
            passed: holdTime > 0,
            description: `CH${currentEvent.channel} to CH${nextEvent.channel} hold time`
          });
        }

        // 时钟偏移
        if (currentEvent.type === 'rising' && nextEvent.type === 'rising') {
          const skew = Math.abs(nextEvent.startTime - currentEvent.startTime);

          relations.push({
            type: 'skew',
            source: currentEvent,
            target: nextEvent,
            measured: skew,
            margin: skew,
            passed: skew < 1e-9, // 小于1ns认为是好的
            description: `Clock skew between CH${currentEvent.channel} and CH${nextEvent.channel}`
          });
        }
      }

      // 同通道脉冲宽度和周期
      if (currentEvent.channel === nextEvent.channel) {
        if (currentEvent.type === 'high' || currentEvent.type === 'low') {
          relations.push({
            type: 'pulse_width',
            source: currentEvent,
            measured: currentEvent.duration,
            margin: currentEvent.duration,
            passed: currentEvent.duration > 1e-9, // 大于1ns
            description: `CH${currentEvent.channel} ${currentEvent.type} pulse width`
          });
        }

        // 周期测量
        if (currentEvent.type === 'rising' && nextEvent.type === 'rising') {
          const period = nextEvent.startTime - currentEvent.startTime;

          relations.push({
            type: 'period',
            source: currentEvent,
            target: nextEvent,
            measured: period,
            margin: period,
            passed: period > 0,
            description: `CH${currentEvent.channel} clock period`
          });
        }
      }
    }

    return relations;
  }

  /**
   * 检查协议合规性
   */
  private async checkProtocolCompliance(
    events: PulseEvent[],
    relations: TimingRelation[],
    template: ProtocolTimingTemplate
  ): Promise<ProtocolComplianceResult> {
    const violations: TimingViolation[] = [];
    const recommendations: string[] = [];
    let passedChecks = 0;
    let totalChecks = 0;

    for (const requirement of template.requirements) {
      totalChecks++;

      // 查找相关的时序关系
      const relevantRelations = relations.filter(r =>
        r.type === requirement.type ||
        (requirement.type === 'clock_period' && r.type === 'period')
      );

      for (const relation of relevantRelations) {
        const { measured } = relation;
        let passed = true;
        let margin = 0;

        // 检查最小值约束
        if (requirement.minValue !== undefined) {
          if (measured < requirement.minValue) {
            passed = false;
            margin = requirement.minValue - measured;

            violations.push({
              type: requirement.name,
              severity: 'critical',
              description: `${requirement.description} violation: measured ${(measured * 1e9).toFixed(2)}ns < required ${(requirement.minValue * 1e9).toFixed(2)}ns`,
              location: {
                startSample: relation.source.startSample,
                endSample: relation.target?.endSample || relation.source.endSample,
                channel: relation.source.channel
              },
              measured,
              required: requirement.minValue,
              margin: -margin
            });
          } else {
            margin = measured - requirement.minValue;
          }
        }

        // 检查最大值约束
        if (requirement.maxValue !== undefined) {
          if (measured > requirement.maxValue) {
            passed = false;
            margin = measured - requirement.maxValue;

            violations.push({
              type: requirement.name,
              severity: 'critical',
              description: `${requirement.description} violation: measured ${(measured * 1e9).toFixed(2)}ns > required ${(requirement.maxValue * 1e9).toFixed(2)}ns`,
              location: {
                startSample: relation.source.startSample,
                endSample: relation.target?.endSample || relation.source.endSample,
                channel: relation.source.channel
              },
              measured,
              required: requirement.maxValue,
              margin
            });
          }
        }

        if (passed) {
          passedChecks++;
        }
      }
    }

    // 生成建议
    if (violations.length > 0) {
      recommendations.push('检查信号完整性和PCB布线');
      recommendations.push('验证时钟质量和电源稳定性');

      const setupViolations = violations.filter(v => v.type.includes('setup'));
      const holdViolations = violations.filter(v => v.type.includes('hold'));

      if (setupViolations.length > 0) {
        recommendations.push('增加建立时间余量，考虑降低时钟频率');
      }
      if (holdViolations.length > 0) {
        recommendations.push('检查保持时间约束，可能需要添加延迟');
      }
    }

    const passRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100;

    return {
      protocol: template.name,
      overallPassed: violations.length === 0,
      passRate,
      violations,
      recommendations
    };
  }

  /**
   * 生成眼图数据
   */
  private async generateEyeDiagram(
    channels: AnalyzerChannel[],
    sampleRate: number
  ): Promise<EyeDiagramData> {
    // 简化的眼图生成
    const width = 100;
    const height = 100;
    const data: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));

    // 寻找时钟通道
    const clockChannel = channels.find(ch =>
      ch.channelName.toLowerCase().includes('clk') ||
      ch.channelName.toLowerCase().includes('clock')
    );

    if (!clockChannel || !clockChannel.samples) {
      return {
        width,
        height,
        data,
        eyeOpening: 0,
        crossingPoints: []
      };
    }

    // 检测时钟边沿
    const clockEdges: number[] = [];
    const { samples } = clockChannel;

    for (let i = 1; i < samples.length; i++) {
      if (samples[i] === 1 && samples[i - 1] === 0) {
        clockEdges.push(i);
      }
    }

    // 估计时钟周期
    if (clockEdges.length < 2) {
      return {
        width,
        height,
        data,
        eyeOpening: 0,
        crossingPoints: []
      };
    }

    const averagePeriod = clockEdges.length > 1 ?
      (clockEdges[clockEdges.length - 1] - clockEdges[0]) / (clockEdges.length - 1) :
      100;

    // 对于每个数据通道，叠加到眼图中
    for (const channel of channels) {
      if (channel === clockChannel || !channel.samples || channel.hidden) continue;

      for (let edgeIndex = 0; edgeIndex < clockEdges.length - 1; edgeIndex++) {
        const startSample = clockEdges[edgeIndex];
        const endSample = Math.min(startSample + averagePeriod, channel.samples.length);

        // 将这个周期的数据映射到眼图
        for (let i = startSample; i < endSample; i++) {
          const x = Math.floor(((i - startSample) / averagePeriod) * width);
          const y = channel.samples[i] === 1 ? height - 1 : 0;

          if (x >= 0 && x < width && y >= 0 && y < height) {
            data[y][x]++;
          }
        }
      }
    }

    // 计算眼图开度
    const eyeOpening = this.calculateEyeOpening(data);

    return {
      width,
      height,
      data,
      eyeOpening,
      crossingPoints: [] // 简化实现
    };
  }

  /**
   * 计算眼图开度
   */
  private calculateEyeOpening(data: number[][]): number {
    const height = data.length;
    const width = data[0].length;

    // 简化的眼图开度计算
    let maxOpening = 0;

    for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
      let highestLow = 0;
      let lowestHigh = height - 1;

      // 寻找在这个时间点的最高低电平和最低高电平
      for (let y = 0; y < Math.floor(height / 2); y++) {
        if (data[y][x] > 0) {
          highestLow = Math.max(highestLow, y);
        }
      }

      for (let y = Math.floor(height / 2); y < height; y++) {
        if (data[y][x] > 0) {
          lowestHigh = Math.min(lowestHigh, y);
        }
      }

      const opening = lowestHigh - highestLow;
      maxOpening = Math.max(maxOpening, opening);
    }

    return (maxOpening / height) * 100;
  }

  /**
   * 生成时序统计信息
   */
  private async generateTimingStatistics(
    events: PulseEvent[],
    relations: TimingRelation[],
    channels: AnalyzerChannel[],
    sampleRate: number
  ): Promise<TimingStatistics> {
    // 脉冲统计
    const pulseEvents = events.filter(e => e.type === 'high' || e.type === 'low');
    const totalPulses = pulseEvents.length;

    const pulseWidths = pulseEvents.map(e => e.duration);
    const averagePulseWidth = pulseWidths.length > 0 ?
      pulseWidths.reduce((sum, w) => sum + w, 0) / pulseWidths.length : 0;

    const pulseWidthVariance = pulseWidths.length > 1 ?
      Math.sqrt(pulseWidths.reduce((sum, w) => sum + Math.pow(w - averagePulseWidth, 2), 0) / pulseWidths.length) : 0;

    // 周期统计
    const periodRelations = relations.filter(r => r.type === 'period');
    const periods = periodRelations.map(r => r.measured);
    const averagePeriod = periods.length > 0 ?
      periods.reduce((sum, p) => sum + p, 0) / periods.length : 0;

    const periodJitter = periods.length > 1 ?
      Math.sqrt(periods.reduce((sum, p) => sum + Math.pow(p - averagePeriod, 2), 0) / periods.length) : 0;

    // 时钟偏移统计
    const clockSkew = new Map<number, number>();
    const skewRelations = relations.filter(r => r.type === 'skew');
    for (const relation of skewRelations) {
      const channel = relation.target?.channel || relation.source.channel;
      clockSkew.set(channel, relation.measured);
    }

    // 信号完整性指标
    const signalIntegrity = await this.calculateSignalIntegrityMetrics(events, channels, sampleRate);

    return {
      totalPulses,
      averagePulseWidth,
      pulseWidthVariation: pulseWidthVariance,
      averagePeriod,
      periodJitter,
      clockSkew,
      signalIntegrity
    };
  }

  /**
   * 计算信号完整性指标
   */
  private async calculateSignalIntegrityMetrics(
    events: PulseEvent[],
    channels: AnalyzerChannel[],
    sampleRate: number
  ): Promise<SignalIntegrityMetrics> {
    // 简化的信号完整性计算
    const risingEdges = events.filter(e => e.type === 'rising');
    const fallingEdges = events.filter(e => e.type === 'falling');

    // 假设边沿时间为一个采样周期（简化）
    const samplePeriod = 1 / sampleRate;
    const averageRiseTime = samplePeriod;
    const averageFallTime = samplePeriod;

    // 边沿速率估算 (V/s)
    const assumedVoltageSwing = 3.3; // 假设3.3V摆幅
    const edgeRate = assumedVoltageSwing / averageRiseTime;

    // 噪声容限估算
    const noiseMargin = assumedVoltageSwing * 0.1; // 假设10%噪声容限

    // 功耗估算 (非常简化)
    const totalTransitions = risingEdges.length + fallingEdges.length;
    const averageFrequency = totalTransitions > 0 ?
      totalTransitions / (events[events.length - 1]?.endTime || 1) : 0;
    const powerConsumption = averageFrequency * 0.001; // 假设每Hz消耗1μW

    return {
      averageRiseTime,
      averageFallTime,
      edgeRate,
      noiseMargin,
      powerConsumption
    };
  }

  /**
   * 获取预定义的协议时序模板
   */
  getProtocolTemplate(protocolName: string): ProtocolTimingTemplate | null {
    const templates: { [key: string]: ProtocolTimingTemplate } = {
      'I2C': {
        name: 'I2C',
        requirements: [
          {
            name: 'setup_start',
            type: 'setup',
            minValue: 4.7e-6, // 4.7μs for standard mode
            description: 'Setup time for START condition'
          },
          {
            name: 'hold_start',
            type: 'hold',
            minValue: 4.0e-6, // 4.0μs for standard mode
            description: 'Hold time for START condition'
          },
          {
            name: 'setup_data',
            type: 'setup',
            minValue: 250e-9, // 250ns for standard mode
            description: 'Data setup time'
          },
          {
            name: 'hold_data',
            type: 'hold',
            minValue: 0, // 0ns for standard mode
            description: 'Data hold time'
          }
        ],
        clockChannel: 0, // SCL
        dataChannels: [1] // SDA
      },

      'SPI': {
        name: 'SPI',
        requirements: [
          {
            name: 'setup_data',
            type: 'setup',
            minValue: 10e-9, // 10ns typical
            description: 'Data setup time before clock edge'
          },
          {
            name: 'hold_data',
            type: 'hold',
            minValue: 5e-9, // 5ns typical
            description: 'Data hold time after clock edge'
          },
          {
            name: 'clock_period',
            type: 'clock_period',
            minValue: 100e-9, // 10MHz max for many devices
            description: 'Minimum clock period'
          }
        ],
        clockChannel: 0, // SCLK
        dataChannels: [1, 2] // MOSI, MISO
      },

      'UART': {
        name: 'UART',
        requirements: [
          {
            name: 'bit_period',
            type: 'pulse_width',
            minValue: 104.17e-6, // 9600 baud
            maxValue: 104.17e-6,
            typicalValue: 104.17e-6,
            description: 'Bit period for 9600 baud'
          },
          {
            name: 'start_bit',
            type: 'pulse_width',
            minValue: 104.17e-6,
            maxValue: 104.17e-6,
            description: 'Start bit duration'
          }
        ],
        dataChannels: [0, 1] // TX, RX
      }
    };

    return templates[protocolName] || null;
  }
}

// 导出单例实例
export const pulseTimingAnalyzer = new PulseTimingAnalyzer();
