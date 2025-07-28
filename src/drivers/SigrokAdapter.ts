import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AnalyzerDriverBase } from './AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  CaptureEventArgs,
  CaptureCompletedHandler,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus,
  CaptureMode
} from '../models/AnalyzerTypes';

/**
 * sigrok通用驱动适配器
 * 通过sigrok-cli命令行工具支持80+种硬件设备
 * 包括：fx2lafw, hantek-dso, rigol-ds, saleae-logic16, openbench-logic-sniffer等
 */
export class SigrokAdapter extends AnalyzerDriverBase {
  // sigrok支持的设备类型映射
  private static readonly SIGROK_DRIVERS = new Map([
    // USB逻辑分析器
    ['fx2lafw', { name: 'FX2 Logic Analyzer', channels: 16, maxRate: 24000000 }],
    ['saleae-logic16', { name: 'Saleae Logic16', channels: 16, maxRate: 100000000 }],
    ['openbench-logic-sniffer', { name: 'OpenBench Logic Sniffer', channels: 32, maxRate: 200000000 }],
    ['kingst-la2016', { name: 'Kingst LA2016', channels: 16, maxRate: 200000000 }],
    ['hantek-6022be', { name: 'Hantek 6022BE', channels: 2, maxRate: 48000000 }],
    
    // 示波器的逻辑分析功能
    ['rigol-ds', { name: 'Rigol DS Series', channels: 16, maxRate: 1000000000 }],
    ['siglent-sds', { name: 'Siglent SDS Series', channels: 16, maxRate: 1000000000 }],
    ['tek-mso', { name: 'Tektronix MSO Series', channels: 16, maxRate: 2500000000 }],
    ['lecroy-logicstudio', { name: 'LeCroy LogicStudio', channels: 16, maxRate: 500000000 }],
    
    // 其他专业设备
    ['chronovu-la', { name: 'ChronoVu LA Series', channels: 32, maxRate: 200000000 }],
    ['ikalogic-scanalogic2', { name: 'Ikalogic Scanalogic-2', channels: 4, maxRate: 20000000 }],
    ['link-mso19', { name: 'Link MSO-19', channels: 16, maxRate: 200000000 }],
    ['zeroplus-logic-cube', { name: 'Zeroplus Logic Cube', channels: 16, maxRate: 200000000 }]
  ]);

  // 属性实现
  get deviceVersion(): string | null {
    return this._version;
  }
  get channelCount(): number {
    return this._channelCount;
  }
  get maxFrequency(): number {
    return this._maxFrequency;
  }
  get blastFrequency(): number {
    return this._blastFrequency;
  }
  get bufferSize(): number {
    return this._bufferSize;
  }
  get isNetwork(): boolean {
    return false; // sigrok主要通过USB等本地接口
  }
  get isCapturing(): boolean {
    return this._capturing;
  }
  get driverType(): AnalyzerDriverType {
    return AnalyzerDriverType.Serial; // 通过本地接口
  }

  // 私有变量
  private _capturing: boolean = false;
  private _version: string | null = null;
  private _channelCount: number = 8;
  private _maxFrequency: number = 24000000; // 24MHz默认
  private _blastFrequency: number = 100000000; // 100MHz默认
  private _bufferSize: number = 2000000; // 2M样本默认
  private _isConnected: boolean = false;
  private _deviceDriver: string = '';
  private _deviceId: string = '';
  private _sigrokCliPath: string = 'sigrok-cli';
  private _tempDir: string = '';
  private _currentProcess: ChildProcess | null = null;

  constructor(
    deviceDriver: string = 'fx2lafw',
    deviceId?: string,
    sigrokCliPath?: string
  ) {
    super();

    this._deviceDriver = deviceDriver;
    this._deviceId = deviceId || '';
    this._sigrokCliPath = sigrokCliPath || 'sigrok-cli';
    this._tempDir = join(tmpdir(), `sigrok-${Date.now()}`);
  }

  /**
   * 连接设备
   */
  async connect(params?: ConnectionParams): Promise<ConnectionResult> {
    try {
      // 检查sigrok-cli是否可用
      await this.checkSigrokCli();

      // 扫描设备
      const devices = await this.scanDevices();
      if (devices.length === 0) {
        throw new Error('未发现支持的sigrok设备');
      }

      // 选择设备
      const selectedDevice = this.selectBestDevice(devices);
      this._deviceId = selectedDevice.id;
      this._deviceDriver = selectedDevice.driver;

      // 查询设备信息
      await this.queryDeviceInfo();

      // 创建临时目录
      await fs.mkdir(this._tempDir, { recursive: true });

      this._isConnected = true;

      return {
        success: true,
        deviceInfo: {
          name: this._version || `Sigrok ${this._deviceDriver}`,
          version: this._version ?? undefined,
          type: this.driverType,
          connectionPath: `${this._deviceDriver}:${this._deviceId}`,
          isNetwork: false,
          capabilities: this.buildCapabilities()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败'
      };
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this._isConnected = false;

    // 停止当前进程
    if (this._currentProcess) {
      this._currentProcess.kill('SIGTERM');
      this._currentProcess = null;
    }

    // 清理临时目录
    try {
      await fs.rm(this._tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('清理临时目录失败:', error);
    }
  }

  /**
   * 获取设备状态
   */
  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: this._isConnected,
      isCapturing: this._capturing,
      batteryVoltage: 'N/A' // sigrok设备通常不报告电池状态
    };
  }

  /**
   * 开始采集
   */
  async startCapture(
    session: CaptureSession,
    captureCompletedHandler?: CaptureCompletedHandler
  ): Promise<CaptureError> {
    if (this._capturing) {
      return CaptureError.Busy;
    }

    if (!this._isConnected) {
      return CaptureError.HardwareError;
    }

    try {
      this._capturing = true;

      // 设置捕获完成处理器
      if (captureCompletedHandler) {
        this.once('captureCompleted', captureCompletedHandler);
      }

      // 启动sigrok采集
      await this.startSigrokCapture(session);

      return CaptureError.None;
    } catch (error) {
      this._capturing = false;
      console.error('sigrok采集启动失败:', error);
      return CaptureError.UnexpectedError;
    }
  }

  /**
   * 停止采集
   */
  async stopCapture(): Promise<boolean> {
    if (!this._capturing) {
      return true;
    }

    try {
      if (this._currentProcess) {
        this._currentProcess.kill('SIGTERM');
        this._currentProcess = null;
      }

      this._capturing = false;
      return true;
    } catch (error) {
      console.error('停止sigrok采集失败:', error);
      return false;
    }
  }

  /**
   * 进入引导加载程序模式（不支持）
   */
  async enterBootloader(): Promise<boolean> {
    return false; // sigrok设备通常不支持引导加载程序模式
  }

  /**
   * 检查sigrok-cli是否可用
   */
  private async checkSigrokCli(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this._sigrokCliPath, ['--version']);

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('sigrok-cli版本:', output.trim());
          resolve();
        } else {
          reject(new Error('sigrok-cli未安装或不可用。请安装sigrok软件包。'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`sigrok-cli执行失败: ${error.message}`));
      });
    });
  }

  /**
   * 扫描sigrok设备
   */
  private async scanDevices(): Promise<Array<{ id: string; driver: string; description: string }>> {
    return new Promise((resolve, reject) => {
      const process = spawn(this._sigrokCliPath, ['--scan']);

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          const devices = this.parseScanOutput(output);
          resolve(devices);
        } else {
          reject(new Error('设备扫描失败'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`设备扫描执行失败: ${error.message}`));
      });
    });
  }

  /**
   * 解析扫描输出
   */
  private parseScanOutput(output: string): Array<{ id: string; driver: string; description: string }> {
    const devices: Array<{ id: string; driver: string; description: string }> = [];
    const lines = output.split('\\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('The following')) continue;

      // 解析格式: "driver:conn=value - Description"
      const match = trimmed.match(/^([^:]+):([^-]+)\\s*-\\s*(.+)$/);
      if (match) {
        const driver = match[1].trim();
        const connection = match[2].trim();
        const description = match[3].trim();

        devices.push({
          id: connection,
          driver: driver,
          description: description
        });
      }
    }

    return devices;
  }

  /**
   * 选择最佳设备
   */
  private selectBestDevice(devices: Array<{ id: string; driver: string; description: string }>): { id: string; driver: string; description: string } {
    // 如果指定了设备驱动，优先选择
    if (this._deviceDriver) {
      const matchingDevice = devices.find(d => d.driver === this._deviceDriver);
      if (matchingDevice) {
        return matchingDevice;
      }
    }

    // 如果指定了设备ID，优先选择
    if (this._deviceId) {
      const matchingDevice = devices.find(d => d.id.includes(this._deviceId));
      if (matchingDevice) {
        return matchingDevice;
      }
    }

    // 否则选择第一个可用设备
    return devices[0];
  }

  /**
   * 查询设备信息
   */
  private async queryDeviceInfo(): Promise<void> {
    try {
      // 查询设备配置信息
      const configOutput = await this.runSigrokCommand([
        '--driver', this._deviceDriver,
        '--conn', this._deviceId,
        '--show'
      ]);

      this.parseDeviceConfig(configOutput);

      // 设置设备版本信息
      const driverInfo = SigrokAdapter.SIGROK_DRIVERS.get(this._deviceDriver);
      if (driverInfo) {
        this._version = driverInfo.name;
        this._channelCount = driverInfo.channels;
        this._maxFrequency = driverInfo.maxRate;
        this._blastFrequency = driverInfo.maxRate * 2;
      }
    } catch (error) {
      console.warn('查询设备信息失败:', error);
    }
  }

  /**
   * 解析设备配置
   */
  private parseDeviceConfig(output: string): void {
    const lines = output.split('\\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // 解析通道数
      if (trimmed.includes('channels:')) {
        const channelMatch = trimmed.match(/channels:\\s*(\\d+)/);
        if (channelMatch) {
          this._channelCount = parseInt(channelMatch[1], 10);
        }
      }

      // 解析采样率
      if (trimmed.includes('samplerate:')) {
        const rateMatch = trimmed.match(/samplerate:\\s*([0-9.]+)\\s*([kMG]?Hz)/);
        if (rateMatch) {
          let rate = parseFloat(rateMatch[1]);
          const unit = rateMatch[2];

          switch (unit) {
            case 'kHz':
              rate *= 1000;
              break;
            case 'MHz':
              rate *= 1000000;
              break;
            case 'GHz':
              rate *= 1000000000;
              break;
          }

          this._maxFrequency = rate;
          this._blastFrequency = rate;
        }
      }

      // 解析缓冲区大小
      if (trimmed.includes('limit_samples:')) {
        const sampleMatch = trimmed.match(/limit_samples:\\s*(\\d+)/);
        if (sampleMatch) {
          this._bufferSize = parseInt(sampleMatch[1], 10);
        }
      }
    }
  }

  /**
   * 启动sigrok采集
   */
  private async startSigrokCapture(session: CaptureSession): Promise<void> {
    const outputFile = join(this._tempDir, 'capture.sr');
    const totalSamples = session.preTriggerSamples + session.postTriggerSamples;

    // 构建sigrok-cli命令参数
    const args: string[] = [
      '--driver', this._deviceDriver,
      '--conn', this._deviceId,
      '--config', `samplerate=${session.frequency}`,
      '--samples', totalSamples.toString(),
      '--output-file', outputFile,
      '--output-format', 'srzip'
    ];

    // 配置通道
    const channels = session.captureChannels.map(ch => ch.channelNumber).join(',');
    if (channels) {
      args.push('--channels', channels);
    }

    // 配置触发
    if (session.triggerType !== undefined && session.triggerChannel !== undefined) {
      const triggerConfig = this.buildTriggerConfig(session);
      if (triggerConfig) {
        args.push('--triggers', triggerConfig);
      }
    }

    console.log('启动sigrok采集:', this._sigrokCliPath, args.join(' '));

    return new Promise((resolve, reject) => {
      this._currentProcess = spawn(this._sigrokCliPath, args);

      let errorOutput = '';

      this._currentProcess.stdout?.on('data', (data) => {
        console.log('sigrok输出:', data.toString());
      });

      this._currentProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      this._currentProcess.on('close', async (code) => {
        this._currentProcess = null;

        if (code === 0) {
          try {
            // 读取采集结果
            await this.processSigrokResults(session, outputFile);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`sigrok采集失败 (代码 ${code}): ${errorOutput}`));
        }
      });

      this._currentProcess.on('error', (error) => {
        this._currentProcess = null;
        reject(new Error(`sigrok采集进程错误: ${error.message}`));
      });
    });
  }

  /**
   * 构建触发配置
   */
  private buildTriggerConfig(session: CaptureSession): string | null {
    if (session.triggerChannel === undefined) return null;

    const channel = session.triggerChannel;
    let trigger = '';

    switch (session.triggerType) {
      case 0: // Edge
        trigger = session.triggerInverted ? `${channel}=f` : `${channel}=r`;
        break;
      case 1: // Complex/Pattern
        if (session.triggerPattern !== undefined) {
          // 将模式转换为sigrok格式
          const pattern = session.triggerPattern.toString(2).padStart(16, '0');
          trigger = pattern.split('').map((bit, index) => 
            bit === '1' ? `${index}=1` : bit === '0' ? `${index}=0` : ''
          ).filter(t => t).join(',');
        }
        break;
      default:
        trigger = `${channel}=r`; // 默认上升沿
    }

    return trigger;
  }

  /**
   * 处理sigrok采集结果
   */
  private async processSigrokResults(session: CaptureSession, outputFile: string): Promise<void> {
    try {
      // 将.sr文件转换为CSV格式以便解析
      const csvFile = join(this._tempDir, 'capture.csv');
      await this.convertSrToCSV(outputFile, csvFile);

      // 读取CSV数据
      const csvData = await fs.readFile(csvFile, 'utf-8');
      const lines = csvData.split('\\n');

      if (lines.length < 2) {
        throw new Error('采集数据为空');
      }

      // 解析CSV头部（通道名称）
      const headers = lines[0].split(',').map(h => h.trim());
      const dataLines = lines.slice(1).filter(line => line.trim());

      // 初始化通道数据
      for (const channel of session.captureChannels) {
        channel.samples = new Uint8Array(dataLines.length);
      }

      // 解析数据行
      for (let rowIndex = 0; rowIndex < dataLines.length; rowIndex++) {
        const values = dataLines[rowIndex].split(',');

        for (const channel of session.captureChannels) {
          const channelName = `D${channel.channelNumber}`;
          const columnIndex = headers.indexOf(channelName);

          if (columnIndex >= 0 && columnIndex < values.length) {
            const value = values[columnIndex].trim();
            channel.samples![rowIndex] = value === '1' ? 1 : 0;
          }
        }
      }

      this._capturing = false;

      const eventArgs: CaptureEventArgs = {
        success: true,
        session
      };

      this.emitCaptureCompleted(eventArgs);

    } catch (error) {
      this.handleCaptureError(session, `处理sigrok结果失败: ${error}`);
    }
  }

  /**
   * 将.sr文件转换为CSV格式
   */
  private async convertSrToCSV(srFile: string, csvFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(this._sigrokCliPath, [
        '--input-file', srFile,
        '--output-file', csvFile,
        '--output-format', 'csv'
      ]);

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`转换为CSV失败 (代码 ${code})`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`CSV转换进程错误: ${error.message}`));
      });
    });
  }

  /**
   * 处理采集错误
   */
  private handleCaptureError(session: CaptureSession, errorMessage: string): void {
    this._capturing = false;
    console.error('sigrok采集错误:', errorMessage);

    const eventArgs: CaptureEventArgs = {
      success: false,
      session
    };

    this.emitCaptureCompleted(eventArgs);
  }

  /**
   * 运行sigrok命令
   */
  private async runSigrokCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(this._sigrokCliPath, args);

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`sigrok命令失败 (代码 ${code}): ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`sigrok命令执行错误: ${error.message}`));
      });
    });
  }

  /**
   * 构建硬件能力描述
   */
  private buildCapabilities(): any {
    return {
      channels: {
        digital: this._channelCount,
        maxVoltage: 5.0,
        inputImpedance: 1000000
      },
      sampling: {
        maxRate: this._maxFrequency,
        minRate: this.minFrequency,
        supportedRates: [this._maxFrequency, this._blastFrequency],
        bufferSize: this._bufferSize,
        streamingSupport: false
      },
      triggers: {
        types: [0, 1], // Edge, Pattern
        maxChannels: this._channelCount,
        patternWidth: this._channelCount,
        sequentialSupport: false,
        conditions: ['rising', 'falling', 'high', 'low', 'change']
      },
      connectivity: {
        interfaces: ['usb', 'serial'],
        protocols: ['sigrok']
      },
      features: {
        signalGeneration: false,
        powerSupply: false,
        voltageMonitoring: false,
        protocolDecoding: true // sigrok有强大的协议解码功能
      }
    };
  }

  /**
   * 获取支持的设备列表
   */
  static getSupportedDevices(): Array<{ driver: string; name: string; channels: number; maxRate: number }> {
    return Array.from(SigrokAdapter.SIGROK_DRIVERS.entries()).map(([driver, info]) => ({
      driver,
      name: info.name,
      channels: info.channels,
      maxRate: info.maxRate
    }));
  }

  /**
   * 资源清理
   */
  override dispose(): void {
    this.disconnect();
    super.dispose();
  }
}