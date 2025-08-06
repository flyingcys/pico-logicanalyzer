/**
 * NotificationCenter.vue 组件测试
 * 测试通知中心的所有功能
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import NotificationCenter from '../../../../src/webview/components/NotificationCenter.vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// Mock Element Plus 组件
jest.mock('element-plus', () => ({
  ElMessage: {
    error: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
    info: jest.fn()
  },
  ElMessageBox: {
    alert: jest.fn()
  },
  ElLoading: {
    name: 'ElLoading',
    props: ['text', 'spinner', 'background', 'elementLoadingText'],
    template: '<div class="loading">{{ text }}</div>'
  },
  ElProgress: {
    name: 'ElProgress',
    props: ['percentage', 'status', 'strokeWidth'],
    template: '<div class="progress">{{ percentage }}%</div>'
  },
  ElButton: {
    name: 'ElButton',
    props: ['type', 'size', 'icon'],
    template: '<button @click="$emit(\'click\')" :class="type"><slot /></button>',
    emits: ['click']
  },
  ElIcon: {
    name: 'ElIcon',
    template: '<i><slot /></i>'
  }
}));

// Mock Element Plus Icons
const mockIcons = {
  Close: { name: 'Close', template: '<span>Close</span>' },
  Warning: { name: 'Warning', template: '<span>Warning</span>' },
  QuestionFilled: { name: 'QuestionFilled', template: '<span>QuestionFilled</span>' },
  MemoryCard: { name: 'MemoryCard', template: '<span>MemoryCard</span>' },
  Connection: { name: 'Connection', template: '<span>Connection</span>' },
  Disconnect: { name: 'Disconnect', template: '<span>Disconnect</span>' },
  Loading: { name: 'Loading', template: '<span>Loading</span>' },
  SuccessFilled: { name: 'SuccessFilled', template: '<span>SuccessFilled</span>' },
  InfoFilled: { name: 'InfoFilled', template: '<span>InfoFilled</span>' },
  CircleCloseFilled: { name: 'CircleCloseFilled', template: '<span>CircleCloseFilled</span>' },
  Eleme: { name: 'Eleme', template: '<span>Eleme</span>' }
};

jest.mock('@element-plus/icons-vue', () => mockIcons);

// Mock DOM methods
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

// Mock getBoundingClientRect
const mockGetBoundingClientRect = jest.fn(() => ({
  left: 100,
  top: 100,
  right: 200,
  bottom: 150,
  width: 100,
  height: 50
}));

global.HTMLElement.prototype.getBoundingClientRect = mockGetBoundingClientRect;

describe('NotificationCenter.vue', () => {
  let wrapper: VueWrapper<any>;

  const createWrapper = (props = {}) => {
    return mount(NotificationCenter, {
      props: {
        showPerformanceIndicator: true,
        showMemoryUsage: true,
        autoHideTooltips: true,
        ...props
      },
      global: {
        stubs: {
          ElLoading: true,
          ElProgress: true,
          ElButton: true,
          ElIcon: true
        }
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock window event listeners
    jest.spyOn(window, 'addEventListener');
    jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('基础功能', () => {
    it('应该正确渲染组件', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.notification-center').exists()).toBe(true);
    });

    it('应该在挂载时注册全局事件监听器', () => {
      wrapper = createWrapper();
      expect(window.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('应该在卸载时移除事件监听器', () => {
      wrapper = createWrapper();
      wrapper.unmount();
      
      expect(window.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });

  describe('提示工具管理', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确显示提示工具', () => {
      const tooltip = {
        type: 'info' as const,
        title: '测试提示',
        description: '这是一个测试提示',
        icon: mockIcons.InfoFilled,
        position: { x: 100, y: 100 },
        duration: 3000
      };

      const id = wrapper.vm.showTooltip(tooltip);
      expect(id).toMatch(/^tooltip-\d+$/);
      expect(wrapper.vm.activeTooltips).toHaveLength(1);
      expect(wrapper.vm.activeTooltips[0]).toMatchObject({
        ...tooltip,
        id
      });
    });

    it('应该自动隐藏带有持续时间的提示', async () => {
      const tooltip = {
        type: 'info' as const,
        title: '测试提示',
        icon: mockIcons.InfoFilled,
        position: { x: 100, y: 100 },
        duration: 1000
      };

      wrapper.vm.showTooltip(tooltip);
      expect(wrapper.vm.activeTooltips).toHaveLength(1);

      jest.advanceTimersByTime(1000);
      await nextTick();

      expect(wrapper.vm.activeTooltips).toHaveLength(0);
    });

    it('应该正确关闭提示工具', () => {
      const tooltip = {
        type: 'info' as const,
        title: '测试提示',
        icon: mockIcons.InfoFilled,
        position: { x: 100, y: 100 },
        duration: -1
      };

      const id = wrapper.vm.showTooltip(tooltip);
      expect(wrapper.vm.activeTooltips).toHaveLength(1);

      wrapper.vm.dismissTooltip(id);
      expect(wrapper.vm.activeTooltips).toHaveLength(0);
    });

    it('应该处理不存在的提示ID', () => {
      wrapper.vm.dismissTooltip('non-existent-id');
      expect(wrapper.vm.activeTooltips).toHaveLength(0);
    });

    it('应该正确计算提示样式', () => {
      const tooltip = {
        id: 'test-1',
        type: 'info' as const,
        title: '测试',
        icon: mockIcons.InfoFilled,
        position: { x: 150, y: 200 },
        duration: 3000
      };

      const style = wrapper.vm.getTooltipStyle(tooltip);
      expect(style).toEqual({
        left: '150px',
        top: '200px'
      });
    });

    it('应该在禁用自动隐藏时不自动消失', async () => {
      wrapper = createWrapper({ autoHideTooltips: false });
      
      const tooltip = {
        type: 'info' as const,
        title: '测试提示',
        icon: mockIcons.InfoFilled,
        position: { x: 100, y: 100 },
        duration: 1000
      };

      wrapper.vm.showTooltip(tooltip);
      expect(wrapper.vm.activeTooltips).toHaveLength(1);

      jest.advanceTimersByTime(1000);
      await nextTick();

      expect(wrapper.vm.activeTooltips).toHaveLength(1);
    });
  });

  describe('提示操作', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确执行提示操作', () => {
      const actionMock = jest.fn();
      const tooltip = {
        type: 'info' as const,
        title: '测试提示',
        icon: mockIcons.InfoFilled,
        position: { x: 100, y: 100 },
        duration: -1,
        actions: [{
          id: 'action-1',
          label: '确定',
          type: 'primary' as const,
          action: actionMock
        }]
      };

      const id = wrapper.vm.showTooltip(tooltip);
      wrapper.vm.executeTooltipAction(id, tooltip.actions[0]);

      expect(actionMock).toHaveBeenCalled();
      expect(wrapper.vm.activeTooltips).toHaveLength(0);
    });

    it('应该处理操作执行错误', () => {
      const errorAction = jest.fn(() => {
        throw new Error('Action failed');
      });
      
      const tooltip = {
        type: 'info' as const,
        title: '测试提示',
        icon: mockIcons.InfoFilled,
        position: { x: 100, y: 100 },
        duration: -1,
        actions: [{
          id: 'error-action',
          label: '错误操作',
          type: 'danger' as const,
          action: errorAction
        }]
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const id = wrapper.vm.showTooltip(tooltip);
      
      wrapper.vm.executeTooltipAction(id, tooltip.actions[0]);

      expect(errorAction).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('执行提示操作失败:', expect.any(Error));
      expect(ElMessage.error).toHaveBeenCalledWith('操作失败');
      
      consoleSpy.mockRestore();
    });
  });

  describe('全局加载', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确显示全局加载', () => {
      wrapper.vm.showGlobalLoading('加载中', '正在处理数据...', true);

      expect(wrapper.vm.globalLoading).toMatchObject({
        show: true,
        text: '加载中',
        detail: '正在处理数据...',
        progress: -1,
        status: undefined,
        cancellable: true
      });
    });

    it('应该正确更新全局加载进度', () => {
      wrapper.vm.showGlobalLoading('加载中');
      wrapper.vm.updateGlobalLoadingProgress(50, '50%完成', 'warning');

      expect(wrapper.vm.globalLoading.progress).toBe(50);
      expect(wrapper.vm.globalLoading.detail).toBe('50%完成');
      expect(wrapper.vm.globalLoading.status).toBe('warning');
    });

    it('应该支持可选参数更新', () => {
      wrapper.vm.showGlobalLoading('加载中', '初始详情');
      wrapper.vm.updateGlobalLoadingProgress(75);

      expect(wrapper.vm.globalLoading.progress).toBe(75);
      expect(wrapper.vm.globalLoading.detail).toBe('初始详情');
      expect(wrapper.vm.globalLoading.status).toBeUndefined();
    });

    it('应该正确隐藏全局加载', () => {
      wrapper.vm.showGlobalLoading('加载中');
      expect(wrapper.vm.globalLoading.show).toBe(true);

      wrapper.vm.hideGlobalLoading();
      expect(wrapper.vm.globalLoading.show).toBe(false);
    });

    it('应该正确处理取消操作', () => {
      wrapper.vm.showGlobalLoading('加载中', '', true);
      expect(wrapper.vm.globalLoading.show).toBe(true);

      wrapper.vm.cancelGlobalOperation();

      expect(wrapper.emitted('global-operation-cancelled')).toBeTruthy();
      expect(wrapper.vm.globalLoading.show).toBe(false);
    });
  });

  describe('连接状态', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确更新连接状态', () => {
      wrapper.vm.updateConnectionStatus('connected', 'Test Device');

      expect(wrapper.vm.connectionStatus).toMatchObject({
        status: 'connected',
        text: 'Test Device',
        progress: -1
      });
    });

    it('应该使用默认文本', () => {
      wrapper.vm.updateConnectionStatus('connected');
      expect(wrapper.vm.connectionStatus.text).toBe('已连接');
    });

    it('应该正确设置图标', () => {
      wrapper.vm.updateConnectionStatus('connecting');
      expect(wrapper.vm.connectionStatus.icon).toBe(mockIcons.Loading);

      wrapper.vm.updateConnectionStatus('error');
      expect(wrapper.vm.connectionStatus.icon).toBe(mockIcons.CircleCloseFilled);
    });

    it('应该处理进度参数', () => {
      wrapper.vm.updateConnectionStatus('connecting', undefined, 50);
      expect(wrapper.vm.connectionStatus.progress).toBe(50);
    });

    it('应该发出连接详情请求事件', () => {
      wrapper.vm.showConnectionDetails();
      expect(wrapper.emitted('connection-details-requested')).toBeTruthy();
    });
  });

  describe('性能警告', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确更新性能警告', () => {
      wrapper.vm.updatePerformanceWarning('high', 'CPU usage too high');

      expect(wrapper.vm.performanceWarning).toMatchObject({
        show: true,
        level: 'high',
        details: 'CPU usage too high'
      });
    });

    it('应该在低性能级别时隐藏警告', () => {
      wrapper.vm.updatePerformanceWarning('low', '');
      expect(wrapper.vm.performanceWarning.show).toBe(false);
    });

    it('应该在严重级别时显示消息', () => {
      wrapper.vm.updatePerformanceWarning('critical', 'System overloaded');
      expect(ElMessage.warning).toHaveBeenCalledWith('系统性能严重不足，建议减少数据处理量');
    });

    it('应该显示性能详情', () => {
      wrapper.vm.performanceWarning.details = '测试性能详情';
      wrapper.vm.showPerformanceDetails();

      expect(wrapper.emitted('performance-warning-clicked')).toBeTruthy();
      expect(ElMessageBox.alert).toHaveBeenCalledWith(
        '测试性能详情',
        '性能警告',
        { type: 'warning' }
      );
    });
  });

  describe('内存使用', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确更新内存使用', () => {
      wrapper.vm.updateMemoryUsage(400 * 1024 * 1024, 500 * 1024 * 1024);

      expect(wrapper.vm.memoryUsage).toMatchObject({
        used: 400 * 1024 * 1024,
        total: 500 * 1024 * 1024,
        isHigh: true // 400/500 = 0.8
      });
    });

    it('应该在内存使用率过高时设置性能警告', () => {
      wrapper.vm.updateMemoryUsage(450 * 1024 * 1024, 500 * 1024 * 1024);

      expect(wrapper.vm.memoryUsage.isHigh).toBe(true);
      expect(wrapper.vm.performanceWarning.show).toBe(true);
      expect(wrapper.vm.performanceWarning.details).toBe('内存使用率过高');
    });

    it('应该在内存使用率正常时不设置高使用标志', () => {
      wrapper.vm.updateMemoryUsage(300 * 1024 * 1024, 500 * 1024 * 1024);
      expect(wrapper.vm.memoryUsage.isHigh).toBe(false);
    });

    it('应该显示内存详情', () => {
      wrapper.vm.memoryUsage.used = 100 * 1024 * 1024;
      wrapper.vm.memoryUsage.total = 200 * 1024 * 1024;
      
      wrapper.vm.showMemoryDetails();

      expect(wrapper.emitted('memory-details-requested')).toBeTruthy();
      expect(ElMessageBox.alert).toHaveBeenCalledWith(
        '内存使用: 100.0MB / 200.0MB',
        '内存使用情况',
        { type: 'info' }
      );
    });
  });

  describe('帮助气泡', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确显示帮助气泡', () => {
      const target = document.createElement('div');
      const actions = [{
        id: 'help-1',
        label: '了解更多',
        type: 'primary',
        action: jest.fn()
      }];

      wrapper.vm.showHelpBubble('帮助标题', '帮助内容', target, 'top', actions);

      expect(wrapper.vm.helpBubble).toMatchObject({
        show: true,
        title: '帮助标题',
        text: '帮助内容',
        target,
        position: 'top',
        actions
      });
    });

    it('应该正确隐藏帮助气泡', () => {
      const target = document.createElement('div');
      wrapper.vm.showHelpBubble('测试', '测试内容', target);
      expect(wrapper.vm.helpBubble.show).toBe(true);

      wrapper.vm.hideHelpBubble();
      expect(wrapper.vm.helpBubble.show).toBe(false);
    });

    it('应该计算不同位置的样式', () => {
      const target = document.createElement('div');
      target.getBoundingClientRect = mockGetBoundingClientRect;

      wrapper.vm.helpBubble.target = target;

      // 测试 top 位置
      wrapper.vm.helpBubble.position = 'top';
      let style = wrapper.vm.getHelpBubbleStyle();
      expect(style).toEqual({
        left: '150px', // left + width/2 = 100 + 50
        top: '90px',   // top - offset = 100 - 10
        transform: 'translateX(-50%) translateY(-100%)'
      });

      // 测试 bottom 位置
      wrapper.vm.helpBubble.position = 'bottom';
      style = wrapper.vm.getHelpBubbleStyle();
      expect(style).toEqual({
        left: '150px',
        top: '160px', // bottom + offset = 150 + 10
        transform: 'translateX(-50%)'
      });

      // 测试 left 位置
      wrapper.vm.helpBubble.position = 'left';
      style = wrapper.vm.getHelpBubbleStyle();
      expect(style).toEqual({
        left: '90px',  // left - offset = 100 - 10
        top: '125px',  // top + height/2 = 100 + 25
        transform: 'translateX(-100%) translateY(-50%)'
      });

      // 测试 right 位置
      wrapper.vm.helpBubble.position = 'right';
      style = wrapper.vm.getHelpBubbleStyle();
      expect(style).toEqual({
        left: '210px', // right + offset = 200 + 10
        top: '125px',
        transform: 'translateY(-50%)'
      });
    });

    it('应该处理无目标元素的情况', () => {
      wrapper.vm.helpBubble.target = null;
      const style = wrapper.vm.getHelpBubbleStyle();
      expect(style).toEqual({});
    });

    it('应该正确执行帮助操作', () => {
      const actionMock = jest.fn();
      const action = {
        id: 'help-action',
        label: '测试',
        type: 'primary',
        action: actionMock
      };

      const target = document.createElement('div');
      wrapper.vm.showHelpBubble('测试', '测试内容', target);
      
      wrapper.vm.executeHelpAction(action);

      expect(actionMock).toHaveBeenCalled();
      expect(wrapper.vm.helpBubble.show).toBe(false);
    });

    it('应该处理帮助操作错误', () => {
      const errorAction = {
        id: 'error-action',
        label: '错误操作',
        type: 'primary',
        action: () => { throw new Error('Help action failed'); }
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      wrapper.vm.executeHelpAction(errorAction);

      expect(consoleSpy).toHaveBeenCalledWith('执行帮助操作失败:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('格式化函数', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确格式化字节大小', () => {
      expect(wrapper.vm.formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0GB');
      expect(wrapper.vm.formatBytes(1024 * 1024 * 50)).toBe('50.0MB');
      expect(wrapper.vm.formatBytes(1024 * 10)).toBe('10.0KB');
      expect(wrapper.vm.formatBytes(512)).toBe('512B');
    });
  });

  describe('全局错误处理', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该处理全局错误事件', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error message',
        filename: 'test.js',
        lineno: 1
      });

      wrapper.vm.handleGlobalError(errorEvent);

      expect(wrapper.vm.activeTooltips).toHaveLength(1);
      expect(wrapper.vm.activeTooltips[0]).toMatchObject({
        type: 'error',
        title: '发生错误',
        description: 'Test error message'
      });
    });

    it('应该处理未处理的Promise拒绝', () => {
      const rejectionEvent = {
        reason: { message: 'Promise rejection message' }
      };

      wrapper.vm.handleUnhandledRejection(rejectionEvent);

      expect(wrapper.vm.activeTooltips).toHaveLength(1);
      expect(wrapper.vm.activeTooltips[0]).toMatchObject({
        type: 'error',
        title: 'Promise 错误',
        description: 'Promise rejection message'
      });
    });

    it('应该处理没有消息的Promise拒绝', () => {
      const rejectionEvent = { reason: null };

      wrapper.vm.handleUnhandledRejection(rejectionEvent);

      expect(wrapper.vm.activeTooltips).toHaveLength(1);
      expect(wrapper.vm.activeTooltips[0].description).toBe('未处理的Promise拒绝');
    });
  });

  describe('性能监控', () => {
    it('应该在启用性能指示器时启动监控', () => {
      wrapper = createWrapper({ showPerformanceIndicator: true });
      
      // 推进定时器
      jest.advanceTimersByTime(5000);
      
      // 验证内存和性能数据有更新
      expect(wrapper.vm.memoryUsage.used).toBeGreaterThan(0);
    });

    it('应该在禁用性能指示器时不启动监控', () => {
      wrapper = createWrapper({ showPerformanceIndicator: false });
      
      jest.advanceTimersByTime(5000);
      
      // 内存使用应该保持初始值
      expect(wrapper.vm.memoryUsage.used).toBe(0);
    });
  });

  describe('暴露的方法', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该暴露所有必要的方法', () => {
      const exposedMethods = [
        'showTooltip',
        'dismissTooltip',
        'showGlobalLoading',
        'updateGlobalLoadingProgress',
        'hideGlobalLoading',
        'updateConnectionStatus',
        'updatePerformanceWarning',
        'updateMemoryUsage',
        'showHelpBubble',
        'hideHelpBubble'
      ];

      exposedMethods.forEach(method => {
        expect(typeof wrapper.vm[method]).toBe('function');
      });
    });
  });

  describe('边界情况', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该处理空的提示工具数组', () => {
      expect(wrapper.vm.activeTooltips).toHaveLength(0);
      wrapper.vm.dismissTooltip('any-id');
      expect(wrapper.vm.activeTooltips).toHaveLength(0);
    });

    it('应该处理无效的帮助气泡位置', () => {
      const target = document.createElement('div');
      wrapper.vm.helpBubble.target = target;
      wrapper.vm.helpBubble.position = 'invalid' as any;
      
      const style = wrapper.vm.getHelpBubbleStyle();
      expect(style).toEqual({});
    });

    it('应该处理内存使用的边界值', () => {
      wrapper.vm.updateMemoryUsage(0, 100);
      expect(wrapper.vm.memoryUsage.isHigh).toBe(false);

      wrapper.vm.updateMemoryUsage(80, 100);
      expect(wrapper.vm.memoryUsage.isHigh).toBe(false);

      wrapper.vm.updateMemoryUsage(81, 100);
      expect(wrapper.vm.memoryUsage.isHigh).toBe(true);
    });

    it('应该处理格式化零字节', () => {
      expect(wrapper.vm.formatBytes(0)).toBe('0B');
    });
  });
});