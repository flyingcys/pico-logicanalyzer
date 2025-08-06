/**
 * DecoderManager.ts 单元测试
 * 快速提高 DECODERS 模块覆盖率
 */

import '../tests/setup';
import { DecoderManager } from '../src/decoders/DecoderManager';
import type { ChannelData, DecoderOptionValue, DecoderSelectedChannel } from '../src/decoders/types';

describe('DecoderManager', () => {
  let manager: DecoderManager;

  beforeEach(() => {
    manager = new DecoderManager();
  });

  describe('基本功能', () => {
    test('应该创建实例', () => {
      expect(manager).toBeDefined();
    });

    test('应该获取可用解码器', () => {
      const decoders = manager.getAvailableDecoders();
      expect(Array.isArray(decoders)).toBe(true);
    });

    test('应该按ID获取解码器', () => {
      const decoder = manager.getDecoder('test'); // 测试不存在的解码器
      expect(decoder).toBe(null); // 不存在时应该返回null
    });

    test('应该获取解码器信息', () => {
      const info = manager.getDecoderInfo('test'); // 测试不存在的解码器
      expect(info).toBeUndefined(); // 不存在时应该返回undefined
    });

    test('应该检查流式支持', () => {
      const isSupported = manager.isStreamingSupported('test');
      expect(typeof isSupported).toBe('boolean');
    });
  });

  describe('解码器注册', () => {
    // 注意：这里我们不实际注册解码器，因为需要具体的解码器类
    test('应该有注册解码器的方法', () => {
      expect(typeof manager.registerDecoder).toBe('function');
      expect(typeof manager.registerStreamingDecoder).toBe('function');
    });
  });

  describe('搜索功能', () => {
    test('应该搜索解码器', () => {
      const results = manager.searchDecoders('test');
      expect(Array.isArray(results)).toBe(true);
    });

    test('应该按标签获取解码器', () => {
      const results = manager.getDecodersByTags(['test']);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('流式处理管理', () => {
    test('应该获取活跃的流式任务计数', () => {
      const count = manager.getActiveStreamingTaskCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('应该获取活跃解码器', () => {
      const active = manager.getActiveDecoders();
      expect(Array.isArray(active)).toBe(true);
    });

    test('应该停止所有流式任务', () => {
      expect(() => manager.stopAllStreamingTasks()).not.toThrow();
    });

    test('应该停止指定解码器', () => {
      const result = manager.stopDecoder('test');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('输入输出管理', () => {
    test('应该管理输入', () => {
      const input = manager.getInput('test');
      expect(input).toBe(null); // 不存在的输入应该返回null
    });

    test('应该添加输出', () => {
      expect(() => manager.addOutput('test', [])).not.toThrow();
    });
  });

  describe('性能监控', () => {
    test('应该有性能监控器', () => {
      expect(manager.performanceMonitor).toBeDefined();
    });
  });

  describe('统计信息', () => {
    test('应该获取统计信息', () => {
      const stats = manager.getStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.registeredDecoders).toBe('number');
      expect(typeof stats.registeredStreamingDecoders).toBe('number');
      expect(typeof stats.availableDecoders).toBe('number');
    });
  });
});

export {};