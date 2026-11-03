// 模拟器自测：编解码往返 + 协议对齐
const assert = require("node:assert/strict");
const {
  buildFrame,
  extractFrames,
  escapePayload,
  decodeCaptureRequest,
  buildCaptureRequest,
  CAPTURE_REQUEST_SIZE,
  startMockDevice,
  CMD_ID_REQUEST,
  CMD_CAPTURE,
} = require("./mockDevice.cjs");

/**
 * 用正确协议向模拟设备发一次采集请求，并收集回传的二进制样本流。
 * @param {object} reqOverrides 覆盖 decodeCaptureRequest 的输入字段
 */
async function runCaptureRoundTrip(reqOverrides = {}) {
  const dev = await startMockDevice({ port: 0 });
  const net = require("node:net");
  const client = new net.Socket();
  let raw = Buffer.alloc(0);

  // 用 buildCaptureRequest 构造（含 C ABI 对齐填充），不手写字节数组
  const payload = buildCaptureRequest({
    triggerType: 0,
    trigger: 0,
    channels: [0, 1, 2, 3],
    channelCount: 4,
    frequency: 1000000,
    preSamples: reqOverrides.preSamples ?? 16,
    postSamples: reqOverrides.postSamples ?? 32,
  });

  await new Promise((resolve, reject) => {
    client.connect(dev.port, dev.host, () => {
      client.write(buildFrame(CMD_CAPTURE, payload));
    });
    client.on("data", d => {
      raw = Buffer.concat([raw, d]);
      // 收到 "CAPTURE_STARTED\n" + 至少 4 字节长度头 + 数据
      if (raw.length > 20) setTimeout(resolve, 120);
    });
    client.on("error", reject);
    setTimeout(() => reject(new Error("采集回传超时")), 4000);
  });

  client.destroy();
  await dev.close();
  return { raw, stats: dev.stats };
}

/** 小端 32 位拆分 */
function u32le(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

(async () => {
  // ---- 1. 转义往返 ----
  {
    const payload = [0x01, 0xaa, 0x55, 0xf0, 0x02];
    const escaped = escapePayload(payload);
    // 转义后载荷里**不应再出现** 0xAA / 0x55 / 0xF0 之外的原值（否则帧边界会被误判）
    // 注意：`0xF0` 本身是转义前缀，会出现在输出里，所以要排除它
    const rawBoundary = escaped.filter(b => b === 0xaa || b === 0x55);
    assert.deepEqual(rawBoundary, [], `转义后不应残留帧边界字节 0xAA/0x55，实际 ${rawBoundary.join(",")}`);
    assert.ok(escaped.length > payload.length, "含边界字节的载荷转义后应变长");
    // 解转义
    const back = [];
    for (let k = 0; k < escaped.length; k += 1) {
      if (escaped[k] === 0xf0) {
        back.push(escaped[k + 1] ^ 0xf0);
        k += 1;
      } else back.push(escaped[k]);
    }
    assert.deepEqual(back, payload, "转义往返必须一致");
    console.log("✅ 1. 转义往返一致");
  }

  // ---- 2. 帧往返 ----
  {
    const frame = buildFrame(CMD_ID_REQUEST);
    const { frames } = extractFrames(frame);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].command, CMD_ID_REQUEST);
    console.log("✅ 2. 帧往返一致");
  }

  // ---- 3. 粘包（两帧连在一起）----
  {
    const buf = Buffer.concat([buildFrame(CMD_ID_REQUEST), buildFrame(CMD_CAPTURE, [0x01])]);
    const { frames } = extractFrames(buf);
    assert.equal(frames.length, 2);
    assert.equal(frames[1].command, CMD_CAPTURE);
    console.log("✅ 3. 粘包可拆");
  }

  // ---- 4. 半包（帧被切断，应等待）----
  {
    const full = buildFrame(CMD_ID_REQUEST);
    const half = full.subarray(0, full.length - 1);
    const { frames } = extractFrames(half);
    assert.equal(frames.length, 0, "半包不应被当成帧");
    console.log("✅ 4. 半包等待");
  }

  // ---- 5. 非帧字节（模拟产品发 JSON）----
  {
    const json = Buffer.from('{"command":"START_CAPTURE"}');
    const { frames } = extractFrames(json);
    assert.equal(frames.length, 0, "JSON 文本不应被当成帧 —— 真固件也是这样丢的");
    console.log("✅ 5. JSON 被忽略（与真固件一致）");
  }

  // ---- 6. CAPTURE_REQUEST 解码（含 C ABI 对齐填充）----
  {
    const payload = buildCaptureRequest({
      triggerType: 0,
      trigger: 3,
      channels: [0, 1, 2, 3],
      channelCount: 4,
      frequency: 1000000,
      preSamples: 16,
      postSamples: 32,
    });
    assert.equal(payload.length, CAPTURE_REQUEST_SIZE, "结构体必须是 48 字节");
    const req = decodeCaptureRequest(payload);
    assert.equal(req.triggerType, 0);
    assert.equal(req.trigger, 3);
    assert.equal(req.channelCount, 4);
    assert.deepEqual(req.channels, [0, 1, 2, 3]);
    assert.equal(req.frequency, 1000000);
    assert.equal(req.preSamples, 16);
    assert.equal(req.postSamples, 32);
    console.log("✅ 6. CAPTURE_REQUEST 解码正确");
  }

  // ---- 7. 真 TCP 往返：模拟产品用**正确协议**沟通 ----
  {
    const dev = await startMockDevice({ port: 0 });
    const net = require("node:net");
    const client = new net.Socket();
    const reply = await new Promise((resolve, reject) => {
      let data = "";
      client.connect(dev.port, dev.host, () => {
        client.write(buildFrame(CMD_ID_REQUEST));
      });
      client.on("data", d => {
        data += d.toString();
        if (data.split("\n").filter(Boolean).length >= 5) resolve(data);
      });
      client.on("error", reject);
      setTimeout(() => reject(new Error("超时")), 3000);
    });
    client.destroy();
    await dev.close();

    assert.ok(reply.includes("LOGIC_ANALYZER_"), "必须回设备 ID");
    assert.ok(/FREQ:\d+/.test(reply), "必须回 FREQ");
    assert.ok(/CHANNELS:\d+/.test(reply), "必须回 CHANNELS");
    assert.equal(dev.stats.idRequests, 1);
    console.log("✅ 7. TCP 往返正常（正确协议下）");
  }

  // ---- 8. 真 TCP：模拟产品用**错误协议**（JSON）→ 应无响应 ----
  {
    const dev = await startMockDevice({ port: 0 });
    const net = require("node:net");
    const client = new net.Socket();
    const got = await new Promise(resolve => {
      let data = "";
      client.connect(dev.port, dev.host, () => {
        client.write('{"command":"GET_STATUS","timestamp":1}');
      });
      client.on("data", d => {
        data += d.toString();
      });
      setTimeout(() => resolve(data), 1000);
    });
    client.destroy();
    await dev.close();

    assert.equal(got, "", "JSON 不应得到任何响应 —— 真固件也不会回");
    assert.equal(dev.stats.idRequests, 0);
    console.log("✅ 8. JSON 无响应（如实暴露产品协议不匹配）");
  }

  // ---- 9. 采集样本流：回传格式符合固件（LogicAnalyzer.c:606-729）----
  {
    const { raw, stats } = await runCaptureRoundTrip({ preSamples: 16, postSamples: 32 });
    assert.equal(stats.captureRequests, 1, "设备必须收到 1 次 CAPTURE");
    assert.equal(stats.captureDataSent, 1, "设备必须回传 1 次样本流");

    // 文本行 "CAPTURE_STARTED\n" 之后才是二进制
    const text = "CAPTURE_STARTED\n";
    const body = raw.subarray(text.length);
    const length = body.readUInt32LE(0);
    assert.equal(length, 48, `长度头应为 pre+post=48，实为 ${length}`);

    // 4 通道 ⇒ 8bit 模式 ⇒ 每样本 1 字节
    const expected = 4 + length * 1 + 1;
    assert.equal(body.length, expected, `样本流总长应为 ${expected}，实为 ${body.length}`);

    // 样本必须非零且有跳变（否则"收到数据"与"收到零填充"分不开）
    const data = body.subarray(4, 4 + length);
    assert.ok(data.some(b => b !== 0), "样本不应全为 0");
    const transitions = data.reduce((n, v, i) => (i > 0 && v !== data[i - 1] ? n + 1 : n), 0);
    assert.ok(transitions >= 4, `样本应有明显跳变，实测 ${transitions} 次`);

    // 末字节是 stampsLength=0
    assert.equal(body[body.length - 1], 0, "stampsLength 应为 0");
    console.log(`✅ 9. 采集样本流格式正确（length=${length}, bytes=${body.length}, transitions=${transitions}）`);
  }

  // ---- 10. 回归守卫：close() 必须能断开活动连接（防挂死）----
  //
  // ⚠️ 为什么这条必须存在：`net.Server.close()` 只停止 listen，
  //    **不会断开已有连接**；只要还有一个 socket 挂着，close 回调永不触发。
  //    第 7/8 条自测都自己 `client.destroy()` 了，会**掩盖**这个缺陷 ——
  //    所以必须单独造一个"故意不 destroy client"的用例。
  {
    const dev = await startMockDevice({ port: 0 });
    const net = require("node:net");
    const client = new net.Socket();
    await new Promise((resolve, reject) => {
      client.connect(dev.port, dev.host, resolve);
      client.on("error", reject);
    });
    // ⚠️ 故意不 destroy client，直接 close
    const closed = await Promise.race([
      dev.close().then(() => "closed"),
      new Promise(res => setTimeout(() => res("timeout"), 1500)),
    ]);
    client.destroy();
    assert.equal(closed, "closed", "server.close() 在有活动连接时挂死了 —— 缺少 socket.destroy()");
    console.log("✅ 10. close() 能断开活动连接，不会挂死");
  }

  // ---- 11. 与产品自己的 serialize() 逐字节对账（防"我理解的结构体 ≠ 产品发的"）----
  //
  // ⚠️ 为什么这条最重要：第 6 条只证明"我构造的字节 ↔ 我的解码器"自洽。
  //    若我对 C ABI 对齐的理解整体错了，第 6 条**照样绿**。
  //    只有拿**产品真实产出的 48 字节**来对，才能锁死布局。
  {
    const { CaptureRequest } = require("../../../../out/drivers/AnalyzerDriverBase.js");
    const r = new CaptureRequest();
    r.triggerType = 0;
    r.trigger = 3;
    r.triggerValue = 1;
    r.channels[0] = 0;
    r.channels[1] = 1;
    r.channels[2] = 2;
    r.channels[3] = 3;
    r.channelCount = 4;
    r.frequency = 1000000;
    r.preSamples = 16;
    r.postSamples = 32;
    r.loopCount = 0;
    r.measure = 0;
    r.captureMode = 0;

    const productBytes = Array.from(r.serialize());
    assert.equal(productBytes.length, CAPTURE_REQUEST_SIZE,
      `产品序列化长度 ${productBytes.length} ≠ ${CAPTURE_REQUEST_SIZE}`);

    const mine = buildCaptureRequest({
      triggerType: 0, trigger: 3, triggerValue: 1,
      channels: [0, 1, 2, 3], channelCount: 4,
      frequency: 1000000, preSamples: 16, postSamples: 32,
      loopCount: 0, measure: 0, captureMode: 0,
    });
    assert.deepEqual(mine, productBytes,
      "模拟器构造的 CAPTURE_REQUEST 与产品 serialize() 不一致 —— 布局理解有误");

    // 再双向验：产品字节 → 我的解码器，字段必须全对
    const decoded = decodeCaptureRequest(productBytes);
    assert.equal(decoded.trigger, 3);
    assert.equal(decoded.triggerValue, 1);
    // decodeCaptureRequest 已按 channelCount 截断（`.slice(0, channelCount)`）
    assert.deepEqual(decoded.channels, [0, 1, 2, 3]);
    assert.equal(decoded.channelCount, 4);
    assert.equal(decoded.frequency, 1000000);
    assert.equal(decoded.preSamples, 16, "preSamples 错位会把 1000000 读成采样数");
    assert.equal(decoded.postSamples, 32);
    assert.equal(decoded.loopCount, 0);
    console.log("✅ 11. 与产品 CaptureRequest.serialize() 逐字节一致（48 字节布局锁定）");
  }

  console.log("\n全部自测通过");
})().catch(e => {
  console.error("❌ 自测失败:", e.message);
  process.exit(1);
});
