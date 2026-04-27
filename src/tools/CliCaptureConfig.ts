import { readFile, writeFile } from 'fs/promises';
import { AnalyzerChannel, CaptureSession } from '../models/CaptureModels';
import { TriggerType } from '../models/AnalyzerTypes';

export type CliOutputFormat = 'lac' | 'csv';

export interface CliCaptureConfig {
  device: string;
  frequency: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  channels: number[];
  triggerType: TriggerType;
  triggerChannel: number;
  triggerInverted: boolean;
  triggerBitCount: number;
  triggerPattern: number;
  loopCount: number;
  measureBursts: boolean;
  output: string;
  format: CliOutputFormat;
}

export interface CliNetworkConfig {
  device: string;
  ssid: string;
  password: string;
  ipAddress: string;
  port: number;
}

export function parseChannelList(value: string | number[] | undefined): number[] {
  if (Array.isArray(value)) {
    return normalizeChannels(value);
  }

  if (!value || value.trim().length === 0) {
    throw new Error('必须至少选择一个采集通道');
  }

  const channels: number[] = [];
  for (const part of value.split(',')) {
    const token = part.trim();
    if (!token) {
      continue;
    }

    if (token.includes('-')) {
      const [startRaw, endRaw] = token.split('-');
      const start = parseInteger(startRaw, '通道范围起点');
      const end = parseInteger(endRaw, '通道范围终点');
      if (end < start) {
        throw new Error(`通道范围无效: ${token}`);
      }
      for (let channel = start; channel <= end; channel++) {
        channels.push(channel);
      }
    } else {
      channels.push(parseInteger(token, '通道编号'));
    }
  }

  return normalizeChannels(channels);
}

export function parseTriggerType(value: string | number | TriggerType | undefined): TriggerType {
  if (value === undefined || value === null || value === '') {
    return TriggerType.Edge;
  }

  if (typeof value === 'number') {
    if (value in TriggerType) {
      return value as TriggerType;
    }
    throw new Error(`不支持的触发类型: ${value}`);
  }

  const normalized = String(value).trim().toLowerCase();
  switch (normalized) {
    case '0':
    case 'edge':
      return TriggerType.Edge;
    case '1':
    case 'complex':
      return TriggerType.Complex;
    case '2':
    case 'fast':
      return TriggerType.Fast;
    case '3':
    case 'blast':
      return TriggerType.Blast;
    default:
      throw new Error(`不支持的触发类型: ${value}`);
  }
}

export function validateCaptureConfig(config: CliCaptureConfig): string[] {
  const errors: string[] = [];

  if (!config.device) {
    errors.push('必须指定设备地址');
  }
  if (!Number.isFinite(config.frequency) || config.frequency <= 0) {
    errors.push('采样率必须大于 0');
  }
  if (!Number.isInteger(config.preTriggerSamples) || config.preTriggerSamples < 0) {
    errors.push('pre-trigger 样本数必须为非负整数');
  }
  if (!Number.isInteger(config.postTriggerSamples) || config.postTriggerSamples <= 0) {
    errors.push('post-trigger 样本数必须大于 0');
  }
  if (config.channels.length === 0) {
    errors.push('必须至少选择一个采集通道');
  }
  if (config.channels.some(channel => channel < 0 || channel > 23 || !Number.isInteger(channel))) {
    errors.push('通道编号必须在 0-23 之间');
  }
  if (!Number.isInteger(config.triggerChannel) || config.triggerChannel < 0 || config.triggerChannel > 23) {
    errors.push('触发通道必须在 0-23 之间');
  }
  if (!Number.isInteger(config.triggerBitCount) || config.triggerBitCount < 1 || config.triggerBitCount > 16) {
    errors.push('触发位宽必须在 1-16 之间');
  }
  if (!Number.isInteger(config.loopCount) || config.loopCount < 0 || config.loopCount > 255) {
    errors.push('loop-count 必须在 0-255 之间');
  }
  if (config.format !== 'lac' && config.format !== 'csv') {
    errors.push('输出格式只支持 lac 或 csv');
  }
  if (!config.output) {
    errors.push('必须指定输出文件');
  }
  if (config.triggerType === TriggerType.Blast) {
    if (config.preTriggerSamples !== 0) {
      errors.push('Blast 模式要求 pre-trigger 样本数为 0');
    }
    if (config.loopCount !== 0) {
      errors.push('Blast 模式要求 loop-count 为 0');
    }
  }

  return errors;
}

export function buildCaptureSession(config: CliCaptureConfig): CaptureSession {
  const session = new CaptureSession();
  session.frequency = config.frequency;
  session.preTriggerSamples = config.preTriggerSamples;
  session.postTriggerSamples = config.postTriggerSamples;
  session.loopCount = config.loopCount;
  session.measureBursts = config.measureBursts;
  session.triggerType = config.triggerType;
  session.triggerChannel = config.triggerChannel;
  session.triggerInverted = config.triggerInverted;
  session.triggerBitCount = config.triggerBitCount;
  session.triggerPattern = config.triggerPattern;
  session.captureChannels = config.channels.map(channel => new AnalyzerChannel(channel, `Channel ${channel + 1}`));
  return session;
}

export async function loadCaptureConfigFile(filename: string): Promise<Partial<CliCaptureConfig>> {
  const raw = JSON.parse(await readFile(filename, 'utf8'));
  const channels = raw.CaptureChannels ?? raw.channels;

  return {
    device: raw.Device ?? raw.device,
    frequency: coerceOptionalNumber(raw.Frequency ?? raw.frequency),
    preTriggerSamples: coerceOptionalNumber(raw.PreTriggerSamples ?? raw.preTriggerSamples),
    postTriggerSamples: coerceOptionalNumber(raw.PostTriggerSamples ?? raw.postTriggerSamples),
    channels: channels ? parseChannelList(channels) : undefined,
    triggerType: raw.TriggerType !== undefined || raw.triggerType !== undefined
      ? parseTriggerType(raw.TriggerType ?? raw.triggerType)
      : undefined,
    triggerChannel: coerceOptionalNumber(raw.TriggerChannel ?? raw.triggerChannel),
    triggerInverted: raw.TriggerInverted ?? raw.triggerInverted,
    triggerBitCount: coerceOptionalNumber(raw.TriggerBitCount ?? raw.triggerBitCount),
    triggerPattern: coerceOptionalNumber(raw.TriggerPattern ?? raw.triggerPattern),
    loopCount: coerceOptionalNumber(raw.LoopCount ?? raw.loopCount),
    measureBursts: raw.MeasureBursts ?? raw.measureBursts,
    output: raw.Output ?? raw.output,
    format: normalizeFormat(raw.Format ?? raw.format)
  };
}

export async function saveCaptureConfigFile(filename: string, config: CliCaptureConfig): Promise<void> {
  const data = {
    FormatVersion: 1,
    Device: config.device,
    Frequency: config.frequency,
    PreTriggerSamples: config.preTriggerSamples,
    PostTriggerSamples: config.postTriggerSamples,
    CaptureChannels: config.channels,
    TriggerType: triggerTypeName(config.triggerType),
    TriggerChannel: config.triggerChannel,
    TriggerInverted: config.triggerInverted,
    TriggerBitCount: config.triggerBitCount,
    TriggerPattern: config.triggerPattern,
    LoopCount: config.loopCount,
    MeasureBursts: config.measureBursts,
    Output: config.output,
    Format: config.format
  };

  await writeFile(filename, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function normalizeFormat(value: string | undefined): CliOutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized !== 'lac' && normalized !== 'csv') {
    throw new Error(`输出格式只支持 lac 或 csv: ${value}`);
  }
  return normalized;
}

function normalizeChannels(channels: number[]): number[] {
  const normalized = Array.from(new Set(channels)).sort((a, b) => a - b);
  for (const channel of normalized) {
    if (!Number.isInteger(channel) || channel < 0 || channel > 23) {
      throw new Error('通道编号必须在 0-23 之间');
    }
  }
  return normalized;
}

function parseInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label}必须是整数`);
  }
  return parsed;
}

function coerceOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`数值字段无效: ${value}`);
  }
  return parsed;
}

function triggerTypeName(triggerType: TriggerType): string {
  switch (triggerType) {
    case TriggerType.Complex:
      return 'Complex';
    case TriggerType.Fast:
      return 'Fast';
    case TriggerType.Blast:
      return 'Blast';
    case TriggerType.Edge:
    default:
      return 'Edge';
  }
}
