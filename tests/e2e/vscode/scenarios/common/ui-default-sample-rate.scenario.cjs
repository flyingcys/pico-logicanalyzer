"use strict";

/**
 * 场景：**Webview 首次采集表单应消费宿主注入的 defaultSampleRate 配置**。
 *
 * ## 真实端到端链路（全部走产品代码，测试侧只准备输入 + 观察输出）
 * VS Code 工作区配置 `logicAnalyzer.defaultSampleRate` 设为 16000000（非默认值）
 * → 打开 Custom Editor，产品把配置写进 webview bootstrap 与 getStatus 应答
 * → 前端 AppSidebarLeft.onMounted 调产品 refreshStatus()
 * → 产品 deviceStore.applyStatus 在无 lastCaptureConfig 时用它初始化 captureConfig.frequency
 * → 侧栏「采样频率」输入框真实呈现 16000000。
 *
 * ## 判据
 * - `sidebar-frequency-bound`：真实 Webview DOM 的采样频率输入框等于配置值（用户可见层）
 * - `sidebar-frequency-not-hardcoded`：配置换成另一个非默认值 8000000 后，
 *   重新开一个面板读到的也是 8000000（抓「写死 / 缓存第一次」）
 *
 * ## 已知边界（诚实登记，不绕产品）
 * 「首次 startCapture payload.config.frequency」需要设备处于已连接态；真宿主无
 * 物理设备时产品把采集按钮设为 disabled，测试侧不替产品伪造连接状态。
 * 该段由 `tests/unit/frontend/main.test.ts` 的 deviceCaptureCommands 单测用
 * 真实 store + 真实 composable 锁住；宿主 status 契约由
 * `LACEditorProvider.coverage.test.ts` 锁住。
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";
const RATE_A = 16000000;
const RATE_B = 8000000;
const SELECTOR = 'formItem:"采样频率" input';

module.exports = {
  id: "ui-default-sample-rate",
  title: "验证 Webview 首次采集表单消费 defaultSampleRate 配置（双非默认值对照）",
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

    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/current-lowercase-samples.lac");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const configuration = vscode.workspace.getConfiguration("logicAnalyzer");

    /** 设配置 → 打开独立面板 → 等 onMounted 的异步 refreshStatus → 读输入框。 */
    async function openAndReadFrequency(rate, fileName) {
      await configuration.update("defaultSampleRate", rate, vscode.ConfigurationTarget.Workspace);

      const targetFilePath = join(workspaceDir, fileName);
      copyFileSync(fixtureSource, targetFilePath);
      const fileUri = vscode.Uri.file(targetFilePath);

      await withTimeout(
        vscode.commands.executeCommand("vscode.open", fileUri),
        30000,
        "vscode.open"
      );

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
                String(input.uri.fsPath).endsWith(fileName) &&
                input.viewType === LAC_EDITOR_VIEW_TYPE
              );
            });
            return Boolean(tabInfo);
          },
          15000,
          `tabGroups 出现 ${fileName} 面板`
        );
      } catch {
        /* 下方统一判 */
      }
      if (!tabInfo) {
        return { error: `未在 tabGroups 找到 ${fileName} 的 custom editor tab` };
      }

      // 只驱动真实 Webview DOM：等待侧栏挂载，留出 refreshStatus 的 host 往返，
      // 再读产品渲染出来的 input.value（不注入任何状态、不替产品选值）。
      const actions = [
        { type: "waitForElement", selector: SELECTOR, timeoutMs: 10000 },
        { type: "sleep", ms: 800 },
        { type: "readValue", selector: SELECTOR }
      ];
      const result = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          actions,
          { viewType: LAC_EDITOR_VIEW_TYPE, uri: fileUri.toString() }
        ),
        30000,
        `__runEditorScenario@${fileName}`
      );
      if (!result || !result.ok) {
        return { error: `Webview 回包失败: ${result?.error || "unknown"}` };
      }
      return { value: result.events?.[2]?.result };
    }

    let runA = null;
    let runB = null;
    let scenarioError = null;
    try {
      runA = await openAndReadFrequency(RATE_A, "ui_default_sample_rate_a.lac");
      runB = await openAndReadFrequency(RATE_B, "ui_default_sample_rate_b.lac");
    } catch (error) {
      scenarioError = String(error && error.message ? error.message : error);
    }

    if (scenarioError || runA?.error || runB?.error) {
      oracles.record(
        "scenario-executes",
        "fail",
        scenarioError || runA?.error || runB?.error
      );
      return;
    }
    oracles.record("scenario-executes", "pass", "两次独立 Custom Editor 面板均成功驱动并回读采样频率");
    oracles.record("fixture-ready", "pass", "current-lowercase-samples.lac（两个独立副本）");
    oracles.record("editor-opened", "pass", `viewType=${LAC_EDITOR_VIEW_TYPE}（两个面板）`);

    const assertRate = (id, run, expected, label) => {
      if (String(run.value) !== String(expected)) {
        oracles.record(
          id,
          "fail",
          `${label}：采样频率输入框为 "${run.value}"，期望 "${expected}" —— defaultSampleRate 未穿透到 Webview 表单，或存在写死/缓存`
        );
      } else {
        oracles.record(id, "pass", `${label}：Webview 侧栏表单真实呈现 ${expected} Hz`);
      }
    };

    assertRate("sidebar-frequency-bound", runA, RATE_A, `配置=${RATE_A}（非默认值 A）`);
    assertRate("sidebar-frequency-not-hardcoded", runB, RATE_B, `配置=${RATE_B}（非默认值 B）`);
  },
};
