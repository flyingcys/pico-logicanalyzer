/**
 * 解码器管理系统
 * 基于 @logicanalyzer/Software 的 SigrokProvider 架构
 * 负责解码器的注册、管理和执行
 */

import { DecoderBase } from './DecoderBase';
import {
  StreamingDecoderBase,
  StreamingConfig,
  StreamingProgress,
  StreamingResult,
  PerformanceMonitor,
  decoderDebugLog
} from './StreamingDecoder';
import {
  DecoderInfo,
  DecoderOptionValue,
  DecoderSelectedChannel,
  DecoderResult,
  DecoderAnnotation,
  ChannelData
} from './types';
import { getPerformanceMemory } from './performanceMemory';

export type DecoderExecutionMode = 'regular' | 'streaming';

/**
 * 解码器执行结果
 */
export interface DecoderExecutionResult {
  /** 解码器名称 */
  decoderName: string;
  /** 解码结果 */
  results: DecoderResult[];
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 是否为流式处理结果 */
  isStreaming?: boolean;
  /** 性能统计信息 */
  performanceStats?: {
    totalSamples: number;
    processingSpeed: number;
    memoryUsage?: number;
    chunksProcessed?: number;
  };
}

/**
 * 解码树分支
 * 对应原软件的 SigrokDecodingBranch
 */
export interface DecodingBranch {
  /** 分支名称 */
  name: string;
  /** 使用的解码器 */
  decoder: DecoderBase;
  /** 解码器选项 */
  options: DecoderOptionValue[];
  /** 通道映射 */
  channels: DecoderSelectedChannel[];
  /** 子分支 */
  children: DecodingBranch[];
}

/**
 * 解码树
 * 对应原软件的 SigrokDecodingTree
 */
export interface DecodingTree {
  /** 根分支列表 */
  branches: DecodingBranch[];
}

/**
 * 解码器管理器类
 * 对应原软件的 SigrokProvider
 */
export class DecoderManager {
  /** 注册的解码器映射 */
  private decoders = new Map<string, new () => DecoderBase>();

  /** 注册的流式解码器映射 */
  private streamingDecoders = new Map<string, new (config?: Partial<StreamingConfig>) => StreamingDecoderBase>();

  /** 解码器实例缓存 */
  private decoderInstances = new Map<string, DecoderBase>();

  /** 流式解码器实例缓存 */
  private streamingDecoderInstances = new Map<string, StreamingDecoderBase>();

  /** 当前输入数据 */
  private currentInputs: Map<string, unknown[]> | null = null;

  /** 当前输出数据 */
  private currentOutputs: Map<string, unknown[]> | null = null;

  /** 性能监控器 */
  public readonly performanceMonitor = new PerformanceMonitor();

  /** 活跃的流式处理任务 */
  private activeStreamingTasks = new Map<string, StreamingDecoderBase>();

  constructor() {
    this.registerBuiltinDecoders();
  }

  /**
   * 注册内置解码器
   */
  private registerBuiltinDecoders(): void {
    try {
      // 导入内置解码器
      const { I2CDecoder } = require('./protocols/I2CDecoder');
      const { SPIDecoder } = require('./protocols/SPIDecoder');
      const { UARTDecoder } = require('./protocols/UARTDecoder');
      const { CANDecoder } = require('./protocols/CANDecoder');
      const { LINDecoder } = require('./protocols/LINDecoder');
      const { I2SDecoder } = require('./protocols/I2SDecoder');
      const { StreamingI2CDecoder } = require('./protocols/StreamingI2CDecoder');

      this.registerDecoder('i2c', I2CDecoder);
      this.registerDecoder('spi', SPIDecoder);
      this.registerDecoder('uart', UARTDecoder);
      this.registerDecoder('can', CANDecoder);
      this.registerDecoder('lin', LINDecoder);
      this.registerDecoder('i2s', I2SDecoder);
      this.registerStreamingDecoder('streaming_i2c', StreamingI2CDecoder);
    } catch (error) {
      console.warn('内置解码器注册失败:', error);
    }
  }

  /**
   * 注册解码器类
   * @param id 解码器标识符
   * @param decoderClass 解码器类
   */
  public registerDecoder(id: string, decoderClass: new () => DecoderBase): void {
    // 如果已存在，清除缓存
    if (this.decoders.has(id)) {
      this.decoderInstances.delete(id);
    }

    this.decoders.set(id, decoderClass);
  }

  /**
   * 注册流式解码器类
   * @param id 解码器标识符
   * @param decoderClass 流式解码器类
   */
  public registerStreamingDecoder(
    id: string,
    decoderClass: new (config?: Partial<StreamingConfig>) => StreamingDecoderBase
  ): void {
    if (this.streamingDecoders.has(id)) {
      this.streamingDecoderInstances.delete(id);
    }

    this.streamingDecoders.set(id, decoderClass);
  }

  /**
   * 获取所有可用解码器信息
   * @returns 解码器信息数组
   */
  public getAvailableDecoders(): DecoderInfo[] {
    const decoderInfos: DecoderInfo[] = [];

    for (const [id, _DecoderClass] of this.decoders.entries()) {
      try {
        const instance = this.createDecoderInstance(id);
        if (instance) {
          decoderInfos.push(instance.getInfo());
        }
      } catch (error) {
        console.error(`Failed to get info for decoder ${id}:`, error);
      }
    }

    return decoderInfos.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 根据ID获取解码器
   * @param decoderId 解码器ID
   * @returns 解码器实例或null
   */
  public getDecoder(decoderId: string): DecoderBase | null {
    return this.createDecoderInstance(decoderId);
  }

  /**
   * 创建解码器实例（测试期望的公共方法）
   * @param decoderId 解码器ID
   * @returns 解码器实例
   * @throws 如果解码器不存在则抛出异常
   */
  public createDecoder(decoderId: string): DecoderBase {
    const instance = this.createDecoderInstance(decoderId);
    if (!instance) {
      throw new Error(`Unknown decoder: ${decoderId}`);
    }
    return instance;
  }

  /**
   * 获取特定解码器的详细信息
   * @param decoderId 解码器ID
   * @returns 解码器信息或undefined
   */
  public getDecoderInfo(decoderId: string): DecoderInfo | undefined {
    try {
      const instance = this.createDecoderInstance(decoderId);
      return instance?.getInfo();
    } catch (error) {
      console.error(`Failed to get info for decoder ${decoderId}:`, error);
      return undefined;
    }
  }

  /**
   * 根据ID获取流式解码器
   * @param decoderId 解码器ID
   * @returns 流式解码器实例或null
   */
  public getStreamingDecoder(decoderId: string): StreamingDecoderBase | null {
    return this.createStreamingDecoderInstance(decoderId);
  }

  /**
   * 检查解码器是否支持流式处理
   * @param decoderId 解码器ID
   * @returns 是否支持流式处理
   */
  public isStreamingSupported(decoderId: string): boolean {
    return this.resolveStreamingDecoderId(decoderId) !== null;
  }

  /**
   * 解析流式解码器 ID。
   * 兼容 executeStreamingDecoder('i2c', ...) 命中注册键 streaming_i2c 的主流程。
   */
  private resolveStreamingDecoderId(decoderId: string): string | null {
    if (this.streamingDecoders.has(decoderId)) {
      return decoderId;
    }

    const prefixedDecoderId = `streaming_${decoderId}`;
    if (this.streamingDecoders.has(prefixedDecoderId)) {
      return prefixedDecoderId;
    }

    return null;
  }

  /**
   * 创建解码器实例
   * @param decoderId 解码器ID
   * @returns 解码器实例或null
   */
  private createDecoderInstance(decoderId: string): DecoderBase | null {
    // 检查缓存
    if (this.decoderInstances.has(decoderId)) {
      return this.decoderInstances.get(decoderId)!;
    }

    const DecoderClass = this.decoders.get(decoderId);
    if (!DecoderClass) {
      console.error(`Unknown decoder: ${decoderId}`);
      return null;
    }

    try {
      const instance = new DecoderClass();
      this.decoderInstances.set(decoderId, instance);
      return instance;
    } catch (error) {
      console.error(`Failed to create decoder instance for ${decoderId}:`, error);
      return null;
    }
  }

  /**
   * 创建流式解码器实例
   * @param decoderId 解码器ID
   * @returns 流式解码器实例或null
   */
  private createStreamingDecoderInstance(
    decoderId: string,
    streamingConfig: Partial<StreamingConfig> = {}
  ): StreamingDecoderBase | null {
    const resolvedDecoderId = this.resolveStreamingDecoderId(decoderId);
    const hasCustomConfig = Object.keys(streamingConfig).length > 0;

    // 检查缓存
    if (!hasCustomConfig && resolvedDecoderId && this.streamingDecoderInstances.has(resolvedDecoderId)) {
      return this.streamingDecoderInstances.get(resolvedDecoderId)!;
    }

    const StreamingDecoderClass = resolvedDecoderId
      ? this.streamingDecoders.get(resolvedDecoderId)
      : undefined;
    if (!StreamingDecoderClass) {
      console.error(`Unknown streaming decoder: ${decoderId}`);
      return null;
    }

    try {
      const instance = new StreamingDecoderClass(streamingConfig);
      if (!hasCustomConfig) {
        this.streamingDecoderInstances.set(resolvedDecoderId!, instance);
      }
      return instance;
    } catch (error) {
      console.error(`Failed to create streaming decoder instance for ${decoderId}:`, error);
      return null;
    }
  }

  /**
   * 执行解码树
   * 对应原软件的 Execute() 方法
   * @param sampleRate 采样率
   * @param channels 通道数据
   * @param tree 解码树
   * @returns 解码结果映射
   */
  public execute(
    sampleRate: number,
    channels: ChannelData[],
    tree: DecodingTree
  ): Map<string, DecoderAnnotation> | null {
    if (!channels || channels.length === 0 || tree.branches.length === 0) {
      return null;
    }

    const results = new Map<string, DecoderAnnotation>();
    const voidInputs = new Map<string, unknown[]>();

    // 执行所有根分支
    for (const branch of tree.branches) {
      this.executeDecodingBranch(branch, sampleRate, channels, voidInputs, results);
    }

    return results;
  }

  /**
   * 执行单个解码分支
   * 对应原软件的 ExecuteDecodingBranch() 方法
   * @param branch 解码分支
   * @param sampleRate 采样率
   * @param channels 通道数据
   * @param inputs 输入数据
   * @param results 结果映射
   */
  private executeDecodingBranch(
    branch: DecodingBranch,
    sampleRate: number,
    channels: ChannelData[],
    inputs: Map<string, unknown[]>,
    results: Map<string, DecoderAnnotation>
  ): void {
    // 验证选项和通道配置
    if (!branch.decoder.validateOptions(branch.options, branch.channels, channels)) {
      console.warn(`Invalid configuration for decoder: ${branch.name}`);
      return;
    }

    const mappedChannels = this.mapChannelsForDecoder(channels, branch.channels, branch.decoder);
    branch.decoder.setExecutionContext(inputs);

    try {
      // 执行解码
      const decoderResults = branch.decoder.decode(sampleRate, mappedChannels, branch.options);

      if (decoderResults && decoderResults.length > 0) {
        // 将结果转换为注释格式
        const annotation: DecoderAnnotation = {
          name: branch.name,
          segments: decoderResults.sort((a, b) => a.startSample - b.startSample)
        };
        results.set(branch.name, annotation);
      }

      // 合并输出数据用于子分支
      let newInputs = inputs;
      const outputs = branch.decoder.getExecutionOutputs();
      if (outputs.size > 0) {
        newInputs = this.mergeOutputs(newInputs, outputs);
      }

      // 递归执行子分支
      for (const child of branch.children) {
        this.executeDecodingBranch(child, sampleRate, channels, newInputs, results);
      }
    } catch (error) {
      console.error(`Error executing decoder ${branch.name}:`, error);
    } finally {
      branch.decoder.clearExecutionContext();
    }
  }

  /**
   * 合并输出数据
   * 对应原软件的 MergeOutputs() 方法
   * @param oldInputs 旧输入数据
   * @param newInputs 新输入数据
   * @returns 合并后的数据
   */
  private mergeOutputs(
    oldInputs: Map<string, unknown[]>,
    newInputs: Map<string, unknown[]>
  ): Map<string, unknown[]> {
    if (!newInputs) {
      return oldInputs;
    }

    const merged = new Map<string, unknown[]>();

    // 添加新输入
    for (const [key, value] of newInputs) {
      merged.set(key, value);
    }

    // 添加旧输入（如果键不存在）
    for (const [key, value] of oldInputs) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }

    return merged;
  }

  /**
   * 获取输入数据
   * 对应原软件的 GetInput() 方法
   * @param inputName 输入名称
   * @returns 输入数据或null
   */
  public getInput(inputName: string): unknown[] | null {
    if (!this.currentInputs || !this.currentInputs.has(inputName)) {
      return null;
    }
    return this.currentInputs.get(inputName) || null;
  }

  /**
   * 添加输出数据
   * 对应原软件的 AddOutput() 方法
   * @param outputName 输出名称
   * @param output 输出数据
   */
  public addOutput(outputName: string, output: unknown[]): void {
    if (!this.currentOutputs) {
      this.currentOutputs = new Map();
    }
    this.currentOutputs.set(outputName, output);
  }

  /**
   * 根据解码器通道映射重排输入通道。
   */
  private mapChannelsForDecoder(
    channels: ChannelData[],
    channelMapping: DecoderSelectedChannel[],
    decoder: DecoderBase
  ): ChannelData[] {
    if (!channelMapping || channelMapping.length === 0) {
      return channels;
    }

    const maxDecoderIndex = channelMapping.reduce(
      (max, mapping) => Math.max(max, mapping.decoderIndex),
      -1
    );
    const sampleLength = Math.max(...channels.map(channel => channel.samples?.length || 0), 0);
    const mappedChannels: ChannelData[] = [];

    for (let index = 0; index <= maxDecoderIndex; index++) {
      const metadata = decoder.channels.find(channel => channel.index === index);
      mappedChannels[index] = {
        channelNumber: index,
        channelName: metadata?.name || `Decoder Channel ${index}`,
        samples: new Uint8Array(sampleLength)
      };
    }

    for (const mapping of channelMapping) {
      const source = channels[mapping.captureIndex];
      if (!source) {
        continue;
      }

      const metadata = decoder.channels.find(channel => channel.index === mapping.decoderIndex);
      mappedChannels[mapping.decoderIndex] = {
        channelNumber: mapping.decoderIndex,
        channelName: mapping.name || metadata?.name || source.channelName,
        samples: source.samples
      };
    }

    return mappedChannels;
  }

  /**
   * 没有显式映射时，优先按源通道名匹配解码器通道，最后才退回位置映射。
   */
  private createDefaultChannelMapping(
    channels: ChannelData[],
    decoder: DecoderBase
  ): DecoderSelectedChannel[] {
    const usedCaptureIndexes = new Set<number>();

    return decoder.channels.map((decoderChannel, index) => {
      const decoderIndex = decoderChannel.index ?? index;
      const channelId = decoderChannel.id.toLowerCase();
      const channelName = decoderChannel.name.toLowerCase();

      const namedIndex = channels.findIndex((channel, captureIndex) => {
        if (usedCaptureIndexes.has(captureIndex)) {
          return false;
        }

        const sourceName = channel.channelName?.toLowerCase();
        return !!sourceName && (sourceName.includes(channelId) || sourceName.includes(channelName));
      });

      let captureIndex = namedIndex !== -1 ? namedIndex : index;
      if (namedIndex === -1 && usedCaptureIndexes.has(captureIndex)) {
        const unusedIndex = channels.findIndex((_channel, channelIndex) =>
          !usedCaptureIndexes.has(channelIndex)
        );
        captureIndex = unusedIndex === -1 ? index : unusedIndex;
      }
      usedCaptureIndexes.add(captureIndex);

      return {
        captureIndex,
        decoderIndex
      };
    });
  }

  /**
   * 执行单个解码器
   * 简化的解码器执行接口
   * @param decoderId 解码器ID
   * @param sampleRate 采样率
   * @param channels 通道数据
   * @param options 解码器选项
   * @param channelMapping 通道映射
   * @returns 执行结果
   */
  public async executeDecoder(
    decoderId: string,
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[] = [],
    channelMapping: DecoderSelectedChannel[] = []
  ): Promise<DecoderExecutionResult> {
    const startTime = performance.now();

    try {
      const totalSamples = Math.max(...channels.map(ch => ch.samples?.length || 0), 0);
      const decoder = this.getDecoder(decoderId);
      if (!decoder) {
        return {
          decoderName: decoderId,
          results: [],
          executionTime: 0,
          success: false,
          error: `Decoder not found: ${decoderId}`
        };
      }

      const effectiveMapping = channelMapping.length > 0
        ? channelMapping
        : this.createDefaultChannelMapping(channels, decoder);

      // 验证配置
      if (!decoder.validateOptions(options, effectiveMapping, channels)) {
        return {
          decoderName: decoderId,
          results: [],
          executionTime: performance.now() - startTime,
          success: false,
          error: 'Invalid decoder configuration'
        };
      }

      if (this.getRecommendedExecutionMode(decoderId, totalSamples) === 'streaming') {
        return await this.executeStreamingDecoder(
          decoderId,
          sampleRate,
          channels,
          options,
          effectiveMapping
        );
      }

      // 执行解码
      const mappedChannels = this.mapChannelsForDecoder(channels, effectiveMapping, decoder);
      const results = decoder.decode(sampleRate, mappedChannels, options);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const processingSpeed = totalSamples / (processingTime / 1000);

      return {
        decoderName: decoderId,
        results,
        executionTime: processingTime,
        success: true,
        isStreaming: false,
        performanceStats: {
          totalSamples,
          processingSpeed,
          memoryUsage: getPerformanceMemory()?.usedJSHeapSize
        }
      };
    } catch (error) {
      const endTime = performance.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        decoderName: decoderId,
        results: [],
        executionTime: endTime - startTime,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 流式执行解码器
   * @param decoderId 解码器ID
   * @param sampleRate 采样率
   * @param channels 通道数据
   * @param options 解码器选项
   * @param channelMapping 通道映射
   * @param streamingConfig 流式处理配置
   * @param onProgress 进度回调
   * @param onPartialResult 部分结果回调
   * @returns 流式执行结果
   */
  public async executeStreamingDecoder(
    decoderId: string,
    sampleRate: number,
    channels: ChannelData[],
    options: DecoderOptionValue[] = [],
    channelMapping: DecoderSelectedChannel[] = [],
    _streamingConfig: Partial<StreamingConfig> = {},
    onProgress?: (_progress: StreamingProgress) => void,
    onPartialResult?: (_results: DecoderResult[], _chunk: number) => void
  ): Promise<DecoderExecutionResult> {
    const taskId = `${decoderId}_${Date.now()}`;
    const startTime = performance.now();

    try {
      const streamingDecoder = this.createStreamingDecoderInstance(decoderId, _streamingConfig);
      if (!streamingDecoder) {
        // 如果没有流式版本，尝试使用常规解码器
        return await this.executeDecoder(decoderId, sampleRate, channels, options, channelMapping);
      }

      // 记录活跃任务
      this.activeStreamingTasks.set(taskId, streamingDecoder);

      // 设置回调
      if (onProgress) {
        streamingDecoder.onProgress = onProgress;
      }
      if (onPartialResult) {
        streamingDecoder.onPartialResult = onPartialResult;
      }

      // 开始性能监控
      this.performanceMonitor.start();
      this.performanceMonitor.addCheckpoint('streaming_start');

      // 执行流式解码
      const streamingResult = await streamingDecoder.streamingDecode(
        sampleRate,
        channels,
        options,
        channelMapping
      );

      this.performanceMonitor.addCheckpoint('streaming_complete');
      const _performanceReport = this.performanceMonitor.getReport();

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      return {
        decoderName: decoderId,
        results: streamingResult.results,
        executionTime,
        success: streamingResult.success,
        error: streamingResult.error,
        isStreaming: true,
        performanceStats: {
          totalSamples: streamingResult.statistics.totalSamples,
          processingSpeed: streamingResult.statistics.averageSpeed,
          memoryUsage: streamingResult.statistics.peakMemoryUsage,
          chunksProcessed: streamingResult.statistics.chunksProcessed
        }
      };

    } catch (error) {
      const endTime = performance.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        decoderName: decoderId,
        results: [],
        executionTime: endTime - startTime,
        success: false,
        error: errorMessage,
        isStreaming: true
      };
    } finally {
      // 清理活跃任务
      this.activeStreamingTasks.delete(taskId);
    }
  }

  /**
   * 停止所有活跃的流式处理任务
   */
  public stopAllStreamingTasks(): void {
    decoderDebugLog(`🛑 停止 ${this.activeStreamingTasks.size} 个活跃的流式处理任务`);

    for (const [taskId, decoder] of this.activeStreamingTasks) {
      try {
        decoder.stop();
        decoderDebugLog(`  已停止任务: ${taskId}`);
      } catch (error) {
        console.error(`  停止任务失败 ${taskId}:`, error);
      }
    }

    this.activeStreamingTasks.clear();
  }

  /**
   * 获取活跃流式任务数量
   */
  public getActiveStreamingTaskCount(): number {
    return this.activeStreamingTasks.size;
  }

  /**
   * 获取活跃的解码器列表
   * @returns 活跃解码器ID数组
   */
  public getActiveDecoders(): string[] {
    return Array.from(this.activeStreamingTasks.keys());
  }

  /**
   * 停止特定的解码器
   * @param decoderId 解码器ID
   * @returns 是否成功停止
   */
  public stopDecoder(decoderId: string): boolean {
    const taskIds = Array.from(this.activeStreamingTasks.keys()).filter(id => id.startsWith(decoderId));
    let stopped = false;

    for (const taskId of taskIds) {
      const decoder = this.activeStreamingTasks.get(taskId);
      if (decoder) {
        try {
          decoder.stop();
          this.activeStreamingTasks.delete(taskId);
          stopped = true;
          decoderDebugLog(`已停止解码器任务: ${taskId}`);
        } catch (error) {
          console.error(`停止解码器任务失败 ${taskId}:`, error);
        }
      }
    }

    return stopped;
  }

  /**
   * 搜索解码器
   * @param query 搜索查询
   * @returns 匹配的解码器信息
   */
  public searchDecoders(query: string): DecoderInfo[] {
    const allDecoders = this.getAvailableDecoders();

    // 处理空查询
    if (!query || query.trim() === '') {
      return allDecoders;
    }

    const lowerQuery = query.toLowerCase();

    return allDecoders.filter(
      decoder =>
        decoder.id.toLowerCase().includes(lowerQuery) ||
        decoder.name.toLowerCase().includes(lowerQuery) ||
        decoder.longname.toLowerCase().includes(lowerQuery) ||
        decoder.description.toLowerCase().includes(lowerQuery) ||
        (decoder.tags && decoder.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }

  /**
   * 按标签过滤解码器
   * @param tags 标签数组
   * @returns 匹配的解码器信息
   */
  public getDecodersByTags(tags: string[]): DecoderInfo[] {
    const allDecoders = this.getAvailableDecoders();
    const lowerTags = tags.map(tag => tag.toLowerCase());

    return allDecoders.filter(decoder =>
      decoder.tags && decoder.tags.some(tag => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * 按类别获取解码器
   * @param category 类别名称
   * @returns 匹配的解码器信息
   */
  public getDecodersByCategory(category: string): DecoderInfo[] {
    const allDecoders = this.getAvailableDecoders();
    const lowerCategory = category.toLowerCase();

    return allDecoders.filter(decoder => {
      // 根据解码器ID和类型判断类别
      if (lowerCategory === 'serial') {
        return ['uart', 'rs232', 'rs485'].some(id => decoder.id.includes(id));
      } else if (lowerCategory === 'bus') {
        return ['i2c', 'spi', 'can', 'lin'].some(id => decoder.id.includes(id));
      } else if (lowerCategory === 'memory') {
        return ['spi_flash', 'eeprom', 'sd'].some(id => decoder.id.includes(id));
      } else if (lowerCategory === 'audio') {
        return ['i2s', 'pcm', 'pdm'].some(id => decoder.id.includes(id));
      }

      // 检查标签中是否包含类别
      return decoder.tags && decoder.tags.some(tag => tag.toLowerCase().includes(lowerCategory));
    });
  }

  /**
   * 获取所有支持的类别
   * @returns 类别数组
   */
  public getSupportedCategories(): string[] {
    return ['serial', 'bus', 'memory', 'audio', 'network', 'display', 'sensor'];
  }

  /**
   * 明确常规/流式解码器的默认切换规则。
   */
  public getRecommendedExecutionMode(decoderId: string, totalSamples: number): DecoderExecutionMode {
    if (
      decoderId === 'i2c' &&
      totalSamples > 1_000_000 &&
      this.streamingDecoders.has('streaming_i2c')
    ) {
      return 'streaming';
    }

    return 'regular';
  }

  /**
   * 获取解码器的标签
   * @param decoderId 解码器ID
   * @returns 标签数组
   */
  public getDecoderTags(decoderId: string): string[] {
    const info = this.getDecoderInfo(decoderId);
    return info?.tags || [];
  }

  /**
   * 清理资源
   * 对应原软件的 Dispose() 方法
   */
  public dispose(): void {
    // 停止所有流式处理任务
    this.stopAllStreamingTasks();

    // 清理常规解码器实例
    for (const [id, instance] of this.decoderInstances) {
      try {
        // 如果解码器有dispose方法，调用它
        const maybeDisposable = instance as unknown as { dispose?: () => void };
        if (typeof maybeDisposable.dispose === 'function') {
          maybeDisposable.dispose();
        }
      } catch (error) {
        console.error(`Error disposing decoder ${id}:`, error);
      }
    }

    // 清理流式解码器实例
    for (const [id, instance] of this.streamingDecoderInstances) {
      try {
        const maybeDisposable = instance as unknown as { dispose?: () => void };
        if (typeof maybeDisposable.dispose === 'function') {
          maybeDisposable.dispose();
        }
      } catch (error) {
        console.error(`Error disposing streaming decoder ${id}:`, error);
      }
    }

    this.decoderInstances.clear();
    this.streamingDecoderInstances.clear();
    this.decoders.clear();
    this.streamingDecoders.clear();
    this.currentInputs = null;
    this.currentOutputs = null;

    decoderDebugLog('DecoderManager disposed');
  }

  /**
   * 获取统计信息
   * @returns 管理器统计信息
   */
  public getStatistics() {
    return {
      registeredDecoders: this.decoders.size,
      registeredStreamingDecoders: this.streamingDecoders.size,
      cachedInstances: this.decoderInstances.size,
      cachedStreamingInstances: this.streamingDecoderInstances.size,
      activeStreamingTasks: this.activeStreamingTasks.size,
      availableDecoders: this.getAvailableDecoders().length
    };
  }
}

// 创建全局单例实例
export const decoderManager = new DecoderManager();
