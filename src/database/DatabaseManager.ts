import { HardwareCompatibilityDatabase, DeviceCompatibilityEntry } from './HardwareCompatibilityDatabase';
import { HardwareDriverManager, DetectedDevice } from '../drivers/HardwareDriverManager';
import { DeviceInfo } from '../models/AnalyzerTypes';
// import { AnalyzerDriverBase } from '../drivers/AnalyzerDriverBase'; // 暂时注释掉未使用的导入

/**
 * 数据库管理器
 * 提供高级的数据库操作和与驱动系统的集成
 */
export class DatabaseManager {
  private database: HardwareCompatibilityDatabase;
  private driverManager: HardwareDriverManager;
  private updateInterval: any | null = null; // 修复NodeJS类型问题

  constructor(
    databasePath?: string,
    driverManager?: HardwareDriverManager
  ) {
    this.database = new HardwareCompatibilityDatabase(databasePath);
    this.driverManager = driverManager || new HardwareDriverManager();
  }

  /**
   * 初始化数据库管理器
   */
  async initialize(): Promise<void> {
    await this.database.initialize();

    // 启动定期数据库维护
    this.startPeriodicMaintenance();

    console.log('数据库管理器已初始化');
  }

  /**
   * 智能设备匹配
   * 基于设备信息和当前可用驱动进行匹配
   */
  async smartDeviceMatching(deviceInfo: Partial<DeviceInfo>): Promise<{
    exactMatches: DeviceCompatibilityEntry[];
    partialMatches: DeviceCompatibilityEntry[];
    suggestedDrivers: string[];
    confidence: number;
  }> {
    const exactMatches: DeviceCompatibilityEntry[] = [];
    const partialMatches: DeviceCompatibilityEntry[] = [];
    const suggestedDrivers: string[] = [];

    // 1. 精确匹配（基于标识符）
    if (deviceInfo.serialNumber) {
      const serialMatches = await this.findBySerialPattern(deviceInfo.serialNumber);
      exactMatches.push(...serialMatches);
    }

    // 2. 基于制造商和型号的匹配
    if (deviceInfo.manufacturer && deviceInfo.model) {
      const modelMatches = await this.database.queryDevices({
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model
      });

      // 避免重复
      const newMatches = modelMatches.filter(match =>
        !exactMatches.some(exact => exact.deviceId === match.deviceId)
      );
      exactMatches.push(...newMatches);
    }

    // 3. 部分匹配（仅制造商）
    if (deviceInfo.manufacturer && exactMatches.length === 0) {
      const manufacturerMatches = await this.database.queryDevices({
        manufacturer: deviceInfo.manufacturer
      });
      partialMatches.push(...manufacturerMatches);
    }

    // 4. 基于连接类型的智能推荐
    const connectionBasedDrivers = await this.getDriversByConnectionType(deviceInfo);
    suggestedDrivers.push(...connectionBasedDrivers);

    // 5. 计算匹配置信度
    let confidence = 0;
    if (exactMatches.length > 0) {
      confidence = exactMatches.length > 1 ? 0.95 : 0.98; // 多个匹配时信心略低
    } else if (partialMatches.length > 0) {
      confidence = 0.7;
    } else if (suggestedDrivers.length > 0) {
      confidence = 0.4;
    }

    return {
      exactMatches,
      partialMatches,
      suggestedDrivers,
      confidence
    };
  }

  /**
   * 基于序列号模式查找设备
   */
  private async findBySerialPattern(serialNumber: string): Promise<DeviceCompatibilityEntry[]> {
    const allDevices = await this.database.queryDevices({});

    return allDevices.filter(device => {
      if (device.identifiers.serialPattern) {
        const pattern = new RegExp(
          device.identifiers.serialPattern.replace(/\*/g, '.*'),
          'i'
        );
        return pattern.test(serialNumber);
      }
      return false;
    });
  }

  /**
   * 基于连接类型获取推荐驱动
   */
  private async getDriversByConnectionType(deviceInfo: Partial<DeviceInfo>): Promise<string[]> {
    const drivers: string[] = [];

    // 基于设备信息推断连接类型
    if (deviceInfo.serialNumber?.startsWith('COM') ||
        deviceInfo.manufacturer?.toLowerCase().includes('serial')) {
      drivers.push('SerialAnalyzerDriver');
    }

    if (deviceInfo.serialNumber?.includes(':') ||
        deviceInfo.manufacturer?.toLowerCase().includes('network')) {
      drivers.push('NetworkLogicAnalyzerDriver');
    }

    if (deviceInfo.manufacturer?.toLowerCase().includes('saleae')) {
      drivers.push('SaleaeLogicDriver');
    }

    if (deviceInfo.manufacturer?.toLowerCase().includes('rigol') ||
        deviceInfo.manufacturer?.toLowerCase().includes('siglent')) {
      drivers.push('RigolSiglentDriver');
    }

    // 添加通用驱动作为后备
    if (drivers.length === 0) {
      drivers.push('LogicAnalyzerDriver', 'SigrokAdapter');
    }

    return drivers;
  }

  /**
   * 自动设备发现和数据库更新
   */
  async discoverAndUpdateDevices(): Promise<{
    discovered: number;
    updated: number;
    added: number;
  }> {
    console.log('开始自动设备发现...');

    let discovered = 0;
    let updated = 0;
    let added = 0;

    try {
      // 获取所有已注册的驱动
      const availableDrivers = this.driverManager.getAvailableDrivers();

      for (const driverType of availableDrivers) {
        try {
          // 创建临时设备信息用于驱动发现
          const tempDevice: DetectedDevice = {
            id: `temp-${driverType.id}`,
            name: driverType.name,
            type: 'usb',
            connectionString: 'auto-discovery',
            driverType: driverType.id as any,
            confidence: 50
          };

          // 创建驱动实例进行设备发现
          const driver = await this.driverManager.createDriver(tempDevice);

          if (driver && typeof (driver as any).discoverDevices === 'function') {
            const devices = await (driver as any).discoverDevices();
            discovered += devices.length;

            for (const deviceInfo of devices) {
              const existing = await this.findExistingEntry(deviceInfo);

              if (existing) {
                // 更新现有条目
                await this.updateDeviceEntry(existing, deviceInfo, driverType.id);
                updated++;
              } else {
                // 添加新条目
                await this.createNewDeviceEntry(deviceInfo, driverType.id);
                added++;
              }
            }
          }

          if (driver && typeof driver.dispose === 'function') {
            await driver.dispose();
          }
        } catch (error) {
          console.warn(`驱动 ${driverType} 设备发现失败:`, error);
        }
      }

      console.log(`设备发现完成: 发现 ${discovered}, 更新 ${updated}, 新增 ${added}`);
    } catch (error) {
      console.error('自动设备发现失败:', error);
    }

    return { discovered, updated, added };
  }

  /**
   * 查找现有设备条目
   */
  private async findExistingEntry(deviceInfo: DeviceInfo): Promise<DeviceCompatibilityEntry | null> {
    // 首先尝试精确匹配
    const matches = await this.database.findCompatibleDrivers(deviceInfo);

    if (matches.length > 0) {
      // 优先返回完全匹配的条目
      const exactMatch = matches.find(match =>
        deviceInfo.manufacturer && deviceInfo.model &&
        match.manufacturer.toLowerCase() === deviceInfo.manufacturer.toLowerCase() &&
        match.model.toLowerCase() === deviceInfo.model.toLowerCase()
      );

      return exactMatch || matches[0];
    }

    return null;
  }

  /**
   * 更新设备条目
   */
  private async updateDeviceEntry(
    existing: DeviceCompatibilityEntry,
    deviceInfo: DeviceInfo,
    driverType: string
  ): Promise<void> {
    // 更新最后发现时间
    existing.metadata.lastUpdated = new Date();

    // 如果驱动不在备选列表中，添加到备选驱动
    if (!existing.driverCompatibility.alternativeDrivers.includes(driverType) &&
        existing.driverCompatibility.primaryDriver !== driverType) {
      existing.driverCompatibility.alternativeDrivers.push(driverType);
    }

    await this.database.addOrUpdateDevice(existing);
  }

  /**
   * 创建新设备条目
   */
  private async createNewDeviceEntry(
    deviceInfo: DeviceInfo,
    driverType: string
  ): Promise<void> {
    const deviceId = this.generateDeviceId(deviceInfo);

    const newEntry: DeviceCompatibilityEntry = {
      deviceId,
      manufacturer: deviceInfo.manufacturer || 'Unknown',
      model: deviceInfo.model || 'Unknown',
      version: deviceInfo.version || '1.0',
      category: this.inferDeviceCategory(deviceInfo),
      identifiers: {
        ...(deviceInfo.serialNumber && { serialPattern: `${deviceInfo.serialNumber.substring(0, 3)}*` })
      },
      driverCompatibility: {
        primaryDriver: driverType,
        alternativeDrivers: [],
        driverVersion: '2.0.0',
        compatibilityLevel: 'experimental',
        knownIssues: [],
        workarounds: []
      },
      capabilities: this.inferCapabilities(deviceInfo),
      connectionOptions: {
        defaultConnectionString: this.inferConnectionString(deviceInfo),
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

    await this.database.addOrUpdateDevice(newEntry);
  }

  /**
   * 生成设备ID
   */
  private generateDeviceId(deviceInfo: DeviceInfo): string {
    const manufacturer = (deviceInfo.manufacturer || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const model = (deviceInfo.model || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const version = deviceInfo.version?.replace(/[^a-z0-9]/g, '-') || 'v1';

    return `${manufacturer}-${model}-${version}`;
  }

  /**
   * 推断设备类别
   */
  private inferDeviceCategory(deviceInfo: DeviceInfo): DeviceCompatibilityEntry['category'] {
    const name = `${deviceInfo.manufacturer} ${deviceInfo.model}`.toLowerCase();

    if (name.includes('network') || name.includes('ethernet')) {
      return 'network-la';
    }
    if (name.includes('mixed') || name.includes('mso') || name.includes('oscilloscope')) {
      return 'mixed-signal';
    }
    if (name.includes('protocol') || name.includes('decoder')) {
      return 'protocol-analyzer';
    }
    if (name.includes('benchtop') || name.includes('professional')) {
      return 'benchtop';
    }

    return 'usb-la'; // 默认类别
  }

  /**
   * 推断设备连接字符串
   */
  private inferConnectionString(deviceInfo: DeviceInfo): string {
    if (deviceInfo.serialNumber) {
      if (deviceInfo.serialNumber.startsWith('COM')) {
        return deviceInfo.serialNumber;
      }
      if (deviceInfo.serialNumber.includes(':')) {
        return deviceInfo.serialNumber;
      }
    }

    return 'auto-detect';
  }

  /**
   * 推断设备能力
   */
  private inferCapabilities(_deviceInfo: DeviceInfo): any {
    // 基于设备名称和信息推断基本能力
    // 这里返回默认值，实际使用时应该更智能
    return {
      channels: {
        digital: 8,
        analog: 0,
        maxVoltage: 5.0,
        inputImpedance: 1000000,
        thresholdVoltages: [1.5, 3.3, 5.0]
      },
      sampling: {
        maxRate: 25000000,
        minRate: 1000,
        supportedRates: [1000, 10000, 100000, 1000000, 25000000],
        bufferSize: 1000000,
        streamingSupport: false,
        compressionSupport: false
      },
      triggers: {
        types: ['edge', 'pattern'],
        maxChannels: 8,
        advancedTriggers: false,
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
        calibration: false,
        selfTest: false
      }
    };
  }

  /**
   * 验证数据库完整性
   */
  async validateDatabaseIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    fixedIssues: string[];
  }> {
    console.log('开始验证数据库完整性...');

    const issues: string[] = [];
    const fixedIssues: string[] = [];
    let isValid = true;

    const allDevices = await this.database.queryDevices({});

    for (const device of allDevices) {
      // 检查必填字段
      if (!device.deviceId || !device.manufacturer || !device.model) {
        issues.push(`设备 ${device.deviceId} 缺少必填字段`);
        isValid = false;
      }

      // 检查驱动是否存在
      const availableDrivers = this.driverManager.getAvailableDrivers();
      const availableDriverIds = availableDrivers.map(d => d.id);
      if (!availableDriverIds.includes(device.driverCompatibility.primaryDriver)) {
        issues.push(`设备 ${device.deviceId} 的主驱动 ${device.driverCompatibility.primaryDriver} 不存在`);

        // 尝试自动修复
        const alternativeDriver = device.driverCompatibility.alternativeDrivers
          .find(driver => availableDriverIds.includes(driver));

        if (alternativeDriver) {
          device.driverCompatibility.primaryDriver = alternativeDriver;
          device.driverCompatibility.alternativeDrivers =
            device.driverCompatibility.alternativeDrivers.filter(d => d !== alternativeDriver);

          await this.database.addOrUpdateDevice(device);
          fixedIssues.push(`设备 ${device.deviceId} 的主驱动已修复为 ${alternativeDriver}`);
        }
      }

      // 检查日期有效性
      if (device.metadata.addedDate > device.metadata.lastUpdated) {
        device.metadata.lastUpdated = device.metadata.addedDate;
        await this.database.addOrUpdateDevice(device);
        fixedIssues.push(`设备 ${device.deviceId} 的日期字段已修复`);
      }
    }

    console.log(`数据库完整性验证完成: ${issues.length} 个问题, ${fixedIssues.length} 个已修复`);

    return { isValid, issues, fixedIssues };
  }

  /**
   * 优化数据库性能
   */
  async optimizeDatabase(): Promise<void> {
    console.log('开始数据库性能优化...');

    // 清理过期测试数据
    const allDevices = await this.database.queryDevices({});
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let cleanedCount = 0;
    for (const device of allDevices) {
      if (device.testStatus.lastTested < thirtyDaysAgo &&
          device.testStatus.certificationLevel === 'experimental') {

        // 重置测试状态为待测试
        device.testStatus.testResults = {
          driverValidation: 0,
          functionalTests: 0,
          performanceGrade: 'F',
          reliability: 'poor'
        };

        await this.database.addOrUpdateDevice(device);
        cleanedCount++;
      }
    }

    console.log(`性能优化完成: 清理了 ${cleanedCount} 个过期测试条目`);
  }

  /**
   * 启动定期维护
   */
  private startPeriodicMaintenance(): void {
    // 每24小时执行一次维护
    this.updateInterval = setInterval(async () => {
      try {
        await this.validateDatabaseIntegrity();
        await this.optimizeDatabase();
      } catch (error) {
        console.error('定期维护失败:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 停止定期维护
   */
  private stopPeriodicMaintenance(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStatistics(): Promise<any> {
    return await this.database.getStatistics();
  }

  /**
   * 导出数据库
   */
  async exportDatabase(format: 'json' | 'csv' = 'json'): Promise<string> {
    return await this.database.exportDatabase(format);
  }

  /**
   * 导入数据库
   */
  async importDatabase(data: string, format: 'json' | 'csv' = 'json', merge: boolean = true): Promise<void> {
    return await this.database.importDatabase(data, format, merge);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopPeriodicMaintenance();
    this.database.dispose();
  }
}
