import { mkdtemp, readFile, rm } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runCli } from '../../../src/cli/CaptureCli';

describe('CaptureCli', () => {
  let tempDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'logic-cli-command-'));
    stdout = [];
    stderr = [];
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('使用 mock 设备采集并写出 .lac 文件', async () => {
    const output = path.join(tempDir, 'capture.lac');

    const exitCode = await runCli(
      [
        'capture',
        '--mock',
        '--device',
        'mock',
        '--frequency',
        '1000000',
        '--pre',
        '2',
        '--post',
        '6',
        '--channels',
        '0,1',
        '--output',
        output,
        '--format',
        'lac'
      ],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }
    );

    expect(exitCode).toBe(0);
    expect(stdout.join('\n')).toContain('采集完成');
    const exported = JSON.parse(await readFile(output, 'utf8'));
    expect(exported.Settings.Frequency).toBe(1000000);
    expect(exported.Settings.CaptureChannels).toHaveLength(2);
    expect(exported.Settings.CaptureChannels[0].Samples).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it('使用 mock 设备采集并写出 .csv 文件', async () => {
    const output = path.join(tempDir, 'capture.csv');

    const exitCode = await runCli(
      [
        'capture',
        '--mock',
        '--device',
        'mock',
        '--frequency',
        '1000000',
        '--pre',
        '0',
        '--post',
        '4',
        '--channels',
        '0,1',
        '--output',
        output,
        '--format',
        'csv'
      ],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }
    );

    expect(exitCode).toBe(0);
    expect(await readFile(output, 'utf8')).toBe(
      ['Time,Channel 1,Channel 2', '0.000000,0,1', '0.001000,1,0', '0.002000,0,1', '0.003000,1,0'].join('\n')
    );
  });

  it('参数校验失败时不执行采集', async () => {
    const exitCode = await runCli(
      [
        'capture',
        '--mock',
        '--device',
        'mock',
        '--frequency',
        '0',
        '--pre',
        '0',
        '--post',
        '4',
        '--channels',
        '0',
        '--output',
        path.join(tempDir, 'capture.csv'),
        '--format',
        'csv'
      ],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }
    );

    expect(exitCode).toBe(2);
    expect(stderr.join('\n')).toContain('采样率必须大于 0');
  });

  it('网络配置命令调用 runner 并传递设备参数', async () => {
    const sendNetworkConfig = jest.fn().mockResolvedValue(undefined);

    const exitCode = await runCli(
      [
        'network-config',
        '--device',
        'COM3',
        '--ssid',
        'Lab',
        '--password',
        'secret',
        '--ip',
        '192.168.1.50',
        '--port',
        '4045'
      ],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) },
      { sendNetworkConfig }
    );

    expect(exitCode).toBe(0);
    expect(sendNetworkConfig).toHaveBeenCalledWith({
      device: 'COM3',
      ssid: 'Lab',
      password: 'secret',
      ipAddress: '192.168.1.50',
      port: 4045
    });
  });
});
