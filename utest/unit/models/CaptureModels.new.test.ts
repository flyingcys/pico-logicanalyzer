/**
 * CaptureModels 模块独立单元测试
 * 深度测试所有类的实际实现代码，获得真实的覆盖率
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

describe('CaptureModels 模块实际代码覆盖率测试', () => {

  describe('CaptureSession 类', () => {
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
      expect(session.triggerType).toBe(TriggerType.Edge);
      expect(session.triggerChannel).toBe(0);
      expect(session.triggerInverted).toBe(false);
      expect(session.triggerBitCount).toBe(1);
      expect(session.triggerPattern).toBe(0);
      expect(session.captureChannels).toEqual([]);
    });

    it('应该正确计算totalSamples', () => {
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 500;
      session.loopCount = 2;
      
      // totalSamples = postTriggerSamples * (loopCount + 1) + preTriggerSamples
      // = 500 * (2 + 1) + 100 = 1500 + 100 = 1600
      expect(session.totalSamples).toBe(1600);
    });

    it('应该正确执行深拷贝clone()', () => {
      // 设置原始数据
      session.frequency = 2000000;
      session.preTriggerSamples = 200;
      session.postTriggerSamples = 800;
      session.triggerType = TriggerType.Complex;
      session.triggerChannel = 5;
      session.triggerInverted = true;
      
      const channel1 = new AnalyzerChannel(0, 'CH0');
      channel1.samples = new Uint8Array([1, 0, 1, 0]);
      const channel2 = new AnalyzerChannel(1, 'CH1');
      channel2.samples = new Uint8Array([0, 1, 0, 1]);
      session.captureChannels = [channel1, channel2];
      
      // 添加burst数据
      session.bursts = [
        { burstSampleStart: 0, burstSampleEnd: 100, burstSampleGap: 50, burstTimeGap: 1000 }
      ];

      // 执行克隆
      const cloned = session.clone();

      // 验证深拷贝
      expect(cloned).not.toBe(session);
      expect(cloned.frequency).toBe(2000000);
      expect(cloned.preTriggerSamples).toBe(200);
      expect(cloned.postTriggerSamples).toBe(800);
      expect(cloned.triggerType).toBe(TriggerType.Complex);
      expect(cloned.triggerChannel).toBe(5);
      expect(cloned.triggerInverted).toBe(true);
      
      // 验证通道深拷贝
      expect(cloned.captureChannels).toHaveLength(2);
      expect(cloned.captureChannels[0]).not.toBe(session.captureChannels[0]);
      expect(cloned.captureChannels[0].channelNumber).toBe(0);
      expect(cloned.captureChannels[0].channelName).toBe('CH0');
      expect(cloned.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 0]));
      expect(cloned.captureChannels[0].samples).not.toBe(session.captureChannels[0].samples);
      
      // 验证burst深拷贝
      expect(cloned.bursts).toHaveLength(1);
      expect(cloned.bursts![0]).not.toBe(session.bursts![0]);
      expect(cloned.bursts![0].burstSampleStart).toBe(0);
    });

    it('应该正确执行设置拷贝cloneSettings()', () => {
      // 设置原始数据
      session.frequency = 3000000;
      session.loopCount = 3;
      
      const channel = new AnalyzerChannel(0, 'CH0');
      channel.samples = new Uint8Array([1, 1, 1, 1]);
      session.captureChannels = [channel];

      // 执行设置克隆
      const cloned = session.cloneSettings();

      // 验证基础设置拷贝
      expect(cloned.frequency).toBe(3000000);
      expect(cloned.loopCount).toBe(3);
      
      // 验证通道设置拷贝但样本数据被清空
      expect(cloned.captureChannels).toHaveLength(1);
      expect(cloned.captureChannels[0].channelNumber).toBe(0);
      expect(cloned.captureChannels[0].channelName).toBe('CH0');
      expect(cloned.captureChannels[0].samples).toBeUndefined();
    });
  });

  describe('AnalyzerChannel 类', () => {
    
    it('应该正确初始化默认值', () => {
      const channel = new AnalyzerChannel();
      expect(channel.channelNumber).toBe(0);
      expect(channel.channelName).toBe('Channel 1'); // 默认使用textualChannelNumber
      expect(channel.hidden).toBe(false);
      expect(channel.samples).toBeUndefined();
    });

    it('应该正确初始化指定值', () => {
      const channel = new AnalyzerChannel(5, 'Custom Channel');
      expect(channel.channelNumber).toBe(5);
      expect(channel.channelName).toBe('Custom Channel');
    });

    it('应该正确生成textualChannelNumber', () => {
      const channel = new AnalyzerChannel(0);
      expect(channel.textualChannelNumber).toBe('Channel 1');
      
      const channel2 = new AnalyzerChannel(15);
      expect(channel2.textualChannelNumber).toBe('Channel 16');
    });

    it('应该正确实现toString方法', () => {
      const channel1 = new AnalyzerChannel(0, 'SDA');
      expect(channel1.toString()).toBe('SDA');
      
      const channel2 = new AnalyzerChannel(3, '');
      expect(channel2.toString()).toBe('Channel 4');
    });

    it('应该正确执行clone方法', () => {
      const original = new AnalyzerChannel(7, 'Test Channel');
      original.channelColor = 0xFF0000;
      original.hidden = true;
      original.samples = new Uint8Array([1, 0, 1, 0, 1]);

      const cloned = original.clone();

      // 验证深拷贝
      expect(cloned).not.toBe(original);
      expect(cloned.channelNumber).toBe(7);
      expect(cloned.channelName).toBe('Test Channel');
      expect(cloned.channelColor).toBe(0xFF0000);
      expect(cloned.hidden).toBe(true);
      expect(cloned.samples).toEqual(new Uint8Array([1, 0, 1, 0, 1]));
      expect(cloned.samples).not.toBe(original.samples);
    });

    it('应该正确处理没有samples的clone', () => {
      const original = new AnalyzerChannel(2, 'No Samples');
      const cloned = original.clone();
      
      expect(cloned.samples).toBeUndefined();
    });
  });

  describe('BurstInfo 类', () => {
    
    it('应该正确初始化默认值', () => {
      const burst = new BurstInfo();
      expect(burst.burstSampleStart).toBe(0);
      expect(burst.burstSampleEnd).toBe(0);
      expect(burst.burstSampleGap).toBe(0);
      expect(burst.burstTimeGap).toBe(0);
    });

    it('应该正确格式化纳秒时间', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 500; // 500纳秒
      expect(burst.getTime()).toBe('500 ns');
    });

    it('应该正确格式化微秒时间', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500; // 1.5微秒
      expect(burst.getTime()).toBe('1.500 µs');
    });

    it('应该正确格式化毫秒时间', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 2500000; // 2.5毫秒
      expect(burst.getTime()).toBe('2.500 ms');
    });

    it('应该正确格式化秒时间', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500000000; // 1.5秒
      expect(burst.getTime()).toBe('1.500 s');
    });

    it('应该正确实现toString方法', () => {
      const burst = new BurstInfo();
      burst.burstSampleStart = 100;
      burst.burstSampleEnd = 200;
      burst.burstSampleGap = 50;
      burst.burstTimeGap = 1000;
      
      const result = burst.toString();
      expect(result).toBe('Burst: 100 to 200\nGap: 1.000 µs (50 samples)');
    });
  });

  describe('CaptureLimitsImpl 类', () => {
    
    it('应该正确初始化默认值', () => {
      const limits = new CaptureLimitsImpl();
      expect(limits.minPreSamples).toBe(2);
      expect(limits.maxPreSamples).toBe(1000);
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPostSamples).toBe(10000);
    });

    it('应该正确计算maxTotalSamples', () => {
      const limits = new CaptureLimitsImpl();
      expect(limits.maxTotalSamples).toBe(11000); // 1000 + 10000
      
      // 修改值后重新测试
      limits.maxPreSamples = 500;
      limits.maxPostSamples = 5000;
      expect(limits.maxTotalSamples).toBe(5500);
    });
  });

  describe('OutputPacket 类', () => {
    let packet: OutputPacket;

    beforeEach(() => {
      packet = new OutputPacket();
    });

    it('应该正确添加单个字节', () => {
      packet.addByte(0x42);
      const result = packet.serialize();
      
      // 期望: [0x55, 0xAA, 0x42, 0xAA, 0x55]
      expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x42, 0xAA, 0x55]));
    });

    it('应该正确处理需要转义的字节', () => {
      packet.addByte(0xAA);
      packet.addByte(0x55);
      packet.addByte(0xF0);
      const result = packet.serialize();
      
      // 期望: [0x55, 0xAA, 0xF0, 0x5A, 0xF0, 0xA5, 0xF0, 0x00, 0xAA, 0x55]
      // 0xAA -> 0xF0, 0x5A (0xAA ^ 0xF0 = 0x5A)
      // 0x55 -> 0xF0, 0xA5 (0x55 ^ 0xF0 = 0xA5)
      // 0xF0 -> 0xF0, 0x00 (0xF0 ^ 0xF0 = 0x00)
      expect(result).toEqual(new Uint8Array([
        0x55, 0xAA,           // 起始标记
        0xF0, 0x5A,           // 转义的0xAA
        0xF0, 0xA5,           // 转义的0x55
        0xF0, 0x00,           // 转义的0xF0
        0xAA, 0x55            // 结束标记
      ]));
    });

    it('应该正确添加字节数组', () => {
      const testArray = new Uint8Array([0x01, 0x02, 0x03]);
      packet.addBytes(testArray);
      const result = packet.serialize();
      
      expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x01, 0x02, 0x03, 0xAA, 0x55]));
    });

    it('应该正确添加普通数组', () => {
      packet.addBytes([0x10, 0x20, 0x30]);
      const result = packet.serialize();
      
      expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x10, 0x20, 0x30, 0xAA, 0x55]));
    });

    it('应该正确添加字符串', () => {
      packet.addString('ABC');
      const result = packet.serialize();
      
      // ASCII: A=0x41, B=0x42, C=0x43
      expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x41, 0x42, 0x43, 0xAA, 0x55]));
    });

    it('应该正确添加结构体数据', () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, 0x12345678, true); // little endian
      
      packet.addStruct(buffer);
      const result = packet.serialize();
      
      expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x78, 0x56, 0x34, 0x12, 0xAA, 0x55]));
    });

    it('应该正确清空缓冲区', () => {
      packet.addByte(0x42);
      packet.clear();
      const result = packet.serialize();
      
      // 清空后应该只有起始和结束标记
      expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xAA, 0x55]));
    });
  });

  describe('CaptureRequestBuilder 类', () => {
    
    it('应该正确构建采集请求', () => {
      const session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 900;
      session.triggerType = TriggerType.Edge;
      session.triggerChannel = 2;
      session.triggerInverted = true;
      session.triggerPattern = 0x1234;
      session.loopCount = 5;
      session.measureBursts = true;
      
      // 添加通道
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1'),
        new AnalyzerChannel(5, 'CH5')
      ];

      const result = CaptureRequestBuilder.buildCaptureRequest(session);
      
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(40); // 至少应该有40字节
      
      // 验证部分关键字段
      expect(result[0]).toBe(TriggerType.Edge); // triggerType
      expect(result[1]).toBe(2); // triggerChannel
      expect(result[2]).toBe(1); // triggerInverted
    });

    it('应该正确构建网络配置', () => {
      const config = {
        accessPointName: 'TestAP',
        password: 'password123',
        ipAddress: '192.168.1.100',
        port: 8080
      };

      const result = CaptureRequestBuilder.buildNetConfig(config);
      
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(115); // 33 + 64 + 16 + 2
      
      // 验证端口字段（最后2字节）
      const portBytes = new DataView(result.buffer, result.byteOffset + 113, 2);
      expect(portBytes.getUint16(0, true)).toBe(8080);
    });

    it('应该正确处理长字符串截断', () => {
      const config = {
        accessPointName: 'A'.repeat(50), // 超过32字符限制
        password: 'B'.repeat(100),        // 超过63字符限制
        ipAddress: 'C'.repeat(30),        // 超过15字符限制
        port: 9000
      };

      const result = CaptureRequestBuilder.buildNetConfig(config);
      expect(result.length).toBe(115);
      
      // 验证截断处理
      expect(result[32]).toBe(0); // accessPointName应该在第32位被截断并补0
      expect(result[96]).toBe(0); // password应该在第63位被截断并补0
      expect(result[112]).toBe(0); // ipAddress应该在第15位被截断并补0
    });
  });

  describe('CaptureEventArgs 类', () => {
    
    it('应该正确初始化', () => {
      const session = new CaptureSession();
      const args = new CaptureEventArgs(true, session);
      
      expect(args.success).toBe(true);
      expect(args.session).toBe(session);
    });

    it('应该支持失败状态', () => {
      const session = new CaptureSession();
      const args = new CaptureEventArgs(false, session);
      
      expect(args.success).toBe(false);
      expect(args.session).toBe(session);
    });
  });

  describe('集成测试', () => {
    
    it('应该支持完整的数据流处理', () => {
      // 创建会话
      const session = new CaptureSession();
      session.frequency = 2000000;
      session.preTriggerSamples = 50;
      session.postTriggerSamples = 950;
      session.triggerType = TriggerType.Complex;
      
      // 添加通道数据
      const ch0 = new AnalyzerChannel(0, 'SDA');
      ch0.samples = new Uint8Array([1, 0, 1, 0, 1]);
      const ch1 = new AnalyzerChannel(1, 'SCL');
      ch1.samples = new Uint8Array([0, 1, 0, 1, 0]);
      session.captureChannels = [ch0, ch1];
      
      // 添加burst信息
      session.bursts = [
        { burstSampleStart: 0, burstSampleEnd: 100, burstSampleGap: 50, burstTimeGap: 25000 }
      ];
      
      // 克隆并验证
      const cloned = session.clone();
      expect(cloned.captureChannels).toHaveLength(2);
      expect(cloned.captureChannels[0].samples).toEqual(ch0.samples);
      expect(cloned.bursts).toHaveLength(1);
      expect(cloned.bursts![0].getTime()).toBe('25.000 µs');
      
      // 构建请求数据
      const requestData = CaptureRequestBuilder.buildCaptureRequest(session);
      expect(requestData.length).toBeGreaterThan(0);
      
      // 创建输出包
      const packet = new OutputPacket();
      packet.addStruct(requestData);
      const serialized = packet.serialize();
      expect(serialized.length).toBeGreaterThanOrEqual(requestData.length + 4); // 包含协议头尾
      
      // 创建事件参数
      const eventArgs = new CaptureEventArgs(true, session);
      expect(eventArgs.success).toBe(true);
      expect(eventArgs.session.totalSamples).toBe(1000); // 950 * (0+1) + 50
    });
  });
});