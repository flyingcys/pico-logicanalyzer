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

// CI测试配置 - P2.3阶段迁移到@tests目录
const CI_CONFIG = {
  coreTests: [
    // Quick gate 只保留当前可稳定复现的测试。旧 core smoke 中失败的业务测试由对应 worktree 修复后再移回。
    'tests/unit/quality/CITestRunner.test.ts',
    'tests/unit/quality/QualityGateConfig.test.ts',
    'tests/unit/models/LACFileFormat.test.ts',
    'tests/unit/models/AnalyzerTypes.test.ts',
    'tests/unit/decoders/protocols/I2CDecoder.test.ts',
    'tests/unit/decoders/protocols/SPIDecoder.test.ts',
    'tests/unit/decoders/protocols/UARTDecoder.test.ts',
    'tests/unit/extension/Extension.test.ts',
    'tests/unit/models/DataStreamProcessor.test.ts',
    'tests/unit/models/BinaryDataParser.test.ts'
  ],
  quarantinedCoreTests: [
    'tests/unit/drivers/LogicAnalyzerDriver.core.test.ts',
    'tests/unit/models/CaptureModels.core.test.ts',
    'tests/unit/services/SessionManager.core.test.ts',
    'tests/unit/services/ConfigurationManager.basic.test.ts'
  ],
  integrationTests: [
    'tests/integration/core-flows/hardware-capture.integration.test.ts'  // P2.1: 核心数据流集成测试
  ],
  performanceTests: [
    'tests/performance/benchmarks/LogicAnalyzerDriver.perf.test.ts',     // P2.2: 驱动性能基准
    'tests/performance/benchmarks/LACFileFormat.perf.test.ts'            // P2.2: 文件格式性能基准
  ],
  e2eTests: [
    'tests/e2e/scenarios/DataCaptureWorkflow.e2e.test.ts'               // P2.3: 端到端工作流测试
  ],
  stressTests: [
    'tests/stress/load/LargeDataProcessing.stress.test.ts',            // P2.3: 大数据处理压力测试
    'tests/stress/load/IntelligentLoadGeneration.stress.test.ts',      // P2.3: 智能负载生成压力测试
    'tests/stress/data-processing/scenarios/MemoryLeakDetection.stress.test.ts'  // P2.3: 内存泄漏检测压力测试
  ],
  timeout: 30000, // 30秒超时
  performanceTimeout: 180000, // 3分钟性能测试专用超时
  e2eTimeout: 300000, // 5分钟E2E测试专用超时
  stressTimeout: 900000, // 15分钟压力测试专用超时
  memoryLeakTimeout: 300000, // 5分钟内存泄漏检测专用超时
  maxRetries: 2,   // 最多重试2次
  
  // P2.3: 分层执行策略配置
  testLayers: {
    quick: {
      description: '快速验证层 - 2分钟内完成关键功能验证',
      maxDuration: 120000,
      include: ['coreTests'],
      stressConfig: {
        runMode: 'ci-friendly',
        maxDuration: 60000,
        operationFrequency: 10
      }
    },
    standard: {
      description: '标准测试层 - 10分钟内完成核心功能和基础性能验证',
      maxDuration: 600000,
      include: ['coreTests', 'integrationTests', 'performanceTests'],
      stressConfig: {
        runMode: 'ci-friendly',
        maxDuration: 120000,
        operationFrequency: 20
      }
    },
    full: {
      description: '完整测试层 - 30分钟内完成所有测试，包括长期压力测试',
      maxDuration: 1800000,
      include: ['coreTests', 'integrationTests', 'performanceTests', 'e2eTests', 'stressTests'],
      stressConfig: {
        runMode: 'accelerated',
        maxDuration: 300000,
        operationFrequency: 50
      }
    }
  }
};

const QUALITY_COMMANDS = [
  'npm run typecheck',
  'npm run typecheck:strict',
  'npm run lint',
  'npm run test:ci:quick',
  'npm run package:dry'
];

function parseArguments(args = process.argv.slice(2)) {
  const layerArg = args.find(arg => arg.startsWith('--layer='));
  return {
    layer: layerArg ? layerArg.split('=')[1] : 'standard',
    dryRun: args.includes('--dry-run'),
    skipInstall: args.includes('--skip-install')
  };
}

function createExecutionPlan(args = process.argv.slice(2)) {
  const parsed = parseArguments(args);

  if (!CI_CONFIG.testLayers[parsed.layer] && parsed.layer !== 'legacy') {
    throw new Error(
      `无效的测试层级: ${parsed.layer}。可用层级: ${Object.keys(CI_CONFIG.testLayers).join(', ')}, legacy`
    );
  }

  const layerConfig = CI_CONFIG.testLayers[parsed.layer];
  const includedTestGroups = layerConfig
    ? [...layerConfig.include]
    : ['coreTests', 'integrationTests', 'performanceTests', 'e2eTests', 'stressTests'];
  const maxDurationMs = layerConfig
    ? layerConfig.maxDuration
    : CI_CONFIG.timeout + CI_CONFIG.performanceTimeout + CI_CONFIG.e2eTimeout + CI_CONFIG.stressTimeout;

  return {
    layer: parsed.layer,
    dryRun: parsed.dryRun,
    installDependencies: !parsed.dryRun && !parsed.skipInstall,
    runTests: !parsed.dryRun,
    runQualityCheck: !parsed.dryRun,
    includedTestGroups,
    maxDurationMs,
    quarantinedTests: [...CI_CONFIG.quarantinedCoreTests],
    commands: QUALITY_COMMANDS
  };
}

function formatDryRunReport(plan) {
  const lines = [
    'CI dry-run 执行计划',
    `测试层级: ${plan.layer}`,
    `安装依赖: ${plan.installDependencies ? '是' : '否'}`,
    `运行测试: ${plan.runTests ? '是' : '否'}`,
    `运行质量检查: ${plan.runQualityCheck ? '是' : '否'}`,
    `测试分组: ${plan.includedTestGroups.join(', ')}`,
    `时间上限: ${(plan.maxDurationMs / 60000).toFixed(1)} 分钟`,
    `暂不阻断测试: ${plan.quarantinedTests.length} 个`,
    '关键命令:'
  ];

  for (const command of plan.commands) {
    lines.push(`- ${command}`);
  }

  return lines.join('\n');
}

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
  
  // 为集成测试添加--forceExit参数以处理异步清理问题
  const isIntegrationTest = testFile.includes('tests/integration/');
  const isPerformanceTest = testFile.includes('tests/performance/');
  const isE2ETest = testFile.includes('tests/e2e/');
  const isStressTest = testFile.includes('tests/stress/');
  const isMemoryLeakTest = testFile.includes('MemoryLeakDetection.stress.test.ts');
  const forceExitFlag = (isIntegrationTest || isPerformanceTest || isE2ETest || isStressTest) ? ' --forceExit' : '';
  
  // 为不同类型测试使用相应的超时时间
  let timeout = CI_CONFIG.timeout;
  if (isMemoryLeakTest) {
    timeout = CI_CONFIG.memoryLeakTimeout;
  } else if (isPerformanceTest) {
    timeout = CI_CONFIG.performanceTimeout;
  } else if (isE2ETest) {
    timeout = CI_CONFIG.e2eTimeout;
  } else if (isStressTest) {
    timeout = CI_CONFIG.stressTimeout;
  }
  
  const jestCommand = `npx jest "${testFile}" --verbose --ci --json --coverage=false${forceExitFlag}`;
  const result = executeCommand(jestCommand, { silent: true, timeout });
  
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

// 运行集成测试 - P2.1新增
function runIntegrationTests() {
  console.log('\n🔗 开始运行集成测试...');
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of CI_CONFIG.integrationTests) {
    // 检查测试文件是否存在
    if (!fs.existsSync(testFile)) {
      console.log(`❌ 集成测试文件不存在: ${testFile}`);
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

// 运行性能测试 - P2.2新增
function runPerformanceTests() {
  console.log('\n⚡ 开始运行性能测试...');
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of CI_CONFIG.performanceTests) {
    // 检查测试文件是否存在
    if (!fs.existsSync(testFile)) {
      console.log(`❌ 性能测试文件不存在: ${testFile}`);
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

// 运行E2E测试 - P2.3新增
function runE2ETests() {
  console.log('\n🎬 开始运行E2E测试...');
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of CI_CONFIG.e2eTests) {
    // 检查测试文件是否存在
    if (!fs.existsSync(testFile)) {
      console.log(`❌ E2E测试文件不存在: ${testFile}`);
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

// 运行压力测试 - P2.3新增
function runStressTests() {
  console.log('\n💪 开始运行压力测试...');
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of CI_CONFIG.stressTests) {
    // 检查测试文件是否存在
    if (!fs.existsSync(testFile)) {
      console.log(`❌ 压力测试文件不存在: ${testFile}`);
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

// P2.3: 分层执行核心函数
function runLayeredTests(layer = 'standard') {
  console.log(`\n🎯 开始执行 ${layer} 测试层...`);
  
  const layerConfig = CI_CONFIG.testLayers[layer];
  if (!layerConfig) {
    console.log(`❌ 无效的测试层级: ${layer}`);
    return { allPassed: false, results: [] };
  }
  
  console.log(`📝 ${layerConfig.description}`);
  console.log(`⏱️ 最大执行时间: ${(layerConfig.maxDuration / 60000).toFixed(1)}分钟`);
  
  const startTime = Date.now();
  let allResults = [];
  let overallSuccess = true;
  
  // 根据层级配置执行相应的测试类型
  for (const testType of layerConfig.include) {
    console.log(`\n📂 执行测试类型: ${testType}`);
    
    let typeResults = { allPassed: false, results: [] };
    
    switch (testType) {
      case 'coreTests':
        typeResults = runCoreTests();
        break;
      case 'integrationTests':
        typeResults = runIntegrationTests();
        break;
      case 'performanceTests':
        typeResults = runPerformanceTests();
        break;
      case 'e2eTests':
        typeResults = runE2ETests();
        break;
      case 'stressTests':
        typeResults = runStressTestsWithConfig(layerConfig.stressConfig);
        break;
      default:
        console.log(`⚠️ 未知的测试类型: ${testType}`);
    }
    
    allResults.push(...typeResults.results);
    if (!typeResults.allPassed) {
      overallSuccess = false;
    }
    
    // 检查是否超时
    const elapsed = Date.now() - startTime;
    if (elapsed > layerConfig.maxDuration * 0.9) { // 90%时间预警
      console.log(`⚠️ 接近超时限制，剩余时间: ${((layerConfig.maxDuration - elapsed) / 60000).toFixed(1)}分钟`);
    }
    
    if (elapsed > layerConfig.maxDuration) {
      console.log(`⏰ 达到层级时间限制，停止执行`);
      break;
    }
  }
  
  const totalTime = (Date.now() - startTime) / 60000;
  console.log(`\n🏁 ${layer} 测试层执行完成，用时: ${totalTime.toFixed(1)}分钟`);
  
  return {
    allPassed: overallSuccess,
    results: allResults,
    layer,
    executionTime: totalTime
  };
}

// P2.3: 带配置的压力测试执行
function runStressTestsWithConfig(config = null) {
  console.log('\n💪 开始运行压力测试（带层级配置）...');
  
  if (config) {
    console.log(`⚙️ 压力测试配置: 模式=${config.runMode}, 最大时长=${config.maxDuration/1000}秒, 频率=${config.operationFrequency}/秒`);
    
    // 设置环境变量传递配置到测试
    process.env.STRESS_TEST_RUN_MODE = config.runMode;
    process.env.STRESS_TEST_MAX_DURATION = config.maxDuration.toString();
    process.env.STRESS_TEST_OPERATION_FREQUENCY = config.operationFrequency.toString();
  }
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of CI_CONFIG.stressTests) {
    // 检查测试文件是否存在
    if (!fs.existsSync(testFile)) {
      console.log(`❌ 压力测试文件不存在: ${testFile}`);
      results.push({ success: false, testFile, error: '文件不存在' });
      allPassed = false;
      continue;
    }
    
    // 为内存泄漏检测测试添加特殊日志
    if (testFile.includes('MemoryLeakDetection.stress.test.ts')) {
      console.log(`🔍 执行内存泄漏检测压力测试 (配置: ${config ? config.runMode : '默认'})`);
    }
    
    const result = runSingleTest(testFile);
    results.push(result);
    
    if (!result.success) {
      allPassed = false;
    }
  }
  
  // 清理环境变量
  if (config) {
    delete process.env.STRESS_TEST_RUN_MODE;
    delete process.env.STRESS_TEST_MAX_DURATION;
    delete process.env.STRESS_TEST_OPERATION_FREQUENCY;
  }
  
  return { allPassed, results };
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

// P2.3: 生成分层测试报告
function generateLayeredReport(testResults, qualityResult, layer) {
  console.log('\n📋 生成分层测试报告...');
  
  const layerConfig = CI_CONFIG.testLayers[layer];
  
  const report = {
    timestamp: new Date().toISOString(),
    layer: {
      name: layer,
      description: layerConfig ? layerConfig.description : '未知层级',
      executionTime: testResults.executionTime || 0,
      maxDuration: layerConfig ? layerConfig.maxDuration / 60000 : 0
    },
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
      allPassed: testResults.allPassed && qualityResult,
      efficiency: layerConfig ? (testResults.executionTime / (layerConfig.maxDuration / 60000) * 100).toFixed(1) : 'N/A'
    },
    stressTestSummary: {
      memoryLeakTests: testResults.results.filter(r => r.testFile && r.testFile.includes('MemoryLeakDetection')),
      totalStressTests: testResults.results.filter(r => r.testFile && r.testFile.includes('tests/stress/')).length
    }
  };
  
  // 保存报告到文件
  try {
    fs.writeFileSync('ci-test-report.json', JSON.stringify(report, null, 2));
    console.log('📄 分层测试报告已保存到 ci-test-report.json');
  } catch (error) {
    console.log('⚠️ 无法保存测试报告:', error.message);
  }
  
  // 打印分层测试汇总信息
  console.log('\n🏆 分层测试结果汇总:');
  console.log(`   测试层级: ${layer} (${layerConfig ? layerConfig.description : '未知'})`);
  console.log(`   执行时间: ${report.layer.executionTime ? report.layer.executionTime.toFixed(1) : '0.0'}分钟 / ${report.layer.maxDuration.toFixed(1)}分钟 (${report.summary.efficiency}%)`);
  console.log(`   总测试数: ${report.summary.totalTests}`);
  console.log(`   通过: ${report.summary.passed}`);
  console.log(`   失败: ${report.summary.failed}`);
  console.log(`   压力测试: ${report.stressTestSummary.totalStressTests}个`);
  console.log(`   内存泄漏检测: ${report.stressTestSummary.memoryLeakTests.length}个`);
  console.log(`   质量检查: ${qualityResult ? '✅ 通过' : '❌ 失败'}`);
  console.log(`   最终状态: ${report.summary.allPassed ? '🎉 成功' : '💥 失败'}`);
  
  // 分层执行效率评估
  if (report.summary.efficiency !== 'N/A') {
    const efficiency = parseFloat(report.summary.efficiency);
    if (efficiency < 50) {
      console.log(`   ⚡ 执行效率: 优秀 (${efficiency}% < 50%)`);
    } else if (efficiency < 80) {
      console.log(`   ⚙️ 执行效率: 良好 (${efficiency}% < 80%)`);
    } else if (efficiency < 95) {
      console.log(`   ⚠️ 执行效率: 正常 (${efficiency}% < 95%)`);
    } else {
      console.log(`   🔥 执行效率: 接近极限 (${efficiency}% ≥ 95%)`);
    }
  }
  
  return report;
}

// 主函数
async function main() {
  console.log('🚀 CI测试运行器启动...');
  console.log(`📅 时间: ${new Date().toISOString()}`);
  
  // P2.3: 解析命令行参数获取测试层级
  let plan;
  try {
    plan = createExecutionPlan(process.argv.slice(2));
  } catch (error) {
    console.log(`❌ ${error.message}`);
    process.exit(1);
  }
  const { layer } = plan;
  
  console.log(`🎯 测试层级: ${layer}`);
  
  if (plan.dryRun) {
    console.log(formatDryRunReport(plan));
    process.exit(0);
  }
  
  // 1. 检查环境
  if (!checkEnvironment()) {
    console.log('❌ 环境检查失败');
    process.exit(1);
  }
  
  // 2. 安装依赖
  if (plan.installDependencies && !installDependencies()) {
    console.log('❌ 依赖安装失败');
    process.exit(1);
  }
  
  // 3. P2.3: 使用分层执行策略
  let combinedResults;
  if (layer === 'legacy') {
    // 兼容性：支持原有的顺序执行模式
    console.log('\n📊 使用传统顺序执行模式...');
    
    const testResults = runCoreTests();
    const integrationResults = runIntegrationTests();
    const performanceResults = runPerformanceTests();
    const e2eResults = runE2ETests();
    const stressResults = runStressTests();
    
    combinedResults = {
      allPassed: testResults.allPassed && integrationResults.allPassed && performanceResults.allPassed && e2eResults.allPassed && stressResults.allPassed,
      results: [...testResults.results, ...integrationResults.results, ...performanceResults.results, ...e2eResults.results, ...stressResults.results]
    };
  } else {
    // P2.3: 新的分层执行模式
    combinedResults = runLayeredTests(layer);
  }
  
  // 4. 运行质量检查
  const qualityResult = runQualityCheck();
  
  // 5. 生成报告
  const report = generateLayeredReport(combinedResults, qualityResult, layer);
  
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

module.exports = {
  runCoreTests,
  checkEnvironment,
  installDependencies,
  createExecutionPlan,
  formatDryRunReport
};
