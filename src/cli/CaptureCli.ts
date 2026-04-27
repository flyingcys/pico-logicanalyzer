import { Command } from 'commander';
import {
  CliCaptureConfig,
  CliNetworkConfig,
  loadCaptureConfigFile,
  normalizeFormat,
  parseChannelList,
  parseTriggerType,
  saveCaptureConfigFile,
  validateCaptureConfig
} from '../tools/CliCaptureConfig';
import { LogicAnalyzerCliCaptureRunner, MockCliCaptureRunner } from '../tools/CliCaptureRunner';
import { writeCaptureOutput } from '../tools/CliCaptureExporter';
import { TriggerType } from '../models/AnalyzerTypes';

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export interface CliDeps {
  capture?: (config: CliCaptureConfig) => Promise<any>;
  sendNetworkConfig?: (config: CliNetworkConfig) => Promise<void>;
}

const defaultIo: CliIo = {
  stdout: line => process.stdout.write(`${line}\n`),
  stderr: line => process.stderr.write(`${line}\n`)
};

export async function runCli(argv: string[], io: CliIo = defaultIo, deps: CliDeps = {}): Promise<number> {
  const program = createProgram(io, deps);

  try {
    await program.parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    const exitCode = typeof (error as any).exitCode === 'number' ? (error as any).exitCode : 1;
    if ((error as any).code !== 'commander.helpDisplayed') {
      io.stderr(error instanceof Error ? error.message : String(error));
    }
    return exitCode;
  }
}

export function createProgram(io: CliIo = defaultIo, deps: CliDeps = {}): Command {
  const program = new Command();

  program
    .name('logic-analyzer-capture')
    .description('Pico Logic Analyzer 命令行采集工具')
    .version('1.0.0-beta.0')
    .exitOverride()
    .configureOutput({
      writeOut: value => io.stdout(value.trimEnd()),
      writeErr: value => io.stderr(value.trimEnd())
    });

  program
    .command('capture')
    .description('连接设备、执行一次采集并输出 .lac 或 .csv')
    .option('--device <address>', '串口设备路径或 host:port 网络地址')
    .option('--frequency <hz>', '采样率 Hz', parseNumber)
    .option('--pre <samples>', '触发前样本数', parseNumber)
    .option('--post <samples>', '触发后样本数', parseNumber)
    .option('--channels <list>', '通道列表，例如 0,1,4-7')
    .option('--trigger <type>', '触发类型: edge, complex, fast, blast', 'edge')
    .option('--trigger-channel <channel>', '触发通道', parseNumber, 0)
    .option('--trigger-inverted', '触发极性反转')
    .option('--trigger-bit-count <bits>', '触发位宽', parseNumber, 1)
    .option('--trigger-pattern <value>', '复杂触发模式', parsePattern, 0)
    .option('--loop-count <count>', '突发循环次数', parseNumber, 0)
    .option('--measure-bursts', '记录突发间隔')
    .option('--output <file>', '输出文件')
    .option('--format <format>', '输出格式: lac 或 csv')
    .option('--config <file>', '读取 .tcs/JSON 采集配置')
    .option('--write-config <file>', '采集前写出当前配置')
    .option('--mock', '使用内置 mock 设备生成确定性样本')
    .action(async options => {
      const config = await resolveCaptureConfig(options);
      const errors = validateCaptureConfig(config);
      if (errors.length > 0) {
        throw commanderError(errors.join('\n'), 2);
      }

      if (options.writeConfig) {
        await saveCaptureConfigFile(options.writeConfig, config);
        io.stdout(`已写出采集配置: ${options.writeConfig}`);
      }

      const runner = options.mock ? new MockCliCaptureRunner() : new LogicAnalyzerCliCaptureRunner();
      const session = deps.capture ? await deps.capture(config) : await runner.capture(config);
      await writeCaptureOutput(session, config.output, config.format);
      io.stdout(`采集完成: ${config.output}`);
    });

  program
    .command('network-config')
    .description('通过串口设备写入 Pico W 网络配置')
    .requiredOption('--device <address>', '串口设备路径')
    .requiredOption('--ssid <ssid>', 'WiFi SSID')
    .requiredOption('--password <password>', 'WiFi 密码')
    .requiredOption('--ip <address>', '设备 IP 地址')
    .option('--port <port>', '设备监听端口', parseNumber, 4045)
    .option('--mock', '使用 mock runner')
    .action(async options => {
      const config: CliNetworkConfig = {
        device: options.device,
        ssid: options.ssid,
        password: options.password,
        ipAddress: options.ip,
        port: options.port
      };

      if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
        throw commanderError('端口必须在 1-65535 之间', 2);
      }

      const runner = options.mock ? new MockCliCaptureRunner() : new LogicAnalyzerCliCaptureRunner();
      if (deps.sendNetworkConfig) {
        await deps.sendNetworkConfig(config);
      } else {
        await runner.sendNetworkConfig(config);
      }
      io.stdout('网络配置已发送');
    });

  program
    .command('write-config')
    .description('仅写出 .tcs/JSON 采集配置，不执行采集')
    .requiredOption('--file <file>', '配置文件路径')
    .option('--device <address>', '串口设备路径或 host:port 网络地址', 'mock')
    .option('--frequency <hz>', '采样率 Hz', parseNumber, 1000000)
    .option('--pre <samples>', '触发前样本数', parseNumber, 0)
    .option('--post <samples>', '触发后样本数', parseNumber, 1000)
    .option('--channels <list>', '通道列表，例如 0,1,4-7', '0')
    .option('--trigger <type>', '触发类型: edge, complex, fast, blast', 'edge')
    .option('--output <file>', '输出文件', 'capture.lac')
    .option('--format <format>', '输出格式: lac 或 csv', 'lac')
    .action(async options => {
      const config = await resolveCaptureConfig(options);
      const errors = validateCaptureConfig(config);
      if (errors.length > 0) {
        throw commanderError(errors.join('\n'), 2);
      }
      await saveCaptureConfigFile(options.file, config);
      io.stdout(`已写出采集配置: ${options.file}`);
    });

  return program;
}

async function resolveCaptureConfig(options: any): Promise<CliCaptureConfig> {
  const fromFile = options.config ? await loadCaptureConfigFile(options.config) : {};
  const merged: any = { ...fromFile, ...compactOptions(options) };

  const output = merged.output || defaultOutputForFormat(merged.format);
  const format = normalizeFormat(merged.format || inferFormatFromOutput(output)) || 'lac';

  return {
    device: merged.device || '',
    frequency: Number(merged.frequency ?? 1000000),
    preTriggerSamples: Number(merged.preTriggerSamples ?? merged.pre ?? 0),
    postTriggerSamples: Number(merged.postTriggerSamples ?? merged.post ?? 1000),
    channels: parseChannelList(merged.channels ?? '0'),
    triggerType: parseTriggerType(merged.triggerType ?? merged.trigger ?? TriggerType.Edge),
    triggerChannel: Number(merged.triggerChannel ?? 0),
    triggerInverted: Boolean(merged.triggerInverted),
    triggerBitCount: Number(merged.triggerBitCount ?? 1),
    triggerPattern: Number(merged.triggerPattern ?? 0),
    loopCount: Number(merged.loopCount ?? 0),
    measureBursts: Boolean(merged.measureBursts),
    output,
    format
  };
}

function compactOptions(options: any): Record<string, any> {
  const compacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      compacted[key] = value;
    }
  }
  return compacted;
}

function inferFormatFromOutput(output: string): 'lac' | 'csv' {
  return output.toLowerCase().endsWith('.csv') ? 'csv' : 'lac';
}

function defaultOutputForFormat(format?: string): string {
  return normalizeFormat(format) === 'csv' ? 'capture.csv' : 'capture.lac';
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`数值无效: ${value}`);
  }
  return parsed;
}

function parsePattern(value: string): number {
  const trimmed = String(value).trim();
  const parsed = trimmed.startsWith('0x') || trimmed.startsWith('0X')
    ? Number.parseInt(trimmed, 16)
    : Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`触发模式无效: ${value}`);
  }
  return parsed;
}

function commanderError(message: string, exitCode: number): Error {
  const error = new Error(message) as Error & { exitCode: number };
  error.exitCode = exitCode;
  return error;
}
