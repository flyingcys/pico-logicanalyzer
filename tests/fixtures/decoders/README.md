# 解码器 golden 样本

本目录保存协议解码器的最小 golden 输入与期望输出，用于验证 TypeScript 解码器与 sigrok 风格输出语义保持一致。

- `golden-core.json`：覆盖 I2C、SPI、UART 三个基础协议的最小事务。
- `sigrok-golden.json`：统一 fixture 格式，覆盖 I2C、SPI、UART 的正常、错误、边界三类样本。
- 新协议应新增独立 fixture，至少包含采样率、通道样本、关键选项和期望注释序列。
- 期望输出只断言协议语义稳定字段：`annotationType`、`values`、`rawData`。样本区间可在专门时序测试中单独断言。

## 统一 golden 格式

`sigrok-golden.json` 的顶层结构为：

- `version`：fixture 格式版本。
- `cases`：golden 用例数组。

每个用例字段：

- `id`：稳定用例 ID，格式建议为 `协议.场景.分类`。
- `protocol`：当前支持 `i2c`、`spi`、`uart`。
- `category`：必须归入 `normal`、`error`、`boundary` 之一。
- `sampleRate`：解码采样率。
- `input.kind`：输入构造类型。当前支持 `logic-channels`、`i2c-operations`、`spi-transfer`。
- `options`：传入解码器的 `DecoderOptionValue[]`。
- `expected`：按 sigrok 注释语义断言的稳定输出片段。

## 新协议最小模板

fixture 建议结构：

```json
{
  "version": 1,
  "cases": [
    {
      "id": "can.standard-frame.normal",
      "protocol": "can",
      "category": "normal",
      "sampleRate": 1000000,
      "input": {
        "kind": "logic-channels",
        "channels": [
          { "channelNumber": 0, "channelName": "CAN_RX", "samples": [1, 0, 1, 0] }
        ]
      },
      "options": [
        { "optionIndex": 0, "value": "default" }
      ],
      "expected": [
        { "annotationType": 0, "values": ["Decoded"], "rawData": 0 }
      ]
    }
  ]
}
```

最小测试建议：

```ts
const results = new ExampleDecoder().decode(
  fixture.sampleRate,
  toChannels(fixture.input.channels),
  fixture.options
);

expect(results).toEqual(
  expect.arrayContaining([
    expect.objectContaining(fixture.expected[0])
  ])
);
```

## 当前覆盖

| 协议 | normal | error | boundary |
| --- | --- | --- | --- |
| I2C | 写地址和数据字节 | 地址 NACK | repeated start 后读数据 |
| SPI | Mode 0 双向 8-bit 传输 | CS 中断丢弃半字 | LSB-first 位序 |
| UART | RX 8N1 | even parity 错误 | TX 通道解码 |

新增协议必须至少补齐这三类样本后再标记为已对齐。
