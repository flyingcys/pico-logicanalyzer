/**
 * I2S 解码器。支持标准 I2S 对齐，SCK 上升沿采样，WS=0 为左声道。
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

type I2SJustification = 'i2s' | 'left';

export class I2SDecoder extends DecoderBase {
  readonly id = 'i2s';
  readonly name = 'I2S';
  readonly longname = 'Inter-IC Sound';
  readonly desc = 'Synchronous serial audio bus.';
  readonly license = 'gplv2+';
  readonly inputs = ['logic'];
  readonly outputs = ['i2s'];
  readonly tags = ['Audio', 'Embedded/industrial'];

  readonly channels: DecoderChannel[] = [
    { id: 'sck', name: 'SCK', desc: 'Serial clock', required: true, index: 0 },
    { id: 'ws', name: 'WS', desc: 'Word select', required: true, index: 1 },
    { id: 'sd', name: 'SD', desc: 'Serial data', required: true, index: 2 }
  ];

  readonly options: DecoderOption[] = [
    { id: 'word_length', desc: 'Word length', default: 16, values: ['16', '24', '32'], type: 'list' },
    { id: 'justification', desc: 'Data alignment', default: 'i2s', values: ['i2s', 'left'], type: 'list' }
  ];

  readonly annotations: Array<[string, string, string?]> = [
    ['left-sample', 'Left sample'],
    ['right-sample', 'Right sample'],
    ['bit', 'Data bit'],
    ['warning', 'Warning']
  ];

  readonly annotationRows: Array<[string, string, number[]]> = [
    ['samples', 'Samples', [0, 1]],
    ['warnings', 'Warnings', [3]]
  ];

  private wordLength = 16;
  private justification: I2SJustification = 'i2s';

  decode(
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[]
  ): DecoderResult[] {
    if (!sampleRate) {
      throw new Error('I2S decoder requires samplerate.');
    }
    if (channels.length < 3) {
      throw new Error('I2S decoder requires SCK, WS, and SD channels.');
    }

    this.processOptions(options);
    this.sampleRate = sampleRate;
    this.prepareChannelData(channels, [
      { captureIndex: 0, decoderIndex: 0 },
      { captureIndex: 1, decoderIndex: 1 },
      { captureIndex: 2, decoderIndex: 2 }
    ]);
    this.start();

    this.decodeWords(channels[0].samples, channels[1].samples, channels[2].samples);
    return this.results;
  }

  private processOptions(options: DecoderOptionValue[]): void {
    for (const option of options) {
      if (option.optionIndex === 0) {
        this.wordLength = Math.max(1, Number(option.value));
      } else if (option.optionIndex === 1) {
        this.justification = option.value === 'left' ? 'left' : 'i2s';
      }
    }
  }

  private decodeWords(sck: Uint8Array, ws: Uint8Array, sd: Uint8Array): void {
    let activeWs: number | null = null;
    let bits: number[] = [];
    let wordStart = 0;
    let skipCurrentBit = this.justification === 'i2s';

    for (let index = 1; index < sck.length; index++) {
      if (!(sck[index - 1] === 0 && sck[index] === 1)) {
        continue;
      }

      const wordSelect = ws[index] ? 1 : 0;
      const bit = sd[index] ? 1 : 0;

      if (activeWs === null) {
        activeWs = wordSelect;
        wordStart = index;
        skipCurrentBit = this.justification === 'i2s';
      } else if (wordSelect !== activeWs) {
        this.flushWord(activeWs, bits, wordStart, index);
        activeWs = wordSelect;
        bits = [];
        wordStart = index;
        skipCurrentBit = this.justification === 'i2s';
      }

      if (skipCurrentBit) {
        skipCurrentBit = false;
        continue;
      }

      if (bits.length < this.wordLength) {
        bits.push(bit);
      }
    }

    if (activeWs !== null) {
      this.flushWord(activeWs, bits, wordStart, sck.length);
    }
  }

  private flushWord(wordSelect: number, bits: number[], startSample: number, endSample: number): void {
    if (bits.length < this.wordLength) {
      this.warn(startSample, endSample, ['Incomplete word', 'Incomplete']);
      return;
    }

    const value = bits.slice(0, this.wordLength).reduce((total, bit) => (total << 1) | bit, 0);
    const width = Math.ceil(this.wordLength / 4);
    const hex = value.toString(16).toUpperCase().padStart(width, '0');

    if (wordSelect === 0) {
      this.emit(0, startSample, endSample, [`Left: ${hex}`, `L: ${hex}`, hex], value);
    } else {
      this.emit(1, startSample, endSample, [`Right: ${hex}`, `R: ${hex}`, hex], value);
    }
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
    this.emit(3, startSample, endSample, values);
  }
}
