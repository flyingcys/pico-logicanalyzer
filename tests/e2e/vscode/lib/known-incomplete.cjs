"use strict";

/**
 * 真宿主 E2E 的「已登记未完成项」白名单（2026-11-05 快照）。
 *
 * ⚠️ 这是**机制**不是免责声明：
 *  - runner 的 `--allow-registered-incomplete` 会逐条比对本次运行的
 *    `oracles[]` 非 pass 项与本清单；
 *  - 新增未登记项 → 非 0（防「随便登记一条把问题挪走」）；
 *  - 清单里登记了但本次没出现 → 非 0（stale 白名单是未来的假绿来源）。
 *  ⇒ 任何一条要加入/移除，都必须先改本文件、跑自检、并在台账留痕。
 *
 * 只登记 `oracles.record()` 产生的项（进 overall 计算）。
 * `oracles.delegate()` 进 delegates[]，由 runner 独立做跨场景对账，不在此列。
 *
 * 每条必须有可核实的原因与文件坐标；`registeredAt` 是登记日期，不是实测日期。
 */
module.exports = [
  {
    scenarioId: "commands-coverage",
    oracleId: "not-executed:connectDevice",
    status: "not_exercised",
    registeredAt: "2026-11-04",
    reason: "extension.ts:143 await showWarningMessage 在真宿主永不 resolve；单测覆盖 Extension.coverage.test.ts:602-635",
  },
  {
    scenarioId: "commands-coverage",
    oracleId: "not-executed:startCapture",
    status: "not_exercised",
    registeredAt: "2026-11-04",
    reason: "extension.ts:234 await showWarningMessage 在真宿主永不 resolve；单测覆盖 Extension.coverage.test.ts:728-755",
  },
  {
    scenarioId: "commands-coverage",
    oracleId: "not-executed:networkDiagnostics",
    status: "not_exercised",
    registeredAt: "2026-11-04",
    reason: "extension.ts:365 await showInputBox 在真宿主永不 resolve；单测覆盖 Extension.coverage.test.ts:710-726",
  },
  {
    scenarioId: "ui-export-button",
    oracleId: "export-persistence",
    status: "blocked",
    registeredAt: "2026-11-04",
    reason: "showSaveDialog 永不 resolve（README §5.1）；DataExportService 落盘由 LACEditorProvider.exportPersistence.test.ts 单测覆盖",
  },
];
