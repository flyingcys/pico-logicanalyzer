import { ProtocolHelper } from '../../../../src/driver-sdk/tools/ProtocolHelper';
import {
  ProtocolConfig,
  ProtocolValidationResult,
  I2CConfig,
  SPIConfig,
  UARTConfig,
  CANConfig,
  ProtocolDetectionResult
} from '../../../../src/driver-sdk/tools/ProtocolHelper';

describe('ProtocolHelper', () => {
  let helper: ProtocolHelper;

  beforeEach(() => {
    helper = new ProtocolHelper();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化协议助手', () => {
      expect(helper).toBeInstanceOf(ProtocolHelper);
    });

    it('应该包含预定义的协议配置', () => {
      const supportedProtocols = helper.getSupportedProtocols();
      expect(supportedProtocols).toBeInstanceOf(Array);
      expect(supportedProtocols.length).toBeGreaterThan(0);
    });
  });

  describe('支持的协议管理', () => {
    it('应该返回支持的协议列表', () => {
      const protocols = helper.getSupportedProtocols();
      
      expect(protocols).toContain('I2C');
      expect(protocols).toContain('SPI');
      expect(protocols).toContain('UART');
    });

    it('应该能够检查协议是否支持', () => {
      expect(helper.isProtocolSupported('I2C')).toBe(true);
      expect(helper.isProtocolSupported('SPI')).toBe(true);
      expect(helper.isProtocolSupported('UART')).toBe(true);
      expect(helper.isProtocolSupported('UNKNOWN_PROTOCOL')).toBe(false);
    });
  });

  describe('I2C协议配置', () => {
    it('应该能够创建I2C配置', () => {
      const i2cConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000,
        addressBits: 7
      };

      const config = helper.createI2CConfig(i2cConfig);
      
      expect(config.type).toBe('I2C');
      expect(config.clockPin).toBe(0);
      expect(config.dataPin).toBe(1);
      expect(config.clockFrequency).toBe(100000);
      expect(config.addressBits).toBe(7);
    });

    it('应该验证I2C配置', () => {
      const validConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000,
        addressBits: 7
      };

      const validation = helper.validateI2CConfig(validConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该检测I2C配置错误', () => {
      const invalidConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 0, // 与时钟引脚相同
        clockFrequency: 0, // 无效频率
        addressBits: 5 // 无效地址位数
      };

      const validation = helper.validateI2CConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('应该提供I2C配置建议', () => {
      const suggestions = helper.getI2CConfigSuggestions();
      
      expect(suggestions).toBeDefined();
      expect(suggestions.clockFrequencies).toContain(100000); // 标准模式
      expect(suggestions.clockFrequencies).toContain(400000); // 快速模式
      expect(suggestions.addressBitOptions).toContain(7);
      expect(suggestions.addressBitOptions).toContain(10);
    });
  });

  describe('SPI协议配置', () => {
    it('应该能够创建SPI配置', () => {
      const spiConfig: SPIConfig = {
        type: 'SPI',
        clockPin: 0,
        mosiPin: 1,
        misoPin: 2,
        selectPin: 3,
        clockFrequency: 1000000,
        mode: 0,
        bitOrder: 'MSB'
      };

      const config = helper.createSPIConfig(spiConfig);
      
      expect(config.type).toBe('SPI');
      expect(config.clockPin).toBe(0);
      expect(config.mosiPin).toBe(1);
      expect(config.misoPin).toBe(2);
      expect(config.selectPin).toBe(3);
      expect(config.clockFrequency).toBe(1000000);
      expect(config.mode).toBe(0);
      expect(config.bitOrder).toBe('MSB');
    });

    it('应该验证SPI配置', () => {
      const validConfig: SPIConfig = {
        type: 'SPI',
        clockPin: 0,
        mosiPin: 1,
        misoPin: 2,
        selectPin: 3,
        clockFrequency: 1000000,
        mode: 1,
        bitOrder: 'LSB'
      };

      const validation = helper.validateSPIConfig(validConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该检测SPI引脚冲突', () => {
      const invalidConfig: SPIConfig = {
        type: 'SPI',
        clockPin: 0,
        mosiPin: 0, // 与时钟引脚相同
        misoPin: 1,
        selectPin: 2,
        clockFrequency: 1000000,
        mode: 0,
        bitOrder: 'MSB'
      };

      const validation = helper.validateSPIConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('引脚'))).toBe(true);
    });

    it('应该检测无效的SPI模式', () => {
      const invalidConfig: SPIConfig = {
        type: 'SPI',
        clockPin: 0,
        mosiPin: 1,
        misoPin: 2,
        selectPin: 3,
        clockFrequency: 1000000,
        mode: 5, // 无效模式
        bitOrder: 'MSB'
      };

      const validation = helper.validateSPIConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('模式'))).toBe(true);
    });
  });

  describe('UART协议配置', () => {
    it('应该能够创建UART配置', () => {
      const uartConfig: UARTConfig = {
        type: 'UART',
        txPin: 0,
        rxPin: 1,
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      };

      const config = helper.createUARTConfig(uartConfig);
      
      expect(config.type).toBe('UART');
      expect(config.txPin).toBe(0);
      expect(config.rxPin).toBe(1);
      expect(config.baudRate).toBe(115200);
      expect(config.dataBits).toBe(8);
      expect(config.stopBits).toBe(1);
      expect(config.parity).toBe('none');
    });

    it('应该验证UART配置', () => {
      const validConfig: UARTConfig = {
        type: 'UART',
        txPin: 0,
        rxPin: 1,
        baudRate: 9600,
        dataBits: 8,
        stopBits: 2,
        parity: 'even'
      };

      const validation = helper.validateUARTConfig(validConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该检测无效的波特率', () => {
      const invalidConfig: UARTConfig = {
        type: 'UART',
        txPin: 0,
        rxPin: 1,
        baudRate: 0, // 无效波特率
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      };

      const validation = helper.validateUARTConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('波特率'))).toBe(true);
    });

    it('应该检测无效的数据位数', () => {
      const invalidConfig: UARTConfig = {
        type: 'UART',
        txPin: 0,
        rxPin: 1,
        baudRate: 115200,
        dataBits: 3, // 无效数据位数
        stopBits: 1,
        parity: 'none'
      };

      const validation = helper.validateUARTConfig(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('数据位'))).toBe(true);
    });
  });

  describe('通用协议验证', () => {
    it('应该验证通用协议配置', () => {
      const i2cConfig: ProtocolConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000,
        addressBits: 7
      };

      const validation = helper.validateProtocolConfig(i2cConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.protocol).toBe('I2C');
    });

    it('应该处理不支持的协议', () => {
      const unsupportedConfig: ProtocolConfig = {
        type: 'UNSUPPORTED_PROTOCOL',
        pin1: 0,
        pin2: 1
      };

      const validation = helper.validateProtocolConfig(unsupportedConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('不支持'))).toBe(true);
    });
  });

  describe('协议检测', () => {
    it('应该能够检测I2C协议特征', () => {
      // 模拟I2C数据特征
      const sampleData = new Uint8Array([
        0x00, 0xFF, 0x00, 0xFF, // 时钟信号
        0x01, 0x01, 0x00, 0x01  // 数据信号
      ]);

      const detection = helper.detectProtocol(sampleData, 2); // 2个通道
      
      expect(detection).toBeDefined();
      expect(detection.confidence).toBeGreaterThan(0);
    });

    it('应该能够检测SPI协议特征', () => {
      // 模拟SPI数据特征
      const sampleData = new Uint8Array([
        0x05, 0x0A, 0x05, 0x0A, // CLK + MOSI + MISO + CS
        0x05, 0x0A, 0x05, 0x0A
      ]);

      const detection = helper.detectProtocol(sampleData, 4); // 4个通道
      
      expect(detection).toBeDefined();
      expect(detection.confidence).toBeGreaterThan(0);
    });

    it('应该处理无法识别的数据', () => {
      // 随机数据
      const sampleData = new Uint8Array(100).fill(0);
      for (let i = 0; i < sampleData.length; i++) {
        sampleData[i] = Math.floor(Math.random() * 256);
      }

      const detection = helper.detectProtocol(sampleData, 8);
      
      expect(detection.detectedProtocols.length).toBeGreaterThanOrEqual(0);
      expect(detection.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('协议模板生成', () => {
    it('应该能够生成I2C解码器模板', () => {
      const template = helper.generateI2CDecoderTemplate({
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000
      });

      expect(template).toContain('I2C');
      expect(template).toContain('clockPin: 0');
      expect(template).toContain('dataPin: 1');
      expect(template).toContain('100000');
    });

    it('应该能够生成SPI解码器模板', () => {
      const template = helper.generateSPIDecoderTemplate({
        clockPin: 0,
        mosiPin: 1,
        misoPin: 2,
        selectPin: 3
      });

      expect(template).toContain('SPI');
      expect(template).toContain('clockPin: 0');
      expect(template).toContain('mosiPin: 1');
      expect(template).toContain('misoPin: 2');
      expect(template).toContain('selectPin: 3');
    });

    it('应该能够生成UART解码器模板', () => {
      const template = helper.generateUARTDecoderTemplate({
        txPin: 0,
        rxPin: 1,
        baudRate: 115200
      });

      expect(template).toContain('UART');
      expect(template).toContain('txPin: 0');
      expect(template).toContain('rxPin: 1');
      expect(template).toContain('115200');
    });
  });

  describe('协议配置建议', () => {
    it('应该提供基于硬件能力的配置建议', () => {
      const hardwareCapability = {
        channels: { digital: { count: 16 } },
        sampling: { maxSampleRate: 100000000 }
      };

      const suggestions = helper.getProtocolConfigSuggestions('I2C', hardwareCapability);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.recommendedChannels).toBeDefined();
      expect(suggestions.recommendedFrequencies).toBeDefined();
    });

    it('应该根据不同协议提供不同建议', () => {
      const hardwareCapability = {
        channels: { digital: { count: 8 } },
        sampling: { maxSampleRate: 50000000 }
      };

      const i2cSuggestions = helper.getProtocolConfigSuggestions('I2C', hardwareCapability);
      const spiSuggestions = helper.getProtocolConfigSuggestions('SPI', hardwareCapability);
      const uartSuggestions = helper.getProtocolConfigSuggestions('UART', hardwareCapability);

      expect(i2cSuggestions.minimumChannels).toBe(2);
      expect(spiSuggestions.minimumChannels).toBe(4);
      expect(uartSuggestions.minimumChannels).toBe(2);
    });
  });

  describe('协议转换工具', () => {
    it('应该能够将采样数据转换为协议数据', () => {
      const sampleData = new Uint8Array([0x55, 0xAA, 0x55, 0xAA]);
      const i2cConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000,
        addressBits: 7
      };

      const protocolData = helper.convertSampleDataToProtocol(sampleData, i2cConfig);
      
      expect(protocolData).toBeDefined();
      expect(protocolData.frames).toBeDefined();
      expect(protocolData.timing).toBeDefined();
    });

    it('应该处理不同的协议转换', () => {
      const sampleData = new Uint8Array([0x0F, 0xF0, 0x0F, 0xF0]);
      
      const spiConfig: SPIConfig = {
        type: 'SPI',
        clockPin: 0,
        mosiPin: 1,
        misoPin: 2,
        selectPin: 3,
        clockFrequency: 1000000,
        mode: 0,
        bitOrder: 'MSB'
      };

      const protocolData = helper.convertSampleDataToProtocol(sampleData, spiConfig);
      
      expect(protocolData).toBeDefined();
      expect(protocolData.frames).toBeDefined();
    });
  });

  describe('协议分析工具', () => {
    it('应该能够分析协议时序', () => {
      const sampleData = new Uint8Array([0x01, 0x02, 0x04, 0x08]);
      const sampleRate = 1000000;

      const timing = helper.analyzeProtocolTiming(sampleData, sampleRate);
      
      expect(timing).toBeDefined();
      expect(timing.clockPeriod).toBeDefined();
      expect(timing.setupTime).toBeDefined();
      expect(timing.holdTime).toBeDefined();
    });

    it('应该能够检测协议错误', () => {
      // 模拟有错误的协议数据
      const invalidSampleData = new Uint8Array([0xFF, 0x00, 0xFF, 0x00]);
      const i2cConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000,
        addressBits: 7
      };

      const errors = helper.detectProtocolErrors(invalidSampleData, i2cConfig);
      
      expect(errors).toBeDefined();
      expect(errors).toBeInstanceOf(Array);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空数据', () => {
      const emptyData = new Uint8Array(0);
      
      const detection = helper.detectProtocol(emptyData, 2);
      expect(detection.detectedProtocols).toHaveLength(0);
      expect(detection.confidence).toBe(0);
    });

    it('应该处理单通道数据', () => {
      const singleChannelData = new Uint8Array([0x55, 0xAA, 0x55, 0xAA]);
      
      const detection = helper.detectProtocol(singleChannelData, 1);
      expect(detection).toBeDefined();
    });

    it('应该处理极大数据量', () => {
      const largeData = new Uint8Array(100000).fill(0x55);
      
      const detection = helper.detectProtocol(largeData, 8);
      expect(detection).toBeDefined();
      expect(detection.confidence).toBeGreaterThanOrEqual(0);
    });

    it('应该处理极限引脚配置', () => {
      const extremeConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: Number.MAX_SAFE_INTEGER,
        clockFrequency: Number.MAX_SAFE_INTEGER,
        addressBits: 7
      };

      const validation = helper.validateI2CConfig(extremeConfig);
      // 应该处理而不崩溃
      expect(validation).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('协议检测应该在合理时间内完成', () => {
      const testData = new Uint8Array(10000);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
      }

      const startTime = Date.now();
      const detection = helper.detectProtocol(testData, 8);
      const endTime = Date.now();

      expect(detection).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('配置验证应该快速完成', () => {
      const config: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: 100000,
        addressBits: 7
      };

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        helper.validateI2CConfig(config);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 1000次验证应该在1秒内完成
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的协议类型', () => {
      expect(() => {
        helper.validateProtocolConfig({ type: null as any });
      }).not.toThrow();
    });

    it('应该处理缺失的必需参数', () => {
      const incompleteConfig = { type: 'I2C' } as I2CConfig;
      
      const validation = helper.validateI2CConfig(incompleteConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('应该处理负数频率', () => {
      const invalidConfig: I2CConfig = {
        type: 'I2C',
        clockPin: 0,
        dataPin: 1,
        clockFrequency: -1000,
        addressBits: 7
      };

      const validation = helper.validateI2CConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
    });
  });
});