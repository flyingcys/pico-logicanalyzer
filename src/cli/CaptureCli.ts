import { Command } from 'commander';
import { readFile } from 'fs/promises';
import * as path from 'path';
import {
  CliCaptureConfig,
  CliNetworkConfig,
  CliOutputFormat,
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
import type { CaptureSession } from '../models/CaptureModels';

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export interface CliDeps {
  capture?: (config: CliCaptureConfig) => Promise<CaptureSession>;
  sendNetworkConfig?: (config: CliNetworkConfig) => Promise<void>;
}

const EXIT_USAGE = 2;
const EXIT_CAPTURE_FAILED = 3;
const EXIT_BATCH_FAILED = 4;

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
    const err = error as { exitCode?: number; code?: string };
    const exitCode = typeof err.exitCode === 'number' ? err.exitCode : 1;
    if (err.code !== 'commander.helpDisplayed') {
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
    .description('连接设备、执行一次或多次采集并输出 .lac、.csv 或 .json')
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
    .option('--format <format>', '输出格式: lac、csv 或 json')
    .option('--config <file>', '读取 .tcs/JSON 采集配置')
    .option('--write-config <file>', '采集前写出当前配置')
    .option('--repeat <count>', '重复采集次数', parseNumber, 1)
    .option('--mock', '使用内置 mock 设备生成确定性样本')
    .action(async options => {
      const config = await resolveCaptureConfig(options);
      validateCaptureCommand(config, options);

      if (options.writeConfig) {
        await saveCaptureConfigFile(options.writeConfig, config);
        io.stdout(`已写出采集配置: ${options.writeConfig}`);
      }

      await executeCaptureSequence(config, options, io, deps);
    });

  program
    .command('batch')
    .description('按 JSON 批处理文件顺序执行多个采集任务')
    .requiredOption('--file <file>', '批处理 JSON 文件，包含 captures 数组')
    .option('--mock', '批处理中默认使用内置 mock 设备')
    .option('--continue-on-error', '单个任务失败后继续执行后续任务')
    .action(async options => {
      const jobs = await loadBatchJobs(options.file);
      let completed = 0;
      const failures: string[] = [];

      for (let index = 0; index < jobs.length; index++) {
        const jobOptions = {
          ...jobs[index],
          mock: jobs[index].mock ?? options.mock
        };

        try {
          const config = await resolveCaptureConfig(jobOptions);
          validateCaptureCommand(config, jobOptions);
          await executeCaptureSequence(config, jobOptions, io, deps);
          completed += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`第 ${index + 1} 项: ${message}`);
          io.stderr(failures[failures.length - 1]);

          const exitCode = typeof (error as { exitCode?: number }).exitCode === 'number' ? (error as { exitCode?: number }).exitCode : EXIT_BATCH_FAILED;
          if (!options.continueOnError) {
            throw commanderError(`批处理失败: ${message}`, exitCode === EXIT_USAGE ? EXIT_USAGE : EXIT_BATCH_FAILED);
          }
        }
      }

      if (failures.length > 0) {
        throw commanderError(`批处理完成但存在 ${failures.length} 个失败任务`, EXIT_BATCH_FAILED);
      }

      io.stdout(`批处理完成: ${completed}/${jobs.length}`);
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
        throw commanderError('端口必须在 1-65535 之间', EXIT_USAGE);
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
    .option('--format <format>', '输出格式: lac、csv 或 json', 'lac')
    .action(async options => {
      const config = await resolveCaptureConfig(options);
      const errors = validateCaptureConfig(config);
      if (errors.length > 0) {
        throw commanderError(errors.join('\n'), EXIT_USAGE);
      }
      await saveCaptureConfigFile(options.file, config);
      io.stdout(`已写出采集配置: ${options.file}`);
    });

  return program;
}

async function resolveCaptureConfig(options: Record<string, unknown>): Promise<CliCaptureConfig> {
  const fromFile = options.config ? await loadCaptureConfigFile(options.config as string) : {};
  const merged = { ...fromFile, ...compactOptions(options) } as {
    output?: string;
    format?: string;
    device?: string;
    frequency?: string | number;
    preTriggerSamples?: string | number;
    pre?: string | number;
    postTriggerSamples?: string | number;
    post?: string | number;
    channels?: string | number[];
    triggerType?: string | number | TriggerType;
    trigger?: string;
    triggerChannel?: string | number;
    triggerInverted?: boolean;
    triggerBitCount?: string | number;
    triggerPattern?: string | number;
    loopCount?: string | number;
    measureBursts?: boolean;
  };

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

function compactOptions(options: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      compacted[key] = value;
    }
  }
  return compacted;
}

async function loadBatchJobs(filename: string): Promise<Record<string, unknown>[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    throw commanderError(`批处理文件无效: ${error instanceof Error ? error.message : String(error)}`, EXIT_USAGE);
  }

  const jobs = Array.isArray(parsed) ? parsed : (parsed as { captures?: unknown[] }).captures;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw commanderError('批处理文件必须包含非空 captures 数组', EXIT_USAGE);
  }

  return jobs as Record<string, unknown>[];
}

function validateCaptureCommand(config: CliCaptureConfig, options: Record<string, unknown>): void {
  const errors = validateCaptureConfig(config);
  const repeat = Number(options.repeat ?? 1);
  if (!Number.isInteger(repeat) || repeat < 1) {
    errors.push('repeat 必须是大于 0 的整数');
  }

  if (errors.length > 0) {
    throw commanderError(errors.join('\n'), EXIT_USAGE);
  }
}

async function executeCaptureSequence(
  config: CliCaptureConfig,
  options: Record<string, unknown>,
  io: CliIo,
  deps: CliDeps
): Promise<void> {
  const repeat = Number(options.repeat ?? 1);

  for (let index = 1; index <= repeat; index++) {
    const iterationConfig = {
      ...config,
      output: outputForRepeat(config.output, index, repeat)
    };

    try {
      const runner = options.mock ? new MockCliCaptureRunner() : new LogicAnalyzerCliCaptureRunner();
      const session = deps.capture ? await deps.capture(iterationConfig) : await runner.capture(iterationConfig);
      await writeCaptureOutput(session, iterationConfig.output, iterationConfig.format);
      const suffix = repeat > 1 ? ` (${index}/${repeat})` : '';
      io.stdout(`采集完成: ${iterationConfig.output}${suffix}`);
    } catch (error) {
      throw commanderError(error instanceof Error ? error.message : String(error), EXIT_CAPTURE_FAILED);
    }
  }
}

function outputForRepeat(output: string, index: number, repeat: number): string {
  if (repeat <= 1) {
    return output;
  }

  if (output.includes('{index}')) {
    return output.replace(/\{index\}/g, String(index));
  }

  const extension = path.extname(output);
  const basename = extension ? output.slice(0, -extension.length) : output;
  return `${basename}-${index}${extension}`;
}

function inferFormatFromOutput(output: string): CliOutputFormat {
  const normalized = output.toLowerCase();
  if (normalized.endsWith('.csv')) {
    return 'csv';
  }
  if (normalized.endsWith('.json')) {
    return 'json';
  }
  return 'lac';
}

function defaultOutputForFormat(format?: string): string {
  const normalized = normalizeFormat(format);
  if (normalized === 'csv') {
    return 'capture.csv';
  }
  if (normalized === 'json') {
    return 'capture.json';
  }
  return 'capture.lac';
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
