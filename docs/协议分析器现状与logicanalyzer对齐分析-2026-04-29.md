# 协议分析器现状与 logicanalyzer 对齐分析

分析日期：2026-04-29  
仓库：`/home/share/samba/vscode-extension/pico-logicanalyzer`  
参考基线：`logicanalyzer/compiled-release-linux-x64/decoders`

## 1. 结论摘要

当前项目在协议分析器层面已经不是“完全没有实现”，而是处于“框架已成型、少量协议可跑、对齐度明显不足”的阶段。

- 基线 `logicanalyzer` 当前内置 **132** 个协议目录。
- 当前仓库运行时有 **6 个常规解码器**：`i2c`、`spi`、`uart`、`can`、`lin`、`i2s`。
- 另有 **1 个流式解码器**：`streaming_i2c`。
- 但当前新前端主路径只真正接入了 **I2C**。其余协议即使后端类存在，也没有进入现行 UI 主工作流。
- 常规解码器里，`I2C / SPI / UART` 属于“基础注释层可用，但未达到基线完整输出模型”；`CAN / LIN / I2S` 属于“已实现第一版 TS 状态机，但与基线的输入模型、输出模型、真实波形语义仍有显著差距”；`Streaming I2C` 更像仓库自定义扩展，还没有真正并入 `i2c` 主流程。

当前最关键的问题不是“协议数量少”，而是这 4 类结构性差距：

1. 注册入口分裂：`DecoderManager`、`initializeDecoders()`、`registerAllDecoders()` 三套口径不一致。
2. 输出模型不完整：基线普遍依赖 `ANNOTATION / PYTHON / BINARY / META`，当前框架基本只保留了 annotation。
3. 前端接入不足：新前端右侧面板只支持运行 I2C，浏览器 host 也只接受 `i2c`。
4. 测试强度偏弱：多数 golden 断言是子集匹配，能证明“有基础结果”，不能证明“与 logicanalyzer 完整等价”。

## 2. 对比范围

本次分析只聚焦“当前仓库已有的协议分析器”以及它们与 `logicanalyzer` 基线解码器的对齐情况，不展开驱动、波形渲染、文件格式等其它模块。

分析对象包括：

- `src/decoders/protocols/I2CDecoder.ts`
- `src/decoders/protocols/StreamingI2CDecoder.ts`
- `src/decoders/protocols/SPIDecoder.ts`
- `src/decoders/protocols/UARTDecoder.ts`
- `src/decoders/protocols/CANDecoder.ts`
- `src/decoders/protocols/LINDecoder.ts`
- `src/decoders/protocols/I2SDecoder.ts`

## 3. 项目级现状

### 3.1 协议覆盖率

| 维度 | 当前项目 | logicanalyzer 基线 |
| --- | --- | --- |
| 协议目录规模 | 6 常规 + 1 流式 | 132 个协议目录 |
| 当前 UI 主路径可运行 | 仅 I2C | 全量由桌面端解码器管理器驱动 |
| 运行时注册来源 | 多入口且不一致 | 单一 sigrok 解码器目录扫描 |
| 输出模型 | 基本仅 annotation | annotation + python + binary + meta |

### 3.2 运行时注册真实情况

当前项目存在三套注册口径：

- `src/decoders/DecoderManager.ts`
  - 构造函数里会自动注册：`i2c`、`spi`、`uart`、`can`、`lin`、`i2s`、`streaming_i2c`
- `src/decoders/index.ts`
  - `initializeDecoders()` 会再次注册：`i2c`、`spi`、`uart`、`can`、`lin`、`i2s`
- `src/decoders/DecoderRegistry.ts`
  - `registerAllDecoders()` 只注册：`can`、`lin`、`i2s`、`streaming_i2c`
  - 但 `getDecoderRegistryInfo()` 又硬编码返回：`i2c`、`spi`、`uart`、`can`、`lin`、`i2s`

这意味着：

- 真实可用性更多依赖 `DecoderManager` 的内置注册，而不是 `DecoderRegistry`。
- 任何基于 `getDecoderRegistryInfo()` 的结论，都不能直接等价为“运行时已经正确注册”。

### 3.3 前端与 Host 接入情况

当前新前端只把 `I2C` 接到了主工作流：

- `src/frontend/app/components/AppSidebarRight.vue`
  - 标题固定为 “I2C 协议解码”
  - 映射控件只有 `SCL` / `SDA`
  - 按钮固定调用 `runI2CDecoder()`
- `src/frontend/core/stores/decoderStore.ts`
  - `activeDecoderConfigs` 只有 `{ decoderId: 'i2c', label: 'I2C' }`
  - 只有 `runI2CDecoder()`
- `src/frontend/platform/host/browserHost.ts`
  - `runDecoder` 只接受 `i2c`
  - 其它 decoder 直接返回 `Decoder not found`
- `src/providers/LACEditorProvider.ts`
  - VSCode host 可以按 `decoderId` 调 `DecoderManager.executeDecoder()`
  - 但只有 I2C 做了额外输入校验；前端现行 UI 也没有提供其它协议入口

结论：后端有 6+1 个协议类，不等于用户当前能在产品里使用 6+1 个协议。

## 4. 总览矩阵

| 协议 | 当前状态 | 主要问题 | 对齐优先级 |
| --- | --- | --- | --- |
| I2C | 7 位基础注释可用 | 缺 Python/Binary/Meta、bit 注释未落地、注册分裂 | P0 |
| Streaming I2C | 自定义扩展，未真正并入主流程 | `i2c` 不会自动切到流式；跨块状态正确性有风险 | P0 |
| SPI | 注释层最完整 | 缺非 annotation 输出；实例复用下选项污染风险 | P0 |
| UART | 基础注释可用 | 主循环被简化；packet/break/idle/frame 语义不对齐 | P0 |
| CAN | 经典 CAN 单帧第一版可跑 | 无 bit stuffing、无 CAN-FD、只吃首帧 | P0 |
| LIN | raw logic 版第一版可跑 | 输入模型与基线完全不同，应改为 UART 级联 | P0 |
| I2S | 第一版 3 线音频解码可跑 | 字边界模型、输出类型、32 位数值语义与基线不一致 | P0 |

## 5. 各协议现状

### 5.1 I2C

**当前实现**

- 主实现位于 `src/decoders/protocols/I2CDecoder.ts`
- 常规 `i2c` 注册只出现在 `src/decoders/index.ts` 的 `initializeDecoders()`
- `DecoderRegistry.registerAllDecoders()` 并没有注册常规 `i2c`

**已实现能力**

- 元数据、通道、选项、annotation rows 基本对齐基线
- 已实现 `START / REPEATED START / STOP / ACK / NACK / ADDRESS READ|WRITE / DATA READ|WRITE`
- 已实现 `shifted / unshifted` 两种 7 位地址显示
- 代码里有 10 位地址分支

**主要差距**

- 基线有 `OUTPUT_PYTHON`、`OUTPUT_BINARY`、`OUTPUT_META(bitrate)`；当前没有真正实现
- 声明了 `bit` 注释类型，但实现里不会发 `annotationType 5`
- 地址最后一位 `Read/Write` 没有单独注释
- `warning` 注释声明了，但没有实际发出路径
- `STOP` 后没有 bitrate meta
- 10 位地址显示语义与基线不完全一致
- `decode()` 虽按名称查找 `SCL/SDA`，真正映射时仍硬编码 `0/1`

**测试可信度**

- `I2CDecoder.test.ts`、`DecoderParityCore.test.ts`、`DecoderSigrokGolden.test.ts` 已跑通
- 但大量断言只是 smoke test 或 `arrayContaining`
- 当前 golden 只覆盖：普通写、地址 NACK、重复起始读

**达到一致所需工作**

- `P0`
  - 在框架层补齐 Python/Binary/Meta 输出承载
  - 补齐 bit 注释与独立 `Read/Write` 位注释
  - 修正 `registerAllDecoders()` 与 `getDecoderRegistryInfo()` 的分裂
- `P1`
  - 对齐 10 位地址显示语义
  - 让实际使用的通道映射来自找到的 `sclChannel/sdaChannel`
  - 把测试从 smoke 改为精确顺序/范围断言
- `P2`
  - 补 10 位地址、warning、bitrate meta、通道顺序错位 golden
  - 清理死代码：`state`、未使用的 `hasRwBit`

### 5.2 Streaming I2C

**当前实现**

- 实现体：`src/decoders/protocols/StreamingI2CDecoder.ts`
- ID 是独立的 `streaming_i2c`，不是 `i2c` 的透明增强
- `DecoderManager` 会注册它；`DecoderRegistry` 也会再次注册

**已实现能力**

- 已实现双线输入、基础 I2C 状态机、7 位地址加 R/W、`shifted/unshifted`
- 已接入 `src/decoders/StreamingDecoder.ts` 的分块、进度、部分结果、停止机制

**主要差距**

- `getRecommendedExecutionMode('i2c', >1_000_000)` 会推荐 streaming，但并不会自动切到 `streaming_i2c`
- 当前更像仓库自定义分支，而不是基线 `i2c` 的流式执行形态
- 缺 `BIT/BITS`、binary 输出、bitrate metadata、annotation rows 对齐、10 位地址
- 声明了 `warning/error`，但代码里没有真正产出
- 输出内容包含仓库自定义扩展文本，不是基线 `pd.py` 输出形态
- 更严重的是 correctness 风险：
  - 基类支持并发分块
  - `StreamingI2CDecoder` 又依赖跨块 `globalState`
  - 对顺序敏感的 I2C 来说，这会让重叠区重复处理、边界处错位或重复解码

**测试可信度**

- 当前只有 `DecoderParityCore.test.ts` 间接验证：
  - 大样本 `i2c` 推荐 streaming
  - 注册信息里有 `streaming_i2c`
- 没有直接实例化 `StreamingI2CDecoder` 的协议行为测试

**达到一致所需工作**

- `P0`
  - 打通主流程，让 `i2c` 的流式执行真正能命中流式实现
  - 禁止并发分块或重做跨块状态传递
  - 补基线对齐测试，尤其是跨块边界
- `P1`
  - 补 `BIT/BITS`、warning、10 位地址、binary、bitrate metadata
  - 统一选项名与注释语义
- `P2`
  - 扩展 stop、progress、partial result 的控制面测试

### 5.3 SPI

**当前实现**

- 主实现：`src/decoders/protocols/SPIDecoder.ts`
- `DecoderManager` 构造时会自动注册 `spi`
- `DecoderRegistry` 的帮助层与真实注册逻辑不一致，但不影响通过 `DecoderManager` 使用

**已实现能力**

- 元数据、通道、选项定义基本对齐基线
- 支持 `cs_polarity`、`cpol`、`cpha`、`bitorder`、`wordsize`
- 支持 4 种 SPI mode
- 支持仅 `MISO`、仅 `MOSI`、双向同时解码
- 支持 bit 级注释、dataword 注释、transfer 注释
- 支持 mid-word CS 断开 warning

**主要差距**

- 基线的 `CS-CHANGE / BITS / DATA / TRANSFER / BitRate / Binary` 没有真正移植
- `putCSChange()` 为空实现
- 框架层 `DecoderBase.put()` 会把所有输出折叠成同一种 `DecoderResult`
- 存在实例复用下的选项污染风险：
  - `processOptions()` 只覆盖传入项
  - `DecoderManager` 又缓存并复用 decoder 实例
- `CLK` 缺失时，基线会报错；当前实现直接返回空数组

**测试可信度**

- `SPIDecoder.test.ts`、`DecoderParityCore.test.ts`、`DecoderSigrokGolden.test.ts` 已通过
- 覆盖面比其它协议好一些，但很多断言仍然偏弱
- 对非 annotation 输出缺口没有测试，因为框架本身也没承载这类输出

**达到一致所需工作**

- `P0`
  - 先在框架层补齐输出模型
  - 再补 `CS-CHANGE / BITS / DATA / TRANSFER / bitrate / binary`
  - 修复实例复用下的选项污染
- `P1`
  - 对齐 `CLK` 缺失时的错误语义
  - 增加 transfer、warning、样本边界的严格测试
- `P2`
  - 统一 `cpol/cpha` 选项元数据类型
  - 清理空实现入口

### 5.4 UART

**当前实现**

- 主实现：`src/decoders/protocols/UARTDecoder.ts`
- `initializeDecoders()` 会注册 `uart`
- `registerAllDecoders()` 不会注册 `uart`
- `getDecoderRegistryInfo()` 却仍然把它写进 `regularDecoders`

**已实现能力**

- 已实现基础元数据、可选 RX/TX 通道、18 个 annotation 类型
- 已支持 9 个核心选项：`baudrate`、`data_bits`、`parity`、`stop_bits`、`bit_order`、`format`、`invert_rx`、`invert_tx`、`sample_point`
- 可产出 RX/TX 的起始位、数据位、数据值、校验正确/错误、停止位、帧 warning
- 数据格式化覆盖 `ascii/dec/hex/oct/bin`

**主要差距**

- 基线有 13 个选项；当前缺 `rx_packet_delim`、`tx_packet_delim`、`rx_packet_len`、`tx_packet_len`
- 当前 packet 行为是硬编码“累计到 16 字节就输出”，与基线默认关闭、按 delimiter/length 触发不一致
- 主解码循环被简化成 `decodeChannelSimple()` 的逐通道扫描
- `getWaitCond()`、`inspectEdge()`、`inspectIdle()`、`handleIdle()`、`handleFrame()` 等关键逻辑没有真正参与主路径
- 结果是：
  - break/idle 实际未落地
  - frame/python/binary 输出缺失
  - RX/TX 双向事件顺序也与基线不同

**测试可信度**

- `UARTDecoder.test.ts`、`DecoderParityCore.test.ts`、`DecoderSigrokGolden.test.ts` 已跑通
- 但很多断言只是“不抛异常”或“结果存在”
- golden 只覆盖：普通 8N1、偶校验错误、仅 TX 通道

**达到一致所需工作**

- `P0`
  - 统一注册入口
  - 把主循环改回 `wait + edge + idle`
  - 补齐 4 个 packet 配置项
  - 在框架层补全 Python/Binary 输出承载
- `P1`
  - 补 `handleFrame()`、`handleIdle()` 的真实行为
  - 校准 RX/TX 并发顺序、采样点和停止位边界
- `P2`
  - 重写测试策略，增加完整结果序列与样本范围断言

### 5.5 CAN

**当前实现**

- 主实现：`src/decoders/protocols/CANDecoder.ts`
- `DecoderManager`、`initializeDecoders()`、`registerAllDecoders()` 都会注册 `can`
- 这部分的“可用性”比其它协议稳定一些

**已实现能力**

- 已实现经典 CAN 2.0A / 2.0B 的单帧解析骨架
- 可解析：SOF、11-bit 标准 ID、29-bit 扩展 ID、DLC、数据字节、CRC 区段、ACK、EOF
- 支持两个选项：`bitrate`、`sample_point`
- 可发出 CRC delimiter、ACK 缺失、ACK delimiter、EOF、截断帧 warning

**主要差距**

- 当前是“先找第一帧，再按固定 bitWidth 整帧采样一次”的简化方案
- 基线是持续状态机，支持 dominant edge 重同步
- 当前没有 bit stuffing 处理，因此不适合真实 CAN 波形
- 不支持 CAN-FD
- 注释粒度明显低于基线
- 没有基线的结构化 Python 输出
- 元数据层也未完全对齐：例如通道 ID、选项名

**测试可信度**

- 只有 `DecoderSigrokGolden.test.ts` 的 3 个 CAN 用例
- 这些用例都是理想位流，不含 stuff bit、多帧、时钟漂移或 FD 场景
- 断言仍是 `arrayContaining`

**达到一致所需工作**

- `P0`
  - 改成持续状态机
  - 加 dominant edge 重同步
  - 加 bit stuffing 去填充
  - 支持一段 capture 中连续多帧
- `P1`
  - 补 CAN-FD
  - 对齐注释粒度和 Python 输出
- `P2`
  - 扩展真实波形级 golden 与严格断言

### 5.6 LIN

**当前实现**

- 主实现：`src/decoders/protocols/LINDecoder.ts`
- 当前 TS 版声明 `inputs = ['logic']`
- 基线 `lin` 明确是叠在 UART 之上的 `inputs = ['uart']`

**已实现能力**

- 能从单通道逻辑波形中解出一帧的 `break -> sync -> pid -> data -> checksum`
- 已实现 PID parity 检查与 checksum 检查
- 选项有 `baudrate`、`data_length`、`checksum(classic/enhanced)`
- 能输出 `Break too short`、`Missing sync/PID/data/checksum`、`Sync error`、`PID parity error`、`Stop bit error`、`Checksum error`

**主要差距**

- 最大差距是输入模型完全不同：
  - 基线消费 UART 事件流里的 `BREAK / DATA / IDLE`
  - 当前实现直接扫描 raw logic
- 当前只解一个帧；基线可以持续处理多帧、break 重入、idle 结束与恢复
- 当前强依赖 `data_length` 预先指定字节数
- 不支持“只有主机头、无响应”分支
- checksum 语义与基线 `version 1/2` 不一致
- 注释契约与基线也不一致
- `findBreak()` 过于粗糙，容易把普通低电平段误判成 break

**测试可信度**

- 没有独立 LIN 单测
- 只有 `DecoderSigrokGolden.test.ts` 里的 3 个用例
- 这些用例是理想化 raw-logic 波形
- 能证明“这个自定义 LINDecoder 能跑通自定义样例”，不能证明与基线功能等价

**达到一致所需工作**

- `P0`
  - 改成 UART 级联输入模型
  - 用 FSM 重写帧生命周期
  - 去掉对固定 `data_length` 的强依赖
  - 把 checksum 选项改成基线 `version 1/2` 语义
- `P1`
  - 若仍保留 raw logic 入口，必须加强 break 判定
  - 用 `getInput()/addOutput()` 真正接入 UART -> LIN 级联
- `P2`
  - 增加更接近真实波形的 LIN fixture

### 5.7 I2S

**当前实现**

- 主实现：`src/decoders/protocols/I2SDecoder.ts`
- 对外声明 `inputs=['logic']`、`outputs=['i2s']`
- 需要 3 个必选通道：`SCK / WS / SD`
- `DecoderManager`、`initializeDecoders()`、`registerAllDecoders()` 都会把 `i2s` 注册进去
- 当前没有独立 `I2SDecoder.test.ts`，审计范围内只有 golden 汇总测试

**已实现能力**

- 支持 3 线 I2S 输入，缺采样率或缺任一通道会直接报错
- 采用“扫描 SCK 上升沿”的简化模型，每个上升沿读取 `WS` 与 `SD`
- 已实现左右声道区分：`WS=0` 左声道，`WS=1` 右声道
- 已提供两个选项：
  - `word_length`
  - `justification(i2s/left)`
- 能输出左右声道样本 annotation，`rawData` 为整数值
- 当累计 bit 数不足配置的 `word_length` 时，会输出 `Incomplete word` warning

**主要差距**

- 与基线的字边界模型不一致：
  - 基线按 `WS` 翻转动态确定一个字的长度，并在字长变化时告警
  - 当前实现按配置的固定 `word_length` 截取，多余 bit 静默丢弃
- 首字同步策略不一致：
  - 基线要等第一次 `WS` 翻转后才开始稳定输出
  - 当前实现从第一个 SCK 上升沿就开始建字
- 输出类型缺失：
  - 基线除 annotation 外，还有 Python 包 `['DATA', ['L'|'R', value]]`
  - 还有 binary/WAV 输出
  - 当前 TS 版只走 annotation
- 注释定义与文案不一致：
  - 基线只有 `left/right/warnings`
  - 当前实现多了一个未使用的 `bit` 注释类型
  - 左右声道文案和十六进制宽度也与基线不同
- 存在 32 位样本数值语义风险：
  - 当前使用 JS 位运算累积值
  - `0x80000000` 这类样本可能变成负数
- 存在实例复用下的配置泄漏风险：
  - `DecoderManager` 会缓存 decoder 实例
  - `wordLength/justification` 是实例字段，只按传入项覆盖
- annotation 的 `startSample/endSample` 语义与基线也不完全一致

**测试可信度**

- 当前审计范围内唯一直接覆盖 I2S 的测试是 `DecoderSigrokGolden.test.ts`
- 断言仍是 `arrayContaining + objectContaining`
- 不会检查多余输出、错误顺序和错误区间
- 测试也没有经过 `DecoderManager`，因此发现不了实例缓存导致的状态泄漏
- 现有用例更接近理想化输入模板，对首字不同步、变字长、32 位高位为 1 等边界覆盖有限

**达到一致所需工作**

- `P0`
  - 把 I2S 从“固定 `word_length` 截断”改成“按 `WS` 翻转界定字边界”
  - 修正首字同步行为
  - 修正 32 位值拼装，避免 JS 有符号位运算带来的负数语义
  - 对齐 `left/right/warnings` 的注释类型编号和外部文案
- `P1`
  - 增加 Python 输出等价物
  - 增加 binary/WAV 输出能力
  - 校正 annotation 的样本区间语义
- `P2`
  - 整理三套注册入口，明确权威来源
  - 清理无效 `bit` 注释定义和元数据差异
  - 增加精确结果集、样本范围、32 位高位为 1、首字不同步、变字长告警、实例复用场景测试

## 6. 共同问题清单

不看单个协议，当前整套协议分析器还有 6 个共同问题：

### 6.1 注册层分裂

- `DecoderManager` 真正决定“能不能跑”
- `initializeDecoders()` 和 `registerAllDecoders()` 只是额外入口
- `getDecoderRegistryInfo()` 又是硬编码

这会导致“文档/测试说支持”和“运行时真的注册了”不是同一回事。

### 6.2 输出模型不完整

基线大量使用：

- annotation
- python packet
- binary dump
- meta（如 bitrate）

当前框架几乎只保留了 annotation 结果。只要这一层不补，I2C / SPI / UART 的 parity 都不可能真正完成。

### 6.3 新前端只接了 I2C

当前用户在新前端里能直接操作的协议解码只有 I2C。其它协议没有进入现行 UI 主路径，也没有浏览器 host 兼容实现。

### 6.4 golden 策略偏宽松

- 大量断言使用 `arrayContaining`
- 多数只校验“包含某几个结果”
- 很少校验顺序、样本范围、总数、额外输出

这会掩盖很多“看起来能跑、实际上不等价”的问题。

### 6.5 测试更像理想波形验证

多数 fixture 都是人工拼出来的理想波形，不包含：

- 真实采样倍率
- 边沿抖动
- 连续多帧
- stuffing / idle / break / 分块边界
- 输出面 parity

### 6.6 当前路线更像“本地 TS 重写”，不是“完整桥接基线”

这一点在 CAN、LIN、Streaming I2C 上尤其明显：仓库并不是把基线 decoder 原样桥过来，而是在做新的 TypeScript 状态机。这个方向并非错误，但它意味着“功能一致”必须靠更严格的协议对齐与 golden 体系来证明。

## 7. 建议的修复顺序

### 第一阶段：先修公共底座

1. 统一注册来源  
   目标：让“声明支持哪些协议”和“运行时真正注册哪些协议”只有一个真值来源。

2. 补齐输出模型  
   目标：在 `DecoderBase.ts` / `types.ts` 中支持 annotation、python、binary、meta 多种输出。

3. 补强测试断言  
   目标：从 `arrayContaining` 升级为顺序、范围、总数、无多余输出的严格断言。

### 第二阶段：补齐核心三协议 parity

1. I2C  
   优先补 `BITS / binary / bitrate / R/W 位 / warning`

2. SPI  
   优先补 `CS-CHANGE / DATA / TRANSFER / BitRate / Binary`

3. UART  
   优先把主循环切回 `wait + edge + idle` 并补 packet / break / idle / frame

### 第三阶段：修正“第一版 TS 状态机协议”

1. CAN  
   先做 classic CAN 的真实位流语义，再谈 CAN-FD

2. LIN  
   先改成 UART 级联输入，再做 parity

3. Streaming I2C  
   先解决主流程接入和跨块正确性

4. I2S  
   先把字边界状态机、32 位数值语义和 Python/Binary 输出补齐，再谈 UI 接入

## 8. 当前判断

如果目标是“做到和 logicanalyzer 功能一致”，当前项目在协议分析器层面还不能宣称达到一致。

更准确的表述应该是：

- **已建立 TypeScript 协议解码框架**
- **I2C / SPI / UART 具备基础注释解码能力**
- **CAN / LIN / I2S 已有第一版实现**
- **Streaming I2C 已做实验性扩展**
- **但与 logicanalyzer 的完整协议解码能力仍有明显差距，尤其体现在输出模型、真实波形语义、前端接入和测试严格性上**

当前文档已经包含本仓库现有 7 个协议分析器的审计结果，可作为后续做 parity 修复和排期的直接输入。
