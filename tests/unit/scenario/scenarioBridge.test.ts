import {
  postScenarioRequest,
  completeScenarioRequest,
  abortScenarioRequestsForWebview,
  __resetScenarioBridgeForTest,
  scenarioTimeoutMs
} from '../../../src/scenario/scenarioBridge';
import type { ScenarioAction, ScenarioWebview } from '../../../src/scenario/types';
import * as fs from 'fs';
import * as path from 'path';

function createMockWebview(): ScenarioWebview & { sent: unknown[] } {
  const sent: unknown[] = [];
  return {
    sent,
    postMessage: jest.fn(async (msg: unknown) => {
      sent.push(msg);
      return true;
    })
  };
}

describe('scenarioBridge (测试驱动请求与回包关联桥)', () => {
  beforeEach(() => {
    __resetScenarioBridgeForTest();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('防破坏规则：src/scenario/ 目录下绝对不能 import "vscode"', () => {
    const file = path.resolve(__dirname, '../../../src/scenario/scenarioBridge.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toMatch(/from\s+['"]vscode['"]/);
    expect(content).not.toMatch(/require\(['"]vscode['"]\)/);
  });

  it('postScenarioRequest 能够生成 nonce 和 requestId 并发送 scenarioRequest', async () => {
    const webview = createMockWebview();
    const actions: ScenarioAction[] = [
      { type: 'waitForElement', selector: '.test' }
    ];

    const promise = postScenarioRequest(webview, actions);

    expect(webview.postMessage).toHaveBeenCalledTimes(1);
    const sentMsg = webview.sent[0] as {
      type: string;
      requestId: string;
      nonce: string;
      actions: ScenarioAction[];
    };

    expect(sentMsg.type).toBe('scenarioRequest');
    expect(typeof sentMsg.requestId).toBe('string');
    expect(typeof sentMsg.nonce).toBe('string');
    expect(sentMsg.actions).toEqual(actions);

    // 正常回包
    const consumed = completeScenarioRequest({
      type: 'scenarioResult',
      requestId: sentMsg.requestId,
      nonce: sentMsg.nonce,
      ok: true,
      texts: { '.test': 'hello' }
    });

    expect(consumed).toBe(true);
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.texts?.['.test']).toBe('hello');
  });

  it('回包 nonce 不匹配时必须 Reject 拒绝伪造响应', async () => {
    const webview = createMockWebview();
    const promise = postScenarioRequest(webview, [{ type: 'sleep', ms: 10 }]);
    const sentMsg = webview.sent[0] as { requestId: string; nonce: string };

    const consumed = completeScenarioRequest({
      type: 'scenarioResult',
      requestId: sentMsg.requestId,
      nonce: 'wrong-nonce',
      ok: true
    });

    expect(consumed).toBe(true);
    await expect(promise).rejects.toThrow(/nonce mismatch/);
  });

  it('Webview 执行出错 (ok: false) 时必须以明确错误 Reject', async () => {
    const webview = createMockWebview();
    const promise = postScenarioRequest(webview, [{ type: 'click', selector: '.btn' }]);
    const sentMsg = webview.sent[0] as { requestId: string; nonce: string };

    completeScenarioRequest({
      type: 'scenarioResult',
      requestId: sentMsg.requestId,
      nonce: sentMsg.nonce,
      ok: false,
      error: 'action[0] click failed: element not found'
    });

    await expect(promise).rejects.toThrow('action[0] click failed: element not found');
  });

  it('超过 timeoutMs 未收到响应时必须 Reject 超时错误', async () => {
    const webview = createMockWebview();
    const promise = postScenarioRequest(webview, [{ type: 'sleep', ms: 100 }], 5000);

    jest.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow(/scenario request timed out \(5000ms\)/);
  });

  it('abortScenarioRequestsForWebview 能够精准中止该 Webview 的挂起请求', async () => {
    const webview1 = createMockWebview();
    const webview2 = createMockWebview();

    const promise1 = postScenarioRequest(webview1, [{ type: 'sleep', ms: 10 }]);
    const promise2 = postScenarioRequest(webview2, [{ type: 'sleep', ms: 10 }]);

    abortScenarioRequestsForWebview(webview1, 'panel disposed');

    await expect(promise1).rejects.toThrow('panel disposed');

    // webview2 应该不受影响，可正常响应
    const sentMsg2 = webview2.sent[0] as { requestId: string; nonce: string };
    completeScenarioRequest({
      type: 'scenarioResult',
      requestId: sentMsg2.requestId,
      nonce: sentMsg2.nonce,
      ok: true
    });

    const result2 = await promise2;
    expect(result2.ok).toBe(true);
  });

  it('非场景消息或格式非法消息不会被消费 (返回 false)', () => {
    expect(completeScenarioRequest(null)).toBe(false);
    expect(completeScenarioRequest({})).toBe(false);
    expect(completeScenarioRequest({ type: 'other' })).toBe(false);
    expect(completeScenarioRequest({ type: 'scenarioResult', requestId: 'unknown' })).toBe(false);
  });
});
