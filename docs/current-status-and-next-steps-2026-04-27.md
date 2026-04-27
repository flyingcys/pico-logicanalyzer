# 当前现状与下一步计划（2026-04-28）

## 结论

项目已形成较完整的 VSCode 逻辑分析器工程骨架：扩展入口、Vue3 Webview、硬件驱动抽象、核心解码器、`.lac` 文件处理、数据导出服务、硬件兼容性数据库和多层测试目录均已存在。与 2026-04-27 文档相比，基础类型门禁已经恢复，Webview 单元测试可运行，生产构建可通过；但项目仍处于 Beta/工程整备阶段，不能按“生产就绪”或“完整原版 parity”描述。

## 本次验证范围

- 源码：`src` 下 142 个 TypeScript/Vue/CSS/HTML 文件。
- 测试：`tests` 下 97 个 TypeScript/JavaScript 文件，`tests/unit` 下 57 个文件。
- 文档：`docs` 下 85 个 Markdown 文件。
- 参考基准：未跟踪目录 `logicanalyzer/` 仍作为原版 C#/Python/固件/硬件参考，不纳入本次提交。
- 命令：`npm run typecheck`、`npm run typecheck:strict`、`npm run test:webview:unit -- --runInBand`、`npm run build:production`、`npm run test:unit -- --silent`。

## 验证结果

| 项目 | 结果 | 说明 |
|---|---|---|
| `npm run typecheck` | 通过 | 全量 TypeScript 基线当前可通过。 |
| `npm run typecheck:strict` | 通过 | 分阶段 strict gate 当前可通过。 |
| `npm run test:webview:unit -- --runInBand` | 通过 | 2 个测试套件、37 个测试通过。 |
| `npm run build:production` | 通过，有警告 | extension 和 webview 均可打包；`main-vscode` / `main-html` 约 2.18 MiB，source map 约 7.43 MiB，仍触发 webpack 体积警告。 |
| `npm run test:unit -- --silent` | 中断/需拆分确认 | 全量单元测试启动后长时间无输出，本次手动中断；仍需定位耗时测试或开放句柄。 |
| 测试迁移 | 未完成 | 多个测试仍引用 `../../../utest/mocks/simple-mocks`。 |
| 文档一致性 | 改善中 | README、功能矩阵和本文件已改为 Beta/实验性口径，旧分析文档仍需持续收敛。 |

## 代码 Review 发现

### 已收口：基础类型门禁

2026-04-27 记录的 `GenericDriverTemplate.ts`、`extension.ts`、`UnifiedDataFormat.ts`、`DataExportService.ts`、`stage7-self-test.ts`、`MemoryManager.ts` 类型错误当前已不再复现，`npm run typecheck` 和 `npm run typecheck:strict` 均通过。

### P0：测试迁移未收口

这些文件仍引用旧 `utest` mock，需要统一迁移到 `tests/fixtures/mocks` 后再扩大 CI 覆盖：

- `tests/e2e/scenarios/DataCaptureWorkflow.e2e.test.ts`
- `tests/integration/core-flows/hardware-capture.integration.test.ts`
- `tests/performance/benchmarks/LACFileFormat.perf.test.ts`
- `tests/performance/benchmarks/LogicAnalyzerDriver.perf.test.ts`
- `tests/stress/load/LargeDataProcessing.stress.test.ts`
- `tests/stress/load/IntelligentLoadGeneration.stress.test.ts`
- `tests/stress/data-processing/scenarios/MemoryLeakDetection.stress.test.ts`
- `tests/stress/data-processing/scenarios/ContinuousData.stress.test.ts`

### P0：全量单元测试仍需拆分

`npm run test:webview:unit` 已稳定通过，但 `npm run test:unit -- --silent` 仍有长时间无输出风险。下一步需要按 drivers、decoders、models、services、extension 分组运行，定位是测试耗时、资源未释放还是 mock 依赖路径导致。

### 已收口：Webview 导出入口不再是假成功

`src/providers/LACEditorProvider.ts` 的 `exportData` 当前已经解析 `.lac` 文档、调用 `LACFileFormat.convertToCaptureSession`，并通过 `DataExportService.exportWaveformData` 写出 lac/csv/json/vcd。剩余风险不再是“按钮只提示成功”，而是 `.lac` 原版真实样本、CSV 样本语义和 VCD/JSON 输出还缺少 golden 往返测试。

### P1：扩展激活事件偏窄

`package.json` 当前只有 `onLanguage:logicanalyzer` 激活事件，但贡献了多个命令和 `.lac` 自定义编辑器。需要确认命令和文件打开场景是否能稳定激活，必要时补充 `onCommand:*` 和 `onCustomEditor:logicAnalyzer.lacEditor`。

### P1：Webview 包体偏大

生产构建中 `main-vscode` / `main-html` 约 2.18 MiB，source map 约 7.43 MiB，webpack 仍提示体积警告。需要拆分 Element Plus、调试/HTML 双入口复用和按需加载策略。

### P1：原版 parity 仍缺少真实样本与硬件证据

当前代码已有 Pico 驱动状态机修正、`.lac` PascalCase 解析、前端样本拆包和基础交互，但仍缺少以下证据链：

- 原版 `.lac` 样本打开、保存、再由原版打开的往返测试。
- Pico / Pico W / Pico 2 串口和网络真实采集记录。
- 多设备级联真实或协议级 fixture。
- sigrok 大量协议 golden 对齐。
- CLI/TUI 用户级采集工具 parity。

## 文档 Review 发现

- `README.md` 当前已按 Beta/工程整备口径描述，但“最近一次质量基线验证结果”仍需同步到 2026-04-28。
- `docs/功能状态矩阵.md` 需要把类型门禁、Webview 导出入口、前端样本装载状态更新为当前结果。
- `docs/logicanalyzer-差距深度分析-2026-04-27.md` 仍是重要基线，但部分结论已被后续代码修正，应新增 2026-04-28 并行拆分文档承接下一阶段工作。
- 旧 `docs/utest`、`docs/tests-docs`、`功能对比分析` 中仍有历史口径，后续应按索引页标注“历史分析”或逐步归档。

## 下一步任务

详细并行拆分见 `docs/parallel-worktrees-2026-04-28.md`。

### P0：质量和测试收口

1. 清理测试中的 `utest/mocks` 旧引用。
2. 拆分运行 `test:unit`，定位卡住或长耗时测试。
3. 把 quick/driver/decoder/webview 的稳定子集固化到本地和 CI 验证说明。
4. 避免只依赖 webpack `transpileOnly` 成功，把 `typecheck` / `typecheck:strict` 作为发布前置。

### P1：原版核心闭环

1. 修 Pico 串口/网络协议与原版 C# 行为的剩余差异。
2. 用真实 `.lac` 样本完成打开、渲染、导出、保存往返。
3. 接回新前端设备、采集、解码、测量、区域、样本编辑工作流。
4. 补 CLI/TUI 用户级采集入口和批量导出。

### P2：生态扩展和发布准备

1. sigrok 协议 golden 对齐和更多协议优先级补齐。
2. Saleae / Rigol / Siglent / sigrok 外部工具适配做硬件认证矩阵。
3. 统一 README、用户手册、开发者指南中的硬件支持和协议支持口径。
4. 建立发布门槛：typecheck、strict、lint、quick、driver、decoder、webview、production build、package dry run、手动 smoke test。

## 当前推荐工作顺序

1. 先用 10 个并行 worktree 拆开互不阻塞的大任务。
2. 优先推进测试迁移和原版 `.lac` / Pico 协议 fixture，给后续功能提供回归基线。
3. 同步推进前端真实工作流、解码器 parity、CLI/TUI 和硬件认证。
4. 最后统一发布文档、CHANGELOG、RELEASE_NOTES 和 VSIX smoke test。
