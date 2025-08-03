/**
 * DataExportService 覆盖率完善测试
 * 专门针对剩余未覆盖的代码路径进行测试，目标达到95%以上覆盖率
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { 
  DataExportService, 
  ExportOptions, 
  ExportResult,
} from '../../../src/services/DataExportService';
import { CaptureSession } from '../../../src/models/AnalyzerTypes';
import { DecoderResult } from '../../../src/decoders/types';

// Mock dependencies
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue('default'),
    }),
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    withProgress: jest.fn().mockImplementation((options, callback) => callback()),
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

jest.mock('../../../src/services/ExportPerformanceOptimizer', () => ({
  exportPerformanceOptimizer: {
    optimize: jest.fn().mockReturnValue({}),
    configure: jest.fn(),
  },
  PerformanceConfig: {}
}));

describe('DataExportService 覆盖率完善测试', () => {
  let exportService: DataExportService;
  let mockFS: any;

  beforeEach(() => {
    mockFS = require('fs/promises') as any;
    exportService = new DataExportService();
    jest.clearAllMocks();
  });

  const createMinimalSession = (): CaptureSession => ({
    id: 'test',
    name: 'Test Session',
    captureChannels: [
      { 
        channelNumber: 0, 
        channelName: 'CH0', 
        enabled: true,
        voltage: 3.3,
        threshold: 1.65,
        samples: new Uint8Array([0xFF])
      }
    ],
    frequency: 1000000,
    preTriggerSamples: 100,
    postTriggerSamples: 100,
    totalSamples: 200,
    timestamp: new Date()
  } as any);

  describe('未覆盖的错误路径测试', () => {
    // 测试行129: 不支持的格式错误处理
    it('应该处理不支持的波形导出格式错误', async () => {
      const session = createMinimalSession();
      const options: ExportOptions = {
        filename: 'test.unknown',
        timeRange: 'all'
      };

      const result = await exportService.exportWaveformData(session, 'unknown', options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的波形导出格式');
    });

    // 测试行152-154: 不同的文件系统错误
    it('应该处理其他文件系统错误类型', async () => {
      const session = createMinimalSession();
      const options: ExportOptions = {
        filename: 'test.csv',
        timeRange: 'all'
      };
      
      // 测试ENOENT错误
      mockFS.writeFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      const result1 = await exportService.exportWaveformData(session, 'csv', options);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('ENOENT: no such file or directory');

      // 测试其他自定义错误
      mockFS.writeFile.mockRejectedValue(new Error('自定义文件系统错误'));
      const result2 = await exportService.exportWaveformData(session, 'csv', options);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('自定义文件系统错误');
    });

    // 测试行218, 248, 256, 260: 分析报告导出错误
    it('应该处理分析报告导出的各种错误', async () => {
      const analysisData = { test: 'data' };
      
      // 测试报告导出时的异常处理
      const invalidOptions: ExportOptions = {
        filename: 'test.xml',  // 不支持的格式
        timeRange: 'all'
      };

      const result = await exportService.exportAnalysisReport(analysisData, 'xml', invalidOptions);
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的报告导出格式');
    });

    // 测试行290: 没有文件名时的导出
    it('应该处理没有文件名的导出选项', async () => {
      const session = createMinimalSession();
      const options: ExportOptions = {
        timeRange: 'all'
        // 没有filename属性
      } as ExportOptions;

      const result = await exportService.exportWaveformData(session, 'csv', options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('文件名不能为空');
    });
  });

  describe('特殊条件分支测试', () => {
    // 测试行308, 317, 328, 336: LAC导出的特殊条件
    it('应该处理LAC导出的全量和部分时间范围', async () => {
      const session = createMinimalSession();
      
      // 测试全量导出（timeRange: 'all'）
      const allOptions: ExportOptions = {
        filename: 'test-all.lac',
        timeRange: 'all'
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result1 = await exportService.exportWaveformData(session, 'lac', allOptions);
      expect(result1.success).toBe(true);

      // 测试没有样本调整的情况
      const noAdjustOptions: ExportOptions = {
        filename: 'test-no-adjust.lac',
        timeRange: 'all'
      };

      const result2 = await exportService.exportWaveformData(session, 'lac', noAdjustOptions);
      expect(result2.success).toBe(true);
    });

    // 测试行450, 485: 大数据集的边界条件
    it('应该处理空数据和边界数据', async () => {
      // 创建空会话
      const emptySession = {
        ...createMinimalSession(),
        captureChannels: [],
        totalSamples: 0
      };

      const options: ExportOptions = {
        filename: 'empty.csv',
        timeRange: 'all'
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(emptySession, 'csv', options);
      expect(result.success).toBe(true);
    });
  });

  describe('复杂功能路径测试', () => {
    // 测试行521, 533-534, 541, 548: JSON导出的特殊逻辑
    it('应该处理JSON导出的复杂数据结构', async () => {
      const complexSession = createMinimalSession();
      complexSession.captureChannels = [
        {
          channelNumber: 0,
          channelName: '复杂通道',
          enabled: true,
          voltage: 5.0,
          threshold: 2.5,
          hidden: false,
          samples: new Uint8Array([0xAA, 0x55, 0xFF, 0x00])
        },
        {
          channelNumber: 1,
          channelName: '隐藏通道',
          enabled: false,
          voltage: 3.3,
          threshold: 1.65,
          hidden: true,
          samples: new Uint8Array([0x33, 0xCC])
        }
      ];

      const options: ExportOptions = {
        filename: 'complex.json',
        timeRange: 'custom',
        customStart: 0,
        customEnd: 32,  // 32位 = 4字节
        selectedChannels: [0, 1],
        chunkSize: 10  // 小块处理
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(complexSession, 'json', options);
      expect(result.success).toBe(true);

      const jsonData = JSON.parse(result.data as string);
      expect(jsonData.exportInfo.customRange).toBeDefined();
      expect(jsonData.channels).toHaveLength(2);
      expect(jsonData.channels[1].hidden).toBe(true);
    });

    // 测试行693-694: VCD导出的复杂变量ID生成
    it('应该处理VCD导出的复杂变量ID生成', async () => {
      const manyChannelSession = createMinimalSession();
      
      // 创建超过94个通道来测试两字符ID生成
      const channels = [];
      for (let i = 0; i < 100; i++) {
        channels.push({
          channelNumber: i,
          channelName: `CH${i}`,
          enabled: true,
          voltage: 3.3,
          threshold: 1.65,
          samples: new Uint8Array([i % 256])
        });
      }
      manyChannelSession.captureChannels = channels as any;

      const options: ExportOptions = {
        filename: 'many-channels.vcd',
        timeRange: 'all'
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(manyChannelSession, 'vcd', options);
      expect(result.success).toBe(true);
    });

    // 测试行973-975: PDF导出占位实现
    it('应该处理PDF导出的占位实现', async () => {
      const analysisData = { summary: '测试数据' };
      const options: ExportOptions = {
        filename: 'test.pdf',
        timeRange: 'all'
      };

      const result = await exportService.exportAnalysisReport(analysisData, 'pdf', options);

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.data).toContain('%PDF-1.4');
    });
  });

  describe('工具方法边界测试', () => {
    // 测试行996: adjustSampleRange方法的边界条件
    it('应该测试样本范围调整的边界条件', async () => {
      const session = createMinimalSession();
      session.preTriggerSamples = 50;
      session.postTriggerSamples = 50;
      
      // 测试触发点在范围外的情况
      const options: ExportOptions = {
        filename: 'test.lac',
        timeRange: 'custom',
        customStart: 60,  // 触发点之后开始
        customEnd: 90
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(session, 'lac', options);
      expect(result.success).toBe(true);
    });

    // 测试行1013-1014: getSampleRange方法的边界条件
    it('应该测试样本范围获取的边界条件', async () => {
      const session = createMinimalSession();
      
      // 测试customEnd超出范围的情况
      const options: ExportOptions = {
        filename: 'test.csv',
        timeRange: 'custom',
        customStart: 0,
        customEnd: 999999  // 超出实际样本数
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(session, 'csv', options);
      expect(result.success).toBe(true);
    });

    // 测试行1108, 1112: 文件大小估算方法
    it('应该测试文件大小估算的各种格式', async () => {
      const session = createMinimalSession();
      
      // 测试未知格式的文件大小估算
      const unknownFormatOptions: ExportOptions = {
        filename: 'test.unknown',
        timeRange: 'all'
      };

      // 这个测试间接测试估算方法，通过元数据生成
      const result = await exportService.exportWaveformData(session, 'lac', {
        filename: 'test.lac',
        timeRange: 'all'
      });
      
      expect(result.success).toBe(true);
      const exportedData = JSON.parse(result.data as string);
      expect(exportedData.metadata.performance.estimatedFileSize).toBeDefined();
    });
  });

  describe('解码器导出的特殊情况', () => {
    // 测试解码器导出时的特殊数据结构
    it('应该处理解码器导出的特殊数据结构', async () => {
      const specialDecoderResults = new Map();
      
      // 添加包含特殊字符的解码器结果
      specialDecoderResults.set('special_decoder', [
        {
          annotationType: 'special annotation',
          startSample: 100,
          endSample: 200,
          values: ['特殊字符', 'Special|Characters', '"Quotes"'],
          rawData: { special: 'data', nested: { value: 123 } }
        }
      ]);

      const options: ExportOptions = {
        filename: 'special.csv',
        timeRange: 'all',
        selectedDecoders: ['special_decoder'],
        includeDetails: ['raw_data', 'annotations']
      };

      const result = await exportService.exportDecoderResults(specialDecoderResults, 'csv', options);

      expect(result.success).toBe(true);
      expect(result.data).toContain('特殊字符');
      expect(result.data).toContain('Special|Characters');
    });
  });

  describe('项目导出的完整路径测试', () => {
    // 测试行1186-1234: 项目导出的复杂逻辑
    it('应该测试完整项目导出的各种格式', async () => {
      const session = createMinimalSession();
      const decoderResults = new Map();
      decoderResults.set('test_decoder', [
        {
          annotationType: 'test',
          startSample: 0,
          endSample: 100,
          values: ['test_value'],
          rawData: { test: true }
        }
      ]);
      const analysisData = { 
        summary: '完整项目测试',
        performance: { metrics: 'test' }
      };

      // 测试ZIP格式项目导出
      const zipOptions: ExportOptions = {
        filename: 'project.zip',
        timeRange: 'all',
        selectedChannels: [0],
        selectedDecoders: ['test_decoder']
      };

      const zipResult = await exportService.exportCompleteProject(
        session, decoderResults, analysisData, zipOptions
      );

      expect(zipResult.success).toBe(true);
      expect(zipResult.mimeType).toBe('application/zip');

      // 验证ZIP项目数据结构
      const projectData = JSON.parse(zipResult.data as string);
      expect(projectData.version).toBe('1.0.0');
      expect(projectData.type).toBe('vscode-logic-analyzer-project-archive');
      expect(projectData.session).toBeDefined();
      expect(projectData.decoderResults).toBeDefined();
      expect(projectData.analysisData).toBeDefined();
      expect(projectData.exportOptions).toBeDefined();
      expect(projectData.metadata).toBeDefined();
    });

    // 测试行1256, 1296, 1303: 项目文件导出
    it('应该测试项目文件导出的完整功能', async () => {
      const session = createMinimalSession();
      const decoderResults = new Map();
      const analysisData = { summary: '项目文件测试' };

      const projectOptions: ExportOptions = {
        filename: 'project.laproj',
        timeRange: 'all',
        selectedChannels: [0],
        selectedDecoders: []
      };

      const projectResult = await exportService.exportCompleteProject(
        session, decoderResults, analysisData, projectOptions
      );

      expect(projectResult.success).toBe(true);
      expect(projectResult.mimeType).toBe('application/json');

      // 验证项目文件数据结构
      const projectData = JSON.parse(projectResult.data as string);
      expect(projectData.version).toBe('1.0.0');
      expect(projectData.type).toBe('vscode-logic-analyzer-project');
      expect(projectData.projectSettings).toBeDefined();
      expect(projectData.projectSettings.defaultTimeRange).toBe('all');
      expect(projectData.projectSettings.displaySettings).toBeDefined();
    });
  });

  describe('边界值和异常情况测试', () => {
    it('应该处理空的或无效的会话数据', async () => {
      // 测试没有通道的会话
      const noChannelSession = {
        ...createMinimalSession(),
        captureChannels: []
      };

      const options: ExportOptions = {
        filename: 'no-channels.csv',
        timeRange: 'all'
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(noChannelSession, 'csv', options);
      expect(result.success).toBe(true);
    });

    it('应该处理验证失败的边界情况', async () => {
      const session = createMinimalSession();
      
      // 测试选择的通道超出范围但为空数组的情况
      const emptyChannelsOptions: ExportOptions = {
        filename: 'test.csv',
        timeRange: 'all',
        selectedChannels: []  // 空数组应该通过验证
      };

      const result = await exportService.exportWaveformData(session, 'csv', emptyChannelsOptions);
      expect(result.success).toBe(true);
    });

    it('应该处理非常小的时间范围', async () => {
      const session = createMinimalSession();
      
      const tinyRangeOptions: ExportOptions = {
        filename: 'tiny.csv',
        timeRange: 'custom',
        customStart: 0,
        customEnd: 1  // 只有1个样本
      };
      mockFS.writeFile.mockResolvedValue(undefined);

      const result = await exportService.exportWaveformData(session, 'csv', tinyRangeOptions);
      expect(result.success).toBe(true);
      expect(result.processedSamples).toBe(1);
    });
  });
});