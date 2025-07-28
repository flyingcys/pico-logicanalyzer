/**
 * 第三阶段：数据采集和存储 - 自测验证
 * 验证所有实现模块的基本功能
 */

import { 
  CaptureSession, 
  AnalyzerChannel, 
  BurstInfo,
  OutputPacket,
  CaptureRequestBuilder 
} from '../src/models/CaptureModels';

import { 
  TriggerProcessor,
  TriggerProcessorFactory 
} from '../src/models/TriggerProcessor';

import { 
  DataStreamProcessor,
  DataStreamFactory 
} from '../src/models/DataStreamProcessor';

import { 
  BinaryDataParser,
  BinaryDataParserFactory 
} from '../src/models/BinaryDataParser';

import { 
  LACFileFormat 
} from '../src/models/LACFileFormat';

import { 
  DataCompressor,
  CompressionAlgorithm,
  CompressionFactory 
} from '../src/models/DataCompression';

import { 
  CaptureProgressMonitor,
  CapturePhase,
  DeviceStatus 
} from '../src/models/CaptureProgressMonitor';

import { TriggerType, CaptureMode } from '../src/models/AnalyzerTypes';

/**
 * 测试结果接口
 */
interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
}

/**
 * 第三阶段自测类
 */
class Stage3SelfTest {
  private results: TestResult[] = [];

  /**
   * 运行所有测试
   */
  public async runAllTests(): Promise<void> {
    console.log('🚀 开始第三阶段自测验证...\n');

    // 测试各个模块
    await this.testCaptureSession();
    await this.testTriggerProcessor();
    await this.testDataStreamProcessor();
    await this.testBinaryDataParser();
    await this.testLACFileFormat();
    await this.testDataCompression();
    await this.testProgressMonitor();

    // 输出测试结果
    this.outputResults();
  }

  /**
   * 测试CaptureSession配置管理
   */
  private async testCaptureSession(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('📋 测试CaptureSession配置管理...');

      // 创建CaptureSession
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 2000;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 0;
      session.loopCount = 2;

      // 添加通道
      const channel1 = new AnalyzerChannel(0, 'CLK');
      const channel2 = new AnalyzerChannel(1, 'DATA');
      session.captureChannels = [channel1, channel2];

      // 测试totalSamples计算
      const expectedTotal = session.postTriggerSamples * (session.loopCount + 1) + session.preTriggerSamples;
      if (session.totalSamples !== expectedTotal) {
        throw new Error(`totalSamples计算错误: expected ${expectedTotal}, got ${session.totalSamples}`);
      }

      // 测试clone方法
      const cloned = session.clone();
      if (cloned.frequency !== session.frequency || 
          cloned.captureChannels.length !== session.captureChannels.length) {
        throw new Error('clone方法失败');
      }

      // 测试cloneSettings方法
      const clonedSettings = session.cloneSettings();
      if (clonedSettings.captureChannels[0].samples !== undefined) {
        throw new Error('cloneSettings应该清空样本数据');
      }

      // 测试OutputPacket序列化
      const packet = new OutputPacket();
      packet.addByte(0x55);
      packet.addByte(0xAA);
      packet.addByte(0x01);
      
      const serialized = packet.serialize();
      if (serialized[0] !== 0x55 || serialized[1] !== 0xAA) {
        throw new Error('OutputPacket序列化失败');
      }

      // 测试CaptureRequestBuilder
      const requestData = CaptureRequestBuilder.buildCaptureRequest(session);
      if (requestData.length === 0) {
        throw new Error('CaptureRequestBuilder构建失败');
      }

      console.log('✅ CaptureSession测试通过');
      this.addResult('CaptureSession配置管理', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ CaptureSession测试失败:', error instanceof Error ? error.message : error);
      this.addResult('CaptureSession配置管理', false, performance.now() - startTime, 
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 测试TriggerProcessor
   */
  private async testTriggerProcessor(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('🎯 测试TriggerProcessor...');

      // 创建触发处理器
      const processor = TriggerProcessorFactory.createForDevice({
        channelCount: 24,
        maxFrequency: 100000000,
        blastFrequency: 200000000,
        bufferSize: 1024000
      });

      // 创建测试会话
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 2000;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 0;
      session.captureChannels = [new AnalyzerChannel(0, 'Test')];

      // 测试触发验证
      const validation = processor.validateTriggerSettings(session, 3000, {
        minPreSamples: 100,
        maxPreSamples: 10000,
        minPostSamples: 100,
        maxPostSamples: 100000,
        maxTotalSamples: 200000
      });

      if (!validation.isValid) {
        throw new Error(`触发验证失败: ${validation.errorMessage}`);
      }

      // 测试触发请求构建
      const requestData = processor.composeTriggerRequest(session, 3000, CaptureMode.Channels_8);
      if (requestData.length === 0) {
        throw new Error('触发请求构建失败');
      }

      // 测试复杂触发
      session.triggerType = TriggerType.Complex;
      session.triggerBitCount = 4;
      session.triggerPattern = 0x0F;
      
      const complexValidation = processor.validateTriggerSettings(session, 3000, {
        minPreSamples: 100,
        maxPreSamples: 10000,
        minPostSamples: 100,
        maxPostSamples: 100000,
        maxTotalSamples: 200000
      });

      if (!complexValidation.isValid) {
        throw new Error('复杂触发验证失败');
      }

      // 测试触发延迟补偿
      const delayOffset = processor.getTriggerDelayOffset(session);
      if (typeof delayOffset !== 'number') {
        throw new Error('触发延迟计算失败');
      }

      console.log('✅ TriggerProcessor测试通过');
      this.addResult('TriggerProcessor', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ TriggerProcessor测试失败:', error instanceof Error ? error.message : error);
      this.addResult('TriggerProcessor', false, performance.now() - startTime,
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 测试DataStreamProcessor
   */
  private async testDataStreamProcessor(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('📡 测试DataStreamProcessor...');

      // 创建数据流处理器
      const processor = new DataStreamProcessor();

      // 创建模拟数据流
      const testData = new Uint8Array([
        0x00, 0x00, 0x04, 0x00, // 样本数量: 1024
        0x55, 0xAA, 0xFF, 0x00, // 4个样本数据
        0x00 // 时间戳长度: 0
      ]);

      const dataStream = DataStreamFactory.createBufferStream(testData);

      // 创建测试会话
      const session = new CaptureSession();
      session.captureChannels = [new AnalyzerChannel(0, 'Test')];

      // 测试进度回调
      let progressCalled = false;
      const events = {
        onProgress: () => { progressCalled = true; },
        onCompleted: () => {},
        onError: () => {}
      };

      const processorWithEvents = new DataStreamProcessor({}, events);

      console.log('✅ DataStreamProcessor测试通过');
      this.addResult('DataStreamProcessor', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ DataStreamProcessor测试失败:', error instanceof Error ? error.message : error);
      this.addResult('DataStreamProcessor', false, performance.now() - startTime,
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 测试BinaryDataParser
   */
  private async testBinaryDataParser(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('🔍 测试BinaryDataParser...');

      // 创建解析器
      const parser = BinaryDataParserFactory.createForDevice('pico', 8);

      // 创建测试数据
      const testData = new Uint8Array([
        0x04, 0x00, 0x00, 0x00, // 样本数量: 4
        0x01, 0x02, 0x03, 0x04  // 样本数据
      ]);

      // 创建测试会话
      const session = new CaptureSession();
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];

      // 测试数据解析
      const result = await parser.parseBinaryData(testData, session, CaptureMode.Channels_8);
      
      if (!result.success) {
        throw new Error(`数据解析失败: ${result.warnings.join(', ')}`);
      }

      if (result.channels.length !== 2) {
        throw new Error(`通道数量错误: expected 2, got ${result.channels.length}`);
      }

      // 测试数据完整性验证
      const integrity = parser.validateDataIntegrity(result.channels);
      if (!integrity.isValid) {
        throw new Error(`数据完整性验证失败: ${integrity.errors.join(', ')}`);
      }

      console.log('✅ BinaryDataParser测试通过');
      this.addResult('BinaryDataParser', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ BinaryDataParser测试失败:', error instanceof Error ? error.message : error);
      this.addResult('BinaryDataParser', false, performance.now() - startTime,
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 测试LACFileFormat
   */
  private async testLACFileFormat(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('💾 测试LACFileFormat...');

      // 创建测试数据
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 2000;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 0;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CLK'),
        new AnalyzerChannel(1, 'DATA')
      ];

      // 转换为LAC格式
      const lacData = LACFileFormat['convertCaptureSessionToLAC'](session);
      
      if (!lacData.version || !lacData.deviceInfo || !lacData.captureSession) {
        throw new Error('LAC格式转换失败');
      }

      // 测试版本支持
      const supportedVersions = LACFileFormat.getSupportedVersions();
      if (supportedVersions.length === 0) {
        throw new Error('支持的版本列表为空');
      }

      const currentVersion = LACFileFormat.getCurrentVersion();
      if (!supportedVersions.includes(currentVersion)) {
        throw new Error('当前版本不在支持列表中');
      }

      // 测试转换回CaptureSession
      const convertedSession = LACFileFormat.convertLACToCaptureSession(lacData);
      if (convertedSession.frequency !== session.frequency) {
        throw new Error('LAC到CaptureSession转换失败');
      }

      console.log('✅ LACFileFormat测试通过');
      this.addResult('LACFileFormat', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ LACFileFormat测试失败:', error instanceof Error ? error.message : error);
      this.addResult('LACFileFormat', false, performance.now() - startTime,
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 测试DataCompression
   */
  private async testDataCompression(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('🗜️ 测试DataCompression...');

      // 创建压缩器
      const compressor = CompressionFactory.createForLogicSignals();

      // 创建测试数据 - 包含重复模式的逻辑信号
      const testData = new Uint8Array(1000);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 10 < 5 ? 1 : 0; // 重复的高低电平模式
      }

      // 测试RLE压缩
      const rleResult = await compressor.compressChannelData(testData, CompressionAlgorithm.RLE);
      if (!rleResult.success) {
        throw new Error('RLE压缩失败');
      }

      // 测试解压
      const decompressed = await compressor.decompressChannelData(
        rleResult.data, 
        CompressionAlgorithm.RLE, 
        testData.length,
        rleResult.metadata
      );

      if (!decompressed.success || !decompressed.isValid) {
        throw new Error('RLE解压失败');
      }

      // 验证数据一致性
      if (decompressed.data.length !== testData.length) {
        throw new Error(`解压后数据长度不匹配: expected ${testData.length}, got ${decompressed.data.length}`);
      }

      // 测试自适应压缩
      const adaptiveResult = await compressor.compressAdaptive(testData);
      if (!adaptiveResult.success) {
        throw new Error('自适应压缩失败');
      }

      console.log(`压缩比: ${(adaptiveResult.compressionRatio * 100).toFixed(1)}%`);
      console.log('✅ DataCompression测试通过');
      this.addResult('DataCompression', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ DataCompression测试失败:', error instanceof Error ? error.message : error);
      this.addResult('DataCompression', false, performance.now() - startTime,
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 测试CaptureProgressMonitor
   */
  private async testProgressMonitor(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('📊 测试CaptureProgressMonitor...');

      // 创建进度监控器
      const monitor = new CaptureProgressMonitor({ enableRealtime: false });

      // 创建测试会话
      const session = new CaptureSession();
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 2000;
      session.captureChannels = [new AnalyzerChannel(0, 'Test')];

      const sessionId = 'test-session-001';
      const deviceId = 'test-device-001';

      // 测试开始监控
      monitor.startMonitoring(sessionId, deviceId, session);
      
      const activeCaptures = monitor.getActiveCaptures();
      if (activeCaptures.length !== 1) {
        throw new Error(`活跃采集数量错误: expected 1, got ${activeCaptures.length}`);
      }

      // 测试进度更新
      monitor.updateProgress(sessionId, {
        currentSample: 500,
        phase: CapturePhase.Capturing
      });

      const updatedCaptures = monitor.getActiveCaptures();
      if (updatedCaptures[0].currentSample !== 500) {
        throw new Error('进度更新失败');
      }

      // 测试设备状态更新
      monitor.updateDeviceStatus(deviceId, {
        name: 'Test Device',
        type: 'Serial' as any,
        isNetwork: false,
        capabilities: {} as any
      }, {
        status: DeviceStatus.Capturing,
        temperature: 45
      });

      const deviceStatuses = monitor.getDeviceStatuses();
      if (deviceStatuses.length !== 1) {
        throw new Error('设备状态更新失败');
      }

      // 测试系统状态报告
      const statusReport = monitor.generateStatusReport();
      if (statusReport.activeCaptures !== 1 || statusReport.connectedDevices !== 1) {
        throw new Error('系统状态报告错误');
      }

      // 测试完成采集
      monitor.completeCapture(sessionId, true);
      
      const finalCaptures = monitor.getActiveCaptures();
      if (finalCaptures.length !== 0) {
        throw new Error('采集完成后应该清除活跃列表');
      }

      // 测试性能统计
      const perfStats = monitor.getPerformanceStatistics();
      if (typeof perfStats.totalCaptures !== 'number') {
        throw new Error('性能统计获取失败');
      }

      // 清理
      monitor.destroy();

      console.log('✅ CaptureProgressMonitor测试通过');
      this.addResult('CaptureProgressMonitor', true, performance.now() - startTime);

    } catch (error) {
      console.log('❌ CaptureProgressMonitor测试失败:', error instanceof Error ? error.message : error);
      this.addResult('CaptureProgressMonitor', false, performance.now() - startTime,
        error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 添加测试结果
   */
  private addResult(testName: string, passed: boolean, duration: number, error?: string): void {
    this.results.push({
      testName,
      passed,
      duration,
      error
    });
  }

  /**
   * 输出测试结果
   */
  private outputResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📋 第三阶段自测结果总结');
    console.log('='.repeat(80));

    const passedTests = this.results.filter(r => r.passed);
    const failedTests = this.results.filter(r => !r.passed);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`✅ 通过测试: ${passedTests.length}/${this.results.length}`);
    console.log(`❌ 失败测试: ${failedTests.length}/${this.results.length}`);
    console.log(`⏱️ 总耗时: ${totalDuration.toFixed(2)}ms`);
    console.log('');

    // 详细结果
    this.results.forEach((result) => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration.toFixed(2);
      console.log(`${status} ${result.testName} (${duration}ms)`);
      
      if (!result.passed && result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    if (failedTests.length === 0) {
      console.log('🎉 所有测试通过！第三阶段功能验证成功！');
    } else {
      console.log('⚠️ 部分测试失败，请检查错误信息并修复问题。');
    }
    console.log('='.repeat(80));
  }
}

// 运行自测
if (require.main === module) {
  const selfTest = new Stage3SelfTest();
  selfTest.runAllTests()
    .then(() => {
      console.log('\n🏁 第三阶段自测完成');
    })
    .catch((error) => {
      console.error('💥 自测过程中发生错误:', error);
      process.exit(1);
    });
}

export default Stage3SelfTest;