module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'vue'],
  setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/fixtures/mocks/styleMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@drivers/(.*)$': '<rootDir>/src/drivers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@frontend/(.*)$': '<rootDir>/src/frontend/$1',
    '^@frontend-app/(.*)$': '<rootDir>/src/frontend/app/$1',
    '^@frontend-core/(.*)$': '<rootDir>/src/frontend/core/$1',
    '^@frontend-platform/(.*)$': '<rootDir>/src/frontend/platform/$1',
    '^@frontend-shared/(.*)$': '<rootDir>/src/frontend/shared/$1',
    '^@components/(.*)$': '<rootDir>/src/frontend/app/components/$1',
    '^@stores/(.*)$': '<rootDir>/src/frontend/core/stores/$1',
    '^vscode$': '<rootDir>/tests/fixtures/mocks/vscode.ts'
  },
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
        diagnostics: false
      }
    ]
  },
  modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/.worktree/'],
  watchPathIgnorePatterns: ['<rootDir>/.worktree/'],

  // 覆盖率采集范围：剔除非产品代码（自检脚本/模板/示例/测试工具/纯类型声明）
  // 详见 docs/覆盖率门禁配置建议.md
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*-self-test.ts',
    '!src/**/test-*-integration.ts',
    '!src/driver-sdk/templates/**',
    '!src/driver-sdk/examples/**',
    '!src/driver-sdk/testing/**',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/types/**',
    '!src/**/*.d.ts'
  ],

  // 覆盖率门禁：仅锁定已有稳定测试的关键解析/解码路径。
  // 遗留模块覆盖率差异很大，不用低全局值伪装为质量门禁。
  coverageThreshold: {
    './src/models/LACFileFormat.ts': {
      branches: 34,
      functions: 35,
      lines: 40,
      statements: 40
    },
    './src/decoders/protocols/I2CDecoder.ts': {
      branches: 55,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/decoders/protocols/SPIDecoder.ts': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // 以下为补齐行为测试后新增的关键路径阈值（Task 2/3）
    './src/decoders/ChannelMapping.ts': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/frontend/app/main-html.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/frontend/app/main-vscode.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  }
};
