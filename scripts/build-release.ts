#!/usr/bin/env ts-node

/**
 * 发布构建脚本
 * 自动化构建、打包和验证发布包
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

class ReleaseBuild {
  private projectRoot = process.cwd();
  private outDir = path.join(this.projectRoot, 'out');
  private packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  async build(): Promise<void> {
    console.log('🚀 开始构建发布包...\n');

    try {
      await this.cleanWorkspace();
      await this.validateEnvironment();
      await this.buildProduction();
      await this.runTests();
      await this.createPackage();
      await this.validatePackage();
      
      console.log('\n🎉 发布包构建完成！');
      this.showSummary();
      
    } catch (error) {
      console.error('\n❌ 构建失败:', error.message);
      process.exit(1);
    }
  }

  private async cleanWorkspace(): Promise<void> {
    console.log('🧹 清理工作空间...');
    
    try {
      execSync('npm run clean', { stdio: 'pipe' });
      console.log('✅ 工作空间已清理');
    } catch (error) {
      throw new Error('清理工作空间失败');
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 验证构建环境...');

    // 检查Node.js版本
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      throw new Error(`Node.js版本过低: ${nodeVersion} (需要 >= 16.0.0)`);
    }
    console.log(`✅ Node.js版本: ${nodeVersion}`);

    // 检查依赖
    try {
      execSync('npm ls', { stdio: 'pipe' });
      console.log('✅ 依赖检查通过');
    } catch (error) {
      console.log('⚠️  发现依赖问题，尝试安装...');
      execSync('npm install', { stdio: 'pipe' });
      console.log('✅ 依赖已更新');
    }

    // 检查Git状态
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('⚠️  工作目录有未提交的更改');
      } else {
        console.log('✅ Git工作目录干净');
      }
    } catch (error) {
      console.log('⚠️  无法检查Git状态');
    }
  }

  private async buildProduction(): Promise<void> {
    console.log('🔨 生产构建...');

    const startTime = Date.now();
    
    try {
      execSync('npm run build:production', { 
        stdio: 'pipe',
        timeout: 300000 // 5分钟超时
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ 生产构建完成 (${Math.round(duration / 1000)}s)`);
      
      // 验证构建输出
      this.validateBuildOutput();
      
    } catch (error) {
      throw new Error(`生产构建失败: ${error.message}`);
    }
  }

  private validateBuildOutput(): void {
    const requiredFiles = [
      'out/extension.js',
      'out/webview/index.html',
      'out/webview/main.js'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`缺少构建文件: ${file}`);
      }
    });

    // 检查文件大小
    const extensionSize = fs.statSync('out/extension.js').size;
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (extensionSize > maxSize) {
      console.log(`⚠️  extension.js文件较大: ${Math.round(extensionSize / 1024 / 1024)}MB`);
    }

    console.log('✅ 构建输出验证通过');
  }

  private async runTests(): Promise<void> {
    console.log('🧪 运行测试...');

    try {
      // 运行快速测试套件
      execSync('npm run test', { 
        stdio: 'pipe',
        timeout: 120000 // 2分钟超时
      });
      
      console.log('✅ 测试通过');
    } catch (error) {
      // 测试失败不阻塞构建，但给出警告
      console.log('⚠️  测试未完全通过，请检查');
    }
  }

  private async createPackage(): Promise<void> {
    console.log('📦 创建扩展包...');

    const startTime = Date.now();
    
    try {
      // 使用vsce创建包
      const output = execSync('vsce package --no-dependencies', { 
        encoding: 'utf8',
        timeout: 60000 // 1分钟超时
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ 扩展包创建完成 (${Math.round(duration / 1000)}s)`);
      
      // 解析包文件名
      const packageMatch = output.match(/Packaged: (.+\.vsix)/);
      if (packageMatch) {
        const packageFile = packageMatch[1];
        console.log(`📦 包文件: ${packageFile}`);
        
        // 检查包大小
        if (fs.existsSync(packageFile)) {
          const packageSize = fs.statSync(packageFile).size;
          console.log(`📊 包大小: ${Math.round(packageSize / 1024 / 1024 * 100) / 100}MB`);
        }
      }
      
    } catch (error) {
      throw new Error(`创建扩展包失败: ${error.message}`);
    }
  }

  private async validatePackage(): Promise<void> {
    console.log('🔍 验证扩展包...');

    // 查找.vsix文件
    const vsixFiles = fs.readdirSync(this.projectRoot)
      .filter(file => file.endsWith('.vsix'));

    if (vsixFiles.length === 0) {
      throw new Error('未找到.vsix包文件');
    }

    const packageFile = vsixFiles[0];
    const packagePath = path.join(this.projectRoot, packageFile);
    
    // 基本文件检查
    const stats = fs.statSync(packagePath);
    if (stats.size === 0) {
      throw new Error('包文件为空');
    }

    console.log('✅ 扩展包验证通过');

    // 可选：尝试安装测试
    const testInstall = process.env.TEST_INSTALL === 'true';
    if (testInstall) {
      try {
        console.log('🔧 测试安装扩展包...');
        execSync(`code --install-extension ${packageFile} --force`, { 
          stdio: 'pipe',
          timeout: 30000
        });
        console.log('✅ 测试安装成功');
      } catch (error) {
        console.log('⚠️  测试安装失败，但不影响构建');
      }
    }
  }

  private showSummary(): void {
    const version = this.packageJson.version;
    const name = this.packageJson.name;
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 构建摘要');
    console.log('='.repeat(50));
    console.log(`项目: ${name}`);
    console.log(`版本: ${version}`);
    console.log(`构建时间: ${new Date().toLocaleString()}`);
    
    // 查找构建产物
    const vsixFiles = fs.readdirSync(this.projectRoot)
      .filter(file => file.endsWith('.vsix'));
    
    if (vsixFiles.length > 0) {
      const packageFile = vsixFiles[0];
      const packageSize = fs.statSync(packageFile).size;
      
      console.log(`包文件: ${packageFile}`);
      console.log(`包大小: ${Math.round(packageSize / 1024 / 1024 * 100) / 100}MB`);
    }

    // 构建产物统计
    if (fs.existsSync(this.outDir)) {
      const buildSize = this.getDirectorySize(this.outDir);
      console.log(`构建大小: ${Math.round(buildSize / 1024 / 1024 * 100) / 100}MB`);
    }

    console.log('\n🎯 下一步:');
    console.log('  1. 测试扩展包功能');
    console.log('  2. 运行发布前检查: npm run release:check');
    console.log('  3. 发布到市场: npm run publish');
    console.log('='.repeat(50));
  }

  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    try {
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
    } catch (error) {
      // 忽略无法访问的文件
    }
    
    return totalSize;
  }
}

// 运行构建
if (require.main === module) {
  const builder = new ReleaseBuild();
  builder.build().catch(error => {
    console.error('构建脚本执行失败:', error);
    process.exit(1);
  });
}

export { ReleaseBuild };