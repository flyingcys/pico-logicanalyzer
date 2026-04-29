import { DecoderManager } from '../../../../src/decoders/DecoderManager';
import { LINDecoder } from '../../../../src/decoders/protocols/LINDecoder';
import { ChannelData, DecoderOptionValue, DecoderResult } from '../../../../src/decoders/types';

const SAMPLE_RATE = 19_200;

interface LINFrameInput {
  pid: number;
  data?: number[];
  checksum?: number;
  breakBits?: number;
}

function pushByte(bits: number[], byte: number): void {
  bits.push(0);
  for (let bit = 0; bit < 8; bit++) {
    bits.push((byte >> bit) & 1);
  }
  bits.push(1);
}

function linFrameBits(input: LINFrameInput): number[] {
  const bits: number[] = [
    1,
    1,
    ...Array.from({ length: input.breakBits ?? 13 }, () => 0),
    1
  ];

  pushByte(bits, 0x55);
  pushByte(bits, input.pid);

  for (const byte of input.data ?? []) {
    pushByte(bits, byte);
  }

  if (input.checksum !== undefined) {
    pushByte(bits, input.checksum);
  }

  return bits;
}

function linFramesToChannels(frames: LINFrameInput[]): ChannelData[] {
  const samples = frames.flatMap((frame, index) => [
    ...(index === 0 ? [] : [1, 1, 1]),
    ...linFrameBits(frame)
  ]);

  return [
    {
      channelNumber: 0,
      channelName: 'LIN_RX',
      samples: new Uint8Array(samples)
    }
  ];
}

function decode(
  frames: LINFrameInput[],
  options: DecoderOptionValue[] = []
): DecoderResult[] {
  return new LINDecoder().decode(SAMPLE_RATE, linFramesToChannels(frames), options);
}

function expectSegment(
  results: DecoderResult[],
  annotationType: number,
  values: string[],
  rawData?: number
): void {
  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        annotationType,
        values,
        ...(rawData === undefined ? {} : { rawData })
      })
    ])
  );
}

function warningValues(results: DecoderResult[]): string[][] {
  return results
    .filter(result => result.annotationType === 6)
    .map(result => result.values);
}

describe('LINDecoder raw logic main path', () => {
  it('decodes multiple frames from one capture lifecycle', () => {
    const results = decode([
      { pid: 0x50, data: [0xa5], checksum: 0x5a },
      { pid: 0x11, data: [0x5a], checksum: 0xa5 }
    ], [
      { optionIndex: 1, value: 1 }
    ]);

    expect(results.filter(result => result.annotationType === 0)).toHaveLength(2);
    expectSegment(results, 2, ['PID: 50', '50'], 0x50);
    expectSegment(results, 4, ['Data[0]: A5', 'A5'], 0xa5);
    expectSegment(results, 5, ['Checksum: 5A', '5A'], 0x5a);
    expectSegment(results, 2, ['PID: 11', '11'], 0x11);
    expectSegment(results, 4, ['Data[0]: 5A', '5A'], 0x5a);
    expectSegment(results, 5, ['Checksum: A5', 'A5'], 0xa5);
    expect(warningValues(results)).toHaveLength(0);
  });

  it('marks a header-only frame as no response without missing-data noise', () => {
    const results = decode([{ pid: 0x50 }]);

    expectSegment(results, 0, ['Break']);
    expectSegment(results, 1, ['Sync: 55', '55'], 0x55);
    expectSegment(results, 2, ['PID: 50', '50'], 0x50);
    expect(warningValues(results)).toEqual([['No response', 'No response']]);
  });

  it('reports PID parity errors on the LIN header', () => {
    const results = decode([
      { pid: 0x10, data: [0x12], checksum: 0xed }
    ], [
      { optionIndex: 1, value: 1 }
    ]);

    expect(warningValues(results)).toContainEqual(['PID parity error', 'PID parity']);
  });

  it('uses LIN 2.x enhanced checksums except for diagnostic identifiers', () => {
    const results = decode([
      { pid: 0x50, data: [0x01, 0x02], checksum: 0xac },
      { pid: 0x3c, data: [0x01, 0x02], checksum: 0xfc }
    ], [
      { optionIndex: 2, value: 'lin2.x' }
    ]);

    expectSegment(results, 5, ['Checksum: AC', 'AC'], 0xac);
    expectSegment(results, 5, ['Checksum: FC', 'FC'], 0xfc);
    expect(warningValues(results)).toHaveLength(0);
  });

  it('reports checksum errors in a dedicated LIN unit test', () => {
    const results = decode([
      { pid: 0x50, data: [0x12, 0x34], checksum: 0x00 }
    ]);

    expect(warningValues(results)).toContainEqual([
      'Checksum error: expected B9',
      'Checksum error'
    ]);
  });

  it('runs through DecoderManager with explicit LIN channel mapping', async () => {
    const manager = new DecoderManager();
    const channels: ChannelData[] = [
      { channelNumber: 0, channelName: 'UNUSED', samples: new Uint8Array([1, 1, 1]) },
      ...linFramesToChannels([{ pid: 0x50, data: [0xa5], checksum: 0x5a }])
    ];

    const result = await manager.executeDecoder('lin', SAMPLE_RATE, channels, [
      { optionIndex: 1, value: 1 }
    ], [
      { captureIndex: 1, decoderIndex: 0 }
    ]);

    expect(result.success).toBe(true);
    expectSegment(result.results, 4, ['Data[0]: A5', 'A5'], 0xa5);
  });
});
