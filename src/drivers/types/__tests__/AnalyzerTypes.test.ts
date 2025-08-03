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
  getMaxTotalSamples,
  AnalyzerDriverBase,
  TriggerDelays,
  CaptureRequest,
  NetConfig
} from '../AnalyzerTypes';

describe('AnalyzerTypes', () => {
  describe('AnalyzerChannel', () => {
    it('should create channel with correct properties', () => {
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

    it('should generate correct textual channel number', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 5;
      expect(channel.textualChannelNumber).toBe('Channel 6');
    });

    it('should use channelName in toString when available', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 0;
      channel.channelName = 'DATA';
      expect(channel.toString()).toBe('DATA');
    });

    it('should use textualChannelNumber in toString when name is empty', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 2;
      channel.channelName = '';
      expect(channel.toString()).toBe('Channel 3');
    });

    it('should clone channel correctly', () => {
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
    it('should format time correctly for nanoseconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 500n; // 500ns
      expect(burst.getTime()).toBe('500 ns');
    });

    it('should format time correctly for microseconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500n; // 1.5µs
      expect(burst.getTime()).toBe('1.500 µs');
    });

    it('should format time correctly for milliseconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 2500000n; // 2.5ms
      expect(burst.getTime()).toBe('2.500 ms');
    });

    it('should format time correctly for seconds', () => {
      const burst = new BurstInfo();
      burst.burstTimeGap = 1500000000n; // 1.5s
      expect(burst.getTime()).toBe('1.500 s');
    });

    it('should generate correct toString output', () => {
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
    it('should calculate totalSamples correctly', () => {
      const session = new CaptureSession();
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.loopCount = 0;

      expect(session.totalSamples).toBe(10000); // 1000 + 9000 * (0+1)
    });

    it('should calculate totalSamples correctly with loopCount', () => {
      const session = new CaptureSession();
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 5000;
      session.loopCount = 2;

      expect(session.totalSamples).toBe(16000); // 1000 + 5000 * (2+1)
    });

    it('should clone session with data', () => {
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

    it('should clone settings without data', () => {
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
    it('should add bytes correctly', () => {
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

    it('should escape special bytes correctly', () => {
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

    it('should add string correctly', () => {
      const packet = new OutputPacket();
      packet.addString('TEST');

      const serialized = packet.serialize();
      const dataSection = serialized.slice(2, serialized.length - 2);

      expect(dataSection).toEqual(new Uint8Array([0x54, 0x45, 0x53, 0x54])); // "TEST" ASCII
    });

    it('should clear buffer correctly', () => {
      const packet = new OutputPacket();
      packet.addByte(0x55);
      packet.clear();

      const serialized = packet.serialize();

      // 只应该包含协议头尾，没有数据
      expect(serialized).toEqual(new Uint8Array([0x55, 0xaa, 0xaa, 0x55]));
    });
  });

  describe('Utility functions', () => {
    it('getMaxTotalSamples should calculate correctly', () => {
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
    it('should have correct enum values', () => {
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

  describe('Constants', () => {
    it('should have correct TriggerDelays values', () => {
      expect(TriggerDelays.ComplexTriggerDelay).toBe(5);
      expect(TriggerDelays.FastTriggerDelay).toBe(3);
    });
  });

  describe('CaptureSession with bursts', () => {
    it('should clone session with burst data', () => {
      const original = new CaptureSession();
      original.frequency = 24000000;
      
      // 添加突发信息
      const burst1 = new BurstInfo();
      burst1.burstSampleStart = 100;
      burst1.burstSampleEnd = 200;
      burst1.burstSampleGap = 50n;
      burst1.burstTimeGap = 1000n;
      
      const burst2 = new BurstInfo();
      burst2.burstSampleStart = 300;
      burst2.burstSampleEnd = 400;
      burst2.burstSampleGap = 25n;
      burst2.burstTimeGap = 500n;
      
      original.bursts = [burst1, burst2];

      const cloned = original.clone();

      expect(cloned.bursts).toHaveLength(2);
      expect(cloned.bursts![0].burstSampleStart).toBe(100);
      expect(cloned.bursts![0].burstSampleEnd).toBe(200);
      expect(cloned.bursts![0].burstSampleGap).toBe(50n);
      expect(cloned.bursts![0].burstTimeGap).toBe(1000n);
      expect(cloned.bursts![1]).not.toBe(original.bursts![1]); // 深拷贝验证
    });
  });

  describe('OutputPacket Advanced Tests', () => {
    it('should add byte array correctly', () => {
      const packet = new OutputPacket();
      packet.addBytes(new Uint8Array([0x01, 0x02, 0x03]));

      const serialized = packet.serialize();
      const dataSection = serialized.slice(2, serialized.length - 2);

      expect(dataSection).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });

    it('should add regular array correctly', () => {
      const packet = new OutputPacket();
      packet.addBytes([0x04, 0x05, 0x06]);

      const serialized = packet.serialize();
      const dataSection = serialized.slice(2, serialized.length - 2);

      expect(dataSection).toEqual(new Uint8Array([0x04, 0x05, 0x06]));
    });

    it('should serialize CaptureRequest struct correctly', () => {
      const packet = new OutputPacket();
      const captureRequest: CaptureRequest = {
        triggerType: 1,
        trigger: 2,
        invertedOrCount: 0,
        triggerValue: 0x1234,
        channels: new Uint8Array(24).fill(0),
        channelCount: 8,
        frequency: 24000000,
        preSamples: 1000,
        postSamples: 9000,
        loopCount: 0,
        measure: 1,
        captureMode: 0
      };

      // 设置前8个通道为激活状态
      for (let i = 0; i < 8; i++) {
        captureRequest.channels[i] = 1;
      }

      packet.addStruct(captureRequest);
      const serialized = packet.serialize();

      // 验证序列化的数据不为空且包含预期的结构体数据
      expect(serialized.length).toBeGreaterThan(4); // 至少包含协议头尾
      
      // 验证协议头尾
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xaa);
      expect(serialized[serialized.length - 2]).toBe(0xaa);
      expect(serialized[serialized.length - 1]).toBe(0x55);
    });

    it('should serialize NetConfig struct correctly', () => {
      const packet = new OutputPacket();
      const netConfig: NetConfig = {
        accessPointName: 'TestAP',
        password: 'password123',
        ipAddress: '192.168.1.100',
        port: 8080
      };

      packet.addStruct(netConfig);
      const serialized = packet.serialize();

      // 验证序列化的数据不为空
      expect(serialized.length).toBeGreaterThan(4);
      
      // 验证协议头尾  
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xaa);
      expect(serialized[serialized.length - 2]).toBe(0xaa);
      expect(serialized[serialized.length - 1]).toBe(0x55);
    });

    it('should handle long strings in NetConfig correctly', () => {
      const packet = new OutputPacket();
      const netConfig: NetConfig = {
        accessPointName: 'Very_Long_Access_Point_Name_That_Exceeds_32_Characters_Limit',
        password: 'Very_Long_Password_That_Exceeds_The_64_Character_Limit_For_WiFi_Passwords_Test',
        ipAddress: '192.168.1.100.extended',
        port: 8080
      };

      // 这应该不会抛出异常，长字符串应该被截断
      expect(() => packet.addStruct(netConfig)).not.toThrow();
      
      const serialized = packet.serialize();
      expect(serialized.length).toBeGreaterThan(4);
    });
  });

  describe('AnalyzerDriverBase Abstract Class', () => {
    // 创建一个具体实现用于测试
    class TestAnalyzerDriver extends AnalyzerDriverBase {
      get deviceVersion(): string | null { return 'Test Driver v1.0'; }
      get blastFrequency(): number { return 200000000; }
      get maxFrequency(): number { return 100000000; }
      get channelCount(): number { return 24; }
      get bufferSize(): number { return 24000; }
      get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Emulated; }
      get isNetwork(): boolean { return false; }
      get isCapturing(): boolean { return false; }

      async startCapture(): Promise<CaptureError> {
        return CaptureError.None;
      }

      async stopCapture(): Promise<boolean> {
        return true;
      }

      async enterBootloader(): Promise<boolean> {
        return true;
      }
    }

    it('should calculate minFrequency correctly', () => {
      const driver = new TestAnalyzerDriver();
      const expectedMinFreq = Math.floor((100000000 * 2) / 65535);
      expect(driver.minFrequency).toBe(expectedMinFreq);
    });

    it('should determine capture mode based on channels', () => {
      const driver = new TestAnalyzerDriver();

      expect(driver.getCaptureMode([0, 1, 2, 3])).toBe(CaptureMode.Channels_8);
      expect(driver.getCaptureMode([0, 7])).toBe(CaptureMode.Channels_8);
      expect(driver.getCaptureMode([0, 8])).toBe(CaptureMode.Channels_16);
      expect(driver.getCaptureMode([0, 15])).toBe(CaptureMode.Channels_16);
      expect(driver.getCaptureMode([0, 16])).toBe(CaptureMode.Channels_24);
      expect(driver.getCaptureMode([0, 23])).toBe(CaptureMode.Channels_24);
    });

    it('should handle empty channel array in getCaptureMode', () => {
      const driver = new TestAnalyzerDriver();
      expect(driver.getCaptureMode([])).toBe(CaptureMode.Channels_8);
    });

    it('should calculate limits correctly for different modes', () => {
      const driver = new TestAnalyzerDriver();

      // 8通道模式
      const limits8 = driver.getLimits([0, 1, 2, 3]);
      expect(limits8.minPreSamples).toBe(2);
      expect(limits8.minPostSamples).toBe(2);
      expect(limits8.maxPreSamples).toBe(Math.floor(24000 / 10));
      expect(limits8.maxPostSamples).toBe(24000 - 2);

      // 16通道模式
      const limits16 = driver.getLimits([0, 8]);
      expect(limits16.maxPostSamples).toBe(12000 - 2);

      // 24通道模式  
      const limits24 = driver.getLimits([0, 16]);
      expect(limits24.maxPostSamples).toBe(6000 - 2);
    });

    it('should generate device info correctly', () => {
      const driver = new TestAnalyzerDriver();
      const deviceInfo = driver.getDeviceInfo();

      expect(deviceInfo.name).toBe('Test Driver v1.0');
      expect(deviceInfo.maxFrequency).toBe(100000000);
      expect(deviceInfo.blastFrequency).toBe(200000000);
      expect(deviceInfo.channels).toBe(24);
      expect(deviceInfo.bufferSize).toBe(24000);
      expect(deviceInfo.modeLimits).toHaveLength(3);
    });

    it('should handle tag property', () => {
      const driver = new TestAnalyzerDriver();
      const testTag = { customData: 'test' };
      
      driver.tag = testTag;
      expect(driver.tag).toBe(testTag);
    });

    it('should return default values for network methods', async () => {
      const driver = new TestAnalyzerDriver();

      const voltageStatus = await driver.getVoltageStatus();
      expect(voltageStatus).toBe('UNSUPPORTED');

      const networkConfigResult = await driver.sendNetworkConfig('test', 'pass', '192.168.1.1', 80);
      expect(networkConfigResult).toBe(false);
    });

    it('should dispose correctly', () => {
      const driver = new TestAnalyzerDriver();
      const removeAllListenersSpy = jest.spyOn(driver, 'removeAllListeners');
      
      driver.dispose();
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined samples in channel clone', () => {
      const channel = new AnalyzerChannel();
      channel.channelNumber = 1;
      channel.samples = undefined;

      const cloned = channel.clone();
      expect(cloned.samples).toBeUndefined();
    });

    it('should handle BurstInfo edge time cases', () => {
      const burst = new BurstInfo();
      
      // 边界情况：999ns (应该显示为ns)
      burst.burstTimeGap = 999n;
      expect(burst.getTime()).toBe('999 ns');

      // 边界情况：999999ns (应该显示为µs)
      burst.burstTimeGap = 999999n;
      expect(burst.getTime()).toBe('999.999 µs');

      // 边界情况：999999999ns (应该显示为ms)
      burst.burstTimeGap = 999999999n;
      expect(burst.getTime()).toBe('1000.000 ms');
    });
  });
});
