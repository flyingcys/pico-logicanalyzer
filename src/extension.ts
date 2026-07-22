import * as vscode from 'vscode';
import * as path from 'path';
import { LACEditorProvider } from './providers/LACEditorProvider';
import { hardwareDriverManager } from './drivers/HardwareDriverManager';
import { WiFiDeviceDiscovery } from './services/WiFiDeviceDiscovery';
import { NetworkStabilityService } from './services/NetworkStabilityService';
import { AnalyzerDriverType, CaptureError, ConnectionParams, TriggerType, CaptureCompletedHandler } from './models/AnalyzerTypes';
import { CaptureSession, AnalyzerChannel } from './models/CaptureModels';
import { LACFileFormat } from './models/LACFileFormat';
import {
  SignalDescriptionLanguage,
  SignalDslParseError
} from './services/SignalDescriptionLanguage';

interface CaptureWorkflowChannel {
  number: number;
  name?: string;
  enabled?: boolean;
}

interface CaptureWorkflowConfig {
  frequency: number;
  preTriggerSamples: number;
  postTriggerSamples: number;
  triggerType: TriggerType | keyof typeof TriggerType | string;
  triggerChannel: number;
  triggerInverted?: boolean;
  triggerPattern?: number;
  triggerBitCount?: number;
  loopCount?: number;
  measureBursts?: boolean;
  activeChannels?: number[];
  channels?: CaptureWorkflowChannel[];
}

// 服务依赖接口
export interface ExtensionServices {
  wifiDiscoveryService?: WiFiDeviceDiscovery;
  networkStabilityService?: NetworkStabilityService;
}

// 全局服务实例
let wifiDiscoveryService: WiFiDeviceDiscovery;
let networkStabilityService: NetworkStabilityService;
let lastCaptureConfig: CaptureWorkflowConfig | null = null;

export function activate(context: vscode.ExtensionContext, services?: ExtensionServices) {
  console.log('VSCode Logic Analyzer插件正在激活...');

  // 初始化网络服务 - 支持依赖注入
  wifiDiscoveryService = services?.wifiDiscoveryService || new WiFiDeviceDiscovery();
  networkStabilityService = services?.networkStabilityService || new NetworkStabilityService();

  // 注册.lac文件的自定义编辑器
  context.subscriptions.push(LACEditorProvider.register(context));

  // 注册命令
  const openAnalyzerCommand = vscode.commands.registerCommand('logicAnalyzer.openAnalyzer', async () => {
    try {
      // 创建一个新的.lac文件来启动主界面
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `analyzer_session_${timestamp}.lac`;

      // 获取工作区根目录
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      let filePath: string;

      if (workspaceFolder) {
        filePath = path.join(workspaceFolder.uri.fsPath, fileName);
      } else {
        // 如果没有工作区，创建临时文件
        const tempDir = require('os').tmpdir();
        filePath = path.join(tempDir, fileName);
      }

      const fileUri = vscode.Uri.file(filePath);

      // 创建初始化的LAC文件内容
      const initialSession = new CaptureSession();
      initialSession.frequency = 1000000;
      initialSession.postTriggerSamples = 1000;
      initialSession.preTriggerSamples = 100;

      // 添加默认通道
      for (let i = 0; i < 8; i++) {
        const channel = new AnalyzerChannel(i, `Channel ${i + 1}`);
        channel.hidden = false;
        initialSession.captureChannels.push(channel);
      }

      // 转换为LAC格式
      const lacData = LACFileFormat.createFromCaptureSession(initialSession);
      const lacContent = JSON.stringify(lacData, null, 2);

      // 写入文件
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(fileUri, encoder.encode(lacContent));

      // 打开文件，这将触发LACEditorProvider自动打开主界面
      await vscode.commands.executeCommand('vscode.open', fileUri);

      vscode.window.showInformationMessage('逻辑分析器主界面已打开！');

    } catch (error: unknown) {
      vscode.window.showErrorMessage(`打开逻辑分析器界面失败: ${error instanceof Error ? error.message : String(error)}`);
    }
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
              type: 'usb' as const,
              connectionString: 'auto',
              connectionPath: '',
              driverType: AnalyzerDriverType.Multi,
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
              type: 'network',
              connectionString: 'tcp://auto',
              connectionPath: '',
              driverType: AnalyzerDriverType.Network,
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

  const startCaptureCommand = vscode.commands.registerCommand('logicAnalyzer.startCapture', async () => {
    try {
      // 检查设备连接状态
      const currentDevice = hardwareDriverManager.getCurrentDevice();
      if (!currentDevice) {
        const action = await vscode.window.showWarningMessage(
          '请先连接逻辑分析器设备',
          '连接设备',
          '取消'
        );

        if (action === '连接设备') {
          await vscode.commands.executeCommand('logicAnalyzer.connectDevice');
          return;
        }
        return;
      }

      // 获取设备信息
      const deviceInfo = hardwareDriverManager.getCurrentDeviceInfo();
      vscode.window.showInformationMessage(`正在使用设备: ${deviceInfo?.name || '未知设备'} 开始数据采集...`);

      // 配置采集参数
      const captureConfig = await getCaptureConfiguration();
      if (!captureConfig) {
        vscode.window.showInformationMessage('数据采集已取消');
        return;
      }

      await runCaptureWithProgress(captureConfig, { saveToWorkspace: true });

    } catch (error: unknown) {
      vscode.window.showErrorMessage(`数据采集失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const stopCaptureCommand = vscode.commands.registerCommand('logicAnalyzer.stopCapture', async () => {
    const currentDevice = hardwareDriverManager.getCurrentDevice();
    if (!currentDevice) {
      vscode.window.showWarningMessage('当前没有已连接设备');
      return;
    }

    const stopped = await currentDevice.stopCapture();
    if (stopped) {
      vscode.window.showInformationMessage('数据采集已停止');
    } else {
      vscode.window.showWarningMessage('当前没有正在进行的采集');
    }
  });

  const repeatCaptureCommand = vscode.commands.registerCommand('logicAnalyzer.repeatCapture', async () => {
    if (!lastCaptureConfig) {
      vscode.window.showWarningMessage('没有可重复执行的采集配置');
      return;
    }

    try {
      await runCaptureWithProgress(lastCaptureConfig, { saveToWorkspace: true });
    } catch (error: unknown) {
      vscode.window.showErrorMessage(`重复采集失败: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      } catch (error: unknown) {
        vscode.window.showErrorMessage(`网络设备扫描失败: ${error instanceof Error ? error.message : String(error)}`);
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

      } catch (error: unknown) {
        vscode.window.showErrorMessage(`网络诊断失败: ${error instanceof Error ? error.message : String(error)}`);
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
      } catch (error: unknown) {
        vscode.window.showErrorMessage(`WiFi配置失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  const createSyntheticCaptureCommand = vscode.commands.registerCommand(
    'logicAnalyzer.createSyntheticCapture',
    async () => {
      try {
        const source = getSignalDslSource();
        const session = SignalDescriptionLanguage.generateCaptureSession(source);
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: buildSyntheticCaptureDefaultUri(),
          filters: {
            'Logic Analyzer Capture': ['lac']
          },
          saveLabel: '保存合成采集'
        });

        if (!saveUri) {
          return;
        }

        const result = await LACFileFormat.save(saveUri.fsPath, session, undefined, true);
        if (!result.success) {
          vscode.window.showErrorMessage(`合成采集保存失败: ${result.error}`);
          return;
        }

        await vscode.commands.executeCommand('vscode.open', saveUri);
        vscode.window.showInformationMessage(
          `已生成合成采集: ${session.captureChannels.length} 个通道，${session.totalSamples} 个样本`
        );
      } catch (error: unknown) {
        if (error instanceof SignalDslParseError) {
          vscode.window.showErrorMessage(`Signal DSL 解析失败: ${error.message}`);
          return;
        }

        vscode.window.showErrorMessage(`生成合成采集失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  context.subscriptions.push(
    openAnalyzerCommand,
    connectDeviceCommand,
    startCaptureCommand,
    stopCaptureCommand,
    repeatCaptureCommand,
    scanNetworkDevicesCommand,
    networkDiagnosticsCommand,
    configureWiFiCommand,
    createSyntheticCaptureCommand
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

function getSignalDslSource(): string {
  const activeText = vscode.window.activeTextEditor?.document.getText().trim();
  return activeText || SignalDescriptionLanguage.getDefaultTemplate();
}

function buildSyntheticCaptureDefaultUri(): vscode.Uri {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `synthetic_capture_${timestamp}.lac`;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (workspaceFolder) {
    return vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, fileName));
  }

  const tempDir = require('os').tmpdir();
  return vscode.Uri.file(path.join(tempDir, fileName));
}

// 连接到指定设备的辅助函数
export async function connectToDevice(deviceId: string, params?: ConnectionParams): Promise<void> {
  try {
    vscode.window.showInformationMessage(`正在连接设备: ${deviceId}`);

    const result = await hardwareDriverManager.connectToDevice(deviceId, params);

    if (result.success) {
      vscode.window.showInformationMessage(`设备连接成功: ${result.deviceInfo?.name || deviceId}`);
    } else {
      vscode.window.showErrorMessage(`设备连接失败: ${result.error}`);
    }
  } catch (error: unknown) {
    vscode.window.showErrorMessage(`设备连接异常: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 连接到网络设备的辅助函数
export async function connectToNetworkDevice(host: string, port: number): Promise<void> {
  try {
    vscode.window.showInformationMessage(`正在连接网络设备: ${host}:${port}`);

    // 使用网络稳定性服务建立连接（服务未初始化时跳过预检，直接交由驱动建立连接）
    const connected = networkStabilityService
      ? await networkStabilityService.connect(host, port)
      : true;

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
        if (networkStabilityService) {
          const quality = networkStabilityService.getConnectionQuality();
          console.log('连接质量:', quality);
        }
      } else {
        if (networkStabilityService) {
          await networkStabilityService.disconnect();
        }
        vscode.window.showErrorMessage(`网络设备连接失败: ${result.error}`);
      }
    } else {
      vscode.window.showErrorMessage(`无法连接到网络设备: ${host}:${port}`);
    }
  } catch (error: unknown) {
    vscode.window.showErrorMessage(`网络设备连接异常: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runCaptureWithProgress(
  config: CaptureWorkflowConfig,
  options: { saveToWorkspace: boolean }
): Promise<CaptureSession> {
  const currentDevice = hardwareDriverManager.getCurrentDevice();
  if (!currentDevice) {
    throw new Error('请先连接逻辑分析器设备');
  }

  const captureSession = createCaptureSession(config);
  lastCaptureConfig = cloneCaptureWorkflowConfig(config);

  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: '数据采集中...',
    cancellable: true
  }, async (progress, token) => {
    return new Promise<CaptureSession>((resolve, reject) => {
      let progressValue = 0;
      let finished = false;

      const progressTimer = setInterval(() => {
        if (progressValue < 90) {
          progressValue += 10;
          progress.report({
            increment: 10,
            message: `采集进度: ${progressValue}%`
          });
        }
      }, 500);

      const finish = () => {
        finished = true;
        clearInterval(progressTimer);
      };

      token.onCancellationRequested(() => {
        if (finished) {
          return;
        }

        finish();
        currentDevice.stopCapture().then(() => {
          vscode.window.showInformationMessage('数据采集已取消');
          reject(new Error('数据采集已取消'));
        }).catch((error: unknown) => {
          vscode.window.showErrorMessage(`停止采集失败: ${error instanceof Error ? error.message : String(error)}`);
          reject(error as Error);
        });
      });

      const captureCompletedHandler = (args: { success: boolean; session: CaptureSession }) => {
        if (finished) {
          return;
        }

        finish();

        if (!args.success || !args.session) {
          const errorMsg = '采集失败';
          vscode.window.showErrorMessage(`数据采集失败: ${errorMsg}`);
          reject(new Error(errorMsg));
          return;
        }

        progress.report({ increment: 10, message: '采集完成，正在处理数据...' });

        try {
          if (options.saveToWorkspace) {
            saveCaptureData(args.session)
              .then(() => {
                vscode.window.showInformationMessage(
                  `数据采集成功！共采集 ${args.session.totalSamples} 个样本`
                );
                resolve(args.session);
              })
              .catch((saveError: unknown) => {
                vscode.window.showErrorMessage(`保存采集数据失败: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
                reject(saveError as Error);
              });
          } else {
            vscode.window.showInformationMessage(
              `数据采集成功！共采集 ${args.session.totalSamples} 个样本`
            );
            resolve(args.session);
          }
        } catch (saveError) {
          vscode.window.showErrorMessage(`保存采集数据失败: ${saveError}`);
          reject(saveError);
        }
      };

      currentDevice.startCapture(captureSession, captureCompletedHandler as unknown as CaptureCompletedHandler)
        .then(result => {
          if (result !== CaptureError.None && !finished) {
            finish();
            const errorMsg = `采集启动失败，错误代码: ${result}`;
            vscode.window.showErrorMessage(errorMsg);
            reject(new Error(errorMsg));
          }
        })
        .catch((error: unknown) => {
          if (!finished) {
            finish();
            vscode.window.showErrorMessage(`启动采集异常: ${error instanceof Error ? error.message : String(error)}`);
            reject(error as Error);
          }
        });
    });
  });
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

// 获取采集配置的辅助函数
async function getCaptureConfiguration(): Promise<CaptureWorkflowConfig | null> {
  try {
    // 采样频率配置
    const frequencyInput = await vscode.window.showInputBox({
      prompt: '请输入采样频率 (Hz)',
      value: '1000000',
      validateInput: (value) => {
        const freq = parseInt(value);
        if (isNaN(freq) || freq < 1000 || freq > 100000000) {
          return '采样频率必须在1kHz-100MHz之间';
        }
        return null;
      }
    });

    if (!frequencyInput) return null;

    const preSamplesInput = await vscode.window.showInputBox({
      prompt: '请输入触发前样本数量',
      value: `${lastCaptureConfig?.preTriggerSamples ?? 100}`,
      validateInput: (value) => {
        const samples = parseInt(value);
        if (isNaN(samples) || samples < 0 || samples > 1000000) {
          return '触发前样本数量必须在0-1000000之间';
        }
        return null;
      }
    });

    if (!preSamplesInput) return null;

    const postSamplesInput = await vscode.window.showInputBox({
      prompt: '请输入触发后样本数量',
      value: `${lastCaptureConfig?.postTriggerSamples ?? 1000}`,
      validateInput: (value) => {
        const samples = parseInt(value);
        if (isNaN(samples) || samples < 1 || samples > 1000000) {
          return '触发后样本数量必须在1-1000000之间';
        }
        return null;
      }
    });

    if (!postSamplesInput) return null;

    const triggerTypeItem = await vscode.window.showQuickPick(
      ['Edge', 'Fast', 'Complex', 'Blast'],
      { placeHolder: '选择触发模式' }
    );

    if (!triggerTypeItem) return null;

    // 触发通道配置
    const triggerChannelInput = await vscode.window.showInputBox({
      prompt: '请输入触发通道 (0-23)',
      value: '0',
      validateInput: (value) => {
        const channel = parseInt(value);
        if (isNaN(channel) || channel < 0 || channel > 23) {
          return '触发通道必须在0-23之间';
        }
        return null;
      }
    });

    if (!triggerChannelInput) return null;

    // 活动通道配置
    const activeChannelsInput = await vscode.window.showInputBox({
      prompt: '请输入活动通道 (例如: 0,1,2,3)',
      value: '0,1,2,3',
      validateInput: (value) => {
        const channels = value.split(',').map(ch => parseInt(ch.trim()));
        if (channels.some(ch => isNaN(ch) || ch < 0 || ch > 23)) {
          return '通道号必须在0-23之间';
        }
        return null;
      }
    });

    if (!activeChannelsInput) return null;

    const channelNumbers = activeChannelsInput.split(',').map(ch => parseInt(ch.trim()));
    const channels = channelNumbers.map(channelNumber => ({
      number: channelNumber,
      name: `Channel ${channelNumber + 1}`,
      enabled: true
    }));

    return {
      frequency: parseInt(frequencyInput),
      preTriggerSamples: parseInt(preSamplesInput),
      postTriggerSamples: parseInt(postSamplesInput),
      triggerType: triggerTypeItem,
      triggerChannel: parseInt(triggerChannelInput),
      triggerInverted: false,
      loopCount: triggerTypeItem === 'Blast' ? 1 : 0,
      measureBursts: triggerTypeItem === 'Blast',
      channels,
      activeChannels: channelNumbers
    };
  } catch (error: unknown) {
    vscode.window.showErrorMessage(`获取采集配置失败: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// 创建采集会话的辅助函数
function createCaptureSession(config: CaptureWorkflowConfig): CaptureSession {
  const session = new CaptureSession();

  // 基础配置
  session.frequency = config.frequency;
  session.postTriggerSamples = config.postTriggerSamples;
  session.preTriggerSamples = config.preTriggerSamples;
  session.triggerChannel = config.triggerChannel;
  session.triggerType = parseTriggerType(config.triggerType);
  session.triggerInverted = config.triggerInverted ?? false;
  session.triggerPattern = config.triggerPattern ?? 0;
  session.triggerBitCount = config.triggerBitCount ?? 1;
  session.loopCount = config.loopCount ?? 0;
  session.measureBursts = config.measureBursts ?? false;

  // 配置活动通道
  const channels = normalizeCaptureChannels(config);
  session.captureChannels = channels.map(channelConfig => {
    const channel = new AnalyzerChannel(
      channelConfig.number,
      channelConfig.name || `Channel ${channelConfig.number + 1}`
    );
    channel.hidden = false;
    return channel;
  });

  return session;
}

function parseTriggerType(value: CaptureWorkflowConfig['triggerType']): TriggerType {
  if (typeof value === 'number') {
    return value;
  }

  switch (value) {
    case 'Fast':
      return TriggerType.Fast;
    case 'Complex':
      return TriggerType.Complex;
    case 'Blast':
      return TriggerType.Blast;
    case 'Edge':
    default:
      return TriggerType.Edge;
  }
}

function normalizeCaptureChannels(config: CaptureWorkflowConfig): CaptureWorkflowChannel[] {
  if (Array.isArray(config.channels) && config.channels.length > 0) {
    return config.channels
      .filter(channel => channel.enabled !== false)
      .map(channel => ({
        number: channel.number,
        name: channel.name,
        enabled: true
      }));
  }

  return (config.activeChannels ?? [0, 1, 2, 3]).map(number => ({
    number,
    name: `Channel ${number + 1}`,
    enabled: true
  }));
}

function cloneCaptureWorkflowConfig(config: CaptureWorkflowConfig): CaptureWorkflowConfig {
  return {
    ...config,
    channels: config.channels?.map(channel => ({ ...channel })),
    activeChannels: config.activeChannels ? [...config.activeChannels] : undefined
  };
}

// 保存采集数据的辅助函数
async function saveCaptureData(session: CaptureSession): Promise<void> {
  try {
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `capture_${timestamp}.lac`;

    // 获取工作区根目录
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('未打开工作区，无法保存文件');
    }

    // 创建文件路径
    const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
    const fileUri = vscode.Uri.file(filePath);

    // 转换为LAC格式
    const lacData = LACFileFormat.createFromCaptureSession(session);
    const lacContent = JSON.stringify(lacData, null, 2);

    // 写入文件
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(lacContent));

    // 询问是否打开文件
    const action = await vscode.window.showInformationMessage(
      `采集数据已保存到: ${fileName}`,
      '打开文件',
      '关闭'
    );

    if (action === '打开文件') {
      await vscode.commands.executeCommand('vscode.open', fileUri);
    }
  } catch (error: unknown) {
    throw new Error(`保存采集数据失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
