import * as vscode from 'vscode';
import { LACEditorProvider } from './providers/LACEditorProvider';
import { hardwareDriverManager } from './drivers/HardwareDriverManager';
import { WiFiDeviceDiscovery } from './services/WiFiDeviceDiscovery';
import { NetworkStabilityService } from './services/NetworkStabilityService';

// 全局服务实例
let wifiDiscoveryService: WiFiDeviceDiscovery;
let networkStabilityService: NetworkStabilityService;

export function activate(context: vscode.ExtensionContext) {
  console.log('VSCode Logic Analyzer插件正在激活...');

  // 初始化网络服务
  wifiDiscoveryService = new WiFiDeviceDiscovery();
  networkStabilityService = new NetworkStabilityService();

  // 注册.lac文件的自定义编辑器
  context.subscriptions.push(LACEditorProvider.register(context));

  // 注册命令
  const openAnalyzerCommand = vscode.commands.registerCommand('logicAnalyzer.openAnalyzer', () => {
    vscode.window.showInformationMessage('打开逻辑分析器界面!');
    // TODO: 实现主界面打开逻辑
  });

  const connectDeviceCommand = vscode.commands.registerCommand(
    'logicAnalyzer.connectDevice',
    async () => {
      try {
        // 检测可用设备
        vscode.window.showInformationMessage('正在检测逻辑分析器设备...');
        const devices = await hardwareDriverManager.detectHardware();

        if (devices.length === 0) {
          const action = await vscode.window.showWarningMessage(
            '未检测到逻辑分析器设备',
            '手动指定',
            '网络连接',
            '取消'
          );

          if (action === '手动指定') {
            const devicePath = await vscode.window.showInputBox({
              prompt: '请输入设备路径 (如: /dev/ttyUSB0 或 COM3)',
              placeHolder: '/dev/ttyUSB0'
            });

            if (devicePath) {
              await connectToDevice(devicePath);
            }
          } else if (action === '网络连接') {
            const networkAddress = await vscode.window.showInputBox({
              prompt: '请输入网络地址 (如: 192.168.1.100:3030)',
              placeHolder: '192.168.1.100:3030'
            });

            if (networkAddress) {
              await connectToDevice('network', {
                networkConfig: parseNetworkAddress(networkAddress)
              });
            }
          }
          return;
        }

        // 显示设备选择列表
        const deviceItems = devices.map(device => ({
          label: device.name,
          description: `${device.type} - ${device.connectionPath}`,
          detail: `置信度: ${Math.round(device.confidence * 100)}%`,
          device
        }));

        // 添加特殊选项
        deviceItems.push(
          {
            label: '$(broadcast) 自动检测',
            description: '自动选择最佳匹配设备',
            detail: '让系统自动选择置信度最高的设备',
            device: {
              id: 'autodetect',
              name: '自动检测',
              type: 'Auto' as any,
              connectionPath: '',
              confidence: 1
            }
          },
          {
            label: '$(globe) 网络连接',
            description: '连接网络逻辑分析器',
            detail: '通过TCP/IP连接网络设备',
            device: {
              id: 'network',
              name: '网络设备',
              type: 'Network' as any,
              connectionPath: '',
              confidence: 0.5
            }
          }
        );

        const selectedItem = await vscode.window.showQuickPick(deviceItems, {
          placeHolder: '选择要连接的逻辑分析器设备',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selectedItem) {
          await connectToDevice(selectedItem.device.id);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`设备检测失败: ${error}`);
      }
    }
  );

  const startCaptureCommand = vscode.commands.registerCommand('logicAnalyzer.startCapture', () => {
    vscode.window.showInformationMessage('开始数据采集!');
    // TODO: 实现数据采集逻辑
  });

  // 网络设备扫描命令
  const scanNetworkDevicesCommand = vscode.commands.registerCommand(
    'logicAnalyzer.scanNetworkDevices',
    async () => {
      try {
        vscode.window.showInformationMessage('正在扫描网络设备...');

        const result = await wifiDiscoveryService.scanForDevices({
          timeout: 5000,
          concurrency: 30,
          deepScan: true,
          enableBroadcast: true
        });

        if (result.devices.length > 0) {
          const deviceItems = result.devices.map(device => ({
            label: device.deviceName || 'Unknown Device',
            description: `${device.ipAddress}:${device.port}`,
            detail: `${device.version || 'Unknown Version'} - 响应时间: ${device.responseTime}ms`,
            device
          }));

          const selectedItem = await vscode.window.showQuickPick(deviceItems, {
            placeHolder: '选择要连接的网络设备',
            matchOnDescription: true,
            matchOnDetail: true
          });

          if (selectedItem) {
            await connectToNetworkDevice(selectedItem.device.ipAddress, selectedItem.device.port);
          }
        } else {
          vscode.window.showWarningMessage('未发现网络设备');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`网络设备扫描失败: ${error}`);
      }
    }
  );

  // 网络诊断命令
  const networkDiagnosticsCommand = vscode.commands.registerCommand(
    'logicAnalyzer.networkDiagnostics',
    async () => {
      const networkAddress = await vscode.window.showInputBox({
        prompt: '请输入要诊断的网络地址 (如: 192.168.1.100:4045)',
        placeHolder: '192.168.1.100:4045'
      });

      if (!networkAddress) return;

      try {
        const { host, port } = parseNetworkAddress(networkAddress);

        vscode.window.showInformationMessage('正在运行网络诊断...');

        const diagnostics = await networkStabilityService.runDiagnostics(host, port);

        // 创建诊断报告
        const report = diagnostics.map(result =>
          `${result.testName}: ${result.passed ? '✅ 通过' : '❌ 失败'} - ${result.details}`
        ).join('\n');

        const document = await vscode.workspace.openTextDocument({
          content: `网络诊断报告 - ${networkAddress}\n` +
                  `诊断时间: ${new Date().toLocaleString()}\n` +
                  `================================\n\n${report}`,
          language: 'plaintext'
        });

        await vscode.window.showTextDocument(document);

      } catch (error) {
        vscode.window.showErrorMessage(`网络诊断失败: ${error}`);
      }
    }
  );

  // WiFi配置命令
  const configureWiFiCommand = vscode.commands.registerCommand(
    'logicAnalyzer.configureWiFi',
    async () => {
      // 首先获取当前连接的设备
      const currentDevice = hardwareDriverManager.getCurrentDevice();
      if (!currentDevice) {
        vscode.window.showWarningMessage('请先连接到设备');
        return;
      }

      // 收集WiFi配置信息
      const ssid = await vscode.window.showInputBox({
        prompt: '请输入WiFi网络名称 (SSID)',
        placeHolder: 'MyWiFiNetwork'
      });

      if (!ssid) return;

      const password = await vscode.window.showInputBox({
        prompt: '请输入WiFi密码',
        password: true,
        placeHolder: '********'
      });

      if (!password) return;

      const ipAddress = await vscode.window.showInputBox({
        prompt: '请输入静态IP地址 (可选，留空使用DHCP)',
        placeHolder: '192.168.1.100'
      });

      const portStr = await vscode.window.showInputBox({
        prompt: '请输入TCP端口号',
        value: '4045',
        validateInput: (value) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1024 || port > 65535) {
            return '端口号必须在1024-65535之间';
          }
          return null;
        }
      });

      if (!portStr) return;

      const port = parseInt(portStr);

      try {
        vscode.window.showInformationMessage('正在配置WiFi设置...');

        const success = await currentDevice.sendNetworkConfig(
          ssid,
          password,
          ipAddress || '0.0.0.0', // 0.0.0.0表示使用DHCP
          port
        );

        if (success) {
          vscode.window.showInformationMessage(
            'WiFi配置已发送成功！设备将重启并连接到WiFi网络。'
          );
        } else {
          vscode.window.showErrorMessage('WiFi配置发送失败');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`WiFi配置失败: ${error}`);
      }
    }
  );

  context.subscriptions.push(
    openAnalyzerCommand,
    connectDeviceCommand,
    startCaptureCommand,
    scanNetworkDevicesCommand,
    networkDiagnosticsCommand,
    configureWiFiCommand
  );

  console.log('VSCode Logic Analyzer插件激活完成');
}

export function deactivate() {
  console.log('VSCode Logic Analyzer插件正在停用...');

  // 清理网络服务
  if (wifiDiscoveryService) {
    wifiDiscoveryService.stopScan();
    wifiDiscoveryService.clearCache();
  }

  if (networkStabilityService) {
    networkStabilityService.disconnect().catch(error => {
      console.error('清理网络稳定性服务失败:', error);
    });
  }

  // 清理硬件驱动管理器
  hardwareDriverManager.dispose().catch(error => {
    console.error('清理硬件驱动管理器失败:', error);
  });
}

// 连接到指定设备的辅助函数
async function connectToDevice(deviceId: string, params?: any): Promise<void> {
  try {
    vscode.window.showInformationMessage(`正在连接设备: ${deviceId}`);

    const result = await hardwareDriverManager.connectToDevice(deviceId, params);

    if (result.success) {
      vscode.window.showInformationMessage(`设备连接成功: ${result.deviceInfo?.name || deviceId}`);
    } else {
      vscode.window.showErrorMessage(`设备连接失败: ${result.error}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`设备连接异常: ${error}`);
  }
}

// 连接到网络设备的辅助函数
async function connectToNetworkDevice(host: string, port: number): Promise<void> {
  try {
    vscode.window.showInformationMessage(`正在连接网络设备: ${host}:${port}`);

    // 使用网络稳定性服务建立连接
    const connected = await networkStabilityService.connect(host, port);

    if (connected) {
      // 通过硬件驱动管理器注册网络连接
      const connectionString = `${host}:${port}`;
      const result = await hardwareDriverManager.connectToDevice('network', {
        networkConfig: { host, port }
      });

      if (result.success) {
        vscode.window.showInformationMessage(
          `网络设备连接成功: ${result.deviceInfo?.name || connectionString}`
        );

        // 开始监控连接质量
        const quality = networkStabilityService.getConnectionQuality();
        console.log('连接质量:', quality);
      } else {
        await networkStabilityService.disconnect();
        vscode.window.showErrorMessage(`网络设备连接失败: ${result.error}`);
      }
    } else {
      vscode.window.showErrorMessage(`无法连接到网络设备: ${host}:${port}`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`网络设备连接异常: ${error}`);
  }
}

// 解析网络地址的辅助函数
function parseNetworkAddress(address: string): { host: string; port: number } {
  const parts = address.split(':');
  if (parts.length !== 2) {
    throw new Error('网络地址格式无效，应为 host:port');
  }

  const host = parts[0].trim();
  const port = parseInt(parts[1].trim(), 10);

  if (!host || isNaN(port) || port < 1 || port > 65535) {
    throw new Error('网络地址格式无效');
  }

  return { host, port };
}
