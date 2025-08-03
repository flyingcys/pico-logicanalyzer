# 网络连接功能使用指南

## 概述

VSCode Logic Analyzer扩展支持通过WiFi/网络连接到Pico Logic Analyzer设备，提供了灵活的远程调试能力。

## 主要功能

### 1. 自动设备发现

扩展可以自动扫描本地网络，发现可用的Logic Analyzer设备。

#### 使用方法：

1. 打开命令面板 (`Ctrl+Shift+P`)
2. 搜索并执行 "Logic Analyzer: Scan Network Devices"
3. 等待扫描完成
4. 从发现的设备列表中选择要连接的设备

#### 特性：

- **UDP广播发现**：自动检测支持广播响应的设备
- **端口扫描**：扫描常见端口(4045, 80, 8080等)寻找设备
- **设备验证**：验证发现的设备确实是Logic Analyzer
- **响应时间测量**：显示每个设备的网络延迟

### 2. 手动网络连接

如果自动发现无法工作，可以手动指定设备地址。

#### 使用方法：

1. 打开命令面板 (`Ctrl+Shift+P`)
2. 搜索并执行 "Logic Analyzer: Connect Device"
3. 选择 "网络连接"
4. 输入设备IP地址和端口 (例如: `192.168.1.100:4045`)

### 3. WiFi配置

为串口连接的设备配置WiFi网络设置。

#### 使用方法：

1. 首先通过串口连接到设备
2. 打开命令面板 (`Ctrl+Shift+P`)
3. 搜索并执行 "Logic Analyzer: Configure WiFi"
4. 依次输入：
   - WiFi网络名称 (SSID)
   - WiFi密码
   - 静态IP地址 (可选，留空使用DHCP)
   - TCP端口号 (默认4045)

#### 注意事项：

- 配置发送后，设备将重启并尝试连接WiFi
- 确保WiFi网络在设备范围内且可访问
- 静态IP地址必须在网络范围内且未被占用

### 4. 网络诊断工具

诊断网络连接问题和性能。

#### 使用方法：

1. 打开命令面板 (`Ctrl+Shift+P`)
2. 搜索并执行 "Logic Analyzer: Network Diagnostics"
3. 输入要诊断的网络地址
4. 查看生成的诊断报告

#### 诊断内容：

- **连接测试**：验证能否连接到指定地址
- **延迟测试**：测量网络延迟和稳定性
- **吞吐量测试**：测试数据传输速度
- **稳定性测试**：长时间连接稳定性评估
- **数据完整性测试**：验证数据传输完整性
- **配置检查**：验证IP地址和端口配置

## 网络协议支持

### 支持的协议

- **TCP**：主要的数据传输协议
- **UDP**：用于设备发现和广播
- **HTTP/WebSocket**：未来扩展支持

### 数据格式

- **JSON**：结构化数据交换 (推荐)
- **Binary**：原始二进制数据传输
- **CSV**：文本格式，便于调试
- **Raw**：直接数组数据

## 配置选项

可以在VSCode设置中调整网络相关参数：

```json
{
  "logicAnalyzer.network.enableAutoDiscovery": true,
  "logicAnalyzer.network.scanTimeoutMs": 5000,
  "logicAnalyzer.network.maxConcurrentConnections": 50,
  "logicAnalyzer.network.defaultPorts": [4045, 80, 8080, 8000, 3000],
  "logicAnalyzer.network.enableBroadcastDiscovery": true,
  "logicAnalyzer.network.heartbeatIntervalMs": 5000,
  "logicAnalyzer.network.connectionTimeoutMs": 10000,
  "logicAnalyzer.network.enableAutoReconnect": true,
  "logicAnalyzer.network.maxRetries": 5
}
```

### 配置说明

- `enableAutoDiscovery`: 启用自动设备发现
- `scanTimeoutMs`: 扫描超时时间 (1-30秒)
- `maxConcurrentConnections`: 最大并发连接数 (5-200)
- `defaultPorts`: 默认扫描端口列表
- `enableBroadcastDiscovery`: 启用UDP广播发现
- `heartbeatIntervalMs`: 心跳间隔 (1-60秒)
- `connectionTimeoutMs`: 连接超时 (3-30秒)
- `enableAutoReconnect`: 启用自动重连
- `maxRetries`: 最大重试次数 (1-10)

## 故障排除

### 无法发现设备

1. **检查网络连接**：确保设备和电脑在同一网络
2. **检查防火墙**：确保UDP端口4046和TCP端口4045未被阻止
3. **检查设备状态**：确保设备已连接WiFi且运行正常
4. **手动连接**：尝试手动输入设备IP地址

### 连接不稳定

1. **检查信号强度**：确保WiFi信号良好
2. **调整心跳间隔**：减少心跳间隔提高响应性
3. **启用自动重连**：在网络不稳定时自动恢复连接
4. **检查网络质量**：使用网络诊断工具分析问题

### 数据传输错误

1. **检查数据格式**：确认使用正确的数据格式
2. **网络带宽**：确保网络带宽足够传输采集数据
3. **缓冲区设置**：调整缓冲区大小优化传输
4. **错误重试**：启用自动重试机制

### 配置问题

1. **WiFi密码**：确认密码正确无误
2. **IP地址冲突**：检查静态IP是否已被占用
3. **子网设置**：确保IP地址在正确的子网内
4. **路由器设置**：检查路由器是否阻止设备间通信

## 安全考虑

### 网络安全

- 仅在可信网络环境中使用网络连接
- 避免在公共网络中传输敏感数据
- 定期更新设备固件和扩展版本

### 访问控制

- 使用强WiFi密码保护网络
- 考虑使用MAC地址过滤限制设备访问
- 监控网络流量识别异常活动

## 性能优化

### 网络优化

- 使用5GHz WiFi频段减少干扰
- 确保设备靠近路由器获得最佳信号
- 避免网络拥塞时段进行数据传输

### 配置优化

- 根据网络条件调整超时和重试参数
- 使用适当的并发连接数避免过载
- 选择合适的数据格式平衡性能和可读性

## API参考

### WiFiDeviceDiscovery

主要方法：
- `scanForDevices()`: 扫描网络设备
- `getCachedDevices()`: 获取缓存设备列表
- `refreshDevice()`: 刷新特定设备状态

### NetworkStabilityService

主要方法：
- `connect()`: 建立网络连接
- `getConnectionQuality()`: 获取连接质量信息
- `runDiagnostics()`: 运行网络诊断

### NetworkLogicAnalyzerDriver

主要方法：
- `connect()`: 连接网络设备
- `sendNetworkConfig()`: 发送WiFi配置
- `startCapture()`: 开始网络数据采集

## 更新日志

### v1.0.0-beta.0

- 初始网络连接功能实现
- 自动设备发现
- WiFi配置支持
- 网络诊断工具
- 连接稳定性优化

## 反馈和支持

如果遇到问题或有功能建议，请：

1. 查看[故障排除](#故障排除)部分
2. 搜索[GitHub Issues](https://github.com/your-repo/vscode-logicanalyzer/issues)
3. 创建新的Issue描述问题
4. 联系技术支持团队

---

**注意**：网络功能需要Pico Logic Analyzer固件v1.2.0或更高版本支持。