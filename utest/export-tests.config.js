/**
 * 数据导出功能测试专用Jest配置
 * Week 12: 数据导出功能实现 - 测试配置
 */

module.exports = {
  // 基于主配置扩展
  ...require('../jest.config.js'),
  
  // 测试匹配模式 - 只运行导出相关测试
  testMatch: [
    '**/tests/**/DataExportService.test.ts',
    '**/tests/**/ExportPerformanceOptimizer.test.ts', 
    '**/tests/**/DataExportIntegration.test.ts',
    '**/tests/**/DataExportE2E.test.ts',
    '**/tests/**/data-export-service.test.ts'
  ],
  
  // 测试环境设置
  testEnvironment: 'node',
  
  // 超时设置 - 导出测试可能需要更长时间
  testTimeout: 60000, // 60秒
  
  // 覆盖率设置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/DataExportService.ts',
    'src/services/ExportPerformanceOptimizer.ts',
    'src/webview/components/DataExporter.vue',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  
  // 覆盖率报告
  coverageReporters: [
    'text',
    'text-summary', 
    'html',
    'lcov',
    'json-summary'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'src/services/DataExportService.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/services/ExportPerformanceOptimizer.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/setup-export-tests.ts'
  ],
  
  // 模块映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 转换配置
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.vue$': '@vue/vue3-jest'
  },
  
  // 忽略的转换模式
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  
  // 全局变量
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        target: 'es2020',
        module: 'esnext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true
      }
    }
  },
  
  // 测试结果处理器
  testResultsProcessor: '<rootDir>/tests/scripts/export-test-processor.js',
  
  // 性能测试标记
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    PERFORMANCE_TESTING: 'true'
  },
  
  // 并发配置
  maxConcurrency: 4, // 限制并发数以避免内存问题
  maxWorkers: 2,     // 限制worker数量
  
  // 详细输出
  verbose: true,
  
  // 错误处理
  errorOnDeprecated: true,
  
  // 快照配置
  updateSnapshot: false,
  
  // 缓存配置
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  
  // 报告器配置
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './tests/temp/export-test-report',
        filename: 'export-test-report.html',
        openReport: false,
        pageTitle: 'Data Export Tests Report',
        logoImgPath: undefined,
        hideIcon: false
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './tests/temp',
        outputName: 'export-test-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ]
};