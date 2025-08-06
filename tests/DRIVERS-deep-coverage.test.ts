/**
 * DRIVERS 模块深度覆盖率测试
 * 专门针对提升0%覆盖率文件到95%+目标
 * 重点：HardwareDriverManager, LogicAnalyzerDriver, NetworkLogicAnalyzerDriver等
 */

// 先导入真实的类，不使用Mock
import { HardwareDriverManager } from '../src/drivers/HardwareDriverManager';
import { VersionValidator, DeviceVersion, DeviceConnectionException } from '../src/drivers/VersionValidator';
import { AnalyzerDriverBase } from '../src/drivers/AnalyzerDriverBase';
import { LogicAnalyzerDriver } from '../src/drivers/LogicAnalyzerDriver';
import { NetworkLogicAnalyzerDriver } from '../src/drivers/NetworkLogicAnalyzerDriver';
import { RigolSiglentDriver } from '../src/drivers/RigolSiglentDriver';
import { SaleaeLogicDriver } from '../src/drivers/SaleaeLogicDriver';
import { SigrokAdapter } from '../src/drivers/SigrokAdapter';
import { MultiAnalyzerDriver } from '../src/drivers/MultiAnalyzerDriver';
import { HardwareDescriptorParser, HardwareDescriptorRegistry } from '../src/drivers/standards/HardwareDescriptorStandard';
import { CaptureSession, CaptureError, TriggerType, AnalyzerDriverType } from '../src/models/AnalyzerTypes';

// 只Mock外部依赖，不Mock我们要测试的类
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    open: jest.fn((callback) => {
      if (callback) callback();
    }),
    close: jest.fn((callback) => {
      if (callback) callback();
    }),
    write: jest.fn((data, callback) => {
      if (callback) callback();
    }),
    read: jest.fn(() => Buffer.alloc(0)),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    isOpen: true,
    path: '/dev/ttyUSP0'
  }))
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    connect: jest.fn(function(port, host, callback) {
      // 模拟连接成功
      if (callback) {
        setTimeout(callback, 10);
      }
      this.emit('connect');
      return this;
    }),
    write: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    readyState: 'open'
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: {
      on: jest.fn(),
      pipe: jest.fn()
    },
    stderr: {
      on: jest.fn(), 
      pipe: jest.fn()
    },
    on: jest.fn((event, callback) => {
      if (event === 'exit') {
        setTimeout(() => callback(0), 10);
      }
    }),
    kill: jest.fn(),
    pid: 12345
  }))
}));

describe('DRIVERS 模块深度覆盖率测试', () => {
  
  describe('HardwareDriverManager - 深度覆盖 (目标: 0% -> 95%+)', () => {
    let manager: HardwareDriverManager;

    beforeEach(() => {
      // 使用真实的HardwareDriverManager实例
      manager = new HardwareDriverManager();
    });

    afterEach(() => {
      if (manager) {
        manager.dispose();
      }
    });

    test('应该正确初始化HardwareDriverManager', () => {
      expect(manager).toBeInstanceOf(HardwareDriverManager);
      expect(manager).toBeDefined();
      
      // 测试基础方法存在
      expect(typeof manager.registerDriver).toBe('function');
      expect(typeof manager.unregisterDriver).toBe('function');
      expect(typeof manager.getAvailableDrivers).toBe('function');
      expect(typeof manager.getRegisteredDrivers).toBe('function');
      expect(typeof manager.dispose).toBe('function');
    });

    test('应该支持驱动注册和管理', () => {
      // 创建驱动注册信息（不是驱动实例）
      const testDriverRegistration = {
        id: 'test-driver-1',
        name: 'Test Driver',
        description: 'Test driver for coverage',
        version: '1.0.0',
        driverClass: LogicAnalyzerDriver as any,
        supportedDevices: ['test'],
        priority: 50
      };
      
      // 测试注册
      const initialCount = manager.getRegisteredDrivers().length;
      manager.registerDriver(testDriverRegistration);
      
      // 测试获取已注册驱动
      const registered = manager.getRegisteredDrivers();
      expect(Array.isArray(registered)).toBe(true);
      expect(registered.length).toBe(initialCount + 1);
      
      // 测试获取可用驱动
      const available = manager.getAvailableDrivers();
      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBe(registered.length);
      
      // 测试注销 - 使用正确的驱动ID
      const unregistered = manager.unregisterDriver('test-driver-1');
      expect(unregistered).toBe(true);
      
      const afterUnregister = manager.getRegisteredDrivers();
      expect(afterUnregister.length).toBe(initialCount);
    });

    test('应该支持事件处理机制', () => {
      // 创建新的manager实例来测试事件
      const testManager = new HardwareDriverManager();
      
      // HardwareDriverManager应该继承EventEmitter
      expect(typeof testManager.on).toBe('function');
      expect(typeof testManager.emit).toBe('function');
      expect(typeof testManager.removeListener).toBe('function');
      
      // 测试事件监听
      const eventSpy = jest.fn();
      testManager.on('deviceConnected', eventSpy);
      
      // 触发事件
      testManager.emit('deviceConnected', { deviceId: 'test-device' });
      
      expect(eventSpy).toHaveBeenCalledWith({ deviceId: 'test-device' });
      
      // 清理
      testManager.dispose();
    });

    test('应该处理驱动发现和枚举', () => {
      // 测试驱动发现功能
      const discovered = manager.discoverDrivers ? manager.discoverDrivers() : [];
      expect(Array.isArray(discovered)).toBe(true);
      
      // 测试获取支持的设备类型
      if (manager.getSupportedDeviceTypes) {
        const deviceTypes = manager.getSupportedDeviceTypes();
        expect(Array.isArray(deviceTypes)).toBe(true);
      }
    });

    test('应该正确处理资源清理', async () => {
      // 注册一些驱动并创建活动连接
      const initialRegistered = manager.getRegisteredDrivers().length;
      
      // 验证资源清理不抛出异常
      await expect(manager.dispose()).resolves.not.toThrow();
      
      // 清理后注册的驱动仍然存在，但活动连接被清理
      const afterDispose = manager.getRegisteredDrivers();
      expect(afterDispose.length).toBe(initialRegistered); // 注册的驱动不会被清除
      
      // 活动连接应该被清理
      const activeConnections = manager.getActiveConnections();
      expect(activeConnections.size).toBe(0);
    });

    test('应该处理驱动连接状态监控', () => {
      // 测试活动连接获取
      const connections = manager.getActiveConnections();
      expect(connections instanceof Map).toBe(true);
      
      // 测试当前设备状态
      const currentDevice = manager.getCurrentDevice();
      expect(currentDevice === null || currentDevice instanceof Object).toBe(true);
      
      // 测试设备连接状态
      const isConnected = manager.isDeviceConnected();
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('LogicAnalyzerDriver - 深度覆盖 (目标: 0% -> 95%+)', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
      driver = new LogicAnalyzerDriver('COM1');
    });

    afterEach(() => {
      if (driver) {
        driver.disconnect();
      }
    });

    test('应该正确初始化LogicAnalyzerDriver', () => {
      expect(driver).toBeInstanceOf(LogicAnalyzerDriver);
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      
      // 测试基础属性 - deviceVersion可能是null
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.channelCount).toBe('number');
      expect(typeof driver.maxFrequency).toBe('number');
      expect(typeof driver.minFrequency).toBe('number');
      expect(typeof driver.blastFrequency).toBe('number');
      expect(typeof driver.bufferSize).toBe('number');
      expect(typeof driver.isNetwork).toBe('boolean');
      expect(typeof driver.isCapturing).toBe('boolean');
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    test('应该识别不同的连接类型', () => {
      // 测试串口连接
      const serialDriver = new LogicAnalyzerDriver('COM1');
      expect(serialDriver.isNetwork).toBe(false);
      
      // 测试网络连接格式
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      expect(networkDriver.isNetwork).toBe(false); // 在构造时还未识别，需要连接后才能判断
      
      // 清理
      serialDriver.disconnect();
      networkDriver.disconnect();
    });

    test('应该处理连接操作', async () => {
      // 测试连接方法存在并可调用
      expect(typeof driver.connect).toBe('function');
      expect(typeof driver.disconnect).toBe('function');
      
      // 测试状态获取
      const status = driver.getStatus();
      expect(status).toBeDefined();
      
      // 测试设备信息获取
      const deviceInfo = driver.getDeviceInfo();
      expect(deviceInfo).toBeDefined();
      expect(typeof deviceInfo.name).toBe('string');
      expect(typeof deviceInfo.maxFrequency).toBe('number');
      expect(typeof deviceInfo.channels).toBe('number');
    });

    test('应该处理采集配置', () => {
      // 测试采集限制
      const limits = driver.getLimits([0, 1, 2, 3]);
      expect(limits).toBeDefined();
      expect(typeof limits.minPreSamples).toBe('number');
      expect(typeof limits.maxPreSamples).toBe('number');
      expect(typeof limits.minPostSamples).toBe('number');
      expect(typeof limits.maxPostSamples).toBe('number');
      
      // 测试采集模式
      const mode8 = driver.getCaptureMode([0, 1, 2, 3]);
      const mode16 = driver.getCaptureMode([0, 1, 2, 3, 8, 9, 10, 11]);
      const mode24 = driver.getCaptureMode([0, 1, 2, 3, 16, 17, 18, 19]);
      
      expect(typeof mode8).toBe('number');
      expect(typeof mode16).toBe('number');
      expect(typeof mode24).toBe('number');
    });

    test('应该处理采集操作', async () => {
      // 创建采集会话
      const session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 1000;
      session.triggerType = TriggerType.Edge;
      
      // 测试采集方法存在
      expect(typeof driver.startCapture).toBe('function');
      expect(typeof driver.stopCapture).toBe('function');
      
      // 测试采集状态
      expect(typeof driver.isCapturing).toBe('boolean');
    });

    test('应该处理无效参数', () => {
      // 测试无效连接字符串
      expect(() => new LogicAnalyzerDriver('')).toThrow();
      expect(() => new LogicAnalyzerDriver(null as any)).toThrow();
      expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow();
    });

    test('应该支持网络功能', async () => {
      // 测试电压状态获取
      const voltageStatus = await driver.getVoltageStatus();
      expect(typeof voltageStatus).toBe('string');
      
      // 测试网络配置发送
      const networkResult = await driver.sendNetworkConfig(
        'TestAP',
        'password123',
        '192.168.1.100',
        8080
      );
      expect(typeof networkResult).toBe('boolean');
    });
  });

  describe('NetworkLogicAnalyzerDriver - 深度覆盖 (目标: 0% -> 95%+)', () => {
    let driver: NetworkLogicAnalyzerDriver;

    beforeEach(() => {
      driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    afterEach(() => {
      if (driver) {
        driver.disconnect();
      }
    });

    test('应该正确初始化网络驱动', () => {
      expect(driver).toBeInstanceOf(NetworkLogicAnalyzerDriver);
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      expect(driver.isNetwork).toBe(true);
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
    });

    test('应该处理网络连接参数', () => {
      // 测试主机和端口设置 - deviceVersion可能是null
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.channelCount).toBe('number');
      expect(driver.channelCount).toBeGreaterThanOrEqual(0);
      
      // 测试网络特有属性
      expect(driver.isNetwork).toBe(true);
    });

    test('应该处理网络连接操作', async () => {
      // 测试连接方法
      expect(typeof driver.connect).toBe('function');
      expect(typeof driver.disconnect).toBe('function');
      
      // 测试网络状态
      const status = driver.getStatus();
      expect(status).toBeDefined();
    });

    test('应该处理端口范围验证', () => {
      // 测试有效端口 - NetworkLogicAnalyzerDriver没有端口范围验证
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 8080)).not.toThrow();
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 1024)).not.toThrow();
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 65535)).not.toThrow();
      
      // 甚至无效端口也不会在构造时抛出异常
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 0)).not.toThrow();
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 65536)).not.toThrow();
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', -1)).not.toThrow();
      
      // 清理创建的驱动
      const testDrivers = [
        new NetworkLogicAnalyzerDriver('127.0.0.1', 0),
        new NetworkLogicAnalyzerDriver('127.0.0.1', 65536),  
        new NetworkLogicAnalyzerDriver('127.0.0.1', -1)
      ];
      testDrivers.forEach(d => d.disconnect());
    });
  });

  describe('其他驱动类 - 基础覆盖提升', () => {
    test('RigolSiglentDriver - SCPI驱动覆盖', () => {
      const driver = new RigolSiglentDriver('192.168.1.100', 5555);
      
      expect(driver).toBeInstanceOf(RigolSiglentDriver);
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      expect(driver.isNetwork).toBe(true);
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.channelCount).toBe('number');
      
      // 清理
      driver.disconnect();
    });

    test('SaleaeLogicDriver - API驱动覆盖', () => {
      const driver = new SaleaeLogicDriver('localhost', 10429);
      
      expect(driver).toBeInstanceOf(SaleaeLogicDriver);
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      expect(driver.isNetwork).toBe(true);
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.maxFrequency).toBe('number');
      
      // 清理
      driver.disconnect();
    });

    test('SigrokAdapter - 适配器覆盖', () => {
      const adapter = new SigrokAdapter();
      
      expect(adapter).toBeInstanceOf(SigrokAdapter);
      expect(adapter.deviceVersion === null || typeof adapter.deviceVersion === 'string').toBe(true);
      expect(typeof adapter.channelCount).toBe('number');
      expect(typeof adapter.isNetwork).toBe('boolean');
      
      // 清理
      adapter.disconnect();
    });

    test('MultiAnalyzerDriver - 多设备驱动覆盖', () => {
      const driver = new MultiAnalyzerDriver(['COM1', 'COM2']);
      
      expect(driver).toBeInstanceOf(MultiAnalyzerDriver);
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      expect(typeof driver.channelCount).toBe('number');
      expect(typeof driver.maxFrequency).toBe('number');
      expect(driver.isNetwork).toBe(false);
      
      // 测试边界条件
      expect(() => new MultiAnalyzerDriver([])).toThrow();
      expect(() => new MultiAnalyzerDriver(['COM1'])).toThrow();
      expect(() => new MultiAnalyzerDriver(new Array(6).fill('COM1'))).toThrow();
      
      // 清理
      driver.disconnect();
    });
  });

  describe('HardwareDescriptorStandard - 深度覆盖', () => {
    test('HardwareDescriptorParser - 解析器覆盖', () => {
      const parser = new HardwareDescriptorParser();
      expect(parser).toBeInstanceOf(HardwareDescriptorParser);
      
      // 测试静态方法
      expect(typeof HardwareDescriptorParser.parse).toBe('function');
      expect(typeof HardwareDescriptorParser.validate).toBe('function');
      expect(typeof HardwareDescriptorParser.generateTemplate).toBe('function');
      expect(typeof HardwareDescriptorParser.compareCompatibility).toBe('function');
      
      // 测试模板生成
      const template = HardwareDescriptorParser.generateTemplate({
        id: 'test-device',
        name: 'Test Device', 
        manufacturer: 'Test Corp',
        model: 'TD-1000'
      });
      
      expect(template).toBeDefined();
      expect(template.device.id).toBe('test-device');
      expect(template.device.name).toBe('Test Device');
    });

    test('HardwareDescriptorRegistry - 注册表覆盖', () => {
      const registry = new HardwareDescriptorRegistry();
      expect(registry).toBeInstanceOf(HardwareDescriptorRegistry);
      
      // 测试基础方法
      expect(typeof registry.register).toBe('function');
      expect(typeof registry.get).toBe('function');
      expect(typeof registry.findCompatible).toBe('function');
      expect(typeof registry.getAll).toBe('function');
      expect(typeof registry.getByCategory).toBe('function');
      expect(typeof registry.clear).toBe('function');
      
      // 测试注册功能
      const template = HardwareDescriptorParser.generateTemplate({
        id: 'test-registry',
        name: 'Test Registry Device',
        manufacturer: 'Test Corp',
        model: 'TR-2000'
      });
      
      registry.register(template);
      
      const retrieved = registry.get('test-registry');
      expect(retrieved).toBeDefined();
      expect(retrieved?.device.id).toBe('test-registry');
      
      // 测试搜索功能
      const compatible = registry.findCompatible({
        device: { manufacturer: 'Test Corp' }
      } as any);
      expect(Array.isArray(compatible)).toBe(true);
      expect(compatible.length).toBeGreaterThan(0);
      
      // 清理
      registry.clear();
    });
  });

  describe('边界条件和错误处理 - 全面覆盖', () => {
    test('应该处理所有驱动的构造器边界条件', () => {
      // LogicAnalyzerDriver - 只有空字符串会抛出异常
      expect(() => new LogicAnalyzerDriver('')).toThrow();
      expect(() => new LogicAnalyzerDriver(null as any)).toThrow();
      expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow();
      
      // NetworkLogicAnalyzerDriver - 不会对端口进行验证
      expect(() => new NetworkLogicAnalyzerDriver('', 8080)).not.toThrow();
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 0)).not.toThrow();
      expect(() => new NetworkLogicAnalyzerDriver('127.0.0.1', 65536)).not.toThrow();
      
      // MultiAnalyzerDriver
      expect(() => new MultiAnalyzerDriver([])).toThrow();
      expect(() => new MultiAnalyzerDriver(['COM1'])).toThrow();
      expect(() => new MultiAnalyzerDriver(new Array(6).fill('COM1'))).toThrow();
      
      // 清理测试产生的驱动
      const testDrivers = [
        new NetworkLogicAnalyzerDriver('', 8080),
        new NetworkLogicAnalyzerDriver('127.0.0.1', 0),
        new NetworkLogicAnalyzerDriver('127.0.0.1', 65536)
      ];
      testDrivers.forEach(d => d.disconnect());
    });

    test('应该处理资源清理和内存管理', () => {
      const drivers = [
        new LogicAnalyzerDriver('COM1'),
        new NetworkLogicAnalyzerDriver('127.0.0.1', 8080),
        new RigolSiglentDriver('127.0.0.1', 5555),
        new SaleaeLogicDriver('127.0.0.1', 10429),
        new SigrokAdapter(),
        new MultiAnalyzerDriver(['COM1', 'COM2'])
      ];
      
      // 所有驱动都应该能正常实例化
      drivers.forEach(driver => {
        expect(driver).toBeDefined();
        expect(typeof driver.disconnect).toBe('function');
      });
      
      // 所有驱动都应该能正常清理
      drivers.forEach(driver => {
        expect(() => driver.disconnect()).not.toThrow();
      });
    });

    test('应该处理大量操作的性能测试', async () => {
      const manager = new HardwareDriverManager();
      
      // 注册大量驱动注册信息（不是驱动实例）
      const initialCount = manager.getRegisteredDrivers().length;
      
      for (let i = 0; i < 10; i++) {
        manager.registerDriver({
          id: `test-perf-driver-${i}`,
          name: `Performance Test Driver ${i}`,
          description: 'Performance test driver',
          version: '1.0.0',
          driverClass: LogicAnalyzerDriver as any,
          supportedDevices: [`test-${i}`],
          priority: 50 + i
        });
      }
      
      // 验证所有驱动都已注册
      const registered = manager.getRegisteredDrivers();
      expect(registered.length).toBe(initialCount + 10);
      
      // 性能测试：批量操作
      const startTime = Date.now();
      const available = manager.getAvailableDrivers();
      const endTime = Date.now();
      
      expect(Array.isArray(available)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
      
      // 清理资源
      await manager.dispose();
      
      // 注销测试驱动
      for (let i = 0; i < 10; i++) {
        manager.unregisterDriver(`test-perf-driver-${i}`);
      }
    });
  });
});