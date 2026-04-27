# 2026-04-28 并行 Worktree 对齐计划

## 目标

把下一阶段 `logicanalyzer` 原版 parity 和 VSCode 扩展工程收口拆成 10 个可并行推进的大任务。每个任务对应一个独立 worktree，目录固定为项目根目录下 `.worktree/01` 到 `.worktree/10`，分支使用 `parallel/NN-*` 命名。

## 当前基线

- 主仓库：`/home/share/samba/vscode-extension/pico-logicanalyzer`
- 当前分支：`master`
- 本地状态：`master` 相对 `origin/master` 超前 27、落后 1；存在未跟踪原版参考目录 `logicanalyzer/`。
- 本次验证：
  - `npm run typecheck`：通过。
  - `npm run typecheck:strict`：通过。
  - `npm run test:webview:unit -- --runInBand`：通过，2 个测试套件、37 个测试。
  - `npm run build:production`：通过，有 webpack 体积警告。
  - `npm run test:unit -- --silent`：仍需拆分定位长耗时或开放句柄。
- 明确限制：`logicanalyzer/` 是未跟踪原版参考项目，不能误提交；`.worktree/` 已在 `.gitignore` 中。

## 拆分原则

1. 每个 worktree 是一个“大能力包”，不是一个小修小补分支；目标是交付一个可独立验收的子系统阶段成果。
2. 每个 worktree 内部可以拆多次提交，但不要再拆成更多 worktree，避免切换和合并成本吞掉开发效率。
3. 每个 worktree 拥有清晰代码边界，尽量减少跨任务改同一文件；确实需要共用接口时，先在对应文档里写清接口契约。
4. 优先拆出协议/格式 fixture、前端工作流、硬件认证、发布质量等低依赖方向；合并前再做一次总体验证。
5. 每个任务必须同时包含代码、测试、文档和验收记录；不得把“验证和文档”留到最后才补。
6. 所有 Markdown 文档继续使用中文。

## 每个 Worktree 的统一执行要求

每个 worktree 负责人在开始编码前，先在自己的分支里补一份中文执行记录，建议路径为 `docs/worktrees/NN-主题.md`。记录至少包含：

- 当前基线：从本计划复制相关目标，并记录启动时的 `git status --short --branch`。
- 范围内：本 worktree 要负责的源码、测试、文档和 fixture。
- 范围外：明确不碰的模块，避免和其他 worktree 交叉。
- 接口契约：需要其他 worktree 使用的类型、命令、消息、fixture 或文档格式。
- 执行日志：按阶段记录关键提交、验证命令和失败处理。
- 验收结论：列出通过的命令、仍有的限制、需要后续合并协调的点。

每个 worktree 的最小完成标准：

- 至少一个有意义的源码或测试能力闭环，不能只改文档。
- 新增或更新对应单元/集成测试；真实硬件无法自动化时，要有可复现手动记录模板。
- 更新功能状态矩阵、用户/开发文档或对应专题文档，避免状态再次漂移。
- 提交前运行该 worktree 自己列出的验证命令，并记录结果。

## 10 个并行 Worktree

| 目录 | 分支 | 主题 | 主要边界 | 首要验收 |
| --- | --- | --- | --- | --- |
| `.worktree/01` | `parallel/01-pico-driver-parity` | Pico 驱动与原版协议对齐 | `src/drivers/LogicAnalyzerDriver.ts`、`AnalyzerDriverBase.ts`、driver 测试 | Pico 串口/网络命令、启动确认、停止、blast、blink、limit 均有 fixture 覆盖 |
| `.worktree/02` | `parallel/02-lac-format-golden` | `.lac` 原版兼容和导出闭环 | `src/models/LACFileFormat.ts`、`DataExportService.ts`、`.lac` fixtures、模型测试 | 原版样本打开、保存、CSV/JSON/VCD 导出和往返测试可复现 |
| `.worktree/03` | `parallel/03-frontend-waveform-workflow` | 新 Vue3 前端真实波形工作流 | `src/frontend/app`、`src/frontend/core/stores`、`WaveformRenderer.ts`、webview 测试 | 打开含样本 `.lac` 后可渲染、缩放、平移、选择并保持状态 |
| `.worktree/04` | `parallel/04-device-capture-ui` | 设备连接和采集 UI 接回真实 host 命令 | `AppHeader.vue`、`AppSidebarLeft.vue`、host bridge、`LACEditorProvider.ts` | 连接、配置、开始采集、重复采集、停止采集在 Webview 中有真实命令链路和错误反馈 |
| `.worktree/05` | `parallel/05-decoder-sigrok-parity` | 解码器与 sigrok golden 对齐 | `src/decoders`、decoder fixtures、decoder 测试 | I2C/SPI/UART 与 sigrok golden 对齐，并补 CAN/LIN/I2S/USB 优先级方案 |
| `.worktree/06` | `parallel/06-markers-measure-editing` | 区域、marker、测量和样本编辑 | `waveformStore.ts`、`AppWaveformStage.vue`、旧 `src/webview/engines` 迁移点 | 选择、区域、marker、频率/占空比/脉宽、复制剪切粘贴删除均有测试 |
| `.worktree/07` | `parallel/07-device-discovery-certification` | 设备发现和硬件认证矩阵 | `HardwareDriverManager.ts`、网络/WiFi 服务、`docs/真实硬件认证矩阵.md` | Pico VID/PID、网络端口、Saleae/sigrok/SCPI 检测口径统一并有认证记录模板 |
| `.worktree/08` | `parallel/08-cli-tui-capture` | CLI/TUI 采集工具 parity | `src/cli`、`package.json` bin、用户手册 CLI 章节 | `logic-analyzer-capture` 可真实/模拟采集输出 lac/csv/json，具备批处理和错误码 |
| `.worktree/09` | `parallel/09-sdl-synthetic-capture` | 信号描述语言和合成捕获 | `SignalDescriptionLanguage.ts`、synthetic capture command、DSL 测试 | DSL 解析、诊断、样本生成、命令入口和示例文件闭环 |
| `.worktree/10` | `parallel/10-quality-release-docs` | 质量门禁、CI、发布和文档收敛 | `.github/workflows`、`scripts`、README、CHANGELOG、RELEASE_NOTES、docs 索引 | 本地/CI 验证命令统一，旧文档标注历史状态，发布门槛一页式可执行 |

## 任务详情

下面每个任务都按“大包”设计。一个 worktree 应该完整推进本节列出的多个阶段，而不是只挑其中一个小点。

### 01 Pico 驱动与原版协议对齐

- 目标：把 Pico 串口和 TCP 驱动行为对齐原版 C# `SharedDriver`，优先解决真实采集可靠性。
- 范围内：
  - Pico 串口/TCP 初始化、采集启动、采集停止、blast、blink、限制计算、错误恢复。
  - 协议级 mock stream、二进制帧回放、真实硬件验证记录。
- 范围外：
  - 不改前端设备面板，前端链路归 04。
  - 不扩展 Saleae/Rigol/Siglent/sigrok，硬件生态归 07。
- 建议文件：
  - `src/drivers/LogicAnalyzerDriver.ts`
  - `src/drivers/AnalyzerDriverBase.ts`
  - `src/drivers/VersionValidator.ts`
  - `tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts`
  - `tests/fixtures/drivers/`
- 子任务：
  - 对照原版 `logicanalyzer/Software/LogicAnalyzer/SharedDriver` 梳理命令码、结构体布局、返回文本、超时语义。
  - 补齐 `CAPTURE_STARTED`、二进制流读取、超时清理、串口文本解析暂停/恢复的 fixture。
  - 校准 `getLimits`、blast 参数校验、`StopCapture` 空闲语义、非网络电压状态。
  - 增加 blink/stop blink 命令 parity。
  - 记录真实 Pico / Pico W / Pico 2 验证步骤。
- 分阶段推进：
  - 阶段 1：建立协议 fixture 和原版行为表，不改业务逻辑。
  - 阶段 2：修采集启动/停止和二进制流读取，确保测试能复现旧风险。
  - 阶段 3：修 limits、blast、blink、电压状态和错误恢复。
  - 阶段 4：补真实硬件手动验收文档和限制说明。
- 必须交付：
  - `LogicAnalyzerDriver.pico-parity.test.ts` 中覆盖关键协议行为。
  - `docs/worktrees/01-pico-driver-parity.md` 记录真实硬件或 fixture 验收。
  - 功能矩阵中 Pico 相关状态同步更新。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:drivers -- --runInBand`
  - `npm run test:unit -- tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts --runInBand`
- 合并风险：
  - 可能与 07 同时修改 `HardwareDriverManager.ts` 或设备能力描述；01 只负责 Pico driver 内部语义，设备发现交给 07。

### 02 `.lac` 原版兼容和导出闭环

- 目标：以真实原版 `.lac` 样本为基准，统一 PascalCase/lowercase 兼容、样本编码、区域和导出。
- 范围内：
  - `.lac` 解析、保存、样本编码、区域、CSV/JSON/VCD/LAC 导出、golden fixture。
  - 数据格式文档和兼容性测试。
- 范围外：
  - 不做前端 UI 控件，前端渲染归 03，导出按钮 host 链路归 04。
- 建议文件：
  - `src/models/LACFileFormat.ts`
  - `src/models/CaptureModels.ts`
  - `src/services/DataExportService.ts`
  - `tests/unit/models/LACFileFormat.test.ts`
  - `tests/unit/services/DataExportService.accurate.test.ts`
  - `tests/fixtures/lac/`
- 子任务：
  - 新增原版保存样本、当前项目保存样本和边界样本 fixture。
  - 验证 `Settings`、`Samples`、`SelectedRegions`、`CaptureChannels` 的大小写兼容。
  - 修正 CSV 对每通道 0/1 样本和 packed UInt128 样本的读取语义。
  - 补打开、保存、导出、再打开的往返测试。
- 分阶段推进：
  - 阶段 1：从原版或现有样例整理最小、典型、大样本、区域样本 fixture。
  - 阶段 2：统一解析层，明确 PascalCase 是主格式，lowercase 只做兼容输入。
  - 阶段 3：修导出层，保证 CSV/JSON/VCD/LAC 都从同一 `CaptureSession` 语义生成。
  - 阶段 4：增加往返测试和格式说明文档。
- 必须交付：
  - `tests/fixtures/lac/README.md` 说明 fixture 来源、字段语义和预期。
  - 至少覆盖“原版打开”“当前保存”“导出 CSV”“导出 VCD”“区域恢复”五类测试。
  - `docs/worktrees/02-lac-format-golden.md` 写清仍未验证的真实原版边界。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:unit -- tests/unit/models/LACFileFormat.test.ts --runInBand`
  - `npm run test:unit -- tests/unit/services/DataExportService.accurate.test.ts --runInBand`
- 合并风险：
  - 03/06 会消费 `.lac` 样本和区域数据；02 合并前要把 fixture 和类型契约稳定下来。

### 03 新 Vue3 前端真实波形工作流

- 目标：让新前端从 `.lac` 文档中装载真实通道样本，并提供可验证的波形查看体验。
- 范围内：
  - 文档载入、session store、waveform store、canvas 渲染、视口、缩放、平移、预览条、空/错误状态。
- 范围外：
  - 不做设备连接和采集命令，归 04。
  - 不做复杂编辑和回写，归 06。
- 建议文件：
  - `src/frontend/app/components/AppWaveformStage.vue`
  - `src/frontend/core/stores/sessionStore.ts`
  - `src/frontend/core/stores/waveformStore.ts`
  - `src/frontend/core/engines/WaveformRenderer.ts`
  - `tests/unit/webview/`
- 子任务：
  - 修正 root `Samples`、channel `Samples`、lowercase samples 的统一装载。
  - 补画布 resize、缩放、平移、fit、预览条拖动的测试。
  - 增加空文件、settings-only、samples、invalid 四种状态的 UI 行为。
  - 用 Playwright 或 webview 单元测试截图验证非空渲染。
- 分阶段推进：
  - 阶段 1：用 02 的 fixture 或临时 fixture 建立装载测试。
  - 阶段 2：稳定 store 数据结构，保证 samples、sampleRate、regions、bursts 可重复恢复。
  - 阶段 3：优化 renderer 的非空绘制、resize、DPI、visible range。
  - 阶段 4：补 UI 空状态、错误状态和大样本基本性能验收。
- 必须交付：
  - 打开含样本 `.lac` 时 canvas 非空，且 zoom/pan/fit 不破坏布局。
  - `tests/unit/webview` 增加针对真实样本载入和视口操作的测试。
  - `docs/worktrees/03-frontend-waveform-workflow.md` 记录截图或像素级验收方式。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:webview:unit -- --runInBand`
  - `npm run build:frontend:html`
- 合并风险：
  - 04 会改 host bridge，06 会改同一 waveform store；03 应保持数据装载和基础视口，不提前实现复杂编辑。

### 04 设备连接和采集 UI 接回真实 host 命令

- 目标：把新前端的设备面板、采集配置和状态栏从摘要/提示接到真实 VSCode host 命令。
- 范围内：
  - Webview host message bridge、设备连接、网络扫描、采集配置、开始/停止/重复采集、错误反馈。
- 范围外：
  - 不修 Pico 协议细节，归 01。
  - 不做硬件认证矩阵，归 07。
- 建议文件：
  - `src/frontend/app/components/AppHeader.vue`
  - `src/frontend/app/components/AppSidebarLeft.vue`
  - `src/frontend/platform/host/*`
  - `src/providers/LACEditorProvider.ts`
  - `tests/unit/webview/main.test.ts`
- 子任务：
  - 统一 `connectDevice`、`startCapture`、`repeatCapture`、`stopCapture`、`scanNetworkDevices` 的 request/response。
  - 采集配置表单增加真实校验和错误展示。
  - 采集完成后刷新当前 `.lac` 文档并重新装载 waveform store。
  - 补命令失败、用户取消、未连接设备、参数非法的测试。
- 分阶段推进：
  - 阶段 1：定义 host command request/response 类型，统一 browser/vscode/default host 行为。
  - 阶段 2：接设备连接、扫描和设备状态刷新。
  - 阶段 3：接采集配置、开始、停止、重复采集，采集后刷新文档。
  - 阶段 4：补错误路径、取消路径、无设备路径和 UX 状态。
- 必须交付：
  - 前端所有设备/采集按钮不再只是 prompt 或模拟状态。
  - `LACEditorProvider` host command 结果有稳定类型和测试。
  - `docs/worktrees/04-device-capture-ui.md` 记录消息契约，供后续前端任务复用。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:webview:unit -- --runInBand`
  - `npm run test:extensions -- --runInBand`
- 合并风险：
  - 03 可能同时改 `sessionStore` 装载；04 只负责采集后触发刷新，不改底层样本解析。

### 05 解码器与 sigrok golden 对齐

- 目标：先把现有 I2C/SPI/UART 做 golden 对齐，再建立后续协议扩展顺序。
- 范围内：
  - 解码器核心类型、I2C/SPI/UART golden、解码器管理器、sigrok 输出映射、后续协议计划。
- 范围外：
  - 不做波形 UI 展示，前端解码面板后续可以从本任务输出的解码结果类型消费。
- 建议文件：
  - `src/decoders/protocols/`
  - `src/decoders/DecoderManager.ts`
  - `src/decoders/DecoderRegistry.ts`
  - `tests/unit/decoders/`
  - `tests/fixtures/decoders/`
- 子任务：
  - 为 I2C/SPI/UART 建立 sigrok 风格输入/输出 golden。
  - 补级联解码、错误帧、时序边界、位序和多片选场景。
  - 输出 CAN、LIN、I2S、USB、JTAG/SWD 的优先级和接口设计。
  - 明确哪些协议调用外部 sigrok，哪些协议本地 TypeScript 实现。
- 分阶段推进：
  - 阶段 1：定义 decoder golden fixture 格式，避免每个协议自定义断言。
  - 阶段 2：补 I2C/SPI/UART 当前能力的 golden 回归。
  - 阶段 3：修复与 sigrok 输出不一致的边界行为。
  - 阶段 4：产出下一批协议的实现顺序和最小接口。
- 必须交付：
  - `tests/fixtures/decoders/README.md` 说明 golden 格式。
  - I2C/SPI/UART 每个至少有正常、错误、边界三类 fixture。
  - `docs/worktrees/05-decoder-sigrok-parity.md` 记录协议优先级和外部 sigrok 策略。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:decoders -- --runInBand`
- 合并风险：
  - 02/03 可能新增样本 fixture；05 应只读取 fixture，不修改 `.lac` 格式契约。

### 06 区域、marker、测量和样本编辑

- 目标：把原版 SampleViewer/Marker/Region/Edit 的关键操作迁入新前端工作流。
- 范围内：
  - selection、region、marker、measurement、clipboard、insert/overwrite/delete、持久化设计、性能边界。
- 范围外：
  - 不做基础波形载入，归 03。
  - 不做 `.lac` 底层格式变更，归 02。
- 建议文件：
  - `src/frontend/core/stores/waveformStore.ts`
  - `src/frontend/app/components/AppWaveformStage.vue`
  - `src/webview/engines/MeasurementTools.ts`
  - `src/webview/engines/MarkerTools.ts`
  - `tests/unit/webview/waveform-interactions.test.ts`
- 子任务：
  - 保证选择、区域、marker 的序列化能回写 `.lac`。
  - 补频率、占空比、脉宽、样本数、时间范围测量。
  - 补复制、剪切、粘贴、插入、覆盖、删除和 undo/redo 设计。
  - 对大样本编辑增加性能边界测试。
- 分阶段推进：
  - 阶段 1：稳定 selection/region/marker 数据模型和序列化。
  - 阶段 2：补测量工具，先覆盖数字信号常见指标。
  - 阶段 3：补样本编辑操作，并明确 undo/redo 是否本阶段交付。
  - 阶段 4：把交互状态回写或导出到 `.lac` 的路径写清楚。
- 必须交付：
  - `waveform-interactions.test.ts` 覆盖每类交互的成功和边界情况。
  - UI 上有清晰可操作入口，且状态变化能被 renderer 反映。
  - `docs/worktrees/06-markers-measure-editing.md` 写清与原版菜单/快捷键对应关系。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:webview:unit -- --runInBand`
- 合并风险：
  - 03 会改 `AppWaveformStage.vue` 和 `waveformStore.ts`；06 合并前应基于 03 的最终 store 接口 rebase。

### 07 设备发现和硬件认证矩阵

- 目标：统一 Pico、网络、Saleae、Rigol/Siglent、sigrok 的发现口径和认证记录。
- 范围内：
  - 设备发现、驱动注册、硬件能力描述、认证脚本、认证矩阵、设备数据库校验。
- 范围外：
  - 不改单个 Pico 采集协议，归 01。
  - 不做采集 UI，归 04。
- 建议文件：
  - `src/drivers/HardwareDriverManager.ts`
  - `src/services/WiFiDeviceDiscovery.ts`
  - `src/services/NetworkStabilityService.ts`
  - `src/drivers/SaleaeLogicDriver.ts`
  - `src/drivers/RigolSiglentDriver.ts`
  - `src/drivers/SigrokAdapter.ts`
  - `docs/真实硬件认证矩阵.md`
- 子任务：
  - 校准 Pico LogicAnalyzer VID/PID 与普通 Raspberry Pi Pico 的识别差异。
  - 统一网络扫描默认端口和设备握手确认。
  - 把 Saleae、SCPI、sigrok 的“框架可用”和“硬件已认证”分开。
  - 建立每类设备最小认证脚本和记录模板。
- 分阶段推进：
  - 阶段 1：梳理当前设备发现路径和配置项，列出相互矛盾的端口/VID/PID。
  - 阶段 2：统一设备发现结果类型和能力字段。
  - 阶段 3：补认证矩阵模板、手动记录模板和自动化 mock 验证。
  - 阶段 4：把真实硬件缺口和发布限制写入文档。
- 必须交付：
  - `docs/真实硬件认证矩阵.md` 不再混淆“适配框架”和“认证通过”。
  - 每类设备至少有一个可执行的检测或 mock 验证路径。
  - `docs/worktrees/07-device-discovery-certification.md` 记录发现策略和认证标准。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:drivers -- --runInBand`
  - `npm run db:validate`
- 合并风险：
  - 01 可能更新 Pico driver capabilities；07 只负责发现和认证口径，避免改采集状态机。

### 08 CLI/TUI 采集工具 parity

- 目标：提供接近原版 CLCapture/TerminalCapture 的用户级命令行能力。
- 范围内：
  - CLI 参数、配置文件、输出格式、批量采集、错误码、mock/真实 runner、用户文档。
- 范围外：
  - 不实现完整 curses/TUI 复杂界面，除非现有 CLI 完成后仍有余量。
  - 不修 driver 协议底层，归 01。
- 建议文件：
  - `src/cli/index.ts`
  - `src/cli/CaptureCli.ts`
  - `package.json`
  - `tests/unit/cli/`
  - `docs/user-manual.md`
- 子任务：
  - 支持 serial/network/mock 设备选择、采样参数、通道列表、触发配置。
  - 输出 `.lac`、CSV、JSON，并返回可脚本化错误码。
  - 增加批量采集和重复采集参数。
  - 文档中明确 mock 只用于本地验证，不代表真实硬件。
- 分阶段推进：
  - 阶段 1：审查现有 CLI 参数和测试，确定用户级命令契约。
  - 阶段 2：补 capture、repeat、batch、export 的稳定参数和错误码。
  - 阶段 3：接入真实 driver runner 和 mock runner，确保 CI 可测。
  - 阶段 4：更新用户手册、示例命令和自动化使用说明。
- 必须交付：
  - `logic-analyzer-capture --help` 覆盖主要能力，示例可运行。
  - CLI 输出 `.lac` 能被 02 的格式测试或模型加载。
  - `docs/worktrees/08-cli-tui-capture.md` 记录与原版 CLCapture/TerminalCapture 的差距。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:cli`
  - `npm run build:cli`
- 合并风险：
  - 02 会稳定 `.lac` 输出契约；08 的导出应复用模型层，不自定义 JSON。

### 09 信号描述语言和合成捕获

- 目标：补齐原版 SignalDescriptionLanguage / SignalComposer 对应能力，服务测试、演示和协议 fixture 生成。
- 范围内：
  - DSL 语法、parser、diagnostics、样本生成、合成 `.lac`、VSCode 命令、示例。
- 范围外：
  - 不做完整协议解码 parity，归 05。
  - 不做真实硬件采集，归 01/04。
- 建议文件：
  - `src/services/SignalDescriptionLanguage.ts`
  - `src/extension.ts`
  - `src/models/CaptureModels.ts`
  - `tests/unit/services/SignalDescriptionLanguage.test.ts`
  - `docs/user-manual.md`
- 子任务：
  - 定义 DSL 语法、AST、诊断和错误位置。
  - 从 DSL 生成 `CaptureSession` 和 `.lac`。
  - 接入 `logicAnalyzer.createSyntheticCapture` 命令。
  - 增加 I2C/SPI/UART/CAN 示例信号。
- 分阶段推进：
  - 阶段 1：冻结 DSL 最小语法和错误诊断格式。
  - 阶段 2：实现 parser 到 AST，再从 AST 生成通道样本。
  - 阶段 3：接入 synthetic capture 命令和 `.lac` 保存。
  - 阶段 4：用 DSL 生成 decoder golden fixture，反向服务 05。
- 必须交付：
  - DSL 示例文件和错误示例。
  - 生成的 `.lac` 能被 02/03 打开并渲染。
  - `docs/worktrees/09-sdl-synthetic-capture.md` 说明语法、限制和后续扩展。
- 验证命令：
  - `npm run typecheck`
  - `npm run test:unit -- tests/unit/services/SignalDescriptionLanguage.test.ts --runInBand`
  - `npm run test:extensions -- --runInBand`
- 合并风险：
  - 02 定义 `.lac` 输出契约，09 应复用 `LACFileFormat.createFromCaptureSession`。

### 10 质量门禁、CI、发布和文档收敛

- 目标：让工程状态、CI、发布说明和文档口径一致，避免再次出现“文档已完成、代码未闭环”。
- 范围内：
  - CI 分层、长耗时测试定位、发布检查、README/CHANGELOG/RELEASE_NOTES、旧文档归档、功能矩阵。
- 范围外：
  - 不承担各功能模块的业务修复，只建立门禁和文档约束。
- 建议文件：
  - `.github/workflows/quality-gate.yml`
  - `scripts/ci-test-runner.js`
  - `scripts/release-check.ts`
  - `README.md`
  - `CHANGELOG.md`
  - `RELEASE_NOTES.md`
  - `docs/功能状态矩阵.md`
  - `docs/tests/README.md`
- 子任务：
  - 修正 `test:unit` 长耗时定位流程，形成 quick/standard/full 分层。
  - 文档只声明已验证能力，实验性能力必须标注限制。
  - 建立发布前检查清单和 VSIX smoke test。
  - 归档或标注旧 `utest`、旧对比分析、旧阶段报告。
- 分阶段推进：
  - 阶段 1：拆分并定位 `test:unit` 长耗时点，给出 quick/standard/full 明确边界。
  - 阶段 2：修正 CI 与本地 `validate` 命令，使两边口径一致。
  - 阶段 3：更新 README、功能矩阵、用户手册、开发者指南、发布说明。
  - 阶段 4：建立 VSIX dry run、手动 smoke test 和发布阻断条件。
- 必须交付：
  - `docs/release-gate.md` 或等价发布门槛文档。
  - 旧文档索引明确“历史分析/当前有效/已归档”状态。
  - `docs/worktrees/10-quality-release-docs.md` 记录本轮验证命令和剩余风险。
- 验证命令：
  - `npm run validate:local`
  - `npm run package:dry`
  - `npm run build:production`
- 合并风险：
  - 10 会碰 README 和多个 docs，容易与其他任务文档冲突；建议最早合并基础门禁和文档索引，最后再合并发布说明更新。

## 合并顺序建议

1. 先合并 10 的质量门禁和文档口径调整，降低后续冲突。
2. 再合并 02 的 `.lac` fixture 和 01 的 Pico 协议 fixture，为其他任务提供稳定基线。
3. 接着合并 03、04、06 的前端工作流。
4. 并行合并 05、07、08、09 的协议、硬件、CLI 和 DSL 能力。
5. 最后统一跑 `typecheck`、`typecheck:strict`、`lint`、quick/driver/decoder/webview、`build:production`、`package:dry`。
