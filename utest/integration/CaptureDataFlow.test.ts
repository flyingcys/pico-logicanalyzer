/**
 * 数据采集流程集成测试
 * 测试CaptureSession、AnalyzerChannel与其他系统组件的集成
 */

import '../../src/tests/setup';
import '../../src/tests/matchers';
import { MockAnalyzerDriver, TestUtils } from '../../src/tests/mocks';
import {
  CaptureSession,
  AnalyzerChannel,
  CaptureRequestBuilder,
  OutputPacket,
  CaptureEventArgs
} from '../../src/models/CaptureModels';
import {
  TriggerType,
  CaptureMode
} from '../../src/models/AnalyzerTypes';

describe('数据采集流程集成测试', () => {
  let mockDriver: MockAnalyzerDriver;
  let captureSession: CaptureSession;
  
  beforeEach(() => {
    mockDriver = new MockAnalyzerDriver();
    captureSession = new CaptureSession();
  });
  
  describe('采集会话与驱动集成', () => {
    it('应该正确创建采集请求并发送给驱动', async () => {
      // 配置采集会话
      captureSession.frequency = 24000000;
      captureSession.preTriggerSamples = 100;
      captureSession.postTriggerSamples = 2000;
      captureSession.triggerType = TriggerType.Simple;
      captureSession.triggerChannel = 2;
      
      // 添加测试通道
      captureSession.captureChannels.push(
        new AnalyzerChannel(0, 'CLK'),
        new AnalyzerChannel(2, 'DATA'),
        new AnalyzerChannel(7, 'CS')
      );
      
      // 构建采集请求
      const requestData = CaptureRequestBuilder.buildCaptureRequest(captureSession);
      
      // 使用OutputPacket封装请求
      const packet = new OutputPacket();
      packet.addStruct(requestData);
      const serializedRequest = packet.serialize();
      
      // 模拟发送给驱动
      const success = await mockDriver.sendCaptureRequest(serializedRequest);
      
      expect(success).toBe(true);
      expect(mockDriver.wasCalledWith('sendCaptureRequest')).toBe(true);
      
      // 验证驱动接收到正确的数据
      const callHistory = mockDriver.getCallHistory();
      const captureCall = callHistory.find(call => call.method === 'sendCaptureRequest');
      expect(captureCall).toBeDefined();
      expect(captureCall.args[0]).toBeInstanceOf(Uint8Array);
      expect(captureCall.args[0].length).toBeGreaterThan(0);
    });
    
    it('应该正确处理采集完成事件', async () => {
      // 设置采集会话
      captureSession.frequency = 12000000;
      captureSession.postTriggerSamples = 1000;
      captureSession.captureChannels.push(
        new AnalyzerChannel(0, 'Signal 1'),
        new AnalyzerChannel(1, 'Signal 2')
      );
      
      // 注册事件处理器
      let captureCompleted = false;
      let captureResult: CaptureEventArgs | null = null;
      
      const eventHandler = (args: CaptureEventArgs) => {
        captureCompleted = true;
        captureResult = args;
      };
      
      // 模拟驱动开始采集
      await mockDriver.startCapture(captureSession, eventHandler);
      
      // 等待采集完成 (模拟异步采集)
      await TestUtils.delay(100);
      
      expect(captureCompleted).toBe(true);
      expect(captureResult).not.toBeNull();
      expect(captureResult!.success).toBe(true);
      expect(captureResult!.session).toBeDefined();
      expect(captureResult!.session.captureChannels).toHaveLength(2);
      
      // 验证返回的会话包含样本数据
      captureResult!.session.captureChannels.forEach(channel => {
        expect(channel.samples).toBeDefined();
        expect(channel.samples!.length).toBeGreaterThan(0);
      });
    });
    
    it('应该正确处理采集失败情况', async () => {
      // 配置无效的采集会话 (触发失败)
      captureSession.frequency = -1; // 无效频率
      captureSession.captureChannels = []; // 无通道
      
      let captureCompleted = false;
      let captureResult: CaptureEventArgs | null = null;
      
      const eventHandler = (args: CaptureEventArgs) => {
        captureCompleted = true;
        captureResult = args;
      };
      
      // 模拟驱动处理无效请求
      await mockDriver.startCapture(captureSession, eventHandler);
      await TestUtils.delay(50);
      
      expect(captureCompleted).toBe(true);
      expect(captureResult).not.toBeNull();
      expect(captureResult!.success).toBe(false);
    });
  });
  
  describe('数据传输协议集成', () => {
    it('应该正确序列化和反序列化采集配置', () => {
      // 创建复杂的采集配置
      captureSession.frequency = 48000000;
      captureSession.preTriggerSamples = 500;
      captureSession.postTriggerSamples = 5000;
      captureSession.loopCount = 10;
      captureSession.measureBursts = true;
      captureSession.triggerType = TriggerType.Complex;
      captureSession.triggerChannel = 15;
      captureSession.triggerInverted = true;
      captureSession.triggerPattern = 0xABCD;
      
      // 添加多个通道
      for (let i = 0; i < 24; i += 3) {
        captureSession.captureChannels.push(new AnalyzerChannel(i, `CH${i}`));
      }
      
      // 序列化配置
      const binaryData = CaptureRequestBuilder.buildCaptureRequest(captureSession);
      expect(binaryData.length).toBeGreaterThan(50);
      
      // 验证关键字段
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      expect(view.getUint32(29, true)).toBe(48000000); // frequency字段
      expect(view.getUint32(33, true)).toBe(500); // preSamples字段  
      expect(view.getUint32(37, true)).toBe(5000); // postSamples字段
      expect(view.getUint8(41)).toBe(10); // loopCount字段
      expect(view.getUint8(42)).toBe(1); // measure字段
    });
    
    it('应该正确处理协议转义和数据完整性', () => {
      const packet = new OutputPacket();
      
      // 创建包含特殊字节的测试数据
      const testData = new Uint8Array([
        0x55, 0xAA, 0xF0, // 需要转义的字节
        0x42, 0x33, 0x21, // 普通字节
        0xAA, 0x55, 0xF0  // 更多需要转义的字节
      ]);
      
      packet.addBytes(testData);
      const serialized = packet.serialize();
      
      // 验证转义后的数据长度增加
      expect(serialized.length).toBeGreaterThan(testData.length + 4); // +4 for start/end markers
      
      // 验证起始和结束标记
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[serialized.length - 2]).toBe(0xAA);
      expect(serialized[serialized.length - 1]).toBe(0x55);
      
      // 验证转义字节不会出现在数据部分
      const dataSection = serialized.slice(2, -2);
      let consecutiveSpecialBytes = 0;
      for (let i = 0; i < dataSection.length - 1; i++) {
        if ((dataSection[i] === 0x55 && dataSection[i + 1] === 0xAA) ||
            (dataSection[i] === 0xAA && dataSection[i + 1] === 0x55)) {
          consecutiveSpecialBytes++;
        }
      }
      expect(consecutiveSpecialBytes).toBe(0); // 数据部分不应包含起始/结束标记序列
    });
  });
  
  describe('内存管理和性能集成', () => {
    it('应该正确处理大数据量采集会话', () => {
      // 创建大型采集会话
      captureSession.frequency = 100000000;
      captureSession.postTriggerSamples = 1000000; // 1M样本
      
      // 添加24个通道
      for (let i = 0; i < 24; i++) {
        const channel = new AnalyzerChannel(i, `Channel ${i}`);
        // 模拟大数据量
        channel.samples = new Uint8Array(100000); // 100K样本数据
        
        // 填充测试数据
        for (let j = 0; j < channel.samples.length; j++) {
          channel.samples[j] = (i + j) % 256;
        }
        
        captureSession.captureChannels.push(channel);
      }
      
      // 测试克隆性能
      const startTime = performance.now();
      const clonedSession = captureSession.clone();
      const cloneTime = performance.now() - startTime;
      
      expect(cloneTime).toBeWithinPerformanceBudget(500); // 500ms内完成克隆
      
      // 验证克隆结果
      expect(clonedSession.captureChannels).toHaveLength(24);
      expect(clonedSession.captureChannels[0].samples).toHaveLength(100000);
      expect(clonedSession.captureChannels[0].samples![0]).toBe(0);
      expect(clonedSession.captureChannels[23].samples![99999]).toBe((23 + 99999) % 256);
      
      // 验证是独立的副本
      expect(clonedSession.captureChannels[0].samples).not.toBe(captureSession.captureChannels[0].samples);
    });
    
    it('应该正确处理并发采集请求', async () => {
      const sessions = [];
      const results = [];
      
      // 创建多个并发采集会话
      for (let i = 0; i < 5; i++) {
        const session = new CaptureSession();
        session.frequency = 24000000 + i * 1000000;
        session.postTriggerSamples = 1000 + i * 100;
        session.captureChannels.push(
          new AnalyzerChannel(i, `Session ${i} CH0`),
          new AnalyzerChannel(i + 8, `Session ${i} CH1`)
        );
        sessions.push(session);
      }
      
      // 并发发送采集请求
      const promises = sessions.map(async (session, index) => {
        const driver = new MockAnalyzerDriver();
        return new Promise<CaptureEventArgs>((resolve) => {
          const handler = (args: CaptureEventArgs) => resolve(args);
          driver.startCapture(session, handler);
        });
      });
      
      const startTime = Date.now();
      const captureResults = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeWithinPerformanceBudget(1000); // 1秒内完成所有并发请求
      expect(captureResults).toHaveLength(5);
      
      // 验证每个结果
      captureResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.session.captureChannels).toHaveLength(2);
        expect(result.session.frequency).toBe(24000000 + index * 1000000);
      });
    });
  });
  
  describe('错误处理和边界条件集成', () => {
    it('应该正确处理驱动连接失败', async () => {
      // 配置模拟驱动返回连接失败
      mockDriver.setSimulateConnectionFailure(true);
      
      captureSession.captureChannels.push(new AnalyzerChannel(0, 'Test Channel'));
      
      let errorCaught = false;
      let captureResult: CaptureEventArgs | null = null;
      
      const eventHandler = (args: CaptureEventArgs) => {
        captureResult = args;
      };
      
      try {
        await mockDriver.startCapture(captureSession, eventHandler);
        await TestUtils.delay(100);
      } catch (error) {
        errorCaught = true;
      }
      
      // 验证错误处理
      expect(captureResult).not.toBeNull();
      expect(captureResult!.success).toBe(false);
    });
    
    it('应该正确处理无效的网络配置', () => {
      const invalidNetConfig = {
        accessPointName: '', // 空名称
        password: 'a'.repeat(100), // 超长密码
        ipAddress: '999.999.999.999', // 无效IP
        port: 99999 // 超出端口范围
      };
      
      expect(() => {
        const binaryData = CaptureRequestBuilder.buildNetConfig(invalidNetConfig);
        expect(binaryData).toBeDefined();
        expect(binaryData.length).toBe(113);
      }).not.toThrow();
    });
    
    it('应该正确处理极限采集参数', () => {
      // 设置极限参数
      captureSession.frequency = 4294967295; // uint32最大值
      captureSession.preTriggerSamples = 4294967295;
      captureSession.postTriggerSamples = 4294967295;
      captureSession.loopCount = 255; // byte最大值
      
      // 添加最大数量的通道
      for (let i = 0; i < 24; i++) {
        captureSession.captureChannels.push(new AnalyzerChannel(i, `Extreme CH${i}`));
      }
      
      expect(() => {
        const binaryData = CaptureRequestBuilder.buildCaptureRequest(captureSession);
        expect(binaryData).toBeDefined();
        
        // 验证极限值被正确写入
        const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
        expect(view.getUint32(29, true)).toBe(4294967295); // frequency
        expect(view.getUint8(41)).toBe(255); // loopCount
      }).not.toThrow();
    });
  });
  
  describe('向后兼容性集成', () => {
    it('应该与C#版本的数据格式完全兼容', () => {
      // 创建与C#测试用例相同的配置
      captureSession.frequency = 24000000;
      captureSession.preTriggerSamples = 100;
      captureSession.postTriggerSamples = 2000;
      captureSession.triggerType = TriggerType.Simple;
      captureSession.triggerChannel = 0;
      captureSession.triggerInverted = false;
      captureSession.triggerPattern = 0;
      captureSession.loopCount = 0;
      captureSession.measureBursts = false;
      
      captureSession.captureChannels.push(new AnalyzerChannel(0, 'Channel 1'));
      
      const binaryData = CaptureRequestBuilder.buildCaptureRequest(captureSession);
      
      // 验证与C#版本的预期二进制输出一致
      expect(binaryData.length).toBeGreaterThan(40);
      
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      
      // 验证关键字段与C#版本一致
      expect(view.getUint8(0)).toBe(0); // TriggerType.Simple = 0
      expect(view.getUint8(1)).toBe(0); // triggerChannel = 0
      expect(view.getUint8(2)).toBe(0); // triggerInverted = false
      expect(view.getUint16(3, true)).toBe(0); // triggerPattern = 0
      expect(view.getUint8(28)).toBe(1); // channelCount = 1
      expect(view.getUint32(29, true)).toBe(24000000); // frequency
      expect(view.getUint32(33, true)).toBe(100); // preSamples
      expect(view.getUint32(37, true)).toBe(2000); // postSamples
      expect(view.getUint8(41)).toBe(0); // loopCount = 0
      expect(view.getUint8(42)).toBe(0); // measure = false
      expect(view.getUint8(43)).toBe(CaptureMode.Channels_8); // 单通道使用8通道模式
    });
    
    it('应该正确处理C#版本的突发信息格式', () => {
      const burstInfo = {
        burstSampleStart: 1000,
        burstSampleEnd: 2000,
        burstSampleGap: 500,
        burstTimeGap: 20833333 // 约20.83ms @ 24MHz
      };
      
      captureSession.bursts = [burstInfo];
      
      // 验证时间格式化与C#版本一致
      const timeStr = captureSession.bursts[0].burstTimeGap;
      expect(timeStr).toBe(20833333);
      
      // 验证toString格式与C#版本一致
      const burstStr = captureSession.bursts[0].toString();
      expect(burstStr).toContain('Burst: 1000 to 2000');
      expect(burstStr).toContain('Gap:');
      expect(burstStr).toContain('(500 samples)');
    });
  });
});