import { DecoderManager } from '../../../../src/decoders/DecoderManager';
import { CANDecoder } from '../../../../src/decoders/protocols/CANDecoder';
import { ChannelData, DecoderResult } from '../../../../src/decoders/types';

interface CanFrameInput {
  identifier: number;
  data: number[];
  ack?: boolean;
  crcDelimiter?: number;
  crcBits?: number[];
  stuff?: 'valid' | 'invalid' | 'none';
}

const BITRATE = 1_000_000;
const SAMPLES_PER_BIT = 8;
const SAMPLE_RATE = BITRATE * SAMPLES_PER_BIT;
const CAN_OPTIONS = [
  { optionIndex: 0, value: BITRATE },
  { optionIndex: 1, value: 50 }
];

function pushBits(bits: number[], value: number, width: number): void {
  for (let bit = width - 1; bit >= 0; bit--) {
    bits.push((value >> bit) & 1);
  }
}

function computeCanCrc(bits: number[]): number[] {
  let crc = 0;

  for (const bit of bits) {
    const msb = (crc >> 14) & 1;
    crc = ((crc << 1) & 0x7fff) | bit;
    if (msb) {
      crc ^= 0x4599;
    }
  }

  return Array.from({ length: 15 }, (_, index) => (crc >> (14 - index)) & 1);
}

function buildClassicCanPrefix(frame: CanFrameInput): number[] {
  const bits: number[] = [0];

  pushBits(bits, frame.identifier, 11);
  bits.push(0, 0, 0);
  pushBits(bits, Math.min(frame.data.length, 8), 4);

  for (const byte of frame.data.slice(0, 8)) {
    pushBits(bits, byte, 8);
  }

  bits.push(...(frame.crcBits ?? computeCanCrc(bits)));
  return bits;
}

function applyCanStuffing(bits: number[], mode: 'valid' | 'invalid' | 'none'): number[] {
  if (mode === 'none') {
    return [...bits];
  }

  const stuffed: number[] = [];
  let lastBit: number | undefined;
  let runLength = 0;
  let invalidStuffInserted = false;

  for (const bit of bits) {
    stuffed.push(bit);

    if (bit === lastBit) {
      runLength++;
    } else {
      lastBit = bit;
      runLength = 1;
    }

    if (runLength === 5) {
      const stuffBit = mode === 'invalid' && !invalidStuffInserted ? bit : bit ^ 1;
      stuffed.push(stuffBit);
      invalidStuffInserted = true;
      lastBit = undefined;
      runLength = 0;
    }
  }

  return stuffed;
}

function buildClassicCanFrameBits(frame: CanFrameInput): number[] {
  const prefix = buildClassicCanPrefix(frame);
  const stuffedPrefix = applyCanStuffing(prefix, frame.stuff ?? 'valid');

  return [
    ...stuffedPrefix,
    frame.crcDelimiter ?? 1,
    frame.ack === false ? 1 : 0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1
  ];
}

function bitsToSamples(bits: number[], samplesPerBit = SAMPLES_PER_BIT): number[] {
  return bits.flatMap(bit => Array.from({ length: samplesPerBit }, () => bit));
}

function bitsToSamplesWithDelayedDominantEdge(bits: number[], delaySamples: number): number[] {
  const samples: number[] = [];
  let delayed = false;

  for (let index = 0; index < bits.length; index++) {
    const nextBit = bits[index + 1];
    const shouldDelay =
      !delayed &&
      index > 0 &&
      bits[index] === 1 &&
      nextBit === 0;
    const length = shouldDelay ? SAMPLES_PER_BIT + delaySamples : SAMPLES_PER_BIT;

    samples.push(...Array.from({ length }, () => bits[index]));

    if (shouldDelay) {
      delayed = true;
    }
  }

  return samples;
}

function framesToChannels(frames: CanFrameInput[]): ChannelData[] {
  const bits = frames.flatMap((frame, index) => [
    ...(index === 0 ? [] : [1, 1, 1]),
    ...buildClassicCanFrameBits(frame)
  ]);

  return [
    {
      channelNumber: 0,
      channelName: 'CAN_RX',
      samples: new Uint8Array([1, 1, ...bitsToSamples(bits), 1, 1])
    }
  ];
}

function delayedEdgeFrameToChannels(frame: CanFrameInput): ChannelData[] {
  const bits = buildClassicCanFrameBits(frame);

  return [
    {
      channelNumber: 0,
      channelName: 'CAN_RX',
      samples: new Uint8Array([1, 1, ...bitsToSamplesWithDelayedDominantEdge(bits, 5), 1, 1])
    }
  ];
}

function decode(channels: ChannelData[]): DecoderResult[] {
  return new CANDecoder().decode(SAMPLE_RATE, channels, CAN_OPTIONS);
}

describe('CANDecoder classic CAN 闭环', () => {
  it('通过 DecoderManager 持续扫描同一 capture 中的多个 classic 数据帧', async () => {
    const canChannel = framesToChannels([
      { identifier: 0x123, data: [0x11], stuff: 'valid' },
      { identifier: 0x321, data: [0x22, 0x33], stuff: 'valid' }
    ])[0];
    const channels: ChannelData[] = [
      {
        channelNumber: 0,
        channelName: 'NOISE',
        samples: new Uint8Array(canChannel.samples.length).fill(1)
      },
      canChannel
    ];
    const manager = new DecoderManager();

    const result = await manager.executeDecoder('can', SAMPLE_RATE, channels, CAN_OPTIONS, [
      { captureIndex: 1, decoderIndex: 0 }
    ]);

    expect(result.success).toBe(true);
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ annotationType: 1, values: ['ID: 123', '123'], rawData: 0x123 }),
        expect.objectContaining({ annotationType: 4, values: ['Data[0]: 11', '11'], rawData: 0x11 }),
        expect.objectContaining({ annotationType: 1, values: ['ID: 321', '321'], rawData: 0x321 }),
        expect.objectContaining({ annotationType: 4, values: ['Data[0]: 22', '22'], rawData: 0x22 }),
        expect.objectContaining({ annotationType: 4, values: ['Data[1]: 33', '33'], rawData: 0x33 })
      ])
    );
  });

  it('移除 SOF 到 CRC 字段中的 stuff bit 后解析 classic CAN 字段', () => {
    const results = decode(framesToChannels([
      { identifier: 0x000, data: [0x00], stuff: 'valid' }
    ]));

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ annotationType: 1, values: ['ID: 000', '000'], rawData: 0x000 }),
        expect.objectContaining({ annotationType: 3, values: ['DLC: 1', '1'], rawData: 1 }),
        expect.objectContaining({ annotationType: 4, values: ['Data[0]: 00', '00'], rawData: 0x00 }),
        expect.objectContaining({ annotationType: 6, values: ['ACK'] }),
        expect.objectContaining({ annotationType: 7, values: ['EOF'] })
      ])
    );
    expect(results).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ annotationType: 8, values: ['Stuff bit error', 'Stuff'] })
      ])
    );
  });

  it('遇到缺失互补 stuff bit 时输出错误边界 warning', () => {
    const results = decode(framesToChannels([
      { identifier: 0x000, data: [0x00], stuff: 'invalid' }
    ]));

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ annotationType: 8, values: ['Stuff bit error', 'Stuff'] })
      ])
    );
  });

  it('dominant edge 延迟时重新同步后续采样', () => {
    const results = decode(delayedEdgeFrameToChannels({
      identifier: 0x7ff,
      data: [0x80],
      stuff: 'valid',
      crcBits: computeCanCrc(buildClassicCanPrefix({
        identifier: 0x7ff,
        data: [0x80],
        stuff: 'valid'
      }).slice(0, -15))
    }));

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ annotationType: 1, values: ['ID: 7FF', '7FF'], rawData: 0x7ff }),
        expect.objectContaining({ annotationType: 4, values: ['Data[0]: 80', '80'], rawData: 0x80 }),
        expect.objectContaining({ annotationType: 7, values: ['EOF'] })
      ])
    );
  });

  it('在 classic CAN 帧上输出 CRC 数值并对 mismatch 给出 warning', () => {
    const results = decode(framesToChannels([
      {
        identifier: 0x123,
        data: [0x11, 0x22],
        stuff: 'valid',
        crcBits: Array.from({ length: 15 }, () => 0)
      }
    ]));

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ annotationType: 5, values: ['CRC: 0000', '0000'], rawData: 0x0000 }),
        expect.objectContaining({
          annotationType: 8,
          values: ['CRC mismatch', 'CRC'],
          rawData: expect.objectContaining({ expected: expect.any(Number), actual: 0x0000 })
        })
      ])
    );
  });
});
