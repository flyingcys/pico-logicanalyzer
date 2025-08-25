/**
 * CaptureModels 核心功能测试
 * 
 * 遵循新的测试质量标准:
 * - 文件大小 < 200行
 * - Mock数量 < 5个
 * - 测试真实功能而非Mock行为
 * - 专注核心数据流：配置→验证→计算
 */

import { 
  CaptureSession, 
  AnalyzerChannel, 
  BurstInfo, 
  OutputPacket, 
  CaptureRequestBuilder 
} from '../../../src/models/CaptureModels';
import { TriggerType, CaptureMode } from '../../../src/models/AnalyzerTypes';

describe('CaptureModels 核心功能测试', () => {

  describe('CaptureSession 基础功能', () => {
    let session: CaptureSession;

    beforeEach(() => {
      session = new CaptureSession();
      session.frequency = 1000000; // 1MHz
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 1000;
      session.loopCount = 0;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 0;
    });

    it('应该正确计算总样本数', () => {
      expect(session.totalSamples).toBe(1100); // 100 + 1000 * (0 + 1)
    });

    it('应该正确处理突发采集的总样本数', () => {
      session.loopCount = 3; // 4次突发
      expect(session.totalSamples).toBe(4100); // 100 + 1000 * (3 + 1)
    });

    it('应该能够克隆会话（包含数据）', () => {
      // 添加测试通道
      const channel = new AnalyzerChannel(0, 'Test Channel');
      channel.samples = new Uint8Array([1, 2, 3, 4]);
      session.captureChannels = [channel];

      const cloned = session.clone();
      
      expect(cloned.frequency).toBe(session.frequency);
      expect(cloned.preTriggerSamples).toBe(session.preTriggerSamples);
      expect(cloned.captureChannels.length).toBe(1);
      expect(cloned.captureChannels[0].samples).toEqual(new Uint8Array([1, 2, 3, 4]));
      
      // 验证深拷贝
      expect(cloned.captureChannels[0]).not.toBe(session.captureChannels[0]);
    });

    it('应该能够只克隆设置（不包含数据）', () => {
      // 添加有数据的测试通道
      const channel = new AnalyzerChannel(0, 'Test Channel');
      channel.samples = new Uint8Array([1, 2, 3, 4]);
      session.captureChannels = [channel];

      const cloned = session.cloneSettings();
      
      expect(cloned.frequency).toBe(session.frequency);
      expect(cloned.captureChannels.length).toBe(1);
      expect(cloned.captureChannels[0].samples).toBeUndefined();
    });

    it('应该处理突发信息的深拷贝', () => {
      const burst = new BurstInfo();
      burst.burstSampleStart = 100;
      burst.burstSampleEnd = 200;
      burst.burstTimeGap = 1000000; // 1ms in nanoseconds
      
      session.bursts = [burst];
      
      const cloned = session.clone();
      expect(cloned.bursts).toBeDefined();
      expect(cloned.bursts!.length).toBe(1);
      expect(cloned.bursts![0].burstTimeGap).toBe(1000000);
      
      // 验证深拷贝
      expect(cloned.bursts![0]).not.toBe(session.bursts![0]);
    });
  });

  describe('AnalyzerChannel 基础功能', () => {
    it('应该正确生成文本化通道号', () => {
      const channel = new AnalyzerChannel(0);
      expect(channel.textualChannelNumber).toBe('Channel 1');
      
      const channel5 = new AnalyzerChannel(5);
      expect(channel5.textualChannelNumber).toBe('Channel 6');
    });

    it('应该使用提供的通道名称', () => {
      const channel = new AnalyzerChannel(0, 'SPI_CLK');
      expect(channel.channelName).toBe('SPI_CLK');
      expect(channel.toString()).toBe('SPI_CLK');
    });

    it('应该回退到默认通道名称', () => {
      const channel = new AnalyzerChannel(3);
      expect(channel.toString()).toBe('Channel 4');
    });

    it('应该能够克隆通道（包含样本数据）', () => {
      const original = new AnalyzerChannel(2, 'Data Channel');
      original.channelColor = 0xFF0000;
      original.hidden = true;
      original.samples = new Uint8Array([0xAA, 0x55, 0xFF]);

      const cloned = original.clone();
      
      expect(cloned.channelNumber).toBe(original.channelNumber);
      expect(cloned.channelName).toBe(original.channelName);
      expect(cloned.channelColor).toBe(original.channelColor);
      expect(cloned.hidden).toBe(original.hidden);
      expect(cloned.samples).toEqual(original.samples);
      
      // 验证深拷贝
      expect(cloned.samples).not.toBe(original.samples);
    });
  });

  describe('BurstInfo 时间格式化', () => {
    it('应该正确格式化纳秒', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 500; // 500ns
      expect(burst.getTime()).toBe('500 ns');
    });

    it('应该正确格式化微秒', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 2500; // 2.5µs
      expect(burst.getTime()).toBe('2.500 µs');
    });

    it('应该正确格式化毫秒', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500000; // 1.5ms
      expect(burst.getTime()).toBe('1.500 ms');
    });

    it('应该正确格式化秒', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 2000000000; // 2s
      expect(burst.getTime()).toBe('2.000 s');
    });
  });

  describe('OutputPacket 协议处理', () => {
    let packet: OutputPacket;

    beforeEach(() => {
      packet = new OutputPacket();
    });

    it('应该能够添加字节数据', () => {
      packet.addByte(0xAA);
      packet.addByte(0x55);
      
      const serialized = packet.serialize();
      
      // 协议格式: 0x55 0xAA [数据] 0xAA 0x55
      expect(serialized[0]).toBe(0x55); // 起始标记
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[serialized.length-2]).toBe(0xAA); // 结束标记
      expect(serialized[serialized.length-1]).toBe(0x55);
    });

    it('应该正确处理转义字符', () => {
      // 添加需要转义的字节
      packet.addByte(0xAA); // 需要转义
      packet.addByte(0x55); // 需要转义
      packet.addByte(0xF0); // 需要转义
      packet.addByte(0x12); // 不需要转义
      
      const serialized = packet.serialize();
      
      // 验证转义处理: 转义字符应该变成 0xF0 + (原值 ^ 0xF0)
      expect(serialized.includes(0xF0)).toBe(true); // 应该包含转义标记
      expect(serialized.length).toBeGreaterThan(8); // 原始4字节+转义+头尾标记
    });

    it('应该能够添加字符串', () => {
      packet.addString('TEST');
      const serialized = packet.serialize();
      
      // 应该包含字符串的ASCII值加上协议头尾
      expect(serialized.length).toBeGreaterThan(6); // 4字符 + 4字节协议头尾
    });

    it('应该能够清空数据', () => {
      packet.addByte(0xAA);
      packet.clear();
      
      const serialized = packet.serialize();
      
      // 清空后只应该有协议头尾
      expect(serialized.length).toBe(4); // 0x55 0xAA 0xAA 0x55
    });
  });

  describe('CaptureRequestBuilder 请求构建', () => {
    let session: CaptureSession;

    beforeEach(() => {
      session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 1000;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 2;
      session.triggerInverted = false;
      session.triggerPattern = 0x1234;
      session.loopCount = 1;
      session.measureBursts = true;
      
      // 添加测试通道
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1'),
        new AnalyzerChannel(7, 'CH7')
      ];
    });

    it('应该构建正确的二进制请求', () => {
      const requestData = CaptureRequestBuilder.buildCaptureRequest(session);
      
      expect(requestData.length).toBeGreaterThan(30); // 应该有足够的数据
      
      // 验证基本字段（使用DataView读取验证）
      const view = new DataView(requestData.buffer);
      expect(view.getUint8(0)).toBe(TriggerType.Edge); // triggerType
      expect(view.getUint8(1)).toBe(2); // triggerChannel
      expect(view.getUint16(3, true)).toBe(0x1234); // triggerPattern
    });

    it('应该正确设置通道配置', () => {
      const requestData = CaptureRequestBuilder.buildCaptureRequest(session);
      const view = new DataView(requestData.buffer);
      
      // 通道数组从偏移5开始，长度24字节
      const channelArray = new Uint8Array(requestData.buffer, 5, 24);
      
      expect(channelArray[0]).toBe(1); // 通道0启用
      expect(channelArray[1]).toBe(1); // 通道1启用
      expect(channelArray[7]).toBe(1); // 通道7启用
      expect(channelArray[2]).toBe(0); // 通道2未启用
    });

    it('应该正确计算采集模式', () => {
      // 测试8通道模式
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(7, 'CH7') // 最高通道7 -> 8通道模式
      ];
      
      const requestData = CaptureRequestBuilder.buildCaptureRequest(session);
      const view = new DataView(requestData.buffer);
      
      // captureMode在最后一个字节
      const captureMode = view.getUint8(requestData.length - 1);
      expect(captureMode).toBe(CaptureMode.Channels_8);
    });
  });
});