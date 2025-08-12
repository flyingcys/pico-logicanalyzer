import { promises as fs } from 'fs';
// import { join } from 'path'; // 暂时注释掉未使用的导入
import { HardwareCapabilities, DeviceInfo, TriggerType, _TriggerCondition } from '../models/AnalyzerTypes';

/**
 * 设备兼容性条目
 */
export interface DeviceCompatibilityEntry {
  // 基本信息
  deviceId: string;
  manufacturer: string;
  model: string;
  version: string;
  category: 'usb-la' | 'network-la' | 'benchtop' | 'mixed-signal' | 'protocol-analyzer';

  // 识别信息
  identifiers: {
    vendorId?: string;
    productId?: string;
    serialPattern?: string;
    networkSignature?: string;
    scpiIdnResponse?: string;
  };

  // 驱动兼容性
  driverCompatibility: {
    primaryDriver: string;
    alternativeDrivers: string[];
    driverVersion: string;
    compatibilityLevel: 'full' | 'partial' | 'experimental';
    knownIssues: string[];
    workarounds: string[];
  };

  // 硬件能力
  capabilities: HardwareCapabilities;

  // 连接配置
  connectionOptions: {
    defaultConnectionString: string;
    alternativeConnections: string[];
    connectionParameters: Record<string, any>;
  };

  // 测试状态
  testStatus: {
    lastTested: Date;
    testResults: {
      driverValidation: number; // 0-100
      functionalTests: number;  // 0-100
      performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      reliability: 'excellent' | 'good' | 'fair' | 'poor';
    };
    certificationLevel: 'certified' | 'verified' | 'community' | 'experimental';
  };

  // 用户反馈
  communityFeedback: {
    userRating: number; // 1-5
    reportCount: number;
    commonIssues: string[];
    userComments: string[];
  };

  // 元数据
  metadata: {
    addedDate: Date;
    lastUpdated: Date;
    maintainer: string;
    documentationUrl?: string;
    vendorUrl?: string;
    supportStatus: 'active' | 'legacy' | 'deprecated' | 'unsupported';
  };
}

/**
 * 查询条件
 */
export interface CompatibilityQuery {
  manufacturer?: string;
  model?: string;
  category?: string;
  driverName?: string;
  compatibilityLevel?: string;
  certificationLevel?: string;
  supportStatus?: string;
  minValidationScore?: number;
  identifierType?: 'vendorId' | 'productId' | 'serialPattern' | 'networkSignature' | 'scpiIdnResponse';
  identifierValue?: string;
}

/**
 * 硬件兼容性数据库
 * 提供设备兼容性信息的存储、查询和管理功能
 */
export class HardwareCompatibilityDatabase {
  private databasePath: string;
  private entries: Map<string, DeviceCompatibilityEntry> = new Map();
  private indexCache: Map<string, Set<string>> = new Map();
  private isLoaded: boolean = false;

  constructor(databasePath: string = './data/hardware-compatibility.json') {
    this.databasePath = databasePath;
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    try {
      // 确保数据目录存在
      const dataDir = this.databasePath.substring(0, this.databasePath.lastIndexOf('/'));
      await fs.mkdir(dataDir, { recursive: true });

      // 加载现有数据
      await this.loadDatabase();

      // 如果数据库为空，加载默认数据
      if (this.entries.size === 0) {
        await this.loadDefaultData();
      }

      // 构建索引
      this.buildIndexes();

      this.isLoaded = true;
      console.log(`硬件兼容性数据库已加载 (${this.entries.size} 个设备条目)`);
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载数据库文件
   */
  private async loadDatabase(): Promise<void> {
    try {
      const data = await fs.readFile(this.databasePath, 'utf-8');
      const jsonData = JSON.parse(data);

      if (jsonData.entries && Array.isArray(jsonData.entries)) {
        for (const entry of jsonData.entries) {
          // 转换日期字符串为Date对象
          entry.testStatus.lastTested = new Date(entry.testStatus.lastTested);
          entry.metadata.addedDate = new Date(entry.metadata.addedDate);
          entry.metadata.lastUpdated = new Date(entry.metadata.lastUpdated);

          this.entries.set(entry.deviceId, entry);
        }
      }
    } catch (error) {
      // 文件不存在时是正常的，创建空数据库
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 加载默认兼容性数据
   */
  private async loadDefaultData(): Promise<void> {
    const defaultEntries: DeviceCompatibilityEntry[] = [
      {
        deviceId: 'pico-la-v1',
        manufacturer: 'DebugVn',
        model: 'Pico Logic Analyzer',
        version: '1.0',
        category: 'usb-la',
        identifiers: {
          vendorId: '0483',
          productId: '5740',
          serialPattern: 'PLA*'
        },
        driverCompatibility: {
          primaryDriver: 'LogicAnalyzerDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'full',
          knownIssues: [],
          workarounds: []
        },
        capabilities: {
          channels: {
            digital: 24,
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
            types: [TriggerType.Edge, TriggerType.Complex, TriggerType.Fast, TriggerType.Blast],
            maxChannels: 24,
            patternWidth: 32,
            sequentialSupport: true,
            conditions: ['rising', 'falling', 'high', 'low']
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
          },
          connectivity: {
            interfaces: ['usb'],
            protocols: ['custom']
          },
          features: {
            signalGeneration: false,
            powerSupply: false,
            i2cSniffer: false,
            canSupport: false,
            customDecoders: true,
            voltageMonitoring: false
          }
        },
        connectionOptions: {
          defaultConnectionString: 'COM3',
          alternativeConnections: ['COM1', 'COM2', 'COM4', 'COM5'],
          connectionParameters: {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            timeout: 5000
          }
        },
        testStatus: {
          lastTested: new Date('2024-01-15'),
          testResults: {
            driverValidation: 95,
            functionalTests: 92,
            performanceGrade: 'A',
            reliability: 'excellent'
          },
          certificationLevel: 'certified'
        },
        communityFeedback: {
          userRating: 4.5,
          reportCount: 12,
          commonIssues: ['Windows驱动签名'],
          userComments: ['性能优秀', '易于使用', '文档完善']
        },
        metadata: {
          addedDate: new Date('2024-01-01'),
          lastUpdated: new Date('2024-01-15'),
          maintainer: 'DebugVn Team',
          documentationUrl: 'https://github.com/gusmanb/logicanalyzer',
          vendorUrl: 'https://debugvn.store',
          supportStatus: 'active'
        }
      },
      {
        deviceId: 'saleae-logic-8',
        manufacturer: 'Saleae',
        model: 'Logic 8',
        version: '1.0',
        category: 'usb-la',
        identifiers: {
          vendorId: '0925',
          productId: '3881',
          serialPattern: 'SL*'
        },
        driverCompatibility: {
          primaryDriver: 'SaleaeLogicDriver',
          alternativeDrivers: ['SigrokAdapter'],
          driverVersion: '2.0.0',
          compatibilityLevel: 'full',
          knownIssues: ['需要Saleae Logic软件API'],
          workarounds: ['确保Logic软件在后台运行']
        },
        capabilities: {
          channels: {
            digital: 8,
            analog: 0,
            maxVoltage: 5.0,
            inputImpedance: 1000000,
            thresholdVoltages: [0.6, 1.2, 1.8, 2.5, 3.3, 5.0]
          },
          sampling: {
            maxRate: 25000000,
            minRate: 1000,
            supportedRates: [1000, 10000, 100000, 1000000, 5000000, 25000000],
            bufferSize: 10000000,
            streamingSupport: true,
            compressionSupport: false
          },
          triggers: {
            types: [TriggerType.Edge, TriggerType.Complex, TriggerType.Fast],
            maxChannels: 8,
            patternWidth: 24,
            sequentialSupport: false,
            conditions: ['rising', 'falling', 'high']
          },
          protocol: {
            supportedProtocols: ['uart', 'spi', 'i2c', 'can', 'lin'],
            hardwareDecoding: false,
            customProtocols: true
          },
          advanced: {
            memorySegmentation: false,
            externalClock: false,
            calibration: true,
            selfTest: false
          },
          connectivity: {
            interfaces: ['ethernet'],
            protocols: ['saleae']
          },
          features: {
            signalGeneration: false,
            powerSupply: false,
            i2cSniffer: true,
            canSupport: true,
            customDecoders: true,
            voltageMonitoring: false
          }
        },
        connectionOptions: {
          defaultConnectionString: 'localhost:10429',
          alternativeConnections: ['127.0.0.1:10429'],
          connectionParameters: {
            apiVersion: '1.2.18',
            timeout: 10000,
            deviceType: 'LOGIC_8_DEVICE'
          }
        },
        testStatus: {
          lastTested: new Date('2024-01-10'),
          testResults: {
            driverValidation: 88,
            functionalTests: 85,
            performanceGrade: 'B',
            reliability: 'good'
          },
          certificationLevel: 'verified'
        },
        communityFeedback: {
          userRating: 4.2,
          reportCount: 8,
          commonIssues: ['API依赖', '软件兼容性'],
          userComments: ['功能强大', '需要专用软件', '价格较高']
        },
        metadata: {
          addedDate: new Date('2024-01-01'),
          lastUpdated: new Date('2024-01-10'),
          maintainer: 'Community',
          documentationUrl: 'https://support.saleae.com/logic-software/sw-api',
          vendorUrl: 'https://www.saleae.com',
          supportStatus: 'active'
        }
      },
      {
        deviceId: 'rigol-mso5000',
        manufacturer: 'Rigol',
        model: 'MSO5000 Series',
        version: '2.0',
        category: 'mixed-signal',
        identifiers: {
          scpiIdnResponse: 'RIGOL TECHNOLOGIES,MSO5*',
          networkSignature: 'rigol-mso5*'
        },
        driverCompatibility: {
          primaryDriver: 'RigolSiglentDriver',
          alternativeDrivers: [],
          driverVersion: '2.0.0',
          compatibilityLevel: 'partial',
          knownIssues: ['网络配置复杂'],
          workarounds: ['使用静态IP配置']
        },
        capabilities: {
          channels: {
            digital: 16,
            analog: 4,
            maxVoltage: 40.0,
            inputImpedance: 1000000,
            thresholdVoltages: [0.8, 1.5, 2.5, 3.3, 5.0]
          },
          sampling: {
            maxRate: 2000000000,
            minRate: 1000,
            supportedRates: [1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000, 2000000000],
            bufferSize: 100000000,
            streamingSupport: false,
            compressionSupport: true
          },
          triggers: {
            types: [TriggerType.Edge, TriggerType.Complex, TriggerType.Fast, TriggerType.Blast],
            maxChannels: 16,
            patternWidth: 64,
            sequentialSupport: true,
            conditions: ['rising', 'falling', 'high', 'low', 'any']
          },
          protocol: {
            supportedProtocols: ['uart', 'spi', 'i2c', 'can', 'lin', 'flexray'],
            hardwareDecoding: true,
            customProtocols: false
          },
          advanced: {
            memorySegmentation: true,
            externalClock: true,
            calibration: true,
            selfTest: true
          },
          connectivity: {
            interfaces: ['ethernet', 'usb'],
            protocols: ['scpi']
          },
          features: {
            signalGeneration: true,
            powerSupply: false,
            i2cSniffer: true,
            canSupport: true,
            customDecoders: false,
            voltageMonitoring: true
          }
        },
        connectionOptions: {
          defaultConnectionString: '192.168.1.100:5555',
          alternativeConnections: ['USB0::0x1AB1::0x0515::INSTR'],
          connectionParameters: {
            protocol: 'SCPI',
            timeout: 15000,
            commandDelay: 100
          }
        },
        testStatus: {
          lastTested: new Date('2024-01-05'),
          testResults: {
            driverValidation: 78,
            functionalTests: 80,
            performanceGrade: 'B',
            reliability: 'good'
          },
          certificationLevel: 'community'
        },
        communityFeedback: {
          userRating: 3.8,
          reportCount: 5,
          commonIssues: ['网络连接不稳定', 'SCPI命令兼容性'],
          userComments: ['功能丰富', '配置复杂', '专业设备']
        },
        metadata: {
          addedDate: new Date('2024-01-01'),
          lastUpdated: new Date('2024-01-05'),
          maintainer: 'Community',
          documentationUrl: 'https://www.rigol.com/en/products/digital-oscilloscopes/mso5000',
          vendorUrl: 'https://www.rigol.com',
          supportStatus: 'active'
        }
      }
    ];

    for (const entry of defaultEntries) {
      this.entries.set(entry.deviceId, entry);
    }

    // 保存默认数据
    await this.saveDatabase();
  }

  /**
   * 构建查询索引
   */
  private buildIndexes(): void {
    this.indexCache.clear();

    for (const [deviceId, entry] of this.entries) {
      // 制造商索引
      this.addToIndex('manufacturer', entry.manufacturer.toLowerCase(), deviceId);

      // 型号索引
      this.addToIndex('model', entry.model.toLowerCase(), deviceId);

      // 类别索引
      this.addToIndex('category', entry.category, deviceId);

      // 驱动索引
      this.addToIndex('driver', entry.driverCompatibility.primaryDriver, deviceId);

      // 兼容性级别索引
      this.addToIndex('compatibility', entry.driverCompatibility.compatibilityLevel, deviceId);

      // 认证级别索引
      this.addToIndex('certification', entry.testStatus.certificationLevel, deviceId);

      // 支持状态索引
      this.addToIndex('support', entry.metadata.supportStatus, deviceId);

      // 标识符索引
      const { identifiers } = entry;
      if (identifiers.vendorId) {
        this.addToIndex('vendorId', identifiers.vendorId, deviceId);
      }
      if (identifiers.productId) {
        this.addToIndex('productId', identifiers.productId, deviceId);
      }
      if (identifiers.scpiIdnResponse) {
        this.addToIndex('scpiIdn', identifiers.scpiIdnResponse.toLowerCase(), deviceId);
      }
    }
  }

  /**
   * 添加到索引
   */
  private addToIndex(indexName: string, key: string, deviceId: string): void {
    const indexKey = `${indexName}:${key}`;
    if (!this.indexCache.has(indexKey)) {
      this.indexCache.set(indexKey, new Set());
    }
    this.indexCache.get(indexKey)!.add(deviceId);
  }

  /**
   * 查询兼容设备
   */
  async queryDevices(query: CompatibilityQuery): Promise<DeviceCompatibilityEntry[]> {
    await this.initialize();

    let results = new Set<string>();
    let isFirstFilter = true;

    // 应用各种过滤条件
    if (query.manufacturer) {
      const ids = this.indexCache.get(`manufacturer:${query.manufacturer.toLowerCase()}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.model) {
      const ids = this.indexCache.get(`model:${query.model.toLowerCase()}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.category) {
      const ids = this.indexCache.get(`category:${query.category}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.driverName) {
      const ids = this.indexCache.get(`driver:${query.driverName}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.compatibilityLevel) {
      const ids = this.indexCache.get(`compatibility:${query.compatibilityLevel}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.certificationLevel) {
      const ids = this.indexCache.get(`certification:${query.certificationLevel}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.supportStatus) {
      const ids = this.indexCache.get(`support:${query.supportStatus}`) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    if (query.identifierType && query.identifierValue) {
      const indexKey = `${query.identifierType}:${query.identifierValue.toLowerCase()}`;
      const ids = this.indexCache.get(indexKey) || new Set();
      results = isFirstFilter ? new Set(ids) : this.intersectSets(results, ids);
      isFirstFilter = false;
    }

    // 如果没有任何过滤条件，返回所有设备
    if (isFirstFilter) {
      results = new Set(this.entries.keys());
    }

    // 获取完整的设备信息并应用额外过滤
    const devices = Array.from(results)
      .map(id => this.entries.get(id)!)
      .filter(device => {
        if (query.minValidationScore && device.testStatus.testResults.driverValidation < query.minValidationScore) {
          return false;
        }
        return true;
      });

    return devices;
  }

  /**
   * 根据设备信息查找兼容驱动
   */
  async findCompatibleDrivers(deviceInfo: Partial<DeviceInfo>): Promise<DeviceCompatibilityEntry[]> {
    const queries: CompatibilityQuery[] = [];

    // 基于设备信息构建查询
    if (deviceInfo.manufacturer) {
      queries.push({ manufacturer: deviceInfo.manufacturer });
    }

    if (deviceInfo.model) {
      queries.push({ model: deviceInfo.model });
    }

    if (deviceInfo.serialNumber) {
      // 尝试匹配序列号模式
      for (const [_, entry] of this.entries) {
        if (entry.identifiers.serialPattern) {
          const pattern = new RegExp(entry.identifiers.serialPattern.replace('*', '.*'));
          if (pattern.test(deviceInfo.serialNumber)) {
            return [entry];
          }
        }
      }
    }

    // 合并查询结果
    const results = new Set<DeviceCompatibilityEntry>();
    for (const query of queries) {
      const devices = await this.queryDevices(query);
      devices.forEach(device => results.add(device));
    }

    return Array.from(results);
  }

  /**
   * 添加或更新设备条目
   */
  async addOrUpdateDevice(entry: DeviceCompatibilityEntry): Promise<void> {
    await this.initialize();

    // 更新时间戳
    entry.metadata.lastUpdated = new Date();
    if (!this.entries.has(entry.deviceId)) {
      entry.metadata.addedDate = new Date();
    }

    this.entries.set(entry.deviceId, entry);
    this.buildIndexes();
    await this.saveDatabase();

    console.log(`设备条目已更新: ${entry.manufacturer} ${entry.model}`);
  }

  /**
   * 删除设备条目
   */
  async removeDevice(deviceId: string): Promise<boolean> {
    await this.initialize();

    if (this.entries.has(deviceId)) {
      this.entries.delete(deviceId);
      this.buildIndexes();
      await this.saveDatabase();
      console.log(`设备条目已删除: ${deviceId}`);
      return true;
    }

    return false;
  }

  /**
   * 更新设备测试结果
   */
  async updateTestResults(deviceId: string, testResults: DeviceCompatibilityEntry['testStatus']['testResults']): Promise<void> {
    await this.initialize();

    const entry = this.entries.get(deviceId);
    if (entry) {
      entry.testStatus.testResults = testResults;
      entry.testStatus.lastTested = new Date();
      entry.metadata.lastUpdated = new Date();

      await this.saveDatabase();
      console.log(`测试结果已更新: ${deviceId}`);
    }
  }

  /**
   * 添加用户反馈
   */
  async addUserFeedback(deviceId: string, rating: number, comment: string, issues: string[] = []): Promise<void> {
    await this.initialize();

    const entry = this.entries.get(deviceId);
    if (entry) {
      // 更新评分（加权平均）
      const totalRatings = entry.communityFeedback.reportCount + 1;
      entry.communityFeedback.userRating =
        (entry.communityFeedback.userRating * entry.communityFeedback.reportCount + rating) / totalRatings;

      // 添加评论和问题
      entry.communityFeedback.userComments.push(comment);
      entry.communityFeedback.commonIssues.push(...issues);
      entry.communityFeedback.reportCount = totalRatings;

      entry.metadata.lastUpdated = new Date();
      await this.saveDatabase();

      console.log(`用户反馈已添加: ${deviceId}`);
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStatistics(): Promise<{
    totalDevices: number;
    devicesByCategory: Record<string, number>;
    devicesByManufacturer: Record<string, number>;
    certificationLevels: Record<string, number>;
    averageUserRating: number;
  }> {
    await this.initialize();

    const stats = {
      totalDevices: this.entries.size,
      devicesByCategory: {} as Record<string, number>,
      devicesByManufacturer: {} as Record<string, number>,
      certificationLevels: {} as Record<string, number>,
      averageUserRating: 0
    };

    let totalRating = 0;
    let ratingCount = 0;

    for (const entry of this.entries.values()) {
      // 按类别统计
      stats.devicesByCategory[entry.category] = (stats.devicesByCategory[entry.category] || 0) + 1;

      // 按制造商统计
      stats.devicesByManufacturer[entry.manufacturer] = (stats.devicesByManufacturer[entry.manufacturer] || 0) + 1;

      // 按认证级别统计
      stats.certificationLevels[entry.testStatus.certificationLevel] =
        (stats.certificationLevels[entry.testStatus.certificationLevel] || 0) + 1;

      // 计算平均评分
      if (entry.communityFeedback.reportCount > 0) {
        totalRating += entry.communityFeedback.userRating * entry.communityFeedback.reportCount;
        ratingCount += entry.communityFeedback.reportCount;
      }
    }

    stats.averageUserRating = ratingCount > 0 ? totalRating / ratingCount : 0;

    return stats;
  }

  /**
   * 导出数据库
   */
  async exportDatabase(format: 'json' | 'csv' = 'json'): Promise<string> {
    await this.initialize();

    if (format === 'json') {
      return JSON.stringify({
        version: '2.0',
        exported: new Date().toISOString(),
        entries: Array.from(this.entries.values())
      }, null, 2);
    } else {
      // CSV导出
      const headers = [
        'Device ID', 'Manufacturer', 'Model', 'Category', 'Primary Driver',
        'Compatibility Level', 'Certification Level', 'Validation Score',
        'User Rating', 'Support Status', 'Last Updated'
      ];

      const rows = Array.from(this.entries.values()).map(entry => [
        entry.deviceId,
        entry.manufacturer,
        entry.model,
        entry.category,
        entry.driverCompatibility.primaryDriver,
        entry.driverCompatibility.compatibilityLevel,
        entry.testStatus.certificationLevel,
        entry.testStatus.testResults.driverValidation.toString(),
        entry.communityFeedback.userRating.toFixed(1),
        entry.metadata.supportStatus,
        entry.metadata.lastUpdated.toISOString()
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }

  /**
   * 导入数据库
   */
  async importDatabase(data: string, format: 'json' | 'csv' = 'json', merge: boolean = true): Promise<void> {
    if (format === 'json') {
      const importData = JSON.parse(data);
      if (importData.entries && Array.isArray(importData.entries)) {
        if (!merge) {
          this.entries.clear();
        }

        for (const entry of importData.entries) {
          // 转换日期字符串
          if (typeof entry.testStatus.lastTested === 'string') {
            entry.testStatus.lastTested = new Date(entry.testStatus.lastTested);
          }
          if (typeof entry.metadata.addedDate === 'string') {
            entry.metadata.addedDate = new Date(entry.metadata.addedDate);
          }
          if (typeof entry.metadata.lastUpdated === 'string') {
            entry.metadata.lastUpdated = new Date(entry.metadata.lastUpdated);
          }

          this.entries.set(entry.deviceId, entry);
        }

        this.buildIndexes();
        await this.saveDatabase();
        console.log(`已导入 ${importData.entries.length} 个设备条目`);
      }
    }
    // CSV导入实现可以根据需要添加
  }

  /**
   * 保存数据库
   */
  private async saveDatabase(): Promise<void> {
    const data = {
      version: '2.0',
      lastUpdated: new Date().toISOString(),
      entries: Array.from(this.entries.values())
    };

    await fs.writeFile(this.databasePath, JSON.stringify(data, null, 2));
  }

  /**
   * 集合交集操作
   */
  private intersectSets<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    const intersection = new Set<T>();
    for (const elem of setA) {
      if (setB.has(elem)) {
        intersection.add(elem);
      }
    }
    return intersection;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.entries.clear();
    this.indexCache.clear();
    this.isLoaded = false;
  }
}
