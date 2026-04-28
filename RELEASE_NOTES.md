# Pico Logic Analyzer VSCode Extension - 发布说明

> **版本**: 1.0.0-beta.0
> **状态**: Beta / 工程整备
> **发布日期**: 待定

## 本轮重点

当前版本用于收敛 VSCode 扩展工程、Vue3 Webview、硬件抽象层、基础解码器、`.lac` 文件处理和质量门禁。它不是正式生产版本，真实硬件支持、原版 parity 和全量测试稳定性仍在推进中。

## 已验证能力

- VSCode 扩展入口和 `.lac` 自定义编辑器框架已存在。
- Vue3 Webview、波形渲染框架和主机通信基础结构已存在。
- Pico、Saleae、Rigol/Siglent、sigrok 等硬件方向已有适配框架，但真实支持状态必须以 `docs/真实硬件认证矩阵.md` 为准。
- I2C、SPI、UART 基础解码器已存在，后续需要 sigrok golden 对齐。
- `typecheck`、分阶段 `typecheck:strict`、webview 单元测试、生产构建已有当前基线记录。

## 质量门禁

发布候选必须按 `docs/release-gate.md` 执行：

- `npm run validate:local`
- `npm run test:ci:standard -- --skip-install`
- `npm run test:webview:unit -- --runInBand`
- `npm run test:drivers -- --runInBand`
- `npm run test:decoders -- --runInBand`
- `npm run build:production`
- `npm run package:dry`

正式发布前还需要执行 `npm run release:check`、`npm run test:ci:full -- --skip-install` 和 VSIX smoke test。

## 已知限制

- 全量 `npm run test:unit` 曾出现长时间无输出，当前不作为发布证据。
- Webview 生产构建仍有 webpack 体积警告。
- 原版 `.lac` 兼容、真实波形工作流、设备采集 UI、解码器 golden、marker/测量/编辑、硬件认证、CLI/TUI、DSL 合成采集分别由后续 worktree 收口。
- README、功能状态矩阵、硬件认证矩阵和文档状态索引是当前能力声明的准入口。

## 升级和安装

当前阶段建议从源码构建 VSIX 后在测试环境安装，不建议面向最终用户发布。

```bash
npm ci
npm run validate:local
npm run build:production
npm run package
```
