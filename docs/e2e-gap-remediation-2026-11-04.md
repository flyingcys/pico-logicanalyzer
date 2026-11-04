# e2e 覆盖缺口与修复台账（2026-11-04）

> **本文档是 2026-11-04 双方（b3 / 05）9 轮 PK 的全部结论，作为逐项实施的唯一依据。**
> 需求方于同日裁定：**一项一项实现，05 实现、b3 验收，双方 PK 认同后才进入下一项。**
>
> - 基线 commit：`ac9f7bac`
> - 需求方裁定：① `defaultSampleRate` 默认值 = **1000000**（改 manifest）
>   ② P0-2a 范围 = **选项 1（连前端一起改）** —— 此项覆盖了双方 PK 的一致推荐

---

## 零、当前 e2e 基线（实测，勿凭印象）

```
13 场景 / 99 条 oracle
pass=95  not_exercised=3  blocked=1  fail=0
EXIT=3（无 fail，但有未验项 —— 按设计「有未验项就不算通过」）

✅ open-analyzer / create-synthetic-capture / network-scan / network-capture-mock
✅ ui-waveform / ui-channel-config / ui-trigger-config / ui-decoder
✅ ui-decoder-spi / ui-decoder-uart / ui-decoder-can
⚠️ commands-coverage（3 条命令 not_exercised）
⛔ ui-export-button（export-persistence blocked）
```

全量耗时 **97 秒**（summary.json 时间戳跨度）。

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
| **状态** | ⬜ 待实现 |

### 项 2 — P0-1b：删 Ctrl+Shift+M 声明

| 字段 | 内容 |
|---|---|
| **缺陷** | 声明「切换测量面板」，但**该面板不存在** |
| **证据** | `AppSidebarRight.vue:18` → `type SidebarTab = 'decoder' \| 'performance'`<br>`uiStore.ts` 全文只有 `activeTab` / `showShortcutHelp` |
| **影响** | 快捷键帮助弹窗向用户承诺了做不到的功能 |
| **改动位置** | `KeyboardShortcutManager.ts:269-275` 整块删除 |
| **判据** | `getShortcutsByCategory()` 不再含 `toggle-measurement-panel` |
| **变异验证** | 保留声明 → 判据红 |
| **状态** | ⬜ 待实现 |

### 项 3 — P0-1c：删 1/2/3/4 通道切换声明

| 字段 | 内容 |
|---|---|
| **缺陷** | 声明「切换通道1~4」，但**无任何 UI 能改 `channel.hidden`** |
| **证据** | `channel.hidden` 被渲染器消费（`WaveformRenderer.ts:205,464,739`），但全仓无 toggle 函数、无眼睛图标入口 |
| **判定** | 属**未完成的新功能**（L1 三问：无它时既有路径已成立）⇒ 删声明，不做半成品 |
| **改动位置** | `KeyboardShortcutManager.ts:225,233,241,249` 四条<br>`triggerChannelToggle` 方法若成死代码一并删 |
| **判据** | `getShortcutsByCategory()` 不再含 `toggle-channel-*` |
| **状态** | ⬜ 待实现 |

### 项 4 — P0-2b：`maxRetries` 配置接线

| 字段 | 内容 |
|---|---|
| **缺陷** | `package.json:194` 声明 `default: 5`，但**全仓零处读取** |
| **改动位置** | `NetworkStabilityService.ts:89` `resolveNetworkStabilityConfig` 补 `maxRetries`（fallback **5**） |
| **调用点（实测 2 处）** | `src/extension.ts:86`<br>`src/providers/LACEditorProvider.ts:795` |
| **判据** | ① `NetworkStabilityService.accurate.test.ts:133` 的 `toEqual` 同步加 `maxRetries: 5`<br>② 新增「缺省时返回 5」用例（**mock 的 `get` 必须返回 `defaultValue`，不能返回 `undefined`**） |
| **变异验证** | M1 fallback 5→3 → ②双断言必红<br>M2 删掉读取 → ①②必红 |
| **状态** | ⬜ 待实现 |

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

**状态** | ⬜ 待实现 |

### 项 6 — P1-1：e2e 接入 CI

| 字段 | 内容 |
|---|---|
| **缺陷** | `.github/workflows/quality-gate.yml` **零 e2e**（`grep -rn "test:e2e\|xvfb" .github/` 无命中）⇒ 99 条 oracle 无自动化保护 |
| **可行性** | 实测全量 97 秒 |
| **CI 步骤** | `sudo apt-get install -y xvfb`<br>cache `.vscode-test/`<br>`npm run build && npm run build:e2e-libs`（`build` 的 clean 会删掉 e2e-libs）<br>`xvfb-run -a npm run test:e2e` |
| **判据** | PR 上 e2e 真跑并影响退出码 |
| **状态** | ⬜ 待实现 |

> 同样被排除的还有 `test:frontend:smoke`（`webview-browser-smoke.js`，带真 Chrome 验 SPI 渲染）。

### 项 7 — P1-2：`needsHardware` 真门控

| 字段 | 内容 |
|---|---|
| **缺陷** | `runner.cjs:91` 只 `console.log`，**不做任何运行时门控** |
| **影响** | README 写的「`hardware/` 目录默认登记为 not_exercised」机制不存在；将来真机场景写 `needsHardware: true` 会在无硬件环境直接 fail |
| **改动位置** | `tests/e2e/vscode/lib/runner.cjs` |
| **判据** | 造一个 `needsHardware: true` 的场景，无硬件时记为 `not_exercised` 而非 `fail` |
| **变异验证** | 删掉门控 → 该场景变成 `fail` |
| **状态** | ⬜ 待实现 |

### 项 8 — P2-1：`network-capture-mock` 改由 webview 驱动

| 字段 | 内容 |
|---|---|
| **缺陷** | 场景直调 `out/e2e-libs/` 的 `hardwareDriverManager`（`:296`），**绕过了产品真正的连接入口** |
| **被绕过的链路** | `LACEditorProvider.connectToNetworkDevice` → `NetworkStabilityService.connect()` + `startHeartbeat()` + `startQualityMonitoring()` —— **e2e 一条都没走到** |
| **改法** | 用 `__runEditorScenario` 驱动侧栏填 `127.0.0.1:<port>` 点「网络」<br>让 bundle 内的 `connectToNetworkDevice` 跑通 |
| **判据** | 原有 12 条 oracle 保持 pass + 新增至少 1 条证明走了 `NetworkStabilityService` |
| **状态** | ⬜ 待实现 |

---

## 二、记录在案、不计入待办

| 项 | 结论 | 证据 |
|---|---|---|
| **`launcher` 侧栏无 provider** | **不是缺陷**，是需求方刻意设计 | `abd5d6e0 feat(vscode): 添加 Activity Bar 入口`（作者 flyingcys）<br>`QualityGateConfig.test.ts:132-155` 守卫<br>`viewsWelcome` 正是为无 provider 视图设计的 |
| **e2e 够不着侧栏 DOM** | 平台边界 | `__runEditorScenario` 的 `resolveScenarioWebview` 只能解析 Custom Editor Webview |
| **`connectDevice` / `startCapture` / `networkDiagnostics`** | 真宿主弹窗挂死 | 已实测 3 次，各 6000-6028ms 超时；单测已覆盖前置分支 |
| **`export-persistence`** | `showSaveDialog` 不可自动化 | 底层落盘已由 `LACEditorProvider.exportPersistence.test.ts` 真写临时目录覆盖 |
| **webview 采集主路径原不读配置** | 已由项 5 的 a4 覆盖 | 需求方选选项 1 |
| **`.eslintcache` 被 git 跟踪** | 待单独清理，不属任何项 | `grep -n eslintcache .gitignore` → `:68`（已忽略）<br>但 `git ls-files` 显示仍被跟踪<br>`git log -- .eslintcache` → 历史遗留（`c2674d80` 等）<br>⇒ 每次 lint 产生无意义 diff。**修法**：`git rm --cached .eslintcache` |

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
7. **⚠️ 验收方的变异验证不得在共享工作区做**（2026-11-04 实际踩到）
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
| 4 | P0-2b maxRetries | 🔄 实现中 | — | fallback=5；三个判据坑已在任务中写明 |
| 5 | P0-2a defaultSampleRate（选项 1） | ⬜ 待实现 | — | — |
| 6 | P1-1 e2e 进 CI | ⬜ 待实现 | — | — |
| 7 | P1-2 needsHardware 门控 | ⬜ 待实现 | — | — |
| 8 | P2-1 mock 改由 webview 驱动 | ⬜ 待实现 | — | — |

**图例**：⬜ 待实现 / 🔄 实现中 / 🔍 待验收 / ✅ 已验收 / ❌ 验收未通过
