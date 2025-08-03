/**
 * 协议解码器性能基准测试
 * 测试大数据量、高采样率条件下的解码器性能
 */

import '../../setup';
import '../../matchers';
import { SignalGenerator, TestUtils } from '../../mocks';
import { I2CDecoder } from '../../../src/decoders/protocols/I2CDecoder';
import { SPIDecoder } from '../../../src/decoders/protocols/SPIDecoder';
import { UARTDecoder } from '../../../src/decoders/protocols/UARTDecoder';
import { ChannelData, DecoderOptionValue } from '../../../src/decoders/types';

interface PerformanceMetrics {
  decoderName: string;
  dataSize: number;
  sampleRate: number;
  decodeTime: number;
  memoryBefore: number;
  memoryAfter: number;
  memoryGrowth: number;
  throughput: number; // bytes per second
  resultsCount: number;
}

class DecoderPerformanceTester {
  private metrics: PerformanceMetrics[] = [];
  
  /**
   * 测试解码器性能
   */
  async testDecoder(
    decoderName: string,
    decoder: any,
    channels: ChannelData[],
    options: DecoderOptionValue[],
    sampleRate: number,
    dataSize: number
  ): Promise<PerformanceMetrics> {
    // 强制垃圾收集以获得准确的内存基线
    if (global.gc) {
      global.gc();
    }
    
    const memoryBefore = process.memoryUsage().heapUsed;
    const startTime = process.hrtime.bigint();
    
    const results = decoder.decode(sampleRate, channels, options);
    
    const endTime = process.hrtime.bigint();
    const decodeTime = Number(endTime - startTime) / 1000000; // 转换为毫秒
    
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryGrowth = memoryAfter - memoryBefore;
    const throughput = (dataSize * 1000) / decodeTime; // bytes per second
    
    const metrics: PerformanceMetrics = {
      decoderName,
      dataSize,
      sampleRate,
      decodeTime,
      memoryBefore,
      memoryAfter,
      memoryGrowth,
      throughput,
      resultsCount: results.length
    };
    
    this.metrics.push(metrics);
    return metrics;
  }
  
  /**
   * 生成性能报告
   */
  generateReport(): string {
    const report = [`
# 协议解码器性能基准测试报告

测试时间: ${new Date().toLocaleString('zh-CN')}
测试环境: Node.js ${process.version}

## 测试结果摘要

| 解码器 | 数据大小 | 采样率 | 解码时间(ms) | 内存增长(KB) | 吞吐量(KB/s) | 结果数量 |
|--------|----------|--------|--------------|--------------|-------------|----------|`];
    
    for (const metric of this.metrics) {
      report.push(
        `| ${metric.decoderName} | ${metric.dataSize} bytes | ${(metric.sampleRate / 1000000).toFixed(1)}MHz | ${metric.decodeTime.toFixed(2)} | ${(metric.memoryGrowth / 1024).toFixed(1)} | ${(metric.throughput / 1024).toFixed(1)} | ${metric.resultsCount} |`
      );
    }
    
    report.push(`

## 性能分析

### 解码时间分析
${this.analyzeDecodeTime()}

### 内存使用分析
${this.analyzeMemoryUsage()}

### 吞吐量分析
${this.analyzeThroughput()}

## 建议

${this.generateRecommendations()}
`);
    
    return report.join('\n');
  }
  
  private analyzeDecodeTime(): string {
    const analysis = [];
    const avgTimes = new Map<string, number>();
    
    // 计算每个解码器的平均解码时间
    for (const metric of this.metrics) {
      if (!avgTimes.has(metric.decoderName)) {
        avgTimes.set(metric.decoderName, 0);
      }
      avgTimes.set(metric.decoderName, avgTimes.get(metric.decoderName)! + metric.decodeTime);
    }
    
    const decoderCounts = new Map<string, number>();
    for (const metric of this.metrics) {
      decoderCounts.set(metric.decoderName, (decoderCounts.get(metric.decoderName) || 0) + 1);
    }
    
    for (const [decoder, totalTime] of avgTimes) {
      const count = decoderCounts.get(decoder) || 1;
      const avgTime = totalTime / count;
      analysis.push(`- ${decoder}: 平均 ${avgTime.toFixed(2)}ms`);
    }
    
    return analysis.join('\n');
  }
  
  private analyzeMemoryUsage(): string {
    const analysis = [];
    const memoryStats = new Map<string, { total: number; count: number; max: number }>();
    
    for (const metric of this.metrics) {
      if (!memoryStats.has(metric.decoderName)) {
        memoryStats.set(metric.decoderName, { total: 0, count: 0, max: 0 });
      }
      const stats = memoryStats.get(metric.decoderName)!;
      stats.total += metric.memoryGrowth;
      stats.count++;
      stats.max = Math.max(stats.max, metric.memoryGrowth);
    }
    
    for (const [decoder, stats] of memoryStats) {
      const avgMemory = stats.total / stats.count;
      analysis.push(`- ${decoder}: 平均 ${(avgMemory / 1024).toFixed(1)}KB, 最大 ${(stats.max / 1024).toFixed(1)}KB`);
    }
    
    return analysis.join('\n');
  }
  
  private analyzeThroughput(): string {
    const analysis = [];
    const throughputStats = new Map<string, { total: number; count: number; max: number }>();
    
    for (const metric of this.metrics) {
      if (!throughputStats.has(metric.decoderName)) {
        throughputStats.set(metric.decoderName, { total: 0, count: 0, max: 0 });
      }
      const stats = throughputStats.get(metric.decoderName)!;
      stats.total += metric.throughput;
      stats.count++;
      stats.max = Math.max(stats.max, metric.throughput);
    }
    
    for (const [decoder, stats] of throughputStats) {
      const avgThroughput = stats.total / stats.count;
      analysis.push(`- ${decoder}: 平均 ${(avgThroughput / 1024).toFixed(1)}KB/s, 最大 ${(stats.max / 1024).toFixed(1)}KB/s`);
    }
    
    return analysis.join('\n');
  }
  
  private generateRecommendations(): string {
    const recommendations = ['### 性能优化建议:'];
    
    // 检查是否有性能问题
    const slowDecoders = this.metrics.filter(m => m.decodeTime > 1000);
    if (slowDecoders.length > 0) {
      recommendations.push('- 以下解码器解码时间超过1秒，建议优化:');
      for (const decoder of slowDecoders) {
        recommendations.push(`  - ${decoder.decoderName}: ${decoder.decodeTime.toFixed(2)}ms`);
      }
    }
    
    // 检查内存使用
    const highMemoryDecoders = this.metrics.filter(m => m.memoryGrowth > 10 * 1024 * 1024);
    if (highMemoryDecoders.length > 0) {
      recommendations.push('- 以下解码器内存使用过高(>10MB)，建议优化:');
      for (const decoder of highMemoryDecoders) {
        recommendations.push(`  - ${decoder.decoderName}: ${(decoder.memoryGrowth / 1024 / 1024).toFixed(1)}MB`);
      }
    }
    
    // 检查吞吐量
    const lowThroughputDecoders = this.metrics.filter(m => m.throughput < 100 * 1024);
    if (lowThroughputDecoders.length > 0) {
      recommendations.push('- 以下解码器吞吐量过低(<100KB/s)，建议优化:');
      for (const decoder of lowThroughputDecoders) {
        recommendations.push(`  - ${decoder.decoderName}: ${(decoder.throughput / 1024).toFixed(1)}KB/s`);
      }
    }
    
    if (recommendations.length === 1) {
      recommendations.push('- 所有解码器性能表现良好！');
    }
    
    return recommendations.join('\n');
  }
  
  /**
   * 清除测试指标
   */
  clear(): void {
    this.metrics = [];
  }
}

describe('协议解码器性能基准测试', () => {
  let performanceTester: DecoderPerformanceTester;
  
  beforeAll(() => {
    performanceTester = new DecoderPerformanceTester();
  });
  
  afterAll(() => {
    // 生成并保存性能报告
    const report = performanceTester.generateReport();
    console.log(report);
    
    // 可选：保存到文件
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../../docs/decoder-performance-report.md');
    try {
      fs.writeFileSync(reportPath, report);
      console.log(`\n性能报告已保存到: ${reportPath}`);
    } catch (error) {
      console.warn('保存性能报告失败:', error);
    }
  });
  
  describe('I2C解码器性能测试', () => {
    it('小数据量性能测试 (1KB)', async () => {
      const decoder = new I2CDecoder();
      const testData = Array.from({ length: 256 }, (_, i) => i % 256);
      const channels = generateI2CTestData(0x48, testData);
      
      const metrics = await performanceTester.testDecoder(
        'I2C-1KB',
        decoder,
        channels,
        [],
        1_000_000, // 1MHz
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(500); // 500ms以内
      expect(metrics.memoryGrowth).toBeLessThan(5 * 1024 * 1024); // 5MB以内
    });
    
    it('中等数据量性能测试 (10KB)', async () => {
      const decoder = new I2CDecoder();
      const testData = Array.from({ length: 2560 }, (_, i) => i % 256);
      const channels = generateI2CTestData(0x48, testData);
      
      const metrics = await performanceTester.testDecoder(
        'I2C-10KB',
        decoder,
        channels,
        [],
        10_000_000, // 10MHz
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(2000); // 2秒以内
      expect(metrics.memoryGrowth).toBeLessThan(20 * 1024 * 1024); // 20MB以内
    });
    
    it('大数据量性能测试 (100KB)', async () => {
      const decoder = new I2CDecoder();
      const testData = Array.from({ length: 25600 }, (_, i) => i % 256);
      const channels = generateI2CTestData(0x48, testData);
      
      const metrics = await performanceTester.testDecoder(
        'I2C-100KB',
        decoder,
        channels,
        [],
        100_000_000, // 100MHz
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(10000); // 10秒以内
      expect(metrics.memoryGrowth).toBeLessThan(100 * 1024 * 1024); // 100MB以内
      expect(metrics.throughput).toBeGreaterThan(10 * 1024); // 至少10KB/s
    });
  });
  
  describe('SPI解码器性能测试', () => {
    it('高频SPI传输性能测试', async () => {
      const decoder = new SPIDecoder();
      const testData = Array.from({ length: 1024 }, (_, i) => i % 256);
      const channels = generateSPITestData(testData);
      
      const metrics = await performanceTester.testDecoder(
        'SPI-HighFreq',
        decoder,
        channels,
        [],
        100_000_000, // 100MHz采样率
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(1000);
      expect(metrics.resultsCount).toBeGreaterThan(0);
    });
    
    it('大量SPI数据传输性能测试', async () => {
      const decoder = new SPIDecoder();
      const testData = Array.from({ length: 10240 }, (_, i) => i % 256); // 10KB
      const channels = generateSPITestData(testData);
      
      const metrics = await performanceTester.testDecoder(
        'SPI-LargeData',
        decoder,
        channels,
        [],
        50_000_000, // 50MHz
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(5000);
      expect(metrics.throughput).toBeGreaterThan(1024); // 至少1KB/s
    });
  });
  
  describe('UART解码器性能测试', () => {
    it('高波特率UART性能测试', async () => {
      const decoder = new UARTDecoder();
      const testData = Array.from({ length: 1024 }, (_, i) => i % 256);
      const channels = generateUARTTestData(testData, 921600); // 921.6K波特率
      
      const metrics = await performanceTester.testDecoder(
        'UART-HighBaud',
        decoder,
        channels,
        [{ optionIndex: 0, value: '921600' }],
        24_000_000, // 24MHz
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(2000);
      expect(metrics.resultsCount).toBeGreaterThan(testData.length); // 应该包含帧结构
    });
    
    it('长消息UART解码性能测试', async () => {
      const decoder = new UARTDecoder();
      const longMessage = "A".repeat(5000); // 5000字符的长消息
      const testData = Array.from(longMessage).map(c => c.charCodeAt(0));
      const channels = generateUARTTestData(testData, 115200);
      
      const metrics = await performanceTester.testDecoder(
        'UART-LongMessage',
        decoder,
        channels,
        [{ optionIndex: 0, value: '115200' }],
        24_000_000,
        testData.length
      );
      
      expect(metrics.decodeTime).toBeWithinPerformanceBudget(3000);
      expect(metrics.memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB以内
    });
  });
  
  describe('多解码器并发性能测试', () => {
    it('并发解码性能测试', async () => {
      const testData = Array.from({ length: 512 }, (_, i) => i % 256);
      
      const tasks = [
        {
          name: 'I2C-Concurrent',
          decoder: new I2CDecoder(),
          channels: generateI2CTestData(0x48, testData),
          options: []
        },
        {
          name: 'SPI-Concurrent',
          decoder: new SPIDecoder(),
          channels: generateSPITestData(testData),
          options: []
        },
        {
          name: 'UART-Concurrent',
          decoder: new UARTDecoder(),
          channels: generateUARTTestData(testData, 115200),
          options: [{ optionIndex: 0, value: '115200' }]
        }
      ];
      
      const startTime = Date.now();
      
      // 并发执行所有解码任务
      const results = await Promise.all(
        tasks.map(task =>
          performanceTester.testDecoder(
            task.name,
            task.decoder,
            task.channels,
            task.options,
            24_000_000,
            testData.length
          )
        )
      );
      
      const totalTime = Date.now() - startTime;
      
      // 并发执行时间应该比串行执行快
      const serialTime = results.reduce((sum, metric) => sum + metric.decodeTime, 0);
      expect(totalTime).toBeLessThan(serialTime * 0.8); // 至少快20%
      
      // 验证所有解码器都成功完成
      for (const result of results) {
        expect(result.resultsCount).toBeGreaterThan(0);
      }
    });
  });
  
  describe('内存压力测试', () => {
    it('连续解码内存稳定性测试', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const decoder = new I2CDecoder();
      
      // 连续解码50次，检查内存是否稳定
      for (let i = 0; i < 50; i++) {
        const testData = Array.from({ length: 100 }, (_, j) => (i + j) % 256);
        const channels = generateI2CTestData(0x48, testData);
        
        decoder.decode(24_000_000, channels, []);
        
        // 每10次检查一次内存
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      expect({ memoryGrowth, leakDetected: memoryGrowth > 50 * 1024 * 1024 })
        .toHaveMemoryLeakBelow(50 * 1024 * 1024); // 50MB阈值
    });
  });
});

// 辅助函数：生成测试数据
function generateI2CTestData(address: number, data: number[]): ChannelData[] {
  const channels = SignalGenerator.generateI2C({
    sampleRate: 24_000_000,
    totalSamples: Math.max(50000, data.length * 1000),
    channelCount: 8,
    clockChannel: 0,
    dataChannel: 1,
    address,
    isRead: false,
    data,
    useStartStop: true
  });

  return [
    { samples: channels[0], channelNumber: 0, channelName: 'SCL' },
    { samples: channels[1], channelNumber: 1, channelName: 'SDA' }
  ];
}

function generateSPITestData(data: number[]): ChannelData[] {
  const channels = SignalGenerator.generateSPI({
    sampleRate: 24_000_000,
    totalSamples: Math.max(50000, data.length * 1000),
    channelCount: 8,
    clockChannel: 0,
    mosiChannel: 1,
    misoChannel: 2,
    csChannel: 3,
    data,
    clockPolarity: 'idle-low',
    clockPhase: 'first-edge',
    bitOrder: 'msb-first'
  });

  return [
    { samples: channels[0], channelNumber: 0, channelName: 'CLK' },
    { samples: channels[1], channelNumber: 1, channelName: 'MOSI' },
    { samples: channels[2], channelNumber: 2, channelName: 'MISO' },
    { samples: channels[3], channelNumber: 3, channelName: 'CS' }
  ];
}

function generateUARTTestData(data: number[], baudRate = 115200): ChannelData[] {
  const channels = SignalGenerator.generateUART({
    sampleRate: 24_000_000,
    totalSamples: Math.max(50000, data.length * 1000),
    channelCount: 8,
    txChannel: 0,
    rxChannel: 1,
    baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    data
  });

  return [
    { samples: channels[0], channelNumber: 0, channelName: 'TX' },
    { samples: channels[1], channelNumber: 1, channelName: 'RX' }
  ];
}