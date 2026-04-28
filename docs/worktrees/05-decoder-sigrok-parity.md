# 05 解码器与 sigrok golden 对齐执行记录

## 当前基线

- 分支：`parallel/05-decoder-sigrok-parity`
- 启动状态：`git status --short --branch` 输出为 `## parallel/05-decoder-sigrok-parity`
- 计划目标：I2C/SPI/UART 与 sigrok 风格 golden 对齐，并补 CAN、LIN、I2S、USB、JTAG/SWD 的优先级与外部 sigrok 策略。

## 范围内

- `src/decoders` 的 wait 边沿语义、sigrok parity 类型和后续协议路线图。
- `tests/unit/decoders` 的 golden 驱动测试。
- `tests/fixtures/decoders` 的统一 fixture 格式和 I2C/SPI/UART golden 样本。
- 解码器状态文档和功能矩阵同步。

## 范围外

- 不实现 CAN/LIN/I2S/USB/JTAG/SWD 的完整解码器。
- 不改波形 UI、解码面板或 `.lac` 文件格式。
- 不改硬件发现、sigrok 设备驱动或外部 `sigrok-cli` 采集链路。

## 接口契约

- `src/decoders/DecoderSigrokParity.ts` 导出后续协议扩展计划：
  - `getDecoderExtensionRoadmap()`
  - `getDecoderExtensionPlan(id)`
  - `getExternalSigrokProtocolIds()`
- `tests/fixtures/decoders/sigrok-golden.json` 作为统一 golden 格式：
  - 每个用例含 `id`、`protocol`、`category`、`sampleRate`、`input`、`options`、`expected`。
  - `category` 必须覆盖 `normal`、`error`、`boundary`。
  - `expected` 只断言稳定语义字段：`annotationType`、`values`、`rawData`。
- 后续协议策略：
  - TypeScript 本地优先：CAN、LIN、I2S。
  - 外部 sigrok 过渡优先：USB、JTAG/SWD。

## 执行日志

- 阶段 1：新增 `DecoderSigrokGolden.test.ts` 和 `sigrok-golden.json`，先验证缺少路线图模块导致测试失败。
- 阶段 2：新增 `DecoderSigrokParity.ts` 并从 `src/decoders/index.ts` 导出路线图类型与查询函数。
- 阶段 3：修正 `DecoderBase.wait()` 搜索过程中的上一状态推进，避免 repeated start 前的 SDA 释放被误判为 STOP。
- 阶段 4：补充 fixture README 和功能矩阵说明。

## 验收结论

- `npm exec -- jest tests/unit/decoders/DecoderSigrokGolden.test.ts --runInBand`：通过，13 个测试。
- `npm run test:decoders -- --runInBand`：通过，5 个测试套件、130 个测试。
- `npm run typecheck`：通过。

## 合并协调

- 05 只稳定解码器输出语义和 fixture 格式，不修改 02/03 的 `.lac` 样本契约。
- USB、JTAG/SWD 标记为外部 sigrok 过渡策略，后续若要接入实际子进程桥接，应由专门任务补进程隔离、错误码和依赖检测。
