# Pico 驱动协议 fixture

本目录保存 worktree 01 使用的 Pico 串口/TCP 协议级 fixture。fixture 只覆盖 `src/drivers/LogicAnalyzerDriver.ts` 与 `src/drivers/AnalyzerDriverBase.ts` 的原版 `SharedDriver` 对齐行为，不承载设备发现、前端连接面板或其他厂商驱动验证。

## 文件清单

| 文件 | 来源 | 覆盖点 |
| --- | --- | --- |
| `pico-serial-8ch-single-frame.json` | 根据原版 `SharedDriver.LogicAnalyzerDriver.ReadCapture` 串口布局手工构造 | `UInt32LE sampleCount + sample bytes + UInt8 timestampLength` 在同一个 `data` chunk 到达时，驱动必须完成采集并按捕获通道索引提取样本 |

## 字段约定

- `frameHex`：可直接转为 `Buffer` 的十六进制串。
- `sampleCount`：帧头部的样本数量。
- `expectedChannelSamples`：按捕获通道索引断言的 0/1 样本序列。原版 `ExtractSamples` 使用捕获列表索引作为 bit mask，而不是物理通道号。

真实硬件验证记录写入 `docs/worktrees/01-pico-driver-parity.md`，本目录只保存可自动回放的协议样本。
