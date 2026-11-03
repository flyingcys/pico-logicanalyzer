"use strict";

/**
 * 场景：**协议解码 UI（I2C 自动引脚映射 / 端到端宿主解码执行 / 23 帧结果表格渲染与语义校验）**。
 *
 * ## 真实端到端闭环链路说明
 * 与导出按钮（受限于 showSaveDialog 弹窗）不同，协议解码走的是**纯计算的端到端闭环链路**：
 * - Webview 前端：@click="runDecoder" 发出 host.sendCommand('runDecoder', { decoderId: 'i2c', ... })
 * - VS Code 宿主：LACEditorProvider 接收并由 DecoderManager 在 CPU 内存中执行算法解码（零原生弹窗阻断）
 * - 宿主回发结果：返回 23 条完整 I2C 协议帧（Start, Address write: 50, ACK, Data write: 3C, ACK, Stop）
 * - Webview 响应式呈现：表格渲染 23 行，汇总显示 23 条。
 *
 * ## 判据面
 * 1. L1-decoder-initial-clean: 解码前表格结构存在（count=1），无数据行（count=0），汇总结果数显示为 "0"
 * 2. L2-decoder-ready-to-run: SCL 与 SDA 依据通道名自动配对就绪，运行按钮处于可用非禁用态（count=1）
 * 3. L3-decoder-results-produced: 点击运行解码后，宿主端到端计算完成，结果行数精确等于 23，汇总显示为 "23"
 * 4. L4-decoder-semantics-verified: 首行结果小写文本包含 "start"，确证解码出了真实的 I2C 起始条件
 *
 * ## 变异矩阵
 * - 变异 A（测按钮点击接线）：AppSidebarRight.vue:264 runDecoder 置空 → L3/L4 因果链失败
 * - 变异 B（测宿主通信命令）：decoderStore.ts:638 sendCommand('runDecoder') 改为 'runDecoderMUTANT' → L3/L4 宿主协议通信失败
 * - 变异 C（测引脚缺失禁用）：decoderStore.ts:295 sclCaptureIndex 置空 → L2 失败 + L3/L4 因果链失败（共红三条：L2+L3+L4，非单点独立），L1 仍 pass
 * - 变异 D（测渲染行数独立性）：AppSidebarRight.vue:166 resultRows 改为 slice(0, 1) → 仅 L3 失败（行数 1 ≠ 23，但首行仍有 Start 保持 L4 通过，证明 L3/L4 独立）
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-decoder",
  title: "经 Webview 驱动 I2C 协议端到端解码执行，验证 23 帧结果表格渲染与语义标注",
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

    // 1. 准备真实的 I2C 夹具文件（tests/fixtures/lac/i2c-ui-smoke.lac.json，含 164 个 SCL/SDA 样本）
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/i2c-ui-smoke.lac.json");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const targetFileName = "ui_decoder_test.lac";
    const targetFilePath = join(workspaceDir, targetFileName);
    copyFileSync(fixtureSource, targetFilePath);

    const fileUri = vscode.Uri.file(targetFilePath);
    oracles.record("fixture-ready", "pass", targetFileName);

    // 2. 打开编辑器
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
          const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
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
      /* 统一判断 */
    }

    if (!tabInfo) {
      oracles.record("editor-opened", "fail", "未在 tabGroups 找到对应 viewType 的 custom editor tab");
      return;
    }
    oracles.record("editor-opened", "pass", `viewType=${LAC_EDITOR_VIEW_TYPE}`);

    // 3. 执行解码驱动动作集
    const decoderActions = [
      // 阶段 1: 初始干净基线
      // 0: 等待运行按钮出现
      { type: "waitForElement", selector: "button.decoder-panel__run" },
      // 1: 验证表格容器存在（无 v-if）
      { type: "countElements", selector: ".decoder-panel__table" },
      // 2: 验证数据行初始为 0
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      // 3: 读汇总卡片结果数（初始为 "0"）
      { type: "readText", selector: ".app-sidebar-right__summary .app-sidebar-right__row:nth-child(1) dd" },
      // 4: 验证运行按钮处于非禁用状态（SCL/SDA 自动配对成功）
      { type: "countElements", selector: "button.decoder-panel__run:not([disabled])" },

      // 阶段 2: 触发真实端到端解码
      // 5: 点击「运行 I2C 解码」按钮
      { type: "click", selector: "button.decoder-panel__run" },
      // 6: 留出 400ms 等待宿主 CPU 解码计算与 Vue 响应式表格渲染完成
      { type: "sleep", ms: 400 },

      // 阶段 3: 收集解码产出与语义
      // 7: 统计结果行数（期望 23）
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      // 8: 读汇总卡片结果数（期望 "23"）
      { type: "readText", selector: ".app-sidebar-right__summary .app-sidebar-right__row:nth-child(1) dd" },
      // 9: 读首行完整文本（包含 Start；无行时返回 null，不阻断场景执行）
      { type: "readTextOptional", selector: ".decoder-panel__table tbody tr:nth-child(1)" }
    ];

    let result = null;
    try {
      result = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          decoderActions,
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

    const events = result.events || [];

    // ---- 断言 1: L1-decoder-initial-clean ----
    const tableExists = events[1]?.result;
    const initialRows = events[2]?.result;
    const initialSummary = events[3]?.result;

    if (tableExists !== 1) {
      oracles.record("L1-decoder-initial-clean", "fail", `表格容器不存在 (count=${tableExists})`);
    } else if (initialRows !== 0) {
      oracles.record("L1-decoder-initial-clean", "fail", `初始数据行不为 0 (count=${initialRows})`);
    } else if (initialSummary !== "0") {
      oracles.record("L1-decoder-initial-clean", "fail", `初始汇总结果数 "${initialSummary}" 不等于 "0"`);
    } else {
      oracles.record("L1-decoder-initial-clean", "pass", "解码前表格与汇总状态干净 (table=1, rows=0, summary=0)");
    }

    // ---- 断言 2: L2-decoder-ready-to-run ----
    const runBtnEnabledCount = events[4]?.result;
    if (runBtnEnabledCount !== 1) {
      oracles.record("L2-decoder-ready-to-run", "fail", "运行解码按钮处于禁用状态，引脚映射未自动完成");
    } else {
      oracles.record("L2-decoder-ready-to-run", "pass", "I2C 引脚自动配对成功，解码按钮处于可用状态");
    }

    // ---- 断言 3: L3-decoder-results-produced ----
    const decodedRows = events[7]?.result;
    const decodedSummary = events[8]?.result;

    if (decodedRows !== 23) {
      oracles.record("L3-decoder-results-produced", "fail", `解码结果行数 ${decodedRows} 不等于期望的 23 帧`);
    } else if (decodedSummary !== "23") {
      oracles.record("L3-decoder-results-produced", "fail", `汇总结果数 "${decodedSummary}" 不等于 "23"`);
    } else {
      oracles.record("L3-decoder-results-produced", "pass", `端到端解码成功产出 23 帧结果 (rows=23, summary=23)`);
    }

    // ---- 断言 4: L4-decoder-semantics-verified ----
    const firstRowText = (events[9]?.result || "").toLowerCase();
    if (!firstRowText.includes("start")) {
      oracles.record(
        "L4-decoder-semantics-verified",
        "fail",
        `首行结果文本 "${events[9]?.result}" 未包含 "start" 语义`
      );
    } else {
      oracles.record(
        "L4-decoder-semantics-verified",
        "pass",
        `首行正确标注 I2C 起始条件 (text="${events[9]?.result}")`
      );
    }
  }
};
