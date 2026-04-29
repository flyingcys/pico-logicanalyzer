import { DecoderManager } from '../../../../src/decoders/DecoderManager';
import { I2SDecoder } from '../../../../src/decoders/protocols/I2SDecoder';
import { ChannelData, DecoderOptionValue, DecoderResult } from '../../../../src/decoders/types';

interface I2SSegment {
  ws: 0 | 1;
  bits: number[];
  delayed?: boolean;
}

const bitsFromNumber = (value: number, width: number): number[] =>
  Array.from({ length: width }, (_, index) => {
    const divisor = 2 ** (width - index - 1);
    return Math.floor(value / divisor) % 2;
  });

const createI2SChannels = (segments: I2SSegment[]): ChannelData[] => {
  const sck: number[] = [];
  const ws: number[] = [];
  const sd: number[] = [];

  const pushBit = (wordSelect: 0 | 1, bitValue: number): void => {
    sck.push(0, 1);
    ws.push(wordSelect, wordSelect);
    sd.push(bitValue, bitValue);
  };

  for (const segment of segments) {
    if (segment.delayed !== false) {
      pushBit(segment.ws, 0);
    }

    for (const bit of segment.bits) {
      pushBit(segment.ws, bit);
    }
  }

  return [
    { channelNumber: 0, channelName: 'SCK', samples: new Uint8Array(sck) },
    { channelNumber: 1, channelName: 'WS', samples: new Uint8Array(ws) },
    { channelNumber: 2, channelName: 'SD', samples: new Uint8Array(sd) }
  ];
};

const i2sOptions = (wordLength: number): DecoderOptionValue[] => [
  { optionIndex: 0, value: wordLength },
  { optionIndex: 1, value: 'i2s' }
];

const sampleAnnotations = (results: DecoderResult[]): DecoderResult[] =>
  results.filter(result => result.annotationType === 0 || result.annotationType === 1);

describe('I2SDecoder', () => {
  it('32 bit sample values keep unsigned semantics when the high bit is set', () => {
    const channels = createI2SChannels([
      { ws: 0, bits: bitsFromNumber(0x80000000, 32) },
      { ws: 1, bits: bitsFromNumber(0xfedcba98, 32) }
    ]);

    const results = new I2SDecoder().decode(2_000_000, channels, i2sOptions(32));

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 0,
          values: ['Left: 80000000', 'L: 80000000', '80000000'],
          rawData: 0x80000000
        }),
        expect.objectContaining({
          annotationType: 1,
          values: ['Right: FEDCBA98', 'R: FEDCBA98', 'FEDCBA98'],
          rawData: 0xfedcba98
        })
      ])
    );
  });

  it('uses WS transitions as word boundaries and warns about surplus bits', () => {
    const channels = createI2SChannels([
      { ws: 0, bits: bitsFromNumber(0x1234, 16).concat([1, 0, 1]) },
      { ws: 1, bits: bitsFromNumber(0xabcd, 16) }
    ]);

    const results = new I2SDecoder().decode(2_000_000, channels, i2sOptions(16));
    const leftSample = results.find(result => result.annotationType === 0);

    expect(leftSample).toEqual(
      expect.objectContaining({
        startSample: 1,
        endSample: 41,
        values: ['Left: 1234', 'L: 1234', '1234'],
        rawData: 0x1234
      })
    );
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 3,
          values: ['Extra bits after word', 'Extra bits', 'Extra'],
          rawData: 3
        }),
        expect.objectContaining({
          annotationType: 1,
          values: ['Right: ABCD', 'R: ABCD', 'ABCD'],
          rawData: 0xabcd
        })
      ])
    );
  });

  it('drops an unsynchronized leading fragment before the first complete WS-bounded word', () => {
    const channels = createI2SChannels([
      { ws: 0, bits: [1, 0, 1], delayed: false },
      { ws: 1, bits: bitsFromNumber(0x5aa5, 16) }
    ]);

    const results = new I2SDecoder().decode(2_000_000, channels, i2sOptions(16));

    expect(sampleAnnotations(results)).toEqual([
      expect.objectContaining({
        annotationType: 1,
        values: ['Right: 5AA5', 'R: 5AA5', '5AA5'],
        rawData: 0x5aa5
      })
    ]);
    expect(results.filter(result => result.annotationType === 3)).toHaveLength(0);
  });

  it('resets cached instance options when executed through DecoderManager', async () => {
    const manager = new DecoderManager();
    const firstChannels = createI2SChannels([
      { ws: 0, bits: bitsFromNumber(0x12345678, 32) },
      { ws: 1, bits: bitsFromNumber(0x9abcdef0, 32) }
    ]);
    const secondChannels = createI2SChannels([
      { ws: 0, bits: bitsFromNumber(0x1234, 16) },
      { ws: 1, bits: bitsFromNumber(0xabcd, 16) }
    ]);

    try {
      const firstRun = await manager.executeDecoder('i2s', 2_000_000, firstChannels, i2sOptions(32));
      const secondRun = await manager.executeDecoder('i2s', 2_000_000, secondChannels, []);

      expect(firstRun.success).toBe(true);
      expect(secondRun.success).toBe(true);
      expect(secondRun.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            annotationType: 0,
            values: ['Left: 1234', 'L: 1234', '1234'],
            rawData: 0x1234
          }),
          expect.objectContaining({
            annotationType: 1,
            values: ['Right: ABCD', 'R: ABCD', 'ABCD'],
            rawData: 0xabcd
          })
        ])
      );
    } finally {
      manager.dispose();
    }
  });

  it('honors DecoderManager channel mapping for SCK, WS, and SD', async () => {
    const manager = new DecoderManager();
    const [sck, ws, sd] = createI2SChannels([
      { ws: 0, bits: bitsFromNumber(0xa55a, 16) },
      { ws: 1, bits: bitsFromNumber(0x5aa5, 16) }
    ]);
    const reorderedChannels = [sd, sck, ws];

    try {
      const run = await manager.executeDecoder('i2s', 2_000_000, reorderedChannels, i2sOptions(16), [
        { captureIndex: 1, decoderIndex: 0 },
        { captureIndex: 2, decoderIndex: 1 },
        { captureIndex: 0, decoderIndex: 2 }
      ]);

      expect(run.success).toBe(true);
      expect(run.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            annotationType: 0,
            values: ['Left: A55A', 'L: A55A', 'A55A'],
            rawData: 0xa55a
          }),
          expect.objectContaining({
            annotationType: 1,
            values: ['Right: 5AA5', 'R: 5AA5', '5AA5'],
            rawData: 0x5aa5
          })
        ])
      );
    } finally {
      manager.dispose();
    }
  });
});
