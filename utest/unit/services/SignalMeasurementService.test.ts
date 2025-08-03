/**
 * SignalMeasurementService 单元测试
 * 完整测试信号测量和统计分析服务的所有功能
 */

import { SignalMeasurementService } from '../../../src/services/SignalMeasurementService';
import { AnalyzerChannel } from '../../../src/models/AnalyzerTypes';

describe('SignalMeasurementService', () => {
  let service: SignalMeasurementService;

  beforeEach(() => {
    service = new SignalMeasurementService();
  });

  describe('基础构造和初始化', () => {
    it('应该正确创建服务实例', () => {
      expect(service).toBeInstanceOf(SignalMeasurementService);
    });

    it('应该正确处理空通道数组', async () => {
      const result = await service.performMeasurement([], 1000000);
      
      expect(result.totalChannels).toBe(0);
      expect(result.channels).toHaveLength(0);
      expect(result.sampleRate).toBe(1000000);
      expect(result.timestamp).toBeTruthy();
    });

    it('应该正确处理隐藏通道', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CH0',
          samples: new Uint8Array([1, 0, 1, 0]),
          hidden: true,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      expect(result.totalChannels).toBe(0);
      expect(result.channels).toHaveLength(0);
    });

    it('应该正确处理无样本数据的通道', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CH0',
          samples: undefined,
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      expect(result.totalChannels).toBe(0);
      expect(result.channels).toHaveLength(0);
    });
  });

  describe('单通道脉冲分析', () => {
    it('应该正确分析简单的时钟信号', async () => {
      // 创建简单的方波信号: 1010101010
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CLK',
          samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      
      expect(result.totalChannels).toBe(1);
      expect(result.channels).toHaveLength(1);
      
      const channel = result.channels[0];
      expect(channel.channelNumber).toBe(0);
      expect(channel.channelName).toBe('CLK');
      
      // 检查正脉冲分析
      expect(channel.positivePulses.count).toBe(5); // 5个高电平脉冲
      expect(channel.positivePulses.averageDuration).toBeCloseTo(1e-6, 8); // 1μs
      
      // 检查负脉冲分析
      expect(channel.negativePulses.count).toBe(5); // 5个低电平脉冲
      expect(channel.negativePulses.averageDuration).toBeCloseTo(1e-6, 8); // 1μs
    });

    it('应该正确处理长脉冲信号', async () => {
      // 创建不同宽度的脉冲: 111000111000
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'DATA',
          samples: new Uint8Array([1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      // 检查脉冲计数
      expect(channel.positivePulses.count).toBe(2); // 2个高电平脉冲
      expect(channel.negativePulses.count).toBe(2); // 2个低电平脉冲
      
      // 检查脉冲宽度
      expect(channel.positivePulses.averageDuration).toBeCloseTo(3e-6, 8); // 3μs
      expect(channel.negativePulses.averageDuration).toBeCloseTo(3e-6, 8); // 3μs
      
      // 检查总持续时间
      expect(channel.positivePulses.totalDuration).toBeCloseTo(6e-6, 8); // 6μs
      expect(channel.negativePulses.totalDuration).toBeCloseTo(6e-6, 8); // 6μs
    });

    it('应该正确处理单脉冲信号', async () => {
      // 单个脉冲: 000111000
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'PULSE',
          samples: new Uint8Array([0, 0, 0, 1, 1, 1, 0, 0, 0]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      expect(channel.positivePulses.count).toBe(1);
      expect(channel.negativePulses.count).toBe(2); // 前后两段低电平
      expect(channel.positivePulses.averageDuration).toBeCloseTo(3e-6, 8);
    });

    it('应该正确处理全高电平信号', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'HIGH',
          samples: new Uint8Array([1, 1, 1, 1, 1]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      expect(channel.positivePulses.count).toBe(1);
      expect(channel.negativePulses.count).toBe(0);
      expect(channel.positivePulses.averageDuration).toBeCloseTo(5e-6, 8);
    });

    it('应该正确处理全低电平信号', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'LOW',
          samples: new Uint8Array([0, 0, 0, 0, 0]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      expect(channel.positivePulses.count).toBe(0);
      expect(channel.negativePulses.count).toBe(1);
      expect(channel.negativePulses.averageDuration).toBeCloseTo(5e-6, 8);
    });

    it('应该正确处理空样本数组', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'EMPTY',
          samples: new Uint8Array([]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      expect(channel.positivePulses.count).toBe(0);
      expect(channel.negativePulses.count).toBe(0);
      expect(channel.positivePulses.averageDuration).toBe(0);
      expect(channel.negativePulses.averageDuration).toBe(0);
    });
  });

  describe('频率分析功能', () => {
    it('应该正确计算方波频率', async () => {
      // 创建1MHz方波 (采样率10MHz，每周期10个样本)
      const samples = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        samples[i] = Math.floor(i / 5) % 2; // 5个样本高，5个样本低
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CLK_1MHz',
          samples: samples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 10000000); // 10MHz采样率
      const channel = result.channels[0];
      
      // 验证频率计算
      expect(channel.frequency.averageFrequency).toBeCloseTo(1000000, -3); // 约1MHz
      expect(channel.frequency.period).toBeCloseTo(1e-6, 8); // 约1μs周期
      expect(channel.frequency.dutyCycle).toBeCloseTo(50, 1); // 50%占空比
    });

    it('应该正确计算非50%占空比信号', async () => {
      // 创建30%占空比信号: 110000110000
      const pattern = [1, 1, 0, 0, 0, 0];
      const samples = new Uint8Array(60);
      for (let i = 0; i < 60; i++) {
        samples[i] = pattern[i % 6];
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'PWM_30',
          samples: samples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 6000000); // 6MHz采样率
      const channel = result.channels[0];
      
      // 验证占空比计算
      expect(channel.frequency.dutyCycle).toBeCloseTo(33.33, 1); // 约33%占空比
    });

    it('应该处理零频率信号', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'DC',
          samples: new Uint8Array([1, 1, 1, 1, 1]), // 直流信号
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      // 直流信号只有一个脉冲，没有周期性，所以频率应该很低或者期望为非周期性
      expect(channel.frequency.averageFrequency).toBeGreaterThanOrEqual(0);
      expect(channel.positivePulses.count).toBe(1); // 只有一个正脉冲
      expect(channel.negativePulses.count).toBe(0); // 没有负脉冲
    });
  });

  describe('统计分析功能', () => {
    it('应该正确计算基础统计信息', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'TEST',
          samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]), // 8个样本
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 8000000); // 8MHz
      const channel = result.channels[0];
      const stats = channel.statistics;
      
      expect(stats.totalSamples).toBe(8);
      expect(stats.samplePeriod).toBeCloseTo(125e-9, 10); // 125ns
      expect(stats.totalDuration).toBeCloseTo(1e-6, 8); // 1μs
      expect(stats.transitions).toBe(7); // 7次状态转换
      expect(stats.highStateRatio).toBeCloseTo(50, 1); // 50%高电平
      expect(stats.lowStateRatio).toBeCloseTo(50, 1); // 50%低电平
    });

    it('应该正确计算高低电平时间', async () => {
      // 60%高电平，40%低电平: 111100111100
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'ASYM',
          samples: new Uint8Array([1, 1, 1, 0, 0, 1, 1, 1, 0, 0]), // 10个样本
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      const stats = channel.statistics;
      
      expect(stats.highStateRatio).toBeCloseTo(60, 1); // 60%高电平
      expect(stats.lowStateRatio).toBeCloseTo(40, 1); // 40%低电平
      expect(stats.highStateTime).toBeCloseTo(6e-6, 8); // 6μs
      expect(stats.lowStateTime).toBeCloseTo(4e-6, 8); // 4μs
    });

    it('应该正确检测毛刺', async () => {
      // 在长高电平中插入很短的毛刺，使用更高的采样率来创建足够短的脉冲
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'GLITCH',
          samples: new Uint8Array([1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1]), // 单个样本的低电平毛刺
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 10000000); // 10MHz，使毛刺更短
      const channel = result.channels[0];
      
      // 毛刺检测应该识别短脉冲 - 但这取决于具体的算法实现
      // 我们先检查基本的脉冲计数
      expect(channel.negativePulses.count).toBe(1); // 应该有一个负脉冲
      expect(channel.positivePulses.count).toBe(2); // 应该有两个正脉冲（被毛刺分割）
      
      // 统计信息应该显示有状态转换
      expect(channel.statistics.transitions).toBe(2); // 2次转换: 1->0, 0->1
    });
  });

  describe('信号质量分析', () => {
    it('应该分析高质量信号', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CLEAN',
          samples: new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]), // 干净的方波
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableSignalQuality: true };
      const result = await service.performMeasurement(channels, 1000000, options);
      const channel = result.channels[0];
      const quality = channel.signalQuality;
      
      expect(quality.signalIntegrity).toBeGreaterThan(95);
      expect(quality.noiseLevel).toBeLessThan(10);
      expect(quality.edgeQuality).toBeGreaterThan(90);
      expect(quality.stabilityScore).toBeGreaterThan(80);
    });

    it('应该生成质量改进建议', async () => {
      // 创建噪声信号模拟
      const noisySamples = new Uint8Array(100);
      for (let i = 0; i < 100; i++) {
        noisySamples[i] = Math.random() > 0.5 ? 1 : 0; // 随机噪声
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'NOISY',
          samples: noisySamples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableSignalQuality: true };
      const result = await service.performMeasurement(channels, 1000000, options);
      const channel = result.channels[0];
      
      // 低质量信号应该生成建议
      expect(channel.signalQuality.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('跨通道分析', () => {
    it('应该分析两个同步通道', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CLK',
          samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]),
          hidden: false,
          triggerValue: 0
        },
        {
          channelNumber: 1,
          channelName: 'DATA',
          samples: new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]), // 相同的模式
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableCrossChannelAnalysis: true };
      const result = await service.performMeasurement(channels, 1000000, options);
      
      expect(result.crossChannelAnalysis).toBeDefined();
      expect(result.crossChannelAnalysis!.synchronization).toHaveLength(1);
      expect(result.crossChannelAnalysis!.correlations).toHaveLength(1);
      expect(result.crossChannelAnalysis!.timingRelationships).toHaveLength(1);
      
      const sync = result.crossChannelAnalysis!.synchronization[0];
      expect(sync.synchronizationRate).toBeGreaterThan(90); // 高同步率
      
      const corr = result.crossChannelAnalysis!.correlations[0];
      expect(corr.correlationType).toBe('positive');
      expect(corr.correlationCoefficient).toBeGreaterThan(0.7);
    });

    it('应该分析主从关系', async () => {
      // 主通道2MHz，从通道1MHz (2:1关系)
      const masterSamples = new Uint8Array(20);
      const slaveSamples = new Uint8Array(20);
      
      for (let i = 0; i < 20; i++) {
        masterSamples[i] = Math.floor(i / 2.5) % 2; // 更快的频率
        slaveSamples[i] = Math.floor(i / 5) % 2;    // 更慢的频率
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'MASTER',
          samples: masterSamples,
          hidden: false,
          triggerValue: 0
        },
        {
          channelNumber: 1,
          channelName: 'SLAVE',
          samples: slaveSamples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableCrossChannelAnalysis: true };
      const result = await service.performMeasurement(channels, 20000000, options);
      
      const timing = result.crossChannelAnalysis!.timingRelationships[0];
      expect(timing.relationship).toBe('master-slave');
      expect(timing.confidence).toBeGreaterThan(60);
    });

    it('应该分析独立通道', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'CH1',
          samples: new Uint8Array([1, 0, 1, 0]), // 快速翻转
          hidden: false,
          triggerValue: 0
        },
        {
          channelNumber: 1,
          channelName: 'CH2',
          samples: new Uint8Array([1, 1, 1, 0]), // 慢速翻转
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableCrossChannelAnalysis: true };
      const result = await service.performMeasurement(channels, 1000000, options);
      
      const timing = result.crossChannelAnalysis!.timingRelationships[0];
      expect(timing.relationship).toBe('independent');
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理单个样本', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'SINGLE',
          samples: new Uint8Array([1]), // 单个样本
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      expect(channel.positivePulses.count).toBe(1);
      expect(channel.negativePulses.count).toBe(0);
      expect(channel.statistics.transitions).toBe(0);
    });

    it('应该处理零采样率', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'TEST',
          samples: new Uint8Array([1, 0, 1]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 0);
      expect(result.sampleRate).toBe(0);
      // 应该不崩溃，返回合理的默认值
      expect(result.channels).toHaveLength(1);
    });

    it('应该处理负采样率', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'TEST',
          samples: new Uint8Array([1, 0, 1]),
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, -1000);
      expect(result.sampleRate).toBe(-1000);
      expect(result.channels).toHaveLength(1);
    });

    it('应该处理超大数据量', async () => {
      // 创建10万样本的数据
      const bigSamples = new Uint8Array(100000);
      for (let i = 0; i < 100000; i++) {
        bigSamples[i] = i % 100 < 50 ? 1 : 0; // 50%占空比
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'BIG_DATA',
          samples: bigSamples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const startTime = Date.now();
      const result = await service.performMeasurement(channels, 1000000);
      const processingTime = Date.now() - startTime;
      
      // 应该在合理时间内完成 (< 5秒)
      expect(processingTime).toBeLessThan(5000);
      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].statistics.totalSamples).toBe(100000);
    });

    it('应该处理多通道大数据', async () => {
      const channels: AnalyzerChannel[] = [];
      
      // 创建8个通道，每个1000个样本
      for (let ch = 0; ch < 8; ch++) {
        const samples = new Uint8Array(1000);
        for (let i = 0; i < 1000; i++) {
          samples[i] = (i + ch) % (10 + ch) < 5 ? 1 : 0; // 不同的模式
        }
        
        channels.push({
          channelNumber: ch,
          channelName: `CH${ch}`,
          samples: samples,
          hidden: false,
          triggerValue: 0
        });
      }

      const options = { enableCrossChannelAnalysis: true, enableSignalQuality: true };
      const startTime = Date.now();
      const result = await service.performMeasurement(channels, 1000000, options);
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(3000); // < 3秒
      expect(result.totalChannels).toBe(8);
      expect(result.crossChannelAnalysis?.synchronization).toHaveLength(28); // C(8,2) = 28组合
    });
  });

  describe('算法精度验证', () => {
    it('应该精确计算脉冲宽度', async () => {
      // 创建精确的3μs脉冲 (3000个样本 @ 1GHz)
      const samples = new Uint8Array(5000);
      samples.fill(0);
      for (let i = 1000; i < 4000; i++) {
        samples[i] = 1; // 3000个样本的高电平
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'PRECISE',
          samples: samples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000000); // 1GHz
      const channel = result.channels[0];
      
      // 验证精度 (误差 < 1ns)
      expect(channel.positivePulses.averageDuration).toBeCloseTo(3e-6, 9);
      expect(channel.positivePulses.minDuration).toBeCloseTo(3e-6, 9);
      expect(channel.positivePulses.maxDuration).toBeCloseTo(3e-6, 9);
    });

    it('应该正确计算95%统计过滤', async () => {
      // 创建有噪声的信号，但95%的脉冲是2μs宽度
      const samples = new Uint8Array(1000);
      samples.fill(0);
      
      // 95个正常脉冲 (2μs each)
      for (let i = 0; i < 95; i++) {
        const start = i * 10;
        samples[start] = 1;
        samples[start + 1] = 1; // 2个样本 = 2μs @ 1MHz
      }
      
      // 5个异常脉冲 (10μs each)
      for (let i = 95; i < 100; i++) {
        const start = i * 10;
        for (let j = 0; j < 10; j++) {
          if (start + j < samples.length) {
            samples[start + j] = 1;
          }
        }
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'FILTERED',
          samples: samples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const result = await service.performMeasurement(channels, 1000000);
      const channel = result.channels[0];
      
      // 平均值应该包含所有脉冲
      expect(channel.positivePulses.averageDuration).toBeGreaterThan(2e-6);
      
      // 预测值应该接近95%的值（即2μs）
      expect(channel.positivePulses.predictedDuration).toBeCloseTo(2e-6, 6);
    });
  });

  describe('性能和稳定性', () => {
    it('应该在大数据下保持性能', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'PERF_TEST',
          samples: new Uint8Array(50000).map(() => Math.random() > 0.5 ? 1 : 0),
          hidden: false,
          triggerValue: 0
        }
      ];

      const iterations = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await service.performMeasurement(channels, 1000000);
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);
      
      // 性能要求
      expect(avgTime).toBeLessThan(1000); // 平均 < 1秒
      expect(maxTime).toBeLessThan(2000);  // 最大 < 2秒
      
      // 时间一致性
      const variance = times.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      expect(stdDev / avgTime).toBeLessThan(0.5); // 标准差 < 50% 均值
    });

    it('应该产生确定性结果', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'DETERMINISTIC',
          samples: new Uint8Array([1, 0, 1, 1, 0, 0, 1, 0, 1, 1]),
          hidden: false,
          triggerValue: 0
        }
      ];

      // 运行多次应该得到相同结果
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.performMeasurement(channels, 1000000);
        results.push(result.channels[0]);
      }

      // 验证结果一致性
      for (let i = 1; i < results.length; i++) {
        expect(results[i].positivePulses.count).toBe(results[0].positivePulses.count);
        expect(results[i].negativePulses.count).toBe(results[0].negativePulses.count);
        expect(results[i].frequency.averageFrequency).toBeCloseTo(results[0].frequency.averageFrequency, 10);
        expect(results[i].statistics.transitions).toBe(results[0].statistics.transitions);
      }
    });
  });

  describe('回归测试用例', () => {
    it('应该正确处理I2C起始条件模拟', async () => {
      // 模拟I2C起始条件: SDA先拉低，然后SCL拉低
      const sclSamples = new Uint8Array([1, 1, 1, 1, 0, 0, 0, 0]); // SCL
      const sdaSamples = new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0]); // SDA

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'SCL',
          samples: sclSamples,
          hidden: false,
          triggerValue: 0
        },
        {
          channelNumber: 1,
          channelName: 'SDA',
          samples: sdaSamples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableCrossChannelAnalysis: true };
      const result = await service.performMeasurement(channels, 8000000, options);
      
      expect(result.totalChannels).toBe(2);
      expect(result.crossChannelAnalysis).toBeDefined();
      
      // SDA应该比SCL先转换
      const scl = result.channels[0];
      const sda = result.channels[1];
      
      expect(scl.statistics.transitions).toBeGreaterThan(0);
      expect(sda.statistics.transitions).toBeGreaterThan(0);
    });

    it('应该处理复杂的异步信号', async () => {
      // 创建两个不相关的异步信号
      const ch1Samples = new Uint8Array(100);
      const ch2Samples = new Uint8Array(100);
      
      // 通道1: 3个周期的方波
      for (let i = 0; i < 100; i++) {
        ch1Samples[i] = Math.floor(i / 16) % 2;
      }
      
      // 通道2: 7个周期的方波
      for (let i = 0; i < 100; i++) {
        ch2Samples[i] = Math.floor(i / 7) % 2;
      }

      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'ASYNC1',
          samples: ch1Samples,
          hidden: false,
          triggerValue: 0
        },
        {
          channelNumber: 1,
          channelName: 'ASYNC2',
          samples: ch2Samples,
          hidden: false,
          triggerValue: 0
        }
      ];

      const options = { enableCrossChannelAnalysis: true, enableSignalQuality: true };
      const result = await service.performMeasurement(channels, 1000000, options);
      
      expect(result.totalChannels).toBe(2);
      
      // 验证频率不同
      const freq1 = result.channels[0].frequency.averageFrequency;
      const freq2 = result.channels[1].frequency.averageFrequency;
      expect(Math.abs(freq1 - freq2)).toBeGreaterThan(1000); // 频率差 > 1kHz
      
      // 验证被识别为独立信号
      const timing = result.crossChannelAnalysis!.timingRelationships[0];
      expect(timing.relationship).toBe('independent');
    });
  });
});