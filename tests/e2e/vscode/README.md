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

## 七、目录结构

```
tests/e2e/vscode/
├── lib/
│   ├── runner.cjs      # 外层启动器：隔离 profile → @vscode/test-electron → 汇总
│   ├── env.cjs         # 前置检查（DISPLAY / 产物 / 读 manifest 命令清单）
│   ├── profile.cjs     # profile 隔离、进程回收、残留清扫
│   └── oracles.cjs     # 结果契约（pass/fail/not_exercised/blocked + 最差状态汇总）
├── host-driver.cjs     # 宿主内入口（extensionTestsPath）
├── scenarios/
│   ├── index.cjs       # 场景注册表（**单一来源**，新场景必须登记）
│   ├── common/         # 与硬件无关
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
