/**
 * StatusBar.vue 组件测试
 * 测试状态栏的所有功能
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import StatusBar from '../../../../src/webview/components/StatusBar.vue';

// Mock Element Plus 组件
jest.mock('element-plus', () => ({
  ElProgress: {
    name: 'ElProgress',
    props: ['percentage', 'showText', 'strokeWidth', 'status'],
    template: '<div class="progress">{{ percentage }}%</div>'
  },
  ElButton: {
    name: 'ElButton',
    props: ['type', 'size', 'disabled', 'icon'],
    template: '<button @click="$emit(\'click\')" :disabled="disabled"><slot /></button>',
    emits: ['click']
  },
  ElButtonGroup: {
    name: 'ElButtonGroup',
    props: ['size'],
    template: '<div><slot /></div>'
  },
  ElTag: {
    name: 'ElTag',
    props: ['type', 'size'],
    template: '<span class="tag"><slot /></span>'
  },
  ElTooltip: {
    name: 'ElTooltip',
    props: ['content', 'placement'],
    template: '<div><slot /></div>'
  },
  ElIcon: {
    name: 'ElIcon',
    template: '<i><slot /></i>'
  }
}));

// Mock Element Plus Icons
jest.mock('@element-plus/icons-vue', () => ({
  Connection: { name: 'Connection', template: '<span>Connection</span>' },
  Disconnect: { name: 'Disconnect', template: '<span>Disconnect</span>' },
  DataLine: { name: 'DataLine', template: '<span>DataLine</span>' },
  Grid: { name: 'Grid', template: '<span>Grid</span>' },
  Cpu: { name: 'Cpu', template: '<span>Cpu</span>' },
  Monitor: { name: 'Monitor', template: '<span>Monitor</span>' },
  MemoryCard: { name: 'MemoryCard', template: '<span>MemoryCard</span>' },
  Clock: { name: 'Clock', template: '<span>Clock</span>' },
  Document: { name: 'Document', template: '<span>Document</span>' },
  ZoomIn: { name: 'ZoomIn', template: '<span>ZoomIn</span>' },
  ZoomOut: { name: 'ZoomOut', template: '<span>ZoomOut</span>' },
  Close: { name: 'Close', template: '<span>Close</span>' },
  SuccessFilled: { name: 'SuccessFilled', template: '<span>SuccessFilled</span>' },
  WarningFilled: { name: 'WarningFilled', template: '<span>WarningFilled</span>' },
  CircleCloseFilled: { name: 'CircleCloseFilled', template: '<span>CircleCloseFilled</span>' },
  InfoFilled: { name: 'InfoFilled', template: '<span>InfoFilled</span>' }
}));

describe('StatusBar.vue', () => {
  let wrapper: VueWrapper<any>;

  const createWrapper = (props = {}) => {
    return mount(StatusBar, {
      props: {
        deviceConnected: false,
        deviceName: '',
        captureState: null,
        sampleData: null,
        channels: [],
        decoders: [],
        fileName: '',
        fileModified: false,
        showPerformance: false,
        showZoom: false,
        ...props
      },
      global: {
        stubs: {
          ElProgress: true,
          ElButton: true,
          ElButtonGroup: true,
          ElTag: true,
          ElTooltip: true,
          ElIcon: true
        }
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    jest.useRealTimers();
  });

  describe('基础功能', () => {
    it('应该正确渲染组件', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.status-bar').exists()).toBe(true);
    });

    it('should initialize time on mount', async () => {
      wrapper = createWrapper();
      expect(wrapper.vm.currentTime).toBeDefined();
    });

    it('应该正确更新时间', async () => {
      wrapper = createWrapper();
      const initialTime = wrapper.vm.currentTime;
      
      jest.advanceTimersByTime(1000);
      await nextTick();
      
      expect(wrapper.vm.currentTime).toBeDefined();
    });
  });

  describe('设备状态', () => {
    it('应该显示设备未连接状态', () => {
      wrapper = createWrapper({
        deviceConnected: false
      });
      
      expect(wrapper.vm.deviceStatusText).toBe('设备未连接');
    });

    it('应该显示设备已连接状态', () => {
      wrapper = createWrapper({
        deviceConnected: true,
        deviceName: 'Test Device'
      });
      
      expect(wrapper.vm.deviceStatusText).toBe('Test Device');
    });

    it('应该在无设备名时显示默认连接文本', () => {
      wrapper = createWrapper({
        deviceConnected: true,
        deviceName: ''
      });
      
      expect(wrapper.vm.deviceStatusText).toBe('设备已连接');
    });
  });

  describe('采集状态', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确更新采集状态', async () => {
      wrapper.vm.updateCaptureStatus('preparing');
      await nextTick();
      
      expect(wrapper.vm.captureInfo.status).toBe('preparing');
      expect(wrapper.vm.captureInfo.statusText).toBe('准备中');
      expect(wrapper.vm.captureInfo.isActive).toBe(true);
    });

    it('应该在采集状态下显示进度', async () => {
      wrapper.vm.updateCaptureStatus('capturing', 50);
      await nextTick();
      
      expect(wrapper.vm.captureInfo.showProgress).toBe(true);
      expect(wrapper.vm.captureInfo.progress).toBe(50);
    });

    it('应该在处理状态下显示进度', async () => {
      wrapper.vm.updateCaptureStatus('processing', 75);
      await nextTick();
      
      expect(wrapper.vm.captureInfo.showProgress).toBe(true);
      expect(wrapper.vm.captureInfo.progress).toBe(75);
    });

    it('应该在空闲状态下隐藏活动状态', async () => {
      wrapper.vm.updateCaptureStatus('idle');
      await nextTick();
      
      expect(wrapper.vm.captureInfo.isActive).toBe(false);
      expect(wrapper.vm.captureInfo.showProgress).toBe(false);
    });

    it('应该在完成状态下隐藏活动状态', async () => {
      wrapper.vm.updateCaptureStatus('completed');
      await nextTick();
      
      expect(wrapper.vm.captureInfo.isActive).toBe(false);
      expect(wrapper.vm.captureInfo.showProgress).toBe(false);
    });
  });

  describe('样本信息', () => {
    it('应该正确更新样本信息', async () => {
      const sampleData = {
        totalSamples: 1000000,
        sampleRate: 100000000,
        duration: 0.01
      };
      
      wrapper = createWrapper({ sampleData });
      await nextTick();
      
      expect(wrapper.vm.sampleInfo.totalSamples).toBe(1000000);
      expect(wrapper.vm.sampleInfo.sampleRate).toBe(100000000);
      expect(wrapper.vm.sampleInfo.duration).toBe(0.01);
    });

    it('应该在没有样本数据时显示零值', () => {
      wrapper = createWrapper();
      
      expect(wrapper.vm.sampleInfo.totalSamples).toBe(0);
      expect(wrapper.vm.sampleInfo.sampleRate).toBe(0);
      expect(wrapper.vm.sampleInfo.duration).toBe(0);
    });
  });

  describe('通道信息', () => {
    it('应该正确计算通道信息', async () => {
      const channels = [
        { id: 1, hidden: false, hasData: true },
        { id: 2, hidden: false, hasData: false },
        { id: 3, hidden: true, hasData: true },
        { id: 4, hidden: false, hasData: true }
      ];
      
      wrapper = createWrapper({ channels });
      await nextTick();
      
      expect(wrapper.vm.channelInfo.total).toBe(4);
      expect(wrapper.vm.channelInfo.active).toBe(3); // 不包括hidden
      expect(wrapper.vm.channelInfo.withData).toBe(3); // 有数据的通道
    });

    it('应该在通道数组变化时更新信息', async () => {
      wrapper = createWrapper({ channels: [] });
      expect(wrapper.vm.channelInfo.total).toBe(0);
      
      await wrapper.setProps({
        channels: [{ id: 1, hidden: false, hasData: true }]
      });
      
      expect(wrapper.vm.channelInfo.total).toBe(1);
      expect(wrapper.vm.channelInfo.active).toBe(1);
      expect(wrapper.vm.channelInfo.withData).toBe(1);
    });
  });

  describe('解码器信息', () => {
    it('应该正确计算解码器信息', async () => {
      const decoders = [
        { id: 1, active: true, resultCount: 5 },
        { id: 2, active: false, resultCount: 3 },
        { id: 3, active: true, resultCount: 7 },
        { id: 4, active: true, resultCount: 0 }
      ];
      
      wrapper = createWrapper({ decoders });
      await nextTick();
      
      expect(wrapper.vm.decoderInfo.active).toBe(3); // 3个激活的解码器
      expect(wrapper.vm.decoderInfo.results).toBe(15); // 5+3+7+0=15
    });

    it('应该处理没有resultCount的解码器', async () => {
      const decoders = [
        { id: 1, active: true },
        { id: 2, active: true, resultCount: 5 }
      ];
      
      wrapper = createWrapper({ decoders });
      await nextTick();
      
      expect(wrapper.vm.decoderInfo.active).toBe(2);
      expect(wrapper.vm.decoderInfo.results).toBe(5); // 0+5=5
    });
  });

  describe('全局进度', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确显示全局进度', () => {
      wrapper.vm.showGlobalProgress('测试操作', '正在进行中...', true);
      
      expect(wrapper.vm.globalProgress.show).toBe(true);
      expect(wrapper.vm.globalProgress.title).toBe('测试操作');
      expect(wrapper.vm.globalProgress.detail).toBe('正在进行中...');
      expect(wrapper.vm.globalProgress.cancellable).toBe(true);
    });

    it('应该正确更新全局进度', () => {
      wrapper.vm.showGlobalProgress('测试操作');
      wrapper.vm.updateGlobalProgress(50, '50%完成', 'warning');
      
      expect(wrapper.vm.globalProgress.percentage).toBe(50);
      expect(wrapper.vm.globalProgress.detail).toBe('50%完成');
      expect(wrapper.vm.globalProgress.status).toBe('warning');
    });

    it('应该正确隐藏全局进度', () => {
      wrapper.vm.showGlobalProgress('测试操作');
      expect(wrapper.vm.globalProgress.show).toBe(true);
      
      wrapper.vm.hideGlobalProgress();
      expect(wrapper.vm.globalProgress.show).toBe(false);
    });

    it('应该支持可选参数', () => {
      wrapper.vm.showGlobalProgress('测试操作');
      wrapper.vm.updateGlobalProgress(75);
      
      expect(wrapper.vm.globalProgress.percentage).toBe(75);
      expect(wrapper.vm.globalProgress.detail).toBe(''); // 保持原值
    });
  });

  describe('通知系统', () => {
    beforeEach(() => {
      wrapper = createWrapper();
      jest.clearAllTimers();
    });

    it('应该正确显示成功通知', () => {
      wrapper.vm.showNotification('success', '操作成功');
      
      expect(wrapper.vm.notification.show).toBe(true);
      expect(wrapper.vm.notification.type).toBe('success');
      expect(wrapper.vm.notification.message).toBe('操作成功');
    });

    it('应该正确显示不同类型的通知', () => {
      const types = ['success', 'warning', 'error', 'info'] as const;
      
      types.forEach(type => {
        wrapper.vm.showNotification(type, `${type} 消息`);
        expect(wrapper.vm.notification.type).toBe(type);
        expect(wrapper.vm.notification.message).toBe(`${type} 消息`);
      });
    });

    it('应该自动消失通知', async () => {
      wrapper.vm.showNotification('info', '测试消息');
      expect(wrapper.vm.notification.show).toBe(true);
      
      jest.advanceTimersByTime(5000);
      await nextTick();
      
      expect(wrapper.vm.notification.show).toBe(false);
    });

    it('应该支持手动关闭通知', () => {
      wrapper.vm.showNotification('info', '测试消息');
      expect(wrapper.vm.notification.show).toBe(true);
      
      wrapper.vm.dismissNotification();
      expect(wrapper.vm.notification.show).toBe(false);
    });

    it('应该发出通知关闭事件', () => {
      wrapper.vm.dismissNotification();
      expect(wrapper.emitted('notification-dismissed')).toBeTruthy();
    });
  });

  describe('缩放控制', () => {
    beforeEach(() => {
      wrapper = createWrapper({ showZoom: true });
    });

    it('应该正确更新缩放信息', () => {
      wrapper.vm.updateZoomInfo(150, true, false);
      
      expect(wrapper.vm.zoomInfo.level).toBe(150);
      expect(wrapper.vm.zoomInfo.canZoomIn).toBe(true);
      expect(wrapper.vm.zoomInfo.canZoomOut).toBe(false);
    });

    it('应该发出放大事件', () => {
      wrapper.vm.zoomIn();
      expect(wrapper.emitted('zoom-in')).toBeTruthy();
    });

    it('应该发出缩小事件', () => {
      wrapper.vm.zoomOut();
      expect(wrapper.emitted('zoom-out')).toBeTruthy();
    });

    it('应该根据showZoom属性显示缩放控制', () => {
      expect(wrapper.vm.zoomInfo.show).toBe(true);
      
      wrapper = createWrapper({ showZoom: false });
      wrapper.vm.updateZoomInfo(100, true, true);
      expect(wrapper.vm.zoomInfo.show).toBe(false);
    });
  });

  describe('性能监控', () => {
    beforeEach(() => {
      wrapper = createWrapper({ showPerformance: true });
    });

    it('应该在启用时更新性能信息', () => {
      wrapper.vm.updatePerformanceInfo();
      
      expect(wrapper.vm.performanceInfo.cpu).toBeGreaterThanOrEqual(5);
      expect(wrapper.vm.performanceInfo.cpu).toBeLessThanOrEqual(25);
      expect(wrapper.vm.performanceInfo.memory).toBeGreaterThan(0);
    });

    it('应该在禁用时不更新性能信息', () => {
      wrapper = createWrapper({ showPerformance: false });
      const initialCpu = wrapper.vm.performanceInfo.cpu;
      const initialMemory = wrapper.vm.performanceInfo.memory;
      
      wrapper.vm.updatePerformanceInfo();
      
      expect(wrapper.vm.performanceInfo.cpu).toBe(initialCpu);
      expect(wrapper.vm.performanceInfo.memory).toBe(initialMemory);
    });
  });

  describe('文件状态', () => {
    it('应该正确显示文件信息', () => {
      wrapper = createWrapper({
        fileName: 'test.lac',
        fileModified: true
      });
      
      expect(wrapper.vm.fileInfo.name).toBe('test.lac');
      expect(wrapper.vm.fileInfo.modified).toBe(true);
    });

    it('应该响应文件名变化', async () => {
      wrapper = createWrapper({ fileName: 'old.lac' });
      expect(wrapper.vm.fileInfo.name).toBe('old.lac');
      
      await wrapper.setProps({ fileName: 'new.lac' });
      expect(wrapper.vm.fileInfo.name).toBe('new.lac');
    });

    it('应该响应修改状态变化', async () => {
      wrapper = createWrapper({ fileModified: false });
      expect(wrapper.vm.fileInfo.modified).toBe(false);
      
      await wrapper.setProps({ fileModified: true });
      expect(wrapper.vm.fileInfo.modified).toBe(true);
    });
  });

  describe('操作事件', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该发出取消操作事件', () => {
      wrapper.vm.cancelOperation();
      expect(wrapper.emitted('cancel-operation')).toBeTruthy();
    });
  });

  describe('格式化函数', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该正确格式化数字', () => {
      expect(wrapper.vm.formatNumber(1234567890)).toBe('1.2G');
      expect(wrapper.vm.formatNumber(1234567)).toBe('1.2M');
      expect(wrapper.vm.formatNumber(1234)).toBe('1.2K');
      expect(wrapper.vm.formatNumber(123)).toBe('123');
    });

    it('应该正确格式化频率', () => {
      expect(wrapper.vm.formatFrequency(1000000000)).toBe('1.0GHz');
      expect(wrapper.vm.formatFrequency(100000000)).toBe('100.0MHz');
      expect(wrapper.vm.formatFrequency(1000000)).toBe('1.0MHz');
      expect(wrapper.vm.formatFrequency(1000)).toBe('1.0KHz');
      expect(wrapper.vm.formatFrequency(100)).toBe('100Hz');
    });

    it('应该正确格式化时间', () => {
      expect(wrapper.vm.formatTime(1.5)).toBe('1.500s');
      expect(wrapper.vm.formatTime(0.001)).toBe('1.000ms');
      expect(wrapper.vm.formatTime(0.000001)).toBe('1.000µs');
      expect(wrapper.vm.formatTime(0.000000001)).toBe('1.000ns');
    });

    it('应该正确格式化字节大小', () => {
      expect(wrapper.vm.formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0GB');
      expect(wrapper.vm.formatBytes(1024 * 1024 * 50)).toBe('50.0MB');
      expect(wrapper.vm.formatBytes(1024 * 10)).toBe('10.0KB');
      expect(wrapper.vm.formatBytes(512)).toBe('512B');
    });
  });

  describe('生命周期', () => {
    it('应该在挂载时设置定时器', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.timeInterval).toBeTruthy();
    });

    it('应该在卸载时清理定时器', () => {
      wrapper = createWrapper();
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      wrapper.unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('应该在挂载时初始化所有信息', async () => {
      const channels = [{ id: 1, hidden: false, hasData: true }];
      const decoders = [{ id: 1, active: true, resultCount: 5 }];
      const sampleData = { totalSamples: 1000, sampleRate: 100000, duration: 0.01 };
      
      wrapper = createWrapper({ channels, decoders, sampleData });
      await nextTick();
      
      expect(wrapper.vm.channelInfo.total).toBe(1);
      expect(wrapper.vm.decoderInfo.active).toBe(1);
      expect(wrapper.vm.sampleInfo.totalSamples).toBe(1000);
    });
  });

  describe('暴露的方法', () => {
    beforeEach(() => {
      wrapper = createWrapper();
    });

    it('应该暴露所有必要的方法', () => {
      const exposedMethods = [
        'showNotification',
        'showGlobalProgress',
        'updateGlobalProgress',
        'hideGlobalProgress',
        'updateCaptureStatus',
        'updateZoomInfo'
      ];
      
      exposedMethods.forEach(method => {
        expect(typeof wrapper.vm[method]).toBe('function');
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理空的通道数组', () => {
      wrapper = createWrapper({ channels: [] });
      expect(wrapper.vm.channelInfo.total).toBe(0);
      expect(wrapper.vm.channelInfo.active).toBe(0);
      expect(wrapper.vm.channelInfo.withData).toBe(0);
    });

    it('应该处理空的解码器数组', () => {
      wrapper = createWrapper({ decoders: [] });
      expect(wrapper.vm.decoderInfo.active).toBe(0);
      expect(wrapper.vm.decoderInfo.results).toBe(0);
    });

    it('应该处理null样本数据', () => {
      wrapper = createWrapper({ sampleData: null });
      expect(wrapper.vm.sampleInfo.totalSamples).toBe(0);
      expect(wrapper.vm.sampleInfo.sampleRate).toBe(0);
      expect(wrapper.vm.sampleInfo.duration).toBe(0);
    });

    it('应该处理没有timeInterval的卸载', () => {
      wrapper = createWrapper();
      wrapper.vm.timeInterval = null;
      
      expect(() => wrapper.unmount()).not.toThrow();
    });

    it('应该处理格式化函数的边界值', () => {
      expect(wrapper.vm.formatNumber(0)).toBe('0');
      expect(wrapper.vm.formatFrequency(0)).toBe('0Hz');
      expect(wrapper.vm.formatTime(0)).toBe('0.000ns');
      expect(wrapper.vm.formatBytes(0)).toBe('0B');
    });
  });

  describe('响应式属性', () => {
    it('应该正确监听props变化', async () => {
      wrapper = createWrapper({
        channels: [],
        decoders: [],
        sampleData: null
      });
      
      expect(wrapper.vm.channelInfo.total).toBe(0);
      expect(wrapper.vm.decoderInfo.active).toBe(0);
      expect(wrapper.vm.sampleInfo.totalSamples).toBe(0);
      
      await wrapper.setProps({
        channels: [{ id: 1, hidden: false, hasData: true }],
        decoders: [{ id: 1, active: true, resultCount: 5 }],
        sampleData: { totalSamples: 1000, sampleRate: 100000, duration: 0.01 }
      });
      
      expect(wrapper.vm.channelInfo.total).toBe(1);
      expect(wrapper.vm.decoderInfo.active).toBe(1);
      expect(wrapper.vm.sampleInfo.totalSamples).toBe(1000);
    });
  });
});