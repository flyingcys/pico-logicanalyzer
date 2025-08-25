/**
 * HardwareDriverManager 业务逻辑专项测试
 * 
 * 基于错误驱动学习优化的专项测试:
 * - 避免Jest配置中的自动Mock冲突
 * - 专注测试核心业务逻辑和管理算法
 * - 应用深度思考方法论，验证真实接口行为
 * - 最小化外部依赖，测试@src源码核心功能
 * 
 * 目标: 基于深度分析发现的问题，实现HardwareDriverManager重大突破
 */

import { AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

// 避免自动Mock冲突，手动实现功能性Mock
const mockLogicAnalyzerDriver = jest.fn().mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue({ success: true, deviceInfo: { name: 'Test Device' } }),
  disconnect: jest.fn().mockResolvedValue(undefined),
  deviceVersion: 'MockDriver-v1.0',
  driverType: AnalyzerDriverType.Serial,
  isNetwork: false
}));

const mockSaleaeLogicDriver = jest.fn().mockImplementation(() => ({ 
  deviceVersion: 'SaleaeDriver-v1.0',
  connect: jest.fn(),
  disconnect: jest.fn()
}));

const mockRigolSiglentDriver = jest.fn().mockImplementation(() => ({ 
  deviceVersion: 'RigolSiglentDriver-v1.0',
  connect: jest.fn(),
  disconnect: jest.fn()
}));

const mockSigrokAdapter = jest.fn().mockImplementation(() => ({ 
  deviceVersion: 'SigrokAdapter-v1.0',
  connect: jest.fn(),
  disconnect: jest.fn()
}));
(mockSigrokAdapter as any).getSupportedDevices = jest.fn().mockReturnValue([
  { driver: 'fx2lafw', name: 'FX2 Logic Analyzer', channels: 16, maxRate: 24000000 }
]);

const mockNetworkLogicAnalyzerDriver = jest.fn().mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue({ success: true, deviceInfo: { name: 'Network Device' } }),
  disconnect: jest.fn().mockResolvedValue(undefined),
  deviceVersion: 'NetworkDriver-v1.0',
  driverType: AnalyzerDriverType.Network,
  isNetwork: true
}));

const mockMultiAnalyzerDriver = jest.fn().mockImplementation(() => ({
  deviceVersion: 'MultiAnalyzerDriver-v1.0',
  connect: jest.fn(),
  disconnect: jest.fn()
}));

// 模块级Mock配置
jest.mock('../../../src/drivers/LogicAnalyzerDriver', () => ({
  LogicAnalyzerDriver: mockLogicAnalyzerDriver
}));

jest.mock('../../../src/drivers/SaleaeLogicDriver', () => ({
  SaleaeLogicDriver: mockSaleaeLogicDriver
}));

jest.mock('../../../src/drivers/RigolSiglentDriver', () => ({
  RigolSiglentDriver: mockRigolSiglentDriver
}));

jest.mock('../../../src/drivers/SigrokAdapter', () => ({
  SigrokAdapter: mockSigrokAdapter
}));

jest.mock('../../../src/drivers/NetworkLogicAnalyzerDriver', () => ({
  NetworkLogicAnalyzerDriver: mockNetworkLogicAnalyzerDriver
}));

jest.mock('../../../src/drivers/MultiAnalyzerDriver', () => ({
  MultiAnalyzerDriver: mockMultiAnalyzerDriver
}));

// 确保获得真实的HardwareDriverManager类，绕过Jest配置中的Mock
jest.doMock('../../../src/drivers/HardwareDriverManager', () => jest.requireActual('../../../src/drivers/HardwareDriverManager'));

// 在Mock配置完成后，导入真实的HardwareDriverManager
const { HardwareDriverManager } = jest.requireActual('../../../src/drivers/HardwareDriverManager');

describe('HardwareDriverManager 业务逻辑专项测试', () => {
  let manager: InstanceType<typeof HardwareDriverManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new HardwareDriverManager();
  });

  describe('基础功能验证', () => {
    it('应该成功创建HardwareDriverManager实例', () => {
      expect(manager).toBeInstanceOf(HardwareDriverManager);
    });

    it('应该正确继承EventEmitter功能', () => {
      // 验证EventEmitter方法存在
      expect(typeof manager.on).toBe('function');
      expect(typeof manager.emit).toBe('function');
      expect(typeof manager.off).toBe('function');
      
      // 验证事件系统工作
      const mockListener = jest.fn();
      manager.on('test-event', mockListener);
      manager.emit('test-event', 'test-data');
      
      expect(mockListener).toHaveBeenCalledWith('test-data');
    });

    it('应该正确初始化内置驱动', () => {
      const drivers = manager.getRegisteredDrivers();
      
      expect(drivers).toHaveLength(5);
      expect(drivers[0].id).toBe('pico-logic-analyzer');
      expect(drivers[0].priority).toBe(100);
      expect(drivers[1].id).toBe('saleae-logic');
      expect(drivers[1].priority).toBe(90);
    });

    it('应该按优先级降序排列驱动', () => {
      const drivers = manager.getRegisteredDrivers();
      
      for (let i = 0; i < drivers.length - 1; i++) {
        expect(drivers[i].priority).toBeGreaterThanOrEqual(drivers[i + 1].priority);
      }
    });
  });

  describe('驱动管理核心算法', () => {
    it('应该正确注册新驱动', () => {
      const customDriver = {
        id: 'custom-driver',
        name: 'Custom Driver',
        description: 'Test custom driver',
        version: '1.0.0',
        driverClass: mockLogicAnalyzerDriver as any,
        supportedDevices: ['custom'],
        priority: 120
      };

      manager.registerDriver(customDriver);
      
      const drivers = manager.getRegisteredDrivers();
      expect(drivers[0]).toEqual(customDriver); // 最高优先级
      expect(drivers).toHaveLength(6); // 原5个+新1个
    });

    it('应该触发driverRegistered事件', (done) => {
      const customDriver = {
        id: 'event-test-driver',
        name: 'Event Test Driver',
        description: 'Test event driver',
        version: '1.0.0',
        driverClass: mockLogicAnalyzerDriver as any,
        supportedDevices: ['event-test'],
        priority: 50
      };
      
      manager.on('driverRegistered', (registration: any) => {
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

  describe('设备检测和匹配算法', () => {
    it('应该处理空检测结果', async () => {
      // 模拟空检测器
      const emptyDetector = {
        name: 'Empty Detector',
        detect: jest.fn().mockResolvedValue([])
      };
      
      (manager as any).detectors = [emptyDetector];
      
      const devices = await manager.detectHardware();
      
      expect(devices).toEqual([]);
      expect(emptyDetector.detect).toHaveBeenCalled();
    });

    it('应该正确匹配pico设备', async () => {
      const picoDevice = {
        id: 'pico-analyzer-001',
        name: 'Pico Logic Analyzer',
        type: 'serial' as const,
        connectionString: '/dev/ttyACM0',
        driverType: AnalyzerDriverType.Serial,
        confidence: 0.9
      };

      const driver = await manager.matchDriver(picoDevice);
      
      expect(driver).toBeTruthy();
      expect(driver!.id).toBe('pico-logic-analyzer');
    });

    it('应该正确处理network设备匹配', async () => {
      const networkDevice = {
        id: 'network-device',
        name: 'Network Logic Analyzer',
        type: 'network' as const,
        connectionString: '192.168.1.100:8080',
        driverType: AnalyzerDriverType.Network,
        confidence: 0.8
      };

      const driver = await manager.matchDriver(networkDevice);
      
      expect(driver).toBeTruthy();
      expect(['saleae-logic', 'rigol-siglent', 'network-analyzer']).toContain(driver!.id);
    });

    it('应该处理无法匹配的设备', async () => {
      const unknownDevice = {
        id: 'unknown-device',
        name: 'Unknown Device',
        type: 'unknown' as any,
        connectionString: 'unknown://connection',
        driverType: AnalyzerDriverType.Serial,
        confidence: 0.5
      };

      const driver = await manager.matchDriver(unknownDevice);
      
      expect(driver).toBeNull();
    });
  });

  describe('驱动实例创建算法', () => {
    it('应该正确创建标准驱动实例', async () => {
      const device = {
        id: 'pico-device',
        name: 'Pico Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyACM0',
        driverType: AnalyzerDriverType.Serial,
        confidence: 0.9
      };

      const driver = await manager.createDriver(device);
      
      expect(driver).toBeTruthy();
      expect(mockLogicAnalyzerDriver).toHaveBeenCalledWith('/dev/ttyACM0');
    });

    it('应该正确创建NetworkLogicAnalyzerDriver实例', async () => {
      const device = {
        id: 'network-device',
        name: 'Network Logic Analyzer',
        type: 'network' as const,
        connectionString: '192.168.1.100:8080',
        driverType: AnalyzerDriverType.Network,
        confidence: 0.8
      };

      const driver = await manager.createDriver(device);
      
      expect(driver).toBeTruthy();
      expect(mockNetworkLogicAnalyzerDriver).toHaveBeenCalledWith('192.168.1.100', 8080);
    });

    it('应该触发driverCreated事件', (done) => {
      const device = {
        id: 'event-test-device',
        name: 'Event Test Device',
        type: 'serial' as const,
        connectionString: '/dev/ttyACM1',
        driverType: AnalyzerDriverType.Serial,
        confidence: 0.8
      };

      manager.on('driverCreated', ({ device: eventDevice, driver, registration }) => {
        expect(eventDevice).toBe(device);
        expect(driver).toBeTruthy();
        expect(registration.id).toBe('pico-logic-analyzer');
        done();
      });

      manager.createDriver(device);
    });
  });

  describe('MultiAnalyzerDriver支持', () => {
    it('应该正确创建多设备驱动', () => {
      const connectionStrings = ['/dev/ttyACM0', '/dev/ttyACM1'];
      
      const driver = manager.createMultiDeviceDriver(connectionStrings);
      
      expect(driver).toBeTruthy();
      expect(mockMultiAnalyzerDriver).toHaveBeenCalledWith(connectionStrings);
    });

    it('应该拒绝少于2个连接的多设备驱动', () => {
      expect(() => {
        manager.createMultiDeviceDriver(['/dev/ttyACM0']);
      }).toThrow('多设备驱动需要2-5个连接字符串');
    });

    it('应该拒绝超过5个连接的多设备驱动', () => {
      const tooManyConnections = Array.from({ length: 6 }, (_, i) => `/dev/ttyACM${i}`);
      
      expect(() => {
        manager.createMultiDeviceDriver(tooManyConnections);
      }).toThrow('多设备驱动需要2-5个连接字符串');
    });

    it('应该触发multiDriverCreated事件', (done) => {
      const connectionStrings = ['/dev/ttyACM0', '/dev/ttyACM1'];

      manager.on('multiDriverCreated', ({ connectionStrings: eventStrings, driver }) => {
        expect(eventStrings).toEqual(connectionStrings);
        expect(driver).toBeTruthy();
        done();
      });

      manager.createMultiDeviceDriver(connectionStrings);
    });
  });

  describe('Sigrok设备支持', () => {
    it('应该正确获取支持的Sigrok设备列表', () => {
      const devices = manager.getSupportedSigrokDevices();
      
      expect(devices).toEqual([
        { driver: 'fx2lafw', name: 'FX2 Logic Analyzer', channels: 16, maxRate: 24000000 }
      ]);
      expect((mockSigrokAdapter as any).getSupportedDevices).toHaveBeenCalled();
    });
  });

  describe('资源管理和清理', () => {
    it('应该正确清理所有资源', async () => {
      // 模拟活动连接
      const mockDriver = {
        disconnect: jest.fn().mockResolvedValue(undefined)
      };
      
      (manager as any).activeConnections.set('test-connection', mockDriver);
      
      await manager.dispose();
      
      expect(mockDriver.disconnect).toHaveBeenCalled();
      expect((manager as any).activeConnections.size).toBe(0);
    });

    it('应该正确处理清理过程中的异常', async () => {
      const failingDriver = {
        disconnect: jest.fn().mockRejectedValue(new Error('Disconnect failed'))
      };
      
      (manager as any).activeConnections.set('failing-connection', failingDriver);
      
      await expect(manager.dispose()).resolves.not.toThrow();
      expect((manager as any).activeConnections.size).toBe(0);
    });
  });

  describe('连接状态管理', () => {
    it('getCurrentDevice应该返回当前连接的设备', () => {
      expect(manager.getCurrentDevice()).toBeNull();
    });

    it('getCurrentDeviceInfo应该返回当前设备信息', () => {
      expect(manager.getCurrentDeviceInfo()).toBeNull();
    });

    it('isDeviceConnected应该返回连接状态', () => {
      expect(manager.isDeviceConnected()).toBe(false);
    });

    it('getActiveConnections应该返回活动连接的副本', () => {
      const connections = manager.getActiveConnections();
      
      expect(connections).toBeInstanceOf(Map);
      expect(connections.size).toBe(0);
    });
  });
});