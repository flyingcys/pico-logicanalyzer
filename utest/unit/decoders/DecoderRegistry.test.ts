/**
 * DecoderRegistry.ts 单元测试
 * 测试解码器注册中心的所有功能
 */

import {
  registerAllDecoders,
  getDecoderRegistryInfo,
  isDecoderRegistered,
  isStreamingSupported
} from '../../../src/decoders/DecoderRegistry';
import { decoderManager } from '../../../src/decoders/DecoderManager';
import { StreamingI2CDecoder } from '../../../src/decoders/protocols/StreamingI2CDecoder';

// Mock dependencies
jest.mock('../../../src/decoders/DecoderManager');
jest.mock('../../../src/decoders/protocols/StreamingI2CDecoder');

// Mock console methods to avoid log output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('DecoderRegistry', () => {
  let mockDecoderManager: jest.Mocked<typeof decoderManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock decoder manager
    mockDecoderManager = decoderManager as jest.Mocked<typeof decoderManager>;
    
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('registerAllDecoders', () => {
    it('应该成功注册所有解码器', () => {
      // Mock successful registration
      mockDecoderManager.registerStreamingDecoder = jest.fn();
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 0,
        registeredStreamingDecoders: 1,
        availableDecoders: 1
      });

      expect(() => registerAllDecoders()).not.toThrow();

      // 验证调用了注册方法
      expect(mockDecoderManager.registerStreamingDecoder).toHaveBeenCalledWith(
        'streaming_i2c',
        StreamingI2CDecoder
      );

      // 验证调用了统计方法
      expect(mockDecoderManager.getStatistics).toHaveBeenCalled();

      // 验证日志输出
      expect(console.log).toHaveBeenCalledWith('📋 开始注册解码器...');
      expect(console.log).toHaveBeenCalledWith('✅ 流式解码器注册完成:');
      expect(console.log).toHaveBeenCalledWith('  - I²C 流式解码器 (streaming_i2c)');
      expect(console.log).toHaveBeenCalledWith('📊 解码器注册统计:');
      expect(console.log).toHaveBeenCalledWith('  - 常规解码器: 0个');
      expect(console.log).toHaveBeenCalledWith('  - 流式解码器: 1个');
      expect(console.log).toHaveBeenCalledWith('  - 可用解码器总数: 1个');
    });

    it('应该正确显示统计信息', () => {
      mockDecoderManager.registerStreamingDecoder = jest.fn();
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 5,
        registeredStreamingDecoders: 3,
        availableDecoders: 8
      });

      registerAllDecoders();

      expect(console.log).toHaveBeenCalledWith('  - 常规解码器: 5个');
      expect(console.log).toHaveBeenCalledWith('  - 流式解码器: 3个');
      expect(console.log).toHaveBeenCalledWith('  - 可用解码器总数: 8个');
    });

    it('应该处理注册过程中的错误', () => {
      const testError = new Error('注册失败');
      mockDecoderManager.registerStreamingDecoder = jest.fn().mockImplementation(() => {
        throw testError;
      });

      expect(() => registerAllDecoders()).toThrow(testError);

      expect(console.error).toHaveBeenCalledWith('❌ 解码器注册失败:', testError);
    });

    it('应该处理getStatistics抛出的错误', () => {
      mockDecoderManager.registerStreamingDecoder = jest.fn();
      const statsError = new Error('获取统计信息失败');
      mockDecoderManager.getStatistics = jest.fn().mockImplementation(() => {
        throw statsError;
      });

      expect(() => registerAllDecoders()).toThrow(statsError);

      expect(console.error).toHaveBeenCalledWith('❌ 解码器注册失败:', statsError);
    });

    it('应该按正确顺序执行注册流程', () => {
      const registerSpy = jest.fn();
      const getStatsSpy = jest.fn().mockReturnValue({
        registeredDecoders: 0,
        registeredStreamingDecoders: 1,
        availableDecoders: 1
      });

      mockDecoderManager.registerStreamingDecoder = registerSpy;
      mockDecoderManager.getStatistics = getStatsSpy;

      registerAllDecoders();

      // 验证方法都被调用了
      expect(registerSpy).toHaveBeenCalled();
      expect(getStatsSpy).toHaveBeenCalled();
    });
  });

  describe('getDecoderRegistryInfo', () => {
    it('应该返回正确的注册信息', () => {
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 3,
        registeredStreamingDecoders: 2,
        availableDecoders: 5
      });

      const info = getDecoderRegistryInfo();

      expect(info.regularDecoders).toEqual([]);
      expect(info.streamingDecoders).toEqual(['streaming_i2c']);
      expect(info.totalCount).toBe(5); // registeredDecoders + registeredStreamingDecoders
    });

    it('应该处理零解码器的情况', () => {
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 0,
        registeredStreamingDecoders: 0,
        availableDecoders: 0
      });

      const info = getDecoderRegistryInfo();

      expect(info.regularDecoders).toEqual([]);
      expect(info.streamingDecoders).toEqual(['streaming_i2c']); // 硬编码的列表
      expect(info.totalCount).toBe(0);
    });

    it('应该正确计算总数', () => {
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 10,
        registeredStreamingDecoders: 5,
        availableDecoders: 15
      });

      const info = getDecoderRegistryInfo();

      expect(info.totalCount).toBe(15); // 应该使用 registeredDecoders + registeredStreamingDecoders
    });

    it('应该处理getStatistics抛出的错误', () => {
      mockDecoderManager.getStatistics = jest.fn().mockImplementation(() => {
        throw new Error('统计信息获取失败');
      });

      expect(() => getDecoderRegistryInfo()).toThrow('统计信息获取失败');
    });

    it('应该返回包含预定义流式解码器的列表', () => {
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 0,
        registeredStreamingDecoders: 0,
        availableDecoders: 0
      });

      const info = getDecoderRegistryInfo();

      // 即使没有注册任何解码器，也应该返回预定义的流式解码器列表
      expect(info.streamingDecoders).toContain('streaming_i2c');
      expect(info.streamingDecoders).toHaveLength(1);
    });
  });

  describe('isDecoderRegistered', () => {
    it('应该检测已注册的常规解码器', () => {
      const mockDecoder = { id: 'test-decoder', name: 'Test Decoder' };
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(mockDecoder);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      const result = isDecoderRegistered('test-decoder');

      expect(result).toBe(true);
      expect(mockDecoderManager.getDecoder).toHaveBeenCalledWith('test-decoder');
      expect(mockDecoderManager.getStreamingDecoder).toHaveBeenCalledWith('test-decoder');
    });

    it('应该检测已注册的流式解码器', () => {
      const mockStreamingDecoder = { id: 'streaming-decoder', name: 'Streaming Decoder' };
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(mockStreamingDecoder);

      const result = isDecoderRegistered('streaming-decoder');

      expect(result).toBe(true);
      expect(mockDecoderManager.getDecoder).toHaveBeenCalledWith('streaming-decoder');
      expect(mockDecoderManager.getStreamingDecoder).toHaveBeenCalledWith('streaming-decoder');
    });

    it('应该检测未注册的解码器', () => {
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      const result = isDecoderRegistered('unregistered-decoder');

      expect(result).toBe(false);
    });

    it('应该处理getDecoder抛出的异常', () => {
      mockDecoderManager.getDecoder = jest.fn().mockImplementation(() => {
        throw new Error('Decoder not found');
      });
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      const result = isDecoderRegistered('error-decoder');

      expect(result).toBe(false);
    });

    it('应该处理getStreamingDecoder抛出的异常', () => {
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockImplementation(() => {
        throw new Error('Streaming decoder not found');
      });

      const result = isDecoderRegistered('error-streaming-decoder');

      expect(result).toBe(false);
    });

    it('应该处理两个方法都抛出异常的情况', () => {
      mockDecoderManager.getDecoder = jest.fn().mockImplementation(() => {
        throw new Error('Decoder error');
      });
      mockDecoderManager.getStreamingDecoder = jest.fn().mockImplementation(() => {
        throw new Error('Streaming decoder error');
      });

      const result = isDecoderRegistered('double-error-decoder');

      expect(result).toBe(false);
    });

    it('应该处理空字符串解码器ID', () => {
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      const result = isDecoderRegistered('');

      expect(result).toBe(false);
      expect(mockDecoderManager.getDecoder).toHaveBeenCalledWith('');
      expect(mockDecoderManager.getStreamingDecoder).toHaveBeenCalledWith('');
    });

    it('应该处理包含特殊字符的解码器ID', () => {
      const specialId = 'decoder@#$%^&*()';
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      const result = isDecoderRegistered(specialId);

      expect(result).toBe(false);
      expect(mockDecoderManager.getDecoder).toHaveBeenCalledWith(specialId);
    });
  });

  describe('isStreamingSupported', () => {
    it('应该检测支持流式处理的解码器', () => {
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(true);

      const result = isStreamingSupported('streaming-decoder');

      expect(result).toBe(true);
      expect(mockDecoderManager.isStreamingSupported).toHaveBeenCalledWith('streaming-decoder');
    });

    it('应该检测不支持流式处理的解码器', () => {
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(false);

      const result = isStreamingSupported('regular-decoder');

      expect(result).toBe(false);
      expect(mockDecoderManager.isStreamingSupported).toHaveBeenCalledWith('regular-decoder');
    });

    it('应该处理未知解码器', () => {
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(false);

      const result = isStreamingSupported('unknown-decoder');

      expect(result).toBe(false);
    });

    it('应该处理isStreamingSupported抛出的异常', () => {
      mockDecoderManager.isStreamingSupported = jest.fn().mockImplementation(() => {
        throw new Error('Streaming support check failed');
      });

      // 函数应该抛出异常，因为它没有try-catch包装
      expect(() => isStreamingSupported('error-decoder')).toThrow('Streaming support check failed');
    });

    it('应该处理空字符串解码器ID', () => {
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(false);

      const result = isStreamingSupported('');

      expect(result).toBe(false);
      expect(mockDecoderManager.isStreamingSupported).toHaveBeenCalledWith('');
    });

    it('应该正确传递解码器ID参数', () => {
      const testId = 'test-streaming-decoder';
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(true);

      isStreamingSupported(testId);

      expect(mockDecoderManager.isStreamingSupported).toHaveBeenCalledWith(testId);
      expect(mockDecoderManager.isStreamingSupported).toHaveBeenCalledTimes(1);
    });
  });

  describe('集成测试', () => {
    it('应该正确处理完整的注册和查询流程', () => {
      // 模拟注册流程
      mockDecoderManager.registerStreamingDecoder = jest.fn();
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 0,
        registeredStreamingDecoders: 1,
        availableDecoders: 1
      });

      // 执行注册
      registerAllDecoders();

      // 模拟查询流程
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue({
        id: 'streaming_i2c',
        name: 'I2C Streaming Decoder'
      });
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(true);

      // 验证查询结果
      expect(isDecoderRegistered('streaming_i2c')).toBe(true);
      expect(isStreamingSupported('streaming_i2c')).toBe(true);

      const info = getDecoderRegistryInfo();
      expect(info.streamingDecoders).toContain('streaming_i2c');
      expect(info.totalCount).toBe(1);
    });

    it('应该处理注册失败后的查询', () => {
      // 模拟注册失败
      mockDecoderManager.registerStreamingDecoder = jest.fn().mockImplementation(() => {
        throw new Error('Registration failed');
      });

      expect(() => registerAllDecoders()).toThrow('Registration failed');

      // 即使注册失败，查询功能仍应正常工作
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      expect(isDecoderRegistered('streaming_i2c')).toBe(false);
    });

    it('应该处理部分功能失败的情况', () => {
      // 模拟成功注册
      mockDecoderManager.registerStreamingDecoder = jest.fn();
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: 0,
        registeredStreamingDecoders: 1,
        availableDecoders: 1
      });

      registerAllDecoders();

      // 模拟查询功能部分失败
      mockDecoderManager.getDecoder = jest.fn().mockImplementation(() => {
        throw new Error('Query failed');
      });
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);

      // isDecoderRegistered 应该捕获异常并返回 false
      expect(isDecoderRegistered('streaming_i2c')).toBe(false);

      // getDecoderRegistryInfo 仍应正常工作
      const info = getDecoderRegistryInfo();
      expect(info).toBeDefined();
      expect(info.totalCount).toBe(1);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理极长的解码器ID', () => {
      const longId = 'a'.repeat(10000);
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(false);

      expect(isDecoderRegistered(longId)).toBe(false);
      expect(isStreamingSupported(longId)).toBe(false);
    });

    it('应该处理包含Unicode字符的解码器ID', () => {
      const unicodeId = '解码器-测试-🔍';
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(false);

      expect(isDecoderRegistered(unicodeId)).toBe(false);
      expect(isStreamingSupported(unicodeId)).toBe(false);
    });

    it('应该处理undefined和null参数', () => {
      mockDecoderManager.getDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.getStreamingDecoder = jest.fn().mockReturnValue(null);
      mockDecoderManager.isStreamingSupported = jest.fn().mockReturnValue(false);

      // 这些调用可能会导致类型错误，但函数应该能处理
      expect(isDecoderRegistered(null as any)).toBe(false);
      expect(isDecoderRegistered(undefined as any)).toBe(false);
      expect(isStreamingSupported(null as any)).toBe(false);
      expect(isStreamingSupported(undefined as any)).toBe(false);
    });

    it('应该处理统计数据异常值', () => {
      mockDecoderManager.getStatistics = jest.fn().mockReturnValue({
        registeredDecoders: -1,
        registeredStreamingDecoders: NaN,
        availableDecoders: Infinity
      });

      const info = getDecoderRegistryInfo();
      expect(info.totalCount).toBeNaN(); // -1 + NaN = NaN
    });
  });
});