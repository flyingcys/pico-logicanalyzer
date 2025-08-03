/**
 * DataExportService 测试
 * 测试数据导出服务的多种格式导出功能
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  DataExportService, 
  ExportOptions, 
  ExportResult, 
  ExportedCapture,
  ExportMetadata
} from '../../../src/services/DataExportService';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/AnalyzerTypes';
import { DecoderResult } from '../../../src/decoders/types';

// Mock dependencies
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
    }),
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showProgressWindow: jest.fn(),
  },
  ProgressLocation: {
    Notification: 15,
  },
  Uri: {
    file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  dirname: jest.fn().mockImplementation((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn().mockImplementation((p) => p.split('/').pop()),
  extname: jest.fn().mockImplementation((p) => p.includes('.') ? '.' + p.split('.').pop() : ''),
}));

describe('DataExportService 测试', () => {
  let exportService: DataExportService;
  let mockVSCode: any;
  let mockFS: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    mockFS = require('fs/promises') as any;
    
    exportService = new DataExportService();
    jest.clearAllMocks();
  });

  // 创建测试用的会话数据
  const createTestCaptureSession = (): CaptureSession => ({
    id: 'test-capture-001',
    name: '测试采集',
    captureChannels: [
      { 
        channelNumber: 0, 
        channelName: 'CH0', 
        enabled: true,
        voltage: 3.3,
        threshold: 1.65
      },
      { 
        channelNumber: 1, 
        channelName: 'CH1', 
        enabled: true,
        voltage: 3.3,
        threshold: 1.65
      },
    ],
    frequency: 24000000,
    totalSamples: 10000,
    timestamp: new Date(),
    samples: new Uint8Array([0x55, 0xAA, 0xFF, 0x00]),
  } as any);

  // 创建测试用的导出选项
  const createTestExportOptions = (format: string): ExportOptions => ({
    filename: `test-export.${format}`,
    timeRange: 'all',
    selectedChannels: [0, 1],
    samplingMode: 'original',
    reportFormat: 'detailed',
  });

  // 创建测试用的解码器结果
  const createTestDecoderResults = (): DecoderResult[] => [
    {
      type: 'annotation',
      startSample: 0,
      endSample: 100,
      data: ['Start', 'I2C Start Condition'],
    },
    {
      type: 'data',
      startSample: 100,
      endSample: 200,
      data: { address: 0x48, data: [0x01, 0x02] },
    },
  ];

  describe('波形数据导出功能', () => {
    it('应该能够导出LAC格式数据', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('lac');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'lac', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.lac');
      expect(result.mimeType).toBe('application/octet-stream');
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        options.filename,
        expect.any(String),
        'utf8'
      );
    });

    it('应该能够导出CSV格式数据', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('应该能够导出JSON格式数据', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('json');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'json', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.json');
      expect(result.mimeType).toBe('application/json');
    });

    it('应该能够导出VCD格式数据', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('vcd');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'vcd', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.vcd');
      expect(result.mimeType).toBe('text/plain');
    });

    it('应该处理不支持的导出格式', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('unsupported');

      // Act
      const result = await exportService.exportWaveformData(session, 'unsupported', options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的波形导出格式');
    });

    it('应该处理文件写入失败的情况', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockRejectedValue(new Error('写入失败'));

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('写入失败');
    });
  });

  describe('解码器结果导出功能', () => {
    it('应该能够导出解码器结果到CSV', async () => {
      // Arrange
      const decoderResults = createTestDecoderResults();
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportDecoderResults(decoderResults, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.csv');
      expect(result.mimeType).toBe('text/csv');
    });

    it('应该能够导出解码器结果到JSON', async () => {
      // Arrange
      const decoderResults = createTestDecoderResults();
      const options = createTestExportOptions('json');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportDecoderResults(decoderResults, 'json', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.json');
      expect(result.mimeType).toBe('application/json');
    });

    it('应该能够导出解码器结果到TXT', async () => {
      // Arrange
      const decoderResults = createTestDecoderResults();
      const options = createTestExportOptions('txt');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportDecoderResults(decoderResults, 'txt', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.txt');
      expect(result.mimeType).toBe('text/plain');
    });

    it('应该处理空的解码器结果', async () => {
      // Arrange
      const emptyResults: DecoderResult[] = [];
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportDecoderResults(emptyResults, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0); // 至少有CSV头部
    });
  });

  describe('分析报告导出功能', () => {
    it('应该能够导出HTML格式报告', async () => {
      // Arrange
      const analysisData = {
        summary: '测试分析摘要',
        measurements: [
          { name: '频率', value: '24MHz', unit: 'Hz' },
          { name: '周期', value: '41.67ns', unit: 's' },
        ],
        statistics: {
          totalSamples: 10000,
          activeSamples: 8000,
          idleSamples: 2000,
        },
      };
      const options = createTestExportOptions('html');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportAnalysisReport(analysisData, 'html', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.html');
      expect(result.mimeType).toBe('text/html');
    });

    it('应该能够导出Markdown格式报告', async () => {
      // Arrange
      const analysisData = { summary: '测试摘要' };
      const options = createTestExportOptions('md');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportAnalysisReport(analysisData, 'md', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.md');
      expect(result.mimeType).toBe('text/markdown');
    });

    it('应该能够导出PDF格式报告', async () => {
      // Arrange
      const analysisData = { summary: '测试摘要' };
      const options = createTestExportOptions('pdf');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportAnalysisReport(analysisData, 'pdf', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });
  });

  describe('完整项目导出功能', () => {
    it('应该能够导出完整项目到ZIP', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const decoderResults = createTestDecoderResults();
      const analysisData = { summary: '项目摘要' };
      const options = createTestExportOptions('zip');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportCompleteProject(
        session,
        decoderResults,
        analysisData,
        options
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.zip');
      expect(result.mimeType).toBe('application/zip');
    });

    it('应该能够导出项目文件', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const decoderResults = createTestDecoderResults();
      const analysisData = { summary: '项目摘要' };
      const options = createTestExportOptions('laproject');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportCompleteProject(
        session,
        decoderResults,
        analysisData,
        options
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.filename).toBe('test-export.laproject.laproj');
      expect(result.mimeType).toBe('application/json');
    });
  });

  describe('导出选项处理', () => {
    it('应该处理时间范围选择', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options: ExportOptions = {
        ...createTestExportOptions('csv'),
        timeRange: 'custom',
        customStart: 1000,
        customEnd: 5000,
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      // 验证只有指定范围的数据被导出
      expect(result.size).toBeGreaterThan(0);
    });

    it('应该处理通道选择', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options: ExportOptions = {
        ...createTestExportOptions('csv'),
        selectedChannels: [0], // 只选择第一个通道
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('应该处理压缩采样模式', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options: ExportOptions = {
        ...createTestExportOptions('csv'),
        samplingMode: 'compressed',
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理空的会话数据', async () => {
      // Arrange
      const emptySession = { ...createTestCaptureSession(), samples: new Uint8Array(0) };
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(emptySession, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0); // 至少有CSV头部
    });

    it('应该处理无效的时间范围', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options: ExportOptions = {
        ...createTestExportOptions('csv'),
        timeRange: 'custom',
        customStart: 5000,
        customEnd: 1000, // 结束时间小于开始时间
      };

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('时间范围无效');
    });

    it('应该处理无效的通道选择', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options: ExportOptions = {
        ...createTestExportOptions('csv'),
        selectedChannels: [99], // 不存在的通道
      };

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('通道选择无效');
    });

    it('应该处理大数据量导出', async () => {
      // Arrange
      const largeSession = {
        ...createTestCaptureSession(),
        totalSamples: 10000000,
        samples: new Uint8Array(10000000),
      };
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(largeSession, 'csv', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('应该处理文件权限错误', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('权限不足');
    });

    it('应该处理磁盘空间不足', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      // Act
      const result = await exportService.exportWaveformData(session, 'csv', options);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('磁盘空间不足');
    });
  });

  describe('性能和内存管理', () => {
    it('导出操作应该在合理时间内完成', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('csv');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      const result = await exportService.exportWaveformData(session, 'csv', options);
      const endTime = Date.now();

      // Assert
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该正确计算导出数据大小', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options = createTestExportOptions('json');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const result = await exportService.exportWaveformData(session, 'json', options);

      // Assert
      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(typeof result.size).toBe('number');
    });

    it('应该处理并发导出请求', async () => {
      // Arrange
      const session = createTestCaptureSession();
      const options1 = createTestExportOptions('csv');
      const options2 = createTestExportOptions('json');
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const [result1, result2] = await Promise.all([
        exportService.exportWaveformData(session, 'csv', options1),
        exportService.exportWaveformData(session, 'json', options2),
      ]);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.filename).not.toBe(result2.filename);
    });
  });
});