"use strict";

/**
 * 协议级模拟设备（TCP）—— 严格按**真实固件**的线协议实现。
 *
 * ## 为什么按固件实现，而不是按产品实现
 *
 * 这是本项目 e2e 第一原则的直接应用：
 * **模拟器扮演的是"设备"，产品扮演的是"被测方"**。
 * 若照产品当前的网络驱动来实现，等于拿产品的错误协议当基准 ——
 * 产品错了，模拟器会配合它一起错，测试永远绿。
 *
 * ⇒ 模拟器的唯一真值是 `logicanalyzer/Firmware/LogicAnalyzer_V2/` 的 C 源码。
 *
 * ## 真实固件协议（逐条对应源码，非推测）
 *
 * ### 请求帧（`AnalyzerDriverBase.ts:183` 序列化 / `LogicAnalyzer.c:209` 解析）
 * ```
 * 0x55 0xAA  [命令字节] [载荷……]  0xAA 0x55
 * ```
 * 载荷转义：`0xAA / 0x55 / 0xF0` → `0xF0, (原值 ^ 0xF0)`
 * （`LogicAnalyzer.c:228-245` 的解转义是这个的逆运算）
 *
 * ### 命令字节（`LogicAnalyzer.c:252` 起的 switch）
 * - `0`   ID 请求 → 回 5 行文本（`LogicAnalyzer.c:254-264`）
 * - `1`   采集请求 → 载荷是 `CAPTURE_REQUEST` 结构体（`LogicAnalyzer_Structs.h:9`）
 * - `2`   更新 WiFi 设置（`USE_CYGW_WIFI` 时才编译）
 *
 * ### 响应（`LogicAnalyzer.c:149` sendResponse）
 * **全是文本行**，`\n` 结尾。注意：请求是二进制的，响应是文本的 ——
 * 这是固件真实行为，不是笔误。
 *
 * ## ⚠️ 本模拟器**故意不迁就**产品网络驱动
 *
 * 实测发现 `NetworkLogicAnalyzerDriver.ts:701` 发的是
 * `JSON.stringify({command:'START_CAPTURE',...})` —— **文本 JSON**。
 * 而固件 `LogicAnalyzer.c:209` 第一个字节不是 `0x55` 就直接 `bufferPos = 0` 丢弃。
 *
 * ⇒ 产品发 JSON 到这里，模拟器会**如实不回**（和真固件一样）。
 * 这样测试会红，暴露真实缺陷 —— 这正是它的价值。
 *
 * 若要让它变绿，正确做法是**改产品**（网络驱动改用 OutputPacket），
 * 而不是让模拟器去解析 JSON。
 */

const { createServer } = require("node:net");

// ---- 固件协议常量（对齐 LogicAnalyzer.c / LogicAnalyzer_Structs.h）----

/** 帧起始标记。 */
const FRAME_START = [0x55, 0xaa];
/** 帧结束标记。 */
const FRAME_END = [0xaa, 0x55];
/** 转义字节。 */
const ESCAPE = 0xf0;

/** 命令字节（`LogicAnalyzer.c` 的 switch）。 */
const CMD_ID_REQUEST = 0;
const CMD_CAPTURE = 1;
const CMD_WIFI_SETTINGS = 2;

/**
 * 设备自报的 ID 行内容。
 *
 * 固件原文：`sendResponse("LOGIC_ANALYZER_"BOARD_NAME"_"FIRMWARE_VERSION"\n", fromWiFi)`
 * （`LogicAnalyzer.c:257`）
 *
 * 产品侧用 `VersionValidator.getVersion()` 校验（`WiFiDeviceDiscovery.ts:614`），
 * 必须能被它认成合法版本。格式取 `LOGIC_ANALYZER_<board>_<version>`。
 */
const DEVICE_ID_LINE = "LOGIC_ANALYZER_V2_1.7.0";

/** 设备能力（对应固件的 MAX_FREQ / MAX_BLAST_FREQ / CAPTURE_BUFFER_SIZE / MAX_CHANNELS）。 */
const DEFAULT_CAPS = {
  maxFreq: 100000000, // MAX_FREQ
  maxBlastFreq: 200000000, // MAX_BLAST_FREQ
  bufferSize: 131072, // CAPTURE_BUFFER_SIZE
  channels: 24, // MAX_CHANNELS
};

/**
 * 把字节数组按固件规则转义。
 *
 * 对应 `AnalyzerDriverBase.ts:190-205`（产品侧序列化）与
 * `LogicAnalyzer.c:228-245`（固件侧解转义）。
 */
function escapePayload(bytes) {
  const out = [];
  for (const byte of bytes) {
    if (byte === 0xaa || byte === 0x55 || byte === 0xf0) {
      out.push(ESCAPE, byte ^ ESCAPE);
    } else {
      out.push(byte);
    }
  }
  return out;
}

/** 组装一整帧。 */
function buildFrame(commandByte, payload = []) {
  return Buffer.from([
    ...FRAME_START,
    commandByte,
    ...escapePayload(payload),
    ...FRAME_END,
  ]);
}

/**
 * 从字节流里解出完整帧。
 *
 * 严格照固件 `processData()` 的判定：
 *   - 第 1 字节必须是 0x55，否则重来
 *   - 第 2 字节必须是 0xAA，否则重来
 *   - 见到 ...0xAA 0x55 即为一帧结束
 *
 * @returns {{ frames: Array<{command:number, payload:number[]}>, rest: Buffer }}
 */
function extractFrames(buffer) {
  const frames = [];
  let i = 0;

  while (i < buffer.length) {
    // 找起始 0x55
    if (buffer[i] !== 0x55) {
      i += 1;
      continue;
    }
    if (i + 1 >= buffer.length) break; // 半个头，等更多数据
    if (buffer[i + 1] !== 0xaa) {
      i += 1;
      continue;
    }

    // 找结束 0xAA 0x55
    let end = -1;
    for (let j = i + 2; j + 1 < buffer.length; j += 1) {
      if (buffer[j] === 0xaa && buffer[j + 1] === 0x55) {
        end = j;
        break;
      }
    }
    if (end === -1) break; // 帧还没收全

    // 帧体 = 起点后两位到 end 之间
    const rawBody = buffer.subarray(i + 2, end);
    // 解转义（固件 LogicAnalyzer.c 的反向操作）
    const body = [];
    for (let k = 0; k < rawBody.length; k += 1) {
      if (rawBody[k] === ESCAPE && k + 1 < rawBody.length) {
        body.push(rawBody[k + 1] ^ ESCAPE);
        k += 1;
      } else {
        body.push(rawBody[k]);
      }
    }

    if (body.length > 0) {
      frames.push({ command: body[0], payload: body.slice(1) });
    }
    i = end + 2;
  }

  return { frames, rest: buffer.subarray(i) };
}

/**
 * 解码 `CAPTURE_REQUEST`（`LogicAnalyzer_Structs.h:9`）。
 *
 * ## ⚠️ 必须按 C ABI 的**对齐填充**解码，不能按字段声明顺序紧排
 *
 * `sizeof(CAPTURE_REQUEST)` = **48**（`AnalyzerDriverBase.ts:341` 的注释与实测一致）。
 * 按 ARM/RP2040 默认 C ABI：
 * ```
 * [0]  uint8_t  triggerType
 * [1]  uint8_t  trigger
 * [2]  union { uint8_t inverted; uint8_t count; }
 * [3]  padding                      ← uint16 需要 2 字节对齐
 * [4]  uint16_t triggerValue        (LE)
 * [6]  uint8_t  channels[24]
 * [30] uint8_t  channelCount
 * [31] padding                      ← uint32 需要 4 字节对齐
 * [32] uint32_t frequency           (LE)
 * [36] uint32_t preSamples          (LE)
 * [40] uint32_t postSamples         (LE)
 * [44] uint8_t  loopCount           ← 注意是 1 字节，不是 u32！
 * [45] uint8_t  measure
 * [46] uint8_t  captureMode
 * [47] padding                      ← 结构体按最大成员对齐，尾补 1 字节
 * ```
 *
 * **实测证据**（用产品自己的 `CaptureRequest.serialize()` 输出 48 字节，
 * 见 `_selftest-mockDevice.cjs` 第 11 条）：
 * ```
 * [0]=0 [1]=3 [2]=0 [3]=0 [4]=1 [5]=0 [6..29]=channels
 * [30]=4 [31]=0 [32]=64 [33]=66 [34]=15 [35]=0   ← freq=1000000
 * [36]=16 [37..39]=0                              ← pre=16
 * [40]=32 [41..43]=0                              ← post=32
 * [44]=0 [45]=0 [46]=0 [47]=0
 * ```
 * ⚠️ 第一版按"字段声明顺序紧排"解码，把 `preSamples` 读成了
 * `0x0F4240`（=1000000）量级的巨值，模拟器据此回传了 3MB 假样本流 ——
 * 是**静默错位**，不会报错，只会让结论全错。
 */
const CAPTURE_REQUEST_SIZE = 48;

function decodeCaptureRequest(payload) {
  if (!payload || payload.length < CAPTURE_REQUEST_SIZE) return null;

  const u8 = i => payload[i];
  const u16le = i => payload[i] | (payload[i + 1] << 8);
  const u32le = i =>
    (payload[i] | (payload[i + 1] << 8) | (payload[i + 2] << 16) | (payload[i + 3] << 24)) >>> 0;

  const triggerType = u8(0);
  const trigger = u8(1);
  const invertedOrCount = u8(2);
  // [3] padding
  const triggerValue = u16le(4);
  const channels = Array.from(payload.slice(6, 30));
  const channelCount = u8(30);
  // [31] padding
  const frequency = u32le(32);
  const preSamples = u32le(36);
  const postSamples = u32le(40);
  const loopCount = u8(44);
  const measure = u8(45);
  const captureMode = u8(46);

  return {
    triggerType,
    trigger,
    invertedOrCount,
    triggerValue,
    channels: Array.from(channels).slice(0, channelCount),
    channelCount,
    frequency,
    preSamples,
    postSamples,
    loopCount,
    measure,
    captureMode,
  };
}

/**
 * 组装一份 `CAPTURE_REQUEST` 载荷（48 字节，含 C ABI 对齐填充）。
 *
 * 与 `decodeCaptureRequest` 是同一布局的逆运算。测试里应当**用它构造**而不是
 * 手写字节数组 —— 手写极易漏掉 `[3]` / `[31]` / `[47]` 三处 padding
 * （第一版就是这样写错的，导致自测自己解码出错位值）。
 *
 * @param {object} [f]
 */
function buildCaptureRequest(f = {}) {
  const buf = Buffer.alloc(CAPTURE_REQUEST_SIZE, 0);
  buf.writeUInt8((f.triggerType ?? 0) & 0xff, 0);
  buf.writeUInt8((f.trigger ?? 0) & 0xff, 1);
  buf.writeUInt8((f.invertedOrCount ?? 0) & 0xff, 2);
  // [3] padding
  buf.writeUInt16LE((f.triggerValue ?? 0) & 0xffff, 4);
  const chs = f.channels ?? [];
  for (let i = 0; i < 24; i += 1) {
    buf.writeUInt8((chs[i] ?? 0) & 0xff, 6 + i);
  }
  buf.writeUInt8((f.channelCount ?? Math.min(chs.length, 24)) & 0xff, 30);
  // [31] padding
  buf.writeUInt32LE((f.frequency ?? 0) >>> 0, 32);
  buf.writeUInt32LE((f.preSamples ?? 0) >>> 0, 36);
  buf.writeUInt32LE((f.postSamples ?? 0) >>> 0, 40);
  buf.writeUInt8((f.loopCount ?? 0) & 0xff, 44);
  buf.writeUInt8((f.measure ?? 0) & 0xff, 45);
  buf.writeUInt8((f.captureMode ?? 0) & 0xff, 46);
  // [47] padding
  return Array.from(buf);
}

/**
 * 把一次采集的样本数据编码成固件回传格式（**二进制流，不是帧**）。
 *
 * 对应固件 `LogicAnalyzer.c:606-729`（`capturing` 且 `!IsCapturing()` 分支）：
 * ```
 * [4 字节 length（小端）] [length × bytesPerSample 字节样本] [1 字节 stampsLength]
 * [stampsLength > 1 时：stampsLength × 4 字节时间戳]
 * ```
 * ⚠️ `length` 的单位是**样本数**，产品侧 `readNetworkCaptureData` 会再乘
 * `bytesPerSample`（`LogicAnalyzerDriver.ts:729`）—— 与固件 `:645-656` 的
 * `length *= 2/4` 是同一件事，只是产品在上层换算。
 *
 * `bytesPerSample` 由通道模式决定（固件 `mode`）：
 * `MODE_8_CHANNEL=0→1字节`、`MODE_16_CHANNEL=1→2字节`、`MODE_24_CHANNEL=2→4字节`。
 *
 * @param {object} req `decodeCaptureRequest()` 的结果
 * @param {object} [opts]
 * @param {(i:number)=>number} [opts.sample] 第 i 个样本的取值生成器（默认锯齿方波）
 * @returns {Buffer}
 */
function buildCaptureResponse(req, opts = {}) {
  // 通道模式：产品侧 `getCaptureMode()` 与固件一致（<8 通道→8bit，<16→16bit，其余 24bit）
  const maxChannel = req && req.channels && req.channels.length
    ? Math.max(...req.channels, 0)
    : 0;
  const mode = maxChannel < 8 ? 0 : maxChannel < 16 ? 1 : 2;
  const bytesPerSample = mode === 0 ? 1 : mode === 1 ? 2 : 4;

  const pre = (req && req.preSamples) || 0;
  const post = (req && req.postSamples) || 0;
  const loop = (req && req.loopCount) || 0;
  const totalSamples = pre + post * (loop + 1);

  const sampleGen = opts.sample || defaultSamplePattern;
  const sampleCount = Math.max(0, totalSamples);

  const header = Buffer.alloc(4);
  header.writeUInt32LE(sampleCount, 0);

  const body = Buffer.alloc(sampleCount * bytesPerSample);
  const packed = new Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    const value = sampleGen(i) >>> 0;
    packed[i] = value;
    if (mode === 0) body.writeUInt8(value & 0xff, i);
    else if (mode === 1) body.writeUInt16LE(value & 0xffff, i * 2);
    else body.writeUInt32LE(value, i * 4);
  }

  // stampsLength：默认 0（无时间戳），与固件 `if(stampsLength > 1)` 的分支对应
  const stampsLength = 0;
  const tail = Buffer.from([stampsLength]);

  return { buffer: Buffer.concat([header, body, tail]), packed, sampleCount, mode };
}

/**
 * 默认样本图案：方波（每 8 个样本翻转一次），保证非零且**有明显跳变**。
 *
 * 为什么不能全 0：产品侧 `parseCaptureData` 会统计 `nonZero` / `transitions`
 * （`LogicAnalyzerDriver.ts:899-918`），全 0 会让"收到数据"与"收到零填充"
 * 无法区分 —— 那正是我们要避免的假绿。
 */
function defaultSamplePattern(i) {
  const bit = Math.floor(i / 8) % 2;
  // 低 4 位做一个递增计数，让数值有辨识度（便于断言首样本/末样本）
  return (bit ? 0x0f : 0x00) | (i % 8);
}

/**
 * 起一个模拟设备。
 *
 * @param {object} [options]
 * @param {number} [options.port] 监听端口，0 = 随机（测试用）
 * @param {string} [options.host] 监听地址，默认 127.0.0.1
 * @param {object} [options.caps] 设备能力，默认 DEFAULT_CAPS
 * @param {boolean} [options.sendCaptureData] 收到 CAPTURE 后是否回传样本数据（默认 true）
 * @param {(i:number)=>number} [options.sample] 样本取值生成器
 * @param {(evt:object)=>void} [options.onEvent] 收到命令时的回调（供测试观察）
 * @returns {Promise<{port:number, host:string, close:()=>Promise<void>, stats:object}>}
 */
function startMockDevice(options = {}) {
  const host = options.host || "127.0.0.1";
  const caps = { ...DEFAULT_CAPS, ...(options.caps || {}) };
  const onEvent = options.onEvent || (() => {});
  const sendCaptureData = options.sendCaptureData !== false;
  const sample = typeof options.sample === "function" ? options.sample : defaultSamplePattern;

  const stats = {
    connections: 0,
    idRequests: 0,
    captureRequests: 0,
    wifiSettings: 0,
    /** 收到的原始帧（供测试断言"产品到底发了什么"）。 */
    frames: [],
    /** 被丢弃的非帧字节数（产品发 JSON 时会全部落在这里）。 */
    discardedBytes: 0,
    /**
     * 收到的**独立 0x00 心跳字节**数。
     *
     * `NetworkStabilityService.sendHeartbeat()` 发的是 `Buffer.from([0x00])`，
     * 它不是固件帧，会被 `extractFrames` 跳过并计进 `discardedBytes`。
     * 但「有丢失字节」既可能是心跳、也可能是产品发 JSON —— 两者含义完全不同，
     * 所以单独计数，供心率判据区分。
     */
    heartbeatBytes: 0,
    /** 回传采集样本流的次数（固件 `capturing` 分支）。 */
    captureDataSent: 0,
    /** 回传采集样本流的总字节数。 */
    captureDataBytes: 0,
    /**
     * **最后一次回传的原始样本值**（未按通道拆分，就是线上字节解出的整数）。
     *
     * 用途：让判据能"拿设备发了什么 ↔ 产品解析出什么"对账，
     * 而不是与 `36/48` 这类魔法数字比 —— 后者会随模拟器图案变化而误红。
     */
    sentSamples: null,
    /** 最后一次回传的样本个数。 */
    sentSampleCount: 0,
    /** 最后一次回传使用的通道模式（0=8bit / 1=16bit / 2=24bit）。 */
    sentMode: 0,
  };

  /**
   * 已建立的连接。
   *
   * ⚠️ 必须自己追踪：`server.close()` 只会停止 listen，
   * **不会断开已有连接**，只要还有一个 socket 挂着，close 回调就永不触发
   * ⇒ 场景 finally 里 `await device.close()` 会**永久挂死**（实测踩过）。
   */
  const sockets = new Set();

  const server = createServer(socket => {
    stats.connections += 1;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);

    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      const { frames, rest } = extractFrames(buffer);
      const discardedThisChunk = buffer.length - rest.length - sumFrameBytes(buffer, frames);
      stats.discardedBytes += discardedThisChunk;

      /**
       * 心跳统计（精确判定，不靠启发式）：
       * `NetworkStabilityService` 用的是**独立的 socket**，且只发 `Buffer.from([0x00])`，
       * 从不说固件帧。而帧 socket 的载荷里也可能出现 0x00（转义只处理 AA/55/F0）。
       * ⇒ 只有当「本次没解析出任何帧」且「消费区段全是 0x00」时才计心跳，
       *    这样不会把含有 0x00 的帧载荷误算成心跳。
       */
      const consumed = buffer.subarray(0, buffer.length - rest.length);
      if (frames.length === 0 && consumed.length > 0 && consumed.every(byte => byte === 0x00)) {
        stats.heartbeatBytes += consumed.length;
      }
      buffer = rest;

      for (const frame of frames) {
        stats.frames.push(frame);
        onEvent({ type: "frame", frame });

        if (frame.command === CMD_ID_REQUEST) {
          stats.idRequests += 1;
          // 固件：5 行文本（LogicAnalyzer.c:254-264）
          socket.write(
            [
              DEVICE_ID_LINE,
              `FREQ:${caps.maxFreq}`,
              `BLASTFREQ:${caps.maxBlastFreq}`,
              `BUFFER:${caps.bufferSize}`,
              `CHANNELS:${caps.channels}`,
              "",
            ].join("\n")
          );
        } else if (frame.command === CMD_CAPTURE) {
          stats.captureRequests += 1;
          const req = decodeCaptureRequest(frame.payload);
          onEvent({ type: "capture", request: req });

          if (!req) {
            // 固件：CAPTURE_ERROR（LogicAnalyzer.c:288 / :304）
            socket.write("CAPTURE_ERROR\n");
            continue;
          }

          // 固件：CAPTURE_STARTED（LogicAnalyzer.c:300）—— 文本行
          socket.write("CAPTURE_STARTED\n");

          if (sendCaptureData) {
            // 固件：采集完成后 sleep 100ms 再发数据（LogicAnalyzer.c:624）
            // ⚠️ 之所以延迟而不是同步回写：产品侧先 `waitForResponse('CAPTURE_STARTED')`，
            //    再 `pauseTextParserForBinaryCapture()` 切到二进制读取。
            //    若样本紧跟文本行到达，可能被 LineParser 当成行数据吞掉。
            setTimeout(() => {
              try {
                const built = buildCaptureResponse(req, { sample });
                stats.captureDataSent += 1;
                stats.captureDataBytes += built.buffer.length;
                // 记录**发了什么**，供判据与产品解析结果对账
                // （不断言魔法数字，避免判据与模拟器图案耦合）
                stats.sentSamples = built.packed;
                stats.sentSampleCount = built.sampleCount;
                stats.sentMode = built.mode;
                socket.write(built.buffer);
              } catch (error) {
                onEvent({ type: "captureWriteError", error: String(error) });
              }
            }, 150);
          }
        } else if (frame.command === CMD_WIFI_SETTINGS) {
          stats.wifiSettings += 1;
          onEvent({ type: "wifiSettings" });
        }
      }
    });

    socket.on("error", () => {
      /* 产品断开是正常流程 */
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(options.port || 0, host, () => {
      const actualPort = server.address().port;
      resolve({
        port: actualPort,
        host,
        stats,
        close: () =>
          new Promise(res => {
            // 先主动断开所有活动连接，再关 listen —— 否则 close 回调永不触发
            for (const s of sockets) {
              s.destroy();
            }
            sockets.clear();
            server.close(() => res());
          }),
      });
    });
  });
}

/** 估算一组帧在原 buffer 里占多少字节（用于统计被丢弃的字节）。 */
function sumFrameBytes(buffer, frames) {
  let total = 0;
  for (const f of frames) {
    // 帧长 = 2(头) + 1(命令) + 载荷转义后长度 + 2(尾)
    total += 2 + 1 + escapePayload([...f.payload]).length + 2;
  }
  return total;
}

module.exports = {
  FRAME_START,
  FRAME_END,
  ESCAPE,
  CMD_ID_REQUEST,
  CMD_CAPTURE,
  CMD_WIFI_SETTINGS,
  DEVICE_ID_LINE,
  DEFAULT_CAPS,
  escapePayload,
  buildFrame,
  extractFrames,
  decodeCaptureRequest,
  buildCaptureRequest,
  CAPTURE_REQUEST_SIZE,
  buildCaptureResponse,
  defaultSamplePattern,
  startMockDevice,
};
