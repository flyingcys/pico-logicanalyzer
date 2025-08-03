/**
 * Jest配置 - WebView渲染器测试专用
 * 使用JSDOM环境支持DOM操作
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/utest/setup.ts'
  ],
  testMatch: [
    '<rootDir>/utest/unit/webview/engines/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/webview/engines/**/*.ts',
    '!src/webview/engines/**/*.d.ts',
    '!src/webview/engines/**/index.ts'
  ]
};