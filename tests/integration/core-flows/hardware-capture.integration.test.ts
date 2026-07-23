/**
 * 核心链路集成测试：采集 → LAC 序列化往返 → Provider documentLoaded
 *
 * 覆盖真实模块组合（不连真实硬件/网络/sigrok）：
 * - 采集环节：直接构造 CaptureSession + AnalyzerChannel.samples（等价于硬件采集产物，
 *   避开异步回调式 startCapture，最简且确定）。
 * - LAC 往返：LACFileFormat.createFromCaptureSession → serialize → parse → convertToCaptureSession。
 * - Provider 推送：LACEditorProvider.resolveCustomTextEditor + webview 'load' 消息 → postMessage documentLoaded。
 *
 * 关于解码注解：documentLoaded 的 payload 是 ExportedCapture（PascalCase 的
 * Samples/Settings/SelectedRegions），不存在独立的 decoder annotations 字段——
 * 协议解码注解由前端运行时按需通过 hostCommand 'runDecoder' 请求，不在加载 payload 内。
 * 本测试以合同真实性为准，不伪造该字段。
 */

const fsExistsSync = jest.fn();
const fsReadFileSync = jest.fn();
const overwriteExportedLacFile = jest.fn();

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

// vscode 虚拟 mock：复用 LACEditorProvider.coverage.test.ts 的内联模式
// （WebviewPanel/Webview/TextDocument 均在此内联构造，无需扩展 mocks/vscode.ts）
jest.mock(
  'vscode',
  () => ({
    commands: { executeCommand: jest.fn() },
    window: {
      registerCustomEditorProvider: jest.fn(),
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showSaveDialog: jest.fn(),
      showInputBox: jest.fn(),
      showQuickPick: jest.fn()
    },
    workspace: {
      applyEdit: jest.fn(),
      onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
      fs: { readFile: jest.fn(), writeFile: jest.fn() }
    },
    Uri: {
      joinPath: jest.fn((...parts: unknown[]) => ({
        fsPath: parts.map(p => (typeof p === 'object' && p !== null ? (p as { fsPath?: string }).fsPath : String(p))).join('/'),
        toString: () => parts.join('/')
      })),
      file: jest.fn((filePath: string) => ({ fsPath: filePath, toString: () => `file://${filePath}` }))
    },
    Range: jest.fn((startLine: number, startChar: number, endLine: number, endChar: number) => ({
      startLine, startChar, endLine, endChar
    })),
    WorkspaceEdit: jest.fn(() => ({ replace: jest.fn() }))
  }),
  { virtual: true }
);

jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    detectHardware: jest.fn(),
    getCurrentDevice: jest.fn(() => null),
    getCurrentDeviceInfo: jest.fn(),
    connectToDevice: jest.fn(),
    disconnectCurrentDevice: jest.fn()
  }
}));

jest.mock('../../../src/services/DataExportService', () => ({
  DataExportService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    dispose: jest.fn().mockResolvedValue(true),
    exportWaveformData: jest.fn()
  }))
}));

jest.mock('../../../src/services/NetworkStabilityService', () => ({
  NetworkStabilityService: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn(),
    runDiagnostics: jest.fn()
  }))
}));

jest.mock('../../../src/services/WiFiDeviceDiscovery', () => ({
  WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
    scanForDevices: jest.fn(),
    stopScan: jest.fn(),
    getCachedDevices: jest.fn()
  }))
}));

// LACEditorProvider 顶部 import DecoderManager，需 mock 以隔离真实解码实现
jest.mock('../../../src/decoders/DecoderManager', () => ({
  DecoderManager: jest.fn().mockImplementation(() => ({
    getDecoder: jest.fn(),
    executeDecoder: jest.fn()
  }))
}));

import { LACEditorProvider } from '../../../src/providers/LACEditorProvider';
import { LACFileFormat } from '../../../src/models/LACFileFormat';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType } from '../../../src/models/AnalyzerTypes';

/**
 * 构造等价于"硬件采集完成产物"的最小 CaptureSession。
 * 两通道（D0/D1）、6 样本，样本值设计使打包后每样本 hex 末位覆盖 0x00/0x01/0x02/0x03。
 */
function createCapturedSession(): CaptureSession {
  const session = new CaptureSession();
  session.frequency = 1000000;
  session.preTriggerSamples = 0;
  session.postTriggerSamples = 6;
  session.triggerType = TriggerType.Edge;
  session.triggerChannel = 0;

  const ch0 = new AnalyzerChannel(0, 'D0');
  // [1,0,1,0,1,1] —— 打包后对应 bit0
  ch0.samples = new Uint8Array([1, 0, 1, 0, 1, 1]);

  const ch1 = new AnalyzerChannel(1, 'D1');
  // [0,1,1,0,0,1] —— 打包后对应 bit1
  ch1.samples = new Uint8Array([0, 1, 1, 0, 0, 1]);

  session.captureChannels = [ch0, ch1];
  return session;
}

/** 构造 webview manifest 文件 mock（resolveCustomTextEditor 读 html 时需要）。 */
function setupManifestFiles(): void {
  fsExistsSync.mockImplementation((p: unknown) => {
    if (typeof p === 'string' && p.endsWith('webview-manifest.json')) {
      return true;
    }
    return true;
  });
  fsReadFileSync.mockImplementation((p: unknown) => {
    if (typeof p === 'string' && p.endsWith('webview-manifest.json')) {
      return JSON.stringify({ 'main-vscode.js': 'app.js' });
    }
    return '';
  });
}

/** 构造 WebviewPanel mock，返回触发器与 postMessage 捕获数组（复用 coverage 测试模式）。 */
function createWebviewPanel(): {
  panel: unknown;
  fireMessage: (msg: unknown) => Promise<void> | undefined;
  posted: unknown[];
} {
  const posted: unknown[] = [];
  let messageHandler: ((msg: unknown) => Promise<void>) | undefined;
  const webview = {
    option: undefined,
    html: '',
    cspSource: 'vscode-resource:',
    asWebviewUri: jest.fn((uri: unknown) => ({ ...(uri as object), toString: () => 'vscode-webview://fake' })),
    onDidReceiveMessage: jest.fn((cb: (msg: unknown) => Promise<void>) => {
      messageHandler = cb;
      return { dispose: jest.fn() };
    }),
    postMessage: jest.fn(async (data: unknown) => {
      posted.push(data);
      return true;
    })
  };
  const panel = {
    webview,
    onDidDispose: jest.fn((cb: () => void) => {
      void cb;
      return { dispose: jest.fn() };
    })
  };
  return {
    panel,
    fireMessage: (msg: unknown) => (messageHandler ? messageHandler(msg) : undefined),
    posted
  };
}

/** 用 .lac 文本构造 TextDocument mock。 */
function createDocument(lacText: string): unknown {
  return {
    getText: () => lacText,
    lineCount: 1,
    save: jest.fn().mockResolvedValue(true),
    uri: { toString: () => 'file:///tmp/capture.lac', fsPath: '/tmp/capture.lac' }
  };
}

function createProvider(): LACEditorProvider {
  return new LACEditorProvider({ extensionUri: { fsPath: '/tmp/extension' } } as never);
}

describe('采集 → LAC 往返 → Provider documentLoaded 集成链路', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupManifestFiles();
  });

  describe('LAC 序列化往返完整性', () => {
    it('serialize→parse 不丢失样本数与通道数', () => {
      const session = createCapturedSession();
      const exported = LACFileFormat.createFromCaptureSession(session, undefined, true);
      const serialized = LACFileFormat.serialize(exported);
      const parsed = LACFileFormat.parse(serialized);

      // Samples 为十六进制字符串数组，长度 == 每通道样本数
      expect(parsed.Samples).toBeInstanceOf(Array);
      expect(parsed.Samples?.length).toBe(6);
      // 通道数保持
      expect(parsed.Settings.captureChannels.length).toBe(2);
    });

    it('convertToCaptureSession 还原后的每通道样本值与原始一致（归一化为 0/1）', () => {
      const session = createCapturedSession();
      const originalCh0 = Array.from(session.captureChannels[0].samples!);
      const originalCh1 = Array.from(session.captureChannels[1].samples!);

      const roundTrip = LACFileFormat.convertToCaptureSession(
        LACFileFormat.parse(
          LACFileFormat.serialize(
            LACFileFormat.createFromCaptureSession(session, undefined, true)
          )
        )
      );

      expect(Array.from(roundTrip.captureChannels[0].samples!)).toEqual(originalCh0);
      expect(Array.from(roundTrip.captureChannels[1].samples!)).toEqual(originalCh1);
      // 采样率等设置亦应往返不丢
      expect(roundTrip.frequency).toBe(session.frequency);
    });
  });

  describe('Provider documentLoaded 推送', () => {
    it("resolve + 'load' 消息应推送 documentLoaded，payload 含 Samples（PascalCase）", async () => {
      const session = createCapturedSession();
      const lacText = LACFileFormat.serialize(
        LACFileFormat.createFromCaptureSession(session, undefined, true)
      );
      const document = createDocument(lacText);
      const { panel, fireMessage, posted } = createWebviewPanel();
      const provider = createProvider();

      // 驱动 resolveCustomTextEditor：注册 webview 消息处理器
      await provider.resolveCustomTextEditor(
        document as never,
        panel as never,
        { isCancellationRequested: false } as never
      );

      // 模拟前端 webview 发出 'load'，触发 Provider 读取并解析文档
      await fireMessage({ type: 'load' });

      // documentLoaded 合同：data 为 ExportedCapture，Samples 为 hex 数组
      const documentLoaded = posted.find(
        (m: any) => m?.type === 'documentLoaded'
      );
      expect(documentLoaded).toBeDefined();
      expect(documentLoaded).toEqual(
        expect.objectContaining({
          type: 'documentLoaded',
          data: expect.objectContaining({
            Samples: expect.any(Array)
          })
        })
      );
      // 样本数与输入一致
      expect((documentLoaded as any).data.Samples.length).toBe(6);
      // Settings.captureChannels 通道数与输入一致
      expect((documentLoaded as any).data.Settings.captureChannels.length).toBe(2);
      // 采样率往返保持
      expect((documentLoaded as any).data.Settings.frequency).toBe(1000000);
    });

    it("resolve + 'ready' 消息应推送 documentUpdate（同一 LAC parse 链路）", async () => {
      const session = createCapturedSession();
      const lacText = LACFileFormat.serialize(
        LACFileFormat.createFromCaptureSession(session, undefined, true)
      );
      const document = createDocument(lacText);
      const { panel, fireMessage, posted } = createWebviewPanel();
      const provider = createProvider();

      await provider.resolveCustomTextEditor(
        document as never,
        panel as never,
        { isCancellationRequested: false } as never
      );

      // 'ready' 走 sendDocumentToWebview → documentUpdate
      await fireMessage({ type: 'ready' });

      const documentUpdate = posted.find((m: any) => m?.type === 'documentUpdate');
      expect(documentUpdate).toBeDefined();
      // documentUpdate 同样基于 LACFileFormat.parse，payload 结构一致
      expect((documentUpdate as any).data.Samples.length).toBe(6);
    });

    it('documentLoaded payload 不含独立 decoder annotations 字段（注解属前端运行时层）', async () => {
      const session = createCapturedSession();
      const lacText = LACFileFormat.serialize(
        LACFileFormat.createFromCaptureSession(session, undefined, true)
      );
      const document = createDocument(lacText);
      const { panel, fireMessage, posted } = createWebviewPanel();
      const provider = createProvider();

      await provider.resolveCustomTextEditor(
        document as never,
        panel as never,
        { isCancellationRequested: false } as never
      );
      await fireMessage({ type: 'load' });

      const documentLoaded = posted.find((m: any) => m?.type === 'documentLoaded') as {
        type: string;
        data: Record<string, unknown>;
      };
      // ExportedCapture 合同仅 Samples/Settings/SelectedRegions，无 annotations 字段
      expect(documentLoaded.data.annotations).toBeUndefined();
      expect(documentLoaded.data.decoderAnnotations).toBeUndefined();
      // 合同字段齐全
      expect(documentLoaded.data.Samples).toBeDefined();
      expect(documentLoaded.data.Settings).toBeDefined();
    });
  });

  describe('采集配置闭环', () => {
    it('多通道（4 通道）LAC 往返后通道与样本数保持', () => {
      const session = new CaptureSession();
      session.frequency = 24000000;
      session.preTriggerSamples = 4;
      session.postTriggerSamples = 4;
      session.captureChannels = [0, 1, 2, 3].map(n => {
        const ch = new AnalyzerChannel(n, `D${n}`);
        ch.samples = new Uint8Array([1, 0, 1, 1, 0, 1, 0, 1]);
        return ch;
      });

      const parsed = LACFileFormat.parse(
        LACFileFormat.serialize(
          LACFileFormat.createFromCaptureSession(session, undefined, true)
        )
      );

      expect(parsed.Samples?.length).toBe(8);
      expect(parsed.Settings.captureChannels.length).toBe(4);
      expect(parsed.Settings.frequency).toBe(24000000);
    });
  });
});
