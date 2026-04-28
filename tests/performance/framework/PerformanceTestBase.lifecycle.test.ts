import { PerformanceTestBase } from './PerformanceTestBase';

class LifecyclePerformanceTest extends PerformanceTestBase {
  public events: string[] = [];

  constructor() {
    super({
      iterations: 1,
      warmupIterations: 0,
      timeout: 1000,
      timeoutThreshold: 1000
    });
  }

  protected getTestName(): string {
    return '生命周期性能测试';
  }

  protected async beforeEach(): Promise<void> {
    this.events.push('beforeEach');
  }

  protected async afterEach(): Promise<void> {
    this.events.push('afterEach');
  }

  protected async performOperation(): Promise<{ ok: boolean }> {
    this.events.push('operation');
    return { ok: true };
  }
}

describe('PerformanceTestBase 生命周期', () => {
  it('应该在测量前执行 beforeEach，并在结束后执行 afterEach', async () => {
    const test = new LifecyclePerformanceTest();

    const result = await test.runTest();

    expect(result.success).toBe(true);
    expect(test.events).toEqual(['beforeEach', 'operation', 'afterEach']);
  });
});
