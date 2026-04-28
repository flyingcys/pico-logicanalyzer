#!/usr/bin/env ts-node

/**
 * 发布前检查脚本
 * 确保项目在发布前满足所有质量要求
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  required: boolean;
}

class ReleaseChecker {
  private results: CheckResult[] = [];
  private projectRoot = process.cwd();

  async runAllChecks(): Promise<void> {
    console.log('🔍 开始发布前检查...\n');

    await this.checkProjectStructure();
    await this.checkPackageJson();
    await this.checkDocumentation();
    await this.checkTypeScript();
    await this.checkLinting();
    await this.checkTests();
    await this.checkBuild();
    await this.checkSecurity();
    await this.checkPerformance();
    await this.checkCompatibility();

    this.printResults();
  }

  private async checkProjectStructure(): Promise<void> {
    console.log('📁 检查项目结构...');

    const requiredDirs = [
      'src',
      'src/drivers',
      'src/decoders',
      'src/webview',
      'src/models',
      'tests',
      'docs'
    ];

    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'webpack.config.js',
      'README.md',
      'CHANGELOG.md',
      'RELEASE_NOTES.md',
      'CLAUDE.md',
      'docs/release-gate.md',
      'docs/功能状态矩阵.md',
      'docs/文档状态索引.md',
      'docs/user-manual.md',
      'docs/developer-guide.md',
      'docs/api-reference.md'
    ];

    requiredDirs.forEach(dir => {
      const exists = fs.existsSync(path.join(this.projectRoot, dir));
      this.addResult(`目录 ${dir}`, exists, exists ? '存在' : '缺失', true);
    });

    requiredFiles.forEach(file => {
      const exists = fs.existsSync(path.join(this.projectRoot, file));
      this.addResult(`文件 ${file}`, exists, exists ? '存在' : '缺失', true);
    });
  }

  private async checkPackageJson(): Promise<void> {
    console.log('📦 检查 package.json...');

    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      // 检查必要字段
      const requiredFields = ['name', 'version', 'description', 'main', 'engines'];
      requiredFields.forEach(field => {
        const exists = packageJson[field] !== undefined;
        this.addResult(`package.json.${field}`, exists, exists ? '已定义' : '缺失', true);
      });

      // 检查版本格式
      const versionRegex = /^\d+\.\d+\.\d+(-\w+\.\d+)?$/;
      const validVersion = versionRegex.test(packageJson.version);
      this.addResult('版本号格式', validVersion, 
        validVersion ? `${packageJson.version} (有效)` : `${packageJson.version} (无效)`, true);

      // 检查VSCode引擎版本
      const vscodeEngine = packageJson.engines?.vscode;
      const validEngine = vscodeEngine && vscodeEngine.startsWith('^1.');
      this.addResult('VSCode引擎版本', validEngine, 
        validEngine ? `${vscodeEngine} (有效)` : '无效或缺失', true);

      // 检查贡献点
      const hasContributes = packageJson.contributes && 
        (packageJson.contributes.commands || packageJson.contributes.configuration);
      this.addResult('VSCode贡献点', hasContributes, 
        hasContributes ? '已配置' : '缺失commands或configuration', true);

    } catch (error) {
      this.addResult('package.json解析', false, `解析失败: ${error.message}`, true);
    }
  }

  private async checkDocumentation(): Promise<void> {
    console.log('📚 检查文档完整性...');

    const docFiles = [
      { file: 'README.md', minSize: 5000, description: '项目主文档' },
      { file: 'docs/user-manual.md', minSize: 20000, description: '用户手册' },
      { file: 'docs/developer-guide.md', minSize: 15000, description: '开发者指南' },
      { file: 'docs/api-reference.md', minSize: 25000, description: 'API参考' },
      { file: 'CHANGELOG.md', minSize: 2000, description: '更新日志' }
    ];

    docFiles.forEach(({ file, minSize, description }) => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeOk = stats.size >= minSize;
        this.addResult(`${description}大小`, sizeOk, 
          `${Math.round(stats.size / 1024)}KB (要求≥${Math.round(minSize / 1024)}KB)`, true);
      }
    });

    // 检查README内容
    const readmePath = path.join(this.projectRoot, 'README.md');
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf8');
      const hasInstallSection = content.includes('## 🚀 快速开始') || content.includes('安装');
      const hasUsageSection = content.includes('使用') || content.includes('Usage');
      
      this.addResult('README安装说明', hasInstallSection, 
        hasInstallSection ? '包含' : '缺失', true);
      this.addResult('README使用说明', hasUsageSection, 
        hasUsageSection ? '包含' : '缺失', true);
    }
  }

  private async checkTypeScript(): Promise<void> {
    console.log('📝 检查 TypeScript...');

    try {
      // 类型检查
      execSync('npm run typecheck', { stdio: 'pipe' });
      this.addResult('TypeScript类型检查', true, '通过', true);
    } catch (error) {
      this.addResult('TypeScript类型检查', false, '失败', true);
    }

    // 检查 tsconfig.json
    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        const strictMode = tsconfig.compilerOptions?.strict === true;
        this.addResult('TypeScript严格模式', strictMode, 
          strictMode ? '已启用' : '未启用', true);
      } catch (error) {
        this.addResult('tsconfig.json解析', false, '解析失败', true);
      }
    }
  }

  private async checkLinting(): Promise<void> {
    console.log('🔍 检查代码规范...');

    try {
      execSync('npm run lint', { stdio: 'pipe' });
      this.addResult('ESLint检查', true, '通过', true);
    } catch (error) {
      this.addResult('ESLint检查', false, '发现问题', true);
    }

    try {
      execSync('npm run format:check', { stdio: 'pipe' });
      this.addResult('Prettier格式检查', true, '通过', false);
    } catch (error) {
      this.addResult('Prettier格式检查', false, '格式不一致', false);
    }
  }

  private async checkTests(): Promise<void> {
    console.log('🧪 检查测试...');

    // 检查测试文件是否存在
    const testDirs = ['tests/unit', 'tests/integration', 'tests/performance'];
    testDirs.forEach(dir => {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        const files = this.getAllTestFiles(dirPath);
        this.addResult(`${dir}测试文件`, files.length > 0,
          `${files.length}个测试文件`, dir === 'tests/unit');
      }
    });

    // 运行发布门槛使用的快速分层测试，避免 raw npm test 触发长耗时或开放句柄路径。
    try {
      execSync('npm run test:ci:quick -- --skip-install', {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 120000 // 2分钟超时
      });
      this.addResult('Quick 分层测试', true, '通过', true);

    } catch (error) {
      this.addResult('Quick 分层测试', false, '测试执行失败', true);
    }

    // 覆盖率仍作为建议项，不作为 Beta 发布阻断条件。
    try {
      const output = execSync('npm run test -- --coverage', {
        stdio: 'pipe',
        encoding: 'utf8' 
      });
      
      const coverageRegex = /All files\s+\|\s+([\d.]+)/;
      const match = output.match(coverageRegex);
      
      if (match) {
        const coverage = parseFloat(match[1]);
        const coverageOk = coverage >= 80;
        this.addResult('测试覆盖率', coverageOk, 
          `${coverage}% (要求≥80%)`, true);
      }
    } catch (error) {
      this.addResult('测试覆盖率检查', false, '无法获取覆盖率', false);
    }
  }

  private async checkBuild(): Promise<void> {
    console.log('🔨 检查构建...');

    try {
      // 清理旧构建
      execSync('npm run clean', { stdio: 'pipe' });
      
      // 生产构建
      execSync('npm run build:production', { 
        stdio: 'pipe',
        timeout: 300000 // 5分钟超时
      });
      
      this.addResult('生产构建', true, '成功', true);
      
      // 检查输出文件
      const outDir = path.join(this.projectRoot, 'out');
      if (fs.existsSync(outDir)) {
        const extensionJs = path.join(outDir, 'extension.js');
        const webviewDir = path.join(outDir, 'webview');
        
        this.addResult('extension.js输出', fs.existsSync(extensionJs), 
          fs.existsSync(extensionJs) ? '存在' : '缺失', true);
        this.addResult('webview输出', fs.existsSync(webviewDir), 
          fs.existsSync(webviewDir) ? '存在' : '缺失', true);
      }
      
    } catch (error) {
      this.addResult('生产构建', false, `构建失败: ${error.message}`, true);
    }

    try {
      execSync('npm run package:dry', {
        stdio: 'pipe',
        timeout: 120000
      });
      this.addResult('VSIX dry run', true, '通过', true);
    } catch (error) {
      this.addResult('VSIX dry run', false, `检查失败: ${error.message}`, true);
    }
  }

  private async checkSecurity(): Promise<void> {
    console.log('🔒 检查安全性...');

    try {
      // npm audit
      const auditOutput = execSync('npm audit --audit-level=high', { 
        stdio: 'pipe', 
        encoding: 'utf8' 
      });
      
      const hasHighVulns = auditOutput.includes('high') || auditOutput.includes('critical');
      this.addResult('依赖安全审计', !hasHighVulns, 
        hasHighVulns ? '发现高风险漏洞' : '无高风险漏洞', true);
        
    } catch (error) {
      // npm audit 在发现漏洞时会返回非零退出码
      const output = error.stdout || error.message;
      const hasHighVulns = output.includes('high') || output.includes('critical');
      this.addResult('依赖安全审计', !hasHighVulns, 
        hasHighVulns ? '发现高风险漏洞' : '检查完成', true);
    }

    // 检查是否有敏感文件
    const sensitivePatterns = [
      '.env',
      '*.key',
      '*.pem',
      'config/secrets.*'
    ];

    let hasSensitiveFiles = false;
    sensitivePatterns.forEach(pattern => {
      // 简单的文件名检查
      if (pattern.includes('*')) {
        const prefix = pattern.split('*')[0];
        const files = fs.readdirSync(this.projectRoot);
        if (files.some(f => f.startsWith(prefix))) {
          hasSensitiveFiles = true;
        }
      } else {
        if (fs.existsSync(path.join(this.projectRoot, pattern))) {
          hasSensitiveFiles = true;
        }
      }
    });

    this.addResult('敏感文件检查', !hasSensitiveFiles, 
      hasSensitiveFiles ? '发现敏感文件' : '无敏感文件', true);
  }

  private async checkPerformance(): Promise<void> {
    console.log('⚡ 检查性能...');

    // 检查包大小
    const packagePath = path.join(this.projectRoot, 'out');
    if (fs.existsSync(packagePath)) {
      const totalSize = this.getDirectorySize(packagePath);
      const sizeOk = totalSize < 50 * 1024 * 1024; // 50MB
      
      this.addResult('构建包大小', sizeOk, 
        `${Math.round(totalSize / 1024 / 1024)}MB (限制<50MB)`, false);
    }

    // 检查依赖数量
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
      
      this.addResult('生产依赖数量', depCount < 20, 
        `${depCount}个 (建议<20个)`, false);
      this.addResult('开发依赖数量', devDepCount < 50, 
        `${devDepCount}个 (建议<50个)`, false);
        
    } catch (error) {
      // 已在其他地方检查过package.json
    }
  }

  private async checkCompatibility(): Promise<void> {
    console.log('🌐 检查兼容性...');

    // 检查Node.js版本要求
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const nodeVersion = packageJson.engines?.node;
      
      if (nodeVersion) {
        this.addResult('Node.js版本要求', true, nodeVersion, false);
      } else {
        this.addResult('Node.js版本要求', false, '未指定', false);
      }
    } catch (error) {
      // 忽略，已在其他地方处理
    }

    // 检查平台特定代码
    const srcFiles = this.getAllTsFiles(path.join(this.projectRoot, 'src'));
    let hasPlatformCode = false;
    
    srcFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('process.platform') || content.includes('os.platform()')) {
        hasPlatformCode = true;
      }
    });

    this.addResult('跨平台代码检查', hasPlatformCode, 
      hasPlatformCode ? '包含平台特定处理' : '无平台特定代码', false);
  }

  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  private getAllTsFiles(dirPath: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dirPath)) return files;
    
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        files.push(...this.getAllTsFiles(fullPath));
      } else if (entry.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private getAllTestFiles(dirPath: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dirPath)) return files;

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...this.getAllTestFiles(fullPath));
      } else if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private addResult(name: string, passed: boolean, message: string, required: boolean): void {
    this.results.push({ name, passed, message, required });
    
    const emoji = passed ? '✅' : required ? '❌' : '⚠️';
    const status = required ? (passed ? '通过' : '失败') : (passed ? '通过' : '警告');
    
    console.log(`  ${emoji} ${name}: ${message} (${status})`);
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 发布检查结果汇总');
    console.log('='.repeat(60));

    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed && r.required).length;
    const warnings = this.results.filter(r => !r.passed && !r.required).length;

    console.log(`\n总检查项: ${total}`);
    console.log(`✅ 通过: ${passed} (${(passed/total*100).toFixed(1)}%)`);
    console.log(`❌ 失败: ${failed} (${(failed/total*100).toFixed(1)}%)`);
    console.log(`⚠️  警告: ${warnings} (${(warnings/total*100).toFixed(1)}%)`);

    // 显示失败的必需项
    const criticalFailures = this.results.filter(r => !r.passed && r.required);
    if (criticalFailures.length > 0) {
      console.log('\n❌ 关键问题需要修复:');
      criticalFailures.forEach(failure => {
        console.log(`  • ${failure.name}: ${failure.message}`);
      });
    }

    // 显示警告项
    const warningItems = this.results.filter(r => !r.passed && !r.required);
    if (warningItems.length > 0) {
      console.log('\n⚠️  建议改进的项目:');
      warningItems.slice(0, 5).forEach(warning => {
        console.log(`  • ${warning.name}: ${warning.message}`);
      });
      
      if (warningItems.length > 5) {
        console.log(`  • 还有 ${warningItems.length - 5} 个建议项...`);
      }
    }

    // 最终判定
    console.log('\n' + '='.repeat(60));
    if (failed === 0) {
      console.log('🎉 项目已准备好发布！');
      console.log('✨ 所有关键检查项都已通过');
      
      if (warnings > 0) {
        console.log(`⚠️  建议处理 ${warnings} 个警告项以获得更好的质量`);
      }
    } else {
      console.log('🚨 项目尚未准备好发布');
      console.log(`❌ 需要修复 ${failed} 个关键问题`);
      console.log('🔧 修复所有问题后再次运行检查');
    }
    console.log('='.repeat(60));

    // 退出码
    process.exit(failed > 0 ? 1 : 0);
  }
}

// 运行检查
if (require.main === module) {
  const checker = new ReleaseChecker();
  checker.runAllChecks().catch(error => {
    console.error('检查脚本执行失败:', error);
    process.exit(1);
  });
}

export { ReleaseChecker };
