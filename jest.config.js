module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'vue'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/fixtures/mocks/styleMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@drivers/(.*)$': '<rootDir>/src/drivers/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: false,
        isolatedModules: true
      }
    ],
    '^.+\\.vue$': '@vue/vue3-jest'
  },
  modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/out/', '<rootDir>/.worktree/']
};
