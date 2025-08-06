/**
 * DataExportService 终极100%覆盖率测试
 * 专门针对剩余的88.76%到100%之间的未覆盖代码行
 * 剩余未覆盖行：132,159-160,212-213,222-223,232-233,239,242,245,256,321,332-333,341,362,374-386,446,722,752,770,779,790,798,912,947,995-996,1003,1010,1155-1156,1718,1758,1765,1887,1897-1902,1912-1917,1922,1927,1936-1961,1974-2005
 */

import { DataExportService, dataExportService, exportData, exportSession, exportDecoders, smartExport, batchExport } from '../../../src/services/DataExportService';
import { AnalyzerChannel, CaptureSession } from '../../../src/models/AnalyzerTypes';
import { DecoderResult } from '../../../src/decoders/types';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('../../../src/services/ExportPerformanceOptimizer', () => ({
  exportPerformanceOptimizer: {
    optimizeForFormat: jest.fn(),
    getChunkSize: jest.fn().mockReturnValue(1000),
    shouldUseStreaming: jest.fn().mockReturnValue(false),
    configurePerformance: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataExportService - 终极100%覆盖率测试', () => {
  let service: DataExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DataExportService();
    
    // Mock文件系统操作
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('mock data');
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ size: 1024 } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 创建基础测试数据
  const createTestSession = (): CaptureSession => ({
    frequency: 1000000,
    preTriggerSamples: 1000,
    postTriggerSamples: 1000,
    captureChannels: [
      {
        channelNumber: 0,
        channelName: 'CH0',
        enabled: true,
        hidden: false,
        samples: new Uint8Array([0x55, 0xAA, 0xFF, 0x00])
      },
      {
        channelNumber: 1,
        channelName: 'CH1',
        enabled: true,
        hidden: false,
        samples: new Uint8Array([0xFF, 0x00, 0x55, 0xAA])
      }
    ],
    triggerType: 0,
    triggerChannel: 0,
    triggerInverted: false,
    triggerValue: 1,
    name: 'Test Session',
    deviceVersion: '1.0',
    deviceSerial: 'TEST001'
  });

  describe('未覆盖的数据转换路径测试 - 覆盖行132,159-160,212-213,222-223,232-233,239,242,245', () => {
    it('应该处理ExportedCapture格式转换的异常情况', () => {
      // 测试行132 - createDefaultCaptureSession中的异常分支
      const problematicInput = {
        settings: null, // 这会导致转换异常
        decoderResults: 'invalid_string', // 这会导致转换异常
        samples: 'not_array', // 这会导致转换异常
        channels: 'not_array' // 这会导致转换异常
      };

      const result = service.convertUnifiedData(problematicInput);
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('应该处理samples转换器的特殊输入格式', () => {
      // 覆盖行159-160
      const converter = (service as any).dataConverters.get('samples');
      
      const arrayWithUint8Array = [new Uint8Array([1, 2, 3])];
      const result1 = converter(arrayWithUint8Array);
      expect(result1[0]).toBeInstanceOf(Uint8Array);
      
      const arrayWithNumbers = [[4, 5, 6]];
      const result2 = converter(arrayWithNumbers);
      expect(result2[0]).toBeInstanceOf(Uint8Array);
    });
  });

  describe('智能导出和数据转换异常处理 - 覆盖行256,321,332-333,341', () => {
    it('应该处理convertUnifiedData中的各种异常', () => {
      // 创建一个会引发异常的输入
      const problematicInput = {
        get session() { throw new Error('Test error in session getter'); },
        decoderResults: undefined,
        samples: undefined,
        channels: undefined
      };

      const result = service.convertUnifiedData(problematicInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('数据转换失败');
    });

    it('应该处理exportFlexible中数据转换失败的情况', async () => {
      // 创建一个会导致转换失败的输入
      const input = {
        session: {
          get frequency() { throw new Error('Conversion error'); }
        }
      };

      const result = await service.exportFlexible(input, 'csv', {
        filename: 'test.csv',
        timeRange: 'all'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('数据转换失败');
    });

    it('应该处理带警告的转换过程和进度回调', async () => {
      const progressMock = jest.fn();
      
      const input = {
        session: null, // 这会产生警告
        decoderResults: 'invalid'
      };

      const result = await service.exportFlexible(input, 'csv', {
        filename: 'test.csv',
        timeRange: 'all',
        onProgress: progressMock
      });

      // 验证进度回调被调用
      expect(progressMock).toHaveBeenCalled();
    });
  });

  describe('导出格式分支和项目导出测试 - 覆盖行362,374-386', () => {
    it('应该处理各种导出格式的分支路径', async () => {
      const session = createTestSession();
      const decoderResults = new Map([
        ['uart', [{ startSample: 0, endSample: 100, annotationType: 'data', values: ['0x55'] }]]
      ]);
      const analysisData = { totalSamples: 2000, sampleRate: 1000000 };

      // 测试不同的导出格式分支
      const formats = [
        { input: session, format: 'waveform' },
        { input: session, format: 'lac' },
        { input: { session, decoderResults }, format: 'decoder' },
        { input: { session, analysisData }, format: 'report' },
        { input: { session, decoderResults, analysisData }, format: 'project' },
        { input: { session, decoderResults, analysisData }, format: 'complete' }
      ];

      for (const { input, format } of formats) {
        const result = await service.exportFlexible(input, format, {
          filename: `test.${format}`,
          timeRange: 'all'
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('格式信息和性能配置测试 - 覆盖行446', () => {
    it('应该获取所有支持格式的信息', () => {
      const formats = service.getSupportedFormats();
      expect(formats).toContain('lac');
      expect(formats).toContain('csv');
      expect(formats).toContain('json');
      expect(formats).toContain('vcd');
      expect(formats).toContain('project');

      // 测试每种格式的信息获取
      for (const format of formats) {
        const info = service.getFormatInfo(format);
        expect(info.name).toBeDefined();
        expect(info.description).toBeDefined();
        expect(info.mimeType).toBeDefined();
        expect(info.extension).toBeDefined();
      }

      // 测试未知格式
      const unknownInfo = service.getFormatInfo('unknown_format');
      expect(unknownInfo.name).toBe('未知格式');
    });
  });

  describe('HTML报告生成的特殊分支 - 覆盖行722,752,770,779,790,798', () => {
    it('应该处理不同reportSections的HTML报告生成', async () => {
      const analysisData = {
        totalSamples: 100000,
        sampleRate: 1000000,
        duration: 0.1,
        activeChannels: 8,
        avgFrequency: 500000,
        maxFrequency: 1000000,
        dataRate: '1MB/s'
      };

      // 测试包含所有部分的报告
      const allSectionsResult = await service.exportAnalysisReport(analysisData, 'html', {
        filename: 'full_report.html',
        reportSections: ['overview', 'performance', 'statistics', 'recommendations', 'charts'],
        timeRange: 'all'
      });
      
      expect(allSectionsResult.success).toBe(true);
      expect(allSectionsResult.data).toContain('概览信息');
      expect(allSectionsResult.data).toContain('性能分析');
      expect(allSectionsResult.data).toContain('统计数据');
      expect(allSectionsResult.data).toContain('优化建议');
      expect(allSectionsResult.data).toContain('图表数据');

      // 测试只包含部分内容的报告
      const partialResult = await service.exportAnalysisReport(analysisData, 'html', {
        filename: 'partial_report.html',
        reportSections: ['overview', 'statistics'],
        timeRange: 'all'
      });
      
      expect(partialResult.success).toBe(true);
      expect(partialResult.data).toContain('概览信息');
      expect(partialResult.data).toContain('统计数据');
      expect(partialResult.data).not.toContain('性能分析');
    });
  });

  describe('CSV导出错误处理和VCD变化检测 - 覆盖行912,947,995-996,1003,1010', () => {
    it('应该处理CSV导出中的极端情况', async () => {
      const session = createTestSession();
      
      // 测试大数据量时的分块处理和进度报告
      const largeSession = {
        ...session,
        captureChannels: [{
          channelNumber: 0,
          channelName: 'CH0',
          enabled: true,
          hidden: false,
          samples: new Uint8Array(10000).fill(0xAA) // 大数据量
        }]
      };

      const progressCallback = jest.fn();
      
      const result = await service.exportWaveformData(largeSession, 'csv', {
        filename: 'large.csv',
        timeRange: 'all',
        chunkSize: 100, // 小分块以触发更多循环
        onProgress: progressCallback
      });

      expect(result.success).toBe(true);
      expect(progressCallback).toHaveBeenCalled();
    });

    it('应该处理JSON导出中的极端分块情况', async () => {
      const session = createTestSession();
      
      const largeSession = {
        ...session,
        captureChannels: [{
          channelNumber: 0,
          channelName: 'CH0',
          enabled: true,
          hidden: false,
          samples: new Uint8Array(5000).fill(0x55)
        }]
      };

      const result = await service.exportWaveformData(largeSession, 'json', {
        filename: 'large.json',
        timeRange: 'all',
        chunkSize: 50 // 小分块
      });

      expect(result.success).toBe(true);
    });
  });

  describe('VCD格式的高级特性和压缩 - 覆盖行1155-1156', () => {
    it('应该处理VCD导出中的极端通道数量', async () => {
      // 创建超过94个通道的会话以触发双字符变量ID生成
      const manyChannelsSession: CaptureSession = {
        ...createTestSession(),
        captureChannels: Array.from({ length: 100 }, (_, i) => ({
          channelNumber: i,
          channelName: `CH${i}`,
          enabled: true,
          hidden: false,
          samples: new Uint8Array([0x55, 0xAA, 0xFF, 0x00])
        }))
      };

      const result = await service.exportWaveformData(manyChannelsSession, 'vcd', {
        filename: 'many_channels.vcd',
        timeRange: 'all',
        selectedChannels: Array.from({ length: 100 }, (_, i) => i)
      });

      expect(result.success).toBe(true);
      expect(result.compressionRatio).toBeDefined();
    });
  });

  describe('解码器结果处理的特殊情况 - 覆盖行1718,1758,1765', () => {
    it('应该处理解码器结果的边界条件', async () => {
      const specialDecoderResults = new Map([
        ['uart', [
          {
            startSample: 0,
            endSample: 100,
            annotationType: 'data',
            values: ['0x55'],
            rawData: { hex: '55', binary: '01010101' }
          },
          {
            startSample: 100,
            endSample: 200,
            annotationType: 'error',
            values: ['parity_error'],
            rawData: null
          }
        ]]
      ]);

      // 测试包含详细信息的导出
      const jsonResult = await service.exportDecoderResults(specialDecoderResults, 'json', {
        filename: 'decoders.json',
        selectedDecoders: ['uart'],
        includeDetails: ['timestamps', 'raw_data'],
        timeRange: 'all'
      });

      expect(jsonResult.success).toBe(true);
      
      const textResult = await service.exportDecoderResults(specialDecoderResults, 'txt', {
        filename: 'decoders.txt',
        selectedDecoders: ['uart'],
        includeDetails: ['timestamps', 'raw_data'],
        timeRange: 'all'
      });

      expect(textResult.success).toBe(true);
    });
  });

  describe('便捷导出函数测试 - 覆盖行1887,1897-1902,1912-1917,1922,1927', () => {
    it('应该测试所有便捷导出函数', async () => {
      const session = createTestSession();
      const decoderResults = new Map([
        ['uart', [{ startSample: 0, endSample: 100, annotationType: 'data', values: ['0x55'] }]]
      ]);

      // 测试exportData函数
      const exportDataResult = await exportData(session, 'csv', {
        filename: 'export_data.csv',
        timeRange: 'all'
      });
      expect(exportDataResult.success).toBe(true);

      // 测试exportSession函数
      const exportSessionResult = await exportSession(session, 'json', 'export_session.json', {
        selectedChannels: [0, 1]
      });
      expect(exportSessionResult.success).toBe(true);

      // 测试exportDecoders函数
      const exportDecodersResult = await exportDecoders(decoderResults, 'csv', 'export_decoders.csv', ['uart']);
      expect(exportDecodersResult.success).toBe(true);
    });
  });

  describe('智能导出和批量导出测试 - 覆盖行1936-1961,1974-2005', () => {
    it('应该测试smartExport函数的格式检测', async () => {
      const session = createTestSession();
      const decoderResults = new Map([['uart', []]]);
      const analysisData = { stats: 'test' };

      // 测试不同数据类型的智能格式选择
      const sessionResult = await smartExport(session, 'smart_session.lac');
      expect(sessionResult.success).toBe(true);

      const decoderResult = await smartExport(decoderResults, 'smart_decoder.csv');
      expect(decoderResult.success).toBe(true);

      const analysisResult = await smartExport(analysisData, 'smart_analysis.html');
      expect(analysisResult.success).toBe(true);

      const unknownResult = await smartExport({ randomData: 'test' }, 'smart_unknown.json');
      expect(unknownResult.success).toBe(true);
    });

    it('应该测试batchExport函数', async () => {
      const session = createTestSession();
      const progressCallback = jest.fn();

      const exports = [
        {
          input: session,
          format: 'csv',
          filename: 'batch1.csv',
          options: { timeRange: 'all' as const }
        },
        {
          input: session,
          format: 'json',
          filename: 'batch2.json',
          options: { timeRange: 'all' as const }
        },
        {
          input: { invalid: 'data' },
          format: 'csv',
          filename: 'batch3.csv',
          options: { timeRange: 'all' as const }
        }
      ];

      const results = await batchExport(exports, progressCallback);
      
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);
      
      expect(progressCallback).toHaveBeenCalledWith(0, 3, 'batch1.csv');
      expect(progressCallback).toHaveBeenCalledWith(1, 3, 'batch2.json');
      expect(progressCallback).toHaveBeenCalledWith(2, 3, 'batch3.csv');
      expect(progressCallback).toHaveBeenCalledWith(3, 3, '批量导出完成');
    });

    it('应该处理batchExport中的异常情况', async () => {
      const exports = [
        {
          input: { session: createTestSession() },
          format: 'csv',
          filename: 'exception_test.csv'
        }
      ];

      // Mock exportFlexible to throw an error
      const originalMethod = dataExportService.exportFlexible;
      dataExportService.exportFlexible = jest.fn().mockRejectedValue(new Error('Test error'));

      const results = await batchExport(exports);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Test error');

      // Restore original method
      dataExportService.exportFlexible = originalMethod;
    });
  });

  describe('边界条件和异常处理测试', () => {
    it('应该处理所有剩余的边界条件', async () => {
      const session = createTestSession();
      
      // 测试空的selectedChannels处理
      const result1 = await service.exportWaveformData(session, 'csv', {
        filename: 'empty_channels.csv',
        timeRange: 'all',
        selectedChannels: []
      });
      expect(result1.success).toBe(true);

      // 测试非常小的chunkSize
      const result2 = await service.exportWaveformData(session, 'json', {
        filename: 'small_chunk.json',
        timeRange: 'all',
        chunkSize: 1
      });
      expect(result2.success).toBe(true);

      // 测试自定义转换器的remove操作
      service.addCustomConverter('temp', () => ({}));
      expect(service.removeConverter('temp')).toBe(true);
      expect(service.removeConverter('nonexistent')).toBe(false);
    });
  });
});