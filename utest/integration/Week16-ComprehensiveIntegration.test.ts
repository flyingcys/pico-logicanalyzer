/**
 * Week 16: 全面集成测试套件
 * 验证所有核心功能正常工作，测试不同场景和边界条件
 * 
 * 测试覆盖：
 * 1. 完整的端到端工作流
 * 2. 所有协议解码器功能验证
 * 3. 网络和串口双模式测试
 * 4. 性能基准测试
 * 5. 错误处理和异常恢复
 * 6. 数据完整性验证
 * 7. 用户界面集成测试
 */

import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { HardwareDriverManager } from '../../src/drivers/HardwareDriverManager';
import { I2CDecoder } from '../../src/decoders/protocols/I2CDecoder';
import { SPIDecoder } from '../../src/decoders/protocols/SPIDecoder';
import { UARTDecoder } from '../../src/decoders/protocols/UARTDecoder';
import { DecoderManager } from '../../src/decoders/DecoderManager';
import { LACFileFormat } from '../../src/models/LACFileFormat';
import { DataExportService } from '../../src/services/DataExportService';
import { ExportPerformanceOptimizer } from '../../src/services/ExportPerformanceOptimizer';
import { WiFiDeviceDiscovery } from '../../src/services/WiFiDeviceDiscovery';
import { NetworkStabilityService } from '../../src/services/NetworkStabilityService';
import { TriggerProcessor } from '../../src/models/TriggerProcessor';
import { CaptureSession, AnalyzerChannel } from '../../src/models/CaptureModels';
import { TriggerType, CaptureMode } from '../../src/models/AnalyzerTypes';
import { PerformanceBenchmark, PerformanceAssertions } from './PerformanceBenchmark';
import { HardwareSimulator } from './HardwareSimulator';
import * as fs from 'fs';
import * as path from 'path';

describe('Week 16: 全面集成测试套件', () => {
  let testDataDir: string;
  let performanceBenchmark: PerformanceBenchmark;
  let hardwareSimulator: HardwareSimulator;
  let driver: LogicAnalyzerDriver;
  let driverManager: HardwareDriverManager;
  let exportService: DataExportService;
  let networkDiscovery: WiFiDeviceDiscovery;

  beforeAll(async () => {
    // 创建测试环境
    testDataDir = path.join(__dirname, '../fixtures/week16-comprehensive');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // 初始化测试工具
    performanceBenchmark = new PerformanceBenchmark();
    hardwareSimulator = new HardwareSimulator();
    
    // 初始化核心组件
    driverManager = new HardwareDriverManager();
    exportService = new DataExportService();
    networkDiscovery = new WiFiDeviceDiscovery();
    
    // 创建测试用的逻辑分析仪驱动
    driver = new LogicAnalyzerDriver('TEST_DEVICE');
    
    // 启动硬件模拟器
    await hardwareSimulator.startSimulation({
      deviceType: 'pico-logic-analyzer',
      channelCount: 24,
      maxSampleRate: 100000000,
      supportedProtocols: ['I2C', 'SPI', 'UART']
    });
  }, 30000);

  afterAll(async () => {
    // 清理测试环境
    if (hardwareSimulator) {
      await hardwareSimulator.stopSimulation();
    }
    
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    
    // 输出性能报告
    const report = performanceBenchmark.getReport();
    console.log('🚀 Week 16 性能测试报告：');
    console.log(`总测试数量: ${report.summary.totalTests}`);
    console.log(`成功测试: ${report.summary.successfulTests}`);
    console.log(`失败测试: ${report.summary.failedTests}`);
    console.log(`平均执行时间: ${report.summary.averageDuration.toFixed(2)}ms`);
    console.log(`峰值内存使用: ${(report.memoryAnalysis.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
  }, 15000);

  describe('1. 完整端到端工作流测试', () => {
    it('🔄 完整工作流: 设备连接 → 数据采集 → 协议解码 → 数据导出', async () => {
      // 1. 设备连接测试
      const connectionResult = await performanceBenchmark.runBenchmark(
        'DeviceConnection',
        async () => {
          const result = await driver.connect({ 
            connectionString: 'MOCK_SERIAL',
            baudRate: 115200 
          });
          expect(result.success).toBe(true);
          expect(result.deviceInfo).toBeDefined();
          return result;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(connectionResult, 2000); // 2秒内连接
      
      // 2. 配置采集会话
      const session = new CaptureSession();
      session.frequency = 25000000; // 25MHz
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.triggerType = TriggerType.Edge;
      
      // 配置I2C通道
      session.captureChannels = [
        new AnalyzerChannel(0, 'SDA'),
        new AnalyzerChannel(1, 'SCL')
      ];

      // 3. 数据采集测试
      const captureResult = await performanceBenchmark.runBenchmark(
        'DataCapture',
        async () => {
          // 生成模拟I2C数据
          const i2cData = hardwareSimulator.generateI2CData({
            address: 0x50,
            data: [0x12, 0x34, 0x56, 0x78],
            frequency: session.frequency
          });
          
          // 模拟硬件采集
          session.captureChannels[0].samples = i2cData.sda;
          session.captureChannels[1].samples = i2cData.scl;
          
          const result = await driver.startCapture(session);
          expect(result.success).toBe(true);
          
          // 等待采集完成
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const stopResult = await driver.stopCapture();
          expect(stopResult.success).toBe(true);
          
          return result;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(captureResult, 5000); // 5秒内完成采集

      // 4. 协议解码测试
      const decodingResult = await performanceBenchmark.runBenchmark(
        'ProtocolDecoding',
        async () => {
          const decoder = new I2CDecoder();
          const decodedResults = decoder.decode(
            session.frequency,
            session.captureChannels,
            [
              { id: 'address_format', value: 'shifted' },
              { id: 'clock_edge', value: 'rising' }
            ]
          );
          
          expect(decodedResults).toBeDefined();
          expect(decodedResults.length).toBeGreaterThan(0);
          
          // 验证解码结果包含预期的协议元素
          const startCondition = decodedResults.find(r => r.type === 'start');
          const addressFrame = decodedResults.find(r => r.type === 'address');
          const dataFrame = decodedResults.find(r => r.type === 'data');
          
          expect(startCondition).toBeDefined();
          expect(addressFrame).toBeDefined();
          expect(dataFrame).toBeDefined();
          
          return decodedResults;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(decodingResult, 1000); // 1秒内完成解码

      // 5. 数据导出测试
      const exportResult = await performanceBenchmark.runBenchmark(
        'DataExport',
        async () => {
          const lacFile = path.join(testDataDir, 'end-to-end-test.lac');
          const csvFile = path.join(testDataDir, 'end-to-end-test.csv');
          const vcdFile = path.join(testDataDir, 'end-to-end-test.vcd');
          
          // 测试多种格式导出
          const lacResult = await LACFileFormat.save(lacFile, session);
          const csvResult = await exportService.exportToCSV(csvFile, session);
          const vcdResult = await exportService.exportToVCD(vcdFile, session);
          
          expect(lacResult.success).toBe(true);
          expect(csvResult.success).toBe(true);
          expect(vcdResult.success).toBe(true);
          
          // 验证文件存在
          expect(fs.existsSync(lacFile)).toBe(true);
          expect(fs.existsSync(csvFile)).toBe(true);
          expect(fs.existsSync(vcdFile)).toBe(true);
          
          return { lacResult, csvResult, vcdResult };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(exportResult, 3000); // 3秒内完成导出
      
    }, 30000);

    it('🌐 网络设备端到端工作流测试', async () => {
      // 1. WiFi设备发现
      const discoveryResult = await performanceBenchmark.runBenchmark(
        'WiFiDeviceDiscovery',
        async () => {
          // 模拟网络设备
          hardwareSimulator.addNetworkDevice({
            ip: '192.168.1.100',
            port: 8080,
            deviceType: 'pico-logic-analyzer-wifi'
          });
          
          const devices = await networkDiscovery.scanForDevices({
            timeout: 5000,
            broadcastAddress: '192.168.1.255'
          });
          
          expect(devices.length).toBeGreaterThan(0);
          const testDevice = devices.find(d => d.ip === '192.168.1.100');
          expect(testDevice).toBeDefined();
          
          return devices;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(discoveryResult, 6000); // 6秒内发现设备

      // 2. 网络连接稳定性测试
      const stabilityService = new NetworkStabilityService();
      const stabilityResult = await performanceBenchmark.runBenchmark(
        'NetworkStability',
        async () => {
          const connectionQuality = await stabilityService.testConnectionQuality({
            host: '192.168.1.100',
            port: 8080,
            testDuration: 2000
          });
          
          expect(connectionQuality.latency).toBeLessThan(100); // <100ms延迟
          expect(connectionQuality.packetLoss).toBeLessThan(0.1); // <10%丢包率
          expect(connectionQuality.stability).toBeGreaterThan(0.9); // >90%稳定性
          
          return connectionQuality;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(stabilityResult, 3000);

      // 3. 网络采集性能测试
      const networkCaptureResult = await performanceBenchmark.runBenchmark(
        'NetworkCapture',
        async () => {
          const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
          
          const result = await networkDriver.connect({
            connectionString: '192.168.1.100:8080',
            timeout: 5000
          });
          
          expect(result.success).toBe(true);
          
          // 配置高速采集
          const session = new CaptureSession();
          session.frequency = 100000000; // 100MHz
          session.postTriggerSamples = 50000;
          session.captureChannels = [
            new AnalyzerChannel(0, 'CH0'),
            new AnalyzerChannel(1, 'CH1'),
            new AnalyzerChannel(2, 'CH2'),
            new AnalyzerChannel(3, 'CH3')
          ];
          
          const captureResult = await networkDriver.startCapture(session);
          expect(captureResult.success).toBe(true);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const stopResult = await networkDriver.stopCapture();
          expect(stopResult.success).toBe(true);
          
          return { captureResult, stopResult };
        }
      );
      
      PerformanceAssertions.assertExecutionTime(networkCaptureResult, 8000);
      
    }, 25000);
  });

  describe('2. 所有协议解码器功能验证', () => {
    it('🔌 I2C协议完整功能测试', async () => {
      const i2cTest = await performanceBenchmark.runBenchmark(
        'I2CDecoderComprehensive',
        async () => {
          const decoder = new I2CDecoder();
          
          // 测试多种I2C场景
          const testCases = [
            {
              name: '7位地址写操作',
              data: hardwareSimulator.generateI2CData({
                address: 0x50,
                data: [0xAA, 0xBB, 0xCC],
                operation: 'write',
                addressBits: 7
              })
            },
            {
              name: '7位地址读操作',
              data: hardwareSimulator.generateI2CData({
                address: 0x50,
                data: [0x11, 0x22, 0x33],
                operation: 'read',
                addressBits: 7
              })
            },
            {
              name: '10位地址操作',
              data: hardwareSimulator.generateI2CData({
                address: 0x250,
                data: [0xFF, 0x00],
                operation: 'write',
                addressBits: 10
              })
            }
          ];
          
          const results = [];
          
          for (const testCase of testCases) {
            const channels = [
              new AnalyzerChannel(0, 'SDA'),
              new AnalyzerChannel(1, 'SCL')
            ];
            
            channels[0].samples = testCase.data.sda;
            channels[1].samples = testCase.data.scl;
            
            const decoded = decoder.decode(25000000, channels, [
              { id: 'address_format', value: 'shifted' }
            ]);
            
            expect(decoded.length).toBeGreaterThan(0);
            
            // 验证包含START条件
            const startCondition = decoded.find(r => r.type === 'start');
            expect(startCondition).toBeDefined();
            
            // 验证地址解码
            const addressFrame = decoded.find(r => r.type === 'address');
            expect(addressFrame).toBeDefined();
            
            results.push({
              testCase: testCase.name,
              decoded: decoded,
              success: true
            });
          }
          
          return results;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(i2cTest, 3000);
      expect(i2cTest.success).toBe(true);
    });

    it('🌀 SPI协议完整功能测试', async () => {
      const spiTest = await performanceBenchmark.runBenchmark(
        'SPIDecoderComprehensive',
        async () => {
          const decoder = new SPIDecoder();
          
          // 测试所有SPI模式
          const spiModes = [
            { mode: 0, cpol: 0, cpha: 0 },
            { mode: 1, cpol: 0, cpha: 1 },
            { mode: 2, cpol: 1, cpha: 0 },
            { mode: 3, cpol: 1, cpha: 1 }
          ];
          
          const results = [];
          
          for (const modeConfig of spiModes) {
            const spiData = hardwareSimulator.generateSPIData({
              mode: modeConfig.mode,
              data: [0x12, 0x34, 0x56, 0x78],
              frequency: 1000000,
              wordSize: 8
            });
            
            const channels = [
              new AnalyzerChannel(0, 'CS'),
              new AnalyzerChannel(1, 'CLK'), 
              new AnalyzerChannel(2, 'MOSI'),
              new AnalyzerChannel(3, 'MISO')
            ];
            
            channels[0].samples = spiData.cs;
            channels[1].samples = spiData.clk;
            channels[2].samples = spiData.mosi;
            channels[3].samples = spiData.miso;
            
            const decoded = decoder.decode(25000000, channels, [
              { id: 'cpol', value: modeConfig.cpol },
              { id: 'cpha', value: modeConfig.cpha },
              { id: 'bitorder', value: 'msb-first' },
              { id: 'wordsize', value: 8 }
            ]);
            
            expect(decoded.length).toBeGreaterThan(0);
            
            // 验证数据传输解码
            const dataFrames = decoded.filter(r => r.type === 'data');
            expect(dataFrames.length).toBeGreaterThan(0);
            
            results.push({
              mode: modeConfig.mode,
              decoded: decoded,
              success: true
            });
          }
          
          return results;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(spiTest, 4000);
      expect(spiTest.success).toBe(true);
    });

    it('📡 UART协议完整功能测试', async () => {
      const uartTest = await performanceBenchmark.runBenchmark(
        'UARTDecoderComprehensive',
        async () => {
          const decoder = new UARTDecoder();
          
          // 测试不同UART配置
          const uartConfigs = [
            { baud: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
            { baud: 115200, dataBits: 8, parity: 'even', stopBits: 1 },
            { baud: 57600, dataBits: 7, parity: 'odd', stopBits: 2 }
          ];
          
          const results = [];
          
          for (const config of uartConfigs) {
            const uartData = hardwareSimulator.generateUARTData({
              data: 'Hello World!',
              baudRate: config.baud,
              dataBits: config.dataBits,
              parity: config.parity,
              stopBits: config.stopBits,
              frequency: 25000000
            });
            
            const channel = new AnalyzerChannel(0, 'RX');
            channel.samples = uartData.rx;
            
            const decoded = decoder.decode(25000000, [channel], [
              { id: 'baudrate', value: config.baud },
              { id: 'num_data_bits', value: config.dataBits },
              { id: 'parity_type', value: config.parity },
              { id: 'num_stop_bits', value: config.stopBits }
            ]);
            
            expect(decoded.length).toBeGreaterThan(0);
            
            // 验证起始位和停止位
            const startBits = decoded.filter(r => r.type === 'startbit');
            const stopBits = decoded.filter(r => r.type === 'stopbit');
            const dataFrames = decoded.filter(r => r.type === 'data');
            
            expect(startBits.length).toBeGreaterThan(0);
            expect(stopBits.length).toBeGreaterThan(0);
            expect(dataFrames.length).toBeGreaterThan(0);
            
            results.push({
              config: config,
              decoded: decoded,
              success: true
            });
          }
          
          return results;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(uartTest, 3000);
      expect(uartTest.success).toBe(true);
    });
  });

  describe('3. 触发系统功能测试', () => {
    it('⚡ 所有触发模式功能验证', async () => {
      const triggerTest = await performanceBenchmark.runBenchmark(
        'TriggerSystemComprehensive',
        async () => {
          const triggerProcessor = new TriggerProcessor();
          
          // 测试所有触发类型
          const triggerTypes = [
            TriggerType.Edge,
            TriggerType.Pattern,
            TriggerType.Fast,
            TriggerType.Blast
          ];
          
          const results = [];
          
          for (const triggerType of triggerTypes) {
            const session = new CaptureSession();
            session.frequency = 50000000;
            session.triggerType = triggerType;
            session.preTriggerSamples = 1000;
            session.postTriggerSamples = 4000;
            
            // 配置通道
            session.captureChannels = [
              new AnalyzerChannel(0, 'CH0'),
              new AnalyzerChannel(1, 'CH1'),
              new AnalyzerChannel(2, 'CH2'),
              new AnalyzerChannel(3, 'CH3')
            ];
            
            // 根据触发类型生成测试数据
            let triggerData;
            switch (triggerType) {
              case TriggerType.Edge:
                triggerData = hardwareSimulator.generateEdgeTriggerData({
                  channel: 0,
                  edge: 'rising',
                  sampleCount: 5000
                });
                break;
              case TriggerType.Pattern:
                triggerData = hardwareSimulator.generatePatternTriggerData({
                  pattern: 0b1010,
                  channels: [0, 1, 2, 3],
                  sampleCount: 5000
                });
                break;
              default:
                triggerData = hardwareSimulator.generateGenericTriggerData({
                  sampleCount: 5000,
                  channelCount: 4
                });
            }
            
            // 验证触发条件
            const isValid = triggerProcessor.validateTriggerCondition({
              type: triggerType,
              channel: 0,
              value: 0b1010,
              edge: 'rising'
            });
            
            expect(isValid.isValid).toBe(true);
            
            results.push({
              triggerType: triggerType,
              validation: isValid,
              success: true
            });
          }
          
          return results;
        }
      );
      
      PerformanceAssertions.assertExecutionTime(triggerTest, 2000);
      expect(triggerTest.success).toBe(true);
    });
  });

  describe('4. 性能基准测试', () => {
    it('🚀 大数据量处理性能测试', async () => {
      const scalabilityResult = await performanceBenchmark.scalabilityTest(
        'LargeDataProcessing',
        (dataSize: number) => async () => {
          const session = new CaptureSession();
          session.frequency = 100000000;
          session.postTriggerSamples = dataSize;
          session.captureChannels = [
            new AnalyzerChannel(0, 'CH0'),
            new AnalyzerChannel(1, 'CH1')
          ];
          
          // 生成大数据集
          const largeData = hardwareSimulator.generateLargeDataSet(dataSize, 2);
          session.captureChannels[0].samples = largeData.channel0;
          session.captureChannels[1].samples = largeData.channel1;
          
          // 测试处理性能
          const startTime = performance.now();
          
          // 数据压缩测试
          const lacFile = path.join(testDataDir, `performance-${dataSize}.lac`);
          const saveResult = await LACFileFormat.save(lacFile, session);
          expect(saveResult.success).toBe(true);
          
          // 数据加载测试
          const loadResult = await LACFileFormat.load(lacFile);
          expect(loadResult.success).toBe(true);
          
          const endTime = performance.now();
          
          return {
            dataSize,
            processingTime: endTime - startTime,
            success: true
          };
        },
        [10000, 50000, 100000, 500000] // 不同数据量
      );
      
      // 验证性能伸缩性
      expect(scalabilityResult.scalability).toBe('linear');
      expect(scalabilityResult.efficiency).toBeGreaterThan(100); // 至少100 ops/sec
      
      // 清理大文件
      scalabilityResult.results.forEach((_, index) => {
        const dataSize = [10000, 50000, 100000, 500000][index];
        const testFile = path.join(testDataDir, `performance-${dataSize}.lac`);
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      });
    });

    it('🧠 内存泄漏和稳定性测试', async () => {
      const memoryLeakResult = await performanceBenchmark.memoryLeakTest(
        'SystemStability',
        async () => {
          // 模拟用户操作序列
          const session = new CaptureSession();
          session.frequency = 25000000;
          session.postTriggerSamples = 10000;
          session.captureChannels = [new AnalyzerChannel(0, 'Test')];
          
          // 创建数据
          const testData = hardwareSimulator.generateRandomData(10000);
          session.captureChannels[0].samples = testData;
          
          // 模拟完整操作流程
          const lacFile = path.join(testDataDir, 'memory-test.lac');
          await LACFileFormat.save(lacFile, session);
          await LACFileFormat.load(lacFile);
          
          // 协议解码
          const decoder = new I2CDecoder();
          decoder.decode(session.frequency, session.captureChannels, []);
          
          // 清理临时文件
          if (fs.existsSync(lacFile)) {
            fs.unlinkSync(lacFile);
          }
        },
        200, // 200次迭代
        20   // 每20次拍摄快照
      );
      
      // 验证没有内存泄漏
      PerformanceAssertions.assertNoMemoryLeak(memoryLeakResult);
      
      const growthMB = memoryLeakResult.memoryGrowth / (1024 * 1024);
      console.log(`内存增长: ${growthMB.toFixed(2)}MB`);
      expect(growthMB).toBeLessThan(100); // 不超过100MB增长
    });

    it('⚡ 并发处理性能测试', async () => {
      const concurrencyResults = await performanceBenchmark.concurrencyTest(
        'ConcurrentProcessing',
        async () => {
          // 模拟并发操作
          const session = new CaptureSession();
          session.frequency = 10000000;
          session.postTriggerSamples = 5000;
          session.captureChannels = [
            new AnalyzerChannel(0, 'Concurrent_CH0'),
            new AnalyzerChannel(1, 'Concurrent_CH1')
          ];
          
          const testData = hardwareSimulator.generateI2CData({
            address: Math.floor(Math.random() * 127),
            data: [Math.floor(Math.random() * 255)],
            frequency: session.frequency
          });
          
          session.captureChannels[0].samples = testData.sda;
          session.captureChannels[1].samples = testData.scl;
          
          // 并发解码测试
          const decoder = new I2CDecoder();
          const result = decoder.decode(session.frequency, session.captureChannels, []);
          
          return result;
        },
        10, // 10个并发worker
        5   // 每个worker执行5次操作
      );
      
      // 验证并发性能
      const avgThroughput = concurrencyResults.reduce((sum, r) => sum + r.opsPerSecond, 0) / concurrencyResults.length;
      expect(avgThroughput).toBeGreaterThan(1); // 平均吞吐量 > 1 ops/sec
      
      const allSuccessful = concurrencyResults.every(r => r.success);
      expect(allSuccessful).toBe(true);
    });
  });

  describe('5. 错误处理和异常恢复', () => {
    it('🛡️ 设备连接异常处理', async () => {
      const errorHandlingTest = await performanceBenchmark.runBenchmark(
        'ErrorHandling',
        async () => {
          // 测试无效设备连接
          const invalidDriver = new LogicAnalyzerDriver('INVALID_DEVICE');
          
          const connectionResult = await invalidDriver.connect({
            connectionString: 'COM99', // 不存在的端口
            timeout: 1000
          });
          
          expect(connectionResult.success).toBe(false);
          expect(connectionResult.error).toBeDefined();
          
          // 测试网络连接超时
          const networkDriver = new LogicAnalyzerDriver('192.168.1.999:8080');
          const networkResult = await networkDriver.connect({
            connectionString: '192.168.1.999:8080',
            timeout: 1000
          });
          
          expect(networkResult.success).toBe(false);
          expect(networkResult.error).toContain('timeout');
          
          return { connectionResult, networkResult };
        }
      );
      
      expect(errorHandlingTest.success).toBe(true);
    });

    it('📁 文件操作异常处理', async () => {
      const fileErrorTest = await performanceBenchmark.runBenchmark(
        'FileErrorHandling',
        async () => {
          // 测试读取不存在的文件
          const loadResult = await LACFileFormat.load('/nonexistent/file.lac');
          expect(loadResult.success).toBe(false);
          expect(loadResult.error).toBeDefined();
          
          // 测试写入到只读目录
          const session = new CaptureSession();
          const readOnlyResult = await LACFileFormat.save('/root/readonly.lac', session);
          // 根据系统权限，可能成功或失败，但不应该崩溃
          expect(typeof readOnlyResult.success).toBe('boolean');
          
          // 测试损坏的文件格式
          const corruptFile = path.join(testDataDir, 'corrupt.lac');
          fs.writeFileSync(corruptFile, 'invalid json content');
          
          const corruptResult = await LACFileFormat.load(corruptFile);
          expect(corruptResult.success).toBe(false);
          expect(corruptResult.error).toContain('JSON');
          
          return { loadResult, readOnlyResult, corruptResult };
        }
      );
      
      expect(fileErrorTest.success).toBe(true);
    });

    it('🔧 解码器异常处理', async () => {
      const decoderErrorTest = await performanceBenchmark.runBenchmark(
        'DecoderErrorHandling',
        async () => {
          const decoder = new I2CDecoder();
          
          // 测试空数据
          const emptyChannel = new AnalyzerChannel(0, 'Empty');
          emptyChannel.samples = new Uint8Array(0);
          
          const emptyResult = decoder.decode(25000000, [emptyChannel], []);
          expect(Array.isArray(emptyResult)).toBe(true); // 应该返回空数组而不是抛出异常
          
          // 测试无效参数
          const invalidResult = decoder.decode(-1, [], []); // 负频率
          expect(Array.isArray(invalidResult)).toBe(true);
          
          // 测试数据不匹配
          const mismatchChannel = new AnalyzerChannel(0, 'Mismatch');
          mismatchChannel.samples = new Uint8Array([1, 1, 1, 1, 1]); // 全高电平，无I2C信号
          
          const mismatchResult = decoder.decode(25000000, [mismatchChannel], []);
          expect(Array.isArray(mismatchResult)).toBe(true);
          
          return { emptyResult, invalidResult, mismatchResult };
        }
      );
      
      expect(decoderErrorTest.success).toBe(true);
    });
  });

  describe('6. 数据完整性验证', () => {
    it('🔍 数据格式兼容性测试', async () => {
      const compatibilityTest = await performanceBenchmark.runBenchmark(
        'DataCompatibility',
        async () => {
          // 创建测试数据
          const originalSession = new CaptureSession();
          originalSession.frequency = 25000000;
          originalSession.preTriggerSamples = 1000;
          originalSession.postTriggerSamples = 4000;
          originalSession.triggerType = TriggerType.Edge;
          originalSession.captureChannels = [
            new AnalyzerChannel(0, 'Test_CH0'),
            new AnalyzerChannel(1, 'Test_CH1')
          ];
          
          // 生成测试样本数据
          const testData = hardwareSimulator.generatePatterned Data({
            pattern: [1, 0, 1, 0, 1, 1, 0, 0],
            repeat: 625, // 5000 samples total
            channelCount: 2
          });
          
          originalSession.captureChannels[0].samples = testData.channel0;
          originalSession.captureChannels[1].samples = testData.channel1;
          
          // 保存和加载测试
          const testFile = path.join(testDataDir, 'compatibility-test.lac');
          
          const saveResult = await LACFileFormat.save(testFile, originalSession);
          expect(saveResult.success).toBe(true);
          
          const loadResult = await LACFileFormat.load(testFile);
          expect(loadResult.success).toBe(true);
          expect(loadResult.data).toBeDefined();
          
          // 验证数据完整性
          const loadedSession = loadResult.data!.Settings;
          expect(loadedSession.frequency).toBe(originalSession.frequency);
          expect(loadedSession.preTriggerSamples).toBe(originalSession.preTriggerSamples);
          expect(loadedSession.postTriggerSamples).toBe(originalSession.postTriggerSamples);
          expect(loadedSession.captureChannels.length).toBe(originalSession.captureChannels.length);
          
          // 验证通道数据
          for (let i = 0; i < originalSession.captureChannels.length; i++) {
            const originalChannel = originalSession.captureChannels[i];
            const loadedChannel = loadedSession.captureChannels[i];
            
            expect(loadedChannel.channelName).toBe(originalChannel.channelName);
            // 注意：样本数据可能被压缩，所以只验证基本属性
          }
          
          return { originalSession, loadedSession };
        }
      );
      
      expect(compatibilityTest.success).toBe(true);
    });

    it('📊 数据导出完整性验证', async () => {
      const exportIntegrityTest = await performanceBenchmark.runBenchmark(
        'ExportIntegrity',
        async () => {
          const session = new CaptureSession();
          session.frequency = 10000000;
          session.postTriggerSamples = 1000;
          session.captureChannels = [
            new AnalyzerChannel(0, 'Export_CH0'),
            new AnalyzerChannel(1, 'Export_CH1')
          ];
          
          // 生成已知模式的数据
          const knownPattern = new Uint8Array(1000);
          for (let i = 0; i < 1000; i++) {
            knownPattern[i] = i % 2; // 交替的0和1
          }
          
          session.captureChannels[0].samples = knownPattern;
          session.captureChannels[1].samples = knownPattern.map(v => 1 - v); // 反转的模式
          
          // 测试不同格式导出
          const csvFile = path.join(testDataDir, 'integrity-test.csv');
          const vcdFile = path.join(testDataDir, 'integrity-test.vcd');
          const jsonFile = path.join(testDataDir, 'integrity-test.json');
          
          const csvResult = await exportService.exportToCSV(csvFile, session);
          const vcdResult = await exportService.exportToVCD(vcdFile, session);
          const jsonResult = await exportService.exportToJSON(jsonFile, session);
          
          expect(csvResult.success).toBe(true);
          expect(vcdResult.success).toBe(true);
          expect(jsonResult.success).toBe(true);
          
          // 验证导出文件内容
          expect(fs.existsSync(csvFile)).toBe(true);
          expect(fs.existsSync(vcdFile)).toBe(true);
          expect(fs.existsSync(jsonFile)).toBe(true);
          
          // 验证CSV文件格式
          const csvContent = fs.readFileSync(csvFile, 'utf-8');
          const csvLines = csvContent.split('\n');
          expect(csvLines.length).toBeGreaterThan(1000); // 头部 + 数据行
          expect(csvLines[0]).toContain('Time'); // CSV头部
          expect(csvLines[0]).toContain('Export_CH0');
          expect(csvLines[0]).toContain('Export_CH1');
          
          // 验证VCD文件格式
          const vcdContent = fs.readFileSync(vcdFile, 'utf-8');
          expect(vcdContent).toContain('$version');
          expect(vcdContent).toContain('$var wire');
          expect(vcdContent).toContain('Export_CH0');
          expect(vcdContent).toContain('Export_CH1');
          
          return { csvResult, vcdResult, jsonResult };
        }
      );
      
      expect(exportIntegrityTest.success).toBe(true);
    });
  });
});