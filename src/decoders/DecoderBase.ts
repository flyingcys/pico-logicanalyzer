/**
 * TypeScript解码器基类
 * 基于 @logicanalyzer/Software 的 SigrokDecoderBase 架构
 * 实现纯TypeScript零依赖的协议解码功能
 */

import {
  DecoderChannel,
  DecoderOption,
  DecoderOptionValue,
  DecoderSelectedChannel,
  WaitCondition,
  WaitConditions,
  WaitResult,
  DecoderOutput,
  DecoderResult,
  DecoderOutputType,
  WaitConditionType,
  ChannelData
} from './types';

/**
 * 解码器抽象基类
 * 所有协议解码器必须继承此基类
 */
export abstract class DecoderBase {
  // 解码器元数据 - 子类必须实现
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly longname: string;
  abstract readonly desc: string;
  abstract readonly license: string;
  abstract readonly inputs: string[];
  abstract readonly outputs: string[];
  abstract readonly tags: string[];
  abstract readonly channels: DecoderChannel[];
  abstract readonly options: DecoderOption[];
  abstract readonly annotations: Array<[string, string, string?]>;
  abstract readonly annotationRows?: Array<[string, string, number[]]>;

  // 解码状态管理
  protected sampleIndex: number = 0;
  protected sampleRate: number = 0;
  protected channelData: Uint8Array[] = [];
  protected results: DecoderResult[] = [];
  protected registeredOutputs: Map<DecoderOutputType, number> = new Map();
  protected currentState: Map<number, number> = new Map();
  protected lastState: Map<number, number> = new Map();

  /**
   * 主解码方法 - 子类必须实现
   * @param sampleRate 采样率
   * @param channels 通道数据
   * @param options 配置选项
   * @returns 解码结果数组
   */
  abstract decode(
    _sampleRate: number,
    _channels: ChannelData[],
    _options: DecoderOptionValue[]
  ): DecoderResult[];

  /**
   * 初始化解码器
   * 对应原软件的 start() 方法
   */
  protected start(): void {
    // 注册默认输出类型
    this.register(DecoderOutputType.ANNOTATION);
    this.register(DecoderOutputType.PYTHON);

    // 重置状态
    this.reset();
  }

  /**
   * 重置解码器状态
   * 对应原软件的 reset() 方法
   */
  protected reset(): void {
    this.sampleIndex = 0;
    this.results = [];
    this.currentState.clear();
    this.lastState.clear();
  }

  /**
   * 注册输出类型
   * 对应原软件的 register() 方法
   * @param outputType 输出类型
   * @returns 输出ID
   */
  protected register(outputType: DecoderOutputType): number {
    const outputId = this.registeredOutputs.size;
    this.registeredOutputs.set(outputType, outputId);
    return outputId;
  }

  /**
   * 等待指定的通道条件 - 核心API
   * 对应原软件的 Wait() 方法
   * @param conditions 等待条件（单个条件或条件数组）
   * @returns 等待结果
   */
  protected wait(conditions: WaitConditions): WaitResult {
    if (this.channelData.length === 0) {
      throw new Error('No channel data available');
    }

    const maxSamples = this.channelData[0].length;

    // 保存上一个状态
    this.saveCurrentState();

    // 转换为条件数组格式
    const conditionsArray = Array.isArray(conditions) ? conditions : [conditions];

    // 如果是单个跳过条件，直接返回当前状态
    if (conditionsArray.length === 1 && this.isSkipCondition(conditionsArray[0])) {
      return {
        pins: this.getCurrentPins(),
        sampleNumber: this.sampleIndex
      };
    }

    // 主搜索循环
    while (this.sampleIndex < maxSamples) {
      // 更新当前状态
      this.updateCurrentState();

      // 检查每个条件是否匹配
      for (let i = 0; i < conditionsArray.length; i++) {
        const matched = this.checkConditions(conditionsArray[i]);
        if (matched.every(m => m)) {
          // 创建 matched 数组，对应原版的 self.matched
          const matchedArray = new Array(conditionsArray.length).fill(false);
          matchedArray[i] = true;

          return {
            pins: this.getCurrentPins(),
            sampleNumber: this.sampleIndex,
            matched: matchedArray,
            matchedIndex: i
          };
        }
      }

      // 移动到下一个样本
      this.sampleIndex++;
    }

    // 到达样本末尾
    throw new Error('End of samples reached');
  }

  /**
   * 输出解码结果 - 核心API
   * 对应原软件的 Put() 方法
   * @param startSample 开始样本
   * @param endSample 结束样本
   * @param data 输出数据
   */
  protected put(startSample: number, endSample: number, data: DecoderOutput): void {
    const result: DecoderResult = {
      startSample,
      endSample,
      annotationType: data.annotationType || 0,
      values: data.values,
      rawData: data.rawData,
      shape: 'hexagon' // 默认形状
    };

    this.results.push(result);
  }

  /**
   * 检查是否还有更多样本
   * @returns 是否有更多样本
   */
  protected hasMoreSamples(): boolean {
    return this.sampleIndex < (this.channelData[0]?.length || 0);
  }

  /**
   * 获取当前所有通道的引脚状态
   * @returns 引脚状态数组
   */
  protected getCurrentPins(): number[] {
    return this.channelData.map(channel =>
      this.sampleIndex < channel.length ? channel[this.sampleIndex] : 0
    );
  }

  /**
   * 检查条件是否匹配
   * @param conditions 等待条件
   * @returns 匹配结果数组
   */
  private checkConditions(conditions: WaitCondition): boolean[] {
    const results: boolean[] = [];

    for (const [channelIndex, conditionType] of Object.entries(conditions)) {
      const chIndex = parseInt(channelIndex);
      const matched = this.checkSingleCondition(chIndex, conditionType);
      results.push(matched);
    }

    return results;
  }

  /**
   * 检查单个通道条件
   * @param channelIndex 通道索引
   * @param conditionType 条件类型
   * @returns 是否匹配
   */
  private checkSingleCondition(channelIndex: number, conditionType: WaitConditionType): boolean {
    if (channelIndex >= this.channelData.length) {
      return false;
    }

    const currentValue = this.currentState.get(channelIndex) || 0;
    // 对于第一个样本，如果lastState中没有值，我们假设之前的值是0
    const lastValue = this.lastState.has(channelIndex) ? this.lastState.get(channelIndex)! : 0;

    switch (conditionType) {
      case 'low':
        return currentValue === 0;
      case 'high':
        return currentValue === 1;
      case 'rising':
        return lastValue === 0 && currentValue === 1;
      case 'falling':
        return lastValue === 1 && currentValue === 0;
      case 'edge':
        return lastValue !== currentValue;
      case 'stable':
        return lastValue === currentValue;
      case 'skip':
        return true;
      default:
        return false;
    }
  }

  /**
   * 保存当前状态为上一状态
   */
  private saveCurrentState(): void {
    this.lastState.clear();
    for (const [key, value] of this.currentState) {
      this.lastState.set(key, value);
    }
  }

  /**
   * 更新当前状态
   */
  private updateCurrentState(): void {
    this.saveCurrentState();
    this.currentState.clear();

    for (let i = 0; i < this.channelData.length; i++) {
      const value =
        this.sampleIndex < this.channelData[i].length ? this.channelData[i][this.sampleIndex] : 0;
      this.currentState.set(i, value);
    }
  }

  /**
   * 检查是否为跳过条件
   * @param conditions 条件
   * @returns 是否为跳过条件
   */
  private isSkipCondition(conditions: WaitCondition): boolean {
    const entries = Object.entries(conditions);
    return entries.length === 1 && entries[0][0] === '0' && entries[0][1] === 'skip';
  }

  /**
   * 检查引脚状态是否匹配条件
   * @param pins 当前引脚状态
   * @param conditions 条件
   * @returns 是否匹配
   */
  protected matchesCondition(pins: number[], conditions: { [key: number]: WaitConditionType }): boolean {
    for (const [channelIndexStr, conditionType] of Object.entries(conditions)) {
      const channelIndex = parseInt(channelIndexStr);
      if (channelIndex >= pins.length) {
        return false;
      }

      const currentValue = pins[channelIndex];
      const lastValue = this.lastState.get(channelIndex) || 0;

      let matched = false;
      switch (conditionType) {
        case 'low':
          matched = currentValue === 0;
          break;
        case 'high':
          matched = currentValue === 1;
          break;
        case 'rising':
          matched = lastValue === 0 && currentValue === 1;
          break;
        case 'falling':
          matched = lastValue === 1 && currentValue === 0;
          break;
        case 'edge':
          matched = lastValue !== currentValue;
          break;
        case 'stable':
          matched = lastValue === currentValue;
          break;
        case 'skip':
          matched = true;
          break;
        default:
          matched = false;
      }

      if (!matched) {
        return false;
      }
    }

    return true;
  }

  /**
   * 准备通道数据
   * @param channels 通道数据
   * @param channelMapping 通道映射
   */
  protected prepareChannelData(channels: ChannelData[], channelMapping: DecoderSelectedChannel[]): void {
    this.channelData = [];

    // 确定最大解码器索引以初始化数组大小
    const maxDecoderIndex = channelMapping.reduce((max, mapping) =>
      Math.max(max, mapping.decoderIndex), -1);

    // 初始化所有通道数据为空数组
    for (let i = 0; i <= maxDecoderIndex; i++) {
      this.channelData[i] = new Uint8Array(channels[0]?.samples?.length || 0);
    }

    // 填充实际的通道数据
    for (const mapping of channelMapping) {
      if (mapping.captureIndex < channels.length && channels[mapping.captureIndex].samples) {
        this.channelData[mapping.decoderIndex] = channels[mapping.captureIndex].samples;
      }
    }
  }

  /**
   * 获取解码器信息
   * @returns 解码器信息
   */
  public getInfo() {
    return {
      id: this.id,
      name: this.name,
      longname: this.longname,
      description: this.desc,
      license: this.license,
      inputs: this.inputs,
      outputs: this.outputs,
      tags: this.tags,
      channels: this.channels,
      options: this.options,
      annotations: this.annotations,
      annotationRows: this.annotationRows
    };
  }

  /**
   * 验证选项配置
   * @param options 选项值
   * @param selectedChannels 选中通道
   * @param channels 通道数据
   * @returns 是否有效
   */
  public validateOptions(
    options: DecoderOptionValue[],
    selectedChannels: DecoderSelectedChannel[],
    _channels: ChannelData[]
  ): boolean {
    // 验证必需通道是否都已选择
    const requiredChannels = this.channels.filter(ch => ch.required);
    for (const reqChannel of requiredChannels) {
      const hasChannel = selectedChannels.some(sel => sel.decoderIndex === (reqChannel.index || 0));
      if (!hasChannel) {
        return false;
      }
    }

    // 验证选项值
    for (const option of options) {
      if (option.optionIndex >= this.options.length) {
        return false;
      }
      // 可以添加更多选项验证逻辑
    }

    return true;
  }

}
