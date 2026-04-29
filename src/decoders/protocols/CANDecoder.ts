/**
 * CAN 2.0A/2.0B 解码器。
 * 默认输入为已还原的单线逻辑位流：recessive=1，dominant=0。
 */

import { DecoderBase } from '../DecoderBase';
import {
  ChannelData,
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderOutputType,
  DecoderResult
} from '../types';

export class CANDecoder extends DecoderBase {
  readonly id = 'can';
  readonly name = 'CAN';
  readonly longname = 'Controller Area Network';
  readonly desc = 'CAN 2.0A/2.0B serial bus.';
  readonly license = 'gplv2+';
  readonly inputs = ['logic'];
  readonly outputs = ['can'];
  readonly tags = ['Automotive', 'Embedded/industrial'];

  readonly channels: DecoderChannel[] = [
    { id: 'rx', name: 'CAN RX', desc: 'CAN dominant/recessive logic stream', required: true, index: 0 }
  ];

  readonly options: DecoderOption[] = [
    { id: 'bitrate', desc: 'Bitrate', default: 500000, type: 'int' },
    { id: 'sample_point', desc: 'Sample point (%)', default: 75, type: 'int' }
  ];

  readonly annotations: Array<[string, string, string?]> = [
    ['sof', 'Start of frame', 'SOF'],
    ['identifier', 'Identifier'],
    ['control', 'Control field'],
    ['dlc', 'Data length code'],
    ['data', 'Data byte'],
    ['crc', 'CRC field'],
    ['ack', 'ACK field'],
    ['eof', 'End of frame', 'EOF'],
    ['warning', 'Warning']
  ];

  readonly annotationRows: Array<[string, string, number[]]> = [
    ['fields', 'Fields', [0, 1, 2, 3, 4, 5, 6, 7]],
    ['warnings', 'Warnings', [8]]
  ];

  private bitrate = 500000;
  private samplePoint = 75;
  private frameStart = 0;
  private bitWidth = 1;
  private bits: number[] = [];
  private cursor = 0;
  private rawCursor = 0;
  private logicalToRaw: number[] = [];
  private stuffedLastBit: number | undefined;
  private stuffedRunLength = 0;
  private destuffEnabled = true;

  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    if (!sampleRate) {
      throw new Error('CAN decoder requires samplerate.');
    }
    if (channels.length < 1 || channels[0].samples.length === 0) {
      return [];
    }

    this.processOptions(options);
    this.sampleRate = sampleRate;
    this.prepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);
    this.start();

    this.bitWidth = Math.max(1, Math.round(sampleRate / this.bitrate));
    const [{ samples }] = channels;
    let searchFrom = 0;

    while (searchFrom < samples.length) {
      const sof = this.findStartOfFrame(samples, searchFrom);
      if (sof === -1) {
        break;
      }

      this.frameStart = sof;
      this.bits = this.sampleBits(samples, sof);

      const consumedBits = this.parseFrameWithFallback();
      const nextSearch = this.frameStart + Math.max(consumedBits, 1) * this.bitWidth;
      searchFrom = Math.max(sof + 1, nextSearch);
    }

    return this.results;
  }

  private processOptions(options: DecoderOptionValue[]): void {
    this.bitrate = Number(this.options[0].default);
    this.samplePoint = Number(this.options[1].default);

    for (const option of options) {
      if (option.optionIndex === 0) {
        this.bitrate = Number(option.value);
      } else if (option.optionIndex === 1) {
        this.samplePoint = Number(option.value);
      }
    }
  }

  private findStartOfFrame(samples: Uint8Array, from = 0): number {
    for (let index = Math.max(0, from); index < samples.length; index++) {
      const previous = index === 0 ? 1 : samples[index - 1];
      if (previous === 1 && samples[index] === 0) {
        return index;
      }
    }
    return -1;
  }

  private sampleBits(samples: Uint8Array, start: number): number[] {
    const result: number[] = [];
    const sampleOffset = Math.min(
      this.bitWidth - 1,
      Math.max(0, Math.floor((this.bitWidth * this.samplePoint) / 100))
    );

    let bitStart = start;
    while (bitStart + sampleOffset < samples.length) {
      result.push(samples[bitStart + sampleOffset] ? 1 : 0);

      const nextStart = bitStart + this.bitWidth;
      const resyncedStart = this.findDominantEdgeNear(samples, nextStart, bitStart);
      bitStart = resyncedStart ?? nextStart;
    }

    return result;
  }

  private parseFrameWithFallback(): number {
    const frameResultsStart = this.results.length;
    this.resetFrameReader(true);

    const stuffedConsumedBits = this.parseFrame();
    const stuffedResults = this.results.slice(frameResultsStart);

    if (!this.shouldRetryWithoutDestuff(stuffedResults)) {
      return stuffedConsumedBits;
    }

    this.results.splice(frameResultsStart);
    this.resetFrameReader(false);
    return this.parseFrame();
  }

  private resetFrameReader(destuffEnabled: boolean): void {
    this.destuffEnabled = destuffEnabled;
    this.cursor = 0;
    this.rawCursor = 0;
    this.logicalToRaw = [];
    this.resetStuffState();
  }

  private shouldRetryWithoutDestuff(results: DecoderResult[]): boolean {
    const warnings = results
      .filter(result => result.annotationType === 8)
      .map(result => result.values[0]);

    if (warnings.includes('Stuff bit error')) {
      return false;
    }

    return warnings.some(warning =>
      warning === 'CRC delimiter error' ||
      warning === 'ACK delimiter error' ||
      warning === 'EOF error' ||
      warning === 'Incomplete CAN frame'
    );
  }

  private findDominantEdgeNear(
    samples: Uint8Array,
    expectedStart: number,
    currentStart: number
  ): number | undefined {
    if (this.bitWidth <= 1) {
      return undefined;
    }

    const window = Math.max(1, Math.floor(this.bitWidth * 0.75));
    const start = Math.max(currentStart + 1, expectedStart - window, 1);
    const end = Math.min(samples.length - 1, expectedStart + window);

    for (let index = start; index <= end; index++) {
      if (samples[index - 1] === 1 && samples[index] === 0) {
        return index;
      }
    }

    return undefined;
  }

  private parseFrame(): number {
    try {
      this.expectBit(0, 'SOF expected');
      this.emit(0, 0, 1, ['SOF']);

      const baseId = this.readNumber(11);
      const rtrOrSrr = this.readBit();
      const ide = this.readBit();

      if (ide === 1) {
        const extId = this.readNumber(18);
        const identifier = (baseId << 18) | extId;
        const rtr = this.readBit();
        this.readBit();
        this.readBit();
        this.emit(1, 1, 30, [`Ext ID: ${this.hex(identifier, 5)}`, this.hex(identifier, 5)], identifier);
        this.emit(2, 31, 34, [rtr ? 'Remote frame' : 'Data frame']);
      } else {
        this.readBit();
        this.emit(1, 1, 12, [`ID: ${this.hex(baseId, 3)}`, this.hex(baseId, 3)], baseId);
        this.emit(2, 12, 15, [rtrOrSrr ? 'Remote frame' : 'Data frame']);
      }

      const dlcStart = this.cursor;
      const dlc = Math.min(this.readNumber(4), 8);
      this.emit(3, dlcStart, this.cursor, [`DLC: ${dlc}`, String(dlc)], dlc);

      for (let index = 0; index < dlc; index++) {
        const byteStart = this.cursor;
        const value = this.readNumber(8);
        this.emit(4, byteStart, this.cursor, [`Data[${index}]: ${this.hex(value, 2)}`, this.hex(value, 2)], value);
      }

      const crcStart = this.cursor;
      this.readNumber(15);
      this.emit(5, crcStart, this.cursor, ['CRC']);

      this.finishStuffedSection();

      const crcDelimiter = this.readRawBit();
      if (crcDelimiter !== 1) {
        this.warn(this.cursor - 1, this.cursor, ['CRC delimiter error', 'CRC delim']);
      }

      const ackSlot = this.readRawBit();
      const ackDelimiter = this.readRawBit();
      if (ackSlot === 0) {
        this.emit(6, this.cursor - 2, this.cursor, ['ACK']);
      } else {
        this.warn(this.cursor - 2, this.cursor - 1, ['ACK missing', 'No ACK']);
      }
      if (ackDelimiter !== 1) {
        this.warn(this.cursor - 1, this.cursor, ['ACK delimiter error', 'ACK delim']);
      }

      const eof = this.readRawBits(7);
      if (eof.every(bit => bit === 1)) {
        this.emit(7, this.cursor - 7, this.cursor, ['EOF']);
      } else {
        this.warn(this.cursor - 7, this.cursor, ['EOF error', 'EOF']);
      }
    } catch (error) {
      this.warn(this.cursor, this.cursor + 1, [(error as Error).message]);
    }

    return this.rawCursor;
  }

  private readBit(): number {
    if (this.rawCursor >= this.bits.length) {
      throw new Error('Incomplete CAN frame');
    }

    const rawIndex = this.rawCursor;
    const bit = this.bits[this.rawCursor++];

    if (!this.destuffEnabled) {
      this.logicalToRaw[this.cursor++] = rawIndex;
      return bit;
    }

    if (this.stuffedRunLength === 5 && this.stuffedLastBit !== undefined) {
      if (bit !== this.stuffedLastBit) {
        this.resetStuffState();
        return this.readBit();
      }

      this.warnRaw(rawIndex, rawIndex + 1, ['Stuff bit error', 'Stuff']);
      this.resetStuffState();
    }

    this.logicalToRaw[this.cursor++] = rawIndex;
    this.updateStuffState(bit);
    return bit;
  }

  private readBits(count: number): number[] {
    return Array.from({ length: count }, () => this.readBit());
  }

  private readNumber(count: number): number {
    return this.readBits(count).reduce((value, bit) => (value << 1) | bit, 0);
  }

  private readRawBit(): number {
    if (this.rawCursor >= this.bits.length) {
      throw new Error('Incomplete CAN frame');
    }

    const rawIndex = this.rawCursor;
    const bit = this.bits[this.rawCursor++];
    this.logicalToRaw[this.cursor++] = rawIndex;
    return bit;
  }

  private readRawBits(count: number): number[] {
    return Array.from({ length: count }, () => this.readRawBit());
  }

  private finishStuffedSection(): void {
    if (!this.destuffEnabled) {
      this.resetStuffState();
      return;
    }

    if (
      this.stuffedRunLength === 5 &&
      this.stuffedLastBit !== undefined &&
      this.rawCursor < this.bits.length
    ) {
      const rawIndex = this.rawCursor;
      const bit = this.bits[this.rawCursor];

      if (bit !== this.stuffedLastBit) {
        const nextRawBit = this.bits[this.rawCursor + 1];
        if (nextRawBit === 1) {
          this.rawCursor++;
        }
      } else {
        this.warnRaw(rawIndex, rawIndex + 1, ['Stuff bit error', 'Stuff']);
      }
    }

    this.resetStuffState();
  }

  private updateStuffState(bit: number): void {
    if (bit === this.stuffedLastBit) {
      this.stuffedRunLength++;
    } else {
      this.stuffedLastBit = bit;
      this.stuffedRunLength = 1;
    }
  }

  private resetStuffState(): void {
    this.stuffedLastBit = undefined;
    this.stuffedRunLength = 0;
  }

  private expectBit(expected: number, message: string): void {
    const actual = this.readBit();
    if (actual !== expected) {
      throw new Error(message);
    }
  }

  private emit(
    annotationType: number,
    startBit: number,
    endBit: number,
    values: string[],
    rawData?: number
  ): void {
    this.put(this.sampleForBit(startBit), this.sampleForBit(endBit), {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values,
      rawData
    });
  }

  private warn(startBit: number, endBit: number, values: string[]): void {
    this.emit(8, startBit, endBit, values);
  }

  private sampleForBit(bit: number): number {
    if (bit <= 0) {
      return this.frameStart;
    }

    if (bit < this.logicalToRaw.length) {
      return this.frameStart + this.logicalToRaw[bit] * this.bitWidth;
    }

    if (bit === this.logicalToRaw.length && this.logicalToRaw.length > 0) {
      return this.frameStart + (this.logicalToRaw[this.logicalToRaw.length - 1] + 1) * this.bitWidth;
    }

    return this.frameStart + bit * this.bitWidth;
  }

  private warnRaw(startRawBit: number, endRawBit: number, values: string[]): void {
    this.put(
      this.frameStart + startRawBit * this.bitWidth,
      this.frameStart + endRawBit * this.bitWidth,
      {
        type: DecoderOutputType.ANNOTATION,
        annotationType: 8,
        values
      }
    );
  }

  private hex(value: number, width: number): string {
    return value.toString(16).toUpperCase().padStart(width, '0');
  }
}
