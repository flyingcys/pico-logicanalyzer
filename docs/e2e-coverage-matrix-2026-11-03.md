# 真宿主 e2e 覆盖矩阵（2026-11-03 终版）

> 对应代码：`tests/e2e/vscode/`（9 个场景，commit `b18a5f40`）。
> **本表只登记已实跑验证过的状态**，猜的一律标注。
>
> ⚠️ **状态口径**（与 runner 的退出码一致）：
> - `pass` —— 断言真跑了并成立
> - `fail` —— 断言跑了但不成立（产品缺陷）
> - `blocked` —— 被产品侧的门挡住（如原生弹窗），**带原因**
> - `not_exercised` —— 本环境跑不到，**带原因**
>
> **全量 e2e 退出码 = 3**：无 fail，但有 blocked/not_exercised。
> 按设计「有未验项就不算通过」，**这不是失败**。

---

## 一、命令面（`package.json` 声明 9 条）

| # | 命令 | 覆盖场景 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | `logicAnalyzer.openAnalyzer` | `open-analyzer` | ✅ **pass** | 真落盘 `.lac` + custom editor 真拉起（`viewType=logicAnalyzer.lacEditor`）；变异验证过（删 `writeFile` / 删 `vscode.open` 各自独立红） |
| 2 | `logicAnalyzer.connectDevice` | — | ⛔ **not_exercised** | 无设备时 `await showWarningMessage` 在真宿主永不 resolve；有设备时 `await showQuickPick` 同样挂死 |
| 3 | `logicAnalyzer.startCapture` | — | ⛔ **not_exercised** | 依赖已连接设备；且 `getCaptureConfiguration()` 走 `showInputBox` |
| 4 | `logicAnalyzer.stopCapture` | `commands-coverage` | ✅ pass（接线存活） | 未连接设备时立即返回；**行为层**未验 |
| 5 | `logicAnalyzer.repeatCapture` | — | ⛔ **not_exercised** | 依赖 `lastCaptureConfig`（需先成功采集一次） |
| 6 | `logicAnalyzer.scanNetworkDevices` | `network-scan` | ✅ **pass**（BUG-1 已修） | 修复后：`scanTimeoutMs=1200 → 1202ms`、`=5000 → 5004ms`，配置精确生效；`stats.probedIps=63/254, aborted=true` |
| 7 | `logicAnalyzer.networkDiagnostics` | — | ⛔ **not_exercised** | 依赖网络扫描成功（扫描已修，但诊断本身未验） |
| 8 | `logicAnalyzer.configureWiFi` | — | ⛔ **not_exercised** | `await showInputBox` ⇒ 永不 resolve |
| 9 | `logicAnalyzer.createSyntheticCapture` | `create-synthetic-capture` | ✅ **pass** | 参数化入口（`targetUri`）；样本 2048 位含 0/1 |

**接线层**：9 条命令全部被 `commands-coverage` 双向对账覆盖
（manifest 声明 ↔ 实际注册）。
变异验证：改错一个命令 id → `declared-commands-registered`、`no-shadow-commands`、
`wiring-alive-*` 三条同时红，而 `extension-activates` 仍 pass。

---

## 二、Webview UI 面（新增，5 个场景）

> 这一层补的是「面板里到底画了什么、点了有没有反应」——
> 命令层 e2e 只验到「tab 的 viewType 正确」，验不到面板内部。

| # | UI 区域 | 覆盖场景 | 状态 | 判据 | 变异验证 |
|---|---|---|---|---|---|
| 1 | 波形渲染 | `ui-waveform` | ✅ **pass** | **L1** `[data-testid=waveform-state]` 不存在（无错误态）<br>**L2** `.waveform-stage__meta` 的 `N samples` === 文档实际样本数（4）<br>**L3** canvas 结构性统计：`colorVariety>=5` 且 `dominantColorRatio<0.95`（实测 696×348, colors=174, dominant=47.5%） | **A** `totalSamples→0` ⇒ 只有 L2 红<br>**B** `render()` 空函数 ⇒ 只有 L3 红（`60552/60552` 全透明）<br>**C** 强制错误态文案 ⇒ 只有 L1 红 |
| 2 | 采集通道配置 | `ui-channel-config` | ✅ **pass** | 初始 8 通道 → CH1 重命名为 `SPI_CLK` → 全不选（行数 0）→ 反选恢复（8 行且名字保持） | **C** `selectedChannelRows` 去掉 filter ⇒ **只有** `clear-rows` 红<br>**D** `invertChannels` 置空 ⇒ **只有** `invert-restore` 红 |
| 3 | 触发设置 | `ui-trigger-config` | ✅ **pass** | Edge 默认（Pattern 隐藏、反相关）→ Fast（Pattern 出现、可输入 42）→ 反相开关 → Blast（频率强锁 100MHz、Pre=0、Loop Count 挂载）→ 切回 Edge（全部复位） | **B** `v-if="false"` ⇒ 只有 `fast-reveals-pattern` 红<br>**C** switch 改 `:model-value` ⇒ 只有 `inverted-toggled` 红<br>**D** 注释掉 `frequency` 强锁 ⇒ **只有** `blast-constraints` 红 |
| 4 | 导出按钮 | `ui-export-button` | ⛔ **blocked** | **L1** 无数据时 `.is-disabled=1`<br>**L2** 有数据时 `.is-disabled=0`<br>**L3** 点击后捕获 `{type:'hostCommand', command:'exportData'}`<br>**L4** `payload.format==='csv'` 且 `selectedChannels` 非空 | **B** `canExportData` 恒 true ⇒ 只有 L1 红<br>**C 删 `@click`** ⇒ **只有 L3/L4 红**（王牌：L1/L2 抓不到"按钮有样式但没接线"）<br>**D** `'csv'→'json'` ⇒ 只有 L4 红 |
| 5 | 协议解码 | `ui-decoder` | ✅ **pass** | **L1** 解码前 `table=1, rows=0, summary=0`<br>**L2** I2C 引脚自动配对，按钮可用<br>**L3** 解码后 `rows=23, summary=23`<br>**L4** 首行含 `Start`（实测 `"6-60StartStart / S"`） | **D** `resultRows` 改 `slice(0,1)` ⇒ **只有 L3 红，L4 仍 pass**（证明两判据互不隶属） |

### `ui-export-button` 为什么是 `blocked` 而不是 `pass`

**L1-L4 全部 pass**，但**落盘那一步验不了**：

```
点击导出 → webview 发 hostCommand:exportData
        → 宿主 LACEditorProvider.exportData()
        → await vscode.window.showSaveDialog(options)   ← 真宿主永不 resolve
```

`showSaveDialog` 在 `ExtensionMode.Test` 下永不返回（README §5.1 实测），
所以**文件落盘无法自动化验证**。

**承接方**：
- CLI `logic-analyzer-capture export`（commit `5d9d0a90`）
- `DataExportService` 单测

⇒ 这是**显式登记的边界**，不是遗漏。

---

## 三、能力面（非命令、非 UI）

| 能力 | 入口 | 状态 | 说明 |
|---|---|---|---|
| `.lac` 格式：写 | `openAnalyzer` | ✅ pass | 1381 字节，`frequency=1000000`，8 通道 |
| `.lac` 格式：读（PascalCase） | custom editor | ✅ pass | `Settings` + `CaptureChannels` |
| `.lac` 格式：读（小写 settings） | custom editor | ✅ pass | **BUG 修复**（commit `332847fa`）。缺该分支时 UI 显示「当前文件只有采集设置」 |
| Signal DSL → 合成采集 | `createSyntheticCapture` | ✅ pass | 141 字符 DSL → 3147 字节 `.lac`，2048 位样本 |
| 数据导出（CSV/JSON/VCD） | CLI `export` + webview 按钮 | ⚠️ **部分** | CLI 路径 ✅（BUG-2 用 CLI 解决）；webview 落盘 ⛔ blocked |
| 协议解码（I2C） | webview `hostCommand: runDecoder` | ✅ **pass** | 真实 164 样本 → 23 帧（`Start` / `Address write: 50` / `ACK` / `Data write: 3C` / `ACK` / `Stop`） |
| 协议解码（SPI/UART/CAN/LIN/I2S） | 同上 | ⛔ not_exercised | 无对应 fixture，未验 |
| 波形渲染（canvas 像素） | webview | ✅ pass | colorVariety=174，主导色 47.5% |
| 真机采集 | `connectDevice` → `startCapture` | ⛔ **not_exercised** | 本机 Pico 未烧固件（用户裁定暂不烧）。见 `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` |
| 真机解码 | 同上 | ⛔ not_exercised | 依赖上一条 |
| 网络设备自动发现 | `scanNetworkDevices` | ⚠️ **部分** | 扫描本身 ✅；**真发现设备** ⛔（BUG-3：UDP 广播对固件无效） |
| WiFi 配置 | `configureWiFi` | ⛔ not_exercised | `showInputBox` 挂死 |

---

## 四、选一个界面怎么驱动（给后人）

UI 场景不是"点一下就行"，它依赖一座桥。取舍记录：

| 方案 | 结论 | 原因 |
|---|---|---|
| 宿主侧直接读 webview DOM | ❌ **做不到** | `vscode.Tab.input` 只有 `{uri, viewType}`，`input.webview === undefined`，原型上只有 `constructor` |
| 给产品加 `data-testid` | ❌ **否决** | 会永久进入用户 DOM；为测试改产品 |
| `:has()` CSS 选择器定位 form-item | ❌ **不可用** | 实测 Chromium 102（Electron 19）报 `is not a valid selector`；`:has()` 是 105+ |
| `nth-child` 定位 | ❌ **脆弱** | 表单顺序稍变就断 |
| **`formItem:"<label>"` 语义选择器** | ✅ **采用** | 执行器侧实现，零产品改动。引号必填，无引号 fail-closed 抛错 |

### 已知坑（都踩过）

| 坑 | 表现 | 处理 |
|---|---|---|
| `<input>` 的 `textContent` 恒空 | `readText` 读不到输入框的值 | 用 `readValue` / `readValueOptional`（**不给 `readText` 加隐式重载**） |
| `querySelector` 只返回第一个 | 测不到"所有行都不在" | 用 `countElements`（`querySelectorAll().length`） |
| 动态 `:data-testid` | grep 静态字面量搜不到 | 搜变量名或模板结构 |
| `window.vscode` 是冻结对象 | 直接改 `postMessage` 抛 `TypeError` | 整体替换 `window.vscode` 引用，`finally` 还原 |
| 动作序列中途挂起 | 异常红在 `scenario-executes`，**断言没机会跑** | 用 `sleep` + `countElements` + `readValueOptional`，让红落在真断言上 |
| 原生弹窗永不 resolve | 命令永久挂起 | 产品加参数化入口，或判 `blocked` |

---

## 五、明确没做的（附理由）

| 没做 | 理由 |
|---|---|
| 真机采集/解码 e2e | 固件**可构建**（RP2040 UF2 85KB，已证），但**烧录待用户授权**（2026-11-03 裁定「先不烧」）。台账见 `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` |
| 导出落盘 e2e | `showSaveDialog` 在真宿主永不 resolve（结构性限制） |
| SPI/UART/CAN/LIN/I2S 解码 e2e | 无对应 fixture；I2C 已覆盖，其余等有数据再加 |
| 采样率/缓冲区配置 UI | 边际收益递减（核心交互已覆盖）；未排期 |
| 网络自动发现（真设备） | BUG-3：固件零 UDP 4046 监听 ⇒ 广播发现对官方固件无效 |

---

## 六、状态来源（可复核）

每个场景的状态都能用命令复现：

```sh
# 单场景
xvfb-run -a node tests/e2e/vscode/lib/runner.cjs --scenario ui-decoder

# 全量（9 场景，约 3 分钟）
xvfb-run -a node tests/e2e/vscode/lib/runner.cjs

# 结果 JSON
cat tests/e2e/vscode/artifacts/latest/summary.json
```
