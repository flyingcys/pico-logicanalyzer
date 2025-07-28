/**
 * Jest全局测试设置
 * 配置全局的测试环境和Mock
 */

// 全局测试超时
jest.setTimeout(10000);

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 环境变量设置
process.env.NODE_ENV = 'test';
process.env.VSCODE_TEST_MODE = 'true';

// 全局Mock配置
global.console = {
  ...console,
  // 在测试中静默某些日志
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error
};

// Jest扩展匹配器
expect.extend({
  /**
   * 检查是否为有效的CaptureSession
   */
  toBeValidCaptureSession(received) {
    const pass = received &&
      typeof received.frequency === 'number' &&
      typeof received.preTriggerSamples === 'number' &&
      typeof received.postTriggerSamples === 'number' &&
      Array.isArray(received.captureChannels);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid CaptureSession`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid CaptureSession`,
        pass: false,
      };
    }
  },

  /**
   * 检查是否为有效的AnalyzerChannel
   */
  toBeValidAnalyzerChannel(received) {
    const pass = received &&
      typeof received.channelNumber === 'number' &&
      typeof received.channelName === 'string' &&
      typeof received.hidden === 'boolean';

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid AnalyzerChannel`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid AnalyzerChannel`,
        pass: false,
      };
    }
  }
});

// TypeScript声明扩展
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCaptureSession(): R;
      toBeValidAnalyzerChannel(): R;
    }
  }
}