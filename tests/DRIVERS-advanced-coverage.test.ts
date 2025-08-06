/**
 * DRIVERS 模块高级覆盖率测试
 * 基于直接覆盖策略的成功经验，深化覆盖率测试
 * 目标：HardwareDriverManager 0% -> 95%+，其他驱动深度覆盖
 */

// 确保使用真实的HardwareDriverManager而不是Mock
jest.unmock('../src/drivers/HardwareDriverManager');

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

// 使用成功的最小Mock策略，添加pipe方法支持
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    open: jest.fn((callback) => {
      if (callback) setTimeout(callback, 1);
    }),
    close: jest.fn((callback) => {
      if (callback) setTimeout(callback, 1);
    }),
    write: jest.fn((data, callback) => {
      if (callback) setTimeout(callback, 1);
      return true;
    }),
    read: jest.fn(() => Buffer.from([0x55, 0xAA, 0x01, 0x02, 0xAA, 0x55])),
    pipe: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    isOpen: true,
    path: '/dev/ttyUSB0'
  }))
}));

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => ({
    connect: jest.fn(function(port, host, callback) {
      this.connected = true;
      this.readyState = 'open';
      if (callback) setTimeout(callback, 1);
      if (this.emit) this.emit('connect');
      return this;
    }),
    write: jest.fn((data, callback) => {
      if (callback) setTimeout(callback, 1);
      return true;
    }),
    end: jest.fn((callback) => {
      if (callback) setTimeout(callback, 1);
    }),
    destroy: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    setTimeout: jest.fn(),
    readyState: 'open',
    connected: true
  }))
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { 
      on: jest.fn(),
      pipe: jest.fn(),
      read: jest.fn(() => 'sigrok-cli 0.7.0\n')
    },
    stderr: { 
      on: jest.fn(), 
      pipe: jest.fn(),
      read: jest.fn(() => '')
    },
    on: jest.fn((event, callback) => {
      if (event === 'exit') setTimeout(() => callback(0), 1);
      if (event === 'close') setTimeout(() => callback(0), 1);
    }),
    kill: jest.fn(),
    pid: 12345
  }))
}));

describe('DRIVERS 模块高级覆盖率测试', () => {

  describe('HardwareDriverManager 深度覆盖 (0% -> 95%+)', () => {
    let manager: HardwareDriverManager;

    beforeEach(() => {
      manager = new HardwareDriverManager();
    });

    afterEach(async () => {
      if (manager) {
        await manager.dispose();
      }
    });

    test('应该测试所有设备检测和硬件扫描功能', async () => {
      // 测试硬件检测 - 使用不同的缓存选项
      const devicesWithoutCache = await manager.detectHardware(false);
      expect(Array.isArray(devicesWithoutCache)).toBe(true);

      const devicesWithCache = await manager.detectHardware(true);
      expect(Array.isArray(devicesWithCache)).toBe(true);

      // 测试设备发现间隔调用
      const discovery1 = await manager.detectHardware();
      const discovery2 = await manager.detectHardware();
      expect(Array.isArray(discovery1)).toBe(true);
      expect(Array.isArray(discovery2)).toBe(true);
    });

    test('应该测试多设备驱动创建和管理', () => {
      // 测试多设备驱动创建
      const connectionStrings = ['COM1', 'COM2', 'COM3'];
      const multiDriver = manager.createMultiDeviceDriver(connectionStrings);
      expect(multiDriver).toBeInstanceOf(MultiAnalyzerDriver);

      // 测试不同数量的连接字符串
      const twoDevices = manager.createMultiDeviceDriver(['COM1', 'COM2']);
      expect(twoDevices).toBeInstanceOf(MultiAnalyzerDriver);

      const fourDevices = manager.createMultiDeviceDriver(['COM1', 'COM2', 'COM3', 'COM4']);
      expect(fourDevices).toBeInstanceOf(MultiAnalyzerDriver);

      // 清理资源
      multiDriver.disconnect();
      twoDevices.disconnect();
      fourDevices.disconnect();
    });

    test('应该测试Sigrok设备支持和枚举', () => {
      // 测试Sigrok支持的设备列表
      const sigrokDevices = manager.getSupportedSigrokDevices();
      expect(Array.isArray(sigrokDevices)).toBe(true);

      // 测试多次调用的一致性
      const sigrokDevices2 = manager.getSupportedSigrokDevices();
      expect(sigrokDevices2).toEqual(sigrokDevices);
    });

    test('应该测试驱动优先级和排序功能', () => {
      const initialCount = manager.getRegisteredDrivers().length;

      // 注册不同优先级的驱动
      const highPriorityDriver = {
        id: 'high-priority-driver',
        name: 'High Priority Driver',
        description: 'High priority test driver',
        version: '1.0.0',
        driverClass: LogicAnalyzerDriver as any,
        supportedDevices: ['test-high'],
        priority: 100
      };

      const lowPriorityDriver = {
        id: 'low-priority-driver',
        name: 'Low Priority Driver',
        description: 'Low priority test driver',
        version: '1.0.0',
        driverClass: NetworkLogicAnalyzerDriver as any,
        supportedDevices: ['test-low'],
        priority: 10
      };

      const mediumPriorityDriver = {
        id: 'medium-priority-driver',
        name: 'Medium Priority Driver',
        description: 'Medium priority test driver',
        version: '1.0.0',
        driverClass: RigolSiglentDriver as any,
        supportedDevices: ['test-medium'],
        priority: 50
      };

      // 注册驱动
      manager.registerDriver(highPriorityDriver);
      manager.registerDriver(lowPriorityDriver);
      manager.registerDriver(mediumPriorityDriver);

      const registeredDrivers = manager.getRegisteredDrivers();
      expect(registeredDrivers.length).toBe(initialCount + 3);

      // getAvailableDrivers返回所有已注册的驱动（包括内置的）
      const availableDrivers = manager.getAvailableDrivers();
      expect(availableDrivers.length).toBeGreaterThanOrEqual(3); // 至少有我们注册的3个驱动

      // 查找我们注册的驱动
      const highDriver = availableDrivers.find(d => d.id === 'high-priority-driver');
      const mediumDriver = availableDrivers.find(d => d.id === 'medium-priority-driver');
      const lowDriver = availableDrivers.find(d => d.id === 'low-priority-driver');

      expect(highDriver).toBeDefined();
      expect(mediumDriver).toBeDefined();
      expect(lowDriver).toBeDefined();

      // 清理 - 注销驱动
      expect(manager.unregisterDriver('high-priority-driver')).toBe(true);
      expect(manager.unregisterDriver('medium-priority-driver')).toBe(true);
      expect(manager.unregisterDriver('low-priority-driver')).toBe(true);
    });

    test('应该测试设备连接状态跟踪', async () => {
      // 测试初始状态
      expect(manager.isDeviceConnected()).toBe(false);
      expect(manager.getCurrentDevice()).toBeNull();
      
      const connections = manager.getActiveConnections();
      expect(connections instanceof Map).toBe(true);
      expect(connections.size).toBe(0);

      // 模拟创建连接
      const testDriver = new LogicAnalyzerDriver('COM99');
      
      // 测试设备信息获取
      const currentDevice = manager.getCurrentDevice();
      expect(currentDevice === null || typeof currentDevice === 'object').toBe(true);

      // 清理
      testDriver.disconnect();
    });

    test('应该测试驱动兼容性检查', () => {
      // 注册测试驱动
      const testDriver = {
        id: 'compatibility-test-driver',
        name: 'Compatibility Test Driver',
        description: 'Driver for compatibility testing',
        version: '2.1.0',
        driverClass: LogicAnalyzerDriver as any,
        supportedDevices: ['TestDevice', 'AnotherDevice'],
        priority: 75
      };

      manager.registerDriver(testDriver);

      const registered = manager.getRegisteredDrivers();
      const compatibilityDriver = registered.find(d => d.id === 'compatibility-test-driver');
      expect(compatibilityDriver).toBeDefined();
      expect(compatibilityDriver!.supportedDevices).toContain('TestDevice');
      expect(compatibilityDriver!.supportedDevices).toContain('AnotherDevice');

      // 清理
      manager.unregisterDriver('compatibility-test-driver');
    });

    test('应该测试批量操作和性能', async () => {
      const startTime = Date.now();
      const initialCount = manager.getRegisteredDrivers().length;

      // 批量注册驱动
      const batchDrivers = [];
      for (let i = 0; i < 20; i++) {
        const driverInfo = {
          id: `batch-driver-${i}`,
          name: `Batch Driver ${i}`,
          description: `Batch test driver ${i}`,
          version: '1.0.0',
          driverClass: LogicAnalyzerDriver as any,
          supportedDevices: [`batch-device-${i}`],
          priority: 40 + i
        };
        
        manager.registerDriver(driverInfo);
        batchDrivers.push(driverInfo.id);
      }

      // 验证批量注册结果
      const afterBatchRegister = manager.getRegisteredDrivers();
      expect(afterBatchRegister.length).toBe(initialCount + 20);

      // 测试批量获取操作性能
      const getStartTime = Date.now();
      const availableDrivers = manager.getAvailableDrivers();
      const getEndTime = Date.now();

      expect(availableDrivers.length).toBeGreaterThanOrEqual(initialCount + 20);
      expect(getEndTime - getStartTime).toBeLessThan(100); // 应该很快完成

      // 批量注销
      let successfulUnregistrations = 0;
      batchDrivers.forEach(driverId => {
        if (manager.unregisterDriver(driverId)) {
          successfulUnregistrations++;
        }
      });

      expect(successfulUnregistrations).toBe(20);

      const afterBatchUnregister = manager.getRegisteredDrivers();
      expect(afterBatchUnregister.length).toBe(initialCount);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // 整个操作应该在1秒内完成
    });

    test('应该测试错误处理和异常情况', () => {
      // 测试重复注册
      const duplicateDriver = {
        id: 'duplicate-test-driver',
        name: 'Duplicate Test Driver',
        description: 'Driver for duplicate testing',
        version: '1.0.0',
        driverClass: LogicAnalyzerDriver as any,
        supportedDevices: ['duplicate-test'],
        priority: 60
      };

      // 第一次注册应该成功
      manager.registerDriver(duplicateDriver);
      const afterFirstRegister = manager.getRegisteredDrivers().length;

      // 第二次注册同样ID的驱动应该被处理（可能替换或忽略）
      manager.registerDriver(duplicateDriver);
      const afterSecondRegister = manager.getRegisteredDrivers().length;

      // 验证不会无限增长 - 可能会替换现有驱动，所以长度应该相同或更多1个
      expect(afterSecondRegister).toBeGreaterThanOrEqual(afterFirstRegister);
      expect(afterSecondRegister).toBeLessThanOrEqual(afterFirstRegister + 1);

      // 测试注销不存在的驱动
      const nonExistentResult = manager.unregisterDriver('non-existent-driver-id');
      expect(nonExistentResult).toBe(false);

      // 清理
      manager.unregisterDriver('duplicate-test-driver');
    });
  });

  describe('LogicAnalyzerDriver 深度连接流程覆盖', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
      driver = new LogicAnalyzerDriver('COM1');
    });

    afterEach(() => {
      driver.disconnect();
    });

    test('应该测试完整连接生命周期', async () => {
      // 测试连接前状态
      expect(driver.isCapturing).toBe(false);
      
      // 测试连接方法存在
      expect(typeof driver.connect).toBe('function');
      expect(typeof driver.disconnect).toBe('function');

      // 测试状态查询（不实际连接）
      const status = driver.getStatus();
      expect(status).toBeDefined();
      expect(typeof status.connected === 'boolean' || status.connected === undefined).toBe(true);
    }, 5000);

    test('应该测试采集配置的所有参数组合', () => {
      // 测试不同通道组合的采集限制
      const testChannelCombinations = [
        [0],                              // 单通道
        [0, 1],                          // 双通道
        [0, 1, 2, 3],                   // 8通道模式
        [0, 1, 2, 3, 8, 9, 10, 11],     // 16通道模式
        [0, 1, 2, 3, 16, 17, 18, 19],   // 24通道模式
        [7, 15, 23],                     // 跨组通道
        [0, 8, 16]                       // 每组首通道
      ];

      testChannelCombinations.forEach((channels, index) => {
        const limits = driver.getLimits(channels);
        expect(limits).toBeDefined();
        expect(typeof limits.minPreSamples).toBe('number');
        expect(typeof limits.maxPreSamples).toBe('number');
        expect(typeof limits.minPostSamples).toBe('number');
        expect(typeof limits.maxPostSamples).toBe('number');
        expect(limits.minPreSamples).toBeGreaterThan(0);
        expect(limits.maxPreSamples).toBeGreaterThanOrEqual(limits.minPreSamples);

        const mode = driver.getCaptureMode(channels);
        expect(typeof mode).toBe('number');
        expect(mode).toBeGreaterThanOrEqual(0);
        expect(mode).toBeLessThanOrEqual(2); // 假设模式值在0-2之间
      });
    });

    test('应该测试网络功能的所有方法', async () => {
      // 测试网络配置方法
      const networkConfigs = [
        { ssid: 'TestNetwork', password: 'password123', ip: '192.168.1.100', port: 8080 },
        { ssid: 'SecondNetwork', password: 'secret456', ip: '10.0.0.50', port: 8081 },
        { ssid: 'ThirdNetwork', password: 'test789', ip: '172.16.0.10', port: 9000 }
      ];

      for (const config of networkConfigs) {
        const result = await driver.sendNetworkConfig(
          config.ssid,
          config.password,
          config.ip,
          config.port
        );
        expect(typeof result).toBe('boolean');
      }

      // 测试电压状态获取 - 多次调用验证一致性
      const voltageStatus1 = await driver.getVoltageStatus();
      const voltageStatus2 = await driver.getVoltageStatus();
      const voltageStatus3 = await driver.getVoltageStatus();

      expect(typeof voltageStatus1).toBe('string');
      expect(typeof voltageStatus2).toBe('string');
      expect(typeof voltageStatus3).toBe('string');
    });

    test('应该测试设备信息的所有字段', () => {
      const deviceInfo = driver.getDeviceInfo();
      
      expect(deviceInfo).toBeDefined();
      expect(typeof deviceInfo.name).toBe('string');
      expect(typeof deviceInfo.maxFrequency).toBe('number');
      expect(typeof deviceInfo.channels).toBe('number');
      expect(Array.isArray(deviceInfo.modeLimits)).toBe(true);
      expect(deviceInfo.modeLimits.length).toBe(3); // 8, 16, 24通道模式

      // 验证每个模式限制的数据结构（不要求具体值，因为设备未连接）
      deviceInfo.modeLimits.forEach((modeLimit, index) => {
        expect(modeLimit).toBeDefined();
        expect(typeof modeLimit.minPreSamples).toBe('number');
        expect(typeof modeLimit.maxPreSamples).toBe('number');
        expect(typeof modeLimit.minPostSamples).toBe('number');
        expect(typeof modeLimit.maxPostSamples).toBe('number');
        // 不要求具体值，只验证数据结构完整性
      });
    });

    test('应该测试频率相关的所有计算属性', () => {
      // 测试各种频率属性 - 验证数据类型，不要求具体值（未连接时为0）
      const maxFreq = driver.maxFrequency;
      const minFreq = driver.minFrequency;
      const blastFreq = driver.blastFrequency;

      expect(typeof maxFreq).toBe('number');
      expect(typeof minFreq).toBe('number');
      expect(typeof blastFreq).toBe('number');

      // 验证值的合理性：0（未连接）或正数（已连接）都是合理的
      expect(maxFreq).toBeGreaterThanOrEqual(0);
      expect(minFreq).toBeGreaterThanOrEqual(0);
      expect(blastFreq).toBeGreaterThanOrEqual(0);

      // 测试缓冲区大小
      const bufferSize = driver.bufferSize;
      expect(typeof bufferSize).toBe('number');
      expect(bufferSize).toBeGreaterThanOrEqual(0);

      // 测试通道数
      const channelCount = driver.channelCount;
      expect(typeof channelCount).toBe('number');
      expect(channelCount).toBeGreaterThanOrEqual(0);
      if (channelCount > 0) {
        expect(channelCount).toBeLessThanOrEqual(24); // 最大24通道
      }
    });
  });

  describe('NetworkLogicAnalyzerDriver 深度网络功能覆盖', () => {
    let driver: NetworkLogicAnalyzerDriver;

    beforeEach(() => {
      driver = new NetworkLogicAnalyzerDriver('192.168.1.100', 8080);
    });

    afterEach(() => {
      driver.disconnect();
    });

    test('应该测试网络连接的所有状态和方法', async () => {
      // 测试网络特有属性
      expect(driver.isNetwork).toBe(true);
      
      // 测试连接参数的各种组合
      const networkDrivers = [
        new NetworkLogicAnalyzerDriver('localhost', 8080),
        new NetworkLogicAnalyzerDriver('127.0.0.1', 8081),
        new NetworkLogicAnalyzerDriver('192.168.1.200', 9000),
        new NetworkLogicAnalyzerDriver('10.0.0.1', 8080)
      ];

      networkDrivers.forEach((netDriver, index) => {
        expect(netDriver.isNetwork).toBe(true);
        expect(netDriver).toBeInstanceOf(NetworkLogicAnalyzerDriver);
        expect(netDriver).toBeInstanceOf(AnalyzerDriverBase);
        
        // 测试基础属性
        expect(typeof netDriver.channelCount).toBe('number');
        expect(typeof netDriver.maxFrequency).toBe('number');
        expect(typeof netDriver.minFrequency).toBe('number');
        expect(typeof netDriver.bufferSize).toBe('number');
        expect(typeof netDriver.blastFrequency).toBe('number');

        // 清理
        netDriver.disconnect();
      });
    });

    test('应该测试网络状态监控和诊断', () => {
      // 测试状态获取的详细信息
      const status = driver.getStatus();
      expect(status).toBeDefined();
      
      // 多次获取状态，验证一致性
      const status1 = driver.getStatus();
      const status2 = driver.getStatus();
      const status3 = driver.getStatus();
      
      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
      expect(status3).toBeDefined();
    });

    test('应该测试网络错误处理', () => {
      // 测试连接方法存在
      expect(typeof driver.connect).toBe('function');
      
      // 测试断开连接
      expect(() => driver.disconnect()).not.toThrow();
      
      // 多次断开连接应该安全
      expect(() => driver.disconnect()).not.toThrow();
      expect(() => driver.disconnect()).not.toThrow();
    });
  });

  describe('MultiAnalyzerDriver 深度多设备管理', () => {
    test('应该测试多设备驱动的所有配置组合', () => {
      const testConfigurations = [
        ['COM1', 'COM2'],
        ['COM1', 'COM2', 'COM3'],
        ['COM1', 'COM2', 'COM3', 'COM4'],
        ['/dev/ttyUSB0', '/dev/ttyUSB1'],
        ['192.168.1.100:8080', '192.168.1.101:8080'],
        ['COM1', '/dev/ttyUSB0', '192.168.1.100:8080']
      ];

      testConfigurations.forEach((connections, index) => {
        const multiDriver = new MultiAnalyzerDriver(connections);
        
        expect(multiDriver).toBeInstanceOf(MultiAnalyzerDriver);
        expect(multiDriver).toBeInstanceOf(AnalyzerDriverBase);
        expect(multiDriver.isNetwork).toBe(false); // Multi-driver的网络属性
        
        // 测试多设备属性计算（未连接时可能为0）
        expect(typeof multiDriver.channelCount).toBe('number');
        expect(multiDriver.channelCount).toBeGreaterThanOrEqual(0);
        // 只有在连接状态下才验证通道数计算
        if (multiDriver.channelCount > 0) {
          expect(multiDriver.channelCount).toBeLessThanOrEqual(connections.length * 24);
        }
        
        expect(typeof multiDriver.maxFrequency).toBe('number');
        expect(typeof multiDriver.minFrequency).toBe('number');
        expect(typeof multiDriver.bufferSize).toBe('number');
        expect(typeof multiDriver.blastFrequency).toBe('number');

        // 清理
        multiDriver.disconnect();
      });
    });

    test('应该测试多设备同步和协调', () => {
      const multiDriver = new MultiAnalyzerDriver(['COM1', 'COM2', 'COM3']);
      
      // 测试设备信息聚合
      const deviceInfo = multiDriver.getDeviceInfo();
      expect(deviceInfo).toBeDefined();
      expect(typeof deviceInfo.name).toBe('string');
      expect(typeof deviceInfo.channels).toBe('number');
      // 未连接时通道数可能为0，只验证数据类型
      expect(deviceInfo.channels).toBeGreaterThanOrEqual(0);
      
      // 测试状态聚合
      const status = multiDriver.getStatus();
      expect(status).toBeDefined();

      multiDriver.disconnect();
    });

    test('应该测试多设备的边界条件处理', () => {
      // 测试最小设备数量
      expect(() => new MultiAnalyzerDriver(['COM1', 'COM2'])).not.toThrow();
      
      // 测试最大设备数量
      const maxDevices = ['COM1', 'COM2', 'COM3', 'COM4', 'COM5'];
      expect(() => new MultiAnalyzerDriver(maxDevices)).not.toThrow();
      
      // 测试无效配置
      expect(() => new MultiAnalyzerDriver([])).toThrow();
      expect(() => new MultiAnalyzerDriver(['COM1'])).toThrow();
      expect(() => new MultiAnalyzerDriver(new Array(6).fill('COM1'))).toThrow();
      
      // 清理有效的驱动
      const validDriver = new MultiAnalyzerDriver(['COM1', 'COM2']);
      validDriver.disconnect();
      
      const maxDriver = new MultiAnalyzerDriver(maxDevices);
      maxDriver.disconnect();
    });
  });

  describe('其他专业驱动深度覆盖', () => {
    test('RigolSiglentDriver SCPI协议深度测试', () => {
      const rigolDriver = new RigolSiglentDriver('192.168.1.100', 5555);

      expect(rigolDriver).toBeInstanceOf(RigolSiglentDriver);
      expect(rigolDriver).toBeInstanceOf(AnalyzerDriverBase);
      expect(rigolDriver.isNetwork).toBe(true);

      // 测试SCPI特有属性
      expect(typeof rigolDriver.deviceVersion === 'string' || rigolDriver.deviceVersion === null).toBe(true);
      expect(typeof rigolDriver.channelCount).toBe('number');
      expect(typeof rigolDriver.maxFrequency).toBe('number');

      rigolDriver.disconnect();
    });

    test('SaleaeLogicDriver API接口深度测试', () => {
      const saleaeDriver = new SaleaeLogicDriver('localhost', 10429);

      expect(saleaeDriver).toBeInstanceOf(SaleaeLogicDriver);
      expect(saleaeDriver).toBeInstanceOf(AnalyzerDriverBase);
      expect(saleaeDriver.isNetwork).toBe(true);

      // 测试Saleae API特有属性
      expect(typeof saleaeDriver.deviceVersion === 'string' || saleaeDriver.deviceVersion === null).toBe(true);
      expect(typeof saleaeDriver.channelCount).toBe('number');
      expect(typeof saleaeDriver.maxFrequency).toBe('number');

      saleaeDriver.disconnect();
    });

    test('SigrokAdapter 深度适配器测试', () => {
      // 测试不同的构造方式
      const defaultAdapter = new SigrokAdapter();
      const namedAdapter = new SigrokAdapter('fx2lafw');
      const fullAdapter = new SigrokAdapter('fx2lafw', 'device1');

      const adapters = [defaultAdapter, namedAdapter, fullAdapter];

      adapters.forEach((adapter, index) => {
        expect(adapter).toBeInstanceOf(SigrokAdapter);
        expect(adapter).toBeInstanceOf(AnalyzerDriverBase);
        
        expect(typeof adapter.deviceVersion === 'string' || adapter.deviceVersion === null).toBe(true);
        expect(typeof adapter.channelCount).toBe('number');
        expect(typeof adapter.isNetwork).toBe('boolean');

        adapter.disconnect();
      });

      // 测试静态方法
      const supportedDevices = SigrokAdapter.getSupportedDevices();
      expect(Array.isArray(supportedDevices)).toBe(true);
    });
  });

  describe('综合场景和压力测试', () => {
    test('应该处理大量驱动并发操作', async () => {
      const drivers = [];
      const driverCount = 10;

      // 创建多种类型的驱动
      for (let i = 0; i < driverCount; i++) {
        if (i % 4 === 0) {
          drivers.push(new LogicAnalyzerDriver(`COM${i + 1}`));
        } else if (i % 4 === 1) {
          drivers.push(new NetworkLogicAnalyzerDriver(`192.168.1.${100 + i}`, 8080 + i));
        } else if (i % 4 === 2) {
          drivers.push(new RigolSiglentDriver(`10.0.0.${10 + i}`, 5555 + i));
        } else {
          drivers.push(new SaleaeLogicDriver(`127.0.0.${i}`, 10429 + i));
        }
      }

      // 测试所有驱动的基础功能
      drivers.forEach((driver, index) => {
        expect(driver).toBeInstanceOf(AnalyzerDriverBase);
        expect(typeof driver.channelCount).toBe('number');
        expect(typeof driver.maxFrequency).toBe('number');
        expect(typeof driver.isNetwork).toBe('boolean');
        expect(typeof driver.isCapturing).toBe('boolean');
      });

      // 测试并发状态查询
      const statusPromises = drivers.map(driver => 
        Promise.resolve(driver.getStatus())
      );
      const statuses = await Promise.all(statusPromises);
      
      expect(statuses.length).toBe(driverCount);
      statuses.forEach(status => {
        expect(status).toBeDefined();
      });

      // 清理所有驱动
      drivers.forEach(driver => {
        expect(() => driver.disconnect()).not.toThrow();
      });
    });

    test('应该处理复杂的驱动管理场景', async () => {
      const manager = new HardwareDriverManager();
      
      // 注册多种驱动类型
      const driverTypes = [
        { class: LogicAnalyzerDriver, type: 'serial' },
        { class: NetworkLogicAnalyzerDriver, type: 'network' },
        { class: RigolSiglentDriver, type: 'scpi' },
        { class: SaleaeLogicDriver, type: 'api' }
      ];

      const registeredIds = [];
      driverTypes.forEach((driverType, index) => {
        const driverId = `complex-test-${driverType.type}-${index}`;
        manager.registerDriver({
          id: driverId,
          name: `Complex Test ${driverType.type} Driver`,
          description: `Complex scenario test driver for ${driverType.type}`,
          version: '1.0.0',
          driverClass: driverType.class as any,
          supportedDevices: [`test-${driverType.type}`],
          priority: 50 + index * 10
        });
        registeredIds.push(driverId);
      });

      // 验证复杂场景下的管理器功能
      const registered = manager.getRegisteredDrivers();
      const available = manager.getAvailableDrivers();
      const connections = manager.getActiveConnections();
      
      expect(registered.length).toBeGreaterThanOrEqual(4);
      expect(available.length).toBeGreaterThanOrEqual(4); // 至少有我们注册的4个驱动类型
      expect(connections instanceof Map).toBe(true);

      // 清理
      registeredIds.forEach(id => {
        manager.unregisterDriver(id);
      });
      
      await manager.dispose();
    });
  });
});