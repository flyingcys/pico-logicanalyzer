/**
 * AnalyzerTypes 单元测试
 * 测试硬件抽象层的核心类型和类
 */

import {
  AnalyzerChannel,
  BurstInfo,
  CaptureSession,
  OutputPacket,
  CaptureMode,
  TriggerType,
  AnalyzerDriverType,
  CaptureError,
  getMaxTotalSamples
} from '../AnalyzerTypes';

describe('AnalyzerTypes', () => {
  describe('AnalyzerChannel', () => {
    test('should create channel with correct properties', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 0;
      channel.channelName = 'CLK';
      channel.channelColor = 0xff0000;
      channel.hidden = false;

      expect(channel.channelNumber).toBe(0);
      expect(channel.channelName).toBe('CLK');
      expect(channel.channelColor).toBe(0xff0000);
      expect(channel.hidden).toBe(false);
      expect(channel.textualChannelNumber).toBe('Channel 1');
    });

    test('should generate correct textual channel number', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 5;
      expect(channel.textualChannelNumber).toBe('Channel 6');
    });

    test('should use channelName in toString when available', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 0;
      channel.channelName = 'DATA';
      expect(channel.toString()).toBe('DATA');
    });

    test('should use textualChannelNumber in toString when name is empty', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 2;
      channel.channelName = '';
      expect(channel.toString()).toBe('Channel 3');
    });

    test('should clone channel correctly', () => {
      const original = new AnalyzerChannel();
      original.channelNumber = 1;
      original.channelName = 'SDA';
      original.channelColor = 0x00ff00;
      original.hidden = true;
      original.samples = new Uint8Array([1, 0, 1, 0]);

      const cloned = original.clone();

      expect(cloned.channelNumber).toBe(original.channelNumber);
      expect(cloned.channelName).toBe(original.channelName);
      expect(cloned.channelColor).toBe(original.channelColor);
      expect(cloned.hidden).toBe(original.hidden);
      expect(cloned.samples).toEqual(original.samples);
      expect(cloned.samples).not.toBe(original.samples); // 应该是深拷贝
    });
  });

  describe('BurstInfo', () => {
    test('should format time correctly for nanoseconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 500n; // 500ns
      expect(burst.getTime()).toBe('500 ns');
    });

    test('should format time correctly for microseconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500n; // 1.5µs
      expect(burst.getTime()).toBe('1.500 µs');
    });

    test('should format time correctly for milliseconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 2500000n; // 2.5ms
      expect(burst.getTime()).toBe('2.500 ms');
    });

    test('should format time correctly for seconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500000000n; // 1.5s
      expect(burst.getTime()).toBe('1.500 s');
    });

    test('should generate correct toString output', () => {
      const burst = new BurstInfo();
      burst.burstSampleStart = 100;
      burst.burstSampleEnd = 200;
      burst.burstSampleGap = 50n;
      burst.burstTimeGap = 1000n; // 1µs

      const expected = 'Burst: 100 to 200\nGap: 1.000 µs (50 samples)';
      expect(burst.toString()).toBe(expected);
    });
  });

  describe('CaptureSession', () => {
    test('should calculate totalSamples correctly', () => {
      const session = new CaptureSession();
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.loopCount = 0;

      expect(session.totalSamples).toBe(10000); // 1000 + 9000 * (0+1)
    });

    test('should calculate totalSamples correctly with loopCount', () => {
      const session = new CaptureSession();
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 5000;
      session.loopCount = 2;

      expect(session.totalSamples).toBe(16000); // 1000 + 5000 * (2+1)
    });

    test('should clone session with data', () => {
      const original = new CaptureSession();
      original.frequency = 24000000;
      original.preTriggerSamples = 1000;
      original.postTriggerSamples = 9000;
      original.triggerType = TriggerType.Edge;
      original.triggerChannel = 1;

      const channel = new AnalyzerChannel();
      channel.channelNumber = 0;
      channel.samples = new Uint8Array([1, 0, 1]);
      original.captureChannels = [channel];

      const cloned = original.clone();

      expect(cloned.frequency).toBe(original.frequency);
      expect(cloned.totalSamples).toBe(original.totalSamples);
      expect(cloned.captureChannels).toHaveLength(1);
      expect(cloned.captureChannels[0].samples).toEqual(original.captureChannels[0].samples);
      expect(cloned.captureChannels[0]).not.toBe(original.captureChannels[0]); // 深拷贝
    });

    test('should clone settings without data', () => {
      const original = new CaptureSession();
      original.frequency = 24000000;
      original.preTriggerSamples = 1000;
      original.postTriggerSamples = 9000;

      const channel = new AnalyzerChannel();
      channel.channelNumber = 0;
      channel.samples = new Uint8Array([1, 0, 1]);
      original.captureChannels = [channel];

      const clonedSettings = original.cloneSettings();

      expect(clonedSettings.frequency).toBe(original.frequency);
      expect(clonedSettings.captureChannels).toHaveLength(1);
      expect(clonedSettings.captureChannels[0].samples).toBeUndefined();
      expect(clonedSettings.bursts).toBeUndefined();
    });
  });

  describe('OutputPacket', () => {
    test('should add bytes correctly', () => {
      const packet = new OutputPacket();
      packet.addByte(0x55);
      packet.addByte(0xaa);

      const serialized = packet.serialize();

      // 协议格式: 0x55 0xAA [转义后的数据] 0xAA 0x55
      expect(serialized[0]).toBe(0x55); // 开始标记
      expect(serialized[1]).toBe(0xaa); // 开始标记
      expect(serialized[serialized.length - 2]).toBe(0xaa); // 结束标记
      expect(serialized[serialized.length - 1]).toBe(0x55); // 结束标记
    });

    test('should escape special bytes correctly', () => {
      const packet = new OutputPacket();
      packet.addByte(0xaa); // 需要转义
      packet.addByte(0x55); // 需要转义
      packet.addByte(0xf0); // 需要转义
      packet.addByte(0x00); // 不需要转义

      const serialized = packet.serialize();

      // 检查转义: 0xAA -> 0xF0 0x5A, 0x55 -> 0xF0 0xA5, 0xF0 -> 0xF0 0x00
      const dataSection = serialized.slice(2, serialized.length - 2);
      expect(dataSection).toEqual(
        new Uint8Array([
          0xf0,
          0x5a, // 0xAA ^ 0xF0 = 0x5A
          0xf0,
          0xa5, // 0x55 ^ 0xF0 = 0xA5
          0xf0,
          0x00, // 0xF0 ^ 0xF0 = 0x00
          0x00 // 0x00 不需要转义
        ])
      );
    });

    test('should add string correctly', () => {
      const packet = new OutputPacket();
      packet.addString('TEST');

      const serialized = packet.serialize();
      const dataSection = serialized.slice(2, serialized.length - 2);

      expect(dataSection).toEqual(new Uint8Array([0x54, 0x45, 0x53, 0x54])); // "TEST" ASCII
    });

    test('should clear buffer correctly', () => {
      const packet = new OutputPacket();
      packet.addByte(0x55);
      packet.clear();

      const serialized = packet.serialize();

      // 只应该包含协议头尾，没有数据
      expect(serialized).toEqual(new Uint8Array([0x55, 0xaa, 0xaa, 0x55]));
    });
  });

  describe('Utility functions', () => {
    test('getMaxTotalSamples should calculate correctly', () => {
      const limits = {
        minPreSamples: 100,
        maxPreSamples: 1000,
        minPostSamples: 200,
        maxPostSamples: 10000
      };

      expect(getMaxTotalSamples(limits)).toBe(10100); // 100 + 10000
    });
  });

  describe('Enums', () => {
    test('should have correct enum values', () => {
      expect(CaptureMode.Channels_8).toBe(0);
      expect(CaptureMode.Channels_16).toBe(1);
      expect(CaptureMode.Channels_24).toBe(2);

      expect(TriggerType.Edge).toBe('Edge');
      expect(TriggerType.Complex).toBe('Complex');
      expect(TriggerType.Fast).toBe('Fast');
      expect(TriggerType.Blast).toBe('Blast');

      expect(AnalyzerDriverType.Serial).toBe('Serial');
      expect(AnalyzerDriverType.Network).toBe('Network');
      expect(AnalyzerDriverType.Multi).toBe('Multi');
      expect(AnalyzerDriverType.Emulated).toBe('Emulated');

      expect(CaptureError.None).toBe('None');
      expect(CaptureError.Busy).toBe('Busy');
      expect(CaptureError.BadParams).toBe('BadParams');
      expect(CaptureError.HardwareError).toBe('HardwareError');
      expect(CaptureError.UnexpectedError).toBe('UnexpectedError');
    });
  });
});
