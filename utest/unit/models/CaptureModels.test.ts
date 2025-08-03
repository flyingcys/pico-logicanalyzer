/**
 * 数据采集模块单元测试套件
 * 测试CaptureSession、AnalyzerChannel和相关数据模型的完整功能
 */

import '../../../src/tests/setup';
import '../../../src/tests/matchers';
import { TestUtils } from '../../../src/tests/mocks';
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

describe('数据采集模块测试套件', () => {
  
  describe('CaptureSession 类测试', () => {
    let session: CaptureSession;
    
    beforeEach(() => {
      session = new CaptureSession();
    });
    
    it('应该正确初始化默认值', () => {
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
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 1000;
      session.loopCount = 2;
      
      const expectedTotal = 100 + 1000 * (2 + 1); // preTrigger + postTrigger * (loopCount + 1)
      expect(session.totalSamples).toBe(expectedTotal);
    });
    
    it('应该正确设置和获取采集参数', () => {
      session.frequency = 24000000;
      session.preTriggerSamples = 500;
      session.postTriggerSamples = 2000;
      session.loopCount = 5;
      session.measureBursts = true;
      
      expect(session.frequency).toBe(24000000);
      expect(session.preTriggerSamples).toBe(500);
      expect(session.postTriggerSamples).toBe(2000);
      expect(session.loopCount).toBe(5);
      expect(session.measureBursts).toBe(true);
    });
    
    it('应该正确设置触发参数', () => {
      session.triggerType = TriggerType.Complex;
      session.triggerChannel = 7;
      session.triggerInverted = true;
      session.triggerBitCount = 8;
      session.triggerPattern = 0xABCD;
      
      expect(session.triggerType).toBe(TriggerType.Complex);
      expect(session.triggerChannel).toBe(7);
      expect(session.triggerInverted).toBe(true);
      expect(session.triggerBitCount).toBe(8);
      expect(session.triggerPattern).toBe(0xABCD);
    });
    
    it('应该正确管理通道配置', () => {
      const channel1 = new AnalyzerChannel(0, 'Channel 1');
      const channel2 = new AnalyzerChannel(1, 'Channel 2');
      
      session.captureChannels.push(channel1, channel2);
      
      expect(session.captureChannels).toHaveLength(2);
      expect(session.captureChannels[0]).toBe(channel1);
      expect(session.captureChannels[1]).toBe(channel2);
    });
    
    it('clone方法应该进行完整的深拷贝', () => {
      // 设置复杂的会话配置
      session.frequency = 48000000;
      session.preTriggerSamples = 200;
      session.postTriggerSamples = 1500;
      session.loopCount = 3;
      session.measureBursts = true;
      session.triggerType = TriggerType.Complex;
      session.triggerChannel = 5;
      session.triggerInverted = true;
      session.triggerPattern = 0x1234;
      
      // 添加通道和样本数据
      const channel1 = new AnalyzerChannel(0, 'Test Channel 1');
      channel1.samples = new Uint8Array([1, 0, 1, 1, 0]);
      const channel2 = new AnalyzerChannel(1, 'Test Channel 2');
      channel2.samples = new Uint8Array([0, 1, 0, 1, 1]);
      
      session.captureChannels.push(channel1, channel2);
      
      // 添加突发信息
      session.bursts = [
        { burstSampleStart: 100, burstSampleEnd: 200, burstSampleGap: 50, burstTimeGap: 1000000 }
      ];
      
      const cloned = session.clone();
      
      // 验证基础属性被正确复制
      expect(cloned.frequency).toBe(session.frequency);
      expect(cloned.preTriggerSamples).toBe(session.preTriggerSamples);
      expect(cloned.postTriggerSamples).toBe(session.postTriggerSamples);
      expect(cloned.loopCount).toBe(session.loopCount);
      expect(cloned.measureBursts).toBe(session.measureBursts);
      expect(cloned.triggerType).toBe(session.triggerType);
      expect(cloned.triggerChannel).toBe(session.triggerChannel);
      expect(cloned.triggerInverted).toBe(session.triggerInverted);
      expect(cloned.triggerPattern).toBe(session.triggerPattern);
      
      // 验证通道数据被正确深拷贝
      expect(cloned.captureChannels).toHaveLength(2);
      expect(cloned.captureChannels[0]).not.toBe(session.captureChannels[0]); // 不同的对象引用
      expect(cloned.captureChannels[0].channelName).toBe('Test Channel 1');
      expect(cloned.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
      expect(cloned.captureChannels[0].samples).not.toBe(session.captureChannels[0].samples); // 不同的样本数组引用
      
      // 验证突发信息被正确深拷贝
      expect(cloned.bursts).toBeDefined();
      expect(cloned.bursts!).toHaveLength(1);
      expect(cloned.bursts![0]).not.toBe(session.bursts![0]); // 不同的对象引用
      expect(cloned.bursts![0].burstSampleStart).toBe(100);
      
      // 验证修改克隆对象不会影响原对象
      cloned.frequency = 12000000;
      cloned.captureChannels[0].channelName = 'Modified Channel';
      expect(session.frequency).toBe(48000000);
      expect(session.captureChannels[0].channelName).toBe('Test Channel 1');
    });
    
    it('cloneSettings方法应该只复制设置不包含样本数据', () => {
      // 设置会话配置和数据
      session.frequency = 24000000;
      session.preTriggerSamples = 100;
      session.triggerType = TriggerType.Edge;
      
      const channel = new AnalyzerChannel(0, 'Data Channel');
      channel.samples = new Uint8Array([1, 0, 1, 0, 1, 1, 0]);
      session.captureChannels.push(channel);
      
      const settingsClone = session.cloneSettings();
      
      // 验证设置被正确复制
      expect(settingsClone.frequency).toBe(24000000);
      expect(settingsClone.preTriggerSamples).toBe(100);
      expect(settingsClone.triggerType).toBe(TriggerType.Edge);
      expect(settingsClone.captureChannels).toHaveLength(1);
      expect(settingsClone.captureChannels[0].channelName).toBe('Data Channel');
      
      // 验证样本数据被清空
      expect(settingsClone.captureChannels[0].samples).toBeUndefined();
    });
    
    it('应该正确处理边界条件', () => {
      // 测试最小值
      session.frequency = 1;
      session.preTriggerSamples = 0;
      session.postTriggerSamples = 1;
      session.loopCount = 0;
      
      expect(session.totalSamples).toBe(1); // 0 + 1 * (0 + 1)
      
      // 测试最大值
      session.frequency = 100000000;
      session.preTriggerSamples = 10000;
      session.postTriggerSamples = 100000;
      session.loopCount = 255;
      
      expect(session.totalSamples).toBe(10000 + 100000 * 256);
    });
  });
  
  describe('AnalyzerChannel 类测试', () => {
    it('应该正确初始化默认值', () => {
      const channel = new AnalyzerChannel();
      
      expect(channel.channelNumber).toBe(0);
      expect(channel.channelName).toBe('Channel 1'); // textualChannelNumber
      expect(channel.channelColor).toBeUndefined();
      expect(channel.hidden).toBe(false);
      expect(channel.samples).toBeUndefined();
    });
    
    it('应该正确初始化指定参数', () => {
      const channel = new AnalyzerChannel(7, 'Custom Channel');
      
      expect(channel.channelNumber).toBe(7);
      expect(channel.channelName).toBe('Custom Channel');
      expect(channel.textualChannelNumber).toBe('Channel 8'); // channelNumber + 1
    });
    
    it('应该在没有名称时使用文本化通道号', () => {
      const channel = new AnalyzerChannel(5);
      
      expect(channel.channelName).toBe('Channel 6');
      expect(channel.textualChannelNumber).toBe('Channel 6');
    });
    
    it('toString方法应该返回正确的字符串表示', () => {
      const namedChannel = new AnalyzerChannel(0, 'SDA');
      expect(namedChannel.toString()).toBe('SDA');
      
      const unnamedChannel = new AnalyzerChannel(3);
      expect(unnamedChannel.toString()).toBe('Channel 4');
    });
    
    it('应该正确设置和获取属性', () => {
      const channel = new AnalyzerChannel();
      
      channel.channelNumber = 15;
      channel.channelName = 'UART RX';
      channel.channelColor = 0xFF5733; // 橙色
      channel.hidden = true;
      channel.samples = new Uint8Array([0, 1, 1, 0, 1]);
      
      expect(channel.channelNumber).toBe(15);
      expect(channel.channelName).toBe('UART RX');
      expect(channel.channelColor).toBe(0xFF5733);
      expect(channel.hidden).toBe(true);
      expect(channel.samples).toEqual(new Uint8Array([0, 1, 1, 0, 1]));
    });
    
    it('clone方法应该进行完整的深拷贝', () => {
      const original = new AnalyzerChannel(3, 'Clock Signal');
      original.channelColor = 0x33FF57;
      original.hidden = true;
      original.samples = new Uint8Array([1, 0, 1, 0, 1, 0]);
      
      const cloned = original.clone();
      
      // 验证所有属性被正确复制
      expect(cloned.channelNumber).toBe(3);
      expect(cloned.channelName).toBe('Clock Signal');
      expect(cloned.channelColor).toBe(0x33FF57);
      expect(cloned.hidden).toBe(true);
      expect(cloned.samples).toEqual(new Uint8Array([1, 0, 1, 0, 1, 0]));
      
      // 验证是不同的对象引用
      expect(cloned).not.toBe(original);
      expect(cloned.samples).not.toBe(original.samples);
      
      // 验证修改克隆对象不会影响原对象
      cloned.channelName = 'Modified Clock';
      cloned.samples![0] = 0;
      
      expect(original.channelName).toBe('Clock Signal');
      expect(original.samples![0]).toBe(1);
    });
    
    it('应该正确处理没有样本数据的情况', () => {
      const channel = new AnalyzerChannel(1, 'Empty Channel');
      const cloned = channel.clone();
      
      expect(cloned.samples).toBeUndefined();
      expect(cloned.channelName).toBe('Empty Channel');
    });
    
    it('应该处理大量样本数据', () => {
      const channel = new AnalyzerChannel(0, 'Large Data Channel');
      const largeSampleArray = new Uint8Array(100000);
      
      // 填充测试数据
      for (let i = 0; i < largeSampleArray.length; i++) {
        largeSampleArray[i] = i % 2;
      }
      
      channel.samples = largeSampleArray;
      
      const startTime = Date.now();
      const cloned = channel.clone();
      const cloneTime = Date.now() - startTime;
      
      expect(cloneTime).toBeWithinPerformanceBudget(100); // 100ms内完成大数据克隆
      expect(cloned.samples).toHaveLength(100000);
      expect(cloned.samples![99999]).toBe(1);
      expect(cloned.samples).not.toBe(channel.samples);
    });
  });
  
  describe('BurstInfo 类测试', () => {
    it('应该正确初始化默认值', () => {
      const burst = new BurstInfo();
      
      expect(burst.burstSampleStart).toBe(0);
      expect(burst.burstSampleEnd).toBe(0);
      expect(burst.burstSampleGap).toBe(0);
      expect(burst.burstTimeGap).toBe(0);
    });
    
    it('getTime方法应该正确格式化时间', () => {
      const burst = new BurstInfo();
      
      // 测试纳秒
      burst.burstTimeGap = 500;
      expect(burst.getTime()).toBe('500 ns');
      
      // 测试微秒
      burst.burstTimeGap = 2500; // 2.5 µs
      expect(burst.getTime()).toBe('2.500 µs');
      
      // 测试毫秒
      burst.burstTimeGap = 1500000; // 1.5 ms
      expect(burst.getTime()).toBe('1.500 ms');
      
      // 测试秒
      burst.burstTimeGap = 2500000000; // 2.5 s
      expect(burst.getTime()).toBe('2.500 s');
    });
    
    it('toString方法应该返回正确格式', () => {
      const burst = new BurstInfo();
      burst.burstSampleStart = 1000;
      burst.burstSampleEnd = 2000;
      burst.burstSampleGap = 500;
      burst.burstTimeGap = 25000; // 25 µs
      
      const expected = 'Burst: 1000 to 2000\nGap: 25.000 µs (500 samples)';
      expect(burst.toString()).toBe(expected);
    });
    
    it('应该处理边界时间值', () => {
      const burst = new BurstInfo();
      
      // 测试边界值
      burst.burstTimeGap = 999; // 刚好小于1µs
      expect(burst.getTime()).toBe('999 ns');
      
      burst.burstTimeGap = 1000; // 刚好1µs
      expect(burst.getTime()).toBe('1.000 µs');
      
      burst.burstTimeGap = 999999; // 刚好小于1ms
      expect(burst.getTime()).toBe('999.999 µs');
      
      burst.burstTimeGap = 1000000; // 刚好1ms  
      expect(burst.getTime()).toBe('1.000 ms');
    });
  });
  
  describe('CaptureLimitsImpl 类测试', () => {
    it('应该正确初始化默认限制值', () => {
      const limits = new CaptureLimitsImpl();
      
      expect(limits.minPreSamples).toBe(2);
      expect(limits.maxPreSamples).toBe(1000);
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPostSamples).toBe(10000);
    });
    
    it('应该正确计算最大总样本数', () => {
      const limits = new CaptureLimitsImpl();
      
      expect(limits.maxTotalSamples).toBe(11000); // maxPreSamples + maxPostSamples = 1000 + 10000
    });
    
    it('应该支持动态修改限制值', () => {
      const limits = new CaptureLimitsImpl();
      
      limits.minPreSamples = 5;
      limits.maxPreSamples = 2000;
      limits.minPostSamples = 10;
      limits.maxPostSamples = 50000;
      
      expect(limits.maxTotalSamples).toBe(52000); // maxPreSamples + maxPostSamples = 2000 + 50000
    });
  });
  
  describe('OutputPacket 类测试', () => {
    let packet: OutputPacket;
    
    beforeEach(() => {
      packet = new OutputPacket();
    });
    
    it('应该正确添加单个字节', () => {
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
    
    it('应该正确添加字节数组', () => {
      const testData = new Uint8Array([0x01, 0x02, 0x03]);
      packet.addBytes(testData);
      
      const serialized = packet.serialize();
      expect(serialized).toEqual(new Uint8Array([0x55, 0xAA, 0x01, 0x02, 0x03, 0xAA, 0x55]));
    });
    
    it('应该正确添加普通数组', () => {
      packet.addBytes([0x10, 0x20, 0x30]);
      
      const serialized = packet.serialize();
      expect(serialized).toEqual(new Uint8Array([0x55, 0xAA, 0x10, 0x20, 0x30, 0xAA, 0x55]));
    });
    
    it('应该正确添加ASCII字符串', () => {
      packet.addString('ABC');
      
      const serialized = packet.serialize();
      expect(serialized).toEqual(new Uint8Array([0x55, 0xAA, 0x41, 0x42, 0x43, 0xAA, 0x55]));
    });
    
    it('应该正确添加结构体数据', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, true); // little endian
      
      packet.addStruct(buffer);
      
      const serialized = packet.serialize();
      expect(serialized).toEqual(new Uint8Array([0x55, 0xAA, 0x78, 0x56, 0x34, 0x12, 0xAA, 0x55]));
    });
    
    it('应该正确处理协议转义', () => {
      // 测试需要转义的特殊字节
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
    
    it('clear方法应该清空缓冲区', () => {
      packet.addByte(0x42);
      packet.addString('test');
      
      packet.clear();
      
      const serialized = packet.serialize();
      expect(serialized).toEqual(new Uint8Array([0x55, 0xAA, 0xAA, 0x55])); // 只有起始和结束标记
    });
    
    it('应该处理空数据包', () => {
      const serialized = packet.serialize();
      expect(serialized).toEqual(new Uint8Array([0x55, 0xAA, 0xAA, 0x55]));
    });
    
    it('应该处理大数据包', () => {
      // 添加大量数据测试性能
      const largeData = new Uint8Array(10000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      
      const startTime = Date.now();
      packet.addBytes(largeData);
      const serialized = packet.serialize();
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeWithinPerformanceBudget(50); // 50ms内完成
      expect(serialized.length).toBeGreaterThan(10000); // 包含转义字节后会更长
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[serialized.length - 2]).toBe(0xAA);
      expect(serialized[serialized.length - 1]).toBe(0x55);
    });
  });
  
  describe('CaptureRequestBuilder 类测试', () => {
    it('buildCaptureRequest应该生成正确的二进制数据', () => {
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 2000;
      session.loopCount = 2;
      session.measureBursts = true;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 5;
      session.triggerInverted = true;
      session.triggerPattern = 0x1234;
      
      // 添加测试通道
      session.captureChannels.push(new AnalyzerChannel(0, 'CH0'));
      session.captureChannels.push(new AnalyzerChannel(7, 'CH7'));
      session.captureChannels.push(new AnalyzerChannel(15, 'CH15'));
      
      const binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
      
      // 验证二进制数据结构
      expect(binaryData.length).toBeGreaterThan(30); // 至少包含所有必需字段
      
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      let offset = 0;
      
      expect(view.getUint8(offset++)).toBe(TriggerType.Edge); // triggerType
      expect(view.getUint8(offset++)).toBe(5); // triggerChannel
      expect(view.getUint8(offset++)).toBe(1); // triggerInverted
      expect(view.getUint16(offset, true)).toBe(0x1234); // triggerPattern, little endian
      offset += 2;
      
      // 验证通道配置数组 (24字节)
      const channelConfig = new Uint8Array(binaryData.buffer, binaryData.byteOffset + offset, 24);
      expect(channelConfig[0]).toBe(1); // CH0启用
      expect(channelConfig[7]).toBe(1); // CH7启用
      expect(channelConfig[15]).toBe(1); // CH15启用
      expect(channelConfig[1]).toBe(0); // CH1未启用
      offset += 24;
      
      expect(view.getUint8(offset++)).toBe(3); // channelCount
      expect(view.getUint32(offset, true)).toBe(24000000); // frequency, little endian
      offset += 4;
      expect(view.getUint32(offset, true)).toBe(100); // preSamples, little endian
      offset += 4;
      expect(view.getUint32(offset, true)).toBe(2000); // postSamples, little endian
      offset += 4;
      expect(view.getUint8(offset++)).toBe(2); // loopCount
      expect(view.getUint8(offset++)).toBe(1); // measure (measureBursts = true)
      
      // 验证采集模式 (最大通道号15，应该选择16通道模式)
      expect(view.getUint8(offset++)).toBe(CaptureMode.Channels_16);
    });
    
    it('buildCaptureRequest应该正确计算采集模式', () => {
      const session = new CaptureSession();
      
      // 测试8通道模式
      session.captureChannels = [
        new AnalyzerChannel(0), new AnalyzerChannel(3), new AnalyzerChannel(7)
      ];
      let binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
      let view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      expect(view.getUint8(binaryData.length - 1)).toBe(CaptureMode.Channels_8);
      
      // 测试16通道模式
      session.captureChannels = [
        new AnalyzerChannel(0), new AnalyzerChannel(8), new AnalyzerChannel(15)
      ];
      binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
      view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      expect(view.getUint8(binaryData.length - 1)).toBe(CaptureMode.Channels_16);
      
      // 测试24通道模式
      session.captureChannels = [
        new AnalyzerChannel(0), new AnalyzerChannel(16), new AnalyzerChannel(23)
      ];
      binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
      view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      expect(view.getUint8(binaryData.length - 1)).toBe(CaptureMode.Channels_24);
    });
    
    it('buildNetConfig应该生成正确的网络配置数据', () => {
      const netConfig = {
        accessPointName: 'TestWiFi',
        password: 'password123',
        ipAddress: '192.168.1.100',
        port: 3333
      };
      
      const binaryData = CaptureRequestBuilder.buildNetConfig(netConfig);
      
      expect(binaryData.length).toBe(115); // 33 + 64 + 16 + 2
      
      const view = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);
      
      // 验证访问点名称 (33字节)
      const apNameBytes = new Uint8Array(binaryData.buffer, binaryData.byteOffset, 33);
      const apName = new TextDecoder().decode(apNameBytes.slice(0, apNameBytes.indexOf(0)));
      expect(apName).toBe('TestWiFi');
      
      // 验证密码 (64字节)
      const passwordBytes = new Uint8Array(binaryData.buffer, binaryData.byteOffset + 33, 64);
      const password = new TextDecoder().decode(passwordBytes.slice(0, passwordBytes.indexOf(0)));
      expect(password).toBe('password123');
      
      // 验证IP地址 (16字节)
      const ipBytes = new Uint8Array(binaryData.buffer, binaryData.byteOffset + 97, 16);
      const ip = new TextDecoder().decode(ipBytes.slice(0, ipBytes.indexOf(0)));
      expect(ip).toBe('192.168.1.100');
      
      // 验证端口 (2字节, little endian)
      const port = view.getUint16(113, true); // 33 + 64 + 16 = 113
      expect(port).toBe(3333);
    });
    
    it('应该处理超长字符串的截断', () => {
      const longConfig = {
        accessPointName: 'A'.repeat(50), // 超过33字节限制
        password: 'B'.repeat(100), // 超过64字节限制
        ipAddress: 'C'.repeat(20), // 超过16字节限制
        port: 8080
      };
      
      const binaryData = CaptureRequestBuilder.buildNetConfig(longConfig);
      
      // 验证数据长度仍然正确
      expect(binaryData.length).toBe(115);
      
      // 验证字符串被正确截断
      const apNameBytes = new Uint8Array(binaryData.buffer, binaryData.byteOffset, 33);
      const apName = new TextDecoder().decode(apNameBytes.slice(0, 32)); // 最后一个字节是0
      expect(apName).toBe('A'.repeat(32));
    });
  });
  
  describe('CaptureEventArgs 类测试', () => {
    it('应该正确初始化事件参数', () => {
      const session = new CaptureSession();
      session.frequency = 12000000;
      
      const successArgs = new CaptureEventArgs(true, session);
      expect(successArgs.success).toBe(true);
      expect(successArgs.session).toBe(session);
      
      const failureArgs = new CaptureEventArgs(false, session);
      expect(failureArgs.success).toBe(false);
      expect(failureArgs.session).toBe(session);
    });
    
    it('应该保持对会话对象的引用', () => {
      const session = new CaptureSession();
      session.preTriggerSamples = 200;
      
      const args = new CaptureEventArgs(true, session);
      
      // 修改原会话应该反映在事件参数中
      session.preTriggerSamples = 300;
      expect(args.session.preTriggerSamples).toBe(300);
    });
  });
  
  describe('性能和内存测试', () => {
    it('大型会话克隆不应导致内存泄漏', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 50; i++) {
        const session = new CaptureSession();
        session.frequency = 48000000;
        
        // 创建多个大通道
        for (let ch = 0; ch < 24; ch++) {
          const channel = new AnalyzerChannel(ch, `Channel ${ch}`);
          channel.samples = new Uint8Array(10000); // 10K样本
          session.captureChannels.push(channel);
        }
        
        const cloned = session.clone();
        
        // 确保克隆操作正确
        expect(cloned.captureChannels).toHaveLength(24);
        expect(cloned.captureChannels[0].samples).toHaveLength(10000);
        
        // 偶尔触发垃圾收集
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      expect({ memoryGrowth, leakDetected: memoryGrowth > 100 * 1024 * 1024 })
        .toHaveMemoryLeakBelow(100 * 1024 * 1024); // 100MB阈值
    });
    
    it('协议序列化性能应该满足要求', () => {
      const packet = new OutputPacket();
      
      // 创建包含转义字符的大数据包
      const testData = new Uint8Array(50000);
      for (let i = 0; i < testData.length; i++) {
        // 包含一些需要转义的字节
        testData[i] = i % 4 === 0 ? 0xAA : (i % 4 === 1 ? 0x55 : (i % 4 === 2 ? 0xF0 : i % 256));
      }
      
      packet.addBytes(testData);
      
      const startTime = performance.now();
      const serialized = packet.serialize();
      const serializationTime = performance.now() - startTime;
      
      expect(serializationTime).toBeWithinPerformanceBudget(100); // 100ms内完成
      expect(serialized.length).toBeGreaterThan(testData.length); // 转义后更长
      
      // 验证协议正确性
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[serialized.length - 2]).toBe(0xAA);
      expect(serialized[serialized.length - 1]).toBe(0x55);
    });
  });
  
  describe('边界条件和错误处理', () => {
    it('CaptureSession应该处理无效输入', () => {
      const session = new CaptureSession();
      
      // 测试负值处理
      session.frequency = -1000;
      session.preTriggerSamples = -10;
      session.postTriggerSamples = -20;
      
      // 应该能够处理而不崩溃
      expect(() => session.clone()).not.toThrow();
      expect(() => session.cloneSettings()).not.toThrow();
    });
    
    it('AnalyzerChannel应该处理边界通道号', () => {
      const minChannel = new AnalyzerChannel(-1);
      expect(minChannel.textualChannelNumber).toBe('Channel 0'); // -1 + 1
      
      const maxChannel = new AnalyzerChannel(255);
      expect(maxChannel.textualChannelNumber).toBe('Channel 256');
    });
    
    it('OutputPacket应该处理字节溢出', () => {
      const packet = new OutputPacket();
      
      // 添加超过字节范围的值
      packet.addByte(256); // 应该被截断为0
      packet.addByte(300); // 应该被截断为44 (300 & 0xFF)
      
      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0); // 256 & 0xFF = 0
      expect(serialized[3]).toBe(44); // 300 & 0xFF = 44
    });
    
    it('CaptureRequestBuilder应该处理无效通道配置', () => {
      const session = new CaptureSession();
      
      // 添加超出范围的通道
      session.captureChannels.push(new AnalyzerChannel(-5));
      session.captureChannels.push(new AnalyzerChannel(30));
      session.captureChannels.push(new AnalyzerChannel(0)); // 有效通道
      
      expect(() => {
        const binaryData = CaptureRequestBuilder.buildCaptureRequest(session);
        expect(binaryData).toBeDefined();
      }).not.toThrow();
    });
  });
});