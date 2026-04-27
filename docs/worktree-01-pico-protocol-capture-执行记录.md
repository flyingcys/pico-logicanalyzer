# Worktree 01 Pico 协议与真实采集闭环执行记录

日期：2026-04-27

## 基线记录

执行命令：

```bash
rtk npm run test:drivers -- LogicAnalyzerDriver
```

结果：失败，0 个测试实际执行。

失败摘要：

- 默认 Jest 配置没有 TypeScript transform，`.ts` 测试文件被 Babel 直接解析，报 `Unexpected reserved word 'enum'`、`Missing semicolon` 等语法错误。
- 失败覆盖 `NetworkLogicAnalyzerDriver.simple.test.ts`、`SaleaeLogicDriver.comprehensive.test.ts`、`HardwareDriverManager.simple.test.ts`、`LogicAnalyzerDriver.perf.test.ts` 等多类驱动测试。
- 该问题属于全局 Jest/质量门禁配置，不属于 worktree 01 的 Pico 单设备协议状态机写入边界。

临时验证方式：

```bash
rtk proxy npx jest --config jest.webview.config.js tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts --runInBand --testMatch '**/*.test.ts'
rtk npm run typecheck
```

## 本 worktree 完成范围

- `StartCapture` 改为等待 `CAPTURE_STARTED` 后才置为采集态并返回 `CaptureError.None`。
- 串口/网络二进制采集前暂停文本 parser，采集完成或失败后恢复，降低文本解析器消费二进制帧的风险。
- `StopCapture` 空闲语义改为返回 `false`。
- 串口电压状态改为 `UNSUPPORTED`。
- Blast 校验对齐原版：`preTriggerSamples === 0`、`frequency === blastFrequency`、`loopCount === 0`。
- `getLimits` 对齐原版 `MaxPostSamples = totalSamples - 2`、`MaxTotalSamples = MinPreSamples + MaxPostSamples`。
- 补齐 blink / stopBlink 命令 `5` / `6`。
- `CaptureRequest` 和 `CaptureModels` 通道数组改为通道号列表，不再写 bit mask。
- 网络配置固定字段改为 ASCII 字节写入。

## 未完成但需后续处理

- 真实硬件串口 8/16/24 通道采集未在本环境验证。
- 全局 `test:drivers` 脚本和旧驱动测试需要在质量/CI worktree 中统一修复。
