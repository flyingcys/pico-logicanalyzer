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
}): ChannelData[] {
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

  return [
    {
      channelNumber: 0,
      channelName: 'CAN_RX',
      samples: new Uint8Array([1, 1, ...bitsToSamples(bits), 1, 1])
    }
  ];
}

function linFrameToChannels(input: {
  pid: number;
  data: number[];
  checksum: number;
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
  for (const byte of input.data) pushByte(byte);
  pushByte(input.checksum);

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

function inputToChannels(input: any): ChannelData[] {
  switch (input.kind) {
    case 'logic-channels':
      return logicChannelsToChannelData(input.channels);
    case 'i2c-operations':
      return i2cOperationsToChannels(input.operations);
    case 'spi-transfer':
      return spiTransferToChannels(input);
    case 'can-frame':
      return canFrameToChannels(input);
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
