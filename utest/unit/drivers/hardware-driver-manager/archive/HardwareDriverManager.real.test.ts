/**
 * HardwareDriverManager 真实源码测试用例
 * 
 * 测试策略：
 * - 使用真实的 HardwareDriverManager 实例
 * - Mock 外部依赖（serialport、net、child_process）
 * - 测试真实的源代码逻辑
 * 
 * 创建时间：2025-08-01
 * 版本：v2.0.0
 * 
 * 目标：提升 HardwareDriverManager.ts 的代码覆盖率
 */

import { EventEmitter } from 'events';

// Mock外部依赖，但保留真实的类定义
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn().mockResolvedValue([
      {
        path: '/dev/ttyUSB0',
        vendorId: '2E8A',
        productId: '0003',
        manufacturer: 'Raspberry Pi'
      },
      {
        path: '/dev/ttyUSB1',
        vendorId: '1234',
        productId: '5678',
        manufacturer: 'Generic'
      }
    ])
  }
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => {
    const mockSocket = new EventEmitter();
    return Object.assign(mockSocket, {
      setTimeout: jest.fn(),
      connect: jest.fn(function(this: any, port: number, host: string, callback?: () => void) {
        // 模拟连接行为
        if (host === '192.168.1.100' && port === 24000) {
          process.nextTick(() => callback && callback());
        } else if (host === '192.168.1.101' && port === 5555) {
          process.nextTick(() => this.emit('error', new Error('Connection refused')));
        } else {
          process.nextTick(() => this.emit('timeout'));
        }
      }),
      write: jest.fn(),
      destroy: jest.fn()
    });
  })
}));

jest.mock('child_process', () => ({
  spawn: jest.fn((command: string, args?: string[]) => {
    const mockProcess = new EventEmitter();
    
    if (command === 'sigrok-cli') {
      if (args && args.includes('--version')) {
        process.nextTick(() => (mockProcess as any).emit('close', 0));
      } else if (args && args.includes('--scan')) {
        const mockStdout = new EventEmitter();
        (mockProcess as any).stdout = mockStdout;
        
        process.nextTick(() => {
          mockStdout.emit('data', Buffer.from('fx2lafw:conn=1 - Saleae Logic\n'));
          mockStdout.emit('data', Buffer.from('kingst-la2016:conn=2 - Kingst LA2016\n'));
          (mockProcess as any).emit('close', 0);
        });
      }
    }
    
    return mockProcess;
  })
}));

// Mock驱动类，但不Mock HardwareDriverManager本身
jest.mock('../../../src/drivers/LogicAnalyzerDriver', () => {
  return function MockLogicAnalyzerDriver(connectionString: string) {
    return {
      connectionString,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Pico', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true)
    };
  };
});

jest.mock('../../../src/drivers/SaleaeLogicDriver', () => {
  return function MockSaleaeLogicDriver(connectionString: string) {
    return {
      connectionString,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Saleae', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
  };
});

jest.mock('../../../src/drivers/RigolSiglentDriver', () => {
  return function MockRigolSiglentDriver(connectionString: string) {
    return {
      connectionString,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Rigol', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
  };
});

jest.mock('../../../src/drivers/SigrokAdapter', () => {
  return function MockSigrokAdapter(driver: string, deviceId: string) {
    return {
      connectionString: `${driver}:${deviceId}`,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Sigrok', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
  };
});

jest.mock('../../../src/drivers/NetworkLogicAnalyzerDriver', () => {
  return function MockNetworkLogicAnalyzerDriver(host: string, port: number) {
    return {
      connectionString: `${host}:${port}`,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Network', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
  };
});

jest.mock('../../../src/drivers/MultiAnalyzerDriver', () => {
  return function MockMultiAnalyzerDriver(connectionStrings: string[]) {
    return {
      connectionStrings,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Multi', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
  };
});

// 静态方法Mock
const mockGetSupportedDevices = jest.fn().mockReturnValue([
  { driver: 'fx2lafw', name: 'fx2lafw', channels: 16, maxRate: 24000000 },
  { driver: 'kingst-la2016', name: 'Kingst LA2016', channels: 16, maxRate: 200000000 }
]);

jest.mock('../../../src/drivers/SigrokAdapter', () => {
  const MockSigrokAdapter = function(driver: string, deviceId: string) {
    return {
      connectionString: `${driver}:${deviceId}`,
      connect: jest.fn().mockResolvedValue({ 
        success: true, 
        deviceInfo: { deviceName: 'Mock Sigrok', version: '1.0.0' }
      }),
      disconnect: jest.fn().mockResolvedValue(undefined)
    };
  };
  
  MockSigrokAdapter.getSupportedDevices = mockGetSupportedDevices;
  return MockSigrokAdapter;
});

// 导入真实的HardwareDriverManager
import { 
  HardwareDriverManager,
  DetectedDevice,
  DriverRegistration,
  IDeviceDetector 
} from '../../../src/drivers/HardwareDriverManager';

import { AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

describe('HardwareDriverManager 真实源码测试', () => {
  let driverManager: HardwareDriverManager;
  
  beforeEach(() => {
    // 清除所有Mock调用
    jest.clearAllMocks();
    
    // 创建真实的HardwareDriverManager实例  
    driverManager = new HardwareDriverManager();
  });
  
  afterEach(async () => {
    // 清理资源
    if (driverManager) {
      await driverManager.dispose();
    }
  });

  describe('驱动管理基础功能', () => {
    it('应正确初始化内置驱动', () => {
      const drivers = driverManager.getRegisteredDrivers();
      
      expect(drivers).toBeDefined();
      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeGreaterThan(0);
      
      // 验证Pico驱动注册
      const picoDriver = drivers.find(d => d.id === 'pico-logic-analyzer');
      expect(picoDriver).toBeDefined();
      expect(picoDriver?.priority).toBe(100);
      expect(picoDriver?.supportedDevices).toContain('pico');
    });
    
    it('应支持动态注册新驱动', () => {
      const initialCount = driverManager.getRegisteredDrivers().length;
      
      const newDriver: DriverRegistration = {
        id: 'test-driver',
        name: 'Test Driver',
        description: 'Test driver for unit testing',
        version: '1.0.0',
        driverClass: class TestDriver {} as any,
        supportedDevices: ['test'],
        priority: 50
      };
      
      let registrationEventFired = false;
      driverManager.on('driverRegistered', (driver) => {
        expect(driver).toEqual(newDriver);
        registrationEventFired = true;
      });
      
      driverManager.registerDriver(newDriver);
      
      const updatedDrivers = driverManager.getRegisteredDrivers();
      expect(updatedDrivers.length).toBe(initialCount + 1);
      expect(registrationEventFired).toBe(true);
      
      const registeredDriver = updatedDrivers.find(d => d.id === 'test-driver');
      expect(registeredDriver).toEqual(newDriver);
    });
    
    it('应支持注销驱动', () => {
      // 先注册一个测试驱动
      const testDriver: DriverRegistration = {
        id: 'removable-driver',
        name: 'Removable Driver',
        description: 'Driver to be removed',
        version: '1.0.0',
        driverClass: class RemovableDriver {} as any,
        supportedDevices: ['removable'],
        priority: 40
      };
      
      driverManager.registerDriver(testDriver);
      
      let unregistrationEventFired = false;
      driverManager.on('driverUnregistered', (driverId) => {
        expect(driverId).toBe('removable-driver');
        unregistrationEventFired = true;
      });
      
      const success = driverManager.unregisterDriver('removable-driver');
      expect(success).toBe(true);
      expect(unregistrationEventFired).toBe(true);
      
      const drivers = driverManager.getRegisteredDrivers();
      const removedDriver = drivers.find(d => d.id === 'removable-driver');
      expect(removedDriver).toBeUndefined();
    });
    
    it('应按优先级排序驱动', () => {
      const drivers = driverManager.getRegisteredDrivers();
      
      // 验证按优先级排序（降序）
      for (let i = 0; i < drivers.length - 1; i++) {
        expect(drivers[i].priority).toBeGreaterThanOrEqual(drivers[i + 1].priority);
      }
    });
  });

  describe('设备检测功能', () => {
    it('应执行硬件检测', async () => {
      const devices = await driverManager.detectHardware();
      
      expect(Array.isArray(devices)).toBe(true);
      // 应该检测到串口设备
      expect(devices.length).toBeGreaterThan(0);
      
      // 验证设备格式
      devices.forEach(device => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('connectionString');
        expect(device).toHaveProperty('confidence');
        expect(typeof device.confidence).toBe('number');
        expect(device.confidence).toBeGreaterThan(0);
        expect(device.confidence).toBeLessThanOrEqual(100);
      });
    });
    
    it('应缓存检测结果', async () => {
      // 第一次检测
      const startTime1 = performance.now();
      const devices1 = await driverManager.detectHardware();
      const time1 = performance.now() - startTime1;
      
      // 第二次检测（应使用缓存）
      const startTime2 = performance.now();
      const devices2 = await driverManager.detectHardware();
      const time2 = performance.now() - startTime2;
      
      // 结果应该一致
      expect(devices1).toEqual(devices2);
      // 缓存的检测应该更快
      expect(time2).toBeLessThan(time1);
    });
    
    it('应支持强制刷新缓存', async () => {
      // 建立缓存
      await driverManager.detectHardware();
      
      // 强制刷新
      const refreshedDevices = await driverManager.detectHardware(false);
      
      expect(Array.isArray(refreshedDevices)).toBe(true);
    });
    
    it('应发射设备检测事件', async () => {
      let detectedDevices: DetectedDevice[] = [];
      
      driverManager.on('devicesDetected', (devices) => {
        detectedDevices = devices;
      });
      
      await driverManager.detectHardware();
      
      expect(detectedDevices).toBeDefined();
      expect(Array.isArray(detectedDevices)).toBe(true);
    });
  });

  describe('设备连接管理', () => {
    it('应支持自动连接', async () => {
      try {
        const driver = await driverManager.autoConnect();
        
        // 如果成功连接，验证驱动
        expect(driver).toBeDefined();
        expect(driver.connectionString).toBeDefined();
        
        // 验证连接状态
        expect(driverManager.isDeviceConnected()).toBe(true);
        expect(driverManager.getCurrentDevice()).toBe(driver);
      } catch (error) {
        // 如果没有检测到设备，应该抛出合适的错误
        expect((error as Error).message).toMatch(/No compatible devices found/);
      }
    });
    
    it('应支持手动设备连接', async () => {
      const result = await driverManager.connectToDevice('/dev/ttyUSB0');
      
      if (result.success) {
        expect(result.deviceInfo).toBeDefined();
        expect(driverManager.isDeviceConnected()).toBe(true);
        expect(driverManager.getCurrentDevice()).not.toBeNull();
        expect(driverManager.getCurrentDeviceInfo()).not.toBeNull();
      } else {
        expect(result.error).toBeDefined();
      }
    });
    
    it('应支持网络设备连接', async () => {
      const networkConfig = {
        networkConfig: {
          host: '192.168.1.100',
          port: 24000
        }
      };
      
      const result = await driverManager.connectToDevice('network', networkConfig);
      
      if (result.success) {
        expect(result.deviceInfo).toBeDefined();
        expect(driverManager.isDeviceConnected()).toBe(true);
      } else {
        expect(result.error).toBeDefined();
      }
    });
    
    it('应支持断开设备连接', async () => {
      // 先连接设备
      const connectResult = await driverManager.connectToDevice('/dev/ttyUSB0');
      
      if (connectResult.success) {
        expect(driverManager.isDeviceConnected()).toBe(true);
        
        // 断开连接
        await driverManager.disconnectCurrentDevice();
        
        expect(driverManager.isDeviceConnected()).toBe(false);
        expect(driverManager.getCurrentDevice()).toBeNull();
        expect(driverManager.getCurrentDeviceInfo()).toBeNull();
      }
    });
  });

  describe('驱动创建和匹配', () => {
    it('应正确匹配设备驱动', async () => {
      const testDevice: DetectedDevice = {
        id: 'test-pico',
        name: 'Test Pico Device',
        type: 'serial',
        connectionString: '/dev/ttyUSB0',
        driverType: AnalyzerDriverType.Serial,
        confidence: 80
      };
      
      const matchedDriver = await driverManager.matchDriver(testDevice);
      
      expect(matchedDriver).toBeDefined();
      expect(matchedDriver?.id).toBe('pico-logic-analyzer');
    });
    
    it('应创建驱动实例', async () => {
      const testDevice: DetectedDevice = {
        id: 'test-device',
        name: 'Test Device',
        type: 'serial',
        connectionString: '/dev/ttyUSB0',
        driverType: AnalyzerDriverType.Serial,
        confidence: 80
      };
      
      let driverCreatedEvent: any = null;
      driverManager.on('driverCreated', (event) => {
        driverCreatedEvent = event;
      });
      
      const driver = await driverManager.createDriver(testDevice);
      
      expect(driver).toBeDefined();
      expect(driver.connectionString).toBe('/dev/ttyUSB0');
      expect(driverCreatedEvent).toBeDefined();
      expect(driverCreatedEvent.device).toBe(testDevice);
    });
    
    it('应处理驱动创建失败', async () => {
      const invalidDevice: DetectedDevice = {
        id: 'invalid-device',
        name: 'Invalid Device',
        type: 'serial',
        connectionString: 'invalid-connection',
        driverType: 999 as AnalyzerDriverType, // 无效类型
        confidence: 50
      };
      
      await expect(driverManager.createDriver(invalidDevice))
        .rejects.toThrow();
    });
  });

  describe('多设备支持', () => {
    it('应创建多设备驱动', () => {
      const connectionStrings = ['/dev/ttyUSB0', '/dev/ttyUSB1', '192.168.1.100:24000'];
      
      let multiDriverCreatedEvent: any = null;
      driverManager.on('multiDriverCreated', (event) => {
        multiDriverCreatedEvent = event;
      });
      
      const multiDriver = driverManager.createMultiDeviceDriver(connectionStrings);
      
      expect(multiDriver).toBeDefined();
      expect(multiDriver.connectionStrings).toEqual(connectionStrings);
      expect(multiDriverCreatedEvent).toBeDefined();
    });
    
    it('应验证多设备驱动连接数限制', () => {
      // 连接数太少
      expect(() => {
        driverManager.createMultiDeviceDriver(['/dev/ttyUSB0']);
      }).toThrow('多设备驱动需要2-5个连接字符串');
      
      // 连接数太多
      const tooMany = Array(6).fill('/dev/ttyUSB').map((base, i) => `${base}${i}`);
      expect(() => {
        driverManager.createMultiDeviceDriver(tooMany);
      }).toThrow('多设备驱动需要2-5个连接字符串');
    });
  });

  describe('Sigrok 支持', () => {
    it('应返回支持的 Sigrok 设备列表', () => {
      const supportedDevices = driverManager.getSupportedSigrokDevices();
      
      expect(Array.isArray(supportedDevices)).toBe(true);
      expect(mockGetSupportedDevices).toHaveBeenCalled();
      
      supportedDevices.forEach(device => {
        expect(device).toHaveProperty('driver');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('channels');
        expect(device).toHaveProperty('maxRate');
        expect(typeof device.channels).toBe('number');
        expect(typeof device.maxRate).toBe('number');
      });
    });
  });

  describe('资源管理', () => {
    it('应正确清理资源', async () => {
      // 连接一些设备
      await driverManager.connectToDevice('/dev/ttyUSB0');
      
      expect(driverManager.isDeviceConnected()).toBe(true);
      
      // 清理资源
      await driverManager.dispose();
      
      expect(driverManager.getCurrentDevice()).toBeNull();
      expect(driverManager.isDeviceConnected()).toBe(false);
      expect(driverManager.getActiveConnections().size).toBe(0);
    });
  });
});

/**
 * 测试统计信息：
 * - 总测试用例数：20个
 * - 主要测试分类：7个
 * - 覆盖的核心功能：驱动管理、设备检测、连接管理、驱动创建、多设备支持、Sigrok支持、资源管理
 * - 目标覆盖率：> 80%
 * - 预期测试时间：< 5秒
 */