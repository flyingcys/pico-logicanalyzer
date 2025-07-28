#!/usr/bin/env ts-node

/**
 * 版本管理脚本
 * 自动化版本更新、标签创建和发布准备
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

interface VersionInfo {
  current: string;
  next: string;
  type: 'major' | 'minor' | 'patch' | 'prerelease' | 'custom';
}

class VersionManager {
  private projectRoot = process.cwd();
  private packageJsonPath = path.join(this.projectRoot, 'package.json');
  private changelogPath = path.join(this.projectRoot, 'CHANGELOG.md');

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'bump':
        await this.bumpVersion(args[1] as any);
        break;
      case 'prepare':
        await this.prepareRelease();
        break;
      case 'status':
        await this.showStatus();
        break;
      case 'tag':
        await this.createTag();
        break;
      default:
        this.showHelp();
    }
  }

  private async bumpVersion(type?: 'major' | 'minor' | 'patch' | 'prerelease'): Promise<void> {
    console.log('📈 版本更新工具\n');

    const packageJson = this.readPackageJson();
    const currentVersion = packageJson.version;

    console.log(`当前版本: ${currentVersion}`);

    // 如果没有指定类型，询问用户
    const versionType = type || await this.promptVersionType();
    const nextVersion = this.calculateNextVersion(currentVersion, versionType);

    console.log(`新版本: ${nextVersion}\n`);

    // 确认更新
    const confirmed = await this.confirmAction(`确定要将版本从 ${currentVersion} 更新到 ${nextVersion} 吗？`);
    if (!confirmed) {
      console.log('❌ 取消版本更新');
      return;
    }

    // 执行更新
    await this.updateVersion(nextVersion);
    console.log('✅ 版本更新完成');
  }

  private async prepareRelease(): Promise<void> {
    console.log('🚀 准备发布...\n');

    const packageJson = this.readPackageJson();
    const version = packageJson.version;

    console.log(`准备发布版本: ${version}`);

    // 1. 检查工作目录是否干净
    console.log('1. 检查Git状态...');
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('❌ 工作目录不干净，请先提交所有更改');
        console.log('未提交的更改:');
        console.log(status);
        return;
      }
      console.log('✅ 工作目录干净');
    } catch (error) {
      console.log('⚠️  无法检查Git状态，请确保在Git仓库中');
    }

    // 2. 运行发布前检查
    console.log('\n2. 运行发布前检查...');
    try {
      execSync('npm run release:check', { stdio: 'inherit' });
      console.log('✅ 发布前检查通过');
    } catch (error) {
      console.log('❌ 发布前检查失败，请修复问题后重试');
      return;
    }

    // 3. 更新CHANGELOG
    console.log('\n3. 更新CHANGELOG...');
    await this.updateChangelog(version);

    // 4. 构建生产版本
    console.log('\n4. 构建生产版本...');
    try {
      execSync('npm run build:production', { stdio: 'inherit' });
      console.log('✅ 生产构建完成');
    } catch (error) {
      console.log('❌ 生产构建失败');
      return;
    }

    // 5. 创建发布标签
    console.log('\n5. 创建Git标签...');
    try {
      const tagName = `v${version}`;
      execSync(`git add .`);
      execSync(`git commit -m "chore: prepare release ${version}"`);
      execSync(`git tag -a ${tagName} -m "Release ${version}"`);
      console.log(`✅ 创建标签: ${tagName}`);
    } catch (error) {
      console.log('⚠️  Git操作失败，可能需要手动处理');
    }

    console.log('\n🎉 发布准备完成！');
    console.log('\n下一步:');
    console.log(`  1. 检查构建结果: ./out/`);
    console.log(`  2. 测试扩展包: npm run package`);
    console.log(`  3. 发布到市场: npm run publish`);
    console.log(`  4. 推送到远程: git push origin main --tags`);
  }

  private async showStatus(): Promise<void> {
    console.log('📊 项目状态\n');

    const packageJson = this.readPackageJson();
    console.log(`项目名称: ${packageJson.name}`);
    console.log(`当前版本: ${packageJson.version}`);
    console.log(`描述: ${packageJson.description}`);

    // Git信息
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const lastCommit = execSync('git log -1 --format="%h %s"', { encoding: 'utf8' }).trim();
      const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' }).trim().split('\n');
      
      console.log(`\nGit分支: ${branch}`);
      console.log(`最近提交: ${lastCommit}`);
      console.log(`最新标签: ${tags[0] || '无'}`);
    } catch (error) {
      console.log('\n⚠️  无法获取Git信息');
    }

    // 检查构建状态
    const outDir = path.join(this.projectRoot, 'out');
    if (fs.existsSync(outDir)) {
      const stats = fs.statSync(outDir);
      console.log(`\n构建目录: ${outDir}`);
      console.log(`最后构建: ${stats.mtime.toLocaleString()}`);
      
      const files = fs.readdirSync(outDir);
      console.log(`构建文件: ${files.length}个文件`);
    } else {
      console.log('\n❌ 尚未构建');
    }

    // 检查依赖
    try {
      const outdated = execSync('npm outdated --json', { encoding: 'utf8' });
      const outdatedPkgs = JSON.parse(outdated || '{}');
      const count = Object.keys(outdatedPkgs).length;
      
      if (count > 0) {
        console.log(`\n⚠️  ${count}个依赖有更新版本`);
      } else {
        console.log('\n✅ 所有依赖都是最新版本');
      }
    } catch (error) {
      console.log('\n✅ 依赖检查完成');
    }
  }

  private async createTag(): Promise<void> {
    const packageJson = this.readPackageJson();
    const version = packageJson.version;
    const tagName = `v${version}`;

    console.log(`创建标签: ${tagName}`);

    const confirmed = await this.confirmAction(`确定要创建标签 ${tagName} 吗？`);
    if (!confirmed) {
      console.log('❌ 取消创建标签');
      return;
    }

    try {
      execSync(`git tag -a ${tagName} -m "Release ${version}"`);
      console.log(`✅ 标签 ${tagName} 创建成功`);
      
      const pushTags = await this.confirmAction('是否推送标签到远程仓库？');
      if (pushTags) {
        execSync(`git push origin ${tagName}`);
        console.log('✅ 标签已推送到远程');
      }
    } catch (error) {
      console.log(`❌ 创建标签失败: ${error.message}`);
    }
  }

  private readPackageJson(): any {
    try {
      return JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    } catch (error) {
      console.error('❌ 无法读取 package.json');
      process.exit(1);
    }
  }

  private writePackageJson(packageJson: any): void {
    try {
      fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    } catch (error) {
      console.error('❌ 无法写入 package.json');
      process.exit(1);
    }
  }

  private async promptVersionType(): Promise<'major' | 'minor' | 'patch' | 'prerelease'> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('选择版本更新类型:');
    console.log('1. patch (0.0.X) - 修复问题');
    console.log('2. minor (0.X.0) - 新增功能');
    console.log('3. major (X.0.0) - 重大变更');
    console.log('4. prerelease (X.X.X-beta.X) - 预发布版本');

    return new Promise((resolve) => {
      rl.question('请选择 (1-4): ', (answer) => {
        rl.close();
        
        switch (answer.trim()) {
          case '1': resolve('patch'); break;
          case '2': resolve('minor'); break;
          case '3': resolve('major'); break;
          case '4': resolve('prerelease'); break;
          default:
            console.log('❌ 无效选择，默认使用 patch');
            resolve('patch');
        }
      });
    });
  }

  private calculateNextVersion(current: string, type: 'major' | 'minor' | 'patch' | 'prerelease'): string {
    const parts = current.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2].split('-')[0]);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      case 'prerelease':
        if (current.includes('-')) {
          // 已经是预发布版本，增加预发布号
          const preMatch = current.match(/-(\w+)\.(\d+)$/);
          if (preMatch) {
            const preType = preMatch[1];
            const preNum = parseInt(preMatch[2]);
            return `${major}.${minor}.${patch}-${preType}.${preNum + 1}`;
          }
        }
        return `${major}.${minor}.${patch + 1}-beta.0`;
      default:
        throw new Error(`未知的版本类型: ${type}`);
    }
  }

  private async updateVersion(newVersion: string): Promise<void> {
    // 更新 package.json
    const packageJson = this.readPackageJson();
    packageJson.version = newVersion;
    this.writePackageJson(packageJson);

    console.log('✅ package.json 已更新');

    // 更新其他可能包含版本号的文件
    await this.updateVersionInFiles(newVersion);
  }

  private async updateVersionInFiles(version: string): Promise<void> {
    const filesToUpdate = [
      { file: 'README.md', pattern: /版本:\s*v?[\d.-]+/g, replacement: `版本: v${version}` },
      { file: 'src/extension.ts', pattern: /version:\s*['"][\d.-]+['"]/g, replacement: `version: '${version}'` }
    ];

    filesToUpdate.forEach(({ file, pattern, replacement }) => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        try {
          let content = fs.readFileSync(filePath, 'utf8');
          const updated = content.replace(pattern, replacement);
          
          if (updated !== content) {
            fs.writeFileSync(filePath, updated);
            console.log(`✅ ${file} 版本号已更新`);
          }
        } catch (error) {
          console.log(`⚠️  更新 ${file} 失败: ${error.message}`);
        }
      }
    });
  }

  private async updateChangelog(version: string): Promise<void> {
    if (!fs.existsSync(this.changelogPath)) {
      console.log('⚠️  CHANGELOG.md 不存在，跳过更新');
      return;
    }

    const date = new Date().toISOString().split('T')[0];
    const content = fs.readFileSync(this.changelogPath, 'utf8');
    
    // 替换 [未发布] 为具体版本和日期
    const updatedContent = content.replace(
      '## [未发布]',
      `## [未发布]\n\n## [${version}] - ${date}`
    );

    if (updatedContent !== content) {
      fs.writeFileSync(this.changelogPath, updatedContent);
      console.log('✅ CHANGELOG.md 已更新');
    }
  }

  private async confirmAction(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  private showHelp(): void {
    console.log('版本管理工具\n');
    console.log('用法:');
    console.log('  npm run version:bump [type]    # 更新版本号');
    console.log('  npm run version:prepare        # 准备发布');
    console.log('  npm run version:status         # 显示项目状态');
    console.log('  npm run version:tag            # 创建Git标签');
    console.log('\n版本类型:');
    console.log('  major     # 主版本号 (X.0.0)');
    console.log('  minor     # 次版本号 (0.X.0)');
    console.log('  patch     # 修订号 (0.0.X)');
    console.log('  prerelease # 预发布 (0.0.X-beta.X)');
    console.log('\n示例:');
    console.log('  npm run version:bump patch');
    console.log('  npm run version:prepare');
  }
}

// 运行版本管理器
if (require.main === module) {
  const manager = new VersionManager();
  manager.run().catch(error => {
    console.error('版本管理脚本执行失败:', error);
    process.exit(1);
  });
}

export { VersionManager };