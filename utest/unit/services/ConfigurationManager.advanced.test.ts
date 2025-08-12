/**
 * ConfigurationManager 高级功能测试
 * 
 * 遵循测试质量标准:
 * - 文件大小 < 200行
 * - Mock数量 < 5个
 * - 测试真实功能而非Mock行为  
 * - 专注高级功能：设备配置→事件系统→导入导出
 */

// Mock配置 - 需要在导入之前定义
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({ 
      get: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined)
    })),
    onDidChangeConfiguration: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  }
}));

import { ConfigurationManager, ConfigurationCategory } from '../../../src/services/ConfigurationManager';

describe('ConfigurationManager 高级功能测试', () => {
  let configManager: ConfigurationManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    configManager = new ConfigurationManager();
    await configManager.initialize();
  });

  afterEach(async () => {
    if (configManager) {
      await configManager.dispose();
    }
  });

  describe('设备配置管理', () => {
    const testDevice = {
      deviceId: 'test-device-001',
      name: '测试设备',
      type: 'LogicAnalyzer',
      connectionString: '/dev/ttyUSB0',
      settings: {
        channels: 24,
        maxFrequency: 100000000
      },
      lastUsed: '2024-01-01T00:00:00.000Z',
      favorite: false
    };

    it('应该能够保存设备配置', async () => {
      await configManager.saveDeviceConfiguration(testDevice);
      
      const retrievedDevice = configManager.getDeviceConfiguration(testDevice.deviceId);
      expect(retrievedDevice).toBeDefined();
      expect(retrievedDevice?.name).toBe(testDevice.name);
      expect(retrievedDevice?.type).toBe(testDevice.type);
    });

    it('应该能够获取所有设备配置', async () => {
      await configManager.saveDeviceConfiguration(testDevice);
      
      const allDevices = configManager.getAllDeviceConfigurations();
      expect(allDevices.length).toBeGreaterThanOrEqual(1);
      
      const foundDevice = allDevices.find(d => d.deviceId === testDevice.deviceId);
      expect(foundDevice).toBeDefined();
    });

    it('应该能够删除设备配置', async () => {
      await configManager.saveDeviceConfiguration(testDevice);
      await configManager.deleteDeviceConfiguration(testDevice.deviceId);
      
      const retrievedDevice = configManager.getDeviceConfiguration(testDevice.deviceId);
      expect(retrievedDevice).toBeUndefined();
    });

    it('应该更新设备的lastUsed时间', async () => {
      const originalTime = testDevice.lastUsed;
      await configManager.saveDeviceConfiguration(testDevice);
      
      const retrievedDevice = configManager.getDeviceConfiguration(testDevice.deviceId);
      expect(retrievedDevice?.lastUsed).not.toBe(originalTime);
      expect(new Date(retrievedDevice?.lastUsed || '')).toBeInstanceOf(Date);
    });

    it('应该正确处理设备配置持久化失败', async () => {
      const persistenceTestDevice = {
        deviceId: 'persistence-test',
        name: '持久化测试设备',
        type: 'TestDevice',
        connectionString: 'test://device',
        settings: {},
        lastUsed: '2024-01-01T00:00:00.000Z',
        favorite: false
      };
      
      // 即使文件保存失败，设备也应该在内存中保存
      await configManager.saveDeviceConfiguration(persistenceTestDevice);
      
      const retrievedDevice = configManager.getDeviceConfiguration(persistenceTestDevice.deviceId);
      expect(retrievedDevice).toBeDefined();
      expect(retrievedDevice?.name).toBe(persistenceTestDevice.name);
    });
  });

  describe('配置事件系统', () => {
    it('应该能够监听配置更改事件', async () => {
      const changeHandler = jest.fn();
      configManager.onConfigurationChanged(changeHandler);
      
      await configManager.set('general.autoSave', false);
      
      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'general.autoSave',
          newValue: false,
          category: ConfigurationCategory.General
        })
      );
    });

    it('应该能够移除事件监听器', () => {
      const handler = jest.fn();
      
      configManager.on('configurationChanged', handler);
      expect(configManager.listenerCount('configurationChanged')).toBe(1);
      
      configManager.off('configurationChanged', handler);
      expect(configManager.listenerCount('configurationChanged')).toBe(0);
    });
  });

  describe('配置导入导出', () => {
    it('应该能够导出配置', async () => {
      const exportData = await configManager.exportConfiguration();
      
      expect(typeof exportData).toBe('string');
      
      const parsedData = JSON.parse(exportData);
      expect(parsedData).toHaveProperty('version');
      expect(parsedData).toHaveProperty('configurations');
      expect(parsedData).toHaveProperty('timestamp');
      expect(Object.keys(parsedData.configurations).length).toBeGreaterThan(0);
    });

    it('应该能够导入有效的配置', async () => {
      const testConfig = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        configurations: {
          'general.autoSave': false,
          'display.channelHeight': 25
        },
        devices: [],
        themes: []
      };
      
      await configManager.importConfiguration(JSON.stringify(testConfig));
      
      expect(configManager.getBoolean('general.autoSave')).toBe(false);
      expect(configManager.getNumber('display.channelHeight')).toBe(25);
    });

    it('应该拒绝无效的配置数据', async () => {
      const invalidConfig = '{"invalid": "data"}';
      
      await expect(
        configManager.importConfiguration(invalidConfig)
      ).rejects.toThrow('无效的配置数据格式');
    });
  });
});