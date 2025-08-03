/**
 * 数据采集模块简化单元测试
 * 测试核心功能，无复杂依赖
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

describe('数据采集模块核心测试', () => {
  
  describe('CaptureSession 基础功能', () => {
    it('应该正确初始化默认值', () => {
      const session = new CaptureSession();
      
      expect(session.frequency).toBe(1000000);
      expect(session.preTriggerSamples).toBe(0);
      expect(session.postTriggerSamples).toBe(1000);
      expect(session.loopCount).toBe(0);
      expect(session.measureBursts).toBe(false);
      expect(session.captureChannels).toEqual([]);
      expect(session.triggerType).toBe(TriggerType.Edge);
      expect(session.triggerChannel).toBe(0);
      expect(session.triggerInverted).toBe(false);
      expect(session.triggerBitCount).toBe(1);
      expect(session.triggerPattern).toBe(0);
    });
    
    it('应该正确计算总样本数', () => {
      const session = new CaptureSession();
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 1000;
      session.loopCount = 2;
      
      const expectedTotal = 100 + 1000 * (2 + 1); // preTrigger + postTrigger * (loopCount + 1)
      expect(session.totalSamples).toBe(expectedTotal);
    });
    
    it('clone方法应该进行完整的深拷贝', () => {
      const session = new CaptureSession();
      session.frequency = 48000000;
      session.preTriggerSamples = 200;
      session.triggerType = TriggerType.Complex;
      
      const channel = new AnalyzerChannel(0, 'Test Channel');
      channel.samples = new Uint8Array([1, 0, 1, 1, 0]);
      session.captureChannels.push(channel);
      
      const cloned = session.clone();
      
      expect(cloned.frequency).toBe(48000000);
      expect(cloned.preTriggerSamples).toBe(200);
      expect(cloned.triggerType).toBe(TriggerType.Complex);
      expect(cloned.captureChannels).toHaveLength(1);
      expect(cloned.captureChannels[0]).not.toBe(session.captureChannels[0]);
      expect(cloned.captureChannels[0].channelName).toBe('Test Channel');
      expect(cloned.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(cloned.captureChannels[0].samples).not.toBe(session.captureChannels[0].samples);
    });
  });
  
  describe('AnalyzerChannel 基础功能', () => {
    it('应该正确初始化', () => {
      const channel = new AnalyzerChannel(5, 'Custom Channel');
      
      expect(channel.channelNumber).toBe(5);
      expect(channel.channelName).toBe('Custom Channel');
      expect(channel.textualChannelNumber).toBe('Channel 6'); // channelNumber + 1
      expect(channel.hidden).toBe(false);
      expect(channel.samples).toBeUndefined();
    });
    
    it('clone方法应该正确工作', () => {
      const original = new AnalyzerChannel(3, 'Clock Signal');
      original.channelColor = 0x33FF57;
      original.samples = new Uint8Array([1, 0, 1, 0]);
      
      const cloned = original.clone();
      
      expect(cloned).not.toBe(original);
      expect(cloned.channelNumber).toBe(3);
      expect(cloned.channelName).toBe('Clock Signal');
      expect(cloned.channelColor).toBe(0x33FF57);
      expect(cloned.samples).toEqual(new Uint8Array([1, 0, 1, 0]));
      expect(cloned.samples).not.toBe(original.samples);
    });
  });
  
  describe('BurstInfo 时间格式化', () => {
    it('应该正确格式化不同单位的时间', () => {
      const burst = new BurstInfo();
      
      // 纳秒
      burst.burstTimeGap = 500;
      expect(burst.getTime()).toBe('500 ns');
      
      // 微秒
      burst.burstTimeGap = 2500; // 2.5 µs
      expect(burst.getTime()).toBe('2.500 µs');
      
      // 毫秒
      burst.burstTimeGap = 1500000; // 1.5 ms
      expect(burst.getTime()).toBe('1.500 ms');
      
      // 秒
      burst.burstTimeGap = 2500000000; // 2.5 s
      expect(burst.getTime()).toBe('2.500 s');
    });
  });
  
  describe('OutputPacket 协议处理', () => {
    it('应该正确添加和序列化数据', () => {
      const packet = new OutputPacket();
      packet.addByte(0x42);
      packet.addByte(0xFF);
      
      const serialized = packet.serialize();
      
      // 验证包含起始标记 + 数据 + 结束标记
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[2]).toBe(0x42);
      expect(serialized[3]).toBe(0xFF);
      expect(serialized[4]).toBe(0xAA);
      expect(serialized[5]).toBe(0x55);
    });
    
    it('应该正确处理协议转义', () => {
      const packet = new OutputPacket();
      packet.addByte(0xAA); // 需要转义
      packet.addByte(0x55); // 需要转义  
      packet.addByte(0xF0); // 需要转义
      packet.addByte(0x42); // 不需要转义
      
      const serialized = packet.serialize();
      
      // 验证转义结果: 0x55 0xAA [0xF0 0x5A] [0xF0 0xA5] [0xF0 0x00] 0x42 0xAA 0x55
      const expected = new Uint8Array([
        0x55, 0xAA,           // 起始标记
        0xF0, 0x5A,           // 0xAA 转义为 0xF0 + (0xAA ^ 0xF0)
        0xF0, 0xA5,           // 0x55 转义为 0xF0 + (0x55 ^ 0xF0)
        0xF0, 0x00,           // 0xF0 转义为 0xF0 + (0xF0 ^ 0xF0)
        0x42,                 // 0x42 不需要转义
        0xAA, 0x55            // 结束标记
      ]);
      
      expect(serialized).toEqual(expected);
    });
  });
  
  describe('CaptureRequestBuilder 二进制构建', () => {
    it('应该生成正确的二进制数据', () => {
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 2000;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 5;
      session.triggerInverted = true;
      session.triggerPattern = 0x1234;
      
      // 添加测试通道
      session.captureChannels.push(new AnalyzerChannel(0, 'CH0'));
      session.captureChannels.push(new AnalyzerChannel(7, 'CH7'));
      
      const binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
      
      expect(binaryData.length).toBeGreaterThan(30);
      
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      let offset = 0;
      
      expect(view.getUint8(offset++)).toBe(TriggerType.Edge);
      expect(view.getUint8(offset++)).toBe(5); // triggerChannel
      expect(view.getUint8(offset++)).toBe(1); // triggerInverted
      expect(view.getUint16(offset, true)).toBe(0x1234); // triggerPattern, little endian
      offset += 2;
      
      // 验证通道配置数组 (24字节)
      const channelConfig = new Uint8Array(binaryData.buffer, binaryData.byteOffset + offset, 24);
      expect(channelConfig[0]).toBe(1); // CH0启用
      expect(channelConfig[7]).toBe(1); // CH7启用
      expect(channelConfig[1]).toBe(0); // CH1未启用
      offset += 24;
      
      expect(view.getUint8(offset++)).toBe(2); // channelCount
      expect(view.getUint32(offset, true)).toBe(24000000); // frequency, little endian
    });
  });
  
  describe('错误处理和边界条件', () => {
    it('应该处理无效输入', () => {
      const session = new CaptureSession();
      session.frequency = -1000;
      session.preTriggerSamples = -10;
      
      // 应该能够处理而不崩溃
      expect(() => session.clone()).not.toThrow();
      expect(() => session.cloneSettings()).not.toThrow();
    });
    
    it('应该处理字节溢出', () => {
      const packet = new OutputPacket();
      packet.addByte(256); // 应该被截断为0
      packet.addByte(300); // 应该被截断为44 (300 & 0xFF)
      
      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0); // 256 & 0xFF = 0
      expect(serialized[3]).toBe(44); // 300 & 0xFF = 44
    });
  });
});