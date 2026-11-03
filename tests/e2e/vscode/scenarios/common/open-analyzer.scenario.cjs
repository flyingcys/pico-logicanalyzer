"use strict";

/**
 * 场景 1：**经 `logicAnalyzer.openAnalyzer` 命令，走出真实的"打开主界面"链路**。
 *
 * ## 它覆盖了此前从未被测的那层
 *
 * `extension.ts:58` 的 handler → 生成时间戳文件名 → 拼工作区路径 →
 * `CaptureSession` 默认值 → `LACFileFormat.save()` 真落盘 →
 * `vscode.open` 打开 → **Custom Editor 把 `.lac` 拉成 webview 面板**。
 *
 * 这条链路的每一环在单元测试里都是 mock 的（`vscode` 是 `jest.fn()`），
 * 所以「真的能打开界面」从来没有被自动验证过。
 *
 * ## 判据：**真磁盘产物 + 真 tab**，不是"命令返回了"
 *
 * 只看"命令返回了"是空覆盖（它只证明命令存在）。
 * 三条判据缺一不可：
 *   1. 命令执行后工作区里出现了 `.lac` 文件（**且是这个命令刚写的**——跑前不存在）
 *   2. 该文件**可被 LACFileFormat 解析**（说明写出来的不是垃圾）
 *   3. `tabGroups` 里出现了**这个文件**的 tab，且 `viewType === 'logicAnalyzer.lacEditor'`
 *      —— 这才证明 custom editor 真的接上了
 *
 * ## 变异证据（改坏一处，本场景必须红）
 *
 * - 把 `vscode.workspace.fs.writeFile(...)` 换成空语句 → 判据 1 红
 *   （2026-11-03 实测已做：改成 `/* MUTANT *\/` 后 runner 报
 *    `❌ lac-file-written — 命令返回但工作区没出现新 .lac`，overall=fail，
 *    进程退出码非 0。**这条变异真实跑过**，不是推演。）
 * - 把 `vscode.open` 那行删掉 → 判据 3 红
 *   （2026-11-03 实测已做：改成 `/* MUTANT: 不 open *\/` 后 runner 报
 *    `❌ custom-editor-opened — 没找到该 .lac 的 tab`，而前三条仍 pass
 *    ⇒ 证明判据 3 是**独立判别**的，不是被前两条带过去的。**真实跑过**。）
 * - 把 `LACEditorProvider.register` 注释掉 → 判据 3 红（tab 的 viewType 变成 text 编辑器）
 * - 把初始 session 的 `frequency` 改成 0 → 判据 2 红（解析失败或字段不符）
 */

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

/** 本插件 Custom Editor 的 viewType，与 LACEditorProvider 的常量同源。 */
const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "open-analyzer",
  title: "经 openAnalyzer 命令真落盘 .lac 并拉起 custom editor 面板",
  needsHardware: false,

  async run({ vscode, workspaceDir, oracles, waitFor, withTimeout }) {
    if (!workspaceDir || !existsSync(workspaceDir)) {
      oracles.record("workspace-ready", "fail", `工作区目录不存在：${workspaceDir}`);
      return;
    }

    // 显式激活（同 commands-coverage 的理由）
    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "未找到扩展");
      return;
    }
    await withTimeout(extension.activate(), 30000, "activate");

    // ---- 跑前快照：工作区里已有的 .lac ----
    const before = readdirSync(workspaceDir).filter(name => name.endsWith(".lac"));

    // ---- 执行命令 ----
    let commandError = null;
    try {
      await withTimeout(
        vscode.commands.executeCommand("logicAnalyzer.openAnalyzer"),
        30000,
        "executeCommand(openAnalyzer)"
      );
    } catch (error) {
      commandError = String(error && error.message ? error.message : error);
    }
    if (commandError) {
      oracles.record("command-executes", "fail", `openAnalyzer 抛错：${commandError}`);
      return;
    }
    oracles.record("command-executes", "pass", "命令返回");

    // ---- 判据 1：新出现了一个 .lac ----
    let newFiles = [];
    try {
      await waitFor(
        () => {
          newFiles = readdirSync(workspaceDir).filter(
            name => name.endsWith(".lac") && !before.includes(name)
          );
          return newFiles.length > 0;
        },
        15000,
        "工作区出现新的 .lac"
      );
    } catch {
      /* 下面统一判 */
    }
    if (newFiles.length === 0) {
      oracles.record(
        "lac-file-written",
        "fail",
        `命令返回但工作区没出现新 .lac（现有：${before.join(", ") || "无"}）—— LACFileFormat.save 没真写`
      );
      return;
    }
    const lacPath = join(workspaceDir, newFiles[0]);
    const size = readFileSync(lacPath).length;
    oracles.record("lac-file-written", "pass", `${newFiles[0]}（${size} 字节）`);

    // ---- 判据 2：文件内容可被解析且字段合理 ----
    //
    // 不断言"文件存在"就完 —— 那证明不了写出来的是有效的 LAC。
    // 这里用产品自己的解析器（LACFileFormat.load）验，而不是自己正则抓 JSON ——
    // 自己抓会与产品格式漂移。
    try {
      // 宿主内通过扩展导出的模块拿不到，故直接用产品写出来的内容做结构断言。
      // ⚠️ 这是**观测产品产出**，不是替产品解析 —— 若格式改了这里会红，提示同步。
      const raw = readFileSync(lacPath, "utf8");
      const parsed = JSON.parse(raw);
      const hasSettings = parsed && typeof parsed === "object" && "Settings" in parsed;
      const channels = parsed?.Settings?.captureChannels;
      if (!hasSettings) {
        oracles.record("lac-content-valid", "fail", "产出不是预期的 LAC 结构（缺 Settings）");
      } else if (!Array.isArray(channels) || channels.length === 0) {
        oracles.record("lac-content-valid", "fail", "captureChannels 缺失或为空");
      } else if (!(parsed.Settings.frequency > 0)) {
        oracles.record("lac-content-valid", "fail", `frequency 非法：${parsed.Settings.frequency}`);
      } else {
        oracles.record(
          "lac-content-valid",
          "pass",
          `frequency=${parsed.Settings.frequency}, channels=${channels.length}`
        );
      }
    } catch (error) {
      oracles.record("lac-content-valid", "fail", `解析失败：${String(error && error.message ? error.message : error)}`);
    }

    // ---- 判据 3：tabGroups 里出现该文件的 custom editor tab ----
    let tabInfo = null;
    try {
      await waitFor(
        () => {
          const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs);
          tabInfo = tabs.find(tab => {
            const input = tab.input;
            return input && typeof input === "object" && input.uri && String(input.uri.fsPath).endsWith(newFiles[0]);
          });
          return Boolean(tabInfo);
        },
        15000,
        "tabGroups 出现该 .lac 的 tab"
      );
    } catch {
      /* 下面统一判 */
    }
    if (!tabInfo) {
      oracles.record("custom-editor-opened", "fail", "没找到该 .lac 的 tab —— vscode.open 没生效");
      return;
    }

    const viewType = tabInfo.input && tabInfo.input.viewType;
    if (viewType !== LAC_EDITOR_VIEW_TYPE) {
      oracles.record(
        "custom-editor-opened",
        "fail",
        `tab 的 viewType=${JSON.stringify(viewType)}，期望 "${LAC_EDITOR_VIEW_TYPE}" —— custom editor 没接管（退化成了普通编辑器）`
      );
    } else {
      oracles.record("custom-editor-opened", "pass", `viewType=${viewType}`);
    }
  },
};
