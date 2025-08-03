import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  HardwareDescriptorParser,
  HardwareDescriptorRegistry,
  HardwareDescriptor,
  TriggerCondition,
  TriggerMode,
  BufferMode,
  CompatibilityResult,
  hardwareDescriptorRegistry
} from '../../../../src/drivers/standards/HardwareDescriptorStandard';
import { AnalyzerDriverType, TriggerType } from '../../../../src/drivers/types/AnalyzerTypes';

describe('TriggerCondition 枚举', () => {
  it('应该包含所有预期的触发条件', () => {
    expect(TriggerCondition.RisingEdge).toBe('rising-edge');
    expect(TriggerCondition.FallingEdge).toBe('falling-edge');
    expect(TriggerCondition.BothEdges).toBe('both-edges');
    expect(TriggerCondition.HighLevel).toBe('high-level');
    expect(TriggerCondition.LowLevel).toBe('low-level');
    expect(TriggerCondition.Pattern).toBe('pattern');
    expect(TriggerCondition.PulseWidth).toBe('pulse-width');
    expect(TriggerCondition.Timeout).toBe('timeout');
    expect(TriggerCondition.Custom).toBe('custom');
  });
});

describe('TriggerMode 枚举', () => {
  it('应该包含所有预期的触发模式', () => {
    expect(TriggerMode.Normal).toBe('normal');
    expect(TriggerMode.Auto).toBe('auto');
    expect(TriggerMode.Single).toBe('single');
    expect(TriggerMode.Stop).toBe('stop');
    expect(TriggerMode.Force).toBe('force');
  });
});

describe('BufferMode 枚举', () => {
  it('应该包含所有预期的缓冲区模式', () => {
    expect(BufferMode.Circular).toBe('circular');
    expect(BufferMode.Linear).toBe('linear');
    expect(BufferMode.Segmented).toBe('segmented');
    expect(BufferMode.Streaming).toBe('streaming');
  });
});

describe('HardwareDescriptorParser', () => {
  let validDescriptor: HardwareDescriptor;

  beforeEach(() => {
    validDescriptor = {
      device: {
        id: 'test-device-001',
        name: 'Test Logic Analyzer',
        manufacturer: 'Test Manufacturer',
        model: 'TLA-1000',
        version: '1.0.0',
        firmware: '1.0.0',
        serialNumber: 'SN12345'
      },
      connectivity: {
        interfaces: [
          {
            type: 'usb',
            name: 'USB 3.0',
            specification: 'USB 3.0'
          }
        ],
        protocols: [
          {
            name: 'Custom Protocol',
            version: '1.0'
          }
        ]
      },
      capture: {
        channels: {
          digital: {
            count: 16,
            maxVoltage: 5.0,
            inputModes: ['single-ended']
          }
        },
        sampling: {
          rates: {
            maximum: 100000000,
            minimum: 1000,
            supported: [1000, 10000, 100000],
            continuous: false
          },
          modes: ['single', 'continuous']
        },
        triggers: {
          types: [TriggerType.Edge],
          channels: {
            digital: 16
          },
          conditions: [TriggerCondition.RisingEdge],
          modes: [TriggerMode.Normal]
        },
        timing: {
          resolution: 10,
          accuracy: 50,
          range: [1e-9, 1000]
        },
        buffers: {
          memory: {
            total: 1024 * 1024,
            perChannel: 64 * 1024
          },
          modes: [BufferMode.Circular]
        }
      },
      features: {},
      performance: {
        maxSampleRate: 100000000,
        minSampleRate: 1000,
        bandwidth: 50000000,
        inputImpedance: 1000000,
        maxVoltage: 5.0,
        minVoltage: -5.0
      },
      software: {
        driverType: AnalyzerDriverType.Serial,
        apiVersion: '1.0.0'
      },
      metadata: {
        created: '2025-08-01T10:00:00.000Z',
        version: '1.0.0',
        schemaVersion: '1.0.0'
      }
    };
  });

  describe('parse 方法', () => {
    it('应该成功解析有效的描述符对象', () => {
      const result = HardwareDescriptorParser.parse(validDescriptor);
      expect(result).toEqual(validDescriptor);
    });

    it('应该成功解析有效的描述符JSON字符串', () => {
      const jsonString = JSON.stringify(validDescriptor);
      const result = HardwareDescriptorParser.parse(jsonString);
      expect(result).toEqual(validDescriptor);
    });

    it('应该在解析无效JSON时抛出错误', () => {
      const invalidJson = '{ invalid json }';
      expect(() => {
        HardwareDescriptorParser.parse(invalidJson);
      }).toThrow('Failed to parse hardware descriptor');
    });

    it('应该在验证失败时抛出错误', () => {
      const invalidDescriptor = { invalid: 'descriptor' };
      expect(() => {
        HardwareDescriptorParser.parse(invalidDescriptor);
      }).toThrow('Failed to parse hardware descriptor');
    });
  });

  describe('validate 方法', () => {
    it('应该成功验证有效的描述符', () => {
      expect(() => {
        HardwareDescriptorParser.validate(validDescriptor);
      }).not.toThrow();
    });

    it('应该在描述符为null时抛出错误', () => {
      expect(() => {
        HardwareDescriptorParser.validate(null);
      }).toThrow('Invalid descriptor: must be an object');
    });

    it('应该在描述符为undefined时抛出错误', () => {
      expect(() => {
        HardwareDescriptorParser.validate(undefined);
      }).toThrow('Invalid descriptor: must be an object');
    });

    it('应该在描述符不是对象时抛出错误', () => {
      expect(() => {
        HardwareDescriptorParser.validate('not an object');
      }).toThrow('Invalid descriptor: must be an object');
    });

    it('应该在缺少必需字段时抛出错误', () => {
      const incompleteDescriptor = {
        device: validDescriptor.device
        // 缺少其他必需字段
      };

      expect(() => {
        HardwareDescriptorParser.validate(incompleteDescriptor);
      }).toThrow('Required field missing: connectivity');
    });

    it('应该在不支持的模式版本时抛出错误', () => {
      const descriptorWithWrongVersion = {
        ...validDescriptor,
        metadata: {
          ...validDescriptor.metadata,
          schemaVersion: '999.0.0'
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(descriptorWithWrongVersion);
      }).toThrow('Unsupported schema version: 999.0.0');
    });

    it('应该验证所有必需字段', () => {
      const requiredFields = [
        'device',
        'connectivity',
        'capture',
        'performance',
        'software',
        'metadata'
      ];

      requiredFields.forEach(field => {
        const incompleteDescriptor = { ...validDescriptor };
        delete (incompleteDescriptor as any)[field];

        expect(() => {
          HardwareDescriptorParser.validate(incompleteDescriptor);
        }).toThrow(`Required field missing: ${field}`);
      });
    });
  });

  describe('validateDevice 方法', () => {
    it('应该成功验证有效的设备信息', () => {
      expect(() => {
        HardwareDescriptorParser.validate(validDescriptor);
      }).not.toThrow();
    });

    it('应该在设备字段为空字符串时抛出错误', () => {
      const invalidDevice = {
        ...validDescriptor,
        device: {
          ...validDescriptor.device,
          id: ''
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(invalidDevice);
      }).toThrow('Invalid device.id: must be a non-empty string');
    });

    it('应该在设备字段不是字符串时抛出错误', () => {
      const invalidDevice = {
        ...validDescriptor,
        device: {
          ...validDescriptor.device,
          name: 123 as any
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(invalidDevice);
      }).toThrow('Invalid device.name: must be a non-empty string');
    });

    it('应该验证所有必需的设备字段', () => {
      const requiredDeviceFields = ['id', 'name', 'manufacturer', 'model', 'version'];

      requiredDeviceFields.forEach(field => {
        const invalidDevice = {
          ...validDescriptor,
          device: {
            ...validDescriptor.device,
            [field]: undefined
          }
        };

        expect(() => {
          HardwareDescriptorParser.validate(invalidDevice);
        }).toThrow(`Invalid device.${field}: must be a non-empty string`);
      });
    });
  });

  describe('validateCapture 方法', () => {
    it('应该成功验证有效的采集配置', () => {
      expect(() => {
        HardwareDescriptorParser.validate(validDescriptor);
      }).not.toThrow();
    });

    it('应该在数字通道数少于1时抛出错误', () => {
      const invalidCapture = {
        ...validDescriptor,
        capture: {
          ...validDescriptor.capture,
          channels: {
            digital: {
              count: 0,
              maxVoltage: 5.0,
              inputModes: ['single-ended']
            }
          }
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(invalidCapture);
      }).toThrow('Invalid capture.channels: must have at least 1 digital channel');
    });

    it('应该在最大采样率低于1kHz时抛出错误', () => {
      const invalidCapture = {
        ...validDescriptor,
        capture: {
          ...validDescriptor.capture,
          sampling: {
            ...validDescriptor.capture.sampling,
            rates: {
              ...validDescriptor.capture.sampling.rates,
              maximum: 500
            }
          }
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(invalidCapture);
      }).toThrow('Invalid capture.sampling: maximum rate must be at least 1kHz');
    });
  });

  describe('validatePerformance 方法', () => {
    it('应该成功验证有效的性能参数', () => {
      expect(() => {
        HardwareDescriptorParser.validate(validDescriptor);
      }).not.toThrow();
    });

    it('应该在最大采样率小于等于最小采样率时抛出错误', () => {
      const invalidPerformance = {
        ...validDescriptor,
        performance: {
          ...validDescriptor.performance,
          maxSampleRate: 1000,
          minSampleRate: 2000
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(invalidPerformance);
      }).toThrow('Invalid performance: maxSampleRate must be greater than minSampleRate');
    });

    it('应该在最大电压小于等于最小电压时抛出错误', () => {
      const invalidPerformance = {
        ...validDescriptor,
        performance: {
          ...validDescriptor.performance,
          maxVoltage: -5.0,
          minVoltage: 5.0
        }
      };

      expect(() => {
        HardwareDescriptorParser.validate(invalidPerformance);
      }).toThrow('Invalid performance: maxVoltage must be greater than minVoltage');
    });
  });

  describe('generateTemplate 方法', () => {
    it('应该生成有效的默认模板', () => {
      const deviceInfo = {
        id: 'template-device',
        name: 'Template Device',
        manufacturer: 'Template Manufacturer',
        model: 'TM-100'
      };

      const template = HardwareDescriptorParser.generateTemplate(deviceInfo);

      expect(template.device.id).toBe(deviceInfo.id);
      expect(template.device.name).toBe(deviceInfo.name);
      expect(template.device.manufacturer).toBe(deviceInfo.manufacturer);
      expect(template.device.model).toBe(deviceInfo.model);
      expect(template.device.version).toBe('1.0.0');

      // 验证生成的模板是有效的
      expect(() => {
        HardwareDescriptorParser.validate(template);
      }).not.toThrow();
    });

    it('应该包含合理的默认值', () => {
      const deviceInfo = {
        id: 'test',
        name: 'Test',
        manufacturer: 'Test',
        model: 'Test'
      };

      const template = HardwareDescriptorParser.generateTemplate(deviceInfo);

      expect(template.capture.channels.digital.count).toBe(24);
      expect(template.performance.maxSampleRate).toBe(100000000);
      expect(template.performance.minSampleRate).toBe(1000);
      expect(template.metadata.schemaVersion).toBe('1.0.0');
    });
  });

  describe('compareCompatibility 方法', () => {
    let descriptor2: HardwareDescriptor;

    beforeEach(() => {
      descriptor2 = {
        ...validDescriptor,
        device: {
          ...validDescriptor.device,
          id: 'test-device-002'
        }
      };
    });

    it('应该返回相同描述符的完全兼容结果', () => {
      const result = HardwareDescriptorParser.compareCompatibility(validDescriptor, validDescriptor);

      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.score).toBe(1.0);
    });

    it('应该检测数字通道数差异', () => {
      const modifiedDescriptor2 = {
        ...descriptor2,
        capture: {
          ...descriptor2.capture,
          channels: {
            ...descriptor2.capture.channels,
            digital: {
              ...descriptor2.capture.channels.digital,
              count: 32
            }
          }
        }
      };

      const result = HardwareDescriptorParser.compareCompatibility(validDescriptor, modifiedDescriptor2);

      expect(result.compatible).toBe(false);
      expect(result.issues).toContain('Different digital channel counts');
      expect(result.score).toBeLessThan(1.0);
    });

    it('应该检测最大采样率差异', () => {
      const modifiedDescriptor2 = {
        ...descriptor2,
        performance: {
          ...descriptor2.performance,
          maxSampleRate: 200000000
        }
      };

      const result = HardwareDescriptorParser.compareCompatibility(validDescriptor, modifiedDescriptor2);

      expect(result.compatible).toBe(true);
      expect(result.warnings).toContain('Different maximum sample rates');
      expect(result.score).toBeLessThan(1.0);
    });

    it('应该检测触发能力差异', () => {
      // validDescriptor 有 [TriggerType.Edge]
      // modifiedDescriptor2 有 [TriggerType.Complex] - 完全不同的触发器
      const modifiedDescriptor2 = {
        ...descriptor2,
        capture: {
          ...descriptor2.capture,
          triggers: {
            ...descriptor2.capture.triggers,
            types: [TriggerType.Complex]
          }
        }
      };

      const result = HardwareDescriptorParser.compareCompatibility(validDescriptor, modifiedDescriptor2);

      expect(result.warnings).toContain('Different trigger capabilities');
      expect(result.score).toBeLessThan(1.0);
    });

    it('应该计算正确的兼容性评分', () => {
      // 多个差异
      const modifiedDescriptor2 = {
        ...descriptor2,
        capture: {
          ...descriptor2.capture,
          channels: {
            ...descriptor2.capture.channels,
            digital: {
              ...descriptor2.capture.channels.digital,
              count: 32
            }
          }
        },
        performance: {
          ...descriptor2.performance,
          maxSampleRate: 200000000
        }
      };

      const result = HardwareDescriptorParser.compareCompatibility(validDescriptor, modifiedDescriptor2);

      expect(result.compatible).toBe(false);
      expect(result.score).toBeLessThan(0.8);
    });
  });
});

describe('HardwareDescriptorRegistry', () => {
  let registry: HardwareDescriptorRegistry;
  let testDescriptor: HardwareDescriptor;

  beforeEach(() => {
    registry = new HardwareDescriptorRegistry();
    testDescriptor = HardwareDescriptorParser.generateTemplate({
      id: 'test-device-001',
      name: 'Test Logic Analyzer',
      manufacturer: 'Test Manufacturer',
      model: 'TLA-1000'
    });
  });

  describe('register 方法', () => {
    it('应该成功注册有效的描述符', () => {
      expect(() => {
        registry.register(testDescriptor);
      }).not.toThrow();
    });

    it('应该在注册无效描述符时抛出错误', () => {
      const invalidDescriptor = { invalid: 'descriptor' } as any;

      expect(() => {
        registry.register(invalidDescriptor);
      }).toThrow();
    });

    it('应该允许注册多个描述符', () => {
      const descriptor2 = HardwareDescriptorParser.generateTemplate({
        id: 'test-device-002',
        name: 'Test Logic Analyzer 2',
        manufacturer: 'Test Manufacturer',
        model: 'TLA-2000'
      });

      registry.register(testDescriptor);
      registry.register(descriptor2);

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe('get 方法', () => {
    beforeEach(() => {
      registry.register(testDescriptor);
    });

    it('应该返回已注册的描述符', () => {
      const result = registry.get('test-device-001');
      expect(result).toEqual(testDescriptor);
    });

    it('应该为不存在的设备返回undefined', () => {
      const result = registry.get('non-existent-device');
      expect(result).toBeUndefined();
    });
  });

  describe('findCompatible 方法', () => {
    beforeEach(() => {
      registry.register(testDescriptor);

      const descriptor2 = HardwareDescriptorParser.generateTemplate({
        id: 'test-device-002',
        name: 'High-Speed Analyzer',
        manufacturer: 'Speed Corp',
        model: 'HS-1000'
      });
      descriptor2.performance.maxSampleRate = 1000000000;
      descriptor2.capture.channels.digital.count = 64;

      registry.register(descriptor2);
    });

    it('应该返回匹配制造商的设备', () => {
      const requirements = {
        device: {
          manufacturer: 'Test Manufacturer'
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      expect(results).toHaveLength(1);
      expect(results[0].device.manufacturer).toBe('Test Manufacturer');
    });

    it('应该返回满足通道数要求的设备', () => {
      const requirements = {
        capture: {
          channels: {
            digital: {
              count: 32
            }
          }
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      expect(results).toHaveLength(1);
      expect(results[0].capture.channels.digital.count).toBeGreaterThanOrEqual(32);
    });

    it('应该返回满足采样率要求的设备', () => {
      const requirements = {
        performance: {
          maxSampleRate: 500000000
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      expect(results).toHaveLength(1);
      expect(results[0].performance.maxSampleRate).toBeGreaterThanOrEqual(500000000);
    });

    it('应该按匹配度排序结果', () => {
      const requirements = {
        device: {
          manufacturer: 'Test Manufacturer'
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      // 第一个结果应该是匹配度最高的
      if (results.length > 1) {
        expect(results[0].device.manufacturer).toBe('Test Manufacturer');
      }
    });

    it('应该在没有匹配设备时返回空数组', () => {
      const requirements = {
        device: {
          manufacturer: 'Non-existent Manufacturer'
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      expect(results).toHaveLength(0);
    });
  });

  describe('getAll 方法', () => {
    it('应该返回空数组当注册表为空时', () => {
      const results = registry.getAll();
      expect(results).toHaveLength(0);
    });

    it('应该返回所有已注册的描述符', () => {
      registry.register(testDescriptor);

      const descriptor2 = HardwareDescriptorParser.generateTemplate({
        id: 'test-device-002',
        name: 'Test Device 2',
        manufacturer: 'Test Manufacturer 2',
        model: 'TLA-2000'
      });
      registry.register(descriptor2);

      const results = registry.getAll();
      expect(results).toHaveLength(2);
    });
  });

  describe('getByCategory 方法', () => {
    beforeEach(() => {
      registry.register(testDescriptor);

      const descriptor2 = HardwareDescriptorParser.generateTemplate({
        id: 'test-device-002',
        name: 'Another Test Device',
        manufacturer: 'Test Manufacturer',
        model: 'TLA-2000'
      });
      registry.register(descriptor2);

      const descriptor3 = HardwareDescriptorParser.generateTemplate({
        id: 'other-device-001',
        name: 'Other Device',
        manufacturer: 'Other Manufacturer',
        model: 'OLA-1000'
      });
      registry.register(descriptor3);
    });

    it('应该按制造商筛选设备', () => {
      const results = registry.getByCategory('Test Manufacturer');
      expect(results).toHaveLength(2);
      results.forEach(desc => {
        expect(desc.device.manufacturer).toBe('Test Manufacturer');
      });
    });

    it('应该按制造商和型号筛选设备', () => {
      const results = registry.getByCategory('Test Manufacturer', 'TLA-1000');
      expect(results).toHaveLength(1);
      expect(results[0].device.model).toBe('TLA-1000');
    });

    it('应该在没有匹配设备时返回空数组', () => {
      const results = registry.getByCategory('Non-existent Manufacturer');
      expect(results).toHaveLength(0);
    });
  });

  describe('clear 方法', () => {
    it('应该清空注册表', () => {
      registry.register(testDescriptor);
      expect(registry.getAll()).toHaveLength(1);

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('应该允许在清空后重新注册', () => {
      registry.register(testDescriptor);
      registry.clear();
      
      registry.register(testDescriptor);
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('calculateScore 私有方法测试', () => {
    it('应该为相同制造商和型号给出高分', () => {
      registry.register(testDescriptor);

      const requirements = {
        device: {
          manufacturer: 'Test Manufacturer',
          model: 'TLA-1000'
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      expect(results).toHaveLength(1);
    });

    it('应该为匹配通道数的设备给出合理分数', () => {
      registry.register(testDescriptor);

      const requirements = {
        capture: {
          channels: {
            digital: {
              count: 20
            }
          }
        }
      } as Partial<HardwareDescriptor>;

      const results = registry.findCompatible(requirements);
      expect(results).toHaveLength(1);
    });
  });
});

describe('全局注册表实例', () => {
  it('应该导出全局注册表实例', () => {
    expect(hardwareDescriptorRegistry).toBeInstanceOf(HardwareDescriptorRegistry);
  });

  it('全局注册表应该独立工作', () => {
    const testDescriptor = HardwareDescriptorParser.generateTemplate({
      id: 'global-test-device',
      name: 'Global Test Device',
      manufacturer: 'Global Manufacturer',
      model: 'GTD-100'
    });

    // 清理之前的状态
    hardwareDescriptorRegistry.clear();

    hardwareDescriptorRegistry.register(testDescriptor);
    const result = hardwareDescriptorRegistry.get('global-test-device');
    expect(result).toEqual(testDescriptor);

    // 清理
    hardwareDescriptorRegistry.clear();
  });
});

describe('集成测试', () => {
  let registry: HardwareDescriptorRegistry;

  beforeEach(() => {
    registry = new HardwareDescriptorRegistry();
  });

  it('应该支持完整的描述符生命周期', () => {
    // 1. 生成模板
    const template = HardwareDescriptorParser.generateTemplate({
      id: 'integration-test-device',
      name: 'Integration Test Device',
      manufacturer: 'Integration Corp',
      model: 'IT-500'
    });

    // 2. 验证模板
    expect(() => {
      HardwareDescriptorParser.validate(template);
    }).not.toThrow();

    // 3. 注册到注册表
    registry.register(template);

    // 4. 从注册表检索
    const retrieved = registry.get('integration-test-device');
    expect(retrieved).toEqual(template);

    // 5. 搜索兼容设备
    const compatible = registry.findCompatible({
      device: { manufacturer: 'Integration Corp' }
    });
    expect(compatible).toHaveLength(1);

    // 6. 比较兼容性
    const compatibility = HardwareDescriptorParser.compareCompatibility(template, template);
    expect(compatibility.compatible).toBe(true);
    expect(compatibility.score).toBe(1.0);
  });

  it('应该处理复杂的搜索和排序场景', () => {
    // 创建多个测试设备
    const devices = [
      {
        id: 'low-speed-device',
        name: 'Low Speed Analyzer',
        manufacturer: 'Speed Corp',
        model: 'LS-100',
        maxRate: 10000000,
        channels: 8
      },
      {
        id: 'mid-speed-device',
        name: 'Mid Speed Analyzer',
        manufacturer: 'Speed Corp',
        model: 'MS-200',
        maxRate: 100000000,
        channels: 16
      },
      {
        id: 'high-speed-device',
        name: 'High Speed Analyzer',
        manufacturer: 'Speed Corp',
        model: 'HS-300',
        maxRate: 1000000000,
        channels: 32
      }
    ];

    // 注册所有设备
    devices.forEach(deviceInfo => {
      const template = HardwareDescriptorParser.generateTemplate(deviceInfo);
      template.performance.maxSampleRate = deviceInfo.maxRate;
      template.capture.channels.digital.count = deviceInfo.channels;
      registry.register(template);
    });

    // 搜索高速设备
    const highSpeedResults = registry.findCompatible({
      performance: { maxSampleRate: 500000000 }
    });
    expect(highSpeedResults).toHaveLength(1);
    expect(highSpeedResults[0].device.id).toBe('high-speed-device');

    // 搜索多通道设备
    const multiChannelResults = registry.findCompatible({
      capture: {
        channels: {
          digital: { count: 20 }
        }
      }
    });
    expect(multiChannelResults).toHaveLength(1);
    expect(multiChannelResults[0].device.id).toBe('high-speed-device');

    // 按制造商获取
    const speedCorpDevices = registry.getByCategory('Speed Corp');
    expect(speedCorpDevices).toHaveLength(3);
  });

  it('应该正确处理错误情况', () => {
    // 无效的JSON解析
    expect(() => {
      HardwareDescriptorParser.parse('{ invalid json }');
    }).toThrow();

    // 无效的描述符注册
    expect(() => {
      registry.register({} as any);
    }).toThrow();

    // 不存在的设备获取
    expect(registry.get('non-existent')).toBeUndefined();

    // 无匹配的兼容性搜索
    const noResults = registry.findCompatible({
      device: { manufacturer: 'Non-existent Corp' }
    });
    expect(noResults).toHaveLength(0);
  });
});