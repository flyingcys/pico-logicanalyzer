# Pico Logic Analyzer VSCode Extension 开发者指南

> **版本**: 1.0.0  
> **最后更新**: 2025年8月1日  
> **适用**: 开发者、贡献者、插件作者

---

## 📋 目录

1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [开发环境设置](#开发环境设置)
4. [API 参考](#api-参考)
5. [协议解码器开发](#协议解码器开发)
6. [硬件驱动开发](#硬件驱动开发)
7. [测试框架](#测试框架)
8. [扩展开发](#扩展开发)
9. [部署和发布](#部署和发布)
10. [贡献指南](#贡献指南)

---

## 🚀 项目概述

### 项目愿景

构建硬件生态优先的开放式逻辑分析器平台，成为逻辑分析器领域的"通用平台"。

### 核心目标

- **硬件兼容性**: 支持10+主流逻辑分析器硬件品牌
- **开放生态**: 提供统一的硬件抽象层和开发体验
- **开发者友好**: 建立第三方驱动开发者生态系统
- **用户选择自由**: 打破硬件厂商锁定

### 技术特色

- **纯TypeScript架构**: 避免多语言集成复杂性
- **零依赖协议解码**: 不依赖Python，完全TypeScript实现
- **统一数据格式**: 100%兼容原.lac格式
- **高性能渲染**: 支持100万数据点@60fps波形显示

---

## 🏗️ 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    VSCode Extension                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Webview   │  │  Commands   │  │  Providers  │         │
│  │   (Vue.js)  │  │  (Actions)  │  │ (LAC Files) │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Core Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Session Mgr  │  │Config Mgr   │  │Export Svc   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                  Protocol Decoders                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ I2C Decoder │  │ SPI Decoder │  │UART Decoder │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                 Hardware Abstraction Layer                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Driver Base  │  │Protocol Hdl │  │Connection   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Hardware Drivers                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Pico Driver │  │Network Drv  │  │ Serial Drv  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块

#### 1. 扩展主模块 (`src/extension.ts`)

```typescript
export class LogicAnalyzerExtension {
  private driverManager: HardwareDriverManager;
  private sessionManager: SessionManager;
  private configManager: ConfigurationManager;
  
  activate(context: vscode.ExtensionContext): void {
    // 注册命令、提供者、视图
    this.registerCommands();
    this.registerProviders();
    this.initializeServices();
  }
}
```

#### 2. 硬件驱动管理器 (`src/drivers/HardwareDriverManager.ts`)

```typescript
export class HardwareDriverManager {
  private drivers: Map<string, ILogicAnalyzer> = new Map();
  
  async registerDriver(id: string, driver: ILogicAnalyzer): Promise<void>;
  async connectDevice(deviceId: string): Promise<DeviceInfo>;
  async startCapture(config: CaptureConfiguration): Promise<CaptureResult>;
}
```

#### 3. 协议解码器注册表 (`src/decoders/DecoderRegistry.ts`)

```typescript
export class DecoderRegistry {
  private decoders: Map<string, DecoderConstructor> = new Map();
  
  registerDecoder(id: string, decoder: DecoderConstructor): void;
  createDecoder(id: string, options: any): DecoderBase;
  getAvailableDecoders(): DecoderInfo[];
}
```

### 数据流

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Hardware  │ -> │   Driver    │ -> │  Unified    │
│   Device    │    │   Layer     │    │  Data       │
└─────────────┘    └─────────────┘    └─────────────┘
                                               │
                                               v
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Webview   │ <- │  Protocol   │ <- │   Session   │
│  Renderer   │    │  Decoders   │    │  Manager    │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## 🛠️ 开发环境设置

### 系统要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| **Node.js** | 16.x | 18.x+ |
| **npm** | 8.x | 9.x+ |
| **VSCode** | 1.80+ | 1.85+ |
| **TypeScript** | 4.9+ | 5.0+ |

### 环境搭建

#### 1. 克隆项目

```bash
git clone https://github.com/pico-logic-analyzer/vscode-extension.git
cd vscode-extension
```

#### 2. 安装依赖

```bash
# 安装主依赖
npm install

# 安装开发依赖
npm install --save-dev @types/vscode @types/node

# 全局安装工具
npm install -g vsce
```

#### 3. 开发配置

```bash
# 复制开发配置模板
cp .env.example .env

# 编辑配置文件
code .env
```

`.env` 文件内容：

```env
# 开发环境配置
NODE_ENV=development
DEBUG_MODE=true
LOG_LEVEL=debug

# 硬件配置
DEFAULT_SERIAL_PORT=COM3
ENABLE_NETWORK_DISCOVERY=true
MOCK_HARDWARE=true

# 性能配置
MAX_SAMPLE_RATE=100000000
DEFAULT_BUFFER_SIZE=1048576
```

#### 4. 构建项目

```bash
# 开发构建 (watch模式)
npm run dev

# 生产构建
npm run build

# 清理构建文件
npm run clean
```

#### 5. 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "I2C Decoder"

# 生成覆盖率报告
npm run test:coverage
```

### 开发工具配置

#### VSCode 设置

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "eslint.workingDirectories": ["./"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.associations": {
    "*.lac": "json"
  }
}
```

#### 调试配置 (`.vscode/launch.json`)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${workspaceFolder}/npm: compile"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/tests"
      ],
      "outFiles": ["${workspaceFolder}/out/tests/**/*.js"],
      "preLaunchTask": "${workspaceFolder}/npm: compile"
    }
  ]
}
```

---

## 📚 API 参考

### 核心接口

#### ILogicAnalyzer

所有硬件驱动必须实现的基础接口：

```typescript
interface ILogicAnalyzer {
  readonly deviceInfo: DeviceInfo;
  readonly capabilities: HardwareCapabilities;
  readonly connectionStatus: ConnectionStatus;
  
  // 生命周期方法
  connect(params: ConnectionParams): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  
  // 采集控制
  startCapture(config: CaptureConfiguration): Promise<CaptureResult>;
  stopCapture(): Promise<void>;
  
  // 事件系统
  on(event: 'data' | 'error' | 'status', callback: Function): void;
  off(event: string, callback: Function): void;
  
  // 状态查询
  getStatus(): DeviceStatus;
  getSupportedModes(): CaptureMode[];
}
```

#### DecoderBase

所有协议解码器的基类：

```typescript
abstract class DecoderBase {
  // 解码器元数据
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly channels: DecoderChannel[];
  abstract readonly options: DecoderOption[];
  
  // 解码方法
  abstract decode(
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: DecoderOptionValue[]
  ): Promise<DecoderResult[]>;
  
  // 辅助方法
  protected wait(condition: WaitCondition): WaitResult;
  protected put(startSample: number, endSample: number, data: any): void;
  protected reset(): void;
}
```

### 数据类型

#### DeviceInfo

```typescript
interface DeviceInfo {
  name: string;
  version: string;
  channels: number;
  maxSampleRate: number;
  bufferSize: number;
  supportedModes: string[];
  firmwareVersion: string;
  hardwareRevision: string;
}
```

#### CaptureConfiguration

```typescript
interface CaptureConfiguration {
  sampleRate: number;
  totalSamples: number;
  triggerType: TriggerType;
  triggerChannel?: number;
  triggerValue?: number;
  captureChannels: AnalyzerChannel[];
  captureMode: CaptureMode;
}
```

#### UnifiedCaptureData

```typescript
interface UnifiedCaptureData {
  metadata: {
    deviceInfo: DeviceInfo;
    sampleRate: number;
    totalSamples: number;
    triggerPosition?: number;
    timestamp: string;
  };
  
  channels: ChannelInfo[];
  
  samples: {
    digital: {
      data: Uint8Array[];
      encoding: 'binary' | 'rle';
    };
  };
  
  quality: {
    lostSamples: number;
    errorRate: number;
    signalQuality: number;
  };
}
```

### 服务接口

#### SessionManager

```typescript
class SessionManager {
  // 会话管理
  createSession(config: SessionConfig): Promise<Session>;
  getActiveSession(): Session | null;
  closeSession(sessionId: string): Promise<void>;
  
  // 数据管理
  saveData(sessionId: string, data: UnifiedCaptureData): Promise<string>;
  loadData(filePath: string): Promise<UnifiedCaptureData>;
  
  // 历史记录
  getSessionHistory(): SessionInfo[];
  clearHistory(before?: Date): Promise<void>;
}
```

#### ConfigurationManager

```typescript
class ConfigurationManager {
  // 配置管理
  getConfiguration<T>(section: string): T;
  updateConfiguration(section: string, values: any): Promise<void>;
  
  // 预设管理
  savePreset(name: string, config: any): Promise<void>;
  loadPreset(name: string): Promise<any>;
  getPresets(): PresetInfo[];
  
  // 设备配置
  getDeviceConfig(deviceId: string): DeviceConfig;
  updateDeviceConfig(deviceId: string, config: DeviceConfig): Promise<void>;
}
```

#### DataExportService

```typescript
class DataExportService {
  // 导出方法
  exportToLAC(data: UnifiedCaptureData, filePath: string): Promise<void>;
  exportToCSV(data: UnifiedCaptureData, filePath: string, options: CSVOptions): Promise<void>;
  exportToVCD(data: UnifiedCaptureData, filePath: string, options: VCDOptions): Promise<void>;
  exportToJSON(data: UnifiedCaptureData, filePath: string): Promise<void>;
  
  // 批量导出
  batchExport(inputs: string[], outputDir: string, format: ExportFormat): Promise<ExportResult[]>;
  
  // 导出配置
  getExportFormats(): ExportFormat[];
  validateExportOptions(format: string, options: any): ValidationResult;
}
```

---

## 🔌 协议解码器开发

### 基础概念

协议解码器将原始的数字信号转换为协议级别的信息。每个解码器都是一个独立的TypeScript类，继承自`DecoderBase`。

### 创建新解码器

#### 1. 解码器基本结构

```typescript
// src/decoders/protocols/MyProtocol.ts

import { DecoderBase, DecoderResult, WaitCondition } from '../DecoderBase';
import { AnalyzerChannel, DecoderChannel, DecoderOption } from '../../models/AnalyzerTypes';

export class MyProtocolDecoder extends DecoderBase {
  readonly id = 'my-protocol';
  readonly name = 'My Protocol';
  readonly description = 'Custom protocol decoder for my specific use case';
  
  readonly channels: DecoderChannel[] = [
    {
      id: 'data',
      name: 'Data Line',
      description: 'Main data transmission line',
      required: true,
      defaultChannel: 0
    },
    {
      id: 'clock',
      name: 'Clock Line', 
      description: 'Clock signal',
      required: true,
      defaultChannel: 1
    }
  ];
  
  readonly options: DecoderOption[] = [
    {
      id: 'frequency',
      name: 'Clock Frequency',
      description: 'Expected clock frequency in Hz',
      type: 'number',
      defaultValue: 1000000,
      minimum: 1000,
      maximum: 100000000
    },
    {
      id: 'bitOrder',
      name: 'Bit Order',
      description: 'Bit transmission order',
      type: 'select',
      defaultValue: 'msb',
      options: [
        { value: 'msb', label: 'MSB First' },
        { value: 'lsb', label: 'LSB First' }
      ]
    }
  ];

  async decode(
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: any[]
  ): Promise<DecoderResult[]> {
    const results: DecoderResult[] = [];
    
    // 获取通道和选项
    const dataChannel = this.getChannel('data', channels);
    const clockChannel = this.getChannel('clock', channels);
    const frequency = this.getOption('frequency', options);
    const bitOrder = this.getOption('bitOrder', options);
    
    // 主解码循环
    this.reset();
    
    while (true) {
      try {
        // 等待时钟上升沿
        const clockEdge = this.wait({
          channel: clockChannel,
          edge: 'rising'
        });
        
        if (!clockEdge.matched) break;
        
        // 读取数据位
        const dataBit = this.sampleAt(dataChannel, clockEdge.sample);
        
        // 处理协议逻辑
        const protocolData = this.processProtocolData(dataBit, bitOrder);
        
        // 输出解码结果
        if (protocolData) {
          results.push({
            startSample: clockEdge.sample,
            endSample: clockEdge.sample + 1,
            type: 'data',
            data: protocolData,
            annotation: this.formatAnnotation(protocolData)
          });
        }
        
      } catch (error) {
        // 错误处理
        results.push({
          startSample: this.currentSample,
          endSample: this.currentSample + 1,
          type: 'error',
          data: { error: error.message },
          annotation: `Error: ${error.message}`
        });
        break;
      }
    }
    
    return results;
  }
  
  private processProtocolData(bit: number, bitOrder: string): any {
    // 实现具体的协议逻辑
    // ...
  }
  
  private formatAnnotation(data: any): string {
    // 格式化显示文本
    return `Data: ${data.value}`;
  }
}
```

#### 2. 注册解码器

```typescript
// src/decoders/index.ts

import { DecoderRegistry } from './DecoderRegistry';
import { MyProtocolDecoder } from './protocols/MyProtocol';

export function registerDecoders(registry: DecoderRegistry): void {
  registry.registerDecoder('my-protocol', MyProtocolDecoder);
}
```

### 解码器 API

#### 等待条件 (`wait` 方法)

```typescript
// 等待边沿
const edge = this.wait({
  channel: clockChannel,
  edge: 'rising'  // 'rising' | 'falling' | 'either'
});

// 等待电平
const level = this.wait({
  channel: dataChannel,
  level: 1  // 0 | 1
});

// 等待模式
const pattern = this.wait({
  channels: [ch0, ch1, ch2, ch3],
  pattern: 0b1010,  // 二进制模式
  mask: 0b1111      // 关心的位
});

// 超时等待
const timeout = this.wait({
  channel: clockChannel,
  edge: 'rising',
  timeout: 1000  // 最大等待样本数
});
```

#### 数据采样

```typescript
// 采样单个通道
const bit = this.sampleAt(channel, sampleIndex);

// 采样多个通道
const bits = this.sampleMultiple([ch0, ch1, ch2], sampleIndex);

// 获取当前样本
const currentBit = this.currentSample(channel);
```

#### 输出结果 (`put` 方法)

```typescript
// 输出基本结果
this.put(startSample, endSample, {
  type: 'start',
  annotation: 'START'
});

// 输出数据
this.put(startSample, endSample, {
  type: 'data',
  value: 0x42,
  annotation: 'Data: 0x42'
});

// 输出错误
this.put(startSample, endSample, {
  type: 'error',
  message: 'Invalid checksum',
  annotation: 'ERROR'
});
```

### 高级特性

#### 状态机解码

```typescript
enum ProtocolState {
  IDLE,
  START,
  ADDRESS,
  DATA,
  STOP
}

class StateMachineDecoder extends DecoderBase {
  private state: ProtocolState = ProtocolState.IDLE;
  private bitCounter: number = 0;
  private currentByte: number = 0;
  
  async decode(/* ... */): Promise<DecoderResult[]> {
    while (true) {
      switch (this.state) {
        case ProtocolState.IDLE:
          this.handleIdleState();
          break;
          
        case ProtocolState.START:
          this.handleStartState();
          break;
          
        // ... 其他状态
      }
    }
  }
  
  private handleIdleState(): void {
    const edge = this.wait({
      channel: this.dataChannel,
      edge: 'falling'
    });
    
    if (edge.matched) {
      this.state = ProtocolState.START;
      this.put(edge.sample, edge.sample, {
        type: 'start',
        annotation: 'START'
      });
    }
  }
}
```

#### 流式解码

```typescript
class StreamingDecoder extends DecoderBase {
  private buffer: number[] = [];
  private processedSamples: number = 0;
  
  async decode(/* ... */): Promise<DecoderResult[]> {
    const results: DecoderResult[] = [];
    
    // 流式处理数据块
    const chunkSize = 10000;
    
    while (this.hasMoreData()) {
      const chunk = this.getNextChunk(chunkSize);
      const chunkResults = this.processChunk(chunk);
      results.push(...chunkResults);
      
      this.processedSamples += chunkSize;
      
      // 定期清理缓冲区
      if (this.processedSamples % 100000 === 0) {
        this.cleanupBuffer();
      }
    }
    
    return results;
  }
}
```

### 测试解码器

#### 单元测试

```typescript
// tests/decoders/MyProtocol.test.ts

import { MyProtocolDecoder } from '../../src/decoders/protocols/MyProtocol';
import { TestDataGenerator } from '../utils/TestDataGenerator';

describe('MyProtocolDecoder', () => {
  let decoder: MyProtocolDecoder;
  let testData: TestDataGenerator;
  
  beforeEach(() => {
    decoder = new MyProtocolDecoder();
    testData = new TestDataGenerator();
  });
  
  it('should decode basic protocol transaction', async () => {
    // 生成测试数据
    const data = testData.generateProtocolData({
      protocol: 'my-protocol',
      transactions: [
        { type: 'start' },
        { type: 'data', value: 0x42 },
        { type: 'stop' }
      ]
    });
    
    // 执行解码
    const results = await decoder.decode(
      25000000, // 采样率
      data.channels,
      [{ id: 'frequency', value: 1000000 }]
    );
    
    // 验证结果
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('start');
    expect(results[1].type).toBe('data');
    expect(results[1].data.value).toBe(0x42);
    expect(results[2].type).toBe('stop');
  });
  
  it('should handle corrupted data gracefully', async () => {
    const corruptedData = testData.generateCorruptedData();
    
    const results = await decoder.decode(25000000, corruptedData.channels, []);
    
    // 应该包含错误信息
    const errors = results.filter(r => r.type === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

---

## 🚗 硬件驱动开发

### 驱动架构

硬件驱动负责与实际的逻辑分析器设备通信，将设备特定的接口抽象为统一的API。

#### 驱动基类

```typescript
// src/drivers/AnalyzerDriverBase.ts

export abstract class AnalyzerDriverBase implements ILogicAnalyzer {
  protected eventEmitter = new EventEmitter();
  protected connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  
  abstract readonly deviceInfo: DeviceInfo;
  abstract readonly capabilities: HardwareCapabilities;
  
  // 连接管理
  abstract connect(params: ConnectionParams): Promise<ConnectionResult>;
  abstract disconnect(): Promise<void>;
  
  // 采集控制
  abstract startCapture(config: CaptureConfiguration): Promise<CaptureResult>;
  abstract stopCapture(): Promise<void>;
  
  // 事件系统
  on(event: string, callback: Function): void {
    this.eventEmitter.on(event, callback);
  }
  
  off(event: string, callback: Function): void {
    this.eventEmitter.off(event, callback);
  }
  
  protected emit(event: string, ...args: any[]): void {
    this.eventEmitter.emit(event, ...args);
  }
  
  // 实用方法
  protected validateConfiguration(config: CaptureConfiguration): ValidationResult {
    // 验证配置参数
  }
  
  protected convertToUnifiedFormat(rawData: any): UnifiedCaptureData {
    // 转换为统一数据格式
  }
}
```

### 创建新驱动

#### 1. 串口驱动示例

```typescript
// src/drivers/MySerialDriver.ts

import { AnalyzerDriverBase } from './AnalyzerDriverBase';
import { SerialPort } from 'serialport';

export class MySerialDriver extends AnalyzerDriverBase {
  private serialPort?: SerialPort;
  private isCapturing: boolean = false;
  
  readonly deviceInfo: DeviceInfo = {
    name: 'My Serial Logic Analyzer',
    version: '1.0.0',
    channels: 16,
    maxSampleRate: 50000000,
    bufferSize: 512 * 1024,
    supportedModes: ['Normal', 'Fast'],
    firmwareVersion: '1.0.0',
    hardwareRevision: 'Rev A'
  };
  
  readonly capabilities: HardwareCapabilities = {
    channels: {
      digital: 16,
      maxVoltage: 5.0,
      minVoltage: 0.0
    },
    sampling: {
      maxRate: 50000000,
      supportedRates: [1000000, 5000000, 10000000, 25000000, 50000000],
      bufferSize: 512 * 1024
    },
    triggers: {
      types: [TriggerType.Edge, TriggerType.Pattern],
      maxChannels: 4
    }
  };
  
  async connect(params: ConnectionParams): Promise<ConnectionResult> {
    try {
      this.serialPort = new SerialPort({
        path: params.port,
        baudRate: 921600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1
      });
      
      await this.waitForOpen();
      
      // 发送识别命令
      const deviceId = await this.sendCommand('*IDN?');
      
      if (!deviceId.includes('My Logic Analyzer')) {
        throw new Error('设备识别失败');
      }
      
      this.connectionStatus = ConnectionStatus.Connected;
      this.emit('connected', this.deviceInfo);
      
      return {
        success: true,
        deviceInfo: this.deviceInfo
      };
      
    } catch (error) {
      this.connectionStatus = ConnectionStatus.Error;
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this.isCapturing) {
      await this.stopCapture();
    }
    
    if (this.serialPort?.isOpen) {
      this.serialPort.close();
    }
    
    this.connectionStatus = ConnectionStatus.Disconnected;
    this.emit('disconnected');
  }
  
  async startCapture(config: CaptureConfiguration): Promise<CaptureResult> {
    if (this.connectionStatus !== ConnectionStatus.Connected) {
      throw new Error('设备未连接');
    }
    
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    
    try {
      // 配置采集参数
      await this.sendCommand(`SRATE ${config.sampleRate}`);
      await this.sendCommand(`SAMPLES ${config.totalSamples}`);
      await this.sendCommand(`CHANNELS ${this.formatChannelMask(config.captureChannels)}`);
      
      // 配置触发
      if (config.triggerType !== TriggerType.None) {
        await this.configureTrigger(config);
      }
      
      // 开始采集
      this.isCapturing = true;
      await this.sendCommand('START');
      
      this.emit('captureStarted');
      
      // 等待采集完成
      const rawData = await this.waitForCaptureComplete();
      
      // 转换为统一格式
      const unifiedData = this.convertToUnifiedFormat(rawData);
      
      this.isCapturing = false;
      this.emit('captureCompleted', unifiedData);
      
      return {
        success: true,
        data: unifiedData
      };
      
    } catch (error) {
      this.isCapturing = false;
      this.emit('error', error);
      throw error;
    }
  }
  
  async stopCapture(): Promise<void> {
    if (!this.isCapturing) return;
    
    await this.sendCommand('STOP');
    this.isCapturing = false;
    this.emit('captureStopped');
  }
  
  getStatus(): DeviceStatus {
    return {
      connected: this.connectionStatus === ConnectionStatus.Connected,
      capturing: this.isCapturing,
      lastError: null
    };
  }
  
  getSupportedModes(): CaptureMode[] {
    return [
      CaptureMode.Normal,
      CaptureMode.Fast
    ];
  }
  
  // 私有辅助方法
  
  private async sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.serialPort?.isOpen) {
        reject(new Error('串口未打开'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('命令超时'));
      }, 5000);
      
      this.serialPort.once('data', (data) => {
        clearTimeout(timeout);
        resolve(data.toString().trim());
      });
      
      this.serialPort.write(command + '\r\n');
    });
  }
  
  private async waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.serialPort!.isOpen) {
        resolve();
        return;
      }
      
      this.serialPort!.once('open', resolve);
      this.serialPort!.once('error', reject);
    });
  }
  
  private formatChannelMask(channels: AnalyzerChannel[]): string {
    let mask = 0;
    channels.forEach(ch => {
      if (ch.enabled) {
        mask |= (1 << ch.channelIndex);
      }
    });
    return `0x${mask.toString(16).toUpperCase()}`;
  }
  
  private async configureTrigger(config: CaptureConfiguration): Promise<void> {
    switch (config.triggerType) {
      case TriggerType.Edge:
        await this.sendCommand(`TRIGGER EDGE ${config.triggerChannel} ${config.triggerValue ? 'RISING' : 'FALLING'}`);
        break;
        
      case TriggerType.Pattern:
        await this.sendCommand(`TRIGGER PATTERN 0x${config.triggerValue?.toString(16)}`);
        break;
        
      default:
        await this.sendCommand('TRIGGER NONE');
    }
  }
  
  private async waitForCaptureComplete(): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let expectedLength = 0;
      let headerReceived = false;
      
      const timeout = setTimeout(() => {
        reject(new Error('采集超时'));
      }, 30000);
      
      this.serialPort!.on('data', (chunk: Buffer) => {
        if (!headerReceived) {
          // 解析数据头
          const header = chunk.slice(0, 8);
          expectedLength = header.readUInt32LE(4);
          headerReceived = true;
          
          if (chunk.length > 8) {
            chunks.push(chunk.slice(8));
          }
        } else {
          chunks.push(chunk);
        }
        
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        
        if (totalLength >= expectedLength) {
          clearTimeout(timeout);
          const result = Buffer.concat(chunks);
          resolve(new Uint8Array(result.slice(0, expectedLength)));
        }
      });
    });
  }
}
```

#### 2. 网络驱动示例

```typescript
// src/drivers/MyNetworkDriver.ts

import { AnalyzerDriverBase } from './AnalyzerDriverBase';
import * as net from 'net';

export class MyNetworkDriver extends AnalyzerDriverBase {
  private socket?: net.Socket;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  
  async connect(params: ConnectionParams): Promise<ConnectionResult> {
    try {
      this.socket = new net.Socket();
      
      // 设置连接超时
      this.socket.setTimeout(10000);
      
      // 连接到设备
      await this.connectSocket(params.host, params.port);
      
      // 执行设备握手
      await this.performHandshake();
      
      this.connectionStatus = ConnectionStatus.Connected;
      this.setupSocketHandlers();
      
      return {
        success: true,
        deviceInfo: this.deviceInfo
      };
      
    } catch (error) {
      this.connectionStatus = ConnectionStatus.Error;
      throw error;
    }
  }
  
  private async connectSocket(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket!.connect(port, host, () => {
        resolve();
      });
      
      this.socket!.on('error', reject);
    });
  }
  
  private setupSocketHandlers(): void {
    this.socket!.on('close', () => {
      this.connectionStatus = ConnectionStatus.Disconnected;
      this.emit('disconnected');
      
      // 自动重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.attemptReconnect(), 5000);
      }
    });
    
    this.socket!.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  private async attemptReconnect(): Promise<void> {
    try {
      this.emit('reconnecting', this.reconnectAttempts);
      // 重连逻辑
    } catch (error) {
      this.emit('reconnectFailed', error);
    }
  }
}
```

### 驱动注册

```typescript
// src/drivers/index.ts

import { HardwareDriverManager } from './HardwareDriverManager';
import { MySerialDriver } from './MySerialDriver';
import { MyNetworkDriver } from './MyNetworkDriver';

export function registerDrivers(manager: HardwareDriverManager): void {
  manager.registerDriver('my-serial', MySerialDriver);
  manager.registerDriver('my-network', MyNetworkDriver);
}
```

### 驱动测试

```typescript
// tests/drivers/MySerialDriver.test.ts

import { MySerialDriver } from '../../src/drivers/MySerialDriver';
import { MockSerialPort } from '../mocks/MockSerialPort';

describe('MySerialDriver', () => {
  let driver: MySerialDriver;
  let mockPort: MockSerialPort;
  
  beforeEach(() => {
    mockPort = new MockSerialPort();
    driver = new MySerialDriver();
    // 注入模拟串口
    (driver as any).createSerialPort = () => mockPort;
  });
  
  it('should connect successfully', async () => {
    mockPort.mockResponse('*IDN?', 'My Logic Analyzer v1.0.0');
    
    const result = await driver.connect({ port: 'COM3' });
    
    expect(result.success).toBe(true);
    expect(result.deviceInfo.name).toBe('My Serial Logic Analyzer');
  });
  
  it('should perform data capture', async () => {
    await driver.connect({ port: 'COM3' });
    
    // 模拟采集数据
    mockPort.mockCaptureData(generateTestData(1000));
    
    const config = createTestConfiguration();
    const result = await driver.startCapture(config);
    
    expect(result.success).toBe(true);
    expect(result.data.samples.digital.data).toBeDefined();
  });
});
```

---

## 🧪 测试框架

### 测试架构

项目采用分层测试策略：

```
┌─────────────────────────────────────────┐
│              E2E Tests                  │  ← 端到端测试
├─────────────────────────────────────────┤
│          Integration Tests              │  ← 集成测试
├─────────────────────────────────────────┤
│            Unit Tests                   │  ← 单元测试
└─────────────────────────────────────────┘
```

### 单元测试

#### 测试设置

```typescript
// tests/setup.ts

import { configure } from '@testing-library/jest-dom';
import { vi } from 'vitest';

// 全局测试配置
configure({ 
  testIdAttribute: 'data-test-id' 
});

// Mock VSCode API
global.vscode = {
  commands: {
    registerCommand: vi.fn(),
    executeCommand: vi.fn()
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createWebviewPanel: vi.fn()
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn()
    }))
  }
};
```

#### 测试实用工具

```typescript
// tests/utils/TestDataGenerator.ts

export class TestDataGenerator {
  /**
   * 生成I2C协议测试数据
   */
  generateI2CData(config: {
    address: number;
    data: number[];
    frequency?: number;
  }): { channels: AnalyzerChannel[]; samples: Uint8Array[] } {
    const frequency = config.frequency || 100000;
    const samplesPerBit = Math.floor(25000000 / frequency);
    
    const channels = [
      { channelIndex: 0, name: 'SDA', enabled: true },
      { channelIndex: 1, name: 'SCL', enabled: true }
    ];
    
    const samples = this.generateI2CTransaction(
      config.address,
      config.data,
      samplesPerBit
    );
    
    return { channels, samples };
  }
  
  /**
   * 生成SPI协议测试数据
   */
  generateSPIData(config: {
    mode: number;
    data: number[];
    frequency?: number;
  }): { channels: AnalyzerChannel[]; samples: Uint8Array[] } {
    // SPI数据生成逻辑
  }
  
  /**
   * 生成随机噪声数据
   */
  generateNoiseData(sampleCount: number, channelCount: number): Uint8Array[] {
    const samples: Uint8Array[] = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const sample = new Uint8Array(Math.ceil(channelCount / 8));
      
      for (let j = 0; j < sample.length; j++) {
        sample[j] = Math.random() * 256;
      }
      
      samples.push(sample);
    }
    
    return samples;
  }
}
```

#### 模拟对象

```typescript
// tests/mocks/MockLogicAnalyzer.ts

export class MockLogicAnalyzer implements ILogicAnalyzer {
  private connected: boolean = false;
  private capturing: boolean = false;
  
  readonly deviceInfo: DeviceInfo = {
    name: 'Mock Logic Analyzer',
    version: '1.0.0-test',
    channels: 8,
    maxSampleRate: 100000000,
    bufferSize: 1024 * 1024,
    supportedModes: ['Normal', 'Fast'],
    firmwareVersion: '1.0.0',
    hardwareRevision: 'Mock'
  };
  
  readonly capabilities: HardwareCapabilities = {
    channels: { digital: 8, maxVoltage: 5.0 },
    sampling: { 
      maxRate: 100000000,
      supportedRates: [1000000, 10000000, 100000000],
      bufferSize: 1024 * 1024
    },
    triggers: {
      types: [TriggerType.Edge, TriggerType.Pattern],
      maxChannels: 4
    }
  };
  
  connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  
  // 模拟数据和行为
  mockCaptureData?: UnifiedCaptureData;
  mockError?: Error;
  mockDelay: number = 0;
  
  async connect(params: ConnectionParams): Promise<ConnectionResult> {
    if (this.mockError) throw this.mockError;
    
    await this.delay(this.mockDelay);
    
    this.connected = true;
    this.connectionStatus = ConnectionStatus.Connected;
    
    return {
      success: true,
      deviceInfo: this.deviceInfo
    };
  }
  
  async startCapture(config: CaptureConfiguration): Promise<CaptureResult> {
    if (!this.connected) {
      throw new Error('设备未连接');
    }
    
    if (this.mockError) throw this.mockError;
    
    this.capturing = true;
    
    // 模拟采集延迟
    await this.delay(this.mockDelay);
    
    this.capturing = false;
    
    const data = this.mockCaptureData || this.generateMockData(config);
    
    return {
      success: true,
      data
    };
  }
  
  private generateMockData(config: CaptureConfiguration): UnifiedCaptureData {
    // 生成模拟采集数据
    const testGen = new TestDataGenerator();
    return testGen.generateI2CData({
      address: 0x50,
      data: [0x42, 0x55, 0xAA]
    });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 其他必需方法的模拟实现...
}
```

### 集成测试

#### 组件集成测试

```typescript
// tests/integration/DriverManagerIntegration.test.ts

describe('HardwareDriverManager Integration', () => {
  let manager: HardwareDriverManager;
  let mockDriver: MockLogicAnalyzer;
  
  beforeEach(async () => {
    manager = new HardwareDriverManager();
    mockDriver = new MockLogicAnalyzer();
    
    await manager.registerDriver('mock', () => mockDriver);
  });
  
  it('should perform complete capture workflow', async () => {
    // 连接设备
    const connectionResult = await manager.connectDevice('mock');
    expect(connectionResult.success).toBe(true);
    
    // 配置采集
    const config: CaptureConfiguration = {
      sampleRate: 25000000,
      totalSamples: 10000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      captureChannels: [
        { channelIndex: 0, name: 'SDA', enabled: true },
        { channelIndex: 1, name: 'SCL', enabled: true }
      ],
      captureMode: CaptureMode.Normal
    };
    
    // 开始采集
    const captureResult = await manager.startCapture(config);
    expect(captureResult.success).toBe(true);
    expect(captureResult.data).toBeDefined();
    
    // 验证数据格式
    const data = captureResult.data;
    expect(data.metadata.sampleRate).toBe(25000000);
    expect(data.samples.digital.data).toHaveLength(10000);
  });
  
  it('should handle device disconnection gracefully', async () => {
    await manager.connectDevice('mock');
    
    // 模拟设备断开
    mockDriver.connectionStatus = ConnectionStatus.Disconnected;
    
    const status = manager.getDeviceStatus('mock');
    expect(status.connected).toBe(false);
    
    // 尝试采集应该失败
    const config = createTestConfiguration();
    await expect(manager.startCapture(config)).rejects.toThrow('设备未连接');
  });
});
```

#### 协议解码集成测试

```typescript
// tests/integration/ProtocolDecodingIntegration.test.ts

describe('Protocol Decoding Integration', () => {
  let decoderRegistry: DecoderRegistry;
  let testData: TestDataGenerator;
  
  beforeEach(() => {
    decoderRegistry = new DecoderRegistry();
    testData = new TestDataGenerator();
    
    // 注册所有解码器
    registerDecoders(decoderRegistry);
  });
  
  it('should decode I2C protocol end-to-end', async () => {
    // 生成真实的I2C信号数据
    const signalData = testData.generateI2CData({
      address: 0x50,
      data: [0x42, 0x55, 0xAA],
      frequency: 100000
    });
    
    // 创建I2C解码器
    const decoder = decoderRegistry.createDecoder('i2c', {
      addressFormat: 'shifted',
      showAck: true
    });
    
    // 执行解码
    const results = await decoder.decode(
      25000000,
      signalData.channels,
      []
    );
    
    // 验证解码结果
    expect(results).toHaveLength(8); // START + ADDR + ACK + 3×(DATA + ACK) + STOP
    
    expect(results[0].type).toBe('start');
    expect(results[1].type).toBe('address');
    expect(results[1].data.address).toBe(0x50);
    expect(results[1].data.read).toBe(false);
    
    expect(results[3].type).toBe('data');
    expect(results[3].data.value).toBe(0x42);
    
    expect(results[7].type).toBe('stop');
  });
  
  it('should handle multiple protocol decoders simultaneously', async () => {
    // 生成包含I2C和SPI信号的复合数据
    const i2cData = testData.generateI2CData({
      address: 0x50,
      data: [0x42]
    });
    
    const spiData = testData.generateSPIData({
      mode: 0,
      data: [0x55, 0xAA]
    });
    
    // 合并通道数据
    const combinedChannels = [...i2cData.channels, ...spiData.channels];
    
    // 同时运行两个解码器
    const i2cDecoder = decoderRegistry.createDecoder('i2c', {});
    const spiDecoder = decoderRegistry.createDecoder('spi', { mode: 0 });
    
    const [i2cResults, spiResults] = await Promise.all([
      i2cDecoder.decode(25000000, i2cData.channels, []),
      spiDecoder.decode(25000000, spiData.channels, [])
    ]);
    
    expect(i2cResults.length).toBeGreaterThan(0);
    expect(spiResults.length).toBeGreaterThan(0);
  });
});
```

### 性能测试

```typescript
// tests/performance/DecoderPerformance.test.ts

describe('Decoder Performance', () => {
  const PERFORMANCE_THRESHOLDS = {
    decoding100K: 1000,    // 10万样本解码应在1秒内完成
    decoding1M: 5000,      // 100万样本解码应在5秒内完成
    memoryUsage: 100 * 1024 * 1024, // 内存使用不超过100MB
  };
  
  it('should decode 100K I2C samples within time limit', async () => {
    const testData = new TestDataGenerator();
    const largeData = testData.generateI2CData({
      address: 0x50,
      data: Array.from({ length: 10000 }, () => Math.floor(Math.random() * 256))
    });
    
    const decoder = new I2CDecoder();
    
    const startTime = performance.now();
    const results = await decoder.decode(25000000, largeData.channels, []);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.decoding100K);
    expect(results.length).toBeGreaterThan(0);
  });
  
  it('should not exceed memory threshold during large decode', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 生成大量数据
    const testData = new TestDataGenerator();
    const massiveData = testData.generateLargeDataSet(1000000, 8);
    
    const decoder = new I2CDecoder();
    await decoder.decode(25000000, massiveData.channels, []);
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryDelta = finalMemory - initialMemory;
    
    expect(memoryDelta).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage);
  });
});
```

### 端到端测试

```typescript
// tests/e2e/FullWorkflow.test.ts

describe('Complete Workflow E2E', () => {
  let extension: LogicAnalyzerExtension;
  let testContext: vscode.ExtensionContext;
  
  beforeAll(async () => {
    testContext = createMockExtensionContext();
    extension = new LogicAnalyzerExtension();
    await extension.activate(testContext);
  });
  
  afterAll(async () => {
    await extension.deactivate();
  });
  
  it('should complete full capture and analysis workflow', async () => {
    // 1. 连接模拟设备
    await vscode.commands.executeCommand('logicAnalyzer.connectDevice');
    
    // 2. 配置采集参数
    await vscode.commands.executeCommand('logicAnalyzer.configureCaptureSettings', {
      sampleRate: 25000000,
      totalSamples: 10000,
      channels: [0, 1]
    });
    
    // 3. 开始采集
    await vscode.commands.executeCommand('logicAnalyzer.startCapture');
    
    // 4. 等待采集完成
    await waitForEvent('captureCompleted', 5000);
    
    // 5. 执行协议解码
    await vscode.commands.executeCommand('logicAnalyzer.decodeProtocol', 'i2c');
    
    // 6. 验证结果
    const activeSession = extension.sessionManager.getActiveSession();
    expect(activeSession).toBeDefined();
    expect(activeSession!.captureData).toBeDefined();
    expect(activeSession!.decodedData).toBeDefined();
    
    // 7. 导出数据
    const exportPath = path.join(__dirname, 'test-export.lac');
    await vscode.commands.executeCommand('logicAnalyzer.exportData', exportPath);
    
    expect(fs.existsSync(exportPath)).toBe(true);
  });
});
```

### 测试配置

#### Jest 配置 (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  maxWorkers: 4
};
```

---

## 🔌 扩展开发

### VSCode 扩展架构

#### 扩展清单 (`package.json`)

```json
{
  "name": "pico-logic-analyzer",
  "displayName": "Pico Logic Analyzer",
  "description": "Logic analyzer extension for VSCode",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:logicAnalyzer.connect",
    "onLanguage:lac"
  ],
  "contributes": {
    "commands": [
      {
        "command": "logicAnalyzer.connectDevice",
        "title": "Connect Device",
        "category": "Logic Analyzer"
      },
      {
        "command": "logicAnalyzer.startCapture",
        "title": "Start Capture",
        "category": "Logic Analyzer"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "logicAnalyzer.connectDevice",
          "when": "true"
        }
      ]
    },
    "keybindings": [
      {
        "command": "logicAnalyzer.startCapture",
        "key": "ctrl+shift+l",
        "when": "logicAnalyzer.deviceConnected"
      }
    ],
    "configuration": {
      "title": "Logic Analyzer",
      "properties": {
        "logicAnalyzer.defaultSampleRate": {
          "type": "number",
          "default": 25000000,
          "description": "Default sample rate in Hz"
        }
      }
    },
    "customEditors": [
      {
        "viewType": "logicAnalyzer.lacEditor",
        "displayName": "Logic Analyzer Data",
        "selector": [
          {
            "filenamePattern": "*.lac"
          }
        ]
      }
    ]
  }
}
```

### 命令系统

#### 命令注册

```typescript
// src/commands/CaptureCommands.ts

export class CaptureCommands {
  constructor(
    private driverManager: HardwareDriverManager,
    private sessionManager: SessionManager
  ) {}
  
  registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
      vscode.commands.registerCommand(
        'logicAnalyzer.connectDevice',
        this.connectDevice.bind(this)
      ),
      
      vscode.commands.registerCommand(
        'logicAnalyzer.startCapture',
        this.startCapture.bind(this)
      ),
      
      vscode.commands.registerCommand(
        'logicAnalyzer.stopCapture',
        this.stopCapture.bind(this)
      )
    ];
    
    commands.forEach(cmd => context.subscriptions.push(cmd));
  }
  
  private async connectDevice(): Promise<void> {
    try {
      // 显示设备选择器
      const devices = await this.driverManager.scanDevices();
      
      if (devices.length === 0) {
        vscode.window.showWarningMessage('未找到逻辑分析器设备');
        return;
      }
      
      const selectedDevice = await vscode.window.showQuickPick(
        devices.map(d => ({
          label: d.name,
          detail: d.description,
          device: d
        })),
        { placeHolder: '选择要连接的设备' }
      );
      
      if (!selectedDevice) return;
      
      // 连接设备
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在连接设备...',
        cancellable: false
      }, async (progress) => {
        const result = await this.driverManager.connectDevice(selectedDevice.device.id);
        
        if (result.success) {
          vscode.commands.executeCommand('setContext', 'logicAnalyzer.deviceConnected', true);
          vscode.window.showInformationMessage(`已连接到 ${result.deviceInfo.name}`);
        } else {
          throw new Error(result.error || '连接失败');
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`连接设备失败: ${error.message}`);
    }
  }
  
  private async startCapture(): Promise<void> {
    try {
      // 获取或创建配置
      const config = await this.getCaptureConfiguration();
      
      if (!config) return;
      
      // 创建新会话
      const session = await this.sessionManager.createSession(config);
      
      // 开始采集
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在采集数据...',
        cancellable: true
      }, async (progress, token) => {
        
        token.onCancellationRequested(() => {
          this.driverManager.stopCapture();
        });
        
        const result = await this.driverManager.startCapture(config);
        
        if (result.success) {
          // 保存数据到会话
          await session.setData(result.data);
          
          // 打开数据查看器
          await this.openDataViewer(session);
          
          vscode.window.showInformationMessage('数据采集完成');
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`采集失败: ${error.message}`);
    }
  }
  
  private async getCaptureConfiguration(): Promise<CaptureConfiguration | null> {
    // 显示配置对话框或使用默认配置
    const config = vscode.workspace.getConfiguration('logicAnalyzer');
    
    return {
      sampleRate: config.get('defaultSampleRate', 25000000),
      totalSamples: 10000,
      triggerType: TriggerType.None,
      captureChannels: this.getDefaultChannels(),
      captureMode: CaptureMode.Normal
    };
  }
}
```

### 自定义编辑器

#### LAC 文件编辑器

```typescript
// src/providers/LACEditorProvider.ts

export class LACEditorProvider implements vscode.CustomTextEditorProvider {
  
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new LACEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      'logicAnalyzer.lacEditor',
      provider
    );
  }
  
  constructor(private readonly context: vscode.ExtensionContext) {}
  
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    
    // 配置 webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'out/webview')
      ]
    };
    
    // 设置 HTML 内容
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    
    // 处理消息
    webviewPanel.webview.onDidReceiveMessage(
      message => this.handleMessage(message, document, webviewPanel.webview)
    );
    
    // 文档变化处理
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.updateWebview(webviewPanel.webview, document);
      }
    });
    
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
    
    // 初始化数据
    this.updateWebview(webviewPanel.webview, document);
  }
  
  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out/webview', 'main.js')
    );
    
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out/webview', 'main.css')
    );
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Logic Analyzer Data</title>
      </head>
      <body>
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }
  
  private async updateWebview(webview: vscode.Webview, document: vscode.TextDocument): Promise<void> {
    try {
      const lacData = JSON.parse(document.getText());
      
      webview.postMessage({
        type: 'updateData',
        data: lacData
      });
      
    } catch (error) {
      webview.postMessage({
        type: 'error',
        message: '无法解析 LAC 文件格式'
      });
    }
  }
  
  private async handleMessage(
    message: any,
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    
    switch (message.type) {
      case 'ready':
        this.updateWebview(webview, document);
        break;
        
      case 'export':
        await this.handleExport(message.format, document);
        break;
        
      case 'decode':
        await this.handleDecode(message.protocol, document, webview);
        break;
    }
  }
  
  private async handleExport(format: string, document: vscode.TextDocument): Promise<void> {
    const exportService = new DataExportService();
    const lacData = JSON.parse(document.getText());
    
    const saveUri = await vscode.window.showSaveDialog({
      filters: {
        'CSV': ['csv'],
        'VCD': ['vcd'],
        'JSON': ['json']
      }
    });
    
    if (saveUri) {
      switch (format) {
        case 'csv':
          await exportService.exportToCSV(lacData, saveUri.fsPath, {});
          break;
        case 'vcd':
          await exportService.exportToVCD(lacData, saveUri.fsPath, {});
          break;
        case 'json':
          await exportService.exportToJSON(lacData, saveUri.fsPath);
          break;
      }
      
      vscode.window.showInformationMessage('数据导出完成');
    }
  }
}
```

### Webview 开发

#### Vue.js 前端

```vue
<!-- src/webview/App.vue -->

<template>
  <div class="logic-analyzer-app">
    <div class="toolbar">
      <button @click="zoomIn">🔍+</button>
      <button @click="zoomOut">🔍-</button>
      <button @click="fitToWindow">📐</button>
      <select v-model="selectedProtocol" @change="decodeProtocol">
        <option value="">选择协议解码器</option>
        <option value="i2c">I2C</option>
        <option value="spi">SPI</option>
        <option value="uart">UART</option>
      </select>
    </div>
    
    <div class="waveform-container" ref="waveformContainer">
      <WaveformRenderer
        :data="captureData"
        :timeScale="timeScale"
        :channelHeight="channelHeight"
        @timeRangeChanged="handleTimeRangeChange"
      />
    </div>
    
    <div class="decoder-results" v-if="decodedData">
      <DecoderResults :results="decodedData" />
    </div>
    
    <div class="status-bar">
      <span>样本数: {{ totalSamples }}</span>
      <span>采样率: {{ sampleRate }}Hz</span>
      <span>时间范围: {{ timeRange }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import WaveformRenderer from './components/WaveformRenderer.vue';
import DecoderResults from './components/DecoderResults.vue';

export default defineComponent({
  name: 'LogicAnalyzerApp',
  components: {
    WaveformRenderer,
    DecoderResults
  },
  
  setup() {
    const captureData = ref(null);
    const decodedData = ref(null);
    const selectedProtocol = ref('');
    const timeScale = ref(1.0);
    const channelHeight = ref(50);
    
    // VSCode 消息处理
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'updateData':
          captureData.value = message.data;
          break;
          
        case 'decodedResults':
          decodedData.value = message.results;
          break;
          
        case 'error':
          console.error('Error:', message.message);
          break;
      }
    });
    
    const vscode = acquireVsCodeApi();
    
    onMounted(() => {
      // 通知 VSCode webview 已就绪
      vscode.postMessage({ type: 'ready' });
    });
    
    const zoomIn = () => {
      timeScale.value *= 1.5;
    };
    
    const zoomOut = () => {
      timeScale.value /= 1.5;
    };
    
    const fitToWindow = () => {
      // 计算适合窗口的缩放比例
      timeScale.value = calculateFitScale();
    };
    
    const decodeProtocol = () => {
      if (selectedProtocol.value) {
        vscode.postMessage({
          type: 'decode',
          protocol: selectedProtocol.value
        });
      }
    };
    
    return {
      captureData,
      decodedData,
      selectedProtocol,
      timeScale,
      channelHeight,
      zoomIn,
      zoomOut,
      fitToWindow,
      decodeProtocol
    };
  }
});
</script>
```

---

## 🚀 部署和发布

### 构建配置

#### Webpack 配置

```javascript
// webpack.config.js

const path = require('path');

module.exports = [
  // Extension configuration
  {
    name: 'extension',
    target: 'node',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: 'ts-loader'
        }
      ]
    },
    externals: {
      vscode: 'commonjs vscode'
    }
  },
  
  // Webview configuration
  {
    name: 'webview',
    target: 'web',
    entry: './src/webview/main.ts',
    output: {
      path: path.resolve(__dirname, 'out/webview'),
      filename: 'main.js'
    },
    resolve: {
      extensions: ['.ts', '.js', '.vue'],
      alias: {
        '@': path.resolve(__dirname, 'src/webview')
      }
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            appendTsSuffixTo: [/\.vue$/]
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new VueLoaderPlugin()
    ]
  }
];
```

### 发布流程

#### 自动化发布脚本

```json
{
  "scripts": {
    "prebuild": "npm run clean",
    "build": "webpack --mode production",
    "clean": "rimraf out",
    "test": "jest",
    "test:e2e": "npm run build && node ./out/tests/runTests.js",
    "package": "vsce package",
    "publish": "vsce publish",
    "deploy:marketplace": "npm run build && npm run test && npm run package && vsce publish",
    "deploy:github": "gh release create v$npm_package_version ./pico-logic-analyzer-$npm_package_version.vsix"
  }
}
```

#### CI/CD 配置 (GitHub Actions)

```yaml
# .github/workflows/ci.yml

name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  release:
    types: [ published ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
  
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build extension
      run: npm run build
    
    - name: Package extension
      run: npm run package
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: extension-package
        path: '*.vsix'
  
  publish:
    if: github.event_name == 'release'
    needs: build
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Publish to VS Code Marketplace
      env:
        VSCE_PAT: ${{ secrets.VSCE_PAT }}
      run: npm run deploy:marketplace
```

### 版本管理

#### 语义化版本控制

遵循 [Semantic Versioning](https://semver.org/) 规范：

- **MAJOR**: 不兼容的 API 更改
- **MINOR**: 向后兼容的功能添加
- **PATCH**: 向后兼容的问题修复

#### 变更日志模板

```md
# 变更日志

## [1.2.0] - 2025-08-15

### 新增
- 支持 CAN 总线协议解码
- 网络设备自动发现功能
- 批量数据导出工具

### 改进
- I2C 解码器性能提升 30%
- 波形渲染优化，支持更大数据集
- 用户界面响应性改进

### 修复
- 修复串口连接在 macOS 上的问题
- 解决内存泄漏问题
- 修正 SPI 模式 3 解码错误

### 废弃
- 旧版本配置格式将在 v2.0.0 中移除

## [1.1.0] - 2025-07-01

### 新增
- SPI 协议解码器
- 自定义触发器配置
- 数据压缩存储

### 修复
- 修复高采样率下的数据丢失问题
```

---

## 🤝 贡献指南

### 开发流程

#### 1. 环境准备

```bash
# Fork 项目到你的 GitHub 账户
# 克隆你的 fork
git clone https://github.com/YOUR_USERNAME/pico-logic-analyzer-vscode.git
cd pico-logic-analyzer-vscode

# 添加上游仓库
git remote add upstream https://github.com/pico-logic-analyzer/vscode-extension.git

# 安装依赖
npm install
```

#### 2. 分支策略

```bash
# 创建功能分支
git checkout -b feature/add-can-decoder

# 创建修复分支
git checkout -b fix/serial-connection-issue

# 创建文档分支
git checkout -b docs/update-api-reference
```

#### 3. 开发规范

##### 代码风格

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 使用 Prettier 格式化代码
- 编写有意义的注释

```typescript
/**
 * I2C 协议解码器
 * 
 * 支持标准 I2C 协议解码，包括：
 * - 7位和10位地址格式
 * - 标准速度和高速模式
 * - 错误检测和报告
 * 
 * @example
 * ```typescript
 * const decoder = new I2CDecoder();
 * const results = await decoder.decode(sampleRate, channels, options);
 * ```
 */
export class I2CDecoder extends DecoderBase {
  // 实现...
}
```

##### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```bash
# 新功能
git commit -m "feat(decoder): add CAN bus protocol decoder"

# 修复
git commit -m "fix(driver): resolve serial port connection timeout"

# 文档
git commit -m "docs(api): update decoder development guide"

# 重构
git commit -m "refactor(core): improve memory management in session manager"

# 测试
git commit -m "test(integration): add comprehensive decoder tests"
```

#### 4. 测试要求

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "I2C Decoder"

# 生成覆盖率报告
npm run test:coverage

# 运行端到端测试
npm run test:e2e
```

**测试覆盖率要求**:
- 总体覆盖率 ≥ 80%
- 核心模块覆盖率 ≥ 90%
- 新增功能必须包含测试

#### 5. 文档要求

- API 变更必须更新文档
- 新功能需要使用示例
- 复杂算法需要详细注释
- README 和 CHANGELOG 保持更新

#### 6. Pull Request 流程

```bash
# 确保代码最新
git fetch upstream
git rebase upstream/main

# 推送到你的 fork
git push origin feature/add-can-decoder

# 在 GitHub 上创建 Pull Request
```

**PR 模板**:

```md
## 描述
简要描述这个 PR 的目的和内容。

## 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能改进

## 测试
- [ ] 添加了新的测试
- [ ] 所有测试通过
- [ ] 手动测试完成

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 提交信息符合规范
- [ ] 文档已更新
- [ ] 变更日志已更新

## 截图 (如适用)
如果是 UI 相关的变更，请提供截图。

## 相关 Issue
Fixes #123
```

### 项目结构

```
pico-logic-analyzer/
├── .github/              # GitHub 相关配置
│   ├── workflows/        # CI/CD 配置
│   └── ISSUE_TEMPLATE/   # Issue 模板
├── docs/                 # 文档
│   ├── api/             # API 文档
│   ├── guides/          # 开发指南
│   └── examples/        # 示例代码
├── src/                 # 源代码
│   ├── commands/        # VSCode 命令
│   ├── decoders/        # 协议解码器
│   ├── drivers/         # 硬件驱动
│   ├── models/          # 数据模型
│   ├── providers/       # VSCode 提供者
│   ├── services/        # 核心服务
│   ├── utils/           # 工具函数
│   ├── webview/         # Webview 前端
│   └── extension.ts     # 扩展入口
├── tests/               # 测试文件
│   ├── integration/     # 集成测试
│   ├── performance/     # 性能测试
│   ├── unit/           # 单元测试
│   └── utils/          # 测试工具
├── resources/           # 资源文件
└── package.json        # 项目配置
```

### 代码审查

#### 审查清单

**功能性**:
- [ ] 功能是否按预期工作
- [ ] 边界情况是否处理正确
- [ ] 错误处理是否完善

**代码质量**:
- [ ] 代码结构清晰
- [ ] 变量和函数命名合理
- [ ] 没有重复代码
- [ ] 性能考虑合理

**测试**:
- [ ] 测试覆盖关键路径
- [ ] 测试用例有意义
- [ ] 测试数据合理

**文档**:
- [ ] API 文档完整
- [ ] 复杂逻辑有注释
- [ ] 使用示例清晰

### 社区支持

#### 获取帮助

- **GitHub Discussions**: 一般问题和讨论
- **GitHub Issues**: Bug 报告和功能请求
- **Email**: 紧急问题联系 dev@pico-logic-analyzer.com

#### 贡献类型

- **代码贡献**: 新功能、Bug 修复、性能优化
- **文档贡献**: API 文档、用户指南、示例代码
- **测试贡献**: 单元测试、集成测试、性能测试
- **设计贡献**: UI/UX 改进、图标设计
- **翻译贡献**: 多语言支持

#### 贡献者识别

项目感谢所有贡献者，贡献将被记录在：

- **CONTRIBUTORS.md**: 贡献者列表
- **Release Notes**: 版本更新说明
- **GitHub Contributors**: 自动识别
- **特殊贡献奖励**: 重大贡献者将获得特殊认可

---

## 📞 联系信息

### 开发团队

- **项目维护者**: Pico Logic Analyzer Team
- **主要开发者**: 
  - 架构师: [@architect](https://github.com/architect)
  - 前端开发: [@frontend-dev](https://github.com/frontend-dev)
  - 测试工程师: [@test-engineer](https://github.com/test-engineer)

### 技术支持

- **GitHub Issues**: https://github.com/pico-logic-analyzer/vscode-extension/issues
- **开发者邮箱**: dev@pico-logic-analyzer.com
- **技术文档**: https://docs.pico-logic-analyzer.com
- **API 参考**: https://api.pico-logic-analyzer.com

### 商业支持

- **企业客户**: enterprise@pico-logic-analyzer.com
- **技术培训**: training@pico-logic-analyzer.com
- **定制开发**: custom@pico-logic-analyzer.com

---

*最后更新: 2025年8月1日*  
*版本: 1.0.0*  
*© 2025 Pico Logic Analyzer Team*