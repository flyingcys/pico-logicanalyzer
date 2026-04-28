# `.lac` golden fixture 说明

本目录保存 `.lac` 格式兼容测试使用的最小 golden 样本。

| 文件 | 来源/目的 | 覆盖点 |
| --- | --- | --- |
| `original-pascal-region.lac` | 按原版 `ExportedCapture` PascalCase 结构手工整理的最小样本 | `Settings`、root `Samples`、`SelectedRegions`、非连续 `ChannelNumber` packed UInt128 位号 |
| `current-lowercase-samples.lac` | VSCode 扩展早期 lowercase 结构兼容样本 | lowercase `settings`、通道内 per-sample `samples`、lowercase 区域颜色 |
| `i2c-ui-smoke.lac.json` | I2C 协议 UI smoke 使用的最小完整事务 | root `Samples` packed 位、CH0/SCL、CH1/SDA、START、地址写、ACK、数据写、STOP |

字段契约：

- 主输出格式使用原版 PascalCase：`Settings`、`CaptureChannels`、`Samples`、`SelectedRegions`。
- lowercase 只作为兼容输入，重新保存或导出时必须归一化为 PascalCase。
- root `Samples` 是每个采样点一个 128 bit packed 值，bit 位使用 `AnalyzerChannel.ChannelNumber`，不是通道数组下标。
- 通道内 `Samples`/`samples` 是扩展早期结构，每个元素表示该通道一个采样点的 `0` 或 `1`。

## `i2c-ui-smoke.lac.json` 语义

- CH0 是 SCL。
- CH1 是 SDA。
- 采样率是 1 MHz，样本总数是 164。
- 期望 7 位地址是 `0x50`，写方向，地址字节为 `0xA0`。
- 期望数据字节是 `0x3C`。
- 期望解码结果至少出现 START、ACK、STOP，并包含 `Address write: 50` 与 `Data write: 3C`。
- 后半段保持 idle 高电平，用于保证 Webview 有足够样本绘制波形，不代表第二段事务。
