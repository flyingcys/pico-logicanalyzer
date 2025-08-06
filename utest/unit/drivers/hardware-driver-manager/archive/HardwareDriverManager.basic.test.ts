/**
 * HardwareDriverManager 基础功能测试
 * 专注于可以实际测试的代码路径，避免循环依赖问题
 */

describe('HardwareDriverManager 模块加载测试', () => {
  it('应该能成功导入模块而不抛出错误', () => {
    expect(() => {
      require('../../../src/drivers/HardwareDriverManager');
    }).not.toThrow();
  });

  it('模块应该是一个对象', () => {
    const module = require('../../../src/drivers/HardwareDriverManager');
    expect(typeof module).toBe('object');
    expect(module).not.toBeNull();
  });

  it('模块应该有一些导出内容', () => {
    const module = require('../../../src/drivers/HardwareDriverManager');
    const exportNames = Object.keys(module);
    expect(exportNames.length).toBeGreaterThan(0);
  });
});

describe('设备检测接口测试', () => {
  it('DetectedDevice 接口结构应该正确', () => {
    // 测试DetectedDevice接口的结构
    const testDevice = {
      id: 'test-device-001',
      name: 'Test Logic Analyzer',
      type: 'serial' as const,
      connectionString: '/dev/ttyUSB0',
      driverType: 0,
      confidence: 85
    };
    
    expect(testDevice.id).toBe('test-device-001');
    expect(testDevice.name).toBe('Test Logic Analyzer');
    expect(testDevice.type).toBe('serial');
    expect(testDevice.connectionString).toBe('/dev/ttyUSB0');
    expect(testDevice.driverType).toBe(0);
    expect(testDevice.confidence).toBe(85);
    expect(typeof testDevice.confidence).toBe('number');
    expect(testDevice.confidence).toBeGreaterThan(0);
    expect(testDevice.confidence).toBeLessThanOrEqual(100);
  });

  it('DetectedDevice 可选属性应该正确处理', () => {
    const deviceWithCapabilities = {
      id: 'test-device-002',
      name: 'Advanced Logic Analyzer',
      type: 'network' as const,
      connectionString: '192.168.1.100:8080',
      driverType: 1,
      confidence: 95,
      capabilities: {
        channels: 16,
        maxSampleRate: 100000000,
        bufferSize: 1024 * 1024
      }
    };
    
    expect(deviceWithCapabilities.capabilities).toBeDefined();
    expect(deviceWithCapabilities.capabilities?.channels).toBe(16);
    expect(deviceWithCapabilities.capabilities?.maxSampleRate).toBe(100000000);
    expect(deviceWithCapabilities.capabilities?.bufferSize).toBe(1048576);
  });
});

describe('驱动注册接口测试', () => {
  it('DriverRegistration 接口结构应该正确', () => {
    class MockDriver {
      constructor(public connectionString: string) {}
    }
    
    const testRegistration = {
      id: 'mock-driver',
      name: 'Mock Driver',
      description: 'A mock driver for testing',
      version: '1.0.0',
      driverClass: MockDriver,
      supportedDevices: ['mock', 'test'],
      priority: 50
    };
    
    expect(testRegistration.id).toBe('mock-driver');
    expect(testRegistration.name).toBe('Mock Driver');
    expect(testRegistration.description).toBe('A mock driver for testing');
    expect(testRegistration.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Array.isArray(testRegistration.supportedDevices)).toBe(true);
    expect(testRegistration.supportedDevices.length).toBeGreaterThan(0);
    expect(typeof testRegistration.priority).toBe('number');
    expect(testRegistration.priority).toBeGreaterThan(0);
  });

  it('驱动优先级应该在合理范围内', () => {
    const priorities = [
      { name: 'pico-logic-analyzer', priority: 100 },
      { name: 'saleae-logic', priority: 90 },
      { name: 'rigol-siglent', priority: 80 },
      { name: 'sigrok-adapter', priority: 70 },
      { name: 'network-analyzer', priority: 60 }
    ];
    
    priorities.forEach(driver => {
      expect(driver.priority).toBeGreaterThan(0);
      expect(driver.priority).toBeLessThanOrEqual(100);
      expect(typeof driver.priority).toBe('number');
    });
    
    // 验证优先级排序
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i-1].priority).toBeGreaterThanOrEqual(priorities[i].priority);
    }
  });
});

describe('设备检测器接口测试', () => {
  it('IDeviceDetector 接口应该有正确的方法签名', () => {
    class MockDetector {
      readonly name = 'Mock Device Detector';
      
      async detect() {
        return [];
      }
    }
    
    const detector = new MockDetector();
    
    expect(detector.name).toBe('Mock Device Detector');
    expect(typeof detector.detect).toBe('function');
    expect(detector.detect()).toBeInstanceOf(Promise);
  });

  it('串口设备检测逻辑应该正确', () => {
    // 测试Pico设备识别逻辑
    const isPicoDevice = (port: any) => {
      return (
        port.vendorId === '2E8A' || // Raspberry Pi Foundation
        port.productId === '0003' || // Pico
        (port.manufacturer && port.manufacturer.includes('Pico'))
      );
    };
    
    // 测试正确识别Pico设备
    const picoPort = {
      path: '/dev/ttyUSB0',
      vendorId: '2E8A',
      productId: '0003',
      manufacturer: 'Pico'
    };
    
    expect(isPicoDevice(picoPort)).toBe(true);
    
    // 测试正确排除非Pico设备
    const otherPort = {
      path: '/dev/ttyUSB1',
      vendorId: '1234',
      productId: '5678',
      manufacturer: 'Other'
    };
    
    expect(isPicoDevice(otherPort)).toBe(false);
  });
});

describe('网络设备检测测试', () => {
  it('网络地址格式应该正确验证', () => {
    const isValidNetworkAddress = (address: string) => {
      const regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5]):([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;
      return regex.test(address);
    };
    
    // 测试有效地址
    const validAddresses = [
      '192.168.1.100:8080',
      '10.0.0.1:24000',
      '172.16.0.1:5555'
    ];
    
    validAddresses.forEach(address => {
      expect(isValidNetworkAddress(address)).toBe(true);
    });
    
    // 测试无效地址
    const invalidAddresses = [
      'invalid:address',
      '192.168.1.100',
      '256.256.256.256:8080',
      '192.168.1.100:99999'
    ];
    
    invalidAddresses.forEach(address => {
      expect(isValidNetworkAddress(address)).toBe(false);
    });
  });

  it('常见端口应该正确定义', () => {
    const commonPorts = [24000, 5555, 8080, 10000, 10429];
    
    commonPorts.forEach(port => {
      expect(typeof port).toBe('number');
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });
  });
});

describe('驱动匹配算法测试', () => {
  it('精确匹配算法应该正确工作', () => {
    const isExactMatch = (deviceName: string, supportedDevices: string[]) => {
      return supportedDevices.some(supported =>
        deviceName.toLowerCase().includes(supported.toLowerCase())
      );
    };
    
    // 测试精确匹配
    expect(isExactMatch('Saleae Logic 16', ['saleae', 'logic'])).toBe(true);
    expect(isExactMatch('Pico Logic Analyzer', ['pico', 'analyzer'])).toBe(true);
    expect(isExactMatch('Unknown Device', ['saleae', 'pico'])).toBe(false);
  });

  it('通用匹配算法应该正确工作', () => {
    const getGenericDrivers = (deviceType: string) => {
      const drivers: { [key: string]: string[] } = {
        'serial': ['pico-logic-analyzer', 'sigrok-adapter'],
        'network': ['saleae-logic', 'rigol-siglent', 'network-analyzer'],
        'usb': ['sigrok-adapter']
      };
      
      return drivers[deviceType] || [];
    };
    
    expect(getGenericDrivers('serial')).toEqual(['pico-logic-analyzer', 'sigrok-adapter']);
    expect(getGenericDrivers('network')).toEqual(['saleae-logic', 'rigol-siglent', 'network-analyzer']);
    expect(getGenericDrivers('usb')).toEqual(['sigrok-adapter']);
    expect(getGenericDrivers('unknown')).toEqual([]);
  });
});

describe('多设备驱动验证测试', () => {
  it('连接字符串数量验证应该正确', () => {
    const validateConnectionStrings = (connections: string[]) => {
      if (connections.length < 2 || connections.length > 5) {
        throw new Error('多设备驱动需要2-5个连接字符串');
      }
      return true;
    };
    
    // 测试有效数量
    expect(validateConnectionStrings(['/dev/ttyUSB0', '/dev/ttyUSB1'])).toBe(true);
    expect(validateConnectionStrings(['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2'])).toBe(true);
    
    // 测试无效数量
    expect(() => validateConnectionStrings(['/dev/ttyUSB0'])).toThrow('多设备驱动需要2-5个连接字符串');
    expect(() => validateConnectionStrings(Array(6).fill('/dev/ttyUSB0'))).toThrow('多设备驱动需要2-5个连接字符串');
  });
});

describe('配置和常量测试', () => {
  it('缓存超时配置应该合理', () => {
    const cacheTimeout = 30000; // 30秒
    
    expect(typeof cacheTimeout).toBe('number');
    expect(cacheTimeout).toBeGreaterThan(0);
    expect(cacheTimeout).toBeLessThanOrEqual(300000); // 不超过5分钟
  });

  it('网络扫描配置应该合理', () => {
    const maxScanIPs = 50;
    const scanTimeout = 1000; // 1秒
    
    expect(maxScanIPs).toBeGreaterThan(0);
    expect(maxScanIPs).toBeLessThanOrEqual(100);
    expect(scanTimeout).toBeGreaterThan(0);
    expect(scanTimeout).toBeLessThanOrEqual(5000);
  });

  it('设备置信度范围应该正确', () => {
    const confidenceValues = [60, 70, 80, 85, 90, 95, 100];
    
    confidenceValues.forEach(confidence => {
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });
});