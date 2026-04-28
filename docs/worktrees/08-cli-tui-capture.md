# 08 CLI/TUI 采集工具执行记录

## 当前基线

- 计划目标：提供接近原版 CLCapture/TerminalCapture 的用户级命令行能力。
- 首要验收：`logic-analyzer-capture` 可真实或模拟采集输出 `.lac`、`.csv`、`.json`，具备批处理和错误码。
- 启动状态：`git status --short --branch` 为 `## parallel/08-cli-tui-capture`。

## 范围内

- `src/cli` 的命令入口、参数契约、重复采集和批处理编排。
- `src/tools/CliCaptureConfig.ts`、`CliCaptureExporter.ts` 的 CLI 配置和输出格式支持。
- `tests/unit/cli/` 的命令行单元测试。
- `docs/user-manual.md`、`docs/DEVELOPER_GUIDE.md` 和功能状态矩阵中的 CLI 章节。

## 范围外

- 不修改 Pico driver 协议、串口二进制流或网络发现实现，这些归 01/07。
- 不实现完整 curses/Terminal.Gui 等价 TUI；本阶段只保留可复用 CLI runner、配置和导出契约。
- 不修改 Webview 设备连接、采集按钮或 `.lac` golden fixture 体系。

## 接口契约

- 命令入口：`logic-analyzer-capture`，构建后等价于 `node out/cli/index.js`。
- `capture` 支持 `--device`、`--frequency`、`--pre`、`--post`、`--channels`、触发参数、`--format lac|csv|json`、`--repeat` 和 `--mock`。
- 重复采集输出：当 `--output` 包含 `{index}` 时替换为 1-based 序号；否则在扩展名前追加 `-N`，避免覆盖。
- `batch --file batch.json` 接收数组或 `{ "captures": [...] }`，每个任务字段与 `capture` 参数一致，可带 `repeat`。
- 错误码：`2` 表示参数或批处理文件错误，`3` 表示单次采集/写文件失败，`4` 表示批处理执行失败或部分失败。
- `.lac` 输出使用 `LACFileFormat` 创建原版 PascalCase 结构；`.json` 使用 CLI 稳定结构：`metadata`、`settings`、`channels`、`timebase`、`samples`。

## 执行日志

- 阶段 1：审查现有 CLI，确认已有 `capture`、`network-config`、`write-config`、mock/真实 runner 和 package bin。
- 阶段 2：先补 CLI 单元测试，覆盖 JSON 输出、repeat 输出模板、batch 文件和采集失败错误码。
- 阶段 3：实现 `json` 格式、repeat、batch 和错误码；`.lac` 输出改为通过 `LACFileFormat` 序列化，保证可被模型层加载。
- 阶段 4：更新用户手册、开发者指南和功能状态矩阵，明确 mock 与 TUI 边界。

## 验收结论

- 自动化命令：
  - `npm run typecheck`：通过。
  - `npm run test:cli -- --runInBand`：通过，2 个测试套件、13 个测试。
  - `npm run build:cli`：通过。
  - `node out/cli/index.js --help`：通过，帮助中包含 `capture`、`batch`、`network-config`、`write-config`。
- 限制：
  - 真实硬件 runner 仍依赖 01 的 Pico 协议可靠性修正和真实硬件记录。
  - 完整 TUI 暂不实现；后续如需要可复用本阶段的配置、runner 和导出接口。
- 合并协调：
  - 02 合并 `.lac` golden 后，应复核 CLI `.lac` 输出与最终格式契约一致。
