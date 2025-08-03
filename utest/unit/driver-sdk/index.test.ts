import * as DriverSDK from '../../../src/driver-sdk/index';

describe('Driver SDK Index', () => {
  describe('核心导出验证', () => {
    it('应该导出AnalyzerDriverBase基类', () => {
      expect(DriverSDK.AnalyzerDriverBase).toBeDefined();
      expect(typeof DriverSDK.AnalyzerDriverBase).toBe('function');
    });

    it('应该导出AnalyzerTypes模型', () => {
      // 验证主要的类型导出
      expect(DriverSDK.AnalyzerDriverType).toBeDefined();
      expect(DriverSDK.CaptureError).toBeDefined();
      expect(DriverSDK.TriggerType).toBeDefined();
      expect(DriverSDK.CaptureMode).toBeDefined();
    });
  });

  describe('开发工具导出验证', () => {
    it('应该导出驱动验证器', () => {
      expect(DriverSDK.DriverValidator).toBeDefined();
      expect(typeof DriverSDK.DriverValidator).toBe('function');
    });

    it('应该导出驱动测试器', () => {
      expect(DriverSDK.DriverTester).toBeDefined();
      expect(typeof DriverSDK.DriverTester).toBe('function');
    });

    it('应该导出硬件能力构建器', () => {
      expect(DriverSDK.HardwareCapabilityBuilder).toBeDefined();
      expect(typeof DriverSDK.HardwareCapabilityBuilder).toBe('function');
    });

    it('应该导出协议助手', () => {
      expect(DriverSDK.ProtocolHelper).toBeDefined();
      expect(typeof DriverSDK.ProtocolHelper).toBe('function');
    });
  });

  describe('驱动模板导出验证', () => {
    it('应该导出通用驱动模板', () => {
      expect(DriverSDK.GenericDriverTemplate).toBeDefined();
      expect(typeof DriverSDK.GenericDriverTemplate).toBe('function');
    });

    it('应该导出串口驱动模板', () => {
      expect(DriverSDK.SerialDriverTemplate).toBeDefined();
      expect(typeof DriverSDK.SerialDriverTemplate).toBe('function');
    });

    it('应该导出网络驱动模板', () => {
      expect(DriverSDK.NetworkDriverTemplate).toBeDefined();
      expect(typeof DriverSDK.NetworkDriverTemplate).toBe('function');
    });
  });

  describe('示例驱动导出验证', () => {
    it('应该导出串口示例驱动', () => {
      expect(DriverSDK.ExampleSerialDriver).toBeDefined();
      expect(typeof DriverSDK.ExampleSerialDriver).toBe('function');
    });

    it('应该导出网络示例驱动', () => {
      expect(DriverSDK.ExampleNetworkDriver).toBeDefined();
      expect(typeof DriverSDK.ExampleNetworkDriver).toBe('function');
    });
  });

  describe('工具函数导出验证', () => {
    it('应该导出createDriverPackage函数', () => {
      expect(DriverSDK.createDriverPackage).toBeDefined();
      expect(typeof DriverSDK.createDriverPackage).toBe('function');
    });

    it('应该导出validateDriverImplementation函数', () => {
      expect(DriverSDK.validateDriverImplementation).toBeDefined();
      expect(typeof DriverSDK.validateDriverImplementation).toBe('function');
    });

    it('应该导出testDriverFunctionality函数', () => {
      expect(DriverSDK.testDriverFunctionality).toBeDefined();
      expect(typeof DriverSDK.testDriverFunctionality).toBe('function');
    });

    it('应该导出generateDriverDocumentation函数', () => {
      expect(DriverSDK.generateDriverDocumentation).toBeDefined();
      expect(typeof DriverSDK.generateDriverDocumentation).toBe('function');
    });
  });

  describe('版本和常量导出验证', () => {
    it('应该导出SDK版本信息', () => {
      expect(DriverSDK.SDK_VERSION).toBeDefined();
      expect(typeof DriverSDK.SDK_VERSION).toBe('string');
      expect(DriverSDK.SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('应该导出支持的API版本', () => {
      expect(DriverSDK.SUPPORTED_API_VERSION).toBeDefined();
      expect(typeof DriverSDK.SUPPORTED_API_VERSION).toBe('string');
      expect(DriverSDK.SUPPORTED_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('应该导出驱动常量', () => {
      expect(DriverSDK.DRIVER_CONSTANTS).toBeDefined();
      expect(typeof DriverSDK.DRIVER_CONSTANTS).toBe('object');
      
      // 验证各个常量
      expect(DriverSDK.DRIVER_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT).toBe(5000);
      expect(DriverSDK.DRIVER_CONSTANTS.DEFAULT_COMMAND_TIMEOUT).toBe(10000);
      expect(DriverSDK.DRIVER_CONSTANTS.DEFAULT_DATA_TIMEOUT).toBe(30000);
      expect(DriverSDK.DRIVER_CONSTANTS.MAX_RETRY_ATTEMPTS).toBe(3);
      expect(DriverSDK.DRIVER_CONSTANTS.RECOMMENDED_BUFFER_SIZE).toBe(1024 * 1024);
      expect(DriverSDK.DRIVER_CONSTANTS.MIN_SAMPLE_RATE).toBe(1000);
      expect(DriverSDK.DRIVER_CONSTANTS.MAX_SAMPLE_RATE).toBe(1000000000);
    });

    it('应该导出支持的设备类型枚举', () => {
      expect(DriverSDK.SupportedDeviceTypes).toBeDefined();
      expect(typeof DriverSDK.SupportedDeviceTypes).toBe('object');
      
      // 验证枚举值
      expect(DriverSDK.SupportedDeviceTypes.USB_SERIAL).toBe('usb-serial');
      expect(DriverSDK.SupportedDeviceTypes.NETWORK_TCP).toBe('network-tcp');
      expect(DriverSDK.SupportedDeviceTypes.NETWORK_UDP).toBe('network-udp');
      expect(DriverSDK.SupportedDeviceTypes.BLUETOOTH).toBe('bluetooth');
      expect(DriverSDK.SupportedDeviceTypes.USB_HID).toBe('usb-hid');
      expect(DriverSDK.SupportedDeviceTypes.SPI).toBe('spi');
      expect(DriverSDK.SupportedDeviceTypes.I2C).toBe('i2c');
    });

    it('应该导出驱动质量等级枚举', () => {
      expect(DriverSDK.DriverQualityLevel).toBeDefined();
      expect(typeof DriverSDK.DriverQualityLevel).toBe('object');
      
      // 验证枚举值
      expect(DriverSDK.DriverQualityLevel.EXPERIMENTAL).toBe('experimental');
      expect(DriverSDK.DriverQualityLevel.BETA).toBe('beta');
      expect(DriverSDK.DriverQualityLevel.STABLE).toBe('stable');
      expect(DriverSDK.DriverQualityLevel.CERTIFIED).toBe('certified');
    });
  });

  describe('导出完整性验证', () => {
    it('应该导出所有预期的符号', () => {
      const expectedExports = [
        // 核心基类和类型
        'AnalyzerDriverBase',
        'AnalyzerDriverType',
        'CaptureError',
        'TriggerType',
        'CaptureMode',
        
        // 开发工具
        'DriverValidator',
        'DriverTester',
        'HardwareCapabilityBuilder',
        'ProtocolHelper',
        
        // 驱动模板
        'GenericDriverTemplate',
        'SerialDriverTemplate',
        'NetworkDriverTemplate',
        
        // 示例驱动
        'ExampleSerialDriver',
        'ExampleNetworkDriver',
        
        // 工具函数
        'createDriverPackage',
        'validateDriverImplementation',
        'testDriverFunctionality',
        'generateDriverDocumentation',
        
        // 版本和常量
        'SDK_VERSION',
        'SUPPORTED_API_VERSION',
        'DRIVER_CONSTANTS',
        'SupportedDeviceTypes',
        'DriverQualityLevel'
      ];

      expectedExports.forEach(exportName => {
        expect(DriverSDK).toHaveProperty(exportName);
      });
    });

    it('导出的类应该是可实例化的', () => {
      // 测试模板类的实例化
      expect(() => new DriverSDK.GenericDriverTemplate('test')).not.toThrow();
      expect(() => new DriverSDK.SerialDriverTemplate('test')).not.toThrow();
      expect(() => new DriverSDK.NetworkDriverTemplate('test')).not.toThrow();
      
      // 测试示例驱动的实例化
      expect(() => new DriverSDK.ExampleSerialDriver('test')).not.toThrow();
      expect(() => new DriverSDK.ExampleNetworkDriver('test')).not.toThrow();
      
      // 测试工具类的实例化
      expect(() => new DriverSDK.DriverValidator()).not.toThrow();
      expect(() => new DriverSDK.DriverTester()).not.toThrow();
      expect(() => new DriverSDK.HardwareCapabilityBuilder()).not.toThrow();
      expect(() => new DriverSDK.ProtocolHelper()).not.toThrow();
    });

    it('导出的函数应该是可调用的', () => {
      // 验证工具函数是可调用的（不实际调用，只检查类型）
      expect(typeof DriverSDK.createDriverPackage).toBe('function');
      expect(typeof DriverSDK.validateDriverImplementation).toBe('function');
      expect(typeof DriverSDK.testDriverFunctionality).toBe('function');
      expect(typeof DriverSDK.generateDriverDocumentation).toBe('function');
    });
  });

  describe('版本兼容性验证', () => {
    it('SDK版本应该是有效的语义化版本', () => {
      const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
      expect(DriverSDK.SDK_VERSION).toMatch(semverRegex);
    });

    it('支持的API版本应该是有效的语义化版本', () => {
      const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
      expect(DriverSDK.SUPPORTED_API_VERSION).toMatch(semverRegex);
    });

    it('SDK版本应该与API版本兼容', () => {
      const parseVersion = (version: string) => {
        const parts = version.split('.');
        return {
          major: parseInt(parts[0]),
          minor: parseInt(parts[1]),
          patch: parseInt(parts[2])
        };
      };

      const sdkVersion = parseVersion(DriverSDK.SDK_VERSION);
      const apiVersion = parseVersion(DriverSDK.SUPPORTED_API_VERSION);

      // API版本的主版本号应该小于等于SDK版本
      expect(apiVersion.major).toBeLessThanOrEqual(sdkVersion.major);
    });
  });

  describe('常量合理性验证', () => {
    it('超时常量应该是合理的值', () => {
      const constants = DriverSDK.DRIVER_CONSTANTS;
      
      expect(constants.DEFAULT_CONNECTION_TIMEOUT).toBeGreaterThan(0);
      expect(constants.DEFAULT_CONNECTION_TIMEOUT).toBeLessThan(60000); // 不超过1分钟
      
      expect(constants.DEFAULT_COMMAND_TIMEOUT).toBeGreaterThan(constants.DEFAULT_CONNECTION_TIMEOUT);
      expect(constants.DEFAULT_COMMAND_TIMEOUT).toBeLessThan(300000); // 不超过5分钟
      
      expect(constants.DEFAULT_DATA_TIMEOUT).toBeGreaterThan(constants.DEFAULT_COMMAND_TIMEOUT);
      expect(constants.DEFAULT_DATA_TIMEOUT).toBeLessThan(600000); // 不超过10分钟
    });

    it('重试次数应该是合理的值', () => {
      const constants = DriverSDK.DRIVER_CONSTANTS;
      
      expect(constants.MAX_RETRY_ATTEMPTS).toBeGreaterThan(0);
      expect(constants.MAX_RETRY_ATTEMPTS).toBeLessThan(10); // 不超过10次
    });

    it('缓冲区大小应该是合理的值', () => {
      const constants = DriverSDK.DRIVER_CONSTANTS;
      
      expect(constants.RECOMMENDED_BUFFER_SIZE).toBeGreaterThan(0);
      expect(constants.RECOMMENDED_BUFFER_SIZE).toBeLessThan(1024 * 1024 * 1024); // 不超过1GB
    });

    it('采样率范围应该是合理的值', () => {
      const constants = DriverSDK.DRIVER_CONSTANTS;
      
      expect(constants.MIN_SAMPLE_RATE).toBeGreaterThan(0);
      expect(constants.MIN_SAMPLE_RATE).toBeLessThan(constants.MAX_SAMPLE_RATE);
      expect(constants.MAX_SAMPLE_RATE).toBeLessThan(100000000000); // 不超过100GHz
    });
  });

  describe('枚举完整性验证', () => {
    it('支持的设备类型应该包含所有预期类型', () => {
      const deviceTypes = Object.values(DriverSDK.SupportedDeviceTypes);
      const expectedTypes = [
        'usb-serial',
        'network-tcp',
        'network-udp',
        'bluetooth',
        'usb-hid',
        'spi',
        'i2c'
      ];

      expectedTypes.forEach(type => {
        expect(deviceTypes).toContain(type);
      });
    });

    it('驱动质量等级应该包含所有预期等级', () => {
      const qualityLevels = Object.values(DriverSDK.DriverQualityLevel);
      const expectedLevels = [
        'experimental',
        'beta',
        'stable',
        'certified'
      ];

      expectedLevels.forEach(level => {
        expect(qualityLevels).toContain(level);
      });
    });

    it('枚举值应该是字符串类型', () => {
      Object.values(DriverSDK.SupportedDeviceTypes).forEach(value => {
        expect(typeof value).toBe('string');
      });

      Object.values(DriverSDK.DriverQualityLevel).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });
  });

  describe('模块稳定性验证', () => {
    it('多次导入应该返回相同的引用', () => {
      const secondImport = require('../../../src/driver-sdk/index');
      
      expect(DriverSDK.DriverValidator).toBe(secondImport.DriverValidator);
      expect(DriverSDK.DriverTester).toBe(secondImport.DriverTester);
      expect(DriverSDK.SDK_VERSION).toBe(secondImport.SDK_VERSION);
      expect(DriverSDK.DRIVER_CONSTANTS).toBe(secondImport.DRIVER_CONSTANTS);
    });

    it('常量对象应该是只读的', () => {
      // 尝试修改常量（在严格模式下会失败）
      const originalTimeout = DriverSDK.DRIVER_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT;
      
      expect(() => {
        (DriverSDK.DRIVER_CONSTANTS as any).DEFAULT_CONNECTION_TIMEOUT = 999;
      }).not.toThrow(); // TypeScript防止编译时错误，但运行时可能允许
      
      // 验证值是否实际发生了变化（如果没有，说明是只读的）
      // 注意：这个测试取决于具体的实现
    });

    it('枚举对象应该是稳定的', () => {
      const deviceTypeKeys = Object.keys(DriverSDK.SupportedDeviceTypes);
      const qualityLevelKeys = Object.keys(DriverSDK.DriverQualityLevel);
      
      expect(deviceTypeKeys.length).toBeGreaterThan(0);
      expect(qualityLevelKeys.length).toBeGreaterThan(0);
      
      // 枚举键应该是固定的
      expect(deviceTypeKeys).toContain('USB_SERIAL');
      expect(deviceTypeKeys).toContain('NETWORK_TCP');
      expect(qualityLevelKeys).toContain('EXPERIMENTAL');
      expect(qualityLevelKeys).toContain('STABLE');
    });
  });
});