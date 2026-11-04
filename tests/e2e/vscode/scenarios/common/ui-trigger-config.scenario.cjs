"use strict";

/**
 * 场景：**触发设置与采集参数 UI（模式切换 / 条件渲染 / 表单双向绑定 / 反相开关 / 值域约束）**。
 *
 * ## ⚠️ 诚实定性：本场景验证的是 Webview DOM 交互、表单双向绑定与模式状态机联动。
 * 受无物理硬件连接约束（未连接设备时采集按钮处于禁用态），本场景**不验证硬件二进制控制帧**。
 * 硬件二进制帧（CAPTURE_REQUEST 48 字节）的组包与解析由 `network-capture-mock` 场景及协议单测覆盖；
 * 跨进程数据流在无真机环境下的单例隔离断点详见 `docs/test-coverage-gaps-2026-11-03.md` §五。
 *
 * ## 判据面（共 7 条独立 oracle）
 * 1. edge-default-state:
 *    - 默认处于 Edge 模式（.el-radio-button.is-active 为 "Edge"）
 *    - Pattern 输入框处于条件隐藏状态（值为 null）
 *    - 触发反相开关处于关闭状态（.el-switch.is-checked 为 0）
 * 2. post-samples-interactive:
 *    - 默认值为 "1000"
 *    - 输入新值 2048 后，DOM input 呈现 "2048"，证明双向响应式绑定正常
 * 3. trigger-channel-mapped:
 *    - 触发通道下拉框正确映射当前通道列表，默认选中项为 "Channel 1"
 * 4. fast-mode-reveals-pattern:
 *    - 点击 Fast 后，单选高亮变为 "Fast"
 *    - Pattern 输入框条件挂载出现（count = 1，初始值为 "0"）
 *    - 通过真实 DOM input 事件赋值 42 后，输入框 value 呈现 "42"
 * 5. trigger-inverted-toggled:
 *    - 点击触发反相开关后，.el-switch.is-checked 翻转为 1（开启态）
 * 6. blast-mode-constraints:
 *    - 点击 Blast 模式后，采样频率输入框被强锁为 "100000000" (100MHz)
 *    - Pre Samples 前采样点数被强锁为 "0"
 *    - Loop Count 输入框条件渲染出现在 DOM 中（count = 1）
 *    - 再次点击 Edge 模式后，Pattern 与 Loop Count 均平稳复位隐藏（值为 null）
 * 7. burst-measurement-lifecycle:
 *    - Edge 模式下处于条件隐藏（count = 0，不可提前泄露）
 *    - Blast 模式下动态挂载（count = 1），且重置守卫默认置为关闭态（is-checked = 0）
 *    - 点击开关后成功翻转为开启态（is-checked = 1）
 *    - 切回 Edge 模式后组件被彻底从 DOM 销毁卸载（count = 0）
 *
 * ## 变异矩阵
 * - 变异 A（测 Pattern 默认隐藏条件）：AppSidebarLeft.vue 将 v-if 改为 true → edge-default-state 红
 * - 变异 B（测 Pattern 条件挂载）：AppSidebarLeft.vue 将 v-if 改为 false → fast-mode-reveals-pattern 红
 * - 变异 C（测反相开关绑定）：AppSidebarLeft.vue switch 改为 :model-value 单向绑定 → trigger-inverted-toggled 红
 * - 变异 D（测 Blast 频率强锁逻辑）：deviceStore.ts 注释掉 frequency = blastFrequency → blast-mode-constraints 红
 * - 变异 E（测 Post Samples 绑定）：AppSidebarLeft.vue:316 改绑到 preTriggerSamples → post-samples-interactive 红
 * - 变异 F（测 触发通道 绑定）：AppSidebarLeft.vue:341 移除 v-model → trigger-channel-mapped 红
 * - 变异 G（测 Burst 测量 开关绑定）：AppSidebarLeft.vue:393 改绑为 :model-value="false" → burst-measurement-lifecycle 红
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-trigger-config",
  title: "通过 Webview 驱动触发模式、采样参数、通道选择、反相开关与 Burst 生命周期",
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

    // 3. 执行触发与采集参数设置动作序列（使用精准的 formItem:"<Label>" 语义定位器）
    const triggerActions = [
      // ---- 阶段 1: Edge 默认态 ----
      // 0: 读单选选中项文本
      { type: "readText", selector: ".el-radio-button.is-active .el-radio-button__inner" },
      // 1: 读 Pattern 输入框（期望 null，条件隐藏）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },
      // 2: 统计反相开状态数量（期望 0）
      { type: "countElements", selector: 'formItem:"触发反相" .el-switch.is-checked' },
      // 3: 读 Post Samples 默认值（期望 "1000"）
      { type: "readValue", selector: 'formItem:"Post Samples" input' },
      // 4: 输入 Post Samples 新值 2048
      { type: "input", selector: 'formItem:"Post Samples" input', value: "2048" },
      // 5: 读 Post Samples 变更后的值（期望 "2048"）
      { type: "readValue", selector: 'formItem:"Post Samples" input' },
      // 6: 读触发通道下拉框当前文本（期望 "Channel 1"）
      { type: "readText", selector: 'formItem:"触发通道" .el-select' },
      // 7: 检查 Edge 模式下 Burst 测量开关（期望 0，未挂载）
      { type: "countElements", selector: 'formItem:"Burst 测量" .el-switch' },

      // ---- 阶段 2: 切到 Fast 模式 ----
      // 8: 点击 Fast 单选
      { type: "click", selector: '.el-radio-group input[value="Fast"]' },
      { type: "sleep", ms: 50 },
      // 10: 验证选中态变为 Fast
      { type: "readText", selector: ".el-radio-button.is-active .el-radio-button__inner" },
      // 11: 验证 Pattern 挂载
      { type: "countElements", selector: 'formItem:"Pattern" input' },
      // 12: 读初始 Pattern 值（期望 "0"）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },
      // 13: 输入新值 42
      { type: "inputOptional", selector: 'formItem:"Pattern" input', value: "42" },
      // 14: 读更新后的值（期望 "42"）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },

      // ---- 阶段 3: 触发反相开关 ----
      // 15: 点击反相开关
      { type: "click", selector: 'formItem:"触发反相" .el-switch' },
      { type: "sleep", ms: 50 },
      // 17: 验证反相开状态变为 1
      { type: "countElements", selector: 'formItem:"触发反相" .el-switch.is-checked' },

      // ---- 阶段 4: 切到 Blast 模式 ----
      // 18: 点击 Blast 单选
      { type: "click", selector: '.el-radio-group input[value="Blast"]' },
      { type: "sleep", ms: 50 },
      // 20: 读频率（期望强锁 "100000000"）
      { type: "readValue", selector: 'formItem:"采样频率" input' },
      // 21: 读前采样（期望强锁 "0"）
      { type: "readValue", selector: 'formItem:"Pre Samples" input' },
      // 22: 读 Loop Count 输入框数量（期望 1）
      { type: "countElements", selector: 'formItem:"Loop Count" input' },
      // 23: 读 Burst 测量开关挂载数量（期望 1）
      { type: "countElements", selector: 'formItem:"Burst 测量" .el-switch' },
      // 24: 读 Burst 测量初始开状态数量（期望 0，默认关）
      { type: "countElements", selector: 'formItem:"Burst 测量" .el-switch.is-checked' },
      // 25: 点击 Burst 测量开关
      { type: "click", selector: 'formItem:"Burst 测量" .el-switch' },
      { type: "sleep", ms: 50 },
      // 27: 读 Burst 测量开启后状态数量（期望 1）
      { type: "countElements", selector: 'formItem:"Burst 测量" .el-switch.is-checked' },

      // ---- 阶段 5: 切回 Edge 模式 ----
      // 28: 点击 Edge 单选
      { type: "click", selector: '.el-radio-group input[value="Edge"]' },
      { type: "sleep", ms: 150 }, // 留足 150ms 充分过渡卸载
      // 30: 验证 Pattern 卸载（期望 null）
      { type: "readValueOptional", selector: 'formItem:"Pattern" input' },
      // 31: 验证 Loop Count 卸载（期望 null）
      { type: "readValueOptional", selector: 'formItem:"Loop Count" input' },
      // 32: 验证 Burst 测量卸载（期望 0）
      { type: "countElements", selector: 'formItem:"Burst 测量" .el-switch' }
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

    // ---- 断言 2: post-samples-interactive ----
    const defaultPostVal = events[3]?.result;
    const updatedPostVal = events[5]?.result;

    if (defaultPostVal !== "1000") {
      oracles.record("post-samples-interactive", "fail", `Post Samples 初始值 "${defaultPostVal}" 不等于 "1000"`);
    } else if (updatedPostVal !== "2048") {
      oracles.record("post-samples-interactive", "fail", `Post Samples 输入 2048 后值 "${updatedPostVal}" 不等于 "2048"`);
    } else {
      oracles.record("post-samples-interactive", "pass", "Post Samples 默认 1000 且支持输入修改为 2048 (双向绑定正常)");
    }

    // ---- 断言 3: trigger-channel-mapped ----
    const defaultChannelText = events[6]?.result;
    if (defaultChannelText !== "Channel 1") {
      oracles.record("trigger-channel-mapped", "fail", `触发通道默认文本为 "${defaultChannelText}"，期望为 "Channel 1"`);
    } else {
      oracles.record("trigger-channel-mapped", "pass", "触发通道下拉框正确映射当前通道列表（默认 Channel 1）");
    }

    // ---- 断言 4: fast-mode-reveals-pattern ----
    const fastMode = events[10]?.result;
    const patternCount = events[11]?.result;
    const patternInitVal = events[12]?.result;
    const patternUpdatedVal = events[14]?.result;

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

    // ---- 断言 5: trigger-inverted-toggled ----
    const toggledInvertedCount = events[17]?.result;
    if (toggledInvertedCount !== 1) {
      oracles.record("trigger-inverted-toggled", "fail", `点击触发反相后开关未开启 (count=${toggledInvertedCount})`);
    } else {
      oracles.record("trigger-inverted-toggled", "pass", "触发反相成功开启 (.is-checked=1)");
    }

    // ---- 断言 6: blast-mode-constraints ----
    const blastFreqVal = events[20]?.result;
    const blastPreSamplesVal = events[21]?.result;
    const blastLoopCount = events[22]?.result;
    const resetPatternVal = events[30]?.result;
    const resetLoopCountVal = events[31]?.result;

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

    // ---- 断言 7: burst-measurement-lifecycle ----
    const edgeBurstCount = events[7]?.result;
    const blastBurstCount = events[23]?.result;
    const blastInitBurstChecked = events[24]?.result;
    const blastClickedBurstChecked = events[27]?.result;
    const resetBurstCount = events[32]?.result;

    if (edgeBurstCount !== 0) {
      oracles.record("burst-measurement-lifecycle", "fail", `Edge 模式下 Burst 测量开关不应挂载 (count=${edgeBurstCount})`);
    } else if (blastBurstCount !== 1) {
      oracles.record("burst-measurement-lifecycle", "fail", `Blast 模式下 Burst 测量开关未挂载 (count=${blastBurstCount})`);
    } else if (blastInitBurstChecked !== 0) {
      oracles.record("burst-measurement-lifecycle", "fail", `Blast 模式下 Burst 测量开关默认应处于关闭状态 (is-checked=${blastInitBurstChecked})`);
    } else if (blastClickedBurstChecked !== 1) {
      oracles.record("burst-measurement-lifecycle", "fail", `点击 Burst 测量后开关未开启 (is-checked=${blastClickedBurstChecked})`);
    } else if (resetBurstCount !== 0) {
      oracles.record("burst-measurement-lifecycle", "fail", `切回 Edge 模式后 Burst 测量未卸载销毁 (count=${resetBurstCount})`);
    } else {
      oracles.record(
        "burst-measurement-lifecycle",
        "pass",
        "Burst 测量生命周期守卫完整（Edge 隐藏，Blast 挂载且默认关，点击开，切回销毁）"
      );
    }
  }
};

