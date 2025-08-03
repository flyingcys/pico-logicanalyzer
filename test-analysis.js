#!/usr/bin/env node

/**
 * 测试体系深度分析脚本
 * 快速评估测试文件的质量和可运行性
 */

const fs = require('fs');
const path = require('path');

// 递归获取所有测试文件
function getTestFiles(dir) {
    const results = [];
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            results.push(...getTestFiles(fullPath));
        } else if (file.endsWith('.test.ts')) {
            results.push(fullPath);
        }
    }
    
    return results;
}

// 分析测试文件内容
function analyzeTestFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // 基础统计
        const stats = {
            file: path.relative(process.cwd(), filePath),
            lines: lines.length,
            imports: (content.match(/^import\s/gm) || []).length,
            describes: (content.match(/describe\(/g) || []).length,
            its: (content.match(/it\(/g) || []).length,
            expects: (content.match(/expect\(/g) || []).length,
            mocks: (content.match(/jest\.mock|mock\w+/g) || []).length,
            beforeEach: (content.match(/beforeEach\(/g) || []).length,
            afterEach: (content.match(/afterEach\(/g) || []).length,
        };
        
        // 质量指标
        stats.quality = 'unknown';
        stats.issues = [];
        
        // 基本质量检查
        if (stats.its === 0) {
            stats.issues.push('no_test_cases');
            stats.quality = 'poor';
        } else if (stats.expects === 0) {
            stats.issues.push('no_assertions');
            stats.quality = 'poor';
        } else if (stats.expects < stats.its) {
            stats.issues.push('few_assertions');
            stats.quality = 'basic';
        } else if (stats.expects >= stats.its * 2) {
            stats.quality = 'good';
        } else {
            stats.quality = 'basic';
        }
        
        // 高级特性检查
        if (stats.mocks > 0) stats.issues.push('has_mocks');
        if (stats.beforeEach > 0) stats.issues.push('has_setup');
        if (content.includes('async ')) stats.issues.push('has_async');
        if (content.includes('jest.setTimeout')) stats.issues.push('has_timeout_config');
        if (content.includes('performance')) stats.issues.push('has_performance_tests');
        
        return stats;
    } catch (error) {
        return {
            file: path.relative(process.cwd(), filePath),
            error: error.message,
            quality: 'error'
        };
    }
}

// 按模块分组
function groupByModule(files) {
    const groups = {};
    
    files.forEach(file => {
        const relativePath = path.relative('utest', file);
        const parts = relativePath.split(path.sep);
        
        let module = 'root';
        if (parts[0] === 'unit') {
            module = parts[1] || 'unknown';
        } else if (parts[0] === 'performance') {
            module = 'performance';
        }
        
        if (!groups[module]) {
            groups[module] = [];
        }
        groups[module].push(file);
    });
    
    return groups;
}

// 生成统计报告
function generateReport() {
    console.log('🔍 VSCode逻辑分析器插件 - 测试体系深度分析报告');
    console.log('=' * 60);
    console.log('');
    
    const testFiles = getTestFiles('utest');
    console.log(`📊 测试文件总数: ${testFiles.length}`);
    
    const moduleGroups = groupByModule(testFiles);
    console.log(`📦 测试模块数: ${Object.keys(moduleGroups).length}`);
    console.log('');
    
    // 按模块统计
    console.log('📋 按模块分布统计:');
    console.log('-'.repeat(60));
    
    let totalStats = {
        files: 0,
        tests: 0,
        assertions: 0,
        good: 0,
        basic: 0,
        poor: 0,
        errors: 0
    };
    
    Object.entries(moduleGroups).forEach(([module, files]) => {
        console.log(`\n🔧 ${module.toUpperCase()} 模块:`);
        console.log(`   文件数: ${files.length}`);
        
        let moduleTests = 0;
        let moduleAssertions = 0;
        let qualityCount = { good: 0, basic: 0, poor: 0, error: 0 };
        
        files.forEach(file => {
            const analysis = analyzeTestFile(file);
            if (analysis.error) {
                qualityCount.error++;
                console.log(`   ❌ ${analysis.file}: ${analysis.error}`);
            } else {
                moduleTests += analysis.its || 0;
                moduleAssertions += analysis.expects || 0;
                qualityCount[analysis.quality]++;
                
                const qualityIcon = {
                    good: '✅',
                    basic: '⚠️',
                    poor: '❌',
                    unknown: '❓'
                }[analysis.quality] || '❓';
                
                console.log(`   ${qualityIcon} ${path.basename(analysis.file)}: ${analysis.its}测试/${analysis.expects}断言`);
            }
        });
        
        console.log(`   📊 测试用例总数: ${moduleTests}`);
        console.log(`   📊 断言总数: ${moduleAssertions}`);
        console.log(`   📊 质量分布: 优秀${qualityCount.good} | 基础${qualityCount.basic} | 差${qualityCount.poor} | 错误${qualityCount.error}`);
        
        totalStats.files += files.length;
        totalStats.tests += moduleTests;
        totalStats.assertions += moduleAssertions;
        totalStats.good += qualityCount.good;
        totalStats.basic += qualityCount.basic;
        totalStats.poor += qualityCount.poor;
        totalStats.errors += qualityCount.error;
    });
    
    // 总体统计
    console.log('\n' + '='.repeat(60));
    console.log('📊 总体统计:');
    console.log(`   📁 测试文件总数: ${totalStats.files}`);
    console.log(`   🧪 测试用例总数: ${totalStats.tests}`);
    console.log(`   ✅ 断言总数: ${totalStats.assertions}`);
    console.log(`   📊 平均每文件测试数: ${(totalStats.tests / totalStats.files).toFixed(1)}`);
    console.log(`   📊 平均每测试断言数: ${totalStats.tests > 0 ? (totalStats.assertions / totalStats.tests).toFixed(1) : '0'}`);
    console.log('');
    
    // 质量评估
    console.log('🎯 质量评估:');
    const goodPercent = (totalStats.good / totalStats.files * 100).toFixed(1);
    const basicPercent = (totalStats.basic / totalStats.files * 100).toFixed(1);
    const poorPercent = (totalStats.poor / totalStats.files * 100).toFixed(1);
    const errorPercent = (totalStats.errors / totalStats.files * 100).toFixed(1);
    
    console.log(`   ✅ 优秀质量: ${totalStats.good}个 (${goodPercent}%)`);
    console.log(`   ⚠️  基础质量: ${totalStats.basic}个 (${basicPercent}%)`);
    console.log(`   ❌ 较差质量: ${totalStats.poor}个 (${poorPercent}%)`);
    console.log(`   🚨 存在错误: ${totalStats.errors}个 (${errorPercent}%)`);
    console.log('');
    
    // 优先级建议
    console.log('🚀 优先级建议:');
    if (totalStats.errors > 0) {
        console.log(`   🔥 高优先级: 修复${totalStats.errors}个错误文件`);
    }
    if (totalStats.poor > 0) {
        console.log(`   ⚡ 中优先级: 提升${totalStats.poor}个较差质量文件`);
    }
    if (totalStats.basic > 5) {
        console.log(`   📈 低优先级: 优化${totalStats.basic}个基础质量文件`);
    }
    
    // 整体评级
    console.log('\n📊 整体评级:');
    if (goodPercent >= 60) {
        console.log('   🌟 优秀 - 测试体系质量很高');
    } else if (goodPercent >= 40) {
        console.log('   ⭐ 良好 - 测试体系基本健康');
    } else if (poorPercent < 20) {
        console.log('   📝 基础 - 测试体系需要改进');
    } else {
        console.log('   🔧 需要重构 - 测试体系存在重大问题');
    }
}

// 运行分析
if (require.main === module) {
    try {
        generateReport();
    } catch (error) {
        console.error('分析失败:', error.message);
        process.exit(1);
    }
}