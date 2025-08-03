/**
 * VSCode Extension 网络功能简化测试
 * 专门测试扩展中的网络相关功能的基本功能
 */

import * as vscode from 'vscode';

// Mock VSCode API
jest.mock('vscode', () => ({
  commands: {
    registerCommand: jest.fn(),
  },
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showTextDocument: jest.fn(),
  },
  workspace: {
    openTextDocument: jest.fn(),
    getConfiguration: jest.fn(),
  },
  ExtensionContext: class {
    subscriptions: any[] = [];
  },
}));

// Mock 依赖模块
jest.mock('../../../src/providers/LACEditorProvider', () => ({
  LACEditorProvider: {
    register: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    detectHardware: jest.fn().mockResolvedValue([]),
    connectToDevice: jest.fn().mockResolvedValue({ success: true }),
    getCurrentDevice: jest.fn().mockReturnValue(null),
    dispose: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/services/WiFiDeviceDiscovery', () => ({
  WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
    scanForDevices: jest.fn().mockResolvedValue({ devices: [] }),
    stopScan: jest.fn(),
    clearCache: jest.fn(),
  })),
}));

jest.mock('../../../src/services/NetworkStabilityService', () => ({
  NetworkStabilityService: jest.fn().mockImplementation(() => ({
    runDiagnostics: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionQuality: jest.fn().mockReturnValue({ latency: 10, packetLoss: 0 }),
  })),
}));

describe('VSCode Extension 网络功能简化测试', () => {
  let context: vscode.ExtensionContext;
  let mockVSCode: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    context = { subscriptions: [] } as any;
    jest.clearAllMocks();
  });

  describe('扩展激活测试', () => {
    it('应该成功激活扩展并注册网络命令', async () => {
      // 动态导入activate函数
      const { activate } = await import('../../../src/extension');
      
      // Act
      activate(context);

      // Assert
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.scanNetworkDevices',
        expect.any(Function)
      );
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.networkDiagnostics',
        expect.any(Function)
      );
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.configureWiFi',
        expect.any(Function)
      );
    });
  });

  describe('网络设备扫描命令基础测试', () => {
    it('应该注册网络设备扫描命令', async () => {
      const { activate } = await import('../../../src/extension');
      
      // Act
      activate(context);

      // Assert
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.scanNetworkDevices',
        expect.any(Function)
      );
    });

    it('扫描命令应该显示正在扫描信息', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      // 获取扫描命令处理器
      const scanCommand = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      // Act
      await scanCommand();

      // Assert
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '正在扫描网络设备...'
      );
    });
  });

  describe('网络诊断命令基础测试', () => {
    it('应该注册网络诊断命令', async () => {
      const { activate } = await import('../../../src/extension');
      
      // Act
      activate(context);

      // Assert
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.networkDiagnostics',
        expect.any(Function)
      );
    });

    it('诊断命令应该请求用户输入网络地址', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      // 获取诊断命令处理器
      const diagnosticsCommand = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue(null);
      
      // Act
      await diagnosticsCommand();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: '请输入要诊断的网络地址 (如: 192.168.1.100:4045)',
        placeHolder: '192.168.1.100:4045',
      });
    });
  });

  describe('WiFi配置命令基础测试', () => {
    it('应该注册WiFi配置命令', async () => {
      const { activate } = await import('../../../src/extension');
      
      // Act
      activate(context);

      // Assert
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.configureWiFi',
        expect.any(Function)
      );
    });

    it('WiFi配置命令在未连接设备时应该显示警告', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      // 获取WiFi配置命令处理器
      const wifiCommand = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.configureWiFi')?.[1];
      
      // Act
      await wifiCommand();

      // Assert
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith(
        '请先连接到设备'
      );
    });
  });

  describe('扩展去激活测试', () => {
    it('应该成功去激活扩展', async () => {
      const { activate, deactivate } = await import('../../../src/extension');
      
      // 先激活
      activate(context);
      
      // Act - 去激活
      const result = deactivate();

      // Assert
      expect(typeof deactivate).toBe('function');
      // 去激活函数应该可以调用而不抛出异常
    });
  });

  describe('命令注册完整性测试', () => {
    it('应该注册所有预期的网络相关命令', async () => {
      const { activate } = await import('../../../src/extension');
      
      // Act
      activate(context);

      // Assert - 验证注册了6个命令
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledTimes(6);
      
      // 验证基础命令
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.openAnalyzer',
        expect.any(Function)
      );
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.connectDevice',
        expect.any(Function)
      );
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.startCapture',
        expect.any(Function)
      );
      
      // 验证网络相关命令
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.scanNetworkDevices',
        expect.any(Function)
      );
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.networkDiagnostics',
        expect.any(Function)
      );
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.configureWiFi',
        expect.any(Function)
      );
    });

    it('应该将所有命令添加到上下文订阅中', async () => {
      const { activate } = await import('../../../src/extension');
      
      // Act
      activate(context);

      // Assert - 验证订阅列表包含6个命令加1个编辑器提供程序
      expect(context.subscriptions.length).toBe(7);
    });
  });

  describe('错误处理基础测试', () => {
    it('网络扫描命令在异常时不应该崩溃', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      const scanCommand = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      // 模拟WiFi服务异常
      const WiFiDeviceDiscovery = require('../../../src/services/WiFiDeviceDiscovery').WiFiDeviceDiscovery;
      const mockInstance = new WiFiDeviceDiscovery();
      mockInstance.scanForDevices.mockRejectedValue(new Error('网络异常'));
      
      // Act & Assert - 不应该抛出未处理的异常
      await expect(scanCommand()).resolves.not.toThrow();
    });

    it('网络诊断命令在异常时不应该崩溃', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      const diagnosticsCommand = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue('invalid-address');
      
      // Act & Assert - 不应该抛出未处理的异常
      await expect(diagnosticsCommand()).resolves.not.toThrow();
    });
  });
});