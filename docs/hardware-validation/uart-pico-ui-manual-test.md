# UART Pico UI 手工测试记录

本模板用于记录 UART 协议解码 UI 的真实硬件验证结果。自动化、HTML 模拟、fixture 或 mock 通过不能替代本记录。

## 基本信息

| 字段 | 记录 |
| --- | --- |
| 测试日期 | YYYY-MM-DD |
| 操作人 |  |
| commit |  |
| VSCode 版本 |  |
| OS |  |
| 扩展版本 / VSIX |  |
| Pico 型号 |  |
| 固件版本 |  |
| UART 目标设备 |  |

## 接线

| Pico LogicAnalyzer 通道 | UART 信号 | 目标设备引脚 | 备注 |
| --- | --- | --- | --- |
| CH0 | RX |  | 与目标 TX 相连 |
| CH1 | TX |  | 与目标 RX 相连，可选 |
| GND | GND |  | 必须共地 |

## 采集配置

| 字段 | 记录 |
| --- | --- |
| 采样率 | 至少为 baudrate 的 8 倍，建议 1 MHz 起 |
| Baudrate | 115200 / 9600 / 其它 |
| Data bits | 5 / 6 / 7 / 8 / 9 |
| Parity | none / odd / even / zero / one / ignore |
| Stop bits | 0.5 / 1.0 / 1.5 / 2.0 |
| Invert RX | 是 / 否 |
| Invert TX | 是 / 否 |
| Sample point | 50 |
| Pre Trigger Samples |  |
| Post Trigger Samples |  |
| 触发通道 | RX / TX |
| 通道启用状态 | CH0、CH1 |

## 结果文件

| 字段 | 记录 |
| --- | --- |
| 保存的 `.lac` 路径 |  |
| `.lac` sha256 |  |
| 波形截图路径 |  |
| 解码结果截图路径 |  |
| 日志路径 |  |

可用以下命令记录 hash：

```bash
sha256sum path/to/capture.lac
```

## 解码摘要

| 字段 | 记录 |
| --- | --- |
| RX 数据字节 |  |
| TX 数据字节 |  |
| 起始位是否显示 | 是 / 否 |
| 停止位是否显示 | 是 / 否 |
| 校验位结果 | OK / Error / 不适用 |
| Frame warning | 有 / 无 |
| Break 注释 | 有 / 无 |
| UI 是否显示波形 | 是 / 否 |
| 右侧 UART 结果表是否显示结果 | 是 / 否 |

## 当前 UI 准入口径

| 能力 | 状态 |
| --- | --- |
| RX/TX 映射 | 纳入本轮手工测试 |
| baudrate、data bits、parity、stop bits、invert、sample point | 纳入本轮手工测试 |
| packet delimiter / packet length | 解码器支持自动化覆盖，但 UI 暂不提供配置入口；本轮 UI 手工测试不记录为通过项 |
| Python / Binary / Meta 输出 | 当前 UI 只验证 annotation 结果；不记录为完整 parity 通过 |

## 结论

| 字段 | 记录 |
| --- | --- |
| 结论 | 通过 / 失败 / 阻塞 |
| 问题链接 |  |
| 备注 |  |
