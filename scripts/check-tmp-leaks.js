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

/** 「建临时目录」的特征。 */
const CREATE_RE = /\bmkdtemp(Sync)?\s*\(/u;

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

/** 分析单个文件：返回 { creates, hasCleanup }。 */
function analyzeFile(path) {
  let source;
  try {
    source = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  if (!CREATE_RE.test(source)) return null;
  const creates = (source.match(/\bmkdtemp(Sync)?\s*\(/gu) || []).length;
  return {
    creates,
    hasCleanup: CLEANUP_RE.test(source),
  };
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
      leaks.push({
        file: relative(ROOT, file),
        creates: result.creates,
      });
    }
  }

  console.log(`扫描文件数: ${files.length}`);

  if (leaks.length === 0) {
    console.log('✅ 无临时目录泄漏（所有含 mkdtemp 的文件都有清理特征）');
    return 0;
  }

  console.log(`❌ 发现 ${leaks.length} 个文件建了临时目录但没有清理特征：\n`);
  for (const leak of leaks) {
    console.log(`   ${leak.file}  (${leak.creates} 处 mkdtemp)`);
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
