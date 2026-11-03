/**
 * Webview 内部的场景动作执行器。
 *
 * ## 设计纪律
 * 1. 纯真实 DOM 事件驱动：绝不走内部组件/store 私有方法后门（真实测试用户点按行为）。
 * 2. 纯逻辑与依赖注入：通过 ScenarioDeps ({ doc, now }) 注入 Document，可在 jsdom 中 100% 独立单测。
 * 3. Fail-Closed 严格性：必填元素找不到立即抛错；readText 与 readTextOptional 严格分离。
 */

import type {
  CanvasStatsResult,
  ScenarioAction,
  ScenarioEvent,
  ScenarioResult
} from '../../../scenario/types';

export interface ScenarioDeps {
  doc: Document;
  now: () => number;
}

const DEFAULT_POLL_INTERVAL_MS = 20;
const DEFAULT_WAIT_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 解析并执行单一元素查询。
 *
 * 支持标准 CSS 选择器与增强的 `formItem:"<精确标签文本>"(?: <子选择器>)?` 语义选择器。
 * ⚠️ 约束规则：
 * 1. 前缀 `formItem:` 严格区分大小写（非 `formitem:`），防止大小写写错产生误解。
 * 2. 标签文本必须以双引号包裹，例如 `formItem:"Pre Samples" input`；若未带引号则直接抛错（Fail-Closed）。
 */
export function queryOne(doc: Document, selector: string): Element | null {
  if (selector.startsWith('formItem:')) {
    const match = selector.match(/^formItem:"([^"]*)"(?:\s+(.*))?$/);
    if (!match) {
      throw new Error(
        `formItem: selector requires quoted label, e.g. formItem:"Pre Samples" input. Received: "${selector}"`
      );
    }

    const [, labelText, subSelector] = match;
    const items = doc.querySelectorAll('.el-form-item');
    for (const item of items) {
      const labelEl = item.querySelector('.el-form-item__label');
      if (labelEl && labelEl.textContent?.trim() === labelText.trim()) {
        if (!subSelector) {
          return item;
        }
        return item.querySelector(subSelector);
      }
    }
    return null;
  }

  return doc.querySelector(selector);
}

/**
 * 解析并执行多元素查询。
 */
export function queryAll(doc: Document, selector: string): Element[] {
  if (selector.startsWith('formItem:')) {
    const match = selector.match(/^formItem:"([^"]*)"(?:\s+(.*))?$/);
    if (!match) {
      throw new Error(
        `formItem: selector requires quoted label, e.g. formItem:"Pre Samples" input. Received: "${selector}"`
      );
    }

    const [, labelText, subSelector] = match;
    const items = doc.querySelectorAll('.el-form-item');
    for (const item of items) {
      const labelEl = item.querySelector('.el-form-item__label');
      if (labelEl && labelEl.textContent?.trim() === labelText.trim()) {
        if (!subSelector) {
          return [item];
        }
        return Array.from(item.querySelectorAll(subSelector));
      }
    }
    return [];
  }

  return Array.from(doc.querySelectorAll(selector));
}

/**
 * 轮询等待元素出现在 DOM 中
 */
async function waitForElement(
  doc: Document,
  selector: string,
  timeoutMs: number,
  now: () => number
): Promise<Element> {
  const start = now();
  while (now() - start < timeoutMs) {
    const el = queryOne(doc, selector);
    if (el) {
      return el;
    }
    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  throw new Error(`waitForElement timed out (${timeoutMs}ms) for selector: "${selector}"`);
}

/**
 * 轮询等待指定元素的文本匹配正则
 */
async function waitForText(
  doc: Document,
  selector: string,
  matches: string,
  timeoutMs: number,
  now: () => number
): Promise<Element> {
  const start = now();
  const regex = new RegExp(matches);

  while (now() - start < timeoutMs) {
    const el = queryOne(doc, selector);
    if (el) {
      const text = el.textContent?.trim() || '';
      if (regex.test(text)) {
        return el;
      }
    }
    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  const currentText = queryOne(doc, selector)?.textContent?.trim() ?? '<element not found>';
  throw new Error(
    `waitForText timed out (${timeoutMs}ms) for selector: "${selector}", pattern: /${matches}/, current: "${currentText}"`
  );
}

/**
 * 计算 Canvas 结构性像素统计
 */
function analyzeCanvasPixels(
  canvas: HTMLCanvasElement,
  sampleStep: number
): CanvasStatsResult {
  const { width, height } = canvas;

  if (width <= 0 || height <= 0) {
    throw new Error(`readCanvasStats: invalid canvas dimensions (${width}x${height})`);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('readCanvasStats: failed to get 2d context from canvas');
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const freqMap = new Map<string, number>();
  let transparentCount = 0;
  let sampledCount = 0;
  const step = Math.max(1, Math.floor(sampleStep));

  for (let i = 0; i < data.length; i += 4 * step) {
    sampledCount++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) {
      transparentCount++;
      freqMap.set('transparent', (freqMap.get('transparent') || 0) + 1);
    } else {
      const key = `${r},${g},${b},${a}`;
      freqMap.set(key, (freqMap.get(key) || 0) + 1);
    }
  }

  const sorted = Array.from(freqMap.entries()).sort((left, right) => right[1] - left[1]);
  const dominantCount = sorted.length > 0 ? sorted[0][1] : 0;
  const dominantRatio = sampledCount > 0 ? dominantCount / sampledCount : 1;

  const topColors = sorted.slice(0, 5).map(
    ([color, count]) =>
      `${color} (${((count / (sampledCount || 1)) * 100).toFixed(1)}%)`
  );

  return {
    width,
    height,
    sampledPixels: sampledCount,
    transparentPixels: transparentCount,
    colorVariety: freqMap.size,
    dominantColorRatio: dominantRatio,
    topColors
  };
}

/**
 * 执行动作序列并收集结果
 */
export async function executeScenarioActions(
  actions: readonly ScenarioAction[],
  deps: ScenarioDeps = { doc: document, now: () => Date.now() }
): Promise<ScenarioResult> {
  const events: ScenarioEvent[] = [];
  const texts: Record<string, string | null> = {};
  const allTexts: Record<string, string[]> = {};
  const values: Record<string, string | null> = {};
  const counts: Record<string, number> = {};
  let lastCanvasStats: CanvasStatsResult | undefined;

  for (let index = 0; index < actions.length; index++) {
    const action = actions[index];
    let stepResult: unknown = undefined;

    try {
      switch (action.type) {
        case 'waitForElement': {
          await waitForElement(
            deps.doc,
            action.selector,
            action.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
            deps.now
          );
          break;
        }

        case 'waitForText': {
          await waitForText(
            deps.doc,
            action.selector,
            action.matches,
            action.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
            deps.now
          );
          break;
        }

        case 'click': {
          const el = queryOne(deps.doc, action.selector);
          if (!el) {
            throw new Error(`click failed: element not found: "${action.selector}"`);
          }
          el.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: deps.doc.defaultView || undefined
            })
          );
          break;
        }

        case 'input': {
          const el = queryOne(deps.doc, action.selector);
          if (!el) {
            throw new Error(`input failed: element not found: "${action.selector}"`);
          }
          if ('value' in el) {
            (el as { value: string }).value = action.value;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }

        case 'inputOptional': {
          const el = queryOne(deps.doc, action.selector);
          if (el && 'value' in el) {
            (el as { value: string }).value = action.value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }

        case 'key': {
          const target = deps.doc.activeElement || deps.doc.body;
          target.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: action.key,
              ctrlKey: action.ctrl ?? false,
              shiftKey: action.shift ?? false,
              bubbles: true
            })
          );
          target.dispatchEvent(
            new KeyboardEvent('keyup', {
              key: action.key,
              ctrlKey: action.ctrl ?? false,
              shiftKey: action.shift ?? false,
              bubbles: true
            })
          );
          break;
        }

        case 'sleep': {
          await sleep(action.ms);
          break;
        }

        case 'readText': {
          const el = queryOne(deps.doc, action.selector);
          if (!el) {
            throw new Error(`readText failed: element not found: "${action.selector}"`);
          }
          stepResult = texts[action.selector] = el.textContent?.trim() ?? '';
          break;
        }

        case 'readTextOptional': {
          const el = queryOne(deps.doc, action.selector);
          stepResult = texts[action.selector] = el ? el.textContent?.trim() ?? '' : null;
          break;
        }

        case 'readValue': {
          const el = queryOne(deps.doc, action.selector);
          if (!el) {
            throw new Error(`readValue failed: element not found: "${action.selector}"`);
          }
          if (!('value' in el)) {
            throw new Error(`readValue failed: element has no value property: "${action.selector}"`);
          }
          stepResult = values[action.selector] = (el as HTMLInputElement).value;
          break;
        }

        case 'readValueOptional': {
          const el = queryOne(deps.doc, action.selector);
          if (!el || !('value' in el)) {
            stepResult = values[action.selector] = null;
          } else {
            stepResult = values[action.selector] = (el as HTMLInputElement).value;
          }
          break;
        }

        case 'countElements': {
          stepResult = counts[action.selector] = queryAll(deps.doc, action.selector).length;
          break;
        }

        case 'readAllTexts': {
          const els = queryAll(deps.doc, action.selector);
          const list = els.map(el => el.textContent?.trim() ?? '');
          stepResult = allTexts[action.selector] = list;
          break;
        }

        case 'readCanvasStats': {
          if (!action.selector || typeof action.selector !== 'string') {
            throw new Error('readCanvasStats requires explicit non-empty selector');
          }
          const el = queryOne(deps.doc, action.selector);
          if (!el) {
            throw new Error(`readCanvasStats failed: element not found: "${action.selector}"`);
          }
          if (!(el instanceof (deps.doc.defaultView?.HTMLCanvasElement || HTMLCanvasElement))) {
            throw new Error(`readCanvasStats failed: element is not HTMLCanvasElement: "${action.selector}"`);
          }
          stepResult = lastCanvasStats = analyzeCanvasPixels(el as HTMLCanvasElement, action.sampleStep ?? 4);
          break;
        }

        default: {
          const unknownType = (action as { type?: unknown }).type;
          throw new Error(`unsupported scenario action type: "${String(unknownType)}"`);
        }
      }

      events.push({
        action,
        at: deps.now(),
        ...(stepResult !== undefined ? { result: stepResult } : {})
      });
    } catch (error) {
      return {
        ok: false,
        events,
        texts,
        allTexts,
        values,
        counts,
        canvasStats: lastCanvasStats,
        error: `action[${index}] ${action.type} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }

  return {
    ok: true,
    events,
    texts,
    allTexts,
    values,
    counts,
    canvasStats: lastCanvasStats
  };
}

/**
 * 在 Webview 全局挂载场景消息监听器
 */
export function setupScenarioListener(): (() => void) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const handler = async (event: MessageEvent) => {
    const raw = event.data;
    if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== 'scenarioRequest') {
      return;
    }

    const { requestId, nonce, actions } = raw as {
      requestId?: unknown;
      nonce?: unknown;
      actions?: unknown;
    };

    const reqId = typeof requestId === 'string' ? requestId : '';
    const non = typeof nonce === 'string' ? nonce : '';
    const windowAny = window as unknown as {
      __scenarioEnabled?: boolean;
      vscode?: { postMessage: (msg: unknown) => void };
    };

    // 三重门控校验：__scenarioEnabled 必须为 true 且 nonce 必须存在
    if (!windowAny.__scenarioEnabled || !non) {
      windowAny.vscode?.postMessage({
        type: 'scenarioResult',
        requestId: reqId,
        nonce: non,
        ok: false,
        error: 'scenario executor disabled'
      });
      return;
    }

    const result = await executeScenarioActions(
      Array.isArray(actions) ? actions : [],
      { doc: document, now: () => Date.now() }
    );

    windowAny.vscode?.postMessage({
      type: 'scenarioResult',
      requestId: reqId,
      nonce: non,
      ok: result.ok,
      events: result.events,
      texts: result.texts,
      allTexts: result.allTexts,
      values: result.values,
      counts: result.counts,
      canvasStats: result.canvasStats,
      ...(result.error ? { error: result.error } : {})
    });
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

