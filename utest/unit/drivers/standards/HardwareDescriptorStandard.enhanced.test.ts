import {
  HardwareDescriptor,
  HardwareDescriptorParser,
  HardwareDescriptorRegistry,
  ConnectionInterface,
  ProtocolSupport,
  TriggerCondition,
  TriggerMode,
  BufferMode,
  globalRegistry
} from '../../../../src/drivers/standards/HardwareDescriptorStandard';
import { AnalyzerDriverType } from '../../../../src/drivers/types/AnalyzerTypes';

describe('HardwareDescriptorStandard - Enhanced Coverage Tests', () => {
  let registry: HardwareDescriptorRegistry;
  let validDescriptor: HardwareDescriptor;

  beforeEach(() => {
    registry = new HardwareDescriptorRegistry();
    
    validDescriptor = {
      device: {
        id: 'test-device-001',
        name: 'Test Logic Analyzer',
        manufacturer: 'Test Corp',
        model: 'TLA-100',
        version: '1.0.0',
        firmware: '2.1.0',
        serialNumber: 'SN123456789'
      },
      connectivity: {
        interfaces: [
          {
            type: 'usb',
            name: 'USB 3.0',
            specification: 'USB 3.0',
            connectorType: 'USB-C',
            parameters: { maxPower: 900 }
          }
        ],
        protocols: [
          {
            name: 'custom-protocol',
            version: '1.0',
            description: 'Custom communication protocol',
            parameters: { timeout: 5000 }
          }
        ],
        networkConfig: {
          supportsDHCP: true,
          supportsStaticIP: true,
          defaultPort: 8080,
          protocols: ['TCP', 'UDP']
        }
      },
      capture: {
        channels: {
          digital: 16,
          analog: 0,
          maxVoltage: 5.0,
          minVoltage: -5.0,
          inputImpedance: 1000000,
          thresholds: {
            ttl: { high: 2.0, low: 0.8 },
            cmos: { high: 3.5, low: 1.5 }
          },
          channelGroups: [
            { name: 'Group A', channels: [0, 1, 2, 3] },
            { name: 'Group B', channels: [4, 5, 6, 7] }
          ]
        },
        sampling: {
          maxRate: 500000000,
          minRate: 1,
          supportedRates: [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 500000000],
          bufferSize: 16777216,
          streamingSupport: true,
          compressionSupport: ['rle', 'lz4']
        },
        triggers: {
          types: [TriggerType.Edge, TriggerType.Pattern, TriggerType.Advanced],
          conditions: [TriggerCondition.Rising, TriggerCondition.Falling, TriggerCondition.High, TriggerCondition.Low],
          maxChannels: 16,
          patternWidth: 16,
          sequentialSupport: true,
          advancedFeatures: {
            delaySupport: true,
            counterSupport: true,
            conditionalSupport: true
          }
        },
        timing: {
          precision: 2e-9, // 2ns
          jitter: 1e-10, // 100ps
          clockStability: 1e-6,
          referenceFrequency: 100000000
        },
        buffers: {
          modes: [BufferMode.Circular, BufferMode.OneShot],
          maxSize: 16777216,
          segmentSupport: true,
          compression: ['none', 'rle', 'lz4']
        }
      },
      features: {
        signalGeneration: true,
        powerSupply: {
          voltages: [3.3, 5.0],
          maxCurrent: 1.0,
          currentLimiting: true,
          overcurrentProtection: true
        },
        voltageMonitoring: {
          channels: ['VCC', 'VDD', 'VBAT'],
          precision: 0.01,
          range: { min: 0, max: 10 }
        },
        calibration: {
          autoCalibration: true,
          userCalibration: true,
          calibrationFrequency: 'monthly'
        },
        streaming: {
          maxBandwidth: 1000000000, // 1Gbps
          protocols: ['TCP', 'UDP'],
          compression: true,
          encryption: false
        },
        compression: {
          algorithms: ['rle', 'lz4', 'zstd'],
          realtime: true,
          ratios: { rle: 4.0, lz4: 2.5, zstd: 6.0 }
        }
      },
      performance: {
        maxSampleRate: 500000000,
        minSampleRate: 1,
        bandwidth: 200000000,
        rise_time: 2,
        inputImpedance: 1000000,
        maxVoltage: 5.0,
        minVoltage: -5.0,
        resolution: 1
      },
      software: {
        driverType: AnalyzerDriverType.Network,
        apiVersion: '1.0.0',
        sdkSupport: ['C++', 'Python', 'TypeScript'],
        customDecoders: true,
        scriptingSupport: {
          languages: ['Python', 'JavaScript'],
          apis: ['REST', 'Socket'],
          documentation: 'https://docs.example.com/api'
        }
      },
      metadata: {
        created: '2023-01-01T00:00:00Z',
        modified: '2023-12-31T23:59:59Z',
        version: '1.0.0',
        schemaVersion: '2.0.0',
        tags: ['high-speed', 'multi-protocol', 'research'],
        compatibility: {
          minDriverVersion: '1.0.0',
          maxDriverVersion: '2.0.0',
          osSupport: ['Windows', 'macOS', 'Linux'],
          architectures: ['x64', 'arm64']
        }
      }
    };
  });

  describe('HardwareDescriptorParser - 高级验证', () => {
    describe('深度对象验证', () => {
      it('应该验证嵌套的connectivity配置', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.connectivity.interfaces = [];

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('连接接口列表不能为空');
      });

      it('应该验证网络配置的完整性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.connectivity.networkConfig = {
          supportsDHCP: false,
          supportsStaticIP: false,
          defaultPort: -1,
          protocols: []
        };

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('无效的网络配置');
      });

      it('应该验证通道配置的逻辑性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.capture.channels.digital = 0;
        invalidDescriptor.capture.channels.analog = 0;

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('数字通道和模拟通道不能同时为0');
      });

      it('应该验证电压范围的合理性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.capture.channels.maxVoltage = 1.0;
        invalidDescriptor.capture.channels.minVoltage = 5.0; // 最小值大于最大值

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('最小电压不能大于最大电压');
      });

      it('应该验证采样率配置的一致性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.capture.sampling.maxRate = 1000;
        invalidDescriptor.performance.maxSampleRate = 2000; // 不一致

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('采样率配置不一致');
      });

      it('应该验证触发器配置的完整性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.capture.triggers.maxChannels = 100;
        invalidDescriptor.capture.channels.digital = 8; // 触发器通道数超过实际通道数

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('触发器最大通道数不能超过实际通道数');
      });
    });

    describe('边界条件和异常值测试', () => {
      it('应该处理极大的缓冲区大小', () => {
        const descriptor = { ...validDescriptor };
        descriptor.capture.buffers.maxSize = Number.MAX_SAFE_INTEGER;

        expect(() => {
          HardwareDescriptorParser.validate(descriptor);
        }).not.toThrow();
      });

      it('应该处理极小的采样率', () => {
        const descriptor = { ...validDescriptor };
        descriptor.capture.sampling.minRate = 0.001;
        descriptor.performance.minSampleRate = 0.001;

        expect(() => {
          HardwareDescriptorParser.validate(descriptor);
        }).not.toThrow();
      });

      it('应该验证时间精度的合理性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.capture.timing!.precision = -1; // 负值

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('时间精度必须为正数');
      });

      it('应该验证功率参数的合理性', () => {
        const invalidDescriptor = { ...validDescriptor };
        invalidDescriptor.features.powerSupply!.maxCurrent = -0.5; // 负值

        expect(() => {
          HardwareDescriptorParser.validate(invalidDescriptor);
        }).toThrow('最大电流必须为正数');
      });
    });

    describe('复杂JSON解析', () => {
      it('应该正确解析包含所有可选字段的完整描述符', () => {
        const jsonString = JSON.stringify(validDescriptor, null, 2);
        const parsed = HardwareDescriptorParser.parse(jsonString);

        expect(parsed).toEqual(validDescriptor);
        expect(parsed.features.signalGeneration).toBe(true);
        expect(parsed.features.powerSupply?.voltages).toContain(3.3);
        expect(parsed.software.scriptingSupport?.languages).toContain('Python');
      });

      it('应该处理包含Unicode字符的描述符', () => {
        const unicodeDescriptor = { ...validDescriptor };
        unicodeDescriptor.device.name = '测试逻辑分析仪 🔬';
        unicodeDescriptor.device.manufacturer = 'テスト株式会社';

        const jsonString = JSON.stringify(unicodeDescriptor);
        const parsed = HardwareDescriptorParser.parse(jsonString);

        expect(parsed.device.name).toBe('测试逻辑分析仪 🔬');
        expect(parsed.device.manufacturer).toBe('テスト株式会社');
      });

      it('应该处理深度嵌套的参数对象', () => {
        const complexDescriptor = { ...validDescriptor };
        complexDescriptor.connectivity.interfaces[0].parameters = {
          advanced: {
            timeouts: {
              connection: 5000,
              read: 1000,
              write: 1000
            },
            buffers: {
              input: 8192,
              output: 8192
            }
          }
        };

        const jsonString = JSON.stringify(complexDescriptor);
        const parsed = HardwareDescriptorParser.parse(jsonString);

        expect(parsed.connectivity.interfaces[0].parameters.advanced.timeouts.connection).toBe(5000);
      });
    });
  });

  describe('HardwareDescriptorRegistry - 高级功能', () => {
    beforeEach(() => {
      // 注册多个测试设备
      const devices = [
        {
          ...validDescriptor,
          device: { ...validDescriptor.device, id: 'high-speed-1', manufacturer: 'SpeedCorp', model: 'HS-1000' },
          performance: { ...validDescriptor.performance, maxSampleRate: 1000000000 }
        },
        {
          ...validDescriptor,
          device: { ...validDescriptor.device, id: 'mid-range-1', manufacturer: 'SpeedCorp', model: 'MR-500' },
          performance: { ...validDescriptor.performance, maxSampleRate: 500000000 }
        },
        {
          ...validDescriptor,
          device: { ...validDescriptor.device, id: 'budget-1', manufacturer: 'ValueCorp', model: 'BG-100' },
          performance: { ...validDescriptor.performance, maxSampleRate: 100000000 }
        }
      ];

      devices.forEach(device => registry.register(device));
    });

    describe('高级搜索和过滤', () => {
      it('应该支持按性能参数搜索', () => {
        const highSpeedDevices = registry.findCompatible({
          minSampleRate: 800000000
        });

        expect(highSpeedDevices).toHaveLength(1);
        expect(highSpeedDevices[0].device.model).toBe('HS-1000');
      });

      it('应该支持按制造商分组', () => {
        const speedCorpDevices = registry.getByCategory({ manufacturer: 'SpeedCorp' });
        const valueCorpDevices = registry.getByCategory({ manufacturer: 'ValueCorp' });

        expect(speedCorpDevices).toHaveLength(2);
        expect(valueCorpDevices).toHaveLength(1);
      });

      it('应该支持复合条件搜索', () => {
        const results = registry.findCompatible({
          manufacturer: 'SpeedCorp',
          minChannels: 16,
          minSampleRate: 400000000,
          maxPrice: 10000 // 假设价格信息
        });

        expect(results).toHaveLength(2); // HS-1000 和 MR-500
      });

      it('应该按匹配度排序搜索结果', () => {
        const results = registry.findCompatible({
          minSampleRate: 200000000,
          preferredManufacturer: 'SpeedCorp'
        });

        expect(results).toHaveLength(3);
        // SpeedCorp的设备应该排在前面
        expect(results[0].device.manufacturer).toBe('SpeedCorp');
        expect(results[1].device.manufacturer).toBe('SpeedCorp');
      });
    });

    describe('兼容性评估', () => {
      it('应该计算详细的兼容性分数', () => {
        const device1 = registry.get('high-speed-1')!;
        const device2 = registry.get('mid-range-1')!;

        const compatibility = HardwareDescriptorParser.compareCompatibility(device1, device2);

        expect(compatibility.overallScore).toBeGreaterThan(0);
        expect(compatibility.overallScore).toBeLessThanOrEqual(100);
        expect(compatibility.details).toBeDefined();
        expect(compatibility.details.performanceMatch).toBeDefined();
        expect(compatibility.details.featureMatch).toBeDefined();
      });

      it('应该识别关键不兼容性', () => {
        const usbDevice = { ...validDescriptor };
        const ethernetDevice = {
          ...validDescriptor,
          device: { ...validDescriptor.device, id: 'ethernet-device' },
          connectivity: {
            interfaces: [{ type: 'ethernet' as const, name: 'Ethernet' }],
            protocols: [{ name: 'TCP/IP' }]
          }
        };

        registry.register(ethernetDevice);

        const compatibility = HardwareDescriptorParser.compareCompatibility(usbDevice, ethernetDevice);

        expect(compatibility.overallScore).toBeLessThan(80); // 连接方式不同，分数较低
        expect(compatibility.issues).toContain('连接接口不兼容');
      });
    });

    describe('批量操作', () => {
      it('应该支持批量注册', () => {
        const newRegistry = new HardwareDescriptorRegistry();
        const devices = Array.from({ length: 100 }, (_, i) => ({
          ...validDescriptor,
          device: { ...validDescriptor.device, id: `batch-device-${i}` }
        }));

        devices.forEach(device => newRegistry.register(device));

        expect(newRegistry.getAll()).toHaveLength(100);
      });

      it('应该支持条件批量删除', () => {
        // 添加一些低端设备
        const lowEndDevices = Array.from({ length: 5 }, (_, i) => ({
          ...validDescriptor,
          device: { ...validDescriptor.device, id: `low-end-${i}`, manufacturer: 'BudgetCorp' },
          performance: { ...validDescriptor.performance, maxSampleRate: 10000000 }
        }));

        lowEndDevices.forEach(device => registry.register(device));

        // 删除所有BudgetCorp设备
        const removed = registry.removeByCondition(device => device.device.manufacturer === 'BudgetCorp');

        expect(removed).toBe(5);
        expect(registry.getByCategory({ manufacturer: 'BudgetCorp' })).toHaveLength(0);
      });

      it('应该支持批量更新', () => {
        const updateFunction = (device: HardwareDescriptor): HardwareDescriptor => ({
          ...device,
          metadata: {
            ...device.metadata,
            modified: new Date().toISOString(),
            version: '1.1.0'
          }
        });

        const updated = registry.batchUpdate(
          device => device.device.manufacturer === 'SpeedCorp',
          updateFunction
        );

        expect(updated).toBe(2);
        
        const speedCorpDevices = registry.getByCategory({ manufacturer: 'SpeedCorp' });
        speedCorpDevices.forEach(device => {
          expect(device.metadata.version).toBe('1.1.0');
        });
      });
    });

    describe('性能优化', () => {
      it('应该缓存搜索结果', () => {
        const startTime = Date.now();
        
        // 第一次搜索
        registry.findCompatible({ minSampleRate: 100000000 });
        const firstSearchTime = Date.now() - startTime;
        
        const secondStartTime = Date.now();
        
        // 第二次相同搜索（应该使用缓存）
        registry.findCompatible({ minSampleRate: 100000000 });
        const secondSearchTime = Date.now() - secondStartTime;
        
        expect(secondSearchTime).toBeLessThan(firstSearchTime / 2);
      });

      it('应该在大数据集上保持性能', () => {
        const largeRegistry = new HardwareDescriptorRegistry();
        
        // 注册1000个设备
        const devices = Array.from({ length: 1000 }, (_, i) => ({
          ...validDescriptor,
          device: { ...validDescriptor.device, id: `perf-test-${i}` },
          performance: { 
            ...validDescriptor.performance, 
            maxSampleRate: Math.floor(Math.random() * 1000000000) + 1000000 
          }
        }));

        const registrationStart = Date.now();
        devices.forEach(device => largeRegistry.register(device));
        const registrationTime = Date.now() - registrationStart;

        const searchStart = Date.now();
        const results = largeRegistry.findCompatible({ minSampleRate: 500000000 });
        const searchTime = Date.now() - searchStart;

        expect(registrationTime).toBeLessThan(1000); // 1秒内完成注册
        expect(searchTime).toBeLessThan(100); // 100毫秒内完成搜索
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  describe('全局注册表功能', () => {
    it('应该提供全局单例注册表', () => {
      expect(globalRegistry).toBeInstanceOf(HardwareDescriptorRegistry);
      
      const anotherReference = globalRegistry;
      expect(anotherReference).toBe(globalRegistry);
    });

    it('应该在全局注册表中持久化数据', () => {
      globalRegistry.clear();
      globalRegistry.register(validDescriptor);

      expect(globalRegistry.get(validDescriptor.device.id)).toEqual(validDescriptor);
      
      const allDevices = globalRegistry.getAll();
      expect(allDevices).toHaveLength(1);
    });
  });

  describe('错误恢复和容错', () => {
    it('应该从部分损坏的描述符中恢复', () => {
      const partiallyValid = {
        device: validDescriptor.device,
        connectivity: validDescriptor.connectivity,
        capture: {
          channels: validDescriptor.capture.channels,
          // 缺少其他必需字段
        },
        // 缺少其他顶级字段
      };

      expect(() => {
        HardwareDescriptorParser.validate(partiallyValid as any);
      }).toThrow();

      // 但是可以尝试自动修复
      const repaired = HardwareDescriptorParser.repair(partiallyValid as any);
      expect(() => {
        HardwareDescriptorParser.validate(repaired);
      }).not.toThrow();
    });

    it('应该处理循环引用', () => {
      const circularDescriptor: any = { ...validDescriptor };
      circularDescriptor.self = circularDescriptor;

      expect(() => {
        JSON.stringify(circularDescriptor);
      }).toThrow();

      // 注册表应该能处理这种情况
      expect(() => {
        registry.register(circularDescriptor);
      }).toThrow('包含循环引用的对象');
    });

    it('应该处理内存不足的情况', () => {
      const hugeDescriptor = {
        ...validDescriptor,
        largeData: new Array(1000000).fill('x').join('')
      };

      // 模拟内存限制
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        registry.register(hugeDescriptor as any);
      }).toThrow('描述符过大');

      console.error = originalError;
    });
  });

  describe('模板生成和标准化', () => {
    it('应该生成符合当前最佳实践的模板', () => {
      const template = HardwareDescriptorParser.generateTemplate({
        deviceType: 'logic_analyzer',
        manufacturer: 'Generic Corp',
        channelCount: 8
      });

      expect(template.device.manufacturer).toBe('Generic Corp');
      expect(template.capture.channels.digital).toBe(8);
      expect(template.metadata.schemaVersion).toBe('2.0.0');
      
      // 验证生成的模板
      expect(() => {
        HardwareDescriptorParser.validate(template);
      }).not.toThrow();
    });

    it('应该支持从现有设备创建变体', () => {
      const variant = HardwareDescriptorParser.createVariant(validDescriptor, {
        device: { model: 'TLA-200' },
        capture: { channels: { digital: 32 } },
        performance: { maxSampleRate: 1000000000 }
      });

      expect(variant.device.model).toBe('TLA-200');
      expect(variant.capture.channels.digital).toBe(32);
      expect(variant.performance.maxSampleRate).toBe(1000000000);
      
      // 其他字段应该保持不变
      expect(variant.device.manufacturer).toBe(validDescriptor.device.manufacturer);
    });
  });

  describe('导入导出功能', () => {
    it('应该支持导出为不同格式', () => {
      registry.register(validDescriptor);

      const jsonExport = registry.exportToJSON();
      const yamlExport = registry.exportToYAML();
      const xmlExport = registry.exportToXML();

      expect(typeof jsonExport).toBe('string');
      expect(typeof yamlExport).toBe('string');
      expect(typeof xmlExport).toBe('string');

      expect(JSON.parse(jsonExport)).toHaveLength(1);
    });

    it('应该支持从不同格式导入', () => {
      const newRegistry = new HardwareDescriptorRegistry();
      const jsonData = JSON.stringify([validDescriptor]);

      const imported = newRegistry.importFromJSON(jsonData);

      expect(imported).toBe(1);
      expect(newRegistry.getAll()).toHaveLength(1);
      expect(newRegistry.get(validDescriptor.device.id)).toEqual(validDescriptor);
    });

    it('应该处理导入时的版本兼容性', () => {
      const oldVersionDescriptor = {
        ...validDescriptor,
        metadata: { ...validDescriptor.metadata, schemaVersion: '1.0.0' }
      };

      const newRegistry = new HardwareDescriptorRegistry();
      const imported = newRegistry.importFromJSON(JSON.stringify([oldVersionDescriptor]));

      expect(imported).toBe(1);
      // 应该自动升级到当前版本
      const upgraded = newRegistry.get(oldVersionDescriptor.device.id)!;
      expect(upgraded.metadata.schemaVersion).toBe('2.0.0');
    });
  });
});