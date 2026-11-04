"use strict";

/**
 * 场景：**UART 协议解码 UI（单线 RX 自动映射 / 8N1 双字符连续解码 / 波特率参数 UI 联动与帧错误判据）**。
 *
 * ## 真实端到端闭环链路说明
 * - Webview 前端：切换协议到 UART，自动配对 RX 通道，展示 115200 默认波特率
 * - 第一次解码：以 115200 波特率运行解码，宿主端到端产出 24 帧结果，解析出 'A' (0x41) 与 'Z' (0x5A) 两个不同字符
 * - 参数联动与重解码：在 UI 输入框（data-testid="uart-baudrate-input"）将波特率修改为 57600 并重新运行
 * - 验证参数传递：宿主按 57600 错误波特率采样，解码结果随之变为 Frame Error (FE)，确证 UI 参数真实下发至解码器引擎
 *
 * ## 判据面（分层独立，L4/L5 分别断言 'A' 与 'Z'，L6 验证参数联动）
 * 1. L1-uart-initial-clean: 协议切换至 UART，波特率默认 115200，初始表格行为 0
 * 2. L2-uart-ready-to-run: RX 通道自动配对就绪，运行解码按钮处于可用状态
 * 3. L3-uart-results-produced: 115200 波特率下端到端产出 24 帧结果
 * 4. L4-uart-char-a-verified: 结果行包含 0x41 ('A') 数据帧，确证首个字符解码正确
 * 5. L5-uart-char-z-verified: 结果行包含 0x5A ('Z') 数据帧，确证连续多帧解码正确（独立断言）
 * 6. L6-uart-baudrate-linkage-verified: UI 修改波特率至 57600 后重新解码，结果产出 Frame Error，确证 UI 参数生效
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-decoder-uart",
  title: "经 Webview 驱动 UART 协议解码，验证 8N1 双字符连续解码与波特率参数 UI 联动",
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

    // 1. 准备真实的 UART 夹具文件（tests/fixtures/lac/uart-ui-smoke.lac.json，8N1，编码 'A'=0x41 与 'Z'=0x5A）
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/uart-ui-smoke.lac.json");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const targetFileName = "ui_decoder_uart_test.lac";
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
      /* 下方统一判断 */
    }

    if (!tabInfo) {
      oracles.record("editor-opened", "fail", "未在 tabGroups 找到对应 viewType 的 custom editor tab");
      return;
    }
    oracles.record("editor-opened", "pass", `viewType=${LAC_EDITOR_VIEW_TYPE}`);

    // 3. 执行 UART 解码与参数联动动作集
    const decoderActions = [
      // 阶段 1: 切换到 UART 协议
      // 0: 等待协议下拉选择器
      { type: "waitForElement", selector: '[data-testid="decoder-protocol-select"]' },
      // 1: 切换到 UART
      { type: "input", selector: '[data-testid="decoder-protocol-select"]', value: "uart" },
      { type: "sleep", ms: 100 },
      // 3: 读波特率输入框初始默认值（期望 "115200"）
      { type: "readValue", selector: '[data-testid="uart-baudrate-input"]' },
      // 4: 验证表格行初始为 0
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      // 5: 验证运行按钮处于非禁用状态（RX 自动配对成功）
      { type: "countElements", selector: "button.decoder-panel__run:not([disabled])" },

      // 阶段 2: 触发默认波特率解码
      // 6: 点击「运行 UART 解码」按钮
      { type: "click", selector: "button.decoder-panel__run" },
      { type: "sleep", ms: 400 },
      // 8: 统计正确波特率下的结果行数（期望 24）
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      // 9: 读全量表格行文本（断言包含 0x41 与 0x5A）
      { type: "readAllTexts", selector: ".decoder-panel__table tbody tr" },

      // 阶段 3: 参数联动测试 —— 修改波特率至 57600 并重新解码
      // 10: 在 UI 输入错误波特率 57600
      { type: "input", selector: '[data-testid="uart-baudrate-input"]', value: "57600" },
      { type: "sleep", ms: 50 },
      // 12: 再次点击运行解码
      { type: "click", selector: "button.decoder-panel__run" },
      { type: "sleep", ms: 400 },
      // 14: 读错误波特率下的全量表格行文本（断言产生 Frame Error，证明参数已穿透进解码器）
      { type: "readAllTexts", selector: ".decoder-panel__table tbody tr" }
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

    // ---- 断言 1: L1-uart-initial-clean ----
    const defaultBaud = events[3]?.result;
    const initialRows = events[4]?.result;

    if (defaultBaud !== "115200") {
      oracles.record("L1-uart-initial-clean", "fail", `UART 默认波特率 "${defaultBaud}" 不等于 "115200"`);
    } else if (initialRows !== 0) {
      oracles.record("L1-uart-initial-clean", "fail", `切换后初始数据行不为 0 (count=${initialRows})`);
    } else {
      oracles.record("L1-uart-initial-clean", "pass", "UART 协议切换成功，波特率默认 115200 且初始表格干净");
    }

    // ---- 断言 2: L2-uart-ready-to-run ----
    const runBtnEnabledCount = events[5]?.result;
    if (runBtnEnabledCount !== 1) {
      oracles.record("L2-uart-ready-to-run", "fail", "运行 UART 解码按钮处于禁用状态，RX 引脚映射未自动完成");
    } else {
      oracles.record("L2-uart-ready-to-run", "pass", "RX 通道依据通道名自动配对成功，解码按钮可用");
    }

    // ---- 断言 3: L3-uart-results-produced ----
    const actualRows = events[8]?.result;
    if (actualRows !== 24) {
      oracles.record("L3-uart-results-produced", "fail", `UART 解码结果行数 ${actualRows} 不等于期望值 24`);
    } else {
      oracles.record("L3-uart-results-produced", "pass", `115200 波特率下端到端产出 24 帧结果 (rows=24)`);
    }

    // ---- 断言 4: L4-uart-char-a-verified (独立校验首个字符 'A'=0x41) ----
    const allRowsBaud115200 = events[9]?.result || [];
    const hasCharA = allRowsBaud115200.some(row => row.includes("41"));
    if (!hasCharA) {
      oracles.record("L4-uart-char-a-verified", "fail", `未在解码表格中找到字符 'A' (0x41)`);
    } else {
      oracles.record("L4-uart-char-a-verified", "pass", `成功解出字符 'A' (0x41) 数据帧`);
    }

    // ---- 断言 5: L5-uart-char-z-verified (独立校验第二个不同字符 'Z'=0x5A) ----
    const hasCharZ = allRowsBaud115200.some(row => row.includes("5A"));
    if (!hasCharZ) {
      oracles.record("L5-uart-char-z-verified", "fail", `未在解码表格中找到字符 'Z' (0x5A)`);
    } else {
      oracles.record("L5-uart-char-z-verified", "pass", `成功解出字符 'Z' (0x5A) 数据帧（多帧连续解码验证）`);
    }

    // ---- 断言 6: L6-uart-baudrate-linkage-verified (验证 UI 波特率修改生效) ----
    const allRowsBaud57600 = events[14]?.result || [];
    const hasFrameError = allRowsBaud57600.some(row => /frame\s*err/i.test(row));
    const stillHasCharA = allRowsBaud57600.some(row => row.includes("41"));

    if (!hasFrameError || stillHasCharA) {
      oracles.record(
        "L6-uart-baudrate-linkage-verified",
        "fail",
        `修改波特率为 57600 后未出现帧错误或仍解出原数据 (hasFrameError=${hasFrameError}, stillHasCharA=${stillHasCharA})`
      );
    } else {
      oracles.record(
        "L6-uart-baudrate-linkage-verified",
        "pass",
        `UI 波特率修改为 57600 真实穿透生效（出现 Frame Error 且原 0x41 消失）`
      );
    }
  }
};
