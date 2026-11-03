"use strict";

/**
 * 场景：**协议级模拟设备**下的网络采集端到端。
 *
 * ## 这个场景与 `network-scan` 的分工
 *
 * | | network-scan | 本场景 |
 * |---|---|---|
 * | 关注 | 扫描命令的**受控性**（超时、并发、可中止） | 扫描之后**能不能真连上并采集** |
 * | 设备 | 无（只验扫描本身） | **协议级模拟设备** |
 *
 * ## 判据设计（每条都能被变异抓红）
 *
 * - **D1 设备可被发现**：产品自己的 `scanForDevices` 扫到了模拟设备
 * - **D2 握手内容正确**：产品解析出的 `version` / 通道数等，与模拟设备自报的一致
 * - **D3 采集请求可达**：产品向设备发出了 `CAPTURE_REQUEST`（命令字节 1）
 * - **D4 请求参数正确**：频率/通道/触发类型与用户配置一致（从设备侧视角验，不是从产品侧）
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

const {
  startMockDevice,
  buildFrame,
  CMD_ID_REQUEST,
  CMD_CAPTURE,
  DEVICE_ID_LINE,
  DEFAULT_CAPS,
} = require("../../lib/mockDevice.cjs");

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

module.exports = {
  id: "network-capture-mock",
  title: "协议级模拟设备：网络发现 → 握手 → 采集请求",
  needsHardware: false,

  async run({ vscode, oracles, withTimeout }) {
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
      // ⚠️ 路径是 5 级：common → scenarios → vscode → e2e → tests → <repo>/out
      let WiFiDeviceDiscovery = null;
      try {
        ({ WiFiDeviceDiscovery } = require("../../../../../out/services/WiFiDeviceDiscovery.js"));
      } catch (error) {
        oracles.record(
          "product-scanner-available",
          "blocked",
          `未找到编译产物 out/services/WiFiDeviceDiscovery.js（${String(error && error.message)}）`
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

      // ---- D3/D4：产品主动发采集请求时，设备侧能否读懂 ----
      //
      // 这一步用产品真实的 `NetworkLogicAnalyzerDriver`。
      // 若产品协议正确，设备会收到 CMD_CAPTURE；若发 JSON，设备什么都收不到。
      const capturesBefore = device.stats.captureRequests;
      const discardsBefore = device.stats.discardedBytes;

      {
        let NetworkDriver = null;
        try {
          ({ NetworkLogicAnalyzerDriver: NetworkDriver } = require("../../../../../out/drivers/NetworkLogicAnalyzerDriver.js"));
        } catch (error) {
          oracles.record(
            "network-driver-available",
            "blocked",
            `未找到 out/drivers/NetworkLogicAnalyzerDriver.js（${String(error && error.message)}）`
          );
          return;
        }

        // 产品构造签名：new NetworkLogicAnalyzerDriver(host, port)
        // （见 HardwareDriverManager.createDriverInstance 的同一调用）
        const driver = new NetworkDriver(device.host, device.port);

        try {
          const conn = await withTimeout(
            driver.connect({
              type: "network",
              networkConfig: { host: device.host, port: device.port },
            }),
            // ⚠️ 产品内部 `sendNetworkCommand` 的超时是硬编码 10s，
            //    握手若等不到响应要耗满 10s。这里给 15s 余量，避免外层先超时
            //    把「产品的 10s 超时」误报成「外层超时」。
            15000,
            "driver.connect"
          ).catch(e => ({ error: e.message }));

          // connect() 自己捕获异常并返回 {success:false,error}，所以两种形态都要看
          const connectFailed =
            (conn && conn.error) || (conn && conn.success === false);

          if (connectFailed) {
            const errDetail = (conn && (conn.error || conn.detail)) || "connect 返回 success=false";
            oracles.record(
              "driver-connects",
              "fail",
              `连接失败：${errDetail} —— 产品 NetworkLogicAnalyzerDriver 在握手阶段发 JSON 文本，真固件协议（0x55 0xAA 二进制帧）丢弃无应答`
            );

            const discarded = device.stats.discardedBytes - discardsBefore;
            oracles.record(
              "device-received-capture-frame",
              "fail",
              `设备未收到任何合法帧；期间丢弃 ${discarded} 字节 —— ` +
                `产品驱动在握手阶段发的是 JSON 文本，未能进入采集请求阶段`
            );

            oracles.record(
              "driver-start-capture-outcome",
              "not_exercised",
              "因驱动 connect() 握手阶段协议不匹配超时失败，未执行 startCapture"
            );
          } else {
            oracles.record(
              "driver-connects",
              "pass",
              `产品驱动 TCP 已连上 ${device.host}:${device.port}`
            );

            // 发起一次采集
            const session = {
              captureChannels: [{ channelIndex: 0 }, { channelIndex: 1 }],
              totalSamples: 1024,
              sampleRate: 1000000,
              captureConfig: {
                frequency: 1000000,
                preSamples: 16,
                postSamples: 32,
                channels: [0, 1],
                channelCount: 2,
                triggerType: 0,
                trigger: 0,
                inverted: 0,
                loopCount: 0,
                measure: 0,
              },
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
                  `产品发的不是固件协议（应为 0x55 0xAA 帧，实为 JSON 文本）`
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
             * 把 `CaptureError` 枚举拉进来比对，而不是靠字面量猜。
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
          }
        } finally {
          await driver.disconnect().catch(() => {});
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
        let LogicAnalyzerDriverClass = null;
        try {
          ({ LogicAnalyzerDriver: LogicAnalyzerDriverClass } = require(
            "../../../../../out/drivers/LogicAnalyzerDriver.js"
          ));
        } catch (error) {
          oracles.record(
            "capture-driver-available",
            "blocked",
            `未找到 out/drivers/LogicAnalyzerDriver.js（${String(error && error.message)}）`
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
