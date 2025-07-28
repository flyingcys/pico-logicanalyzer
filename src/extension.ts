import * as vscode from 'vscode';
import { LACEditorProvider } from './providers/LACEditorProvider';
import { hardwareDriverManager } from './drivers/HardwareDriverManager';

export function activate(context: vscode.ExtensionContext) {
  console.log('VSCode Logic Analyzer插件正在激活...');

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

  context.subscriptions.push(openAnalyzerCommand, connectDeviceCommand, startCaptureCommand);

  console.log('VSCode Logic Analyzer插件激活完成');
}

export function deactivate() {
  console.log('VSCode Logic Analyzer插件正在停用...');

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
