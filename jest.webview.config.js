module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/unit/webview/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'vue'],
  setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.webview.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/fixtures/mocks/styleMock.js',
    '^@/(.*)$': '<rootDir>/src/frontend/$1',
    '^@frontend/(.*)$': '<rootDir>/src/frontend/$1',
    '^@frontend-app/(.*)$': '<rootDir>/src/frontend/app/$1',
    '^@frontend-core/(.*)$': '<rootDir>/src/frontend/core/$1',
    '^@frontend-platform/(.*)$': '<rootDir>/src/frontend/platform/$1',
    '^@frontend-shared/(.*)$': '<rootDir>/src/frontend/shared/$1',
    '^@components/(.*)$': '<rootDir>/src/frontend/app/components/$1',
    '^@stores/(.*)$': '<rootDir>/src/frontend/core/stores/$1',
    '^@drivers/(.*)$': '<rootDir>/src/drivers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@utils/(.*)$': '<rootDir>/src/frontend/core/$1'
  },
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: false,
        isolatedModules: true
      }
    ]
  },
  modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/.worktree/']
};
