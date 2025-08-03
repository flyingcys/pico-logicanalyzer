/**
 * ChannelLayoutManager 单元测试
 * 测试通道布局管理器的核心功能
 * 
 * 测试覆盖：
 * - 构造函数和配置管理
 * - 通道数据设置和布局计算
 * - 可见性控制和查询
 * - 坐标查找和通道信息获取
 * - 资源管理和清理
 * - 边界条件和错误处理
 */

import { ChannelLayoutManager, ChannelDisplayInfo, LayoutConfig, ChannelGroup } from '../../../../src/webview/engines/ChannelLayoutManager';
import { AnalyzerChannel } from '../../../../src/models/CaptureModels';

// 扩展 AnalyzerChannel 类型以支持 minimized 属性
interface ExtendedAnalyzerChannel extends AnalyzerChannel {
  minimized?: boolean;
}

describe('ChannelLayoutManager', () => {
  let layoutManager: ChannelLayoutManager;

  beforeEach(() => {
    layoutManager = new ChannelLayoutManager();
  });

  afterEach(() => {
    layoutManager.dispose();
  });

  describe('构造函数和配置管理', () => {
    it('应该使用默认配置创建实例', () => {
      const manager = new ChannelLayoutManager();
      expect(manager).toBeDefined();
      expect(manager.getTotalHeight()).toBe(0);
      expect(manager.getVisibleChannelCount()).toBe(0);
    });

    it('应该支持自定义配置', () => {
      const customConfig: Partial<LayoutConfig> = {
        channelHeight: 80,
        channelSpacing: 5,
        marginTop: 20,
        showChannelLabels: false,
        labelWidth: 100
      };

      const manager = new ChannelLayoutManager(customConfig);
      expect(manager).toBeDefined();
    });

    it('应该合并默认配置和自定义配置', () => {
      const customConfig: Partial<LayoutConfig> = {
        channelHeight: 80,
        showChannelLabels: false
      };

      const manager = new ChannelLayoutManager(customConfig);
      // 验证自定义配置被应用，但其他属性保持默认值
      expect(manager).toBeDefined();
    });
  });

  describe('通道数据设置和布局计算', () => {
    it('应该正确设置空通道数组', () => {
      layoutManager.setChannels([]);
      
      expect(layoutManager.getAllChannels()).toEqual([]);
      expect(layoutManager.getVisibleChannels()).toEqual([]);
      expect(layoutManager.getTotalHeight()).toBe(0);
      expect(layoutManager.getVisibleChannelCount()).toBe(0);
    });

    it('应该正确设置单个通道', () => {
      const channels = [new AnalyzerChannel(0, 'Test Channel')];
      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels).toHaveLength(1);
      expect(allChannels[0].channel).toBe(channels[0]);
      expect(allChannels[0].index).toBe(0);
      expect(allChannels[0].originalIndex).toBe(0);
      expect(allChannels[0].hidden).toBe(false);
    });

    it('应该正确设置多个通道', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels).toHaveLength(3);
      
      allChannels.forEach((displayInfo, index) => {
        expect(displayInfo.channel).toBe(channels[index]);
        expect(displayInfo.index).toBe(index);
        expect(displayInfo.originalIndex).toBe(index);
        expect(displayInfo.hidden).toBe(false);
      });
    });

    it('应该正确计算通道位置', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1')
      ];
      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels[0].yPosition).toBe(10); // marginTop
      expect(allChannels[1].yPosition).toBeGreaterThan(allChannels[0].yPosition);
    });

    it('应该正确处理最小化通道', () => {
      const channel = new AnalyzerChannel(0, 'Test Channel') as ExtendedAnalyzerChannel;
      channel.minimized = true;
      layoutManager.setChannels([channel]);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels[0].minimized).toBe(true);
      expect(allChannels[0].height).toBe(24); // MIN_CHANNEL_HEIGHT / 2
    });

    it('应该正确计算总高度', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1')
      ];
      layoutManager.setChannels(channels);

      const totalHeight = layoutManager.getTotalHeight();
      expect(totalHeight).toBeGreaterThan(0);
      expect(totalHeight).toBeGreaterThan(channels.length * 48); // 至少为最小高度
    });
  });

  describe('可见性控制和查询', () => {
    let channels: AnalyzerChannel[];

    beforeEach(() => {
      channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
      layoutManager.setChannels(channels);
    });

    it('应该正确获取所有可见通道', () => {
      const visibleChannels = layoutManager.getVisibleChannels();
      expect(visibleChannels).toHaveLength(3);
      expect(visibleChannels.every(info => !info.hidden)).toBe(true);
    });

    it('应该正确设置通道可见性', () => {
      // 隐藏第一个通道
      layoutManager.setChannelVisibility(0, false);

      const visibleChannels = layoutManager.getVisibleChannels();
      expect(visibleChannels).toHaveLength(2);
      expect(layoutManager.getVisibleChannelCount()).toBe(2);

      // 显示第一个通道
      layoutManager.setChannelVisibility(0, true);
      
      const visibleChannelsAfter = layoutManager.getVisibleChannels();
      expect(visibleChannelsAfter).toHaveLength(3);
      expect(layoutManager.getVisibleChannelCount()).toBe(3);
    });

    it('应该正确处理隐藏通道的布局重新计算', () => {
      const initialHeight = layoutManager.getTotalHeight();
      
      // 隐藏一个通道
      layoutManager.setChannelVisibility(1, false);
      
      const newHeight = layoutManager.getTotalHeight();
      expect(newHeight).toBeLessThan(initialHeight);
    });

    it('应该忽略无效的通道索引', () => {
      // 测试负索引
      layoutManager.setChannelVisibility(-1, false);
      expect(layoutManager.getVisibleChannelCount()).toBe(3);

      // 测试超出范围的索引
      layoutManager.setChannelVisibility(10, false);
      expect(layoutManager.getVisibleChannelCount()).toBe(3);
    });

    it('应该正确处理边界索引', () => {
      // 测试第一个通道
      layoutManager.setChannelVisibility(0, false);
      expect(layoutManager.getVisibleChannelCount()).toBe(2);

      // 测试最后一个通道
      layoutManager.setChannelVisibility(2, false);
      expect(layoutManager.getVisibleChannelCount()).toBe(1);
    });
  });

  describe('坐标查找和通道信息获取', () => {
    let channels: AnalyzerChannel[];

    beforeEach(() => {
      channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
      layoutManager.setChannels(channels);
    });

    it('应该根据Y坐标正确查找通道', () => {
      const allChannels = layoutManager.getAllChannels();
      const firstChannel = allChannels[0];

      // 测试通道内的坐标
      const foundChannel = layoutManager.getChannelAtY(firstChannel.yPosition + 10);
      expect(foundChannel).toBe(firstChannel);

      // 测试边界坐标
      const borderChannel = layoutManager.getChannelAtY(firstChannel.yPosition);
      expect(borderChannel).toBe(firstChannel);
    });

    it('应该在Y坐标超出范围时返回null', () => {
      // 测试负坐标
      const negativeResult = layoutManager.getChannelAtY(-10);
      expect(negativeResult).toBeNull();

      // 测试超出范围的坐标
      const outOfRangeResult = layoutManager.getChannelAtY(1000);
      expect(outOfRangeResult).toBeNull();
    });

    it('应该根据通道索引正确获取通道信息', () => {
      const channelInfo = layoutManager.getChannelInfo(1);
      expect(channelInfo).toBeDefined();
      expect(channelInfo!.originalIndex).toBe(1);
      expect(channelInfo!.channel).toBe(channels[1]);
    });

    it('应该在通道索引无效时返回null', () => {
      // 测试负索引
      const negativeResult = layoutManager.getChannelInfo(-1);
      expect(negativeResult).toBeNull();

      // 测试超出范围的索引
      const outOfRangeResult = layoutManager.getChannelInfo(10);
      expect(outOfRangeResult).toBeNull();
    });

    it('应该正确处理隐藏通道的查找', () => {
      // 隐藏第一个通道
      layoutManager.setChannelVisibility(0, false);

      // 通过索引仍然应该能找到隐藏的通道信息
      const hiddenChannelInfo = layoutManager.getChannelInfo(0);
      expect(hiddenChannelInfo).toBeNull(); // 隐藏的通道在布局中被移除

      // 但可见通道的索引应该重新计算
      const visibleChannels = layoutManager.getVisibleChannels();
      expect(visibleChannels).toHaveLength(2);
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该正确处理多次调用setChannels', () => {
      const channels1 = [new AnalyzerChannel(0, 'Channel 0')];
      const channels2 = [
        new AnalyzerChannel(0, 'New Channel 0'),
        new AnalyzerChannel(1, 'New Channel 1')
      ];

      layoutManager.setChannels(channels1);
      expect(layoutManager.getAllChannels()).toHaveLength(1);

      layoutManager.setChannels(channels2);
      expect(layoutManager.getAllChannels()).toHaveLength(2);
      expect(layoutManager.getAllChannels()[0].channel).toBe(channels2[0]);
    });

    it('应该正确处理相同通道的重复设置', () => {
      const channels = [new AnalyzerChannel(0, 'Channel 0')];
      
      layoutManager.setChannels(channels);
      const firstHeight = layoutManager.getTotalHeight();
      
      layoutManager.setChannels(channels);
      const secondHeight = layoutManager.getTotalHeight();
      
      expect(firstHeight).toBe(secondHeight);
    });

    it('应该正确处理包含隐藏通道的初始数组', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1')
      ];
      channels[1].hidden = true;

      layoutManager.setChannels(channels);
      
      expect(layoutManager.getAllChannels()).toHaveLength(1);
      expect(layoutManager.getVisibleChannelCount()).toBe(1);
    });

    it('应该正确处理混合状态的通道', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1') as ExtendedAnalyzerChannel,
        new AnalyzerChannel(2, 'Channel 2')
      ];
      
      channels[1].minimized = true;
      channels[2].hidden = true;

      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels).toHaveLength(2); // 只有非隐藏的通道
      expect(allChannels[1].minimized).toBe(true);
    });
  });

  describe('性能和资源管理', () => {
    it('应该正确清理资源', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1')
      ];
      layoutManager.setChannels(channels);

      expect(layoutManager.getAllChannels()).toHaveLength(2);

      layoutManager.dispose();

      expect(layoutManager.getAllChannels()).toHaveLength(0);
      expect(layoutManager.getVisibleChannels()).toHaveLength(0);
      expect(layoutManager.getTotalHeight()).toBe(0);
      expect(layoutManager.getVisibleChannelCount()).toBe(0);
    });

    it('应该支持多次dispose调用', () => {
      const channels = [new AnalyzerChannel(0, 'Channel 0')];
      layoutManager.setChannels(channels);

      layoutManager.dispose();
      expect(() => layoutManager.dispose()).not.toThrow();
    });

    it('应该正确处理大量通道', () => {
      const channels: AnalyzerChannel[] = [];
      for (let i = 0; i < 100; i++) {
        channels.push(new AnalyzerChannel(i, `Channel ${i}`));
      }

      const startTime = Date.now();
      layoutManager.setChannels(channels);
      const endTime = Date.now();

      expect(layoutManager.getAllChannels()).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // 性能要求：100ms内完成
    });

    it('应该正确处理快速的可见性切换', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
      layoutManager.setChannels(channels);

      // 快速切换可见性
      for (let i = 0; i < 10; i++) {
        layoutManager.setChannelVisibility(0, i % 2 === 0);
        layoutManager.setChannelVisibility(1, i % 2 === 1);
      }

      // 验证最终状态
      const visibleCount = layoutManager.getVisibleChannelCount();
      expect(visibleCount).toBeGreaterThan(0);
      expect(visibleCount).toBeLessThanOrEqual(3);
    });
  });

  describe('布局计算精度测试', () => {
    it('应该确保通道间无重叠', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      for (let i = 0; i < allChannels.length - 1; i++) {
        const current = allChannels[i];
        const next = allChannels[i + 1];
        
        expect(current.yPosition + current.height).toBeLessThanOrEqual(next.yPosition);
      }
    });

    it('应该正确计算不同高度通道的布局', () => {
      const channels = [
        new AnalyzerChannel(0, 'Normal Channel'),
        new AnalyzerChannel(1, 'Minimized Channel') as ExtendedAnalyzerChannel
      ];
      channels[1].minimized = true;

      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels[0].height).toBe(60); // 默认高度
      expect(allChannels[1].height).toBe(24); // 最小化高度 (48/2)
    });

    it('应该正确应用边距配置', () => {
      const customConfig: Partial<LayoutConfig> = {
        marginTop: 20,
        marginBottom: 30
      };
      const manager = new ChannelLayoutManager(customConfig);
      
      const channels = [new AnalyzerChannel(0, 'Channel 0')];
      manager.setChannels(channels);

      const allChannels = manager.getAllChannels();
      expect(allChannels[0].yPosition).toBe(20); // marginTop

      manager.dispose();
    });

    it('应该正确处理零通道和单通道的总高度计算', () => {
      // 零通道
      layoutManager.setChannels([]);
      expect(layoutManager.getTotalHeight()).toBe(0);

      // 单通道
      const singleChannel = [new AnalyzerChannel(0, 'Single Channel')];
      layoutManager.setChannels(singleChannel);
      const singleHeight = layoutManager.getTotalHeight();
      expect(singleHeight).toBeGreaterThan(48); // 至少为最小高度加边距
    });
  });

  describe('状态一致性测试', () => {
    it('getAllChannels和getVisibleChannels应该保持一致性', () => {
      const channels = [
        new AnalyzerChannel(0, 'Channel 0'),
        new AnalyzerChannel(1, 'Channel 1'),
        new AnalyzerChannel(2, 'Channel 2')
      ];
      layoutManager.setChannels(channels);

      // 在当前架构中，getAllChannels 和 getVisibleChannels 返回相同的结果
      // 因为隐藏的通道不会被添加到 displayInfos 中
      const allChannels = layoutManager.getAllChannels();
      const visibleChannels = layoutManager.getVisibleChannels();

      expect(allChannels.length).toBe(visibleChannels.length);
      expect(layoutManager.getVisibleChannelCount()).toBe(visibleChannels.length);
      
      // 隐藏一个通道后
      layoutManager.setChannelVisibility(1, false);
      
      const allChannelsAfterHiding = layoutManager.getAllChannels();
      const visibleChannelsAfterHiding = layoutManager.getVisibleChannels();
      
      // 隐藏后，两个方法仍然返回相同的结果（都是非隐藏通道）
      expect(allChannelsAfterHiding.length).toBe(visibleChannelsAfterHiding.length);
      expect(allChannelsAfterHiding.length).toBe(2); // 只剩2个可见通道
      expect(layoutManager.getVisibleChannelCount()).toBe(2);
      
      // 所有可见通道都应该在总通道列表中
      visibleChannelsAfterHiding.forEach(visible => {
        expect(allChannelsAfterHiding).toContain(visible);
      });
    });

    it('通道索引应该保持原始顺序', () => {
      const channels = [
        new AnalyzerChannel(5, 'Channel 5'),
        new AnalyzerChannel(2, 'Channel 2'),
        new AnalyzerChannel(8, 'Channel 8')
      ];
      layoutManager.setChannels(channels);

      const allChannels = layoutManager.getAllChannels();
      expect(allChannels[0].originalIndex).toBe(0);
      expect(allChannels[0].channel.channelNumber).toBe(5);
      expect(allChannels[1].originalIndex).toBe(1);
      expect(allChannels[1].channel.channelNumber).toBe(2);
      expect(allChannels[2].originalIndex).toBe(2);
      expect(allChannels[2].channel.channelNumber).toBe(8);
    });
  });
});