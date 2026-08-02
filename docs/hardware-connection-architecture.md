# 逻辑分析仪硬件接入架构

## 结论

当前真实串口和 TCP 设备接入都由 Node.js 环境中的 TypeScript 驱动完成，Web/Vue 层主要负责用户交互、发送命令、接收状态和显示波形。

VS Code 插件中的 Webview 不直接访问串口，也不直接创建 TCP Socket。真实硬件通信发生在 VS Code 扩展宿主进程中。

浏览器 Web App 当前是离线或模拟模式，不具备直接访问真实串口和 TCP 设备的能力。

## 总体调用链

```text
Vue UI
  -> deviceCaptureCommands
  -> HostAdapter.sendCommand()
  -> VS Code Webview postMessage
  -> LACEditorProvider.executeHostCommand()
  -> HardwareDriverManager
  -> 具体 TypeScript 驱动
  -> serialport / net.Socket
  -> CaptureSession / LAC 文件
  -> 返回 Webview 显示
```

共享的前端业务代码位于 `src/frontend`，VS Code 和浏览器分别通过不同入口注入 Host 适配器。

## VS Code 插件边界

VS Code 前端入口是：

`src/frontend/app/main-vscode.ts`

该入口创建 `createVsCodeHost()`，前端调用 `sendCommand()` 时通过 VS Code Webview 的 `postMessage` 发送消息：

`src/frontend/platform/host/vscodeHost.ts`

扩展宿主端由 `LACEditorProvider` 接收消息，并在 `executeHostCommand()` 中分发命令：

`src/providers/LACEditorProvider.ts`

主要命令包括：

- `detectDevices`
- `connectDevice`
- `disconnectDevice`
- `startCapture`
- `stopCapture`
- `getStatus`

设备检测、驱动匹配、驱动创建和当前连接管理统一由以下模块负责：

`src/drivers/HardwareDriverManager.ts`

因此，VS Code Webview 是 UI 和宿主命令客户端，硬件通信属于扩展宿主侧的 TypeScript/Node.js 代码。

## 串口接入

### 检测

`SerialDetector` 使用 `serialport` 库调用 `SerialPort.list()` 扫描串口，并根据以下信息识别设备：

- USB VID/PID
- 厂商信息
- 串口路径
- 设备序列号

Pico Logic Analyzer 的当前匹配信息是 VID/PID `1209:3020`。

相关实现：

`src/drivers/HardwareDriverManager.ts` 中的 `SerialDetector`

### 连接

串口设备由 `LogicAnalyzerDriver` 实现：

`src/drivers/LogicAnalyzerDriver.ts`

连接过程如下：

1. 使用 `serialport.SerialPort` 打开串口。
2. 默认波特率为 `115200`。
3. 创建 `ReadlineParser` 解析设备文本响应。
4. 发送设备信息查询命令。
5. 解析设备版本、采样频率、缓存大小和通道数量。

### 采集

开始采集时，`LogicAnalyzerDriver` 会：

1. 根据 `CaptureSession` 组装 Pico 固件要求的二进制请求。
2. 通过串口发送采集命令。
3. 等待 `CAPTURE_STARTED` 响应。
4. 暂停文本解析器，切换到原始二进制流读取。
5. 读取采集长度和样本数据。
6. 根据采集模式解析 8、16 或 24 通道数据。
7. 将数据写入 `CaptureSession`。
8. 恢复文本解析器，并通知宿主端采集完成。

串口底层使用的是 Node.js 的 `serialport`，不是浏览器 Web Serial API。

## TCP 接入

当前代码存在两套 TCP 路径。

### Pico 专用 TCP 路径

`LogicAnalyzerDriver` 同时包含串口和 Pico 专用 TCP 支持。

当传入的连接字符串包含 `host:port` 时，驱动会将连接识别为网络连接，并使用 Node.js 的 `net.Socket`：

`src/drivers/LogicAnalyzerDriver.ts` 中的 `initNetwork()`

这条路径会复用 Pico 的设备初始化、采集请求、二进制数据读取和样本解析逻辑，协议模型与 Pico 串口协议一致。

### 通用网络驱动路径

通用 TCP/UDP 网络驱动是：

`src/drivers/NetworkLogicAnalyzerDriver.ts`

该驱动支持：

- TCP
- UDP
- WebSocket 协议占位
- JSON、二进制、CSV 和原始数据格式

TCP 连接建立后会执行：

1. 建立 `net.Socket`。
2. 发送 `HANDSHAKE`。
3. 查询设备信息。
4. 发送 `START_CAPTURE`。
5. 轮询或获取采集进度。
6. 发送 `GET_CAPTURE_DATA`。
7. 根据配置的数据格式解析采集结果。

### 网络设备检测和匹配

`NetworkDetector` 会扫描本地常见私有网段和配置的端口，并根据设备 profile 执行握手确认。

Pico 网络设备检测成功后会生成类似以下设备 ID：

```text
network-pico-<host>-<port>
```

设备管理器随后根据设备类型、设备 ID、设备名称和驱动支持列表匹配驱动：

`src/drivers/HardwareDriverManager.ts` 中的 `matchDriver()`

当前需要注意：网络自动检测路径通常会将网络设备匹配到 `NetworkLogicAnalyzerDriver`；虽然 `LogicAnalyzerDriver` 内部也实现了 Pico 专用 TCP 协议，但不一定会被网络自动检测流程选中。因此，真实 Pico TCP 设备接入时，需要确认设备使用的是通用网络协议还是 Pico 原始协议。

## 浏览器 Web 接入

浏览器入口使用浏览器 Host，而不是 Node.js 硬件驱动：

`src/frontend/app/main-html.ts`

其 Host 实现位于：

`src/frontend/platform/host/browserHost.ts`

浏览器 Host 当前的行为是：

- 模拟设备连接
- 返回模拟设备列表
- 生成模拟采集数据
- 在浏览器端维护文档和状态

独立 Web App 还存在一个 `WebHost`：

`src/web-app/src/webHost.ts`

该实现主要支持：

- 打开和保存 `.lac` 文件
- 文件导出
- 离线文档加载

其设备能力明确关闭：

- `canStartCapture: false`
- `canConnectDevice: false`

因此，当前浏览器版不会直接调用 `serialport`、`net.Socket`，也不会连接真实逻辑分析仪。

## 当前职责划分

| 层级 | 主要职责 | 是否访问真实硬件 |
| --- | --- | --- |
| Vue/Web 前端 | 配置采集参数、触发连接和采集、显示状态和波形 | 否 |
| VS Code Webview Host | 将前端命令转发给扩展宿主 | 否 |
| `LACEditorProvider` | 接收 Webview 命令，调用硬件管理器，返回结果 | 间接 |
| `HardwareDriverManager` | 设备检测、驱动匹配、连接生命周期管理 | 间接 |
| `LogicAnalyzerDriver` | Pico 串口和专用 TCP 协议、样本解析 | 是 |
| `NetworkLogicAnalyzerDriver` | 通用 TCP/UDP 网络协议和数据格式解析 | 是 |
| 浏览器 `BrowserHost` / `WebHost` | 模拟设备、离线文件和浏览器交互 | 否 |

## 最终判断

当前架构是“共享前端 + 宿主适配器 + Node.js TypeScript 硬件驱动”：

- VS Code 插件：Web 负责 UI，TypeScript 扩展宿主负责真实串口和 TCP。
- 浏览器 Web App：Web 负责 UI 和离线/模拟数据，不接入真实硬件。
- 串口真实采集已经走通。
- TCP 代码已经具备两类实现，但 Pico TCP 自动匹配到哪一个驱动需要根据实际设备协议进一步确认。

如果后续要求浏览器 Web App 也连接真实设备，需要增加 Web Serial、WebSocket 网关，或者本地 Node.js 代理服务，不能仅依靠现有浏览器 UI 代码完成。
