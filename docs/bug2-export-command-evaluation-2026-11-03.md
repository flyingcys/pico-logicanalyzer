# BUG-2 评估：数据导出是否该加 VS Code 命令入口

> 按「新增能力类议题，第一轮必须先回答『该不该做』三问」。
> 日期：2026-11-03 ｜ 待用户裁定
>
> **结论（修正后）**：**不加命令，改加 CLI 子命令 `export`**。
> ⚠️ 我最初的结论是「不做」，理由是"有 CLI 替代" —— **核实后发现 CLI 没有 export，那个理由不成立**，
> 详见 §三 的认领。

---

## 一、三问

### ① 没有它时，既有路径是否已经成立？

**成立，而且是完整的。**

| 路径 | 状态 |
|---|---|
| webview 工具栏「导出」按钮 | ✅ 存在（`AppHeader.vue:197`，`data-testid="webview-export-button"`） |
| 该按钮 → `host.sendCommand('exportData', …)` | ✅ 通 |
| → `LACEditorProvider.executeHostCommand` `case 'exportData'` | ✅ 通（`:883`） |
| → `exportData()` → `DataExportService.exportWaveformData` | ✅ 通 |
| 支持格式 | LAC / CSV / JSON / VCD（`:404-412` 的 filters） |

⇒ **用户想在 UI 里导出，现在就能导。** 缺的只是"从命令面板/脚本触发"。

### ② 它服务的对象是谁、有多少？

| 候选用户 | 可核实的分子 |
|---|---|
| 命令面板用户 | **无可核实数据**。`package.json` 里没有任何 usage/telemetry 采集 |
| 脚本/自动化调用 | **未发现任何消费方**（`grep` 全仓无 `executeCommand('logicAnalyzer.exportData')`） |
| 第三方集成 | **无**（插件未对外暴露 API，`activate()` 不 return） |

⇒ **说不出分子，也说不出分母**。按 L1 的原话："不是『用户需要』，要给可核实的分子/分母"。

### ③ 如果它不存在，用户会损失什么？举一个具体、可复现的场景。

我能想到的最具体场景：

> 用户想批量导出 50 个 `.lac` 文件的 CSV 做统计。

**我原本以为有 CLI 替代 —— 核实后是错的。** `src/cli/CaptureCli.ts` 只有 4 条子命令：

```
capture · batch · network-config · write-config
```

**没有 `export`。**

⇒ ③ 的损失**是真实的**：

| 场景 | 现状 |
|---|---|
| 单个文件在 UI 里导出 | ✅ 能（webview 按钮点一次） |
| **批量导出 N 个文件** | ❌ **做不到**（要点 N 次按钮，且每次弹保存框） |
| 脚本/CI 里导出 | ❌ **做不到**（无命令、无 CLI） |

⇒ **这条评估我一开始写错了一半**：「③ 损失小」不成立。
批量/脚本导出的需求**确实无处可去**。

> ⚠️ 这也说明我之前"倾向不做"的判断**建立在错误前提上**。见下方修正后的结论。

---

## 二、成本分析（如果做）

| 项 | 说明 |
|---|---|
| 产品改动 | `exportData` 加 `targetUri` 注入（同 `createSyntheticCapture` 模式）+ 注册新命令 + `package.json` contributes |
| e2e 覆盖 | **可以做**（有 `targetUri` 就不依赖弹窗），会新增一个场景 |
| 但 webview 路径仍不可验 | webview 的消息通道在宿主侧不可达，所以**用户真实点按钮的路径，e2e 还是验不到** |
| 风险 | 新增一条命令 = 新增一个 `activates` 入口，需确认 `activationEvents` 是否会遗漏 |

**关键点**：即使加了命令，e2e 也只能验**命令路径**，
而**用户真实用的 webview 按钮路径依然没有 e2e 覆盖**（结构性限制，与加不加命令无关）。

---

## 三、我的判断：**不做命令，改做 CLI 子命令**（修正后）

### 先认领：我上一版判断错了

我最初写"倾向不做"，理由是「③ 损失小，有 CLI 替代」。
**核实后发现 CLI 没有 export**，那个理由不成立。**我认领这个错误。**

### 修正后的结论

| 结论 | 理由 |
|---|---|
| ❌ **不加 `logicAnalyzer.exportData` 命令** | 它只服务"从命令面板点一下"，而用户真正缺的是**批量/脚本** —— 命令面板点一次还是只导一个文件，且会弹保存框 |
| ✅ **改加 CLI 子命令 `export`** | `bash`/CI 能循环调用 N 次，一条命令导出 N 个文件。这才是「批量导出 50 个 `.lac`」的正当解法 |
| ⚠️ webview 路径仍不可验 | 与加什么无关，是结构性限制（见 §四） |

### 为什么 CLI 比命令更对

```
# 加命令后用户要做的（还是要点 50 次）
命令面板 → export → 保存框 → 选路径    × 50

# 加 CLI 后用户要做的
for f in *.lac; do npx logic-analyzer-capture export "$f" --format csv -o out/; done
```

SQL、imagemagick、ffmpeg 的形状都是后者 —— **批量场景属于 CLI，不属于命令面板。**

### 成本

| 项 | 说明 |
|---|---|
| 复用 `DataExportService` | ✅ 纯逻辑已存在（`DataExportService.exportWaveformData`） |
| 绕过 `showSaveDialog` | ✅ CLI 天然没有 UI，直接传 `-o` 路径 |
| 需要的能力 | `LACFileFormat.load` 读 `.lac` → `convertToCaptureSession` → `exportWaveformData` |
| 风险 | ✅ **已核，无风险**（见下） |

### ✅ 关键前提已核实：导出链路不依赖 `vscode`

```sh
$ grep -n "from 'vscode'" src/services/DataExportService.ts src/models/LACFileFormat.ts
（无输出）
```

`DataExportService.ts` 的 import 只有：
```ts
CaptureModels · LACFileFormat · decoders/types · ExportPerformanceOptimizer
· ServiceLifecycleBase · zlib · path
```

⇒ **纯 Node 逻辑**，CLI 里能直接跑。**这个方案没有阻塞项。**

`ServiceLifecycleBase` 也核了：`grep -n vscode src/common/ServiceLifecycle.ts` → **零命中**。

⇒ **整条导出链路（`LACFileFormat.load` → `convertToCaptureSession` → `exportWaveformData`）
零 `vscode` 依赖。CLI 方案完全可行。**

---

## 四、替代建议（比加命令更有价值）

**把力气花在"让 webview 路径可验"上**，那条路一打通，`exportData`、`runDecoder`、
波形渲染、通道配置**全部都能验**，而不只是导出。

这需要产品侧提供**正式的测试入口**（如 `ExtensionMode.Test` 下暴露一个
受控的命令/事件），属于**产品侧架构决策**，需要用户裁定。

对比：

| 方案 | 覆盖能力 | 成本 |
|---|---|---|
| 加 `logicAnalyzer.exportData` 命令 | 仅导出，且是**旁路** | 低 |
| webview 测试入口 | **导出 + 解码 + 渲染 + 通道配置 + 所有 webview 交互** | 中（但一次解决一片） |

⇒ **建议把 BUG-2 的预算并入 webview 测试入口**。

---

## 五、待用户裁定

1. **不做**（我的建议）—— 记为 "won't fix / UI already provides it"
2. **做** —— 那我先补核 CLI 的 export 能力，再决定要不要加命令
3. **改做 webview 测试入口** —— 大工程，但覆盖面完全不同

> ⚠️ 无论选哪个，**BUG-2 的现状都要留在文档里**（已做，见
> `docs/e2e-found-product-bugs-2026-11-03.md`），不能因为"决定不做"就删除。
