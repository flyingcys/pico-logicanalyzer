/**
 * 解码器速度基准测试
 * 验证不同解码器的执行速度和性能表现
 */

console.log('🏃 解码器速度基准测试开始...\n');

// 模拟不同类型的解码器
class MockI2CDecoder {
  constructor() {
    this.id = 'i2c_decoder';
    this.name = 'I²C Protocol Decoder';
  }

  async decode(sampleRate, channels, options) {
    // 模拟I2C解码处理时间（基于数据量）
    const sampleCount = Math.max(...channels.map(ch => ch.samples?.length || 0));
    const processingTime = sampleCount / 100000; // 模拟每10万样本需要1ms处理时间
    
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // 模拟解码结果
    const results = [];
    const resultCount = Math.floor(sampleCount / 1000); // 每1000个样本产生1个结果
    
    for (let i = 0; i < resultCount; i++) {
      results.push({
        startSample: i * 1000,
        endSample: i * 1000 + 100,
        annotationType: i % 4, // 开始、地址、数据、停止
        values: [`I2C_${i}`],
        rawData: Math.floor(Math.random() * 256)
      });
    }

    return { results, success: true };
  }

  async streamingDecode(sampleRate, channels, options, selectedChannels) {
    // 流式处理版本
    const sampleCount = Math.max(...channels.map(ch => ch.samples?.length || 0));
    const chunkSize = 10000;
    const results = [];
    
    for (let start = 0; start < sampleCount; start += chunkSize) {
      const end = Math.min(start + chunkSize, sampleCount);
      const chunkProcessingTime = (end - start) / 100000;
      
      await new Promise(resolve => setTimeout(resolve, chunkProcessingTime));
      
      // 为每个块生成结果
      const chunkResults = Math.floor((end - start) / 1000);
      for (let i = 0; i < chunkResults; i++) {
        results.push({
          startSample: start + i * 1000,
          endSample: start + i * 1000 + 100,
          annotationType: i % 4,
          values: [`I2C_Stream_${results.length}`],
          rawData: Math.floor(Math.random() * 256)
        });
      }
    }

    return { results, success: true };
  }
}

class MockSPIDecoder {
  constructor() {
    this.id = 'spi_decoder';
    this.name = 'SPI Protocol Decoder';
  }

  async decode(sampleRate, channels, options) {
    const sampleCount = Math.max(...channels.map(ch => ch.samples?.length || 0));
    const processingTime = sampleCount / 80000; // SPI处理稍快
    
    await new Promise(resolve => setTimeout(resolve, processingTime));

    const results = [];
    const resultCount = Math.floor(sampleCount / 800); // 更高的数据密度
    
    for (let i = 0; i < resultCount; i++) {
      results.push({
        startSample: i * 800,
        endSample: i * 800 + 80,
        annotationType: i % 3, // CS、数据、结束
        values: [`SPI_${i}`],
        rawData: Math.floor(Math.random() * 256)
      });
    }

    return { results, success: true };
  }

  async streamingDecode(sampleRate, channels, options, selectedChannels) {
    const sampleCount = Math.max(...channels.map(ch => ch.samples?.length || 0));
    const chunkSize = 8000;
    const results = [];
    
    for (let start = 0; start < sampleCount; start += chunkSize) {
      const end = Math.min(start + chunkSize, sampleCount);
      const chunkProcessingTime = (end - start) / 80000;
      
      await new Promise(resolve => setTimeout(resolve, chunkProcessingTime));
      
      const chunkResults = Math.floor((end - start) / 800);
      for (let i = 0; i < chunkResults; i++) {
        results.push({
          startSample: start + i * 800,
          endSample: start + i * 800 + 80,
          annotationType: i % 3,
          values: [`SPI_Stream_${results.length}`],
          rawData: Math.floor(Math.random() * 256)
        });
      }
    }

    return { results, success: true };
  }
}

class MockUARTDecoder {
  constructor() {
    this.id = 'uart_decoder';
    this.name = 'UART Protocol Decoder';
  }

  async decode(sampleRate, channels, options) {
    const sampleCount = Math.max(...channels.map(ch => ch.samples?.length || 0));
    const processingTime = sampleCount / 120000; // UART处理最快
    
    await new Promise(resolve => setTimeout(resolve, processingTime));

    const results = [];
    const resultCount = Math.floor(sampleCount / 1200);
    
    for (let i = 0; i < resultCount; i++) {
      results.push({
        startSample: i * 1200,
        endSample: i * 1200 + 120,
        annotationType: i % 2, // 数据字节、错误
        values: [`UART_${String.fromCharCode(65 + (i % 26))}`],
        rawData: 65 + (i % 26)
      });
    }

    return { results, success: true };
  }

  async streamingDecode(sampleRate, channels, options, selectedChannels) {
    const sampleCount = Math.max(...channels.map(ch => ch.samples?.length || 0));
    const chunkSize = 12000;
    const results = [];
    
    for (let start = 0; start < sampleCount; start += chunkSize) {
      const end = Math.min(start + chunkSize, sampleCount);
      const chunkProcessingTime = (end - start) / 120000;
      
      await new Promise(resolve => setTimeout(resolve, chunkProcessingTime));
      
      const chunkResults = Math.floor((end - start) / 1200);
      for (let i = 0; i < chunkResults; i++) {
        results.push({
          startSample: start + i * 1200,
          endSample: start + i * 1200 + 120,
          annotationType: i % 2,
          values: [`UART_Stream_${String.fromCharCode(65 + (results.length % 26))}`],
          rawData: 65 + (results.length % 26)
        });
      }
    }

    return { results, success: true };
  }
}

// 模拟基准测试工具
class MockDecoderBenchmark {
  constructor() {
    this.isRunning = false;
    this.currentTest = '';
  }

  async runDecoderBenchmark(decoderId, decoderInstance, configuration) {
    const result = {
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
      console.log(`🚀 基准测试: ${decoderId} - ${configuration.name}`);
      
      // 生成测试数据
      const testData = this.generateBenchmarkData(
        configuration.sampleCount,
        configuration.channelCount
      );

      const iterationTimes = [];
      let totalResultCount = 0;
      const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // 执行多次迭代测试
      const startTime = performance.now();

      for (let i = 0; i < configuration.iterations; i++) {
        const iterationStart = performance.now();
        
        try {
          let decodeResult;
          if (configuration.useStreaming && decoderInstance.streamingDecode) {
            decodeResult = await decoderInstance.streamingDecode(
              configuration.sampleRate,
              testData,
              [],
              []
            );
          } else {
            decodeResult = await decoderInstance.decode(
              configuration.sampleRate,
              testData,
              []
            );
          }

          if (decodeResult && decodeResult.results) {
            totalResultCount += decodeResult.results.length;
          }

        } catch (error) {
          result.errors.push(`迭代 ${i + 1}: ${error.message}`);
        }

        const iterationEnd = performance.now();
        const iterationTime = iterationEnd - iterationStart;
        iterationTimes.push(iterationTime);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : startMemory;

      // 计算统计信息
      result.executionTime = totalTime;
      result.processingSpeed = (configuration.sampleCount * configuration.iterations) / (totalTime / 1000);
      result.peakMemoryUsage = endMemory - startMemory;
      result.resultCount = Math.floor(totalResultCount / configuration.iterations);
      result.success = result.errors.length === 0;

      // 计算详细统计
      const avgTime = iterationTimes.reduce((sum, time) => sum + time, 0) / iterationTimes.length;
      const variance = iterationTimes.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / iterationTimes.length;
      
      result.statistics = {
        averageIterationTime: avgTime,
        minIterationTime: Math.min(...iterationTimes),
        maxIterationTime: Math.max(...iterationTimes),
        standardDeviation: Math.sqrt(variance),
        throughput: this.calculateThroughput(configuration, totalTime)
      };

      console.log(`✅ 测试完成: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒, ${avgTime.toFixed(2)}ms平均`);

    } catch (error) {
      result.errors.push(`基准测试失败: ${error.message}`);
      console.error(`❌ 测试失败: ${decoderId}`, error);
    }

    return result;
  }

  async runBenchmarkSuite(decoders, configurations) {
    console.log(`🧪 基准测试套件开始: ${decoders.length}个解码器, ${configurations.length}个配置`);
    
    const startTime = Date.now();
    const results = [];

    const totalTests = decoders.length * configurations.length;
    let currentTest = 0;

    for (const decoder of decoders) {
      for (const config of configurations) {
        currentTest++;
        console.log(`\n📊 进度: ${currentTest}/${totalTests} - ${decoder.id} (${config.name})`);
        
        const result = await this.runDecoderBenchmark(decoder.id, decoder.instance, config);
        results.push(result);

        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // 生成报告
    const report = {
      startTime,
      endTime,
      totalDuration,
      configurations,
      results,
      rankings: this.calculateRankings(results),
      baselines: this.generateBaselines(results)
    };

    console.log(`\n🏁 基准测试套件完成，总耗时: ${(totalDuration / 1000).toFixed(1)}秒`);
    return report;
  }

  generateBenchmarkData(sampleCount, channelCount) {
    const channels = [];

    for (let i = 0; i < channelCount; i++) {
      const samples = new Uint8Array(sampleCount);
      
      for (let j = 0; j < sampleCount; j++) {
        if (i === 0) { // SCL/CLK
          samples[j] = Math.floor(j / 10) % 2;
        } else if (i === 1) { // SDA/MOSI
          samples[j] = this.generateProtocolPattern(j, 'data');
        } else {
          samples[j] = Math.random() > 0.6 ? 1 : 0;
        }
      }

      channels.push({
        channelNumber: i,
        samples,
        name: `CH${i}`
      });
    }

    return channels;
  }

  generateProtocolPattern(sampleIndex, type) {
    switch (type) {
      case 'data':
        const cycle = sampleIndex % 100;
        if (cycle < 10) return 0; // 起始
        if (cycle < 90) return (Math.floor(cycle / 10) % 2); // 数据
        return 1; // 停止
      default:
        return Math.random() > 0.5 ? 1 : 0;
    }
  }

  calculateThroughput(config, totalTime) {
    const totalBytes = config.sampleCount * config.channelCount * config.iterations;
    const totalSeconds = totalTime / 1000;
    return totalBytes / totalSeconds / (1024 * 1024); // MB/s
  }

  calculateRankings(results) {
    const successfulResults = results.filter(r => r.success);

    return {
      bySpeed: [...successfulResults].sort((a, b) => b.processingSpeed - a.processingSpeed),
      byMemoryEfficiency: [...successfulResults].sort((a, b) => a.peakMemoryUsage - b.peakMemoryUsage),
      byThroughput: [...successfulResults].sort((a, b) => b.statistics.throughput - a.statistics.throughput)
    };
  }

  generateBaselines(results) {
    const baselines = {};
    const decoderGroups = new Map();
    
    results.forEach(result => {
      if (!decoderGroups.has(result.decoderId)) {
        decoderGroups.set(result.decoderId, []);
      }
      decoderGroups.get(result.decoderId).push(result);
    });

    decoderGroups.forEach((decoderResults, decoderId) => {
      const successfulResults = decoderResults.filter(r => r.success);
      
      if (successfulResults.length > 0) {
        const avgSpeed = successfulResults.reduce((sum, r) => sum + r.processingSpeed, 0) / successfulResults.length;
        const avgMemory = successfulResults.reduce((sum, r) => sum + r.peakMemoryUsage, 0) / successfulResults.length;
        const successRate = successfulResults.length / decoderResults.length;

        baselines[decoderId] = {
          expectedSpeed: avgSpeed,
          acceptableMemory: avgMemory * 1.2,
          reliabilityScore: successRate * 100
        };
      }
    });

    return baselines;
  }

  generateReport(report) {
    let reportText = '# 解码器性能基准测试报告\n\n';
    
    reportText += '## 测试概览\n';
    reportText += `- 测试时间: ${new Date(report.startTime).toLocaleString()}\n`;
    reportText += `- 总耗时: ${(report.totalDuration / 1000).toFixed(1)}秒\n`;
    reportText += `- 测试数: ${report.results.length}\n`;
    reportText += `- 成功率: ${(report.results.filter(r => r.success).length / report.results.length * 100).toFixed(1)}%\n\n`;

    reportText += '## 处理速度排名 (前3名)\n';
    report.rankings.bySpeed.slice(0, 3).forEach((result, index) => {
      reportText += `${index + 1}. ${result.decoderId}: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒 (${result.configuration.name})\n`;
    });
    reportText += '\n';

    reportText += '## 内存效率排名 (前3名)\n';
    report.rankings.byMemoryEfficiency.slice(0, 3).forEach((result, index) => {
      reportText += `${index + 1}. ${result.decoderId}: ${(result.peakMemoryUsage / 1024).toFixed(1)}KB (${result.configuration.name})\n`;
    });
    reportText += '\n';

    reportText += '## 性能基线\n';
    Object.entries(report.baselines).forEach(([decoderId, baseline]) => {
      reportText += `### ${decoderId}\n`;
      reportText += `- 期望速度: ${(baseline.expectedSpeed / 1000).toFixed(1)}K样本/秒\n`;
      reportText += `- 内存限制: ${(baseline.acceptableMemory / 1024).toFixed(1)}KB\n`;
      reportText += `- 可靠性: ${baseline.reliabilityScore.toFixed(1)}%\n\n`;
    });

    return reportText;
  }
}

// 预定义测试配置
const benchmarkConfigurations = [
  {
    name: '小数据集测试',
    sampleCount: 10000,
    sampleRate: 1000000,
    channelCount: 8,
    iterations: 5,
    useStreaming: false
  },
  {
    name: '中等数据集测试',
    sampleCount: 100000,
    sampleRate: 1000000,
    channelCount: 8,
    iterations: 3,
    useStreaming: false
  },
  {
    name: '大数据集流式测试',
    sampleCount: 500000,
    sampleRate: 1000000,
    channelCount: 8,
    iterations: 2,
    useStreaming: true,
    chunkSize: 10000
  },
  {
    name: '高采样率测试',
    sampleCount: 200000,
    sampleRate: 10000000,
    channelCount: 4,
    iterations: 2,
    useStreaming: true,
    chunkSize: 5000
  }
];

// 运行基准测试
async function runDecoderBenchmarkTest() {
  console.log('🔧 解码器速度基准测试开始\n');

  // 创建解码器实例
  const decoders = [
    { id: 'i2c_decoder', instance: new MockI2CDecoder() },
    { id: 'spi_decoder', instance: new MockSPIDecoder() },
    { id: 'uart_decoder', instance: new MockUARTDecoder() }
  ];

  const benchmark = new MockDecoderBenchmark();

  try {
    // 运行完整的基准测试套件
    const report = await benchmark.runBenchmarkSuite(decoders, benchmarkConfigurations);

    console.log('\n📊 基准测试报告生成...');
    
    // 显示测试结果摘要
    console.log('\n🏆 性能排名总结:');
    console.log('\n📈 处理速度排名:');
    report.rankings.bySpeed.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.decoderId}: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒 (${result.configuration.name})`);
    });

    console.log('\n💾 内存效率排名:');
    report.rankings.byMemoryEfficiency.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.decoderId}: ${(result.peakMemoryUsage / 1024).toFixed(1)}KB (${result.configuration.name})`);
    });

    console.log('\n⚡ 吞吐量排名:');
    report.rankings.byThroughput.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.decoderId}: ${result.statistics.throughput.toFixed(2)}MB/s (${result.configuration.name})`);
    });

    console.log('\n📋 性能基线设定:');
    Object.entries(report.baselines).forEach(([decoderId, baseline]) => {
      console.log(`  ${decoderId}:`);
      console.log(`    期望处理速度: ${(baseline.expectedSpeed / 1000).toFixed(1)}K样本/秒`);
      console.log(`    可接受内存使用: ${(baseline.acceptableMemory / 1024).toFixed(1)}KB`);
      console.log(`    可靠性评分: ${baseline.reliabilityScore.toFixed(1)}%`);
    });

    console.log('\n📊 详细性能数据:');
    const performanceByDecoder = new Map();
    
    report.results.forEach(result => {
      if (!performanceByDecoder.has(result.decoderId)) {
        performanceByDecoder.set(result.decoderId, []);
      }
      performanceByDecoder.get(result.decoderId).push(result);
    });

    performanceByDecoder.forEach((results, decoderId) => {
      console.log(`\n🔧 ${decoderId} 性能详情:`);
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${result.configuration.name}:`);
        console.log(`     执行时间: ${result.executionTime.toFixed(2)}ms`);
        console.log(`     处理速度: ${(result.processingSpeed / 1000).toFixed(1)}K样本/秒`);
        console.log(`     内存使用: ${(result.peakMemoryUsage / 1024).toFixed(1)}KB`);
        console.log(`     结果数量: ${result.resultCount}`);
        console.log(`     标准差: ${result.statistics.standardDeviation.toFixed(2)}ms`);
        if (result.errors.length > 0) {
          console.log(`     错误: ${result.errors.join(', ')}`);
        }
      });
    });

    // 性能比较分析
    console.log('\n🔍 性能比较分析:');
    
    const avgSpeedByDecoder = new Map();
    performanceByDecoder.forEach((results, decoderId) => {
      const successfulResults = results.filter(r => r.success);
      if (successfulResults.length > 0) {
        const avgSpeed = successfulResults.reduce((sum, r) => sum + r.processingSpeed, 0) / successfulResults.length;
        avgSpeedByDecoder.set(decoderId, avgSpeed);
      }
    });

    const speedEntries = Array.from(avgSpeedByDecoder.entries()).sort((a, b) => b[1] - a[1]);
    console.log('\n⚡ 平均处理速度对比:');
    speedEntries.forEach(([decoderId, avgSpeed], index) => {
      const relativeSpeed = index === 0 ? '基准' : `${(avgSpeed / speedEntries[0][1] * 100).toFixed(1)}%`;
      console.log(`  ${decoderId}: ${(avgSpeed / 1000).toFixed(1)}K样本/秒 (${relativeSpeed})`);
    });

    // 测试结论
    console.log('\n🎯 测试结论:');
    const fastestDecoder = speedEntries[0][0];
    const mostMemoryEfficient = report.rankings.byMemoryEfficiency[0].decoderId;
    const highestThroughput = report.rankings.byThroughput[0].decoderId;
    
    console.log(`  🏃 最快解码器: ${fastestDecoder}`);
    console.log(`  💾 内存最优: ${mostMemoryEfficient}`);
    console.log(`  ⚡ 吞吐量最高: ${highestThroughput}`);
    
    const successfulTests = report.results.filter(r => r.success).length;
    const totalTests = report.results.length;
    console.log(`  ✅ 测试成功率: ${(successfulTests / totalTests * 100).toFixed(1)}% (${successfulTests}/${totalTests})`);

    console.log('\n📈 性能优化建议:');
    speedEntries.forEach(([decoderId, avgSpeed], index) => {
      if (index > 0) {
        const improvementPotential = ((speedEntries[0][1] - avgSpeed) / avgSpeed * 100);
        if (improvementPotential > 20) {
          console.log(`  🔧 ${decoderId}: 可优化 ${improvementPotential.toFixed(1)}% 处理速度`);
        }
      }
    });

    console.log('\n✅ 解码器速度基准测试完成!');
    console.log('📊 基准测试功能验证:');
    console.log('  ✅ 多解码器性能测试');
    console.log('  ✅ 不同数据集规模测试');
    console.log('  ✅ 流式处理性能测试');
    console.log('  ✅ 内存使用监控');
    console.log('  ✅ 性能排名和比较');
    console.log('  ✅ 基线设定和分析');
    console.log('  ✅ 详细性能统计');
    console.log('  ✅ 性能优化建议');

    return {
      success: true,
      totalTests: report.results.length,
      successfulTests,
      successRate: (successfulTests / totalTests) * 100,
      averageProcessingSpeed: speedEntries.reduce((sum, [, speed]) => sum + speed, 0) / speedEntries.length,
      fastestDecoder,
      mostMemoryEfficient,
      highestThroughput,
      performanceBaselines: report.baselines
    };

  } catch (error) {
    console.error('❌ 基准测试执行失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行测试
runDecoderBenchmarkTest().then(result => {
  if (result.success) {
    console.log('\n🎉 所有基准测试通过！');
    console.log('📈 测试结果汇总:');
    console.log(`  总测试数: ${result.totalTests}`);
    console.log(`  成功测试数: ${result.successfulTests}`);
    console.log(`  成功率: ${result.successRate.toFixed(1)}%`);
    console.log(`  平均处理速度: ${(result.averageProcessingSpeed / 1000).toFixed(1)}K样本/秒`);
    console.log(`  性能最佳解码器: ${result.fastestDecoder}`);
    console.log(`  内存效率最佳: ${result.mostMemoryEfficient}`);
    console.log(`  吞吐量最佳: ${result.highestThroughput}`);
    console.log('');
    console.log('🚀 解码器基准测试系统已准备就绪，可用于性能评估和优化指导！');
  } else {
    console.log('\n❌ 基准测试失败');
    console.log(`错误信息: ${result.error}`);
  }
}).catch(error => {
  console.error('\n💥 测试执行异常:', error);
});