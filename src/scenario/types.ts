/**
 * Scenario E2E 测试驱动桥共享类型定义。
 *
 * ⚠️ 本模块不 import 'vscode'，纯 TypeScript 类型定义。
 */

/** 场景目标定位：多实例面板必须带 uri */
export interface ScenarioTarget {
  viewType: string;
  uri?: string;
}

/** Webview 的最小抽象：仅需 postMessage 接口，便于单元测试注入假对象 */
export interface ScenarioWebview {
  postMessage(message: unknown): PromiseLike<boolean> | boolean;
}

/** 画布像素统计结果（结构性统计，不依赖具体色值） */
export interface CanvasStatsResult {
  width: number;
  height: number;
  sampledPixels: number;
  transparentPixels: number;    // alpha === 0 的像素数
  colorVariety: number;         // 不同的 RGBA 颜色种类数
  dominantColorRatio: number;   // 出现频次最高的单一颜色占比 (0.0 ~ 1.0)
  topColors: string[];          // 频次前 5 的颜色（调试排查用）
}

/** 动作集支持 */
export type ScenarioAction =
  | { type: 'waitForElement'; selector: string; timeoutMs?: number }
  | { type: 'waitForText'; selector: string; matches: string; timeoutMs?: number }
  | { type: 'click'; selector: string }
  | { type: 'input'; selector: string; value: string }
  | { type: 'key'; key: string; ctrl?: boolean; shift?: boolean }
  | { type: 'sleep'; ms: number }
  | { type: 'readText'; selector: string }
  | { type: 'readTextOptional'; selector: string }
  | { type: 'readValue'; selector: string }
  | { type: 'readValueOptional'; selector: string }
  | { type: 'countElements'; selector: string }
  | { type: 'readCanvasStats'; selector: string; sampleStep?: number };

export interface ScenarioEvent {
  action: ScenarioAction;
  at: number;
  result?: unknown;
}

/** 回送给宿主的最终结果 */
export interface ScenarioResult {
  ok: boolean;
  events?: ScenarioEvent[];
  texts?: Record<string, string | null>;   // selector -> innerText
  values?: Record<string, string | null>;  // selector -> input.value
  counts?: Record<string, number>;        // selector -> querySelectorAll().length
  canvasStats?: CanvasStatsResult;         // 最近一次 readCanvasStats 的结果
  error?: string;
}
