"use strict";

/**
 * 已人工登记的硬件场景白名单（2026-11-05 快照）。
 *
 * ## 为什么需要它（这是 known-incomplete 的对称机制）
 *
 * 只有场景自己声明 `needsHardware: true` 是不够的：任何人给任意场景加上这个
 * 标记，它的 oracle 就会全部消失，而退出码仍可能是 0 —— 那正是
 * 「把未验伪装成验过」的后门。
 *
 * ## gate 规则
 *
 * - 声明 `needsHardware: true` 但**不在**本表 → 硬失败 EXIT=4，点名未登记
 * - 本表登记了但场景不存在 / 该场景并未声明 `needsHardware` → 硬失败（stale/错配）
 *
 * ⇒ 想跳过一个硬件场景，必须像 known-incomplete 一样**人工审核并留痕**。
 *
 * 当前为空：仓库内 17 个场景全部 `needsHardware: false`，真机场景尚未落地。
 */
module.exports = [
  // 示例（不要直接启用，需对应场景真的存在且声明 needsHardware: true）：
  // {
  //   scenarioId: "hardware-serial-capture",
  //   reason: "需要真实 Pico 逻辑分析器（1209:3020）才能验证 DMA 采样与 PIO 触发延时",
  //   registeredAt: "2026-11-05",
  // },
];
