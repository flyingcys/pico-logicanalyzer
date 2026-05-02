import { DecoderManager } from '../../../../src/decoders/DecoderManager';
import { StreamingI2CDecoder } from '../../../../src/decoders/protocols/StreamingI2CDecoder';
import type { ChannelData, DecoderResult, DecoderSelectedChannel } from '../../../../src/decoders/types';

type I2COperation =
  | { type: 'start' }
  | { type: 'restart' }
  | { type: 'stop' }
  | { type: 'byte'; value: number }
  | { type: 'ack' }
  | { type: 'nack' };

function generateI2CSequence(operations: I2COperation[]): { scl: Uint8Array; sda: Uint8Array } {
  const scl: number[] = [1, 1, 1, 1];
  const sda: number[] = [1, 1, 1, 1];

  const push = (sclValues: number[], sdaValues: number[]) => {
    scl.push(...sclValues);
    sda.push(...sdaValues);
  };

  for (const operation of operations) {
    if (operation.type === 'start') {
      push([1, 1, 1, 1], [1, 1, 0, 0]);
    } else if (operation.type === 'restart') {
      push([0, 0, 1, 1, 1, 1], [0, 1, 1, 1, 0, 0]);
    } else if (operation.type === 'stop') {
      push([0, 1, 1, 1], [0, 0, 1, 1]);
    } else if (operation.type === 'byte') {
      for (let bit = 7; bit >= 0; bit--) {
        const value = (operation.value >> bit) & 1;
        push([0, 0, 1, 1], [value, value, value, value]);
      }
    } else if (operation.type === 'ack' || operation.type === 'nack') {
      const value = operation.type === 'ack' ? 0 : 1;
      push([0, 0, 1, 1], [value, value, value, value]);
    }
  }

  return {
    scl: new Uint8Array(scl),
    sda: new Uint8Array(sda)
  };
}

function createChannels(operations: I2COperation[]): ChannelData[] {
  const sequence = generateI2CSequence(operations);

  return [
    { channelNumber: 0, channelName: 'SCL', samples: sequence.scl },
    { channelNumber: 1, channelName: 'SDA', samples: sequence.sda }
  ];
}

function createReversedChannels(operations: I2COperation[]): ChannelData[] {
  const sequence = generateI2CSequence(operations);

  return [
    { channelNumber: 0, channelName: 'SDA', samples: sequence.sda },
    { channelNumber: 1, channelName: 'SCL', samples: sequence.scl }
  ];
}

function semanticResults(results: DecoderResult[]): DecoderResult[] {
  const semanticAnnotationTypes = new Set([0, 1, 2, 3, 4, 6, 7, 8, 9]);
  return results.filter(result => semanticAnnotationTypes.has(result.annotationType));
}

describe('StreamingI2CDecoder', () => {
  const writeTransaction: I2COperation[] = [
    { type: 'start' },
    { type: 'byte', value: 0xa0 },
    { type: 'ack' },
    { type: 'byte', value: 0x12 },
    { type: 'ack' },
    { type: 'stop' }
  ];

  it('跨块写事务的地址、数据、ACK 和 Stop 顺序稳定且输出契约对齐常规 I2C', async () => {
    const decoder = new StreamingI2CDecoder({
      chunkSize: 24,
      processingInterval: 0,
      maxConcurrentChunks: 4
    });

    const result = await decoder.streamingDecode(
      1_000_000,
      createChannels(writeTransaction),
      [{ optionIndex: 0, value: 'shifted' }],
      [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]
    );

    expect(result.success).toBe(true);
    expect(semanticResults(result.results)).toEqual([
      expect.objectContaining({ annotationType: 0, values: ['Start', 'S'] }),
      expect.objectContaining({
        annotationType: 7,
        values: ['Address write: 50', 'AW: 50', '50'],
        rawData: 0x50
      }),
      expect.objectContaining({ annotationType: 3, values: ['ACK', 'A'] }),
      expect.objectContaining({
        annotationType: 9,
        values: ['Data write: 12', 'DW: 12', '12'],
        rawData: 0x12
      }),
      expect.objectContaining({ annotationType: 3, values: ['ACK', 'A'] }),
      expect.objectContaining({ annotationType: 2, values: ['Stop', 'P'] })
    ]);
  });

  it('为跨块地址和数据字节输出 bit annotation', async () => {
    const decoder = new StreamingI2CDecoder({
      chunkSize: 24,
      processingInterval: 0,
      maxConcurrentChunks: 4
    });

    const result = await decoder.streamingDecode(
      1_000_000,
      createChannels(writeTransaction),
      [{ optionIndex: 0, value: 'shifted' }],
      [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]
    );

    const bitAnnotations = result.results.filter(item => item.annotationType === 5);

    expect(result.success).toBe(true);
    expect(bitAnnotations).toHaveLength(16);
    expect(bitAnnotations.map(item => item.values[0])).toEqual([
      '0', '0', '0', '0', '0', '1', '0', '1',
      '0', '1', '0', '0', '1', '0', '0', '0'
    ]);
  });

  it('跨块 repeated-start read 事务应输出重复起始、读地址、读数据、NACK 与 Stop', async () => {
    const decoder = new StreamingI2CDecoder({
      chunkSize: 24,
      processingInterval: 0,
      maxConcurrentChunks: 4
    });
    const repeatedStartRead: I2COperation[] = [
      { type: 'start' },
      { type: 'byte', value: 0xa0 },
      { type: 'ack' },
      { type: 'byte', value: 0x00 },
      { type: 'ack' },
      { type: 'restart' },
      { type: 'byte', value: 0xa1 },
      { type: 'ack' },
      { type: 'byte', value: 0x5a },
      { type: 'nack' },
      { type: 'stop' }
    ];

    const result = await decoder.streamingDecode(
      1_000_000,
      createChannels(repeatedStartRead),
      [{ optionIndex: 0, value: 'shifted' }],
      [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]
    );

    expect(result.success).toBe(true);
    expect(semanticResults(result.results)).toEqual(expect.arrayContaining([
      expect.objectContaining({ annotationType: 1, values: ['Start repeat', 'Sr'] }),
      expect.objectContaining({
        annotationType: 6,
        values: ['Address read: 50', 'AR: 50', '50'],
        rawData: 0x50
      }),
      expect.objectContaining({
        annotationType: 8,
        values: ['Data read: 5A', 'DR: 5A', '5A'],
        rawData: 0x5A
      }),
      expect.objectContaining({ annotationType: 4, values: ['NACK', 'N'] }),
      expect.objectContaining({ annotationType: 2, values: ['Stop', 'P'] })
    ]));
  });

  it('按 captureIndex/decoderIndex 使用显式通道映射', async () => {
    const decoder = new StreamingI2CDecoder({
      chunkSize: 24,
      processingInterval: 0,
      maxConcurrentChunks: 4
    });
    const channelMapping: DecoderSelectedChannel[] = [
      { captureIndex: 1, decoderIndex: 0 },
      { captureIndex: 0, decoderIndex: 1 }
    ];

    const result = await decoder.streamingDecode(
      1_000_000,
      createReversedChannels(writeTransaction),
      [{ optionIndex: 0, value: 'shifted' }],
      channelMapping
    );

    expect(result.success).toBe(true);
    expect(semanticResults(result.results)).toEqual([
      expect.objectContaining({ annotationType: 0, values: ['Start', 'S'] }),
      expect.objectContaining({
        annotationType: 7,
        values: ['Address write: 50', 'AW: 50', '50'],
        rawData: 0x50
      }),
      expect.objectContaining({ annotationType: 3, values: ['ACK', 'A'] }),
      expect.objectContaining({
        annotationType: 9,
        values: ['Data write: 12', 'DW: 12', '12'],
        rawData: 0x12
      }),
      expect.objectContaining({ annotationType: 3, values: ['ACK', 'A'] }),
      expect.objectContaining({ annotationType: 2, values: ['Stop', 'P'] })
    ]);
  });

  it('停止请求会结束活跃流式 I2C 解码任务并返回失败状态', async () => {
    const decoder = new StreamingI2CDecoder({
      chunkSize: 8,
      processingInterval: 1,
      maxConcurrentChunks: 1
    });
    const channels = createChannels([
      ...writeTransaction,
      ...writeTransaction,
      ...writeTransaction,
      ...writeTransaction
    ]);

    decoder.onProgress = progress => {
      if (progress.currentChunk >= 1) {
        decoder.stop();
      }
    };

    const result = await decoder.streamingDecode(
      1_000_000,
      channels,
      [{ optionIndex: 0, value: 'shifted' }],
      [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('用户停止处理');
    expect(result.statistics.chunksProcessed).toBeGreaterThan(0);
  });
});

describe('DecoderManager Streaming I2C 主路径', () => {
  const writeTransaction: I2COperation[] = [
    { type: 'start' },
    { type: 'byte', value: 0xa0 },
    { type: 'ack' },
    { type: 'byte', value: 0x12 },
    { type: 'ack' },
    { type: 'stop' }
  ];

  it('executeDecoder 在 i2c 大样本下透明切换到 streaming_i2c', async () => {
    const manager = new DecoderManager();
    const channels = createChannels(writeTransaction).map(channel => ({
      ...channel,
      samples: new Uint8Array(1_000_001).fill(1)
    }));
    const sequence = generateI2CSequence(writeTransaction);
    channels[0].samples.set(sequence.scl, 100);
    channels[1].samples.set(sequence.sda, 100);

    const result = await manager.executeDecoder(
      'i2c',
      1_000_000,
      channels,
      [{ optionIndex: 0, value: 'shifted' }],
      [
        { captureIndex: 0, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: 1 }
      ]
    );

    expect(result.success).toBe(true);
    expect(result.isStreaming).toBe(true);
    expect(semanticResults(result.results)).toEqual([
      expect.objectContaining({ annotationType: 0, values: ['Start', 'S'] }),
      expect.objectContaining({
        annotationType: 7,
        values: ['Address write: 50', 'AW: 50', '50'],
        rawData: 0x50
      }),
      expect.objectContaining({ annotationType: 3, values: ['ACK', 'A'] }),
      expect.objectContaining({
        annotationType: 9,
        values: ['Data write: 12', 'DW: 12', '12'],
        rawData: 0x12
      }),
      expect.objectContaining({ annotationType: 3, values: ['ACK', 'A'] }),
      expect.objectContaining({ annotationType: 2, values: ['Stop', 'P'] })
    ]);
  });
});
