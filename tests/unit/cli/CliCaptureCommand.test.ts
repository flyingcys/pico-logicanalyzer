import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { runCli } from '../../../src/cli/CaptureCli';
import { LACFileFormat } from '../../../src/models/LACFileFormat';

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
    const session = LACFileFormat.convertToCaptureSession(exported);
    expect(session.captureChannels).toHaveLength(2);
    expect(Array.from(session.captureChannels[0].samples || [])).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
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

  it('使用 mock 设备采集并写出 .json 文件', async () => {
    const output = path.join(tempDir, 'capture.json');

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
        'json'
      ],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }
    );

    expect(exitCode).toBe(0);
    const exported = JSON.parse(await readFile(output, 'utf8'));
    expect(exported.timebase.sampleRate).toBe(1000000);
    expect(exported.channels).toEqual([
      { number: 0, name: 'Channel 1', hidden: false },
      { number: 1, name: 'Channel 2', hidden: false }
    ]);
    expect(exported.samples).toEqual([
      { index: 0, timeMs: 0, values: { '0': 0, '1': 1 } },
      { index: 1, timeMs: 0.001, values: { '0': 1, '1': 0 } },
      { index: 2, timeMs: 0.002, values: { '0': 0, '1': 1 } },
      { index: 3, timeMs: 0.003, values: { '0': 1, '1': 0 } }
    ]);
  });

  it('repeat 参数按模板执行多次采集并避免覆盖输出', async () => {
    const output = path.join(tempDir, 'repeat-{index}.csv');

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
        '2',
        '--channels',
        '0',
        '--output',
        output,
        '--format',
        'csv',
        '--repeat',
        '2'
      ],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }
    );

    expect(exitCode).toBe(0);
    await expect(readFile(path.join(tempDir, 'repeat-1.csv'), 'utf8')).resolves.toContain('Time,Channel 1');
    await expect(readFile(path.join(tempDir, 'repeat-2.csv'), 'utf8')).resolves.toContain('0.001000,1');
    expect(stdout.join('\n')).toContain('采集完成:');
    expect(stdout.join('\n')).toContain('2/2');
  });

  it('batch 命令按文件顺序执行多个采集任务', async () => {
    const batchFile = path.join(tempDir, 'batch.json');
    await writeFile(batchFile, JSON.stringify({
      captures: [
        {
          device: 'mock',
          frequency: 1000000,
          pre: 0,
          post: 2,
          channels: '0',
          output: path.join(tempDir, 'batch-a.csv'),
          format: 'csv'
        },
        {
          device: 'mock',
          frequency: 1000000,
          pre: 0,
          post: 2,
          channels: '0,1',
          output: path.join(tempDir, 'batch-b.json'),
          format: 'json'
        }
      ]
    }), 'utf8');

    const exitCode = await runCli(
      ['batch', '--mock', '--file', batchFile],
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) }
    );

    expect(exitCode).toBe(0);
    await expect(readFile(path.join(tempDir, 'batch-a.csv'), 'utf8')).resolves.toContain('Time,Channel 1');
    await expect(readFile(path.join(tempDir, 'batch-b.json'), 'utf8')).resolves.toContain('"timebase"');
    expect(stdout.join('\n')).toContain('批处理完成: 2/2');
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

  it('真实 runner 采集失败时返回可脚本化错误码', async () => {
    const capture = jest.fn().mockRejectedValue(new Error('设备连接失败'));

    const exitCode = await runCli(
      [
        'capture',
        '--device',
        'COM3',
        '--frequency',
        '1000000',
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
      { stdout: line => stdout.push(line), stderr: line => stderr.push(line) },
      { capture }
    );

    expect(exitCode).toBe(3);
    expect(stderr.join('\n')).toContain('设备连接失败');
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
