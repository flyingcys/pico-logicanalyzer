/**
 * Prettier代码格式化配置
 * 与ESLint配置保持一致，确保代码风格统一
 */

module.exports = {
  // 基本格式配置
  semi: true,                    // 语句末尾添加分号
  singleQuote: true,            // 使用单引号
  quoteProps: 'as-needed',      // 仅在需要时给对象属性加引号
  trailingComma: 'none',        // 不添加尾随逗号
  
  // 缩进和空格
  tabWidth: 2,                  // 2个空格缩进
  useTabs: false,               // 使用空格而不是tab
  
  // 换行配置
  printWidth: 100,              // 行长度限制100字符
  endOfLine: 'lf',              // 使用LF换行符
  
  // 对象和数组格式
  bracketSpacing: true,         // 对象字面量大括号内添加空格 { foo: bar }
  bracketSameLine: false,       // 多行JSX元素的>放在下一行
  
  // 箭头函数参数
  arrowParens: 'avoid',         // 单参数箭头函数不使用括号
  
  // Vue文件特定配置
  vueIndentScriptAndStyle: true, // Vue文件中缩进<script>和<style>标签
  
  // 文件类型覆盖配置
  overrides: [
    // TypeScript文件
    {
      files: '*.ts',
      options: {
        parser: 'typescript',
        printWidth: 100
      }
    },
    
    // Vue文件
    {
      files: '*.vue',
      options: {
        parser: 'vue',
        printWidth: 100,
        singleQuote: true,
        semi: true
      }
    },
    
    // JSON文件
    {
      files: ['*.json', '.prettierrc', '.eslintrc'],
      options: {
        parser: 'json',
        printWidth: 100,
        tabWidth: 2
      }
    },
    
    // Markdown文件
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'preserve',
        tabWidth: 2
      }
    },
    
    // 配置文件
    {
      files: [
        'webpack.config.js',
        'jest.config.js',
        '.eslintrc.js',
        '.prettierrc.js'
      ],
      options: {
        parser: 'babel',
        printWidth: 100,
        singleQuote: true,
        semi: true
      }
    },
    
    // 包配置文件
    {
      files: 'package.json',
      options: {
        parser: 'json-stringify',
        printWidth: 100,
        tabWidth: 2
      }
    },
    
    // TypeScript声明文件
    {
      files: '*.d.ts',
      options: {
        parser: 'typescript',
        printWidth: 120 // 类型声明可以稍长一些
      }
    }
  ],
  
  // 插件配置
  plugins: [
    // 'prettier-plugin-organize-imports' // 如果需要自动整理import语句
  ]
};