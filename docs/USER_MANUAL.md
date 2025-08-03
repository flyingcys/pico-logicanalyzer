# Pico Logic Analyzer VSCode Extension 用户手册

> **版本**: 1.0.0  
> **最后更新**: 2025年8月1日  
> **适用**: VSCode 1.80+

---

## 📋 目录

1. [快速开始](#快速开始)
2. [安装和设置](#安装和设置)
3. [设备连接](#设备连接)
4. [数据采集](#数据采集)
5. [协议解码](#协议解码)
6. [数据分析](#数据分析)
7. [数据导出](#数据导出)
8. [高级功能](#高级功能)
9. [故障排除](#故障排除)
10. [常见问题](#常见问题)

---

## 🚀 快速开始

### 第一次使用

1. **安装扩展**
   ```bash
   # 在VSCode中按 Ctrl+Shift+P，然后输入：
   ext install pico-logic-analyzer
   ```

2. **连接设备**
   - 通过USB连接Pico Logic Analyzer到电脑
   - 或配置WiFi连接（需要设备支持）

3. **开始采集**
   - 按 `Ctrl+Shift+P` 打开命令面板
   - 输入 `Logic Analyzer: Start Capture`
   - 选择采集参数并开始

4. **查看结果**
   - 数据采集完成后自动打开波形视图
   - 使用协议解码器分析数据

### 30秒快速演示

```
1. 连接设备         (5秒)
2. 配置8通道采集     (10秒)  
3. 启动采集         (5秒)
4. 查看I2C解码结果   (10秒)
```

---

## 🔧 安装和设置

### 系统要求

| 项目 | 最低要求 | 推荐 |
|------|---------|------|
| **VSCode** | 1.80+ | 1.85+ |
| **Node.js** | 16.x | 18.x+ |
| **内存** | 4GB | 8GB+ |
| **存储空间** | 100MB | 500MB+ |
| **操作系统** | Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+) | - |

### 安装步骤

#### 方法1: VSCode扩展市场安装

1. 打开VSCode
2. 点击左侧扩展图标 (Ctrl+Shift+X)
3. 搜索 "Pico Logic Analyzer"
4. 点击"安装"

#### 方法2: 命令行安装

```bash
code --install-extension pico-logic-analyzer
```

#### 方法3: 从VSIX文件安装

```bash
code --install-extension pico-logic-analyzer-1.0.0.vsix
```

### 设置驱动程序

#### Windows

1. 下载并安装 [CP2102 USB驱动](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
2. 连接设备后检查设备管理器中的COM端口

#### macOS

```bash
# 安装Homebrew (如果还没有)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装USB驱动
brew install --cask silicon-labs-vcp-driver
```

#### Linux

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libusb-1.0-0-dev

# 添加用户到dialout组 (避免权限问题)
sudo usermod -a -G dialout $USER

# 重新登录生效
```

### 配置扩展

打开VSCode设置 (Ctrl+,) 搜索 "Logic Analyzer"：

```json
{
  "logicAnalyzer.defaultSampleRate": 25000000,
  "logicAnalyzer.defaultChannelCount": 8,
  "logicAnalyzer.autoConnect": true,
  "logicAnalyzer.dataRetentionDays": 30,
  "logicAnalyzer.enableNetworking": true,
  "logicAnalyzer.theme": "dark"
}
```

---

## 🔌 设备连接

### 支持的设备

| 设备型号 | 连接方式 | 最大采样率 | 通道数 | 状态 |
|---------|---------|-----------|--------|------|
| **Pico Logic Analyzer** | USB/WiFi | 100MHz | 24 | ✅ 完全支持 |
| **Pico Logic Analyzer V2** | USB/WiFi | 200MHz | 24 | ✅ 完全支持 |
| **Generic Serial Logic Analyzer** | USB | 25MHz | 8-16 | ⚡ 基础支持 |

### USB连接

#### 自动检测连接

扩展会自动检测连接的设备：

1. 连接USB线缆
2. 打开命令面板 (`Ctrl+Shift+P`)
3. 运行 `Logic Analyzer: Connect Device`
4. 从检测到的设备列表中选择

#### 手动指定端口

如果自动检测失败，可以手动指定：

```typescript
// 在设置中指定
"logicAnalyzer.serialPort": "COM3"        // Windows
"logicAnalyzer.serialPort": "/dev/ttyUSB0" // Linux
"logicAnalyzer.serialPort": "/dev/cu.SLAB_USBtoUART" // macOS
```

### WiFi网络连接

#### 设备WiFi配置

1. 首次使用USB连接设备
2. 打开命令面板，运行 `Logic Analyzer: Configure WiFi`
3. 输入WiFi信息：
   ```
   网络名称: MyWiFi
   密码: MyPassword
   设备IP: 192.168.1.100 (可选，自动分配)
   ```

#### 网络连接

配置完成后：

1. 运行 `Logic Analyzer: Scan Network Devices`
2. 选择发现的网络设备
3. 点击"连接"

#### 网络诊断

如果连接有问题：

```bash
# 在终端中运行
ping 192.168.1.100

# 检查端口
telnet 192.168.1.100 8080
```

### 连接状态

#### 状态指示器

VSCode状态栏显示连接状态：

- 🔴 **未连接**: 设备未连接或未检测到
- 🟡 **连接中**: 正在建立连接
- 🟢 **已连接**: 设备连接正常
- 🔵 **采集中**: 正在进行数据采集

#### 连接信息

连接成功后可查看设备信息：

```
设备: Pico Logic Analyzer v2.1.0
通道: 24个数字通道
最大采样率: 100MHz
缓冲区大小: 1MB
连接方式: USB (COM3) / WiFi (192.168.1.100)
```

---

## 📊 数据采集

### 基础采集

#### 快速采集

使用默认设置快速开始：

1. 按 `Ctrl+Shift+L` (快捷键)
2. 或运行命令 `Logic Analyzer: Quick Capture`
3. 设备开始采集，完成后自动显示结果

#### 详细配置采集

1. 运行 `Logic Analyzer: Start Capture`
2. 在采集设置面板中配置参数：

### 采集参数

#### 基本参数

| 参数 | 说明 | 范围 | 默认值 |
|------|------|------|--------|
| **采样率** | 每秒采集的样本数 | 1Hz - 100MHz | 25MHz |
| **采集时长** | 采集的总时间 | 1μs - 10s | 100ms |
| **触发前样本** | 触发前保存的样本数 | 0 - 500K | 1K |
| **触发后样本** | 触发后采集的样本数 | 1K - 1M | 9K |

#### 通道配置

```
通道 0: SDA    [启用] [3.3V]
通道 1: SCL    [启用] [3.3V]  
通道 2: MOSI   [禁用] [5V]
通道 3: MISO   [禁用] [5V]
通道 4: CS     [禁用] [5V]
...
通道 23: GPIO23 [禁用] [3.3V]
```

#### 电压等级设置

支持多种电压等级：

- **3.3V TTL**: 默认，适用于大多数现代设备
- **5V TTL**: 传统逻辑电平
- **2.5V**: 低压设备
- **1.8V**: 超低压设备
- **自定义**: 0.5V - 5V 可调

### 触发设置

#### 触发类型

##### 边沿触发 (Edge Trigger)

最常用的触发方式：

```
触发通道: 通道 0 (SDA)
触发边沿: 上升沿 ↗
触发电平: 1.65V (3.3V的50%)
```

配置示例：
```json
{
  "triggerType": "edge",
  "channel": 0,
  "edge": "rising",
  "level": 1.65
}
```

##### 模式触发 (Pattern Trigger)

多通道逻辑组合触发：

```
触发模式: 1010 (通道0=1, 通道1=0, 通道2=1, 通道3=0)
匹配时机: 模式稳定持续 > 100ns
```

##### 快速触发 (Fast Trigger)

高速专用触发，延迟最小：

```
触发通道: 限制1个通道
最大采样率: 200MHz
触发精度: ±1ns
```

##### 突发触发 (Blast Trigger)

用于捕获间歇性信号：

```
预触发: 10%
突发检测: 信号空闲 > 1ms 后的首个边沿
最大等待: 10秒
```

#### 触发条件

可配置复杂的触发条件：

```typescript
// 组合条件示例
{
  "conditions": [
    { "channel": 0, "state": "high" },     // CH0 = 高
    { "channel": 1, "state": "low" },      // CH1 = 低  
    { "channel": 2, "state": "edge", "edge": "rising" }, // CH2 上升沿
    { "channel": 3, "state": "dont_care" } // CH3 忽略
  ],
  "logic": "AND" // 所有条件都满足时触发
}
```

### 采集模式

#### 正常模式

标准的连续采集：
- 适用于大多数分析任务
- 内存使用稳定
- 支持所有触发类型

#### 流式模式

长时间连续采集：
- 数据实时处理，不占用大量内存
- 适用于长期监控
- 支持数据压缩存储

#### 循环缓冲模式

不间断的循环采集：
- 缓冲区写满后从头覆盖
- 始终保持最新数据
- 适用于信号监控

### 采集控制

#### 开始采集

多种方式启动采集：

```bash
# 快捷键
Ctrl+Shift+L

# 命令面板
Logic Analyzer: Start Capture

# 状态栏按钮
点击 [▶️ 开始采集]
```

#### 停止采集

```bash
# 快捷键  
Ctrl+Shift+S

# 命令面板
Logic Analyzer: Stop Capture

# 状态栏按钮
点击 [⏹️ 停止采集]
```

#### 采集进度

采集过程中显示实时进度：

```
📊 采集进度: 45% (4,500 / 10,000 samples)
⏱️ 经过时间: 2.3秒
🎯 触发状态: 等待触发条件...
📈 数据速率: 1.2MB/s
```

---

## 🔍 协议解码

### 支持的协议

扩展内置多种常用协议解码器：

| 协议 | 状态 | 最小通道数 | 典型用途 |
|------|------|-----------|----------|
| **I²C** | ✅ 完整支持 | 2 (SDA, SCL) | EEPROM, 传感器, RTC |
| **SPI** | ✅ 完整支持 | 4 (CS, CLK, MOSI, MISO) | Flash, SD卡, 显示屏 |
| **UART** | ✅ 完整支持 | 1-2 (RX, TX) | 串口通信, 调试输出 |
| **1-Wire** | 🚧 开发中 | 1 (DATA) | 温度传感器 |
| **CAN** | 🚧 开发中 | 2 (CAN_H, CAN_L) | 汽车总线 |
| **USB** | 📋 计划中 | 2 (D+, D-) | USB通信 |

### I²C解码

#### 基本配置

```json
{
  "protocol": "i2c",
  "channels": {
    "sda": 0,    // 数据线通道
    "scl": 1     // 时钟线通道
  },
  "options": {
    "addressFormat": "shifted",    // shifted / unshifted
    "clockEdge": "rising",         // rising / falling
    "showAck": true,              // 显示ACK/NACK
    "show10BitAddress": true      // 支持10位地址
  }
}
```

#### 解码结果

解码器会识别并标注：

```
📍 0.000ms: START
📍 0.123ms: ADDRESS 0x50 WRITE ✅ ACK  
📍 0.245ms: DATA 0x42 ✅ ACK
📍 0.367ms: DATA 0x55 ✅ ACK
📍 0.489ms: STOP
📍 0.612ms: START (REPEAT)
📍 0.735ms: ADDRESS 0x51 READ ✅ ACK
📍 0.857ms: DATA 0xAA ❌ NACK
📍 0.979ms: STOP
```

#### 高级功能

- **设备地址识别**: 自动识别常见I²C设备
- **数据格式化**: 支持十六进制、十进制、ASCII显示
- **错误检测**: 检测时序错误、缺失ACK等

### SPI解码

#### 基本配置

```json
{
  "protocol": "spi",
  "channels": {
    "cs": 0,     // 片选信号
    "clk": 1,    // 时钟信号
    "mosi": 2,   // 主出从入
    "miso": 3    // 主入从出
  },
  "options": {
    "mode": 0,           // SPI模式 (0,1,2,3)
    "bitOrder": "msb",   // msb / lsb
    "wordSize": 8,       // 字长度 (1-32位)
    "csPolarity": "low"  // CS有效电平
  }
}
```

#### SPI模式说明

| 模式 | CPOL | CPHA | 时钟空闲 | 数据采样 |
|------|------|------|---------|----------|
| **0** | 0 | 0 | 低电平 | 上升沿 |
| **1** | 0 | 1 | 低电平 | 下降沿 |
| **2** | 1 | 0 | 高电平 | 下降沿 |
| **3** | 1 | 1 | 高电平 | 上升沿 |

#### 解码结果

```
📍 0.000ms: CS ACTIVE (LOW)
📍 0.025ms: MOSI 0x53 MISO 0x00 [字节1]
📍 0.050ms: MOSI 0x50 MISO 0x5A [字节2]  
📍 0.075ms: MOSI 0x49 MISO 0xA5 [字节3]
📍 0.100ms: CS INACTIVE (HIGH)
```

### UART解码

#### 基本配置

```json
{
  "protocol": "uart", 
  "channels": {
    "rx": 0,     // 接收数据线
    "tx": 1      // 发送数据线 (可选)
  },
  "options": {
    "baudRate": 115200,      // 波特率
    "dataBits": 8,          // 数据位 (5-9)
    "parity": "none",       // none/even/odd
    "stopBits": 1,          // 停止位 (1/2)
    "bitOrder": "lsb",      // lsb/msb
    "invertSignal": false   // 信号反转
  }
}
```

#### 常用波特率

```
- 9600     (低速设备)
- 38400    (调制解调器)  
- 57600    (中速通信)
- 115200   (高速调试)
- 230400   (超高速)
- 921600   (最高速)
```

#### 解码结果

```
📍 0.000ms: RX START
📍 0.087ms: RX DATA 'H' (0x48) ✅
📍 0.174ms: RX DATA 'e' (0x65) ✅  
📍 0.261ms: RX DATA 'l' (0x6C) ✅
📍 0.348ms: RX DATA 'l' (0x6C) ✅
📍 0.435ms: RX DATA 'o' (0x6F) ✅
📍 0.522ms: RX STOP
```

### 自定义解码器

#### 创建自定义解码器

扩展支持创建自定义协议解码器：

```typescript
// 创建新解码器文件: my-protocol.decoder.ts
import { DecoderBase } from 'pico-logic-analyzer';

export class MyProtocolDecoder extends DecoderBase {
  id = 'my-protocol';
  name = 'My Custom Protocol';
  
  channels = [
    { id: 'data', name: 'Data Line', required: true },
    { id: 'clock', name: 'Clock Line', required: true }
  ];
  
  options = [
    { id: 'frequency', name: 'Clock Frequency', type: 'number', default: 1000000 }
  ];
  
  decode(sampleRate: number, channels: Channel[], options: any[]): DecodeResult[] {
    // 自定义解码逻辑
    const results: DecodeResult[] = [];
    
    // 分析数据并生成结果
    // ...
    
    return results;
  }
}
```

#### 注册自定义解码器

```json
// settings.json
{
  "logicAnalyzer.customDecoders": [
    "./decoders/my-protocol.decoder.ts"
  ]
}
```

---

## 📈 数据分析

### 波形查看器

#### 界面布局

```
┌─ 工具栏 ────────────────────────────────────────┐
│ [🔍] [📏] [📋] [⚙️] [💾]                        │
├─ 时间轴 ────────────────────────────────────────┤ 
│ 0μs    100μs   200μs   300μs   400μs   500μs   │
├─ 通道列表 ──┬─ 波形显示区域 ──────────────────────┤
│ CH0: SDA   │ ████████░░░░████████░░░░████████   │
│ CH1: SCL   │ ░░████░░████░░████░░████░░████░░   │  
│ CH2: MOSI  │ ░░░░████████░░░░████████░░░░       │
│ CH3: MISO  │ ████░░░░████████░░░░████████       │
├────────────┼─────────────────────────────────────┤  
│ 解码结果   │ I2C: START→ADDR(0x50)→DATA(0x42)  │
└────────────┴─────────────────────────────────────┘
```

#### 导航控制

**鼠标操作**:
- **滚轮**: 水平缩放 (时间轴)
- **Ctrl+滚轮**: 垂直缩放 (电压轴)  
- **拖拽**: 平移视图
- **双击**: 自动缩放到信号
- **右键**: 上下文菜单

**键盘快捷键**:
```
Ctrl + Plus   : 放大
Ctrl + Minus  : 缩小  
Ctrl + 0      : 适合窗口
Ctrl + 1      : 100% 缩放
Home          : 跳到开始
End           : 跳到结束
左/右箭头     : 左右平移
```

#### 游标和测量

**游标工具**:
- **单击**: 放置游标A
- **Shift+单击**: 放置游标B  
- **测量显示**: Δt = 123.45μs, Δf = 8.1kHz

**自动测量**:
- 脉冲宽度: 高电平持续时间
- 周期: 信号重复周期
- 频率: 1/周期  
- 占空比: 高电平时间/总周期

### 数据导航

#### 信号跳转

快速跳转到感兴趣的信号事件：

```
🔍 查找功能:
- 上升沿 ↗ : 找到下一个上升沿
- 下降沿 ↘ : 找到下一个下降沿  
- 脉冲 ⚡  : 找到下一个脉冲
- 边沿 ⚡⚡ : 找到任意边沿变化
```

#### 书签功能

标记重要位置：

```bash
Ctrl+B        # 添加书签
Ctrl+Shift+B  # 查看所有书签
F2            # 下一个书签
Shift+F2      # 上一个书签
```

#### 搜索和过滤

**信号搜索**:
```
搜索条件: 通道0 = 高电平 AND 通道1 = 低电平  
时间范围: 100μs - 500μs
结果: 找到 3 个匹配点
```

**数据过滤**:
- 按时间范围过滤
- 按通道状态过滤
- 按协议类型过滤

### 测量工具

#### 基础测量

**时间测量**:
```
开始时间: 123.45μs
结束时间: 234.56μs  
持续时间: 111.11μs
频率: 9.0kHz
```

**统计测量**:
```
最小脉宽: 45.2μs
最大脉宽: 67.8μs
平均脉宽: 56.5μs ± 3.2μs
脉冲计数: 127 个
```

#### 高级分析

**频谱分析**:
- FFT分析显示频率成分
- THD (总谐波失真) 计算
- SNR (信噪比) 测量

**眼图分析**:
- 适用于串行数据分析
- 抖动测量
- 建立/保持时间测量

---

## 💾 数据导出

### 支持格式

| 格式 | 扩展名 | 用途 | 兼容性 |
|------|--------|------|--------|
| **LAC** | .lac | 原生格式，包含所有信息 | Pico Logic Analyzer |
| **CSV** | .csv | 电子表格分析 | Excel, LibreOffice |
| **VCD** | .vcd | 硬件仿真 | ModelSim, GTKWave |
| **JSON** | .json | 编程接口 | 任何支持JSON的工具 |
| **TXT** | .txt | 纯文本日志 | 任何文本编辑器 |

### 导出配置

#### 基本导出

```bash
# 快捷导出当前数据
Ctrl+E                    # 导出为LAC格式
Ctrl+Shift+E             # 显示导出对话框
```

#### 高级导出选项

```json
{
  "exportRange": {
    "type": "selection",     // all / selection / time_range
    "start": "100μs",        // 开始时间
    "end": "500μs"           // 结束时间
  },
  "channels": {
    "type": "selected",      // all / selected / active
    "list": [0, 1, 2, 3]     // 指定通道列表
  },
  "sampling": {
    "mode": "original",      // original / downsample / interpolate
    "factor": 10             // 降采样因子
  },
  "format": {
    "compression": true,     // 启用压缩
    "precision": 6,          // 时间精度 (小数位)
    "encoding": "utf8"       // 文本编码
  }
}
```

### LAC格式导出

LAC是扩展的原生格式，保存完整信息：

```json
{
  "version": "1.0.0",
  "timestamp": "2025-08-01T10:30:00Z",
  "deviceInfo": {
    "name": "Pico Logic Analyzer",
    "version": "2.1.0",
    "channels": 24
  },
  "captureSession": {
    "frequency": 25000000,
    "totalSamples": 10000,
    "triggerType": "edge",
    "channels": [...]
  },
  "samples": "...",           // 压缩的样本数据
  "annotations": [...],       // 协议解码结果
  "measurements": [...]       // 测量结果
}
```

### CSV格式导出

适合在Excel中分析：

```csv
Time(μs),CH0(SDA),CH1(SCL),CH2(MOSI),CH3(MISO),I2C_Decode
0.000,1,1,0,0,
4.000,0,1,0,0,START
8.000,0,0,0,0,
12.000,1,1,0,0,ADDR:0x50
16.000,1,0,0,0,
20.000,0,1,0,0,ACK
```

### VCD格式导出

兼容硬件仿真工具：

```vcd
$version Generated by Pico Logic Analyzer VSCode Extension $end
$timescale 1ns $end
$scope module logic_analyzer $end
$var wire 1 ! SDA $end
$var wire 1 @ SCL $end
$var wire 1 # MOSI $end
$var wire 1 $ MISO $end
$upscope $end
$enddefinitions $end
$dumpvars
1!
1@
0#
0$
$end
#0
0!
#4000
1@
#8000
0@
```

### 批量导出

#### 脚本化导出

```bash
# 使用命令行批量导出
logic-analyzer-cli export --input "*.lac" --output-dir "./exports" --format csv

# 或在VSCode中运行脚本
npm run export-batch
```

#### 自动化导出

```json
// 设置自动导出规则
{
  "logicAnalyzer.autoExport": {
    "enabled": true,
    "formats": ["lac", "csv"],
    "location": "./auto-exports",
    "retention": "30days"
  }
}
```

---

## ⚡ 高级功能

### 多设备同步

#### 设备级联

支持多个设备同时采集：

```typescript
// 配置多设备
const devices = [
  { id: "device1", port: "COM3", channels: [0,1,2,3] },
  { id: "device2", port: "COM4", channels: [4,5,6,7] },  
  { id: "device3", ip: "192.168.1.100", channels: [8,9,10,11] }
];

// 同步采集
await multiDevice.startSynchronizedCapture(devices);
```

#### 时间同步

```
Device 1 timestamp: 12345.678ms
Device 2 timestamp: 12345.681ms  
Device 3 timestamp: 12345.679ms
Synchronization error: ±3μs (excellent)
```

### 脚本化自动化

#### JavaScript脚本

```javascript
// 自动化测试脚本
const analyzer = require('pico-logic-analyzer');

async function automatedTest() {
  // 连接设备
  await analyzer.connect('COM3');
  
  // 配置采集
  await analyzer.configure({
    channels: [0, 1],
    sampleRate: 25000000,
    duration: 100000
  });
  
  // 循环测试
  for (let i = 0; i < 10; i++) {
    console.log(`Test run ${i + 1}/10`);
    
    const data = await analyzer.capture();
    const i2c = await analyzer.decode('i2c', data);
    
    // 验证结果
    if (i2c.transactions.length < 5) {
      console.error('❌ Test failed: insufficient I2C transactions');
      return;
    }
    
    await analyzer.export(`test_${i}.lac`, data);
  }
  
  console.log('✅ All tests passed');
}
```

#### 批处理

```bash
# Windows批处理
@echo off
for %%f in (*.lac) do (
  logic-analyzer-cli analyze "%%f" --protocol i2c --output "%%~nf_analysis.json"
)

# Linux脚本  
#!/bin/bash
for file in *.lac; do
  logic-analyzer-cli analyze "$file" --protocol i2c --output "${file%.lac}_analysis.json"
done
```

### 性能优化

#### 大数据处理

处理大量采集数据的策略：

```typescript
// 启用流式处理
const config = {
  streamingMode: true,       // 流式处理模式
  bufferSize: 1024 * 1024,   // 1MB缓冲区
  compression: true,         // 启用压缩
  backgroundProcessing: true // 后台处理
};
```

#### 内存优化

```json
{
  "logicAnalyzer.performance": {
    "maxMemoryUsage": "2GB",     // 最大内存使用
    "enableSwap": true,          // 启用虚拟内存
    "gcThreshold": 0.8,          // 垃圾回收阈值
    "dataRetention": "1hour"     // 数据保留时间
  }
}
```

### 插件扩展

#### 创建插件

```typescript
// my-analyzer-plugin.ts
import { AnalyzerPlugin } from 'pico-logic-analyzer-sdk';

export class MyAnalyzerPlugin extends AnalyzerPlugin {
  name = 'My Custom Analyzer';
  version = '1.0.0';
  
  onActivate() {
    // 插件激活时执行
    this.registerCommand('myAnalyzer.customFunction', this.customFunction);
  }
  
  customFunction() {
    // 自定义功能实现
  }
}
```

#### 安装插件

```bash
# 从npm安装
npm install pico-logic-analyzer-plugin-my-plugin

# 从本地安装
code --install-extension ./my-plugin.vsix
```

---

## 🔧 故障排除

### 常见问题

#### 设备连接问题

**问题**: 设备无法连接

**解决方案**:
1. 检查USB线缆连接
2. 确认驱动程序已安装
3. 检查设备管理器中的COM端口
4. 尝试更换USB端口
5. 重启VSCode和设备

**诊断命令**:
```bash
# Windows
mode COM3            # 检查串口状态
devcon listclass ports  # 列出所有端口

# Linux  
ls -l /dev/ttyUSB*   # 列出USB串口
dmesg | grep tty     # 查看系统日志

# macOS
ls -l /dev/cu.*      # 列出串口设备
system_profiler SPUSBDataType  # USB设备信息
```

#### 采集数据问题

**问题**: 采集到的数据不正确

**可能原因和解决方案**:

1. **时钟问题**
   - 检查采样率设置是否过高
   - 确认信号频率在设备范围内
   - 调整触发设置

2. **信号电平问题**  
   - 检查电压等级设置 (3.3V/5V)
   - 确认信号幅度足够
   - 检查接地连接

3. **触发问题**
   - 调整触发阈值
   - 更改触发类型
   - 增加触发前样本数

#### 协议解码问题

**问题**: 协议解码结果不正确

**调试步骤**:

1. **验证硬件连接**
   ```
   I2C: SDA → CH0, SCL → CH1
   SPI: CS → CH0, CLK → CH1, MOSI → CH2, MISO → CH3
   UART: RX → CH0, TX → CH1 (可选)
   ```

2. **检查解码器配置**
   ```json
   {
     "i2c": {
       "addressFormat": "shifted",  // 确认地址格式
       "clockEdge": "rising"        // 确认时钟边沿
     }
   }
   ```

3. **信号质量分析**
   - 检查信号边沿是否清晰
   - 查看是否有毛刺或噪声
   - 确认时序关系正确

### 性能问题

#### 采集速度慢

**优化建议**:

1. **减少通道数量**
   ```
   仅启用需要的通道
   8通道: ~100MB/s
   16通道: ~50MB/s  
   24通道: ~33MB/s
   ```

2. **降低采样率**
   ```
   根据信号频率选择合适采样率
   Nyquist定理: 采样率 ≥ 2×信号频率
   ```

3. **使用硬件触发**
   ```
   避免软件触发的延迟
   启用快速触发模式
   ```

#### 内存不足

**解决方案**:

1. **启用流式处理**
   ```json
   {
     "logicAnalyzer.streaming": {
       "enabled": true,
       "bufferSize": "256MB"
     }
   }
   ```

2. **数据压缩**
   ```json
   {
     "logicAnalyzer.compression": {
       "enabled": true,
       "algorithm": "lz4",  // 快速压缩
       "level": 3           // 压缩级别
     }
   }
   ```

3. **清理旧数据**
   ```bash
   # 清理临时文件
   Logic Analyzer: Clean Cache
   
   # 设置自动清理
   "logicAnalyzer.autoCleanup": true
   ```

### 网络连接问题

#### WiFi连接不稳定

**诊断步骤**:

1. **网络质量测试**
   ```bash
   ping -c 10 192.168.1.100
   # 检查丢包率和延迟
   ```

2. **端口检查**
   ```bash
   telnet 192.168.1.100 8080
   # 检查端口是否开放
   ```

3. **防火墙设置**
   ```bash
   # Windows
   netsh advfirewall firewall add rule name="LogicAnalyzer" dir=in action=allow protocol=TCP localport=8080
   
   # Linux
   sudo ufw allow 8080
   ```

#### 网络延迟过高

**优化方案**:

1. **使用有线连接**
   - 以太网延迟通常更低
   - 避免WiFi干扰

2. **调整缓冲区**
   ```json
   {
     "logicAnalyzer.network": {
       "bufferSize": "1MB",     // 增加缓冲区
       "timeout": 5000,         // 5秒超时
       "keepAlive": true        // 保持连接
     }
   }
   ```

3. **QoS设置**
   - 在路由器中为设备设置高优先级
   - 限制其他设备带宽使用

---

## ❓ 常见问题

### 使用问题

**Q: 支持哪些操作系统？**

A: 支持 Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)。所有主流操作系统都经过测试。

**Q: 最大采样率是多少？**

A: 
- Pico Logic Analyzer: 100MHz
- Pico Logic Analyzer V2: 200MHz  
- 实际采样率取决于启用的通道数量

**Q: 可以同时连接多个设备吗？**

A: 是的，支持最多5个设备级联。需要确保每个设备有唯一的标识符。

**Q: 数据可以保存多长时间？**

A: 默认保存30天，可在设置中调整。数据会自动压缩以节省空间。

### 技术问题

**Q: 为什么我的I2C解码结果不正确？**

A: 常见原因:
1. 通道分配错误 (SDA/SCL)
2. 地址格式设置错误 (shifted/unshifted)  
3. 采样率太低
4. 信号质量差

**Q: 如何提高采集性能？**

A: 
1. 只启用需要的通道
2. 选择合适的采样率
3. 使用硬件触发
4. 启用数据压缩

**Q: 支持自定义协议解码吗？**

A: 是的，可以用TypeScript创建自定义解码器。参考开发者文档。

**Q: 可以导出数据到其他工具吗？**

A: 支持多种格式:
- CSV (Excel分析)
- VCD (波形查看器)  
- JSON (编程接口)
- LAC (原生格式)

### 许可和支持

**Q: 扩展是免费的吗？**

A: 扩展本身免费，但需要配合Pico Logic Analyzer硬件使用。

**Q: 如何获得技术支持？**

A: 
1. 查看本用户手册
2. 访问GitHub Issues页面
3. 发送邮件至support@pico-logic-analyzer.com

**Q: 有开发者文档吗？**

A: 是的，开发者文档提供API参考和插件开发指南。

**Q: 支持企业部署吗？**

A: 支持，提供企业版本和批量许可。联系sales@pico-logic-analyzer.com了解详情。

---

## 📚 附录

### 快捷键参考

| 功能 | Windows/Linux | macOS |
|------|---------------|-------|
| 开始采集 | Ctrl+Shift+L | Cmd+Shift+L |
| 停止采集 | Ctrl+Shift+S | Cmd+Shift+S |
| 导出数据 | Ctrl+E | Cmd+E |
| 放大 | Ctrl+Plus | Cmd+Plus |
| 缩小 | Ctrl+Minus | Cmd+Minus |
| 适合窗口 | Ctrl+0 | Cmd+0 |
| 添加书签 | Ctrl+B | Cmd+B |
| 查找 | Ctrl+F | Cmd+F |

### 配置参考

完整的配置选项：

```json
{
  "logicAnalyzer.defaultSampleRate": 25000000,
  "logicAnalyzer.defaultChannelCount": 8,
  "logicAnalyzer.autoConnect": true,
  "logicAnalyzer.dataRetentionDays": 30,
  "logicAnalyzer.enableNetworking": true,
  "logicAnalyzer.theme": "dark",
  "logicAnalyzer.performance": {
    "maxMemoryUsage": "2GB",
    "enableStreaming": true,
    "compressionLevel": 3
  },
  "logicAnalyzer.protocols": {
    "i2c": { "addressFormat": "shifted" },
    "spi": { "defaultMode": 0 },
    "uart": { "defaultBaudRate": 115200 }
  }
}
```

### 术语表

| 术语 | 说明 |
|------|------|
| **采样率** | 每秒采集的样本数量，单位Hz |
| **触发** | 开始记录数据的条件 |
| **逻辑分析仪** | 分析数字信号的测试仪器 |
| **协议解码** | 将原始信号转换为协议消息 |
| **时间戳** | 每个样本的时间标记 |
| **阈值电压** | 区分高低电平的电压值 |
| **上升时间** | 信号从10%上升到90%的时间 |
| **建立时间** | 数据稳定到时钟边沿的时间 |
| **保持时间** | 时钟边沿后数据保持稳定的时间 |

### 联系信息

- **官方网站**: https://pico-logic-analyzer.com
- **文档**: https://docs.pico-logic-analyzer.com  
- **GitHub**: https://github.com/pico-logic-analyzer/vscode-extension
- **技术支持**: support@pico-logic-analyzer.com
- **销售咨询**: sales@pico-logic-analyzer.com

---

*最后更新: 2025年8月1日*  
*版本: 1.0.0*  
*© 2025 Pico Logic Analyzer Team*