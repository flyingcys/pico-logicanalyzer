/**
 * 数据导出端到端集成测试
 * 测试从UI到后端服务的完整导出流程
 * 
 * 端到端测试场景：
 * 1. 完整的用户导出工作流
 * 2. 大数据集的端到端导出
 * 3. 多格式并发导出
 * 4. 错误场景的端到端处理
 * 5. 性能基准测试
 */

import fs from 'fs';
import path from 'path';
import { DataExportService, ExportOptions, ExportResult } from '../../src/services/DataExportService';
import { CaptureSession, AnalyzerChannel } from '../../src/models/AnalyzerTypes';
import { DecoderResult } from '../../src/decoders/types';

describe('Data Export End-to-End Tests', () => {
  let exportService: DataExportService;
  let testOutputDir: string;
  let mockRealSession: CaptureSession;

  beforeAll(async () => {
    // 创建测试输出目录
    testOutputDir = path.join(__dirname, '../temp/e2e-exports');
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  beforeEach(() => {
    exportService = new DataExportService();

    // 创建更真实的测试数据
    const realChannels: AnalyzerChannel[] = [];
    
    // 模拟8通道逻辑分析仪数据
    for (let channelId = 0; channelId < 8; channelId++) {
      const samples = new Uint8Array(50000);
      
      // 为每个通道生成不同的信号模式
      for (let i = 0; i < samples.length; i++) {
        switch (channelId) {
          case 0: // 时钟信号
            samples[i] = i % 2;
            break;
          case 1: // 数据信号
            samples[i] = Math.sin(i * 0.01) > 0 ? 1 : 0;
            break;
          case 2: // 使能信号
            samples[i] = Math.floor(i / 100) % 2;
            break;
          case 3: // 地址总线
            samples[i] = Math.floor(i / 1000) % 2;
            break;
          default: // 其他信号
            samples[i] = Math.random() > 0.7 ? 1 : 0;
        }
      }

      realChannels.push({
        id: channelId,
        name: ['CLK', 'DATA', 'EN', 'ADDR', 'CS', 'WR', 'RD', 'INT'][channelId],
        enabled: true,
        hidden: false,
        color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#800000', '#008000'][channelId],
        groupIndex: channelId < 4 ? 0 : 1,
        groupName: channelId < 4 ? 'Control' : 'Data',
        bitIndex: channelId,
        inverted: false,
        threshold: 1.65,
        hysteresis: 0.1,
        samples
      });
    }

    mockRealSession = {
      id: 'e2e-test-session',
      deviceId: 'pico-logic-analyzer',
      startTime: new Date('2025-01-01T10:00:00Z'),
      endTime: new Date('2025-01-01T10:00:00.050Z'),
      sampleRate: 1000000, // 1MHz
      channelCount: 8,
      totalSamples: 50000,
      status: 'completed',
      triggerPosition: 25000,
      timespan: 0.05,
      channels: realChannels,
      captureChannels: realChannels
    };
  });

  afterAll(async () => {
    // 清理测试输出文件
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testOutputDir, file));
      }
      fs.rmdirSync(testOutputDir);
    }
  });

  describe('Complete User Workflow Tests', () => {
    it('应完成完整的CSV导出工作流', async () => {
      // Arrange - 模拟用户选择和配置
      const userOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'e2e_workflow.csv'),
        timeRange: 'custom',
        customStart: 10000,
        customEnd: 40000,
        selectedChannels: [0, 1, 2, 3], // 选择前4个通道
        samplingMode: 'original'
      };

      // Act - 执行完整导出流程
      const result = await exportService.exportWaveformData(mockRealSession, 'csv', userOptions);

      // Assert - 验证导出结果
      expect(result.success).toBe(true);
      expect(result.filename).toContain('e2e_workflow.csv');
      expect(result.size).toBeGreaterThan(0);
      
      // 验证文件内容
      if (typeof result.data === 'string') {
        const lines = result.data.split('\n');
        
        // 验证头部
        expect(lines[0]).toContain('Time');
        expect(lines[0]).toContain('CLK');
        expect(lines[0]).toContain('DATA');
        expect(lines[0]).toContain('EN');
        expect(lines[0]).toContain('ADDR');
        
        // 验证数据行数符合时间范围
        const dataLines = lines.filter(line => line.trim() && !line.startsWith('Time'));
        expect(dataLines.length).toBeLessThanOrEqual(30000); // customEnd - customStart
        expect(dataLines.length).toBeGreaterThan(0);
        
        // 验证数据格式
        const sampleLine = dataLines[0].split(',');
        expect(sampleLine.length).toBe(5); // Time + 4 channels
        expect(parseFloat(sampleLine[0])).toBeGreaterThanOrEqual(0.01); // 时间戳应合理
      }
    });

    it('应完成完整的VCD导出工作流', async () => {
      // Arrange
      const userOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'e2e_workflow.vcd'),
        timeRange: 'all',
        selectedChannels: [0, 1, 2, 3, 4, 5, 6, 7]
      };

      // Act
      const result = await exportService.exportWaveformData(mockRealSession, 'vcd', userOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/vcd');
      
      if (typeof result.data === 'string') {
        // 验证VCD文件格式
        expect(result.data).toContain('$date');
        expect(result.data).toContain('$version');
        expect(result.data).toContain('$timescale');
        expect(result.data).toContain('$enddefinitions');
        expect(result.data).toContain('$dumpvars');
        
        // 验证所有通道都被定义
        ['CLK', 'DATA', 'EN', 'ADDR', 'CS', 'WR', 'RD', 'INT'].forEach(channelName => {
          expect(result.data).toContain(channelName);
        });
        
        // 验证时间戳格式
        expect(result.data).toMatch(/#\d+/); // 应包含时间戳
      }
    });

    it('应完成完整的LAC格式导出工作流', async () => {
      // Arrange
      const userOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'e2e_workflow.lac'),
        timeRange: 'all',
        selectedChannels: [0, 1, 2, 3, 4, 5, 6, 7],
        samplingMode: 'compressed',
        advancedOptions: ['enable_compression']
      };

      // Act
      const result = await exportService.exportWaveformData(mockRealSession, 'lac', userOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/octet-stream');
      expect(result.data).toBeInstanceOf(Uint8Array);
      
      // LAC文件应该包含压缩的二进制数据
      const binaryData = result.data as Uint8Array;
      expect(binaryData.length).toBeGreaterThan(0);
      expect(binaryData.length).toBeLessThan(mockRealSession.totalSamples * mockRealSession.channelCount); // 压缩后应该更小
    });
  });

  describe('Large Dataset E2E Tests', () => {
    it('应处理大数据集的完整导出流程', async () => {
      // Arrange - 创建大数据集
      const largeChannels: AnalyzerChannel[] = [];
      for (let i = 0; i < 16; i++) {
        const largeSamples = new Uint8Array(200000); // 200K样本每通道
        
        // 生成复杂的信号模式
        for (let j = 0; j < largeSamples.length; j++) {
          largeSamples[j] = (j + i) % 3 === 0 ? 1 : 0;
        }

        largeChannels.push({
          id: i,
          name: `CH${i.toString().padStart(2, '0')}`,
          enabled: true,
          hidden: false,
          color: `#${(i * 16).toString(16).padStart(6, '0')}`,
          groupIndex: Math.floor(i / 8),
          groupName: i < 8 ? 'Group A' : 'Group B',
          bitIndex: i,
          inverted: false,
          threshold: 1.65,
          hysteresis: 0.1,
          samples: largeSamples
        });
      }

      const largeSession: CaptureSession = {
        ...mockRealSession,
        id: 'large-e2e-session',
        channelCount: 16,
        totalSamples: 200000,
        channels: largeChannels,
        captureChannels: largeChannels,
        timespan: 0.2 // 200ms
      };

      const progressUpdates: Array<{ progress: number; message: string }> = [];
      const userOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'large_dataset_e2e.csv'),
        timeRange: 'all',
        chunkSize: 10000,
        useStreaming: true,
        onProgress: (progress, message) => {
          progressUpdates.push({ progress, message });
        }
      };

      // Act
      const startTime = Date.now();
      const result = await exportService.exportWaveformData(largeSession, 'csv', userOptions);
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(30000); // 应在30秒内完成
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // 验证进度更新的合理性
      expect(progressUpdates[0].progress).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100);
      
      // 验证数据量
      if (typeof result.data === 'string') {
        const lines = result.data.split('\n');
        const dataLines = lines.filter(line => line.trim() && !line.startsWith('Time'));
        expect(dataLines.length).toBe(200000);
      }
    });

    it('应支持大数据集的取消功能', async () => {
      // Arrange
      const cancelToken = { cancelled: false };
      const userOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'cancelled_export.csv'),
        timeRange: 'all',
        cancelToken,
        chunkSize: 5000
      };

      // Act
      const exportPromise = exportService.exportWaveformData(mockRealSession, 'csv', userOptions);
      
      // 模拟用户在500ms后取消
      setTimeout(() => {
        cancelToken.cancelled = true;
      }, 500);

      const result = await exportPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/取消|中断|cancel/i);
    });
  });

  describe('Multi-Format Concurrent Export E2E', () => {
    it('应支持多格式并发导出', async () => {
      // Arrange
      const formats = ['csv', 'json', 'vcd', 'txt'];
      const exportPromises = formats.map(format => {
        const options: ExportOptions = {
          filename: path.join(testOutputDir, `concurrent_${format}.${format}`),
          timeRange: 'all',
          selectedChannels: [0, 1, 2, 3]
        };
        
        return exportService.exportWaveformData(mockRealSession, format, options);
      });

      // Act
      const startTime = Date.now();
      const results = await Promise.all(exportPromises);
      const totalTime = Date.now() - startTime;

      // Assert
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.filename).toContain(formats[index]);
        expect(result.size).toBeGreaterThan(0);
      });

      // 并发导出应该比串行导出快
      expect(totalTime).toBeLessThan(10000); // 应在10秒内完成所有格式
    });

    it('应处理并发导出中的部分失败', async () => {
      // Arrange
      const exportConfigs = [
        {
          format: 'csv',
          options: { filename: path.join(testOutputDir, 'success1.csv'), timeRange: 'all' as const }
        },
        {
          format: 'unknown', // 不支持的格式
          options: { filename: path.join(testOutputDir, 'fail.unknown'), timeRange: 'all' as const }
        },
        {
          format: 'json',
          options: { filename: path.join(testOutputDir, 'success2.json'), timeRange: 'all' as const }
        }
      ];

      const exportPromises = exportConfigs.map(config => 
        exportService.exportWaveformData(mockRealSession, config.format, config.options)
      );

      // Act
      const results = await Promise.allSettled(exportPromises);

      // Assert
      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<ExportResult>).value.success).toBe(true);
      
      expect(results[1].status).toBe('fulfilled');
      expect((results[1] as PromiseFulfilledResult<ExportResult>).value.success).toBe(false);
      
      expect(results[2].status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<ExportResult>).value.success).toBe(true);
    });
  });

  describe('Decoder Results E2E Export', () => {
    it('应完成解码结果的端到端导出', async () => {
      // Arrange - 创建模拟解码结果
      const decoderResults = new Map<string, DecoderResult[]>();
      
      // I2C解码结果
      const i2cResults: DecoderResult[] = [];
      for (let i = 0; i < 100; i++) {
        i2cResults.push({
          id: `i2c_${i}`,
          decoderId: 'i2c',
          startSample: i * 500,
          endSample: i * 500 + 100,
          data: {
            type: ['start', 'address', 'data', 'ack', 'stop'][i % 5],
            address: 0x48 + (i % 4),
            value: Math.floor(Math.random() * 256)
          },
          annotation: `I2C ${['START', 'ADDR', 'DATA', 'ACK', 'STOP'][i % 5]}`,
          level: 'data'
        });
      }

      // UART解码结果
      const uartResults: DecoderResult[] = [];
      for (let i = 0; i < 50; i++) {
        uartResults.push({
          id: `uart_${i}`,
          decoderId: 'uart',
          startSample: i * 1000,
          endSample: i * 1000 + 80,
          data: {
            type: 'data',
            value: String.fromCharCode(65 + (i % 26)), // A-Z
            parity: 'none',
            stop: 1
          },
          annotation: `UART: ${String.fromCharCode(65 + (i % 26))}`,
          level: 'data'
        });
      }

      decoderResults.set('i2c', i2cResults);
      decoderResults.set('uart', uartResults);

      const userOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'decoder_results_e2e.csv'),
        timeRange: 'all',
        selectedDecoders: ['i2c', 'uart']
      };

      // Act
      const result = await exportService.exportDecoderResults(decoderResults, 'csv', userOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/csv');
      
      if (typeof result.data === 'string') {
        const lines = result.data.split('\n');
        
        // 验证头部
        expect(lines[0]).toContain('Decoder');
        expect(lines[0]).toContain('Start Sample');
        expect(lines[0]).toContain('End Sample');
        expect(lines[0]).toContain('Annotation');
        
        // 验证数据内容
        expect(result.data).toContain('I2C');
        expect(result.data).toContain('UART');
        expect(result.data).toContain('START');
        expect(result.data).toContain('ADDR');
        
        // 验证数据行数
        const dataLines = lines.filter(line => line.trim() && !line.startsWith('Decoder'));
        expect(dataLines.length).toBe(150); // 100 I2C + 50 UART
      }
    });
  });

  describe('Error Scenarios E2E', () => {
    it('应处理导出过程中的IO错误', async () => {
      // Arrange - 使用无效路径
      const invalidOptions: ExportOptions = {
        filename: '/invalid/path/that/does/not/exist/export.csv',
        timeRange: 'all'
      };

      // Act
      const result = await exportService.exportWaveformData(mockRealSession, 'csv', invalidOptions);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/路径|path|无效|invalid|文件|file/i);
    });

    it('应处理内存不足的情况', async () => {
      // Arrange - 创建超大数据集
      const hugeSession: CaptureSession = {
        ...mockRealSession,
        totalSamples: Number.MAX_SAFE_INTEGER / 10000,
        channelCount: 256
      };

      const options: ExportOptions = {
        filename: path.join(testOutputDir, 'memory_overflow.csv'),
        timeRange: 'all'
      };

      // Act
      const result = await exportService.exportWaveformData(hugeSession, 'csv', options);

      // Assert
      if (!result.success) {
        expect(result.error).toMatch(/内存|memory|过大|too large|不足|insufficient/i);
      }
    });

    it('应处理格式验证错误', async () => {
      // Arrange
      const invalidOptions: ExportOptions = {
        filename: '', // 空文件名
        timeRange: 'custom',
        // 缺少customStart和customEnd
        selectedChannels: [-1, 999] // 无效通道号
      };

      // Act
      const result = await exportService.exportWaveformData(mockRealSession, 'csv', invalidOptions);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/验证|validation|选项|options|无效|invalid/i);
    });
  });

  describe('Performance Benchmarks E2E', () => {
    it('应满足性能基准要求', async () => {
      // Arrange - 性能测试数据集
      const performanceChannels: AnalyzerChannel[] = [];
      for (let i = 0; i < 8; i++) {
        const samples = new Uint8Array(500000); // 500K samples per channel
        
        for (let j = 0; j < samples.length; j++) {
          samples[j] = Math.sin(j * 0.001 + i * Math.PI / 4) > 0 ? 1 : 0;
        }

        performanceChannels.push({
          id: i,
          name: `PERF_CH${i}`,
          enabled: true,
          hidden: false,
          color: `#${(i * 32).toString(16).padStart(6, '0')}`,
          groupIndex: 0,
          groupName: 'Performance',
          bitIndex: i,
          inverted: false,
          threshold: 1.65,
          hysteresis: 0.1,
          samples
        });
      }

      const performanceSession: CaptureSession = {
        ...mockRealSession,
        id: 'performance-benchmark',
        channelCount: 8,
        totalSamples: 500000,
        channels: performanceChannels,
        captureChannels: performanceChannels,
        timespan: 0.5
      };

      const benchmarkOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'performance_benchmark.csv'),
        timeRange: 'all',
        chunkSize: 25000,
        useStreaming: true
      };

      // Act
      const startTime = Date.now();
      const result = await exportService.exportWaveformData(performanceSession, 'csv', benchmarkOptions);
      const processingTime = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      
      // 性能要求：500K样本 * 8通道应在20秒内完成
      expect(processingTime).toBeLessThan(20000);
      
      // 计算吞吐量
      const totalSamples = performanceSession.totalSamples * performanceSession.channelCount;
      const throughput = totalSamples / (processingTime / 1000);
      expect(throughput).toBeGreaterThan(100000); // 至少10万样本/秒
      
      console.log(`Performance Benchmark Results:`);
      console.log(`  Total Samples: ${totalSamples.toLocaleString()}`);
      console.log(`  Processing Time: ${processingTime}ms`);
      console.log(`  Throughput: ${Math.round(throughput).toLocaleString()} samples/sec`);
    });

    it('应支持内存高效的大文件导出', async () => {
      // Arrange
      const memoryEfficientOptions: ExportOptions = {
        filename: path.join(testOutputDir, 'memory_efficient.csv'),
        timeRange: 'all',
        chunkSize: 1000, // 小块大小以测试内存效率
        useStreaming: true
      };

      // Act
      const result = await exportService.exportWaveformData(mockRealSession, 'csv', memoryEfficientOptions);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      
      // 验证结果数据的完整性
      if (typeof result.data === 'string') {
        const lines = result.data.split('\n');
        const dataLines = lines.filter(line => line.trim() && !line.startsWith('Time'));
        expect(dataLines.length).toBe(mockRealSession.totalSamples);
      }
    });
  });
});