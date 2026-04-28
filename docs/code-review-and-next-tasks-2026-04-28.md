# 当前代码深度 Review 与后续任务总览（2026-04-28）

本文档记录 2026-04-28 对当前仓库的代码、文档、测试和发布门禁的系统 review 结论。结论只基于本次已读取源码、现有文档和本次实际运行命令；未做真实硬件验证。

## Review 范围

- VSCode 扩展入口：`src/extension.ts`、`src/providers/LACEditorProvider.ts`
- 硬件与采集链路：`src/drivers/*`、`src/models/*`
- 前端 Webview：`src/frontend/*`，兼看旧兼容壳 `src/webview/*`
- 导出与服务层：`src/services/*`
- 解码器：`src/decoders/*`
- 测试体系：`tests/*`、`scripts/ci-test-runner.js`
- 发布与状态文档：`README.md`、`docs/功能状态矩阵.md`、`docs/release-gate.md`、`docs/tests/README.md`

## 本次验证证据

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | 主 `tsconfig.json` 仍关闭 strict，不能代表严格类型完成。 |
| `npm run typecheck:strict` | 通过 | 当前 strict gate 只覆盖 `src/models/AnalyzerTypes.ts` 和 `src/decoders/types.ts`。 |
| `npm run lint` | 通过，有 22 条 warning | warning 集中在 `AppWaveformStage.vue` 的 Vue 模板格式。 |
| `npm run test:webview:unit -- --runInBand` | 通过 | 2 个测试套件、49 个测试通过。 |
| `npm run test:ci:quick -- --skip-install` | 通过 | 10 个 quick 核心测试文件全部通过，共 305 个测试。 |
| `npm run build:production` | 通过，有 2 类 warning | Webview 两个入口 JS 各约 2.19 MiB，source map 各约 7.47 MiB。 |
| `npm run package:dry` | 通过，有同样 bundle warning | `vsce ls` 成功列出打包文件。 |

## 总体判断

项目已经具备扩展入口、Vue3 Webview、Pico 基础协议、`.lac` 读写、CSV/JSON/VCD 导出、I2C/SPI/UART 解码器和分层测试门禁。当前仍应按 Beta/工程整备阶段处理，不能声明生产就绪或真实硬件完整支持。

主要风险集中在四类：

- 采集数据正确性：Pico 驱动样本拆通道存在非零/非连续通道错位风险。
- 发布质量口径：主 tsconfig 仍关闭 strict，生产 webpack 使用 `transpileOnly`。
- 测试覆盖边界：quick 层通过，但仍有旧 `utest` 引用和 4 个旧 core smoke 测试暂不阻断。
- 文档一致性：部分历史文档仍含“100%”“生产级”“迁移完成”等过期表述。

## 关键问题

### P0：Pico 样本拆通道使用了通道数组下标，而不是真实通道号

位置：`src/drivers/LogicAnalyzerDriver.ts:955-962`

当前逻辑：

```typescript
const mask = 1 << channelIndex;
```

这会在用户只采集通道 8、9，或采集 0、2、5 这类非连续通道时，把样本位解释成数组位置，而不是设备实际通道号。`.lac` 的打包/解包路径已经通过 `channel.channelNumber` 取 bit，Pico 实时采集路径与之不一致。

影响：

- 真实硬件采集数据可能写入错误通道。
- 后续 `.lac` 保存、Webview 渲染、协议解码会基于错误样本继续传播。
- 现有 quick 测试没有阻断这个场景。

下一步：

- 为 `LogicAnalyzerDriver` 增加非连续通道二进制帧回放测试。
- 将 mask 改为基于 `channel.channelNumber`。
- 覆盖 8/16/24 通道模式下的选通道组合。

### P0：导出通道校验把通道号误当成数组下标

位置：`src/services/DataExportService.ts:2132-2138`

当前逻辑使用 `session.captureChannels.length` 判断 `selectedChannels` 是否有效。对通道号为 8、9 的会话，`selectedChannels: [8]` 会被误判为不存在；对通道数组长度足够但实际无对应 channelNumber 的场景，也可能误通过。

影响：

- Webview 选择高编号通道导出时可能失败。
- 非连续通道导出结果与 UI 选择不一致。

下一步：

- 改为基于 `new Set(session.captureChannels.map(ch => ch.channelNumber))` 校验。
- 为 CSV/JSON/VCD/LAC 四种格式补高编号通道导出测试。

### P0：测试基础设施仍残留旧 `utest` 依赖

本次扫描仍发现 8 个测试文件引用 `../../../utest/mocks/simple-mocks`：

- `tests/integration/core-flows/hardware-capture.integration.test.ts`
- `tests/performance/benchmarks/LACFileFormat.perf.test.ts`
- `tests/performance/benchmarks/LogicAnalyzerDriver.perf.test.ts`
- `tests/e2e/scenarios/DataCaptureWorkflow.e2e.test.ts`
- `tests/stress/load/LargeDataProcessing.stress.test.ts`
- `tests/stress/load/IntelligentLoadGeneration.stress.test.ts`
- `tests/stress/data-processing/scenarios/MemoryLeakDetection.stress.test.ts`
- `tests/stress/data-processing/scenarios/ContinuousData.stress.test.ts`

影响：

- Standard/Full 层测试仍可能被旧目录存在性影响。
- `docs/tests/README.md` 中“迁移完成”类历史表述不能作为当前事实。

下一步：

- 全部迁移到 `tests/fixtures/mocks/simple-mocks`。
- 运行 standard 层，记录失败测试和修复责任。
- 把迁移完成条件改为可验证 checklist。

### P1：主 TypeScript 配置与架构约束不一致

位置：`tsconfig.json:18-39`、`tsconfig.strict.json`

主 `tsconfig.json` 关闭了 strict、noImplicitAny、strictNullChecks 等关键检查；`tsconfig.strict.json` 当前只覆盖两个文件。源码中仍有大量 `any` 和 `as any`，本次粗略扫描源码与配置命中 345 行。

影响：

- `npm run typecheck` 通过不等于项目严格类型安全。
- 生产构建依赖 webpack `transpileOnly`，需要外部门禁保证类型正确。
- 大型服务和驱动的契约漂移更难被编译器发现。

下一步：

- 按模块扩大 strict gate：models -> decoders -> drivers -> services -> frontend。
- 先收口公共 API 类型，不要求一次清空测试里的 `as any`。
- 将新增或改动模块纳入 strict gate。

### P1：生产构建跳过 webpack 类型检查

位置：`webpack.config.js:117-123`、`webpack.config.js:203-209`

extension 和 webview 的 ts-loader 都启用了 `transpileOnly: true`。当前发布门槛已有 `typecheck`，但构建本身不能单独证明类型正确。

下一步：

- 保留 `transpileOnly` 用于构建速度，但在 release gate 明确 `typecheck` 是构建前置硬门槛。
- CI 中禁止只运行 `build:production` 就声明构建质量通过。
- 长期可评估 fork-ts-checker 或更细的 project references。

### P1：样本范围计算未完整表达 loopCount 语义

位置：`src/services/DataExportService.ts:1672-1721`、`src/services/DataExportService.ts:1733-1736`、`src/services/DataExportService.ts:2094-2097`

导出范围和元数据多处以 `preTriggerSamples + postTriggerSamples` 推导总样本数，而采集链路里总样本数应考虑 `postTriggerSamples * (loopCount + 1)`。部分路径会被实际 `channel.samples.length` 兜底，但 settings-only、预览和元数据仍存在不一致风险。

下一步：

- 增加统一 helper：优先 `channel.samples.length`，其次 `pre + post * (loopCount + 1)`。
- 导出、预览、metadata 和 UI 状态统一使用同一 helper。
- 补 blast/loop capture 的 LAC、CSV、JSON、VCD golden。

### P1：服务和入口文件过大，职责混合

当前大文件：

- `src/services/DataExportService.ts`：2286 行
- `src/drivers/HardwareDriverManager.ts`：1298 行
- `src/drivers/LogicAnalyzerDriver.ts`：1247 行
- `src/providers/LACEditorProvider.ts`：1059 行
- `src/frontend/core/stores/waveformStore.ts`：702 行
- `src/frontend/app/components/AppWaveformStage.vue`：656 行

影响：

- review 和测试定位成本高。
- 类型收紧和 bugfix 容易牵动无关职责。
- 导出、硬件发现、采集控制、Webview host command 的边界不够清晰。

下一步：

- 先拆测试，再拆实现，避免一次性大重构。
- `DataExportService` 拆为 waveform exporters、decoder exporters、report/project exporters、range/metadata helpers。
- `LACEditorProvider` 拆 host command router、capture workflow、export workflow、asset manifest loader。
- `HardwareDriverManager` 拆 discovery profiles、detectors、connection lifecycle。

### P1：导出能力声明需收敛

`DataExportService` 暴露 `txt/html/md/pdf/zip/project` 等格式，但 Webview 主入口 `LACEditorProvider.exportData()` 当前只支持 `lac/csv/json/vcd`。PDF 导出是占位实现，HTML 报告仍有图表占位。

影响：

- 用户文档和状态矩阵容易把实验性/占位能力写成已实现。
- 发布说明需要严格区分“后端实验性接口”和“Webview 主链路可用格式”。

下一步：

- 功能矩阵中保持 `.lac/CSV/JSON/VCD` 为 Webview 主链路，报告/ZIP/PDF 单独列为实验性或规划中。
- PDF 在真正接入生成库或移除入口前不得声明可用。
- HTML 报告图表占位不应作为完成状态。

### P1：Webview 体积已触发 webpack warning

本次 `build:production` 显示：

- `main-vscode.*.js` 约 2.19 MiB
- `main-html.*.js` 约 2.19 MiB
- 两个 source map 各约 7.47 MiB

下一步：

- 分析 Element Plus、Pinia、i18n、波形引擎是否能按页面或工具区 lazy load。
- VSIX 打包时评估 source map 是否保留。
- 给 Webview bundle 设置 release budget，并在超限时记录风险。

### P2：协议解码覆盖仍处于核心协议阶段

当前本地 TypeScript 解码器主链路是 I2C/SPI/UART。其它 CAN/LIN/I2S/USB/JTAG/SWD 等仍应按规划或实验性处理。根据项目约束，默认不应引入 Python 运行时作为长期依赖；任何外部 sigrok 或 Python 桥接只能作为显式可选增强，不能成为默认路径。

下一步：

- 先做 CAN、LIN、I2S 三个高价值 TS 解码器。
- 每个解码器必须有 sigrok/golden fixture。
- USB/JTAG/SWD 可先保留外部工具过渡方案，但文档必须标注非默认依赖。

## 后续任务总清单

### P0：先修正确性和门禁风险

- [ ] 为 Pico 采集通道位提取补非连续通道回放测试。
- [ ] 修复 `LogicAnalyzerDriver.extractSamplesToChannels()` 的 bit mask。
- [ ] 修复 `DataExportService.validateExportOptions()` 的通道号校验。
- [ ] 为高编号通道导出补 CSV/JSON/VCD/LAC 测试。
- [ ] 迁移 8 个测试文件的 `utest/mocks` 引用。
- [ ] 运行 `npm run test:ci:standard -- --skip-install`，记录失败项。
- [ ] 将 4 个暂不阻断旧 core smoke 测试逐个修复或拆分原因。
- [ ] 更新 `docs/tests/README.md` 中与迁移完成冲突的历史表述。

### P1：完善真实主链路

- [ ] 统一 total samples 计算，覆盖 loop/blast 导出。
- [ ] 给 `LACEditorProvider.exportData()` 补错误路径和取消路径测试。
- [ ] 将 Webview 导出范围、通道选择、选区/区域保存与 `waveformStore` 打通。
- [ ] 为真实浏览器 Webview 增加 Playwright smoke：空文件、settings-only、含 Samples、导出按钮、设备错误提示。
- [ ] 真实 Pico 串口采集验收：8/16/24 通道、非连续通道、停止采集、断线恢复。
- [ ] 真实 Pico W 网络验收：发现、连接、采集、网络诊断、WiFi 配置失败路径。
- [ ] 将 `NetworkDetector` 从端口开放候选升级为 profile 握手确认。
- [ ] 将 strict gate 扩到 `src/models/*` 和 `src/decoders/*`。
- [ ] 处理 `npm run lint` 的 22 条 Vue warning，避免 warning 常态化。
- [ ] 拆分 `DataExportService`，先抽出 range/metadata helper 和 waveform exporters。
- [ ] 拆分 `LACEditorProvider`，先抽 host command router 和 export workflow。
- [ ] 给 Webview bundle 建立体积预算和分析报告。

### P2：扩展能力和生态建设

- [ ] CAN TypeScript 解码器及 golden 测试。
- [ ] LIN TypeScript 解码器及 golden 测试。
- [ ] I2S TypeScript 解码器及 golden 测试。
- [ ] 解码器注册表支持能力声明、版本、golden 覆盖状态。
- [ ] 驱动 SDK 模板区分“可运行示例”和“待实现模板”，避免 TODO 被误认为已完成能力。
- [ ] 完善硬件兼容性数据库的真实设备记录字段：设备、固件、系统、采样配置、结果文件 hash。
- [ ] Standard/Full CI 结果入文档，形成发布候选证据模板。
- [ ] 整理旧文档，将历史计划移入索引的“历史分析”口径。
- [ ] 评估 source map 打包策略，减少 VSIX 体积。
- [ ] 更新 CHANGELOG 和 RELEASE_NOTES，只声明已验证能力。

## 10 个可并行开发任务

以下拆分面向首轮并行开发。每个任务都是一个可独立推进的工作包，目录使用项目约定的 `.worktree/01` 到 `.worktree/10`。首轮要求各自只修改所属文件边界；跨任务耦合点放到第 2 轮集成处理。

### 并行闭环判断

可以通过 2-3 个轮次闭环绝大多数软件侧工作，但有两个前提：

- 真实硬件认证必须有可用设备和可复现记录；没有设备时只能闭环到 fixture/mock/文档约束层。
- 首轮并行任务必须保持文件边界，不能提前跨任务重构共享大文件。

建议轮次：

1. 第 1 轮：10 个 worktree 并行完成各自测试、实现、文档和本地验证。
2. 第 2 轮：合并 P0/P1 结果，跑 standard/full，处理跨任务冲突、类型门禁和文档口径。
3. 第 3 轮：真实硬件/VSIX smoke/发布材料收口；如果缺硬件，则把未完成项明确降级为“待硬件认证”。

### 任务 01：Pico 采集通道正确性与二进制帧回放

**Worktree**：`.worktree/01`

**目标**：修复 Pico 采集样本拆通道错位问题，确保非零起始、非连续通道和 8/16/24 通道模式均按真实 `channelNumber` 取位。

**主要文件边界**：

- `src/drivers/LogicAnalyzerDriver.ts`
- `tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts`
- `tests/unit/drivers/LogicAnalyzerDriver.*.test.ts`
- `tests/fixtures/drivers/*`
- `docs/真实硬件认证矩阵.md`

**验收命令**：

- `npm run typecheck`
- `npm run test:drivers -- --runInBand`
- `npm run test:ci:quick -- --skip-install`

**交付物**：

- 非连续通道 fixture 和回归测试。
- `extractSamplesToChannels()` 使用真实通道号取 mask。
- 真实硬件未验证时，在认证矩阵中保留“待认证”记录，不提升状态。

**依赖关系**：无首轮阻塞；与任务 05 的真实硬件记录在第 2 轮对齐。

### 任务 02：导出通道语义、loop/blast 样本范围与 `.lac` golden

**Worktree**：`.worktree/02`

**目标**：修复导出通道号校验和 loop/blast 总样本计算，确保 LAC/CSV/JSON/VCD 在高编号通道、非连续通道、loop capture 下语义一致。

**主要文件边界**：

- `src/services/DataExportService.ts`
- `src/models/LACFileFormat.ts`
- `tests/unit/services/DataExportService.accurate.test.ts`
- `tests/unit/models/LACFileFormat.test.ts`
- `tests/fixtures/lac/*`

**验收命令**：

- `npm run typecheck`
- `npx jest tests/unit/services/DataExportService.accurate.test.ts --runInBand`
- `npx jest tests/unit/models/LACFileFormat.test.ts --runInBand`

**交付物**：

- 基于 `channel.channelNumber` 的导出通道校验。
- 统一 total samples helper。
- 高编号通道和 loop/blast golden。
- 明确 Webview 主链路只声明 LAC/CSV/JSON/VCD。

**依赖关系**：与任务 04 的 Webview 选择/导出 UI 在第 2 轮集成。

### 任务 03：测试迁移、Standard/Full CI 修复与暂不阻断测试收口

**Worktree**：`.worktree/03`

**目标**：清理旧 `utest/mocks` 引用，运行并修复 standard 层，逐步减少暂不阻断测试。

**主要文件边界**：

- `tests/integration/**`
- `tests/performance/**`
- `tests/e2e/**`
- `tests/stress/**`
- `tests/fixtures/mocks/**`
- `scripts/ci-test-runner.js`
- `docs/tests/README.md`
- `docs/release-gate.md`

**验收命令**：

- `npm run test:ci:quick -- --skip-install`
- `npm run test:ci:standard -- --skip-install`
- 对仍失败项记录单测命令、失败原因和责任任务。

**交付物**：

- 8 个旧 mock 引用全部迁移。
- standard 层结果入文档。
- 4 个 quarantined core smoke 测试给出修复或继续隔离的证据。

**依赖关系**：可首轮独立推进；若发现业务失败，按任务 01/02/05/06 分派。

### 任务 04：Webview 导出、区域保存与浏览器 smoke

**Worktree**：`.worktree/04`

**目标**：打通用户从 Webview 选择范围/通道/区域到导出的主流程，并增加真实浏览器 smoke 覆盖。

**主要文件边界**：

- `src/frontend/app/**`
- `src/frontend/core/stores/waveformStore.ts`
- `src/frontend/core/stores/sessionStore.ts`
- `src/frontend/platform/host/**`
- `tests/unit/webview/**`
- `docs/frontend-migration-smoke-checklist.md`

**验收命令**：

- `npm run test:webview:unit -- --runInBand`
- `npm run build:frontend:html`
- Playwright 或等价浏览器 smoke 记录：empty、settings-only、invalid、samples、导出按钮、设备错误提示。

**交付物**：

- Webview 导出请求携带范围、通道、区域信息。
- 区域/marker/测量状态与导出或保存链路的边界明确。
- 浏览器截图或 smoke 记录入文档。

**依赖关系**：首轮避免修改 `DataExportService`；与任务 02 在第 2 轮对接最终导出契约。

### 任务 05：设备发现、网络握手与硬件认证路径

**Worktree**：`.worktree/05`

**目标**：将网络端口开放从“候选”升级为 profile 握手确认，补齐 Pico W、Saleae、Rigol/Siglent、sigrok 的发现证据路径。

**主要文件边界**：

- `src/drivers/HardwareDriverManager.ts`
- `src/services/WiFiDeviceDiscovery.ts`
- `src/services/NetworkStabilityService.ts`
- `tests/unit/drivers/HardwareDriverManager.business.test.ts`
- `tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts`
- `tests/unit/services/NetworkStabilityService.*.test.ts`
- `docs/真实硬件认证矩阵.md`

**验收命令**：

- `npm run test:drivers -- --runInBand`
- `npx jest tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts --runInBand`
- `npx jest tests/unit/services/NetworkStabilityService.accurate.test.ts --runInBand`

**交付物**：

- profile 握手策略和候选/已确认设备状态区分。
- 无硬件时的 fixture 验证路径。
- 有硬件时的认证记录模板和结果记录。

**依赖关系**：与任务 01 的 Pico 真实采集记录在第 2/3 轮合并。

### 任务 06：Strict gate 扩容、类型债收口与 lint warning 清零

**Worktree**：`.worktree/06`

**目标**：扩大严格类型门禁覆盖面，并清理当前 lint warning，使质量门禁输出更可执行。

**主要文件边界**：

- `tsconfig.strict.json`
- `tsconfig.json`
- `.eslintrc.*`
- `src/models/**`
- `src/decoders/**`
- `src/frontend/app/components/AppWaveformStage.vue`
- `docs/release-gate.md`

**验收命令**：

- `npm run typecheck`
- `npm run typecheck:strict`
- `npm run lint`
- `npm run test:ci:quick -- --skip-install`

**交付物**：

- strict gate 至少扩到 `src/models/*` 和 `src/decoders/*`。
- 当前 22 条 Vue warning 清零。
- 新增 strict 范围和剩余类型债记录到 release gate。

**依赖关系**：与任务 07 的解码器新增文件可能冲突，首轮要求任务 07 新增文件先满足 strict。

### 任务 07：CAN/LIN/I2S 解码器与 sigrok golden 扩展

**Worktree**：`.worktree/07`

**目标**：新增首批高价值 TypeScript 解码器，扩大核心协议覆盖，同时保持零 Python 默认依赖。

**主要文件边界**：

- `src/decoders/protocols/*`
- `src/decoders/DecoderRegistry.ts`
- `src/decoders/DecoderSigrokParity.ts`
- `tests/unit/decoders/**`
- `tests/fixtures/decoders/*`
- `docs/功能状态矩阵.md`

**验收命令**：

- `npm run test:decoders -- --runInBand`
- `npm run typecheck:strict`
- `npm run test:ci:quick -- --skip-install`

**交付物**：

- CAN、LIN、I2S 解码器或明确分阶段落地其中的子集。
- 每个新增协议带 golden fixture 和边界测试。
- 状态矩阵只提升已验证协议，不扩大到“100+ 协议支持”。

**依赖关系**：与任务 06 在 strict gate 上协同；新增文件必须不扩大类型债。

### 任务 08：真实硬件认证矩阵、兼容性数据库与证据模板

**Worktree**：`.worktree/08`

**目标**：把硬件支持从口号改成可追溯证据，形成设备、固件、系统、采样配置、结果 hash 的标准记录。

**主要文件边界**：

- `docs/真实硬件认证矩阵.md`
- `docs/network-features.md`
- `docs/driver-sdk/DEVELOPER_GUIDE.md`
- `src/database/**`
- `data/sample-devices.json`
- `tests/unit/database/**`

**验收命令**：

- `npm run db:validate`
- `npx jest tests/unit/database/DatabaseManager.comprehensive.test.ts --runInBand`
- 文档链接检查使用 `rg` 手动核对。

**交付物**：

- 认证记录 schema。
- mock/fixture/真实硬件三类证据等级。
- 真实硬件缺失时的状态降级规则。

**依赖关系**：接收任务 01/05 的真实硬件结果；首轮先定义 schema 和模板。

### 任务 09：Webview bundle 体积、source map 策略与发布体积预算

**Worktree**：`.worktree/09`

**目标**：处理 Webview 生产构建体积 warning，建立 release budget，降低 VSIX 风险。

**主要文件边界**：

- `webpack.config.js`
- `.vscodeignore`
- `package.json`
- `src/frontend/app/main-vscode.ts`
- `src/frontend/app/main-html.ts`
- `src/frontend/shared/**`
- `docs/release-gate.md`

**验收命令**：

- `npm run build:production`
- `npm run package:dry`
- 如使用 analyzer：`npm run build:analyze`

**交付物**：

- source map 打包策略明确。
- bundle budget 写入 release gate。
- 对 Element Plus、i18n、工具面板、波形引擎给出 lazy load 或保留理由。

**依赖关系**：首轮避免大改 Webview 功能组件；与任务 04 的 UI 改动在第 2 轮合并。

### 任务 10：SDK 模板、报告导出声明与发布文档收口

**Worktree**：`.worktree/10`

**目标**：清理“占位/模板/实验性”能力的发布口径，避免 SDK 模板和报告导出被误解为生产能力。

**主要文件边界**：

- `src/driver-sdk/templates/**`
- `src/driver-sdk/utils/DriverUtils.ts`
- `docs/driver-sdk/DEVELOPER_GUIDE.md`
- `docs/功能状态矩阵.md`
- `README.md`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`
- `docs/文档状态索引.md`

**验收命令**：

- `npm run typecheck`
- `npm run lint`
- `rg -n "生产级|100%|完整支持|PDF.*可用|正式版本" README.md docs CHANGELOG.md RELEASE_NOTES.md`

**交付物**：

- SDK 模板明确标注“模板待实现”与“可运行示例”的边界。
- PDF/HTML/ZIP/项目包导出口径收敛为实验性或规划中。
- 发布说明只保留已验证能力。

**依赖关系**：首轮可独立推进；第 2 轮根据其它任务结果更新最终发布文案。

## 建议执行顺序

1. 先做 P0 通道正确性修复和测试迁移。这两个问题直接影响采集数据可信度和 CI 基线。
2. 再运行 standard 层，按失败结果拆分 worktree。不要先扩展协议数量。
3. 然后收紧导出语义和 Webview smoke，让用户主流程可复现。
4. 最后扩 strict gate 和拆大文件。拆分应跟测试一起推进，避免纯结构重排。

## 当前不能声明的内容

- 不能声明真实硬件完整支持。
- 不能声明 `.lac` 与原版 100% 兼容，除非补齐真实原版 GUI 大样本和跨版本 hash 记录。
- 不能声明 PDF 报告可用。
- 不能声明全量单元测试稳定。
- 不能声明项目已完成 strict TypeScript 迁移。
- 不能声明 100+ 协议已支持。

## 文档维护规则

- README 只写当前验证通过的能力和明确限制。
- 功能状态矩阵作为功能声明入口。
- 真实硬件能力必须有 `docs/真实硬件认证矩阵.md` 记录。
- 历史分析文档保留，但不能覆盖当前 release gate。
- 每次运行门禁后，如果测试数量或 warning 变化，需要同步本文或状态矩阵。
