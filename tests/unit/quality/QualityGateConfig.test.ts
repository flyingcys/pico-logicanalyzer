import fs from 'fs';
import path from 'path';

describe('质量门禁配置', () => {
  const root = path.resolve(__dirname, '../../..');
  const readJson = (relativePath: string) =>
    JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  const readText = (relativePath: string) =>
    fs.readFileSync(path.join(root, relativePath), 'utf8');

  it('应该提供分阶段 strict TypeScript gate', () => {
    const strictConfig = readJson('tsconfig.strict.json');

    expect(strictConfig.extends).toBe('./tsconfig.json');
    expect(strictConfig.compilerOptions.strict).toBe(true);
    expect(strictConfig.compilerOptions.noImplicitAny).toBe(true);
    expect(strictConfig.compilerOptions.strictNullChecks).toBe(true);
    expect(strictConfig.include).toEqual(
      expect.arrayContaining(['src/models/AnalyzerTypes.ts', 'src/decoders/types.ts'])
    );
  });

  it('应该恢复 CI workflow 和本地 pre-commit 门禁', () => {
    const workflow = readText('.github/workflows/quality-gate.yml');
    const preCommit = readText('.husky/pre-commit');

    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm run typecheck:strict');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm run test:ci:quick');
    expect(workflow).toContain('npm run package:dry');
    expect(preCommit).toContain('npm run validate:local');
  });

  it('应该提供功能状态矩阵和真实硬件认证矩阵', () => {
    const featureMatrix = readText('docs/功能状态矩阵.md');
    const hardwareMatrix = readText('docs/真实硬件认证矩阵.md');

    expect(featureMatrix).toContain('| 功能域 | 当前状态 | 证据 | 下一步 |');
    expect(featureMatrix).toContain('模拟');
    expect(featureMatrix).toContain('实验性');
    expect(hardwareMatrix).toContain('| 硬件 | 连接方式 | 检测口径 | 适配状态 | 认证等级 | 必测项 | 证据记录 |');
    expect(hardwareMatrix).toContain('framework');
    expect(hardwareMatrix).toContain('candidate');
    expect(hardwareMatrix).toContain('Pico W');
    expect(hardwareMatrix).toContain('多设备');
  });

  it('README 和 package 元数据不应继续使用模板仓库链接', () => {
    const packageJson = readJson('package.json');
    const readme = readText('README.md');

    expect(JSON.stringify(packageJson)).not.toContain('github.com/your-repo');
    expect(readme).not.toContain('github.com/your-repo');
  });

  it('VSIX 发布清单应该排除开发、CI 和本地恢复文件', () => {
    const vscodeIgnore = readText('.vscodeignore');

    expect(vscodeIgnore).toContain('.git');
    expect(vscodeIgnore).toContain('.github/');
    expect(vscodeIgnore).toContain('.husky/');
    expect(vscodeIgnore).toContain('.vscode/');
    expect(vscodeIgnore).toContain('.recovery-checkpoints/');
    expect(vscodeIgnore).toContain('ci-test-report.json');
  });

  it('发布检查应该使用当前 tests 目录和分层 CI 命令', () => {
    const releaseCheck = readText('scripts/release-check.ts');

    expect(releaseCheck).toContain("'tests/unit'");
    expect(releaseCheck).toContain('npm run test:ci:quick -- --skip-install');
    expect(releaseCheck).toContain('npm run package:dry');
    expect(releaseCheck).not.toContain("'test/unit'");
    expect(releaseCheck).not.toContain("execSync('npm test'");
  });

  it('发布和文档收敛应该有当前状态文档，不继续发布正式版话术', () => {
    const releaseGate = readText('docs/release-gate.md');
    const docIndex = readText('docs/文档状态索引.md');
    const worktreeLog = readText('docs/worktrees/10-quality-release-docs.md');
    const changelog = readText('CHANGELOG.md');
    const releaseNotes = readText('RELEASE_NOTES.md');

    expect(releaseGate).toContain('发布阻断条件');
    expect(releaseGate).toContain('VSIX smoke test');
    expect(docIndex).toContain('| 文档 | 状态 | 使用口径 |');
    expect(docIndex).toContain('历史分析');
    expect(worktreeLog).toContain('范围内');
    expect(worktreeLog).toContain('验收结论');
    expect(changelog).toContain('质量门禁');
    expect(changelog).not.toContain('github.com/your-repo');
    expect(releaseNotes).toContain('Beta');
    expect(releaseNotes).not.toContain('首个正式版本');
  });
});
