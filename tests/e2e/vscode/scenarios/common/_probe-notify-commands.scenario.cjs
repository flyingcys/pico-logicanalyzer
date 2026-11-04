"use strict";

/**
 * ⚠️ **探针场景（临时，仅用于实测确认）** —— 验证 `repeatCapture` / `configureWiFi`
 * 在真宿主里**到底会不会返回**。
 *
 * 背景：`commands-coverage.scenario.cjs` 给这两条写的 `not_exercised` 理由是
 * 「`await showWarningMessage` ⇒ 真宿主永不 resolve」。但读码看这两处**没有 await**。
 * 谁对，只有实测说了算。
 *
 * 只读产品代码、不改；用一个带超时的 `executeCommand` 观察是否返回。
 *
 * 触发：`LA_E2E_PROBE=1`（与 `_probe-fakegreen` 共用开关）
 */
module.exports = {
  id: "_probe-notify-commands",
  title: "（探针）实测 repeatCapture / configureWiFi 是否会在真宿主返回",
  needsHardware: false,

  async run({ vscode, oracles, withTimeout }) {
    // 拦截 showWarningMessage / showInformationMessage / showErrorMessage，
    // 记录产品到底发出了什么通知（不注入任何响应 —— 只记录，不伪造）
    const notifications = [];
    const originals = {
      showWarningMessage: vscode.window.showWarningMessage,
      showInformationMessage: vscode.window.showInformationMessage,
      showErrorMessage: vscode.window.showErrorMessage,
    };
    for (const key of Object.keys(originals)) {
      vscode.window[key] = (...args) => {
        notifications.push({ level: key, message: String(args[0]) });
        // ⚠️ 不返回 Promise：真宿主的实现本身就不 resolve，
        //    这里返回 undefined 会**改变被测行为**，所以照原样调用真实实现并忽略其返回值。
        return originals[key].apply(vscode.window, args);
      };
    }

    const restore = () => {
      for (const key of Object.keys(originals)) {
        vscode.window[key] = originals[key];
      }
    };

    try {
      for (const command of ["logicAnalyzer.repeatCapture", "logicAnalyzer.configureWiFi"]) {
        const startedAt = Date.now();
        const before = notifications.length;
        let outcome = null;
        try {
          const result = await withTimeout(
            vscode.commands.executeCommand(command),
            8000,
            `executeCommand(${command})`
          );
          outcome = { returned: true, elapsedMs: Date.now() - startedAt, result };
        } catch (error) {
          outcome = {
            returned: false,
            elapsedMs: Date.now() - startedAt,
            error: String(error && error.message ? error.message : error),
          };
        }
        const emitted = notifications.slice(before);

        oracles.record(
          `probe:${command}`,
          outcome.returned ? "pass" : "fail",
          outcome.returned
            ? `返回 ${JSON.stringify(outcome.result)}，耗时 ${outcome.elapsedMs}ms；` +
              `期间通知 ${JSON.stringify(emitted)}`
            : `未返回（${outcome.elapsedMs}ms 后超时）：${outcome.error}`
        );
      }
    } finally {
      restore();
    }
  },
};
