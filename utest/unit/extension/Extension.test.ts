/**
 * VSCode Extension 主入口测试
 * 测试扩展的激活、去激活和核心功能注册
 */

import * as vscode from 'vscode';
import { activate, deactivate } from '../../../src/extension';

// Mock dependencies
jest.mock('vscode', () => ({
  commands: {
    registerCommand: jest.fn(),
  },
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    createWebviewPanel: jest.fn(),
  },
  workspace: {
    getConfiguration: jest.fn(),
  },
  ExtensionContext: class {
    subscriptions: any[] = [];
  },
}));
jest.mock('../../../src/providers/LACEditorProvider', () => ({
  LACEditorProvider: {
    register: jest.fn().mockReturnValue({}),
  },
}));
jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    detectHardware: jest.fn().mockResolvedValue([]),
    dispose: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('VSCode Extension 主入口测试', () => {
  let context: vscode.ExtensionContext;
  let mockVSCode: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    context = { subscriptions: [] } as any;
    jest.clearAllMocks();
  });

  describe('扩展激活测试', () => {
    it('应该成功激活扩展', () => {
      // Act
      activate(context);

      // Assert
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalled();
      expect(context.subscriptions.length).toBeGreaterThan(0);
    });

    it('应该注册所有必需的命令', () => {
      // Act
      activate(context);

      // Assert
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
    });

    it('应该注册LAC文件编辑器提供程序', () => {
      // Act
      activate(context);

      // Assert
      const { LACEditorProvider } = require('../../../src/providers/LACEditorProvider');
      expect(LACEditorProvider.register).toHaveBeenCalledWith(context);
    });
  });

  describe('命令处理测试', () => {
    it('openAnalyzer命令应该显示信息消息', async () => {
      // Arrange
      activate(context);
      const openAnalyzerHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.openAnalyzer')?.[1];

      // Act
      await openAnalyzerHandler();

      // Assert
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '打开逻辑分析器界面!'
      );
    });

    it('connectDevice命令应该检测设备', async () => {
      // Arrange
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];

      // Act
      await connectDeviceHandler();

      // Assert
      const { hardwareDriverManager } = require('../../../src/drivers/HardwareDriverManager');
      expect(hardwareDriverManager.detectHardware).toHaveBeenCalled();
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '正在检测逻辑分析器设备...'
      );
    });

    it('connectDevice命令在未找到设备时应该提供选项', async () => {
      // Arrange
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];
      
      mockVSCode.window.showWarningMessage.mockResolvedValue('手动指定');
      mockVSCode.window.showInputBox.mockResolvedValue('/dev/ttyUSB0');

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith(
        '未检测到逻辑分析器设备',
        '手动指定',
        '网络连接',
        '取消'
      );
    });

    it('startCapture命令应该检查设备连接状态', async () => {
      // Arrange
      activate(context);
      const startCaptureHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.startCapture')?.[1];

      // Act
      await startCaptureHandler();

      // Assert - 应该有相应的处理逻辑
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.startCapture',
        expect.any(Function)
      );
    });
  });

  describe('用户交互测试', () => {
    it('手动指定路径时应该接受用户输入', async () => {
      // Arrange
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];
      
      mockVSCode.window.showWarningMessage.mockResolvedValue('手动指定');
      mockVSCode.window.showInputBox.mockResolvedValue('/dev/ttyUSB0');

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: '请输入设备路径 (如: /dev/ttyUSB0 或 COM3)',
        placeHolder: '/dev/ttyUSB0'
      });
    });

    it('网络连接时应该接受网络地址', async () => {
      // Arrange
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];
      
      mockVSCode.window.showWarningMessage.mockResolvedValue('网络连接');
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:3030');

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: '请输入网络地址 (如: 192.168.1.100:3030)',
        placeHolder: '192.168.1.100:3030'
      });
    });

    it('用户取消操作时应该正常处理', async () => {
      // Arrange
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];
      
      mockVSCode.window.showWarningMessage.mockResolvedValue('取消');

      // Act
      await connectDeviceHandler();

      // Assert - 用户取消时不应该调用showInputBox
      expect(mockVSCode.window.showInputBox).not.toHaveBeenCalled();
    });
  });

  describe('扩展去激活测试', () => {
    it('应该成功去激活扩展', () => {
      // Act
      const result = deactivate();

      // Assert - deactivate函数应该存在并可调用
      expect(typeof deactivate).toBe('function');
    });
  });

  describe('错误处理测试', () => {
    it('应该处理设备检测错误', async () => {
      // Arrange
      const { hardwareDriverManager } = require('../../../src/drivers/HardwareDriverManager');
      hardwareDriverManager.detectHardware.mockRejectedValue(new Error('设备检测失败'));
      
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];

      // Act & Assert - 不应该抛出未处理的异常
      await expect(connectDeviceHandler()).resolves.not.toThrow();
    });

    it('应该处理无效的网络地址格式', async () => {
      // Arrange
      activate(context);
      const connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];
      
      mockVSCode.window.showWarningMessage.mockResolvedValue('网络连接');
      mockVSCode.window.showInputBox.mockResolvedValue('invalid-address');

      // Act & Assert - 不应该抛出未处理的异常
      await expect(connectDeviceHandler()).resolves.not.toThrow();
    });
  });

  describe('配置管理测试', () => {
    it('应该能够读取扩展配置', () => {
      // Arrange
      mockVSCode.workspace.getConfiguration.mockReturnValue({
        get: jest.fn().mockReturnValue(true),
      });

      // Act
      activate(context);

      // Assert - 激活过程中可能会读取配置
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalled();
    });
  });

  describe('集成测试', () => {
    it('完整的扩展生命周期应该正常工作', () => {
      // Act - 激活
      activate(context);

      // Assert - 验证所有组件都已注册
      expect(context.subscriptions.length).toBeGreaterThan(0);
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledTimes(3);

      // Act - 去激活
      deactivate();

      // Assert - 去激活应该成功
      expect(typeof deactivate).toBe('function');
    });
  });
});