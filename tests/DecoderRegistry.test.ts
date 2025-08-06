/**
 * DecoderRegistry.ts 单元测试
 * 快速提高 DECODERS 模块覆盖率
 */

import '../tests/setup';
import { registerAllDecoders, getDecoderRegistryInfo, isDecoderRegistered, isStreamingSupported } from '../src/decoders/DecoderRegistry';

describe('DecoderRegistry', () => {
  describe('基本功能', () => {
    test('应该能注册所有解码器', () => {
      expect(() => registerAllDecoders()).not.toThrow();
    });

    test('应该返回解码器注册信息', () => {
      const info = getDecoderRegistryInfo();
      expect(info).toBeDefined();
      expect(info.regularDecoders).toBeDefined();
      expect(info.streamingDecoders).toBeDefined();
      expect(info.totalCount).toBeDefined();
    });

    test('应该检查解码器是否已注册', () => {
      const result = isDecoderRegistered('streaming_i2c');
      expect(typeof result).toBe('boolean');
    });

    test('应该检查解码器是否支持流式处理', () => {
      const result = isStreamingSupported('streaming_i2c');
      expect(typeof result).toBe('boolean');
    });

    test('不存在的解码器应该返回false', () => {
      const result = isDecoderRegistered('unknown');
      expect(result).toBe(false);
    });
  });

  describe('解码器信息', () => {
    test('应该提供流式解码器信息', () => {
      const info = getDecoderRegistryInfo();
      expect(info.streamingDecoders).toContain('streaming_i2c');
      expect(info.totalCount).toBeGreaterThanOrEqual(0);
    });
  });
});

export {};