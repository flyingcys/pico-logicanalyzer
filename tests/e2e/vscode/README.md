# 真宿主 E2E（`tests/e2e/vscode/`）

> 用**真实 VS Code Extension Development Host** 验证「用户点按钮会走到的那条路」。
> 单元测试里 `vscode` 是 mock、`executeCommand` 是 `jest.fn()` —— 本目录补的就是那层。

## 一、它验什么、不验什么（先看这条）

| | 内容 |
|---|---|
| ✅ 验 | `activate()` 接线、命令注册与声明对账、`.lac` 真落盘、**Custom Editor 真被拉起**、产品参数化入口 |
| ❌ 不验 | webview **内部**的交互（点击/输入/画布像素）—— 见 §六 |
| ❌ 不验 | 真机硬件的采集与解码 —— 见 §六 |
| ❌ 不验 | `ExtensionMode === Development` 才有的分支（本宿主是 `Test`） |

## 二、怎么跑

```sh
npm run test:e2e                          # 全部场景（自动套 xvfb-run）
npm run test:e2e:list                     # 只打印场景注册表
node tests/e2e/vscode/lib/runner.cjs --scenario open-analyzer
node tests/e2e/vscode/lib/runner.cjs --keep-profile --scenario open-analyzer   # 保留现场排查
```

**前置**（runner 会前置拦，不静默跳过）：

1. 有 `DISPLAY`，或用 `xvfb-run`（`npm run test:e2e` 已套好）
2. `out/extension.js` 与 `out/webview/html/index.html` 存在（先 `npm run build`）

> ⚠️ **真宿主加载的是 `out/`，不是 `src/`**。改了源码不 build，e2e 跑的还是旧产物。
> 症状是"改了半天没变化"，指向不明 —— 所以 runner 前置检查产物存在性。

首次运行会下载 VS Code **1.74.3**（约 132MB）到本仓 `.vscode-test/`。

## 三、结果怎么读

每个场景落一份记录（`artifacts/latest/summary.json` + 终端摘要）。每条断言是一个 **oracle**，
状态四选一：

| 状态 | 含义 |
|---|---|
| `pass` | 断言真的跑了并成立 |
| `fail` | 断言跑了但不成立 |
| `not_exercised` | **本环境跑不到**，必须带可核实原因 |
| `blocked` | 被产品侧的门挡住，必须带原因与代码位置 |

**场景的 `overall` 取最差状态**：`fail > blocked > not_exercised > pass`。
⇒ **只有全 pass 才得到 pass**；有 `not_exercised` 就**不算通过**（终端会打
`⚠️ 无失败，但有 not_exercised / blocked —— 这不算通过`）。

> 这条是刻意的。参考仓踩过「全 skip 也算 EXIT=0」把「没验」伪装成「验过了」。

### 3.1 `delegate`：分工 ≠ 未验

一个场景里有些命令**刻意不执行**（有副作用 / 依赖别的场景的前置）。
写 `not_exercised` 会把整体拉成非 pass，但那其实是**分工**，不是"没验"。

正确写法：
```js
oracles.delegate("not-executed:openAnalyzer", "有副作用，由 open-analyzer 场景验", "open-analyzer");
```
`delegate` 不计入 `overall`，但 runner 会**跨场景对账**：
承接场景必须**本次也跑了且 overall=pass**，否则整轮报
`❌ delegate 对账失败：… 交给不存在的场景 "xxx"` 并 **EXIT=1**。

> ⚠️ 所以 `--scenario` 只跑一部分时，delegate 对账**必然失败** —— 这是对的，
> 因为「承接场景没跑」确实等于「这件事这轮没验」。
> 全绿只可能在**全量跑**时出现。

> 为什么必须对账：不对账的话 `delegate` 就是免责声明 ——
> 写上任意 `coveredBy` 就能把覆盖率挪走，而那个场景可能压根没跑 / 名字写错了。
> 这是「登记册说经 X 跑而 X 不存在」的同族缺陷。

## 四、加一个场景

1. 在 `scenarios/common/`（或 `hardware/`）新建 `<id>.scenario.cjs`，导出：
   ```js
   module.exports = {
     id: "my-scenario",
     title: "一句话说明",
     needsHardware: false,
     async run({ vscode, workspaceDir, oracles, waitFor, withTimeout }) { /* ... */ },
   };
   ```
2. 在 `scenarios/index.cjs` 里 `require` 一行
3. 跑 `npm run test:e2e:list` 确认登记成功

**硬性要求**（review 会逐条核）：

- ❌ **不许**在场景里 `fs.writeFile` 造产品该产出的东西（那就是造假绿）
- ❌ **不许**替产品选配置值 / 补默认值 / catch 掉产品异常自己兜底
- ❌ **不许**顶层 `require("vscode")`（用 `ctx.vscode`；顶层 require 会让场景在宿主外加载时炸）
- ✅ 断言落在**产品产出**（磁盘文件、返回结构），不是"命令没抛异常"
- ✅ 头部注释里写**变异证据**：改产品哪一处，本场景会红在哪条 oracle
- ✅ `not_exercised` / `blocked` 必须带**可核实**的原因（文件名 / 行号 / 实测命令）

## 五、已知边界（实测得来，不是猜的）

环境：VS Code **1.74.3**（`engines.vscode` 下限），`ExtensionMode=Test`，
Extension Host 内是 **node 16.14 / electron 19**。

### 5.1 原生弹窗在真宿主里**永不 resolve**

| API | 行为 |
|---|---|
| `showInformationMessage` / `showWarningMessage` / `showErrorMessage`（含带按钮） | **永不 resolve** |
| 同上 + `{ modal: true }` | **同步抛** `DialogService: refused to show dialog in tests.` |
| `showSaveDialog` / `showOpenDialog` | **永不 resolve** |
| `showInputBox` / `showQuickPick` | **永不 resolve** |
| `withProgress` | ✅ 正常 |

⇒ **凡 `await` 弹窗的命令，裸 `executeCommand` 会挂死**；凡不 `await` 的（本仓 `extension.ts` 里大量如此）正常返回。

产品侧对策：`createSyntheticCapture` 加了 `options.targetUri`（用户 2026-11-03 裁定）。
带参/无参**共用同一核心逻辑**，参数只替换"取 uri"那一步。
⚠️ **无参分支（走 `showSaveDialog`）在 e2e 内不可验，只能人工测试** —— 这是显式登记的边界。

### 5.2 `.mjs` 在宿主内不可用

Extension Host 是 node 16，不认 ESM。所以 driver 与 lib 全是 `.cjs`。
`extensionTestsPath` 指向 `.mjs` 会加载失败。

### 5.3 `executeCommand` 会**隐式激活**扩展（与 embedded-studio 文档相反）

实测：`isActiveBefore=false` → `executeCommand('logicAnalyzer.stopCapture')` 无异常 →
`isActiveAfterImplicit=true`。

⇒ 「9 个命令都在」这条**在本环境恒真**（是 VS Code 给的，不是本扩展挣来的）。
所以 `commands-coverage` 用的是**双向对账 + 接线存活 + 变异验证**，不是单看"命令在不在"。

## 六、明确不做的（附理由）

| 不做 | 理由 |
|---|---|
| **webview 内部 DOM 驱动** | 宿主侧拿不到 webview 的 `postMessage` 句柄（实测：`tabGroups` 只有 `{viewType, uri}`、`ext.exports` 是 `undefined`、`getCommands` 里无 webview 内部命令）。要走这条路必须**在产品里加测试入口**（venus-studio 的 `__runEditorScenario` 就是），那需要用户裁定。**第一批不做。** |
| **真机采集/解码 e2e** | 本机 Pico 上跑的不是逻辑分析器固件；固件**可构建**（已证明），但**烧录待用户授权**（2026-11-03 裁定「先不烧」）。台账见 `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md`。 |
| **in Jest** | 真宿主 e2e **不进** `jest.config.js`（`testPathIgnorePatterns` 已排除 `tests/e2e/`）。理由：它是外进程启动真 VS Code，与 jest 的并行/隔离模型冲突，且耗时以分钟计。 |

## 六点四、构建产物：`out/extension.js` 与 `out/e2e-libs/`（两个目录，各管各的）

跑 e2e 前需要**两个**构建产物，来历不同、互不覆盖：

| 产物 | 生成命令 | 内容 | 谁用 |
|---|---|---|---|
| `out/extension.js` | `npm run build` | webpack 打的扩展 bundle（真宿主加载它） | runner 的 `checkExtensionBuild` 前置检查 |
| `out/e2e-libs/**` | **`npm run build:e2e-libs`** | tsc 全量编译 `src/` 的裸模块 | **按类名加载产品类的场景**（见下） |

### 为什么需要 `out/e2e-libs/`

有些场景要拿产品**内部类/实例**（例如 `network-capture-mock` 用
`WiFiDeviceDiscovery` 握手、`hardwareDriverManager` 走真实连接链路）。
但 `npm run build` 的两个产物都拿不到：

- **`out/extension.js` 是 bundle**：它的 `module.exports` 只有 `extension.ts` 的
  顶层具名导出（`activate` / `deactivate` / `connectToDevice` / `connectToNetworkDevice`），
  内部类是 `undefined`。而 `activate()` 返回 `void`，`ext.exports` 也是 `undefined`。
- **`build:cli` 的 tsc 只沿 CLI 依赖链**：`WiFiDeviceDiscovery` / `HardwareDriverManager`
  不在链上 ⇒ 干净构建后 `out/services/`、`out/drivers/` 里根本没有它们。
  （历史教训：本地 `out/` 曾有全量 tsc 的残留，导致"本地能跑、换机 blocked"。）

### ⚠️ 不要用 `tsc -p tsconfig.json` 直出 `out/`

实测：那会**覆盖 `out/extension.js`**，把 webpack bundle 换成 tsc 裸编译版
（`__webpack_require__` 计数 82 → 0），真宿主加载会崩 —— 比原缺陷更危险。
所以 `tsconfig.e2e-libs.json` 把 `outDir` 指到 `out/e2e-libs/`。

### 场景如何声明

```js
module.exports = {
  id: "my-scenario",
  needsE2eLibs: true,     // ← 声明它需要 out/e2e-libs/
  ...
};
```
runner 见到该标志会在**开跑前**检查目录，缺失直接 `EXIT=1` 并指路
（而不是让场景记 `blocked` —— 那看起来像环境问题）。

场景内取产品类统一走一个 helper（**别写死 `out/xxx/yyy.js` 路径**）：
```js
function loadProductModule(relativePath) {
  return require(`../../../../../out/e2e-libs/${relativePath}.js`);
}
// 用法：loadProductModule("services/WiFiDeviceDiscovery")
```

> 加载的仍是**产品代码**（同一份 `src/` 的编译产物），不是测试侧替身。

### ⚠️ webpack 的 `clean: true` 会清空 `out/`，破坏 `e2e-libs`

`npm run build` 中的 webpack 配置了 `clean: true`，构建时会直接抹掉整个 `out/` 目录（包括之前编译好的 `out/e2e-libs/`）。
因此，**改动产品代码后的完整构建命令必须是：**

```sh
npm run build && npm run build:e2e-libs      # ← 两个都要执行
```

若漏跑 `npm run build:e2e-libs`，声明了 `needsE2eLibs: true` 的场景（如 `network-capture-mock`）在运行前会被 runner 拦截报错：
`❌ out/e2e-libs/ 缺失 —— 本场景需要按类名加载产品模块`。

---

## 六点五、⚠️ `_probe-fakegreen` 探针 —— **不要删**

`scenarios/common/_probe-fakegreen.scenario.cjs` 是**防复发探针，不是常规场景**。

| 项 | 内容 |
|---|---|
| 作用 | 主动 `throw`，用来证明 runner **不会把崩溃报成通过** |
| 何时生效 | 仅 `LA_E2E_PROBE=1` 时注册（默认不在 `--list` 里） |
| 为什么默认关 | 常驻会让全量 e2e 永远挂一条 fail，把退出码从 3 拉到 1 —— **污染真实基线** |
| 为什么必须留 | 三层假绿防御（`oracles` / `host-driver` / `runner`）若被改回去，只有它能立刻发现 |

**改了 runner / oracles / host-driver 的失败判定逻辑时，必须跑一次**：

```sh
LA_E2E_PROBE=1 xvfb-run -a node tests/e2e/vscode/lib/runner.cjs --scenario _probe-fakegreen
# 期望：❌ overall=fail + EXIT=1 + 不重试
# 若看到 ✅ overall=pass 或 EXIT=0 ⇒ 假绿回来了
```

完整背景（三处叠加的根因、逐层拆解验证表）见
`docs/e2e-found-product-bugs-2026-11-03.md` **OUT-3**。

---

## 六点六、⚠️ `_probe-notify-commands` 探针 —— 同样是**防复发探针**

`scenarios/common/_probe-notify-commands.scenario.cjs`，同样 `LA_E2E_PROBE=1` 才注册。

| 项 | 内容 |
|---|---|
| 证明什么 | **`repeatCapture` / `configureWiFi` 的前置分支里没有 `await` 弹窗**，命令会正常返回 |
| **不**证明什么 | ⚠️ **不**代表"所有命令都能跑"。`connectDevice`（`extension.ts:140`）与 `startCapture`（`:234`）确实 `await` 了弹窗，那两条在真宿主里**真的会挂** |
| 为什么必须留 | 给 `showWarningMessage` 加 `await` 看起来很无害，但会让这两条命令在真宿主永久挂起。此探针会立刻变红 |

⚠️ 别把它当通用结论。**它只覆盖这两条命令、这一个分支。**

```sh
LA_E2E_PROBE=1 xvfb-run -a node tests/e2e/vscode/lib/runner.cjs --scenario _probe-notify-commands
# 期望：两条 probe:* 都 pass（返回 + 发出预期通知）
```

### ⚠️ 计时数字不可当基线

干净环境下实测 `repeatCapture` 耗时 **246–280ms**（8 次采样：246/247/248/248/253/259/265/280），
`configureWiFi` 在 **0–1ms**。

**这些数字与"是否挂死"无关** —— 判据是"能否在 10s 内返回"，不是"多快返回"。
不要把某个具体值当成"正常基线"去对比：曾一度记录 1502ms 并归因为
"VS Code 冷启动固有开销"，8 次重复采样后**证伪** —— 那是单次环境噪声
（xvfb 启动 / 磁盘 IO / 并发负载）。

> **教训**：单次观测不足以支撑机制解释。看到异常数字时，先重复测量再下结论。

---

## 六点七、⚠️ 做产品变异测试时，**收尾必须四步齐全**

改产品代码做变异验证（看 e2e/单测会不会红）时，收尾常被写成：

```
① 还原源码        cp /tmp/fixed.ts src/...
② 重建产物        npm run build && npm run build:e2e-libs
③ 验产物内容      grep "变异标记" out/
```

**这三步不够。** 缺的第 ④ 步是唯一能覆盖「逻辑型变异」的：

```
④ 用产物跑一遍关键判据   xvfb-run ... --scenario <受影响的场景>
```

### ⚠️ 重建产物时的构建范围
- 改 `.ts` 文件（插件主进程）：需要 `npm run build && npm run build:e2e-libs`；
- 改 `.vue` 文件（Webview 前端）：同样需要 `npm run build && npm run build:e2e-libs`（由 webpack 打包前端资产，随后补齐 `out/e2e-libs/`）；
- 无论改动何处，**两种情况都必须补跑 `npm run build:e2e-libs`**，因为 webpack 的 `clean: true` 会抹掉 `out/e2e-libs/`。

### ⚠️ "双向敏感验证"的对象是「产品行为 → 判据」，不是「判据期望值 → 判据」

**教训（2026-11-04）**：
- **错误做法**：修改测试用例里的断言期望值（比如把 `assert(val === 1200)` 改成 `assert(val === 5000)`），让断言迎合当前 bug 从而变绿。
  ⇒ **这验证的是"断言能被操纵"，而不是"产品修好后判据能变绿"**。任何硬编码断言（包括恒绿代码）这样改都能通过，这是最危险的假绿伪装。
- **正确做法**：**改被测实现的代码行为**（例如在 `AppSidebarLeft.vue:127` 中将写死的 5000 改为 1200 并重建产物），观察真实判据是否因产品行为改变而由红变绿；随后还原产品代码，观察判据是否恢复报红。
  ⇒ **这验证的才是判据与产品行为之间的因果链**。

### 为什么 ①②③ 不够

`grep` 只能证明"**没有某个特定字符串**"。如果一个变异改的是**逻辑**而不是字面量
（例如 `if (a) return b` → `if (!a) return b`），`grep` 什么都查不出来。
只有跑一遍才知道产物行为对不对。

### 真实代价（2026-11-04 实际踩到）

一次变异测试收尾停在 ③ 之前：源码还原了、`git diff` 也空了，
但没核 `out/extension.js` —— 里面还留着变异文案 `MUTANT_TEXT`。
随后跑的一轮「提交前全量 e2e」**用的是那份被污染的 bundle**。

⚠️ 这次危险之处在于：**`git diff` 看不出来、单测看不出来**（它们不吃 bundle），
只有 e2e 受影响 —— 而 e2e 恰好就是那批"证明代码是对的"的证据本身。

⇒ **代码是对的，但支撑它的证据是脏的。** 这比"提交了错误代码"更难发现。

### 检查清单

```
变异测试收尾：
  □ 还原源码
  □ 重建产物
  □ 验产物内容（grep 变异标记）
  □ **跑一遍受影响场景，确认行为回到基线**   ← 最容易漏的一条
```

---

## 六点八、⚠️ 模态交互命令在真宿主下的阻塞机理与 not_exercised 留痕

在 `commands-coverage` 场景中，`connectDevice`、`startCapture`、`networkDiagnostics` 3 条命令被诚实登记为 `not_exercised`，而非假绿。

### 1. 阻塞机理实测（探针 `_probe-dialog-blocking`，2026-11-04）
- **真宿主行为**：VS Code 的 `vscode.window.showWarningMessage`（带选项按钮）与 `vscode.window.showInputBox` 在 `ExtensionMode.Test` 下处于模态等待状态，若无人工点击或交互，其返回的 Promise **永不 resolve**。
- **实测数据**：直接调用时，三条命令在 6000ms 超时限制下 **连续 3 次 100% 稳定超时挂死**（`connectDevice` 6001–6028ms，`startCapture` 6000–6002ms，`networkDiagnostics` 6001–6002ms）。

### 2. 为什么 `repeatCapture` / `configureWiFi` 能直接真执行
- 在 `extension.ts:282` / `:406` 中，调用 `vscode.window.showWarningMessage(...)` 时**没有写 `await`**（fire-and-forget），因此命令函数能立即返回并发出通知（实测 0–1ms 返回）；
- 而 `connectDevice`（`:143`）、`startCapture`（`:234`）和 `networkDiagnostics`（`:365`）显式 `await` 了弹窗返回值，整条命令被挂死在用户交互上。

### 3. 为什么并发 `notifications.clearAll` 不是合法解法（伪造假绿）
- 对照组实测：在命令触发后并发发送 `notifications.clearAll` 或 `closeQuickOpen`，`startCapture` 与 `networkDiagnostics` 会在 ~200ms 返回，**但返回值均为 `undefined`**；
- 这意味着它走入的是代码中 `if (!action) return;` / `if (!networkAddress) return;` 的**用户取消分支**，核心业务逻辑（设备连接、参数构造、数据采集、网络诊断）一行都没有跑过！
- 若以此判绿，是将“用户取消了操作”伪装成“功能被验证通过”，属于最危险的假绿。

### 4. `connectDevice` 前置耗时特性
- 对照组实测：`connectDevice` 在弹窗前会先调用 `hardwareDriverManager.detectHardware()` 探测 5 个硬件驱动；
- 在无真机环境下，各驱动等待超时（`detectorTimeout = 5000ms`），整个检测过程耗时约 5.5s；
- 弹窗在第 5 秒末才出现，因此并发 200ms 的 `clearAll` 根本打不到弹窗上，依然在 6015ms 超时挂死。

---

## 六点九、⚠️ `ui-waveform` 中 `L3-canvas-rendered` 的判别力边界与时序防抖

### 1. 时序防抖机理（`waitForCanvasRendered`）
- **现象**：在全量 E2E 中（`network-scan` 等前置多套接字负载后），`ui-waveform` 偶发报出 `L3-canvas-rendered — Canvas 完全全透明，未渲染任何像素 (60552/60552)`。
- **根因**：
  1. DOM 文本（`4 samples`）由 Vue 响应式驱动在**微任务**队列中更新，`waitForText` 瞬间判定通过；
  2. Canvas 绘制包裹在 `WaveformRenderer.ts:449` 的 `requestAnimationFrame(() => this.render())` **宏任务**中；
  3. `useWaveformViewport.ts` 中 `ResizeObserver` 触发 `resize()` 会调用 `canvas.width = rect.width * dpr`，依据 HTML5 Canvas 规范会**瞬间将整张画布重置为全透明黑（rgba(0,0,0,0)）**，然后再排队 rAF 重绘；
  4. 当系统处于密集调度时，`readCanvasStats` 紧随 `readText` 同步执行，容易正好落在画布被清空与 rAF 绘制之间的时序窗内。
- **对策**：增加 `waitForCanvasRendered` 轮询动作（以 `DEFAULT_POLL_INTERVAL_MS = 20` 轮询），一旦检测到至少一个非透明像素（`alpha !== 0`）即判定画布已完成初次光栅化并放行，消解时序竞态。

### 2. 判别力边界（能抓什么、抓不到什么）

实测基线（`tests/fixtures/lac/current-lowercase-samples.lac` 正常渲染）：`colors=174, dominant=47.5%`。

| 故障形态 | 变异方式 | 实测表现 | 判据能否抓到 |
|---|---|---|---|
| **完全未渲染** | `render()` 改为空函数 | `waitForCanvasRendered` 超时（5000ms）报红 | ✅ 能抓到（L3 明确报 `等待 Canvas 渲染超时`） |
| **仅绘制纯底色** | 绘制背景后直接 `return` | `colors=2 < 5`，L3 原生判据报红 | ✅ 能抓到（L3 报 `Canvas 颜色种类数 2 < 5`） |
| **大面积底色遮挡** | 异常色块覆盖 | `dominantColorRatio >= 0.95` 报红 | ✅ 能抓到 |
| **⚠️ 波形线条缺失** | 跳过 `renderChannelSegment` | `colors=159 >= 5, dominant=48.4% < 95%` | ❌ **抓不到（仍判 pass）** |

### 3. 为什么「波形线条缺失」抓不到
- `WaveformRenderer.render()` 的绘制流程中，`renderTimeAxis`（时间轴刻度线与时间文本）与 `renderChannelLabels`（通道名称与标签文本）包含大量矢量笔画与字体抗锯齿边缘过渡色；
- 仅时间轴与通道标签两项就贡献了 **159 种颜色**；
- 真实的波形彩线（4 样本方波）仅使颜色种类由 159 增加到 174（净增 15 种）；
- 现有全局像素统计判据（`colorVariety >= 5`）的阈值远低于时间轴/文本抗锯齿所产生的颜色基数，因此波形线条被完全淹没在刻度与标签的颜色中。

### 4. L3 判据缺口的最终结论（2026-11-04）

尝试过的方案：
1. **全画布 colorVariety**：抓不到（时间轴/标签抗锯齿贡献 159 色，波形仅 15 色）；
2. **绘图区色度检测**：易受不同主题和单色通道配置干扰；
3. **绘图区局部颜色种类数（`plotAreaColorVariety`）**：实测基线 `plotColors=17`，精确跳过 `renderChannelSegment` 变异后 `plotColors=10`。两者仅差 7 种颜色，极易在单通道、不同缩放比或无跳变平直信号下产生重叠导致误判。

⇒ **最终裁定：选择选项 B（诚实留痕，不再硬设脆弱阈值）**。在**不侵入修改产品渲染代码**的前提下，纯靠端到端像素宏观统计无法在零误伤前提下可靠区分「波形线条是否绘制」。此项作为已知边界保留，底层绘制正确性由 `WaveformRenderer.branches.test.ts`（101 个单元测试用例）在代码级进行坚实保护。

若未来需要覆盖，正规解法是在产品端暴露「实际绘制线段/通道数」的可观测指标，而非从黑盒像素逆向猜测。

---

## 七、目录结构

```
tests/e2e/vscode/
├── lib/
│   ├── runner.cjs      # 外层启动器：隔离 profile → @vscode/test-electron → 汇总
│   ├── env.cjs         # 前置检查（DISPLAY / 产物 / 读 manifest 命令清单）
│   ├── profile.cjs     # profile 隔离、进程回收、残留清扫
│   ├── oracles.cjs     # 结果契约（pass/fail/not_exercised/blocked + 最差状态汇总）
│   ├── mockDevice.cjs      # 协议级模拟设备（严格按固件线协议实现）
│   └── _selftest-mockDevice.cjs  # 模拟器自测（11 条，含与产品 serialize() 逐字节对账）
├── host-driver.cjs     # 宿主内入口（extensionTestsPath）
├── scenarios/
│   ├── index.cjs       # 场景注册表（**单一来源**，新场景必须登记）
│   ├── common/         # 与硬件无关
│   │   └── _probe-fakegreen.scenario.cjs   # ⚠️ 防复发探针，见 §6.5
│   └── hardware/       # 需要真机（默认 not_exercised）
└── artifacts/latest/   # 每次跑的 summary.json（可机读）
```

## 八、与参考仓的关系

形态上照抄 `venus-studio/scripts/venus-editor-e2e/` 与
`embedded-studio/scripts/vscode-e2e/` 的**隔离与清理**做法（每场景 `mkdtemp` +
`--user-data-dir` + `--extensions-dir` + 进程回收）。

**但没有照抄两条**，因为实测不成立或本仓不适用：

1. embedded-studio 说「必须先 `activate()` 否则命令不存在」—— 实测本仓在 1.74.3 下会**隐式激活**（§5.3）
2. venus-studio 的 webview 桥（`__runEditorScenario`）—— 那是**产品里的测试命令**，本批不做（§六）

## 九、相关文档

| 文档 | 内容 |
|---|---|
| `docs/open-decisions-2026-11-03.md` | **待裁定事项汇总**（6 条，含影响面与建议） |
| `docs/test-architecture-2026-11-03.md` | 测试体系总览（jest projects / 各脚本 / UI 桥架构） |
| `docs/e2e-coverage-matrix-2026-11-03.md` | 9 个场景（4 命令层 + 5 UI 层）的覆盖矩阵 |
| `docs/e2e-found-product-bugs-2026-11-03.md` | e2e 抓到的 5 个产品缺陷 + 1 个范围外缺陷 |
| `docs/test-coverage-gaps-2026-11-03.md` | 删除的测试及**留下的真实覆盖缺口**（不做出无痕） |
| `docs/bug2-export-command-evaluation-2026-11-03.md` | BUG-2「该不该加导出命令」的三问分析 |
| `docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md` | 固件可构建性证明（烧录待授权） |
