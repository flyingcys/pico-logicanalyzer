import { DatabaseIntegration } from '../../src/database/DatabaseIntegration';
import { HardwareCompatibilityDatabase } from '../../src/database/HardwareCompatibilityDatabase';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { DeviceInfo } from '../../src/models/AnalyzerTypes';

// Mock依赖
jest.mock('../../src/database/HardwareCompatibilityDatabase');
jest.mock('../../src/database/DatabaseManager');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

describe('DatabaseIntegration', () => {
  let mockDatabase: jest.Mocked<HardwareCompatibilityDatabase>;
  let mockManager: jest.Mocked<DatabaseManager>;
  let integration: DatabaseIntegration;

  beforeEach(() => {
    // 重置单例实例
    (DatabaseIntegration as any).instance = null;
    
    // 创建mock实例
    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(undefined),
      queryDevices: jest.fn().mockResolvedValue([]),
      updateTestResults: jest.fn().mockResolvedValue(undefined),
      addUserFeedback: jest.fn().mockResolvedValue(undefined),
      getStatistics: jest.fn().mockResolvedValue({
        totalDevices: 3,
        devicesByCategory: { 'usb-la': 2, 'network-la': 1 },
        devicesByManufacturer: { 'DebugVn': 1, 'Saleae': 1, 'Rigol': 1 },
        certificationLevels: { 'certified': 1, 'verified': 1, 'community': 1 },
        averageUserRating: 4.17
      }),
      addOrUpdateDevice: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn()
    } as any;

    mockManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      smartDeviceMatching: jest.fn().mockResolvedValue({
        exactMatches: [],
        partialMatches: [],
        suggestedDrivers: [],
        confidence: 0.5
      }),
      dispose: jest.fn()
    } as any;

    // Mock构造函数
    (HardwareCompatibilityDatabase as jest.Mock).mockImplementation(() => mockDatabase);
    (DatabaseManager as jest.Mock).mockImplementation(() => mockManager);

    integration = DatabaseIntegration.getInstance();
  });

  afterEach(() => {
    integration.dispose();
    jest.clearAllMocks();
  });

  describe('单例模式', () => {
    it('getInstance应该返回同一个实例', () => {
      const instance1 = DatabaseIntegration.getInstance();
      const instance2 = DatabaseIntegration.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(DatabaseIntegration);
    });

    it('多次调用getInstance应该只创建一次实例', () => {
      DatabaseIntegration.getInstance();
      DatabaseIntegration.getInstance();
      DatabaseIntegration.getInstance();
      
      expect(HardwareCompatibilityDatabase).toHaveBeenCalledTimes(1);
      expect(DatabaseManager).toHaveBeenCalledTimes(1);
    });
  });

  describe('初始化', () => {
    it('initialize应该初始化数据库和管理器', async () => {
      await integration.initialize();
      
      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
      expect(mockManager.initialize).toHaveBeenCalledTimes(1);
    });

    it('重复调用initialize应该只初始化一次', async () => {
      await integration.initialize();
      await integration.initialize();
      await integration.initialize();
      
      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
      expect(mockManager.initialize).toHaveBeenCalledTimes(1);
    });

    it('初始化失败时应该抛出错误', async () => {
      const error = new Error('初始化失败');
      mockDatabase.initialize.mockRejectedValueOnce(error);
      
      await expect(integration.initialize()).rejects.toThrow('初始化失败');
    });

    it('管理器初始化失败时应该抛出错误', async () => {
      const error = new Error('管理器初始化失败');
      mockManager.initialize.mockRejectedValueOnce(error);
      
      await expect(integration.initialize()).rejects.toThrow('管理器初始化失败');
    });
  });

  describe('增强的设备发现', () => {
    const mockDeviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'TestManufacturer',
      model: 'TestModel',
      serialNumber: 'TEST123'
    };

    const mockMatchResult = {
      exactMatches: [{
        deviceId: 'test-device-1',
        manufacturer: 'TestManufacturer',
        model: 'TestModel',
        driverCompatibility: {
          primaryDriver: 'TestDriver',
          compatibilityLevel: 'full',
          knownIssues: ['Issue 1'],
          workarounds: ['Workaround 1']
        },
        testStatus: {
          testResults: {
            driverValidation: 95
          }
        },
        communityFeedback: {
          userRating: 4.5
        },
        connectionOptions: {
          defaultConnectionString: 'COM3'
        },
        category: 'usb-la'
      }],
      partialMatches: [{
        deviceId: 'test-device-2',
        driverCompatibility: {
          primaryDriver: 'PartialDriver'
        }
      }],
      suggestedDrivers: ['SuggestedDriver1', 'SuggestedDriver2'],
      confidence: 0.85
    };

    it('enhancedDeviceDiscovery应该返回推荐驱动和兼容性信息', async () => {
      mockManager.smartDeviceMatching.mockResolvedValueOnce(mockMatchResult as any);

      const result = await integration.enhancedDeviceDiscovery(mockDeviceInfo);

      expect(mockManager.smartDeviceMatching).toHaveBeenCalledWith(mockDeviceInfo);
      expect(result.recommendedDrivers).toContain('TestDriver');
      expect(result.recommendedDrivers).toContain('PartialDriver');
      expect(result.recommendedDrivers).toContain('SuggestedDriver1');
      expect(result.recommendedDrivers).toContain('SuggestedDriver2');
      expect(result.confidence).toBe(0.85);
      expect(result.compatibilityInfo).toHaveLength(1);
      expect(result.connectionStrings).toContain('COM3');
      expect(result.setupInstructions.length).toBeGreaterThan(0);
    });

    it('enhancedDeviceDiscovery应该去重推荐驱动', async () => {
      const duplicateResult = {
        ...mockMatchResult,
        partialMatches: [{
          deviceId: 'test-device-2',
          driverCompatibility: {
            primaryDriver: 'TestDriver' // 与exactMatches重复
          }
        }]
      };
      mockManager.smartDeviceMatching.mockResolvedValueOnce(duplicateResult as any);

      const result = await integration.enhancedDeviceDiscovery(mockDeviceInfo);

      const driverCount = result.recommendedDrivers.filter(d => d === 'TestDriver').length;
      expect(driverCount).toBe(1);
    });

    it('enhancedDeviceDiscovery应该生成USB设备的设置说明', async () => {
      const usbMatchResult = {
        exactMatches: [{
          ...mockMatchResult.exactMatches[0],
          category: 'usb-la',
          connectionOptions: {
            defaultConnectionString: 'COM3',
            connectionParameters: { baudRate: 115200 }
          }
        }],
        partialMatches: [],
        suggestedDrivers: [],
        confidence: 0.95
      };
      mockManager.smartDeviceMatching.mockResolvedValueOnce(usbMatchResult as any);

      const result = await integration.enhancedDeviceDiscovery(mockDeviceInfo);

      expect(result.setupInstructions).toContain('1. 将设备通过USB连接到计算机');
      expect(result.setupInstructions).toContain('2. 等待设备驱动安装完成');
      expect(result.setupInstructions).toContain('3. 配置串口参数: 115200 bps');
    });

    it('enhancedDeviceDiscovery应该生成网络设备的设置说明', async () => {
      const networkMatchResult = {
        exactMatches: [{
          ...mockMatchResult.exactMatches[0],
          category: 'network-la',
          connectionOptions: {
            defaultConnectionString: '192.168.1.100:5555'
          }
        }],
        partialMatches: [],
        suggestedDrivers: [],
        confidence: 0.95
      };
      mockManager.smartDeviceMatching.mockResolvedValueOnce(networkMatchResult as any);

      const result = await integration.enhancedDeviceDiscovery(mockDeviceInfo);

      expect(result.setupInstructions).toContain('1. 确保设备连接到网络');
      expect(result.setupInstructions).toContain('2. 配置设备IP地址或使用默认地址: 192.168.1.100:5555');
      expect(result.setupInstructions).toContain('3. 检查网络连通性');
    });

    it('enhancedDeviceDiscovery应该处理已知问题的解决方案', async () => {
      const issueMatchResult = {
        exactMatches: [{
          ...mockMatchResult.exactMatches[0],
          driverCompatibility: {
            ...mockMatchResult.exactMatches[0].driverCompatibility,
            workarounds: ['解决方案1', '解决方案2']
          }
        }],
        partialMatches: [],
        suggestedDrivers: [],
        confidence: 0.95
      };
      mockManager.smartDeviceMatching.mockResolvedValueOnce(issueMatchResult as any);

      const result = await integration.enhancedDeviceDiscovery(mockDeviceInfo);

      expect(result.setupInstructions).toContain('已知问题解决方案:');
      expect(result.setupInstructions).toContain('1. 解决方案1');
      expect(result.setupInstructions).toContain('2. 解决方案2');
    });
  });

  describe('驱动性能预测', () => {
    const mockDeviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'TestManufacturer'
    };

    it('predictDriverPerformance应该基于历史数据预测性能', async () => {
      const mockSimilarDevices = [
        {
          testStatus: { testResults: { driverValidation: 85 } },
          communityFeedback: { userRating: 4.2 },
          driverCompatibility: { knownIssues: ['连接超时'] }
        },
        {
          testStatus: { testResults: { driverValidation: 90 } },
          communityFeedback: { userRating: 4.5 },
          driverCompatibility: { knownIssues: ['兼容性问题'] }
        }
      ];
      mockDatabase.queryDevices.mockResolvedValueOnce(mockSimilarDevices as any);

      const result = await integration.predictDriverPerformance('TestDriver', mockDeviceInfo);

      expect(mockDatabase.queryDevices).toHaveBeenCalledWith({
        manufacturer: 'TestManufacturer',
        driverName: 'TestDriver'
      });

      expect(result.expectedPerformance.reliability).toBe('good');
      expect(result.expectedPerformance.userSatisfaction).toBe(4.35); // (4.2 + 4.5) / 2
      expect(result.riskFactors).toContain('连接超时');
      expect(result.riskFactors).toContain('兼容性问题');
      expect(result.expectedPerformance.connectionTime).toBeLessThan(5000);
      expect(result.expectedPerformance.captureTime).toBeLessThan(10000);
    });

    it('predictDriverPerformance应该处理没有历史数据的情况', async () => {
      mockDatabase.queryDevices.mockResolvedValueOnce([]);

      const result = await integration.predictDriverPerformance('NewDriver', mockDeviceInfo);

      expect(result.expectedPerformance).toEqual({
        connectionTime: 5000,
        captureTime: 10000,
        reliability: 'fair',
        userSatisfaction: 3.0
      });
      expect(result.riskFactors).toContain('缺少历史数据');
      expect(result.riskFactors).toContain('未经验证的驱动组合');
      expect(result.optimizationSuggestions).toContain('建议进行完整测试');
      expect(result.optimizationSuggestions).toContain('考虑使用已验证的备选驱动');
    });

    it('predictDriverPerformance应该基于验证分数生成建议', async () => {
      const lowScoreDevices = [
        {
          testStatus: { testResults: { driverValidation: 55 } },
          communityFeedback: { userRating: 2.8 },
          driverCompatibility: { knownIssues: [] }
        }
      ];
      mockDatabase.queryDevices.mockResolvedValueOnce(lowScoreDevices as any);

      const result = await integration.predictDriverPerformance('LowScoreDriver', mockDeviceInfo);

      expect(result.optimizationSuggestions).toContain('驱动验证分数较低，建议使用备选驱动');
      expect(result.optimizationSuggestions).toContain('用户满意度较低，建议查看用户反馈');
      expect(result.expectedPerformance.reliability).toBe('poor');
    });

    it('predictDriverPerformance应该正确计算优秀的可靠性', async () => {
      const excellentDevices = [
        {
          testStatus: { testResults: { driverValidation: 95 } },
          communityFeedback: { userRating: 4.8 },
          driverCompatibility: { knownIssues: [] }
        }
      ];
      mockDatabase.queryDevices.mockResolvedValueOnce(excellentDevices as any);

      const result = await integration.predictDriverPerformance('ExcellentDriver', mockDeviceInfo);

      expect(result.expectedPerformance.reliability).toBe('excellent');
    });
  });

  describe('测试结果更新', () => {
    it('updateTestResults应该更新数据库中的测试结果', async () => {
      const testResults = {
        validationScore: 85,
        functionalScore: 90,
        performanceGrade: 'A' as const,
        connectionTime: 2000,
        captureTime: 5000,
        reliability: 'good' as const
      };

      await integration.updateTestResults('test-device', 'TestDriver', testResults);

      expect(mockDatabase.updateTestResults).toHaveBeenCalledWith('test-device', {
        driverValidation: 85,
        functionalTests: 90,
        performanceGrade: 'A',
        reliability: 'good'
      });
    });

    it('updateTestResults应该处理更新失败的情况', async () => {
      const error = new Error('更新失败');
      mockDatabase.updateTestResults.mockRejectedValueOnce(error);
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const testResults = {
        validationScore: 85,
        functionalScore: 90,
        performanceGrade: 'A' as const,
        connectionTime: 2000,
        captureTime: 5000,
        reliability: 'good' as const
      };

      await integration.updateTestResults('test-device', 'TestDriver', testResults);

      expect(consoleErrorSpy).toHaveBeenCalledWith('更新测试结果失败:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('用户反馈提交', () => {
    it('submitUserFeedback应该提交用户反馈到数据库', async () => {
      const feedback = {
        rating: 4.5,
        comment: '很好用',
        issues: ['连接偶尔不稳定'],
        driverUsed: 'TestDriver',
        setupDifficulty: 'easy' as const,
        performanceSatisfaction: 4
      };

      await integration.submitUserFeedback('test-device', feedback);

      expect(mockDatabase.addUserFeedback).toHaveBeenCalledWith(
        'test-device',
        4.5,
        '很好用',
        ['连接偶尔不稳定']
      );
    });

    it('submitUserFeedback应该处理没有issues的情况', async () => {
      const feedback = {
        rating: 5.0,
        comment: '完美运行'
      };

      await integration.submitUserFeedback('test-device', feedback);

      expect(mockDatabase.addUserFeedback).toHaveBeenCalledWith(
        'test-device',
        5.0,
        '完美运行',
        []
      );
    });

    it('submitUserFeedback应该处理提交失败的情况', async () => {
      const error = new Error('提交失败');
      mockDatabase.addUserFeedback.mockRejectedValueOnce(error);
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const feedback = {
        rating: 4.0,
        comment: '还不错'
      };

      await integration.submitUserFeedback('test-device', feedback);

      expect(consoleErrorSpy).toHaveBeenCalledWith('提交用户反馈失败:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('兼容性报告生成', () => {
    const mockStats = {
      totalDevices: 3,
      devicesByCategory: { 'usb-la': 2, 'network-la': 1 },
      devicesByManufacturer: { 'DebugVn': 1, 'Saleae': 1, 'Rigol': 1 },
      certificationLevels: { 'certified': 1, 'verified': 1, 'community': 1 },
      averageUserRating: 4.17
    };

    const mockDevices = [
      {
        model: 'TestModel1',
        manufacturer: 'TestManufacturer1',
        driverCompatibility: { primaryDriver: 'Driver1', compatibilityLevel: 'full' },
        testStatus: { testResults: { driverValidation: 95 }, certificationLevel: 'certified' },
        communityFeedback: { userRating: 4.5 }
      }
    ];

    beforeEach(() => {
      mockDatabase.getStatistics.mockResolvedValue(mockStats);
      mockDatabase.queryDevices.mockResolvedValue(mockDevices as any);
    });

    it('generateCompatibilityReport应该生成JSON格式报告', async () => {
      const result = await integration.generateCompatibilityReport('json');

      const report = JSON.parse(result);
      expect(report.statistics).toEqual(mockStats);
      expect(report.devices).toEqual(mockDevices);
      expect(report.generatedAt).toBeDefined();
    });

    it('generateCompatibilityReport应该生成Markdown格式报告', async () => {
      const result = await integration.generateCompatibilityReport('markdown');

      expect(result).toContain('# 硬件兼容性报告');
      expect(result).toContain('## 总体统计');
      expect(result).toContain('- 总设备数: 3');
      expect(result).toContain('- 平均用户评分: 4.17/5.0');
      expect(result).toContain('## 设备类别分布');
      expect(result).toContain('- usb-la: 2');
      expect(result).toContain('- network-la: 1');
    });

    it('generateCompatibilityReport应该生成HTML格式报告', async () => {
      const result = await integration.generateCompatibilityReport('html');

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<title>硬件兼容性报告</title>');
      expect(result).toContain('<h1>硬件兼容性报告</h1>');
      expect(result).toContain('总设备数');
      expect(result).toContain('平均用户评分');
      expect(result).toContain('设备类别分布');
      expect(result).toContain('制造商分布');
      expect(result).toContain('设备详细信息');
    });

    it('generateCompatibilityReport默认应该生成HTML格式', async () => {
      const result = await integration.generateCompatibilityReport();

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<title>硬件兼容性报告</title>');
    });
  });

  describe('批量设备导入', () => {
    const mockDevices = [
      {
        deviceId: 'device-1',
        manufacturer: 'Manufacturer1',
        model: 'Model1'
      },
      {
        deviceId: 'device-2',
        manufacturer: 'Manufacturer2',
        model: 'Model2'
      },
      {
        // 缺少必填字段的设备
        deviceId: 'device-3'
      }
    ];

    it('batchImportDevices应该成功导入有效设备', async () => {
      mockDatabase.addOrUpdateDevice.mockResolvedValue(undefined);

      const result = await integration.batchImportDevices(mockDevices, true);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('缺少必填字段');
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledTimes(2);
    });

    it('batchImportDevices应该在不验证时导入所有设备', async () => {
      mockDatabase.addOrUpdateDevice.mockResolvedValue(undefined);

      const result = await integration.batchImportDevices(mockDevices, false);

      expect(result.imported).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledTimes(3);
    });

    it('batchImportDevices应该处理数据库写入失败', async () => {
      mockDatabase.addOrUpdateDevice
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('写入失败'))
        .mockResolvedValueOnce(undefined);

      const result = await integration.batchImportDevices(mockDevices.slice(0, 2), true);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('写入失败');
    });
  });

  describe('实例访问', () => {
    it('getDatabase应该返回数据库实例', () => {
      const database = integration.getDatabase();
      expect(database).toBe(mockDatabase);
    });

    it('getManager应该返回管理器实例', () => {
      const manager = integration.getManager();
      expect(manager).toBe(mockManager);
    });
  });

  describe('资源清理', () => {
    it('dispose应该清理所有资源', () => {
      integration.dispose();

      expect(mockDatabase.dispose).toHaveBeenCalledTimes(1);
      expect(mockManager.dispose).toHaveBeenCalledTimes(1);
    });

    it('dispose应该重置初始化状态', async () => {
      await integration.initialize();
      integration.dispose();

      // 再次初始化应该重新调用initialize方法
      await integration.initialize();
      expect(mockDatabase.initialize).toHaveBeenCalledTimes(2);
      expect(mockManager.initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理', () => {
    it('所有方法都应该在调用前初始化', async () => {
      const freshIntegration = DatabaseIntegration.getInstance();
      
      await freshIntegration.enhancedDeviceDiscovery({});
      expect(mockManager.initialize).toHaveBeenCalled();

      await freshIntegration.predictDriverPerformance('TestDriver', {});
      expect(mockDatabase.initialize).toHaveBeenCalled();

      await freshIntegration.generateCompatibilityReport();
      expect(mockDatabase.initialize).toHaveBeenCalled();
    });
  });
});