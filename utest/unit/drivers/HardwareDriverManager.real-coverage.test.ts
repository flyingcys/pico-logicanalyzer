/**
 * HardwareDriverManager 真实覆盖率测试
 * 绕过Mock映射，测试真实源代码
 */

// 直接导入真实模块，使用相对路径避开Jest的模块映射
const DriverManagerModule = require('../../../src/drivers/HardwareDriverManager.ts');

import { EventEmitter } from 'events';

// Mock外部依赖，但保留核心逻辑
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn().mockResolvedValue([
      {
        path: '/dev/ttyUSB0',
        vendorId: '2E8A',
        productId: '0003',
        manufacturer: 'Pico'
      }
    ])
  }
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    setTimeout: jest.fn(),
    connect: jest.fn((port, host, callback) => {
      // 模拟成功连接
      setTimeout(callback, 10);
    }),
    destroy: jest.fn(),
    write: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'data') {
        // 模拟设备响应
        setTimeout(() => callback(Buffer.from('RIGOL,DS1054Z')), 20);
      }
    })
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn().mockImplementation((command, args) => {
    const mockProcess = new EventEmitter();
    (mockProcess as any).stdout = new EventEmitter();
    
    if (command === 'sigrok-cli') {
      if (args?.includes('--version')) {
        setTimeout(() => mockProcess.emit('close', 0), 10);
      } else if (args?.includes('--scan')) {
        setTimeout(() => {
          (mockProcess as any).stdout.emit('data', Buffer.from(
            'fx2lafw:conn=1.2.3 - Saleae Logic\\nhantek-dso:conn=usb - Hantek DSO\\n'
          ));
          mockProcess.emit('close', 0);
        }, 10);
      }
    }
    
    return mockProcess;
  })
}));

// Mock驱动基类
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

  getDeviceInfo() {
    return {
      name: 'Mock Device',
      channels: 8,
      maxSampleRate: 100000000
    };
  }
}

// Mock具体驱动类并注入到require缓存
const mockDrivers = {
  LogicAnalyzerDriver: MockAnalyzerDriverBase,
  SaleaeLogicDriver: MockAnalyzerDriverBase,
  RigolSiglentDriver: MockAnalyzerDriverBase,
  SigrokAdapter: class extends MockAnalyzerDriverBase {
    static getSupportedDevices() {
      return [
        { driver: 'fx2lafw', name: 'FX2 Logic Analyzer', channels: 8, maxRate: 24000000 }
      ];
    }
  },
  NetworkLogicAnalyzerDriver: MockAnalyzerDriverBase,
  MultiAnalyzerDriver: class extends MockAnalyzerDriverBase {
    constructor(public connectionStrings: string[]) {
      super(connectionStrings.join(','));
    }
  }
};

// 将Mock驱动注入到require缓存中
Object.keys(mockDrivers).forEach(driverName => {
  const modulePath = require.resolve(`../../../src/drivers/${driverName}.ts`);
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    parent: null,
    children: [],
    exports: mockDrivers[driverName],
    paths: []
  } as any;
});

describe('HardwareDriverManager 真实覆盖率测试', () => {
  let HardwareDriverManager: any;
  let manager: any;

  beforeAll(async () => {
    // 清除模块缓存，强制重新加载
    const managerPath = require.resolve('../../../src/drivers/HardwareDriverManager.ts');
    delete require.cache[managerPath];
    
    // 重新导入模块
    const module = require('../../../src/drivers/HardwareDriverManager.ts');
    HardwareDriverManager = module.HardwareDriverManager;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (HardwareDriverManager) {
      manager = new HardwareDriverManager();
    }
  });

  afterEach(async () => {
    if (manager && typeof manager.dispose === 'function') {
      await manager.dispose();
    }
  });

  describe('基础功能测试', () => {
    it('应该能创建HardwareDriverManager实例', () => {
      expect(HardwareDriverManager).toBeDefined();
      expect(typeof HardwareDriverManager).toBe('function');
      
      const instance = new HardwareDriverManager();
      expect(instance).toBeInstanceOf(HardwareDriverManager);
      expect(instance).toBeInstanceOf(EventEmitter);
    });

    it('应该初始化内置驱动', () => {
      const instance = new HardwareDriverManager();
      const drivers = instance.getRegisteredDrivers();
      
      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeGreaterThan(0);
      
      // 检查是否包含预期的驱动
      const driverIds = drivers.map((d: any) => d.id);
      expect(driverIds).toContain('pico-logic-analyzer');
      expect(driverIds).toContain('saleae-logic');
      expect(driverIds).toContain('rigol-siglent');
      expect(driverIds).toContain('sigrok-adapter');
      expect(driverIds).toContain('network-analyzer');
    });

    it('驱动应该按优先级排序', () => {
      const instance = new HardwareDriverManager();
      const drivers = instance.getRegisteredDrivers();
      
      for (let i = 1; i < drivers.length; i++) {
        expect(drivers[i-1].priority).toBeGreaterThanOrEqual(drivers[i].priority);
      }
      
      // 验证Pico驱动优先级最高
      expect(drivers[0].id).toBe('pico-logic-analyzer');
      expect(drivers[0].priority).toBe(100);
    });
  });

  describe('驱动注册管理', () => {
    it('应该能注册新驱动', () => {
      const instance = new HardwareDriverManager();
      const eventSpy = jest.spyOn(instance, 'emit');
      
      const driverRegistration = {
        id: 'test-driver',
        name: 'Test Driver',
        description: 'A test driver',
        version: '1.0.0',
        driverClass: MockAnalyzerDriverBase,
        supportedDevices: ['test'],
        priority: 50
      };

      instance.registerDriver(driverRegistration);

      const drivers = instance.getRegisteredDrivers();
      const testDriver = drivers.find((d: any) => d.id === 'test-driver');
      
      expect(testDriver).toBeDefined();
      expect(testDriver.name).toBe('Test Driver');
      expect(eventSpy).toHaveBeenCalledWith('driverRegistered', driverRegistration);
    });

    it('应该能注销驱动', () => {
      const instance = new HardwareDriverManager();
      const eventSpy = jest.spyOn(instance, 'emit');

      // 先注册一个驱动
      const driverReg = {
        id: 'removable-driver',
        name: 'Removable Driver',
        description: 'A removable driver',
        version: '1.0.0',
        driverClass: MockAnalyzerDriverBase,
        supportedDevices: ['removable'],
        priority: 30
      };
      
      instance.registerDriver(driverReg);
      
      // 注销驱动
      const result = instance.unregisterDriver('removable-driver');
      
      expect(result).toBe(true);
      expect(eventSpy).toHaveBeenCalledWith('driverUnregistered', 'removable-driver');
      
      const drivers = instance.getRegisteredDrivers();
      const removedDriver = drivers.find((d: any) => d.id === 'removable-driver');
      expect(removedDriver).toBeUndefined();
    });

    it('注销不存在的驱动应该返回false', () => {
      const instance = new HardwareDriverManager();
      const result = instance.unregisterDriver('non-existent');
      expect(result).toBe(false);
    });

    it('getAvailableDrivers应该返回相同结果', () => {
      const instance = new HardwareDriverManager();
      const registered = instance.getRegisteredDrivers();
      const available = instance.getAvailableDrivers();
      expect(available).toEqual(registered);
    });
  });

  describe('设备检测功能', () => {
    it('应该能检测硬件设备', async () => {
      const instance = new HardwareDriverManager();
      const devices = await instance.detectHardware();
      
      expect(Array.isArray(devices)).toBe(true);
      // 由于Mock设置，应该能检测到一些设备
    });

    it('应该支持缓存机制', async () => {
      const instance = new HardwareDriverManager();
      
      // 第一次检测
      const devices1 = await instance.detectHardware(true);
      
      // 第二次检测（使用缓存）
      const startTime = Date.now();
      const devices2 = await instance.detectHardware(true);
      const duration = Date.now() - startTime;
      
      expect(devices2).toEqual(devices1);
      // 缓存应该让第二次调用更快
      expect(duration).toBeLessThan(100);
    });

    it('应该能绕过缓存', async () => {
      const instance = new HardwareDriverManager();
      
      const devices = await instance.detectHardware(false);
      expect(Array.isArray(devices)).toBe(true);
    });
  });

  describe('驱动匹配功能', () => {
    it('应该能匹配Saleae设备', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'test-saleae',
        name: 'Saleae Logic 16',
        type: 'usb' as const,
        connectionString: 'localhost:10429',
        driverType: 0,
        confidence: 95
      };

      const driver = await instance.matchDriver(device);
      expect(driver).toBeDefined();
      expect(driver.id).toBe('saleae-logic');
    });

    it('应该能匹配Pico设备', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'test-pico',
        name: 'Pico Logic Analyzer',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 90
      };

      const driver = await instance.matchDriver(device);
      expect(driver).toBeDefined();
      expect(driver.id).toBe('pico-logic-analyzer');
    });

    it('应该通用匹配串口设备', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'generic-serial',
        name: 'Generic Serial Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB1',
        driverType: 0,
        confidence: 60
      };

      const driver = await instance.matchDriver(device);
      expect(driver).toBeDefined();
      expect(['pico-logic-analyzer', 'sigrok-adapter']).toContain(driver.id);
    });

    it('应该通用匹配网络设备', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'generic-network',
        name: 'Generic Network Device',
        type: 'network' as const,
        connectionString: '192.168.1.100:8080',
        driverType: 1,
        confidence: 60
      };

      const driver = await instance.matchDriver(device);
      expect(driver).toBeDefined();
      expect(['saleae-logic', 'rigol-siglent', 'network-analyzer']).toContain(driver.id);
    });

    it('无法匹配的设备应该返回null', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'unmatchable',
        name: 'Unmatchable Device',
        type: 'unknown' as any,
        connectionString: 'unknown',
        driverType: 99,
        confidence: 10
      };

      const driver = await instance.matchDriver(device);
      expect(driver).toBeNull();
    });
  });

  describe('驱动创建功能', () => {
    it('应该能创建标准驱动实例', async () => {
      const instance = new HardwareDriverManager();
      const eventSpy = jest.spyOn(instance, 'emit');
      
      const device = {
        id: 'test-pico',
        name: 'Pico Logic Analyzer',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 90
      };

      const driver = await instance.createDriver(device);
      
      expect(driver).toBeDefined();
      expect(driver.connectionString).toBe('/dev/ttyUSB0');
      expect(eventSpy).toHaveBeenCalledWith('driverCreated', expect.objectContaining({
        device,
        driver
      }));
    });

    it('应该能创建网络驱动实例', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'test-network',
        name: 'Network Logic Analyzer',
        type: 'network' as const,
        connectionString: '192.168.1.100:24000',
        driverType: 1,
        confidence: 80
      };

      const driver = await instance.createDriver(device);
      expect(driver).toBeDefined();
    });

    it('无法匹配驱动时应该抛出错误', async () => {
      const instance = new HardwareDriverManager();
      
      const device = {
        id: 'unmatchable',
        name: 'Unmatchable Device',
        type: 'unknown' as any,
        connectionString: 'unknown',
        driverType: 99,
        confidence: 10
      };

      await expect(instance.createDriver(device)).rejects.toThrow(
        'No suitable driver found for device: Unmatchable Device'
      );
    });
  });

  describe('多设备驱动功能', () => {
    it('应该能创建多设备驱动', () => {
      const instance = new HardwareDriverManager();
      const eventSpy = jest.spyOn(instance, 'emit');
      
      const connectionStrings = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2'];
      const multiDriver = instance.createMultiDeviceDriver(connectionStrings);

      expect(multiDriver).toBeDefined();
      expect(multiDriver.connectionString).toBe('/dev/ttyUSB0,/dev/ttyUSB1,/dev/ttyUSB2');
      expect(eventSpy).toHaveBeenCalledWith('multiDriverCreated', expect.objectContaining({
        connectionStrings,
        driver: multiDriver
      }));
    });

    it('连接字符串数量错误时应该抛出错误', () => {
      const instance = new HardwareDriverManager();
      
      expect(() => instance.createMultiDeviceDriver(['/dev/ttyUSB0'])).toThrow(
        '多设备驱动需要2-5个连接字符串'
      );
      
      expect(() => instance.createMultiDeviceDriver(Array(6).fill('/dev/ttyUSB0'))).toThrow(
        '多设备驱动需要2-5个连接字符串'
      );
    });
  });

  describe('Sigrok设备支持', () => {
    it('应该能获取支持的Sigrok设备列表', () => {
      const instance = new HardwareDriverManager();
      const devices = instance.getSupportedSigrokDevices();
      
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      
      devices.forEach((device: any) => {
        expect(device).toHaveProperty('driver');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('channels');
        expect(device).toHaveProperty('maxRate');
      });
    });
  });

  describe('资源管理', () => {
    it('应该能正确清理资源', async () => {
      const instance = new HardwareDriverManager();
      
      // 模拟一些活动连接 - 通过内部属性设置
      const mockDriver = new MockAnalyzerDriverBase('/dev/ttyUSB0');
      const disconnectSpy = jest.spyOn(mockDriver, 'disconnect');
      
      // 直接设置到内部的activeConnections属性
      (instance as any).activeConnections.set('test', mockDriver);
      (instance as any).currentDevice = mockDriver;
      
      await instance.dispose();
      
      expect(instance.getActiveConnections().size).toBe(0);
      expect(instance.getCurrentDevice()).toBeNull();
    });

    it('应该能获取活动连接', () => {
      const instance = new HardwareDriverManager();
      const connections = instance.getActiveConnections();
      
      expect(connections).toBeInstanceOf(Map);
    });

    it('应该能检查设备连接状态', () => {
      const instance = new HardwareDriverManager();
      
      expect(instance.isDeviceConnected()).toBe(false);
      expect(instance.getCurrentDevice()).toBeNull();
      expect(instance.getCurrentDeviceInfo()).toBeNull();
    });
  });

  describe('设备连接管理功能', () => {
    it('应该能连接到自动检测设备', async () => {
      const instance = new HardwareDriverManager();
      const mockDevices = [{
        id: 'auto-device',
        name: 'Auto Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyUSB0',
        driverType: 0,
        confidence: 95
      }];

      jest.spyOn(instance, 'detectHardware').mockResolvedValue(mockDevices);

      const result = await instance.connectToDevice('autodetect');
      
      expect(result.success).toBe(true);
      expect(instance.isDeviceConnected()).toBe(true);
    });

    it('autodetect无设备时应该返回错误', async () => {
      const instance = new HardwareDriverManager();
      jest.spyOn(instance, 'detectHardware').mockResolvedValue([]);

      const result = await instance.connectToDevice('autodetect');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('未检测到任何设备');
    });

    it('应该能连接网络设备', async () => {
      const instance = new HardwareDriverManager();
      const networkConfig = { host: '192.168.1.100', port: 24000 };
      
      const result = await instance.connectToDevice('network', { networkConfig });
      
      expect(result.success).toBe(true);
    });

    it('网络连接缺少配置时应该返回错误', async () => {
      const instance = new HardwareDriverManager();
      
      const result = await instance.connectToDevice('network');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('缺少网络配置参数');
    });

    it('应该能处理手动设备连接', async () => {
      const instance = new HardwareDriverManager();
      jest.spyOn(instance, 'detectHardware').mockResolvedValue([]);

      const result = await instance.connectToDevice('/dev/ttyUSB0');
      
      expect(result.success).toBe(true);
    });

    it('应该能处理网络地址连接', async () => {
      const instance = new HardwareDriverManager();
      jest.spyOn(instance, 'detectHardware').mockResolvedValue([]);

      const result = await instance.connectToDevice('192.168.1.100:24000');
      
      expect(result.success).toBe(true);
    });

    it('连接失败时应该返回错误', async () => {
      const instance = new HardwareDriverManager();
      
      // Mock驱动连接失败
      const originalCreateDriver = instance.createDriver;
      jest.spyOn(instance, 'createDriver').mockImplementation(async () => {
        const mockDriver = new MockAnalyzerDriverBase('/dev/fail');
        jest.spyOn(mockDriver, 'connect').mockResolvedValue({
          success: false,
          error: 'Connection failed'
        });
        return mockDriver;
      });

      const result = await instance.connectToDevice('/dev/fail');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('应该能断开当前设备', async () => {
      const instance = new HardwareDriverManager();
      
      // 先连接一个设备
      const result = await instance.connectToDevice('/dev/ttyUSB0');
      expect(result.success).toBe(true);
      
      const eventSpy = jest.spyOn(instance, 'emit');
      
      // 断开连接
      await instance.disconnectCurrentDevice();
      
      expect(instance.isDeviceConnected()).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith('deviceDisconnected', expect.any(Object));
    });

    it('断开连接时处理错误', async () => {
      const instance = new HardwareDriverManager();
      
      // 设置一个会抛出错误的mock设备
      const mockDriver = new MockAnalyzerDriverBase('/dev/ttyUSB0');
      jest.spyOn(mockDriver, 'disconnect').mockRejectedValue(new Error('Disconnect failed'));
      
      (instance as any).currentDevice = mockDriver;
      (instance as any).connectedDeviceInfo = { id: 'test' };
      
      // 断开连接不应该抛出错误
      await expect(instance.disconnectCurrentDevice()).resolves.not.toThrow();
      
      expect(instance.getCurrentDevice()).toBeNull();
    });
  });

  describe('自动连接功能深度测试', () => {
    it('没有设备时应该抛出错误', async () => {
      const instance = new HardwareDriverManager();
      jest.spyOn(instance, 'detectHardware').mockResolvedValue([]);

      await expect(instance.autoConnect()).rejects.toThrow('No compatible devices found');
    });

    it('第一个设备连接失败时应该尝试其他设备', async () => {
      const instance = new HardwareDriverManager();
      
      const devices = [
        {
          id: 'device1',
          name: 'Device 1',
          type: 'serial' as const,
          connectionString: '/dev/fail',
          driverType: 0,
          confidence: 95
        },
        {
          id: 'device2',
          name: 'Device 2',
          type: 'serial' as const,
          connectionString: '/dev/ttyUSB1',
          driverType: 0,
          confidence: 80
        }
      ];

      jest.spyOn(instance, 'detectHardware').mockResolvedValue(devices);
      
      // Mock第一个设备连接失败，第二个成功
      jest.spyOn(instance, 'createDriver').mockImplementation(async (device) => {
        if (device.connectionString === '/dev/fail') {
          throw new Error('Connection failed');
        }
        return new MockAnalyzerDriverBase(device.connectionString);
      });

      const driver = await instance.autoConnect();
      expect(driver).toBeDefined();
      expect(driver.connectionString).toBe('/dev/ttyUSB1');
    });

    it('所有设备连接失败时应该抛出错误', async () => {
      const instance = new HardwareDriverManager();
      
      const devices = [
        {
          id: 'device1',
          name: 'Device 1',
          type: 'serial' as const,
          connectionString: '/dev/fail1',
          driverType: 0,
          confidence: 95
        },
        {
          id: 'device2',
          name: 'Device 2',
          type: 'serial' as const,
          connectionString: '/dev/fail2',
          driverType: 0,
          confidence: 80
        }
      ];

      jest.spyOn(instance, 'detectHardware').mockResolvedValue(devices);
      jest.spyOn(instance, 'createDriver').mockRejectedValue(new Error('Connection failed'));

      await expect(instance.autoConnect()).rejects.toThrow('Failed to connect to any detected device');
    });
  });

  describe('检测器测试', () => {
    it('SerialDetector应该能检测Pico设备', async () => {
      const { SerialDetector } = DriverManagerModule;
      const detector = new SerialDetector();
      
      // Mock serialport返回Pico设备
      const { SerialPort } = require('serialport');
      SerialPort.list.mockResolvedValue([
        {
          path: '/dev/ttyUSB0',
          vendorId: '2E8A',
          productId: '0003',
          manufacturer: 'Pico'
        }
      ]);

      const devices = await detector.detect();
      expect(devices.length).toBeGreaterThan(0);
      expect(devices[0].name).toContain('Logic Analyzer');
      expect(devices[0].confidence).toBe(80);
    });

    it('SerialDetector应该处理检测错误', async () => {
      const { SerialDetector } = DriverManagerModule;
      const detector = new SerialDetector();
      
      // Mock serialport抛出错误
      const { SerialPort } = require('serialport');
      SerialPort.list.mockRejectedValue(new Error('Serial port error'));

      const devices = await detector.detect();
      expect(devices).toEqual([]);
    });

    it('NetworkDetector应该能检测网络设备', async () => {
      const { NetworkDetector } = DriverManagerModule;
      const detector = new NetworkDetector();
      
      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('SaleaeDetector应该能检测Saleae设备', async () => {
      const { SaleaeDetector } = DriverManagerModule;
      const detector = new SaleaeDetector();
      
      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('SigrokDetector应该能检测Sigrok设备', async () => {
      const { SigrokDetector } = DriverManagerModule;
      const detector = new SigrokDetector();
      
      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('RigolSiglentDetector应该能检测设备', async () => {
      const { RigolSiglentDetector } = DriverManagerModule;
      const detector = new RigolSiglentDetector();
      
      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理设备检测超时', async () => {
      const instance = new HardwareDriverManager();
      
      // Mock检测器超时
      const originalDetectors = (instance as any).detectors;
      (instance as any).detectors = [{
        name: 'Timeout Detector',
        detect: jest.fn().mockImplementation(() => new Promise(resolve => {
          setTimeout(() => resolve([]), 100);
        }))
      }];

      const devices = await instance.detectHardware();
      expect(Array.isArray(devices)).toBe(true);
      
      // 恢复原始检测器
      (instance as any).detectors = originalDetectors;
    });

    it('应该正确合并和去重检测结果', () => {
      const instance = new HardwareDriverManager();
      
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
          connectionString: '/dev/ttyUSB0', // 相同连接字符串
          driverType: 0,
          confidence: 90 // 更高置信度
        }
      ];

      const merged = (instance as any).mergeAndRankResults(devices);
      
      expect(merged.length).toBe(1);
      expect(merged[0].confidence).toBe(90); // 保留置信度更高的
    });

    it('应该处理驱动创建时的连接字符串解析', async () => {
      const instance = new HardwareDriverManager();
      
      // 测试网络驱动连接字符串解析
      const networkDevice = {
        id: 'network-test',
        name: 'Network Device',
        type: 'network' as const,
        connectionString: '192.168.1.100:24000',
        driverType: 1,
        confidence: 80
      };

      const driver = await instance.createDriver(networkDevice);
      expect(driver).toBeDefined();
      
      // 测试Sigrok适配器连接字符串解析
      const sigrokDevice = {
        id: 'sigrok-test',
        name: 'Sigrok Device',
        type: 'usb' as const,
        connectionString: 'fx2lafw:conn=1.2.3',
        driverType: 0,
        confidence: 85
      };

      jest.spyOn(instance, 'matchDriver').mockResolvedValue({
        id: 'sigrok-adapter',
        name: 'Sigrok Adapter',
        description: 'Sigrok universal adapter',
        version: '1.0.0',
        driverClass: mockDrivers.SigrokAdapter,
        supportedDevices: ['fx2lafw'],
        priority: 70
      });

      const sigrokDriver = await instance.createDriver(sigrokDevice);
      expect(sigrokDriver).toBeDefined();
    });
  });

  describe('单例测试', () => {
    it('hardwareDriverManager应该存在', () => {
      const singleton = DriverManagerModule.hardwareDriverManager;
      expect(singleton).toBeDefined();
      expect(typeof singleton).toBe('object');
    });
  });
});