import {
  registerScenarioWebview,
  resolveScenarioWebview,
  __resetScenarioRegistryForTest,
  DEFAULT_VIEW_TYPE
} from '../../../src/scenario/scenarioRegistry';
import type { ScenarioWebview } from '../../../src/scenario/types';
import * as fs from 'fs';
import * as path from 'path';

function createMockWebview(): ScenarioWebview {
  return {
    postMessage: jest.fn().mockResolvedValue(true)
  };
}

describe('scenarioRegistry (Webview 场景注册表)', () => {
  beforeEach(() => {
    __resetScenarioRegistryForTest();
  });

  it('防破坏规则：src/scenario/ 目录下绝对不能 import "vscode"', () => {
    const file = path.resolve(__dirname, '../../../src/scenario/scenarioRegistry.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toMatch(/from\s+['"]vscode['"]/);
    expect(content).not.toMatch(/require\(['"]vscode['"]\)/);
  });

  it('单面板登记后，不带 target 可按默认 DEFAULT_VIEW_TYPE 解析', async () => {
    const webview = createMockWebview();
    const ready = Promise.resolve();

    const unregister = registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE },
      webview,
      ready
    );

    const resolved = resolveScenarioWebview();
    expect(resolved.webview).toBe(webview);
    expect(resolved.ready).toBe(ready);

    unregister();
    expect(() => resolveScenarioWebview()).toThrow(/no scenario webview matches/);
  });

  it('0 命中时必须抛出明确报错（Fail-Closed，不静默挑或返回 undefined）', () => {
    expect(() =>
      resolveScenarioWebview({ viewType: 'logicAnalyzer.nonExistent' })
    ).toThrow(/no scenario webview matches viewType "logicAnalyzer\.nonExistent"/);
  });

  it('多面板多实例：未传 uri 时多命中必须抛错，禁止静默挑一个', () => {
    const webview1 = createMockWebview();
    const webview2 = createMockWebview();

    registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE, uri: 'file:///a.lac' },
      webview1,
      Promise.resolve()
    );
    registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE, uri: 'file:///b.lac' },
      webview2,
      Promise.resolve()
    );

    expect(() =>
      resolveScenarioWebview({ viewType: DEFAULT_VIEW_TYPE })
    ).toThrow(/2 scenario webviews match viewType "logicAnalyzer\.lacEditor" \(any uri\) — narrow the target with an explicit uri/);
  });

  it('多面板多实例：传入确切 uri 时能精确解析到对应 Webview', () => {
    const webview1 = createMockWebview();
    const webview2 = createMockWebview();

    registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE, uri: 'file:///a.lac' },
      webview1,
      Promise.resolve()
    );
    registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE, uri: 'file:///b.lac' },
      webview2,
      Promise.resolve()
    );

    const resolvedA = resolveScenarioWebview({
      viewType: DEFAULT_VIEW_TYPE,
      uri: 'file:///a.lac'
    });
    expect(resolvedA.webview).toBe(webview1);

    const resolvedB = resolveScenarioWebview({
      viewType: DEFAULT_VIEW_TYPE,
      uri: 'file:///b.lac'
    });
    expect(resolvedB.webview).toBe(webview2);
  });

  it('unregister 按引用销毁，不会误删同 target 的新面板', () => {
    const oldWebview = createMockWebview();
    const newWebview = createMockWebview();

    const unregisterOld = registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE, uri: 'file:///same.lac' },
      oldWebview,
      Promise.resolve()
    );
    registerScenarioWebview(
      { viewType: DEFAULT_VIEW_TYPE, uri: 'file:///same.lac' },
      newWebview,
      Promise.resolve()
    );

    // 此时有两条，多命中
    expect(() =>
      resolveScenarioWebview({ viewType: DEFAULT_VIEW_TYPE, uri: 'file:///same.lac' })
    ).toThrow(/2 scenario webviews match/);

    // 注销旧面板
    unregisterOld();

    // 仅剩新面板，精确解析
    const resolved = resolveScenarioWebview({
      viewType: DEFAULT_VIEW_TYPE,
      uri: 'file:///same.lac'
    });
    expect(resolved.webview).toBe(newWebview);
  });
});
