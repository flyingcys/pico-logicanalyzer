# 待裁定事项汇总（2026-11-03）

> 本期（测试归拢 + 真宿主 e2e + UI 覆盖）收口时，**需要用户决策**的事项都列在这里。
> 每条都给出可核实的依据、影响面、和我的建议。**不做的事也留痕**。

---

## 一、产品缺陷（3 条）

### D-1：BUG-3 —— UDP 广播发现对官方固件无效

| 字段 | 内容 |
|---|---|
| 文档 | `docs/e2e-found-product-bugs-2026-11-03.md` BUG-3 |
| 严重度 | Important |
| 现状 | 插件向 UDP 4046 发广播，**固件零监听实现**（`grep -rn "4046" logicanalyzer/Firmware/` 无命中） |
| 影响面（实测） | 用户用**默认端口 4045** 配置时，TCP 扫描能命中（4045 在 `defaultPorts` 里）<br>用户**手动改了端口** ⇒ 扫不到，插件也不记住改成什么<br>不知道 IP 时 ⇒ 只能靠扫 4 个网段 × 254 IP |

**四个方案**：

| 方案 | 成本 | 效果 |
|---|---|---|
| A. 固件补 UDP 4046 监听 + 回应 | **高**（改固件 + 用户刷机） | 彻底解决，业界标准 |
| B. 固件把监听端口**固定**为 4045 并文档化 | 中 | 扫描能命中，但限制用户改端口 |
| C. 插件记住"上次连接过的端口" | **低**（纯插件） | 缓解手输，解决不了首次发现 |
| D. 文档化"WiFi 需手输 IP:端口" | **最低** | 诚实但不解决 |

**我的建议**：**C + D**。理由：影响面已收窄到「改了端口的用户」，
A/B 都要改固件（成本高且当前用户裁定不烧固件）。

⚠️ 但这是**产品决策**，需要你定。

---

### D-2：BUG-2 的残留 —— webview 导出落盘无法自动化

| 字段 | 内容 |
|---|---|
| 现状 | CLI `export` 子命令已解决**批量/脚本**导出（commit `5d9d0a90`）<br>但**webview 按钮的落盘**仍不可自动化 |
| 原因 | `await vscode.window.showSaveDialog` 在真宿主永不 resolve |
| 影响 | `ui-export-button` 场景判 `blocked`（L1-L4 全 pass，只有落盘这一步） |

**方案**：

| 方案 | 代价 |
|---|---|
| A. 接受现状（落盘由 CLI + 单测覆盖） | 零成本，但 webview 落盘永远无 e2e |
| B. 给 `exportData` 加 `targetUri` 参数化入口 | 低（同 `createSyntheticCapture` 模式），但要让 webview 传参 |
| C. 给测试加"可注入的弹窗替身" | ❌ **我反对**：那是伪造产品响应（假绿） |

**我的建议**：**A（现状）**。webview 落盘的代码路径与 CLI 是同一个
`DataExportService.exportWaveformData`，已被单测覆盖。加参数化入口的收益 < 成本。

---

### D-3：OUT-1 —— `Extension.coverage.test.ts` 的 Promise 泄漏 —— ✅ **已修复（T1）**

| 字段 | 内容 |
|---|---|
| 严重度 | Important（让整个文件/目录都跑不了） |
| 引入方 | **既有**（commit `b691af54`，非本轮） |
| 修复 | `sendError` 声明式 reject + 契约断言对齐 + mock 哨兵值 + 配置节白名单 |
| 验收 | `npx jest tests/unit --silent` → **93 suites / 2528 tests 全过** |

**修复过程中连带曝光了 3 条被崩溃掩盖的既有缺陷**（契约漂移 / mock 取值架空判据 /
配置节名无校验），全部已修并做了 5 条变异验证（A-E 全部抓红）。
详见 `docs/e2e-found-product-bugs-2026-11-03.md` OUT-1。

> ⚠️ 我在这条上犯过一个错并已更正：早期写「单文件跑正常」，实际 HEAD 原版
> **单文件也崩**。更正记录连同实测命令一起留在 OUT-1 里。

---

### D-7：`package.json` 声明了 4 个网络配置，此前产品从未读取（**已解决**）

> **状态：✅ 已解决（2026-11-04，T8 阶段）**
> - **3 项有功能未接线配置**：`heartbeatIntervalMs`、`connectionTimeoutMs`、`enableAutoReconnect` 已通过纯映射函数 `resolveNetworkStabilityConfig` 显式接线到 `NetworkStabilityService`（在 `extension.ts` 与 `LACEditorProvider.ts` 两处创建点均完成接线，并由单测与变异严格锁定）；
> - **1 项无实现虚假声明**：`enableAutoDiscovery` 全仓 0 引用且底层无自动轮询机制，经用户裁定已从 `package.json` 与 `docs/network-features.md` 彻底移除。

| 字段 | 内容 |
|---|---|
| 严重度 | Important |
| 发现时间 | 2026-11-03（T1 排查配置读取路径时） |
| 解决时间 | 2026-11-04 |

**修复记录**：
1. `src/services/NetworkStabilityService.ts`：导出 `resolveNetworkStabilityConfig` 显式字段映射纯函数，新增 `getCurrentConfig()` 只读快照接口；
2. `src/extension.ts`：在 `activate` 构造 `networkStabilityService` 时传入解析的工作区配置；
3. `src/providers/LACEditorProvider.ts`：在 `getNetworkStabilityService` 构造实例时同步传入解析的工作区配置；
4. `package.json` & `docs/network-features.md`：移除虚假承诺的 `logicAnalyzer.network.enableAutoDiscovery` 声明。

---

### D-8：20 个测试垃圾文件**已被提交进仓库**，要不要 `git rm --cached`

| 字段 | 内容 |
|---|---|
| 严重度 | Minor（不影响功能，但污染仓库、会干扰 `git status`） |
| 发现时间 | 2026-11-03（修 `/tmp` 泄漏门禁时） |

```sh
$ git ls-files .recovery-checkpoints/ | wc -l
20
$ git log --oneline -3 -- .recovery-checkpoints/
c2674d80 数据可以通过 cli 采集，但是 ui 上没有正常显示      ← 2026-08-02
020c5bb1 优化单元测试                                     ← 2026-07-23
8b256fea fix: 修复严格类型检查错误并清理 husky v9 钩子...   ← 2026-07-22
```

**来源**：`RecoveryManager` 默认把检查点写进 `process.cwd()/.recovery-checkpoints`
且从不删（`cleanup()` 里那行是注释掉的）。历史上 2 次提交把它们带进了仓库。

**现状**：
- 产生侧**已修**（默认目录改到 `os.tmpdir()` 下按实例隔离 + `cleanup()` 真的删）
- 但**这 20 个历史文件还在 git 里**，每次跑测试都会与它们混在一起

**方案**：

| 方案 | 命令 | 影响 |
|---|---|---|
| A. `git rm --cached` 并从历史移除 | `git rm -r --cached .recovery-checkpoints/` + 加 `.gitignore` | 干净，但**是一次删除提交** |
| B. 只加 `.gitignore`，保留已跟踪的 | 改 `.gitignore` | 新文件不再进来，但旧的还在 |
| C. 不动 | — | 保持现状 |

**我的建议**：**A**。理由：这些文件没有任何价值（是运行产物），且已被 2 次误提交。
⚠️ 但它是**破坏性操作**（删已跟踪文件），我不擅自做 —— **需要你确认**。

---

### D-9：网络驱动发 JSON 文本，固件只认二进制帧 —— **WiFi 采集路径从未真正工作过**

> **状态：✅ 已修（2026-11-04，C′ 阶段）** —— 网络设备已改指向 `LogicAnalyzerDriver`。
>
> ⚠️ **与用户最初裁定的差异**：用户当时选「完整执行 C」（删除旧类）。
> 我方核查后发现旧类另有 UDP/WebSocket/HTTP 与 4 种 DataFormat 能力，
> **删除会丢能力**，故按对端预案降级为 C′：**保留类（`@deprecated`）+ 只改接线 + 测试 `skip`**。
> 对端复核后同意。
>
> ⚠️ **P2 仍未做**：`LogicAnalyzerDriver.sendNetworkConfig` 在网络模式仍直接 `return false`，
> 导致 `logicAnalyzer.configureWiFi` 对网络设备无效。单列为 **D-10**。

| 字段 | 内容 |
|---|---|
| 严重度 | **Critical**（修复前 `NetworkLogicAnalyzerDriver` 全路径不可用：连接阶段即失败） |
| 发现方式 | 协议级模拟设备 e2e（`network-capture-mock` 场景，2026-11-03） |
| 影响面 | **仅限 `NetworkLogicAnalyzerDriver` 这个类**；串口路径与 `LogicAnalyzerDriver` 的 TCP 分支均正常（已实测） |

#### 现象（e2e 实测原始输出）

```
❌ network-capture-mock → overall=fail
  ✅ mock-device-started — 监听 127.0.0.1:44343（协议：固件二进制帧）
  ✅ mock-device-speaks-firmware-protocol — 正确帧得到 5 行应答（首行 LOGIC_ANALYZER_V2_1.7.0）
  ✅ product-discovers-mock — 产品握手成功：版本 LOGIC_ANALYZER_V2_1.7.0
  ✅ handshake-content-matches — verificationStatus=confirmed
  ❌ driver-connects — 连接失败：网络命令超时 —— 产品 NetworkLogicAnalyzerDriver
                      在握手阶段发 JSON 文本，真固件协议（0x55 0xAA 二进制帧）丢弃无应答
  ❌ device-received-capture-frame — 设备未收到任何合法帧；期间丢弃 120 字节
  ⚠️ driver-start-capture-outcome — 因 connect() 握手失败，未执行 startCapture
  ✅ tcp-handshake-via-firmware-protocol — LogicAnalyzerDriver 用二进制帧握手成功
  ✅ tcp-capture-completes — TCP 采集完成，通道样本总数 96（期望 96）
  ✅ tcp-capture-sample-content — CH0 非零样本 36/48
```

#### 根因：两条驱动走了两套协议

| 位置 | 发送内容 | 固件能否识别 |
|---|---|---|
| `src/drivers/LogicAnalyzerDriver.ts:182-187`（串口/网络通用） | `new OutputPacket().addByte(1).addStruct(req).serialize()` → **二进制帧** | ✅ 能 |
| `src/drivers/NetworkLogicAnalyzerDriver.ts:701` `sendNetworkCommand` | `JSON.stringify(command)` + `'\n'` → **JSON 文本** | ❌ 不能 |
| `src/services/WiFiDeviceDiscovery.ts:580-584` `verifyPicoDevice` | `new OutputPacket().addByte(0).serialize()` → **二进制帧** | ✅ 能 |

固件侧判定（`logicanalyzer/Firmware/LogicAnalyzer_V2/LogicAnalyzer.c:212-216`）：
```c
//If we have stored the first byte and it is not 0x55 restart reception
if(bufferPos == 1 && messageBuffer[0] != 0x55)
    bufferPos = 0;
else if(bufferPos == 2 && messageBuffer[1] != 0xAA)
    bufferPos = 0;
```
⇒ 首字节是 `{`（JSON）时**直接丢弃**，永不应答。

这解释了为什么「能发现设备（走的 `verifyPicoDevice` 用正确协议）、但连不上设备（走的
`NetworkLogicAnalyzerDriver` 用 JSON）」这一看似矛盾的现象。

#### 真采集链路（用 `LogicAnalyzerDriver` 走 TCP）—— **是通的**

```
✅ tcp-handshake-via-firmware-protocol — LogicAnalyzerDriver 用二进制帧握手成功（version=LOGIC_ANALYZER_V2_1.7.0, channels=24）
✅ tcp-capture-completes — TCP 采集完成，通道样本总数 96（期望 96）
✅ tcp-capture-sample-content — CH0 非零样本 36/48（设备发的是可辨识方波图案）
```

⇒ **D-9 的缺陷范围被精确锁定在 `NetworkLogicAnalyzerDriver` 这一个类里**，
不是"TCP 不能采集"，也不是"协议设计有问题"。
`LogicAnalyzerDriver` 的网络分支（`LogicAnalyzerDriver.ts:87` 按连接串含 `:` 判定）
握手 + 采集 + 样本解析全部正常。

#### 变异与对照证据

| 实验 | 结果 |
|---|---|
| 模拟器收到正确二进制帧 | 自测 11/11 通过；`refreshDevice` 握手成功 |
| 模拟器收到 JSON | 丢弃 120 字节，零应答（与真固件 `LogicAnalyzer.c:212` 行为一致） |
| 模拟器 ID 应答改成 `LOGIC_ANALYZER_V1_0`（major 相同、minor=0 < 7） | `product-discovers-mock` **红** |
| 模拟器 ID 应答改成 `LOGIC_ANALYZER_V2_1.0`（major=2 > 1） | `product-discovers-mock` **仍 pass** —— 见下方说明 |
| 模拟器 `extractFrames` 去掉 `0xAA 0x55` 结束标记检查 | 自测第 2 条**红** |
| 模拟器样本改全 0 | `tcp-capture-sample-content` **红**（`tcp-capture-completes` 仍 pass） |
| 把 `server.close()` 改回不断开活动连接 | 自测第 10 条**红**（`timeout != closed`） |

⚠️ **`V2_1.0` 不红是产品的真实行为**，不是判据缺陷：
`VersionValidator.ts:66` 的判定是
```ts
const isValid = (major > MAJOR_VERSION) ||
                (major === MAJOR_VERSION && minor >= MINOR_VERSION);
```
`MAJOR_VERSION=1`，所以 `V2_x` 走第一条分支**直接判有效，完全跳过 minor 检查**。
⇒ 只有 `V1_0`（major 相同、minor 不足）才会被拒。这本身值得记录：
**版本校验是"major 更高就无条件放行"，不是语义化版本的严格比较。**

#### 修复方案（已执行 C′）

| 方案 | 做法 | 成本 | 风险 |
|---|---|---|---|
| A | `NetworkLogicAnalyzerDriver` 整体改用 `OutputPacket` 二进制帧 | 中（约 200-300 行改写 + 单测） | 中（该驱动还有 UDP/WebSocket 分支与"认证/协议类型"等自成体系的概念，需一并梳理） |
| B | 让固件同时支持 JSON | 高 | 高（固件侧改动、需重烧、破坏向后兼容） |
| **C（用户原选）** | 删除 `NetworkLogicAnalyzerDriver`，网络路径直接用 `LogicAnalyzerDriver` | 低 | 低，但**会丢失 UDP/WebSocket/HTTP + 4 种 DataFormat 能力** |
| **C′（实际执行）** | 同 C，但**保留旧类**（`@deprecated`）+ 单测 `describe.skip` | 低 | 低 —— 能力与测例资产都保住，接线已改 |

**为什么降级为 C′**：核查发现 `NetworkLogicAnalyzerDriver` 另有
UDP / WebSocket / HTTP 协议与 JSON/CSV/RAW/BINARY 4 种 DataFormat 解析器，
产品路径**无调用方**，但属于驱动 SDK 层可复用资产。删除不可逆，
`@deprecated` + `skip` 成本一样低且可逆。

#### 执行记录（C′ 阶段，2026-11-04）

| 文件 | 改了什么 |
|---|---|
| `src/drivers/HardwareDriverManager.ts` | `network-analyzer` 的 `driverClass` → `LogicAnalyzerDriver`；删除 `createDriverInstance` 里 `NetworkLogicAnalyzerDriver` 的 host/port 拆分分支；移除该 import。**注释写的是设计理由**（网络与串口共用同一套协议），不是"替换有问题的驱动" |
| `src/drivers/NetworkLogicAnalyzerDriver.ts` | 保留文件，加 `@deprecated` 文件头（含 D-9 依据与"为什么保留"） |
| `tests/unit/drivers/NetworkLogicAnalyzerDriver.{simple,business,comprehensive}.test.ts` | 顶层 `describe` → `describe.skip`，文件头注明理由 |
| `tests/unit/drivers/HardwareDriverManager.{comprehensive,business}.test.ts` | 3 条断言旧契约的用例改为断言新契约；**并新增反向断言** `expect(NetworkLogicAnalyzerDriver).not.toHaveBeenCalled()` —— 防将来被改回去 |
| `.gitignore` | 加 `logicanalyzer/`（固件仓库副本，约 2.5G；本地必须保留以作为协议真值，但不入库） |
| `tests/e2e/vscode/scenarios/common/network-capture-mock.scenario.cjs` | **改为走产品驱动选择链路** `hardwareDriverManager.connectToDevice('network', …)`，不再自己 `new` 某个驱动类（否则绕过被测层 = 判据失效）；新增 oracle `network-uses-shared-protocol-driver` 锁死"网络必须解析成 `LogicAnalyzerDriver`" |

#### 验证（C′ 阶段）

```
network-capture-mock：12 条 oracle 全 pass（此前 6✅/2❌/1⚠️）
  ✅ driver-connects — driver=LogicAnalyzerDriver
  ✅ network-uses-shared-protocol-driver
  ✅ device-received-capture-frame — 设备收到 CAPTURE_REQUEST 帧（命令字节 1）
  ✅ driver-start-capture-outcome — CaptureError.None

全量 e2e：EXIT=3（10 场景：6 pass / 2 not_exercised / 1 blocked / 0 fail）
  ↑ 由 1 降到 3 —— 因为唯一的 fail（本场景）已转绿

全量单测：90 套件通过 / 3 套件 skip（107 用例 skip）/ 2421 通过 / 总计 2528
门禁：✅ 无泄漏
```

**变异验证**（把接线改回旧类 + 恢复 host/port 拆分分支）：
```
❌ driver-connects — 连接失败：网络命令超时 —— 产品网络设备驱动未按固件协议握手
❌ device-received-capture-frame — 设备未收到任何合法帧；期间丢弃 120 字节
⚠️ driver-start-capture-outcome — 因 connectToDevice 握手失败，未执行 startCapture
```
⇒ 判据与缺陷的因果关系成立。

⚠️ **仍需真机验证**（当前固件未烧，见 D-4）。模拟器只能证明协议对齐，不能替代真机。

---

### D-10：`LogicAnalyzerDriver.sendNetworkConfig` 在网络模式直接返回 false —— `configureWiFi` 对网络设备无效

> **状态：✅ 已修（2026-11-04，commit `afa3fff4`）** —— 移除 `this._isNetwork` 短路，网络与串口共用同一套 0x02 配置帧。单测已补充网络模式发送断言与变异验证。

| 字段 | 内容 |
|---|---|
| 严重度 | Important |
| 来源 | D-9 修复（C′）时的能力核查 |
| 状态 | ✅ **已修**（2026-11-04） |

```ts
// src/drivers/LogicAnalyzerDriver.ts:310-313（修复前）
override async sendNetworkConfig(...): Promise<boolean> {
  // 对于网络设备，不需要配置网络   ← 这个前提是错的
  if (this._isNetwork) {
    return false;
  }
```

**为什么这个前提错**：`configureWiFi` 的真实用法是 ——
**设备插在 USB 上，用户告诉它"连哪个 SSID、连上后用哪个 IP"，然后拔掉 USB 走无线。**
即使是已走网络连接的设备，重新配置 WiFi 也是合理运维动作。此前写法把网络模式短路为 `false`，
导致 `logicAnalyzer.configureWiFi` 在网络设备上一律报"WiFi配置发送失败"。

**固件侧是支持的**：`LogicAnalyzer.c:310-342` 的 `case 2` 完整处理
`WIFI_SETTINGS_REQUEST`（33 字节 SSID + 64 字节密码 + 16 字节 IP + 2 字节端口），
回 `SETTINGS_SAVED`。

**修复记录**：
1. `src/drivers/LogicAnalyzerDriver.ts`：移除 `if (this._isNetwork) return false;` 短路；
2. `tests/unit/drivers/LogicAnalyzerDriver.test.ts`：新增用例验证网络模式（`_isNetwork=true`）下同样组装并发送 0x02 二进制配置包；
3. 变异验证：将短路恢复，网络模式测试用例确凿报红。

---

### D-11：Webview 侧栏「扫描网络」硬编码 `timeoutMs: 5000`，不遵从 `logicAnalyzer.network.scanTimeoutMs` 工作区配置

| 字段 | 内容 |
|---|---|
| 严重度 | Important（**配置被前端硬编码吞掉，双入口行为分裂**） |
| 发现方式 | 真实探针对照 `_probe-sidebar-scan-config`（2026-11-04） |
| 涉及文件 | `src/frontend/app/components/AppSidebarLeft.vue:127`<br>`src/providers/LACEditorProvider.ts:877` |
| 对应 e2e 判据 | `network-scan` 场景的 `sidebar-scan-honors-config`（当前 **fail**，真实红） |

#### 现状与根因
- **前端硬编码**：`AppSidebarLeft.vue:127` 点击「扫描网络」时调用 `captureCommands.scanNetworkDevices({ timeoutMs: 5000 })`，直接把 5000ms 写死在代码中。
- **宿主零合并**：`LACEditorProvider.ts:877` 收到 `scanNetworkDevices` / `scanForDevices` 的 hostCommand 时，直接把 payload 透传给 `WiFiDeviceDiscovery.scanForDevices(payload)`，完全没有读取 `vscode.workspace.getConfiguration('logicAnalyzer.network').get('scanTimeoutMs')` 进行兜底或合并。
- **对照差异**：命令面板入口 `logicAnalyzer.scanNetworkDevices`（`extension.ts:300-302`）正确读取了工作区配置并在 1200ms 下耗时 ~1230ms；而侧边栏入口在 1200ms 配置下仍固定跑 5000ms，发出的 postMessage payload 锁定为 `{"timeoutMs": 5000}`。

#### 影响面
用户在 VS Code 设置中修改 `scanTimeoutMs` 后，在 UI 侧边栏点击扫描网络时完全不生效，配置形同虚设。

#### 方案对比

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| A. 宿主侧无条件覆盖 | `LACEditorProvider.ts` 收到扫描 hostCommand 时，直接用工作区配置强制覆写 `payload.timeoutMs` | 纯宿主层改动，不依赖 Webview 重新打包 | ❌ **有严重副作用**（见下方副作用评估）：踩死调用方显式传参的意图 |
| B. 仅前端 Webview 改动 | Webview 侧栏从写死 5000 改为从宿主拉取配置并传递 | 宿主保持纯透传 | 需重新打包 Webview；两端配置动态同步成本高 |
| **A+B. 缺省兜底协同（推荐）** | **前端不传硬编码值（传 `{}`），宿主实现配置缺省兜底** | ✅ 完美兼容：侧栏遵从配置，同时保留调用方显式自定义参数的能力 | 需要改动两端（但契约最干净） |

#### ⚠️ 方案 A 的语义变化与副作用评估（重点）

`LACEditorProvider.ts:876` 目前是将 Webview 发来的 `payload` 原样透传给 `wifiDiscovery.scanForDevices(payload)`。
若宿主采取"读取工作区配置强行覆盖 `payload.timeoutMs`"，会带来明确的**语义破坏**：

1. **副作用表现**：
   若将来某个调用方（如快捷探活、高级调试面板或自定义插件）有明确意图传入特定的 `timeoutMs`（例如 500ms 快速探测，或 30000ms 深度扫网），宿主的**无条件覆写会直接抹杀调用方的显式入参**，违反了软件设计中"显式参数优先于默认配置"的基本契约。
2. **两难困境的根因**：
   当前前端 `AppSidebarLeft.vue:127` 硬编码的 `5000` 恰好等于 `package.json` 中的默认配置值。
   - 若宿主仅在 `payload.timeoutMs === undefined` 时取配置：因为前端传了 5000，宿主兜底永远不触发，缺陷依然存在；
   - 若宿主无条件覆写：前端彻底丧失参数化自由；
   - 若宿主猜测 `=== 5000` 时覆写：引入脆弱的魔数嗅探。
3. **架构收敛推导（A+B 协同）**：
   - **前端责任**：`AppSidebarLeft.vue:127` 停止传递写死的 `{ timeoutMs: 5000 }`，改为无参调用 `captureCommands.scanNetworkDevices()`，语义为"使用系统/用户配置的时长"；
   - **宿主责任**：`LACEditorProvider.ts` 实现标准的参数合并：
     ```ts
     const configTimeout = vscode.workspace.getConfiguration('logicAnalyzer.network').get<number>('scanTimeoutMs', 5000);
     const effectiveTimeout = (this.isRecord(payload) && typeof payload.timeoutMs === 'number')
       ? payload.timeoutMs
       : configTimeout;
     ```
   - **最终效果**：常规扫描自动遵从工作区配置（1200ms 立即生效）；若调用方显式指定了 `timeoutMs` 则原样放行，互不干扰。

**当前处置**：在产品修复前，e2e 场景通过 `sidebar-scan-honors-config` 判据真实报红（EXIT=1），待产品按照 A+B 修复后自动转绿。

---

## 二、覆盖范围（2 条）

### D-4：真机 e2e —— 烧不烧固件

| 字段 | 内容 |
|---|---|
| 现状 | 固件**可构建**（RP2040 UF2 85KB，VID/PID `1209:3020`，已实测）<br>烧录路径通（pyocd + CMSIS-DAP probe 在位）<br>**用户 2026-11-03 裁定「先不烧」** |
| 影响 | 真机采集、真机解码、真实设备发现 —— 全部 `not_exercised` |
| 台账 | `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` |

**这是当前最大的覆盖空洞。** 烧了之后能验：
串口发现 → 连接握手 → 真实采集 → 波形落盘 → I2C/SPI/UART 解码。

**待你裁定**：是否授权烧录（会抹掉板上现有固件）。

---

### D-5：还要不要继续加 UI 场景

**已覆盖**：波形渲染 / 通道配置 / 触发设置 / 导出按钮 / 协议解码

**候选**：采样率/缓冲区配置

| 论点 | 内容 |
|---|---|
| 支持 | 它是唯一还没覆盖的核心配置区 |
| 反对 | **边际收益递减** —— 判据面与通道配置/触发设置高度同构（`formItem:` + `readValue`），<br>新增场景主要在重复已有的验证模式 |

**我的建议**：**暂停**。先把 D-3 那个既有的 Promise 泄漏修掉。

---

## 三、技术债（1 条）

### ~~D-6：10 个既有失败的 unit 套件~~ —— **已消解，无需裁定**

**这条要撤销。** 2026-11-03 最终复跑：
```sh
$ npx jest tests/unit
Test Suites: 1 failed, 92 passed, 93 total
Tests:       2472 passed, 2472 total          ← 用例 100% 通过
```

⇒ 早期记录的「10 个失败套件 / 106 失败用例」**已不存在**。

**原因**：合并远程 master（`834575bc`，39 个提交）时带入了修复：
```
5a76d992 test: tighten coverage path gates and drop web-app from Jest denom
74a83f78 test: fix stale scpiIdn assertions in hardware compatibility db
3ca420e3 fix(drivers): idempotent temp dir on capture retry and await dispose
8be6affa test: restore simple-mocks vscode mock in capture integration
```
这些把 `LogicAnalyzerDriver.*` / `SessionManager.*` / `MemoryManager` 等的
失败全修掉了。

**唯一剩下的失败**是 `Extension.coverage.test.ts` 的 Promise 泄漏（**D-3**），
而且它是**崩溃**不是断言失败 —— 那 2472 个用例**全部通过**。

> ⚠️ **教训**：跨会话保留的历史数字，合并后必须**重新实测**。
> 我在这份文档里写过 106，是拿旧数字下的结论。

---

## 四、汇总表

| ID | 事项 | 严重度 | 我的建议 | 待你裁定 |
|---|---|---|---|---|
| D-1 | BUG-3 广播发现无效 | Important | **C + D**（记住端口 + 文档化） | ⏸ |
| D-2 | webview 导出落盘不可自动化 | Minor | **A**（接受现状） | ⏸ |
| D-3 | `Extension.coverage` Promise 泄漏 | Important | **已修（T1）** | ✅ |
| D-7 | 4 个网络配置声明了但从未读取 | Important | 3项接线 + 1项无实现声明移除 | ✅ **已修（2026-11-04）** |
| D-8 | 20 个测试垃圾已被提交进仓库 | Minor | **A**（`git rm --cached`） | ⏸ **需你确认** |
| D-9 | 网络驱动发 JSON、固件只认二进制帧（WiFi 采集从未可用） | **Critical** | **C′**（改指向 `LogicAnalyzerDriver`，保留旧类 `@deprecated`） | ✅ **已修（2026-11-04）** |
| D-10 | `sendNetworkConfig` 网络模式直接返回 false ⇒ `configureWiFi` 对网络设备无效 | Important | 移除 `_isNetwork` 短路，网络串口走同一套 0x02 帧 | ✅ **已修（2026-11-04）** |
| D-11 | Webview 侧栏扫描硬编码 5000ms 不遵从配置 | Important | **A+B**（前端去掉硬编码 + 宿主缺省兜底） | ✅ **已修（2026-11-04）** |
| D-4 | 真机 e2e（烧固件） | — | 取决于你 | ⏸ |
| D-5 | 继续加 UI 场景 | — | **暂停** | ⏸ |
| ~~D-6~~ | ~~10 个红的 unit 套件~~ | — | **已消解**（合并远程后 2472 用例全过） | ✅ 无需裁定 |

---

## 五、已完成（无需裁定，供索引）

| 项 | commit |
|---|---|
| 测试体系归拢（jest projects，73 文件全收集） | `bfd85ee0` |
| 真宿主 e2e 骨架 + 4 个命令层场景 | `2bd94289` |
| BUG-1/BUG-4 修复（网络扫描） | `e4e713ba` |
| BUG-2 修复（CLI export） | `5d9d0a90` |
| 合并远程 master（39 提交，5 冲突） | `834575bc` |
| Webview 场景驱动桥 + UI 三层断言 | `354b93c5` |
| 小写 `settings` 兼容（样本丢失修复） | `332847fa` |
| 通道配置 UI 场景 | `f381a969` |
| 触发设置 UI 场景 + formItem 选择器 | `e10b0419` |
| 导出按钮 UI 场景 + postMessage 探针 | `294f2646` |
| 协议解码 UI 场景 | `8b7b0e42` |
| 范围外缺陷登记（OUT-1） | `b18a5f40` |

---

## 六、文档索引

| 文档 | 内容 |
|---|---|
| `docs/test-architecture-2026-11-03.md` | 测试体系总览（jest projects / 脚本 / 目录约束 / UI 桥架构） |
| `docs/e2e-coverage-matrix-2026-11-03.md` | 9 场景覆盖矩阵（命令面 / UI 面 / 能力面） |
| `docs/e2e-found-product-bugs-2026-11-03.md` | 5 个产品缺陷 + 1 个范围外缺陷 |
| `docs/test-coverage-gaps-2026-11-03.md` | 删除的测试及留下的真实缺口 |
| `docs/bug2-export-command-evaluation-2026-11-03.md` | BUG-2「该不该加导出命令」三问分析 |
| `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` | 固件可构建性证明（烧录待授权） |
| `tests/e2e/vscode/README.md` | e2e 使用说明（怎么跑、怎么写场景、已知边界） |
| **本文档** | 待裁定事项汇总 |
