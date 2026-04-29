# Worktree 01 Pico 驱动与原版协议对齐执行记录

日期：2026-04-28

## 当前基线

- 分支：`parallel/01-pico-driver-parity`
- 启动状态：`git status --short --branch` 显示 `## parallel/01-pico-driver-parity`
- 对齐目标：Pico 串口/TCP 初始化、采集启动确认、停止、二进制流读取、blast、blink、limit、网络配置和错误恢复。

## 范围内

- `src/drivers/LogicAnalyzerDriver.ts`
- `src/drivers/AnalyzerDriverBase.ts`
- `tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts`
- `tests/unit/drivers/AnalyzerDriverBase.comprehensive.test.ts`
- `tests/fixtures/drivers/`
- Pico 相关状态矩阵和本执行记录

## 范围外

- 不修改前端设备连接和采集 UI，该链路归 worktree 04。
- 不修改 `HardwareDriverManager.ts` 的设备发现、Saleae/sigrok/SCPI 匹配和硬件认证矩阵，该链路归 worktree 07。
- 不修复全量驱动测试中既有的 `HardwareDriverManager.comprehensive.test.ts` mock/超时问题。

## 接口契约

- 采集请求包仍使用原版 `0x55 0xAA ... 0xAA 0x55` 包头包尾和 `0xAA/0x55/0xF0` 转义规则。
- `CaptureRequest.channels` 写入捕获通道号列表，不是 bit mask。
- 串口二进制采集帧布局为 `UInt32LE sampleCount + samples + UInt8 timestampLength + optional timestamps`。
- 样本提取与当前代码和 fixture 一致：Pico 帧样本 word 按真实物理通道号编码，驱动使用 `channel.channelNumber` 生成 bit mask；非连续捕获列表 `[0, 3, 8]` 分别读取 bit0、bit3、bit8。
- `NetConfig` 固定字段按 C# `Encoding.ASCII` 语义写入；非 ASCII 字符写为 `?`，端口为 little-endian `UInt16`。

## 执行日志

- 阶段 1：对照原版 `SharedDriver/AnalyzerDriverBase.cs` 和 `SharedDriver/LogicAnalyzerDriver.cs`，确认命令码、`CaptureRequest` 布局、`ReadCapture` 串口帧布局、`StopCapture`、`Blink`、`GetVoltageStatus` 和 `ValidateSettings` 语义。
- 阶段 2：补充 `pico-serial-8ch-single-frame.json`，先写失败测试复现“串口头部和负载在同一个 data chunk 到达时采集不完成”的风险。
- 阶段 3：修正 `readSerialCaptureData`，在读满 4 字节头部后立即处理同一 chunk 剩余 payload，并在同一轮事件中完成采集。
- 阶段 4：同步 `AnalyzerDriverBase` 的通道数组断言和 `NetConfig` ASCII 序列化，避免协议契约被旧 bit mask 测试和运行时 `TextEncoder` 依赖拉回。

## 验收结论

已通过：

```bash
rtk npm run typecheck
rtk proxy npx jest --config jest.webview.config.js tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts --runInBand --testMatch '**/*.test.ts'
rtk proxy npx jest --config jest.webview.config.js tests/unit/drivers/AnalyzerDriverBase.comprehensive.test.ts --runInBand --testMatch '**/*.test.ts'
```

受限：

- `rtk npm run test:drivers -- --runInBand` 在 90 秒超时内仍失败；失败集中在范围外的 `HardwareDriverManager.comprehensive.test.ts` 旧 mock 期望、done 回调超时和设备匹配断言。
- `rtk npm run test:unit -- tests/unit/drivers/LogicAnalyzerDriver.pico-parity.test.ts --runInBand` 因 `package.json` 的 `test:unit` 固定带 `--maxWorkers=2`，与追加的 `--runInBand` 冲突，Jest 直接拒绝执行。已使用上方等价的直接 Jest 命令完成 focused 验证。
- 本环境没有真实 Pico / Pico W / Pico 2 硬件，真实硬件验收仍需按下表补录。

## 真实硬件手动验收模板

| 设备 | 连接 | 固件版本 | 验证项 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| Pico | 串口 | 待填 | 设备信息、8/16/24 通道采集、stop、blink/stopBlink | 待验证 | 记录端口、操作系统、样本文件路径 |
| Pico W | TCP | 待填 | 设备信息、网络采集、stop、voltage、断线恢复 | 待验证 | 记录 IP、端口、网络环境 |
| Pico 2 | 串口 | 待填 | 设备信息、采集、blast 参数校验 | 待验证 | 记录固件兼容性 |
