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
 * ## 现在的三条判据（各自独立，都有判别力）
 *
 * | oracle | 判据 | 产品改坏了会怎样 |
 * |---|---|---|
 * | `scan-completes-in-budget` | 命令在 `BUDGET_MS` 内返回 | 并发死代码没修 → 超预算 → 红 |
 * | `config-takes-effect` | `scanTimeoutMs=1200` 与 `=5000` 的耗时**显著不同** | 配置没被读 → 两次耗时一样 → 红 |
 * | `stats-observable` | 返回结构里有 `stats.aborted` 与 `stats.probedIps` | 没加 stats → 红（并说明"产品缺可观测性"） |
 *
 * `config-takes-effect` 是**关键的判别力来源**：
 * 只测"耗时没超预算"是不够的 —— 一个"直接 return 空结果"的产品也能通过。
 * 必须证明**那次等待是产品真的按配置在扫**。
 *
 * ## 已知产品缺陷（本场景会红，这是对的）
 *
 * - **BUG-1**（`docs/e2e-found-product-bugs-2026-11-03.md`）：`WiFiDeviceDiscovery.ts:261`
 *   的 `semaphore` 声明后零使用 ⇒ 并发控制失效 ⇒ 25s 仍未完成。
 * - **BUG-3**：UDP 广播发现对官方固件无效（固件零监听 4046），所以"扫不到设备"
 *   不能归因于"没设备"，也是扫描路径本身不完备。
 * - **BUG-4**：webview 传 `timeoutMs`，服务要 `timeout`，字段名对不上 ⇒ 静默失效。
 *
 * ## 变异证据
 *
 * - 删掉 Worker 限流（回到全并发）→ `scan-completes-in-budget` 红
 * - 删掉 `scanTimeoutMs` 读取（硬编码）→ `config-takes-effect` 红
 * - 删掉 `stats` 字段 → `stats-observable` 红
 */

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
  title: "经 scanNetworkDevices 验证扫描预算 / 配置生效 / 可观测性",
  needsHardware: false,

  async run({ vscode, oracles, withTimeout }) {
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

    // ---- oracle 4：BUG-4 —— webview 传的 `timeoutMs` 必须被认 ----
    //
    // 为什么**本 e2e 验不了**，以及为什么不硬凑：
    //   `extension.ts`（命令路径）**同时传了 `scanTimeout` 和 `timeoutMs`**，
    //   所以只要 `scanTimeout` 生效，就从命令返回值得不到"`timeoutMs` 是否被认"的证据。
    //   而真正需要这条兼容的是 **webview**（`AppSidebarLeft.vue:108` 只传 `timeoutMs`），
    //   但 webview 的 hostCommand 通道在宿主侧不可达（README §5.2），
    //   `ext.exports` 也是 undefined（拿不到 discovery 实例）。
    //
    // ⇒ 登记为 not_exercised，并**点名承接方**：这条必须由 unit 测试覆盖。
    //   （我曾想直接 new 一个 WiFiDeviceDiscovery 来验 —— 但那验的是"我自己 new 的实例"，
    //    不是"产品里那个实例"，属于替产品绕过，不做。）
    oracles.record(
      "webview-timeoutMs-honored",
      "not_exercised",
      "观测面缺失：命令路径同时传 scanTimeout+timeoutMs，分不出 timeoutMs 是否生效；" +
        "webview 通道在宿主侧不可达（README §5.2），ext.exports 为 undefined。" +
        "承接方：unit 测试需有 `scanForDevices({ timeoutMs: X })` → X 生效的断言。"
    );

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
