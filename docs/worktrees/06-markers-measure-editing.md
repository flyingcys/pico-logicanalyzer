# Worktree 06 区域、marker、测量和样本编辑执行记录

## 当前基线

- 来源计划：`docs/parallel-worktrees-2026-04-28.md` 中 06 区域、marker、测量和样本编辑。
- 分支：`parallel/06-markers-measure-editing`。
- 启动状态：`git status --short --branch` 输出为 `## parallel/06-markers-measure-editing`。
- 基线验证：
  - `npm run typecheck`：通过。
  - `npm run test:webview:unit -- --runInBand`：通过，2 个测试套件、37 个测试。

## 范围内

- `src/frontend/core/stores/waveformStore.ts`：selection、region、marker、measurement、clipboard、insert/overwrite/delete、undo/redo 编辑历史。
- `src/frontend/app/components/AppWaveformStage.vue`：波形阶段工具栏和 `waveform-action` 入口。
- `src/frontend/core/utils/KeyboardShortcutManager.ts`：编辑快捷键入口。
- `tests/unit/webview/waveform-interactions.test.ts`：交互成功路径、边界路径和大样本编辑边界。
- `docs/功能状态矩阵.md`：同步 06 当前交付状态。

## 范围外

- 不修改 `.lac` 底层解析和保存格式；格式契约归 02。
- 不修改基础波形装载和渲染主流程；真实样本装载归 03。
- 不接 VSCode host 保存命令；本分支只输出可回写的 `SelectedRegions` 数据结构。

## 接口契约

- `waveformStore.serializeInteractions()` 输出前端交互快照，包含 `selectedRegions` 和 `markers`。
- `waveformStore.exportSelectedRegionsForLac()` 输出可交给 `.lac` 保存链路的区域列表：
  - `firstSample`
  - `lastSample`
  - `regionName`
  - `color`
- 样本编辑支持：
  - `copySelection()`
  - `cutSelection()`
  - `insertSamples(sampleIndex, sampleCount, fillValue)`
  - `pasteClipboard(sampleIndex, 'insert' | 'overwrite')`
  - `deleteSelection()`
  - `shiftSelection(channelIndex, offsetSamples, fillValue)`
  - `undoLastEdit()`
  - `redoLastEdit()`
- UI 和快捷键通过 `waveform-action` 分发：
  - `pasteClipboardOverwrite`
  - `undoLastEdit`
  - `redoLastEdit`

## 与原版菜单和快捷键对应

| 原版能力 | 新前端入口 | 快捷键 |
| --- | --- | --- |
| 添加用户 Marker | 波形工具栏 `M` | `M` |
| 从选区创建区域 | 波形工具栏 `R` | `R` |
| 测量选区 | 波形工具栏 `Hz` | `Ctrl+M` |
| 复制样本 | 波形工具栏 `C` | `Ctrl+C` |
| 剪切样本 | 波形工具栏 `X` | `Ctrl+X` |
| 插入粘贴 | 波形工具栏 `V` | `Ctrl+V` |
| 覆盖粘贴 | 波形工具栏 `Ovr` | `Ctrl+Shift+V` |
| 删除选区 | 波形工具栏 `Del` | `Delete` |
| 撤销样本编辑 | 波形工具栏 `Undo` | `Ctrl+Z` |
| 重做样本编辑 | 波形工具栏 `Redo` | `Ctrl+Y` |

## 执行日志

- 阶段 1：确认 `waveformStore` 已具备选择、区域、marker、测量和基础编辑链路；补充失败测试锁定缺口。
- 阶段 2：新增编辑历史栈，覆盖插入、覆盖粘贴、删除、移位的撤销和重做。
- 阶段 3：新增 `SelectedRegions` 回写导出方法，避免 06 直接修改 `.lac` 格式层。
- 阶段 4：补 UI 工具栏和键盘快捷键入口，保证覆盖粘贴、撤销、重做可操作。

## 验收结论

- 已通过：
  - `npm run test:webview:unit -- --runInBand tests/unit/webview/waveform-interactions.test.ts`
  - `npm run typecheck`
  - `npm run test:webview:unit -- --runInBand`
- 限制：
  - `markers` 当前只在前端交互快照中持久化，`.lac` 原版格式没有对应字段，本分支不扩展底层格式。
  - 区域回写以 `exportSelectedRegionsForLac()` 作为接口，实际保存触发需由 02/04 合并时接入。
