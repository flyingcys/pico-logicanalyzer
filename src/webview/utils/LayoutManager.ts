/**
 * 界面布局管理器
 * 支持保存和恢复用户的界面布局配置
 */

export interface PanelLayout {
  id: string;
  visible: boolean;
  width?: number;
  height?: number;
  position?: 'left' | 'right' | 'top' | 'bottom';
  order?: number;
}

export interface WaveformViewState {
  zoomLevel: number;
  panOffset: number;
  firstSample: number;
  visibleSamples: number;
  channelHeight: number;
  showGrid: boolean;
  showTimeAxis: boolean;
  showSamplePoints: boolean;
}

export interface ChannelVisibility {
  channelId: number;
  visible: boolean;
  color?: string;
  label?: string;
  order?: number;
}

export interface DecoderPanelState {
  activeTab: string;
  expandedDecoders: string[];
  selectedProtocols: string[];
}

export interface ApplicationLayout {
  version: string;
  timestamp: string;
  name: string;
  description?: string;

  // 面板布局
  panels: {
    leftPanel: PanelLayout;
    rightPanel: PanelLayout;
    statusBar: PanelLayout;
    toolbar: PanelLayout;
  };

  // 波形视图状态
  waveform: WaveformViewState;

  // 通道状态
  channels: ChannelVisibility[];

  // 解码器面板状态
  decoderPanel: DecoderPanelState;

  // 窗口状态
  window: {
    width: number;
    height: number;
    maximized: boolean;
  };

  // 用户偏好
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    autoSave: boolean;
    showTooltips: boolean;
    animationsEnabled: boolean;
  };
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  layout: ApplicationLayout;
  isDefault: boolean;
  isSystem: boolean;
}

export class LayoutManager {
  private static readonly STORAGE_KEY = 'logic-analyzer-layout';
  private static readonly PRESETS_KEY = 'logic-analyzer-layout-presets';
  private static readonly VERSION = '1.0';

  private currentLayout: ApplicationLayout | null = null;
  private presets: Map<string, LayoutPreset> = new Map();
  private autoSaveEnabled = true;
  private autoSaveTimer: number | null = null;

  constructor() {
    this.loadPresets();
    this.setupDefaultPresets();
    this.setupAutoSave();
  }

  /**
   * 获取默认布局配置
   */
  private getDefaultLayout(): ApplicationLayout {
    return {
      version: LayoutManager.VERSION,
      timestamp: new Date().toISOString(),
      name: 'Default Layout',

      panels: {
        leftPanel: {
          id: 'left-panel',
          visible: true,
          width: 300,
          position: 'left',
          order: 0
        },
        rightPanel: {
          id: 'right-panel',
          visible: true,
          width: 400,
          position: 'right',
          order: 1
        },
        statusBar: {
          id: 'status-bar',
          visible: true,
          height: 32,
          position: 'bottom',
          order: 2
        },
        toolbar: {
          id: 'toolbar',
          visible: true,
          height: 48,
          position: 'top',
          order: 0
        }
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

      channels: Array.from({ length: 24 }, (_, i) => ({
        channelId: i,
        visible: i < 8, // 默认显示前8个通道
        color: `hsl(${(i * 360) / 24}, 70%, 50%)`,
        label: `CH${i}`,
        order: i
      })),

      decoderPanel: {
        activeTab: 'decoder',
        expandedDecoders: [],
        selectedProtocols: []
      },

      window: {
        width: 1200,
        height: 800,
        maximized: false
      },

      preferences: {
        theme: 'auto',
        language: 'zh-CN',
        autoSave: true,
        showTooltips: true,
        animationsEnabled: true
      }
    };
  }

  /**
   * 设置默认预设
   */
  private setupDefaultPresets() {
    const presets: LayoutPreset[] = [
      {
        id: 'default',
        name: '默认布局',
        description: '标准的三面板布局，适合大多数使用场景',
        layout: this.getDefaultLayout(),
        isDefault: true,
        isSystem: true
      },
      {
        id: 'compact',
        name: '紧凑布局',
        description: '隐藏左面板，适合小屏幕或专注于波形分析',
        layout: {
          ...this.getDefaultLayout(),
          panels: {
            ...this.getDefaultLayout().panels,
            leftPanel: { ...this.getDefaultLayout().panels.leftPanel, visible: false }
          }
        },
        isDefault: false,
        isSystem: true
      },
      {
        id: 'analysis',
        name: '分析布局',
        description: '加宽右面板，适合使用多个解码器进行深度分析',
        layout: {
          ...this.getDefaultLayout(),
          panels: {
            ...this.getDefaultLayout().panels,
            rightPanel: { ...this.getDefaultLayout().panels.rightPanel, width: 500 }
          }
        },
        isDefault: false,
        isSystem: true
      },
      {
        id: 'fullscreen-waveform',
        name: '全屏波形',
        description: '隐藏侧面板，专注于波形显示',
        layout: {
          ...this.getDefaultLayout(),
          panels: {
            ...this.getDefaultLayout().panels,
            leftPanel: { ...this.getDefaultLayout().panels.leftPanel, visible: false },
            rightPanel: { ...this.getDefaultLayout().panels.rightPanel, visible: false }
          }
        },
        isDefault: false,
        isSystem: true
      }
    ];

    presets.forEach(preset => {
      this.presets.set(preset.id, preset);
    });
  }

  /**
   * 设置自动保存
   */
  private setupAutoSave() {
    // 监听窗口关闭事件
    window.addEventListener('beforeunload', () => {
      this.saveCurrentLayout();
    });

    // 定期自动保存
    this.autoSaveTimer = window.setInterval(() => {
      if (this.autoSaveEnabled && this.currentLayout) {
        this.saveCurrentLayout();
      }
    }, 30000); // 30秒自动保存
  }

  /**
   * 加载预设
   */
  private loadPresets() {
    try {
      const presetsData = localStorage.getItem(LayoutManager.PRESETS_KEY);
      if (presetsData) {
        const presets = JSON.parse(presetsData) as LayoutPreset[];
        presets.forEach(preset => {
          if (!preset.isSystem) { // 只加载用户预设
            this.presets.set(preset.id, preset);
          }
        });
      }
    } catch (error) {
      console.warn('加载布局预设失败:', error);
    }
  }

  /**
   * 保存预设
   */
  private savePresets() {
    try {
      const userPresets = Array.from(this.presets.values())
        .filter(preset => !preset.isSystem);

      localStorage.setItem(LayoutManager.PRESETS_KEY, JSON.stringify(userPresets));
    } catch (error) {
      console.error('保存布局预设失败:', error);
    }
  }

  /**
   * 获取当前布局
   */
  public getCurrentLayout(): ApplicationLayout {
    if (!this.currentLayout) {
      this.currentLayout = this.loadLayout() || this.getDefaultLayout();
    }
    // 返回深拷贝以防止外部修改影响内部状态
    return JSON.parse(JSON.stringify(this.currentLayout));
  }

  /**
   * 更新当前布局
   */
  public updateLayout(updates: Partial<ApplicationLayout>) {
    if (!this.currentLayout) {
      this.currentLayout = this.getDefaultLayout();
    }

    this.currentLayout = {
      ...this.currentLayout,
      ...updates,
      timestamp: new Date().toISOString()
    };

    if (this.autoSaveEnabled) {
      this.scheduleAutoSave();
    }
  }

  /**
   * 更新面板布局
   */
  public updatePanelLayout(panelId: string, layout: Partial<PanelLayout>) {
    const current = this.getCurrentLayout();
    const panelKey = `${panelId}` as keyof typeof current.panels;

    if (current.panels[panelKey]) {
      current.panels[panelKey] = {
        ...current.panels[panelKey],
        ...layout
      };

      this.updateLayout({ panels: current.panels });
    }
  }

  /**
   * 更新波形视图状态
   */
  public updateWaveformState(state: Partial<WaveformViewState>) {
    const current = this.getCurrentLayout();
    this.updateLayout({
      waveform: { ...current.waveform, ...state }
    });
  }

  /**
   * 更新通道可见性
   */
  public updateChannelVisibility(channelId: number, updates: Partial<ChannelVisibility>) {
    const current = this.getCurrentLayout();
    const channels = [...current.channels];
    const channelIndex = channels.findIndex(ch => ch.channelId === channelId);

    if (channelIndex >= 0) {
      channels[channelIndex] = { ...channels[channelIndex], ...updates };
      this.updateLayout({ channels });
    }
  }

  /**
   * 更新解码器面板状态
   */
  public updateDecoderPanelState(state: Partial<DecoderPanelState>) {
    const current = this.getCurrentLayout();
    this.updateLayout({
      decoderPanel: { ...current.decoderPanel, ...state }
    });
  }

  /**
   * 保存当前布局
   */
  public saveCurrentLayout(): boolean {
    try {
      if (this.currentLayout) {
        localStorage.setItem(LayoutManager.STORAGE_KEY, JSON.stringify(this.currentLayout));
        return true;
      }
      return false;
    } catch (error) {
      console.error('保存布局失败:', error);
      return false;
    }
  }

  /**
   * 加载保存的布局
   */
  public loadLayout(): ApplicationLayout | null {
    try {
      const layoutData = localStorage.getItem(LayoutManager.STORAGE_KEY);
      if (layoutData) {
        const layout = JSON.parse(layoutData) as ApplicationLayout;

        // 版本兼容性检查
        if (layout.version === LayoutManager.VERSION) {
          this.currentLayout = layout;
          return layout;
        } else {
          console.warn('布局版本不兼容，使用默认布局');
        }
      }
    } catch (error) {
      console.error('加载布局失败:', error);
    }

    return null;
  }

  /**
   * 应用预设布局
   */
  public applyPreset(presetId: string): boolean {
    const preset = this.presets.get(presetId);
    if (preset) {
      this.currentLayout = {
        ...preset.layout,
        timestamp: new Date().toISOString()
      };
      this.saveCurrentLayout();
      return true;
    }
    return false;
  }

  /**
   * 保存为预设
   */
  public saveAsPreset(name: string, description: string = ''): string {
    const id = `user-${Date.now()}`;
    const preset: LayoutPreset = {
      id,
      name,
      description,
      layout: { ...this.getCurrentLayout(), name },
      isDefault: false,
      isSystem: false
    };

    this.presets.set(id, preset);
    this.savePresets();
    return id;
  }

  /**
   * 删除预设
   */
  public deletePreset(presetId: string): boolean {
    const preset = this.presets.get(presetId);
    if (preset && !preset.isSystem) {
      this.presets.delete(presetId);
      this.savePresets();
      return true;
    }
    return false;
  }

  /**
   * 获取所有预设
   */
  public getPresets(): LayoutPreset[] {
    return Array.from(this.presets.values())
      .sort((a, b) => {
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  /**
   * 重置为默认布局
   */
  public resetToDefault() {
    this.currentLayout = this.getDefaultLayout();
    this.saveCurrentLayout();
  }

  /**
   * 导出布局配置
   */
  public exportLayout(): string {
    const exportData = {
      version: LayoutManager.VERSION,
      timestamp: new Date().toISOString(),
      layout: this.getCurrentLayout(),
      presets: Array.from(this.presets.values()).filter(p => !p.isSystem)
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入布局配置
   */
  public importLayout(data: string): boolean {
    try {
      const importData = JSON.parse(data);

      if (importData.layout) {
        this.currentLayout = importData.layout;
        this.saveCurrentLayout();
      }

      if (importData.presets && Array.isArray(importData.presets)) {
        importData.presets.forEach((preset: LayoutPreset) => {
          if (!preset.isSystem) {
            this.presets.set(preset.id, preset);
          }
        });
        this.savePresets();
      }

      return true;
    } catch (error) {
      console.error('导入布局配置失败:', error);
      return false;
    }
  }

  /**
   * 计划自动保存
   */
  private scheduleAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    this.autoSaveTimer = window.setTimeout(() => {
      this.saveCurrentLayout();
    }, 1000); // 1秒后保存
  }

  /**
   * 设置自动保存开关
   */
  public setAutoSave(enabled: boolean) {
    this.autoSaveEnabled = enabled;

    // 始终更新偏好设置，无论启用还是禁用
    const current = this.getCurrentLayout();
    this.updateLayout({
      preferences: { ...current.preferences, autoSave: enabled }
    });
  }

  /**
   * 销毁管理器
   */
  public destroy() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.saveCurrentLayout();
  }
}

// 全局实例
export const layoutManager = new LayoutManager();
