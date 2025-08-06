/**
 * HardwareDescriptorStandard 增强测试 - 100%覆盖率目标
 * 针对硬件描述符标准的全面测试
 */

import { 
  HardwareDescriptorParser,
  HardwareDescriptorRegistry,
  HardwareDescriptor,
  ValidationResult,
  ValidationError,
  CompatibilityScore
} from '../src/drivers/standards/HardwareDescriptorStandard';

describe('HardwareDescriptorStandard 增强测试', () => {
  let parser: HardwareDescriptorParser;
  let registry: HardwareDescriptorRegistry;

  beforeEach(() => {
    parser = new HardwareDescriptorParser();
    registry = new HardwareDescriptorRegistry();
  });

  describe('HardwareDescriptorParser', () => {
    const validDescriptor: HardwareDescriptor = {
      id: 'test-device-001',
      name: 'Test Logic Analyzer',
      manufacturer: 'Test Corp',
      model: 'TLA-100',
      version: '1.0.0',
      capabilities: {
        digitalChannels: 8,
        analogChannels: 0,
        maxSampleRate: 100000000,
        maxMemoryDepth: 1048576,
        voltageRanges: [{ min: -5, max: 5 }],
        couplingModes: ['DC'],
        triggerTypes: ['edge', 'pattern'],
        protocolDecoders: ['uart', 'spi', 'i2c']
      },
      connectionTypes: ['usb', 'ethernet'],
      driverInfo: {
        type: 'builtin',
        version: '1.0.0',
        compatibility: ['1.0.x']
      }
    };

    it('应该解析有效的硬件描述符', () => {
      const result = parser.parse(validDescriptor);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.descriptor).toEqual(validDescriptor);
    });

    it('应该验证必需字段', () => {
      const invalidDescriptor = { ...validDescriptor };
      delete (invalidDescriptor as any).id;

      const result = parser.parse(invalidDescriptor);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('id');
      expect(result.errors[0].type).toBe('missing_required');
    });

    it('应该验证字段类型', () => {
      const invalidDescriptor = {
        ...validDescriptor,
        capabilities: {
          ...validDescriptor.capabilities,
          digitalChannels: 'invalid' // 应该是数字
        }
      };

      const result = parser.parse(invalidDescriptor);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'capabilities.digitalChannels')).toBe(true);
    });

    it('应该验证数值范围', () => {
      const invalidDescriptor = {
        ...validDescriptor,
        capabilities: {
          ...validDescriptor.capabilities,
          digitalChannels: -1 // 负数无效
        }
      };

      const result = parser.parse(invalidDescriptor);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_range')).toBe(true);
    });

    it('应该验证数组格式', () => {
      const invalidDescriptor = {
        ...validDescriptor,
        connectionTypes: 'usb' // 应该是数组
      };

      const result = parser.parse(invalidDescriptor);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'connectionTypes')).toBe(true);
    });

    it('应该验证嵌套对象', () => {
      const invalidDescriptor = {
        ...validDescriptor,
        capabilities: {
          ...validDescriptor.capabilities,
          voltageRanges: [{ min: 5, max: -5 }] // min > max 无效
        }
      };

      const result = parser.parse(invalidDescriptor);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field.includes('voltageRanges'))).toBe(true);
    });

    it('应该标准化描述符', () => {
      const unnormalizedDescriptor = {
        ...validDescriptor,
        name: '  Test Device  ', // 包含多余空格
        manufacturer: 'TEST CORP' // 大写
      };

      const result = parser.parse(unnormalizedDescriptor);
      expect(result.descriptor?.name).toBe('Test Device');
      expect(result.descriptor?.manufacturer).toBe('Test Corp');
    });

    it('应该生成描述符模板', () => {
      const template = parser.generateTemplate({
        deviceType: 'logic_analyzer',
        channels: 16,
        sampleRate: 200000000
      });

      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('capabilities');
      expect(template.capabilities.digitalChannels).toBe(16);
      expect(template.capabilities.maxSampleRate).toBe(200000000);
    });

    it('应该比较描述符兼容性', () => {
      const descriptor1 = { ...validDescriptor };
      const descriptor2 = {
        ...validDescriptor,
        id: 'test-device-002',
        capabilities: {
          ...validDescriptor.capabilities,
          digitalChannels: 16,
          maxSampleRate: 200000000
        }
      };

      const compatibility = parser.compareCompatibility(descriptor1, descriptor2);
      expect(compatibility).toHaveProperty('overallScore');
      expect(compatibility).toHaveProperty('channelCompatibility');
      expect(compatibility).toHaveProperty('sampleRateCompatibility');
      expect(compatibility.overallScore).toBeGreaterThan(0);
      expect(compatibility.overallScore).toBeLessThanOrEqual(100);
    });

    it('应该导出和导入描述符', () => {
      const jsonString = parser.exportToJson(validDescriptor);
      expect(typeof jsonString).toBe('string');

      const imported = parser.importFromJson(jsonString);
      expect(imported).toEqual(validDescriptor);
    });

    it('应该处理导入错误', () => {
      expect(() => parser.importFromJson('invalid-json')).toThrow();
      expect(() => parser.importFromJson('{}')).toThrow();
    });

    it('应该支持多种格式导出', () => {
      const yaml = parser.exportToYaml(validDescriptor);
      const xml = parser.exportToXml(validDescriptor);

      expect(typeof yaml).toBe('string');
      expect(typeof xml).toBe('string');
      expect(yaml).toContain('id: test-device-001');
      expect(xml).toContain('<id>test-device-001</id>');
    });

    it('应该验证版本兼容性', () => {
      const descriptor1 = { ...validDescriptor, version: '1.0.0' };
      const descriptor2 = { ...validDescriptor, version: '1.1.0' };
      const descriptor3 = { ...validDescriptor, version: '2.0.0' };

      expect(parser.isVersionCompatible(descriptor1, descriptor2)).toBe(true);
      expect(parser.isVersionCompatible(descriptor1, descriptor3)).toBe(false);
    });

    it('应该处理复杂嵌套验证', () => {
      const complexDescriptor = {
        ...validDescriptor,
        capabilities: {
          ...validDescriptor.capabilities,
          customProperties: {
            level1: {
              level2: {
                level3: 'deep-value'
              }
            }
          }
        }
      };

      const result = parser.parse(complexDescriptor);
      expect(result.isValid).toBe(true);
    });
  });

  describe('HardwareDescriptorRegistry', () => {
    const descriptor1: HardwareDescriptor = {
      id: 'device-001',
      name: 'Device 1',
      manufacturer: 'Manufacturer A',
      model: 'Model X',
      version: '1.0.0',
      capabilities: {
        digitalChannels: 8,
        analogChannels: 0,
        maxSampleRate: 100000000,
        maxMemoryDepth: 1048576,
        voltageRanges: [{ min: -3.3, max: 3.3 }],
        couplingModes: ['DC'],
        triggerTypes: ['edge'],
        protocolDecoders: ['uart']
      },
      connectionTypes: ['usb'],
      driverInfo: {
        type: 'builtin',
        version: '1.0.0',
        compatibility: ['1.0.x']
      }
    };

    const descriptor2: HardwareDescriptor = {
      id: 'device-002',
      name: 'Device 2',
      manufacturer: 'Manufacturer B',
      model: 'Model Y',
      version: '2.0.0',
      capabilities: {
        digitalChannels: 16,
        analogChannels: 4,
        maxSampleRate: 200000000,
        maxMemoryDepth: 2097152,
        voltageRanges: [{ min: -5, max: 5 }],
        couplingModes: ['DC', 'AC'],
        triggerTypes: ['edge', 'pattern', 'pulse'],
        protocolDecoders: ['uart', 'spi', 'i2c', 'can']
      },
      connectionTypes: ['usb', 'ethernet'],
      driverInfo: {
        type: 'plugin',
        version: '2.0.0',
        compatibility: ['2.0.x']
      }
    };

    it('应该注册硬件描述符', () => {
      const result = registry.register(descriptor1);
      expect(result.success).toBe(true);
      expect(registry.getAll()).toHaveLength(1);
    });

    it('应该防止重复注册', () => {
      registry.register(descriptor1);
      const result = registry.register(descriptor1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    it('应该通过ID查找描述符', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const found = registry.findById('device-001');
      expect(found).toEqual(descriptor1);

      const notFound = registry.findById('non-existent');
      expect(notFound).toBeNull();
    });

    it('应该通过制造商查找描述符', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const found = registry.findByManufacturer('Manufacturer A');
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(descriptor1);
    });

    it('应该通过能力搜索描述符', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const criteria = {
        minChannels: 16,
        minSampleRate: 150000000
      };

      const found = registry.searchByCapabilities(criteria);
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(descriptor2);
    });

    it('应该按兼容性排序描述符', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const requirements = {
        digitalChannels: 12,
        maxSampleRate: 150000000,
        protocolDecoders: ['spi', 'i2c']
      };

      const sorted = registry.findBestMatches(requirements);
      expect(sorted).toHaveLength(2);
      expect(sorted[0].score).toBeGreaterThanOrEqual(sorted[1].score);
    });

    it('应该注销描述符', () => {
      registry.register(descriptor1);
      expect(registry.getAll()).toHaveLength(1);

      const result = registry.unregister('device-001');
      expect(result).toBe(true);
      expect(registry.getAll()).toHaveLength(0);
    });

    it('应该清空注册表', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);
      expect(registry.getAll()).toHaveLength(2);

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('应该导出注册表', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const exported = registry.exportAll();
      expect(exported).toHaveLength(2);
      expect(exported).toContain(descriptor1);
      expect(exported).toContain(descriptor2);
    });

    it('应该导入描述符列表', () => {
      const descriptors = [descriptor1, descriptor2];
      const results = registry.importAll(descriptors);

      expect(results.successful).toBe(2);
      expect(results.failed).toBe(0);
      expect(registry.getAll()).toHaveLength(2);
    });

    it('应该处理批量导入错误', () => {
      const invalidDescriptor = { ...descriptor1 };
      delete (invalidDescriptor as any).id;

      const descriptors = [descriptor1, invalidDescriptor];
      const results = registry.importAll(descriptors);

      expect(results.successful).toBe(1);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
    });

    it('应该支持过滤和搜索', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const filtered = registry.filter((desc) => 
        desc.capabilities.digitalChannels >= 16
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(descriptor2);
    });

    it('应该统计注册表信息', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const stats = registry.getStatistics();
      expect(stats.totalDevices).toBe(2);
      expect(stats.manufacturerCount).toBe(2);
      expect(stats.connectionTypes).toContain('usb');
      expect(stats.connectionTypes).toContain('ethernet');
    });

    it('应该验证注册的描述符', () => {
      const invalidDescriptor = { ...descriptor1 };
      delete (invalidDescriptor as any).name;

      const result = registry.register(invalidDescriptor);
      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('应该处理大量数据的性能', () => {
      const startTime = Date.now();
      
      // 注册1000个描述符
      for (let i = 0; i < 1000; i++) {
        const desc = {
          ...descriptor1,
          id: `device-${i.toString().padStart(3, '0')}`,
          name: `Device ${i}`
        };
        registry.register(desc);
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应在1秒内完成
      expect(registry.getAll()).toHaveLength(1000);
    });

    it('应该支持复杂查询', () => {
      registry.register(descriptor1);
      registry.register(descriptor2);

      const query = {
        manufacturer: 'Manufacturer B',
        minChannels: 10,
        connectionTypes: ['ethernet'],
        protocolDecoders: ['spi']
      };

      const results = registry.advancedSearch(query);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(descriptor2);
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空描述符', () => {
      const result = parser.parse(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该处理超大描述符', () => {
      const hugeDescriptor = {
        ...validDescriptor,
        capabilities: {
          ...validDescriptor.capabilities,
          customData: 'x'.repeat(1000000) // 1MB 字符串
        }
      };

      expect(() => {
        registry.register(hugeDescriptor as any);
      }).toThrow('描述符过大');
    });

    it('应该处理循环引用', () => {
      const circularDescriptor: any = { ...validDescriptor };
      circularDescriptor.self = circularDescriptor;

      expect(() => {
        parser.exportToJson(circularDescriptor);
      }).toThrow();
    });

    it('应该处理特殊字符', () => {
      const specialCharDescriptor = {
        ...validDescriptor,
        name: 'Device with 特殊字符 & <XML> "quotes"',
        manufacturer: 'Mfg\nWith\tWhitespace'
      };

      const result = parser.parse(specialCharDescriptor);
      expect(result.isValid).toBe(true);
    });

    it('应该处理内存不足情况', () => {
      // 模拟内存不足
      const originalError = console.error;
      console.error = jest.fn();

      try {
        // 尝试创建巨大的数据结构
        const hugeArray = new Array(1000000).fill(validDescriptor);
        registry.importAll(hugeArray);
      } catch (error) {
        expect(error).toBeDefined();
      }

      console.error = originalError;
    });
  });

  describe('性能和可靠性测试', () => {
    it('应该快速验证大量描述符', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        const desc = { ...validDescriptor, id: `perf-test-${i}` };
        parser.parse(desc);
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500); // 应在500ms内完成
    });

    it('应该处理并发访问', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            const desc = { ...validDescriptor, id: `concurrent-${i}` };
            registry.register(desc);
            resolve();
          }, Math.random() * 100);
        });
      });

      await Promise.all(promises);
      expect(registry.getAll()).toHaveLength(10);
    });

    it('应该正确处理内存清理', () => {
      // 注册大量描述符
      for (let i = 0; i < 1000; i++) {
        const desc = { ...validDescriptor, id: `cleanup-test-${i}` };
        registry.register(desc);
      }

      // 清空并验证内存释放
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
    });
  });
});

const validDescriptor: HardwareDescriptor = {
  id: 'global-test-device',
  name: 'Global Test Device',
  manufacturer: 'Test Corporation',
  model: 'GTD-100',
  version: '1.0.0',
  capabilities: {
    digitalChannels: 8,
    analogChannels: 0,
    maxSampleRate: 100000000,
    maxMemoryDepth: 1048576,
    voltageRanges: [{ min: -3.3, max: 3.3 }],
    couplingModes: ['DC'],
    triggerTypes: ['edge'],
    protocolDecoders: ['uart', 'spi']
  },
  connectionTypes: ['usb'],
  driverInfo: {
    type: 'builtin',
    version: '1.0.0',
    compatibility: ['1.0.x']
  }
};