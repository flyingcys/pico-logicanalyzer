import { DecoderBenchmark, BenchmarkConfiguration } from '../../src/utils/DecoderBenchmark';
import { ChannelData } from '../../src/decoders/types';
import { DecoderBase } from '../../src/decoders/DecoderBase';
import { StreamingDecoderBase } from '../../src/decoders/StreamingDecoder';

// Mock decoder for testing
class MockDecoder extends DecoderBase {
  decodeCalled = 0;

  decode() {
    this.decodeCalled++;
    return Promise.resolve({ results: [{type: 0, startSample: 0, endSample: 0, values: ['mock']}] });
  }
}

class MockStreamingDecoder extends StreamingDecoderBase {
  decodeCalled = 0;

  initializeDecoding() { return; }
  processChunk() { return []; }
  finalizeDecoding() { return; }

  streamingDecode() {
    this.decodeCalled++;
    return { success: true, results: [], statistics: {totalResults: 0, totalSamples: 0, processingTime: 0, averageSpeed: 0, peakMemoryUsage: 0, chunksProcessed: 0} };
  }
}

describe('DecoderBenchmark', () => {
  let benchmark: DecoderBenchmark;
  let mockDecoder: MockDecoder;
  let mockStreamingDecoder: MockStreamingDecoder;
  let config: BenchmarkConfiguration;

  beforeEach(() => {
    mockDecoder = new MockDecoder();
    mockStreamingDecoder = new MockStreamingDecoder();
    config = {
      name: '测试配置',
      sampleCount: 1000,
      sampleRate: 1000000,
      channelCount: 4,
      iterations: 2,
      useStreaming: false
    };
    benchmark = new DecoderBenchmark((progress) => {
      console.log(`进度: ${progress.current}/${progress.total}`);
    });
  });

  it('should run decoder benchmark successfully without streaming', async () => {
    const result = await benchmark.runDecoderBenchmark('mock_i2c', mockDecoder, config);
    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.processingSpeed).toBeGreaterThan(0);
    expect(result.peakMemoryUsage).toBeGreaterThanOrEqual(0);
    expect(result.errors.length).toBe(0);
  });

  it('should run decoder benchmark with streaming', async () => {
    const streamingConfig = { ...config, useStreaming: true };
    const result = await benchmark.runDecoderBenchmark('mock_streaming', mockStreamingDecoder, streamingConfig);
    expect(result.success).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.errors.length).toBe(0);
  }, 10000);

  it('should run benchmark suite and calculate rankings', async () => {
    const decoders = [
      { id: 'mock_i2c', instance: mockDecoder },
      { id: 'mock_streaming', instance: mockStreamingDecoder }
    ];
    const configs = [config, { ...config, name: 'streaming', useStreaming: true }];
    const report = await benchmark.runBenchmarkSuite(decoders, configs);
    expect(report.results.length).toBe(4);
    expect(report.rankings.bySpeed.length).toBeGreaterThan(0);
  });

  it('should handle memory usage tracking', async () => {
    const result = await benchmark.runDecoderBenchmark('memory_test', mockDecoder, config);
    expect(result.peakMemoryUsage).toBeGreaterThanOrEqual(0);
  });

  it('should stop running benchmark', () => {
    benchmark.stop();
    expect(benchmark.getStatus().running).toBe(false);
  });
});
