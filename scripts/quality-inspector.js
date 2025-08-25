#!/usr/bin/env node
/**
 * 深度代码质量检测器
 * Phase 4: 建设深度测试体系 - 自动化质量检测工具
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

// TODO检测规则
const TODO_PATTERNS = [
  {
    pattern: /\/\/\s*TODO\s*:/gi,
    severity: 'medium',
    description: 'TODO comment found'
  },
  {
    pattern: /\/\/\s*FIXME\s*:/gi,
    severity: 'high', 
    description: 'FIXME comment found - requires immediate attention'
  },
  {
    pattern: /\/\/\s*HACK\s*:/gi,
    severity: 'high',
    description: 'HACK comment found - code quality issue'
  },
  {
    pattern: /throw new Error\(['"].*TODO.*['"]\)/gi,
    severity: 'high',
    description: 'TODO error throwing - unimplemented functionality'
  }
];

// 类型安全检测规则
const TYPE_SAFETY_PATTERNS = [
  {
    pattern: /:\s*any\b/g,
    severity: 'high',
    description: 'any type usage found',
    suggestion: 'Replace with specific type definition'
  },
  {
    pattern: /as\s+any\b/g,
    severity: 'high', 
    description: 'any type assertion found',
    suggestion: 'Use proper type assertion or fix underlying type issue'
  },
  {
    pattern: /Array<any>/g,
    severity: 'medium',
    description: 'Array with any type',
    suggestion: 'Specify array element type'
  }
];

// 资源泄漏检测规则
const RESOURCE_LEAK_PATTERNS = [
  {
    pattern: /setInterval\s*\(/g,
    checkPattern: /clearInterval\s*\(/g,
    severity: 'high',
    description: 'setInterval usage detected',
    suggestion: 'Ensure corresponding clearInterval in dispose/cleanup method'
  },
  {
    pattern: /setTimeout\s*\(/g,
    checkPattern: /clearTimeout\s*\(/g,
    severity: 'medium',
    description: 'setTimeout usage detected',
    suggestion: 'Consider clearing timeout in cleanup or early exit paths'
  },
  {
    pattern: /addEventListener\s*\(/g,
    checkPattern: /removeEventListener\s*\(/g,
    severity: 'medium',
    description: 'addEventListener usage detected',
    suggestion: 'Ensure corresponding removeEventListener in dispose method'
  },
  {
    pattern: /new\s+Worker\s*\(/g,
    checkPattern: /\.terminate\s*\(\s*\)/g,
    severity: 'high',
    description: 'Web Worker creation detected',
    suggestion: 'Ensure worker.terminate() is called in dispose method'
  }
];

class QualityInspector {
  constructor(srcPath = './src', excludePatterns = ['node_modules', '.git', 'dist']) {
    this.srcPath = srcPath;
    this.excludePatterns = excludePatterns;
  }

  /**
   * 执行完整的代码质量检测
   */
  async inspect() {
    console.log('🔍 开始深度代码质量检测...');
    
    const files = await this.getSourceFiles();
    const issues = [];
    
    let todoCount = 0;
    let anyTypeCount = 0;
    let resourceLeakCount = 0;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // TODO检测
      const todoIssues = this.detectTodos(file, lines);
      issues.push(...todoIssues);
      todoCount += todoIssues.length;

      // 类型安全检测
      const typeIssues = this.detectTypeSafetyIssues(file, lines);
      issues.push(...typeIssues);
      anyTypeCount += typeIssues.length;

      // 资源泄漏检测
      const leakIssues = this.detectResourceLeaks(file, content, lines);
      issues.push(...leakIssues);
      resourceLeakCount += leakIssues.length;
    }

    // 计算质量评分
    const qualityScore = this.calculateQualityScore(issues, files.length);

    const result = {
      todoCount,
      anyTypeCount,
      resourceLeakCount,
      qualityScore,
      issues
    };

    this.printReport(result, files.length);
    
    return result;
  }

  /**
   * 获取所有源码文件
   */
  async getSourceFiles() {
    const patterns = [
      `${this.srcPath}/**/*.ts`,
      `${this.srcPath}/**/*.tsx`,
      `${this.srcPath}/**/*.js`,
      `${this.srcPath}/**/*.jsx`
    ];

    const files = [];
    for (const pattern of patterns) {
      const matchedFiles = await glob(pattern, {
        ignore: this.excludePatterns.map(p => `**/${p}/**`)
      });
      files.push(...matchedFiles);
    }

    return files.filter((file, index, self) => self.indexOf(file) === index);
  }

  /**
   * 检测TODO标记
   */
  detectTodos(file, lines) {
    const issues = [];

    lines.forEach((line, index) => {
      for (const pattern of TODO_PATTERNS) {
        const matches = line.match(pattern.pattern);
        if (matches) {
          issues.push({
            type: 'todo',
            severity: pattern.severity,
            file,
            line: index + 1,
            description: `${pattern.description}: ${line.trim()}`,
            suggestion: 'Consider implementing or removing TODO items'
          });
        }
      }
    });

    return issues;
  }

  /**
   * 检测类型安全问题
   */
  detectTypeSafetyIssues(file, lines) {
    const issues = [];

    lines.forEach((line, index) => {
      for (const pattern of TYPE_SAFETY_PATTERNS) {
        const matches = line.match(pattern.pattern);
        if (matches) {
          // 排除注释和字符串中的误报
          if (this.isInCommentOrString(line)) {
            continue;
          }

          issues.push({
            type: 'any-type',
            severity: pattern.severity,
            file,
            line: index + 1,
            description: `${pattern.description}: ${line.trim()}`,
            suggestion: pattern.suggestion
          });
        }
      }
    });

    return issues;
  }

  /**
   * 检测资源泄漏模式
   */
  detectResourceLeaks(file, content, lines) {
    const issues = [];

    for (const pattern of RESOURCE_LEAK_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      
      if (matches.length > 0) {
        // 检查是否有对应的清理代码
        const hasCleanup = pattern.checkPattern ? 
          pattern.checkPattern.test(content) : false;

        if (!hasCleanup) {
          // 找到具体的行号
          matches.forEach(match => {
            const lineIndex = content.substr(0, match.index).split('\n').length - 1;
            issues.push({
              type: 'resource-leak',
              severity: pattern.severity,
              file,
              line: lineIndex + 1,
              description: `${pattern.description}: ${lines[lineIndex]?.trim()}`,
              suggestion: pattern.suggestion
            });
          });
        }
      }
    }

    return issues;
  }

  /**
   * 检查是否在注释或字符串中
   */
  isInCommentOrString(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || 
           trimmed.startsWith('/*') || 
           trimmed.includes('//') ||
           /['"`].*any.*['"`]/.test(line);
  }

  /**
   * 计算代码质量评分
   */
  calculateQualityScore(issues, fileCount) {
    if (fileCount === 0) return 100;

    let penalty = 0;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'high':
          penalty += 5;
          break;
        case 'medium':
          penalty += 2;
          break;
        case 'low':
          penalty += 1;
          break;
      }
    });

    // 基于文件数量归一化惩罚
    const normalizedPenalty = penalty / fileCount;
    const score = Math.max(0, 100 - normalizedPenalty);
    
    return Math.round(score * 100) / 100;
  }

  /**
   * 打印检测报告
   */
  printReport(result, fileCount) {
    console.log('\n📊 代码质量检测报告');
    console.log('='.repeat(50));
    console.log(`📁 检测文件数: ${fileCount}`);
    console.log(`🎯 质量评分: ${result.qualityScore}/100`);
    console.log(`📋 TODO标记: ${result.todoCount}`);
    console.log(`🔀 any类型: ${result.anyTypeCount}`);
    console.log(`💧 资源泄漏: ${result.resourceLeakCount}`);
    console.log(`⚠️  总问题数: ${result.issues.length}`);
    
    // 按严重程度分组显示
    const highIssues = result.issues.filter(i => i.severity === 'high');
    const mediumIssues = result.issues.filter(i => i.severity === 'medium');
    const lowIssues = result.issues.filter(i => i.severity === 'low');

    if (highIssues.length > 0) {
      console.log(`\n🚨 高严重程度问题 (${highIssues.length}):`);
      highIssues.slice(0, 10).forEach(issue => {
        console.log(`   ${issue.file}:${issue.line} - ${issue.description}`);
      });
      if (highIssues.length > 10) {
        console.log(`   ... 还有 ${highIssues.length - 10} 个高优先级问题`);
      }
    }

    if (mediumIssues.length > 0) {
      console.log(`\n⚠️  中等严重程度问题 (${mediumIssues.length}):`);
      mediumIssues.slice(0, 5).forEach(issue => {
        console.log(`   ${issue.file}:${issue.line} - ${issue.description}`);
      });
      if (mediumIssues.length > 5) {
        console.log(`   ... 还有 ${mediumIssues.length - 5} 个中等优先级问题`);
      }
    }

    // 质量评分解释
    console.log('\n📈 质量评分说明:');
    if (result.qualityScore >= 90) {
      console.log('   ✅ 优秀 - 代码质量很高');
    } else if (result.qualityScore >= 80) {
      console.log('   ✅ 良好 - 代码质量不错，有少量改进空间');
    } else if (result.qualityScore >= 70) {
      console.log('   ⚠️  一般 - 存在一些质量问题，建议优化');
    } else if (result.qualityScore >= 60) {
      console.log('   ⚠️  偏低 - 存在较多质量问题，需要重点改进');
    } else {
      console.log('   🚨 差 - 存在严重质量问题，需要立即处理');
    }

    console.log('\n💡 改进建议:');
    if (result.todoCount > 0) {
      console.log(`   📋 处理 ${result.todoCount} 个TODO标记`);
    }
    if (result.anyTypeCount > 0) {
      console.log(`   🔀 修复 ${result.anyTypeCount} 个any类型使用`);
    }
    if (result.resourceLeakCount > 0) {
      console.log(`   💧 修复 ${result.resourceLeakCount} 个潜在资源泄漏`);
    }
  }

  /**
   * 生成JSON格式报告
   */
  async generateJsonReport(result, outputPath) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        qualityScore: result.qualityScore,
        todoCount: result.todoCount,
        anyTypeCount: result.anyTypeCount,
        resourceLeakCount: result.resourceLeakCount,
        totalIssues: result.issues.length
      },
      issues: result.issues,
      recommendations: this.generateRecommendations(result)
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已生成: ${outputPath}`);
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(result) {
    const recommendations = [];

    if (result.todoCount > 10) {
      recommendations.push('TODO标记过多，建议制定清理计划，优先处理高优先级项目');
    }

    if (result.anyTypeCount > 5) {
      recommendations.push('any类型使用频繁，建议加强TypeScript类型定义');
    }

    if (result.resourceLeakCount > 0) {
      recommendations.push('存在潜在资源泄漏，建议实现统一的资源清理机制');
    }

    if (result.qualityScore < 80) {
      recommendations.push('整体代码质量需要改进，建议制定代码质量提升计划');
    }

    return recommendations;
  }
}

// CLI 运行逻辑
async function main() {
  try {
    const inspector = new QualityInspector();
    const result = await inspector.inspect();
    
    // 生成详细报告
    await inspector.generateJsonReport(result, './quality-report.json');
    
    // 根据质量评分决定退出代码
    const exitCode = result.qualityScore < 70 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ 质量检测失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { QualityInspector };