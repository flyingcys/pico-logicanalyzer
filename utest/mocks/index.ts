/**
 * Mock对象集中导出
 */

export { MockBase } from './MockBase';
export { MockAnalyzerDriver } from './MockAnalyzerDriver';
export { vscode, VSCodeMock } from './vscode';

// 测试工具类导出
export class TestUtils {
  /**
   * 创建模拟的通道数据
   */
  static createMockChannelData(channelNumber: number, sampleCount: number, pattern?: 'random' | 'clock' | 'square' | 'pulse'): Uint8Array {
    const samples = new Uint8Array(Math.ceil(sampleCount / 8));
    
    for (let i = 0; i < samples.length; i++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const sampleIndex = i * 8 + bit;
        if (sampleIndex >= sampleCount) break;
        
        let bitValue = 0;
        switch (pattern || 'random') {
          case 'random':
            bitValue = Math.random() > 0.5 ? 1 : 0;
            break;
          case 'clock':
            bitValue = sampleIndex % 2;
            break;
          case 'square':
            bitValue = Math.floor(sampleIndex / 100) % 2;
            break;
          case 'pulse':
            bitValue = (sampleIndex % 1000) < 10 ? 1 : 0;
            break;
        }
        
        if (bitValue) {
          byte |= (1 << bit);
        }
      }
      samples[i] = byte;
    }
    
    return samples;
  }
  
  /**
   * 创建模拟的分析器通道对象
   */
  static createMockAnalyzerChannel(channelNumber: number, sampleCount: number, pattern?: string) {
    return {
      channelNumber,
      channelName: `Channel ${channelNumber}`,
      samples: this.createMockChannelData(channelNumber, sampleCount, pattern as any),
      hidden: false
    };
  }
  
  /**
   * 创建模拟的解码器结果
   */
  static createMockDecoderResult(startSample: number, endSample: number, annotationType: number, values: string[]) {
    return {
      startSample,
      endSample,
      annotationType,
      values
    };
  }
  
  /**
   * 等待异步操作完成
   */
  static async waitForAsync(condition: () => boolean, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (!condition() && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }
  
  /**
   * 创建延迟的Promise
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 模拟性能测试
   */
  static async measurePerformance<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    return {
      result,
      duration: endTime - startTime
    };
  }
  
  /**
   * 创建模拟的设备信息
   */
  static createMockDeviceInfo(overrides: Partial<any> = {}) {
    return {
      deviceId: 'mock-device-001',
      deviceName: 'Mock Logic Analyzer',
      manufacturerName: 'Mock Electronics',
      firmwareVersion: '1.0.0',
      serialNumber: 'MOCK001',
      ...overrides
    };
  }
  
  /**
   * 创建模拟的硬件能力描述
   */
  static createMockCapabilities(overrides: Partial<any> = {}) {
    return {
      channels: {
        digital: 8,
        maxVoltage: 5.0,
        minVoltage: 0.0
      },
      sampling: {
        maxRate: 100_000_000,
        minRate: 1000,
        supportedRates: [1000, 10000, 100000, 1000000, 10000000, 24000000, 100000000],
        bufferSize: 1024 * 1024,
        maxSamples: 1000000
      },
      triggers: {
        types: ['none', 'rising', 'falling', 'both'],
        maxChannels: 8,
        supportedEdges: ['rising', 'falling', 'both']
      },
      ...overrides
    };
  }
  
  /**
   * 验证Mock对象的方法调用
   */
  static verifyMethodCalls(mockObject: MockBase, expectedCalls: Array<{ method: string; args?: any[] }>) {
    const actualCalls = mockObject.getMethodCalls();
    
    expect(actualCalls).toHaveLength(expectedCalls.length);
    
    expectedCalls.forEach((expectedCall, index) => {
      const actualCall = actualCalls[index];
      expect(actualCall.method).toBe(expectedCall.method);
      
      if (expectedCall.args) {
        expect(actualCall.args).toEqual(expectedCall.args);
      }
    });
  }
  
  /**
   * 清理所有Mock对象
   */
  static resetAllMocks(...mocks: MockBase[]) {
    mocks.forEach(mock => mock.reset());
    jest.clearAllMocks();
  }
}