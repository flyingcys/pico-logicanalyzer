# 发布门槛

本文档定义当前 Beta 阶段的本地、CI 和发布前检查口径。任何正式发布声明必须同时满足本文列出的自动化命令和手动 smoke test。

## 分层质量门禁

| 层级 | 目标 | 命令 | 时间上限 | 阻断级别 |
| --- | --- | --- | --- | --- |
| Quick | 快速验证类型、lint 和核心单元测试计划 | `npm run validate:local`、`npm run test:ci:quick -- --skip-install` | 2 分钟 | 必须通过 |
| Standard | 覆盖核心、集成和基础性能测试 | `npm run test:ci:standard -- --skip-install` | 10 分钟 | 合并候选必须通过 |
| Full | 覆盖核心、集成、性能、端到端和压力测试 | `npm run test:ci:full -- --skip-install` | 30 分钟 | 发布候选必须通过 |

`npm run validate:local` 只运行本地可快速完成的门禁和 CI dry-run 计划，不安装依赖，不触发长耗时测试。CI 使用 `npm run validate:ci` 和工作流中的补充 webview、driver、decoder、VSIX dry run 检查。

## 严格类型门禁现状

`npm run typecheck:strict` 当前覆盖 `src/models/*.ts` 和 `src/decoders/*.ts`，会连带检查这些入口直接依赖的协议解码器文件。该门禁启用 TypeScript `strict`、`noImplicitAny`、`strictNullChecks`、`noImplicitOverride`、`noImplicitReturns` 和 `noFallthroughCasesInSwitch`。

剩余类型债记录：

- `noUncheckedIndexedAccess` 暂未对扩大后的范围启用；开启后需要逐项收口数组和映射索引访问。
- `exactOptionalPropertyTypes` 暂未对扩大后的范围启用；开启后需要区分省略字段和显式 `undefined`。
- `noPropertyAccessFromIndexSignature` 暂未对扩大后的范围启用；开启后需要统一动态扩展字段访问方式。
- Webview lint 门禁当前要求 `npm run lint` 输出 0 warning，避免 Vue 模板格式 warning 常态化。

当前 Quick 层暂不阻断测试数量为 0。以下旧 core smoke 测试已重新纳入 Quick 阻断门禁，并通过 `npm run test:ci:quick -- --skip-install` 验证：

- `tests/unit/drivers/LogicAnalyzerDriver.core.test.ts`
- `tests/unit/models/CaptureModels.core.test.ts`
- `tests/unit/services/SessionManager.core.test.ts`
- `tests/unit/services/ConfigurationManager.basic.test.ts`

2026-04-28 在 `.worktree/03` 的分层验证结果：

- `npm run test:ci:quick -- --skip-install`：通过，14 个测试文件、373 个测试，暂不阻断测试 0 个。
- `npm run test:ci:standard -- --skip-install`：通过，18 个测试文件、383 个测试，覆盖 core、integration、performance 分组。
- `npm run test:ci:full -- --skip-install`：通过，22 个测试文件、393 个测试，覆盖 core、integration、performance、e2e、stress 分组。

## 发布前命令

发布候选至少运行以下命令，并把结果记录到对应 worktree 或发布记录中：

```bash
npm run validate:local
npm run test:ci:standard -- --skip-install
npm run test:webview:unit -- --runInBand
npm run test:drivers -- --runInBand
npm run test:decoders -- --runInBand
npm run build:production
npm run package:dry
```

正式发布前再运行：

```bash
npm run release:check
npm run test:ci:full -- --skip-install
```

## Webview bundle 预算

生产 Webview 构建必须执行 webpack performance budget。`webpack.config.js` 当前把生产 `hints` 设为 `error`，只统计运行时 `.js` / `.css` 产物，source map 和分析报告不计入运行时预算。

source map 不进入 VSIX，仅保留在本地构建目录用于定位发布候选问题。

| 项目 | 阈值 | 处理方式 |
| --- | --- | --- |
| 单个运行时 asset | 2.6 MB | 超限时 `build:production` / `build:budget` 失败 |
| 单个入口总量 | 3.0 MB | 超限时 `build:production` / `build:budget` 失败 |
| source map | 不进入 VSIX | `.vscodeignore` 排除 `*.map` 和 `out/**/*.map` |
| 分析报告 | 不进入 VSIX | `ANALYZE=true` 生成的报告仅用于本地分析 |

`npm run build:budget` 可单独验证 Webview budget；`npm run build:analyze` 会生成 bundle report 和 stats，用于定位 Element Plus、i18n、工具面板和波形引擎的体积来源。

当前策略：

- Element Plus 仍作为全局 UI 基座保留，但拆为独立 `element-plus` chunk，便于观察后续按组件引入收益。
- Vue、Pinia 拆为 `vue-vendor` chunk，避免两个入口重复沉淀。
- i18n 本地消息拆为 `i18n` chunk；后续如果继续增长，再改为按语言动态加载。
- 工具面板和波形引擎暂不做首屏 lazy load，因为当前主界面打开 `.lac` 后需要立即渲染波形和侧栏状态；后续由任务 04 的 UI 流程改动统一评估。

## VSIX smoke test

1. 运行 `npm run package` 生成 VSIX。
2. 在干净 VSCode 配置目录中安装 VSIX。
3. 打开一个最小 `.lac` 文件，确认自定义编辑器加载成功。
4. 执行 `Logic Analyzer: Connect Device`，无设备环境应给出明确错误，不应卡死。
5. 执行 `Logic Analyzer: Create Synthetic Capture`，确认命令失败或成功路径均有可见反馈。
6. 卸载 VSIX，并确认没有遗留临时工作区文件。

## 发布阻断条件

- `typecheck`、`typecheck:strict`、`lint` 任一失败。
- Quick 层或发布候选指定测试失败。
- `build:production` 或 `package:dry` 失败。
- README、CHANGELOG、RELEASE_NOTES 声明的能力没有功能状态矩阵或硬件认证矩阵证据。
- 真实硬件能力被写成已验证，但 `docs/真实硬件认证矩阵.md` 没有对应记录。
- `npm run test:unit` 出现长时间无输出时，不能用全量单元测试结果作为发布证据，必须改用分层命令定位并记录风险。
- 暂不阻断测试数量增加，或已有暂不阻断测试没有对应 worktree 风险记录。
