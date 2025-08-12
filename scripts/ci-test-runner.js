#!/usr/bin/env node

/**
 * CI测试运行器 - 专为持续集成环境设计
 * 
 * 功能：
 * - 运行核心测试验证
 * - 生成测试结果报告
 * - 处理CI环境特殊情况
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// CI测试配置
const CI_CONFIG = {
  coreTests: [
    'utest/unit/drivers/LogicAnalyzerDriver.core.test.ts'
  ],
  timeout: 30000, // 30秒超时
  maxRetries: 2   // 最多重试2次
};

// 执行Shell命令并捕获输出
function executeCommand(command, options = {}) {
  console.log(`🔧 执行: ${command}`);
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: options.timeout || CI_CONFIG.timeout,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      code: error.status,
      output: error.stdout || error.output
    };
  }
}

// 检查环境依赖
function checkEnvironment() {
  console.log('🔍 检查CI环境...');
  
  const checks = [
    { name: 'Node.js版本', command: 'node --version' },
    { name: 'NPM版本', command: 'npm --version' },
    { name: 'Jest可用性', command: 'npx jest --version' }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const result = executeCommand(check.command, { silent: true });
    if (result.success) {
      console.log(`✅ ${check.name}: ${result.output.trim()}`);
    } else {
      console.log(`❌ ${check.name}: 检查失败`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// 安装依赖
function installDependencies() {
  console.log('📦 安装项目依赖...');
  
  // 优先使用npm ci（更适合CI环境）
  let result = executeCommand('npm ci', { silent: false });
  
  if (!result.success) {
    console.log('⚠️ npm ci失败，尝试npm install...');
    result = executeCommand('npm install', { silent: false });
  }
  
  return result.success;
}

// 运行单个测试文件
function runSingleTest(testFile, retries = 0) {
  console.log(`\n🧪 运行测试: ${testFile}`);
  
  const jestCommand = `npx jest "${testFile}" --verbose --ci --json --coverage=false`;
  const result = executeCommand(jestCommand, { silent: true });
  
  if (result.success) {
    console.log(`✅ ${testFile} 测试通过`);
    try {
      // 尝试解析Jest JSON输出获取详细信息
      const jsonOutput = result.output.split('\n').find(line => {
        try { JSON.parse(line); return true; } catch { return false; }
      });
      
      if (jsonOutput) {
        const testResult = JSON.parse(jsonOutput);
        console.log(`   📊 通过: ${testResult.numPassedTests || 0} / 总计: ${testResult.numTotalTests || 0}`);
      }
    } catch (error) {
      console.log('   📊 无法解析详细测试结果');
    }
    return { success: true, testFile };
  } else {
    console.log(`❌ ${testFile} 测试失败`);
    
    if (retries < CI_CONFIG.maxRetries) {
      console.log(`🔄 重试第 ${retries + 1} 次...`);
      return runSingleTest(testFile, retries + 1);
    } else {
      console.log(`💥 ${testFile} 测试最终失败`);
      return { 
        success: false, 
        testFile, 
        error: result.error,
        output: result.output 
      };
    }
  }
}

// 运行所有核心测试
function runCoreTests() {
  console.log('\n🎯 开始运行核心测试...');
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of CI_CONFIG.coreTests) {
    // 检查测试文件是否存在
    if (!fs.existsSync(testFile)) {
      console.log(`❌ 测试文件不存在: ${testFile}`);
      results.push({ success: false, testFile, error: '文件不存在' });
      allPassed = false;
      continue;
    }
    
    const result = runSingleTest(testFile);
    results.push(result);
    
    if (!result.success) {
      allPassed = false;
    }
  }
  
  return { allPassed, results };
}

// 运行质量检查
function runQualityCheck() {
  console.log('\n🔍 运行质量检查...');
  
  const qualityScript = path.join(__dirname, 'test-quality-check.js');
  
  if (!fs.existsSync(qualityScript)) {
    console.log('⚠️ 质量检查脚本不存在，跳过');
    return true;
  }
  
  const result = executeCommand(`node "${qualityScript}"`, { silent: false });
  
  if (result.success) {
    console.log('✅ 质量检查通过');
  } else {
    console.log('❌ 质量检查失败');
  }
  
  return result.success;
}

// 生成测试报告
function generateReport(testResults, qualityResult) {
  console.log('\n📋 生成测试报告...');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform
    },
    testResults: testResults.results,
    qualityCheck: qualityResult,
    summary: {
      totalTests: testResults.results.length,
      passed: testResults.results.filter(r => r.success).length,
      failed: testResults.results.filter(r => !r.success).length,
      allPassed: testResults.allPassed && qualityResult
    }
  };
  
  // 保存报告到文件
  try {
    fs.writeFileSync('ci-test-report.json', JSON.stringify(report, null, 2));
    console.log('📄 测试报告已保存到 ci-test-report.json');
  } catch (error) {
    console.log('⚠️ 无法保存测试报告:', error.message);
  }
  
  // 打印汇总信息
  console.log('\n🏆 测试结果汇总:');
  console.log(`   总测试数: ${report.summary.totalTests}`);
  console.log(`   通过: ${report.summary.passed}`);
  console.log(`   失败: ${report.summary.failed}`);
  console.log(`   质量检查: ${qualityResult ? '✅ 通过' : '❌ 失败'}`);
  console.log(`   最终状态: ${report.summary.allPassed ? '🎉 成功' : '💥 失败'}`);
  
  return report;
}

// 主函数
async function main() {
  console.log('🚀 CI测试运行器启动...');
  console.log(`📅 时间: ${new Date().toISOString()}`);
  
  // 1. 检查环境
  if (!checkEnvironment()) {
    console.log('❌ 环境检查失败');
    process.exit(1);
  }
  
  // 2. 安装依赖
  if (!installDependencies()) {
    console.log('❌ 依赖安装失败');
    process.exit(1);
  }
  
  // 3. 运行核心测试
  const testResults = runCoreTests();
  
  // 4. 运行质量检查
  const qualityResult = runQualityCheck();
  
  // 5. 生成报告
  const report = generateReport(testResults, qualityResult);
  
  // 6. 设置退出码
  if (report.summary.allPassed) {
    console.log('\n🎉 所有检查通过！CI测试成功。');
    process.exit(0);
  } else {
    console.log('\n💥 部分检查失败！CI测试失败。');
    process.exit(1);
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('💥 主函数执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runCoreTests, checkEnvironment, installDependencies };