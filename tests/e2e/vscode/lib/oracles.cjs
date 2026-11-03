"use strict";

/**
 * 真宿主 e2e —— 结果契约。
 *
 * ## 为什么每场景要落一份 JSON 而不是只靠退出码
 *
 * 退出码只有 0/1，**证不了"验了几条、哪条没验"**。而 e2e 最容易出的问题是
 * 「全 skip 也算 EXIT=0」—— 把「没验」伪装成「验过了」。
 * 所以每个场景必须落一份可机读记录，且**记录里带 not_exercised 与原因**。
 *
 * ## 状态值域（与 venus-studio / embedded-studio 同源，便于跨仓对齐）
 *
 *   pass           —— 断言真的跑了并成立
 *   fail           —— 断言跑了但不成立
 *   not_exercised  —— 本环境跑不到（缺板/缺工具），**必须带原因**
 *   blocked        —— 被产品侧的门挡住（如模态确认），**必须带原因与代码位置**
 *
 * ## ⚠️ 「按分工交给别的场景」不是 oracle —— 用 `delegate()` 单独记
 *
 * 曾经把「本场景不验、由 open-analyzer 场景验」也记成 `not_exercised`，
 * 后果是**整体永远不可能 pass**（每个场景都挂着几条"没验"）。
 * 但那是**分工**，不是"没验"—— 只要那个场景真的验了，这件事就被验了。
 *
 * ⇒ 分工用 `delegate(id, reason)` 记进 `delegates`，**不进 overall 计算**，
 *   但仍落在记录里（不做出无痕：后人能看到"这条没人管"还是"交给谁了"）。
 *   谁来核"承接方真的验了"？由 runner 的汇总层跨场景核对（见 summary.json）。
 */

const { writeFileSync } = require("node:fs");

const ORACLE_STATUSES = ["pass", "fail", "not_exercised", "blocked"];

/**
 * 建一个 oracle 收集器。
 *
 * 用法：
 *   const o = createOracleCollector();
 *   o.record("commands-registered", "pass", { count: 9 });
 *   o.record("capture-from-hardware", "not_exercised", "本机未烧逻辑分析器固件（用户裁定暂不写板）");
 *   o.finish();  // → { oracles: [...], overall: 'pass'|'fail'|'not_exercised'|'blocked' }
 */
function createOracleCollector() {
  const oracles = [];
  const delegates = [];

  function record(id, status, detail) {
    if (!ORACLE_STATUSES.includes(status)) {
      throw new Error(`非法 oracle 状态 "${status}"（id=${id}）。值域：${ORACLE_STATUSES.join("|")}`);
    }
    oracles.push({
      id,
      status,
      detail: typeof detail === "string" ? detail : detail === undefined ? null : detail,
      at: new Date().toISOString(),
    });
  }

  /**
   * 登记「这件事本场景不验，交给别的场景验」。
   *
   * `coveredBy` 必须是**已注册的场景 id**。写一个不存在的 ⇒ 汇总层报错
   * （防"登记册说经 X 跑而 X 不存在"）。
   *
   * ## ⚠️ `requires`：只核对「你关心的那几条 oracle」，不是「承接场景整体 pass」
   *
   * 第一版是"承接场景 overall 必须 pass"。实测立刻出问题：
   * `commands-coverage` 把「扫描命令」委托给 `network-scan`，而后者因为
   * 有一条 `discovers-real-device` 是 `not_exercised`（本机没真设备），
   * overall 成了 `not_exercised` ⇒ **委托被判失败**。
   *
   * 但那是**过度要求**：`commands-coverage` 只关心"扫描命令通不通"，
   * 不关心"能不能真发现一台设备"。用整体 pass 去卡，等于让一条无关的
   * `not_exercised` 把别的场景的覆盖率也拖下水。
   *
   * ⇒ 必须显式列出**承接方哪几条 oracle 才算接住了**：
   * ```js
   * oracles.delegate("not-executed:scanNetworkDevices", "由 network-scan 验扫描行为",
   *                  "network-scan", ["scan-completes-in-budget", "stats-observable"]);
   * ```
   *
   * 不给 `requires` ⇒ **报错**（不允许"承接场景整体 pass"这种模糊判据 ——
   * 那正是本次踩到的坑）。
   */
  function delegate(id, reason, coveredBy, requires) {
    if (typeof coveredBy !== "string" || !coveredBy) {
      throw new Error(`delegate(${id}) 必须给出 coveredBy（承接场景 id）`);
    }
    if (!Array.isArray(requires) || requires.length === 0) {
      throw new Error(
        `delegate(${id}) 必须给出 requires（承接方哪几条 oracle 才算接住）。` +
          "原因：用『承接场景整体 pass』判会过度要求 —— 承接方一条无关的 not_exercised 会把本委托拖红。"
      );
    }
    delegates.push({ id, reason, coveredBy, requires });
  }

  /**
   * 汇总。**最差状态优先**：fail > blocked > not_exercised > pass。
   *
   * 这个优先级是刻意的：
   * - 有任何 fail   ⇒ overall 就是 fail（不能因为还有别的 pass 而冲淡）
   * - 无 fail 有 blocked ⇒ blocked（有东西被挡住，不能说通过）
   * - 只有 pass + not_exercised ⇒ not_exercised（部分未验，不能说 covered）
   * 也就是说 **只有全 pass 才得到 pass**。
   *
   * ## ⚠️ 零 oracle ⇒ `not_exercised`，**绝不能是 pass**
   *
   * 实测过的假绿（2026-11-03）：场景在第一条 oracle 之前就抛异常，
   * `host-driver` 先把结果 JSON 写盘再 throw ⇒ 落盘的 `oracles: []`
   * ⇒ 旧实现 `some(...)` 全为 false ⇒ `overall: "pass"`。
   *
   * 语义上也讲不通：**「一条都没验」不是「全部通过」**。
   * 这与项目铁律「全 skip 也算 EXIT=0 是伪装」是同一条。
   */
  function overall() {
    if (oracles.some(o => o.status === "fail")) return "fail";
    if (oracles.some(o => o.status === "blocked")) return "blocked";
    if (oracles.some(o => o.status === "not_exercised")) return "not_exercised";
    if (oracles.length === 0) return "not_exercised";
    return "pass";
  }

  function counts() {
    const c = { pass: 0, fail: 0, not_exercised: 0, blocked: 0 };
    for (const o of oracles) c[o.status] += 1;
    return c;
  }

  function finish() {
    return { oracles, delegates, overall: overall(), counts: counts() };
  }

  return { record, delegate, finish, overall, counts, oracles, delegates };
}

module.exports = { ORACLE_STATUSES, createOracleCollector };
