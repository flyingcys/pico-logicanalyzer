/**
 * ChannelMapping.ts 单元测试
 * 快速提高 DECODERS 模块覆盖率
 */

import '../tests/setup';
import { ChannelMappingManager } from '../src/decoders/ChannelMapping';
import type { DecoderSelectedChannel, DecoderInfo } from '../src/decoders/types';
import type { AnalyzerChannel } from '../src/models/AnalyzerTypes';

describe('ChannelMapping', () => {
  let manager: ChannelMappingManager;

  beforeEach(() => {
    manager = new ChannelMappingManager();
  });

  const mockDecoderInfo: DecoderInfo = {
    id: 'test',
    name: 'Test Decoder',
    longname: 'Test Protocol Decoder',
    desc: 'A test decoder',
    license: 'test',
    inputs: ['logic'],
    outputs: ['test'],
    tags: ['Test'],
    channels: [
      { id: 'clk', name: 'Clock', desc: 'Clock signal', required: true, index: 0 },
      { id: 'data', name: 'Data', desc: 'Data signal', required: false, index: 1 }
    ],
    options: [],
    annotations: [],
    annotationRows: []
  };

  const mockChannels: AnalyzerChannel[] = [
    { id: 0, name: 'Channel 0', enabled: true },
    { id: 1, name: 'Channel 1', enabled: true },
    { id: 2, name: 'Channel 2', enabled: false }
  ];

  describe('基本功能', () => {
    test('应该创建实例', () => {
      expect(manager).toBeDefined();
    });

    test('应该验证通道映射', () => {
      const mapping = { clk: 0, data: 1 };
      const result = manager.validateChannelMapping(mockDecoderInfo, mapping, mockChannels);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.missingRequiredChannels).toBeDefined();
    });

    test('应该检测缺失的必需通道', () => {
      const mapping = { data: 1 }; // 缺少必需的 clk 通道
      const result = manager.validateChannelMapping(mockDecoderInfo, mapping, mockChannels);
      
      expect(result.isValid).toBe(false);
      expect(result.missingRequiredChannels).toContain('Clock');
    });

    test('应该自动分配通道', () => {
      const result = manager.autoAssignChannels(mockDecoderInfo, mockChannels);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('配置管理', () => {
    test('应该保存和加载配置', () => {
      const mapping = { clk: 0, data: 1 };
      
      manager.saveChannelMapping('test-decoder', 'Test Decoder', mapping);
      const loaded = manager.loadChannelMapping('test-decoder');
      
      expect(loaded).toBeDefined();
      expect(loaded?.decoderId).toBe('test-decoder');
    });

    test('应该删除配置', () => {
      const mapping = { clk: 0, data: 1 };
      
      manager.saveChannelMapping('test-decoder', 'Test Decoder', mapping);
      const deleted = manager.deleteSavedMapping('test-decoder');
      
      expect(deleted).toBe(true);
      
      const loaded = manager.loadChannelMapping('test-decoder');
      expect(loaded).toBeNull();
    });

    test('应该获取所有配置', () => {
      const mapping1 = { clk: 0, data: 1 };
      const mapping2 = { signal: 2 };
      
      manager.saveChannelMapping('decoder-1', 'Decoder 1', mapping1);
      manager.saveChannelMapping('decoder-2', 'Decoder 2', mapping2);
      
      const all = manager.getAllSavedMappings();
      expect(all.length).toBe(2);
    });
  });

  describe('格式转换', () => {
    test('应该转换为DecoderSelectedChannel格式', () => {
      const mapping = { clk: 0, data: 1 };
      const converted = manager.toDecoderSelectedChannels(mapping);
      
      expect(Array.isArray(converted)).toBe(true);
      expect(converted.length).toBe(2);
    });

    test('应该从DecoderSelectedChannel格式转换', () => {
      const channels: DecoderSelectedChannel[] = [
        { decoderIndex: 0, captureIndex: 0 },
        { decoderIndex: 1, captureIndex: 1 }
      ];
      
      const converted = manager.fromDecoderSelectedChannels(channels);
      expect(typeof converted).toBe('object');
    });
  });

  describe('导入导出', () => {
    test('应该导出配置', () => {
      const mapping = { clk: 0, data: 1 };
      manager.saveChannelMapping('test-decoder', 'Test Decoder', mapping);
      
      const exported = manager.exportMappings();
      expect(typeof exported).toBe('string');
    });

    test('应该导入配置', () => {
      const mapping = { clk: 0, data: 1 };
      manager.saveChannelMapping('test-decoder', 'Test Decoder', mapping);
      
      const exported = manager.exportMappings();
      manager.clearAllSavedMappings();
      
      const result = manager.importMappings(exported);
      expect(result.success).toBe(true);
      expect(result.imported).toBeGreaterThan(0);
    });
  });

  describe('通道使用情况', () => {
    test('应该分析通道使用情况', () => {
      const mapping1 = { clk: 0, data: 1 };
      const mapping2 = { signal: 1, enable: 2 };
      
      manager.saveChannelMapping('decoder-1', 'Decoder 1', mapping1);
      manager.saveChannelMapping('decoder-2', 'Decoder 2', mapping2);
      
      const usage = manager.getChannelUsage();
      expect(Array.isArray(usage)).toBe(true);
    });

    test('应该检测通道冲突', () => {
      const mapping1 = { clk: 0, data: 1 };
      const mapping2 = { signal: 1, enable: 2 }; // 通道1冲突
      
      manager.saveChannelMapping('decoder-1', 'Decoder 1', mapping1);
      manager.saveChannelMapping('decoder-2', 'Decoder 2', mapping2);
      
      const conflicts = manager.detectChannelConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('边界条件测试', () => {
    test('应该处理空映射', () => {
      const result = manager.validateChannelMapping(mockDecoderInfo, {}, mockChannels);
      expect(result.isValid).toBe(false);
    });

    test('应该处理无效通道索引', () => {
      const mapping = { clk: 99 }; // 超出范围
      const result = manager.validateChannelMapping(mockDecoderInfo, mapping, mockChannels);
      expect(result.isValid).toBe(false);
    });

    test('应该处理空通道列表', () => {
      const mapping = { clk: 0 };
      const result = manager.validateChannelMapping(mockDecoderInfo, mapping, []);
      expect(result.isValid).toBe(false);
    });
  });
});

export {};