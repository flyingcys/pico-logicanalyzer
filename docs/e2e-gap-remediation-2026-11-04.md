# e2e 覆盖缺口与修复台账（2026-11-04）

> **✅ 状态：全部结项（2026-11-05）。** 8 项 e2e 缺口 + 2 项技术债均已实现并验收，CI 连续 5 次绿。
>
> **本文档是 2026-11-04 双方（b3 / 05）9 轮 PK 的全部结论，作为逐项实施的唯一依据。**
> 需求方于同日裁定：**一项一项实现，05 实现、b3 验收，双方 PK 认同后才进入下一项。**
>
> - 基线 commit：`ac9f7bac`
> - 需求方裁定：① `defaultSampleRate` 默认值 = **1000000**（改 manifest）
>   ② P0-2a 范围 = **选项 1（连前端一起改）** —— 此项覆盖了双方 PK 的一致推荐

---

## ⚠️ 本批工作的边界（必读）

**全部 10 项都是纯软件层。真机验证一项都没做。**

| 真机才能验的 | 为什么 mock 测不了 |
|---|---|
| DMA 溢出 / 缓冲区 overrun | 需要真实数据吞吐压力 |
| PIO 硬件触发延时 | 纳秒级物理时序 |
| USB 物理拔插 | `ENOENT` / `EBADF` 异常路径 |
| 电气特性 | DTR/RTS 电平、真实波特率时序误差 |
| 晶振温漂 | 采样率累积漂移 |

固件可编译（`docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md`），
但**烧录待需求方授权**。这 10 项闭环不代表产品可在真机上工作。

---

## 零、e2e 基线：开工前 vs 结项后

### 开工前（`ac9f7bac`，本台账的起点）

```
13 场景 / 99 条 oracle
pass=95  not_exercised=3  blocked=1  fail=0
EXIT=3（无 fail，但有未验项 —— 按设计「有未验项就不算通过」）

⚠️ commands-coverage（3 条命令 not_exercised）
⛔ ui-export-button（export-persistence blocked）
❌ CI 连续 8 次全红（当时未知，项 6 才发现）
```

### 结项后（`049e0621`，b3 独立复测）

```
14 场景 / 113 条 oracle
pass=108  not_exercised=4  blocked=1  fail=0
默认模式    EXIT=3（语义未被洗掉）
白名单模式  EXIT=0（5 条未完成项全部命中 known-incomplete.cjs）
delegateProblems = []

全量单测: 2458 passed / 107 skipped / 0 failed（96 suites）
CI:       连续 5 次绿，含真宿主 e2e 步骤真跑
```

**新增场景**：`ui-default-sample-rate`（项 5 落地的配置穿透判据）。
**oracle 净增 14 条**（含项 8 给 `network-capture-mock` 补的 5 条 webview 路径判据）。

---

## 一、任务清单（按实施顺序，逐项验收）

### 项 1 — P0-1a：F1 / Ctrl+Shift+D 补 listener

| 字段 | 内容 |
|---|---|
| **缺陷** | `KeyboardShortcutManager` 派发 `show-shortcut-help` / `panel-toggle` 两个 CustomEvent，**全仓零 `addEventListener`** |
| **影响** | 按 `F1` 帮助不弹；按 `Ctrl+Shift+D` 解码面板不切 |
| **改动位置** | `src/frontend/core/utils/KeyboardShortcutManager.ts:433,440` 派发点<br>消费方：`uiStore.showShortcutHelp` / `uiStore.activeTab` |
| **判据** | 按 F1 后 `uiStore.showShortcutHelp === true`；按 Ctrl+Shift+D 后 `uiStore.activeTab === 'decoder'` |
| **变异验证** | 删掉 listener → 判据必红 |
| **状态** | ✅ 已验收（`ff277a7c`） |

### 项 2 — P0-1b：删 Ctrl+Shift+M 声明

| 字段 | 内容 |
|---|---|
| **缺陷** | 声明「切换测量面板」，但**该面板不存在** |
| **证据** | `AppSidebarRight.vue:18` → `type SidebarTab = 'decoder' \| 'performance'`<br>`uiStore.ts` 全文只有 `activeTab` / `showShortcutHelp` |
| **影响** | 快捷键帮助弹窗向用户承诺了做不到的功能 |
| **改动位置** | `KeyboardShortcutManager.ts:269-275` 整块删除 |
| **判据** | `getShortcutsByCategory()` 不再含 `toggle-measurement-panel` |
| **变异验证** | 保留声明 → 判据红 |
| **状态** | ✅ 已验收（`a2c4639f`） |

### 项 3 — P0-1c：删 1/2/3/4 通道切换声明

| 字段 | 内容 |
|---|---|
| **缺陷** | 声明「切换通道1~4」，但**无任何 UI 能改 `channel.hidden`** |
| **证据** | `channel.hidden` 被渲染器消费（`WaveformRenderer.ts:205,464,739`），但全仓无 toggle 函数、无眼睛图标入口 |
| **判定** | 属**未完成的新功能**（L1 三问：无它时既有路径已成立）⇒ 删声明，不做半成品 |
| **改动位置** | `KeyboardShortcutManager.ts:225,233,241,249` 四条<br>`triggerChannelToggle` 方法若成死代码一并删 |
| **判据** | `getShortcutsByCategory()` 不再含 `toggle-channel-*` |
| **状态** | ✅ 已验收（`6c67cb3d`） |

### 项 4 — P0-2b：`maxRetries` 配置接线

| 字段 | 内容 |
|---|---|
| **缺陷** | `package.json:194` 声明 `default: 5`，但**全仓零处读取** |
| **改动位置** | `NetworkStabilityService.ts:89` `resolveNetworkStabilityConfig` 补 `maxRetries`（fallback **5**） |
| **调用点（实测 2 处）** | `src/extension.ts:86`<br>`src/providers/LACEditorProvider.ts:795` |
| **判据** | ① `NetworkStabilityService.accurate.test.ts:133` 的 `toEqual` 同步加 `maxRetries: 5`<br>② 新增「缺省时返回 5」用例（**mock 的 `get` 必须返回 `defaultValue`，不能返回 `undefined`**） |
| **变异验证** | M1 fallback 5→3 → ②双断言必红<br>M2 删掉读取 → ①②必红 |
| **状态** | ✅ 已验收（`1e12627c` + 补漏 `d9be6fa4`） |

> ⚠️ **`:142` 的「优雅降级」测试不会因本改动变红** —— 因为 mock 的 `get` 返回 `undefined`，
> 被 `typeof !== 'number'` 过滤掉。所以它**不能**用来验证「缺省 5」。

### 项 5 — P0-2a：`defaultSampleRate` 配置接线（范围 = 选项 1）

| 字段 | 内容 |
|---|---|
| **缺陷** | `package.json:144` 声明 `24000000`，代码 14 个月来实际跑 `1000000`，且**配置从未被读取** |
| **需求方裁定** | 默认值定 **1000000**；范围选 **选项 1（连前端一起改）** |

**改动面（5 处，缺一不可）**

```
a1  package.json:144   "default": 24000000 → 1000000
    且 description 注明作用域
a2  src/extension.ts:118   openAnalyzer 读配置（fallback 1000000）
a3  src/extension.ts:817   getCaptureConfiguration 读配置（fallback 1000000）
a4  跨端契约：
    a4-1  FrontendDeviceStatus 加字段   deviceStore.ts:54
    a4-2  vscode host 构造该字段        LACEditorProvider.ts:1526 createDeviceStatus
    a4-3  web-app host 构造该字段       browserHost.ts:882 createStatus
    a4-4  前端 applyStatus 消费        deviceStore.ts:197
    a4-5  单测：三处契约各自断言
```

> ⚠️ **a4-3 容易漏**：项目 CLAUDE.md 要求「web-app 和 vscode 插件必须使用同一套代码」，
> 漏改 `browserHost.ts` 会导致 web-app 行为分裂。

**判据**

```
e2e open-analyzer 三次对照：
  ① 配置 = 8000000  → frequency === 8000000     抓「完全忽略配置」
  ② 配置 = 16000000 → frequency === 16000000    抓「只读第一次/缓存」
  ③ 不设置（默认）   → frequency === 1000000     抓「fallback 与 manifest 不一致」

⚠️ ①② 必须是【非默认值】。若第二次用 1000000，产品写死 fallback 会假绿。

e2e ui-* ：webview 首次采集的 payload.frequency 应等于配置值
单测：showInputBox 的 opts.value 断言
SyntheticCaptureCommand.test.ts:118 必须保持绿（DSL 独立链路，不受本配置影响）
```

**变异验证**

```
M3  产品写死 1000000        → ①② 必红
M4  fallback 改 3000000     → ③ 必红
M5  browserHost 漏改        → web-app 编译失败或单测红
```

**状态** | ✅ 已验收（后端 `e3747f35` / 前端 `d36f5f05`） |

### 项 6 — P1-1：e2e 接入 CI

| 字段 | 内容 |
|---|---|
| **缺陷** | `.github/workflows/quality-gate.yml` **零 e2e**（`grep -rn "test:e2e\|xvfb" .github/` 无命中）⇒ 99 条 oracle 无自动化保护 |
| **可行性** | 实测全量 97 秒 |
| **CI 步骤** | `sudo apt-get install -y xvfb`<br>cache `.vscode-test/`<br>`npm run build && npm run build:e2e-libs`（`build` 的 clean 会删掉 e2e-libs）<br>`xvfb-run -a npm run test:e2e` |
| **判据** | PR 上 e2e 真跑并影响退出码 |
| **状态** | ✅ 已验收（`ceb4b269` + `aa8c1f61` + `a798f1ed`） |

> 同样被排除的还有 `test:frontend:smoke`（`webview-browser-smoke.js`，带真 Chrome 验 SPI 渲染）。

### 项 7 — P1-2：`needsHardware` 真门控

| 字段 | 内容 |
|---|---|
| **缺陷** | `runner.cjs` 原先只 `console.log`，**不做任何运行时门控** |
| **影响** | README 写的「`hardware/` 目录默认登记为 not_exercised」机制不存在；真机场景写 `needsHardware: true` 会在无硬件环境直接 fail |
| **改动位置** | `lib/runner.cjs`、新增 `lib/hardwareProbe.cjs`、新增 `lib/known-hardware-scenarios.cjs`、`lib/knownIncompleteGate.cjs`、`lib/_selftest-known-incomplete.cjs`、README |
| **判据** | ① 已登记硬件场景 + 无硬件 → 跳过但生成 `not_exercised` summary（`hardware-unavailable`），默认仍 EXIT=3 ② **未登记却声明 needsHardware → 非 0 并点名**（堵「加个标记让 oracle 消失」的后门）③ 登记表 stale（登记了但场景不存在/未声明）→ 非 0 ④ 硬件跳过项不参与白名单比对，但必须留痕 |
| **变异验证** | ① 删掉门控 → 场景变 fail ② 给未登记场景加 `needsHardware: true` → EXIT 非 0 ③ 登记表写一个不存在的场景 → EXIT 非 0 ④ 已登记场景无硬件 → EXIT=0 且 summary 有记录、`profileRemoved=true` |
| **实测要点** | `profileRemoved` 必须显式 `true`（未启动宿主即无残留），否则 gate 判为残留 → EXIT=1；子集运行（`--scenario`）时未跑到的登记项**不算 stale**，只对本次已执行场景强制 |
| **状态** | ✅ 已验收（`92b77b75`） |

### 项 8 — P2-1：`network-capture-mock` 改由 webview 驱动

| 字段 | 内容 |
|---|---|
| **缺陷** | 场景直调 `out/e2e-libs/` 的 `hardwareDriverManager`（`:296`），**绕过了产品真正的连接入口** |
| **被绕过的链路** | `LACEditorProvider.connectToNetworkDevice` → `NetworkStabilityService.connect()` + `startHeartbeat()` + `startQualityMonitoring()` —— **e2e 一条都没走到** |
| **改法** | 用 `__runEditorScenario` 驱动侧栏填 `127.0.0.1:<port>` 点「网络」<br>让 bundle 内的 `connectToNetworkDevice` 跑通 |
| **判据** | 原有 12 条 oracle 保持 pass + 新增至少 1 条证明走了 `NetworkStabilityService` |
| **状态** | ✅ 已验收（`1a7c5216` + `76c5cb96`） |

---

## 二、记录在案、不计入待办

| 项 | 结论 | 证据 |
|---|---|---|
| **`launcher` 侧栏无 provider** | **不是缺陷**，是需求方刻意设计 | `abd5d6e0 feat(vscode): 添加 Activity Bar 入口`（作者 flyingcys）<br>`QualityGateConfig.test.ts:132-155` 守卫<br>`viewsWelcome` 正是为无 provider 视图设计的 |
| **e2e 够不着侧栏 DOM** | 平台边界 | `__runEditorScenario` 的 `resolveScenarioWebview` 只能解析 Custom Editor Webview |
| **`connectDevice` / `startCapture` / `networkDiagnostics`** | 真宿主弹窗挂死 | 已实测 3 次，各 6000-6028ms 超时；单测已覆盖前置分支 |
| **`export-persistence`** | `showSaveDialog` 不可自动化 | 底层落盘已由 `LACEditorProvider.exportPersistence.test.ts` 真写临时目录覆盖 |
| **webview 采集主路径原不读配置** | 已由项 5 的 a4 覆盖 | 需求方选选项 1 |
| ~~**`.eslintcache` 被 git 跟踪**~~ | ✅ **已清理**（`bf0e25f5`） | `git rm --cached` 解除跟踪；b3 独立验证 `npm run lint` 后 `git status` 完全空输出 |
| ~~**三文件死代码簇**~~ | ✅ **已清理**（`049e0621`） | `stage7-self-test.ts` / `week3-self-test.ts` / `test-decoder-integration.ts`，净删 1025 行。**bundle 字节数删前后完全相同（2,427,381）** —— 铁证不进产物。删前核实：三份文件头均为自测性质、六个被覆盖模块各有独立单测、CI 门禁零依赖 |

---

## 三、PK 过程中双方各自认领的错误（留档，防复发）

| 谁 | 错误判断 | 被谁推翻 | 推翻依据 |
|---|---|---|---|
| b3 | `launcher` 无 provider = 产品缺陷 | 05 | commit `abd5d6e0` + 单测守卫 + VS Code 机制 |
| b3 | 调用点 `LACEditorProvider.ts:792` | 05 | `grep` 实际是 `:795` |
| 05 | 「UI→驱动→采集整条链架构上被阻断」 | b3 | 调用链：`connectDeviceFromPayload` → `connectToNetworkDevice` → bundle 内 `hardwareDriverManager` |
| 05 | 「7 条死快捷键补 listener 即可」 | b3 | 逐条核实：只有 2 条有功能承载，5 条是幽灵功能 |
| 05 | `maxRetries` fallback 写 3 | b3 | `package.json:196` 与 `defaultConfig:132` 都是 5 |
| 05 | 「单测不锁 value ⇒ 具备单测安全性」 | b3 | 方向反了：不锁 = 改错了也不红 = 裸奔 |
| 05 | 「open-analyzer 场景基准是 1MHz」 | b3 | 实际是 `!(frequency > 0)`，未写死 |
| 05 | 双配置对照用 8MHz vs **1MHz** | b3 | 第二次用默认值 ⇒ 写死 fallback 会假绿 |
| b3 | 漏了 webview 采集路径不读配置 | 自纠 | 追数据流时发现 `deviceStore.ts:73` 硬编码 |

**结论：没有一方原始判断全对。** 双方各认领 4 项与 1 项错误。

### 实施阶段双方新认领的错误

| 谁 | 错误 | 发现方式 |
|---|---|---|
| 05 | 项 4 报告「4 个套件 145 passed」，漏跑 `LACEditorProvider.coverage.test.ts` | b3 项 5 跑全量单测时暴露 |
| **b3** | 项 4 验收也只跑了 2 个文件，同样漏跑 | 同上，自查 |
| **b3** | 在共享工作区打 MUTANT 补丁，与 05 的变异实验撞车 | 05 主动发消息叫停 |
| **b3** | 断言「CI 可能该把单测也加进去」，实际 CI 一直在跑 | 05 重读 workflow 纠正 |
| **b3** | 预判「browserHost 单测薄，M5 大概率绿」，实测红 | 05 补测试后推翻 |
| **b3** | 独立变异时构造错 stale 测试，差点误判 05 实现有 bug | 读代码后自查 |
| 05 | 项 8 首次变异 M1 假绿（绝对数判据被冲淡） | **05 自己发现并修** |
| 05 | 项 8 首次变异 M2 假绿（窗口 = 默认值） | **05 自己发现并修** |

**⇒ b3 在实施阶段的错误比 05 多。** 特别是「验收方在共享工作区打补丁」那条，是纪律性错误。

---

## 四、实施纪律

1. **一项一项来** —— 05 实现 → b3 验收 → 双方 PK 认同 → 才进入下一项
2. **变异验证必须实际跑并贴原始输出**，不接受推演
3. **每项交付前跑 lint + 相关测试**，工作区干净后报验收
4. **提交信息末尾加**：
   ```
   Co-Authored-By: pico-logicanalyzer-05 <pico-logicanalyzer-05@local>
   Co-Authored-By: Claude Code <noreply@anthropic.com>
   ```
5. **判据测的维度必须 == 出错的维度**；「改了却不红」要先自证是探针没打在生效路径上还是判据不判别
6. **加分项也要先报备再动手**（2026-11-04 项 2 实际发生）
   - 05 在项 2 里自行新增了 `tests/unit/frontend/ShortcutHelpDialog.shortcuts.test.ts`（83 行）。
     该文件质量好，但 `ShortcutHelpDialog` 此前**零测试**，属于独立议题，不是项 2 的附属品。
   - 后果：项 3 删 1/2/3/4 时，该测试里的「通道控制 (4)1切换通道1…」断言会一起变，
     才发现同一个提交里绑了两个议题。
   - **规矩**：加分项先问，验收方有权不接；已接受的，必须在下一项交付里**显式说明连带影响**。
7. **每项交付必须跑「全量单测」，贴汇总行**（2026-11-04 项 4/5 实际踩到）
   - 项 4 给 `resolveNetworkStabilityConfig` 加 `maxRetries` 后，
     `tests/unit/extension/LACEditorProvider.coverage.test.ts:2205` 的 `toEqual` 精确比对变红。
     **05 报告「4 个相关套件 145 passed」不含该文件；b3 验收也只跑了两个文件 —— 双方都漏。**
   - 该红测试一路活到项 5，直到 b3 跑 `npx jest tests/unit` 才暴露。
   - **根因不是「忘改一条断言」，是验证矩阵一直是「跑我改的那几个文件」而不是「跑全量」。**
     同族模式已出现两次（项 2→3 的 `ShortcutHelpDialog` 绑死风险、项 4 的 `maxRetries` 漏网）。
   - **规矩**：每项交付贴 `npx jest tests/unit` 的 `Tests:` 汇总行；不只是改动的文件。
8. **`pre-commit` 从不跑单测**（2026-11-04 查清）
   - `package.json` 的 `validate:local` 里是 `ci-test-runner --layer=quick --dry-run`，
     **`--dry-run` 只打印计划，不真跑测试**。
   - 所以红测试无法被 pre-commit 拦住。这是结构性问题，**改它会显著拖慢提交，属独立议题**，
     与项 6（e2e 进 CI）一起评估，不混入任何单项。
9. **⚠️ CI 红了必须有人看**（2026-11-04 事故，比任何单项都严重）
   - `gh run list --limit 8`：**连续 8 次全红**，从 `41803296988`（09:25）到 `41847284387`。
   - **CI 在「单元测试」这一步就死，后面 6 个门禁（integration / quick / web-app / driver /
     decoder / package:dry）从头到尾没执行过。**
   - 两个不同根因：最早是 CI 从不 `npm run build` ⇒ 缺 `out/cli/` ⇒ `CliExportCommand.test.ts` 5 条红；
     项 4 后叠加 `LACEditorProvider.coverage.test.ts`（正是我们本地发现、`d9be6fa4` 修掉的那条）。
   - **⇒ 我们之前判断的「全量单测没人跑」是错的：CI 一直在跑，只是红了没人看。**
   - **纪律**：每次 push 后 `gh run list --limit 3` 看一眼。这是流程问题，代码解不了。
10. **⚠️ 验收方的变异验证不得在共享工作区做**（2026-11-04 实际踩到）
   - b3 在 05 的工作区直接 `sed -i` 打 MUTANT 补丁做验收，与 05 自己的变异实验撞车，
     双方备份链脱节，一度分不清「谁还原失败了」。
   - **正确做法**：`cp -r <repo> /tmp/verify-<ts>/` 用隔离副本；或采信对方的原始输出 + 要求能复跑。
   - **变异验证一律加 `--no-cache`**：jest 缓存会让「恢复后的绿」是假的
     （实测：源码仍有 `// MUTANT` 残留时，不带 `--no-cache` 跑出 4 passed）。

---

## 五、进度跟踪

| # | 项 | 状态 | commit | 验收结论 |
|---|---|---|---|---|
| 1 | P0-1a F1/Ctrl+Shift+D listener | ✅ 已验收 | `ff277a7c` | b3 在隔离副本跑 4 类变异（删两个监听 / toggle 改赋值 / 删清理），**每个只红对应判据**，确认判据相互独立 |
| 2 | P0-1b 删 Ctrl+Shift+M | ✅ 已验收 | `a2c4639f` | 产品源码零残留；b3 隔离副本反向变异（加回声明）→ 注册表 + 用户可见清单**双层同时击红** |
| 3 | P0-1c 删 1/2/3/4 | ✅ 已验收 | `6c67cb3d` | 产品源码零残留（含 `triggerChannelToggle` 死代码）；b3 隔离副本反向变异 → 双层同时击红；`ShortcutHelpDialog` 测试改为模式匹配断言 |
| 4 | P0-2b maxRetries | ✅ 已验收 | `1e12627c` | fallback=5；b3 三个变异（M1 fallback→3 / M2 删读取 / **M3 删调用点**）全部击红。05 额外自查出 `Extension.coverage.test.ts:285` 的 `toEqual` 也会红，并加哨兵值 7 锁住调用点 |
| 5 | P0-2a defaultSampleRate（选项 1） | ✅ 已验收 | `e3747f35` + `d36f5f05` | 后端 b3 两个真宿主变异正交（M1 写死→只红①②、M2 fallback 漂移→只红③）；前端 5 个单测变异（M4a/b/c/M5/M6）加 1 个 e2e 变异全部独立击红。05 **推翻了 b3 的预判**（M5 预判绿、实测红）。额外发现第 4 处构造点 `FrontendBootstrapData` |
| 5b | 补项 4 漏网断言 | ✅ 已验收 | `d9be6fa4` | 哨兵 `maxRetries: 11`；b3 独立复跑全量单测 2452 passed；并变异「写死 5」验证判据有效 |
| 6 | P1-1 e2e 进 CI | ✅ 已验收 | `ceb4b269` `aa8c1f61` `a798f1ed` | **CI 24 步首次全绿**（run `41882205445`），含 e2e 真跑。b3 做了 6 个独立变异（含 status 改名、stale）全部符合预期；EXIT=3 默认语义未被洗掉。CI 过程中还暴露并修掉两个既有缺陷：`LogicAnalyzerDriver.test.ts` 遗留 60s 定时器崩溃、`safeDetect` 定时器泄漏（**产品真 bug**） |
| 7 | P1-2 needsHardware 门控 | ✅ 已验收 | `92b77b75` | CI 连续 2 次绿（`41926526379`）。b3 **亲自攻后门**（给 `network-capture-mock` 加 `needsHardware: true`）→ EXIT=1 并点名，堵死。b3 做 6 个独立变异（含「硬件跳过不能洗白新增未登记」）全部符合。自检 17 例全过。05 主动修了「子集运行 stale 误判」 |
| 8 | P2-1 mock 改由 webview 驱动 | ✅ 已验收 | `1a7c5216` | **零产品源码改动**。主路径改真 webview 驱动，18 oracle（17 pass + 1 登记未验）。b3 独立跑 M1/M2/M5 三个变异全部命中；05 自报并修掉两个假绿（绝对数→增量、窗口=默认值→2×配置间隔），b3 复现确认修好 |
| A | 解除 `.eslintcache` 跟踪 | ✅ 已验收 | `bf0e25f5` | b3 独立验证 `npm run lint` 后 `git status` 完全空输出（改动前每次都有 ` M .eslintcache`） |
| B | 删除三文件死代码簇 | ✅ 已验收 | `049e0621` | 净删 1025 行。**bundle 字节数删前后完全相同（2,427,381）**，配合「临时 import → +565,167 字节」变异，双向证明不进产物。b3 额外核了「删除是否丢失覆盖」：六个模块各有独立单测 |

**图例**：⬜ 待实现 / 🔄 实现中 / 🔍 待验收 / ✅ 已验收 / ❌ 验收未通过

---

## 六、覆盖缺口与后续推进台账（2026-11-05 需求方裁定）

> **裁定原话**：「保留现在的 14/113，把以上写清留在台账，等真机到了推进，现在只更新文档」；
> 对「UI 场景用 `copyFileSync` 准备 fixture、不走 `showSaveDialog` 另建一份」这一项，
> 需求方问「打开真文件这个有价值吗」，评估结论为**低价值、不单独开项**（见 §6.3）。
>
> ⚠️ **本节的「不做」不是遗漏**：每一条都写明为什么不做、由什么承接，防止后人「顺手补上」。

### 6.1 当前软件层基线（2026-11-05 实跑复核，非凭印象）

```
$ xvfb-run -a npm run test:e2e:noxvfb -- --allow-registered-incomplete   → EXIT=0
$ cat tests/e2e/vscode/artifacts/latest/summary.json
scenarioCount: 14
oracle: {'pass': 108, 'fail': 0, 'blocked': 1, 'not_exercised': 4}   total: 113
delegateProblems: []
默认模式（不带开关）：EXIT=3（语义未被洗掉，见 README §三）
白名单模式：EXIT=0（5 条未完成项全部命中 known-incomplete.cjs）

全量单测: 2458 passed / 107 skipped / 0 failed（96 suites）
CI:       连续 5 次绿，含真宿主 e2e 步骤真跑
```

| 场景 | oracle | overall |
|---|---|---|
| commands-coverage | 10 | not_exercised（3 条登记未验） |
| open-analyzer | 7 | pass |
| create-synthetic-capture | 5 | pass |
| network-scan | 5 | pass |
| ui-waveform | 6 | pass |
| ui-channel-config | 7 | pass |
| ui-trigger-config | 10 | pass |
| ui-export-button | 5 | blocked（1 条登记未验） |
| ui-decoder / -spi / -uart / -can | 7 / 9 / 9 / 10 | pass |
| ui-default-sample-rate | 5 | pass |
| network-capture-mock | 18 | not_exercised（1 条登记未验） |

**已覆盖的软件层能力**：命令注册对账与前置分支、`.lac` 真落盘与解析、DSL→LAC、
网络扫描预算/配置/可观测、Waveform Canvas 三层渲染、通道/触发/解码四大总线 UI 参数联动、
导出按钮状态机、`defaultSampleRate` 从 manifest → 宿主 → Webview 全链路、
Webview 侧栏连接 → `NetworkStabilityService` → 心跳 → 采集帧 → 设备侧逐字节对账。

### 6.2 五条未到 pass 的 oracle：**明确不做，永久登记（等真机再议）**

| oracle | 状态 | 为什么自动化做不到 | 现在由谁承接 | 处置 |
|---|---|---|---|---|
| `commands-coverage / not-executed:connectDevice` | not_exercised | `extension.ts:143` `await showWarningMessage` 在真宿主**永不 resolve**（探针实测各 3 次 6001-6028ms 超时）；并发 `notifications.clearAll` 对照组仍 6015ms 超时 | `Extension.coverage.test.ts:602-635`（3 条单测覆盖网络连接分支、缺端口、非法端口） | **不补 e2e**。已在 `known-incomplete.cjs` 登记；真机/可交互宿主到位后再评估 |
| `commands-coverage / not-executed:startCapture` | not_exercised | `extension.ts:234` `await showWarningMessage` 同上；对照组 208ms 返回但走「用户取消」分支，未触达采集逻辑 | `Extension.coverage.test.ts:728-755`（覆盖无设备点击连接/取消、采集参数取消） | **不补 e2e**，同上 |
| `commands-coverage / not-executed:networkDiagnostics` | not_exercised | `extension.ts:365` `await showInputBox` 同上；对照组 206ms 返回但走取消分支 | `Extension.coverage.test.ts:710-726`（覆盖取消、合法地址、非法地址） | **不补 e2e**，同上 |
| `ui-export-button / export-persistence` | blocked | `LACEditorProvider.exportData:463` 的 `showSaveDialog` 永不 resolve（README §5.1）；它是 private 方法、无 `vscode.commands` 入口，**不能加 `targetUri` 测试后门**（e2e 第一原则） | `LACEditorProvider.exportPersistence.test.ts`（临时目录真写文件，4 种格式 + 用户取消分支） | **不补 e2e**，已在白名单登记；真机/可交互宿主到位后再评估 |
| `network-capture-mock / quality-monitoring` | not_exercised | `NetworkStabilityService.ts:475-479` 质量监控间隔 30s，e2e 等不起；**故意不缩短**（改产品配置迁就测试＝绕过产品机制） | `NetworkStabilityService.accurate.test.ts` 定时器用例 | **不补 e2e**，已在白名单登记 |

> ⚠️ 这 5 条是**机制层面做不到**，不是「还没写」。
> 任何一条要从 `known-incomplete.cjs` 移除、或有人想用 `continue-on-error` /
> `--allow-incomplete` 洗成绿，都必须先改白名单 + 跑 17 例自检 + 在台账留痕。

### 6.3 「打开真文件」：**明确不做**（需求方 2026-11-05 裁定）

- **议题**：12 个 UI 场景用 `copyFileSync(fixture → workspaceDir)` 准备输入、再
  `vscode.open(fileUri)` 拉起 Custom Editor；有人提出应改成走产品 `showSaveDialog`
  另存一份「真文件」再打开，以覆盖「打开真文件」这条路。
- **核实**：这 12 个场景**每一个都真的执行了 `vscode.open`**（`ui-waveform` 3 处、
  `ui-export-button` 4 处、其余各 1-2 处），产品「打开 Custom Editor → 解析 LAC →
  渲染 Webview」已被重复验证几十次；`copyFileSync` 只是**给产品准备输入**，
  按 e2e 第一原则属环境准备，不是替产品做决策。
- **不做理由**：
  1. 单独建一个「打开真文件」场景，断言的是**测试侧自己的 `copyFileSync` 是否成功**，
     不是产品行为；产品坏了它不会红，测试侧坏了它才红 —— 测的维度错；
  2. `showSaveDialog` 在真宿主**永不 resolve**（README §5.1 / `_probe-dialog-blocking`
     实测），「另存真文件」这条路本身就走不通，硬做要么挂死要么造后门；
  3. 边际收益为零：`open-analyzer` 场景已验证产品命令真落盘 + `vscode.open` 拉起面板。
- **结论**：**不新增场景、不改现有 12 个场景**。此条留在台账作为「想过了、不做」的证据。

### 6.4 **等真机**再推进（唯一真正的后续阶段）

> 需求方裁定：**「等真机到了推进」**。固件可编译
> （`docs/hardware-validation/records/2026-11-03-pico-firmware-build-proven.md`），
> **烧录待需求方授权**。在此之前以下全是**待办，不是已覆盖**。

| # | 真机能力 | 为什么 mock/TCP 模拟设备测不了 | 上真机后具体断言什么 | 状态 |
|---|---|---|---|---|
| H1 | USB CDC-ACM 物理串口枚举与连接 | mock 是 TCP socket；物理路径依赖 OS 串口节点、`@serialport/bindings-cpp`、VID/PID（2E8A:000A）、DTR/RTS 复位脉冲 | 插入后 1s 内枚举成功；二进制握手返回真实固件版本；DMA 样本与外加信号时序吻合 | ⬜ 等真机 + 授权 |
| H2 | DMA 缓冲区 overrun / 高频采样极限 | mock 数据是数学理想数组，无物理吞吐瓶颈与 SRAM 溢出 | 24MHz×8 通道下 `OVERRUN` 标记能被驱动截获并传至 Webview 告警；长采样无累积时钟漂移 | ⬜ 等真机 |
| H3 | PIO 硬件触发延时与毛刺抑制 | 软件 DSL 是内存数组 `findTriggerIndex`；PIO 是纳秒级 GPIO 状态机直接启动 DMA | 信号发生器输入预/后触发脉冲，首个样本点与物理跳变严格对齐 | ⬜ 等真机 |
| H4 | 物理 USB 异常拔插与重连恢复 | mock TCP 断开是 `socket.destroy()`（OS 发 FIN/RST）；物理拔出是总线断电，驱动抛 `ENOENT`/`EBADF` | 采集中拔出：不崩溃、状态转 Disconnected；重插后自愈重连 | ⬜ 等真机 |
| H5 | 电气特性与时钟漂移 | DTR/RTS 电平、真实波特率误差、晶振温漂均无软件等价物 | 波特率线控正确；长时采样采样率不随温度累积偏移 | ⬜ 等真机 |
| H6 | 真机下的「Webview 参数 → `CAPTURE_REQUEST` → 波形上屏」全链 | 项 8 已把 Webview 侧栏连接 → StabilityService → 心跳 → 采集触发跑通，但**设备侧逐字节对账（`tcp-capture-sample-content`）走的仍是 D5 驱动直连**（`new LogicAnalyzerDriverClass`），不是 webview 路径；且无真实 PIO/DMA | 真实设备回传样本与 UI 表单参数、Canvas 光栅化结果三方一致 | ⬜ 等真机（软件层**部分**逼近：webview→设备链路已通，webview→样本内容对账未通） |

**软件层可补但本批不做的**（留待需求方后续排期，不混进真机阶段）：
- `LIN` / `I2S` / `StreamingI2C` 的 UI 解码场景（四大核心总线已闭环，边际收益递减；
  底层 decoder 单测已有 `tests/unit/decoders/protocols/` 覆盖）；
- Webview 快捷键 `F1` / `Ctrl+Shift+D` 的真 DOM 事件派发（单测已锁 `uiStore`，
  e2e 合成事件不经过真实物理碰撞检测）；
- 流式采集（串口 Chunk 连续灌入）下的 Canvas 掉帧/微任务饥饿（现有场景均为静态
  `.lac` 文件一次性解析）。

### 6.5 本批收工判定

```
软件层：14 场景 / 113 oracle，pass=108 / fail=0 / blocked=1 / not_exercised=4
        5 条未到 pass 的项全部「机制做不到 + 已登记 + 单测承接」，无遗漏
真机层：0 覆盖，6 项待办（H1-H6），烧录待授权
文档层：本节即「为什么不做」的留痕，防止后人顺手补假绿
```

**结论：现在收工，等真机。** 未经需求方授权，不烧录固件、不新增真机场景、
不改白名单、不为凑覆盖率动现有 14/113。
