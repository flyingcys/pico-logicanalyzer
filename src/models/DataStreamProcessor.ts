/**
 * 实时数据流处理和缓冲系统
 * 基于原版 C# LogicAnalyzerDriver 的 ReadCapture 方法精确移植
 * 负责处理来自硬件的二进制数据流，包括样本数据和时间戳
 */

import { CaptureMode } from './AnalyzerTypes';
import { CaptureSession, AnalyzerChannel, BurstInfo } from './CaptureModels';

/**
 * 数据流读取状态
 */
export enum DataStreamState {
  Idle = 'Idle',
  WaitingForHeader = 'WaitingForHeader',
  ReadingSamples = 'ReadingSamples',
  ReadingTimestamps = 'ReadingTimestamps',
  ProcessingData = 'ProcessingData',
  Completed = 'Completed',
  Error = 'Error'
}

/**
 * 数据流读取进度信息
 */
export interface DataStreamProgress {
  state: DataStreamState;
  bytesRead: number;
  totalBytes: number;
  samplesRead: number;
  totalSamples: number;
  progress: number; // 0-100
  estimatedTimeRemaining: number; // 毫秒
}

/**
 * 数据流读取配置
 */
export interface DataStreamConfig {
  bufferSize: number; // 缓冲区大小
  readTimeout: number; // 读取超时 (ms)
  chunkSize: number; // 分块读取大小
  enableProgress: boolean; // 是否启用进度报告
  progressInterval: number; // 进度报告间隔 (ms)
}

/**
 * 原始数据包结构
 */
export interface RawDataPacket {
  length: number; // 样本数量
  samples: Uint32Array; // 原始样本数据
  timestamps: BigUint64Array; // 时间戳数据
  mode: CaptureMode; // 采集模式
}

/**
 * 数据流处理器事件
 */
export interface DataStreamEvents {
  onProgress: (_progress: DataStreamProgress) => void;
  onDataReceived: (_packet: RawDataPacket) => void;
  onCompleted: (_session: CaptureSession) => void;
  onError: (_error: Error) => void;
}

/**
 * 数据流处理器类
 * 基于C# ReadCapture方法的精确实现
 */
export class DataStreamProcessor {
  private config: DataStreamConfig;
  private events: Partial<DataStreamEvents>;
  private state: DataStreamState = DataStreamState.Idle;
  private startTime: number = 0;
  private buffer: Uint8Array = new Uint8Array(0);
  private bufferPosition: number = 0;

  constructor(config: Partial<DataStreamConfig> = {}, events: Partial<DataStreamEvents> = {}) {
    this.config = {
      bufferSize: 1024 * 1024, // 1MB default
      readTimeout: 30000, // 30s
      chunkSize: 64 * 1024, // 64KB chunks
      enableProgress: true,
      progressInterval: 100, // 100ms
      ...config
    };
    this.events = events;
  }

  /**
   * 开始数据流读取 - 基于C# ReadCapture方法
   */
  public async readCaptureData(
    dataStream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
    session: CaptureSession,
    expectedSamples: number,
    mode: CaptureMode
  ): Promise<CaptureSession> {

    try {
      this.state = DataStreamState.WaitingForHeader;
      this.startTime = Date.now();

      // 初始化数据缓冲区
      const bufferLength = this.calculateBufferLength(expectedSamples, mode, session);
      this.buffer = new Uint8Array(bufferLength);
      this.bufferPosition = 0;

      // 逐步读取数据流
      await this.readDataStream(dataStream, bufferLength);

      // 解析数据
      const rawPacket = await this.parseRawData(session, expectedSamples, mode);

      // 处理样本数据
      await this.processSampleData(session, rawPacket);

      // 处理时间戳和突发信息
      if (session.measureBursts && session.loopCount > 0) {
        await this.processBurstData(session, rawPacket);
      }

      this.state = DataStreamState.Completed;
      this.events.onCompleted?.(session);

      return session;

    } catch (error) {
      this.state = DataStreamState.Error;
      const err = error instanceof Error ? error : new Error('Unknown data stream error');
      this.events.onError?.(err);
      throw err;
    }
  }

  /**
   * 计算缓冲区长度 - 基于C#代码的缓冲区计算逻辑
   */
  private calculateBufferLength(samples: number, mode: CaptureMode, session: CaptureSession): number {
    // 样本数据长度计算
    let bufLen = samples * (mode === CaptureMode.Channels_8 ? 1 :
                          (mode === CaptureMode.Channels_16 ? 2 : 4));

    // 添加长度字段 (4字节)
    bufLen += 4;

    // 时间戳数据长度
    if (session.loopCount === 0 || !session.measureBursts) {
      bufLen += 1; // 只有时间戳长度字节
    } else {
      bufLen += 1 + (session.loopCount + 2) * 4; // 时间戳长度 + 时间戳数据
    }

    return bufLen;
  }

  /**
   * 从数据流读取数据
   */
  private async readDataStream(
    dataStream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
    expectedLength: number
  ): Promise<void> {

    this.state = DataStreamState.ReadingSamples;
    let totalRead = 0;

    // 确保缓冲区已正确初始化
    if (this.buffer.length < expectedLength) {
      this.buffer = new Uint8Array(expectedLength);
    }

    const reader = 'getReader' in dataStream ? dataStream.getReader() : null;

    try {
      if (reader) {
        // ReadableStream 处理
        while (totalRead < expectedLength) {
          const { done, value } = await reader.read();

          if (done) {
            if (totalRead < expectedLength) {
              throw new Error(`Premature end of stream. Expected ${expectedLength}, got ${totalRead}`);
            }
            break;
          }

          if (value) {
            const bytesToCopy = Math.min(value.length, expectedLength - totalRead);
            this.buffer.set(value.subarray(0, bytesToCopy), totalRead);
            totalRead += bytesToCopy;

            // 报告进度
            if (this.config.enableProgress) {
              this.reportProgress(totalRead, expectedLength);
            }
          }
        }
      } else {
        // AsyncIterable 处理
        for await (const chunk of dataStream as AsyncIterable<Uint8Array>) {
          if (totalRead >= expectedLength) break;

          const bytesToCopy = Math.min(chunk.length, expectedLength - totalRead);
          this.buffer.set(chunk.subarray(0, bytesToCopy), totalRead);
          totalRead += bytesToCopy;

          // 报告进度
          if (this.config.enableProgress) {
            this.reportProgress(totalRead, expectedLength);
          }
        }
      }
    } finally {
      if (reader) {
        reader.releaseLock();
      }
    }

    if (totalRead < expectedLength) {
      throw new Error(`Incomplete data read. Expected ${expectedLength}, got ${totalRead}`);
    }
  }

  /**
   * 解析原始数据包 - 基于C# ReadCapture的数据解析逻辑
   */
  private async parseRawData(
    session: CaptureSession,
    expectedSamples: number,
    mode: CaptureMode
  ): Promise<RawDataPacket> {

    this.state = DataStreamState.ProcessingData;
    const view = new DataView(this.buffer.buffer);
    let offset = 0;

    // 读取样本数量 (uint32, little endian)
    const length = view.getUint32(offset, true);
    offset += 4;

    if (length !== expectedSamples) {
      console.warn(`Sample count mismatch. Expected ${expectedSamples}, got ${length}`);
    }

    // 创建样本数组
    const samples = new Uint32Array(length);

    // 根据采集模式读取样本数据
    switch (mode) {
      case CaptureMode.Channels_8:
        for (let i = 0; i < length; i++) {
          samples[i] = view.getUint8(offset);
          offset += 1;
        }
        break;

      case CaptureMode.Channels_16:
        for (let i = 0; i < length; i++) {
          samples[i] = view.getUint16(offset, true); // little endian
          offset += 2;
        }
        break;

      case CaptureMode.Channels_24:
        for (let i = 0; i < length; i++) {
          samples[i] = view.getUint32(offset, true); // little endian
          offset += 4;
        }
        break;
    }

    // 读取时间戳长度
    const stampLength = view.getUint8(offset);
    offset += 1;

    // 读取时间戳数据
    const timestampCount = session.loopCount === 0 || !session.measureBursts ? 0 : session.loopCount + 2;
    const timestamps = new BigUint64Array(timestampCount);

    if (stampLength > 0 && timestampCount > 0) {
      this.state = DataStreamState.ReadingTimestamps;

      for (let i = 0; i < timestampCount; i++) {
        // 读取32位时间戳并转换为64位
        const timestamp32 = view.getUint32(offset, true);
        timestamps[i] = BigInt(timestamp32);
        offset += 4;
      }
    }

    return {
      length,
      samples,
      timestamps,
      mode
    };
  }

  /**
   * 处理样本数据 - 提取通道样本
   */
  private async processSampleData(session: CaptureSession, rawPacket: RawDataPacket): Promise<void> {
    // 为每个通道提取样本数据
    for (let channelIndex = 0; channelIndex < session.captureChannels.length; channelIndex++) {
      const channel = session.captureChannels[channelIndex];
      this.extractChannelSamples(channel, channelIndex, rawPacket.samples);
    }

    // 触发数据接收事件
    this.events.onDataReceived?.(rawPacket);
  }

  /**
   * 提取通道样本 - 基于C# ExtractSamples方法
   */
  private extractChannelSamples(channel: AnalyzerChannel, channelIndex: number, samples: Uint32Array): void {
    const mask = 1 << channelIndex;
    const channelSamples = new Uint8Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      channelSamples[i] = (samples[i] & mask) !== 0 ? 1 : 0;
    }

    channel.samples = channelSamples;
  }

  /**
   * 处理突发数据和时间戳 - 基于C#的时间戳处理逻辑
   */
  private async processBurstData(session: CaptureSession, rawPacket: RawDataPacket): Promise<void> {
    if (rawPacket.timestamps.length === 0) {
      return;
    }

    // 时间戳调整 - 基于C#代码中的时间戳调整逻辑
    // 系统滴答计数器是递减的，需要反转低24位
    const adjustedTimestamps = new BigUint64Array(rawPacket.timestamps.length);
    for (let i = 0; i < rawPacket.timestamps.length; i++) {
      const timestamp = rawPacket.timestamps[i];
      const high8 = timestamp & 0xFF000000n;
      const low24 = timestamp & 0x00FFFFFFn;
      adjustedTimestamps[i] = high8 | (0x00FFFFFFn - low24);
    }

    // 创建突发信息
    const bursts: BurstInfo[] = [];

    for (let i = 0; i < session.loopCount + 1; i++) {
      const burst = new BurstInfo();

      if (i === 0) {
        // 第一个突发
        burst.burstSampleStart = 0;
        burst.burstSampleEnd = session.preTriggerSamples + session.postTriggerSamples;
        burst.burstSampleGap = 0;
        burst.burstTimeGap = 0;
      } else {
        // 后续突发
        burst.burstSampleStart = session.preTriggerSamples + (session.postTriggerSamples * (i - 1));
        burst.burstSampleEnd = session.preTriggerSamples + (session.postTriggerSamples * i);

        // 计算样本间隔和时间间隔
        if (i < adjustedTimestamps.length - 1) {
          const timeDiff = adjustedTimestamps[i + 1] - adjustedTimestamps[i];
          burst.burstTimeGap = Number(timeDiff * 125n); // 125ns per tick (8MHz)
          burst.burstSampleGap = Math.round(burst.burstTimeGap / (1000000000 / session.frequency));
        }
      }

      bursts.push(burst);
    }

    session.bursts = bursts;
  }

  /**
   * 报告读取进度
   */
  private reportProgress(bytesRead: number, totalBytes: number): void {
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min((bytesRead / totalBytes) * 100, 100);
    const estimatedTotal = elapsed * (totalBytes / bytesRead);
    const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

    const progressInfo: DataStreamProgress = {
      state: this.state,
      bytesRead,
      totalBytes,
      samplesRead: Math.floor(bytesRead / 4), // 估算样本数
      totalSamples: Math.floor(totalBytes / 4),
      progress,
      estimatedTimeRemaining: estimatedRemaining
    };

    this.events.onProgress?.(progressInfo);
  }

  /**
   * 获取当前状态
   */
  public getState(): DataStreamState {
    return this.state;
  }

  /**
   * 重置处理器状态
   */
  public reset(): void {
    this.state = DataStreamState.Idle;
    this.buffer = new Uint8Array(0);
    this.bufferPosition = 0;
    this.startTime = 0;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<DataStreamConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 更新事件处理器
   */
  public updateEvents(events: Partial<DataStreamEvents>): void {
    this.events = { ...this.events, ...events };
  }
}

/**
 * 数据流工厂类 - 用于创建不同类型的数据流
 */
// 串口接口定义
interface SerialPortLike {
  readonly readable: boolean;
  read(): Buffer | null;
  on(event: string, callback: (data: Buffer) => void): void;
  [Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
}

// 网络Socket接口定义
interface SocketLike {
  on(event: 'data', callback: (data: Buffer) => void): void;
  on(event: 'end', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
}

export class DataStreamFactory {
  /**
   * 从串口创建数据流
   */
  public static createSerialStream(port: SerialPortLike): AsyncIterable<Uint8Array> {
    return {
      async *[Symbol.asyncIterator]() {
        // 这里需要根据实际的串口库实现
        // 例如使用 serialport 库
        for await (const chunk of port) {
          yield new Uint8Array(chunk);
        }
      }
    };
  }

  /**
   * 从网络TCP连接创建数据流
   */
  public static createNetworkStream(socket: SocketLike): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        socket.on('data', (data: Buffer) => {
          controller.enqueue(new Uint8Array(data));
        });

        socket.on('end', () => {
          controller.close();
        });

        socket.on('error', (error: Error) => {
          controller.error(error);
        });
      }
    });
  }

  /**
   * 从Buffer创建数据流 (用于测试)
   */
  public static createBufferStream(buffer: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      }
    });
  }
}

/**
 * 数据流监控器 - 用于监控数据流性能
 */
export class DataStreamMonitor {
  private startTime: number = 0;
  private bytesProcessed: number = 0;
  private samplesProcessed: number = 0;

  public start(): void {
    this.startTime = Date.now();
    this.bytesProcessed = 0;
    this.samplesProcessed = 0;
  }

  public update(bytesRead: number, samplesRead: number): void {
    this.bytesProcessed = bytesRead;
    this.samplesProcessed = samplesRead;
  }

  public getStatistics(): {
    elapsedTime: number;
    bytesPerSecond: number;
    samplesPerSecond: number;
    efficiency: number;
  } {
    const elapsed = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const elapsedSeconds = elapsed / 1000;

    return {
      elapsedTime: elapsed,
      bytesPerSecond: elapsedSeconds > 0 ? this.bytesProcessed / elapsedSeconds : 0,
      samplesPerSecond: elapsedSeconds > 0 ? this.samplesProcessed / elapsedSeconds : 0,
      efficiency: this.samplesProcessed > 0 ? (this.bytesProcessed / this.samplesProcessed) : 0
    };
  }
}
