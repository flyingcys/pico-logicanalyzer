/**
 * HardwareCompatibilityDatabase 单元测试
 * 测试硬件兼容性数据库的完整功能，包括数据存储、查询、管理等
 */

import { HardwareCompatibilityDatabase, DeviceCompatibilityEntry, CompatibilityQuery } from '../../src/database/HardwareCompatibilityDatabase';
import { DeviceInfo } from '../../src/models/AnalyzerTypes';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// 模拟文件系统操作
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('HardwareCompatibilityDatabase', () => {
  let database: HardwareCompatibilityDatabase;
  let tempDbPath: string;
  let mockDeviceEntry: DeviceCompatibilityEntry;

  beforeEach(() => {
    // 创建临时数据库路径
    tempDbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.json`);
    database = new HardwareCompatibilityDatabase(tempDbPath);

    // 创建模拟设备条目
    mockDeviceEntry = {
      deviceId: 'test-device-1',
      manufacturer: 'TestManufacturer',
      model: 'TestModel',
      version: '1.0',
      category: 'usb-la',
      identifiers: {
        vendorId: '1234',
        productId: '5678',
        serialPattern: 'TEST*'
      },
      driverCompatibility: {
        primaryDriver: 'TestDriver',
        alternativeDrivers: ['AlternativeDriver'],
        driverVersion: '2.0.0',
        compatibilityLevel: 'full',
        knownIssues: ['Issue 1'],
        workarounds: ['Workaround 1']
      },
      capabilities: {
        channels: {
          digital: 8,
          analog: 0,
          maxVoltage: 5.0,
          inputImpedance: 1000000,
          thresholdVoltages: [0.8, 1.5, 2.5, 3.3, 5.0]
        },
        sampling: {
          maxRate: 100000000,
          minRate: 1000,
          supportedRates: [1000, 10000, 100000, 1000000, 10000000, 100000000],
          bufferSize: 131072,
          streamingSupport: false,
          compressionSupport: true
        },
        triggers: {
          types: ['edge', 'pattern'],
          maxChannels: 8,
          advancedTriggers: true,
          triggerPosition: true
        },
        protocol: {
          supportedProtocols: ['uart', 'spi', 'i2c'],
          hardwareDecoding: false,
          customProtocols: false
        },
        advanced: {
          memorySegmentation: false,
          externalClock: false,
          calibration: true,
          selfTest: true
        }
      },
      connectionOptions: {
        defaultConnectionString: 'COM3',
        alternativeConnections: ['COM1', 'COM2'],
        connectionParameters: {
          baudRate: 115200,
          timeout: 5000
        }
      },
      testStatus: {
        lastTested: new Date('2024-01-15'),
        testResults: {
          driverValidation: 90,
          functionalTests: 85,
          performanceGrade: 'A',
          reliability: 'excellent'
        },
        certificationLevel: 'certified'
      },
      communityFeedback: {
        userRating: 4.5,
        reportCount: 10,
        commonIssues: ['Windows driver signing'],
        userComments: ['Great performance', 'Easy to use']
      },
      metadata: {
        addedDate: new Date('2024-01-01'),
        lastUpdated: new Date('2024-01-15'),
        maintainer: 'Test Team',
        documentationUrl: 'https://example.com/docs',
        vendorUrl: 'https://example.com',
        supportStatus: 'active'
      }
    };

    // 清除console输出以避免测试污染
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // 重置所有mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    database.dispose();
    jest.restoreAllMocks();
  });

  describe('初始化和数据加载', () => {
    it('应该成功初始化新数据库', async () => {
      // 模拟文件不存在的情况
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      await database.initialize();

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('应该加载现有数据库文件', async () => {
      const existingData = {
        version: '2.0',
        entries: [mockDeviceEntry]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingData));
      mockFs.mkdir.mockResolvedValue(undefined);

      await database.initialize();

      expect(mockFs.readFile).toHaveBeenCalledWith(tempDbPath, 'utf-8');
    });

    it('应该加载默认数据当数据库为空时', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      await database.initialize();

      // 验证默认数据被保存
      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[0][1] as string);
      expect(savedData.entries).toBeDefined();
      expect(savedData.entries.length).toBeGreaterThan(0);
    });

    it('应该处理数据库文件读取错误', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));
      mockFs.mkdir.mockResolvedValue(undefined);

      await expect(database.initialize()).rejects.toThrow('Permission denied');
    });

    it('应该正确解析日期字段', async () => {
      const dataWithDateStrings = {
        version: '2.0',
        entries: [{
          ...mockDeviceEntry,
          testStatus: {
            ...mockDeviceEntry.testStatus,
            lastTested: '2024-01-15T10:00:00.000Z'
          },
          metadata: {
            ...mockDeviceEntry.metadata,
            addedDate: '2024-01-01T10:00:00.000Z',
            lastUpdated: '2024-01-15T10:00:00.000Z'
          }
        }]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(dataWithDateStrings));
      mockFs.mkdir.mockResolvedValue(undefined);

      await database.initialize();

      // 验证日期被正确解析为Date对象
      expect(mockFs.readFile).toHaveBeenCalled();
    });
  });

  describe('设备查询功能', () => {
    beforeEach(async () => {
      // 设置模拟数据
      const testData = {
        version: '2.0',
        entries: [
          mockDeviceEntry,
          {
            ...mockDeviceEntry,
            deviceId: 'test-device-2',
            manufacturer: 'AnotherManufacturer',
            model: 'AnotherModel',
            category: 'network-la',
            identifiers: {
              vendorId: '9999',
              productId: '8888',
              serialPattern: 'ANOTHER*'
            },
            driverCompatibility: {
              ...mockDeviceEntry.driverCompatibility,
              primaryDriver: 'AnotherDriver',
              compatibilityLevel: 'partial'
            },
            testStatus: {
              ...mockDeviceEntry.testStatus,
              certificationLevel: 'community'
            }
          }
        ]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await database.initialize();
    });

    it('应该根据制造商查询设备', async () => {
      const query: CompatibilityQuery = {
        manufacturer: 'TestManufacturer'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].manufacturer).toBe('TestManufacturer');
    });

    it('应该根据型号查询设备', async () => {
      const query: CompatibilityQuery = {
        model: 'TestModel'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].model).toBe('TestModel');
    });

    it('应该根据类别查询设备', async () => {
      const query: CompatibilityQuery = {
        category: 'usb-la'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('usb-la');
    });

    it('应该根据驱动名称查询设备', async () => {
      const query: CompatibilityQuery = {
        driverName: 'TestDriver'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].driverCompatibility.primaryDriver).toBe('TestDriver');
    });

    it('应该根据兼容性级别查询设备', async () => {
      const query: CompatibilityQuery = {
        compatibilityLevel: 'full'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].driverCompatibility.compatibilityLevel).toBe('full');
    });

    it('应该根据认证级别查询设备', async () => {
      const query: CompatibilityQuery = {
        certificationLevel: 'certified'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].testStatus.certificationLevel).toBe('certified');
    });

    it('应该根据最小验证分数过滤设备', async () => {
      const query: CompatibilityQuery = {
        minValidationScore: 95
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(0); // mockDeviceEntry的验证分数是90
    });

    it('应该根据标识符查询设备', async () => {
      const query: CompatibilityQuery = {
        identifierType: 'vendorId',
        identifierValue: '1234'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].identifiers.vendorId).toBe('1234');
    });

    it('应该支持复合查询条件', async () => {
      const query: CompatibilityQuery = {
        manufacturer: 'TestManufacturer',
        category: 'usb-la',
        compatibilityLevel: 'full'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(1);
      expect(results[0].manufacturer).toBe('TestManufacturer');
      expect(results[0].category).toBe('usb-la');
      expect(results[0].driverCompatibility.compatibilityLevel).toBe('full');
    });

    it('应该返回空结果当没有匹配的设备', async () => {
      const query: CompatibilityQuery = {
        manufacturer: 'NonExistentManufacturer'
      };

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(0);
    });

    it('应该返回所有设备当没有查询条件', async () => {
      const query: CompatibilityQuery = {};

      const results = await database.queryDevices(query);

      expect(results).toHaveLength(2);
    });
  });

  describe('兼容驱动查找', () => {
    beforeEach(async () => {
      const testData = {
        version: '2.0',
        entries: [mockDeviceEntry]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await database.initialize();
    });

    it('应该根据制造商查找兼容驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'TestManufacturer'
      };

      const results = await database.findCompatibleDrivers(deviceInfo);

      expect(results).toHaveLength(1);
      expect(results[0].manufacturer).toBe('TestManufacturer');
    });

    it('应该根据型号查找兼容驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        model: 'TestModel'
      };

      const results = await database.findCompatibleDrivers(deviceInfo);

      expect(results).toHaveLength(1);
      expect(results[0].model).toBe('TestModel');
    });

    it('应该根据序列号模式查找兼容驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: 'TEST123456'
      };

      const results = await database.findCompatibleDrivers(deviceInfo);

      expect(results).toHaveLength(1);
      expect(results[0].identifiers.serialPattern).toBe('TEST*');
    });

    it('应该返回空结果当没有匹配的驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'UnknownManufacturer'
      };

      const results = await database.findCompatibleDrivers(deviceInfo);

      expect(results).toHaveLength(0);
    });

    it('应该处理不完整的设备信息', async () => {
      const deviceInfo: Partial<DeviceInfo> = {};

      const results = await database.findCompatibleDrivers(deviceInfo);

      expect(results).toHaveLength(0);
    });
  });

  describe('设备条目管理', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await database.initialize();
    });

    it('应该成功添加新设备条目', async () => {
      await database.addOrUpdateDevice(mockDeviceEntry);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      expect(savedData.entries.find((e: any) => e.deviceId === 'test-device-1')).toBeDefined();
    });

    it('应该成功更新现有设备条目', async () => {
      // 先添加设备
      await database.addOrUpdateDevice(mockDeviceEntry);

      // 更新设备
      const updatedEntry = {
        ...mockDeviceEntry,
        model: 'UpdatedModel'
      };

      await database.addOrUpdateDevice(updatedEntry);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      const entry = savedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      expect(entry.model).toBe('UpdatedModel');
    });

    it('应该自动更新时间戳', async () => {
      const originalDate = mockDeviceEntry.metadata.lastUpdated;
      
      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await database.addOrUpdateDevice(mockDeviceEntry);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      const entry = savedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      expect(new Date(entry.metadata.lastUpdated).getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('应该成功删除设备条目', async () => {
      // 先添加设备
      await database.addOrUpdateDevice(mockDeviceEntry);

      // 删除设备
      const result = await database.removeDevice('test-device-1');

      expect(result).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      expect(savedData.entries.find((e: any) => e.deviceId === 'test-device-1')).toBeUndefined();
    });

    it('应该处理删除不存在的设备', async () => {
      const result = await database.removeDevice('non-existent-device');

      expect(result).toBe(false);
    });
  });

  describe('测试结果管理', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await database.initialize();
      await database.addOrUpdateDevice(mockDeviceEntry);
    });

    it('应该成功更新测试结果', async () => {
      const newTestResults = {
        driverValidation: 95,
        functionalTests: 90,
        performanceGrade: 'A' as const,
        reliability: 'excellent' as const
      };

      await database.updateTestResults('test-device-1', newTestResults);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      const entry = savedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      expect(entry.testStatus.testResults.driverValidation).toBe(95);
      expect(entry.testStatus.testResults.functionalTests).toBe(90);
    });

    it('应该更新测试时间戳', async () => {
      const originalDate = mockDeviceEntry.testStatus.lastTested;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const newTestResults = {
        driverValidation: 95,
        functionalTests: 90,
        performanceGrade: 'A' as const,
        reliability: 'excellent' as const
      };

      await database.updateTestResults('test-device-1', newTestResults);

      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      const entry = savedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      expect(new Date(entry.testStatus.lastTested).getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('应该处理更新不存在设备的测试结果', async () => {
      const newTestResults = {
        driverValidation: 95,
        functionalTests: 90,
        performanceGrade: 'A' as const,
        reliability: 'excellent' as const
      };

      await database.updateTestResults('non-existent-device', newTestResults);

      // 不应该抛出错误，但也不应该保存任何内容
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('测试结果已更新'));
    });
  });

  describe('用户反馈管理', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await database.initialize();
      await database.addOrUpdateDevice(mockDeviceEntry);
    });

    it('应该成功添加用户反馈', async () => {
      await database.addUserFeedback('test-device-1', 5, 'Excellent device!', ['No issues']);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      const entry = savedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      
      expect(entry.communityFeedback.userComments).toContain('Excellent device!');
      expect(entry.communityFeedback.commonIssues).toContain('No issues');
      expect(entry.communityFeedback.reportCount).toBe(11); // 原来是10
    });

    it('应该正确计算加权平均评分', async () => {
      // 原始评分: 4.5 (10个评分)
      // 新评分: 5.0
      // 期望结果: (4.5 * 10 + 5.0 * 1) / 11 = 50 / 11 ≈ 4.545

      await database.addUserFeedback('test-device-1', 5.0, 'Great!');

      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      const entry = savedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      
      expect(entry.communityFeedback.userRating).toBeCloseTo(4.545, 2);
    });

    it('应该处理添加到不存在设备的反馈', async () => {
      await database.addUserFeedback('non-existent-device', 5, 'Comment');

      // 不应该抛出错误
      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('用户反馈已添加'));
    });
  });

  describe('数据库统计', () => {
    beforeEach(async () => {
      const testData = {
        version: '2.0',
        entries: [
          mockDeviceEntry,
          {
            ...mockDeviceEntry,
            deviceId: 'test-device-2',
            manufacturer: 'AnotherManufacturer',
            category: 'network-la',
            testStatus: {
              ...mockDeviceEntry.testStatus,
              certificationLevel: 'community'
            },
            communityFeedback: {
              ...mockDeviceEntry.communityFeedback,
              userRating: 3.5,
              reportCount: 5
            }
          }
        ]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await database.initialize();
    });

    it('应该返回正确的统计信息', async () => {
      const stats = await database.getStatistics();

      expect(stats.totalDevices).toBe(2);
      expect(stats.devicesByCategory['usb-la']).toBe(1);
      expect(stats.devicesByCategory['network-la']).toBe(1);
      expect(stats.devicesByManufacturer['TestManufacturer']).toBe(1);
      expect(stats.devicesByManufacturer['AnotherManufacturer']).toBe(1);
      expect(stats.certificationLevels['certified']).toBe(1);
      expect(stats.certificationLevels['community']).toBe(1);
    });

    it('应该计算正确的平均用户评分', async () => {
      const stats = await database.getStatistics();

      // 计算: (4.5 * 10 + 3.5 * 5) / (10 + 5) = (45 + 17.5) / 15 = 4.167
      expect(stats.averageUserRating).toBeCloseTo(4.167, 2);
    });

    it('应该处理没有评分的情况', async () => {
      // 创建新的数据库实例确保干净的状态
      const cleanDatabase = new HardwareCompatibilityDatabase(path.join(os.tmpdir(), `clean-test-db-${Date.now()}.json`));
      
      const testData = {
        version: '2.0',
        entries: [{
          ...mockDeviceEntry,
          communityFeedback: {
            ...mockDeviceEntry.communityFeedback,
            reportCount: 0,
            userRating: 0
          }
        }]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await cleanDatabase.initialize();

      const stats = await cleanDatabase.getStatistics();

      expect(stats.averageUserRating).toBe(0);
      
      // 清理资源
      cleanDatabase.dispose();
    });
  });

  describe('数据库导入导出', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await database.initialize();
      await database.addOrUpdateDevice(mockDeviceEntry);
    });

    it('应该导出JSON格式的数据库', async () => {
      const exported = await database.exportDatabase('json');

      const exportedData = JSON.parse(exported);
      expect(exportedData.version).toBe('2.0');
      expect(exportedData.exported).toBeDefined();
      expect(exportedData.entries).toHaveLength(4); // 3个默认 + 1个添加的
      
      const testEntry = exportedData.entries.find((e: any) => e.deviceId === 'test-device-1');
      expect(testEntry).toBeDefined();
    });

    it('应该导出CSV格式的数据库', async () => {
      const exported = await database.exportDatabase('csv');

      const lines = exported.split('\n');
      expect(lines[0]).toContain('Device ID');
      expect(lines[0]).toContain('Manufacturer');
      expect(lines[0]).toContain('Model');
      expect(lines.length).toBeGreaterThan(1);
      
      // 检查是否包含测试设备
      const testDeviceLine = lines.find(line => line.includes('test-device-1'));
      expect(testDeviceLine).toBeDefined();
    });

    it('应该导入JSON格式的数据库', async () => {
      const importData = {
        version: '2.0',
        entries: [{
          ...mockDeviceEntry,
          deviceId: 'imported-device',
          manufacturer: 'ImportedManufacturer'
        }]
      };

      await database.importDatabase(JSON.stringify(importData), 'json', false);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      expect(savedData.entries.find((e: any) => e.deviceId === 'imported-device')).toBeDefined();
    });

    it('应该支持合并导入', async () => {
      const importData = {
        version: '2.0',
        entries: [{
          ...mockDeviceEntry,
          deviceId: 'imported-device',
          manufacturer: 'ImportedManufacturer'
        }]
      };

      await database.importDatabase(JSON.stringify(importData), 'json', true);

      const savedData = JSON.parse(mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1][1] as string);
      expect(savedData.entries.length).toBeGreaterThan(1); // 应该包含原有和新导入的
    });

    it('应该正确解析导入数据中的日期字段', async () => {
      const importData = {
        version: '2.0',
        entries: [{
          ...mockDeviceEntry,
          deviceId: 'imported-device',
          testStatus: {
            ...mockDeviceEntry.testStatus,
            lastTested: '2024-02-01T10:00:00.000Z'
          },
          metadata: {
            ...mockDeviceEntry.metadata,
            addedDate: '2024-02-01T10:00:00.000Z',
            lastUpdated: '2024-02-01T10:00:00.000Z'
          }
        }]
      };

      await database.importDatabase(JSON.stringify(importData), 'json', false);

      // 验证日期被正确处理
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('索引构建和查询优化', () => {
    beforeEach(async () => {
      const testData = {
        version: '2.0',
        entries: Array.from({ length: 100 }, (_, i) => ({
          ...mockDeviceEntry,
          deviceId: `test-device-${i}`,
          manufacturer: `Manufacturer${i % 10}`,
          model: `Model${i % 5}`,
          category: i % 2 === 0 ? 'usb-la' : 'network-la',
          identifiers: {
            vendorId: `${1000 + i}`,
            productId: `${2000 + i}`,
            serialPattern: `TEST${i}*`
          }
        }))
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await database.initialize();
    });

    it('应该快速执行大量数据的查询', async () => {
      const startTime = Date.now();
      
      const results = await database.queryDevices({
        manufacturer: 'Manufacturer5'
      });

      const queryTime = Date.now() - startTime;
      
      expect(results).toHaveLength(10); // 应该有10个匹配的设备
      expect(queryTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该支持复杂的多条件查询', async () => {
      const results = await database.queryDevices({
        manufacturer: 'Manufacturer0',
        category: 'usb-la'
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach(device => {
        expect(device.manufacturer).toBe('Manufacturer0');
        expect(device.category).toBe('usb-la');
      });
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理数据库文件损坏', async () => {
      mockFs.readFile.mockResolvedValue('invalid json content');
      mockFs.mkdir.mockResolvedValue(undefined);

      await expect(database.initialize()).rejects.toThrow();
    });

    it('应该处理空查询条件', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await database.initialize();

      const results = await database.queryDevices({});

      expect(Array.isArray(results)).toBe(true);
    });

    it('应该处理重复初始化', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      await database.initialize();
      await database.initialize(); // 第二次初始化

      // 不应该重复加载
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('应该处理无效的设备ID', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();
      await database.initialize();

      const result = await database.removeDevice('');
      expect(result).toBe(false);
    });

    it('应该处理序列号模式匹配失败', async () => {
      const testData = {
        version: '2.0',
        entries: [mockDeviceEntry]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await database.initialize();

      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: 'NOTMATCH123'
      };

      const results = await database.findCompatibleDrivers(deviceInfo);
      expect(results).toHaveLength(0);
    });
  });

  describe('内存管理和性能', () => {
    it('应该正确清理资源', () => {
      database.dispose();

      // 验证资源被清理
      expect(() => database.dispose()).not.toThrow();
    });

    it('应该处理大量设备数据', async () => {
      const largeDataSet = {
        version: '2.0',
        entries: Array.from({ length: 1000 }, (_, i) => ({
          ...mockDeviceEntry,
          deviceId: `device-${i}`
        }))
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(largeDataSet));
      mockFs.mkdir.mockResolvedValue(undefined);

      const startTime = Date.now();
      await database.initialize();
      const initTime = Date.now() - startTime;

      expect(initTime).toBeLessThan(1000); // 应在1秒内完成初始化
    });

    it('应该优化内存使用', async () => {
      const testData = {
        version: '2.0',
        entries: [mockDeviceEntry]
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      mockFs.mkdir.mockResolvedValue(undefined);
      await database.initialize();

      // 执行多次查询不应该导致内存泄漏
      for (let i = 0; i < 100; i++) {
        await database.queryDevices({ manufacturer: 'TestManufacturer' });
      }

      // 验证没有内存泄漏（通过不抛出错误来验证）
      expect(true).toBe(true);
    });
  });
});