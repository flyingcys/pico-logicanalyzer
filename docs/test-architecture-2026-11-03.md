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

详见 `tests/e2e/vscode/README.md`。要点：

- 跑**真 VS Code 1.74.3**（钉在 `engines.vscode` 下限）+ `xvfb-run`
- 每场景独立 `--user-data-dir` / `--extensions-dir`，跑完回收进程与目录
- 结果四态：`pass` / `fail` / `not_exercised` / `blocked`，**只有全 pass 才 EXIT=0**
- 4 个场景：`commands-coverage` / `open-analyzer` / `create-synthetic-capture` / `network-scan`

---

## 六、当前基线（2026-11-03，供后续对照）

**归拢前**（`npx jest --testPathPattern=unit`）：
```
Test Suites: 11 failed, 53 passed, 64 total
Tests:       107 failed, 1757 passed, 1864 total
```

**归拢后**（`npx jest`，全量）：
```
见 docs/test-coverage-gaps-2026-11-03.md 与最终回归日志
```

> ⚠️ **既有失败不在本次范围内**。`LogicAnalyzerDriver.*` / `SessionManager.*` /
> `MemoryManager.comprehensive` 等 10 个套件本来就红，本次只保证**不劣化**。
> 它们大多是 mock 与产品实现漂移（如 `fs.copyFile is not a function`），
> 属于独立的技术债，需要单独排期。

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
