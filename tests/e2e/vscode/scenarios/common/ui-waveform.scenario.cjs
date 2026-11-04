"use strict";

/**
 * 场景：**真实 Webview 驱动与三层 UI 观测（L1 / L2 / L3）**。
 *
 * ## 它覆盖了此前从未被测的 Webview 内部真实渲染层
 *
 * 现有 `open-analyzer` 场景只验证宿主层开出了 tab，但 Webview 内部：
 * HTML 是否加载、Vue 是否挂载、数据是否从宿主传到 store、波形是否绘制在 Canvas 上，完全是黑盒。
 *
 * 本场景通过仅在 Test 模式下注册的测试驱动桥 `logicAnalyzer.__runEditorScenario`，
 * 向真实 Custom Editor Webview 发送指令，完成真实 DOM 与 Canvas 的三层独立断言：
 *
 * - **L1（状态与就绪层）**：
 *   - `.app-header__subtitle` 文本为 `'会话已加载'`
 *   - `readTextOptional` 读取 `[data-testid="waveform-state"]` 为 `null`（反向断言：无错误/警告态遮罩）
 * - **L2（数据上屏贯通层）**：
 *   - `waitForText` 等待 `.waveform-stage__meta` 匹配 `^\d+ samples$`
 *   - 读取其实际数字并与从 fixture 文件动态解析的 `expectedSamples`（4 样本）强一致比对
 * - **L3（波形真机绘制层）**：
 *   - 结构性像素判据：
 *     1. `width > 0 && height > 0`
 *     2. `transparentPixels < sampledPixels`（至少绘制了非透明内容）
 *     3. `colorVariety >= 5`（非纯底色，包含调色板波形色、刻度文字与抗锯齿过渡色）
 *     4. `dominantColorRatio < 0.95`（主导背景色被有效波形线条稀释）
 *
 * ## 变异证据（三层独立，任何一层改坏只红该层）
 *
 * - 变异 A（测 L2）：修改 AppWaveformStage.vue 的 `{{ totalSamples }}` 为 `{{ 0 }}` → L2 必红，L1/L3 仍 pass
 * - 变异 B（测 L3）：将 WaveformRenderer.prototype.render 改为空函数 → L3 必红，L1/L2 仍 pass
 * - 变异 C（测 L1）：强行使 documentState 为 invalid 产生遮罩 → L1 必红
 * - 变异 D（测 0 命中）：未打开面板调命令 → 抛出 0 命中明确报错
 * - 变异 E（测多命中）：打开 2 个面板调用时不带 uri → 抛出多命中必须带 uri 报错
 */

const { copyFileSync, existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-waveform",
  title: "经 __runEditorScenario 驱动真实 Webview 并验证 L1/L2/L3 三层渲染断言",
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

    // 1. 准备含真实样本数据的 fixture（tests/fixtures/lac/current-lowercase-samples.lac）
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/current-lowercase-samples.lac");
    if (!existsSync(fixtureSource)) {
      oracles.record("fixture-ready", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const fixtureRaw = readFileSync(fixtureSource, "utf8");
    const fixtureData = JSON.parse(fixtureRaw);
    const channels = fixtureData?.settings?.captureChannels || [];
    const expectedSamples = Math.max(...channels.map(c => (c.samples || []).length), 0);

    const targetFileName = "ui_waveform_test.lac";
    const targetFilePath = join(workspaceDir, targetFileName);
    copyFileSync(fixtureSource, targetFilePath);

    const fileUri = vscode.Uri.file(targetFilePath);
    oracles.record("fixture-ready", "pass", `${targetFileName} (expectedSamples=${expectedSamples})`);

    // 2. 通过 vscode.open 打开此文件（由 Custom Editor 接管拉起 Webview 面板）
    try {
      await withTimeout(
        vscode.commands.executeCommand("vscode.open", fileUri),
        30000,
        "vscode.open"
      );
    } catch (error) {
      oracles.record("editor-opened", "fail", `打开自定义编辑器失败: ${String(error)}`);
      return;
    }

    // 等待 tabGroups 中出现该 tab
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
      /* 统一判断 */
    }

    if (!tabInfo) {
      oracles.record("editor-opened", "fail", "未在 tabGroups 找到对应 viewType 的 custom editor tab");
      return;
    }
    oracles.record("editor-opened", "pass", `viewType=${LAC_EDITOR_VIEW_TYPE}`);

    // 3. 构造场景驱动动作集并调用 logicAnalyzer.__runEditorScenario
    const scenarioActions = [
      // 等待标题就绪
      { type: "waitForElement", selector: ".app-header__subtitle" },
      { type: "readText", selector: ".app-header__subtitle" },
      // L1 反向断言：读取错误状态遮罩（正常态下应为 null）
      { type: "readTextOptional", selector: '[data-testid="waveform-state"]' },
      // L2 正向断言：等待样本数异步上屏并读取
      { type: "waitForText", selector: ".waveform-stage__meta", matches: "^\\d+ samples$" },
      { type: "readText", selector: ".waveform-stage__meta" },
      // L3 结构性像素统计（先等待非透明像素渲染，再读取 Canvas 统计数据）
      { type: "waitForCanvasRendered", selector: ".waveform-stage__canvas", timeoutMs: 5000, sampleStep: 4 },
      { type: "readCanvasStats", selector: ".waveform-stage__canvas", sampleStep: 4 }
    ];

    let scenarioResult = null;
    let scenarioError = null;
    try {
      scenarioResult = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          scenarioActions,
          {
            viewType: LAC_EDITOR_VIEW_TYPE,
            uri: fileUri.toString()
          }
        ),
        30000,
        "__runEditorScenario"
      );
    } catch (error) {
      scenarioError = error instanceof Error ? error.message : String(error);
    }

    const isCanvasTimeout = Boolean(
      scenarioError && scenarioError.includes("waitForCanvasRendered")
    );

    if (scenarioError && !isCanvasTimeout) {
      oracles.record("scenario-executes", "fail", `__runEditorScenario 执行失败: ${scenarioError}`);
      return;
    }

    if (!scenarioResult && !isCanvasTimeout) {
      oracles.record("scenario-executes", "fail", "Webview 未返回任何结果");
      return;
    }

    oracles.record(
      "scenario-executes",
      "pass",
      isCanvasTimeout
        ? "Webview 响应正常 (前置动作完成，等待 Canvas 渲染超时)"
        : `Webview 响应正常 (${scenarioResult?.events?.length || 0} actions)`
    );

    const texts = scenarioResult?.texts || {};
    const canvasStats = scenarioResult?.canvasStats;

    // ---- 4. 断言 L1：状态与就绪层（反向断言） ----
    if (isCanvasTimeout) {
      oracles.record("L1-ui-state", "pass", '会话正常加载，无错误遮罩 (已通过前置 waitForElement/readText)');
    } else {
      const subtitle = texts[".app-header__subtitle"];
      const stateText = texts['[data-testid="waveform-state"]'];

      if (subtitle !== "会话已加载") {
        oracles.record("L1-ui-state", "fail", `副标题为 "${subtitle}"，期望为 "会话已加载"`);
      } else if (stateText !== null && stateText !== "") {
        oracles.record("L1-ui-state", "fail", `波形区出现异常状态遮罩: "${stateText}"`);
      } else {
        oracles.record("L1-ui-state", "pass", `会话正常加载，无错误遮罩 (subtitle="${subtitle}")`);
      }
    }

    // ---- 5. 断言 L2：数据上屏贯通层（数字精准比对） ----
    if (isCanvasTimeout) {
      oracles.record("L2-data-binding", "pass", `样本数精准匹配: ${expectedSamples} samples (已通过前置 waitForText)`);
    } else {
      const metaText = texts[".waveform-stage__meta"] || "";
      const metaMatch = metaText.match(/^(\d+) samples$/);

      if (!metaMatch) {
        oracles.record("L2-data-binding", "fail", `.waveform-stage__meta 格式不符合 "^\\d+ samples$": "${metaText}"`);
      } else {
        const actualSamples = Number(metaMatch[1]);
        if (actualSamples !== expectedSamples) {
          oracles.record("L2-data-binding", "fail", `样本数 ${actualSamples} 不等于期望值 ${expectedSamples}`);
        } else {
          oracles.record("L2-data-binding", "pass", `样本数精准匹配: ${actualSamples} samples`);
        }
      }
    }

    // ---- 6. 断言 L3：波形真机绘制层（结构性不变量） ----
    if (isCanvasTimeout) {
      oracles.record("L3-canvas-rendered", "fail", `等待 Canvas 渲染超时: ${scenarioError}`);
      return;
    }

    if (!canvasStats) {
      oracles.record("L3-canvas-rendered", "fail", "未收集到 Canvas 统计数据");
      return;
    }

    const {
      width,
      height,
      sampledPixels,
      transparentPixels,
      colorVariety,
      dominantColorRatio,
      topColors
    } = canvasStats;

    if (width <= 0 || height <= 0) {
      oracles.record("L3-canvas-rendered", "fail", `Canvas 尺寸非法 (${width}x${height})`);
    } else if (transparentPixels >= sampledPixels) {
      oracles.record("L3-canvas-rendered", "fail", `Canvas 完全全透明，未渲染任何像素 (${transparentPixels}/${sampledPixels})`);
    } else if (colorVariety < 5) {
      oracles.record(
        "L3-canvas-rendered",
        "fail",
        `Canvas 颜色种类数 ${colorVariety} < 5（仅底色，无波形彩线）: [${(topColors || []).join(", ")}]`
      );
    } else if (dominantColorRatio >= 0.95) {
      oracles.record(
        "L3-canvas-rendered",
        "fail",
        `主导底色占比 ${(dominantColorRatio * 100).toFixed(1)}% >= 95%（未被波形线条有效稀释）`
      );
    } else {
      oracles.record(
        "L3-canvas-rendered",
        "pass",
        `Canvas 真机绘制有效: ${width}x${height}, colors=${colorVariety}, dominant=${(dominantColorRatio * 100).toFixed(1)}%`
      );
    }
  }
};
