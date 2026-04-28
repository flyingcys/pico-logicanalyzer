# 02 `.lac` 原版兼容和导出闭环执行记录

## 当前基线

- 分支：`parallel/02-lac-format-golden`
- 启动状态：`git status --short --branch` 为 `## parallel/02-lac-format-golden`
- 计划目标：以真实原版 `.lac` 样本为基准，统一 PascalCase/lowercase 兼容、样本编码、区域和导出。

## 范围内

- `src/models/LACFileFormat.ts`
- `src/services/DataExportService.ts`
- `tests/unit/models/LACFileFormat.test.ts`
- `tests/unit/services/DataExportService.accurate.test.ts`
- `tests/fixtures/lac/`
- `.lac` 格式 fixture 说明、功能状态矩阵和本执行记录。

## 范围外

- 不改前端 UI、Webview 导出按钮或 host 命令链路。
- 不改波形渲染、区域交互、marker、样本编辑工作流。
- 不改设备驱动、采集协议或硬件认证矩阵。

## 接口契约

- 主 `.lac` 输出格式固定为原版 PascalCase：`Settings`、`CaptureChannels`、`Samples`、`SelectedRegions`。
- lowercase 字段只做兼容输入，重新保存、LAC 导出和序列化时归一化为 PascalCase。
- root `Samples` 是每个采样点一个 128 bit packed 值；bit 位使用 `AnalyzerChannel.channelNumber`，不是通道数组下标。
- 通道内 `Samples`/`samples` 表示每个样本一个 `0/1` byte，CSV、JSON、VCD 都按该语义读取。
- 区域兼容 PascalCase `R/G/B/A` 和 lowercase `color.r/g/b/a` 输入，输出为原版 `SampleRegion` 结构。

## 执行日志

- 阶段 1：新增 `tests/fixtures/lac/original-pascal-region.lac`、`current-lowercase-samples.lac` 和中文 README，覆盖原版 PascalCase、早期 lowercase、区域和非连续通道位号。
- 阶段 2：先补失败测试，复现 packed UInt128 按数组下标编码/解码的问题，以及 JSON/VCD 把 per-sample byte 误按 bit-packed byte 读取的问题。
- 阶段 3：修正 `LACFileFormat` packed 样本编码/解码，统一按 `channelNumber` 取 UInt128 bit。
- 阶段 4：修正 `DataExportService` JSON/VCD 导出样本读取，统一从 `CaptureSession.captureChannels[].samples[sampleIndex]` 读取 `0/1`。
- 阶段 5：补充功能状态矩阵，记录 `.lac` golden fixture、CSV/JSON/VCD/LAC 导出和往返测试证据。

## 验收结论

已通过：

- `../../node_modules/.bin/jest --runTestsByPath tests/unit/models/LACFileFormat.test.ts --runInBand`：41 个测试通过。
- `../../node_modules/.bin/jest --runTestsByPath tests/unit/services/DataExportService.accurate.test.ts --runInBand`：61 个测试通过。

仍有限制：

- 当前 `original-pascal-region.lac` 是按原版 `ExportedCapture` 结构手工整理的最小 golden，不是从真实原版 GUI 直接导出的完整大样本。
- `npm run test:unit -- ... --runInBand` 会与脚本内 `--maxWorkers=2` 冲突；本次用项目依赖中的 Jest 直接运行目标测试。
- 误触发的 `npm test -- ...` 受既有 `pretest` lint 阻塞，阻塞点在 04/08 范围文件：`AppSidebarLeft.vue` 的 `prompt` 和 `CliCaptureRunner.ts` 的解构规则，本 worktree 未修改。

后续合并协调：

- 03/06 可以消费 `tests/fixtures/lac/`，但不要更改 `.lac` 输出字段主契约。
- 若后续拿到真实原版大样本，应直接加入 `tests/fixtures/lac/` 并补充来源说明与 hash。
