/**
 * HardwareDriverManager 高覆盖率测试
 * 目标：实现90%+覆盖率，真正测试类的核心功能
 */

import { EventEmitter } from 'events';

// Mock模块依赖
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn()
  }
}));

jest.mock('net', () => ({
  Socket: jest.fn(() => ({
    setTimeout: jest.fn(),
    connect: jest.fn(),
    destroy: jest.fn(),
    write: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock驱动类
class MockAnalyzerDriverBase extends EventEmitter {
  constructor(public connectionString: string) {
    super();
  }

  async connect(params?: any) {
    return {
      success: true,
      deviceInfo: {
        name: 'Mock Device',
        channels: 8,
        maxSampleRate: 100000000
      }
    };
  }

  async disconnect() {
    return Promise.resolve();
  }

  async startCapture() {
    return Promise.resolve();
  }

  getDeviceInfo() {
    return {
      name: 'Mock Device',
      channels: 8,
      maxSampleRate: 100000000
    };
  }
}

// Mock具体驱动类
class MockLogicAnalyzerDriver extends MockAnalyzerDriverBase {}
class MockSaleaeLogicDriver extends MockAnalyzerDriverBase {}
class MockRigolSiglentDriver extends MockAnalyzerDriverBase {}
class MockSigrokAdapter extends MockAnalyzerDriverBase {
  static getSupportedDevices() {
    return [
      { driver: 'fx2lafw', name: 'FX2 Logic Analyzer', channels: 8, maxRate: 24000000 },
      { driver: 'hantek-dso', name: 'Hantek DSO', channels: 2, maxRate: 1000000 }
    ];
  }
}
class MockNetworkLogicAnalyzerDriver extends MockAnalyzerDriverBase {}
class MockMultiAnalyzerDriver extends MockAnalyzerDriverBase {
  constructor(public connectionStrings: string[]) {
    super(connectionStrings.join(','));
  }
}

// 直接导入 HardwareDriverManager
import { HardwareDriverManager } from '../../../src/drivers/HardwareDriverManager';

describe('HardwareDriverManager 高覆盖率测试', () => {
  beforeAll(async () => {
    // Mock设置已在文件顶部完成
    
    // Mock驱动类到全局
    (global as any).LogicAnalyzerDriver = MockLogicAnalyzerDriver;
    (global as any).SaleaeLogicDriver = MockSaleaeLogicDriver;
    (global as any).RigolSiglentDriver = MockRigolSiglentDriver;
    (global as any).SigrokAdapter = MockSigrokAdapter;
    (global as any).NetworkLogicAnalyzerDriver = MockNetworkLogicAnalyzerDriver;
    (global as any).MultiAnalyzerDriver = MockMultiAnalyzerDriver;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // 重置SerialPort mock
    const { SerialPort } = require('serialport');
    SerialPort.list.mockResolvedValue([
      {
        path: '/dev/ttyUSB0',
        vendorId: '2E8A',
        productId: '0003',
        manufacturer: 'Pico'
      },
      {
        path: '/dev/ttyUSB1',
        vendorId: '1234',
        productId: '5678',
        manufacturer: 'Other'
      }
    ]);
  });

  describe('构造函数和初始化', () => {
    it('应该能创建HardwareDriverManager实例', () => {
      const manager = new HardwareDriverManager();
      expect(manager).toBeInstanceOf(HardwareDriverManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('应该初始化内置驱动', () => {
      const manager = new HardwareDriverManager();
      const drivers = manager.getRegisteredDrivers();
      
      expect(drivers.length).toBeGreaterThan(0);
      
      // 验证Pico驱动（最高优先级）
      const picoDriver = drivers.find(d => d.id === 'pico-logic-analyzer');
      expect(picoDriver).toBeDefined();
      expect(picoDriver?.name).toBe('Pico Logic Analyzer');
      expect(picoDriver?.priority).toBe(100);
      
      // 验证Saleae驱动
      const saleaeDriver = drivers.find(d => d.id === 'saleae-logic');
      expect(saleaeDriver).toBeDefined();
      expect(saleaeDriver?.priority).toBe(90);
      
      // 验证驱动按优先级排序
      for (let i = 1; i < drivers.length; i++) {
        expect(drivers[i-1].priority).toBeGreaterThanOrEqual(drivers[i].priority);
      }
    });

    it('应该正确初始化设备检测器', () => {
      const manager = new HardwareDriverManager();
      expect(manager).toBeDefined();
      // 通过检查是否有检测方法来验证检测器初始化
      expect(typeof manager.detectHardware).toBe('function');
    });
  });

  describe('驱动注册管理', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能注册新驱动', () => {
      const driverRegistration = {
        id: 'test-driver',
        name: 'Test Driver',
        description: 'A test driver',
        version: '1.0.0',
        driverClass: MockAnalyzerDriverBase,
        supportedDevices: ['test', 'mock'],
        priority: 50
      };

      const eventSpy = jest.spyOn(manager, 'emit');
      manager.registerDriver(driverRegistration);

      const drivers = manager.getRegisteredDrivers();
      const testDriver = drivers.find((d: any) => d.id === 'test-driver');
      
      expect(testDriver).toBeDefined();
      expect(testDriver.name).toBe('Test Driver');
      expect(eventSpy).toHaveBeenCalledWith('driverRegistered', driverRegistration);
    });

    it('应该能注销驱动', () => {
      // 先注册一个驱动
      const driverRegistration = {
        id: 'removable-driver',
        name: 'Removable Driver',
        description: 'A removable driver',
        version: '1.0.0',
        driverClass: MockAnalyzerDriverBase,
        supportedDevices: ['removable'],
        priority: 30
      };

      manager.registerDriver(driverRegistration);
      
      const eventSpy = jest.spyOn(manager, 'emit');
      const result = manager.unregisterDriver('removable-driver');

      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith('driverUnregistered', 'removable-driver');

      const drivers = manager.getRegisteredDrivers();
      const removedDriver = drivers.find((d: any) => d.id === 'removable-driver');
      expect(removedDriver).toBeUndefined();
    });

    it('注销不存在的驱动应该返回false', () => {
      const result = manager.unregisterDriver('non-existent-driver');
      expect(result).toBe(false);
    });

    it('getAvailableDrivers应该返回与getRegisteredDrivers相同的结果', () => {
      const registeredDrivers = manager.getRegisteredDrivers();
      const availableDrivers = manager.getAvailableDrivers();
      
      expect(availableDrivers).toEqual(registeredDrivers);
    });
  });

  describe('设备检测功能', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能检测硬件设备', async () => {
      const devices = await manager.detectHardware();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('应该支持缓存控制', async () => {
      // 第一次检测
      const devices1 = await manager.detectHardware(true);
      
      // 第二次检测应该使用缓存
      const devices2 = await manager.detectHardware(true);
      
      expect(devices1).toEqual(devices2);
    });

    it('应该能绕过缓存', async () => {
      // 强制绕过缓存
      const devices = await manager.detectHardware(false);
      expect(Array.isArray(devices)).toBe(true);
    });

    it('检测失败时应该返回空数组', async () => {
      // Mock一个失败的检测器
      const originalDetectors = (manager as any).detectors;
      (manager as any).detectors = [{
        name: 'Failing Detector',
        detect: jest.fn().mockRejectedValue(new Error('Detection failed'))
      }];

      const devices = await manager.detectHardware();
      expect(devices).toEqual([]);

      // 恢复原始检测器
      (manager as any).detectors = originalDetectors;
    });
  });

  describe('驱动匹配功能', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能精确匹配设备驱动', async () => {
      const device = {
        id: 'test-saleae',
        name: 'Saleae Logic 16',
        type: 'usb' as const,
        connectionString: 'localhost:10429',
        driverType: 0,
        confidence: 95
      };

      const driver = await manager.matchDriver(device);
      expect(driver).toBeDefined();
      expect(driver.id).toBe('saleae-logic');
    });

    it('应该能通用匹配串口设备', async () => {
      const device = {
        id: 'generic-serial',
        name: 'Generic Serial Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 60
      };

      const driver = await manager.matchDriver(device);
      expect(driver).toBeDefined();
      expect(['pico-logic-analyzer', 'sigrok-adapter']).toContain(driver.id);
    });

    it('应该能通用匹配网络设备', async () => {
      const device = {
        id: 'generic-network',
        name: 'Generic Network Device',
        type: 'network' as const,
        connectionString: '192.168.1.100:8080',
        driverType: 1,
        confidence: 60
      };

      const driver = await manager.matchDriver(device);
      expect(driver).toBeDefined();
      expect(['saleae-logic', 'rigol-siglent', 'network-analyzer']).toContain(driver.id);
    });

    it('无法匹配的设备应该返回null', async () => {
      const device = {
        id: 'unmatchable-device',
        name: 'Unmatchable Device',
        type: 'unknown' as any,
        connectionString: 'unknown:connection',
        driverType: 99,
        confidence: 10
      };

      const driver = await manager.matchDriver(device);
      expect(driver).toBeNull();
    });
  });

  describe('驱动创建功能', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能创建标准驱动实例', async () => {
      const device = {
        id: 'test-pico',
        name: 'Pico Logic Analyzer',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 90
      };

      const eventSpy = jest.spyOn(manager, 'emit');
      const driver = await manager.createDriver(device);

      expect(driver).toBeDefined();
      expect(driver.connectionString).toBe('/dev/ttyUSB0');
      expect(eventSpy).toHaveBeenCalledWith('driverCreated', expect.objectContaining({
        device,
        driver
      }));
    });

    it('应该能创建网络驱动实例', async () => {
      const device = {
        id: 'test-network',
        name: 'Network Logic Analyzer',
        type: 'network' as const,
        connectionString: '192.168.1.100:24000',
        driverType: 1,
        confidence: 80
      };

      const driver = await manager.createDriver(device);
      expect(driver).toBeDefined();
    });

    it('应该能创建Sigrok适配器实例', async () => {
      const device = {
        id: 'test-sigrok',
        name: 'FX2 Logic Analyzer',
        type: 'usb' as const,
        connectionString: 'fx2lafw:conn=1.2.3',
        driverType: 0,
        confidence: 85
      };

      const driver = await manager.createDriver(device);
      expect(driver).toBeDefined();
    });

    it('无法匹配驱动时应该抛出错误', async () => {
      const device = {
        id: 'unmatchable',
        name: 'Unmatchable Device',
        type: 'unknown' as any,
        connectionString: 'unknown',
        driverType: 99,
        confidence: 10
      };

      await expect(manager.createDriver(device)).rejects.toThrow(
        'No suitable driver found for device: Unmatchable Device'
      );
    });
  });

  describe('自动连接功能', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('没有设备时应该抛出错误', async () => {
      // Mock空的检测结果
      jest.spyOn(manager, 'detectHardware').mockResolvedValue([]);

      await expect(manager.autoConnect()).rejects.toThrow('No compatible devices found');
    });

    it('应该尝试连接置信度最高的设备', async () => {
      const devices = [
        {
          id: 'device1',
          name: 'Device 1',
          type: 'serial' as const,
          connectionString: '/dev/ttyUSB0',
          driverType: 0,
          confidence: 80
        },
        {
          id: 'device2',
          name: 'Device 2',  
          type: 'serial' as const,
          connectionString: '/dev/ttyUSB1',
          driverType: 0,
          confidence: 95
        }
      ];

      jest.spyOn(manager, 'detectHardware').mockResolvedValue(devices);

      const driver = await manager.autoConnect();
      expect(driver).toBeDefined();
    });
  });

  describe('多设备驱动功能', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能创建多设备驱动', () => {
      const connectionStrings = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2'];
      
      const eventSpy = jest.spyOn(manager, 'emit');
      const multiDriver = manager.createMultiDeviceDriver(connectionStrings);

      expect(multiDriver).toBeDefined();
      expect(multiDriver.connectionStrings).toEqual(connectionStrings);
      expect(eventSpy).toHaveBeenCalledWith('multiDriverCreated', expect.objectContaining({
        connectionStrings,
        driver: multiDriver
      }));
    });

    it('连接字符串数量不正确时应该抛出错误', () => {
      expect(() => manager.createMultiDeviceDriver(['/dev/ttyUSB0'])).toThrow(
        '多设备驱动需要2-5个连接字符串'
      );

      expect(() => manager.createMultiDeviceDriver(Array(6).fill('/dev/ttyUSB0'))).toThrow(
        '多设备驱动需要2-5个连接字符串'
      );
    });
  });

  describe('Sigrok设备支持', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能获取支持的Sigrok设备列表', () => {
      const devices = manager.getSupportedSigrokDevices();
      
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      
      devices.forEach((device: any) => {
        expect(device).toHaveProperty('driver');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('channels');
        expect(device).toHaveProperty('maxRate');
        expect(typeof device.channels).toBe('number');
        expect(typeof device.maxRate).toBe('number');
      });
    });
  });

  describe('设备连接管理', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能连接到指定设备', async () => {
      const mockDevices = [{
        id: 'test-device',
        name: 'Test Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 90
      }];

      jest.spyOn(manager, 'detectHardware').mockResolvedValue(mockDevices);

      const result = await manager.connectToDevice('test-device');
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(manager.isDeviceConnected()).toBe(true);
      expect(manager.getCurrentDevice()).toBeDefined();
      expect(manager.getCurrentDeviceInfo()).toBeDefined();
    });

    it('应该能自动检测并连接设备', async () => {
      const mockDevices = [{
        id: 'auto-device',
        name: 'Auto Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 95
      }];

      jest.spyOn(manager, 'detectHardware').mockResolvedValue(mockDevices);

      const result = await manager.connectToDevice('autodetect');
      
      expect(result.success).toBe(true);
    });

    it('应该能连接网络设备', async () => {
      const networkConfig = { host: '192.168.1.100', port: 24000 };
      
      const result = await manager.connectToDevice('network', { networkConfig });
      
      expect(result.success).toBe(true);
    });

    it('设备不存在时应该返回错误', async () => {
      jest.spyOn(manager, 'detectHardware').mockResolvedValue([]);

      const result = await manager.connectToDevice('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该能断开当前设备连接', async () => {
      // 先连接一个设备
      const mockDevices = [{
        id: 'disconnect-test',
        name: 'Disconnect Test',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 90
      }];

      jest.spyOn(manager, 'detectHardware').mockResolvedValue(mockDevices);
      await manager.connectToDevice('disconnect-test');

      const eventSpy = jest.spyOn(manager, 'emit');
      
      // 断开连接
      await manager.disconnectCurrentDevice();
      
      expect(manager.isDeviceConnected()).toBe(false);
      expect(manager.getCurrentDevice()).toBeNull();
      expect(manager.getCurrentDeviceInfo()).toBeNull();
      expect(eventSpy).toHaveBeenCalledWith('deviceDisconnected', expect.any(Object));
    });

    it('应该能获取所有活动连接', async () => {
      const connections = manager.getActiveConnections();
      expect(connections).toBeInstanceOf(Map);
    });
  });

  describe('资源管理', () => {
    let manager: any;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    it('应该能正确清理资源', async () => {
      // 模拟一些活动连接
      const mockDriver = new MockAnalyzerDriverBase('/dev/ttyUSB0');
      (manager as any).activeConnections.set('test', mockDriver);
      (manager as any).currentDevice = mockDriver;

      const disconnectSpy = jest.spyOn(mockDriver, 'disconnect').mockResolvedValue();
      
      await manager.dispose();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(manager.getActiveConnections().size).toBe(0);
      expect(manager.getCurrentDevice()).toBeNull();
    });

    it('dispose方法应该处理断开连接失败的情况', async () => {
      const mockDriver = new MockAnalyzerDriverBase('/dev/ttyUSB0');
      (manager as any).activeConnections.set('test', mockDriver);

      jest.spyOn(mockDriver, 'disconnect').mockRejectedValue(new Error('Disconnect failed'));
      
      // 应该不抛出错误
      await expect(manager.dispose()).resolves.not.toThrow();
    });
  });

});