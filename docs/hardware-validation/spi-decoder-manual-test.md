# SPI 解码器手工测试记录

本模板用于记录 SPI 解码器进入 UI 手工测试候选后的验证结果。SPI 当前已经具备解码器、DecoderManager、VSCode host、HTML host 与右侧协议面板的软件闭环候选路径，但本模板填写完成前不得声明真实硬件已通过。

## 候选准入说明

| 项目 | 当前状态 | 证据要求 |
| --- | --- | --- |
| 解码器核心 | 候选 | `tests/unit/decoders/protocols/SPIDecoder.test.ts` 覆盖 Mode 0、通道映射、选项重置、CS 断言和取消断言 |
| Manager / VSCode host | 候选 | `tests/unit/webview/main.test.ts` 覆盖 `runDecoder` 到 `DecoderManager.executeDecoder()` 路径 |
| Webview store / UI | 候选 | 右侧协议选择器可选 SPI，可配置 CLK/MISO/MOSI/CS 与 CS polarity、CPOL、CPHA、bit order、word size |
| HTML host smoke | 候选 | `npm run test:webview:smoke` 覆盖 SPI UI 入口、运行按钮和模拟结果渲染 |
| 真实硬件认证 | 未认证 | 必须填写本文档中的 `.lac`、截图、日志和 hash 记录后再更新认证矩阵 |

自动化准入只能证明软件路径可运行，不能替代真实 Pico、真实 SPI 目标设备和实际采集波形的手工记录。

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
| SPI 目标设备 |  |

## 自动化准入记录

| 命令 | 结果 | commit |
| --- | --- | --- |
| `npm run typecheck` | 通过 / 失败 / 未执行 |  |
| `npm run test -- tests/unit/decoders/protocols/SPIDecoder.test.ts tests/unit/webview/main.test.ts --runInBand` | 通过 / 失败 / 未执行 |  |
| `npm run test:webview:smoke` | 通过 / 失败 / 未执行 |  |

## 接线

| Pico LogicAnalyzer 通道 | SPI 信号 | 目标设备引脚 | 备注 |
| --- | --- | --- | --- |
| CH0 | CLK |  | 记录空闲电平，用于判断 CPOL |
| CH1 | MISO |  | 可选，未接时记录为不参与 |
| CH2 | MOSI |  | 可选，未接时记录为不参与 |
| CH3 | CS |  | 可选，记录 active-low 或 active-high |
| GND | GND |  | 必须共地 |

## 采集配置

| 字段 | 记录 |
| --- | --- |
| 采样率 |  |
| Pre Trigger Samples |  |
| Post Trigger Samples |  |
| 触发通道 | CLK / CS |
| 触发类型 | Edge / Fast / Complex |
| 通道启用状态 | CLK、MISO、MOSI、CS |
| SPI 模式 | Mode 0 / 1 / 2 / 3 |
| CPOL | 0 / 1 |
| CPHA | 0 / 1 |
| Bit order | msb-first / lsb-first |
| Word size |  |
| CS polarity | active-low / active-high |

## UI 操作步骤

1. 打开包含 SPI 采样数据的 `.lac` 文件，确认波形区能显示 CLK、MISO、MOSI、CS 对应通道。
2. 在右侧面板切到“协议解码”，从“协议”选择器选择 `SPI`。
3. 在映射区设置 `CLK`，并至少设置 `MISO` 或 `MOSI` 其中一个数据通道；如采集包含片选信号，同时设置 `CS`。
4. 设置 `CS 极性`、`CPOL`、`CPHA`、`Bit order` 和 `Word size`，配置应与目标设备或夹具说明一致。
5. 点击 `运行 SPI 解码`。
6. 检查结果表中是否出现 MISO/MOSI 字节、CS 断言/取消断言、transfer 摘要等 annotation。
7. 修改至少一项 SPI 配置后再次运行，确认第二次结果不受第一次配置污染。

## 预期结果

| 检查项 | 预期 |
| --- | --- |
| 协议选择 | 选择 `SPI` 后标题和运行按钮切换为 SPI |
| 通道映射 | CLK/MISO/MOSI/CS 映射与用户选择一致，重复映射会显示冲突 |
| 必填通道 | 缺少 CLK 或同时缺少 MISO/MOSI 时不能执行或显示明确错误 |
| 选项下发 | CS polarity、CPOL、CPHA、bit order、word size 进入 host `runDecoder` 请求 |
| 结果渲染 | MISO/MOSI 字节和 CS 事件显示在右侧结果表 |
| 重复运行 | 连续两次不同配置运行不会复用旧选项或旧结果 |

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
| CLK/MISO/MOSI/CS 映射是否与配置一致 | 是 / 否 |
| MOSI 传输字节 |  |
| MISO 传输字节 |  |
| CS 断言和取消断言是否可见 | 是 / 否 |
| CPOL/CPHA 组合是否与预期采样边沿一致 | 是 / 否 |
| Bit order 是否与预期一致 | 是 / 否 |
| Word size 是否与预期一致 | 是 / 否 |
| 连续两次不同配置运行是否互不污染 | 是 / 否 |
| UI 结果表是否显示 MISO/MOSI 字节 | 是 / 否 |
| UI 结果表是否显示 CS 事件 | 是 / 否 / 未接 CS |
| host 日志中的 SPI 选项是否与 UI 一致 | 是 / 否 |

## 失败记录

| 字段 | 记录 |
| --- | --- |
| 失败步骤 |  |
| 预期结果 |  |
| 实际结果 |  |
| 附件路径 |  |
| 附件 sha256 |  |
| 问题链接 |  |

## 结论

| 字段 | 记录 |
| --- | --- |
| 结论 | 通过 / 失败 / 阻塞 |
| 限制说明 |  |
| 备注 |  |
