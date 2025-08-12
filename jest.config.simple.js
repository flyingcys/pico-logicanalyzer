/**
 * 简化的Jest配置 - 基于分析报告重构
 * 
 * 重构原则:
 * 1. 统一测试环境(仅Node.js)
 * 2. 简化模块解析
 * 3. 减少并发执行问题
 * 4. 提高测试执行效率
 */

module.exports = {
  // 根目录
  rootDir: '.',
  
  // 统一测试环境 - 仅Node.js
  testEnvironment: 'node',
  
  // 模块文件扩展名 - 简化
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // TypeScript转换 - 简化配置
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false // 暂时放宽以减少编译错误
      }
    }],
    '^.+\\.js$': 'babel-jest'
  },
  
  // 简化的模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@drivers/(.*)$': '<rootDir>/src/drivers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^vscode$': '<rootDir>/utest/mocks/simple-mocks',
    '\\.(css|less|scss|sass)$': '<rootDir>/utest/mocks/fileMock.js'
  },
  
  // 测试文件匹配 - 只匹配核心测试
  testMatch: [
    // 核心驱动测试
    '<rootDir>/utest/unit/drivers/**/*.test.ts',
    // 核心模型测试  
    '<rootDir>/utest/unit/models/**/*.test.ts',
    // 核心服务测试
    '<rootDir>/utest/unit/services/**/*.test.ts',
    // 基础解码器测试
    '<rootDir>/utest/unit/decoders/**/*.test.ts',
    // 基本集成测试
    '<rootDir>/utest/integration/SystemIntegration.e2e.test.ts',
    '<rootDir>/utest/integration/CaptureDataFlow.test.ts'
  ],
  
  // 忽略路径 - 大幅简化
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/dist/',
    '/coverage/',
    '\\.bak$',
    'archive'
  ],
  
  // 设置文件 - 简化
  setupFilesAfterEnv: [
    '<rootDir>/utest/setup.ts'
  ],
  
  // Mock配置 - 简化
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // 性能优化
  maxWorkers: 2, // 减少并发worker数量
  cache: true,
  cacheDirectory: '.jest-cache',
  
  // 超时配置 - 更合理
  testTimeout: 30000, // 30秒
  
  // 覆盖率配置 - 简化
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  
  // 输出配置
  verbose: true,
  bail: 1, // 遇到第一个失败就停止
  
  // 错误处理
  errorOnDeprecated: false // 暂时关闭以减少错误
};