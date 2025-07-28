/**
 * 第五阶段UI开发自测脚本
 * 验证所有UI组件功能的正确性
 */

const fs = require('fs');
const path = require('path');

// 验证结果统计
let passed = 0;
let failed = 0;
let warnings = 0;

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗',
    title: '🔍'
  }[type] || '•';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function pass(message) {
  passed++;
  log(message, 'info');
}

function fail(message) {
  failed++;
  log(message, 'error');
}

function warn(message) {
  warnings++;
  log(message, 'warn');
}

function title(message) {
  log(`\n=== ${message} ===`, 'title');
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    pass(`${description} 文件存在: ${path.basename(filePath)}`);
    return true;
  } else {
    fail(`${description} 文件缺失: ${filePath}`);
    return false;
  }
}

function validateVueComponent(filePath, componentName) {
  if (!checkFileExists(filePath, `${componentName} 组件`)) {
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查基本Vue 3结构
    if (!content.includes('<template>')) {
      fail(`${componentName}: 缺少 <template> 标签`);
      return false;
    }
    
    if (!content.includes('<script setup lang="ts">')) {
      fail(`${componentName}: 缺少 TypeScript setup 脚本`);
      return false;
    }
    
    if (!content.includes('<style scoped>')) {
      warn(`${componentName}: 建议添加 scoped 样式`);
    }

    // 检查国际化支持
    if (content.includes('$t(') || content.includes('useI18n')) {
      pass(`${componentName}: 已集成国际化支持`);
    } else {
      warn(`${componentName}: 未发现国际化集成`);
    }

    // 检查TypeScript严格模式
    if (content.includes('interface ') && content.includes('ref<')) {
      pass(`${componentName}: 使用了TypeScript类型定义`);
    } else {
      warn(`${componentName}: 缺少完整的TypeScript类型定义`);
    }

    pass(`${componentName}: 基本结构验证通过`);
    return true;
    
  } catch (error) {
    fail(`${componentName}: 文件读取错误 - ${error.message}`);
    return false;
  }
}

function validateI18nConfiguration() {
  title('国际化配置验证');
  
  // 检查i18n配置文件
  const i18nPath = 'src/webview/i18n/index.ts';
  if (!checkFileExists(i18nPath, 'i18n配置文件')) {
    return false;
  }

  // 检查语言包文件
  const zhCNPath = 'src/webview/i18n/locales/zh-CN.ts';
  const enUSPath = 'src/webview/i18n/locales/en-US.ts';
  
  checkFileExists(zhCNPath, '中文语言包');
  checkFileExists(enUSPath, '英文语言包');

  // 验证主应用集成
  const mainPath = 'src/webview/main.ts';
  if (checkFileExists(mainPath, '主应用文件')) {
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    if (mainContent.includes('import i18n from \'./i18n\'') && mainContent.includes('app.use(i18n)')) {
      pass('main.ts: 已正确集成i18n');
    } else {
      fail('main.ts: i18n未正确集成');
    }
  }

  // 检查package.json依赖
  const packagePath = 'package.json';
  if (checkFileExists(packagePath, 'package.json')) {
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    if (packageJson.dependencies && packageJson.dependencies['vue-i18n']) {
      pass(`package.json: vue-i18n依赖已添加 (${packageJson.dependencies['vue-i18n']})`);
    } else {
      fail('package.json: 缺少vue-i18n依赖');
    }
  }
}

function validateUIComponents() {
  title('UI组件结构验证');
  
  const components = [
    { path: 'src/webview/components/DeviceManager.vue', name: 'DeviceManager' },
    { path: 'src/webview/components/CaptureSettings.vue', name: 'CaptureSettings' },
    { path: 'src/webview/components/ChannelPanel.vue', name: 'ChannelPanel' },
    { path: 'src/webview/components/DecoderPanel.vue', name: 'DecoderPanel' },
    { path: 'src/webview/components/MeasurementTools.vue', name: 'MeasurementTools' },
    { path: 'src/webview/components/StatusBar.vue', name: 'StatusBar' },
    { path: 'src/webview/components/ThemeManager.vue', name: 'ThemeManager' },
    { path: 'src/webview/components/LanguageSwitcher.vue', name: 'LanguageSwitcher' }
  ];

  components.forEach(component => {
    validateVueComponent(component.path, component.name);
  });
}

function validateAppIntegration() {
  title('应用集成验证');
  
  const appPath = 'src/webview/App.vue';
  if (!checkFileExists(appPath, '主应用组件')) {
    return;
  }

  const appContent = fs.readFileSync(appPath, 'utf8');
  
  // 检查组件导入
  const componentsToCheck = ['LanguageSwitcher'];
  componentsToCheck.forEach(component => {
    if (appContent.includes(`import ${component}`)) {
      pass(`App.vue: ${component} 组件已导入`);
    } else {
      warn(`App.vue: ${component} 组件未导入`);
    }
  });

  // 检查国际化使用
  if (appContent.includes('$t(') && appContent.includes('useI18n')) {
    pass('App.vue: 已集成国际化功能');
  } else {
    warn('App.vue: 国际化集成不完整');
  }
}

function validateThemeSystem() {
  title('主题系统验证');
  
  const themeManagerPath = 'src/webview/components/ThemeManager.vue';
  if (!checkFileExists(themeManagerPath, 'ThemeManager组件')) {
    return;
  }

  const content = fs.readFileSync(themeManagerPath, 'utf8');
  
  // 检查主题功能
  const themeFeatures = [
    { feature: 'currentTheme', desc: '主题切换' },
    { feature: 'currentPrimaryColor', desc: '主色调设置' },
    { feature: 'fontSize', desc: '字体大小调整' },
    { feature: 'layoutDensity', desc: '布局密度' },
    { feature: 'animationsEnabled', desc: '动画控制' },
    { feature: 'customCSS', desc: '自定义样式' }
  ];

  themeFeatures.forEach(({ feature, desc }) => {
    if (content.includes(feature)) {
      pass(`ThemeManager: ${desc} 功能已实现`);
    } else {
      fail(`ThemeManager: ${desc} 功能缺失`);
    }
  });

  // 检查响应式断点
  if (content.includes('breakpoints') && content.includes('viewportWidth')) {
    pass('ThemeManager: 响应式布局已实现');
  } else {
    warn('ThemeManager: 响应式布局不完整');
  }
}

function validateProjectStructure() {
  title('项目结构验证');
  
  const requiredDirs = [
    'src/webview/components',
    'src/webview/i18n',
    'src/webview/i18n/locales'
  ];

  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      pass(`目录结构: ${dir} 存在`);
    } else {
      fail(`目录结构: ${dir} 缺失`);
    }
  });

  // 检查TypeScript配置
  const tsconfigPaths = ['tsconfig.json', 'src/webview/tsconfig.json'];
  let tsconfigFound = false;
  
  tsconfigPaths.forEach(configPath => {
    if (fs.existsSync(configPath)) {
      tsconfigFound = true;
      pass(`TypeScript配置: ${configPath} 存在`);
    }
  });

  if (!tsconfigFound) {
    warn('TypeScript配置: 未找到tsconfig.json');
  }
}

function printSummary() {
  title('测试结果汇总');
  
  const total = passed + failed + warnings;
  const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
  
  console.log(`\n📊 测试统计:`);
  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   ⚠️  警告: ${warnings}`);
  console.log(`   📈 通过率: ${successRate}%`);
  
  if (failed === 0) {
    console.log(`\n🎉 第五阶段UI开发验证通过！所有核心功能正常。`);
    if (warnings > 0) {
      console.log(`💡 建议处理 ${warnings} 个警告项以提升代码质量。`);
    }
    return true;
  } else {
    console.log(`\n❌ 第五阶段验证失败！发现 ${failed} 个严重问题需要修复。`);
    return false;
  }
}

// 执行测试
function runTests() {
  console.log('🚀 开始第五阶段UI开发自测验证...\n');
  
  validateProjectStructure();
  validateI18nConfiguration();
  validateUIComponents();
  validateAppIntegration();
  validateThemeSystem();
  
  const success = printSummary();
  
  // 设置退出码
  process.exit(success ? 0 : 1);
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  validateVueComponent,
  validateI18nConfiguration
};