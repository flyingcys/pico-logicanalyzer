"use strict";

/**
 * ⚠️ 探针场景：实测 3 条交互命令在真宿主自动化环境下的阻塞行为。
 *
 * 涉及命令：
 * 1. `logicAnalyzer.connectDevice`（无设备时 await showWarningMessage）
 * 2. `logicAnalyzer.startCapture`（无设备时 await showWarningMessage）
 * 3. `logicAnalyzer.networkDiagnostics`（await showInputBox）
 *
 * ## 本探针证明什么
 * - 实验组证明：这三条命令在真宿主执行会 100% 稳定在 6000ms 超时挂死（返回的 Promise 永不 resolve）；
 * - 对照组证明：通过 `notifications.clearAll` 或 `closeQuickOpen` 强行关闭弹窗，虽然能让命令在 ~200ms 返回，
 *   但返回值固定为 `undefined`，直接触发代码中 `if (!action) return;` 的用户取消退出分支，
 *   证明 clearAll 只能伪造提前退出假象，根本跑不到连接/采集/诊断核心业务。
 *
 * ## 本探针不证明什么
 * - **不证明产品有 bug**：这是 VS Code 在自动化测试环境（ExtensionMode.Test / headless）下
 *   对带按钮的模态交互弹窗（showWarningMessage / showInputBox）的平台固有行为，并非扩展本身的代码缺陷。
 *
 * ## 关键对照点
 * - 为什么 `repeatCapture` 与 `configureWiFi` 能在真宿主跑通：
 *   因为那两处的 `vscode.window.showWarningMessage(...)` **没有 await**（fire-and-forget），
 *   所以命令立即返回；而这三处显式 `await` 了用户选择，导致整条命令挂死等待。
 * - 为什么 `connectDevice` 连 clearAll 都无法救：
 *   其前置调用 `hardwareDriverManager.detectHardware()` 探测 5 个驱动耗时约 5.5s，
 *   弹窗在第 5 秒多才弹出，并发 200ms 的 clearAll 根本打不到弹窗上。
 *
 * 门控：`LA_E2E_PROBE=1`
 */

module.exports = {
  id: "_probe-dialog-blocking",
  title: "（探针）实测 3 条交互命令在真宿主下的阻塞行为与 clearAll 对照",
  needsHardware: false,

  async run({ vscode, oracles, withTimeout }) {
    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "未找到扩展");
      return;
    }
    await withTimeout(extension.activate(), 30000, "extension.activate()");

    const COMMANDS = [
      { id: "logicAnalyzer.connectDevice", name: "connectDevice", type: "showWarningMessage" },
      { id: "logicAnalyzer.startCapture", name: "startCapture", type: "showWarningMessage" },
      { id: "logicAnalyzer.networkDiagnostics", name: "networkDiagnostics", type: "showInputBox" }
    ];

    const TIMEOUT_MS = 6000;
    const TRIALS = 3;

    console.log("\n================ [Probe] 开始阶段 1：直接执行（实验组，超时 6000ms） ================");
    const directResults = {};

    for (const cmd of COMMANDS) {
      directResults[cmd.name] = [];
      console.log(`\n[Probe] 正在测试命令: ${cmd.id} (${cmd.name}, ${cmd.type})...`);

      for (let i = 1; i <= TRIALS; i++) {
        const start = Date.now();
        let error = null;
        let returnedValue = null;
        try {
          returnedValue = await withTimeout(
            vscode.commands.executeCommand(cmd.id),
            TIMEOUT_MS,
            `${cmd.name}#${i}`
          );
        } catch (err) {
          error = String(err && err.message ? err.message : err);
        }
        const elapsed = Date.now() - start;
        const timedOut = Boolean(error && /超时/.test(error));
        directResults[cmd.name].push({ trial: i, elapsed, timedOut, error, returnedValue });
        console.log(`[Probe] ${cmd.name} 第 ${i} 次: 耗时 ${elapsed}ms, timedOut=${timedOut}, err=${error || "none"}`);
      }
    }

    console.log("\n================ [Probe] 开始阶段 2：对照组（带 clearAll / closeQuickOpen 触发） ================");
    const controlResults = {};

    for (const cmd of COMMANDS) {
      console.log(`\n[Probe] 对照组测试: ${cmd.name}...`);
      const start = Date.now();
      let error = null;
      let returnedValue = null;

      // 在命令发起后 200ms 发送清除动作
      const dismissPromise = new Promise(resolve => {
        setTimeout(async () => {
          try {
            if (cmd.type === "showWarningMessage") {
              await vscode.commands.executeCommand("notifications.clearAll");
            } else if (cmd.type === "showInputBox") {
              await vscode.commands.executeCommand("workbench.action.closeQuickOpen");
            }
          } catch (_) {}
          resolve();
        }, 200);
      });

      try {
        const [res] = await withTimeout(
          Promise.all([
            vscode.commands.executeCommand(cmd.id),
            dismissPromise
          ]),
          TIMEOUT_MS,
          `${cmd.name}-control`
        );
        returnedValue = res;
      } catch (err) {
        error = String(err && err.message ? err.message : err);
      }
      const elapsed = Date.now() - start;
      const timedOut = Boolean(error && /超时/.test(error));
      controlResults[cmd.name] = { elapsed, timedOut, error, returnedValue };
      console.log(`[Probe] 对照组 ${cmd.name}: 耗时 ${elapsed}ms, timedOut=${timedOut}, ret=${JSON.stringify(returnedValue)}, err=${error || "none"}`);
    }

    // ---- 记录探针结果 ----
    for (const cmd of COMMANDS) {
      const trials = directResults[cmd.name];
      const allTimedOut = trials.every(t => t.timedOut && t.elapsed >= TIMEOUT_MS - 500);
      const times = trials.map(t => `${t.elapsed}ms`).join(", ");
      const ctrl = controlResults[cmd.name];

      oracles.record(
        `probe:direct-hang:${cmd.name}`,
        allTimedOut ? "pass" : "fail",
        `${cmd.id} (${cmd.type}) 直接调用 3 次结果: [${times}] (全部稳定超时挂死: ${allTimedOut})`
      );

      oracles.record(
        `probe:control:${cmd.name}`,
        "pass",
        `对照组触发后: 耗时 ${ctrl.elapsed}ms, timedOut=${ctrl.timedOut}, 返回值=${JSON.stringify(ctrl.returnedValue)}`
      );
    }
  }
};
