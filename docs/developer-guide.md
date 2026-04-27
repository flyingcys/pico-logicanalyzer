# VSCode 逻辑分析器插件 - 开发者指南

## 📖 目录

1. [开发环境搭建](#开发环境搭建)
2. [项目架构](#项目架构)
3. [硬件驱动开发](#硬件驱动开发)
4. [协议解码器开发](#协议解码器开发)
5. [前端界面开发](#前端界面开发)
6. [测试开发](#测试开发)
7. [性能优化](#性能优化)
8. [API参考](#api参考)
9. [贡献指南](#贡献指南)
10. [发布流程](#发布流程)

## 开发环境搭建

### 必需软件

- **Node.js**: 16.0.0+ (推荐使用 LTS 版本)
- **VSCode**: 1.60.0+ (用于开发和调试)
- **Git**: 最新版本
- **TypeScript**: 4.5.0+ (全局安装)

```bash
# 安装Node.js (使用nvm推荐)
nvm install 16
nvm use 16

# 全局安装TypeScript
npm install -g typescript

# 验证安装
node --version
npm --version
tsc --version
```

### 项目克隆与依赖安装

```bash
# 克隆项目
git clone https://github.com/your-repo/vscode-logicanalyzer.git
cd vscode-logicanalyzer

# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test
```

### 开发工具配置

#### VSCode 扩展推荐

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "vue.volar",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.test-adapter-converter"
  ]
}
```

#### TypeScript 配置

项目使用严格的 TypeScript 配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 调试配置

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${workspaceFolder}:npm: compile"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
      ],
      "outFiles": ["${workspaceFolder}/out/test/**/*.js"],
      "preLaunchTask": "${workspaceFolder}:npm: test-compile"
    }
  ]
}
```

## 项目架构

### 目录结构

```
vscode-logicanalyzer/
├── src/                          # 源代码
│   ├── drivers/                  # 硬件驱动层
│   │   ├── base/                 # 抽象基类
│   │   ├── adapters/             # 硬件适配器
│   │   └── protocols/            # 通信协议
│   ├── decoders/                 # 协议解码器
│   │   ├── base/                 # 解码器基类
│   │   └── protocols/            # 具体协议实现
│   ├── frontend/                 # 新前端主路径
│   │   ├── app/                  # Vue应用壳与组件
│   │   ├── core/                 # 状态、服务、引擎
│   │   ├── platform/             # host/bootstrap适配层
│   │   └── shared/               # i18n、样式、共享资源
│   ├── webview/                  # 兼容壳与旧路径转发
│   ├── models/                   # 数据模型
│   ├── utils/                    # 工具函数
│   └── extension.ts              # 插件入口
├── test/                         # 测试文件
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   ├── performance/              # 性能测试
│   └── mocks/                    # Mock数据
├── docs/                         # 文档
└── package.json                  # 项目配置
```

### 核心架构原则

#### 1. 硬件抽象层 (HAL)

所有硬件驱动必须继承 `AnalyzerDriverBase`：

```typescript
abstract class AnalyzerDriverBase {
  abstract readonly deviceVersion: string;
  abstract readonly channelCount: number;
  abstract readonly maxFrequency: number;
  
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract startCapture(session: CaptureSession): Promise<void>;
  
  // 事件系统
  abstract on(event: string, listener: Function): void;
  abstract off(event: string, listener: Function): void;
}
```

#### 2. 协议解码器统一接口

```typescript
abstract class DecoderBase {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly channels: DecoderChannel[];
  
  // 核心解码方法
  abstract decode(
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: DecoderOptionValue[]
  ): DecoderResult[];
  
  // 辅助方法
  protected wait(conditions: WaitCondition): WaitResult;
  protected put(startSample: number, endSample: number, data: DecoderOutput): void;
}
```

#### 3. 统一数据格式

```typescript
interface UnifiedCaptureData {
  metadata: {
    deviceInfo: DeviceInfo;
    sampleRate: number;
    totalSamples: number;
    triggerPosition?: number;
  };
  channels: ChannelInfo[];
  samples: {
    digital?: {
      data: Uint8Array[];
      encoding: 'binary' | 'rle';
    };
  };
  quality: {
    lostSamples: number;
    errorRate: number;
  };
}
```

## 硬件驱动开发

### 新建硬件驱动

#### 1. 创建驱动文件

在 `src/drivers/adapters/` 目录创建新文件：

```typescript
// src/drivers/adapters/MyDeviceDriver.ts
import { AnalyzerDriverBase } from '../base/AnalyzerDriverBase';
import { CaptureSession } from '../../models/CaptureSession';
import { DeviceInfo } from '../../models/DeviceInfo';

export class MyDeviceDriver extends AnalyzerDriverBase {
  readonly deviceVersion = '1.0.0';
  readonly channelCount = 16;
  readonly maxFrequency = 100000000; // 100MHz
  
  private serialPort?: SerialPort;
  private isConnected = false;
  
  constructor(private portPath: string) {
    super();
  }
  
  async connect(): Promise<void> {
    // 实现设备连接逻辑
    this.serialPort = new SerialPort(this.portPath, {
      baudRate: 115200
    });
    
    return new Promise((resolve, reject) => {
      this.serialPort!.on('open', () => {
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });
      
      this.serialPort!.on('error', reject);
    });
  }
  
  async disconnect(): Promise<void> {
    if (this.serialPort) {
      await new Promise<void>((resolve) => {
        this.serialPort!.close(() => {
          this.isConnected = false;
          this.emit('disconnected');
          resolve();
        });
      });
    }
  }
  
  getDeviceInfo(): DeviceInfo {
    return {
      name: 'My Logic Analyzer',
      version: this.deviceVersion,
      serialNumber: 'MLA001',
      channels: this.channelCount,
      maxSampleRate: this.maxFrequency,
      supportedVoltages: [1.8, 3.3, 5.0]
    };
  }
  
  async startCapture(session: CaptureSession): Promise<void> {
    if (!this.isConnected) {
      throw new Error('设备未连接');
    }
    
    // 构建采集命令
    const command = this.buildCaptureCommand(session);
    
    // 发送命令
    await this.sendCommand(command);
    
    // 开始接收数据
    this.startDataReception(session);
  }
  
  private buildCaptureCommand(session: CaptureSession): Uint8Array {
    // 根据设备协议构建命令包
    const command = new Uint8Array(16);
    
    // 设置采样频率
    const frequencyBytes = new DataView(new ArrayBuffer(4));
    frequencyBytes.setUint32(0, session.frequency, true);
    command.set(new Uint8Array(frequencyBytes.buffer), 0);
    
    // 设置通道掩码
    let channelMask = 0;
    session.captureChannels.forEach(channel => {
      channelMask |= (1 << channel.channelID);
    });
    command[4] = channelMask & 0xFF;
    command[5] = (channelMask >> 8) & 0xFF;
    
    // 设置触发配置
    command[6] = session.triggerType;
    command[7] = session.trigger;
    
    return command;
  }
}
```

#### 2. 注册驱动

在 `src/drivers/DriverManager.ts` 中注册新驱动：

```typescript
export class DriverManager {
  private static drivers = new Map<string, typeof AnalyzerDriverBase>();
  
  static registerDriver(id: string, driverClass: typeof AnalyzerDriverBase) {
    this.drivers.set(id, driverClass);
  }
  
  static createDriver(id: string, ...args: any[]): AnalyzerDriverBase {
    const DriverClass = this.drivers.get(id);
    if (!DriverClass) {
      throw new Error(`未知的驱动类型: ${id}`);
    }
    return new DriverClass(...args);
  }
}

// 注册驱动
DriverManager.registerDriver('my-device', MyDeviceDriver);
```

### 通信协议实现

#### 数据包格式

遵循原项目的协议格式：

```typescript
class OutputPacket {
  private data: Uint8Array;
  
  constructor(payload: Uint8Array) {
    this.data = this.escape(payload);
  }
  
  serialize(): Uint8Array {
    const packet = new Uint8Array(this.data.length + 4);
    
    // 包头：0x55 0xAA
    packet[0] = 0x55;
    packet[1] = 0xAA;
    
    // 转义后的数据
    packet.set(this.data, 2);
    
    // 包尾：0xAA 0x55
    packet[packet.length - 2] = 0xAA;
    packet[packet.length - 1] = 0x55;
    
    return packet;
  }
  
  private escape(data: Uint8Array): Uint8Array {
    const escaped: number[] = [];
    
    for (const byte of data) {
      if (byte === 0xAA || byte === 0x55 || byte === 0xF0) {
        escaped.push(0xF0);
        escaped.push(byte ^ 0xF0);
      } else {
        escaped.push(byte);
      }
    }
    
    return new Uint8Array(escaped);
  }
}
```

#### 采集请求结构

```typescript
interface CaptureRequest {
  triggerType: number;        // byte
  trigger: number;           // byte  
  triggerValue: number;      // ushort - 小端序
  frequency: number;         // uint32 - 小端序
  preTriggerSamples: number; // uint32 - 小端序
  postTriggerSamples: number; // uint32 - 小端序
  loopCount: number;         // uint32 - 小端序
  channelGroups: number[];   // byte array
}

function serializeCaptureRequest(request: CaptureRequest): Uint8Array {
  const buffer = new ArrayBuffer(32);
  const view = new DataView(buffer);
  let offset = 0;
  
  view.setUint8(offset++, request.triggerType);
  view.setUint8(offset++, request.trigger);
  view.setUint16(offset, request.triggerValue, true); // 小端序
  offset += 2;
  view.setUint32(offset, request.frequency, true);
  offset += 4;
  view.setUint32(offset, request.preTriggerSamples, true);
  offset += 4;
  view.setUint32(offset, request.postTriggerSamples, true);
  offset += 4;
  view.setUint32(offset, request.loopCount, true);
  offset += 4;
  
  // 设置通道组
  for (let i = 0; i < 8; i++) {
    view.setUint8(offset++, request.channelGroups[i] || 0);
  }
  
  return new Uint8Array(buffer);
}
```

### 设备检测与枚举

```typescript
export class DeviceDetector {
  static async detectDevices(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = [];
    
    try {
      // 枚举串口设备
      const ports = await SerialPort.list();
      
      for (const port of ports) {
        // 检查设备特征
        if (this.isLogicAnalyzer(port)) {
          const deviceInfo = await this.identifyDevice(port.path);
          if (deviceInfo) {
            devices.push(deviceInfo);
          }
        }
      }
    } catch (error) {
      console.error('设备检测失败:', error);
    }
    
    return devices;
  }
  
  private static isLogicAnalyzer(port: any): boolean {
    // 根据厂商ID和产品ID判断
    const knownDevices = [
      { vendorId: '0403', productId: '6001' }, // FTDI
      { vendorId: '1A86', productId: '7523' }, // CH340
      { vendorId: '10C4', productId: 'EA60' }  // CP2102
    ];
    
    return knownDevices.some(device => 
      port.vendorId === device.vendorId && 
      port.productId === device.productId
    );
  }
  
  private static async identifyDevice(portPath: string): Promise<DeviceInfo | null> {
    try {
      // 尝试连接设备并获取标识信息
      const tempDriver = new MyDeviceDriver(portPath);
      await tempDriver.connect();
      
      const deviceInfo = tempDriver.getDeviceInfo();
      await tempDriver.disconnect();
      
      return deviceInfo;
    } catch (error) {
      return null;
    }
  }
}
```

## 协议解码器开发

### 创建新的解码器

#### 1. 基础解码器结构

```typescript
// src/decoders/protocols/MyProtocolDecoder.ts
import { DecoderBase } from '../base/DecoderBase';
import { DecoderChannel, DecoderResult, DecoderOutput } from '../../models/DecoderTypes';
import { AnalyzerChannel } from '../../models/AnalyzerChannel';

export class MyProtocolDecoder extends DecoderBase {
  readonly id = 'my-protocol';
  readonly name = '我的协议';
  readonly channels: DecoderChannel[] = [
    {
      id: 'clock',
      name: '时钟',
      description: '时钟信号线',
      required: true
    },
    {
      id: 'data',
      name: '数据',
      description: '数据信号线',
      required: true
    }
  ];
  
  readonly annotations = [
    ['start', '开始'],
    ['data', '数据'],
    ['stop', '停止'],
    ['error', '错误']
  ];
  
  readonly options = [
    {
      id: 'bit_order',
      name: '位序',
      description: '数据位传输顺序',
      type: 'enum',
      default: 'msb',
      values: [
        ['msb', 'MSB优先'],
        ['lsb', 'LSB优先']
      ]
    }
  ];
  
  decode(
    sampleRate: number, 
    channels: AnalyzerChannel[], 
    options: any[]
  ): DecoderResult[] {
    const results: DecoderResult[] = [];
    
    // 获取通道数据
    const clockChannel = this.getChannel(channels, 'clock');
    const dataChannel = this.getChannel(channels, 'data');
    
    if (!clockChannel || !dataChannel) {
      throw new Error('缺少必要的通道数据');
    }
    
    // 解码状态机
    let state = 'IDLE';
    let bitCounter = 0;
    let currentByte = 0;
    let startSample = 0;
    
    // 遍历所有样本
    for (let i = 1; i < clockChannel.samples.length; i++) {
      const clockEdge = this.isRisingEdge(clockChannel.samples, i);
      
      if (clockEdge) {
        const dataBit = dataChannel.samples[i];
        
        switch (state) {
          case 'IDLE':
            if (this.isStartCondition(clockChannel.samples, dataChannel.samples, i)) {
              state = 'DATA';
              startSample = i;
              bitCounter = 0;
              currentByte = 0;
              
              this.put(i, i + 1, {
                type: 'start',
                data: '开始'
              });
            }
            break;
            
          case 'DATA':
            // 收集数据位
            if (bitCounter < 8) {
              currentByte = (currentByte << 1) | dataBit;
              bitCounter++;
            } else {
              // 一个字节完成
              this.put(startSample, i, {
                type: 'data',
                data: `0x${currentByte.toString(16).toUpperCase().padStart(2, '0')}`
              });
              
              bitCounter = 0;
              currentByte = 0;
              startSample = i;
            }
            break;
        }
      }
    }
    
    return results;
  }
  
  private getChannel(channels: AnalyzerChannel[], id: string): AnalyzerChannel | undefined {
    // 根据通道ID查找通道
    const channelIndex = this.channelMap.get(id);
    return channelIndex !== undefined ? channels[channelIndex] : undefined;
  }
  
  private isRisingEdge(samples: Uint8Array, index: number): boolean {
    return index > 0 && samples[index - 1] === 0 && samples[index] === 1;
  }
  
  private isStartCondition(clock: Uint8Array, data: Uint8Array, index: number): boolean {
    // 检测开始条件的逻辑
    return data[index] === 0 && clock[index] === 1;
  }
}
```

#### 2. 复杂协议解码示例 (I2C)

```typescript
export class I2CDecoder extends DecoderBase {
  readonly id = 'i2c';
  readonly name = 'I2C';
  readonly channels = [
    { id: 'scl', name: 'SCL', description: '时钟线', required: true },
    { id: 'sda', name: 'SDA', description: '数据线', required: true }
  ];
  
  decode(sampleRate: number, channels: AnalyzerChannel[]): DecoderResult[] {
    const results: DecoderResult[] = [];
    const scl = this.getChannel(channels, 'scl');
    const sda = this.getChannel(channels, 'sda');
    
    let state = 'IDLE';
    let bitIndex = 0;
    let currentByte = 0;
    let address = 0;
    let isRead = false;
    
    for (let i = 1; i < scl.samples.length; i++) {
      // 检测开始条件：SDA下降沿且SCL为高
      if (this.isStartCondition(scl.samples, sda.samples, i)) {
        this.put(i, i + 1, { type: 'start', data: 'START' });
        state = 'ADDRESS';
        bitIndex = 0;
        currentByte = 0;
        continue;
      }
      
      // 检测停止条件：SDA上升沿且SCL为高
      if (this.isStopCondition(scl.samples, sda.samples, i)) {
        this.put(i, i + 1, { type: 'stop', data: 'STOP' });
        state = 'IDLE';
        continue;
      }
      
      // 检测时钟上升沿
      if (this.isRisingEdge(scl.samples, i)) {
        const dataBit = sda.samples[i];
        
        switch (state) {
          case 'ADDRESS':
            if (bitIndex < 7) {
              currentByte = (currentByte << 1) | dataBit;
              bitIndex++;
            } else if (bitIndex === 7) {
              // R/W位
              isRead = dataBit === 1;
              address = currentByte;
              
              this.put(i - 7, i + 1, {
                type: 'address',
                data: `0x${address.toString(16).toUpperCase().padStart(2, '0')} ${isRead ? 'R' : 'W'}`
              });
              
              state = 'ACK_ADDRESS';
            }
            break;
            
          case 'ACK_ADDRESS':
            this.put(i, i + 1, {
              type: 'ack',
              data: dataBit === 0 ? 'ACK' : 'NACK'
            });
            
            state = isRead ? 'READ_data' : 'write_data';
            bitIndex = 0;
            currentByte = 0;
            break;
            
          case 'WRITE_DATA':
            if (bitIndex < 8) {
              currentByte = (currentByte << 1) | dataBit;
              bitIndex++;
              
              if (bitIndex === 8) {
                this.put(i - 7, i + 1, {
                  type: 'data',
                  data: `0x${currentByte.toString(16).toUpperCase().padStart(2, '0')}`
                });
                
                state = 'ACK_DATA';
                bitIndex = 0;
                currentByte = 0;
              }
            }
            break;
            
          case 'ACK_DATA':
            this.put(i, i + 1, {
              type: 'ack',
              data: dataBit === 0 ? 'ACK' : 'NACK'
            });
            
            state = 'WRITE_DATA';
            break;
        }
      }
    }
    
    return results;
  }
  
  private isStartCondition(scl: Uint8Array, sda: Uint8Array, i: number): boolean {
    return i > 0 && 
           scl[i] === 1 && scl[i - 1] === 1 &&
           sda[i] === 0 && sda[i - 1] === 1;
  }
  
  private isStopCondition(scl: Uint8Array, sda: Uint8Array, i: number): boolean {
    return i > 0 && 
           scl[i] === 1 && scl[i - 1] === 1 &&
           sda[i] === 1 && sda[i - 1] === 0;
  }
}
```

### 解码器注册

```typescript
// src/decoders/DecoderManager.ts
export class DecoderManager {
  private decoders = new Map<string, DecoderBase>();
  
  registerDecoder(decoder: DecoderBase) {
    this.decoders.set(decoder.id, decoder);
  }
  
  getDecoder(id: string): DecoderBase | undefined {
    return this.decoders.get(id);
  }
  
  getAllDecoders(): DecoderBase[] {
    return Array.from(this.decoders.values());
  }
  
  async executeDecoder(
    decoderId: string, 
    sampleRate: number, 
    channels: AnalyzerChannel[], 
    options: any[]
  ): Promise<DecoderResult[]> {
    const decoder = this.getDecoder(decoderId);
    if (!decoder) {
      throw new Error(`未找到解码器: ${decoderId}`);
    }
    
    try {
      return decoder.decode(sampleRate, channels, options);
    } catch (error) {
      throw new Error(`解码失败: ${error.message}`);
    }
  }
}

// 注册所有解码器
const decoderManager = new DecoderManager();
decoderManager.registerDecoder(new I2CDecoder());
decoderManager.registerDecoder(new SPIDecoder());
decoderManager.registerDecoder(new UARTDecoder());
decoderManager.registerDecoder(new MyProtocolDecoder());
```

## 前端界面开发

### Vue3 + TypeScript 组件开发

#### 设备连接组件

```vue
<!-- src/webview/components/DeviceConnection.vue -->
<template>
  <div class="device-connection">
    <el-card class="device-card">
      <template #header>
        <div class="card-header">
          <span>设备连接</span>
          <el-button 
            type="primary" 
            :icon="Refresh" 
            @click="refreshDevices"
            :loading="refreshing"
          >
            刷新设备
          </el-button>
        </div>
      </template>
      
      <el-table 
        :data="devices" 
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="设备名称" />
        <el-table-column prop="serialNumber" label="序列号" />
        <el-table-column prop="channels" label="通道数" />
        <el-table-column prop="maxSampleRate" label="最大采样率">
          <template #default="scope">
            {{ formatFrequency(scope.row.maxSampleRate) }}
          </template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="scope">
            <el-tag 
              :type="getStatusType(scope.row.status)"
              :icon="getStatusIcon(scope.row.status)"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'disconnected'"
              type="primary"
              size="small"
              @click="connectDevice(scope.row)"
              :loading="scope.row.connecting"
            >
              连接
            </el-button>
            <el-button
              v-else-if="scope.row.status === 'connected'"
              type="danger"
              size="small"
              @click="disconnectDevice(scope.row)"
            >
              断开
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { useDeviceStore } from '../stores/deviceStore';
import type { DeviceInfo } from '../../models/DeviceInfo';

// 状态管理
const deviceStore = useDeviceStore();
const devices = ref<DeviceInfo[]>([]);
const selectedDevices = ref<DeviceInfo[]>([]);
const refreshing = ref(false);

// 方法
const refreshDevices = async () => {
  refreshing.value = true;
  try {
    devices.value = await deviceStore.detectDevices();
    ElMessage.success('设备刷新完成');
  } catch (error: any) {
    ElMessage.error(`设备刷新失败: ${error.message}`);
  } finally {
    refreshing.value = false;
  }
};

const connectDevice = async (device: DeviceInfo) => {
  device.connecting = true;
  try {
    await deviceStore.connectDevice(device.id);
    device.status = 'connected';
    ElMessage.success(`设备 ${device.name} 连接成功`);
  } catch (error: any) {
    ElMessage.error(`连接失败: ${error.message}`);
  } finally {
    device.connecting = false;
  }
};

const disconnectDevice = async (device: DeviceInfo) => {
  try {
    await deviceStore.disconnectDevice(device.id);
    device.status = 'disconnected';
    ElMessage.success(`设备 ${device.name} 已断开`);
  } catch (error: any) {
    ElMessage.error(`断开失败: ${error.message}`);
  }
};

const handleSelectionChange = (selection: DeviceInfo[]) => {
  selectedDevices.value = selection;
};

// 工具函数
const formatFrequency = (frequency: number): string => {
  if (frequency >= 1000000000) {
    return `${(frequency / 1000000000).toFixed(1)} GHz`;
  } else if (frequency >= 1000000) {
    return `${(frequency / 1000000).toFixed(1)} MHz`;
  } else if (frequency >= 1000) {
    return `${(frequency / 1000).toFixed(1)} kHz`;
  } else {
    return `${frequency} Hz`;
  }
};

const getStatusType = (status: string) => {
  const types = {
    connected: 'success',
    connecting: 'warning',
    disconnected: 'info',
    error: 'danger'
  };
  return types[status] || 'info';
};

const getStatusText = (status: string) => {
  const texts = {
    connected: '已连接',
    connecting: '连接中',
    disconnected: '未连接',
    error: '错误'
  };
  return texts[status] || '未知';
};

// 生命周期
onMounted(() => {
  refreshDevices();
});
</script>

<style scoped>
.device-connection {
  padding: 20px;
}

.device-card {
  min-height: 400px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
```

#### 状态管理 (Pinia)

```typescript
// src/webview/stores/deviceStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { DeviceInfo } from '../../models/DeviceInfo';

export const useDeviceStore = defineStore('device', () => {
  // 状态
  const connectedDevices = ref<Map<string, DeviceInfo>>(new Map());
  const currentDevice = ref<DeviceInfo | null>(null);
  
  // Getters
  const isDeviceConnected = (deviceId: string): boolean => {
    return connectedDevices.value.has(deviceId);
  };
  
  const getConnectedDevices = (): DeviceInfo[] => {
    return Array.from(connectedDevices.value.values());
  };
  
  // Actions
  const detectDevices = async (): Promise<DeviceInfo[]> => {
    // 调用VSCode API检测设备
    const devices = await vscode.postMessage({
      command: 'detectDevices'
    });
    
    return devices;
  };
  
  const connectDevice = async (deviceId: string): Promise<void> => {
    const result = await vscode.postMessage({
      command: 'connectDevice',
      deviceId
    });
    
    if (result.success) {
      connectedDevices.value.set(deviceId, result.device);
      if (!currentDevice.value) {
        currentDevice.value = result.device;
      }
    } else {
      throw new Error(result.error);
    }
  };
  
  const disconnectDevice = async (deviceId: string): Promise<void> => {
    const result = await vscode.postMessage({
      command: 'disconnectDevice',
      deviceId
    });
    
    if (result.success) {
      connectedDevices.value.delete(deviceId);
      if (currentDevice.value?.id === deviceId) {
        const remaining = getConnectedDevices();
        currentDevice.value = remaining.length > 0 ? remaining[0] : null;
      }
    } else {
      throw new Error(result.error);
    }
  };
  
  return {
    // 状态
    connectedDevices,
    currentDevice,
    
    // Getters
    isDeviceConnected,
    getConnectedDevices,
    
    // Actions
    detectDevices,
    connectDevice,
    disconnectDevice
  };
});
```

## 测试开发

### 单元测试

```typescript
// test/unit/drivers/AnalyzerDriverBase.test.ts
import { AnalyzerDriverBase } from '../../../src/drivers/base/AnalyzerDriverBase';
import { CaptureSession } from '../../../src/models/CaptureSession';
import { DeviceInfo } from '../../../src/models/DeviceInfo';

class TestDriver extends AnalyzerDriverBase {
  readonly deviceVersion = '1.0.0';
  readonly channelCount = 8;
  readonly maxFrequency = 100000000;
  
  private connected = false;
  
  async connect(): Promise<void> {
    this.connected = true;
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  getDeviceInfo(): DeviceInfo {
    return {
      name: 'Test Device',
      version: this.deviceVersion,
      serialNumber: 'TEST001',
      channels: this.channelCount,
      maxSampleRate: this.maxFrequency,
      supportedVoltages: [3.3, 5.0]
    };
  }
  
  async startCapture(session: CaptureSession): Promise<void> {
    if (!this.connected) {
      throw new Error('设备未连接');
    }
    
    // 模拟采集过程
    setTimeout(() => {
      this.emit('captureComplete', {
        samples: new Uint8Array([1, 0, 1, 1, 0]),
        sampleRate: session.frequency
      });
    }, 100);
  }
}

describe('AnalyzerDriverBase', () => {
  let driver: TestDriver;
  
  beforeEach(() => {
    driver = new TestDriver();
  });
  
  afterEach(async () => {
    if (driver.isConnected) {
      await driver.disconnect();
    }
  });
  
  describe('连接管理', () => {
    test('should connect successfully', async () => {
      await driver.connect();
      expect(driver.isConnected).toBe(true);
    });
    
    test('should disconnect successfully', async () => {
      await driver.connect();
      await driver.disconnect();
      expect(driver.isConnected).toBe(false);
    });
  });
  
  describe('设备信息', () => {
    test('should return correct device info', () => {
      const info = driver.getDeviceInfo();
      expect(info.name).toBe('Test Device');
      expect(info.channels).toBe(8);
      expect(info.maxSampleRate).toBe(100000000);
    });
  });
  
  describe('数据采集', () => {
    beforeEach(async () => {
      await driver.connect();
    });
    
    test('should start capture successfully', async () => {
      const session = new CaptureSession();
      session.frequency = 1000000;
      
      const capturePromise = new Promise((resolve) => {
        driver.on('captureComplete', resolve);
      });
      
      await driver.startCapture(session);
      const result = await capturePromise;
      
      expect(result).toBeDefined();
      expect(result.samples).toBeInstanceOf(Uint8Array);
    });
    
    test('should fail when device not connected', async () => {
      await driver.disconnect();
      
      const session = new CaptureSession();
      
      await expect(driver.startCapture(session)).rejects.toThrow('设备未连接');
    });
  });
});
```

### 集成测试

```typescript
// test/integration/end-to-end.test.ts
import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { DecoderManager } from '../../src/decoders/DecoderManager';
import { CaptureSession } from '../../src/models/CaptureSession';

describe('端到端集成测试', () => {
  let driver: LogicAnalyzerDriver;
  let decoderManager: DecoderManager;
  
  beforeAll(() => {
    decoderManager = new DecoderManager();
  });
  
  beforeEach(() => {
    // 使用模拟设备进行测试
    driver = new LogicAnalyzerDriver('mock-device');
  });
  
  test('完整的I2C数据采集和解码流程', async () => {
    // 1. 连接设备
    await driver.connect();
    expect(driver.isConnected).toBe(true);
    
    // 2. 配置采集会话
    const session = new CaptureSession();
    session.frequency = 1000000;
    session.captureChannels = [
      { channelID: 0, channelName: 'SCL' },
      { channelID: 1, channelName: 'SDA' }
    ];
    
    // 3. 开始采集
    const capturePromise = new Promise((resolve) => {
      driver.on('captureComplete', resolve);
    });
    
    await driver.startCapture(session);
    const captureResult = await capturePromise;
    
    // 4. 验证采集结果
    expect(captureResult.samples).toBeDefined();
    expect(captureResult.sampleRate).toBe(1000000);
    
    // 5. 运行I2C解码器
    const decoderResults = await decoderManager.executeDecoder(
      'i2c',
      captureResult.sampleRate,
      captureResult.channels,
      []
    );
    
    // 6. 验证解码结果
    expect(decoderResults).toBeDefined();
    expect(decoderResults.length).toBeGreaterThan(0);
    
    // 查找开始条件
    const startCondition = decoderResults.find(r => r.type === 'start');
    expect(startCondition).toBeDefined();
    
    // 查找地址
    const address = decoderResults.find(r => r.type === 'address');
    expect(address).toBeDefined();
    expect(address.data).toMatch(/0x[0-9A-F]{2}/);
    
    // 7. 断开设备
    await driver.disconnect();
    expect(driver.isConnected).toBe(false);
  }, 10000);
});
```

### 性能测试

```typescript
// test/performance/rendering-performance.test.ts
describe('波形渲染性能测试', () => {
  test('大数据量渲染性能', async () => {
    const sampleCount = 1000000; // 100万样本
    const channelCount = 8;
    
    // 生成测试数据
    const testData = generateTestData(sampleCount, channelCount);
    
    // 测试渲染性能
    const startTime = performance.now();
    
    // 模拟渲染过程
    const renderer = new WaveformRenderer();
    await renderer.render(testData, {
      width: 1920,
      height: 800,
      timeRange: { start: 0, end: sampleCount },
      channels: Array.from({ length: channelCount }, (_, i) => i)
    });
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    console.log(`渲染${sampleCount}个样本耗时: ${renderTime.toFixed(2)}ms`);
    
    // 性能要求：100万样本应在1000ms内渲染完成
    expect(renderTime).toBeLessThan(1000);
    
    // 帧率要求：应达到60fps (16.67ms per frame)
    const framesCount = Math.ceil(renderTime / 16.67);
    expect(framesCount).toBeLessThan(60); // 1秒内的帧数
  });
});
```

## 贡献指南

### 代码规范

#### TypeScript 规范

```typescript
// 使用明确的类型定义
interface DeviceConnectionOptions {
  readonly baudRate: number;
  readonly timeout: number;
  readonly retryCount: number;
}

// 使用枚举而不是字符串常量
enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error'
}

// 使用 readonly 修饰符保护数据
class DeviceInfo {
  constructor(
    public readonly name: string,
    public readonly serialNumber: string,
    public readonly capabilities: Readonly<DeviceCapabilities>
  ) {}
}

// 使用泛型提高代码复用性
interface DataProcessor<T> {
  process(data: T[]): Promise<ProcessedData<T>>;
}
```

#### 命名规范

- **类名**: PascalCase (例: `LogicAnalyzerDriver`)
- **方法名**: camelCase (例: `startCapture()`)
- **常量**: UPPER_SNAKE_CASE (例: `MAX_SAMPLE_RATE`)
- **接口**: PascalCase, 以 'I' 开头 (例: `IAnalyzerDriver`)
- **类型**: PascalCase (例: `CaptureSession`)
- **枚举**: PascalCase (例: `TriggerType`)

#### 注释规范

```typescript
/**
 * 逻辑分析器驱动基类
 * 
 * 提供硬件抽象层接口，所有具体的硬件驱动都应继承此类
 * 
 * @example
 * ```typescript
 * class MyDriver extends AnalyzerDriverBase {
 *   // 实现抽象方法
 * }
 * ```
 */
abstract class AnalyzerDriverBase {
  /**
   * 连接到设备
   * 
   * @throws {ConnectionError} 当连接失败时抛出
   * @returns Promise that resolves when connection is established
   */
  abstract connect(): Promise<void>;
  
  /**
   * 开始数据采集
   * 
   * @param session - 采集会话配置
   * @param progressCallback - 进度回调函数 (可选)
   * @returns Promise that resolves when capture starts
   */
  abstract startCapture(
    session: CaptureSession, 
    progressCallback?: (progress: number) => void
  ): Promise<void>;
}
```

### 提交规范

#### Commit Message 格式

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的脚注]
```

#### 类型说明

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建工具、依赖管理等

#### 示例

```bash
feat(drivers): add Saleae Logic Pro 16 support

- Add new driver class for Logic Pro 16
- Implement high-speed data acquisition
- Add device detection and capabilities query
- Update device manager registration

Closes #123
```

### Pull Request 流程

1. **Fork 仓库**
   ```bash
   git clone https://github.com/your-username/vscode-logicanalyzer.git
   cd vscode-logicanalyzer
   git remote add upstream https://github.com/original-repo/vscode-logicanalyzer.git
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **开发和测试**
   ```bash
   # 开发代码
   npm run dev
   
   # 运行测试
   npm test
   
   # 类型检查
   npm run typecheck
   
   # 代码检查
   npm run lint
   ```

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat(scope): add new feature"
   ```

5. **推送到GitHub**
   ```bash
   git push origin feature/my-new-feature
   ```

6. **创建Pull Request**
   - 提供清晰的标题和描述
   - 关联相关的Issue
   - 确保所有检查通过
   - 请求代码审查

### 代码审查清单

#### 功能性检查
- [ ] 功能按预期工作
- [ ] 边界条件处理正确
- [ ] 错误处理完善
- [ ] 性能满足要求

#### 代码质量检查
- [ ] 代码结构清晰
- [ ] 命名规范一致
- [ ] 注释充分且准确
- [ ] 无重复代码

#### 测试检查
- [ ] 单元测试覆盖核心逻辑
- [ ] 集成测试验证完整流程
- [ ] 测试用例充分
- [ ] 所有测试通过

#### 文档检查
- [ ] API文档更新
- [ ] 用户手册更新
- [ ] 变更日志更新
- [ ] 示例代码正确

## 发布流程

### 版本管理

使用语义化版本控制：

- **主版本号**: 不兼容的API更改
- **次版本号**: 向后兼容的功能性新增
- **修订号**: 向后兼容的问题修正

### 发布步骤

1. **更新版本号**
   ```bash
   npm version patch  # 修订版本
   npm version minor  # 次版本
   npm version major  # 主版本
   ```

2. **更新变更日志**
   ```markdown
   # Changelog
   
   ## [1.2.0] - 2024-01-15
   
   ### Added
   - 新增Kingst LA1010设备支持
   - 添加SPI协议解码器
   
   ### Changed
   - 优化波形渲染性能
   - 改进错误提示信息
   
   ### Fixed
   - 修复内存泄漏问题
   - 解决跨平台兼容性问题
   ```

3. **构建和测试**
   ```bash
   npm run build
   npm run test:all
   npm run package
   ```

4. **创建发布**
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

5. **发布到市场**
   ```bash
   # 发布到VSCode扩展市场
   vsce publish
   
   # 或发布到Open VSX
   ovsx publish
   ```

---

这份开发者指南涵盖了项目开发的各个方面。如需更详细的信息，请参考：

- [API参考文档](api-reference.md)
- [用户手册](user-manual.md)  
- [项目架构文档](architecture.md)

欢迎加入我们的开发者社区！
