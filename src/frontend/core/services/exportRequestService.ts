import type {
  LacSelectedRegion,
  WaveformMarker,
  WaveformMeasurement,
  WaveformSelection,
  WaveformRegion
} from '../stores/waveformStore';

type ExportFormat = 'lac' | 'csv' | 'json' | 'vcd';

interface ExportSessionState {
  fileName: string;
}

interface ExportWaveformState {
  channels: Array<{
    channelNumber: number;
    hidden?: boolean;
  }>;
  selection: WaveformSelection | null;
  viewRange: {
    firstSample: number;
    visibleSamples: number;
  };
  markers: WaveformMarker[];
  lastMeasurement: WaveformMeasurement | null;
  exportSelectedRegionsForLac(): LacSelectedRegion[];
}

export interface WebviewExportRequest {
  source: 'webview';
  format: ExportFormat;
  fileName: string;
  timeRange: 'all' | 'custom';
  customStart?: number;
  customEnd?: number;
  selectedChannels: number[];
  visibleRange: {
    firstSample: number;
    visibleSamples: number;
  };
  selection: WaveformSelection | null;
  selectedRegions: LacSelectedRegion[];
  markers: WaveformMarker[];
  measurement: WaveformMeasurement | null;
}

interface LacSampleRegion {
  FirstSample: number;
  LastSample: number;
  RegionName: string;
  R: number;
  G: number;
  B: number;
  A: number;
}

function cloneSelection(selection: WaveformSelection | null): WaveformSelection | null {
  return selection ? { ...selection } : null;
}

function normalizeSelectedChannels(waveformStore: ExportWaveformState): number[] {
  return waveformStore.channels
    .filter(channel => !channel.hidden)
    .map(channel => channel.channelNumber)
    .filter(channelNumber => Number.isInteger(channelNumber) && channelNumber >= 0);
}

export function buildWebviewExportRequest(
  sessionStore: ExportSessionState,
  waveformStore: ExportWaveformState,
  format: ExportFormat = 'csv'
): WebviewExportRequest {
  const selection = cloneSelection(waveformStore.selection);
  const selectedRegions = waveformStore.exportSelectedRegionsForLac().map(region => ({ ...region }));
  const markers = waveformStore.markers.map(marker => ({ ...marker }));

  return {
    source: 'webview',
    format,
    fileName: sessionStore.fileName,
    timeRange: selection ? 'custom' : 'all',
    customStart: selection?.startSample,
    customEnd: selection ? selection.endSample + 1 : undefined,
    selectedChannels: normalizeSelectedChannels(waveformStore),
    visibleRange: { ...waveformStore.viewRange },
    selection,
    selectedRegions,
    markers,
    measurement: waveformStore.lastMeasurement ? { ...waveformStore.lastMeasurement } : null
  };
}

function parseRgbaColor(color: string): Pick<LacSampleRegion, 'R' | 'G' | 'B' | 'A'> {
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)/i
  );
  if (!rgbaMatch) {
    return { R: 34, G: 197, B: 94, A: 255 };
  }

  const [, r, g, b, a] = rgbaMatch;
  const alpha = a === undefined || a === '' ? 1 : Number(a);
  return {
    R: Math.max(0, Math.min(255, Math.round(Number(r)))),
    G: Math.max(0, Math.min(255, Math.round(Number(g)))),
    B: Math.max(0, Math.min(255, Math.round(Number(b)))),
    A: Math.max(0, Math.min(255, Math.round(alpha * 255)))
  };
}

function toLacSampleRegion(region: WaveformRegion | LacSelectedRegion): LacSampleRegion {
  const firstSample = 'firstSample' in region ? region.firstSample : region.startSample;
  const lastSample = 'lastSample' in region ? region.lastSample : region.endSample;
  const regionName = 'regionName' in region ? region.regionName : region.name;
  const color = parseRgbaColor(region.color);

  return {
    FirstSample: firstSample,
    LastSample: lastSample,
    RegionName: regionName,
    ...color
  };
}

export function mergeWaveformRegionsIntoLacDocument(
  documentContent: string,
  waveformStore: Pick<ExportWaveformState, 'exportSelectedRegionsForLac'>
): string {
  const root = JSON.parse(documentContent) as Record<string, unknown>;
  const selectedRegions = waveformStore.exportSelectedRegionsForLac().map(toLacSampleRegion);

  if (selectedRegions.length > 0) {
    root.SelectedRegions = selectedRegions;
  } else {
    delete root.SelectedRegions;
  }

  return JSON.stringify(root, null, 2);
}
