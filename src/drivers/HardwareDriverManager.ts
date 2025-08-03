import { EventEmitter } from 'events';
import { AnalyzerDriverBase } from './AnalyzerDriverBase';
import { LogicAnalyzerDriver } from './LogicAnalyzerDriver';
import { SaleaeLogicDriver } from './SaleaeLogicDriver';
import { RigolSiglentDriver } from './RigolSiglentDriver';
import { SigrokAdapter } from './SigrokAdapter';
import { NetworkLogicAnalyzerDriver } from './NetworkLogicAnalyzerDriver';
import { MultiAnalyzerDriver } from './MultiAnalyzerDriver';
import {
  AnalyzerDriverType,
  AnalyzerDeviceInfo
} from '../models/AnalyzerTypes';

/**
 * 检测到的设备信息
 */
export interface DetectedDevice {
  id: string; // 设备唯一标识
  name: string; // 设备名称
  type: 'serial' | 'network' | 'usb'; // 连接类型
  connectionString: string; // 连接字符串
  driverType: AnalyzerDriverType; // 驱动类型
  capabilities?: AnalyzerDeviceInfo; // 设备能力描述
  confidence: number; // 检测置信度 (0-100)
}

/**
 * 驱动注册信息
 */
export interface DriverRegistration {
  id: string; // 驱动ID
  name: string; // 驱动名称
  description: string; // 驱动描述
  version: string; // 驱动版本
  driverClass: typeof AnalyzerDriverBase; // 驱动类
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
  private currentDevice: AnalyzerDriverBase | null = null;
  private connectedDeviceInfo: DetectedDevice | null = null;

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
      driverClass: LogicAnalyzerDriver as any,
      supportedDevices: ['pico', 'rp2040', 'logic-analyzer', 'analyzer'],
      priority: 100
    });

    // 注册Saleae Logic兼容驱动
    this.registerDriver({
      id: 'saleae-logic',
      name: 'Saleae Logic Analyzer',
      description: 'Saleae Logic series compatible driver',
      version: '1.0.0',
      driverClass: SaleaeLogicDriver as any,
      supportedDevices: ['saleae', 'logic16', 'logic8', 'logic-pro'],
      priority: 90
    });

    // 注册Rigol/Siglent驱动
    this.registerDriver({
      id: 'rigol-siglent',
      name: 'Rigol/Siglent Logic Analyzer',
      description: 'Rigol and Siglent instruments with logic analyzer capability',
      version: '1.0.0',
      driverClass: RigolSiglentDriver as any,
      supportedDevices: ['rigol', 'siglent', 'ds1000z', 'ds2000', 'sds'],
      priority: 80
    });

    // 注册sigrok通用适配器
    this.registerDriver({
      id: 'sigrok-adapter',
      name: 'Sigrok Universal Adapter',
      description: 'Universal adapter for 80+ sigrok-supported devices',
      version: '1.0.0',
      driverClass: SigrokAdapter as any,
      supportedDevices: ['fx2lafw', 'hantek', 'kingst', 'chronovu', 'openbench'],
      priority: 70
    });

    // 注册网络设备驱动
    this.registerDriver({
      id: 'network-analyzer',
      name: 'Network Logic Analyzer',
      description: 'Generic network-based logic analyzer driver',
      version: '1.0.0',
      driverClass: NetworkLogicAnalyzerDriver as any,
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
      setTimeout(() => {
        this.detectionCache.delete(cacheKey);
      }, this.cacheTimeout);

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
   */
  private async safeDetect(detector: IDeviceDetector): Promise<DetectedDevice[]> {
    try {
      return await detector.detect();
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

  /**
   * 创建驱动实例
   */
  createDriver(device: DetectedDevice): Promise<AnalyzerDriverBase> {
    return new Promise(async (resolve, reject) => {
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
    });
  }

  /**
   * 创建驱动实例的内部方法
   */
  private createDriverInstance(
    DriverClass: typeof AnalyzerDriverBase,
    connectionString: string
  ): AnalyzerDriverBase {
    // 特殊处理不同类型的驱动
    if (DriverClass === NetworkLogicAnalyzerDriver as any) {
      // 网络驱动需要解析host:port
      const parts = connectionString.split(':');
      const host = parts[0] || 'localhost';
      const port = parseInt(parts[1] || '24000', 10);
      return new NetworkLogicAnalyzerDriver(host, port);
    } else if (DriverClass === SigrokAdapter as any) {
      // Sigrok适配器需要解析driver:connection
      const parts = connectionString.split(':');
      const driver = parts[0] || 'fx2lafw';
      const deviceId = parts[1] || '';
      return new SigrokAdapter(driver, deviceId);
    } else {
      // 其他驱动使用标准构造函数
      return new (DriverClass as any)(connectionString);
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
      const existing = uniqueDevices.get(device.connectionString);
      if (!existing || device.confidence > existing.confidence) {
        uniqueDevices.set(device.connectionString, device);
      }
    }

    // 按置信度排序
    return Array.from(uniqueDevices.values()).sort((a, b) => b.confidence - a.confidence);
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
  async connectToDevice(deviceId: string, params?: any): Promise<{ success: boolean; deviceInfo?: any; error?: string }> {
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
        if (!params?.networkConfig) {
          return { success: false, error: '缺少网络配置参数' };
        }

        const { host, port } = params.networkConfig;
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
          device = {
            id: deviceId,
            name: 'Manual Device',
            type: deviceId.includes(':') ? 'network' : 'serial',
            connectionString: deviceId,
            driverType: deviceId.includes(':') ? AnalyzerDriverType.Network : AnalyzerDriverType.Serial,
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
      const result = await driver.connect(params);

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
    const devices: DetectedDevice[] = [];

    try {
      // 使用serialport库检测串口设备
      const { SerialPort } = require('serialport');
      const ports = await SerialPort.list();

      for (const port of ports) {
        // 检测Pico逻辑分析器特征
        if (this.isPicoAnalyzer(port)) {
          devices.push({
            id: `serial-${port.path}`,
            name: `Logic Analyzer (${port.path})`,
            type: 'serial',
            connectionString: port.path,
            driverType: AnalyzerDriverType.Serial,
            confidence: 80
          });
        }
      }
    } catch (error) {
      console.warn('Serial port detection failed:', error);
    }

    return devices;
  }

  private isPicoAnalyzer(port: any): boolean {
    // 检测Pico设备的特征
    return (
      port.vendorId === '2E8A' || // Raspberry Pi Foundation
      port.productId === '0003' || // Pico
      (port.manufacturer && port.manufacturer.includes('Pico'))
    );
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
      // 扫描常见的网络逻辑分析器端口
      const commonPorts = [24000, 5555, 8080, 10000];
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
          return {
            id: `network-${host}-${port}`,
            name: `Network Logic Analyzer (${host}:${port})`,
            type: 'network',
            connectionString: `${host}:${port}`,
            driverType: AnalyzerDriverType.Network,
            confidence: 60
          };
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
        confidence: 95
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
          confidence: 85
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
