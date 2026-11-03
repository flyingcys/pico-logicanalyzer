"use strict";

/**
 * 场景 2：**Signal DSL → 合成采集 → `.lac` 真落盘**（经 `createSyntheticCapture` 命令）。
 *
 * ## 为什么这条必须走"产品参数化入口"
 *
 * `createSyntheticCapture` 原实现走 `await vscode.window.showSaveDialog()`。
 * 实测（2026-11-03，VS Code 1.74.3 + ExtensionMode.Test）：
 * **`showSaveDialog` / `showOpenDialog` / `showInputBox` / `showQuickPick` 全部永不 resolve**
 * —— 命令会永久挂住，e2e 无法通过裸 `executeCommand` 验它。
 *
 * 用户 2026-11-03 裁定：产品侧加**参数化入口**（`options.targetUri`），
 * 带参/不带参**共用同一份核心逻辑**，参数只替换"取 uri"这一步。
 *
 * ## 判据（断言产品产出，不是"我调了某命令"）
 *
 *   1. 命令执行后，`options.targetUri` 指向的路径上**真出现了文件**
 *   2. 该文件能被解析，字段与 DSL 声明一致（sample_rate / 通道数）
 *   3. 文件里的样本数据**不是全零**（全零说明 DSL 没被真正执行）
 *
 * ## ⚠️ 前置：本场景依赖产品侧参数化入口
 *
 * 若产品还没加 `options.targetUri`，命令会走 `showSaveDialog` 并挂死。
 * 本场景用 `withTimeout` 把它变成**明确的 not_exercised**（带原因），
 * 而不是挂 60 秒后报一个看不懂的超时。
 *
 * ## 变异证据
 *
 * - 把 `SignalDescriptionLanguage.generateCaptureSession` 换成返回空 session
 *   → 判据 2/3 红
 * - 把 `LACFileFormat.save` 换成 no-op → 判据 1 红
 */

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

/** 与产品 `SignalDescriptionLanguage.getDefaultTemplate()` 同源的 DSL。 */
const DSL = [
  "# e2e synthetic capture",
  "sample_rate 1000000",
  "samples 64",
  "channel 0 CLK clock period=8 duty=0.5",
  "channel 1 DATA pattern bits=10110010 repeat=true",
].join("\n");

module.exports = {
  id: "create-synthetic-capture",
  title: "经 createSyntheticCapture 参数化入口真落盘（DSL → LAC）",
  needsHardware: false,

  async run({ vscode, workspaceDir, oracles, withTimeout }) {
    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "未找到扩展");
      return;
    }
    await withTimeout(extension.activate(), 30000, "activate");

    const targetPath = join(workspaceDir, "synthetic-e2e.lac");
    if (existsSync(targetPath)) {
      oracles.record("precondition-clean", "fail", `目标路径已存在，跑前快照被污染：${targetPath}`);
      return;
    }

    // ---- 给产品准备输入：把 DSL 文本放进编辑器并激活 ----
    //
    // ⚠️ **不做**给命令传 dslSource 参数 —— 那是替产品做决策。
    // 产品的 `getSignalDslSource()` 本来就读 `vscode.window.activeTextEditor`，
    // 所以 e2e 只要把文本放进编辑器，产品就会自己读到它。
    // 这属于「给产品准备输入」，是 e2e 第一原则唯一允许的例外。
    const dslPath = join(workspaceDir, "e2e-signal.sdsl");
    const { writeFileSync } = require("node:fs");
    writeFileSync(dslPath, DSL);
    const dslDoc = await vscode.workspace.openTextDocument(dslPath);
    await vscode.window.showTextDocument(dslDoc);

    const activeText = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.document.getText()
      : "";
    if (activeText.trim() !== DSL.trim()) {
      oracles.record(
        "dsl-input-prepared",
        "fail",
        `编辑器里的 DSL 与预期不符（len=${activeText.length}）—— 产品将读到错误输入，后续断言无意义`
      );
      return;
    }
    oracles.record("dsl-input-prepared", "pass", `activeEditor 含 ${activeText.length} 字符 DSL`);

    // ---- 执行（带超时：产品若还没加参数化入口，这里会超时而不是挂死）----
    let timeoutHit = false;
    try {
      await withTimeout(
        vscode.commands.executeCommand("logicAnalyzer.createSyntheticCapture", {
          targetUri: vscode.Uri.file(targetPath),
        }),
        20000,
        "executeCommand(createSyntheticCapture)"
      );
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      if (/^超时/.test(message)) {
        timeoutHit = true;
      } else {
        oracles.record("command-executes", "fail", `命令抛错：${message}`);
        return;
      }
    }

    if (timeoutHit) {
      oracles.record(
        "command-executes",
        "not_exercised",
        "命令超时 —— 产品侧尚未提供 createSyntheticCapture 的参数化入口（options.targetUri），" +
          "走了 showSaveDialog 并在真宿主内永不 resolve。见用户 2026-11-03 裁定 / T2。"
      );
      oracles.record("lac-file-written", "not_exercised", "依赖上一条");
      oracles.record("lac-content-matches-dsl", "not_exercised", "依赖上一条");
      oracles.record("samples-not-all-zero", "not_exercised", "依赖上一条");
      return;
    }
    oracles.record("command-executes", "pass", "命令返回");

    // ---- 判据 1：真落盘 ----
    if (!existsSync(targetPath)) {
      oracles.record(
        "lac-file-written",
        "fail",
        `命令返回但 ${targetPath} 不存在 —— 参数化入口没真写，或 targetUri 被忽略`
      );
      return;
    }
    const raw = readFileSync(targetPath, "utf8");
    oracles.record("lac-file-written", "pass", `${raw.length} 字节`);

    // ---- 判据 2：内容与 DSL 声明一致 ----
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      oracles.record("lac-content-matches-dsl", "fail", `不是合法 JSON：${error.message}`);
      return;
    }
    // ⚠️ LAC 有**大小写两套**键（历史兼容）：`Settings/frequency/captureChannels`
    //    与 PascalCase `Settings/Frequency/CaptureChannels`。
    //    产品写出哪套由版本决定，测试侧**两套都要认**，否则换个版本就假红。
    const settings = parsed && (parsed.Settings || parsed.settings) ? parsed.Settings || parsed.settings : null;
    if (!settings) {
      oracles.record("lac-content-matches-dsl", "fail", `缺 Settings 段（顶层键：${Object.keys(parsed).join(",")}）`);
      return;
    }
    const pick = (...names) => {
      for (const name of names) {
        if (settings[name] !== undefined) return settings[name];
      }
      return undefined;
    };
    const frequency = Number(pick("frequency", "Frequency"));
    const rawChannels = pick("captureChannels", "CaptureChannels") || [];
    const enabled = rawChannels.filter(c => c && (c.hidden !== true && c.Hidden !== true));

    const problems = [];
    if (frequency !== 1000000) problems.push(`frequency=${frequency}，DSL 声明 1000000`);
    if (enabled.length !== 2) problems.push(`启用通道=${enabled.length}，DSL 声明 2 个`);
    if (problems.length) {
      oracles.record("lac-content-matches-dsl", "fail", problems.join("；"));
    } else {
      oracles.record("lac-content-matches-dsl", "pass", `frequency=${frequency}, 通道=${enabled.length}`);
    }

    // ---- 判据 3：样本真的被生成（DSL 的 clock/pattern 要产生高低电平）----
    //
    // ⚠️ 判据必须落在**样本字段**上，不能"扫全文件的 0/1 字符" ——
    //    后者会把 channelNumber、frequency 之类的数字也算进去，是假判别。
    //
    // 两种样本承载形态都要支持：
    //   A. `captureChannels[i].samples = [1,0,1,1]`（lowercase 版本）
    //   B. 顶层 `Samples = ["0000...0004", ...]`（PascalCase 版本，位图字符串）
    const perChannelSamples = enabled
      .map(c => c && (c.samples || c.Samples))
      .filter(v => Array.isArray(v) && v.length > 0);

    let sampleBits = "";
    if (perChannelSamples.length) {
      sampleBits = perChannelSamples
        .map(arr => arr.map(v => (Number(v) ? "1" : "0")).join(""))
        .join("");
    } else {
      const topSamples = parsed.Samples || parsed.samples;
      if (Array.isArray(topSamples) && topSamples.length > 0) {
        sampleBits = topSamples
          .map(chunk => String(chunk).replace(/[^0-9a-fA-F]/g, ""))
          .join("");
      }
    }

    if (!sampleBits) {
      oracles.record(
        "samples-generated",
        "blocked",
        "产物里既无 captureChannels[].samples 也无顶层 Samples —— 本版本 LAC 不含内联样本，" +
          "需要另找观测面（如导出 CSV 后比对）。不要改判成 pass。"
      );
    } else if (!/1/.test(sampleBits) || !/0/.test(sampleBits)) {
      oracles.record(
        "samples-generated",
        "fail",
        `样本全为同一电平（长度 ${sampleBits.length}）—— DSL 的 clock/pattern 没被真正执行`
      );
    } else {
      oracles.record(
        "samples-generated",
        "pass",
        `样本 ${sampleBits.length} 位，同时含 0 与 1（DSL 真的产生了波形）`
      );
    }
  },
};
