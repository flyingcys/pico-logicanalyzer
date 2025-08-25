/**
 * LACFileFormat 模块综合单元测试套件
 * 全面测试.lac文件格式读写处理器的功能
 * 与C#原版兼容性测试
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LACFileFormat,
  ExportedCapture,
  SampleRegion,
  LACFileResult
} from '../../../src/models/LACFileFormat';
import {
  CaptureSession,
  AnalyzerChannel,
  BurstInfo
} from '../../../src/models/CaptureModels';
import {
  TriggerType,
  DeviceInfo
} from '../../../src/models/AnalyzerTypes';

// Mock fs 模块
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

const mockedFs = jest.mocked(fs);

describe('LACFileFormat 模块单元测试套件', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('save() 方法测试', () => {
    
    it('应该成功保存基本的CaptureSession', async () => {
      // 准备测试数据
      const captureSession = new CaptureSession();
      captureSession.frequency = 1000000;
      captureSession.preTriggerSamples = 100;
      captureSession.postTriggerSamples = 900;
      captureSession.triggerType = TriggerType.Edge;
      captureSession.triggerChannel = 0;
      
      const channel = new AnalyzerChannel(0, 'Test Channel');
      channel.samples = new Uint8Array([1, 0, 1, 0, 1]);
      captureSession.captureChannels = [channel];

      // Mock文件系统操作
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      // 执行测试
      const result = await LACFileFormat.save('/test/file.lac', captureSession);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('/test/file.lac');
      expect(result.data).toBeDefined();
      expect(result.data!.Settings).toBe(captureSession);
      expect(result.fileSize).toBeGreaterThan(0);

      // 验证文件系统调用
      expect(mockedFs.promises.mkdir).toHaveBeenCalledWith('/test', { recursive: true });
      expect(mockedFs.promises.writeFile).toHaveBeenCalledWith(
        '/test/file.lac',
        expect.any(String),
        'utf-8'
      );
    });

    it('应该成功保存包含选择区域的数据', async () => {
      const captureSession = new CaptureSession();
      captureSession.frequency = 2000000;
      const channel = new AnalyzerChannel(0, 'Test Channel');
      captureSession.captureChannels = [channel];

      const selectedRegions = [
        {
          firstSample: 100,
          lastSample: 200,
          regionName: 'Region 1',
          color: { r: 255, g: 0, b: 0, a: 128 }
        },
        {
          firstSample: 300,
          lastSample: 400,
          regionName: 'Region 2',
          color: { r: 0, g: 255, b: 0, a: 255 }
        }
      ];

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      const result = await LACFileFormat.save('/test/regions.lac', captureSession, selectedRegions);

      expect(result.success).toBe(true);
      expect(result.data!.SelectedRegions).toBeDefined();
      expect(result.data!.SelectedRegions!.length).toBe(2);
      
      const region1 = result.data!.SelectedRegions![0];
      expect(region1.FirstSample).toBe(100);
      expect(region1.LastSample).toBe(200);
      expect(region1.RegionName).toBe('Region 1');
      expect(region1.R).toBe(255);
      expect(region1.G).toBe(0);
      expect(region1.B).toBe(0);
      expect(region1.A).toBe(128);
    });

    it('应该成功保存包含原始样本数据的文件', async () => {
      const captureSession = new CaptureSession();
      captureSession.frequency = 1000000;
      
      const channel1 = new AnalyzerChannel(0, 'CH0');
      channel1.samples = new Uint8Array([1, 0, 1, 1]);
      const channel2 = new AnalyzerChannel(1, 'CH1');
      channel2.samples = new Uint8Array([0, 1, 0, 0]);
      
      captureSession.captureChannels = [channel1, channel2];

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      const result = await LACFileFormat.save('/test/samples.lac', captureSession, undefined, true);

      expect(result.success).toBe(true);
      expect(result.data!.Samples).toBeDefined();
      expect(result.data!.Samples!.length).toBe(4); // 4个样本
      
      // 验证UInt128数组格式
      expect(result.data!.Samples![0]).toMatch(/^[0-9a-f]{32}$/i); // 32位十六进制字符串
    });

    it('应该创建不存在的目录', async () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      await LACFileFormat.save('/new/dir/file.lac', captureSession);

      expect(mockedFs.promises.mkdir).toHaveBeenCalledWith('/new/dir', { recursive: true });
    });

    it('应该处理写入错误', async () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockRejectedValue(new Error('Permission denied'));

      const result = await LACFileFormat.save('/test/error.lac', captureSession);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save file');
      expect(result.error).toContain('Permission denied');
    });

    it('应该处理目录创建错误', async () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockRejectedValue(new Error('Disk full'));
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      const result = await LACFileFormat.save('/test/error.lac', captureSession);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save file');
    });

    it('应该处理空的通道数组', async () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = []; // 空数组

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      const result = await LACFileFormat.save('/test/empty.lac', captureSession);

      expect(result.success).toBe(true);
      expect(result.data!.Samples).toBeUndefined(); // 没有样本数据
    });
  });

  describe('load() 方法测试', () => {
    
    it('应该成功加载有效的LAC文件', async () => {
      const mockExportedCapture: ExportedCapture = {
        Settings: {
          frequency: 1000000,
          preTriggerSamples: 100,
          postTriggerSamples: 900,
          triggerType: TriggerType.Edge,
          triggerChannel: 0,
          captureChannels: [
            {
              channelNumber: 0,
              channelName: 'Test Channel',
              samples: new Uint8Array([1, 0, 1, 0])
            } as AnalyzerChannel
          ]
        } as CaptureSession
      };

      const mockFileContent = JSON.stringify(mockExportedCapture);
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue(mockFileContent);

      const result = await LACFileFormat.load('/test/valid.lac');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.Settings.frequency).toBe(1000000);
      expect(result.fileSize).toBe(Buffer.byteLength(mockFileContent, 'utf-8'));
    });

    it('应该成功加载包含选择区域的文件', async () => {
      const mockExportedCapture: ExportedCapture = {
        Settings: {
          frequency: 2000000,
          captureChannels: []
        } as CaptureSession,
        SelectedRegions: [
          {
            FirstSample: 100,
            LastSample: 200,
            RegionName: 'Test Region',
            R: 255,
            G: 128,
            B: 64,
            A: 200
          }
        ]
      };

      const mockFileContent = JSON.stringify(mockExportedCapture);
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue(mockFileContent);

      const result = await LACFileFormat.load('/test/regions.lac');

      expect(result.success).toBe(true);
      expect(result.data!.SelectedRegions).toBeDefined();
      expect(result.data!.SelectedRegions!.length).toBe(1);
      expect(result.data!.SelectedRegions![0].RegionName).toBe('Test Region');
    });

    it('应该处理文件不存在的情况', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const result = await LACFileFormat.load('/nonexistent/file.lac');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toContain('/nonexistent/file.lac');
    });

    it('应该处理无效JSON格式', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue('invalid json content {');

      const result = await LACFileFormat.load('/test/invalid.lac');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON format');
    });

    it('应该处理缺少Settings的文件', async () => {
      const invalidData = { invalidField: 'test' };
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue(JSON.stringify(invalidData));

      const result = await LACFileFormat.load('/test/invalid.lac');

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing Settings');
    });

    it('应该处理文件读取错误', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await LACFileFormat.load('/test/protected.lac');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load file');
      expect(result.error).toContain('Permission denied');
    });

    it('应该处理空文件', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue('');

      const result = await LACFileFormat.load('/test/empty.lac');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON format');
    });
  });

  describe('convertToCaptureSession() 方法测试', () => {
    
    it('应该正确转换基本的ExportedCapture', () => {
      const exportedCapture: ExportedCapture = {
        Settings: {
          frequency: 2000000,
          preTriggerSamples: 200,
          postTriggerSamples: 1800,
          triggerType: TriggerType.Complex,
          triggerChannel: 1,
          captureChannels: [
            {
              channelNumber: 0,
              channelName: 'SDA',
              samples: new Uint8Array([1, 0, 1, 1])
            } as AnalyzerChannel
          ]
        } as CaptureSession
      };

      const result = LACFileFormat.convertToCaptureSession(exportedCapture);

      expect(result).toBe(exportedCapture.Settings);
      expect(result.frequency).toBe(2000000);
      expect(result.triggerType).toBe(TriggerType.Complex);
      expect(result.captureChannels.length).toBe(1);
    });

    it('应该正确提取UInt128样本数据', () => {
      const captureSession = new CaptureSession();
      const channel1 = new AnalyzerChannel(0, 'CH0');
      const channel2 = new AnalyzerChannel(1, 'CH1');
      captureSession.captureChannels = [channel1, channel2];

      const exportedCapture: ExportedCapture = {
        Settings: captureSession,
        Samples: [
          '00000000000000000000000000000001', // 第1个样本：CH0=1, CH1=0
          '00000000000000000000000000000002', // 第2个样本：CH0=0, CH1=1  
          '00000000000000000000000000000003', // 第3个样本：CH0=1, CH1=1
          '00000000000000000000000000000000'  // 第4个样本：CH0=0, CH1=0
        ]
      };

      const result = LACFileFormat.convertToCaptureSession(exportedCapture);

      expect(result.captureChannels[0].samples).toBeDefined();
      expect(result.captureChannels[1].samples).toBeDefined();
      expect(result.captureChannels[0].samples!.length).toBe(4);
      expect(result.captureChannels[1].samples!.length).toBe(4);
      
      // 验证样本数据
      expect(result.captureChannels[0].samples![0]).toBe(1); // CH0 第1个样本
      expect(result.captureChannels[1].samples![0]).toBe(0); // CH1 第1个样本
      expect(result.captureChannels[0].samples![1]).toBe(0); // CH0 第2个样本  
      expect(result.captureChannels[1].samples![1]).toBe(1); // CH1 第2个样本
    });

    it('应该处理没有Samples的情况', () => {
      const exportedCapture: ExportedCapture = {
        Settings: {
          frequency: 1000000,
          captureChannels: [new AnalyzerChannel(0, 'CH0')]
        } as CaptureSession
      };

      const result = LACFileFormat.convertToCaptureSession(exportedCapture);

      expect(result.captureChannels[0].samples).toBeUndefined();
    });

    it('应该处理空的Samples数组', () => {
      const exportedCapture: ExportedCapture = {
        Settings: {
          frequency: 1000000,
          captureChannels: [new AnalyzerChannel(0, 'CH0')]
        } as CaptureSession,
        Samples: []
      };

      const result = LACFileFormat.convertToCaptureSession(exportedCapture);

      expect(result.captureChannels[0].samples).toBeUndefined();
    });
  });

  describe('createFromCaptureSession() 方法测试', () => {
    
    it('应该正确创建基本的ExportedCapture', () => {
      const captureSession = new CaptureSession();
      captureSession.frequency = 3000000;
      captureSession.triggerType = TriggerType.Fast;
      
      const channel = new AnalyzerChannel(0, 'Test Channel');
      captureSession.captureChannels = [channel];

      const result = LACFileFormat.createFromCaptureSession(captureSession);

      expect(result.Settings).toBe(captureSession);
      expect(result.Samples).toBeUndefined(); // 默认不包含样本数据
      expect(result.SelectedRegions).toBeUndefined();
    });

    it('应该正确创建包含选择区域的ExportedCapture', () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];

      const selectedRegions = [
        {
          firstSample: 50,
          lastSample: 150,
          regionName: 'Important Region',
          color: { r: 100, g: 200, b: 50, a: 180 }
        }
      ];

      const result = LACFileFormat.createFromCaptureSession(captureSession, selectedRegions);

      expect(result.SelectedRegions).toBeDefined();
      expect(result.SelectedRegions!.length).toBe(1);
      expect(result.SelectedRegions![0].FirstSample).toBe(50);
      expect(result.SelectedRegions![0].LastSample).toBe(150);
      expect(result.SelectedRegions![0].RegionName).toBe('Important Region');
      expect(result.SelectedRegions![0].R).toBe(100);
      expect(result.SelectedRegions![0].G).toBe(200);
      expect(result.SelectedRegions![0].B).toBe(50);
      expect(result.SelectedRegions![0].A).toBe(180);
    });

    it('应该正确创建包含原始样本数据的ExportedCapture', () => {
      const captureSession = new CaptureSession();
      
      const channel1 = new AnalyzerChannel(0, 'CH0');
      channel1.samples = new Uint8Array([1, 0, 1]);
      const channel2 = new AnalyzerChannel(1, 'CH1');
      channel2.samples = new Uint8Array([0, 1, 1]);
      
      captureSession.captureChannels = [channel1, channel2];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples).toBeDefined();
      expect(result.Samples!.length).toBe(3); // 3个样本
      
      // 验证UInt128编码
      expect(result.Samples![0]).toBe('00000000000000000000000000000001'); // CH0=1, CH1=0
      expect(result.Samples![1]).toBe('00000000000000000000000000000002'); // CH0=0, CH1=1
      expect(result.Samples![2]).toBe('00000000000000000000000000000003'); // CH0=1, CH1=1
    });

    it('应该处理空的通道数组', () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      // 当通道数组为空时，不会设置 Samples 属性
      expect(result.Samples).toBeUndefined();
    });

    it('应该处理没有样本数据的通道', () => {
      const captureSession = new CaptureSession();
      const channel = new AnalyzerChannel(0, 'CH0');
      // 不设置 samples 属性
      captureSession.captureChannels = [channel];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples).toBeDefined();
      expect(result.Samples!.length).toBe(0);
    });
  });

  describe('样本数据编码/解码测试', () => {
    
    it('应该正确编码单通道样本数据', () => {
      const captureSession = new CaptureSession();
      
      const channel = new AnalyzerChannel(0, 'CH0');
      channel.samples = new Uint8Array([1, 0, 1, 1, 0]);
      captureSession.captureChannels = [channel];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples).toBeDefined();
      expect(result.Samples!.length).toBe(5);
      expect(result.Samples![0]).toBe('00000000000000000000000000000001'); // 1
      expect(result.Samples![1]).toBe('00000000000000000000000000000000'); // 0
      expect(result.Samples![2]).toBe('00000000000000000000000000000001'); // 1
      expect(result.Samples![3]).toBe('00000000000000000000000000000001'); // 1
      expect(result.Samples![4]).toBe('00000000000000000000000000000000'); // 0
    });

    it('应该正确编码多通道样本数据', () => {
      const captureSession = new CaptureSession();
      
      const channel0 = new AnalyzerChannel(0, 'CH0');
      channel0.samples = new Uint8Array([1, 0, 1]);
      const channel1 = new AnalyzerChannel(1, 'CH1');
      channel1.samples = new Uint8Array([0, 1, 0]);
      const channel2 = new AnalyzerChannel(2, 'CH2');
      channel2.samples = new Uint8Array([1, 1, 1]);
      
      captureSession.captureChannels = [channel0, channel1, channel2];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples!.length).toBe(3);
      // 第1个样本: CH0=1, CH1=0, CH2=1 -> 二进制101 -> 5
      expect(result.Samples![0]).toBe('00000000000000000000000000000005');
      // 第2个样本: CH0=0, CH1=1, CH2=1 -> 二进制110 -> 6  
      expect(result.Samples![1]).toBe('00000000000000000000000000000006');
      // 第3个样本: CH0=1, CH1=0, CH2=1 -> 二进制101 -> 5
      expect(result.Samples![2]).toBe('00000000000000000000000000000005');
    });

    it('应该正确解码样本数据', () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1'),
        new AnalyzerChannel(2, 'CH2')
      ];

      const exportedCapture: ExportedCapture = {
        Settings: captureSession,
        Samples: [
          '00000000000000000000000000000005', // 二进制101: CH0=1, CH1=0, CH2=1
          '00000000000000000000000000000006', // 二进制110: CH0=0, CH1=1, CH2=1
          '00000000000000000000000000000003'  // 二进制011: CH0=1, CH1=1, CH2=0
        ]
      };

      const result = LACFileFormat.convertToCaptureSession(exportedCapture);

      expect(result.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1]));
      expect(result.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1]));
      expect(result.captureChannels[2].samples).toEqual(new Uint8Array([1, 1, 0]));
    });

    it('应该处理超过128通道的情况', () => {
      const captureSession = new CaptureSession();
      
      // 创建130个通道（超过128的限制）
      for (let i = 0; i < 130; i++) {
        const channel = new AnalyzerChannel(i, `CH${i}`);
        channel.samples = new Uint8Array([i % 2]); // 交替0和1
        captureSession.captureChannels.push(channel);
      }

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples).toBeDefined();
      expect(result.Samples!.length).toBe(1);
      
      // 应该只处理前128个通道
      const uint128Value = BigInt(`0x${result.Samples![0]}`);
      
      // 验证第128个通道（索引127）的值
      const mask127 = BigInt(1) << BigInt(127);
      expect((uint128Value & mask127) !== BigInt(0)).toBe(true); // 127 % 2 = 1
    });

    it('应该处理大整数值', () => {
      const captureSession = new CaptureSession();
      
      // 创建一个会产生大整数的通道配置
      const channel63 = new AnalyzerChannel(63, 'CH63');
      channel63.samples = new Uint8Array([1]);
      const channel127 = new AnalyzerChannel(127, 'CH127');
      channel127.samples = new Uint8Array([1]);
      
      captureSession.captureChannels = [channel63, channel127];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples![0]).toMatch(/^[0-9a-f]{32}$/i);
      
      // 验证解码后的数据
      const exportedCapture: ExportedCapture = {
        Settings: captureSession,
        Samples: result.Samples
      };
      
      const decoded = LACFileFormat.convertToCaptureSession(exportedCapture);
      expect(decoded.captureChannels[0].samples![0]).toBe(1);
      expect(decoded.captureChannels[1].samples![0]).toBe(1);
    });
  });

  describe('JSON序列化/反序列化测试', () => {
    
    it('应该正确序列化SampleRegion', () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];
      
      const selectedRegions = [
        {
          firstSample: 10,
          lastSample: 20,
          regionName: 'Test Region',
          color: { r: 255, g: 128, b: 64, a: 200 }
        }
      ];

      const result = LACFileFormat.createFromCaptureSession(captureSession, selectedRegions);

      // 序列化到JSON
      const jsonString = JSON.stringify(result);
      const parsed = JSON.parse(jsonString);

      expect(parsed.SelectedRegions).toBeDefined();
      expect(parsed.SelectedRegions[0].FirstSample).toBe(10);
      expect(parsed.SelectedRegions[0].LastSample).toBe(20);
      expect(parsed.SelectedRegions[0].RegionName).toBe('Test Region');
      expect(parsed.SelectedRegions[0].R).toBe(255);
      expect(parsed.SelectedRegions[0].G).toBe(128);
      expect(parsed.SelectedRegions[0].B).toBe(64);
      expect(parsed.SelectedRegions[0].A).toBe(200);
    });

    it('应该正确反序列化SampleRegion', () => {
      const mockData = {
        Settings: {
          frequency: 1000000,
          captureChannels: []
        },
        SelectedRegions: [
          {
            FirstSample: 50,
            LastSample: 100,
            RegionName: 'Parsed Region',
            R: 100,
            G: 150,
            B: 200,
            A: 250
          }
        ]
      };

      const jsonString = JSON.stringify(mockData);
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue(jsonString);

      return LACFileFormat.load('/test/file.lac').then(result => {
        expect(result.success).toBe(true);
        expect(result.data!.SelectedRegions).toBeDefined();
        expect(result.data!.SelectedRegions![0].FirstSample).toBe(50);
        expect(result.data!.SelectedRegions![0].LastSample).toBe(100);
        expect(result.data!.SelectedRegions![0].RegionName).toBe('Parsed Region');
        expect(result.data!.SelectedRegions![0].R).toBe(100);
        expect(result.data!.SelectedRegions![0].G).toBe(150);
        expect(result.data!.SelectedRegions![0].B).toBe(200);
        expect(result.data!.SelectedRegions![0].A).toBe(250);
      });
    });

    it('应该处理不完整的SampleRegion数据', () => {
      const mockData = {
        Settings: {
          frequency: 1000000,
          captureChannels: []
        },
        SelectedRegions: [
          {
            FirstSample: 10,
            // 缺少其他字段
          }
        ]
      };

      const jsonString = JSON.stringify(mockData);
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue(jsonString);

      return LACFileFormat.load('/test/file.lac').then(result => {
        expect(result.success).toBe(true);
        expect(result.data!.SelectedRegions).toBeDefined();
        expect(result.data!.SelectedRegions![0].FirstSample).toBe(10);
      });
    });
  });

  describe('错误处理和边界条件测试', () => {
    
    it('应该处理null和undefined输入', () => {
      expect(() => {
        LACFileFormat.convertToCaptureSession(null as any);
      }).toThrow();

      expect(() => {
        LACFileFormat.createFromCaptureSession(null as any);
      }).toThrow();
    });

    it('应该处理空的样本数组', () => {
      const captureSession = new CaptureSession();
      const channel = new AnalyzerChannel(0, 'CH0');
      channel.samples = new Uint8Array(0); // 空数组
      captureSession.captureChannels = [channel];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      expect(result.Samples).toBeDefined();
      expect(result.Samples!.length).toBe(0);
    });

    it('应该处理不一致的样本数量', () => {
      const captureSession = new CaptureSession();
      
      const channel1 = new AnalyzerChannel(0, 'CH0');
      channel1.samples = new Uint8Array([1, 0, 1]); // 3个样本
      
      const channel2 = new AnalyzerChannel(1, 'CH1');  
      channel2.samples = new Uint8Array([0, 1]); // 2个样本
      
      captureSession.captureChannels = [channel1, channel2];

      const result = LACFileFormat.createFromCaptureSession(captureSession, undefined, true);

      // 应该使用第一个通道的样本数量
      expect(result.Samples!.length).toBe(3);
    });

    it('应该处理无效的十六进制字符串', () => {
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];

      const exportedCapture: ExportedCapture = {
        Settings: captureSession,
        Samples: ['invalid_hex_string', 'another_invalid']
      };

      // 应该不抛出异常，并且无效数据被设置为0
      expect(() => {
        LACFileFormat.convertToCaptureSession(exportedCapture);
      }).not.toThrow();

      const result = LACFileFormat.convertToCaptureSession(exportedCapture);
      expect(result.captureChannels[0].samples).toBeDefined();
      expect(result.captureChannels[0].samples![0]).toBe(0); // 无效字符串被设置为0
      expect(result.captureChannels[0].samples![1]).toBe(0);
    });

    it('应该处理非常大的文件路径', async () => {
      const longPath = '/very/very/very/long/path/that/might/cause/issues/in/some/systems/file.lac';
      const captureSession = new CaptureSession();
      captureSession.captureChannels = [new AnalyzerChannel(0, 'CH0')];

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockResolvedValue(undefined);

      const result = await LACFileFormat.save(longPath, captureSession);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(longPath);
    });
  });

  describe('完整的读写循环测试', () => {
    
    it('应该支持完整的保存-加载循环', async () => {
      // 创建原始数据
      const originalSession = new CaptureSession();
      originalSession.frequency = 5000000;
      originalSession.preTriggerSamples = 250;
      originalSession.postTriggerSamples = 2750;
      originalSession.triggerType = TriggerType.Blast;
      originalSession.triggerChannel = 2;
      originalSession.triggerInverted = true;
      
      const channel1 = new AnalyzerChannel(0, 'SDA');
      channel1.channelColor = 0xFF0000;
      channel1.samples = new Uint8Array([1, 1, 0, 0, 1, 0, 1, 1]);
      
      const channel2 = new AnalyzerChannel(1, 'SCL');
      channel2.channelColor = 0x00FF00;
      channel2.samples = new Uint8Array([0, 1, 1, 0, 0, 1, 0, 1]);
      
      originalSession.captureChannels = [channel1, channel2];

      const selectedRegions = [
        {
          firstSample: 100,
          lastSample: 200,
          regionName: 'Critical Section',
          color: { r: 255, g: 255, b: 0, a: 180 }
        }
      ];

      // Mock保存操作
      let savedContent = '';
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.promises.mkdir.mockResolvedValue(undefined);
      mockedFs.promises.writeFile.mockImplementation(async (path, content) => {
        savedContent = content as string;
      });

      // 保存文件
      const saveResult = await LACFileFormat.save(
        '/test/roundtrip.lac', 
        originalSession, 
        selectedRegions, 
        true
      );

      expect(saveResult.success).toBe(true);
      expect(savedContent).toBeTruthy();

      // Mock加载操作
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.promises.readFile.mockResolvedValue(savedContent);

      // 加载文件
      const loadResult = await LACFileFormat.load('/test/roundtrip.lac');

      expect(loadResult.success).toBe(true);
      expect(loadResult.data).toBeDefined();

      // 转换回CaptureSession
      const reconstructedSession = LACFileFormat.convertToCaptureSession(loadResult.data!);

      // 验证数据完整性
      expect(reconstructedSession.frequency).toBe(originalSession.frequency);
      expect(reconstructedSession.preTriggerSamples).toBe(originalSession.preTriggerSamples);
      expect(reconstructedSession.postTriggerSamples).toBe(originalSession.postTriggerSamples);
      expect(reconstructedSession.triggerType).toBe(originalSession.triggerType);
      expect(reconstructedSession.triggerChannel).toBe(originalSession.triggerChannel);
      expect(reconstructedSession.triggerInverted).toBe(originalSession.triggerInverted);

      expect(reconstructedSession.captureChannels.length).toBe(2);
      expect(reconstructedSession.captureChannels[0].channelName).toBe('SDA');
      expect(reconstructedSession.captureChannels[0].channelColor).toBe(0xFF0000);
      expect(reconstructedSession.captureChannels[0].samples).toEqual(channel1.samples);
      expect(reconstructedSession.captureChannels[1].channelName).toBe('SCL');
      expect(reconstructedSession.captureChannels[1].samples).toEqual(channel2.samples);

      // 验证选择区域
      expect(loadResult.data!.SelectedRegions).toBeDefined();
      expect(loadResult.data!.SelectedRegions!.length).toBe(1);
      expect(loadResult.data!.SelectedRegions![0].RegionName).toBe('Critical Section');
    });
  });
});