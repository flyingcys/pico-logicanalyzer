/**
 * ChannelMapping.ts 单元测试
 * 测试通道映射管理模块的所有功能
 */

import {
  ChannelMappingManager,
  channelMappingManager,
  ChannelMappingValidationResult,
  ChannelMappingConfig,
  ChannelUsage
} from '../../../src/decoders/ChannelMapping';
import { DecoderInfo, DecoderSelectedChannel } from '../../../src/decoders/types';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';

// Mock console methods to avoid log output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('ChannelMapping', () => {
  let manager: ChannelMappingManager;
  let mockDecoderInfo: DecoderInfo;
  let mockChannels: AnalyzerChannel[];

  beforeEach(() => {
    manager = new ChannelMappingManager();
    
    // Mock decoder info
    mockDecoderInfo = {
      id: 'test-decoder',
      name: 'Test Decoder',
      desc: 'Test protocol decoder',
      channels: [
        {
          id: 'sda',
          name: 'SDA',
          desc: 'Serial Data Line',
          required: true
        },
        {
          id: 'scl',
          name: 'SCL',
          desc: 'Serial Clock Line',
          required: true
        },
        {
          id: 'enable',
          name: 'Enable',
          desc: 'Optional enable signal',
          required: false
        }
      ],
      options: [],
      annotations: []
    };

    // Mock available analyzer channels
    mockChannels = [];
    for (let i = 0; i < 8; i++) {
      const channel: AnalyzerChannel = {
        channelNumber: i,
        channelName: `CH${i}`,
        hidden: false,
        samples: new Uint8Array([1, 0, 1, 0, 1]) // Mock sample data
      };
      mockChannels.push(channel);
    }

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('构造函数和初始化', () => {
    it('应该正确创建ChannelMappingManager实例', () => {
      expect(manager).toBeInstanceOf(ChannelMappingManager);
    });

    it('应该有全局单例实例', () => {
      expect(channelMappingManager).toBeInstanceOf(ChannelMappingManager);
    });

    it('应该初始化为空的映射存储', () => {
      const allMappings = manager.getAllSavedMappings();
      expect(allMappings).toEqual([]);
    });
  });

  describe('通道映射验证', () => {
    it('应该验证有效的通道映射', () => {
      const validMapping = {
        sda: 0,
        scl: 1,
        enable: 2
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, validMapping, mockChannels);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.missingRequiredChannels).toEqual([]);
      expect(result.conflictingMappings).toEqual([]);
    });

    it('应该检测缺少的必需通道', () => {
      const incompleteMapping = {
        sda: 0
        // 缺少必需的 scl 通道
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, incompleteMapping, mockChannels);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('缺少必需通道: SCL (Serial Clock Line)');
      expect(result.missingRequiredChannels).toContain('SCL');
    });

    it('应该检测多个缺少的必需通道', () => {
      const emptyMapping = {};

      const result = manager.validateChannelMapping(mockDecoderInfo, emptyMapping, mockChannels);

      expect(result.isValid).toBe(false);
      expect(result.missingRequiredChannels).toContain('SDA');
      expect(result.missingRequiredChannels).toContain('SCL');
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('应该检测无效的通道索引', () => {
      const invalidMapping = {
        sda: -1, // 负数索引
        scl: 8   // 超出范围
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, invalidMapping, mockChannels);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('通道 sda 映射到无效的通道索引: -1');
      expect(result.errors).toContain('通道 scl 映射到无效的通道索引: 8');
    });

    it('应该检测同一解码器内的通道冲突', () => {
      const conflictingMapping = {
        sda: 0,
        scl: 0, // 与 sda 相同的通道
        enable: 1
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, conflictingMapping, mockChannels);

      expect(result.isValid).toBe(false);
      expect(result.conflictingMappings).toHaveLength(1);
      expect(result.conflictingMappings[0].channel).toBe('CH1');
      expect(result.conflictingMappings[0].conflicts).toContain('sda');
      expect(result.conflictingMappings[0].conflicts).toContain('scl');
    });

    it('应该检测多个通道冲突', () => {
      const multiConflictMapping = {
        sda: 0,
        scl: 0, // 冲突1
        enable: 1,
        // 假设有第四个通道
      };

      mockDecoderInfo.channels.push({
        id: 'reset',
        name: 'Reset',
        desc: 'Reset signal',
        required: false
      });

      const conflictMapping2 = {
        ...multiConflictMapping,
        reset: 1 // 与 enable 冲突
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, conflictMapping2, mockChannels);

      expect(result.isValid).toBe(false);
      expect(result.conflictingMappings.length).toBeGreaterThanOrEqual(1);
    });

    it('应该检测没有数据的通道并发出警告', () => {
      // 创建一个没有样本数据的通道
      const channelsWithoutData = [...mockChannels];
      channelsWithoutData[2] = new AnalyzerChannel(2, 'CH2'); // 没有 samples 数据

      const mapping = {
        sda: 0,
        scl: 1,
        enable: 2 // 映射到没有数据的通道
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, mapping, channelsWithoutData);

      expect(result.isValid).toBe(true); // 警告不影响有效性
      expect(result.warnings).toContain('通道 enable (CH3) 没有可用数据');
    });

    it('应该检测样本数据为空的通道', () => {
      const channelsWithEmptyData = [...mockChannels];
      channelsWithEmptyData[1].samples = new Uint8Array(0); // 空数据

      const mapping = {
        sda: 0,
        scl: 1 // 映射到空数据通道
      };

      const result = manager.validateChannelMapping(mockDecoderInfo, mapping, channelsWithEmptyData);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('通道 scl (CH2) 没有可用数据');
    });
  });

  describe('通道使用情况分析', () => {
    it('应该正确分析通道使用情况', () => {
      const activeMappings = new Map([
        ['decoder1', {
          decoderName: 'I2C Decoder',
          mapping: { sda: 0, scl: 1 }
        }],
        ['decoder2', {
          decoderName: 'SPI Decoder',
          mapping: { mosi: 2, miso: 3, clk: 4 }
        }]
      ]);

      const usage = manager.getChannelUsage(activeMappings, 8);

      expect(usage).toHaveLength(8);
      
      // 检查已使用的通道
      expect(usage[0].isUsed).toBe(true);
      expect(usage[0].usedBy).toHaveLength(1);
      expect(usage[0].usedBy[0].decoderId).toBe('decoder1');
      expect(usage[0].usedBy[0].channelName).toBe('sda');

      expect(usage[1].isUsed).toBe(true);
      expect(usage[1].usedBy[0].channelName).toBe('scl');

      expect(usage[2].isUsed).toBe(true);
      expect(usage[2].usedBy[0].channelName).toBe('mosi');

      // 检查未使用的通道
      expect(usage[5].isUsed).toBe(false);
      expect(usage[5].usedBy).toEqual([]);
    });

    it('应该处理空的映射', () => {
      const emptyMappings = new Map();
      const usage = manager.getChannelUsage(emptyMappings, 4);

      expect(usage).toHaveLength(4);
      expect(usage.every(ch => !ch.isUsed)).toBe(true);
      expect(usage.every(ch => ch.usedBy.length === 0)).toBe(true);
    });

    it('应该处理超出范围的通道索引', () => {
      const mappingWithInvalidIndex = new Map([
        ['decoder1', {
          decoderName: 'Test Decoder',
          mapping: { ch1: -1, ch2: 10 } // 无效索引
        }]
      ]);

      const usage = manager.getChannelUsage(mappingWithInvalidIndex, 8);

      // 无效索引的通道不应该被记录
      expect(usage.every(ch => !ch.isUsed)).toBe(true);
    });

    it('应该使用默认最大通道数', () => {
      const activeMappings = new Map();
      const usage = manager.getChannelUsage(activeMappings); // 不指定 maxChannels

      expect(usage).toHaveLength(24); // 默认最大通道数
    });
  });

  describe('通道冲突检测', () => {
    it('应该检测跨解码器的通道冲突', () => {
      const conflictingMappings = new Map([
        ['decoder1', {
          decoderName: 'I2C Decoder',
          mapping: { sda: 0, scl: 1 }
        }],
        ['decoder2', {
          decoderName: 'UART Decoder',
          mapping: { rx: 0, tx: 2 } // rx 与 decoder1 的 sda 冲突
        }]
      ]);

      const conflicts = manager.detectChannelConflicts(conflictingMappings);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].channelNumber).toBe(0);
      expect(conflicts[0].conflicts).toHaveLength(2);
      
      const conflictDecoders = conflicts[0].conflicts.map(c => c.decoderId);
      expect(conflictDecoders).toContain('decoder1');
      expect(conflictDecoders).toContain('decoder2');
    });

    it('应该检测多个通道的冲突', () => {
      const multiConflictMappings = new Map([
        ['decoder1', {
          decoderName: 'Decoder 1',
          mapping: { a: 0, b: 1 }
        }],
        ['decoder2', {
          decoderName: 'Decoder 2',
          mapping: { c: 0, d: 1 } // 两个通道都冲突
        }]
      ]);

      const conflicts = manager.detectChannelConflicts(multiConflictMappings);

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map(c => c.channelNumber)).toContain(0);
      expect(conflicts.map(c => c.channelNumber)).toContain(1);
    });

    it('应该在没有冲突时返回空数组', () => {
      const nonConflictingMappings = new Map([
        ['decoder1', {
          decoderName: 'Decoder 1',
          mapping: { a: 0, b: 1 }
        }],
        ['decoder2', {
          decoderName: 'Decoder 2',
          mapping: { c: 2, d: 3 }
        }]
      ]);

      const conflicts = manager.detectChannelConflicts(nonConflictingMappings);

      expect(conflicts).toEqual([]);
    });
  });

  describe('自动通道分配', () => {
    it('应该自动分配可用的通道', () => {
      const usedChannels = new Set([0, 2, 4]);
      const mapping = manager.autoAssignChannels(mockDecoderInfo, usedChannels, 8);

      expect(mapping.sda).toBe(1); // 跳过被占用的 0
      expect(mapping.scl).toBe(3); // 跳过被占用的 2
      expect(mapping.enable).toBe(5); // 跳过被占用的 4

      // 验证没有使用被占用的通道
      const assignedChannels = Object.values(mapping);
      expect(assignedChannels).not.toContain(0);
      expect(assignedChannels).not.toContain(2);
      expect(assignedChannels).not.toContain(4);
    });

    it('应该优先分配必需通道', () => {
      const mapping = manager.autoAssignChannels(mockDecoderInfo, new Set(), 8);

      // 必需通道应该首先被分配
      expect(mapping.sda).toBe(0);
      expect(mapping.scl).toBe(1);
      expect(mapping.enable).toBe(2); // 可选通道在必需通道之后
    });

    it('应该处理通道不足的情况', () => {
      const usedChannels = new Set([0, 1, 2, 3, 4, 5, 6]); // 只剩一个通道
      const mapping = manager.autoAssignChannels(mockDecoderInfo, usedChannels, 8);

      // 只能分配一个通道，应该是第一个必需通道
      expect(mapping.sda).toBe(7);
      expect(mapping.scl).toBeUndefined(); // 没有足够的通道
      expect(mapping.enable).toBeUndefined();
    });

    it('应该处理所有通道都被占用的情况', () => {
      const allUsed = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
      const mapping = manager.autoAssignChannels(mockDecoderInfo, allUsed, 8);

      expect(Object.keys(mapping)).toHaveLength(0); // 没有可分配的通道
    });

    it('应该使用默认最大通道数', () => {
      const mapping = manager.autoAssignChannels(mockDecoderInfo); // 不指定参数

      expect(mapping.sda).toBe(0);
      expect(mapping.scl).toBe(1);
      expect(mapping.enable).toBe(2);
    });

    it('应该处理只有可选通道的解码器', () => {
      const optionalOnlyDecoder: DecoderInfo = {
        id: 'optional-decoder',
        name: 'Optional Decoder',
        desc: 'Decoder with only optional channels',
        channels: [
          { id: 'opt1', name: 'Optional 1', desc: 'First optional', required: false },
          { id: 'opt2', name: 'Optional 2', desc: 'Second optional', required: false }
        ],
        options: [],
        annotations: []
      };

      const mapping = manager.autoAssignChannels(optionalOnlyDecoder, new Set(), 8);

      expect(mapping.opt1).toBe(0);
      expect(mapping.opt2).toBe(1);
    });
  });

  describe('配置管理', () => {
    beforeEach(() => {
      // 清理之前测试的配置
      manager.clearAllSavedMappings();
    });

    it('应该保存通道映射配置', () => {
      const decoderId = 'test-decoder-1';
      const decoderName = 'Test Decoder 1';
      const mapping = { sda: 0, scl: 1 };

      manager.saveChannelMapping(decoderId, decoderName, mapping);

      const saved = manager.loadChannelMapping(decoderId);
      expect(saved).not.toBeNull();
      expect(saved!.decoderId).toBe(decoderId);
      expect(saved!.decoderName).toBe(decoderName);
      expect(saved!.mapping).toEqual(mapping);
      expect(saved!.createdAt).toBeInstanceOf(Date);
      expect(saved!.updatedAt).toBeInstanceOf(Date);
    });

    it('应该更新现有配置的时间戳', (done) => {
      const decoderId = 'test-decoder-1';
      const decoderName = 'Test Decoder 1';
      const mapping1 = { sda: 0, scl: 1 };
      const mapping2 = { sda: 2, scl: 3 };

      // 第一次保存
      manager.saveChannelMapping(decoderId, decoderName, mapping1);
      const first = manager.loadChannelMapping(decoderId)!;

      // 等待一小段时间，然后更新
      setTimeout(() => {
        manager.saveChannelMapping(decoderId, decoderName, mapping2);
        const updated = manager.loadChannelMapping(decoderId)!;

        expect(updated.createdAt.getTime()).toBeCloseTo(first.createdAt.getTime(), -1); // 创建时间应该接近
        expect(updated.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
        expect(updated.mapping).toEqual(mapping2);
        done();
      }, 10);
    });

    it('应该加载不存在的配置时返回null', () => {
      const result = manager.loadChannelMapping('non-existent-decoder');
      expect(result).toBeNull();
    });

    it('应该删除保存的配置', () => {
      const decoderId = 'test-decoder-2';
      manager.saveChannelMapping(decoderId, 'Test Decoder 2', { a: 0 });

      expect(manager.loadChannelMapping(decoderId)).not.toBeNull();

      const deleted = manager.deleteSavedMapping(decoderId);
      expect(deleted).toBe(true);
      expect(manager.loadChannelMapping(decoderId)).toBeNull();
    });

    it('应该在删除不存在的配置时返回false', () => {
      const deleted = manager.deleteSavedMapping('non-existent-decoder');
      expect(deleted).toBe(false);
    });

    it('应该获取所有保存的配置并按更新时间排序', async () => {
      // 确保开始时没有配置
      manager.clearAllSavedMappings();
      
      const configs = [
        { id: 'sorted-decoder-1', name: 'Sorted Decoder 1', mapping: { a: 0 } },
        { id: 'sorted-decoder-2', name: 'Sorted Decoder 2', mapping: { b: 1 } },
        { id: 'sorted-decoder-3', name: 'Sorted Decoder 3', mapping: { c: 2 } }
      ];

      // 保存配置（模拟不同的时间）
      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        await new Promise(resolve => setTimeout(resolve, 10)); // 添加延迟
        manager.saveChannelMapping(config.id, config.name, config.mapping);
      }

      const allConfigs = manager.getAllSavedMappings();
      expect(allConfigs.length).toBeGreaterThanOrEqual(3); // 至少应该有我们保存的3个配置
      
      // 验证按更新时间降序排列
      for (let i = 1; i < allConfigs.length; i++) {
        expect(allConfigs[i-1].updatedAt.getTime()).toBeGreaterThanOrEqual(
          allConfigs[i].updatedAt.getTime()
        );
      }
    });

    it('应该清空所有保存的配置', () => {
      manager.saveChannelMapping('decoder-1', 'Decoder 1', { a: 0 });
      manager.saveChannelMapping('decoder-2', 'Decoder 2', { b: 1 });

      expect(manager.getAllSavedMappings()).toHaveLength(2);

      manager.clearAllSavedMappings();

      expect(manager.getAllSavedMappings()).toHaveLength(0);
      expect(console.log).toHaveBeenCalledWith('🗑️ 所有保存的通道映射已清空');
    });
  });

  describe('导入导出功能', () => {
    it('应该导出通道映射配置', () => {
      manager.saveChannelMapping('decoder-1', 'Decoder 1', { sda: 0, scl: 1 });
      manager.saveChannelMapping('decoder-2', 'Decoder 2', { rx: 2, tx: 3 });

      const exported = manager.exportMappings();
      const data = JSON.parse(exported);

      expect(data.version).toBe('1.0.0');
      expect(data.exportDate).toBeDefined();
      expect(data.mappings).toHaveLength(2);
      
      const mapping1 = data.mappings.find((m: any) => m.id === 'decoder-1');
      expect(mapping1).toBeDefined();
      expect(mapping1.decoderName).toBe('Decoder 1');
      expect(mapping1.mapping).toEqual({ sda: 0, scl: 1 });
      expect(mapping1.createdAt).toBeDefined();
      expect(mapping1.updatedAt).toBeDefined();
    });

    it('应该导出空配置', () => {
      const exported = manager.exportMappings();
      const data = JSON.parse(exported);

      expect(data.version).toBe('1.0.0');
      expect(data.mappings).toEqual([]);
    });

    it('应该导入有效的配置数据', () => {
      const importData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        mappings: [
          {
            id: 'imported-decoder-1',
            decoderId: 'imported-decoder-1',
            decoderName: 'Imported Decoder 1',
            mapping: { a: 0, b: 1 },
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          },
          {
            id: 'imported-decoder-2',
            decoderId: 'imported-decoder-2',
            decoderName: 'Imported Decoder 2',
            mapping: { c: 2, d: 3 },
            createdAt: '2023-01-02T00:00:00.000Z',
            updatedAt: '2023-01-02T00:00:00.000Z'
          }
        ]
      };

      const result = manager.importMappings(JSON.stringify(importData));

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.error).toBeUndefined();

      const loaded1 = manager.loadChannelMapping('imported-decoder-1');
      expect(loaded1).not.toBeNull();
      expect(loaded1!.decoderName).toBe('Imported Decoder 1');
      expect(loaded1!.mapping).toEqual({ a: 0, b: 1 });
    });

    it('应该处理无效的JSON格式', () => {
      const result = manager.importMappings('invalid json');

      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('应该处理缺少mappings字段的数据', () => {
      const invalidData = { version: '1.0.0' };
      const result = manager.importMappings(JSON.stringify(invalidData));

      expect(result.success).toBe(false);
      expect(result.error).toBe('无效的数据格式');
      expect(result.imported).toBe(0);
    });

    it('应该处理mappings不是数组的情况', () => {
      const invalidData = { mappings: 'not an array' };
      const result = manager.importMappings(JSON.stringify(invalidData));

      expect(result.success).toBe(false);
      expect(result.error).toBe('无效的数据格式');
    });

    it('应该跳过无效的单个映射项', () => {
      const partiallyValidData = {
        mappings: [
          {
            decoderId: 'valid-decoder',
            decoderName: 'Valid Decoder',
            mapping: { a: 0 },
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z'
          },
          {
            // 缺少必需字段的无效项
            decoderId: 'invalid-decoder'
          }
        ]
      };

      const result = manager.importMappings(JSON.stringify(partiallyValidData));

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1); // 只导入了一个有效项
      expect(console.error).toHaveBeenCalled(); // 应该记录错误
    });

    it('应该处理非Error类型的异常', () => {
      // 创建一个会导致非Error异常的JSON字符串
      // 使用具有循环引用的字符串，让 JSON.parse 抛出非Error异常
      const invalidJSON = '{invalid';
      
      // Mock JSON.parse to throw a non-Error exception
      const originalParse = JSON.parse;
      JSON.parse = jest.fn().mockImplementation(() => {
        throw 'Non-Error exception'; // 抛出非Error类型的异常
      });

      const result = manager.importMappings(invalidJSON);

      expect(result.success).toBe(false);
      expect(result.error).toBe('未知错误'); // 应该返回默认错误消息
      expect(result.imported).toBe(0);

      // 恢复 JSON.parse
      JSON.parse = originalParse;
    });
  });

  describe('格式转换', () => {
    it('应该转换为DecoderSelectedChannel格式', () => {
      const mapping = { sda: 0, scl: 1, enable: 2 };
      const channels = manager.toDecoderSelectedChannels(mapping);

      expect(channels).toHaveLength(3);
      expect(channels).toContainEqual({ name: 'sda', channel: 0 });
      expect(channels).toContainEqual({ name: 'scl', channel: 1 });
      expect(channels).toContainEqual({ name: 'enable', channel: 2 });
    });

    it('应该从DecoderSelectedChannel格式转换', () => {
      const channels: DecoderSelectedChannel[] = [
        { name: 'sda', channel: 0 },
        { name: 'scl', channel: 1 },
        { name: 'enable', channel: 2 }
      ];

      const mapping = manager.fromDecoderSelectedChannels(channels);

      expect(mapping).toEqual({
        sda: 0,
        scl: 1,
        enable: 2
      });
    });

    it('应该处理空的转换', () => {
      const emptyMapping = {};
      const channels = manager.toDecoderSelectedChannels(emptyMapping);
      expect(channels).toEqual([]);

      const emptyChannels: DecoderSelectedChannel[] = [];
      const mapping = manager.fromDecoderSelectedChannels(emptyChannels);
      expect(mapping).toEqual({});
    });

    it('应该支持往返转换', () => {
      const originalMapping = { a: 0, b: 1, c: 2 };
      
      const channels = manager.toDecoderSelectedChannels(originalMapping);
      const convertedMapping = manager.fromDecoderSelectedChannels(channels);

      expect(convertedMapping).toEqual(originalMapping);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理极大的通道数', () => {
      const largeChannelCount = 1000;
      const usage = manager.getChannelUsage(new Map(), largeChannelCount);

      expect(usage).toHaveLength(largeChannelCount);
      expect(usage.every(ch => !ch.isUsed)).toBe(true);
    });

    it('应该处理负数通道索引', () => {
      const mappingWithNegativeIndex = new Map([
        ['decoder1', {
          decoderName: 'Test Decoder',
          mapping: { ch1: -5, ch2: -1 }
        }]
      ]);

      const usage = manager.getChannelUsage(mappingWithNegativeIndex, 8);
      expect(usage.every(ch => !ch.isUsed)).toBe(true);
    });

    it('应该处理空的解码器信息', () => {
      const emptyDecoderInfo: DecoderInfo = {
        id: 'empty-decoder',
        name: 'Empty Decoder',
        desc: 'Decoder with no channels',
        channels: [],
        options: [],
        annotations: []
      };

      const mapping = manager.autoAssignChannels(emptyDecoderInfo, new Set(), 8);
      expect(mapping).toEqual({});

      const result = manager.validateChannelMapping(emptyDecoderInfo, {}, mockChannels);
      expect(result.isValid).toBe(true);
    });

    it('应该处理导入时的日期解析错误', () => {
      const dataWithInvalidDate = {
        mappings: [
          {
            decoderId: 'test-decoder',
            decoderName: 'Test Decoder',
            mapping: { a: 0 },
            createdAt: 'invalid-date',
            updatedAt: 'invalid-date'
          }
        ]
      };

      const result = manager.importMappings(JSON.stringify(dataWithInvalidDate));

      expect(result.success).toBe(true);
      expect(result.imported).toBe(0); // 由于日期无效，应该跳过
      expect(console.error).toHaveBeenCalled();
    });

    it('应该处理循环引用的对象', () => {
      const circularMapping: any = { sda: 0 };
      circularMapping.self = circularMapping; // 创建循环引用

      // 这应该不会导致无限循环或崩溃
      expect(() => {
        manager.saveChannelMapping('circular-decoder', 'Circular Decoder', circularMapping);
      }).not.toThrow();
    });

    it('应该处理非常长的解码器名称', () => {
      const veryLongName = 'A'.repeat(10000);
      const decoderId = 'long-name-decoder';

      manager.saveChannelMapping(decoderId, veryLongName, { a: 0 });
      const loaded = manager.loadChannelMapping(decoderId);

      expect(loaded!.decoderName).toBe(veryLongName);
    });
  });
});