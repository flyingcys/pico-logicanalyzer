import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { hardwareDriverManager } from '../drivers/HardwareDriverManager';
import { CaptureError, TriggerType } from '../models/AnalyzerTypes';
import { AnalyzerChannel, CaptureSession } from '../models/CaptureModels';
import { LACFileFormat } from '../models/LACFileFormat';
import { DataExportService, type ExportOptions } from '../services/DataExportService';
import { NetworkStabilityService, type DiagnosticResult } from '../services/NetworkStabilityService';
import { WiFiDeviceDiscovery, type WiFiDeviceInfo } from '../services/WiFiDeviceDiscovery';
import {
  WEBVIEW_ASSET_MANIFEST_FILE,
  WEBVIEW_VSCODE_SCRIPT_KEY,
  type WebviewAssetManifest
} from '../frontend/platform/bootstrap/assetManifest';

type HostCommandResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

type HostTriggerType = 'Edge' | 'Fast' | 'Complex' | 'Blast';

interface HostCaptureChannelConfig {
  number: number;
  name?: string;
  enabled?: boolean;
}

interface HostCaptureConfig {
  frequency: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  triggerType: HostTriggerType | string | number;
  triggerChannel: number;
  triggerInverted?: boolean;
  triggerPattern?: number;
  triggerBitCount?: number;
  loopCount?: number;
  measureBursts?: boolean;
  channels: HostCaptureChannelConfig[];
}

export function createConnectedDeviceInfo({
  host,
  port,
  deviceName,
  version,
  responseTime = 0,
  deviceType = 'network'
}: {
  host: string;
  port: number;
  deviceName?: string;
  version?: string;
  responseTime?: number;
  deviceType?: string;
}): WiFiDeviceInfo {
  return {
    ipAddress: host,
    port,
    version,
    deviceName: deviceName || 'Network Device',
    responseTime,
    deviceType,
    lastSeen: new Date(),
    isOnline: true
  };
}

/**
 * .lac文件的自定义编辑器提供者
 * 基于VSCode Custom Editor API实现，支持.lac文件的可视化编辑
 */
export class LACEditorProvider implements vscode.CustomTextEditorProvider {
  private wifiDiscoveryService?: WiFiDeviceDiscovery;
  private networkStabilityService?: NetworkStabilityService;
  private lastCaptureConfig?: HostCaptureConfig;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new LACEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      LACEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = 'logicAnalyzer.lacEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * 解析自定义文本编辑器
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // 设置webview选项
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')]
    };

    // 设置webview的HTML内容
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

    // 处理来自webview的消息
    webviewPanel.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'ready':
          // webview准备就绪，发送初始数据
          await this.sendDocumentToWebview(webviewPanel.webview, document);
          break;

        case 'save':
          // 保存.lac文件
          await this.saveLACFile(document, message.data);
          break;

        case 'load':
          // 加载.lac文件内容
          try {
            const lacData = this.parseLACFile(document.getText());
            await this.sendDocumentToWebview(webviewPanel.webview, document);
            await webviewPanel.webview.postMessage({
              type: 'documentLoaded',
              data: lacData
            });
          } catch (error) {
            console.error('加载文档失败:', error);
            vscode.window.showErrorMessage(`加载文件失败: ${error}`);
            try {
              await webviewPanel.webview.postMessage({
                type: 'error',
                message: `加载文件失败: ${error}`
              });
            } catch (postError) {
              console.error('发送错误消息失败:', postError);
            }
          }
          break;

        case 'export':
          // 导出数据
          await this.exportData(document, message.data);
          break;

        case 'startCapture':
          // 开始数据采集
          vscode.commands.executeCommand('logicAnalyzer.startCapture');
          break;

        case 'connectDevice':
          // 连接设备
          vscode.commands.executeCommand('logicAnalyzer.connectDevice');
          break;

        case 'testMessage':
          // 测试通信
          console.log('收到来自webview的测试消息:', message.data);
          vscode.window.showInformationMessage(`通信测试成功！收到消息: ${message.data.message}`);
          // 向webview发送回复
          try {
            await webviewPanel.webview.postMessage({
              type: 'testResponse',
              data: {
                timestamp: new Date().toISOString(),
                message: '来自VSCode扩展的回复消息',
                receivedAt: message.data.timestamp
              }
            });
          } catch (postError) {
            console.error('发送测试回复消息失败:', postError);
          }
          break;

        case 'hostCommand': {
          const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;
          const command = typeof message.command === 'string' ? message.command : undefined;

          if (!requestId) {
            break;
          }

          if (!command) {
            await webviewPanel.webview.postMessage({
              type: 'hostCommandResult',
              requestId,
              success: false,
              error: 'Invalid host command envelope'
            });
            break;
          }

          const result = await this.executeHostCommand(document, command, message.payload);
          await webviewPanel.webview.postMessage({
            type: 'hostCommandResult',
            requestId,
            success: result.success,
            data: result.data,
            error: result.error
          });
          break;
        }

        default:
          console.warn('未知的webview消息类型:', message.type);
      }
    });

    // 监听文档变化
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.sendDocumentToWebview(webviewPanel.webview, document);
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  /**
   * 获取webview的HTML内容
   */
  private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    const assetManifest = this.readWebviewAssetManifest();
    const scriptName = assetManifest[WEBVIEW_VSCODE_SCRIPT_KEY];
    if (!scriptName) {
      this.failWebviewAsset(`Webview 资源清单缺失 ${WEBVIEW_VSCODE_SCRIPT_KEY}`);
    }

    // 获取webview资源的URI
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', scriptName)
    );

    // 生成随机nonce用于CSP
    const nonce = getNonce();
    const documentData = {
      uri: document.uri.toString(),
      fileName: path.basename(document.uri.fsPath),
      content: document.getText()
    };
    const bootstrap = JSON.stringify({
      host: 'vscode',
      document: documentData,
      capabilities: {
        canSave: true,
        canExport: true,
        canStartCapture: true,
        canConnectDevice: true
      }
    }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
      webview.cspSource
    } 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Logic Analyzer - ${path.basename(document.uri.fsPath)}</title>
</head>
<body>
    <div id="app">
        <!-- Vue应用挂载点 -->
        <div class="loading">
            <div class="spinner"></div>
            <p>正在加载逻辑分析器界面...</p>
        </div>
    </div>
    
    <script nonce="${nonce}">
        // 传递VSCode API给Vue应用
        window.vscode = acquireVsCodeApi();
        window.__FRONTEND_BOOTSTRAP__ = ${bootstrap};
    </script>
    <script nonce="${nonce}" src="${webviewUri}"></script>
</body>
</html>`;
  }

  /**
   * 发送文档内容到webview
   */
  private async sendDocumentToWebview(
    webview: vscode.Webview,
    document: vscode.TextDocument
  ): Promise<void> {
    try {
      const lacData = this.parseLACFile(document.getText());
      try {
        await webview.postMessage({
          type: 'documentUpdate',
          data: lacData
        });
      } catch (postError) {
        console.error('发送文档更新消息失败:', postError);
      }
    } catch (error) {
      console.error('解析.lac文件失败:', error);
      try {
        await webview.postMessage({
          type: 'error',
          message: `解析文件失败: ${error}`
        });
      } catch (postError) {
        console.error('发送错误消息失败:', postError);
      }
    }
  }

  /**
   * 解析.lac文件内容
   */
  private parseLACFile(content: string): any {
    try {
      return LACFileFormat.parse(content);
    } catch (error) {
      throw new Error('无效的.lac文件格式');
    }
  }

  /**
   * 保存.lac文件
   */
  private async saveLACFile(document: vscode.TextDocument, data: any): Promise<void> {
    try {
      const edit = new vscode.WorkspaceEdit();
      const lacContent = JSON.stringify(data, null, 2);

      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), lacContent);

      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage('文件保存成功');
    } catch (error) {
      vscode.window.showErrorMessage(`保存文件失败: ${error}`);
    }
  }

  /**
   * 导出数据
   */
  private async exportData(document: vscode.TextDocument, data: unknown): Promise<void> {
    try {
      const requestedFormat = this.resolveExportFormat(data);
      const defaultFilename = `capture_export.${requestedFormat}`;
      const options: vscode.SaveDialogOptions = {
        defaultUri: vscode.Uri.file(defaultFilename),
        filters: {
          LAC文件: ['lac'],
          CSV文件: ['csv'],
          JSON文件: ['json'],
          VCD文件: ['vcd'],
          所有文件: ['*']
        }
      };

      const fileUri = await vscode.window.showSaveDialog(options);
      if (fileUri) {
        const format = this.resolveExportFormat(data, fileUri.fsPath);
        const exportedCapture = this.parseLACFile(document.getText());
        const session = LACFileFormat.convertToCaptureSession(exportedCapture);
        const exportOptions: ExportOptions = {
          filename: fileUri.fsPath,
          timeRange: this.resolveTimeRange(data),
          customStart: this.readNumber(data, 'customStart'),
          customEnd: this.readNumber(data, 'customEnd'),
          selectedChannels: this.readNumberArray(data, 'selectedChannels')
        };
        const exportService = new DataExportService();

        await exportService.initialize();
        try {
          const result = await exportService.exportWaveformData(session, format, exportOptions);
          if (!result.success) {
            vscode.window.showErrorMessage(`导出数据失败: ${result.error || '未知错误'}`);
            return;
          }
        } finally {
          await exportService.dispose();
        }

        vscode.window.showInformationMessage(`数据已导出到: ${fileUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`导出数据失败: ${error}`);
    }
  }

  private resolveExportFormat(data: unknown, filePath?: string): 'lac' | 'csv' | 'json' | 'vcd' {
    const payloadFormat = this.readString(data, 'format')?.toLowerCase();
    const extension = filePath ? path.extname(filePath).replace('.', '').toLowerCase() : undefined;
    const format = extension || payloadFormat || 'csv';

    if (format === 'lac' || format === 'csv' || format === 'json' || format === 'vcd') {
      return format;
    }

    return 'csv';
  }

  private resolveTimeRange(data: unknown): ExportOptions['timeRange'] {
    const timeRange = this.readString(data, 'timeRange');
    if (timeRange === 'all' || timeRange === 'visible' || timeRange === 'selection' || timeRange === 'custom') {
      return timeRange;
    }

    return 'all';
  }

  private readNumberArray(value: unknown, key: string): number[] | undefined {
    if (!this.isRecord(value) || !Array.isArray(value[key])) {
      return undefined;
    }

    const numbers = (value[key] as unknown[]).filter((item): item is number =>
      typeof item === 'number' && Number.isFinite(item)
    );

    return numbers.length > 0 ? numbers : undefined;
  }

  private getWiFiDiscoveryService(): WiFiDeviceDiscovery {
    if (!this.wifiDiscoveryService) {
      this.wifiDiscoveryService = new WiFiDeviceDiscovery();
    }

    return this.wifiDiscoveryService;
  }

  private getNetworkStabilityService(): NetworkStabilityService {
    if (!this.networkStabilityService) {
      this.networkStabilityService = new NetworkStabilityService();
    }

    return this.networkStabilityService;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private readString(value: unknown, key: string): string | undefined {
    if (!this.isRecord(value) || typeof value[key] !== 'string') {
      return undefined;
    }

    return value[key] as string;
  }

  private readNumber(value: unknown, key: string): number | undefined {
    if (!this.isRecord(value) || typeof value[key] !== 'number' || Number.isNaN(value[key])) {
      return undefined;
    }

    return value[key] as number;
  }

  private readNestedRecord(value: unknown, key: string): Record<string, unknown> | undefined {
    if (!this.isRecord(value) || !this.isRecord(value[key])) {
      return undefined;
    }

    return value[key] as Record<string, unknown>;
  }

  private readWebviewAssetManifest(): WebviewAssetManifest {
    const webviewOutputDir = path.join(this.context.extensionUri.fsPath, 'out', 'webview');
    const manifestPath = path.join(webviewOutputDir, WEBVIEW_ASSET_MANIFEST_FILE);

    if (!fs.existsSync(manifestPath)) {
      this.failWebviewAsset(`Webview 资源清单不存在: ${manifestPath}`);
    }

    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
    } catch (error) {
      this.failWebviewAsset(
        `Webview 资源清单格式无效: ${manifestPath} - ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!this.isRecord(rawManifest)) {
      this.failWebviewAsset(`Webview 资源清单格式无效: ${manifestPath}`);
    }

    const manifest: WebviewAssetManifest = {};
    for (const [key, value] of Object.entries(rawManifest)) {
      if (typeof value !== 'string') {
        continue;
      }

      const resolvedPath = path.resolve(webviewOutputDir, value);
      const relativePath = path.relative(path.resolve(webviewOutputDir), resolvedPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        this.failWebviewAsset(`Webview 资源清单包含越界路径: ${value}`);
      }

      if (!fs.existsSync(resolvedPath)) {
        this.failWebviewAsset(`Webview 资源清单指向的文件不存在: ${value}`);
      }

      manifest[key] = value;
    }

    return manifest;
  }

  private failWebviewAsset(message: string): never {
    void vscode.window.showErrorMessage(message);
    throw new Error(message);
  }

  private async executeHostCommand(
    document: vscode.TextDocument,
    command: string,
    payload: unknown
  ): Promise<HostCommandResult> {
    try {
      switch (command) {
        case 'scanForDevices':
          return {
            success: true,
            data: await this.getWiFiDiscoveryService().scanForDevices(
              this.isRecord(payload) ? payload : undefined
            )
          };

        case 'detectDevices':
          return {
            success: true,
            data: await hardwareDriverManager.detectHardware(false)
          };

        case 'stopScan':
          this.getWiFiDiscoveryService().stopScan();
          return { success: true };

        case 'getCachedDevices':
          return {
            success: true,
            data: this.getWiFiDiscoveryService().getCachedDevices()
          };

        case 'connectToDevice':
          return this.connectToNetworkDevice(payload);

        case 'disconnectDevice':
          return this.disconnectCurrentDevice();

        case 'sendNetworkConfig':
          return this.sendNetworkConfig(payload);

        case 'runNetworkDiagnostics':
          return this.runNetworkDiagnostics(payload);

        case 'connectDevice':
          return this.connectDeviceFromPayload(payload);

        case 'startCapture':
          return this.startCaptureForDocument(document, payload);

        case 'repeatCapture':
          return this.repeatCaptureForDocument(document);

        case 'getStatus':
          return {
            success: true,
            data: await this.createDeviceStatus()
          };

        case 'exportData':
          await this.exportData(document, payload);
          return { success: true };

        case 'saveFile':
          return {
            success: await document.save()
          };

        case 'stopCapture': {
          const currentDevice = hardwareDriverManager.getCurrentDevice();
          if (!currentDevice) {
            return { success: false, error: '当前没有已连接设备' };
          }

          return {
            success: await currentDevice.stopCapture()
          };
        }

        default:
          return {
            success: false,
            error: 'Unsupported command'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async connectToNetworkDevice(payload: unknown): Promise<HostCommandResult> {
    const payloadRecord = this.isRecord(payload) ? payload : undefined;
    const device = this.readNestedRecord(payloadRecord, 'device');
    const host =
      this.readString(payloadRecord, 'ipAddress') ??
      this.readString(payloadRecord, 'host') ??
      this.readString(device, 'ipAddress');
    const port =
      this.readNumber(payloadRecord, 'port') ??
      this.readNumber(device, 'port');

    if (!host || !port) {
      return {
        success: false,
        error: '缺少网络连接参数'
      };
    }

    const networkService = this.getNetworkStabilityService();
    await networkService.disconnect();
    const connected = await networkService.connect(host, port);

    if (!connected) {
      return {
        success: false,
        error: `无法连接到网络设备: ${host}:${port}`
      };
    }

    const result = await hardwareDriverManager.connectToDevice('network', {
      networkConfig: { host, port }
    });

    if (!result.success) {
      await networkService.disconnect();
      return {
        success: false,
        error: result.error || '网络设备连接失败'
      };
    }

    return {
      success: true,
      data: {
        deviceInfo: createConnectedDeviceInfo({
          host,
          port,
          deviceName: result.deviceInfo?.name,
          version: result.deviceInfo?.version
        })
      }
    };
  }

  private async connectDeviceFromPayload(payload: unknown): Promise<HostCommandResult> {
    const payloadRecord = this.isRecord(payload) ? payload : undefined;
    const type = this.readString(payloadRecord, 'type');
    const address = this.readString(payloadRecord, 'address');
    const deviceId = this.readString(payloadRecord, 'deviceId');

    if (type === 'network') {
      const parsed = this.parseNetworkAddress(address || '');
      if (!parsed) {
        return {
          success: false,
          error: '网络地址格式无效，应为 host:port'
        };
      }

      return this.connectToNetworkDevice({
        host: parsed.host,
        port: parsed.port
      });
    }

    if (type === 'serial' && address) {
      const result = await hardwareDriverManager.connectToDevice(address);
      if (!result.success) {
        return {
          success: false,
          error: result.error || '串口设备连接失败'
        };
      }

      return {
        success: true,
        data: await this.createDeviceStatus()
      };
    }

    if (deviceId) {
      const result = await hardwareDriverManager.connectToDevice(deviceId);
      if (!result.success) {
        return {
          success: false,
          error: result.error || '设备连接失败'
        };
      }

      return {
        success: true,
        data: await this.createDeviceStatus()
      };
    }

    await vscode.commands.executeCommand('logicAnalyzer.connectDevice');
    return {
      success: true,
      data: await this.createDeviceStatus()
    };
  }

  private async startCaptureForDocument(
    document: vscode.TextDocument,
    payload: unknown
  ): Promise<HostCommandResult> {
    const currentDevice = hardwareDriverManager.getCurrentDevice();
    if (!currentDevice) {
      return {
        success: false,
        error: '请先连接逻辑分析器设备'
      };
    }

    const config = this.readCaptureConfig(payload);
    if (!config) {
      return {
        success: false,
        error: '采集配置无效'
      };
    }

    this.lastCaptureConfig = this.cloneCaptureConfig(config);
    const session = await this.captureWithDevice(config);
    const lacData = LACFileFormat.createFromCaptureSession(session);
    await this.saveLACFile(document, lacData);

    return {
      success: true,
      data: {
        ...(await this.createDeviceStatus()),
        capturedSession: {
          totalSamples: session.totalSamples,
          frequency: session.frequency,
          channelCount: session.captureChannels.length
        }
      }
    };
  }

  private async repeatCaptureForDocument(document: vscode.TextDocument): Promise<HostCommandResult> {
    if (!this.lastCaptureConfig) {
      return {
        success: false,
        error: '没有可重复执行的采集配置'
      };
    }

    return this.startCaptureForDocument(document, {
      config: this.lastCaptureConfig
    });
  }

  private async captureWithDevice(config: HostCaptureConfig): Promise<CaptureSession> {
    const currentDevice = hardwareDriverManager.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('请先连接逻辑分析器设备');
    }

    const session = this.createCaptureSession(config);

    return new Promise<CaptureSession>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      currentDevice.startCapture(session, args => {
        finish(() => {
          if (args.success && args.session) {
            resolve(args.session as CaptureSession);
          } else {
            reject(new Error('采集失败'));
          }
        });
      }).then(result => {
        if (result !== CaptureError.None) {
          finish(() => reject(new Error(`采集启动失败，错误代码: ${result}`)));
        }
      }).catch(error => {
        finish(() => reject(error));
      });
    });
  }

  private createCaptureSession(config: HostCaptureConfig): CaptureSession {
    const session = new CaptureSession();
    session.frequency = config.frequency;
    session.preTriggerSamples = config.preTriggerSamples;
    session.postTriggerSamples = config.postTriggerSamples;
    session.triggerType = this.parseTriggerType(config.triggerType);
    session.triggerChannel = config.triggerChannel;
    session.triggerInverted = config.triggerInverted ?? false;
    session.triggerPattern = config.triggerPattern ?? 0;
    session.triggerBitCount = config.triggerBitCount ?? 1;
    session.loopCount = config.loopCount ?? 0;
    session.measureBursts = config.measureBursts ?? false;
    session.captureChannels = config.channels
      .filter(channel => channel.enabled !== false)
      .map(channel => {
        const analyzerChannel = new AnalyzerChannel(
          channel.number,
          channel.name || `Channel ${channel.number + 1}`
        );
        analyzerChannel.hidden = false;
        return analyzerChannel;
      });

    return session;
  }

  private readCaptureConfig(payload: unknown): HostCaptureConfig | null {
    const payloadRecord = this.isRecord(payload) ? payload : undefined;
    const configRecord = this.readNestedRecord(payloadRecord, 'config') ?? payloadRecord;
    if (!configRecord) {
      return null;
    }

    const frequency = this.readNumber(configRecord, 'frequency');
    const preTriggerSamples = this.readNumber(configRecord, 'preTriggerSamples');
    const postTriggerSamples = this.readNumber(configRecord, 'postTriggerSamples');
    const triggerChannel = this.readNumber(configRecord, 'triggerChannel');
    const triggerType = this.readString(configRecord, 'triggerType') ?? 'Edge';

    if (
      frequency === undefined ||
      preTriggerSamples === undefined ||
      postTriggerSamples === undefined ||
      triggerChannel === undefined
    ) {
      return null;
    }

    const rawChannels = Array.isArray(configRecord.channels) ? configRecord.channels : [];
    const channels = rawChannels
      .filter(channel => this.isRecord(channel) && typeof channel.number === 'number')
      .map(channel => ({
        number: (channel as Record<string, unknown>).number as number,
        name: typeof (channel as Record<string, unknown>).name === 'string'
          ? (channel as Record<string, unknown>).name as string
          : undefined,
        enabled: typeof (channel as Record<string, unknown>).enabled === 'boolean'
          ? (channel as Record<string, unknown>).enabled as boolean
          : true
      }));

    if (channels.length === 0) {
      return null;
    }

    return {
      frequency,
      preTriggerSamples,
      postTriggerSamples,
      triggerType,
      triggerChannel,
      triggerInverted: this.readBoolean(configRecord, 'triggerInverted') ?? false,
      triggerPattern: this.readNumber(configRecord, 'triggerPattern') ?? 0,
      triggerBitCount: this.readNumber(configRecord, 'triggerBitCount') ?? 1,
      loopCount: this.readNumber(configRecord, 'loopCount') ?? 0,
      measureBursts: this.readBoolean(configRecord, 'measureBursts') ?? false,
      channels
    };
  }

  private async createDeviceStatus(): Promise<Record<string, unknown>> {
    const currentDevice = hardwareDriverManager.getCurrentDevice();
    const currentDeviceInfo = hardwareDriverManager.getCurrentDeviceInfo();
    const deviceInfo = currentDevice?.getDeviceInfo();

    return {
      isConnected: Boolean(currentDevice),
      isCapturing: currentDevice?.isCapturing ?? false,
      currentDevice: currentDeviceInfo,
      limits: deviceInfo ? {
        minFrequency: currentDevice?.minFrequency ?? 0,
        maxFrequency: deviceInfo.maxFrequency,
        blastFrequency: deviceInfo.blastFrequency,
        channelCount: deviceInfo.channels,
        modeLimits: deviceInfo.modeLimits.map(limit => ({
          minPreSamples: limit.minPreSamples,
          maxPreSamples: limit.maxPreSamples,
          minPostSamples: limit.minPostSamples,
          maxPostSamples: limit.maxPostSamples,
          maxTotalSamples: limit.maxTotalSamples
        }))
      } : null,
      lastCaptureConfig: this.lastCaptureConfig ?? null
    };
  }

  private readBoolean(value: unknown, key: string): boolean | undefined {
    if (!this.isRecord(value) || typeof value[key] !== 'boolean') {
      return undefined;
    }

    return value[key] as boolean;
  }

  private parseTriggerType(value: HostCaptureConfig['triggerType']): TriggerType {
    if (typeof value === 'number') {
      return value;
    }

    switch (value) {
      case 'Fast':
        return TriggerType.Fast;
      case 'Complex':
        return TriggerType.Complex;
      case 'Blast':
        return TriggerType.Blast;
      case 'Edge':
      default:
        return TriggerType.Edge;
    }
  }

  private cloneCaptureConfig(config: HostCaptureConfig): HostCaptureConfig {
    return {
      ...config,
      channels: config.channels.map(channel => ({ ...channel }))
    };
  }

  private parseNetworkAddress(address: string): { host: string; port: number } | null {
    const [host, portText] = address.split(':');
    const port = Number.parseInt(portText, 10);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }

    return {
      host,
      port
    };
  }

  private async disconnectCurrentDevice(): Promise<HostCommandResult> {
    await hardwareDriverManager.disconnectCurrentDevice();
    if (this.networkStabilityService) {
      await this.networkStabilityService.disconnect();
    }
    return { success: true };
  }

  private async sendNetworkConfig(payload: unknown): Promise<HostCommandResult<boolean>> {
    const payloadRecord = this.isRecord(payload) ? payload : undefined;
    const config = this.readNestedRecord(payloadRecord, 'config') ?? payloadRecord;
    const ssid = this.readString(config, 'ssid');
    const password = this.readString(config, 'password') ?? '';
    const staticIp =
      this.readString(config, 'staticIp') ??
      this.readString(config, 'ipAddress') ??
      '0.0.0.0';
    const port = this.readNumber(config, 'port');

    if (!ssid || !port) {
      return {
        success: false,
        error: '缺少 WiFi 配置参数'
      };
    }

    const currentDevice = hardwareDriverManager.getCurrentDevice();
    if (!currentDevice) {
      return {
        success: false,
        error: '请先连接到设备'
      };
    }

    const success = await currentDevice.sendNetworkConfig(ssid, password, staticIp, port);
    return success
      ? { success: true, data: true }
      : { success: false, error: 'WiFi 配置发送失败' };
  }

  private async runNetworkDiagnostics(payload: unknown): Promise<HostCommandResult<DiagnosticResult[]>> {
    const payloadRecord = this.isRecord(payload) ? payload : undefined;
    const device = this.readNestedRecord(payloadRecord, 'device');
    const host =
      this.readString(payloadRecord, 'host') ??
      this.readString(payloadRecord, 'ipAddress') ??
      this.readString(device, 'ipAddress');
    const port =
      this.readNumber(payloadRecord, 'port') ??
      this.readNumber(device, 'port');

    if (!host || !port) {
      return {
        success: false,
        error: '缺少网络诊断参数'
      };
    }

    return {
      success: true,
      data: await this.getNetworkStabilityService().runDiagnostics(host, port)
    };
  }
}

/**
 * 生成随机nonce用于内容安全策略
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
