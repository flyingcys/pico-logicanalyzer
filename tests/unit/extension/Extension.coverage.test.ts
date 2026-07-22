/**
 * VSCode Extension 主入口覆盖率补充测试
 *
 * 专注 Extension.test.ts / extension.test.ts 未覆盖的命令处理分支与边界：
 *  - activate 依赖注入
 *  - stopCapture / repeatCapture / scanNetworkDevices / networkDiagnostics
 *  - configureWiFi / createSyntheticCapture / startCapture 命令各分支
 *  - getCaptureConfiguration 的 validateInput、runCaptureWithProgress 内部状态机
 *  - saveCaptureData / createCaptureSession / parseTriggerType / parseNetworkAddress
 *  - deactivate 服务清理
 *
 * Mock 策略照搬 Extension.test.ts：vscode 用 virtual mock，强依赖模块用 jest.mock。
 */

import { activate, deactivate } from '../../../src/extension';
import { CaptureError, TriggerType } from '../../../src/models/AnalyzerTypes';

// ---------------- vscode virtual mock ----------------
jest.mock('vscode', () => ({
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn().mockResolvedValue(undefined),
  },
  window: {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    showSaveDialog: jest.fn().mockResolvedValue(undefined),
    withProgress: jest.fn(),
    showTextDocument: jest.fn(),
    activeTextEditor: undefined as any,
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({ get: jest.fn().mockReturnValue(true) }),
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }] as any,
    fs: { writeFile: jest.fn().mockResolvedValue(undefined) },
    openTextDocument: jest.fn(),
    applyEdit: jest.fn(),
  },
  Uri: {
    file: jest.fn((fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` })),
  },
  ProgressLocation: { Notification: 15 },
}), { virtual: true });

jest.mock('../../../src/providers/LACEditorProvider', () => ({
  LACEditorProvider: { register: jest.fn().mockReturnValue({}) },
}));

jest.mock('../../../src/drivers/HardwareDriverManager', () => ({
  hardwareDriverManager: {
    detectHardware: jest.fn().mockResolvedValue([]),
    connectToDevice: jest.fn().mockResolvedValue({ success: true, deviceInfo: { name: 'Mock Device' } }),
    getCurrentDevice: jest.fn().mockReturnValue(null),
    getCurrentDeviceInfo: jest.fn().mockReturnValue({ name: 'MockDevice' }),
    dispose: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/services/SignalDescriptionLanguage', () => ({
  SignalDescriptionLanguage: {
    generateCaptureSession: jest.fn(),
    getDefaultTemplate: jest.fn().mockReturnValue('default template'),
  },
  SignalDslParseError: class SignalDslParseError extends Error {
    constructor(lineNumber: number, message: string) {
      super(`line ${lineNumber}, column 1: ${message}`);
      this.name = 'SignalDslParseError';
    }
  },
}));

jest.mock('../../../src/models/LACFileFormat', () => ({
  LACFileFormat: {
    save: jest.fn(),
    createFromCaptureSession: jest.fn().mockReturnValue({ Settings: {} }),
  },
}));

// ---------------- 类型/工具 ----------------
type VoidAsync = (...args: any[]) => Promise<any>;

function makeFakeDevice(opts?: {
  stopResult?: boolean;
  startResult?: CaptureError;
  sendResult?: boolean | Promise<boolean>;
  startImpl?: (session: any, handler: any) => Promise<CaptureError>;
}) {
  return {
    stopCapture: jest.fn().mockResolvedValue(opts?.stopResult ?? true),
    startCapture: opts?.startImpl
      ? jest.fn(opts.startImpl)
      : jest.fn().mockResolvedValue(opts?.startResult ?? CaptureError.None),
    sendNetworkConfig: jest.fn().mockResolvedValue(opts?.sendResult ?? true),
  };
}

function makeFakeWifiService() {
  return {
    scanForDevices: jest.fn(),
    stopScan: jest.fn(),
    clearCache: jest.fn(),
  };
}

function makeFakeNetService(opts?: { connectResult?: boolean; diagnostics?: any[] }) {
  return {
    scanForDevices: jest.fn(),
    stopScan: jest.fn(),
    clearCache: jest.fn(),
    connect: jest.fn().mockResolvedValue(opts?.connectResult ?? true),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionQuality: jest.fn().mockReturnValue({ score: 100 }),
    runDiagnostics: jest.fn().mockResolvedValue(opts?.diagnostics ?? [
      { testName: 'TCP连接', passed: true, details: 'ok' },
    ]),
  };
}

describe('VSCode Extension 主入口 — 覆盖率补充', () => {
  let context: any;
  let mockVSCode: any;
  let hardwareDriverManager: any;
  let SignalDescriptionLanguage: any;
  let SignalDslParseErrorCtor: any;
  let LACFileFormat: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVSCode = require('vscode') as any;
    context = { subscriptions: [] };
    mockVSCode.window.activeTextEditor = undefined;

    hardwareDriverManager = require('../../../src/drivers/HardwareDriverManager').hardwareDriverManager;
    hardwareDriverManager.detectHardware.mockResolvedValue([]);
    hardwareDriverManager.connectToDevice.mockResolvedValue({ success: true, deviceInfo: { name: 'Mock Device' } });
    hardwareDriverManager.getCurrentDevice.mockReturnValue(null);
    hardwareDriverManager.getCurrentDeviceInfo.mockReturnValue({ name: 'MockDevice' });
    hardwareDriverManager.dispose.mockResolvedValue(undefined);

    SignalDescriptionLanguage = require('../../../src/services/SignalDescriptionLanguage').SignalDescriptionLanguage;
    SignalDslParseErrorCtor = require('../../../src/services/SignalDescriptionLanguage').SignalDslParseError;
    SignalDescriptionLanguage.generateCaptureSession.mockReset();
    SignalDescriptionLanguage.getDefaultTemplate.mockReturnValue('default template');

    LACFileFormat = require('../../../src/models/LACFileFormat').LACFileFormat;
    LACFileFormat.save.mockReset();
    LACFileFormat.createFromCaptureSession.mockReturnValue({ Settings: {} });

    // 交互类 mock 默认值（覆盖式，清理上一轮残留 implementation）
    mockVSCode.window.showInputBox.mockResolvedValue(undefined);
    mockVSCode.window.showQuickPick.mockResolvedValue(undefined);
    mockVSCode.window.showInformationMessage.mockResolvedValue(undefined);
    mockVSCode.window.showWarningMessage.mockResolvedValue(undefined);
    mockVSCode.window.showErrorMessage.mockReset();
    mockVSCode.window.showSaveDialog.mockResolvedValue(undefined);
    mockVSCode.window.withProgress.mockReset();
    mockVSCode.window.showTextDocument.mockReset();
    mockVSCode.workspace.openTextDocument.mockReset();
    mockVSCode.commands.executeCommand.mockResolvedValue(undefined);
  });

  function getHandler(cmd: string): VoidAsync {
    const call = mockVSCode.commands.registerCommand.mock.calls.find((c: any[]) => c[0] === cmd);
    if (!call) {
      throw new Error(`命令未注册: ${cmd}`);
    }
    return call[1] as VoidAsync;
  }

  // 按 InputBox 调用顺序（freq, pre, post, triggerChannel, activeChannels）序列化返回值
  function driveInputBoxSequence(values: Array<string | undefined>) {
    let i = 0;
    mockVSCode.window.showInputBox.mockImplementation(() => Promise.resolve(values[i++]));
  }

  // 按 prompt 关键字取出某次 InputBox 的 validateInput（手动调用以覆盖校验逻辑）
  function getValidator(promptSubstr: string): (value: string) => string | null {
    for (const call of mockVSCode.window.showInputBox.mock.calls) {
      const opts = call[0];
      if (opts && typeof opts === 'object' && typeof opts.prompt === 'string' && opts.prompt.includes(promptSubstr)) {
        return opts.validateInput;
      }
    }
    throw new Error(`未找到 prompt 含 "${promptSubstr}" 的 InputBox 调用`);
  }

  // ---------------- activate 依赖注入 ----------------
  describe('activate 依赖注入', () => {
    it('注入 wifiDiscoveryService 时 scanNetworkDevices 使用注入实例', async () => {
      const wifi = makeFakeWifiService();
      wifi.scanForDevices.mockResolvedValue({ devices: [] });
      const net = makeFakeNetService();

      activate(context, {
        wifiDiscoveryService: wifi as any,
        networkStabilityService: net as any,
      });

      const handler = getHandler('logicAnalyzer.scanNetworkDevices');
      await handler();

      expect(wifi.scanForDevices).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 5000,
        concurrency: 30,
        deepScan: true,
        enableBroadcast: true,
      }));
      // 注入实例应被复用，deactivate 清理时也调用注入实例方法
      expect(wifi.stopScan).not.toHaveBeenCalled();
      deactivate();
      expect(wifi.stopScan).toHaveBeenCalled();
      expect(wifi.clearCache).toHaveBeenCalled();
    });

    it('不注入服务时使用默认实例（new WiFiDeviceDiscovery / NetworkStabilityService）', () => {
      expect(() => activate(context)).not.toThrow();
      // 注册了全部命令即视为默认实例成功创建
      expect(mockVSCode.commands.registerCommand).toHaveBeenCalledTimes(9);
    });
  });

  // ---------------- stopCapture 命令 ----------------
  describe('stopCapture 命令', () => {
    it('无设备时提示警告', async () => {
      activate(context);
      await getHandler('logicAnalyzer.stopCapture')();
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith('当前没有已连接设备');
    });

    it('设备 stopCapture 返回 true 时提示已停止', async () => {
      const device = makeFakeDevice({ stopResult: true });
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      activate(context);
      await getHandler('logicAnalyzer.stopCapture')();
      expect(device.stopCapture).toHaveBeenCalled();
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith('数据采集已停止');
    });

    it('设备 stopCapture 返回 false 时提示无进行中采集', async () => {
      const device = makeFakeDevice({ stopResult: false });
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      activate(context);
      await getHandler('logicAnalyzer.stopCapture')();
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith('当前没有正在进行的采集');
    });
  });

  // ---------------- repeatCapture 命令（无配置分支，须在任何采集之前执行）----------------
  describe('repeatCapture 命令', () => {
    it('无 lastCaptureConfig 时提示无可重复配置', async () => {
      activate(context);
      await getHandler('logicAnalyzer.repeatCapture')();
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith('没有可重复执行的采集配置');
    });
  });

  // ---------------- scanNetworkDevices 命令 ----------------
  describe('scanNetworkDevices 命令', () => {
    it('未发现设备时提示警告', async () => {
      const wifi = makeFakeWifiService();
      wifi.scanForDevices.mockResolvedValue({ devices: [] });
      activate(context, { wifiDiscoveryService: wifi as any, networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.scanNetworkDevices')();

      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith('正在扫描网络设备...');
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith('未发现网络设备');
    });

    it('发现设备并选中时调用 connectToNetworkDevice', async () => {
      const wifi = makeFakeWifiService();
      wifi.scanForDevices.mockResolvedValue({
        devices: [{
          deviceName: 'LA-01', ipAddress: '192.168.1.50', port: 3030, version: 'v1.0', responseTime: 12,
        }],
      });
      mockVSCode.window.showQuickPick.mockResolvedValue({
        device: { deviceName: 'LA-01', ipAddress: '192.168.1.50', port: 3030, version: 'v1.0', responseTime: 12 },
      });
      activate(context, { wifiDiscoveryService: wifi as any, networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.scanNetworkDevices')();

      expect(hardwareDriverManager.connectToDevice).toHaveBeenCalledWith('network', {
        networkConfig: { host: '192.168.1.50', port: 3030 },
      });
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('网络设备连接成功')
      );
    });

    it('发现设备但用户取消选择时不连接', async () => {
      const wifi = makeFakeWifiService();
      wifi.scanForDevices.mockResolvedValue({
        devices: [{ deviceName: 'X', ipAddress: '10.0.0.1', port: 1, responseTime: 1 }],
      });
      mockVSCode.window.showQuickPick.mockResolvedValue(undefined);
      activate(context, { wifiDiscoveryService: wifi as any, networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.scanNetworkDevices')();

      expect(hardwareDriverManager.connectToDevice).not.toHaveBeenCalled();
    });

    it('扫描抛出异常时显示错误消息', async () => {
      const wifi = makeFakeWifiService();
      wifi.scanForDevices.mockRejectedValue(new Error('网络不可达'));
      activate(context, { wifiDiscoveryService: wifi as any, networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.scanNetworkDevices')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('网络设备扫描失败: 网络不可达');
    });
  });

  // ---------------- networkDiagnostics 命令 ----------------
  describe('networkDiagnostics 命令', () => {
    it('用户取消输入时直接返回', async () => {
      mockVSCode.window.showInputBox.mockResolvedValue(undefined);
      activate(context, { networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.networkDiagnostics')();

      expect(mockVSCode.window.showInformationMessage).not.toHaveBeenCalledWith('正在运行网络诊断...');
    });

    it('合法地址时运行诊断并打开报告文档', async () => {
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:4045');
      const net = makeFakeNetService({
        diagnostics: [{ testName: '延迟', passed: true, details: '5ms' }],
      });
      const doc = { uri: 'doc' };
      mockVSCode.workspace.openTextDocument.mockResolvedValue(doc);
      activate(context, { networkStabilityService: net as any });

      await getHandler('logicAnalyzer.networkDiagnostics')();

      expect(net.runDiagnostics).toHaveBeenCalledWith('192.168.1.100', 4045);
      expect(mockVSCode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ language: 'plaintext' }));
      expect(mockVSCode.window.showTextDocument).toHaveBeenCalledWith(doc);
    });

    it('非法地址（缺少端口）时显示错误消息', async () => {
      mockVSCode.window.showInputBox.mockResolvedValue('invalid-address');
      activate(context, { networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.networkDiagnostics')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('网络诊断失败')
      );
    });

    it('端口超范围时显示错误消息', async () => {
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.1:99999');
      activate(context, { networkStabilityService: makeFakeNetService() as any });

      await getHandler('logicAnalyzer.networkDiagnostics')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('网络诊断失败')
      );
    });
  });

  // ---------------- configureWiFi 命令 ----------------
  describe('configureWiFi 命令', () => {
    function driveWiFiInputs(overrides: { ssid?: string; password?: string; ip?: string; port?: string }) {
      mockVSCode.window.showInputBox.mockImplementation((opts: any) => {
        if (opts.prompt.includes('WiFi网络名称')) return Promise.resolve(overrides.ssid);
        if (opts.prompt.includes('WiFi密码')) return Promise.resolve(overrides.password);
        if (opts.prompt.includes('静态IP')) return Promise.resolve(overrides.ip);
        if (opts.prompt.includes('TCP端口号')) return Promise.resolve(overrides.port);
        return Promise.resolve(undefined);
      });
    }

    it('无设备时提示警告', async () => {
      activate(context);
      await getHandler('logicAnalyzer.configureWiFi')();
      expect(mockVSCode.window.showWarningMessage).toHaveBeenCalledWith('请先连接到设备');
    });

    it('ssid 为空时提前返回', async () => {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: undefined, password: 'p', ip: '', port: '4045' });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      expect(device.sendNetworkConfig).not.toHaveBeenCalled();
    });

    it('password 为空时提前返回', async () => {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: 'net', password: undefined, ip: '', port: '4045' });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      expect(device.sendNetworkConfig).not.toHaveBeenCalled();
    });

    it('端口为空时提前返回', async () => {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: 'net', password: 'p', ip: '', port: undefined });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      expect(device.sendNetworkConfig).not.toHaveBeenCalled();
    });

    it('端口 validateInput 校验非法区间与合法值', async () => {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: 'net', password: 'p', ip: '', port: '4045' });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      const validate = getValidator('TCP端口号');
      expect(validate('1023')).toBe('端口号必须在1024-65535之间');
      expect(validate('65536')).toBe('端口号必须在1024-65535之间');
      expect(validate('abc')).toBe('端口号必须在1024-65535之间');
      expect(validate('4045')).toBeNull();
    });

    it('sendNetworkConfig 成功时提示已发送', async () => {
      const device = makeFakeDevice({ sendResult: true });
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: 'net', password: 'p', ip: '192.168.1.10', port: '4045' });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      expect(device.sendNetworkConfig).toHaveBeenCalledWith('net', 'p', '192.168.1.10', 4045);
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        'WiFi配置已发送成功！设备将重启并连接到WiFi网络。'
      );
    });

    it('sendNetworkConfig 失败时显示错误', async () => {
      const device = makeFakeDevice({ sendResult: false });
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: 'net', password: 'p', ip: '', port: '4045' });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('WiFi配置发送失败');
    });

    it('sendNetworkConfig 抛出异常时显示错误消息', async () => {
      const device = makeFakeDevice({ sendResult: Promise.reject(new Error('硬件错误')) });
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveWiFiInputs({ ssid: 'net', password: 'p', ip: '', port: '4045' });
      activate(context);

      await getHandler('logicAnalyzer.configureWiFi')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('WiFi配置失败: 硬件错误');
    });
  });

  // ---------------- createSyntheticCapture 命令 ----------------
  describe('createSyntheticCapture 命令', () => {
    function fakeSession(total = 1024) {
      return { captureChannels: [{}, {}, {}], totalSamples: total };
    }

    it('无活跃编辑器时使用默认 DSL 模板', async () => {
      mockVSCode.window.activeTextEditor = undefined;
      SignalDescriptionLanguage.generateCaptureSession.mockReturnValue(fakeSession());
      mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: '/out/syn.lac' });
      LACFileFormat.save.mockResolvedValue({ success: true });
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(SignalDescriptionLanguage.generateCaptureSession).toHaveBeenCalledWith('default template');
    });

    it('有活跃编辑器时使用其文档内容（trim 后）', async () => {
      mockVSCode.window.activeTextEditor = { document: { getText: () => '  custom dsl  ' } };
      SignalDescriptionLanguage.generateCaptureSession.mockReturnValue(fakeSession());
      mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: '/out/syn.lac' });
      LACFileFormat.save.mockResolvedValue({ success: true });
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(SignalDescriptionLanguage.generateCaptureSession).toHaveBeenCalledWith('custom dsl');
    });

    it('showSaveDialog 取消时直接返回', async () => {
      SignalDescriptionLanguage.generateCaptureSession.mockReturnValue(fakeSession());
      mockVSCode.window.showSaveDialog.mockResolvedValue(undefined);
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(LACFileFormat.save).not.toHaveBeenCalled();
    });

    it('save 成功时打开文件并提示通道/样本数', async () => {
      SignalDescriptionLanguage.generateCaptureSession.mockReturnValue(fakeSession(2048));
      mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: '/out/syn.lac' });
      LACFileFormat.save.mockResolvedValue({ success: true });
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(LACFileFormat.save).toHaveBeenCalledWith('/out/syn.lac', expect.anything(), undefined, true);
      expect(mockVSCode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', { fsPath: '/out/syn.lac' });
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith(
        '已生成合成采集: 3 个通道，2048 个样本'
      );
    });

    it('save 失败时显示保存失败错误', async () => {
      SignalDescriptionLanguage.generateCaptureSession.mockReturnValue(fakeSession());
      mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: '/out/syn.lac' });
      LACFileFormat.save.mockResolvedValue({ success: false, error: '磁盘已满' });
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('合成采集保存失败: 磁盘已满');
    });

    it('generateCaptureSession 抛出 SignalDslParseError 时显示 DSL 解析失败', async () => {
      SignalDescriptionLanguage.generateCaptureSession.mockImplementation(() => {
        throw new SignalDslParseErrorCtor(2, 'bad token');
      });
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Signal DSL 解析失败')
      );
    });

    it('generateCaptureSession 抛出其它异常时显示通用失败', async () => {
      SignalDescriptionLanguage.generateCaptureSession.mockImplementation(() => {
        throw new Error('内部错误');
      });
      activate(context);

      await getHandler('logicAnalyzer.createSyntheticCapture')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('生成合成采集失败: 内部错误');
    });
  });

  // ---------------- connectDevice 命令（网络连接分支 + parseNetworkAddress）----------------
  describe('connectDevice 命令网络连接与 parseNetworkAddress', () => {
    it('网络连接 + 合法地址时按 host:port 调用 connectToDevice', async () => {
      mockVSCode.window.showWarningMessage.mockResolvedValue('网络连接');
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.100:3030');
      activate(context);

      await getHandler('logicAnalyzer.connectDevice')();

      expect(hardwareDriverManager.connectToDevice).toHaveBeenCalledWith('network', {
        networkConfig: { host: '192.168.1.100', port: 3030 },
      });
    });

    it('网络连接 + 缺少端口时捕获 parseNetworkAddress 错误', async () => {
      mockVSCode.window.showWarningMessage.mockResolvedValue('网络连接');
      mockVSCode.window.showInputBox.mockResolvedValue('no-port-host');
      activate(context);

      await getHandler('logicAnalyzer.connectDevice')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('设备检测失败')
      );
    });

    it('网络连接 + 端口超范围时捕获 parseNetworkAddress 错误', async () => {
      mockVSCode.window.showWarningMessage.mockResolvedValue('网络连接');
      mockVSCode.window.showInputBox.mockResolvedValue('192.168.1.1:70000');
      activate(context);

      await getHandler('logicAnalyzer.connectDevice')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('设备检测失败')
      );
    });
  });

  // ---------------- deactivate 服务清理 ----------------
  describe('deactivate 服务清理', () => {
    it('注入服务时调用 stopScan/clearCache/disconnect/dispose', () => {
      const wifi = makeFakeWifiService();
      const net = makeFakeNetService();
      activate(context, { wifiDiscoveryService: wifi as any, networkStabilityService: net as any });

      deactivate();

      expect(wifi.stopScan).toHaveBeenCalled();
      expect(wifi.clearCache).toHaveBeenCalled();
      expect(net.disconnect).toHaveBeenCalled();
      expect(hardwareDriverManager.dispose).toHaveBeenCalled();
    });

    it('networkStabilityService.disconnect reject 时被吞掉（不抛出）', async () => {
      const wifi = makeFakeWifiService();
      const net = makeFakeNetService();
      net.disconnect.mockRejectedValue(new Error('断连失败'));
      activate(context, { wifiDiscoveryService: wifi as any, networkStabilityService: net as any });

      expect(() => deactivate()).not.toThrow();
    });
  });

  // ====================================================================
  // 以下测试会触发 runCaptureWithProgress，从而设置模块级 lastCaptureConfig。
  // 必须位于"repeatCapture 无配置"用例之后。
  // ====================================================================

  // ---------------- getCaptureConfiguration validateInput ----------------
  describe('getCaptureConfiguration 校验函数', () => {
    async function driveUntilCancel(stopAtPrompt: string) {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      // 让目标 InputBox 之后的步骤取消（返回 undefined）；目标步返回 undefined 以停留在校验提取
      const seq: Array<string | undefined> = ['1000000', '100', '1000', '0', '0,1,2,3'];
      const map: Record<string, number> = {
        '采样频率': 0, '触发前样本': 1, '触发后样本': 2, '触发通道': 3, '活动通道': 4,
      };
      const idx = map[stopAtPrompt];
      seq[idx] = undefined;
      driveInputBoxSequence(seq);
      mockVSCode.window.showQuickPick.mockResolvedValue('Edge');
      activate(context);
      await getHandler('logicAnalyzer.startCapture')();
      return getValidator(stopAtPrompt);
    }

    it('采样频率校验：低于/高于/非法/合法', async () => {
      const v = await driveUntilCancel('采样频率');
      expect(v('999')).toBe('采样频率必须在1kHz-100MHz之间');
      expect(v('100000001')).toBe('采样频率必须在1kHz-100MHz之间');
      expect(v('abc')).toBe('采样频率必须在1kHz-100MHz之间');
      expect(v('1000000')).toBeNull();
    });

    it('触发前样本数量校验', async () => {
      const v = await driveUntilCancel('触发前样本');
      expect(v('-1')).toBe('触发前样本数量必须在0-1000000之间');
      expect(v('1000001')).toBe('触发前样本数量必须在0-1000000之间');
      expect(v('0')).toBeNull();
    });

    it('触发后样本数量校验', async () => {
      const v = await driveUntilCancel('触发后样本');
      expect(v('0')).toBe('触发后样本数量必须在1-1000000之间');
      expect(v('1000001')).toBe('触发后样本数量必须在1-1000000之间');
      expect(v('1')).toBeNull();
    });

    it('触发通道校验', async () => {
      const v = await driveUntilCancel('触发通道');
      expect(v('-1')).toBe('触发通道必须在0-23之间');
      expect(v('24')).toBe('触发通道必须在0-23之间');
      expect(v('23')).toBeNull();
    });

    it('活动通道校验', async () => {
      const v = await driveUntilCancel('活动通道');
      expect(v('0,99')).toBe('通道号必须在0-23之间');
      expect(v('0,x')).toBe('通道号必须在0-23之间');
      expect(v('0,1,2,3')).toBeNull();
    });
  });

  // ---------------- startCapture 命令 ----------------
  describe('startCapture 命令', () => {
    it('无设备且选择"连接设备"时触发 connectDevice 命令', async () => {
      mockVSCode.window.showWarningMessage.mockResolvedValue('连接设备');
      activate(context);

      await getHandler('logicAnalyzer.startCapture')();

      expect(mockVSCode.commands.executeCommand).toHaveBeenCalledWith('logicAnalyzer.connectDevice');
    });

    it('无设备且选择"取消"时不触发连接', async () => {
      mockVSCode.window.showWarningMessage.mockResolvedValue('取消');
      activate(context);

      await getHandler('logicAnalyzer.startCapture')();

      expect(mockVSCode.commands.executeCommand).not.toHaveBeenCalledWith('logicAnalyzer.connectDevice');
    });

    it('getCaptureConfiguration 返回 null（用户中途取消）时提示已取消', async () => {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      // 首个 InputBox 即取消
      driveInputBoxSequence([undefined]);
      activate(context);

      await getHandler('logicAnalyzer.startCapture')();

      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith('数据采集已取消');
    });
  });

  // ---------------- runCaptureWithProgress 内部状态机 ----------------
  describe('runCaptureWithProgress 内部状态机', () => {
    function setupProgressRun() {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveInputBoxSequence(['1000000', '100', '1000', '0', '0,1,2,3']);
      mockVSCode.window.showQuickPick.mockResolvedValue('Edge');
      mockVSCode.window.withProgress.mockImplementation(async (_opts: any, cb: any) =>
        cb({ report: jest.fn() }, { onCancellationRequested: jest.fn() })
      );
      activate(context);
      return device;
    }

    it('采集完成 success=true 且 saveToWorkspace 时保存数据并提示样本数', async () => {
      const device = setupProgressRun();
      let captured: any;
      device.startCapture.mockImplementation((session: any, handler: any) => {
        captured = handler;
        return Promise.resolve(CaptureError.None);
      });
      mockVSCode.window.showInformationMessage.mockResolvedValue('关闭');

      const promise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      captured({ success: true, session: { totalSamples: 5000, captureChannels: [] } });
      await promise;

      // saveCaptureData 调用了 createFromCaptureSession + writeFile
      expect(LACFileFormat.createFromCaptureSession).toHaveBeenCalled();
      expect(mockVSCode.workspace.fs.writeFile).toHaveBeenCalled();
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith('数据采集成功！共采集 5000 个样本');
    });

    it('保存后用户选择"打开文件"时执行 vscode.open', async () => {
      const device = setupProgressRun();
      let captured: any;
      device.startCapture.mockImplementation((session: any, handler: any) => {
        captured = handler;
        return Promise.resolve(CaptureError.None);
      });
      mockVSCode.window.showInformationMessage.mockImplementation((msg: string) =>
        msg.includes('已保存到') ? Promise.resolve('打开文件') : Promise.resolve('关闭')
      );

      const promise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      captured({ success: true, session: { totalSamples: 100, captureChannels: [] } });
      await promise;

      expect(mockVSCode.commands.executeCommand).toHaveBeenCalledWith('vscode.open', expect.anything());
    });

    it('采集完成 success=false 时显示采集失败', async () => {
      const device = setupProgressRun();
      let captured: any;
      device.startCapture.mockImplementation((session: any, handler: any) => {
        captured = handler;
        return Promise.resolve(CaptureError.None);
      });

      const promise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      captured({ success: false, session: null });
      await promise;

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('数据采集失败: 采集失败');
    });

    it('saveCaptureData 抛出（无工作区）时显示保存失败', async () => {
      const device = setupProgressRun();
      mockVSCode.workspace.workspaceFolders = undefined; // 触发无工作区错误
      let captured: any;
      device.startCapture.mockImplementation((session: any, handler: any) => {
        captured = handler;
        return Promise.resolve(CaptureError.None);
      });

      const promise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      captured({ success: true, session: { totalSamples: 1, captureChannels: [] } });
      await promise;

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('保存采集数据失败')
      );
      // 恢复工作区配置
      mockVSCode.workspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    });

    it('device.startCapture 返回非 None 时显示启动失败错误码', async () => {
      const device = setupProgressRun();
      device.startCapture.mockResolvedValue(CaptureError.HardwareError);

      await getHandler('logicAnalyzer.startCapture')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('采集启动失败，错误代码')
      );
    });

    it('device.startCapture 抛出异常时显示启动异常', async () => {
      const device = setupProgressRun();
      device.startCapture.mockRejectedValue(new Error('硬件异常'));

      await getHandler('logicAnalyzer.startCapture')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('启动采集异常')
      );
    });

    it('用户取消采集时停止设备并提示已取消', async () => {
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveInputBoxSequence(['1000000', '100', '1000', '0', '0,1,2,3']);
      mockVSCode.window.showQuickPick.mockResolvedValue('Edge');
      // onCancellationRequested 同步触发取消回调
      mockVSCode.window.withProgress.mockImplementation(async (_opts: any, cb: any) => {
        return cb({ report: jest.fn() }, {
          onCancellationRequested: (cancelCb: () => void) => { cancelCb(); },
        });
      });
      device.startCapture.mockResolvedValue(CaptureError.None);
      activate(context);

      await getHandler('logicAnalyzer.startCapture')();

      expect(device.stopCapture).toHaveBeenCalled();
      expect(mockVSCode.window.showInformationMessage).toHaveBeenCalledWith('数据采集已取消');
    });
  });

  // ---------------- createCaptureSession / parseTriggerType ----------------
  describe('createCaptureSession / parseTriggerType', () => {
    async function runAndFinish(triggerType: string) {
      let captured: any;
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveInputBoxSequence(['1000000', '100', '1000', '5', '0,1,2']);
      mockVSCode.window.showQuickPick.mockResolvedValue(triggerType);
      mockVSCode.window.withProgress.mockImplementation(async (_opts: any, cb: any) =>
        cb({ report: jest.fn() }, { onCancellationRequested: jest.fn() })
      );
      device.startCapture.mockImplementation((s: any, handler: any) => {
        captured = { session: s, handler };
        return Promise.resolve(CaptureError.None);
      });
      activate(context);

      const promise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      captured.handler({ success: true, session: { totalSamples: 10, captureChannels: [] } });
      await promise;
      return captured.session;
    }

    it('Edge 模式映射为 TriggerType.Edge 且 loopCount=0/measureBursts=false', async () => {
      const session = await runAndFinish('Edge');
      expect(session.triggerType).toBe(TriggerType.Edge);
      expect(session.loopCount).toBe(0);
      expect(session.measureBursts).toBe(false);
    });

    it('Fast 模式映射为 TriggerType.Fast', async () => {
      const session = await runAndFinish('Fast');
      expect(session.triggerType).toBe(TriggerType.Fast);
    });

    it('Complex 模式映射为 TriggerType.Complex', async () => {
      const session = await runAndFinish('Complex');
      expect(session.triggerType).toBe(TriggerType.Complex);
    });

    it('Blast 模式映射为 TriggerType.Blast 且 loopCount=1/measureBursts=true', async () => {
      const session = await runAndFinish('Blast');
      expect(session.triggerType).toBe(TriggerType.Blast);
      expect(session.loopCount).toBe(1);
      expect(session.measureBursts).toBe(true);
    });

    it('活动通道被规范化为 AnalyzerChannel（channels 分支）', async () => {
      const session = await runAndFinish('Edge');
      // getCaptureConfiguration 总会填充 channels 数组（normalizeCaptureChannels 的 channels 分支）
      expect(session.captureChannels.length).toBeGreaterThan(0);
      expect(session.captureChannels[0]).toHaveProperty('channelNumber');
    });
  });

  // ---------------- repeatCapture 命令（有配置，依赖前面采集已设置 lastCaptureConfig）----------------
  describe('repeatCapture 命令（有配置）', () => {
    it('存在 lastCaptureConfig 时再次触发 runCaptureWithProgress', async () => {
      // 先触发一次 startCapture 正常流程以设置模块级 lastCaptureConfig
      const device1 = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device1);
      driveInputBoxSequence(['1000000', '100', '1000', '0', '0,1,2,3']);
      mockVSCode.window.showQuickPick.mockResolvedValue('Edge');
      let firstHandler: any;
      device1.startCapture.mockImplementation((_s: any, handler: any) => {
        firstHandler = handler;
        return Promise.resolve(CaptureError.None);
      });
      mockVSCode.window.withProgress.mockImplementation(async (_opts: any, cb: any) =>
        cb({ report: jest.fn() }, { onCancellationRequested: jest.fn() })
      );
      activate(context);

      const firstPromise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      firstHandler({ success: true, session: { totalSamples: 1, captureChannels: [] } });
      await firstPromise;

      // 现在测试 repeatCapture
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device1);
      device1.startCapture.mockResolvedValue(CaptureError.None);
      let secondHandler: any;
      device1.startCapture.mockImplementation((_s: any, handler: any) => {
        secondHandler = handler;
        return Promise.resolve(CaptureError.None);
      });

      const repeatPromise = getHandler('logicAnalyzer.repeatCapture')();
      await new Promise(r => setTimeout(r, 0));
      expect(device1.startCapture).toHaveBeenCalled();
      // 完成第二次采集以让 promise 落定
      secondHandler({ success: true, session: { totalSamples: 2, captureChannels: [] } });
      await repeatPromise;

      expect(mockVSCode.window.withProgress).toHaveBeenCalledTimes(2);
    });

    it('repeatCapture 中 runCaptureWithProgress 抛错时显示重复采集失败', async () => {
      // 先触发一次 startCapture 正常流程以设置模块级 lastCaptureConfig
      const device = makeFakeDevice();
      hardwareDriverManager.getCurrentDevice.mockReturnValue(device);
      driveInputBoxSequence(['1000000', '100', '1000', '0', '0,1,2,3']);
      mockVSCode.window.showQuickPick.mockResolvedValue('Edge');
      let firstHandler: any;
      device.startCapture.mockImplementation((_s: any, handler: any) => {
        firstHandler = handler;
        return Promise.resolve(CaptureError.None);
      });
      mockVSCode.window.withProgress.mockImplementation(async (_opts: any, cb: any) =>
        cb({ report: jest.fn() }, { onCancellationRequested: jest.fn() })
      );
      activate(context);

      const firstPromise = getHandler('logicAnalyzer.startCapture')();
      await new Promise(r => setTimeout(r, 0));
      firstHandler({ success: true, session: { totalSamples: 1, captureChannels: [] } });
      await firstPromise;

      // 切换 withProgress 为抛错，测试 repeatCapture 的 catch 分支
      mockVSCode.window.withProgress.mockImplementation(async () => {
        throw new Error('采集中断');
      });
      await getHandler('logicAnalyzer.repeatCapture')();

      expect(mockVSCode.window.showErrorMessage).toHaveBeenCalledWith('重复采集失败: 采集中断');
    });
  });
});
