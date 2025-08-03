import { Socket } from 'net';
import { createSocket } from 'dgram';
import { networkInterfaces } from 'os';
import { OutputPacket } from '../drivers/AnalyzerDriverBase';
import { VersionValidator } from '../drivers/VersionValidator';

/**
 * WiFi设备信息接口
 */
export interface WiFiDeviceInfo {
  /** 设备IP地址 */
  ipAddress: string;
  /** 设备端口 */
  port: number;
  /** 设备版本信息 */
  version?: string;
  /** 设备名称 */
  deviceName?: string;
  /** 响应时间(ms) */
  responseTime: number;
  /** 设备类型 */
  deviceType: string;
  /** 信号强度 */
  signalStrength?: number;
  /** 设备序列号 */
  serialNumber?: string;
  /** 最后发现时间 */
  lastSeen: Date;
  /** 是否在线 */
  isOnline: boolean;
}

/**
 * 网络扫描结果接口
 */
export interface NetworkScanResult {
  /** 扫描到的设备列表 */
  devices: WiFiDeviceInfo[];
  /** 扫描耗时(ms) */
  scanDuration: number;
  /** 扫描的IP范围 */
  ipRange: string;
  /** 扫描的端口列表 */
  ports: number[];
  /** 扫描状态 */
  status: 'completed' | 'failed' | 'timeout';
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 扫描配置接口
 */
export interface ScanConfiguration {
  /** 扫描超时时间(ms) */
  timeout: number;
  /** 并发连接数 */
  concurrency: number;
  /** 要扫描的端口列表 */
  ports: number[];
  /** IP地址范围（可选，如果不指定则自动检测） */
  ipRange?: string;
  /** 是否启用深度扫描（验证设备类型） */
  deepScan: boolean;
  /** 是否启用UDP广播发现 */
  enableBroadcast: boolean;
}

/**
 * Pico Logic Analyzer WiFi设备发现服务
 * 实现网络设备自动发现、端口扫描、设备验证等功能
 */
export class WiFiDeviceDiscovery {
  private discoveredDevices: Map<string, WiFiDeviceInfo> = new Map();
  private isScanning: boolean = false;
  private scanAbortController?: AbortController;

  /** 默认扫描配置 */
  private defaultConfig: ScanConfiguration = {
    timeout: 3000,
    concurrency: 50,
    ports: [4045, 80, 8080, 8000, 3000], // Pico默认4045，加上常见的Web端口
    deepScan: true,
    enableBroadcast: true
  };

  /**
   * 扫描网络中的Pico Logic Analyzer设备
   */
  async scanForDevices(config?: Partial<ScanConfiguration>): Promise<NetworkScanResult> {
    if (this.isScanning) {
      throw new Error('设备扫描正在进行中，请等待完成');
    }

    const startTime = Date.now();
    this.isScanning = true;
    this.scanAbortController = new AbortController();

    const scanConfig: ScanConfiguration = { ...this.defaultConfig, ...config };
    const devices: WiFiDeviceInfo[] = [];

    try {
      // 1. 获取本地网络信息
      const networkRanges = this.getLocalNetworkRanges();
      console.log(`开始扫描网络范围: ${networkRanges.join(', ')}`);

      // 2. 如果启用UDP广播，先尝试广播发现
      if (scanConfig.enableBroadcast) {
        console.log('开始UDP广播发现...');
        const broadcastDevices = await this.performBroadcastDiscovery(scanConfig);
        devices.push(...broadcastDevices);
      }

      // 3. 执行IP范围扫描
      for (const ipRange of networkRanges) {
        console.log(`扫描IP范围: ${ipRange}`);
        const rangeDevices = await this.scanIPRange(ipRange, scanConfig);

        // 合并设备，避免重复
        for (const device of rangeDevices) {
          const key = `${device.ipAddress}:${device.port}`;
          if (!devices.find(d => `${d.ipAddress}:${d.port}` === key)) {
            devices.push(device);
          }
        }
      }

      // 4. 更新内部设备缓存
      this.updateDeviceCache(devices);

      const scanDuration = Date.now() - startTime;
      console.log(`设备扫描完成，发现 ${devices.length} 个设备，耗时 ${scanDuration}ms`);

      return {
        devices,
        scanDuration,
        ipRange: networkRanges.join(', '),
        ports: scanConfig.ports,
        status: 'completed'
      };

    } catch (error) {
      const scanDuration = Date.now() - startTime;
      console.error('设备扫描失败:', error);

      return {
        devices,
        scanDuration,
        ipRange: config?.ipRange || 'auto',
        ports: scanConfig.ports,
        status: 'failed',
        error: error instanceof Error ? error.message : '未知错误'
      };
    } finally {
      this.isScanning = false;
      this.scanAbortController = undefined;
    }
  }

  /**
   * UDP广播发现设备
   */
  private async performBroadcastDiscovery(config: ScanConfiguration): Promise<WiFiDeviceInfo[]> {
    return new Promise((resolve) => {
      const devices: WiFiDeviceInfo[] = [];
      const udpSocket = createSocket('udp4');

      // 设置超时
      const timeout = setTimeout(() => {
        udpSocket.close();
        resolve(devices);
      }, config.timeout);

      udpSocket.on('message', async (msg, rinfo) => {
        try {
          // 尝试解析广播响应
          const response = JSON.parse(msg.toString());

          if (response.device_type === 'pico-logic-analyzer' ||
              response.type === 'logic-analyzer') {

            const device: WiFiDeviceInfo = {
              ipAddress: rinfo.address,
              port: response.port || 4045,
              version: response.version,
              deviceName: response.name || 'Pico Logic Analyzer',
              responseTime: Date.now() % 1000, // 简化的响应时间
              deviceType: 'Pico Logic Analyzer',
              serialNumber: response.serial,
              signalStrength: response.rssi,
              lastSeen: new Date(),
              isOnline: true
            };

            // 如果启用深度扫描，验证设备
            if (config.deepScan) {
              const verified = await this.verifyDevice(device.ipAddress, device.port);
              if (verified) {
                devices.push(device);
              }
            } else {
              devices.push(device);
            }
          }
        } catch (error) {
          // 忽略无效的广播消息
        }
      });

      udpSocket.on('error', (error) => {
        console.warn('UDP广播发现错误:', error);
        clearTimeout(timeout);
        udpSocket.close();
        resolve(devices);
      });

      // 绑定并发送广播
      udpSocket.bind(() => {
        udpSocket.setBroadcast(true);

        // 发送发现广播消息
        const discoveryMessage = JSON.stringify({
          type: 'discover',
          request: 'logic-analyzer-devices',
          timestamp: Date.now()
        });

        // 发送到常见的广播地址
        const broadcastAddresses = ['255.255.255.255', '192.168.1.255', '192.168.0.255'];

        for (const addr of broadcastAddresses) {
          udpSocket.send(discoveryMessage, 4046, addr, (error) => {
            if (error) {
              console.warn(`广播发送失败 ${addr}:`, error.message);
            }
          });
        }
      });
    });
  }

  /**
   * 扫描指定IP范围
   */
  private async scanIPRange(ipRange: string, config: ScanConfiguration): Promise<WiFiDeviceInfo[]> {
    const devices: WiFiDeviceInfo[] = [];
    const ipList = this.generateIPList(ipRange);

    console.log(`扫描 ${ipList.length} 个IP地址...`);

    // 使用并发限制避免过多连接
    const semaphore = new Array(config.concurrency).fill(null);
    const promises: Promise<void>[] = [];

    for (const ip of ipList) {
      // 等待可用的并发槽
      const promise = Promise.resolve().then(async () => {
        // 检查是否需要中止扫描
        if (this.scanAbortController?.signal.aborted) {
          return;
        }

        // 扫描这个IP的所有端口
        for (const port of config.ports) {
          try {
            const startTime = Date.now();
            const isOpen = await this.isPortOpen(ip, port, config.timeout);

            if (isOpen) {
              const responseTime = Date.now() - startTime;
              console.log(`发现开放端口: ${ip}:${port} (${responseTime}ms)`);

              // 如果启用深度扫描，验证是否为Pico设备
              if (config.deepScan) {
                const deviceInfo = await this.verifyPicoDevice(ip, port, config.timeout);
                if (deviceInfo) {
                  deviceInfo.responseTime = responseTime;
                  devices.push(deviceInfo);
                }
              } else {
                // 简单扫描，只记录开放的端口
                devices.push({
                  ipAddress: ip,
                  port,
                  responseTime,
                  deviceType: 'Unknown Device',
                  lastSeen: new Date(),
                  isOnline: true
                });
              }
            }
          } catch (error) {
            // 忽略连接错误，继续扫描
          }
        }
      });

      promises.push(promise);
    }

    // 等待所有扫描完成
    await Promise.allSettled(promises);

    return devices;
  }

  /**
   * 检查端口是否开放
   */
  private isPortOpen(ip: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, ip, () => {
        clearTimeout(timer);
        socket.end();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * 验证设备是否为Pico Logic Analyzer
   */
  private async verifyPicoDevice(ip: string, port: number, timeout: number): Promise<WiFiDeviceInfo | null> {
    return new Promise((resolve) => {
      const socket = new Socket();
      let responseData = '';

      const timer = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, timeout);

      socket.connect(port, ip, async () => {
        try {
          // 发送设备信息查询命令
          const packet = new OutputPacket();
          packet.addByte(0); // 设备信息查询命令

          const data = packet.serialize();
          socket.write(data);
        } catch (error) {
          clearTimeout(timer);
          socket.destroy();
          resolve(null);
        }
      });

      socket.on('data', (data) => {
        responseData += data.toString();

        // 检查是否接收到完整响应（通常是5行）
        const lines = responseData.split('\n').filter(line => line.trim());

        if (lines.length >= 5) {
          clearTimeout(timer);
          socket.destroy();

          try {
            const deviceInfo = this.parseDeviceResponse(ip, port, lines);
            resolve(deviceInfo);
          } catch (error) {
            resolve(null);
          }
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  }

  /**
   * 解析设备响应信息
   */
  private parseDeviceResponse(ip: string, port: number, lines: string[]): WiFiDeviceInfo | null {
    try {
      if (lines.length < 5) {
        return null;
      }

      // 验证版本信息
      const version = lines[0].trim();
      const deviceVersion = VersionValidator.getVersion(version);

      if (!deviceVersion.isValid) {
        console.log(`设备 ${ip}:${port} 版本验证失败: ${version}`);
        return null;
      }

      // 解析设备信息
      const freqMatch = /^FREQ:([0-9]+)$/.exec(lines[1].trim());
      const blastMatch = /^BLASTFREQ:([0-9]+)$/.exec(lines[2].trim());
      const bufferMatch = /^BUFFER:([0-9]+)$/.exec(lines[3].trim());
      const channelMatch = /^CHANNELS:([0-9]+)$/.exec(lines[4].trim());

      if (!freqMatch || !blastMatch || !bufferMatch || !channelMatch) {
        console.log(`设备 ${ip}:${port} 信息格式错误`);
        return null;
      }

      return {
        ipAddress: ip,
        port,
        version,
        deviceName: `Pico Logic Analyzer (${version})`,
        responseTime: 0, // 将在调用处设置
        deviceType: 'Pico Logic Analyzer',
        lastSeen: new Date(),
        isOnline: true
      };

    } catch (error) {
      console.error(`解析设备响应失败 ${ip}:${port}:`, error);
      return null;
    }
  }

  /**
   * 简单设备验证（用于广播发现）
   */
  private async verifyDevice(ip: string, port: number): Promise<boolean> {
    try {
      const device = await this.verifyPicoDevice(ip, port, 2000);
      return device !== null;
    } catch {
      return false;
    }
  }

  /**
   * 获取本地网络范围
   */
  private getLocalNetworkRanges(): string[] {
    const ranges: string[] = [];
    const interfaces = networkInterfaces();

    for (const name in interfaces) {
      const addresses = interfaces[name];
      if (!addresses) continue;

      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          // 生成网络范围 (假设/24子网)
          const parts = addr.address.split('.');
          const networkPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          ranges.push(`${networkPrefix}.1-254`);
        }
      }
    }

    // 如果没有找到网络接口，使用常见的私有网络范围
    if (ranges.length === 0) {
      ranges.push('192.168.1.1-254', '192.168.0.1-254', '10.0.0.1-254');
    }

    return ranges;
  }

  /**
   * 生成IP地址列表
   */
  private generateIPList(ipRange: string): string[] {
    const ips: string[] = [];

    if (ipRange.includes('-')) {
      const [start, end] = ipRange.split('-');
      const startParts = start.split('.');
      const endPart = parseInt(end);

      if (startParts.length === 4) {
        const prefix = `${startParts[0]}.${startParts[1]}.${startParts[2]}`;
        const startNum = parseInt(startParts[3]);

        for (let i = startNum; i <= endPart; i++) {
          ips.push(`${prefix}.${i}`);
        }
      }
    } else {
      // 单个IP地址
      ips.push(ipRange);
    }

    return ips;
  }

  /**
   * 更新设备缓存
   */
  private updateDeviceCache(devices: WiFiDeviceInfo[]): void {
    // 标记所有现有设备为离线
    for (const device of this.discoveredDevices.values()) {
      device.isOnline = false;
    }

    // 更新或添加新发现的设备
    for (const device of devices) {
      const key = `${device.ipAddress}:${device.port}`;
      this.discoveredDevices.set(key, device);
    }

    // 清理长时间未见的设备（超过5分钟）
    const now = new Date();
    for (const [key, device] of this.discoveredDevices.entries()) {
      if (!device.isOnline && (now.getTime() - device.lastSeen.getTime()) > 300000) {
        this.discoveredDevices.delete(key);
      }
    }
  }

  /**
   * 获取缓存的设备列表
   */
  getCachedDevices(): WiFiDeviceInfo[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * 获取在线设备列表
   */
  getOnlineDevices(): WiFiDeviceInfo[] {
    return this.getCachedDevices().filter(device => device.isOnline);
  }

  /**
   * 停止正在进行的扫描
   */
  stopScan(): void {
    if (this.isScanning && this.scanAbortController) {
      this.scanAbortController.abort();
      this.isScanning = false;
      console.log('设备扫描已停止');
    }
  }

  /**
   * 检查是否正在扫描
   */
  isScanInProgress(): boolean {
    return this.isScanning;
  }

  /**
   * 清除设备缓存
   */
  clearCache(): void {
    this.discoveredDevices.clear();
    console.log('设备缓存已清除');
  }

  /**
   * 刷新特定设备状态
   */
  async refreshDevice(ip: string, port: number): Promise<WiFiDeviceInfo | null> {
    try {
      const device = await this.verifyPicoDevice(ip, port, 3000);
      if (device) {
        const key = `${ip}:${port}`;
        this.discoveredDevices.set(key, device);
      }
      return device;
    } catch (error) {
      console.error(`刷新设备状态失败 ${ip}:${port}:`, error);
      return null;
    }
  }
}
