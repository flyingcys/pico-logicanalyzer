# 单元测试实现示例

## 核心模块测试实现示例

### 1. 设备驱动层测试实现

#### AnalyzerDriverBase 测试完整实现
```typescript
// src/tests/drivers/AnalyzerDriverBase.test.ts
import { AnalyzerDriverBase, CaptureSession, CaptureError, AnalyzerDriverType } from '../../drivers/AnalyzerDriverBase';
import { MockSerialPort } from '../mocks/MockSerialPort';

// Mock实现用于测试
class TestAnalyzerDriver extends AnalyzerDriverBase {
  deviceVersion = '1.0.0';
  channelCount = 24;
  maxFrequency = 100000000;
  minFrequency = 1000;
  bufferSize = 24576;
  blastFrequency = 100000000;
  driverType = AnalyzerDriverType.Hardware;
  isNetwork = false;
  isCapturing = false;
  
  private mockSerial = new MockSerialPort();
  
  async startCapture(session: CaptureSession): Promise<CaptureError> {
    if (this.isCapturing) {
      return CaptureError.AlreadyCapturing;
    }
    
    this.isCapturing = true;
    
    try {
      // 模拟采集过程
      await this.simulateCapture(session);
      return CaptureError.None;
    } catch (error) {
      return CaptureError.InvalidConfiguration;
    } finally {
      this.isCapturing = false;
    }
  }
  
  async stopCapture(): Promise<boolean> {
    this.isCapturing = false;
    return true;
  }
  
  getDeviceInfo() {
    return {
      name: 'Test Device',
      maxFrequency: this.maxFrequency,
      blastFrequency: this.blastFrequency,
      channels: this.channelCount,
      bufferSize: this.bufferSize,
      modeLimits: []
    };
  }
  
  async enterBootloader(): Promise<boolean> {
    return true;
  }
  
  async sendNetworkConfig(): Promise<boolean> {
    return true;
  }
  
  async getVoltageStatus(): Promise<string> {
    return '3.3V';
  }
  
  private async simulateCapture(session: CaptureSession): Promise<void> {
    // 生成模拟数据
    const totalSamples = session.totalSamples;
    session.captureChannels.forEach(channel => {
      channel.samples = new Uint8Array(Math.ceil(totalSamples / 8));
      // 填充随机测试数据
      for (let i = 0; i < channel.samples.length; i++) {
        channel.samples[i] = Math.floor(Math.random() * 256);
      }
    });
    
    // 模拟采集延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

describe('AnalyzerDriverBase', () => {
  let driver: TestAnalyzerDriver;
  let mockCaptureSession: CaptureSession;
  
  beforeEach(() => {
    driver = new TestAnalyzerDriver();
    mockCaptureSession = {
      frequency: 1000000,
      preTriggerSamples: 1000,
      postTriggerSamples: 10000,
      totalSamples: 11000,
      triggerType: 0,
      triggerChannel: 0,
      triggerInverted: false,
      triggerPattern: 0,
      triggerBitCount: 1,
      loopCount: 0,
      measureBursts: false,
      captureChannels: [
        {
          channelNumber: 0,
          channelName: 'Channel 1',
          hidden: false,
          samples: undefined,
          get textualChannelNumber() { return 'Channel 1'; },
          clone: function() { return { ...this }; }
        }
      ],
      clone: function() { return { ...this }; },
      cloneSettings: function() { return { ...this }; }
    };
  });
  
  describe('Device Properties', () => {
    it('should return correct device version', () => {
      expect(driver.deviceVersion).toBe('1.0.0');
    });
    
    it('should report accurate channel count', () => {
      expect(driver.channelCount).toBe(24);
    });
    
    it('should provide frequency range information', () => {
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.minFrequency).toBe(1000);
    });
    
    it('should indicate driver type correctly', () => {
      expect(driver.driverType).toBe(AnalyzerDriverType.Hardware);
    });
  });
  
  describe('Capture Management', () => {
    it('should start capture with valid session', async () => {
      const result = await driver.startCapture(mockCaptureSession);
      expect(result).toBe(CaptureError.None);
      expect(mockCaptureSession.captureChannels[0].samples).toBeDefined();
    });
    
    it('should prevent overlapping captures', async () => {
      // 开始第一次采集
      const promise1 = driver.startCapture(mockCaptureSession);
      
      // 立即尝试第二次采集
      const result2 = await driver.startCapture(mockCaptureSession);
      
      expect(result2).toBe(CaptureError.AlreadyCapturing);
      
      // 等待第一次采集完成
      const result1 = await promise1;
      expect(result1).toBe(CaptureError.None);
    });
    
    it('should stop capture immediately', async () => {
      const capturePromise = driver.startCapture(mockCaptureSession);
      
      // 立即停止采集
      const stopResult = await driver.stopCapture();
      expect(stopResult).toBe(true);
      expect(driver.isCapturing).toBe(false);
      
      await capturePromise;
    });
    
    it('should handle capture errors gracefully', async () => {
      // 创建无效的采集配置
      const invalidSession = { ...mockCaptureSession, frequency: -1 };
      
      const result = await driver.startCapture(invalidSession);
      expect(result).not.toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(false);
    });
  });
  
  describe('Device Information', () => {
    it('should provide complete device info', () => {
      const deviceInfo = driver.getDeviceInfo();
      
      expect(deviceInfo.name).toBe('Test Device');
      expect(deviceInfo.maxFrequency).toBe(100000000);
      expect(deviceInfo.channels).toBe(24);
      expect(deviceInfo.bufferSize).toBe(24576);
    });
  });
  
  describe('Capture Mode Detection', () => {
    it('should detect 8-channel mode correctly', () => {
      const channels = [0, 1, 2, 3, 4, 5, 6, 7];
      const mode = driver.getCaptureMode(channels);
      expect(mode).toBe(0); // CaptureMode.Channels_8
    });
    
    it('should detect 16-channel mode correctly', () => {
      const channels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      const mode = driver.getCaptureMode(channels);
      expect(mode).toBe(1); // CaptureMode.Channels_16
    });
    
    it('should detect 24-channel mode correctly', () => {
      const channels = Array.from({ length: 24 }, (_, i) => i);
      const mode = driver.getCaptureMode(channels);
      expect(mode).toBe(2); // CaptureMode.Channels_24
    });
  });
  
  describe('Capture Limits', () => {
    it('should provide correct limits for different channel counts', () => {
      const channels8 = [0, 1, 2, 3, 4, 5, 6, 7];
      const limits8 = driver.getLimits(channels8);
      
      expect(limits8.maxPostSamples).toBeGreaterThan(limits8.maxPreSamples);
      expect(limits8.maxTotalSamples).toBe(limits8.minPreSamples + limits8.maxPostSamples);
    });
  });
});
```

### 2. 协议解码器测试实现

#### I2C解码器完整测试
```typescript
// src/tests/decoders/I2CDecoder.test.ts
import { I2CDecoder } from '../../decoders/protocols/I2CDecoder';
import { AnalyzerChannel } from '../../models/AnalyzerChannel';
import { SignalGenerator } from '../utils/SignalGenerator';

describe('I2CDecoder', () => {
  let decoder: I2CDecoder;
  let mockChannels: AnalyzerChannel[];
  
  beforeEach(() => {
    decoder = new I2CDecoder();
    mockChannels = [
      {
        channelNumber: 0,
        channelName: 'SCL',
        hidden: false,
        samples: new Uint8Array(),
        get textualChannelNumber() { return 'SCL'; },
        clone: function() { return { ...this }; }
      },
      {
        channelNumber: 1,
        channelName: 'SDA',
        hidden: false,
        samples: new Uint8Array(),
        get textualChannelNumber() { return 'SDA'; },
        clone: function() { return { ...this }; }
      }
    ];
  });
  
  describe('Decoder Metadata', () => {
    it('should provide correct decoder information', () => {
      expect(decoder.id).toBe('i2c');
      expect(decoder.name).toBe('I2C');
      expect(decoder.longname).toBe('Inter-Integrated Circuit');
      expect(decoder.desc).toBe('Two-wire, multi-master, serial bus.');
      expect(decoder.license).toBe('gplv2+');
    });
    
    it('should define channels correctly', () => {
      expect(decoder.channels).toHaveLength(2);
      expect(decoder.channels[0].id).toBe('scl');
      expect(decoder.channels[1].id).toBe('sda');
    });
    
    it('should specify annotations accurately', () => {
      expect(decoder.annotations).toContain(['start', 'Start', 'S']);
      expect(decoder.annotations).toContain(['stop', 'Stop', 'P']);
      expect(decoder.annotations).toContain(['ack', 'ACK', 'A']);
      expect(decoder.annotations).toContain(['nack', 'NACK', 'N']);
    });
  });
  
  describe('Basic I2C Protocol Decoding', () => {
    it('should decode a simple write transaction', () => {
      // 生成I2C写事务：START + 地址(0x50) + 写位 + 数据(0xAA) + STOP
      const i2cData = SignalGenerator.generateI2CSequence({
        address: 0x50,
        isWrite: true,
        data: [0xAA],
        sampleRate: 1000000,
        clockFrequency: 100000
      });
      
      mockChannels[0].samples = i2cData.scl;
      mockChannels[1].samples = i2cData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 验证解码结果
      expect(results).toHaveLength(5); // START + ADDRESS + ACK + DATA + STOP
      
      // 验证START条件
      expect(results[0].annotationType).toBe('start');
      expect(results[0].values[0]).toBe('Start');
      
      // 验证地址
      expect(results[1].annotationType).toBe('address-write');
      expect(results[1].values[0]).toContain('0x50');
      
      // 验证ACK
      expect(results[2].annotationType).toBe('ack');
      
      // 验证数据
      expect(results[3].annotationType).toBe('data-write');
      expect(results[3].values[0]).toContain('0xAA');
      
      // 验证STOP条件
      expect(results[4].annotationType).toBe('stop');
    });
    
    it('should decode a simple read transaction', () => {
      const i2cData = SignalGenerator.generateI2CSequence({
        address: 0x51,
        isWrite: false,
        data: [0x55],
        sampleRate: 1000000,
        clockFrequency: 100000
      });
      
      mockChannels[0].samples = i2cData.scl;
      mockChannels[1].samples = i2cData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 验证读事务
      const addressResult = results.find(r => r.annotationType === 'address-read');
      expect(addressResult).toBeDefined();
      expect(addressResult!.values[0]).toContain('0x51');
      
      const dataResult = results.find(r => r.annotationType === 'data-read');
      expect(dataResult).toBeDefined();
      expect(dataResult!.values[0]).toContain('0x55');
    });
  });
  
  describe('Complex I2C Scenarios', () => {
    it('should handle repeated START conditions', () => {
      const i2cData = SignalGenerator.generateI2CWithRepeatedStart({
        firstAddress: 0x50,
        secondAddress: 0x51,
        data: [0x12, 0x34],
        sampleRate: 1000000
      });
      
      mockChannels[0].samples = i2cData.scl;
      mockChannels[1].samples = i2cData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 应该检测到REPEATED START
      const repeatedStart = results.find(r => r.annotationType === 'repeat-start');
      expect(repeatedStart).toBeDefined();
    });
    
    it('should detect NACK conditions', () => {
      const i2cData = SignalGenerator.generateI2CWithNACK({
        address: 0x50,
        sampleRate: 1000000
      });
      
      mockChannels[0].samples = i2cData.scl;
      mockChannels[1].samples = i2cData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 应该检测到NACK
      const nackResult = results.find(r => r.annotationType === 'nack');
      expect(nackResult).toBeDefined();
    });
    
    it('should handle clock stretching', () => {
      const i2cData = SignalGenerator.generateI2CWithClockStretching({
        address: 0x50,
        stretchDuration: 100, // 100 samples
        sampleRate: 1000000
      });
      
      mockChannels[0].samples = i2cData.scl;
      mockChannels[1].samples = i2cData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 解码应该正确处理时钟拉伸
      expect(results.length).toBeGreaterThan(0);
      
      // 验证时序正确性
      const addressResult = results.find(r => r.annotationType === 'address-write');
      expect(addressResult).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle incomplete transactions gracefully', () => {
      // 生成不完整的I2C事务（只有START，没有STOP）
      const incompleteData = SignalGenerator.generateIncompleteI2C({
        address: 0x50,
        sampleRate: 1000000
      });
      
      mockChannels[0].samples = incompleteData.scl;
      mockChannels[1].samples = incompleteData.sda;
      
      expect(() => {
        decoder.decode(1000000, mockChannels, []);
      }).not.toThrow();
    });
    
    it('should handle noisy signals', () => {
      // 生成包含噪声的I2C信号
      const noisyData = SignalGenerator.generateNoisyI2C({
        address: 0x50,
        data: [0xAA],
        noiseLevel: 0.05, // 5% 噪声
        sampleRate: 1000000
      });
      
      mockChannels[0].samples = noisyData.scl;
      mockChannels[1].samples = noisyData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 即使有噪声，也应该能解码出主要数据
      const addressResult = results.find(r => r.annotationType === 'address-write');
      expect(addressResult).toBeDefined();
    });
    
    it('should detect protocol violations', () => {
      // 生成违反I2C协议的信号（如在时钟高电平时改变数据）
      const violationData = SignalGenerator.generateI2CProtocolViolation({
        violationType: 'data-change-on-high-clock',
        sampleRate: 1000000
      });
      
      mockChannels[0].samples = violationData.scl;
      mockChannels[1].samples = violationData.sda;
      
      const results = decoder.decode(1000000, mockChannels, []);
      
      // 应该能检测到协议违反
      const errorResult = results.find(r => r.annotationType === 'error');
      expect(errorResult).toBeDefined();
    });
  });
  
  describe('Performance Tests', () => {
    it('should decode large datasets efficiently', () => {
      // 生成大量I2C数据（模拟1秒@100kHz的数据）
      const largeData = SignalGenerator.generateLargeI2CDataset({
        duration: 1000, // 1秒
        clockFrequency: 100000,
        sampleRate: 10000000,
        transactionCount: 1000
      });
      
      mockChannels[0].samples = largeData.scl;
      mockChannels[1].samples = largeData.sda;
      
      const startTime = performance.now();
      const results = decoder.decode(10000000, mockChannels, []);
      const decodeTime = performance.now() - startTime;
      
      // 解码时间应该在合理范围内（<1秒）
      expect(decodeTime).toBeLessThan(1000);
      expect(results.length).toBeGreaterThan(0);
    });
    
    it('should handle high-speed I2C (3.4MHz)', () => {
      const highSpeedData = SignalGenerator.generateI2CSequence({
        address: 0x50,
        isWrite: true,
        data: [0xAA, 0x55, 0xFF],
        sampleRate: 100000000, // 100MHz采样
        clockFrequency: 3400000 // 3.4MHz I2C
      });
      
      mockChannels[0].samples = highSpeedData.scl;
      mockChannels[1].samples = highSpeedData.sda;
      
      const results = decoder.decode(100000000, mockChannels, []);
      
      // 应该能正确解码高速I2C
      expect(results.length).toBeGreaterThan(0);
      
      const addressResult = results.find(r => r.annotationType === 'address-write');
      expect(addressResult).toBeDefined();
    });
  });
});
```

### 3. 波形渲染器测试实现

#### WaveformRenderer 性能测试
```typescript
// src/tests/webview/engines/WaveformRenderer.test.ts
import { WaveformRenderer } from '../../../webview/engines/WaveformRenderer';
import { AnalyzerChannel } from '../../../models/AnalyzerChannel';
import { ViewRange } from '../../../webview/types/ViewRange';

// Mock Canvas 和 Context
class MockCanvas implements Partial<HTMLCanvasElement> {
  width = 1920;
  height = 1080;
  private context = new MockCanvasRenderingContext2D();
  
  getContext(contextId: string): any {
    return contextId === '2d' ? this.context : null;
  }
}

class MockCanvasRenderingContext2D implements Partial<CanvasRenderingContext2D> {
  private operations: string[] = [];
  
  clearRect(x: number, y: number, w: number, h: number): void {
    this.operations.push(`clearRect(${x},${y},${w},${h})`);
  }
  
  beginPath(): void {
    this.operations.push('beginPath()');
  }
  
  moveTo(x: number, y: number): void {
    this.operations.push(`moveTo(${x},${y})`);
  }
  
  lineTo(x: number, y: number): void {
    this.operations.push(`lineTo(${x},${y})`);
  }
  
  stroke(): void {
    this.operations.push('stroke()');
  }
  
  fillText(text: string, x: number, y: number): void {
    this.operations.push(`fillText("${text}",${x},${y})`);
  }
  
  getOperations(): string[] {
    return [...this.operations];
  }
  
  clearOperations(): void {
    this.operations = [];
  }
}

describe('WaveformRenderer', () => {
  let renderer: WaveformRenderer;
  let mockCanvas: MockCanvas;
  let mockContext: MockCanvasRenderingContext2D;
  
  beforeEach(() => {
    mockCanvas = new MockCanvas();
    mockContext = mockCanvas.getContext('2d') as MockCanvasRenderingContext2D;
    renderer = new WaveformRenderer(mockCanvas as HTMLCanvasElement);
    mockContext.clearOperations();
  });
  
  describe('Basic Rendering', () => {
    it('should render simple digital waveform', async () => {
      const channels: AnalyzerChannel[] = [{
        channelNumber: 0,
        channelName: 'Test Channel',
        hidden: false,
        samples: new Uint8Array([0, 1, 1, 0, 1, 0, 0, 1]),
        get textualChannelNumber() { return 'Test Channel'; },
        clone: function() { return { ...this }; }
      }];
      
      const viewRange: ViewRange = {
        startSample: 0,
        endSample: 8,
        samplesPerPixel: 0.01,
        pixelsPerSample: 100
      };
      
      await renderer.renderWaveform(channels, viewRange);
      
      const operations = mockContext.getOperations();
      
      // 验证基本渲染操作
      expect(operations).toContain('clearRect(0,0,1920,1080)');
      expect(operations.filter(op => op.includes('beginPath()'))).toHaveLength(1);
      expect(operations.filter(op => op.includes('stroke()'))).toHaveLength(1);
    });
    
    it('should handle multiple channels', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'Channel 0',
          hidden: false,
          samples: new Uint8Array([0, 1, 0, 1]),
          get textualChannelNumber() { return 'Channel 0'; },
          clone: function() { return { ...this }; }
        },
        {
          channelNumber: 1,
          channelName: 'Channel 1',
          hidden: false,
          samples: new Uint8Array([1, 0, 1, 0]),
          get textualChannelNumber() { return 'Channel 1'; },
          clone: function() { return { ...this }; }
        }
      ];
      
      const viewRange: ViewRange = {
        startSample: 0,
        endSample: 4,
        samplesPerPixel: 0.01,
        pixelsPerSample: 50
      };
      
      await renderer.renderWaveform(channels, viewRange);
      
      const operations = mockContext.getOperations();
      
      // 应该为每个通道都有渲染操作
      expect(operations.filter(op => op.includes('beginPath()'))).toHaveLength(2);
      expect(operations.filter(op => op.includes('stroke()'))).toHaveLength(2);
    });
    
    it('should skip hidden channels', async () => {
      const channels: AnalyzerChannel[] = [
        {
          channelNumber: 0,
          channelName: 'Visible Channel',
          hidden: false,
          samples: new Uint8Array([0, 1, 0, 1]),
          get textualChannelNumber() { return 'Visible Channel'; },
          clone: function() { return { ...this }; }
        },
        {
          channelNumber: 1,
          channelName: 'Hidden Channel',
          hidden: true,
          samples: new Uint8Array([1, 0, 1, 0]),
          get textualChannelNumber() { return 'Hidden Channel'; },
          clone: function() { return { ...this }; }
        }
      ];
      
      const viewRange: ViewRange = {
        startSample: 0,
        endSample: 4,
        samplesPerPixel: 0.01,
        pixelsPerSample: 50
      };
      
      await renderer.renderWaveform(channels, viewRange);
      
      const operations = mockContext.getOperations();
      
      // 只应该渲染可见通道
      expect(operations.filter(op => op.includes('beginPath()'))).toHaveLength(1);
    });
  });
  
  describe('Performance Tests', () => {
    it('should render 1M samples within performance budget', async () => {
      const largeChannel: AnalyzerChannel = {
        channelNumber: 0,
        channelName: 'Large Channel',
        hidden: false,
        samples: new Uint8Array(1000000),
        get textualChannelNumber() { return 'Large Channel'; },
        clone: function() { return { ...this }; }
      };
      
      // 填充测试数据
      for (let i = 0; i < largeChannel.samples!.length; i++) {
        largeChannel.samples![i] = Math.random() > 0.5 ? 1 : 0;
      }
      
      const viewRange: ViewRange = {
        startSample: 0,
        endSample: 1000000,
        samplesPerPixel: 520.8, // 1M samples / 1920 pixels
        pixelsPerSample: 0.00192
      };
      
      const startTime = performance.now();
      await renderer.renderWaveform([largeChannel], viewRange);
      const renderTime = performance.now() - startTime;
      
      // 渲染时间应该在16.67ms内（60fps要求）
      expect(renderTime).toBeLessThan(16.67);
    });
    
    it('should handle zoom operations efficiently', async () => {
      const channel: AnalyzerChannel = {
        channelNumber: 0,
        channelName: 'Test Channel',
        hidden: false,
        samples: new Uint8Array(100000),
        get textualChannelNumber() { return 'Test Channel'; },
        clone: function() { return { ...this }; }
      };
      
      // 填充测试数据
      for (let i = 0; i < channel.samples!.length; i++) {
        channel.samples![i] = (i % 8) < 4 ? 1 : 0; // 方波信号
      }
      
      const zoomLevels = [0.1, 0.5, 1.0, 2.0, 10.0, 100.0];
      
      for (const zoomLevel of zoomLevels) {
        const viewRange: ViewRange = {
          startSample: 0,
          endSample: Math.floor(100000 / zoomLevel),
          samplesPerPixel: 52.08 / zoomLevel,
          pixelsPerSample: 0.0192 * zoomLevel
        };
        
        const startTime = performance.now();
        await renderer.renderWaveform([channel], viewRange);
        const zoomTime = performance.now() - startTime;
        
        // 缩放操作应该在100ms内完成
        expect(zoomTime).toBeLessThan(100);
      }
    });
    
    it('should optimize rendering for viewport', async () => {
      const channel: AnalyzerChannel = {
        channelNumber: 0,
        channelName: 'Test Channel',
        hidden: false,
        samples: new Uint8Array(1000000),
        get textualChannelNumber() { return 'Test Channel'; },
        clone: function() { return { ...this }; }
      };
      
      // 只渲染可视区域的一小部分
      const viewRange: ViewRange = {
        startSample: 400000, // 从40%位置开始
        endSample: 600000,   // 到60%位置结束
        samplesPerPixel: 104.17, // 200k samples / 1920 pixels
        pixelsPerSample: 0.0096
      };
      
      const startTime = performance.now();
      await renderer.renderWaveform([channel], viewRange);
      const renderTime = performance.now() - startTime;
      
      // 部分渲染应该更快
      expect(renderTime).toBeLessThan(10);
    });
  });
  
  describe('Accuracy Tests', () => {
    it('should render signal transitions correctly', async () => {
      const channel: AnalyzerChannel = {
        channelNumber: 0,
        channelName: 'Test Channel',
        hidden: false,
        samples: new Uint8Array([0, 0, 1, 1, 1, 0, 0, 1]),
        get textualChannelNumber() { return 'Test Channel'; },
        clone: function() { return { ...this }; }
      };
      
      const viewRange: ViewRange = {
        startSample: 0,
        endSample: 8,
        samplesPerPixel: 0.0042, // High resolution
        pixelsPerSample: 240
      };
      
      await renderer.renderWaveform([channel], viewRange);
      
      const operations = mockContext.getOperations();
      
      // 验证关键转换点的渲染
      const moveOperations = operations.filter(op => op.includes('moveTo'));
      const lineOperations = operations.filter(op => op.includes('lineTo'));
      
      expect(moveOperations.length).toBeGreaterThan(0);
      expect(lineOperations.length).toBeGreaterThan(0);
      
      // 验证转换点位置的正确性
      expect(lineOperations.some(op => op.includes('lineTo(480,'))).toBe(true); // 第一个上升沿
      expect(lineOperations.some(op => op.includes('lineTo(1200,'))).toBe(true); // 下降沿
    });
  });
});
```

## 测试工具和Mock对象库

### Mock对象库设计
```typescript
// src/tests/mocks/index.ts
export { MockAnalyzerDriver } from './MockAnalyzerDriver';
export { MockSerialPort } from './MockSerialPort';
export { MockVSCodeAPI } from './MockVSCodeAPI';
export { SignalGenerator } from '../utils/SignalGenerator';
export { TestDataSets } from '../fixtures/test-data';
export { PerformanceMonitor } from '../utils/PerformanceMonitor';
```

### 性能监控工具
```typescript
// src/tests/utils/PerformanceMonitor.ts
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  
  async measureAsync<T>(operation: () => Promise<T>, name?: string): Promise<T> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (name) {
      this.recordMeasurement(name, duration);
    }
    
    return result;
  }
  
  measure<T>(operation: () => T, name?: string): T {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (name) {
      this.recordMeasurement(name, duration);
    }
    
    return result;
  }
  
  private recordMeasurement(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);
  }
  
  getStatistics(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) {
      return null;
    }
    
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  clearMeasurements(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }
}
```

这些测试实现示例提供了：

1. **完整的测试用例结构** - 包括设置、执行、验证和清理
2. **Mock对象设计** - 隔离外部依赖，确保测试稳定性
3. **性能测试实现** - 验证关键性能指标
4. **边界条件测试** - 处理异常情况和错误场景
5. **实际业务场景模拟** - 贴近真实使用情况

通过这些具体实现，开发团队可以：
- 快速理解测试编写规范
- 复制类似模式到其他模块
- 确保测试质量和覆盖率
- 维持代码质量标准