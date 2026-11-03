# 真宿主 e2e 覆盖矩阵（2026-11-03）

> 对应代码：`tests/e2e/vscode/`。
> **本表只登记已实跑验证过的状态**，猜的一律标 `待验`。

## 一、命令面（`package.json` 声明 9 条）

| # | 命令 | 覆盖场景 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | `logicAnalyzer.openAnalyzer` | `open-analyzer` | ✅ **pass** | 真落盘 `.lac` + custom editor 真拉起（`viewType=logicAnalyzer.lacEditor`）；两条变异验证过 |
| 2 | `logicAnalyzer.connectDevice` | — | ⛔ **not_exercised** | 无设备时 `await showWarningMessage` 在真宿主永不 resolve；有设备时 `await showQuickPick` 同样挂死 |
| 3 | `logicAnalyzer.startCapture` | — | ⛔ **not_exercised** | 依赖已连接设备；且 `getCaptureConfiguration()` 走 `showInputBox` |
| 4 | `logicAnalyzer.stopCapture` | `commands-coverage` | ✅ pass（接线存活） | 未连接设备时立即返回；**行为层**未验 |
| 5 | `logicAnalyzer.repeatCapture` | — | ⛔ **not_exercised** | 依赖 `lastCaptureConfig`（需先成功采集一次） |
| 6 | `logicAnalyzer.scanNetworkDevices` | `network-scan` | ❌ **fail** | **产品缺陷 BUG-1**：25s 未完成。见 `e2e-found-product-bugs-2026-11-03.md` |
| 7 | `logicAnalyzer.networkDiagnostics` | — | ⛔ **not_exercised** | 同 BUG-1 的扫描耗时问题 |
| 8 | `logicAnalyzer.configureWiFi` | — | ⛔ **not_exercised** | `await showInputBox` ⇒ 永不 resolve |
| 9 | `logicAnalyzer.createSyntheticCapture` | `create-synthetic-capture` | ✅ **pass** | 参数化入口（`targetUri`，用户 2026-11-03 裁定）；样本 2048 位含 0/1；变异验证过 |

**接线层**：9 条命令**全部**被 `commands-coverage` 双向对账覆盖
（manifest 声明 ↔ 实际注册，变异验证：改错一个命令 id → 三条 oracle 同时红）。

## 二、能力面（非命令入口）

| 能力 | 入口 | 状态 | 说明 |
|---|---|---|---|
| `.lac` 文件格式：写 | `openAnalyzer` | ✅ pass | 1381 字节，`frequency=1000000`，8 通道 |
| `.lac` 文件格式：读 | `openAnalyzer` → custom editor | ✅ pass | 解析出 `Settings` + `captureChannels` |
| Signal DSL → 合成采集 | `createSyntheticCapture` | ✅ pass | 141 字符 DSL → 3147 字节 `.lac`，2048 位样本 |
| 数据导出（CSV/JSON/VCD） | **webview 按钮** | ⛔ **not_exercised** | 无命令入口（**BUG-2**）；且内部 `await showSaveDialog` |
| 协议解码（I2C/SPI/UART） | **webview `hostCommand: runDecoder`** | ⛔ **not_exercised** | 只能从 webview 内部触发，宿主侧拿不到 `postMessage` 句柄 |
| 波形渲染 | webview canvas | ⛔ **not_exercised** | 同上；且需 DOM 驱动 |
| 真机采集 | `connectDevice` → `startCapture` | ⛔ **not_exercised** | 本机 Pico 未烧逻辑分析器固件（用户裁定暂不烧）。见 `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` |
| 真机解码 | 同上 | ⛔ **not_exercised** | 依赖上一条 |
| 网络设备发现 | `scanNetworkDevices` | ❌ **fail** | BUG-1 |
| 网络诊断 | `networkDiagnostics` | ⛔ **not_exercised** | 依赖扫描 |
| WiFi 配置 | `configureWiFi` | ⛔ **not_exercised** | `showInputBox` 挂死 |

## 三、为什么 `not_exercised` 这么多（不是偷懒，是三个真约束）

### 约束 1：原生弹窗在真宿主永不 resolve（已实测）

| API | 行为 |
|---|---|
| `showInformationMessage` / `showWarningMessage` / `showErrorMessage`（含带按钮） | 永不 resolve |
| 同上 + `{ modal: true }` | 同步抛 `DialogService: refused to show dialog in tests.` |
| `showSaveDialog` / `showOpenDialog` / `showInputBox` / `showQuickPick` | 永不 resolve |
| `withProgress` | ✅ 正常 |

⇒ **凡 `await` 弹窗的命令，裸 `executeCommand` 会挂死。**

**已解**：`createSyntheticCapture` 加了 `targetUri`（用户裁定）。
**未解**：`connectDevice` / `startCapture` / `configureWiFi` / `exportData` / `scanNetworkDevices`（有设备分支）
—— 都需要**同类参数化入口**，属于产品改动，需逐个决定。

### 约束 2：webview 内部不可达（已实测）

宿主侧拿不到 webview 的 `postMessage` 句柄：
- `tabGroups` 里的 CustomEditor tab 只有 `{ viewType, uri }`
- `ext.exports` 是 `undefined`（`activate()` 没有 return）
- `vscode.commands.getCommands()` 里没有 webview 相关内部命令

⇒ 第二层（webview 内部点击/输入/画布）需要**产品侧正式测试入口**，绕不过去。
venus-studio 的 `venusStudio.__runEditorScenario` 就是那种入口（我们没照抄，需用户裁定）。

### 约束 3：真机硬件未授权写板

固件**可构建**（已实测，见台账），但**未烧录**（用户 2026-11-03 裁定「先不烧」）。

## 四、下一步优先级（串行）

| 顺序 | 任务 | 状态 |
|---|---|---|
| 1 | **T-BUG-1** 修网络扫描（并发死代码 + 配置被忽略 + 有设备挂死） | ✅ **已收口**（2026-11-03） |
| 2 | T-BUG-2 评估数据导出命令入口 | 待用户裁定「该不该做」 |
| 3 | e2e 场景补齐（依赖 2 的裁定） | 待 |
| 4 | webview 桥（需用户裁定产品侧测试入口） | 待裁定 |
| 5 | 真机 e2e（需用户授权写板，固件已证可构建） | 待裁定 |

### T-BUG-1 的验收证据（留存）

3 条 oracle + 4 条变异，均由主线程独立复现：

| 验证 | 方式 | 结果 |
|---|---|---|
| 总超时熔断 | 变异：删 `abort()` | ✅ 红（10009ms） |
| 配置生效 | 变异：硬编码 5000 | ✅ 红（两次差 1ms） |
| stats 可观测 | 变异：字段改名 | ✅ 红（报缺失） |
| BUG-4 字段映射 | 变异：删兼容分支 | ✅ 红（单测 1 failed） |
| 单测 | `jest …WiFiDeviceDiscovery…` | ✅ 35/35 |
| e2e | `--scenario network-scan` | ✅ 3 条 pass |
