# 测试体系总览（2026-11-03 归拢后）

> 本次归拢解决的问题：**3 套割裂的 jest 配置** + **2 个游离在 `src/` 下从未被收集的测试**
> + **1 个名为 E2E 实为 mock 单测的假绿** + **1 个 12 用例全 skip 的死测试**。

---

## 一、一条命令跑什么

| 命令 | 跑什么 | 规模 | 耗时 |
|---|---|---|---|
| `npm test` | **全部** jest 测试（含 stress/performance） | 73 个文件 | ~25 分钟 |
| `npm run test:fast` | 排除 `stress` + `performance` | 67 个文件 | ~2 分钟 |
| `npm run test:unit` | 只跑 `--testPathPattern=unit` | 65 个文件 | — |
| `npm run test:integration` | 只跑 integration | 2 个文件 | — |
| `npm run test:webview:unit` | 只跑 `jsdom` project | 3 个文件（100 用例） | — |
| `npm run test:e2e` | **真宿主 e2e**（自动套 `xvfb-run`） | 4 个场景 | ~2 分钟 |
| `npm run test:e2e:list` | 只打印 e2e 场景注册表 | — | — |

> ⚠️ `npm test` 有 `pretest` 钩子：`npm run build && npm run lint`。
> 所以它会**先全量构建 + 全量 lint**，比裸 `jest` 慢得多。日常用 `test:fast`。

---

## 二、Jest Projects（一个配置文件，两个环境）

`jest.config.js` 用 `projects` 把两种运行环境隔开，**不再需要 `--config` 切换**：

| project | 环境 | 匹配 | setup | 数量 |
|---|---|---|---|---|
| `node` | `node` | `tests/**/*.test.ts`，排除 `unit/webview/` 与 `e2e/` | `tests/fixtures/setup.ts` | 70 |
| `jsdom` | `jsdom` | `tests/unit/webview/**/*.test.ts` | `tests/fixtures/setup.webview.ts` | 3 |

按目录的实际分布（`jest --listTests` 实测，73 个）：

```
unit 65 · stress 4 · performance 3 · integration 1
```

**为什么要分**：webview 测试需要 DOM（`localStorage` / `ResizeObserver` / Vue SSR），
在 `node` 环境下虽然"侥幸"能跑过 3 个文件，但那是**环境不匹配下的偶然**
（`@jest-environment jsdom` 注解决定了实际环境，而非配置）——
显式分到 jsdom project 才是稳定的。

### 已删除的配置

| 文件 | 删除原因 |
|---|---|
| `jest.webview.config.js` | 功能被 `jsdom` project 覆盖 |
| `tests/unit/cli/jest.config.js` | 与 root 配置的唯一差异是 `rootDir` 和 `preset: ts-jest`，root 配置已覆盖 |

---

## 三、目录结构（归拢后）

```
tests/
├── unit/              65 个文件
│   ├── drivers/       （含 drivers/types/AnalyzerTypes.test.ts —— 从 src/ 迁入）
│   ├── services/
│   ├── models/
│   ├── decoders/
│   ├── webview/       3 个文件 → jsdom project
│   ├── quality/
│   └── ...
├── integration/        1 个文件（core-flows/hardware-capture.integration.test.ts）
├── performance/        3 个文件
├── stress/             4 个文件
├── e2e/
│   └── vscode/        ⚠️ **不在 jest 内**，由 `npm run test:e2e` 单独执行
└── fixtures/          共享 mock / setup / 测试数据
```

**关键约束**：`tests/e2e/vscode/` 被 `jest.config.js` 的 `testPathIgnorePatterns` 排除。
理由是它**外进程启动真 VS Code**，与 jest 的并行/隔离模型冲突，单次以分钟计。

---

## 四、`src/` 下不再有测试文件

CLAUDE.md 硬约束：「所有测试文件都放到项目根目录下的 tests 目录下」。

归拢前有 2 个游离文件，**jest 一个都没收集**（`testMatch` 只认 `<rootDir>/tests/**`）：

| 原路径 | 处置 | 原因 |
|---|---|---|
| `src/drivers/types/__tests__/AnalyzerTypes.test.ts` | **迁入** `tests/unit/drivers/types/` | 37 用例全 PASS，测的是 `src/drivers/types/AnalyzerTypes.ts`（14.4K，被 `LogicAnalyzerDriver.ts` 等真实引用）。**注意它不是 `src/models/AnalyzerTypes.ts` 的重复** —— 两份文件 DIFFERENT（14.4K vs 5.6K，37 vs 40 个 it） |
| `src/webview/engines/__tests__/WaveformEngineIntegration.test.ts` | **删除** | 608 行、12 用例、`describe.skip` 包着从未执行。解禁后 10/12 红，全部是 `setSampleInfo is not a function`（API 已漂移）。详见 `docs/test-coverage-gaps-2026-11-03.md` |
| `src/webview/engines/__tests__/module-structure-test.js` | 删除 | 非 `.test.ts`，jest 从不收集 |
| `src/webview/engines/__tests__/waveform-engine-test.html` | 删除 | 手工测试页，已被 `webview-browser-smoke.js` 取代 |

---

## 五、真宿主 e2e（新增）

详见 `tests/e2e/vscode/README.md`，覆盖明细见 `docs/e2e-coverage-matrix-2026-11-03.md`。要点：

- 跑**真 VS Code 1.74.3**（钉在 `engines.vscode` 下限）+ `xvfb-run`
- 每场景独立 `--user-data-dir` / `--extensions-dir`，跑完回收进程与目录
- 结果四态：`pass` / `fail` / `not_exercised` / `blocked`，**只有全 pass 才 EXIT=0**
- **9 个场景**：
  - 命令层 4 个：`commands-coverage` / `open-analyzer` / `create-synthetic-capture` / `network-scan`
  - **Webview UI 层 5 个**：`ui-waveform` / `ui-channel-config` / `ui-trigger-config` / `ui-export-button` / `ui-decoder`

### 5.1 Webview UI 驱动桥（本期新增）

**为什么需要**：宿主侧**完全拿不到 webview DOM**（实测）：
```js
vscode.Tab.input          → { uri, viewType } 两个字段
input.webview             → undefined
Object.getOwnPropertyNames(prototype) → ['constructor']
```

⇒ 必须加一座 postMessage 桥：

```
tests/e2e/vscode (宿主侧)
  → executeCommand('logicAnalyzer.__runEditorScenario', actions, {viewType, uri})
  → src/scenario/scenarioRegistry.ts   （按 viewType+uri 索引，0/多命中都抛错）
  → src/scenario/scenarioBridge.ts     （nonce 配对、超时、dispose 中止）
  → webview.postMessage({type:'scenarioRequest', nonce, actions})
  → webview 内 scenarioExecutor.ts     （真实 DOM 事件 + 读值 + canvas 像素统计）
  → 回包 → 宿主断言
```

**三重门控**（缺一不可）：
1. `ExtensionMode.Test` 才注册命令（**不写进 `package.json`**，对用户透明）
2. HTML 注入 `window.__scenarioEnabled`（仅 Test 为 true）
3. webview 侧校验 `__scenarioEnabled` + nonce；宿主侧校验回包 nonce

**动作集**（`scenarioExecutor.ts`）：
```
waitForElement / waitForText / click / input / key / sleep
readText / readTextOptional / readValue / readValueOptional
countElements / readAllTexts / readCanvasStats
startCaptureMessages / stopCaptureMessages
```

**语义选择器** `formItem:"<label>" [子选择器]`：
- 为什么不用 `:has()`：Chromium 102 不支持（实测 `is not a valid selector`）
- 为什么不用 `nth-child`：表单顺序稍变就脆断
- 为什么不给产品加 `data-testid`：会永久进入用户 DOM
- **引号必填**，无引号 fail-closed 抛错（否则 `formItem:Pre Samples input` 无法区分
  「label 是 `Pre Samples`」还是「label 是 `Pre` + 子选择器 `Samples input`」）

---

## 六、当前基线（2026-11-03，供后续对照）

**归拢前**（`npx jest --testPathPattern=unit`）：
```
Test Suites: 11 failed, 53 passed, 64 total
Tests:       107 failed, 1757 passed, 1864 total
```

**归拢后**（`npx jest tests/unit`，2026-11-03 最终复跑）：
```
Test Suites: 1 failed, 92 passed, 93 total
Tests:       2472 passed, 2472 total          ← 用例 100% 通过
```

**唯一的失败套件**：`tests/unit/extension/Extension.coverage.test.ts`
—— 它是 OUT-1 那个 **Promise 泄漏导致 worker 崩溃**（不是用例断言失败），
详见 `docs/e2e-found-product-bugs-2026-11-03.md`。

**✅ T1 修复后**（2026-11-03，当前基线）：
```
Test Suites: 93 passed, 93 total
Tests:       2528 passed, 2528 total          ← 0 failed，无崩溃
```
> 该文件同时从「崩溃」变成了「真的在测东西」：修崩溃后曝光了 3 条被掩盖的既有缺陷
> （契约漂移 / mock 取值架空判据 / 配置节名无校验），全部已修并做 5 条变异验证。
> 详见 `docs/e2e-found-product-bugs-2026-11-03.md` OUT-1。

> ⚠️ **这份文档早期版本写过「106 个用例失败」，那个数字已过期**。
> 原因是：合并远程 master（`834575bc`，39 个提交）时带入了修复
> （`5a76d992 test: tighten coverage path gates`、
> `74a83f78 test: fix stale scpiIdn assertions`、
> `3ca420e3 fix(drivers): idempotent temp dir on capture retry` 等），
> 把原先的 `LogicAnalyzerDriver.*` / `SessionManager.*` 等失败修掉了。
>
> ⇒ **保留这段是为了提醒**：跨会话讨到的历史数字，合并后必须**重新实测**，
> 不能拿旧数字下结论。

### 6.1 已知的测试基础设施缺陷

| 缺陷 | 影响 | 状态 |
|---|---|---|
| `Extension.coverage.test.ts` 未捕获的 `Promise.reject` | 该文件**单文件和整目录都跑不了**（worker 崩溃） | ✅ **已修（T1）**，见 OUT-1 |

> ⚠️ 更正：早期写「绕法 = 跑单文件」**不成立** —— HEAD 原版单文件同样崩。已删。
> 同时更正早期记录的「被 worker 隔离、不影响总结果」：这只在**全量**跑时成立，
> 单独跑该文件时是**硬失败**。

---

## 七、CI 分层与 e2e 的关系

`scripts/ci-test-runner.js` 的 `CI_CONFIG.e2eTests` 现在是**空数组**：

```js
// 旧的假 e2e 已删除；真 e2e 在 tests/e2e/vscode/，不走 jest
e2eTests: [],
```

`runE2ETests()` 对空清单返回 `{ allPassed: true, skipped: true, skippedReason }` ——
**显式区分「未运行」与「跑了并通过」**，避免「全 skip 也算 EXIT=0」。

⇒ CI 分层（quick/standard/full）现在**不跑 e2e**。
真 e2e 需要 `xvfb` + 约 2 分钟，建议单独一个 CI job，而不是塞进测试分层。
