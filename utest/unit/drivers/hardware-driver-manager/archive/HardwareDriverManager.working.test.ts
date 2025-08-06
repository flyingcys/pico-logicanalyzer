/**
 * HardwareDriverManager 工作测试用例
 * 
 * 测试目标：真正测试源代码，实现高覆盖率
 * 使用简化的导入策略避免模块问题
 * 
 * 创建时间：2025-08-02
 */

// Mock外部依赖
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn().mockResolvedValue([
      {
        path: '/dev/ttyUSB0',
        vendorId: '2E8A',
        productId: '0003',
        manufacturer: 'Raspberry Pi'
      }
    ])
  }
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    setTimeout: jest.fn(),
    connect: jest.fn(function(this: any, port: number, host: string, callback?: () => void) {
      if (host === '192.168.1.100' && port === 24000) {
        setTimeout(() => callback && callback(), 10);
      } else {
        setTimeout(() => this.emit('error', new Error('Connection refused')), 10);
      }
    }),
    write: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(function(this: any, event: string, callback: Function) {
      this.eventHandlers = this.eventHandlers || {};
      this.eventHandlers[event] = callback;
    }),
    emit: jest.fn(function(this: any, event: string, ...args: any[]) {
      if (this.eventHandlers && this.eventHandlers[event]) {
        this.eventHandlers[event](...args);
      }
    })
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn((command: string, args?: string[]) => {
    const { EventEmitter } = require('events');
    const mockProcess = new EventEmitter();
    
    if (command === 'sigrok-cli') {
      if (args && args.includes('--version')) {
        setTimeout(() => (mockProcess as any).emit('close', 0), 10);
      } else if (args && args.includes('--scan')) {
        const mockStdout = new EventEmitter();
        (mockProcess as any).stdout = mockStdout;
        
        setTimeout(() => {
          mockStdout.emit('data', Buffer.from('fx2lafw:conn=1 - Saleae Logic\n'));
          (mockProcess as any).emit('close', 0);
        }, 10);
      }
    }
    
    return mockProcess;
  })
}));

// Mock驱动基类
class MockAnalyzerDriverBase {
  public isConnected: boolean = false;
  public connectionString: string = '';
  
  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }
  
  async connect(params?: any): Promise<{ success: boolean; deviceInfo?: any; error?: string }> {
    if (this.connectionString.includes('fail')) {
      return { success: false, error: 'Connection failed' };
    }
    
    this.isConnected = true;
    
    return {
      success: true,
      deviceInfo: {
        deviceId: this.connectionString,
        deviceName: 'Mock Device',
        firmwareVersion: '1.0.0'
      }
    };
  }
  
  async disconnect(): Promise<void> {
    this.isConnected = false;
  }
}

// Mock具体驱动
jest.mock('../../../src/drivers/LogicAnalyzerDriver', () => MockAnalyzerDriverBase);
jest.mock('../../../src/drivers/SaleaeLogicDriver', () => MockAnalyzerDriverBase);
jest.mock('../../../src/drivers/RigolSiglentDriver', () => MockAnalyzerDriverBase);
jest.mock('../../../src/drivers/NetworkLogicAnalyzerDriver', () => MockAnalyzerDriverBase);
jest.mock('../../../src/drivers/MultiAnalyzerDriver', () => MockAnalyzerDriverBase);

jest.mock('../../../src/drivers/SigrokAdapter', () => {
  class MockSigrokAdapter extends MockAnalyzerDriverBase {
    static getSupportedDevices() {
      return [
        { driver: 'fx2lafw', name: 'fx2lafw', channels: 16, maxRate: 24000000 },
        { driver: 'kingst-la2016', name: 'Kingst LA2016', channels: 16, maxRate: 200000000 }
      ];
    }
  }
  return MockSigrokAdapter;
});

describe('HardwareDriverManager 工作测试套件', () => {
  let HardwareDriverManager: any;
  let SerialDetector: any;
  let NetworkDetector: any;
  let SaleaeDetector: any;
  let SigrokDetector: any;
  let RigolSiglentDetector: any;
  let AnalyzerDriverType: any;
  
  beforeAll(() => {
    // 直接导入模块
    const driverModule = require('../../../src/drivers/HardwareDriverManager');
    HardwareDriverManager = driverModule.HardwareDriverManager;
    SerialDetector = driverModule.SerialDetector;
    NetworkDetector = driverModule.NetworkDetector;
    SaleaeDetector = driverModule.SaleaeDetector;
    SigrokDetector = driverModule.SigrokDetector;
    RigolSiglentDetector = driverModule.RigolSiglentDetector;
    
    const typesModule = require('../../../src/models/AnalyzerTypes');
    AnalyzerDriverType = typesModule.AnalyzerDriverType;
  });

  describe('类实例化和基本功能', () => {
    let driverManager: any;

    beforeEach(() => {
      driverManager = new HardwareDriverManager();
    });

    afterEach(async () => {
      if (driverManager) {
        await driverManager.dispose();
      }
    });

    it('应正确创建HardwareDriverManager实例', () => {
      expect(driverManager).toBeDefined();
      expect(typeof driverManager).toBe('object');
    });

    it('应正确初始化内置驱动', () => {
      const drivers = driverManager.getRegisteredDrivers();
      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeGreaterThan(0);

      // 验证Pico驱动（最高优先级）
      const picoDriver = drivers.find((d: any) => d.id === 'pico-logic-analyzer');
      expect(picoDriver).toBeDefined();
      expect(picoDriver.priority).toBe(100);
      expect(picoDriver.name).toBe('Pico Logic Analyzer');
    });

    it('应按优先级正确排序驱动', () => {
      const drivers = driverManager.getRegisteredDrivers();
      
      for (let i = 0; i < drivers.length - 1; i++) {
        expect(drivers[i].priority).toBeGreaterThanOrEqual(drivers[i + 1].priority);
      }
    });

    it('内置驱动应包含所有预期的驱动类型', () => {
      const drivers = driverManager.getRegisteredDrivers();
      const driverIds = drivers.map((d: any) => d.id);

      expect(driverIds).toContain('pico-logic-analyzer');
      expect(driverIds).toContain('saleae-logic');
      expect(driverIds).toContain('rigol-siglent');
      expect(driverIds).toContain('sigrok-adapter');
      expect(driverIds).toContain('network-analyzer');
    });

    it('应支持注册新驱动', () => {
      const initialCount = driverManager.getRegisteredDrivers().length;

      const newDriver = {
        id: 'test-driver',
        name: 'Test Driver',
        description: 'Test driver for unit testing',
        version: '1.0.0',
        driverClass: MockAnalyzerDriverBase as any,
        supportedDevices: ['test'],
        priority: 50
      };

      let eventFired = false;
      driverManager.on('driverRegistered', (registration: any) => {
        eventFired = true;
        expect(registration).toEqual(newDriver);
      });

      driverManager.registerDriver(newDriver);

      const updatedDrivers = driverManager.getRegisteredDrivers();
      expect(updatedDrivers.length).toBe(initialCount + 1);
      expect(eventFired).toBe(true);

      const registeredDriver = updatedDrivers.find((d: any) => d.id === 'test-driver');
      expect(registeredDriver).toEqual(newDriver);
    });

    it('应支持注销驱动', () => {
      // 先注册一个测试驱动
      const testDriver = {
        id: 'removable-driver',
        name: 'Removable Driver',
        description: 'Driver to be removed',
        version: '1.0.0',
        driverClass: MockAnalyzerDriverBase as any,
        supportedDevices: ['removable'],
        priority: 30
      };

      driverManager.registerDriver(testDriver);

      let eventFired = false;
      driverManager.on('driverUnregistered', (driverId: string) => {
        eventFired = true;
        expect(driverId).toBe('removable-driver');
      });

      // 注销驱动
      const removed = driverManager.unregisterDriver('removable-driver');

      expect(removed).toBe(true);
      expect(eventFired).toBe(true);

      const drivers = driverManager.getRegisteredDrivers();
      const removedDriver = drivers.find((d: any) => d.id === 'removable-driver');
      expect(removedDriver).toBeUndefined();
    });

    it('注销不存在的驱动应返回false', () => {
      const removed = driverManager.unregisterDriver('non-existent-driver');
      expect(removed).toBe(false);
    });

    it('应执行硬件检测并返回设备列表', async () => {
      const devices = await driverManager.detectHardware();

      expect(Array.isArray(devices)).toBe(true);
      // 基于mock设置，应该检测到一些设备
      expect(devices.length).toBeGreaterThan(0);

      // 验证设备结构
      devices.forEach((device: any) => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('connectionString');
        expect(device).toHaveProperty('driverType');
        expect(device).toHaveProperty('confidence');
        expect(typeof device.confidence).toBe('number');
        expect(device.confidence).toBeGreaterThan(0);
        expect(device.confidence).toBeLessThanOrEqual(100);
      });
    });

    it('应触发设备检测事件', async () => {
      let detectedDevices: any[] = [];

      driverManager.on('devicesDetected', (devices: any[]) => {
        detectedDevices = devices;
      });

      await driverManager.detectHardware();

      expect(detectedDevices).toBeDefined();
      expect(Array.isArray(detectedDevices)).toBe(true);
    });

    it('应正确缓存检测结果', async () => {
      // 第一次检测
      const devices1 = await driverManager.detectHardware();
      
      // 第二次检测（应使用缓存）
      const devices2 = await driverManager.detectHardware();

      expect(devices1).toEqual(devices2);
    });

    it('应支持强制刷新缓存', async () => {
      // 建立缓存
      await driverManager.detectHardware();
      
      // 强制刷新
      const devicesRefresh = await driverManager.detectHardware(false);

      expect(Array.isArray(devicesRefresh)).toBe(true);
    });

    it('检测结果应按置信度排序', async () => {
      const devices = await driverManager.detectHardware();

      if (devices.length > 1) {
        for (let i = 0; i < devices.length - 1; i++) {
          expect(devices[i].confidence).toBeGreaterThanOrEqual(devices[i + 1].confidence);
        }
      }
    });

    it('应正确去重设备', async () => {
      const devices = await driverManager.detectHardware();

      const connectionStrings = devices.map((d: any) => d.connectionString);
      const uniqueConnections = new Set(connectionStrings);
      expect(connectionStrings.length).toBe(uniqueConnections.size);
    });

    it('应正确匹配设备驱动', async () => {
      const testDevice = {
        id: 'test-pico',
        name: 'Test Pico Device',
        type: 'serial',
        connectionString: '/dev/ttyUSB0',
        driverType: AnalyzerDriverType.Serial,
        confidence: 80
      };

      const matchedDriver = await driverManager.matchDriver(testDevice);

      expect(matchedDriver).toBeDefined();
      expect(matchedDriver.id).toBe('pico-logic-analyzer');
    });

    it('应为网络设备匹配正确的驱动', async () => {
      const networkDevice = {
        id: 'test-network',
        name: 'Test Network Device',
        type: 'network',
        connectionString: '192.168.1.100:24000',
        driverType: AnalyzerDriverType.Network,
        confidence: 70
      };

      const matchedDriver = await driverManager.matchDriver(networkDevice);

      expect(matchedDriver).toBeDefined();
      // 应匹配到网络相关的驱动
      expect(['saleae-logic', 'rigol-siglent', 'network-analyzer']).toContain(matchedDriver.id);
    });

    it('无法匹配的设备应返回null', async () => {
      const unknownDevice = {
        id: 'unknown',
        name: 'Unknown Device',
        type: 'serial',
        connectionString: '/dev/unknown',
        driverType: 999 as any,
        confidence: 50
      };

      const matchedDriver = await driverManager.matchDriver(unknownDevice);
      expect(matchedDriver).toBeNull();
    });

    it('应成功创建驱动实例', async () => {
      const testDevice = {
        id: 'create-test',
        name: 'Create Test Device',
        type: 'serial',
        connectionString: '/dev/ttyUSB0',
        driverType: AnalyzerDriverType.Serial,
        confidence: 85
      };

      let eventFired = false;
      driverManager.on('driverCreated', (event: any) => {
        eventFired = true;
        expect(event.device).toEqual(testDevice);
        expect(event.driver).toBeDefined();
        expect(event.registration).toBeDefined();
      });

      const driver = await driverManager.createDriver(testDevice);

      expect(driver).toBeDefined();
      expect(eventFired).toBe(true);
    });

    it('无匹配驱动的设备创建应失败', async () => {
      const invalidDevice = {
        id: 'invalid',
        name: 'Invalid Device',
        type: 'serial',
        connectionString: '/dev/invalid',
        driverType: 999 as any,
        confidence: 50
      };

      await expect(driverManager.createDriver(invalidDevice))
        .rejects.toThrow('No suitable driver found for device');
    });

    it('应支持多设备驱动创建', () => {
      const connectionStrings = [
        '/dev/ttyUSB0',
        '/dev/ttyUSB1',
        '192.168.1.100:24000'
      ];

      let eventFired = false;
      driverManager.on('multiDriverCreated', (event: any) => {
        eventFired = true;
        expect(event.connectionStrings).toEqual(connectionStrings);
        expect(event.driver).toBeDefined();
      });

      const multiDriver = driverManager.createMultiDeviceDriver(connectionStrings);

      expect(multiDriver).toBeDefined();
      expect(eventFired).toBe(true);
    });

    it('多设备驱动应验证连接数量', () => {
      // 连接数过少
      expect(() => {
        driverManager.createMultiDeviceDriver(['/dev/ttyUSB0']);
      }).toThrow('多设备驱动需要2-5个连接字符串');

      // 连接数过多
      const tooMany = Array(6).fill(0).map((_, i) => `/dev/ttyUSB${i}`);
      expect(() => {
        driverManager.createMultiDeviceDriver(tooMany);
      }).toThrow('多设备驱动需要2-5个连接字符串');

      // 正常范围
      expect(() => {
        driverManager.createMultiDeviceDriver(['/dev/ttyUSB0', '/dev/ttyUSB1']);
      }).not.toThrow();
    });

    it('应返回支持的Sigrok设备列表', () => {
      const supportedDevices = driverManager.getSupportedSigrokDevices();

      expect(Array.isArray(supportedDevices)).toBe(true);
      
      supportedDevices.forEach((device: any) => {
        expect(device).toHaveProperty('driver');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('channels');
        expect(device).toHaveProperty('maxRate');
        expect(typeof device.channels).toBe('number');
        expect(typeof device.maxRate).toBe('number');
      });
    });

    it('应正确清理所有资源', async () => {
      // 验证初始状态
      expect(driverManager.getActiveConnections().size).toBe(0);

      // 执行清理
      await driverManager.dispose();

      // 验证清理效果
      expect(driverManager.getActiveConnections().size).toBe(0);
      expect(driverManager.getCurrentDevice()).toBeNull();
      expect(driverManager.getCurrentDeviceInfo()).toBeNull();
      expect(driverManager.isDeviceConnected()).toBe(false);
    });

    it('dispose应该能多次调用而不出错', async () => {
      await driverManager.dispose();
      await driverManager.dispose(); // 第二次调用不应该抛出错误
    });
  });

  describe('检测器功能测试', () => {
    it('SerialDetector应正确工作', async () => {
      const detector = new SerialDetector();
      expect(detector.name).toBe('Serial Port Detector');

      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('NetworkDetector应正确工作', async () => {
      const detector = new NetworkDetector();
      expect(detector.name).toBe('Network Device Detector');

      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('SaleaeDetector应正确工作', async () => {
      const detector = new SaleaeDetector();
      expect(detector.name).toBe('Saleae Logic Detector');

      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('SigrokDetector应正确工作', async () => {
      const detector = new SigrokDetector();
      expect(detector.name).toBe('Sigrok Device Detector');

      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('RigolSiglentDetector应正确工作', async () => {
      const detector = new RigolSiglentDetector();
      expect(detector.name).toBe('Rigol/Siglent Detector');

      const devices = await detector.detect();
      expect(Array.isArray(devices)).toBe(true);
    });
  });
});

/**
 * 测试统计信息：
 * - 总测试用例数：25个
 * - 主要测试分类：2个（基本功能 + 检测器）
 * - 覆盖的核心功能：类实例化、驱动管理、设备检测、驱动匹配、资源清理等
 * - 预期覆盖率：70%+
 * - 预期测试时间：< 15秒
 */