# 05 设备发现、网络握手与硬件认证路径执行记录

来源：`docs/code-review-and-next-tasks-2026-04-28.md` 中任务 05。

## 范围

- 只处理 `.worktree/05` 的设备发现、网络 profile 握手和硬件认证记录路径。
- 不修改 Pico 采集通道正确性、导出语义、Webview 导出或其它 worktree 的实现边界。

## 本轮实现

- `NetworkDetector` 将端口开放降级为候选设备，只有 profile 握手通过才标记为 `confirmed`。
- Pico W TCP 使用 Pico 版本握手确认；SCPI profile 使用 `*IDN?` 确认 Rigol/Siglent。
- `WiFiDeviceDiscovery` 为 UDP 广播、端口扫描和 Pico 版本响应补充 `candidate/confirmed` 状态和证据摘要。
- `NetworkStabilityService` 诊断输出设备握手口径，避免把端口开放误写成设备认证通过。

## 证据等级

| 等级 | 说明 |
| --- | --- |
| candidate | 端口开放、UDP 广播或外部工具入口存在，但未完成设备协议握手。 |
| confirmed | profile 握手返回可验证的设备协议响应。 |
| fixture | 由单元测试或 mock 网络响应覆盖的自动化证据。 |
| hardware-certified | 需要真实设备、固件版本、系统、采样配置和结果文件 hash。 |

## 本轮验证

- `npm run typecheck`
- `npx jest tests/unit/drivers/HardwareDriverManager.business.test.ts --runInBand`
- `npx jest tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts --runInBand`
- `npx jest tests/unit/services/NetworkStabilityService.accurate.test.ts --runInBand`

真实 Pico W、Saleae、Rigol/Siglent 和 sigrok 设备未接入，本轮不提升真实硬件认证等级。
