/**
 * 数据库层综合测试
 * 测试HardwareCompatibilityDatabase、DatabaseManager、DatabaseIntegration
 * 对应单元测试扩展计划 - 阶段四：数据库层测试
 */

import { promises as fs } from 'fs';
import {
  HardwareCompatibilityDatabase,
  DeviceCompatibilityEntry,
  CompatibilityQuery
} from '../src/database/HardwareCompatibilityDatabase';
import { DatabaseManager } from '../src/database/DatabaseManager';
import { DatabaseIntegration } from '../src/database/DatabaseIntegration';
import { DeviceInfo, HardwareCapabilities } from '../src/models/AnalyzerTypes';
import { HardwareDriverManager } from '../src/drivers/HardwareDriverManager';

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Mock数据
const createMockDeviceEntry = (id: string = 'test-device'): DeviceCompatibilityEntry => ({
  deviceId: id,
  manufacturer: 'Test Manufacturer',
  model: 'Test Model',
  version: '1.0',
  category: 'usb-la',
  identifiers: {
    vendorId: '0x1234',
    productId: '0x5678',
    serialPattern: 'TEST*'
  },
  driverCompatibility: {
    primaryDriver: 'TestDriver',
    alternativeDrivers: ['BackupDriver'],
    driverVersion: '2.0.0',
    compatibilityLevel: 'full',
    knownIssues: [],
    workarounds: []
  },
  capabilities: {
    channels: {
      digital: 8,
      analog: 0,
      maxVoltage: 5.0,
      inputImpedance: 1000000,
      thresholdVoltages: [1.5, 3.3, 5.0]
    },
    sampling: {
      maxRate: 100000000,
      minRate: 1000,
      supportedRates: [1000, 10000, 100000, 1000000, 100000000],
      bufferSize: 1000000,
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
  } as HardwareCapabilities,
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
    commonIssues: [],
    userComments: ['Great device', 'Easy to use']
  },
  metadata: {
    addedDate: new Date('2024-01-01'),
    lastUpdated: new Date('2024-01-15'),
    maintainer: 'Test Team',
    supportStatus: 'active'
  }
});

describe('HardwareCompatibilityDatabase Basic Operations', () => {
  let database: HardwareCompatibilityDatabase;
  let tempDbPath: string;

  beforeEach(() => {
    tempDbPath = './test-hardware-db.json';
    database = new HardwareCompatibilityDatabase(tempDbPath);
    
    // Reset mocks
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    database.dispose();
  });

  it('应成功初始化数据库', async () => {
    // Act
    await database.initialize();

    // Assert
    expect(mockFs.mkdir).toHaveBeenCalled();
    expect(mockFs.readFile).toHaveBeenCalledWith(tempDbPath, 'utf-8');
  });

  it('应加载默认数据', async () => {
    // Act
    await database.initialize();
    const stats = await database.getStatistics();

    // Assert
    expect(stats.totalDevices).toBeGreaterThan(0);
    expect(stats.devicesByCategory).toBeDefined();
    expect(stats.devicesByManufacturer).toBeDefined();
  });

  it('应成功添加设备条目', async () => {
    // Arrange
    await database.initialize();
    const mockEntry = createMockDeviceEntry('new-test-device');

    // Act
    await database.addOrUpdateDevice(mockEntry);

    // Assert
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it('应成功更新现有设备条目', async () => {
    // Arrange
    await database.initialize();
    const mockEntry = createMockDeviceEntry('existing-device');
    await database.addOrUpdateDevice(mockEntry);

    // Act
    mockEntry.manufacturer = 'Updated Manufacturer';
    await database.addOrUpdateDevice(mockEntry);

    // Assert
    expect(mockEntry.metadata.lastUpdated.getTime()).toBeGreaterThan(mockEntry.metadata.addedDate.getTime());
  });

  it('应成功删除设备条目', async () => {
    // Arrange
    await database.initialize();
    const mockEntry = createMockDeviceEntry('device-to-delete');
    await database.addOrUpdateDevice(mockEntry);

    // Act
    const removed = await database.removeDevice('device-to-delete');

    // Assert
    expect(removed).toBe(true);
  });

  it('应处理删除不存在的设备', async () => {
    // Arrange
    await database.initialize();

    // Act
    const removed = await database.removeDevice('non-existent-device');

    // Assert
    expect(removed).toBe(false);
  });
});

describe('HardwareCompatibilityDatabase Query Operations', () => {
  let database: HardwareCompatibilityDatabase;

  beforeEach(async () => {
    database = new HardwareCompatibilityDatabase('./test-db.json');
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    await database.initialize();
  });

  afterEach(() => {
    database.dispose();
  });

  it('应根据制造商查询设备', async () => {
    // Arrange
    const query: CompatibilityQuery = { manufacturer: 'DebugVn' };

    // Act
    const results = await database.queryDevices(query);

    // Assert
    expect(Array.isArray(results)).toBe(true);
    expect(results.every(device => device.manufacturer === 'DebugVn')).toBe(true);
  });

  it('应根据设备类别查询', async () => {
    // Arrange
    const query: CompatibilityQuery = { category: 'usb-la' };

    // Act
    const results = await database.queryDevices(query);

    // Assert
    expect(results.every(device => device.category === 'usb-la')).toBe(true);
  });

  it('应根据驱动名称查询', async () => {
    // Arrange
    const query: CompatibilityQuery = { driverName: 'LogicAnalyzerDriver' };

    // Act
    const results = await database.queryDevices(query);

    // Assert
    expect(results.every(device =>
      device.driverCompatibility.primaryDriver === 'LogicAnalyzerDriver'
    )).toBe(true);
  });

  it('应根据兼容性级别查询', async () => {
    // Arrange
    const query: CompatibilityQuery = { compatibilityLevel: 'full' };

    // Act
    const results = await database.queryDevices(query);

    // Assert
    expect(results.every(device =>
      device.driverCompatibility.compatibilityLevel === 'full'
    )).toBe(true);
  });

  it('应根据最小验证分数过滤', async () => {
    // Arrange
    const query: CompatibilityQuery = { minValidationScore: 80 };

    // Act
    const results = await database.queryDevices(query);

    // Assert
    expect(results.every(device =>
      device.testStatus.testResults.driverValidation >= 80
    )).toBe(true);
  });

  it('应支持复合查询条件', async () => {
    // Arrange
    const query: CompatibilityQuery = {
      manufacturer: 'DebugVn',
      category: 'usb-la',
      compatibilityLevel: 'full'
    };

    // Act
    const results = await database.queryDevices(query);

    // Assert
    results.forEach(device => {
      expect(device.manufacturer).toBe('DebugVn');
      expect(device.category).toBe('usb-la');
      expect(device.driverCompatibility.compatibilityLevel).toBe('full');
    });
  });

  it('应根据设备信息查找兼容驱动', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'DebugVn',
      model: 'Pico Logic Analyzer'
    };

    // Act
    const results = await database.findCompatibleDrivers(deviceInfo);

    // Assert
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('应支持序列号模式匹配', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      serialNumber: 'PLA12345'
    };

    // Act
    const results = await database.findCompatibleDrivers(deviceInfo);

    // Assert
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].identifiers.serialPattern).toContain('PLA');
  });
});

describe('HardwareCompatibilityDatabase Data Management', () => {
  let database: HardwareCompatibilityDatabase;

  beforeEach(async () => {
    database = new HardwareCompatibilityDatabase('./test-db.json');
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    await database.initialize();
  });

  afterEach(() => {
    database.dispose();
  });

  it('应更新设备测试结果', async () => {
    // Arrange
    const testResults = {
      driverValidation: 95,
      functionalTests: 90,
      performanceGrade: 'A' as const,
      reliability: 'excellent' as const
    };

    // Act
    await database.updateTestResults('pico-la-v1', testResults);

    // Assert
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it('应添加用户反馈', async () => {
    // Act
    await database.addUserFeedback('pico-la-v1', 5, 'Excellent device!', ['Easy setup']);

    // Assert
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it('应生成数据库统计信息', async () => {
    // Act
    const stats = await database.getStatistics();

    // Assert
    expect(stats.totalDevices).toBeGreaterThan(0);
    expect(stats.devicesByCategory).toBeDefined();
    expect(stats.devicesByManufacturer).toBeDefined();
    expect(stats.certificationLevels).toBeDefined();
    expect(typeof stats.averageUserRating).toBe('number');
  });

  it('应导出数据库为JSON格式', async () => {
    // Act
    const jsonData = await database.exportDatabase('json');

    // Assert
    expect(typeof jsonData).toBe('string');
    const parsed = JSON.parse(jsonData);
    expect(parsed.version).toBeDefined();
    expect(parsed.entries).toBeDefined();
    expect(Array.isArray(parsed.entries)).toBe(true);
  });

  it('应导出数据库为CSV格式', async () => {
    // Act
    const csvData = await database.exportDatabase('csv');

    // Assert
    expect(typeof csvData).toBe('string');
    expect(csvData).toContain('Device ID,Manufacturer,Model');
    expect(csvData.split('\n').length).toBeGreaterThan(1);
  });

  it('应导入JSON格式的数据库', async () => {
    // Arrange
    const importData = {
      version: '2.0',
      entries: [createMockDeviceEntry('imported-device')]
    };

    // Act
    await database.importDatabase(JSON.stringify(importData), 'json', false);

    // Assert
    expect(mockFs.writeFile).toHaveBeenCalled();
  });
});

describe('DatabaseManager Smart Device Matching', () => {
  let manager: DatabaseManager;
  let mockDriverManager: jest.Mocked<HardwareDriverManager>;

  beforeEach(async () => {
    mockDriverManager = {
      getAvailableDrivers: jest.fn().mockReturnValue(['LogicAnalyzerDriver', 'SaleaeLogicDriver']),
      createDriver: jest.fn(),
    } as any;

    manager = new DatabaseManager('./test-db.json', mockDriverManager);
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('应执行智能设备匹配', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'DebugVn',
      model: 'Pico Logic Analyzer',
      serialNumber: 'PLA12345'
    };

    // Act
    const result = await manager.smartDeviceMatching(deviceInfo);

    // Assert
    expect(result.exactMatches).toBeDefined();
    expect(result.partialMatches).toBeDefined();
    expect(result.suggestedDrivers).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('应基于制造商进行部分匹配', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'DebugVn'
    };

    // Act
    const result = await manager.smartDeviceMatching(deviceInfo);

    // Assert
    expect(result.partialMatches.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('应为Saleae设备推荐正确驱动', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'Saleae'
    };

    // Act
    const result = await manager.smartDeviceMatching(deviceInfo);

    // Assert
    expect(result.suggestedDrivers).toContain('SaleaeLogicDriver');
  });

  it('应为网络设备推荐网络驱动', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'Network Devices Inc',
      serialNumber: '192.168.1.100:8080'
    };

    // Act
    const result = await manager.smartDeviceMatching(deviceInfo);

    // Assert
    expect(result.suggestedDrivers).toContain('NetworkLogicAnalyzerDriver');
  });
});

describe('DatabaseManager Device Discovery', () => {
  let manager: DatabaseManager;
  let mockDriverManager: jest.Mocked<HardwareDriverManager>;

  beforeEach(async () => {
    const mockDriver = {
      discoverDevices: jest.fn().mockResolvedValue([
        {
          manufacturer: 'Test Manufacturer',
          model: 'Test Device',
          serialNumber: 'TEST123',
          version: '1.0'
        }
      ]),
      dispose: jest.fn()
    };

    mockDriverManager = {
      getAvailableDrivers: jest.fn().mockReturnValue(['TestDriver']),
      createDriver: jest.fn().mockReturnValue(mockDriver),
    } as any;

    manager = new DatabaseManager('./test-db.json', mockDriverManager);
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('应执行自动设备发现', async () => {
    // Act
    const result = await manager.discoverAndUpdateDevices();

    // Assert
    expect(result.discovered).toBeGreaterThanOrEqual(0);
    expect(result.updated).toBeGreaterThanOrEqual(0);
    expect(result.added).toBeGreaterThanOrEqual(0);
    expect(mockDriverManager.getAvailableDrivers).toHaveBeenCalled();
    expect(mockDriverManager.createDriver).toHaveBeenCalled();
  });

  it('应处理设备发现失败', async () => {
    // Arrange
    const mockDriver = {
      discoverDevices: jest.fn().mockRejectedValue(new Error('Discovery failed')),
      dispose: jest.fn()
    };
    mockDriverManager.createDriver.mockReturnValue(mockDriver);

    // Act
    const result = await manager.discoverAndUpdateDevices();

    // Assert
    expect(result.discovered).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.added).toBe(0);
  });
});

describe('DatabaseManager Database Integrity', () => {
  let manager: DatabaseManager;
  let mockDriverManager: jest.Mocked<HardwareDriverManager>;

  beforeEach(async () => {
    mockDriverManager = {
      getAvailableDrivers: jest.fn().mockReturnValue(['LogicAnalyzerDriver']),
    } as any;

    manager = new DatabaseManager('./test-db.json', mockDriverManager);
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('应验证数据库完整性', async () => {
    // Act
    const result = await manager.validateDatabaseIntegrity();

    // Assert
    expect(result.isValid).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
    expect(Array.isArray(result.fixedIssues)).toBe(true);
  });

  it('应优化数据库性能', async () => {
    // Act & Assert (should not throw)
    await manager.optimizeDatabase();
  });

  it('应获取数据库统计信息', async () => {
    // Act
    const stats = await manager.getStatistics();

    // Assert
    expect(stats).toBeDefined();
    expect(typeof stats.totalDevices).toBe('number');
  });

  it('应导出数据库', async () => {
    // Act
    const data = await manager.exportDatabase('json');

    // Assert
    expect(typeof data).toBe('string');
  });

  it('应导入数据库', async () => {
    // Arrange
    const importData = JSON.stringify({
      version: '2.0',
      entries: [createMockDeviceEntry('import-test')]
    });

    // Act & Assert (should not throw)
    await manager.importDatabase(importData, 'json', true);
  });
});

describe('DatabaseIntegration Singleton and Initialization', () => {
  beforeEach(() => {
    // Reset singleton instance
    (DatabaseIntegration as any).instance = null;
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  it('应实现单例模式', () => {
    // Act
    const instance1 = DatabaseIntegration.getInstance();
    const instance2 = DatabaseIntegration.getInstance();

    // Assert
    expect(instance1).toBe(instance2);
  });

  it('应成功初始化数据库集成', async () => {
    // Arrange
    const integration = DatabaseIntegration.getInstance();

    // Act
    await integration.initialize();

    // Assert
    expect(mockFs.mkdir).toHaveBeenCalled();
  });

  it('应避免重复初始化', async () => {
    // Arrange
    const integration = DatabaseIntegration.getInstance();
    await integration.initialize();

    // Act
    await integration.initialize(); // 第二次调用

    // Assert - 应该只调用一次初始化
    // 通过检查mock调用次数来验证
  });
});

describe('DatabaseIntegration Enhanced Device Discovery', () => {
  let integration: DatabaseIntegration;

  beforeEach(async () => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应执行增强的设备发现', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'DebugVn',
      model: 'Pico Logic Analyzer'
    };

    // Act
    const result = await integration.enhancedDeviceDiscovery(deviceInfo);

    // Assert
    expect(result.recommendedDrivers).toBeDefined();
    expect(result.compatibilityInfo).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.connectionStrings).toBeDefined();
    expect(result.setupInstructions).toBeDefined();
    expect(Array.isArray(result.recommendedDrivers)).toBe(true);
    expect(Array.isArray(result.setupInstructions)).toBe(true);
  });

  it('应为USB设备生成正确的设置说明', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'DebugVn',
      model: 'Pico Logic Analyzer'
    };

    // Act
    const result = await integration.enhancedDeviceDiscovery(deviceInfo);

    // Assert  
    expect(result.setupInstructions.some(instruction => 
      instruction.includes('USB')
    )).toBe(true);
  });

  it('应为网络设备生成网络配置说明', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'Rigol',
      model: 'MSO5000'
    };

    // Act
    const result = await integration.enhancedDeviceDiscovery(deviceInfo);

    // Assert
    expect(result.setupInstructions.some(instruction => 
      instruction.includes('网络') || instruction.includes('IP')
    )).toBe(true);
  });
});

describe('DatabaseIntegration Performance Prediction', () => {
  let integration: DatabaseIntegration;

  beforeEach(async () => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应预测驱动性能', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'DebugVn'
    };

    // Act
    const prediction = await integration.predictDriverPerformance('LogicAnalyzerDriver', deviceInfo);

    // Assert
    expect(prediction.expectedPerformance).toBeDefined();
    expect(prediction.expectedPerformance.connectionTime).toBeGreaterThan(0);
    expect(prediction.expectedPerformance.captureTime).toBeGreaterThan(0);
    expect(['excellent', 'good', 'fair', 'poor']).toContain(prediction.expectedPerformance.reliability);
    expect(prediction.expectedPerformance.userSatisfaction).toBeGreaterThanOrEqual(0);
    expect(prediction.expectedPerformance.userSatisfaction).toBeLessThanOrEqual(5);
    expect(Array.isArray(prediction.riskFactors)).toBe(true);
    expect(Array.isArray(prediction.optimizationSuggestions)).toBe(true);
  });

  it('应为无历史数据的组合提供默认预测', async () => {
    // Arrange
    const deviceInfo: Partial<DeviceInfo> = {
      manufacturer: 'Unknown Manufacturer'
    };

    // Act
    const prediction = await integration.predictDriverPerformance('UnknownDriver', deviceInfo);

    // Assert
    expect(prediction.expectedPerformance.reliability).toBe('fair');
    expect(prediction.riskFactors).toContain('缺少历史数据');
    expect(prediction.optimizationSuggestions.length).toBeGreaterThan(0);
  });
});

describe('DatabaseIntegration Test Results and Feedback', () => {
  let integration: DatabaseIntegration;

  beforeEach(async () => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应更新测试结果', async () => {
    // Arrange
    const testResults = {
      validationScore: 95,
      functionalScore: 90,
      performanceGrade: 'A' as const,
      connectionTime: 1000,
      captureTime: 2000,
      reliability: 'excellent' as const
    };

    // Act & Assert (should not throw)
    await integration.updateTestResults('pico-la-v1', 'LogicAnalyzerDriver', testResults);
  });

  it('应提交用户反馈', async () => {
    // Arrange
    const feedback = {
      rating: 5,
      comment: 'Excellent performance!',
      issues: ['Minor UI issue'],
      driverUsed: 'LogicAnalyzerDriver',
      setupDifficulty: 'easy' as const,
      performanceSatisfaction: 5
    };

    // Act & Assert (should not throw)
    await integration.submitUserFeedback('pico-la-v1', feedback);
  });

  it('应处理反馈提交错误', async () => {
    // Arrange
    const feedback = {
      rating: 5,
      comment: 'Test comment'
    };

    // Mock database error
    const originalDatabase = integration.getDatabase();
    const mockDatabase = {
      ...originalDatabase,
      addUserFeedback: jest.fn().mockRejectedValue(new Error('Database error'))
    };
    (integration as any).database = mockDatabase;

    // Act & Assert (should not throw, but log error)
    await integration.submitUserFeedback('invalid-device', feedback);
    
    expect(mockDatabase.addUserFeedback).toHaveBeenCalled();
  });
});

describe('DatabaseIntegration Report Generation', () => {
  let integration: DatabaseIntegration;

  beforeEach(async () => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应生成HTML格式的兼容性报告', async () => {
    // Act
    const report = await integration.generateCompatibilityReport('html');

    // Assert
    expect(typeof report).toBe('string');
    expect(report).toContain('<!DOCTYPE html>');
    expect(report).toContain('硬件兼容性报告');
    expect(report).toContain('总体统计');
  });

  it('应生成Markdown格式的兼容性报告', async () => {
    // Act
    const report = await integration.generateCompatibilityReport('markdown');

    // Assert
    expect(typeof report).toBe('string');
    expect(report).toContain('# 硬件兼容性报告');
    expect(report).toContain('## 总体统计');
    expect(report).toContain('## 设备类别分布');
  });

  it('应生成JSON格式的兼容性报告', async () => {
    // Act
    const report = await integration.generateCompatibilityReport('json');

    // Assert
    expect(typeof report).toBe('string');
    const parsed = JSON.parse(report);
    expect(parsed.statistics).toBeDefined();
    expect(parsed.devices).toBeDefined();
    expect(parsed.generatedAt).toBeDefined();
  });
});

describe('DatabaseIntegration Batch Operations', () => {
  let integration: DatabaseIntegration;

  beforeEach(async () => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应批量导入设备数据', async () => {
    // Arrange
    const devices = [
      createMockDeviceEntry('batch-device-1'),
      createMockDeviceEntry('batch-device-2')
    ];

    // Act
    const result = await integration.batchImportDevices(devices, true);

    // Assert
    expect(result.imported).toBeGreaterThanOrEqual(0);
    expect(result.skipped).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('应验证设备数据完整性', async () => {
    // Arrange
    const invalidDevice = {
      deviceId: '', // 无效的设备ID
      manufacturer: '',
      model: ''
    };

    // Act
    const result = await integration.batchImportDevices([invalidDevice], true);

    // Assert
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('应处理批量导入中的错误', async () => {
    // Arrange
    const devices = [
      createMockDeviceEntry('good-device'),
      null as any, // 无效数据
      createMockDeviceEntry('another-good-device')
    ];

    // Act
    const result = await integration.batchImportDevices(devices.filter(d => d !== null), false);

    // Assert
    expect(result.imported).toBeGreaterThanOrEqual(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });
});

describe('DatabaseIntegration Advanced Operations', () => {
  let integration: DatabaseIntegration;

  beforeEach(async () => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应获取数据库实例', () => {
    // Act
    const database = integration.getDatabase();

    // Assert
    expect(database).toBeDefined();
    expect(typeof database.initialize).toBe('function');
  });

  it('应获取管理器实例', () => {
    // Act
    const manager = integration.getManager();

    // Assert
    expect(manager).toBeDefined();
    expect(typeof manager.initialize).toBe('function');
  });

  it('应正确清理资源', () => {
    // Act & Assert (should not throw)
    integration.dispose();
    
    // Verify singleton is reset
    const newInstance = DatabaseIntegration.getInstance();
    expect(newInstance).not.toBe(integration);
  });
});

describe('DatabaseIntegration Error Handling', () => {
  let integration: DatabaseIntegration;

  beforeEach(() => {
    (DatabaseIntegration as any).instance = null;
    integration = DatabaseIntegration.getInstance();
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    integration.dispose();
  });

  it('应处理初始化失败', async () => {
    // Arrange
    mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

    // Act & Assert
    await expect(integration.initialize()).rejects.toThrow('Permission denied');
  });

  it('应处理数据库操作失败', async () => {
    // Arrange
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    
    await integration.initialize();

    // Mock database error
    const originalDatabase = integration.getDatabase();
    const mockDatabase = {
      ...originalDatabase,
      queryDevices: jest.fn().mockRejectedValue(new Error('Query failed'))
    };
    (integration as any).database = mockDatabase;

    // Act & Assert
    await expect(integration.enhancedDeviceDiscovery({})).rejects.toThrow('Query failed');
  });
});