/**
 * LACEditorProvider 覆盖率补强测试
 *
 * 专注 exportData 之外的分支：命令分发、网络连接、解码器、采集、
 * webview 资源清单、消息路由、各类私有解析/规范化方法。
 *
 * Mock 策略照搬 LACEditorProvider.export.test.ts：
 * - vscode/fs/服务模块用 jest.mock(..., { virtual: true }) 在文件顶部 mock
 * - 私有方法通过 (provider as any).方法名 访问（本仓库惯例）
 */

const exportWaveformData = jest.fn();
const initialize = jest.fn();
const dispose = jest.fn();
const overwriteExportedLacFile = jest.fn();

const showSaveDialog = jest.fn();
const showInformationMessage = jest.fn();
const showErrorMessage = jest.fn();
const showWarningMessage = jest.fn();
const showInputBox = jest.fn();
const showQuickPick = jest.fn();
const executeCommand = jest.fn();
const applyEdit = jest.fn();
const onDidChangeTextDocument = jest.fn(() => ({ dispose: jest.fn() }));

const detectHardware = jest.fn();
const getCurrentDevice = jest.fn();
const getCurrentDeviceInfo = jest.fn();
const connectToDevice = jest.fn();
const disconnectCurrentDevice = jest.fn();

const networkConnect = jest.fn();
const networkDisconnect = jest.fn();
const runDiagnostics = jest.fn();

const wifiScanForDevices = jest.fn();
const wifiStopScan = jest.fn();
const wifiGetCachedDevices = jest.fn();

const getDecoder = jest.fn();
const executeDecoder = jest.fn();

const fsExistsSync = jest.fn();
const fsReadFileSync = jest.fn();

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actualFs,
    existsSync: fsExistsSync,
    readFileSync: fsReadFileSync,
    promises: {
      ...actualFs.promises,
      writeFile: overwriteExportedLacFile
    }
  };
});

jest.mock(
  'vscode',
  () => ({
    commands: { executeCommand },
    window: {
      registerCustomEditorProvider: jest.fn(),
      showInformationMessage,
      showErrorMessage,
      showWarningMessage,
      showSaveDialog,
      showInputBox,
      showQuickPick
    },
    workspace: {
      applyEdit,
      onDidChangeTextDocument,
      fs: { readFile: jest.fn(), writeFile: jest.fn() }
    },
    Uri: {
      joinPath: jest.fn((...parts: unknown[]) => ({
        fsPath: parts.map(p => (typeof p === 'object' && p !== null ? (p as any).fsPath : String(p))).join('/'),
        toString: () => parts.join('/')
      })),
      file: jest.fn((filePath: string) => ({ fsPath: filePath, toString: () => `file://${filePath}` }))
    },
    Range: jest.fn((startLine: number, startChar: number, endLine: number, endChar: number) => ({
      startLine,
      startChar,
      endLine,
      endChar
    })),
    WorkspaceEdit: jest.fn(() => ({ replace: jest.fn() }))
  }),
  { virtual: true }
);

jest.mock('../../../src/services/DataExportService', () => ({
  DataExportService: jest.fn().mockImplementation(() => ({
    initialize,
    dispose,
    exportWaveformData
  }))
}));

jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    detectHardware,
    getCurrentDevice,
    getCurrentDeviceInfo,
    connectToDevice,
    disconnectCurrentDevice
  }
}));

jest.mock('../../../src/services/NetworkStabilityService', () => ({
  NetworkStabilityService: jest.fn().mockImplementation(() => ({
    disconnect: networkDisconnect,
    connect: networkConnect,
    runDiagnostics
  }))
}));

jest.mock('../../../src/services/WiFiDeviceDiscovery', () => ({
  WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
    scanForDevices: wifiScanForDevices,
    stopScan: wifiStopScan,
    getCachedDevices: wifiGetCachedDevices
  }))
}));

jest.mock('../../../src/decoders/DecoderManager', () => ({
  DecoderManager: jest.fn().mockImplementation(() => ({
    getDecoder,
    executeDecoder
  }))
}));

import { LACEditorProvider, createConnectedDeviceInfo } from '../../../src/providers/LACEditorProvider';
import { TriggerType } from '../../../src/models/AnalyzerTypes';

const DEFAULT_SAMPLES = [
  '00000000000000000000000000000001',
  '00000000000000000000000000000002',
  '00000000000000000000000000000003',
  '00000000000000000000000000000000',
  '00000000000000000000000000000001',
  '00000000000000000000000000000002'
];

interface DocumentOverrides {
  frequency?: number;
  samples?: string[];
  channels?: Array<{ ChannelNumber: number; ChannelName?: string; Hidden?: boolean }>;
  text?: string;
}

function createDocument(overrides: DocumentOverrides = {}): any {
  if (overrides.text !== undefined) {
    return {
      getText: () => overrides.text as string,
      lineCount: 1,
      save: jest.fn().mockResolvedValue(true),
      uri: { toString: () => 'file:///tmp/capture.lac', fsPath: '/tmp/capture.lac' }
    };
  }
  const settings = {
    Frequency: overrides.frequency ?? 1000,
    PreTriggerSamples: 0,
    PostTriggerSamples: 6,
    CaptureChannels:
      overrides.channels ?? [
        { ChannelNumber: 0, ChannelName: 'D0', Hidden: false },
        { ChannelNumber: 1, ChannelName: 'D1', Hidden: false }
      ]
  };
  const samples = overrides.samples ?? DEFAULT_SAMPLES;
  return {
    getText: () => JSON.stringify({ Settings: settings, Samples: samples }),
    lineCount: 1,
    save: jest.fn().mockResolvedValue(true),
    uri: { toString: () => 'file:///tmp/capture.lac', fsPath: '/tmp/capture.lac' }
  };
}

function createProvider(): LACEditorProvider {
  return new LACEditorProvider({ extensionUri: { fsPath: '/tmp/extension' } } as any);
}

function setupManifestFiles(
  entries: Record<string, string> = { 'main-vscode.js': 'app.js' },
  options: { manifestExists?: boolean; fileExists?: boolean } = {}
): void {
  const { manifestExists = true, fileExists = true } = options;
  fsExistsSync.mockImplementation((p: string) => {
    if (typeof p === 'string' && p.endsWith('webview-manifest.json')) {
      return manifestExists;
    }
    return fileExists;
  });
  fsReadFileSync.mockImplementation((p: string) => {
    if (typeof p === 'string' && p.endsWith('webview-manifest.json')) {
      return JSON.stringify(entries);
    }
    return '';
  });
}

function createWebviewPanel(): {
  panel: any;
  fireMessage: (msg: any) => Promise<void> | undefined;
  fireDispose: () => void;
  posted: any[];
} {
  const posted: any[] = [];
  let messageHandler: ((msg: any) => Promise<void>) | undefined;
  let disposeHandler: (() => void) | undefined;
  const webview = {
    options: undefined as any,
    html: '',
    cspSource: 'vscode-resource:',
    asWebviewUri: jest.fn((uri: any) => ({ ...uri, toString: () => 'vscode-webview://fake' })),
    onDidReceiveMessage: jest.fn((cb: any) => {
      messageHandler = cb;
      return { dispose: jest.fn() };
    }),
    postMessage: jest.fn(async (data: any) => {
      posted.push(data);
      return true;
    })
  };
  const panel = {
    webview,
    onDidDispose: jest.fn((cb: any) => {
      disposeHandler = cb;
      return { dispose: jest.fn() };
    })
  };
  return {
    panel,
    fireMessage: (msg: any) => (messageHandler ? messageHandler(msg) : undefined),
    fireDispose: () => (disposeHandler ? disposeHandler() : undefined),
    posted
  };
}

function createMockDevice(overrides: Partial<any> = {}): any {
  return {
    stopCapture: jest.fn().mockResolvedValue(true),
    sendNetworkConfig: jest.fn().mockResolvedValue(true),
    getDeviceInfo: () => ({
      name: 'Mock Device',
      maxFrequency: 100000000,
      blastFrequency: 200000000,
      channels: 8,
      bufferSize: 96000,
      modeLimits: [
        {
          minPreSamples: 0,
          maxPreSamples: 1000,
          minPostSamples: 0,
          maxPostSamples: 10000,
          maxTotalSamples: 11000
        }
      ]
    }),
    minFrequency: 1000,
    isCapturing: false,
    startCapture: jest.fn().mockResolvedValue('None'),
    ...overrides
  };
}

describe('LACEditorProvider 覆盖率补强', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCurrentDevice.mockReturnValue(null);
    getCurrentDeviceInfo.mockReturnValue(null);
    detectHardware.mockResolvedValue([]);
    connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'Dev', version: '1.0' } });
    disconnectCurrentDevice.mockResolvedValue(undefined);
    networkConnect.mockResolvedValue(true);
    networkDisconnect.mockResolvedValue(undefined);
    runDiagnostics.mockResolvedValue([]);
    wifiScanForDevices.mockResolvedValue([]);
    wifiStopScan.mockReturnValue(undefined);
    wifiGetCachedDevices.mockReturnValue([]);
    getDecoder.mockReturnValue(null);
    executeDecoder.mockResolvedValue({
      decoderName: 'I2C',
      results: [],
      executionTime: 1,
      success: true
    });
    initialize.mockResolvedValue(true);
    dispose.mockResolvedValue(true);
    exportWaveformData.mockResolvedValue({ success: true, filename: '/tmp/x.csv', mimeType: 'text/csv', size: 1 });
    overwriteExportedLacFile.mockResolvedValue(undefined);
    showSaveDialog.mockResolvedValue(undefined);
    setupManifestFiles();
  });

  describe('createConnectedDeviceInfo 导出函数', () => {
    it('应填充默认 deviceName、responseTime 与 deviceType', () => {
      const info = createConnectedDeviceInfo({ host: '10.0.0.1', port: 1234 });
      expect(info.ipAddress).toBe('10.0.0.1');
      expect(info.port).toBe(1234);
      expect(info.deviceName).toBe('Network Device');
      expect(info.responseTime).toBe(0);
      expect(info.deviceType).toBe('network');
      expect(info.isOnline).toBe(true);
      expect(info.lastSeen).toBeInstanceOf(Date);
    });

    it('应接受自定义 deviceName、version 与 deviceType', () => {
      const info = createConnectedDeviceInfo({
        host: '10.0.0.2',
        port: 8080,
        deviceName: 'Pico',
        version: 'v2',
        responseTime: 12,
        deviceType: 'wifi'
      });
      expect(info.deviceName).toBe('Pico');
      expect(info.version).toBe('v2');
      expect(info.responseTime).toBe(12);
      expect(info.deviceType).toBe('wifi');
    });
  });

  describe('executeHostCommand 命令分发', () => {
    it('scanForDevices 应委托给 wifiDiscovery.scanForDevices 并透传 record payload', async () => {
      wifiScanForDevices.mockResolvedValue([{ ipAddress: '1.1.1.1' }]);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'scanForDevices', { timeout: 5 });
      expect(wifiScanForDevices).toHaveBeenCalledWith({ timeout: 5 });
      expect(result).toEqual({ success: true, data: [{ ipAddress: '1.1.1.1' }] });
    });

    it('scanNetworkDevices 应与非 record payload 一样调用 scanForDevices(undefined)', async () => {
      const provider = createProvider();
      await (provider as any).executeHostCommand(createDocument(), 'scanNetworkDevices', 'nope');
      expect(wifiScanForDevices).toHaveBeenCalledWith(undefined);
    });

    it('detectDevices 应调用 hardwareDriverManager.detectHardware(false)', async () => {
      detectHardware.mockResolvedValue([{ id: 'usb1' }]);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'detectDevices', undefined);
      expect(detectHardware).toHaveBeenCalledWith(false);
      expect(result).toEqual({ success: true, data: [{ id: 'usb1' }] });
    });

    it('stopScan 应调用 wifiDiscovery.stopScan', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'stopScan', undefined);
      expect(wifiStopScan).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('getCachedDevices 应返回 wifiDiscovery 缓存设备', async () => {
      wifiGetCachedDevices.mockReturnValue([{ ipAddress: '2.2.2.2' }]);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'getCachedDevices', undefined);
      expect(result).toEqual({ success: true, data: [{ ipAddress: '2.2.2.2' }] });
    });

    it('connectToDevice 应委托给 connectToNetworkDevice', async () => {
      networkConnect.mockResolvedValue(true);
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'N', version: '1' } });
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(
        createDocument(),
        'connectToDevice',
        { host: '1.2.3.4', port: 1234 }
      );
      expect(result.success).toBe(true);
      expect(result.data.deviceInfo.ipAddress).toBe('1.2.3.4');
    });

    it('disconnectDevice 应委托给 disconnectCurrentDevice', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'disconnectDevice', undefined);
      expect(disconnectCurrentDevice).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('sendNetworkConfig 应委托给 sendNetworkConfig', async () => {
      getCurrentDevice.mockReturnValue(createMockDevice());
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(
        createDocument(),
        'sendNetworkConfig',
        { config: { ssid: 'net', port: 1234 } }
      );
      expect(result).toEqual({ success: true, data: true });
    });

    it('runNetworkDiagnostics 应委托给 runNetworkDiagnostics', async () => {
      runDiagnostics.mockResolvedValue([{ name: 'ping', success: true }]);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(
        createDocument(),
        'runNetworkDiagnostics',
        { host: '1.2.3.4', port: 1234 }
      );
      expect(result).toEqual({ success: true, data: [{ name: 'ping', success: true }] });
    });

    it('runDecoder 应委托给 runDecoderForDocument', async () => {
      getDecoder.mockReturnValue({ id: 'i2c' });
      executeDecoder.mockResolvedValue({
        decoderName: 'I2C',
        results: [],
        executionTime: 5,
        success: true
      });
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(
        createDocument(),
        'runDecoder',
        { decoderId: 'i2c', channelMapping: [
          { captureIndex: 0, decoderIndex: 0 },
          { captureIndex: 1, decoderIndex: 1 }
        ] }
      );
      expect(result.success).toBe(true);
      expect(result.data.decoderId).toBe('i2c');
    });

    it('connectDevice 应委托给 connectDeviceFromPayload', async () => {
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: undefined });
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(
        createDocument(),
        'connectDevice',
        { type: 'serial', address: 'COM3' }
      );
      expect(connectToDevice).toHaveBeenCalledWith('COM3');
      expect(result.success).toBe(true);
    });

    it('startCapture 无设备时应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(
        createDocument(),
        'startCapture',
        { config: { frequency: 1000, preTriggerSamples: 0, postTriggerSamples: 10, triggerChannel: 0 } }
      );
      expect(result).toEqual({ success: false, error: '请先连接逻辑分析器设备' });
    });

    it('repeatCapture 无上次配置时应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'repeatCapture', undefined);
      expect(result).toEqual({ success: false, error: '没有可重复执行的采集配置' });
    });

    it('getStatus 应返回设备状态', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'getStatus', undefined);
      expect(result.success).toBe(true);
      expect(result.data.isConnected).toBe(false);
      expect(result.data.limits).toBeNull();
    });

    it('exportData 分支应触发导出（取消保存对话框）', async () => {
      showSaveDialog.mockResolvedValue(undefined);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'exportData', { format: 'csv' });
      expect(result).toEqual({ success: true });
      expect(showSaveDialog).toHaveBeenCalled();
    });

    it('saveFile 应返回 document.save() 结果', async () => {
      const doc = createDocument();
      (doc.save as jest.Mock).mockResolvedValue(true);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(doc, 'saveFile', undefined);
      expect(result).toEqual({ success: true });
    });

    it('stopCapture 无设备时应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'stopCapture', undefined);
      expect(result).toEqual({ success: false, error: '当前没有已连接设备' });
    });

    it('stopCapture 有设备成功时应返回状态', async () => {
      const device = createMockDevice({ stopCapture: jest.fn().mockResolvedValue(true) });
      getCurrentDevice.mockReturnValue(device);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'stopCapture', undefined);
      expect(device.stopCapture).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.isConnected).toBe(true);
    });

    it('stopCapture 设备返回失败时应返回错误', async () => {
      const device = createMockDevice({ stopCapture: jest.fn().mockResolvedValue(false) });
      getCurrentDevice.mockReturnValue(device);
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'stopCapture', undefined);
      expect(result.success).toBe(false);
      expect(result.error).toBe('停止采集失败');
    });

    it('未知命令应返回 Unsupported command', async () => {
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'doMagic', undefined);
      expect(result).toEqual({ success: false, error: 'Unsupported command' });
    });

    it('命令抛异常时应捕获并返回 success:false', async () => {
      detectHardware.mockRejectedValue(new Error('boom'));
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'detectDevices', undefined);
      expect(result).toEqual({ success: false, error: 'boom' });
    });

    it('命令抛非 Error 异常时应 String 化', async () => {
      detectHardware.mockRejectedValue('string error');
      const provider = createProvider();
      const result = await (provider as any).executeHostCommand(createDocument(), 'detectDevices', undefined);
      expect(result).toEqual({ success: false, error: 'string error' });
    });
  });

  describe('connectToNetworkDevice', () => {
    it('缺少 host 与 port 应返回缺少网络连接参数', async () => {
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice({});
      expect(result).toEqual({ success: false, error: '缺少网络连接参数' });
    });

    it('networkService.connect 失败应返回无法连接', async () => {
      networkConnect.mockResolvedValue(false);
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice({ host: 'h', port: 1234 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('无法连接到网络设备');
    });

    it('hardwareDriverManager.connectToDevice 失败应断开网络服务并返回错误', async () => {
      networkConnect.mockResolvedValue(true);
      connectToDevice.mockResolvedValue({ success: false, error: 'refused', deviceInfo: undefined });
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice({ host: 'h', port: 1234 });
      expect(networkDisconnect).toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'refused' });
    });

    it('connectToDevice 失败无 error 字段时应使用默认错误', async () => {
      networkConnect.mockResolvedValue(true);
      connectToDevice.mockResolvedValue({ success: false });
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice({ host: 'h', port: 1234 });
      expect(result.error).toBe('网络设备连接失败');
    });

    it('成功时应返回设备状态与连接信息', async () => {
      networkConnect.mockResolvedValue(true);
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'Pico', version: 'v1' } });
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice({ host: 'h', port: 1234 });
      expect(result.success).toBe(true);
      expect(result.data.deviceInfo.ipAddress).toBe('h');
      expect(result.data.deviceInfo.deviceName).toBe('Pico');
    });

    it('应支持从 device 子对象读取 host/port', async () => {
      networkConnect.mockResolvedValue(true);
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'X', version: '1' } });
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice({
        device: { ipAddress: '9.9.9.9', port: 9999 }
      });
      expect(networkConnect).toHaveBeenCalledWith('9.9.9.9', 9999);
      expect(result.success).toBe(true);
    });

    it('payload 非 record 时应安全处理', async () => {
      const provider = createProvider();
      const result = await (provider as any).connectToNetworkDevice(null);
      expect(result).toEqual({ success: false, error: '缺少网络连接参数' });
    });
  });

  describe('connectDeviceFromPayload', () => {
    it('type=network 且地址非法应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({ type: 'network', address: 'bad' });
      expect(result).toEqual({ success: false, error: '网络地址格式无效，应为 host:port' });
    });

    it('type=network 且地址合法应委托 connectToNetworkDevice', async () => {
      networkConnect.mockResolvedValue(true);
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'N', version: '1' } });
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({
        type: 'network',
        address: '1.2.3.4:1234'
      });
      expect(networkConnect).toHaveBeenCalledWith('1.2.3.4', 1234);
      expect(result.success).toBe(true);
    });

    it('type=serial 且 address 成功应返回设备状态', async () => {
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: undefined });
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({ type: 'serial', address: 'COM5' });
      expect(connectToDevice).toHaveBeenCalledWith('COM5');
      expect(result.success).toBe(true);
    });

    it('type=serial 连接失败应返回错误', async () => {
      connectToDevice.mockResolvedValue({ success: false, error: 'busy' });
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({ type: 'serial', address: 'COM5' });
      expect(result).toEqual({ success: false, error: 'busy' });
    });

    it('type=serial 连接失败无 error 应使用默认', async () => {
      connectToDevice.mockResolvedValue({ success: false });
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({ type: 'serial', address: 'COM5' });
      expect(result.error).toBe('串口设备连接失败');
    });

    it('提供 deviceId 成功应返回设备状态', async () => {
      connectToDevice.mockResolvedValue({ success: true, deviceInfo: undefined });
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({ deviceId: 'dev-1' });
      expect(connectToDevice).toHaveBeenCalledWith('dev-1');
      expect(result.success).toBe(true);
    });

    it('提供 deviceId 连接失败应返回错误', async () => {
      connectToDevice.mockResolvedValue({ success: false, error: 'timeout' });
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({ deviceId: 'dev-1' });
      expect(result).toEqual({ success: false, error: 'timeout' });
    });

    it('无 type/deviceId 应触发 logicAnalyzer.connectDevice 命令', async () => {
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload({});
      expect(executeCommand).toHaveBeenCalledWith('logicAnalyzer.connectDevice');
      expect(result.success).toBe(true);
    });

    it('payload 非 record 应触发 logicAnalyzer.connectDevice', async () => {
      const provider = createProvider();
      const result = await (provider as any).connectDeviceFromPayload(undefined);
      expect(executeCommand).toHaveBeenCalledWith('logicAnalyzer.connectDevice');
      expect(result.success).toBe(true);
    });
  });

  describe('sendNetworkConfig', () => {
    it('缺少 ssid 或 port 应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).sendNetworkConfig({ config: { ssid: 'x' } });
      expect(result).toEqual({ success: false, error: '缺少 WiFi 配置参数' });
    });

    it('无设备时应返回错误', async () => {
      getCurrentDevice.mockReturnValue(null);
      const provider = createProvider();
      const result = await (provider as any).sendNetworkConfig({ config: { ssid: 'x', port: 1 } });
      expect(result).toEqual({ success: false, error: '请先连接到设备' });
    });

    it('设备返回成功应返回 data:true', async () => {
      const device = createMockDevice({ sendNetworkConfig: jest.fn().mockResolvedValue(true) });
      getCurrentDevice.mockReturnValue(device);
      const provider = createProvider();
      const result = await (provider as any).sendNetworkConfig({
        config: { ssid: 'net', password: 'pw', staticIp: '10.0.0.5', port: 5000 }
      });
      expect(device.sendNetworkConfig).toHaveBeenCalledWith('net', 'pw', '10.0.0.5', 5000);
      expect(result).toEqual({ success: true, data: true });
    });

    it('设备返回失败应返回错误', async () => {
      const device = createMockDevice({ sendNetworkConfig: jest.fn().mockResolvedValue(false) });
      getCurrentDevice.mockReturnValue(device);
      const provider = createProvider();
      const result = await (provider as any).sendNetworkConfig({ config: { ssid: 'net', port: 1 } });
      expect(result).toEqual({ success: false, error: 'WiFi 配置发送失败' });
    });

    it('config 缺失 staticIp 时应回退到 ipAddress 再到 0.0.0.0', async () => {
      const device = createMockDevice({ sendNetworkConfig: jest.fn().mockResolvedValue(true) });
      getCurrentDevice.mockReturnValue(device);
      const provider = createProvider();
      await (provider as any).sendNetworkConfig({ config: { ssid: 'net', ipAddress: '10.0.0.9', port: 1 } });
      expect(device.sendNetworkConfig).toHaveBeenCalledWith('net', '', '10.0.0.9', 1);
    });

    it('payload 非 record 应安全处理', async () => {
      const provider = createProvider();
      const result = await (provider as any).sendNetworkConfig(null);
      expect(result).toEqual({ success: false, error: '缺少 WiFi 配置参数' });
    });
  });

  describe('runNetworkDiagnostics', () => {
    it('缺少 host 或 port 应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).runNetworkDiagnostics({ host: 'h' });
      expect(result).toEqual({ success: false, error: '缺少网络诊断参数' });
    });

    it('成功应返回诊断结果', async () => {
      runDiagnostics.mockResolvedValue([{ name: 'ping', success: true }]);
      const provider = createProvider();
      const result = await (provider as any).runNetworkDiagnostics({ host: 'h', port: 1234 });
      expect(runDiagnostics).toHaveBeenCalledWith('h', 1234);
      expect(result).toEqual({ success: true, data: [{ name: 'ping', success: true }] });
    });

    it('应支持 ipAddress 别名与 device 子对象', async () => {
      runDiagnostics.mockResolvedValue([]);
      const provider = createProvider();
      await (provider as any).runNetworkDiagnostics({ device: { ipAddress: '8.8.8.8', port: 53 } });
      expect(runDiagnostics).toHaveBeenCalledWith('8.8.8.8', 53);
    });
  });

  describe('runDecoderForDocument', () => {
    it('decoderId 不存在应返回 success:true 但 data.success:false', async () => {
      getDecoder.mockReturnValue(null);
      const provider = createProvider();
      const result = await (provider as any).runDecoderForDocument(createDocument(), { decoderId: 'nope' });
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain('Decoder not found: nope');
    });

    it('采样率 <=0 应抛错（由 executeHostCommand 的 try/catch 捕获）', async () => {
      getDecoder.mockReturnValue({ id: 'i2c' });
      const provider = createProvider();
      await expect(
        (provider as any).runDecoderForDocument(createDocument({ frequency: 0 }), { decoderId: 'i2c' })
      ).rejects.toThrow('采样率无效，无法执行协议解码');
    });

    it('可解码通道为空应抛错', async () => {
      getDecoder.mockReturnValue({ id: 'i2c' });
      const provider = createProvider();
      await expect(
        (provider as any).runDecoderForDocument(createDocument({ channels: [] }), { decoderId: 'i2c' })
      ).rejects.toThrow('当前文件没有可解码样本');
    });

    it('i2c 缺少 SCL/SDA 映射应抛错', async () => {
      getDecoder.mockReturnValue({ id: 'i2c' });
      const provider = createProvider();
      await expect(
        (provider as any).runDecoderForDocument(createDocument(), {
          decoderId: 'i2c',
          channelMapping: [{ captureIndex: 0, decoderIndex: 0 }]
        })
      ).rejects.toThrow('I2C 解码需要 SCL 和 SDA 两个通道');
    });

    it('i2c SCL 与 SDA 同通道应抛错', async () => {
      getDecoder.mockReturnValue({ id: 'i2c' });
      const provider = createProvider();
      await expect(
        (provider as any).runDecoderForDocument(createDocument(), {
          decoderId: 'i2c',
          channelMapping: [
            { captureIndex: 0, decoderIndex: 0 },
            { captureIndex: 0, decoderIndex: 1 }
          ]
        })
      ).rejects.toThrow('SCL 和 SDA 不能映射到同一采集通道');
    });

    it('正常执行应返回解码响应', async () => {
      getDecoder.mockReturnValue({ id: 'i2c' });
      executeDecoder.mockResolvedValue({
        decoderName: 'I2C Decoder',
        results: [
          {
            startSample: 0,
            endSample: 4,
            annotationType: 1,
            values: ['START'],
            rawData: { hex: 'ff' },
            shape: 'rectangle'
          }
        ],
        executionTime: 7,
        success: true,
        performanceStats: { totalSamples: 6, processingSpeed: 1000 }
      });
      const provider = createProvider();
      const result = await (provider as any).runDecoderForDocument(createDocument(), {
        decoderId: 'i2c',
        channelMapping: [
          { captureIndex: 0, decoderIndex: 0 },
          { captureIndex: 1, decoderIndex: 1 }
        ]
      });
      expect(result.success).toBe(true);
      expect(result.data.decoderName).toBe('I2C Decoder');
      expect(result.data.results[0].values).toEqual(['START']);
      expect(result.data.results[0].rawData).toEqual({ hex: 'ff' });
      expect(result.data.performanceStats.totalSamples).toBe(6);
    });

    it('payload 非 record 时应使用默认 decoderId', async () => {
      getDecoder.mockReturnValue(null);
      const provider = createProvider();
      const result = await (provider as any).runDecoderForDocument(createDocument(), null);
      expect(result.data.decoderId).toBe('i2c');
    });
  });

  describe('validateI2CDecoderInput', () => {
    it('缺少 SDA 映射应抛错', () => {
      const provider = createProvider();
      expect(() =>
        (provider as any).validateI2CDecoderInput(
          [{ channelNumber: 0 }, { channelNumber: 1 }],
          [{ captureIndex: 0, decoderIndex: 0 }]
        )
      ).toThrow('I2C 解码需要 SCL 和 SDA 两个通道');
    });

    it('captureIndex 越界导致通道缺失应抛错', () => {
      const provider = createProvider();
      expect(() =>
        (provider as any).validateI2CDecoderInput(
          [{ channelNumber: 0 }],
          [
            { captureIndex: 5, decoderIndex: 0 },
            { captureIndex: 1, decoderIndex: 1 }
          ]
        )
      ).toThrow('I2C 解码需要 SCL 和 SDA 两个通道');
    });

    it('SCL/SDA 映射到同一通道应抛错', () => {
      const provider = createProvider();
      expect(() =>
        (provider as any).validateI2CDecoderInput(
          [{ channelNumber: 0 }, { channelNumber: 1 }],
          [
            { captureIndex: 0, decoderIndex: 0 },
            { captureIndex: 0, decoderIndex: 1 }
          ]
        )
      ).toThrow('SCL 和 SDA 不能映射到同一采集通道');
    });

    it('合法映射不应抛错', () => {
      const provider = createProvider();
      expect(() =>
        (provider as any).validateI2CDecoderInput(
          [{ channelNumber: 0 }, { channelNumber: 1 }],
          [
            { captureIndex: 0, decoderIndex: 0 },
            { captureIndex: 1, decoderIndex: 1 }
          ]
        )
      ).not.toThrow();
    });
  });

  describe('readRunDecoderRequest / normalizeDecoderChannelMapping / normalizeDecoderOptions', () => {
    it('readRunDecoderRequest 非 record 应返回空对象', () => {
      const provider = createProvider();
      expect((provider as any).readRunDecoderRequest('x')).toEqual({});
    });

    it('readRunDecoderRequest 应提取 decoderId/channelMapping/options', () => {
      const provider = createProvider();
      const req = (provider as any).readRunDecoderRequest({
        decoderId: 'spi',
        channelMapping: [{ captureIndex: 0, decoderIndex: 0 }],
        options: [{ optionIndex: 0, value: 1 }]
      });
      expect(req).toEqual({
        decoderId: 'spi',
        channelMapping: [{ captureIndex: 0, decoderIndex: 0 }],
        options: [{ optionIndex: 0, value: 1 }]
      });
    });

    it('normalizeDecoderChannelMapping 非数组应返回空', () => {
      const provider = createProvider();
      expect((provider as any).normalizeDecoderChannelMapping('x')).toEqual([]);
    });

    it('normalizeDecoderChannelMapping 应过滤非法项与负索引', () => {
      const provider = createProvider();
      const result = (provider as any).normalizeDecoderChannelMapping([
        { captureIndex: 0, decoderIndex: 0, name: 'scl' },
        'bad',
        { captureIndex: -1, decoderIndex: 0 },
        { captureIndex: 1, decoderIndex: -1 },
        { captureIndex: 2, decoderIndex: 1 }
      ]);
      expect(result).toEqual([
        { captureIndex: 0, decoderIndex: 0, name: 'scl' },
        { captureIndex: 2, decoderIndex: 1, name: undefined }
      ]);
    });

    it('normalizeDecoderOptions 非数组应返回空', () => {
      const provider = createProvider();
      expect((provider as any).normalizeDecoderOptions({})).toEqual([]);
    });

    it('normalizeDecoderOptions 应过滤非法项与负索引', () => {
      const provider = createProvider();
      const result = (provider as any).normalizeDecoderOptions([
        { optionIndex: 0, value: 'a' },
        'bad',
        { optionIndex: -1, value: 'b' },
        { optionIndex: 2, value: 'c' }
      ]);
      expect(result).toEqual([
        { optionIndex: 0, value: 'a' },
        { optionIndex: 2, value: 'c' }
      ]);
    });
  });

  describe('resolveSessionSampleRate / toDecoderChannels', () => {
    it('resolveSessionSampleRate 应优先使用 frequency', () => {
      const provider = createProvider();
      expect((provider as any).resolveSessionSampleRate({ frequency: 5000 })).toBe(5000);
    });

    it('resolveSessionSampleRate 无 frequency 时应回退 sampleRate', () => {
      const provider = createProvider();
      expect((provider as any).resolveSessionSampleRate({ sampleRate: 3000 })).toBe(3000);
    });

    it('resolveSessionSampleRate 全缺失时应返回 0', () => {
      const provider = createProvider();
      expect((provider as any).resolveSessionSampleRate({})).toBe(0);
    });

    it('resolveSessionSampleRate 非有限值应返回 0', () => {
      const provider = createProvider();
      expect((provider as any).resolveSessionSampleRate({ frequency: Infinity })).toBe(0);
    });

    it('toDecoderChannels 应过滤非 Uint8Array 与空样本', () => {
      const provider = createProvider();
      const result = (provider as any).toDecoderChannels([
        { channelNumber: 0, channelName: 'A', samples: new Uint8Array([1, 2]), hidden: false },
        { channelNumber: 1, channelName: 'B', samples: [1, 2] },
        { channelNumber: 2, textualChannelNumber: 'T2', samples: new Uint8Array([]) },
        { channelNumber: 3, textualChannelNumber: 'T3', samples: new Uint8Array([3]) }
      ]);
      expect(result.length).toBe(2);
      expect(result[0].channelName).toBe('A');
      expect(result[1].channelName).toBe('T3');
      expect(result[1].samples).toBeInstanceOf(Uint8Array);
    });
  });

  describe('toHostRunDecoderResponse / toJsonSafeValue', () => {
    it('应映射 results 与 performanceStats', () => {
      const provider = createProvider();
      const resp = (provider as any).toHostRunDecoderResponse('spi', {
        decoderName: 'SPI',
        results: [
          {
            startSample: 1,
            endSample: 2,
            annotationType: 0,
            values: ['x', 'y'],
            rawData: null,
            shape: 'hexagon'
          }
        ],
        executionTime: 3,
        success: true,
        isStreaming: false,
        performanceStats: {
          totalSamples: 10,
          processingSpeed: 5,
          memoryUsage: 2048,
          chunksProcessed: 4
        }
      });
      expect(resp.decoderId).toBe('spi');
      expect(resp.results[0]).toEqual({
        startSample: 1,
        endSample: 2,
        annotationType: 0,
        values: ['x', 'y'],
        rawData: null,
        shape: 'hexagon'
      });
      expect(resp.performanceStats).toEqual({
        totalSamples: 10,
        processingSpeed: 5,
        memoryUsage: 2048,
        chunksProcessed: 4
      });
    });

    it('无 performanceStats 时应省略', () => {
      const provider = createProvider();
      const resp = (provider as any).toHostRunDecoderResponse('spi', {
        decoderName: 'SPI',
        results: [{ startSample: 0, endSample: 1, values: 'nope' }],
        executionTime: 0,
        success: true
      });
      expect(resp.performanceStats).toBeUndefined();
      // values 非 Array 时应转为空数组
      expect(resp.results[0].values).toEqual([]);
    });

    it('toJsonSafeValue 应处理基本类型与 undefined', () => {
      const provider = createProvider();
      expect((provider as any).toJsonSafeValue(null)).toBeNull();
      expect((provider as any).toJsonSafeValue('s')).toBe('s');
      expect((provider as any).toJsonSafeValue(42)).toBe(42);
      expect((provider as any).toJsonSafeValue(true)).toBe(true);
      expect((provider as any).toJsonSafeValue(undefined)).toBeUndefined();
    });

    it('toJsonSafeValue 应把 bigint 转 string', () => {
      const provider = createProvider();
      expect((provider as any).toJsonSafeValue(BigInt(123))).toBe('123');
    });

    it('toJsonSafeValue 应把 Uint8Array 转数组', () => {
      const provider = createProvider();
      expect((provider as any).toJsonSafeValue(new Uint8Array([1, 2, 3]))).toEqual([1, 2, 3]);
    });

    it('toJsonSafeValue 应递归处理数组', () => {
      const provider = createProvider();
      expect((provider as any).toJsonSafeValue([1, 'a', { k: 2 }])).toEqual([1, 'a', { k: 2 }]);
    });

    it('toJsonSafeValue 应把 Date 转 ISO 字符串', () => {
      const provider = createProvider();
      const d = new Date('2024-01-01T00:00:00Z');
      expect((provider as any).toJsonSafeValue(d)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('toJsonSafeValue 对象循环引用应返回 null', () => {
      const provider = createProvider();
      const obj: any = { a: 1 };
      obj.self = obj;
      const safe = (provider as any).toJsonSafeValue(obj);
      expect(safe.self).toBeNull();
      expect(safe.a).toBe(1);
    });

    it('toJsonSafeValue 对象中 undefined 字段应被跳过', () => {
      const provider = createProvider();
      expect((provider as any).toJsonSafeValue({ a: 1, b: undefined })).toEqual({ a: 1 });
    });

    it('toJsonSafeValue 未知类型应 String 化', () => {
      const provider = createProvider();
      const sym = Symbol('hi');
      expect((provider as any).toJsonSafeValue(sym)).toBe('Symbol(hi)');
    });
  });

  describe('readCaptureConfig', () => {
    it('payload 非 record 应返回 null', () => {
      const provider = createProvider();
      expect((provider as any).readCaptureConfig('x')).toBeNull();
    });

    it('无 config 子对象时直接用 payload', () => {
      const provider = createProvider();
      const cfg = (provider as any).readCaptureConfig({
        frequency: 1000,
        preTriggerSamples: 0,
        postTriggerSamples: 10,
        triggerChannel: 0,
        channels: [{ number: 0 }]
      });
      expect(cfg.frequency).toBe(1000);
    });

    it('嵌套 config 子对象应优先读取', () => {
      const provider = createProvider();
      const cfg = (provider as any).readCaptureConfig({
        config: {
          frequency: 2000,
          preTriggerSamples: 1,
          postTriggerSamples: 20,
          triggerChannel: 1,
          channels: [{ number: 0 }]
        }
      });
      expect(cfg.frequency).toBe(2000);
      expect(cfg.triggerChannel).toBe(1);
    });

    it('frequency 缺失应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('frequency <=0 应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 0,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('preTriggerSamples 非有限值应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: Infinity,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('preTriggerSamples 负值应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: -1,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('postTriggerSamples <=0 应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: 0,
          postTriggerSamples: 0,
          triggerChannel: 0,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('triggerChannel 非整数应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerChannel: 1.5,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('triggerChannel 缺失应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          channels: [{ number: 0 }]
        })
      ).toBeNull();
    });

    it('channels 全为非法项应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: [{ name: 'no-number' }, 'bad']
        })
      ).toBeNull();
    });

    it('channels 全 disabled 应返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: [{ number: 0, enabled: false }]
        })
      ).toBeNull();
    });

    it('应填充默认 triggerType 与各项默认值', () => {
      const provider = createProvider();
      const cfg = (provider as any).readCaptureConfig({
        frequency: 1000,
        preTriggerSamples: 0,
        postTriggerSamples: 10,
        triggerChannel: 0,
        channels: [{ number: 0 }, { number: 1, name: 'D1', enabled: false }]
      });
      expect(cfg.triggerType).toBe('Edge');
      expect(cfg.triggerInverted).toBe(false);
      expect(cfg.triggerPattern).toBe(0);
      expect(cfg.triggerBitCount).toBe(1);
      expect(cfg.loopCount).toBe(0);
      expect(cfg.measureBursts).toBe(false);
      expect(cfg.channels[0].enabled).toBe(true);
      expect(cfg.channels[1].name).toBe('D1');
    });

    it('channels 非数组时应被视为空并返回 null', () => {
      const provider = createProvider();
      expect(
        (provider as any).readCaptureConfig({
          frequency: 1,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerChannel: 0,
          channels: 'nope'
        })
      ).toBeNull();
    });
  });

  describe('createCaptureSession / parseTriggerType', () => {
    it('字符串 triggerType 应正确映射', () => {
      const provider = createProvider();
      const cases: Array<[string, number]> = [
        ['Edge', TriggerType.Edge],
        ['Fast', TriggerType.Fast],
        ['Complex', TriggerType.Complex],
        ['Blast', TriggerType.Blast]
      ];
      for (const [text, expected] of cases) {
        const session = (provider as any).createCaptureSession({
          frequency: 1000,
          preTriggerSamples: 0,
          postTriggerSamples: 10,
          triggerType: text,
          triggerChannel: 0,
          channels: [{ number: 0 }]
        });
        expect(session.triggerType).toBe(expected);
      }
    });

    it('未知字符串 triggerType 应回退 Edge', () => {
      const provider = createProvider();
      const session = (provider as any).createCaptureSession({
        frequency: 1000,
        preTriggerSamples: 0,
        postTriggerSamples: 10,
        triggerType: 'Unknown',
        triggerChannel: 0,
        channels: [{ number: 0 }]
      });
      expect(session.triggerType).toBe(TriggerType.Edge);
    });

    it('数字 triggerType 应直传', () => {
      const provider = createProvider();
      const session = (provider as any).createCaptureSession({
        frequency: 1000,
        preTriggerSamples: 0,
        postTriggerSamples: 10,
        triggerType: 3,
        triggerChannel: 0,
        channels: [{ number: 0 }]
      });
      expect(session.triggerType).toBe(3);
    });

    it('应过滤 enabled=false 的通道并填充默认 channelName', () => {
      const provider = createProvider();
      const session = (provider as any).createCaptureSession({
        frequency: 1000,
        preTriggerSamples: 0,
        postTriggerSamples: 10,
        triggerChannel: 0,
        channels: [
          { number: 0, name: 'D0' },
          { number: 1, enabled: false },
          { number: 2 }
        ]
      });
      expect(session.captureChannels.length).toBe(2);
      expect(session.captureChannels[0].channelName).toBe('D0');
      expect(session.captureChannels[1].channelName).toBe('Channel 3');
      expect(session.captureChannels[0].hidden).toBe(false);
    });

    it('应填充各项默认值', () => {
      const provider = createProvider();
      const session = (provider as any).createCaptureSession({
        frequency: 1000,
        preTriggerSamples: 5,
        postTriggerSamples: 15,
        triggerType: 'Fast',
        triggerChannel: 2,
        channels: [{ number: 0 }]
      });
      expect(session.frequency).toBe(1000);
      expect(session.preTriggerSamples).toBe(5);
      expect(session.postTriggerSamples).toBe(15);
      expect(session.triggerInverted).toBe(false);
      expect(session.triggerPattern).toBe(0);
      expect(session.triggerBitCount).toBe(1);
      expect(session.loopCount).toBe(0);
      expect(session.measureBursts).toBe(false);
    });

    it('parseTriggerType 直接测试 default 分支', () => {
      const provider = createProvider();
      expect((provider as any).parseTriggerType('default')).toBe(TriggerType.Edge);
    });
  });

  describe('parseNetworkAddress', () => {
    it('合法 host:port 应解析成功', () => {
      const provider = createProvider();
      expect((provider as any).parseNetworkAddress('1.2.3.4:8080')).toEqual({ host: '1.2.3.4', port: 8080 });
    });

    it('缺 host 应返回 null', () => {
      const provider = createProvider();
      expect((provider as any).parseNetworkAddress(':8080')).toBeNull();
    });

    it('端口非整数应返回 null', () => {
      const provider = createProvider();
      expect((provider as any).parseNetworkAddress('host:abc')).toBeNull();
    });

    it('端口超出范围应返回 null', () => {
      const provider = createProvider();
      expect((provider as any).parseNetworkAddress('host:99999')).toBeNull();
      expect((provider as any).parseNetworkAddress('host:0')).toBeNull();
    });
  });

  describe('createDeviceStatus', () => {
    it('无设备时 limits 应为 null', async () => {
      const provider = createProvider();
      const status = await (provider as any).createDeviceStatus();
      expect(status.isConnected).toBe(false);
      expect(status.isCapturing).toBe(false);
      expect(status.limits).toBeNull();
      expect(status.lastCaptureConfig).toBeNull();
    });

    it('有设备时应映射 limits.modeLimits', async () => {
      const device = createMockDevice({ minFrequency: 500, isCapturing: true });
      getCurrentDevice.mockReturnValue(device);
      getCurrentDeviceInfo.mockReturnValue({ name: 'Dev' });
      const provider = createProvider();
      const status = await (provider as any).createDeviceStatus();
      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(true);
      expect(status.limits.minFrequency).toBe(500);
      expect(status.limits.maxFrequency).toBe(100000000);
      expect(status.limits.channelCount).toBe(8);
      expect(status.limits.modeLimits[0]).toEqual({
        minPreSamples: 0,
        maxPreSamples: 1000,
        minPostSamples: 0,
        maxPostSamples: 10000,
        maxTotalSamples: 11000
      });
    });
  });

  describe('clampColorChannel / parseSelectedRegionColor', () => {
    it('clampColorChannel NaN/Infinity 应返回 0', () => {
      const provider = createProvider();
      expect((provider as any).clampColorChannel(NaN)).toBe(0);
      expect((provider as any).clampColorChannel(Infinity)).toBe(0);
      expect((provider as any).clampColorChannel(-Infinity)).toBe(0);
    });

    it('clampColorChannel 超范围应截断到 0-255 并取整', () => {
      const provider = createProvider();
      expect((provider as any).clampColorChannel(-10)).toBe(0);
      expect((provider as any).clampColorChannel(300)).toBe(255);
      expect((provider as any).clampColorChannel(12.7)).toBe(13);
    });

    it('parseSelectedRegionColor 无颜色应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).parseSelectedRegionColor(undefined)).toBeUndefined();
      expect((provider as any).parseSelectedRegionColor('')).toBeUndefined();
    });

    it('parseSelectedRegionColor 非法格式应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).parseSelectedRegionColor('red')).toBeUndefined();
      expect((provider as any).parseSelectedRegionColor('#ff0000')).toBeUndefined();
    });

    it('parseSelectedRegionColor rgb 无 alpha 应默认 alpha=255', () => {
      const provider = createProvider();
      expect((provider as any).parseSelectedRegionColor('rgb(10, 20, 30)')).toEqual({
        r: 10,
        g: 20,
        b: 30,
        a: 255
      });
    });

    it('parseSelectedRegionColor rgba 含 alpha 应乘 255 并取整', () => {
      const provider = createProvider();
      expect((provider as any).parseSelectedRegionColor('rgba(255, 0, 0, 0.5)')).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 128
      });
    });
  });

  describe('resolveSelectedRegionSampleRange / normalizeSelectedRegion / readSelectedRegions', () => {
    it('非 custom timeRange 应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).resolveSelectedRegionSampleRange({ timeRange: 'all' })
      ).toBeUndefined();
    });

    it('custom 但 customStart/customEnd 缺失应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).resolveSelectedRegionSampleRange({ timeRange: 'custom' })
      ).toBeUndefined();
    });

    it('custom 且 customEnd<=customStart 应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).resolveSelectedRegionSampleRange({
          timeRange: 'custom',
          customStart: 5,
          customEnd: 5
        })
      ).toBeUndefined();
    });

    it('合法 custom 范围应返回区间', () => {
      const provider = createProvider();
      expect(
        (provider as any).resolveSelectedRegionSampleRange({
          timeRange: 'custom',
          customStart: 2,
          customEnd: 8
        })
      ).toEqual({ startSample: 2, endSample: 8 });
    });

    it('normalizeSelectedRegion 非 record 应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).normalizeSelectedRegion('x')).toBeUndefined();
    });

    it('normalizeSelectedRegion 缺字段应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).normalizeSelectedRegion({ firstSample: 1 })).toBeUndefined();
    });

    it('normalizeSelectedRegion 颜色非法应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).normalizeSelectedRegion({
          firstSample: 1,
          lastSample: 2,
          regionName: 'r',
          color: 'bad'
        })
      ).toBeUndefined();
    });

    it('normalizeSelectedRegion 应规范化 first/last 顺序', () => {
      const provider = createProvider();
      const result = (provider as any).normalizeSelectedRegion({
        firstSample: 5,
        lastSample: 1,
        regionName: 'r',
        color: 'rgb(1,2,3)'
      });
      expect(result.firstSample).toBe(1);
      expect(result.lastSample).toBe(5);
    });

    it('normalizeSelectedRegion 在 sampleRange 内裁剪并计算偏移', () => {
      const provider = createProvider();
      const result = (provider as any).normalizeSelectedRegion(
        {
          firstSample: 0,
          lastSample: 10,
          regionName: 'r',
          color: 'rgb(1,2,3)'
        },
        { startSample: 2, endSample: 8 }
      );
      expect(result.firstSample).toBe(0); // max(0,2)-2
      expect(result.lastSample).toBe(5); // min(10,7)-2
    });

    it('normalizeSelectedRegion 裁剪后 clippedFirst>clippedLast 应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).normalizeSelectedRegion(
          {
            firstSample: 0,
            lastSample: 1,
            regionName: 'r',
            color: 'rgb(1,2,3)'
          },
          { startSample: 10, endSample: 20 }
        )
      ).toBeUndefined();
    });

    it('readSelectedRegions 非 record 或 selectedRegions 非数组应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).readSelectedRegions('x', {})).toBeUndefined();
      expect((provider as any).readSelectedRegions({ selectedRegions: 'x' }, {})).toBeUndefined();
    });

    it('readSelectedRegions 全部非法应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).readSelectedRegions({ selectedRegions: [{ firstSample: 1 }] }, {})
      ).toBeUndefined();
    });

    it('readSelectedRegions 应返回合法区域', () => {
      const provider = createProvider();
      const result = (provider as any).readSelectedRegions(
        {
          selectedRegions: [
            {
              firstSample: 1,
              lastSample: 2,
              regionName: 'r',
              color: 'rgb(1,2,3)'
            }
          ]
        },
        {}
      );
      expect(result).toHaveLength(1);
      expect(result[0].regionName).toBe('r');
    });
  });

  describe('resolveExportFormat', () => {
    it('payload format 优先于默认', () => {
      const provider = createProvider();
      expect((provider as any).resolveExportFormat({ format: 'JSON' })).toBe('json');
    });

    it('filePath extension 应优先于 payload format', () => {
      const provider = createProvider();
      expect((provider as any).resolveExportFormat({ format: 'csv' }, '/tmp/x.vcd')).toBe('vcd');
    });

    it('无 format 无 filePath 应默认 csv', () => {
      const provider = createProvider();
      expect((provider as any).resolveExportFormat({})).toBe('csv');
    });

    it('非法格式应抛错', () => {
      const provider = createProvider();
      expect(() => (provider as any).resolveExportFormat({ format: 'pdf' })).toThrow(
        '不支持的导出格式: pdf'
      );
    });
  });

  describe('formatErrorMessage', () => {
    it('Error 实例应返回 message', () => {
      const provider = createProvider();
      expect((provider as any).formatErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('{message} 对象应返回 message', () => {
      const provider = createProvider();
      expect((provider as any).formatErrorMessage({ message: 'obj-err' })).toBe('obj-err');
    });

    it('undefined/null 应返回未知错误', () => {
      const provider = createProvider();
      expect((provider as any).formatErrorMessage(undefined)).toBe('未知错误');
      expect((provider as any).formatErrorMessage(null)).toBe('未知错误');
    });

    it('其它类型应 String 化', () => {
      const provider = createProvider();
      expect((provider as any).formatErrorMessage(42)).toBe('42');
    });
  });

  describe('resolveExplicitSampleRange / resolveTimeRange / createExportOptions 补充边界', () => {
    it('resolveTimeRange 非法值应回退 all', () => {
      const provider = createProvider();
      expect((provider as any).resolveTimeRange({ timeRange: 'weird' })).toBe('all');
      expect((provider as any).resolveTimeRange({})).toBe('all');
    });

    it('resolveTimeRange 合法值应透传', () => {
      const provider = createProvider();
      for (const t of ['all', 'visible', 'selection', 'custom']) {
        expect((provider as any).resolveTimeRange({ timeRange: t })).toBe(t);
      }
    });

    it('resolveExplicitSampleRange custom 缺 customEnd 应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).resolveExplicitSampleRange({ customStart: 1 }, 'custom')).toBeUndefined();
    });

    it('resolveExplicitSampleRange selection 缺 selection 子对象应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).resolveExplicitSampleRange({}, 'selection')).toBeUndefined();
    });

    it('resolveExplicitSampleRange selection 缺 endSample 应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).resolveExplicitSampleRange({ selection: { startSample: 1 } }, 'selection')
      ).toBeUndefined();
    });

    it('resolveExplicitSampleRange visible 缺 visibleRange 应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).resolveExplicitSampleRange({}, 'visible')).toBeUndefined();
    });

    it('resolveExplicitSampleRange visible 缺 visibleSamples 应返回 undefined', () => {
      const provider = createProvider();
      expect(
        (provider as any).resolveExplicitSampleRange({ visibleRange: { firstSample: 1 } }, 'visible')
      ).toBeUndefined();
    });

    it('resolveExplicitSampleRange all 应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).resolveExplicitSampleRange({}, 'all')).toBeUndefined();
    });

    it('createExportOptions visible 无 visibleRange 应保持 timeRange=visible', () => {
      const provider = createProvider();
      const opts = (provider as any).createExportOptions('/tmp/x.csv', { timeRange: 'visible' });
      expect(opts.timeRange).toBe('visible');
      expect(opts.customStart).toBeUndefined();
    });

    it('createExportOptions custom 缺 customStart/customEnd 应在 options 上保留 undefined', () => {
      const provider = createProvider();
      const opts = (provider as any).createExportOptions('/tmp/x.csv', { timeRange: 'custom' });
      expect(opts.timeRange).toBe('custom');
      expect(opts.customStart).toBeUndefined();
      expect(opts.customEnd).toBeUndefined();
    });

    it('createExportOptions selectedChannels 非数组应为 undefined', () => {
      const provider = createProvider();
      const opts = (provider as any).createExportOptions('/tmp/x.csv', { selectedChannels: 'nope' });
      expect(opts.selectedChannels).toBeUndefined();
    });
  });

  describe('readString / readNumber / readBoolean / readNumberArray / readNestedRecord / isRecord', () => {
    it('isRecord 应识别对象与非对象', () => {
      const provider = createProvider();
      expect((provider as any).isRecord({})).toBe(true);
      expect((provider as any).isRecord(null)).toBe(false);
      expect((provider as any).isRecord('x')).toBe(false);
      expect((provider as any).isRecord(undefined)).toBe(false);
    });

    it('readString 非 record 或非字符串应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).readString(null, 'k')).toBeUndefined();
      expect((provider as any).readString({ k: 1 }, 'k')).toBeUndefined();
      expect((provider as any).readString({ k: 'v' }, 'k')).toBe('v');
    });

    it('readNumber 非 number 或 NaN 应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).readNumber({ k: 'x' }, 'k')).toBeUndefined();
      expect((provider as any).readNumber({ k: NaN }, 'k')).toBeUndefined();
      expect((provider as any).readNumber({ k: 5 }, 'k')).toBe(5);
    });

    it('readBoolean 非 boolean 应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).readBoolean({ k: 'true' }, 'k')).toBeUndefined();
      expect((provider as any).readBoolean({ k: true }, 'k')).toBe(true);
    });

    it('readNumberArray 非数组或全非法应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).readNumberArray({ k: 'x' }, 'k')).toBeUndefined();
      expect((provider as any).readNumberArray({ k: [1, 'a', 2] }, 'k')).toEqual([1, 2]);
      expect((provider as any).readNumberArray({ k: ['a'] }, 'k')).toBeUndefined();
      expect((provider as any).readNumberArray({ k: [Infinity] }, 'k')).toBeUndefined();
    });

    it('readNestedRecord 非 record 子项应返回 undefined', () => {
      const provider = createProvider();
      expect((provider as any).readNestedRecord({ k: 'x' }, 'k')).toBeUndefined();
      expect((provider as any).readNestedRecord({ k: { a: 1 } }, 'k')).toEqual({ a: 1 });
    });
  });

  describe('repeatCaptureForDocument', () => {
    it('无 lastCaptureConfig 应返回错误', async () => {
      const provider = createProvider();
      const result = await (provider as any).repeatCaptureForDocument(createDocument());
      expect(result).toEqual({ success: false, error: '没有可重复执行的采集配置' });
    });

    it('有 lastCaptureConfig 无设备应返回请先连接', async () => {
      const provider = createProvider();
      (provider as any).lastCaptureConfig = {
        frequency: 1000,
        preTriggerSamples: 0,
        postTriggerSamples: 10,
        triggerType: 'Edge',
        triggerChannel: 0,
        channels: [{ number: 0 }]
      };
      const result = await (provider as any).repeatCaptureForDocument(createDocument());
      expect(result).toEqual({ success: false, error: '请先连接逻辑分析器设备' });
    });
  });

  describe('disconnectCurrentDevice', () => {
    it('networkStabilityService 未创建时不应调用 disconnect', async () => {
      const provider = createProvider();
      const result = await (provider as any).disconnectCurrentDevice();
      expect(disconnectCurrentDevice).toHaveBeenCalled();
      expect(networkDisconnect).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('networkStabilityService 已创建时应调用 disconnect', async () => {
      const provider = createProvider();
      // 触发 networkStabilityService 惰性创建
      (provider as any).getNetworkStabilityService();
      const result = await (provider as any).disconnectCurrentDevice();
      expect(networkDisconnect).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('getHtmlForWebview / readWebviewAssetManifest / readVsCodeWebviewScripts', () => {
    it('readWebviewAssetManifest 资源清单不存在应抛错', () => {
      setupManifestFiles({}, { manifestExists: false });
      const provider = createProvider();
      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(/资源清单不存在/);
      expect(showErrorMessage).toHaveBeenCalled();
    });

    it('readWebviewAssetManifest 资源清单 JSON 格式无效应抛错', () => {
      fsExistsSync.mockReturnValue(true);
      fsReadFileSync.mockImplementation(() => '{ invalid json');
      const provider = createProvider();
      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(/资源清单格式无效/);
    });

    it('readWebviewAssetManifest 资源清单非对象应抛错', () => {
      fsExistsSync.mockReturnValue(true);
      fsReadFileSync.mockImplementation(() => '123');
      const provider = createProvider();
      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(/资源清单格式无效/);
    });

    it('readWebviewAssetManifest 包含越界路径应抛错', () => {
      setupManifestFiles({ 'main-vscode.js': '../../../etc/passwd' });
      const provider = createProvider();
      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(/越界路径/);
    });

    it('readWebviewAssetManifest 指向文件不存在应抛错', () => {
      setupManifestFiles({ 'main-vscode.js': 'app.js' }, { fileExists: false });
      const provider = createProvider();
      expect(() => (provider as any).readWebviewAssetManifest()).toThrow(/文件不存在/);
    });

    it('readWebviewAssetManifest 正常应返回清单', () => {
      setupManifestFiles({ 'main-vscode.js': 'app.js', other: 123 as any });
      const provider = createProvider();
      const manifest = (provider as any).readWebviewAssetManifest();
      expect(manifest['main-vscode.js']).toBe('app.js');
      expect(Object.keys(manifest)).toEqual(['main-vscode.js']);
    });

    it('readVsCodeWebviewScripts 有前缀脚本列表应按 numeric 排序', () => {
      const provider = createProvider();
      const scripts = (provider as any).readVsCodeWebviewScripts({
        'main-vscode.scripts.10': 'b.js',
        'main-vscode.scripts.2': 'a.js',
        'main-vscode.js': 'fallback.js'
      });
      expect(scripts).toEqual(['a.js', 'b.js']);
    });

    it('readVsCodeWebviewScripts 无前缀应回退到 main-vscode.js', () => {
      const provider = createProvider();
      expect((provider as any).readVsCodeWebviewScripts({ 'main-vscode.js': 'app.js' })).toEqual(['app.js']);
    });

    it('readVsCodeWebviewScripts 都无应返回空数组', () => {
      const provider = createProvider();
      expect((provider as any).readVsCodeWebviewScripts({})).toEqual([]);
    });

    it('getHtmlForWebview 空脚本列表应抛错', () => {
      setupManifestFiles({});
      const provider = createProvider();
      const webview = { asWebviewUri: jest.fn(), cspSource: 'csp' };
      expect(() => (provider as any).getHtmlForWebview(webview, createDocument())).toThrow(/资源清单缺失/);
    });

    it('getHtmlForWebview 正常应返回 HTML 字符串', () => {
      setupManifestFiles({ 'main-vscode.js': 'app.js' });
      const provider = createProvider();
      const webview = {
        asWebviewUri: jest.fn(() => ({ toString: () => 'vscode-webview://app.js' })),
        cspSource: 'vscode-csp:'
      };
      const html = (provider as any).getHtmlForWebview(webview, createDocument());
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('window.__FRONTEND_BOOTSTRAP__');
      expect(html).toContain('app.js');
    });
  });

  describe('resolveCustomTextEditor 消息路由', () => {
    async function setupEditor() {
      const provider = createProvider();
      const ctx = createWebviewPanel();
      await (provider as any).resolveCustomTextEditor(createDocument(), ctx.panel, undefined as any);
      return { provider, ctx };
    }

    it('应设置 webview 选项与 html', async () => {
      const { ctx } = await setupEditor();
      expect(ctx.panel.webview.options.enableScripts).toBe(true);
      expect(ctx.panel.webview.html).toContain('<!DOCTYPE html>');
    });

    it('ready 消息应触发 sendDocumentToWebview', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'ready' });
      expect(ctx.posted.some(m => m.type === 'documentUpdate')).toBe(true);
    });

    it('save 消息应触发 saveLACFile', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'save', data: { Settings: {}, Samples: [] } });
      expect(applyEdit).toHaveBeenCalled();
      expect(showInformationMessage).toHaveBeenCalledWith('文件保存成功');
    });

    it('load 消息解析成功应 postMessage documentLoaded', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'load' });
      expect(ctx.posted.some(m => m.type === 'documentUpdate')).toBe(true);
      expect(ctx.posted.some(m => m.type === 'documentLoaded')).toBe(true);
    });

    it('load 消息解析失败应 postMessage error 并 showErrorMessage', async () => {
      const provider = createProvider();
      const ctx = createWebviewPanel();
      await (provider as any).resolveCustomTextEditor(
        createDocument({ text: 'not-json' }),
        ctx.panel,
        undefined as any
      );
      await ctx.fireMessage({ type: 'load' });
      expect(ctx.posted.some(m => m.type === 'error')).toBe(true);
      expect(showErrorMessage).toHaveBeenCalled();
    });

    it('export 消息应触发 exportData（取消保存对话框）', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'export', data: { format: 'csv' } });
      expect(showSaveDialog).toHaveBeenCalled();
    });

    it('startCapture 消息应执行 logicAnalyzer.startCapture 命令', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'startCapture' });
      expect(executeCommand).toHaveBeenCalledWith('logicAnalyzer.startCapture');
    });

    it('connectDevice 消息应执行 logicAnalyzer.connectDevice 命令', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'connectDevice' });
      expect(executeCommand).toHaveBeenCalledWith('logicAnalyzer.connectDevice');
    });

    it('testMessage 应回复 testResponse 并 showInformationMessage', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'testMessage', data: { message: 'hi', timestamp: 123 } });
      expect(showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('通信测试成功'));
      expect(ctx.posted.some(m => m.type === 'testResponse')).toBe(true);
    });

    it('hostCommand 缺少 requestId 应静默忽略', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'hostCommand', command: 'detectDevices' });
      expect(ctx.posted.some(m => m.type === 'hostCommandResult')).toBe(false);
    });

    it('hostCommand 缺少 command 应返回 Invalid envelope', async () => {
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'hostCommand', requestId: 'r1' });
      const result = ctx.posted.find(m => m.type === 'hostCommandResult');
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid host command envelope');
    });

    it('hostCommand 合法 envelope 应执行并回传结果', async () => {
      detectHardware.mockResolvedValue([{ id: 'd1' }]);
      const { ctx } = await setupEditor();
      await ctx.fireMessage({ type: 'hostCommand', requestId: 'r2', command: 'detectDevices' });
      const result = ctx.posted.find(m => m.type === 'hostCommandResult');
      expect(result.requestId).toBe('r2');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 'd1' }]);
    });

    it('未知消息类型应被忽略不抛错', async () => {
      const { ctx } = await setupEditor();
      await expect(ctx.fireMessage({ type: 'unknownType' })).resolves.toBeUndefined();
    });

    it('onDidChangeTextDocument 匹配 uri 应刷新 webview', async () => {
      const provider = createProvider();
      const ctx = createWebviewPanel();
      await (provider as any).resolveCustomTextEditor(createDocument(), ctx.panel, undefined as any);
      const changeHandler = (onDidChangeTextDocument as jest.Mock).mock.calls.slice(-1)[0][0];
      await changeHandler({ document: createDocument() });
      expect(ctx.posted.some(m => m.type === 'documentUpdate')).toBe(true);
    });

    it('onDidDispose 应释放文档变更订阅', async () => {
      const provider = createProvider();
      const ctx = createWebviewPanel();
      await (provider as any).resolveCustomTextEditor(createDocument(), ctx.panel, undefined as any);
      const subscription = (onDidChangeTextDocument as jest.Mock).mock.results.slice(-1)[0].value;
      ctx.fireDispose();
      expect(subscription.dispose).toHaveBeenCalled();
    });
  });

  describe('parseLACFile / sendDocumentToWebview', () => {
    it('parseLACFile 正常内容应返回 ExportedCapture', () => {
      const provider = createProvider();
      const data = (provider as any).parseLACFile(
        JSON.stringify({ Settings: { Frequency: 1000 }, Samples: [] })
      );
      expect(data).toBeDefined();
    });

    it('parseLACFile 解析失败应抛出统一错误信息', () => {
      const provider = createProvider();
      expect(() => (provider as any).parseLACFile('not-json')).toThrow('无效的.lac文件格式');
    });

    it('sendDocumentToWebview 解析成功应 postMessage documentUpdate', async () => {
      const provider = createProvider();
      const posted: any[] = [];
      const webview = { postMessage: jest.fn(async (d: any) => { posted.push(d); return true; }) };
      await (provider as any).sendDocumentToWebview(webview, createDocument());
      expect(posted.some(m => m.type === 'documentUpdate')).toBe(true);
    });

    it('sendDocumentToWebview 解析失败应 postMessage error', async () => {
      const provider = createProvider();
      const posted: any[] = [];
      const webview = { postMessage: jest.fn(async (d: any) => { posted.push(d); return true; }) };
      await (provider as any).sendDocumentToWebview(webview, createDocument({ text: 'bad' }));
      expect(posted.some(m => m.type === 'error')).toBe(true);
    });
  });

  describe('getWiFiDiscoveryService / getNetworkStabilityService 惰性初始化', () => {
    it('应缓存 WiFiDeviceDiscovery 实例', () => {
      const provider = createProvider();
      const a = (provider as any).getWiFiDiscoveryService();
      const b = (provider as any).getWiFiDiscoveryService();
      expect(a).toBe(b);
    });

    it('应缓存 NetworkStabilityService 实例', () => {
      const provider = createProvider();
      const a = (provider as any).getNetworkStabilityService();
      const b = (provider as any).getNetworkStabilityService();
      expect(a).toBe(b);
    });
  });

  describe('静态 register 方法', () => {
    it('应调用 registerCustomEditorProvider 并返回注册对象', () => {
      const fakeReg = { dispose: jest.fn() };
      const registerSpy = jest.requireMock('vscode').window.registerCustomEditorProvider;
      registerSpy.mockReturnValue(fakeReg);
      const result = LACEditorProvider.register({ extensionUri: { fsPath: '/tmp' } } as any);
      expect(registerSpy).toHaveBeenCalled();
      expect(result).toBe(fakeReg);
    });
  });
});
