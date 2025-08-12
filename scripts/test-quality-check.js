#!/usr/bin/env node

/**
 * 测试质量检查脚本
 * 
 * 检查项目：
 * 1. 测试文件大小 ≤ 200行
 * 2. Mock数量 ≤ 5个
 * 
 * 用于Git pre-commit hook自动质量保障
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 质量标准配置
const QUALITY_STANDARDS = {
  maxLines: 200,
  maxMocks: 5
};

// 获取要提交的测试文件
function getStagedTestFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
    return output
      .split('\n')
      .filter(file => file.trim() !== '')
      .filter(file => file.includes('utest/') && file.endsWith('.test.ts'));
  } catch (error) {
    console.log('获取staged文件时出错:', error.message);
    return [];
  }
}

// 检查文件行数
function checkFileLines(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: '文件不存在' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;
  
  return {
    valid: lines <= QUALITY_STANDARDS.maxLines,
    lines: lines,
    limit: QUALITY_STANDARDS.maxLines
  };
}

// 检查Mock数量
function checkMockCount(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: '文件不存在' };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 检查各种Mock模式
  const mockPatterns = [
    /jest\.mock\(/g,           // jest.mock(
    /\.mockImplementation/g,   // .mockImplementation
    /\.mockReturnValue/g,      // .mockReturnValue  
    /\.mockResolvedValue/g,    // .mockResolvedValue
    /\.mockRejectedValue/g     // .mockRejectedValue
  ];
  
  let totalMocks = 0;
  mockPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      totalMocks += matches.length;
    }
  });
  
  return {
    valid: totalMocks <= QUALITY_STANDARDS.maxMocks,
    mocks: totalMocks,
    limit: QUALITY_STANDARDS.maxMocks
  };
}

// 主检查函数
function runQualityCheck() {
  console.log('🔍 执行测试质量检查...');
  
  const stagedTestFiles = getStagedTestFiles();
  
  if (stagedTestFiles.length === 0) {
    console.log('✅ 没有测试文件需要检查');
    return true;
  }
  
  console.log(`检查 ${stagedTestFiles.length} 个测试文件...`);
  
  let allValid = true;
  
  stagedTestFiles.forEach(file => {
    console.log(`\n📁 检查: ${file}`);
    
    // 检查行数
    const linesCheck = checkFileLines(file);
    if (!linesCheck.valid) {
      if (linesCheck.error) {
        console.log(`❌ 行数检查失败: ${linesCheck.error}`);
      } else {
        console.log(`❌ 文件过大: ${linesCheck.lines} 行 (限制: ${linesCheck.limit} 行)`);
      }
      allValid = false;
    } else {
      console.log(`✅ 行数检查通过: ${linesCheck.lines} 行`);
    }
    
    // 检查Mock数量
    const mockCheck = checkMockCount(file);
    if (!mockCheck.valid) {
      if (mockCheck.error) {
        console.log(`❌ Mock检查失败: ${mockCheck.error}`);
      } else {
        console.log(`❌ Mock过多: ${mockCheck.mocks} 个 (限制: ${mockCheck.limit} 个)`);
      }
      allValid = false;
    } else {
      console.log(`✅ Mock检查通过: ${mockCheck.mocks} 个`);
    }
  });
  
  if (allValid) {
    console.log('\n🎉 所有测试文件质量检查通过！');
    return true;
  } else {
    console.log('\n❌ 质量检查失败！请修正以上问题后重新提交。');
    console.log('\n📋 测试质量标准:');
    console.log(`   - 文件大小: ≤ ${QUALITY_STANDARDS.maxLines} 行`);
    console.log(`   - Mock数量: ≤ ${QUALITY_STANDARDS.maxMocks} 个`);
    console.log('\n💡 建议: 将大文件拆分成多个小文件，减少Mock使用');
    return false;
  }
}

// 执行检查
if (require.main === module) {
  const success = runQualityCheck();
  process.exit(success ? 0 : 1);
}

module.exports = { runQualityCheck, checkFileLines, checkMockCount };