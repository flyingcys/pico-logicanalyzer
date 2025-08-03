/**
 * 通道布局管理器
 * 基于原版 SampleViewer 的通道显示逻辑
 * 处理多通道显示、隐藏、排序和布局计算
 */

import { AnalyzerChannel } from '../../models/CaptureModels';

export interface ChannelDisplayInfo {
  channel: AnalyzerChannel;
  index: number; // 在可见通道中的索引
  originalIndex: number; // 在原始通道数组中的索引
  yPosition: number; // Y坐标位置
  height: number; // 通道高度
  hidden: boolean; // 是否隐藏
  minimized: boolean; // 是否最小化显示
}

export interface LayoutConfig {
  channelHeight: number; // 单个通道高度
  channelSpacing: number; // 通道间距
  marginTop: number; // 顶部边距
  marginBottom: number; // 底部边距
  showChannelLabels: boolean; // 是否显示通道标签
  labelWidth: number; // 标签区域宽度
  groupSpacing: number; // 通道组间距
}

export interface ChannelGroup {
  name: string;
  channels: number[]; // 通道索引数组
  collapsed: boolean; // 是否折叠
  color?: string; // 组颜色
}

export interface LayoutResult {
  channels: ChannelDisplayInfo[];
  totalHeight: number;
  visibleChannelCount: number;
  config: LayoutConfig;
}

export class ChannelLayoutManager {
  private channels: AnalyzerChannel[] = [];
  private displayInfos: ChannelDisplayInfo[] = [];
  private config: LayoutConfig;
  private groups: ChannelGroup[] = [];

  // 基于原版的常量
  private readonly MIN_CHANNEL_HEIGHT = 48;
  private readonly DEFAULT_CHANNEL_HEIGHT = 60;
  private readonly DEFAULT_CHANNEL_SPACING = 2;

  // 布局缓存
  private layoutCache: Map<string, ChannelDisplayInfo[]> = new Map();
  private totalHeight = 0;

  constructor(config?: Partial<LayoutConfig>) {
    this.config = {
      channelHeight: this.DEFAULT_CHANNEL_HEIGHT,
      channelSpacing: this.DEFAULT_CHANNEL_SPACING,
      marginTop: 10,
      marginBottom: 10,
      showChannelLabels: true,
      labelWidth: 80,
      groupSpacing: 10,
      ...config
    };
  }

  /**
   * 设置通道数据 - 基于原版的通道处理逻辑
   */
  public setChannels(channels: AnalyzerChannel[]): void {
    this.channels = channels;
    this.updateLayout();
  }

  /**
   * 更新布局 - 重新计算所有通道的显示信息
   */
  private updateLayout(): void {
    this.displayInfos = [];

    if (this.channels.length === 0) {
      this.totalHeight = 0;
      return;
    }

    // 基于原版的逻辑：只显示非隐藏的通道
    const visibleChannels = this.channels.filter(ch => !ch.hidden);
    let currentY = this.config.marginTop;

    // 计算分组显示
    if (this.groups.length > 0) {
      currentY = this.layoutWithGroups(visibleChannels, currentY);
    } else {
      currentY = this.layoutWithoutGroups(visibleChannels, currentY);
    }

    // 计算总高度
    this.totalHeight = Math.max(
      visibleChannels.length * this.MIN_CHANNEL_HEIGHT,
      currentY + this.config.marginBottom
    );

    // 清除布局缓存
    this.layoutCache.clear();
  }

  /**
   * 无分组的布局计算
   */
  private layoutWithoutGroups(visibleChannels: AnalyzerChannel[], startY: number): number {
    let currentY = startY;

    visibleChannels.forEach((channel, visibleIndex) => {
      const originalIndex = this.channels.indexOf(channel);
      const height = channel.minimized ? this.MIN_CHANNEL_HEIGHT / 2 : this.config.channelHeight;

      const displayInfo: ChannelDisplayInfo = {
        channel,
        index: visibleIndex,
        originalIndex,
        yPosition: currentY,
        height,
        hidden: false,
        minimized: channel.minimized || false
      };

      this.displayInfos.push(displayInfo);
      currentY += height + this.config.channelSpacing;
    });

    return currentY;
  }

  /**
   * 带分组的布局计算
   */
  private layoutWithGroups(visibleChannels: AnalyzerChannel[], startY: number): number {
    // 简化的分组处理，暂时只按无分组处理
    return this.layoutWithoutGroups(visibleChannels, startY);
  }

  /**
   * 获取可见通道信息 - 基于原版的过滤逻辑
   */
  public getVisibleChannels(): ChannelDisplayInfo[] {
    return this.displayInfos.filter(info => !info.hidden);
  }

  /**
   * 获取所有通道信息
   */
  public getAllChannels(): ChannelDisplayInfo[] {
    return [...this.displayInfos];
  }

  /**
   * 根据Y坐标获取通道
   */
  public getChannelAtY(y: number): ChannelDisplayInfo | null {
    for (const info of this.displayInfos) {
      if (y >= info.yPosition && y < info.yPosition + info.height) {
        return info;
      }
    }
    return null;
  }

  /**
   * 根据通道索引获取显示信息
   */
  public getChannelInfo(channelIndex: number): ChannelDisplayInfo | null {
    return this.displayInfos.find(info => info.originalIndex === channelIndex) || null;
  }

  /**
   * 隐藏/显示通道 - 基于原版的Hidden属性
   */
  public setChannelVisibility(channelIndex: number, visible: boolean): void {
    if (channelIndex >= 0 && channelIndex < this.channels.length) {
      this.channels[channelIndex].hidden = !visible;
      this.updateLayout();
    }
  }

  /**
   * 获取总高度
   */
  public getTotalHeight(): number {
    return this.totalHeight;
  }

  /**
   * 获取可见通道数量
   */
  public getVisibleChannelCount(): number {
    return this.channels.filter(ch => !ch.hidden).length;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.channels = [];
    this.displayInfos = [];
    this.groups = [];
    this.totalHeight = 0;
    this.layoutCache.clear();
  }
}
