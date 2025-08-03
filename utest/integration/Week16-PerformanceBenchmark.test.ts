/**
 * Week 16: 性能基准测试套件
 * 验证系统性能指标达标，确保产品级质量
 * 
 * 性能目标：
 * - 设备连接: < 2秒
 * - 数据采集: 100万样本 < 5秒  
 * - 协议解码: 10万样本 < 1秒
 * - 文件I/O: 100万样本 < 3秒
 * - 内存使用: 24小时运行 < 100MB增长
 * - 波形渲染: 100万数据点 @ 60fps
 */

import { PerformanceBenchmark, PerformanceAssertions } from './PerformanceBenchmark';
import { HardwareSimulator } from './HardwareSimulator.enhanced';
import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { I2CDecoder } from '../../src/decoders/protocols/I2CDecoder';
import { SPIDecoder } from '../../src/decoders/protocols/SPIDecoder';
import { UARTDecoder } from '../../src/decoders/protocols/UARTDecoder';
import { LACFileFormat } from '../../src/models/LACFileFormat';
import { DataExportService } from '../../src/services/DataExportService';
import { CaptureSession, AnalyzerChannel } from '../../src/models/CaptureModels';
import { TriggerType } from '../../src/models/AnalyzerTypes';
import * as fs from 'fs';
import * as path from 'path';

describe('Week 16: 性能基准测试套件', () => {
  let performanceBenchmark: PerformanceBenchmark;
  let hardwareSimulator: HardwareSimulator;
  let testDataDir: string;
  
  const PERFORMANCE_TARGETS = {
    deviceConnection: 2000,    // 2秒
    dataCapture1M: 5000,      // 5秒处理100万样本
    protocolDecode100K: 1000, // 1秒解码10万样本
    fileIO1M: 3000,           // 3秒文件I/O 100万样本
    memoryGrowth24h: 100,     // 100MB内存增长限制
    waveformRender: 16.67     // 60fps = 16.67ms per frame
  };

  beforeAll(async () => {
    testDataDir = path.join(__dirname, '../fixtures/week16-performance');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    performanceBenchmark = new PerformanceBenchmark();
    hardwareSimulator = new HardwareSimulator();
    
    await hardwareSimulator.startSimulation({
      deviceType: 'pico-logic-analyzer',
      channelCount: 24,
      maxSampleRate: 100000000,
      supportedProtocols: ['I2C', 'SPI', 'UART']
    });
  }, 15000);

  afterAll(async () => {
    if (hardwareSimulator) {
      await hardwareSimulator.stopSimulation();
    }
    
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    // 输出详细性能报告
    const report = performanceBenchmark.getReport();
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Week 16 性能基准测试报告');
    console.log('='.repeat(60));
    console.log(`📊 测试总览:`);
    console.log(`   总测试数量: ${report.summary.totalTests}`);
    console.log(`   成功测试: ${report.summary.successfulTests}`);
    console.log(`   失败测试: ${report.summary.failedTests}`);
    console.log(`   成功率: ${((report.summary.successfulTests / report.summary.totalTests) * 100).toFixed(1)}%`);
    
    console.log(`\n⏱️  性能指标:`);
    console.log(`   平均执行时间: ${report.summary.averageDuration.toFixed(2)}ms`);
    console.log(`   总执行时间: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    
    console.log(`\n🧠 内存分析:`);
    console.log(`   峰值内存使用: ${(report.memoryAnalysis.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   平均内存使用: ${(report.memoryAnalysis.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   内存增长趋势: ${report.memoryAnalysis.memoryGrowthTrend ? '是' : '否'}`);
    
    console.log(`\n🎯 性能目标达成情况:`);
    const passedTests = report.results.filter(r => r.success).length;
    const totalTests = report.results.length;
    console.log(`   达标测试: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
    
    console.log('='.repeat(60));
  }, 10000);

  describe('1. 设备连接性能测试', () => {
    it('🔌 串口设备连接速度', async () => {
      const connectionResult = await performanceBenchmark.runBenchmark(
        'SerialDeviceConnection',
        async () => {
          const driver = new LogicAnalyzerDriver('MOCK_SERIAL_DEVICE');
          
          const result = await driver.connect({
            connectionString: '/dev/ttyUSB0',
            baudRate: 115200,
            timeout: 5000
          });
          
          expect(result.success).toBe(true);
          return result;
        }
      );
      
      // 验证连接时间 < 2秒
      PerformanceAssertions.assertExecutionTime(
        connectionResult, 
        PERFORMANCE_TARGETS.deviceConnection
      );
      
      console.log(`✅ 串口连接时间: ${connectionResult.duration.toFixed(2)}ms (目标: <${PERFORMANCE_TARGETS.deviceConnection}ms)`);
    });

    it('🌐 网络设备连接速度', async () => {
      const networkConnectionResult = await performanceBenchmark.runBenchmark(
        'NetworkDeviceConnection',
        async () => {
          // 添加模拟网络设备
          hardwareSimulator.addNetworkDevice({
            ip: '192.168.1.100',
            port: 8080,
            deviceType: 'pico-logic-analyzer-wifi'
          });
          
          const driver = new LogicAnalyzerDriver('192.168.1.100:8080');
          
          const result = await driver.connect({
            connectionString: '192.168.1.100:8080',
            timeout: 5000
          });
          
          expect(result.success).toBe(true);
          return result;
        }
      );
      
      // 网络连接允许稍长时间
      PerformanceAssertions.assertExecutionTime(
        networkConnectionResult, 
        PERFORMANCE_TARGETS.deviceConnection * 2
      );
      
      console.log(`✅ 网络连接时间: ${networkConnectionResult.duration.toFixed(2)}ms (目标: <${PERFORMANCE_TARGETS.deviceConnection * 2}ms)`);
    });

    it('🔄 连接重试和恢复性能', async () => {
      const retryResult = await performanceBenchmark.runBenchmark(
        'ConnectionRetryPerformance',
        async () => {
          const driver = new LogicAnalyzerDriver('UNRELIABLE_DEVICE');
          let attempts = 0;
          let success = false;
          
          // 模拟3次重试
          while (attempts < 3 && !success) {
            attempts++;
            try {
              const result = await driver.connect({
                connectionString: 'MOCK_RETRY_DEVICE',
                timeout: 1000
              });
              success = result.success;
            } catch (error) {
              // 预期的连接失败
            }
          }
          
          expect(attempts).toBeLessThanOrEqual(3);
          return { attempts, success };
        }
      );
      
      // 重试机制应该在6秒内完成
      PerformanceAssertions.assertExecutionTime(retryResult, 6000);
      
      console.log(`✅ 连接重试时间: ${retryResult.duration.toFixed(2)}ms (3次重试)`);
    });
  });

  describe('2. 数据采集性能测试', () => {
    it('📊 大数据量采集性能 (100万样本)', async () => {
      const largeCaptureResult = await performanceBenchmark.runBenchmark(
        'LargeDataCapture_1M',
        async () => {
          const session = new CaptureSession();
          session.frequency = 100000000; // 100MHz
          session.postTriggerSamples = 1000000; // 100万样本
          session.captureChannels = [
            new AnalyzerChannel(0, 'CH0'),
            new AnalyzerChannel(1, 'CH1'),
            new AnalyzerChannel(2, 'CH2'),
            new AnalyzerChannel(3, 'CH3')
          ];
          
          // 生成100万样本的测试数据
          const largeData = hardwareSimulator.generateLargeDataSet(1000000, 4);
          session.captureChannels[0].samples = largeData.channel0;
          session.captureChannels[1].samples = largeData.channel1;
          session.captureChannels[2].samples = largeData.channel2;
          session.captureChannels[3].samples = largeData.channel3;
          
          const driver = new LogicAnalyzerDriver('PERFORMANCE_TEST_DEVICE');
          
          const startResult = await driver.connect({ connectionString: 'MOCK' });
          expect(startResult.success).toBe(true);
          
          const captureResult = await driver.startCapture(session);
          expect(captureResult.success).toBe(true);
          
          // 模拟数据传输时间
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const stopResult = await driver.stopCapture();
          expect(stopResult.success).toBe(true);
          
          return { sampleCount: 1000000, channelCount: 4 };
        }
      );
      
      // 验证100万样本采集 < 5秒
      PerformanceAssertions.assertExecutionTime(
        largeCaptureResult, 
        PERFORMANCE_TARGETS.dataCapture1M
      );
      
      const samplesPerSecond = 1000000 / (largeCaptureResult.duration / 1000);
      console.log(`✅ 大数据采集性能: ${largeCaptureResult.duration.toFixed(2)}ms`);
      console.log(`   处理速度: ${(samplesPerSecond / 1000000).toFixed(2)}M 样本/秒`);
    });

    it('⚡ 高频采集性能 (100MHz采样率)', async () => {
      const highFreqResult = await performanceBenchmark.runBenchmark(
        'HighFrequencyCapture',
        async () => {
          const session = new CaptureSession();
          session.frequency = 100000000; // 100MHz采样率
          session.postTriggerSamples = 100000; // 10万样本
          session.captureChannels = Array.from({ length: 8 }, (_, i) => 
            new AnalyzerChannel(i, `CH${i}`)
          );
          
          // 生成高频测试数据
          const highFreqData = hardwareSimulator.generateLargeDataSet(100000, 8);
          session.captureChannels.forEach((channel, index) => {
            channel.samples = highFreqData[`channel${index}`];
          });
          
          const driver = new LogicAnalyzerDriver('HIGH_FREQ_DEVICE');
          await driver.connect({ connectionString: 'MOCK' });
          
          const result = await driver.startCapture(session);
          expect(result.success).toBe(true);
          
          await driver.stopCapture();
          
          return { frequency: session.frequency, samples: 100000, channels: 8 };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(highFreqResult, 2000); // 2秒内完成
      
      const dataRate = (100000 * 8) / (highFreqResult.duration / 1000); // 样本/秒
      console.log(`✅ 高频采集性能: ${highFreqResult.duration.toFixed(2)}ms`);
      console.log(`   数据速率: ${(dataRate / 1000000).toFixed(2)}M 样本/秒`);
    });

    it('🔄 连续采集稳定性测试', async () => {
      const continuousResult = await performanceBenchmark.runBenchmark(
        'ContinuousCapture',
        async () => {
          const driver = new LogicAnalyzerDriver('CONTINUOUS_DEVICE');
          await driver.connect({ connectionString: 'MOCK' });
          
          const results = [];
          
          // 执行10次连续采集
          for (let i = 0; i < 10; i++) {
            const session = new CaptureSession();
            session.frequency = 25000000;
            session.postTriggerSamples = 10000;
            session.captureChannels = [new AnalyzerChannel(0, `Test${i}`)];
            
            const testData = hardwareSimulator.generateRandomData(10000);
            session.captureChannels[0].samples = testData;
            
            const startTime = performance.now();
            const captureResult = await driver.startCapture(session);
            await driver.stopCapture();
            const endTime = performance.now();
            
            results.push({
              iteration: i + 1,
              duration: endTime - startTime,
              success: captureResult.success
            });
          }
          
          const successCount = results.filter(r => r.success).length;
          const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
          
          expect(successCount).toBe(10); // 所有采集都应该成功
          
          return { successCount, avgDuration, results };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(continuousResult, 10000); // 10秒内完成
      
      console.log(`✅ 连续采集稳定性: ${continuousResult.duration.toFixed(2)}ms (10次循环)`);
    });
  });

  describe('3. 协议解码性能测试', () => {
    it('🔌 I2C解码性能 (10万样本)', async () => {
      const i2cDecodeResult = await performanceBenchmark.runBenchmark(
        'I2CDecodePerformance_100K',
        async () => {
          const decoder = new I2CDecoder();
          
          // 生成10万样本的I2C数据
          const i2cData = hardwareSimulator.generateI2CData({
            address: 0x50,
            data: Array.from({ length: 1000 }, (_, i) => i % 256), // 1000字节数据
            frequency: 25000000
          });
          
          // 扩展到10万样本
          const expandedSda = new Uint8Array(100000);
          const expandedScl = new Uint8Array(100000);
          
          for (let i = 0; i < 100000; i++) {
            expandedSda[i] = i2cData.sda[i % i2cData.sda.length];
            expandedScl[i] = i2cData.scl[i % i2cData.scl.length];
          }
          
          const channels = [
            new AnalyzerChannel(0, 'SDA'),
            new AnalyzerChannel(1, 'SCL')
          ];
          
          channels[0].samples = expandedSda;
          channels[1].samples = expandedScl;
          
          const results = decoder.decode(25000000, channels, [
            { id: 'address_format', value: 'shifted' }
          ]);
          
          expect(results.length).toBeGreaterThan(0);
          
          return { sampleCount: 100000, resultCount: results.length };
        }
      );
      
      // 验证10万样本解码 < 1秒
      PerformanceAssertions.assertExecutionTime(
        i2cDecodeResult, 
        PERFORMANCE_TARGETS.protocolDecode100K
      );
      
      const samplesPerSecond = 100000 / (i2cDecodeResult.duration / 1000);
      console.log(`✅ I2C解码性能: ${i2cDecodeResult.duration.toFixed(2)}ms`);
      console.log(`   解码速度: ${(samplesPerSecond / 1000).toFixed(1)}K 样本/秒`);
    });

    it('🌀 SPI解码性能 (10万样本)', async () => {
      const spiDecodeResult = await performanceBenchmark.runBenchmark(
        'SPIDecodePerformance_100K',
        async () => {
          const decoder = new SPIDecoder();
          
          // 生成10万样本的SPI数据
          const spiData = hardwareSimulator.generateSPIData({
            mode: 0,
            data: Array.from({ length: 1000 }, (_, i) => i % 256),
            frequency: 1000000,
            wordSize: 8
          });
          
          // 扩展到10万样本
          const channels = [
            new AnalyzerChannel(0, 'CS'),
            new AnalyzerChannel(1, 'CLK'),
            new AnalyzerChannel(2, 'MOSI'),
            new AnalyzerChannel(3, 'MISO')
          ];
          
          channels.forEach((channel, index) => {
            const sourceData = [spiData.cs, spiData.clk, spiData.mosi, spiData.miso][index];
            const expandedData = new Uint8Array(100000);
            for (let i = 0; i < 100000; i++) {
              expandedData[i] = sourceData[i % sourceData.length];
            }
            channel.samples = expandedData;
          });
          
          const results = decoder.decode(25000000, channels, [
            { id: 'cpol', value: 0 },
            { id: 'cpha', value: 0 },
            { id: 'wordsize', value: 8 }
          ]);
          
          expect(results.length).toBeGreaterThan(0);
          
          return { sampleCount: 100000, resultCount: results.length };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(
        spiDecodeResult, 
        PERFORMANCE_TARGETS.protocolDecode100K
      );
      
      console.log(`✅ SPI解码性能: ${spiDecodeResult.duration.toFixed(2)}ms`);
    });

    it('📡 UART解码性能 (10万样本)', async () => {
      const uartDecodeResult = await performanceBenchmark.runBenchmark(
        'UARTDecodePerformance_100K',
        async () => {
          const decoder = new UARTDecoder();
          
          // 生成长字符串的UART数据
          const longText = 'A'.repeat(1000); // 1000个字符
          const uartData = hardwareSimulator.generateUARTData({
            data: longText,
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            frequency: 25000000
          });
          
          // 扩展到10万样本
          const expandedData = new Uint8Array(100000);
          for (let i = 0; i < 100000; i++) {
            expandedData[i] = uartData.rx[i % uartData.rx.length];
          }
          
          const channel = new AnalyzerChannel(0, 'RX');
          channel.samples = expandedData;
          
          const results = decoder.decode(25000000, [channel], [
            { id: 'baudrate', value: 115200 },
            { id: 'num_data_bits', value: 8 }
          ]);
          
          expect(results.length).toBeGreaterThan(0);
          
          return { sampleCount: 100000, resultCount: results.length };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(
        uartDecodeResult, 
        PERFORMANCE_TARGETS.protocolDecode100K
      );
      
      console.log(`✅ UART解码性能: ${uartDecodeResult.duration.toFixed(2)}ms`);
    });

    it('🚀 并发解码性能测试', async () => {
      const concurrentDecodeResults = await performanceBenchmark.concurrencyTest(
        'ConcurrentDecoding',
        async () => {
          // 同时运行I2C、SPI、UART解码
          const i2cDecoder = new I2CDecoder();
          const spiDecoder = new SPIDecoder();
          const uartDecoder = new UARTDecoder();
          
          // 生成测试数据
          const i2cData = hardwareSimulator.generateI2CData({
            address: 0x50,
            data: [0x01, 0x02, 0x03],
            frequency: 10000000
          });
          
          const spiData = hardwareSimulator.generateSPIData({
            mode: 0,
            data: [0x11, 0x22, 0x33],
            frequency: 1000000,
            wordSize: 8
          });
          
          const uartData = hardwareSimulator.generateUARTData({
            data: 'Test',
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            frequency: 10000000
          });
          
          // 并发执行解码
          const [i2cResults, spiResults, uartResults] = await Promise.all([
            i2cDecoder.decode(10000000, [
              new AnalyzerChannel(0, 'SDA', i2cData.sda),
              new AnalyzerChannel(1, 'SCL', i2cData.scl)
            ], []),
            spiDecoder.decode(10000000, [
              new AnalyzerChannel(0, 'CS', spiData.cs),
              new AnalyzerChannel(1, 'CLK', spiData.clk),
              new AnalyzerChannel(2, 'MOSI', spiData.mosi),
              new AnalyzerChannel(3, 'MISO', spiData.miso)
            ], []),
            uartDecoder.decode(10000000, [
              new AnalyzerChannel(0, 'RX', uartData.rx)
            ], [])
          ]);
          
          return {
            i2cCount: i2cResults.length,
            spiCount: spiResults.length,
            uartCount: uartResults.length
          };
        },
        5, // 5个并发worker
        3  // 每个worker执行3次
      );
      
      const avgThroughput = concurrentDecodeResults.reduce((sum, r) => sum + r.opsPerSecond, 0) / concurrentDecodeResults.length;
      expect(avgThroughput).toBeGreaterThan(1);
      
      console.log(`✅ 并发解码性能: 平均 ${avgThroughput.toFixed(2)} ops/sec`);
    });
  });

  describe('4. 文件I/O性能测试', () => {
    it('💾 大文件保存性能 (100万样本)', async () => {
      const fileSaveResult = await performanceBenchmark.runBenchmark(
        'LargeFileSave_1M',
        async () => {
          const session = new CaptureSession();
          session.frequency = 50000000;
          session.postTriggerSamples = 1000000; // 100万样本
          session.captureChannels = [
            new AnalyzerChannel(0, 'CH0'),
            new AnalyzerChannel(1, 'CH1')
          ];
          
          // 生成100万样本数据
          const largeData = hardwareSimulator.generateLargeDataSet(1000000, 2);
          session.captureChannels[0].samples = largeData.channel0;
          session.captureChannels[1].samples = largeData.channel1;
          
          const testFile = path.join(testDataDir, 'performance-1M-save.lac');
          
          const saveResult = await LACFileFormat.save(testFile, session);
          expect(saveResult.success).toBe(true);
          
          // 验证文件大小
          const stats = fs.statSync(testFile);
          const fileSizeMB = stats.size / (1024 * 1024);
          
          return { sampleCount: 1000000, fileSizeMB };
        }
      );
      
      // 验证100万样本保存 < 3秒
      PerformanceAssertions.assertExecutionTime(
        fileSaveResult, 
        PERFORMANCE_TARGETS.fileIO1M
      );
      
      console.log(`✅ 大文件保存性能: ${fileSaveResult.duration.toFixed(2)}ms`);
      console.log(`   文件大小: ${fileSaveResult.operations}MB`);
    });

    it('📖 大文件加载性能 (100万样本)', async () => {
      const fileLoadResult = await performanceBenchmark.runBenchmark(
        'LargeFileLoad_1M',
        async () => {
          const testFile = path.join(testDataDir, 'performance-1M-save.lac');
          
          // 确保文件存在
          if (!fs.existsSync(testFile)) {
            // 创建测试文件
            const session = new CaptureSession();
            session.frequency = 50000000;
            session.postTriggerSamples = 1000000;
            session.captureChannels = [new AnalyzerChannel(0, 'CH0')];
            
            const data = hardwareSimulator.generateLargeDataSet(1000000, 1);
            session.captureChannels[0].samples = data.channel0;
            
            await LACFileFormat.save(testFile, session);
          }
          
          const loadResult = await LACFileFormat.load(testFile);
          expect(loadResult.success).toBe(true);
          expect(loadResult.data).toBeDefined();
          
          return { 
            sampleCount: loadResult.data?.Settings.postTriggerSamples || 0,
            channelCount: loadResult.data?.Settings.captureChannels.length || 0
          };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(
        fileLoadResult, 
        PERFORMANCE_TARGETS.fileIO1M
      );
      
      console.log(`✅ 大文件加载性能: ${fileLoadResult.duration.toFixed(2)}ms`);
    });

    it('📊 数据导出性能测试', async () => {
      const exportResult = await performanceBenchmark.runBenchmark(
        'DataExportPerformance',
        async () => {
          const session = new CaptureSession();
          session.frequency = 25000000;
          session.postTriggerSamples = 100000; // 10万样本
          session.captureChannels = [
            new AnalyzerChannel(0, 'CH0'),
            new AnalyzerChannel(1, 'CH1'),
            new AnalyzerChannel(2, 'CH2'),
            new AnalyzerChannel(3, 'CH3')
          ];
          
          const testData = hardwareSimulator.generateLargeDataSet(100000, 4);
          session.captureChannels.forEach((channel, index) => {
            channel.samples = testData[`channel${index}`];
          });
          
          const exportService = new DataExportService();
          
          // 测试多种格式导出
          const csvFile = path.join(testDataDir, 'performance-export.csv');
          const vcdFile = path.join(testDataDir, 'performance-export.vcd');
          const jsonFile = path.join(testDataDir, 'performance-export.json');
          
          const [csvResult, vcdResult, jsonResult] = await Promise.all([
            exportService.exportToCSV(csvFile, session),
            exportService.exportToVCD(vcdFile, session),
            exportService.exportToJSON(jsonFile, session)
          ]);
          
          expect(csvResult.success).toBe(true);
          expect(vcdResult.success).toBe(true);
          expect(jsonResult.success).toBe(true);
          
          return { sampleCount: 100000, formats: 3 };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(exportResult, 5000); // 5秒内完成所有导出
      
      console.log(`✅ 数据导出性能: ${exportResult.duration.toFixed(2)}ms (3种格式)`);
    });
  });

  describe('5. 内存和稳定性测试', () => {
    it('🧠 24小时内存稳定性模拟', async () => {
      const memoryStabilityResult = await performanceBenchmark.memoryLeakTest(
        'LongTermMemoryStability',
        async () => {
          // 模拟24小时的典型用户操作
          // 为了测试速度，我们用500次迭代来模拟
          const session = new CaptureSession();
          session.frequency = 10000000;
          session.postTriggerSamples = 10000;
          session.captureChannels = [new AnalyzerChannel(0, 'MemTest')];
          
          const testData = hardwareSimulator.generateRandomData(10000);
          session.captureChannels[0].samples = testData;
          
          // 模拟用户操作：采集 -> 解码 -> 保存 -> 加载
          const tempFile = path.join(testDataDir, 'memory-stability-test.lac');
          
          await LACFileFormat.save(tempFile, session);
          await LACFileFormat.load(tempFile);
          
          const decoder = new I2CDecoder();
          decoder.decode(session.frequency, session.captureChannels, []);
          
          // 清理临时数据
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        },
        500, // 500次迭代模拟长期使用
        50   // 每50次拍摄内存快照
      );
      
      // 验证内存增长 < 100MB
      const memoryGrowthMB = memoryStabilityResult.memoryGrowth / (1024 * 1024);
      expect(memoryGrowthMB).toBeLessThan(PERFORMANCE_TARGETS.memoryGrowth24h);
      
      PerformanceAssertions.assertNoMemoryLeak(memoryStabilityResult);
      
      console.log(`✅ 内存稳定性测试: ${memoryGrowthMB.toFixed(2)}MB 增长 (目标: <${PERFORMANCE_TARGETS.memoryGrowth24h}MB)`);
      console.log(`   是否检测到泄漏: ${memoryStabilityResult.leaked ? '是' : '否'}`);
    });

    it('💪 系统压力测试', async () => {
      const stressTestResult = await performanceBenchmark.runBenchmark(
        'SystemStressTest',
        async () => {
          const concurrentOperations = [];
          
          // 同时执行多个高负载操作
          for (let i = 0; i < 5; i++) {
            concurrentOperations.push(
              (async () => {
                const session = new CaptureSession();
                session.frequency = 50000000;
                session.postTriggerSamples = 50000;
                session.captureChannels = [new AnalyzerChannel(0, `Stress${i}`)];
                
                const data = hardwareSimulator.generateRandomData(50000);
                session.captureChannels[0].samples = data;
                
                // 文件操作
                const tempFile = path.join(testDataDir, `stress-${i}.lac`);
                await LACFileFormat.save(tempFile, session);
                await LACFileFormat.load(tempFile);
                
                // 解码操作
                const decoder = new I2CDecoder();
                decoder.decode(session.frequency, session.captureChannels, []);
                
                // 清理
                if (fs.existsSync(tempFile)) {
                  fs.unlinkSync(tempFile);
                }
                
                return i;
              })()
            );
          }
          
          const results = await Promise.all(concurrentOperations);
          expect(results.length).toBe(5);
          
          return { concurrentOps: 5, success: true };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(stressTestResult, 15000); // 15秒内完成
      
      console.log(`✅ 系统压力测试: ${stressTestResult.duration.toFixed(2)}ms (5个并发操作)`);
    });
  });

  describe('6. 综合性能评估', () => {
    it('🏆 综合性能基准测试', async () => {
      const comprehensiveResult = await performanceBenchmark.runBenchmark(
        'ComprehensivePerformanceBenchmark',
        async () => {
          const results = {
            deviceConnection: 0,
            dataCapture: 0,
            protocolDecode: 0,
            fileIO: 0,
            memoryEfficiency: 0
          };
          
          // 1. 设备连接测试
          const startTime1 = performance.now();
          const driver = new LogicAnalyzerDriver('BENCHMARK_DEVICE');
          await driver.connect({ connectionString: 'MOCK' });
          results.deviceConnection = performance.now() - startTime1;
          
          // 2. 数据采集测试
          const startTime2 = performance.now();
          const session = new CaptureSession();
          session.frequency = 25000000;
          session.postTriggerSamples = 100000;
          session.captureChannels = [
            new AnalyzerChannel(0, 'BenchCH0'),
            new AnalyzerChannel(1, 'BenchCH1')
          ];
          
          const benchData = hardwareSimulator.generateI2CData({
            address: 0x50,
            data: Array.from({ length: 100 }, (_, i) => i),
            frequency: session.frequency
          });
          
          // 扩展到10万样本
          const expandedSda = new Uint8Array(100000);
          const expandedScl = new Uint8Array(100000);
          for (let i = 0; i < 100000; i++) {
            expandedSda[i] = benchData.sda[i % benchData.sda.length];
            expandedScl[i] = benchData.scl[i % benchData.scl.length];
          }
          
          session.captureChannels[0].samples = expandedSda;
          session.captureChannels[1].samples = expandedScl;
          
          await driver.startCapture(session);
          await driver.stopCapture();
          results.dataCapture = performance.now() - startTime2;
          
          // 3. 协议解码测试
          const startTime3 = performance.now();
          const decoder = new I2CDecoder();
          const decodeResults = decoder.decode(session.frequency, session.captureChannels, []);
          results.protocolDecode = performance.now() - startTime3;
          
          // 4. 文件I/O测试
          const startTime4 = performance.now();
          const benchFile = path.join(testDataDir, 'comprehensive-bench.lac');
          await LACFileFormat.save(benchFile, session);
          await LACFileFormat.load(benchFile);
          results.fileIO = performance.now() - startTime4;
          
          // 5. 内存效率评估
          const memoryBefore = process.memoryUsage().heapUsed;
          // 执行一些内存密集操作
          const largeArray = new Array(10000).fill(0).map(() => Math.random());
          const memoryAfter = process.memoryUsage().heapUsed;
          results.memoryEfficiency = memoryAfter - memoryBefore;
          
          // 清理大数组
          largeArray.length = 0;
          
          // 清理测试文件
          if (fs.existsSync(benchFile)) {
            fs.unlinkSync(benchFile);
          }
          
          return results;
        }
      );
      
      console.log('\n🏆 综合性能基准测试结果:');
      console.log(`   设备连接: ${comprehensiveResult.operations.deviceConnection.toFixed(2)}ms`);
      console.log(`   数据采集: ${comprehensiveResult.operations.dataCapture.toFixed(2)}ms`);
      console.log(`   协议解码: ${comprehensiveResult.operations.protocolDecode.toFixed(2)}ms`);
      console.log(`   文件I/O: ${comprehensiveResult.operations.fileIO.toFixed(2)}ms`);
      console.log(`   内存效率: ${(comprehensiveResult.operations.memoryEfficiency / 1024).toFixed(2)}KB`);
      
      // 验证所有性能指标
      expect(comprehensiveResult.operations.deviceConnection).toBeLessThan(PERFORMANCE_TARGETS.deviceConnection);
      expect(comprehensiveResult.operations.protocolDecode).toBeLessThan(PERFORMANCE_TARGETS.protocolDecode100K);
      expect(comprehensiveResult.operations.fileIO).toBeLessThan(PERFORMANCE_TARGETS.fileIO1M);
      
      PerformanceAssertions.assertExecutionTime(comprehensiveResult, 20000); // 总时间 < 20秒
    });
  });
});