"use strict";

/**
 * 场景：**采集通道配置 UI（重命名 / 批量勾选与条件渲染联动）**。
 *
 * ## ⚠️ 诚实定性：本场景的判据面是 DOM + Pinia store，**不是端到端**。
 *
 * 通道配置（deviceStore.captureConfig.channels）在当前已打开的 .lac 会话下
 * **不写回磁盘** —— 它属于"下次硬件采集的配置准备区"。
 * 只有用户点「开始采集」且真实采集成功后，宿主才会把通道元数据写入新文件。
 *
 * ⇒ 本场景证明的是「UI 交互 → store 状态 → 条件渲染」这条链通了，
 *    不证明「配置被持久化」。后者需要真机采集，属于另一个场景。
 *
 * ## 判据面
 * 1. initial-channels-rendered: 默认呈现 8 个通道行，第 1 行序号为 CH1，名称为 Channel 1
 * 2. channel-rename-applied: 通过真实 DOM input 事件将 CH1 重命名为 SPI_CLK 后，输入框 value 即刻呈现 SPI_CLK
 * 3. channel-clear-removes-rows: 点击「全不选」工具按钮后，所有通道行（.channel-names__row）从 DOM 中条件移除（count = 0）
 * 4. channel-invert-restores-state: 点击「反选」工具按钮后，通道行恢复呈现（count = 8），且此前重命名的 "SPI_CLK" 保持有效
 *
 * ## 变异矩阵
 * - 变异 A（测重命名双向绑定）：AppSidebarLeft.vue:440 v-model 改为 :value → 仅 channel-rename-applied 必红
 * - 变异 B（测全不选精度）：AppSidebarLeft.vue:176 clearChannels 只清前 7 个 → 仅 channel-clear-removes-rows 必红
 * - 变异 C（测条件渲染响应式）：AppSidebarLeft.vue:83 selectedChannelRows 去除 filter → 仅 channel-clear-removes-rows 必红
 * - 变异 D（测反选恢复逻辑）：AppSidebarLeft.vue:181 invertChannels 置空不取反 → 仅 channel-invert-restores-state 必红
 */

const { copyFileSync, existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-channel-config",
  title: "通过 Webview 驱动采集通道重命名、全选/全不选与条件渲染响应",
  needsHardware: false,

  async run({ vscode, workspaceDir, oracles, waitFor, withTimeout }) {
    if (!workspaceDir || !existsSync(workspaceDir)) {
      oracles.record("workspace-ready", "fail", `工作区目录不存在：${workspaceDir}`);
      return;
    }

    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "未找到扩展");
      return;
    }
    await withTimeout(extension.activate(), 30000, "activate");

    // 1. 准备 fixture
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/current-lowercase-samples.lac");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const targetFileName = "ui_channel_config_test.lac";
    const targetFilePath = join(workspaceDir, targetFileName);
    copyFileSync(fixtureSource, targetFilePath);

    const fileUri = vscode.Uri.file(targetFilePath);
    oracles.record("fixture-ready", "pass", targetFileName);

    // 2. 打开自定义编辑器拉起 Webview
    try {
      await withTimeout(
        vscode.commands.executeCommand("vscode.open", fileUri),
        30000,
        "vscode.open"
      );
    } catch (error) {
      oracles.record("editor-opened", "fail", `打开编辑器失败: ${String(error)}`);
      return;
    }

    let tabInfo = null;
    try {
      await waitFor(
        () => {
          const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
          tabInfo = tabs.find(tab => {
            const input = tab.input;
            return (
              input &&
              typeof input === "object" &&
              input.uri &&
              String(input.uri.fsPath).endsWith(targetFileName) &&
              input.viewType === LAC_EDITOR_VIEW_TYPE
            );
          });
          return Boolean(tabInfo);
        },
        15000,
        "tabGroups 出现该 .lac 面板"
      );
    } catch {
      /* 下方统一判断 */
    }

    if (!tabInfo) {
      oracles.record("editor-opened", "fail", "未在 tabGroups 找到对应 viewType 的 custom editor tab");
      return;
    }
    oracles.record("editor-opened", "pass", `viewType=${LAC_EDITOR_VIEW_TYPE}`);

    // 3. 执行通道配置动作集
    const channelActions = [
      // L-A: 初始 8 通道渲染检测
      { type: "waitForElement", selector: ".channel-names__row:nth-child(8)" },
      { type: "countElements", selector: ".channel-names__row" },
      { type: "readText", selector: ".channel-names__row:nth-child(1) span" },
      { type: "readValue", selector: ".channel-names__row:nth-child(1) input" },

      // L-B: 通道 1 重命名为 "SPI_CLK"
      { type: "input", selector: ".channel-names__row:nth-child(1) input", value: "SPI_CLK" },
      { type: "readValue", selector: ".channel-names__row:nth-child(1) input" },

      // L-C: 点击「全不选」按钮
      { type: "click", selector: ".capture-form__channel-tools button:nth-child(2)" },
      { type: "sleep", ms: 50 },
      { type: "countElements", selector: ".channel-names__row" },

      // L-D: 点击「反选」按钮恢复全部通道
      { type: "click", selector: ".capture-form__channel-tools button:nth-child(3)" },
      { type: "sleep", ms: 100 },
      { type: "countElements", selector: ".channel-names__row" },
      { type: "readValueOptional", selector: ".channel-names__row:nth-child(1) input" }
    ];

    let result = null;
    try {
      result = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          channelActions,
          {
            viewType: LAC_EDITOR_VIEW_TYPE,
            uri: fileUri.toString()
          }
        ),
        30000,
        "__runEditorScenario"
      );
    } catch (error) {
      oracles.record("scenario-executes", "fail", `__runEditorScenario 执行失败: ${String(error)}`);
      return;
    }

    if (!result || !result.ok) {
      oracles.record("scenario-executes", "fail", `Webview 回包失败: ${result?.error || "unknown"}`);
      return;
    }
    oracles.record("scenario-executes", "pass", `Webview 响应正常 (${result.events?.length || 0} actions)`);

    const counts = result.counts || {};
    const texts = result.texts || {};
    const values = result.values || {};

    // ---- 断言 1：initial-channels-rendered ----
    const countEvents = (result.events || []).filter(e => e.action.type === "countElements");
    const initialCount = countEvents.length >= 1 ? countEvents[0].result : counts[".channel-names__row"];
    const ch1Label = texts[".channel-names__row:nth-child(1) span"];
    const ch1InitialVal = result.events?.[3]?.result;

    if (initialCount !== 8) {
      oracles.record("initial-channels-rendered", "fail", `初始通道行数为 ${initialCount}，期望为 8`);
    } else if (ch1Label !== "CH1") {
      oracles.record("initial-channels-rendered", "fail", `首行标签为 "${ch1Label}"，期望为 "CH1"`);
    } else if (ch1InitialVal !== "Channel 1") {
      oracles.record("initial-channels-rendered", "fail", `首行初始名称为 "${ch1InitialVal}"，期望为 "Channel 1"`);
    } else {
      oracles.record("initial-channels-rendered", "pass", "初始 8 通道完整呈现 (CH1=Channel 1)");
    }

    // ---- 断言 2：channel-rename-applied ----
    const renamedVal = result.events?.[5]?.result;
    if (renamedVal !== "SPI_CLK") {
      oracles.record("channel-rename-applied", "fail", `重命名后名称为 "${renamedVal}"，期望为 "SPI_CLK"`);
    } else {
      oracles.record("channel-rename-applied", "pass", `CH1 成功重命名为 "SPI_CLK"`);
    }

    // ---- 断言 3：channel-clear-removes-rows ----
    const countAfterClear = countEvents.length >= 2 ? countEvents[1].result : null;

    if (countAfterClear !== 0) {
      oracles.record(
        "channel-clear-removes-rows",
        "fail",
        `点击全不选后通道行数为 ${countAfterClear}，期望为 0`
      );
    } else {
      oracles.record("channel-clear-removes-rows", "pass", "全不选后所有通道行已从 DOM 移除 (count=0)");
    }

    // ---- 断言 4：channel-invert-restores-state ----
    const countAfterInvert = countEvents.length >= 3 ? countEvents[2].result : null;
    const restoredVal = result.events?.[12]?.result;

    if (countAfterInvert !== 8) {
      oracles.record(
        "channel-invert-restores-state",
        "fail",
        `反选恢复后通道行数为 ${countAfterInvert}，期望为 8`
      );
    } else if (restoredVal !== "SPI_CLK") {
      oracles.record(
        "channel-invert-restores-state",
        "fail",
        `反选恢复后通道 1 名称为 "${restoredVal}"，未能保持此前重命名的 "SPI_CLK"`
      );
    } else {
      oracles.record(
        "channel-invert-restores-state",
        "pass",
        `反选恢复 8 行且重命名持久保持 (count=8, CH1="SPI_CLK")`
      );
    }
  }
};
