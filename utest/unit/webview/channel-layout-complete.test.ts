/**
 * 🎯 ChannelLayoutManager完善测试 - 从98.11%提升到99%+
 * 目标：覆盖剩余的第96行分组代码分支
 */

import { ChannelLayoutManager } from '../../../src/webview/engines/ChannelLayoutManager';
import { AnalyzerChannel } from '../../../src/models/CaptureModels';

describe('🎯 ChannelLayoutManager 完善测试', () => {

  let layoutManager: ChannelLayoutManager;
  let mockChannels: AnalyzerChannel[];

  beforeEach(() => {
    layoutManager = new ChannelLayoutManager();
    
    // 创建模拟通道数据
    mockChannels = [
      {
        id: 0,
        name: 'CH0',
        hidden: false,
        minimized: false,
        data: new Uint8Array([1, 0, 1, 0]),
        color: '#FF0000'
      },
      {
        id: 1,
        name: 'CH1', 
        hidden: false,
        minimized: false,
        data: new Uint8Array([0, 1, 0, 1]),
        color: '#00FF00'
      },
      {
        id: 2,
        name: 'CH2',
        hidden: false,
        minimized: true,
        data: new Uint8Array([1, 1, 0, 0]),
        color: '#0000FF'
      }
    ];
  });

  afterEach(() => {
    if (layoutManager) {
      layoutManager.dispose();
    }
  });

  describe('📊 覆盖分组代码路径', () => {

    it('应该覆盖layoutWithGroups分支 (第96行)', () => {
      // 设置通道数据
      layoutManager.setChannels(mockChannels);

      // 通过反射设置分组数据，以触发第96行的代码
      // 这会让 this.groups.length > 0 条件为真
      (layoutManager as any).groups = [
        {
          name: 'Group 1',
          channels: [0, 1],
          collapsed: false,
          color: '#FFAA00'
        },
        {
          name: 'Group 2', 
          channels: [2],
          collapsed: false,
          color: '#AA00FF'
        }
      ];

      // 触发布局更新，这会执行第96行的代码
      (layoutManager as any).updateLayout();

      // 验证布局结果
      const visibleChannels = layoutManager.getVisibleChannels();
      expect(visibleChannels.length).toBe(3);

      const totalHeight = layoutManager.getTotalHeight();
      expect(totalHeight).toBeGreaterThan(0);

      // 验证分组逻辑被执行
      const allChannels = layoutManager.getAllChannels();
      expect(allChannels.length).toBe(3);
    });

    it('应该测试分组布局的具体逻辑', () => {
      // 创建一个带分组的测试场景
      const channelsWithGroups = [
        { id: 0, name: 'CH0', hidden: false, minimized: false, data: new Uint8Array([]), color: '#FF0000' },
        { id: 1, name: 'CH1', hidden: false, minimized: false, data: new Uint8Array([]), color: '#00FF00' },
        { id: 2, name: 'CH2', hidden: true, minimized: false, data: new Uint8Array([]), color: '#0000FF' }, // 隐藏通道
        { id: 3, name: 'CH3', hidden: false, minimized: true, data: new Uint8Array([]), color: '#FFFF00' }  // 最小化通道
      ];

      layoutManager.setChannels(channelsWithGroups);

      // 设置分组
      (layoutManager as any).groups = [
        {
          name: 'Digital Channels',
          channels: [0, 1, 2, 3],
          collapsed: false
        }
      ];

      // 触发带分组的布局计算
      (layoutManager as any).updateLayout();

      // 验证只有可见通道被布局（应该排除隐藏的CH2）
      const visibleChannels = layoutManager.getVisibleChannels();
      expect(visibleChannels.length).toBe(3); // CH0, CH1, CH3 (CH2被隐藏)

      // 验证每个通道的布局信息
      visibleChannels.forEach(channelInfo => {
        expect(channelInfo.yPosition).toBeGreaterThanOrEqual(0);
        expect(channelInfo.height).toBeGreaterThan(0);
        expect(channelInfo.hidden).toBe(false);
      });
    });

  });

  describe('🔄 完整功能测试', () => {

    it('应该正确处理空分组列表', () => {
      // 测试空分组的情况（确保无分组分支也被覆盖）
      layoutManager.setChannels(mockChannels);
      
      // 确保分组为空
      (layoutManager as any).groups = [];
      
      (layoutManager as any).updateLayout();

      const visibleChannels = layoutManager.getVisibleChannels();
      expect(visibleChannels.length).toBe(3);
    });

    it('应该正确计算最小化通道的高度', () => {
      const channelsWithMinimized = [
        { id: 0, name: 'CH0', hidden: false, minimized: true, data: new Uint8Array([]), color: '#FF0000' },
        { id: 1, name: 'CH1', hidden: false, minimized: false, data: new Uint8Array([]), color: '#00FF00' }
      ];

      layoutManager.setChannels(channelsWithMinimized);

      const channelInfo0 = layoutManager.getChannelInfo(0);
      const channelInfo1 = layoutManager.getChannelInfo(1);

      // 最小化通道高度应该更小
      expect(channelInfo0?.height).toBeLessThan(channelInfo1?.height || 0);
    });

    it('应该正确处理Y坐标查找', () => {
      layoutManager.setChannels(mockChannels);

      const allChannels = layoutManager.getAllChannels();
      if (allChannels.length > 0) {
        const firstChannel = allChannels[0];
        
        // 在通道范围内查找
        const foundChannel = layoutManager.getChannelAtY(firstChannel.yPosition + 5);
        expect(foundChannel).toBe(firstChannel);

        // 在通道范围外查找
        const notFoundChannel = layoutManager.getChannelAtY(-10);
        expect(notFoundChannel).toBeNull();
      }
    });

    it('应该正确管理通道可见性', () => {
      layoutManager.setChannels(mockChannels);

      const initialVisibleCount = layoutManager.getVisibleChannelCount();
      
      // 隐藏第一个通道
      layoutManager.setChannelVisibility(0, false);
      expect(layoutManager.getVisibleChannelCount()).toBe(initialVisibleCount - 1);

      // 重新显示
      layoutManager.setChannelVisibility(0, true);
      expect(layoutManager.getVisibleChannelCount()).toBe(initialVisibleCount);
    });

    it('应该正确处理边界索引', () => {
      layoutManager.setChannels(mockChannels);

      // 测试无效索引
      layoutManager.setChannelVisibility(-1, false); // 不应该崩溃
      layoutManager.setChannelVisibility(999, false); // 不应该崩溃

      const invalidInfo = layoutManager.getChannelInfo(-1);
      expect(invalidInfo).toBeNull();

      const invalidInfo2 = layoutManager.getChannelInfo(999);
      expect(invalidInfo2).toBeNull();
    });

  });

  describe('🧹 边界条件和清理测试', () => {

    it('应该正确处理空通道列表', () => {
      layoutManager.setChannels([]);

      expect(layoutManager.getVisibleChannelCount()).toBe(0);
      expect(layoutManager.getTotalHeight()).toBe(0);
      expect(layoutManager.getVisibleChannels()).toEqual([]);
      expect(layoutManager.getAllChannels()).toEqual([]);
    });

    it('应该正确清理所有资源', () => {
      layoutManager.setChannels(mockChannels);
      
      // 验证有数据
      expect(layoutManager.getVisibleChannelCount()).toBeGreaterThan(0);
      
      // 清理
      layoutManager.dispose();
      
      // 验证清理后的状态
      expect(layoutManager.getVisibleChannelCount()).toBe(0);
      expect(layoutManager.getTotalHeight()).toBe(0);
      expect(layoutManager.getAllChannels()).toEqual([]);
    });

    it('应该支持自定义配置', () => {
      const customConfig = {
        channelHeight: 80,
        channelSpacing: 5,
        marginTop: 20,
        marginBottom: 20,
        showChannelLabels: false,
        labelWidth: 100,
        groupSpacing: 15
      };

      const customLayoutManager = new ChannelLayoutManager(customConfig);
      customLayoutManager.setChannels(mockChannels);

      const totalHeight = customLayoutManager.getTotalHeight();
      expect(totalHeight).toBeGreaterThan(0);

      customLayoutManager.dispose();
    });

  });

});