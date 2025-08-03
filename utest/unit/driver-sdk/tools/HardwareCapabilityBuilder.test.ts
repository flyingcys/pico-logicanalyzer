import { HardwareCapabilityBuilder } from '../../../../src/driver-sdk/tools/HardwareCapabilityBuilder';
import {
  HardwareCapability,
  TriggerCapability,
  HardwareCapabilityProfile,
  ProtocolCapability
} from '../../../../src/driver-sdk/tools/HardwareCapabilityBuilder';

describe('HardwareCapabilityBuilder', () => {
  let builder: HardwareCapabilityBuilder;

  beforeEach(() => {
    builder = new HardwareCapabilityBuilder();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化构建器', () => {
      expect(builder).toBeInstanceOf(HardwareCapabilityBuilder);
    });

    it('应该有默认的空能力配置', () => {
      const capabilities = builder.build();
      expect(capabilities).toBeDefined();
      expect(capabilities.basicInfo).toBeDefined();
    });
  });

  describe('基本信息配置', () => {
    it('应该能够设置设备名称', () => {
      builder.setDeviceName('Test Device');
      const capabilities = builder.build();
      
      expect(capabilities.basicInfo.deviceName).toBe('Test Device');
    });

    it('应该能够设置设备版本', () => {
      builder.setDeviceVersion('v2.1.0');
      const capabilities = builder.build();
      
      expect(capabilities.basicInfo.version).toBe('v2.1.0');
    });

    it('应该能够设置制造商信息', () => {
      builder.setManufacturer('Test Manufacturer');
      const capabilities = builder.build();
      
      expect(capabilities.basicInfo.manufacturer).toBe('Test Manufacturer');
    });

    it('应该能够设置设备描述', () => {
      const description = '高性能逻辑分析器';
      builder.setDescription(description);
      const capabilities = builder.build();
      
      expect(capabilities.basicInfo.description).toBe(description);
    });

    it('应该能够设置多个基本信息', () => {
      builder
        .setDeviceName('Multi Info Device')
        .setDeviceVersion('v1.0.0')
        .setManufacturer('Multi Manufacturer')
        .setDescription('多信息测试设备');

      const capabilities = builder.build();
      
      expect(capabilities.basicInfo.deviceName).toBe('Multi Info Device');
      expect(capabilities.basicInfo.version).toBe('v1.0.0');
      expect(capabilities.basicInfo.manufacturer).toBe('Multi Manufacturer');
      expect(capabilities.basicInfo.description).toBe('多信息测试设备');
    });
  });

  describe('数字通道配置', () => {
    it('应该能够设置数字通道数量', () => {
      builder.setDigitalChannels(16);
      const capabilities = builder.build();
      
      expect(capabilities.channels.digital.count).toBe(16);
    });

    it('应该能够设置通道电压范围', () => {
      builder.setChannelVoltageRange(0, 5.0);
      const capabilities = builder.build();
      
      expect(capabilities.channels.digital.voltageRange.min).toBe(0);
      expect(capabilities.channels.digital.voltageRange.max).toBe(5.0);
    });

    it('应该能够设置输入阻抗', () => {
      builder.setInputImpedance(1000000); // 1MΩ
      const capabilities = builder.build();
      
      expect(capabilities.channels.digital.inputImpedance).toBe(1000000);
    });

    it('应该能够配置完整的数字通道', () => {
      builder
        .setDigitalChannels(32)
        .setChannelVoltageRange(-2.5, 7.5)
        .setInputImpedance(500000);

      const capabilities = builder.build();
      
      expect(capabilities.channels.digital.count).toBe(32);
      expect(capabilities.channels.digital.voltageRange.min).toBe(-2.5);
      expect(capabilities.channels.digital.voltageRange.max).toBe(7.5);
      expect(capabilities.channels.digital.inputImpedance).toBe(500000);
    });
  });

  describe('采样配置', () => {
    it('应该能够设置最大采样率', () => {
      builder.setMaxSampleRate(200000000); // 200MHz
      const capabilities = builder.build();
      
      expect(capabilities.sampling.maxSampleRate).toBe(200000000);
    });

    it('应该能够设置缓冲区大小', () => {
      builder.setBufferSize(2048000); // 2M samples
      const capabilities = builder.build();
      
      expect(capabilities.sampling.bufferSize).toBe(2048000);
    });

    it('应该能够设置支持的采样率列表', () => {
      const supportedRates = [1000, 10000, 100000, 1000000, 10000000];
      builder.setSupportedSampleRates(supportedRates);
      const capabilities = builder.build();
      
      expect(capabilities.sampling.supportedRates).toEqual(supportedRates);
    });

    it('应要能够设置最小采样率', () => {
      builder.setMinSampleRate(1000);
      const capabilities = builder.build();
      
      expect(capabilities.sampling.minSampleRate).toBe(1000);
    });

    it('应该能够配置完整的采样能力', () => {
      const supportedRates = [1000, 5000, 10000, 50000, 100000];
      
      builder
        .setMinSampleRate(1000)
        .setMaxSampleRate(100000)
        .setBufferSize(1024000)
        .setSupportedSampleRates(supportedRates);

      const capabilities = builder.build();
      
      expect(capabilities.sampling.minSampleRate).toBe(1000);
      expect(capabilities.sampling.maxSampleRate).toBe(100000);
      expect(capabilities.sampling.bufferSize).toBe(1024000);
      expect(capabilities.sampling.supportedRates).toEqual(supportedRates);
    });
  });

  describe('触发配置', () => {
    it('应该能够添加边沿触发', () => {
      builder.addTriggerType('edge');
      const capabilities = builder.build();
      
      expect(capabilities.triggers.supportedTypes).toContain('edge');
    });

    it('应该能够添加复杂触发', () => {
      builder.addTriggerType('complex');
      const capabilities = builder.build();
      
      expect(capabilities.triggers.supportedTypes).toContain('complex');
    });

    it('应该能够设置最大触发通道数', () => {
      builder.setMaxTriggerChannels(8);
      const capabilities = builder.build();
      
      expect(capabilities.triggers.maxChannels).toBe(8);
    });

    it('应该能够添加多种触发类型', () => {
      builder
        .addTriggerType('edge')
        .addTriggerType('complex')
        .addTriggerType('pattern')
        .setMaxTriggerChannels(16);

      const capabilities = builder.build();
      
      expect(capabilities.triggers.supportedTypes).toContain('edge');
      expect(capabilities.triggers.supportedTypes).toContain('complex');
      expect(capabilities.triggers.supportedTypes).toContain('pattern');
      expect(capabilities.triggers.maxChannels).toBe(16);
    });

    it('应该避免重复添加相同的触发类型', () => {
      builder
        .addTriggerType('edge')
        .addTriggerType('edge')
        .addTriggerType('edge');

      const capabilities = builder.build();
      
      const edgeCount = capabilities.triggers.supportedTypes.filter(type => type === 'edge').length;
      expect(edgeCount).toBe(1);
    });
  });

  describe('协议支持配置', () => {
    it('应该能够添加I2C协议支持', () => {
      builder.addProtocolSupport('I2C');
      const capabilities = builder.build();
      
      expect(capabilities.protocols.supported).toContain('I2C');
    });

    it('应该能够添加SPI协议支持', () => {
      builder.addProtocolSupport('SPI');
      const capabilities = builder.build();
      
      expect(capabilities.protocols.supported).toContain('SPI');
    });

    it('应该能够添加UART协议支持', () => {
      builder.addProtocolSupport('UART');
      const capabilities = builder.build();
      
      expect(capabilities.protocols.supported).toContain('UART');
    });

    it('应该能够添加多种协议支持', () => {
      builder
        .addProtocolSupport('I2C')
        .addProtocolSupport('SPI')
        .addProtocolSupport('UART')
        .addProtocolSupport('CAN');

      const capabilities = builder.build();
      
      expect(capabilities.protocols.supported).toContain('I2C');
      expect(capabilities.protocols.supported).toContain('SPI');
      expect(capabilities.protocols.supported).toContain('UART');
      expect(capabilities.protocols.supported).toContain('CAN');
    });

    it('应该避免重复添加相同的协议', () => {
      builder
        .addProtocolSupport('I2C')
        .addProtocolSupport('I2C')
        .addProtocolSupport('I2C');

      const capabilities = builder.build();
      
      const i2cCount = capabilities.protocols.supported.filter(protocol => protocol === 'I2C').length;
      expect(i2cCount).toBe(1);
    });
  });

  describe('连接配置', () => {
    it('应该能够设置连接类型为USB', () => {
      builder.setConnectionType('USB');
      const capabilities = builder.build();
      
      expect(capabilities.connection.type).toBe('USB');
    });

    it('应该能够设置连接类型为网络', () => {
      builder.setConnectionType('Network');
      const capabilities = builder.build();
      
      expect(capabilities.connection.type).toBe('Network');
    });

    it('应该能够设置连接速度', () => {
      builder.setConnectionSpeed(480000000); // USB 2.0 高速
      const capabilities = builder.build();
      
      expect(capabilities.connection.speed).toBe(480000000);
    });

    it('应该能够设置连接参数', () => {
      const connectionParams = {
        timeout: 5000,
        retries: 3,
        autoReconnect: true
      };
      
      builder.setConnectionParams(connectionParams);
      const capabilities = builder.build();
      
      expect(capabilities.connection.parameters).toEqual(connectionParams);
    });
  });

  describe('完整配置构建', () => {
    it('应该能够构建完整的硬件能力配置', () => {
      const capabilities = builder
        .setDeviceName('Complete Test Device')
        .setDeviceVersion('v1.0.0')
        .setManufacturer('Test Corp')
        .setDescription('完整测试设备')
        .setDigitalChannels(16)
        .setChannelVoltageRange(0, 3.3)
        .setInputImpedance(1000000)
        .setMinSampleRate(1000)
        .setMaxSampleRate(100000000)
        .setBufferSize(1048576)
        .setSupportedSampleRates([1000, 10000, 100000, 1000000, 10000000, 100000000])
        .addTriggerType('edge')
        .addTriggerType('complex')
        .setMaxTriggerChannels(4)
        .addProtocolSupport('I2C')
        .addProtocolSupport('SPI')
        .addProtocolSupport('UART')
        .setConnectionType('USB')
        .setConnectionSpeed(480000000)
        .build();

      // 验证基本信息
      expect(capabilities.basicInfo.deviceName).toBe('Complete Test Device');
      expect(capabilities.basicInfo.version).toBe('v1.0.0');
      expect(capabilities.basicInfo.manufacturer).toBe('Test Corp');
      expect(capabilities.basicInfo.description).toBe('完整测试设备');

      // 验证通道配置
      expect(capabilities.channels.digital.count).toBe(16);
      expect(capabilities.channels.digital.voltageRange.min).toBe(0);
      expect(capabilities.channels.digital.voltageRange.max).toBe(3.3);
      expect(capabilities.channels.digital.inputImpedance).toBe(1000000);

      // 验证采样配置
      expect(capabilities.sampling.minSampleRate).toBe(1000);
      expect(capabilities.sampling.maxSampleRate).toBe(100000000);
      expect(capabilities.sampling.bufferSize).toBe(1048576);
      expect(capabilities.sampling.supportedRates).toHaveLength(6);

      // 验证触发配置
      expect(capabilities.triggers.supportedTypes).toContain('edge');
      expect(capabilities.triggers.supportedTypes).toContain('complex');
      expect(capabilities.triggers.maxChannels).toBe(4);

      // 验证协议支持
      expect(capabilities.protocols.supported).toContain('I2C');
      expect(capabilities.protocols.supported).toContain('SPI');
      expect(capabilities.protocols.supported).toContain('UART');

      // 验证连接配置
      expect(capabilities.connection.type).toBe('USB');
      expect(capabilities.connection.speed).toBe(480000000);
    });
  });

  describe('预设配置', () => {
    it('应该能够使用入门级预设', () => {
      const capabilities = builder.usePreset('entry-level').build();
      
      expect(capabilities.channels.digital.count).toBeGreaterThan(0);
      expect(capabilities.sampling.maxSampleRate).toBeGreaterThan(0);
      expect(capabilities.triggers.supportedTypes.length).toBeGreaterThan(0);
    });

    it('应该能够使用专业级预设', () => {
      const capabilities = builder.usePreset('professional').build();
      
      expect(capabilities.channels.digital.count).toBeGreaterThan(0);
      expect(capabilities.sampling.maxSampleRate).toBeGreaterThan(0);
      expect(capabilities.triggers.supportedTypes.length).toBeGreaterThan(0);
    });

    it('应该能够使用高端预设', () => {
      const capabilities = builder.usePreset('high-end').build();
      
      expect(capabilities.channels.digital.count).toBeGreaterThan(0);
      expect(capabilities.sampling.maxSampleRate).toBeGreaterThan(0);
      expect(capabilities.triggers.supportedTypes.length).toBeGreaterThan(0);
    });

    it('专业级预设应该比入门级有更好的性能', () => {
      const entryCapabilities = builder.usePreset('entry-level').build();
      builder = new HardwareCapabilityBuilder(); // 重置构建器
      const proCapabilities = builder.usePreset('professional').build();
      
      expect(proCapabilities.channels.digital.count).toBeGreaterThanOrEqual(entryCapabilities.channels.digital.count);
      expect(proCapabilities.sampling.maxSampleRate).toBeGreaterThanOrEqual(entryCapabilities.sampling.maxSampleRate);
    });

    it('高端预设应该比专业级有更好的性能', () => {
      const proCapabilities = builder.usePreset('professional').build();
      builder = new HardwareCapabilityBuilder(); // 重置构建器
      const highEndCapabilities = builder.usePreset('high-end').build();
      
      expect(highEndCapabilities.channels.digital.count).toBeGreaterThanOrEqual(proCapabilities.channels.digital.count);
      expect(highEndCapabilities.sampling.maxSampleRate).toBeGreaterThanOrEqual(proCapabilities.sampling.maxSampleRate);
    });
  });

  describe('验证功能', () => {
    it('应该验证有效的配置', () => {
      const capabilities = builder
        .setDigitalChannels(8)
        .setMaxSampleRate(50000000)
        .setBufferSize(1000000)
        .build();

      const validation = builder.validate(capabilities);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toBeDefined();
    });

    it('应该检测无效的通道数量', () => {
      const capabilities = builder
        .setDigitalChannels(0) // 无效的通道数量
        .setMaxSampleRate(50000000)
        .setBufferSize(1000000)
        .build();

      const validation = builder.validate(capabilities);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('通道数量'))).toBe(true);
    });

    it('应该检测无效的采样率', () => {
      const capabilities = builder
        .setDigitalChannels(8)
        .setMaxSampleRate(0) // 无效的采样率
        .setBufferSize(1000000)
        .build();

      const validation = builder.validate(capabilities);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('采样率'))).toBe(true);
    });

    it('应该检测无效的缓冲区大小', () => {
      const capabilities = builder
        .setDigitalChannels(8)
        .setMaxSampleRate(50000000)
        .setBufferSize(0) // 无效的缓冲区大小
        .build();

      const validation = builder.validate(capabilities);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('缓冲区'))).toBe(true);
    });

    it('应该提供性能警告', () => {
      const capabilities = builder
        .setDigitalChannels(256) // 很多通道
        .setMaxSampleRate(10000000000) // 很高的采样率
        .setBufferSize(10000000000) // 很大的缓冲区
        .build();

      const validation = builder.validate(capabilities);
      
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('导出和导入功能', () => {
    it('应该能够导出配置为JSON', () => {
      const capabilities = builder
        .setDeviceName('Export Test Device')
        .setDigitalChannels(16)
        .setMaxSampleRate(100000000)
        .build();

      const json = builder.exportToJSON(capabilities);
      
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.basicInfo.deviceName).toBe('Export Test Device');
      expect(parsed.channels.digital.count).toBe(16);
      expect(parsed.sampling.maxSampleRate).toBe(100000000);
    });

    it('应该能够从JSON导入配置', () => {
      const originalCapabilities = builder
        .setDeviceName('Import Test Device')
        .setDigitalChannels(32)
        .setMaxSampleRate(200000000)
        .build();

      const json = builder.exportToJSON(originalCapabilities);
      const importedCapabilities = builder.importFromJSON(json);
      
      expect(importedCapabilities.basicInfo.deviceName).toBe('Import Test Device');
      expect(importedCapabilities.channels.digital.count).toBe(32);
      expect(importedCapabilities.sampling.maxSampleRate).toBe(200000000);
    });

    it('应该处理无效的JSON', () => {
      expect(() => {
        builder.importFromJSON('invalid json');
      }).toThrow();

      expect(() => {
        builder.importFromJSON('{"invalid": "structure"}');
      }).toThrow();
    });
  });

  describe('链式调用支持', () => {
    it('所有设置方法都应该返回构建器实例', () => {
      const result = builder
        .setDeviceName('Chain Test')
        .setDeviceVersion('v1.0.0')
        .setManufacturer('Chain Corp')
        .setDescription('链式调用测试')
        .setDigitalChannels(8)
        .setChannelVoltageRange(0, 3.3)
        .setInputImpedance(1000000)
        .setMinSampleRate(1000)
        .setMaxSampleRate(100000000)
        .setBufferSize(1048576)
        .setSupportedSampleRates([1000, 10000, 100000])
        .addTriggerType('edge')
        .setMaxTriggerChannels(4)
        .addProtocolSupport('I2C')
        .setConnectionType('USB')
        .setConnectionSpeed(480000000);

      expect(result).toBe(builder);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理极限数值', () => {
      const capabilities = builder
        .setDigitalChannels(Number.MAX_SAFE_INTEGER)
        .setMaxSampleRate(Number.MAX_SAFE_INTEGER)
        .setBufferSize(Number.MAX_SAFE_INTEGER)
        .build();

      expect(capabilities.channels.digital.count).toBe(Number.MAX_SAFE_INTEGER);
      expect(capabilities.sampling.maxSampleRate).toBe(Number.MAX_SAFE_INTEGER);
      expect(capabilities.sampling.bufferSize).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('应该处理负数值', () => {
      const capabilities = builder
        .setDigitalChannels(-1)
        .setMaxSampleRate(-1000)
        .setBufferSize(-1000)
        .build();

      const validation = builder.validate(capabilities);
      expect(validation.isValid).toBe(false);
    });

    it('应该处理空字符串', () => {
      const capabilities = builder
        .setDeviceName('')
        .setDeviceVersion('')
        .setManufacturer('')
        .setDescription('')
        .build();

      expect(capabilities.basicInfo.deviceName).toBe('');
      expect(capabilities.basicInfo.version).toBe('');
      expect(capabilities.basicInfo.manufacturer).toBe('');
      expect(capabilities.basicInfo.description).toBe('');
    });

    it('应该处理空数组', () => {
      const capabilities = builder
        .setSupportedSampleRates([])
        .build();

      expect(capabilities.sampling.supportedRates).toEqual([]);
    });
  });
});