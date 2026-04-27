# 当前项目与 logicanalyzer 差距深度分析

分析时间：2026-04-27 23:12 CST  
当前项目：`/home/share/samba/vscode-extension/pico-logicanalyzer`  
参考基准：`/home/share/samba/vscode-extension/pico-logicanalyzer/logicanalyzer`

## 1. 结论摘要

当前项目已经不是原版 `logicanalyzer` 的直接移植，而是以 VSCode 扩展为载体，尝试建立“多硬件逻辑分析平台”。这带来了更大的目标范围，但也导致与原版之间存在三类差距：

| 类别 | 当前状态 | 影响 |
| --- | --- | --- |
| 原版核心闭环 | `.lac` 编辑器、Pico 驱动、少量波形渲染和 I2C/SPI/UART 解码器已有雏形 | 还不能稳定替代原版桌面软件完成真实设备采集、查看、编辑、解码、保存的完整流程 |
| 原版专有能力 | 固件、硬件、电路、外壳、终端采集、命令行采集、信号描述语言、完整 sigrok 解码器生态基本缺失 | 如果目标是对齐整个 `logicanalyzer` 项目，当前只覆盖了软件端的一部分 |
| 当前额外扩展 | Saleae、Rigol/Siglent、sigrok 适配、驱动 SDK、数据库、网络发现等大量设计已存在 | 很多是框架、示例或模拟实现，尚未形成与原版同等级别的可验证产品能力 |

最关键的差距不是“文件数量少”，而是多个关键路径尚未闭环：

- 真实 Pico 设备采集链路仍存在协议兼容和流读取风险。
- 新 Vue3 前端目前只接入了布局、文档摘要和画布生命周期，旧功能面板大量不再挂接真实流程。
- 原版 132 个 sigrok 解码器目录当前只对应 3 个常规 TypeScript 解码器和 1 个流式 I2C。
- `.lac` 兼容性存在字段大小写、样本编码、导出入口不一致等风险。
- 原版的样本编辑、区域、测量、信号生成、重复分析、终端工具等工作流基本缺失或未接回。

## 2. 对比范围和基准

### 2.1 参考项目包含的能力

本地 `logicanalyzer` 不是单一软件仓库，而是完整产品包：

- `Firmware/`：Pico / Pico W / Pico 2 固件、PIO、DMA、WiFi、板级配置、构建脚本。
- `Electronics/`：KiCad、Jitx、Altium/EasyEDA 等硬件设计文件。
- `Enclosure/`：外壳 3D 模型、STL、SolidWorks 文件。
- `Software/LogicAnalyzer/LogicAnalyzer`：Avalonia 桌面 GUI。
- `Software/LogicAnalyzer/SharedDriver`：C# 共享硬件驱动和协议实现。
- `Software/LogicAnalyzer/CLCapture`：命令行批量采集工具。
- `Software/LogicAnalyzer/TerminalCapture`：终端交互式采集工具。
- `Software/LogicAnalyzer/SignalDescriptionLanguage`：信号描述语言解析器。
- `Software/decoders`：132 个 sigrok 解码器目录。

### 2.2 当前项目包含的能力

当前项目是 VSCode 扩展：

- `package.json` 注册命令、自定义 `.lac` 编辑器、配置项和构建测试脚本。
- `src/extension.ts` 实现 VSCode 命令入口。
- `src/providers/LACEditorProvider.ts` 提供自定义编辑器 Webview。
- `src/drivers` 提供 Pico、Multi、Saleae、Rigol/Siglent、sigrok、网络通用驱动。
- `src/decoders` 提供 TypeScript 解码器框架和 I2C/SPI/UART/Streaming I2C。
- `src/frontend` 是新 Vue3 前端，当前 `src/webview/App.vue` 已转接到它。
- `src/webview` 仍保留大量旧组件和渲染引擎，但不少不再被新入口直接使用。
- `tests` 下有 85 个测试/报告文件，但 TypeScript 严格检查被关闭，且存在大量模拟实现。

## 3. 总体差距矩阵

| 模块 | 原版能力 | 当前项目状态 | 差距等级 |
| --- | --- | --- | --- |
| 产品形态 | 桌面 GUI + CLI + TUI + 固件 + 硬件文件 | VSCode 扩展为主，附带驱动 SDK 和模拟/扩展适配 | 高 |
| Pico 通信协议 | C# 与固件严格匹配，已用于实际软件 | TypeScript 近似移植，但存在协议语义偏差和流读取风险 | 高 |
| 设备发现 | Windows/Linux 针对 VID/PID 1209/3020 精准发现 | 串口检测使用 Raspberry Pi Pico VID/PID、网络全网段扫描、部分检测器为假设实现 | 高 |
| 多设备级联 | 2-5 台同步，主从触发，合并通道 | 已有类，但事件索引、会话克隆、参数校验与原版不完全一致 | 高 |
| `.lac` 格式 | `ExportedCapture { Settings, Samples?, SelectedRegions? }` | 同时存在 `Settings` 兼容类和 lowercase 导出服务，前端只浅解析 | 高 |
| 波形查看 | SampleViewer/Previewer/Marker/AnnotationViewer 全闭环 | 新前端只显示画布占位；旧引擎保留但未完整接回 | 高 |
| 样本编辑 | 选择、复制、剪切、粘贴、插入、删除、移位、区域 | 旧引擎/工具有部分类，前端工作流未闭环 | 高 |
| 采集配置 | 图形对话框、通道名、触发、jitter、持久化 | VSCode 命令里是简化 QuickPick/InputBox；新前端未完整挂接 | 高 |
| 协议解码 | 动态加载 132 个 sigrok 解码器，支持解码树级联 | 3 个常规解码器 + 1 个流式 I2C，解码树和输入输出桥接能力不完整 | 高 |
| CLI/TUI | CLCapture 和 TerminalCapture | 无等价用户工具，仅有开发脚本 | 高 |
| 信号生成 | SignalDescriptionLanguage + SignalComposer | 当前缺失等价功能 | 高 |
| 网络/WiFi | Pico W 电压状态、网络配置、TCP 连接 | 有网络扫描和配置服务，但与原版端口/协议/设备确认未完全一致 | 中高 |
| 固件/硬件 | 完整固件、电路、外壳、发布包 | 当前项目不维护这些资产 | 中高，取决于项目边界 |
| 测试与质量 | 原版更多依赖实际软件成熟度 | 当前测试多，但 strict 关闭、CI 文件被删除、模拟比例高 | 中高 |
| 额外硬件生态 | 原版聚焦 Pico 生态 | 当前扩展 Saleae/Rigol/Siglent/sigrok，但不少是框架或假设协议 | 中 |

## 4. 硬件、固件、电路资产差距

如果对齐目标是整个 `logicanalyzer` 项目，当前项目缺失以下完整产品资产：

| 原版资产 | 原版位置 | 当前状态 | 差异 |
| --- | --- | --- | --- |
| Pico 固件 | `logicanalyzer/Firmware/LogicAnalyzer*` | 当前无固件源码 | 无法独立演进命令协议、PIO 采样、DMA、WiFi、板级配置 |
| Pico 2 / V2 固件 | `Firmware/LogicAnalyzer_V2` | 当前无 | 无法覆盖 Pico 2、400MHz blast、V2 板级能力 |
| WiFi 固件事件机 | `Event_Machine.*`, `LogicAnalyzer_WiFi.*` | 当前只在扩展侧实现网络服务 | 缺少端到端固件协议验证 |
| KiCad/Jitx/Altium 硬件 | `Electronics/` | 当前无 | 无 PCB、BOM、原理图、制造文件 |
| 外壳模型 | `Enclosure/` | 当前无 | 无机械外壳资产 |
| 发布压缩包 | `compiled-release-*.tar.gz` | 当前只有 VSIX | 发布形态不同，无法替代原版 all-in-one 包 |

这部分不一定应该由 VSCode 扩展仓库承接，但文档和产品边界必须明确。如果当前项目声称“Pico LogicAnalyzer 替代版”，至少需要说明固件和硬件仍依赖上游原版。

## 5. Pico 驱动与通信协议差距

### 5.1 已接近原版的部分

当前 `src/drivers/AnalyzerDriverBase.ts` 和 `src/drivers/LogicAnalyzerDriver.ts` 已移植了原版关键结构：

- `OutputPacket` 起止标记 `0x55 0xAA` / `0xAA 0x55` 与 `0xAA/0x55/0xF0` 转义规则一致。
- `CaptureRequest` 字段顺序基本按 C# `StructLayout.Sequential` 写入。
- 串口 / TCP 初始化均发送命令 `0` 并读取版本、最大频率、blast 频率、缓冲区、通道数。
- 命令码 `1` 采集、`2` 网络配置、`3` 电压、`4` bootloader、`0xFF` 停止采集基本对齐。
- 8/16/24 通道模式的数据读取和样本位提取思路与原版一致。

### 5.2 高风险差异

| 差异点 | 原版行为 | 当前行为 | 风险 |
| --- | --- | --- | --- |
| `StartCapture` 返回时机 | 写入命令后同步等待 `CAPTURE_STARTED`，确认后才返回 `None` 并置 `capturing=true` | 先置 `_capturing=true`、发送数据后立即启动异步读取并返回 `None`，`CAPTURE_STARTED` 在后台处理 | 调用者会误以为硬件已启动；失败只能通过后续事件体现 |
| 串口文本和二进制流分离 | `StreamReader` 读文本，`BinaryReader` 读同一 BaseStream，C# 控制读序 | Node 中 `_serialPort.pipe(_lineParser)` 后又对 `_currentStream.on('data')` 读二进制 | `ReadlineParser` 可能消费采集二进制数据，导致二进制帧错位 |
| 非网络电压状态 | 原版非网络设备返回 `UNSUPPORTED` | 当前串口设备返回模拟 `3.3V` | UI/测试会误判串口设备支持电压监控 |
| `StopCapture` 空闲语义 | 原版未采集时返回 `false` | 当前未采集时返回 `true` | 与原版 API 语义不一致，影响上层状态判断 |
| Blast 参数校验 | 原版要求 `PreTriggerSamples == 0`、`Frequency == BlastFrequency`、`LoopCount == 0` | 当前按普通频率/样本范围放宽，允许 loopCount 0-255 | 会向固件发送原版不接受的 blast 配置 |
| `getLimits` 计算 | 原版 `MaxPostSamples = totalSamples - 2` | `LogicAnalyzerDriver` override 使用 `totalSamples - maxPreSamples - 10` | 当前会错误拒绝原版允许的采样配置 |
| 网络配置编码 | 原版 `Encoding.ASCII` 写固定数组 | 当前 `TextEncoder` UTF-8 | 非 ASCII SSID/密码/IP 文本会改变固定字段字节布局 |
| Blink/StopBlink | 原版支持命令 `5` / `6` | 当前缺失 | 无法复刻原版设备识别/闪灯功能 |
| 超时清理 | 原版同步读设置 ReadTimeout | 当前若读取成功，部分 `setTimeout` 未清除 | 长时间运行可能积累定时器或产生迟到 reject |

### 5.3 结构体兼容风险

`CaptureRequest` 在当前 `AnalyzerDriverBase.ts` 中使用 24 字节 `channels`。这是对 C# `SizeConst = 24` 的合理匹配。但需要注意：

- C# `ComposeRequest` 中曾写 `new byte[32]`，但结构体 Marshal 按 `SizeConst=24` 发送；当前应以 24 字节为准。
- `CaptureRequest.fromConfiguration()` 当前把通道位置写成 `1`，而原版 `ComposeRequest()` 写入的是实际 `ChannelNumber` 列表。虽然该静态方法未必在主链路使用，但一旦被调用，会生成与固件期望不同的请求。
- 当前同时存在 `src/models/CaptureModels.ts` 和 `src/drivers/AnalyzerDriverBase.ts` 两套 OutputPacket/CaptureRequest 相关定义，后续维护容易产生分叉。

## 6. 设备发现与连接管理差距

### 6.1 原版设备发现

原版 `DeviceDetector` 针对 Pico LogicAnalyzer 的 VID/PID `1209/3020`：

- Windows：读取 `usbser` 和 USB 枚举注册表，匹配 ParentId、序列号、COM 口。
- Linux：读取 `/sys/bus/usb/devices`，匹配 `idVendor/idProduct`、serial、tty。
- 结果包含 `VID/PID/ParentId/DevicePath/PortName/SerialNumber/AssignedIndex`，用于后续多设备排序和已知设备管理。

### 6.2 当前差异

| 差异点 | 当前状态 | 影响 |
| --- | --- | --- |
| Pico VID/PID | `SerialDetector` 主要匹配 Raspberry Pi Pico `2E8A/0003` 或 manufacturer 包含 Pico | 可能漏掉原版 LogicAnalyzer 设备，或误识别普通 Pico |
| Windows/Linux 精准枚举 | 未实现原版注册表/sysfs 级别逻辑 | 多设备序列号、ParentId、稳定排序能力不足 |
| 网络扫描端口 | `NetworkDetector` 扫描 24000/5555/8080/10000；扩展配置里默认 4045/80/8080/8000/3000 | 与原版网络地址/端口使用习惯不一致，配置和检测服务也不统一 |
| Saleae 检测 | 只要 localhost:10429 开放就模拟一个设备 | 不是可靠设备枚举 |
| Rigol/Siglent 检测 | 扫固定 IP 段并发 `*IDN?` | 可能适合仪器，但不是原版功能 parity |
| 检测缓存 | 30 秒缓存，不区分设备热插拔事件 | 设备插拔后可能显示旧结果 |

结论：当前设备检测更“泛化”，但对原版 Pico LogicAnalyzer 的精准度和多设备场景反而不足。

## 7. 多设备级联差距

原版 `MultiAnalyzerDriver` 支持 2-5 台设备级联，核心行为包括：

- 第一个连接字符串必须是主设备。
- 所有设备版本 major/minor 必须一致。
- 不支持 Edge 触发，使用 Pattern/Fast/Complex 同步。
- 从设备先启动，触发通道设为 24 的外部触发，主设备最后启动。
- 采集完成后按设备 Tag 合并回源会话通道。

当前 `MultiAnalyzerDriver.ts` 有移植框架，但存在关键问题：

| 差异点 | 当前表现 | 风险 |
| --- | --- | --- |
| 构造初始化 | 构造函数调用 async `initializeDevices()` 但不 await | 构造后立即使用可能处于半初始化状态 |
| 设备 Tag 传递 | 给 `LogicAnalyzerDriver.tag` 赋值，但完成回调里读取 `args.session.deviceTag` | 完成事件无法正确识别设备索引，可能全部写到设备 0 |
| 会话克隆 | `createSlaveSession()` / `createMasterSession()` 构造普通对象，不是完整 `CaptureSession` 实例 | `clone()`、类型方法、字段一致性存在风险 |
| 参数校验 | 未完整复刻 `TriggerChannel + TriggerBitCount` 对 Fast/Complex 的差异限制 | 可能接受原版会拒绝的非法配置 |
| StopCapture 语义 | 未采集时返回 `true` | 与原版返回 `false` 不一致 |
| 多设备 UI | 原版有 `MultiConnectDialog` / `MultiComposeDialog` | 当前 VSCode 命令和新前端没有完整多设备连接配置体验 |

多设备能力目前应视为“原型”，不能认为已达到原版 120 通道级联可用状态。

## 8. `.lac` 文件兼容差距

### 8.1 原版格式

原版保存逻辑写入：

```json
{
  "Settings": {
    "Frequency": 1000000,
    "PreTriggerSamples": 100,
    "PostTriggerSamples": 1000,
    "LoopCount": 0,
    "MeasureBursts": false,
    "CaptureChannels": []
  },
  "Samples": null,
  "SelectedRegions": []
}
```

实际 JSON 属性名由 Newtonsoft.Json 默认 C# 属性名决定，关键字段是 PascalCase：`Settings`、`Samples`、`SelectedRegions`、`CaptureChannels`、`ChannelNumber`、`Samples` 等。

### 8.2 当前兼容性风险

| 差异点 | 当前项目 | 风险 |
| --- | --- | --- |
| 多套 `.lac` 模型 | `LACFileFormat.ts` 使用 `Settings`，`DataExportService.ts` 的 `ExportedCapture` 使用 `settings` / `selectedRegions` | 不同导出入口生成互不兼容格式 |
| 自定义编辑器解析 | `LACEditorProvider.parseLACFile()` 只是 `JSON.parse` | 没有统一调用 `LACFileFormat.load/convertToCaptureSession` 做兼容转换 |
| 新前端解析 | `sessionStore` 只读 `Settings` 或 `captureSession`，不完整恢复通道样本和区域 | 只能得到摘要，不能完整渲染/编辑原版捕获 |
| Samples 编码 | `LACFileFormat` 将 UInt128 存为 32 位十六进制字符串 | Newtonsoft.Json 对 `UInt128[]` 的默认表示需用真实原版样本文件验证，不能只靠假设 |
| 导出按钮 | `LACEditorProvider.exportData()` 仍是 TODO，只显示导出成功消息 | Webview 中实际文件导出未闭环 |
| CSV 导出样本读取 | `DataExportService.exportToCSV()` 按 bit-packed 方式读 `channel.samples[byteIndex] & bit` | 原版 `AnalyzerChannel.Samples` 是每个样本一个 byte 的 0/1 数组；当前会错误导出通道数据 |
| openAnalyzer 新建文件 | 默认 `includeRawSamples=false`，只写 settings | 能打开界面，但不是一次真实捕获文件 |

结论：当前 `.lac` 兼容还不能声称 100%。必须用原版真实 `.lac` 样本做往返测试：原版保存 -> 当前打开 -> 当前保存 -> 原版打开；当前采集 -> 原版打开；旧版含 `Samples` 的文件 -> 当前恢复通道样本。

## 9. 前端 UI 与交互差距

### 9.1 原版 GUI 已闭环的能力

原版 `MainWindow.axaml` 和相关控件形成完整逻辑分析器工作台：

- 顶部设备栏：刷新、端口选择、打开/关闭设备、当前设备、信息、bootloader、忘记设备。
- 采集按钮：Capture、Repeat last capture、Abort。
- 主显示：ChannelViewer、SampleViewer、SamplePreviewer、SampleMarker、AnnotationViewer。
- 右侧：SigrokDecoderManager、Samples in screen 滑块、采集信息、电源状态。
- 菜单：New/Open/Save/Export、Network settings、Help/About。

### 9.2 当前新前端状态

当前 `src/webview/App.vue` 已改为只渲染 `src/frontend/app/App.vue`。新前端的现状：

- `AppHeader` / `AnalyzerLayout` / 左右侧栏 / 状态栏有基础布局。
- `AppWaveformStage.vue` 明确写着“通道装载与复杂交互会在后续任务继续接回”。
- `AppSidebarLeft.vue` 明确写着“仅保留布局与状态摘要，不直接挂接旧设备管理器”。
- `AppSidebarRight.vue` 明确写着“后续任务再接入真实解码工作流”。
- `sessionStore` 只提取文件名、采样率、总样本数、是否有数据。

### 9.3 旧 Webview 组件未形成当前产品闭环

`src/webview/components` 里仍保留 `DeviceManager.vue`、`DecoderPanel.vue`、`DataExporter.vue`、`PerformanceAnalyzer.vue` 等大型组件，但这些组件当前不是新入口的主流程，并且内部有大量模拟逻辑：

- `DeviceManager.vue` 扫描设备是模拟列表，连接/断开也是 `setTimeout` 模拟。
- `DataExporter.vue` 多个导出函数返回“功能开发中”。
- `PerformanceAnalyzer.vue`、`DecoderStatusMonitor.vue` 使用模拟性能和状态数据。
- `LACEditorProvider.exportData()` 仍 TODO。

结论：当前前端处在迁移中间态，视觉布局和底层引擎代码不等于可用产品功能。与原版相比，最大差距是“用户操作链路没有接回真实数据和服务”。

## 10. 波形渲染、导航、标记、测量差距

### 10.1 原版能力

原版通过 `SampleViewer`、`SamplePreviewer`、`SampleMarker`、`AnnotationViewer` 提供：

- 波形绘制、通道背景、触发线、用户 marker、burst marker。
- 鼠标滚轮缩放和水平滚动。
- 全局预览图。
- 区域创建/删除、区域命名和颜色。
- 样本选择、剪切、复制、粘贴、插入、删除、移位。
- 测量选中样本范围。
- 解码注释和波形同步显示。

### 10.2 当前状态

当前渲染能力分散在两套位置：

- `src/frontend/core/engines/WaveformRenderer.ts`：新前端使用的渲染器，有接口和基础绘制逻辑。
- `src/webview/engines/*`：旧版增强渲染、标记、测量、虚拟化、交互引擎。

差距点：

| 功能 | 当前状态 | 差距 |
| --- | --- | --- |
| 真实通道装载 | 新前端未把 `.lac` 样本转为 `AnalyzerChannel[]` 并喂给 renderer | 无法等价显示真实捕获 |
| 波形缩放 | 有 `useWaveformViewport` / store 雏形 | 未达到原版滑块、滚轮、预览图联动 |
| 区域 | 旧 renderer 有 region 接口 | 新前端无完整创建/删除/保存/恢复 UI |
| marker | 旧 renderer 有 userMarker | 新前端无完整用户 marker 工作流 |
| 样本编辑 | 原版 SampleMarker 有完整事件 | 当前缺少剪切/复制/粘贴/插入/删除/移位闭环 |
| 测量 | `MeasurementTools.ts` 存在 | 新前端和命令链路未完整挂接 |
| 注释显示 | `AnnotationRenderer.ts` 存在，DecoderPanel 也有 UI | 新前端未形成解码结果 -> 注释层 -> 波形联动 |
| 性能目标 | 代码里有虚拟化/优化类 | 缺少真实百万样本交互基准证据 |

## 11. 采集配置与触发功能差距

### 11.1 原版采集对话框能力

原版 `CaptureDialog` 支持：

- 依据设备能力设置频率最小/最大值。
- 频率 jitter 估算和低/中/高颜色提示。
- 8/16/24 通道自动模式。
- 多通道选择、全选/全不选/反选。
- 通道名称直接录入并跨采集保留。
- Edge / Complex / Fast / Blast 触发。
- Multi / Emulated 模式特殊 UI。
- 采集设置持久化。

### 11.2 当前差距

| 功能 | 当前状态 | 缺口 |
| --- | --- | --- |
| 图形采集配置 | `extension.ts` 中用命令交互生成简化配置 | 没有原版完整采集对话框 |
| jitter 计算 | `TriggerProcessor` 有一些逻辑，但 UI 未接回 | 用户无法看到频率误差提示 |
| 通道选择 | 新前端无真实通道选择控件 | 不能等价配置 24/120 通道 |
| 触发配置 | 有模型和驱动参数，但 UI 简化 | Complex/Fast/Blast 的配置体验缺失 |
| 设置持久化 | 有 `ConfigurationManager`、`SessionManager`，但部分模拟 | 未复刻原版按设备/驱动保存采集设置的闭环 |
| Repeat last capture | 原版按钮和菜单支持 | 当前命令未提供等价能力 |
| Abort | VSCode progress cancellation 调用 stopCapture | UI 入口和状态一致性未完整复刻 |

## 12. 协议解码器差距

### 12.1 数量和生态差距

原版 `Software/decoders` 下有 132 个解码器目录，包括 `i2c`、`spi`、`uart`、`can`、`lin`、`usb_packet`、`usb_power_delivery`、`sdcard_spi`、`spiflash`、`i2s`、`jtag`、`swd`、`modbus` 等。

当前 `src/decoders/protocols` 只有：

- `I2CDecoder.ts`
- `SPIDecoder.ts`
- `UARTDecoder.ts`
- `StreamingI2CDecoder.ts`

覆盖率按目录数粗略计算：常规协议 3 / 132，约 2.3%；加上流式 I2C 也不能改变生态差距。

### 12.2 架构能力差距

| 原版能力 | 当前状态 | 差距 |
| --- | --- | --- |
| 动态扫描 decoder 目录 | 原版运行时扫描 `decoders/` 的 `pd.py` | 当前固定 require/register TS 类 |
| Python sigrok API | 原版通过 pythonnet + `sigrokdecode.py` 运行原始解码器 | 当前要求纯 TypeScript 重写 |
| 解码器元数据 | 原版读取 Python 类的 id/name/options/channels/annotations | 当前 TS 类手写元数据 |
| 解码树级联 | 原版 `SigrokProvider` 支持 branch children、input/output merge | 当前有 `DecodingTree` 概念，但缺少大量协议输出类型和真实级联用例 |
| 解码器管理 UI | 原版 SigrokDecoderManager 可管理解码树、配置选项、重复分析 | 当前新前端未接回；旧 DecoderPanel 不在主入口 |
| 结果渲染 | 原版 AnnotationViewer 与 SampleViewer 同步 | 当前缺少完整结果到波形注释层的主链路 |

### 12.3 协议功能差距重点

| 协议/类别 | 原版 | 当前 | 影响 |
| --- | --- | --- | --- |
| CAN/LIN/汽车总线 | 有 sigrok 解码器 | 当前无 TS 实现 | 工业/汽车场景缺失 |
| USB | `usb_packet`、`usb_request`、`usb_signalling`、`usb_power_delivery` | 当前无 | USB 调试场景缺失 |
| 存储协议 | `sdcard_spi`、`spiflash`、`eeprom*` | 当前无 | 嵌入式存储分析缺失 |
| 调试协议 | `jtag`、`swd`、`arm_*` | 当前无 | MCU 调试接口分析缺失 |
| 音频/显示 | `i2s`、`spdif`、`rgb_led_*`、`seven_segment` 等 | 当前无 | 常见外设协议缺失 |
| 射频/传感器 | `nrf24l01`、`cc1101`、`lm75`、`adxl345` 等 | 当前无 | 传感器/RF 场景缺失 |
| 基础三件套 | I2C/SPI/UART | 有 TS 实现 | 仍需用 sigrok 真实样本做一致性验证 |

## 13. 数据导出差距

原版 GUI 导出主要是 CSV，保存为 `.lac`；TerminalCapture/CLCapture 也支持保存 LAC/CSV。

当前 `DataExportService` 宣称支持 `lac/csv/json/vcd/txt/html/md/pdf/zip/project`，但差距如下：

- `LAC` 导出使用 lowercase `settings`，与原版 `Settings` 不兼容。
- `CSV` 读取通道样本方式疑似错误：按 bit-packed 读，而通道样本实际是 0/1 byte 数组。
- `PDF` 是 placeholder `%PDF-1.4...`，明确“尚未完全实现”。
- `HTML` 报告中的图表是 placeholder。
- `LACEditorProvider.exportData()` 未调用 `DataExportService`，仍是 TODO。
- `DataExporter.vue` 多个导出入口返回“功能开发中”。

结论：当前导出服务的格式广度超过原版，但可靠度和主链路接入度明显不足。

## 14. CLI/TUI 工具差距

原版有两个重要非 GUI 工具：

| 工具 | 原版能力 | 当前状态 |
| --- | --- | --- |
| `CLCapture` | 命令行指定设备、频率、样本、通道、触发，输出 `.csv` / `.lac` | 当前无等价用户 CLI |
| `TerminalCapture` | 终端菜单、设备信息、配置向导、保存 `.tcs`、保存 LAC/CSV | 当前无等价 TUI |

当前 `scripts/` 主要是开发和数据库脚本，如 `manage-database.ts`、`test-drivers.ts`、`build-release.ts`，不是用户采集工具。

影响：

- 无法在 CI、脚本、远程终端里替代原版采集工具。
- 无法复用原版 `.tcs` 采集设置流。
- 无法提供没有 VSCode GUI 环境时的采集方案。

## 15. 信号描述语言和样本生成差距

原版包含 `SignalDescriptionLanguage` 和 `SignalComposerDialog`：

- 可用 DSL 描述信号。
- 可从零创建 capture 文件。
- 有语法高亮相关 `Xshd.cs`。
- 可辅助生成测试波形和教学样本。

当前项目没有等价 DSL 解析器和信号生成 UI。虽然有测试 fixtures 和模拟通道数据，但这不是用户可用的信号生成能力。

这会影响：

- 无硬件时创建可视化样本。
- 构造协议解码器测试数据。
- 复刻原版“New/Create samples”工作流。

## 16. 应用设置和已知设备差距

原版有：

- `AppSettingsManager`：按平台写入 `%APPDATA%` 或 `~/.config`。
- `KnownDevice`：记住设备，支持 forget。
- 窗口尺寸/位置持久化。
- 采集设置按驱动类型保存。

当前项目有：

- VSCode configuration：`logicAnalyzer.*`。
- `ConfigurationManager`、`SessionManager`、`WorkspaceManager` 等服务。
- 但 `WorkspaceManager`、`SessionManager` 中存在“模拟实现”注释。
- 新前端没有完整的 known device / forget device 工作流。

差距主要不是“没有配置系统”，而是配置系统与原版用户工作流没有一一对应。

## 17. 网络/WiFi 差距

原版网络功能主要面向 Pico W / 网络版 LogicAnalyzer：

- 网络连接字符串 `IP:Port`。
- 串口设备可发送 WiFi 网络配置。
- 网络设备可查询电源/电压状态。
- GUI 有 Network settings 菜单。

当前项目有更多网络相关服务：

- `WiFiDeviceDiscovery`
- `NetworkStabilityService`
- `NetworkLogicAnalyzerDriver`
- 网络扫描、诊断、自动重连配置项

但存在差距：

- 端口配置与检测器硬编码端口不统一。
- `NetworkLogicAnalyzerDriver` 是通用 JSON/TCP/UDP/HTTP/WebSocket 协议，不等同原版 Pico 网络协议。
- `LogicAnalyzerDriver.getVoltageStatus()` 对串口返回模拟电压，与原版不一致。
- Webview 中网络设备连接需要走 hostCommand，前端真实入口尚未完整产品化。

## 18. 驱动 SDK 与多硬件生态差距

当前项目有原版没有的大量内容：

- `driver-sdk/templates`
- `driver-sdk/tools`
- `driver-sdk/testing`
- `drivers/standards/HardwareDescriptorStandard.ts`
- `database/HardwareCompatibilityDatabase.ts`
- Saleae/Rigol/Siglent/sigrok/Network 通用驱动

这些是当前项目的战略扩展，但不是原版 parity。主要问题：

- 多数模板和示例包含 TODO 或模拟逻辑。
- Saleae 检测/查询实现假设较多，未证明兼容 Saleae Logic 2 实际 API。
- Rigol/Siglent SCPI 命令对不同型号差异非常大，当前更像通用框架。
- sigrok 适配依赖外部 `sigrok-cli`，且采集结果格式转换需要大量实际设备验证。
- 当前多硬件抽象会扩大测试矩阵，反而可能拖慢 Pico 原版兼容。

建议把这些能力标为“扩展路线”，不要算作原版功能已完成。

## 19. 测试、CI、质量门禁差距

### 19.1 当前质量风险

| 项目 | 当前状态 | 风险 |
| --- | --- | --- |
| TypeScript strict | `tsconfig.json` 中 `strict=false`、`noImplicitAny=false`、`strictNullChecks=false` | 与项目约束“严格模式”冲突，类型安全不足 |
| Jest diagnostics | `jest.webview.config.js` 中 `diagnostics=false`、`isolatedModules=true` | 测试可能绕过类型错误 |
| CI workflow | `.github/workflows/*.yml` 当前在 git 状态中为删除 | 自动质量门禁缺失 |
| Husky pre-commit | `.husky/pre-commit` 当前删除 | 本地提交门禁缺失 |
| 测试数据 | 大量测试使用 mock/模拟数据 | 不能证明真实硬件、真实 `.lac`、真实解码器一致性 |
| 性能报告 | 有 performance/stress 目录和报告 | 需要确认是否可重复运行，而非历史生成物 |

### 19.2 原版兼容必须补的测试

当前最缺的不是更多单元测试，而是跨实现兼容测试：

- `OutputPacket` 与 C# fixture 字节级一致测试。
- `CaptureRequest` 对 Edge/Blast/Fast/Complex 的字节级 fixture。
- 真实串口采集的 `CAPTURE_STARTED + binary` 流读取测试。
- 原版 `.lac` 样本文件打开/保存/再打开测试。
- 原版 132 个 sigrok 解码器中高优先级协议的 golden output 对比。
- 多设备 2/3/5 台同步合并测试。
- Pico W 网络配置和电压状态测试。

## 20. 文档和用户体验差距

当前项目已有大量中文文档，包括 `docs/功能对比分析`、开发指南、用户手册、网络功能文档等。但存在几个问题：

- 文档中“已支持”的描述与代码里的 TODO/模拟实现不总是一致。
- 有多套对比文档，缺少一个最新状态的权威差距清单。
- README 仍包含模板链接如 `github.com/your-repo/vscode-logicanalyzer`。
- package 元数据、发布链接、技术支持地址多处仍是占位。
- 用户手册需要区分“当前可用”“实验性”“规划中”。

这会导致项目状态被高估，后续排期失真。

## 21. 缺失与差异清单

### 21.1 P0：阻断原版替代的差距

- Pico 串口二进制读取与 `ReadlineParser` 共用流的风险未解决。
- `StartCapture` 返回语义与原版不同。
- Blast 触发参数校验与原版不同。
- `getLimits` 覆盖实现与原版不同。
- 串口电压状态返回模拟值。
- `.lac` 导出大小写和样本编码不统一。
- 新前端未接入真实通道样本渲染。
- Webview 导出仍 TODO。
- 采集配置 UI 不完整。
- I2C/SPI/UART 之外的协议解码器缺失。
- 多设备完成事件索引错误，无法可靠合并。
- 设备发现不按原版 VID/PID 1209/3020 精准识别。

### 21.2 P1：影响专业使用的差距

- 区域创建、删除、保存、恢复未完整接回。
- 样本剪切/复制/粘贴/插入/删除/移位缺失。
- SamplePreviewer 等全局导航缺失。
- AnnotationViewer 与解码结果未完整联动。
- Repeat last capture 缺失。
- Known device / forget device 缺失。
- Bootloader UI 和 blink 识别能力不完整。
- SignalDescriptionLanguage 缺失。
- TerminalCapture / CLCapture 缺失。
- 原版采集设置持久化方式未复刻。
- 解码树级联能力没有真实协议验证。

### 21.3 P2：产品化和生态差距

- 固件/硬件/外壳资产不在当前项目维护。
- VSIX 发布之外没有 all-in-one 包。
- CI、pre-commit、release checklist 当前状态不完整。
- TypeScript strict 关闭。
- 多硬件驱动缺少真实设备认证矩阵。
- 文档中占位链接和功能状态需要清理。
- 性能指标需要可重复 benchmark 支撑。

## 22. 推荐路线图

### 阶段 A：先恢复 Pico 原版核心闭环

目标：当前扩展可以稳定替代原版 GUI 的最小核心流程。

必须完成：

- 修正 Pico 驱动协议语义：`StartCapture`、`StopCapture`、Blast 校验、`getLimits`、串口电压、blink。
- 重构串口读取：文本握手和二进制采集必须有明确状态机，避免 `ReadlineParser` 消费二进制数据。
- 建立 C# fixture 字节级兼容测试。
- 统一 `.lac` 模型，只保留一个权威读写入口。
- 新前端接入真实 `.lac` 通道数据并渲染波形。
- Webview 保存/导出接入真实服务。
- 采集配置 UI 覆盖 Edge/Fast/Complex/Blast 和通道选择。

### 阶段 B：补齐原版 UI 工作流

目标：用户能完成查看、导航、编辑、测量、区域、解码。

必须完成：

- 恢复 SamplePreviewer / SampleMarker / AnnotationViewer 等价功能。
- 实现样本选择和编辑操作。
- 实现区域持久化和 UI 管理。
- 实现测量工具和 marker。
- 接回 DecoderPanel 到新前端。
- I2C/SPI/UART 与真实 sigrok 输出做 golden 对比。

### 阶段 C：扩大协议和工具覆盖

目标：缩小专业协议和自动化能力差距。

优先实现：

- CAN、LIN、I2S、1-Wire、JTAG/SWD、USB packet、SPI flash、SD card。
- 解码树级联和协议输出输入桥接。
- CLI 采集工具，至少覆盖原版 CLCapture。
- Terminal/TUI 可作为后续，优先级低于 CLI。
- SignalDescriptionLanguage 或兼容替代 DSL。

### 阶段 D：再推进多硬件生态

目标：把当前额外扩展从“框架”变成可认证能力。

必须建立：

- 每个驱动的真实设备认证文档。
- 采集格式到统一 `CaptureSession` 的 golden 测试。
- 错误恢复、断线重连、性能上限测试。
- 明确哪些硬件是“官方支持”，哪些是“实验性支持”。

## 23. 验收清单

### 23.1 原版 Pico 兼容验收

- [ ] 用 C# 原版生成 Edge/Fast/Complex/Blast 请求 fixture，TS 输出逐字节一致。
- [ ] 串口真实设备采集 8/16/24 通道均可完成。
- [ ] 网络真实设备采集可完成。
- [ ] Stop/Abort 后可重新连接并再次采集。
- [ ] Bootloader、NetworkConfig、Voltage、Blink 行为与原版一致。
- [ ] 2 台多设备同步采集通过，后续扩展到 5 台。

### 23.2 `.lac` 兼容验收

- [ ] 原版保存 `.lac`，当前扩展可打开并显示完整通道样本。
- [ ] 当前扩展保存 `.lac`，原版可打开。
- [ ] `SelectedRegions` 往返不丢失。
- [ ] 含旧版 `Samples` 的文件可恢复通道样本。
- [ ] CSV 导出与原版同一 capture 的样本值一致。

### 23.3 前端功能验收

- [ ] 新前端可以完成设备连接、采集配置、开始采集、停止采集。
- [ ] 波形可缩放、滚动、跳转触发位置。
- [ ] 区域、marker、测量、样本编辑功能可用。
- [ ] 解码结果可显示在注释轨道，并跟随波形视口。
- [ ] 大样本文件打开和滚动有性能基准。

### 23.4 解码器验收

- [ ] I2C/SPI/UART 与 sigrok 输出对齐。
- [ ] 解码器选项、通道映射和 annotation rows 可在 UI 中配置。
- [ ] 解码树父子级联可用。
- [ ] 新增协议按 golden 数据测试通过。

### 23.5 质量验收

- [ ] `strict=true` 恢复。
- [ ] CI workflow 恢复。
- [ ] pre-commit 或等价质量门禁恢复。
- [ ] 单元、集成、真实 fixture、性能测试可重复运行。
- [ ] 文档明确标注已实现、实验性、规划中。

## 24. 最终判断

当前项目已经具备“重建一个现代 VSCode 逻辑分析器平台”的基础代码量和模块雏形，但与 `logicanalyzer` 原版相比，仍处在“架构扩展多、核心闭环弱”的阶段。

如果目标是“替代原版桌面 LogicAnalyzer”，优先级必须回到 Pico 协议、`.lac`、波形 UI、采集配置、解码注释这条主链路。  
如果目标是“超越原版成为多硬件平台”，也应先把原版主链路做成可验证基线，否则 Saleae/Rigol/sigrok 等扩展会建立在未稳定的数据模型和 UI 工作流之上，后续维护成本会快速上升。

