import { defineStore } from 'pinia';

export type FrontendTriggerType = 'Edge' | 'Fast' | 'Complex' | 'Blast';
export type FrequencyJitterLevel = 'normal' | 'medium' | 'high';

const DEFAULT_BLAST_FREQUENCY = 100_000_000;

export interface FrontendCaptureChannelConfig {
  number: number;
  name: string;
  enabled: boolean;
}

export interface FrontendCaptureConfig {
  frequency: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  triggerType: FrontendTriggerType;
  triggerChannel: number;
  triggerInverted: boolean;
  triggerPattern?: number;
  triggerBitCount?: number;
  loopCount: number;
  measureBursts: boolean;
  channels: FrontendCaptureChannelConfig[];
}

export interface FrontendCaptureModeLimits {
  minPreSamples: number;
  maxPreSamples: number;
  minPostSamples: number;
  maxPostSamples: number;
  maxTotalSamples: number;
}

export interface FrontendDeviceLimits {
  minFrequency: number;
  maxFrequency: number;
  blastFrequency?: number;
  channelCount: number;
  modeLimits: FrontendCaptureModeLimits[];
}

export interface FrontendDetectedDevice {
  id?: string;
  name?: string;
  type?: string;
  connectionPath?: string;
  connectionString?: string;
  driverType?: string;
  confidence?: number;
}

export interface FrontendDeviceStatus {
  isConnected: boolean;
  isCapturing: boolean;
  currentDevice?: FrontendDetectedDevice | null;
  limits?: FrontendDeviceLimits | null;
  lastCaptureConfig?: FrontendCaptureConfig | null;
  error?: string;
}

function createDefaultChannels(count = 8): FrontendCaptureChannelConfig[] {
  return Array.from({ length: count }, (_, index) => ({
    number: index,
    name: `Channel ${index + 1}`,
    enabled: index < 8
  }));
}

function createDefaultCaptureConfig(): FrontendCaptureConfig {
  return {
    frequency: 1000000,
    preTriggerSamples: 100,
    postTriggerSamples: 1000,
    triggerType: 'Edge',
    triggerChannel: 0,
    triggerInverted: false,
    triggerBitCount: 1,
    triggerPattern: 0,
    loopCount: 0,
    measureBursts: false,
    channels: createDefaultChannels(8)
  };
}

function cloneCaptureConfig(config: FrontendCaptureConfig): FrontendCaptureConfig {
  return {
    ...config,
    channels: config.channels.map(channel => ({ ...channel }))
  };
}

function normalizeChannelCount(limits?: FrontendDeviceLimits | null): number {
  const channelCount = limits?.channelCount;
  if (typeof channelCount === 'number' && Number.isFinite(channelCount) && channelCount > 0) {
    return Math.min(Math.max(Math.floor(channelCount), 1), 120);
  }

  return 8;
}

function mergeChannels(
  currentChannels: FrontendCaptureChannelConfig[],
  limits?: FrontendDeviceLimits | null
): FrontendCaptureChannelConfig[] {
  const channelCount = normalizeChannelCount(limits);
  return Array.from({ length: channelCount }, (_, index) => {
    const existing = currentChannels.find(channel => channel.number === index);
    return {
      number: index,
      name: existing?.name || `Channel ${index + 1}`,
      enabled: existing?.enabled ?? index < Math.min(channelCount, 8)
    };
  });
}

function normalizeCaptureConfig(
  config: FrontendCaptureConfig,
  limits?: FrontendDeviceLimits | null
): FrontendCaptureConfig {
  return {
    ...config,
    channels: mergeChannels(config.channels, limits)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const useDeviceStore = defineStore('frontend-device', {
  state: () => ({
    isConnected: false,
    isConnecting: false,
    isCapturing: false,
    currentDevice: null as FrontendDetectedDevice | null,
    limits: null as FrontendDeviceLimits | null,
    captureConfig: createDefaultCaptureConfig(),
    lastCaptureConfig: null as FrontendCaptureConfig | null,
    error: ''
  }),
  getters: {
    deviceLabel(state): string {
      if (!state.currentDevice) {
        return '未连接';
      }

      return state.currentDevice.name ||
        state.currentDevice.connectionPath ||
        state.currentDevice.connectionString ||
        state.currentDevice.id ||
        '已连接设备';
    },
    enabledChannels(state): FrontendCaptureChannelConfig[] {
      return state.captureConfig.channels.filter(channel => channel.enabled);
    },
    selectedChannelCount(): number {
      return this.enabledChannels.length;
    },
    activeModeLimits(state): FrontendCaptureModeLimits | null {
      const maxChannel = Math.max(...state.captureConfig.channels
        .filter(channel => channel.enabled)
        .map(channel => channel.number), 0);
      const modeIndex = maxChannel < 8 ? 0 : maxChannel < 16 ? 1 : 2;
      return state.limits?.modeLimits?.[modeIndex] ?? null;
    },
    frequencyJitterLevel(state): FrequencyJitterLevel {
      const maxFrequency = state.limits?.maxFrequency;
      if (!maxFrequency || maxFrequency <= 0) {
        return 'normal';
      }

      const ratio = state.captureConfig.frequency / maxFrequency;
      if (ratio >= 0.95) {
        return 'high';
      }

      if (ratio >= 0.8) {
        return 'medium';
      }

      return 'normal';
    },
    frequencyJitterText(): string {
      switch (this.frequencyJitterLevel) {
        case 'high':
          return '接近设备上限，采样抖动风险高';
        case 'medium':
          return '接近设备上限，建议确认误差';
        default:
          return '采样频率处于安全范围';
      }
    }
  },
  actions: {
    applyStatus(status: FrontendDeviceStatus) {
      this.isConnected = status.isConnected;
      this.isCapturing = status.isCapturing;
      this.currentDevice = status.currentDevice ?? null;
      this.limits = status.limits ?? null;
      this.error = status.error ?? '';

      if (status.lastCaptureConfig) {
        this.lastCaptureConfig = cloneCaptureConfig(status.lastCaptureConfig);
        this.captureConfig = normalizeCaptureConfig(
          cloneCaptureConfig(status.lastCaptureConfig),
          this.limits
        );
      } else {
        this.captureConfig = normalizeCaptureConfig(this.captureConfig, this.limits);
      }

      if (this.captureConfig.triggerType === 'Blast') {
        this.setTriggerType('Blast');
      }
    },
    setConnecting(value: boolean) {
      this.isConnecting = value;
    },
    setCapturing(value: boolean) {
      this.isCapturing = value;
    },
    setTriggerType(triggerType: FrontendTriggerType) {
      this.captureConfig.triggerType = triggerType;

      const modeLimits = this.activeModeLimits;
      if (triggerType === 'Blast') {
        const blastFrequency = this.limits?.blastFrequency ?? DEFAULT_BLAST_FREQUENCY;
        this.captureConfig.frequency = blastFrequency;
        this.captureConfig.preTriggerSamples = 0;
        this.captureConfig.loopCount = 0;
        this.captureConfig.measureBursts = false;

        if (modeLimits) {
          this.captureConfig.postTriggerSamples = clamp(
            this.captureConfig.postTriggerSamples,
            modeLimits.minPostSamples,
            modeLimits.maxPostSamples
          );
        }
        return;
      }

      const minFrequency = this.limits?.minFrequency ?? 1000;
      const maxFrequency = this.limits?.maxFrequency ?? 100000000;
      this.captureConfig.frequency = clamp(
        this.captureConfig.frequency,
        minFrequency,
        maxFrequency
      );

      if (modeLimits) {
        this.captureConfig.preTriggerSamples = clamp(
          this.captureConfig.preTriggerSamples,
          modeLimits.minPreSamples,
          modeLimits.maxPreSamples
        );
        this.captureConfig.postTriggerSamples = clamp(
          this.captureConfig.postTriggerSamples,
          modeLimits.minPostSamples,
          modeLimits.maxPostSamples
        );
      } else {
        this.captureConfig.preTriggerSamples = Math.max(2, this.captureConfig.preTriggerSamples);
      }
    },
    setError(error: string) {
      this.error = error;
    },
    applyCaptureConfig(config: FrontendCaptureConfig) {
      this.captureConfig = normalizeCaptureConfig(cloneCaptureConfig(config), this.limits);
    },
    useLastCaptureConfig(): boolean {
      if (!this.lastCaptureConfig) {
        return false;
      }

      this.captureConfig = normalizeCaptureConfig(cloneCaptureConfig(this.lastCaptureConfig), this.limits);
      return true;
    }
  }
});
