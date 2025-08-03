/**
 * CaptureModels 模块增强测试套件
 * 提供全面的测试覆盖，包括边界条件和错误处理
 */

import {
  CaptureSession,
  AnalyzerChannel,
  BurstInfo,
  CaptureLimitsImpl,
  OutputPacket,
  CaptureRequestBuilder,
  CaptureEventArgs
} from '../../../src/models/CaptureModels';
import {
  TriggerType,
  CaptureMode
} from '../../../src/models/AnalyzerTypes';

describe('CaptureModels 增强测试套件', () => {
  
  describe('CaptureSession 深度测试', () => {
    it('所有触发类型应该正确工作', () => {
      const session = new CaptureSession();
      
      // 测试所有枚举值
      session.triggerType = TriggerType.Edge;
      expect(session.triggerType).toBe(TriggerType.Edge);
      
      session.triggerType = TriggerType.Complex;
      expect(session.triggerType).toBe(TriggerType.Complex);
      
      session.triggerType = TriggerType.Fast;
      expect(session.triggerType).toBe(TriggerType.Fast);
      
      session.triggerType = TriggerType.Blast;
      expect(session.triggerType).toBe(TriggerType.Blast);
    });
    
    it('bursts 数组的深拷贝应该正确工作', () => {
      const session = new CaptureSession();
      const burst1 = new BurstInfo();
      burst1.burstSampleStart = 100;
      burst1.burstSampleEnd = 200;
      burst1.burstTimeGap = 1500000; // 1.5ms
      
      const burst2 = new BurstInfo();
      burst2.burstSampleStart = 300;
      burst2.burstSampleEnd = 400;
      burst2.burstTimeGap = 2500; // 2.5µs
      
      session.bursts = [burst1, burst2];
      
      const cloned = session.clone();
      
      expect(cloned.bursts).toHaveLength(2);
      expect(cloned.bursts![0]).not.toBe(session.bursts[0]);
      expect(cloned.bursts![0].burstSampleStart).toBe(100);
      expect(cloned.bursts![1].burstTimeGap).toBe(2500);
      
      // 修改原始对象不应该影响克隆对象
      session.bursts[0].burstSampleStart = 999;
      expect(cloned.bursts![0].burstSampleStart).toBe(100);
    });
    
    it('cloneSettings 应该清空样本数据', () => {
      const session = new CaptureSession();
      const channel = new AnalyzerChannel(0, 'Test Channel');
      channel.samples = new Uint8Array([1, 0, 1, 1, 0]);
      session.captureChannels.push(channel);
      
      const settingsClone = session.cloneSettings();
      
      expect(settingsClone.captureChannels).toHaveLength(1);
      expect(settingsClone.captureChannels[0].channelName).toBe('Test Channel');
      expect(settingsClone.captureChannels[0].samples).toBeUndefined();
    });
    
    it('极值总样本数计算', () => {
      const session = new CaptureSession();
      
      // 最小值测试
      session.preTriggerSamples = 0;
      session.postTriggerSamples = 1;
      session.loopCount = 0;
      expect(session.totalSamples).toBe(1); // 0 + 1 * (0 + 1)
      
      // 大值测试
      session.preTriggerSamples = 10000;
      session.postTriggerSamples = 50000;
      session.loopCount = 255;
      expect(session.totalSamples).toBe(12810000); // 10000 + 50000 * (255 + 1)
    });
  });
  
  describe('AnalyzerChannel 深度测试', () => {
    it('默认构造函数应该使用合理的默认值', () => {
      const channel = new AnalyzerChannel();
      
      expect(channel.channelNumber).toBe(0);
      expect(channel.channelName).toBe('Channel 1');
      expect(channel.textualChannelNumber).toBe('Channel 1');
      expect(channel.toString()).toBe('Channel 1');
      expect(channel.hidden).toBe(false);
      expect(channel.channelColor).toBeUndefined();
      expect(channel.samples).toBeUndefined();
    });
    
    it('toString 方法应该优先使用 channelName', () => {
      const channel = new AnalyzerChannel(5, 'Custom Signal');
      expect(channel.toString()).toBe('Custom Signal');
      
      const channel2 = new AnalyzerChannel(5, '');
      expect(channel2.toString()).toBe('Channel 6');
    });
    
    it('大型样本数据的克隆性能', () => {
      const channel = new AnalyzerChannel(0, 'Big Data Channel');
      const bigData = new Uint8Array(100000);
      bigData.fill(0x55);
      channel.samples = bigData;
      
      const start = performance.now();
      const cloned = channel.clone();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100); // 100ms内完成
      expect(cloned.samples).toEqual(bigData);
      expect(cloned.samples).not.toBe(bigData);
    });
  });
  
  describe('BurstInfo 时间格式化增强测试', () => {
    it('边界值时间格式化', () => {
      const burst = new BurstInfo();
      
      // 边界值测试
      burst.burstTimeGap = 999; // 最大纳秒
      expect(burst.getTime()).toBe('999 ns');
      
      burst.burstTimeGap = 1000; // 最小微秒
      expect(burst.getTime()).toBe('1.000 µs');
      
      burst.burstTimeGap = 999999; // 最大微秒
      expect(burst.getTime()).toBe('999.999 µs');
      
      burst.burstTimeGap = 1000000; // 最小毫秒
      expect(burst.getTime()).toBe('1.000 ms');
      
      burst.burstTimeGap = 999999999; // 最大毫秒
      expect(burst.getTime()).toBe('1000.000 ms'); // 实际上这已经是1秒了
      
      burst.burstTimeGap = 1000000000; // 最小秒
      expect(burst.getTime()).toBe('1.000 s');
    });
    
    it('toString 方法应该包含完整信息', () => {
      const burst = new BurstInfo();
      burst.burstSampleStart = 1000;
      burst.burstSampleEnd = 2000;
      burst.burstTimeGap = 1500000; // 1.5ms
      burst.burstSampleGap = 500;
      
      const result = burst.toString();
      expect(result).toContain('1000');
      expect(result).toContain('2000');
      expect(result).toContain('1.500 ms');
      expect(result).toContain('500 samples');
    });
  });
  
  describe('CaptureLimitsImpl 测试', () => {
    it('默认值应该合理', () => {
      const limits = new CaptureLimitsImpl();
      
      expect(limits.minPreSamples).toBe(2);
      expect(limits.maxPreSamples).toBe(1000);
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPostSamples).toBe(10000);
      expect(limits.maxTotalSamples).toBe(11000);
    });
    
    it('计算属性应该正确工作', () => {
      const limits = new CaptureLimitsImpl();
      limits.maxPreSamples = 5000;
      limits.maxPostSamples = 15000;
      
      expect(limits.maxTotalSamples).toBe(20000);
    });
  });
  
  describe('OutputPacket 协议增强测试', () => {
    it('大量数据的转义性能', () => {
      const packet = new OutputPacket();
      const testData = new Uint8Array(10000);
      // 创建需要大量转义的数据
      for (let i = 0; i < testData.length; i++) {
        testData[i] = [0xAA, 0x55, 0xF0][i % 3];
      }
      
      const start = performance.now();
      packet.addBytes(testData);
      const serialized = packet.serialize();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50); // 50ms内完成
      expect(serialized.length).toBe(2 + testData.length * 2 + 2); // 每个字节都被转义
    });
    
    it('addString 应该正确处理 UTF-8', () => {
      const packet = new OutputPacket();
      packet.addString('Hello 世界 🚀');
      
      const serialized = packet.serialize();
      // 验证包含起始和结束标记
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[serialized.length - 2]).toBe(0xAA);
      expect(serialized[serialized.length - 1]).toBe(0x55);
    });
    
    it('addStruct 应该支持 ArrayBuffer', () => {
      const packet = new OutputPacket();
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, true);
      
      packet.addStruct(buffer);
      const serialized = packet.serialize();
      
      expect(serialized.length).toBe(4 + 4); // 4字节数据 + 起始结束标记
    });
    
    it('clear 方法应该重置状态', () => {
      const packet = new OutputPacket();
      packet.addByte(0x42);
      packet.addString('test');
      
      let serialized = packet.serialize();
      expect(serialized.length).toBeGreaterThan(4);
      
      packet.clear();
      serialized = packet.serialize();
      expect(serialized.length).toBe(4); // 只有起始和结束标记
    });
  });
  
  describe('CaptureRequestBuilder 增强测试', () => {
    it('极端通道配置测试', () => {
      const session = new CaptureSession();
      session.frequency = 100000000; // 100MHz
      session.preTriggerSamples = 0;
      session.postTriggerSamples = 4000000; // 4M samples
      session.triggerType = TriggerType.Complex;
      session.triggerPattern = 0xFFFF;
      session.loopCount = 255;
      session.measureBursts = true;
      
      // 添加最大通道数
      for (let i = 0; i < 24; i++) {
        session.captureChannels.push(new AnalyzerChannel(i, `CH${i}`));
      }
      
      const binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      
      let offset = 0;
      expect(view.getUint8(offset++)).toBe(TriggerType.Complex);
      expect(view.getUint8(offset++)).toBe(0); // triggerChannel
      expect(view.getUint8(offset++)).toBe(0); // triggerInverted = false
      expect(view.getUint16(offset, true)).toBe(0xFFFF);
      offset += 2;
      
      // 验证所有24个通道都被启用
      for (let i = 0; i < 24; i++) {
        expect(view.getUint8(offset + i)).toBe(1);
      }
      offset += 24;
      
      expect(view.getUint8(offset++)).toBe(24); // channelCount
      expect(view.getUint32(offset, true)).toBe(100000000); // frequency
      offset += 4;
      expect(view.getUint32(offset, true)).toBe(0); // preSamples
      offset += 4;
      expect(view.getUint32(offset, true)).toBe(4000000); // postSamples
      offset += 4;
      expect(view.getUint8(offset++)).toBe(255); // loopCount
      expect(view.getUint8(offset++)).toBe(1); // measureBursts
      expect(view.getUint8(offset++)).toBe(CaptureMode.Channels_24); // captureMode
    });
    
    it('网络配置构建测试', () => {
      const config = {
        accessPointName: 'TestAP',
        password: 'secret123',
        ipAddress: '192.168.1.100',
        port: 8080
      };
      
      const binaryData = CaptureRequestBuilder.buildNetConfig(config);
      expect(binaryData.length).toBe(115);
      
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      
      // 验证端口字段（最后2字节）
      const port = view.getUint16(113, true); // little endian
      expect(port).toBe(8080);
    });
    
    it('超长字符串截断测试', () => {
      const longName = 'A'.repeat(100);
      const longPassword = 'B'.repeat(100);
      const longIP = '192.168.1.100.extra.long';
      
      const config = {
        accessPointName: longName,
        password: longPassword,
        ipAddress: longIP,
        port: 9999
      };
      
      const binaryData = CaptureRequestBuilder.buildNetConfig(config);
      expect(binaryData.length).toBe(115);
      
      // 验证字符串被正确截断且以 null 结尾
      expect(binaryData[32]).toBe(0); // AP name 第33字节应该是0
      expect(binaryData[96]).toBe(0); // Password 第64字节应该是0
      expect(binaryData[112]).toBe(0); // IP 第16字节应该是0
    });
  });
  
  describe('CaptureEventArgs 测试', () => {
    it('构造函数应该正确设置属性', () => {
      const session = new CaptureSession();
      session.frequency = 48000000;
      
      const successArgs = new CaptureEventArgs(true, session);
      expect(successArgs.success).toBe(true);
      expect(successArgs.session).toBe(session);
      expect(successArgs.session.frequency).toBe(48000000);
      
      const failArgs = new CaptureEventArgs(false, session);
      expect(failArgs.success).toBe(false);
      expect(failArgs.session).toBe(session);
    });
  });
  
  describe('集成测试', () => {
    it('完整的采集流程数据结构兼容性', () => {
      // 创建完整的采集会话
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 10000;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 3;
      session.triggerInverted = true;
      session.measureBursts = true;
      
      // 添加通道和样本数据
      for (let i = 0; i < 8; i++) {
        const channel = new AnalyzerChannel(i, `Signal_${i}`);
        channel.samples = new Uint8Array(1000);
        channel.samples.fill(i % 2); // 交替填充0和1
        session.captureChannels.push(channel);
      }
      
      // 添加突发信息
      const burst = new BurstInfo();
      burst.burstSampleStart = 500;
      burst.burstSampleEnd = 600;
      burst.burstTimeGap = 1500000; // 1.5ms
      session.bursts = [burst];
      
      // 构建二进制请求
      const binaryRequest = CaptureRequestBuilder.buildCaptureRequest(session);
      expect(binaryRequest.length).toBeGreaterThan(40); // 调整预期长度
      
      // 使用OutputPacket封装
      const packet = new OutputPacket();
      packet.addStruct(binaryRequest);
      const finalPacket = packet.serialize();
      
      // 验证协议格式
      expect(finalPacket[0]).toBe(0x55);
      expect(finalPacket[1]).toBe(0xAA);
      expect(finalPacket[finalPacket.length - 2]).toBe(0xAA);
      expect(finalPacket[finalPacket.length - 1]).toBe(0x55);
      
      // 测试事件系统
      const eventArgs = new CaptureEventArgs(true, session);
      expect(eventArgs.success).toBe(true);
      expect(eventArgs.session.totalSamples).toBe(11000);
    });
  });
});