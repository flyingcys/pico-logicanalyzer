/**
 * VSCode Extension 网络功能增强测试
 * 专门测试扩展中的网络相关功能，提升代码覆盖率
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
    detectHardware: jest.fn(),
    connectToDevice: jest.fn(),
    getCurrentDevice: jest.fn(),
    dispose: jest.fn(),
  },
}));

jest.mock('../../../src/services/WiFiDeviceDiscovery', () => ({
  WiFiDeviceDiscovery: jest.fn().mockImplementation(() => ({
    scanForDevices: jest.fn(),
    stopScan: jest.fn(),
    clearCache: jest.fn(),
  })),
}));

jest.mock('../../../src/services/NetworkStabilityService', () => ({
  NetworkStabilityService: jest.fn().mockImplementation(() => ({
    runDiagnostics: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    getConnectionQuality: jest.fn(),
  })),
}));

describe('VSCode Extension 网络功能增强测试', () => {
  let context: vscode.ExtensionContext;
  let mockVSCode: any;
  let mockHardwareDriverManager: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    const { hardwareDriverManager } = require('../../../src/drivers/HardwareDriverManager');
    mockHardwareDriverManager = hardwareDriverManager;
    
    context = { subscriptions: [] } as any;
    jest.clearAllMocks();
    
    // 设置默认返回值
    mockHardwareDriverManager.detectHardware.mockResolvedValue([]);
    mockHardwareDriverManager.connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'Test Device' } });
    mockHardwareDriverManager.getCurrentDevice.mockReturnValue(null);
    mockHardwareDriverManager.dispose.mockResolvedValue(undefined);
    mockVSCode.workspace.openTextDocument.mockResolvedValue({ uri: 'test://doc' });
  });

  describe('connectDevice 命令深入测试', () => {
    let connectDeviceHandler: () => Promise<void>;

    beforeEach(async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      connectDeviceHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.connectDevice')?.[1];
    });

    it('发现设备时应该显示设备选择列表', async () => {
      // Arrange
      const mockDevices = [
        {
          id: 'device1',
          name: 'Logic Analyzer Pro',
          type: 'USB',
          connectionPath: '/dev/ttyUSB0',
          confidence: 0.95
        },
        {
          id: 'device2', 
          name: 'Network Analyzer',
          type: 'Network',
          connectionPath: 'tcp://192.168.1.100:4045',
          confidence: 0.8
        }
      ];
      mockHardwareDriverManager.detectHardware.mockResolvedValue(mockDevices);
      mockVSCode.window.showQuickPick.mockResolvedValue({
        device: mockDevices[0]
      });

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Logic Analyzer Pro',
            description: 'USB - /dev/ttyUSB0',
            detail: '置信度: 95%'
          }),
          expect.objectContaining({
            label: 'Network Analyzer',
            description: 'Network - tcp://192.168.1.100:4045',
            detail: '置信度: 80%'
          }),
          expect.objectContaining({
            label: '$(broadcast) 自动检测',
            description: '自动选择最佳匹配设备'
          }),
          expect.objectContaining({
            label: '$(globe) 网络连接',
            description: '连接网络逻辑分析器'
          })
        ]),
        expect.objectContaining({
          placeHolder: '选择要连接的逻辑分析器设备',
          matchOnDescription: true,
          matchOnDetail: true
        })
      );
    });

    it('选择自动检测设备时应该连接', async () => {
      // Arrange
      const mockDevices = [
        { id: 'device1', name: 'Test Device', type: 'USB', connectionPath: '/dev/ttyUSB0', confidence: 0.95 }
      ];
      mockHardwareDriverManager.detectHardware.mockResolvedValue(mockDevices);
      mockVSCode.window.showQuickPick.mockResolvedValue({
        device: { id: 'autodetect', name: '自动检测', type: 'Auto', connectionPath: '', confidence: 1 }
      });

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockHardwareDriverManager.connectToDevice).toHaveBeenCalledWith('autodetect');
    });

    it('选择网络连接时应该请求网络地址', async () => {
      // Arrange
      const mockDevices = [];
      mockHardwareDriverManager.detectHardware.mockResolvedValue(mockDevices);
      mockVSCode.window.showWarningMessage.mockResolvedValue('网络连接');
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: '请输入网络地址 (如: 192.168.1.100:3030)',
        placeHolder: '192.168.1.100:3030'
      });
    });

    it('手动指定设备路径时应该接受输入', async () => {
      // Arrange
      mockHardwareDriverManager.detectHardware.mockResolvedValue([]);
      mockVSCode.window.showWarningMessage.mockResolvedValue('手动指定');
      mockVSCode.window.showInputBox.mockResolvedValue('/dev/ttyUSB1');

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: '请输入设备路径 (如: /dev/ttyUSB0 或 COM3)',
        placeHolder: '/dev/ttyUSB0'
      });
      expect(mockHardwareDriverManager.connectToDevice).toHaveBeenCalledWith('/dev/ttyUSB1');
    });

    it('用户取消选择时应该正常返回', async () => {
      // Arrange
      mockHardwareDriverManager.detectHardware.mockResolvedValue([]);
      mockVSCode.window.showWarningMessage.mockResolvedValue('取消');

      // Act
      await connectDeviceHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).not.toHaveBeenCalled();
      expect(mockHardwareDriverManager.connectToDevice).not.toHaveBeenCalled();
    });
  });

  describe('网络设备扫描命令完整测试', () => {
    let scanNetworkDevicesHandler: () => Promise<void>;
    let mockWiFiService: any;
    let mockNetworkService: any;

    beforeEach(async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      scanNetworkDevicesHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      // 获取服务实例
      const WiFiDeviceDiscovery = require('../../../src/services/WiFiDeviceDiscovery').WiFiDeviceDiscovery;
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      mockWiFiService = new WiFiDeviceDiscovery();
      mockNetworkService = new NetworkStabilityService();
    });

    it('发现多个设备时应该正确显示设备列表', async () => {
      // Arrange
      const mockDevices = [
        {
          deviceName: 'Logic Analyzer 1',
          ipAddress: '192.168.1.100',
          port: 4045,
          version: '1.0.0',
          responseTime: 50
        },
        {
          deviceName: 'Logic Analyzer 2',
          ipAddress: '192.168.1.101',
          port: 4045,
          version: '1.1.0',
          responseTime: 75
        }
      ];
      mockWiFiService.scanForDevices.mockResolvedValue({ devices: mockDevices });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevices[0] });
      mockNetworkService.connect.mockResolvedValue(true);
      mockHardwareDriverManager.connectToDevice.mockResolvedValue({
        success: true,
        deviceInfo: { name: 'Connected Device' }
      });
      mockNetworkService.getConnectionQuality.mockReturnValue({ latency: 10, packetLoss: 0 });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockWiFiService.scanForDevices).toHaveBeenCalledWith({
        timeout: 5000,
        concurrency: 30,
        deepScan: true,
        enableBroadcast: true
      });
      expect(mockNetworkService.connect).toHaveBeenCalledWith('192.168.1.100', 4045);
      expect(mockHardwareDriverManager.connectToDevice).toHaveBeenCalledWith('network', {
        networkConfig: { host: '192.168.1.100', port: 4045 }
      });
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '网络设备连接成功: Connected Device'
      );
    });

    it('网络连接失败时应该显示错误并断开', async () => {
      // Arrange
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045
      };
      mockWiFiService.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkService.connect.mockResolvedValue(false);

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '无法连接到网络设备: 192.168.1.100:4045'
      );
    });

    it('硬件驱动连接失败时应该断开网络连接', async () => {
      // Arrange
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045
      };
      mockWiFiService.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkService.connect.mockResolvedValue(true);
      mockHardwareDriverManager.connectToDevice.mockResolvedValue({
        success: false,
        error: '设备不兼容'
      });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockNetworkService.disconnect).toHaveBeenCalled();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络设备连接失败: 设备不兼容'
      );
    });

    it('处理设备信息缺失的情况', async () => {
      // Arrange
      const mockDevice = {
        deviceName: undefined,
        ipAddress: '192.168.1.100',
        port: 4045,
        version: undefined,
        responseTime: 50
      };
      mockWiFiService.scanForDevices.mockResolvedValue({ devices: [mockDevice] });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Unknown Device',
            description: '192.168.1.100:4045',
            detail: 'Unknown Version - 响应时间: 50ms'
          })
        ]),
        expect.any(Object)
      );
    });
  });

  describe('网络诊断命令完整测试', () => {
    let networkDiagnosticsHandler: () => Promise<void>;
    let mockNetworkService: any;

    beforeEach(async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      networkDiagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      mockNetworkService = new NetworkStabilityService();
    });

    it('应该正确运行诊断并生成报告', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      const mockDiagnostics = [
        { testName: 'Ping测试', passed: true, details: '延迟: 10ms' },
        { testName: '端口连接测试', passed: true, details: '连接成功' },
        { testName: '协议测试', passed: false, details: '协议版本不匹配' }
      ];
      mockNetworkService.runDiagnostics.mockResolvedValue(mockDiagnostics);
      const mockDocument = { uri: 'test://diagnostic-report' };
      mockVSCode.workspace.openTextDocument.mockResolvedValue(mockDocument);

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockNetworkService.runDiagnostics).toHaveBeenCalledWith('192.168.1.100', 4045);
      expect(mockVSCode.workspace.openTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('网络诊断报告 - 192.168.1.100:4045'),
          language: 'plaintext'
        })
      );
      
      const content = mockVSCode.workspace.openTextDocument.mock.calls[0][0].content;
      expect(content).toContain('Ping测试: ✅ 通过 - 延迟: 10ms');
      expect(content).toContain('端口连接测试: ✅ 通过 - 连接成功');
      expect(content).toContain('协议测试: ❌ 失败 - 协议版本不匹配');
      expect(mockVSCode.window.showTextDocument).toHaveBeenCalledWith(mockDocument);
    });

    it('应该处理各种无效的网络地址格式', async () => {
      const invalidAddresses = [
        'invalid-format',
        '192.168.1.100',  // 缺少端口
        ':4045',          // 缺少主机
        'host:invalid',   // 端口不是数字
        'host:0',         // 端口号太小
        'host:70000'      // 端口号太大
      ];

      for (const address of invalidAddresses) {
        mockVSCode.window.showInputBox.mockResolvedValue(address);
        jest.clearAllMocks();

        // Act
        await networkDiagnosticsHandler();

        // Assert
        expect(mockVSCode.window.showErrorMessage).toHaveBeenCalled();
        expect(mockNetworkService.runDiagnostics).not.toHaveBeenCalled();
      }
    });
  });

  describe('WiFi配置命令完整测试', () => {
    let configureWiFiHandler: () => Promise<void>;
    let mockCurrentDevice: any;

    beforeEach(async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      configureWiFiHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.configureWiFi')?.[1];
      
      mockCurrentDevice = {
        sendNetworkConfig: jest.fn().mockResolvedValue(true)
      };
    });

    it('应该正确收集WiFi配置并发送到设备', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')   // SSID
        .mockResolvedValueOnce('mypassword123')   // Password
        .mockResolvedValueOnce('192.168.1.100')  // IP Address
        .mockResolvedValueOnce('4045');           // Port

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockCurrentDevice.sendNetworkConfig).toHaveBeenCalledWith(
        'MyWiFiNetwork',
        'mypassword123',
        '192.168.1.100',
        4045
      );
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        'WiFi配置已发送成功！设备将重启并连接到WiFi网络。'
      );
    });

    it('使用DHCP时应该发送0.0.0.0作为IP地址', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword123')
        .mockResolvedValueOnce('')  // 空IP表示DHCP
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockCurrentDevice.sendNetworkConfig).toHaveBeenCalledWith(
        'MyWiFiNetwork',
        'mypassword123',
        '0.0.0.0',  // DHCP
        4045
      );
    });

    it('应该验证端口号范围', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword123')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert - 获取端口验证函数
      const portValidator = mockVSCode.window.showInputBox.mock.calls[3][0].validateInput;
      
      // 测试有效端口
      expect(portValidator('4045')).toBeNull();
      expect(portValidator('8080')).toBeNull();
      expect(portValidator('1024')).toBeNull();
      expect(portValidator('65535')).toBeNull();
      
      // 测试无效端口
      expect(portValidator('abc')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('100')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('70000')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('1023')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('65536')).toBe('端口号必须在1024-65535之间');
    });

    it('配置发送失败时应该显示错误', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockCurrentDevice.sendNetworkConfig.mockResolvedValue(false);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword123')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        'WiFi配置发送失败'
      );
    });

    it('配置发送异常时应该显示错误', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockCurrentDevice.sendNetworkConfig.mockRejectedValue(new Error('设备通信失败'));
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword123')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        'WiFi配置失败: Error: 设备通信失败'
      );
    });

    it('用户取消输入时应该在各个步骤正确退出', async () => {
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      
      // 测试在SSID输入时取消
      mockVSCode.window.showInputBox.mockResolvedValueOnce(undefined);
      await configureWiFiHandler();
      expect(mockCurrentDevice.sendNetworkConfig).not.toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      // 测试在密码输入时取消
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce(undefined);
      await configureWiFiHandler();
      expect(mockCurrentDevice.sendNetworkConfig).not.toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      // 测试在端口输入时取消
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('password')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(undefined);
      await configureWiFiHandler();
      expect(mockCurrentDevice.sendNetworkConfig).not.toHaveBeenCalled();
    });
  });

  describe('扩展生命周期完整测试', () => {
    it('去激活时应该正确清理所有网络服务', async () => {
      // Arrange
      const { activate, deactivate } = await import('../../../src/extension');
      activate(context);
      
      // 获取服务实例  
      const WiFiDeviceDiscovery = require('../../../src/services/WiFiDeviceDiscovery').WiFiDeviceDiscovery;
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      const mockWiFiService = new WiFiDeviceDiscovery();
      const mockNetworkService = new NetworkStabilityService();

      // Act
      deactivate();

      // Assert
      expect(mockWiFiService.stopScan).toHaveBeenCalled();
      expect(mockWiFiService.clearCache).toHaveBeenCalled();
      expect(mockNetworkService.disconnect).toHaveBeenCalled();
      expect(mockHardwareDriverManager.dispose).toHaveBeenCalled();
    });

    it('去激活时应该处理清理异常而不崩溃', async () => {
      // Arrange
      const { activate, deactivate } = await import('../../../src/extension');
      activate(context);
      
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      const mockNetworkService = new NetworkStabilityService();
      mockNetworkService.disconnect.mockRejectedValue(new Error('清理失败'));
      mockHardwareDriverManager.dispose.mockRejectedValue(new Error('驱动清理失败'));

      // Act & Assert - 不应该抛出异常
      expect(() => deactivate()).not.toThrow();
    });
  });

  describe('复杂错误场景测试', () => {
    it('应该处理网络连接中的各种异常', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045
      };
      
      const WiFiDeviceDiscovery = require('../../../src/services/WiFiDeviceDiscovery').WiFiDeviceDiscovery;
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      const mockWiFiService = new WiFiDeviceDiscovery();
      const mockNetworkService = new NetworkStabilityService();
      
      mockWiFiService.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkService.connect.mockRejectedValue(new Error('网络连接异常'));

      // Act & Assert
      await expect(scanHandler()).resolves.not.toThrow();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络设备连接异常: Error: 网络连接异常'
      );
    });

    it('应该处理诊断报告创建失败', async () => {
      const { activate } = await import('../../../src/extension');
      activate(context);
      
      const diagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      const mockNetworkService = new NetworkStabilityService();
      mockNetworkService.runDiagnostics.mockResolvedValue([]);
      mockVSCode.workspace.openTextDocument.mockRejectedValue(new Error('文档创建失败'));

      // Act & Assert
      await expect(diagnosticsHandler()).resolves.not.toThrow();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络诊断失败: Error: 文档创建失败'
      );
    });
  });
});