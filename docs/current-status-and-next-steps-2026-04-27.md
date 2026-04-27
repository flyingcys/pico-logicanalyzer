# 当前现状与下一步计划（2026-04-27）

## 结论

项目已形成完整 VSCode 逻辑分析器雏形：扩展入口、Vue3 Webview、硬件驱动抽象、核心解码器、`.lac` 文件处理、数据导出服务、硬件兼容性数据库和多层测试目录均已存在。但当前质量门槛未过，不能按“生产就绪”或“完整测试覆盖”描述。

## 本次验证范围

- 源码：`src` 下 109 个 TypeScript/Vue 文件。
- 测试：`tests` 下 77 个 TypeScript/JavaScript 文件，其中单元测试 47 个，其他层级 29 个。
- 文档：`docs` 下 76 个 Markdown 文件，旧 `tests-docs`、`功能对比分析`、`plan2` 已整理到 `docs/` 下。
- 命令：`npm run typecheck`、`npm run build`、`npm run test:unit -- --silent`。

## 验证结果

| 项目 | 结果 | 说明 |
|---|---|---|
| `npm run build` | 通过 | extension 和 webview 均可打包；webview 入口约 17.2 MiB。 |
| `npm run typecheck` | 失败 | TypeScript 错误集中在 SDK 模板、扩展入口、统一数据格式、导出服务、自测文件、内存管理工具。 |
| `npm run test:unit -- --silent` | 未得到有效结果 | 运行超过 3 分钟无输出，需拆分定位长耗时或未释放资源测试。 |
| 测试迁移 | 未完成 | 多个测试仍引用 `../../../utest/mocks/simple-mocks`。 |
| 文档一致性 | 不一致 | 多份文档宣称 100% 覆盖、迁移完成、生产就绪，与当前验证不符。 |

## 代码 Review 发现

### P0：类型检查失败

- `src/driver-sdk/templates/GenericDriverTemplate.ts` 存在 `AnalyzerDriverType.USB` 不存在和多处重复函数实现。
- `src/extension.ts:66`、`src/extension.ts:657` 把字符串传给 `LACFileFormat.createFromCaptureSession` 的 `selectedRegions` 参数。
- `src/extension.ts:270` 的采集完成回调签名与 `CaptureCompletedHandler` 不一致。
- `src/models/UnifiedDataFormat.ts` 存在 `DeviceInfo` 导入/本地声明冲突、`QualityMetrics` 未定义、`unknown` 未收窄、颜色类型不一致。
- `src/services/DataExportService.ts` 使用了 `DecoderResult.data/type`，但当前 `DecoderResult` 类型没有这些字段。
- `src/services/stage7-self-test.ts` 混用了 `AnalyzerTypes.CaptureSession` 和 `CaptureModels.CaptureSession`。
- `src/utils/MemoryManager.ts` 泛型返回值与约束不匹配。

### P0：构建掩盖类型错误

- `webpack.config.js:68` 和 `webpack.config.js:153` 都设置了 `transpileOnly: true`。
- 结果是 `npm run build` 成功不代表源码类型正确。发布检查必须显式运行 `npm run typecheck`。

### P0：测试迁移未收口

这些文件仍引用旧 `utest` mock：

- `tests/e2e/scenarios/DataCaptureWorkflow.e2e.test.ts`
- `tests/integration/core-flows/hardware-capture.integration.test.ts`
- `tests/performance/benchmarks/LACFileFormat.perf.test.ts`
- `tests/performance/benchmarks/LogicAnalyzerDriver.perf.test.ts`
- `tests/stress/load/LargeDataProcessing.stress.test.ts`
- `tests/stress/load/IntelligentLoadGeneration.stress.test.ts`
- `tests/stress/data-processing/scenarios/MemoryLeakDetection.stress.test.ts`
- `tests/stress/data-processing/scenarios/ContinuousData.stress.test.ts`

### P1：导出功能存在假成功

`src/providers/LACEditorProvider.ts:238` 的 `exportData` 只打开保存对话框，`src/providers/LACEditorProvider.ts:251` 仍是 TODO，但随后提示“数据已导出”。这会造成用户误判。

### P1：扩展激活事件偏窄

`package.json` 当前只有 `onLanguage:logicanalyzer` 激活事件，但贡献了多个命令和 `.lac` 自定义编辑器。需要确认命令和文件打开场景是否能稳定激活，必要时补充 `onCommand:*` 和 `onCustomEditor:logicAnalyzer.lacEditor`。

### P1：Webview 包体偏大

开发构建中 webview 入口约 17.2 MiB，其中 Element Plus、vendors、main、Vue vendor 均较大。生产构建需单独评估体积、加载速度和 VSCode Webview 资源策略。

## 文档 Review 发现

- `README.md` 原先写 VSCode 1.60+，但 `package.json` 要求 `^1.74.0`。
- `README.md` 原先写“单元测试覆盖率 100%（135 个测试用例）”，与当前测试目录和运行状态不符。
- `docs/tests/README.md` 原先写 `@utest` 完全迁移和 CI 正常运行，但当前仍有旧路径引用。
- `docs/todo.md` 中大量阶段性完成结论缺少最新验证支撑，已在顶部加入当前修正结论。
- `docs/src-directory-structure.md` 原先把“类型安全”描述成当前事实，已改为目标状态并补充 typecheck 失败说明。

## 下一步任务

### P0：质量门槛恢复

1. 修复 `npm run typecheck` 中所有错误，先从 `GenericDriverTemplate.ts` 重复实现和 `UnifiedDataFormat.ts` 类型冲突开始。
2. 修正 `extension.ts` 对 `LACFileFormat.createFromCaptureSession` 的调用，明确标题字段应放在数据模型还是文件保存逻辑。
3. 统一 `CaptureSession` 类型来源，避免 `AnalyzerTypes` 与 `CaptureModels` 两套模型继续漂移。
4. 修正 `DataExportService` 与 `DecoderResult` 的契约，决定是扩展 `DecoderResult`，还是调整导出服务读取字段。
5. 清理测试中的 `utest/mocks` 旧引用。
6. 拆分运行单元测试，找出卡住文件并修复资源释放。

### P1：功能真实闭环

1. 实现 `LACEditorProvider.exportData` 的 CSV/JSON 真实写入，失败时返回错误，不再提前提示成功。
2. 检查扩展激活事件，确保命令面板、`.lac` 文件打开、自定义编辑器都能触发激活。
3. 把 `npm run typecheck` 加入发布检查和 CI 必跑项。
4. 单独跑 `npm run build:production`，记录体积和加载性能。
5. 针对 Pico、网络设备、Saleae/Sigrok 适配分别补最小硬件或模拟回归。

### P2：文档和发布准备

1. 统一 README、用户手册、开发者指南中的硬件支持矩阵和协议支持矩阵。
2. 删除或归档明显过期的阶段完成报告，保留索引说明，避免新读者误用。
3. 为发布建立一页式门槛：typecheck、lint、unit、integration、production build、package、手动 smoke test。
4. 更新 `CHANGELOG.md` 和 `RELEASE_NOTES.md`，只写已经验证的能力。

## 当前推荐工作顺序

1. 先修 typecheck。
2. 再修测试迁移和卡住问题。
3. 然后补真实导出和激活事件。
4. 最后更新发布文档和版本说明。
