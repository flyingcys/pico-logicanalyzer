# I2C Pico UI 手工测试记录

本模板用于三个 I2C UI worktree 合并后记录真实硬件验证结果。fixture 或 mock 通过不能替代本记录。

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
| I2C 目标设备 |  |

## 接线

| Pico LogicAnalyzer 通道 | I2C 信号 | 目标设备引脚 | 备注 |
| --- | --- | --- | --- |
| CH0 | SCL |  | 确认上拉电阻 |
| CH1 | SDA |  | 确认上拉电阻 |
| GND | GND |  | 必须共地 |

## 采集配置

| 字段 | 记录 |
| --- | --- |
| 采样率 | 1 MHz 起，根据总线速度调整 |
| Pre Trigger Samples |  |
| Post Trigger Samples |  |
| 触发通道 | CH0 / CH1 |
| 触发类型 | Edge / Fast / Complex |
| 触发极性或模式 |  |
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
| 地址 |  |
| 读写方向 | Read / Write |
| 数据字节 |  |
| ACK / NACK |  |
| 是否出现 START | 是 / 否 |
| 是否出现 STOP | 是 / 否 |
| UI 是否显示波形 | 是 / 否 |
| 右侧 I2C 结果表是否显示结果 | 是 / 否 |

## 结论

| 字段 | 记录 |
| --- | --- |
| 结论 | 通过 / 失败 / 阻塞 |
| 问题链接 |  |
| 备注 |  |
