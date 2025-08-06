/**
 * DRIVERS 模块简化测试 - 专注于实际可测试的功能
 * 针对具体实现类的测试，避免抽象类的复杂性
 */

import { EventEmitter } from 'events';

// Mock 外部依赖
jest.mock('serialport', () => ({
  SerialPort: {
    list: jest.fn(() => Promise.resolve([
      { path: '/dev/ttyUSB0', vendorId: '2E8A', productId: '0003' }
    ]))
  }
}));

jest.mock('net', () => ({
  Socket: jest.fn(() => ({
    setTimeout: jest.fn(),
    connect: jest.fn((port, host, callback) => callback && callback()),
    destroy: jest.fn(),
    write: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
    removeAllListeners: jest.fn(),
    off: jest.fn()
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    on: jest.fn(),
    kill: jest.fn(),
    pid: 12345
  }))
}));

// 导入要测试的类
import { VersionValidator, DeviceVersion, DeviceConnectionException } from '../src/drivers/VersionValidator';
import { HardwareDriverManager } from '../src/drivers/HardwareDriverManager';

describe('DRIVERS 模块简化测试', () => {
  describe('VersionValidator - 静态方法测试', () => {
    it('应该解析有效的设备版本字符串', () => {
      const version = VersionValidator.getVersion('LOGIC_ANALYZER_V1_7');
      expect(version).toBeInstanceOf(DeviceVersion);
      expect(version.major).toBe(1);
      expect(version.minor).toBe(7);
      expect(version.isValid).toBe(true);
      expect(version.versionString).toBe('LOGIC_ANALYZER_V1_7');
    });

    it('应该解析点分版本格式', () => {
      const version = VersionValidator.getVersion('1.8');
      expect(version.major).toBe(1);
      expect(version.minor).toBe(8);
      expect(version.isValid).toBe(true);
    });

    it('应该处理无效版本字符串', () => {
      const version = VersionValidator.getVersion('invalid-version');
      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
      expect(version.isValid).toBe(false);
    });

    it('应该处理空字符串', () => {
      const version = VersionValidator.getVersion('');
      expect(version.isValid).toBe(false);
    });

    it('应该处理 null/undefined', () => {
      const version1 = VersionValidator.getVersion(null as any);
      const version2 = VersionValidator.getVersion(undefined);
      
      expect(version1.isValid).toBe(false);
      expect(version2.isValid).toBe(false);
    });

    it('应该验证版本有效性', () => {
      expect(VersionValidator.isValidVersion('LOGIC_ANALYZER_V1_7')).toBe(true);
      expect(VersionValidator.isValidVersion('LOGIC_ANALYZER_V1_8')).toBe(true);
      expect(VersionValidator.isValidVersion('invalid-version')).toBe(false);
      expect(VersionValidator.isValidVersion('')).toBe(false);
      expect(VersionValidator.isValidVersion(undefined)).toBe(false);
    });

    it('应该获取版本常量', () => {
      expect(VersionValidator.MAJOR_VERSION).toBe(1);
      expect(VersionValidator.MINOR_VERSION).toBe(7);
    });

    it('应该获取最低版本字符串', () => {
      const minVersion = VersionValidator.getMinimumVersionString();
      expect(minVersion).toBe('V1_7');
    });

    it('应该比较版本对象', () => {
      const version1 = new DeviceVersion(1, 7, true, 'V1_7');
      const version2 = new DeviceVersion(1, 8, true, 'V1_8');
      const version3 = new DeviceVersion(2, 0, true, 'V2_0');
      const version4 = new DeviceVersion(1, 7, true, 'V1_7');

      expect(VersionValidator.compareVersions(version1, version2)).toBe(-1);
      expect(VersionValidator.compareVersions(version2, version1)).toBe(1);
      expect(VersionValidator.compareVersions(version1, version4)).toBe(0);
      expect(VersionValidator.compareVersions(version3, version1)).toBe(1);
    });

    it('应该处理边界版本值', () => {
      const version1 = VersionValidator.getVersion('V0_0');
      const version2 = VersionValidator.getVersion('V999_999');
      
      expect(version1.major).toBe(0);
      expect(version1.minor).toBe(0);
      expect(version2.major).toBe(999);
      expect(version2.minor).toBe(999);
    });

    it('应该处理不同的版本格式', () => {
      const testCases = [
        { input: 'LOGIC_ANALYZER_V1_7', expected: { major: 1, minor: 7, valid: true } },
        { input: 'v2_3', expected: { major: 2, minor: 3, valid: true } },
        { input: '3.4', expected: { major: 3, minor: 4, valid: true } },
        { input: 'abc', expected: { major: 0, minor: 0, valid: false } },
        { input: '1', expected: { major: 0, minor: 0, valid: false } },
        { input: 'V1_', expected: { major: 0, minor: 0, valid: false } }
      ];

      testCases.forEach(({ input, expected }) => {
        const version = VersionValidator.getVersion(input);
        expect(version.major).toBe(expected.major);
        expect(version.minor).toBe(expected.minor);
        expect(version.isValid).toBe(expected.valid);
      });
    });
  });

  describe('DeviceVersion 类', () => {
    it('应该创建 DeviceVersion 实例', () => {
      const version = new DeviceVersion(1, 7, true, 'LOGIC_ANALYZER_V1_7');
      
      expect(version.major).toBe(1);
      expect(version.minor).toBe(7);
      expect(version.isValid).toBe(true);
      expect(version.versionString).toBe('LOGIC_ANALYZER_V1_7');
    });

    it('应该支持无效版本实例', () => {
      const version = new DeviceVersion(0, 0, false, 'invalid');
      
      expect(version.major).toBe(0);
      expect(version.minor).toBe(0);
      expect(version.isValid).toBe(false);
      expect(version.versionString).toBe('invalid');
    });
  });

  describe('DeviceConnectionException 类', () => {
    it('应该创建设备连接异常实例', () => {
      const exception = new DeviceConnectionException('Connection failed');
      
      expect(exception).toBeInstanceOf(Error);
      expect(exception).toBeInstanceOf(DeviceConnectionException);
      expect(exception.message).toBe('Connection failed');
      expect(exception.name).toBe('DeviceConnectionException');
      expect(exception.deviceVersion).toBeUndefined();
    });

    it('应该创建带设备版本的异常实例', () => {
      const exception = new DeviceConnectionException('Version mismatch', 'V1_6');
      
      expect(exception.message).toBe('Version mismatch');
      expect(exception.deviceVersion).toBe('V1_6');
      expect(exception.name).toBe('DeviceConnectionException');
    });
  });

  describe('HardwareDriverManager - 基础功能', () => {
    let manager: HardwareDriverManager;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    afterEach(async () => {
      try {
        await manager.dispose();
      } catch (error) {
        // 忽略清理错误
      }
    });

    it('应该创建 HardwareDriverManager 实例', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(HardwareDriverManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('应该初始化内置驱动', () => {
      const drivers = manager.getRegisteredDrivers();
      expect(Array.isArray(drivers)).toBe(true);
      expect(drivers.length).toBeGreaterThan(0);
      
      // 检查是否包含预期的驱动
      const driverIds = drivers.map(d => d.id);
      expect(driverIds).toContain('pico-logic-analyzer');
    });

    it('应该返回可用驱动列表', () => {
      const available = manager.getAvailableDrivers();
      const registered = manager.getRegisteredDrivers();
      
      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBe(registered.length); // 应该相同
    });

    it('应该支持事件监听', () => {
      const eventSpy = jest.fn();
      
      manager.on('deviceConnected', eventSpy);
      manager.emit('deviceConnected', { deviceId: 'test' });
      
      expect(eventSpy).toHaveBeenCalledWith({ deviceId: 'test' });
    });

    it('应该获取支持的 Sigrok 设备', () => {
      const devices = manager.getSupportedSigrokDevices();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      
      // 检查设备格式
      if (devices.length > 0) {
        const device = devices[0];
        expect(device).toHaveProperty('driver');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('channels');
        expect(device).toHaveProperty('maxRate');
      }
    });

    it('应该处理驱动注册', () => {
      const testDriver = {
        id: 'test-driver',
        name: 'Test Driver',
        description: 'Driver for testing',
        version: '1.0.0',
        driverClass: class TestDriver {
          constructor(public connectionString: string) {}
        } as any,
        supportedDevices: ['test'],
        priority: 50
      };

      manager.registerDriver(testDriver);
      
      const drivers = manager.getRegisteredDrivers();
      const testDriverRegistered = drivers.find(d => d.id === 'test-driver');
      
      expect(testDriverRegistered).toBeDefined();
      expect(testDriverRegistered?.name).toBe('Test Driver');
    });

    it('应该处理驱动注销', () => {
      const testDriver = {
        id: 'removable-driver',
        name: 'Removable Driver',
        description: 'Driver for removal testing',
        version: '1.0.0',
        driverClass: class RemovableDriver {
          constructor(public connectionString: string) {}
        } as any,
        supportedDevices: ['test'],
        priority: 50
      };

      manager.registerDriver(testDriver);
      
      // 验证注册成功
      let drivers = manager.getRegisteredDrivers();
      expect(drivers.some(d => d.id === 'removable-driver')).toBe(true);
      
      // 注销驱动
      const result = manager.unregisterDriver('removable-driver');
      expect(result).toBe(true);
      
      // 验证注销成功
      drivers = manager.getRegisteredDrivers();
      expect(drivers.some(d => d.id === 'removable-driver')).toBe(false);
    });

    it('应该处理不存在驱动的注销', () => {
      const result = manager.unregisterDriver('non-existent-driver');
      expect(result).toBe(false);
    });

    it('应该获取活动连接', () => {
      const connections = manager.getActiveConnections();
      expect(Array.isArray(connections)).toBe(true);
      // 初始状态应该没有活动连接
      expect(connections.length).toBe(0);
    });

    it('应该处理资源清理', async () => {
      // 这个测试主要验证 dispose 方法不会抛出异常
      await expect(manager.dispose()).resolves.not.toThrow();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理版本解析中的 NaN 情况', () => {
      // 模拟 parseInt 返回 NaN 的情况
      const originalParseInt = global.parseInt;
      global.parseInt = jest.fn(() => NaN);

      try {
        const version = VersionValidator.getVersion('V1_7');
        expect(version.isValid).toBe(false);
      } finally {
        global.parseInt = originalParseInt;
      }
    });

    it('应该处理包含非数字字符的版本字符串', () => {
      // 这些应该触发 NaN 检查路径
      const testCases = [
        'Va_7',     // 非数字主版本号
        '1.b',      // 非数字次版本号  
        'V1_b',     // V格式中的非数字次版本号
        'Vb_7'      // V格式中的非数字主版本号
      ];

      testCases.forEach(versionStr => {
        const version = VersionValidator.getVersion(versionStr);
        expect(version.isValid).toBe(false);
        expect(version.major).toBe(0);
        expect(version.minor).toBe(0);
      });
    });

    it('应该处理超长版本字符串', () => {
      const longVersionString = 'V' + '1'.repeat(1000) + '_7';
      const version = VersionValidator.getVersion(longVersionString);
      
      // 应该能处理而不崩溃
      expect(version).toBeDefined();
    });

    it('应该处理特殊字符版本字符串', () => {
      const specialVersions = [
        'V1_7\n',
        'V1_7\t',
        'V1_7 ',
        ' V1_7',
        'V1_7\r\n'
      ];

      specialVersions.forEach(versionStr => {
        const version = VersionValidator.getVersion(versionStr);
        expect(version.major).toBe(1);
        expect(version.minor).toBe(7);
        expect(version.isValid).toBe(true);
      });
    });

    it('应该处理重复的驱动注册', () => {
      const manager = new HardwareDriverManager();
      
      const testDriver = {
        id: 'duplicate-driver',
        name: 'Duplicate Driver',
        description: 'Driver for duplication testing',
        version: '1.0.0',
        driverClass: class DuplicateDriver {
          constructor(public connectionString: string) {}
        } as any,
        supportedDevices: ['test'],
        priority: 50
      };

      // 第一次注册应该成功
      manager.registerDriver(testDriver);
      let drivers = manager.getRegisteredDrivers();
      expect(drivers.some(d => d.id === 'duplicate-driver')).toBe(true);

      // 第二次注册应该被忽略或处理
      manager.registerDriver(testDriver);
      drivers = manager.getRegisteredDrivers();
      
      // 应该只有一个实例
      const duplicateDrivers = drivers.filter(d => d.id === 'duplicate-driver');
      expect(duplicateDrivers.length).toBe(1);
    });
  });

  describe('性能测试', () => {
    it('应该快速解析大量版本字符串', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        VersionValidator.getVersion(`LOGIC_ANALYZER_V${i % 10}_${i % 20}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
    });

    it('应该快速处理驱动注册', () => {
      const manager = new HardwareDriverManager();
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const driver = {
          id: `perf-driver-${i}`,
          name: `Performance Driver ${i}`,
          description: `Driver ${i} for performance testing`,
          version: '1.0.0',
          driverClass: class PerfDriver {
            constructor(public connectionString: string) {}
          } as any,
          supportedDevices: ['test'],
          priority: 50
        };
        
        manager.registerDriver(driver);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // 应该在500ms内完成
      
      const drivers = manager.getRegisteredDrivers();
      expect(drivers.length).toBeGreaterThanOrEqual(100); // 至少包含我们注册的100个驱动
    });
  });

  describe('内存管理测试', () => {
    it('应该正确清理管理器资源', async () => {
      const manager = new HardwareDriverManager();
      
      // 注册一些驱动
      for (let i = 0; i < 10; i++) {
        const driver = {
          id: `cleanup-driver-${i}`,
          name: `Cleanup Driver ${i}`,
          description: `Driver ${i} for cleanup testing`,
          version: '1.0.0',
          driverClass: class CleanupDriver {
            constructor(public connectionString: string) {}
          } as any,
          supportedDevices: ['test'],
          priority: 50
        };
        
        manager.registerDriver(driver);
      }
      
      expect(manager.getRegisteredDrivers().length).toBeGreaterThanOrEqual(10);
      
      // 清理资源
      await manager.dispose();
      
      // 验证清理后的状态
      // 注意：dispose 主要是清理连接，注册的驱动可能仍然存在
      expect(manager.getActiveConnections().length).toBe(0);
    });

    it('应该处理大量版本对象创建', () => {
      const versions: DeviceVersion[] = [];
      
      // 创建大量版本对象
      for (let i = 0; i < 10000; i++) {
        versions.push(new DeviceVersion(i % 100, i % 50, true, `V${i}_${i}`));
      }
      
      expect(versions.length).toBe(10000);
      expect(versions[0]).toBeInstanceOf(DeviceVersion);
      expect(versions[9999]).toBeInstanceOf(DeviceVersion);
      
      // 验证内存没有泄漏（通过访问属性）
      expect(versions[5000].major).toBe(50);
      expect(versions[5000].minor).toBe(0);
    });
  });
});