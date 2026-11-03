/**
 * 采集会话管理服务
 * 负责采集会话的保存、恢复、管理和版本控制
 * 基于原版 MainWindow.axaml.cs 中的 mnuSave_Click 和 mnuOpen_Click 实现
 * 支持完整的会话状态保存，包括配置、数据、解码结果、标记等
 */
import { CaptureSession, AnalyzerChannel, SampleRegion } from '../models/CaptureModels';
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
  analysisResults?: unknown;
  measurementResults?: unknown;

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
  deviceInfo?: unknown;
  captureSettings: {
    sampleRate: number;
    totalSamples: number;
    duration: number;
    triggerInfo?: unknown;
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
  metadata?: {
    fileSize?: number;
    compression?: string;
    [key: string]: unknown;
  };
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
        await this.saveSession(this.currentSession);
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
    captureSettings?: { sampleRate?: number; totalSamples?: number; duration?: number; [key: string]: unknown };
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
      await this.saveSession(this.currentSession);
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
    hasUnsavedChanges: boolean;
    version: string;
  }> {
    return {
      lastModified: Date.now(),
      isModified: this.unsavedChanges,
      hasUnsavedChanges: this.unsavedChanges,
      version: this.CURRENT_VERSION
    };
  }

  /**
   * 同步会话状态
   */
  async synchronizeSession(sessionId: string): Promise<{
    success: boolean;
    conflictsResolved: number;
    lastSyncTime: number;
  }> {
    // 模拟同步操作
    await new Promise(resolve => setTimeout(resolve, 100));

    // 重置未保存状态
    this.unsavedChanges = false;

    return {
      success: true,
      conflictsResolved: 0,
      lastSyncTime: Date.now()
    };
  }

  /**
   * 保存采集数据到会话
   */
  async saveCaptureData(sessionId: string, captureData: Record<string, unknown>): Promise<void> {
    if (this.currentSession?.sessionId === sessionId) {
      // 容错处理：captureData 可能为原始样本数据（含 samples/timestamp）或带 metadata 的结构
      const meta = (captureData?.metadata ?? undefined) as
        | { sampleRate?: number; totalSamples?: number }
        | undefined;
      if (meta && typeof meta.sampleRate === 'number' && typeof meta.totalSamples === 'number') {
        this.currentSession.metadata.captureSettings = {
          sampleRate: meta.sampleRate,
          totalSamples: meta.totalSamples,
          duration: meta.sampleRate > 0 ? meta.totalSamples / meta.sampleRate : 0
        };
      }
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

      // 创建备份（如果启用）—— 备份失败不应中断主保存流程
      if (this.options.backupEnabled && await this.fileExists(filePath)) {
        try {
          await this.createBackup(filePath);
        } catch (backupError) {
          // 备份失败仅记录警告，不中断保存
          console.warn('SessionManager: 创建备份失败，继续保存:', backupError);
        }
      }

      // 序列化数据
      const serializedData = await this.serializeSession(completeSessionData);

      // 写入文件
      await fs.writeFile(filePath, serializedData, 'utf8');

      // 获取文件大小（优先 stat，失败则用序列化内容长度）
      let fileSize = serializedData.length;
      try {
        const stats = await fs.stat(filePath);
        if (stats && typeof stats.size === 'number') {
          fileSize = stats.size;
        }
      } catch {
        // 保持 serializedData.length
      }

      // 更新当前会话状态
      this.currentSession = completeSessionData;
      this.unsavedChanges = false;

      // 记录到最近文件列表
      await this.addToRecentFiles(filePath);

      return {
        success: true,
        sessionId: completeSessionData.sessionId,
        filePath,
        metadata: {
          fileSize,
          compression: this.options.compressionEnabled ? 'enabled' : 'disabled'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: this.formatSaveError(error)
      };
    }
  }

  /**
   * 格式化保存错误信息（映射常见错误码为用户友好提示）
   */
  private formatSaveError(error: unknown): string {
    const err = error as { code?: string; message?: string };
    const rawMessage = error instanceof Error ? error.message : '保存会话失败';
    if (err?.code === 'ENOSPC') {
      return `磁盘空间不足：${rawMessage}`;
    }
    if (err?.code === 'EACCES' || err?.code === 'EPERM') {
      return `权限不足：${rawMessage}`;
    }
    return rawMessage;
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

      // 验证会话数据完整性
      if (!this.validateSessionData(sessionData)) {
        return {
          success: false,
          error: '会话数据完整性校验失败：缺少必要字段（version/captureSession/timestamp/sessionId）'
        };
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
      return { success: true, warnings: ['No unsaved changes'] }; // 没有需要保存的内容
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

    // 使用 Object.assign 原地更新，保持当前会话对象引用不变
    // 这样外部持有的会话引用能与当前会话保持同步
    Object.assign(this.currentSession, updates, {
      timestamp: new Date().toISOString() // 更新时间戳
    });

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
   * 参数可以是 sessionId，也可以直接是历史目录路径
   * 返回历史文件路径列表（按文件名升序，限制最大版本数）
   */
  async getSessionHistory(sessionIdOrPath: string): Promise<string[]> {
    try {
      let historyDir: string;

      // 判断传入的是路径（含分隔符或扩展名）还是 sessionId
      const looksLikePath = sessionIdOrPath.includes('/') ||
        sessionIdOrPath.includes(path.sep) ||
        sessionIdOrPath.endsWith(this.FILE_EXTENSION) ||
        sessionIdOrPath.endsWith('.json');

      if (looksLikePath) {
        historyDir = sessionIdOrPath;
      } else {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          return [];
        }
        historyDir = path.join(workspaceFolder.uri.fsPath, '.vscode', 'logicanalyzer', 'history', sessionIdOrPath);
      }

      if (!await this.fileExists(historyDir)) {
        return [];
      }

      const files = await fs.readdir(historyDir);
      const historyFiles = files
        .filter(f => f.endsWith(this.FILE_EXTENSION) || f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b)); // 按文件名升序

      const maxVersions = this.options.maxHistoryVersions || 10;
      return historyFiles
        .slice(0, maxVersions)
        .map(f => path.join(historyDir, f));

    } catch (error) {
      console.error('获取会话历史失败:', error);
      return [];
    }
  }

  /**
   * 更新会话管理选项
   * 支持 autoSave / autoSaveInterval 变化时自动重启定时器
   */
  updateOptions(options: Partial<SessionManagerOptions>): void {
    const previousAutoSave = this.options.autoSave;
    const previousInterval = this.options.autoSaveInterval;

    this.options = { ...this.options, ...options };

    // autoSave 由关闭变开启，或间隔变化时，重启定时器
    if (this.options.autoSave && (!previousAutoSave || previousInterval !== this.options.autoSaveInterval)) {
      this.startAutoSave();
    } else if (!this.options.autoSave && previousAutoSave && this.autoSaveTimer) {
      // autoSave 被关闭，停止定时器
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * 清理超出最大版本数限制的旧历史文件
   * @param historyDir 历史目录路径
   * @param prefix 文件名前缀（仅清理匹配前缀的文件）
   * @returns 实际删除的文件数量
   */
  async cleanupOldVersions(historyDir: string, prefix: string): Promise<number> {
    try {
      if (!await this.fileExists(historyDir)) {
        return 0;
      }

      const files = await fs.readdir(historyDir);
      const matching = files
        .filter(f => f.startsWith(prefix))
        .sort((a, b) => a.localeCompare(b)); // 升序

      const maxVersions = this.options.maxHistoryVersions || 10;
      const toDelete = matching.slice(maxVersions); // 保留前 maxVersions 个，删除其余旧版本

      let deleted = 0;
      for (const file of toDelete) {
        try {
          await fs.unlink(path.join(historyDir, file));
          deleted++;
        } catch {
          // 忽略单个文件删除失败
        }
      }

      return deleted;
    } catch (error) {
      console.error('清理旧历史版本失败:', error);
      return 0;
    }
  }

  /**
   * 恢复损坏的会话数据
   * 补全缺失的必要字段（timestamp/sessionId 等），使其重新可用
   */
  async recoverSession(data: Partial<SessionData>): Promise<SessionData> {
    const recovered: SessionData = {
      version: data.version || this.CURRENT_VERSION,
      timestamp: data.timestamp || new Date().toISOString(),
      sessionId: data.sessionId || this.generateSessionId(),
      name: data.name || 'Recovered Session',
      description: data.description,
      tags: data.tags || [],

      captureSession: data.captureSession || ({} as CaptureSession),
      selectedRegions: data.selectedRegions || [],

      decoderResults: data.decoderResults,
      analysisResults: data.analysisResults,
      measurementResults: data.measurementResults,

      viewSettings: data.viewSettings,
      channelSettings: data.channelSettings,
      markerSettings: data.markerSettings,

      metadata: data.metadata || {
        captureSettings: {
          sampleRate: 0,
          totalSamples: 0,
          duration: 0
        },
        fileInfo: {
          size: 0
        }
      }
    };

    this.currentSession = recovered;
    this.unsavedChanges = true;

    return recovered;
  }

  /**
   * 清理资源
   */
  async dispose(options?: ServiceDisposeOptions): Promise<boolean> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
    return true;
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
   * 验证会话数据完整性（公共方法）
   * 检查必要字段是否存在：version / captureSession / timestamp / sessionId
   */
  validateSessionData(sessionData: unknown): boolean {
    if (!sessionData || typeof sessionData !== 'object') {
      return false;
    }
    const data = sessionData as Record<string, unknown>;
    if (!data.version) {
      return false;
    }
    if (!data.captureSession) {
      return false;
    }
    if (!data.timestamp) {
      return false;
    }
    if (!data.sessionId) {
      return false;
    }
    return true;
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
  private createJsonReplacer(): (key: string, value: unknown) => unknown {
    return (key: string, value: unknown) => {
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
  private createJsonReviver(): (key: string, value: unknown) => unknown {
    return (key: string, value: unknown) => {
      // 恢复Uint8Array
      if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Uint8Array') {
        return new Uint8Array((value as { data: ArrayLike<number> }).data);
      }
      return value;
    };
  }
}

// 导出单例实例
export const sessionManager = new SessionManager();
