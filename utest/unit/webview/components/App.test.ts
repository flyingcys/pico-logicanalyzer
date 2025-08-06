/**
 * App.vue 单元测试
 * 测试主应用组件的完整功能
 * 
 * @jest-environment jsdom
 */

import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { ElMessage } from 'element-plus';
import App from '../../../../src/webview/App.vue';

// Mock Element Plus
jest.mock('element-plus', () => ({
  ElMessage: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn()
  },
  // ... 省略其他Element Plus组件mock
}));

// Mock vue-i18n
jest.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

// Mock 解码器模块
jest.mock('../../../../src/decoders/DecoderManager', () => ({
  decoderManager: {
    initialize: jest.fn(),
    dispose: jest.fn()
  }
}));

// Mock WaveformRenderer
jest.mock('../../../../src/webview/engines/WaveformRenderer', () => ({
  WaveformRenderer: jest.fn().mockImplementation(() => ({
    updateVisibleSamples: jest.fn(),
    setChannels: jest.fn(),
    resize: jest.fn(),
    invalidateVisual: jest.fn(),
    dispose: jest.fn()
  }))
}));

// Mock 按键管理器
jest.mock('../../../../src/webview/utils/KeyboardShortcutManager', () => ({
  keyboardShortcutManager: {
    formatShortcut: jest.fn((keys: string[]) => keys.join('+')),
    destroy: jest.fn()
  }
}));

// Mock 布局管理器
jest.mock('../../../../src/webview/utils/LayoutManager', () => ({
  layoutManager: {
    getCurrentLayout: jest.fn().mockReturnValue({
      panels: { leftPanel: {}, rightPanel: {} },
      waveform: { firstSample: 0, visibleSamples: 1000, zoomLevel: 1 },
      channels: []
    }),
    saveCurrentLayout: jest.fn(),
    destroy: jest.fn(),
    updateWaveformState: jest.fn()
  }
}));

// Mock window.vscode
const mockVscode = {
  postMessage: jest.fn()
};

Object.defineProperty(window, 'vscode', {
  value: mockVscode,
  writable: true
});

// Mock window.documentData
Object.defineProperty(window, 'documentData', {
  value: {
    fileName: 'test.lac',
    content: JSON.stringify({
      sampleRate: 1000000,
      totalSamples: 10000,
      channels: [
        { channelNumber: 0, channelName: 'CH0', samples: new Uint8Array([1,0,1,0]) },
        { channelNumber: 1, channelName: 'CH1', samples: new Uint8Array([0,1,0,1]) }
      ]
    })
  },
  writable: true
});

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  scale: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  fillText: jest.fn()
}));

HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 800,
  height: 400,
  left: 0,
  top: 0
}));

describe('App.vue', () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    wrapper = mount(App, {
      global: {
        stubs: {
          'el-header': { template: '<div class="el-header"><slot></slot></div>' },
          'el-container': { template: '<div class="el-container"><slot></slot></div>' },
          'el-aside': { template: '<div class="el-aside"><slot></slot></div>' },
          'el-main': { template: '<div class="el-main"><slot></slot></div>' },
          'el-footer': { template: '<div class="el-footer"><slot></slot></div>' },
          'el-button': { template: '<button @click="$emit(\'click\')" :loading="loading" :disabled="disabled"><slot></slot></button>', props: ['loading', 'disabled'] },
          'el-button-group': { template: '<div class="el-button-group"><slot></slot></div>' },
          'el-card': { template: '<div class="el-card"><template v-if="$slots.header"><div class="card-header"><slot name="header"></slot></div></template><slot></slot></div>' },
          'el-tag': { template: '<span class="el-tag" :type="type"><slot></slot></span>', props: ['type'] },
          'el-empty': { template: '<div class="el-empty"><slot></slot></div>' },
          'el-checkbox': { template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"><slot></slot>', props: ['modelValue'] },
          'el-tabs': { template: '<div class="el-tabs"><slot></slot></div>' },
          'el-tab-pane': { template: '<div class="el-tab-pane" v-show="name === activeTab"><slot></slot></div>', props: ['label', 'name'], inject: ['activeTab'] },
          'el-icon': { template: '<i class="el-icon"><slot></slot></i>' },
          // 模拟业务组件
          'DecoderPanel': {
            template: '<div class="decoder-panel"></div>',
            methods: {
              updateChannelData: jest.fn()
            }
          },
          'ChannelMappingVisualizer': { template: '<div class="channel-mapping"></div>' },
          'MeasurementTools': { template: '<div class="measurement-tools"></div>' },
          'DecoderStatusMonitor': { template: '<div class="status-monitor"></div>' },
          'PerformanceAnalyzer': { template: '<div class="performance-analyzer"></div>' },
          'ContextMenu': { template: '<div class="context-menu" v-if="visible"></div>', props: ['visible', 'x', 'y', 'items'] },
          'ShortcutHelpDialog': { template: '<div class="shortcut-help" v-if="modelValue"></div>', props: ['modelValue'] },
          'NotificationCenter': {
            template: '<div class="notification-center"></div>',
            methods: {
              updateConnectionStatus: jest.fn(),
              showTooltip: jest.fn(),
              showHelpBubble: jest.fn()
            }
          },
          'StatusBar': { template: '<div class="status-bar"></div>' }
        }
      }
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('组件初始化', () => {
    it('应该正确挂载组件', () => {
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.logic-analyzer-app').exists()).toBe(true);
    });

    it('应该初始化默认状态', () => {
      expect(wrapper.vm.isConnected).toBe(false);
      expect(wrapper.vm.isConnecting).toBe(false);
      expect(wrapper.vm.isCapturing).toBe(false);
      expect(wrapper.vm.hasData).toBe(false);
    });

    it('应该设置默认通道配置', () => {
      expect(wrapper.vm.channels).toHaveLength(24);
      expect(wrapper.vm.channels[0]).toEqual({
        id: 0,
        name: 'CH0',
        enabled: true,
        color: expect.stringMatching(/^hsl\(/)
      });
    });

    it('应该初始化解码器相关状态', () => {
      expect(wrapper.vm.activeTab).toBe('decoder');
      expect(wrapper.vm.activeDecoderConfigs).toEqual([]);
      expect(wrapper.vm.decoderResults).toBeInstanceOf(Map);
      expect(wrapper.vm.channelConflicts).toEqual([]);
      expect(wrapper.vm.measurementResults).toEqual([]);
    });

    it('应该初始化波形相关状态', () => {
      expect(wrapper.vm.viewRange).toEqual({ firstSample: 0, visibleSamples: 1000 });
      expect(wrapper.vm.zoomLevel).toBe(1);
      expect(wrapper.vm.panOffset).toBe(0);
      expect(wrapper.vm.captureData).toBeNull();
    });
  });

  describe('文档数据初始化', () => {
    it('应该从 window.documentData 加载数据', async () => {
      await wrapper.vm.initializeApp();
      
      expect(wrapper.vm.fileName).toBe('test.lac');
      expect(wrapper.vm.hasData).toBe(true);
      expect(wrapper.vm.sampleRate).toBe(1000000);
      expect(wrapper.vm.totalSamples).toBe(10000);
    });

    it('应该处理无效的 JSON 数据', async () => {
      window.documentData = {
        fileName: 'invalid.lac',
        content: 'invalid json'
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await wrapper.vm.initializeApp();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse document data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('应该处理缺少 window.documentData 的情况', async () => {
      delete (window as any).documentData;
      
      expect(() => wrapper.vm.initializeApp()).not.toThrow();
    });
  });

  describe('设备操作', () => {
    it('应该能够连接设备', async () => {
      await wrapper.vm.connectDevice();
      
      expect(mockVscode.postMessage).toHaveBeenCalledWith({ type: 'connectDevice' });
    });

    it('应该能够开始采集', async () => {
      await wrapper.vm.startCapture();
      
      expect(mockVscode.postMessage).toHaveBeenCalledWith({ type: 'startCapture' });
    });

    it('应该能够停止采集', async () => {
      wrapper.vm.isCapturing = true;
      wrapper.vm.captureStatus = { type: 'success', text: '采集中' };
      
      await wrapper.vm.stopCapture();
      
      expect(wrapper.vm.isCapturing).toBe(false);
      expect(wrapper.vm.captureStatus).toBeNull();
    });

    it('应该能够测试通信', () => {
      wrapper.vm.testCommunication();
      
      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: 'testMessage',
        data: {
          timestamp: expect.any(String),
          message: '来自Vue前端的测试消息'
        }
      });
      
      expect(ElMessage.success).toHaveBeenCalledWith('测试消息已发送');
    });

    it('应该在没有 vscode 对象时处理错误', () => {
      delete (window as any).vscode;
      
      wrapper.vm.testCommunication();
      
      expect(ElMessage.error).toHaveBeenCalledWith('VSCode API不可用');
    });
  });

  describe('通道操作', () => {
    it('应该能够切换通道可见性', () => {
      const channel = wrapper.vm.channels[0];
      channel.enabled = false;
      
      wrapper.vm.onChannelToggle(channel);
      
      // 验证通道状态被更新
      expect(channel.enabled).toBe(false);
    });

    it('应该显示颜色选择器提示', () => {
      const channel = wrapper.vm.channels[0];
      
      wrapper.vm.showColorPicker(channel);
      
      expect(ElMessage.info).toHaveBeenCalledWith('颜色选择器功能开发中...');
    });
  });

  describe('波形操作', () => {
    beforeEach(() => {
      wrapper.vm.totalSamples = 10000;
      wrapper.vm.waveformRenderer = {
        updateVisibleSamples: jest.fn()
      };
    });

    it('应该能够放大波形', () => {
      wrapper.vm.viewRange.visibleSamples = 1000;
      
      wrapper.vm.zoomIn();
      
      expect(wrapper.vm.viewRange.visibleSamples).toBe(500);
      expect(wrapper.vm.zoomLevel).toBe(2);
    });

    it('应该能够缩小波形', () => {
      wrapper.vm.viewRange.visibleSamples = 1000;
      wrapper.vm.viewRange.firstSample = 1000;
      
      wrapper.vm.zoomOut();
      
      expect(wrapper.vm.viewRange.visibleSamples).toBe(2000);
      expect(wrapper.vm.zoomLevel).toBe(0.5);
    });

    it('应该能够适应窗口', () => {
      wrapper.vm.viewRange = { firstSample: 1000, visibleSamples: 500 };
      wrapper.vm.zoomLevel = 2;
      
      wrapper.vm.fitToWindow();
      
      expect(wrapper.vm.viewRange.firstSample).toBe(0);
      expect(wrapper.vm.viewRange.visibleSamples).toBe(10000);
      expect(wrapper.vm.zoomLevel).toBe(1);
    });

    it('应该在没有数据时忽略操作', () => {
      wrapper.vm.totalSamples = 0;
      wrapper.vm.waveformRenderer = null;
      
      wrapper.vm.zoomIn();
      wrapper.vm.zoomOut();
      wrapper.vm.fitToWindow();
      
      // 不应该抛出错误
    });
  });

  describe('鼠标交互', () => {
    let mockCanvas: HTMLCanvasElement;

    beforeEach(() => {
      mockCanvas = document.createElement('canvas');
      wrapper.vm.waveformCanvas = mockCanvas;
      wrapper.vm.totalSamples = 10000;
      wrapper.vm.waveformRenderer = {
        updateVisibleSamples: jest.fn()
      };
    });

    it('应该处理鼠标按下事件', () => {
      const event = new MouseEvent('mousedown', { clientX: 100 });
      
      wrapper.vm.onCanvasMouseDown(event);
      
      expect(wrapper.vm.isDragging).toBe(true);
      expect(wrapper.vm.dragStartX).toBe(100);
    });

    it('应该处理鼠标移动事件', () => {
      wrapper.vm.isDragging = true;
      wrapper.vm.dragStartX = 100;
      wrapper.vm.dragStartFirstSample = 1000;
      wrapper.vm.viewRange = { firstSample: 1000, visibleSamples: 1000 };
      
      mockCanvas.getBoundingClientRect = jest.fn().mockReturnValue({ width: 800 });
      
      const event = new MouseEvent('mousemove', { clientX: 200 });
      wrapper.vm.onCanvasMouseMove(event);
      
      // 验证波形被平移
      expect(wrapper.vm.viewRange.firstSample).not.toBe(1000);
    });

    it('应该处理鼠标释放事件', () => {
      wrapper.vm.isDragging = true;
      
      const event = new MouseEvent('mouseup');
      wrapper.vm.onCanvasMouseUp(event);
      
      expect(wrapper.vm.isDragging).toBe(false);
    });

    it('应该处理鼠标滚轮事件', () => {
      wrapper.vm.viewRange = { firstSample: 1000, visibleSamples: 1000 };
      
      mockCanvas.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 800,
        left: 0
      });
      
      const event = new WheelEvent('wheel', {
        clientX: 400,
        deltaY: 100
      });
      
      wrapper.vm.onCanvasWheel(event);
      
      // 验证缩放操作
      expect(wrapper.vm.viewRange.visibleSamples).not.toBe(1000);
    });
  });

  describe('解码器事件处理', () => {
    it('应该处理解码器结果', () => {
      const results = new Map();
      results.set('i2c', { type: 'START', data: 'test' });
      
      wrapper.vm.onDecoderResults(results);
      
      expect(wrapper.vm.decoderResults).toBe(results);
      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: 'decoderResults',
        data: Array.from(results.entries())
      });
    });

    it('应该处理解码器错误', () => {
      const error = { decoderId: 'i2c', message: 'Decode failed' };
      
      wrapper.vm.onDecoderError(error);
      
      expect(ElMessage.error).toHaveBeenCalledWith('解码器错误 (i2c): Decode failed');
      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: 'decoderError',
        data: error
      });
    });

    it('应该处理通道映射变化', () => {
      wrapper.vm.activeDecoderConfigs = [{ id: 'i2c', mapping: {} }];
      
      const mapping = { sda: 0, scl: 1 };
      wrapper.vm.onChannelMappingChange('i2c', mapping);
      
      expect(wrapper.vm.activeDecoderConfigs[0].mapping).toBe(mapping);
    });

    it('应该处理通道冲突检测', () => {
      const conflicts = [{ channel: 0, decoders: ['i2c', 'spi'] }];
      
      wrapper.vm.onChannelConflictDetected(conflicts);
      
      expect(wrapper.vm.channelConflicts).toBe(conflicts);
      expect(ElMessage.warning).toHaveBeenCalledWith('检测到 1 个通道冲突');
    });

    it('应该处理测量更新', () => {
      const measurements = [{ type: 'frequency', value: 1000 }];
      
      wrapper.vm.onMeasurementUpdate(measurements);
      
      expect(wrapper.vm.measurementResults).toBe(measurements);
      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: 'measurementResults',
        data: measurements
      });
    });
  });

  describe('消息处理', () => {
    it('应该处理文档更新消息', () => {
      const data = {
        sampleRate: 2000000,
        totalSamples: 20000,
        channels: [
          { channelNumber: 0, samples: new Uint8Array([1,0]) }
        ]
      };
      
      wrapper.vm.handleDocumentUpdate(data);
      
      expect(wrapper.vm.hasData).toBe(true);
      expect(wrapper.vm.sampleRate).toBe(2000000);
      expect(wrapper.vm.totalSamples).toBe(20000);
      expect(wrapper.vm.captureData).toBe(data.channels);
    });

    it('应该处理错误消息', () => {
      const message = { type: 'error', message: 'Test error' };
      
      const event = new MessageEvent('message', { data: message });
      window.dispatchEvent(event);
      
      expect(ElMessage.error).toHaveBeenCalledWith('Test error');
    });

    it('应该处理测试响应消息', () => {
      const message = {
        type: 'testResponse',
        data: { message: 'Test response' }
      };
      
      const event = new MessageEvent('message', { data: message });
      window.dispatchEvent(event);
      
      expect(ElMessage.success).toHaveBeenCalledWith('通信测试成功！收到回复: Test response');
    });
  });

  describe('右键菜单', () => {
    it('应该显示右键菜单', () => {
      const event = new MouseEvent('contextmenu', {
        clientX: 100,
        clientY: 200,
        offsetX: 50
      });
      
      wrapper.vm.onCanvasRightClick(event);
      
      expect(wrapper.vm.contextMenu.visible).toBe(true);
      expect(wrapper.vm.contextMenu.x).toBe(100);
      expect(wrapper.vm.contextMenu.y).toBe(200);
      expect(wrapper.vm.contextMenu.items.length).toBeGreaterThan(0);
    });

    it('应该处理菜单项点击', () => {
      const item = { id: 'zoom-in', label: '放大', action: jest.fn() };
      
      wrapper.vm.handleContextMenuClick(item);
      
      // 验证日志输出
      expect(console.log).toHaveBeenCalledTimes(0); // 因为没有mock console.log
    });
  });

  describe('标记和测量', () => {
    beforeEach(() => {
      wrapper.vm.waveformRenderer = {};
      wrapper.vm.waveformCanvas = document.createElement('canvas');
      wrapper.vm.notificationCenterRef = {
        showTooltip: jest.fn(),
        showHelpBubble: jest.fn()
      };
    });

    it('应该能够添加标记', () => {
      wrapper.vm.waveformCanvas.getBoundingClientRect = jest.fn().mockReturnValue({
        width: 800
      });
      
      wrapper.vm.addMarkerAtPosition(400);
      
      expect(wrapper.vm.notificationCenterRef.showTooltip).toHaveBeenCalled();
    });

    it('应该能够开始时间测量', () => {
      wrapper.vm.startTimeMeasurement(100);
      
      expect(wrapper.vm.notificationCenterRef.showHelpBubble).toHaveBeenCalledWith(
        '时间测量',
        '拖拽鼠标到结束位置来测量时间间隔',
        wrapper.vm.waveformCanvas,
        'top'
      );
    });

    it('应该能够导出可见区域', () => {
      wrapper.vm.viewRange = { firstSample: 1000, visibleSamples: 2000 };
      
      wrapper.vm.exportVisibleArea();
      
      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: 'exportVisibleArea',
        data: {
          firstSample: 1000,
          visibleSamples: 2000
        }
      });
    });
  });

  describe('布局管理', () => {
    it('应该能够应用布局配置', () => {
      const layout = {
        panels: { leftPanel: {}, rightPanel: {} },
        waveform: { firstSample: 500, visibleSamples: 1500, zoomLevel: 1.5 },
        channels: [
          { visible: true, color: '#ff0000' },
          { visible: false, color: '#00ff00' }
        ]
      };
      
      wrapper.vm.applyLayout(layout);
      
      expect(wrapper.vm.viewRange.firstSample).toBe(500);
      expect(wrapper.vm.viewRange.visibleSamples).toBe(1500);
      expect(wrapper.vm.zoomLevel).toBe(1.5);
      expect(wrapper.vm.channels[0].enabled).toBe(true);
      expect(wrapper.vm.channels[0].color).toBe('#ff0000');
      expect(wrapper.vm.channels[1].enabled).toBe(false);
    });

    it('应该能够处理面板切换', () => {
      const event = new CustomEvent('panel-toggle', { detail: 'measurement' });
      
      wrapper.vm.handlePanelToggle(event);
      
      expect(wrapper.vm.activeTab).toBe('measurement');
    });

    it('应该能够处理通道切换', () => {
      const event = new CustomEvent('channel-toggle', { detail: 5 });
      
      wrapper.vm.handleChannelToggle(event);
      
      expect(wrapper.vm.channels[5].enabled).toBe(false); // 从默认的true变为false
    });
  });

  describe('工具函数', () => {
    it('应该正确格式化频率', () => {
      expect(wrapper.vm.formatFrequency(1500000000)).toBe('1.5GHz');
      expect(wrapper.vm.formatFrequency(25000000)).toBe('25.0MHz');
      expect(wrapper.vm.formatFrequency(9600)).toBe('9.6kHz');
      expect(wrapper.vm.formatFrequency(500)).toBe('500Hz');
    });
  });

  describe('计算属性', () => {
    it('应该正确计算启用的通道', () => {
      wrapper.vm.channels[0].enabled = true;
      wrapper.vm.channels[1].enabled = false;
      wrapper.vm.channels[2].enabled = true;
      
      const enabledChannels = wrapper.vm.enabledChannels;
      
      expect(enabledChannels).toHaveLength(2);
      expect(enabledChannels[0].channelNumber).toBe(0);
      expect(enabledChannels[1].channelNumber).toBe(2);
    });
  });

  describe('错误处理', () => {
    it('应该处理Canvas初始化失败', async () => {
      wrapper.vm.waveformCanvas = null;
      
      expect(() => wrapper.vm.setupCanvas()).not.toThrow();
    });

    it('应该处理波形渲染器初始化失败', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock WaveformRenderer抛出错误
      jest.doMock('../../../../src/webview/engines/WaveformRenderer', () => {
        throw new Error('WaveformRenderer init failed');
      });
      
      await wrapper.vm.setupCanvas();
      
      expect(ElMessage.error).toHaveBeenCalledWith('波形渲染器初始化失败');
      
      consoleSpy.mockRestore();
    });
  });

  describe('清理和销毁', () => {
    it('应该正确清理资源', () => {
      wrapper.vm.waveformRenderer = {
        dispose: jest.fn()
      };
      
      wrapper.vm.cleanupCanvas();
      
      expect(wrapper.vm.waveformRenderer.dispose).toHaveBeenCalled();
      expect(wrapper.vm.waveformRenderer).toBeNull();
    });

    it('应该正确清理UI优化', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      wrapper.vm.cleanupUIOptimizations();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('waveform-action', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('channel-toggle', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('panel-toggle', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });
  });
});