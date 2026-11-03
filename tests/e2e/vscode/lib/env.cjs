"use strict";

/**
 * 真宿主 e2e —— 环境前置检查。
 *
 * 三条都在"跑之前"拦，且**每条都要自证原因**（不静默跳过）：
 *   1. 没有 DISPLAY 且没有 xvfb → 直接失败并提示 `xvfb-run -a`
 *   2. 扩展产物 `out/extension.js` 缺失 → 直接失败并提示先 build
 *      （症状会是"扩展加载失败"，指向不明，所以必须前置拦）
 */

const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

/** 检查 DISPLAY。返回 { ok, message }。 */
function checkDisplay(env = process.env) {
  if (env.DISPLAY && env.DISPLAY.trim() !== "") {
    return { ok: true, message: `DISPLAY=${env.DISPLAY}` };
  }
  const hasXvfb = existsSync("/usr/bin/xvfb-run");
  return {
    ok: false,
    message: hasXvfb
      ? "没有 DISPLAY。请用 `npm run test:e2e`（它已内置 xvfb-run -a），或 `xvfb-run -a node tests/e2e/vscode/lib/runner.cjs`。"
      : "没有 DISPLAY，且本机没有 xvfb-run。本环境的真宿主 e2e 无法运行 —— 这是环境缺失，不是用例通过。",
  };
}

/**
 * 检查扩展构建产物。
 *
 * `package.json` 的 `main` 指向 `out/extension.js`，缺它则扩展加载失败。
 * 那个症状（"扩展不可用"）指向不明，所以前置拦。
 */
function checkExtensionBuild(root) {
  const entry = join(root, "out", "extension.js");
  const webviewHtml = join(root, "out", "webview", "html", "index.html");
  const missing = [];
  if (!existsSync(entry)) missing.push("out/extension.js");
  if (!existsSync(webviewHtml)) missing.push("out/webview/html/index.html");
  if (missing.length === 0) return { ok: true, message: "扩展产物齐备" };
  return {
    ok: false,
    message: `扩展产物缺失：${missing.join(", ")}。请先 \`npm run build\`（真宿主加载的是 out/ 不是 src/）。`,
  };
}

/**
 * 读 package.json 的 contributes.commands —— **用例的期望值来源**。
 *
 * ⚠️ 刻意**不在测试里硬编码命令清单**：硬编码会与产品各自漂移
 * （加了命令忘补断言 ⇒ 新命令零覆盖而没人知道）。
 * 从 manifest 读则"加了命令就自动纳入断言"。
 */
function readDeclaredCommands(root) {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const commands = manifest.contributes?.commands ?? [];
  return commands.map(entry => entry.command).filter(name => typeof name === "string");
}

module.exports = { checkDisplay, checkExtensionBuild, readDeclaredCommands };
