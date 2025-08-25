/**
 * HardwareDriverManager 精准业务逻辑测试
 * 
 * 基于深度思考方法论和AnalyzerDriverBase完美突破经验:
 * - 专注测试@src源码真实业务逻辑，不偏移方向
 * - 最小化Mock使用，验证核心管理算法
 * - 应用错误驱动学习，发现真实接口行为
 * - 系统性覆盖6大核心系统：驱动管理、设备检测、匹配算法、实例创建、连接管理、事件系统
 * 
 * 目标: 基于AnalyzerDriverBase 100%覆盖率成功经验
 * 将HardwareDriverManager从0%覆盖率实现Drivers层重大突破
 */

import { HardwareDriverManager, DetectedDevice, DriverRegistration, IDeviceDetector } from '../../../src/drivers/HardwareDriverManager';
import { AnalyzerDriverBase } from '../../../src/drivers/AnalyzerDriverBase';
import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { NetworkLogicAnalyzerDriver } from '../../../src/drivers/NetworkLogicAnalyzerDriver';
import { SigrokAdapter } from '../../../src/drivers/SigrokAdapter';
import { MultiAnalyzerDriver } from '../../../src/drivers/MultiAnalyzerDriver';
import {
  AnalyzerDriverType,
  AnalyzerDeviceInfo,
  ConnectionParams,
  ConnectionResult
} from '../../../src/models/AnalyzerTypes';

// 创建功能性Mock驱动类 - 错误驱动学习：完全Mock导致初始化失败
jest.mock('../../../src/drivers/LogicAnalyzerDriver', () => {
  return {
    LogicAnalyzerDriver: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue({ success: true, deviceInfo: { name: 'Test Device' } }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      deviceVersion: 'MockDriver-v1.0',
      driverType: require('../../../src/models/AnalyzerTypes').AnalyzerDriverType.Serial,
      isNetwork: false
    }))
  };
});

jest.mock('../../../src/drivers/SaleaeLogicDriver', () => ({
  SaleaeLogicDriver: jest.fn().mockImplementation(() => ({ 
    deviceVersion: 'SaleaeDriver-v1.0',
    connect: jest.fn(),
    disconnect: jest.fn()
  }))
}));

jest.mock('../../../src/drivers/RigolSiglentDriver', () => ({
  RigolSiglentDriver: jest.fn().mockImplementation(() => ({ 
    deviceVersion: 'RigolSiglentDriver-v1.0',
    connect: jest.fn(),
    disconnect: jest.fn()
  }))
}));

jest.mock('../../../src/drivers/SigrokAdapter', () => {
  const mockClass = jest.fn().mockImplementation(() => ({ 
    deviceVersion: 'SigrokAdapter-v1.0',
    connect: jest.fn(),
    disconnect: jest.fn()
  }));
  
  // 静态方法Mock - 正确的TypeScript语法
  (mockClass as any).getSupportedDevices = jest.fn().mockReturnValue([
    { driver: 'fx2lafw', name: 'FX2 Logic Analyzer', channels: 16, maxRate: 24000000 }
  ]);
  
  return {
    SigrokAdapter: mockClass
  };
});

jest.mock('../../../src/drivers/NetworkLogicAnalyzerDriver', () => ({
  NetworkLogicAnalyzerDriver: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({ success: true, deviceInfo: { name: 'Network Device' } }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    deviceVersion: 'NetworkDriver-v1.0',
    driverType: require('../../../src/models/AnalyzerTypes').AnalyzerDriverType.Network,
    isNetwork: true
  }))
}));

jest.mock('../../../src/drivers/MultiAnalyzerDriver', () => ({
  MultiAnalyzerDriver: jest.fn().mockImplementation(() => ({
    deviceVersion: 'MultiAnalyzerDriver-v1.0',
    connect: jest.fn(),
    disconnect: jest.fn()
  }))
}));

// 确保HardwareDriverManager不被自动Mock - 覆盖Jest配置中的moduleNameMapper
jest.doMock('../../../src/drivers/HardwareDriverManager', () => {
  return jest.requireActual('../../../src/drivers/HardwareDriverManager');
});

describe('HardwareDriverManager 精准业务逻辑测试', () => {
  let manager: HardwareDriverManager;
  let mockLogicAnalyzerDriver: jest.Mocked<LogicAnalyzerDriver>;
  let mockNetworkDriver: jest.Mocked<NetworkLogicAnalyzerDriver>;
  let mockSigrokAdapter: jest.Mocked<SigrokAdapter>;

  // 创建测试检测设备数据
  const createTestDevice = (overrides: Partial<DetectedDevice> = {}): DetectedDevice => ({
    id: 'test-device-001',
    name: 'Test Logic Analyzer',
    type: 'serial',
    connectionString: '/dev/ttyACM0',
    driverType: AnalyzerDriverType.Serial,
    confidence: 0.9,
    ...overrides
  });

  // 创建测试驱动注册数据
  const createTestDriverRegistration = (overrides: Partial<DriverRegistration> = {}): DriverRegistration => ({
    id: 'test-driver',
    name: 'Test Driver',
    description: 'Test driver for unit testing',
    version: '1.0.0',
    driverClass: LogicAnalyzerDriver as any,
    supportedDevices: ['test', 'logic-analyzer'],
    priority: 50,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new HardwareDriverManager();
    
    // Mock驱动实例 - 从Mock构造函数获取
    mockLogicAnalyzerDriver = (LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>).mock.instances[0] as any;
    mockNetworkDriver = null; // 将在需要时创建
    mockSigrokAdapter = null; // 将在需要时创建
  });

  describe('驱动管理系统核心逻辑', () => {
    it('应该正确继承EventEmitter', () => {
      // 错误驱动学习：验证EventEmitter继承
      console.log('Manager constructor name:', manager.constructor.name);
      console.log('Manager prototype chain:', Object.getPrototypeOf(manager));
      console.log('Has on method:', typeof manager.on);
      console.log('Has emit method:', typeof manager.emit);
      console.log('Is EventEmitter instance:', manager instanceof require('events').EventEmitter);
      
      expect(typeof manager.on).toBe('function');
      expect(typeof manager.emit).toBe('function');
      expect(typeof manager.off).toBe('function');
    });

    it('应该正确初始化内置5个驱动', () => {
      const drivers = manager.getRegisteredDrivers();
      
      expect(drivers).toHaveLength(5);
      expect(drivers[0].id).toBe('pico-logic-analyzer');
      expect(drivers[0].priority).toBe(100);
      expect(drivers[1].id).toBe('saleae-logic');
      expect(drivers[1].priority).toBe(90);
      expect(drivers[2].id).toBe('rigol-siglent');
      expect(drivers[2].priority).toBe(80);
      expect(drivers[3].id).toBe('sigrok-adapter');
      expect(drivers[3].priority).toBe(70);
      expect(drivers[4].id).toBe('network-analyzer');
      expect(drivers[4].priority).toBe(60);
    });

    it('应该正确按优先级降序排列驱动', () => {
      const drivers = manager.getRegisteredDrivers();
      
      for (let i = 0; i < drivers.length - 1; i++) {
        expect(drivers[i].priority).toBeGreaterThanOrEqual(drivers[i + 1].priority);
      }
    });

    it('应该正确注册新驱动', () => {
      const customDriver = createTestDriverRegistration({
        id: 'custom-driver',
        priority: 120
      });

      manager.registerDriver(customDriver);
      
      const drivers = manager.getRegisteredDrivers();
      expect(drivers[0]).toEqual(customDriver); // 最高优先级排在第一位
      expect(drivers).toHaveLength(6); // 原5个+新1个
    });

    it('应该触发driverRegistered事件', (done) => {
      const customDriver = createTestDriverRegistration();
      
      manager.on('driverRegistered', (registration: DriverRegistration) => {
        expect(registration).toEqual(customDriver);
        done();
      });

      manager.registerDriver(customDriver);
    });

    it('应该正确注销驱动', () => {
      const initialCount = manager.getRegisteredDrivers().length;
      
      const result = manager.unregisterDriver('pico-logic-analyzer');
      
      expect(result).toBe(true);
      expect(manager.getRegisteredDrivers()).toHaveLength(initialCount - 1);
      expect(manager.getRegisteredDrivers().find(d => d.id === 'pico-logic-analyzer')).toBeUndefined();
    });

    it('应该处理不存在驱动的注销', () => {
      const result = manager.unregisterDriver('non-existent-driver');
      
      expect(result).toBe(false);
    });

    it('应该触发driverUnregistered事件', (done) => {
      manager.on('driverUnregistered', (driverId: string) => {
        expect(driverId).toBe('pico-logic-analyzer');
        done();
      });

      manager.unregisterDriver('pico-logic-analyzer');
    });

    it('getAvailableDrivers应该是getRegisteredDrivers的别名', () => {
      const registered = manager.getRegisteredDrivers();
      const available = manager.getAvailableDrivers();
      
      expect(available).toEqual(registered);
    });
  });

  describe('设备检测系统核心算法', () => {
    it('应该正确处理空检测结果', async () => {
      // Mock所有检测器返回空结果
      const mockDetector: IDeviceDetector = {
        name: 'Empty Detector',
        detect: jest.fn().mockResolvedValue([])
      };
      
      (manager as any).detectors = [mockDetector];
      
      const devices = await manager.detectHardware();
      
      expect(devices).toEqual([]);
      expect(mockDetector.detect).toHaveBeenCalled();
    });

    it('应该正确处理检测器异常', async () => {
      const mockDetector: IDeviceDetector = {
        name: 'Failing Detector',
        detect: jest.fn().mockRejectedValue(new Error('Detection failed'))
      };
      
      (manager as any).detectors = [mockDetector];
      
      const devices = await manager.detectHardware();
      
      expect(devices).toEqual([]); // 应该返回空数组而不是抛出异常
      expect(mockDetector.detect).toHaveBeenCalled();
    });

    it('应该正确合并多个检测器的结果', async () => {
      const device1 = createTestDevice({ id: 'device1', connectionString: '/dev/ttyACM0', confidence: 0.8 });
      const device2 = createTestDevice({ id: 'device2', connectionString: '/dev/ttyACM1', confidence: 0.9 });
      const device3 = createTestDevice({ id: 'device3', connectionString: '/dev/ttyACM0', confidence: 0.7 }); // 相同connectionString，较低置信度
      
      const detector1: IDeviceDetector = {
        name: 'Detector 1',
        detect: jest.fn().mockResolvedValue([device1, device3])
      };
      
      const detector2: IDeviceDetector = {
        name: 'Detector 2',
        detect: jest.fn().mockResolvedValue([device2])
      };
      
      (manager as any).detectors = [detector1, detector2];
      
      const devices = await manager.detectHardware();
      
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual(device2); // 最高置信度优先
      expect(devices[1]).toEqual(device1); // device3被去重，选择较高置信度的device1
    });

    it('应该正确应用缓存机制', async () => {
      const testDevice = createTestDevice();
      const mockDetector: IDeviceDetector = {
        name: 'Cached Detector',
        detect: jest.fn().mockResolvedValue([testDevice])
      };
      
      (manager as any).detectors = [mockDetector];
      
      // 第一次调用
      const devices1 = await manager.detectHardware(true);
      expect(devices1).toEqual([testDevice]);
      expect(mockDetector.detect).toHaveBeenCalledTimes(1);
      
      // 第二次调用，应该使用缓存
      const devices2 = await manager.detectHardware(true);
      expect(devices2).toEqual([testDevice]);
      expect(mockDetector.detect).toHaveBeenCalledTimes(1); // 仍然是1次
    });

    it('应该正确处理禁用缓存的情况', async () => {
      const testDevice = createTestDevice();
      const mockDetector: IDeviceDetector = {
        name: 'No Cache Detector',
        detect: jest.fn().mockResolvedValue([testDevice])
      };
      
      (manager as any).detectors = [mockDetector];
      
      // 第一次调用
      await manager.detectHardware(false);
      expect(mockDetector.detect).toHaveBeenCalledTimes(1);
      
      // 第二次调用，禁用缓存
      await manager.detectHardware(false);
      expect(mockDetector.detect).toHaveBeenCalledTimes(2); // 调用了2次
    });

    it('应该触发devicesDetected事件', (done) => {
      const testDevice = createTestDevice();
      const mockDetector: IDeviceDetector = {
        name: 'Event Detector',
        detect: jest.fn().mockResolvedValue([testDevice])
      };
      
      (manager as any).detectors = [mockDetector];
      
      manager.on('devicesDetected', (devices: DetectedDevice[]) => {
        expect(devices).toEqual([testDevice]);
        done();
      });

      manager.detectHardware();
    });
  });

  describe('驱动匹配系统核心算法', () => {
    it('应该优先进行精确匹配', async () => {
      const device = createTestDevice({
        id: 'pico-analyzer-001',
        name: 'Pico Logic Analyzer'
      });

      const driver = await manager.matchDriver(device);
      
      expect(driver).toBeTruthy();
      expect(driver!.id).toBe('pico-logic-analyzer'); // 精确匹配pico设备
    });

    it('应该正确进行设备名称的精确匹配', async () => {
      const device = createTestDevice({
        id: 'unknown-device',
        name: 'Saleae Logic 16'
      });

      const driver = await manager.matchDriver(device);
      
      expect(driver).toBeTruthy();
      expect(driver!.id).toBe('saleae-logic'); // 基于名称匹配
    });

    it('应该回退到通用匹配 - serial设备', async () => {
      const device = createTestDevice({
        id: 'unknown-serial-device',
        name: 'Unknown Serial Device',
        type: 'serial'
      });

      const driver = await manager.matchDriver(device);
      
      expect(driver).toBeTruthy();
      expect(driver!.id).toBe('pico-logic-analyzer'); // serial设备的通用匹配
    });

    it('应该回退到通用匹配 - network设备', async () => {
      const device = createTestDevice({
        id: 'unknown-network-device',
        name: 'Unknown Network Device',
        type: 'network',
        driverType: AnalyzerDriverType.Network
      });

      const driver = await manager.matchDriver(device);
      
      expect(driver).toBeTruthy();
      expect(['saleae-logic', 'rigol-siglent', 'network-analyzer']).toContain(driver!.id);
    });

    it('应该回退到通用匹配 - USB设备', async () => {
      const device = createTestDevice({
        id: 'unknown-usb-device',
        name: 'Unknown USB Device',
        type: 'usb',
        driverType: AnalyzerDriverType.Serial
      });

      const driver = await manager.matchDriver(device);
      
      expect(driver).toBeTruthy();
      expect(driver!.id).toBe('sigrok-adapter'); // USB设备的通用匹配
    });

    it('应该处理无法匹配的设备', async () => {
      const device = createTestDevice({
        id: 'completely-unknown',
        name: 'Completely Unknown Device',
        type: 'unknown' as any
      });

      const driver = await manager.matchDriver(device);
      
      expect(driver).toBeNull();
    });
  });

  describe('实例创建系统核心算法', () => {
    it('应该正确创建标准驱动实例', async () => {
      const device = createTestDevice({
        id: 'pico-device',
        connectionString: '/dev/ttyACM0'
      });

      const driver = await manager.createDriver(device);
      
      expect(driver).toBe(mockLogicAnalyzerDriver);
      expect(LogicAnalyzerDriver).toHaveBeenCalledWith('/dev/ttyACM0');
    });

    it('应该正确创建NetworkLogicAnalyzerDriver实例', async () => {
      const device = createTestDevice({
        id: 'network-device',
        name: 'Network Logic Analyzer',
        type: 'network',
        connectionString: '192.168.1.100:8080',
        driverType: AnalyzerDriverType.Network
      });

      const driver = await manager.createDriver(device);
      
      expect(driver).toBe(mockNetworkDriver);
      expect(NetworkLogicAnalyzerDriver).toHaveBeenCalledWith('192.168.1.100', 8080);
    });

    it('应该正确解析网络连接字符串 - 缺少端口', async () => {
      const device = createTestDevice({
        id: 'network-device',
        name: 'Network Logic Analyzer',
        type: 'network',
        connectionString: '192.168.1.100',
        driverType: AnalyzerDriverType.Network
      });

      await manager.createDriver(device);
      
      expect(NetworkLogicAnalyzerDriver).toHaveBeenCalledWith('192.168.1.100', 24000); // 默认端口
    });

    it('应该正确解析网络连接字符串 - 空主机', async () => {
      const device = createTestDevice({
        id: 'network-device',
        name: 'Network Logic Analyzer',
        type: 'network',
        connectionString: ':8080',
        driverType: AnalyzerDriverType.Network
      });

      await manager.createDriver(device);
      
      expect(NetworkLogicAnalyzerDriver).toHaveBeenCalledWith('localhost', 8080); // 默认主机
    });

    it('应该正确创建SigrokAdapter实例', async () => {
      const device = createTestDevice({
        id: 'sigrok-device',
        name: 'Sigrok Device',
        type: 'usb',
        connectionString: 'fx2lafw:0001',
        driverType: AnalyzerDriverType.Serial
      });

      const driver = await manager.createDriver(device);
      
      expect(driver).toBe(mockSigrokAdapter);
      expect(SigrokAdapter).toHaveBeenCalledWith('fx2lafw', '0001');
    });

    it('应该正确解析Sigrok连接字符串 - 缺少设备ID', async () => {
      const device = createTestDevice({
        id: 'sigrok-device',
        name: 'Sigrok Device',
        type: 'usb',
        connectionString: 'hantek6022be:',
        driverType: AnalyzerDriverType.Serial
      });

      await manager.createDriver(device);
      
      expect(SigrokAdapter).toHaveBeenCalledWith('hantek6022be', ''); // 空设备ID
    });

    it('应该正确解析Sigrok连接字符串 - 缺少驱动', async () => {
      const device = createTestDevice({
        id: 'sigrok-device',
        name: 'Sigrok Device',
        type: 'usb',
        connectionString: ':device-001',
        driverType: AnalyzerDriverType.Serial
      });

      await manager.createDriver(device);
      
      expect(SigrokAdapter).toHaveBeenCalledWith('fx2lafw', 'device-001'); // 默认驱动
    });

    it('应该触发driverCreated事件', (done) => {
      const device = createTestDevice();

      manager.on('driverCreated', ({ device: eventDevice, driver, registration }) => {
        expect(eventDevice).toBe(device);
        expect(driver).toBe(mockLogicAnalyzerDriver);
        expect(registration.id).toBe('pico-logic-analyzer');
        done();
      });

      manager.createDriver(device);
    });

    it('应该处理无法找到匹配驱动的情况', async () => {
      const device = createTestDevice({
        id: 'unmatchable-device',
        name: 'Unmatchable Device',
        type: 'unknown' as any
      });

      await expect(manager.createDriver(device)).rejects.toThrow('No suitable driver found for device');
    });
  });

  describe('连接管理系统核心算法', () => {
    it('应该正确处理autodetect连接', async () => {
      const testDevice = createTestDevice();
      const mockDetector: IDeviceDetector = {
        name: 'Mock Detector',
        detect: jest.fn().mockResolvedValue([testDevice])
      };
      
      (manager as any).detectors = [mockDetector];

      const result = await manager.connectToDevice('autodetect');
      
      expect(result.success).toBe(true);
      expect(result.deviceInfo).toEqual({ name: 'Test Device' });
      expect(mockLogicAnalyzerDriver.connect).toHaveBeenCalled();
    });

    it('应该处理autodetect时无设备的情况', async () => {
      (manager as any).detectors = [{
        name: 'Empty Detector',
        detect: jest.fn().mockResolvedValue([])
      }];

      const result = await manager.connectToDevice('autodetect');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('未检测到任何设备');
    });

    it('应该正确处理network连接', async () => {
      const result = await manager.connectToDevice('network', {
        networkConfig: { host: '192.168.1.100', port: 8080 }
      });
      
      expect(result.success).toBe(true);
      expect(NetworkLogicAnalyzerDriver).toHaveBeenCalledWith('192.168.1.100', 8080);
      expect(mockNetworkDriver.connect).toHaveBeenCalled();
    });

    it('应该处理network连接缺少配置的情况', async () => {
      const result = await manager.connectToDevice('network');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('缺少网络配置参数');
    });

    it('应该正确处理指定deviceId连接', async () => {
      const testDevice = createTestDevice({ id: 'specific-device' });
      (manager as any).detectors = [{
        name: 'Specific Detector',
        detect: jest.fn().mockResolvedValue([testDevice])
      }];

      const result = await manager.connectToDevice('specific-device');
      
      expect(result.success).toBe(true);
      expect(mockLogicAnalyzerDriver.connect).toHaveBeenCalled();
    });

    it('应该处理直接连接字符串 - serial设备', async () => {
      const result = await manager.connectToDevice('/dev/ttyACM0');
      
      expect(result.success).toBe(true);
      expect(LogicAnalyzerDriver).toHaveBeenCalledWith('/dev/ttyACM0');
    });

    it('应该处理直接连接字符串 - network设备', async () => {
      const result = await manager.connectToDevice('192.168.1.100:8080');
      
      expect(result.success).toBe(true);
      expect(NetworkLogicAnalyzerDriver).toHaveBeenCalledWith('192.168.1.100', 8080);
    });

    it('应该正确处理设备切换', async () => {
      // 先连接第一个设备
      const device1 = createTestDevice({ id: 'device1' });
      (manager as any).detectors = [{
        name: 'Mock Detector',
        detect: jest.fn().mockResolvedValue([device1])
      }];

      await manager.connectToDevice('device1');
      expect(manager.getCurrentDevice()).toBe(mockLogicAnalyzerDriver);

      // 连接第二个设备，应该先断开第一个
      const device2 = createTestDevice({ id: 'device2' });
      (manager as any).detectors = [{
        name: 'Mock Detector',
        detect: jest.fn().mockResolvedValue([device2])
      }];

      await manager.connectToDevice('device2');
      
      expect(mockLogicAnalyzerDriver.disconnect).toHaveBeenCalled(); // 第一个设备被断开
      expect(manager.getCurrentDevice()).toBeTruthy(); // 有新的当前设备
    });

    it('应该触发deviceConnected事件', (done) => {
      const testDevice = createTestDevice();
      (manager as any).detectors = [{
        name: 'Event Detector',
        detect: jest.fn().mockResolvedValue([testDevice])
      }];

      manager.on('deviceConnected', ({ device, driver }) => {
        expect(device.id).toBe(testDevice.id);
        expect(driver).toBe(mockLogicAnalyzerDriver);
        done();
      });

      manager.connectToDevice(testDevice.id);
    });

    it('应该处理连接失败', async () => {
      mockLogicAnalyzerDriver.connect.mockResolvedValue({ 
        success: false, 
        error: 'Connection timeout' 
      });

      const result = await manager.connectToDevice('/dev/ttyACM0');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('autoConnect容错重试机制', () => {
    it('应该正确连接最高置信度设备', async () => {
      const devices = [
        createTestDevice({ id: 'device1', confidence: 0.9 }),
        createTestDevice({ id: 'device2', confidence: 0.7 }),
        createTestDevice({ id: 'device3', confidence: 0.8 })
      ];

      (manager as any).detectors = [{
        name: 'Multi Detector',
        detect: jest.fn().mockResolvedValue(devices)
      }];

      const driver = await manager.autoConnect();
      
      expect(driver).toBe(mockLogicAnalyzerDriver);
      expect(LogicAnalyzerDriver).toHaveBeenCalled();
    });

    it('应该正确实现容错重试机制', async () => {
      const devices = [
        createTestDevice({ id: 'failing-device', confidence: 0.9 }),
        createTestDevice({ id: 'working-device', confidence: 0.8 })
      ];

      (manager as any).detectors = [{
        name: 'Retry Detector',
        detect: jest.fn().mockResolvedValue(devices)
      }];

      // 模拟第一个设备匹配失败，第二个成功
      let callCount = 0;
      manager.matchDriver = jest.fn().mockImplementation((device) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(null); // 第一个设备匹配失败
        }
        return Promise.resolve(manager.getRegisteredDrivers()[0]); // 第二个设备成功
      });

      const driver = await manager.autoConnect();
      
      expect(driver).toBe(mockLogicAnalyzerDriver);
      expect(manager.matchDriver).toHaveBeenCalledTimes(2);
    });

    it('应该处理所有设备都连接失败的情况', async () => {
      const devices = [
        createTestDevice({ id: 'device1', confidence: 0.9 }),
        createTestDevice({ id: 'device2', confidence: 0.8 })
      ];

      (manager as any).detectors = [{
        name: 'Failing Detector',
        detect: jest.fn().mockResolvedValue(devices)
      }];

      manager.matchDriver = jest.fn().mockResolvedValue(null);

      await expect(manager.autoConnect()).rejects.toThrow('Failed to connect to any detected device');
    });

    it('应该处理无设备检测到的情况', async () => {
      (manager as any).detectors = [{
        name: 'Empty Detector',
        detect: jest.fn().mockResolvedValue([])
      }];

      await expect(manager.autoConnect()).rejects.toThrow('No compatible devices found');
    });

    it('应该限制重试最多3个设备', async () => {
      const devices = Array.from({ length: 5 }, (_, i) => 
        createTestDevice({ id: `device${i}`, confidence: 0.9 - i * 0.1 })
      );

      (manager as any).detectors = [{
        name: 'Many Devices Detector',
        detect: jest.fn().mockResolvedValue(devices)
      }];

      manager.matchDriver = jest.fn().mockResolvedValue(null); // 所有匹配都失败

      await expect(manager.autoConnect()).rejects.toThrow('Failed to connect to any detected device');
      
      // 应该最多尝试3个设备 (第一个 + 最多2个重试)
      expect(manager.matchDriver).toHaveBeenCalledTimes(3);
    });
  });

  describe('当前设备状态管理', () => {
    it('getCurrentDevice应该返回当前连接的设备', async () => {
      expect(manager.getCurrentDevice()).toBeNull();
      
      await manager.connectToDevice('/dev/ttyACM0');
      
      expect(manager.getCurrentDevice()).toBe(mockLogicAnalyzerDriver);
    });

    it('getCurrentDeviceInfo应该返回当前设备信息', async () => {
      expect(manager.getCurrentDeviceInfo()).toBeNull();
      
      await manager.connectToDevice('/dev/ttyACM0');
      
      const deviceInfo = manager.getCurrentDeviceInfo();
      expect(deviceInfo).toBeTruthy();
      expect(deviceInfo!.connectionString).toBe('/dev/ttyACM0');
    });

    it('disconnectCurrentDevice应该断开当前设备', async () => {
      await manager.connectToDevice('/dev/ttyACM0');
      expect(manager.getCurrentDevice()).not.toBeNull();
      
      await manager.disconnectCurrentDevice();
      
      expect(mockLogicAnalyzerDriver.disconnect).toHaveBeenCalled();
      expect(manager.getCurrentDevice()).toBeNull();
      expect(manager.getCurrentDeviceInfo()).toBeNull();
    });

    it('应该触发deviceDisconnected事件', (done) => {
      manager.connectToDevice('/dev/ttyACM0').then(() => {
        manager.on('deviceDisconnected', ({ device }) => {
          expect(device.connectionString).toBe('/dev/ttyACM0');
          done();
        });

        manager.disconnectCurrentDevice();
      });
    });

    it('disconnectCurrentDevice应该处理disconnect异常', async () => {
      await manager.connectToDevice('/dev/ttyACM0');
      
      mockLogicAnalyzerDriver.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      
      await manager.disconnectCurrentDevice(); // 不应该抛出异常
      
      expect(manager.getCurrentDevice()).toBeNull(); // 状态应该被清理
    });

    it('disconnectCurrentDevice对无当前设备应该安全处理', async () => {
      expect(manager.getCurrentDevice()).toBeNull();
      
      await expect(manager.disconnectCurrentDevice()).resolves.not.toThrow();
    });
  });

  describe('MultiAnalyzerDriver多设备支持', () => {
    it('应该正确创建多设备驱动', () => {
      const connectionStrings = ['/dev/ttyACM0', '/dev/ttyACM1'];
      
      const mockMultiDriver = {} as MultiAnalyzerDriver;
      (MultiAnalyzerDriver as jest.MockedClass<typeof MultiAnalyzerDriver>).mockImplementation(() => mockMultiDriver);
      
      const driver = manager.createMultiDeviceDriver(connectionStrings);
      
      expect(driver).toBe(mockMultiDriver);
      expect(MultiAnalyzerDriver).toHaveBeenCalledWith(connectionStrings);
    });

    it('应该拒绝少于2个连接的多设备驱动', () => {
      expect(() => {
        manager.createMultiDeviceDriver(['/dev/ttyACM0']);
      }).toThrow('多设备驱动需要2-5个连接字符串');
    });

    it('应该拒绝超过5个连接的多设备驱动', () => {
      const connectionStrings = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyACM2', '/dev/ttyACM3', '/dev/ttyACM4', '/dev/ttyACM5'];
      
      expect(() => {
        manager.createMultiDeviceDriver(connectionStrings);
      }).toThrow('多设备驱动需要2-5个连接字符串');
    });

    it('应该触发multiDriverCreated事件', (done) => {
      const connectionStrings = ['/dev/ttyACM0', '/dev/ttyACM1'];
      const mockMultiDriver = {} as MultiAnalyzerDriver;
      (MultiAnalyzerDriver as jest.MockedClass<typeof MultiAnalyzerDriver>).mockImplementation(() => mockMultiDriver);

      manager.on('multiDriverCreated', ({ connectionStrings: eventStrings, driver }) => {
        expect(eventStrings).toEqual(connectionStrings);
        expect(driver).toBe(mockMultiDriver);
        done();
      });

      manager.createMultiDeviceDriver(connectionStrings);
    });
  });

  describe('Sigrok设备支持', () => {
    it('应该正确获取支持的Sigrok设备列表', () => {
      const mockSigrokDevices = [
        { driver: 'fx2lafw', name: 'FX2 Logic Analyzer', channels: 16, maxRate: 24000000 },
        { driver: 'hantek-6022be', name: 'Hantek 6022BE', channels: 2, maxRate: 48000000 }
      ];

      (SigrokAdapter.getSupportedDevices as jest.Mock) = jest.fn().mockReturnValue(mockSigrokDevices);
      
      const devices = manager.getSupportedSigrokDevices();
      
      expect(devices).toEqual(mockSigrokDevices);
      expect(SigrokAdapter.getSupportedDevices).toHaveBeenCalled();
    });
  });

  describe('事件系统完整验证', () => {
    it('应该正确继承EventEmitter', () => {
      expect(manager).toBeInstanceOf(require('events').EventEmitter);
    });

    it('应该支持所有生命周期事件的监听', () => {
      const events = [
        'driverRegistered',
        'driverUnregistered', 
        'devicesDetected',
        'driverCreated',
        'multiDriverCreated',
        'deviceConnected',
        'deviceDisconnected'
      ];

      events.forEach(eventName => {
        const listener = jest.fn();
        manager.on(eventName, listener);
        
        expect(manager.listenerCount(eventName)).toBe(1);
        
        manager.off(eventName, listener);
        expect(manager.listenerCount(eventName)).toBe(0);
      });
    });
  });

  describe('边界条件和异常处理', () => {
    it('应该处理驱动构造函数异常', async () => {
      (LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>).mockImplementation(() => {
        throw new Error('Driver construction failed');
      });

      const device = createTestDevice();

      await expect(manager.createDriver(device)).rejects.toThrow('Failed to create driver for device');
    });

    it('应该处理连接参数异常', async () => {
      const result = await manager.connectToDevice('', { invalid: 'params' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('设备不存在或无法识别');
    });

    it('应该处理检测超时和异常', async () => {
      const slowDetector: IDeviceDetector = {
        name: 'Slow Detector',
        detect: () => new Promise(() => {}) // 永不解决的Promise
      };
      
      const fastDetector: IDeviceDetector = {
        name: 'Fast Detector',
        detect: jest.fn().mockResolvedValue([createTestDevice()])
      };
      
      (manager as any).detectors = [slowDetector, fastDetector];
      
      // 应该能够正常完成，不会被慢检测器阻塞
      const devices = await manager.detectHardware();
      
      expect(devices).toHaveLength(1);
      expect(fastDetector.detect).toHaveBeenCalled();
    });
  });
});