"use strict";

/**
 * 场景：**触发设置 UI（模式切换 / 条件渲染 / 反相开关 / 值域约束）**。
 *
 * ## ⚠️ 诚实定性：本场景的判据面是 DOM + Pinia store，**不是端到端**。
 *
 * 触发配置（deviceStore.captureConfig.triggerType 等）在当前已打开的 .lac 会话下
 * **不写回磁盘** —— 它属于"下次硬件采集的配置准备区"。
 * 只有用户点「开始采集」且真实采集成功后，宿主才会将触发模式与参数提交给硬件驱动并持久化。
 *
 * ⇒ 本场景证明的是「UI 交互 → store 状态 → 条件渲染与值域联动」这条链通了，
 *    不证明「配置被持久化」。后者需要真机采集，属于另一个场景。
 *
 * ## 判据面
 * 1. edge-default-state:
 *    - 默认处于 Edge 模式（.el-radio-button.is-active 为 "Edge"）
 *    - Pattern 输入框处于条件隐藏状态（值为 null）
 *    - 触发反相开关处于关闭状态（.el-switch.is-checked 为 0）
 * 2. fast-mode-reveals-pattern:
 *    - 点击 Fast 后，单选高亮变为 "Fast"
 *    - Pattern 输入框条件挂载出现（count = 1，初始值为 "0"）
 *    - 通过真实 DOM input 事件赋值 42 后，输入框 value 呈现 "42"
 * 3. trigger-inverted-toggled:
 *    - 点击触发反相开关后，.el-switch.is-checked 翻转为 1（开启态）
 * 4. blast-mode-constraints:
 *    - 点击 Blast 模式后，采样频率输入框被强锁为 "100000000" (100MHz)
 *    - Pre Samples 前采样点数被强锁为 "0"
 *    - Loop Count 输入框条件渲染出现在 DOM 中（count = 1）
 *    - 再次点击 Edge 模式后，Pattern 与 Loop Count 均平稳复位隐藏（值为 null）
 *
 * ## 变异矩阵
 * - 变异 A（测 Pattern 默认隐藏条件）：AppSidebarLeft.vue:356 将 v-if 改为 true
 *   → 仅红在 edge-default-state 的「默认态 Pattern 必须不存在」子断言上
 * - 变异 B（测 Pattern 条件挂载）：AppSidebarLeft.vue:356 将 v-if 改为 false
 *   → 仅红在 fast-mode-reveals-pattern 的「Fast 下 Pattern 必须出现」子断言上
 * - 变异 C（测反相开关绑定）：AppSidebarLeft.vue:351 switch 改为 :model-value 单向绑定
 *   → 仅红在 trigger-inverted-toggled 的「开关状态必须为 1」子断言上
 * - 变异 D（测 Blast 频率强锁逻辑）：deviceStore.ts:230 注释掉 frequency = blastFrequency
 *   → 仅红在 blast-mode-constraints 的「频率强锁 100MHz」子断言上
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-trigger-config",
  title: "通过 Webview 驱动触发模式切换、Pattern 条件显隐、触发反相与 Blast 值域锁定",
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

    const targetFileName = "ui_trigger_config_test.lac";
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

    // 3. 执行触发设置动作序列（使用精准的 formItem:"<Label>" 语义定位器）
    const triggerActions = [
      // ---- 阶段 1: Edge 默认态 ----
      // 0: 读单选选中项文本
      { type: "readText", selector: ".el-radio-button.is-active .el-radio-button__inner" },
      // 1: 读 Pattern 输入框（期望 null，条件隐藏）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },
      // 2: 统计反相开状态数量（期望 0）
      { type: "countElements", selector: 'formItem:"触发反相" .el-switch.is-checked' },

      // ---- 阶段 2: 切到 Fast 模式 ----
      // 3: 点击 Fast 单选
      { type: "click", selector: '.el-radio-group input[value="Fast"]' },
      { type: "sleep", ms: 50 },
      // 5: 验证选中态变为 Fast
      { type: "readText", selector: ".el-radio-button.is-active .el-radio-button__inner" },
      // 6: 验证 Pattern 挂载
      { type: "countElements", selector: 'formItem:"Pattern" input' },
      // 7: 读初始 Pattern 值（期望 "0"）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },
      // 8: 输入新值 42
      { type: "inputOptional", selector: 'formItem:"Pattern" input', value: "42" },
      // 9: 读更新后的值（期望 "42"）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },

      // ---- 阶段 3: 触发反相开关 ----
      // 10: 点击反相开关
      { type: "click", selector: 'formItem:"触发反相" .el-switch' },
      { type: "sleep", ms: 50 },
      // 12: 验证反相开状态变为 1
      { type: "countElements", selector: 'formItem:"触发反相" .el-switch.is-checked' },

      // ---- 阶段 4: 切到 Blast 模式 ----
      // 13: 点击 Blast 单选
      { type: "click", selector: '.el-radio-group input[value="Blast"]' },
      { type: "sleep", ms: 50 },
      // 15: 读频率（期望强锁 "100000000"）
      { type: "readValue", selector: 'formItem:"采样频率" input' },
      // 16: 读前采样（期望强锁 "0"）
      { type: "readValue", selector: 'formItem:"Pre Samples" input' },
      // 17: 读 Loop Count 输入框数量（期望 1）
      { type: "countElements", selector: 'formItem:"Loop Count" input' },

      // ---- 阶段 5: 切回 Edge 模式 ----
      // 18: 点击 Edge 单选
      { type: "click", selector: '.el-radio-group input[value="Edge"]' },
      { type: "sleep", ms: 150 }, // 留足 150ms 充分过渡卸载
      // 20: 验证 Pattern 卸载（期望 null）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },
      // 21: 验证 Loop Count 卸载（期望 null）
      { type: "readValueOptional", selector: 'formItem:"Loop Count" input' }
    ];

    let result = null;
    try {
      result = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          triggerActions,
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

    // ---- 断言 1: edge-default-state ----
    const defaultMode = events[0]?.result;
    const defaultPatternVal = events[1]?.result;
    const defaultInvertedCount = events[2]?.result;

    if (defaultMode !== "Edge") {
      oracles.record("edge-default-state", "fail", `默认模式为 "${defaultMode}"，期望为 "Edge"`);
    } else if (defaultPatternVal !== null) {
      oracles.record("edge-default-state", "fail", `默认态 Pattern 输入框不应存在，实际值为 "${defaultPatternVal}"`);
    } else if (defaultInvertedCount !== 0) {
      oracles.record("edge-default-state", "fail", `默认态触发反相处于开启状态 (count=${defaultInvertedCount})`);
    } else {
      oracles.record("edge-default-state", "pass", "Edge 默认态正常（模式=Edge, Pattern=隐藏, 反相=关）");
    }

    // ---- 断言 2: fast-mode-reveals-pattern ----
    const fastMode = events[5]?.result;
    const patternCount = events[6]?.result;
    const patternInitVal = events[7]?.result;
    const patternUpdatedVal = events[9]?.result;

    if (fastMode !== "Fast") {
      oracles.record("fast-mode-reveals-pattern", "fail", `切换后单选高亮为 "${fastMode}"，期望为 "Fast"`);
    } else if (patternCount !== 1) {
      oracles.record("fast-mode-reveals-pattern", "fail", `切换为 Fast 后 Pattern 元素未挂载 (count=${patternCount})`);
    } else if (patternInitVal !== "0") {
      oracles.record("fast-mode-reveals-pattern", "fail", `Pattern 初始值 "${patternInitVal}" 不等于 "0"`);
    } else if (patternUpdatedVal !== "42") {
      oracles.record("fast-mode-reveals-pattern", "fail", `Pattern 输入 42 后值 "${patternUpdatedVal}" 不等于 "42"`);
    } else {
      oracles.record("fast-mode-reveals-pattern", "pass", "Fast 模式正常挂载 Pattern 并接受输入 42");
    }

    // ---- 断言 3: trigger-inverted-toggled ----
    const toggledInvertedCount = events[12]?.result;
    if (toggledInvertedCount !== 1) {
      oracles.record("trigger-inverted-toggled", "fail", `点击触发反相后开关未开启 (count=${toggledInvertedCount})`);
    } else {
      oracles.record("trigger-inverted-toggled", "pass", "触发反相成功开启 (.is-checked=1)");
    }

    // ---- 断言 4: blast-mode-constraints ----
    const blastFreqVal = events[15]?.result;
    const blastPreSamplesVal = events[16]?.result;
    const blastLoopCount = events[17]?.result;
    const resetPatternVal = events[20]?.result;
    const resetLoopCountVal = events[21]?.result;

    if (blastFreqVal !== "100000000") {
      oracles.record("blast-mode-constraints", "fail", `Blast 模式采样频率 "${blastFreqVal}" 未强锁为 "100000000"`);
    } else if (blastPreSamplesVal !== "0") {
      oracles.record("blast-mode-constraints", "fail", `Blast 模式 Pre Samples "${blastPreSamplesVal}" 未强锁为 "0"`);
    } else if (blastLoopCount !== 1) {
      oracles.record("blast-mode-constraints", "fail", `Blast 模式 Loop Count 未挂载 (count=${blastLoopCount})`);
    } else if (resetPatternVal !== null) {
      oracles.record("blast-mode-constraints", "fail", `切回 Edge 模式后 Pattern 未复位隐藏 (val=${resetPatternVal})`);
    } else if (resetLoopCountVal !== null) {
      oracles.record("blast-mode-constraints", "fail", `切回 Edge 模式后 Loop Count 未复位隐藏 (val=${resetLoopCountVal})`);
    } else {
      oracles.record(
        "blast-mode-constraints",
        "pass",
        "Blast 模式值域强锁 (100MHz, Pre=0, LoopCount挂载) 且切回 Edge 正常复位隐藏"
      );
    }
  }
};
