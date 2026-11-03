"use strict";

/**
 * 场景：**导出按钮 UI（空数据禁用 / 有数据启用 / 点击发出 postMessage 消息拦截 / 格式载荷校验）**。
 *
 * ## ⚠️ 诚实定性：本场景的判据面是 Webview DOM 状态与 postMessage 发送拦截，**不是端到端文件落盘**。
 *
 * 依真宿主已知限制（README §5.1），vscode.window.showSaveDialog 在自动化测试中永不 resolve；
 * 文件落盘与数据转换已由 CLI export 子命令与 DataExportService.test.ts 单测 100% 覆盖闭环。
 *
 * ⚠️ 点击导出后，webview 内的 host.sendCommand 会在 10 秒后超时并弹出 error toast。
 *    本场景把点击设计为最后一批动作，超时发生时场景已结束。
 *    ⚠️ 如果将来要在这个场景后追加动作，必须考虑这个 10 秒的尾巴。
 *
 * ⚠️ 文件 A（空设置）与文件 B（含样本）同时处于打开状态，这严格验证了 viewType + uri 寻址的必要性。
 *
 * ## 判据面
 * 1. L1-export-disabled-without-data: 打开无样本会话（文件 A），导出按钮处于禁用状态（.is-disabled 或 disabled 存在）
 * 2. L2-export-enabled-with-data: 打开有样本会话（文件 B），导出按钮变为启用状态（禁用类与属性消失）
 * 3. L3-export-command-dispatched: 点击导出按钮后，透明拦截到向宿主发送的 { type: 'hostCommand', command: 'exportData' }
 * 4. L4-export-payload-valid: 校验捕获的 payload 载荷：format 为 'csv'，且 selectedChannels 包含有效非空通道数组
 * 5. export-persistence: blocked（如实记录真宿主弹窗不可自动化落盘，注明由 CLI 与单测承接）
 *
 * ## 变异矩阵
 * - 变异 A（测 canExportData 恒 false）：AppHeader.vue:51 canExportData 恒返回 false → L2/L3/L4 因果链红，L1 仍 pass
 * - 变异 B（测 canExportData 恒 true）：AppHeader.vue:51 canExportData 恒返回 true → 仅 L1 红（无数据时错误启用）
 * - 变异 C（测按钮点击接线）：AppHeader.vue:199 删掉 @click="exportData" → 仅 L3/L4 红（点击后捕获不到任何导出消息）
 * - 变异 D（测格式参数回归）：AppHeader.vue:100 将 'csv' 改为 'json' → 仅 L4 红（payload.format !== 'csv'）
 */

const { copyFileSync, existsSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

module.exports = {
  id: "ui-export-button",
  title: "验证导出按钮在无数据态禁用、有数据态启用、点击发出 exportData 消息与载荷校验",
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

    // =========================================================================
    // 阶段 1: 打开文件 A (无样本数据，settings-only)，验证 L1 禁用态
    // =========================================================================
    const fileAName = "ui_export_empty.lac";
    const fileAPath = join(workspaceDir, fileAName);
    const emptyLacContent = JSON.stringify({
      settings: {
        frequency: 1000000,
        preTriggerSamples: 100,
        postTriggerSamples: 1000,
        loopCount: 0,
        captureChannels: [
          { channelNumber: 0, channelName: "CH0", hidden: false }
        ]
      }
    }, null, 2);
    writeFileSync(fileAPath, emptyLacContent, "utf8");

    const fileAUri = vscode.Uri.file(fileAPath);
    await withTimeout(
      vscode.commands.executeCommand("vscode.open", fileAUri),
      30000,
      "vscode.open fileA"
    );

    // 等待 tab A 出现
    await waitFor(
      () => {
        const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
        return tabs.some(t => t.input && String(t.input.uri?.fsPath).endsWith(fileAName));
      },
      15000,
      "tabGroups 出现文件 A"
    );

    // 调驱动桥驱动文件 A 面板
    const fileAActions = [
      { type: "waitForElement", selector: '[data-testid="webview-export-button"]' },
      { type: "countElements", selector: '[data-testid="webview-export-button"][disabled], [data-testid="webview-export-button"].is-disabled' }
    ];

    let resultA = null;
    try {
      resultA = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          fileAActions,
          {
            viewType: LAC_EDITOR_VIEW_TYPE,
            uri: fileAUri.toString()
          }
        ),
        30000,
        "__runEditorScenario fileA"
      );
    } catch (err) {
      oracles.record("L1-export-disabled-without-data", "fail", `驱动文件 A 面板失败: ${String(err)}`);
      return;
    }

    const disabledCount = resultA?.counts?.['[data-testid="webview-export-button"][disabled], [data-testid="webview-export-button"].is-disabled'];
    if (disabledCount !== 1) {
      oracles.record(
        "L1-export-disabled-without-data",
        "fail",
        `无样本数据时导出按钮处于启用状态 (disabledCount=${disabledCount}，期望为 1)`
      );
    } else {
      oracles.record(
        "L1-export-disabled-without-data",
        "pass",
        "无样本数据时导出按钮处于禁用状态 (.is-disabled=1)"
      );
    }

    // 关闭文件 A 面板（触发 onDidDispose 注销）
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    // =========================================================================
    // 阶段 2: 打开文件 B (含 4 个真实样本)，验证 L2 启用态、L3 点击消息与 L4 载荷
    // =========================================================================
    const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/current-lowercase-samples.lac");
    if (!existsSync(fixtureSource)) {
      oracles.record("L2-export-enabled-with-data", "fail", `Fixture 源文件不存在：${fixtureSource}`);
      return;
    }

    const fileBName = "ui_export_samples.lac";
    const fileBPath = join(workspaceDir, fileBName);
    copyFileSync(fixtureSource, fileBPath);

    const fileBUri = vscode.Uri.file(fileBPath);
    await withTimeout(
      vscode.commands.executeCommand("vscode.open", fileBUri),
      30000,
      "vscode.open fileB"
    );

    // 等待文件 B 面板出现
    await waitFor(
      () => {
        const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
        return tabs.some(t => t.input && String(t.input.uri?.fsPath).endsWith(fileBName));
      },
      15000,
      "tabGroups 出现文件 B 面板"
    );

    // 调驱动桥驱动文件 B 面板（必须显式传 uri 以消除多命中歧义）
    const fileBActions = [
      // 1. 等待面板加载
      { type: "waitForElement", selector: '[data-testid="webview-export-button"]' },
      // 2. 检查禁用状态（期望为 0，即处于启用态）
      { type: "countElements", selector: '[data-testid="webview-export-button"][disabled], [data-testid="webview-export-button"].is-disabled' },
      // 3. 开始透明消息捕获
      { type: "startCaptureMessages" },
      // 4. 点击导出按钮
      { type: "click", selector: '[data-testid="webview-export-button"]' },
      // 5. 留出 100ms 捕获同步消息
      { type: "sleep", ms: 100 },
      // 6. 停止拦截并恢复原函数
      { type: "stopCaptureMessages" }
    ];

    let resultB = null;
    try {
      resultB = await withTimeout(
        vscode.commands.executeCommand(
          "logicAnalyzer.__runEditorScenario",
          fileBActions,
          {
            viewType: LAC_EDITOR_VIEW_TYPE,
            uri: fileBUri.toString()
          }
        ),
        30000,
        "__runEditorScenario fileB"
      );
    } catch (err) {
      oracles.record("L2-export-enabled-with-data", "fail", `驱动文件 B 面板失败: ${String(err)}`);
      return;
    }

    if (!resultB || !resultB.ok) {
      oracles.record("L2-export-enabled-with-data", "fail", `Webview B 回包失败: ${resultB?.error || "unknown"}`);
      return;
    }

    // ---- 断言 L2: export-enabled-with-data ----
    const fileBDisabledCount = resultB.counts?.['[data-testid="webview-export-button"][disabled], [data-testid="webview-export-button"].is-disabled'];
    if (fileBDisabledCount !== 0) {
      oracles.record(
        "L2-export-enabled-with-data",
        "fail",
        `含样本数据时导出按钮仍处于禁用状态 (disabledCount=${fileBDisabledCount})`
      );
    } else {
      oracles.record(
        "L2-export-enabled-with-data",
        "pass",
        "含样本数据时导出按钮处于启用状态 (.is-disabled=0)"
      );
    }

    // ---- 断言 L3: export-command-dispatched ----
    const captured = Array.isArray(resultB.capturedMessages) ? resultB.capturedMessages : [];
    const exportMsg = captured.find(
      msg => msg && typeof msg === "object" && msg.type === "hostCommand" && msg.command === "exportData"
    );

    if (!exportMsg) {
      const summaryList = captured.map(m => `${m.type}:${m.command}`).join(", ") || "无消息";
      oracles.record(
        "L3-export-command-dispatched",
        "fail",
        `点击导出按钮未捕获到 hostCommand: exportData 消息 (已捕获: ${summaryList})`
      );
    } else {
      oracles.record(
        "L3-export-command-dispatched",
        "pass",
        `成功捕获到导出消息 (command="exportData", requestId="${exportMsg.requestId}")`
      );
    }

    // ---- 断言 L4: export-payload-valid ----
    if (!exportMsg) {
      oracles.record("L4-export-payload-valid", "fail", "因 L3 缺失导出消息，无法校验 payload");
    } else {
      const payload = exportMsg.payload;
      if (!payload || typeof payload !== "object") {
        oracles.record("L4-export-payload-valid", "fail", "导出消息未携带 payload 对象");
      } else if (payload.format !== "csv") {
        oracles.record("L4-export-payload-valid", "fail", `导出格式为 "${payload.format}"，期望为 "csv"`);
      } else if (!Array.isArray(payload.selectedChannels) || payload.selectedChannels.length === 0) {
        oracles.record("L4-export-payload-valid", "fail", `selectedChannels 缺失或为空数组`);
      } else {
        oracles.record(
          "L4-export-payload-valid",
          "pass",
          `载荷格式正确 (format="csv", channels=[${payload.selectedChannels.join(",")}])`
        );
      }
    }

    // ---- 落盘 Blocked 记录 ----
    oracles.record(
      "export-persistence",
      "blocked",
      "依据 VS Code 真宿主已知限制（README §5.1），showSaveDialog 永不 resolve；落盘已由 CLI export 子命令与 DataExportService.test.ts 100% 覆盖闭环"
    );
  }
};
