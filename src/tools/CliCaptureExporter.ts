import { writeFile } from 'fs/promises';
import { CaptureSession } from '../models/CaptureModels';

export async function writeCaptureOutput(session: CaptureSession, filename: string, format: 'lac' | 'csv'): Promise<void> {
  const data = format === 'lac' ? serializeLac(session) : serializeCsv(session);
  await writeFile(filename, data, 'utf8');
}

export function serializeLac(session: CaptureSession): string {
  const exported = {
    Settings: {
      Frequency: session.frequency,
      PreTriggerSamples: session.preTriggerSamples,
      PostTriggerSamples: session.postTriggerSamples,
      LoopCount: session.loopCount,
      MeasureBursts: session.measureBursts,
      TriggerType: session.triggerType,
      TriggerChannel: session.triggerChannel,
      TriggerInverted: session.triggerInverted,
      TriggerBitCount: session.triggerBitCount,
      TriggerPattern: session.triggerPattern,
      CaptureChannels: session.captureChannels.map(channel => ({
        ChannelNumber: channel.channelNumber,
        ChannelName: channel.channelName,
        ChannelColor: channel.channelColor,
        Hidden: channel.hidden,
        Samples: channel.samples ? Array.from(channel.samples) : undefined
      }))
    },
    Samples: null,
    SelectedRegions: []
  };

  return `${JSON.stringify(exported, null, 2)}\n`;
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

function inferTotalSamples(session: CaptureSession): number {
  const sampleLengths = session.captureChannels
    .map(channel => channel.samples?.length ?? 0)
    .filter(length => length > 0);

  if (sampleLengths.length > 0) {
    return Math.max(...sampleLengths);
  }

  return session.totalSamples;
}
