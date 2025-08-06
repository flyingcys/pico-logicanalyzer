/**
 * AnalyzerDriverBase 增强单元测试
 * 使用Mock对象库和自定义匹配器的完整测试套件
 */

import '../../../src/tests/setup';
import '../../../src/tests/matchers';
import { MockAnalyzerDriver, TestUtils, TestScenarioBuilder } from '../../../src/tests/mocks';
import { AnalyzerDriverBase, OutputPacket, CaptureRequest } from '../../../src/drivers/AnalyzerDriverBase';
import { CaptureMode, CaptureError, TriggerType, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

// 测试驱动实现类，用于测试抽象基类
class TestableAnalyzerDriver extends AnalyzerDriverBase {
  readonly deviceVersion = '2.1.0-test';
  readonly channelCount = 24;
  readonly maxFrequency = 100_000_000;
  readonly bufferSize = 96000;
  readonly blastFrequency = 100_000_000;
  readonly driverType = AnalyzerDriverType.Single;
  readonly isNetwork = false;
  
  private _isCapturing = false;
  private _connectionStatus = 'disconnected';
  
  get isCapturing(): boolean {
    return this._isCapturing;
  }
  
  async connect(params: any): Promise<any> {
    this._connectionStatus = 'connected';
    return { success: true, deviceInfo: this.getDeviceInfo() };
  }
  
  async disconnect(): Promise<void> {
    this._connectionStatus = 'disconnected';
    this._isCapturing = false;
  }
  
  async startCapture(session: any, handler?: any): Promise<CaptureError> {
    if (this._isCapturing) {
      return CaptureError.AlreadyCapturing;
    }
    
    this._isCapturing = true;
    
    // 模拟异步采集完成
    setTimeout(() => {
      this._isCapturing = false;
      if (handler) {
        handler({ success: true, data: this._generateMockData(session) });
      }
      this.emitCaptureCompleted({ success: true, timestamp: Date.now() });
    }, 50);
    
    return CaptureError.None;
  }
  
  async stopCapture(): Promise<boolean> {
    this._isCapturing = false;
    return true;
  }
  
  async enterBootloader(): Promise<boolean> {
    return true;
  }
  
  async getStatus(): Promise<any> {
    return {
      connected: this._connectionStatus === 'connected',
      capturing: this._isCapturing,
      deviceVersion: this.deviceVersion
    };
  }
  
  private _generateMockData(session: any) {
    return {
      sampleRate: session.frequency || 24000000,
      totalSamples: (session.preTriggerSamples || 0) + (session.postTriggerSamples || 0),
      channels: session.captureChannels || []
    };
  }
}

describe('AnalyzerDriverBase 增强测试套件', () => {
  let driver: TestableAnalyzerDriver;
  let mockAnalyzer: MockAnalyzerDriver;
  
  beforeEach(() => {
    driver = new TestableAnalyzerDriver();
    mockAnalyzer = new MockAnalyzerDriver();
  });
  
  afterEach(() => {
    driver.dispose();
    mockAnalyzer.reset();
  });
  
  describe('核心属性和初始化', () => {
    it('应该正确初始化基础属性', () => {
      expect(driver.deviceVersion).toBe('2.1.0-test');
      expect(driver.channelCount).toBe(24);
      expect(driver.maxFrequency).toBe(100_000_000);
      expect(driver.bufferSize).toBe(96000);
      expect(driver.blastFrequency).toBe(100_000_000);
      expect(driver.driverType).toBe(AnalyzerDriverType.Single);
      expect(driver.isNetwork).toBe(false);
    });
    
    it('minFrequency应该根据maxFrequency正确计算', () => {
      const expectedMinFreq = Math.floor((driver.maxFrequency * 2) / 65535);
      expect(driver.minFrequency).toBe(expectedMinFreq);
      expect(driver.minFrequency).toBeGreaterThan(0);
    });
    
    it('初始状态应该正确', () => {
      expect(driver.isCapturing).toBe(false);
      expect(driver.tag).toBeUndefined();
    });
  });
  
  describe('采集模式管理', () => {
    it('getCaptureMode应该根据通道数返回正确模式', () => {
      // 测试不同通道数的模式判断
      const testCases = [
        { channels: [0, 1, 2, 3], expected: CaptureMode.Channels_8 },
        { channels: [0, 1, 2, 3, 4, 5, 6, 7], expected: CaptureMode.Channels_8 },
        { channels: Array.from({ length: 9 }, (_, i) => i), expected: CaptureMode.Channels_16 },
        { channels: Array.from({ length: 16 }, (_, i) => i), expected: CaptureMode.Channels_16 },
        { channels: Array.from({ length: 17 }, (_, i) => i), expected: CaptureMode.Channels_24 },
        { channels: Array.from({ length: 24 }, (_, i) => i), expected: CaptureMode.Channels_24 }
      ];
      
      testCases.forEach(({ channels, expected }) => {
        expect(driver.getCaptureMode(channels)).toBe(expected);
      });
    });
    
    it('getLimits应该返回正确的采集限制', () => {
      const channels8 = [0, 1, 2, 3, 4, 5, 6, 7];
      const limits8 = driver.getLimits(channels8);
      
      expect(limits8).toHaveProperty('minPreSamples');
      expect(limits8).toHaveProperty('maxPreSamples');
      expect(limits8).toHaveProperty('minPostSamples');
      expect(limits8).toHaveProperty('maxPostSamples');
      expect(limits8).toHaveProperty('maxTotalSamples');
      
      expect(limits8.minPreSamples).toBe(2);
      expect(limits8.maxPreSamples).toBeGreaterThan(limits8.minPreSamples);
      expect(limits8.minPostSamples).toBe(2);
      expect(limits8.maxPostSamples).toBeGreaterThan(limits8.minPostSamples);
      expect(limits8.maxTotalSamples).toBe(limits8.minPreSamples + limits8.maxPostSamples);
    });
    
    it('不同通道模式的限制应该不同', () => {
      const limits8 = driver.getLimits([0, 1, 2, 3]);
      const limits16 = driver.getLimits(Array.from({ length: 16 }, (_, i) => i));
      const limits24 = driver.getLimits(Array.from({ length: 24 }, (_, i) => i));
      
      // 通道数越多，可用样本数越少
      expect(limits24.maxTotalSamples).toBeLessThanOrEqual(limits16.maxTotalSamples);
      expect(limits16.maxTotalSamples).toBeLessThanOrEqual(limits8.maxTotalSamples);
    });
  });
  
  describe('设备信息管理', () => {
    it('getDeviceInfo应该返回完整设备信息', () => {
      const deviceInfo = driver.getDeviceInfo();
      
      expect(deviceInfo).toMatchObject({
        name: expect.stringContaining('2.1.0-test'),
        maxFrequency: driver.maxFrequency,
        blastFrequency: driver.blastFrequency,
        channels: driver.channelCount,
        bufferSize: driver.bufferSize,
        modeLimits: expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
          expect.any(Object)
        ])
      });
      
      expect(deviceInfo.modeLimits).toHaveLength(3);
    });
    
    it('网络相关方法应该有默认实现', async () => {
      const voltageStatus = await driver.getVoltageStatus();
      expect(voltageStatus).toBe('UNSUPPORTED');
      
      const networkResult = await driver.sendNetworkConfig('test', 'pass', '192.168.1.1', 8080);
      expect(networkResult).toBe(false);
    });
  });
  
  describe('采集功能核心测试', () => {
    const mockSession = {
      frequency: 24000000,
      preTriggerSamples: 1000,
      postTriggerSamples: 10000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      captureChannels: [
        { channelNumber: 0, channelName: 'CH0' },
        { channelNumber: 1, channelName: 'CH1' }
      ]
    };
    
    it('startCapture应该正确启动采集', async () => {
      const startTime = Date.now();
      const result = await driver.startCapture(mockSession);
      const endTime = Date.now();
      
      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);
      expect(endTime - startTime).toBeWithinPerformanceBudget(100);
    });
    
    it('应该正确处理采集完成事件', async () => {
      let captureCompletedCalled = false;
      let captureData: any = null;
      
      const handler = (data: any) => {
        captureCompletedCalled = true;
        captureData = data;
      };
      
      driver.on('captureCompleted', handler);
      
      await driver.startCapture(mockSession, handler);
      
      // 等待异步采集完成
      await TestUtils.waitFor(() => !driver.isCapturing, 200);
      
      expect(captureCompletedCalled).toBe(true);
      expect(captureData).toMatchObject({
        success: true,
        timestamp: expect.any(Number)
      });
    });
    
    it('stopCapture应该正确停止采集', async () => {
      await driver.startCapture(mockSession);
      expect(driver.isCapturing).toBe(true);
      
      const result = await driver.stopCapture();
      expect(result).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });
    
    it('重复启动采集应该返回错误', async () => {
      await driver.startCapture(mockSession);
      expect(driver.isCapturing).toBe(true);
      
      const result = await driver.startCapture(mockSession);
      expect(result).toBe(CaptureError.AlreadyCapturing);
    });
  });
  
  describe('事件系统测试', () => {
    it('应该正确触发状态变化事件', async () => {
      let statusChangeCount = 0;
      let lastStatus: any = null;
      
      driver.on('statusChanged', (status) => {
        statusChangeCount++;
        lastStatus = status;
      });
      
      driver.emitStatusChanged({ connected: true, capturing: false });
      
      expect(statusChangeCount).toBe(1);
      expect(lastStatus).toMatchObject({ connected: true, capturing: false });
    });
    
    it('应该正确触发错误事件', async () => {
      let errorCount = 0;
      let lastError: Error | null = null;
      
      driver.on('error', (error: Error) => {
        errorCount++;
        lastError = error;
      });
      
      const testError = new Error('Test error');
      driver.emitError(testError);
      
      expect(errorCount).toBe(1);
      expect(lastError).toBe(testError);
    });
    
    it('dispose应该清除所有事件监听器', () => {
      const handler = jest.fn();
      driver.on('test-event', handler);
      
      expect(driver.listenerCount('test-event')).toBe(1);
      
      driver.dispose();
      
      expect(driver.listenerCount('test-event')).toBe(0);
      driver.emit('test-event');
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('OutputPacket 功能测试', () => {
    let packet: OutputPacket;
    
    beforeEach(() => {
      packet = new OutputPacket();
    });
    
    it('应该正确添加字节数据', () => {
      packet.addByte(0x55);
      packet.addByte(0xAA);
      packet.addByte(0xF0);
      
      const serialized = packet.serialize();
      // 应该包含起始标记、转义数据和结束标记
      expect(serialized.length).toBeGreaterThan(7); // 2 + 转义数据 + 2
    });
    
    it('应该正确处理转义序列', () => {
      // 测试需要转义的字节
      const testBytes = [0x55, 0xAA, 0xF0];
      packet.addBytes(testBytes);
      
      const serialized = packet.serialize();
      
      // 验证起始和结束标记
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[serialized.length - 2]).toBe(0xAA);
      expect(serialized[serialized.length - 1]).toBe(0x55);
      
      // 验证转义序列存在
      let escapeSequenceCount = 0;
      for (let i = 2; i < serialized.length - 2; i++) {
        if (serialized[i] === 0xF0) {
          escapeSequenceCount++;
        }
      }
      expect(escapeSequenceCount).toBe(testBytes.length);
    });
    
    it('应该正确添加字符串数据', () => {
      const testString = 'Hello';
      packet.addString(testString);
      
      const serialized = packet.serialize();
      expect(serialized.length).toBe(2 + testString.length + 2); // 起始 + 数据 + 结束
    });
    
    it('clear应该清空数据缓冲区', () => {
      packet.addByte(0x55);
      packet.addByte(0xAA);
      
      let serialized = packet.serialize();
      expect(serialized.length).toBeGreaterThan(4);
      
      packet.clear();
      serialized = packet.serialize();
      expect(serialized.length).toBe(4); // 只有起始和结束标记
    });
  });
  
  describe('CaptureRequest 功能测试', () => {
    it('应该正确创建默认请求', () => {
      const request = new CaptureRequest();
      
      expect(request.triggerType).toBe(0);
      expect(request.trigger).toBe(0);
      expect(request.frequency).toBe(0);
      expect(request.channels).toBeInstanceOf(Uint8Array);
      expect(request.channels.length).toBe(24);
    });
    
    it('fromConfiguration应该正确转换配置', () => {
      const config = {
        triggerType: TriggerType.Edge,
        triggerChannel: 5,
        triggerInverted: true,
        triggerPattern: 0x1234,
        captureChannels: [0, 1, 2],
        frequency: 50000000,
        preTriggerSamples: 500,
        postTriggerSamples: 5000,
        loopCount: 10,
        measureBursts: true,
        captureMode: CaptureMode.Channels_8
      };
      
      const request = CaptureRequest.fromConfiguration(config);
      
      expect(request.triggerType).toBe(config.triggerType);
      expect(request.trigger).toBe(config.triggerChannel);
      expect(request.invertedOrCount).toBe(1);
      expect(request.triggerValue).toBe(config.triggerPattern);
      expect(request.channelCount).toBe(config.captureChannels.length);
      expect(request.frequency).toBe(config.frequency);
      expect(request.preSamples).toBe(config.preTriggerSamples);
      expect(request.postSamples).toBe(config.postTriggerSamples);
      expect(request.loopCount).toBe(config.loopCount);
      expect(request.measure).toBe(1);
      expect(request.captureMode).toBe(config.captureMode);
    });
    
    it('serialize应该生成正确大小的字节数组', () => {
      const request = new CaptureRequest();
      request.frequency = 1000000; // 设置有效频率
      const serialized = request.serialize();
      
      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBe(45); // 预期的结构体大小
    });
    
    it('序列化应该保持字节序一致性', () => {
      const request = new CaptureRequest();
      request.triggerValue = 0x1234;
      request.frequency = 0x12345678;
      
      const serialized = request.serialize();
      const view = new DataView(serialized.buffer);
      
      // 验证little-endian字节序
      const triggerValue = view.getUint16(3, true);
      expect(triggerValue).toBe(0x1234);
      
      // frequency位于偏移量30: triggerType(1) + trigger(1) + invertedOrCount(1) + triggerValue(2) + channels(24) + channelCount(1) = 30
      const frequency = view.getUint32(30, true);
      expect(frequency).toBe(0x12345678);
    });
  });
  
  describe('性能和内存测试', () => {
    it('多次操作不应造成内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 执行多次采集操作
      for (let i = 0; i < 20; i++) {
        await driver.startCapture({ frequency: 24000000 });
        await TestUtils.waitFor(() => !driver.isCapturing, 100);
      }
      
      // 触发垃圾收集
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      expect({ memoryGrowth, leakDetected: memoryGrowth > 10 * 1024 * 1024 })
        .toHaveMemoryLeakBelow(10 * 1024 * 1024); // 10MB阈值
    });
    
    it('设备信息获取应该在性能预算内', () => {
      const iterations = 1000;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        driver.getDeviceInfo();
      }
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / iterations;
      
      expect(avgTime).toBeWithinPerformanceBudget(1); // 平均1ms内
    });
  });
  
  describe('边界条件和错误处理', () => {
    it('应该处理空通道列表', () => {
      const mode = driver.getCaptureMode([]);
      expect(mode).toBe(CaptureMode.Channels_8); // 默认模式
      
      const limits = driver.getLimits([]);
      expect(limits).toBeDefined();
      expect(limits.maxTotalSamples).toBeGreaterThan(0);
    });
    
    it('应该处理超大通道数组', () => {
      const hugeChannels = Array.from({ length: 1000 }, (_, i) => i);
      const mode = driver.getCaptureMode(hugeChannels);
      expect(mode).toBe(CaptureMode.Channels_24); // 最大模式
    });
    
    it('应该处理负数通道', () => {
      const invalidChannels = [-1, -5, 999];
      expect(() => driver.getCaptureMode(invalidChannels)).not.toThrow();
    });
  });
  
  describe('测试场景集成', () => {
    it('完整采集工作流程', async () => {
      const scenario = new TestScenarioBuilder()
        .name('完整采集工作流程')
        .description('测试从连接到数据采集的完整流程')
        .setup(async () => {
          await driver.connect({ devicePath: '/dev/mock' });
        })
        .execute(async () => {
          const session = {
            frequency: 24000000,
            preTriggerSamples: 1000,
            postTriggerSamples: 10000,
            captureChannels: [0, 1, 2, 3]
          };
          
          await driver.startCapture(session);
          await TestUtils.waitFor(() => !driver.isCapturing, 200);
          
          return { success: true };
        })
        .verify((result) => result.success === true)
        .teardown(async () => {
          await driver.disconnect();
        })
        .build();
      
      await scenario.setup();
      const result = await scenario.execute();
      const isValid = scenario.verify(result);
      await scenario.teardown();
      
      expect(isValid).toBe(true);
    });
  });
});