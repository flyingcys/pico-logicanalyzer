# I2C 协议分析 UI 闭环三 Worktree 并行计划（2026-04-28）

> 本计划是 [`first-hardware-protocol-ui-plan-2026-04-28.md`](first-hardware-protocol-ui-plan-2026-04-28.md) 的并行执行拆分版。目标不是再做长期路线图，而是在这一轮 3 个 worktree 合并后形成可演示闭环：fixture `.lac` 能显示波形，右侧 UI 能运行 I2C 解码并显示结果，浏览器 smoke 能验证结果；剩余工作只进入真实硬件手工测试和小范围收尾。

## 目标

三条 worktree 并行推进，最终合并后达到：

1. `.lac` 文档中已有 I2C 样本时，Webview 能显示波形。
2. 右侧“协议解码”面板能选择 I2C，映射 SCL/SDA，并运行解码。
3. 解码由 extension host 执行，Webview 只展示结果，不把解码器实现打进前端 bundle。
4. UI 能显示 START、地址/读写、ACK/NACK、数据字节、STOP 等结果。
5. fixture/browser smoke 已经闭环，真实硬件手工测试只需要接线采集、截图、记录 hash。

## 并行拆分总览

| Worktree | 分支 | 主题 | 主责任 | 合并后状态 |
| --- | --- | --- | --- | --- |
| `.worktree/i2c-01-host-decoder` | `feature/i2c-01-host-decoder` | Host 解码桥接 | `runDecoder` host command、后端 `.lac` -> `DecoderManager`、provider 单元测试 | Webview 可以向 host 请求 I2C 解码 |
| `.worktree/i2c-02-decoder-ui` | `feature/i2c-02-decoder-ui` | 前端解码 UI | `decoderStore`、右侧 I2C 面板、通道映射、结果表、前端单元测试 | 用户可以在 UI 中运行并看到解码结果 |
| `.worktree/i2c-03-fixture-smoke-docs` | `feature/i2c-03-fixture-smoke-docs` | Fixture、浏览器 smoke、手工测试文档 | I2C `.lac` fixture、HTML/browser smoke、手工硬件记录模板、文档状态更新 | 合并后只差真实硬件接入验证 |

三条线的依赖关系：

- 01 定义并实现 host contract，是真实 VSCode 环境的最终后端。
- 02 按本计划写死的 `runDecoder` contract 先开发 UI，可在测试中 mock host，不等待 01。
- 03 先用 browserHost 或测试 stub 返回固定 `runDecoder` 结果完成 smoke；01 合并后再把 smoke 切到真实 host contract 语义。
- 最终集成顺序建议：先合 01，再合 02，最后合 03。若 03 的 fixture 被 02 单测需要，可先 cherry-pick fixture 文件，避免扩大冲突。

## 共享契约

三个 worktree 都必须遵守以下契约，不能各自发明字段。

### 命令名

```ts
const command = 'runDecoder';
```

### 请求格式

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

- `captureIndex: 0, decoderIndex: 0, name: 'SCL'`
- `captureIndex: 1, decoderIndex: 1, name: 'SDA'`

### 响应格式

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

### 错误文案

为了测试和 UI 一致，错误文案统一如下：

- 无样本：`当前文件没有可解码样本`
- 采样率无效：`采样率无效，无法执行协议解码`
- I2C 通道不足：`I2C 解码需要 SCL 和 SDA 两个通道`
- 映射冲突：`SCL 和 SDA 不能映射到同一采集通道`
- 未知 decoder：`Decoder not found: <id>`

### 结果显示规则

- 表格最多直接渲染前 500 条，摘要显示总数。
- 内容列优先显示 `values[0]`。
- 调试详情可显示 `values.join(' / ')`。
- 首轮不要求 waveform overlay。

## Worktree 01：Host 解码桥接

### 目标

把当前 `.lac` 文档转换成 `DecoderManager.executeDecoder('i2c')` 的输入，并通过 host command 返回可序列化结果。该 worktree 负责真实 VSCode host 闭环，不碰前端 UI。

### 文件边界

负责修改：

- `src/providers/LACEditorProvider.ts`
- `src/frontend/platform/host/types.ts`
- `tests/unit/webview/main.test.ts` 中 provider/host command 相关测试
- 必要时新增 `tests/fixtures/lac/i2c-provider-run-decoder.lac.json`

禁止修改：

- `src/frontend/core/stores/decoderStore.ts`
- `src/frontend/app/components/AppSidebarRight.vue`
- `tests/unit/webview/webview-browser-smoke.js`
- `docs/真实硬件认证矩阵.md`
- `src/decoders/protocols/I2CDecoder.ts`，除非现有测试证明 I2C 解码器有明确 bug

### 设计要点

1. `HostCommandName` 增加 `'runDecoder'`。
2. `LACEditorProvider.executeHostCommand()` 增加 `case 'runDecoder'`。
3. 新增 `runDecoderForDocument(document, payload)`。
4. 从 `document.getText()` 解析 `.lac`：
   - 使用现有 `parseLACFile()`。
   - 使用 `LACFileFormat.convertToCaptureSession()`。
   - 优先使用 `session.frequency`，必要时兼容 `sampleRate`。
5. 转换 `CaptureSession.captureChannels`：
   - 每个 `AnalyzerChannel` 转为 `{ channelNumber, channelName, samples }`。
   - `samples` 必须是 `Uint8Array`。
6. 校验：
   - `captureChannels` 至少有 2 个可用样本通道。
   - `frequency > 0`。
   - I2C 映射必须包含 decoder index 0 和 1。
   - SCL/SDA 不能映射到同一 capture index。
7. 调用：

```ts
const manager = new DecoderManager();
const result = await manager.executeDecoder('i2c', sampleRate, channels, options, channelMapping);
```

8. 返回 JSON-safe 结果：
   - 不返回 `Map`。
   - 不返回 class instance。
   - 不返回 `Uint8Array`。
   - `rawData` 只保留 number/string/boolean/object/null。

### 测试任务

在 `tests/unit/webview/main.test.ts` 中增加：

1. `executeHostCommand runDecoder 应返回 I2C 解码结果`
   - 构造包含 CH0/CH1 和 I2C packed samples 的 document mock。
   - 调用 `(provider as any).executeHostCommand(document, 'runDecoder', payload)`。
   - 断言 `success === true`、`data.results.length > 0`、结果包含 `START` 或 `ACK`。
2. `runDecoder 应拒绝 settings-only 文档`
   - 文档只有 `Settings`、没有 samples。
   - 断言错误为 `当前文件没有可解码样本`。
3. `runDecoder 应拒绝单通道 I2C 映射`
   - 只有 CH0。
   - 断言错误为 `I2C 解码需要 SCL 和 SDA 两个通道`。
4. `runDecoder 应拒绝 SCL/SDA 同通道`
   - 两个 mapping 都指向 `captureIndex: 0`。
   - 断言错误为 `SCL 和 SDA 不能映射到同一采集通道`。

### 验收命令

```bash
npm run typecheck
npm run test:webview:unit -- --runInBand
npm run test:extensions -- --runInBand
npm run test:decoders -- --runInBand
```

### 交付标准

- `runDecoder` 在 provider 层可用。
- 失败路径返回稳定中文错误。
- 不引入 Webview bundle 体积增长。
- 不需要真实硬件即可通过 provider 单元测试。

## Worktree 02：前端解码 UI

### 目标

把右侧“协议解码”面板从占位统计变成可操作 I2C 解码界面。该 worktree 可以用 mocked host 先完成 UI/Store 闭环，不等待 01 合并。

### 文件边界

负责修改：

- `src/frontend/core/stores/decoderStore.ts`
- `src/frontend/app/components/AppSidebarRight.vue`
- 可新增 `src/frontend/app/components/DecoderChannelMapping.vue`
- 可新增 `src/frontend/app/components/DecoderResultTable.vue`
- `tests/unit/webview/main.test.ts` 中 frontend store/component 相关测试

允许只读：

- `src/frontend/platform/host/types.ts`
- `src/frontend/core/stores/sessionStore.ts`
- `src/frontend/core/stores/waveformStore.ts`

禁止修改：

- `src/providers/LACEditorProvider.ts`
- `tests/unit/webview/webview-browser-smoke.js`
- `tests/fixtures/lac/*`
- `package.json`

### Store 设计

`decoderStore` 首轮定义以下状态：

```ts
interface FrontendDecoderResult {
  startSample: number;
  endSample: number;
  annotationType: number;
  values: string[];
  rawData?: unknown;
  shape?: 'hexagon' | 'rectangle' | 'diamond';
}

interface I2CMappingState {
  sclCaptureIndex: number | null;
  sdaCaptureIndex: number | null;
}

interface FrontendDecoderState {
  activeDecoderConfigs: Array<{ decoderId: 'i2c'; label: string }>;
  decoderResults: FrontendDecoderResult[];
  decoderErrors: string[];
  channelConflicts: string[];
  isDecoding: boolean;
  lastExecutionTime: number | null;
  i2cMapping: I2CMappingState;
}
```

必须提供 actions：

- `initializeI2CMapping(channels)`：默认 SCL 选第一个可见通道，SDA 选第二个可见通道。
- `setI2CMapping(role, captureIndex)`：更新 SCL/SDA 映射并重算冲突。
- `runI2CDecoder(host, sessionStore)`：发送 `host.sendCommand('runDecoder', payload)`。
- `clearDecoderResults()`：文档切换或失败时可清空结果。

### UI 设计

右侧 decoder tab 显示以下区域：

1. 标题：`I2C 协议解码`
2. 状态行：
   - 无样本：`当前文件没有可解码样本`
   - 通道不足：`I2C 解码需要至少两个通道`
   - 可运行：显示样本数和采样率
3. 通道映射：
   - `SCL` 下拉
   - `SDA` 下拉
   - 选项显示 `CH<channelNumber> - <channelName>`
4. 主按钮：
   - 文案：`运行 I2C 解码`
   - 执行中：loading
   - 禁用条件：无样本、通道不足、映射冲突
5. 摘要：
   - `结果数`
   - `错误数`
   - `耗时`
6. 结果表：
   - `样本区间`
   - `类型`
   - `内容`
   - 最多直接显示 500 条
7. 错误块：
   - 面板内常驻显示最近错误

### 测试任务

在 `tests/unit/webview/main.test.ts` 增加：

1. `decoderStore 应根据当前通道初始化 I2C 映射`
   - 给 CH0/CH1。
   - 断言 SCL=0、SDA=1。
2. `decoderStore 应阻止 SCL 和 SDA 同通道`
   - 设置 SCL=0、SDA=0。
   - 断言 `channelConflicts` 含统一错误文案。
3. `runI2CDecoder 成功时应保存结果`
   - mock host 返回 `success: true` 和两条 result。
   - 断言 `decoderResults.length === 2`。
4. `runI2CDecoder 失败时应保存错误`
   - mock host 返回 `success: false`。
   - 断言 `decoderErrors[0]` 为错误文案。
5. `AppSidebarRight 应显示 I2C 运行按钮和结果内容`
   - mount 组件。
   - 注入 samples 文档状态和 mock host。
   - 点击按钮后断言页面出现 `START` / `ACK` / `STOP`。

### 并行开发策略

因为 01 还未合并，02 不依赖 `HostCommandName` 类型新增。`host.sendCommand()` 已允许 `HostCommandName | string`，所以 02 直接调用：

```ts
host.sendCommand('runDecoder', request)
```

待 01 合并后，只需要确认类型仍通过。

### 验收命令

```bash
npm run typecheck
npm run test:webview:unit -- --runInBand
```

### 交付标准

- 右侧面板不再是占位容器。
- 没有后端时，前端测试也能通过 mocked host 验证交互。
- 合并 01 后不需要改 UI 才能跑通真实 host。

## Worktree 03：Fixture、Smoke、手工测试文档

### 目标

准备 I2C 最小样本、浏览器 smoke 和真实硬件手工测试模板。该 worktree 保证合并 01/02 后能快速验证闭环，并让下一步直接进入真实设备手工测试。

### 文件边界

负责修改：

- `tests/fixtures/lac/i2c-ui-smoke.lac.json`
- `tests/fixtures/lac/README.md`
- `tests/unit/webview/webview-browser-smoke.js`
- 可新增 `tests/unit/webview/webview-decoder-smoke.js`
- `package.json` 仅限新增 `test:webview:smoke` 脚本
- `docs/hardware-validation/i2c-pico-ui-manual-test.md`
- `docs/真实硬件认证矩阵.md`
- `docs/功能状态矩阵.md`

禁止修改：

- `src/providers/LACEditorProvider.ts`
- `src/frontend/core/stores/decoderStore.ts`
- `src/frontend/app/components/AppSidebarRight.vue`
- `src/frontend/platform/host/types.ts`

### Fixture 设计

新增 `tests/fixtures/lac/i2c-ui-smoke.lac.json`，格式使用当前 Webview 已支持的结构：

```json
{
  "Settings": {
    "Frequency": 1000000,
    "PreTriggerSamples": 4,
    "PostTriggerSamples": 160,
    "CaptureChannels": [
      { "ChannelNumber": 0, "ChannelName": "SCL" },
      { "ChannelNumber": 1, "ChannelName": "SDA" }
    ]
  },
  "Samples": ["3", "3", "1", "1"]
}
```

实际样本不能只用上面的 4 点示意。应复用 `tests/unit/decoders/DecoderSigrokGolden.test.ts` 中 `i2cOperationsToChannels()` 的思想，生成至少一段完整事务：

- idle
- START
- address byte
- ACK
- data byte
- ACK
- STOP

`README.md` 中必须写明：

- CH0 是 SCL。
- CH1 是 SDA。
- 期望地址。
- 期望数据字节。
- 期望出现 START/ACK/STOP。

### Browser smoke 设计

首轮有两个阶段：

1. 01/02 未合并前，smoke 可以通过 browserHost mock `runDecoder` 返回固定结果，用来验证 UI 可见性。
2. 01/02 合并后，smoke 必须使用同一个 UI 操作路径：打开 fixture、点击运行 I2C 解码、等待结果表出现。

Smoke 断言：

- `canvas.waveform-stage__canvas` 存在。
- `[data-testid="webview-export-button"]` 可用。
- 右侧协议面板有 `运行 I2C 解码`。
- 点击运行后，页面出现 `START`、`ACK`、`STOP`。
- 无设备环境下 `startCapture` 仍返回 `请先连接` 错误，不影响解码 fixture。

### 手工测试模板

新增 `docs/hardware-validation/i2c-pico-ui-manual-test.md`，包含：

- 测试日期。
- 操作人。
- commit。
- VSCode 版本。
- OS。
- Pico 型号。
- 固件版本。
- I2C 目标设备。
- 接线表：CH0/SCL、CH1/SDA、GND。
- 采集配置：采样率、pre/post samples、触发通道、触发类型。
- 保存的 `.lac` 路径。
- `.lac` sha256。
- 波形截图路径。
- 解码结果截图路径。
- 解码摘要：地址、数据字节、ACK/NACK、是否出现 STOP。
- 结论：通过 / 失败 / 阻塞。

### 验收命令

```bash
npm run build:frontend:html
node tests/unit/webview/webview-browser-smoke.js
npm run test:webview:unit -- --runInBand
```

如果新增 `package.json` 脚本：

```bash
npm run test:webview:smoke
```

### 交付标准

- fixture 可以被 `sessionStore` 识别为 samples 文档。
- browser smoke 能验证 UI 路径。
- 手工测试模板足够详细，真实硬件测试只需要填记录，不需要再设计流程。
- 功能矩阵保持实验性，不因为 fixture 通过就声明真实硬件完成。

## 集成计划

### 第 1 轮：各 worktree 独立完成

每个 worktree 在自己的目录运行对应验收命令，并在提交说明里记录：

- 当前基线 commit。
- 改动文件。
- 通过命令。
- 未完成项。
- 是否需要其它 worktree 配合。

### 第 2 轮：合并 01 + 02

合并顺序：

1. 合并 01：先把真实 host command 放进主线。
2. 合并 02：接上 UI 和 store。
3. 处理可能冲突：
   - `tests/unit/webview/main.test.ts`。
   - `src/frontend/platform/host/types.ts` 如果 02 不小心改了，保留 01 的命令类型。

合并后验证：

```bash
npm run typecheck
npm run test:webview:unit -- --runInBand
npm run test:extensions -- --runInBand
npm run test:decoders -- --runInBand
```

### 第 3 轮：合并 03

合并 03 后验证：

```bash
npm run build:frontend:html
node tests/unit/webview/webview-browser-smoke.js
npm run test:ci:quick -- --skip-install
npm run package:dry
```

### 合并完成标准

合并完成后必须满足：

- Fixture 打开后波形可见。
- 右侧 I2C 面板可见。
- 点击运行能看到解码结果。
- 浏览器 smoke 通过。
- Quick 门禁通过。
- 手工测试模板和认证矩阵入口已准备。

此时才进入真实硬件手工测试阶段。

## 手工测试前仅允许的小收尾

这一轮合并后，只允许做这些小收尾：

- 修正 UI 文案。
- 调整结果表列宽或空状态。
- 修正截图路径和 hash 记录格式。
- 补一条遗漏的错误提示测试。
- 根据真实硬件接线把文档中的通道名从 CH0/CH1 改成实际 UI 显示名。

不允许把以下内容拖到“手工测试前收尾”：

- `runDecoder` host command 未实现。
- 右侧 UI 仍是占位。
- fixture smoke 不通过。
- 解码结果不能显示在 UI。
- Quick 门禁失败。

## 三个 Worktree 的 Definition of Done

### 01 DoD

- [ ] `runDecoder` host command 存在。
- [ ] `.lac` -> `CaptureSession` -> `ChannelData[]` -> `DecoderManager` 路径有测试。
- [ ] 成功和失败路径都返回稳定结构。
- [ ] `npm run test:extensions -- --runInBand` 通过。
- [ ] `npm run test:webview:unit -- --runInBand` 通过。

### 02 DoD

- [ ] `decoderStore` 有 I2C 配置、映射、结果和错误状态。
- [ ] 右侧 UI 可以运行 I2C 解码。
- [ ] mock host 成功和失败路径都有测试。
- [ ] UI 不依赖后端源码 import 解码器。
- [ ] `npm run test:webview:unit -- --runInBand` 通过。

### 03 DoD

- [ ] 有 I2C UI smoke fixture。
- [ ] fixture 语义写入 `tests/fixtures/lac/README.md`。
- [ ] browser smoke 能验证波形和 I2C 结果。
- [ ] 有真实硬件手工测试模板。
- [ ] 功能矩阵和认证矩阵入口保持“实验性/待手工验证”。

## 最终人工测试入口

当三个 worktree 合并并通过集成验证后，人工测试只执行：

1. 连接 Pico 和 I2C 目标设备。
2. 打开 VSCode 扩展。
3. 连接设备。
4. 设置 CH0/SCL、CH1/SDA，采样率 1 MHz 起。
5. 点击采集。
6. 确认波形显示。
7. 在右侧运行 I2C 解码。
8. 截图并记录 `.lac` hash。
9. 填写 `docs/hardware-validation/i2c-pico-ui-manual-test.md`。
10. 根据结果更新 `docs/真实硬件认证矩阵.md`。
