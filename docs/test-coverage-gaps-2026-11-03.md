# 已删除的测试及覆盖缺口登记（2026-11-03）

> 纪律依据：「不做出无痕」——**把"不做"当没产出**，后人会当遗漏而"顺手补上"。
> 本文件记录本次测试归拢中**删掉的测试**，以及**删除后留下的真实覆盖缺口**。
> 目的：让后人知道"这不是漏了，是想过了"。

---

## 一、`tests/e2e/scenarios/DataCaptureWorkflow.e2e.test.ts`（删除）

### 它是什么

一个名为 "E2E" 但**不是 E2E** 的测试：
- 跑在 jsdom/node 里，`vscode` 是 `jest.mock(token -> simple-mocks)`
- `E2ETestBase.executeUserAction` 在 `command` 分支里**自己 `fs.writeFile` 造一个
  `mock artifact for <command>` 文件**，然后断言"文件存在"
- 它调的命令 ID：`logicanalyzer.welcome` / `logicanalyzer.detectDevice` /
  `logicanalyzer.connect` —— **在 `package.json` 的 `contributes.commands` 里一个都不存在**
  （真实 ID 是 `logicAnalyzer.*`，注意大小写）

实测：`PASS`，2 个用例，耗时 23 秒。

### 为什么删

1. **它证明的是"我自己的 mock 能被调用"，不是"产品能工作"**
2. 它占据了 "e2e" 这个名字和 23 秒运行时间，**排挤了真 e2e** 的存在
3. 留下的假绿比没有更糟 —— 后人看到 `tests/e2e/` 有测试通过，就不会去建真 e2e

### 替代

`tests/e2e/vscode/`（真宿主 e2e，**不进 jest**，由 `npm run test:e2e` 执行）。

### 覆盖缺口（**无**）

它声称覆盖的"新手用户入门 / 专家配置 / 错误恢复 / 多设备"四个场景，
**全部建立在 mock 之上，没有一个是真实验证**。
删除后**没有丢失任何真实覆盖** —— 因为它本来就没有。

---

## 二、`src/webview/engines/__tests__/WaveformEngineIntegration.test.ts`（删除，未搬移）

### 它是什么

608 行，一个 `describe.skip(...)` 包着 **12 个用例**。整个文件**从未执行过**。

### 为什么删而不是修

2026-11-03 我把它解禁跑了一次（`sed 's/describe\.skip(/describe(/'`），结果：

```
Test Suites: 1 failed, 1 total
Tests:       10 failed, 2 passed, 12 total
```

失败原因**全部是同一个**：

```
TypeError: waveformRenderer.setSampleInfo is not a function
```

它按**旧 API** 写的。产品当前的真实 API：

| 组件 | 测试调用的 | 产品实际的 |
|---|---|---|
| `WaveformRenderer` | `setSampleInfo(rate, channels)` | `setChannels(channels, freq)` / `setSampleFrequency(freq)` |
| `MarkerTools` | `setSampleInfo(...)` | ✅ 仍有 |
| `MeasurementTools` | `setSampleInfo(...)` | ✅ 仍有 |
| `TimeAxisRenderer` | （未确认） | `setTimeInfo(...)` |

具体核过 8 个组件的 `public` 方法：

```
WaveformRenderer   : setChannels setIntervals setSampleFrequency getChannelCount getSampleFrequency
                     beginUpdate endUpdate invalidateVisual render updateVisibleSamples addRegion
                     addRegions removeRegion clearRegions setUserMarker setMarkers setSelection
                     updateColors setBursts setPreSamples getRenderStats dispose resize
InteractionEngine  : pan zoom zoomAtPoint resetView addEventListener removeEventListener getViewport
                     setViewport updateConfig getConfig on getSelection clearSelection dispose
ChannelLayoutManager: setChannels getVisibleChannels getAllChannels getChannelAtY getChannelInfo
                     setChannelVisibility getTotalHeight getVisibleChannelCount dispose
VirtualizationRenderer: calculateLOD renderChannels getPerformanceStats dispose
MarkerTools        : initializeEventListeners setSampleInfo addMarker removeMarker updateMarker
                     createMarkerPair measureMarkerPair render on off exportMarkers importMarkers dispose
MeasurementTools   : setSampleInfo detectEdges measureFrequency measureDutyCycle detectPulses
                     measureTimeInterval measureStatistics analyzeFrequencySpectrum autoMeasure
                     formatTime formatFrequency exportMeasurements updateConfig getConfig
TimeAxisRenderer   : setTimeInfo render getTimeAtPosition getHeight updateConfig getConfig
                     autoScale exportConfig importConfig
PerformanceOptimizer: startFrame endFrame getMetrics getCurrentLOD dispose
```

⇒ **修它等于重写 12 个用例**（每个都要换 API 重写断言），
那不是"修测试"，是"重新写一份测试"。**而重写后的断言该测什么，需要重新设计，不能照抄旧的。**

### 为什么不搬进 `tests/`

一开始我（和 05）把它搬进 `tests/integration/webview/`，理由是"符合 CLAUDE.md
的『所有测试放 tests 目录』约束"。

**但那是形式主义**：把一个 12 个全 skip 的文件换个目录，只是把
「`src/` 里看不见的 skip」变成「`tests/` 里看得见的 skip」，
**没有产生任何覆盖**，却让 `jest --listTests` 数字更好看（多 1 个文件）。
⇒ **撤回了这个搬移，直接删除。**

### 覆盖缺口（**真实存在，需后续补**）

| 能力 | 当前覆盖 | 缺口 |
|---|---|---|
| `WaveformRenderer` 选区/marker/区域渲染 | ✅ `tests/unit/webview/waveform-interactions.test.ts`（16 用例，含 renderer 交互覆盖层） | — |
| `InteractionEngine` pan/zoom/resetView | ❌ **无** | 拖拽平移、缩放的数学正确性 |
| `ChannelLayoutManager` 通道布局与可见性 | ❌ **无** | 多通道行高计算、隐藏通道重排 |
| `VirtualizationRenderer` LOD 计算 | ❌ **无** | 大数据量分块渲染的 LOD 选择 |
| `MarkerTools` 成对 marker 测量 | 部分（`waveform-interactions` 有 marker） | 成对 marker 的时间差测量 |
| `MeasurementTools` 频率/占空比/脉宽 | 部分（`waveform-interactions` 有测量） | 频谱分析、自动测量 |
| `TimeAxisRenderer` 时间↔像素 | ❌ **无** | 时间轴刻度生成、autoScale |
| `PerformanceOptimizer` 帧计时/LOD | ❌ **无** | 帧预算、降级策略 |

### 后续怎么补（建议，未实施）

**不要**复活旧文件。每个组件单独立测试，断言落在**可验证的数值**上：

```ts
// 例：InteractionEngine 的 zoom 数学
it('zoomAtPoint 应以锚点为中心缩放，锚点下的时间不变', () => {
  const engine = new InteractionEngine();
  engine.setViewport({ firstSample: 0, visibleSamples: 1000 });
  engine.zoomAtPoint(2, /* x=200px */ 250);
  // 断言：缩放前后，x=200px 处对应的样本索引相同
});
```

**要求**：新测试必须能在产品改坏时变红（变异验证），否则又是"初始化成功"式的噪音。

---

## 三、`src/webview/engines/__tests__/` 下另外两个非测试文件（删除）

- `module-structure-test.js`（非 `.test.ts`，jest 从不收集）
- `waveform-engine-test.html`（手工测试页）

这两个不是自动化测试，删掉不影响覆盖。`waveform-engine-test.html` 若是手工验证页，
其价值已被 `webview-browser-smoke.js` 取代（后者是真正的自动化 smoke）。

---

## 四、汇总：删除前后

| 项 | 删除前 | 删除后 |
|---|---|---|
| `jest --listTests` 收集数 | 73（`src/` 下 2 个**未收集**） | **73**（全部在 `tests/`，全部被收集） |
| 全量 `*.test.ts` 文件数 | 75 | 73 |
| 假 e2e | 1 个（23 秒假绿） | 0 |
| 全 skip 的死测试 | 1 个（12 用例，从未跑过） | 0 |
| 真实覆盖 | — | **未减少**（两者本来就零覆盖） |

> ⚠️ 数字从 74 变成 73，是因为删了那份 12 个全 skip 的死测试。
> **这个数字下降是好事** —— 它把"看起来有 74 个测试文件"的假象去掉了。
