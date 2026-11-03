/**
 * 宿主侧测试桥：负责向 Webview 派发场景动作请求并安全配对回包。
 *
 * ## ⚠️ 安全与设计纪律
 * 1. 本模块【绝不 import 'vscode'】：Webview 抽象为 ScenarioWebview ({ postMessage })，
 *    以确保可在 Node/Jest 环境中以假对象进行 100% 独立单测。
 * 2. Nonce 与 RequestId 双重关联校验：防篡改与伪造响应。
 * 3. 明确的超时控制与面板销毁处理：绝不静默挂起至假死。
 */

import { randomBytes } from 'crypto';
import type {
  ScenarioAction,
  ScenarioEvent,
  ScenarioResult,
  ScenarioWebview
} from './types';

interface PendingScenarioRequest {
  requestId: string;
  nonce: string;
  webview: ScenarioWebview;
  resolve: (result: ScenarioResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** 待响应请求表，以 requestId 索引 */
const pendingRequests = new Map<string, PendingScenarioRequest>();

/** 生成一次性高强度随机 nonce */
export function createScenarioNonce(): string {
  return randomBytes(16).toString('hex');
}

/** 生成唯一请求 ID */
export function createScenarioRequestId(): string {
  return randomBytes(8).toString('hex');
}

/** 超时预算：每个动作留 5s，最低 10s */
export function scenarioTimeoutMs(actions: readonly ScenarioAction[]): number {
  return Math.max(10_000, actions.length * 5_000);
}

/**
 * 向目标 Webview 发起一次场景动作执行请求
 */
export async function postScenarioRequest(
  webview: ScenarioWebview,
  actions: readonly ScenarioAction[],
  timeoutMs = scenarioTimeoutMs(actions)
): Promise<ScenarioResult> {
  const nonce = createScenarioNonce();
  const requestId = createScenarioRequestId();

  const promise = new Promise<ScenarioResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error(
          `scenario request timed out (${timeoutMs}ms): ${actions.map(a => a.type).join(' -> ')}`
        )
      );
    }, timeoutMs);

    pendingRequests.set(requestId, {
      requestId,
      nonce,
      webview,
      resolve,
      reject,
      timer
    });
  });

  await webview.postMessage({
    type: 'scenarioRequest',
    requestId,
    nonce,
    actions
  });

  return promise;
}

/**
 * 消费并完成 Webview 返回的 scenarioResult 响应
 *
 * @param message 接收到的消息体
 * @param sourceWebview 发送消息的源 Webview（传入则校验必须为 pending 注册者）
 * @returns true 表示该消息为当前模块管理的场景回包并已被消费；false 表示非场景消息
 */
export function completeScenarioRequest(
  message: unknown,
  sourceWebview?: ScenarioWebview
): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const raw = message as {
    type?: unknown;
    requestId?: unknown;
    nonce?: unknown;
    ok?: unknown;
    events?: unknown;
    texts?: unknown;
    canvasStats?: unknown;
    error?: unknown;
  };

  if (raw.type !== 'scenarioResult') {
    return false;
  }

  if (typeof raw.requestId !== 'string' || typeof raw.nonce !== 'string') {
    return false;
  }

  const entry = pendingRequests.get(raw.requestId);
  if (!entry) {
    return false;
  }

  // 若传入源 Webview，必须严格一致（防止跨面板串包）
  if (sourceWebview !== undefined && entry.webview !== sourceWebview) {
    return false;
  }

  clearTimeout(entry.timer);
  pendingRequests.delete(raw.requestId);

  // Nonce 校验：同一 requestId 上 nonce 不符属于伪造/异常响应，必须明确 Reject
  if (raw.nonce !== entry.nonce) {
    entry.reject(
      new Error('scenario response rejected: nonce mismatch (response is not for this request)')
    );
    return true;
  }

  if (raw.ok !== true) {
    const errText = typeof raw.error === 'string' ? raw.error : 'unknown scenario execution error';
    entry.reject(new Error(errText));
    return true;
  }

  const result: ScenarioResult = {
    ok: true,
    ...(Array.isArray(raw.events) ? { events: raw.events as ScenarioEvent[] } : {}),
    ...(raw.texts && typeof raw.texts === 'object'
      ? { texts: raw.texts as Record<string, string | null> }
      : {}),
    ...(raw.canvasStats && typeof raw.canvasStats === 'object'
      ? { canvasStats: raw.canvasStats as any }
      : {})
  };

  entry.resolve(result);
  return true;
}

/**
 * 中止指定 Webview 上的所有未完成场景请求（面板 Dispose 时必须调用）
 */
export function abortScenarioRequestsForWebview(
  webview: ScenarioWebview,
  reason: string
): void {
  for (const [key, entry] of pendingRequests) {
    if (entry.webview !== webview) {
      continue;
    }
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
    pendingRequests.delete(key);
  }
}

/** 仅供单元测试重置内部状态 */
export function __resetScenarioBridgeForTest(): void {
  for (const [, entry] of pendingRequests) {
    clearTimeout(entry.timer);
  }
  pendingRequests.clear();
}
