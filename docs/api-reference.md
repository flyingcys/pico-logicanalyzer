# VSCode 逻辑分析器插件 - API 参考文档

## 📖 目录

1. [核心接口](#核心接口)
2. [硬件驱动API](#硬件驱动api)
3. [协议解码器API](#协议解码器api)
4. [数据模型](#数据模型)
5. [事件系统](#事件系统)
6. [工具函数](#工具函数)
7. [VSCode扩展API](#vscode扩展api)
8. [前端WebView API](#前端webview-api)
9. [配置选项](#配置选项)
10. [错误处理](#错误处理)

## 核心接口

### IAnalyzerDriver

所有逻辑分析器驱动必须实现的核心接口。

```typescript
interface IAnalyzerDriver {
  readonly deviceInfo: DeviceInfo;
  readonly capabilities: HardwareCapabilities;
  readonly connectionStatus: ConnectionStatus;
  
  // 连接管理
  connect(params?: ConnectionParams): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  
  // 数据采集
  startCapture(config: CaptureConfiguration): Promise<CaptureResult>;
  stopCapture(): Promise<void>;
  
  // 事件系统
  on(event: 'data' | 'error' | 'status', callback: Function): void;
  off(event: 'data' | 'error' | 'status', callback: Function): void;
}
```

#### 参数类型

```typescript
interface ConnectionParams {
  baudRate?: number;
  timeout?: number;
  retryCount?: number;
}

interface ConnectionResult {
  success: boolean;
  deviceInfo?: DeviceInfo;
  error?: string;
}

interface CaptureConfiguration {
  frequency: number;
  channels: number[];
  triggerType: TriggerType;
  triggerValue?: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
}

interface CaptureResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}
```

### IDecoder

协议解码器接口定义。

```typescript
interface IDecoder {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly channels: DecoderChannel[];
  readonly options: DecoderOption[];
  readonly annotations: string[][];
  
  // 解码方法
  decode(
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: DecoderOptionValue[]
  ): Promise<DecoderResult[]>;
  
  // 状态方法
  reset(): void;
  getState(): DecoderState;
}
```

## 硬件驱动API

### AnalyzerDriverBase

硬件驱动抽象基类，提供通用功能实现。

```typescript
abstract class AnalyzerDriverBase implements IAnalyzerDriver {
  // 设备属性（子类必须实现）
  abstract readonly deviceVersion: string;
  abstract readonly channelCount: number;
  abstract readonly maxFrequency: number;
  
  // 连接状态
  protected isConnected: boolean = false;
  protected currentSession: CaptureSession | null = null;
  
  // 构造函数
  constructor(portPath: string, options?: DriverOptions) {
    this.portPath = portPath;
    this.options = { ...defaultOptions, ...options };
  }
  
  // 公共方法
  getDeviceInfo(): DeviceInfo;
  getCapabilities(): HardwareCapabilities;
  getCurrentSession(): CaptureSession | null;
  
  // 抽象方法（子类必须实现）
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract startCapture(session: CaptureSession): Promise<void>;
  
  // 事件系统
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  protected emit(event: string, ...args: any[]): void;
}
```

#### 使用示例

```typescript
import { AnalyzerDriverBase } from './base/AnalyzerDriverBase';

class MyCustomDriver extends AnalyzerDriverBase {
  readonly deviceVersion = '2.1.0';
  readonly channelCount = 16;
  readonly maxFrequency = 200000000; // 200MHz
  
  async connect(): Promise<void> {
    try {
      // 实现设备连接逻辑
      await this.establishConnection();
      this.isConnected = true;
      this.emit('connected');
    } catch (error) {
      this.emit('error', new ConnectionError('连接失败', error));
      throw error;
    }
  }
  
  async startCapture(session: CaptureSession): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }
    
    this.currentSession = session;
    
    // 配置硬件
    await this.configureHardware(session);
    
    // 开始采集
    await this.beginSampling();
    
    this.emit('captureStarted', session);
  }
  
  private async configureHardware(session: CaptureSession): Promise<void> {
    // 硬件配置实现
  }
}
```

### LogicAnalyzerDriver

具体的逻辑分析器驱动实现，兼容原项目协议。

```typescript
class LogicAnalyzerDriver extends AnalyzerDriverBase {
  // 设备特定配置
  private static readonly DEVICE_CONFIG = {
    BAUD_RATE: 115200,
    TIMEOUT: 5000,
    MAX_RETRY: 3
  };
  
  // 协议常量
  private static readonly PROTOCOL = {
    PACKET_START: [0x55, 0xAA],
    PACKET_END: [0xAA, 0x55],
    ESCAPE_BYTE: 0xF0
  };
  
  constructor(portPath: string) {
    super(portPath);
  }
  
  // 设备信息查询
  async queryDeviceInfo(): Promise<DeviceInfo> {
    const command = this.buildCommand('GET_DEVICE_INFO');
    const response = await this.sendCommand(command);
    return this.parseDeviceInfo(response);
  }
  
  // 能力查询
  async queryCapabilities(): Promise<HardwareCapabilities> {
    const command = this.buildCommand('GET_CAPABILITIES');
    const response = await this.sendCommand(command);
    return this.parseCapabilities(response);
  }
  
  // 采集配置
  async configureSampling(config: SamplingConfig): Promise<void> {
    const command = this.buildSamplingCommand(config);
    await this.sendCommand(command);
  }
  
  // 数据接收处理
  private handleDataReceived(data: Buffer): void {
    try {
      const packet = this.parseDataPacket(data);
      this.processSampleData(packet);
    } catch (error) {
      this.emit('error', new DataProcessingError('数据处理失败', error));
    }
  }
  
  // 命令构建
  private buildCommand(type: string, payload?: Uint8Array): Uint8Array {
    // 实现协议命令构建
  }
  
  // 数据包解析
  private parseDataPacket(data: Buffer): DataPacket {
    // 实现协议数据包解析
  }
}
```

### MultiAnalyzerDriver

多设备管理驱动。

```typescript
class MultiAnalyzerDriver {
  private drivers: Map<string, AnalyzerDriverBase> = new Map();
  private syncEnabled: boolean = false;
  
  // 添加设备
  addDevice(id: string, driver: AnalyzerDriverBase): void {
    this.drivers.set(id, driver);
    this.setupDeviceEvents(id, driver);
  }
  
  // 移除设备
  removeDevice(id: string): void {
    const driver = this.drivers.get(id);
    if (driver) {
      driver.disconnect();
      this.drivers.delete(id);
    }
  }
  
  // 同步采集
  async startSyncCapture(configs: Map<string, CaptureSession>): Promise<void> {
    if (!this.syncEnabled) {
      throw new Error('同步功能未启用');
    }
    
    const capturePromises: Promise<void>[] = [];
    
    for (const [deviceId, config] of configs) {
      const driver = this.drivers.get(deviceId);
      if (driver) {
        capturePromises.push(driver.startCapture(config));
      }
    }
    
    await Promise.all(capturePromises);
  }
  
  // 启用同步
  enableSync(masterDeviceId: string): void {
    this.syncEnabled = true;
    // 配置主从同步
  }
  
  private setupDeviceEvents(id: string, driver: AnalyzerDriverBase): void {
    driver.on('data', (data) => {
      this.emit('deviceData', { deviceId: id, data });
    });
    
    driver.on('error', (error) => {
      this.emit('deviceError', { deviceId: id, error });
    });
  }
}
```

## 协议解码器API

### DecoderBase

解码器抽象基类。

```typescript
abstract class DecoderBase implements IDecoder {
  // 解码器元数据
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly channels: DecoderChannel[];
  abstract readonly options: DecoderOption[];
  abstract readonly annotations: string[][];
  
  // 解码状态
  protected sampleRate: number = 0;
  protected channelData: Map<string, AnalyzerChannel> = new Map();
  protected results: DecoderResult[] = [];
  
  // 主解码方法
  async decode(
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: DecoderOptionValue[]
  ): Promise<DecoderResult[]> {
    this.reset();
    this.sampleRate = sampleRate;
    this.mapChannels(channels);
    this.setOptions(options);
    
    return this.performDecode();
  }
  
  // 抽象解码实现
  protected abstract performDecode(): Promise<DecoderResult[]>;
  
  // 辅助方法
  protected wait(conditions: WaitCondition): WaitResult {
    // 等待特定条件
  }
  
  protected put(startSample: number, endSample: number, data: DecoderOutput): void {
    this.results.push({
      startSample,
      endSample,
      type: data.type,
      data: data.data,
      annotation: data.annotation
    });
  }
  
  protected getChannel(channelId: string): AnalyzerChannel | undefined {
    return this.channelData.get(channelId);
  }
  
  // 状态管理
  reset(): void {
    this.results = [];
    this.channelData.clear();
  }
  
  getState(): DecoderState {
    return {
      isDecoding: false,
      progress: 100,
      resultCount: this.results.length
    };
  }
}
```

### I2CDecoder

I2C协议解码器实现。

```typescript
class I2CDecoder extends DecoderBase {
  readonly id = 'i2c';
  readonly name = 'I2C';
  readonly description = 'Inter-Integrated Circuit protocol decoder';
  
  readonly channels: DecoderChannel[] = [
    {
      id: 'scl',
      name: 'SCL',
      description: 'Serial Clock Line',
      required: true
    },
    {
      id: 'sda',
      name: 'SDA', 
      description: 'Serial Data Line',
      required: true
    }
  ];
  
  readonly options: DecoderOption[] = [
    {
      id: 'address_format',
      name: 'Address Format',
      description: 'Address display format',
      type: 'enum',
      default: 'hex',
      values: [
        { value: 'hex', label: 'Hexadecimal' },
        { value: 'dec', label: 'Decimal' },
        { value: 'bin', label: 'Binary' }
      ]
    }
  ];
  
  readonly annotations = [
    ['start', 'Start condition'],
    ['repeat-start', 'Repeat start condition'], 
    ['stop', 'Stop condition'],
    ['ack', 'ACK'],
    ['nack', 'NACK'],
    ['address-read', 'Address read'],
    ['address-write', 'Address write'],
    ['data-read', 'Data read'],
    ['data-write', 'Data write']
  ];
  
  protected async performDecode(): Promise<DecoderResult[]> {
    const scl = this.getChannel('scl');
    const sda = this.getChannel('sda');
    
    if (!scl || !sda) {
      throw new Error('Missing required channels');
    }
    
    let state = 'IDLE';
    let bitIndex = 0;
    let currentByte = 0;
    let address = 0;
    let isRead = false;
    
    for (let i = 1; i < scl.samples.length; i++) {
      // 检测I2C条件
      if (this.isStartCondition(scl.samples, sda.samples, i)) {
        this.put(i, i + 1, {
          type: 'start',
          data: 'START',
          annotation: 0
        });
        
        state = 'ADDRESS';
        bitIndex = 0;
        currentByte = 0;
        continue;
      }
      
      if (this.isStopCondition(scl.samples, sda.samples, i)) {
        this.put(i, i + 1, {
          type: 'stop', 
          data: 'STOP',
          annotation: 2
        });
        
        state = 'IDLE';
        continue;
      }
      
      // 时钟上升沿数据采样
      if (this.isRisingEdge(scl.samples, i)) {
        const dataBit = sda.samples[i];
        
        switch (state) {
          case 'ADDRESS':
            if (bitIndex < 7) {
              currentByte = (currentByte << 1) | dataBit;
              bitIndex++;
            } else {
              // R/W bit
              isRead = dataBit === 1;
              address = currentByte;
              
              this.put(i - 7, i + 1, {
                type: isRead ? 'address-read' : 'address-write',
                data: this.formatAddress(address, isRead),
                annotation: isRead ? 5 : 6
              });
              
              state = 'ACK_ADDRESS';
            }
            break;
            
          case 'ACK_ADDRESS':
            this.put(i, i + 1, {
              type: dataBit === 0 ? 'ack' : 'nack',
              data: dataBit === 0 ? 'ACK' : 'NACK',
              annotation: dataBit === 0 ? 3 : 4
            });
            
            state = isRead ? 'DATA_READ' : 'DATA_WRITE';
            bitIndex = 0;
            currentByte = 0;
            break;
            
          case 'DATA_WRITE':
          case 'DATA_READ':
            if (bitIndex < 8) {
              currentByte = (currentByte << 1) | dataBit;
              bitIndex++;
              
              if (bitIndex === 8) {
                this.put(i - 7, i + 1, {
                  type: state === 'DATA_READ' ? 'data-read' : 'data-write',
                  data: this.formatData(currentByte),
                  annotation: state === 'DATA_READ' ? 7 : 8
                });
                
                state = state === 'DATA_READ' ? 'ACK_DATA_READ' : 'ACK_DATA_WRITE';
                bitIndex = 0;
                currentByte = 0;
              }
            }
            break;
            
          case 'ACK_DATA_READ':
          case 'ACK_DATA_WRITE':
            this.put(i, i + 1, {
              type: dataBit === 0 ? 'ack' : 'nack',
              data: dataBit === 0 ? 'ACK' : 'NACK', 
              annotation: dataBit === 0 ? 3 : 4
            });
            
            state = state === 'ACK_DATA_READ' ? 'DATA_READ' : 'DATA_WRITE';
            break;
        }
      }
    }
    
    return this.results;
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
  
  private isRisingEdge(samples: Uint8Array, i: number): boolean {
    return i > 0 && samples[i - 1] === 0 && samples[i] === 1;
  }
  
  private formatAddress(address: number, isRead: boolean): string {
    const rw = isRead ? 'R' : 'W';
    return `0x${address.toString(16).toUpperCase().padStart(2, '0')} ${rw}`;
  }
  
  private formatData(data: number): string {
    return `0x${data.toString(16).toUpperCase().padStart(2, '0')}`;
  }
}
```

### DecoderManager

解码器管理器，负责注册和执行解码器。

```typescript
class DecoderManager {
  private decoders: Map<string, DecoderBase> = new Map();
  private runningDecoders: Map<string, Promise<DecoderResult[]>> = new Map();
  
  // 注册解码器
  registerDecoder(decoder: DecoderBase): void {
    this.decoders.set(decoder.id, decoder);
  }
  
  // 获取解码器
  getDecoder(id: string): DecoderBase | undefined {
    return this.decoders.get(id);
  }
  
  // 获取所有解码器
  getAvailableDecoders(): DecoderInfo[] {
    return Array.from(this.decoders.values()).map(decoder => ({
      id: decoder.id,
      name: decoder.name,
      description: decoder.description,
      channels: decoder.channels,
      options: decoder.options
    }));
  }
  
  // 搜索解码器
  searchDecoders(query: string): DecoderInfo[] {
    const results: DecoderInfo[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const decoder of this.decoders.values()) {
      if (decoder.name.toLowerCase().includes(lowerQuery) ||
          decoder.description.toLowerCase().includes(lowerQuery) ||
          decoder.id.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: decoder.id,
          name: decoder.name,
          description: decoder.description,
          channels: decoder.channels,
          options: decoder.options
        });
      }
    }
    
    return results;
  }
  
  // 执行解码
  async executeDecoder(
    decoderId: string,
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: DecoderOptionValue[]
  ): Promise<DecoderResult[]> {
    const decoder = this.getDecoder(decoderId);
    if (!decoder) {
      throw new Error(`Unknown decoder: ${decoderId}`);
    }
    
    // 检查是否已在运行
    if (this.runningDecoders.has(decoderId)) {
      throw new Error(`Decoder ${decoderId} is already running`);
    }
    
    try {
      const promise = decoder.decode(sampleRate, channels, options);
      this.runningDecoders.set(decoderId, promise);
      
      const results = await promise;
      return results;
    } finally {
      this.runningDecoders.delete(decoderId);
    }
  }
  
  // 停止解码
  async stopDecoder(decoderId: string): Promise<void> {
    const decoder = this.getDecoder(decoderId);
    if (decoder && typeof decoder.stop === 'function') {
      await decoder.stop();
    }
    
    this.runningDecoders.delete(decoderId);
  }
  
  // 创建解码器实例
  createDecoder(decoderId: string): DecoderBase | undefined {
    const decoder = this.getDecoder(decoderId);
    if (!decoder) {
      return undefined;
    }
    
    // 返回新实例（如果解码器支持克隆）
    if (typeof decoder.clone === 'function') {
      return decoder.clone();
    }
    
    return decoder;
  }
}
```

## 数据模型

### CaptureSession

数据采集会话配置。

```typescript
class CaptureSession {
  // 基本配置
  public frequency: number = 1000000;
  public preTriggerSamples: number = 1000;
  public postTriggerSamples: number = 10000;
  public loopCount: number = 0;
  
  // 触发配置
  public triggerType: TriggerType = TriggerType.None;
  public trigger: number = 0;
  public triggerValue: number = 0;
  
  // 通道配置  
  public captureChannels: AnalyzerChannel[] = [];
  
  // 计算属性
  get totalSamples(): number {
    return this.preTriggerSamples + this.postTriggerSamples * (this.loopCount + 1);
  }
  
  get estimatedDuration(): number {
    return this.totalSamples / this.frequency;
  }
  
  get estimatedMemoryUsage(): number {
    const bytesPerSample = Math.ceil(this.captureChannels.length / 8);
    return this.totalSamples * bytesPerSample;
  }
  
  // 验证配置
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (this.frequency <= 0) {
      errors.push('Frequency must be positive');
    }
    
    if (this.preTriggerSamples < 0) {
      errors.push('Pre-trigger samples cannot be negative');
    }
    
    if (this.postTriggerSamples <= 0) {
      errors.push('Post-trigger samples must be positive');
    }
    
    if (this.captureChannels.length === 0) {
      errors.push('At least one channel must be selected');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // 克隆会话
  clone(): CaptureSession {
    const cloned = new CaptureSession();
    cloned.frequency = this.frequency;
    cloned.preTriggerSamples = this.preTriggerSamples;
    cloned.postTriggerSamples = this.postTriggerSamples;
    cloned.loopCount = this.loopCount;
    cloned.triggerType = this.triggerType;
    cloned.trigger = this.trigger;
    cloned.triggerValue = this.triggerValue;
    cloned.captureChannels = this.captureChannels.map(ch => ch.clone());
    
    return cloned;
  }
}
```

### AnalyzerChannel

分析器通道数据模型。

```typescript
class AnalyzerChannel {
  public channelID: number;
  public channelName: string;
  public samples: Uint8Array;
  public enabled: boolean = true;
  public voltageThreshold: number = 1.65;
  
  constructor(channelID: number, channelName: string) {
    this.channelID = channelID;
    this.channelName = channelName;
    this.samples = new Uint8Array(0);
  }
  
  // 数据统计
  get totalSamples(): number {
    return this.samples.length;
  }
  
  get highCount(): number {
    return Array.from(this.samples).filter(s => s === 1).length;
  }
  
  get lowCount(): number {
    return this.totalSamples - this.highCount;
  }
  
  get dutyCycle(): number {
    return this.totalSamples > 0 ? this.highCount / this.totalSamples : 0;
  }
  
  // 边沿检测
  getEdges(type: 'rising' | 'falling' | 'both' = 'both'): number[] {
    const edges: number[] = [];
    
    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1];
      const curr = this.samples[i];
      
      if (type === 'rising' && prev === 0 && curr === 1) {
        edges.push(i);
      } else if (type === 'falling' && prev === 1 && curr === 0) {
        edges.push(i);
      } else if (type === 'both' && prev !== curr) {
        edges.push(i);
      }
    }
    
    return edges;
  }
  
  // 脉冲检测
  getPulses(minWidth: number = 1): Pulse[] {
    const pulses: Pulse[] = [];
    let pulseStart = -1;
    let inPulse = false;
    
    for (let i = 0; i < this.samples.length; i++) {
      if (!inPulse && this.samples[i] === 1) {
        pulseStart = i;
        inPulse = true;
      } else if (inPulse && this.samples[i] === 0) {
        const width = i - pulseStart;
        if (width >= minWidth) {
          pulses.push({
            start: pulseStart,
            end: i - 1,
            width: width
          });
        }
        inPulse = false;
      }
    }
    
    return pulses;
  }
  
  // 克隆通道
  clone(): AnalyzerChannel {
    const cloned = new AnalyzerChannel(this.channelID, this.channelName);
    cloned.samples = new Uint8Array(this.samples);
    cloned.enabled = this.enabled;
    cloned.voltageThreshold = this.voltageThreshold;
    return cloned;
  }
}
```

### DeviceInfo

设备信息模型。

```typescript
interface DeviceInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly serialNumber: string;
  readonly manufacturer: string;
  readonly channels: number;
  readonly maxSampleRate: number;
  readonly supportedVoltages: number[];
  readonly capabilities: DeviceCapabilities;
  readonly status: DeviceStatus;
}

interface DeviceCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsRLE: boolean;
  readonly supportsExternalTrigger: boolean;
  readonly maxBufferSize: number;
  readonly supportedProtocols: string[];
}

enum DeviceStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting', 
  Connected = 'connected',
  Capturing = 'capturing',
  Error = 'error'
}
```

## 事件系统

### EventEmitter

基础事件发射器实现。

```typescript
class EventEmitter {
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
  
  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
  
  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Event listener error for '${event}':`, error);
        }
      });
    }
  }
  
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}
```

### 驱动事件

```typescript
// 驱动事件类型
interface DriverEvents {
  'connected': () => void;
  'disconnected': () => void;
  'captureStarted': (session: CaptureSession) => void;
  'captureProgress': (progress: number) => void;
  'captureComplete': (data: CaptureData) => void;
  'captureStopped': () => void;
  'data': (chunk: DataChunk) => void;
  'error': (error: Error) => void;
  'statusChanged': (status: DeviceStatus) => void;
}

// 使用示例
driver.on('captureProgress', (progress: number) => {
  console.log(`Capture progress: ${progress}%`);
  updateProgressBar(progress);
});

driver.on('error', (error: Error) => {
  console.error('Driver error:', error);
  showErrorMessage(error.message);
});
```

### 解码器事件

```typescript
interface DecoderEvents {
  'started': () => void;
  'progress': (progress: number) => void;
  'result': (result: DecoderResult) => void;
  'completed': (results: DecoderResult[]) => void;
  'error': (error: Error) => void;
}

// 使用示例
decoder.on('result', (result: DecoderResult) => {
  console.log('Decoder result:', result);
  addResultToView(result);
});
```

## 工具函数

### 数据转换工具

```typescript
namespace DataUtils {
  // 字节数组转换
  export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  export function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
  
  // 位操作
  export function getBit(value: number, position: number): number {
    return (value >> position) & 1;
  }
  
  export function setBit(value: number, position: number, bit: number): number {
    if (bit) {
      return value | (1 << position);
    } else {
      return value & ~(1 << position);
    }
  }
  
  // 数据压缩
  export function compressRLE(data: Uint8Array): CompressedData {
    const compressed: number[] = [];
    let count = 1;
    let current = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i] === current && count < 255) {
        count++;
      } else {
        compressed.push(current, count);
        current = data[i];
        count = 1;
      }
    }
    
    compressed.push(current, count);
    
    return {
      data: new Uint8Array(compressed),
      originalSize: data.length,
      compressedSize: compressed.length
    };
  }
}
```

### 时间格式化工具

```typescript
namespace TimeUtils {
  export function formatTime(nanoseconds: number): string {
    if (nanoseconds >= 1e9) {
      return `${(nanoseconds / 1e9).toFixed(3)} s`;
    } else if (nanoseconds >= 1e6) {
      return `${(nanoseconds / 1e6).toFixed(3)} ms`;
    } else if (nanoseconds >= 1e3) {
      return `${(nanoseconds / 1e3).toFixed(3)} µs`;
    } else {
      return `${nanoseconds.toFixed(0)} ns`;
    }
  }
  
  export function formatFrequency(hertz: number): string {
    if (hertz >= 1e9) {
      return `${(hertz / 1e9).toFixed(3)} GHz`;
    } else if (hertz >= 1e6) {
      return `${(hertz / 1e6).toFixed(3)} MHz`;
    } else if (hertz >= 1e3) {
      return `${(hertz / 1e3).toFixed(3)} kHz`;
    } else {
      return `${hertz.toFixed(0)} Hz`;
    }
  }
  
  export function calculateDuration(samples: number, sampleRate: number): number {
    return (samples / sampleRate) * 1e9; // 返回纳秒
  }
}
```

### 验证工具

```typescript
namespace ValidationUtils {
  export function validateFrequency(frequency: number, maxFrequency: number): ValidationResult {
    if (frequency <= 0) {
      return { isValid: false, error: '频率必须大于0' };
    }
    
    if (frequency > maxFrequency) {
      return { isValid: false, error: `频率不能超过 ${maxFrequency} Hz` };
    }
    
    return { isValid: true };
  }
  
  export function validateChannels(channels: number[], maxChannels: number): ValidationResult {
    if (channels.length === 0) {
      return { isValid: false, error: '至少需要选择一个通道' };
    }
    
    for (const channel of channels) {
      if (channel < 0 || channel >= maxChannels) {
        return { isValid: false, error: `通道号必须在 0-${maxChannels - 1} 范围内` };
      }
    }
    
    return { isValid: true };
  }
  
  export function validateSampleCount(samples: number): ValidationResult {
    const maxSamples = 100000000; // 1亿样本
    
    if (samples <= 0) {
      return { isValid: false, error: '样本数必须大于0' };
    }
    
    if (samples > maxSamples) {
      return { isValid: false, error: `样本数不能超过 ${maxSamples}` };
    }
    
    return { isValid: true };
  }
}
```

## VSCode扩展API

### 主扩展入口

```typescript
// extension.ts
import * as vscode from 'vscode';
import { LogicAnalyzerProvider } from './providers/LogicAnalyzerProvider';
import { DeviceManager } from './managers/DeviceManager';

export function activate(context: vscode.ExtensionContext) {
  // 创建主要服务
  const deviceManager = new DeviceManager();
  const logicAnalyzerProvider = new LogicAnalyzerProvider(context, deviceManager);
  
  // 注册命令
  const commands = [
    vscode.commands.registerCommand('logicAnalyzer.refreshDevices', () => {
      return deviceManager.refreshDevices();
    }),
    
    vscode.commands.registerCommand('logicAnalyzer.connectDevice', (deviceId: string) => {
      return deviceManager.connectDevice(deviceId);
    }),
    
    vscode.commands.registerCommand('logicAnalyzer.startCapture', () => {
      return logicAnalyzerProvider.startCapture();
    }),
    
    vscode.commands.registerCommand('logicAnalyzer.openAnalyzer', () => {
      return logicAnalyzerProvider.show();
    })
  ];
  
  // 注册WebView提供者
  const webviewProvider = vscode.window.registerWebviewViewProvider(
    'logicAnalyzer.mainView',
    logicAnalyzerProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );
  
  // 注册状态栏
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'logicAnalyzer.openAnalyzer';
  statusBarItem.text = '$(pulse) Logic Analyzer';
  statusBarItem.show();
  
  // 清理资源
  context.subscriptions.push(
    ...commands,
    webviewProvider,
    statusBarItem,
    deviceManager
  );
}

export function deactivate() {
  // 清理资源
}
```

### WebView提供者

```typescript
class LogicAnalyzerProvider implements vscode.WebviewViewProvider {
  private webview?: vscode.Webview;
  
  constructor(
    private context: vscode.ExtensionContext,
    private deviceManager: DeviceManager
  ) {}
  
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    this.webview = webviewView.webview;
    
    // 配置webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    
    // 设置HTML内容
    webviewView.webview.html = this.getWebviewContent();
    
    // 处理消息
    webviewView.webview.onDidReceiveMessage(
      this.handleMessage.bind(this),
      undefined,
      this.context.subscriptions
    );
  }
  
  private async handleMessage(message: any) {
    switch (message.command) {
      case 'detectDevices':
        try {
          const devices = await this.deviceManager.detectDevices();
          this.postMessage({ command: 'devicesDetected', devices });
        } catch (error) {
          this.postMessage({ command: 'error', error: error.message });
        }
        break;
        
      case 'connectDevice':
        try {
          await this.deviceManager.connectDevice(message.deviceId);
          this.postMessage({ command: 'deviceConnected', deviceId: message.deviceId });
        } catch (error) {
          this.postMessage({ command: 'error', error: error.message });
        }
        break;
        
      case 'startCapture':
        try {
          const result = await this.deviceManager.startCapture(message.config);
          this.postMessage({ command: 'captureStarted', result });
        } catch (error) {
          this.postMessage({ command: 'error', error: error.message });
        }
        break;
    }
  }
  
  private postMessage(message: any) {
    if (this.webview) {
      this.webview.postMessage(message);
    }
  }
  
  private getWebviewContent(): string {
    const scriptUri = this.webview!.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    
    const styleUri = this.webview!.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.css')
    );
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>Logic Analyzer</title>
      </head>
      <body>
        <div id="app"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }
}
```

## 前端WebView API

### Vue应用入口

```typescript
// webview/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import App from './App.vue';

// VSCode WebView API类型定义
declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: any): void;
      setState(state: any): void;
      getState(): any;
    };
  }
}

const vscode = window.acquireVsCodeApi();

const app = createApp(App);
app.use(createPinia());
app.use(ElementPlus);

// 全局提供VSCode API
app.provide('vscode', vscode);

app.mount('#app');
```

### 通信工具类

```typescript
// webview/utils/vscode-api.ts
class VSCodeAPI {
  private vscode: any;
  private messageHandlers: Map<string, Function[]> = new Map();
  
  constructor() {
    this.vscode = (window as any).acquireVsCodeApi();
    
    // 监听消息
    window.addEventListener('message', this.handleMessage.bind(this));
  }
  
  // 发送消息到扩展
  postMessage(command: string, data?: any): void {
    this.vscode.postMessage({ command, ...data });
  }
  
  // 监听消息
  onMessage(command: string, handler: Function): void {
    if (!this.messageHandlers.has(command)) {
      this.messageHandlers.set(command, []);
    }
    this.messageHandlers.get(command)!.push(handler);
  }
  
  // 移除消息监听
  offMessage(command: string, handler: Function): void {
    const handlers = this.messageHandlers.get(command);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  // 处理接收到的消息
  private handleMessage(event: MessageEvent): void {
    const message = event.data;
    const handlers = this.messageHandlers.get(message.command);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Message handler error for '${message.command}':`, error);
        }
      });
    }
  }
  
  // 状态管理
  setState(state: any): void {
    this.vscode.setState(state);
  }
  
  getState(): any {
    return this.vscode.getState();
  }
}

export const vsCodeAPI = new VSCodeAPI();
```

## 配置选项

### 扩展配置

```json
{
  "configuration": {
    "title": "Logic Analyzer",
    "properties": {
      "logicAnalyzer.defaultSampleRate": {
        "type": "number",
        "default": 1000000,
        "description": "Default sampling rate in Hz"
      },
      "logicAnalyzer.maxBufferSize": {
        "type": "number",
        "default": 10000000,
        "description": "Maximum buffer size in samples"
      },
      "logicAnalyzer.theme": {
        "type": "string",
        "enum": ["light", "dark", "auto"],
        "default": "auto",
        "description": "UI theme preference"
      },
      "logicAnalyzer.protocols.i2c.defaultOptions": {
        "type": "object",
        "default": {
          "addressFormat": "hex",
          "showAcks": true
        },
        "description": "Default I2C decoder options"
      }
    }
  }
}
```

### 用户配置类

```typescript
class Configuration {
  private config: vscode.WorkspaceConfiguration;
  
  constructor() {
    this.config = vscode.workspace.getConfiguration('logicAnalyzer');
  }
  
  // 获取配置值
  get<T>(key: string): T | undefined {
    return this.config.get<T>(key);
  }
  
  // 设置配置值
  async set<T>(key: string, value: T, target?: vscode.ConfigurationTarget): Promise<void> {
    await this.config.update(key, value, target);
  }
  
  // 便捷方法
  get defaultSampleRate(): number {
    return this.get<number>('defaultSampleRate') || 1000000;
  }
  
  get maxBufferSize(): number {
    return this.get<number>('maxBufferSize') || 10000000;
  }
  
  get theme(): 'light' | 'dark' | 'auto' {
    return this.get<'light' | 'dark' | 'auto'>('theme') || 'auto';
  }
  
  // 监听配置变化
  onDidChangeConfiguration(listener: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(listener);
  }
}
```

## 错误处理

### 错误类定义

```typescript
// 基础错误类
abstract class LogicAnalyzerError extends Error {
  abstract readonly code: string;
  abstract readonly category: string;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

// 连接错误
class ConnectionError extends LogicAnalyzerError {
  readonly code = 'CONNECTION_ERROR';
  readonly category = 'Hardware';
  
  constructor(message: string, cause?: Error) {
    super(`连接错误: ${message}`, cause);
  }
}

// 数据采集错误
class CaptureError extends LogicAnalyzerError {
  readonly code = 'CAPTURE_ERROR';
  readonly category = 'Data';
  
  constructor(message: string, cause?: Error) {
    super(`采集错误: ${message}`, cause);
  }
}

// 解码错误
class DecoderError extends LogicAnalyzerError {
  readonly code = 'DECODER_ERROR';
  readonly category = 'Protocol';
  
  constructor(message: string, public readonly decoderId: string, cause?: Error) {
    super(`解码错误 [${decoderId}]: ${message}`, cause);
  }
}

// 配置错误
class ConfigurationError extends LogicAnalyzerError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = 'Configuration';
  
  constructor(message: string, cause?: Error) {
    super(`配置错误: ${message}`, cause);
  }
}
```

### 错误处理器

```typescript
class ErrorHandler {
  private static handlers: Map<string, (error: LogicAnalyzerError) => void> = new Map();
  
  // 注册错误处理器
  static registerHandler(errorCode: string, handler: (error: LogicAnalyzerError) => void): void {
    this.handlers.set(errorCode, handler);
  }
  
  // 处理错误
  static handle(error: Error): void {
    if (error instanceof LogicAnalyzerError) {
      const handler = this.handlers.get(error.code);
      if (handler) {
        handler(error);
        return;
      }
    }
    
    // 默认处理
    this.defaultHandler(error);
  }
  
  // 默认错误处理
  private static defaultHandler(error: Error): void {
    console.error('Unhandled error:', error);
    
    // 显示错误通知
    if (typeof vscode !== 'undefined') {
      vscode.window.showErrorMessage(`错误: ${error.message}`);
    }
  }
  
  // 创建错误报告
  static createErrorReport(error: Error): ErrorReport {
    return {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      platform: process.platform,
      nodeVersion: process.version
    };
  }
}

interface ErrorReport {
  timestamp: string;
  message: string;
  stack?: string;
  type: string;
  platform: string;
  nodeVersion: string;
}
```

---

这份API参考文档涵盖了插件的所有核心接口和使用方法。更多详细信息请参考：

- [用户手册](user-manual.md) - 使用指南
- [开发者指南](developer-guide.md) - 开发指南  
- [项目架构](architecture.md) - 架构设计