/**
 * 通道映射管理模块
 * 基于 @logicanalyzer/Software 的通道配置功能
 * 提供解码器通道映射的验证、管理和可视化功能
 */

import type { DecoderInfo, DecoderSelectedChannel } from './types';
import type { AnalyzerChannel } from '../models/AnalyzerTypes';

/**
 * 通道映射验证结果
 */
export interface ChannelMappingValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
  /** 缺失的必需通道 */
  missingRequiredChannels: string[];
  /** 冲突的通道映射 */
  conflictingMappings: Array<{
    channel: string;
    conflicts: string[];
  }>;
}

/**
 * 通道映射配置
 */
export interface ChannelMappingConfig {
  /** 解码器ID */
  decoderId: string;
  /** 解码器名称 */
  decoderName: string;
  /** 通道映射 */
  mapping: Record<string, number>;
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 通道使用情况
 */
export interface ChannelUsage {
  /** 通道编号 */
  channelNumber: number;
  /** 使用该通道的解码器列表 */
  usedBy: Array<{
    decoderId: string;
    decoderName: string;
    channelName: string;
  }>;
  /** 是否被使用 */
  isUsed: boolean;
}

/**
 * 通道映射管理器
 */
export class ChannelMappingManager {
  /** 保存的通道映射配置 */
  private savedMappings = new Map<string, ChannelMappingConfig>();

  /** 当前活跃的映射 */
  private activeMappings = new Map<string, Record<string, number>>();

  /**
   * 验证通道映射
   * @param decoderInfo 解码器信息
   * @param mapping 通道映射
   * @param availableChannels 可用通道
   * @returns 验证结果
   */
  public validateChannelMapping(
    decoderInfo: DecoderInfo,
    mapping: Record<string, number>,
    availableChannels: AnalyzerChannel[]
  ): ChannelMappingValidationResult {
    const result: ChannelMappingValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      missingRequiredChannels: [],
      conflictingMappings: []
    };

    // 检查必需通道
    const requiredChannels = decoderInfo.channels.filter(ch => ch.required);
    for (const reqChannel of requiredChannels) {
      if (!(reqChannel.id in mapping)) {
        result.missingRequiredChannels.push(reqChannel.name);
        result.errors.push(`缺少必需通道: ${reqChannel.name} (${reqChannel.desc})`);
        result.isValid = false;
      }
    }

    // 检查通道范围
    const maxChannelIndex = availableChannels.length - 1;
    for (const [channelId, channelIndex] of Object.entries(mapping)) {
      if (channelIndex < 0 || channelIndex > maxChannelIndex) {
        result.errors.push(`通道 ${channelId} 映射到无效的通道索引: ${channelIndex}`);
        result.isValid = false;
      }
    }

    // 检查通道冲突（同一解码器内）
    const usedIndices = new Set<number>();
    const duplicateIndices = new Set<number>();

    for (const [, channelIndex] of Object.entries(mapping)) {
      if (usedIndices.has(channelIndex)) {
        duplicateIndices.add(channelIndex);
      } else {
        usedIndices.add(channelIndex);
      }
    }

    if (duplicateIndices.size > 0) {
      for (const duplicateIndex of duplicateIndices) {
        const conflictingChannels = Object.entries(mapping)
          .filter(([_, index]) => index === duplicateIndex)
          .map(([channelId, _]) => channelId);

        result.conflictingMappings.push({
          channel: `CH${duplicateIndex + 1}`,
          conflicts: conflictingChannels
        });

        result.errors.push(
          `通道 CH${duplicateIndex + 1} 被多个解码器通道使用: ${conflictingChannels.join(', ')}`
        );
        result.isValid = false;
      }
    }

    // 检查通道数据可用性
    for (const [channelId, channelIndex] of Object.entries(mapping)) {
      const channel = availableChannels[channelIndex];
      if (!channel || !channel.samples || channel.samples.length === 0) {
        result.warnings.push(`通道 ${channelId} (CH${channelIndex + 1}) 没有可用数据`);
      }
    }

    return result;
  }

  /**
   * 获取通道使用情况
   * @param activeMappings 所有活跃的通道映射
   * @param maxChannels 最大通道数
   * @returns 通道使用情况
   */
  public getChannelUsage(
    activeMappings: Map<string, { decoderName: string; mapping: Record<string, number> }>,
    maxChannels: number = 24
  ): ChannelUsage[] {
    const usage: ChannelUsage[] = [];

    // 初始化所有通道
    for (let i = 0; i < maxChannels; i++) {
      usage.push({
        channelNumber: i,
        usedBy: [],
        isUsed: false
      });
    }

    // 统计通道使用情况
    for (const [decoderId, config] of activeMappings) {
      for (const [channelName, channelIndex] of Object.entries(config.mapping)) {
        if (channelIndex >= 0 && channelIndex < maxChannels) {
          usage[channelIndex].usedBy.push({
            decoderId,
            decoderName: config.decoderName,
            channelName
          });
          usage[channelIndex].isUsed = true;
        }
      }
    }

    return usage;
  }

  /**
   * 检测通道映射冲突
   * @param activeMappings 所有活跃的通道映射
   * @returns 冲突的通道列表
   */
  public detectChannelConflicts(
    activeMappings: Map<string, { decoderName: string; mapping: Record<string, number> }>
  ): Array<{
    channelNumber: number;
    conflicts: Array<{
      decoderId: string;
      decoderName: string;
      channelName: string;
    }>;
  }> {
    const usage = this.getChannelUsage(activeMappings);

    return usage
      .filter(channel => channel.usedBy.length > 1)
      .map(channel => ({
        channelNumber: channel.channelNumber,
        conflicts: channel.usedBy
      }));
  }

  /**
   * 自动分配通道映射
   * @param decoderInfo 解码器信息
   * @param usedChannels 已使用的通道索引
   * @param maxChannels 最大通道数
   * @returns 自动分配的通道映射
   */
  public autoAssignChannels(
    decoderInfo: DecoderInfo,
    usedChannels: Set<number> = new Set(),
    maxChannels: number = 24
  ): Record<string, number> {
    const mapping: Record<string, number> = {};
    let nextAvailableChannel = 0;

    // 首先分配必需通道
    const requiredChannels = decoderInfo.channels.filter(ch => ch.required);
    for (const channel of requiredChannels) {
      // 找到下一个可用通道
      while (nextAvailableChannel < maxChannels && usedChannels.has(nextAvailableChannel)) {
        nextAvailableChannel++;
      }

      if (nextAvailableChannel < maxChannels) {
        mapping[channel.id] = nextAvailableChannel;
        usedChannels.add(nextAvailableChannel);
        nextAvailableChannel++;
      }
    }

    // 然后分配可选通道
    const optionalChannels = decoderInfo.channels.filter(ch => !ch.required);
    for (const channel of optionalChannels) {
      // 找到下一个可用通道
      while (nextAvailableChannel < maxChannels && usedChannels.has(nextAvailableChannel)) {
        nextAvailableChannel++;
      }

      if (nextAvailableChannel < maxChannels) {
        mapping[channel.id] = nextAvailableChannel;
        usedChannels.add(nextAvailableChannel);
        nextAvailableChannel++;
      }
    }

    return mapping;
  }

  /**
   * 保存通道映射配置
   * @param decoderId 解码器ID
   * @param decoderName 解码器名称
   * @param mapping 通道映射
   */
  public saveChannelMapping(decoderId: string, decoderName: string, mapping: Record<string, number>): void {
    const now = new Date();
    const existingConfig = this.savedMappings.get(decoderId);

    const config: ChannelMappingConfig = {
      decoderId,
      decoderName,
      mapping: { ...mapping },
      createdAt: existingConfig?.createdAt || now,
      updatedAt: now
    };

    this.savedMappings.set(decoderId, config);
    console.log(`📁 通道映射已保存: ${decoderName} (${decoderId})`);
  }

  /**
   * 加载通道映射配置
   * @param decoderId 解码器ID
   * @returns 保存的通道映射配置
   */
  public loadChannelMapping(decoderId: string): ChannelMappingConfig | null {
    return this.savedMappings.get(decoderId) || null;
  }

  /**
   * 获取所有保存的通道映射
   * @returns 所有保存的通道映射配置
   */
  public getAllSavedMappings(): ChannelMappingConfig[] {
    return Array.from(this.savedMappings.values()).sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * 删除保存的通道映射
   * @param decoderId 解码器ID
   */
  public deleteSavedMapping(decoderId: string): boolean {
    return this.savedMappings.delete(decoderId);
  }

  /**
   * 清空所有保存的通道映射
   */
  public clearAllSavedMappings(): void {
    this.savedMappings.clear();
    console.log('🗑️ 所有保存的通道映射已清空');
  }

  /**
   * 导出通道映射配置
   * @returns JSON格式的配置数据
   */
  public exportMappings(): string {
    const mappings = Array.from(this.savedMappings.entries()).map(([id, config]) => ({
      id,
      ...config,
      // 转换日期对象为字符串
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    }));

    return JSON.stringify({
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      mappings
    }, null, 2);
  }

  /**
   * 导入通道映射配置
   * @param jsonData JSON格式的配置数据
   * @returns 导入结果
   */
  public importMappings(jsonData: string): { success: boolean; error?: string; imported: number } {
    try {
      const data = JSON.parse(jsonData);

      if (!data.mappings || !Array.isArray(data.mappings)) {
        return { success: false, error: '无效的数据格式', imported: 0 };
      }

      let imported = 0;
      for (const mappingData of data.mappings) {
        try {
          // 验证必需字段
          if (!mappingData.decoderId || !mappingData.decoderName || !mappingData.mapping) {
            throw new Error('缺少必需字段');
          }

          const config: ChannelMappingConfig = {
            decoderId: mappingData.decoderId,
            decoderName: mappingData.decoderName,
            mapping: mappingData.mapping,
            createdAt: new Date(mappingData.createdAt),
            updatedAt: new Date(mappingData.updatedAt)
          };

          // 验证日期是否有效
          if (isNaN(config.createdAt.getTime()) || isNaN(config.updatedAt.getTime())) {
            throw new Error('无效的日期格式');
          }

          this.savedMappings.set(config.decoderId, config);
          imported++;
        } catch (error) {
          console.error(`导入通道映射失败: ${mappingData.decoderId}`, error);
        }
      }

      return { success: true, imported };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        imported: 0
      };
    }
  }

  /**
   * 转换为 DecoderSelectedChannel 格式
   * @param mapping 通道映射
   * @returns DecoderSelectedChannel 数组
   */
  public toDecoderSelectedChannels(mapping: Record<string, number>): DecoderSelectedChannel[] {
    return Object.entries(mapping).map(([name, channel], index) => ({
      name,
      channel,
      captureIndex: channel,
      decoderIndex: index
    }));
  }

  /**
   * 从 DecoderSelectedChannel 格式转换
   * @param channels DecoderSelectedChannel 数组
   * @returns 通道映射对象
   */
  public fromDecoderSelectedChannels(channels: DecoderSelectedChannel[]): Record<string, number> {
    const mapping: Record<string, number> = {};
    for (const channel of channels) {
      mapping[channel.name] = channel.channel;
    }
    return mapping;
  }
}

// 创建全局单例实例
export const channelMappingManager = new ChannelMappingManager();
