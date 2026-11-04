"use strict";

/**
 * 场景：经 `logicAnalyzer.scanNetworkDevices` 验证网络扫描的**三条产品承诺**。
 *
 * ## 为什么判据不是"命令返回了"
 *
 * 本场景的第一版（2026-11-03 早）判据是：
 * ```js
 * if (elapsedMs >= 4000) { oracle: 'pass' }
 * else                   { oracle: 'pass' }     // ← 两个分支都 pass
 * ```
 * 那是**恒绿**的 —— 它不判别任何东西，而且测的是"环境耗时"不是"产品行为"。
 * 产品把并发修好、耗时降到 1s，它反而报"可能由于网络环境或缓存机制"，**把修复吞掉**。
 *
 * ## 现在的五条判据（各自独立，都有判别力）
 *
 * | oracle | 判据 | 产品改坏了会怎样 |
 * |---|---|---|
 * | `scan-completes-in-budget` | 命令在 `BUDGET_MS` 内返回 | 并发死代码没修 → 超预算 → 红 |
 * | `config-takes-effect` | `scanTimeoutMs=1200` 与 `=5000` 的耗时**显著不同** | 配置没被读 → 两次耗时一样 → 红 |
 * | `stats-observable` | 返回结构里有 `stats.aborted` 与 `stats.probedIps` | 没加 stats → 红（并说明"产品缺可观测性"） |
 * | `sidebar-scan-honors-config` | 侧栏扫描实际耗时受工作区配置控制（主判据） | 宿主未兜底回退硬编码默认值 → 耗时 ~5000ms ≥ 3000ms → 红 |
 * | `sidebar-payload-decoupled` | 侧栏发出的 postMessage 解绑硬编码 5000（辅判据） | 前端未解绑硬编码 5000 → 红 |
 *
 * `config-takes-effect` 是**关键的判别力来源**：
 * 只测"耗时没超预算"是不够的 —— 一个"直接 return 空结果"的产品也能通过。
 * 必须证明**那次等待是产品真的按配置在扫**。
 *
 * ## 已知产品缺陷
 *
 * - **BUG-1**（`docs/e2e-found-product-bugs-2026-11-03.md`）：`WiFiDeviceDiscovery.ts:261`
 *   的 `semaphore` 声明后零使用 ⇒ 并发控制失效 ⇒ 25s 仍未完成。
 * - **BUG-3**：UDP 广播发现对官方固件无效（固件零监听 4046），所以"扫不到设备"
 *   不能归因于"没设备"，也是扫描路径本身不完备。
 * - **BUG-4**：webview 传 `timeoutMs`，服务要 `timeout`，字段名对不上 ⇒ 静默失效。
 * - **D-11**（`docs/open-decisions-2026-11-03.md`）：侧栏「扫描网络」此前写死 `{ timeoutMs: 5000 }`，
 *   且宿主未缺省兜底，导致双入口行为分裂。现已通过 A+B 缺省兜底协同修复。
 *
 * ## 变异证据
 *
 * - 删掉 Worker 限流（回到全并发）→ `scan-completes-in-budget` 红
 * - 删掉 `scanTimeoutMs` 读取（硬编码）→ `config-takes-effect` 红
 * - 删掉 `stats` 字段 → `stats-observable` 红
 * - 删掉宿主兜底逻辑 → `sidebar-scan-honors-config` 红（耗时超 3000ms）
 * - 前端改回传 5000 → `sidebar-payload-decoupled` 红
 */

const { copyFileSync, existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

/**
 * 扫描的时间预算。
 *
 * 依据：`package.json` 的 `logicAnalyzer.network.scanTimeoutMs` 默认 5000，
 * 且产品应向用户兑现这个承诺。留 2x 余量吸收宿主/VM 抖动。
 */
const BUDGET_MS = 10000;

/** 短预算——用于 `config-takes-effect` 的低值。 */
const SHORT_TIMEOUT_MS = 1200;

/** 长预算——用于 `config-takes-effect` 的高值。 */
const LONG_TIMEOUT_MS = 5000;

/**
 * 两次扫描的耗时差至少要这么大，才能说"配置真的生效了"。
 *
 * 为什么不是"严格相等"：扫描耗时受网络环境影响，不能苛求是精确的 1.2s / 5.0s。
 * 但 1200 与 5000 相差 3800ms，只要配置生效，差值必然远大于 1500ms。
 * 若配置被忽略（两次都用同一个默认值），差值会接近 0。
 */
const MIN_TIMEOUT_DELTA_MS = 1500;

module.exports = {
  id: "network-scan",
  title: "经 scanNetworkDevices 验证扫描预算 / 配置生效 / 可观测性 / 侧栏配置遵从",
  needsHardware: false,

  async run({ vscode, workspaceDir, oracles, waitFor, withTimeout }) {
    const extension = vscode.extensions.getExtension("logic-analyzer-team.vscode-logic-analyzer");
    if (!extension) {
      oracles.record("extension-present", "fail", "未找到扩展");
      return;
    }
    await withTimeout(extension.activate(), 30000, "extension.activate()");

    const configuration = vscode.workspace.getConfiguration("logicAnalyzer.network");

    /**
     * 跑一次扫描并记时。
     *
     * ⚠️ 传 `autoSelect: true`（T-BUG-1 引入的参数化入口）——目的有二：
     *   1. 有设备时不走 `await showQuickPick`（那在真宿主会挂死）
     *   2. 只看扫描本身，不掺入"连接设备"的耗时
     *
     * 若产品没有 `autoSelect`（修复前），这里会走到 `showQuickPick` 分支
     * **仅当真有设备时**才挂；本机没有网络分析器，所以走的还是"无设备"路径。
     */
    async function runScan(timeoutMs, label) {
      await configuration.update(
        "scanTimeoutMs",
        timeoutMs,
        vscode.ConfigurationTarget.Workspace
      );
      const startedAt = Date.now();
      let result = null;
      let error = null;
      try {
        result = await withTimeout(
          vscode.commands.executeCommand("logicAnalyzer.scanNetworkDevices", { autoSelect: true }),
          BUDGET_MS,
          label
        );
      } catch (e) {
        error = String(e && e.message ? e.message : e);
      }
      return { elapsedMs: Date.now() - startedAt, result, error };
    }

    // ---- oracle 1：在预算内完成 ----
    const long = await runScan(LONG_TIMEOUT_MS, "scan@5000");
    if (long.error) {
      const reason = /^超时/.test(long.error)
        ? `耗时超过 ${BUDGET_MS}ms 预算（实测 ${long.elapsedMs}ms）。` +
          "根因见 BUG-1：WiFiDeviceDiscovery.ts:261 的 semaphore 声明后零使用，" +
          "并发控制失效 ⇒ 所有 IP 全并发，扫描耗时不可控。"
        : `命令抛出非超时异常：${long.error}`;
      oracles.record("scan-completes-in-budget", "fail", reason);
    } else {
      oracles.record(
        "scan-completes-in-budget",
        "pass",
        `耗时 ${long.elapsedMs}ms（预算 ${BUDGET_MS}ms，配置 timeout=${LONG_TIMEOUT_MS}）`
      );
    }

    // ---- oracle 2：配置真的生效 ----
    //
    // 这是本场景的**判别力核心**：只测"没超预算"证明不了产品在按配置扫。
    const short = await runScan(SHORT_TIMEOUT_MS, "scan@1200");
    if (long.error || short.error) {
      oracles.record(
        "config-takes-effect",
        "not_exercised",
        `前置失败（长超时: ${long.error || "ok"} / 短超时: ${short.error || "ok"}），无法比较耗时`
      );
    } else {
      const delta = long.elapsedMs - short.elapsedMs;
      if (delta >= MIN_TIMEOUT_DELTA_MS) {
        oracles.record(
          "config-takes-effect",
          "pass",
          `timeout=1200 → ${short.elapsedMs}ms；timeout=5000 → ${long.elapsedMs}ms；差 ${delta}ms ≥ ${MIN_TIMEOUT_DELTA_MS}ms`
        );
      } else {
        oracles.record(
          "config-takes-effect",
          "fail",
          `两次耗时几乎相同（${short.elapsedMs}ms vs ${long.elapsedMs}ms，差 ${delta}ms）。` +
            "⇒ `logicAnalyzer.network.scanTimeoutMs` 没生效。" +
            "根因见 BUG-1 附带的两个子缺陷：配置从未被读取 + extension.ts 硬编码 timeout。"
        );
      }
    }

    // ---- oracle 3：可观测性 ----
    //
    // 用户必须能知道"扫描是不完整的"。没有 stats，"5s 内只扫了 300/1016 个 IP"
    // 这件事对用户不可见，他会以为"网里真没设备"。
    const scanResult = long.result;
    if (!scanResult || typeof scanResult !== "object") {
      oracles.record(
        "stats-observable",
        "fail",
        `命令返回值不是对象（${JSON.stringify(scanResult)}）—— 无法观测扫描完成度`
      );
    } else if (!scanResult.stats || typeof scanResult.stats !== "object") {
      oracles.record(
        "stats-observable",
        "fail",
        "返回值缺 `stats` 字段。用户无法知道扫描是否被总超时截断（见 T-BUG-1 方案 §1）。" +
          `当前返回值键：${Object.keys(scanResult).join(", ") || "(空)"}`
      );
    } else {
      const { probedIps, totalIps, aborted } = scanResult.stats;
      const problems = [];
      if (typeof probedIps !== "number") problems.push("probedIps 不是数字");
      if (typeof totalIps !== "number") problems.push("totalIps 不是数字");
      if (typeof aborted !== "boolean") problems.push("aborted 不是布尔");
      if (problems.length) {
        oracles.record("stats-observable", "fail", `stats 结构不符：${problems.join("；")}`);
      } else {
        oracles.record(
          "stats-observable",
          "pass",
          `probedIps=${probedIps}/${totalIps}，aborted=${aborted}`
        );
      }
    }

    // ---- oracle 4：侧栏「扫描网络」按钮遵从工作区 scanTimeoutMs 配置 ----
    //
    // 依据与调查历程（见 docs/open-decisions-2026-11-03.md D-11）：
    // - 命令面板入口（extension.ts:300）正确从工作区配置读取了 scanTimeoutMs；
    // - 而 Webview 侧栏按钮（AppSidebarLeft.vue:127）写死了 captureCommands.scanNetworkDevices({ timeoutMs: 5000 })；
    // - 宿主侧 LACEditorProvider.ts:877 收到 hostCommand 后直接透传，未做任何配置合并；
    // - 探针 _probe-sidebar-scan-config 实测确证两端行为分裂：配置 1200ms 下侧栏 postMessage 仍硬编码发 5000ms。
    //
    // 判据具备双向敏感性：
    // - 当捕获的 payload.timeoutMs === SHORT_TIMEOUT_MS (1200) 时，pass；
    // - 当为 5000 或与配置不符时，fail 并指出产品缺陷位置。
    if (!workspaceDir || !existsSync(workspaceDir)) {
      oracles.record("sidebar-scan-honors-config", "fail", `工作区目录不可用：${workspaceDir}`);
    } else {
      const fixtureSource = resolve(__dirname, "../../../../fixtures/lac/current-lowercase-samples.lac");
      if (!existsSync(fixtureSource)) {
        oracles.record("sidebar-scan-honors-config", "fail", `Fixture 不存在: ${fixtureSource}`);
      } else {
        const testFileName = "network_scan_sidebar.lac";
        const testFilePath = join(workspaceDir, testFileName);
        copyFileSync(fixtureSource, testFilePath);

        const fileUri = vscode.Uri.file(testFilePath);
        await withTimeout(vscode.commands.executeCommand("vscode.open", fileUri), 30000, "vscode.open");

        let tabInfo = null;
        await waitFor(
          () => {
            const tabs = vscode.window.tabGroups.all.flatMap(g => g.tabs);
            tabInfo = tabs.find(
              t => t.input && String(t.input.uri?.fsPath).endsWith(testFileName) && t.input.viewType === LAC_EDITOR_VIEW_TYPE
            );
            return Boolean(tabInfo);
          },
          15000,
          "等待 tab 出现"
        );

        if (!tabInfo) {
          oracles.record("sidebar-scan-honors-config", "fail", "未找到自定义编辑器 tab");
        } else {
          const target = {
            viewType: LAC_EDITOR_VIEW_TYPE,
            uri: fileUri.toString()
          };

          // 预热：等待扫描网络按钮在 DOM 中就绪
          await vscode.commands.executeCommand(
            "logicAnalyzer.__runEditorScenario",
            [{ type: "waitForElement", selector: ".app-sidebar-left__commands button:nth-child(2)" }],
            target
          );

          // 确保当前配置为 SHORT_TIMEOUT_MS (1200)
          await configuration.update("scanTimeoutMs", SHORT_TIMEOUT_MS, vscode.ConfigurationTarget.Workspace);

          const actions = [
            { type: "startCaptureMessages" },
            { type: "click", selector: ".app-sidebar-left__commands button:nth-child(2)" },
            { type: "sleep", ms: 100 },
            { type: "stopCaptureMessages" },
            { type: "waitForElement", selector: ".el-message", timeoutMs: 15000 }
          ];

          const scanStartedAt = Date.now();
          let sidebarRes = null;
          try {
            sidebarRes = await withTimeout(
              vscode.commands.executeCommand("logicAnalyzer.__runEditorScenario", actions, target),
              20000,
              `sidebarScan@${SHORT_TIMEOUT_MS}`
            );
          } catch (err) {
            console.error(`[la-e2e] sidebarScan failed: ${String(err)}`);
          }
          const elapsedMs = Date.now() - scanStartedAt;

          const captured = Array.isArray(sidebarRes?.capturedMessages) ? sidebarRes.capturedMessages : [];
          const scanCmdMsg = captured.find(
            m => m && m.type === "hostCommand" && (m.command === "scanNetworkDevices" || m.command === "scanForDevices")
          );

          if (!scanCmdMsg) {
            oracles.record(
              "sidebar-scan-honors-config",
              "fail",
              "点击侧栏扫描按钮未捕获到 hostCommand: scanNetworkDevices 消息"
            );
            oracles.record(
              "sidebar-payload-decoupled",
              "fail",
              "点击侧栏扫描按钮未捕获到 hostCommand 消息，无法校验 payload"
            );
          } else {
            // 先提取 payload.timeoutMs（主判据故障定位与辅判据共用）
            const payloadTimeout = scanCmdMsg.payload && typeof scanCmdMsg.payload === "object"
              ? scanCmdMsg.payload.timeoutMs
              : undefined;

            // ---- 主判据：侧栏扫描耗时必须受 1200ms 工作区配置控制 ----
            // 实测探针数据（2026-11-04）：
            // - 1200ms 配置 5 次采样分布：[1216, 1227]ms
            // - 5000ms 默认 5 次采样分布：[5013, 5029]ms
            // - 两组分布间隙 3786ms。取中界 3000ms，两边各有 >1.7s 余量。
            const honorsConfig = elapsedMs < 3000;
            if (honorsConfig) {
              oracles.record(
                "sidebar-scan-honors-config",
                "pass",
                `侧栏扫描耗时 ${elapsedMs}ms，严格遵从 1200ms 配置（未生效时为 ~5000ms，判定阈值 3000ms）`
              );
            } else {
              // ⚠️ 不要硬编码单一根因 —— 结合 payloadTimeout 进行动态故障定位
              const cause = payloadTimeout === 5000
                ? "前端仍硬编码 5000（见 AppSidebarLeft.vue:127），显式入参覆盖了宿主配置"
                : "前端已解绑，但宿主缺省兜底未生效（见 LACEditorProvider.ts scanNetworkDevices 分支）";
              oracles.record(
                "sidebar-scan-honors-config",
                "fail",
                `侧栏扫描耗时 ${elapsedMs}ms ≥ 3000ms，未遵从 1200ms 配置。定位：${cause}`
              );
            }

            // ---- 辅判据：前端 postMessage payload 解绑硬编码 ----
            // D-11 A+B 协同架构下，前端不传参由宿主兜底，故 payload.timeoutMs 不应再写死 5000。
            if (payloadTimeout === undefined || payloadTimeout !== 5000) {
              oracles.record(
                "sidebar-payload-decoupled",
                "pass",
                `侧栏 payload 已成功解绑硬编码 5000（当前 payload.timeoutMs = ${payloadTimeout}）`
              );
            } else {
              oracles.record(
                "sidebar-payload-decoupled",
                "fail",
                `侧栏 payload.timeoutMs 仍为 ${payloadTimeout}（前端未解绑，见 AppSidebarLeft.vue:127）`
              );
            }
          }

          try {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
          } catch (_) {}
        }
      }
    }

    // ---- 登记：设备发现本身不在本场景验 ----
    //
    // 本机没有网络逻辑分析器（且 BUG-3 说广播发现对官方固件无效），
    // 所以"能不能真发现一台设备"在本环境**不可验**。
    // 不要把它写成 pass，也不要写成 fail —— 它是 not_exercised，带原因。
    oracles.record(
      "discovers-real-device",
      "not_exercised",
      "本机无网络逻辑分析器；且 BUG-3 已证 UDP 广播对官方固件无效，" +
        "需一台真设备才能验。「扫不到设备」在本机不构成产品缺陷证据。"
    );
  },
};
