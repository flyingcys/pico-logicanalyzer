/**
 * DecoderManager 清理路径测试
 *
 * 测试目标：stopDecoder / stopAllStreamingTasks / dispose 在 decoder.stop() 或
 * 实例 dispose() 抛错时，仍能清理任务表与实例缓存——不残留任务条目，
 * 不因单个失败吞掉其他 decoder 的清理。
 *
 * 这些测试最初以失败用例驱动修复了 stopDecoder 的资源残留 bug（delete 原在 try
 * 块内导致 stop() 抛错时任务残留且原始错误被吞），现已把 delete 移入 finally
 * 并上抛原始错误；本文件作为该契约的回归保护。
 */

import { DecoderManager } from '../../../src/decoders/DecoderManager';

describe('DecoderManager 清理路径', () => {
  let manager: DecoderManager;

  beforeEach(() => {
    manager = new DecoderManager();
  });

  afterEach(() => {
    // dispose 内部对每个 decoder 吞错，安全调用
    manager.dispose();
  });

  /** 构造一个 stop() 抛错的假 streaming decoder */
  function makeThrowingDecoder(stopError = 'stop failed') {
    return {
      stop: jest.fn(() => {
        throw new Error(stopError);
      }),
      onProgress: undefined,
      onPartialResult: undefined
    } as any;
  }

  /** 构造一个 stop() 成功的假 streaming decoder */
  function makeOkDecoder() {
    return {
      stop: jest.fn(),
      onProgress: undefined,
      onPartialResult: undefined
    } as any;
  }

  describe('stopDecoder 清理保证', () => {
    it('decoder.stop() 抛错时仍清理任务条目，并向上传播原始错误', () => {
      const decoder = makeThrowingDecoder('stop failed');
      // 直接注入到 activeStreamingTasks（绕过 executeStreamingDecoder 的异步路径）
      (manager as any).activeStreamingTasks.set('test_task_1', decoder);

      // 修复后：原始错误上抛（不再被 console.error 吞掉）
      expect(() => manager.stopDecoder('test')).toThrow('stop failed');
      // 关键断言：失败也必须清理任务条目，不残留
      expect(manager.getActiveDecoders()).not.toContain('test_task_1');
      expect(manager.getActiveStreamingTaskCount()).toBe(0);
      expect(decoder.stop).toHaveBeenCalledTimes(1);
    });

    it('decoder.stop() 成功时清理任务条目并返回 true', () => {
      const decoder = makeOkDecoder();
      (manager as any).activeStreamingTasks.set('ok_task_1', decoder);

      const stopped = manager.stopDecoder('ok');

      expect(stopped).toBe(true);
      expect(decoder.stop).toHaveBeenCalledTimes(1);
      expect(manager.getActiveDecoders()).not.toContain('ok_task_1');
    });

    it('未注册的 decoderId 返回 false 且不抛错', () => {
      expect(manager.stopDecoder('nonexistent')).toBe(false);
      expect(manager.getActiveStreamingTaskCount()).toBe(0);
    });
  });

  describe('stopAllStreamingTasks 批量清理保证', () => {
    it('单个 decoder.stop() 抛错时仍清理所有任务（吞错不中断）', () => {
      const throwingDecoder = makeThrowingDecoder('stop failed');
      const okDecoder = makeOkDecoder();
      (manager as any).activeStreamingTasks.set('task_a', throwingDecoder);
      (manager as any).activeStreamingTasks.set('task_b', okDecoder);

      // stopAllStreamingTasks 设计为批量清理，吞错不向上抛
      expect(() => manager.stopAllStreamingTasks()).not.toThrow();

      // 所有任务都被清理（即便某个 decoder.stop 失败）
      expect(manager.getActiveDecoders()).toHaveLength(0);
      expect(manager.getActiveStreamingTaskCount()).toBe(0);
      // 两个 decoder.stop() 都被调用（错误不中断循环）
      expect(throwingDecoder.stop).toHaveBeenCalledTimes(1);
      expect(okDecoder.stop).toHaveBeenCalledTimes(1);
    });

    it('无任务时调用安全且无副作用', () => {
      expect(() => manager.stopAllStreamingTasks()).not.toThrow();
      expect(manager.getActiveStreamingTaskCount()).toBe(0);
    });
  });

  describe('dispose 清理保证', () => {
    it('常规 decoder 实例 dispose() 抛错时仍清理全部 map，不二次抛出', () => {
      const throwingInstance = {
        dispose: jest.fn(() => {
          throw new Error('dispose failed');
        })
      } as any;
      const okInstance = {
        dispose: jest.fn()
      } as any;

      (manager as any).decoderInstances.set('throwing', throwingInstance);
      (manager as any).decoderInstances.set('ok', okInstance);
      // 同时注入一个活跃任务（stop 也会抛错）
      const activeDecoder = makeThrowingDecoder('active stop failed');
      (manager as any).activeStreamingTasks.set('active_1', activeDecoder);

      // dispose 不应向上抛出（每个实例独立 try/catch）
      expect(() => manager.dispose()).not.toThrow();

      // 所有 map 都被清理
      expect(manager.getActiveDecoders()).toHaveLength(0);
      expect((manager as any).decoderInstances.size).toBe(0);
      expect((manager as any).streamingDecoderInstances.size).toBe(0);
      // 两个 dispose 都被调用（即便第一个抛错）
      expect(throwingInstance.dispose).toHaveBeenCalledTimes(1);
      expect(okInstance.dispose).toHaveBeenCalledTimes(1);
    });

    it('streaming decoder 实例 dispose() 抛错时仍清理缓存', () => {
      const throwingStreaming = {
        dispose: jest.fn(() => {
          throw new Error('streaming dispose failed');
        })
      } as any;
      const okStreaming = {
        dispose: jest.fn()
      } as any;

      (manager as any).streamingDecoderInstances.set('s_throw', throwingStreaming);
      (manager as any).streamingDecoderInstances.set('s_ok', okStreaming);

      expect(() => manager.dispose()).not.toThrow();

      expect((manager as any).streamingDecoderInstances.size).toBe(0);
      expect(throwingStreaming.dispose).toHaveBeenCalledTimes(1);
      expect(okStreaming.dispose).toHaveBeenCalledTimes(1);
    });

    it('dispose 后再次 stopDecoder / stopAllStreamingTasks 安全', () => {
      const decoder = makeOkDecoder();
      (manager as any).activeStreamingTasks.set('survivor_1', decoder);

      manager.dispose();

      // dispose 已 clear，后续调用应无副作用、不抛错
      expect(() => manager.stopDecoder('survivor')).not.toThrow();
      expect(() => manager.stopAllStreamingTasks()).not.toThrow();
      expect(manager.getActiveStreamingTaskCount()).toBe(0);
    });
  });
});
