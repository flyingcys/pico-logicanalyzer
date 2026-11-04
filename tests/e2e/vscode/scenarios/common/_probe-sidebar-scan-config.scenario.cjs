"use strict";

/**
 * ⚠️ **探针场景（仅供调查验证，不属于常规回归）** —— 验证侧栏扫描是否读取 `scanTimeoutMs` 配置。
 *
 * 背景：
 * - 命令面板入口 `logicAnalyzer.scanNetworkDevices`（`extension.ts:301`）会主动从
 *   `vscode.workspace.getConfiguration('logicAnalyzer.network')` 读取 `scanTimeoutMs`；
 * - 而 Webview 侧栏「扫描网络」按钮（`AppSidebarLeft.vue:127`）直接写死了
 *   `captureCommands.scanNetworkDevices({ timeoutMs: 5000 })`；
 * - 宿主 `LACEditorProvider.ts:877` 收到 `hostCommand` 后，原样透传 `payload` 给
 *   `WiFiDeviceDiscovery.scanForDevices(payload)`，完全没有合并工作区配置！
 *
 * 调查目标：
 * 1. 【对照组：命令面板】分别在 scanTimeoutMs = 1200 与 5000 下执行，记录两组耗时；
 * 2. 【实验组：侧栏 Webview 按钮】同样在 1200 与 5000 配置下点击触发，记录实际耗时与 postMessage payload；
 * 3. 对比两组耗时响应与 payload 内容，坐实「两条入口行为不一致」的原始事实。
 *
 * 门控：`LA_E2E_PROBE=1`
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "_probe-sidebar-scan-config",
  title: "（探针）实测侧栏扫描与命令面板在不同 scanTimeoutMs 下的耗时与 payload 对照",
  needsHardware: false,

  async run({ vscode, workspaceDir, oracles, waitFor, withTimeout }) {
    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "未找到扩展");
      return;
    }
    await withTimeout(extension.activate(), 30000, "activate");

    const configuration = vscode.workspace.getConfiguration("logicAnalyzer.network");

    // =========================================================================
    // 阶段 1：对照组 —— 经命令面板入口（logicAnalyzer.scanNetworkDevices）
    // =========================================================================
    async function runCommandScan(timeoutMs) {
      await configuration.update("scanTimeoutMs", timeoutMs, vscode.ConfigurationTarget.Workspace);
      const start = Date.now();
      let result = null;
      let error = null;
      try {
        result = await withTimeout(
          vscode.commands.executeCommand("logicAnalyzer.scanNetworkDevices", { autoSelect: true }),
          15000,
          `cmdScan@${timeoutMs}`
        );
      } catch (err) {
        error = String(err && err.message ? err.message : err);
      }
      return { elapsedMs: Date.now() - start, result, error };
    }

    console.log("\n[Probe] 开始测试对照组：命令面板入口...");
    const cmd1200 = await runCommandScan(1200);
    console.log(`[Probe] 命令面板 @1200ms: 耗时 ${cmd1200.elapsedMs}ms, error=${cmd1200.error || "none"}`);

    const cmd5000 = await runCommandScan(5000);
    console.log(`[Probe] 命令面板 @5000ms: 耗时 ${cmd5000.elapsedMs}ms, error=${cmd5000.error || "none"}`);

    const cmdDelta = cmd5000.elapsedMs - cmd1200.elapsedMs;
    oracles.record(
      "probe:cmd-scan-timing",
      cmdDelta >= 1500 ? "pass" : "fail",
      `命令面板入口：timeout=1200 → ${cmd1200.elapsedMs}ms；timeout=5000 → ${cmd5000.elapsedMs}ms；差值 ${cmdDelta}ms（随配置显著变化）`
    );

    // =========================================================================
    // 阶段 2：准备 Webview 自定义编辑器环境
    // =========================================================================
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/current-lowercase-samples.lac");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 不存在: ${fixtureSource}`);
      return;
    }

    const testFileName = "sidebar_scan_probe.lac";
    const testFilePath = join(workspaceDir, testFileName);
    copyFileSync(fixtureSource, testFilePath);

    const fileUri = vscode.Uri.file(testFilePath);
    await withTimeout(vscode.commands.executeCommand("vscode.open", fileUri), 30000, "vscode.open");

    // 等待编辑器打开并被注册
    let tabInfo = null;
    await waitFor(
      () => {
        const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
        tabInfo = tabs.find(
          t => t.input && String(t.input.uri?.fsPath).endsWith(testFileName) && t.input.viewType === LAC_EDITOR_VIEW_TYPE
        );
        return Boolean(tabInfo);
      },
      15000,
      "等待 tab 出现"
    );

    if (!tabInfo) {
      oracles.record("editor-opened", "fail", "未找到自定义编辑器 tab");
      return;
    }

    // =========================================================================
    // 阶段 3：实验组 —— 经 Webview 侧栏「扫描网络」按钮
    // =========================================================================
    // 先确保侧边栏与扫描按钮在 DOM 中已经完全就绪（消除 Webview 首次渲染的冷启动耗时）
    const target = {
      viewType: LAC_EDITOR_VIEW_TYPE,
      uri: fileUri.toString()
    };
    await vscode.commands.executeCommand(
      "logicAnalyzer.__runEditorScenario",
      [{ type: "waitForElement", selector: ".app-sidebar-left__commands button:nth-child(2)" }],
      target
    );

    async function runSidebarScan(configTimeoutMs) {
      await configuration.update("scanTimeoutMs", configTimeoutMs, vscode.ConfigurationTarget.Workspace);

      const actions = [
        { type: "startCaptureMessages" },
        { type: "click", selector: ".app-sidebar-left__commands button:nth-child(2)" },
        { type: "sleep", ms: 100 },
        { type: "stopCaptureMessages" },
        // 等待扫描结束弹出消息
        { type: "waitForElement", selector: ".el-message", timeoutMs: 15000 }
      ];

      const start = Date.now();
      let res = null;
      let error = null;
      try {
        res = await withTimeout(
          vscode.commands.executeCommand("logicAnalyzer.__runEditorScenario", actions, target),
          20000,
          `sidebarScan@${configTimeoutMs}`
        );
      } catch (err) {
        error = String(err && err.message ? err.message : err);
      }

      const totalElapsed = Date.now() - start;
      const captured = res?.capturedMessages || [];
      const scanCmdMsg = captured.find(
        m => m && m.type === "hostCommand" && (m.command === "scanNetworkDevices" || m.command === "scanForDevices")
      );

      return {
        totalElapsed,
        payload: scanCmdMsg ? scanCmdMsg.payload : null,
        error
      };
    }

    console.log("\n[Probe] 开始测试实验组：Webview 侧栏扫描...");
    const side1200 = await runSidebarScan(1200);
    console.log(
      `[Probe] 侧栏扫描 @1200ms配置: 耗时 ${side1200.totalElapsed}ms, payload=${JSON.stringify(side1200.payload)}`
    );

    // 等待 4 秒让前一次扫描的消息提示完全从 DOM 消失，避免污染下一次 waitForElement
    await new Promise(r => setTimeout(r, 4000));

    const side5000 = await runSidebarScan(5000);
    console.log(
      `[Probe] 侧栏扫描 @5000ms配置: 耗时 ${side5000.totalElapsed}ms, payload=${JSON.stringify(side5000.payload)}`
    );

    const sideDelta = Math.abs(side5000.totalElapsed - side1200.totalElapsed);

    // =========================================================================
    // 阶段 4：两组分布采样测试 —— 1200ms 配置 5 次 vs 5000ms 配置 5 次
    // =========================================================================
    console.log("\n[Probe] 开始测试 1200ms 配置连续 5 次采样...");
    const repeat1200 = [];
    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 3500));
      const sample = await runSidebarScan(1200);
      repeat1200.push(sample.totalElapsed);
      console.log(`[Probe] 1200ms 配置 采样 #${i}: 耗时 ${sample.totalElapsed}ms`);
    }

    console.log("\n[Probe] 开始测试 5000ms 配置连续 5 次采样...");
    const repeat5000 = [];
    for (let i = 1; i <= 5; i++) {
      await new Promise(r => setTimeout(r, 3500));
      const sample = await runSidebarScan(5000);
      repeat5000.push(sample.totalElapsed);
      console.log(`[Probe] 5000ms 配置 采样 #${i}: 耗时 ${sample.totalElapsed}ms`);
    }

    const min1200 = Math.min(...repeat1200);
    const max1200 = Math.max(...repeat1200);
    const min5000 = Math.min(...repeat5000);
    const max5000 = Math.max(...repeat5000);
    const gap = min5000 - max1200;

    console.log(`\n[Probe] 1200ms 分布: [${repeat1200.join(', ')}]，区间: [${min1200}, ${max1200}]ms`);
    console.log(`[Probe] 5000ms 分布: [${repeat5000.join(', ')}]，区间: [${min5000}, ${max5000}]ms`);
    console.log(`[Probe] 分布间隙 (min5000 - max1200): ${gap}ms`);

    oracles.record(
      "probe:distribution-non-overlapping",
      gap > 1000 ? "pass" : "fail",
      `1200ms区间[${min1200}, ${max1200}]ms 与 5000ms区间[${min5000}, ${max5000}]ms 严格不重叠，间隙 ${gap}ms`
    );
  }
};
