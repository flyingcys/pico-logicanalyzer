/**
 * VSCode API Mock
 * 模拟VSCode扩展API，用于测试扩展功能
 */

import { MockBase } from './MockBase';

// VSCode API类型定义
export interface VSCodeWindow {
  showInformationMessage: jest.Mock;
  showWarningMessage: jest.Mock;
  showErrorMessage: jest.Mock;
  showQuickPick: jest.Mock;
  showInputBox: jest.Mock;
  showOpenDialog: jest.Mock;
  showSaveDialog: jest.Mock;
  createStatusBarItem: jest.Mock;
  createOutputChannel: jest.Mock;
  createWebviewPanel: jest.Mock;
  registerCustomEditorProvider: jest.Mock;
}

export interface VSCodeWorkspace {
  workspaceFolders: any[];
  getConfiguration: jest.Mock;
  createFileSystemWatcher: jest.Mock;
  findFiles: jest.Mock;
  openTextDocument: jest.Mock;
  saveAll: jest.Mock;
  applyEdit: jest.Mock;
  onDidChangeConfiguration: jest.Mock;
  onDidChangeWorkspaceFolders: jest.Mock;
}

export interface VSCodeCommands {
  registerCommand: jest.Mock;
  executeCommand: jest.Mock;
  getCommands: jest.Mock;
}

export interface VSCodeUri {
  file: jest.Mock;
  parse: jest.Mock;
}

export interface MockWebviewPanel {
  webview: {
    html: string;
    postMessage: jest.Mock;
    onDidReceiveMessage: jest.Mock;
  };
  onDidDispose: jest.Mock;
  dispose: jest.Mock;
  reveal: jest.Mock;
  title: string;
  visible: boolean;
  active: boolean;
}

export interface MockStatusBarItem {
  text: string;
  tooltip: string;
  color: string;
  command: string;
  alignment: number;
  priority: number;
  show: jest.Mock;
  hide: jest.Mock;
  dispose: jest.Mock;
}

export interface MockOutputChannel {
  name: string;
  append: jest.Mock;
  appendLine: jest.Mock;
  clear: jest.Mock;
  show: jest.Mock;
  hide: jest.Mock;
  dispose: jest.Mock;
}

/**
 * VSCode API Mock实现
 */
export class VSCodeMock extends MockBase {
  public window: VSCodeWindow;
  public workspace: VSCodeWorkspace;
  public commands: VSCodeCommands;
  public Uri: VSCodeUri;
  
  private _webviewPanels: MockWebviewPanel[] = [];
  private _statusBarItems: MockStatusBarItem[] = [];
  private _outputChannels: MockOutputChannel[] = [];
  private _registeredCommands: Map<string, Function> = new Map();
  private _configuration: any = {};

  constructor() {
    super();
    
    this.window = this.createWindowMock();
    this.workspace = this.createWorkspaceMock();
    this.commands = this.createCommandsMock();
    this.Uri = this.createUriMock();
  }

  private createWindowMock(): VSCodeWindow {
    return {
      showInformationMessage: jest.fn().mockImplementation((message: string, ...items: string[]) => {
        this.recordCall('window.showInformationMessage', [message, ...items]);
        return Promise.resolve(items[0]);
      }),
      
      showWarningMessage: jest.fn().mockImplementation((message: string, ...items: string[]) => {
        this.recordCall('window.showWarningMessage', [message, ...items]);
        return Promise.resolve(items[0]);
      }),
      
      showErrorMessage: jest.fn().mockImplementation((message: string, ...items: string[]) => {
        this.recordCall('window.showErrorMessage', [message, ...items]);
        return Promise.resolve(items[0]);
      }),
      
      showQuickPick: jest.fn().mockImplementation((items: any[], options?: any) => {
        this.recordCall('window.showQuickPick', [items, options]);
        return Promise.resolve(Array.isArray(items) ? items[0] : undefined);
      }),
      
      showInputBox: jest.fn().mockImplementation((options?: any) => {
        this.recordCall('window.showInputBox', [options]);
        return Promise.resolve('mock-input');
      }),
      
      showOpenDialog: jest.fn().mockImplementation((options?: any) => {
        this.recordCall('window.showOpenDialog', [options]);
        return Promise.resolve([{ fsPath: '/mock/path/file.txt' }]);
      }),
      
      showSaveDialog: jest.fn().mockImplementation((options?: any) => {
        this.recordCall('window.showSaveDialog', [options]);
        return Promise.resolve({ fsPath: '/mock/path/save.txt' });
      }),
      
      createStatusBarItem: jest.fn().mockImplementation((alignment?: number, priority?: number) => {
        this.recordCall('window.createStatusBarItem', [alignment, priority]);
        const item: MockStatusBarItem = {
          text: '',
          tooltip: '',
          color: '',
          command: '',
          alignment: alignment || 1,
          priority: priority || 0,
          show: jest.fn(),
          hide: jest.fn(),
          dispose: jest.fn()
        };
        this._statusBarItems.push(item);
        return item;
      }),
      
      createOutputChannel: jest.fn().mockImplementation((name: string) => {
        this.recordCall('window.createOutputChannel', [name]);
        const channel: MockOutputChannel = {
          name,
          append: jest.fn(),
          appendLine: jest.fn(),
          clear: jest.fn(),
          show: jest.fn(),
          hide: jest.fn(),
          dispose: jest.fn()
        };
        this._outputChannels.push(channel);
        return channel;
      }),
      
      createWebviewPanel: jest.fn().mockImplementation((viewType: string, title: string, showOptions: any, options?: any) => {
        this.recordCall('window.createWebviewPanel', [viewType, title, showOptions, options]);
        const panel: MockWebviewPanel = {
          webview: {
            html: '',
            postMessage: jest.fn(),
            onDidReceiveMessage: jest.fn()
          },
          onDidDispose: jest.fn(),
          dispose: jest.fn(),
          reveal: jest.fn(),
          title,
          visible: true,
          active: true
        };
        this._webviewPanels.push(panel);
        return panel;
      }),
      
      registerCustomEditorProvider: jest.fn().mockImplementation((viewType: string, provider: any, options?: any) => {
        this.recordCall('window.registerCustomEditorProvider', [viewType, provider, options]);
        return { dispose: jest.fn() };
      })
    };
  }

  private createWorkspaceMock(): VSCodeWorkspace {
    return {
      workspaceFolders: [
        { uri: { fsPath: '/mock/workspace' }, name: 'mock-workspace', index: 0 }
      ],
      
      getConfiguration: jest.fn().mockImplementation((section?: string) => {
        this.recordCall('workspace.getConfiguration', [section]);
        return {
          get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
            const fullKey = section ? `${section}.${key}` : key;
            return this._configuration[fullKey] || defaultValue;
          }),
          update: jest.fn().mockImplementation((key: string, value: any) => {
            const fullKey = section ? `${section}.${key}` : key;
            this._configuration[fullKey] = value;
            return Promise.resolve();
          }),
          has: jest.fn().mockImplementation((key: string) => {
            const fullKey = section ? `${section}.${key}` : key;
            return this._configuration.hasOwnProperty(fullKey);
          }),
          inspect: jest.fn().mockImplementation((key: string) => {
            const fullKey = section ? `${section}.${key}` : key;
            return { key: fullKey, defaultValue: undefined, globalValue: this._configuration[fullKey] };
          })
        };
      }),
      
      createFileSystemWatcher: jest.fn().mockImplementation((globPattern: string) => {
        this.recordCall('workspace.createFileSystemWatcher', [globPattern]);
        return {
          onDidCreate: jest.fn(),
          onDidChange: jest.fn(),
          onDidDelete: jest.fn(),
          dispose: jest.fn()
        };
      }),
      
      findFiles: jest.fn().mockImplementation((include: string, exclude?: string, maxResults?: number) => {
        this.recordCall('workspace.findFiles', [include, exclude, maxResults]);
        return Promise.resolve([{ fsPath: '/mock/path/found.txt' }]);
      }),
      
      openTextDocument: jest.fn().mockImplementation((uri: any) => {
        this.recordCall('workspace.openTextDocument', [uri]);
        return Promise.resolve({
          uri,
          fileName: '/mock/document.txt',
          languageId: 'plaintext',
          lineCount: 10,
          getText: jest.fn().mockReturnValue('mock text content'),
          lineAt: jest.fn().mockReturnValue({ text: 'mock line' }),
          save: jest.fn().mockResolvedValue(true),
          isDirty: false,
          isClosed: false
        });
      }),
      
      saveAll: jest.fn().mockImplementation((includeUntitled?: boolean) => {
        this.recordCall('workspace.saveAll', [includeUntitled]);
        return Promise.resolve(true);
      }),
      
      applyEdit: jest.fn().mockImplementation((edit: any) => {
        this.recordCall('workspace.applyEdit', [edit]);
        return Promise.resolve(true);
      }),
      
      onDidChangeConfiguration: jest.fn().mockImplementation((listener: Function) => {
        this.recordCall('workspace.onDidChangeConfiguration', [listener]);
        return { dispose: jest.fn() };
      }),
      
      onDidChangeWorkspaceFolders: jest.fn().mockImplementation((listener: Function) => {
        this.recordCall('workspace.onDidChangeWorkspaceFolders', [listener]);
        return { dispose: jest.fn() };
      })
    };
  }

  private createCommandsMock(): VSCodeCommands {
    return {
      registerCommand: jest.fn().mockImplementation((command: string, callback: Function) => {
        this.recordCall('commands.registerCommand', [command, callback]);
        this._registeredCommands.set(command, callback);
        return { dispose: jest.fn() };
      }),
      
      executeCommand: jest.fn().mockImplementation((command: string, ...args: any[]) => {
        this.recordCall('commands.executeCommand', [command, ...args]);
        const handler = this._registeredCommands.get(command);
        if (handler) {
          return handler(...args);
        }
        return Promise.resolve();
      }),
      
      getCommands: jest.fn().mockImplementation((filterInternal?: boolean) => {
        this.recordCall('commands.getCommands', [filterInternal]);
        return Promise.resolve(Array.from(this._registeredCommands.keys()));
      })
    };
  }

  private createUriMock(): VSCodeUri {
    return {
      file: jest.fn().mockImplementation((path: string) => {
        this.recordCall('Uri.file', [path]);
        return { fsPath: path, scheme: 'file', authority: '', path, query: '', fragment: '' };
      }),
      
      parse: jest.fn().mockImplementation((value: string) => {
        this.recordCall('Uri.parse', [value]);
        return { fsPath: value, scheme: 'file', authority: '', path: value, query: '', fragment: '' };
      })
    };
  }

  // 测试辅助方法
  public setConfiguration(key: string, value: any): void {
    this._configuration[key] = value;
  }

  public getConfiguration(): any {
    return { ...this._configuration };
  }

  public getRegisteredCommands(): string[] {
    return Array.from(this._registeredCommands.keys());
  }

  public executeRegisteredCommand(command: string, ...args: any[]): any {
    const handler = this._registeredCommands.get(command);
    if (handler) {
      return handler(...args);
    }
    throw new Error(`Command '${command}' not registered`);
  }

  public getWebviewPanels(): MockWebviewPanel[] {
    return [...this._webviewPanels];
  }

  public getStatusBarItems(): MockStatusBarItem[] {
    return [...this._statusBarItems];
  }

  public getOutputChannels(): MockOutputChannel[] {
    return [...this._outputChannels];
  }

  public reset(): void {
    super.reset();
    this._webviewPanels = [];
    this._statusBarItems = [];
    this._outputChannels = [];
    this._registeredCommands.clear();
    this._configuration = {};
  }
}

// 创建全局VSCode mock实例
export const vscode = new VSCodeMock();