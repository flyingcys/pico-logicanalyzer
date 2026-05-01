import type { FrontendAnalyzerChannel } from './sessionStore';

export interface VisibleChannelEntry {
  captureIndex: number;
  channel: FrontendAnalyzerChannel;
}

export interface ResolvedI2CMapping {
  sclCaptureIndex: number | null;
  sdaCaptureIndex: number | null;
}

function testChannelName(pattern: RegExp, channelName: string): boolean {
  pattern.lastIndex = 0;
  try {
    return pattern.test(channelName);
  } finally {
    pattern.lastIndex = 0;
  }
}

export function getVisibleChannelEntries(channels: FrontendAnalyzerChannel[]): VisibleChannelEntry[] {
  return channels
    .map((channel, captureIndex) => ({ captureIndex, channel }))
    .filter(entry => !entry.channel.hidden);
}

export function findNamedChannel(
  channels: VisibleChannelEntry[],
  pattern: RegExp,
  usedCaptureIndexes = new Set<number>()
): VisibleChannelEntry | undefined {
  return channels.find(entry =>
    !usedCaptureIndexes.has(entry.captureIndex)
    && testChannelName(pattern, entry.channel.channelName ?? '')
  );
}

export function findFallbackChannel(
  channels: VisibleChannelEntry[],
  fallbackPosition: number,
  usedCaptureIndexes: Set<number>
): VisibleChannelEntry | undefined {
  const numberedChannel = channels.find(entry =>
    !usedCaptureIndexes.has(entry.captureIndex)
    && entry.channel.channelNumber === fallbackPosition
  );
  if (numberedChannel) {
    return numberedChannel;
  }

  const positionalChannel = channels[fallbackPosition];
  if (positionalChannel && !usedCaptureIndexes.has(positionalChannel.captureIndex)) {
    return positionalChannel;
  }

  return channels.find(entry => !usedCaptureIndexes.has(entry.captureIndex));
}

export function resolveI2CMapping(channels: VisibleChannelEntry[]): ResolvedI2CMapping {
  const usedCaptureIndexes = new Set<number>();
  let sclChannel = findNamedChannel(channels, /scl/i, usedCaptureIndexes);
  if (sclChannel) {
    usedCaptureIndexes.add(sclChannel.captureIndex);
  }

  let sdaChannel = findNamedChannel(channels, /sda/i, usedCaptureIndexes);
  if (sdaChannel) {
    usedCaptureIndexes.add(sdaChannel.captureIndex);
  }

  if (!sclChannel) {
    sclChannel = findFallbackChannel(channels, 0, usedCaptureIndexes);
    if (sclChannel) {
      usedCaptureIndexes.add(sclChannel.captureIndex);
    }
  }

  if (!sdaChannel) {
    sdaChannel = findFallbackChannel(channels, 1, usedCaptureIndexes);
  }

  return {
    sclCaptureIndex: sclChannel?.captureIndex ?? null,
    sdaCaptureIndex: sdaChannel?.captureIndex ?? null
  };
}

export function findChannelByName(
  visibleChannels: VisibleChannelEntry[],
  patterns: RegExp[]
): number | null {
  const entry = visibleChannels.find(item =>
    patterns.some(pattern => testChannelName(pattern, item.channel.channelName))
  );

  return entry?.captureIndex ?? null;
}
