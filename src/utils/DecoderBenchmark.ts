/**
 * 解码器性能基准测试工具
 * 基于 @logicanalyzer/Software 的性能标准
 * 提供全面的解码器速度基准测试和性能分析
 */

import type {
  ChannelData,
  DecoderOptionValue,
  DecoderSelectedChannel,
  DecoderResult
} from '../decoders/types';

export interface BenchmarkDecoder {
  decode?(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): Promise<DecoderResult[]>;
  streamingDecode?(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]>;
}

export interface BenchmarkConfiguration {
  /** 测试名称 */
  name: string;
  /** 样本数量 */
  sampleCount: number;
  /** 采样率 */
  sampleRate: number;
  /** 通道数量 */
  channelCount: number;
  /** 重复次数 */
  iterations: number;
  /** 是否启用流式处理 */
  useStreaming: boolean;
  /** 流式处理块大小 */
  chunkSize?: number;
}

export interface DecoderPerformanceResult {
  /** 解码器ID */
  decoderId: string;
  /** 配置信息 */
  configuration: BenchmarkConfiguration;
  /** 执行时间(毫秒) */
  executionTime: number;
  /** 处理速度(样本/秒) */
  processingSpeed: number;
  /** 内存使用峰值(字节) */
  peakMemoryUsage: number;
  /** 解码结果数量 */
  resultCount: number;
  /** 错误信息 */
  errors: string[];
  /** 是否成功 */
  success: boolean;
  /** 详细统计 */
  statistics: {
    averageIterationTime: number;
    minIterationTime: number;
    maxIterationTime: number;
    standardDeviation: number;
    throughput: number; // MB/s
    cpuUsage?: number; // 百分比
  };
}

export interface BenchmarkReport {
  /** 测试开始时间 */
  startTime: number;
  /** 测试结束时间 */
  endTime: number;
  /** 总测试时间 */
  totalDuration: number;
  /** 测试配置 */
  configurations: BenchmarkConfiguration[];
  /** 所有测试结果 */
  results: DecoderPerformanceResult[];
  /** 性能排名 */
  rankings: {
    bySpeed: DecoderPerformanceResult[];
    byMemoryEfficiency: DecoderPerformanceResult[];
    byThroughput: DecoderPerformanceResult[];
  };
  /** 性能基线 */
  baselines: {
    [decoderId: string]: {
      expectedSpeed: number;
      acceptableMemory: number;
      reliabilityScore: number;
    };
  };
}

/**
 * 解码器基准测试类
 */
export class DecoderBenchmark {
  private isRunning = false;
  private currentTest = '';
  private progressCallback?: (progress: { current: number; total: number; test: string }) => void;
  private timerId?: NodeJS.Timeout;

  constructor(private onProgress?: (progress: { current: number; total: number; test: string }) => void) {
    this.progressCallback = onProgress;
  }

  /**
   * 运行单个解码器的基准测试
   */
  public async runDecoderBenchmark(
    decoderId: string,
    decoderInstance: BenchmarkDecoder | null,
    configuration: BenchmarkConfiguration
  ): Promise<DecoderPerformanceResult> {
    const result: DecoderPerformanceResult = {
      decoderId,
      configuration,
      executionTime: 0,
      processingSpeed: 0,
      peakMemoryUsage: 0,
      resultCount: 0,
      errors: [],
      success: false,
      statistics: {
        averageIterationTime: 0,
        minIterationTime: Infinity,
        maxIterationTime: 0,
        standardDeviation: 0,
        throughput: 0
      }
    };

    try {
      console.log(`🚀 开始基准测试: ${decoderId} (${configuration.name})`);

      // 生成测试数据
      const testData = this.generateBenchmarkData(
        configuration.sampleCount,
        configuration.channelCount
      );

      const iterationTimes: number[] = [];
      let totalResultCount = 0;
      let totalMemoryUsage = 0;

      // 执行多次迭代测试
      const startTime = performance.now();

      for (let i = 0; i < configuration.iterations; i++) {
        const iterationStart = performance.now();

        // 记录内存使用
        const memoryBefore = this.getMemoryUsage();

        try {
          // 执行解码
          let decodeResult;
          if (configuration.useStreaming && decoderInstance.streamingDecode) {
            decodeResult = await decoderInstance.streamingDecode(
              configuration.sampleRate,
              testData,
              [],
              []
            );
          } else if (decoderInstance.decode) {
            decodeResult = await decoderInstance.decode(
              configuration.sampleRate,
              testData,
              []
            );
          } else {
            throw new Error('解码器不支持标准接口');
          }

          const memoryAfter = this.getMemoryUsage();
          const memoryUsed = memoryAfter - memoryBefore;
          totalMemoryUsage = Math.max(totalMemoryUsage, memoryUsed);

          if (decodeResult && decodeResult.results) {
            totalResultCount += decodeResult.results.length;
          }

        } catch (error) {
          result.errors.push(`迭代 ${i + 1}: ${error.message}`);
        }

        const iterationEnd = performance.now();
        const iterationTime = iterationEnd - iterationStart;
        iterationTimes.push(iterationTime);

        // 更新进度
        if (this.progressCallback) {
          this.progressCallback({
            current: i + 1,
            total: configuration.iterations,
            test: `${decoderId} - ${configuration.name}`
          });
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 计算统计信息
      result.executionTime = totalTime;
      result.processingSpeed = totalTime > 0 ? (configuration.sampleCount * configuration.iterations) / (totalTime / 1000) : 0;
      result.peakMemoryUsage = totalMemoryUsage;
      result.resultCount = configuration.iterations > 0 ? Math.floor(totalResultCount / configuration.iterations) : 0;
      result.success = result.errors.length === 0;

      // 计算详细统计
      let avgTime = 0;
      let variance = 0;
      let minTime = 0;
      let maxTime = 0;

      if (iterationTimes.length > 0) {
        avgTime = iterationTimes.reduce((sum, time) => sum + time, 0) / iterationTimes.length;
        variance = iterationTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / iterationTimes.length;
        minTime = Math.min(...iterationTimes);
        maxTime = Math.max(...iterationTimes);
      }

      result.statistics = {
        averageIterationTime: avgTime,
        minIterationTime: minTime,
        maxIterationTime: maxTime,
        standardDeviation: Math.sqrt(variance),
        throughput: this.calculateThroughput(configuration, totalTime)
      };

      console.log(`✅ 基准测试完成: ${decoderId}`);
      console.log(`   处理速度: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒`);
      console.log(`   平均迭代时间: ${avgTime.toFixed(2)}ms`);
      console.log(`   内存使用: ${(result.peakMemoryUsage / 1024).toFixed(1)}KB`);

    } catch (error) {
      result.errors.push(`基准测试失败: ${error.message}`);
      console.error(`❌ 基准测试失败: ${decoderId}`, error);
    }

    return result;
  }

  /**
   * 运行完整的基准测试套件
   */
  public async runBenchmarkSuite(
    decoders: Array<{ id: string; instance: BenchmarkDecoder }>,
    configurations: BenchmarkConfiguration[]
  ): Promise<BenchmarkReport> {
    if (this.isRunning) {
      throw new Error('基准测试正在进行中');
    }

    this.isRunning = true;
    const startTime = Date.now();

    const report: BenchmarkReport = {
      startTime,
      endTime: 0,
      totalDuration: 0,
      configurations,
      results: [],
      rankings: {
        bySpeed: [],
        byMemoryEfficiency: [],
        byThroughput: []
      },
      baselines: {}
    };

    try {
      console.log(`🧪 开始基准测试套件: ${decoders.length}个解码器, ${configurations.length}个配置`);

      const totalTests = decoders.length * configurations.length;
      let currentTest = 0;

      // 运行所有测试
      for (const decoder of decoders) {
        for (const config of configurations) {
          currentTest++;
          this.currentTest = `${decoder.id} - ${config.name}`;

          if (this.progressCallback) {
            this.progressCallback({
              current: currentTest,
              total: totalTests,
              test: this.currentTest
            });
          }

          const result = await this.runDecoderBenchmark(decoder.id, decoder.instance, config);
          report.results.push(result);

          // 短暂延迟以避免系统过载
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 计算排名
      report.rankings = this.calculateRankings(report.results);

      // 生成性能基线
      report.baselines = this.generateBaselines(report.results);

      const endTime = Date.now();
      report.endTime = endTime;
      report.totalDuration = endTime - startTime;

      console.log(`🏁 基准测试套件完成，总耗时: ${(report.totalDuration / 1000).toFixed(1)}秒`);

    } catch (error) {
      console.error('❌ 基准测试套件失败:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }

    return report;
  }

  /**
   * 生成基准测试数据
   */
  private generateBenchmarkData(sampleCount: number, channelCount: number): ChannelData[] {
    const channels: ChannelData[] = [];

    for (let i = 0; i < channelCount; i++) {
      const samples = new Uint8Array(sampleCount);

      // 生成不同协议的测试模式
      for (let j = 0; j < sampleCount; j++) {
        if (i === 0) { // 时钟信号
          samples[j] = Math.floor(j / 10) % 2;
        } else if (i === 1) { // 数据信号
          samples[j] = this.generateProtocolPattern(j, 'i2c');
        } else if (i === 2) { // SPI信号
          samples[j] = this.generateProtocolPattern(j, 'spi');
        } else if (i === 3) { // UART信号
          samples[j] = this.generateProtocolPattern(j, 'uart');
        } else {
          // 随机信号
          samples[j] = Math.random() > 0.6 ? 1 : 0;
        }
      }

      channels.push({
        channelNumber: i,
        channelName: `CH${i}`,
        samples
      });
    }

    return channels;
  }

  /**
   * 生成协议特定的测试模式
   */
  private generateProtocolPattern(sampleIndex: number, protocol: string): number {
    switch (protocol) {
      case 'i2c':
        // I2C模式：开始位、地址、数据、停止位
        const i2cCycle = sampleIndex % 200;
        if (i2cCycle < 10) return 0; // 开始位
        if (i2cCycle < 80) return (Math.floor(i2cCycle / 10) % 2); // 地址+数据
        if (i2cCycle < 90) return 1; // 应答
        if (i2cCycle < 180) return (Math.floor((i2cCycle - 90) / 10) % 2); // 数据
        return 1; // 停止位

      case 'spi':
        // SPI模式：连续数据传输
        return Math.floor(sampleIndex / 8) % 2;

      case 'uart':
        // UART模式：起始位、数据位、停止位
        const uartCycle = sampleIndex % 100;
        if (uartCycle < 10) return 0; // 起始位
        if (uartCycle < 90) return Math.floor(uartCycle / 10) % 2; // 数据位
        return 1; // 停止位

      default:
        return Math.random() > 0.5 ? 1 : 0;
    }
  }

  /**
   * 获取内存使用量
   */
  private getMemoryUsage(): number {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(config: BenchmarkConfiguration, totalTime: number): number {
    if (totalTime <= 0 || config.iterations <= 0) {
      return 0;
    }
    const totalBytes = config.sampleCount * config.channelCount * config.iterations;
    const totalSeconds = totalTime / 1000;
    return totalBytes / totalSeconds / (1024 * 1024); // MB/s
  }

  /**
   * 计算性能排名
   */
  private calculateRankings(results: DecoderPerformanceResult[]): BenchmarkReport['rankings'] {
    const successfulResults = results.filter(r => r.success);

    return {
      bySpeed: [...successfulResults].sort((a, b) => b.processingSpeed - a.processingSpeed),
      byMemoryEfficiency: [...successfulResults].sort((a, b) => a.peakMemoryUsage - b.peakMemoryUsage),
      byThroughput: [...successfulResults].sort((a, b) => b.statistics.throughput - a.statistics.throughput)
    };
  }

  /**
   * 生成性能基线
   */
  private generateBaselines(results: DecoderPerformanceResult[]): BenchmarkReport['baselines'] {
    const baselines: BenchmarkReport['baselines'] = {};

    // 按解码器分组
    const decoderGroups = new Map<string, DecoderPerformanceResult[]>();
    results.forEach(result => {
      if (!decoderGroups.has(result.decoderId)) {
        decoderGroups.set(result.decoderId, []);
      }
      decoderGroups.get(result.decoderId)!.push(result);
    });

    // 为每个解码器计算基线
    decoderGroups.forEach((decoderResults, decoderId) => {
      const successfulResults = decoderResults.filter(r => r.success);

      if (successfulResults.length > 0) {
        const avgSpeed = successfulResults.reduce((sum, r) => sum + r.processingSpeed, 0) / successfulResults.length;
        const avgMemory = successfulResults.reduce((sum, r) => sum + r.peakMemoryUsage, 0) / successfulResults.length;
        const successRate = successfulResults.length / decoderResults.length;

        baselines[decoderId] = {
          expectedSpeed: avgSpeed,
          acceptableMemory: avgMemory > 0 ? avgMemory * 1.2 : 1024, // 20%容错，最小1KB
          reliabilityScore: successRate * 100
        };
      }
    });

    return baselines;
  }

  /**
   * 生成基准测试报告
   */
  public generateReport(report: BenchmarkReport): string {
    let reportText = '# 解码器性能基准测试报告\n\n';

    // 测试概览
    reportText += '## 测试概览\n';
    reportText += `- 测试开始时间: ${new Date(report.startTime).toLocaleString()}\n`;
    reportText += `- 测试总时长: ${(report.totalDuration / 1000).toFixed(1)}秒\n`;
    reportText += `- 测试配置数: ${report.configurations.length}\n`;
    reportText += `- 测试结果数: ${report.results.length}\n`;
    reportText += `- 成功率: ${(report.results.filter(r => r.success).length / report.results.length * 100).toFixed(1)}%\n\n`;

    // 性能排名
    reportText += '## 性能排名\n\n';

    reportText += '### 处理速度排名\n';
    report.rankings.bySpeed.slice(0, 5).forEach((result, index) => {
      reportText += `${index + 1}. ${result.decoderId}: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒\n`;
    });
    reportText += '\n';

    reportText += '### 内存效率排名\n';
    report.rankings.byMemoryEfficiency.slice(0, 5).forEach((result, index) => {
      reportText += `${index + 1}. ${result.decoderId}: ${(result.peakMemoryUsage / 1024).toFixed(1)}KB\n`;
    });
    reportText += '\n';

    reportText += '### 吞吐量排名\n';
    report.rankings.byThroughput.slice(0, 5).forEach((result, index) => {
      reportText += `${index + 1}. ${result.decoderId}: ${result.statistics.throughput.toFixed(2)}MB/s\n`;
    });
    reportText += '\n';

    // 性能基线
    reportText += '## 性能基线\n\n';
    Object.entries(report.baselines).forEach(([decoderId, baseline]) => {
      reportText += `### ${decoderId}\n`;
      reportText += `- 期望处理速度: ${(baseline.expectedSpeed / 1000).toFixed(1)}K样本/秒\n`;
      reportText += `- 可接受内存使用: ${(baseline.acceptableMemory / 1024).toFixed(1)}KB\n`;
      reportText += `- 可靠性评分: ${baseline.reliabilityScore.toFixed(1)}%\n\n`;
    });

    // 详细结果
    reportText += '## 详细测试结果\n\n';
    report.results.forEach(result => {
      reportText += `### ${result.decoderId} - ${result.configuration.name}\n`;
      reportText += `- 状态: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
      reportText += `- 执行时间: ${result.executionTime.toFixed(2)}ms\n`;
      reportText += `- 处理速度: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒\n`;
      reportText += `- 内存使用: ${(result.peakMemoryUsage / 1024).toFixed(1)}KB\n`;
      reportText += `- 结果数量: ${result.resultCount}\n`;
      reportText += `- 平均迭代时间: ${result.statistics.averageIterationTime.toFixed(2)}ms\n`;
      reportText += `- 标准差: ${result.statistics.standardDeviation.toFixed(2)}ms\n`;
      reportText += `- 吞吐量: ${result.statistics.throughput.toFixed(2)}MB/s\n`;

      if (result.errors.length > 0) {
        reportText += `- 错误信息: ${result.errors.join(', ')}\n`;
      }
      reportText += '\n';
    });

    return reportText;
  }

  /**
   * 停止当前测试
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    console.log('🛑 基准测试已停止');
  }

  /**
   * 获取当前测试状态
   */
  public getStatus(): { running: boolean; currentTest: string } {
    return {
      running: this.isRunning,
      currentTest: this.currentTest
    };
  }
}

// 预定义的基准测试配置
export const DefaultBenchmarkConfigurations: BenchmarkConfiguration[] = [
  {
    name: '小数据集-常规处理',
    sampleCount: 10000,
    sampleRate: 1000000,
    channelCount: 8,
    iterations: 5,
    useStreaming: false
  },
  {
    name: '中等数据集-常规处理',
    sampleCount: 100000,
    sampleRate: 1000000,
    channelCount: 8,
    iterations: 3,
    useStreaming: false
  },
  {
    name: '大数据集-流式处理',
    sampleCount: 500000,
    sampleRate: 1000000,
    channelCount: 8,
    iterations: 2,
    useStreaming: true,
    chunkSize: 10000
  },
  {
    name: '超大数据集-流式处理',
    sampleCount: 1000000,
    sampleRate: 10000000,
    channelCount: 16,
    iterations: 1,
    useStreaming: true,
    chunkSize: 20000
  },
  {
    name: '高采样率测试',
    sampleCount: 200000,
    sampleRate: 100000000,
    channelCount: 4,
    iterations: 3,
    useStreaming: true,
    chunkSize: 5000
  }
];
