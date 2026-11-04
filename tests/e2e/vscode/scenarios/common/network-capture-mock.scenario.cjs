"use strict";

/**
 * 场景：**协议级模拟设备**下的网络采集端到端（**经 Webview 侧栏驱动**）。
 *
 * ## 这个场景与 `network-scan` 的分工
 *
 * | | network-scan | 本场景 |
 * |---|---|---|
 * | 关注 | 扫描命令的**受控性**（超时、并发、可中止） | 扫描之后**能不能真连上并采集** |
 * | 设备 | 无（只验扫描本身） | **协议级模拟设备** |
 *
 * ## 为什么主路径必须走 Webview（项 8，2026-11-05）
 *
 * 旧版本直接调 `out/e2e-libs/` 的 `hardwareDriverManager.connectToDevice(...)`，
 * **绕过了产品真正的连接入口** `LACEditorProvider.connectToNetworkDevice`，
 * 于是 `NetworkStabilityService.connect()` / `startHeartbeat()` /
 * `startQualityMonitoring()` 这三件事一条都没被验过。
 *
 * 现在主路径改为：真宿主里打开 Custom Editor → 侧栏填 `host:port` →
 * 点「网络」按钮 → 点「开始采集」。这一切都发生在 **bundle 内**，
 * 走的是用户真实点击的那条路。
 *
 * ## ⚠️ DOM 选择器（踩过的坑，别重试错的那几个）
 *
 * 网络输入框的 append 按钮**唯一正确**写法：
 * ```
 * .connection-fields .el-input:nth-of-type(2) .el-input-group__append button
 * ```
 * 实测错误的三种：
 * - `.connection-fields .el-input__append button`        → 0 命中（类名是 `el-input-group__append`）
 * - `.connection-fields button:last-of-type`             → 点到「断开」
 * - `.connection-fields .el-input__append button`（变体）→ 0 命中
 *
 * 输入框本身用 `input[placeholder="192.168.1.100:4045"]`。
 *
 * ## 判据设计（每条都能被变异抓红）
 *
 * - **D1 设备可被发现**：产品自己的 `scanForDevices` 扫到了模拟设备
 * - **D2 握手内容正确**：产品解析出的 `version` / 通道数等，与模拟设备自报的一致
 * - **D3 采集请求可达**：产品向设备发出了 `CAPTURE_REQUEST`（命令字节 1）
 * - **D4 请求参数正确**：频率/通道/触发类型与用户配置一致（从设备侧视角验，不是从产品侧）
 * - **D6 Webview 连接链路**：侧栏点「网络」后 UI 显示已连接、StabilityService 真的建了第二条连接
 * - **D7 心跳**：`heartbeatIntervalMs=1000` 下设备侧收到 `0x00` 心跳字节
 * - **D8 驱动契约**：设备侧收到的是固件二进制帧而非 JSON
 *
 * D3/D4 的判据**落在设备侧**（模拟器记录的原始帧），
 * 而不是"产品说自己发了" —— 这是本场景区别于所有其他场景的地方：
 * **观测点在产品的对端**。
 *
 * ## ⚠️ 已知会红的地方（这正是价值）
 *
 * 产品 `NetworkLogicAnalyzerDriver.ts:701` 发的是 `JSON.stringify`，
 * 而真固件只认 `0x55 0xAA` 二进制帧。
 * ⇒ D3/D4 会失败，且失败信息直指"产品发的东西设备看不懂"。
 *
 * **不要为了让本场景变绿而改模拟器去解析 JSON** —— 那是把缺陷藏起来。
 * 正确修法是改产品网络驱动（见 `docs/open-decisions-2026-11-03.md` D-9）。
 */

const { copyFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const {
  startMockDevice,
  buildFrame,
  CMD_ID_REQUEST,
  CMD_CAPTURE,
  DEVICE_ID_LINE,
  DEFAULT_CAPS,
} = require("../../lib/mockDevice.cjs");

/** 本插件 Custom Editor 的 viewType（与 LACEditorProvider 常量同源）。 */
const LAC_EDITOR_VIEW_TYPE = "logicAnalyzer.lacEditor";

/**
 * 产品解析出的样本数是否与设备发出的不一致。
 *
 * 抽成函数只为让对账那段读起来短一点；判据只有一条：
 * **产品解析出的样本数必须等于设备发出的样本数**。
 */
function sampleCountMismatch(channels, sent) {
  if (!Array.isArray(channels) || channels.length === 0) return true;
  return channels.some(ch => ((ch && ch.samples) || []).length !== sent.length);
}

/**
 * 加载**产品模块**（按类名，供场景构造/使用产品真实实现）。
 *
 * ## ⚠️ 为什么不 require `out/services/*.js` 与 `out/drivers/*.js`
 *
 * 2026-11-04 实测（干净环境必挂）：
 * ```sh
 * $ npm run clean && npm run build
 * $ ls out/services/     → 只有 DataExportService.js / ExportPerformanceOptimizer.js
 * $ ls out/drivers/      → 只有 AnalyzerDriverBase / LogicAnalyzerDriver / VersionValidator
 * ```
 * 原因：`build:cli` 用 tsc **从 `src/cli/index.ts` 出发**只编译 CLI 依赖链，
 * `WiFiDeviceDiscovery` / `HardwareDriverManager` 不在链上 ⇒ 不产出。
 * 之前本地能跑，是因为 `out/` 里躺着某次全量 tsc 的历史残留。
 *
 * ## ⚠️ 也不能用 `out/extension.js`（webpack bundle）
 *
 * 实测：bundle 的 `module.exports` 只含 `extension.ts` 的**顶层具名导出**
 * （`activate` / `deactivate` / `connectToDevice` / `connectToNetworkDevice`），
 * `WiFiDeviceDiscovery` / `hardwareDriverManager` 都是 `undefined`。
 * 而 `activate()` 是 `void`，`ext.exports` 同样拿不到 —— 所以也走不了
 * "从扩展实例拿"那条路。
 *
 * ## ⇒ 用 `out/e2e-libs/`（正式产物目录，非临时方案）
 *
 * 由 `npm run build:e2e-libs`（配置 `tsconfig.e2e-libs.json`）产出：
 * 全量 tsc emit 到 `out/e2e-libs/`，**与 webpack 的 `out/extension.js` 互不覆盖**
 * （实测：直出 `out/` 会把 bundle 换成 tsc 裸编译版，`__webpack_require__` 计数 82 → 0，
 *   真宿主加载会崩 —— 那比原缺陷更危险）。
 *
 * 这里加载的**仍然是产品代码**：同一份 `src/` 编译产物，不是测试侧替身。
 */
function loadProductModule(relativePath) {
  return require(`../../../../../out/e2e-libs/${relativePath}.js`);
}

module.exports = {
  id: "network-capture-mock",
  title: "协议级模拟设备：经 Webview 侧栏连接 → 握手 → 心跳 → 采集请求",
  needsHardware: false,
  /**
   * 本场景按**类名**加载产品模块（`WiFiDeviceDiscovery` / `HardwareDriverManager` /
   * `LogicAnalyzerDriver`），来自 `out/e2e-libs/`（`npm run build:e2e-libs`）。
   * runner 见到本标志会在开跑前检查该目录，缺失直接报错并指路 ——
   * 而不是让场景记 `blocked`（那看起来像环境问题）。
   */
  needsE2eLibs: true,

  async run({ vscode, workspaceDir, oracles, waitFor, withTimeout }) {
    // ---- 0. 起模拟设备 ----
    let device = null;
    try {
      device = await startMockDevice({ port: 0 });
    } catch (error) {
      oracles.record(
        "mock-device-started",
        "fail",
        `模拟设备启动失败：${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    oracles.record(
      "mock-device-started",
      "pass",
      `监听 ${device.host}:${device.port}（协议：固件二进制帧）`
    );

    try {
      // ---- 1. 先自证模拟器本身符合固件协议 ----
      //
      // 为什么先做这一步：如果模拟器自己对协议的理解就是错的，
      // 后面所有判据都没有意义。这一步用**我们自己发的正确帧**验证设备应答，
      // 与产品无关。
      {
        const net = require("node:net");
        const client = new net.Socket();
        const reply = await withTimeout(
          new Promise((resolve, reject) => {
            let data = "";
            client.connect(device.port, device.host, () => {
              client.write(buildFrame(CMD_ID_REQUEST));
            });
            client.on("data", d => {
              data += d.toString();
              if (data.split("\n").filter(Boolean).length >= 5) resolve(data);
            });
            client.on("error", reject);
          }),
          5000,
          "自证：向模拟器发正确帧"
        ).catch(e => `ERR:${e.message}`);
        client.destroy();

        const ok =
          typeof reply === "string" &&
          reply.includes("LOGIC_ANALYZER_") &&
          /FREQ:\d+/.test(reply);
        oracles.record(
          "mock-device-speaks-firmware-protocol",
          ok ? "pass" : "fail",
          ok ? `正确帧得到 5 行应答（首行 ${DEVICE_ID_LINE}）` : `模拟器自证失败：${reply}`
        );
        if (!ok) return; // 模拟器坏了，后面判据无意义
      }

      // ---- 2. 用**产品自己的**扫描器发现它 ----
      //
      // ⚠️ 不用产品的「扫整个网段」入口（那要 5 秒 × 254 IP）。
      // 这里直接验证**单点握手**这条产品路径：
      // `WiFiDeviceDiscovery` 的 verifyPicoDevice 是私有的，
      // 所以走它公开的 `scanForDevices`，但把 IP 列表收窄到本机。
      const extension = vscode.extensions.getExtension(
        "logic-analyzer-team.vscode-logic-analyzer"
      );
      if (!extension) {
        oracles.record("extension-present", "fail", "扩展未找到");
        return;
      }
      await withTimeout(extension.activate(), 30000, "extension.activate()");

      /**
       * 产品在这个版本里没有"只扫指定 IP"的公开入参，
       * `scanForDevices` 总是从本机网段生成 IP 列表。
       * ⇒ 本场景**不假装**能收窄，改为直接验产品发的原始发现帧
       * （即产品 TCP 连上来后发了什么），这是设备侧能观测到的事实。
       *
       * 产品连上来的方式：`scanForDevices` → `isPortOpen` → `verifyPicoDevice`
       * → 连上后立刻发 ID 帧（`WiFiDeviceDiscovery.ts:573` 附近）。
       * 注意：那里用的是 `new OutputPacket().addByte(0)` + `serialize()`，
       * **即正确的固件协议**。所以 D1 应该能过 —— 发现链路是对的。
       */
      // 从 `out/e2e-libs/` 取产品类（见 `loadProductModule` 的说明）
      let WiFiDeviceDiscovery = null;
      try {
        ({ WiFiDeviceDiscovery } = loadProductModule("services/WiFiDeviceDiscovery"));
      } catch (error) {
        oracles.record(
          "product-scanner-available",
          "blocked",
          `未找到 out/e2e-libs/services/WiFiDeviceDiscovery.js —— 先跑 npm run build:e2e-libs（${String(error && error.message)}）`
        );
        return;
      }
      if (typeof WiFiDeviceDiscovery !== "function") {
        oracles.record(
          "product-scanner-available",
          "blocked",
          "out/e2e-libs/services/WiFiDeviceDiscovery.js 未导出 WiFiDeviceDiscovery"
        );
        return;
      }

      const scanner = new WiFiDeviceDiscovery();
      const before = device.stats.idRequests;

      /**
       * ⚠️ **发现一处产品缺陷**（本场景顺带记录，不改它）：
       *   `scanForDevices` 接受 `ipRange` 入参并归一化（`WiFiDeviceDiscovery.ts:169-170`），
       *   但**实际扫描范围来自 `getLocalNetworkRanges()`**（`:207`），
       *   `config.ipRange` 从头到尾没被读过 ⇒ **该参数是死的**。
       *
       * ⇒ 无法用入参把扫描收窄到本机。这里改用产品**公开的**单点能力：
       *   `refreshDevice(ip, port)` → 内部走 `verifyPicoDevice`（`:798`）。
       * 这是我们能拿到的最贴近"产品发现设备"的路径，且不需要扫 254 个 IP。
       *
       * 代价（必须写明）：它**跳过了 `isPortOpen` 这层**，只验握手。
       * 因此本判据证明的是「产品的握手解析正确」，不是「端口探测正确」。
       */
      const hit = await withTimeout(
        scanner.refreshDevice(device.host, device.port),
        10000,
        "产品 refreshDevice"
      ).catch(e => ({ error: e.message }));

      if (hit && hit.error) {
        oracles.record(
          "product-discovers-mock",
          "fail",
          `产品 refreshDevice 调用失败：${hit.error}`
        );
      } else {
        oracles.record(
          "product-discovers-mock",
          hit ? "pass" : "fail",
          hit
            ? `产品握手成功：${hit.ipAddress}:${hit.port} 版本 ${hit.version}`
            : `产品未握手成功（设备期间收到 ${device.stats.idRequests - before} 次 ID 请求）`
        );

        // ---- D2：握手内容正确 ----
        if (hit) {
          const versionOk = String(hit.version || "").includes("LOGIC_ANALYZER");
          const confirmedOk = hit.verificationStatus === "confirmed";
          oracles.record(
            "handshake-content-matches",
            versionOk && confirmedOk ? "pass" : "fail",
            `产品解析：version=${hit.version} verificationStatus=${hit.verificationStatus} ` +
              `（设备自报 ID=${DEVICE_ID_LINE}）`
          );
        }
      }

      // ---- D6/D7/D8：**经 Webview 侧栏**连接 + 心跳 + 驱动契约（项 8 主路径）----
      //
      // 这一段的观测点是「用户真实点击那条路」：真宿主里打开 Custom Editor，
      // 侧栏填 host:port → 点「网络」→ 等 UI 显示已连接 → 点「开始采集」。
      //
      // ⚠️ 心跳间隔要能被 e2e 等：`heartbeatIntervalMs` 的 manifest minimum 是 1000，
      //    所以设 1000ms（不是 500，否则 VS Code 会按 minimum 钳制住）。
      //    用 waitFor 轮询设备侧字节增长，不用固定 sleep（固定 sleep 是 flaky 来源）。
      const HEARTBEAT_INTERVAL_MS = 1000;
      await vscode.workspace
        .getConfiguration("logicAnalyzer.network")
        .update("heartbeatIntervalMs", HEARTBEAT_INTERVAL_MS, vscode.ConfigurationTarget.Workspace);

      // ⚠️ 判据必须是**相对增量**，不能用绝对阈值（`>= 2`）：
      //    本场景前面 D1 发现链路与后面 D3/D4/D5 驱动直连都会建连接，
      //    删掉 `networkService.connect()` 后总数只是 4→3，`>=2` 仍然过 ⇒ **假绿**。
      //    实测就是这么发现的（M1 变异时该判据没红，只有心跳红了）。
      const connectionsBeforeWebview = device.stats.connections;

      let webviewState = null;
      let webviewError = null;
      {
        const fixtureSource = resolve(
          __dirname,
          "../../../../fixtures/lac/current-lowercase-samples.lac"
        );
        const targetFileName = "network_capture_mock_webview.lac";
        const targetFilePath = join(workspaceDir, targetFileName);
        copyFileSync(fixtureSource, targetFilePath);
        const fileUri = vscode.Uri.file(targetFilePath);

        try {
          await withTimeout(
            vscode.commands.executeCommand("vscode.open", fileUri),
            30000,
            "vscode.open"
          );

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
            /* 下方统一判 */
          }
          if (!tabInfo) throw new Error("未找到 custom editor tab");

          const networkSelector = 'input[placeholder="192.168.1.100:4045"]';
          const actions = [
            { type: "waitForElement", selector: networkSelector, timeoutMs: 15000 },
            { type: "input", selector: networkSelector, value: `${device.host}:${device.port}` },
            { type: "readValue", selector: networkSelector },
            // ⚠️ 唯一正确的选择器，详见文件头「DOM 选择器」段
            {
              type: "click",
              selector: ".connection-fields .el-input:nth-of-type(2) .el-input-group__append button",
            },
            { type: "sleep", ms: 1500 },
            { type: "readTextOptional", selector: ".app-sidebar-left__summary" },
            { type: "countElements", selector: "button.connection-fields__disconnect:not([disabled])" },
            { type: "countElements", selector: '[data-testid="webview-start-capture-button"]:not([disabled])' },
            { type: "startCaptureMessages" },
            { type: "click", selector: '[data-testid="webview-start-capture-button"]' },
            { type: "sleep", ms: 5000 },
            { type: "stopCaptureMessages" },
            { type: "readTextOptional", selector: ".waveform-stage__meta" },
          ];

          webviewState = await withTimeout(
            vscode.commands.executeCommand("logicAnalyzer.__runEditorScenario", actions, {
              viewType: LAC_EDITOR_VIEW_TYPE,
              uri: fileUri.toString(),
            }),
            60000,
            "__runEditorScenario(webview network)"
          );
        } catch (error) {
          webviewError = String(error && error.message ? error.message : error);
        }
      }

      const webviewEvents = (webviewState && webviewState.events) || [];
      /**
       * ⚠️ 事件下标必须与 `actions` **逐项对齐**（`waitForElement` 也占一个位置，
       * 只是 result 为 undefined）。实测踩过一次：按「不产出 event」假设写错一位，
       * 把 summary 当成断开按钮数读了，得出"UI 未进入已连接态"的假红。
       *   [0] waitForElement
       *   [1] input
       *   [2] readValue
       *   [3] click
       *   [4] sleep
       *   [5] readTextOptional(summary)
       *   [6] countElements(disconnect)
       *   [7] countElements(capture button)
       */
      const inputValue = webviewEvents[2]?.result;
      const sidebarSummary = webviewEvents[5]?.result;
      const disconnectEnabled = webviewEvents[6]?.result;
      const captureEnabled = webviewEvents[7]?.result;
      const capturedMessages = (webviewState && webviewState.capturedMessages) || [];

      // ---- D6：Webview 侧栏连接链路 ----
      if (webviewError) {
        oracles.record("webview-connect-button-works", "fail", `驱动 Webview 失败：${webviewError}`);
      } else if (disconnectEnabled !== 1) {
        oracles.record(
          "webview-connect-button-works",
          "fail",
          `点「网络」后 UI 未进入已连接态（断开按钮可用数=${disconnectEnabled}，summary=${JSON.stringify(sidebarSummary)}）`
        );
      } else {
        oracles.record(
          "webview-connect-button-works",
          "pass",
          `侧栏填 ${JSON.stringify(inputValue)} 点「网络」后 UI 显示已连接（summary=${JSON.stringify(sidebarSummary).slice(0, 80)}）`
        );
      }

      // ---- D7：StabilityService 在本次 Webview 连接里真的建了连接 ----
      //
      // 一次成功的 Webview「网络」点击会产生 **2 条** 新连接：
      //   ① `NetworkStabilityService.connect()`（心跳/质量监控用）
      //   ② `hardwareDriverManager.connectToDevice('network', ...)`（驱动）
      // 删掉 ① 后增量会掉到 1 ⇒ 本判据红。用增量而不是总数，避免被其它阶段的
      // 连接数冲淡（M1 变异实测过：总数 4→3 时 `>=2` 没红，是假绿）。
      const connectionsAdded = device.stats.connections - connectionsBeforeWebview;
      if (connectionsAdded >= 2) {
        oracles.record(
          "stability-service-connected",
          "pass",
          `本次 Webview 连接新增 ${connectionsAdded} 条 TCP 连接（StabilityService + 驱动）`
        );
      } else {
        oracles.record(
          "stability-service-connected",
          "fail",
          `本次 Webview 连接只新增 ${connectionsAdded} 条 TCP 连接（期望 2）—— ` +
            `NetworkStabilityService.connect() 未被调用`
        );
      }

      // ---- D7b：心跳字节真的被发出（waitFor 轮询，不用固定 sleep）----
      //
      // ⚠️ 等待窗口必须**小于默认心跳间隔 5000ms**，否则「配置没接线、用了默认值」
      //    也会在这段时间内发出一次心跳 ⇒ 判据假绿。
      //    实测踩过（M2 变异）：窗口给 5s + 默认间隔 5s，恰好在边界收到 2 字节，判据没红。
      //    ⇒ 窗口 = 配置间隔的 2 倍（2s），远小于默认 5s；配置真生效时至少能收到 1–2 次。
      const heartbeatBaseline = device.stats.heartbeatBytes || 0;
      let heartbeatObserved = device.stats.heartbeatBytes || 0;
      try {
        await waitFor(
          () => {
            heartbeatObserved = device.stats.heartbeatBytes || 0;
            return heartbeatObserved > heartbeatBaseline;
          },
          HEARTBEAT_INTERVAL_MS * 2,
          "设备侧收到心跳字节"
        );
      } catch {
        /* 下方统一判 */
      }
      if (heartbeatObserved > heartbeatBaseline) {
        oracles.record(
          "heartbeat-reaches-device",
          "pass",
          `设备侧收到 ${heartbeatObserved} 字节心跳（间隔配置 ${HEARTBEAT_INTERVAL_MS}ms）`
        );
      } else {
        oracles.record(
          "heartbeat-reaches-device",
          "fail",
          `设备侧未收到任何心跳字节 —— startHeartbeat() 未生效或 heartbeatIntervalMs 未接线`
        );
      }

      // ---- D8：驱动契约（设备侧看：驱动 socket 上收到的是固件帧，不是 JSON）----
      //
      // ⚠️ 判据里必须**扣掉心跳字节**：`discardedBytes` 同时包含
      //    ① StabilityService 的心跳 0x00（合法）
      //    ② 驱动发 JSON 的字节（缺陷）
      //    只看 discarded>0 会把正常心跳判成协议错误（实测假红过一次）。
      const framesDuringWebview = device.stats.frames.length;
      const nonHeartbeatDiscards = device.stats.discardedBytes - device.stats.heartbeatBytes;
      if (framesDuringWebview > 0 && nonHeartbeatDiscards <= 0) {
        oracles.record(
          "network-protocol-is-firmware-binary",
          "pass",
          `设备侧收到 ${framesDuringWebview} 个合法固件帧、非心跳丢弃 ${nonHeartbeatDiscards} 字节 ` +
            `（心跳 ${device.stats.heartbeatBytes} 字节已扣除）—— 走的是二进制协议驱动`
        );
      } else {
        oracles.record(
          "network-protocol-is-firmware-binary",
          "fail",
          `设备侧收到 ${framesDuringWebview} 个合法帧、非心跳丢弃 ${nonHeartbeatDiscards} 字节 —— ` +
            `产品发的不是固件二进制帧（见 D-9）`
        );
      }

      // ---- D9：采集由 Webview 触发，且 payload 与侧栏表单一致 ----
      const startCaptureMessage = capturedMessages.find(message => {
        const payload = message && message.payload;
        return message && message.command === "startCapture" && payload && payload.config;
      });
      const formConfig = startCaptureMessage && startCaptureMessage.payload.config;
      if (!startCaptureMessage) {
        oracles.record(
          "capture-config-matches-form",
          "fail",
          `Webview 未发出 startCapture（捕获消息 ${capturedMessages.length} 条）`
        );
      } else if (formConfig.frequency !== 1000000 || formConfig.channels.length !== 24) {
        oracles.record(
          "capture-config-matches-form",
          "fail",
          `payload.config 与侧栏表单不一致：frequency=${formConfig.frequency}, channels=${formConfig.channels.length}`
        );
      } else {
        oracles.record(
          "capture-config-matches-form",
          "pass",
          `Webview 发出的 payload.config：frequency=${formConfig.frequency}, ` +
            `channels=${formConfig.channels.length}（与侧栏表单一致）`
        );
      }

      // ---- D10：startQualityMonitoring 间隔 30s，e2e 等不了 ----
      //
      // ⚠️ 这里**不用 delegate**：runner 的 delegate 对账只认「另一个 e2e 场景的
      //    oracle」，而这条能力由 **jest 单测** 覆盖（`NetworkStabilityService.accurate.test.ts`
      //    的定时器用例），不在 e2e 场景清单里。硬塞一个不相干的承接场景
      //    （比如 network-scan）会让对账"通过"，但那正是 README 警告的
      //    「写个任意 coveredBy 就把覆盖率挪走」的免责声明形态。
    //    ⇒ 诚实记 not_exercised，并把承接方**具体到测试文件与用例**。
      oracles.record(
        "quality-monitoring",
        "not_exercised",
        "startQualityMonitoring 间隔 30s（NetworkStabilityService.ts:475-479），e2e 无法等待；" +
          "由 tests/unit/services/NetworkStabilityService.accurate.test.ts 的定时器用例覆盖"
      );

      // ---- D3/D4：产品主动发采集请求时，设备侧能否读懂 ----
      //
      // ⚠️ **必须走产品的驱动选择链路**（`HardwareDriverManager.connectToDevice`），
      //    不能自己 `new` 某个驱动类。
      //
      //    为什么（e2e 第一原则）：D-9 的修复点就在"网络设备指向哪个驱动类"这一层
      //    （`HardwareDriverManager` 的 `network-analyzer` 注册项）。若本场景仍旧
      //    `new NetworkLogicAnalyzerDriver(...)`，那就**绕过了被测的那一层** ——
      //    无论接线改没改，测试结果都一样，判据与缺陷失去因果。
      //
      //    实测证据（2026-11-04）：接线已改为 `LogicAnalyzerDriver`，但第一版本场景
      //    仍直接构造旧类 ⇒ `driver-connects` 继续红，**假红**（产品其实已修好）。
      const capturesBefore = device.stats.captureRequests;
      const discardsBefore = device.stats.discardedBytes;

      {
        let hardwareDriverManager = null;
        try {
          ({ hardwareDriverManager } = loadProductModule("drivers/HardwareDriverManager"));
        } catch (error) {
          oracles.record(
            "network-driver-available",
            "blocked",
            `未找到 out/e2e-libs/drivers/HardwareDriverManager.js —— 先跑 npm run build:e2e-libs（${String(error && error.message)}）`
          );
          return;
        }
        if (!hardwareDriverManager) {
          oracles.record(
            "network-driver-available",
            "blocked",
            "out/e2e-libs/drivers/HardwareDriverManager.js 未导出 hardwareDriverManager"
          );
          return;
        }

        // 产品真实入口：`connectToDevice('network', { networkConfig: { host, port } })`
        // （与 `extension.ts:641` 的 `connectToNetworkDevice` 同一条路径）
        const conn = await withTimeout(
          hardwareDriverManager.connectToDevice("network", {
            networkConfig: { host: device.host, port: device.port },
          }),
          15000,
          "connectToDevice(network)"
        ).catch(e => ({ success: false, error: e.message }));

        if (!conn || conn.success === false) {
          const errDetail = (conn && conn.error) || "connectToDevice 返回 success=false";
          oracles.record(
            "driver-connects",
            "fail",
            `连接失败：${errDetail} —— 产品网络设备驱动未按固件协议握手`
          );

          const discarded = device.stats.discardedBytes - discardsBefore;
          oracles.record(
            "device-received-capture-frame",
            "fail",
            `设备未收到任何合法帧；期间丢弃 ${discarded} 字节 —— ` +
              `产品驱动在握手阶段发的内容不是固件协议（应为 0x55 0xAA 帧）`
          );

          oracles.record(
            "driver-start-capture-outcome",
            "not_exercised",
            "因 connectToDevice 握手失败，未执行 startCapture"
          );
        } else {
          const driver = hardwareDriverManager.getCurrentDevice();
          const driverClassName = driver && driver.constructor && driver.constructor.name;

          oracles.record(
            "driver-connects",
            "pass",
            `产品驱动已连上 ${device.host}:${device.port}（driver=${driverClassName}）`
          );

          // ⚠️ 这条判据锁死 D-9：网络设备必须解析成 LogicAnalyzerDriver。
          //    若将来有人改回 NetworkLogicAnalyzerDriver，它会立刻红。
          oracles.record(
            "network-uses-shared-protocol-driver",
            driverClassName === "LogicAnalyzerDriver" ? "pass" : "fail",
            driverClassName === "LogicAnalyzerDriver"
              ? "网络设备使用 LogicAnalyzerDriver（与串口共用固件二进制协议）"
              : `网络设备使用了 ${driverClassName} —— 应为 LogicAnalyzerDriver（见 D-9）`
          );

          try {
            // ⚠️ `CaptureSession` 的字段是顶层 `preTriggerSamples` / `postTriggerSamples`
            //    （见 `LogicAnalyzerDriver.startCapture` 与下方 D5 段）。
            //    曾经这里错用 `captureConfig: {...}` 嵌套形态 ⇒ 产品读不到 pre/post
            //    ⇒ `validateSettings` 返回 false ⇒ `startCapture` 返回 `BadParams`，
            //    设备侧一个字节都收不到（假红：误以为是协议问题）。
            const pre = 16;
            const post = 32;
            const session = {
              totalSamples: pre + post,
              preTriggerSamples: pre,
              postTriggerSamples: post,
              frequency: 1000000,
              loopCount: 0,
              measureBursts: false,
              triggerType: 0,
              triggerChannel: 0,
              triggerInverted: false,
              captureChannels: [
                { channelNumber: 0, channelName: "CH0", samples: [] },
                { channelNumber: 1, channelName: "CH1", samples: [] },
              ],
            };

            const err = await withTimeout(
              driver.startCapture(session),
              10000,
              "driver.startCapture"
            ).catch(e => ({ error: e.message }));

            // 等设备侧收到（给一点时间冲刷）
            await new Promise(r => setTimeout(r, 500));

            const gotCapture = device.stats.captureRequests > capturesBefore;
            const discarded = device.stats.discardedBytes - discardsBefore;

            /**
             * ⚠️ 这两个判据**故意分开**，因为它们失败的含义不同：
             *   - 设备收到 CAPTURE 帧 ⇒ 协议对齐（D3 pass）
             *   - 设备只收到垃圾字节 ⇒ 协议不匹配（D3 fail，且 D5 指出根因）
             */
            oracles.record(
              "device-received-capture-frame",
              gotCapture ? "pass" : "fail",
              gotCapture
                ? `设备收到 CAPTURE_REQUEST 帧（命令字节 ${CMD_CAPTURE}）`
                : `设备未收到任何合法帧；期间丢弃 ${discarded} 字节 —— ` +
                  `产品发的不是固件协议（应为 0x55 0xAA 帧）`
            );

            if (gotCapture) {
              const last = device.stats.frames[device.stats.frames.length - 1];
              const req = last && last.payload;
              oracles.record(
                "capture-request-decodable",
                req && req.length > 0 ? "pass" : "fail",
                `设备侧解出 CAPTURE_REQUEST，载荷 ${req ? req.length : 0} 字节`
              );
            }

            /**
             * ⚠️ 判据维度纠正（2026-11-04）：
             *
             * `CaptureError.None` 的值是**字符串 `'None'`**（`AnalyzerTypes.ts:23`），
             * 不是数字 0。原判据 `err !== 0 && typeof err !== "number"` 对 `'None'`
             * 恒为 true ⇒ **成功也报 not_exercised，这条永远不可能 pass**。
             *
             * 正确判据：只有 `'None'` 才是"采集启动成功"；其余都是具体错误码。
             */
            const captureErrorNone = "None";
            const isStartOk = err === captureErrorNone;
            oracles.record(
              "driver-start-capture-outcome",
              isStartOk ? "pass" : "fail",
              isStartOk
                ? "driver.startCapture 返回 CaptureError.None（采集启动成功）"
                : `driver.startCapture 返回 ${JSON.stringify(err)}（非 None ⇒ 启动失败）`
            );
          } finally {
            // 走产品的断开路径，避免把连接留给下一个场景
            if (typeof hardwareDriverManager.disconnectCurrentDevice === "function") {
              await hardwareDriverManager.disconnectCurrentDevice().catch(() => {});
            } else if (driver && typeof driver.disconnect === "function") {
              await driver.disconnect().catch(() => {});
            }
          }
        }
      }

      // ---- D5：**真采集**能否在 TCP 上完成 ----
      //
      // ⚠️ 这一段是回答「TCP 到底能不能真采集」这个问题的**唯一**证据。
      //
      // 用 `LogicAnalyzerDriver`（不是 `NetworkLogicAnalyzerDriver`）：
      // 它同时支持串口与 `host:port` 网络（`LogicAnalyzerDriver.ts:87`
      // 用连接串里有没有 `:` 判定），且**发的是固件二进制帧**。
      //
      // 为什么不复用上面那个 NetworkDriver：它已经因 D-9 在 connect 阶段失败，
      // 根本走不到采集。若这里再失败，就分不清「TCP 采集本身有问题」还是
      // 「D-9 导致的问题」—— 判据会失去独立性。
      {
        // 同 `loadProductModule` 的理由：一律走 `out/e2e-libs/`，不依赖 CLI 依赖链的巧合。
        let LogicAnalyzerDriverClass = null;
        try {
          ({ LogicAnalyzerDriver: LogicAnalyzerDriverClass } = loadProductModule(
            "drivers/LogicAnalyzerDriver"
          ));
        } catch (error) {
          oracles.record(
            "capture-driver-available",
            "blocked",
            `未找到 out/e2e-libs/drivers/LogicAnalyzerDriver.js —— 先跑 npm run build:e2e-libs（${String(error && error.message)}）`
          );
          return;
        }
        if (typeof LogicAnalyzerDriverClass !== "function") {
          oracles.record(
            "capture-driver-available",
            "blocked",
            "out/e2e-libs/drivers/LogicAnalyzerDriver.js 未导出 LogicAnalyzerDriver"
          );
          return;
        }

        const connStr = `${device.host}:${device.port}`;
        const captureDriver = new LogicAnalyzerDriverClass(connStr);

        try {
          const conn = await withTimeout(
            captureDriver.connect({}),
            20000,
            "LogicAnalyzerDriver.connect"
          ).catch(e => ({ success: false, error: e.message }));

          if (!conn || conn.success === false) {
            oracles.record(
              "tcp-handshake-via-firmware-protocol",
              "fail",
              `LogicAnalyzerDriver 连接 ${connStr} 失败：${(conn && conn.error) || "unknown"}`
            );
          } else {
            oracles.record(
              "tcp-handshake-via-firmware-protocol",
              "pass",
              `LogicAnalyzerDriver 用二进制帧握手成功（version=${captureDriver.deviceVersion}, ` +
                `channels=${captureDriver.channelCount}）`
            );

            const pre = 16;
            const post = 32;
            const session = {
              totalSamples: pre + post,
              preTriggerSamples: pre,
              postTriggerSamples: post,
              frequency: 1000000,
              loopCount: 0,
              measureBursts: false,
              triggerType: 0,
              triggerChannel: 0,
              triggerInverted: false,
              captureChannels: [
                { channelNumber: 0, channelName: "CH0", samples: [] },
                { channelNumber: 1, channelName: "CH1", samples: [] },
              ],
            };

            const completed = await withTimeout(
              new Promise(resolve => {
                captureDriver
                  .startCapture(session, args => resolve(args))
                  .then(err => {
                    if (err !== 0 && err !== "None") {
                      resolve({ success: false, error: `startCapture 返回 ${String(err)}` });
                    }
                  })
                  .catch(error => resolve({ success: false, error: String(error) }));
              }),
              20000,
              "LogicAnalyzerDriver.startCapture"
            ).catch(e => ({ success: false, error: e.message }));

            const samples =
              (completed && completed.session && completed.session.captureChannels) || [];
            const totalCaptured = samples.reduce(
              (n, ch) => n + ((ch.samples && ch.samples.length) || 0),
              0
            );

            if (!completed || completed.success === false) {
              oracles.record(
                "tcp-capture-completes",
                "fail",
                `采集未完成：${(completed && completed.error) || "unknown"}`
              );
            } else if (totalCaptured === 0) {
              // ⚠️ 关键反假绿：`success: true` + 零样本也算失败。
              //    产品会把「收到空数据」当成成功（`parseCaptureData` 读 sampleCount=0
              //    也能正常返回），若不查样本数，这条会假绿。
              oracles.record(
                "tcp-capture-completes",
                "fail",
                "采集回调 success=true 但通道样本数为 0 —— 设备回传的数据没有被解析进通道"
              );
            } else {
              oracles.record(
                "tcp-capture-completes",
                "pass",
                `TCP 采集完成，通道样本总数 ${totalCaptured}（期望 ${(pre + post) * 2}）`
              );

              // ---- 样本内容对账：拿**设备实际发出的字节**与产品解析结果逐位比 ----
              //
              // ⚠️ 为什么不用「非零样本数 > 0」这类魔法数字断言：
              //   1. 模拟器改了默认图案（`defaultSamplePattern`）就会误红，而产品没坏；
              //   2. 更关键 —— 若模拟器发**恒定高电平**（全 1），"非零数 = 样本数"
              //      同样成立，判据分不出「方波」与「直流」，测的维度 ≠ 声称测的维度。
              //
              // ⇒ 改成拿 `device.stats.sentSamples`（设备真实发出的整数值）按产品
              //    自己的位映射规则（`LogicAnalyzerDriver.ts:1027` 的
              //    `mask = 1 << channelIndex`，**按通道顺序而非 channelNumber**）
              //    还原期望序列，与产品解析出的 `channel.samples` 逐位比对。
              const sent = device.stats.sentSamples;
              if (!Array.isArray(sent) || sent.length === 0) {
                oracles.record(
                  "tcp-capture-sample-content",
                  "fail",
                  "设备侧未记录到已发送的样本（stats.sentSamples 为空）—— 判据无法对账"
                );
              } else {
                const mismatches = [];
                for (let channelIndex = 0; channelIndex < samples.length; channelIndex += 1) {
                  const ch = samples[channelIndex];
                  const got = (ch && ch.samples) || [];
                  // 产品侧位映射：第 i 个请求通道取第 i 位
                  const expected = sent.map(v => ((v >> channelIndex) & 1) ? 1 : 0);

                  if (got.length !== expected.length) {
                    mismatches.push(
                      `CH#${channelIndex}(ch${ch && ch.channelNumber}) 长度 ${got.length} ≠ 设备发出 ${expected.length}`
                    );
                    continue;
                  }
                  const firstBad = expected.findIndex((v, i) => v !== got[i]);
                  if (firstBad !== -1) {
                    mismatches.push(
                      `CH#${channelIndex}(ch${ch && ch.channelNumber}) 第 ${firstBad} 个样本 ` +
                        `产品=${got[firstBad]} / 设备发出位=${expected[firstBad]}（原始值 ${sent[firstBad]}）`
                    );
                  }
                }

                // 额外：设备发了多少样本，产品就该解析出多少
                if (sampleCountMismatch(samples, sent)) {
                  mismatches.push(
                    `样本总数不符：设备发 ${sent.length}，产品解析 ${samples[0].samples.length}`
                  );
                }

                oracles.record(
                  "tcp-capture-sample-content",
                  mismatches.length === 0 ? "pass" : "fail",
                  mismatches.length === 0
                    ? `${samples.length} 个通道 × ${sent.length} 样本与设备发出的字节逐位一致`
                    : `与设备发出的字节不一致：\n  - ${mismatches.join("\n  - ")}`
                );
              }
            }
          }
        } finally {
          await captureDriver.disconnect().catch(() => {});
        }
      }
    } finally {
      await device.close().catch(() => {});
    }
  },
};
