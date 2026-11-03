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

## 记录规则

- 每条 bug 修复后：把状态改为「已修（commit `<sha>`）」并补一条变异验证（改回去 → e2e 必须红）
- **不要把 e2e 的 `fail` 改成 `not_exercised` 来"消除红"** —— 那等于把产品缺陷藏起来
