/**
 * 系统集成端到端测试
 * 测试各个组件的真实集成，基于实际可用的API
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { DataExportService } from '../../src/services/DataExportService';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn().mockResolvedValue('确定'),
    showErrorMessage: jest.fn().mockResolvedValue('确定'),
    showWarningMessage: jest.fn().mockResolvedValue('确定'),
    showSaveDialog: jest.fn().mockResolvedValue({
      fsPath: '/tmp/test-export.csv'
    }),
    createStatusBarItem: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: ''
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const configs: Record<string, any> = {
          'defaultSampleRate': 24000000,
          'autoDetectDevices': true,
          'exportFormat': 'csv',
          'theme': 'dark',
          'bufferSize': 65536
        };
        return configs[key];
      }),
      update: jest.fn().mockResolvedValue(undefined),
      has: jest.fn().mockReturnValue(true),
      inspect: jest.fn(() => ({
        key: 'test',
        defaultValue: 'default',
        globalValue: 'global',
        workspaceValue: 'workspace'
      }))
    })),
    workspaceFolders: [{
      uri: { fsPath: '/tmp/test-workspace' },
      name: 'test-workspace',
      index: 0
    }],
    onDidChangeConfiguration: jest.fn(),
    onDidChangeWorkspaceFolders: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    findFiles: jest.fn().mockResolvedValue([])
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
    parse: jest.fn((path: string) => ({ fsPath: path }))
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
}));

describe('系统集成端到端测试', () => {
  let configManager: ConfigurationManager;
  let exportService: DataExportService;
  let testWorkspaceDir: string;

  beforeAll(async () => {
    // 设置测试环境
    testWorkspaceDir = '/tmp/logic-analyzer-integration-test-' + Date.now();
    
    try {
      await fs.mkdir(testWorkspaceDir, { recursive: true });
      await fs.mkdir(path.join(testWorkspaceDir, 'exports'), { recursive: true });
    } catch (error) {
      // 目录可能已存在，忽略错误
    }
  });

  beforeEach(async () => {
    // 初始化服务
    configManager = new ConfigurationManager();
    exportService = new DataExportService();

    // 等待配置管理器初始化
    await configManager.initialize();
  });

  afterEach(async () => {
    // 清理服务
    try {
      if (configManager && typeof configManager.dispose === 'function') {
        await configManager.dispose();
      }
    } catch (error) {
      // 忽略清理错误
    }
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('配置管理基础功能测试', () => {
    it('应该成功读取和设置配置项', async () => {
      // 1. 测试读取默认配置
      const defaultSampleRate = configManager.getNumber('defaultSampleRate', 12000000);
      expect(defaultSampleRate).toBe(24000000); // Mock值

      const autoDetect = configManager.getBoolean('autoDetectDevices', false);
      expect(autoDetect).toBe(true);

      const theme = configManager.getString('theme', 'light');
      expect(theme).toBe('dark');

      // 2. 测试设置配置
      await configManager.set('defaultSampleRate', 48000000);
      
      // 验证设置成功（通过Mock验证）
      const mockConfig = vscode.workspace.getConfiguration();
      expect(mockConfig.update).toHaveBeenCalled();

      // 3. 测试获取所有配置项
      const allConfigs = configManager.getAllConfigurationItems();
      expect(Array.isArray(allConfigs)).toBe(true);
      expect(allConfigs.length).toBeGreaterThan(0);

      // 4. 测试分类获取配置
      const categories = configManager.getAllCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('应该支持配置导出和设备配置管理', async () => {
      // 1. 测试配置导出
      const exportPath = path.join(testWorkspaceDir, 'config-export.json');
      const resultPath = await configManager.exportConfiguration(exportPath);
      
      expect(resultPath).toBe(exportPath);

      // 验证导出文件存在
      try {
        const stats = await fs.stat(exportPath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);

        // 验证导出内容格式
        const content = await fs.readFile(exportPath, 'utf-8');
        const exportData = JSON.parse(content);
        expect(exportData).toBeDefined();
        expect(exportData.version).toBeDefined();
        expect(exportData.timestamp).toBeDefined();
        expect(exportData.configurations).toBeDefined();
      } catch (error) {
        fail(`配置导出文件验证失败: ${error}`);
      }

      // 2. 测试设备配置管理
      const deviceConfig = {
        deviceId: 'test-device-001',
        name: 'Test Pico Analyzer',
        type: 'pico',
        connectionString: '/dev/ttyUSB0',
        settings: {
          baudRate: 115200,
          timeout: 5000,
          bufferSize: 8192
        },
        lastUsed: new Date().toISOString(),
        favorite: true
      };

      await configManager.saveDeviceConfiguration(deviceConfig);

      // 获取设备配置
      const savedDevice = configManager.getDeviceConfiguration('test-device-001');
      expect(savedDevice).toBeDefined();
      expect(savedDevice?.name).toBe('Test Pico Analyzer');
      expect(savedDevice?.type).toBe('pico');
      expect(savedDevice?.favorite).toBe(true);

      // 获取所有设备
      const allDevices = configManager.getAllDeviceConfigurations();
      expect(Array.isArray(allDevices)).toBe(true);
      expect(allDevices.length).toBeGreaterThan(0);
      expect(allDevices.some(d => d.deviceId === 'test-device-001')).toBe(true);
    });

    it('应该支持主题管理', async () => {
      // 1. 创建自定义主题
      const customTheme = {
        name: 'Test Dark Theme',
        colors: {
          background: '#1e1e1e',
          foreground: '#ffffff',
          channelColors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'],
          gridColor: '#333333',
          markerColor: '#ff6600',
          triggerColor: '#ff00ff'
        },
        fonts: {
          family: 'Monaco',
          size: 12,
          weight: 'normal'
        }
      };

      await configManager.saveTheme(customTheme);

      // 2. 获取主题
      const savedTheme = configManager.getTheme('Test Dark Theme');
      expect(savedTheme).toBeDefined();
      expect(savedTheme?.colors.background).toBe('#1e1e1e');
      expect(savedTheme?.colors.channelColors).toHaveLength(4);

      // 3. 获取所有主题
      const allThemes = configManager.getAllThemes();
      expect(Array.isArray(allThemes)).toBe(true);
      expect(allThemes.some(t => t.name === 'Test Dark Theme')).toBe(true);

      // 4. 设置当前主题
      await configManager.setCurrentTheme('Test Dark Theme');
      const currentTheme = configManager.getCurrentTheme();
      expect(currentTheme?.name).toBe('Test Dark Theme');
    });
  });

  describe('数据导出服务集成测试', () => {
    it('应该成功导出模拟采集数据到不同格式', async () => {
      // 1. 创建模拟采集数据
      const mockCaptureData = {
        metadata: {
          deviceId: 'test-device',
          timestamp: Date.now(),
          sampleRate: 24000000,
          totalSamples: 10000,
          channels: 4,
          version: '1.0.0'
        },
        channels: [
          {
            id: 0,
            name: 'CLK',
            samples: new Uint8Array(10000).map((_, i) => i % 2),
            visible: true
          },
          {
            id: 1,
            name: 'DATA',
            samples: new Uint8Array(10000).map((_, i) => Math.floor(i / 8) % 2),
            visible: true
          },
          {
            id: 2,
            name: 'CS',
            samples: new Uint8Array(10000).map((_, i) => i < 8000 ? 0 : 1),
            visible: true
          },
          {
            id: 3,
            name: 'RESET',
            samples: new Uint8Array(10000).map((_, i) => i < 100 ? 0 : 1),
            visible: false
          }
        ],
        triggers: [
          {
            sample: 100,
            channel: 0,
            type: 'rising',
            description: 'Clock edge'
          }
        ],
        annotations: [
          {
            start: 1000,
            end: 2000,
            channel: 1,
            type: 'data_packet',
            description: 'Data transmission',
            data: { value: '0xAB' }
          }
        ]
      };

      // 2. 测试CSV导出
      const csvPath = path.join(testWorkspaceDir, 'exports', 'test-data.csv');
      const csvResult = await exportService.exportToCSV(mockCaptureData, csvPath, {
        includeTimestamps: true,
        includeHeaders: true,
        delimiter: ',',
        channelSelection: [0, 1, 2], // 仅导出前3个通道
        timeFormat: 'microseconds'
      });

      expect(csvResult.success).toBe(true);
      expect(csvResult.filePath).toBe(csvPath);
      expect(csvResult.recordsExported).toBe(10000);

      // 验证CSV文件
      const csvStats = await fs.stat(csvPath);
      expect(csvStats.isFile()).toBe(true);
      expect(csvStats.size).toBeGreaterThan(0);

      const csvContent = await fs.readFile(csvPath, 'utf-8');
      expect(csvContent).toContain('timestamp');
      expect(csvContent).toContain('CLK');
      expect(csvContent).toContain('DATA');
      expect(csvContent).toContain('CS');
      expect(csvContent).not.toContain('RESET'); // 不可见通道不应导出

      // 3. 测试JSON导出
      const jsonPath = path.join(testWorkspaceDir, 'exports', 'test-data.json');
      const jsonResult = await exportService.exportToJSON(mockCaptureData, jsonPath, {
        includeMetadata: true,
        includeAnnotations: true,
        includeRawData: true,
        compression: 'none'
      });

      expect(jsonResult.success).toBe(true);
      expect(jsonResult.filePath).toBe(jsonPath);

      // 验证JSON文件
      const jsonStats = await fs.stat(jsonPath);
      expect(jsonStats.isFile()).toBe(true);

      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      const jsonData = JSON.parse(jsonContent);
      expect(jsonData.metadata).toBeDefined();
      expect(jsonData.metadata.sampleRate).toBe(24000000);
      expect(jsonData.channels).toHaveLength(4);
      expect(jsonData.annotations).toHaveLength(1);
      expect(jsonData.triggers).toHaveLength(1);

      // 4. 测试VCD导出
      const vcdPath = path.join(testWorkspaceDir, 'exports', 'test-data.vcd');
      const vcdResult = await exportService.exportToVCD(mockCaptureData, vcdPath, {
        timeScale: '1us',
        includeAnnotations: false,
        channelWidth: 1
      });

      expect(vcdResult.success).toBe(true);
      expect(vcdResult.filePath).toBe(vcdPath);

      // 验证VCD文件
      const vcdStats = await fs.stat(vcdPath);
      expect(vcdStats.isFile()).toBe(true);

      const vcdContent = await fs.readFile(vcdPath, 'utf-8');
      expect(vcdContent).toContain('$version');
      expect(vcdContent).toContain('$timescale');
      expect(vcdContent).toContain('$var wire');
      expect(vcdContent).toContain('$enddefinitions');
      expect(vcdContent).toContain('CLK');
      expect(vcdContent).toContain('DATA');
    });

    it('应该正确处理导出选项和过滤', async () => {
      // 创建测试数据
      const testData = {
        metadata: {
          sampleRate: 12000000,
          totalSamples: 5000,
          channels: 2
        },
        channels: [
          {
            id: 0,
            name: 'CH0',
            samples: new Uint8Array(5000).fill(1),
            visible: true
          },
          {
            id: 1,
            name: 'CH1',
            samples: new Uint8Array(5000).fill(0),
            visible: true
          }
        ]
      };

      // 测试时间范围过滤
      const filteredPath = path.join(testWorkspaceDir, 'exports', 'filtered-data.csv');
      const filteredResult = await exportService.exportToCSV(testData, filteredPath, {
        timeRange: {
          start: 1000,  // 从第1000个样本开始
          end: 3000     // 到第3000个样本结束
        },
        includeHeaders: true
      });

      expect(filteredResult.success).toBe(true);
      expect(filteredResult.recordsExported).toBe(2000); // 3000 - 1000 = 2000

      // 验证文件内容
      const filteredContent = await fs.readFile(filteredPath, 'utf-8');
      const lines = filteredContent.trim().split('\n');
      expect(lines.length).toBe(2001); // 2000行数据 + 1行标题

      // 测试通道选择
      const singleChannelPath = path.join(testWorkspaceDir, 'exports', 'single-channel.csv');
      const singleChannelResult = await exportService.exportToCSV(testData, singleChannelPath, {
        channelSelection: [0], // 仅导出通道0
        includeHeaders: true
      });

      expect(singleChannelResult.success).toBe(true);
      expect(singleChannelResult.recordsExported).toBe(5000);

      const singleChannelContent = await fs.readFile(singleChannelPath, 'utf-8');
      expect(singleChannelContent).toContain('CH0');
      expect(singleChannelContent).not.toContain('CH1');
    });
  });

  describe('配置与导出服务集成测试', () => {
    it('应该使用配置管理器的设置影响导出行为', async () => {
      // 1. 设置导出相关配置
      await configManager.set('export.defaultFormat', 'json');
      await configManager.set('export.includeMetadata', true);
      await configManager.set('export.compression', 'gzip');

      // 2. 获取导出配置
      const exportFormat = configManager.getString('export.defaultFormat', 'csv');
      const includeMetadata = configManager.getBoolean('export.includeMetadata', false);
      const compression = configManager.getString('export.compression', 'none');

      expect(exportFormat).toBe('json');
      expect(includeMetadata).toBe(true);
      expect(compression).toBe('gzip');

      // 3. 创建测试数据
      const configBasedData = {
        metadata: {
          sampleRate: 48000000,
          totalSamples: 1000,
          channels: 2,
          exportSettings: {
            format: exportFormat,
            includeMetadata: includeMetadata,
            compression: compression
          }
        },
        channels: [
          {
            id: 0,
            name: 'Signal',
            samples: new Uint8Array(1000).map((_, i) => i % 2),
            visible: true
          }
        ]
      };

      // 4. 根据配置执行导出
      const configBasedPath = path.join(testWorkspaceDir, 'exports', 'config-based-export.json');
      const configBasedResult = await exportService.exportToJSON(configBasedData, configBasedPath, {
        includeMetadata: includeMetadata,
        compression: compression === 'gzip' ? 'gzip' : 'none'
      });

      expect(configBasedResult.success).toBe(true);

      // 验证导出文件包含配置信息
      const configBasedContent = await fs.readFile(configBasedPath, 'utf-8');
      const configBasedJson = JSON.parse(configBasedContent);
      expect(configBasedJson.metadata).toBeDefined();
      expect(configBasedJson.metadata.exportSettings).toBeDefined();
      expect(configBasedJson.metadata.exportSettings.format).toBe('json');
    });
  });

  describe('错误处理和边界条件测试', () => {
    it('应该正确处理无效的配置值', async () => {
      // 测试设置无效的数值
      await expect(configManager.set('defaultSampleRate', -1)).resolves.not.toThrow();
      
      // 测试读取不存在的配置
      const nonExistent = configManager.getString('nonexistent.key', 'default');
      expect(nonExistent).toBe('default');

      // 测试读取无效类型
      const invalidNumber = configManager.getNumber('theme', 123); // theme是字符串
      expect(typeof invalidNumber).toBe('number');
    });

    it('应该处理导出服务的错误情况', async () => {
      // 测试导出到无效路径
      const invalidPath = '/invalid/path/that/does/not/exist/test.csv';
      const invalidData = {
        metadata: { sampleRate: 1000000 },
        channels: []
      };

      const invalidResult = await exportService.exportToCSV(invalidData, invalidPath);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeDefined();

      // 测试导出空数据
      const emptyData = {
        metadata: { sampleRate: 1000000, totalSamples: 0 },
        channels: []
      };

      const emptyPath = path.join(testWorkspaceDir, 'exports', 'empty-data.csv');
      const emptyResult = await exportService.exportToCSV(emptyData, emptyPath);
      
      // 应该成功但无记录
      expect(emptyResult.success).toBe(true);
      expect(emptyResult.recordsExported).toBe(0);
    });
  });

  describe('性能和资源管理测试', () => {
    it('应该高效处理大量配置操作', async () => {
      const startTime = Date.now();

      // 批量配置操作
      for (let i = 0; i < 100; i++) {
        await configManager.set(`test.setting${i}`, i * 10);
      }

      // 批量读取操作
      for (let i = 0; i < 100; i++) {
        const value = configManager.getNumber(`test.setting${i}`, 0);
        expect(value).toBe(i * 10);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // 2秒内完成
    });

    it('应该高效处理大数据导出', async () => {
      // 创建大数据集
      const largeData = {
        metadata: {
          sampleRate: 100000000,
          totalSamples: 50000,
          channels: 8
        },
        channels: Array.from({ length: 8 }, (_, i) => ({
          id: i,
          name: `CH${i}`,
          samples: new Uint8Array(50000).map((_, j) => (i + j) % 2),
          visible: true
        }))
      };

      const startTime = Date.now();
      const largePath = path.join(testWorkspaceDir, 'exports', 'large-data.csv');
      const largeResult = await exportService.exportToCSV(largeData, largePath);

      const duration = Date.now() - startTime;

      expect(largeResult.success).toBe(true);
      expect(largeResult.recordsExported).toBe(50000);
      expect(duration).toBeLessThan(5000); // 5秒内完成

      // 验证文件大小合理
      const largeStats = await fs.stat(largePath);
      expect(largeStats.size).toBeGreaterThan(1000000); // 至少1MB
      expect(largeStats.size).toBeLessThan(50000000); // 不超过50MB
    });
  });
});