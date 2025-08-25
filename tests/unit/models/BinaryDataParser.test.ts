/**
 * BinaryDataParser 模块单元测试套件
 * 全面测试二进制数据解析器的功能和性能
 */

import {
  BinaryDataParser,
  BinaryDataParserFactory,
  BinaryDataFormat,
  BinaryParserConfig,
  ChannelExtractionConfig,
  ParseResult
} from '../../../src/models/BinaryDataParser';
import {
  CaptureSession,
  AnalyzerChannel
} from '../../../src/models/CaptureModels';
import {
  CaptureMode
} from '../../../src/models/AnalyzerTypes';

describe('BinaryDataParser 模块测试套件', () => {
  
  describe('BinaryDataParser 基础功能测试', () => {
    let parser: BinaryDataParser;
    let session: CaptureSession;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
      session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 1000;
      session.captureChannels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
    });
    
    it('应该正确初始化默认配置', () => {
      const config = parser.getConfig();
      
      expect(config.format).toBe(BinaryDataFormat.Raw);
      expect(config.compressionThreshold).toBe(1024 * 1024);
      expect(config.enableOptimization).toBe(true);
      expect(config.chunkSize).toBe(64 * 1024);
      expect(config.enableValidation).toBe(true);
    });
    
    it('应该正确更新配置', () => {
      const newConfig: Partial<BinaryParserConfig> = {
        format: BinaryDataFormat.Compressed,
        enableOptimization: false,
        chunkSize: 32 * 1024
      };
      
      parser.updateConfig(newConfig);
      const updatedConfig = parser.getConfig();
      
      expect(updatedConfig.format).toBe(BinaryDataFormat.Compressed);
      expect(updatedConfig.enableOptimization).toBe(false);
      expect(updatedConfig.chunkSize).toBe(32 * 1024);
      // 其他配置应该保持不变
      expect(updatedConfig.compressionThreshold).toBe(1024 * 1024);
      expect(updatedConfig.enableValidation).toBe(true);
    });
    
    it('应该接受自定义配置初始化', () => {
      const customConfig: Partial<BinaryParserConfig> = {
        format: BinaryDataFormat.RLE,
        compressionThreshold: 2048,
        enableOptimization: false,
        chunkSize: 1024,
        enableValidation: false
      };
      
      const customParser = new BinaryDataParser(customConfig);
      const config = customParser.getConfig();
      
      expect(config.format).toBe(BinaryDataFormat.RLE);
      expect(config.compressionThreshold).toBe(2048);
      expect(config.enableOptimization).toBe(false);
      expect(config.chunkSize).toBe(1024);
      expect(config.enableValidation).toBe(false);
    });
  });
  
  describe('数据验证测试', () => {
    let parser: BinaryDataParser;
    let session: CaptureSession;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
      session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 10;
      session.postTriggerSamples = 100;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
    });
    
    it('应该拒绝过短的数据', async () => {
      const shortData = new Uint8Array([0x01, 0x02]); // 只有2字节，小于最小8字节
      
      const result = await parser.parseBinaryData(shortData, session, CaptureMode.Channels_8);
      
      expect(result.success).toBe(false);
      expect(result.warnings.some(w => w.includes('Data too short'))).toBe(true);
    });
    
    it('应该拒绝没有通道的会话', async () => {
      session.captureChannels = [];
      const data = new Uint8Array(100); // 足够长的数据
      
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_8);
      
      expect(result.success).toBe(false);
      expect(result.warnings.some(w => w.includes('No capture channels defined'))).toBe(true);
    });
    
    it('应该拒绝超出采集模式限制的通道', async () => {
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(10, 'CH10') // 超出Channels_8模式的限制
      ];
      
      const data = new Uint8Array(100);
      
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_8);
      
      expect(result.success).toBe(false);
      expect(result.warnings.some(w => w.includes('exceeds max supported channels'))).toBe(true);
    });
    
    it('应该对数据长度不足发出警告', async () => {
      const data = new Uint8Array(20); // 长度不足的数据
      
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_8);
      
      // 虽然解析失败，但应该产生警告
      expect(result.warnings.some(w => w.includes('less than expected'))).toBe(true);
    });
  });
  
  describe('二进制数据解析测试', () => {
    let parser: BinaryDataParser;
    let session: CaptureSession;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
      session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 0;
      session.postTriggerSamples = 10;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1'),
        new AnalyzerChannel(7, 'CH7')
      ];
    });
    
    it('应该正确解析8通道模式数据', async () => {
      // 构造测试数据：样本数量(4字节) + 样本数据(10字节) + 时间戳长度(1字节)
      const data = new Uint8Array(15);
      const view = new DataView(data.buffer);
      
      // 样本数量 = 10
      view.setUint32(0, 10, true);
      
      // 样本数据：10个字节，每个字节代表8个通道的状态
      const sampleBytes = [
        0b00000001, // CH0=1, 其他=0
        0b00000010, // CH1=1, 其他=0
        0b10000000, // CH7=1, 其他=0
        0b00000011, // CH0=1, CH1=1, 其他=0
        0b10000001, // CH0=1, CH7=1, 其他=0
        0b10000010, // CH1=1, CH7=1, 其他=0
        0b10000011, // CH0=1, CH1=1, CH7=1, 其他=0
        0b00000000, // 全部=0
        0b11111111, // 全部=1
        0b01010101  // 交替模式
      ];
      
      for (let i = 0; i < sampleBytes.length; i++) {
        view.setUint8(4 + i, sampleBytes[i]);
      }
      
      // 时间戳长度 = 0
      view.setUint8(14, 0);
      
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_8);
      
      expect(result.success).toBe(true);
      expect(result.channels).toHaveLength(3);
      expect(result.totalSamples).toBe(10);
      
      // 验证CH0的数据
      const ch0 = result.channels.find(ch => ch.channelNumber === 0);
      expect(ch0).toBeDefined();
      expect(ch0!.samples).toEqual(new Uint8Array([1, 0, 0, 1, 1, 0, 1, 0, 1, 1]));
      
      // 验证CH1的数据
      const ch1 = result.channels.find(ch => ch.channelNumber === 1);
      expect(ch1).toBeDefined();
      expect(ch1!.samples).toEqual(new Uint8Array([0, 1, 0, 1, 0, 1, 1, 0, 1, 0]));
      
      // 验证CH7的数据
      const ch7 = result.channels.find(ch => ch.channelNumber === 7);
      expect(ch7).toBeDefined();
      expect(ch7!.samples).toEqual(new Uint8Array([0, 0, 1, 0, 1, 1, 1, 0, 1, 0]));
    });
    
    it('应该正确解析16通道模式数据', async () => {
      // 16通道模式使用16位数据
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(8, 'CH8'),
        new AnalyzerChannel(15, 'CH15')
      ];
      
      const data = new Uint8Array(11); // 4字节样本数 + 6字节样本数据(3个16位样本) + 1字节时间戳长度
      const view = new DataView(data.buffer);
      
      view.setUint32(0, 3, true); // 3个样本
      
      // 样本数据 (16位, little endian)
      view.setUint16(4, 0b0000000100000001, true); // CH0=1, CH8=1
      view.setUint16(6, 0b1000000000000000, true); // CH15=1
      view.setUint16(8, 0b1000000100000001, true); // CH0=1, CH8=1, CH15=1
      
      view.setUint8(10, 0); // 时间戳长度
      
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_16);
      
      expect(result.success).toBe(true);
      expect(result.channels).toHaveLength(3);
      
      const ch0 = result.channels.find(ch => ch.channelNumber === 0);
      expect(ch0!.samples).toEqual(new Uint8Array([1, 0, 1]));
      
      const ch8 = result.channels.find(ch => ch.channelNumber === 8);
      expect(ch8!.samples).toEqual(new Uint8Array([1, 0, 1]));
      
      const ch15 = result.channels.find(ch => ch.channelNumber === 15);
      expect(ch15!.samples).toEqual(new Uint8Array([0, 1, 1]));
    });
    
    it('应该正确解析24通道模式数据', async () => {
      // 24通道模式使用32位数据
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(16, 'CH16'),
        new AnalyzerChannel(23, 'CH23')
      ];
      
      const data = new Uint8Array(13); // 4字节样本数 + 8字节样本数据(2个32位样本) + 1字节时间戳长度
      const view = new DataView(data.buffer);
      
      view.setUint32(0, 2, true); // 2个样本
      
      // 样本数据 (32位, little endian)
      // CH0=bit0=1, CH16=bit16=1: 0x00010001
      view.setUint32(4, 0x00010001, true); 
      // CH0=bit0=1, CH16=bit16=1, CH23=bit23=1: 0x00810001  
      view.setUint32(8, 0x00810001, true);
      
      view.setUint8(12, 0); // 时间戳长度
      
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_24);
      
      expect(result.success).toBe(true);
      expect(result.channels).toHaveLength(3);
      
      const ch0 = result.channels.find(ch => ch.channelNumber === 0);
      expect(ch0!.samples).toEqual(new Uint8Array([1, 1]));
      
      const ch16 = result.channels.find(ch => ch.channelNumber === 16);
      expect(ch16!.samples).toEqual(new Uint8Array([1, 1]));
      
      const ch23 = result.channels.find(ch => ch.channelNumber === 23);
      expect(ch23!.samples).toEqual(new Uint8Array([0, 1]));
    });
  });
  
  describe('数据压缩和优化测试', () => {
    let parser: BinaryDataParser;
    
    beforeEach(() => {
      parser = new BinaryDataParser({
        enableOptimization: true,
        compressionThreshold: 100 // 低阈值用于测试
      });
    });
    
    it('应该正确进行RLE压缩', () => {
      // 通过反射访问私有方法进行测试
      const testData = new Uint8Array([1, 1, 1, 0, 0, 1, 1, 1, 1]);
      const compressed = (parser as any).compressChannelData(testData);
      
      // RLE格式: [值, 计数, 值, 计数, ...]
      expect(compressed).toEqual(new Uint8Array([1, 3, 0, 2, 1, 4]));
    });
    
    it('应该正确进行RLE解压缩', () => {
      const compressedData = new Uint8Array([1, 3, 0, 2, 1, 4]);
      const decompressed = (parser as any).decompressChannelData(compressedData);
      
      expect(decompressed).toEqual(new Uint8Array([1, 1, 1, 0, 0, 1, 1, 1, 1]));
    });
    
    it('应该正确处理压缩边界情况', () => {
      // 测试最大计数255
      const longSequence = new Uint8Array(300).fill(1);
      const compressed = (parser as any).compressChannelData(longSequence);
      
      // 应该分成255 + 45的两段
      expect(compressed[0]).toBe(1); // 值
      expect(compressed[1]).toBe(255); // 最大计数
      expect(compressed[2]).toBe(1); // 值
      expect(compressed[3]).toBe(45); // 剩余计数
    });

    it('应该触发压缩优化条件覆盖294-295行', async () => {
      // 创建一个低压缩阈值的解析器
      const lowThresholdParser = new BinaryDataParser({
        enableOptimization: true,
        compressionThreshold: 50 // 低阈值以便触发压缩
      });

      const session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 0;
      session.postTriggerSamples = 100;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0')
      ];

      // 创建高重复性数据，100个样本，全部为相同值以获得高压缩率
      const data = new Uint8Array(105); // 4字节头 + 100字节数据 + 1字节时间戳长度
      const view = new DataView(data.buffer);
      
      view.setUint32(0, 100, true); // 100个样本
      
      // 填充重复数据 - 全部为0xFF以获得高压缩率
      for (let i = 0; i < 100; i++) {
        view.setUint8(4 + i, 0xFF);
      }
      
      view.setUint8(104, 0); // 时间戳长度
      
      const result = await lowThresholdParser.parseBinaryData(data, session, CaptureMode.Channels_8);
      
      expect(result.success).toBe(true);
      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].samples).toHaveLength(100);
      
      // 验证所有样本都是1（因为0xFF的bit 0是1）
      for (let i = 0; i < 100; i++) {
        expect(result.channels[0].samples![i]).toBe(1);
      }
    });
  });
  
  describe('高级通道提取测试', () => {
    let parser: BinaryDataParser;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
    });
    
    it('应该正确进行高级通道提取', () => {
      const sampleData = new Uint32Array([
        0b11111000, // 样本1: bit0=0, bit3=1  
        0b01100100, // 样本2: bit0=0, bit3=0
        0b10101000  // 样本3: bit0=0, bit3=1
      ]);
      
      const configs: ChannelExtractionConfig[] = [
        {
          channelMask: 0b00000001, // 提取bit 0
          bitOffset: 0,
          invertLogic: false,
          enableFiltering: false,
          filterWidth: 1
        },
        {
          channelMask: 0b00001000, // 提取bit 3
          bitOffset: 3,
          invertLogic: true, // 反转逻辑
          enableFiltering: false,
          filterWidth: 1
        }
      ];
      
      const results = parser.extractChannelsAdvanced(sampleData, configs);
      
      expect(results).toHaveLength(2);
      
      // 通道0 (bit 0): [0, 0, 0]
      expect(results[0]).toEqual(new Uint8Array([0, 0, 0]));
      
      // 通道1 (bit 3, 反转): 原始值[1, 0, 1] -> 反转后[0, 1, 0]
      expect(results[1]).toEqual(new Uint8Array([0, 1, 0]));
    });
    
    it('应该正确应用中值滤波', () => {
      const testData = new Uint8Array([0, 1, 0, 1, 0, 1, 0]);
      
      // 应用3点中值滤波
      (parser as any).applyMedianFilter(testData, 3);
      
      // 中值滤波应该平滑噪声
      expect(testData[0]).toBe(1); // 边界处理: 中值([0,1]) = 1
      expect(testData[1]).toBe(0); // 中值([0,0,1]) = 0
      expect(testData[2]).toBe(1); // 中值([0,1,1]) = 1
      expect(testData[3]).toBe(0); // 中值([0,0,1]) = 0
      expect(testData[4]).toBe(1); // 中值(1,0,1) = 1
      expect(testData[5]).toBe(0); // 中值(0,1,0) = 0
      expect(testData[6]).toBe(1); // 边界处理
    });

    it('应该在高级通道提取中正确应用滤波', () => {
      const sampleData = new Uint32Array([
        0b11111000, // 样本1: bit0=0, bit3=1  
        0b01100100, // 样本2: bit0=0, bit3=0
        0b10101000, // 样本3: bit0=0, bit3=1
        0b11111000, // 样本4: bit0=0, bit3=1
        0b01100100  // 样本5: bit0=0, bit3=0
      ]);
      
      const configs: ChannelExtractionConfig[] = [
        {
          channelMask: 0b00001000, // 提取bit 3
          bitOffset: 3,
          invertLogic: false,
          enableFiltering: true,    // 启用滤波来覆盖第432行
          filterWidth: 3            // 3点滤波
        }
      ];
      
      const results = parser.extractChannelsAdvanced(sampleData, configs);
      
      expect(results).toHaveLength(1);
      // 滤波后的结果应该被平滑处理
      expect(results[0]).toHaveLength(5);
    });
  });
  
  describe('数据完整性验证测试', () => {
    let parser: BinaryDataParser;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
    });
    
    it('应该验证完整的通道数据', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      channels[0].samples = new Uint8Array([0, 1, 0, 1]);
      channels[1].samples = new Uint8Array([1, 0, 1, 0]);
      
      const result = parser.validateDataIntegrity(channels);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.statistics.totalSamples).toBe(4);
      expect(result.statistics.channelsWithData).toBe(2);
    });
    
    it('应该检测缺少样本数据的通道', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      channels[0].samples = new Uint8Array([0, 1, 0, 1]);
      // channels[1].samples 未设置
      
      const result = parser.validateDataIntegrity(channels);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('has no sample data'))).toBe(true);
    });
    
    it('应该检测空样本数据', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0')
      ];
      
      channels[0].samples = new Uint8Array(); // 空数组
      
      const result = parser.validateDataIntegrity(channels);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('has empty sample data'))).toBe(true);
    });
    
    it('应该检测无效的样本值', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0')
      ];
      
      channels[0].samples = new Uint8Array([0, 1, 2, 1]); // 包含无效值2
      
      const result = parser.validateDataIntegrity(channels);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('has invalid value 2'))).toBe(true);
    });
    
    it('应该检测样本数量不一致', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      channels[0].samples = new Uint8Array([0, 1, 0, 1]);
      channels[1].samples = new Uint8Array([1, 0]); // 长度不一致
      
      const result = parser.validateDataIntegrity(channels);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('sample count') && e.includes('differs from expected'))).toBe(true);
    });
  });
  
  describe('统一数据格式转换测试', () => {
    let parser: BinaryDataParser;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
    });
    
    it('应该正确转换为统一数据格式', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      channels[0].samples = new Uint8Array([0, 1, 0]);
      channels[1].samples = new Uint8Array([1, 0, 1]);
      
      const session = new CaptureSession();
      const deviceInfo = { name: 'Test Device' };
      
      const result = parser.convertToUnifiedFormat(channels, session, deviceInfo);
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual(new Uint8Array([0, 1, 0]));
      expect(result.data[1]).toEqual(new Uint8Array([1, 0, 1]));
      expect(result.encoding).toBe('binary');
      expect(result.compression).toBe('none');
    });
    
    it('应该正确从统一数据格式转换', () => {
      const digitalData = {
        data: [
          new Uint8Array([0, 1, 0]),
          new Uint8Array([1, 0, 1])
        ],
        encoding: 'binary' as const,
        compression: 'none' as const
      };
      
      const channelInfo = [
        { channelNumber: 0, channelName: 'CH0' },
        { channelNumber: 1, channelName: 'CH1' }
      ];
      
      const channels = parser.convertFromUnifiedFormat(digitalData, channelInfo);
      
      expect(channels).toHaveLength(2);
      expect(channels[0].channelNumber).toBe(0);
      expect(channels[0].channelName).toBe('CH0');
      expect(channels[0].samples).toEqual(new Uint8Array([0, 1, 0]));
      expect(channels[1].channelNumber).toBe(1);
      expect(channels[1].channelName).toBe('CH1');
      expect(channels[1].samples).toEqual(new Uint8Array([1, 0, 1]));
    });
    
    it('应该正确处理RLE编码的统一数据格式', () => {
      const digitalData = {
        data: [
          new Uint8Array([1, 3, 0, 2]) // RLE: 3个1, 2个0
        ],
        encoding: 'rle' as const,
        compression: 'none' as const
      };
      
      const channelInfo = [
        { channelNumber: 0, channelName: 'CH0' }
      ];
      
      const channels = parser.convertFromUnifiedFormat(digitalData, channelInfo);
      
      expect(channels).toHaveLength(1);
      expect(channels[0].samples).toEqual(new Uint8Array([1, 1, 1, 0, 0]));
    });
  });
  
  describe('性能和内存测试', () => {
    let parser: BinaryDataParser;
    
    beforeEach(() => {
      parser = new BinaryDataParser();
    });
    
    it('应该正确计算内存使用量', () => {
      const channels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      channels[0].samples = new Uint8Array(1000);
      channels[1].samples = new Uint8Array(2000);
      
      const memoryUsage = (parser as any).calculateMemoryUsage(channels);
      
      // 3000字节样本数据 + 2 * 64字节对象开销 = 3128字节
      expect(memoryUsage).toBe(3128);
    });
    
    it('应该处理大数据量解析', async () => {
      const session = new CaptureSession();
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
      
      // 创建大数据集 (10000个样本)
      const sampleCount = 10000;
      const data = new Uint8Array(4 + sampleCount + 1);
      const view = new DataView(data.buffer);
      
      view.setUint32(0, sampleCount, true);
      
      // 填充随机样本数据
      for (let i = 0; i < sampleCount; i++) {
        view.setUint8(4 + i, Math.random() > 0.5 ? 0xFF : 0x00);
      }
      
      view.setUint8(4 + sampleCount, 0); // 时间戳长度
      
      const startTime = performance.now();
      const result = await parser.parseBinaryData(data, session, CaptureMode.Channels_8);
      const parseTime = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.totalSamples).toBe(sampleCount);
      expect(parseTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(result.parseTime).toBeGreaterThan(0);
      expect(result.memoryUsage).toBeGreaterThan(0);
    });
  });
});

describe('BinaryDataParserFactory 工厂类测试', () => {
  
  it('应该为Pico设备创建优化的解析器', () => {
    const parser = BinaryDataParserFactory.createForDevice('pico', 8);
    const config = parser.getConfig();
    
    expect(config.chunkSize).toBe(32 * 1024);
    expect(config.compressionThreshold).toBe(512 * 1024);
    expect(config.enableOptimization).toBe(true);
    expect(config.enableValidation).toBe(true);
  });
  
  it('应该为Saleae设备创建优化的解析器', () => {
    const parser = BinaryDataParserFactory.createForDevice('saleae', 16);
    const config = parser.getConfig();
    
    expect(config.chunkSize).toBe(128 * 1024);
    expect(config.compressionThreshold).toBe(2 * 1024 * 1024);
    expect(config.enableOptimization).toBe(true);
    expect(config.enableValidation).toBe(true);
  });
  
  it('应该为未知设备创建默认解析器', () => {
    const parser = BinaryDataParserFactory.createForDevice('unknown', 24);
    const config = parser.getConfig();
    
    expect(config.chunkSize).toBe(64 * 1024);
    expect(config.compressionThreshold).toBe(1024 * 1024);
    expect(config.enableOptimization).toBe(true);
    expect(config.enableValidation).toBe(true);
  });
  
  it('应该创建高性能解析器', () => {
    const parser = BinaryDataParserFactory.createHighPerformance();
    const config = parser.getConfig();
    
    expect(config.format).toBe(BinaryDataFormat.Raw);
    expect(config.enableOptimization).toBe(true);
    expect(config.enableValidation).toBe(false); // 关闭验证提升性能
    expect(config.chunkSize).toBe(256 * 1024);
    expect(config.compressionThreshold).toBe(10 * 1024 * 1024);
  });
  
  it('应该创建调试用解析器', () => {
    const parser = BinaryDataParserFactory.createDebug();
    const config = parser.getConfig();
    
    expect(config.format).toBe(BinaryDataFormat.Raw);
    expect(config.enableOptimization).toBe(false);
    expect(config.enableValidation).toBe(true);
    expect(config.chunkSize).toBe(4 * 1024); // 小块处理便于调试
    expect(config.compressionThreshold).toBe(64 * 1024);
  });
});

describe('BinaryDataFormat 枚举测试', () => {
  
  it('应该定义所有数据格式', () => {
    expect(BinaryDataFormat.Raw).toBe('raw');
    expect(BinaryDataFormat.Compressed).toBe('compressed');
    expect(BinaryDataFormat.RLE).toBe('rle');
    expect(BinaryDataFormat.Delta).toBe('delta');
  });
  
  it('枚举值应该是字符串类型', () => {
    Object.values(BinaryDataFormat).forEach(format => {
      expect(typeof format).toBe('string');
    });
  });
});

describe('错误处理和边界条件测试', () => {
  let parser: BinaryDataParser;
  
  beforeEach(() => {
    parser = new BinaryDataParser();
  });
  
  it('应该处理空样本数据的情况', () => {
    const channels: AnalyzerChannel[] = [];
    const memoryUsage = (parser as any).calculateMemoryUsage(channels);
    
    expect(memoryUsage).toBe(0);
  });
  
  it('应该处理通道没有样本数据的情况', () => {
    const channels = [new AnalyzerChannel(0, 'CH0')];
    // 不设置samples
    
    const memoryUsage = (parser as any).calculateMemoryUsage(channels);
    
    expect(memoryUsage).toBe(64); // 只有对象开销
  });
  
  it('应该处理RLE压缩的边界情况', () => {
    // 单一值
    const singleValue = new Uint8Array([1]);
    const compressed = (parser as any).compressChannelData(singleValue);
    expect(compressed).toEqual(new Uint8Array([1, 1]));
    
    // 空数组
    const empty = new Uint8Array([]);
    expect(() => (parser as any).compressChannelData(empty)).not.toThrow();
  });
  
  it('应该处理RLE解压缩的边界情况', () => {
    // 空数组
    const empty = new Uint8Array([]);
    const decompressed = (parser as any).decompressChannelData(empty);
    expect(decompressed).toEqual(new Uint8Array([]));
    
    // 奇数长度数组 (不完整的RLE对)
    const incomplete = new Uint8Array([1]); // 缺少计数
    expect(() => (parser as any).decompressChannelData(incomplete)).not.toThrow();
  });
  
  it('应该处理中值滤波的边界情况', () => {
    // 单个元素
    const single = new Uint8Array([1]);
    (parser as any).applyMedianFilter(single, 3);
    expect(single).toEqual(new Uint8Array([1]));
    
    // 空数组
    const empty = new Uint8Array([]);
    expect(() => (parser as any).applyMedianFilter(empty, 3)).not.toThrow();
    
    // 滤波器宽度为1
    const data = new Uint8Array([1, 0, 1]);
    const original = new Uint8Array(data);
    (parser as any).applyMedianFilter(data, 1);
    expect(data).toEqual(original); // 应该不变
  });

  it('应该处理非Error类型的异常', async () => {
    const session = new CaptureSession();
    session.frequency = 1000000;
    session.captureChannels = [new AnalyzerChannel(0, 'CH0')];
    
    // 创建一个解析器并模拟非Error类型的异常
    const testParser = new BinaryDataParser();
    
    // 通过修改原始方法来抛出非Error类型的异常
    const originalValidate = (testParser as any).validateRawData;
    (testParser as any).validateRawData = () => {
      throw 'This is a string error, not an Error object'; // 抛出字符串类型
    };
    
    const data = new Uint8Array(100);
    const result = await testParser.parseBinaryData(data, session, CaptureMode.Channels_8);
    
    expect(result.success).toBe(false);
    expect(result.warnings.some(w => w.includes('Parse error: Unknown error'))).toBe(true);
    
    // 恢复原始方法
    (testParser as any).validateRawData = originalValidate;
  });

  it('应该处理convertToUnifiedFormat中通道没有samples的情况', () => {
    const channels = [
      new AnalyzerChannel(0, 'CH0'),
      new AnalyzerChannel(1, 'CH1')
    ];
    
    // 第一个通道有samples，第二个通道没有samples
    channels[0].samples = new Uint8Array([0, 1, 0]);
    // channels[1].samples 保留为undefined
    
    const session = new CaptureSession();
    const deviceInfo = { name: 'Test Device' };
    
    const result = parser.convertToUnifiedFormat(channels, session, deviceInfo);
    
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual(new Uint8Array([0, 1, 0]));
    expect(result.data[1]).toEqual(new Uint8Array()); // 应该是空的Uint8Array
    expect(result.encoding).toBe('binary');
    expect(result.compression).toBe('none');
  });
});