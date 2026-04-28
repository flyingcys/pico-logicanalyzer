# 首个硬件协议分析 UI 闭环拆分计划（2026-04-28）

## 目标一句话

先跑通一个最小但真实的硬件协议分析闭环：用 Pico 逻辑分析器采集一段 I2C 总线信号，打开或刷新 `.lac` 后能在 VSCode Webview 中看到波形，并在右侧“协议解码”面板看到 I2C 解码结果。

如果要并行推进，本计划已拆成 3 个 worktree：Host 解码桥接、前端解码 UI、fixture/smoke/硬件验收准备。详细执行拆分见 [`first-i2c-ui-three-worktrees-2026-04-28.md`](first-i2c-ui-three-worktrees-2026-04-28.md)。

## 结论

首个协议选择 I2C，不选择 SPI、UART、CAN、LIN 或 I2S。

理由：

- I2C 只需要 SCL/SDA 两路，接线和通道映射最少，适合先验证“硬件采集 -> 样本保存 -> UI 显示 -> 协议解码”的主链路。
- 仓库已有 `src/decoders/protocols/I2CDecoder.ts`、`DecoderManager.executeDecoder()`、`tests/unit/decoders/protocols/I2CDecoder.test.ts` 和 decoder golden 入口，后端解码能力不是从零开始。
- Webview 已能加载 `.lac` 样本并显示波形，当前缺口主要在“解码命令桥接”和“解码结果 UI 展示”，范围清晰。
- I2C 的结果对人可读性强：START、地址、读写位、ACK/NACK、数据字节、STOP，适合做首个可视化验收。

没有真实硬件时，可以用 fixture 或合成 `.lac` 跑通开发预演；但这只能标记为“UI/解码预演通过”，不能标记为“硬件协议分析已跑通”。硬件闭环必须有真实设备、接线、采集配置、结果文件和截图记录。

## 当前代码基线

### 已具备

- VSCode 自定义编辑器入口：`src/providers/LACEditorProvider.ts` 已负责打开 `.lac`、给 Webview 发文档、处理 host command。
- 采集链路：`LACEditorProvider.startCaptureForDocument()` 会从当前连接设备采集，保存为 `.lac`，并返回 `capturedDocument`。
- 前端文档装载：`src/frontend/core/stores/sessionStore.ts` 可解析 `Settings`、`CaptureChannels`、顶层 `Samples` 和 channel-level `samples`。
- 波形显示：`src/frontend/app/components/AppWaveformStage.vue` 与 `WaveformRenderer` 已能显示真实样本。
- 前端导出与设备命令：`AppHeader.vue` 已通过 `host.sendCommand()` 发送连接、采集、停止、重复采集和导出命令。
- 后端解码器：`src/decoders/DecoderManager.ts` 已注册 I2C/SPI/UART/CAN/LIN/I2S，并提供 `executeDecoder()`。
- I2C 单元测试：`tests/unit/decoders/protocols/I2CDecoder.test.ts` 已覆盖 I2C 解码核心。
- 浏览器 smoke 雏形：`tests/unit/webview/webview-browser-smoke.js` 已能验证 HTML 入口、样本波形、导出按钮和无设备错误。

### 关键缺口

- `LACEditorProvider.executeHostCommand()` 没有 `runDecoder` / `getDecoders` 命令，Webview 不能请求后端执行协议解码。
- `src/frontend/core/stores/decoderStore.ts` 只是占位数组，没有 decoder 配置、通道映射、执行状态、结果列表和错误状态。
- `src/frontend/app/components/AppSidebarRight.vue` 的“协议解码”面板只显示统计摘要，没有协议选择、通道映射、运行按钮、结果表和错误反馈。
- 波形区域还没有协议 annotation overlay。首个闭环可以先用右侧结果表验收，overlay 作为第二阶段增强。
- 当前浏览器 smoke 没有验证“右侧协议解码面板可见并显示结果”。
- 真实硬件认证矩阵还缺少 I2C 场景的设备、固件、接线、采样配置、结果 hash 和截图。

## 成功标准

### 必须达到

1. 打开一个包含 I2C 样本的 `.lac`，Webview 显示波形，不显示空状态或无效状态。
2. 右侧“协议解码”面板列出 I2C 解码器。
3. 用户选择或默认映射 `SCL -> CH0`、`SDA -> CH1` 后点击运行。
4. UI 显示至少这些结果类型：`START`、地址读写、`ACK` 或 `NACK`、数据字节、`STOP`。
5. 解码错误要显示在面板内，不只写 console。
6. `npm run test:webview:unit -- --runInBand` 通过。
7. `npm run test:decoders -- --runInBand` 通过。
8. 至少一条真实硬件或硬件替代路径被记录：
   - 真实硬件路径：Pico 逻辑分析器采集 I2C 总线，并保存 `.lac` 与截图。
   - 开发预演路径：fixture `.lac` 能完整显示波形和解码结果，但文档状态必须标注为非硬件认证。

### 不在首轮范围

- 不一次性做全部协议 UI。
- 不做复杂解码树、嵌套解码、流式解码 UI。
- 不要求把协议结果画到波形 overlay 上；首轮以右侧结果表为验收主目标。
- 不改 Pico 驱动协议核心，除非真实采集暴露阻断 bug。
- 不把 PDF/HTML/ZIP 报告纳入本闭环。

## 推荐方案

采用“后端执行解码，前端展示结果”的方案。

### 方案 A：后端执行解码，前端展示结果（推荐）

流程：

1. Webview 从 `sessionStore` 读取当前文档状态和通道信息。
2. 用户在右侧面板选择 I2C 和通道映射。
3. Webview 发送 `host.sendCommand('runDecoder', payload)`。
4. `LACEditorProvider` 从当前 `.lac` 文档重新解析 `CaptureSession`，构造 `ChannelData[]`。
5. `DecoderManager.executeDecoder('i2c', sampleRate, channels, options, channelMapping)` 执行解码。
6. Host 返回可序列化的 `DecoderExecutionResult`。
7. `decoderStore` 保存结果，`AppSidebarRight` 显示结果表和错误状态。

优点：

- 不把解码器实现打进 Webview bundle，避免继续增加前端体积。
- 后端直接读取 `.lac`，不需要通过 Webview 传大样本数组。
- 复用现有 `DecoderManager`，测试可以落在 provider host command 层。

代价：

- 首轮只保证基于文档内容解码；如果用户在 Webview 里做了未保存的样本编辑，解码可能不是最新编辑状态。
- 需要新增 host command 类型和 provider 解析辅助函数。

### 方案 B：前端直接执行解码

流程：Webview 直接 import decoder 相关模块，用 `sessionStore.channels` 执行解码。

优点：

- UI 操作即时，不依赖 host command。
- 能直接使用 Webview 当前编辑后的样本状态。

代价：

- Webview bundle 增大。
- 解码逻辑在扩展 host 和 Webview 两侧产生维护边界。
- 后续要做真实硬件、文件导出和报告时仍要回到 host。

### 方案 C：只做 fixture 页面，不接真实 host

流程：用 browserHost 或测试夹具构造 I2C `.lac`，前端显示固定解码结果。

优点：

- 最快看到 UI。

代价：

- 不能证明硬件协议分析跑通。
- 容易再次形成“UI 看起来有功能，但主链路没闭环”的状态。

结论：方案 A 是首轮执行方案；方案 C 只允许作为开发预演，不能作为验收结论。

## 目标链路设计

### 数据流

```text
Pico 硬件采集
  -> LogicAnalyzerDriver.startCapture()
  -> CaptureSession.captureChannels[].samples
  -> LACFileFormat.createFromCaptureSession()
  -> LACEditorProvider.saveLACFile()
  -> Webview documentUpdate
  -> sessionStore / waveformStore 显示波形
  -> AppSidebarRight 发送 runDecoder
  -> LACEditorProvider.runDecoderForDocument()
  -> DecoderManager.executeDecoder('i2c')
  -> decoderStore 保存结果
  -> 右侧协议解码表格显示结果
```

### Host command 契约

新增命令：`runDecoder`

请求：

```ts
interface RunDecoderRequest {
  decoderId: 'i2c';
  channelMapping: Array<{
    captureIndex: number;
    decoderIndex: number;
    name?: string;
  }>;
  options: Array<{
    optionIndex: number;
    value: unknown;
  }>;
}
```

首轮默认映射：

- `captureIndex: 0 -> decoderIndex: 0`，含义为 SCL。
- `captureIndex: 1 -> decoderIndex: 1`，含义为 SDA。

响应：

```ts
interface RunDecoderResponse {
  decoderId: string;
  decoderName: string;
  success: boolean;
  executionTime: number;
  results: Array<{
    startSample: number;
    endSample: number;
    annotationType: number;
    values: string[];
    rawData?: unknown;
    shape?: 'hexagon' | 'rectangle' | 'diamond';
  }>;
  error?: string;
  performanceStats?: {
    totalSamples: number;
    processingSpeed: number;
    memoryUsage?: number;
  };
}
```

错误规则：

- 当前文档无样本：返回 `success: false`，错误文案为 `当前文件没有可解码样本`。
- 通道数量不足：返回 `success: false`，错误文案为 `I2C 解码需要 SCL 和 SDA 两个通道`。
- 采样率无效：返回 `success: false`，错误文案为 `采样率无效，无法执行协议解码`。
- decoder 不存在：返回 `success: false`，错误文案沿用 `Decoder not found: <id>`。

### UI 行为

右侧“协议解码”面板首轮只做一个垂直工作流：

1. 协议选择：默认 `I2C`，其它协议暂不显示为可选项。
2. 通道映射：
   - SCL 下拉框默认第一个可见通道。
   - SDA 下拉框默认第二个可见通道。
   - 下拉项显示 `CH0 - SCL` 或 `CH1 - SDA` 这类可读名称。
3. 运行按钮：
   - 文档不是 `samples` 时禁用。
   - 通道不足两个时禁用。
   - 执行中显示 loading。
4. 摘要：
   - 结果数。
   - 错误数。
   - 执行耗时。
5. 结果表：
   - 区间：`startSample - endSample`。
   - 类型：annotation type 映射到可读标签，首轮可直接显示数字和首个 values 文本。
   - 内容：`values[0]` 优先，鼠标悬停或展开时显示完整 `values`。
6. 错误状态：
   - 面板内显示错误，不弹出阻断式全局提示。
   - 同时保留一次 `ElMessage.error` 提醒。

## 硬件验收方案

### 推荐硬件

- 采集设备：Pico Logic / Pico W / Pico 2 逻辑分析器固件之一。
- I2C 目标：任意稳定 I2C 设备或开发板生成器，优先选择 24LCxx EEPROM、温湿度传感器或一块能持续发 I2C 读写的 MCU。
- 接线：
  - CH0 -> SCL。
  - CH1 -> SDA。
  - GND -> 被测总线 GND。
  - 不由逻辑分析器给目标供电，除非硬件文档明确允许。

### 推荐采集配置

- 协议：I2C standard mode 100 kHz。
- 采样率：1 MHz 起步；如果边沿不稳定，升到 4 MHz 或 8 MHz。
- 通道：仅启用 CH0、CH1。
- 触发：SDA falling 或任意边沿均可，首轮优先用简单边沿触发。
- 样本数：`preTriggerSamples = 100`，`postTriggerSamples = 4000` 起步。
- 预期事务：至少包含一次写地址、一个数据字节、ACK 和 STOP。

### 硬件验收记录必须包含

- 设备型号。
- 固件版本或驱动版本。
- 操作系统。
- VSCode 扩展 commit。
- 接线说明。
- 采样率、通道、触发配置。
- `.lac` 文件路径或 hash。
- Webview 波形截图。
- 解码面板截图。
- 解码结果摘要：结果数、是否有 START/STOP、地址、ACK/NACK、数据字节。

## 分阶段拆分计划

### 阶段 0：建立最小可复现样本

目标：先有一个固定 I2C `.lac`，保证 UI 开发不用等真实硬件。

文件：

- 新增：`tests/fixtures/lac/i2c-ui-smoke.lac.json`
- 更新：`tests/fixtures/lac/README.md`

任务：

1. 复用 `tests/unit/decoders/DecoderSigrokGolden.test.ts` 里的 I2C 样本生成逻辑，整理一份顶层 `Settings + Samples` 格式的 `.lac` fixture。
2. fixture 包含 CH0/SCL、CH1/SDA，顶层 `Samples` 用 packed bit 表示。
3. fixture 的解码期望写入 README：地址、读写方向、ACK/NACK、数据字节、STOP。
4. 用现有 Webview 单元测试确认该 fixture 能进入 `sessionStore.documentState === 'samples'`。

验收：

```bash
npm run test:webview:unit -- --runInBand
npm run test:decoders -- --runInBand
```

### 阶段 1：Provider 增加解码 host command

目标：让 Webview 可以请求扩展 host 基于当前 `.lac` 执行 I2C 解码。

文件：

- 修改：`src/providers/LACEditorProvider.ts`
- 修改：`src/frontend/platform/host/types.ts`
- 测试：`tests/unit/webview/main.test.ts`

任务：

1. 在 `HostCommandName` 增加 `runDecoder`。
2. 在 `LACEditorProvider.executeHostCommand()` 增加 `case 'runDecoder'`。
3. 新增私有方法 `runDecoderForDocument(document, payload)`。
4. `runDecoderForDocument()` 读取 `document.getText()`，用 `parseLACFile()` 和 `LACFileFormat.convertToCaptureSession()` 得到 `CaptureSession`。
5. 把 `CaptureSession.captureChannels` 转成 `ChannelData[]`。
6. 校验文档有样本、采样率有效、I2C 映射包含两个通道。
7. 调用 `new DecoderManager().executeDecoder('i2c', session.frequency, channels, options, channelMapping)`。
8. 返回可序列化结果，不能返回 `Uint8Array`、`Map` 或 class 实例。
9. 单元测试覆盖成功、无样本、通道不足、decoder 错误四类路径。

验收：

```bash
npm run test:webview:unit -- --runInBand
npm run test:extensions -- --runInBand
```

### 阶段 2：补齐 decoderStore

目标：前端能保存解码配置、执行状态、结果和错误。

文件：

- 修改：`src/frontend/core/stores/decoderStore.ts`
- 测试：`tests/unit/webview/main.test.ts`

状态结构：

- `availableDecoders`：首轮固定一项 I2C。
- `activeDecoderConfigs`：当前运行配置，首轮只允许一个 I2C。
- `decoderResults`：按 decoderId 保存结果数组。
- `decoderErrors`：保存可展示错误。
- `isDecoding`：执行状态。
- `lastExecutionTime`：最近耗时。
- `channelConflicts`：首轮只记录 SCL/SDA 选择同一通道的冲突。

任务：

1. 定义 `FrontendDecoderResult`、`FrontendDecoderConfig`、`DecoderRunState`。
2. 增加 `setI2CDefaultMapping(channels)`，按当前可见通道推导 CH0/CH1。
3. 增加 `runI2CDecoder(host, sessionStore)` action。
4. action 里调用 `host.sendCommand('runDecoder', request)`。
5. 成功时写入 `decoderResults` 和 `lastExecutionTime`。
6. 失败时写入 `decoderErrors`。
7. 通道冲突时直接在前端阻断，不发 host command。

验收：

```bash
npm run test:webview:unit -- --runInBand
```

### 阶段 3：右侧协议解码 UI

目标：用户能在 UI 里看到 I2C 解码入口和结果。

文件：

- 修改：`src/frontend/app/components/AppSidebarRight.vue`
- 可能新增：`src/frontend/app/components/DecoderResultTable.vue`
- 可能新增：`src/frontend/app/components/DecoderChannelMapping.vue`
- 测试：`tests/unit/webview/main.test.ts`

任务：

1. 保留右侧 tabs，不改变整体布局。
2. 在 decoder tab 中替换占位文案，显示 I2C 配置区域。
3. 显示 SCL/SDA 两个下拉选择。
4. 显示运行按钮，按钮状态由 `sessionStore.documentState`、通道数量和 `decoderStore.isDecoding` 决定。
5. 显示结果摘要：结果数、错误数、执行耗时。
6. 显示结果表：样本区间、类型、内容。
7. 空结果显示“未发现 I2C 事务”，错误显示具体错误。
8. 测试覆盖：无样本禁用、通道不足禁用、成功返回结果、错误展示。

验收：

```bash
npm run test:webview:unit -- --runInBand
```

### 阶段 4：浏览器 smoke 验证 UI 可见

目标：用真实浏览器打开 HTML build，确认用户能看到波形和解码结果。

文件：

- 修改：`tests/unit/webview/webview-browser-smoke.js`
- 可能新增：`tests/unit/webview/webview-decoder-smoke.js`
- 修改：`package.json` 增加可选脚本 `test:webview:smoke`

任务：

1. 在 smoke 的 sample document 中换成 I2C fixture。
2. 打开页面后切换或确认右侧在“协议解码”tab。
3. 点击运行 I2C 解码。
4. 等待结果表出现。
5. 断言页面包含 `START`、`ACK`、`STOP` 中至少三类关键文本。
6. 检查 canvas 非空，保留现有导出按钮和无设备错误验证。

验收：

```bash
npm run build:frontend:html
node tests/unit/webview/webview-browser-smoke.js
```

### 阶段 5：真实硬件采集验收

目标：证明不是只有 fixture 能跑，真实 I2C 总线采集也能在 UI 里解码。

文件：

- 更新：`docs/真实硬件认证矩阵.md`
- 新增：`docs/hardware-validation/i2c-pico-ui-2026-04-28.md`
- 新增：`tests/fixtures/lac/README.md` 中的真实样本来源说明

任务：

1. 准备 I2C 目标设备，确认逻辑电平不超过采集设备允许范围。
2. 按推荐接线连接 CH0/SCL、CH1/SDA、GND。
3. 在 UI 中连接设备。
4. 设置 1 MHz 或更高采样率，只启用 CH0/CH1。
5. 点击开始采集，等待 `.lac` 自动刷新。
6. 确认波形可见。
7. 在右侧运行 I2C 解码。
8. 保存 `.lac`，记录 hash。
9. 截图波形和解码面板。
10. 写入认证矩阵。

验收：

- `docs/真实硬件认证矩阵.md` 有一条 I2C UI 闭环记录。
- 记录文件包含 `.lac` hash 和截图路径。
- 解码结果中包含可解释的地址、ACK/NACK 和至少一个数据字节。

## 测试矩阵

| 层级 | 命令 | 目标 |
| --- | --- | --- |
| 解码器单元 | `npm run test:decoders -- --runInBand` | 确认 I2C 解码器没有被 UI 改动破坏 |
| Webview 单元 | `npm run test:webview:unit -- --runInBand` | 确认 store、host command、右侧面板交互稳定 |
| 扩展单元 | `npm run test:extensions -- --runInBand` | 确认 provider host command 和命令注册稳定 |
| 浏览器 smoke | `npm run build:frontend:html && node tests/unit/webview/webview-browser-smoke.js` | 确认真实浏览器能看到波形和解码结果 |
| 分层 CI | `npm run test:ci:quick -- --skip-install` | 确认核心 quick 门禁不回退 |
| 打包检查 | `npm run package:dry` | 确认 Webview bundle 和 VSIX 文件清单不破坏 |

## 风险与处理

### 风险 1：真实硬件采集样本边沿不足，I2C 解码为空

处理：

- 提高采样率到 4 MHz 或 8 MHz。
- 延长 post samples。
- 先用 fixture 验证 UI，再用真实 `.lac` 和解码器单测定位是采集问题还是解码问题。

### 风险 2：host 基于文档解码，Webview 未保存编辑不生效

处理：

- 首轮明确解码当前文档内容。
- 后续如果要支持未保存编辑，再让 Webview 传递变更后的 channel samples 或先保存再解码。

### 风险 3：结果太多导致右侧表格卡顿

处理：

- 首轮限制显示前 500 条，摘要显示总数。
- 后续再做虚拟列表。

### 风险 4：Webview bundle 继续增大

处理：

- 首轮不在 Webview import `DecoderManager`。
- 解码在 extension host 执行，只把结果传给前端。

### 风险 5：UI 看起来能解码，但缺真实硬件证据

处理：

- 文档和功能矩阵必须区分“fixture/UI 预演”和“真实硬件认证”。
- 没有真实设备记录前，状态保持实验性。

## 建议工作包

### Worktree

- 目录：`.worktree/first-i2c-ui`
- 分支：`feature/first-i2c-protocol-ui`
- 主题：首个 I2C 硬件协议分析 UI 闭环

### 文件边界

主要修改：

- `src/providers/LACEditorProvider.ts`
- `src/frontend/platform/host/types.ts`
- `src/frontend/core/stores/decoderStore.ts`
- `src/frontend/app/components/AppSidebarRight.vue`
- `tests/unit/webview/main.test.ts`
- `tests/unit/webview/webview-browser-smoke.js`
- `docs/真实硬件认证矩阵.md`

可选新增：

- `src/frontend/app/components/DecoderChannelMapping.vue`
- `src/frontend/app/components/DecoderResultTable.vue`
- `tests/fixtures/lac/i2c-ui-smoke.lac.json`
- `docs/hardware-validation/i2c-pico-ui-2026-04-28.md`

不建议首轮修改：

- `src/drivers/LogicAnalyzerDriver.ts`，除非真实硬件采集阻断。
- `src/decoders/protocols/I2CDecoder.ts`，除非 fixture 暴露明确 bug。
- `webpack.config.js`，本方案不应增加前端解码 bundle。

## 里程碑

### M0：文档和 fixture 准备

完成标准：

- 有 I2C UI smoke fixture。
- 文档记录 fixture 语义和预期结果。

### M1：后端 runDecoder 命令可用

完成标准：

- 单元测试能直接调用 `executeHostCommand(document, 'runDecoder', payload)` 得到 I2C 结果。
- 无样本、通道不足、采样率无效都有可读错误。

### M2：右侧 UI 可操作

完成标准：

- 用户能在右侧选择 SCL/SDA 并运行 I2C。
- 结果表能显示事务。
- 错误状态能显示在面板内。

### M3：浏览器 smoke 可见

完成标准：

- HTML build 在 Chromium 中打开。
- canvas 非空。
- 协议解码面板显示 I2C 结果。

### M4：真实硬件记录

完成标准：

- 有真实采集 `.lac`。
- 有 Webview 截图。
- 认证矩阵新增 I2C UI 闭环记录。

## 最小提交顺序

1. `test: add i2c ui smoke lac fixture`
2. `feat: add runDecoder host command`
3. `feat: add frontend decoder store`
4. `feat: show i2c decoder results in sidebar`
5. `test: add browser smoke for i2c decoder ui`
6. `docs: record first i2c hardware protocol ui validation`

## 当前任务清单

- [ ] 新增 I2C `.lac` UI fixture。
- [ ] 给 `LACEditorProvider` 增加 `runDecoder` host command。
- [ ] 给 `HostCommandName` 增加 `runDecoder`。
- [ ] 给 `decoderStore` 增加 I2C 配置、状态和结果。
- [ ] 改造 `AppSidebarRight.vue`，展示 I2C 解码 UI。
- [ ] 补 Webview 单元测试。
- [ ] 补浏览器 smoke。
- [ ] 跑通 fixture UI 闭环。
- [ ] 跑通真实 Pico + I2C 采集闭环。
- [ ] 更新真实硬件认证矩阵和功能状态矩阵。
