# 当前项目闭环自动推进执行文档

更新时间：2026-04-28

## 目标

把当前 VSCode 逻辑分析器项目推进到第一版“可以打开并正常使用”的闭环状态。这里的“正常使用”按分层证据定义：

| 层级 | 定义 | 当前目标 |
| --- | --- | --- |
| 软件闭环 | `.lac` 可打开、波形可显示、I2C 可解码、导出/保存链路可用、构建和核心测试通过 | 必须自动完成 |
| VSIX 闭环 | 生产构建和 VSIX 文件清单可生成，干净 VSCode 安装后能打开 `.lac` | 自动完成构建清单，人工安装 smoke 只记录为发布前步骤 |
| 硬件闭环 | 真实 Pico / Pico W / Pico 2 采集 I2C 总线，有 `.lac` hash、截图和认证矩阵记录 | 没有设备时不能伪造，只保留待硬件认证 |
| 原版 parity 闭环 | 对齐原版 `logicanalyzer` 的采集、查看、编辑、解码、保存、CLI/TUI 和多设备关键工作流 | 分阶段推进，不把更多协议数量作为首轮阻断项 |

## 当前基线

已自动验证：

- `npm run typecheck` 通过。
- `npm run typecheck:strict` 通过。
- `npm run lint` 通过。
- `npm run test:webview:unit -- --runInBand` 通过，2 个测试套件、66 个测试。
- `npm run test:decoders -- --runInBand` 通过，5 个测试套件、142 个测试。
- `npm run build:frontend:html` 通过。
- `npm run test:webview:smoke` 通过；I2C 解码 smoke 已移除页面注入 mock，改由 HTML host 的 `runDecoder` 路径返回带 `I²C HTML 模拟` 标记的可复现结果，采集入口检查改为 UI 按钮状态。
- `npm run build:production` 通过。
- `npm run package:dry` 通过。
- `npm run test:ci:quick -- --skip-install` 通过，14 个核心测试文件通过。

已实现的关键链路：

- `src/providers/LACEditorProvider.ts` 已支持 `runDecoder` host command。
- `src/frontend/core/stores/decoderStore.ts` 已支持 I2C 映射、执行状态、结果、错误和最后一次解码器名称。
- `src/frontend/app/components/AppSidebarRight.vue` 已有右侧 I2C 解码 UI，并会显示 HTML 调试宿主的模拟标记。
- `src/frontend/app/components/AppWaveformStage.vue` 已接入真实 `.lac` 样本显示、缩放、预览、选择、区域、测量和样本编辑入口。
- `src/drivers/LogicAnalyzerDriver.ts` 已覆盖 Pico 采集启动确认、串口 parser 暂停、非连续真实通道取位、Blast 校验、stop、blink 和原版请求 fixture。

## 自动推进原则

1. 只推进可以在本环境自动验证的软件任务。
2. 不伪造真实硬件结果；硬件认证必须保留为 `pending` 或 `blocked-by-hardware`。
3. 不把“更多协议解析”作为第一版正常使用阻断项。
4. 所有 Markdown 文档使用中文。
5. 所有 shell 命令使用 `rtk` 前缀。
6. worktree 如需创建，统一放在项目根目录 `.worktree/` 下。

## 本轮自动执行任务

### 任务 A：去掉浏览器 I2C smoke 的注入 mock

目标：HTML/browser smoke 不再在测试脚本中覆盖 `context.host.sendCommand`，而是由 `browserHost` 自己提供可复现的 `runDecoder` 模拟能力。该能力只用于 HTML 调试宿主，不替代 VSCode host 的真实 `DecoderManager` 路径。

验收：

- `tests/unit/webview/main.test.ts` 增加 HTML host `runDecoder` 成功和错误路径。
- `tests/unit/webview/webview-browser-smoke.js` 不再调用 `installRunDecoderMock()`。
- `npm run test:webview:unit -- --runInBand` 通过。
- `npm run build:frontend:html` 通过。
- `npm run test:webview:smoke` 通过。

### 任务 B：降低解码器测试日志噪音

目标：保留功能行为，移除核心解码器测试中的重复 `console.log` 噪音，避免 CI 输出被注册日志和 I2C bitrate 日志淹没。

验收：

- `DecoderManager` 注册内置解码器不再默认输出多条日志。
- `I2CDecoder` 不再默认输出 bitrate 日志。
- `npm run test:decoders -- --runInBand` 通过。

### 任务 C：修正文档口径

目标：把当前结论写入权威状态文档，并修正已发现的旧表述。

验收：

- `docs/功能状态矩阵.md` 标明 I2C UI 软件闭环已实现，真实硬件仍待认证。
- `docs/真实硬件认证矩阵.md` 保持硬件证据等级为 fixture/pending，不提升为 hardware。
- `docs/worktrees/01-pico-driver-parity.md` 中 Pico 样本取位语义与当前代码和 fixture 一致。
- 本文档记录本轮自动任务完成状态。

### 任务 D：最终门禁

目标：用实际命令证明本轮改动没有破坏“可打开正常使用”的软件闭环。

验收命令：

```bash
rtk npm run typecheck
rtk npm run typecheck:strict
rtk npm run lint
rtk npm run test:webview:unit -- --runInBand
rtk npm run test:decoders -- --runInBand
rtk npm run build:frontend:html
rtk npm run test:webview:smoke
rtk npm run build:production
rtk npm run package:dry
rtk npm run test:ci:quick -- --skip-install
```

## 后续必须人工或硬件参与的任务

以下任务不能在无硬件环境中自动完成，不能写成已完成：

- 真实 Pico / Pico W / Pico 2 采集 I2C 总线。
- 记录 `.lac` sha256、波形截图、解码面板截图。
- VSIX 安装到干净 VSCode 用户数据目录后手工 smoke。
- 原版 GUI 与当前扩展的 `.lac` 双向打开保存往返验证。
- Saleae、Rigol/Siglent、sigrok 真实设备认证。

## 进度记录

| 任务 | 状态 | 证据 |
| --- | --- | --- |
| A：浏览器 I2C smoke 去注入 mock | 已完成 | `browserHost` 支持 `runDecoder`，`webview-browser-smoke.js` 不再覆盖 `context.host.sendCommand`；子任务验证 `test:webview:unit`、`build:frontend:html`、`test:webview:smoke` 通过 |
| B：降低解码器日志噪音 | 已完成 | 移除默认注册成功日志、解码成功日志和 I2C bitrate 日志；最终门禁中 `test:decoders` 与 `test:webview:unit` 均通过 |
| C：修正文档口径 | 已完成 | 状态矩阵、硬件认证矩阵和 Pico parity 文档已更新；禁用夸大表述检查无匹配 |
| D：最终门禁 | 已完成 | `typecheck`、`typecheck:strict`、`lint`、`test:webview:unit`、`test:decoders`、`build:frontend:html`、`test:webview:smoke`、`build:production`、`package:dry`、`test:ci:quick -- --skip-install` 均通过 |
