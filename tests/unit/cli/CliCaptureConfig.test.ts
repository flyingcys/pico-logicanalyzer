import { TriggerType } from '../../../src/models/AnalyzerTypes';
import {
  buildCaptureSession,
  loadCaptureConfigFile,
  parseChannelList,
  saveCaptureConfigFile,
  validateCaptureConfig
} from '../../../src/tools/CliCaptureConfig';
import { mkdtemp, readFile, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

describe('CliCaptureConfig', () => {
  it('解析单通道、范围和去重后的通道列表', () => {
    expect(parseChannelList('0,2-4,4,7')).toEqual([0, 2, 3, 4, 7]);
  });

  it('拒绝原版不支持的通道编号', () => {
    expect(() => parseChannelList('0,24')).toThrow('通道编号必须在 0-23 之间');
  });

  it('构建 CaptureSession 并保留触发配置', () => {
    const session = buildCaptureSession({
      device: 'COM3',
      frequency: 24000000,
      preTriggerSamples: 32,
      postTriggerSamples: 128,
      channels: [0, 1],
      triggerType: TriggerType.Fast,
      triggerChannel: 1,
      triggerInverted: true,
      triggerBitCount: 2,
      triggerPattern: 3,
      loopCount: 0,
      measureBursts: false,
      output: 'capture.lac',
      format: 'lac'
    });

    expect(session.frequency).toBe(24000000);
    expect(session.preTriggerSamples).toBe(32);
    expect(session.postTriggerSamples).toBe(128);
    expect(session.triggerType).toBe(TriggerType.Fast);
    expect(session.triggerChannel).toBe(1);
    expect(session.captureChannels.map(channel => channel.channelNumber)).toEqual([0, 1]);
  });

  it('校验 Blast 触发的原版关键约束', () => {
    const errors = validateCaptureConfig({
      device: 'COM3',
      frequency: 100000000,
      preTriggerSamples: 1,
      postTriggerSamples: 128,
      channels: [0],
      triggerType: TriggerType.Blast,
      triggerChannel: 0,
      triggerInverted: false,
      triggerBitCount: 1,
      triggerPattern: 0,
      loopCount: 1,
      measureBursts: false,
      output: 'capture.lac',
      format: 'lac'
    });

    expect(errors).toContain('Blast 模式要求 pre-trigger 样本数为 0');
    expect(errors).toContain('Blast 模式要求 loop-count 为 0');
  });

  it('读写 .tcs 采集配置文件并兼容 PascalCase 字段', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'logic-cli-config-'));
    const file = path.join(tempDir, 'capture.tcs');

    try {
      await saveCaptureConfigFile(file, {
        device: '192.168.1.20:4045',
        frequency: 1000000,
        preTriggerSamples: 4,
        postTriggerSamples: 12,
        channels: [0, 3],
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        triggerBitCount: 1,
        triggerPattern: 0,
        loopCount: 0,
        measureBursts: false,
        output: 'capture.csv',
        format: 'csv'
      });

      const raw = await readFile(file, 'utf8');
      expect(JSON.parse(raw)).toMatchObject({
        FormatVersion: 1,
        Device: '192.168.1.20:4045',
        Frequency: 1000000,
        CaptureChannels: [0, 3]
      });

      await expect(loadCaptureConfigFile(file)).resolves.toMatchObject({
        device: '192.168.1.20:4045',
        frequency: 1000000,
        channels: [0, 3],
        format: 'csv'
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
