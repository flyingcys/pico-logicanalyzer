"use strict";

/**
 * knownIncompleteGate 自检（纯函数，无需启动真宿主）。
 *
 * 覆盖 6 类判据：
 *  1. 全部命中 → 0
 *  2. 新增未登记 → 非 0，且输出点名
 *  3. 清单 stale（登记了但本次没出现）→ 非 0，且输出点名
 *  4. 有 fail → 非 0（永不豁免）
 *  5. hostError → 非 0（永不豁免）
 *  6. 空清单 + 空非 pass → 0
 *
 * 另加：delegate 对账失败 / profile 残留 / 两开关互斥 / 全 pass 基线。
 */

const assert = require("node:assert/strict");
const { evaluateExitCode } = require("./knownIncompleteGate.cjs");

const REGISTRY = [
  { scenarioId: "s1", oracleId: "o1", status: "not_exercised", reason: "r", registeredAt: "2026-11-05" },
  { scenarioId: "s2", oracleId: "o2", status: "blocked", reason: "r", registeredAt: "2026-11-05" },
];

function scenario(scenarioId, overall, oracles, extra = {}) {
  return {
    scenarioId,
    overall,
    oracles,
    delegates: [],
    profileRemoved: true,
    hostError: null,
    launchFailed: false,
    ...extra,
  };
}

const ORACLE_1 = { id: "o1", status: "not_exercised" };
const ORACLE_2 = { id: "o2", status: "blocked" };

const base = {
  summary: [
    scenario("s1", "not_exercised", [ORACLE_1, { id: "ok", status: "pass" }]),
    scenario("s2", "blocked", [ORACLE_2]),
    scenario("s3", "pass", [{ id: "ok", status: "pass" }]),
  ],
  delegateProblems: [],
  options: { allowRegisteredIncomplete: true },
  registered: REGISTRY,
};

function run(name, overrides, expectations) {
  const result = evaluateExitCode({ ...base, ...overrides });
  assert.equal(result.exitCode, expectations.exitCode, `${name}: exitCode — ${JSON.stringify(result)}`);
  if (expectations.mode) assert.equal(result.mode, expectations.mode, `${name}: mode`);
  for (const needle of expectations.problemsInclude || []) {
    assert.ok(
      result.problems.some(p => p.includes(needle)),
      `${name}: 输出应点名「${needle}」，实际 ${JSON.stringify(result.problems)}`
    );
  }
  console.log(`  ✅ ${name} → EXIT=${result.exitCode} (${result.mode})`);
}

(async () => {
  console.log("knownIncompleteGate 自检：");

  run("1 全部命中 → 0", {}, { exitCode: 0, mode: "registered-incomplete" });

  run(
    "2 新增未登记 → 非 0 且点名",
    {
      summary: [
        ...base.summary,
        scenario("s4", "not_exercised", [{ id: "o-new", status: "not_exercised" }]),
      ],
    },
    { exitCode: 4, mode: "registry-mismatch", problemsInclude: ["新增未登记", "s4/o-new"] }
  );

  run(
    "3 清单 stale → 非 0 且点名",
    { registered: [...REGISTRY, { scenarioId: "s9", oracleId: "o9", status: "blocked", reason: "r", registeredAt: "2026-11-05" }] },
    { exitCode: 4, mode: "registry-mismatch", problemsInclude: ["白名单 stale", "s9/o9"] }
  );

  run(
    "4 有 fail → 非 0（永不豁免）",
    { summary: [...base.summary, scenario("s5", "fail", [{ id: "o5", status: "fail" }])] },
    { exitCode: 1, mode: "hard-failure", problemsInclude: ["有场景失败"] }
  );

  run(
    "5 hostError → 非 0（永不豁免）",
    { summary: [...base.summary, scenario("s6", "pass", [{ id: "ok", status: "pass" }], { hostError: "boom" })] },
    { exitCode: 1, mode: "hard-failure", problemsInclude: ["hostError"] }
  );

  run(
    "6 空清单 + 空非 pass → 0",
    {
      summary: [scenario("s3", "pass", [{ id: "ok", status: "pass" }])],
      registered: [],
    },
    { exitCode: 0, mode: "all-pass" }
  );

  run(
    "附加：delegate 对账失败 → 非 0",
    { delegateProblems: ["s1 把 x 交给不存在的 sX"] },
    { exitCode: 1, mode: "hard-failure", problemsInclude: ["delegate 对账失败"] }
  );

  run(
    "附加：profile 残留 → 非 0",
    { summary: [{ ...base.summary[0], profileRemoved: false }, ...base.summary.slice(1)] },
    { exitCode: 1, mode: "hard-failure", problemsInclude: ["profile 目录未被清理"] }
  );

  run(
    "附加：两个开关互斥 → 非 0",
    { options: { allowIncomplete: true, allowRegisteredIncomplete: true } },
    { exitCode: 1, mode: "conflict", problemsInclude: ["互斥"] }
  );

  run(
    "附加：默认无开关 → EXIT=3",
    { options: {} },
    { exitCode: 3, mode: "default", problemsInclude: ["这不算通过"] }
  );

  console.log("knownIncompleteGate 自检全部通过（10 例）");
})().catch(error => {
  console.error("knownIncompleteGate 自检失败：", error);
  process.exit(1);
});
