"use strict";

/**
 * 场景 0：**命令面契约**（声明面 ↔ 注册面双向对账）与**接线存活**。
 *
 * ## ⚠️ 这个场景的诚实边界（先说清楚它验不到什么）
 *
 * 它**不验**"命令行为正确" —— 只验三类接线缺陷：
 *   1. `activate()` 掉线 → 命令根本没注册
 *   2. 声明了但没注册（package.json 与 extension.ts 漂移）
 *   3. 注册了但进 handler 第一行就炸
 *
 * ""命令调了就说过了"正是要防的假绿。
 *
 * ## ⚠️ 为什么不能只断言「9 个命令都在」
 *
 * 实测（2026-11-03，VS Code 1.74.3）：`executeCommand` 会**隐式激活**扩展，
 * 激活后 9 个命令全在。也就是说"命令都在"这条**恒真** ——
 * 它是 VS Code 给的，不是本扩展挣来的。
 *
 * 所以本场景的判据要**双向**：
 *   - 正向：manifest 声明的每一个命令，`getCommands()` 里必须有
 *   - 反向：`logicAnalyzer.` 前缀的命令，manifest 里必须有（防"注册了影子命令"）
 * 加上"不许 command not found"这条，才能抓住「声明的命令没注册」这个真缺陷。
 *
 * ## 变异证据（改坏一处，本场景必须红）
 *
 * - 从 `package.json` 删掉一条 `contributes.commands` →
 *   反向断言红（因为 extension.ts 还在注册它）
 * - 从 `extension.ts` 删掉一条 `registerCommand` 但留着 manifest →
 *   正向断言红（getCommands 里没有它）
 * - 把某个命令 id 改大小写 →
 *   正向 + 反向同时红
 *
 * ### 2026-11-03 实测（**真实跑过，不是推演**）
 *
 * 在 `out/extension.js` 里把 `'logicAnalyzer.stopCapture'` 改成
 * `'logicAnalyzer.stopCaptureMUTANT'`（模拟"注册错一个命令 id"），runner 输出：
 *
 * ```
 * ❌ commands-coverage → overall=fail
 *   ✅ declared-commands-nonempty — 9 条声明命令
 *   ✅ extension-activates — 激活成功（激活前 isActive=false）
 *   ❌ declared-commands-registered — 声明了但没注册：logicAnalyzer.stopCapture
 *   ❌ no-shadow-commands — 注册了但 manifest 没声明：logicAnalyzer.stopCaptureMUTANT
 *   ❌ wiring-alive-stopCapture — command not found —— 接线断了
 * ```
 *
 * ⇒ **三条判据各自独立红了**，说明它们不是同一条断言的三份拷贝。
 *   特别是 `extension-activates` 仍 pass —— 证明"扩展能激活"**不足以**推出
 *   "命令都对"，这正是本场景存在的理由（否则只验激活就够了）。
 */

const DECLARED_PREFIX = "logicAnalyzer.";

module.exports = {
  id: "commands-coverage",
  title: "命令面契约：声明面 ↔ 注册面双向对账 + 接线存活",
  needsHardware: false,

  async run({ vscode, declaredCommands, oracles, withTimeout }) {
    // ---- 0. 前置：manifest 里确实有命令（防止"两边都空"导致对账恒真）----
    if (!Array.isArray(declaredCommands) || declaredCommands.length === 0) {
      oracles.record(
        "declared-commands-nonempty",
        "fail",
        "package.json 的 contributes.commands 为空 —— 对账会恒真，必须先修 manifest"
      );
      return;
    }
    oracles.record("declared-commands-nonempty", "pass", `${declaredCommands.length} 条声明命令`);

    // ---- 1. 显式激活（**不用隐式激活**，否则验不到 activate 本身）----
    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "getExtension 未找到扩展；publisher.name 是否变了？");
      return;
    }
    const wasActiveBefore = extension.isActive;
    await withTimeout(extension.activate(), 30000, "extension.activate()");
    oracles.record(
      "extension-activates",
      "pass",
      `激活成功（激活前 isActive=${wasActiveBefore}）`
    );

    // ---- 2. 正向：manifest 声明的每个命令都必须在全局命令表里 ----
    const registered = await vscode.commands.getCommands(true);
    const registeredSet = new Set(registered);
    const missing = declaredCommands.filter(cmd => !registeredSet.has(cmd));
    if (missing.length > 0) {
      oracles.record(
        "declared-commands-registered",
        "fail",
        `声明了但没注册：${missing.join(", ")} —— activate() 掉线或 registerCommand 被删`
      );
    } else {
      oracles.record("declared-commands-registered", "pass", `${declaredCommands.length} 条全在`);
    }

    // ---- 3. 反向：本扩展前缀的命令，manifest 里必须有 ----
    // 防"注册了影子命令"（extension.ts 加了一条但忘写 manifest ⇒ 用户看不到、e2e 也不该认为它存在）
    const declaredSet = new Set(declaredCommands);
    const shadow = registered.filter(
      cmd => cmd.startsWith(DECLARED_PREFIX) && !declaredSet.has(cmd)
    );
    if (shadow.length > 0) {
      oracles.record(
        "no-shadow-commands",
        "fail",
        `注册了但 manifest 没声明：${shadow.join(", ")} —— 用户看不到这些命令`
      );
    } else {
      oracles.record("no-shadow-commands", "pass", "无影子命令");
    }

    // ---- 4. 接线存活：调一个无副作用路径的命令，确认不抛 command not found ----
    //
    // ⚠️ 这里**不调** openAnalyzer / createSyntheticCapture / startCapture /
    //    connectDevice / scanNetworkDevices —— 理由分别记在各自 oracle 里。
    //    调了它们就是"借这个场景做别的事"，归因会乱。
    //
    // stopCapture 的实测行为（2026-11-03）：未连接设备时 `showWarningMessage`
    // **没有 await**，所以命令立即返回 undefined。
    try {
      const result = await withTimeout(
        vscode.commands.executeCommand("logicAnalyzer.stopCapture"),
        10000,
        "executeCommand(stopCapture)"
      );
      oracles.record("wiring-alive-stopCapture", "pass", `返回 ${JSON.stringify(result)}`);
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      // "command not found" 才是接线问题；其它错误说明**已经进了 handler**
      if (/not found/i.test(message)) {
        oracles.record("wiring-alive-stopCapture", "fail", `command not found —— 接线断了：${message}`);
      } else {
        oracles.record(
          "wiring-alive-stopCapture",
          "pass",
          `进了 handler 后抛错（说明接线通）：${message}`
        );
      }
    }

    // ---- 5. 登记「本场景刻意不执行」的命令，并写明交给谁 ----
    //
    // 不做出无痕：不验也要留痕，否则后人会以为"漏了"而顺手补一条假绿。
    //
    // ⚠️ 用 `delegate` **不是** `not_exercised`：
    //    `not_exercised` 表示"这件事没人验"，会把整体拉成非 pass；
    //    而这里每一条都**有承接方**，只要承接场景真的验了，它就被验了。
    //    汇总层会核对承接场景确实存在且 pass（见 runner 的 delegates 对账）。
    /**
     * `requires` 说明「承接方的哪几条 oracle 才算接住」——
     * 不是"承接场景整体 pass"（那会让承接方一条无关的 not_exercised 把本委托拖红，
     * 2026-11-03 实际踩到）。
     */
    const delegated = [
      [
        "openAnalyzer",
        "有副作用（写 .lac + 开 webview），由 open-analyzer 场景验",
        "open-analyzer",
        ["lac-file-written", "custom-editor-opened"],
      ],
      [
        "createSyntheticCapture",
        "参数化入口（targetUri）已就位，由 create-synthetic-capture 场景验",
        "create-synthetic-capture",
        ["lac-file-written", "lac-content-matches-dsl", "samples-generated"],
      ],
      [
        "scanNetworkDevices",
        "真网络扫描耗时长，由 network-scan 场景带长超时验",
        "network-scan",
        // ⚠️ 只要这三条 —— 本场景关心的是"扫描命令能不能走通、受不受控"，
        // 不关心"能不能真发现一台设备"（那需要真设备，是另一回事）。
        ["scan-completes-in-budget", "config-takes-effect", "stats-observable"],
      ],
      // 下面几条**没有承接场景**，所以是真正的 not_exercised —— 原因必须可核实
      ["connectDevice", "无设备时 await showWarningMessage ⇒ 真宿主永不 resolve（实测 2026-11-03）", null, null],
      ["startCapture", "依赖已连接设备；且 getCaptureConfiguration() 走 showInputBox ⇒ 永不 resolve", null, null],
      ["repeatCapture", "依赖 lastCaptureConfig（需先成功采集过一次）", null, null],
      ["networkDiagnostics", "依赖网络扫描成功", null, null],
      ["configureWiFi", "await showInputBox ⇒ 真宿主永不 resolve（实测 2026-11-03）", null, null],
    ];
    for (const [name, reason, coveredBy, requires] of delegated) {
      if (coveredBy) {
        oracles.delegate(`not-executed:${name}`, reason, coveredBy, requires);
      } else {
        oracles.record(`not-executed:${name}`, "not_exercised", reason);
      }
    }
  },
};
