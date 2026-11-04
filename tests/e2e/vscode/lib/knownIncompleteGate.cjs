"use strict";

/**
 * 真宿主 E2E 退出码判定（纯函数，便于自检与变异验证）。
 *
 * 为什么抽出来：CI 既要「已登记的 not_exercised / blocked 不算失败」，
 * 又要「新增未登记 / 清单 stale / fail / hostError 一律失败」。
 * 把判断写在 runner 主流程里无法独立测，容易退化成 `|| true` 式假绿。
 */

const ALLOWED_STATUSES = new Set(["not_exercised", "blocked"]);

function tupleKey(scenarioId, oracleId, status) {
  return `${String(scenarioId)}\u0000${String(oracleId)}\u0000${String(status)}`;
}

function validateRegistry(registered) {
  const problems = [];
  const seen = new Set();

  registered.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      problems.push(`白名单第 ${index + 1} 项不是对象`);
      return;
    }
    const { scenarioId, oracleId, status, reason, registeredAt } = item;
    if (!scenarioId || !oracleId || !status || !reason || !registeredAt) {
      problems.push(`白名单第 ${index + 1} 项字段不完整（需 scenarioId/oracleId/status/reason/registeredAt）`);
      return;
    }
    if (!ALLOWED_STATUSES.has(status)) {
      problems.push(`白名单 ${scenarioId}/${oracleId} 的 status=${status} 不允许（只允许 not_exercised / blocked，fail 永不豁免）`);
      return;
    }
    const key = tupleKey(scenarioId, oracleId, status);
    if (seen.has(key)) {
      problems.push(`白名单重复登记：${scenarioId}/${oracleId}/${status}`);
      return;
    }
    seen.add(key);
  });

  return { problems, keys: seen };
}

/**
 * 硬件场景登记表校验（known-hardware-scenarios.cjs）。
 *
 * 只校验「声明了 needsHardware 的场景」与「登记表」的一致性：
 *  - 声明了但没登记 → 未登记，硬失败（堵后门：随便加 needsHardware 让 oracle 消失）
 *  - 登记了但场景不存在 / 该场景没声明 needsHardware → stale，硬失败
 */
function validateHardwareRegistry(registered, scenarioNeedsHardware) {
  const problems = [];
  const seen = new Set();

  registered.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      problems.push(`硬件场景登记表第 ${index + 1} 项不是对象`);
      return;
    }
    const { scenarioId, reason, registeredAt } = item;
    if (!scenarioId || !reason || !registeredAt) {
      problems.push(`硬件场景登记表第 ${index + 1} 项字段不完整（需 scenarioId/reason/registeredAt）`);
      return;
    }
    if (seen.has(scenarioId)) {
      problems.push(`硬件场景登记表重复登记：${scenarioId}`);
      return;
    }
    seen.add(scenarioId);

    if (!scenarioNeedsHardware.has(scenarioId)) {
      problems.push(
        `硬件场景登记表 stale：${scenarioId} 已登记，但该场景不存在或未声明 needsHardware: true`
      );
    }
  });

  return { problems, keys: seen };
}

function collectObserved(summary) {
  const observed = new Map();
  const unattributed = [];

  for (const record of summary) {
    const oracles = Array.isArray(record.oracles) ? record.oracles : [];
    const nonPass = oracles.filter(oracle => oracle && oracle.status !== "pass");

    if (record.overall !== "pass" && nonPass.length === 0) {
      unattributed.push(record.scenarioId);
    }

    for (const oracle of nonPass) {
      const key = tupleKey(record.scenarioId, oracle.id, oracle.status);
      if (!observed.has(key)) observed.set(key, []);
      observed.get(key).push(`${record.scenarioId}/${oracle.id}`);
    }
  }

  return { observed, unattributed };
}

/**
 * @param {object} input
 * @param {Array} input.summary runner 的场景结果
 * @param {Array<string>} input.delegateProblems 跨场景 delegate 对账问题
 * @param {object} input.options runner 解析后的开关
 * @param {Array} input.registered known-incomplete.cjs 的白名单
 * @param {Array} input.hardwareRegistered known-hardware-scenarios.cjs 的人工登记表
 * @param {Iterable<string>} input.hardwareScenarioIds 本次运行中声明 needsHardware 的场景 id
 * @returns {{exitCode: number, problems: string[], allPassed: boolean, mode: string, matched: number, hardwareSkipped: number}}
 */
function evaluateExitCode({
  summary = [],
  delegateProblems = [],
  options = {},
  registered = [],
  hardwareRegistered = [],
  hardwareScenarioIds = [],
}) {
  const problems = [];
  const hardFailure = message => problems.push(message);

  if (options.allowIncomplete && options.allowRegisteredIncomplete) {
    return {
      exitCode: 1,
      problems: ["--allow-incomplete 与 --allow-registered-incomplete 互斥：CI 必须用后者，前者是一刀切"],
      allPassed: false,
      mode: "conflict",
      matched: 0,
    };
  }

  const registry = validateRegistry(registered);
  problems.push(...registry.problems);

  // ---- 硬件场景登记校验（堵「自己加 needsHardware 让 oracle 消失」后门）----
  const hardwareIds = new Set(
    Array.from(hardwareScenarioIds || []).filter(id => typeof id === "string" && id.length > 0)
  );
  const hardwareRegistry = validateHardwareRegistry(hardwareRegistered, hardwareIds);
  problems.push(...hardwareRegistry.problems);
  for (const scenarioId of hardwareIds) {
    if (!hardwareRegistry.keys.has(scenarioId)) {
      hardFailure(
        `未登记的硬件场景：${scenarioId} 声明了 needsHardware: true —— 必须先审核并登记进 known-hardware-scenarios.cjs`
      );
    }
  }

  // 硬件门控产生的 not_exercised 记录不进白名单比对，但必须留痕
  const hardwareSkippedRecords = summary.filter(record => record.hardwareGated === true);
  const nonHardwareSummary = summary.filter(record => record.hardwareGated !== true);

  for (const record of nonHardwareSummary) {
    if (record.hostError) {
      hardFailure(`场景 ${record.scenarioId} 有 hostError，永不豁免：${record.hostError}`);
    }
    if (record.launchFailed) {
      hardFailure(`场景 ${record.scenarioId} 宿主启动失败，永不豁免`);
    }
    if (record.overall === "fail") {
      hardFailure(`有场景失败：${record.scenarioId}`);
    }
  }

  if (!options.keepProfile && nonHardwareSummary.some(s => !s.profileRemoved)) {
    hardFailure("有 profile 目录未被清理（残留）");
  }
  if (delegateProblems.length) {
    hardFailure(`delegate 对账失败：${delegateProblems.join("；")}`);
  }

  const hardwareSkipped = hardwareSkippedRecords.length;
  const hardwareNotes = hardwareSkippedRecords.map(record => {
    const oracle = (record.oracles || []).find(item => item && item.id === "hardware-unavailable");
    return `${record.scenarioId}${oracle && oracle.detail ? `（${oracle.detail}）` : ""}`;
  });

  if (problems.length) {
    return { exitCode: 1, problems, allPassed: false, mode: "hard-failure", matched: 0, hardwareSkipped };
  }

  // 硬件门控项永远不能算进 pass：它们没有跑过任何产品断言
  const allPassed = nonHardwareSummary.length > 0
    && nonHardwareSummary.every(s => s.overall === "pass")
    && hardwareSkipped === 0;
  if (allPassed) {
    return { exitCode: 0, problems: [], allPassed: true, mode: "all-pass", matched: 0, hardwareSkipped };
  }

  if (options.allowIncomplete) {
    return {
      exitCode: 0,
      problems: ["--allow-incomplete 已指定：本次退出码不反映「未验证」部分（仅供本地排查，CI 禁用）"],
      allPassed: false,
      mode: "legacy-allow-incomplete",
      matched: 0,
      hardwareSkipped,
    };
  }

  if (!options.allowRegisteredIncomplete) {
    return {
      exitCode: 3,
      problems: [
        "无 fail，但有 not_exercised / blocked —— 这不算通过",
        ...(hardwareSkipped > 0 ? [`其中 ${hardwareSkipped} 个场景因无硬件被跳过：${hardwareNotes.join("；")}`] : []),
        "（如需只看 fail，加 --allow-incomplete；CI 请用 --allow-registered-incomplete）",
      ],
      allPassed: false,
      mode: "default",
      matched: 0,
      hardwareSkipped,
    };
  }

  const { observed, unattributed } = collectObserved(nonHardwareSummary);
  const observedKeys = new Set(observed.keys());
  const registeredKeys = registry.keys;

  for (const scenarioId of unattributed) {
    problems.push(`场景 ${scenarioId} 非 pass 但没有对应的非 pass oracle，无法白名单归因`);
  }
  for (const [key, labels] of observed) {
    if (!registeredKeys.has(key)) {
      problems.push(`新增未登记的未完成项：${labels[0]}（${key.split("\u0000")[2]}）—— 必须审核后加入 known-incomplete.cjs`);
    }
  }
  // ⚠️ stale 只对「本次真正执行过的场景」强制：
  // 用 `--scenario` 只跑子集时，未跑到的场景其登记项本来就「未出现」，
  // 那不是 stale —— 那是没验（与 delegate 对账在子集运行下的既有语义一致）。
  // 但**已执行**的场景里登记项没出现，就是真的 stale，仍要硬失败。
  const executedScenarioIds = new Set(summary.map(record => record.scenarioId));
  for (const key of registeredKeys) {
    if (observedKeys.has(key)) continue;
    const [scenarioId, oracleId, status] = key.split("\u0000");
    if (!executedScenarioIds.has(scenarioId)) continue;
    problems.push(`白名单 stale：${scenarioId}/${oracleId}/${status} 已登记但本次未出现，请核对是否已修复并移除`);
  }

  if (problems.length) {
    return { exitCode: 4, problems, allPassed: false, mode: "registry-mismatch", matched: observedKeys.size, hardwareSkipped };
  }

  return {
    exitCode: 0,
    problems: hardwareSkipped > 0
      ? [`${hardwareSkipped} 个已登记硬件场景因无硬件被跳过：${hardwareNotes.join("；")}`]
      : [],
    allPassed: false,
    mode: "registered-incomplete",
    matched: observedKeys.size,
    hardwareSkipped,
  };
}

module.exports = { evaluateExitCode, tupleKey };
