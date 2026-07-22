import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureRequest, OutputPacket } from '../../../src/drivers/AnalyzerDriverBase';
import {
  AnalyzerChannel,
  CaptureEventArgs,
  CaptureError,
  CaptureSession,
  TriggerType
} from '../../../src/models/AnalyzerTypes';
import { CaptureRequestBuilder } from '../../../src/models/CaptureModels';

jest.mock('serialport', () => ({
  SerialPort: jest.fn()
}));

jest.mock('@serialport/parser-readline', () => ({
  ReadlineParser: jest.fn()
}));

jest.mock('net', () => ({
  Socket: jest.fn()
}));

class MockStream extends EventEmitter {
  public writes: Buffer[] = [];
  public unpipe = jest.fn();

  write(data: Buffer, callback?: (error?: Error | null) => void): boolean {
    this.writes.push(Buffer.from(data));
    callback?.(null);
    return true;
  }
}

const channel = (channelNumber: number): AnalyzerChannel => ({
  channelNumber,
  channelName: `CH${channelNumber}`,
  textualChannelNumber: `${channelNumber}`,
  hidden: false,
  samples: new Uint8Array(0),
  clone: jest.fn()
});

const session = (overrides: Partial<CaptureSession> = {}): CaptureSession => ({
  frequency: 24_000_000,
  preTriggerSamples: 100,
  postTriggerSamples: 1000,
  triggerType: TriggerType.Edge,
  triggerChannel: 0,
  triggerInverted: false,
  triggerPattern: 0,
  triggerBitCount: 1,
  loopCount: 0,
  measureBursts: false,
  captureChannels: [channel(0), channel(3), channel(8)],
  get totalSamples() {
    return this.preTriggerSamples + this.postTriggerSamples * (this.loopCount + 1);
  },
  clone: jest.fn(),
  cloneSettings: jest.fn(),
  ...overrides
});

const connectedDriver = () => {
  const driver = new LogicAnalyzerDriver('/dev/ttyACM0') as any;
  const stream = new MockStream();
  const parser = new EventEmitter();

  driver._isConnected = true;
  driver._isNetwork = false;
  driver._currentStream = stream;
  driver._serialPort = stream;
  driver._lineParser = parser;
  driver._lineParserAttached = true;
  driver._channelCount = 24;
  driver._maxFrequency = 100_000_000;
  driver._blastFrequency = 200_000_000;
  driver._bufferSize = 96_000;

  return { driver: driver as LogicAnalyzerDriver, rawDriver: driver, stream, parser };
};

const bytes = (value: Uint8Array | Buffer) => Array.from(value);
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));
const fixture = <T>(name: string): T => {
  const file = path.join(__dirname, '../../fixtures/drivers', name);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
};

const hexToBuffer = (hex: string): Buffer => Buffer.from(hex.replace(/\s+/g, ''), 'hex');
type PicoFrameFixture = {
  name: string;
  mode: string;
  channels: number[];
  sampleCount: number;
  frameHex: string;
  expectedChannelSamples: Record<string, number[]>;
};

const expectedRequest = (values: {
  triggerType: TriggerType;
  trigger: number;
  invertedOrCount: number;
  triggerValue: number;
  channels: number[];
  channelCount: number;
  frequency: number;
  preSamples: number;
  postSamples: number;
  loopCount: number;
  measure: number;
  captureMode: number;
}) => {
  const request = new CaptureRequest();
  request.triggerType = values.triggerType;
  request.trigger = values.trigger;
  request.invertedOrCount = values.invertedOrCount;
  request.triggerValue = values.triggerValue;
  values.channels.forEach((channelNumber, index) => {
    request.channels[index] = channelNumber;
  });
  request.channelCount = values.channelCount;
  request.frequency = values.frequency;
  request.preSamples = values.preSamples;
  request.postSamples = values.postSamples;
  request.loopCount = values.loopCount;
  request.measure = values.measure;
  request.captureMode = values.captureMode;
  return bytes(request.serialize());
};

describe('Pico 原版协议与采集语义对齐', () => {
  it('StartCapture 必须等待 CAPTURE_STARTED 后才返回 None 并进入采集状态', async () => {
    const { driver, rawDriver, parser } = connectedDriver();
    rawDriver.readCaptureData = jest.fn().mockReturnValue(new Promise(() => undefined));

    let settled = false;
    const start = driver.startCapture(session()).then(result => {
      settled = true;
      return result;
    });

    await nextTick();
    expect(settled).toBe(false);
    expect(driver.isCapturing).toBe(false);

    parser.emit('data', 'CAPTURE_STARTED');

    await expect(start).resolves.toBe(CaptureError.None);
    expect(driver.isCapturing).toBe(true);
  });

  it('串口采集启动后必须停止文本 parser 消费后续二进制流', async () => {
    const { driver, rawDriver, stream, parser } = connectedDriver();
    rawDriver.readCaptureData = jest.fn().mockReturnValue(new Promise(() => undefined));

    const start = driver.startCapture(session());
    await nextTick();
    parser.emit('data', 'CAPTURE_STARTED');
    await start;

    expect(stream.unpipe).toHaveBeenCalledWith(parser);
  });

  it('串口二进制帧在同一个 data chunk 中到达时必须完成采集并提取通道样本', async () => {
    const frame = fixture<{
      frameHex: string;
      expectedChannelSamples: Record<string, number[]>;
    }>('pico-serial-8ch-single-frame.json');
    const { driver, stream, parser } = connectedDriver();
    const captureSession = session({
      preTriggerSamples: 2,
      postTriggerSamples: 2,
      captureChannels: [channel(0), channel(1)]
    });
    let completedEvent: CaptureEventArgs | undefined;
    driver.once('captureCompleted', event => {
      completedEvent = event;
    });

    const start = driver.startCapture(captureSession);
    await nextTick();
    parser.emit('data', 'CAPTURE_STARTED');
    await expect(start).resolves.toBe(CaptureError.None);

    stream.emit('data', hexToBuffer(frame.frameHex));
    await nextTick();

    expect(completedEvent?.success).toBe(true);
    expect(bytes(captureSession.captureChannels[0].samples)).toEqual(frame.expectedChannelSamples['0']);
    expect(bytes(captureSession.captureChannels[1].samples)).toEqual(frame.expectedChannelSamples['1']);
    expect(driver.isCapturing).toBe(false);
  });

  it.each(fixture<{ cases: PicoFrameFixture[] }>('pico-serial-non-contiguous-channel-frames.json').cases)(
    '$mode 模式必须按真实 channelNumber 拆分非连续通道样本',
    async frame => {
      const { driver, stream, parser } = connectedDriver();
      const captureSession = session({
        preTriggerSamples: 2,
        postTriggerSamples: 2,
        captureChannels: frame.channels.map(channel)
      });
      let completedEvent: CaptureEventArgs | undefined;
      driver.once('captureCompleted', event => {
        completedEvent = event;
      });

      const start = driver.startCapture(captureSession);
      await nextTick();
      parser.emit('data', 'CAPTURE_STARTED');
      await expect(start).resolves.toBe(CaptureError.None);

      stream.emit('data', hexToBuffer(frame.frameHex));
      await nextTick();

      expect(completedEvent?.success).toBe(true);
      for (const captureChannel of captureSession.captureChannels) {
        expect(bytes(captureChannel.samples)).toEqual(
          frame.expectedChannelSamples[String(captureChannel.channelNumber)]
        );
      }
      expect(driver.isCapturing).toBe(false);
    }
  );

  it('StopCapture 在空闲时必须返回 false', async () => {
    const { driver } = connectedDriver();

    await expect(driver.stopCapture()).resolves.toBe(false);
  });

  it('串口电压状态必须返回 3.3V', async () => {
    const { driver } = connectedDriver();

    await expect(driver.getVoltageStatus()).resolves.toBe('3.3V');
  });

  it('Blast 触发只接受 pre=0、frequency=BlastFrequency、loopCount=0', async () => {
    const { driver } = connectedDriver();

    await expect(driver.startCapture(session({
      triggerType: TriggerType.Blast,
      preTriggerSamples: 10,
      postTriggerSamples: 1000,
      frequency: 100_000_000,
      loopCount: 1
    }))).resolves.toBe(CaptureError.BadParams);
  });

  it('getLimits 必须使用原版 totalSamples - 2 的 post 上限', () => {
    const { driver } = connectedDriver();

    expect(driver.getLimits([0, 1, 2])).toEqual({
      minPreSamples: 2,
      maxPreSamples: 9600,
      minPostSamples: 2,
      maxPostSamples: 86400,
      maxTotalSamples: 96000
    });
  });

  it('Blink 和 StopBlink 必须发送命令 5/6 并等待原版响应', async () => {
    const { driver, parser, stream } = connectedDriver();

    const blink = driver.blink();
    await nextTick();
    parser.emit('data', 'BLINKON');
    await expect(blink).resolves.toBe(true);

    const stopBlink = driver.stopBlink();
    await nextTick();
    parser.emit('data', 'BLINKOFF');
    await expect(stopBlink).resolves.toBe(true);

    expect(bytes(stream.writes[0])).toEqual([0x55, 0xaa, 0x05, 0xaa, 0x55]);
    expect(bytes(stream.writes[1])).toEqual([0x55, 0xaa, 0x06, 0xaa, 0x55]);
  });

  it.each([
    [
      'Edge',
      session({ triggerType: TriggerType.Edge, triggerChannel: 2, triggerInverted: true }),
      expectedRequest({
        triggerType: TriggerType.Edge,
        trigger: 2,
        invertedOrCount: 1,
        triggerValue: 0,
        channels: [0, 3, 8],
        channelCount: 3,
        frequency: 24_000_000,
        preSamples: 100,
        postSamples: 1000,
        loopCount: 0,
        measure: 0,
        captureMode: 1
      })
    ],
    [
      'Blast',
      session({
        triggerType: TriggerType.Blast,
        frequency: 200_000_000,
        preTriggerSamples: 0,
        postTriggerSamples: 1000
      }),
      expectedRequest({
        triggerType: TriggerType.Blast,
        trigger: 0,
        invertedOrCount: 0,
        triggerValue: 0,
        channels: [0, 3, 8],
        channelCount: 3,
        frequency: 200_000_000,
        preSamples: 0,
        postSamples: 1000,
        loopCount: 0,
        measure: 0,
        captureMode: 1
      })
    ],
    [
      'Complex',
      session({
        frequency: 25_000_000,
        triggerType: TriggerType.Complex,
        triggerChannel: 4,
        triggerBitCount: 3,
        triggerPattern: 0x05aa,
        preTriggerSamples: 100,
        postTriggerSamples: 1000
      }),
      expectedRequest({
        triggerType: TriggerType.Complex,
        trigger: 4,
        invertedOrCount: 3,
        triggerValue: 0x05aa,
        channels: [0, 3, 8],
        channelCount: 3,
        frequency: 25_000_000,
        preSamples: 102,
        postSamples: 998,
        loopCount: 0,
        measure: 0,
        captureMode: 1
      })
    ],
    [
      'Fast',
      session({
        frequency: 25_000_000,
        triggerType: TriggerType.Fast,
        triggerChannel: 1,
        triggerBitCount: 2,
        triggerPattern: 0x0003,
        preTriggerSamples: 100,
        postTriggerSamples: 1000
      }),
      expectedRequest({
        triggerType: TriggerType.Fast,
        trigger: 1,
        invertedOrCount: 2,
        triggerValue: 0x0003,
        channels: [0, 3, 8],
        channelCount: 3,
        frequency: 25_000_000,
        preSamples: 101,
        postSamples: 999,
        loopCount: 0,
        measure: 0,
        captureMode: 1
      })
    ]
  ])('%s CaptureRequest 字节必须与 C# 结构体 fixture 一致', (_name, captureSession, expected) => {
    const { rawDriver } = connectedDriver();
    const mode = rawDriver.getCaptureMode(captureSession.captureChannels.map((ch: AnalyzerChannel) => ch.channelNumber));
    const requestedSamples = captureSession.preTriggerSamples +
      captureSession.postTriggerSamples * (captureSession.loopCount + 1);

    const request = rawDriver.composeRequest(captureSession, requestedSamples, mode);

    expect(bytes(request.serialize())).toEqual(expected);
  });

  it('CaptureRequest.fromConfiguration 和 CaptureModels 构建器必须写入通道号列表而不是 bit mask', () => {
    const request = CaptureRequest.fromConfiguration({
      frequency: 1_000_000,
      preTriggerSamples: 2,
      postTriggerSamples: 10,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      triggerInverted: false,
      loopCount: 0,
      measureBursts: false,
      captureChannels: [0, 3, 8]
    });

    const modelBytes = CaptureRequestBuilder.buildCaptureRequest(session({
      frequency: 1_000_000,
      preTriggerSamples: 2,
      postTriggerSamples: 10,
      captureChannels: [channel(0), channel(3), channel(8)]
    }));

    expect(bytes(request.channels.slice(0, 4))).toEqual([0, 3, 8, 0]);
    expect(bytes(modelBytes.slice(5, 9))).toEqual([0, 3, 8, 0]);
  });

  it('OutputPacket 必须按 C# 规则转义 0xAA、0x55、0xF0', () => {
    const packet = new OutputPacket();
    packet.addBytes([0xaa, 0x55, 0xf0]);

    expect(bytes(packet.serialize())).toEqual([
      0x55,
      0xaa,
      0xf0,
      0x5a,
      0xf0,
      0xa5,
      0xf0,
      0x00,
      0xaa,
      0x55
    ]);
  });
});
