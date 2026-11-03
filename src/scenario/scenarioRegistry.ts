/**
 * 宿主侧「可被场景驱动的 Webview」注册表。
 *
 * ## 为什么必须走登记表 + postMessage 桥（实测证据）
 * 2026-11-03 真宿主实测探测（/tmp/probe-dom/）：
 * 在 VS Code 真实运行环境下，vscode.window.tabGroups.all.flatMap(g => g.tabs) 返回的 Tab 中：
 * - tab.input 仅有 ['uri', 'viewType'] 两个纯数据属性；
 * - 没有任何 webview 引用、句柄或通信方法；
 * - 原型链上仅有基础构造函数，物理上完全不可能从宿主直接触摸到 Webview 内部 DOM。
 * ⇒ 宿主与 Webview 的通信【必须且只能】通过 WebviewPanel 提供的 postMessage 双向桥通道。
 *
 * ## 为什么要用 viewType + uri 双字段定位
 * 本插件的 Custom Editor 面板是多实例按文件共存的（用户可同时打开多个 .lac 文件）。
 * 若只用 viewType 定位，在多开面板时若“静默挑一个”，会发生“驱动 A 面板却断言 B 面板”的致命假绿。
 * ⇒ 定位严格使用 { viewType, uri }。0 命中与多命中坚决 Fail-Closed 抛错，绝不静默挑一个。
 *
 * ## ⚠️ 纪律
 * 1. 本模块【绝不 import 'vscode'】，纯逻辑，方便在 jest 中单测。
 * 2. 累积结构必须有明确释放点：register 返回 unregister 注销函数，面板 dispose 时必调。
 */

import type { ScenarioTarget, ScenarioWebview } from './types';

export const DEFAULT_VIEW_TYPE = 'logicAnalyzer.lacEditor';

export interface RegisteredWebviewEntry {
  target: ScenarioTarget;
  webview: ScenarioWebview;
  ready: Promise<void>;
}

const registry: RegisteredWebviewEntry[] = [];

/**
 * 登记一个可被场景驱动的 Webview 面板
 *
 * @param target 目标标识（viewType + uri）
 * @param webview Webview 实例抽象
 * @param ready 该面板 Webview 脚本加载并挂上消息监听器的就绪 Promise
 * @returns 注销函数，面板 dispose 时必须调用
 */
export function registerScenarioWebview(
  target: ScenarioTarget,
  webview: ScenarioWebview,
  ready: Promise<void>
): () => void {
  const entry: RegisteredWebviewEntry = { target, webview, ready };
  registry.push(entry);

  return () => {
    // 按引用身份移除，防止面板重建时误删同名新条目
    const index = registry.indexOf(entry);
    if (index >= 0) {
      registry.splice(index, 1);
    }
  };
}

/**
 * 内部候选查找：按 target 过滤
 */
function findCandidates(target?: ScenarioTarget): RegisteredWebviewEntry[] {
  if (!target) {
    return registry.filter(
      e => e.target.viewType === DEFAULT_VIEW_TYPE && e.target.uri === undefined
    );
  }

  return registry.filter(
    e =>
      e.target.viewType === target.viewType &&
      (target.uri === undefined || e.target.uri === target.uri)
  );
}

/**
 * 按 target 解析出目标 Webview 及其 ready 门控。
 *
 * 0 命中或多命中都抛错（不静默挑一个）：
 * - 0 命中：面板未打开 / 已关闭 / viewType 错误。
 * - 多命中：多开场景下 target 未指定明确的 uri。
 */
export function resolveScenarioWebview(target?: ScenarioTarget): {
  webview: ScenarioWebview;
  ready: Promise<void>;
} {
  const hits = findCandidates(target);
  const scope =
    target === undefined
      ? `default (viewType "${DEFAULT_VIEW_TYPE}")`
      : `viewType "${target.viewType}"${
          target.uri !== undefined ? ` uri "${target.uri}"` : ' (any uri)'
        }`;

  if (hits.length === 0) {
    throw new Error(`no scenario webview matches ${scope} — open the target panel first`);
  }

  if (hits.length > 1) {
    throw new Error(
      `${hits.length} scenario webviews match ${scope} — narrow the target with an explicit uri (multi-instance panel)`
    );
  }

  return {
    webview: hits[0].webview,
    ready: hits[0].ready
  };
}

/**
 * 获取当前已注册的所有条目快照（诊断排查用）
 */
export function getRegisteredScenarioWebviews(): readonly RegisteredWebviewEntry[] {
  return [...registry];
}

/**
 * 仅测试用：重置登记表
 */
export function __resetScenarioRegistryForTest(): void {
  registry.length = 0;
}
