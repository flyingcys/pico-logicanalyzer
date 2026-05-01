#!/usr/bin/env node

/**
 * 生成 VSIX 发布 smoke 记录模板。
 *
 * 本脚本只收集可自动获取的环境信息，不打包 VSIX，也不尝试替代需要桌面环境确认的 VSCode GUI smoke。
 */

const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const preferredFixture = 'tests/fixtures/lac/current-lowercase-samples.lac';

function parseArgs(argv) {
  const options = {
    out: null,
    vsix: null,
    packageCommand: 'npm run package'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (arg === '--vsix' && next) {
      options.vsix = next;
      index += 1;
    } else if (arg === '--package-command' && next) {
      options.packageCommand = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function printUsage() {
  console.log(
    [
      '用法：node scripts/release-smoke-record.js [选项]',
      '',
      '选项：',
      '  --out <path>              写入记录文件；未提供时输出到 stdout',
      '  --vsix <path>             指定要记录的 VSIX；未提供时使用项目根目录最新 .vsix',
      '  --package-command <cmd>   记录本轮 VSIX 生成命令，默认 npm run package',
      '  --help                    显示帮助'
    ].join('\n')
  );
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch (error) {
    return null;
  }
}

function listVsixFiles() {
  return fs
    .readdirSync(projectRoot)
    .filter(file => file.endsWith('.vsix'))
    .map(file => {
      const absolutePath = path.join(projectRoot, file);
      const stat = fs.statSync(absolutePath);
      return {
        file,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function resolveVsix(explicitVsix) {
  if (explicitVsix) {
    const absolutePath = path.resolve(projectRoot, explicitVsix);
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const stat = fs.statSync(absolutePath);
    return {
      file: path.relative(projectRoot, absolutePath),
      mtimeMs: stat.mtimeMs,
      sizeBytes: stat.size
    };
  }

  return listVsixFiles()[0] || null;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return '未知';
  }

  const mib = bytes / 1024 / 1024;
  return `${mib.toFixed(2)} MiB`;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function findFixture() {
  const fixturePath = path.join(projectRoot, preferredFixture);
  if (fs.existsSync(fixturePath)) {
    return preferredFixture;
  }

  const fallback = run('git', ['ls-files', '*.lac']);
  if (!fallback) {
    return '未找到 .lac fixture';
  }

  return fallback.split(/\r?\n/).find(Boolean) || '未找到 .lac fixture';
}

const options = parseArgs(process.argv.slice(2));
const selectedVsix = resolveVsix(options.vsix);
const selectedVsixPath = selectedVsix ? path.join(projectRoot, selectedVsix.file) : null;
const commit = run('git', ['rev-parse', '--short', 'HEAD']) || '待最终打包时填写';
const commitFull = run('git', ['rev-parse', 'HEAD']) || '待最终打包时填写';
const branch = run('git', ['branch', '--show-current']) || '未知';
const gitStatus = run('git', ['status', '--short']) || '';
const nodeVersion = run('node', ['--version']) || '不可用';
const npmVersion = run('npm', ['--version']) || '不可用';
const codeVersion = run('code', ['--version']) || '不可用';
const codeVersionLine = codeVersion.split(/\r?\n/)[0] || codeVersion;
const fixture = findFixture();
const fixtureExists = fs.existsSync(path.join(projectRoot, fixture));
const generatedAt = new Date().toISOString();
const cleanUserDataDir = '.worktree/release-smoke/user-data';
const cleanExtensionsDir = '.worktree/release-smoke/extensions';
const smokeWorkspaceDir = '.worktree/release-smoke/workspace';
const selectedVsixSha256 = selectedVsixPath ? sha256File(selectedVsixPath) : null;

const lines = [
  '## VSIX 发布 smoke 记录',
  '',
  `- 记录生成时间：${generatedAt}`,
  `- 分支：${branch}`,
  `- commit：${commit}（${commitFull}）`,
  `- 工作区状态：${gitStatus ? '有未提交变更，详见本记录生成时的 git status' : '干净'}`,
  `- VSIX：${selectedVsix ? selectedVsix.file : '待最终运行 npm run package 后填写'}`,
  `- VSIX 大小：${selectedVsix ? formatBytes(selectedVsix.sizeBytes) : '待最终运行 npm run package 后填写'}`,
  `- VSIX sha256：${selectedVsixSha256 || '待最终运行 npm run package 后填写'}`,
  `- 平台：${os.type()} ${os.release()} ${process.platform}/${process.arch}`,
  `- Node.js：${nodeVersion}`,
  `- npm：${npmVersion}`,
  `- VSCode CLI：${codeVersionLine}`,
  `- 最小 .lac fixture：${fixture}`,
  `- 干净用户数据目录：${cleanUserDataDir}`,
  `- 扩展目录：${cleanExtensionsDir}`,
  `- smoke 工作区：${smokeWorkspaceDir}`,
  '',
  '### 执行命令',
  '',
  '| 命令 | 状态 | 备注 |',
  '| --- | --- | --- |',
  '| `npm run package:dry` | pending | 发布门禁清单检查；不生成可安装 VSIX，也不能替代 GUI smoke |',
  `| \`${options.packageCommand}\` | ${selectedVsix ? '需结合终端输出确认' : 'pending'} | 生成正式 VSIX；不同于 \`npm run package:dry\` |`,
  '| `node scripts/release-smoke-record.js --out docs/release-smoke/<date>-vsix-smoke.md` | 已执行或待执行 | 生成本记录模板 |',
  '| `code --user-data-dir .worktree/release-smoke/user-data --extensions-dir .worktree/release-smoke/extensions --install-extension <vsix>` | pending | 需要真实 VSCode CLI/桌面环境 |',
  '| `code --user-data-dir .worktree/release-smoke/user-data --extensions-dir .worktree/release-smoke/extensions <fixture>` | pending | 需要人工确认 Custom Editor 和 Webview |',
  '| `code --user-data-dir .worktree/release-smoke/user-data --extensions-dir .worktree/release-smoke/extensions --uninstall-extension logic-analyzer-team.vscode-logic-analyzer` | pending | 卸载后检查扩展目录和临时工作区 |',
  '',
  '### 自动可验证项',
  '',
  '| 项目 | 状态 | 证据 |',
  '| --- | --- | --- |',
  `| commit 可解析 | ${commitFull === '待最终打包时填写' ? '失败' : '通过'} | ${commitFull} |`,
  `| VSIX 文件存在 | ${selectedVsix ? '通过' : 'pending'} | ${selectedVsix ? selectedVsix.file : '未找到 .vsix'} |`,
  `| VSIX sha256 可计算 | ${selectedVsixSha256 ? '通过' : 'pending'} | ${selectedVsixSha256 || '未计算'} |`,
  `| Node/npm/平台信息可记录 | ${nodeVersion !== '不可用' && npmVersion !== '不可用' ? '通过' : '部分失败'} | ${nodeVersion} / npm ${npmVersion} / ${process.platform}/${process.arch} |`,
  `| 最小 .lac fixture 存在 | ${fixtureExists ? '通过' : '失败'} | ${fixture} |`,
  '',
  '| smoke 项 | 状态 | 证据 / 截图 | 备注 |',
  '| --- | --- | --- | --- |',
  selectedVsix
    ? `| 运行 \`${options.packageCommand}\` 生成 VSIX | 已生成，待核对命令输出 | ${selectedVsix.file}，${formatBytes(selectedVsix.sizeBytes)}，sha256 ${selectedVsixSha256} | 需结合终端输出确认本轮生成成功 |`
    : `| 运行 \`${options.packageCommand}\` 生成 VSIX | pending | VSIX 文件名、命令输出 | 只能在实际执行成功后改为通过 |`,
  '| 干净 VSCode 用户数据目录安装 VSIX | pending | 截图：待填写 | 需要桌面 VSCode 环境 |',
  '| 打开最小 `.lac` 文件 | pending | 截图：待填写 | 使用上方 fixture |',
  '| 无设备环境执行 `Logic Analyzer: Connect Device` | pending | 截图：待填写 | 期望明确错误且不卡死 |',
  '| 执行 `Logic Analyzer: Create Synthetic Capture` | pending | 截图：待填写 | 记录成功或失败路径的可见反馈 |',
  '| 卸载 VSIX 并检查残留 | pending | 截图 / 命令输出：待填写 | 确认无临时工作区文件残留 |',
  '',
  '结论：pending。GUI smoke 尚未完成时不得改写为通过。'
];

const output = `${lines.join('\n')}\n`;

if (options.out) {
  const outPath = path.resolve(projectRoot, options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output);
  console.log(`已写入 ${path.relative(projectRoot, outPath)}`);
} else {
  process.stdout.write(output);
}
