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
    '<rootDir>/src/**/*.{test,spec}.{js,ts}',
    '<rootDir>/test/**/*.{test,spec}.{js,ts}'
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
    '^@stores/(.*)$': '<rootDir>/src/webview/stores/$1'
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
    '!**/node_modules/**'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // 关键模块的更高要求
    './src/drivers/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/models/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
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
    '<rootDir>/test/setup.ts'
  ],
  
  // 全局设置
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        target: 'ES2020',
        module: 'ESNext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      }
    }
  },
  
  // Mock配置
  clearMocks: true,
  restoreMocks: true,
  
  // 忽略的路径模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/.vscode-test/'
  ],
  
  // 需要忽略转换的模块
  transformIgnorePatterns: [
    'node_modules/(?!(element-plus|@element-plus)/)'
  ],
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
  
  // 多项目配置
  projects: [
    // Node.js环境测试（Extension）
    {
      displayName: 'Extension Tests',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/drivers/**/*.{test,spec}.ts',
        '<rootDir>/src/models/**/*.{test,spec}.ts',
        '<rootDir>/src/commands/**/*.{test,spec}.ts',
        '<rootDir>/src/providers/**/*.{test,spec}.ts'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/test/setup-node.ts'
      ]
    },
    
    // JSDOM环境测试（Webview）
    {
      displayName: 'Webview Tests',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/src/webview/**/*.{test,spec}.ts'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/test/setup-vue.ts'
      ],
      transform: {
        '^.+\\.vue$': '@vue/vue3-jest',
        '^.+\\.ts$': 'ts-jest'
      }
    },
    
    // 集成测试
    {
      displayName: 'Integration Tests',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/test/integration/**/*.{test,spec}.ts'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/test/setup-integration.ts'
      ],
      testTimeout: 30000
    }
  ]
};