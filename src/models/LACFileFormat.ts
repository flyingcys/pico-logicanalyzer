/**
 * .lac 文件格式读写处理器
 * 基于原版 C# ExportedCapture 的精确实现
 * 与原软件 100% 兼容
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TriggerType,
  DeviceInfo
} from './AnalyzerTypes';
import {
  CaptureSession,
  AnalyzerChannel,
  BurstInfo
} from './CaptureModels';

/**
 * 样本区域信息 - 对应C# SampleRegion
 */
export interface SampleRegion {
  FirstSample: number;
  LastSample: number;
  RegionName: string;
  R: number;
  G: number;
  B: number;
  A: number;
}

/**
 * 导出的采集数据 - 精确对应C# ExportedCapture
 */
export interface ExportedCapture {
  Settings: CaptureSession; // 对应C# ExportedCapture.Settings
  Samples?: string[]; // 对应C# ExportedCapture.Samples (UInt128[]) - 存储为十六进制字符串
  SelectedRegions?: SampleRegion[]; // 对应C# ExportedCapture.SelectedRegions
}

/**
 * .lac 文件操作结果
 */
export interface LACFileResult {
  success: boolean;
  filePath?: string;
  data?: ExportedCapture;
  error?: string;
  fileSize?: number;
}

/**
 * .lac 文件格式处理器 - 简化版，与C#原版兼容
 */
export class LACFileFormat {
  /**
   * 解析 .lac JSON 内容，并兼容原版 PascalCase 与早期 lowercase 结构。
   */
  public static parse(content: string): ExportedCapture {
    const raw = JSON.parse(content);
    return this.normalizeExportedCapture(raw);
  }

  /**
   * 序列化为原版 .lac PascalCase 结构。
   */
  public static serialize(exportedCapture: ExportedCapture): string {
    const session = this.hydrateCaptureSession(exportedCapture.Settings);
    const originalCapture: Record<string, any> = {
      Settings: this.toOriginalSettings(session)
    };

    if (exportedCapture.Samples !== undefined) {
      originalCapture.Samples = exportedCapture.Samples;
    }

    if (exportedCapture.SelectedRegions !== undefined) {
      originalCapture.SelectedRegions = this.normalizeSelectedRegions(exportedCapture.SelectedRegions);
    }

    return JSON.stringify(originalCapture, this.sampleRegionReplacer, 2);
  }

  /**
   * 保存.lac文件 - 对应C# MainWindow中的保存逻辑
   */
  public static async save(
    filePath: string,
    captureSession: CaptureSession,
    selectedRegions?: Array<{
      firstSample: number;
      lastSample: number;
      regionName: string;
      color: { r: number; g: number; b: number; a: number };
    }>,
    includeRawSamples: boolean = false
  ): Promise<LACFileResult> {
    try {
      // 构建ExportedCapture对象，与C#版本完全对应
      const exportedCapture: ExportedCapture = {
        Settings: captureSession
      };

      // 添加原始样本数据（如果需要）- 对应C# ExportedCapture.Samples
      if (includeRawSamples && captureSession.captureChannels.length > 0) {
        exportedCapture.Samples = this.packChannelSamplesToUInt128Array(captureSession.captureChannels);
      }

      // 添加选择区域（如果有）
      if (selectedRegions && selectedRegions.length > 0) {
        exportedCapture.SelectedRegions = selectedRegions.map(region => ({
          FirstSample: region.firstSample,
          LastSample: region.lastSample,
          RegionName: region.regionName,
          R: region.color.r,
          G: region.color.g,
          B: region.color.b,
          A: region.color.a
        }));
      }

      // 序列化为JSON - 使用与C#版本相同的方式
      const jsonContent = this.serialize(exportedCapture);

      // 确保目录存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // 写入文件
      await fs.promises.writeFile(filePath, jsonContent, 'utf-8');
      const fileSize = Buffer.byteLength(jsonContent, 'utf-8');

      return {
        success: true,
        filePath,
        data: exportedCapture,
        fileSize
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 加载.lac文件 - 对应C# MainWindow中的加载逻辑
   */
  public static async load(filePath: string): Promise<LACFileResult> {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // 读取文件内容
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      const fileSize = Buffer.byteLength(fileContent, 'utf-8');

      // 解析JSON - 使用与C#版本相同的方式
      let exportedCapture: ExportedCapture;
      try {
        exportedCapture = this.parse(fileContent);
      } catch (parseError) {
        return {
          success: false,
          error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
        };
      }

      // 基本验证
      if (!exportedCapture.Settings) {
        return {
          success: false,
          error: 'Invalid .lac file: missing Settings'
        };
      }

      return {
        success: true,
        filePath,
        data: exportedCapture,
        fileSize
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * JSON序列化时的自定义处理器 - 对应C# SampleRegionConverter.WriteJson
   */
  private static sampleRegionReplacer(key: string, value: any): any {
    // 处理SampleRegion的颜色序列化 - 对应C#的颜色处理
    if (key === 'SelectedRegions' && Array.isArray(value)) {
      return value.map((region: any) => {
        if (region && typeof region === 'object') {
          // 确保颜色字段以正确的格式序列化
          return {
            FirstSample: region.FirstSample,
            LastSample: region.LastSample,
            RegionName: region.RegionName,
            R: region.R,
            G: region.G,
            B: region.B,
            A: region.A
          };
        }
        return region;
      });
    }
    return value;
  }

  /**
   * JSON反序列化时的自定义处理器 - 对应C# SampleRegionConverter.ReadJson
   */
  private static sampleRegionReviver(key: string, value: any): any {
    // 处理SampleRegion的颜色反序列化
    if (key === 'SelectedRegions' && Array.isArray(value)) {
      return value.map((region: any) => {
        if (region && typeof region === 'object' &&
            'R' in region && 'G' in region && 'B' in region && 'A' in region) {
          // 恢复颜色对象结构
          return {
            FirstSample: region.FirstSample,
            LastSample: region.LastSample,
            RegionName: region.RegionName,
            R: region.R,
            G: region.G,
            B: region.B,
            A: region.A
          };
        }
        return region;
      });
    }
    return value;
  }

  /**
   * 转换ExportedCapture为CaptureSession - 包含样本数据提取
   */
  public static convertToCaptureSession(exportedCapture: ExportedCapture): CaptureSession {
    if (!exportedCapture) {
      throw new Error('ExportedCapture cannot be null or undefined');
    }

    const captureSession = this.hydrateCaptureSession(exportedCapture.Settings);

    // 如果有原始样本数据，提取到各个通道 - 对应C# ExtractSamples方法
    if (exportedCapture.Samples && exportedCapture.Samples.length > 0) {
      this.extractSamplesFromUInt128Array(captureSession.captureChannels, exportedCapture.Samples);
    }

    return captureSession;
  }

  /**
   * 从CaptureSession创建ExportedCapture
   */
  public static createFromCaptureSession(
    captureSession: CaptureSession,
    selectedRegions?: Array<{
      firstSample: number;
      lastSample: number;
      regionName: string;
      color: { r: number; g: number; b: number; a: number };
    }>,
    includeRawSamples: boolean = false
  ): ExportedCapture {
    if (!captureSession) {
      throw new Error('CaptureSession cannot be null or undefined');
    }

    const exportedCapture: ExportedCapture = {
      Settings: captureSession
    };

    // 添加原始样本数据（如果需要）
    if (includeRawSamples && captureSession.captureChannels.length > 0) {
      exportedCapture.Samples = this.packChannelSamplesToUInt128Array(captureSession.captureChannels);
    }

    if (selectedRegions && selectedRegions.length > 0) {
      exportedCapture.SelectedRegions = selectedRegions.map(region => ({
        FirstSample: region.firstSample,
        LastSample: region.lastSample,
        RegionName: region.regionName,
        R: region.color.r,
        G: region.color.g,
        B: region.color.b,
        A: region.color.a
      }));
    }

    return exportedCapture;
  }

  /**
   * 将通道样本数据打包为UInt128数组 - 对应C#的相反操作
   */
  private static packChannelSamplesToUInt128Array(channels: AnalyzerChannel[]): string[] {
    if (channels.length === 0 || !channels[0].samples) {
      return [];
    }

    const sampleCount = channels[0].samples.length;
    const uint128Array: string[] = [];

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      // 创建128位值 - 使用BigInt处理大整数
      let uint128Value = BigInt(0);

      for (let channelIndex = 0; channelIndex < Math.min(channels.length, 128); channelIndex++) {
        const channel = channels[channelIndex];
        if (channel.samples && channel.samples[sampleIndex]) {
          // 设置对应的位 - (1 << channelIndex)
          uint128Value |= BigInt(1) << BigInt(channelIndex);
        }
      }

      // 转换为十六进制字符串存储
      uint128Array.push(uint128Value.toString(16).padStart(32, '0'));
    }

    return uint128Array;
  }

  /**
   * 从UInt128数组提取通道样本数据 - 对应C# ExtractSamples方法
   */
  private static extractSamplesFromUInt128Array(channels: AnalyzerChannel[], uint128Array: string[]): void {
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      const channel = channels[channelIndex];
      if (!channel) continue;

      // 创建位掩码 - 对应C# UInt128 mask = (UInt128)1 << ChannelIndex
      const mask = BigInt(1) << BigInt(channelIndex);

      // 提取样本数据
      const samples = new Uint8Array(uint128Array.length);

      for (let sampleIndex = 0; sampleIndex < uint128Array.length; sampleIndex++) {
        try {
          // 从十六进制字符串还原BigInt
          const uint128Value = BigInt(`0x${uint128Array[sampleIndex]}`);

          // 检查对应位是否为1 - 对应C# (s & mask) != 0 ? (byte)1 : (byte)0
          samples[sampleIndex] = (uint128Value & mask) !== BigInt(0) ? 1 : 0;
        } catch (error) {
          // 处理无效的十六进制字符串，设置为0
          samples[sampleIndex] = 0;
        }
      }

      channel.samples = samples;
    }
  }

  private static normalizeExportedCapture(raw: any): ExportedCapture {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid .lac file: root must be an object');
    }

    const rawSettings = raw.Settings ?? raw.settings;
    if (!rawSettings) {
      throw new Error('Invalid .lac file: missing Settings');
    }

    const samples = raw.Samples ?? raw.samples;
    const selectedRegions = raw.SelectedRegions ?? raw.selectedRegions;
    const exportedCapture: ExportedCapture = {
      Settings: this.hydrateCaptureSession(rawSettings)
    };

    if (samples !== undefined && samples !== null) {
      exportedCapture.Samples = Array.isArray(samples) ? samples.map(String) : [];
    }

    if (selectedRegions !== undefined && selectedRegions !== null) {
      exportedCapture.SelectedRegions = this.normalizeSelectedRegions(selectedRegions);
    }

    return exportedCapture;
  }

  private static hydrateCaptureSession(value: any): CaptureSession {
    if (value instanceof CaptureSession) {
      const cloned = value.clone ? value.clone() : value;
      return cloned;
    }

    const session = new CaptureSession();
    session.frequency = this.readNumber(value, 'Frequency', 'frequency', session.frequency);
    session.preTriggerSamples = this.readNumber(value, 'PreTriggerSamples', 'preTriggerSamples', session.preTriggerSamples);
    session.postTriggerSamples = this.readNumber(value, 'PostTriggerSamples', 'postTriggerSamples', session.postTriggerSamples);
    session.loopCount = this.readNumber(value, 'LoopCount', 'loopCount', session.loopCount);
    session.measureBursts = this.readBoolean(value, 'MeasureBursts', 'measureBursts', session.measureBursts);
    session.triggerType = this.readNumber(value, 'TriggerType', 'triggerType', session.triggerType) as TriggerType;
    session.triggerChannel = this.readNumber(value, 'TriggerChannel', 'triggerChannel', session.triggerChannel);
    session.triggerInverted = this.readBoolean(value, 'TriggerInverted', 'triggerInverted', session.triggerInverted);
    session.triggerBitCount = this.readNumber(value, 'TriggerBitCount', 'triggerBitCount', session.triggerBitCount);
    session.triggerPattern = this.readNumber(value, 'TriggerPattern', 'triggerPattern', session.triggerPattern);

    const rawChannels = value?.CaptureChannels ?? value?.captureChannels ?? [];
    session.captureChannels = Array.isArray(rawChannels)
      ? rawChannels.map((channel: any) => this.hydrateAnalyzerChannel(channel))
      : [];

    const rawBursts = value?.Bursts ?? value?.bursts;
    if (Array.isArray(rawBursts)) {
      session.bursts = rawBursts.map((rawBurst: any) => {
        const burst = new BurstInfo();
        burst.burstSampleStart = this.readNumber(rawBurst, 'BurstSampleStart', 'burstSampleStart', burst.burstSampleStart);
        burst.burstSampleEnd = this.readNumber(rawBurst, 'BurstSampleEnd', 'burstSampleEnd', burst.burstSampleEnd);
        burst.burstSampleGap = this.readNumber(rawBurst, 'BurstSampleGap', 'burstSampleGap', burst.burstSampleGap);
        burst.burstTimeGap = this.readNumber(rawBurst, 'BurstTimeGap', 'burstTimeGap', burst.burstTimeGap);
        return burst;
      });
    }

    return session;
  }

  private static hydrateAnalyzerChannel(value: any): AnalyzerChannel {
    if (value instanceof AnalyzerChannel) {
      return value.clone ? value.clone() : value;
    }

    const channel = new AnalyzerChannel(
      this.readNumber(value, 'ChannelNumber', 'channelNumber', 0),
      this.readString(value, 'ChannelName', 'channelName', '')
    );
    const channelColor = this.readOptionalNumber(value, 'ChannelColor', 'channelColor');
    channel.channelColor = channelColor;
    channel.hidden = this.readBoolean(value, 'Hidden', 'hidden', false);
    channel.minimized = this.readBoolean(value, 'Minimized', 'minimized', false);

    const samples = value?.Samples ?? value?.samples;
    if (samples instanceof Uint8Array) {
      channel.samples = new Uint8Array(samples);
    } else if (Array.isArray(samples)) {
      channel.samples = new Uint8Array(samples.map((sample: any) => sample ? 1 : 0));
    }

    return channel;
  }

  private static toOriginalSettings(session: CaptureSession): Record<string, any> {
    const settings = session.cloneSettings();
    const original: Record<string, any> = {
      Frequency: settings.frequency,
      PreTriggerSamples: settings.preTriggerSamples,
      PostTriggerSamples: settings.postTriggerSamples,
      LoopCount: settings.loopCount,
      MeasureBursts: settings.measureBursts,
      CaptureChannels: settings.captureChannels.map(channel => this.toOriginalChannel(channel)),
      TriggerType: settings.triggerType,
      TriggerChannel: settings.triggerChannel,
      TriggerInverted: settings.triggerInverted,
      TriggerBitCount: settings.triggerBitCount,
      TriggerPattern: settings.triggerPattern
    };

    if (settings.bursts) {
      original.Bursts = settings.bursts.map(burst => ({
        BurstSampleStart: burst.burstSampleStart,
        BurstSampleEnd: burst.burstSampleEnd,
        BurstSampleGap: burst.burstSampleGap,
        BurstTimeGap: burst.burstTimeGap
      }));
    }

    return original;
  }

  private static toOriginalChannel(channel: AnalyzerChannel): Record<string, any> {
    const original: Record<string, any> = {
      ChannelNumber: channel.channelNumber,
      ChannelName: channel.channelName,
      Hidden: channel.hidden
    };

    if (channel.channelColor !== undefined) {
      original.ChannelColor = channel.channelColor;
    }

    if (channel.minimized !== undefined) {
      original.Minimized = channel.minimized;
    }

    return original;
  }

  private static normalizeSelectedRegions(regions: any[]): SampleRegion[] {
    if (!Array.isArray(regions)) {
      return [];
    }

    return regions.map(region => ({
      FirstSample: this.readNumber(region, 'FirstSample', 'firstSample', 0),
      LastSample: this.readNumber(region, 'LastSample', 'lastSample', 0),
      RegionName: this.readString(region, 'RegionName', 'regionName', ''),
      R: this.readColorNumber(region, 'R', 'r'),
      G: this.readColorNumber(region, 'G', 'g'),
      B: this.readColorNumber(region, 'B', 'b'),
      A: this.readColorNumber(region, 'A', 'a', 255)
    }));
  }

  private static readNumber(value: any, pascalKey: string, camelKey: string, fallback: number): number {
    const raw = value?.[pascalKey] ?? value?.[camelKey];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
  }

  private static readOptionalNumber(value: any, pascalKey: string, camelKey: string): number | undefined {
    const raw = value?.[pascalKey] ?? value?.[camelKey];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  }

  private static readString(value: any, pascalKey: string, camelKey: string, fallback: string): string {
    const raw = value?.[pascalKey] ?? value?.[camelKey];
    return typeof raw === 'string' ? raw : fallback;
  }

  private static readBoolean(value: any, pascalKey: string, camelKey: string, fallback: boolean): boolean {
    const raw = value?.[pascalKey] ?? value?.[camelKey];
    return typeof raw === 'boolean' ? raw : fallback;
  }

  private static readColorNumber(value: any, pascalKey: string, camelKey: string, fallback: number = 0): number {
    const direct = this.readOptionalNumber(value, pascalKey, camelKey);
    if (direct !== undefined) {
      return direct;
    }

    const color = value?.color;
    const colorValue = color?.[camelKey];
    return typeof colorValue === 'number' && Number.isFinite(colorValue) ? colorValue : fallback;
  }
}
