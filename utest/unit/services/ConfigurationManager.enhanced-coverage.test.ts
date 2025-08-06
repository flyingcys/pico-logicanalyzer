/**
 * ConfigurationManager 增强覆盖率测试
 * 专门针对未覆盖代码路径的测试，目标达到98%+覆盖率
 */

import * as vscode from 'vscode';
import { ConfigurationManager, ConfigurationCategory, DeviceConfiguration, ThemeConfiguration } from '../../../src/services/ConfigurationManager';

// Mock dependencies
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn(),
    }),
    onDidChangeConfiguration: jest.fn(),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
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
}));

describe('ConfigurationManager 增强覆盖率测试', () => {
  let configManager: ConfigurationManager;
  let mockVSCode: any;
  let mockFS: any;
  let mockConfiguration: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    mockFS = require('fs/promises') as any;
    
    // 创建mock配置对象
    mockConfiguration = {
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn(),
    };
    
    // 设置workspace.getConfiguration返回mockConfiguration
    mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
    
    configManager = new ConfigurationManager();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await configManager.dispose();
  });

  describe('配置导入包含主题数据测试 - 覆盖行650', () => {
    beforeEach(async () => {
      await configManager.initialize();
    });

    it('应该能够导入包含主题的配置数据', async () => {
      // Arrange - 创建包含主题的导入数据
      const importData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        configurations: {
          'autoDetectDevices': true,
          'defaultSampleRate': 12000000
        },
        devices: [
          {
            deviceId: 'device-1',
            name: 'Test Device',
            type: 'LogicAnalyzer',
            connectionString: 'COM1',
            settings: { baudRate: 115200 },
            lastUsed: new Date().toISOString(),
            favorite: false
          }
        ],
        themes: [
          {
            name: 'Custom Dark',
            colors: {
              background: '#1E1E1E',
              foreground: '#FFFFFF',
              channelColors: ['#FF0000', '#00FF00', '#0000FF'],
              gridColor: '#404040',
              markerColor: '#FF8800',
              triggerColor: '#FF0088'
            },
            fonts: {
              family: 'Consolas',
              size: 14,
              weight: 'bold'
            }
          },
          {
            name: 'Custom Light',
            colors: {
              background: '#FFFFFF',
              foreground: '#000000',
              channelColors: ['#CC0000', '#00CC00', '#0000CC'],
              gridColor: '#E0E0E0',
              markerColor: '#FF6600',
              triggerColor: '#FF0066'
            },
            fonts: {
              family: 'Arial',
              size: 12,
              weight: 'normal'
            }
          }
        ]
      };

      mockConfiguration.update.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act - 从JSON字符串导入
      await configManager.importConfiguration(JSON.stringify(importData));

      // Assert - 验证主题已导入
      expect(mockConfiguration.update).toHaveBeenCalled();
      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.writeFile).toHaveBeenCalled();
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith('配置导入成功');

      // 验证主题数据已保存
      const themes = configManager.getAllThemes();
      expect(themes.some(t => t.name === 'Custom Dark')).toBe(true);
      expect(themes.some(t => t.name === 'Custom Light')).toBe(true);
      
      // 验证设备数据已保存
      const devices = configManager.getAllDeviceConfigurations();
      expect(devices.some(d => d.deviceId === 'device-1')).toBe(true);
    });

    it('应该能够导入只包含主题的配置数据', async () => {
      // Arrange - 只包含主题的数据
      const importData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        configurations: {},
        themes: [
          {
            name: 'Mono Theme',
            colors: {
              background: '#000000',
              foreground: '#FFFFFF',
              channelColors: ['#FFFFFF'],
              gridColor: '#333333',
              markerColor: '#FFFFFF',
              triggerColor: '#FFFFFF'
            },
            fonts: {
              family: 'Monaco',
              size: 10,
              weight: 'normal'
            }
          }
        ]
      };

      mockConfiguration.update.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await configManager.importConfiguration(JSON.stringify(importData));

      // Assert
      const themes = configManager.getAllThemes();
      expect(themes.some(t => t.name === 'Mono Theme')).toBe(true);
    });
  });

  describe('设备配置文件加载成功测试 - 覆盖行750-752', () => {
    beforeEach(async () => {
      mockVSCode.workspace.workspaceFolders = [{
        uri: { fsPath: '/test/workspace' }
      }];
    });

    it('应该成功加载设备配置文件并清理旧数据', async () => {
      // Arrange - 模拟设备配置文件存在且有效
      const existingDevices = [
        {
          deviceId: 'device-1',
          name: 'Saved Device 1',
          type: 'LogicAnalyzer',
          connectionString: 'COM1',
          settings: { baudRate: 115200 },
          lastUsed: '2025-01-01T00:00:00.000Z',
          favorite: true
        },
        {
          deviceId: 'device-2',
          name: 'Saved Device 2',
          type: 'SaleaeLogic',
          connectionString: 'USB',
          settings: { voltage: 3.3 },
          lastUsed: '2025-01-02T00:00:00.000Z',
          favorite: false
        }
      ];

      mockFS.readFile.mockResolvedValue(JSON.stringify(existingDevices));

      // 先添加一些设备到内存中，验证clear操作
      const tempDevice = {
        deviceId: 'temp-device',
        name: 'Temp Device',
        type: 'Test',
        connectionString: 'TEST',
        settings: {},
        lastUsed: new Date().toISOString(),
        favorite: false
      };
      await configManager.saveDeviceConfiguration(tempDevice);

      // Act - 初始化应该加载设备配置
      await configManager.initialize();

      // Assert - 验证设备配置已正确加载
      const devices = configManager.getAllDeviceConfigurations();
      expect(devices.length).toBe(2);
      expect(devices.some(d => d.deviceId === 'device-1')).toBe(true);
      expect(devices.some(d => d.deviceId === 'device-2')).toBe(true);
      expect(devices.some(d => d.deviceId === 'temp-device')).toBe(false); // 应该被清理

      // 验证设备详细信息
      const device1 = configManager.getDeviceConfiguration('device-1');
      expect(device1?.name).toBe('Saved Device 1');
      expect(device1?.favorite).toBe(true);
    });

    it('应该处理空设备配置文件', async () => {
      // Arrange - 空的设备配置文件
      mockFS.readFile.mockResolvedValue(JSON.stringify([]));

      // Act
      await configManager.initialize();

      // Assert
      const devices = configManager.getAllDeviceConfigurations();
      expect(devices.length).toBe(0);
    });

    it('应该处理大量设备配置', async () => {
      // Arrange - 大量设备配置
      const manyDevices = [];
      for (let i = 1; i <= 10; i++) {
        manyDevices.push({
          deviceId: `device-${i}`,
          name: `Device ${i}`,
          type: 'LogicAnalyzer',
          connectionString: `COM${i}`,
          settings: { index: i },
          lastUsed: new Date(2025, 0, i).toISOString(),
          favorite: i % 3 === 0
        });
      }

      mockFS.readFile.mockResolvedValue(JSON.stringify(manyDevices));

      // Act
      await configManager.initialize();

      // Assert
      const devices = configManager.getAllDeviceConfigurations();
      expect(devices.length).toBe(10);
      
      // 验证按时间排序
      expect(devices[0].deviceId).toBe('device-10'); // 最新的
      expect(devices[9].deviceId).toBe('device-1');  // 最旧的
    });
  });

  describe('主题配置文件加载成功测试 - 覆盖行787-789', () => {
    beforeEach(async () => {
      mockVSCode.workspace.workspaceFolders = [{
        uri: { fsPath: '/test/workspace' }
      }];
    });

    it('应该成功加载主题配置文件并清理旧数据', async () => {
      // Arrange - 模拟主题配置文件存在且有效
      const existingThemes = [
        {
          name: 'Saved Dark Theme',
          colors: {
            background: '#1A1A1A',
            foreground: '#F0F0F0',
            channelColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'],
            gridColor: '#444444',
            markerColor: '#FFD93D',
            triggerColor: '#FF6B9D'
          },
          fonts: {
            family: 'Fira Code',
            size: 13,
            weight: 'medium'
          }
        },
        {
          name: 'Saved Light Theme',
          colors: {
            background: '#FAFAFA',
            foreground: '#2D3748',
            channelColors: ['#E53E3E', '#38A169', '#3182CE', '#DD6B20'],
            gridColor: '#E2E8F0',
            markerColor: '#D69E2E',
            triggerColor: '#ED64A6'
          },
          fonts: {
            family: 'Source Code Pro',
            size: 12,
            weight: 'normal'
          }
        }
      ];

      // 确保设备配置失败，主题配置成功
      mockFS.readFile
        .mockRejectedValueOnce(new Error('Device config not found'))
        .mockResolvedValueOnce(JSON.stringify(existingThemes));

      // Act
      await configManager.initialize();

      // Assert - 验证主题配置已正确加载
      const themes = configManager.getAllThemes();
      
      // 应该包含加载的主题（2个）和默认主题（2个）= 至少4个
      expect(themes.length).toBeGreaterThanOrEqual(4);
      expect(themes.some(t => t.name === 'Saved Dark Theme')).toBe(true);
      expect(themes.some(t => t.name === 'Saved Light Theme')).toBe(true);
      expect(themes.some(t => t.name === 'Default Light')).toBe(true);
      expect(themes.some(t => t.name === 'Default Dark')).toBe(true);

      // 验证主题详细信息
      const darkTheme = configManager.getTheme('Saved Dark Theme');
      expect(darkTheme?.colors.background).toBe('#1A1A1A');
      expect(darkTheme?.fonts.family).toBe('Fira Code');
    });

    it('应该处理复杂主题配置', async () => {
      // Arrange - 复杂的主题配置
      const complexThemes = [
        {
          name: 'High Contrast',
          colors: {
            background: '#000000',
            foreground: '#FFFFFF',
            channelColors: ['#FFFF00', '#00FFFF', '#FF00FF', '#00FF00', '#FF0000', '#0000FF'],
            gridColor: '#808080',
            markerColor: '#FFFFFF',
            triggerColor: '#FFFF00'
          },
          fonts: {
            family: 'Liberation Mono',
            size: 16,
            weight: 'bold'
          }
        }
      ];

      mockFS.readFile
        .mockRejectedValueOnce(new Error('Device config not found'))
        .mockResolvedValueOnce(JSON.stringify(complexThemes));

      // Act
      await configManager.initialize();

      // Assert
      const themes = configManager.getAllThemes();
      const highContrastTheme = configManager.getTheme('High Contrast');
      
      expect(highContrastTheme).toBeDefined();
      expect(highContrastTheme?.colors.channelColors.length).toBe(6);
      expect(highContrastTheme?.fonts.size).toBe(16);
    });

    it('应该在主题文件为空时仍加载默认主题', async () => {
      // Arrange - 空的主题配置
      mockFS.readFile
        .mockRejectedValueOnce(new Error('Device config not found'))
        .mockResolvedValueOnce(JSON.stringify([]));

      // 创建新的配置管理器实例以避免状态干扰
      const freshConfigManager = new ConfigurationManager();

      // Act
      await freshConfigManager.initialize();

      // Assert - 应该只有默认主题
      const themes = freshConfigManager.getAllThemes();
      expect(themes.some(t => t.name === 'Default Light')).toBe(true);
      expect(themes.some(t => t.name === 'Default Dark')).toBe(true);
      expect(themes.length).toBe(2); // 只有两个默认主题

      await freshConfigManager.dispose();
    });
  });

  describe('错误处理覆盖测试', () => {
    beforeEach(async () => {
      mockVSCode.workspace.workspaceFolders = [{
        uri: { fsPath: '/test/workspace' }
      }];
      await configManager.initialize();
    });

    it('应该处理保存设备配置时的文件系统错误', async () => {
      // Arrange
      const deviceConfig = {
        deviceId: 'test-device',
        name: 'Test Device',
        type: 'LogicAnalyzer',
        connectionString: 'COM1',
        settings: {},
        lastUsed: new Date().toISOString(),
        favorite: false
      };

      // 模拟mkdir成功但writeFile失败
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockRejectedValue(new Error('Disk full'));

      // Mock console.error to capture the error log
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act - 保存设备配置应该处理错误
      await configManager.saveDeviceConfiguration(deviceConfig);

      // Assert - 设备仍应保存在内存中，但文件写入失败应被记录
      const device = configManager.getDeviceConfiguration('test-device');
      expect(device).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('保存设备配置失败:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('应该处理保存主题时的文件系统错误', async () => {
      // Arrange
      const theme = {
        name: 'Error Theme',
        colors: {
          background: '#000000',
          foreground: '#FFFFFF',
          channelColors: ['#FF0000'],
          gridColor: '#333333',
          markerColor: '#FFFF00',
          triggerColor: '#FF00FF'
        },
        fonts: {
          family: 'Consolas',
          size: 12,
          weight: 'normal'
        }
      };

      // 模拟mkdir成功但writeFile失败
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockRejectedValue(new Error('Permission denied'));

      // Mock console.error to capture the error log
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      await configManager.saveTheme(theme);

      // Assert
      const savedTheme = configManager.getTheme('Error Theme');
      expect(savedTheme).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('保存主题失败:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('边界条件和完整性测试', () => {
    beforeEach(async () => {
      mockVSCode.workspace.workspaceFolders = [{
        uri: { fsPath: '/test/workspace' }
      }];
      await configManager.initialize();
    });

    it('应该处理JSON解析错误的设备配置文件', async () => {
      // Arrange - 无效的JSON
      mockFS.readFile
        .mockResolvedValueOnce('invalid json content')
        .mockRejectedValueOnce(new Error('Theme file not found'));

      // 创建新的配置管理器实例以避免状态干扰
      const freshConfigManager = new ConfigurationManager();

      // Act & Assert - 应该不抛出异常
      await expect(freshConfigManager.initialize()).resolves.not.toThrow();
      
      // 应该使用空的设备配置
      const devices = freshConfigManager.getAllDeviceConfigurations();
      expect(devices.length).toBe(0);

      await freshConfigManager.dispose();
    });

    it('应该处理JSON解析错误的主题配置文件', async () => {
      // Arrange
      mockFS.readFile
        .mockRejectedValueOnce(new Error('Device file not found'))
        .mockResolvedValueOnce('{ invalid json }');

      // Act & Assert - 应该不抛出异常
      await expect(configManager.initialize()).resolves.not.toThrow();
      
      // 应该加载默认主题
      const themes = configManager.getAllThemes();
      expect(themes.some(t => t.name === 'Default Light')).toBe(true);
    });

    it('应该处理设备配置文件中的无效数据结构', async () => {
      // Arrange - 有效JSON但无效数据结构
      const invalidDeviceData = [
        { invalidField: 'value' }, // 缺少必需字段
        {
          deviceId: 'valid-device',
          name: 'Valid Device',
          type: 'LogicAnalyzer',
          connectionString: 'COM1',
          settings: {},
          lastUsed: new Date().toISOString(),
          favorite: false
        }
      ];

      mockFS.readFile
        .mockResolvedValueOnce(JSON.stringify(invalidDeviceData))
        .mockRejectedValueOnce(new Error('Theme file not found'));

      // 创建新的配置管理器实例以避免状态干扰
      const freshConfigManager = new ConfigurationManager();

      // Act
      await freshConfigManager.initialize();

      // Assert - 应该处理有效的设备，忽略无效的
      const devices = freshConfigManager.getAllDeviceConfigurations();
      expect(devices.some(d => d.deviceId === 'valid-device')).toBe(true);

      await freshConfigManager.dispose();
    });
  });
});