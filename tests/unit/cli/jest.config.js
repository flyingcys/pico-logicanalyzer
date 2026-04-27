module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../../../',
  testMatch: ['<rootDir>/tests/unit/cli/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false
    }]
  },
  modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
  testPathIgnorePatterns: ['<rootDir>/.worktree/'],
  watchPathIgnorePatterns: ['<rootDir>/.worktree/']
};
