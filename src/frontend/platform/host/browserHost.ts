import type {
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
  HostAdapter,
  HostCommandResult,
  HostInboundMessage,
  HostMessageHandler
} from './types';
import type {
  FrontendCaptureConfig,
  FrontendDetectedDevice,
  FrontendDeviceLimits,
  FrontendDeviceStatus
} from '../../core/stores/deviceStore';

const defaultCapabilities: FrontendCapabilities = {
  canSave: false,
  canExport: true,
  canStartCapture: false,
  canConnectDevice: false
};

function cloneDocument(document?: FrontendDocumentData): FrontendDocumentData | undefined {
  return document ? { ...document } : undefined;
}

function createInvalidLacError(): HostInboundMessage {
  return {
    type: 'error',
    payload: {
      message: '解析文件失败: 无效的.lac文件格式'
    }
  };
}

function parseLacPayload(payload: unknown): { content: string; parsed: unknown } | null {
  if (typeof payload === 'string') {
    try {
      return {
        content: payload,
        parsed: JSON.parse(payload)
      };
    } catch {
      return null;
    }
  }

  return {
    content: JSON.stringify(payload ?? {}, null, 2),
    parsed: payload ?? {}
  };
}

function createDefaultDocument(): FrontendDocumentData {
  return {
    uri: 'memory://logic-analyzer/demo.lac',
    fileName: 'demo.lac',
    content: '{\n  "channels": []\n}'
  };
}

const browserHostLimits: FrontendDeviceLimits = {
  minFrequency: 1000,
  maxFrequency: 24000000,
  blastFrequency: 100000000,
  channelCount: 8,
  modeLimits: [
    {
      minPreSamples: 0,
      maxPreSamples: 1000000,
      minPostSamples: 1,
      maxPostSamples: 1000000,
      maxTotalSamples: 1000000
    }
  ]
};

function cloneCaptureConfig(config: FrontendCaptureConfig): FrontendCaptureConfig {
  return {
    ...config,
    channels: config.channels.map(channel => ({ ...channel }))
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCaptureConfig(payload: unknown): FrontendCaptureConfig | null {
  const payloadRecord = isRecord(payload) ? payload : undefined;
  const config = isRecord(payloadRecord?.config) ? payloadRecord.config : payloadRecord;
  if (!isRecord(config)) {
    return null;
  }

  const frequency = config.frequency;
  const preTriggerSamples = config.preTriggerSamples;
  const postTriggerSamples = config.postTriggerSamples;
  const triggerChannel = config.triggerChannel;
  const triggerType = config.triggerType;
  const channels = Array.isArray(config.channels) ? config.channels : [];

  if (
    typeof frequency !== 'number' ||
    !Number.isFinite(frequency) ||
    frequency <= 0 ||
    typeof preTriggerSamples !== 'number' ||
    !Number.isFinite(preTriggerSamples) ||
    preTriggerSamples < 0 ||
    typeof postTriggerSamples !== 'number' ||
    !Number.isFinite(postTriggerSamples) ||
    postTriggerSamples <= 0 ||
    typeof triggerChannel !== 'number' ||
    !Number.isInteger(triggerChannel) ||
    typeof triggerType !== 'string'
  ) {
    return null;
  }

  const normalizedChannels = channels
    .filter(channel => isRecord(channel) && typeof channel.number === 'number')
    .map(channel => ({
      number: channel.number as number,
      name: typeof channel.name === 'string' ? channel.name : `Channel ${(channel.number as number) + 1}`,
      enabled: typeof channel.enabled === 'boolean' ? channel.enabled : true
    }));

  if (!normalizedChannels.some(channel => channel.enabled)) {
    return null;
  }

  return {
    frequency,
    preTriggerSamples,
    postTriggerSamples,
    triggerType: triggerType as FrontendCaptureConfig['triggerType'],
    triggerChannel,
    triggerInverted: typeof config.triggerInverted === 'boolean' ? config.triggerInverted : false,
    triggerPattern: typeof config.triggerPattern === 'number' ? config.triggerPattern : 0,
    triggerBitCount: typeof config.triggerBitCount === 'number' ? config.triggerBitCount : 1,
    loopCount: typeof config.loopCount === 'number' ? config.loopCount : 0,
    measureBursts: typeof config.measureBursts === 'boolean' ? config.measureBursts : false,
    channels: normalizedChannels
  };
}

function createDetectedDevice(payload: unknown): FrontendDetectedDevice {
  const payloadRecord = isRecord(payload) ? payload : {};
  const type = typeof payloadRecord.type === 'string' ? payloadRecord.type : 'serial';
  const address = typeof payloadRecord.address === 'string'
    ? payloadRecord.address
    : type === 'network'
      ? '127.0.0.1:4045'
      : '/dev/ttyUSB0';

  return {
    id: `html-${type}-${address}`,
    name: type === 'network' ? 'HTML 模拟 Pico W' : 'HTML 模拟 Pico',
    type,
    connectionPath: type === 'serial' ? address : undefined,
    connectionString: type === 'network' ? address : undefined,
    driverType: 'browser-simulator',
    confidence: 1
  };
}

function createLacDocument(config: FrontendCaptureConfig, documentData: FrontendDocumentData): FrontendDocumentData {
  const enabledChannels = config.channels.filter(channel => channel.enabled);
  const totalSamples = Math.max(config.preTriggerSamples + config.postTriggerSamples, 1);
  const samples = Array.from({ length: totalSamples }, (_, sampleIndex) => {
    const word = enabledChannels.reduce((value, channel, bitIndex) => {
      const bit = (sampleIndex + bitIndex) % 2 === 0 ? 1 : 0;
      return value | (bit << channel.number);
    }, 0);

    return word.toString(16).padStart(32, '0');
  });
  const lacData = {
    Settings: {
      Frequency: config.frequency,
      PreTriggerSamples: config.preTriggerSamples,
      PostTriggerSamples: config.postTriggerSamples,
      LoopCount: config.loopCount,
      MeasureBursts: config.measureBursts,
      CaptureChannels: enabledChannels.map(channel => ({
        ChannelNumber: channel.number,
        ChannelName: channel.name,
        Hidden: false
      }))
    },
    Samples: samples
  };

  return {
    ...documentData,
    content: JSON.stringify(lacData, null, 2)
  };
}

export function createBrowserHost(): HostAdapter {
  const bootstrap = readBrowserBootstrap();
  const handlers = new Set<HostMessageHandler>();
  let documentData = cloneDocument(bootstrap.document) ?? createDefaultDocument();
  let currentDevice: FrontendDetectedDevice | null = null;
  let isCapturing = false;
  let lastCaptureConfig: FrontendCaptureConfig | null = null;

  const emit = (message: HostInboundMessage) => {
    handlers.forEach(handler => handler(message));
  };
  const createStatus = (): FrontendDeviceStatus => ({
    isConnected: Boolean(currentDevice),
    isCapturing,
    currentDevice,
    limits: currentDevice ? browserHostLimits : null,
    lastCaptureConfig: lastCaptureConfig ? cloneCaptureConfig(lastCaptureConfig) : null
  });
  const runSyntheticCapture = (payload: unknown): HostCommandResult<FrontendDeviceStatus & {
    capturedDocument: FrontendDocumentData;
  }> => {
    if (!currentDevice) {
      return {
        success: false,
        error: '请先连接逻辑分析器设备'
      };
    }

    const config = readCaptureConfig(payload);
    if (!config) {
      return {
        success: false,
        error: '采集配置无效'
      };
    }

    isCapturing = true;
    lastCaptureConfig = cloneCaptureConfig(config);
    documentData = createLacDocument(config, documentData);
    const parsed = JSON.parse(documentData.content);
    isCapturing = false;
    emit({
      type: 'documentUpdate',
      payload: parsed
    });

    return {
      success: true,
      data: {
        ...createStatus(),
        capturedDocument: cloneDocument(documentData)!
      }
    };
  };

  return {
    ready() {},
    loadInitialDocument() {
      return cloneDocument(documentData);
    },
    saveDocument(payload) {
      const parsedDocument = parseLacPayload(payload);
      if (!parsedDocument) {
        emit(createInvalidLacError());
        return;
      }

      documentData = {
        ...documentData,
        content: parsedDocument.content
      };

      emit({
        type: 'documentUpdate',
        payload: parsedDocument.parsed
      });
    },
    exportData(payload) {
      emit({
        type: 'export',
        payload
      });
    },
    connectDevice() {
      emit({
        type: 'connectDevice'
      });
    },
    startCapture() {
      emit({
        type: 'startCapture'
      });
    },
    async sendCommand<T = unknown>(command, payload): Promise<HostCommandResult<T>> {
      switch (command) {
        case 'export':
        case 'exportData':
          this.exportData(payload);
          return { success: true } as HostCommandResult<T>;
        case 'connectDevice':
          currentDevice = createDetectedDevice(payload);
          emit({
            type: 'connectDevice',
            payload: currentDevice
          });
          return {
            success: true,
            data: createStatus()
          } as HostCommandResult<T>;
        case 'disconnectDevice':
          currentDevice = null;
          isCapturing = false;
          return {
            success: true,
            data: createStatus()
          } as HostCommandResult<T>;
        case 'detectDevices':
          return {
            success: true,
            data: [createDetectedDevice({ type: 'serial', address: '/dev/ttyUSB0' })]
          } as HostCommandResult<T>;
        case 'scanForDevices':
        case 'scanNetworkDevices':
          return {
            success: true,
            data: [
              {
                ...createDetectedDevice({ type: 'network', address: '127.0.0.1:4045' }),
                name: 'HTML 模拟 Pico',
                connectionString: '127.0.0.1:4045'
              }
            ]
          } as HostCommandResult<T>;
        case 'getStatus':
          return {
            success: true,
            data: createStatus()
          } as HostCommandResult<T>;
        case 'startCapture':
          return runSyntheticCapture(payload) as HostCommandResult<T>;
        case 'repeatCapture':
          if (!lastCaptureConfig) {
            return {
              success: false,
              error: '没有可重复执行的采集配置'
            } as HostCommandResult<T>;
          }
          return runSyntheticCapture({ config: lastCaptureConfig }) as HostCommandResult<T>;
        case 'stopCapture':
          if (!currentDevice) {
            return {
              success: false,
              error: '当前没有已连接设备'
            } as HostCommandResult<T>;
          }
          isCapturing = false;
          return {
            success: true,
            data: createStatus()
          } as HostCommandResult<T>;
        default:
          emit({
            type: 'hostCommand',
            payload: {
              command,
              payload
            }
          });

          return {
            success: false,
            error: `HTML host 不支持命令: ${command}`
          } as HostCommandResult<T>;
      }
    },
    onMessage(handler: HostMessageHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}

export function readBrowserBootstrap(): FrontendBootstrapData {
  const bootstrap = typeof window === 'undefined'
    ? undefined
    : (window as Window & typeof globalThis & {
        __FRONTEND_BOOTSTRAP__?: FrontendBootstrapData;
      }).__FRONTEND_BOOTSTRAP__;

  if (bootstrap?.host === 'html') {
    return {
      ...bootstrap,
      capabilities: {
        ...defaultCapabilities,
        ...bootstrap.capabilities
      }
    };
  }

  return {
    host: 'html',
    document: createDefaultDocument(),
    capabilities: defaultCapabilities
  };
}
