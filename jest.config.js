module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'vue'],
  setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: true,
        isolatedModules: false
      }
    ]
  },
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
  modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/.worktree/']
};
