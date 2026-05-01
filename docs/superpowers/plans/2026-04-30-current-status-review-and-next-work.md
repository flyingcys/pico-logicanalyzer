# 当前状态复盘与下一步工作实施计划

> **给自动化执行者:** 后续若按本文执行实现任务，必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项推进。本文先作为 2026-04-30 的代码与文档复盘基线，任务项使用复选框方便拆分追踪。

**目标:** 重新 review 当前代码和文档，明确项目真实状态、已收口能力、仍阻断发布或硬件认证的问题，并给出下一阶段工作清单。

**架构:** 当前仓库已经形成 VSCode 扩展入口、Vue3 Webview、硬件驱动抽象、`.lac` 读写、协议解码、导出服务、CLI 和分层测试门禁。下一阶段不再堆新协议数量，优先补真实硬件证据、发布 smoke、严格类型覆盖和大文件职责拆分。

**技术栈:** TypeScript、Vue3、Pinia、Webpack、Jest、VSCode Custom Editor、VSIX、Pico Logic Analyzer、sigrok 参考数据。

---

## 本次复查范围

- 代码入口：`src/extension.ts`、`src/providers/LACEditorProvider.ts`
- 前端主链路：`src/frontend/app/*`、`src/frontend/core/stores/*`、`src/frontend/platform/host/*`
- 协议解码：`src/decoders/*`、`src/decoders/protocols/*`
- 文件与导出：`src/models/LACFileFormat.ts`、`src/services/DataExportService.ts`
- 质量门禁：`package.json`、`scripts/ci-test-runner.js`、`scripts/release-check.ts`、`.github/workflows/quality-gate.yml`、`webpack.config.js`、`.vscodeignore`
- 当前有效文档：`README.md`、`docs/功能状态矩阵.md`、`docs/真实硬件认证矩阵.md`、`docs/release-gate.md`、`docs/文档状态索引.md`、`docs/tests/README.md`
- 历史参考：`docs/code-review-and-next-tasks-2026-04-28.md`、`docs/协议分析插件闭环与手工测试准入评审-2026-04-29.md`、`docs/superpowers/plans/2026-04-29-decoder-parity-auto.md`

未做真实硬件验证；未声明任何 `hardware`、`verified` 或 `certified` 级别结论。

## 本次实际验证

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `rtk npm run typecheck` | 通过 | 主 `tsconfig.json` 仍关闭 strict，不代表全仓严格类型安全。 |
| `rtk npm run typecheck:strict` | 通过 | 当前 strict gate 覆盖 `src/models/*.ts`、`src/decoders/*.ts` 和少量入口。 |
| `rtk npm run lint` | 通过 | 会改写已跟踪 `.eslintcache`，本次已还原缓存变更。 |
| `rtk npm run test:decoders -- --runInBand` | 通过 | 10 个测试套件、196 个测试；解码器内部进度、注册和停止日志默认由 `PICO_DECODER_DEBUG` 开关静默。 |
| `rtk npm run test:webview:unit -- --runInBand` | 通过 | 3 个测试套件、98 个测试；`ts-jest isolatedModules` 配置 warning 已迁移处理。 |
| `rtk npm run test:ci:quick -- --skip-install` | 通过 | 14 个核心测试文件全部通过，373 个测试，暂不阻断测试 0 个。 |
| `rtk npm run package:dry` | 通过 | `vsce ls` 会执行 `vscode:prepublish`，因此本次实际触发了 `build:production`；Webview entrypoint 约 2.23 MiB。 |
| `rtk node scripts/ci-test-runner.js --layer=quick --dry-run` | 通过 | dry-run 显示 quick 只覆盖 coreTests，不运行测试。 |

本次验证产生的 `out/extension.js` 和 `.eslintcache` 变更属于构建/缓存噪音，已还原。

## 当前状态判断

项目当前应继续定位为 Beta / 工程整备阶段。软件侧核心闭环已经明显推进：扩展入口、`.lac` 自定义编辑器、Vue3 Webview、I2C/SPI/UART/CAN/LIN/I2S 解码、流式 I2C、LAC/CSV/JSON/VCD 导出主链路和 Quick CI 均有自动化证据支撑。

但“可发布”和“真实硬件可用”仍未闭环。真实 Pico / Pico W / Pico 2 采集记录、VSIX 干净安装 smoke、原版 GUI `.lac` 双向往返、大样本跨版本 hash、Saleae/Rigol/Siglent/sigrok 硬件认证仍缺证据。文档必须继续使用实验性、fixture、framework、candidate 等分级口径。

## 已收口能力

- VSCode 扩展入口和 `.lac` Custom Editor 已接入，`package.json` 注册命令和 `logicAnalyzer.lacEditor`。
- `LACEditorProvider` 已提供 `runDecoder`、设备扫描/连接、采集、保存和 `exportData` host command。
- Vue3 前端已经替代旧 `src/webview/App.vue` 的主体验入口，右侧协议面板支持 I2C/SPI/UART/CAN/LIN/I2S。
- `sessionStore` 可解析 PascalCase/lowercase `.lac`，并从 root `Samples` 按真实 `channelNumber` 拆样本。
- `waveformStore` 已覆盖缩放、平移、选区、region、marker、测量和样本编辑基础状态。
- `DecoderManager` 内建 6 个常规解码器和 `streaming_i2c`；`test:decoders` 当前通过。
- `.vscodeignore` 已排除 `.worktree/`，本次 `package:dry` 清单未包含 `.worktree`。
- CI quick 层暂不阻断测试为 0，旧 `utest/mocks` 引用已从 CI 覆盖文件迁移到 `tests/fixtures/mocks`。

## 仍存在的关键风险

### P0：真实硬件认证仍缺证据

`docs/真实硬件认证矩阵.md` 当前最高主要是 fixture / experimental / framework 级别。没有真实设备型号、固件版本、commit、采集配置、结果文件 sha256 和截图前，README、用户手册和发布说明都不能写成已认证支持。

### P0：发布 smoke 未完整记录

`package:dry` 只能证明 VSIX 清单可生成，不能替代干净 VSCode 安装 smoke。正式发布候选仍必须执行：生成 VSIX、干净用户数据目录安装、打开最小 `.lac`、运行设备错误路径、运行合成采集命令、卸载检查残留。

### P1：类型门禁仍是分阶段 strict

主 `tsconfig.json` 仍关闭 `strict`、`noImplicitAny`、`strictNullChecks` 等。`tsconfig.strict.json` 只覆盖 models/decoders 相关入口，drivers、services、frontend 仍未纳入全量 strict。

### P1：生产构建仍依赖 `transpileOnly`

`webpack.config.js` 中 extension 和 webview 的 `ts-loader` 都启用 `transpileOnly: true`。当前 release gate 已把 typecheck 作为前置门槛，但不能只跑 `build:production` 就声明类型质量通过。

### P1：Full 层和全量单测仍有资源清理债

Quick 本次通过；历史文档显示 Standard/Full 曾通过。但 Full 层仍依赖 `--forceExit`，`npm run test:unit` 曾出现长时间无输出，后续应继续定位开放句柄、长耗时测试和缺少中间输出的问题。

### P1：测试与构建日志噪音影响 CI 可读性

解码器内部进度、注册和停止日志已由 `PICO_DECODER_DEBUG` 开关控制，`ts-jest isolatedModules` 配置 warning 已迁移处理。Full 层和 extension 激活测试仍有独立日志可读性债，后续应继续按模块收敛。

### P1：大文件职责仍过重

当前大文件规模：

| 文件 | 行数 | 风险 |
| --- | ---: | --- |
| `src/services/DataExportService.ts` | 2305 | 波形导出、报告、ZIP、项目包、helper 混在一起。 |
| `src/drivers/HardwareDriverManager.ts` | 1479 | 发现、排序、连接生命周期和数据库口径耦合。 |
| `src/providers/LACEditorProvider.ts` | 1311 | Webview HTML、host command、采集、导出、网络命令混合。 |
| `src/drivers/LogicAnalyzerDriver.ts` | 1247 | Pico 协议、采集状态机、网络配置和 parser 混合。 |
| `src/frontend/app/components/AppSidebarRight.vue` | 1160 | 多协议 UI、映射、选项和结果展示集中在单组件。 |
| `src/frontend/core/stores/decoderStore.ts` | 926 | 多协议映射、选项、冲突检查和执行状态集中在单 store。 |

拆分前必须先补边界测试，避免一次性重构造成回归。

### P1：导出能力声明仍需持续收敛

Webview 主链路当前只应声明 LAC/CSV/JSON/VCD。`DataExportService` 中 HTML/PDF/ZIP/project 仍有占位或实验性实现，PDF 明确是占位内容，不能写入发布主功能。

### P2：历史文档仍有夸大口径

`docs/文档状态索引.md` 已把 `docs/功能对比分析/*`、`docs/vscode-extension/*`、`docs/utest/*`、`docs/tests-docs/*` 等标为历史资料，但其中仍大量保留 “100%”“生产级”“完全兼容”等旧表述。当前有效文档引用这些资料时必须带“历史分析”限定。

## 文档状态修正建议

- `README.md` 当前仍写 `package:dry` 通过并触发 `build:production`，本次验证确认事实成立，但应补一句说明这是 `vsce` 执行 `vscode:prepublish` 的结果，而不是 `package.json` 脚本文本直接串联。
- `docs/tests/README.md` 当前“当前校验状态”仍标注 2026-04-28，建议更新到 2026-04-30：Webview unit 为 98 个测试、decoder 为 196 个测试、Quick 为 373 个测试。
- `docs/文档状态索引.md` 建议追加本文为当前有效文档，并明确 `docs/协议分析插件闭环与手工测试准入评审-2026-04-29.md` 是“含追加完成记录的历史准入评审”，不要只读开头的阻断结论。
- 源码注释中 `LACFileFormat.ts`、`UnifiedDataFormat.ts` 的“100% 兼容”建议改为“按原版结构对齐，仍需真实样本往返证据”。

## 下一阶段工作清单

### 任务 1：真实硬件认证闭环

**文件：**
- 修改：`docs/真实硬件认证矩阵.md`
- 修改：`docs/hardware-validation/*.md`
- 新增：`docs/hardware-validation/records/*.md`（如后续建立记录目录）

- [ ] 用真实 Pico LogicAnalyzer 采集 8/16/24 通道、非连续通道、stop/abort 后重采、loop/blast。
- [ ] 用真实 Pico + I2C/SPI/UART/LIN/I2S/CAN 信号源完成 `.lac`、截图、sha256 和结论记录。
- [ ] Pico W 补 TCP `4045` 握手、采集、断线重连、网络诊断、串口回退记录。
- [ ] Saleae / Rigol / Siglent / sigrok 只在有具体设备记录后提升状态。

### 任务 2：VSIX 发布 smoke

**文件：**
- 修改：`docs/release-gate.md`
- 修改：`RELEASE_NOTES.md`
- 修改：`CHANGELOG.md`

- [ ] 运行 `rtk npm run package` 生成 VSIX。
- [ ] 在干净 VSCode 用户数据目录安装 VSIX。
- [ ] 打开最小 `.lac`，确认自定义编辑器、波形、右侧协议面板加载。
- [ ] 无设备环境运行 `Connect Device`，确认错误路径不挂死。
- [ ] 运行 `Create Synthetic Capture`，确认成功/失败反馈和输出文件。
- [ ] 记录 smoke 环境、VSIX 名称、commit、截图和结论。

### 任务 3：strict gate 扩围

**文件：**
- 修改：`tsconfig.strict.json`
- 修改：`src/drivers/*`
- 修改：`src/services/*`
- 修改：`src/frontend/core/*`

- [ ] 先把公共类型和 driver/service 入口纳入 strict。
- [ ] 优先清理生产源码中的 `any` / `as any`，测试里的 mock 类型债可单独排期。
- [ ] 扩围后运行 `rtk npm run typecheck:strict` 和对应单测。

### 任务 4：测试基础设施和日志清理

**文件：**
- 修改：`jest.config.js`
- 修改：`jest.webview.config.js`
- 修改：`src/decoders/StreamingDecoder.ts`
- 修改：`src/decoders/DecoderManager.ts`
- 修改：`src/decoders/DecoderRegistry.ts`

- [ ] 处理 `ts-jest isolatedModules` 弃用 warning。
- [ ] 为解码器内部日志加 debug 开关，默认测试输出保持安静。
- [ ] 定位 Full 层 `--forceExit` 根因，减少开放句柄。
- [ ] 拆分 `npm run test:unit` 长耗时路径，形成可重复的诊断表。

### 任务 5：导出和保存用户路径补强

**文件：**
- 修改：`src/providers/LACEditorProvider.ts`
- 修改：`src/services/DataExportService.ts`
- 修改：`src/frontend/core/services/exportRequestService.ts`
- 修改：`tests/unit/services/DataExportService.accurate.test.ts`
- 修改：`tests/unit/extension/*` 或新增 provider 专项测试

- [ ] 补 `exportData` 用户取消、保存失败、格式不支持、选区/区域导出测试。
- [ ] 确认 `visible` / `selection` 不依赖后端默认 50% fallback，而是来自 Webview 请求。
- [ ] 保持 Webview 主链路只声明 LAC/CSV/JSON/VCD。
- [ ] PDF/HTML/ZIP/project 未完成前继续标实验性或占位。

### 任务 6：大文件渐进拆分

**文件：**
- 修改：`src/services/DataExportService.ts`
- 修改：`src/providers/LACEditorProvider.ts`
- 修改：`src/frontend/app/components/AppSidebarRight.vue`
- 修改：`src/frontend/core/stores/decoderStore.ts`
- 修改：`src/drivers/HardwareDriverManager.ts`

- [ ] `DataExportService` 先拆 waveform exporters、report/project exporters、range/metadata helpers。
- [ ] `LACEditorProvider` 先拆 host command router、export workflow、capture workflow、asset manifest loader。
- [ ] `AppSidebarRight.vue` 按协议拆小组件，保留统一结果展示。
- [ ] `decoderStore` 拆协议配置 builder 和冲突检查 helper。
- [ ] `HardwareDriverManager` 拆 discovery profile、detector、connection lifecycle。

### 任务 7：文档口径归一

**文件：**
- 修改：`README.md`
- 修改：`docs/文档状态索引.md`
- 修改：`docs/tests/README.md`
- 修改：`docs/功能状态矩阵.md`
- 修改：`docs/真实硬件认证矩阵.md`

- [ ] 将本文加入文档状态索引。
- [ ] 更新 2026-04-30 的测试数字和命令证据。
- [ ] 把源码注释和当前有效文档中的绝对兼容话术改为证据分级口径。
- [ ] 历史文档保留原文，但索引必须能阻止其被当作当前状态引用。

## 推荐执行顺序

1. 先完成任务 7，让当前文档入口不再互相冲突。
2. 并行推进任务 2 和任务 4，尽快得到发布候选的可复现 smoke 与干净 CI 输出。
3. 有硬件时优先做任务 1；没有硬件时不要伪造状态，只维护 `pending` 记录。
4. 任务 3 和任务 6 分模块滚动推进，每次只扩大一个边界并跑对应门禁。
5. 任务 5 在导出 UI 用户路径和真实 `.lac` 样本到位后收口。

## 当前结论

截至 2026-04-30，本仓库的软件侧自动化基线是健康的：类型检查、分阶段 strict、lint、decoder、webview unit、Quick CI 和 VSIX dry run 均通过。项目仍不是生产就绪，主要缺口不在“代码完全不能跑”，而在真实硬件证据、发布 smoke 记录、严格类型覆盖、Full 层资源清理和文档口径长期一致性。
