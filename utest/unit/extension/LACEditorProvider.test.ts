/**
 * LACEditorProvider 测试
 * 测试.lac文件自定义编辑器的功能
 */

import * as vscode from 'vscode';
import { LACEditorProvider } from '../../../src/providers/LACEditorProvider';

// Mock VSCode API
const mockWebview = {
  html: '',
  options: {},
  postMessage: jest.fn(),
  onDidReceiveMessage: jest.fn(),
  asWebviewUri: jest.fn().mockImplementation((uri) => ({
    ...uri,
    toString: () => uri.path || uri.toString(),
  })),
  cspSource: 'vscode-webview:',
};

const mockWebviewPanel = {
  webview: mockWebview,
  title: 'Test Panel',
  reveal: jest.fn(),
  dispose: jest.fn(),
  onDidDispose: jest.fn(),
  onDidChangeViewState: jest.fn(),
};

const mockDocument = {
  uri: { 
    fsPath: '/test/path/test.lac',
    toString: () => '/test/path/test.lac',
  } as vscode.Uri,
  getText: jest.fn().mockReturnValue('test lac content'),
  save: jest.fn(),
  isDirty: false,
  fileName: 'test.lac',
  languageId: 'lac',
  version: 1,
  eol: vscode.EndOfLine.LF,
  lineCount: 10,
  isClosed: false,
  isUntitled: false,
  positionAt: jest.fn(),
  offsetAt: jest.fn(),
  lineAt: jest.fn(),
  getWordRangeAtPosition: jest.fn(),
  validateRange: jest.fn(),
  validatePosition: jest.fn(),
};

const mockContext = {
  extensionUri: { 
    path: '/test/extension',
    toString: () => '/test/extension',
  } as vscode.Uri,
  subscriptions: [],
  workspaceState: {
    get: jest.fn(),
    update: jest.fn(),
  },
  globalState: {
    get: jest.fn(),
    update: jest.fn(),
  },
  extensionPath: '/test/extension',
  storagePath: '/test/storage',
  globalStoragePath: '/test/global-storage',
  logPath: '/test/log',
} as any;


// Mock dependencies
jest.mock('vscode', () => ({
  window: {
    registerCustomEditorProvider: jest.fn().mockReturnValue({
      dispose: jest.fn(),
    }),
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  },
  Uri: {
    joinPath: jest.fn().mockImplementation((...paths) => ({
      path: paths.join('/'),
      toString: () => paths.join('/'),
    })),
  },
  workspace: {
    fs: {
      writeFile: jest.fn(),
      readFile: jest.fn(),
    },
    applyEdit: jest.fn(),
    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  },
  WorkspaceEdit: jest.fn().mockImplementation(() => ({
    replace: jest.fn(),
  })),
  Range: jest.fn().mockImplementation((start, end) => ({ start, end })),
  Position: jest.fn().mockImplementation((line, character) => ({ line, character })),
  EndOfLine: {
    LF: 1,
    CRLF: 2,
  },
}));

describe('LACEditorProvider 测试', () => {
  let provider: LACEditorProvider;
  let mockVSCode: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    provider = new (LACEditorProvider as any)(mockContext);
    jest.clearAllMocks();
  });

  describe('静态方法测试', () => {
    it('register方法应该注册自定义编辑器提供程序', () => {
      // Act
      const disposable = LACEditorProvider.register(mockContext);

      // Assert
      expect(mockVSCode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
        'logicAnalyzer.lacEditor',
        expect.any(LACEditorProvider)
      );
      expect(disposable).toHaveProperty('dispose');
    });
  });

  describe('构造函数测试', () => {
    it('应该正确初始化', () => {
      // Act
      const newProvider = new (LACEditorProvider as any)(mockContext);

      // Assert
      expect(newProvider).toBeInstanceOf(LACEditorProvider);
    });
  });

  describe('resolveCustomTextEditor 测试', () => {
    it('应该设置webview选项', async () => {
      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      expect(mockWebviewPanel.webview.options).toEqual({
        enableScripts: true,
        localResourceRoots: [expect.objectContaining({
          path: expect.stringContaining('/test/extension/out/webview'),
        })],
      });
    });

    it('应该设置webview的HTML内容', async () => {
      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      expect(mockWebviewPanel.webview.html).toBeTruthy();
      expect(typeof mockWebviewPanel.webview.html).toBe('string');
    });

    it('应该注册消息处理器', async () => {
      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      expect(mockWebviewPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });

  describe('消息处理测试', () => {
    let messageHandler: (message: any) => Promise<void>;

    beforeEach(async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );
      
      messageHandler = mockWebviewPanel.webview.onDidReceiveMessage.mock.calls[0][0];
    });

    it('应该处理ready消息', async () => {
      // Arrange
      const readyMessage = { type: 'ready' };

      // Act
      await messageHandler(readyMessage);

      // Assert
      expect(mockWebview.postMessage).toHaveBeenCalled();
    });

    it('应该处理save消息', async () => {
      // Arrange
      const saveMessage = {
        type: 'save',
        data: { content: 'updated lac content' },
      };
      mockVSCode.workspace.applyEdit.mockResolvedValue(true);

      // Act
      await messageHandler(saveMessage);

      // Assert
      expect(mockVSCode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('应该处理load消息', async () => {
      // Arrange
      const loadMessage = { type: 'load' };

      // Act
      await messageHandler(loadMessage);

      // Assert
      expect(mockWebview.postMessage).toHaveBeenCalled();
    });

    it('应该处理export消息', async () => {
      // Arrange
      const exportMessage = {
        type: 'export',
        data: { format: 'csv', filename: 'test.csv' },
      };

      // Act
      await messageHandler(exportMessage);

      // Assert - 应该有相应的处理，至少不抛出异常
      expect(messageHandler).toBeDefined();
    });

    it('应该处理未知消息类型', async () => {
      // Arrange
      const unknownMessage = { type: 'unknown' };

      // Act & Assert - 不应该抛出异常
      await expect(messageHandler(unknownMessage)).resolves.not.toThrow();
    });
  });

  describe('HTML生成测试', () => {
    it('生成的HTML应该包含必要的脚本和样式', async () => {
      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      const html = mockWebviewPanel.webview.html;
      expect(html).toContain('<script');
      expect(html).toContain('<link'); // 源代码使用 <link> 而不是 <style>
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('生成的HTML应该正确设置CSP', async () => {
      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      const html = mockWebviewPanel.webview.html;
      expect(html).toContain('Content-Security-Policy');
    });

    it('生成的HTML应该包含Vue应用容器', async () => {
      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      const html = mockWebviewPanel.webview.html;
      expect(html).toContain('<div id="app">');
    });
  });

  describe('文件操作测试', () => {
    let messageHandler: (message: any) => Promise<void>;

    beforeEach(async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );
      
      messageHandler = mockWebviewPanel.webview.onDidReceiveMessage.mock.calls[0][0];
    });

    it('应该能够保存LAC文件', async () => {
      // Arrange
      const saveMessage = {
        type: 'save',
        data: {
          channels: [{ id: 0, name: 'CH0', samples: [] }],
          sampleRate: 24000000,
          totalSamples: 1000,
        },
      };
      mockVSCode.workspace.applyEdit.mockResolvedValue(true);

      // Act
      await messageHandler(saveMessage);

      // Assert
      expect(mockVSCode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('保存失败时应该显示错误消息', async () => {
      // Arrange
      const saveMessage = {
        type: 'save',
        data: { content: 'test' },
      };
      mockVSCode.workspace.applyEdit.mockRejectedValue(new Error('保存失败'));

      // Act
      await messageHandler(saveMessage);

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('应该能够加载LAC文件内容', async () => {
      // Arrange
      const loadMessage = { type: 'load' };
      mockDocument.getText.mockReturnValue(JSON.stringify({
        version: '1.0',
        channels: [],
      }));

      // Act
      await messageHandler(loadMessage);

      // Assert
      expect(mockWebview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'documentLoaded',
        })
      );
    });
  });

  describe('错误处理测试', () => {
    it('应该处理无效的LAC文件格式', async () => {
      // Arrange
      mockDocument.getText.mockReturnValue('invalid json content');

      let messageHandler: (message: any) => Promise<void>;
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );
      
      messageHandler = mockWebviewPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Act & Assert
      await expect(messageHandler({ type: 'load' })).resolves.not.toThrow();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('应该处理webview消息发送失败', async () => {
      // Arrange
      mockWebview.postMessage.mockRejectedValue(new Error('消息发送失败'));
      
      let messageHandler: (message: any) => Promise<void>;
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );
      
      messageHandler = mockWebviewPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Act & Assert
      await expect(messageHandler({ type: 'ready' })).resolves.not.toThrow();
    });
  });

  describe('性能测试', () => {
    it('编辑器初始化应该在合理时间内完成', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );

      // Assert
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('大文件处理应该有效率', async () => {
      // Arrange
      const largeLACContent = JSON.stringify({
        channels: Array.from({ length: 24 }, (_, i) => ({
          id: i,
          name: `CH${i}`,
          samples: new Array(100000).fill(0),
        })),
      });
      mockDocument.getText.mockReturnValue(largeLACContent);

      let messageHandler: (message: any) => Promise<void>;
      await provider.resolveCustomTextEditor(
        mockDocument as any,
        mockWebviewPanel as any,
        {} as vscode.CancellationToken
      );
      
      messageHandler = mockWebviewPanel.webview.onDidReceiveMessage.mock.calls[0][0];

      // Act
      const startTime = Date.now();
      await messageHandler({ type: 'load' });
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(5000); // 大文件处理应该在5秒内完成
    });
  });
});