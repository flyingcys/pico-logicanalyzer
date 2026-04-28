import { writeFile } from 'fs/promises';
import { CaptureSession } from '../models/CaptureModels';
import { LACFileFormat } from '../models/LACFileFormat';
import type { CliOutputFormat } from './CliCaptureConfig';

export async function writeCaptureOutput(session: CaptureSession, filename: string, format: CliOutputFormat): Promise<void> {
  const data = format === 'lac'
    ? serializeLac(session)
    : format === 'csv'
      ? serializeCsv(session)
      : serializeJson(session);
  await writeFile(filename, data, 'utf8');
}

export function serializeLac(session: CaptureSession): string {
  const exported = LACFileFormat.createFromCaptureSession(
    session,
    [],
    session.captureChannels.some(channel => channel.samples && channel.samples.length > 0)
  );
  return `${LACFileFormat.serialize(exported)}\n`;
}

export function serializeCsv(session: CaptureSession): string {
  const headers = ['Time', ...session.captureChannels.map(channel => channel.channelName || `Channel ${channel.channelNumber + 1}`)];
  const lines = [headers.join(',')];
  const totalSamples = inferTotalSamples(session);

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex++) {
    const timeMs = ((sampleIndex / session.frequency) * 1000).toFixed(6);
    const values = session.captureChannels.map(channel => String(channel.samples?.[sampleIndex] ?? 0));
    lines.push([timeMs, ...values].join(','));
  }

  return lines.join('\n');
}

export function serializeJson(session: CaptureSession): string {
  const totalSamples = inferTotalSamples(session);
  const samples = [];

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex++) {
    const values: Record<string, number> = {};
    for (const channel of session.captureChannels) {
      values[String(channel.channelNumber)] = channel.samples?.[sampleIndex] ? 1 : 0;
    }
    samples.push({
      index: sampleIndex,
      timeMs: Number(((sampleIndex / session.frequency) * 1000).toFixed(6)),
      values
    });
  }

  const exported = {
    metadata: {
      format: 'logic-analyzer-capture-json',
      version: 1,
      totalSamples,
      channelCount: session.captureChannels.length
    },
    settings: {
      frequency: session.frequency,
      preTriggerSamples: session.preTriggerSamples,
      postTriggerSamples: session.postTriggerSamples,
      loopCount: session.loopCount,
      measureBursts: session.measureBursts,
      triggerType: session.triggerType,
      triggerChannel: session.triggerChannel,
      triggerInverted: session.triggerInverted,
      triggerBitCount: session.triggerBitCount,
      triggerPattern: session.triggerPattern
    },
    channels: session.captureChannels.map(channel => ({
      number: channel.channelNumber,
      name: channel.channelName || `Channel ${channel.channelNumber + 1}`,
      hidden: channel.hidden
    })),
    timebase: {
      sampleRate: session.frequency,
      totalSamples,
      durationSeconds: totalSamples / session.frequency
    },
    samples
  };

  return `${JSON.stringify(exported, null, 2)}\n`;
}

function inferTotalSamples(session: CaptureSession): number {
  const sampleLengths = session.captureChannels
    .map(channel => channel.samples?.length ?? 0)
    .filter(length => length > 0);

  if (sampleLengths.length > 0) {
    return Math.max(...sampleLengths);
  }

  return session.totalSamples;
}
