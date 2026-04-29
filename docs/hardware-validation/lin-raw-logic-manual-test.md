# LIN raw logic 手工测试记录

状态：模板，未填写真实硬件结果前不能作为通过证据。

## 适用范围

- 协议：LIN
- 当前主路径：单线 raw logic 输入，`LINDecoder.inputs = ['logic']`
- UI 入口：右侧“协议解码”面板可切换到 LIN，选择 RX、baud、data length 和 checksum/version
- 不在本模板声明的能力：UART 级联输入、真实硬件认证通过
- 自动化前置：LIN 专项单测、LIN golden 回归、Webview LIN UI 单测、`npm run typecheck`

## 测试环境

| 项目 | 记录 |
| --- | --- |
| 测试日期 |  |
| 测试人 |  |
| 插件分支/提交 |  |
| worktree | `.worktree/06` |
| 采样设备 |  |
| LIN 目标设备 |  |
| 波特率 |  |
| `.lac` 文件 |  |
| `.lac` SHA256 |  |
| 日志路径 |  |
| 截图路径 |  |

## 场景 1：正常主机头和从机响应

| 步骤 | 记录 |
| --- | --- |
| 输入 | 包含 break、sync `0x55`、PID、至少 1 个 data byte、checksum 的 LIN raw logic 波形 |
| 操作 | 在右侧协议解码面板切换到 LIN，选择 RX 通道、实际波特率、data length 和 checksum/version 后执行 |
| 预期 | 输出 Break、Sync、PID、ID、Data、Checksum 注释；没有 warning |
| 实际 |  |
| 结论 |  |

## 场景 2：主机头后无响应

| 步骤 | 记录 |
| --- | --- |
| 输入 | 只有 break、sync、PID，之后保持 recessive high 或进入下一帧 break |
| 操作 | 在右侧协议解码面板切换到 LIN 后执行，data length 保持期望响应长度 |
| 预期 | 输出主机头注释，并产生 `No response` warning；不得误报缺少 checksum |
| 实际 |  |
| 结论 |  |

## 场景 3：PID parity 错误

| 步骤 | 记录 |
| --- | --- |
| 输入 | PID parity 位故意错误的 LIN raw logic 波形 |
| 操作 | 在右侧协议解码面板切换到 LIN 后执行 |
| 预期 | 输出 `PID parity error` warning，其他可解析字段仍保留 |
| 实际 |  |
| 结论 |  |

## 场景 4：checksum 错误

| 步骤 | 记录 |
| --- | --- |
| 输入 | data byte 正常但 checksum 故意错误的 LIN raw logic 波形 |
| 操作 | 分别用 classic、enhanced 或 LIN version 选项执行 |
| 预期 | 输出 `Checksum error` warning，并显示期望 checksum |
| 实际 |  |
| 结论 |  |

## 附件

| 类型 | 路径或 hash |
| --- | --- |
| `.lac` |  |
| 日志 |  |
| 截图 |  |
| 失败记录 |  |

## 结论

本记录只覆盖 LIN raw logic 解码路径。若后续实现 UART 级联，必须新增对应手工测试记录，不能复用本模板直接声明通过。
