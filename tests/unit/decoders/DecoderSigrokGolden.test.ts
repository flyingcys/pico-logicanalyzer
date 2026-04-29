import sigrokGolden from '../../fixtures/decoders/sigrok-golden.json';
import {
  getDecoderExtensionPlan,
  getDecoderExtensionRoadmap,
  getExternalSigrokProtocolIds
} from '../../../src/decoders/DecoderSigrokParity';
import { I2CDecoder } from '../../../src/decoders/protocols/I2CDecoder';
import { SPIDecoder } from '../../../src/decoders/protocols/SPIDecoder';
import { UARTDecoder } from '../../../src/decoders/protocols/UARTDecoder';
import { CANDecoder } from '../../../src/decoders/protocols/CANDecoder';
import { LINDecoder } from '../../../src/decoders/protocols/LINDecoder';
import { I2SDecoder } from '../../../src/decoders/protocols/I2SDecoder';
import { ChannelData, DecoderOptionValue, DecoderResult } from '../../../src/decoders/types';

type GoldenCategory = 'normal' | 'error' | 'boundary';
type GoldenProtocol = 'i2c' | 'spi' | 'uart' | 'can' | 'lin' | 'i2s';

interface ExpectedSegment {
  annotationType: number;
  values: string[];
  rawData?: number;
}

interface GoldenCase {
  id: string;
  protocol: GoldenProtocol;
  category: GoldenCategory;
  sampleRate: number;
  input: any;
  options: DecoderOptionValue[];
  expected: ExpectedSegment[];
}

const cases = sigrokGolden.cases as GoldenCase[];

function logicChannelsToChannelData(
  channels: Array<{ channelNumber: number; channelName: string; samples: number[] }>
): ChannelData[] {
  return channels.map(channel => ({
    ...channel,
    samples: new Uint8Array(channel.samples)
  }));
}

function i2cOperationsToChannels(operations: Array<{ type: string; value?: number }>): ChannelData[] {
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
        const value = ((operation.value ?? 0) >> bit) & 1;
        push([0, 0, 1, 1], [value, value, value, value]);
      }
    } else if (operation.type === 'ack' || operation.type === 'nack') {
      const value = operation.type === 'ack' ? 0 : 1;
      push([0, 0, 1, 1], [value, value, value, value]);
    }
  }

  return [
    { channelNumber: 0, channelName: 'SCL', samples: new Uint8Array(scl) },
    { channelNumber: 1, channelName: 'SDA', samples: new Uint8Array(sda) }
  ];
}

function spiTransferToChannels(input: {
  miso: number[];
  mosi: number[];
  cs: 'active-low' | 'active-high';
}): ChannelData[] {
  const clk: number[] = [0];
  const miso: number[] = [input.miso[0] ?? 0];
  const mosi: number[] = [input.mosi[0] ?? 0];
  const asserted = input.cs === 'active-low' ? 0 : 1;
  const deasserted = input.cs === 'active-low' ? 1 : 0;
  const cs: number[] = [asserted];

  for (let bit = 0; bit < input.miso.length; bit++) {
    clk.push(1, 0);
    miso.push(input.miso[bit], input.miso[bit]);
    mosi.push(input.mosi[bit], input.mosi[bit]);
    cs.push(asserted, asserted);
  }

  clk.push(0);
  miso.push(input.miso[input.miso.length - 1] ?? 0);
  mosi.push(input.mosi[input.mosi.length - 1] ?? 0);
  cs.push(deasserted);

  return [
    { channelNumber: 0, channelName: 'CLK', samples: new Uint8Array(clk) },
    { channelNumber: 1, channelName: 'MISO', samples: new Uint8Array(miso) },
    { channelNumber: 2, channelName: 'MOSI', samples: new Uint8Array(mosi) },
    { channelNumber: 3, channelName: 'CS', samples: new Uint8Array(cs) }
  ];
}

function bitsToSamples(bits: number[], samplesPerBit = 1): number[] {
  return bits.flatMap(bit => Array.from({ length: samplesPerBit }, () => bit));
}

function canFrameToChannels(input: {
  identifier: number;
  extended?: boolean;
  data: number[];
  ack?: boolean;
  crcDelimiter?: number;
  samplesPerBit?: number;
}): ChannelData[] {
  const bits = buildCanFrameBits(input);

  return [
    {
      channelNumber: 0,
      channelName: 'CAN_RX',
      samples: new Uint8Array([1, 1, ...bitsToSamples(bits, input.samplesPerBit ?? 1), 1, 1])
    }
  ];
}

function buildCanFrameBits(input: {
  identifier: number;
  extended?: boolean;
  data: number[];
  ack?: boolean;
  crcDelimiter?: number;
}): number[] {
  const bits: number[] = [0];
  if (input.extended) {
    const baseId = (input.identifier >> 18) & 0x7ff;
    const extId = input.identifier & 0x3ffff;
    for (let bit = 10; bit >= 0; bit--) bits.push((baseId >> bit) & 1);
    bits.push(1, 1);
    for (let bit = 17; bit >= 0; bit--) bits.push((extId >> bit) & 1);
    bits.push(0, 0, 0);
  } else {
    for (let bit = 10; bit >= 0; bit--) bits.push((input.identifier >> bit) & 1);
    bits.push(0, 0, 0);
  }
  for (let bit = 3; bit >= 0; bit--) bits.push((input.data.length >> bit) & 1);
  for (const byte of input.data) {
    for (let bit = 7; bit >= 0; bit--) bits.push((byte >> bit) & 1);
  }
  bits.push(...Array.from({ length: 15 }, () => 0));
  bits.push(input.crcDelimiter ?? 1, input.ack === false ? 1 : 0, 1, 1, 1, 1, 1, 1, 1);
  return bits;
}

function canFramesToChannels(
  frames: Array<{
    identifier: number;
    extended?: boolean;
    data: number[];
    ack?: boolean;
    crcDelimiter?: number;
  }>,
  samplesPerBit = 1
): ChannelData[] {
  const bits = frames.flatMap((frame, index) => [
    ...(index === 0 ? [] : [1, 1, 1]),
    ...buildCanFrameBits(frame)
  ]);

  return [
    {
      channelNumber: 0,
      channelName: 'CAN_RX',
      samples: new Uint8Array([1, 1, ...bitsToSamples(bits, samplesPerBit), 1, 1])
    }
  ];
}

function linFrameToChannels(input: {
  pid: number;
  data?: number[];
  checksum?: number;
  breakBits?: number;
}): ChannelData[] {
  const bits: number[] = [1, 1, ...Array.from({ length: input.breakBits ?? 13 }, () => 0), 1];
  const pushByte = (byte: number) => {
    bits.push(0);
    for (let bit = 0; bit < 8; bit++) bits.push((byte >> bit) & 1);
    bits.push(1);
  };

  pushByte(0x55);
  pushByte(input.pid);
  for (const byte of input.data ?? []) pushByte(byte);
  if (input.checksum !== undefined) {
    pushByte(input.checksum);
  }

  return [
    {
      channelNumber: 0,
      channelName: 'LIN_RX',
      samples: new Uint8Array(bits)
    }
  ];
}

function i2sWordsToChannels(input: {
  wordLength: number;
  left: number;
  right: number;
}): ChannelData[] {
  const sck: number[] = [];
  const ws: number[] = [];
  const sd: number[] = [];
  const pushBit = (wordSelect: number, bitValue: number) => {
    sck.push(0, 1);
    ws.push(wordSelect, wordSelect);
    sd.push(bitValue, bitValue);
  };

  pushBit(0, 0);
  for (let bit = input.wordLength - 1; bit >= 0; bit--) pushBit(0, (input.left >> bit) & 1);
  pushBit(1, 0);
  for (let bit = input.wordLength - 1; bit >= 0; bit--) pushBit(1, (input.right >> bit) & 1);

  return [
    { channelNumber: 0, channelName: 'SCK', samples: new Uint8Array(sck) },
    { channelNumber: 1, channelName: 'WS', samples: new Uint8Array(ws) },
    { channelNumber: 2, channelName: 'SD', samples: new Uint8Array(sd) }
  ];
}

function i2sLeftJustifiedWordsToChannels(input: {
  wordLength: number;
  left: number;
  right: number;
}): ChannelData[] {
  const sck: number[] = [];
  const ws: number[] = [];
  const sd: number[] = [];
  const pushBit = (wordSelect: number, bitValue: number) => {
    sck.push(0, 1);
    ws.push(wordSelect, wordSelect);
    sd.push(bitValue, bitValue);
  };

  for (let bit = input.wordLength - 1; bit >= 0; bit--) pushBit(0, (input.left >> bit) & 1);
  for (let bit = input.wordLength - 1; bit >= 0; bit--) pushBit(1, (input.right >> bit) & 1);

  return [
    { channelNumber: 0, channelName: 'SCK', samples: new Uint8Array(sck) },
    { channelNumber: 1, channelName: 'WS', samples: new Uint8Array(ws) },
    { channelNumber: 2, channelName: 'SD', samples: new Uint8Array(sd) }
  ];
}

function inputToChannels(input: any): ChannelData[] {
  switch (input.kind) {
    case 'logic-channels':
      return logicChannelsToChannelData(input.channels);
    case 'i2c-operations': {
      const channels = i2cOperationsToChannels(input.operations);
      if (input.channelOrder === 'sda-scl') {
        return [
          { channelNumber: 0, channelName: 'SDA', samples: channels[1].samples },
          { channelNumber: 1, channelName: 'SCL', samples: channels[0].samples }
        ];
      }
      return channels;
    }
    case 'spi-transfer':
      return spiTransferToChannels(input);
    case 'can-frame':
      return canFrameToChannels(input);
    case 'can-frames':
      return canFramesToChannels(input.frames, input.samplesPerBit ?? 1);
    case 'lin-frame':
      return linFrameToChannels(input);
    case 'i2s-words':
      return i2sWordsToChannels(input);
    default:
      throw new Error(`未知 golden 输入类型: ${input.kind}`);
  }
}

function decodeGoldenCase(testCase: GoldenCase): DecoderResult[] {
  const channels = inputToChannels(testCase.input);

  switch (testCase.protocol) {
    case 'i2c':
      return new I2CDecoder().decode(testCase.sampleRate, channels, testCase.options);
    case 'spi':
      return new SPIDecoder().decode(testCase.sampleRate, channels, testCase.options);
    case 'uart':
      return new UARTDecoder().decode(testCase.sampleRate, channels, testCase.options);
    case 'can':
      return new CANDecoder().decode(testCase.sampleRate, channels, testCase.options);
    case 'lin':
      return new LINDecoder().decode(testCase.sampleRate, channels, testCase.options);
    case 'i2s':
      return new I2SDecoder().decode(testCase.sampleRate, channels, testCase.options);
  }
}

function expectGoldenSegments(results: DecoderResult[], expected: ExpectedSegment[]): void {
  if (expected.length === 0) {
    expect(results.filter(result => result.annotationType === 0 || result.annotationType === 1)).toHaveLength(0);
    return;
  }

  for (const segment of expected) {
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: segment.annotationType,
          values: segment.values,
          ...(segment.rawData === undefined ? {} : { rawData: segment.rawData })
        })
      ])
    );
  }
}

describe('sigrok golden 解码器对齐', () => {
  it.each(['i2c', 'spi', 'uart', 'can', 'lin', 'i2s'] as GoldenProtocol[])(
    '%s 同时具备正常、错误、边界三类 golden',
    protocol => {
      const categories = new Set(
        cases.filter(testCase => testCase.protocol === protocol).map(testCase => testCase.category)
      );

      expect(categories).toEqual(new Set(['normal', 'error', 'boundary']));
    }
  );

  it.each(cases)('$id 输出与 sigrok 风格 golden 对齐', testCase => {
    const results = decodeGoldenCase(testCase);

    expectGoldenSegments(results, testCase.expected);
  });

  it('I2S 32 位样本在最高位为 1 时保持无符号 rawData 和十六进制显示', () => {
    const channels = i2sWordsToChannels({
      wordLength: 32,
      left: 0x80000000,
      right: 0xfedcba98
    });

    const results = new I2SDecoder().decode(2_000_000, channels, [
      { optionIndex: 0, value: 32 },
      { optionIndex: 1, value: 'i2s' }
    ]);

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

  it('I2SDecoder 复用实例时，第二次空 option 解码应回到默认 word_length', () => {
    const decoder = new I2SDecoder();

    decoder.decode(2_000_000, i2sWordsToChannels({
      wordLength: 32,
      left: 0x12345678,
      right: 0x9abcdef0
    }), [
      { optionIndex: 0, value: 32 }
    ]);

    const secondChannels = i2sWordsToChannels({
      wordLength: 16,
      left: 0x1234,
      right: 0xabcd
    });

    const reusedResults = decoder.decode(2_000_000, secondChannels, []);
    const freshResults = new I2SDecoder().decode(2_000_000, secondChannels, []);

    expect(freshResults).toEqual(
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
    expect(reusedResults).toEqual(freshResults);
  });

  it('I2SDecoder 复用实例时，第二次空 option 解码应回到默认 justification', () => {
    const decoder = new I2SDecoder();

    decoder.decode(2_000_000, i2sLeftJustifiedWordsToChannels({
      wordLength: 16,
      left: 0xa55a,
      right: 0x5aa5
    }), [
      { optionIndex: 1, value: 'left' }
    ]);

    const secondChannels = i2sWordsToChannels({
      wordLength: 16,
      left: 0xa55a,
      right: 0x5aa5
    });

    const reusedResults = decoder.decode(2_000_000, secondChannels, []);
    const freshResults = new I2SDecoder().decode(2_000_000, secondChannels, []);

    expect(freshResults).toEqual(
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
    expect(reusedResults).toEqual(freshResults);
  });

  it('CAN 在同一 capture 中连续解析两个 classic 数据帧', () => {
    const channels = canFramesToChannels([
      { identifier: 0x555, data: [0xA5] },
      { identifier: 0x2AA, data: [0x5A] }
    ]);

    const results = new CANDecoder().decode(1_000_000, channels, [
      { optionIndex: 0, value: 1_000_000 },
      { optionIndex: 1, value: 50 }
    ]);

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 1,
          values: ['ID: 555', '555'],
          rawData: 0x555
        }),
        expect.objectContaining({
          annotationType: 4,
          values: ['Data[0]: A5', 'A5'],
          rawData: 0xA5
        }),
        expect.objectContaining({
          annotationType: 1,
          values: ['ID: 2AA', '2AA'],
          rawData: 0x2aa
        }),
        expect.objectContaining({
          annotationType: 4,
          values: ['Data[0]: 5A', '5A'],
          rawData: 0x5a
        })
      ])
    );
  });

  it('CANDecoder 复用实例时，第二次空 option 解码应回到默认 bitrate', () => {
    const decoder = new CANDecoder();
    const firstChannels = canFrameToChannels({
      identifier: 0x123,
      data: [0x45],
      samplesPerBit: 1
    });
    const secondChannels = canFrameToChannels({
      identifier: 0x321,
      data: [0x67],
      samplesPerBit: 2
    });

    decoder.decode(1_000_000, firstChannels, [
      { optionIndex: 0, value: 1_000_000 },
      { optionIndex: 1, value: 50 }
    ]);

    const reusedResults = decoder.decode(1_000_000, secondChannels, []);
    const freshResults = new CANDecoder().decode(1_000_000, secondChannels, []);

    expect(freshResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 1,
          values: ['ID: 321', '321'],
          rawData: 0x321
        }),
        expect.objectContaining({
          annotationType: 4,
          values: ['Data[0]: 67', '67'],
          rawData: 0x67
        })
      ])
    );
    expect(reusedResults).toEqual(freshResults);
  });

  it('LIN header-only capture 不应被强制标记为缺少 checksum', () => {
    const channels = linFrameToChannels({
      pid: 0x50
    });

    const results = new LINDecoder().decode(19_200, channels, [
      { optionIndex: 0, value: 19_200 },
      { optionIndex: 1, value: 0 },
      { optionIndex: 2, value: 'classic' }
    ]);

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 0,
          values: ['Break']
        }),
        expect.objectContaining({
          annotationType: 1,
          values: ['Sync: 55', '55'],
          rawData: 0x55
        }),
        expect.objectContaining({
          annotationType: 2,
          values: ['PID: 50', '50'],
          rawData: 0x50
        })
      ])
    );
    expect(results.filter(result => result.annotationType === 6)).toHaveLength(0);
  });

  it('LINDecoder 复用实例时，第二次空 option 解码应回到默认 classic checksum', () => {
    const decoder = new LINDecoder();

    decoder.decode(19_200, linFrameToChannels({
      pid: 0x50,
      data: [0x01, 0x02],
      checksum: 0xac
    }), [
      { optionIndex: 2, value: 'enhanced' }
    ]);

    const secondChannels = linFrameToChannels({
      pid: 0x50,
      data: [0x12, 0x34],
      checksum: 0xb9
    });

    const reusedResults = decoder.decode(19_200, secondChannels, []);
    const freshResults = new LINDecoder().decode(19_200, secondChannels, []);

    expect(freshResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 4,
          values: ['Data[1]: 34', '34'],
          rawData: 0x34
        }),
        expect.objectContaining({
          annotationType: 5,
          values: ['Checksum: B9', 'B9'],
          rawData: 0xb9
        })
      ])
    );
    expect(freshResults.filter(result => result.annotationType === 6)).toHaveLength(0);
    expect(reusedResults).toEqual(freshResults);
  });

  it('LINDecoder 复用实例时，第二次空 option 解码应回到默认 data_length', () => {
    const decoder = new LINDecoder();

    decoder.decode(19_200, linFrameToChannels({
      pid: 0x50,
      data: [0x12],
      checksum: 0xed
    }), [
      { optionIndex: 1, value: 1 }
    ]);

    const secondChannels = linFrameToChannels({
      pid: 0x50,
      data: [0x12, 0x34],
      checksum: 0xb9
    });

    const reusedResults = decoder.decode(19_200, secondChannels, []);
    const freshResults = new LINDecoder().decode(19_200, secondChannels, []);

    expect(freshResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          annotationType: 4,
          values: ['Data[0]: 12', '12'],
          rawData: 0x12
        }),
        expect.objectContaining({
          annotationType: 4,
          values: ['Data[1]: 34', '34'],
          rawData: 0x34
        }),
        expect.objectContaining({
          annotationType: 5,
          values: ['Checksum: B9', 'B9'],
          rawData: 0xb9
        })
      ])
    );
    expect(freshResults.filter(result => result.annotationType === 6)).toHaveLength(0);
    expect(reusedResults).toEqual(freshResults);
  });

  it('后续协议路线图明确优先级、接口和外部 sigrok 策略', () => {
    const roadmap = getDecoderExtensionRoadmap();

    expect(roadmap.map(item => item.id)).toEqual(['can', 'lin', 'i2s', 'usb', 'jtag-swd']);
    expect(getDecoderExtensionPlan('can')).toEqual(
      expect.objectContaining({
        priority: 1,
        implementation: 'typescript'
      })
    );
    expect(getExternalSigrokProtocolIds()).toEqual(['usb', 'jtag-swd']);
    expect(roadmap.every(item => item.minimumInterfaces.length > 0)).toBe(true);
  });
});
