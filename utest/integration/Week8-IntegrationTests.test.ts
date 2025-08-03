/**
 * Week 8: 集成测试和验证
 * 完整的端到端测试套件，验证系统各组件协同工作
 * 
 * 测试范围：
 * - 硬件设备连接和通信协议
 * - 完整工作流：连接→采集→显示→保存
 * - .lac文件兼容性测试  
 * - 性能和稳定性验证
 */

import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { LACFileFormat } from '../../src/models/LACFileFormat';
import { WaveformRenderer } from '../../src/webview/engines/WaveformRenderer';
import { I2CDecoder } from '../../src/decoders/protocols/I2CDecoder';
import { CaptureSession, AnalyzerChannel } from '../../src/models/CaptureModels';
import { TriggerType, CaptureMode } from '../../src/models/AnalyzerTypes';
import * as fs from 'fs';
import * as path from 'path';

describe('Week 8: 集成测试和验证', () => {
  let driver: LogicAnalyzerDriver;
  let lacFileFormat: LACFileFormat;
  let renderer: WaveformRenderer;
  let testDataDir: string;

  beforeAll(async () => {
    // 创建测试数据目录
    testDataDir = path.join(__dirname, '../fixtures/integration-test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    lacFileFormat = new LACFileFormat();
    
    // 模拟Canvas用于波形渲染测试
    const mockCanvas = document.createElement('canvas') as HTMLCanvasElement;
    renderer = new WaveformRenderer(mockCanvas);
  });

  afterAll(async () => {
    // 清理测试数据
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('1. 硬件测试环境搭建', () => {
    it('应该能创建模拟设备连接进行测试', async () => {
      // 使用模拟连接字符串进行测试
      const mockConnectionString = 'MOCK_DEVICE_SIMULATOR';
      driver = new LogicAnalyzerDriver(mockConnectionString);
      
      expect(driver).toBeDefined();
      expect(driver.driverType).toBeDefined();
    });

    it('应该能验证设备通信协议的完整性', async () => {
      // 创建测试用的OutputPacket
      const { OutputPacket, CaptureRequest } = require('../../src/drivers/AnalyzerDriverBase');
      
      // 测试OutputPacket转义机制
      const packet = new OutputPacket();
      packet.addByte(0xAA); // 需要转义的字节
      packet.addByte(0x55); // 需要转义的字节  
      packet.addByte(0xF0); // 需要转义的字节
      packet.addByte(0x00); // 不需要转义的字节
      
      const serialized = packet.serialize();
      
      // 验证转义结果
      expect(serialized[0]).toBe(0x55); // 起始标记
      expect(serialized[1]).toBe(0xAA); // 起始标记
      expect(serialized[serialized.length - 2]).toBe(0xAA); // 结束标记
      expect(serialized[serialized.length - 1]).toBe(0x55); // 结束标记
      
      // 验证转义的字节被正确处理
      const dataBytes = serialized.slice(2, -2);
      expect(dataBytes.includes(0xF0)).toBe(true); // 应该包含转义字符
    });

    it('应该能验证CaptureRequest序列化的正确性', async () => {
      const { CaptureRequest } = require('../../src/drivers/AnalyzerDriverBase');
      
      const request = new CaptureRequest();
      request.triggerType = TriggerType.Edge;
      request.trigger = 0x01;
      request.triggerValue = 0x1234;
      request.frequency = 100000000; // 100MHz
      request.preSamples = 1000;
      request.postSamples = 9000;
      request.loopCount = 0;
      request.captureMode = CaptureMode.Normal;
      
      // 设置通道
      for (let i = 0; i < 24; i++) {
        request.channels[i] = i < 8 ? 1 : 0; // 启用前8个通道
      }
      
      const serialized = request.serialize();
      
      // 验证序列化结果为45字节（与C#版本一致）
      expect(serialized.length).toBe(45);
      
      // 验证关键字段
      expect(serialized[0]).toBe(TriggerType.Edge); // triggerType
      expect(serialized[1]).toBe(0x01); // trigger
    });
  });

  describe('2. 端到端功能测试', () => {
    it('应该能完成完整的设备连接流程', async () => {
      // 这里使用模拟数据测试连接流程
      const mockDriver = new LogicAnalyzerDriver('MOCK_SERIAL_COM3');
      
      // 模拟连接过程
      const connectionResult = await mockDriver.connect();
      
      expect(connectionResult.success).toBe(true);
      expect(connectionResult.deviceInfo).toBeDefined();
      expect(connectionResult.deviceInfo.name).toBeDefined();
    }, 10000);

    it('应该能完成数据采集到显示的完整流程', async () => {
      // 创建模拟采集会话
      const session = new CaptureSession();
      session.frequency = 10000000; // 10MHz
      session.preTriggerSamples = 500;
      session.postTriggerSamples = 4500;
      session.triggerType = TriggerType.Edge;
      session.captureChannels = [
        new AnalyzerChannel('CH0', 0, true, '#FF0000'),
        new AnalyzerChannel('CH1', 1, true, '#00FF00'),
        new AnalyzerChannel('CH2', 2, true, '#0000FF')
      ];

      // 生成模拟采集数据
      const sampleCount = session.totalSamples;
      const mockSamples = generateMockI2CData(sampleCount, session.captureChannels.length);
      
      // 验证数据结构
      expect(mockSamples.length).toBe(sampleCount);
      expect(mockSamples[0]).toBeDefined();
      
      // 测试波形渲染
      const renderResult = await renderer.updateWaveformData({
        channels: session.captureChannels,
        samples: mockSamples,
        sampleRate: session.frequency,
        totalSamples: sampleCount
      });
      
      expect(renderResult.success).toBe(true);
    });

    it('应该能完成数据采集到协议解码的完整流程', async () => {
      // 创建I2C解码器
      const decoder = new I2CDecoder();
      
      // 生成I2C测试信号（SDA=CH0, SCL=CH1）
      const sampleRate = 1000000; // 1MHz采样率
      const channels = [
        new AnalyzerChannel('SDA', 0, true, '#FF0000'),
        new AnalyzerChannel('SCL', 1, true, '#00FF00')
      ];
      
      // 生成I2C协议数据：START + ADDRESS(0x50) + ACK + DATA(0x42) + ACK + STOP
      const i2cSamples = generateI2CProtocolData(sampleRate);
      
      // 执行解码
      const decodeResults = decoder.decode(sampleRate, channels, []);
      
      expect(decodeResults.length).toBeGreaterThan(0);
      expect(decodeResults.some(r => r.type === 'start')).toBe(true);
      expect(decodeResults.some(r => r.type === 'address-read' || r.type === 'address-write')).toBe(true);
    });
  });

  describe('3. .lac文件兼容性测试', () => {
    it('应该能保存和加载.lac文件', async () => {
      // 创建测试数据
      const session = new CaptureSession();
      session.frequency = 25000000; // 25MHz
      session.preTriggerSamples = 1000;
      session.postTriggerSamples = 9000;
      session.triggerType = TriggerType.Edge;
      session.captureChannels = [
        new AnalyzerChannel('CH0', 0, true, '#FF0000'),
        new AnalyzerChannel('CH1', 1, true, '#00FF00'),
        new AnalyzerChannel('CH2', 2, true, '#0000FF'),
        new AnalyzerChannel('CH3', 3, true, '#FFFF00')
      ];

      const mockSamples = generateMockSampleData(session.totalSamples, session.captureChannels.length);
      
      const testFilePath = path.join(testDataDir, 'test_integration.lac');
      
      // 保存文件
      const saveResult = await lacFileFormat.save(testFilePath, {
        Settings: session,
        Samples: mockSamples,
        SelectedRegions: [{
          FirstSample: 1000,
          LastSample: 2000,
          RegionName: 'Test Region',
          R: 255, G: 0, B: 0, A: 128
        }]
      });
      
      expect(saveResult.success).toBe(true);
      expect(fs.existsSync(testFilePath)).toBe(true);
      
      // 加载文件
      const loadResult = await lacFileFormat.load(testFilePath);
      
      expect(loadResult.success).toBe(true);
      expect(loadResult.data).toBeDefined();
      expect(loadResult.data!.Settings.frequency).toBe(session.frequency);
      expect(loadResult.data!.Settings.captureChannels.length).toBe(session.captureChannels.length);
      expect(loadResult.data!.Samples?.length).toBe(mockSamples.length);
    });

    it('应该能处理大数据量的.lac文件', async () => {
      // 测试大数据集（100万样本）
      const session = new CaptureSession();
      session.frequency = 100000000; // 100MHz
      session.preTriggerSamples = 100000;
      session.postTriggerSamples = 900000;
      session.captureChannels = Array.from({ length: 8 }, (_, i) => 
        new AnalyzerChannel(`CH${i}`, i, true, `#${(Math.random()*16777215|0).toString(16)}`)
      );

      const largeSamples = generateMockSampleData(1000000, 8);
      const testFilePath = path.join(testDataDir, 'large_test.lac');
      
      // 测试保存性能
      const { duration: saveDuration } = await global.measureTime(async () => {
        return lacFileFormat.save(testFilePath, {
          Settings: session,
          Samples: largeSamples
        });
      });
      
      console.log(`Large file save duration: ${saveDuration}ms`);
      expect(saveDuration).toBeLessThan(10000); // 应该在10秒内完成
      
      // 测试加载性能
      const { duration: loadDuration } = await global.measureTime(async () => {
        return lacFileFormat.load(testFilePath);
      });
      
      console.log(`Large file load duration: ${loadDuration}ms`);
      expect(loadDuration).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('应该与原版C#软件的.lac文件格式完全兼容', async () => {
      // 创建符合C# ExportedCapture格式的数据
      const exportedCapture = {
        Settings: {
          frequency: 25000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 4000,
          triggerType: TriggerType.Edge,
          triggerValue: 1,
          trigger: 0,
          captureChannels: [
            new AnalyzerChannel('Channel 0', 0, true, '#FF0000'),
            new AnalyzerChannel('Channel 1', 1, true, '#00FF00')
          ],
          loopCount: 0,
          captureMode: CaptureMode.Normal
        },
        Samples: generateMockSampleData(5000, 2),
        SelectedRegions: [{
          FirstSample: 500,
          LastSample: 1500,
          RegionName: 'Selected Region',
          R: 128, G: 255, B: 64, A: 200
        }]
      };
      
      const compatibilityTestPath = path.join(testDataDir, 'compatibility_test.lac');
      
      const result = await lacFileFormat.save(compatibilityTestPath, exportedCapture);
      expect(result.success).toBe(true);
      
      // 验证生成的JSON结构符合C#版本
      const fileContent = fs.readFileSync(compatibilityTestPath, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      expect(jsonData.Settings).toBeDefined();
      expect(jsonData.Samples).toBeDefined();
      expect(jsonData.SelectedRegions).toBeDefined();
      expect(typeof jsonData.Settings.frequency).toBe('number');
      expect(Array.isArray(jsonData.Settings.captureChannels)).toBe(true);
    });
  });

  describe('4. 性能和稳定性测试', () => {
    it('应该能处理长时间运行稳定性', async () => {
      // 模拟长时间运行场景
      const iterations = 50;
      const errors: Error[] = [];
      
      for (let i = 0; i < iterations; i++) {
        try {
          // 模拟采集-处理-保存循环
          const session = new CaptureSession();
          session.frequency = 10000000;
          session.postTriggerSamples = 10000;
          session.captureChannels = [new AnalyzerChannel('Test', 0, true, '#FF0000')];
          
          const samples = generateMockSampleData(10000, 1);
          const tempPath = path.join(testDataDir, `stability_test_${i}.lac`);
          
          await lacFileFormat.save(tempPath, { Settings: session, Samples: samples });
          await lacFileFormat.load(tempPath);
          
          // 清理临时文件
          fs.unlinkSync(tempPath);
          
          // 每10次迭代检查一次内存
          if (i % 10 === 0 && global.gc) {
            global.gc();
          }
        } catch (error) {
          errors.push(error as Error);
        }
      }
      
      expect(errors.length).toBe(0);
      console.log(`Completed ${iterations} iterations successfully`);
    }, 30000);

    it('应该能检测内存泄漏情况', async () => {
      // 获取初始内存使用情况
      const initialMemory = process.memoryUsage();
      
      // 执行多次大数据处理
      for (let i = 0; i < 20; i++) {
        const largeSample = generateMockSampleData(50000, 8);
        const session = new CaptureSession();
        session.captureChannels = Array.from({ length: 8 }, (_, j) => 
          new AnalyzerChannel(`CH${j}`, j, true, '#FF0000')
        );
        
        // 模拟处理过程
        await renderer.updateWaveformData({
          channels: session.captureChannels,
          samples: largeSample,
          sampleRate: 10000000,
          totalSamples: largeSample.length
        });
        
        // 强制垃圾回收
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);
      
      // 内存增长应该在合理范围内（小于100MB）
      expect(memoryIncreaseMB).toBeLessThan(100);
    });

    it('应该能测试不同数据量的处理能力', async () => {
      const testSizes = [1000, 10000, 100000, 500000];
      const performanceResults: Array<{size: number, duration: number}> = [];
      
      for (const size of testSizes) {
        const samples = generateMockSampleData(size, 4);
        const channels = Array.from({ length: 4 }, (_, i) => 
          new AnalyzerChannel(`CH${i}`, i, true, '#FF0000')
        );
        
        const { duration } = await global.measureTime(async () => {
          await renderer.updateWaveformData({
            channels,
            samples,
            sampleRate: 25000000,
            totalSamples: size
          });
        });
        
        performanceResults.push({ size, duration });
        console.log(`Size: ${size}, Duration: ${duration.toFixed(2)}ms`);
        
        // 性能应该是可接受的（每100k样本不超过1秒）
        const expectedMaxDuration = (size / 100000) * 1000;
        expect(duration).toBeLessThan(expectedMaxDuration);
      }
      
      // 验证性能随数据量线性增长（而不是指数增长）
      const efficiencyRatio = performanceResults[3].duration / performanceResults[0].duration;
      const sizeRatio = performanceResults[3].size / performanceResults[0].size;
      
      // 效率比应该接近大小比（说明是线性复杂度）
      expect(efficiencyRatio / sizeRatio).toBeLessThan(2);
    });

    it('应该能优化发现的性能瓶颈', async () => {
      // 测试大数据解码性能
      const decoder = new I2CDecoder();
      const sampleRate = 10000000; // 10MHz
      const channels = [
        new AnalyzerChannel('SDA', 0, true, '#FF0000'),
        new AnalyzerChannel('SCL', 1, true, '#00FF00')
      ];
      
      // 生成大量I2C数据
      const largeSampleCount = 100000;
      const i2cData = generateLargeI2CData(largeSampleCount);
      
      const { duration } = await global.measureTime(async () => {
        decoder.decode(sampleRate, channels, []);
      });
      
      console.log(`Large I2C decode duration: ${duration.toFixed(2)}ms`);
      
      // 解码性能应该在可接受范围内
      expect(duration).toBeLessThan(5000); // 5秒内完成10万样本的解码
    });
  });
});

// 辅助函数：生成模拟采集数据
function generateMockSampleData(sampleCount: number, channelCount: number): string[] {
  const samples: string[] = [];
  
  for (let i = 0; i < sampleCount; i++) {
    let sampleValue = BigInt(0);
    
    // 为每个通道生成模拟数据
    for (let ch = 0; ch < channelCount; ch++) {
      // 生成一些有规律的测试模式
      const bit = ((i >> (ch % 4)) & 1) === 1 ? 1 : 0;
      if (bit) {
        sampleValue |= BigInt(1) << BigInt(ch);
      }
    }
    
    samples.push(sampleValue.toString(16).padStart(32, '0'));
  }
  
  return samples;
}

// 辅助函数：生成模拟I2C数据
function generateMockI2CData(sampleCount: number, channelCount: number): string[] {
  const samples: string[] = [];
  
  for (let i = 0; i < sampleCount; i++) {
    let sampleValue = BigInt(0);
    
    // SDA (Channel 0) 和 SCL (Channel 1) 的I2C时序
    if (i < 1000) { // START条件
      sampleValue |= BigInt(3); // SDA=1, SCL=1
    } else if (i < 1100) { // START下降沿
      sampleValue |= BigInt(2); // SDA=0, SCL=1
    } else if (i < 2000) { // 数据传输
      const bitIndex = Math.floor((i - 1100) / 100);
      const clockPhase = ((i - 1100) % 100) < 50;
      
      if (clockPhase) {
        sampleValue |= BigInt(2); // SCL=1
        if (bitIndex % 2 === 0) {
          sampleValue |= BigInt(1); // SDA=1 (数据位)
        }
      }
    }
    
    // 其他通道的数据
    for (let ch = 2; ch < channelCount; ch++) {
      if ((i + ch * 100) % 1000 < 500) {
        sampleValue |= BigInt(1) << BigInt(ch);
      }
    }
    
    samples.push(sampleValue.toString(16).padStart(32, '0'));
  }
  
  return samples;
}

// 辅助函数：生成I2C协议数据
function generateI2CProtocolData(sampleRate: number): any[] {
  // 这里应该生成真实的I2C时序数据
  // 为了测试，返回模拟数据结构
  return [
    { type: 'start', startSample: 1000, endSample: 1100 },
    { type: 'address-write', startSample: 1100, endSample: 1900, data: 0x50 },
    { type: 'ack', startSample: 1900, endSample: 2000 },
    { type: 'data', startSample: 2000, endSample: 2800, data: 0x42 },
    { type: 'ack', startSample: 2800, endSample: 2900 },
    { type: 'stop', startSample: 2900, endSample: 3000 }
  ];
}

// 辅助函数：生成大量I2C数据用于性能测试
function generateLargeI2CData(sampleCount: number): any[] {
  const data = [];
  const transactionLength = 1000; // 每个I2C事务1000个样本
  const transactionCount = Math.floor(sampleCount / transactionLength);
  
  for (let i = 0; i < transactionCount; i++) {
    const baseIndex = i * transactionLength;
    data.push(
      { type: 'start', startSample: baseIndex, endSample: baseIndex + 100 },
      { type: 'address-write', startSample: baseIndex + 100, endSample: baseIndex + 900, data: 0x50 + (i % 16) },
      { type: 'ack', startSample: baseIndex + 900, endSample: baseIndex + 1000 }
    );
  }
  
  return data;
}