"use strict";

/**
 * 场景：**SPI 协议解码 UI（多通道自动映射 / 协议切换 / 双向数据与片选语义校验）**。
 *
 * ## 真实端到端闭环链路说明
 * - Webview 前端：切换协议到 SPI，自动配对 CLK/MISO/MOSI/CS 通道
 * - 点击运行解码：@click="runDecoder" 发出 host.sendCommand('runDecoder', { decoderId: 'spi', ... })
 * - VS Code 宿主：LACEditorProvider 接收并由 SPIDecoder 执行全双工 Mode 0 算法解码
 * - 宿主回发结果：返回包含 CS asserted、MOSI 字节 0x3C、MISO 字节 0xA5 的完整协议帧
 * - Webview 响应式呈现：表格渲染 23 行结果，各数据列呈现独立方向的数据
 *
 * ## 判据面（分层独立，L4/L5 分别断言 MOSI 与 MISO，杜绝"或"逻辑）
 * 1. L1-spi-initial-clean: 协议切换至 SPI，解码前数据行为 0
 * 2. L2-spi-ready-to-run: CLK/MISO/MOSI/CS 四通道自动配对就绪，运行解码按钮处于可用状态
 * 3. L3-spi-results-produced: 解码计算完成，结果行数等于 23，汇总卡片结果数显示一致
 * 4. L4-spi-mosi-data-verified: 解码行中确凿包含 MOSI 数据帧 "3C"，证明主机发送数据解析无误
 * 5. L5-spi-miso-data-verified: 解码行中确凿包含 MISO 数据帧 "A5"，证明从机应答数据解析无误
 * 6. L6-spi-cs-asserted-verified: 解码行中确凿包含片选断言 "CS asserted"，证明模式状态机完备
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-decoder-spi",
  title: "经 Webview 驱动 SPI 协议端到端解码，验证 4 通道自动配对、全双工 MOSI/MISO 数据与 CS 状态",
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

    // 1. 准备真实的 SPI 夹具文件（tests/fixtures/lac/spi-ui-smoke.lac.json，Mode 0，MOSI=0x3C，MISO=0xA5）
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/spi-ui-smoke.lac.json");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const targetFileName = "ui_decoder_spi_test.lac";
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

    // 3. 执行 SPI 解码动作集
    const decoderActions = [
      // 阶段 1: 切换到 SPI 协议
      // 0: 等待协议下拉选择器
      { type: "waitForElement", selector: '[data-testid="decoder-protocol-select"]' },
      // 1: 切换到 SPI
      { type: "input", selector: '[data-testid="decoder-protocol-select"]', value: "spi" },
      { type: "sleep", ms: 100 },
      // 3: 验证表格行初始为 0
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      // 4: 读汇总卡片结果数（初始为 "0"）
      { type: "readText", selector: ".app-sidebar-right__summary .app-sidebar-right__row:nth-child(1) dd" },
      // 5: 验证运行按钮处于非禁用状态（CLK/MISO/MOSI/CS 自动配对成功）
      { type: "countElements", selector: "button.decoder-panel__run:not([disabled])" },

      // 阶段 2: 触发真实端到端解码
      // 6: 点击「运行 SPI 解码」按钮
      { type: "click", selector: "button.decoder-panel__run" },
      // 7: 留出 400ms 等待宿主 CPU 解码计算与 Vue 响应式表格渲染完成
      { type: "sleep", ms: 400 },

      // 阶段 3: 收集解码产出与全量行文本
      // 8: 统计结果行数（期望 23）
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      // 9: 读汇总卡片结果数（期望 "23"）
      { type: "readText", selector: ".app-sidebar-right__summary .app-sidebar-right__row:nth-child(1) dd" },
      // 10: 获取所有表格行文本（用于多维度语义内容深度断言）
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

    // ---- 断言 1: L1-spi-initial-clean ----
    const initialRows = events[3]?.result;
    const initialSummary = events[4]?.result;

    if (initialRows !== 0) {
      oracles.record("L1-spi-initial-clean", "fail", `切换后初始数据行不为 0 (count=${initialRows})`);
    } else if (initialSummary !== "0") {
      oracles.record("L1-spi-initial-clean", "fail", `初始汇总结果数 "${initialSummary}" 不等于 "0"`);
    } else {
      oracles.record("L1-spi-initial-clean", "pass", "SPI 协议切换成功且初始表格干净 (rows=0, summary=0)");
    }

    // ---- 断言 2: L2-spi-ready-to-run ----
    const runBtnEnabledCount = events[5]?.result;
    if (runBtnEnabledCount !== 1) {
      oracles.record("L2-spi-ready-to-run", "fail", "运行 SPI 解码按钮处于禁用状态，4 通道引脚映射未自动完成");
    } else {
      oracles.record("L2-spi-ready-to-run", "pass", "CLK/MISO/MOSI/CS 依据通道名自动配对成功，解码按钮可用");
    }

    // ---- 断言 3: L3-spi-results-produced ----
    const actualRows = events[8]?.result;
    const actualSummary = events[9]?.result;

    if (actualRows !== 23) {
      oracles.record("L3-spi-results-produced", "fail", `SPI 解码结果行数 ${actualRows} 不等于期望值 23`);
    } else if (actualSummary !== "23") {
      oracles.record("L3-spi-results-produced", "fail", `汇总结果数 "${actualSummary}" 不等于期望值 "23"`);
    } else {
      oracles.record("L3-spi-results-produced", "pass", `SPI 端到端解码产出 23 帧结果 (rows=23, summary=23)`);
    }

    // ---- 断言 4: L4-spi-mosi-data-verified (独立校验 MOSI 数据帧) ----
    const allRows = events[10]?.result || [];
    const hasMosiData = allRows.some(row => row.includes("3C"));
    if (!hasMosiData) {
      oracles.record("L4-spi-mosi-data-verified", "fail", `未在解码表格中找到 MOSI 数据 0x3C`);
    } else {
      oracles.record("L4-spi-mosi-data-verified", "pass", `成功解出 MOSI 数据 0x3C (主机发送字节精准还原)`);
    }

    // ---- 断言 5: L5-spi-miso-data-verified (独立校验 MISO 数据帧，绝非或逻辑) ----
    const hasMisoData = allRows.some(row => row.includes("A5"));
    if (!hasMisoData) {
      oracles.record("L5-spi-miso-data-verified", "fail", `未在解码表格中找到 MISO 数据 0xA5`);
    } else {
      oracles.record("L5-spi-miso-data-verified", "pass", `成功解出 MISO 数据 0xA5 (从机全双工回传字节精准还原)`);
    }

    // ---- 断言 6: L6-spi-cs-asserted-verified (校验 CS 片选断言状态) ----
    const hasCsAsserted = allRows.some(row => /cs\s*asserted/i.test(row));
    if (!hasCsAsserted) {
      oracles.record("L6-spi-cs-asserted-verified", "fail", `未在解码表格中找到 CS 片选有效断言`);
    } else {
      oracles.record("L6-spi-cs-asserted-verified", "pass", `成功识别 CS asserted 片选有效状态`);
    }
  }
};
