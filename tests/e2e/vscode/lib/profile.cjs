"use strict";

/**
 * 真宿主 e2e —— profile 隔离与清理。
 *
 * 每个场景一套独立 profile（`--user-data-dir` + `--extensions-dir`），
 * 跑完连进程带目录一起收掉。这是跨场景污染的通用解法，与业务无关。
 *
 * ## 为什么必须按 `--user-data-dir` 匹配进程，而不是按 "code" 进程名
 *
 * 本机可能同时开着**用户自己的 VS Code**。按进程名匹配会把它一起杀掉。
 * 只认命令行里带本场景 profile 路径的那些进程。
 *
 * ⚠️ 引号形态有两种：`--user-data-dir=/path` 与 `"--user-data-dir=/path"`，
 * 路径含空格时后者才出现 —— **两种都要匹配**，否则带空格的 /tmp 路径会漏杀。
 */

const { execFileSync } = require("node:child_process");
const { existsSync, mkdtempSync, readdirSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

/** 本 runner 创建的 profile 目录前缀。用于扫历史残留。 */
const PROFILE_PREFIX = "la-vscode-e2e-";

/** 新建一个隔离 profile 目录。 */
function createProfileDir() {
  return mkdtempSync(join(tmpdir(), PROFILE_PREFIX));
}

/**
 * 判断某条命令行是否属于给定 profile。
 *
 * 两种引号形态都要命中 —— 见文件头说明。
 */
function matchesProfileCommand(commandLine, profileDir) {
  if (!commandLine || !profileDir) return false;
  const needle = `--user-data-dir=${profileDir}`;
  return commandLine.includes(needle) || commandLine.includes(`"${needle}"`);
}

/** 同步 sleep —— 清理路径上不需要事件循环。 */
function sleepSync(ms) {
  const shared = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(shared), 0, 0, ms);
}

/**
 * 杀掉命令行里带该 profile 的全部进程。
 *
 * 先 SIGTERM 再 SIGKILL：VS Code 收到 SIGTERM 会走正常退出并回收 renderer，
 * 直接 SIGKILL 会留一堆孤儿。
 *
 * @returns {number} 实际发出过信号的进程数（0 表示本来就干净）
 */
function reapProfileProcesses(profileDir) {
  let entries = [];
  try {
    entries = readdirSync("/proc");
  } catch {
    return 0;
  }

  const pids = [];
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === process.pid) continue;
    let cmdline = "";
    try {
      // /proc/<pid>/cmdline 是 NUL 分隔的 argv
      cmdline = execFileSync("cat", [`/proc/${pid}/cmdline`], { encoding: "utf8" })
        .split("\0")
        .join(" ");
    } catch {
      continue;
    }
    if (matchesProfileCommand(cmdline, profileDir)) {
      pids.push(pid);
    }
  }

  if (pids.length === 0) return 0;

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* 已经退了 */
    }
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const alive = pids.filter(pid => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
    if (alive.length === 0) break;
    sleepSync(200);
  }
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* 已经退了 */
    }
  }
  return pids.length;
}

/**
 * 删除 profile 目录。删不掉**不抛**，返回 false 由调用方记进 manifest。
 *
 * 为什么不抛：profile 里可能还有刚被 SIGKILL 的进程持有的句柄，
 * 删失败是时序问题不是缺陷；但**必须记录**，否则"跑完不留残留"成了空话。
 */
function removeProfileDir(profileDir) {
  try {
    rmSync(profileDir, { recursive: true, force: true });
    return !existsSync(profileDir);
  } catch {
    return false;
  }
}

/**
 * 扫掉历史残留的 profile 目录。
 *
 * 为什么需要：上一次跑被 Ctrl-C 打断时 `finally` 不一定执行，
 * 残留目录会一直堆在 /tmp。只删前缀匹配的，**不碰别人的目录**。
 */
function sweepStaleProfileDirs() {
  const removed = [];
  let entries = [];
  try {
    entries = readdirSync(tmpdir());
  } catch {
    return removed;
  }
  for (const name of entries) {
    if (!name.startsWith(PROFILE_PREFIX)) continue;
    const full = join(tmpdir(), name);
    reapProfileProcesses(full);
    if (removeProfileDir(full)) removed.push(full);
  }
  return removed;
}

module.exports = {
  PROFILE_PREFIX,
  createProfileDir,
  matchesProfileCommand,
  reapProfileProcesses,
  removeProfileDir,
  sweepStaleProfileDirs,
};
