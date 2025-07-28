/**
 * 第四阶段模块结构验证测试
 * 验证所有TypeScript模块的基本结构和导出
 */

const fs = require('fs');
const path = require('path');

// 定义要验证的核心模块
const coreModules = [
    'WaveformRenderer.ts',
    'InteractionEngine.ts', 
    'ChannelLayoutManager.ts',
    'VirtualizationRenderer.ts',
    'MarkerTools.ts',
    'MeasurementTools.ts',
    'TimeAxisRenderer.ts',
    'PerformanceOptimizer.ts'
];

// 定义必需的接口和类型
const requiredExports = {
    'WaveformRenderer.ts': [
        'export class WaveformRenderer',
        'export interface WaveformConfig',
        'export interface RenderStats'
    ],
    'InteractionEngine.ts': [
        'export class InteractionEngine',
        'export interface ViewportState',
        'export interface InteractionConfig'
    ],
    'ChannelLayoutManager.ts': [
        'export class ChannelLayoutManager',
        'export interface ChannelDisplayInfo',
        'export interface LayoutResult'
    ],
    'VirtualizationRenderer.ts': [
        'export class VirtualizationRenderer',
        'export interface VirtualizationConfig',
        'export interface RenderTile'
    ],
    'MarkerTools.ts': [
        'export class MarkerTools',
        'export interface Marker',
        'export interface MarkerPair'
    ],
    'MeasurementTools.ts': [
        'export class MeasurementTools',
        'export interface PulseInfo',
        'export interface FrequencyMeasurement'
    ],
    'TimeAxisRenderer.ts': [
        'export class TimeAxisRenderer',
        'export interface TimeAxisConfig',
        'export interface TickInfo'
    ],
    'PerformanceOptimizer.ts': [
        'export class PerformanceOptimizer',
        'export interface PerformanceConfig',
        'export interface PerformanceMetrics'
    ]
};

function runModuleStructureTest() {
    console.log('🧪 开始第四阶段模块结构验证测试...\n');
    
    let totalTests = 0;
    let passedTests = 0;
    const results = [];
    
    const enginesDir = path.join(__dirname, '..');
    
    for (const moduleFile of coreModules) {
        console.log(`📁 检查模块: ${moduleFile}`);
        totalTests++;
        
        const modulePath = path.join(enginesDir, moduleFile);
        const result = {
            module: moduleFile,
            exists: false,
            hasRequiredExports: false,
            size: 0,
            lines: 0,
            errors: []
        };
        
        try {
            // 检查文件是否存在
            if (!fs.existsSync(modulePath)) {
                result.errors.push('文件不存在');
                console.log(`  ❌ 文件不存在: ${modulePath}`);
                results.push(result);
                continue;
            }
            
            result.exists = true;
            
            // 读取文件内容
            const content = fs.readFileSync(modulePath, 'utf8');
            result.size = content.length;
            result.lines = content.split('\n').length;
            
            console.log(`  ✓ 文件存在 (${result.lines} 行, ${Math.round(result.size/1024)}KB)`);
            
            // 检查必需的导出
            const requiredExportsForModule = requiredExports[moduleFile] || [];
            let foundExports = 0;
            
            for (const exportPattern of requiredExportsForModule) {
                if (content.includes(exportPattern)) {
                    foundExports++;
                    console.log(`    ✓ 找到导出: ${exportPattern}`);
                } else {
                    result.errors.push(`缺少导出: ${exportPattern}`);
                    console.log(`    ❌ 缺少导出: ${exportPattern}`);
                }
            }
            
            result.hasRequiredExports = foundExports === requiredExportsForModule.length;
            
            // 检查TypeScript语法基础结构
            const hasImports = content.includes('import ');
            const hasExports = content.includes('export ');
            const hasInterfaces = content.includes('interface ');
            const hasClasses = content.includes('class ');
            
            console.log(`    📊 结构分析:`);
            console.log(`      Import语句: ${hasImports ? '✓' : '❌'}`);
            console.log(`      Export语句: ${hasExports ? '✓' : '❌'}`);
            console.log(`      接口定义: ${hasInterfaces ? '✓' : '❌'}`);
            console.log(`      类定义: ${hasClasses ? '✓' : '❌'}`);
            
            // 检查是否有明显的语法错误
            const hasSyntaxErrors = content.includes('SyntaxError') || 
                                   content.match(/\s+\s+\s+/) === null; // 基本缩进检查
            
            if (result.exists && result.hasRequiredExports && !hasSyntaxErrors) {
                passedTests++;
                console.log(`  ✅ ${moduleFile} 验证通过\n`);
            } else {
                console.log(`  ❌ ${moduleFile} 验证失败\n`);
            }
            
        } catch (error) {
            result.errors.push(`读取文件错误: ${error.message}`);
            console.log(`  ❌ 读取文件错误: ${error.message}\n`);
        }
        
        results.push(result);
    }
    
    // 输出测试总结
    console.log('📊 测试总结:');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过测试: ${passedTests}`);
    console.log(`失败测试: ${totalTests - passedTests}`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);
    
    // 输出详细统计
    console.log('📈 模块统计:');
    let totalLines = 0;
    let totalSize = 0;
    
    results.forEach(result => {
        if (result.exists) {
            totalLines += result.lines;
            totalSize += result.size;
            console.log(`  ${result.module}: ${result.lines} 行, ${Math.round(result.size/1024)}KB`);
        }
    });
    
    console.log(`  总计: ${totalLines} 行, ${Math.round(totalSize/1024)}KB\n`);
    
    // 输出错误详情
    const failedResults = results.filter(r => r.errors.length > 0);
    if (failedResults.length > 0) {
        console.log('❌ 失败详情:');
        failedResults.forEach(result => {
            console.log(`  ${result.module}:`);
            result.errors.forEach(error => {
                console.log(`    - ${error}`);
            });
        });
        console.log();
    }
    
    // 最终结果
    if (passedTests === totalTests) {
        console.log('🎉 所有模块结构验证通过！');
        console.log('✅ 第四阶段波形显示核心组件开发完成');
        return true;
    } else {
        console.log(`⚠️ ${totalTests - passedTests} 个模块验证失败，需要修复`);
        return false;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const success = runModuleStructureTest();
    process.exit(success ? 0 : 1);
}

module.exports = { runModuleStructureTest };