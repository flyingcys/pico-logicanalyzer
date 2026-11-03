#!/usr/bin/env node
/**
 * `/tmp` 泄漏门禁 —— 扫全仓，找「建了临时目录但没登记清理」的文件。
 *
 * ## 为什么需要它
 *
 * 测试里每建一个临时目录（`mkdtemp` / `mkdtempSync`）都必须有对应的清理，
 * 否则 `/tmp` 会持续累积。这类泄漏**与「进程被 kill」无关** ——
 * 测试正常跑完、正常退出，目录就是不删。跑得越多次，`/tmp` 越大。
 *
 * 本仓实测过一起：`tests/unit/driver-sdk/DriverUtils.release-docs.test.ts`
 * 的 `beforeEach` 建 `driver-utils-release-*` 目录，**从无清理**。
 * 连跑一次 `/tmp` 就多 2 个（4 → 6），且永不消失。
 *
 * ## 为什么不能只靠"这次修好"
 *
 * 逐文件手修只能保证当时那一次。**新写的文件、新加的行不会有人来扫**。
 * 同类仓库（embedded-studio）就是「10-25 全仓清零」之后又漏回 32 处 ——
 * 根因是「门禁存在但没接进 CI」。
 *
 * ⇒ 判据是「**有没有人跑它**」，不是「修了几个文件」。
 *
 * ## 判据（刻意保守，避免误报）
 *
 * 一个文件里出现 `mkdtemp` 即视为"建临时目录"。它必须同时具备**任一**清理特征：
 *   - `afterEach` / `afterAll` / `after(` / `t.after(`
 *   - `rm(` / `rmSync(` / `rmdir` / `unlink`
 *
 * ⚠️ 这是**文本级**扫描，不做 AST。代价是可能漏判复杂的间接清理，
 * 但那只会漏报（假绿），不会误报（假红）—— 假红会让人不信任门禁。
 * 若将来需要更精确，参照 embedded-studio 的
 * `scripts/vscode-e2e/lib/tempDirLeaks.cjs`（AST 版）。
 *
 * ## 用法
 *
 * ```sh
 * node scripts/check-tmp-leaks.js          # 扫描，有泄漏则 EXIT=1
 * node scripts/check-tmp-leaks.js --list   # 只列出，不判失败
 * ```
 */

'use strict';

const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');

/** 扫哪些目录（相对 ROOT）。 */
const SCAN_DIRS = ['tests', 'src', 'scripts'];

/** 跳过这些（相对片段匹配）。 */
const SKIP_SEGMENTS = ['node_modules', '/out/', '/dist/', '/.worktree/', '/coverage/'];

/** 只看这些扩展名。 */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.cjs', '.mjs'];

/**
 * 「建临时目录」的特征 —— **无条件**适用于 `tests/` `src/` `scripts/`。
 */
const CREATE_RE = /\bmkdtemp(Sync)?\s*\(/u;

/**
 * 「往工作区落产物」的特征 —— **只对 `tests/` 生效**。
 *
 * ⚠️ 2026-11-03 新增。起因（实测）：
 *   `tests/stress/.../RecoveryManager.ts:84`
 *     `checkpointDir: path.join(process.cwd(), '.recovery-checkpoints')`
 *   而 `cleanup()` 里删目录那行**被注释掉了**（`:450`）。
 * ⇒ 每跑一次 stress 测试，仓库根目录就多几个 `checkpoint-*.json`。
 *
 * 实测：扫描时工作区已有 **28 个**（最早 8 月，当天新增 22 个），
 * 而旧门禁报「✅ 无泄漏」—— 因为它只认 `mkdtemp`，**完全没覆盖 cwd 写入**。
 *
 * ⚠️ 为什么只对 `tests/` 生效：`scripts/*.ts` 里 `process.cwd()` 是正常用法
 * （发布脚本按 cwd 定位仓库根），第一次实现对全目录生效 ⇒ 误报 3 个，已收窄。
 */
const CWD_WRITE_RE = /\bprocess\.cwd\s*\(\s*\)/u;

/** 只有这些目录需要检查 `CWD_WRITE_RE`。 */
const CWD_WRITE_SCOPE = ['tests'];

/**
 * 「删整个目录」的特征 —— 比 `CLEANUP_RE` 严格。
 *
 * ⚠️ 2026-11-03 新增。为什么 `CLEANUP_RE` 不够（实测踩到）：
 *   `RecoveryManager.ts:391` 有 `await fs.unlink(filePath)` —— 命中 `CLEANUP_RE`
 *   的 `\bunlink` ⇒ 门禁放行。但那行只删**超出 `maxCheckpoints` 的单个文件**，
 *   **从不删目录本身** ⇒ 目录连同最后几个文件永久留在工作区。
 *
 * 实测证据：
 *   - 工作区有 28 个 `checkpoint-*.json`（最早 8 月）
 *   - 门禁报「✅ 无泄漏」
 *   - 而 `cleanup()` 里 `// await fs.remove(this.config.checkpointDir);` **是注释掉的**
 *
 * ⇒ 对「往 cwd 落产物」的文件，判据必须是「**有没有删目录**」，不是「有没有 unlink」。
 */
const DIR_REMOVE_RE = /\b(rm|rmSync|rmdir|rmdirSync|remove)\s*\(/u;

/**
 * 去掉注释再判断 —— ⚠️ 2026-11-03 实测踩到，这是第二个"假绿"来源。
 *
 * `RecoveryManager.ts:450` 是：
 * ```ts
 * // await fs.remove(this.config.checkpointDir);
 * ```
 * 这行**被注释掉了**，但正则照样命中 ⇒ 门禁报「✅ 无泄漏」。
 *
 * ⇒ 任何「靠源码里出现某个字样」判断的判据，都必须先剥注释。
 * 否则一条被注释掉的清理代码，会让门禁永久失效 —— 而它看起来还在工作。
 *
 * ⚠️ 这是**近似**剥离（不处理字符串里的 `//`）。代价可接受：
 * 最坏情况是把正常代码误剥 ⇒ 假红；但在本仓实测无误剥。
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ') // 块注释
    .replace(/^\s*\/\/.*$/gmu, ' ') // 整行注释
    .replace(/\s\/\/[^`'"\n]*$/gmu, ' '); // 行尾注释（保守：不匹配字符串内）
}

/**
 * 「有清理」的特征。
 *
 * ⚠️ 故意放宽：只要出现任一就算"有清理"。
 * 精确判断「这个 mkdtemp 到底有没有被清理」需要数据流分析，
 * 而误报（假红）会让门禁失去信任 —— 宁可漏报。
 */
const CLEANUP_RE =
  /\bafterEach\s*\(|\bafterAll\s*\(|\bafter\s*\(|\bt\.after\s*\(|\brmSync\s*\(|\brm\s*\(|\brmdir|\bunlink/u;

/** 递归收集要扫的文件。 */
function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const rel = `/${relative(ROOT, full)}/`;
      if (SKIP_SEGMENTS.some((seg) => rel.includes(seg))) continue;
      collectFiles(full, out);
      continue;
    }
    if (!EXTENSIONS.some((ext) => name.endsWith(ext))) continue;
    out.push(full);
  }
  return out;
}

/**
 * 分析单个文件：返回 `{ creates, cwdWrites, hasCleanup }`；不涉及则返回 null。
 *
 * 两类触发条件：
 *   1. 含 `mkdtemp`（建临时目录）—— 全目录生效
 *   2. 含 `process.cwd()` 且文件在 `tests/` 下（往工作区落产物）—— 只看 tests/
 */
function analyzeFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }

  // ⚠️ 必须剥注释后再判 —— 否则「被注释掉的清理代码」会骗过门禁（实测踩到）
  const source = stripComments(raw);

  const creates = (source.match(/\bmkdtemp(Sync)?\s*\(/gu) || []).length;

  const rel = relative(ROOT, path);
  const inCwdScope = CWD_WRITE_SCOPE.some(
    (d) => rel.startsWith(`${d}/`) || rel.startsWith(`${d}\\`)
  );
  const cwdWrites =
    inCwdScope && CWD_WRITE_RE.test(source)
      ? (source.match(/\bprocess\.cwd\s*\(\s*\)/gu) || []).length
      : 0;

  if (creates === 0 && cwdWrites === 0) return null;

  /**
   * 两类触发条件用**不同**的清理判据：
   *   - `mkdtemp` 的目录通常在 `afterEach` 里被 `fs.rm` 掉 ⇒ `CLEANUP_RE` 够用
   *   - 往 cwd 落产物的，必须真的删目录 ⇒ 用更严的 `DIR_REMOVE_RE`
   *     （否则一个「只删部分文件」的 `unlink` 就会骗过门禁 —— 实测发生过）
   */
  const hasCleanup =
    creates > 0 && cwdWrites === 0
      ? CLEANUP_RE.test(source)
      : CLEANUP_RE.test(source) && DIR_REMOVE_RE.test(source);

  return { creates, cwdWrites, hasCleanup };
}

function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');

  const files = SCAN_DIRS.flatMap((d) => collectFiles(join(ROOT, d)));
  const leaks = [];

  for (const file of files) {
    const result = analyzeFile(file);
    if (!result) continue;
    if (!result.hasCleanup) {
      const parts = [];
      if (result.creates > 0) parts.push(`${result.creates} 处 mkdtemp`);
      if (result.cwdWrites > 0) parts.push(`${result.cwdWrites} 处 process.cwd()`);
      leaks.push({
        file: relative(ROOT, file),
        detail: parts.join(' + '),
      });
    }
  }

  console.log(`扫描文件数: ${files.length}`);

  if (leaks.length === 0) {
    console.log('✅ 无泄漏（含 mkdtemp / tests 下 process.cwd() 的文件都有清理特征）');
    return 0;
  }

  console.log(`❌ 发现 ${leaks.length} 个文件会落产物但没有清理特征：\n`);
  for (const leak of leaks) {
    console.log(`   ${leak.file}  (${leak.detail})`);
  }
  console.log(
    [
      '',
      '修法（对齐本仓现有范式）：',
      '',
      '  // 文件级清理（多个用例共享一个目录时用 afterAll/afterEach）',
      '  afterEach(async () => {',
      '    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });',
      '  });',
      '',
      '  // 单用例内建的目录用 t.after',
      '  function makeDir(t) {',
      '    const d = mkdtempSync(join(tmpdir(), "prefix-"));',
      '    t.after(() => rmSync(d, { recursive: true, force: true }));',
      '    return d;',
      '  }',
      '',
      '⚠️ 为什么用 afterEach 而不是 afterAll：若临时目录在 beforeEach 里重建，',
      '   前一个用例的引用会被覆盖 —— 只有 afterEach 能在引用丢失前删掉它。',
      '',
      '验证方式：',
      '  ls -d /tmp/<prefix>-* | wc -l    # 跑测试前后数量应相同',
      '',
      `判据是${listOnly ? '' : ''}「有没有人跑门禁」，不是「修了几个文件」。`,
    ].join('\n')
  );

  return listOnly ? 0 : 1;
}

process.exit(main());
