/**
 * 采集会话管理服务
 * 负责采集会话的保存、恢复、管理和版本控制
 * 基于原版 MainWindow.axaml.cs 中的 mnuSave_Click 和 mnuOpen_Click 实现
 * 支持完整的会话状态保存，包括配置、数据、解码结果、标记等
 */
import { CaptureSession, AnalyzerChannel } from '../models/AnalyzerTypes';
import { SampleRegion } from '../models/CaptureModels';
import { DecoderResult } from '../decoders/types';
import { ExportedCapture, ExportMetadata } from './DataExportService';
import { ServiceLifecycleBase, ServiceInitOptions, ServiceDisposeOptions } from '../common/ServiceLifecycle';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

// 会话存储格式
export interface SessionData {
  version: string;
  timestamp: string;
  sessionId: string;
  name: string;
  description?: string;
  tags?: string[];

  // 核心数据 - 对应原版 ExportedCapture
  captureSession: CaptureSession;
  selectedRegions?: SampleRegion[];

  // 扩展数据
  decoderResults?: Map<string, DecoderResult[]>;
  analysisResults?: any;
  measurementResults?: any;

  // UI状态
  viewSettings?: ViewSettings;
  channelSettings?: ChannelSettings[];
  markerSettings?: MarkerSettings[];

  // 元数据
  metadata: SessionMetadata;
}

export interface ViewSettings {
  timebase: number;          // 时基设置
  sampleOffset: number;      // 样本偏移
  zoomLevel: number;         // 缩放级别
  visibleChannels: number[]; // 可见通道
  channelColors: Map<number, string>; // 通道颜色
  displayMode: 'digital' | 'analog' | 'mixed'; // 显示模式
}

export interface ChannelSettings {
  channelNumber: number;
  name: string;
  color: string;
  visible: boolean;
  position: number;          // 显示位置
  height: number;           // 显示高度
  inverted: boolean;        // 是否反相
  threshold?: number;       // 阈值电压
}

export interface MarkerSettings {
  id: string;
  type: 'time' | 'voltage' | 'frequency';
  position: number;         // 位置 (样本或时间)
  label: string;
  color: string;
  visible: boolean;
}

export interface SessionMetadata {
  deviceInfo?: any;
  captureSettings: {
    sampleRate: number;
    totalSamples: number;
    duration: number;
    triggerInfo?: any;
  };
  fileInfo: {
    size: number;
    checksum?: string;
    compression?: string;
  };
  userInfo?: {
    username: string;
    workstation: string;
  };
}

// 会话管理选项
export interface SessionManagerOptions {
  autoSave?: boolean;
  autoSaveInterval?: number; // 秒
  maxHistoryVersions?: number;
  compressionEnabled?: boolean;
  backupEnabled?: boolean;
}

// 会话操作结果
export interface SessionOperationResult {
  success: boolean;
  sessionId?: string;
  filePath?: string;
  error?: string;
  warnings?: string[];
}

export class SessionManager extends ServiceLifecycleBase {
  private readonly CURRENT_VERSION = '1.0.0';
  private readonly FILE_EXTENSION = '.lacsession';
  private readonly BACKUP_EXTENSION = '.backup';

  private options: SessionManagerOptions;
  private autoSaveTimer?: NodeJS.Timeout;
  private currentSession?: SessionData;
  private unsavedChanges = false;

  constructor(options: SessionManagerOptions = {}) {
    super('SessionManager');
    
    this.options = {
      autoSave: false,
      autoSaveInterval: 300, // 5分钟
      maxHistoryVersions: 10,
      compressionEnabled: true,
      backupEnabled: true,
      ...options
    };

    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * 实现父类的初始化方法
   */
  protected async onInitialize(options: ServiceInitOptions): Promise<void> {
    // SessionManager 在构造时已经完成初始化
    // 这里可以添加额外的初始化逻辑
    this.updateMetadata({
      autoSave: this.options.autoSave,
      autoSaveInterval: this.options.autoSaveInterval,
      compressionEnabled: this.options.compressionEnabled
    });
  }

  /**
   * 实现父类的销毁方法
   */
  protected async onDispose(options: ServiceDisposeOptions): Promise<void> {
    // 停止自动保存
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    // 如果有未保存的更改，可选择保存
    if (this.unsavedChanges && this.currentSession) {
      try {
        await this.saveCurrentSession();
      } catch (error) {
        if (!options.force) {
          throw error;
        }
      }
    }

    // 清理当前会话
    this.currentSession = undefined;
    this.unsavedChanges = false;
  }

  /**
   * 创建新会话
   */
  async createSession(config: {
    name: string;
    description?: string;
    captureSettings?: any;
  }): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData: SessionData = {
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      sessionId,
      name: config.name,
      description: config.description,
      captureSession: {} as CaptureSession, // 初始为空的采集会话
      metadata: {
        captureSettings: {
          sampleRate: config.captureSettings?.sampleRate || 1000000,
          totalSamples: 0,
          duration: 0
        },
        fileInfo: {
          size: 0
        }
      }
    };

    this.currentSession = sessionData;
    this.unsavedChanges = true;

    return sessionId;
  }

  /**
   * 设置活动会话
   */
  async setActiveSession(sessionId: string): Promise<void> {
    // 在实际实现中，这里应该从存储中加载会话
    // 目前只是模拟实现
    if (this.currentSession?.sessionId === sessionId) {
      return;
    }

    // 保存当前会话（如果有未保存的更改）
    if (this.unsavedChanges && this.currentSession) {
      await this.saveCurrentSession();
    }

    // 加载新会话（这里是模拟实现）
    this.currentSession = {
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      sessionId,
      name: `Session ${sessionId}`,
      captureSession: {} as CaptureSession,
      metadata: {
        captureSettings: {
          sampleRate: 1000000,
          totalSamples: 0,
          duration: 0
        },
        fileInfo: {
          size: 0
        }
      }
    };
    this.unsavedChanges = false;
  }

  /**
   * 获取活动会话
   */
  async getActiveSession(): Promise<SessionData | undefined> {
    return this.currentSession;
  }

  /**
   * 获取会话状态
   */
  async getSessionState(sessionId: string): Promise<{
    lastModified: number;
    isModified: boolean;
  }> {
    return {
      lastModified: Date.now(),
      isModified: this.unsavedChanges
    };
  }

  /**
   * 同步会话状态
   */
  async synchronizeSession(sessionId: string): Promise<{
    success: boolean;
    conflictsResolved: number;
  }> {
    // 模拟同步操作
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 重置未保存状态
    this.unsavedChanges = false;
    
    return {
      success: true,
      conflictsResolved: 0
    };
  }

  /**
   * 保存采集数据到会话
   */
  async saveCaptureData(sessionId: string, captureData: any): Promise<void> {
    if (this.currentSession?.sessionId === sessionId) {
      // 更新会话数据
      this.currentSession.metadata.captureSettings = {
        sampleRate: captureData.metadata.sampleRate,
        totalSamples: captureData.metadata.totalSamples,
        duration: captureData.metadata.totalSamples / captureData.metadata.sampleRate
      };
      this.unsavedChanges = true;
    }
  }

  /**
   * 获取所有会话
   */
  async getAllSessions(): Promise<SessionData[]> {
    // 在实际实现中，这里应该从存储中获取所有会话
    // 目前返回当前会话
    return this.currentSession ? [this.currentSession] : [];
  }

  /**
   * 保存当前会话
   * 基于原版 mnuSave_Click 方法
   */
  async saveSession(
    sessionData: Partial<SessionData>,
    filePath?: string
  ): Promise<SessionOperationResult> {
    try {
      // 如果没有指定路径，打开保存对话框
      if (!filePath) {
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`capture_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.lacsession`),
          filters: {
            'Logic Analyzer Session': ['lacsession'],
            'Legacy LAC Files': ['lac']
          }
        });

        if (!uri) {
          return { success: false, error: '用户取消了保存操作' };
        }

        filePath = uri.fsPath;
      }

      // 构建完整的会话数据
      const completeSessionData: SessionData = {
        version: this.CURRENT_VERSION,
        timestamp: new Date().toISOString(),
        sessionId: sessionData.sessionId || this.generateSessionId(),
        name: sessionData.name || path.basename(filePath, this.FILE_EXTENSION),
        description: sessionData.description,
        tags: sessionData.tags || [],

        captureSession: sessionData.captureSession!,
        selectedRegions: sessionData.selectedRegions || [],
        decoderResults: sessionData.decoderResults,
        analysisResults: sessionData.analysisResults,
        measurementResults: sessionData.measurementResults,

        viewSettings: sessionData.viewSettings,
        channelSettings: sessionData.channelSettings,
        markerSettings: sessionData.markerSettings,

        metadata: this.generateMetadata(sessionData)
      };

      // 确保目录存在
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // 创建备份（如果启用）
      if (this.options.backupEnabled && await this.fileExists(filePath)) {
        await this.createBackup(filePath);
      }

      // 序列化数据
      const serializedData = await this.serializeSession(completeSessionData);

      // 写入文件
      await fs.writeFile(filePath, serializedData, 'utf8');

      // 更新当前会话状态
      this.currentSession = completeSessionData;
      this.unsavedChanges = false;

      // 记录到最近文件列表
      await this.addToRecentFiles(filePath);

      return {
        success: true,
        sessionId: completeSessionData.sessionId,
        filePath
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存会话失败'
      };
    }
  }

  /**
   * 加载会话
   * 基于原版 mnuOpen_Click 方法
   */
  async loadSession(filePath?: string): Promise<SessionOperationResult> {
    try {
      // 如果没有指定路径，打开文件对话框
      if (!filePath) {
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: {
            'Logic Analyzer Session': ['lacsession'],
            'Legacy LAC Files': ['lac']
          }
        });

        if (!uris || uris.length === 0) {
          return { success: false, error: '用户取消了加载操作' };
        }

        filePath = uris[0].fsPath;
      }

      // 检查文件是否存在
      if (!await this.fileExists(filePath)) {
        return { success: false, error: `文件不存在: ${filePath}` };
      }

      // 读取文件
      const fileContent = await fs.readFile(filePath, 'utf8');

      // 反序列化数据
      const sessionData = await this.deserializeSession(fileContent, filePath);

      // 验证会话数据
      const validationResult = this.validateSessionData(sessionData);
      if (!validationResult.success) {
        return validationResult;
      }

      // 更新当前会话状态
      this.currentSession = sessionData;
      this.unsavedChanges = false;

      // 记录到最近文件列表
      await this.addToRecentFiles(filePath);

      return {
        success: true,
        sessionId: sessionData.sessionId,
        filePath
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '加载会话失败'
      };
    }
  }

  /**
   * 自动保存当前会话
   */
  async autoSave(): Promise<SessionOperationResult> {
    if (!this.currentSession || !this.unsavedChanges) {
      return { success: true }; // 没有需要保存的内容
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return { success: false, error: '没有打开的工作区' };
      }

      const autoSaveDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'logicanalyzer', 'autosave');
      await fs.mkdir(autoSaveDir, { recursive: true });

      const autoSaveFile = path.join(autoSaveDir,
        `autosave_${this.currentSession.sessionId}_${Date.now()}.lacsession`);

      return await this.saveSession(this.currentSession, autoSaveFile);

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '自动保存失败'
      };
    }
  }

  /**
   * 获取最近的会话文件列表
   */
  async getRecentSessions(): Promise<{ filePath: string; name: string; timestamp: string }[]> {
    try {
      const config = vscode.workspace.getConfiguration('logicAnalyzer');
      const recentFiles = config.get<string[]>('recentSessions') || [];

      const sessions = [];
      for (const filePath of recentFiles) {
        if (await this.fileExists(filePath)) {
          try {
            const stats = await fs.stat(filePath);
            sessions.push({
              filePath,
              name: path.basename(filePath, this.FILE_EXTENSION),
              timestamp: stats.mtime.toISOString()
            });
          } catch {
            // 忽略无法访问的文件
          }
        }
      }

      return sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
      console.error('获取最近会话列表失败:', error);
      return [];
    }
  }

  /**
   * 创建新会话
   */
  createNewSession(
    captureSession: CaptureSession,
    name?: string
  ): SessionData {
    const sessionId = this.generateSessionId();

    const newSession: SessionData = {
      version: this.CURRENT_VERSION,
      timestamp: new Date().toISOString(),
      sessionId,
      name: name || `Capture_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`,

      captureSession,
      selectedRegions: [],

      viewSettings: {
        timebase: 1.0,
        sampleOffset: 0,
        zoomLevel: 1.0,
        visibleChannels: captureSession.captureChannels.map(ch => ch.channelNumber),
        channelColors: new Map(),
        displayMode: 'digital'
      },

      channelSettings: captureSession.captureChannels.map(ch => ({
        channelNumber: ch.channelNumber,
        name: ch.channelName,
        color: this.getDefaultChannelColor(ch.channelNumber),
        visible: !ch.hidden,
        position: ch.channelNumber,
        height: 20,
        inverted: false
      })),

      markerSettings: [],

      metadata: this.generateMetadata({ captureSession })
    };

    this.currentSession = newSession;
    this.unsavedChanges = true;

    return newSession;
  }

  /**
   * 更新当前会话
   */
  updateCurrentSession(updates: Partial<SessionData>): void {
    if (!this.currentSession) {
      throw new Error('没有当前会话可更新');
    }

    this.currentSession = {
      ...this.currentSession,
      ...updates,
      timestamp: new Date().toISOString() // 更新时间戳
    };

    this.unsavedChanges = true;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): SessionData | undefined {
    return this.currentSession;
  }

  /**
   * 检查是否有未保存的更改
   */
  hasUnsavedChanges(): boolean {
    return this.unsavedChanges;
  }

  /**
   * 标记会话有未保存的更改（用于测试）
   */
  markUnsaved(): void {
    this.unsavedChanges = true;
  }

  /**
   * 标记会话已修改
   */
  markAsModified(): void {
    this.unsavedChanges = true;
  }

  /**
   * 获取会话历史版本
   */
  async getSessionHistory(sessionId: string): Promise<SessionData[]> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return [];

      const historyDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'logicanalyzer', 'history', sessionId);

      if (!await this.fileExists(historyDir)) {
        return [];
      }

      const files = await fs.readdir(historyDir);
      const historyFiles = files
        .filter(f => f.endsWith(this.FILE_EXTENSION))
        .sort((a, b) => b.localeCompare(a)); // 按时间倒序

      const history = [];
      for (const file of historyFiles.slice(0, this.options.maxHistoryVersions || 10)) {
        try {
          const filePath = path.join(historyDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const sessionData = await this.deserializeSession(content, filePath);
          history.push(sessionData);
        } catch (error) {
          console.error(`加载历史版本失败: ${file}`, error);
        }
      }

      return history;

    } catch (error) {
      console.error('获取会话历史失败:', error);
      return [];
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  // 私有方法

  /**
   * 序列化会话数据
   */
  private async serializeSession(sessionData: SessionData): Promise<string> {
    // 转换Map为普通对象以便JSON序列化
    const serializable = {
      ...sessionData,
      decoderResults: sessionData.decoderResults ?
        Array.from(sessionData.decoderResults.entries()) : undefined,
      viewSettings: sessionData.viewSettings ? {
        ...sessionData.viewSettings,
        channelColors: sessionData.viewSettings.channelColors ?
          Array.from(sessionData.viewSettings.channelColors.entries()) : []
      } : undefined
    };

    const jsonString = JSON.stringify(serializable, this.createJsonReplacer(), 2);

    // 如果启用压缩
    if (this.options.compressionEnabled) {
      // 这里可以添加压缩逻辑，暂时返回原始JSON
      return jsonString;
    }

    return jsonString;
  }

  /**
   * 反序列化会话数据
   */
  private async deserializeSession(content: string, filePath: string): Promise<SessionData> {
    try {
      // 尝试解析为新格式
      const parsed = JSON.parse(content, this.createJsonReviver());

      // 恢复Map类型
      if (parsed.decoderResults && Array.isArray(parsed.decoderResults)) {
        parsed.decoderResults = new Map(parsed.decoderResults);
      }

      if (parsed.viewSettings?.channelColors) {
        if (Array.isArray(parsed.viewSettings.channelColors)) {
          parsed.viewSettings.channelColors = new Map(parsed.viewSettings.channelColors);
        } else if (typeof parsed.viewSettings.channelColors === 'object') {
          // 处理空对象{}的情况
          parsed.viewSettings.channelColors = new Map();
        }
      }

      return parsed as SessionData;

    } catch (error) {
      // 尝试解析为旧的LAC格式
      if (filePath.endsWith('.lac')) {
        return this.convertLegacyLacFormat(content);
      }

      throw new Error(`无法解析会话文件: ${error}`);
    }
  }

  /**
   * 转换旧版LAC格式
   * 基于原版 ExportedCapture 格式
   */
  private convertLegacyLacFormat(content: string): SessionData {
    const legacyData = JSON.parse(content) as ExportedCapture;

    if (!legacyData.settings) {
      throw new Error('无效的LAC文件格式');
    }

    // 转换为新格式
    const sessionData: SessionData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      sessionId: this.generateSessionId(),
      name: 'Imported LAC File',

      captureSession: legacyData.settings,
      selectedRegions: legacyData.selectedRegions || [],

      metadata: {
        captureSettings: {
          sampleRate: legacyData.settings.frequency,
          totalSamples: legacyData.settings.preTriggerSamples + legacyData.settings.postTriggerSamples,
          duration: (legacyData.settings.preTriggerSamples + legacyData.settings.postTriggerSamples) / legacyData.settings.frequency
        },
        fileInfo: {
          size: content.length
        }
      }
    };

    return sessionData;
  }

  /**
   * 验证会话数据
   */
  private validateSessionData(sessionData: any): SessionOperationResult {
    const warnings: string[] = [];

    // 检查必需字段
    if (!sessionData.version) {
      return { success: false, error: '缺少版本信息' };
    }

    if (!sessionData.captureSession) {
      return { success: false, error: '缺少采集会话数据' };
    }

    // 版本兼容性检查
    if (sessionData.version !== this.CURRENT_VERSION) {
      warnings.push(`版本不匹配: 文件版本 ${sessionData.version}, 当前版本 ${this.CURRENT_VERSION}`);
    }

    // 数据完整性检查
    if (!sessionData.captureSession.captureChannels ||
        sessionData.captureSession.captureChannels.length === 0) {
      warnings.push('没有找到通道数据');
    }

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成元数据
   */
  private generateMetadata(sessionData: Partial<SessionData>): SessionMetadata {
    const captureSession = sessionData.captureSession!;
    const totalSamples = captureSession.preTriggerSamples + captureSession.postTriggerSamples;

    return {
      captureSettings: {
        sampleRate: captureSession.frequency,
        totalSamples,
        duration: totalSamples / captureSession.frequency,
        triggerInfo: {
          type: captureSession.triggerType,
          channel: captureSession.triggerChannel,
          inverted: captureSession.triggerInverted
        }
      },
      fileInfo: {
        size: 0 // 将在保存时更新
      },
      userInfo: {
        username: process.env.USERNAME || process.env.USER || 'unknown',
        workstation: process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown'
      }
    };
  }

  /**
   * 获取默认通道颜色
   */
  private getDefaultChannelColor(channelNumber: number): string {
    const colors = [
      '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
      '#FF00FF', '#00FFFF', '#FFA500', '#800080',
      '#008000', '#000080', '#800000', '#808000',
      '#008080', '#C0C0C0', '#808080', '#FF69B4',
      '#00CED1', '#32CD32', '#FFD700', '#DC143C',
      '#4169E1', '#FF1493', '#00FA9A', '#FF6347'
    ];

    return colors[channelNumber % colors.length];
  }

  /**
   * 启动自动保存
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      await this.autoSave();
    }, (this.options.autoSaveInterval || 300) * 1000);
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(filePath: string): Promise<void> {
    const backupPath = `${filePath}${this.BACKUP_EXTENSION}`;
    await fs.copyFile(filePath, backupPath);
  }

  /**
   * 添加到最近文件列表
   */
  private async addToRecentFiles(filePath: string): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('logicAnalyzer');
      const recentFiles = config.get<string[]>('recentSessions') || [];

      // 移除重复项
      const filtered = recentFiles.filter(f => f !== filePath);

      // 添加到开头
      filtered.unshift(filePath);

      // 限制数量
      const maxRecent = 20;
      const trimmed = filtered.slice(0, maxRecent);

      await config.update('recentSessions', trimmed, vscode.ConfigurationTarget.Global);

    } catch (error) {
      console.error('更新最近文件列表失败:', error);
    }
  }

  /**
   * 创建JSON替换器
   */
  private createJsonReplacer(): (key: string, value: any) => any {
    return (key: string, value: any) => {
      // 处理Uint8Array
      if (value instanceof Uint8Array) {
        return {
          __type: 'Uint8Array',
          data: Array.from(value)
        };
      }
      return value;
    };
  }

  /**
   * 创建JSON恢复器
   */
  private createJsonReviver(): (key: string, value: any) => any {
    return (key: string, value: any) => {
      // 恢复Uint8Array
      if (value && value.__type === 'Uint8Array') {
        return new Uint8Array(value.data);
      }
      return value;
    };
  }
}

// 导出单例实例
export const sessionManager = new SessionManager();
