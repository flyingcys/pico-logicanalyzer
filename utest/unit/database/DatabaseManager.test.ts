/**
 * DatabaseManager 单元测试
 * 测试数据库管理器的完整功能，包括智能匹配、设备发现、完整性验证等
 */

import { DatabaseManager } from '../../../src/database/DatabaseManager';
import { HardwareCompatibilityDatabase, DeviceCompatibilityEntry } from '../../../src/database/HardwareCompatibilityDatabase';
import { HardwareDriverManager } from '../../../src/drivers/HardwareDriverManager';
import { DeviceInfo } from '../../../src/models/AnalyzerTypes';
import { promises as fs } from 'fs';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

// 不要mock类，直接在测试中使用实际实例，但mock它们的依赖

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DatabaseManager', () => {
  let manager: DatabaseManager;
  let mockDatabase: jest.Mocked<HardwareCompatibilityDatabase>;
  let mockDriverManager: jest.Mocked<HardwareDriverManager>;

  const mockDeviceEntry: DeviceCompatibilityEntry = {
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

  beforeEach(() => {
    // 创建mock驱动管理器
    mockDriverManager = {
      getAvailableDrivers: jest.fn().mockReturnValue(['TestDriver', 'SaleaeLogicDriver', 'NetworkLogicAnalyzerDriver']),
      createDriver: jest.fn().mockReturnValue({
        discoverDevices: jest.fn().mockResolvedValue([
          {
            manufacturer: 'TestManufacturer',
            model: 'TestModel',
            serialNumber: 'TEST123',
            version: '1.0'
          }
        ]),
        dispose: jest.fn()
      })
    } as any;

    // 创建实际的数据库管理器实例，但传入mock的驱动管理器
    manager = new DatabaseManager('./test-db.json', mockDriverManager);
    
    // 获取内部数据库实例的引用来mock它
    mockDatabase = (manager as any).database;
    
    // Mock数据库方法
    jest.spyOn(mockDatabase, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(mockDatabase, 'queryDevices').mockResolvedValue([mockDeviceEntry]);
    jest.spyOn(mockDatabase, 'findCompatibleDrivers').mockResolvedValue([mockDeviceEntry]);
    jest.spyOn(mockDatabase, 'addOrUpdateDevice').mockResolvedValue(undefined);
    jest.spyOn(mockDatabase, 'updateTestResults').mockResolvedValue(undefined);
    jest.spyOn(mockDatabase, 'getStatistics').mockResolvedValue({
      totalDevices: 1,
      devicesByCategory: { 'usb-la': 1 },
      devicesByManufacturer: { 'TestManufacturer': 1 },
      certificationLevels: { 'certified': 1 },
      averageUserRating: 4.5
    });
    jest.spyOn(mockDatabase, 'exportDatabase').mockResolvedValue('{"version":"2.0","entries":[]}');
    jest.spyOn(mockDatabase, 'importDatabase').mockResolvedValue(undefined);
    jest.spyOn(mockDatabase, 'dispose').mockImplementation(() => {});

    // 清除console输出以避免测试污染
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // 重置所有mocks
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    manager.dispose();
    jest.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该成功初始化数据库管理器', async () => {
      await manager.initialize();

      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('数据库管理器已初始化');
    });

    it('应该启动周期性维护', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await manager.initialize();

      expect(setIntervalSpy).toHaveBeenCalled();
      
      setIntervalSpy.mockRestore();
    });

    it('应该处理初始化失败', async () => {
      const error = new Error('Database initialization failed');
      mockDatabase.initialize.mockRejectedValueOnce(error);

      await expect(manager.initialize()).rejects.toThrow('Database initialization failed');
    });
  });

  describe('智能设备匹配', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该执行基于制造商和型号的精确匹配', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'TestManufacturer',
        model: 'TestModel'
      };

      mockDatabase.queryDevices.mockResolvedValueOnce([mockDeviceEntry]);

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(mockDatabase.queryDevices).toHaveBeenCalledWith({
        manufacturer: 'TestManufacturer',
        model: 'TestModel'
      });
      expect(result.exactMatches).toHaveLength(1);
      expect(result.exactMatches[0]).toEqual(mockDeviceEntry);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('应该执行基于序列号模式的精确匹配', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: 'TESTDEVICE123'
      };

      // Mock database.queryDevices to return all devices for findBySerialPattern
      mockDatabase.queryDevices.mockResolvedValueOnce([mockDeviceEntry]);

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.exactMatches).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('应该执行基于制造商的部分匹配', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'TestManufacturer'
      };

      // 第一次调用返回空（精确匹配失败）
      mockDatabase.queryDevices
        .mockResolvedValueOnce([]) // 基于序列号的查询
        .mockResolvedValueOnce([]) // 基于制造商和型号的查询
        .mockResolvedValueOnce([mockDeviceEntry]); // 基于制造商的部分匹配

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.partialMatches).toHaveLength(1);
      expect(result.confidence).toBe(0.7);
    });

    it('应该为Saleae设备推荐正确的驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'Saleae'
      };

      mockDatabase.queryDevices.mockResolvedValue([]);

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('SaleaeLogicDriver');
    });

    it('应该为网络设备推荐网络驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: '192.168.1.100:8080'
      };

      mockDatabase.queryDevices.mockResolvedValue([]);

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('NetworkLogicAnalyzerDriver');
    });

    it('应该为串口设备推荐串口驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: 'COM3'
      };

      mockDatabase.queryDevices.mockResolvedValue([]);

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('SerialAnalyzerDriver');
    });

    it('应该为未知设备提供通用驱动', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'UnknownManufacturer'
      };

      mockDatabase.queryDevices.mockResolvedValue([]);

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('LogicAnalyzerDriver');
      expect(result.suggestedDrivers).toContain('SigrokAdapter');
    });

    it('应该处理复杂匹配场景', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'TestManufacturer',
        model: 'TestModel',
        serialNumber: 'TESTDEVICE123'
      };

      mockDatabase.queryDevices
        .mockResolvedValueOnce([mockDeviceEntry]) // findBySerialPattern
        .mockResolvedValueOnce([mockDeviceEntry]); // manufacturer + model query

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.exactMatches).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('自动设备发现', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该成功发现和更新设备', async () => {
      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([
          {
            manufacturer: 'TestManufacturer',
            model: 'TestModel',
            serialNumber: 'TEST123',
            version: '1.0'
          }
        ]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBe(1);
      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
    });

    it('应该更新现有设备', async () => {
      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([
          {
            manufacturer: 'TestManufacturer',
            model: 'TestModel',
            serialNumber: 'TEST123',
            version: '1.0'
          }
        ]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([mockDeviceEntry]);

      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.added).toBe(0);
    });

    it('应该处理设备发现失败', async () => {
      const mockDriver = {
        discoverDevices: jest.fn().mockRejectedValue(new Error('Discovery failed')),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);

      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.added).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('TestDriver'),
        expect.any(Error)
      );
    });

    it('应该处理没有discoverDevices方法的驱动', async () => {
      const mockDriver = {
        // 没有discoverDevices方法
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);

      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.added).toBe(0);
    });

    it('应该处理驱动创建失败', async () => {
      mockDriverManager.createDriver.mockReturnValue(null);

      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.added).toBe(0);
    });
  });

  describe('数据库完整性验证', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该验证数据库完整性', async () => {
      mockDatabase.queryDevices.mockResolvedValue([mockDeviceEntry]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.fixedIssues).toHaveLength(0);
    });

    it('应该检测缺少必填字段的设备', async () => {
      const invalidDevice = {
        ...mockDeviceEntry,
        deviceId: '', // 无效的设备ID
        manufacturer: '', // 无效的制造商
      };

      mockDatabase.queryDevices.mockResolvedValue([invalidDevice]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('缺少必填字段'));
    });

    it('应该检测不存在的驱动', async () => {
      const deviceWithInvalidDriver = {
        ...mockDeviceEntry,
        driverCompatibility: {
          ...mockDeviceEntry.driverCompatibility,
          primaryDriver: 'NonExistentDriver'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([deviceWithInvalidDriver]);
      mockDriverManager.getAvailableDrivers.mockReturnValue(['TestDriver']);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(expect.stringContaining('不存在'));
    });

    it('应该自动修复驱动问题', async () => {
      const deviceWithInvalidDriver = {
        ...mockDeviceEntry,
        driverCompatibility: {
          ...mockDeviceEntry.driverCompatibility,
          primaryDriver: 'NonExistentDriver',
          alternativeDrivers: ['TestDriver']
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([deviceWithInvalidDriver]);
      mockDriverManager.getAvailableDrivers.mockReturnValue(['TestDriver']);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.fixedIssues).toContain(expect.stringContaining('主驱动已修复'));
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
    });

    it('应该修复日期字段错误', async () => {
      const deviceWithDateIssue = {
        ...mockDeviceEntry,
        metadata: {
          ...mockDeviceEntry.metadata,
          addedDate: new Date('2024-02-01'),
          lastUpdated: new Date('2024-01-01') // lastUpdated早于addedDate
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([deviceWithDateIssue]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.fixedIssues).toContain(expect.stringContaining('日期字段已修复'));
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
    });
  });

  describe('数据库性能优化', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该清理过期的实验性测试数据', async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40天前
      const expiredDevice = {
        ...mockDeviceEntry,
        testStatus: {
          ...mockDeviceEntry.testStatus,
          lastTested: oldDate,
          certificationLevel: 'experimental' as const
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([expiredDevice]);

      await manager.optimizeDatabase();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('清理了 1 个过期测试条目'));
    });

    it('应该保留最近的测试数据', async () => {
      const recentDevice = {
        ...mockDeviceEntry,
        testStatus: {
          ...mockDeviceEntry.testStatus,
          lastTested: new Date(), // 今天
          certificationLevel: 'experimental' as const
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([recentDevice]);

      await manager.optimizeDatabase();

      expect(mockDatabase.addOrUpdateDevice).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('清理了 0 个过期测试条目'));
    });

    it('应该保留已认证的设备数据', async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const certifiedDevice = {
        ...mockDeviceEntry,
        testStatus: {
          ...mockDeviceEntry.testStatus,
          lastTested: oldDate,
          certificationLevel: 'certified' as const
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([certifiedDevice]);

      await manager.optimizeDatabase();

      expect(mockDatabase.addOrUpdateDevice).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('清理了 0 个过期测试条目'));
    });
  });

  describe('周期性维护', () => {
    it('应该启动周期性维护', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await manager.initialize();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        24 * 60 * 60 * 1000 // 24小时
      );
      
      setIntervalSpy.mockRestore();
    });

    it('应该在dispose时停止周期性维护', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await manager.initialize();
      manager.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('数据库操作代理', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该代理获取统计信息', async () => {
      const stats = await manager.getStatistics();

      expect(mockDatabase.getStatistics).toHaveBeenCalled();
      expect(stats.totalDevices).toBe(1);
    });

    it('应该代理数据库导出', async () => {
      const result = await manager.exportDatabase('json');

      expect(mockDatabase.exportDatabase).toHaveBeenCalledWith('json');
      expect(result).toBe('{"version":"2.0","entries":[]}');
    });

    it('应该代理数据库导入', async () => {
      const data = '{"version":"2.0","entries":[]}';
      await manager.importDatabase(data, 'json', true);

      expect(mockDatabase.importDatabase).toHaveBeenCalledWith(data, 'json', true);
    });
  });

  describe('设备ID生成和分类', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该生成有效的设备ID', async () => {
      const deviceInfo: DeviceInfo = {
        manufacturer: 'Test Manufacturer',
        model: 'Test Model v2.0',
        version: '2.0-beta',
        serialNumber: 'TEST123'
      };

      // 通过设备发现触发设备ID生成
      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([deviceInfo]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'test-manufacturer-test-model-v2-0-2-0-beta'
        })
      );
    });

    it('应该推断网络设备类别', async () => {
      const networkDevice: DeviceInfo = {
        manufacturer: 'Network Devices Inc',
        model: 'Ethernet Logic Analyzer',
        version: '1.0',
        serialNumber: '192.168.1.100'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([networkDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'network-la'
        })
      );
    });

    it('应该推断混合信号设备类别', async () => {
      const mixedSignalDevice: DeviceInfo = {
        manufacturer: 'Mixed Signal Corp',
        model: 'MSO5000 Mixed Signal Oscilloscope',
        version: '1.0',
        serialNumber: 'MSO123'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([mixedSignalDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'mixed-signal'
        })
      );
    });

    it('应该推断协议分析器类别', async () => {
      const protocolDevice: DeviceInfo = {
        manufacturer: 'Protocol Systems',
        model: 'Advanced Protocol Decoder',
        version: '1.0',
        serialNumber: 'PROTO123'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([protocolDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'protocol-analyzer'
        })
      );
    });

    it('应该为未知设备使用默认类别', async () => {
      const unknownDevice: DeviceInfo = {
        manufacturer: 'Unknown Corp',
        model: 'Unknown Device',
        version: '1.0',
        serialNumber: 'UNKNOWN123'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([unknownDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'usb-la'
        })
      );
    });
  });

  describe('连接字符串推断', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该识别COM端口连接字符串', async () => {
      const serialDevice: DeviceInfo = {
        manufacturer: 'Serial Corp',
        model: 'Serial Analyzer',
        version: '1.0',
        serialNumber: 'COM5'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([serialDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionOptions: expect.objectContaining({
            defaultConnectionString: 'COM5'
          })
        })
      );
    });

    it('应该识别网络地址连接字符串', async () => {
      const networkDevice: DeviceInfo = {
        manufacturer: 'Network Corp',
        model: 'Network Analyzer',
        version: '1.0',
        serialNumber: '192.168.1.100:8080'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([networkDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionOptions: expect.objectContaining({
            defaultConnectionString: '192.168.1.100:8080'
          })
        })
      );
    });

    it('应该为未知连接使用自动检测', async () => {
      const unknownDevice: DeviceInfo = {
        manufacturer: 'Unknown Corp',
        model: 'Unknown Device',
        version: '1.0',
        serialNumber: 'UNKNOWN123'
      };

      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([unknownDevice]),
        dispose: jest.fn()
      };

      mockDriverManager.createDriver.mockReturnValue(mockDriver);
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]);

      await manager.discoverAndUpdateDevices();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionOptions: expect.objectContaining({
            defaultConnectionString: 'auto-detect'
          })
        })
      );
    });
  });

  describe('错误处理', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('应该处理设备发现过程中的错误', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock全局设备发现失败
      mockDriverManager.getAvailableDrivers.mockImplementation(() => {
        throw new Error('Driver manager error');
      });

      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.added).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('自动设备发现失败:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('应该处理维护过程中的错误', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      await manager.initialize();

      // 获取维护函数并手动触发错误
      const maintenanceFunc = setIntervalSpy.mock.calls[0][0] as Function;
      
      // Mock验证失败
      mockDatabase.queryDevices.mockRejectedValueOnce(new Error('Database error'));

      await maintenanceFunc();

      expect(consoleErrorSpy).toHaveBeenCalledWith('定期维护失败:', expect.any(Error));

      consoleErrorSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });

  describe('资源管理', () => {
    it('应该正确清理所有资源', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await manager.initialize();
      manager.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(mockDatabase.dispose).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    it('应该处理重复dispose调用', () => {
      manager.dispose();
      manager.dispose(); // 第二次调用应该不报错

      expect(mockDatabase.dispose).toHaveBeenCalledTimes(2);
    });
  });
});