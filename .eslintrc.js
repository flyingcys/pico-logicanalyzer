/**
 * ESLint配置
 * 支持TypeScript、Vue、Jest的代码质量检查
 */

module.exports = {
  root: true,
  
  // 环境配置
  env: {
    browser: true,
    node: true,
    es2020: true,
    jest: true
  },
  
  // 全局变量
  globals: {
    acquireVsCodeApi: 'readonly',
    process: 'readonly',
    Buffer: 'readonly'
  },
  
  // 解析器配置
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
    extraFileExtensions: ['.vue']
  },
  
  // 插件
  plugins: [
    '@typescript-eslint',
    'vue'
  ],
  
  // 扩展配置
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended'
  ],
  
  // 规则配置
  rules: {
    // TypeScript 相关规则 (基础)
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    
    // Vue 相关规则
    'vue/no-unused-vars': 'error',
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',
    'vue/require-default-prop': 'off',
    'vue/require-explicit-emits': 'error',
    'vue/no-unused-components': 'warn',
    'vue/no-mutating-props': 'error',
    'vue/component-tags-order': ['error', {
      order: ['script', 'template', 'style']
    }],
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/prop-name-casing': ['error', 'camelCase'],
    'vue/attribute-hyphenation': ['error', 'always'],
    'vue/v-on-event-hyphenation': ['error', 'always'],
    
    // 通用规则
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'object-shorthand': 'error',
    'prefer-destructuring': ['error', {
      array: false,
      object: true
    }],
    'no-useless-concat': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',
    'no-duplicate-imports': 'error',
    'import/no-duplicates': 'off', // 使用no-duplicate-imports替代
    
    // 代码风格
    'indent': 'off', // 交给prettier处理
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'eol-last': 'error',
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    
    // 安全相关
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // 性能相关
    'no-loop-func': 'error',
    'no-inner-declarations': 'error'
  },
  
  // 覆盖配置
  overrides: [
    // 测试文件
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    },
    
    // Vue文件
    {
      files: ['**/*.vue'],
      rules: {
        'no-console': 'off' // Vue组件可能需要调试输出
      }
    },
    
    // 配置文件
    {
      files: [
        'webpack.config.js',
        'jest.config.js',
        '.eslintrc.js',
        'babel.config.js'
      ],
      env: {
        node: true
      }
    },
    
    // 类型定义文件
    {
      files: ['**/*.d.ts'],
      rules: {
        'no-unused-vars': 'off'
      }
    }
  ],
  
  // 忽略模式
  ignorePatterns: [
    'out/',
    'dist/',
    'coverage/',
    'node_modules/',
    '*.min.js',
    '*.bundle.js'
  ]
};