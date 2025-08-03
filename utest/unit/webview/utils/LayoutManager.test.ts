/**
 * LayoutManager 单元测试
 * 测试界面布局管理器的所有功能
 * @jest-environment jsdom
 */

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

// Mock window 对象方法
const mockWindowMethods = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),  
  setInterval: jest.fn(() => 12345),
  clearInterval: jest.fn(),
  setTimeout: jest.fn(() => 54321),
  clearTimeout: jest.fn()
};

// Mock console 方法
const mockConsole = {
  warn: jest.fn(),
  error: jest.fn()
};

describe('LayoutManager', () => {
  let LayoutManager: any;
  let ApplicationLayout: any;
  let PanelLayout: any;
  let WaveformViewState: any;
  let ChannelVisibility: any;
  let DecoderPanelState: any;
  let LayoutPreset: any;
  let layoutManager: any;
  
  beforeAll(() => {
    // 设置全局 mocks 在导入模块之前
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    // 扩展 window 对象
    Object.assign(window, mockWindowMethods);
    
    Object.defineProperty(global, 'console', {
      value: mockConsole,
      writable: true
    });
  });

  beforeEach(() => {
    // 重置所有 mocks
    jest.clearAllMocks();
    mockLocalStorage.clear();
    
    // 动态导入模块以避免全局实例问题
    const layoutManagerModule = require('../../../../src/webview/utils/LayoutManager');
    LayoutManager = layoutManagerModule.LayoutManager;
    ApplicationLayout = layoutManagerModule.ApplicationLayout;
    PanelLayout = layoutManagerModule.PanelLayout;
    WaveformViewState = layoutManagerModule.WaveformViewState;
    ChannelVisibility = layoutManagerModule.ChannelVisibility;
    DecoderPanelState = layoutManagerModule.DecoderPanelState;
    LayoutPreset = layoutManagerModule.LayoutPreset;
    
    // 创建新的 LayoutManager 实例
    layoutManager = new LayoutManager();
  });

  afterEach(() => {
    // 清理定时器
    layoutManager.destroy();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化默认布局', () => {
      const currentLayout = layoutManager.getCurrentLayout();
      
      expect(currentLayout).toBeDefined();
      expect(currentLayout.version).toBe('1.0');
      expect(currentLayout.name).toBe('Default Layout');
      expect(currentLayout.panels).toBeDefined();
      expect(currentLayout.waveform).toBeDefined();
      expect(currentLayout.channels).toHaveLength(24);
      expect(currentLayout.decoderPanel).toBeDefined();
      expect(currentLayout.window).toBeDefined();
      expect(currentLayout.preferences).toBeDefined();
    });

    it('应该设置默认预设', () => {
      const presets = layoutManager.getPresets();
      
      expect(presets).toHaveLength(4);
      expect(presets.find(p => p.id === 'default')).toBeDefined();
      expect(presets.find(p => p.id === 'compact')).toBeDefined();
      expect(presets.find(p => p.id === 'analysis')).toBeDefined();
      expect(presets.find(p => p.id === 'fullscreen-waveform')).toBeDefined();
    });

    it('应该设置自动保存', () => {
      // 验证事件监听器被添加
      expect(mockWindowMethods.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      // 验证定时器被设置
      expect(mockWindowMethods.setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('应该从 localStorage 加载已保存的预设', () => {
      const userPreset: LayoutPreset = {
        id: 'user-custom',
        name: '用户自定义',
        description: '用户自定义布局',
        layout: {
          version: '1.0',
          timestamp: '2025-08-01T00:00:00.000Z',
          name: '用户自定义',
          panels: {} as any,
          waveform: {} as any,
          channels: [],
          decoderPanel: {} as any,
          window: {} as any,
          preferences: {} as any
        },
        isDefault: false,
        isSystem: false
      };

      mockLocalStorage.setItem('logic-analyzer-layout-presets', JSON.stringify([userPreset]));
      
      const newLayoutManager = new LayoutManager();
      const presets = newLayoutManager.getPresets();
      
      expect(presets.find(p => p.id === 'user-custom')).toBeDefined();
      newLayoutManager.destroy();
    });
  });

  describe('getCurrentLayout', () => {
    it('应该返回当前布局', () => {
      const layout = layoutManager.getCurrentLayout();
      
      expect(layout).toBeDefined();
      expect(layout.version).toBe('1.0');
    });

    it('应该从 localStorage 加载已保存的布局', () => {
      const savedLayout: ApplicationLayout = {
        version: '1.0',
        timestamp: '2025-08-01T00:00:00.000Z',
        name: 'Saved Layout',
        panels: {
          leftPanel: { id: 'left', visible: true, width: 250, position: 'left', order: 0 },
          rightPanel: { id: 'right', visible: true, width: 350, position: 'right', order: 1 },
          statusBar: { id: 'status', visible: true, height: 30, position: 'bottom', order: 2 },
          toolbar: { id: 'toolbar', visible: true, height: 50, position: 'top', order: 0 }
        },
        waveform: {
          zoomLevel: 2,
          panOffset: 100,
          firstSample: 0,
          visibleSamples: 2000,
          channelHeight: 35,
          showGrid: false,
          showTimeAxis: true,
          showSamplePoints: true
        },
        channels: [],
        decoderPanel: {
          activeTab: 'protocols',
          expandedDecoders: ['uart'],
          selectedProtocols: ['i2c', 'spi']
        },
        window: { width: 1400, height: 900, maximized: true },
        preferences: {
          theme: 'dark',
          language: 'en-US',
          autoSave: false,
          showTooltips: false,
          animationsEnabled: false
        }
      };

      mockLocalStorage.setItem('logic-analyzer-layout', JSON.stringify(savedLayout));
      
      const newLayoutManager = new LayoutManager();
      const layout = newLayoutManager.getCurrentLayout();
      
      expect(layout.name).toBe('Saved Layout');
      expect(layout.waveform.zoomLevel).toBe(2);
      expect(layout.preferences.theme).toBe('dark');
      
      newLayoutManager.destroy();
    });

    it('应该处理版本不兼容的布局', () => {
      const incompatibleLayout = {
        version: '0.5', // 不兼容的版本
        timestamp: '2025-08-01T00:00:00.000Z',
        name: 'Old Layout'
      };

      mockLocalStorage.setItem('logic-analyzer-layout', JSON.stringify(incompatibleLayout));
      
      const newLayoutManager = new LayoutManager();
      const layout = newLayoutManager.getCurrentLayout();
      
      // 应该使用默认布局
      expect(layout.name).toBe('Default Layout');
      expect(mockConsole.warn).toHaveBeenCalledWith('布局版本不兼容，使用默认布局');
      
      newLayoutManager.destroy();
    });

    it('应该处理损坏的 localStorage 数据', () => {
      mockLocalStorage.setItem('logic-analyzer-layout', '{invalid json}');
      
      const newLayoutManager = new LayoutManager();
      const layout = newLayoutManager.getCurrentLayout();
      
      // 应该使用默认布局
      expect(layout.name).toBe('Default Layout');
      expect(mockConsole.error).toHaveBeenCalledWith('加载布局失败:', expect.any(Error));
      
      newLayoutManager.destroy();
    });
  });

  describe('updateLayout', () => {
    it('应该更新当前布局', () => {
      const updates = {
        name: 'Updated Layout',
        preferences: {
          theme: 'dark' as const,
          language: 'en-US',
          autoSave: false,
          showTooltips: false,
          animationsEnabled: false
        }
      };

      layoutManager.updateLayout(updates);
      const layout = layoutManager.getCurrentLayout();
      
      expect(layout.name).toBe('Updated Layout');
      expect(layout.preferences.theme).toBe('dark');
      expect(layout.timestamp).toBeDefined();
    });

    it('应该在自动保存启用时计划保存', () => {
      layoutManager.updateLayout({ name: 'Test Layout' });
      
      // 验证计划了自动保存
      expect(mockWindowMethods.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('面板布局管理', () => {
    it('应该更新面板布局', () => {
      const panelUpdate: Partial<PanelLayout> = {
        visible: false,
        width: 400
      };

      layoutManager.updatePanelLayout('leftPanel', panelUpdate);
      const layout = layoutManager.getCurrentLayout();
      
      expect(layout.panels.leftPanel.visible).toBe(false);
      expect(layout.panels.leftPanel.width).toBe(400);
    });

    it('应该忽略不存在的面板', () => {
      const originalLayout = layoutManager.getCurrentLayout();
      
      layoutManager.updatePanelLayout('nonexistentPanel', { visible: false });
      const updatedLayout = layoutManager.getCurrentLayout();
      
      // 布局应该没有变化
      expect(updatedLayout).toEqual(originalLayout);
    });
  });

  describe('波形视图状态管理', () => {
    it('应该更新波形视图状态', () => {
      const waveformUpdate: Partial<WaveformViewState> = {
        zoomLevel: 5,
        panOffset: 200,
        showGrid: false,
        channelHeight: 40
      };

      layoutManager.updateWaveformState(waveformUpdate);
      const layout = layoutManager.getCurrentLayout();
      
      expect(layout.waveform.zoomLevel).toBe(5);
      expect(layout.waveform.panOffset).toBe(200);
      expect(layout.waveform.showGrid).toBe(false);
      expect(layout.waveform.channelHeight).toBe(40);
    });
  });

  describe('通道可见性管理', () => {
    it('应该更新通道可见性', () => {
      const channelUpdate: Partial<ChannelVisibility> = {
        visible: false,
        color: '#ff0000',
        label: 'Custom CH0'
      };

      layoutManager.updateChannelVisibility(0, channelUpdate);
      const layout = layoutManager.getCurrentLayout();
      
      const channel0 = layout.channels.find(ch => ch.channelId === 0);
      expect(channel0).toBeDefined();
      expect(channel0!.visible).toBe(false);
      expect(channel0!.color).toBe('#ff0000');
      expect(channel0!.label).toBe('Custom CH0');
    });

    it('应该忽略不存在的通道', () => {
      const originalLayout = layoutManager.getCurrentLayout();
      
      layoutManager.updateChannelVisibility(99, { visible: false });
      const updatedLayout = layoutManager.getCurrentLayout();
      
      // 通道数组应该没有变化
      expect(updatedLayout.channels).toEqual(originalLayout.channels);
    });
  });

  describe('解码器面板状态管理', () => {
    it('应该更新解码器面板状态', () => {
      const decoderUpdate: Partial<DecoderPanelState> = {
        activeTab: 'protocols',
        expandedDecoders: ['uart', 'i2c'],
        selectedProtocols: ['spi']
      };

      layoutManager.updateDecoderPanelState(decoderUpdate);
      const layout = layoutManager.getCurrentLayout();
      
      expect(layout.decoderPanel.activeTab).toBe('protocols');
      expect(layout.decoderPanel.expandedDecoders).toEqual(['uart', 'i2c']);
      expect(layout.decoderPanel.selectedProtocols).toEqual(['spi']);
    });
  });

  describe('布局保存和加载', () => {
    it('应该保存当前布局到 localStorage', () => {
      layoutManager.updateLayout({ name: 'Test Save Layout' });
      
      const result = layoutManager.saveCurrentLayout();
      
      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'logic-analyzer-layout',
        expect.any(String)
      );
      
      // 验证保存的数据
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.name).toBe('Test Save Layout');
    });

    it('应该处理保存失败的情况', () => {
      // 模拟 localStorage 错误
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      layoutManager.updateLayout({ name: 'Test Layout' });
      const result = layoutManager.saveCurrentLayout();
      
      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('保存布局失败:', expect.any(Error));
    });

    it('应该在没有当前布局时返回 false', () => {
      const emptyLayoutManager = new LayoutManager();
      // 设置 currentLayout 为 null
      (emptyLayoutManager as any).currentLayout = null;
      
      const result = emptyLayoutManager.saveCurrentLayout();
      
      expect(result).toBe(false);
      emptyLayoutManager.destroy();
    });
  });

  describe('预设管理', () => {
    it('应该应用预设布局', () => {
      const result = layoutManager.applyPreset('compact');
      
      expect(result).toBe(true);
      
      const layout = layoutManager.getCurrentLayout();
      expect(layout.panels.leftPanel.visible).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('应该处理不存在的预设', () => {
      const result = layoutManager.applyPreset('nonexistent');
      
      expect(result).toBe(false);
    });

    it('应该保存为新预设', () => {
      layoutManager.updateLayout({ name: 'Custom Layout' });
      
      const presetId = layoutManager.saveAsPreset('我的自定义布局', '这是自定义描述');
      
      expect(presetId).toMatch(/^user-\d+$/);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'logic-analyzer-layout-presets',
        expect.any(String)
      );
      
      const presets = layoutManager.getPresets();
      const newPreset = presets.find(p => p.name === '我的自定义布局');
      expect(newPreset).toBeDefined();
      expect(newPreset!.description).toBe('这是自定义描述');
      expect(newPreset!.isSystem).toBe(false);
    });

    it('应该删除用户预设', () => {
      // 先创建一个用户预设
      const presetId = layoutManager.saveAsPreset('临时预设');
      
      const result = layoutManager.deletePreset(presetId);
      
      expect(result).toBe(true);
      
      const presets = layoutManager.getPresets();
      expect(presets.find(p => p.id === presetId)).toBeUndefined();
    });

    it('应该拒绝删除系统预设', () => {
      const result = layoutManager.deletePreset('default');
      
      expect(result).toBe(false);
      
      const presets = layoutManager.getPresets();
      expect(presets.find(p => p.id === 'default')).toBeDefined();
    });

    it('应该处理删除不存在的预设', () => {
      const result = layoutManager.deletePreset('nonexistent');
      
      expect(result).toBe(false);
    });

    it('应该按正确顺序返回预设', () => {
      // 创建一个用户预设
      layoutManager.saveAsPreset('用户预设A');
      layoutManager.saveAsPreset('用户预设B');
      
      const presets = layoutManager.getPresets();
      
      // 系统预设应该在前面
      const systemPresetIndex = presets.findIndex(p => p.isSystem);
      const userPresetIndex = presets.findIndex(p => !p.isSystem);
      
      expect(systemPresetIndex).toBeLessThan(userPresetIndex);
    });
  });

  describe('重置和导入导出', () => {
    it('应该重置为默认布局', () => {
      // 先修改布局
      layoutManager.updateLayout({ name: 'Modified Layout' });
      
      layoutManager.resetToDefault();
      
      const layout = layoutManager.getCurrentLayout();
      expect(layout.name).toBe('Default Layout');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('应该导出布局配置', () => {
      layoutManager.updateLayout({ name: 'Export Test' });
      layoutManager.saveAsPreset('用户预设');
      
      const exportData = layoutManager.exportLayout();
      
      expect(exportData).toBeDefined();
      
      const parsedData = JSON.parse(exportData);
      expect(parsedData.version).toBe('1.0');
      expect(parsedData.layout.name).toBe('Export Test');
      expect(parsedData.presets).toBeDefined();
      expect(parsedData.timestamp).toBeDefined();
    });

    it('应该导入布局配置', () => {
      const importData = {
        version: '1.0',
        timestamp: '2025-08-01T00:00:00.000Z',
        layout: {
          version: '1.0',
          timestamp: '2025-08-01T00:00:00.000Z',
          name: 'Imported Layout',
          panels: {} as any,
          waveform: {} as any,
          channels: [],
          decoderPanel: {} as any,
          window: {} as any,
          preferences: {} as any
        },
        presets: [{
          id: 'imported-preset',
          name: '导入的预设',
          description: '从导入中恢复',
          layout: {} as any,
          isDefault: false,
          isSystem: false
        }]
      };

      const result = layoutManager.importLayout(JSON.stringify(importData));
      
      expect(result).toBe(true);
      
      const layout = layoutManager.getCurrentLayout();
      expect(layout.name).toBe('Imported Layout');
      
      const presets = layoutManager.getPresets();
      expect(presets.find(p => p.id === 'imported-preset')).toBeDefined();
    });

    it('应该处理导入无效数据', () => {
      const result = layoutManager.importLayout('{invalid json}');
      
      expect(result).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('导入布局配置失败:', expect.any(Error));
    });
  });

  describe('自动保存管理', () => {
    it('应该启用/禁用自动保存', () => {
      layoutManager.setAutoSave(false);
      
      const layout = layoutManager.getCurrentLayout();
      expect(layout.preferences.autoSave).toBe(false);
    });

    it('应该在启用自动保存时更新偏好设置', () => {
      layoutManager.setAutoSave(true);
      
      const layout = layoutManager.getCurrentLayout();
      expect(layout.preferences.autoSave).toBe(true);
    });
  });

  describe('销毁和清理', () => {
    it('应该正确清理资源', () => {
      // 先确保布局管理器已经被使用（有当前布局）
      layoutManager.getCurrentLayout(); // 这会创建当前布局
      
      layoutManager.destroy();
      
      expect(mockWindowMethods.clearInterval).toHaveBeenCalledWith(12345);
      expect(mockLocalStorage.setItem).toHaveBeenCalled(); // 保存当前布局
    });

    it('应该处理没有定时器的情况', () => {
      const emptyLayoutManager = new LayoutManager();
      (emptyLayoutManager as any).autoSaveTimer = null;
      
      expect(() => emptyLayoutManager.destroy()).not.toThrow();
      
      emptyLayoutManager.destroy();
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理预设加载失败', () => {
      mockLocalStorage.setItem('logic-analyzer-layout-presets', '{invalid json}');
      
      expect(() => new LayoutManager()).not.toThrow();
      expect(mockConsole.warn).toHaveBeenCalledWith('加载布局预设失败:', expect.any(Error));
    });

    it('应该处理预设保存失败', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      expect(() => layoutManager.saveAsPreset('Test Preset')).not.toThrow();
      expect(mockConsole.error).toHaveBeenCalledWith('保存布局预设失败:', expect.any(Error));
    });

    it('应该正确处理默认布局的深拷贝', () => {
      const layout1 = layoutManager.getCurrentLayout();
      const layout2 = layoutManager.getCurrentLayout();
      
      // 修改 layout1 不应该影响 layout2
      layout1.name = 'Modified';
      expect(layout2.name).toBe('Default Layout');
    });

    it('应该处理空的导入数据', () => {
      const result = layoutManager.importLayout('{}');
      
      expect(result).toBe(true); // 空对象应该被接受，但不做任何操作
    });

    it('应该处理只有布局没有预设的导入', () => {
      const importData = {
        layout: {
          version: '1.0',
          timestamp: '2025-08-01T00:00:00.000Z',
          name: 'Layout Only',
          panels: {} as any,
          waveform: {} as any,
          channels: [],
          decoderPanel: {} as any,
          window: {} as any,
          preferences: {} as any
        }
      };

      const result = layoutManager.importLayout(JSON.stringify(importData));
      
      expect(result).toBe(true);
      const layout = layoutManager.getCurrentLayout();
      expect(layout.name).toBe('Layout Only');
    });

    it('应该过滤导入的系统预设', () => {
      const importData = {
        presets: [{
          id: 'system-preset',
          name: '系统预设',
          description: '应该被过滤',
          layout: {} as any,
          isDefault: false,
          isSystem: true // 系统预设应该被过滤
        }, {
          id: 'user-preset',
          name: '用户预设',
          description: '应该被导入',
          layout: {} as any,
          isDefault: false,
          isSystem: false
        }]
      };

      const result = layoutManager.importLayout(JSON.stringify(importData));
      
      expect(result).toBe(true);
      
      const presets = layoutManager.getPresets();
      expect(presets.find(p => p.id === 'system-preset')).toBeUndefined();
      expect(presets.find(p => p.id === 'user-preset')).toBeDefined();
    });
  });

  describe('计划自动保存功能', () => {
    it('应该清除之前的定时器', () => {
      // 设置一个模拟的之前的定时器
      (layoutManager as any).autoSaveTimer = 99999;
      
      layoutManager.updateLayout({ name: 'Test' });
      
      expect(mockWindowMethods.clearTimeout).toHaveBeenCalledWith(99999);
      expect(mockWindowMethods.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('默认预设验证', () => {
    it('默认预设应该有正确的结构', () => {
      const presets = layoutManager.getPresets();
      const defaultPreset = presets.find(p => p.id === 'default');
      
      expect(defaultPreset).toBeDefined();
      expect(defaultPreset!.name).toBe('默认布局');
      expect(defaultPreset!.isDefault).toBe(true);
      expect(defaultPreset!.isSystem).toBe(true);
      expect(defaultPreset!.layout.panels.leftPanel.visible).toBe(true);
    });

    it('紧凑预设应该隐藏左面板', () => {
      const presets = layoutManager.getPresets();
      const compactPreset = presets.find(p => p.id === 'compact');
      
      expect(compactPreset).toBeDefined();
      expect(compactPreset!.layout.panels.leftPanel.visible).toBe(false);
    });

    it('分析预设应该有更宽的右面板', () => {
      const presets = layoutManager.getPresets();
      const analysisPreset = presets.find(p => p.id === 'analysis');
      
      expect(analysisPreset).toBeDefined();
      expect(analysisPreset!.layout.panels.rightPanel.width).toBe(500);
    });

    it('全屏波形预设应该隐藏侧面板', () => {
      const presets = layoutManager.getPresets();
      const fullscreenPreset = presets.find(p => p.id === 'fullscreen-waveform');
      
      expect(fullscreenPreset).toBeDefined();
      expect(fullscreenPreset!.layout.panels.leftPanel.visible).toBe(false);
      expect(fullscreenPreset!.layout.panels.rightPanel.visible).toBe(false);
    });
  });

  describe('通道默认配置验证', () => {
    it('应该正确配置默认通道', () => {
      const layout = layoutManager.getCurrentLayout();
      
      expect(layout.channels).toHaveLength(24);
      
      // 前8个通道应该可见
      for (let i = 0; i < 8; i++) {
        const channel = layout.channels.find(ch => ch.channelId === i);
        expect(channel).toBeDefined();
        expect(channel!.visible).toBe(true);
        expect(channel!.label).toBe(`CH${i}`);
        expect(channel!.order).toBe(i);
      }
      
      // 后16个通道应该不可见
      for (let i = 8; i < 24; i++) {
        const channel = layout.channels.find(ch => ch.channelId === i);
        expect(channel).toBeDefined();
        expect(channel!.visible).toBe(false);
      }
    });

    it('每个通道应该有唯一的颜色', () => {
      const layout = layoutManager.getCurrentLayout();
      const colors = layout.channels.map(ch => ch.color);
      const uniqueColors = new Set(colors);
      
      expect(uniqueColors.size).toBe(colors.length);
    });
  });
});