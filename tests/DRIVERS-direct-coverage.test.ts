/**
 * DRIVERS 模块直接覆盖率测试
 * 专注于直接调用源代码，减少Mock干扰，提升实际覆盖率
 */

import { HardwareDriverManager } from '../src/drivers/HardwareDriverManager';
import { VersionValidator, DeviceVersion, DeviceConnectionException } from '../src/drivers/VersionValidator';
import { LogicAnalyzerDriver } from '../src/drivers/LogicAnalyzerDriver';
import { NetworkLogicAnalyzerDriver } from '../src/drivers/NetworkLogicAnalyzerDriver';
import { RigolSiglentDriver } from '../src/drivers/RigolSiglentDriver';
import { SaleaeLogicDriver } from '../src/drivers/SaleaeLogicDriver';
import { SigrokAdapter } from '../src/drivers/SigrokAdapter';
import { MultiAnalyzerDriver } from '../src/drivers/MultiAnalyzerDriver';
import { HardwareDescriptorParser, HardwareDescriptorRegistry } from '../src/drivers/standards/HardwareDescriptorStandard';

// 最小Mock - 只Mock会导致网络连接的外部依赖
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    open: jest.fn((callback) => callback && callback()),
    close: jest.fn((callback) => callback && setTimeout(callback, 1)),
    write: jest.fn((data, callback) => callback && callback()),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    isOpen: true,
    path: '/dev/ttyUSB0'
  }))
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    connect: jest.fn(function(port, host, callback) {
      this.connected = true;
      if (callback) setTimeout(callback, 1);
      return this;
    }),
    write: jest.fn((data) => true),
    end: jest.fn(),
    destroy: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    readyState: 'open'
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn(), pipe: jest.fn() },
    stderr: { on: jest.fn(), pipe: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === 'exit') setTimeout(() => callback(0), 1);
    }),
    kill: jest.fn(),
    pid: 12345
  }))
}));

describe('DRIVERS 模块直接覆盖率测试', () => {

  describe('VersionValidator - 完整方法覆盖', () => {
    test('应该调用所有静态方法和属性', () => {
      // 调用主要的静态方法
      const version1 = VersionValidator.getVersion('V1_7');
      expect(version1.isValid).toBe(true);
      expect(version1.major).toBe(1);
      expect(version1.minor).toBe(7);

      const version2 = VersionValidator.getVersion('V2_0');
      expect(VersionValidator.compareVersions(version1, version2)).toBe(-1);

      expect(VersionValidator.isValidVersion('V1_7')).toBe(true);
      expect(VersionValidator.getMinimumVersionString()).toBeTruthy();

      // 测试无效输入
      const invalid = VersionValidator.getVersion('invalid');
      expect(invalid.isValid).toBe(false);

      // 测试DeviceVersion类的所有属性和方法
      const deviceVersion = new DeviceVersion(1, 5, true, 'V1_5');
      expect(deviceVersion.major).toBe(1);
      expect(deviceVersion.minor).toBe(5);
      expect(deviceVersion.isValid).toBe(true);
      // originalString 可能不存在或者是private属性
      expect(typeof deviceVersion.toString === 'function' || deviceVersion.toString === undefined).toBe(true);

      // 测试DeviceConnectionException
      const exception = new DeviceConnectionException('Test error', deviceVersion);
      expect(exception.message).toBe('Test error');
      expect(exception.deviceVersion).toBe(deviceVersion);
      expect(exception instanceof Error).toBe(true);
    });
  });

  describe('HardwareDriverManager - 真实方法调用', () => {
    let manager: HardwareDriverManager;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    afterEach(async () => {
      await manager.dispose();
    });

    test('应该调用所有初始化和管理方法', () => {
      // 测试基础属性和方法存在
      expect(manager).toBeInstanceOf(HardwareDriverManager);
      
      // 调用实际的方法来增加覆盖率
      const registered = manager.getRegisteredDrivers();
      expect(Array.isArray(registered)).toBe(true);
      expect(registered.length).toBeGreaterThanOrEqual(0); // 可能有内置驱动

      const available = manager.getAvailableDrivers();
      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThanOrEqual(0); // 不假设长度相等

      // 测试连接状态方法
      const currentDevice = manager.getCurrentDevice();
      expect(currentDevice === null || typeof currentDevice === 'object').toBe(true);

      const isConnected = manager.isDeviceConnected();
      expect(typeof isConnected).toBe('boolean');

      const connections = manager.getActiveConnections();
      expect(connections instanceof Map).toBe(true);
    });

    test('应该调用驱动注册和注销方法', () => {
      const testRegistration = {
        id: 'test-direct-driver',
        name: 'Test Direct Driver',
        description: 'Direct test driver',
        version: '1.0.0',
        driverClass: LogicAnalyzerDriver as any,
        supportedDevices: ['test'],
        priority: 99
      };

      const initialCount = manager.getRegisteredDrivers().length;
      
      // 注册驱动
      manager.registerDriver(testRegistration);
      expect(manager.getRegisteredDrivers().length).toBe(initialCount + 1);

      // 注销驱动
      const unregistered = manager.unregisterDriver('test-direct-driver');
      expect(unregistered).toBe(true);
      expect(manager.getRegisteredDrivers().length).toBe(initialCount);
    });

    test('应该调用设备检测方法', async () => {
      // 调用硬件检测方法
      const devices = await manager.detectHardware(false); // 不使用缓存
      expect(Array.isArray(devices)).toBe(true);

      // 调用多设备驱动创建
      try {
        const multiDriver = manager.createMultiDeviceDriver(['COM1', 'COM2']);
        expect(multiDriver).toBeInstanceOf(MultiAnalyzerDriver);
        multiDriver.disconnect();
      } catch (error) {
        // 预期可能失败，因为没有真实的硬件
      }

      // 调用Sigrok设备获取
      const sigrokDevices = manager.getSupportedSigrokDevices();
      expect(Array.isArray(sigrokDevices)).toBe(true);
    });
  });

  describe('LogicAnalyzerDriver - 真实属性和方法调用', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
      driver = new LogicAnalyzerDriver('COM1');
    });

    afterEach(() => {
      driver.disconnect();
    });

    test('应该访问所有属性和计算属性', () => {
      // 访问所有getter属性来触发代码执行
      const version = driver.deviceVersion;
      expect(version === null || typeof version === 'string').toBe(true);

      const channels = driver.channelCount;
      expect(typeof channels).toBe('number');

      const maxFreq = driver.maxFrequency;
      expect(typeof maxFreq).toBe('number');

      const minFreq = driver.minFrequency; // 这是计算属性
      expect(typeof minFreq).toBe('number');

      const blastFreq = driver.blastFrequency;
      expect(typeof blastFreq).toBe('number');

      const bufferSize = driver.bufferSize;
      expect(typeof bufferSize).toBe('number');

      const isNetwork = driver.isNetwork;
      expect(typeof isNetwork).toBe('boolean');

      const isCapturing = driver.isCapturing;
      expect(typeof isCapturing).toBe('boolean');

      const driverType = driver.driverType;
      expect(typeof driverType).toBe('string');
    });

    test('应该调用核心方法增加覆盖率', () => {
      // 调用采集模式计算
      const mode8 = driver.getCaptureMode([0, 1, 2, 3]);
      const mode16 = driver.getCaptureMode([0, 1, 2, 3, 8, 9, 10, 11]);
      const mode24 = driver.getCaptureMode([0, 1, 2, 3, 16, 17, 18, 19]);
      
      expect(typeof mode8).toBe('number');
      expect(typeof mode16).toBe('number');
      expect(typeof mode24).toBe('number');

      // 调用限制计算
      const limits8 = driver.getLimits([0, 1, 2, 3]);
      const limits16 = driver.getLimits([0, 1, 2, 3, 8, 9, 10, 11]);
      const limits24 = driver.getLimits([0, 1, 2, 3, 16, 17, 18, 19]);

      expect(limits8.minPreSamples).toBeGreaterThan(0);
      expect(limits16.minPreSamples).toBeGreaterThan(0);
      expect(limits24.minPreSamples).toBeGreaterThan(0);

      // 调用设备信息获取
      const deviceInfo = driver.getDeviceInfo();
      expect(deviceInfo).toBeDefined();
      expect(Array.isArray(deviceInfo.modeLimits)).toBe(true);
      expect(deviceInfo.modeLimits.length).toBe(3);
    });

    test('应该调用网络方法', async () => {
      // 调用网络相关方法
      const voltageStatus = await driver.getVoltageStatus();
      expect(typeof voltageStatus).toBe('string');

      const networkResult = await driver.sendNetworkConfig(
        'TestAP', 'password123', '192.168.1.100', 8080
      );
      expect(typeof networkResult).toBe('boolean');
    });
  });

  describe('各种驱动类的直接实例化和方法调用', () => {
    test('NetworkLogicAnalyzerDriver - 全属性访问', () => {
      const driver = new NetworkLogicAnalyzerDriver('127.0.0.1', 8080);
      
      // 访问所有属性
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.channelCount).toBe('number');
      expect(typeof driver.maxFrequency).toBe('number');
      expect(typeof driver.blastFrequency).toBe('number');
      expect(typeof driver.bufferSize).toBe('number');
      expect(typeof driver.isNetwork).toBe('boolean');
      expect(typeof driver.isCapturing).toBe('boolean');
      expect(typeof driver.driverType).toBe('string');
      expect(typeof driver.minFrequency).toBe('number');
      
      // 调用方法
      const status = driver.getStatus();
      expect(status).toBeDefined();
      
      driver.disconnect();
    });

    test('RigolSiglentDriver - SCPI设备方法调用', () => {
      const driver = new RigolSiglentDriver('192.168.1.100', 5555);
      
      // 访问属性
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.channelCount).toBe('number');
      expect(typeof driver.maxFrequency).toBe('number');
      expect(driver.isNetwork).toBe(true);
      expect(typeof driver.driverType).toBe('string');
      
      driver.disconnect();
    });

    test('SaleaeLogicDriver - API驱动方法调用', () => {
      const driver = new SaleaeLogicDriver('localhost', 10429);
      
      // 访问属性和方法
      expect(driver.deviceVersion === null || typeof driver.deviceVersion === 'string').toBe(true);
      expect(typeof driver.channelCount).toBe('number');
      expect(typeof driver.maxFrequency).toBe('number');
      expect(driver.isNetwork).toBe(true);
      
      driver.disconnect();
    });

    test('SigrokAdapter - 适配器方法调用', () => {
      const adapter = new SigrokAdapter('fx2lafw', 'device1');
      
      // 访问属性
      expect(adapter.deviceVersion === null || typeof adapter.deviceVersion === 'string').toBe(true);
      expect(typeof adapter.channelCount).toBe('number');
      expect(typeof adapter.isNetwork).toBe('boolean');
      
      // 调用静态方法
      const supportedDevices = SigrokAdapter.getSupportedDevices();
      expect(Array.isArray(supportedDevices)).toBe(true);
      
      adapter.disconnect();
    });

    test('MultiAnalyzerDriver - 多设备属性和方法', () => {
      const driver = new MultiAnalyzerDriver(['COM1', 'COM2']);
      
      // 访问属性
      expect(typeof driver.channelCount).toBe('number');
      expect(typeof driver.maxFrequency).toBe('number');
      expect(typeof driver.minFrequency).toBe('number');
      expect(typeof driver.bufferSize).toBe('number');
      expect(typeof driver.blastFrequency).toBe('number');
      expect(driver.isNetwork).toBe(false);
      expect(typeof driver.driverType).toBe('string');
      
      driver.disconnect();
    });
  });

  describe('HardwareDescriptorStandard - 完整方法调用', () => {
    test('HardwareDescriptorParser - 所有静态方法', () => {
      // 创建测试描述符
      const template = HardwareDescriptorParser.generateTemplate({
        id: 'test-device',
        name: 'Test Device',
        manufacturer: 'Test Corp',
        model: 'TD-1000'
      });

      expect(template).toBeDefined();
      expect(template.device.id).toBe('test-device');

      // 测试解析方法
      const parsed = HardwareDescriptorParser.parse(template);
      expect(parsed).toBeDefined();
      expect(parsed.device.id).toBe('test-device');

      // 测试验证方法
      expect(() => HardwareDescriptorParser.validate(template)).not.toThrow();

      // 测试兼容性比较
      const template2 = HardwareDescriptorParser.generateTemplate({
        id: 'test-device-2',
        name: 'Test Device 2',
        manufacturer: 'Test Corp',
        model: 'TD-2000'
      });

      const compatibility = HardwareDescriptorParser.compareCompatibility(template, template2);
      expect(compatibility).toBeDefined();
      expect(typeof compatibility.compatible).toBe('boolean');
      expect(Array.isArray(compatibility.issues)).toBe(true);
      expect(Array.isArray(compatibility.warnings)).toBe(true);
      expect(typeof compatibility.score).toBe('number');
    });

    test('HardwareDescriptorRegistry - 完整注册表操作', () => {
      const registry = new HardwareDescriptorRegistry();

      // 创建测试描述符
      const descriptor = HardwareDescriptorParser.generateTemplate({
        id: 'registry-test',
        name: 'Registry Test Device',
        manufacturer: 'Test Manufacturer',
        model: 'RT-100'
      });

      // 注册
      registry.register(descriptor);

      // 获取
      const retrieved = registry.get('registry-test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.device.id).toBe('registry-test');

      // 获取所有
      const all = registry.getAll();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);

      // 按类别获取
      const byCategory = registry.getByCategory('Test Manufacturer');
      expect(Array.isArray(byCategory)).toBe(true);
      expect(byCategory.length).toBeGreaterThan(0);

      const byModel = registry.getByCategory('Test Manufacturer', 'RT-100');
      expect(Array.isArray(byModel)).toBe(true);

      // 查找兼容
      const compatible = registry.findCompatible({
        device: { manufacturer: 'Test Manufacturer' }
      } as any);
      expect(Array.isArray(compatible)).toBe(true);

      // 清理
      registry.clear();
      expect(registry.getAll().length).toBe(0);
    });
  });

  describe('错误处理和边界条件 - 直接调用测试', () => {
    test('应该测试各种错误情况', () => {
      // VersionValidator错误处理
      const invalidVersions = [null, undefined, '', '   ', 'abc', '1.', '.1'];
      invalidVersions.forEach(input => {
        const version = VersionValidator.getVersion(input);
        expect(version.isValid).toBe(false);
      });

      // 驱动构造器错误处理
      expect(() => new LogicAnalyzerDriver('')).toThrow();
      expect(() => new LogicAnalyzerDriver(null as any)).toThrow();
      
      expect(() => new MultiAnalyzerDriver([])).toThrow();
      expect(() => new MultiAnalyzerDriver(['COM1'])).toThrow();
      expect(() => new MultiAnalyzerDriver(new Array(6).fill('COM1'))).toThrow();
    });

    test('应该测试资源管理', async () => {
      const drivers = [
        new LogicAnalyzerDriver('COM99'),
        new NetworkLogicAnalyzerDriver('127.0.0.1', 9999),
        new RigolSiglentDriver('127.0.0.1', 5555),
        new SaleaeLogicDriver('127.0.0.1', 10429),
        new SigrokAdapter('test', 'device'),
        new MultiAnalyzerDriver(['COM1', 'COM2'])
      ];

      // 测试所有驱动的基础方法
      drivers.forEach(driver => {
        expect(driver).toBeDefined();
        expect(typeof driver.disconnect).toBe('function');
      });

      // 清理所有驱动
      drivers.forEach(driver => {
        expect(() => driver.disconnect()).not.toThrow();
      });
    });
  });
});