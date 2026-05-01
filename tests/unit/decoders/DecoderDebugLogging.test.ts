import { DecoderManager } from '../../../src/decoders/DecoderManager';
import { initializeDecoders } from '../../../src/decoders';
import { StreamingI2CDecoder } from '../../../src/decoders/protocols/StreamingI2CDecoder';
import {
  decoderDebugLog,
  StreamingDecoderBase
} from '../../../src/decoders/StreamingDecoder';
import type {
  ChannelData,
  DecoderOptionValue,
  DecoderResult,
  DecoderSelectedChannel
} from '../../../src/decoders/types';

class ThrowingStreamingDecoder extends StreamingDecoderBase {
  protected async initializeDecoding(): Promise<void> {
    return undefined;
  }

  protected async processChunk(
    _chunk: unknown,
    _sampleRate: number,
    _options: DecoderOptionValue[],
    _selectedChannels: DecoderSelectedChannel[]
  ): Promise<DecoderResult[]> {
    throw new Error('真实解码失败');
  }

  protected async finalizeDecoding(): Promise<void> {
    return undefined;
  }
}

class StoppedStreamingDecoder extends StreamingDecoderBase {
  protected async initializeDecoding(): Promise<void> {
    this.stop();
  }

  protected async processChunk(): Promise<DecoderResult[]> {
    throw new Error('用户停止处理');
  }

  protected async finalizeDecoding(): Promise<void> {
    return undefined;
  }
}

describe('解码器 debug 日志开关', () => {
  const originalDebugEnv = process.env.PICO_DECODER_DEBUG;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    if (originalDebugEnv === undefined) {
      delete process.env.PICO_DECODER_DEBUG;
    } else {
      process.env.PICO_DECODER_DEBUG = originalDebugEnv;
    }
  });

  it('默认不输出解码器内部 debug 日志', () => {
    delete process.env.PICO_DECODER_DEBUG;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    decoderDebugLog('内部解码器日志');
    initializeDecoders();
    new DecoderManager().dispose();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('启用 PICO_DECODER_DEBUG 后输出解码器内部 debug 日志', () => {
    process.env.PICO_DECODER_DEBUG = '1';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    decoderDebugLog('内部解码器日志');
    initializeDecoders();
    new DecoderManager().dispose();

    expect(logSpy).toHaveBeenCalledWith('内部解码器日志');
    expect(logSpy).toHaveBeenCalledWith('Decoder system initialized with I2C, SPI, UART, CAN, LIN, and I2S decoders');
    expect(logSpy).toHaveBeenCalledWith('DecoderManager disposed');
  });

  it('PICO_DECODER_DEBUG=true 也会输出解码器内部 debug 日志', () => {
    process.env.PICO_DECODER_DEBUG = 'true';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    decoderDebugLog('内部解码器日志');

    expect(logSpy).toHaveBeenCalledWith('内部解码器日志');
  });

  it('真实解码异常仍输出 error 日志', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const decoder = new ThrowingStreamingDecoder({
      chunkSize: 4,
      processingInterval: 0,
      maxConcurrentChunks: 1
    });
    const channels: ChannelData[] = [
      { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array([1, 0, 1, 0]) }
    ];

    const result = await decoder.streamingDecode(1_000_000, channels, [], []);

    expect(result.success).toBe(false);
    expect(result.error).toBe('真实解码失败');
    expect(errorSpy).toHaveBeenCalledWith(
      '❌ 流式解码失败:',
      expect.objectContaining({ message: '真实解码失败' })
    );
  });

  it('I2C 流式解码缺少必需通道数据时仍输出 warn 日志', async () => {
    delete process.env.PICO_DECODER_DEBUG;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const decoder = new StreamingI2CDecoder({
      chunkSize: 4,
      processingInterval: 0,
      maxConcurrentChunks: 1
    });
    const channels: ChannelData[] = [
      { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array([1, 0, 1, 0]) }
    ];

    const result = await decoder.streamingDecode(1_000_000, channels, [], []);

    expect(result.success).toBe(true);
    expect(result.results).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('⚠️ I2C解码器: 块 0 缺少必需的通道数据');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('用户主动停止流式解码时不输出 error 日志', async () => {
    delete process.env.PICO_DECODER_DEBUG;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const decoder = new StoppedStreamingDecoder({
      chunkSize: 4,
      processingInterval: 0,
      maxConcurrentChunks: 1
    });
    const channels: ChannelData[] = [
      { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array([1, 0, 1, 0]) }
    ];

    const result = await decoder.streamingDecode(1_000_000, channels, [], []);

    expect(result.success).toBe(false);
    expect(result.error).toBe('用户停止处理');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
