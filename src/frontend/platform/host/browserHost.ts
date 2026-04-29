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

interface BrowserDecoderChannelMapping {
  captureIndex: number;
  decoderIndex: number;
  name?: string;
}

interface BrowserRunDecoderRequest {
  decoderId: string;
  channelMapping: BrowserDecoderChannelMapping[];
}

interface BrowserDecoderResult {
  startSample: number;
  endSample: number;
  annotationType: number;
  values: string[];
  rawData?: unknown;
  shape?: 'hexagon' | 'rectangle' | 'diamond';
}

interface BrowserRunDecoderResponse {
  decoderId: string;
  decoderName: string;
  success: boolean;
  executionTime: number;
  results: BrowserDecoderResult[];
  error?: string;
  performanceStats?: {
    totalSamples: number;
    processingSpeed: number;
  };
}

interface BrowserDecoderChannel {
  channelNumber: number;
  channelName: string;
  hidden: boolean;
  sampleCount: number;
}

interface BrowserDecoderDocument {
  sampleRate: number;
  channels: BrowserDecoderChannel[];
  sampleCount: number;
  hasSamples: boolean;
}

const I2C_DECODER_ID = 'i2c';
const I2C_DECODER_NAME = 'I²C HTML 模拟';
const SPI_DECODER_ID = 'spi';
const SPI_DECODER_NAME = 'SPI HTML 模拟';
const NO_DECODABLE_SAMPLES = '当前文件没有可解码样本';
const INVALID_SAMPLE_RATE = '采样率无效，无法执行协议解码';
const I2C_CHANNELS_REQUIRED = 'I2C 解码需要 SCL 和 SDA 两个通道';
const I2C_SAME_CHANNEL = 'SCL 和 SDA 不能映射到同一采集通道';
const SPI_CHANNELS_REQUIRED = 'SPI 解码需要 CLK 和至少一个 MISO/MOSI 通道';
const SPI_SAME_CHANNEL = 'SPI 通道映射不能重复使用同一采集通道';

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

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function readBoolean(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return false;
}

function readArray(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function readSampleCount(value: unknown): number {
  if (value instanceof Uint8Array || Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === 'string') {
    return value.trim().length;
  }

  return 0;
}

function parseJsonRecord(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readDecoderSessionPayload(rootPayload: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(rootPayload.Settings)) {
    return rootPayload.Settings;
  }

  if (isRecord(rootPayload.captureSession)) {
    return rootPayload.captureSession;
  }

  return rootPayload;
}

function readBrowserDecoderDocument(document: FrontendDocumentData): BrowserDecoderDocument {
  const rootPayload = parseJsonRecord(document.content);
  if (!rootPayload) {
    return {
      sampleRate: 0,
      channels: [],
      sampleCount: 0,
      hasSamples: false
    };
  }

  const sessionPayload = readDecoderSessionPayload(rootPayload);
  const metadata = isRecord(sessionPayload.metadata) ? sessionPayload.metadata : undefined;
  const rootSamples = readArray(rootPayload.Samples, rootPayload.samples);
  const rootSampleCount = rootSamples.length;
  const channelPayloads = readArray(
    sessionPayload.CaptureChannels,
    sessionPayload.captureChannels,
    sessionPayload.Channels,
    sessionPayload.channels
  );
  const channels = channelPayloads
    .filter(isRecord)
    .map((channelPayload, index): BrowserDecoderChannel => {
      const channelNumber = readNumber(channelPayload.ChannelNumber, channelPayload.channelNumber, index) ?? index;
      const sampleCount = readSampleCount(channelPayload.Samples ?? channelPayload.samples) || rootSampleCount;

      return {
        channelNumber,
        channelName: readString(
          channelPayload.ChannelName,
          channelPayload.channelName,
          `Channel ${channelNumber + 1}`
        ) ?? `Channel ${channelNumber + 1}`,
        hidden: readBoolean(channelPayload.Hidden, channelPayload.hidden),
        sampleCount
      };
    });
  const channelSampleCount = channels.reduce(
    (maxSamples, channel) => Math.max(maxSamples, channel.sampleCount),
    0
  );
  const sampleCount = Math.max(rootSampleCount, channelSampleCount);

  return {
    sampleRate: readNumber(
      sessionPayload.Frequency,
      sessionPayload.frequency,
      sessionPayload.SampleRate,
      sessionPayload.sampleRate,
      metadata?.sampleRate
    ) ?? 0,
    channels,
    sampleCount,
    hasSamples: sampleCount > 0
  };
}

function readRunDecoderRequest(payload: unknown): BrowserRunDecoderRequest {
  const payloadRecord = isRecord(payload) ? payload : {};
  const rawMapping = Array.isArray(payloadRecord.channelMapping) ? payloadRecord.channelMapping : [];
  const channelMapping = rawMapping
    .filter(isRecord)
    .map(item => ({
      captureIndex: readNumber(item.captureIndex) ?? -1,
      decoderIndex: readNumber(item.decoderIndex) ?? -1,
      name: readString(item.name)
    }))
    .filter(item =>
      Number.isInteger(item.captureIndex) &&
      item.captureIndex >= 0 &&
      Number.isInteger(item.decoderIndex) &&
      item.decoderIndex >= 0
    );

  return {
    decoderId: readString(payloadRecord.decoderId) ?? I2C_DECODER_ID,
    channelMapping
  };
}

function createRunDecoderResponse(
  decoderId: string,
  decoderName: string,
  response: Omit<BrowserRunDecoderResponse, 'decoderId' | 'decoderName'>
): HostCommandResult<BrowserRunDecoderResponse> {
  return {
    success: true,
    data: {
      decoderId,
      decoderName,
      ...response
    }
  };
}

function createRunDecoderFailure(
  decoderId: string,
  decoderName: string,
  error: string
): HostCommandResult<BrowserRunDecoderResponse> {
  return createRunDecoderResponse(decoderId, decoderName, {
    success: false,
    executionTime: 0,
    results: [],
    error
  });
}

function toStableSample(sampleCount: number, sample: number): number {
  if (sampleCount >= 84) {
    return sample;
  }

  const lastSample = Math.max(sampleCount - 1, 0);
  return Math.min(lastSample, Math.max(0, Math.round((sample / 83) * lastSample)));
}

function createSyntheticI2CResults(sampleCount: number): BrowserDecoderResult[] {
  const point = (sample: number) => toStableSample(sampleCount, sample);
  const addressStart = point(10);
  const addressEnd = Math.max(addressStart, point(42));
  const ackStart = point(42);
  const ackEnd = Math.max(ackStart, point(46));
  const dataStart = point(46);
  const dataEnd = Math.max(dataStart, point(78));
  const dataAckStart = point(78);
  const dataAckEnd = Math.max(dataAckStart, point(82));
  const stopSample = point(82);

  return [
    { startSample: point(6), endSample: point(6), annotationType: 0, values: ['START', 'S'] },
    {
      startSample: addressStart,
      endSample: addressEnd,
      annotationType: 7,
      values: ['Address write: 50', 'AW: 50', '50'],
      rawData: 80
    },
    { startSample: ackStart, endSample: ackEnd, annotationType: 3, values: ['ACK', 'A'] },
    {
      startSample: dataStart,
      endSample: dataEnd,
      annotationType: 9,
      values: ['Data write: 3C', 'DW: 3C', '3C'],
      rawData: 60
    },
    { startSample: dataAckStart, endSample: dataAckEnd, annotationType: 3, values: ['ACK', 'A'] },
    { startSample: stopSample, endSample: stopSample, annotationType: 2, values: ['STOP', 'P'] }
  ];
}

function createSyntheticSPIResults(sampleCount: number): BrowserDecoderResult[] {
  const point = (sample: number) => toStableSample(sampleCount, sample);
  const startSample = point(1);
  const endSample = Math.max(startSample, point(16));
  const transferEnd = Math.max(endSample, point(20));

  return [
    {
      startSample,
      endSample,
      annotationType: 0,
      values: ['MISO: A5', 'A5'],
      rawData: 0xA5
    },
    {
      startSample,
      endSample,
      annotationType: 1,
      values: ['MOSI: 3C', '3C'],
      rawData: 0x3C
    },
    {
      startSample: point(0),
      endSample: startSample,
      annotationType: 7,
      values: ['CS asserted', 'CS active'],
      rawData: 0
    },
    {
      startSample,
      endSample: transferEnd,
      annotationType: 5,
      values: ['A5']
    },
    {
      startSample,
      endSample: transferEnd,
      annotationType: 6,
      values: ['3C']
    }
  ];
}

function validateI2CMapping(
  document: BrowserDecoderDocument,
  channelMapping: BrowserDecoderChannelMapping[]
): string | null {
  const sclMapping = channelMapping.find(mapping => mapping.decoderIndex === 0);
  const sdaMapping = channelMapping.find(mapping => mapping.decoderIndex === 1);

  if (!sclMapping || !sdaMapping) {
    return I2C_CHANNELS_REQUIRED;
  }

  const sclChannel = document.channels[sclMapping.captureIndex];
  const sdaChannel = document.channels[sdaMapping.captureIndex];
  if (!sclChannel || !sdaChannel || sclChannel.sampleCount <= 0 || sdaChannel.sampleCount <= 0) {
    return I2C_CHANNELS_REQUIRED;
  }

  if (sclMapping.captureIndex === sdaMapping.captureIndex) {
    return I2C_SAME_CHANNEL;
  }

  return null;
}

function validateSPIMapping(
  document: BrowserDecoderDocument,
  channelMapping: BrowserDecoderChannelMapping[]
): string | null {
  const clkMapping = channelMapping.find(mapping => mapping.decoderIndex === 0);
  const misoMapping = channelMapping.find(mapping => mapping.decoderIndex === 1);
  const mosiMapping = channelMapping.find(mapping => mapping.decoderIndex === 2);
  const dataMappings = [misoMapping, mosiMapping].filter(
    (mapping): mapping is BrowserDecoderChannelMapping => Boolean(mapping)
  );

  if (!clkMapping || dataMappings.length === 0) {
    return SPI_CHANNELS_REQUIRED;
  }

  const requiredMappings = [clkMapping, ...dataMappings];
  if (requiredMappings.some(mapping => {
    const channel = document.channels[mapping.captureIndex];
    return !channel || channel.sampleCount <= 0;
  })) {
    return SPI_CHANNELS_REQUIRED;
  }

  const selectedCaptureIndexes = channelMapping
    .map(mapping => mapping.captureIndex)
    .filter(index => index >= 0);
  if (new Set(selectedCaptureIndexes).size !== selectedCaptureIndexes.length) {
    return SPI_SAME_CHANNEL;
  }

  return null;
}

function runBrowserDecoder(documentData: FrontendDocumentData, payload: unknown): HostCommandResult<BrowserRunDecoderResponse> {
  const request = readRunDecoderRequest(payload);
  const { decoderId } = request;

  if (decoderId !== I2C_DECODER_ID && decoderId !== SPI_DECODER_ID) {
    return createRunDecoderFailure(decoderId, decoderId, `Decoder not found: ${decoderId}`);
  }

  const decoderDocument = readBrowserDecoderDocument(documentData);
  const decoderName = decoderId === SPI_DECODER_ID ? SPI_DECODER_NAME : I2C_DECODER_NAME;
  if (!decoderDocument.hasSamples) {
    return createRunDecoderFailure(decoderId, decoderName, NO_DECODABLE_SAMPLES);
  }

  if (decoderDocument.sampleRate <= 0) {
    return createRunDecoderFailure(decoderId, decoderName, INVALID_SAMPLE_RATE);
  }

  const mappingError = decoderId === SPI_DECODER_ID
    ? validateSPIMapping(decoderDocument, request.channelMapping)
    : validateI2CMapping(decoderDocument, request.channelMapping);
  if (mappingError) {
    return createRunDecoderFailure(decoderId, decoderName, mappingError);
  }

  const results = decoderId === SPI_DECODER_ID
    ? createSyntheticSPIResults(decoderDocument.sampleCount)
    : createSyntheticI2CResults(decoderDocument.sampleCount);

  return createRunDecoderResponse(decoderId, decoderName, {
    success: true,
    executionTime: 1,
    results: results.map(result => ({
      ...result,
      rawData: result.rawData ?? { source: 'html-host-synthetic' }
    })),
    performanceStats: {
      totalSamples: decoderDocument.sampleCount,
      processingSpeed: decoderDocument.sampleRate
    }
  });
}

function readCaptureConfig(payload: unknown): FrontendCaptureConfig | null {
  const payloadRecord = isRecord(payload) ? payload : undefined;
  const config = isRecord(payloadRecord?.config) ? payloadRecord.config : payloadRecord;
  if (!isRecord(config)) {
    return null;
  }

  const {
    frequency,
    preTriggerSamples,
    postTriggerSamples,
    triggerChannel,
    triggerType
  } = config;
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
        case 'runDecoder':
          return runBrowserDecoder(documentData, payload) as HostCommandResult<T>;
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
