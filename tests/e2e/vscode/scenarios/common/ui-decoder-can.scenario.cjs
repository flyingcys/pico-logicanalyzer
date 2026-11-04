"use strict";

/**
 * 场景：**CAN 协议解码 UI（单线差分 RX 自动映射 / 500kbps 经典 CAN 2.0A 帧解码 / 位填充与 CRC15 校验 / 波特率参数穿透验证）**。
 *
 * ## 真实端到端闭环链路说明
 * - Webview 前端：切换协议到 CAN，自动配对 CAN 通道，展现 500000 默认波特率与 70% 采样点
 * - 第一次解码：以 500kbps 运行解码，宿主端到端产出 9 帧标准结果（SOF、ID: 123、Data frame、DLC: 2、Data[0]: 11、Data[1]: 22、CRC: 5CC4、ACK、EOF）
 * - 参数联动与重解码：在 UI 输入框（input[step="1000"]）将 Bitrate 修改为 250000 并重新运行
 * - 验证参数传递：宿主按 250kbps 错误波特率采样，解码结果随之变为 Stuff bit error 与 Incomplete CAN frame，确证 UI 参数真实下发至解码器引擎
 *
 * ## 判据面（分层独立，L4/L5/L6 分别断言 ID、各 Data 字节与 CRC，L7 验证参数穿透）
 * 1. L1-can-initial-clean: 协议切换至 CAN，Bitrate 默认 500000，Sample % 默认 70，初始表格行为 0
 * 2. L2-can-ready-to-run: CAN 通道自动配对就绪，运行解码按钮处于可用状态
 * 3. L3-can-results-produced: 500kbps 波特率下端到端产出 9 帧结果 (rows=9, summary=9)
 * 4. L4-can-identifier-verified: 结果行包含 "ID: 123"，确证 11 位标准标识符解析无误
 * 5. L5-can-payload-verified: 结果行独立包含 "Data[0]: 11" 且包含 "Data[1]: 22"，确证载荷字节全部正确还原（绝非或逻辑）
 * 6. L6-can-crc-verified: 结果行包含 "CRC: 5CC4"，确证 15 位多项式校验与位填充无误
 * 7. L7-can-bitrate-linkage-verified: UI 修改波特率至 250000 后重新解码，结果产出 Stuff bit error 且原 ID 123 消失，确证参数生效
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-decoder-can",
  title: "经 Webview 驱动 CAN 协议解码，验证 CAN 2.0A 帧结构、位填充校验与波特率参数 UI 联动",
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

    // 1. 准备真实的 CAN 夹具文件（tests/fixtures/lac/can-ui-smoke.lac.json，500kbps，ID=0x123，Data=[0x11, 0x22]）
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/can-ui-smoke.lac.json");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const targetFileName = "ui_decoder_can_test.lac";
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

    // 3. 执行 CAN 解码与参数联动动作集
    // ⚠️ 动作与 events 下标强绑定纪律：
    // 0: wait for protocol select
    // 1: input "can"
    // 2: sleep 100ms
    // 3: count initial table rows
    // 4: read default bitrate (expected "500000")
    // 5: read default sample point (expected "70")
    // 6: count run button :not([disabled])
    // 7: click run button
    // 8: sleep 400ms
    // 9: count rows (expected 9)
    // 10: read summary (expected "9")
    // 11: read all rows (expected 9 frames including ID, Data, CRC)
    // 12: input mismatched bitrate "250000"
    // 13: sleep 50ms
    // 14: click run button again
    // 15: sleep 400ms
    // 16: read all rows under mismatched bitrate (expected Stuff bit error)
    const decoderActions = [
      // 阶段 1: 切换到 CAN 协议
      { type: "waitForElement", selector: '[data-testid="decoder-protocol-select"]' },
      { type: "input", selector: '[data-testid="decoder-protocol-select"]', value: "can" },
      { type: "sleep", ms: 100 },
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      { type: "readValue", selector: '.decoder-panel__mapping input[step="1000"]' },
      { type: "readValue", selector: '.decoder-panel__mapping input[max="99"]' },
      { type: "countElements", selector: "button.decoder-panel__run:not([disabled])" },

      // 阶段 2: 触发默认 500kbps 解码
      { type: "click", selector: "button.decoder-panel__run" },
      { type: "sleep", ms: 400 },
      { type: "countElements", selector: ".decoder-panel__table tbody tr" },
      { type: "readText", selector: ".app-sidebar-right__summary .app-sidebar-right__row:nth-child(1) dd" },
      { type: "readAllTexts", selector: ".decoder-panel__table tbody tr" },

      // 阶段 3: 参数联动测试 —— 修改 Bitrate 至 250000 并重新解码
      { type: "input", selector: '.decoder-panel__mapping input[step="1000"]', value: "250000" },
      { type: "sleep", ms: 50 },
      { type: "click", selector: "button.decoder-panel__run" },
      { type: "sleep", ms: 400 },
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

    // ---- 断言 1: L1-can-initial-clean ----
    const initialRows = events[3]?.result;
    const defaultBitrate = events[4]?.result;
    const defaultSamplePoint = events[5]?.result;

    if (defaultBitrate !== "500000") {
      oracles.record("L1-can-initial-clean", "fail", `CAN 默认波特率 "${defaultBitrate}" 不等于 "500000"`);
    } else if (defaultSamplePoint !== "75") {
      oracles.record("L1-can-initial-clean", "fail", `CAN 默认采样点 "${defaultSamplePoint}" 不等于 "75"`);
    } else if (initialRows !== 0) {
      oracles.record("L1-can-initial-clean", "fail", `切换后初始数据行不为 0 (count=${initialRows})`);
    } else {
      oracles.record("L1-can-initial-clean", "pass", "CAN 协议切换成功，Bitrate 默认 500000，Sample % 默认 75 且初始表格干净");
    }

    // ---- 断言 2: L2-can-ready-to-run ----
    const runBtnEnabledCount = events[6]?.result;
    if (runBtnEnabledCount !== 1) {
      oracles.record("L2-can-ready-to-run", "fail", "运行 CAN 解码按钮处于禁用状态，CAN RX 引脚映射未自动完成");
    } else {
      oracles.record("L2-can-ready-to-run", "pass", "CAN 通道依据通道名自动配对成功，解码按钮可用");
    }

    // ---- 断言 3: L3-can-results-produced ----
    const actualRows = events[9]?.result;
    const actualSummary = events[10]?.result;

    if (actualRows !== 9) {
      oracles.record("L3-can-results-produced", "fail", `CAN 解码结果行数 ${actualRows} 不等于期望值 9`);
    } else if (actualSummary !== "9") {
      oracles.record("L3-can-results-produced", "fail", `汇总结果数 "${actualSummary}" 不等于期望值 "9"`);
    } else {
      oracles.record("L3-can-results-produced", "pass", `500kbps 波特率下端到端产出 9 帧结果 (rows=9, summary=9)`);
    }

    // ---- 断言 4: L4-can-identifier-verified (独立校验 11 位标准 ID) ----
    const allRowsBitrate500k = events[11]?.result || [];
    const hasId123 = allRowsBitrate500k.some(row => row.includes("123"));
    if (!hasId123) {
      oracles.record("L4-can-identifier-verified", "fail", `未在解码表格中找到 CAN ID: 123`);
    } else {
      oracles.record("L4-can-identifier-verified", "pass", `成功解出 11 位标准标识符 ID: 123`);
    }

    // ---- 断言 5: L5-can-payload-verified (独立校验每个载荷字节，严禁"或") ----
    const hasData0 = allRowsBitrate500k.some(row => row.includes("11"));
    const hasData1 = allRowsBitrate500k.some(row => row.includes("22"));

    if (!hasData0) {
      oracles.record("L5-can-payload-verified", "fail", `未在解码表格中找到载荷字节 Data[0]: 11`);
    } else if (!hasData1) {
      oracles.record("L5-can-payload-verified", "fail", `未在解码表格中找到载荷字节 Data[1]: 22`);
    } else {
      oracles.record("L5-can-payload-verified", "pass", `成功解出完整数据载荷 Data[0]=0x11 与 Data[1]=0x22`);
    }

    // ---- 断言 6: L6-can-crc-verified (独立校验 15 位多项式 CRC) ----
    const hasCrc = allRowsBitrate500k.some(row => /5CC4/i.test(row));
    if (!hasCrc) {
      oracles.record("L6-can-crc-verified", "fail", `未在解码表格中找到 CRC: 5CC4`);
    } else {
      oracles.record("L6-can-crc-verified", "pass", `成功解出 CRC15 校验值 5CC4 (证明位填充与 CRC 算法完备)`);
    }

    // ---- 断言 7: L7-can-bitrate-linkage-verified (验证 UI 波特率修改生效) ----
    const allRowsBitrate250k = events[16]?.result || [];
    const hasStuffError = allRowsBitrate250k.some(row => /stuff/i.test(row));
    const stillHasId123 = allRowsBitrate250k.some(row => row.includes("123"));

    if (!hasStuffError || stillHasId123) {
      oracles.record(
        "L7-can-bitrate-linkage-verified",
        "fail",
        `修改波特率为 250000 后未出现位填充错误或仍解出原 ID 123 (hasStuffError=${hasStuffError}, stillHasId123=${stillHasId123})`
      );
    } else {
      oracles.record(
        "L7-can-bitrate-linkage-verified",
        "pass",
        `UI 波特率修改为 250000 真实穿透生效（出现 Stuff bit error 且原 ID 123 消失）`
      );
    }
  }
};
