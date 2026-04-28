# Worktree 09：信号描述语言和合成捕获

## 当前基线

- 分支：`parallel/09-sdl-synthetic-capture`
- 启动状态：`## parallel/09-sdl-synthetic-capture`
- 计划目标：补齐 `SignalDescriptionLanguage` / `SignalComposer` 对应能力，服务测试、演示和协议 fixture 生成。

## 范围内

- `src/services/SignalDescriptionLanguage.ts` 的 DSL 语法、AST、诊断和样本生成。
- `logicAnalyzer.createSyntheticCapture` 合成采集命令入口验证。
- `tests/fixtures/signal-dsl/` 示例与错误 fixture。
- `tests/unit/services/SignalDescriptionLanguage.test.ts` 自动化测试。
- 用户手册、功能状态矩阵和本执行记录。

## 范围外

- 不实现完整协议解码 parity；I2C/SPI/UART/CAN 示例只作为输入波形，解码器对齐归 05。
- 不接真实硬件采集；Pico 协议、设备连接和采集 UI 分别归 01/04。
- 不改变 `.lac` 输出契约；合成捕获继续复用 `LACFileFormat.createFromCaptureSession` 和 `LACFileFormat.save(..., includeRawSamples=true)`。

## 接口契约

### DSL 最小语法

```text
sample_rate <正整数|k|khz|m|mhz>
samples <正整数>
channel <0-23> <名称> <waveform> key=value ...
```

支持的 waveform：

| 类型 | 必填参数 | 可选参数 | 说明 |
| --- | --- | --- | --- |
| `clock` | `period` | `duty=0.5`、`phase=0` | 周期时钟，`duty` 支持小数或百分比 |
| `pattern` | `bits` | `repeat=false`、`step=1` | 逐位或按 `step` 拉伸输出 0/1 序列 |
| `constant` | `value` | 无 | 固定 0/1 |
| `pulse` | `start`、`width` | `value=1`、`idle=!value` | 单个脉冲窗口 |

### 诊断格式

`SignalDescriptionLanguage.validate(source)` 返回：

```ts
{
  severity: 'error',
  code: string,
  message: string,
  line: number,
  column: number
}
```

解析失败时 `SignalDslParseError` 同步暴露 `lineNumber`、`column`、`code` 和 `diagnostic`，命令入口可直接展示 `error.message`。

### 合成 `.lac`

`SignalDescriptionLanguage.generateCaptureSession(source)` 生成 `CaptureSession`，每个通道携带 `Uint8Array` 样本。保存时必须调用：

```ts
LACFileFormat.save(filePath, session, undefined, true)
```

最后一个参数必须为 `true`，否则 `.lac` 不包含根级 `Samples`，无法作为 02/03 的打开和渲染样本。

## 执行日志

- 阶段 1：补充稳定诊断测试，确认旧实现缺少 `validate()`、未知参数校验和协议示例 fixture。
- 阶段 2：为 DSL 增加 `SignalDslDiagnostic`、错误列号、错误码和未知参数检查，保持既有 `parse()` / `generateCaptureSession()` API 兼容。
- 阶段 3：新增 I2C/SPI/UART/CAN 示例 DSL 与 invalid pattern 错误示例，并在单元测试中验证示例可生成、导出和恢复 `.lac` 样本。
- 阶段 4：更新用户手册和功能状态矩阵，记录当前语法边界。

## 验收结论

已运行并通过：

- `npm run typecheck`
- `npm exec -- jest tests/unit/services/SignalDescriptionLanguage.test.ts --runInBand`
- `npm run test:extensions -- --runInBand`

当前限制：

- `validate()` 目前返回首个错误诊断，尚未做全文件多错误恢复。
- 协议示例是可解码输入波形，不包含高层协议帧 AST。
- 示例 `.lac` 通过测试即时生成，未提交二进制或大体积 golden 文件。
