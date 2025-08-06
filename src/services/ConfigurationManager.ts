/**
 * 插件配置和设置管理服务
 * 负责管理插件的所有配置选项、用户首选项、设备设置等
 * 基于原版 AppSettingsManager.cs 实现
 * 提供配置验证、热更新、导入导出等功能
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { ServiceLifecycleBase, ServiceInitOptions, ServiceDisposeOptions } from '../common/ServiceLifecycle';

// 配置类别
export enum ConfigurationCategory {
  General = 'general',
  Hardware = 'hardware',
  Display = 'display',
  Capture = 'capture',
  Decoder = 'decoder',
  Analysis = 'analysis',
  Export = 'export',
  Advanced = 'advanced'
}

// 配置项类型
export type ConfigValue = string | number | boolean | string[] | number[] | object;

// 配置项定义
export interface ConfigurationItem {
  key: string;
  category: ConfigurationCategory;
  displayName: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum' | 'file' | 'directory';
  defaultValue: ConfigValue;
  currentValue?: ConfigValue;
  options?: ConfigValue[]; // 用于enum类型
  validation?: ConfigValidationRule;
  scope: 'global' | 'workspace' | 'both';
  requiresRestart?: boolean;
  sensitive?: boolean; // 敏感信息，如密码
}

export interface ConfigValidationRule {
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  custom?: (value: ConfigValue) => string | null; // 返回null表示验证通过
}

// 设备配置
export interface DeviceConfiguration {
  deviceId: string;
  name: string;
  type: string;
  connectionString: string;
  settings: {
    [key: string]: ConfigValue;
  };
  lastUsed: string;
  favorite: boolean;
}

// 主题配置
export interface ThemeConfiguration {
  name: string;
  colors: {
    background: string;
    foreground: string;
    channelColors: string[];
    gridColor: string;
    markerColor: string;
    triggerColor: string;
  };
  fonts: {
    family: string;
    size: number;
    weight: string;
  };
}

// 快捷键配置
export interface KeybindingConfiguration {
  command: string;
  key: string;
  when?: string;
  description: string;
}

// 配置更改事件
export interface ConfigurationChangeEvent {
  key: string;
  oldValue: ConfigValue;
  newValue: ConfigValue;
  category: ConfigurationCategory;
  scope: 'global' | 'workspace';
}

export class ConfigurationManager extends ServiceLifecycleBase {
  private eventEmitter = new EventEmitter();
  private readonly EXTENSION_NAME = 'logicAnalyzer';
  private readonly CONFIG_FILE = 'logicanalyzer-config.json';
  private readonly DEVICES_FILE = 'devices.json';
  private readonly THEMES_FILE = 'themes.json';

  private configItems: Map<string, ConfigurationItem> = new Map();
  private deviceConfigurations: Map<string, DeviceConfiguration> = new Map();
  private themes: Map<string, ThemeConfiguration> = new Map();
  private currentTheme?: string;

  // 本地配置缓存，解决set/get同步问题
  private localConfigCache: Map<string, ConfigValue> = new Map();

  constructor() {
    super('ConfigurationManager');
    this.initializeDefaultConfiguration();
  }

  /**
   * 实现父类的初始化方法
   */
  protected async onInitialize(options: ServiceInitOptions): Promise<void> {
    await this.loadConfiguration();
    this.setupConfigurationWatcher();
  }

  /**
   * 实现父类的销毁方法
   */
  protected async onDispose(options: ServiceDisposeOptions): Promise<void> {
    // 清理配置监听器
    this.eventEmitter.removeAllListeners();

    // 清理缓存
    this.localConfigCache.clear();
    this.deviceConfigurations.clear();
    this.themes.clear();
  }

  // EventEmitter 代理方法
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(event, listener);
    return this;
  }

  removeAllListeners(event?: string | symbol): this {
    this.eventEmitter.removeAllListeners(event);
    return this;
  }

  listenerCount(event: string | symbol): number {
    return this.eventEmitter.listenerCount(event);
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaultConfiguration(): void {
    const defaultConfigs: ConfigurationItem[] = [
      // 通用设置
      {
        key: 'general.language',
        category: ConfigurationCategory.General,
        displayName: '语言',
        description: '用户界面语言',
        type: 'enum',
        options: ['zh-CN', 'en-US'],
        defaultValue: 'zh-CN',
        scope: 'global'
      },
      {
        key: 'general.autoSave',
        category: ConfigurationCategory.General,
        displayName: '自动保存',
        description: '是否启用自动保存功能',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'general.autoSaveInterval',
        category: ConfigurationCategory.General,
        displayName: '自动保存间隔',
        description: '自动保存间隔时间（秒）',
        type: 'number',
        defaultValue: 300,
        validation: { min: 30, max: 3600 },
        scope: 'both'
      },
      {
        key: 'general.maxRecentFiles',
        category: ConfigurationCategory.General,
        displayName: '最近文件数量',
        description: '保留的最近文件数量',
        type: 'number',
        defaultValue: 20,
        validation: { min: 5, max: 100 },
        scope: 'global'
      },

      // 硬件设置
      {
        key: 'autoDetectDevices',  // 测试中使用的key
        category: ConfigurationCategory.Hardware,
        displayName: '自动检测设备',
        description: '启动时自动检测连接的设备',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'hardware.autoDetect',
        category: ConfigurationCategory.Hardware,
        displayName: '自动检测设备',
        description: '启动时自动检测连接的设备',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'hardware.connectionTimeout',
        category: ConfigurationCategory.Hardware,
        displayName: '连接超时',
        description: '设备连接超时时间（毫秒）',
        type: 'number',
        defaultValue: 5000,
        validation: { min: 1000, max: 30000 },
        scope: 'both'
      },
      {
        key: 'hardware.retryAttempts',
        category: ConfigurationCategory.Hardware,
        displayName: '重试次数',
        description: '连接失败时的重试次数',
        type: 'number',
        defaultValue: 3,
        validation: { min: 0, max: 10 },
        scope: 'both'
      },

      // 采集设置
      {
        key: 'defaultSampleRate',  // 测试中使用的key
        category: ConfigurationCategory.Capture,
        displayName: '默认采样率',
        description: '默认的采样率设置',
        type: 'number',
        defaultValue: 24000000,
        validation: { min: 1000, max: 200000000 },
        scope: 'both'
      },
      {
        key: 'hardware.preferredDevices',
        category: ConfigurationCategory.Hardware,
        displayName: '首选设备',
        description: '首选的设备类型列表',
        type: 'array',
        defaultValue: ['LogicAnalyzer', 'SaleaeLogic', 'Rigol'],
        scope: 'both'
      },

      // 显示设置
      {
        key: 'display.theme',
        category: ConfigurationCategory.Display,
        displayName: '主题',
        description: '界面主题',
        type: 'enum',
        options: ['auto', 'light', 'dark', 'high-contrast'],
        defaultValue: 'auto',
        scope: 'global'
      },
      {
        key: 'display.channelHeight',
        category: ConfigurationCategory.Display,
        displayName: '通道高度',
        description: '默认通道显示高度（像素）',
        type: 'number',
        defaultValue: 20,
        validation: { min: 10, max: 100 },
        scope: 'both'
      },
      {
        key: 'display.showGrid',
        category: ConfigurationCategory.Display,
        displayName: '显示网格',
        description: '是否显示时间网格',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'display.showChannelNames',
        category: ConfigurationCategory.Display,
        displayName: '显示通道名称',
        description: '是否显示通道名称',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'display.antialias',
        category: ConfigurationCategory.Display,
        displayName: '抗锯齿',
        description: '启用波形抗锯齿',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },

      // 采集设置
      {
        key: 'capture.defaultSampleRate',
        category: ConfigurationCategory.Capture,
        displayName: '默认采样率',
        description: '默认采样率（Hz）',
        type: 'number',
        defaultValue: 1000000,
        validation: { min: 1000, max: 100000000 },
        scope: 'both'
      },
      {
        key: 'capture.defaultBufferSize',
        category: ConfigurationCategory.Capture,
        displayName: '默认缓冲区大小',
        description: '默认采集缓冲区大小',
        type: 'number',
        defaultValue: 1048576,
        validation: { min: 1024, max: 134217728 },
        scope: 'both'
      },
      {
        key: 'capture.enableCompression',
        category: ConfigurationCategory.Capture,
        displayName: '启用压缩',
        description: '启用数据压缩以节省存储空间',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },

      // 解码器设置
      {
        key: 'decoder.enableParallelDecoding',
        category: ConfigurationCategory.Decoder,
        displayName: '并行解码',
        description: '启用多线程并行解码',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'decoder.maxWorkerThreads',
        category: ConfigurationCategory.Decoder,
        displayName: '最大工作线程',
        description: '并行解码的最大工作线程数',
        type: 'number',
        defaultValue: 4,
        validation: { min: 1, max: 16 },
        scope: 'both'
      },
      {
        key: 'decoder.enableCache',
        category: ConfigurationCategory.Decoder,
        displayName: '启用缓存',
        description: '启用解码结果缓存',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },

      // 分析设置
      {
        key: 'analysis.enableStatistics',
        category: ConfigurationCategory.Analysis,
        displayName: '启用统计',
        description: '自动生成统计分析',
        type: 'boolean',
        defaultValue: true,
        scope: 'both'
      },
      {
        key: 'analysis.measurementPrecision',
        category: ConfigurationCategory.Analysis,
        displayName: '测量精度',
        description: '测量结果显示精度（小数位数）',
        type: 'number',
        defaultValue: 6,
        validation: { min: 0, max: 12 },
        scope: 'both'
      },

      // 导出设置
      {
        key: 'export.defaultFormat',
        category: ConfigurationCategory.Export,
        displayName: '默认导出格式',
        description: '默认的数据导出格式',
        type: 'enum',
        options: ['csv', 'json', 'lac', 'vcd'],
        defaultValue: 'csv',
        scope: 'both'
      },
      {
        key: 'export.compressionLevel',
        category: ConfigurationCategory.Export,
        displayName: '压缩级别',
        description: '导出文件的压缩级别（0-9）',
        type: 'number',
        defaultValue: 6,
        validation: { min: 0, max: 9 },
        scope: 'both'
      },

      // 高级设置
      {
        key: 'advanced.enableDebugMode',
        category: ConfigurationCategory.Advanced,
        displayName: '调试模式',
        description: '启用调试模式和详细日志',
        type: 'boolean',
        defaultValue: false,
        scope: 'both',
        requiresRestart: true
      },
      {
        key: 'advanced.logLevel',
        category: ConfigurationCategory.Advanced,
        displayName: '日志级别',
        description: '日志记录级别',
        type: 'enum',
        options: ['error', 'warn', 'info', 'debug', 'trace'],
        defaultValue: 'info',
        scope: 'both',
        requiresRestart: true
      },
      {
        key: 'advanced.memoryLimit',
        category: ConfigurationCategory.Advanced,
        displayName: '内存限制',
        description: '最大内存使用限制（MB）',
        type: 'number',
        defaultValue: 2048,
        validation: { min: 256, max: 16384 },
        scope: 'both'
      }
    ];

    // 注册所有默认配置项
    for (const config of defaultConfigs) {
      this.configItems.set(config.key, config);
    }
  }

  /**
   * 获取配置值（优先使用本地缓存解决同步问题）
   */
  get<T extends ConfigValue>(key: string, defaultValue?: T): T {
    // 1. 首先检查本地缓存
    if (this.localConfigCache.has(key)) {
      return this.localConfigCache.get(key) as T;
    }

    // 2. 从VSCode配置中获取
    const config = vscode.workspace.getConfiguration(this.EXTENSION_NAME);
    const configItem = this.configItems.get(key);

    if (configItem) {
      const vsCodeKey = key.replace(`${this.EXTENSION_NAME}.`, '');
      const value = config.get<T>(vsCodeKey);

      if (value !== undefined) {
        configItem.currentValue = value;
        // 更新本地缓存
        this.localConfigCache.set(key, value);
        return value;
      }

      // 先返回配置项的默认值，如果没有则返回传入的默认值
      const resultValue = (configItem.defaultValue as T) ?? (defaultValue as T);
      if (resultValue !== undefined) {
        this.localConfigCache.set(key, resultValue);
      }
      return resultValue;
    }

    // 对于没有注册的配置项，直接从VSCode配置中获取
    const value = config.get<T>(key);
    const resultValue = value !== undefined ? value : (defaultValue as T);
    if (resultValue !== undefined) {
      this.localConfigCache.set(key, resultValue);
    }
    return resultValue;
  }

  /**
   * 获取数字配置值
   */
  getNumber(key: string, defaultValue?: number): number {
    return this.get<number>(key, defaultValue);
  }

  /**
   * 获取布尔配置值
   */
  getBoolean(key: string, defaultValue?: boolean): boolean {
    return this.get<boolean>(key, defaultValue);
  }

  /**
   * 获取字符串配置值
   */
  getString(key: string, defaultValue?: string): string {
    return this.get<string>(key, defaultValue);
  }

  /**
   * 获取数组配置值
   */
  getArray<T>(key: string, defaultValue?: T[]): T[] {
    return this.get<T[]>(key, defaultValue);
  }

  /**
   * 按类别获取配置项
   */
  getConfigurationsByCategory(category: ConfigurationCategory): ConfigurationItem[] {
    return Array.from(this.configItems.values()).filter(item => item.category === category);
  }

  /**
   * 获取所有类别
   */
  getAllCategories(): ConfigurationCategory[] {
    const categories = new Set<ConfigurationCategory>();
    for (const item of this.configItems.values()) {
      categories.add(item.category);
    }
    return Array.from(categories);
  }

  /**
   * 设置配置值（立即更新本地缓存解决同步问题）
   */
  async set(
    key: string,
    value: ConfigValue,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const configItem = this.configItems.get(key);

    // 验证配置值
    if (configItem) {
      const validationError = this.validateConfigValue(configItem, value);
      if (validationError) {
        throw new Error(`配置验证失败: ${validationError}`);
      }
    }

    const oldValue = this.get(key);

    // 立即更新本地缓存（解决同步问题）
    this.localConfigCache.set(key, value);

    // 更新配置项缓存
    if (configItem) {
      configItem.currentValue = value;
    }

    try {
      // 异步更新VSCode配置
      const config = vscode.workspace.getConfiguration(this.EXTENSION_NAME);
      const vsCodeKey = key.replace(`${this.EXTENSION_NAME}.`, '');
      await config.update(vsCodeKey, value, target);
    } catch (error) {
      // 如果VSCode配置更新失败，回滚本地缓存
      if (oldValue !== undefined) {
        this.localConfigCache.set(key, oldValue);
        if (configItem) {
          configItem.currentValue = oldValue;
        }
      } else {
        this.localConfigCache.delete(key);
      }
      throw error;
    }

    // 触发更改事件
    this.emit('configurationChanged', {
      key,
      oldValue,
      newValue: value,
      category: configItem?.category || ConfigurationCategory.General,
      scope: target === vscode.ConfigurationTarget.Global ? 'global' : 'workspace'
    } as ConfigurationChangeEvent);
  }

  /**
   * 获取所有配置项
   */
  getAllConfigurationItems(): ConfigurationItem[] {
    const items = Array.from(this.configItems.values());

    // 更新当前值
    for (const item of items) {
      item.currentValue = this.get(item.key, item.defaultValue);
    }

    return items;
  }

  /**
   * 按类别获取配置项
   */
  getConfigurationItemsByCategory(category: ConfigurationCategory): ConfigurationItem[] {
    return this.getAllConfigurationItems().filter(item => item.category === category);
  }

  /**
   * 重置配置到默认值
   */
  async resetConfiguration(keys?: string[]): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.EXTENSION_NAME);
    const keysToReset = keys || Array.from(this.configItems.keys());

    for (const key of keysToReset) {
      const configItem = this.configItems.get(key);
      if (configItem) {
        const vsCodeKey = key.replace(`${this.EXTENSION_NAME}.`, '');
        await config.update(vsCodeKey, undefined, vscode.ConfigurationTarget.Workspace);
        await config.update(vsCodeKey, undefined, vscode.ConfigurationTarget.Global);

        configItem.currentValue = configItem.defaultValue;
      }
    }

    vscode.window.showInformationMessage('配置已重置为默认值');
  }

  /**
   * 导出配置
   */
  async exportConfiguration(filePath?: string): Promise<string> {
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      configurations: {} as Record<string, ConfigValue>,
      devices: Array.from(this.deviceConfigurations.values()),
      themes: Array.from(this.themes.values())
    };

    // 导出所有配置值
    for (const [key, item] of this.configItems.entries()) {
      exportData.configurations[key] = this.get(key, item.defaultValue);
    }

    const configJson = JSON.stringify(exportData, null, 2);

    // 如果提供了文件路径，则写入文件
    if (filePath) {
      await fs.writeFile(filePath, configJson, 'utf8');
    }

    return configJson;
  }

  /**
   * 导入配置 - 支持从文件路径或直接JSON字符串导入
   */
  async importConfiguration(configurationDataOrPath: string): Promise<void> {
    let configurationData: string;

    try {
      // 判断是文件路径还是JSON字符串
      if (configurationDataOrPath.startsWith('{')) {
        // 直接的JSON字符串
        configurationData = configurationDataOrPath;
      } else {
        // 文件路径
        try {
          configurationData = await fs.readFile(configurationDataOrPath, 'utf8');
        } catch (fileError: any) {
          if (fileError.code === 'ENOENT') {
            throw new Error('文件不存在');
          }
          throw fileError;
        }
      }

      const importData = JSON.parse(configurationData);

      if (!importData.version || !importData.configurations) {
        throw new Error('无效的配置数据格式');
      }

      // 导入配置值
      for (const [key, value] of Object.entries(importData.configurations)) {
        if (this.configItems.has(key)) {
          await this.set(key, value as ConfigValue);
        }
      }

      // 导入设备配置
      if (importData.devices) {
        for (const device of importData.devices) {
          await this.saveDeviceConfiguration(device);
        }
      }

      // 导入主题
      if (importData.themes) {
        for (const theme of importData.themes) {
          await this.saveTheme(theme);
        }
      }

      vscode.window.showInformationMessage('配置导入成功');

    } catch (error) {
      throw new Error(`配置导入失败: ${error}`);
    }
  }

  /**
   * 设备配置管理
   */
  async saveDeviceConfiguration(deviceConfig: DeviceConfiguration): Promise<void> {
    deviceConfig.lastUsed = new Date().toISOString();
    this.deviceConfigurations.set(deviceConfig.deviceId, deviceConfig);
    await this.persistDeviceConfigurations();
  }

  getDeviceConfiguration(deviceId: string): DeviceConfiguration | undefined {
    return this.deviceConfigurations.get(deviceId);
  }

  getAllDeviceConfigurations(): DeviceConfiguration[] {
    return Array.from(this.deviceConfigurations.values())
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  }

  async deleteDeviceConfiguration(deviceId: string): Promise<void> {
    this.deviceConfigurations.delete(deviceId);
    await this.persistDeviceConfigurations();
  }

  /**
   * 主题管理
   */
  async saveTheme(theme: ThemeConfiguration): Promise<void> {
    this.themes.set(theme.name, theme);
    await this.persistThemes();
  }

  getTheme(name: string): ThemeConfiguration | undefined {
    return this.themes.get(name);
  }

  getAllThemes(): ThemeConfiguration[] {
    return Array.from(this.themes.values());
  }

  async setCurrentTheme(themeName: string): Promise<void> {
    if (this.themes.has(themeName) || ['auto', 'light', 'dark', 'high-contrast'].includes(themeName)) {
      this.currentTheme = themeName;
      await this.set('display.theme', themeName);
    }
  }

  getCurrentTheme(): string {
    return this.currentTheme || this.get('display.theme', 'auto');
  }

  /**
   * 获取工作区配置文件路径
   */
  private getWorkspaceConfigPath(filename: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return path.join(workspaceFolder.uri.fsPath, '.vscode', 'logicanalyzer', filename);
    }
    throw new Error('没有打开的工作区');
  }

  /**
   * 加载配置
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // 加载设备配置
      await this.loadDeviceConfigurations();

      // 加载主题
      await this.loadThemes();

      // 设置当前主题
      this.currentTheme = this.get('display.theme', 'auto');

    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  /**
   * 加载设备配置
   */
  private async loadDeviceConfigurations(): Promise<void> {
    try {
      const configPath = this.getWorkspaceConfigPath(this.DEVICES_FILE);
      const content = await fs.readFile(configPath, 'utf8');
      const devices = JSON.parse(content) as DeviceConfiguration[];

      this.deviceConfigurations.clear();
      for (const device of devices) {
        // 验证设备配置的有效性
        if (this.isValidDeviceConfiguration(device)) {
          this.deviceConfigurations.set(device.deviceId, device);
        }
      }

    } catch (error) {
      // 文件不存在或读取失败，使用空配置
    }
  }

  /**
   * 验证设备配置是否有效
   */
  private isValidDeviceConfiguration(device: any): device is DeviceConfiguration {
    return device &&
           typeof device.deviceId === 'string' &&
           device.deviceId.length > 0 &&
           typeof device.name === 'string' &&
           typeof device.type === 'string' &&
           typeof device.connectionString === 'string' &&
           typeof device.settings === 'object' &&
           typeof device.lastUsed === 'string' &&
           typeof device.favorite === 'boolean';
  }

  /**
   * 持久化设备配置
   */
  private async persistDeviceConfigurations(): Promise<void> {
    try {
      const configPath = this.getWorkspaceConfigPath(this.DEVICES_FILE);
      const configDir = path.dirname(configPath);

      await fs.mkdir(configDir, { recursive: true });

      const devices = Array.from(this.deviceConfigurations.values());
      await fs.writeFile(configPath, JSON.stringify(devices, null, 2), 'utf8');

    } catch (error) {
      console.error('保存设备配置失败:', error);
    }
  }

  /**
   * 加载主题
   */
  private async loadThemes(): Promise<void> {
    // 首先加载默认主题
    this.loadDefaultThemes();

    try {
      const configPath = this.getWorkspaceConfigPath(this.THEMES_FILE);
      const content = await fs.readFile(configPath, 'utf8');
      const themes = JSON.parse(content) as ThemeConfiguration[];

      // 加载用户自定义主题（如果名称相同会覆盖默认主题）
      for (const theme of themes) {
        if (this.isValidThemeConfiguration(theme)) {
          this.themes.set(theme.name, theme);
        }
      }

    } catch (error) {
      // 文件不存在或读取失败时，保持默认主题
    }
  }

  /**
   * 验证主题配置是否有效
   */
  private isValidThemeConfiguration(theme: any): theme is ThemeConfiguration {
    return theme &&
           typeof theme.name === 'string' &&
           theme.name.length > 0 &&
           typeof theme.colors === 'object' &&
           typeof theme.colors.background === 'string' &&
           typeof theme.colors.foreground === 'string' &&
           Array.isArray(theme.colors.channelColors) &&
           typeof theme.fonts === 'object' &&
           typeof theme.fonts.family === 'string';
  }

  /**
   * 持久化主题
   */
  private async persistThemes(): Promise<void> {
    try {
      const configPath = this.getWorkspaceConfigPath(this.THEMES_FILE);
      const configDir = path.dirname(configPath);

      await fs.mkdir(configDir, { recursive: true });

      const themes = Array.from(this.themes.values());
      await fs.writeFile(configPath, JSON.stringify(themes, null, 2), 'utf8');

    } catch (error) {
      console.error('保存主题失败:', error);
    }
  }

  /**
   * 加载默认主题
   */
  private loadDefaultThemes(): void {
    const defaultThemes: ThemeConfiguration[] = [
      {
        name: 'Default Light',
        colors: {
          background: '#ffffff',
          foreground: '#000000',
          channelColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
          gridColor: '#E0E0E0',
          markerColor: '#FF6600',
          triggerColor: '#FF0066'
        },
        fonts: {
          family: 'Monaco, Consolas, monospace',
          size: 12,
          weight: 'normal'
        }
      },
      {
        name: 'Default Dark',
        colors: {
          background: '#1E1E1E',
          foreground: '#FFFFFF',
          channelColors: ['#FF4444', '#44FF44', '#4444FF', '#FFFF44', '#FF44FF', '#44FFFF'],
          gridColor: '#404040',
          markerColor: '#FF8800',
          triggerColor: '#FF0088'
        },
        fonts: {
          family: 'Monaco, Consolas, monospace',
          size: 12,
          weight: 'normal'
        }
      }
    ];

    for (const theme of defaultThemes) {
      this.themes.set(theme.name, theme);
    }
  }

  /**
   * 验证配置值
   */
  private validateConfigValue(configItem: ConfigurationItem, value: ConfigValue): string | null {
    const { validation } = configItem;
    if (!validation) return null;

    // 必需检查
    if (validation.required && (value === undefined || value === null || value === '')) {
      return '此配置项为必需项';
    }

    // 数值范围检查
    if (typeof value === 'number') {
      if (validation.min !== undefined && value < validation.min) {
        return `值不能小于 ${validation.min}`;
      }
      if (validation.max !== undefined && value > validation.max) {
        return `值不能大于 ${validation.max}`;
      }
    }

    // 正则表达式检查
    if (typeof value === 'string' && validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return '值格式不正确';
      }
    }

    // 自定义验证
    if (validation.custom) {
      return validation.custom(value);
    }

    return null;
  }

  /**
   * 添加配置变化监听器
   */
  onConfigurationChanged(listener: (event: ConfigurationChangeEvent) => void): void {
    this.on('configurationChanged', listener);
  }

  /**
   * 设置配置监听器
   */
  private setupConfigurationWatcher(): void {
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(this.EXTENSION_NAME)) {
        // 重新加载受影响的配置
        this.loadConfiguration();

        // 触发配置更改事件
        this.emit('configurationReloaded');
      }
    });
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.removeAllListeners();
  }
}

// 导出单例实例
export const configurationManager = new ConfigurationManager();
