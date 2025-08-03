/**
 * ConfigurationManager 测试
 * 测试插件配置和设置管理功能
 */

import * as vscode from 'vscode';
import { ConfigurationManager, ConfigurationCategory, ConfigurationItem } from '../../../src/services/ConfigurationManager';

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

describe('ConfigurationManager 测试', () => {
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

  describe('初始化测试', () => {
    it('应该成功初始化配置管理器', async () => {
      // Act
      await configManager.initialize();

      // Assert
      expect(mockVSCode.workspace.getConfiguration).toHaveBeenCalled();
      expect(mockVSCode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });

    it('应该加载默认配置项', async () => {
      // Act
      await configManager.initialize();

      // Assert
      const generalConfigs = configManager.getConfigurationsByCategory(ConfigurationCategory.General);
      expect(generalConfigs.length).toBeGreaterThan(0);
    });

    it('应该处理初始化错误', async () => {
      // Arrange
      mockVSCode.workspace.getConfiguration.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      // Act & Assert - 由于loadConfiguration捕获了错误，initialize不会抛出异常
      await expect(configManager.initialize()).resolves.not.toThrow();
      expect(mockVSCode.workspace.getConfiguration).toHaveBeenCalled();
    });
  });

  describe('配置获取测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      jest.clearAllMocks(); // 清理所有mock调用历史
      await configManager.initialize();
      jest.clearAllMocks(); // 再次清理初始化期间的调用
    });

    it('应该能够获取配置值', () => {
      // Arrange
      mockConfiguration.get.mockReturnValue(true);

      // Act
      const value = configManager.get('autoDetectDevices');

      // Assert
      expect(value).toBe(true);
      expect(mockConfiguration.get).toHaveBeenCalledWith('autoDetectDevices');
    });

    it('应该返回默认值当配置不存在时', () => {
      // Arrange
      mockConfiguration.get.mockReturnValue(undefined);

      // Act
      const value = configManager.get('nonExistentConfig', 'defaultValue');

      // Assert
      expect(value).toBe('defaultValue');
    });

    it('应该能够获取类型化配置值', () => {
      // Arrange
      mockConfiguration.get.mockReturnValue(24000000);

      // Act
      const value = configManager.getNumber('defaultSampleRate');

      // Assert
      expect(value).toBe(24000000);
      expect(typeof value).toBe('number');
    });

    it('应该能够获取布尔配置值', () => {
      // Arrange
      mockConfiguration.get.mockReturnValue(true);

      // Act
      const value = configManager.getBoolean('autoDetectDevices');

      // Assert
      expect(value).toBe(true);
      expect(typeof value).toBe('boolean');
    });

    it('应该能够获取字符串配置值', () => {
      // Arrange
      mockConfiguration.get.mockReturnValue('/dev/ttyUSB0');

      // Act
      const value = configManager.getString('defaultSerialPort');

      // Assert
      expect(value).toBe('/dev/ttyUSB0');
      expect(typeof value).toBe('string');
    });

    it('应该能够获取数组配置值', () => {
      // Arrange
      const mockArray = ['COM1', 'COM2', 'COM3'];
      mockConfiguration.get.mockReturnValue(mockArray);

      // Act
      const value = configManager.getArray('availablePorts');

      // Assert
      expect(value).toEqual(mockArray);
      expect(Array.isArray(value)).toBe(true);
    });
  });

  describe('配置设置测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够设置配置值', async () => {
      // Arrange
      mockConfiguration.update.mockResolvedValue(undefined);

      // Act
      await configManager.set('autoDetectDevices', false);

      // Assert
      expect(mockConfiguration.update).toHaveBeenCalledWith(
        'autoDetectDevices',
        false,
        mockVSCode.ConfigurationTarget.Workspace
      );
    });

    it('应该能够设置全局配置', async () => {
      // Arrange
      mockConfiguration.update.mockResolvedValue(undefined);

      // Act
      await configManager.set('autoDetectDevices', false, mockVSCode.ConfigurationTarget.Global);

      // Assert
      expect(mockConfiguration.update).toHaveBeenCalledWith(
        'autoDetectDevices',
        false,
        mockVSCode.ConfigurationTarget.Global
      );
    });

    it('应该处理配置设置错误', async () => {
      // Arrange
      mockConfiguration.update.mockRejectedValue(new Error('设置失败'));

      // Act & Assert
      await expect(configManager.set('testKey', 'testValue')).rejects.toThrow('设置失败');
    });

    it('应该验证配置值', async () => {
      // Arrange
      const invalidValue = -1; // 负数的采样率无效

      // Act & Assert
      await expect(configManager.set('defaultSampleRate', invalidValue)).rejects.toThrow();
    });
  });

  describe('配置验证测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该在设置无效值时抛出错误', async () => {
      // Arrange
      const invalidValue = -1; // 负数的采样率无效
      
      // Act & Assert - 由于set方法内部会进行验证
      await expect(configManager.set('defaultSampleRate', invalidValue)).rejects.toThrow();
    });
  });

  describe('配置类别管理测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够按类别获取配置', () => {
      // Act
      const generalConfigs = configManager.getConfigurationsByCategory(ConfigurationCategory.General);

      // Assert
      expect(Array.isArray(generalConfigs)).toBe(true);
      expect(generalConfigs.every(config => config.category === ConfigurationCategory.General)).toBe(true);
    });

    it('应该能够获取所有类别', () => {
      // Act
      const categories = configManager.getAllCategories();

      // Assert
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain(ConfigurationCategory.General);
      expect(categories).toContain(ConfigurationCategory.Hardware);
    });

    it('应该返回空数组对于不存在的类别', () => {
      // Act
      const configs = configManager.getConfigurationsByCategory('nonexistent' as any);

      // Assert
      expect(configs).toEqual([]);
    });
  });

  describe('配置导入导出测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够导出配置', async () => {
      // Arrange
      const filePath = '/test/export.json';
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await configManager.exportConfiguration(filePath);

      // Assert
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('{'),
        'utf8'
      );
    });

    it('应该能够导入配置', async () => {
      // Arrange
      const filePath = '/test/import.json';
      const configData = JSON.stringify({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        configurations: {
          autoDetectDevices: false,
          defaultSampleRate: 12000000,
        },
        devices: [],
        themes: []
      });
      mockFS.readFile.mockResolvedValue(configData);
      mockConfiguration.update.mockResolvedValue(undefined);

      // Act
      await configManager.importConfiguration(filePath);

      // Assert
      expect(mockFS.readFile).toHaveBeenCalledWith(filePath, 'utf8');
      expect(mockConfiguration.update).toHaveBeenCalled();
    });

    it('应该处理导入文件不存在的情况', async () => {
      // Arrange
      const filePath = '/nonexistent/import.json';
      const fileError = new Error('ENOENT: no such file or directory') as any;
      fileError.code = 'ENOENT';
      mockFS.readFile.mockRejectedValue(fileError);

      // Act & Assert
      await expect(configManager.importConfiguration(filePath)).rejects.toThrow('文件不存在');
    });

    it('应该处理无效的JSON格式', async () => {
      // Arrange
      const filePath = '/test/invalid.json';
      mockFS.readFile.mockResolvedValue('invalid json');

      // Act & Assert
      await expect(configManager.importConfiguration(filePath)).rejects.toThrow();
    });
  });

  describe('配置重置测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够重置单个配置', async () => {
      // Arrange
      mockConfiguration.update.mockResolvedValue(undefined);
      jest.clearAllMocks(); // 清理之前的调用

      // Act
      await configManager.resetConfiguration(['autoDetectDevices']);

      // Assert
      // resetConfiguration方法会调用两次update：workspace和global
      expect(mockConfiguration.update).toHaveBeenCalledWith(
        'autoDetectDevices',
        undefined,
        mockVSCode.ConfigurationTarget.Workspace
      );
      expect(mockConfiguration.update).toHaveBeenCalledWith(
        'autoDetectDevices',
        undefined,
        mockVSCode.ConfigurationTarget.Global
      );
    });

    it('应该能够重置所有配置', async () => {
      // Arrange
      mockConfiguration.update.mockResolvedValue(undefined);
      jest.clearAllMocks(); // 清理之前的调用

      // Act
      await configManager.resetConfiguration(); // 不传参数重置所有

      // Assert
      // 应该调用update方法多次（每个配置项都会调用两次：workspace和global）
      expect(mockConfiguration.update).toHaveBeenCalled();
      expect(mockConfiguration.update.mock.calls.length).toBeGreaterThan(0);
    });

    it('应该能够重置特定配置项', async () => {
      // Arrange
      mockConfiguration.update.mockResolvedValue(undefined);

      // Act
      await configManager.resetConfiguration(['autoDetectDevices']);

      // Assert
      expect(mockConfiguration.update).toHaveBeenCalled();
    });
  });

  describe('配置监听测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够监听配置变化', () => {
      // Arrange
      const listener = jest.fn();

      // Act
      configManager.onConfigurationChanged(listener);

      // Assert
      expect(mockVSCode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });

    it('应该在配置变化时触发事件', (done) => {
      // Arrange
      const listener = jest.fn();
      configManager.onConfigurationChanged(listener);
      
      // 模拟配置变化事件，应该触发configurationReloaded事件
      configManager.on('configurationReloaded', () => {
        try {
          expect(mockVSCode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
          done();
        } catch (error) {
          done(error);
        }
      });
      
      // 获取注册的变化处理器
      const changeHandler = mockVSCode.workspace.onDidChangeConfiguration.mock.calls[0][0];

      // Act - 模拟VSCode配置变化事件
      const mockChangeEvent = {
        affectsConfiguration: jest.fn().mockReturnValue(true)
      };
      changeHandler(mockChangeEvent);
    });
  });

  describe('配置管理基础功能测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够获取所有配置项', () => {
      // Act
      const allItems = configManager.getAllConfigurationItems();

      // Assert
      expect(Array.isArray(allItems)).toBe(true);
      expect(allItems.length).toBeGreaterThan(0);
    });

    it('应该能够按类别获取配置项', () => {
      // Act
      const hardwareItems = configManager.getConfigurationItemsByCategory(ConfigurationCategory.Hardware);

      // Assert
      expect(Array.isArray(hardwareItems)).toBe(true);
    });
  });

  describe('敏感信息处理测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够导出配置为JSON字符串', async () => {
      // Act
      const exportedConfig = await configManager.exportConfiguration();

      // Assert
      expect(typeof exportedConfig).toBe('string');
      expect(() => JSON.parse(exportedConfig)).not.toThrow(); // 应该是有效的JSON
    });
  });

  describe('性能测试', () => {
    beforeEach(async () => {
      // 重置mock配置，确保不受前面测试影响
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('配置获取应该快速', () => {
      // Arrange
      const iterations = 1000;
      mockConfiguration.get.mockReturnValue('testValue');

      // Act
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        configManager.get('testConfig');
      }
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成1000次获取
    });

    it('多次配置设置应该高效', async () => {
      // Arrange
      const configs = [
        ['config1', 'value1'],
        ['config2', 'value2'],
        ['config3', 'value3'],
      ];
      mockConfiguration.update.mockResolvedValue(undefined);

      // Act
      const startTime = Date.now();
      for (const [key, value] of configs) {
        await configManager.set(key, value);
      }
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // 多次设置应该在1秒内完成
    });
  });

  describe('设备配置管理测试', () => {
    beforeEach(async () => {
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      mockVSCode.workspace.workspaceFolders = [{
        uri: { fsPath: '/test/workspace' }
      }];
      await configManager.initialize();
    });

    it('应该能够保存设备配置', async () => {
      // Arrange
      const deviceConfig = {
        deviceId: 'test-device',
        name: 'Test Device',
        type: 'LogicAnalyzer',
        connectionString: 'COM1',
        settings: { baudRate: 115200 },
        lastUsed: new Date().toISOString(),
        favorite: false
      };
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await configManager.saveDeviceConfiguration(deviceConfig);

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('应该能够获取设备配置', async () => {
      // Arrange
      const deviceConfig = {
        deviceId: 'test-device',
        name: 'Test Device',
        type: 'LogicAnalyzer',
        connectionString: 'COM1',
        settings: { baudRate: 115200 },
        lastUsed: new Date().toISOString(),
        favorite: false
      };
      await configManager.saveDeviceConfiguration(deviceConfig);

      // Act
      const result = configManager.getDeviceConfiguration('test-device');

      // Assert
      expect(result).toBeDefined();
      expect(result?.deviceId).toBe('test-device');
    });

    it('应该能够获取所有设备配置并按使用时间排序', async () => {
      // Arrange - 保存两个设备
      const device1 = {
        deviceId: 'device1',
        name: 'Device 1',
        type: 'LogicAnalyzer',
        connectionString: 'COM1',
        settings: {},
        lastUsed: new Date().toISOString(),
        favorite: false
      };
      const device2 = {
        deviceId: 'device2',
        name: 'Device 2',
        type: 'LogicAnalyzer',
        connectionString: 'COM2',
        settings: {},
        lastUsed: new Date().toISOString(),
        favorite: true
      };
      await configManager.saveDeviceConfiguration(device1);
      
      // 等待一点时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await configManager.saveDeviceConfiguration(device2);

      // Act
      const devices = configManager.getAllDeviceConfigurations();

      // Assert
      expect(devices.length).toBe(2);
      expect(Array.isArray(devices)).toBe(true);
      
      // 验证数据结构
      devices.forEach(device => {
        expect(device).toHaveProperty('deviceId');
        expect(device).toHaveProperty('lastUsed');
        expect(typeof device.lastUsed).toBe('string');
      });
      
      // 验证排序：最后保存的device2应该在前面
      expect(devices[0].deviceId).toBe('device2');
    });

    it('应该能够删除设备配置', async () => {
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
      await configManager.saveDeviceConfiguration(deviceConfig);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await configManager.deleteDeviceConfiguration('test-device');

      // Assert
      expect(configManager.getDeviceConfiguration('test-device')).toBeUndefined();
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('应该处理工作区不存在的情况', () => {
      // Arrange
      mockVSCode.workspace.workspaceFolders = undefined;

      // Act & Assert
      expect(() => {
        (configManager as any).getWorkspaceConfigPath('test.json');
      }).toThrow('没有打开的工作区');
    });
  });

  describe('主题管理测试', () => {
    beforeEach(async () => {
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      mockVSCode.workspace.workspaceFolders = [{
        uri: { fsPath: '/test/workspace' }
      }];
      await configManager.initialize();
    });

    it('应该能够保存主题', async () => {
      // Arrange
      const theme = {
        name: 'Custom Theme',
        colors: {
          background: '#000000',
          foreground: '#FFFFFF',
          channelColors: ['#FF0000', '#00FF00'],
          gridColor: '#333333',
          markerColor: '#FFFF00',
          triggerColor: '#FF00FF'
        },
        fonts: {
          family: 'Consolas',
          size: 14,
          weight: 'bold'
        }
      };
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await configManager.saveTheme(theme);

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('应该能够获取主题', async () => {
      // Arrange
      const theme = {
        name: 'Test Theme',
        colors: {
          background: '#000000',
          foreground: '#FFFFFF',
          channelColors: ['#FF0000'],
          gridColor: '#333333',
          markerColor: '#FFFF00',
          triggerColor: '#FF00FF'
        },
        fonts: {
          family: 'Arial',
          size: 12,
          weight: 'normal'
        }
      };
      await configManager.saveTheme(theme);

      // Act
      const result = configManager.getTheme('Test Theme');

      // Assert
      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Theme');
    });

    it('应该能够获取所有主题', async () => {
      // Arrange
      const theme1 = {
        name: 'Theme 1',
        colors: {
          background: '#FFFFFF',
          foreground: '#000000',
          channelColors: ['#FF0000'],
          gridColor: '#EEEEEE',
          markerColor: '#0000FF',
          triggerColor: '#00FF00'
        },
        fonts: {
          family: 'Arial',
          size: 12,
          weight: 'normal'
        }
      };
      await configManager.saveTheme(theme1);

      // Act
      const themes = configManager.getAllThemes();

      // Assert
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.some(t => t.name === 'Theme 1')).toBe(true);
    });

    it('应该能够设置当前主题', async () => {
      // Arrange
      mockConfiguration.update.mockResolvedValue(undefined);
      const themeName = 'dark';

      // Act
      await configManager.setCurrentTheme(themeName);

      // Assert
      expect(mockConfiguration.update).toHaveBeenCalledWith(
        'display.theme',
        themeName,
        mockVSCode.ConfigurationTarget.Workspace
      );
    });

    it('应该能够获取当前主题', () => {
      // Arrange - 设置 currentTheme 属性
      (configManager as any).currentTheme = 'light';
      mockConfiguration.get.mockReturnValue('light');

      // Act
      const currentTheme = configManager.getCurrentTheme();

      // Assert
      expect(currentTheme).toBe('light');
    });

    it('应该在主题文件加载失败时加载默认主题', async () => {
      // Arrange
      mockFS.readFile.mockRejectedValue(new Error('File not found'));
      
      // Act
      await (configManager as any).loadThemes();
      const themes = configManager.getAllThemes();

      // Assert
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.some(t => t.name === 'Default Light')).toBe(true);
      expect(themes.some(t => t.name === 'Default Dark')).toBe(true);
    });
  });

  describe('配置验证详细测试', () => {
    beforeEach(async () => {
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该验证必需字段', async () => {
      // Arrange - 创建一个需要验证的配置项
      const testConfig = {
        key: 'test.required',
        category: ConfigurationCategory.General,
        displayName: 'Test Required',
        description: 'Test required field',
        type: 'string' as const,
        defaultValue: 'default',
        validation: { required: true },
        scope: 'both' as const
      };
      (configManager as any).configItems.set('test.required', testConfig);

      // Act & Assert
      await expect(configManager.set('test.required', '')).rejects.toThrow('此配置项为必需项');
      await expect(configManager.set('test.required', null as any)).rejects.toThrow('此配置项为必需项');
      await expect(configManager.set('test.required', undefined as any)).rejects.toThrow('此配置项为必需项');
    });

    it('应该验证数值范围', async () => {
      // Arrange
      const testConfig = {
        key: 'test.number',
        category: ConfigurationCategory.General,
        displayName: 'Test Number',
        description: 'Test number validation',
        type: 'number' as const,
        defaultValue: 50,
        validation: { min: 10, max: 100 },
        scope: 'both' as const
      };
      (configManager as any).configItems.set('test.number', testConfig);

      // Act & Assert
      await expect(configManager.set('test.number', 5)).rejects.toThrow('值不能小于 10');
      await expect(configManager.set('test.number', 150)).rejects.toThrow('值不能大于 100');
    });

    it('应该验证正则表达式', async () => {
      // Arrange
      const testConfig = {
        key: 'test.pattern',
        category: ConfigurationCategory.General,
        displayName: 'Test Pattern',
        description: 'Test pattern validation',
        type: 'string' as const,
        defaultValue: 'valid',
        validation: { pattern: '^[a-z]+$' },
        scope: 'both' as const
      };
      (configManager as any).configItems.set('test.pattern', testConfig);

      // Act & Assert
      await expect(configManager.set('test.pattern', 'Valid123')).rejects.toThrow('值格式不正确');
    });

    it('应该验证自定义验证器', async () => {
      // Arrange
      const testConfig = {
        key: 'test.custom',
        category: ConfigurationCategory.General,
        displayName: 'Test Custom',
        description: 'Test custom validation',
        type: 'string' as const,
        defaultValue: 'valid',
        validation: {
          custom: (value: any) => {
            if (value === 'invalid') {
              return '自定义验证失败';
            }
            return null;
          }
        },
        scope: 'both' as const
      };
      (configManager as any).configItems.set('test.custom', testConfig);

      // Act & Assert
      await expect(configManager.set('test.custom', 'invalid')).rejects.toThrow('自定义验证失败');
    });
  });

  describe('JSON导入边界情况测试', () => {
    beforeEach(async () => {
      mockVSCode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
      await configManager.initialize();
    });

    it('应该能够从JSON字符串导入配置', async () => {
      // Arrange
      const configData = JSON.stringify({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        configurations: {
          'autoDetectDevices': true
        },
        devices: [],
        themes: []
      });
      mockConfiguration.update.mockResolvedValue(undefined);

      // Act
      await configManager.importConfiguration(configData);

      // Assert
      expect(mockConfiguration.update).toHaveBeenCalled();
    });

    it('应该处理无效的配置数据格式', async () => {
      // Arrange
      const invalidData = JSON.stringify({
        // 缺少必需的version和configurations字段
        someOtherField: 'value'
      });

      // Act & Assert
      await expect(configManager.importConfiguration(invalidData)).rejects.toThrow('无效的配置数据格式');
    });
  });

  describe('内存管理测试', () => {
    it('dispose应该清理资源', async () => {
      // Arrange
      await configManager.initialize();

      // Act
      await configManager.dispose();

      // Assert - dispose应该移除所有事件监听器
      expect(configManager.listenerCount('configurationChanged')).toBe(0);
    });
  });
});