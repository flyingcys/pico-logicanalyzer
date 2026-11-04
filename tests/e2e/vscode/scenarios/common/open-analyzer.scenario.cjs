"use strict";

/**
 * 场景 1：**经 `logicAnalyzer.openAnalyzer` 命令，走出真实的"打开主界面"链路**。
 *
 * ## 它覆盖了此前从未被测的那层
 *
 * `extension.ts` 的 handler → 生成时间戳文件名 → 拼工作区路径 →
 * `CaptureSession` 默认值 → `LACFileFormat.createFromCaptureSession()` 真落盘 →
 * `vscode.open` 打开 → **Custom Editor 把 `.lac` 拉成 webview 面板**。
 *
 * ## 判据：**真磁盘产物 + 真 tab + 配置穿透**，不是"命令返回了"
 *
 * 1. 工作区出现刚写的 `.lac` 文件
 * 2. 文件 LAC 结构有效，且 `frequency` 与当前 `defaultSampleRate` 配置精确一致
 * 3. tabGroups 出现该文件且 `viewType === 'logicAnalyzer.lacEditor'`
 * 4. **三次配置对照**（PK 第 9 轮裁定）：
 *    - 8MHz  → frequency === 8000000   抓「完全忽略配置」
 *    - 16MHz → frequency === 16000000  抓「只读第一次/缓存」
 *    - 缺省   → frequency === 1000000   抓「fallback 与 manifest 不一致」
 *
 *    ⚠️ 前两次必须都是**非默认值**。若第二次用 1000000，产品写死 fallback
 *    时第二次会假绿（同义反复），判据失去判别力。
 *
 * ## 变异证据（改坏一处，本场景必须红）
 *
 * - 删掉 `vscode.workspace.fs.writeFile(...)` → `lac-file-written` 红
 * - 删掉 `vscode.open` → `custom-editor-opened` 红
 * - 注释掉 `LACEditorProvider.register` → `custom-editor-opened` 红
 * - 把初始 session 的 `frequency` 改成 0 → `lac-content-valid` 红
 * - 把 `readDefaultSampleRate()` 改回写死 1000000 → ①② 两条 oracle 红
 * - 把 fallback 从 1000000 改成 3000000 → ③ 红
 */

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join, resolve } = require("node:path");

/** 本插件 Custom Editor 的 viewType，与 LACEditorProvider 的常量同源。 */
const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

const NON_DEFAULT_A = 8000000;
const NON_DEFAULT_B = 16000000;

module.exports = {
  id: "open-analyzer",
  title: "经 openAnalyzer 命令真落盘 .lac、拉起 custom editor 并验证 defaultSampleRate 双非默认配置穿透",
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

    const configuration = vscode.workspace.getConfiguration("logicAnalyzer");

    /** 把工作区配置设为指定值；传 null 表示清除（回到 manifest default）。 */
    async function setSampleRate(value) {
      await configuration.update(
        "defaultSampleRate",
        value,
        vscode.ConfigurationTarget.Workspace
      );
    }

    /** 真调 openAnalyzer，等新文件出现，读回 LAC 的 frequency。 */
    async function openAndReadFrequency(label) {
      const before = readdirSync(workspaceDir).filter(name => name.endsWith(".lac"));
      let commandError = null;
      try {
        await withTimeout(
          vscode.commands.executeCommand("logicAnalyzer.openAnalyzer"),
          30000,
          `executeCommand(openAnalyzer)@${label}`
        );
      } catch (error) {
        commandError = String(error && error.message ? error.message : error);
      }
      if (commandError) return { error: commandError };

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
          `工作区出现新的 .lac (${label})`
        );
      } catch {
        /* 下方统一判 */
      }
      if (newFiles.length === 0) return { error: "命令返回但工作区没出现新 .lac" };

      const lacPath = join(workspaceDir, newFiles[0]);
      try {
        const parsed = JSON.parse(readFileSync(lacPath, "utf8"));
        return {
          fileName: newFiles[0],
          size: readFileSync(lacPath).length,
          frequency: parsed?.Settings?.frequency,
          channels: parsed?.Settings?.captureChannels,
        };
      } catch (error) {
        return { error: `解析失败：${String(error && error.message ? error.message : error)}` };
      }
    }

    // ---- 三次配置对照：每次都真调产品命令 + 真读盘 ----
    await setSampleRate(NON_DEFAULT_A);
    const runA = await openAndReadFrequency("8MHz");
    await setSampleRate(NON_DEFAULT_B);
    const runB = await openAndReadFrequency("16MHz");
    await setSampleRate(null);
    const runDefault = await openAndReadFrequency("default");

    // ---- oracle: command-executes ----
    const runs = [runA, runB, runDefault];
    const firstError = runs.find(run => run.error)?.error;
    if (firstError) {
      oracles.record("command-executes", "fail", `openAnalyzer 执行/落盘失败：${firstError}`);
      return;
    }
    oracles.record("command-executes", "pass", "三次 openAnalyzer 均返回并真落盘");

    const assertRun = (id, run, expected, label) => {
      if (run.frequency !== expected) {
        oracles.record(
          id,
          "fail",
          `${label}：frequency=${run.frequency}，期望 ${expected} —— defaultSampleRate 未穿透或存在缓存`
        );
      } else {
        oracles.record(id, "pass", `${label}：产出 .lac 的 frequency=${run.frequency}，与配置精确一致`);
      }
    };

    assertRun("config-rate-8mhz", runA, NON_DEFAULT_A, "配置=8000000（非默认值 A）");
    assertRun("config-rate-16mhz", runB, NON_DEFAULT_B, "配置=16000000（非默认值 B）");
    // ③ 的默认基线直接读产品 manifest，不让测试侧替产品写死默认值。
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../../../../package.json"), "utf8"));
    const manifestDefault = manifest.contributes.configuration.properties["logicAnalyzer.defaultSampleRate"].default;
    assertRun("config-rate-default", runDefault, manifestDefault, `不设置（manifest default=${manifestDefault}）`);

    // ---- oracle: lac-file-written（沿用原有真落盘判据，用第一次产物） ----
    oracles.record("lac-file-written", "pass", `${runA.fileName}（${runA.size} 字节）`);

    // ---- oracle: lac-content-valid（结构 + 三次配置一致性） ----
    const channels = runA.channels;
    if (!Array.isArray(channels) || channels.length === 0) {
      oracles.record("lac-content-valid", "fail", "captureChannels 缺失或为空");
    } else if (!(runA.frequency > 0) || !(runB.frequency > 0) || !(runDefault.frequency > 0)) {
      oracles.record(
        "lac-content-valid",
        "fail",
        `frequency 非法：A=${runA.frequency}, B=${runB.frequency}, default=${runDefault.frequency}`
      );
    } else {
      oracles.record(
        "lac-content-valid",
        "pass",
        `三次产出均为有效 LAC：frequency=${runA.frequency}/${runB.frequency}/${runDefault.frequency}, channels=${channels.length}`
      );
    }

    // ---- oracle: custom-editor-opened（最后一个文件的 tab） ----
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
              String(input.uri.fsPath).endsWith(runDefault.fileName)
            );
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
        `tab 的 viewType=${JSON.stringify(viewType)}，期望 "${LAC_EDITOR_VIEW_TYPE}" —— custom editor 没接管`
      );
    } else {
      oracles.record("custom-editor-opened", "pass", `viewType=${viewType}`);
    }
  },
};
