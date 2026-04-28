import { AnalyzerChannel, CaptureSession } from '../models/CaptureModels';

export type SignalWaveform =
  | {
      kind: 'clock';
      period: number;
      duty: number;
      phase: number;
    }
  | {
      kind: 'pattern';
      bits: string;
      repeat: boolean;
      step: number;
    }
  | {
      kind: 'constant';
      value: 0 | 1;
    }
  | {
      kind: 'pulse';
      start: number;
      width: number;
      value: 0 | 1;
      idle: 0 | 1;
    };

export interface SignalChannelStatement {
  channelNumber: number;
  name: string;
  waveform: SignalWaveform;
}

export interface SignalProgram {
  sampleRate: number;
  sampleCount: number;
  channels: SignalChannelStatement[];
}

export interface SignalDslDiagnostic {
  severity: 'error';
  code: string;
  message: string;
  line: number;
  column: number;
}

interface SignalDslOption {
  key: string;
  value: string;
  column: number;
}

export class SignalDslParseError extends Error {
  public readonly lineNumber: number;
  public readonly column: number;
  public readonly code: string;
  public readonly diagnostic: SignalDslDiagnostic;

  constructor(lineNumber: number, message: string, column: number = 1, code: string = 'SDL_PARSE_ERROR') {
    super(`line ${lineNumber}, column ${column}: ${message}`);
    this.name = 'SignalDslParseError';
    this.lineNumber = lineNumber;
    this.column = column;
    this.code = code;
    this.diagnostic = {
      severity: 'error',
      code,
      message,
      line: lineNumber,
      column
    };
  }
}

export class SignalDescriptionLanguage {
  public static validate(source: string): SignalDslDiagnostic[] {
    try {
      this.parse(source);
      return [];
    } catch (error) {
      if (error instanceof SignalDslParseError) {
        return [error.diagnostic];
      }

      return [{
        severity: 'error',
        code: 'SDL_INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
        line: 1,
        column: 1
      }];
    }
  }

  public static parse(source: string): SignalProgram {
    const program: Partial<SignalProgram> = {
      channels: []
    };

    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const lineNumber = index + 1;
      const uncommentedLine = this.stripComment(lines[index]);
      const leadingWhitespace = uncommentedLine.length - uncommentedLine.trimStart().length;
      const line = uncommentedLine.trim();

      if (!line) {
        continue;
      }

      const parts = line.split(/\s+/);
      const keyword = parts[0].toLowerCase();

      if (keyword === 'sample_rate' || keyword === 'samplerate' || keyword === 'rate' || keyword === 'frequency') {
        if (parts.length !== 2) {
          throw new SignalDslParseError(lineNumber, 'sample_rate expects exactly one value', leadingWhitespace + 1, 'SDL_SAMPLE_RATE_ARITY');
        }
        program.sampleRate = this.parsePositiveInteger(parts[1], lineNumber, 'sample_rate');
        continue;
      }

      if (keyword === 'samples' || keyword === 'sample_count' || keyword === 'samplecount') {
        if (parts.length !== 2) {
          throw new SignalDslParseError(lineNumber, 'samples expects exactly one value', leadingWhitespace + 1, 'SDL_SAMPLES_ARITY');
        }
        program.sampleCount = this.parsePositiveInteger(parts[1], lineNumber, 'samples');
        continue;
      }

      if (keyword === 'channel') {
        program.channels!.push(this.parseChannel(line, lineNumber, uncommentedLine));
        continue;
      }

      throw new SignalDslParseError(lineNumber, `unknown statement "${parts[0]}"`, leadingWhitespace + 1, 'SDL_UNKNOWN_STATEMENT');
    }

    if (!program.sampleRate) {
      throw new SignalDslParseError(1, 'missing sample_rate statement', 1, 'SDL_MISSING_SAMPLE_RATE');
    }

    if (!program.sampleCount) {
      throw new SignalDslParseError(1, 'missing samples statement', 1, 'SDL_MISSING_SAMPLES');
    }

    if (!program.channels || program.channels.length === 0) {
      throw new SignalDslParseError(1, 'at least one channel statement is required', 1, 'SDL_MISSING_CHANNELS');
    }

    this.validateUniqueChannels(program.channels);

    return program as SignalProgram;
  }

  public static generateCaptureSession(sourceOrProgram: string | SignalProgram): CaptureSession {
    const program = typeof sourceOrProgram === 'string'
      ? this.parse(sourceOrProgram)
      : sourceOrProgram;

    const session = new CaptureSession();
    session.frequency = program.sampleRate;
    session.preTriggerSamples = 0;
    session.postTriggerSamples = program.sampleCount;
    session.loopCount = 0;
    session.measureBursts = false;
    session.captureChannels = program.channels
      .slice()
      .sort((left, right) => left.channelNumber - right.channelNumber)
      .map(statement => this.createAnalyzerChannel(statement, program.sampleCount));

    return session;
  }

  public static getDefaultTemplate(): string {
    return [
      '# Logic Analyzer synthetic capture',
      'sample_rate 1000000',
      'samples 64',
      'channel 0 CLK clock period=8 duty=0.5',
      'channel 1 DATA pattern bits=10110010 repeat=true',
      'channel 2 CS constant value=1',
      'channel 3 IRQ pulse start=16 width=8 value=1'
    ].join('\n');
  }

  private static parseChannel(line: string, lineNumber: number, sourceLine: string): SignalChannelStatement {
    const match = /^channel\s+(\d+)\s+([A-Za-z_][A-Za-z0-9_-]*)\s+([A-Za-z_][A-Za-z0-9_-]*)(?:\s+(.*))?$/i.exec(line);
    if (!match) {
      throw new SignalDslParseError(lineNumber, 'channel syntax is: channel <0-23> <name> <clock|pattern|constant|pulse> key=value ...', sourceLine.search(/\S/) + 1, 'SDL_CHANNEL_SYNTAX');
    }

    const channelNumber = this.parseInteger(match[1], lineNumber, 'channel number');
    if (channelNumber < 0 || channelNumber > 23) {
      throw new SignalDslParseError(lineNumber, 'channel number must be between 0 and 23', this.findColumn(sourceLine, match[1]), 'SDL_CHANNEL_RANGE');
    }

    return {
      channelNumber,
      name: match[2],
      waveform: this.parseWaveform(match[3], this.parseOptions(match[4] || '', lineNumber, sourceLine), lineNumber)
    };
  }

  private static parseWaveform(kindValue: string, options: Map<string, SignalDslOption>, lineNumber: number): SignalWaveform {
    const kind = kindValue.toLowerCase();

    if (kind === 'clock') {
      this.rejectUnknownOptions(options, ['period', 'duty', 'phase'], lineNumber);
      return {
        kind: 'clock',
        period: this.parsePositiveInteger(this.requiredOption(options, 'period', lineNumber).value, lineNumber, 'period'),
        duty: this.parseDuty(options.get('duty')?.value || '0.5', lineNumber),
        phase: this.parseNonNegativeInteger(options.get('phase')?.value || '0', lineNumber, 'phase')
      };
    }

    if (kind === 'pattern') {
      this.rejectUnknownOptions(options, ['bits', 'repeat', 'step'], lineNumber);
      const bitsOption = this.requiredOption(options, 'bits', lineNumber);
      const bits = bitsOption.value;
      if (!/^[01]+$/.test(bits)) {
        throw new SignalDslParseError(lineNumber, 'pattern bits must contain only 0 and 1', bitsOption.column, 'SDL_PATTERN_BITS');
      }

      return {
        kind: 'pattern',
        bits,
        repeat: this.parseBoolean(options.get('repeat')?.value || 'false', lineNumber, 'repeat'),
        step: this.parsePositiveInteger(options.get('step')?.value || '1', lineNumber, 'step')
      };
    }

    if (kind === 'constant') {
      this.rejectUnknownOptions(options, ['value'], lineNumber);
      return {
        kind: 'constant',
        value: this.parseBit(this.requiredOption(options, 'value', lineNumber).value, lineNumber, 'value')
      };
    }

    if (kind === 'pulse') {
      this.rejectUnknownOptions(options, ['start', 'width', 'value', 'idle'], lineNumber);
      const value = this.parseBit(options.get('value')?.value || '1', lineNumber, 'value');
      return {
        kind: 'pulse',
        start: this.parseNonNegativeInteger(this.requiredOption(options, 'start', lineNumber).value, lineNumber, 'start'),
        width: this.parsePositiveInteger(this.requiredOption(options, 'width', lineNumber).value, lineNumber, 'width'),
        value,
        idle: this.parseBit(options.get('idle')?.value || (value === 1 ? '0' : '1'), lineNumber, 'idle')
      };
    }

    throw new SignalDslParseError(lineNumber, `unsupported waveform "${kindValue}"`, 1, 'SDL_UNSUPPORTED_WAVEFORM');
  }

  private static parseOptions(rawOptions: string, lineNumber: number, sourceLine: string): Map<string, SignalDslOption> {
    const options = new Map<string, SignalDslOption>();
    if (!rawOptions.trim()) {
      return options;
    }

    for (const token of rawOptions.trim().split(/\s+/)) {
      const separator = token.indexOf('=');
      if (separator <= 0 || separator === token.length - 1) {
        throw new SignalDslParseError(lineNumber, `invalid option "${token}", expected key=value`, this.findColumn(sourceLine, token), 'SDL_OPTION_SYNTAX');
      }

      const key = token.slice(0, separator).toLowerCase();
      const value = token.slice(separator + 1).replace(/^["']|["']$/g, '');
      options.set(key, {
        key,
        value,
        column: this.findColumn(sourceLine, token)
      });
    }

    return options;
  }

  private static createAnalyzerChannel(statement: SignalChannelStatement, sampleCount: number): AnalyzerChannel {
    const channel = new AnalyzerChannel(statement.channelNumber, statement.name);
    const samples = new Uint8Array(sampleCount);

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      samples[sampleIndex] = this.sampleWaveform(statement.waveform, sampleIndex);
    }

    channel.samples = samples;
    return channel;
  }

  private static sampleWaveform(waveform: SignalWaveform, sampleIndex: number): 0 | 1 {
    if (waveform.kind === 'clock') {
      const localIndex = ((sampleIndex + waveform.phase) % waveform.period + waveform.period) % waveform.period;
      return localIndex < Math.max(1, Math.round(waveform.period * waveform.duty)) ? 1 : 0;
    }

    if (waveform.kind === 'pattern') {
      const bitIndex = Math.floor(sampleIndex / waveform.step);
      if (waveform.repeat) {
        return waveform.bits[bitIndex % waveform.bits.length] === '1' ? 1 : 0;
      }
      return bitIndex < waveform.bits.length && waveform.bits[bitIndex] === '1' ? 1 : 0;
    }

    if (waveform.kind === 'constant') {
      return waveform.value;
    }

    const inPulse = sampleIndex >= waveform.start && sampleIndex < waveform.start + waveform.width;
    return inPulse ? waveform.value : waveform.idle;
  }

  private static stripComment(line: string): string {
    const commentStart = line.indexOf('#');
    return commentStart >= 0 ? line.slice(0, commentStart) : line;
  }

  private static requiredOption(options: Map<string, SignalDslOption>, key: string, lineNumber: number): SignalDslOption {
    const value = options.get(key);
    if (value === undefined || value.value === '') {
      throw new SignalDslParseError(lineNumber, `missing required option "${key}"`, 1, 'SDL_MISSING_OPTION');
    }
    return value;
  }

  private static rejectUnknownOptions(options: Map<string, SignalDslOption>, allowedKeys: string[], lineNumber: number): void {
    const allowed = new Set(allowedKeys);
    for (const option of options.values()) {
      if (!allowed.has(option.key)) {
        throw new SignalDslParseError(lineNumber, `unknown option "${option.key}"`, option.column, 'SDL_UNKNOWN_OPTION');
      }
    }
  }

  private static parsePositiveInteger(value: string, lineNumber: number, fieldName: string): number {
    const parsed = this.parseIntegerWithUnits(value, lineNumber, fieldName);
    if (parsed <= 0) {
      throw new SignalDslParseError(lineNumber, `${fieldName} must be greater than 0`);
    }
    return parsed;
  }

  private static parseNonNegativeInteger(value: string, lineNumber: number, fieldName: string): number {
    const parsed = this.parseIntegerWithUnits(value, lineNumber, fieldName);
    if (parsed < 0) {
      throw new SignalDslParseError(lineNumber, `${fieldName} cannot be negative`);
    }
    return parsed;
  }

  private static parseInteger(value: string, lineNumber: number, fieldName: string): number {
    if (!/^\d+$/.test(value)) {
      throw new SignalDslParseError(lineNumber, `${fieldName} must be an integer`);
    }
    return Number(value);
  }

  private static parseIntegerWithUnits(value: string, lineNumber: number, fieldName: string): number {
    const match = /^(\d+(?:\.\d+)?)(k|khz|m|mhz)?$/i.exec(value);
    if (!match) {
      throw new SignalDslParseError(lineNumber, `${fieldName} must be a number`);
    }

    const multiplier = this.getUnitMultiplier(match[2]);
    const parsed = Number(match[1]) * multiplier;
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      throw new SignalDslParseError(lineNumber, `${fieldName} must resolve to an integer`);
    }

    return parsed;
  }

  private static getUnitMultiplier(unit?: string): number {
    if (!unit) {
      return 1;
    }

    const normalized = unit.toLowerCase();
    if (normalized === 'k' || normalized === 'khz') {
      return 1000;
    }
    if (normalized === 'm' || normalized === 'mhz') {
      return 1000000;
    }
    return 1;
  }

  private static parseDuty(value: string, lineNumber: number): number {
    const duty = Number(value.endsWith('%') ? Number(value.slice(0, -1)) / 100 : value);
    if (!Number.isFinite(duty) || duty <= 0 || duty >= 1) {
      throw new SignalDslParseError(lineNumber, 'duty must be greater than 0 and less than 1');
    }
    return duty;
  }

  private static parseBoolean(value: string, lineNumber: number, fieldName: string): boolean {
    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === 'no' || normalized === '0') {
      return false;
    }
    throw new SignalDslParseError(lineNumber, `${fieldName} must be true or false`);
  }

  private static parseBit(value: string, lineNumber: number, fieldName: string): 0 | 1 {
    if (value === '0') {
      return 0;
    }
    if (value === '1') {
      return 1;
    }
    throw new SignalDslParseError(lineNumber, `${fieldName} must be 0 or 1`);
  }

  private static validateUniqueChannels(channels: SignalChannelStatement[]): void {
    const seen = new Set<number>();
    for (const channel of channels) {
      if (seen.has(channel.channelNumber)) {
        throw new SignalDslParseError(1, `duplicate channel ${channel.channelNumber}`, 1, 'SDL_DUPLICATE_CHANNEL');
      }
      seen.add(channel.channelNumber);
    }
  }

  private static findColumn(sourceLine: string, token: string): number {
    const index = sourceLine.indexOf(token);
    return index >= 0 ? index + 1 : 1;
  }
}
