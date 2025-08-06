/**
 * VSCode Extension 网络功能测试
 * 专门测试扩展中的网络相关功能：设备扫描、网络诊断、WiFi配置等
 * 
 * 测试覆盖范围：
 * - 网络设备扫描命令 (scanNetworkDevices)
 * - 网络诊断命令 (networkDiagnostics) 
 * - WiFi配置命令 (configureWiFi)
 * - 网络地址解析函数 (parseNetworkAddress)
 * - 网络设备连接函数 (connectToNetworkDevice)
 * - 错误处理和用户交互场景
 */

import * as vscode from 'vscode';
import { activate, deactivate, ExtensionServices } from '../../../src/extension';

// Mock 网络服务实例将在beforeEach中设置

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

describe('VSCode Extension 网络功能测试', () => {
  let context: vscode.ExtensionContext;
  let mockVSCode: any;
  let mockWiFiDeviceDiscovery: any;
  let mockNetworkStabilityService: any;
  let mockHardwareDriverManager: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    const { hardwareDriverManager } = require('../../../src/drivers/HardwareDriverManager');
    mockHardwareDriverManager = hardwareDriverManager;
    
    // 获取网络服务的 mock 实例
    const { WiFiDeviceDiscovery } = require('../../../src/services/WiFiDeviceDiscovery');
    const { NetworkStabilityService } = require('../../../src/services/NetworkStabilityService');
    mockWiFiDeviceDiscovery = new WiFiDeviceDiscovery();
    mockNetworkStabilityService = new NetworkStabilityService();
    
    context = { subscriptions: [] } as any;
    jest.clearAllMocks();
    
    // 重置所有 mock 函数的默认返回值
    mockHardwareDriverManager.detectHardware.mockResolvedValue([]);
    mockHardwareDriverManager.connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'Test Device' } });
    mockHardwareDriverManager.getCurrentDevice.mockReturnValue(null);
    mockHardwareDriverManager.dispose.mockResolvedValue(undefined);
    mockVSCode.workspace.openTextDocument.mockResolvedValue({ uri: 'test://doc' });
    
    // 设置网络服务的默认返回值
    mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [] });
    mockNetworkStabilityService.runDiagnostics.mockResolvedValue([]);
    mockNetworkStabilityService.connect.mockResolvedValue(true);
    mockNetworkStabilityService.disconnect.mockResolvedValue(undefined);
    mockNetworkStabilityService.getConnectionQuality.mockReturnValue({ score: 0.8 });
  });

  describe('网络设备扫描命令 (scanNetworkDevices)', () => {
    let scanNetworkDevicesHandler: () => Promise<void>;

    beforeEach(() => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      scanNetworkDevicesHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
    });

    it('应该成功注册网络设备扫描命令', () => {
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.scanNetworkDevices',
        expect.any(Function)
      );
    });

    it('应该在扫描开始时显示信息消息', async () => {
      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '正在扫描网络设备...'
      );
    });

    it('应该调用WiFi设备发现服务进行扫描', async () => {
      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockWiFiDeviceDiscovery.scanForDevices).toHaveBeenCalledWith({
        timeout: 5000,
        concurrency: 30,
        deepScan: true,
        enableBroadcast: true,
      });
    });

    it('发现设备时应该显示设备选择列表', async () => {
      // Arrange
      const mockDevices = [
        {
          deviceName: 'Logic Analyzer 1',
          ipAddress: '192.168.1.100',
          port: 4045,
          version: '1.0.0',
          responseTime: 50,
        },
        {
          deviceName: 'Logic Analyzer 2',
          ipAddress: '192.168.1.101',
          port: 4045,
          version: '1.1.0',
          responseTime: 75,
        },
      ];
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: mockDevices });
      mockVSCode.window.showQuickPick.mockResolvedValue({
        device: mockDevices[0],
      });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Logic Analyzer 1',
            description: '192.168.1.100:4045',
            detail: '1.0.0 - 响应时间: 50ms',
          }),
          expect.objectContaining({
            label: 'Logic Analyzer 2',
            description: '192.168.1.101:4045',
            detail: '1.1.0 - 响应时间: 75ms',
          }),
        ]),
        expect.objectContaining({
          placeHolder: '选择要连接的网络设备',
          matchOnDescription: true,
          matchOnDetail: true,
        })
      );
    });

    it('未发现设备时应该显示警告消息', async () => {
      // Arrange
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [] });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith(
        '未发现网络设备'
      );
    });

    it('扫描失败时应该显示错误消息', async () => {
      // Arrange
      mockWiFiDeviceDiscovery.scanForDevices.mockRejectedValue(new Error('网络扫描失败'));

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络设备扫描失败: Error: 网络扫描失败'
      );
    });

    it('选择设备后应该尝试连接', async () => {
      // Arrange
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045,
        version: '1.0.0',
        responseTime: 50,
      };
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkStabilityService.connect.mockResolvedValue(true);
      mockHardwareDriverManager.connectToDevice.mockResolvedValue({
        success: true,
        deviceInfo: { name: 'Connected Device' },
      });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockNetworkStabilityService.connect).toHaveBeenCalledWith('192.168.1.100', 4045);
      expect(mockHardwareDriverManager.connectToDevice).toHaveBeenCalledWith('network', {
        networkConfig: { host: '192.168.1.100', port: 4045 },
      });
    });

    it('处理设备名称缺失的情况', async () => {
      // Arrange
      const mockDevice = {
        deviceName: undefined,
        ipAddress: '192.168.1.100',
        port: 4045,
        version: undefined,
        responseTime: 50,
      };
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [mockDevice] });

      // Act
      await scanNetworkDevicesHandler();

      // Assert
      expect(mockVSCode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Unknown Device',
            description: '192.168.1.100:4045',
            detail: 'Unknown Version - 响应时间: 50ms',
          }),
        ]),
        expect.any(Object)
      );
    });
  });

  describe('网络诊断命令 (networkDiagnostics)', () => {
    let networkDiagnosticsHandler: () => Promise<void>;

    beforeEach(() => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      networkDiagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
    });

    it('应该成功注册网络诊断命令', () => {
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.networkDiagnostics',
        expect.any(Function)
      );
    });

    it('应该请求用户输入网络地址', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue(null);

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledWith({
        prompt: '请输入要诊断的网络地址 (如: 192.168.1.100:4045)',
        placeHolder: '192.168.1.100:4045',
      });
    });

    it('用户取消输入时应该正常返回', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue(undefined);

      // Act & Assert - 不应该抛出异常
      await expect(networkDiagnosticsHandler()).resolves.not.toThrow();
      expect(mockNetworkStabilityService.runDiagnostics).not.toHaveBeenCalled();
    });

    it('应该解析网络地址并运行诊断', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      const mockDiagnostics = [
        { testName: 'Ping测试', passed: true, details: '延迟: 10ms' },
        { testName: '端口连接测试', passed: true, details: '连接成功' },
        { testName: '协议测试', passed: false, details: '协议版本不匹配' },
      ];
      mockNetworkStabilityService.runDiagnostics.mockResolvedValue(mockDiagnostics);

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '正在运行网络诊断...'
      );
      expect(mockNetworkStabilityService.runDiagnostics).toHaveBeenCalledWith('192.168.1.100', 4045);
    });

    it('应该生成诊断报告并显示', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      const mockDiagnostics = [
        { testName: 'Ping测试', passed: true, details: '延迟: 10ms' },
        { testName: '端口连接测试', passed: false, details: '连接超时' },
      ];
      mockNetworkStabilityService.runDiagnostics.mockResolvedValue(mockDiagnostics);
      const mockDocument = { uri: 'test://diagnostic-report' };
      mockVSCode.workspace.openTextDocument.mockResolvedValue(mockDocument);

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockVSCode.workspace.openTextDocument).toHaveBeenCalledWith({
        content: expect.stringContaining('网络诊断报告 - 192.168.1.100:4045'),
        language: 'plaintext',
      });

      const content = mockVSCode.workspace.openTextDocument.mock.calls[0][0].content;
      expect(content).toContain('Ping测试: ✅ 通过 - 延迟: 10ms');
      expect(content).toContain('端口连接测试: ❌ 失败 - 连接超时');
      expect(mockVSCode.window.showTextDocument).toHaveBeenCalledWith(mockDocument);
    });

    it('应该处理无效的网络地址格式', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue('invalid-address');

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('网络诊断失败')
      );
    });

    it('应该处理诊断服务异常', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      mockNetworkStabilityService.runDiagnostics.mockRejectedValue(new Error('诊断服务异常'));

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络诊断失败: Error: 诊断服务异常'
      );
    });

    it('应该正确格式化诊断报告的时间戳', async () => {
      // Arrange
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      mockNetworkStabilityService.runDiagnostics.mockResolvedValue([]);
      
      const mockDate = new Date('2025-08-03T10:30:00');
      const originalDate = global.Date;
      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = originalDate.now;

      // Act
      await networkDiagnosticsHandler();

      // Assert
      const content = mockVSCode.workspace.openTextDocument.mock.calls[0][0].content;
      expect(content).toContain('诊断时间: ' + mockDate.toLocaleString());

      // Cleanup
      global.Date = originalDate;
    });
  });

  describe('WiFi配置命令 (configureWiFi)', () => {
    let configureWiFiHandler: () => Promise<void>;
    let mockCurrentDevice: any;

    beforeEach(() => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      configureWiFiHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.configureWiFi')?.[1];
      
      mockCurrentDevice = {
        sendNetworkConfig: jest.fn().mockResolvedValue(true),
      };
    });

    it('应该成功注册WiFi配置命令', () => {
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledWith(
        'logicAnalyzer.configureWiFi',
        expect.any(Function)
      );
    });

    it('未连接设备时应该显示警告', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(null);

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith(
        '请先连接到设备'
      );
      expect(mockVSCode.window.showInputBox).not.toHaveBeenCalled();
    });

    it('应该按顺序收集WiFi配置信息', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')  // SSID
        .mockResolvedValueOnce('mypassword')     // Password
        .mockResolvedValueOnce('192.168.1.100') // IP Address
        .mockResolvedValueOnce('4045');          // Port

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenNthCalledWith(1, {
        prompt: '请输入WiFi网络名称 (SSID)',
        placeHolder: 'MyWiFiNetwork',
      });
      expect(mockVSCode.window.showInputBox).toHaveBeenNthCalledWith(2, {
        prompt: '请输入WiFi密码',
        password: true,
        placeHolder: '********',
      });
      expect(mockVSCode.window.showInputBox).toHaveBeenNthCalledWith(3, {
        prompt: '请输入静态IP地址 (可选，留空使用DHCP)',
        placeHolder: '192.168.1.100',
      });
      expect(mockVSCode.window.showInputBox).toHaveBeenNthCalledWith(4, {
        prompt: '请输入TCP端口号',
        value: '4045',
        validateInput: expect.any(Function),
      });
    });

    it('应该验证端口号输入', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      const portValidator = mockVSCode.window.showInputBox.mock.calls[3][0].validateInput;
      
      // 测试有效端口
      expect(portValidator('4045')).toBeNull();
      expect(portValidator('8080')).toBeNull();
      
      // 测试无效端口
      expect(portValidator('abc')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('100')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('70000')).toBe('端口号必须在1024-65535之间');
      expect(portValidator('')).toBe('端口号必须在1024-65535之间');
    });

    it('用户取消SSID输入时应该返回', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox.mockResolvedValueOnce(undefined);

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledTimes(1);
      expect(mockCurrentDevice.sendNetworkConfig).not.toHaveBeenCalled();
    });

    it('用户取消密码输入时应该返回', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce(undefined);

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showInputBox).toHaveBeenCalledTimes(2);
      expect(mockCurrentDevice.sendNetworkConfig).not.toHaveBeenCalled();
    });

    it('应该正确发送WiFi配置到设备', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword')
        .mockResolvedValueOnce('192.168.1.100')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockCurrentDevice.sendNetworkConfig).toHaveBeenCalledWith(
        'MyWiFiNetwork',
        'mypassword',
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
        .mockResolvedValueOnce('mypassword')
        .mockResolvedValueOnce('')  // 空IP表示使用DHCP
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockCurrentDevice.sendNetworkConfig).toHaveBeenCalledWith(
        'MyWiFiNetwork',
        'mypassword',
        '0.0.0.0',  // DHCP
        4045
      );
    });

    it('配置失败时应该显示错误消息', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockCurrentDevice.sendNetworkConfig.mockResolvedValue(false);
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        'WiFi配置发送失败'
      );
    });

    it('配置异常时应该显示错误消息', async () => {
      // Arrange
      mockHardwareDriverManager.getCurrentDevice.mockReturnValue(mockCurrentDevice);
      mockCurrentDevice.sendNetworkConfig.mockRejectedValue(new Error('设备通信失败'));
      mockVSCode.window.showInputBox
        .mockResolvedValueOnce('MyWiFiNetwork')
        .mockResolvedValueOnce('mypassword')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('4045');

      // Act
      await configureWiFiHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        'WiFi配置失败: Error: 设备通信失败'
      );
    });
  });

  describe('网络地址解析函数 (parseNetworkAddress)', () => {
    // 由于parseNetworkAddress是extension.ts中的私有函数，我们通过命令处理中的行为来测试它
    
    it('应该正确解析有效的网络地址', async () => {
      // 这个测试通过网络诊断命令间接测试parseNetworkAddress函数
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const networkDiagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      mockNetworkStabilityService.runDiagnostics.mockResolvedValue([]);

      // Act
      await networkDiagnosticsHandler();

      // Assert - 如果地址解析成功，应该调用runDiagnostics
      expect(mockNetworkStabilityService.runDiagnostics).toHaveBeenCalledWith('192.168.1.100', 4045);
    });

    it('应该处理无效的网络地址格式', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const networkDiagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue('invalid:format:address');

      // Act
      await networkDiagnosticsHandler();

      // Assert - 解析失败应该显示错误消息
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalled();
      expect(mockNetworkStabilityService.runDiagnostics).not.toHaveBeenCalled();
    });

    it('应该处理端口号超出范围的情况', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const networkDiagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:70000');

      // Act
      await networkDiagnosticsHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalled();
      expect(mockNetworkStabilityService.runDiagnostics).not.toHaveBeenCalled();
    });
  });

  describe('网络设备连接函数 (connectToNetworkDevice)', () => {
    it('应该建立网络连接并注册到硬件驱动管理器', async () => {
      // 通过网络设备扫描命令间接测试connectToNetworkDevice函数
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045,
      };
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkStabilityService.connect.mockResolvedValue(true);
      mockHardwareDriverManager.connectToDevice.mockResolvedValue({
        success: true,
        deviceInfo: { name: 'Connected Device' },
      });

      // Act
      await scanHandler();

      // Assert
      expect(mockNetworkStabilityService.connect).toHaveBeenCalledWith('192.168.1.100', 4045);
      expect(mockHardwareDriverManager.connectToDevice).toHaveBeenCalledWith('network', {
        networkConfig: { host: '192.168.1.100', port: 4045 },
      });
      expect(mockNetworkStabilityService.getConnectionQuality).toHaveBeenCalled();
    });

    it('网络连接失败时应该显示错误消息', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045,
      };
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkStabilityService.connect.mockResolvedValue(false);

      // Act
      await scanHandler();

      // Assert
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '无法连接到网络设备: 192.168.1.100:4045'
      );
    });

    it('硬件驱动管理器连接失败时应该断开网络连接', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045,
      };
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkStabilityService.connect.mockResolvedValue(true);
      mockHardwareDriverManager.connectToDevice.mockResolvedValue({
        success: false,
        error: '设备不兼容',
      });

      // Act
      await scanHandler();

      // Assert
      expect(mockNetworkStabilityService.disconnect).toHaveBeenCalled();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络设备连接失败: 设备不兼容'
      );
    });
  });

  describe('扩展生命周期与网络服务管理', () => {
    it('无依赖注入时应该初始化真实网络服务', () => {
      // Arrange
      const WiFiDeviceDiscovery = require('../../../src/services/WiFiDeviceDiscovery').WiFiDeviceDiscovery;
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      
      // Act - 不传入services参数，应该创建真实实例
      activate(context);

      // Assert - 验证网络服务构造函数被调用
      expect(WiFiDeviceDiscovery).toHaveBeenCalled();
      expect(NetworkStabilityService).toHaveBeenCalled();
    });

    it('使用依赖注入时应该使用提供的服务实例', () => {
      // Arrange
      const WiFiDeviceDiscovery = require('../../../src/services/WiFiDeviceDiscovery').WiFiDeviceDiscovery;
      const NetworkStabilityService = require('../../../src/services/NetworkStabilityService').NetworkStabilityService;
      WiFiDeviceDiscovery.mockClear();
      NetworkStabilityService.mockClear();
      
      // Act - 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);

      // Assert - 使用依赖注入时构造函数不应该被调用
      expect(WiFiDeviceDiscovery).not.toHaveBeenCalled();
      expect(NetworkStabilityService).not.toHaveBeenCalled();
    });

    it('去激活时应该清理网络服务', () => {
      // Arrange
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);

      // Act
      deactivate();

      // Assert
      expect(mockWiFiDeviceDiscovery.stopScan).toHaveBeenCalled();
      expect(mockWiFiDeviceDiscovery.clearCache).toHaveBeenCalled();
      expect(mockNetworkStabilityService.disconnect).toHaveBeenCalled();
      expect(mockHardwareDriverManager.dispose).toHaveBeenCalled();
    });

    it('去激活时应该处理网络服务清理异常', () => {
      // Arrange
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      mockNetworkStabilityService.disconnect.mockRejectedValue(new Error('清理失败'));
      mockHardwareDriverManager.dispose.mockRejectedValue(new Error('驱动清理失败'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act & Assert - 不应该抛出异常
      expect(() => deactivate()).not.toThrow();
      
      // Cleanup
      consoleSpy.mockRestore();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空设备列表', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [] });

      // Act
      await scanHandler();

      // Assert
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith('未发现网络设备');
      expect(mockVSCode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('应该处理用户取消设备选择', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({
        devices: [{ deviceName: 'Test', ipAddress: '192.168.1.100', port: 4045 }],
      });
      mockVSCode.window.showQuickPick.mockResolvedValue(undefined);

      // Act & Assert - 不应该抛出异常
      await expect(scanHandler()).resolves.not.toThrow();
      expect(mockNetworkStabilityService.connect).not.toHaveBeenCalled();
    });

    it('应该处理网络连接异常', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      const mockDevice = {
        deviceName: 'Test Device',
        ipAddress: '192.168.1.100',
        port: 4045,
      };
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: [mockDevice] });
      mockVSCode.window.showQuickPick.mockResolvedValue({ device: mockDevice });
      mockNetworkStabilityService.connect.mockRejectedValue(new Error('网络异常'));

      // Act & Assert - 不应该抛出异常
      await expect(scanHandler()).resolves.not.toThrow();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        '网络设备连接异常: Error: 网络异常'
      );
    });

    it('应该处理诊断报告创建失败', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const diagnosticsHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.networkDiagnostics')?.[1];
      
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      mockNetworkStabilityService.runDiagnostics.mockResolvedValue([]);
      mockVSCode.workspace.openTextDocument.mockRejectedValue(new Error('文档创建失败'));

      // Act & Assert - 不应该抛出异常
      await expect(diagnosticsHandler()).resolves.not.toThrow();
      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('性能和资源管理', () => {
    it('网络设备扫描应该在合理时间内完成', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      const startTime = Date.now();
      
      // Act
      await scanHandler();
      
      const endTime = Date.now();
      
      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('大量网络设备处理应该高效', async () => {
      // 使用依赖注入传入Mock服务
      const services: ExtensionServices = {
        wifiDiscoveryService: mockWiFiDeviceDiscovery,
        networkStabilityService: mockNetworkStabilityService,
      };
      activate(context, services);
      const scanHandler = mockVSCode.commands.registerCommand.mock.calls
        .find(call => call[0] === 'logicAnalyzer.scanNetworkDevices')?.[1];
      
      // 创建大量设备
      const largeDeviceList = Array.from({ length: 100 }, (_, i) => ({
        deviceName: `Device ${i}`,
        ipAddress: `192.168.1.${i + 1}`,
        port: 4045,
        version: '1.0.0',
        responseTime: Math.random() * 100,
      }));
      
      mockWiFiDeviceDiscovery.scanForDevices.mockResolvedValue({ devices: largeDeviceList });
      
      const startTime = Date.now();
      
      // Act
      await scanHandler();
      
      const endTime = Date.now();
      
      // Assert
      expect(endTime - startTime).toBeLessThan(2000); // 大量设备处理应该在2秒内完成
      expect(mockVSCode.window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Device 0' }),
          expect.objectContaining({ label: 'Device 99' }),
        ]),
        expect.any(Object)
      );
    });
  });
});