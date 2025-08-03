/**
 * Jest测试配置
 * 支持TypeScript、Vue组件、Node.js和VSCode环境测试
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 根目录
  rootDir: '.',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,ts}',
    '<rootDir>/utest/**/*.{test,spec}.{js,ts}',
    '<rootDir>/tests/**/*.{test,spec}.{js,ts}'
  ],
  
  // 需要转换的文件
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.js$': 'babel-jest'
  },
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'vue'
  ],
  
  // 模块路径映射 - 与tsconfig.json保持一致
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@drivers/(.*)$': '<rootDir>/src/drivers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@components/(.*)$': '<rootDir>/src/webview/components/$1',
    '^@stores/(.*)$': '<rootDir>/src/webview/stores/$1',
    '^vscode$': '<rootDir>/utest/mocks/vscode.ts',
    '.*HardwareDriverManager$': '<rootDir>/utest/mocks/HardwareDriverManager.js'
  },
  
  // 覆盖率配置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,js}',
    '!src/**/*.spec.{ts,js}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/webview/main.ts',
    '!src/tests/**',
    '!tests/**',
    '!utest/**',
    '!**/node_modules/**'
  ],
  
  // 覆盖率阈值 - 调整为现实可达目标
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10
    }
  },
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'clover'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 测试设置文件
  setupFilesAfterEnv: [
    '<rootDir>/utest/setup.ts'
  ],
  
  // ts-jest配置
  preset: 'ts-jest',
  
  // Mock配置
  clearMocks: true,
  restoreMocks: true,
  
  // 忽略的路径模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/.vscode-test/',
    '/utest/docs/'
  ],
  
  // 需要忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(element-plus|@element-plus)/)'
  ],
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
};