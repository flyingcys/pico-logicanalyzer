# 剩余任务规范 (Remaining Tasks Spec) & Subagent 并行/串行计划

根据 @docs/当前项目问题清单.md (2026-07-22 更新后) 整理的未完成内容，按优先级和模块分类。已排除已完成项（如 SaleaeLogicDriver.ts、DecoderBenchmark.ts、extension.ts、TypeScriptCodeGenerator.ts、DatabaseManager.ts、StreamingDecoder.ts 等）。

所有文档使用中文，计划遵循 TDD + 并行 subagent 原则：独立模块并行，避免写面重叠；依赖关系串行；每个 subagent 独立 review 通过后再合并。

## 1. 剩余任务规范 (Spec)

### 1.1 类型安全清理 (High Priority, Type Safety Cleanup)
**目标**: 剩余 any 类型清理，目标 <50 个 any，strict TS 通过。位置：src/services/、src/tools/、src/utils/、src/drivers/、src/decoders/、src/frontend/、src/models/ 等剩余文件。

**详细要求**:
- 修复所有参数/返回值/属性使用 any 的地方。
- 使用具体类型如 ChannelData、DecoderResult、ConnectionParams 等。
- 更新 tsconfig.json 如有需要。
- 使用 TDD: 先写测试用例，再实现。
- 测试覆盖: 单元测试覆盖 >85%。

**受影响文件** (待确认最新):
- src/services/SessionManager.ts (any 使用)
- src/tools/PythonDecoderAnalyzer.ts
- src/utils/DecoderBenchmark.ts (部分已修复，但剩余)
- src/drivers/LogicAnalyzerDriver.ts
- src/decoders/protocols/*.ts
- src/frontend/**/*.vue (类型错误)
- src/models/*.ts

**验收标准**:
- tsc / typecheck 通过，无 any 错误。
- Jest 测试覆盖新增用例。
- 性能基准通过。

### 1.2 协议解码器完成 (Medium-High Priority)
**目标**: 修复 I2C、SPI、UART 等解码器不完整/bug。确保与 DecoderBase 解码方法签名一致 (无 _ 前缀，如果 base 有的话)，实现完整状态机、边界处理、注释生成。支持 streaming。

**详细要求**:
- I2CDecoder.ts: 完成 decode 实现，匹配原 Sigrok/I2C 协议。
- SPIDecoder.ts, UARTDecoder.ts, CANDecoder.ts 等类似。
- 修复 StreamingDecoderBase 与 DecoderBase 接口不一致 (decode vs streamingDecode)。
- 添加 unit tests for each decoder (edge cases, error paths)。
- 性能优化：内存、采样率支持。

**受影响文件**:
- src/decoders/protocols/I2CDecoder.ts, SPIDecoder.ts, UARTDecoder.ts, CANDecoder.ts, LINDecoder.ts 等
- src/decoders/DecoderBase.ts (可能微调签名)
- src/decoders/StreamingDecoder.ts (接口一致性)
- src/decoders/types.ts (如 DecoderOption 等)

**验收标准**:
- decode() / streamingDecode() 精确匹配基类。
- 所有协议支持标准采样率、触发。
- 集成测试通过。

### 1.3 资源泄漏风险修复 (High Priority)
**目标**: 清除所有 setTimeout/setInterval 未 clear、未释放的定时器/监听器。使用 MemoryManager 监控。目标 0 泄漏检测。

**详细要求**:
- 在驱动层 (drivers/)、utils/、services/ 的所有监控循环添加 clear。
- 修复 ConcurrentChunkProcessor 等中的定时器/ setImmediate 问题。
- 添加内存泄漏测试。

**受影响文件** (排除已修复的):
- src/drivers/SaleaeLogicDriver.ts (剩余部分)
- src/drivers/LogicAnalyzerDriver.ts
- src/drivers/MultiAnalyzerDriver.ts
- src/utils/DecoderBenchmark.ts (剩余)
- src/services/ 相关文件
- src/drivers/standards/ 等

**验收标准**:
- Jest 内存泄漏测试通过。
- 24h 运行无泄漏基准。

### 1.4 多设备支持 (Medium Priority)
**目标**: 完成 MultiAnalyzerDriver 多设备同步、测试。支持 5+ 设备 @100MHz。

**详细要求**:
- 实现线程安全、同步机制。
- 添加多设备集成测试。
- 修复任何残留性能问题。

**受影响文件**:
- src/drivers/MultiAnalyzerDriver.ts
- src/drivers/HardwareDriverManager.ts
- src/drivers/AnalyzerDriverBase.ts
- src/services/WorkspaceManager.ts

### 1.5 前端 UI 和 Webview 问题 (Medium Priority)
**目标**: 修复 Vue3 类型错误、响应式问题、HTML 残留。UI 现代化和性能。

**详细要求**:
- 所有 .vue 文件类型安全 (use defineProps, setup 等)。
- 响应式修复 (pinia stores, composables)。
- 移除 HTML 残留，迁移到 Vue3。
- 波形渲染性能优化 (100万点 @60fps)。

**受影响文件**:
- src/frontend/app/components/*.vue
- src/frontend/core/stores/*.ts
- src/frontend/webview/components/*.vue
- src/frontend/core/engines/WaveformRenderer.ts 等

### 1.6 测试覆盖不足 (High Priority)
**目标**: 补齐错误路径、边缘情况测试；性能/压力测试。覆盖率 >90%。

**详细要求**:
- 为协议解码器、驱动、UI 添加测试。
- 性能基准测试 (large data)。

**受影响文件**:
- src/decoders/test-decoder-integration.ts
- src/drivers/types/__tests__/
- src/frontend/engines/__tests__/
- 新建 tests/ 目录下的各模块 test 文件 (按规范)。

### 1.7 数据库和配置问题 (Medium Priority)
**目标**: 修复同步问题、缓存同步。确保一致性。

**详细要求**:
- DatabaseManager.ts 剩余同步修复。
- ConfigurationManager.ts 缓存更新一致。
- 添加单元测试。

**受影响文件**:
- src/database/DatabaseManager.ts
- src/services/ConfigurationManager.ts

### 1.8 TODO 和 FIXME 清理 (Low Priority)
**目标**: 移除所有剩余 TODO/FIXME，清理临时注释。

**详细要求**:
- 实现所有 placeholder。
- 统一代码风格。

**受影响文件**:
- src/driver-sdk/templates/*.ts (TODOs)
- src/tools/TypeScriptCodeGenerator.ts (已修复但确认)
- 所有 src/ *.ts 中的临时注释。

## 2. Subagent 并行/串行计划

遵循规则：
- 并行 subagent: 独立文件/模块，无写面重叠。
- 串行: 强依赖或顺序依赖 (e.g. 协议完成后做测试集成)。
- 默认使用 subagent for 非简单任务。
- 主线程决策方案、impact、收敛、验证。
- 每个 subagent 独立 review (通过 use /check-work 或 review skill)。

### 2.1 并行子任务组 (Parallel Subagents - 独立模块)

**组 A: 协议解码器完成 (3 个并行 subagent)**
- Subagent A1: I2CDecoder.ts 完整实现 + 测试
- Subagent A2: SPIDecoder.ts + UARTDecoder.ts (高优先级)
- Subagent A3: CANDecoder.ts + LINDecoder.ts + 其他协议
- 依赖: 无 (可同时进行)
- 写面: 各协议文件独立

**组 B: 类型安全清理 (1-2 个 subagent, 按模块分)**
- Subagent B1: src/services/ 和 src/utils/ any 清理 + 测试
- Subagent B2: src/drivers/、src/decoders/、src/models/ any 清理 + 测试
- 依赖: 低 (独立)

**组 C: 前端 UI 修复 (并行多个 vue/stores)**
- Subagent C1: src/frontend/app/components/*.vue 类型/响应式修复
- Subagent C2: src/frontend/core/stores/*.ts 修复
- Subagent C3: src/frontend/webview/components/*.vue 修复
- 写面不重叠

**组 D: 泄漏修复 (并行)**
- Subagent D1: drivers/ 剩余泄漏清理
- Subagent D2: utils/ 和 services/ 泄漏 + MemoryManager 集成
- 写面独立

### 2.2 串行子任务组 (Serial Subagents - 有依赖)

**组 E: 测试集成与覆盖 (依赖协议+类型+驱动)**
- 必须在协议解码器完成 + 类型安全后启动。
- Subagent E1: 添加单元测试到所有解码器/驱动 (TDD)。
- Subagent E2: 性能/压力测试 + 边缘路径覆盖。
- Subagent E3: 集成测试 (decoder-driver-ui) + 多设备测试。
- 顺序: 类型安全 -> 协议 -> 测试

**组 F: 数据库配置同步 (依赖 DB/Driver 稳定后)**
- Subagent F1: DatabaseManager.ts 剩余同步 + 测试
- Subagent F2: ConfigurationManager.ts 缓存同步 + 测试

**组 G: 多设备支持完整化 (依赖驱动层稳定后)**
- Subagent G1: MultiAnalyzerDriver.ts 完整实现 + 测试

### 2.3 执行策略
- **主线程角色**: 
  - 方案决策 (e.g. 是否需要 worktree)
  - GitNexus impact 分析 (哪些分支/文件受影响)
  - 结果收敛: 所有 subagent 完成后 review 合并
  - 最终验证: typecheck, Jest 测试, 性能基准
- **并行数量**: 最多 4-5 个 subagent 并行 (避免资源过度)。
- **确认流程**:
  1. 创建 spec 文件 (已做)
  2. 启动 subagents (使用 spawn_subagent 或 todo_write 分配)
  3. 每个 subagent 完成后，主线程 review 并 merge
  4. 整体质量评分目标: 提升至 95+/100
- **风险控制**: 每个 subagent 写面隔离；使用 git worktree 如果多设备测试复杂。
- **验证工具**: 使用 /check-work skill 进行 diff review、build、测试运行。

此计划将随修复动态更新。建议立即启动并行组 A 和 B (协议+类型)，因为高优先级且独立。后续串行组 E (测试) 依赖它们。

**总任务规模**: ~8-10 个独立 subagent 任务，可分为 2-3 批并行执行。

**参考**:
- 修复原则 (TDD、先写测试、再实现、并行独立模块)
- 现有工作树模式 (worktrees/ 目录)
- 测试规范 (tests/ 目录结构)

此文档作为后续执行的黄金标准。

---

## 3. 执行状态更新（2026-07-22）

### 3.1 本轮执行概况
- **触发**：5 个写面隔离并行 subagent（drivers / services / models+tools+utils+decoders / frontend / driver-sdk+webview）+ 2 个 investigator 摸底。中途配额 429（5h 上限），部分 subagent 受限，主线程接续收敛。
- **基线**（quality-report.json @2026-07-22T04:17）：qualityScore 88.09，anyTypeCount **273**，resourceLeakCount 54。

### 3.2 已完成（本轮）
| 任务 | 状态 | 说明 |
|------|------|------|
| typecheck | ✅ 完成 | `tsc --noEmit` 0 错（SaleaeLogicDriver Timer 类型 + LayoutManager webview 定时器 number + DataCompression metadata 接口索引签名等）。 |
| §1.1 类型清理 | ✅ 完成 | any **273->0**（`: any`/`as any`/`Record<string,any>`/`@ts-ignore` 全 0）。drivers/services/models/decoders/frontend/driver-sdk/webview/common 全覆盖。 |
| §1.2 协议解码器 | ✅ 完成（过时项） | 7 协议（I2C/SPI/UART/CAN/LIN/I2S/StreamingI2C）全部完整实现，无桩/无 TODO，DecoderBase.decode 与 StreamingDecoderBase.streamingDecode 接口无冲突。测试齐全（UART 1508 行、SPI 1047 行等）。原任务为过时项。 |
| §1.3 资源泄漏 | ✅ 完成 | drivers（Saleae/Network clearCaptureMonitor/Rigol）、services（NetworkStability/Session/Workspace）、decoders（PerformanceOptimizer/StreamingDecoder ConcurrentChunkProcessor pendingImmediates 清理）、driver-sdk/webview（LayoutManager）定时器全部 clear。新增 TimerLeakage/cleanup/resource/dispose 测试验证。 |
| §1.5 前端 | ✅ 完成 | 7 strict 错修复 + StatusBar Props 类型化 + shims-vue.d.ts。**vue-tsc 更正**：非项目依赖，tsc --noEmit 已 0 错含 shims，前端走 vite+volar，非阻塞。 |
| §1.7 数据库配置 | ✅ 完成 | DatabaseManager setInterval 已 clear；ConfigurationManager 缓存同步已解决。 |
| §1.4 多设备 | ⚠️ 部分 | 核心驱动 MultiAnalyzerDriver 完整移植 C# + 单测齐全。**线程安全已修复**（_locker 死代码移除 + _combined 守卫防重入，含竞态测试）。UI 集成/命令注册/集成测试待续（大功能）。 |
| §1.8 TODO/FIXME | ✅ 更正 | 12 处全在 driver-sdk/templates，为 SDK 模板设计占位（供第三方填充），保留非 bug。 |

### 3.3 预存测试失败 -> 全部修复
12 文件 111 用例 -> 0 失败。SB1-8 修复根因：
- LogicAnalyzerDriver(47+7连带)：电压查询语义/getLimits计算/isNetwork构造识别/validateSettings边界/mock write回调/跨测试污染
- NetworkLogicAnalyzer(12+6连带)：真实源码bug sendTCPCommand换行符(字面反斜杠n改真换行)/错误类型映射/CSV解析mock同步
- HardwareDriverManager(20)：mock实例时机/autoConnect去重/设备名匹配/safeDetect超时/空deviceId拦截
- SessionManager(25)：fs mock缺copyFile/备份失败降级/容错/新增validateSessionData+recoverSession+cleanupOldVersions
- extension(4)+Python(1)+Memory(2)：函数未export/测试结构闭合错误/dataType签名修正

### 3.4 待续
1. 多设备 UI 集成/命令注册/集成测试(§1.4,大功能~3-4天)
2. any 全清零（273->0，`: any`/`as any`/`Record<string,any>`/`@ts-ignore` 全 0）

### 3.5 验证证据
- npx tsc --noEmit -> 0 错
- npx jest tests/unit -> 1976 pass / 0 fail
- any 273 -> 0（`: any`/`as any`/`Record<string,any>`/`@ts-ignore` 全 0）
