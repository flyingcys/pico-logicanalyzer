/**
 * 集成测试设置
 * 用于端到端的功能测试
 */

import * as path from 'path';
import * as fs from 'fs';

// 扩展测试超时时间
jest.setTimeout(30000);

// 测试数据目录
const TEST_DATA_DIR = path.join(__dirname, 'data');

// 确保测试数据目录存在
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

// 模拟VSCode扩展上下文
export function createMockExtensionContext() {
  const mockContext = {
    subscriptions: [],
    workspaceState: {
      get: jest.fn(),
      update: jest.fn()
    },
    globalState: {
      get: jest.fn(),
      update: jest.fn()
    },
    extensionPath: path.join(__dirname, '..'),
    asAbsolutePath: jest.fn((relativePath: string) => 
      path.join(__dirname, '..', relativePath)
    ),
    storageUri: undefined,
    globalStorageUri: undefined,
    logUri: undefined
  };

  return mockContext;
}

// 模拟完整的设备连接流程
export class MockDeviceConnection {
  private connected = false;
  private deviceInfo = {
    name: 'Mock Logic Analyzer',
    maxFrequency: 100000000,
    channels: 24,
    bufferSize: 4 * 1024 * 1024
  };

  async connect(): Promise<boolean> {
    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<boolean> {
    this.connected = false;
    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getDeviceInfo() {
    return this.deviceInfo;
  }

  async startCapture(session: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Device not connected');
    }

    // 模拟采集过程
    await new Promise(resolve => setTimeout(resolve, 200));

    // 生成模拟数据
    const channels = session.captureChannels.map((ch: any) => ({
      ...ch,
      samples: this.generateMockSamples(session.totalSamples)
    }));

    return {
      success: true,
      channels,
      metadata: {
        sampleRate: session.frequency,
        totalSamples: session.totalSamples,
        captureTime: new Date().toISOString()
      }
    };
  }

  private generateMockSamples(count: number): Uint8Array {
    const samples = new Uint8Array(count);
    let state = 0;
    
    for (let i = 0; i < count; i++) {
      // 生成带有一些模式的模拟数据
      if (i % 100 === 0) state = 1 - state;
      samples[i] = state;
    }
    
    return samples;
  }
}

// 模拟文件操作
export class MockFileSystem {
  private files = new Map<string, string>();

  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  readFile(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  clear(): void {
    this.files.clear();
  }
}

// 测试数据生成器
export class TestDataGenerator {
  static generateLACFile(channels: number = 8, samples: number = 10000): string {
    const captureData = {
      metadata: {
        version: '1.0',
        deviceName: 'Test Device',
        sampleRate: 24000000,
        totalSamples: samples,
        captureTime: new Date().toISOString()
      },
      channels: Array.from({ length: channels }, (_, i) => ({
        channelNumber: i,
        channelName: `CH${i}`,
        hidden: false,
        samples: Array.from({ length: samples }, () => Math.random() > 0.5 ? 1 : 0)
      }))
    };

    return JSON.stringify(captureData, null, 2);
  }

  static generateI2CTraffic(transactions: number = 10): Uint8Array[] {
    const data: number[][] = [];
    
    for (let i = 0; i < transactions; i++) {
      const transaction: number[] = [];
      
      // START condition
      transaction.push(0b11, 0b10, 0b00);
      
      // Address + R/W bit
      const address = 0x50 + (i % 8);
      for (let bit = 6; bit >= 0; bit--) {
        const value = (address >> bit) & 1;
        transaction.push(value | 0b10, value | 0b00);
      }
      
      // R/W bit (write)
      transaction.push(0b00, 0b10);
      
      // ACK
      transaction.push(0b00, 0b10);
      
      // Data byte
      const dataByte = 0xAA + i;
      for (let bit = 7; bit >= 0; bit--) {
        const value = (dataByte >> bit) & 1;
        transaction.push(value | 0b10, value | 0b00);
      }
      
      // ACK
      transaction.push(0b00, 0b10);
      
      // STOP condition
      transaction.push(0b00, 0b01, 0b11);
      
      data.push(transaction);
    }
    
    // 将所有交易合并成连续的数据流
    const combined = data.flat();
    
    // 返回SDA和SCL通道数据
    return [
      new Uint8Array(combined.map(v => v & 1)),        // SDA
      new Uint8Array(combined.map(v => (v >> 1) & 1))  // SCL
    ];
  }

  static generateSPITraffic(transactions: number = 5): Uint8Array[] {
    const mosi: number[] = [];
    const miso: number[] = [];
    const sclk: number[] = [];
    const cs: number[] = [];

    for (let i = 0; i < transactions; i++) {
      // CS低电平选中设备
      cs.push(0);
      mosi.push(0);
      miso.push(0);
      sclk.push(0);

      // 发送数据字节
      const txByte = 0x55 + i;
      const rxByte = 0xAA - i;

      for (let bit = 7; bit >= 0; bit--) {
        // 时钟低电平
        sclk.push(0);
        mosi.push((txByte >> bit) & 1);
        miso.push((rxByte >> bit) & 1);
        cs.push(0);

        // 时钟高电平
        sclk.push(1);
        mosi.push((txByte >> bit) & 1);
        miso.push((rxByte >> bit) & 1);
        cs.push(0);
      }

      // CS高电平取消选中
      cs.push(1);
      mosi.push(0);
      miso.push(0);
      sclk.push(0);
    }

    return [
      new Uint8Array(mosi),
      new Uint8Array(miso), 
      new Uint8Array(sclk),
      new Uint8Array(cs)
    ];
  }
}

// 性能测试辅助函数
export function measurePerformance<T>(name: string, fn: () => T): T {
  const startTime = process.hrtime.bigint();
  const result = fn();
  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
  
  console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
  return result;
}

export async function measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = process.hrtime.bigint();
  const result = await fn();
  const endTime = process.hrtime.bigint();
  const duration = Number(endTime - startTime) / 1000000;
  
  console.log(`Async Performance [${name}]: ${duration.toFixed(2)}ms`);
  return result;
}

// 内存使用监控
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

export function logMemoryUsage(label: string): void {
  const usage = getMemoryUsage();
  console.log(`Memory Usage [${label}]:`, {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}

// 全局测试清理
afterEach(() => {
  // 清理定时器
  jest.clearAllTimers();
  
  // 清理Mock调用记录
  jest.clearAllMocks();
});

afterAll(() => {
  // 最终清理
  console.log('Integration tests completed');
});