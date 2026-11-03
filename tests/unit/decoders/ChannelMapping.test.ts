/**
 * ChannelMappingManager 单元测试
 * 覆盖：必选通道校验、重复通道、越界通道、跨解码器冲突、坏导入、双向映射往返
 * 断言策略：基于结果对象 ChannelMappingValidationResult（不依赖抛错）
 */

import {
  ChannelMappingManager,
  type ChannelMappingValidationResult
} from '../../../src/decoders/ChannelMapping';
import type { DecoderInfo } from '../../../src/decoders/types';
import type { AnalyzerChannel } from '../../../src/models/AnalyzerTypes';

/**
 * 构造带样本数据的可用通道数组（绕过 clone 实现，validateChannelMapping 仅读取 length 与 samples）
 */
function makeChannels(count: number, withSamples = true): AnalyzerChannel[] {
  const arr: AnalyzerChannel[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      channelNumber: i,
      channelName: `CH${i + 1}`,
      textualChannelNumber: String(i + 1),
      hidden: false,
      // 有样本数据则给 1 字节，避免触发"无可用数据"警告
      samples: withSamples ? new Uint8Array([1, 2, 3]) : new Uint8Array(0)
    } as AnalyzerChannel);
  }
  return arr;
}

/**
 * I2C 解码器定义（SDA/SCL 必选）
 */
function makeI2CDecoder(): DecoderInfo {
  return {
    id: 'i2c',
    name: 'i2c',
    longname: 'I2C',
    description: 'I2C 协议',
    license: 'GPL',
    inputs: ['logic'],
    outputs: ['annotations'],
    tags: ['Embedded'],
    channels: [
      { id: 'sda', name: 'SDA', desc: '数据线', required: true },
      { id: 'scl', name: 'SCL', desc: '时钟线', required: true }
    ],
    options: [],
    annotations: []
  };
}

/**
 * SPI 解码器定义（MOSI/SCLK 必选）
 */
function makeSPIDecoder(): DecoderInfo {
  return {
    id: 'spi',
    name: 'spi',
    longname: 'SPI',
    description: 'SPI 协议',
    license: 'GPL',
    inputs: ['logic'],
    outputs: ['annotations'],
    tags: ['Embedded'],
    channels: [
      { id: 'mosi', name: 'MOSI', desc: '主出从入', required: true },
      { id: 'sclk', name: 'SCLK', desc: '时钟', required: true }
    ],
    options: [],
    annotations: []
  };
}

describe('ChannelMappingManager', () => {
  let manager: ChannelMappingManager;

  beforeEach(() => {
    // 每个用例独立实例，避免全局单例的状态污染
    manager = new ChannelMappingManager();
  });

  // ============================================================
  // validateChannelMapping：必选通道
  // ============================================================
  describe('validateChannelMapping - 必选通道', () => {
    test('缺失必选通道时返回 isValid=false 且 missingRequiredChannels 包含缺失项', () => {
      const decoder = makeI2CDecoder();
      // 仅映射 SDA，缺 SCL
      const mapping = { sda: 0 };
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8));

      expect(result.isValid).toBe(false);
      expect(result.missingRequiredChannels).toContain('SCL');
      expect(result.missingRequiredChannels).not.toContain('SDA');
      // 错误信息含缺失通道描述
      expect(result.errors.some(e => e.includes('SCL'))).toBe(true);
    });

    test('所有必选通道齐全时该规则通过', () => {
      const decoder = makeI2CDecoder();
      const mapping = { sda: 0, scl: 1 };
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8));

      // 无缺失、无重复、无越界
      expect(result.missingRequiredChannels).toEqual([]);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================================
  // validateChannelMapping：重复通道（同一解码器内）
  // ============================================================
  describe('validateChannelMapping - 重复通道', () => {
    test('两个解码器通道映射到同一物理通道时标记冲突', () => {
      const decoder = makeI2CDecoder();
      // SDA 与 SCL 都映射到 CH0（索引 0）
      const mapping = { sda: 0, scl: 0 };
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8));

      expect(result.isValid).toBe(false);
      expect(result.conflictingMappings.length).toBeGreaterThan(0);
      // 冲突对象描述了被重复使用的物理通道（CH1 = 索引 0 + 1）
      const conflict = result.conflictingMappings.find(c => c.channel === 'CH1');
      expect(conflict).toBeDefined();
      expect(conflict!.conflicts).toEqual(expect.arrayContaining(['sda', 'scl']));
      // 错误信息含"多个解码器通道使用"含义
      expect(result.errors.some(e => e.includes('CH1'))).toBe(true);
    });
  });

  // ============================================================
  // validateChannelMapping：越界通道
  // ============================================================
  describe('validateChannelMapping - 越界通道', () => {
    test('负数通道索引判定为越界', () => {
      const decoder = makeI2CDecoder();
      const mapping = { sda: -1, scl: 0 };
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('无效') && e.includes('-1'))).toBe(true);
    });

    test('通道索引大于可用通道上限判定为越界', () => {
      const decoder = makeI2CDecoder();
      // 8 个可用通道，最大索引 7，sda=8 越界
      const mapping = { sda: 8, scl: 0 };
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8));

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('无效') && e.includes('8'))).toBe(true);
    });

    test('恰好等于最大索引不越界', () => {
      const decoder = makeI2CDecoder();
      // 8 个可用通道，最大索引 7
      const mapping = { sda: 7, scl: 6 };
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8));

      expect(result.errors.some(e => e.includes('无效'))).toBe(false);
      // 与「所有必选通道齐全」用例严格度一致：显式断言整体有效
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================================
  // validateChannelMapping：通道数据可用性警告
  // ============================================================
  describe('validateChannelMapping - 数据可用性警告', () => {
    test('通道无样本数据时产生警告但不影响 isValid', () => {
      const decoder = makeI2CDecoder();
      const mapping = { sda: 0, scl: 1 };
      // 第 0/1 通道样本为空
      const result = manager.validateChannelMapping(decoder, mapping, makeChannels(8, false));

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================================
  // detectChannelConflicts / getChannelUsage：跨解码器冲突
  // ============================================================
  describe('detectChannelConflicts - 跨解码器冲突', () => {
    test('两个解码器映射到同一物理通道时检测到冲突', () => {
      // I2C 的 SDA→CH0，SPI 的 MOSI→CH0，跨解码器冲突
      const activeMappings = new Map<string, { decoderName: string; mapping: Record<string, number> }>([
        ['i2c', { decoderName: 'I2C', mapping: { sda: 0, scl: 1 } }],
        ['spi', { decoderName: 'SPI', mapping: { mosi: 0, sclk: 2 } }]
      ]);

      const conflicts = manager.detectChannelConflicts(activeMappings);

      // CH0（channelNumber=0）应出现在冲突列表
      const ch0 = conflicts.find(c => c.channelNumber === 0);
      expect(ch0).toBeDefined();
      expect(ch0!.conflicts.length).toBe(2);
      // 冲突方分别来自 I2C 与 SPI
      const decoderIds = ch0!.conflicts.map(c => c.decoderId);
      expect(decoderIds).toEqual(expect.arrayContaining(['i2c', 'spi']));
    });

    test('解码器映射到不同通道时无冲突', () => {
      const activeMappings = new Map<string, { decoderName: string; mapping: Record<string, number> }>([
        ['i2c', { decoderName: 'I2C', mapping: { sda: 0, scl: 1 } }],
        ['spi', { decoderName: 'SPI', mapping: { mosi: 2, sclk: 3 } }]
      ]);

      const conflicts = manager.detectChannelConflicts(activeMappings);
      expect(conflicts).toEqual([]);
    });

    test('getChannelUsage 正确统计使用情况', () => {
      const activeMappings = new Map<string, { decoderName: string; mapping: Record<string, number> }>([
        ['i2c', { decoderName: 'I2C', mapping: { sda: 0, scl: 1 } }]
      ]);

      const usage = manager.getChannelUsage(activeMappings, 4);
      expect(usage).toHaveLength(4);
      expect(usage[0].isUsed).toBe(true);
      expect(usage[0].usedBy[0].decoderId).toBe('i2c');
      expect(usage[2].isUsed).toBe(false);
    });
  });

  // ============================================================
  // autoAssignChannels
  // ============================================================
  describe('autoAssignChannels', () => {
    test('自动分配跳过已使用通道并优先必选通道', () => {
      const decoder = makeI2CDecoder();
      // CH0 已被占用
      const used = new Set<number>([0]);
      const mapping = manager.autoAssignChannels(decoder, used, 8);

      // 必选通道 SDA/SCL 都应被分配，且避开 CH0
      expect(mapping.sda).toBeDefined();
      expect(mapping.scl).toBeDefined();
      expect(mapping.sda).not.toBe(0);
      expect(mapping.scl).not.toBe(0);
      expect(mapping.sda).not.toBe(mapping.scl);
    });

    test('必选通道分配完毕后继续分配可选通道', () => {
      // UART：RX/TX 必选，RTS/CTS 可选 —— 触发可选通道分配循环
      const decoder: DecoderInfo = {
        id: 'uart',
        name: 'uart',
        longname: 'UART',
        description: 'UART',
        license: 'GPL',
        inputs: ['logic'],
        outputs: ['annotations'],
        tags: ['Embedded'],
        channels: [
          { id: 'rx', name: 'RX', desc: '接收', required: true },
          { id: 'tx', name: 'TX', desc: '发送', required: true },
          { id: 'rts', name: 'RTS', desc: '请求发送', required: false },
          { id: 'cts', name: 'CTS', desc: '清除发送', required: false }
        ],
        options: [],
        annotations: []
      };

      const mapping = manager.autoAssignChannels(decoder, new Set<number>(), 8);
      // 4 个通道全部被分配，索引两两不同
      expect(Object.keys(mapping)).toHaveLength(4);
      const indices = Object.values(mapping);
      expect(new Set(indices).size).toBe(4);
      // 可选通道也被分配到有效索引
      expect(mapping.rts).toBeDefined();
      expect(mapping.cts).toBeDefined();
    });

    test('通道用尽时停止分配（容量不足）', () => {
      const decoder = makeI2CDecoder();
      // 仅剩 1 个通道，不足以容纳 SDA+SCL
      const used = new Set<number>([0, 1]);
      const mapping = manager.autoAssignChannels(decoder, used, 2);
      // 容量不足，不应抛错；分配结果只含 0 个通道
      expect(Object.keys(mapping)).toHaveLength(0);
    });

    test('可选通道分配时跳过已被占用的通道索引', () => {
      // 仅含可选通道的解码器，预占 CH0/CH1，验证可选通道跳过占用索引落到后续通道
      const decoder: DecoderInfo = {
        id: 'gpio',
        name: 'gpio',
        longname: 'GPIO',
        description: 'GPIO',
        license: 'GPL',
        inputs: ['logic'],
        outputs: ['annotations'],
        tags: ['Embedded'],
        channels: [
          { id: 'a', name: 'A', desc: '可选A', required: false },
          { id: 'b', name: 'B', desc: '可选B', required: false }
        ],
        options: [],
        annotations: []
      };

      const used = new Set<number>([0, 1]);
      const mapping = manager.autoAssignChannels(decoder, used, 8);
      // 应跳过 CH0/CH1，落到 CH2/CH3
      expect(mapping.a).toBe(2);
      expect(mapping.b).toBe(3);
    });
  });

  // ============================================================
  // importMappings / exportMappings：坏导入与往返
  // ============================================================
  describe('importMappings - 坏导入', () => {
    test('JSON 语法错误时返回 success=false 且不抛错', () => {
      const result = manager.importMappings('{bad json}');
      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.error).toBeDefined();
    });

    test('mappings 字段非数组时返回 success=false', () => {
      const result = manager.importMappings(JSON.stringify({ mappings: {} }));
      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
    });

    test('null 顶层 JSON 时返回 success=false 且不抛错', () => {
      // JSON.parse('null') = null，访问 null.mappings 会抛 TypeError，应被外层 catch 捕获
      const result = manager.importMappings('null');
      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
    });

    test('坏导入不部分写入已有映射：导入失败后 exportMappings 与导入前一致', () => {
      // 预置一个已有映射
      manager.saveChannelMapping('i2c', 'I2C', { sda: 0, scl: 1 });
      const beforeExport = manager.exportMappings();

      // 尝试导入坏 JSON（语法错误）
      const result = manager.importMappings('{bad json}');
      expect(result.success).toBe(false);

      // 导入失败后，已有映射应保持不变。
      // 注意：exportMappings 含动态 exportDate 时间戳，比较时剔除该字段。
      const afterExport = manager.exportMappings();
      const stripDate = (json: string) => {
        const obj = JSON.parse(json);
        delete obj.exportDate;
        return obj;
      };
      expect(stripDate(afterExport)).toEqual(stripDate(beforeExport));
      // 映射条目数量与内容一致
      expect(stripDate(afterExport).mappings).toEqual(stripDate(beforeExport).mappings);
    });

    test('条目缺必需字段时跳过该条目，imported 反映实际写入数', () => {
      // 当前契约：逐条处理，有效条目写入，无效条目跳过，不整体回滚
      const data = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        mappings: [
          {
            id: 'i2c',
            decoderId: 'i2c',
            decoderName: 'I2C',
            mapping: { sda: 0, scl: 1 },
            createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            updatedAt: new Date('2024-01-01T00:00:00Z').toISOString()
          },
          // 缺 decoderId 等必需字段
          { id: 'bad', decoderName: 'Bad' }
        ]
      };

      const result = manager.importMappings(JSON.stringify(data));
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(manager.loadChannelMapping('i2c')).not.toBeNull();
    });

    test('条目日期无效时跳过该条目', () => {
      // 字段齐全但 createdAt 非法，应触发"无效的日期格式"分支并跳过
      const data = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        mappings: [
          {
            id: 'uart',
            decoderId: 'uart',
            decoderName: 'UART',
            mapping: { rx: 0, tx: 1 },
            createdAt: 'not-a-valid-date',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const result = manager.importMappings(JSON.stringify(data));
      // 整体 success 仍为 true（逐条处理），但该条目未写入
      expect(result.imported).toBe(0);
      expect(manager.loadChannelMapping('uart')).toBeNull();
    });
  });

  describe('exportMappings / importMappings - 双向往返', () => {
    test('export → import 后映射数据 deep-equal 一致', () => {
      const original = new ChannelMappingManager();
      original.saveChannelMapping('i2c', 'I2C', { sda: 0, scl: 1 });
      original.saveChannelMapping('spi', 'SPI', { mosi: 2, sclk: 3, miso: 4 });

      const exported = original.exportMappings();

      // 导入到新实例
      const importResult = manager.importMappings(exported);
      expect(importResult.success).toBe(true);
      expect(importResult.imported).toBe(2);

      // 比较两侧的 mapping（数值映射对象）应 deep-equal
      const i2cOrig = original.loadChannelMapping('i2c')!;
      const i2cNew = manager.loadChannelMapping('i2c')!;
      expect(i2cNew.mapping).toEqual(i2cOrig.mapping);
      expect(i2cNew.decoderName).toBe(i2cOrig.decoderName);

      const spiOrig = original.loadChannelMapping('spi')!;
      const spiNew = manager.loadChannelMapping('spi')!;
      expect(spiNew.mapping).toEqual(spiOrig.mapping);
    });

    test('exportMappings 输出合法 JSON 且含 version/mappings 字段', () => {
      manager.saveChannelMapping('i2c', 'I2C', { sda: 0, scl: 1 });
      const exported = manager.exportMappings();

      expect(() => JSON.parse(exported)).not.toThrow();
      const parsed = JSON.parse(exported);
      expect(parsed.version).toBe('1.0.0');
      expect(Array.isArray(parsed.mappings)).toBe(true);
      expect(parsed.mappings).toHaveLength(1);
    });
  });

  // ============================================================
  // CRUD：save / load / delete / clearAll / getAll
  // ============================================================
  describe('CRUD 操作', () => {
    test('save → load 往返一致', () => {
      manager.saveChannelMapping('i2c', 'I2C', { sda: 0, scl: 1 });
      const loaded = manager.loadChannelMapping('i2c');
      expect(loaded).not.toBeNull();
      expect(loaded!.mapping).toEqual({ sda: 0, scl: 1 });
      expect(loaded!.decoderName).toBe('I2C');
    });

    test('load 不存在的映射返回 null', () => {
      expect(manager.loadChannelMapping('nonexistent')).toBeNull();
    });

    test('deleteSavedMapping 删除后返回 true，再删返回 false', () => {
      manager.saveChannelMapping('i2c', 'I2C', { sda: 0, scl: 1 });
      expect(manager.deleteSavedMapping('i2c')).toBe(true);
      expect(manager.loadChannelMapping('i2c')).toBeNull();
      expect(manager.deleteSavedMapping('i2c')).toBe(false);
    });

    test('clearAllSavedMappings 清空全部映射', () => {
      manager.saveChannelMapping('i2c', 'I2C', { sda: 0 });
      manager.saveChannelMapping('spi', 'SPI', { mosi: 1 });
      manager.clearAllSavedMappings();
      expect(manager.getAllSavedMappings()).toHaveLength(0);
    });

    test('getAllSavedMappings 按 updatedAt 倒序排列（后更新的在前）', () => {
      // 用 fake timers 确保两次 save 的 updatedAt 毫秒值明确不同
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
        manager.saveChannelMapping('i2c', 'I2C', { sda: 0 });

        jest.setSystemTime(new Date('2024-01-02T00:00:00.000Z'));
        manager.saveChannelMapping('spi', 'SPI', { mosi: 1 });

        const all = manager.getAllSavedMappings();
        expect(all).toHaveLength(2);
        // 后更新的 spi 应排在前面
        expect(all[0].decoderId).toBe('spi');
        expect(all[1].decoderId).toBe('i2c');
        expect(all[0].updatedAt.getTime()).toBeGreaterThanOrEqual(all[1].updatedAt.getTime());
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ============================================================
  // toDecoderSelectedChannels / fromDecoderSelectedChannels
  // ============================================================
  describe('toDecoderSelectedChannels / fromDecoderSelectedChannels', () => {
    test('双向转换往返保持映射数据一致', () => {
      const mapping = { sda: 0, scl: 1 };
      const channels = manager.toDecoderSelectedChannels(mapping);
      const restored = manager.fromDecoderSelectedChannels(channels);
      expect(restored).toEqual(mapping);
    });

    test('fromDecoderSelectedChannels 跳过 name/channel 未定义的条目', () => {
      const channels = [
        { name: 'sda', channel: 0, captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 } // 无 name/channel，应跳过
      ];
      const restored = manager.fromDecoderSelectedChannels(channels as any);
      expect(restored).toEqual({ sda: 0 });
    });
  });
});
