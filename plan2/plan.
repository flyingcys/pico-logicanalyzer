# VSCode 逻辑分析器插件技术方案书

## 项目概述

### 项目背景
基于 @logicanalyzer/Software（pico版本逻辑分析器软件）开发一个功能完全一致的VSCode插件，提供在VSCode环境中进行逻辑信号分析和协议解码的能力。

### 项目目标
- 完全移植原软件的核心功能到VSCode插件
- 使用Vue3 + Element Plus实现现代化前端界面
- 保持与原软件100%的功能兼容性
- 提供更好的开发者体验和VSCode集成

### 核心功能
1. 逻辑分析器设备连接和管理
2. 实时数据采集和显示
3. 多通道波形显示和分析
4. 80+种协议解码器支持
5. 测量和分析工具
6. 数据导入导出(.lac格式)
7. 多设备同步采集

## 原系统架构分析

### 主要技术栈
- **UI框架**: Avalonia UI (跨平台.NET桌面应用)
- **编程语言**: C# (.NET 8.0)
- **设备通信**: 串口/网络通信
- **协议解码**: Python.NET + Sigrok解码器生态
- **数据处理**: 二进制数据流处理
- **文件格式**: JSON序列化(.lac文件)

### 核心模块分析

#### 1. SharedDriver模块
```csharp
// 核心接口定义
AnalyzerDriverBase (抽象基类)
├── LogicAnalyzerDriver (单设备驱动)
├── MultiAnalyzerDriver (多设备驱动)  
└── EmulatedAnalyzerDriver (模拟设备)

// 关键数据结构
CaptureSession (采集会话配置)
AnalyzerChannel (通道数据)
BurstInfo (脉冲信息)
```

**功能特性**:
- 支持串口/网络连接
- 设备自动检测和版本验证
- 多种触发模式（边沿、复合、快速、脉冲）
- 实时数据采集和处理
- 多设备同步采集

#### 2. SigrokDecoderBridge模块
```csharp
SigrokProvider (解码器管理器)
├── SigrokDecoderBase (解码器基类)
├── SigrokPythonEngine (Python引擎)
└── 80+种协议解码器
```

**支持的协议**:
I2C, SPI, UART, CAN, USB, JTAG, Ethernet, RS232/RS485, PWM, 红外遥控, 音频协议等80+种

#### 3. 用户界面模块
```csharp
MainWindow (主窗口控制器)
├── Controls/
│   ├── SampleViewer (波形显示)
│   ├── ChannelViewer (通道控制)
│   ├── AnnotationViewer (解码结果显示)
│   └── SampleMarker (标记工具)
├── Dialogs/
│   ├── CaptureDialog (采集配置)
│   ├── MeasureDialog (测量工具)
│   └── NetworkDialog (网络设置)
```

#### 4. 数据处理流程
1. **设备连接**: 串口/网络连接，版本验证
2. **参数配置**: 采样频率、触发条件、通道选择
3. **数据采集**: 实时数据流接收和解析  
4. **数据处理**: 二进制数据提取到通道样本
5. **波形显示**: 多通道时域波形渲染
6. **协议解码**: Python解码器处理
7. **结果展示**: 解码结果可视化

## 硬件生态架构设计 🚀

### 战略定位：成为逻辑分析器领域的"通用平台"

**核心理念**: 从设计阶段就构建一个开放、可扩展的硬件生态系统，支持市面上绝大多数逻辑分析器硬件，为用户提供统一的分析体验。

### 市场现状分析

#### 当前硬件生态现状
**主流硬件厂商**:
- **Saleae Logic Pro系列**: 优秀用户体验，但封闭生态，价格昂贵
- **Keysight/Agilent**: 企业级解决方案，功能强大但复杂
- **Rigol/Siglent**: 性价比高的中端设备  
- **sigrok生态**: 支持80+设备，但软件体验较差
- **开源/DIY设备**: 基于FPGA的自制设备越来越多

**现有软件生态问题**:
1. **厂商锁定**: 大部分软件只支持自家硬件
2. **体验分裂**: 不同硬件需要学习不同软件
3. **功能差异**: 各厂商软件功能重复开发，但体验不一致
4. **迁移成本**: 更换硬件需要重新学习软件

**我们的机会**:
- 打造硬件无关的统一平台
- 为用户提供自由选择硬件的能力
- 建立开放生态，吸引第三方开发者
- 降低用户的硬件绑定和迁移成本

### 硬件抽象层 (HAL) 架构

#### 核心接口设计

```typescript
// 通用逻辑分析器接口
interface ILogicAnalyzer {
  // 设备身份和能力
  readonly deviceInfo: DeviceInfo;
  readonly capabilities: HardwareCapabilities;
  readonly connectionStatus: ConnectionStatus;
  
  // 连接管理
  connect(params: ConnectionParams): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<DeviceStatus>;
  
  // 数据采集
  startCapture(config: CaptureConfiguration): Promise<CaptureResult>;
  stopCapture(): Promise<void>;
  
  // 设备控制
  configure(settings: DeviceSettings): Promise<ConfigurationResult>;
  calibrate?(): Promise<CalibrationResult>; // 可选功能
  
  // 事件通知
  on(event: 'data' | 'error' | 'status', callback: Function): void;
  off(event: string, callback: Function): void;
}

// 硬件能力描述标准
interface HardwareCapabilities {
  // 通道规格
  channels: {
    digital: number;              // 数字通道数
    analog?: number;             // 模拟通道数（可选）
    mixed?: boolean;             // 是否支持混合信号
    maxVoltage: number;          // 最大输入电压
    inputImpedance: number;      // 输入阻抗
  };
  
  // 采样能力
  sampling: {
    maxRate: number;             // 最大采样率
    minRate: number;             // 最小采样率
    supportedRates: number[];    // 支持的采样率列表
    bufferSize: number;          // 内部缓冲区大小
    streamingSupport: boolean;   // 是否支持流式采集
  };
  
  // 触发能力
  triggers: {
    types: TriggerType[];        // 支持的触发类型
    maxChannels: number;         // 触发可用通道数
    patternWidth: number;        // 模式触发位宽
    sequentialSupport: boolean;  // 是否支持序列触发
    conditions: TriggerCondition[]; // 支持的触发条件
  };
  
  // 连接方式
  connectivity: {
    interfaces: ('usb' | 'ethernet' | 'serial' | 'bluetooth')[];
    protocols: ('custom' | 'scpi' | 'sigrok' | 'saleae')[];
    networkConfig?: NetworkCapability;
  };
  
  // 特殊功能
  features: {
    signalGeneration?: boolean;  // 信号发生功能
    powerSupply?: boolean;       // 电源输出
    i2cSniffer?: boolean;        // I2C总线嗅探
    canSupport?: boolean;        // CAN总线支持
    customDecoders?: boolean;    // 自定义解码器
  };
}
```

#### 多层次抽象架构

```
┌─────────────────────────────────────────────────────────┐
│                     应用层 (Vue Components)              │
│  DeviceManager | CaptureControls | WaveformViewer      │
└─────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────┐
│                  业务逻辑层 (Stores/Services)            │
│    CaptureStore | DeviceStore | DecoderStore           │
└─────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────┐
│               硬件抽象层 (HAL Interface)                 │
│           ILogicAnalyzer | CapabilityAdapter           │
└─────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────┐
│              驱动适配层 (Driver Adapters)                │
│    SaleaeAdapter | SigrokAdapter | CustomAdapter       │
└─────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────┐
│              硬件驱动层 (Specific Drivers)               │
│   SaleaeDriver | RigolDriver | PicoDriver | ...        │
└─────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────┐
│               通信层 (Transport Layer)                   │
│      SerialPort | USB | WebSocket | HTTP              │
└─────────────────────────────────────────────────────────┘
```

### 插件化驱动系统

#### 驱动插件管理架构

```typescript
// 驱动插件管理器
class HardwareDriverManager {
  private drivers = new Map<string, IHardwareDriver>();
  private pluginRegistry = new PluginRegistry();
  private detectionEngine = new HardwareDetectionEngine();
  
  // 初始化驱动系统
  async initialize() {
    await this.loadBuiltinDrivers();     // 加载内置驱动
    await this.loadUserDrivers();        // 加载用户安装驱动
    await this.loadSystemDrivers();      // 加载系统级驱动
    await this.loadRemoteDrivers();      // 加载远程驱动库
    
    // 启动硬件检测
    this.startHardwareDetection();
  }
  
  // 智能硬件检测
  async detectHardware(): Promise<DetectedDevice[]> {
    const detectors = [
      new USBDetector(),          // USB设备检测
      new SerialDetector(),       // 串口设备检测
      new NetworkDetector(),      // 网络设备检测
      new SigrokDetector(),       // sigrok兼容设备检测
      new SaleaeDetector(),       // Saleae设备专用检测
    ];
    
    const results = await Promise.all(
      detectors.map(detector => detector.detect())
    );
    
    return this.mergeAndRankResults(results.flat());
  }
  
  // 驱动匹配算法
  async matchDriver(device: DetectedDevice): Promise<IHardwareDriver | null> {
    // 1. 精确匹配 (VID/PID + 版本)
    let driver = await this.exactMatch(device);
    if (driver) return driver;
    
    // 2. 特征匹配 (设备描述符特征)
    driver = await this.featureMatch(device);
    if (driver) return driver;
    
    // 3. 协议探测 (发送标准探测命令)
    driver = await this.protocolProbe(device);
    if (driver) return driver;
    
    // 4. 通用适配器 (sigrok兼容)
    return await this.createGenericAdapter(device);
  }
}
```

### 统一数据格式和配置管理

#### 统一数据格式

```typescript
// 统一的采集数据格式
interface UnifiedCaptureData {
  // 元数据
  metadata: {
    deviceInfo: DeviceInfo;      // 设备信息
    captureId: string;           // 采集会话ID
    timestamp: number;           // 采集时间戳
    duration: number;            // 采集持续时间
    sampleRate: number;          // 实际采样率
    totalSamples: number;        // 总样本数
    triggerPosition?: number;    // 触发位置
    timebase: TimebaseInfo;      // 时基信息
  };
  
  // 通道信息
  channels: ChannelInfo[];
  
  // 样本数据
  samples: {
    digital?: {
      data: Uint8Array[];        // 每个通道的数字数据
      encoding: 'binary' | 'rle'; // 数据编码格式
    };
    analog?: {
      data: Float32Array[];      // 模拟通道数据
      resolution: number;        // ADC分辨率
      range: [number, number];   // 量程范围
    };
    timing?: {
      intervals: number[];       // 时间间隔
      precision: number;         // 时间精度
    };
  };
  
  // 扩展数据（硬件特定）
  extensions?: {
    [deviceType: string]: any;   // 硬件特定的扩展数据
  };
  
  // 质量信息
  quality: {
    lostSamples: number;         // 丢失样本数
    errorRate: number;           // 错误率
    noiseLevel?: number;         // 噪声水平
    calibrationStatus: boolean;  // 校准状态
  };
}
```

### 多设备协同工作

```typescript
// 多设备协调器
class MultiDeviceCoordinator {
  private devices = new Map<string, ILogicAnalyzer>();
  private synchronizer = new DeviceSynchronizer();
  
  // 添加设备到协调器
  async addDevice(deviceId: string, analyzer: ILogicAnalyzer): Promise<void> {
    this.devices.set(deviceId, analyzer);
    
    // 设备能力兼容性检查
    await this.checkCompatibility(deviceId);
    
    // 时钟同步配置
    await this.configureSynchronization(deviceId);
  }
  
  // 同步多设备采集
  async startSynchronizedCapture(
    configs: Map<string, CaptureConfiguration>
  ): Promise<Map<string, UnifiedCaptureData>> {
    
    // 1. 预处理和验证
    const adaptedConfigs = await this.preprocessConfigurations(configs);
    
    // 2. 设备时钟同步
    await this.synchronizer.synchronizeClocks(Array.from(this.devices.values()));
    
    // 3. 并行启动采集
    const capturePromises = Array.from(adaptedConfigs.entries()).map(
      async ([deviceId, config]) => {
        const device = this.devices.get(deviceId)!;
        const result = await device.startCapture(config);
        return [deviceId, result] as [string, UnifiedCaptureData];
      }
    );
    
    // 4. 等待所有采集完成
    const results = await Promise.all(capturePromises);
    
    // 5. 时间对齐和数据同步
    const alignedResults = await this.synchronizer.alignCaptureTimestamps(
      new Map(results)
    );
    
    return alignedResults;
  }
}
```

## VSCode插件技术架构 🚀

### 架构策略

**技术选型**: 基于深度源码分析和architecture_analysis_report.md的评估，采用**纯TypeScript架构**，避免多语言集成的复杂性。

**核心优势**: 
- ✅ **零依赖**: 无需Python或C#运行时
- ⚡ **高性能**: V8引擎原生执行
- 🔒 **类型安全**: TypeScript编译时检查
- 🎯 **易维护**: 单一技术栈

### 纯TypeScript架构设计 🎯

```
┌─────────────────────────────────────────────────────┐
│                VSCode 插件层                         │
│  ├── 扩展主进程 (TypeScript + Node.js)             │
│  ├── Webview前端 (Vue3 + Element Plus)             │
│  └── 配置管理 (Settings + 消息通信)                 │
└─────────────────────────────────────────────────────┘
                          ↕ 消息通信
┌─────────────────────────────────────────────────────┐
│           硬件抽象层 (TypeScript HAL)                │
│  ├── 设备驱动接口 (ILogicAnalyzer)                  │
│  ├── 通信协议实现 (OutputPacket)                    │
│  ├── 数据采集管理 (CaptureSession)                  │
│  └── 多设备协调 (MultiDeviceCoordinator)            │
└─────────────────────────────────────────────────────┘
                          ↕ 串口/网络
┌─────────────────────────────────────────────────────┐
│              硬件设备层                              │
│  ├── Pico Logic Analyzer (串口/网络)                │
│  ├── 其他品牌设备 (通过驱动适配)                     │
│  └── 多设备同步 (主从同步机制)                       │
└─────────────────────────────────────────────────────┘
```

### 项目结构设计

```
vscode-logicanalyzer/
├── src/                         # VSCode插件源码
│   ├── extension.ts            # 插件主入口
│   ├── drivers/                # 设备驱动层
│   │   ├── AnalyzerDriverBase.ts  # 驱动基类
│   │   ├── LogicAnalyzerDriver.ts  # 单设备驱动
│   │   ├── MultiAnalyzerDriver.ts  # 多设备驱动
│   │   └── protocols/          # 通信协议
│   │       ├── OutputPacket.ts # 数据包封装
│   │       └── SerialProtocol.ts # 串口协议
│   ├── decoders/               # 协议解码器
│   │   ├── DecoderBase.ts      # 解码器基类
│   │   ├── DecoderManager.ts   # 解码器管理
│   │   └── protocols/          # 具体协议实现
│   │       ├── I2CDecoder.ts   # I2C解码器
│   │       ├── SPIDecoder.ts   # SPI解码器
│   │       └── UARTDecoder.ts  # UART解码器
│   ├── webview/                # Webview前端
│   │   ├── main.ts            # Vue应用入口
│   │   ├── App.vue            # 根组件
│   │   ├── components/        # Vue组件
│   │   │   ├── WaveformViewer/ # 波形显示组件
│   │   │   ├── DeviceManager/ # 设备管理组件
│   │   │   ├── CapturePanel/  # 采集控制面板
│   │   │   └── DecoderPanel/  # 解码器面板
│   │   ├── stores/            # Pinia状态管理
│   │   ├── engines/           # 渲染引擎
│   │   │   ├── WaveformRenderer.ts # Canvas波形渲染
│   │   │   ├── InteractionEngine.ts # 交互处理
│   │   │   └── MeasurementTools.ts # 测量工具
│   │   └── utils/             # 工具函数
│   ├── models/                 # 数据模型
│   │   ├── CaptureSession.ts   # 采集会话
│   │   ├── AnalyzerChannel.ts  # 通道定义
│   │   └── DeviceInfo.ts       # 设备信息
│   ├── commands/               # VSCode命令
│   └── providers/             # VSCode提供者
├── package.json
├── webpack.config.js
└── tsconfig.json
```

### 技术栈选择 🎯

#### 前端技术栈
- **TypeScript**: 类型安全，与VSCode API无缝集成
- **Node.js**: VSCode插件运行环境
- **VSCode Extension API**: 插件开发框架
- **Vue 3**: 现代响应式框架，组件化开发
- **Element Plus**: 企业级UI组件库
- **Pinia**: 轻量级状态管理库
- **Canvas 2D/OffscreenCanvas**: 高性能图形渲染引擎

#### 通信和数据处理
- **串口通信**: Node.js serialport库
- **网络通信**: WebSocket/TCP Socket
- **二进制协议**: ArrayBuffer + DataView
- **数据压缩**: 支持RLE等压缩算法

#### 开发工具
- **构建工具**: Webpack 5 + ESBuild
- **代码质量**: ESLint + Prettier + TypeScript严格模式
- **测试框架**: Jest + @testing-library/vue
- **调试工具**: Chrome DevTools + VSCode调试器

## 核心功能模块设计

### 1. 设备驱动层 (Device Layer)

#### AnalyzerDriverBase 接口定义
```typescript
abstract class AnalyzerDriverBase {
    abstract deviceVersion: string;
    abstract channelCount: number;
    abstract maxFrequency: number;
    abstract minFrequency: number;           // 根据最大频率计算
    abstract bufferSize: number;
    abstract blastFrequency: number;         // 高速采样模式频率
    abstract driverType: AnalyzerDriverType;
    abstract isNetwork: boolean;
    abstract isCapturing: boolean;

    // 核心方法
    abstract startCapture(session: CaptureSession, handler?: CaptureCompletedHandler): Promise<CaptureError>;
    abstract stopCapture(): Promise<boolean>;
    abstract getDeviceInfo(): AnalyzerDeviceInfo;
    abstract enterBootloader(): Promise<boolean>;
    
    // 网络和硬件功能
    abstract sendNetworkConfig(ssid: string, password: string, ip: string, port: number): Promise<boolean>;
    abstract getVoltageStatus(): Promise<string>;     // 电池电压监控
    
    // 采集模式和限制管理
    getCaptureMode(channels: number[]): CaptureMode;
    getLimits(channels: number[]): CaptureLimits;
}
```

### 2. 数据采集模块 (Capture Module)

#### 核心功能
- **多设备同步**: 支持2-5个设备的同步采集(最多120通道)
- **突发采集**: 连续多次采集和时间间隔测量
- **设备检测**: 跨平台USB设备自动检测
- **触发系统**: 边沿、复杂、快速、突发等多种触发模式

#### CaptureSession 数据结构
```typescript
// 基于C#源码的实际CaptureSession定义
interface CaptureSession {
    // 基础采集参数
    frequency: number;                    // 采样频率
    preTriggerSamples: number;           // 触发前样本数
    postTriggerSamples: number;          // 触发后样本数
    
    // 总样本数计算 (只读属性)
    get totalSamples(): number {
        return this.postTriggerSamples * (this.loopCount + 1) + this.preTriggerSamples;
    }
    
    // 触发系统配置
    triggerType: TriggerType;            // Edge, Complex, Fast, Blast
    triggerChannel: number;              // 触发通道 (0-23)
    triggerInverted: boolean;            // 触发极性反转
    triggerPattern: number;              // 复杂触发模式 (16位)
    triggerBitCount: number;             // 触发位宽
    
    // 突发采集系统
    loopCount: number;                   // 突发采集次数 (0-255)
    measureBursts: boolean;              // 是否测量突发间隔
    
    // 通道配置
    captureChannels: AnalyzerChannel[];  // 激活通道列表
    
    // 突发信息数组 (采集完成后填充)
    bursts?: BurstInfo[];
    
    // 方法接口
    clone(): CaptureSession;             // 深拷贝包含样本数据
    cloneSettings(): CaptureSession;     // 只拷贝设置，不含样本数据
}

// 突发信息结构 - 基于实际源码
interface BurstInfo {
    burstSampleStart: number;            // 突发开始样本位置
    burstSampleEnd: number;              // 突发结束样本位置
    burstSampleGap: number;              // 样本间隔数量
    burstTimeGap: number;                // 时间间隔 (纳秒)
    
    // 时间格式化方法
    getTime(): string;                   // 格式化时间显示 (ns/µs/ms/s)
}

// 触发延迟常量 - 用于多设备同步
const TriggerDelays = {
    ComplexTriggerDelay: 5,     // 复杂触发延迟 (纳秒)
    FastTriggerDelay: 3         // 快速触发延迟 (纳秒)
};

interface AnalyzerChannel {
    channelNumber: number;
    channelName: string;
    channelColor?: number;              // uint? - 可选颜色值
    hidden: boolean;
    samples?: Uint8Array;               // byte[] - 原始样本数据
    
    // 显示属性 - getter方法
    get textualChannelNumber(): string; // 自动生成 "Channel {N+1}"
    
    // 克隆方法 - 深拷贝支持
    clone(): AnalyzerChannel;
}

// 采集模式枚举
enum CaptureMode {
    Channels_8 = 0,   // 8通道模式，最大样本数
    Channels_16 = 1,  // 16通道模式
    Channels_24 = 2   // 24通道模式，最少样本数
}

// 采集限制结构 - 硬件相关的重要概念
interface CaptureLimits {
    minPreSamples: number;              // 最小触发前样本数
    maxPreSamples: number;              // 最大触发前样本数  
    minPostSamples: number;             // 最小触发后样本数
    maxPostSamples: number;             // 最大触发后样本数
    
    // 计算属性 - getter方法
    get maxTotalSamples(): number {     // 最大总样本数
        return this.minPreSamples + this.maxPostSamples;
    }
}

// 设备信息结构 - 完整的硬件能力描述
interface AnalyzerDeviceInfo {
    name: string;                       // 设备名称和版本
    maxFrequency: number;               // 最大采样频率
    blastFrequency: number;             // 突发采样频率
    channels: number;                   // 通道数量
    bufferSize: number;                 // 缓冲区大小
    modeLimits: CaptureLimits[];        // 各模式的采集限制
}
```

### 3. 设备通信协议模块 (Device Communication) 🆕

基于源码分析，发现了关键的通信协议实现，这是plan.md的重大遗漏：

#### 数据包封装 (OutputPacket)
```typescript
class OutputPacket {
    private dataBuffer: Uint8Array;
    
    // 数据添加方法
    addByte(value: number): void;
    addBytes(values: Uint8Array): void;
    addString(text: string): void;        // ASCII编码
    addStruct(struct: any): void;         // 结构体序列化
    
    // 🚀 关键的协议序列化 - 包含转义机制
    serialize(): Uint8Array {
        // 协议格式: 0x55 0xAA [转义后的数据] 0xAA 0x55
        // 转义规则: 0xAA/0x55/0xF0 -> 0xF0 + (原值 ^ 0xF0)
    }
}
```

#### 采集请求结构 (CaptureRequest)
```typescript
// 对应C#中的struct，需要精确的内存布局
interface CaptureRequest {
    triggerType: number;        // byte - 触发类型
    trigger: number;           // byte - 触发通道
    invertedOrCount: number;   // byte - 反转标志或计数
    triggerValue: number;      // ushort - 触发值
    channels: Uint8Array;      // byte[24] - 通道配置
    channelCount: number;      // byte - 有效通道数
    frequency: number;         // uint32 - 采样频率
    preSamples: number;        // uint32 - 触发前样本
    postSamples: number;       // uint32 - 触发后样本
    loopCount: number;         // byte - 循环次数
    measure: number;           // byte - 是否测量突发
    captureMode: number;       // byte - 采集模式
}
```

#### 网络配置结构 (NetConfig)
```typescript
// WiFi网络配置，需要固定大小缓冲区
interface NetConfig {
    accessPointName: string;            // 33字节固定长度
    password: string;                   // 64字节固定长度  
    ipAddress: string;                  // 16字节固定长度
    port: number;                       // ushort (16位)
}
```

### 4. 波形显示模块 (Waveform Display)

#### Canvas渲染引擎
```typescript
class WaveformRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private offscreenCanvas: OffscreenCanvas;
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.setupOffscreenRendering();
    }
    
    renderWaveform(channels: AnalyzerChannel[], viewRange: ViewRange) {
        // 清除画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 计算显示参数
        const { samplesPerPixel, pixelsPerSample } = this.calculateDisplayParams(viewRange);
        
        // 渲染通道波形
        channels.forEach((channel, index) => {
            if (!channel.hidden) {
                this.renderChannelWaveform(channel, index, pixelsPerSample);
            }
        });
        
        // 渲染标记和注释
        this.renderMarkers(viewRange);
        this.renderAnnotations(viewRange);
    }
}
```

### 4. 协议解码模块 (Protocol Decoder) 🚀 **纯TypeScript实现**

#### 架构决策

**基于源码分析和architecture_analysis_report.md的评估，采用纯TypeScript实现方案**:
- ✅ **零依赖**: 无需Python运行时或C#编译器
- ⚡ **高性能**: V8引擎原生执行，无进程通信开销
- 🔒 **类型安全**: TypeScript编译时类型检查
- 🎯 **易维护**: 单一技术栈，调试简单

#### 核心设计

#### DecoderBase - TypeScript解码器基类
```typescript
abstract class DecoderBase {
    // 解码器元数据 - 对应Python解码器的属性
    abstract readonly id: string;           // 解码器标识
    abstract readonly name: string;         // 显示名称
    abstract readonly longname: string;     // 完整名称
    abstract readonly desc: string;         // 描述信息
    abstract readonly license: string;      // 许可证
    abstract readonly inputs: string[];     // 输入类型 ['logic']
    abstract readonly outputs: string[];    // 输出类型
    
    // 通道和选项配置
    abstract readonly channels: DecoderChannel[];  // 通道定义
    abstract readonly options: DecoderOption[];    // 配置选项
    abstract readonly annotations: string[][];     // 注释类型定义
    
    // 解码状态管理
    protected sampleIndex: number = 0;
    protected sampleRate: number = 0;
    protected channelData: Uint8Array[] = [];
    protected results: DecoderResult[] = [];
    
    // 核心解码方法 - 子类实现具体协议逻辑
    abstract decode(
        sampleRate: number,
        channels: AnalyzerChannel[],
        options: DecoderOptionValue[]
    ): DecoderResult[];
    
    // 🚀 关键API - 重新实现Python解码器的核心方法
    protected wait(conditions: WaitCondition): WaitResult {
        // 等待指定的通道条件 (上升沿、下降沿、高电平等)
        // 对应Python: pins = self.wait({0: 'r'})
        while (this.sampleIndex < this.channelData[0].length) {
            const currentPins = this.getCurrentPins();
            if (this.matchesCondition(currentPins, conditions)) {
                return { pins: currentPins, sampleNumber: this.sampleIndex };
            }
            this.sampleIndex++;
        }
        throw new Error('End of samples reached');
    }
    
    protected put(startSample: number, endSample: number, data: DecoderOutput): void {
        // 输出解码结果
        // 对应Python: self.put(ss, es, self.out_ann, [cls, texts])
        this.results.push({
            startSample,
            endSample,
            annotationType: data.type,
            values: data.values,
            rawData: data.rawData
        });
    }
    
    // 辅助方法
    protected hasMoreSamples(): boolean {
        return this.sampleIndex < this.channelData[0].length;
    }
    
    protected getCurrentPins(): number[] {
        return this.channelData.map(channel => channel[this.sampleIndex]);
    }
    
    protected matchesCondition(pins: number[], condition: WaitCondition): boolean {
        // 实现条件匹配逻辑 (上升沿、下降沿等)
    }
}
```

#### 示例：I2C解码器实现
```typescript
class I2CDecoder extends DecoderBase {
    readonly id = 'i2c';
    readonly name = 'I2C';
    readonly longname = 'Inter-Integrated Circuit';
    readonly desc = 'Two-wire, multi-master, serial bus.';
    readonly license = 'gplv2+';
    readonly inputs = ['logic'];
    readonly outputs = ['i2c'];
    
    readonly channels = [
        { id: 'scl', name: 'SCL', desc: 'Serial clock line' },
        { id: 'sda', name: 'SDA', desc: 'Serial data line' }
    ];
    
    readonly annotations = [
        ['start', 'Start', 'S'],
        ['repeat-start', 'Repeat start', 'Sr'],
        ['stop', 'Stop', 'P'],
        ['ack', 'ACK', 'A'],
        ['nack', 'NACK', 'N'],
        ['address-read', 'Address read'],
        ['address-write', 'Address write'],
        ['data-read', 'Data read'],
        ['data-write', 'Data write']
    ];
    
    // 状态管理
    private state: 'IDLE' | 'START' | 'ADDRESS' | 'DATA' | 'ACK' = 'IDLE';
    private bitBuffer: number[] = [];
    private isWrite = false;
    
    decode(sampleRate: number, channels: AnalyzerChannel[], options: DecoderOptionValue[]): DecoderResult[] {
        this.sampleRate = sampleRate;
        this.channelData = channels.map(ch => ch.samples || new Uint8Array());
        this.results = [];
        this.sampleIndex = 0;
        
        // 主解码循环 - 对应Python的while True循环
        while (this.hasMoreSamples()) {
            try {
                switch (this.state) {
                    case 'IDLE':
                        this.waitForStart();
                        break;
                    case 'START':
                        this.handleStart();
                        break;
                    case 'ADDRESS':
                        this.handleAddressBit();
                        break;
                    case 'DATA':
                        this.handleDataBit();
                        break;
                    case 'ACK':
                        this.handleAckBit();
                        break;
                }
            } catch (error) {
                if (error.message === 'End of samples reached') {
                    break;
                }
                throw error;
            }
        }
        
        return this.results;
    }
    
    private waitForStart(): void {
        // 等待START条件: SCL=高, SDA=下降沿
        // 对应Python: pins = self.wait({0: 'h', 1: 'f'})
        const result = this.wait({ 0: 'high', 1: 'falling' });
        const startSample = result.sampleNumber;
        
        this.put(startSample, startSample, {
            type: 'start',
            values: ['Start'],
            rawData: null
        });
        
        this.state = 'ADDRESS';
        this.bitBuffer = [];
    }
    
    private handleAddressBit(): void {
        // 等待时钟上升沿采样数据
        const result = this.wait({ 0: 'rising' });
        const sdaBit = result.pins[1];
        
        this.bitBuffer.push(sdaBit);
        
        if (this.bitBuffer.length === 7) {
            // 收集完7位地址
            const address = this.bitBuffer.reduce((acc, bit, i) => acc | (bit << (6-i)), 0);
            
            // 等待R/W位
            const rwResult = this.wait({ 0: 'rising' });
            this.isWrite = rwResult.pins[1] === 0;
            
            const startSample = result.sampleNumber - 7;
            this.put(startSample, result.sampleNumber, {
                type: this.isWrite ? 'address-write' : 'address-read',
                values: [`Address: 0x${address.toString(16).toUpperCase()}`],
                rawData: address
            });
            
            this.state = 'ACK';
        }
    }
    
    // ... 其他状态处理方法
}
```

#### DecoderManager - 解码器管理系统
```typescript
class DecoderManager {
    private decoders = new Map<string, typeof DecoderBase>();
    
    constructor() {
        // 注册内置解码器
        this.registerDecoder('i2c', I2CDecoder);
        this.registerDecoder('spi', SPIDecoder);
        this.registerDecoder('uart', UARTDecoder);
        // ... 更多解码器
    }
    
    registerDecoder(id: string, decoderClass: typeof DecoderBase): void {
        this.decoders.set(id, decoderClass);
    }
    
    getAvailableDecoders(): DecoderInfo[] {
        return Array.from(this.decoders.entries()).map(([id, decoderClass]) => {
            const instance = new decoderClass();
            return {
                id: instance.id,
                name: instance.name,
                description: instance.desc,
                channels: instance.channels,
                options: instance.options
            };
        });
    }
    
    createDecoder(id: string): DecoderBase {
        const DecoderClass = this.decoders.get(id);
        if (!DecoderClass) {
            throw new Error(`Unknown decoder: ${id}`);
        }
        return new DecoderClass();
    }
}
```

## 状态管理设计 (Pinia Stores)

### Device Store
```typescript
export const useDeviceStore = defineStore('device', () => {
  const detectedDevices = ref<DetectedDevice[]>([]);
  const currentDevice = ref<AnalyzerDriverBase | null>(null);
  const isConnected = ref(false);
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  
  async function detectDevices() {
    const devices = await DeviceDetector.detect();
    detectedDevices.value = devices;
  }
  
  async function connect(deviceId: string) {
    let driver: AnalyzerDriverBase;
    
    switch (deviceId) {
      case 'autodetect':
        driver = await createAutoDetectedDriver();
        break;
      case 'network':
        driver = await createNetworkDriver();
        break;
      case 'multidevice':
        driver = await createMultiDeviceDriver();
        break;
      default:
        driver = new LogicAnalyzerDriver(deviceId);
    }
    
    currentDevice.value = driver;
    isConnected.value = true;
    connectionStatus.value = 'connected';
  }
  
  return {
    detectedDevices: readonly(detectedDevices),
    currentDevice: readonly(currentDevice),
    isConnected: readonly(isConnected),
    connectionStatus: readonly(connectionStatus),
    detectDevices,
    connect,
    disconnect
  };
});
```

### Capture Store
```typescript
export const useCaptureStore = defineStore('capture', () => {
  const channels = ref<AnalyzerChannel[]>([]);
  const captureSession = ref<CaptureSession | null>(null);
  const lastCaptureSession = ref<CaptureSession | null>(null);
  const isCapturing = ref(false);
  const captureProgress = ref(0);
  
  const totalSamples = computed(() => 
    captureSession.value ? 
    captureSession.value.preTriggerSamples + captureSession.value.postTriggerSamples : 0
  );
  
  async function startCapture(session?: CaptureSession) {
    const deviceStore = useDeviceStore();
    
    if (!deviceStore.currentDevice) {
      throw new Error('设备未连接');
    }
    
    const sessionToUse = session || captureSession.value;
    if (!sessionToUse) {
      throw new Error('采集配置不能为空');
    }
    
    isCapturing.value = true;
    captureProgress.value = 0;
    
    try {
      const result = await deviceStore.currentDevice.startCapture(sessionToUse);
      
      if (result === CaptureError.None) {
        channels.value = sessionToUse.captureChannels;
        lastCaptureSession.value = sessionToUse;
      } else {
        throw new Error(`采集失败: ${result}`);
      }
    } finally {
      isCapturing.value = false;
    }
  }
  
  return {
    channels: readonly(channels),
    captureSession,
    lastCaptureSession: readonly(lastCaptureSession),
    isCapturing: readonly(isCapturing),
    captureProgress: readonly(captureProgress),
    totalSamples,
    startCapture,
    stopCapture,
    updateCaptureSession
  };
});
```

## VSCode集成特性

### 自定义编辑器提供者
```typescript
export class LACEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new LACEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      LACEditorProvider.viewType, 
      provider
    );
    return providerRegistration;
  }
  
  private static readonly viewType = 'logicAnalyzer.lacEditor';
  
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 设置webview选项
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    
    // 设置HTML内容
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    
    // 处理来自webview的消息
    webviewPanel.webview.onDidReceiveMessage(e => {
      switch (e.type) {
        case 'save':
          this.saveLACFile(document, e.data);
          break;
        case 'export':
          this.exportData(e.data);
          break;
      }
    });
  }
}
```

## 技术实现细节

### 关键技术挑战和解决方案

#### 1. 高性能波形渲染

**挑战**: 处理大量数据点(数百万样本)的实时渲染，保持60fps的流畅体验。

**解决方案**:
- **Level of Detail (LOD)**: 根据缩放级别选择合适的数据密度
- **虚拟化渲染**: 只渲染可见区域的数据
- **Canvas图层分离**: 静态背景和动态前景分离渲染
- **Web Workers**: 后台处理避免阻塞UI线程

#### 2. 设备通信协议移植

**挑战**: 将C#的二进制通信协议准确移植到TypeScript/Node.js。

**解决方案**:
- 深入分析C#源码，建立完整的协议文档
- 使用Buffer类进行二进制数据处理
- 建立完整的测试用例验证协议一致性
- 分阶段验证功能，确保每个环节正确

#### 3. 实时数据流处理

**挑战**: 处理高速数据流，避免丢失数据和内存溢出。

**解决方案**:
- 使用循环缓冲区限制内存使用
- 异步处理数据避免阻塞主线程
- 实现背压机制控制数据流速
- 使用Web Workers进行数据处理

### 性能优化策略

#### 1. 渲染优化
- **Level of Detail (LOD)**: 根据缩放级别选择合适的数据密度
- **虚拟化滚动**: 只渲染可见区域的数据
- **Canvas图层分离**: 静态背景和动态前景分离渲染
- **RequestAnimationFrame**: 与浏览器刷新率同步

#### 2. 内存管理
- **对象池**: 重用频繁创建/销毁的对象
- **循环缓冲区**: 限制内存使用，避免无限增长
- **及时释放**: 主动释放不再使用的大对象
- **WeakMap/WeakSet**: 避免内存泄漏

#### 3. 数据处理优化
- **Web Workers**: 后台处理避免阻塞UI
- **Streaming处理**: 流式处理大数据集
- **数据压缩**: 减少内存占用和传输量
- **缓存策略**: 智能缓存计算结果

## 风险评估和缓解策略

### 技术风险

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| 设备通信协议移植困难 | 高 | 中 | 1. 深入分析C#源码<br>2. 建立完整的测试用例<br>3. 分阶段验证功能 |
| 波形渲染性能不足 | 高 | 中 | 1. 使用WebGL加速<br>2. 实现多级优化策略<br>3. 性能基准测试 |
| 协议解码器移植 | 中 | 中 | 1. ✅ **纯TypeScript方案** - 零依赖架构<br>2. 🚀 优先实现I2C、SPI、UART核心协议<br>3. 建立Python→TypeScript转换规范<br>4. 社区贡献机制逐步完善生态 |
| VSCode API限制 | 中 | 低 | 1. 充分研究VSCode API<br>2. 设计备选方案<br>3. 与VSCode团队沟通 |

### 项目风险

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|----------|
| 开发周期超预期 | 高 | 中 | 1. 细化任务分解<br>2. 定期进度检查<br>3. 适当调整功能范围 |
| 兼容性问题 | 中 | 中 | 1. 多平台测试<br>2. 版本兼容性策略<br>3. 回归测试套件 |
| 用户接受度低 | 低 | 低 | 1. 早期用户反馈<br>2. 迭代式开发<br>3. 用户体验测试 |

### 缓解措施

1. **技术原型验证**: 在正式开发前，针对关键技术难点开发原型
2. **增量开发**: 采用敏捷开发方法，快速迭代和反馈
3. **自动化测试**: 建立完整的测试体系，确保代码质量
4. **文档驱动**: 详细的技术文档和API规范
5. **社区支持**: 建立开发者社区，获得反馈和贡献

## 开发策略

### 推荐开发策略：分阶段验证开发

基于技术风险评估和项目复杂度，我们采用**混合开发策略**：先快速技术验证，再系统化开发。

#### 为什么采用这种策略？

1. **技术风险验证**: Vue3在VSCode Webview中的性能、Canvas大数据量渲染能力
2. **用户体验测试**: Element Plus组件适配性、界面布局合理性
3. **概念价值展示**: 让开发者和用户快速看到项目实际效果
4. **架构决策支持**: 基于实际测试结果优化技术选型和架构设计
5. **降低整体风险**: 避免22周开发后才发现不可行的技术障碍

### 开发计划概述

- **第零阶段 (第1-4周)**: 硬件生态技术验证原型
- **系统化开发阶段 (第5-26周)**: 基于验证结果的完整开发

详细的开发任务和里程碑请参考 [todo_list.md](./todo_list.md)

## 未来扩展规划 - 硬件生态优先策略

### 短期扩展 (6个月内) - 🚀 硬件生态为核心
1. **硬件生态扩展** ⭐⭐⭐: 
   - 支持10+主流逻辑分析器品牌
   - 建立驱动开发者社区和认证体系
   - 与硬件厂商建立官方合作关系
   - 创建驱动市场和分发平台
2. **第三方SDK完善**: 
   - 完整的驱动开发工具包
   - 自动化测试和验证工具
   - 详细的开发文档和示例
3. **更多协议解码器**: 扩展到50+种协议支持
4. **高级触发功能**: 复杂触发条件和序列触发

### 中期扩展 (1年内) - 🌟 生态成熟和智能化
1. **硬件生态成熟**: 
   - 支持20+种硬件，覆盖市场主流产品
   - 建立硬件兼容性标准和认证流程
   - 社区驱动贡献占比达到30%+
2. **AI辅助分析**: 智能信号识别和异常检测
3. **云端协作**: 数据分享和协作分析
4. **调试器集成**: 与VSCode调试器深度集成
5. **企业级功能**: 团队协作、权限管理、审计日志

### 长期规划 (2年内) - 🎯 行业标准和平台化
1. **行业标准制定**: 
   - 推动逻辑分析器硬件接口标准化
   - 建立通用的数据交换格式
   - 成为行业事实标准平台
2. **平台生态完善**:
   - 硬件厂商深度集成我们的SDK
   - 教育机构采用我们的平台
   - 企业级客户定制化解决方案
3. **技术创新突破**:
   - 实时调试: 与目标系统实时交互调试
   - 信号生成: 支持信号发生器功能
   - 混合现实: AR/VR信号分析界面

## 总结

本技术方案书详细分析了@logicanalyzer/Software的架构和功能，制定了**硬件生态优先**的VSCode插件开发战略。通过从设计阶段就构建开放、可扩展的硬件生态系统，我们将打造逻辑分析器领域的"通用平台"。

### 核心战略优势 🚀

#### 技术创新
1. **硬件抽象层 (HAL)**: 业界首个标准化的逻辑分析器硬件抽象层
2. **插件化驱动系统**: 动态加载、热插拔的驱动架构
3. **智能配置适配**: 自动处理不同硬件间的能力差异
4. **统一数据格式**: 打破厂商数据格式壁垒
5. **现代化界面**: Vue3 + Element Plus + VSCode深度集成

#### 市场定位优势
1. **vs 厂商软件**: **开放生态 vs 封闭绑定** - 用户可自由选择最适合的硬件
2. **vs sigrok**: **现代体验 vs 传统界面** - 提供专业级用户体验
3. **vs Saleae**: **多品牌支持 vs 单一品牌** - 降低用户硬件投资风险
4. **vs 其他工具**: **VSCode生态 vs 独立应用** - 无缝融入开发工作流

#### 生态建设优势
1. **网络效应**: 支持硬件越多 → 用户越多 → 吸引更多硬件厂商
2. **平台价值**: 成为行业标准平台，获得生态红利
3. **开发者友好**: 完整SDK + 详细文档 + 社区支持
4. **厂商合作**: 为硬件厂商提供统一软件平台，降低开发成本

### 预期成果 🎯

**技术成果**:
- 支持10+主流逻辑分析器品牌的统一平台
- 业界领先的硬件抽象层和驱动插件系统
- 高性能、现代化的信号分析界面
- 完整的第三方开发者生态

**商业价值**:
- 打破硬件厂商垄断，为用户提供选择自由
- 降低行业整体软件开发成本
- 建立逻辑分析器软件的行业标准
- 创造新的商业模式和收入来源

**战略意义**:
- 成为逻辑分析器领域的"Android"
- 推动行业向开放、标准化方向发展
- 为嵌入式开发者提供更强大、灵活的工具
- 建立可持续发展的技术生态系统

通过**4周硬件生态原型验证 + 22周系统开发**的策略，我们将交付一个**开放、兼容、生态丰富**的VSCode逻辑分析器平台，重新定义逻辑分析器软件的行业标准。

---

> **"我们不只是在开发一个VSCode插件，我们正在建立逻辑分析器领域的开放生态系统，让每一个硬件都能发挥最大价值，让每一个开发者都能享受最佳体验。"**