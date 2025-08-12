/**
 * Jest测试配置 - 多环境支持版本
 * 支持TypeScript、Vue组件、Node.js和浏览器环境测试
 */

// 共享的基础配置
const baseConfig = {
  // 根目录
  rootDir: '.',
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'vue'
  ],
  
  // 需要转换的文件
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        jsx: 'preserve',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.js$': 'babel-jest'
  },
  
  // 模块路径映射 - 与tsconfig.json保持一致
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@drivers/(.*)$': '<rootDir>/src/drivers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@components/(.*)$': '<rootDir>/src/webview/components/$1',
    '^@stores/(.*)$': '<rootDir>/src/webview/stores/$1',
    '^vscode$': '<rootDir>/utest/mocks/vscode.ts',
    '.*HardwareDriverManager$': '<rootDir>/utest/mocks/HardwareDriverManager.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/utest/mocks/styleMock.js'
  },
  
  // 测试设置文件
  setupFilesAfterEnv: [
    '<rootDir>/utest/setup.ts'
  ],
  
  // Mock配置
  clearMocks: true,
  restoreMocks: true,
  
  // 忽略的路径模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/.vscode-test/',
    '/utest/docs/',
    '.*archive.*'
  ],
  
  // 需要忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(element-plus|@element-plus|@vue)/)'
  ],
  
};

// 多项目配置 - 支持不同测试环境
module.exports = {
  projects: [
    // Node.js环境 - 用于后端代码、驱动、服务等测试
    {
      ...baseConfig,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/utest/unit/drivers/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/services/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/models/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/utils/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/decoders/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/database/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/tools/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/driver-sdk/**/*.{test,spec}.ts',
        '<rootDir>/utest/integration/**/*.{test,spec}.ts'
      ]
    },
    // JSDOM环境 - 用于前端代码、Vue组件等测试
    {
      ...baseConfig,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
        url: 'http://localhost',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      testMatch: [
        '<rootDir>/utest/unit/webview/**/*.{test,spec}.ts',
        '<rootDir>/utest/unit/extension/**/*.{test,spec}.ts'
      ],
    }
  ],
  
  // 其他全局配置
  maxWorkers: '50%',
  bail: false,
  cache: true,
  cacheDirectory: '.jest-cache',
  testTimeout: 10000
};