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

  it('单元/集成/压力测试应分层独立，压力不进常规 PR 门禁', () => {
    const packageJson = readJson('package.json');
    const workflow = readText('.github/workflows/quality-gate.yml');

    // 单元门禁只匹配 tests/unit，不含压力/性能/e2e
    expect(packageJson.scripts['test:unit']).toContain('tests/unit');
    expect(packageJson.scripts['test:unit']).not.toContain('stress');
    expect(packageJson.scripts['test:unit']).not.toContain('performance');
    expect(packageJson.scripts['test:unit']).not.toContain('e2e');

    // 集成门禁只匹配 tests/integration
    expect(packageJson.scripts['test:integration']).toContain('tests/integration');

    // 压力门禁独立存在，供夜间/手动运行
    expect(packageJson.scripts['test:stress']).toContain('tests/stress');

    // CI 常规 PR 依次执行单元（带覆盖率门禁）、集成、Web 覆盖率；不执行压力
    expect(workflow).toContain('npm run test:unit');
    expect(workflow).toContain('--coverage');
    expect(workflow).toContain('npm run test:integration');
    expect(workflow).toContain('test:coverage');
    expect(workflow).not.toContain('npm run test:stress');

    // 常规 PR 不应有裸 test:ci 全量步（会拾取 stress/performance/e2e，违背分层）。
    // 用 run 步骤行级匹配，避免与 test:ci:quick 误匹配。
    const runSteps = workflow
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('run:'));
    expect(runSteps).not.toContain('run: npm run test:ci');
  });

  it('Jest 覆盖率应净化分母并锁定关键路径阈值', () => {
    // jest.config.js 为 CJS；用 require 读取，避免 eval
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jestConfig = require('../../../jest.config.js') as {
      collectCoverageFrom: string[];
      coverageThreshold: Record<string, Record<string, number>>;
    };

    // web-app 走 Vitest 门禁，不得污染 Jest 覆盖率分母
    expect(jestConfig.collectCoverageFrom).toEqual(
      expect.arrayContaining(['!src/web-app/**', '!src/**/*-self-test.ts'])
    );

    // 不用低全局值伪装质量；只锁稳定关键路径
    expect(jestConfig.coverageThreshold.global).toBeUndefined();

    const lac = jestConfig.coverageThreshold['./src/models/LACFileFormat.ts'];
    expect(lac.lines).toBeGreaterThanOrEqual(85);
    expect(lac.statements).toBeGreaterThanOrEqual(85);
    expect(lac.functions).toBeGreaterThanOrEqual(85);
    expect(lac.branches).toBeGreaterThanOrEqual(78);

    const lockedPaths = [
      './src/decoders/ChannelMapping.ts',
      './src/decoders/DecoderManager.ts',
      './src/drivers/SigrokAdapter.ts',
      './src/frontend/app/main-html.ts',
      './src/frontend/app/main-vscode.ts',
      './src/decoders/protocols/I2CDecoder.ts',
      './src/decoders/protocols/SPIDecoder.ts'
    ];
    for (const p of lockedPaths) {
      expect(jestConfig.coverageThreshold[p]).toEqual(
        expect.objectContaining({
          lines: expect.any(Number),
          statements: expect.any(Number),
          functions: expect.any(Number),
          branches: expect.any(Number)
        })
      );
    }
  });

  it('应该提供功能状态矩阵和真实硬件认证矩阵', () => {
    const featureMatrix = readText('docs/功能状态矩阵.md');
    const hardwareMatrix = readText('docs/真实硬件认证矩阵.md');

    expect(featureMatrix).toContain('| 功能域 | 当前状态 | 证据 | 下一步 |');
    expect(featureMatrix).toContain('模拟');
    expect(featureMatrix).toContain('实验性');
    expect(hardwareMatrix).toContain('| 硬件 | 连接方式 | 检测口径 | 适配状态 | 证据等级 | 必测项 | 证据记录 |');
    expect(hardwareMatrix).toContain('framework');
    expect(hardwareMatrix).toContain('experimental');
    expect(hardwareMatrix).toContain('pending');
    expect(hardwareMatrix).not.toContain('candidate');
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

  it('Webview 生产构建应该有可执行的 bundle budget 和分析入口', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAnalyze = process.env.ANALYZE;
    process.env.NODE_ENV = 'production';
    delete process.env.ANALYZE;
    jest.resetModules();

    const configs = require('../../../webpack.config.js');
    const webviewConfig = configs.find((config: any) => config.name === 'webview');
    const packageJson = readJson('package.json');
    const vscodeIgnore = readText('.vscodeignore');
    const releaseGate = readText('docs/release-gate.md');

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousAnalyze === undefined) {
      delete process.env.ANALYZE;
    } else {
      process.env.ANALYZE = previousAnalyze;
    }
    jest.resetModules();

    expect(webviewConfig.performance.hints).toBe('error');
    expect(webviewConfig.performance.assetFilter('main-vscode.12345678.js')).toBe(true);
    expect(webviewConfig.performance.assetFilter('main-vscode.12345678.js.map')).toBe(false);
    expect(webviewConfig.optimization.splitChunks.cacheGroups).toEqual(
      expect.objectContaining({
        vueVendor: expect.objectContaining({ name: 'vue-vendor' }),
        elementPlus: expect.objectContaining({ name: 'element-plus' }),
        i18n: expect.objectContaining({ name: 'i18n' })
      })
    );
    expect(packageJson.scripts['build:budget']).toContain('webpack --mode production');
    expect(packageJson.scripts['build:analyze']).toContain('ANALYZE=true');
    expect(vscodeIgnore).toContain('out/**/*.map');
    expect(vscodeIgnore).toContain('out/**/bundle-report.html');
    expect(releaseGate).toContain('Webview bundle 预算');
    expect(releaseGate).toContain('source map 不进入 VSIX');
  });

  it('发布检查应该使用当前 tests 目录和分层 CI 命令', () => {
    const releaseCheck = readText('scripts/release-check.ts');

    expect(releaseCheck).toContain("'tests/unit'");
    expect(releaseCheck).toContain('npm run test:ci:quick -- --skip-install');
    expect(releaseCheck).toContain('npm run package:dry');
    expect(releaseCheck).toContain('npm run typecheck:strict');
    expect(releaseCheck).toContain('createRequire(import.meta.url)');
    expect(releaseCheck).toContain('parseConfigFileTextToJson');
    expect(releaseCheck).toContain('hasSensitiveFile');
    expect(releaseCheck).toContain('coverage-summary.json');
    expect(releaseCheck).toContain('npm run test:coverage');
    expect(releaseCheck).toContain('isMainModule()');
    expect(releaseCheck).toContain('import.meta.url');
    expect(releaseCheck).not.toContain("'test/unit'");
    expect(releaseCheck).not.toContain("execSync('npm test'");
    expect(releaseCheck).not.toContain("execSync('npm run test -- --coverage'");
    expect(releaseCheck).not.toContain('require.main === module');
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

  it('VSIX 发布 smoke 记录脚本和文档应该保持 Beta 环境阻断口径', () => {
    const script = readText('scripts/release-smoke-record.js');
    const releaseGate = readText('docs/release-gate.md');
    const releaseNotes = readText('RELEASE_NOTES.md');
    const changelog = readText('CHANGELOG.md');
    const smokeRecord = readText('docs/release-smoke/2026-04-30-vsix-smoke.md');

    expect(script).toContain('--out');
    expect(script).toContain('--vsix');
    expect(script).toContain('VSIX sha256');
    expect(script).toContain('自动可验证项');
    expect(script).toContain('干净 VSCode 用户数据目录安装 VSIX | pending');
    expect(script).toContain('Create Synthetic Capture');
    expect(script).toContain('pending | 需要真实 VSCode CLI/桌面环境');

    expect(releaseGate).toContain('package:dry');
    expect(releaseGate).toContain('不生成可安装 VSIX');
    expect(releaseGate).toContain('不能替代 VSCode 桌面环境中的人工确认');
    expect(releaseGate).toContain('VSIX 产物：文件名、大小、sha256、生成命令结果');
    expect(releaseGate).toContain('自动可验证项：commit 可解析、VSIX 存在、sha256 可计算');
    expect(releaseGate).toContain('环境阻断');
    expect(releaseGate).toContain('ENOENT');

    expect(releaseNotes).toContain('Beta 候选 smoke 证据');
    expect(releaseNotes).toContain('blocked');
    expect(releaseNotes).toContain('ENOENT');
    expect(changelog).toContain('GUI 项');

    expect(smokeRecord).toContain('VSIX sha256：');
    expect(smokeRecord).toContain('### 自动可验证项');
    expect(smokeRecord).toContain('| VSIX sha256 可计算 | 通过 |');
    expect(smokeRecord).toContain('| 干净 VSCode 用户数据目录安装 VSIX | blocked |');
    expect(smokeRecord).toContain('| 执行 `Logic Analyzer: Create Synthetic Capture` | blocked |');
    expect(smokeRecord).toContain('结论：blocked');
    expect(smokeRecord).toContain('ENOENT');
    expect(smokeRecord).not.toContain('| 干净 VSCode 用户数据目录安装 VSIX | 已通过 |');
    expect(smokeRecord).not.toContain('| 执行 `Logic Analyzer: Create Synthetic Capture` | 已通过 |');
    expect(smokeRecord).not.toContain('GUI smoke 已通过');
  });
});
