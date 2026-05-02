/**
 * LIN 解码器。输入为单线 UART 逻辑位流。
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

type LINChecksumMode = 'classic' | 'enhanced' | 'lin1.x' | 'lin2.x';

interface LINByte {
  value: number;
  startSample: number;
  endSample: number;
}

export class LINDecoder extends DecoderBase {
  readonly id = 'lin';
  readonly name = 'LIN';
  readonly longname = 'Local Interconnect Network';
  readonly desc = 'Single-wire automotive serial bus.';
  readonly license = 'gplv2+';
  readonly inputs = ['logic'];
  readonly outputs = ['lin'];
  readonly tags = ['Automotive', 'Embedded/industrial'];

  readonly channels: DecoderChannel[] = [
    { id: 'rx', name: 'LIN RX', desc: 'LIN receive line', required: true, index: 0 }
  ];

  readonly options: DecoderOption[] = [
    { id: 'baudrate', desc: 'Baud rate', default: 19200, type: 'int' },
    { id: 'data_length', desc: 'Data length', default: 2, type: 'int' },
    {
      id: 'checksum',
      desc: 'Checksum model / LIN version',
      default: 'classic',
      values: ['classic', 'enhanced', 'lin1.x', 'lin2.x'],
      type: 'list'
    }
  ];

  readonly annotations: Array<[string, string, string?]> = [
    ['break', 'Break'],
    ['sync', 'Sync byte'],
    ['pid', 'Protected identifier'],
    ['identifier', 'Identifier'],
    ['data', 'Data byte'],
    ['checksum', 'Checksum'],
    ['warning', 'Warning']
  ];

  readonly annotationRows: Array<[string, string, number[]]> = [
    ['fields', 'Fields', [0, 1, 2, 3, 4, 5]],
    ['warnings', 'Warnings', [6]]
  ];

  private baudrate = 19200;
  private dataLength = 2;
  private checksumMode: LINChecksumMode = 'classic';
  private bitWidth = 1;
  private readonly minimumBreakCandidateBits = 10;

  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    if (!sampleRate) {
      throw new Error('LIN decoder requires samplerate.');
    }
    if (channels.length < 1 || channels[0].samples.length === 0) {
      return [];
    }

    this.processOptions(options);
    this.sampleRate = sampleRate;
    this.bitWidth = Math.max(1, Math.round(sampleRate / this.baudrate));
    this.prepareChannelData(channels, [{ captureIndex: 0, decoderIndex: 0 }]);
    this.start();

    this.decodeFrames(channels[0].samples);
    return this.results;
  }

  private processOptions(options: DecoderOptionValue[]): void {
    this.baudrate = Number(this.options[0].default);
    this.dataLength = Number(this.options[1].default);
    this.checksumMode = this.normalizeChecksumMode(this.options[2].default);

    for (const option of options) {
      if (option.optionIndex === 0) {
        this.baudrate = Number(option.value);
      } else if (option.optionIndex === 1) {
        this.dataLength = Math.max(0, Number(option.value));
      } else if (option.optionIndex === 2) {
        this.checksumMode = this.normalizeChecksumMode(option.value);
      }
    }
  }

  private normalizeChecksumMode(value: unknown): LINChecksumMode {
    if (value === 'enhanced' || value === 'lin2.x') {
      return value;
    }
    if (value === 'lin1.x') {
      return 'lin1.x';
    }
    return 'classic';
  }

  private decodeFrames(samples: Uint8Array): void {
    let cursor = 0;

    while (cursor < samples.length) {
      const nextCursor = this.decodeFrame(samples, cursor);
      if (nextCursor === null) {
        return;
      }

      cursor = Math.max(nextCursor, cursor + 1);
    }
  }

  private decodeFrame(samples: Uint8Array, from: number): number | null {
    const breakRun = this.findBreak(samples, from);
    if (!breakRun) {
      return null;
    }

    const breakBits = Math.round((breakRun.end - breakRun.start) / this.bitWidth);
    this.emit(0, breakRun.start, breakRun.end, ['Break']);
    if (breakBits < 13) {
      this.warn(breakRun.start, breakRun.end, ['Break too short', 'Break']);
    }

    let cursor = breakRun.end;
    while (cursor < samples.length && samples[cursor] === 0) {
      cursor++;
    }
    while (cursor < samples.length && samples[cursor] === 1) {
      cursor++;
    }

    const sync = this.readByte(samples, cursor);
    if (!sync) {
      this.warn(cursor, cursor + this.bitWidth, ['Missing sync', 'Sync']);
      return breakRun.end;
    }
    cursor = sync.endSample;
    this.emit(1, sync.startSample, sync.endSample, [`Sync: ${this.hex(sync.value)}`, this.hex(sync.value)], sync.value);
    if (sync.value !== 0x55) {
      this.warn(sync.startSample, sync.endSample, ['Sync error', 'Sync']);
    }

    const pid = this.readByte(samples, cursor);
    if (!pid) {
      this.warn(cursor, cursor + this.bitWidth, ['Missing PID', 'PID']);
      return sync.endSample;
    }
    cursor = pid.endSample;
    this.emit(2, pid.startSample, pid.endSample, [`PID: ${this.hex(pid.value)}`, this.hex(pid.value)], pid.value);

    const identifier = pid.value & 0x3f;
    this.emit(3, pid.startSample, pid.endSample, [`ID: ${this.hex(identifier)}`, this.hex(identifier)], identifier);
    if (!this.hasValidPidParity(pid.value)) {
      this.warn(pid.startSample, pid.endSample, ['PID parity error', 'PID parity']);
    }

    if (this.dataLength === 0) {
      return cursor;
    }

    const data: LINByte[] = [];
    for (let index = 0; index < this.dataLength; index++) {
      if (index === 0) {
        const noResponseEnd = this.findNoResponseEnd(samples, cursor);
        if (noResponseEnd !== null) {
          this.warn(cursor, Math.max(cursor + this.bitWidth, noResponseEnd), ['No response', 'No response']);
          return noResponseEnd;
        }
      }

      if (this.countCompleteBytesBeforeBreak(samples, cursor) === 1) {
        break;
      }

      const byte = this.readByte(samples, cursor);
      if (!byte) {
        this.warn(cursor, cursor + this.bitWidth, ['Missing data', 'Data']);
        return this.findBreak(samples, cursor)?.start ?? samples.length;
      }
      cursor = byte.endSample;
      data.push(byte);
      this.emit(4, byte.startSample, byte.endSample, [`Data[${index}]: ${this.hex(byte.value)}`, this.hex(byte.value)], byte.value);
    }

    const checksum = this.readByte(samples, cursor);
    if (!checksum) {
      this.warn(cursor, cursor + this.bitWidth, ['Missing checksum', 'Checksum']);
      return this.findBreak(samples, cursor)?.start ?? samples.length;
    }

    const expected = this.calculateChecksum(pid.value, data.map(item => item.value));
    this.emit(5, checksum.startSample, checksum.endSample, [`Checksum: ${this.hex(checksum.value)}`, this.hex(checksum.value)], checksum.value);
    if (checksum.value !== expected) {
      this.warn(checksum.startSample, checksum.endSample, [`Checksum error: expected ${this.hex(expected)}`, 'Checksum error']);
    }

    return checksum.endSample;
  }

  private findBreak(samples: Uint8Array, from: number = 0): { start: number; end: number } | null {
    for (let index = Math.max(0, from); index < samples.length; index++) {
      if (samples[index] !== 0) {
        continue;
      }
      let end = index;
      while (end < samples.length && samples[end] === 0) {
        end++;
      }
      const lowBits = Math.round((end - index) / this.bitWidth);
      if (lowBits >= this.minimumBreakCandidateBits) {
        return { start: index, end };
      }
      index = end;
    }
    return null;
  }

  private readByte(samples: Uint8Array, from: number, warnOnStopBit: boolean = true): LINByte | null {
    let start = from;
    while (start < samples.length && samples[start] === 1) {
      start++;
    }
    if (start >= samples.length || samples[start] !== 0) {
      return null;
    }

    let value = 0;
    for (let bit = 0; bit < 8; bit++) {
      const index = start + (bit + 1) * this.bitWidth;
      if (index >= samples.length) {
        return null;
      }
      value |= (samples[index] ? 1 : 0) << bit;
    }

    const stopIndex = start + 9 * this.bitWidth;
    if (warnOnStopBit && (stopIndex >= samples.length || samples[stopIndex] !== 1)) {
      this.warn(stopIndex, stopIndex + this.bitWidth, ['Stop bit error', 'Stop']);
    }

    return {
      value,
      startSample: start,
      endSample: Math.min(samples.length, start + 10 * this.bitWidth)
    };
  }

  private findNoResponseEnd(samples: Uint8Array, from: number): number | null {
    if (from < samples.length && samples[from] !== 1) {
      return null;
    }

    const nextBreak = this.findBreak(samples, from);
    const end = nextBreak?.start ?? samples.length;

    for (let index = from; index < end; index++) {
      if (samples[index] !== 1) {
        return null;
      }
    }

    return end;
  }

  private countCompleteBytesBeforeBreak(samples: Uint8Array, from: number): number {
    const nextBreak = this.findBreak(samples, from);
    const end = nextBreak?.start ?? samples.length;
    let count = 0;
    let cursor = from;

    while (cursor < end) {
      const byte = this.readByte(samples, cursor, false);
      if (!byte || byte.endSample > end) {
        break;
      }
      count++;
      cursor = byte.endSample;
    }

    return count;
  }

  private hasValidPidParity(pid: number): boolean {
    const id = pid & 0x3f;
    const p0 = ((id >> 0) ^ (id >> 1) ^ (id >> 2) ^ (id >> 4)) & 1;
    const p1 = (~(((id >> 1) ^ (id >> 3) ^ (id >> 4) ^ (id >> 5)) & 1)) & 1;
    return (((pid >> 6) & 1) === p0) && (((pid >> 7) & 1) === p1);
  }

  private calculateChecksum(pid: number, data: number[]): number {
    const values = this.shouldIncludePidInChecksum(pid) ? [pid, ...data] : data;
    let sum = values.reduce((total, value) => total + value, 0);
    while (sum > 0xff) {
      sum = (sum & 0xff) + (sum >> 8);
    }
    return (~sum) & 0xff;
  }

  private shouldIncludePidInChecksum(pid: number): boolean {
    if (this.checksumMode !== 'enhanced' && this.checksumMode !== 'lin2.x') {
      return false;
    }

    const identifier = pid & 0x3f;
    return identifier !== 0x3c && identifier !== 0x3d;
  }

  private emit(
    annotationType: number,
    startSample: number,
    endSample: number,
    values: string[],
    rawData?: number
  ): void {
    this.put(startSample, endSample, {
      type: DecoderOutputType.ANNOTATION,
      annotationType,
      values,
      rawData
    });
  }

  private warn(startSample: number, endSample: number, values: string[]): void {
    this.emit(6, startSample, endSample, values);
  }

  private hex(value: number): string {
    return value.toString(16).toUpperCase().padStart(2, '0');
  }
}
