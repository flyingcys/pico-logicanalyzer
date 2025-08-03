/**
 * UnifiedDataFormat.ts 单元测试
 * 测试统一数据格式定义和转换工具
 */

import {
  UnifiedDataFormat,
  UnifiedCaptureData,
  TimebaseInfo,
  ChannelInfo,
  DigitalSampleData,
  AnalogSampleData,
  TimingData,
  TimingEvent,
  DataQuality,
  CaptureMetadata,
  TriggerInfo,
  ViewRange,
  RenderParams,
  ExtensionData
} from '../../../src/models/UnifiedDataFormat';
import { DeviceInfo } from '../../../src/models/AnalyzerTypes';

describe('UnifiedDataFormat', () => {
  let mockDeviceInfo: DeviceInfo;
  let validUnifiedData: UnifiedCaptureData;

  beforeEach(() => {
    mockDeviceInfo = {
      name: 'Test Logic Analyzer',
      version: '1.0.0',
      type: 'Serial' as any,
      isNetwork: false,
      capabilities: {
        channels: {
          digital: 8,
          maxVoltage: 5.0,
          inputImpedance: 1000000
        },
        sampling: {
          maxRate: 100000000,
          minRate: 1000,
          supportedRates: [1000, 10000, 100000, 1000000, 10000000, 100000000],
          bufferSize: 1048576,
          streamingSupport: true
        },
        triggers: {
          types: [],
          maxChannels: 1,
          patternWidth: 8,
          sequentialSupport: false,
          conditions: ['rising', 'falling']
        },
        connectivity: {
          interfaces: ['serial'],
          protocols: ['uart']
        },
        features: {}
      }
    };

    validUnifiedData = {
      version: '1.0.0',
      formatType: 'unified-v1',
      metadata: {
        deviceInfo: mockDeviceInfo,
        captureId: 'test-capture-123',
        timestamp: Date.now(),
        duration: 1000,
        sampleRate: 1000000,
        totalSamples: 10000,
        triggerPosition: 5000,
        timebase: {
          sampleRate: 1000000,
          sampleInterval: 1000,
          timeOffset: 0,
          precision: 1
        },
        captureMode: 'normal',
        triggerInfo: {
          type: 'edge',
          channel: 0,
          condition: 'rising',
          level: 2.5
        }
      },
      channels: [
        {
          channelNumber: 0,
          channelName: 'CH0',
          channelColor: '#FF0000',
          enabled: true,
          threshold: 2.5,
          coupling: 'DC',
          scale: 1.0,
          offset: 0,
          hidden: false
        },
        {
          channelNumber: 1,
          channelName: 'CH1',
          channelColor: '#00FF00',
          enabled: true,
          threshold: 2.5,
          coupling: 'DC',
          scale: 1.0,
          offset: 0,
          hidden: false
        }
      ],
      samples: {
        digital: {
          data: [
            new Uint8Array([1, 0, 1, 1, 0]),
            new Uint8Array([0, 1, 0, 1, 1])
          ],
          encoding: 'binary',
          compression: 'none'
        }
      },
      quality: {
        lostSamples: 0,
        errorRate: 0,
        noiseLevel: 0.1,
        calibrationStatus: true,
        overruns: 0,
        underruns: 0,
        signalIntegrity: 95
      },
      processed: {
        decoded: false,
        analyzed: false,
        validated: true,
        lastModified: Date.now()
      }
    };
  });

  describe('数据验证 (validate)', () => {
    it('应该验证有效的数据结构', () => {
      const result = UnifiedDataFormat.validate(validUnifiedData);
      expect(result).toBe(true);
    });

    it('应该拒绝缺少version的数据', () => {
      const invalidData = { ...validUnifiedData };
      delete (invalidData as any).version;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝缺少formatType的数据', () => {
      const invalidData = { ...validUnifiedData };
      delete (invalidData as any).formatType;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝缺少metadata的数据', () => {
      const invalidData = { ...validUnifiedData };
      delete (invalidData as any).metadata;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝缺少channels的数据', () => {
      const invalidData = { ...validUnifiedData };
      delete (invalidData as any).channels;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝缺少samples的数据', () => {
      const invalidData = { ...validUnifiedData };
      delete (invalidData as any).samples;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝缺少quality的数据', () => {
      const invalidData = { ...validUnifiedData };
      delete (invalidData as any).quality;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝不支持的formatType', () => {
      const invalidData = { ...validUnifiedData };
      invalidData.formatType = 'unsupported-format' as any;

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该拒绝空的通道列表', () => {
      const invalidData = { ...validUnifiedData };
      invalidData.channels = [];

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该验证数字数据通道数量一致性', () => {
      const invalidData = { ...validUnifiedData };
      // 有2个启用通道，但数字数据只有1个通道的数据
      invalidData.samples.digital!.data = [new Uint8Array([1, 0, 1])];

      const result = UnifiedDataFormat.validate(invalidData);
      expect(result).toBe(false);
    });

    it('应该处理禁用通道的数据一致性检查', () => {
      const dataWithDisabledChannel = { ...validUnifiedData };
      dataWithDisabledChannel.channels[1].enabled = false; // 禁用第二个通道
      // 数字数据应该只有1个通道（只有启用的通道）
      dataWithDisabledChannel.samples.digital!.data = [new Uint8Array([1, 0, 1])];

      const result = UnifiedDataFormat.validate(dataWithDisabledChannel);
      expect(result).toBe(true);
    });

    it('应该处理没有数字数据的情况', () => {
      const dataWithoutDigital = { ...validUnifiedData };
      delete dataWithoutDigital.samples.digital;

      const result = UnifiedDataFormat.validate(dataWithoutDigital);
      expect(result).toBe(true);
    });

    it('应该捕获验证过程中的异常', () => {
      // 创建一个会在验证过程中抛出异常的对象
      const malformedData = {
        get version() { throw new Error('Test error'); }
      } as any;

      const result = UnifiedDataFormat.validate(malformedData);
      expect(result).toBe(false);
    });
  });

  describe('创建空数据 (createEmpty)', () => {
    it('应该创建有效的空数据结构', () => {
      const emptyData = UnifiedDataFormat.createEmpty(mockDeviceInfo);

      expect(emptyData.version).toBe('1.0.0');
      expect(emptyData.formatType).toBe('unified-v1');
      expect(emptyData.metadata.deviceInfo).toBe(mockDeviceInfo);
      expect(emptyData.channels).toEqual([]);
      expect(emptyData.samples).toEqual({});
      expect(emptyData.quality).toBeDefined();
      expect(emptyData.quality.lostSamples).toBe(0);
      expect(emptyData.quality.errorRate).toBe(0);
      expect(emptyData.quality.calibrationStatus).toBe(true);
      expect(emptyData.quality.signalIntegrity).toBe(100);
    });

    it('应该设置默认的时基信息', () => {
      const emptyData = UnifiedDataFormat.createEmpty(mockDeviceInfo);

      expect(emptyData.metadata.sampleRate).toBe(1000000);
      expect(emptyData.metadata.timebase.sampleRate).toBe(1000000);
      expect(emptyData.metadata.timebase.sampleInterval).toBe(1000);
      expect(emptyData.metadata.timebase.timeOffset).toBe(0);
      expect(emptyData.metadata.timebase.precision).toBe(1);
    });

    it('应该生成唯一的采集ID', () => {
      const emptyData1 = UnifiedDataFormat.createEmpty(mockDeviceInfo);
      const emptyData2 = UnifiedDataFormat.createEmpty(mockDeviceInfo);

      expect(emptyData1.metadata.captureId).not.toBe(emptyData2.metadata.captureId);
      expect(emptyData1.metadata.captureId).toMatch(/^capture-\d+-\d+$/);
      expect(emptyData2.metadata.captureId).toMatch(/^capture-\d+-\d+$/);
    });

    it('应该设置当前时间戳', () => {
      const beforeCreate = Date.now();
      const emptyData = UnifiedDataFormat.createEmpty(mockDeviceInfo);
      const afterCreate = Date.now();

      expect(emptyData.metadata.timestamp).toBeGreaterThanOrEqual(beforeCreate);
      expect(emptyData.metadata.timestamp).toBeLessThanOrEqual(afterCreate);
    });

    it('应该设置默认采集模式', () => {
      const emptyData = UnifiedDataFormat.createEmpty(mockDeviceInfo);

      expect(emptyData.metadata.captureMode).toBe('normal');
      expect(emptyData.metadata.duration).toBe(0);
      expect(emptyData.metadata.totalSamples).toBe(0);
    });

    it('应该通过自身的验证', () => {
      const emptyData = UnifiedDataFormat.createEmpty(mockDeviceInfo);
      
      // 添加至少一个通道以通过验证
      emptyData.channels.push({
        channelNumber: 0,
        channelName: 'CH0',
        enabled: true,
        hidden: false
      });

      const isValid = UnifiedDataFormat.validate(emptyData);
      expect(isValid).toBe(true);
    });
  });

  describe('转换为LAC格式 (toLacFormat)', () => {
    it('应该正确转换为LAC格式', () => {
      const lacData = UnifiedDataFormat.toLacFormat(validUnifiedData);

      expect(lacData).toBeDefined();
      expect(lacData.captureSession).toBeDefined();
      expect(lacData.deviceInfo).toBe(mockDeviceInfo);
      expect(lacData.quality).toBe(validUnifiedData.quality);
    });

    it('应该正确转换采集会话信息', () => {
      const lacData = UnifiedDataFormat.toLacFormat(validUnifiedData);
      const session = lacData.captureSession;

      expect(session.frequency).toBe(validUnifiedData.metadata.sampleRate);
      expect(session.totalSamples).toBe(validUnifiedData.metadata.totalSamples);
      expect(session.preTriggerSamples).toBe(validUnifiedData.metadata.triggerPosition);
      expect(session.postTriggerSamples).toBe(
        validUnifiedData.metadata.totalSamples - validUnifiedData.metadata.triggerPosition!
      );
    });

    it('应该正确转换通道信息', () => {
      const lacData = UnifiedDataFormat.toLacFormat(validUnifiedData);
      const channels = lacData.captureSession.captureChannels;

      expect(channels).toHaveLength(2);
      
      expect(channels[0].channelNumber).toBe(0);
      expect(channels[0].channelName).toBe('CH0');
      expect(channels[0].channelColor).toBe('#FF0000');
      expect(channels[0].hidden).toBe(false);
      expect(channels[0].samples).toEqual(validUnifiedData.samples.digital!.data[0]);

      expect(channels[1].channelNumber).toBe(1);
      expect(channels[1].channelName).toBe('CH1');
      expect(channels[1].channelColor).toBe('#00FF00');
      expect(channels[1].hidden).toBe(false);
      expect(channels[1].samples).toEqual(validUnifiedData.samples.digital!.data[1]);
    });

    it('应该处理缺少触发位置的情况', () => {
      const dataWithoutTrigger = { ...validUnifiedData };
      delete dataWithoutTrigger.metadata.triggerPosition;

      const lacData = UnifiedDataFormat.toLacFormat(dataWithoutTrigger);
      const session = lacData.captureSession;

      expect(session.preTriggerSamples).toBe(0);
      expect(session.postTriggerSamples).toBe(dataWithoutTrigger.metadata.totalSamples);
    });

    it('应该处理缺少数字数据的情况', () => {
      const dataWithoutDigital = { ...validUnifiedData };
      delete dataWithoutDigital.samples.digital;

      const lacData = UnifiedDataFormat.toLacFormat(dataWithoutDigital);
      const channels = lacData.captureSession.captureChannels;

      expect(channels[0].samples).toEqual(new Uint8Array());
      expect(channels[1].samples).toEqual(new Uint8Array());
    });

    it('应该处理数字数据数组长度不足的情况', () => {
      const dataWithMissingChannelData = { ...validUnifiedData };
      // 只有一个通道的数据，但有两个通道定义
      dataWithMissingChannelData.samples.digital!.data = [new Uint8Array([1, 0, 1])];

      const lacData = UnifiedDataFormat.toLacFormat(dataWithMissingChannelData);
      const channels = lacData.captureSession.captureChannels;

      expect(channels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(channels[1].samples).toEqual(new Uint8Array()); // 应该是空数组
    });
  });

  describe('从LAC格式转换 (fromLacFormat)', () => {
    let mockLacData: any;

    beforeEach(() => {
      mockLacData = {
        captureSession: {
          frequency: 2000000,
          totalSamples: 8000,
          preTriggerSamples: 3000,
          postTriggerSamples: 5000,
          captureChannels: [
            {
              channelNumber: 0,
              channelName: 'Channel 0',
              channelColor: '#FF0000',
              hidden: false,
              samples: new Uint8Array([1, 0, 1, 0, 1])
            },
            {
              channelNumber: 1,
              channelName: 'Channel 1',
              channelColor: '#00FF00',
              hidden: true,
              samples: new Uint8Array([0, 1, 0, 1, 0])
            }
          ]
        },
        quality: {
          lostSamples: 5,
          errorRate: 0.01,
          calibrationStatus: false,
          overruns: 2,
          underruns: 1,
          signalIntegrity: 85
        }
      };
    });

    it('应该正确从LAC格式转换', () => {
      const unifiedData = UnifiedDataFormat.fromLacFormat(mockLacData, mockDeviceInfo);

      expect(unifiedData.version).toBe('1.0.0');
      expect(unifiedData.formatType).toBe('unified-v1');
      expect(unifiedData.metadata.deviceInfo).toBe(mockDeviceInfo);
    });

    it('应该正确转换元数据', () => {
      const unifiedData = UnifiedDataFormat.fromLacFormat(mockLacData, mockDeviceInfo);
      const metadata = unifiedData.metadata;

      expect(metadata.sampleRate).toBe(2000000);
      expect(metadata.totalSamples).toBe(8000);
      expect(metadata.triggerPosition).toBe(3000);
      expect(metadata.captureMode).toBe('imported');
      expect(metadata.captureId).toMatch(/^imported-\d+$/);
    });

    it('应该正确转换时基信息', () => {
      const unifiedData = UnifiedDataFormat.fromLacFormat(mockLacData, mockDeviceInfo);
      const timebase = unifiedData.metadata.timebase;

      expect(timebase.sampleRate).toBe(2000000);
      expect(timebase.sampleInterval).toBe(1000000000 / 2000000); // 500ns
      expect(timebase.timeOffset).toBe(0);
      expect(timebase.precision).toBe(1);
    });

    it('应该正确转换通道信息', () => {
      const unifiedData = UnifiedDataFormat.fromLacFormat(mockLacData, mockDeviceInfo);
      const channels = unifiedData.channels;

      expect(channels).toHaveLength(2);

      expect(channels[0].channelNumber).toBe(0);
      expect(channels[0].channelName).toBe('Channel 0');
      expect(channels[0].channelColor).toBe('#FF0000');
      expect(channels[0].enabled).toBe(true); // !hidden
      expect(channels[0].hidden).toBe(false);

      expect(channels[1].channelNumber).toBe(1);
      expect(channels[1].channelName).toBe('Channel 1');
      expect(channels[1].channelColor).toBe('#00FF00');
      expect(channels[1].enabled).toBe(false); // !hidden
      expect(channels[1].hidden).toBe(true);
    });

    it('应该正确转换数字样本数据', () => {
      const unifiedData = UnifiedDataFormat.fromLacFormat(mockLacData, mockDeviceInfo);
      const digitalSamples = unifiedData.samples.digital!;

      expect(digitalSamples.encoding).toBe('binary');
      expect(digitalSamples.data).toHaveLength(2);
      expect(digitalSamples.data[0]).toEqual(new Uint8Array([1, 0, 1, 0, 1]));
      expect(digitalSamples.data[1]).toEqual(new Uint8Array([0, 1, 0, 1, 0]));
    });

    it('应该正确转换质量信息', () => {
      const unifiedData = UnifiedDataFormat.fromLacFormat(mockLacData, mockDeviceInfo);
      const quality = unifiedData.quality;

      expect(quality.lostSamples).toBe(5);
      expect(quality.errorRate).toBe(0.01);
      expect(quality.calibrationStatus).toBe(false);
      expect(quality.overruns).toBe(2);
      expect(quality.underruns).toBe(1);
      expect(quality.signalIntegrity).toBe(85);
    });

    it('应该处理缺少captureSession的情况', () => {
      const lacDataWithoutSession = {
        frequency: 1000000,
        totalSamples: 5000,
        preTriggerSamples: 2000,
        captureChannels: []
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithoutSession, mockDeviceInfo);

      expect(unifiedData.metadata.sampleRate).toBe(1000000);
      expect(unifiedData.metadata.totalSamples).toBe(5000);
      expect(unifiedData.metadata.triggerPosition).toBe(2000);
    });

    it('应该处理缺少质量信息的情况', () => {
      const lacDataWithoutQuality = { ...mockLacData };
      delete lacDataWithoutQuality.quality;

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithoutQuality, mockDeviceInfo);

      expect(unifiedData.quality.lostSamples).toBe(0);
      expect(unifiedData.quality.errorRate).toBe(0);
      expect(unifiedData.quality.calibrationStatus).toBe(true);
      expect(unifiedData.quality.overruns).toBe(0);
      expect(unifiedData.quality.underruns).toBe(0);
      expect(unifiedData.quality.signalIntegrity).toBe(100);
    });

    it('应该使用默认值处理缺少的字段', () => {
      const minimalLacData = {
        captureChannels: []
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(minimalLacData, mockDeviceInfo);

      expect(unifiedData.metadata.sampleRate).toBe(1000000); // 默认值
      expect(unifiedData.metadata.totalSamples).toBe(0);
      expect(unifiedData.metadata.triggerPosition).toBe(0);
      expect(unifiedData.channels).toEqual([]);
      expect(unifiedData.samples.digital!.data).toEqual([]);
    });

    it('应该处理通道缺少样本数据的情况', () => {
      const lacDataWithoutSamples = {
        captureSession: {
          frequency: 1000000,
          totalSamples: 1000,
          captureChannels: [
            {
              channelNumber: 0,
              channelName: 'CH0'
              // 缺少samples字段
            }
          ]
        }
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithoutSamples, mockDeviceInfo);

      expect(unifiedData.samples.digital!.data[0]).toEqual(new Uint8Array());
    });

    it('应该生成默认通道名称', () => {
      const lacDataWithoutChannelName = {
        captureSession: {
          captureChannels: [
            {
              channelNumber: 5
              // 缺少channelName
            }
          ]
        }
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithoutChannelName, mockDeviceInfo);

      expect(unifiedData.channels[0].channelName).toBe('Channel 6'); // channelNumber + 1
    });

    it('应该处理 captureChannels 为 null 的情况', () => {
      const lacDataWithNullChannels = {
        captureSession: {
          frequency: 1000000,
          totalSamples: 1000,
          captureChannels: null // 明确设置为 null
        }
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithNullChannels, mockDeviceInfo);

      expect(unifiedData.channels).toEqual([]);
      expect(unifiedData.samples.digital!.data).toEqual([]);
    });

    it('应该处理 captureChannels 未定义的情况', () => {
      const lacDataWithUndefinedChannels = {
        captureSession: {
          frequency: 1000000,
          totalSamples: 1000
          // captureChannels 完全没有定义
        }
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithUndefinedChannels, mockDeviceInfo);

      expect(unifiedData.channels).toEqual([]);
      expect(unifiedData.samples.digital!.data).toEqual([]);
    });
  });

  describe('往返转换测试', () => {
    it('应该支持往返转换而不丢失主要数据', () => {
      // UnifiedData -> LAC -> UnifiedData
      const lacData = UnifiedDataFormat.toLacFormat(validUnifiedData);
      const roundTripData = UnifiedDataFormat.fromLacFormat(lacData, mockDeviceInfo);

      // 验证主要数据结构保持一致
      expect(roundTripData.metadata.sampleRate).toBe(validUnifiedData.metadata.sampleRate);
      expect(roundTripData.metadata.totalSamples).toBe(validUnifiedData.metadata.totalSamples);
      expect(roundTripData.channels.length).toBe(validUnifiedData.channels.length);
      expect(roundTripData.samples.digital!.data.length).toBe(validUnifiedData.samples.digital!.data.length);
    });

    it('往返转换应该通过验证', () => {
      const lacData = UnifiedDataFormat.toLacFormat(validUnifiedData);
      const roundTripData = UnifiedDataFormat.fromLacFormat(lacData, mockDeviceInfo);

      const isValid = UnifiedDataFormat.validate(roundTripData);
      expect(isValid).toBe(true);
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理空的通道列表转换', () => {
      const dataWithNoChannels = { ...validUnifiedData };
      dataWithNoChannels.channels = [];
      dataWithNoChannels.samples.digital!.data = [];

      const lacData = UnifiedDataFormat.toLacFormat(dataWithNoChannels);
      expect(lacData.captureSession.captureChannels).toEqual([]);

      const roundTripData = UnifiedDataFormat.fromLacFormat(lacData, mockDeviceInfo);
      expect(roundTripData.channels).toEqual([]);
      expect(roundTripData.samples.digital!.data).toEqual([]);
    });

    it('应该处理极大的样本数', () => {
      const dataWithLargeSamples = { ...validUnifiedData };
      dataWithLargeSamples.metadata.totalSamples = 1000000000; // 10亿样本
      dataWithLargeSamples.metadata.triggerPosition = 500000000;

      const lacData = UnifiedDataFormat.toLacFormat(dataWithLargeSamples);
      expect(lacData.captureSession.totalSamples).toBe(1000000000);
      expect(lacData.captureSession.preTriggerSamples).toBe(500000000);
      expect(lacData.captureSession.postTriggerSamples).toBe(500000000);
    });

    it('应该处理零采样率', () => {
      const dataWithZeroRate = { ...validUnifiedData };
      dataWithZeroRate.metadata.sampleRate = 0;

      const lacData = UnifiedDataFormat.toLacFormat(dataWithZeroRate);
      expect(lacData.captureSession.frequency).toBe(0);

      const roundTripData = UnifiedDataFormat.fromLacFormat(lacData, mockDeviceInfo);
      expect(roundTripData.metadata.sampleRate).toBe(0);
    });

    it('应该处理负的样本数', () => {
      const lacDataWithNegative = {
        captureSession: {
          frequency: 1000000,
          totalSamples: -1000, // 负数
          preTriggerSamples: -500,
          captureChannels: []
        }
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithNegative, mockDeviceInfo);
      expect(unifiedData.metadata.totalSamples).toBe(-1000);
      expect(unifiedData.metadata.triggerPosition).toBe(-500);
    });

    it('应该处理极长的字符串字段', () => {
      const veryLongName = 'A'.repeat(10000);
      const lacDataWithLongStrings = {
        captureSession: {
          captureChannels: [
            {
              channelNumber: 0,
              channelName: veryLongName,
              samples: new Uint8Array([1, 0, 1])
            }
          ]
        }
      };

      const unifiedData = UnifiedDataFormat.fromLacFormat(lacDataWithLongStrings, mockDeviceInfo);
      expect(unifiedData.channels[0].channelName).toBe(veryLongName);
    });
  });

  describe('数据结构接口验证', () => {
    it('应该能创建和使用TimebaseInfo', () => {
      const timebase: TimebaseInfo = {
        sampleRate: 1000000,
        sampleInterval: 1000,
        timeOffset: 100,
        precision: 0.1
      };

      expect(timebase.sampleRate).toBe(1000000);
      expect(timebase.sampleInterval).toBe(1000);
      expect(timebase.timeOffset).toBe(100);
      expect(timebase.precision).toBe(0.1);
    });

    it('应该能创建和使用ChannelInfo', () => {
      const channel: ChannelInfo = {
        channelNumber: 5,
        channelName: 'Test Channel',
        channelColor: '#FFFFFF',
        enabled: true,
        threshold: 1.8,
        coupling: 'AC',
        scale: 2.0,
        offset: -0.5,
        hidden: false
      };

      expect(channel.channelNumber).toBe(5);
      expect(channel.channelName).toBe('Test Channel');
      expect(channel.coupling).toBe('AC');
    });

    it('应该能创建和使用DigitalSampleData', () => {
      const digitalData: DigitalSampleData = {
        data: [
          new Uint8Array([1, 0, 1]),
          new Uint8Array([0, 1, 0])
        ],
        encoding: 'rle',
        compression: 'zip'
      };

      expect(digitalData.data.length).toBe(2);
      expect(digitalData.encoding).toBe('rle');
      expect(digitalData.compression).toBe('zip');
    });

    it('应该能创建和使用AnalogSampleData', () => {
      const analogData: AnalogSampleData = {
        data: [
          new Float32Array([1.5, 2.0, 2.5]),
          new Float32Array([0.5, 1.0, 1.5])
        ],
        resolution: 12,
        range: [-5.0, 5.0],
        units: 'V'
      };

      expect(analogData.data.length).toBe(2);
      expect(analogData.resolution).toBe(12);
      expect(analogData.range).toEqual([-5.0, 5.0]);
      expect(analogData.units).toBe('V');
    });

    it('应该能创建和使用TimingData', () => {
      const timingEvent: TimingEvent = {
        timestamp: 1000000,
        channelMask: 0xFF,
        eventType: 'pulse',
        duration: 500
      };

      const timingData: TimingData = {
        intervals: [100, 200, 300],
        precision: 1,
        events: [timingEvent]
      };

      expect(timingData.intervals.length).toBe(3);
      expect(timingData.events.length).toBe(1);
      expect(timingData.events[0].eventType).toBe('pulse');
    });

    it('应该能创建和使用DataQuality', () => {
      const quality: DataQuality = {
        lostSamples: 10,
        errorRate: 0.05,
        noiseLevel: 0.2,
        calibrationStatus: false,
        overruns: 3,
        underruns: 1,
        signalIntegrity: 88
      };

      expect(quality.lostSamples).toBe(10);
      expect(quality.errorRate).toBe(0.05);
      expect(quality.calibrationStatus).toBe(false);
      expect(quality.signalIntegrity).toBe(88);
    });

    it('应该能创建和使用ViewRange', () => {
      const viewRange: ViewRange = {
        startSample: 1000,
        endSample: 2000,
        samplesPerPixel: 10,
        timePerPixel: 10000,
        zoomLevel: 1.5
      };

      expect(viewRange.startSample).toBe(1000);
      expect(viewRange.endSample).toBe(2000);
      expect(viewRange.zoomLevel).toBe(1.5);
    });

    it('应该能创建和使用RenderParams', () => {
      const renderParams: RenderParams = {
        viewRange: {
          startSample: 0,
          endSample: 1000,
          samplesPerPixel: 1,
          timePerPixel: 1000,
          zoomLevel: 1.0
        },
        channelHeight: 20,
        channelSpacing: 5,
        colors: {
          background: '#000000',
          grid: '#333333',
          signal: '#00FF00',
          trigger: '#FF0000',
          cursor: '#FFFF00'
        },
        showGrid: true,
        showLabels: true,
        antialiasing: false
      };

      expect(renderParams.channelHeight).toBe(20);
      expect(renderParams.colors.signal).toBe('#00FF00');
      expect(renderParams.showGrid).toBe(true);
      expect(renderParams.antialiasing).toBe(false);
    });
  });
});