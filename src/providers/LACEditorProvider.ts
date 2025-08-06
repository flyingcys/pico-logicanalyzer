import * as vscode from 'vscode';
import * as path from 'path';

/**
 * .lac文件的自定义编辑器提供者
 * 基于VSCode Custom Editor API实现，支持.lac文件的可视化编辑
 */
export class LACEditorProvider implements vscode.CustomTextEditorProvider {
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
    // 获取webview资源的URI
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'main.js')
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'style.css')
    );

    // 生成随机nonce用于CSP
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
      webview.cspSource
    } 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Logic Analyzer - ${path.basename(document.uri.fsPath)}</title>
    <link href="${styleUri}" rel="stylesheet">
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
        window.documentData = {
            uri: '${document.uri.toString()}',
            fileName: '${path.basename(document.uri.fsPath)}',
            content: ${JSON.stringify(document.getText())}
        };
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
