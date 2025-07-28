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
    this.channels = channels;\n    this.updateLayout();\n  }\n  \n  /**\n   * 更新布局 - 重新计算所有通道的显示信息\n   */\n  private updateLayout(): void {\n    this.displayInfos = [];\n    \n    if (this.channels.length === 0) {\n      this.totalHeight = 0;\n      return;\n    }\n    \n    // 基于原版的逻辑：只显示非隐藏的通道\n    const visibleChannels = this.channels.filter(ch => !ch.hidden);\n    let currentY = this.config.marginTop;\n    \n    // 计算分组显示\n    if (this.groups.length > 0) {\n      this.layoutWithGroups(visibleChannels, currentY);\n    } else {\n      this.layoutWithoutGroups(visibleChannels, currentY);\n    }\n    \n    // 计算总高度\n    this.totalHeight = Math.max(\n      visibleChannels.length * this.MIN_CHANNEL_HEIGHT,\n      currentY + this.config.marginBottom\n    );\n    \n    // 清除布局缓存\n    this.layoutCache.clear();\n  }\n  \n  /**\n   * 无分组的布局计算\n   */\n  private layoutWithoutGroups(visibleChannels: AnalyzerChannel[], startY: number): void {\n    let currentY = startY;\n    \n    visibleChannels.forEach((channel, visibleIndex) => {\n      const originalIndex = this.channels.indexOf(channel);\n      const height = channel.minimized ? this.MIN_CHANNEL_HEIGHT / 2 : this.config.channelHeight;\n      \n      const displayInfo: ChannelDisplayInfo = {\n        channel,\n        index: visibleIndex,\n        originalIndex,\n        yPosition: currentY,\n        height,\n        hidden: false,\n        minimized: channel.minimized || false\n      };\n      \n      this.displayInfos.push(displayInfo);\n      currentY += height + this.config.channelSpacing;\n    });\n  }\n  \n  /**\n   * 带分组的布局计算\n   */\n  private layoutWithGroups(visibleChannels: AnalyzerChannel[], startY: number): void {\n    let currentY = startY;\n    let visibleIndex = 0;\n    \n    // 处理分组通道\n    for (const group of this.groups) {\n      if (group.collapsed) {\n        // 折叠组只显示组标题\n        currentY += this.MIN_CHANNEL_HEIGHT / 2 + this.config.groupSpacing;\n        continue;\n      }\n      \n      // 组标题空间\n      if (group.name) {\n        currentY += 20;\n      }\n      \n      // 组内通道\n      for (const channelIndex of group.channels) {\n        if (channelIndex >= this.channels.length) continue;\n        \n        const channel = this.channels[channelIndex];\n        if (channel.hidden) continue;\n        \n        const height = channel.minimized ? this.MIN_CHANNEL_HEIGHT / 2 : this.config.channelHeight;\n        \n        const displayInfo: ChannelDisplayInfo = {\n          channel,\n          index: visibleIndex++,\n          originalIndex: channelIndex,\n          yPosition: currentY,\n          height,\n          hidden: false,\n          minimized: channel.minimized || false\n        };\n        \n        this.displayInfos.push(displayInfo);\n        currentY += height + this.config.channelSpacing;\n      }\n      \n      currentY += this.config.groupSpacing;\n    }\n    \n    // 处理未分组的通道\n    const groupedChannelIndices = new Set(this.groups.flatMap(g => g.channels));\n    \n    for (let i = 0; i < this.channels.length; i++) {\n      if (groupedChannelIndices.has(i)) continue;\n      \n      const channel = this.channels[i];\n      if (channel.hidden) continue;\n      \n      const height = channel.minimized ? this.MIN_CHANNEL_HEIGHT / 2 : this.config.channelHeight;\n      \n      const displayInfo: ChannelDisplayInfo = {\n        channel,\n        index: visibleIndex++,\n        originalIndex: i,\n        yPosition: currentY,\n        height,\n        hidden: false,\n        minimized: channel.minimized || false\n      };\n      \n      this.displayInfos.push(displayInfo);\n      currentY += height + this.config.channelSpacing;\n    }\n  }\n  \n  /**\n   * 获取可见通道信息 - 基于原版的过滤逻辑\n   */\n  public getVisibleChannels(): ChannelDisplayInfo[] {\n    return this.displayInfos.filter(info => !info.hidden);\n  }\n  \n  /**\n   * 获取所有通道信息\n   */\n  public getAllChannels(): ChannelDisplayInfo[] {\n    return [...this.displayInfos];\n  }\n  \n  /**\n   * 根据Y坐标获取通道\n   */\n  public getChannelAtY(y: number): ChannelDisplayInfo | null {\n    for (const info of this.displayInfos) {\n      if (y >= info.yPosition && y < info.yPosition + info.height) {\n        return info;\n      }\n    }\n    return null;\n  }\n  \n  /**\n   * 根据通道索引获取显示信息\n   */\n  public getChannelInfo(channelIndex: number): ChannelDisplayInfo | null {\n    return this.displayInfos.find(info => info.originalIndex === channelIndex) || null;\n  }\n  \n  /**\n   * 隐藏/显示通道 - 基于原版的Hidden属性\n   */\n  public setChannelVisibility(channelIndex: number, visible: boolean): void {\n    if (channelIndex >= 0 && channelIndex < this.channels.length) {\n      this.channels[channelIndex].hidden = !visible;\n      this.updateLayout();\n    }\n  }\n  \n  /**\n   * 最小化/展开通道\n   */\n  public setChannelMinimized(channelIndex: number, minimized: boolean): void {\n    if (channelIndex >= 0 && channelIndex < this.channels.length) {\n      this.channels[channelIndex].minimized = minimized;\n      this.updateLayout();\n    }\n  }\n  \n  /**\n   * 切换通道可见性\n   */\n  public toggleChannelVisibility(channelIndex: number): void {\n    if (channelIndex >= 0 && channelIndex < this.channels.length) {\n      this.channels[channelIndex].hidden = !this.channels[channelIndex].hidden;\n      this.updateLayout();\n    }\n  }\n  \n  /**\n   * 显示所有通道\n   */\n  public showAllChannels(): void {\n    this.channels.forEach(channel => {\n      channel.hidden = false;\n    });\n    this.updateLayout();\n  }\n  \n  /**\n   * 隐藏所有通道\n   */\n  public hideAllChannels(): void {\n    this.channels.forEach(channel => {\n      channel.hidden = true;\n    });\n    this.updateLayout();\n  }\n  \n  /**\n   * 移动通道位置\n   */\n  public moveChannel(fromIndex: number, toIndex: number): void {\n    if (fromIndex >= 0 && fromIndex < this.channels.length &&\n        toIndex >= 0 && toIndex < this.channels.length &&\n        fromIndex !== toIndex) {\n      \n      const channel = this.channels.splice(fromIndex, 1)[0];\n      this.channels.splice(toIndex, 0, channel);\n      this.updateLayout();\n    }\n  }\n  \n  /**\n   * 添加通道组\n   */\n  public addGroup(group: ChannelGroup): void {\n    this.groups.push(group);\n    this.updateLayout();\n  }\n  \n  /**\n   * 移除通道组\n   */\n  public removeGroup(groupName: string): void {\n    const index = this.groups.findIndex(g => g.name === groupName);\n    if (index !== -1) {\n      this.groups.splice(index, 1);\n      this.updateLayout();\n    }\n  }\n  \n  /**\n   * 切换组折叠状态\n   */\n  public toggleGroupCollapsed(groupName: string): void {\n    const group = this.groups.find(g => g.name === groupName);\n    if (group) {\n      group.collapsed = !group.collapsed;\n      this.updateLayout();\n    }\n  }\n  \n  /**\n   * 获取通道组信息\n   */\n  public getGroups(): ChannelGroup[] {\n    return [...this.groups];\n  }\n  \n  /**\n   * 计算通道的垂直边距 - 基于原版的margin计算\n   */\n  public getChannelMargins(channelIndex: number): { top: number, bottom: number } {\n    const info = this.getChannelInfo(channelIndex);\n    if (!info) {\n      return { top: 0, bottom: 0 };\n    }\n    \n    const margin = info.height / 5; // 基于原版的 channelHeight / 5\n    return {\n      top: margin,\n      bottom: margin\n    };\n  }\n  \n  /**\n   * 计算信号的Y坐标 - 基于原版的信号位置计算\n   */\n  public getSignalYPositions(channelIndex: number): { high: number, low: number, center: number } {\n    const info = this.getChannelInfo(channelIndex);\n    if (!info) {\n      return { high: 0, low: 0, center: 0 };\n    }\n    \n    const margins = this.getChannelMargins(channelIndex);\n    const center = info.yPosition + info.height / 2;\n    const signalHeight = info.height - margins.top - margins.bottom;\n    \n    return {\n      high: center - signalHeight / 2,\n      low: center + signalHeight / 2,\n      center\n    };\n  }\n  \n  /**\n   * 获取布局配置\n   */\n  public getConfig(): LayoutConfig {\n    return { ...this.config };\n  }\n  \n  /**\n   * 更新布局配置\n   */\n  public updateConfig(config: Partial<LayoutConfig>): void {\n    this.config = { ...this.config, ...config };\n    this.updateLayout();\n  }\n  \n  /**\n   * 获取总高度\n   */\n  public getTotalHeight(): number {\n    return this.totalHeight;\n  }\n  \n  /**\n   * 获取可见通道数量\n   */\n  public getVisibleChannelCount(): number {\n    return this.channels.filter(ch => !ch.hidden).length;\n  }\n  \n  /**\n   * 自动调整通道高度以适应容器\n   */\n  public autoFitChannels(containerHeight: number): void {\n    const visibleCount = this.getVisibleChannelCount();\n    if (visibleCount === 0) return;\n    \n    const availableHeight = containerHeight - this.config.marginTop - this.config.marginBottom;\n    const totalSpacing = (visibleCount - 1) * this.config.channelSpacing;\n    const channelHeight = Math.max(\n      this.MIN_CHANNEL_HEIGHT,\n      (availableHeight - totalSpacing) / visibleCount\n    );\n    \n    this.config.channelHeight = channelHeight;\n    this.updateLayout();\n  }\n  \n  /**\n   * 导出布局配置\n   */\n  public exportLayout(): any {\n    return {\n      config: this.config,\n      groups: this.groups,\n      channelStates: this.channels.map(ch => ({\n        hidden: ch.hidden,\n        minimized: ch.minimized || false,\n        channelColor: ch.channelColor,\n        channelName: ch.channelName\n      }))\n    };\n  }\n  \n  /**\n   * 导入布局配置\n   */\n  public importLayout(layout: any): void {\n    if (layout.config) {\n      this.config = { ...this.config, ...layout.config };\n    }\n    \n    if (layout.groups) {\n      this.groups = layout.groups;\n    }\n    \n    if (layout.channelStates && Array.isArray(layout.channelStates)) {\n      layout.channelStates.forEach((state: any, index: number) => {\n        if (index < this.channels.length) {\n          if (state.hidden !== undefined) {\n            this.channels[index].hidden = state.hidden;\n          }\n          if (state.minimized !== undefined) {\n            this.channels[index].minimized = state.minimized;\n          }\n          if (state.channelColor !== undefined) {\n            this.channels[index].channelColor = state.channelColor;\n          }\n          if (state.channelName !== undefined) {\n            this.channels[index].channelName = state.channelName;\n          }\n        }\n      });\n    }\n    \n    this.updateLayout();\n  }\n  \n  /**\n   * 重置布局到默认状态\n   */\n  public resetLayout(): void {\n    this.groups = [];\n    this.channels.forEach(channel => {\n      channel.hidden = false;\n      channel.minimized = false;\n    });\n    \n    this.config.channelHeight = this.DEFAULT_CHANNEL_HEIGHT;\n    this.config.channelSpacing = this.DEFAULT_CHANNEL_SPACING;\n    \n    this.updateLayout();\n  }\n  \n  /**\n   * 清理资源\n   */\n  public dispose(): void {\n    this.channels = [];\n    this.displayInfos = [];\n    this.groups = [];\n    this.layoutCache.clear();\n  }\n}"