import path from 'path';

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
});
