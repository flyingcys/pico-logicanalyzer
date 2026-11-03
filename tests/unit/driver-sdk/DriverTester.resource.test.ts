import { DriverTester } from '../../../src/driver-sdk/tools/DriverTester';
import { AnalyzerDriverBase } from '../../../src/drivers/AnalyzerDriverBase';

/**
 * 创建满足 AnalyzerDriverBase 最小契约的桩驱动，
 * 供 DriverTester 运行不依赖真实设备的测试用例。
 */
function createStubDriver(): AnalyzerDriverBase {
  return {
    constructor: { name: 'StubDriver' }
  } as unknown as AnalyzerDriverBase;
}

describe('DriverTester 资源管理', () => {
  it('测试用例先于超时完成时清理竞速超时定时器', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const tester = new DriverTester(true);
    // 清空所有内置用例，只保留即时完成的用例
    [
      'basic-connection',
      'disconnect',
      'basic-capture',
      'status-query',
      'memory-usage',
      'concurrent-operations'
    ].forEach(name => tester.removeTestCase(name));

    tester.addTestCase({
      name: 'instant-pass',
      description: '即时完成，不触碰设备',
      category: 'connection',
      timeout: 10000,
      run: async () => ({ passed: true, message: 'ok', duration: 0 })
    });

    const report = await tester.runAllTests(createStubDriver());

    expect(report.passedTests).toBe(1);
    // 竞速超时定时器必须在用例完成后被释放
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
