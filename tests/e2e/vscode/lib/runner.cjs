#!/usr/bin/env node
"use strict";

/**
 * 真宿主 e2e 启动器（外层进程，**不在 Extension Host 内**）。
 *
 * ## 它补的是哪一层
 *
 * 单元测试里 `vscode` 是 mock，`executeCommand` 是 `jest.fn()` ——
 * **`activate()` 的接线、命令注册、`LACEditorProvider` 的 custom editor 注册、
 * `.lac` 真落盘、真 webview 面板被拉起** —— 这些一次都没真跑过。
 *
 * 本 runner 启动**真 VS Code Extension Development Host**，
 * 由 `host-driver.cjs` 在宿主内跑场景。判据是：
 *
 * > **命令必须是 VS Code 调的，产物必须真在磁盘上。**
 *
 * ## 为什么 runner 是 `.cjs` 而不是 `.mjs`
 *
 * 本仓 `package.json` 没有 `"type": "module"`，且宿主内 driver 必须是 CJS
 * （VS Code 1.74.3 的 Extension Host 是 Node 16，不认 ESM —— 已实测）。
 * 让 runner 与 driver 同为 CJS，省掉「一半 ESM 一半 CJS」的跨模块互操作问题。
 * `@vscode/test-electron` 是 CJS 的，从 CJS require 它本来就最顺。
 *
 * ## 用法
 *
 * ```sh
 * xvfb-run -a npm run test:e2e:vscode                     # 全部场景
 * xvfb-run -a npm run test:e2e:vscode -- --scenario open-analyzer
 * npm run test:e2e:vscode -- --list
 * ```
 *
 * 无 DISPLAY 时**主动失败并提示 `xvfb-run -a`**，不静默跳过。
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { runTests } = require("@vscode/test-electron");
const { checkDisplay, checkExtensionBuild, readDeclaredCommands } = require("./env.cjs");
const {
  createProfileDir,
  reapProfileProcesses,
  removeProfileDir,
  sweepStaleProfileDirs,
} = require("./profile.cjs");
const scenarios = require("../scenarios/index.cjs");

const e2eRoot = resolve(__dirname, "..");
const repoRoot = resolve(e2eRoot, "../../..");
const hostDriverPath = resolve(e2eRoot, "host-driver.cjs");
const resultDir = join(e2eRoot, "artifacts", "latest");

/**
 * VS Code 版本：钉在 `package.json` 的 `engines.vscode` 下限（^1.74.0）。
 *
 * 为什么不钉最新：下限才是"最低支持版本可用"的证明；钉最新会因为
 * VS Code 自动更新而漂移，且验不到低版本兼容。
 */
const VSCODE_VERSION = "1.74.3";

/**
 * Chromium 在 xvfb 下偶发的 GPU/网络进程崩溃（实测 `code: 15`）不是判据失败，
 * 允许重试。**只对基础设施崩溃重试，逻辑失败绝不重试**（那会把真失败洗成概率性通过）。
 */
const MAX_INFRA_RETRIES = 2;

function parseArgs(argv) {
  const options = { scenarioIds: [], list: false, keepProfile: false, allowIncomplete: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") options.list = true;
    else if (arg === "--keep-profile") options.keepProfile = true;
    else if (arg === "--allow-incomplete") options.allowIncomplete = true;
    else if (arg === "--scenario" && argv[i + 1]) {
      options.scenarioIds.push(argv[i + 1]);
      i += 1;
    }
  }
  return options;
}

function printRegistry() {
  console.log("已注册场景：\n");
  for (const entry of scenarios) {
    console.log(`  ${entry.id.padEnd(26)} ${entry.title || ""}`);
    if (entry.needsHardware) console.log(`  ${"".padEnd(26)} ⚠️ 需要真机硬件`);
  }
  console.log("");
}

const MARK = { pass: "✅", fail: "❌", blocked: "⛔", not_exercised: "⚠️" };

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    printRegistry();
    return 0;
  }

  // 未知场景直接失败 —— 静默跳过等于"验了个不存在的场景"
  if (options.scenarioIds.length) {
    const unknown = options.scenarioIds.filter(id => !scenarios.some(s => s.id === id));
    if (unknown.length) {
      console.error(`❌ 未知场景：${unknown.join(", ")}`);
      console.error(`已注册：${scenarios.map(s => s.id).join(", ")}`);
      return 2;
    }
  }
  const selected = options.scenarioIds.length
    ? scenarios.filter(s => options.scenarioIds.includes(s.id))
    : scenarios;

  // ---- 前置检查（全部前置拦，不静默）----
  const display = checkDisplay();
  if (!display.ok) {
    console.error(`❌ ${display.message}`);
    return 1;
  }
  const build = checkExtensionBuild(repoRoot);
  if (!build.ok) {
    console.error(`❌ ${build.message}`);
    return 1;
  }

  const swept = sweepStaleProfileDirs();
  if (swept.length) {
    console.log(`🧹 清理了 ${swept.length} 个历史 profile 残留目录`);
  }

  mkdirSync(resultDir, { recursive: true });
  const declaredCommands = readDeclaredCommands(repoRoot);
  const summary = [];

  for (const scenario of selected) {
    let profileDir = createProfileDir();
    let resultPath = join(profileDir, "host-result.json");
    let workspaceDir = join(profileDir, "workspace");
    mkdirSync(workspaceDir, { recursive: true });

    console.log(`\n▶ 场景 ${scenario.id} —— ${scenario.title || ""}`);

    /**
     * 跑一次真宿主。返回 `{ launchError, hostResult }`。
     *
     * ⚠️ 抽成函数是为了**基础设施崩溃时重试**（见下方 `isInfraCrash`）。
     * 每次重试**必须用全新的 profile** —— 复用一个被崩溃污染的 profile
     * 会让失败以另一种形态出现，掩盖真因。
     */
    async function attemptRun(targetProfileDir, targetResultPath, targetWorkspaceDir) {
      let runError = null;
      try {
        await runTests({
          version: VSCODE_VERSION,
          extensionDevelopmentPath: repoRoot,
          extensionTestsPath: hostDriverPath,
          extensionTestsEnv: {
            LA_E2E_SCENARIO: scenario.id,
            LA_E2E_RESULT: targetResultPath,
            LA_E2E_WORKSPACE: targetWorkspaceDir,
            LA_E2E_DECLARED_COMMANDS: JSON.stringify(declaredCommands),
            LA_E2E_COMMIT: process.env.LA_E2E_COMMIT || "unknown",
          },
          launchArgs: [
            targetWorkspaceDir,
            `--user-data-dir=${join(targetProfileDir, "user-data")}`,
            `--extensions-dir=${join(targetProfileDir, "extensions")}`,
            "--no-sandbox",
            "--disable-gpu",
            "--skip-welcome",
            "--skip-release-notes",
            "--disable-workspace-trust",
          ],
        });
      } catch (error) {
        runError = error;
      }
      let parsed = null;
      if (existsSync(targetResultPath)) {
        try {
          parsed = JSON.parse(readFileSync(targetResultPath, "utf8"));
        } catch (error) {
          parsed = {
            overall: "fail",
            oracles: [],
            hostError: `结果 JSON 不可解析：${error.message}`,
          };
        }
      }
      return { launchError: runError, hostResult: parsed };
    }

    /** 这次失败「可能只是基础设施崩了」吗？ */
    function isInfraCrash(runResult) {
      if (!runResult.launchError) return false;
      const message = String(runResult.launchError.message || runResult.launchError);
      // Chromium 在 xvfb 下偶发的 GPU/网络进程崩溃（实测 code 15）
      const looksLikeCrash = /code:\s*15|renderer process gone|GPU process exited|Network service crashed|Test run failed with code/i.test(
        message
      );
      if (!looksLikeCrash) return false;
      /**
       * ⚠️ **只在 oracle 没有任何 fail 时才重试**。
       *
       * 如果 oracle 里已经有 fail，那说明场景真的跑到了、断言真的失败了 ——
       * 重试只会把真实失败洗成概率性通过。**那是同一种假绿。**
       */
      const oracles = (runResult.hostResult && runResult.hostResult.oracles) || [];
      return !oracles.some(o => o.status === "fail");
    }

    let attempt = await attemptRun(profileDir, resultPath, workspaceDir);
    let retriedForInfraCrash = 0;
    let retryProfileDir = profileDir;
    let retryResultPath = resultPath;
    let retryWorkspaceDir = workspaceDir;
    while (retriedForInfraCrash < MAX_INFRA_RETRIES && isInfraCrash(attempt)) {
      retriedForInfraCrash += 1;
      console.warn(
        `  ⚠️ 检测到 Chromium 基础设施崩溃（非判据失败），重试 ${retriedForInfraCrash}/${MAX_INFRA_RETRIES}`
      );
      // 全新 profile，不复用被污染的
      reapProfileProcesses(profileDir);
      removeProfileDir(profileDir);
      retryProfileDir = createProfileDir();
      retryResultPath = join(retryProfileDir, "host-result.json");
      retryWorkspaceDir = join(retryProfileDir, "workspace");
      mkdirSync(retryWorkspaceDir, { recursive: true });
      attempt = await attemptRun(retryProfileDir, retryResultPath, retryWorkspaceDir);
    }
    if (retriedForInfraCrash > 0) {
      // 重试后的 profile 才是最终那个
      reapProfileProcesses(profileDir);
      removeProfileDir(profileDir);
      profileDir = retryProfileDir;
      resultPath = retryResultPath;
      workspaceDir = retryWorkspaceDir;
    }
    const launchError = attempt.launchError;
    const hostResult = attempt.hostResult;

    const reaped = reapProfileProcesses(profileDir);
    let profileRemoved = false;
    if (!options.keepProfile) {
      profileRemoved = removeProfileDir(profileDir);
    }

    const record = {
      scenarioId: scenario.id,
      overall: hostResult ? hostResult.overall : "fail",
      oracles: hostResult ? hostResult.oracles || [] : [],
      // ⚠️ 必须搬 delegates —— 漏了它，delegate 对账就永远读不到东西而"通过"，
      //    那会让 delegate 退化成免责声明（2026-11-03 实际漏过一次）。
      delegates: hostResult ? hostResult.delegates || [] : [],
      counts: hostResult ? hostResult.counts || null : null,
      hostError:
        (hostResult && hostResult.hostError) ||
        (launchError ? String(launchError.message || launchError) : null),
      launchFailed: Boolean(launchError),
      reapedProcesses: reaped,
      profileRemoved,
      profileDirKept: options.keepProfile ? profileDir : null,
    };
    summary.push(record);

    console.log(`${MARK[record.overall] || "❓"} ${scenario.id} → overall=${record.overall}`);
    for (const oracle of record.oracles) {
      const detail =
        typeof oracle.detail === "string"
          ? ` — ${oracle.detail}`
          : oracle.detail
            ? ` — ${JSON.stringify(oracle.detail)}`
            : "";
      console.log(`  ${MARK[oracle.status] || "❓"} ${oracle.id}${detail}`);
    }
    if (record.hostError) console.log(`  ⛔ hostError: ${record.hostError}`);
    if (reaped) console.log(`  🧹 回收 ${reaped} 个残留进程`);
    if (options.keepProfile) console.log(`  📁 profile 保留在 ${profileDir}`);
  }

  /**
   * 跨场景核对 delegate —— 「本场景不验、交给 X 验」的那些，X 必须真的验了。
   *
   * ⚠️ 不做这一步，`delegate` 就成了免责声明：
   *    只要写上 `coveredBy: 'some-scenario'` 就能把一条覆盖率挪走，
   *    而那个场景可能压根没跑 / 跑挂了 / 名字写错了。
   *    ⇒ 这是"登记册说经 X 跑而 X 不存在"的同族缺陷。
   */
  const byId = new Map(summary.map(s => [s.scenarioId, s]));
  const delegateProblems = [];
  for (const record of summary) {
    for (const item of record.delegates || []) {
      if (item.coveredBy === record.scenarioId) {
        delegateProblems.push(`${record.scenarioId} 把 "${item.id}" 交给自己`);
        continue;
      }
      const target = byId.get(item.coveredBy);
      if (!target) {
        delegateProblems.push(
          `${record.scenarioId} 把 "${item.id}" 交给不存在的场景 "${item.coveredBy}"`
        );
        continue;
      }
      if (!Array.isArray(item.requires) || item.requires.length === 0) {
        delegateProblems.push(
          `${record.scenarioId} 的 "${item.id}" 没写 requires（无法核对承接方是否真接住）`
        );
        continue;
      }
      /**
       * ⚠️ **只核对 `requires` 里列出的那几条**，不看承接场景的 overall。
       *
       * 曾用「承接场景 overall 必须 pass」，实测把委托判错了：
       * `network-scan` 有一条与"扫描命令接线"无关的 `discovers-real-device`
       * 是 `not_exercised`（本机没真设备）⇒ overall=not_exercised ⇒
       * 委托被误判失败。那是**过度要求**，会让无关的未验项污染别人的覆盖率。
       */
      const oracleStatus = new Map((target.oracles || []).map(o => [o.id, o.status]));
      for (const requiredId of item.requires) {
        const status = oracleStatus.get(requiredId);
        if (status === undefined) {
          delegateProblems.push(
            `${record.scenarioId} 的 "${item.id}" 要求承接方 "${item.coveredBy}" 有 oracle ` +
              `"${requiredId}"，但后者没有这条 oracle`
          );
        } else if (status !== "pass") {
          delegateProblems.push(
            `${record.scenarioId} 的 "${item.id}" 要求承接方 "${item.coveredBy}" 的 ` +
              `"${requiredId}" 为 pass，实际 ${status}`
          );
        }
      }
    }
  }
  if (delegateProblems.length) {
    console.error("\n❌ delegate 对账失败：");
    for (const p of delegateProblems) console.error(`  - ${p}`);
  }

  const summaryPath = join(resultDir, "summary.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        vscodeVersion: VSCODE_VERSION,
        ranAt: new Date().toISOString(),
        commit: process.env.LA_E2E_COMMIT || "unknown",
        declaredCommands,
        delegateProblems,
        scenarios: summary,
      },
      null,
      2
    )
  );
  console.log(`\n📄 汇总：${summaryPath}`);

  // ---- 退出码：**只有全 pass 才 0** ----
  if (summary.some(s => s.overall === "fail")) {
    console.error("\n❌ 有场景失败");
    return 1;
  }
  if (!options.keepProfile && summary.some(s => !s.profileRemoved)) {
    console.error("\n❌ 有 profile 目录未被清理（残留）");
    return 1;
  }
  if (delegateProblems.length) {
    console.error("\n❌ delegate 对账失败（见上）—— 有覆盖率被「交给」了没接住的场景");
    return 1;
  }
  if (summary.some(s => s.overall !== "pass")) {
    /**
     * ⚠️ **这里必须非 0**，不能 `return 0`。
     *
     * 参考仓踩过「全 skip 也算 EXIT=0」——把「没验」伪装成「验过了」。
     * 只要有任何场景不是 pass，本次运行就**不是一个"通过"的证据**，
     * 让 CI 拿到 0 等于允许它把未验证当成已验证。
     *
     * 想"只看有没有 fail"的场景，用 `--allow-incomplete` 显式声明 ——
     * **要留痕**，不能让默认行为悄悄变成 0。
     */
    console.warn("\n⚠️ 无 fail，但有 not_exercised / blocked —— 这不算通过");
    if (!options.allowIncomplete) {
      console.error("  （如需只看 fail，加 --allow-incomplete；但那不构成通过证据）");
      return 3;
    }
    console.warn("  --allow-incomplete 已指定：本次退出码不反映「未验证」部分");
    return 0;
  }
  console.log("\n✅ 全部场景通过");
  return 0;
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error("runner 崩溃：", error);
    process.exit(1);
  });
