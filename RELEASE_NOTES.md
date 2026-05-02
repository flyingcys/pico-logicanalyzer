# Pico 逻辑分析器 VSCode 扩展发布说明

> **版本**: 1.0.0-beta.0
> **状态**: Beta / 工程整备
> **发布日期**: 待定

## 本轮重点

当前版本用于收敛 VSCode 扩展工程、Vue3 Webview、硬件抽象层、基础解码器、`.lac` 文件处理和质量门禁。它不是正式生产版本，真实硬件支持、原版 parity 和全量测试稳定性仍在推进中。

## 当前工程基线

- VSCode 扩展入口和 `.lac` 自定义编辑器框架已存在。
- Vue3 Webview、波形渲染框架和主机通信基础结构已存在。
- Pico、Saleae、Rigol/Siglent、sigrok 等硬件方向已有适配框架，但真实支持状态必须以 `docs/真实硬件认证矩阵.md` 为准。
- I2C、SPI、UART 基础解码器已存在，后续需要 sigrok golden 对齐。
- `typecheck`、分阶段 `typecheck:strict`、webview 单元测试、生产构建已有当前基线记录。
- 2026-05-02 已 fresh 通过 `quick/standard/full` 分层门禁、`release:check`，并继续收口 `.lac` 导出 `SelectedRegions` 主链路与 frontend strict gate。
- Driver SDK 模板用于脚手架和协议接入参考，生成包默认质量等级为 `experimental`。

## 质量门禁

发布候选必须按 `docs/release-gate.md` 执行：

- `npm run validate:local`
- `npm run test:ci:standard -- --skip-install`
- `npm run test:webview:unit -- --runInBand`
- `npm run test:drivers -- --runInBand`
- `npm run test:decoders -- --runInBand`
- `npm run build:production`
- `npm run package:dry`

`npm run package:dry` 只验证 VSIX 清单，不生成可安装 VSIX，也不是干净 VSCode 安装 smoke。正式发布前还需要执行 `npm run release:check`、`npm run test:ci:full -- --skip-install`、`npm run package` 和 VSIX smoke test。

## VSIX smoke 记录

本轮仅保留 Beta 候选 smoke 证据。可自动记录的 VSIX 文件、sha256 和环境信息已收集；2026-05-02 已尝试 `code` CLI 自动 smoke，但当前环境缺少可连接的 VS Code IPC server，因此安装/打开/卸载链路记为环境阻断，不能写成通过。

- smoke 环境：Node.js `v22.20.0`、npm `10.9.3`、VSCode CLI `1.117.0`
- commit：`b11f7249`（`b11f7249807fa4ad894b8e9815cb223fcbb28b0a`）
- VSIX 文件名：`vscode-logic-analyzer-1.0.0-beta.0.vsix`
- VSIX sha256：`4011c220d29394892ab3b2684fac0ab07f8d4bab6bfc7e9953fe29689989b384`
- 最小 `.lac` fixture：`tests/fixtures/lac/current-lowercase-samples.lac`
- 发布 smoke 记录：`docs/release-smoke/2026-04-30-vsix-smoke.md`
- 截图记录：pending
- 结论：pending，不能作为正式发布通过结论；正式发布前必须按 `docs/release-gate.md` 补齐 GUI 项。

| smoke 项 | 当前状态 | 证据 |
| --- | --- | --- |
| 运行 `npm run package` 生成 VSIX | 已通过 | `vscode-logic-analyzer-1.0.0-beta.0.vsix`，783457 bytes，sha256 见上 |
| 干净 VSCode 用户数据目录安装 VSIX | blocked | 当前环境 `code` CLI 返回 `ENOENT`，缺少可连接的 VS Code IPC server |
| 打开最小 `.lac` 文件 | blocked | 当前环境 `code` CLI 返回 `ENOENT`，缺少可连接的 VS Code IPC server |
| 无设备环境执行 `Logic Analyzer: Connect Device` | blocked | 依赖可连接的 VS Code GUI / IPC 环境 |
| 执行 `Logic Analyzer: Create Synthetic Capture` | blocked | 依赖可连接的 VS Code GUI / IPC 环境 |
| 卸载 VSIX 并检查残留 | blocked | 当前环境 `code` CLI 返回 `ENOENT`，缺少可连接的 VS Code IPC server |

## 已知限制

- 全量 `npm run test:unit` 曾出现长时间无输出，当前不作为发布证据。
- Webview 生产构建仍有 webpack 体积警告。
- 原版 `.lac` 兼容、真实波形工作流、设备采集 UI、解码器 golden、marker/测量/编辑、硬件认证、CLI/TUI、DSL 合成采集分别由后续 worktree 收口。
- HTML/PDF/ZIP/项目包导出仍为实验性或规划能力；当前发布说明不得声明 PDF 报告、HTML 报告或项目包导出已经可作为用户主链路。
- SDK 自动生成的 `html/pdf` 文档输出当前仍是 Markdown 文本写入对应扩展名，不代表报告生成能力。
- README、功能状态矩阵、硬件认证矩阵和文档状态索引是当前能力声明的准入口。

## 升级和安装

当前阶段建议从源码构建 VSIX 后在测试环境安装，不建议面向最终用户发布。

```bash
npm ci
npm run validate:local
npm run build:production
npm run package
```
