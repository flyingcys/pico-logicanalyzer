/**
 * 🎯 第3周 Day 3-4: LayoutManager工具类模块完善  
 * 目标：从8.92%一点一点提升到80%+
 * 策略：深度思考，严格按照渐进式方法，慢慢一步一步到90%
 */

// 在导入之前设置全局mocks
const mockLocalStorage = {
  storage: new Map<string, string>(),
  getItem: jest.fn((key: string) => mockLocalStorage.storage.get(key) || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorage.storage.set(key, value);
  }),
  removeItem: jest.fn((key: string) => {
    mockLocalStorage.storage.delete(key);
  }),
  clear: jest.fn(() => {
    mockLocalStorage.storage.clear();
  })
};

const mockWindow = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  setInterval: jest.fn((callback: Function, interval: number) => {
    return setInterval(callback, interval);
  }),
  clearInterval: jest.fn((id: number) => {
    clearInterval(id);
  }),
  setTimeout: jest.fn((callback: Function, delay: number) => {
    return setTimeout(callback, delay);
  }),
  clearTimeout: jest.fn((id: number) => {
    clearTimeout(id);
  })
};

// 设置全局对象
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

// 现在可以安全地导入
import { 
  LayoutManager,
  ApplicationLayout,
  PanelLayout,
  WaveformViewState,
  ChannelVisibility,
  DecoderPanelState,
  LayoutPreset
} from '../../../src/webview/utils/LayoutManager';

describe('🎯 第3周 LayoutManager 工具类模块深度测试', () => {

  let manager: LayoutManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.storage.clear();
    
    // 清除定时器
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    jest.useRealTimers();
  });

  describe('📋 基础构造和初始化测试', () => {

    it('应该正确构造LayoutManager实例', () => {
      manager = new LayoutManager();
      
      // 验证构造函数执行成功
      expect(manager).toBeDefined();
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(mockWindow.setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('应该正确设置默认预设布局', () => {
      manager = new LayoutManager();
      
      // 获取所有预设
      const presets = manager.getPresets();
      expect(presets).toBeDefined();
      expect(presets.length).toBeGreaterThan(0);
      
      // 验证默认预设存在
      const defaultPreset = presets.find(p => p.id === 'default');
      expect(defaultPreset).toBeDefined();
      expect(defaultPreset?.isDefault).toBe(true);
      expect(defaultPreset?.isSystem).toBe(true);
      
      // 验证其他系统预设
      const systemPresetIds = ['compact', 'analysis', 'fullscreen-waveform'];
      systemPresetIds.forEach(id => {
        const preset = presets.find(p => p.id === id);
        expect(preset).toBeDefined();
        expect(preset?.isSystem).toBe(true);
      });
    });

    it('应该正确获取默认布局配置', () => {
      manager = new LayoutManager();
      
      const layout = manager.getCurrentLayout();
      expect(layout).toBeDefined();
      expect(layout.version).toBe('1.0');
      expect(layout.name).toBe('Default Layout');
      
      // 验证基本结构
      expect(layout.panels).toBeDefined();
      expect(layout.waveform).toBeDefined();
      expect(layout.channels).toBeDefined();
      expect(layout.decoderPanel).toBeDefined();
      expect(layout.window).toBeDefined();
      expect(layout.preferences).toBeDefined();
    });

  });

  describe('📊 面板布局管理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确更新面板布局配置', () => {
      const panelUpdate: Partial<PanelLayout> = {
        visible: false,
        width: 350
      };
      
      manager.updatePanelLayout('leftPanel', panelUpdate);
      
      const layout = manager.getCurrentLayout();
      expect(layout.panels.leftPanel.visible).toBe(false);
      expect(layout.panels.leftPanel.width).toBe(350);
    });

    it('应该正确处理无效面板ID的更新', () => {
      const panelUpdate: Partial<PanelLayout> = {
        visible: false
      };
      
      // 不应该抛出异常
      expect(() => {
        manager.updatePanelLayout('invalidPanel', panelUpdate);
      }).not.toThrow();
    });

    it('应该正确更新各种面板类型', () => {
      const panels = ['leftPanel', 'rightPanel', 'statusBar', 'toolbar'];
      
      panels.forEach((panelId, index) => {
        const panelUpdate: Partial<PanelLayout> = {
          width: 100 + index * 50,
          height: 50 + index * 10
        };
        
        manager.updatePanelLayout(panelId, panelUpdate);
        
        const layout = manager.getCurrentLayout();
        // 根据面板类型验证更新
        if (panelId === 'leftPanel') {
          expect(layout.panels.leftPanel.width).toBe(100);
        }
      });
    });

  });

  describe('🌊 波形视图状态管理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确更新波形视图状态', () => {
      const waveformUpdate: Partial<WaveformViewState> = {
        zoomLevel: 2.5,
        panOffset: 100,
        firstSample: 1000,
        visibleSamples: 5000,
        channelHeight: 40,
        showGrid: false,
        showTimeAxis: false,
        showSamplePoints: true
      };
      
      manager.updateWaveformState(waveformUpdate);
      
      const layout = manager.getCurrentLayout();
      expect(layout.waveform.zoomLevel).toBe(2.5);
      expect(layout.waveform.panOffset).toBe(100);
      expect(layout.waveform.firstSample).toBe(1000);
      expect(layout.waveform.visibleSamples).toBe(5000);
      expect(layout.waveform.channelHeight).toBe(40);
      expect(layout.waveform.showGrid).toBe(false);
      expect(layout.waveform.showTimeAxis).toBe(false);
      expect(layout.waveform.showSamplePoints).toBe(true);
    });

    it('应该正确处理部分波形状态更新', () => {
      const partialUpdate: Partial<WaveformViewState> = {
        zoomLevel: 5.0,
        showGrid: false
      };
      
      manager.updateWaveformState(partialUpdate);
      
      const layout = manager.getCurrentLayout();
      expect(layout.waveform.zoomLevel).toBe(5.0);
      expect(layout.waveform.showGrid).toBe(false);
      // 其他属性应该保持默认值
      expect(layout.waveform.panOffset).toBe(0);
      expect(layout.waveform.firstSample).toBe(0);
    });

  });

  describe('📺 通道可见性管理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确更新通道可见性', () => {
      const channelUpdate: Partial<ChannelVisibility> = {
        visible: false,
        color: '#FF0000',
        label: '自定义通道0'
      };
      
      manager.updateChannelVisibility(0, channelUpdate);
      
      const layout = manager.getCurrentLayout();
      const channel0 = layout.channels.find(ch => ch.channelId === 0);
      expect(channel0).toBeDefined();
      expect(channel0?.visible).toBe(false);
      expect(channel0?.color).toBe('#FF0000');
      expect(channel0?.label).toBe('自定义通道0');
    });

    it('应该正确处理多个通道的更新', () => {
      // 更新多个通道
      for (let i = 0; i < 5; i++) {
        manager.updateChannelVisibility(i, {
          visible: i % 2 === 0,
          color: `#${i}${i}${i}${i}${i}${i}`,
          label: `测试通道${i}`
        });
      }
      
      const layout = manager.getCurrentLayout();
      
      // 验证所有更新
      for (let i = 0; i < 5; i++) {
        const channel = layout.channels.find(ch => ch.channelId === i);
        expect(channel?.visible).toBe(i % 2 === 0);
        expect(channel?.color).toBe(`#${i}${i}${i}${i}${i}${i}`);
        expect(channel?.label).toBe(`测试通道${i}`);
      }
    });

    it('应该正确处理不存在通道的更新', () => {
      // 更新超出范围的通道ID
      expect(() => {
        manager.updateChannelVisibility(999, { visible: false });
      }).not.toThrow();
      
      // 验证没有影响现有通道
      const layout = manager.getCurrentLayout();
      expect(layout.channels.length).toBe(24); // 默认24个通道
    });

  });

  describe('🔧 解码器面板状态管理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确更新解码器面板状态', () => {
      const decoderUpdate: Partial<DecoderPanelState> = {
        activeTab: 'measurement',
        expandedDecoders: ['i2c', 'spi', 'uart'],
        selectedProtocols: ['I2C', 'SPI']
      };
      
      manager.updateDecoderPanelState(decoderUpdate);
      
      const layout = manager.getCurrentLayout();
      expect(layout.decoderPanel.activeTab).toBe('measurement');
      expect(layout.decoderPanel.expandedDecoders).toEqual(['i2c', 'spi', 'uart']);
      expect(layout.decoderPanel.selectedProtocols).toEqual(['I2C', 'SPI']);
    });

    it('应该正确处理部分解码器状态更新', () => {
      const partialUpdate: Partial<DecoderPanelState> = {
        activeTab: 'analysis'
      };
      
      manager.updateDecoderPanelState(partialUpdate);
      
      const layout = manager.getCurrentLayout();
      expect(layout.decoderPanel.activeTab).toBe('analysis');
      // 其他属性应该保持默认值
      expect(layout.decoderPanel.expandedDecoders).toEqual([]);
      expect(layout.decoderPanel.selectedProtocols).toEqual([]);
    });

  });

  describe('💾 存储和加载管理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确保存当前布局到localStorage', () => {
      // 修改布局
      manager.updateWaveformState({
        zoomLevel: 3.0,
        showGrid: false
      });
      
      // 保存布局
      const result = manager.saveCurrentLayout();
      expect(result).toBe(true);
      
      // 验证localStorage被调用
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'logic-analyzer-layout',
        expect.any(String)
      );
    });

    it('应该正确从localStorage加载布局', () => {
      // 准备测试数据
      const testLayout: ApplicationLayout = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        name: 'Test Layout',
        panels: {
          leftPanel: { id: 'left-panel', visible: false, width: 250, position: 'left', order: 0 },
          rightPanel: { id: 'right-panel', visible: true, width: 300, position: 'right', order: 1 },
          statusBar: { id: 'status-bar', visible: true, height: 28, position: 'bottom', order: 2 },
          toolbar: { id: 'toolbar', visible: true, height: 44, position: 'top', order: 0 }
        },
        waveform: {
          zoomLevel: 2.0,
          panOffset: 50,
          firstSample: 500,
          visibleSamples: 2000,
          channelHeight: 35,
          showGrid: false,
          showTimeAxis: true,
          showSamplePoints: true
        },
        channels: [
          { channelId: 0, visible: true, color: '#FF0000', label: 'Test CH0', order: 0 }
        ],
        decoderPanel: {
          activeTab: 'test',
          expandedDecoders: ['test-decoder'],
          selectedProtocols: ['TEST']
        },
        window: {
          width: 1400,
          height: 900,
          maximized: true
        },
        preferences: {
          theme: 'dark',
          language: 'en-US',
          autoSave: false,
          showTooltips: false,
          animationsEnabled: false
        }
      };
      
      // 模拟localStorage数据
      mockLocalStorage.storage.set('logic-analyzer-layout', JSON.stringify(testLayout));
      
      // 加载布局
      const loadedLayout = manager.loadLayout();
      
      expect(loadedLayout).toBeDefined();
      expect(loadedLayout?.name).toBe('Test Layout');
      expect(loadedLayout?.waveform.zoomLevel).toBe(2.0);
      expect(loadedLayout?.panels.leftPanel.visible).toBe(false);
    });

    it('应该正确处理localStorage加载错误', () => {
      // 模拟无效数据
      mockLocalStorage.storage.set('logic-analyzer-layout', 'invalid-json');
      
      const result = manager.loadLayout();
      expect(result).toBeNull();
    });

    it('应该正确处理版本不兼容的布局', () => {
      const oldVersionLayout = {
        version: '0.5', // 旧版本
        name: 'Old Layout'
      };
      
      mockLocalStorage.storage.set('logic-analyzer-layout', JSON.stringify(oldVersionLayout));
      
      const result = manager.loadLayout();
      expect(result).toBeNull();
    });

  });

  describe('🎨 预设布局管理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确应用预设布局', () => {
      const result = manager.applyPreset('compact');
      expect(result).toBe(true);
      
      const layout = manager.getCurrentLayout();
      expect(layout.panels.leftPanel.visible).toBe(false);
    });

    it('应该正确处理无效预设ID', () => {
      const result = manager.applyPreset('non-existent-preset');
      expect(result).toBe(false);
    });

    it('应该正确保存用户自定义预设', () => {
      // 修改当前布局
      manager.updateWaveformState({ zoomLevel: 4.0 });
      
      // 保存为预设
      const presetId = manager.saveAsPreset('我的预设', '自定义测试预设');
      
      expect(presetId).toMatch(/^user-\d+$/);
      
      // 验证预设被保存
      const presets = manager.getPresets();
      const userPreset = presets.find(p => p.id === presetId);
      expect(userPreset).toBeDefined();
      expect(userPreset?.name).toBe('我的预设');
      expect(userPreset?.description).toBe('自定义测试预设');
      expect(userPreset?.isSystem).toBe(false);
    });

    it('应该正确删除用户预设', () => {
      // 创建用户预设
      const presetId = manager.saveAsPreset('待删除预设');
      
      // 删除预设
      const result = manager.deletePreset(presetId);
      expect(result).toBe(true);
      
      // 验证预设被删除
      const presets = manager.getPresets();
      const deletedPreset = presets.find(p => p.id === presetId);
      expect(deletedPreset).toBeUndefined();
    });

    it('应该拒绝删除系统预设', () => {
      const result = manager.deletePreset('default');
      expect(result).toBe(false);
      
      // 验证系统预设仍然存在
      const presets = manager.getPresets();
      const systemPreset = presets.find(p => p.id === 'default');
      expect(systemPreset).toBeDefined();
    });

    it('应该正确排序预设列表', () => {
      // 添加用户预设
      manager.saveAsPreset('Z用户预设');
      manager.saveAsPreset('A用户预设');
      
      const presets = manager.getPresets();
      
      // 系统预设应该在前面
      const systemCount = presets.filter(p => p.isSystem).length;
      expect(systemCount).toBe(4); // default, compact, analysis, fullscreen-waveform
      
      // 前几个应该是系统预设
      for (let i = 0; i < systemCount; i++) {
        expect(presets[i].isSystem).toBe(true);
      }
    });

  });

  describe('📤 导入导出功能测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确导出布局配置', () => {
      // 修改布局
      manager.updateWaveformState({ zoomLevel: 2.5 });
      manager.saveAsPreset('导出测试预设');
      
      const exportData = manager.exportLayout();
      
      expect(exportData).toBeDefined();
      expect(typeof exportData).toBe('string');
      
      // 验证导出数据可以解析
      const parsed = JSON.parse(exportData);
      expect(parsed.version).toBe('1.0');
      expect(parsed.layout).toBeDefined();
      expect(parsed.presets).toBeDefined();
    });

    it('应该正确导入布局配置', () => {
      const importData = {
        version: '1.0',
        layout: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          name: '导入的布局',
          panels: {
            leftPanel: { id: 'left-panel', visible: false, position: 'left', order: 0 },
            rightPanel: { id: 'right-panel', visible: true, position: 'right', order: 1 },
            statusBar: { id: 'status-bar', visible: true, position: 'bottom', order: 2 },
            toolbar: { id: 'toolbar', visible: true, position: 'top', order: 0 }
          },
          waveform: {
            zoomLevel: 3.5,
            panOffset: 0,
            firstSample: 0,
            visibleSamples: 1000,
            channelHeight: 30,
            showGrid: true,
            showTimeAxis: true,
            showSamplePoints: false
          },
          channels: [],
          decoderPanel: {
            activeTab: 'import-test',
            expandedDecoders: [],
            selectedProtocols: []
          },
          window: { width: 1200, height: 800, maximized: false },
          preferences: {
            theme: 'light' as const,
            language: 'zh-CN',
            autoSave: true,
            showTooltips: true,
            animationsEnabled: true
          }
        },
        presets: [
          {
            id: 'imported-preset',
            name: '导入的预设',
            description: '测试导入预设',
            layout: {} as ApplicationLayout,
            isDefault: false,
            isSystem: false
          }
        ]
      };
      
      const result = manager.importLayout(JSON.stringify(importData));
      expect(result).toBe(true);
      
      // 验证导入结果
      const layout = manager.getCurrentLayout();
      expect(layout.name).toBe('导入的布局');
      expect(layout.waveform.zoomLevel).toBe(3.5);
      expect(layout.decoderPanel.activeTab).toBe('import-test');
      
      // 验证预设被导入
      const presets = manager.getPresets();
      const importedPreset = presets.find(p => p.id === 'imported-preset');
      expect(importedPreset).toBeDefined();
    });

    it('应该正确处理导入错误', () => {
      const result = manager.importLayout('invalid-json');
      expect(result).toBe(false);
    });

    it('应该正确处理部分导入数据', () => {
      const partialImport = {
        layout: {
          version: '1.0',
          timestamp: new Date().toISOString(),
          name: '部分导入',
          panels: {
            leftPanel: { id: 'left-panel', visible: true, position: 'left' as const, order: 0 },
            rightPanel: { id: 'right-panel', visible: true, position: 'right' as const, order: 1 },
            statusBar: { id: 'status-bar', visible: true, position: 'bottom' as const, order: 2 },
            toolbar: { id: 'toolbar', visible: true, position: 'top' as const, order: 0 }
          },
          waveform: {
            zoomLevel: 1,
            panOffset: 0,
            firstSample: 0,
            visibleSamples: 1000,
            channelHeight: 30,
            showGrid: true,
            showTimeAxis: true,
            showSamplePoints: false
          },
          channels: [],
          decoderPanel: {
            activeTab: 'decoder',
            expandedDecoders: [],
            selectedProtocols: []
          },
          window: { width: 1200, height: 800, maximized: false },
          preferences: {
            theme: 'auto' as const,
            language: 'zh-CN',
            autoSave: true,
            showTooltips: true,
            animationsEnabled: true
          }
        }
      };
      
      const result = manager.importLayout(JSON.stringify(partialImport));
      expect(result).toBe(true);
      
      const layout = manager.getCurrentLayout();
      expect(layout.name).toBe('部分导入');
    });

  });

  describe('⚙️ 自动保存功能测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确设置自动保存开关', () => {
      manager.setAutoSave(false);
      
      const layout = manager.getCurrentLayout();
      expect(layout.preferences.autoSave).toBe(false);
      
      manager.setAutoSave(true);
      
      const updatedLayout = manager.getCurrentLayout();
      expect(updatedLayout.preferences.autoSave).toBe(true);
    });

    it('应该在启用自动保存时触发定时保存', () => {
      manager.setAutoSave(true);
      
      // 修改布局触发自动保存计划
      manager.updateWaveformState({ zoomLevel: 2.0 });
      
      // 快进定时器
      jest.advanceTimersByTime(1000);
      
      // 验证保存被调用
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('应该在禁用自动保存时不触发保存', () => {
      manager.setAutoSave(false);
      
      // 清除之前的mock调用
      mockLocalStorage.setItem.mockClear();
      
      // 修改布局
      manager.updateWaveformState({ zoomLevel: 3.0 });
      
      // 快进定时器
      jest.advanceTimersByTime(1000);
      
      // 由于自动保存被禁用，不应该调用保存
      // 注意：setAutoSave本身会调用updateLayout导致一次保存
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1); // 只有setAutoSave调用
    });

  });

  describe('🔄 重置和恢复功能测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确重置为默认布局', () => {
      // 修改当前布局
      manager.updateWaveformState({ zoomLevel: 5.0 });
      manager.updatePanelLayout('leftPanel', { visible: false });
      
      // 重置为默认
      manager.resetToDefault();
      
      const layout = manager.getCurrentLayout();
      expect(layout.name).toBe('Default Layout');
      expect(layout.waveform.zoomLevel).toBe(1);
      expect(layout.panels.leftPanel.visible).toBe(true);
    });

  });

  describe('🧹 边界条件和错误处理测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该处理localStorage保存失败', () => {
      // 模拟localStorage抛出异常
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const result = manager.saveCurrentLayout();
      expect(result).toBe(false);
    });

    it('应该处理localStorage加载失败', () => {
      // 模拟localStorage抛出异常
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      const result = manager.loadLayout();
      expect(result).toBeNull();
    });

    it('应该处理空布局更新', () => {
      expect(() => {
        manager.updateLayout({});
      }).not.toThrow();
    });

    it('应该处理负的通道ID', () => {
      expect(() => {
        manager.updateChannelVisibility(-1, { visible: false });
      }).not.toThrow();
    });

    it('应该正确处理销毁管理器', () => {
      // 触发一些定时器
      manager.updateWaveformState({ zoomLevel: 2.0 });
      
      // 销毁管理器
      manager.destroy();
      
      // 验证清理工作
      expect(mockWindow.clearInterval).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalled(); // 最终保存
    });

  });

  describe('⚡ 性能和内存管理测试', () => {

    it('应该正确处理大量布局更新', () => {
      manager = new LayoutManager();
      
      const startTime = Date.now();
      
      // 执行大量更新
      for (let i = 0; i < 100; i++) {
        manager.updateWaveformState({ zoomLevel: i });
        manager.updateChannelVisibility(i % 24, { visible: i % 2 === 0 });
      }
      
      const endTime = Date.now();
      
      // 验证性能
      expect(endTime - startTime).toBeLessThan(1000); // 不超过1秒
      
      // 验证最终状态
      const layout = manager.getCurrentLayout();
      expect(layout.waveform.zoomLevel).toBe(99);
    });

    it('应该正确处理深度拷贝防止外部修改', () => {
      manager = new LayoutManager();
      
      const layout1 = manager.getCurrentLayout();
      const layout2 = manager.getCurrentLayout();
      
      // 修改layout1不应该影响layout2
      layout1.waveform.zoomLevel = 999;
      expect(layout2.waveform.zoomLevel).toBe(1);
      
      // 修改layout1不应该影响manager的内部状态
      manager.updateWaveformState({ zoomLevel: 2.0 });
      const layout3 = manager.getCurrentLayout();
      expect(layout3.waveform.zoomLevel).toBe(2.0);
    });

  });

  describe('🎛️ 复杂场景集成测试', () => {

    beforeEach(() => {
      manager = new LayoutManager();
    });

    it('应该正确处理完整的工作流程', () => {
      // 1. 修改各种设置
      manager.updateWaveformState({
        zoomLevel: 2.0,
        showGrid: false
      });
      
      manager.updateChannelVisibility(0, {
        visible: false,
        color: '#FF0000'
      });
      
      manager.updatePanelLayout('leftPanel', {
        width: 350
      });
      
      // 2. 保存为预设
      const presetId = manager.saveAsPreset('工作流程测试');
      
      // 3. 重置为默认
      manager.resetToDefault();
      
      // 4. 应用预设
      manager.applyPreset(presetId);
      
      // 5. 验证恢复状态
      const layout = manager.getCurrentLayout();
      expect(layout.waveform.zoomLevel).toBe(2.0);
      expect(layout.waveform.showGrid).toBe(false);
      expect(layout.panels.leftPanel.width).toBe(350);
      
      const channel0 = layout.channels.find(ch => ch.channelId === 0);
      expect(channel0?.visible).toBe(false);
      expect(channel0?.color).toBe('#FF0000');
    });

    it('应该正确处理导入导出完整流程', () => {
      // 1. 创建复杂配置
      manager.updateWaveformState({ zoomLevel: 3.0 });
      manager.saveAsPreset('导出测试1');
      manager.saveAsPreset('导出测试2');
      
      // 2. 导出配置
      const exportData = manager.exportLayout();
      
      // 3. 重置为默认
      manager.resetToDefault();
      
      // 4. 导入配置
      const importResult = manager.importLayout(exportData);
      expect(importResult).toBe(true);
      
      // 5. 验证导入结果
      const layout = manager.getCurrentLayout();
      expect(layout.waveform.zoomLevel).toBe(3.0);
      
      const presets = manager.getPresets();
      const importedPresets = presets.filter(p => p.name.startsWith('导出测试'));
      expect(importedPresets.length).toBe(2);
    });

  });

});