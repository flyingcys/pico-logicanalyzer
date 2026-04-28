# Signal DSL Fixture 说明

本目录保存合成采集 DSL 的自动化测试样例。`examples/` 下的文件必须能被 `SignalDescriptionLanguage` 解析，并能通过 `LACFileFormat.createFromCaptureSession(..., true)` 输出原版兼容 `.lac` 样本数组。

当前 DSL 以通用数字波形为主：`clock`、`pattern`、`constant`、`pulse`。I2C、SPI、UART、CAN 示例用于生成协议解码器 golden 的输入波形，不声明完整协议语义。

