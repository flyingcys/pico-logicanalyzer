/**
 * WiFiDeviceDiscovery 单元测试
 * 测试WiFi设备发现服务的核心功能
 */

import { jest } from '@jest/globals';
import { WiFiDeviceDiscovery, WiFiDeviceInfo, NetworkScanResult, ScanConfiguration } from '../../../src/services/WiFiDeviceDiscovery';
import { OutputPacket } from '../../../src/drivers/AnalyzerDriverBase';
import { VersionValidator } from '../../../src/drivers/VersionValidator';
import { MockBase, TestUtils } from '../../../src/tests/mocks';

// Mock网络模块
jest.mock('net');
jest.mock('dgram');
jest.mock('os');

describe('WiFiDeviceDiscovery', () => {
  let wifiDiscovery: WiFiDeviceDiscovery;
  let mockSocket: any;
  let mockUdpSocket: any;
  let mockNetworkInterfaces: any;

  beforeEach(() => {
    // 创建Mock对象
    mockSocket = {
      connect: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    mockUdpSocket = {
      bind: jest.fn(),
      close: jest.fn(),
      setBroadcast: jest.fn(),
      send: jest.fn(),
      on: jest.fn()
    };

    mockNetworkInterfaces = {
      'eth0': [{
        family: 'IPv4',
        address: '192.168.1.100',
        internal: false
      }],
      'lo': [{
        family: 'IPv4',
        address: '127.0.0.1',
        internal: true
      }]
    };

    // Mock网络接口
    const { Socket } = require('net');
    const { createSocket } = require('dgram');
    const { networkInterfaces } = require('os');

    Socket.prototype.connect = mockSocket.connect;
    Socket.prototype.write = mockSocket.write;
    Socket.prototype.end = mockSocket.end;
    Socket.prototype.destroy = mockSocket.destroy;
    Socket.prototype.on = mockSocket.on;

    createSocket.mockReturnValue(mockUdpSocket);
    networkInterfaces.mockReturnValue(mockNetworkInterfaces);

    // Mock VersionValidator
    VersionValidator.getVersion = jest.fn().mockReturnValue({ isValid: true });

    wifiDiscovery = new WiFiDeviceDiscovery();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化WiFiDeviceDiscovery实例', () => {
      expect(wifiDiscovery).toBeInstanceOf(WiFiDeviceDiscovery);
      expect(wifiDiscovery.isScanInProgress()).toBe(false);
      expect(wifiDiscovery.getCachedDevices()).toEqual([]);
    });

    it('应该有正确的默认配置', () => {
      // 通过调用接口验证默认配置
      expect(wifiDiscovery.isScanInProgress()).toBe(false);
    });
  });

  describe('scanForDevices - 设备扫描主流程', () => {
    it('应该成功扫描设备并返回结果', async () => {
      // Mock网络接口返回
      const { networkInterfaces } = require('os');
      networkInterfaces.mockReturnValue(mockNetworkInterfaces);

      // Mock UDP广播发现
      mockUdpSocket.bind.mockImplementation((callback) => {
        if (callback) callback();
      });

      // Mock端口检查成功
      const originalIsPortOpen = wifiDiscovery['isPortOpen'];
      wifiDiscovery['isPortOpen'] = jest.fn().mockResolvedValue(true);

      // Mock设备验证成功
      const mockDevice: WiFiDeviceInfo = {
        ipAddress: '192.168.1.10',
        port: 4045,
        version: '1.0.0',
        deviceName: 'Pico Logic Analyzer',
        responseTime: 50,
        deviceType: 'Pico Logic Analyzer',
        lastSeen: new Date(),
        isOnline: true
      };
      wifiDiscovery['verifyPicoDevice'] = jest.fn().mockResolvedValue(mockDevice);

      const result = await wifiDiscovery.scanForDevices();

      expect(result).toMatchObject({
        status: 'completed',
        devices: expect.any(Array),
        scanDuration: expect.any(Number),
        ipRange: expect.any(String),
        ports: expect.any(Array)
      });
      expect(result.scanDuration).toBeGreaterThan(0);
    });

    it('应该正确处理并发扫描限制', async () => {
      const config: Partial<ScanConfiguration> = {
        concurrency: 2,
        ports: [4045],
        timeout: 1000
      };

      // Mock端口检查
      wifiDiscovery['isPortOpen'] = jest.fn().mockResolvedValue(false);

      const result = await wifiDiscovery.scanForDevices(config);

      expect(result.status).toBe('completed');
      expect(result.ports).toEqual([4045]);
    });

    it('应该在扫描进行中时抛出错误', async () => {
      // 设置扫描状态为进行中
      wifiDiscovery['isScanning'] = true;

      await expect(wifiDiscovery.scanForDevices()).rejects.toThrow('设备扫描正在进行中，请等待完成');
    });

    it('应该正确处理扫描错误', async () => {
      // Mock网络接口抛出错误
      const { networkInterfaces } = require('os');
      networkInterfaces.mockImplementation(() => {
        throw new Error('Network interface error');
      });

      const result = await wifiDiscovery.scanForDevices();

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network interface error');
      expect(result.devices).toEqual([]);
    });
  });

  describe('performBroadcastDiscovery - UDP广播发现', () => {
    it('应该正确处理UDP广播发现', async () => {
      const config: ScanConfiguration = {
        timeout: 1000,
        concurrency: 10,
        ports: [4045],
        deepScan: false,
        enableBroadcast: true
      };

      // Mock UDP socket行为
      let messageHandler: Function;
      mockUdpSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      mockUdpSocket.bind.mockImplementation((callback) => {
        if (callback) {
          callback();
          // 模拟接收到广播响应
          setTimeout(() => {
            const mockResponse = JSON.stringify({
              device_type: 'pico-logic-analyzer',
              port: 4045,
              version: '1.0.0',
              name: 'Test Device',
              serial: 'TEST123'
            });
            messageHandler(Buffer.from(mockResponse), { address: '192.168.1.10' });
          }, 100);
        }
      });

      const result = await wifiDiscovery['performBroadcastDiscovery'](config);

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          ipAddress: '192.168.1.10',
          port: 4045,
          deviceType: 'Pico Logic Analyzer'
        })
      ]));
    });

    it('应该正确处理无效的广播消息', async () => {
      const config: ScanConfiguration = {
        timeout: 500,
        concurrency: 10,
        ports: [4045],
        deepScan: false,
        enableBroadcast: true
      };

      let messageHandler: Function;
      mockUdpSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      mockUdpSocket.bind.mockImplementation((callback) => {
        if (callback) {
          callback();
          // 发送无效JSON消息
          setTimeout(() => {
            messageHandler(Buffer.from('invalid json'), { address: '192.168.1.10' });
          }, 100);
        }
      });

      const result = await wifiDiscovery['performBroadcastDiscovery'](config);

      expect(result).toEqual([]);
    });

    it('应该正确处理UDP错误', async () => {
      const config: ScanConfiguration = {
        timeout: 1000,
        concurrency: 10,
        ports: [4045],
        deepScan: false,
        enableBroadcast: true
      };

      let errorHandler: Function;
      mockUdpSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      mockUdpSocket.bind.mockImplementation((callback) => {
        if (callback) {
          callback();
          // 模拟UDP错误
          setTimeout(() => {
            errorHandler(new Error('UDP error'));
          }, 100);
        }
      });

      const result = await wifiDiscovery['performBroadcastDiscovery'](config);

      expect(result).toEqual([]);
    });
  });

  describe('isPortOpen - 端口开放检查', () => {
    it('应该正确检测开放的端口', async () => {
      // Mock成功连接
      mockSocket.connect.mockImplementation((port, ip, callback) => {
        setTimeout(callback, 10);
      });

      const result = await wifiDiscovery['isPortOpen']('192.168.1.10', 4045, 1000);

      expect(result).toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(4045, '192.168.1.10', expect.any(Function));
      expect(mockSocket.end).toHaveBeenCalled();
    });

    it('应该正确检测关闭的端口', async () => {
      // Mock连接错误
      let errorHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      mockSocket.connect.mockImplementation((port, ip, callback) => {
        setTimeout(() => {
          errorHandler(new Error('Connection refused'));
        }, 10);
      });

      const result = await wifiDiscovery['isPortOpen']('192.168.1.10', 4045, 1000);

      expect(result).toBe(false);
    });

    it('应该正确处理连接超时', async () => {
      // Mock连接超时（不调用callback）
      mockSocket.connect.mockImplementation(() => {
        // 不调用callback，模拟超时
      });

      const result = await wifiDiscovery['isPortOpen']('192.168.1.10', 4045, 100);

      expect(result).toBe(false);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('verifyPicoDevice - Pico设备验证', () => {
    it('应该正确验证Pico设备', async () => {
      // Mock成功连接
      mockSocket.connect.mockImplementation((port, ip, callback) => {
        setTimeout(callback, 10);
      });

      // Mock数据接收
      let dataHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      // Mock OutputPacket
      const mockPacket = {
        serialize: jest.fn().mockReturnValue(Buffer.from([1, 2, 3])),
        addByte: jest.fn()
      };
      (OutputPacket as any) = jest.fn().mockImplementation(() => mockPacket);

      const promise = wifiDiscovery['verifyPicoDevice']('192.168.1.10', 4045, 1000);

      // 模拟设备响应
      setTimeout(() => {
        const deviceResponse = '1.0.0\nFREQ:1000000\nBLASTFREQ:2000000\nBUFFER:8192\nCHANNELS:8\n';
        dataHandler(Buffer.from(deviceResponse));
      }, 20);

      const result = await promise;

      expect(result).toMatchObject({
        ipAddress: '192.168.1.10',
        port: 4045,
        version: '1.0.0',
        deviceName: 'Pico Logic Analyzer (1.0.0)',
        deviceType: 'Pico Logic Analyzer'
      });
    });

    it('应该正确处理无效设备响应', async () => {
      mockSocket.connect.mockImplementation((port, ip, callback) => {
        setTimeout(callback, 10);
      });

      let dataHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          dataHandler = handler;
        }
      });

      const promise = wifiDiscovery['verifyPicoDevice']('192.168.1.10', 4045, 1000);

      // 发送无效响应
      setTimeout(() => {
        dataHandler(Buffer.from('invalid response'));
      }, 20);

      const result = await promise;

      expect(result).toBe(null);
    });

    it('应该正确处理连接错误', async () => {
      let errorHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      mockSocket.connect.mockImplementation(() => {
        setTimeout(() => {
          errorHandler(new Error('Connection failed'));
        }, 10);
      });

      const result = await wifiDiscovery['verifyPicoDevice']('192.168.1.10', 4045, 1000);

      expect(result).toBe(null);
    });
  });

  describe('parseDeviceResponse - 设备响应解析', () => {
    it('应该正确解析有效的设备响应', () => {
      const lines = [
        '1.0.0',
        'FREQ:1000000',
        'BLASTFREQ:2000000', 
        'BUFFER:8192',
        'CHANNELS:8'
      ];

      const result = wifiDiscovery['parseDeviceResponse']('192.168.1.10', 4045, lines);

      expect(result).toMatchObject({
        ipAddress: '192.168.1.10',
        port: 4045,
        version: '1.0.0',
        deviceName: 'Pico Logic Analyzer (1.0.0)',
        deviceType: 'Pico Logic Analyzer'
      });
    });

    it('应该拒绝行数不足的响应', () => {
      const lines = ['1.0.0', 'FREQ:1000000'];

      const result = wifiDiscovery['parseDeviceResponse']('192.168.1.10', 4045, lines);

      expect(result).toBe(null);
    });

    it('应该拒绝格式错误的响应', () => {
      const lines = [
        '1.0.0',
        'INVALID:format',
        'BLASTFREQ:2000000',
        'BUFFER:8192', 
        'CHANNELS:8'
      ];

      const result = wifiDiscovery['parseDeviceResponse']('192.168.1.10', 4045, lines);

      expect(result).toBe(null);
    });

    it('应该拒绝无效版本的设备', () => {
      VersionValidator.getVersion = jest.fn().mockReturnValue({ isValid: false });

      const lines = [
        'invalid.version',
        'FREQ:1000000',
        'BLASTFREQ:2000000',
        'BUFFER:8192',
        'CHANNELS:8'
      ];

      const result = wifiDiscovery['parseDeviceResponse']('192.168.1.10', 4045, lines);

      expect(result).toBe(null);
    });
  });

  describe('getLocalNetworkRanges - 本地网络范围获取', () => {
    it('应该正确解析网络接口', () => {
      const result = wifiDiscovery['getLocalNetworkRanges']();

      expect(result).toEqual(['192.168.1.1-254']);
    });

    it('应该过滤内部接口', () => {
      const { networkInterfaces } = require('os');
      networkInterfaces.mockReturnValue({
        'lo': [{
          family: 'IPv4',
          address: '127.0.0.1',
          internal: true
        }]
      });

      const result = wifiDiscovery['getLocalNetworkRanges']();

      // 应该返回默认的私有网络范围
      expect(result).toEqual(['192.168.1.1-254', '192.168.0.1-254', '10.0.0.1-254']);
    });

    it('应该处理多个网络接口', () => {
      const { networkInterfaces } = require('os');
      networkInterfaces.mockReturnValue({
        'eth0': [{
          family: 'IPv4',
          address: '192.168.1.100',
          internal: false
        }],
        'wlan0': [{
          family: 'IPv4', 
          address: '10.0.0.100',
          internal: false
        }]
      });

      const result = wifiDiscovery['getLocalNetworkRanges']();

      expect(result).toEqual(['192.168.1.1-254', '10.0.0.1-254']);
    });
  });

  describe('generateIPList - IP地址列表生成', () => {
    it('应该正确生成IP范围', () => {
      const result = wifiDiscovery['generateIPList']('192.168.1.1-3');

      expect(result).toEqual(['192.168.1.1', '192.168.1.2', '192.168.1.3']);
    });

    it('应该处理单个IP地址', () => {
      const result = wifiDiscovery['generateIPList']('192.168.1.100');

      expect(result).toEqual(['192.168.1.100']);
    });

    it('应该处理较大的IP范围', () => {
      const result = wifiDiscovery['generateIPList']('10.0.0.1-5');

      expect(result).toEqual(['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4', '10.0.0.5']);
    });
  });

  describe('设备缓存管理', () => {
    let mockDevices: WiFiDeviceInfo[];

    beforeEach(() => {
      mockDevices = [
        {
          ipAddress: '192.168.1.10',
          port: 4045,
          version: '1.0.0',
          deviceName: 'Device 1',
          responseTime: 50,
          deviceType: 'Pico Logic Analyzer',
          lastSeen: new Date(),
          isOnline: true
        },
        {
          ipAddress: '192.168.1.11',
          port: 4045,
          version: '1.0.1', 
          deviceName: 'Device 2',
          responseTime: 75,
          deviceType: 'Pico Logic Analyzer',
          lastSeen: new Date(Date.now() - 400000), // 超过5分钟前
          isOnline: false
        }
      ];
    });

    it('updateDeviceCache - 应该正确更新设备缓存', () => {
      wifiDiscovery['updateDeviceCache'](mockDevices);

      const cached = wifiDiscovery.getCachedDevices();
      expect(cached).toHaveLength(1); // 旧设备应该被清理
      expect(cached[0].ipAddress).toBe('192.168.1.10');
    });

    it('getCachedDevices - 应该返回所有缓存设备', () => {
      wifiDiscovery['discoveredDevices'].set('192.168.1.10:4045', mockDevices[0]);

      const result = wifiDiscovery.getCachedDevices();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDevices[0]);
    });

    it('getOnlineDevices - 应该只返回在线设备', () => {
      wifiDiscovery['discoveredDevices'].set('192.168.1.10:4045', mockDevices[0]);
      wifiDiscovery['discoveredDevices'].set('192.168.1.11:4045', mockDevices[1]);

      const result = wifiDiscovery.getOnlineDevices();

      expect(result).toHaveLength(1);
      expect(result[0].isOnline).toBe(true);
    });

    it('clearCache - 应该清除所有缓存', () => {
      wifiDiscovery['discoveredDevices'].set('192.168.1.10:4045', mockDevices[0]);

      wifiDiscovery.clearCache();

      expect(wifiDiscovery.getCachedDevices()).toHaveLength(0);
    });
  });

  describe('扫描控制', () => {
    it('stopScan - 应该正确停止扫描', () => {
      wifiDiscovery['isScanning'] = true;
      wifiDiscovery['scanAbortController'] = new AbortController();

      wifiDiscovery.stopScan();

      expect(wifiDiscovery.isScanInProgress()).toBe(false);
    });

    it('stopScan - 如果没有进行扫描则无操作', () => {
      wifiDiscovery['isScanning'] = false;

      wifiDiscovery.stopScan();

      expect(wifiDiscovery.isScanInProgress()).toBe(false);
    });

    it('isScanInProgress - 应该正确返回扫描状态', () => {
      expect(wifiDiscovery.isScanInProgress()).toBe(false);

      wifiDiscovery['isScanning'] = true;
      expect(wifiDiscovery.isScanInProgress()).toBe(true);
    });
  });

  describe('refreshDevice - 设备状态刷新', () => {
    it('应该成功刷新设备状态', async () => {
      const mockDevice: WiFiDeviceInfo = {
        ipAddress: '192.168.1.10',
        port: 4045,
        version: '1.0.0',
        deviceName: 'Refreshed Device',
        responseTime: 60,
        deviceType: 'Pico Logic Analyzer',
        lastSeen: new Date(),
        isOnline: true
      };

      wifiDiscovery['verifyPicoDevice'] = jest.fn().mockResolvedValue(mockDevice);

      const result = await wifiDiscovery.refreshDevice('192.168.1.10', 4045);

      expect(result).toEqual(mockDevice);
      expect(wifiDiscovery.getCachedDevices()).toContain(mockDevice);
    });

    it('应该正确处理刷新失败', async () => {
      wifiDiscovery['verifyPicoDevice'] = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await wifiDiscovery.refreshDevice('192.168.1.10', 4045);

      expect(result).toBe(null);
    });
  });

  describe('集成测试场景', () => {
    it('应该完成完整的设备发现流程', async () => {
      // Mock网络环境
      const { networkInterfaces } = require('os');
      networkInterfaces.mockReturnValue({
        'eth0': [{
          family: 'IPv4',
          address: '192.168.1.100',
          internal: false
        }]
      });

      // Mock成功的端口扫描
      wifiDiscovery['isPortOpen'] = jest.fn()
        .mockResolvedValueOnce(false) // 192.168.1.1:4045
        .mockResolvedValueOnce(true); // 192.168.1.2:4045

      // Mock成功的设备验证
      const mockDevice: WiFiDeviceInfo = {
        ipAddress: '192.168.1.2',
        port: 4045,
        version: '1.0.0',
        deviceName: 'Test Pico Device',
        responseTime: 45,
        deviceType: 'Pico Logic Analyzer',
        lastSeen: new Date(),
        isOnline: true
      };
      wifiDiscovery['verifyPicoDevice'] = jest.fn().mockResolvedValue(mockDevice);

      // Mock UDP广播（无设备响应）
      mockUdpSocket.bind.mockImplementation((callback) => {
        if (callback) callback();
      });

      const config: Partial<ScanConfiguration> = {
        enableBroadcast: true,
        deepScan: true,
        concurrency: 2,
        timeout: 1000
      };

      const result = await wifiDiscovery.scanForDevices(config);

      expect(result.status).toBe('completed');
      expect(result.devices).toHaveLength(1);
      expect(result.devices[0]).toMatchObject(mockDevice);
      expect(wifiDiscovery.getCachedDevices()).toHaveLength(1);
      expect(wifiDiscovery.getOnlineDevices()).toHaveLength(1);
    });

    it('应该正确处理网络错误的混合场景', async () => {
      // Mock部分网络操作失败
      wifiDiscovery['isPortOpen'] = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(true);

      wifiDiscovery['verifyPicoDevice'] = jest.fn()
        .mockResolvedValueOnce(null); // 验证失败

      const result = await wifiDiscovery.scanForDevices({
        enableBroadcast: false,
        deepScan: true
      });

      expect(result.status).toBe('completed');
      expect(result.devices).toHaveLength(0);
    });
  });

  describe('性能和边界测试', () => {
    it('应该处理大量IP扫描而不超时', async () => {
      const config: Partial<ScanConfiguration> = {
        concurrency: 100,
        timeout: 100,
        enableBroadcast: false,
        deepScan: false
      };

      // Mock所有端口都关闭
      wifiDiscovery['isPortOpen'] = jest.fn().mockResolvedValue(false);

      const startTime = Date.now();
      const result = await wifiDiscovery.scanForDevices(config);
      const duration = Date.now() - startTime;

      expect(result.status).toBe('completed');
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该正确处理空网络接口', async () => {
      const { networkInterfaces } = require('os');
      networkInterfaces.mockReturnValue({});

      // Mock端口检查为快速失败
      wifiDiscovery['isPortOpen'] = jest.fn().mockResolvedValue(false);

      const result = await wifiDiscovery.scanForDevices({
        enableBroadcast: false,
        timeout: 100
      });

      expect(result.status).toBe('completed');
      expect(result.ipRange).toContain('192.168.1.1-254'); // 使用默认范围
    }, 15000);

    it('应该正确处理异常的IP范围格式', () => {
      // 'invalid-range' 包含 '-' but 'invalid' 分割后不是4部分，返回空数组
      const result1 = wifiDiscovery['generateIPList']('invalid-range');
      expect(result1).toEqual([]);

      // '192.168.1' 不包含 '-'，直接返回单个IP
      const result2 = wifiDiscovery['generateIPList']('192.168.1');
      expect(result2).toEqual(['192.168.1']);

      // 测试无效格式但包含连字符的情况
      const result3 = wifiDiscovery['generateIPList']('not.valid.ip-format');
      expect(result3).toEqual([]); // 因为 'not.valid.ip' 只有3部分
    });
  });
});