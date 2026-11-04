"use strict";

/**
 * 真宿主 E2E 的硬件可用性探测。
 *
 * ## 为什么单独一个模块
 *
 * `needsHardware: true` 的场景在无硬件时必须被**诚实跳过并留痕**，而不是
 * 直接跑挂变成 fail，也不是静默不跑。判断「有没有硬件」这件事必须可复核：
 * 探到了什么、没探到什么，都要能打印出来。
 *
 * ## 判定顺序（缺省不可用，绝不猜）
 *
 * 1. `LA_E2E_HARDWARE=1` → 视为可用（CI 上插真机时显式声明）
 * 2. `LA_E2E_HARDWARE=0` → 视为不可用（显式关闭，本地排查用）
 * 3. 未设置 → 真实探测串口（VID/PID 与产品 SerialDetector 同源）
 *    - `1209:3020` 原始逻辑分析器
 *    - `2E8A:0003` Raspberry Pi Pico 候选
 * 4. 探测抛错 → 视为不可用，并把原因带出去
 */

const ANALYZER_USB_IDS = [
  { vendorId: "1209", productId: "3020", label: "原始逻辑分析器" },
  { vendorId: "2E8A", productId: "0003", label: "Raspberry Pi Pico 候选" },
];

function normalizeUsbId(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).replace(/^0x/i, "").toUpperCase().padStart(4, "0");
}

/** 从串口列表里挑出产品认可的 USB ID（与 SerialDetector.classifyPort 同源）。 */
function matchAnalyzerPorts(ports) {
  const matched = [];
  for (const port of ports || []) {
    const vendorId = normalizeUsbId(port.vendorId);
    const productId = normalizeUsbId(port.productId);
    const hit = ANALYZER_USB_IDS.find(
      id => vendorId === id.vendorId && productId === id.productId
    );
    if (hit) {
      matched.push({
        path: port.path,
        vendorId,
        productId,
        label: hit.label,
      });
    }
  }
  return matched;
}

/**
 * @param {object} [options]
 * @param {Record<string, string|undefined>} [options.env] 便于测试注入
 * @param {() => Promise<Array<Record<string, unknown>>} [options.listPorts] 便于测试注入
 * @returns {Promise<{available: boolean, source: string, reason: string, matched: Array}>}
 */
async function detectHardwareAvailability(options = {}) {
  const env = options.env || process.env;
  const explicit = String(env.LA_E2E_HARDWARE || "").trim();

  if (explicit === "1") {
    return {
      available: true,
      source: "env",
      reason: "LA_E2E_HARDWARE=1 显式声明有硬件",
      matched: [],
    };
  }
  if (explicit === "0") {
    return {
      available: false,
      source: "env",
      reason: "LA_E2E_HARDWARE=0 显式声明无硬件",
      matched: [],
    };
  }

  let ports;
  try {
    const listPorts = options.listPorts || (async () => {
      const { SerialPort } = require("serialport");
      return SerialPort.list();
    });
    ports = await listPorts();
  } catch (error) {
    return {
      available: false,
      source: "probe",
      reason: `串口探测失败（按不可用处理）：${String(error && error.message ? error.message : error)}`,
      matched: [],
    };
  }

  const matched = matchAnalyzerPorts(ports);
  if (matched.length > 0) {
    return {
      available: true,
      source: "probe",
      reason: `串口探测命中 ${matched.length} 个产品 USB ID：${matched.map(m => `${m.path}(${m.vendorId}:${m.productId})`).join(", ")}`,
      matched,
    };
  }

  return {
    available: false,
    source: "probe",
    reason: `串口探测未命中任何产品 USB ID（1209:3020 / 2E8A:0003），共 ${(ports || []).length} 个串口`,
    matched: [],
  };
}

module.exports = { detectHardwareAvailability, matchAnalyzerPorts, ANALYZER_USB_IDS };
