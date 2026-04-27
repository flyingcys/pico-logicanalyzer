# 解码器 golden 样本

本目录保存协议解码器的最小 golden 输入与期望输出，用于验证 TypeScript 解码器与 sigrok 风格输出语义保持一致。

- `golden-core.json`：覆盖 I2C、SPI、UART 三个基础协议的最小事务。
- 新协议应新增独立 fixture，至少包含采样率、通道样本、关键选项和期望注释序列。
- 期望输出只断言协议语义稳定字段：`annotationType`、`values`、`rawData`。样本区间可在专门时序测试中单独断言。

## 新协议最小模板

fixture 建议结构：

```json
{
  "protocolName": {
    "sampleRate": 1000000,
    "channels": [
      { "channelNumber": 0, "channelName": "CLK", "samples": [0, 1, 0, 1] }
    ],
    "options": [
      { "optionIndex": 0, "value": "default" }
    ],
    "expected": [
      { "annotationType": 0, "values": ["Decoded"], "rawData": 0 }
    ]
  }
}
```

最小测试建议：

```ts
const results = new ExampleDecoder().decode(
  fixture.sampleRate,
  toChannels(fixture.channels),
  fixture.options
);

expect(results).toEqual(
  expect.arrayContaining([
    expect.objectContaining(fixture.expected[0])
  ])
);
```
