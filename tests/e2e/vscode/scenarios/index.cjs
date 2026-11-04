"use strict";

/**
 * 场景注册表 —— **单一来源**。
 *
 * ⚠️ 新场景只放文件是不够的，**必须登记在这里**；否则 `--scenario <id>` 报未知，
 * 默认全跑时又静默跳过 —— 那是"登记册说经 X 跑而 X 不存在"的同族缺陷。
 *
 * ## 加场景时必须同步的两处
 *
 * 1. 本文件 `require` 一行
 * 2. 场景文件里的 `needsHardware` 声明（供 runner 做硬件前置判断）
 *
 * ## 场景模块**不要在顶层 require("vscode")**
 *
 * `ctx` 本来就带 `vscode`。顶层 require 会让模块在宿主外（单测/门禁扫描）
 * 加载时报 `Cannot find module 'vscode'` —— 那个错误与真实缺陷无关却每次要重查。
 *
 * ## 分目录约定
 *
 * `common/`  —— 与硬件无关（命令面、落盘、webview）
 * `hardware/` —— 需要真机（默认登记为 not_exercised 并自证原因）
 */

module.exports = [
  require("./common/commands-coverage.scenario.cjs"),
  require("./common/open-analyzer.scenario.cjs"),
  require("./common/create-synthetic-capture.scenario.cjs"),
  require("./common/network-scan.scenario.cjs"),
  require("./common/ui-waveform.scenario.cjs"),
  require("./common/ui-channel-config.scenario.cjs"),
  require("./common/ui-trigger-config.scenario.cjs"),
  require("./common/ui-export-button.scenario.cjs"),
  require("./common/ui-decoder.scenario.cjs"),
  require("./common/network-capture-mock.scenario.cjs"),
  // ⚠️ 探针场景：**默认不注册**，只在变异验证时显式打开
  //    （`LA_E2E_PROBE=1`）。
  //
  //    为什么不常驻：它会永远产生一条 fail，把全量 e2e 的退出码从 3 拉到 1，
  //    那是**污染真实基线**。但它必须留档 —— 见文件头的假绿复现说明，
  //    否则后人无法证明 runner 的「hostError 参与退出码」修复仍然生效。
  ...(process.env.LA_E2E_PROBE === "1"
    ? [
        require("./common/_probe-fakegreen.scenario.cjs"),
        require("./common/_probe-notify-commands.scenario.cjs"),
        require("./common/_probe-sidebar-scan-config.scenario.cjs"),
      ]
    : []),
];
