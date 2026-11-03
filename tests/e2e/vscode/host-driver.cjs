"use strict";

/**
 * 宿主内 driver —— 跑在**真 VS Code Extension Host** 里。
 *
 * runner 通过 `extensionTestsPath` 把它交给 `@vscode/test-electron`。
 * 它只做四件事：
 *   1. 从环境变量读场景 id 与上下文
 *   2. 找到并执行该场景的 `run(ctx)`
 *   3. 把 oracle 结果落成 JSON（**哪怕场景崩了也要落**）
 *   4. 用抛错反映失败
 *
 * ## ⚠️ 为什么是 `.cjs` 不是 `.mjs`
 *
 * 实测（2026-11-03）：VS Code **1.74.3** 的 Extension Host 内是
 * `node 16.14.2 / electron 19.1.8` —— 它**不认识 ESM**，
 * `extensionTestsPath` 指向 `.mjs` 会加载失败。
 * 所以 driver 与其依赖的 lib 全部 CJS。参考实现（venus-studio）
 * 也是 `.cjs` + `tsx/cjs` 绕的同一件事。
 *
 * ## ⚠️ 本宿主的 `extensionMode` 是 **Test(3)**
 *
 * `runTests()` 走 `--extensionTestsPath`，不是"开发者按 F5"。
 * 后果：按 `extensionMode === Development` 分支的行为在这里验不到，
 * 写场景时若依赖它，断言会**恒真**（空断言）。
 */

const { writeFileSync } = require("node:fs");
const { createOracleCollector } = require("./lib/oracles.cjs");
const scenarios = require("./scenarios/index.cjs");

function writeResult(payload) {
  const resultPath = process.env.LA_E2E_RESULT;
  if (!resultPath) return;
  try {
    writeFileSync(
      resultPath,
      JSON.stringify({ commit: process.env.LA_E2E_COMMIT || "unknown", ...payload }, null, 2)
    );
  } catch (error) {
    console.error("写结果 JSON 失败：", error);
  }
}

async function run() {
  const startedAt = Date.now();
  const scenarioId = process.env.LA_E2E_SCENARIO;

  if (!scenarioId) {
    writeResult({ scenarioId: null, overall: "fail", oracles: [], hostError: "LA_E2E_SCENARIO 未注入" });
    throw new Error("LA_E2E_SCENARIO 未注入");
  }

  const registration = scenarios.find(entry => entry && entry.id === scenarioId);
  if (!registration) {
    writeResult({
      scenarioId,
      overall: "fail",
      oracles: [],
      hostError: `场景 ${scenarioId} 未在 scenarios/index.cjs 注册`,
    });
    throw new Error(`场景 ${scenarioId} 未注册`);
  }

  // ⚠️ 必须**在宿主内** require('vscode')：宿主外没有这个模块
  const vscode = require("vscode");
  const oracles = createOracleCollector();

  const ctx = {
    vscode,
    scenarioId,
    workspaceDir: process.env.LA_E2E_WORKSPACE,
    declaredCommands: JSON.parse(process.env.LA_E2E_DECLARED_COMMANDS || "[]"),
    commit: process.env.LA_E2E_COMMIT || "unknown",
    oracles,
    /** 等一个条件成立，超时就抛。 */
    async waitFor(predicate, timeoutMs, label) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await predicate()) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error(`等待超时 ${timeoutMs}ms：${label}`);
    },
    /** 包一层超时，避免命令挂死把整个场景拖到外层超时（那样归因就不清）。 */
    async withTimeout(promise, timeoutMs, label) {
      let timer;
      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`超时 ${timeoutMs}ms：${label}`)), timeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };

  let hostError = null;
  try {
    await registration.run(ctx);
  } catch (error) {
    hostError = String(error && error.stack ? error.stack : error);
  }

  const finished = oracles.finish();

  /**
   * `hostError` 非空 ⇒ 场景**没有正常跑完** ⇒ overall 不能是 pass。
   *
   * ⚠️ 2026-11-03 修掉的假绿：原先 `finish()` 先算出 pass（零 oracle 时旧实现
   * 也返回 pass），再把 `hostError` 附在旁边 —— 落盘的 JSON 是
   * `{ overall: "pass", hostError: "..." }`，而 runner 只看 `overall`。
   * 结果是「场景崩溃 + 打印 ✅ 全部场景通过 + EXIT=0」。
   *
   * 现在把降级放在**产结果的地方**（这里），而不是只靠 runner 读 hostError ——
   * 双保险：任何读这份 JSON 的下游（不止 runner）都不会误判。
   */
  const overall = hostError ? "fail" : finished.overall;

  writeResult({
    scenarioId,
    ...finished,
    overall,
    hostError,
    durationMs: Date.now() - startedAt,
  });

  if (hostError) {
    throw new Error(`场景 ${scenarioId} 抛错：${hostError}`);
  }
  if (overall === "fail") {
    throw new Error(`场景 ${scenarioId} 有断言失败`);
  }
}

module.exports = { run };
