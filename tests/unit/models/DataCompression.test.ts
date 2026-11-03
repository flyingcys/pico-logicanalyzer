/**
 * DataCompression 压缩/解压往返测试
 * 覆盖各算法 metadata 的类型窄化分支，确保 any→具体类型迁移不破坏运行时。
 */

import {
  DataCompressor,
  CompressionAlgorithm,
  CompressionFactory
} from '../../../src/models/DataCompression';

describe('DataCompressor 压缩解压往返', () => {
  const sampleData = new Uint8Array([
    1, 1, 1, 1, 0, 0, 0, 0,
    1, 1, 1, 1, 0, 0, 0, 0,
    1, 0, 1, 0
  ]);

  const algorithms: Array<[string, CompressionAlgorithm]> = [
    ['RLE', CompressionAlgorithm.RLE],
    ['Delta', CompressionAlgorithm.Delta],
    ['Dictionary', CompressionAlgorithm.Dictionary],
    ['Huffman', CompressionAlgorithm.Huffman]
  ];

  it.each(algorithms)('%s 算法往返一致', async (_name, algorithm) => {
    const compressor = new DataCompressor({ algorithm, threshold: 4 });

    const compressed = await compressor.compressChannelData(sampleData, algorithm);
    expect(compressed.success).toBe(true);
    expect(compressed.algorithm).toBe(algorithm);
    expect(compressed.metadata).toBeDefined();

    const decompressed = await compressor.decompressChannelData(
      compressed.data,
      algorithm,
      compressed.originalSize,
      compressed.metadata
    );

    expect(decompressed.success).toBe(true);
    expect(decompressed.isValid).toBe(true);
    expect(Array.from(decompressed.data)).toEqual(Array.from(sampleData));
  });

  it('Huffman metadata 包含编码表且可正确重建', async () => {
    const compressor = new DataCompressor({ algorithm: CompressionAlgorithm.Huffman, threshold: 4 });
    const compressed = await compressor.compressChannelData(sampleData, CompressionAlgorithm.Huffman);

    expect(compressed.metadata).toBeDefined();
    // codes / originalLength / encodedBits 在窄化后仍可访问
    expect(compressed.metadata!.codes).toBeInstanceOf(Array);
    expect(typeof compressed.metadata!.originalLength).toBe('number');
    expect(typeof compressed.metadata!.encodedBits).toBe('number');
  });

  it('RLE metadata 包含 run 统计', async () => {
    const compressor = new DataCompressor({ algorithm: CompressionAlgorithm.RLE, threshold: 4 });
    const compressed = await compressor.compressChannelData(sampleData, CompressionAlgorithm.RLE);

    expect(compressed.metadata).toBeDefined();
    expect(typeof compressed.metadata!.runs).toBe('number');
    expect(typeof compressed.metadata!.maxRun).toBe('number');
    expect(compressed.metadata!.runs).toBeGreaterThan(0);
  });

  it('小于阈值的数据不压缩', async () => {
    const compressor = new DataCompressor({ algorithm: CompressionAlgorithm.RLE, threshold: 1024 });
    const small = new Uint8Array([1, 0, 1]);
    const result = await compressor.compressChannelData(small, CompressionAlgorithm.RLE);

    expect(result.success).toBe(true);
    expect(result.algorithm).toBe(CompressionAlgorithm.None);
  });

  it('压缩工厂创建的压缩器可正常工作', async () => {
    const compressor = CompressionFactory.createForLogicSignals();
    const result = await compressor.compressChannelData(sampleData, CompressionAlgorithm.RLE);
    expect(result.success).toBe(true);
  });

  it('错误 metadata 不应导致解压崩溃（Huffman 容错）', async () => {
    const compressor = new DataCompressor({ algorithm: CompressionAlgorithm.Huffman, threshold: 4 });
    // 缺失 codes 的 metadata，decompressHuffman 内部窄化应安全处理
    const result = await compressor.decompressChannelData(
      new Uint8Array([0, 0]),
      CompressionAlgorithm.Huffman,
      2,
      { originalLength: 0, encodedBits: 0 }
    );
    // 不崩溃，返回空数据
    expect(result.success).toBe(true);
  });
});
