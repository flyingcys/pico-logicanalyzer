"use strict";

/**
 * ⚠️ **探针场景，仅供变异验证，不是产品覆盖**。
 *
 * 用途：证明「场景抛异常 / 零 oracle」时，runner 不会把结果报成通过。
 *
 * 2026-11-03 实测的假绿链路（三处叠加）：
 *   1. `host-driver.cjs` 捕获异常后**先写结果 JSON**（overall 仍算 pass），再 throw
 *   2. `oracles.cjs` 零 oracle 时 `overall()` 返回 pass
 *   3. `runner.cjs` 退出码只看 `overall`，**hostError 从不参与**
 * ⇒ 打印「✅ 全部场景通过」并 EXIT=0。
 *
 * 修好之后本场景必须让 runner **非 0 退出**。
 */
module.exports = {
  id: "_probe-fakegreen",
  title: "（探针）场景主动抛异常，用于验证 runner 不会把失败报成通过",
  needsHardware: false,

  async run() {
    throw new Error("模拟场景内部崩溃（探针）");
  },
};
