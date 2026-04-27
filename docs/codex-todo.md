# Codex TODO — VSCode 插件版逻辑分析仪后续计划（详细版）

文档版本: 2025-09-05
适用范围: 本仓库 VSCode 插件实现（`src/*`）与对照原版（`logicanalyzer/*`）
目标读者: 核心开发、维护者、贡献者

## 1. 目标与非目标

- 目标
  - 持续对齐原版 C# 驱动/数据链路/文件格式能力，确保与硬件协议 100% 兼容。
  - 大幅提升协议解码覆盖面（从 3 类到 30+，最终迈向 100+）。
  - 完整打通 Webview 交互与数据导出、设备管理、网络诊断等服务。
  - 引入/移植 SDL（Signal Description Language）能力，支撑测试样本生成与自动化用例。
  - 构建稳定的测试与基准体系（单元、协议金样、性能/内存/流式压力）。

- 非目标（当前阶段）
  - 不直接在插件内实现完整桌面级 UI（沿用 VSCode Webview 模式）。
  - 不强制引入 Python 运行时作为长期依赖（可作过渡可选项）。

## 2. 里程碑与优先级

- M1（近期，2–3 周）
  - 协议解码：首批 8–12 个协议转换与验证（CAN、LIN、I2S、MDIO、OneWire、I2C filter、SPI Flash、SD、JTAG/SWD、UART 变体、SPI 变体）。
  - Webview 导出入口打通（CSV/JSON/VCD/LAC/ZIP 工程包）。
  - `.tcs` 采集设置文件读写支持。
  - 流式解码路径的性能监控与可视化（前端卡片显示）。

- M2（中期，4–6 周）
  - 协议解码：覆盖 30+ 协议；支持嵌套/串接解码树；加入常用工业协议（Modbus、MIDI、I²S、PWM 族等）。
  - SDL（解析/生成）最小可用：可从 DSL 生成样本并导入视图。
  - DeviceManager 真接入 `HardwareDriverManager`/`WiFiDeviceDiscovery`。

- M3（中长期，6–10 周）
  - 协议解码：覆盖 60+，流式与非流式两套路径稳定。
  - 可选：Python 运行时桥接（过渡方案）完成，支持直接调用原 Python 解码器。
  - 完成 CI 基准：协议金样回归、性能阈值、内存峰值约束。

- M4（展望）
  - 解码覆盖 100+；输出报告模板（HTML/PDF）完善；生态驱动模板与示例集齐全。

## 3. 任务总览（按领域拆解）

### A. 协议解码能力补齐（高优先）

- 背景/目标：原版 Python 解码器 130+；当前插件仅 I2C/SPI/UART（TS）。需按优先级批量转换并完善流式支持。

- 范围
  - 基于 `src/tools/PythonDecoderAnalyzer.ts` + `src/tools/TypeScriptCodeGenerator.ts` 的半自动转换链。
  - 在 `src/decoders/protocols/*` 产出 TS 解码器；更新 `DecoderManager` 注册与解码树能力。

- 子任务
  1) 转换清单与复杂度评估：扫描 `logicanalyzer/Software/decoders/*`，按 simple/medium/complex 归档并排优先队列（CAN、LIN、OneWire、MDIO、I2S、SPI Flash、SD、I2C filter、PWM、JTAG/SWD、MIDI 等）。
  2) 自动化模板产出：使用 Analyzer + CodeGenerator 产出骨架；补齐 annotations/rows/options/通道映射。
  3) 手工逻辑对齐：校对 `wait/put` 语义与 TypeScript `wait` 实现（边界/并发/采样率差异）。
  4) 单元测试与金样：为每个解码器准备最小金样波形；断言注释类型/区间/值一致。
  5) 流式解码适配：分块与 overlap 处理；保证跨块状态一致；进度/性能指标回传。

- 验收标准：M1 完成 8–12 个，M2 达 30+；每个解码器具备金样测试；结果与原版一致或等价。

- 依赖：需样本（来自原版或自制）。

- 风险与缓解：复杂协议依赖 sigrok 内部状态；先做简单协议，复杂协议用桥接运行时作为过渡（见任务 E）。

- 工期：simple 0.5–1 人日/个；medium 1–2 人日/个；complex 3–5 人日/个。

- 测试计划：`tests/decoders/*` 新增用例、金样 JSON 对比。

- 指标：解码器数量、覆盖率、测试通过率、吞吐（样本/秒）、内存峰值。

### B. `.tcs` 采集设置文件支持（中优先）

- 背景/目标：原版支持“仅保存设置”（.tcs）；插件当前仅 LAC。

- 范围：新增 `src/models/CaptureSettingsFile.ts`（建议）或在 `LACFileFormat` 附近实现。提供 `saveSettings` 与 `loadSettings` API。

- 子任务
  1) 结构定义与序列化：对齐 C# `CaptureSession.CloneSettings()`（无 Samples、仅 Settings）。
  2) UI/命令入口：在 `extension.ts` 增加保存/打开设置命令；Webview 菜单入口。
  3) 兼容策略：旧版本/缺字段默认值处理与提示。

- 验收标准：可保存/打开 .tcs，打开后能直接用于采集，字段语义一致。

- 工期：1–2 人日。

### C. Webview 导出入口打通（高优先）

- 背景/目标：`LACEditorProvider` 的 `export` 分支为 TODO；`DataExportService` 已具备能力。

- 范围：将 Webview 导出动作与 `DataExportService` 对接，支持 CSV/JSON/VCD/LAC/ZIP。

- 子任务
  1) 消息协议：`webview` -> `LACEditorProvider` 发送导出请求（格式、范围、通道、是否含解码结果等）。
  2) Provider 调用：实例化 `DataExportService` 生成文件字节并使用 VSCode `saveDialog` 保存。
  3) 进度/错误反馈：Webview 内展示进度、完成、错误信息。

- 验收标准：所有格式可在 Webview 中导出；大样本导出不卡 UI（流式/分块）。

- 工期：2–3 人日。

### D. DeviceManager 真接入与网络能力完善（中优先）

- 背景/目标：`DeviceManager.vue` 目前含模拟；需对接 `HardwareDriverManager`、`WiFiDeviceDiscovery`、`NetworkStabilityService`。

- 范围：设备扫描、连接、断开、状态展示、网络诊断；多驱动（Pico、Sigrok、Saleae、Rigol/Siglent）。

- 子任务
  1) 扫描入口：`hardwareDriverManager.detectHardware()` + `wifiDiscovery.scanForDevices()`，归一设备列表。
  2) 连接/断开：绑定 UI 操作到驱动 connect/disconnect，展示状态/错误。
  3) 诊断/优化：触发 `NetworkStabilityService.runDiagnostics()`，展示报告，支持 `optimizeConnection()`。

- 验收标准：Webview 可真实发现/连接设备；网络诊断结果可视；错误路径健壮。

- 工期：3–5 人日。

### E. 可选：Python 解码运行时桥接（过渡方案）（中优先，可选）

- 背景/目标：在未完全转换前，允许调用原 Python 解码器（子进程 IPC）。

- 范围：Node 子进程调用 Python 执行指定解码器，输入采样数据，输出注释。

- 子任务
  1) 运行器：新增 `src/tools/PythonBridgeRunner.ts`，构造命令行、传输 JSON/二进制、收集输出、限时与错误处理。
  2) 管理器集成：`DecoderManager` 支持“桥接型解码器”注册与执行，TS 优先，缺失回退 Python。
  3) 安全与配置：VSCode 设置项（启用/禁用、运行时路径、白名单）。

- 验收标准：若干协议可通过 Python 运行，结果正确；性能在可接受范围；默认关闭且可一键检测环境。

- 工期：5–8 人日（最小可用）。

### F. SDL（Signal Description Language）支持（中优先）

- 背景/目标：原版有 SDL；插件需提供解析/样本生成能力以支撑测试与示例。

- 范围：
  - 方案 1：TS 移植 C# `SignalDescriptionLanguage/Parser.cs` 逻辑；
  - 方案 2：桥接 dotnet/WASM（长期）。

- 子任务
  1) 语法/Token 移植：正则、分组、转义、字节序；
  2) 样本生成：输出多通道数字样本；
  3) 集成：Webview 工具页输入 SDL -> 生成样本 -> 预览/导入。

- 验收标准：覆盖核心语法（Initial/Value/Byte/String/Group/GroupName）；示例脚本输出正确。

- 工期：7–10 人日（TS 最小可用）。

### G. 测试与基准（高优先）

- 范围：
  - 单元：驱动、LAC/Settings、TriggerProcessor、BinaryDataParser、DecoderBase；
  - 金样：I2C/SPI/UART + 新增协议；
  - 性能：解码吞吐、分块开销、内存峰值；导出器吞吐与体积。

- 子任务
  1) `tests/` 增强：为新增模块与协议补充测试；
  2) CI 指标：失败阈值与性能基线；生成 HTML 报表。

- 验收标准：关键模块单测通过率 > 85%；金样一致性 100%；性能阈值无回归。

### H. 文档与示例（中优先）

- 范围：使用文档、开发者指南、解码器开发模板、驱动 SDK 示例。

- 子任务
  1) `/docs` 与 `driver-sdk/docs/DEVELOPER_GUIDE.md` 扩充；
  2) 示例工程：导出、解码、网络诊断流水线。

- 验收标准：新人可按文档完成一个协议解码器的新增与测试。

### I. 性能与内存优化（持续）

- 范围：流式解码重叠策略/并发度/内存曲线；导出器分块写；性能监控对接。

- 子任务
  1) `StreamingDecoder` 参数暴露（chunkSize/overlap/maxConcurrency）到 UI；
  2) `PerformanceAnalyzer.vue` 与 `PerformanceMonitor` 对接。

- 验收标准：大样本（>50M）可在可接受时间内完成解码/导出，内存峰值受控。

## 4. 追踪字段模板（用于每个任务/子任务记录）

- 标题：
- 描述：
- 优先级：P0/P1/P2
- Owner/Reviewer：
- 关联文件/模块：
- 依赖：
- 验收标准（Checklist）：
- 风险与缓解：
- 预估/实际用时：
- 状态：Todo / In Progress / Blocked / Done

## 5. 关键文件与入口（便于落地）

- 驱动与采集：`src/drivers/LogicAnalyzerDriver.ts`、`src/drivers/MultiAnalyzerDriver.ts`、`src/drivers/NetworkLogicAnalyzerDriver.ts`、`src/drivers/HardwareDriverManager.ts`、`src/models/CaptureModels.ts`、`src/models/TriggerProcessor.ts`、`src/models/BinaryDataParser.ts`
- 存储与格式：`src/models/LACFileFormat.ts`、（新增建议）`src/models/CaptureSettingsFile.ts`
- 解码框架：`src/decoders/DecoderBase.ts`、`src/decoders/DecoderManager.ts`、`src/decoders/StreamingDecoder.ts`、`src/decoders/protocols/*`、`src/tools/PythonDecoderAnalyzer.ts`、`src/tools/TypeScriptCodeGenerator.ts`、（可选）`src/tools/PythonBridgeRunner.ts`
- 导出与数据统一：`src/services/DataExportService.ts`、`src/models/UnifiedDataFormat.ts`
- UI / Webview：`src/providers/LACEditorProvider.ts`、`src/webview/components/*`（重点：DeviceManager.vue / DecoderPanel.vue / DataExporter.vue / PerformanceAnalyzer.vue）
- 网络与诊断：`src/services/WiFiDeviceDiscovery.ts`、`src/services/NetworkStabilityService.ts`

## 6. 里程碑交付物清单

- M1：8–12 个新增解码器（含金样测试）；.tcs 支持；导出入口打通；性能面板展示。
- M2：30+ 解码器；SDL 最小可用；DeviceManager 真接入；网络诊断 UI 完整。
- M3：60+ 解码器；Python 桥接可选完成；CI 性能基准上线。
- M4：100+ 解码器；报告模板完善；生态驱动示例齐备。

## 7. 备注

- 若迁移/桥接第三方运行时（Python/dotnet），需提供开关与安全沙箱提示，并以“可选增强”描述，避免默认依赖破坏用户轻量体验。
- 所有新增协议/功能应附最小可运行示例与测试，以降低维护成本。
