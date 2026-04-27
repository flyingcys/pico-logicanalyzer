import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { hardwareDriverManager } from '../drivers/HardwareDriverManager';
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
          await this.exportData(message.data);
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
      // .lac文件是JSON格式
      return JSON.parse(content);
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
  private async exportData(_data: any): Promise<void> {
    try {
      const options: vscode.SaveDialogOptions = {
        defaultUri: vscode.Uri.file('capture_export.csv'),
        filters: {
          CSV文件: ['csv'],
          JSON文件: ['json'],
          所有文件: ['*']
        }
      };

      const fileUri = await vscode.window.showSaveDialog(options);
      if (fileUri) {
        // TODO: 实现实际的数据导出逻辑
        vscode.window.showInformationMessage(`数据已导出到: ${fileUri.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`导出数据失败: ${error}`);
    }
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
          await vscode.commands.executeCommand('logicAnalyzer.connectDevice');
          return { success: true };

        case 'startCapture':
          await vscode.commands.executeCommand('logicAnalyzer.startCapture');
          return { success: true };

        case 'exportData':
          await this.exportData(payload);
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
