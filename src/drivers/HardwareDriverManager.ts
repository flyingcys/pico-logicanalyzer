import { EventEmitter } from 'events';
import { AnalyzerDriverBase, OutputPacket } from './AnalyzerDriverBase';
import { LogicAnalyzerDriver } from './LogicAnalyzerDriver';
import { SaleaeLogicDriver } from './SaleaeLogicDriver';
import { RigolSiglentDriver } from './RigolSiglentDriver';
import { SigrokAdapter } from './SigrokAdapter';
import { NetworkLogicAnalyzerDriver } from './NetworkLogicAnalyzerDriver';
import { MultiAnalyzerDriver } from './MultiAnalyzerDriver';
import { VersionValidator } from './VersionValidator';
import {
  AnalyzerDriverType,
  AnalyzerDeviceInfo,
  DeviceInfo,
  ConnectionParams
} from '../models/AnalyzerTypes';

/**
 * 检测到的设备信息
 */
export interface DetectedDevice {
  id: string; // 设备唯一标识
  name: string; // 设备名称
  type: 'serial' | 'network' | 'usb'; // 连接类型
  connectionString: string; // 连接字符串
  connectionPath?: string; // 连接路径（兼容属性）
  driverType: AnalyzerDriverType; // 驱动类型
  capabilities?: AnalyzerDeviceInfo; // 设备能力描述
  confidence: number; // 检测置信度 (0-100)
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  parentId?: string;
  devicePath?: string;
  assignedIndex?: number;
  verificationRequired?: boolean;
  known?: boolean;
  discoveredBy?: string;
  discoveryProtocol?: string;
  profileId?: string;
  handshakeVerified?: boolean;
  discoveryState?: 'candidate' | 'confirmed';
  discoveryEvidence?: string;
  adapterStatus?: 'hardware-pending' | 'framework' | 'hardware-certified';
  certificationLevel?: 'fixture' | 'candidate' | 'experimental' | 'verified' | 'certified' | 'community';
  version?: string;
}

export interface DiscoveryProfile {
  id: string;
  driverId: string;
  displayName: string;
  connectionTypes: Array<'serial' | 'network' | 'usb' | 'cli'>;
  usbIds: Array<{ vendorId: string; productId: string }>;
  defaultPorts: number[];
  handshake?: 'pico-version' | 'saleae-api' | 'scpi-idn' | 'sigrok-cli';
  requiresHandshake: boolean;
  adapterStatus: 'hardware-pending' | 'framework' | 'hardware-certified';
  certificationLevel: 'fixture' | 'candidate' | 'experimental' | 'verified' | 'certified' | 'community';
  cliCommand?: string;
}

export interface NetworkProbeResult {
  host: string;
  port: number;
  protocol: 'pico-version' | 'saleae-api' | 'scpi-idn' | 'tcp-open';
  profileId?: string;
  handshakeVerified: boolean;
  deviceName?: string;
  version?: string;
  manufacturer?: string;
}

const DISCOVERY_PROFILES: DiscoveryProfile[] = [
  {
    id: 'pico-logic-analyzer',
    driverId: 'pico-logic-analyzer',
    displayName: 'Pico Logic Analyzer USB',
    connectionTypes: ['serial'],
    usbIds: [{ vendorId: '1209', productId: '3020' }],
    defaultPorts: [],
    requiresHandshake: false,
    adapterStatus: 'hardware-pending',
    certificationLevel: 'fixture'
  },
  {
    id: 'network-pico',
    driverId: 'network-analyzer',
    displayName: 'Pico Logic Analyzer TCP',
    connectionTypes: ['network'],
    usbIds: [],
    defaultPorts: [4045],
    handshake: 'pico-version',
    requiresHandshake: true,
    adapterStatus: 'hardware-pending',
    certificationLevel: 'experimental'
  },
  {
    id: 'saleae-logic',
    driverId: 'saleae-logic',
    displayName: 'Saleae Logic 2 API',
    connectionTypes: ['network', 'usb'],
    usbIds: [],
    defaultPorts: [10429],
    handshake: 'saleae-api',
    requiresHandshake: true,
    adapterStatus: 'framework',
    certificationLevel: 'experimental'
  },
  {
    id: 'rigol-siglent-scpi',
    driverId: 'rigol-siglent',
    displayName: 'Rigol/Siglent SCPI',
    connectionTypes: ['network'],
    usbIds: [],
    defaultPorts: [5555, 5025, 111],
    handshake: 'scpi-idn',
    requiresHandshake: true,
    adapterStatus: 'framework',
    certificationLevel: 'experimental'
  },
  {
    id: 'sigrok-cli',
    driverId: 'sigrok-adapter',
    displayName: 'sigrok-cli',
    connectionTypes: ['cli', 'usb'],
    usbIds: [],
    defaultPorts: [],
    handshake: 'sigrok-cli',
    requiresHandshake: true,
    adapterStatus: 'framework',
    certificationLevel: 'experimental',
    cliCommand: 'sigrok-cli --scan'
  }
];

/**
 * 驱动构造函数类型 — 收口各驱动不同构造签名
 */
type DriverConstructor = new (...args: any[]) => AnalyzerDriverBase;

/**
 * 驱动注册信息
 */
export interface DriverRegistration {
  id: string; // 驱动ID
  name: string; // 驱动名称
  description: string; // 驱动描述
  version: string; // 驱动版本
  driverClass: DriverConstructor; // 驱动类
  supportedDevices: string[]; // 支持的设备类型
  priority: number; // 优先级 (数值越大优先级越高)
}

/**
 * 设备检测器接口
 */
export interface IDeviceDetector {
  readonly name: string;
  detect(): Promise<DetectedDevice[]>;
}

/**
 * 硬件驱动管理器
 * 负责驱动注册、设备检测、驱动匹配和实例化
 */
export class HardwareDriverManager extends EventEmitter {
  private drivers = new Map<string, DriverRegistration>();
  private activeConnections = new Map<string, AnalyzerDriverBase>();
  private detectors: IDeviceDetector[] = [];
  private detectionCache = new Map<string, DetectedDevice[]>();
  private cacheTimeout = 30000; // 30秒缓存超时
  private detectorTimeout = 5000; // 单个检测器超时阈值
  private currentDevice: AnalyzerDriverBase | null = null;
  private connectedDeviceInfo: DetectedDevice | null = null;
  private knownDevices = new Map<string, DetectedDevice>();

  constructor() {
    super();
    this.initializeBuiltinDrivers();
    this.initializeDetectors();
  }

  /**
   * 初始化内置驱动
   */
  private initializeBuiltinDrivers(): void {
    console.log('初始化内置驱动...');

    // 注册 Pico 逻辑分析器驱动（最高优先级）
    this.registerDriver({
      id: 'pico-logic-analyzer',
      name: 'Pico Logic Analyzer',
      description: 'Raspberry Pi Pico based logic analyzer driver',
      version: '1.0.0',
      driverClass: LogicAnalyzerDriver,
      supportedDevices: ['pico', 'rp2040', 'logic-analyzer', 'analyzer'],
      priority: 100
    });

    // 注册Saleae Logic兼容驱动
    this.registerDriver({
      id: 'saleae-logic',
      name: 'Saleae Logic Analyzer',
      description: 'Saleae Logic series compatible driver',
      version: '1.0.0',
      driverClass: SaleaeLogicDriver,
      supportedDevices: ['saleae', 'logic16', 'logic8', 'logic-pro'],
      priority: 90
    });

    // 注册Rigol/Siglent驱动
    this.registerDriver({
      id: 'rigol-siglent',
      name: 'Rigol/Siglent Logic Analyzer',
      description: 'Rigol and Siglent instruments with logic analyzer capability',
      version: '1.0.0',
      driverClass: RigolSiglentDriver,
      supportedDevices: ['rigol', 'siglent', 'ds1000z', 'ds2000', 'sds'],
      priority: 80
    });

    // 注册sigrok通用适配器
    this.registerDriver({
      id: 'sigrok-adapter',
      name: 'Sigrok Universal Adapter',
      description: 'Universal adapter for 80+ sigrok-supported devices',
      version: '1.0.0',
      driverClass: SigrokAdapter,
      supportedDevices: ['fx2lafw', 'hantek', 'kingst', 'chronovu', 'openbench'],
      priority: 70
    });

    // 注册网络设备驱动
    this.registerDriver({
      id: 'network-analyzer',
      name: 'Network Logic Analyzer',
      description: 'Generic network-based logic analyzer driver',
      version: '1.0.0',
      driverClass: NetworkLogicAnalyzerDriver,
      supportedDevices: ['network', 'tcp', 'udp', 'wifi', 'ethernet'],
      priority: 60
    });

    console.log(`已注册 ${this.drivers.size} 个内置驱动`);
  }

  /**
   * 初始化设备检测器
   */
  private initializeDetectors(): void {
    this.detectors = [
      new SerialDetector(),
      new NetworkDetector(),
      new SaleaeDetector(),
      new SigrokDetector(),
      new RigolSiglentDetector()
    ];

    console.log(`初始化了 ${this.detectors.length} 个设备检测器`);
  }

  /**
   * 注册驱动
   */
  registerDriver(registration: DriverRegistration): void {
    this.drivers.set(registration.id, registration);
    this.emit('driverRegistered', registration);
  }

  /**
   * 注销驱动
   */
  unregisterDriver(driverId: string): boolean {
    const removed = this.drivers.delete(driverId);
    if (removed) {
      this.emit('driverUnregistered', driverId);
    }
    return removed;
  }

  /**
   * 获取已注册的驱动列表
   */
  getRegisteredDrivers(): DriverRegistration[] {
    return Array.from(this.drivers.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有可用的驱动列表（别名方法）
   */
  getAvailableDrivers(): DriverRegistration[] {
    return this.getRegisteredDrivers();
  }

  getDiscoveryProfiles(): DiscoveryProfile[] {
    return HardwareDriverManager.getDiscoveryProfiles();
  }

  static getDiscoveryProfiles(): DiscoveryProfile[] {
    return DISCOVERY_PROFILES.map(profile => ({
      ...profile,
      connectionTypes: [...profile.connectionTypes],
      usbIds: profile.usbIds.map(id => ({ ...id })),
      defaultPorts: [...profile.defaultPorts]
    }));
  }

  /**
   * 检测硬件设备
   */
  async detectHardware(useCache: boolean = true): Promise<DetectedDevice[]> {
    const cacheKey = 'hardware-detection';

    // 检查缓存
    if (useCache && this.detectionCache.has(cacheKey)) {
      const cached = this.detectionCache.get(cacheKey)!;
      return cached;
    }

    try {
      console.log('开始硬件检测...');

      // 并行执行所有检测器
      const detectionPromises = this.detectors.map(detector => this.safeDetect(detector));

      const results = await Promise.all(detectionPromises);
      const allDevices = results.flat();

      // 合并和排序结果
      const mergedDevices = this.mergeAndRankResults(allDevices);

      // 缓存结果
      this.detectionCache.set(cacheKey, mergedDevices);
      const cacheExpiry = setTimeout(() => {
        this.detectionCache.delete(cacheKey);
      }, this.cacheTimeout);
      cacheExpiry.unref?.();

      console.log(`检测到 ${mergedDevices.length} 个设备`);
      this.emit('devicesDetected', mergedDevices);
      return mergedDevices;
    } catch (error) {
      console.error('Hardware detection failed:', error);
      return [];
    }
  }

  /**
   * 安全执行设备检测
   * 对单个检测器设置超时，避免永不 resolve 的检测器阻塞整体检测流程
   */
  private async safeDetect(detector: IDeviceDetector): Promise<DetectedDevice[]> {
    try {
      return await Promise.race([
        detector.detect(),
        new Promise<DetectedDevice[]>((resolve) => {
          const timer = setTimeout(() => {
            console.warn(`Detector ${detector.name} timed out`);
            resolve([]);
          }, this.detectorTimeout);
          timer.unref?.();
        })
      ]);
    } catch (error) {
      console.warn(`Detector ${detector.name} failed:`, error);
      return [];
    }
  }

  /**
   * 匹配设备驱动
   */
  async matchDriver(device: DetectedDevice): Promise<DriverRegistration | null> {
    // 精确匹配 - 基于设备类型和驱动支持列表
    for (const driver of this.getRegisteredDrivers()) {
      if (this.isExactMatch(device, driver)) {
        return driver;
      }
    }

    // 通用匹配 - 基于连接类型
    for (const driver of this.getRegisteredDrivers()) {
      if (this.isGenericMatch(device, driver)) {
        return driver;
      }
    }

    return null;
  }

  /**
   * 精确匹配
   */
  private isExactMatch(device: DetectedDevice, driver: DriverRegistration): boolean {
    if (!this.isDriverCompatibleWithConnection(device, driver)) {
      return false;
    }

    return driver.supportedDevices.some(
      supported =>
        device.id.includes(supported) || device.name.toLowerCase().includes(supported.toLowerCase())
    );
  }

  /**
   * 通用匹配
   */
  private isGenericMatch(device: DetectedDevice, driver: DriverRegistration): boolean {
    // 基于设备类型和驱动类型的通用匹配逻辑
    switch (device.type) {
      case 'serial':
        return driver.id === 'pico-logic-analyzer' || driver.id === 'sigrok-adapter';
      case 'network':
        return driver.id === 'saleae-logic' ||
               driver.id === 'rigol-siglent' ||
               driver.id === 'network-analyzer';
      case 'usb':
        return driver.id === 'sigrok-adapter';
      default:
        return false;
    }
  }

  private isDriverCompatibleWithConnection(device: DetectedDevice, driver: DriverRegistration): boolean {
    switch (device.type) {
      case 'serial':
        return driver.id === 'pico-logic-analyzer' || driver.id === 'sigrok-adapter';
      case 'network':
        return driver.id === 'saleae-logic' ||
               driver.id === 'rigol-siglent' ||
               driver.id === 'network-analyzer';
      case 'usb':
        return driver.id === 'saleae-logic' || driver.id === 'sigrok-adapter';
      default:
        return false;
    }
  }

  /**
   * 创建驱动实例
   */
  createDriver(device: DetectedDevice): Promise<AnalyzerDriverBase> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const driverRegistration = await this.matchDriver(device);

          if (!driverRegistration) {
            reject(new Error(`No suitable driver found for device: ${device.name}`));
            return;
          }

          const driver = this.createDriverInstance(
            driverRegistration.driverClass,
            device.connectionString
          );

          this.emit('driverCreated', { device, driver, registration: driverRegistration });
          resolve(driver);
        } catch (error) {
          reject(new Error(`Failed to create driver for device ${device.name}: ${error}`));
        }
      })();
    });
  }

  /**
   * 创建驱动实例的内部方法
   */
  private createDriverInstance(
    DriverClass: DriverConstructor,
    connectionString: string
  ): AnalyzerDriverBase {
    // 特殊处理不同类型的驱动
    if (DriverClass === NetworkLogicAnalyzerDriver) {
      // 网络驱动需要解析host:port
      const parts = connectionString.split(':');
      const host = parts[0] || 'localhost';
      const port = parseInt(parts[1] || '24000', 10);
      return new NetworkLogicAnalyzerDriver(host, port);
    } else if (DriverClass === SigrokAdapter) {
      // Sigrok适配器需要解析driver:connection
      const parts = connectionString.split(':');
      const driver = parts[0] || 'fx2lafw';
      const deviceId = parts[1] || '';
      return new SigrokAdapter(driver, deviceId);
    } else {
      // 其他驱动使用标准构造函数
      return new DriverClass(connectionString);
    }
  }

  /**
   * 自动检测并连接设备
   */
  async autoConnect(): Promise<AnalyzerDriverBase | null> {
    const devices = await this.detectHardware();

    if (devices.length === 0) {
      throw new Error('No compatible devices found');
    }

    // 尝试连接置信度最高的设备
    const bestDevice = devices[0];

    try {
      return await this.createDriver(bestDevice);
    } catch (error) {
      // 如果第一个设备连接失败，尝试其他设备
      for (let i = 1; i < Math.min(devices.length, 3); i++) {
        try {
          return await this.createDriver(devices[i]);
        } catch {
          continue;
        }
      }
      throw new Error('Failed to connect to any detected device');
    }
  }

  /**
   * 合并和排序检测结果
   */
  private mergeAndRankResults(devices: DetectedDevice[]): DetectedDevice[] {
    // 去重：基于connectionString去重
    const uniqueDevices = new Map<string, DetectedDevice>();

    for (const device of devices) {
      const enrichedDevice = this.applyKnownDeviceMetadata(device);
      const key = enrichedDevice.connectionString;
      const existing = uniqueDevices.get(key);
      if (!existing || this.compareDetectedDevices(enrichedDevice, existing) < 0) {
        uniqueDevices.set(key, enrichedDevice);
      }
    }

    return Array.from(uniqueDevices.values()).sort((a, b) => this.compareDetectedDevices(a, b));
  }

  /**
   * 记住设备，用于多设备稳定排序和后续快速选择
   */
  rememberDevice(device: DetectedDevice): DetectedDevice {
    const deviceKey = this.getDeviceIdentityKey(device);
    const rememberedDevice: DetectedDevice = {
      ...device,
      known: true,
      assignedIndex: device.assignedIndex ?? this.knownDevices.size
    };

    this.knownDevices.set(deviceKey, rememberedDevice);
    this.emit('deviceRemembered', rememberedDevice);
    return rememberedDevice;
  }

  /**
   * 忘记设备，支持按 id、连接串或稳定身份键删除
   */
  forgetDevice(deviceIdOrKey: string): boolean {
    let removed = this.knownDevices.delete(deviceIdOrKey);

    if (!removed) {
      for (const [key, device] of this.knownDevices.entries()) {
        if (device.id === deviceIdOrKey || device.connectionString === deviceIdOrKey) {
          this.knownDevices.delete(key);
          removed = true;
          break;
        }
      }
    }

    if (removed) {
      this.emit('deviceForgotten', deviceIdOrKey);
    }

    return removed;
  }

  getKnownDevices(): DetectedDevice[] {
    return Array.from(this.knownDevices.values()).sort((a, b) => this.compareDetectedDevices(a, b));
  }

  private applyKnownDeviceMetadata(device: DetectedDevice): DetectedDevice {
    const knownDevice = this.knownDevices.get(this.getDeviceIdentityKey(device)) ||
      Array.from(this.knownDevices.values()).find(
        known => known.id === device.id || known.connectionString === device.connectionString
      );

    if (!knownDevice) {
      return device;
    }

    return {
      ...device,
      assignedIndex: knownDevice.assignedIndex,
      known: true
    };
  }

  private getDeviceIdentityKey(device: DetectedDevice): string {
    const vendorId = HardwareDriverManager.normalizeUsbId(device.vendorId);
    const productId = HardwareDriverManager.normalizeUsbId(device.productId);
    const serialNumber = device.serialNumber?.trim();

    if (vendorId && productId && serialNumber) {
      return `usb:${vendorId}:${productId}:${serialNumber}`;
    }

    if (vendorId && productId && device.parentId) {
      return `usb:${vendorId}:${productId}:parent:${device.parentId}`;
    }

    return `${device.type}:${device.connectionString}`;
  }

  private compareDetectedDevices(a: DetectedDevice, b: DetectedDevice): number {
    const aIndex = a.assignedIndex ?? Number.MAX_SAFE_INTEGER;
    const bIndex = b.assignedIndex ?? Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;

    if (a.confidence !== b.confidence) return b.confidence - a.confidence;

    const aIdentity = this.getDeviceIdentityKey(a);
    const bIdentity = this.getDeviceIdentityKey(b);
    return aIdentity.localeCompare(bIdentity);
  }

  private static normalizeUsbId(value?: string): string | undefined {
    if (!value) return undefined;
    return value.replace(/^0x/i, '').toUpperCase().padStart(4, '0');
  }

  /**
   * 创建多设备驱动
   */
  createMultiDeviceDriver(connectionStrings: string[]): MultiAnalyzerDriver {
    if (connectionStrings.length < 2 || connectionStrings.length > 5) {
      throw new Error('多设备驱动需要2-5个连接字符串');
    }

    const multiDriver = new MultiAnalyzerDriver(connectionStrings);
    this.emit('multiDriverCreated', { connectionStrings, driver: multiDriver });
    return multiDriver;
  }

  /**
   * 获取支持的sigrok设备列表
   */
  getSupportedSigrokDevices(): Array<{ driver: string; name: string; channels: number; maxRate: number }> {
    return SigrokAdapter.getSupportedDevices();
  }

  /**
   * 连接到指定设备
   */
  async connectToDevice(deviceId: string, params?: unknown): Promise<{ success: boolean; deviceInfo?: DeviceInfo; error?: string }> {
    if (!deviceId || deviceId.trim() === '') {
      return { success: false, error: '设备不存在或无法识别' };
    }

    try {
      // 如果已有设备连接，先断开
      if (this.currentDevice) {
        await this.currentDevice.disconnect();
        this.currentDevice = null;
        this.connectedDeviceInfo = null;
      }

      let device: DetectedDevice | null = null;

      if (deviceId === 'autodetect') {
        // 自动检测最佳设备
        const devices = await this.detectHardware();
        if (devices.length === 0) {
          return { success: false, error: '未检测到任何设备' };
        }
        device = devices[0];
      } else if (deviceId === 'network') {
        // 网络连接
        const paramsObj = params as Record<string, unknown> | undefined;
        if (!paramsObj?.networkConfig) {
          return { success: false, error: '缺少网络配置参数' };
        }

        const networkConfig = paramsObj.networkConfig as Record<string, unknown>;
        const host = networkConfig.host as string;
        const port = networkConfig.port as number;
        device = {
          id: 'network',
          name: 'Network Device',
          type: 'network',
          connectionString: `${host}:${port}`,
          driverType: AnalyzerDriverType.Network,
          confidence: 0.8
        };
      } else {
        // 查找指定设备
        const devices = await this.detectHardware();
        device = devices.find(d => d.id === deviceId) || null;

        if (!device) {
          // 尝试直接作为连接字符串处理
          const isNetworkConnection = deviceId.includes(':');
          device = {
            id: deviceId,
            name: isNetworkConnection ? 'Network Device' : 'Serial Device',
            type: isNetworkConnection ? 'network' : 'serial',
            connectionString: deviceId,
            driverType: isNetworkConnection ? AnalyzerDriverType.Network : AnalyzerDriverType.Serial,
            confidence: 0.6
          };
        }
      }

      if (!device) {
        return { success: false, error: '设备不存在或无法识别' };
      }

      // 创建驱动实例
      const driver = await this.createDriver(device);

      // 尝试连接
      const result = await driver.connect(params as ConnectionParams);

      if (result.success) {
        this.currentDevice = driver;
        this.connectedDeviceInfo = device;
        this.activeConnections.set(device.id, driver);

        this.emit('deviceConnected', { device, driver });

        return {
          success: true,
          deviceInfo: result.deviceInfo
        };
      } else {
        return {
          success: false,
          error: result.error || '连接失败'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取当前连接的设备
   */
  getCurrentDevice(): AnalyzerDriverBase | null {
    return this.currentDevice;
  }

  /**
   * 获取当前连接的设备信息
   */
  getCurrentDeviceInfo(): DetectedDevice | null {
    return this.connectedDeviceInfo;
  }

  /**
   * 断开当前设备连接
   */
  async disconnectCurrentDevice(): Promise<void> {
    if (this.currentDevice) {
      try {
        await this.currentDevice.disconnect();

        if (this.connectedDeviceInfo) {
          this.activeConnections.delete(this.connectedDeviceInfo.id);
          this.emit('deviceDisconnected', { device: this.connectedDeviceInfo });
        }
      } catch (error) {
        console.error('断开设备连接失败:', error);
      } finally {
        this.currentDevice = null;
        this.connectedDeviceInfo = null;
      }
    }
  }

  /**
   * 检查是否有设备连接
   */
  isDeviceConnected(): boolean {
    return this.currentDevice !== null;
  }

  /**
   * 获取所有活动连接
   */
  getActiveConnections(): Map<string, AnalyzerDriverBase> {
    return new Map(this.activeConnections);
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    // 断开所有连接
    const disconnectPromises = Array.from(this.activeConnections.values()).map(
      driver => driver.disconnect().catch(error => {
        console.error('清理驱动连接失败:', error);
      })
    );

    await Promise.allSettled(disconnectPromises);

    this.activeConnections.clear();
    this.detectionCache.clear();
    this.currentDevice = null;
    this.connectedDeviceInfo = null;
    this.removeAllListeners();
  }
}

/**
 * 串口设备检测器
 */
export class SerialDetector implements IDeviceDetector {
  readonly name = 'Serial Port Detector';

  async detect(): Promise<DetectedDevice[]> {
    try {
      // 使用serialport库检测串口设备
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();
      return SerialDetector.fromSerialPorts(ports);
    } catch (error) {
      console.warn('Serial port detection failed:', error);
      return [];
    }
  }

  static fromSerialPorts(ports: Record<string, unknown>[]): DetectedDevice[] {
    return ports
      .map((port, index) => ({ device: SerialDetector.classifyPort(port), index }))
      .filter((entry): entry is { device: DetectedDevice; index: number } => entry.device !== null)
      .sort((a, b) => b.device.confidence - a.device.confidence || a.index - b.index)
      .map(entry => entry.device);
  }

  private static classifyPort(port: Record<string, unknown>): DetectedDevice | null {
    const vendorId = SerialDetector.normalizeUsbId(port.vendorId as string);
    const productId = SerialDetector.normalizeUsbId(port.productId as string);
    const serialNumber = (port.serialNumber as string) || SerialDetector.extractSerialNumber(port.pnpId as string);
    const parentId = SerialDetector.extractParentId(port.pnpId as string);
    const isOriginalAnalyzer = vendorId === '1209' && productId === '3020';
    const isRaspberryPiPico = vendorId === '2E8A' && productId === '0003';
    const manufacturer = String(port.manufacturer || '');
    const product = String(port.productId || '');

    if (!isOriginalAnalyzer && !isRaspberryPiPico && !manufacturer.toLowerCase().includes('pico')) {
      return null;
    }

    const confidence = isOriginalAnalyzer ? 100 : isRaspberryPiPico ? 45 : 35;
    const verificationRequired = !isOriginalAnalyzer;
    const deviceName = isOriginalAnalyzer ? 'Pico Logic Analyzer' : 'Raspberry Pi Pico Candidate';
    const portPath = port.path as string;

    return {
      id: serialNumber ? `serial-${vendorId}-${productId}-${serialNumber}` : `serial-${portPath}`,
      name: `${deviceName} (${portPath})`,
      type: 'serial',
      connectionString: portPath,
      connectionPath: portPath,
      driverType: AnalyzerDriverType.Serial,
      confidence,
      vendorId,
      productId: productId || product,
      serialNumber,
      parentId,
      devicePath: portPath,
      verificationRequired,
      discoveredBy: 'serial'
    };
  }

  private static normalizeUsbId(value?: string): string | undefined {
    if (!value) return undefined;
    return value.replace(/^0x/i, '').toUpperCase().padStart(4, '0');
  }

  private static extractParentId(pnpId?: string): string | undefined {
    if (!pnpId) return undefined;
    const parts = pnpId.split('\\').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : undefined;
  }

  private static extractSerialNumber(pnpId?: string): string | undefined {
    const parentId = SerialDetector.extractParentId(pnpId);
    if (!parentId || parentId.includes('&')) return undefined;
    return parentId;
  }
}

/**
 * 网络设备检测器
 * 扫描本地网络中的逻辑分析器设备
 */
export class NetworkDetector implements IDeviceDetector {
  readonly name = 'Network Device Detector';

  async detect(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = [];

    try {
      // 扫描统一发现配置中的网络端口，端口开放只作为候选，真实设备还需握手确认。
      const commonPorts = NetworkDetector.getDefaultPorts();
      const baseIPs = this.getLocalNetworkRange();

      // 并行扫描多个IP地址
      const scanPromises = baseIPs.slice(0, 50).map(ip =>
        this.scanHostPorts(ip, commonPorts)
      );

      const results = await Promise.allSettled(scanPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          devices.push(result.value);
        }
      }
    } catch (error) {
      console.warn('Network device detection failed:', error);
    }

    return devices;
  }

  private getLocalNetworkRange(): string[] {
    // 获取本地网络IP范围（简化实现）
    const baseIPs: string[] = [];

    // 常见的私有网络段
    const networks = [
      '192.168.1',
      '192.168.0',
      '10.0.0',
      '172.16.0'
    ];

    for (const network of networks) {
      for (let i = 1; i <= 254; i++) {
        baseIPs.push(`${network}.${i}`);
      }
    }

    return baseIPs;
  }

  private async scanHostPorts(host: string, ports: number[]): Promise<DetectedDevice | null> {
    for (const port of ports) {
      try {
        const isOpen = await this.checkPort(host, port);
        if (isOpen) {
          const profiles = NetworkDetector.getProfilesForPort(port);

          for (const profile of profiles) {
            const verifiedProbe = await this.performProfileHandshake(host, port, profile);
            if (verifiedProbe?.handshakeVerified) {
              return NetworkDetector.fromProbeResult(verifiedProbe);
            }
          }

          return NetworkDetector.fromProbeResult({
            host,
            port,
            profileId: profiles[0]?.id,
            protocol: 'tcp-open',
            handshakeVerified: false
          });
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  private async checkPort(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new (require('net').Socket)();
      const timeout = 1000;

      socket.setTimeout(timeout);
      socket.connect(port, host, () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  private async performProfileHandshake(
    host: string,
    port: number,
    profile: DiscoveryProfile
  ): Promise<NetworkProbeResult | null> {
    switch (profile.handshake) {
      case 'pico-version':
        return this.performPicoVersionHandshake(host, port, profile.id);
      case 'scpi-idn':
        return this.performScpiIdnHandshake(host, port, profile.id);
      case 'saleae-api':
      case 'sigrok-cli':
      default:
        return null;
    }
  }

  private async performPicoVersionHandshake(
    host: string,
    port: number,
    profileId: string
  ): Promise<NetworkProbeResult | null> {
    return new Promise((resolve) => {
      const socket = new (require('net').Socket)();
      let responseData = '';
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, 1000);

      socket.connect(port, host, () => {
        try {
          const packet = new OutputPacket();
          packet.addByte(0);
          socket.write(packet.serialize());
        } catch {
          clearTimeout(timeout);
          socket.destroy();
          resolve(null);
        }
      });

      socket.on('data', (data: Buffer) => {
        responseData += data.toString();
        const lines = responseData.split('\n').filter(line => line.trim());

        if (lines.length < 5) return;

        clearTimeout(timeout);
        socket.destroy();

        const version = lines[0].trim();
        const deviceVersion = VersionValidator.getVersion(version);
        const hasDeviceShape =
          /^FREQ:[0-9]+$/.test(lines[1].trim()) &&
          /^BLASTFREQ:[0-9]+$/.test(lines[2].trim()) &&
          /^BUFFER:[0-9]+$/.test(lines[3].trim()) &&
          /^CHANNELS:[0-9]+$/.test(lines[4].trim());

        if (!deviceVersion.isValid || !hasDeviceShape) {
          resolve(null);
          return;
        }

        resolve({
          host,
          port,
          profileId,
          protocol: 'pico-version',
          handshakeVerified: true,
          deviceName: 'Pico Logic Analyzer WiFi',
          version
        });
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  private async performScpiIdnHandshake(
    host: string,
    port: number,
    profileId: string
  ): Promise<NetworkProbeResult | null> {
    return new Promise((resolve) => {
      const socket = new (require('net').Socket)();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, 1000);

      socket.connect(port, host, () => {
        socket.write('*IDN?\n');
      });

      socket.on('data', (data: Buffer) => {
        clearTimeout(timeout);
        socket.destroy();
        const response = data.toString().trim();
        const lower = response.toLowerCase();
        const manufacturer = lower.includes('rigol') ? 'Rigol' : lower.includes('siglent') ? 'Siglent' : undefined;

        if (!manufacturer) {
          resolve(null);
          return;
        }

        resolve({
          host,
          port,
          profileId,
          protocol: 'scpi-idn',
          handshakeVerified: true,
          manufacturer,
          deviceName: `${manufacturer} SCPI Instrument (${host}:${port})`,
          version: response
        });
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  static getDefaultPorts(): number[] {
    const ports = HardwareDriverManager.getDiscoveryProfiles()
      .flatMap(profile => profile.defaultPorts);
    return Array.from(new Set(ports));
  }

  static getProfilesForPort(port: number): DiscoveryProfile[] {
    return HardwareDriverManager.getDiscoveryProfiles().filter(
      profile => profile.connectionTypes.includes('network') && profile.defaultPorts.includes(port)
    );
  }

  static fromProbeResult(probe: NetworkProbeResult): DetectedDevice {
    const connectionString = `${probe.host}:${probe.port}`;
    const profileId = probe.profileId || NetworkDetector.getProfileIdForProbe(probe);
    const discoveryState: DetectedDevice['discoveryState'] = probe.handshakeVerified ? 'confirmed' : 'candidate';
    const discoveryEvidence = probe.handshakeVerified
      ? `${probe.protocol} 握手已确认`
      : `端口 ${probe.port} 开放，仍需 ${profileId || '对应 profile'} 握手确认`;
    const baseDevice = {
      type: 'network' as const,
      connectionString,
      driverType: AnalyzerDriverType.Network,
      discoveryProtocol: probe.protocol,
      discoveredBy: `network:${probe.protocol}`,
      profileId,
      version: probe.version,
      handshakeVerified: probe.handshakeVerified,
      discoveryState,
      discoveryEvidence
    };

    if (probe.protocol === 'pico-version' && probe.handshakeVerified) {
      return {
        ...baseDevice,
        id: `network-pico-${probe.host}-${probe.port}`,
        name: probe.deviceName || `Pico Logic Analyzer (${connectionString})`,
        confidence: 92,
        verificationRequired: false,
        adapterStatus: 'hardware-pending',
        certificationLevel: 'experimental'
      };
    }

    if (probe.protocol === 'saleae-api' && probe.handshakeVerified) {
      return {
        ...baseDevice,
        id: `saleae-api-${probe.host}-${probe.port}`,
        name: probe.deviceName || `Saleae Logic API (${connectionString})`,
        confidence: 70,
        verificationRequired: true,
        adapterStatus: 'framework',
        certificationLevel: 'experimental'
      };
    }

    if (probe.protocol === 'scpi-idn' && probe.handshakeVerified) {
      const manufacturer = probe.manufacturer || 'SCPI';
      return {
        ...baseDevice,
        id: `scpi-${manufacturer.toLowerCase()}-${probe.host}-${probe.port}`,
        name: probe.deviceName || `${manufacturer} SCPI Instrument (${connectionString})`,
        confidence: 72,
        verificationRequired: true,
        adapterStatus: 'framework',
        certificationLevel: 'experimental'
      };
    }

    return {
      ...baseDevice,
      id: `network-candidate-${probe.host}-${probe.port}`,
      name: probe.deviceName || `Network Device Candidate (${connectionString})`,
      confidence: 35,
      verificationRequired: true,
      adapterStatus: 'framework',
      certificationLevel: 'experimental'
    };
  }

  private static getProfileIdForProbe(probe: NetworkProbeResult): string | undefined {
    if (probe.protocol === 'pico-version') return 'network-pico';
    if (probe.protocol === 'saleae-api') return 'saleae-logic';
    if (probe.protocol === 'scpi-idn') return 'rigol-siglent-scpi';
    return NetworkDetector.getProfilesForPort(probe.port)[0]?.id;
  }
}

/**
 * Saleae Logic设备检测器
 */
export class SaleaeDetector implements IDeviceDetector {
  readonly name = 'Saleae Logic Detector';

  async detect(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = [];

    try {
      // 检查Saleae Logic软件API端口
      const isApiAvailable = await this.checkSaleaeAPI();

      if (isApiAvailable) {
        // 查询连接的设备
        const connectedDevices = await this.querySaleaeDevices();
        devices.push(...connectedDevices);
      }
    } catch (error) {
      console.warn('Saleae device detection failed:', error);
    }

    return devices;
  }

  private async checkSaleaeAPI(): Promise<boolean> {
    try {
      const socket = new (require('net').Socket)();

      return new Promise((resolve) => {
        socket.setTimeout(2000);
        socket.connect(10429, 'localhost', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  private async querySaleaeDevices(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = [];

    try {
      // 这里应该通过Saleae API查询设备
      // 简化实现，假设检测到一个设备
      devices.push({
        id: 'saleae-logic-1',
        name: 'Saleae Logic Analyzer',
        type: 'usb',
        connectionString: 'localhost:10429',
        driverType: AnalyzerDriverType.Serial,
        confidence: 70,
        profileId: 'saleae-logic',
        handshakeVerified: false,
        discoveryState: 'candidate',
        discoveryEvidence: 'Saleae API 端口开放，仍需 API 枚举返回设备清单',
        verificationRequired: true,
        adapterStatus: 'framework',
        certificationLevel: 'experimental'
      });
    } catch (error) {
      console.warn('Query Saleae devices failed:', error);
    }

    return devices;
  }
}

/**
 * Sigrok设备检测器
 */
export class SigrokDetector implements IDeviceDetector {
  readonly name = 'Sigrok Device Detector';

  async detect(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = [];

    try {
      // 检查sigrok-cli是否可用
      const isSigrokAvailable = await this.checkSigrokCli();

      if (isSigrokAvailable) {
        // 扫描sigrok设备
        const sigrokDevices = await this.scanSigrokDevices();
        devices.push(...sigrokDevices);
      }
    } catch (error) {
      console.warn('Sigrok device detection failed:', error);
    }

    return devices;
  }

  private async checkSigrokCli(): Promise<boolean> {
    try {
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const process = spawn('sigrok-cli', ['--version']);

        process.on('close', (code: number) => {
          resolve(code === 0);
        });

        process.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  private async scanSigrokDevices(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = [];

    try {
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const process = spawn('sigrok-cli', ['--scan']);
        let output = '';

        process.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });

        process.on('close', (code: number) => {
          if (code === 0) {
            const parsedDevices = this.parseSigrokScanOutput(output);
            resolve(parsedDevices);
          } else {
            resolve([]);
          }
        });

        process.on('error', () => {
          resolve([]);
        });
      });
    } catch (error) {
      console.warn('Scan sigrok devices failed:', error);
      return [];
    }
  }

  private parseSigrokScanOutput(output: string): DetectedDevice[] {
    const devices: DetectedDevice[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('The following')) continue;

      // 解析格式: "driver:conn=value - Description"
      const match = trimmed.match(/^([^:]+):([^-]+)\s*-\s*(.+)$/);
      if (match) {
        const driver = match[1].trim();
        const connection = match[2].trim();
        const description = match[3].trim();

        devices.push({
          id: `sigrok-${driver}-${connection}`,
          name: `${description} (Sigrok)`,
          type: 'usb',
          connectionString: `${driver}:${connection}`,
          driverType: AnalyzerDriverType.Serial,
          confidence: 85,
          profileId: 'sigrok-cli',
          handshakeVerified: true,
          discoveryState: 'confirmed',
          discoveryEvidence: 'sigrok-cli --scan 返回设备连接串',
          verificationRequired: true,
          adapterStatus: 'framework',
          certificationLevel: 'experimental'
        });
      }
    }

    return devices;
  }
}

/**
 * Rigol/Siglent设备检测器
 */
export class RigolSiglentDetector implements IDeviceDetector {
  readonly name = 'Rigol/Siglent Detector';

  async detect(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = [];

    try {
      // 扫描常见的SCPI端口
      const scpiPorts = [5555, 5025, 111];
      const baseIPs = this.getCommonInstrumentIPs();

      // 并行扫描
      const scanPromises = baseIPs.map(ip =>
        this.scanInstrumentPorts(ip, scpiPorts)
      );

      const results = await Promise.allSettled(scanPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          devices.push(result.value);
        }
      }
    } catch (error) {
      console.warn('Rigol/Siglent device detection failed:', error);
    }

    return devices;
  }

  private getCommonInstrumentIPs(): string[] {
    // 常见的仪器IP地址
    return [
      '192.168.1.100', '192.168.1.101', '192.168.1.102',
      '10.0.0.100', '10.0.0.101', '10.0.0.102',
      '172.16.0.100', '172.16.0.101'
    ];
  }

  private async scanInstrumentPorts(host: string, ports: number[]): Promise<DetectedDevice | null> {
    for (const port of ports) {
      try {
        const isInstrument = await this.checkInstrumentPort(host, port);
        if (isInstrument) {
          return {
            id: `rigol-siglent-${host}-${port}`,
            name: `Rigol/Siglent Instrument (${host}:${port})`,
            type: 'network',
            connectionString: `${host}:${port}`,
            driverType: AnalyzerDriverType.Network,
            confidence: 80
          };
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  private async checkInstrumentPort(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new (require('net').Socket)();

      socket.setTimeout(2000);
      socket.connect(port, host, () => {
        // 发送IDN查询命令
        socket.write('*IDN?\n');

        socket.on('data', (data: Buffer) => {
          const response = data.toString();
          const isRigolSiglent = response.toLowerCase().includes('rigol') ||
                                response.toLowerCase().includes('siglent');
          socket.destroy();
          resolve(isRigolSiglent);
        });
      });

      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
}

// 导出单例实例
export const hardwareDriverManager = new HardwareDriverManager();
