import { CaptureError } from '../models/AnalyzerTypes';
import { CaptureSession } from '../models/CaptureModels';
import { LogicAnalyzerDriver } from '../drivers/LogicAnalyzerDriver';
import { buildCaptureSession, CliCaptureConfig, CliNetworkConfig } from './CliCaptureConfig';

export interface CliCaptureRunner {
  capture(config: CliCaptureConfig): Promise<CaptureSession>;
  sendNetworkConfig(config: CliNetworkConfig): Promise<void>;
}

export class MockCliCaptureRunner implements CliCaptureRunner {
  async capture(config: CliCaptureConfig): Promise<CaptureSession> {
    const session = buildCaptureSession(config);
    const totalSamples = session.totalSamples;

    for (const channel of session.captureChannels) {
      const samples = new Uint8Array(totalSamples);
      for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex++) {
        samples[sampleIndex] = (sampleIndex + channel.channelNumber) % 2;
      }
      channel.samples = samples;
    }

    return session;
  }

  async sendNetworkConfig(_config: CliNetworkConfig): Promise<void> {
    return undefined;
  }
}

export class LogicAnalyzerCliCaptureRunner implements CliCaptureRunner {
  async capture(config: CliCaptureConfig): Promise<CaptureSession> {
    const driver = new LogicAnalyzerDriver(config.device);
    const connection = await driver.connect({});
    if (!connection.success) {
      throw new Error(connection.error || '设备连接失败');
    }

    try {
      const session = buildCaptureSession(config);
      const completed = new Promise<CaptureSession>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('采集超时')), 30000);
        driver.startCapture(session, args => {
          clearTimeout(timeout);
          if (args.success) {
            resolve(args.session as CaptureSession);
          } else {
            reject(new Error('采集失败'));
          }
        }).then(error => {
          if (error !== CaptureError.None) {
            clearTimeout(timeout);
            reject(new Error(`采集启动失败: ${error}`));
          }
        }).catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      return await completed;
    } finally {
      await driver.disconnect();
    }
  }

  async sendNetworkConfig(config: CliNetworkConfig): Promise<void> {
    const driver = new LogicAnalyzerDriver(config.device);
    const connection = await driver.connect({});
    if (!connection.success) {
      throw new Error(connection.error || '设备连接失败');
    }

    try {
      const success = await driver.sendNetworkConfig(config.ssid, config.password, config.ipAddress, config.port);
      if (!success) {
        throw new Error('设备拒绝网络配置命令');
      }
    } finally {
      await driver.disconnect();
    }
  }
}
