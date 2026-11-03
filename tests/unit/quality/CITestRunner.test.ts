import path from 'path';
import fs from 'fs';

describe('CI 测试运行器配置', () => {
  const runnerPath = path.resolve(__dirname, '../../../scripts/ci-test-runner.js');
  const runner = require(runnerPath);

  it('应该导出 dry-run 执行计划能力，避免本地验证误触发安装和测试', () => {
    expect(typeof runner.createExecutionPlan).toBe('function');
    expect(typeof runner.formatDryRunReport).toBe('function');

    const plan = runner.createExecutionPlan(['--layer=quick', '--dry-run']);

    expect(plan).toMatchObject({
      layer: 'quick',
      dryRun: true,
      installDependencies: false,
      runTests: false,
      runQualityCheck: false
    });
    expect(plan.commands).toContain('npm run typecheck');
    expect(plan.commands).toContain('npm run lint');
    expect(plan.commands).toContain('npm run test:ci:quick');
  });

  it('应该拒绝未知测试层级并列出可用层级', () => {
    expect(() => runner.createExecutionPlan(['--layer=unknown'])).toThrow(
      /无效的测试层级: unknown/
    );
  });

  it('应该在 dry-run 计划中暴露 quick/standard/full 的测试边界', () => {
    const quickPlan = runner.createExecutionPlan(['--layer=quick', '--dry-run']);
    const fullPlan = runner.createExecutionPlan(['--layer=full', '--dry-run']);

    expect(quickPlan.includedTestGroups).toEqual(['coreTests']);
    expect(quickPlan.maxDurationMs).toBe(120000);
    expect(quickPlan.quarantinedTests).toEqual([]);
    expect(fullPlan.includedTestGroups).toEqual([
      'coreTests',
      'integrationTests',
      'performanceTests',
      'e2eTests',
      'stressTests'
    ]);

    const report = runner.formatDryRunReport(fullPlan);
    expect(report).toContain('测试分组: coreTests, integrationTests, performanceTests, e2eTests, stressTests');
    expect(report).toContain('时间上限: 30.0 分钟');
    expect(report).toContain('暂不阻断测试: 0 个');
  });

  it('应该完成 CI 覆盖测试的旧 utest mock 引用迁移', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    /**
     * ⚠️ 这份清单是**手工挑的子集**（只含"确实 import 了 simple-mocks 的文件"），
     * 不是 `CI_CONFIG` 的镜像 —— 后者含 coreTests 那批不 import mock 的文件，
     * 一起拉进来会让 `toContain(新路径)` 必然失败。
     *
     * 2026-11-03：原清单里的 `tests/e2e/scenarios/DataCaptureWorkflow.e2e.test.ts`
     * 已删除（那是假 e2e：mock vscode + 自己 fs.writeFile 造假产物 + 命令 ID 全不存在）。
     * 真正的 e2e 在 `tests/e2e/vscode/`，**不走 jest**，故不在本清单。
     * 其余 7 个文件保持不变。
     */
    const ciCoveredFiles = [
      'tests/integration/core-flows/hardware-capture.integration.test.ts',
      'tests/performance/benchmarks/LogicAnalyzerDriver.perf.test.ts',
      'tests/performance/benchmarks/LACFileFormat.perf.test.ts',
      'tests/stress/load/LargeDataProcessing.stress.test.ts',
      'tests/stress/load/IntelligentLoadGeneration.stress.test.ts',
      'tests/stress/data-processing/scenarios/MemoryLeakDetection.stress.test.ts',
      'tests/stress/data-processing/scenarios/ContinuousData.stress.test.ts'
    ];

    for (const file of ciCoveredFiles) {
      // ⚠️ 先断存在性：清单指向不存在的文件时，应报"文件不存在"（指向明确），
      //    而不是在 readFileSync 里抛 ENOENT（归因指向不明）。
      expect({ file, exists: fs.existsSync(path.join(repoRoot, file)) }).toEqual({
        file,
        exists: true
      });
      const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      expect(content).not.toContain('utest/mocks/simple-mocks');
      expect(content).toContain('tests/fixtures/mocks/simple-mocks');
    }
  });
});
