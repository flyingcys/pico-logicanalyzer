# 04 设备连接和采集 UI 执行记录

## 当前基线

- Worktree：`.worktree/04`
- 分支：`parallel/04-device-capture-ui`
- 计划目标：把新前端的设备面板、采集配置和状态栏从摘要/提示接到真实 VSCode host 命令。
- 启动时状态：`git status --short --branch` 仅显示 `## parallel/04-device-capture-ui`，无本分支改动。

## 范围内

- `src/frontend/app/components/AppHeader.vue`
- `src/frontend/app/components/AppSidebarLeft.vue`
- `src/frontend/app/composables/deviceCaptureCommands.ts`
- `src/frontend/platform/host/*`
- `src/providers/LACEditorProvider.ts`
- `tests/unit/webview/main.test.ts`
- `docs/功能状态矩阵.md`

## 范围外

- 不修 Pico 串口/TCP 协议细节，Pico driver parity 归 01。
- 不修改 `.lac` 解析、导出 golden fixture 和底层格式契约，归 02。
- 不扩展基础波形渲染、缩放和平移能力，归 03。
- 不做硬件发现认证矩阵和真实设备认证结论，归 07。

## 接口契约

Webview 统一通过 `HostAdapter.sendCommand(command, payload)` 发起请求，VSCode host 返回：

```ts
interface HostCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

本分支稳定的设备/采集命令：

| 命令 | Payload | 成功 data |
| --- | --- | --- |
| `getStatus` | 无 | `FrontendDeviceStatus` |
| `detectDevices` | 可选扫描参数 | 驱动管理器检测结果 |
| `scanNetworkDevices` | `{ timeoutMs?: number }` | 网络设备数组 |
| `connectDevice` | `{ type?: 'serial' \| 'network', address?: string, deviceId?: string }` | `FrontendDeviceStatus` |
| `disconnectDevice` | 无 | `FrontendDeviceStatus` |
| `startCapture` | `{ config: FrontendCaptureConfig }` | `FrontendDeviceStatus & { capturedDocument?: FrontendDocumentData }` |
| `repeatCapture` | 无 | 同 `startCapture` |
| `stopCapture` | 无 | `FrontendDeviceStatus` |

采集完成时，host 可以在 `data.capturedDocument` 返回当前 `.lac` 文档快照。前端收到后必须调用 `sessionStore.applyDocument()`，让波形 store 重新装载新采集数据。VSCode host 仍会通过文档变更事件发送 `documentUpdate`，该字段用于消除 save/applyEdit 的异步刷新间隙。

## 执行日志

- 阶段 1：补充 `scanNetworkDevices`、HTML host 设备/采集命令、采集成功重装载文档、失败反馈的红灯测试。
- 阶段 2：新增 `deviceCaptureCommands`，集中处理连接、扫描、开始、停止、重复采集、状态刷新和错误反馈。
- 阶段 3：改造 `AppHeader.vue` 和 `AppSidebarLeft.vue`，移除串口/网络连接的 `window.prompt`，改为可见输入框和真实 host 命令。
- 阶段 4：扩展 browser host 的 HTML 模拟链路，支持连接、扫描、开始采集、重复采集、停止采集和文档更新消息。
- 阶段 5：扩展 `LACEditorProvider` host command：`scanNetworkDevices` 别名、采集参数校验、采集完成文档快照、停止采集状态返回。

## 验证记录

- `npm run test:webview:unit -- tests/unit/webview/main.test.ts --runInBand`：通过，39 项测试。
- `npm run typecheck`：通过。
- `npm run test:webview:unit -- --runInBand`：通过，2 个测试套件、43 项测试。
- `npm run test:extensions -- --runInBand`：通过，2 个测试套件、17 项测试。

## 验收结论

- 前端连接、网络扫描、开始采集、重复采集、停止采集均通过统一 host command request/response 链路。
- 采集配置非法、未连接设备、重复采集无历史配置和 host 命令失败会返回稳定错误并显示到 UI/store。
- HTML host 不再只发提示消息，具备可复现的模拟设备采集闭环，便于脱离 VSCode 调试前端。
- VSCode host 仍依赖真实 `hardwareDriverManager` 和各驱动的协议实现，Pico 协议可靠性和硬件认证结论不在本分支声明。
