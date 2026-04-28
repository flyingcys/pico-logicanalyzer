import goldenCore from '../../fixtures/decoders/golden-core.json';
import { DecoderBase } from '../../../src/decoders/DecoderBase';
import { DecoderManager } from '../../../src/decoders/DecoderManager';
import { getDecoderRegistryInfo } from '../../../src/decoders/DecoderRegistry';
import { I2CDecoder } from '../../../src/decoders/protocols/I2CDecoder';
import { SPIDecoder } from '../../../src/decoders/protocols/SPIDecoder';
import { UARTDecoder } from '../../../src/decoders/protocols/UARTDecoder';
import {
  ChannelData,
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderOutputType,
  DecoderResult,
  DecoderSelectedChannel,
  WaitConditions
} from '../../../src/decoders/types';

interface ExpectedSegment {
  annotationType: number;
  values: string[];
  rawData?: number;
}

class ProbeDecoder extends DecoderBase {
  readonly id = 'probe';
  readonly name = 'Probe';
  readonly longname = 'Decoder Probe';
  readonly desc = 'Exposes protected decoder primitives for parity tests.';
  readonly license = 'MIT';
  readonly inputs = ['logic'];
  readonly outputs = ['probe'];
  readonly tags = ['test'];
  readonly channels: DecoderChannel[] = [
    { id: 'sig', name: 'SIG', desc: 'Signal', required: true, index: 0 }
  ];
  readonly options: DecoderOption[] = [];
  readonly annotations: Array<[string, string, string?]> = [['value', 'Value']];

  decode(
    _sampleRate: number,
    _channels: ChannelData[],
    _options: DecoderOptionValue[]
  ): DecoderResult[] {
    return [];
  }

  load(samples: number[]): void {
    this.prepareChannelData(
      [{ channelNumber: 0, channelName: 'SIG', samples: new Uint8Array(samples) }],
      [{ captureIndex: 0, decoderIndex: 0 }]
    );
    this.start();
  }

  waitFor(conditions: WaitConditions) {
    return this.wait(conditions);
  }

  emit(annotationType: number | undefined): DecoderResult[] {
    this.put(2, 5, {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values: ['probe']
    });
    return this.results;
  }
}

class MappingDecoder extends DecoderBase {
  readonly id = 'mapping';
  readonly name = 'Mapping';
  readonly longname = 'Mapping Test Decoder';
  readonly desc = 'Verifies DecoderManager channel remapping.';
  readonly license = 'MIT';
  readonly inputs = ['logic'];
  readonly outputs = ['mapping'];
  readonly tags = ['test'];
  readonly channels: DecoderChannel[] = [
    { id: 'data', name: 'DATA', desc: 'Data', required: true, index: 0 }
  ];
  readonly options: DecoderOption[] = [];
  readonly annotations: Array<[string, string, string?]> = [['value', 'Value']];

  decode(
    _sampleRate: number,
    channels: ChannelData[],
    _options: DecoderOptionValue[]
  ): DecoderResult[] {
    return [
      {
        startSample: 0,
        endSample: 1,
        annotationType: 0,
        values: [String(channels[0].samples[0])],
        rawData: channels[0].samples[0]
      }
    ];
  }
}

class ProducerDecoder extends DecoderBase {
  readonly id = 'producer';
  readonly name = 'Producer';
  readonly longname = 'Producer Test Decoder';
  readonly desc = 'Produces typed child input.';
  readonly license = 'MIT';
  readonly inputs = ['logic'];
  readonly outputs = ['bytes'];
  readonly tags = ['test'];
  readonly channels: DecoderChannel[] = [
    { id: 'data', name: 'DATA', desc: 'Data', required: true, index: 0 }
  ];
  readonly options: DecoderOption[] = [];
  readonly annotations: Array<[string, string, string?]> = [['byte', 'Byte']];

  decode(
    _sampleRate: number,
    _channels: ChannelData[],
    _options: DecoderOptionValue[]
  ): DecoderResult[] {
    this.addOutput('bytes', [{ value: 0x5a, startSample: 0, endSample: 8 }]);
    return [
      {
        startSample: 0,
        endSample: 8,
        annotationType: 0,
        values: ['5A'],
        rawData: 0x5a
      }
    ];
  }
}

class ConsumerDecoder extends DecoderBase {
  readonly id = 'consumer';
  readonly name = 'Consumer';
  readonly longname = 'Consumer Test Decoder';
  readonly desc = 'Consumes parent output.';
  readonly license = 'MIT';
  readonly inputs = ['bytes'];
  readonly outputs = ['consumer'];
  readonly tags = ['test'];
  readonly channels: DecoderChannel[] = [];
  readonly options: DecoderOption[] = [];
  readonly annotations: Array<[string, string, string?]> = [['byte', 'Byte']];

  decode(
    _sampleRate: number,
    _channels: ChannelData[],
    _options: DecoderOptionValue[]
  ): DecoderResult[] {
    const input = this.getInput('bytes') as Array<{ value: number }> | null;
    return [
      {
        startSample: 0,
        endSample: 1,
        annotationType: 0,
        values: [input?.[0]?.value.toString(16).toUpperCase() ?? 'missing'],
        rawData: input?.[0]?.value
      }
    ];
  }
}

function toChannels(
  channels: Array<{ channelNumber: number; channelName: string; samples: number[] }>
): ChannelData[] {
  return channels.map(channel => ({
    ...channel,
    samples: new Uint8Array(channel.samples)
  }));
}

function i2cOperationsToChannels(
  operations: Array<{ type: string; value?: number }>
): ChannelData[] {
  const scl: number[] = [1, 1, 1, 1];
  const sda: number[] = [1, 1, 1, 1];

  const push = (sclValues: number[], sdaValues: number[]) => {
    scl.push(...sclValues);
    sda.push(...sdaValues);
  };

  for (const operation of operations) {
    if (operation.type === 'start') {
      push([1, 1, 1, 1], [1, 1, 0, 0]);
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

function expectGoldenSegments(results: DecoderResult[], expected: ExpectedSegment[]): void {
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

describe('解码器 parity 核心', () => {
  it('I2C golden 写事务输出与 sigrok 风格注释对齐', () => {
    const fixture = goldenCore.i2cWrite;
    const results = new I2CDecoder().decode(
      fixture.sampleRate,
      i2cOperationsToChannels(fixture.operations),
      [{ optionIndex: 0, value: 'shifted' }]
    );

    expectGoldenSegments(results, fixture.expected);
  });

  it('SPI golden mode 0 输出字节与传输注释', () => {
    const fixture = goldenCore.spiMode0;
    const results = new SPIDecoder().decode(fixture.sampleRate, toChannels(fixture.channels), [
      { optionIndex: 0, value: 'active-low' },
      { optionIndex: 1, value: '0' },
      { optionIndex: 2, value: '0' },
      { optionIndex: 3, value: 'msb-first' },
      { optionIndex: 4, value: 8 }
    ]);

    expectGoldenSegments(results, fixture.expected);
  });

  it('UART golden 8N1 帧输出起始位、数据和停止位', () => {
    const fixture = goldenCore.uart8n1;
    const results = new UARTDecoder().decode(fixture.sampleRate, toChannels(fixture.channels), [
      { optionIndex: 0, value: 115200 },
      { optionIndex: 1, value: '8' },
      { optionIndex: 2, value: 'none' },
      { optionIndex: 3, value: '1.0' },
      { optionIndex: 5, value: 'hex' }
    ]);

    expectGoldenSegments(results, fixture.expected);
  });

  it('wait 支持 sigrok skip 语义并维护后续 matched 状态', () => {
    const decoder = new ProbeDecoder();
    decoder.load([0, 0, 1, 1, 0]);

    const skipped = decoder.waitFor({ skip: 2 });
    expect(skipped.sampleNumber).toBe(2);
    expect(skipped.pins).toEqual([1]);

    const edge = decoder.waitFor([{ 0: 'falling' }, { 0: 'rising' }]);
    expect(edge.sampleNumber).toBe(4);
    expect(edge.matched).toEqual([true, false]);
    expect(edge.matchedIndex).toBe(0);
  });

  it('put 保留 annotationType 0 并只在缺省时回退为 0', () => {
    const decoder = new ProbeDecoder();

    expect(decoder.emit(0)[0]).toEqual(
      expect.objectContaining({ annotationType: 0, values: ['probe'] })
    );
    expect(decoder.emit(undefined)[1]).toEqual(
      expect.objectContaining({ annotationType: 0, values: ['probe'] })
    );
  });

  it('DecoderManager 执行解码树时按 selectedChannels 重映射输入通道', () => {
    const manager = new DecoderManager();
    const channels: ChannelData[] = [
      { channelNumber: 0, channelName: 'CH0', samples: new Uint8Array([11]) },
      { channelNumber: 1, channelName: 'CH1', samples: new Uint8Array([22]) },
      { channelNumber: 2, channelName: 'CH2', samples: new Uint8Array([33]) }
    ];

    const results = manager.execute(1000000, channels, {
      branches: [
        {
          name: 'mapping',
          decoder: new MappingDecoder(),
          options: [],
          channels: [{ captureIndex: 2, decoderIndex: 0 }],
          children: []
        }
      ]
    });

    expect(results?.get('mapping')?.segments[0].rawData).toBe(33);
  });

  it('DecoderManager 合并父分支输出并作为子分支输入', () => {
    const manager = new DecoderManager();
    const selectedChannels: DecoderSelectedChannel[] = [{ captureIndex: 0, decoderIndex: 0 }];
    const channels: ChannelData[] = [
      { channelNumber: 0, channelName: 'DATA', samples: new Uint8Array([1]) }
    ];

    const results = manager.execute(1000000, channels, {
      branches: [
        {
          name: 'producer',
          decoder: new ProducerDecoder(),
          options: [],
          channels: selectedChannels,
          children: [
            {
              name: 'consumer',
              decoder: new ConsumerDecoder(),
              options: [],
              channels: [],
              children: []
            }
          ]
        }
      ]
    });

    expect(results?.get('consumer')?.segments[0]).toEqual(
      expect.objectContaining({ rawData: 0x5a, values: ['5A'] })
    );
  });

  it('I2C 大样本默认推荐流式解码，小样本保持常规解码', () => {
    const manager = new DecoderManager();

    expect(manager.getRecommendedExecutionMode('i2c', 1000)).toBe('regular');
    expect(manager.getRecommendedExecutionMode('i2c', 1_000_001)).toBe('streaming');
    expect(manager.getRecommendedExecutionMode('spi', 1_000_001)).toBe('regular');
  });

  it('DecoderRegistry 暴露常规与流式解码器清单', () => {
    expect(getDecoderRegistryInfo()).toEqual(
      expect.objectContaining({
        regularDecoders: ['i2c', 'spi', 'uart', 'can', 'lin', 'i2s'],
        streamingDecoders: ['streaming_i2c']
      })
    );
  });
});
