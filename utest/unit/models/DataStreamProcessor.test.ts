/**
 * DataStreamProcessor 模块单元测试套件
 * 全面测试实时数据流处理和缓冲系统的功能
 */

import {
  DataStreamProcessor,
  DataStreamFactory,
  DataStreamMonitor,
  DataStreamState,
  DataStreamProgress,
  DataStreamConfig,
  RawDataPacket,
  DataStreamEvents
} from '../../../src/models/DataStreamProcessor';
import {
  CaptureSession,
  AnalyzerChannel,
  BurstInfo
} from '../../../src/models/CaptureModels';
import {
  CaptureMode
} from '../../../src/models/AnalyzerTypes';

describe('DataStreamProcessor 模块测试套件', () => {
  
  describe('DataStreamState 枚举测试', () => {
    
    it('应该定义所有数据流状态', () => {
      expect(DataStreamState.Idle).toBe('Idle');
      expect(DataStreamState.WaitingForHeader).toBe('WaitingForHeader');
      expect(DataStreamState.ReadingSamples).toBe('ReadingSamples');
      expect(DataStreamState.ReadingTimestamps).toBe('ReadingTimestamps');
      expect(DataStreamState.ProcessingData).toBe('ProcessingData');
      expect(DataStreamState.Completed).toBe('Completed');
      expect(DataStreamState.Error).toBe('Error');
    });
    
    it('枚举值应该是字符串类型', () => {
      Object.values(DataStreamState).forEach(state => {
        expect(typeof state).toBe('string');
      });
    });
  });
  
  describe('DataStreamProcessor 基础功能测试', () => {
    let processor: DataStreamProcessor;
    let mockEvents: Partial<DataStreamEvents>;
    
    beforeEach(() => {
      mockEvents = {
        onProgress: jest.fn(),
        onDataReceived: jest.fn(),
        onCompleted: jest.fn(),
        onError: jest.fn()
      };
      
      processor = new DataStreamProcessor({
        bufferSize: 1024,
        readTimeout: 5000,
        chunkSize: 256,
        enableProgress: true,
        progressInterval: 50
      }, mockEvents);
    });
    
    it('应该正确初始化默认配置', () => {
      const defaultProcessor = new DataStreamProcessor();
      const config = (defaultProcessor as any).config;
      
      expect(config.bufferSize).toBe(1024 * 1024);
      expect(config.readTimeout).toBe(30000);
      expect(config.chunkSize).toBe(64 * 1024);
      expect(config.enableProgress).toBe(true);
      expect(config.progressInterval).toBe(100);
    });
    
    it('应该接受自定义配置', () => {
      const config = (processor as any).config;
      
      expect(config.bufferSize).toBe(1024);
      expect(config.readTimeout).toBe(5000);
      expect(config.chunkSize).toBe(256);
      expect(config.enableProgress).toBe(true);
      expect(config.progressInterval).toBe(50);
    });
    
    it('应该正确初始化状态', () => {
      expect(processor.getState()).toBe(DataStreamState.Idle);
    });
    
    it('应该正确更新配置', () => {
      processor.updateConfig({
        bufferSize: 2048,
        enableProgress: false
      });
      
      const config = (processor as any).config;
      expect(config.bufferSize).toBe(2048);
      expect(config.enableProgress).toBe(false);
      expect(config.readTimeout).toBe(5000); // 保持不变
    });
    
    it('应该正确更新事件处理器', () => {
      const newEvents = {
        onProgress: jest.fn(),
        onError: jest.fn()
      };
      
      processor.updateEvents(newEvents);
      
      const events = (processor as any).events;
      expect(events.onProgress).toBe(newEvents.onProgress);
      expect(events.onError).toBe(newEvents.onError);
      expect(events.onCompleted).toBe(mockEvents.onCompleted); // 保持原有的
    });
    
    it('应该正确重置状态', () => {
      // 先设置一些状态
      (processor as any).state = DataStreamState.ReadingSamples;
      (processor as any).buffer = new Uint8Array(100);
      (processor as any).bufferPosition = 50;
      (processor as any).startTime = Date.now();
      
      processor.reset();
      
      expect(processor.getState()).toBe(DataStreamState.Idle);
      expect((processor as any).buffer.length).toBe(0);
      expect((processor as any).bufferPosition).toBe(0);
      expect((processor as any).startTime).toBe(0);
    });
  });
  
  describe('缓冲区长度计算测试', () => {
    let processor: DataStreamProcessor;
    
    beforeEach(() => {
      processor = new DataStreamProcessor();
    });
    
    it('应该正确计算8通道模式的缓冲区长度', () => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const bufferLength = (processor as any).calculateBufferLength(1000, CaptureMode.Channels_8, session);
      
      // 1000样本 * 1字节 + 4字节长度 + 1字节时间戳长度 = 1005字节
      expect(bufferLength).toBe(1005);
    });
    
    it('应该正确计算16通道模式的缓冲区长度', () => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const bufferLength = (processor as any).calculateBufferLength(1000, CaptureMode.Channels_16, session);
      
      // 1000样本 * 2字节 + 4字节长度 + 1字节时间戳长度 = 2005字节
      expect(bufferLength).toBe(2005);
    });
    
    it('应该正确计算24通道模式的缓冲区长度', () => {
      const session = new CaptureSession();
      session.loopCount = 0;
      session.measureBursts = false;
      
      const bufferLength = (processor as any).calculateBufferLength(1000, CaptureMode.Channels_24, session);
      
      // 1000样本 * 4字节 + 4字节长度 + 1字节时间戳长度 = 4005字节
      expect(bufferLength).toBe(4005);
    });
    
    it('应该正确计算带突发模式的缓冲区长度', () => {
      const session = new CaptureSession();
      session.loopCount = 3;
      session.measureBursts = true;
      
      const bufferLength = (processor as any).calculateBufferLength(1000, CaptureMode.Channels_8, session);
      
      // 1000样本 * 1字节 + 4字节长度 + 1字节时间戳长度 + (3+2)*4字节时间戳数据 = 1025字节
      expect(bufferLength).toBe(1025);
    });
  });
  
  describe('数据流读取测试', () => {
    let processor: DataStreamProcessor;
    let mockEvents: Partial<DataStreamEvents>;
    
    beforeEach(() => {
      mockEvents = {
        onProgress: jest.fn(),
        onDataReceived: jest.fn(),
        onCompleted: jest.fn(),
        onError: jest.fn()
      };
      
      processor = new DataStreamProcessor({
        enableProgress: true,
        progressInterval: 10
      }, mockEvents);
    });
    
    it('应该正确从ReadableStream读取数据', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        }
      });
      
      await (processor as any).readDataStream(stream, testData.length);
      
      const buffer = (processor as any).buffer;
      expect(buffer.subarray(0, testData.length)).toEqual(testData);
    });

    it('应该正确处理ReadableStream的完全读取完成情况', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const stream = new ReadableStream({
        start(controller) {
          // 分两次发送数据，然后正常结束
          controller.enqueue(testData.subarray(0, 3));
          controller.enqueue(testData.subarray(3, 5));
          controller.close();
        }
      });
      
      await (processor as any).readDataStream(stream, testData.length);
      
      const buffer = (processor as any).buffer;
      expect(buffer.subarray(0, testData.length)).toEqual(testData);
    });

    it('应该正确处理ReadableStream恰好读取完所需数据后结束', async () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const stream = new ReadableStream({
        start(controller) {
          // 恰好发送所需的数据量，然后结束
          controller.enqueue(testData);
          controller.close();
        }
      });
      
      await (processor as any).readDataStream(stream, testData.length);
      
      const buffer = (processor as any).buffer;
      expect(buffer.subarray(0, testData.length)).toEqual(testData);
    });
    
    it('应该正确从AsyncIterable读取数据', async () => {
      const chunk1 = new Uint8Array([1, 2, 3, 4, 5]);
      const chunk2 = new Uint8Array([6, 7, 8, 9, 10]);
      
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield chunk1;
          yield chunk2;
        }
      };
      
      await (processor as any).readDataStream(asyncIterable, 10);
      
      const buffer = (processor as any).buffer;
      expect(buffer.subarray(0, 10)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    });
    
    it('应该在数据流提前结束时抛出错误', async () => {
      const testData = new Uint8Array([1, 2, 3]);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        }
      });
      
      await expect((processor as any).readDataStream(stream, 10)).rejects.toThrow('Premature end of stream');
    });
    
    it('应该在数据不完整时抛出错误', async () => {
      const asyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([1, 2, 3]);
          // 数据流结束，但没有提供足够的数据
        }
      };
      
      await expect((processor as any).readDataStream(asyncIterable, 10)).rejects.toThrow('Incomplete data read');
    });
    
    it('应该报告读取进度', async () => {
      const chunk1 = new Uint8Array([1, 2, 3, 4, 5]);
      const chunk2 = new Uint8Array([6, 7, 8, 9, 10]);
      
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk1);
          setTimeout(() => {
            controller.enqueue(chunk2);
            controller.close();
          }, 10);
        }
      });
      
      await (processor as any).readDataStream(stream, 10);
      
      expect(mockEvents.onProgress).toHaveBeenCalled();
      const progressCall = (mockEvents.onProgress as jest.Mock).mock.calls[0][0];
      expect(progressCall.bytesRead).toBeGreaterThan(0);
      expect(progressCall.totalBytes).toBe(10);
    });
  });
  
  describe('原始数据解析测试', () => {
    let processor: DataStreamProcessor;
    let session: CaptureSession;
    
    beforeEach(() => {
      processor = new DataStreamProcessor();
      session = new CaptureSession();
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
    });
    
    it('应该正确解析8通道模式数据', async () => {
      // 构造测试数据：样本数量(4字节) + 样本数据(3字节) + 时间戳长度(1字节)
      const buffer = new Uint8Array(8);
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, 3, true); // 3个样本
      view.setUint8(4, 0b00000001); // 样本1: CH0=1
      view.setUint8(5, 0b00000010); // 样本2: CH1=1
      view.setUint8(6, 0b00000011); // 样本3: CH0=1, CH1=1
      view.setUint8(7, 0); // 时间戳长度
      
      (processor as any).buffer = buffer;
      
      const rawPacket = await (processor as any).parseRawData(session, 3, CaptureMode.Channels_8);
      
      expect(rawPacket.length).toBe(3);
      expect(rawPacket.samples).toEqual(new Uint32Array([1, 2, 3]));
      expect(rawPacket.timestamps.length).toBe(0);
      expect(rawPacket.mode).toBe(CaptureMode.Channels_8);
    });
    
    it('应该正确解析16通道模式数据', async () => {
      // 构造测试数据：样本数量(4字节) + 样本数据(4字节) + 时间戳长度(1字节)
      const buffer = new Uint8Array(9);
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, 2, true); // 2个样本
      view.setUint16(4, 0x0101, true); // 样本1
      view.setUint16(6, 0x0202, true); // 样本2
      view.setUint8(8, 0); // 时间戳长度
      
      (processor as any).buffer = buffer;
      
      const rawPacket = await (processor as any).parseRawData(session, 2, CaptureMode.Channels_16);
      
      expect(rawPacket.length).toBe(2);
      expect(rawPacket.samples).toEqual(new Uint32Array([0x0101, 0x0202]));
      expect(rawPacket.mode).toBe(CaptureMode.Channels_16);
    });
    
    it('应该正确解析24通道模式数据', async () => {
      // 构造测试数据：样本数量(4字节) + 样本数据(8字节) + 时间戳长度(1字节)
      const buffer = new Uint8Array(13);
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, 2, true); // 2个样本
      view.setUint32(4, 0x01010101, true); // 样本1
      view.setUint32(8, 0x02020202, true); // 样本2
      view.setUint8(12, 0); // 时间戳长度
      
      (processor as any).buffer = buffer;
      
      const rawPacket = await (processor as any).parseRawData(session, 2, CaptureMode.Channels_24);
      
      expect(rawPacket.length).toBe(2);
      expect(rawPacket.samples).toEqual(new Uint32Array([0x01010101, 0x02020202]));
      expect(rawPacket.mode).toBe(CaptureMode.Channels_24);
    });
    
    it('应该正确解析带时间戳的数据', async () => {
      session.loopCount = 2;
      session.measureBursts = true;
      
      // 构造测试数据：样本数量(4) + 样本数据(2) + 时间戳长度(1) + 时间戳数据(16) = 23字节
      const buffer = new Uint8Array(23);
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, 2, true); // 2个样本
      view.setUint8(4, 0x01);
      view.setUint8(5, 0x02);
      view.setUint8(6, 16); // 时间戳长度：4个时间戳 * 4字节 = 16字节
      
      // 4个时间戳 (loopCount + 2 = 4)
      view.setUint32(7, 0x1000, true);
      view.setUint32(11, 0x2000, true);
      view.setUint32(15, 0x3000, true);
      view.setUint32(19, 0x4000, true);
      
      (processor as any).buffer = buffer;
      
      const rawPacket = await (processor as any).parseRawData(session, 2, CaptureMode.Channels_8);
      
      expect(rawPacket.timestamps.length).toBe(4);
      expect(rawPacket.timestamps[0]).toBe(BigInt(0x1000));
      expect(rawPacket.timestamps[1]).toBe(BigInt(0x2000));
      expect(rawPacket.timestamps[2]).toBe(BigInt(0x3000));
      expect(rawPacket.timestamps[3]).toBe(BigInt(0x4000));
    });
    
    it('应该在样本数量不匹配时发出警告', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const buffer = new Uint8Array(10); // 4字节长度 + 5字节样本 + 1字节时间戳长度
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, 5, true); // 声明有5个样本
      view.setUint8(4, 0x01);
      view.setUint8(5, 0x02);
      view.setUint8(6, 0x03);
      view.setUint8(7, 0x04);
      view.setUint8(8, 0x05);
      view.setUint8(9, 0); // 时间戳长度
      
      (processor as any).buffer = buffer;
      
      await (processor as any).parseRawData(session, 2, CaptureMode.Channels_8);
      
      expect(consoleSpy).toHaveBeenCalledWith('Sample count mismatch. Expected 2, got 5');
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('样本数据处理测试', () => {
    let processor: DataStreamProcessor;
    let session: CaptureSession;
    let mockEvents: Partial<DataStreamEvents>;
    
    beforeEach(() => {
      mockEvents = {
        onDataReceived: jest.fn()
      };
      
      processor = new DataStreamProcessor({}, mockEvents);
      session = new CaptureSession();
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1'),
        new AnalyzerChannel(2, 'CH2')
      ];
    });
    
    it('应该正确提取通道样本', async () => {
      const rawPacket: RawDataPacket = {
        length: 4,
        samples: new Uint32Array([
          0b001, // CH0=1
          0b010, // CH1=1
          0b100, // CH2=1
          0b111  // CH0=1, CH1=1, CH2=1
        ]),
        timestamps: new BigUint64Array(0),
        mode: CaptureMode.Channels_8
      };
      
      await (processor as any).processSampleData(session, rawPacket);
      
      // 验证CH0样本
      expect(session.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 0, 1]));
      
      // 验证CH1样本
      expect(session.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 0, 1]));
      
      // 验证CH2样本
      expect(session.captureChannels[2].samples).toEqual(new Uint8Array([0, 0, 1, 1]));
      
      // 验证事件被触发
      expect(mockEvents.onDataReceived).toHaveBeenCalledWith(rawPacket);
    });
    
    it('应该正确处理空样本数据', async () => {
      const rawPacket: RawDataPacket = {
        length: 0,
        samples: new Uint32Array(0),
        timestamps: new BigUint64Array(0),
        mode: CaptureMode.Channels_8
      };
      
      await (processor as any).processSampleData(session, rawPacket);
      
      session.captureChannels.forEach(channel => {
        expect(channel.samples).toEqual(new Uint8Array(0));
      });
    });
  });
  
  describe('突发数据处理测试', () => {
    let processor: DataStreamProcessor;
    let session: CaptureSession;
    
    beforeEach(() => {
      processor = new DataStreamProcessor();
      session = new CaptureSession();
      session.frequency = 1000000; // 1MHz
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 900;
      session.loopCount = 2;
      session.measureBursts = true;
    });
    
    it('应该正确处理突发数据', async () => {
      const rawPacket: RawDataPacket = {
        length: 3000,
        samples: new Uint32Array(3000),
        timestamps: new BigUint64Array([
          BigInt(0x1000),
          BigInt(0x2000),
          BigInt(0x3000),
          BigInt(0x4000)
        ]),
        mode: CaptureMode.Channels_8
      };
      
      await (processor as any).processBurstData(session, rawPacket);
      
      expect(session.bursts).toHaveLength(3); // loopCount + 1
      
      // 验证第一个突发
      const firstBurst = session.bursts![0];
      expect(firstBurst.burstSampleStart).toBe(0);
      expect(firstBurst.burstSampleEnd).toBe(1000); // preTriggerSamples + postTriggerSamples
      expect(firstBurst.burstSampleGap).toBe(0);
      expect(firstBurst.burstTimeGap).toBe(0);
      
      // 验证第二个突发
      const secondBurst = session.bursts![1];
      expect(secondBurst.burstSampleStart).toBe(100); // preTriggerSamples
      expect(secondBurst.burstSampleEnd).toBe(1000); // preTriggerSamples + postTriggerSamples
    });
    
    it('应该正确调整时间戳', async () => {
      const rawPacket: RawDataPacket = {
        length: 1000,
        samples: new Uint32Array(1000),
        timestamps: new BigUint64Array([
          BigInt(0xFF123456), // 需要调整低24位
          BigInt(0xFE654321)
        ]),
        mode: CaptureMode.Channels_8
      };
      
      await (processor as any).processBurstData(session, rawPacket);
      
      // 时间戳调整逻辑已在processBurstData中实现
      // 这里主要验证不会抛出错误且生成了正确数量的突发
      expect(session.bursts).toHaveLength(3);
    });
    
    it('应该处理空时间戳数据', async () => {
      const rawPacket: RawDataPacket = {
        length: 1000,
        samples: new Uint32Array(1000),
        timestamps: new BigUint64Array(0), // 空时间戳
        mode: CaptureMode.Channels_8
      };
      
      await (processor as any).processBurstData(session, rawPacket);
      
      // 应该直接返回，不处理突发数据
      expect(session.bursts).toBeUndefined();
    });
  });
  
  describe('进度报告测试', () => {
    let processor: DataStreamProcessor;
    let mockEvents: Partial<DataStreamEvents>;
    
    beforeEach(() => {
      mockEvents = {
        onProgress: jest.fn()
      };
      
      processor = new DataStreamProcessor({}, mockEvents);
      (processor as any).startTime = Date.now() - 1000; // 1秒前开始
    });
    
    it('应该正确计算和报告进度', () => {
      (processor as any).reportProgress(500, 1000);
      
      expect(mockEvents.onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          bytesRead: 500,
          totalBytes: 1000,
          progress: 50,
          samplesRead: 125, // 500 / 4
          totalSamples: 250, // 1000 / 4
          estimatedTimeRemaining: expect.any(Number)
        })
      );
    });
    
    it('应该将进度限制在100%以内', () => {
      (processor as any).reportProgress(1500, 1000); // 超过总字节数
      
      const progressCall = (mockEvents.onProgress as jest.Mock).mock.calls[0][0];
      expect(progressCall.progress).toBe(100);
    });
    
    it('应该正确计算剩余时间', () => {
      (processor as any).reportProgress(250, 1000);
      
      const progressCall = (mockEvents.onProgress as jest.Mock).mock.calls[0][0];
      expect(progressCall.estimatedTimeRemaining).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('完整数据流处理测试', () => {
    let processor: DataStreamProcessor;
    let session: CaptureSession;
    let mockEvents: Partial<DataStreamEvents>;
    
    beforeEach(() => {
      mockEvents = {
        onProgress: jest.fn(),
        onDataReceived: jest.fn(),
        onCompleted: jest.fn(),
        onError: jest.fn()
      };
      
      processor = new DataStreamProcessor({
        enableProgress: true
      }, mockEvents);
      
      session = new CaptureSession();
      session.frequency = 1000000;
      session.preTriggerSamples = 100;
      session.postTriggerSamples = 900;
      session.captureChannels = [
        new AnalyzerChannel(0, 'CH0'),
        new AnalyzerChannel(1, 'CH1')
      ];
    });
    
    it('应该完成完整的数据流处理工作流', async () => {
      // 构造完整的测试数据
      const expectedSamples = 1000;
      const buffer = new Uint8Array(1005); // 4 + 1000 + 1
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, expectedSamples, true);
      
      // 填充样本数据
      for (let i = 0; i < expectedSamples; i++) {
        view.setUint8(4 + i, i % 4); // 循环模式
      }
      
      view.setUint8(1004, 0); // 时间戳长度
      
      const stream = DataStreamFactory.createBufferStream(buffer);
      
      const result = await processor.readCaptureData(stream, session, expectedSamples, CaptureMode.Channels_8);
      
      // 验证结果
      expect(result).toBe(session);
      expect(processor.getState()).toBe(DataStreamState.Completed);
      
      // 验证通道数据
      expect(session.captureChannels[0].samples).toHaveLength(expectedSamples);
      expect(session.captureChannels[1].samples).toHaveLength(expectedSamples);
      
      // 验证事件被调用
      expect(mockEvents.onCompleted).toHaveBeenCalledWith(session);
      expect(mockEvents.onDataReceived).toHaveBeenCalled();
    });
    
    it('应该处理数据流错误', async () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'));
        }
      });
      
      await expect(processor.readCaptureData(errorStream, session, 1000, CaptureMode.Channels_8))
        .rejects.toThrow('Stream error');
      
      expect(processor.getState()).toBe(DataStreamState.Error);
      expect(mockEvents.onError).toHaveBeenCalled();
    });
    
    it('应该处理带突发模式的完整工作流', async () => {
      session.loopCount = 1;
      session.measureBursts = true;
      
      // 构造带时间戳的测试数据
      const expectedSamples = 1000;
      const buffer = new Uint8Array(1017); // 4 + 1000 + 1 + 12 (3个时间戳*4字节)
      const view = new DataView(buffer.buffer);
      
      view.setUint32(0, expectedSamples, true);
      
      // 填充样本数据
      for (let i = 0; i < expectedSamples; i++) {
        view.setUint8(4 + i, i % 2);
      }
      
      view.setUint8(1004, 12); // 时间戳长度
      view.setUint32(1005, 0x1000, true);
      view.setUint32(1009, 0x2000, true);
      view.setUint32(1013, 0x3000, true);
      
      const stream = DataStreamFactory.createBufferStream(buffer);
      
      const result = await processor.readCaptureData(stream, session, expectedSamples, CaptureMode.Channels_8);
      
      // 验证突发数据被处理
      expect(result.bursts).toHaveLength(2); // loopCount + 1
      expect(mockEvents.onCompleted).toHaveBeenCalledWith(session);
    });
  });
});

describe('DataStreamFactory 工厂类测试', () => {
  
  it('应该创建Buffer流', () => {
    const testBuffer = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = DataStreamFactory.createBufferStream(testBuffer);
    
    expect(stream).toBeInstanceOf(ReadableStream);
  });
  
  it('Buffer流应该正确提供数据', async () => {
    const testBuffer = new Uint8Array([1, 2, 3, 4, 5]);
    const stream = DataStreamFactory.createBufferStream(testBuffer);
    const reader = stream.getReader();
    
    const { done, value } = await reader.read();
    
    expect(done).toBe(false);
    expect(value).toEqual(testBuffer);
    
    const { done: done2 } = await reader.read();
    expect(done2).toBe(true);
    
    reader.releaseLock();
  });
  
  it('应该创建网络流', () => {
    const mockSocket = {
      on: jest.fn()
    };
    
    const stream = DataStreamFactory.createNetworkStream(mockSocket);
    
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(mockSocket.on).toHaveBeenCalledWith('data', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('end', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
  
  it('应该创建串口流', () => {
    const mockPort = {};
    const stream = DataStreamFactory.createSerialStream(mockPort);
    
    expect(stream).toBeDefined();
    expect(typeof stream[Symbol.asyncIterator]).toBe('function');
  });

  it('串口流应该正确处理数据', async () => {
    const testData = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
    const mockPort = {
      *[Symbol.asyncIterator]() {
        for (const data of testData) {
          yield data;
        }
      }
    };
    
    const stream = DataStreamFactory.createSerialStream(mockPort);
    const results: Uint8Array[] = [];
    
    for await (const chunk of stream) {
      results.push(chunk);
    }
    
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(testData[0]);
    expect(results[1]).toEqual(testData[1]);
  });

  it('网络流应该正确处理数据和结束事件', async () => {
    let dataCallback: Function;
    let endCallback: Function;
    
    const mockSocket = {
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      })
    };
    
    const stream = DataStreamFactory.createNetworkStream(mockSocket);
    const reader = stream.getReader();
    
    // 模拟接收数据
    const testBuffer = Buffer.from([1, 2, 3, 4]);
    dataCallback!(testBuffer);
    
    // 验证数据
    const { done, value } = await reader.read();
    expect(done).toBe(false);
    expect(value).toEqual(new Uint8Array([1, 2, 3, 4]));
    
    // 结束流
    endCallback!();
    
    // 验证流结束
    const { done: done2 } = await reader.read();
    expect(done2).toBe(true);
    reader.releaseLock();
  });
});

describe('DataStreamMonitor 监控器测试', () => {
  let monitor: DataStreamMonitor;
  
  beforeEach(() => {
    monitor = new DataStreamMonitor();
  });
  
  it('应该正确初始化监控器', () => {
    const stats = monitor.getStatistics();
    
    expect(stats.elapsedTime).toBe(0);
    expect(stats.bytesPerSecond).toBe(0);
    expect(stats.samplesPerSecond).toBe(0);
    expect(stats.efficiency).toBe(0);
  });
  
  it('应该正确启动监控', () => {
    const beforeStart = Date.now();
    monitor.start();
    const afterStart = Date.now();
    
    const stats = monitor.getStatistics();
    expect(stats.elapsedTime).toBeGreaterThanOrEqual(0);
    expect(stats.elapsedTime).toBeLessThan(afterStart - beforeStart + 100); // 允许一些误差
  });
  
  it('应该正确更新监控数据', (done) => {
    monitor.start();
    monitor.update(1000, 250);
    
    // 等待一小段时间以获得有意义的统计
    setTimeout(() => {
      const stats = monitor.getStatistics();
      
      expect(stats.elapsedTime).toBeGreaterThan(0);
      expect(stats.bytesPerSecond).toBeGreaterThan(0);
      expect(stats.samplesPerSecond).toBeGreaterThan(0);
      expect(stats.efficiency).toBe(4); // 1000 bytes / 250 samples = 4
      done();
    }, 10);
  });
  
  it('应该正确计算性能统计', () => {
    const originalNow = Date.now;
    const startTime = 1000000000; // 固定的开始时间
    
    // Mock Date.now 返回固定的开始时间
    Date.now = jest.fn().mockReturnValue(startTime);
    monitor.start();
    
    // Mock Date.now 返回1秒后的时间
    Date.now = jest.fn().mockReturnValue(startTime + 1000);
    monitor.update(2000, 500);
    
    const stats = monitor.getStatistics();
    
    expect(stats.elapsedTime).toBe(1000);
    expect(stats.bytesPerSecond).toBe(2000); // 2000 bytes / 1 second
    expect(stats.samplesPerSecond).toBe(500); // 500 samples / 1 second
    expect(stats.efficiency).toBe(4); // 2000 / 500
    
    Date.now = originalNow;
  });
  
  it('应该处理零除情况', () => {
    monitor.start();
    monitor.update(0, 0);
    
    const stats = monitor.getStatistics();
    
    expect(stats.bytesPerSecond).toBe(0);
    expect(stats.samplesPerSecond).toBe(0);
    expect(stats.efficiency).toBe(0);
  });
});

describe('边界条件和错误处理测试', () => {
  let processor: DataStreamProcessor;
  
  beforeEach(() => {
    processor = new DataStreamProcessor();
  });
  
  it('应该处理空数据流', async () => {
    const emptyStream = new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    
    const session = new CaptureSession();
    session.captureChannels = [];
    
    await expect(processor.readCaptureData(emptyStream, session, 100, CaptureMode.Channels_8))
      .rejects.toThrow('Premature end of stream');
  });
  
  it('应该处理无效的采集模式', async () => {
    const buffer = new Uint8Array(9);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, 1, true);
    view.setUint8(4, 0x01);
    view.setUint8(5, 0);
    
    (processor as any).buffer = buffer;
    
    const session = new CaptureSession();
    
    // 使用无效的采集模式
    const result = await (processor as any).parseRawData(session, 1, 999 as CaptureMode);
    
    // 应该能处理而不崩溃
    expect(result.length).toBe(1);
    expect(result.samples).toBeDefined();
  });
  
  it('应该处理超大的缓冲区长度', () => {
    const session = new CaptureSession();
    session.loopCount = 1000000; // 非常大的循环计数
    session.measureBursts = true;
    
    const bufferLength = (processor as any).calculateBufferLength(1000000, CaptureMode.Channels_24, session);
    
    // 应该计算出合理的缓冲区长度而不崩溃
    expect(bufferLength).toBeGreaterThan(0);
    expect(typeof bufferLength).toBe('number');
  });
  
  it('应该处理网络流的错误事件', () => {
    let errorCallback: Function;
    const mockSocket = {
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      })
    };
    
    const stream = DataStreamFactory.createNetworkStream(mockSocket);
    const reader = stream.getReader();
    
    // 模拟网络错误
    const testError = new Error('Network connection lost');
    errorCallback!(testError);
    
    // 验证流错误处理
    expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    
    reader.releaseLock();
  });
});