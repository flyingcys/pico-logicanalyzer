# 真宿主 e2e 抓到的产品缺陷（2026-11-03）

> 来源：`tests/e2e/vscode/` 真宿主 e2e（VS Code 1.74.3，`ExtensionMode.Test`）。
> 这些**不是**测试环境问题，是用户可感知的产品缺陷。

## 总览

| ID | 缺陷 | 严重度 | 状态 |
|---|---|---|---|
| [BUG-1](#bug-1网络扫描并发控制是死代码扫描耗时不可接受) | 网络扫描并发控制是死代码 + 配置被忽略 + 有设备时挂死 | Important | ✅ **已修**（4 条变异验证） |
| [BUG-2](#bug-2数据导出没有-vs-code-命令入口) | 数据导出没有 VS Code 命令入口 | Minor | ✅ **已解决**（改加 CLI `export` 子命令） |
| [BUG-3](#bug-3udp-广播发现对官方固件是死路插件发了固件不答) | UDP 广播发现对官方固件无效；且固件端口由用户配置、无默认值 | Important | ⏸ 待用户裁定（4 个方案） |
| [BUG-4](#bug-4webview-传的-timeoutms-与服务的-timeout-字段名对不上静默失效) | webview 传的 `timeoutMs` 与服务的 `timeout` 字段名对不上，静默失效 | Important | ✅ **已修**（变异验证） |
| ~~BUG-5~~ | ~~Uint8Array 序列化丢样本~~ | — | ❌ **已撤销**（我误判，见下文；`applyDocument` 从 `content` 重新 parse，不读那个字段） |

> **状态口径**：「已修」= 有变异验证证明改坏会红；「待裁定」= 需要用户决定是否做、怎么做。
> 未提交的修复也算「已修」，但会在提交后补 commit 号。

---



---

## BUG-1：网络扫描并发控制是死代码，扫描耗时不可接受

| 字段 | 内容 |
|---|---|
| 记录 ID | e2e-bug-20261103-001 |
| 严重度 | **Important** |
| 状态 | ✅ **已修（2026-11-03，未提交）** —— 下方"现象/根因"保留为**修复前**的历史记录 |
| 发现方式 | `network-scan` 场景实跑，25s 超时 |
| 文件 | `src/services/WiFiDeviceDiscovery.ts:261`、`src/extension.ts:288` |

> ⚠️ **读下方内容时注意**：那是**修复前**的快照。修复后的实际状态见本节末尾「**修复结果**」。
> 保留原样是为了让后人知道"当时到底坏在哪"，而不是看一份被改写过的历史。

### 现象

`logicAnalyzer.scanNetworkDevices` 在真宿主里 **25 秒仍未返回**：

```
$ xvfb-run -a node tests/e2e/vscode/lib/runner.cjs --scenario network-scan
❌ network-scan → overall=fail
  ❌ scan-completed — 扫描执行抛出未处理异常（耗时 25003ms）：超时 25000ms
```

### 根因（两条，均已读码确证）

**① 并发信号量声明后从未使用 —— 死代码**

```ts
// src/services/WiFiDeviceDiscovery.ts:259-262
// 使用并发限制避免过多连接
const semaphore = new Array(config.concurrency).fill(null);   // ← 声明
const promises: Promise<void>[] = [];

for (const ip of ipList) {
  const promise = Promise.resolve().then(async () => {        // ← 直接全部发起
    ...
  });
  promises.push(promise);                                      // ← semaphore 一次没出现
}
await Promise.allSettled(promises);
```

`grep -n semaphore src/services/WiFiDeviceDiscovery.ts` **只有第 261 行一处命中**（声明），零使用。
⇒ `concurrency: 30` **完全没生效**，所有 IP 全量并发。

**② 扫描规模 × 单连接超时 = 分钟级**

实测本机 `getLocalNetworkRanges()` 返回 **4 个网段**：
```
192.168.1.1-254, 172.31.255.1-254, 100.122.61.1-254, 172.21.0.1-254
```
每 IP 扫 **5 个端口**（`logicAnalyzer.network.defaultPorts` = `[4045, 10429, 5555, 5025, 111]`）：
```
4 × 254 × 5 = 5080 次 TCP 连接尝试
config.timeout = 5000ms 是**单个连接**的超时，不是整次扫描
```

### 附带缺陷：配置项 `scanTimeoutMs` 是空的

`package.json` 声明了：
```json
"logicAnalyzer.network.scanTimeoutMs": { "type": "number", "default": 5000, "minimum": 1000, "maximum": 30000 }
```

但：
- `WiFiDeviceDiscovery.ts` **从来没读过它**（`grep scanTimeoutMs src/` 除 package.json 外零命中）
- `extension.ts:288` 反而**硬编码** `timeout: 5000` 传进去，覆盖掉配置

⇒ **用户改 `logicAnalyzer.network.scanTimeoutMs` 不起任何作用。**

### 附带缺陷：有设备时命令会挂死

```ts
// src/extension.ts:295-307
if (result.devices.length > 0) {
  const selectedItem = await vscode.window.showQuickPick(deviceItems, {...});
```
`showQuickPick` 在真宿主 `ExtensionMode.Test` 下**永不 resolve**（已实测，见
`tests/e2e/vscode/README.md` §5.1）。⇒ 一旦网络里真有逻辑分析器，命令永久挂起。

### 修复建议（待定，需产品决策）

1. **让 semaphore 真生效**：用 `p-limit` 或手写滑动窗口，让 `config.concurrency` 真正限制在飞连接数
2. **总超时 vs 单连接超时分离**：`scanTimeoutMs` 应约束**整次扫描**，超时就 `break` 并返回已完成部分
3. **读配置**：`extension.ts` 应 `getConfiguration('logicAnalyzer.network').get('scanTimeoutMs')`，不要硬编码
4. **有设备分支的参数化入口**：与 `createSyntheticCapture` 同模式，加可注入的选择结果（否则 e2e 永远验不到这条分支）

### 修复结果（2026-11-03）

四条建议**全部落地**，另附带修了 BUG-4：

| 建议 | 实际做法 |
|---|---|
| 1. semaphore 生效 | 改成固定并发 Worker 消费池（滑动窗口），在飞连接数 ≤ `config.concurrency` |
| 2. 超时分离 | 拆成两个字段：`connectionTimeout`（单连接，默认 3000）+ `scanTimeout`（总预算，默认 5000）。**总超时恒常生效** |
| 3. 读配置 | `extension.ts` 读 `getConfiguration('logicAnalyzer.network')` 的 `scanTimeoutMs` / `maxConcurrentConnections` / `defaultPorts` / `enableBroadcastDiscovery` |
| 4. 有设备分支入口 | `scanNetworkDevices` 加 `autoSelect?: string \| true`（同 `createSyntheticCapture` 的 `targetUri` 模式） |
| 额外 | `AbortSignal` 下传到 `isPortOpen` / `verifyPicoDevice`，abort 时**立刻 destroy 在飞 socket**（否则要等满一个 `connectionTimeout`） |
| 额外 | 返回结构加 `stats: { totalIps, probedIps, aborted, elapsedMs }` |

**实测效果**：
```
修复前：25s 仍未返回（超时）
修复后：scanTimeoutMs=1200 → 1202ms；scanTimeoutMs=5000 → 5004ms
        配置精确生效，stats.probedIps=63/254，aborted=true
```

**验证方式**（4 条变异，均由主线程独立复现）：
| 变异 | 结果 |
|---|---|
| 删 `abort()` 调用 | ✅ 红：超时 10009ms |
| `extension.ts` 硬编码 `5000` 不读配置 | ✅ 红：两次差 1ms |
| `stats` 字段改名 | ✅ 红：报缺失 |
| 删 BUG-4 的 `timeoutMs` 兼容分支 | ✅ 红：单测 1 failed |

**未解决的部分**：`autoSelect` 的**无参分支**（用户从命令面板点、走 `showQuickPick`）
在真宿主 e2e 内**仍然不可验**（弹窗永不 resolve）。这是显式登记的边界，
见 `tests/e2e/vscode/README.md` §5.1。

---

## BUG-2：数据导出没有 VS Code 命令入口

| 字段 | 内容 |
|---|---|
| 记录 ID | e2e-bug-20261103-002 |
| 严重度 | **Minor**（webview 里有按钮，功能可用；缺的是命令面板/自动化入口） |
| 状态 | ✅ **已解决**（2026-11-03，加了 CLI `export` 子命令，见 `docs/bug2-export-command-evaluation-2026-11-03.md`） |
| 发现方式 | 覆盖矩阵梳理时发现「9 个命令里没有导出」 |
| 文件 | `package.json`（contributes.commands）、`src/providers/LACEditorProvider.ts:399` |

### 现象

`package.json` 声明的 9 个命令里**没有导出命令**。导出只能：
- 从 webview 的 `AppHeader.vue:93` 按钮 → `host.sendCommand('exportData', ...)`
- 或 webview 的 `App.vue:41` 分发 → 同上
- → 宿主侧 `LACEditorProvider.ts:883` `case 'exportData'` → `exportData()` → **`await showSaveDialog`**

⇒ 命令面板里找不到"导出数据"，且真宿主 e2e 无法经命令层驱动导出。

### 修复建议（待产品决策）

与 `createSyntheticCapture` 同模式，`exportData` 加 `targetUri` 注入点 + 暴露 `logicAnalyzer.exportData` 命令。

> ⚠️ **判定为 Minor 而非 Important**：用户在 UI 里点按钮是能导出的。缺的是**命令面板入口**与**可自动化性**。

---

## BUG-3：UDP 广播发现对官方固件是死路（插件发了，固件不答）

| 字段 | 内容 |
|---|---|
| 记录 ID | e2e-bug-20261103-003 |
| 严重度 | **Important**（影响"网络设备能否被发现"这个核心能力） |
| 状态 | 待评估 |
| 发现方式 | 复核 BUG-1 修复方案时，核对「广播兜底」这一假设 |
| 文件 | `src/services/WiFiDeviceDiscovery.ts:236-247`、固件 `logicanalyzer/Firmware/LogicAnalyzer_V2/` |

### 现象

插件侧的广播发现：
```ts
// src/services/WiFiDeviceDiscovery.ts:236-247
const discoveryMessage = JSON.stringify({
  request: 'logic-analyzer-devices',
  timestamp: Date.now()
});
const broadcastAddresses = ['255.255.255.255', '192.168.1.255', '192.168.0.255'];
for (const addr of broadcastAddresses) {
  udpSocket.send(discoveryMessage, 4046, addr, ...);   // UDP 4046
}
```

但固件侧：
```
$ grep -rn "4046|logic-analyzer-devices|udp|broadcast" logicanalyzer/Firmware/
（仅 lwipopts.h 里 LWIP_UDP=1 的编译开关，无任何监听 4046 或回应逻辑）
```

⇒ **插件在喊，固件从不答应。** 这条发现路径对官方固件**完全无效**。

### 影响

- `enableBroadcastDiscovery`（`package.json` 默认 `true`）**白等一轮 UDP 超时**
- BUG-1 修复方案里"反正广播能兜底"的论证**不成立**
- 用户开了 WiFi 的逻辑分析器，**不会被自动发现**，只能手输 IP

### ⚠️ 2026-11-03 追查：比"广播无效"更糟

我继续查了固件的 TCP 端口，发现**自动发现这条路整体是断的**：

| 环节 | 事实 |
|---|---|
| 固件监听端口 | `LogicAnalyzer_WiFi.c:176` `tcp_bind(serverPcb, &address, wifiSettings.port)` |
| `wifiSettings.port` 从哪来 | `LogicAnalyzer.c:317` `settings.port = wReq->port` —— 由**用户下发的 WiFi 配置**决定 |
| 固件是否有默认端口 | **没有**。`WIFI_SETTINGS.port` 是 `uint16_t`，无出厂默认值可查 |
| 插件扫描的端口 | `[4045, 10429, 5555, 5025, 111]`（`package.json` 的 `network.defaultPorts`） |

⇒ **用户配的端口若不在那 5 个里，TCP 扫描也扫不到。**

### ⚠️ 但影响面比看起来小 —— 已核实

`src/extension.ts:428-431` 的 `configureWiFi` 命令里，端口输入框有**默认值**：

```ts
const portStr = await vscode.window.showInputBox({
  prompt: '请输入TCP端口号',
  value: '4045',          // ← 默认 4045
  validateInput: (value) => { /* 1024-65535 */ }
});
```

而 `4045` **就在** `network.defaultPorts` 里。

**所以真实影响是**：
| 场景 | 能否被发现 |
|---|---|
| 用户用默认端口 4045 配置 | ✅ TCP 扫描能命中（IP 已知时） |
| 用户**手动改了**端口 | ❌ 扫不到，且插件也不记住他改成了什么 |
| 不知道 IP | ❌ 广播无效，扫 4 个网段 × 254 IP 也是碰运气 |

⇒ 这条的**主要损失是"改了端口的用户卡死"** + **"IP 段的完整扫描太慢"**（BUG-1）。
**不是"所有人都无法发现"** —— 我上一版写"完全不通"是**过度断言**，在此更正。

⇒ 这也意味着**修复优先级应该降**：默认路径能走通，只有非默认配置的用户受影响。

### 修复方向（待产品决策，按成本排序）

| 方案 | 成本 | 效果 |
|---|---|---|
| A. 固件侧补 UDP 4046 监听 + 回应 | **高**（改固件、重新发布、用户要刷机） | 彻底解决，是业界标准做法 |
| B. 固件侧把监听端口**固定**为 4045 并在文档写明 | 中（改固件，但不用实现 UDP） | 扫描能命中；但限制用户改端口的自由度 |
| C. 插件侧 UI 显示"上次连接过的端口"并记住 | **低**（纯插件） | 缓解手输成本，但解决不了"首次发现" |
| D. 明确文档化"WiFi 设备需手输 IP:端口" | **最低** | 诚实但不解决 |

> ⚠️ 这条**不是 e2e 发现的**，是复核 BUG-1 方案时顺带核对出来的。
> 按纪律记下来（"不做也要留痕"）。

## BUG-4：webview 传的 `timeoutMs` 与服务的 `timeout` 字段名对不上，静默失效

| 字段 | 内容 |
|---|---|
| 记录 ID | e2e-bug-20261103-004 |
| 严重度 | **Important**（用户改的超时完全不生效，且无任何报错） |
| 状态 | ✅ **已修（2026-11-03，随 T-BUG-1 一起）** —— 见下方「修复结果」 |
| 发现方式 | 复核 BUG-1 时顺带查 webview 侧消费方 |
| 文件 | `AppSidebarLeft.vue:108`、`WiFiDeviceDiscovery.ts:58-71` |

### 现象

webview 侧（`src/frontend/app/components/AppSidebarLeft.vue:108`）：
```ts
const result = await captureCommands.scanNetworkDevices({ timeoutMs: 5000 });
```

宿主侧最终到 `scanForDevices(config?: Partial<ScanConfiguration>)`，而
`ScanConfiguration`（`WiFiDeviceDiscovery.ts:58-71`）的字段是 **`timeout`**，不是 `timeoutMs`：
```ts
export interface ScanConfiguration {
  timeout: number;       // ← 不是 timeoutMs
  concurrency: number;
  ports: number[];
  ...
}
```

⇒ `{ timeoutMs: 5000 }` 会被 `{...defaultConfig, ...config}` 原样带上，
**`timeoutMs` 成了没人读的野字段**，`timeout` 仍用默认 3000。

⇒ **webview 想设 5000，实际跑 3000，而且没有任何报错。**

### 为什么 `Partial<ScanConfiguration>` 没拦住

`Partial` 只放宽了"字段可省"，**不阻止多余字段**（TS 的对象字面量多余属性检查只在
直接赋值给具体类型时生效；这里经过 `unknown` → `isRecord` → 传参，类型检查早断了）。

### 修复方向

1. 统一字段名（建议用 `timeoutMs`，与 `package.json` 的 `scanTimeoutMs` 同风格）
2. 或者在宿主侧做**显式映射**，并在收到未知字段时**记日志**（不静默）
3. 加一条 unit 测试：传 `{ timeoutMs: X }` 时，底层真的用了 X

### 修复结果（2026-11-03）

采用「**显式映射 + 未知字段告警**」（方案 2），而不是改 webview 字段名 ——
理由：只改一处 webview 解决不了"任何第三方/旧版调用方传 `timeoutMs` 仍失效"。

```
src/services/WiFiDeviceDiscovery.ts
  else if (typeof raw.timeoutMs === 'number') { normalized.scanTimeout = raw.timeoutMs; }
  const unknownKeys = Object.keys(raw).filter(k => !knownKeys.has(k));
  if (unknownKeys.length > 0) console.warn(`忽略未知扫描参数: ...`);
```

**单测**：`tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts` 新增
「应该兼容 Webview 传入的 timeoutMs 字段（BUG-4）」。

**变异验证**（主线程独立跑）：删掉 `else if (typeof raw.timeoutMs === 'number')` 分支 →
`FAIL … Tests: 1 failed, 34 passed`。**Killed the mutant。**

> ⚠️ **e2e 验不到这条**：`extension.ts`（命令路径）**同时传了 `scanTimeout` 和 `timeoutMs`**，
> 所以命令路径永远走 `scanTimeout`，兼容分支不执行。而真正需要兼容的 webview 通道
> 在宿主侧不可达（README §5.2）。⇒ 这条的**唯一观测面是 unit 测试**，
> `network-scan` 场景里已如实登记为 `not_exercised` 并点名承接方。

## BUG-5（**已撤销 —— 我判断错了**）

> 2026-11-03：我一度把「UI e2e 里 L2 显示 0 samples」归因为
> 「`Uint8Array` 经 postMessage 序列化成对象，前端 `normalizeSampleArray` 认不出」。
>
> **重新核实后，这个判断不成立。**

### 为什么撤销

前端 `sessionStore.applyDocument`（`sessionStore.ts:333-344`）**根本不读那个 `captureChannels`**：

```ts
applyDocument(document?: FrontendDocumentData) {
  const fileName = document?.fileName ?? '';
  if (!document?.content) { ... return; }

  const rootPayload = readRootPayload(document.content);   // ← 从 content 重新 parse
  if (!rootPayload) { ... return; }

  const sessionPayload = readSessionPayload(rootPayload);   // ← 用重新 parse 的结果
  ...
}
```

⇒ **`document.content`（原始 JSON 文本）是权威来源**，
`documentPayload` 里那个已损坏的 `...lacData`（含 `Uint8Array` 序列化后的对象）**从未被使用**。

### 那 L2「0 samples」是什么

是我**加诊断动作之前**的一次跑（`/tmp/ui-l12.log`）。那次我为了二分定位崩溃点，
把 L3 的 `readCanvasStats` 移除了，同时也导致了别的问题。
**移除诊断动作、干净重跑后，L2 稳定通过（4 samples），3 次复现全绿。**

⇒ **那次 L2 红是我自己的调试态引入的，不是产品缺陷。**

### 从这次学到的

| 我的错误 | 教训 |
|---|---|
| 看到"现象"（samples 传对象）就编出"根因"（前端认不出），**没验证调用链** | 读码推理 ≠ 实证。必须跟到**实际使用点** |
| 没看到 `applyDocument` 第一行就重新 `JSON.parse(content)` | 查证要**从入口开始读**，不能从中间某处推测 |
| 差点让 05 去修一个不存在的 bug | **错误的 bug 报告比没有更糟** —— 会浪费对方时间且污染文档 |

### 保留这个条目的理由

按「不做出无痕」纪律：**「一度以为有、核实后没有」也要留痕**，
否则我下次遇到同样的现象会再走一遍同样的错误推理。

## 范围外发现（既有缺陷，不阻塞本轮）

以下是在本轮工作中顺带发现、但**不属于本轮范围**的既有问题。
按纪律单列，由用户决定是否处理。

### OUT-1：`Extension.coverage.test.ts` 未捕获的 Promise.reject 让 jest 进程崩溃

| 字段 | 内容 |
|---|---|
| 发现时间 | 2026-11-03（第 4.4 步追查 `ExtensionMode` mock 时） |
| 严重度 | **Important**（让整个目录的测试不可用） |
| 引入方 | **既有**：commit `b691af54 test: 补充 P0 核心符号单元测试并修复进度上报 flaky` |
| 文件 | `tests/unit/extension/Extension.coverage.test.ts:461` |

**现象**：
```sh
$ npx jest tests/unit/extension          # 整个目录
EXIT=1

Extension.coverage.test.ts:379
  const device = makeFakeDevice({ sendResult: Promise.reject(new Error('硬件错误')) });
Error: 硬件错误
  at Extension.coverage.test.ts:461:66
Node.js v22.20.0                         # ← worker 进程直接崩
```

**影响**：
- `npx jest tests/unit/extension` **整个目录跑不了**
- **单文件也跑不了** —— ⚠️ 这一条更正过：本文早期版本写「单文件跑正常」，**是错的**。
  2026-11-03 对 `git show HEAD:` 的原版实测：
  ```sh
  $ git show HEAD:tests/unit/extension/Extension.coverage.test.ts > /tmp/head-cov.ts
  $ cp /tmp/head-cov.ts tests/unit/extension/Extension.coverage.test.ts
  $ npx jest tests/unit/extension/Extension.coverage.test.ts
  EXIT=1        # 同样 Node.js v22.20.0 崩溃
  ```
  ⇒ **这个文件在 HEAD 上无论怎么跑都起不来**。所以记录时必须区分
  「哪个测试文件」而不是「单文件 vs 目录」。
- 全量 `npm test` 时它崩在 worker 里，主进程继续，**不影响总结果**（所以一直没被发现）

**临时绕法**：⚠️ **没有绕法**。要验证 extension 相关改动，必须先修它。
（早期写的「跑单文件」不成立，见上。）

**修复方向**：给那个 `Promise.reject` 加 `.catch()`，
或者用 `expect(...).rejects.toThrow()` 正确消费。

**根因（2026-11-03 补充）**：
```ts
sendNetworkConfig: jest.fn().mockResolvedValue(opts?.sendResult ?? true)
```
`mockResolvedValue` 会把传入的 Promise **再包一层** ⇒ `Promise.reject(...)`
被 `resolve` 掉了，外层 promise 永远 fulfilled；而里层那个 rejection
**没有任何 `.catch`** ⇒ unhandled rejection ⇒ Node 22 默认 `--unhandled-rejections=throw`
⇒ 进程直接退出。

⇒ 正确修法不是给它加 `.catch()`（那是掩盖），而是**让 mock 真的 reject**：
用 `jest.fn().mockRejectedValue(err)`，并让测试声明式传入 `sendError`。

#### 修复（2026-11-03，T1）

除根因外，这次还牵出并修掉三条**被崩溃掩盖的既有缺陷**：

| # | 缺陷 | 为什么之前看不见 |
|---|---|---|
| 1 | **契约漂移**：断言仍写 `timeout: 5000 / concurrency: 30`，而产品 `e4e713ba` 已改成 `connectionTimeout/scanTimeout/timeoutMs/ports` | 崩在断言之前，永远跑不到 |
| 2 | **mock 取值架空判据**：`getConfiguration` 返回 5000/30/[4045,…]/true，其中三条**与产品兜底常量相同** ⇒ 产品删掉 `.get()` 直接写常量也全绿 | 测试一直"绿"，没人怀疑 |
| 3 | **配置节名无校验**：`getConfiguration` 无条件返回同一对象 ⇒ 产品把节名写成任意字符串都不红 | 同上 |

修法：mock 改为**哨兵值 + 配置节白名单**（见下），断言对齐新契约。

**变异矩阵（每次只改产品一行，跑完立即还原，`git status` 确认干净）**

| 变异 | 把产品改成 | 05 原方案 | 现方案 |
|---|---|---|---|
| A | `scanTimeoutMs = 5000`（不读配置） | ✅ 绿（漏判） | ❌ 红 |
| B | `defaultPorts = [4045,…]`（不读配置） | ✅ 绿（漏判） | ❌ 红 |
| C | `enableBroadcast = true`（不读配置） | ✅ 绿（漏判） | ❌ 红 |
| D | `maxConcurrency = 50`（不读配置） | ❌ 红 | ❌ 红 |
| E | 配置节名改成 `logicAnalyzer.WRONGSECTION` | ❌ 红 | ❌ 红 |

> 对照实验做法：把 05 的取值（5000/30/[4045,…]/true）与我的其余改动拼一起，
> 两版除**取数值**外完全相同，各跑一遍同一批变异。
> D 能红纯属巧合（mock 的 `30` 恰好 ≠ 兜底 `50`）。
> E 两版都红，因为配置节校验是本轮新加的。

**关键教训**：判据要能鉴别两个状态，**两个状态的输入必须真的不同**。
把 mock 设成"产品兜底值"，等于让「读配置」与「不读配置」产生同一个可观测结果 ——
判据看起来在测，其实测不到。

```ts
// 最终形态
getConfiguration: jest.fn((section?: string) => {
  if (section !== 'logicAnalyzer.network') {
    throw new Error(`未预期的配置节: ${String(section)}`);
  }
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === 'scanTimeoutMs') return 7777;              // ≠ 默认 5000
      if (key === 'maxConcurrentConnections') return 17;     // ≠ 默认 50
      if (key === 'defaultPorts') return [9999, 8888];       // ≠ 默认 [4045,…]
      if (key === 'enableBroadcastDiscovery') return false;  // ≠ 默认 true
      return defaultValue ?? true;
    }),
  };
}),
```

**验收**
```sh
$ npx jest tests/unit/extension --silent   → 6 suites / 277 tests 全过
$ npx jest tests/unit --silent             → 93 suites / 2528 tests 全过
```
五次连续全量复跑均 2528 全绿。期间出现过一次 `1 failed`，
但**三次连续复跑无法复现**，且当时另一会话正在并发跑同一批测试。
⇒ 归因为**并发资源竞争**，非产品/测试缺陷 —— 但如实记录，不隐瞒。

#### 附带发现（不在 T1 范围，单列交裁定）

排查配置时发现 `package.json` 声明了 4 个网络配置，产品**从未读取**：

```
logicAnalyzer.network.enableAutoDiscovery     (默认 true)
logicAnalyzer.network.heartbeatIntervalMs     (默认 5000)
logicAnalyzer.network.connectionTimeoutMs     (默认 10000)
logicAnalyzer.network.enableAutoReconnect
```
```sh
$ grep -rn 'connectionTimeoutMs\|enableAutoDiscovery\|heartbeatIntervalMs' src/ --include=*.ts | grep -v test
（零命中）
```
而 `docs/network-features.md:116,130` 把这几个配置写成了可用。
⇒ **文档承诺了、产品没实现**。已在 `docs/open-decisions-2026-11-03.md` D-7 登记。

---

### OUT-2：`/tmp` 泄漏门禁自身的两个「假绿」（2026-11-03）

上一笔提交（`d83926b1`）建的门禁 `scripts/check-tmp-leaks.js`，
在修 T1 期间被发现有**两个独立的假绿**。它一直在报「✅ 无泄漏」，
但工作区实际躺着 **28 个** `checkpoint-*.json`。

#### 假绿 1：只认 `mkdtemp`，完全不覆盖「往 cwd 落产物」

```ts
// RecoveryManager.ts:84（修复前）
checkpointDir: path.join(process.cwd(), '.recovery-checkpoints')
```
每跑一次 stress 测试，仓库根目录就多几个文件。门禁只在找 `mkdtemp`，**看不见它**。

修法：增加 `CWD_WRITE_RE = /process\.cwd\s*\(\s*\)/`，
⚠️ **只对 `tests/` 生效** —— 第一版对全目录生效时误报 3 个 `scripts/*.ts`
（发布脚本按 cwd 定位仓库根，是正常用法）。

#### 假绿 2：源码里出现 `rm/unlink` 字样就放行 —— 哪怕那行**是注释掉的**

```ts
// RecoveryManager.ts:450（修复前）
// await fs.remove(this.config.checkpointDir);      ← 整行是注释
```
```ts
// RecoveryManager.ts:391
await fs.unlink(filePath);                          ← 只删超出上限的单文件
```
两个都被 `CLEANUP_RE` 命中 ⇒ 门禁放行。**而目录从未被删过。**

修法：
1. 先 `stripComments()` 剥注释再判断
2. 对「往 cwd 落产物」的文件，判据升级为 `DIR_REMOVE_RE`（真删目录），
   不接受单个 `unlink`

#### 教训（通用）

> **任何「靠源码里出现某个字样」判断的门禁，都必须先剥注释。**
> 一条被注释掉的清理代码，会让门禁永久失效 —— 而它看起来还在工作。

这与 OUT-1 是同一类错误：**判据与它声称在测的东西之间没有因果关系**。
OUT-1 是「mock 取值 = 兜底值 ⇒ 读不读配置看不出来」；
OUT-2 是「有清理字样 ≠ 真的清理了」。

#### 修复与验证

产品侧（`RecoveryManager.ts`）：
- `checkpointDir` 默认从 `process.cwd()` 改到 `os.tmpdir()` 下**按实例唯一**
  （`${pid}-${时间戳}-${随机}`）—— 避免多实例互相删目录
- `cleanup()` 真正执行 `fs.remove`（失败只 warn，不让清理异常掩盖测试结果）

**严格对照实验**（同一台机器、同一命令、`git checkout` 保证起点一致）：
```
HEAD 版：起始 20 个 → 跑一次 stress → 22 个（+2 泄漏）
修复版：起始 20 个 → 跑一次 stress → 20 个（0 增长）
```

**门禁双向变异**：
```
把 :450 取消注释 → 门禁 ✅ 通过
还原成注释       → 门禁 ❌ 报错（1 个文件）
```

> ⚠️ 我在这轮踩过一次实验污染：`rm -rf .recovery-checkpoints` 与测试并发执行，
> 导致误以为「测试删掉了整个目录」。严格对照重做后结论才可靠。
> **教训：验证"跑测试会不会产生 X"时，不要在同一个工作区同时手工删 X。**

#### 遗留：20 个历史文件仍在 git 里

`git ls-files .recovery-checkpoints/` → **20**，由 2026-07/08 两次误提交带入。
删除属破坏性操作，已登记 `docs/open-decisions-2026-11-03.md` **D-8** 待用户确认。

---

## 记录规则

- 每条 bug 修复后：把状态改为「已修（commit `<sha>`）」并补一条变异验证（改回去 → e2e 必须红）
- **不要把 e2e 的 `fail` 改成 `not_exercised` 来"消除红"** —— 那等于把产品缺陷藏起来
