/**
 * 硬件分析器驱动Mock
 * 模拟逻辑分析器硬件设备的完整功能，用于单元测试
 */

import { MockBase } from './MockBase';

// 基础接口定义
interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  manufacturerName: string;
  firmwareVersion: string;
  serialNumber: string;
}

interface HardwareCapabilities {
  channels: {
    digital: number;
    maxVoltage: number;
    minVoltage: number;
  };
  sampling: {
    maxRate: number;
    minRate: number;
    supportedRates: number[];
    bufferSize: number;
    maxSamples: number;
  };
  triggers: {
    types: string[];
    maxChannels: number;
    supportedEdges: string[];
  };
  communication: {
    protocol: string;
    maxBaudRate: number;
    connectionTypes: string[];
  };
}

interface ConnectionParams {
  deviceId?: string;
  baudRate?: number;
  timeout?: number;
  reconnectAttempts?: number;
}

interface ConnectionResult {
  success: boolean;
  deviceInfo?: DeviceInfo;
  error?: string;
  connectionTime?: number;
}

interface CaptureConfiguration {
  sampleRate: number;
  totalSamples: number;
  triggerType: 'none' | 'rising' | 'falling' | 'both';
  triggerChannel?: number;
  triggerPosition: number;
  channels: number[];
  preTriggerSamples?: number;
  postTriggerSamples?: number;
}

interface CaptureResult {
  success: boolean;
  data?: {
    sampleRate: number;
    totalSamples: number;
    channels: Array<{
      channelNumber: number;
      channelName: string;
      samples: Uint8Array;
    }>;
    triggerPosition?: number;
    timestamp: number;
  };
  error?: string;
  captureTime?: number;
}

enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
  Busy = 'busy'
}

enum DeviceState {
  Idle = 'idle',
  Capturing = 'capturing',
  Processing = 'processing',
  Error = 'error'
}

/**
 * Mock逻辑分析器驱动
 * 提供完整的硬件模拟功能，支持多种测试场景
 */
export class MockAnalyzerDriver extends MockBase {
  private _deviceInfo: DeviceInfo;
  private _capabilities: HardwareCapabilities;
  private _connectionStatus: ConnectionStatus = ConnectionStatus.Disconnected;
  private _deviceState: DeviceState = DeviceState.Idle;
  private _isCapturing = false;
  private _lastCaptureResult: CaptureResult | null = null;
  
  // 测试控制参数
  private _simulateConnectionDelay = 100;
  private _simulateCaptureDelay = 200;
  private _shouldFailConnection = false;
  private _shouldFailCapture = false;
  private _connectionFailureReason = 'Device not found';
  private _captureFailureReason = 'Capture timeout';
  
  // 事件监听器
  private _eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    super();
    
    // 默认设备信息
    this._deviceInfo = {
      deviceId: 'mock-analyzer-001',
      deviceName: 'Mock Logic Analyzer Pro',
      manufacturerName: 'Mock Hardware Inc.',
      firmwareVersion: '2.1.0',
      serialNumber: 'MOCK2023001'
    };

    // 默认硬件能力
    this._capabilities = {
      channels: {
        digital: 8,
        maxVoltage: 5.0,
        minVoltage: 0.0
      },
      sampling: {
        maxRate: 100_000_000, // 100MHz
        minRate: 1000,        // 1KHz
        supportedRates: [1000, 10000, 100000, 1000000, 10000000, 24000000, 100000000],
        bufferSize: 1024 * 1024, // 1MB
        maxSamples: 1000000
      },
      triggers: {
        types: ['none', 'rising', 'falling', 'both', 'pattern'],
        maxChannels: 8,
        supportedEdges: ['rising', 'falling', 'both']
      },
      communication: {
        protocol: 'USB',
        maxBaudRate: 921600,
        connectionTypes: ['USB', 'Serial', 'Network']
      }
    };
  }

  // 访问器属性
  get deviceInfo(): DeviceInfo {
    return { ...this._deviceInfo };
  }

  get capabilities(): HardwareCapabilities {
    return JSON.parse(JSON.stringify(this._capabilities));
  }

  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  get deviceState(): DeviceState {
    return this._deviceState;
  }

  get isCapturing(): boolean {
    return this._isCapturing;
  }

  get lastCaptureResult(): CaptureResult | null {
    return this._lastCaptureResult ? { ...this._lastCaptureResult } : null;
  }

  // 核心方法实现
  async connect(params: ConnectionParams = {}): Promise<ConnectionResult> {
    this.recordCall('connect', [params]);
    
    this._connectionStatus = ConnectionStatus.Connecting;
    this._emitEvent('statusChanged', this._connectionStatus);
    
    // 模拟连接延迟
    await this._delay(this._simulateConnectionDelay);
    
    if (this._shouldFailConnection) {
      this._connectionStatus = ConnectionStatus.Error;
      this._emitEvent('statusChanged', this._connectionStatus);
      this._emitEvent('error', this._connectionFailureReason);
      
      return {
        success: false,
        error: this._connectionFailureReason,
        connectionTime: this._simulateConnectionDelay
      };
    }
    
    this._connectionStatus = ConnectionStatus.Connected;
    this._deviceState = DeviceState.Idle;
    this._emitEvent('statusChanged', this._connectionStatus);
    this._emitEvent('connected', this._deviceInfo);
    
    return {
      success: true,
      deviceInfo: this.deviceInfo,
      connectionTime: this._simulateConnectionDelay
    };
  }

  async disconnect(): Promise<void> {
    this.recordCall('disconnect', []);
    
    if (this._isCapturing) {
      await this.stopCapture();
    }
    
    this._connectionStatus = ConnectionStatus.Disconnected;
    this._deviceState = DeviceState.Idle;
    this._emitEvent('statusChanged', this._connectionStatus);
    this._emitEvent('disconnected');
  }

  async startCapture(config: CaptureConfiguration): Promise<CaptureResult> {
    this.recordCall('startCapture', [config]);
    
    if (this._connectionStatus !== ConnectionStatus.Connected) {
      const error = 'Device not connected';
      this._emitEvent('error', error);
      return { success: false, error };
    }
    
    if (this._isCapturing) {
      const error = 'Already capturing';
      this._emitEvent('error', error);
      return { success: false, error };
    }
    
    // 验证配置参数
    const validationError = this._validateCaptureConfig(config);
    if (validationError) {
      this._emitEvent('error', validationError);
      return { success: false, error: validationError };
    }
    
    this._isCapturing = true;
    this._deviceState = DeviceState.Capturing;
    this._emitEvent('stateChanged', this._deviceState);
    this._emitEvent('captureStarted', config);
    
    // 模拟数据采集延迟
    await this._delay(this._simulateCaptureDelay);
    
    if (this._shouldFailCapture) {
      this._isCapturing = false;
      this._deviceState = DeviceState.Error;
      this._emitEvent('stateChanged', this._deviceState);
      this._emitEvent('error', this._captureFailureReason);
      
      const result: CaptureResult = {
        success: false,
        error: this._captureFailureReason,
        captureTime: this._simulateCaptureDelay
      };
      
      this._lastCaptureResult = result;
      return result;
    }
    
    // 生成模拟数据
    const mockData = this._generateMockCaptureData(config);
    
    this._isCapturing = false;
    this._deviceState = DeviceState.Idle;
    this._emitEvent('stateChanged', this._deviceState);
    
    const result: CaptureResult = {
      success: true,
      data: mockData,
      captureTime: this._simulateCaptureDelay
    };
    
    this._lastCaptureResult = result;
    this._emitEvent('captureCompleted', result);
    
    return result;
  }

  async stopCapture(): Promise<void> {
    this.recordCall('stopCapture', []);
    
    if (!this._isCapturing) {
      return;
    }
    
    this._isCapturing = false;
    this._deviceState = DeviceState.Idle;
    this._emitEvent('stateChanged', this._deviceState);
    this._emitEvent('captureStopped');
  }

  // 事件系统
  on(event: string, callback: Function): void {
    this.recordCall('on', [event, callback]);
    
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, []);
    }
    this._eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function): void {
    this.recordCall('off', [event, callback]);
    
    if (!this._eventListeners.has(event)) {
      return;
    }
    
    if (callback) {
      const listeners = this._eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this._eventListeners.delete(event);
    }
  }

  // 测试辅助方法
  public setDeviceInfo(deviceInfo: Partial<DeviceInfo>): void {
    this._deviceInfo = { ...this._deviceInfo, ...deviceInfo };
  }

  public setCapabilities(capabilities: Partial<HardwareCapabilities>): void {
    this._capabilities = { ...this._capabilities, ...capabilities };
  }

  public setConnectionDelay(delay: number): void {
    this._simulateConnectionDelay = delay;
  }

  public setCaptureDelay(delay: number): void {
    this._simulateCaptureDelay = delay;
  }

  public setShouldFailConnection(shouldFail: boolean, reason = 'Connection failed'): void {
    this._shouldFailConnection = shouldFail;
    this._connectionFailureReason = reason;
  }

  public setShouldFailCapture(shouldFail: boolean, reason = 'Capture failed'): void {
    this._shouldFailCapture = shouldFail;
    this._captureFailureReason = reason;
  }

  public getEventListenerCount(event: string): number {
    return this._eventListeners.get(event)?.length || 0;
  }

  public triggerEvent(event: string, ...args: any[]): void {
    this._emitEvent(event, ...args);
  }

  public reset(): void {
    this.clearHistory();
    this._connectionStatus = ConnectionStatus.Disconnected;
    this._deviceState = DeviceState.Idle;
    this._isCapturing = false;
    this._lastCaptureResult = null;
    this._shouldFailConnection = false;
    this._shouldFailCapture = false;
    this._eventListeners.clear();
  }

  // 私有辅助方法
  private _emitEvent(event: string, ...args: any[]): void {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Event listener error for '${event}':`, error);
        }
      });
    }
  }

  private async _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private _validateCaptureConfig(config: CaptureConfiguration): string | null {
    if (!config.sampleRate || config.sampleRate <= 0) {
      return 'Invalid sample rate';
    }
    
    if (config.sampleRate > this._capabilities.sampling.maxRate) {
      return `Sample rate ${config.sampleRate} exceeds maximum ${this._capabilities.sampling.maxRate}`;
    }
    
    if (!config.totalSamples || config.totalSamples <= 0) {
      return 'Invalid total samples';
    }
    
    if (config.totalSamples > this._capabilities.sampling.maxSamples) {
      return `Total samples ${config.totalSamples} exceeds maximum ${this._capabilities.sampling.maxSamples}`;
    }
    
    if (!Array.isArray(config.channels) || config.channels.length === 0) {
      return 'Invalid channels configuration';
    }
    
    if (config.channels.some(ch => ch < 0 || ch >= this._capabilities.channels.digital)) {
      return 'Channel number out of range';
    }
    
    return null;
  }

  private _generateMockCaptureData(config: CaptureConfiguration): CaptureResult['data'] {
    const channels = config.channels.map(channelNumber => {
      const samples = new Uint8Array(Math.ceil(config.totalSamples / 8));
      
      // 生成模拟数据模式
      // 为不同通道生成不同的信号模式
      for (let i = 0; i < samples.length; i++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const sampleIndex = i * 8 + bit;
          if (sampleIndex >= config.totalSamples) break;
          
          // 根据通道号生成不同模式的信号
          let bitValue = 0;
          switch (channelNumber % 4) {
            case 0: // 方波信号
              bitValue = Math.floor(sampleIndex / 100) % 2;
              break;
            case 1: // 时钟信号
              bitValue = sampleIndex % 2;
              break;
            case 2: // 随机信号
              bitValue = Math.random() > 0.5 ? 1 : 0;
              break;
            case 3: // 脉冲信号
              bitValue = (sampleIndex % 1000) < 10 ? 1 : 0;
              break;
          }
          
          if (bitValue) {
            byte |= (1 << bit);
          }
        }
        samples[i] = byte;
      }
      
      return {
        channelNumber,
        channelName: `Channel ${channelNumber}`,
        samples
      };
    });

    return {
      sampleRate: config.sampleRate,
      totalSamples: config.totalSamples,
      channels,
      triggerPosition: config.triggerPosition,
      timestamp: Date.now()
    };
  }
}