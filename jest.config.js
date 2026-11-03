const commonTransform = {
  '^.+\\.vue$': '@vue/vue3-jest',
  '^.+\\.(ts|tsx)$': [
    'ts-jest',
    {
      tsconfig: '<rootDir>/tsconfig.jest.json',
      diagnostics: false
    }
  ]
};

const commonModuleFileExtensions = ['ts', 'tsx', 'js', 'json', 'vue'];

const commonPathIgnores = [
  '<rootDir>/node_modules/',
  '<rootDir>/out/',
  '<rootDir>/.worktree/'
];

module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/tests'],
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      testPathIgnorePatterns: [
        ...commonPathIgnores,
        '<rootDir>/tests/unit/webview/',
        // `tests/integration/webview/` 已于 2026-11-03 删除 —— 那是 12 个全 skip 的死测试
        // （按旧 API 写、解禁后 10/12 红）。见 docs/test-coverage-gaps-2026-11-03.md。
        // 这里保留 glob 也无意义（目录不存在），已清掉避免"配置指向不存在的东西"。
        '<rootDir>/tests/e2e/'
      ],
      moduleFileExtensions: commonModuleFileExtensions,
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
      transform: commonTransform,
      modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
      watchPathIgnorePatterns: ['<rootDir>/.worktree/']
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src', '<rootDir>/tests'],
      // 只匹配 unit/webview（integration/webview 已于 2026-11-03 删除，见上方注释）
      testMatch: ['<rootDir>/tests/unit/webview/**/*.test.ts'],
      testPathIgnorePatterns: commonPathIgnores,
      moduleFileExtensions: commonModuleFileExtensions,
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
        '^@utils/(.*)$': '<rootDir>/src/frontend/core/$1',
        '^vscode$': '<rootDir>/tests/fixtures/mocks/vscode.ts'
      },
      transform: commonTransform,
      modulePathIgnorePatterns: ['<rootDir>/.worktree/'],
      watchPathIgnorePatterns: ['<rootDir>/.worktree/']
    }
  ]
};
