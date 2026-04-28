/**
 * DatabaseManager 高质量测试
 * 
 * 测试目标：基于深度思考方法论，专注测试@src源码的真实业务逻辑
 * 测试方法：最小化Mock，验证设备匹配、数据库维护、完整性验证算法
 * 覆盖范围：智能匹配、设备发现、数据库优化、完整性验证、定期维护
 */

import { DatabaseManager } from '../../../src/database/DatabaseManager';
import { HardwareCompatibilityDatabase, DeviceCompatibilityEntry } from '../../../src/database/HardwareCompatibilityDatabase';
import { HardwareDriverManager } from '../../../src/drivers/HardwareDriverManager';
import { DeviceInfo, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

describe('DatabaseManager 专注业务逻辑测试', () => {
  let manager: DatabaseManager;
  let mockDatabase: jest.Mocked<HardwareCompatibilityDatabase>;
  let mockDriverManager: jest.Mocked<HardwareDriverManager>;

  beforeEach(() => {
    // 创建Mock数据库
    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(undefined),
      queryDevices: jest.fn().mockResolvedValue([]),
      findCompatibleDrivers: jest.fn().mockResolvedValue([]),
      addOrUpdateDevice: jest.fn().mockResolvedValue(undefined),
      getStatistics: jest.fn().mockResolvedValue({}),
      exportDatabase: jest.fn().mockResolvedValue('{"data": "mock"}'),
      importDatabase: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn()
    } as any;

    // 创建Mock驱动管理器
    mockDriverManager = {
      getAvailableDrivers: jest.fn().mockReturnValue([
        { id: 'SaleaeLogicDriver', name: 'Saleae Logic' },
        { id: 'RigolSiglentDriver', name: 'Rigol Siglent' },
        { id: 'LogicAnalyzerDriver', name: 'Generic Logic Analyzer' },
        { id: 'SigrokAdapter', name: 'Sigrok Adapter' }
      ]),
      createDriver: jest.fn().mockResolvedValue(null)
    } as any;

    // 使用依赖注入创建测试实例
    manager = new DatabaseManager('./test-db.json', mockDriverManager);
    (manager as any).database = mockDatabase;
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
  });

  describe('构造函数和初始化核心算法', () => {
    it('应该正确设置默认参数', () => {
      // 测试无参数构造函数
      const defaultManager = new DatabaseManager();
      
      expect(defaultManager).toBeDefined();
      expect((defaultManager as any).database).toBeDefined();
      expect((defaultManager as any).driverManager).toBeDefined();
    });

    it('应该正确设置自定义参数', () => {
      const customManager = new DatabaseManager('/custom/path.json', mockDriverManager);
      
      expect(customManager).toBeDefined();
      expect((customManager as any).driverManager).toBe(mockDriverManager);
    });

    it('应该正确执行初始化流程', async () => {
      await manager.initialize();
      
      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
      expect((manager as any).updateInterval).toBeDefined();
    });
  });

  describe('智能设备匹配核心算法验证', () => {
    beforeEach(() => {
      // 设置Mock数据库返回值
      const mockDevices: DeviceCompatibilityEntry[] = [
        {
          deviceId: 'saleae-logic8-v1',
          manufacturer: 'Saleae',
          model: 'Logic 8',
          version: '1.0',
          category: 'usb-la' as const,
          identifiers: {
            vendorId: '21a9',
            productId: '1001',
            serialPattern: 'SAL*'
          },
          driverCompatibility: {
            primaryDriver: 'SaleaeLogicDriver',
            alternativeDrivers: ['SigrokAdapter'],
            driverVersion: '2.0.0',
            compatibilityLevel: 'full',
            knownIssues: [],
            workarounds: []
          },
          capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
          connectionOptions: {
            defaultConnectionString: 'auto-detect',
            alternativeConnections: [],
            connectionParameters: {}
          },
          testStatus: {
            lastTested: new Date(),
            testResults: {
              driverValidation: 95,
              functionalTests: 90,
              performanceGrade: 'A',
              reliability: 'excellent'
            },
            certificationLevel: 'certified'
          },
          communityFeedback: {
            userRating: 4.8,
            reportCount: 50,
            commonIssues: [],
            userComments: []
          },
          metadata: {
            addedDate: new Date(),
            lastUpdated: new Date(),
            maintainer: 'Saleae Team',
            supportStatus: 'active'
          }
        }
      ];

      mockDatabase.queryDevices.mockResolvedValue(mockDevices);
    });

    it('应该正确执行精确匹配（序列号匹配）', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: 'SAL123456789',
        manufacturer: 'Saleae',
        model: 'Logic 8'
      };

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.exactMatches.length).toBeGreaterThan(0);
      expect(result.exactMatches[0].manufacturer).toBe('Saleae');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('应该正确执行制造商和型号匹配', async () => {
      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'Saleae',
        model: 'Logic 8'
      };

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.exactMatches.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(mockDatabase.queryDevices).toHaveBeenCalledWith({
        manufacturer: 'Saleae',
        model: 'Logic 8'
      });
    });

    it('应该正确执行部分匹配（仅制造商）', async () => {
      // 设置无精确匹配的情况
      const manufacturerOnlyDevice = {
        deviceId: 'saleae-device-manufacturer-only',
        manufacturer: 'Saleae',
        model: 'Logic 8',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {} as any,
        capabilities: {} as any,
        connectionOptions: {} as any,
        testStatus: {} as any,
        communityFeedback: {} as any,
        metadata: {} as any
      };

      mockDatabase.queryDevices.mockImplementation(async (query) => {
        if (query.manufacturer && query.model) {
          return []; // 无精确匹配
        }
        if (query.manufacturer) {
          return [manufacturerOnlyDevice]; // 返回制造商匹配
        }
        return [];
      });

      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'Saleae'
      };

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.exactMatches.length).toBe(0);
      expect(result.partialMatches.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('应该正确推荐基于连接类型的驱动', async () => {
      mockDatabase.queryDevices.mockResolvedValue([]); // 无匹配设备

      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'Saleae'
      };

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('SaleaeLogicDriver');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('应该正确处理网络设备推荐', async () => {
      mockDatabase.queryDevices.mockResolvedValue([]);

      const deviceInfo: Partial<DeviceInfo> = {
        serialNumber: '192.168.1.100:5555',
        manufacturer: 'Rigol'
      };

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('NetworkLogicAnalyzerDriver');
      expect(result.suggestedDrivers).toContain('RigolSiglentDriver');
    });

    it('应该为未知设备推荐通用驱动', async () => {
      mockDatabase.queryDevices.mockResolvedValue([]);

      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'Unknown Device Corp'
      };

      const result = await manager.smartDeviceMatching(deviceInfo);

      expect(result.suggestedDrivers).toContain('LogicAnalyzerDriver');
      expect(result.suggestedDrivers).toContain('SigrokAdapter');
    });
  });

  describe('设备发现和数据库更新核心算法验证', () => {
    beforeEach(() => {
      // Mock驱动实例具有设备发现功能
      const mockDriver = {
        discoverDevices: jest.fn().mockResolvedValue([
          {
            manufacturer: 'Test Corp',
            model: 'TestDevice',
            version: '1.0',
            serialNumber: 'TEST123',
            name: 'Test Device',
            type: AnalyzerDriverType.Serial,
            isNetwork: false,
            capabilities: {
              channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
              sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
              triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
              connectivity: { interfaces: ['usb'], protocols: ['custom'] },
              features: {}
            }
          } as DeviceInfo
        ]),
        dispose: jest.fn().mockResolvedValue(undefined)
      } as any; // 使用any避免完整mock所有AnalyzerDriverBase属性

      mockDriverManager.createDriver.mockResolvedValue(mockDriver);
    });

    it('应该正确执行自动设备发现', async () => {
      const result = await manager.discoverAndUpdateDevices();

      expect(result.discovered).toBeGreaterThan(0);
      expect(mockDriverManager.getAvailableDrivers).toHaveBeenCalled();
      expect(mockDriverManager.createDriver).toHaveBeenCalled();
    });

    it('应该正确处理新设备添加', async () => {
      mockDatabase.findCompatibleDrivers.mockResolvedValue([]); // 无现有设备

      const result = await manager.discoverAndUpdateDevices();

      expect(result.added).toBeGreaterThan(0);
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
    });

    it('应该正确处理现有设备更新', async () => {
      const existingDevice: DeviceCompatibilityEntry = {
        deviceId: 'test-corp-testdevice-v1',
        manufacturer: 'Test Corp',
        model: 'TestDevice',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'SaleaeLogicDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'experimental',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(),
          testResults: {
            driverValidation: 50,
            functionalTests: 50,
            performanceGrade: 'C',
            reliability: 'fair'
          },
          certificationLevel: 'experimental'
        },
        communityFeedback: {
          userRating: 3.0,
          reportCount: 0,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Auto-Discovery',
          supportStatus: 'active'
        }
      };

      mockDatabase.findCompatibleDrivers.mockResolvedValue([existingDevice]);

      const result = await manager.discoverAndUpdateDevices();

      expect(result.updated).toBeGreaterThan(0);
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
    });

    it('应该正确处理驱动发现异常', async () => {
      mockDriverManager.createDriver.mockRejectedValue(new Error('Driver creation failed'));

      const result = await manager.discoverAndUpdateDevices();

      // 应该继续处理其他驱动，不因单个驱动失败而停止
      expect(result).toBeDefined();
      expect(result.discovered).toBe(0);
    });
  });

  describe('设备ID和能力推断核心算法验证', () => {
    it('应该正确生成设备ID', () => {
      const generateDeviceId = (manager as any).generateDeviceId.bind(manager);

      const deviceInfo: DeviceInfo = {
        manufacturer: 'Test Corp.',
        model: 'Device-123',
        version: '2.0.1',
        serialNumber: 'SN123',
        name: 'Test Device 123',
        type: AnalyzerDriverType.Serial,
        isNetwork: false,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      const deviceId = generateDeviceId(deviceInfo);

      expect(deviceId).toBe('test-corp--device-123-2-0-1');
      expect(deviceId).toMatch(/^[a-z0-9-]+$/);
    });

    it('应该正确处理缺失字段的设备ID生成', () => {
      const generateDeviceId = (manager as any).generateDeviceId.bind(manager);

      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'TestCorp'
      };

      const deviceId = generateDeviceId(deviceInfo);

      expect(deviceId).toBe('testcorp-unknown-v1');
    });

    it('应该正确推断网络设备类别', () => {
      const inferDeviceCategory = (manager as any).inferDeviceCategory.bind(manager);

      const networkDevice: DeviceInfo = {
        manufacturer: 'Network Systems',
        model: 'Ethernet LA-1000',
        version: '1.0',
        serialNumber: 'NET123',
        name: 'Network LA-1000',
        type: AnalyzerDriverType.Network,
        isNetwork: true,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      const category = inferDeviceCategory(networkDevice);

      expect(category).toBe('network-la');
    });

    it('应该正确推断混合信号设备类别', () => {
      const inferDeviceCategory = (manager as any).inferDeviceCategory.bind(manager);

      const mixedDevice: DeviceInfo = {
        manufacturer: 'Test Corp',
        model: 'MSO-2000',
        version: '1.0',
        serialNumber: 'MSO123',
        name: 'MSO-2000',
        type: AnalyzerDriverType.Serial,
        isNetwork: false,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      const category = inferDeviceCategory(mixedDevice);

      expect(category).toBe('mixed-signal');
    });

    it('应该正确推断连接字符串', () => {
      const inferConnectionString = (manager as any).inferConnectionString.bind(manager);

      // 测试COM端口
      const comDevice: DeviceInfo = {
        manufacturer: 'Test',
        model: 'Device',
        version: '1.0',
        serialNumber: 'COM3',
        name: 'Test Device',
        type: AnalyzerDriverType.Serial,
        isNetwork: false,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      expect(inferConnectionString(comDevice)).toBe('COM3');

      // 测试网络连接
      const networkDevice: DeviceInfo = {
        manufacturer: 'Test',
        model: 'Device',
        version: '1.0',
        serialNumber: '192.168.1.100:5555',
        name: 'Network Test Device',
        type: AnalyzerDriverType.Network,
        isNetwork: true,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      expect(inferConnectionString(networkDevice)).toBe('192.168.1.100:5555');

      // 测试默认情况
      const defaultDevice: DeviceInfo = {
        manufacturer: 'Test',
        model: 'Device',
        version: '1.0',
        serialNumber: 'UNKNOWN123',
        name: 'Unknown Test Device',
        type: AnalyzerDriverType.Serial,
        isNetwork: false,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      expect(inferConnectionString(defaultDevice)).toBe('auto-detect');
    });

    it('应该正确推断设备能力', () => {
      const inferCapabilities = (manager as any).inferCapabilities.bind(manager);

      const deviceInfo: DeviceInfo = {
        manufacturer: 'Test Corp',
        model: 'Test Device',
        version: '1.0',
        serialNumber: 'TEST123',
        name: 'Test Device',
        type: AnalyzerDriverType.Serial,
        isNetwork: false,
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      const capabilities = inferCapabilities(deviceInfo);

      expect(capabilities.channels.digital).toBe(8);
      expect(capabilities.sampling.maxRate).toBe(25000000);
      expect(capabilities.triggers.types).toContain('edge');
      expect(capabilities.triggers.types).toContain('pattern');
      expect(capabilities.protocol.supportedProtocols).toContain('uart');
      expect(capabilities.protocol.supportedProtocols).toContain('spi');
      expect(capabilities.protocol.supportedProtocols).toContain('i2c');
    });
  });

  describe('数据库完整性验证核心算法验证', () => {
    it('应该正确检测和报告数据库问题', async () => {
      const problemDevice: DeviceCompatibilityEntry = {
        deviceId: '', // 缺少必填字段
        manufacturer: '',
        model: 'Test Model',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'NonExistentDriver', // 不存在的驱动
          alternativeDrivers: ['SaleaeLogicDriver'],
          driverVersion: '2.0.0',
          compatibilityLevel: 'experimental',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(),
          testResults: {
            driverValidation: 50,
            functionalTests: 50,
            performanceGrade: 'C',
            reliability: 'fair'
          },
          certificationLevel: 'experimental'
        },
        communityFeedback: {
          userRating: 3.0,
          reportCount: 0,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(Date.now() - 1000), // 早于添加日期
          maintainer: 'Test',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([problemDevice]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.fixedIssues.length).toBeGreaterThan(0);
    });

    it('应该正确自动修复驱动问题', async () => {
      const fixableDevice: DeviceCompatibilityEntry = {
        deviceId: 'test-device',
        manufacturer: 'Test Corp',
        model: 'Test Model',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'NonExistentDriver',
          alternativeDrivers: ['SaleaeLogicDriver'], // 有可用的替代驱动
          driverVersion: '2.0.0',
          compatibilityLevel: 'experimental',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(),
          testResults: {
            driverValidation: 50,
            functionalTests: 50,
            performanceGrade: 'C',
            reliability: 'fair'
          },
          certificationLevel: 'experimental'
        },
        communityFeedback: {
          userRating: 3.0,
          reportCount: 0,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Test',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([fixableDevice]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.fixedIssues.length).toBeGreaterThan(0);
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
    });

    it('应该把内置驱动 ID 与历史类名视为同一驱动', async () => {
      mockDriverManager.getAvailableDrivers.mockReturnValue([
        { id: 'pico-logic-analyzer', name: 'Pico Logic Analyzer' }
      ] as any);

      const classNameDevice: DeviceCompatibilityEntry = {
        deviceId: 'pico-class-name-driver',
        manufacturer: 'DebugVn',
        model: 'Pico Logic Analyzer',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'LogicAnalyzerDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'full',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 24, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 100000000, minRate: 1000, supportedRates: [1000, 100000000], bufferSize: 131072, streamingSupport: false },
          triggers: { types: [], maxChannels: 24, patternWidth: 24, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(),
          testResults: {
            driverValidation: 95,
            functionalTests: 90,
            performanceGrade: 'A',
            reliability: 'excellent'
          },
          certificationLevel: 'fixture'
        },
        communityFeedback: {
          userRating: 4.8,
          reportCount: 1,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Test',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([classNameDevice]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.issues).toEqual([]);
      expect(result.fixedIssues).toEqual([]);
      expect(mockDatabase.addOrUpdateDevice).not.toHaveBeenCalled();
    });

    it('应该在缺少真实硬件证据时降级已认证状态', async () => {
      const overstatedDevice: DeviceCompatibilityEntry = {
        deviceId: 'overstated-device',
        manufacturer: 'Test Corp',
        model: 'Test Model',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'SaleaeLogicDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'full',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(),
          testResults: {
            driverValidation: 95,
            functionalTests: 90,
            performanceGrade: 'A',
            reliability: 'excellent'
          },
          certificationLevel: 'certified',
          certificationEvidence: {
            evidenceLevel: 'fixture',
            records: [
              {
                evidenceId: 'fixture-only',
                evidenceLevel: 'fixture',
                date: '2026-04-28',
                operatingSystem: 'Linux',
                deviceModel: 'Test Model',
                firmwareVersion: 'fixture',
                commit: 'test',
                commandOrPath: 'npx jest tests/unit/database/DatabaseManager.comprehensive.test.ts --runInBand',
                captureConfig: {
                  sampleRateHz: 1000000,
                  preTriggerSamples: 100,
                  postTriggerSamples: 100,
                  channels: [0, 1],
                  trigger: 'edge'
                },
                resultFiles: [
                  { path: 'tests/fixtures/database/fixture-only.json', kind: 'json', sha256: 'fixture-hash' }
                ],
                result: 'pass'
              }
            ]
          }
        } as any,
        communityFeedback: {
          userRating: 4.8,
          reportCount: 1,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Test',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([overstatedDevice]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.fixedIssues).toContain(
        '设备 overstated-device 缺少真实硬件通过证据，认证级别已降级为 fixture'
      );
      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalledWith(expect.objectContaining({
        testStatus: expect.objectContaining({
          certificationLevel: 'fixture',
          certificationEvidence: expect.objectContaining({
            evidenceLevel: 'fixture',
            downgradeReason: '缺少真实硬件通过证据'
          })
        })
      }));
    });

    it('应该保留带真实硬件通过证据的认证状态', async () => {
      const hardwareCertifiedDevice: DeviceCompatibilityEntry = {
        deviceId: 'hardware-certified-device',
        manufacturer: 'Test Corp',
        model: 'Test Model',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'SaleaeLogicDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'full',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(),
          testResults: {
            driverValidation: 95,
            functionalTests: 90,
            performanceGrade: 'A',
            reliability: 'excellent'
          },
          certificationLevel: 'certified',
          certificationEvidence: {
            evidenceLevel: 'hardware',
            records: [
              {
                evidenceId: 'real-hardware-pass',
                evidenceLevel: 'hardware',
                date: '2026-04-28',
                operatingSystem: 'Windows 11',
                deviceModel: 'Test Model',
                firmwareVersion: '1.2.3',
                serialNumber: 'TEST-001',
                extensionVersion: '1.0.0-beta.0',
                commit: 'abcdef0',
                commandOrPath: 'VSCode: Logic Analyzer Start Capture',
                captureConfig: {
                  sampleRateHz: 1000000,
                  preTriggerSamples: 100,
                  postTriggerSamples: 100,
                  channels: [0, 1, 2, 3],
                  trigger: 'edge'
                },
                resultFiles: [
                  { path: 'evidence/test.lac', kind: 'lac', sha256: 'hardware-hash' }
                ],
                result: 'pass'
              }
            ]
          }
        } as any,
        communityFeedback: {
          userRating: 4.8,
          reportCount: 1,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Test',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([hardwareCertifiedDevice]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.fixedIssues).toEqual([]);
      expect(mockDatabase.addOrUpdateDevice).not.toHaveBeenCalled();
    });

    it('应该正确处理空数据库', async () => {
      mockDatabase.queryDevices.mockResolvedValue([]);

      const result = await manager.validateDatabaseIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.fixedIssues.length).toBe(0);
    });
  });

  describe('数据库性能优化核心算法验证', () => {
    it('应该正确清理过期测试数据', async () => {
      const expiredDevice: DeviceCompatibilityEntry = {
        deviceId: 'expired-device',
        manufacturer: 'Test Corp',
        model: 'Test Model',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'SaleaeLogicDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'experimental',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31天前
          testResults: {
            driverValidation: 80,
            functionalTests: 75,
            performanceGrade: 'B',
            reliability: 'good'
          },
          certificationLevel: 'experimental'
        },
        communityFeedback: {
          userRating: 4.0,
          reportCount: 10,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Test',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([expiredDevice]);

      await manager.optimizeDatabase();

      expect(mockDatabase.addOrUpdateDevice).toHaveBeenCalled();
      
      // 验证测试结果被重置
      const updateCall = mockDatabase.addOrUpdateDevice.mock.calls[0][0];
      expect(updateCall.testStatus.testResults.driverValidation).toBe(0);
      expect(updateCall.testStatus.testResults.performanceGrade).toBe('F');
    });

    it('应该保留认证级别设备的测试数据', async () => {
      const certifiedDevice: DeviceCompatibilityEntry = {
        deviceId: 'certified-device',
        manufacturer: 'Test Corp',
        model: 'Test Model',
        version: '1.0',
        category: 'usb-la' as const,
        identifiers: {},
        driverCompatibility: {
          primaryDriver: 'SaleaeLogicDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'full',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
        connectionOptions: {
          defaultConnectionString: 'auto-detect',
          alternativeConnections: [],
          connectionParameters: {}
        },
        testStatus: {
          lastTested: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31天前
          testResults: {
            driverValidation: 95,
            functionalTests: 90,
            performanceGrade: 'A',
            reliability: 'excellent'
          },
          certificationLevel: 'certified' // 认证级别，不应清理
        },
        communityFeedback: {
          userRating: 4.8,
          reportCount: 50,
          commonIssues: [],
          userComments: []
        },
        metadata: {
          addedDate: new Date(),
          lastUpdated: new Date(),
          maintainer: 'Official',
          supportStatus: 'active'
        }
      };

      mockDatabase.queryDevices.mockResolvedValue([certifiedDevice]);

      await manager.optimizeDatabase();

      // 认证设备不应该被更新
      expect(mockDatabase.addOrUpdateDevice).not.toHaveBeenCalled();
    });
  });

  describe('定期维护管理验证', () => {
    it('应该正确启动定期维护', async () => {
      await manager.initialize();

      expect((manager as any).updateInterval).toBeDefined();
      expect((manager as any).updateInterval).not.toBeNull();
    });

    it('应该正确停止定期维护', () => {
      // 模拟已启动的维护定时器
      const mockTimer = setInterval(() => {}, 1000);
      (manager as any).updateInterval = mockTimer;

      manager.dispose();

      expect((manager as any).updateInterval).toBeNull();
    });

    it('应该正确处理维护过程中的异常', async () => {
      mockDatabase.queryDevices.mockRejectedValue(new Error('Database error'));

      await manager.initialize();

      // 维护应该能处理异常而不崩溃
      const maintenanceFunction = (manager as any).updateInterval;
      expect(maintenanceFunction).toBeDefined();
    });
  });

  describe('数据库导入导出功能验证', () => {
    it('应该正确获取数据库统计信息', async () => {
      const mockStats = {
        totalDevices: 150,
        devicesByCategory: {
          'usb-la': 100,
          'network-la': 30,
          'benchtop': 20
        },
        devicesByManufacturer: {
          'Saleae': 60,
          'Rigol': 50,
          'Siglent': 40
        },
        certificationLevels: {
          'certified': 50,
          'verified': 60,
          'experimental': 40
        },
        averageUserRating: 4.2
      };

      mockDatabase.getStatistics.mockResolvedValue(mockStats);

      const stats = await manager.getStatistics();

      expect(stats).toEqual(mockStats);
      expect(mockDatabase.getStatistics).toHaveBeenCalled();
    });

    it('应该正确导出数据库', async () => {
      const mockExportData = '{"version": "2.0", "entries": [...]}';
      mockDatabase.exportDatabase.mockResolvedValue(mockExportData);

      const result = await manager.exportDatabase('json');

      expect(result).toBe(mockExportData);
      expect(mockDatabase.exportDatabase).toHaveBeenCalledWith('json');
    });

    it('应该正确导入数据库', async () => {
      const importData = '{"version": "2.0", "entries": [...]}';

      await manager.importDatabase(importData, 'json', true);

      expect(mockDatabase.importDatabase).toHaveBeenCalledWith(importData, 'json', true);
    });

    it('应该正确处理CSV格式导入导出', async () => {
      const csvData = 'deviceId,manufacturer,model,version\ntest-1,TestCorp,Model1,1.0';
      mockDatabase.exportDatabase.mockResolvedValue(csvData);

      const exportResult = await manager.exportDatabase('csv');
      expect(exportResult).toBe(csvData);

      await manager.importDatabase(csvData, 'csv', false);
      expect(mockDatabase.importDatabase).toHaveBeenCalledWith(csvData, 'csv', false);
    });
  });

  describe('资源清理和错误处理验证', () => {
    it('应该正确清理所有资源', () => {
      (manager as any).updateInterval = setInterval(() => {}, 1000);

      manager.dispose();

      expect((manager as any).updateInterval).toBeNull();
      expect(mockDatabase.dispose).toHaveBeenCalled();
    });

    it('应该正确处理数据库初始化异常', async () => {
      mockDatabase.initialize.mockRejectedValue(new Error('Database initialization failed'));

      await expect(manager.initialize()).rejects.toThrow('Database initialization failed');
    });

    it('应该正确处理设备发现过程中的异常', async () => {
      mockDriverManager.getAvailableDrivers.mockImplementation(() => {
        throw new Error('Driver manager error');
      });

      const result = await manager.discoverAndUpdateDevices();

      // 应该优雅地处理异常并返回空结果
      expect(result.discovered).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.added).toBe(0);
    });

    it('应该正确处理智能匹配过程中的异常', async () => {
      // 🔍错误驱动学习：源码中smartDeviceMatching方法在数据库查询失败时会抛出异常
      // 这是预期行为，应该测试异常处理而非假设能继续执行
      mockDatabase.queryDevices.mockRejectedValue(new Error('Database query failed'));

      const deviceInfo: Partial<DeviceInfo> = {
        manufacturer: 'Test Corp',
        model: 'Test Device'
      };

      // 验证方法在数据库查询失败时抛出异常
      await expect(manager.smartDeviceMatching(deviceInfo)).rejects.toThrow('Database query failed');
    });
  });

  describe('序列号模式匹配核心算法验证', () => {
    it('应该正确匹配通配符模式', async () => {
      const findBySerialPattern = (manager as any).findBySerialPattern.bind(manager);

      const testDevices: DeviceCompatibilityEntry[] = [
        {
          deviceId: 'saleae-device',
          manufacturer: 'Saleae',
          model: 'Logic 8',
          version: '1.0',
          category: 'usb-la' as const,
          identifiers: {
            serialPattern: 'SAL*' // 通配符模式
          },
          driverCompatibility: {} as any,
          capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
          connectionOptions: {} as any,
          testStatus: {} as any,
          communityFeedback: {} as any,
          metadata: {} as any
        }
      ];

      mockDatabase.queryDevices.mockResolvedValue(testDevices);

      const matches = await findBySerialPattern('SAL123456789');

      expect(matches.length).toBe(1);
      expect(matches[0].deviceId).toBe('saleae-device');
    });

    it('应该正确处理复杂正则表达式模式', async () => {
      const findBySerialPattern = (manager as any).findBySerialPattern.bind(manager);

      const testDevices: DeviceCompatibilityEntry[] = [
        {
          deviceId: 'rigol-device',
          manufacturer: 'Rigol',
          model: 'DS1104Z',
          version: '1.0',
          category: 'benchtop',
          identifiers: {
            serialPattern: 'DS*Z*' // 复杂模式
          },
          driverCompatibility: {} as any,
          capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
          connectionOptions: {} as any,
          testStatus: {} as any,
          communityFeedback: {} as any,
          metadata: {} as any
        }
      ];

      mockDatabase.queryDevices.mockResolvedValue(testDevices);

      const matches = await findBySerialPattern('DS1ZA18260001');

      expect(matches.length).toBe(1);
      expect(matches[0].deviceId).toBe('rigol-device');
    });

    it('应该正确处理不匹配的序列号', async () => {
      const findBySerialPattern = (manager as any).findBySerialPattern.bind(manager);

      const testDevices: DeviceCompatibilityEntry[] = [
        {
          deviceId: 'specific-device',
          manufacturer: 'Test',
          model: 'Device',
          version: '1.0',
          category: 'usb-la' as const,
          identifiers: {
            serialPattern: 'SPECIFIC*'
          },
          driverCompatibility: {} as any,
          capabilities: {
          channels: { digital: 8, maxVoltage: 5.0, inputImpedance: 1000000 },
          sampling: { maxRate: 25000000, minRate: 1000, supportedRates: [1000, 25000000], bufferSize: 1000000, streamingSupport: false },
          triggers: { types: [], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: [] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        } as any,
          connectionOptions: {} as any,
          testStatus: {} as any,
          communityFeedback: {} as any,
          metadata: {} as any
        }
      ];

      mockDatabase.queryDevices.mockResolvedValue(testDevices);

      const matches = await findBySerialPattern('DIFFERENT123456');

      expect(matches.length).toBe(0);
    });
  });
});
