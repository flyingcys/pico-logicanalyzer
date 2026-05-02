# 现有协议解析器与 logicanalyzer 对齐审计

更新时间：2026-05-02

## 1. 结论

没有。

当前仓库里已经存在的协议解析器，**不能**下结论为“已经全部对齐 `logicanalyzer`”。更准确的说法是：

- `I2C / Streaming I2C / SPI / UART / CAN / LIN / I2S` 这 7 条协议路径都已经有可运行实现；
- 新前端右侧协议面板也已经把 `i2c/spi/uart/can/lin/i2s` 六类协议入口接入了主 UI；
- 但它们距离参考 `logicanalyzer` 的“协议行为、输出模型、选项语义、运行时口径、测试证据”仍有不同程度差距；
- 因此当前最可信结论只能是：**部分协议已达到“基础可用 + 局部对齐”，尚未达到“全部对齐”**。

## 2. 审计范围

本次审计只讨论“当前仓库已经存在的协议解析器”，不讨论新增协议数量。

当前实现范围：

- 常规解码器：`i2c`、`spi`、`uart`、`can`、`lin`、`i2s`
- 流式解码器：`streaming_i2c`

参考基线：

- `logicanalyzer/compiled-release-linux-x64/decoders`
- 当前参考目录下共有 **132** 个协议目录

相关代码与证据范围：

- 实现：`src/decoders/*`
- 前端入口：`src/frontend/core/stores/decoderStore.ts`、`src/frontend/app/components/AppSidebarRight.vue`
- VSCode host：`src/providers/LACEditorProvider.ts`
- browser/html host：`src/frontend/platform/host/browserHost.ts`
- 测试：`tests/unit/decoders/*`、`tests/unit/webview/main.test.ts`
- 历史对齐文档：`docs/协议分析器现状与logicanalyzer对齐分析-2026-04-29.md`、`docs/协议分析插件闭环与手工测试准入评审-2026-04-29.md`

## 3. 当前最可信总体判断

### 3.1 哪些旧结论已经过时

以下旧结论已经不再准确：

- “当前新前端主路径只真正接入了 I2C”
  - 已过时。当前 `decoderStore.activeDecoderConfigs` 和 `AppSidebarRight.vue` 已接入 `i2c/spi/uart/can/lin/i2s` 六类协议入口。
- “`DecoderRegistry.registerAllDecoders()` 不注册 `i2c/spi/uart`”
  - 已过时。当前 `DecoderRegistry.ts` 已统一注册 `i2c/spi/uart/can/lin/i2s` 和 `streaming_i2c`。
- “`browserHost` 只接受 `i2c`”
  - 已过时。当前 `browserHost.ts` 已提供 `I2C/SPI/UART/CAN/LIN/I2S HTML 模拟` 六类路径。

### 3.2 哪些旧结论仍然成立

以下结论仍然成立，而且仍是当前主要阻断：

- 参考 `logicanalyzer` 的协议输出模型不只有 annotation；I2C/SPI/UART/CAN/I2S 至少包含 `OUTPUT_PYTHON`，I2C/SPI/UART/I2S 还包含 `OUTPUT_BINARY`，I2C/SPI 还包含 `OUTPUT_META`。
- 当前仓库主框架 `DecoderResult` 仍以 annotation/result 为主，尚不能证明已经对齐参考实现的完整输出语义。
- 当前大量测试仍然证明的是“有结果、主路径可跑、实例复用不污染、golden 子集匹配成立”，不能直接证明“协议已与参考实现完全等价”。

### 3.3 当前应该使用的分级口径

建议后续统一使用以下口径：

- `已基本对齐`
  - 软件主路径、关键选项、主要 annotation 行为和 Manager/UI 接入基本闭环
  - 但仍可能缺 Python/Binary/Meta 输出、真实样本证据或边界语义
- `部分对齐`
  - 核心状态机和基础结果可跑
  - 但输入模型、输出模型、选项复位、边界行为或测试证据仍有明显缺口
- `明显未对齐`
  - 即使已有类和测试，也与参考实现的行为模型存在结构性差距

本轮审计最终采用这 3 档。

### 3.4 测试与证据层面的总体判断

当前测试与文档证据能证明：

- 六个常规协议和一个流式协议都已有实现、注册和自动化覆盖；
- UI、VSCode host 和 fixture/golden 主路径已经形成软件闭环；
- 若干历史关键缺口已经被关闭，例如：
  - I2C 逆序命名通道、bit annotation
  - Streaming I2C 跨块状态与透明切换
  - SPI/UART/CAN/LIN/I2S 的实例复用默认值恢复
  - classic CAN 多帧与基础 stuffing
  - I2S 32 位符号位问题

但当前证据仍然**不能**证明：

- 与 `logicanalyzer` 的协议输出全集完全等价；
- `python / binary / meta` 输出模型已经全面对齐；
- 真实设备、真实样本、真实 `.lac`、真实 sigrok 回放层面的全部对齐；
- 所有协议的全部边界语义、全部选项组合、全部 warning 行为都已和参考实现精确一致。

## 4. 运行时与入口现状

### 4.1 运行时注册

当前存在 3 套入口：

- `DecoderManager.registerBuiltinDecoders()`
  - 构造时注册 `i2c/spi/uart/can/lin/i2s` 和 `streaming_i2c`
- `src/decoders/index.ts`
  - `initializeDecoders()` 再次注册 `i2c/spi/uart/can/lin/i2s`
- `DecoderRegistry.registerAllDecoders()`
  - 当前也注册 `i2c/spi/uart/can/lin/i2s` 和 `streaming_i2c`

结论：

- 比 2026-04-29 时更收敛，但注册入口仍然分裂；
- “能运行”与“注册架构已完全对齐”不是一回事；
- 对齐审计必须同时看 `DecoderManager`、`index.ts`、`DecoderRegistry.ts`，不能只看其一。

### 4.2 UI 与 Host 入口

当前 UI/Host 状态：

- `decoderStore.activeDecoderConfigs` 已提供 `i2c/spi/uart/can/lin/i2s`
- `AppSidebarRight.vue` 已根据 `selectedDecoderId` 渲染不同映射和选项表单
- `LACEditorProvider.ts` 的 VSCode host 已按 `decoderId` 调用 `DecoderManager.executeDecoder()`
- `browserHost.ts` 提供的是 `I2C HTML 模拟`、`SPI HTML 模拟`、`UART HTML 模拟`、`CAN HTML 模拟`、`LIN HTML 模拟`、`I2S HTML 模拟`

结论：

- “协议入口只剩 I2C”已不成立；
- 但 browser/html host 的模拟结果不能当成参考实现对齐证据；
- 真正有价值的仍是 VSCode host + `DecoderManager` + 协议专项测试 + golden。

## 5. 协议逐项审计

> 说明：本节按 `输入模型 / 状态机行为 / 输出模型 / 选项语义 / UI/Manager 接入 / 测试证据` 六个维度记录。每个协议都会明确区分“代码已经对齐”“代码仍有差距”“当前只是证据不足”。

### 5.1 I2C

当前结论：**部分对齐**

已对齐或基本对齐的部分：

- 常规 I2C 注释主路径可跑
- `shifted / unshifted` 地址格式、bit annotation、实例复用、逆序命名通道映射已有专项覆盖
- VSCode host、UI 面板和 streaming 大样本透明切换路径已打通

仍未对齐的核心点：

- 参考实现存在 `OUTPUT_PYTHON / OUTPUT_BINARY / OUTPUT_META`，当前主框架无法等价承载
- 不能证明 10 位地址、warning、bitrate meta 等语义已对齐
- 现有测试主要证明 annotation 和 rawData 子集，不足以证明完整输出模型一致

更细分地说：

- 输入模型：
  - 已对齐：常规双线输入已对齐到 `SCL/SDA`。
  - 已对齐：命名通道与逆序输入容错已补齐，解码器内部已不再只依赖位置映射。
- 状态机行为：
  - 已基本对齐：`START / REPEATED START / ADDRESS / DATA / ACK / STOP` 主路径已闭环。
  - 代码差距：`BITS` 位输出顺序仍未证明与参考实现完全一致。
  - 代码差距：10 位地址显示与内部状态语义仍未完全对齐。
  - 代码差距：参考实现中的部分 warning 分支，在当前实现中没有等价路径。
- 输出模型：
  - 当前主要是 `annotationType 0..10` 和 `rawData`。
  - 已收敛：当前已在 `STOP` 时产出 `META bitrate` typed output。
  - 代码差距：参考实现的 `OUTPUT_PYTHON / OUTPUT_BINARY` 仍未形成同等级对齐。
- 选项语义：
  - 已对齐：`address_format = shifted / unshifted` 的 7 位地址显示语义基本一致。
- 证据等级：
  - 已有较强专项测试与 golden 证明 7 位常规主路径可用。
  - 证据差距：缺 10 位地址、warning、Python/Binary/Meta 输出的回归断言。
  - 结论只能写成“软件闭环 / 部分对齐”，不能写成“完全对齐”。

### 5.2 Streaming I2C

当前结论：**部分对齐**

已对齐或基本对齐的部分：

- 透明大样本切换路径已存在
- 串行分块、跨块状态、停止请求、bit annotation 和地址/数据主路径已有专项测试

仍未对齐的核心点：

- 本质仍是仓库侧扩展实现，不是参考 `logicanalyzer` 的独立协议目录直译对齐
- binary/meta/warning/10 位地址等完整输出与边界语义不能证明已对齐

更细分地说：

- 输入模型：
  - 已对齐：显式 `captureIndex/decoderIndex` 映射路径已接通。
  - 代码差距：它仍是当前仓库为大样本做的流式扩展，不是参考目录里的一对一独立协议。
- 状态机行为：
  - 已基本对齐：跨块 `Start/Stop`、地址/数据、`ACK/NACK`、停止请求已有专项测试。
  - 代码差距：状态机是简化版，没有完整继承参考 I2C 的 `rem_addr_bytes / slave_addr_10 / pdu_bits / bitwidth` 语义。
  - 代码差距：`ACK` 后固定转 `DATA`，10 位地址相关流程天然不等价。
- 输出模型：
  - 仍主要落在 `annotation/result` 层。
  - 代码差距：没有参考 I2C 的 Python/Binary/Meta 对齐。
- 证据等级：
  - 已有测试能证明它是“当前仓库的大样本透明执行模式”。
  - 证据差距：没有 repeated-start、read、unshifted、10-bit 的等价级证据。
  - 不能写成“与参考实现一一等价”。

### 5.3 SPI

当前结论：**部分对齐**

已对齐或基本对齐的部分：

- `cpol/cpha/bitorder/wordsize/cs polarity` 等核心选项已在实现和测试中闭环
- bit/data/transfer/cs-change annotation 级行为已有较强测试覆盖
- UI 入口、Manager 路径和 host 路径已存在

仍未对齐的核心点：

- 参考实现含 `OUTPUT_PYTHON / OUTPUT_BINARY / OUTPUT_META`
- 当前只能证明 annotation/result 级行为，不足以证明完整输出模型一致

更细分地说：

- 输入模型：
  - 已基本对齐：`CLK` 必需，`MISO/MOSI/CS` 可选，主通道模型与参考实现大体一致。
  - 代码差距：直接实例化 `decode()` 仍默认 `channels[0..3]` 已按顺序排好，不像 I2C 那样在解码器内按名称兜底。
- 状态机行为：
  - 已基本对齐：`cpol/cpha/bitorder/wordsize`、仅 MISO / 仅 MOSI / 双向路径都有实现和测试。
  - 已实现：`cs-change` 已落到 `annotationType 7`。
  - 代码差距：无 CS 时，当前不会产生参考实现等价的初始 `CS-CHANGE` 事件。
  - 代码差距：有 CS 时，当前还会抑制“初始为 deasserted”的首个 CS 变化事件。
- 输出模型：
  - 目前可见的是 annotation 和 `rawData`。
  - 已收敛：当前已开始落地最小 `PYTHON DATA` typed output。
  - 代码差距：参考实现的 `BITS / CS-CHANGE / TRANSFER` Python 输出、binary 输出和 bitrate meta 仍未形成对齐。
  - 代码差距：当前额外引入 `cs-change` annotation，本身就与参考实现的输出层级不同。
- 证据等级：
  - 已有较强单测和 golden，能证明主路径较完整。
  - 证据差距：没有对 Python/Binary/Meta，也没有对“无 CS 初始事件”的参考语义做断言。
  - 当前应写成“主路径较完整，但输出模型未对齐”。

### 5.4 UART

当前结论：**部分对齐**

已对齐或基本对齐的部分：

- `baudrate/data bits/parity/stop bits/invert/sample point` 等主选项已实现并接入 UI
- packet delimiter / packet length 基础逻辑已进入实现
- Manager/UI/host/golden 基础路径已打通

仍未对齐的核心点：

- 参考实现有 `OUTPUT_PYTHON / OUTPUT_BINARY`
- break / idle / frame warning / packet 语义是否与参考实现完全一致，现有证据不足
- 当前测试更偏“主路径可跑”，不足以证明逐事件输出与参考实现一一对应

更细分地说：

- 输入模型：
  - 已对齐：`RX/TX` 双通道可选，与参考实现大方向一致。
- 状态机行为：
  - 已有实现：`start/data/parity/stop/break/packet` 都已有实现字段与 annotation 行。
  - 代码差距：主循环没有走参考实现的 `wait + edge + idle` 三条件协同，而是简化为逐样本扫描。
  - 已收敛：`handleIdle()` 与 `handleFrame()` 已开始产出最小 `PYTHON` 事件。
  - 代码差距：`stop_bits` 的 `0.5/1.5` 是声明支持，不是参考等价级实现。
- 输出模型：
  - 当前可见的是 annotation 与 `rawData`。
  - 已收敛：当前已开始输出最小 `PYTHON FRAME / IDLE` 事件。
  - 代码差距：参考中的 Python `STARTBIT/DATA/PARITYBIT/STOPBIT/BREAK` 以及 Binary `rx/tx/rxtx dump` 仍未对齐。
- 选项语义：
  - 代码差距：`rx_packet_delim/tx_packet_delim` 被实现成字符串分隔，仅在 `ascii` 下启用；参考是十进制字节值分隔符。
  - 代码差距：`rx_packet_delim/tx_packet_delim/rx_packet_len/tx_packet_len` 默认值与参考实现不同。
- 证据等级：
  - 已有专项测试能证明基础 annotation、奇偶校验、packet/break 框架可跑。
  - 证据差距：不能证明 break/idle/frame/Python/Binary/packet delimiter 等参考语义已经对齐。
  - 结论应写成“部分对齐”。

### 5.5 CAN

当前结论：**部分对齐**

已对齐或基本对齐的部分：

- classic CAN 多帧、基础 bit stuffing 去填充、warning、UI/host 路径已有实现与测试
- `bitrate/sample_point`、实例复用和 classic 帧样例已有专项覆盖

仍未对齐的核心点：

- 参考实现有 `OUTPUT_PYTHON`
- 真实 CRC 校验、CAN-FD、完整重同步和更长时序边界不能证明已对齐
- 当前只能说 classic CAN 第一版可用，不能说与参考实现完全一致

更细分地说：

- 输入模型：
  - 当前实现假定输入是已还原的单线逻辑位流，属于 classic CAN 的简化模型。
  - 代码差距：参考选项是 `nominal_bitrate + fast_bitrate + sample_point`，当前只有单 `bitrate`。
- 状态机行为：
  - 已部分对齐：classic CAN 多帧、基础 stuffing、dominant edge 简单重同步、标准/扩展帧基础解析已存在。
  - 代码差距：未实现 CAN-FD、fast bitrate 切换、BRS/ESI、CRC-17/21、error frame、overload frame。
  - 已收敛：当前已对 classic CAN 的 CRC-15 做计算与 mismatch warning。
- 输出模型：
  - 主要还是 annotation/result。
  - 代码差距：annotation 颗粒度明显比参考粗；也没有参考的 Python packet 输出。
- 选项语义：
  - 代码差距：`sample_point` 默认值与参考不同，`bitrate` 也不能表达 `fast_bitrate`。
- 证据等级：
  - 已有 classic 标准帧、多帧、stuff bit error、简单重同步、扩展帧 golden 覆盖。
  - 证据差距：没有证明细粒度 annotation、CRC 校验、CAN-FD 行为与参考一致。
  - 当前只能写成“classic CAN 第一版部分对齐”。

### 5.6 LIN

当前结论：**明显未对齐**

已对齐或基本对齐的部分：

- raw logic 主路径、checksum 选项、header-only/no-response 基本分支已有实现与测试
- UI/host 路径已存在

仍未对齐的核心点：

- 参考 `logicanalyzer` 的 LIN 解码是更贴近 UART 级联/总线语义的实现
- 当前仓库仍主要是 raw logic 路径
- 输入模型与参考实现存在结构性差异，因此不能说已经对齐

更细分地说：

- 输入模型：
  - 代码差距：当前实现是单线 raw logic 输入。
  - 代码差距：参考实现消费的是上游 UART 事件流，模型层级完全不同。
- 状态机行为：
  - 已有实现：`break/sync/pid/data/checksum/no response` 都可跑。
  - 代码差距：当前是 `findBreak() + readByte()` 的直读逻辑，没有参考实现的 `LinFsm`、`handle_uart_idle()`、错误态恢复链路。
  - 代码差距：当前 `data_length` 由用户指定，参考则根据 UART 事件流和 idle/break 时机推导响应结束。
- 输出模型：
  - 代码差距：annotation 体系完全不同。参考是 LIN 帧语义汇总，当前更像原始字段平铺。
- 选项语义：
  - 代码差距：参考只有 `version: 1|2`，当前暴露的是 `baudrate/data_length/checksum(classic/enhanced/lin1.x/lin2.x)`。
  - 已收敛：在 `enhanced` 模式下，`0x3C/0x3D` 诊断标识符现在按 classic checksum 计算，不再把 PID 纳入校验和。
- 证据等级：
  - 现有测试只能证明当前 raw-logic 路径可跑。
  - 因为模型根本不同，它是当前 7 个协议里最不适合写成“已对齐”的一个。

### 5.7 I2S

当前结论：**部分对齐**

已对齐或基本对齐的部分：

- `word_length / justification`、32 位高位为 1 的无符号语义、实例复用已有实现与测试
- UI/host 路径已存在

仍未对齐的核心点：

- 参考实现有 `OUTPUT_PYTHON / OUTPUT_BINARY`
- 当前仓库主要证明 annotation/rawData 主路径
- WS 边界、首字同步、warning、binary 输出和更高阶音频语义不能证明已对齐

更细分地说：

- 输入模型：
  - 已基本对齐：三线 `SCK/WS/SD` 已对齐。
- 状态机行为：
  - 已部分对齐：按 `SCK` 上升沿采样、`WS` 翻转闭合字边界，主循环接近参考。
  - 已实现：`word_length / justification`、extra bits warning、32 位无符号 `rawData`。
  - 代码差距：`word_length / justification` 是当前仓库扩展能力，不是参考语义。
  - 代码差距：当前是固定 `word_length` 截断，参考是按实际 bitcount 建立 wordlength 并对长度变化报警。
- 输出模型：
  - 代码差距：当前只出 annotation；参考还会输出 Python `DATA` 和 WAV binary。
  - 已收敛：当前声明的 `bit` annotation 已真正落地，并补齐 `bits` 行。
  - 代码差距：参考仍是 `left/right/warnings` 加 Python/WAV binary；当前的 `bit` annotation 属于仓库扩展能力，不等同于参考输出层级。
- 证据等级：
  - 已有 16/24/32 位、WS 边界、实例复用、Manager 映射和 golden 证据。
  - 证据差距：没有证明 Python/WAV binary 与参考一致。
  - 可写成“基础音频解码部分对齐”，不能写成“完全对齐”。

## 6. 关键结构性差距

### 6.1 输出模型仍未对齐

这是当前最核心的“全局未对齐”。

参考实现至少包含：

- `I2C`: `OUTPUT_PYTHON`、`OUTPUT_BINARY`、`OUTPUT_META`
- `SPI`: `OUTPUT_PYTHON`、`OUTPUT_BINARY`、`OUTPUT_META`
- `UART`: `OUTPUT_PYTHON`、`OUTPUT_BINARY`
- `CAN`: `OUTPUT_PYTHON`
- `I2S`: `OUTPUT_PYTHON`、`OUTPUT_BINARY`

当前仓库主框架：

- 主要输出 `DecoderResult`
- 以 `annotationType / values / rawData / shape` 为中心
- 现在已能在结果对象中承载 `type`
- 且已有协议开始产出 typed output：
  - `I2C`: `META bitrate`
  - `UART`: `PYTHON FRAME / IDLE`
  - `SPI`: `PYTHON DATA`
- 但仍不能证明对上层 Python/Binary/Meta 语义已完整承接

可直接对照如下：

| 协议 | 参考 `logicanalyzer` 输出模型 | 当前仓库已能稳定证明的输出 |
| --- | --- | --- |
| I2C | Annotation + Python + Binary + Meta | 主要是 Annotation + `rawData` |
| Streaming I2C | 仓库自定义扩展，无直接一对一参考目录 | 主要是 Annotation + `rawData` |
| SPI | Annotation + Python + Binary + Meta | 主要是 Annotation + `rawData` |
| UART | Annotation + Python + Binary | 主要是 Annotation + `rawData` |
| CAN | Annotation + Python | 主要是 Annotation + `rawData` |
| LIN | 参考实现的总线语义输出 | 主要是 Annotation + `rawData` |
| I2S | Annotation + Python + Binary | 主要是 Annotation + `rawData` |

因此，即便 typed output 已经开始从 0 走到 1，仍不足以下“全部协议已对齐”的总结论。

### 6.2 测试证据强度仍不足以支持“完全对齐”

当前测试能证明：

- 常规 happy path 可跑
- 大量实例复用污染问题已修
- 若干 golden 子集与预期一致
- UI/host 路径能触发解码器

当前测试不能充分证明：

- 与参考 `pd.py` 的逐事件输出完全等价
- Python/Binary/Meta 输出等价
- 所有边界条件、warning、复杂状态机行为完全对齐
- 真实样本/真实设备级的一致性

### 6.3 UI 接入不再是主要阻断，但仍不是“对齐证据”

与旧文档相比，当前 UI 入口已经明显推进。

但必须区分：

- `UI 能选到协议`
- `host 能调到协议`
- `协议已与参考实现对齐`

这三件事不是同一层级。

## 7. 当前最稳妥的最终口径

如果要回答“所有已经存在的协议解析器已经全部对齐 logicanalyzer 了吗”，当前最稳妥回答是：

**没有。**

更完整的口径应写成：

- 当前已有 7 条协议解析路径都已具备不同程度的实现与自动化覆盖；
- 新前端六类协议 UI 入口也已经打通；
- 第一轮和第二轮自动实现后，已有若干高价值缺口继续收敛：
  - `I2C`: bit annotation 顺序、10-bit 最小语义、`META bitrate`
  - `Streaming I2C`: repeated-start/read 最小语义
  - `SPI`: 无 CS 初始 `cs-change`、最小 `PYTHON DATA`
  - `UART`: delimiter 数值语义、`PYTHON IDLE / FRAME`
  - `CAN`: CRC-15 计算与 mismatch warning
  - `LIN`: 诊断帧 checksum 语义、部分 checksum 边界
  - `I2S`: bit annotation 真正落地
- 但从参考 `logicanalyzer` 的完整输出模型、边界语义、输入模型一致性和证据强度来看，当前最多只能说：
  - `I2C / Streaming I2C / SPI / UART / CAN / I2S`：**部分对齐**
  - `LIN`：**明显未对齐**
- 因而不能宣称“现有协议解析器已经全部对齐 logicanalyzer”。

## 8. 建议后续文档口径

建议后续在 README、功能状态矩阵、协议专项文档里统一使用：

- `基础可用`
- `部分对齐`
- `输出模型未对齐`
- `证据不足，不能宣称完全对齐`

不要使用：

- `全部对齐`
- `完全兼容`
- `100% parity`

除非至少同时补齐：

- 协议实现行为对齐
- Python/Binary/Meta 输出对齐
- Manager / UI / host 运行时口径一致
- 更强的逐事件 golden 断言
- 真实样本或真实设备级证据
