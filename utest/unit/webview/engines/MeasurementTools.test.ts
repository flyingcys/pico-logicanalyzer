/**
 * MeasurementTools 测量工具测试套件
 * 
 * 测试范围：
 * - 构造函数和配置管理
 * - 采样信息设置和通道管理
 * - 边沿检测功能（上升沿、下降沿）
 * - 频率测量和周期计算
 * - 占空比测量和脉冲分析
 * - 脉冲检测和宽度计算
 * - 时间间隔测量
 * - 统计测量（最小值、最大值、均值、RMS、标准差）
 * - 频谱分析和主要频率检测
 * - 自动测量功能
 * - 格式化功能（时间、频率）
 * - 数据导出功能
 * - 边界条件和错误处理
 * 
 * @author VSCode Logic Analyzer Extension
 * @date 2025-08-04
 * @jest-environment jsdom
 */

import { 
  MeasurementTools, 
  PulseInfo, 
  FrequencyMeasurement, 
  DutyCycleMeasurement, 
  EdgeMeasurement, 
  StatisticalMeasurement, 
  MeasurementConfig 
} from '../../../../src/webview/engines/MeasurementTools';
import { AnalyzerChannel } from '../../../../src/models/CaptureModels';

describe('MeasurementTools 测量工具测试', () => {
  let measurementTools: MeasurementTools;
  let mockChannels: AnalyzerChannel[];

  beforeEach(() => {
    // 创建模拟通道数据
    mockChannels = [
      {
        channelIndex: 0,
        enabled: true,
        samples: new Uint8Array([0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]),
        name: 'Channel 0'
      },
      {
        channelIndex: 1,
        enabled: true,
        samples: new Uint8Array([1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1]),
        name: 'Channel 1'
      }
    ];

    measurementTools = new MeasurementTools();
    measurementTools.setSampleInfo(1000000, mockChannels); // 1MHz采样率
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数和配置管理', () => {
    it('应该使用默认配置创建实例', () => {
      const tools = new MeasurementTools();
      const config = tools.getConfig();

      expect(config.edgeThreshold).toBe(0.5);
      expect(config.minimumPulseWidth).toBe(2);
      expect(config.maximumPulseWidth).toBe(1000000);
      expect(config.hysteresis).toBe(1);
      expect(config.autoRange).toBe(true);
      expect(config.statisticalSamples).toBe(10000);
    });

    it('应该接受自定义配置', () => {
      const customConfig: Partial<MeasurementConfig> = {
        edgeThreshold: 0.3,
        minimumPulseWidth: 5,
        autoRange: false
      };

      const tools = new MeasurementTools(customConfig);
      const config = tools.getConfig();

      expect(config.edgeThreshold).toBe(0.3);
      expect(config.minimumPulseWidth).toBe(5);
      expect(config.autoRange).toBe(false);
      // 未指定的配置应该使用默认值
      expect(config.maximumPulseWidth).toBe(1000000);
    });

    it('应该正确更新配置', () => {
      const tools = new MeasurementTools();
      const updateConfig: Partial<MeasurementConfig> = {
        edgeThreshold: 0.7,
        statisticalSamples: 20000
      };

      tools.updateConfig(updateConfig);
      const config = tools.getConfig();

      expect(config.edgeThreshold).toBe(0.7);
      expect(config.statisticalSamples).toBe(20000);
      // 其他配置保持不变
      expect(config.minimumPulseWidth).toBe(2);
    });

    it('应该返回配置的副本而不是引用', () => {
      const tools = new MeasurementTools();
      const config1 = tools.getConfig();
      const config2 = tools.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);

      // 修改返回的配置不应该影响内部配置
      config1.edgeThreshold = 0.9;
      expect(tools.getConfig().edgeThreshold).toBe(0.5);
    });
  });

  describe('采样信息设置和通道管理', () => {
    it('应该正确设置采样率和通道', () => {
      const tools = new MeasurementTools();
      const sampleRate = 2000000; // 2MHz
      const channels = mockChannels;

      expect(() => {
        tools.setSampleInfo(sampleRate, channels);
      }).not.toThrow();
    });

    it('应该处理空通道数组', () => {
      const tools = new MeasurementTools();

      expect(() => {
        tools.setSampleInfo(1000000, []);
      }).not.toThrow();
    });

    it('应该处理零采样率', () => {
      const tools = new MeasurementTools();

      expect(() => {
        tools.setSampleInfo(0, mockChannels);
      }).not.toThrow();
    });
  });

  describe('边沿检测功能', () => {
    it('应该检测上升沿', () => {
      const edges = measurementTools.detectEdges(0, 0, undefined, 'rising');

      expect(edges).toBeDefined();
      expect(edges.length).toBeGreaterThan(0);
      
      // 验证所有检测到的边沿都是上升沿
      edges.forEach(edge => {
        expect(edge.type).toBe('rising');
        expect(edge.startSample).toBeLessThan(edge.endSample);
      });
    });

    it('应该检测下降沿', () => {
      const edges = measurementTools.detectEdges(0, 0, undefined, 'falling');

      expect(edges).toBeDefined();
      expect(edges.length).toBeGreaterThan(0);
      
      // 验证所有检测到的边沿都是下降沿
      edges.forEach(edge => {
        expect(edge.type).toBe('falling');
        expect(edge.startSample).toBeLessThan(edge.endSample);
      });
    });

    it('应该检测所有边沿', () => {
      const edges = measurementTools.detectEdges(0, 0, undefined, 'both');

      expect(edges).toBeDefined();
      expect(edges.length).toBeGreaterThan(0);
      
      // 验证包含上升沿和下降沿
      const risingEdges = edges.filter(e => e.type === 'rising');
      const fallingEdges = edges.filter(e => e.type === 'falling');
      
      expect(risingEdges.length).toBeGreaterThan(0);
      expect(fallingEdges.length).toBeGreaterThan(0);
    });

    it('应该在指定范围内检测边沿', () => {
      const startSample = 5;
      const endSample = 15;
      const edges = measurementTools.detectEdges(0, startSample, endSample, 'both');

      edges.forEach(edge => {
        expect(edge.startSample).toBeGreaterThanOrEqual(startSample);
        expect(edge.endSample).toBeLessThan(endSample);
      });
    });

    it('应该处理无效通道索引', () => {
      expect(() => {
        measurementTools.detectEdges(999, 0, undefined, 'both');
      }).toThrow('Channel 999 not found');
    });

    it('应该处理无采样数据的通道', () => {
      const emptyChannel: AnalyzerChannel = {
        channelIndex: 2,
        enabled: true,
        samples: undefined,
        name: 'Empty Channel'
      };

      measurementTools.setSampleInfo(1000000, [emptyChannel]);
      const edges = measurementTools.detectEdges(0, 0, undefined, 'both');

      expect(edges).toEqual([]);
    });

    it('应该处理单样本数据', () => {
      const singleSample: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: new Uint8Array([1]),
        name: 'Single Sample'
      };

      measurementTools.setSampleInfo(1000000, [singleSample]);
      const edges = measurementTools.detectEdges(0, 0, undefined, 'both');

      expect(edges).toEqual([]);
    });
  });

  describe('频率测量和周期计算', () => {
    it('应该测量基本频率', () => {
      // 创建规则的方波信号
      const regularSignal = new Uint8Array(20);
      for (let i = 0; i < 20; i++) {
        regularSignal[i] = Math.floor(i / 4) % 2; // 每4个样本一个周期的一半
      }

      const channel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: regularSignal,
        name: 'Regular Signal'
      };

      measurementTools.setSampleInfo(1000000, [channel]);
      const freqMeasure = measurementTools.measureFrequency(0);

      expect(freqMeasure).toBeTruthy();
      if (freqMeasure) {
        expect(freqMeasure.frequency).toBeGreaterThan(0);
        expect(freqMeasure.period).toBeGreaterThan(0);
        expect(freqMeasure.accuracy).toBeGreaterThanOrEqual(0);
        expect(freqMeasure.confidence).toBeGreaterThan(0);
        expect(freqMeasure.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('应该处理不足两个边沿的信号', () => {
      const constantSignal = new Uint8Array(10);
      constantSignal.fill(1); // 全为1，无边沿

      const channel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: constantSignal,
        name: 'Constant Signal'
      };

      measurementTools.setSampleInfo(1000000, [channel]);
      const freqMeasure = measurementTools.measureFrequency(0);

      expect(freqMeasure).toBeNull();
    });

    it('应该在指定范围内测量频率', () => {
      const freqMeasure = measurementTools.measureFrequency(0, 2, 18);

      // 在限定范围内应该能找到一些边沿
      expect(freqMeasure).toBeTruthy();
    });

    it('应该计算准确的周期和频率关系', () => {
      const freqMeasure = measurementTools.measureFrequency(0);

      if (freqMeasure) {
        expect(Math.abs(freqMeasure.frequency * freqMeasure.period - 1)).toBeLessThan(0.001);
      }
    });
  });

  describe('占空比测量和脉冲分析', () => {
    it('应该测量占空比', () => {
      const dutyCycle = measurementTools.measureDutyCycle(0);

      expect(dutyCycle).toBeTruthy();
      if (dutyCycle) {
        expect(dutyCycle.dutyCycle).toBeGreaterThanOrEqual(0);
        expect(dutyCycle.dutyCycle).toBeLessThanOrEqual(1);
        expect(dutyCycle.highTime).toBeGreaterThanOrEqual(0);
        expect(dutyCycle.lowTime).toBeGreaterThanOrEqual(0);
        expect(dutyCycle.period).toBeGreaterThan(0);
        expect(dutyCycle.frequency).toBeGreaterThanOrEqual(0);
      }
    });

    it('应该验证占空比计算的正确性', () => {
      const dutyCycle = measurementTools.measureDutyCycle(0);

      if (dutyCycle) {
        const totalTime = dutyCycle.highTime + dutyCycle.lowTime;
        const calculatedDutyCycle = dutyCycle.highTime / totalTime;
        expect(Math.abs(calculatedDutyCycle - dutyCycle.dutyCycle)).toBeLessThan(0.001);
      }
    });

    it('应该处理无效通道索引', () => {
      expect(() => {
        measurementTools.measureDutyCycle(999);
      }).toThrow('Channel 999 not found');
    });

    it('应该处理无采样数据', () => {
      const emptyChannel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: undefined,
        name: 'Empty'
      };

      measurementTools.setSampleInfo(1000000, [emptyChannel]);
      const dutyCycle = measurementTools.measureDutyCycle(0);

      expect(dutyCycle).toBeNull();
    });

    it('应该处理不足两个脉冲的信号', () => {
      const shortSignal = new Uint8Array([1, 1, 1]); // 只有一个高电平脉冲

      const channel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: shortSignal,
        name: 'Short Signal'
      };

      measurementTools.setSampleInfo(1000000, [channel]);
      const dutyCycle = measurementTools.measureDutyCycle(0);

      expect(dutyCycle).toBeNull();
    });
  });

  describe('脉冲检测和宽度计算', () => {
    it('应该检测脉冲', () => {
      const pulses = measurementTools.detectPulses(0);

      expect(pulses).toBeDefined();
      expect(Array.isArray(pulses)).toBe(true);

      pulses.forEach(pulse => {
        expect(pulse.startSample).toBeLessThanOrEqual(pulse.endSample);
        expect(pulse.width).toBeGreaterThan(0);
        expect(typeof pulse.level).toBe('boolean');
        expect(pulse.channelIndex).toBe(0);
      });
    });

    it('应该正确计算脉冲宽度', () => {
      const pulses = measurementTools.detectPulses(0);

      pulses.forEach(pulse => {
        const expectedWidth = (pulse.endSample - pulse.startSample + 1) / 1000000; // 1MHz采样率
        expect(Math.abs(pulse.width - expectedWidth)).toBeLessThan(0.000001);
      });
    });

    it('应该过滤掉太短的脉冲', () => {
      const config: Partial<MeasurementConfig> = {
        minimumPulseWidth: 5 // 最小5个样本
      };

      const tools = new MeasurementTools(config);
      tools.setSampleInfo(1000000, mockChannels);

      const pulses = tools.detectPulses(0);

      pulses.forEach(pulse => {
        const sampleCount = pulse.endSample - pulse.startSample + 1;
        expect(sampleCount).toBeGreaterThanOrEqual(5);
      });
    });

    it('应该区分高电平和低电平脉冲', () => {
      const pulses = measurementTools.detectPulses(0);

      const highPulses = pulses.filter(p => p.level);
      const lowPulses = pulses.filter(p => !p.level);

      expect(highPulses.length).toBeGreaterThan(0);
      expect(lowPulses.length).toBeGreaterThan(0);
    });

    it('应该处理指定范围的脉冲检测', () => {
      const startSample = 3;
      const endSample = 15;
      const pulses = measurementTools.detectPulses(0, startSample, endSample);

      pulses.forEach(pulse => {
        expect(pulse.startSample).toBeGreaterThanOrEqual(startSample);
        expect(pulse.endSample).toBeLessThan(endSample);
      });
    });

    it('应该处理无效通道索引', () => {
      expect(() => {
        measurementTools.detectPulses(999);
      }).toThrow('Channel 999 not found');
    });
  });

  describe('时间间隔测量', () => {
    it('应该正确计算时间间隔', () => {
      const startSample = 100;
      const endSample = 200;
      const timeInterval = measurementTools.measureTimeInterval(startSample, endSample);

      const expectedTime = (endSample - startSample) / 1000000; // 1MHz采样率
      expect(timeInterval).toBe(expectedTime);
    });

    it('应该处理负数时间间隔', () => {
      const startSample = 200;
      const endSample = 100;
      const timeInterval = measurementTools.measureTimeInterval(startSample, endSample);

      const expectedTime = (startSample - endSample) / 1000000; // 应该取绝对值
      expect(timeInterval).toBe(expectedTime);
    });

    it('应该处理零时间间隔', () => {
      const sample = 100;
      const timeInterval = measurementTools.measureTimeInterval(sample, sample);

      expect(timeInterval).toBe(0);
    });

    it('应该处理极大的样本差值', () => {
      const startSample = 0;
      const endSample = 1000000;
      const timeInterval = measurementTools.measureTimeInterval(startSample, endSample);

      expect(timeInterval).toBe(1); // 1秒
    });
  });

  describe('统计测量', () => {
    it('应该计算基本统计信息', () => {
      const stats = measurementTools.measureStatistics(0);

      expect(stats).toBeTruthy();
      if (stats) {
        expect(stats.min).toBeGreaterThanOrEqual(0);
        expect(stats.max).toBeLessThanOrEqual(1);
        expect(stats.min).toBeLessThanOrEqual(stats.max);
        expect(stats.mean).toBeGreaterThanOrEqual(stats.min);
        expect(stats.mean).toBeLessThanOrEqual(stats.max);
        expect(stats.rms).toBeGreaterThanOrEqual(0);
        expect(stats.standardDeviation).toBeGreaterThanOrEqual(0);
        expect(stats.sampleCount).toBeGreaterThan(0);
      }
    });

    it('应该在指定范围内计算统计信息', () => {
      const startSample = 5;
      const endSample = 15;
      const stats = measurementTools.measureStatistics(0, startSample, endSample);

      expect(stats).toBeTruthy();
      if (stats) {
        expect(stats.sampleCount).toBe(endSample - startSample);
      }
    });

    it('应该处理单一值的统计', () => {
      const constantSignal = new Uint8Array(10);
      constantSignal.fill(1);

      const channel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: constantSignal,
        name: 'Constant'
      };

      measurementTools.setSampleInfo(1000000, [channel]);
      const stats = measurementTools.measureStatistics(0);

      if (stats) {
        expect(stats.min).toBe(1);
        expect(stats.max).toBe(1);
        expect(stats.mean).toBe(1);
        expect(stats.standardDeviation).toBe(0);
      }
    });

    it('应该处理无效通道索引', () => {
      expect(() => {
        measurementTools.measureStatistics(999);
      }).toThrow('Channel 999 not found');
    });

    it('应该处理空数据范围', () => {
      const stats = measurementTools.measureStatistics(0, 10, 10); // 空范围

      expect(stats).toBeNull();
    });

    it('应该正确计算RMS值', () => {
      // 创建已知的测试数据
      const testData = new Uint8Array([0, 1, 0, 1, 0]);
      
      const channel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: testData,
        name: 'Test RMS'
      };

      measurementTools.setSampleInfo(1000000, [channel]);
      const stats = measurementTools.measureStatistics(0);

      if (stats) {
        // 手动计算期望的RMS值
        const expectedRms = Math.sqrt((0*0 + 1*1 + 0*0 + 1*1 + 0*0) / 5);
        expect(Math.abs(stats.rms - expectedRms)).toBeLessThan(0.001);
      }
    });
  });

  describe('频谱分析和主要频率检测', () => {
    it('应该分析频谱', () => {
      const spectrum = measurementTools.analyzeFrequencySpectrum(0);

      expect(spectrum).toBeDefined();
      expect(Array.isArray(spectrum)).toBe(true);

      spectrum.forEach(point => {
        expect(point.frequency).toBeGreaterThan(0);
        expect(point.magnitude).toBeGreaterThanOrEqual(0);
      });
    });

    it('应该按幅度排序频谱', () => {
      const spectrum = measurementTools.analyzeFrequencySpectrum(0);

      if (spectrum.length > 1) {
        for (let i = 1; i < spectrum.length; i++) {
          expect(spectrum[i].magnitude).toBeLessThanOrEqual(spectrum[i-1].magnitude);
        }
      }
    });

    it('应该在指定范围内分析频谱', () => {
      const startSample = 2;
      const endSample = 18;
      const spectrum = measurementTools.analyzeFrequencySpectrum(0, startSample, endSample);

      expect(spectrum).toBeDefined();
      expect(Array.isArray(spectrum)).toBe(true);
    });

    it('应该使用自定义窗口大小', () => {
      const windowSize = 512;
      const spectrum = measurementTools.analyzeFrequencySpectrum(0, 0, undefined, windowSize);

      expect(spectrum).toBeDefined();
    });

    it('应该处理无效通道索引', () => {
      expect(() => {
        measurementTools.analyzeFrequencySpectrum(999);
      }).toThrow('Channel 999 not found');
    });

    it('应该处理空采样数据', () => {
      const emptyChannel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: undefined,
        name: 'Empty'
      };

      measurementTools.setSampleInfo(1000000, [emptyChannel]);
      const spectrum = measurementTools.analyzeFrequencySpectrum(0);

      expect(spectrum).toEqual([]);
    });

    it('应该限制频谱分析在奈奎斯特频率以下', () => {
      const sampleRate = 1000000; // 1MHz
      const spectrum = measurementTools.analyzeFrequencySpectrum(0);

      spectrum.forEach(point => {
        expect(point.frequency).toBeLessThanOrEqual(sampleRate / 2);
      });
    });
  });

  describe('自动测量功能', () => {
    it('应该执行自动测量', () => {
      const autoResults = measurementTools.autoMeasure(0);

      expect(autoResults).toBeDefined();
      expect(typeof autoResults).toBe('object');

      // 检查返回的测量结果
      if (autoResults.frequency) {
        expect(autoResults.frequency.frequency).toBeGreaterThan(0);
      }

      if (autoResults.statistics) {
        expect(autoResults.statistics.sampleCount).toBeGreaterThan(0);
      }

      if (autoResults.pulses) {
        expect(Array.isArray(autoResults.pulses)).toBe(true);
      }

      if (autoResults.edges) {
        expect(Array.isArray(autoResults.edges)).toBe(true);
      }

      if (autoResults.dominantFrequencies) {
        expect(Array.isArray(autoResults.dominantFrequencies)).toBe(true);
        expect(autoResults.dominantFrequencies.length).toBeLessThanOrEqual(5);
      }
    });

    it('应该在指定范围内执行自动测量', () => {
      const startSample = 3;
      const endSample = 17;
      const autoResults = measurementTools.autoMeasure(0, startSample, endSample);

      expect(autoResults).toBeDefined();

      // 验证结果在指定范围内
      if (autoResults.pulses) {
        autoResults.pulses.forEach(pulse => {
          expect(pulse.startSample).toBeGreaterThanOrEqual(startSample);
          expect(pulse.endSample).toBeLessThan(endSample);
        });
      }
    });

    it('应该处理测量错误并返回部分结果', () => {
      // 模拟错误情况 - 使用无效的通道配置
      const invalidChannel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: new Uint8Array([]), // 空数组
        name: 'Invalid'
      };

      measurementTools.setSampleInfo(1000000, [invalidChannel]);

      expect(() => {
        const results = measurementTools.autoMeasure(0);
        expect(results).toBeDefined();
      }).not.toThrow();
    });

    it('应该捕获控制台错误但不抛出异常', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // 使用无效通道索引触发错误
      const results = measurementTools.autoMeasure(999);

      expect(results).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('格式化功能', () => {
    describe('时间格式化', () => {
      it('应该格式化秒级时间', () => {
        expect(measurementTools.formatTime(1.234)).toBe('1.234s');
        expect(measurementTools.formatTime(5.0)).toBe('5.000s');
      });

      it('应该格式化毫秒级时间', () => {
        expect(measurementTools.formatTime(0.001234)).toBe('1.234ms');
        expect(measurementTools.formatTime(0.5)).toBe('500.000ms');
      });

      it('应该格式化微秒级时间', () => {
        expect(measurementTools.formatTime(0.000001234)).toBe('1.234μs');
        expect(measurementTools.formatTime(0.0005)).toBe('500.000μs');
      });

      it('应该格式化纳秒级时间', () => {
        expect(measurementTools.formatTime(0.000000001234)).toBe('1.234ns');
        expect(measurementTools.formatTime(0.0000005)).toBe('500.000ns');
      });

      it('应该处理零时间', () => {
        expect(measurementTools.formatTime(0)).toBe('0.000ns');
      });

      it('应该处理极小时间', () => {
        const result = measurementTools.formatTime(0.000000000001);
        expect(result).toContain('ns');
      });
    });

    describe('频率格式化', () => {
      it('应该格式化GHz级频率', () => {
        expect(measurementTools.formatFrequency(1234567890)).toBe('1.235GHz');
        expect(measurementTools.formatFrequency(5000000000)).toBe('5.000GHz');
      });

      it('应该格式化MHz级频率', () => {
        expect(measurementTools.formatFrequency(1234567)).toBe('1.235MHz');
        expect(measurementTools.formatFrequency(2000000)).toBe('2.000MHz');
      });

      it('应该格式化kHz级频率', () => {
        expect(measurementTools.formatFrequency(1234)).toBe('1.234kHz');
        expect(measurementTools.formatFrequency(5000)).toBe('5.000kHz');
      });

      it('应该格式化Hz级频率', () => {
        expect(measurementTools.formatFrequency(123.456)).toBe('123.456Hz');
        expect(measurementTools.formatFrequency(50)).toBe('50.000Hz');
      });

      it('应该处理零频率', () => {
        expect(measurementTools.formatFrequency(0)).toBe('0.000Hz');
      });

      it('应该处理小数频率', () => {
        expect(measurementTools.formatFrequency(0.123)).toBe('0.123Hz');
      });
    });
  });

  describe('数据导出功能', () => {
    it('应该导出测量结果为JSON', () => {
      const measurements = [
        { type: 'frequency', value: 1000 },
        { type: 'dutyCycle', value: 0.5 }
      ];

      const jsonResult = measurementTools.exportMeasurements(measurements);

      expect(jsonResult).toBeDefined();
      expect(typeof jsonResult).toBe('string');

      // 验证JSON格式有效
      expect(() => JSON.parse(jsonResult)).not.toThrow();

      const parsed = JSON.parse(jsonResult);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.sampleRate).toBe(1000000);
      expect(parsed.config).toBeDefined();
      expect(parsed.measurements).toEqual(measurements);
      expect(parsed.version).toBe('1.0.0');
    });

    it('应该包含当前配置信息', () => {
      const measurements = [];
      const jsonResult = measurementTools.exportMeasurements(measurements);
      const parsed = JSON.parse(jsonResult);

      expect(parsed.config.edgeThreshold).toBeDefined();
      expect(parsed.config.minimumPulseWidth).toBeDefined();
    });

    it('应该包含时间戳', () => {
      const measurements = [];
      const jsonResult = measurementTools.exportMeasurements(measurements);
      const parsed = JSON.parse(jsonResult);

      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该处理空测量数组', () => {
      const jsonResult = measurementTools.exportMeasurements([]);
      const parsed = JSON.parse(jsonResult);

      expect(parsed.measurements).toEqual([]);
    });

    it('应该处理复杂的测量对象', () => {
      const complexMeasurements = [
        {
          type: 'complex',
          data: {
            nested: { value: 123 },
            array: [1, 2, 3],
            string: 'test'
          }
        }
      ];

      expect(() => {
        const result = measurementTools.exportMeasurements(complexMeasurements);
        JSON.parse(result);
      }).not.toThrow();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理极大的采样率', () => {
      expect(() => {
        measurementTools.setSampleInfo(1000000000, mockChannels); // 1GHz
      }).not.toThrow();
    });

    it('应该处理极小的采样率', () => {
      expect(() => {
        measurementTools.setSampleInfo(1, mockChannels); // 1Hz
      }).not.toThrow();
    });

    it('应该处理超长的采样数据', () => {
      const longData = new Uint8Array(100000);
      for (let i = 0; i < longData.length; i++) {
        longData[i] = i % 2;
      }

      const longChannel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: longData,
        name: 'Long Data'
      };

      measurementTools.setSampleInfo(1000000, [longChannel]);

      expect(() => {
        measurementTools.detectEdges(0);
        measurementTools.detectPulses(0);
        measurementTools.measureStatistics(0);
      }).not.toThrow();
    });

    it('应该处理边界样本索引', () => {
      const channelLength = mockChannels[0].samples!.length;

      // 边界索引应该不抛出错误
      expect(() => {
        measurementTools.detectEdges(0, 0, channelLength);
        measurementTools.detectPulses(0, 0, channelLength);
        measurementTools.measureStatistics(0, 0, channelLength);
      }).not.toThrow();
    });

    it('应该处理无效的样本范围', () => {
      // 开始索引大于结束索引
      expect(() => {
        measurementTools.detectEdges(0, 10, 5);
      }).not.toThrow();

      expect(() => {
        measurementTools.measureStatistics(0, 15, 10);
      }).not.toThrow();
    });

    it('应该处理超出范围的样本索引', () => {
      const channelLength = mockChannels[0].samples!.length;

      expect(() => {
        measurementTools.detectEdges(0, 0, channelLength + 100);
      }).not.toThrow();
    });

    it('应该处理配置极值', () => {
      const extremeConfig: Partial<MeasurementConfig> = {
        edgeThreshold: 0,
        minimumPulseWidth: 0,
        maximumPulseWidth: Number.MAX_SAFE_INTEGER,
        hysteresis: 0,
        statisticalSamples: 1
      };

      expect(() => {
        const tools = new MeasurementTools(extremeConfig);
        tools.setSampleInfo(1000000, mockChannels);
        tools.detectPulses(0);
      }).not.toThrow();
    });
  });

  describe('性能和压力测试', () => {
    it('应该快速处理大量数据', () => {
      const largeData = new Uint8Array(50000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = Math.floor(i / 100) % 2; // 周期性数据
      }

      const largeChannel: AnalyzerChannel = {
        channelIndex: 0,
        enabled: true,
        samples: largeData,
        name: 'Large Data'
      };

      measurementTools.setSampleInfo(1000000, [largeChannel]);

      const startTime = performance.now();
      measurementTools.autoMeasure(0);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // 应该在2秒内完成
    });

    it('应该高效处理频谱分析', () => {
      const startTime = performance.now();
      measurementTools.analyzeFrequencySpectrum(0);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // 应该在500ms内完成
    });

    it('应该高效处理统计计算', () => {
      const startTime = performance.now();
      measurementTools.measureStatistics(0);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该高效格式化大量数据', () => {
      const values = Array.from({ length: 10000 }, (_, i) => i * 0.000001);

      const startTime = performance.now();
      values.forEach(value => {
        measurementTools.formatTime(value);
        measurementTools.formatFrequency(value * 1000000);
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200); // 应该在200ms内完成
    });
  });
});