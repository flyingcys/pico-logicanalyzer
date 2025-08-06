/**
 * 工作区集成和项目管理服务
 * 负责VSCode工作区集成、项目结构管理、文件组织、协作功能等
 * 提供完整的项目生命周期管理能力
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { ServiceLifecycleBase, ServiceInitOptions, ServiceDisposeOptions } from '../common/ServiceLifecycle';
import { SessionData, sessionManager } from './SessionManager';
import { configurationManager } from './ConfigurationManager';

// 项目配置
export interface ProjectConfiguration {
  name: string;
  version: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;

  // 项目结构
  structure: {
    sessionsDir: string;    // 会话文件目录
    dataDir: string;        // 原始数据目录
    analysisDir: string;    // 分析结果目录
    reportsDir: string;     // 报告目录
    configDir: string;      // 配置目录
    tempDir: string;        // 临时文件目录
  };

  // 项目设置
  settings: {
    defaultSampleRate: number;
    defaultChannelCount: number;
    autoBackup: boolean;
    compressionEnabled: boolean;
    collaborationEnabled: boolean;
  };

  // 协作配置
  collaboration?: {
    repositoryUrl?: string;
    branches: string[];
    contributors: Contributor[];
    permissions: ProjectPermissions;
  };

  // 元数据
  metadata: {
    totalSessions: number;
    totalDataSize: number;  // 字节
    lastBackup?: string;
    tags: string[];
  };
}

export interface Contributor {
  name: string;
  email: string;
  role: 'owner' | 'maintainer' | 'contributor' | 'viewer';
  joinedAt: string;
  lastActive: string;
}

export interface ProjectPermissions {
  read: string[];         // 用户ID列表
  write: string[];
  admin: string[];
  public: boolean;
}

// 文件类型
export enum FileType {
  Session = 'session',       // 会话文件 (.lacsession)
  Data = 'data',            // 原始数据文件 (.lac, .csv等)
  Analysis = 'analysis',     // 分析结果文件
  Report = 'report',        // 报告文件 (.html, .pdf等)
  Config = 'config',        // 配置文件
  Template = 'template',    // 模板文件
  Script = 'script'         // 脚本文件
}

// 项目文件信息
export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  type: FileType;
  size: number;
  createdAt: string;
  updatedAt: string;
  description?: string;
  tags: string[];
  metadata?: {
    [key: string]: any;
  };
}

// 项目模板
export interface ProjectTemplate {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  structure: string[];      // 需要创建的目录结构
  files: {                  // 需要创建的模板文件
    path: string;
    content: string;
  }[];
  settings: Partial<ProjectConfiguration['settings']>;
}

// 备份配置
export interface BackupConfiguration {
  enabled: boolean;
  interval: number;         // 小时
  maxBackups: number;
  includeData: boolean;
  compression: boolean;
  remoteLocation?: string;
}

// 项目创建选项
export interface ProjectCreationOptions {
  name: string;
  location: string;
  template?: string;
  initializeGit?: boolean;
  createSampleData?: boolean;
  description?: string;
  author?: string;
}

export class WorkspaceManager extends ServiceLifecycleBase {
  private eventEmitter = new EventEmitter();
  private readonly PROJECT_CONFIG_FILE = 'logicanalyzer-project.json';
  private readonly PROJECT_LOCK_FILE = '.logicanalyzer.lock';
  private readonly BACKUP_DIR = '.backups';

  private currentProject?: ProjectConfiguration;
  private projectRoot?: string;
  private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private backupTimer?: NodeJS.Timeout;

  constructor() {
    super('WorkspaceManager');
    this.setupWorkspaceWatchers();
    this.initializeCurrentProject();
  }

  /**
   * 实现父类的初始化方法
   */
  protected async onInitialize(options: ServiceInitOptions): Promise<void> {
    // WorkspaceManager 在构造时已经完成初始化
    // 这里可以添加额外的初始化逻辑
    this.updateMetadata({
      hasCurrentProject: !!this.currentProject,
      projectRoot: this.projectRoot,
      fileWatchersCount: this.fileWatchers.size
    });
  }

  /**
   * 实现父类的销毁方法
   */
  protected async onDispose(options: ServiceDisposeOptions): Promise<void> {
    // 清理文件监听器
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }
    this.fileWatchers.clear();

    // 清理备份定时器
    if (this.backupTimer) {
      clearTimeout(this.backupTimer);
      this.backupTimer = undefined;
    }

    // 清理事件监听器
    this.eventEmitter.removeAllListeners();

    // 清理项目状态
    this.currentProject = undefined;
    this.projectRoot = undefined;
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

  /**
   * 创建新工作区
   */
  async createWorkspace(workspaceDir: string, config: {
    name: string;
    description?: string;
    settings?: any;
  }): Promise<string> {
    const workspaceId = `workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 创建工作区目录结构
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'data'), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, 'exports'), { recursive: true });

    // 创建项目配置
    const projectConfig: ProjectConfiguration = {
      name: config.name,
      version: '1.0.0',
      description: config.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      structure: {
        sessionsDir: 'sessions',
        dataDir: 'data',
        analysisDir: 'analysis',
        reportsDir: 'reports',
        configDir: 'config',
        tempDir: 'temp'
      },
      settings: {
        defaultSampleRate: 24000000,
        defaultChannelCount: 16,
        autoBackup: true,
        compressionEnabled: true,
        collaborationEnabled: false,
        ...config.settings
      },
      metadata: {
        totalSessions: 0,
        totalDataSize: 0,
        tags: []
      }
    };

    // 保存项目配置
    const configPath = path.join(workspaceDir, this.PROJECT_CONFIG_FILE);
    await fs.writeFile(configPath, JSON.stringify(projectConfig, null, 2));

    this.currentProject = projectConfig;
    this.projectRoot = workspaceDir;

    return workspaceId;
  }

  /**
   * 获取工作区信息
   */
  async getWorkspaceInfo(workspaceId: string): Promise<ProjectConfiguration | undefined> {
    return this.currentProject;
  }

  /**
   * 获取工作区会话列表
   */
  async getSessions(workspaceId: string): Promise<SessionData[]> {
    // 在实际实现中，这里应该从工作区的会话目录中加载
    // 目前返回模拟数据
    return [];
  }

  /**
   * 添加会话到工作区
   */
  async addSession(workspaceId: string, sessionId: string): Promise<void> {
    // 在实际实现中，这里应该更新工作区配置
    if (this.currentProject) {
      this.currentProject.metadata.totalSessions += 1;
      this.currentProject.updatedAt = new Date().toISOString();
    }
  }

  /**
   * 保存工作区
   */
  async saveWorkspace(workspaceId: string): Promise<void> {
    if (this.currentProject && this.projectRoot) {
      const configPath = path.join(this.projectRoot, this.PROJECT_CONFIG_FILE);
      await fs.writeFile(configPath, JSON.stringify(this.currentProject, null, 2));
    }
  }

  /**
   * 加载工作区
   */
  async loadWorkspace(workspaceId: string): Promise<{ sessions: SessionData[] }> {
    // 模拟加载工作区数据
    return {
      sessions: []
    };
  }

  /**
   * 迁移工作区
   */
  async migrateWorkspace(legacyConfigPath: string): Promise<string> {
    // 读取旧配置
    const legacyData = JSON.parse(await fs.readFile(legacyConfigPath, 'utf-8'));

    // 生成新的工作区ID
    const workspaceId = `migrated-workspace-${Date.now()}`;

    // 创建新的配置格式
    const migratedConfig: ProjectConfiguration = {
      name: legacyData.name || 'Migrated Workspace',
      version: '2.0.0', // 升级版本
      description: 'Migrated from legacy format',
      createdAt: legacyData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      structure: {
        sessionsDir: 'sessions',
        dataDir: 'data',
        analysisDir: 'analysis',
        reportsDir: 'reports',
        configDir: 'config',
        tempDir: 'temp'
      },
      settings: {
        defaultSampleRate: 24000000,
        defaultChannelCount: 16,
        autoBackup: true,
        compressionEnabled: true,
        collaborationEnabled: false
      },
      metadata: {
        totalSessions: legacyData.sessions?.length || 0,
        totalDataSize: 0,
        tags: []
      }
    };

    this.currentProject = migratedConfig;

    return workspaceId;
  }

  /**
   * 创建新项目（支持两种调用方式）
   */
  async createProject(options: ProjectCreationOptions): Promise<void>;
  async createProject(
    projectPath: string,
    config: Partial<ProjectConfiguration>,
    template?: string
  ): Promise<void>;
  async createProject(
    optionsOrPath: ProjectCreationOptions | string,
    config?: Partial<ProjectConfiguration>,
    template?: string
  ): Promise<void> {
    // 如果第一个参数是对象，使用新的接口
    if (typeof optionsOrPath === 'object') {
      const options = optionsOrPath as ProjectCreationOptions;
      return this.createProjectFromOptions(options);
    }

    // 否则使用原来的接口
    return this.createProjectFromParameters(optionsOrPath, config!, template);
  }

  /**
   * 从选项创建项目
   */
  private async createProjectFromOptions(options: ProjectCreationOptions): Promise<void> {
    const config: Partial<ProjectConfiguration> = {
      name: options.name,
      description: options.description,
      author: options.author
    };
    return this.createProjectFromParameters(options.location, config, options.template);
  }

  /**
   * 从参数创建项目（原始实现）
   */
  private async createProjectFromParameters(
    projectPath: string,
    config: Partial<ProjectConfiguration>,
    template?: string
  ): Promise<void> {
    try {
      const projectName = config.name || path.basename(projectPath);

      // 创建项目根目录
      await fs.mkdir(projectPath, { recursive: true });

      // 应用项目模板
      if (template) {
        await this.applyProjectTemplate(projectPath, template);
      }

      // 创建项目配置
      const projectConfig: ProjectConfiguration = {
        name: projectName,
        version: '1.0.0',
        description: config.description || `Logic Analyzer Project: ${projectName}`,
        author: config.author || process.env.USERNAME || process.env.USER || 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        structure: {
          sessionsDir: 'sessions',
          dataDir: 'data',
          analysisDir: 'analysis',
          reportsDir: 'reports',
          configDir: 'config',
          tempDir: 'temp'
        },

        settings: {
          defaultSampleRate: 1000000,
          defaultChannelCount: 8,
          autoBackup: true,
          compressionEnabled: true,
          collaborationEnabled: false,
          ...config.settings
        },

        metadata: {
          totalSessions: 0,
          totalDataSize: 0,
          tags: config.metadata?.tags || []
        }
      };

      // 创建目录结构
      await this.createProjectStructure(projectPath, projectConfig);

      // 保存项目配置
      await this.saveProjectConfiguration(projectPath, projectConfig);

      // 创建项目锁文件
      await this.createProjectLock(projectPath);

      // 在VSCode中打开项目
      const uri = vscode.Uri.file(projectPath);
      await vscode.commands.executeCommand('vscode.openFolder', uri);

      this.emit('projectCreated', projectConfig);

      vscode.window.showInformationMessage(`项目 "${projectName}" 创建成功`);

    } catch (error) {
      throw new Error(`创建项目失败: ${error}`);
    }
  }

  /**
   * 打开现有项目
   */
  async openProject(projectPath: string): Promise<void> {
    try {
      // 检查项目配置文件
      const configPath = path.join(projectPath, this.PROJECT_CONFIG_FILE);
      if (!await this.fileExists(configPath)) {
        throw new Error('不是有效的Logic Analyzer项目目录');
      }

      // 加载项目配置
      const projectConfig = await this.loadProjectConfiguration(projectPath);

      // 验证项目结构
      await this.validateProjectStructure(projectPath, projectConfig);

      // 设置当前项目
      this.currentProject = projectConfig;
      this.projectRoot = projectPath;

      // 启动文件监听
      this.setupFileWatchers(projectPath);

      // 启动自动备份
      if (projectConfig.settings.autoBackup) {
        this.startAutoBackup();
      }

      this.emit('projectOpened', projectConfig);

    } catch (error) {
      throw new Error(`打开项目失败: ${error}`);
    }
  }

  /**
   * 关闭当前项目
   */
  async closeProject(): Promise<void> {
    if (!this.currentProject) return;

    try {
      // 停止文件监听
      this.stopFileWatchers();

      // 停止自动备份
      this.stopAutoBackup();

      // 清理临时文件
      if (this.projectRoot) {
        await this.cleanupTempFiles();
      }

      // 移除项目锁文件
      if (this.projectRoot) {
        await this.removeProjectLock(this.projectRoot);
      }

      this.emit('projectClosed', this.currentProject);

      this.currentProject = undefined;
      this.projectRoot = undefined;

    } catch (error) {
      console.error('关闭项目时出错:', error);
    }
  }

  /**
   * 获取当前项目
   */
  getCurrentProject(): ProjectConfiguration | null {
    return this.currentProject || null;
  }

  /**
   * 检查是否有活动项目
   */
  hasActiveProject(): boolean {
    return !!this.currentProject;
  }

  /**
   * 获取项目信息
   */
  getProjectInfo(): ProjectConfiguration | null {
    return this.getCurrentProject();
  }

  /**
   * 更新项目配置
   */
  async updateProject(updates: Partial<ProjectConfiguration>): Promise<void> {
    if (!this.currentProject || !this.projectRoot) {
      throw new Error('没有打开的项目');
    }

    this.currentProject = {
      ...this.currentProject,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveProjectConfiguration(this.projectRoot, this.currentProject);

    this.emit('projectUpdated', this.currentProject);
  }

  /**
   * 获取项目文件列表
   */
  async getProjectFiles(type?: FileType): Promise<ProjectFile[]> {
    if (!this.projectRoot) {
      throw new Error('没有打开的项目');
    }

    const files: ProjectFile[] = [];
    const directories = type ? [this.getDirectoryForFileType(type)] :
      Object.values(this.currentProject!.structure);

    for (const dir of directories) {
      const dirPath = path.join(this.projectRoot, dir);
      if (await this.fileExists(dirPath)) {
        const dirFiles = await this.scanDirectory(dirPath, type);
        files.push(...dirFiles);
      }
    }

    return files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * 添加文件到项目
   */
  async addFileToProject(
    filePath: string,
    type: FileType,
    targetPath?: string,
    metadata?: any
  ): Promise<string> {
    if (!this.projectRoot) {
      throw new Error('没有打开的项目');
    }

    let finalTargetPath: string;
    if (targetPath) {
      // 如果指定了目标路径，使用它
      finalTargetPath = path.join(this.projectRoot, targetPath);
    } else {
      // 否则，使用默认目录
      const targetDir = path.join(this.projectRoot, this.getDirectoryForFileType(type));
      await fs.mkdir(targetDir, { recursive: true });
      const fileName = path.basename(filePath);
      finalTargetPath = path.join(targetDir, fileName);
    }

    // 确保目标目录存在
    await fs.mkdir(path.dirname(finalTargetPath), { recursive: true });

    // 复制文件
    await fs.copyFile(filePath, finalTargetPath);

    // 创建文件信息
    const stats = await fs.stat(finalTargetPath);
    const fileId = this.generateFileId();
    const projectFile: ProjectFile = {
      id: fileId,
      name: path.basename(finalTargetPath),
      path: path.relative(this.projectRoot, finalTargetPath),
      type,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      tags: [],
      metadata
    };

    this.emit('fileAdded', projectFile);

    return fileId;
  }

  /**
   * 删除项目文件
   */
  async removeFileFromProject(fileId: string): Promise<void> {
    if (!this.projectRoot) {
      throw new Error('没有打开的项目');
    }

    const files = await this.getProjectFiles();
    const file = files.find(f => f.id === fileId);

    if (!file) {
      throw new Error('文件不存在');
    }

    const fullPath = path.join(this.projectRoot, file.path);
    await fs.rm(fullPath, { force: true });

    this.emit('fileRemoved', file);
  }

  /**
   * 创建项目备份
   */
  async createBackup(includeData: boolean = true): Promise<string> {
    if (!this.projectRoot || !this.currentProject) {
      throw new Error('没有打开的项目');
    }

    const backupName = `backup_${this.currentProject.name}_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`;
    const backupDir = path.join(this.projectRoot, this.BACKUP_DIR);
    const backupPath = path.join(backupDir, `${backupName}.zip`);

    await fs.mkdir(backupDir, { recursive: true });

    // 简化的备份实现 - 实际应使用压缩库
    const backupData = {
      project: this.currentProject,
      timestamp: new Date().toISOString(),
      includeData,
      files: await this.getProjectFiles()
    };

    await fs.writeFile(
      path.join(backupDir, `${backupName}.json`),
      JSON.stringify(backupData, null, 2)
    );

    // 更新项目元数据
    await this.updateProject({
      metadata: {
        ...this.currentProject.metadata,
        lastBackup: new Date().toISOString()
      }
    });

    this.emit('backupCreated', backupPath);

    return backupPath;
  }

  /**
   * 恢复项目备份
   */
  async restoreBackup(backupPath: string): Promise<void> {
    if (!this.projectRoot) {
      throw new Error('没有打开的项目');
    }

    try {
      // 检查备份文件是否存在
      await fs.access(backupPath);

      // 简化的恢复实现
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));

      if (backupData.project) {
        await this.updateProject(backupData.project);
      }

      this.emit('backupRestored', backupPath);

      vscode.window.showInformationMessage('项目备份恢复成功');

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('备份文件不存在');
      }
      throw new Error(`恢复备份失败: ${error}`);
    }
  }

  /**
   * 获取项目模板
   */
  getProjectTemplates(): ProjectTemplate[] {
    return [
      {
        name: 'basic',
        displayName: '基础项目',
        description: '标准的逻辑分析器项目结构',
        icon: 'folder',
        structure: ['sessions', 'data', 'analysis', 'reports', 'config'],
        files: [
          {
            path: 'README.md',
            content: this.getReadmeTemplate()
          },
          {
            path: '.gitignore',
            content: this.getGitignoreTemplate()
          }
        ],
        settings: {
          defaultSampleRate: 1000000,
          defaultChannelCount: 8,
          autoBackup: true,
          compressionEnabled: true
        }
      },
      {
        name: 'protocol-analysis',
        displayName: '协议分析项目',
        description: '专门用于协议分析的项目结构',
        icon: 'symbol-interface',
        structure: ['sessions', 'data', 'analysis', 'reports', 'config', 'protocols', 'decoders'],
        files: [
          {
            path: 'README.md',
            content: this.getProtocolAnalysisReadmeTemplate()
          },
          {
            path: 'protocols/README.md',
            content: '# 协议定义\n\n这个目录包含自定义协议定义文件。'
          }
        ],
        settings: {
          defaultSampleRate: 10000000,
          defaultChannelCount: 16,
          autoBackup: true,
          compressionEnabled: true
        }
      },
      {
        name: 'team-collaboration',
        displayName: '团队协作项目',
        description: '支持团队协作的项目结构',
        icon: 'organization',
        structure: ['sessions', 'data', 'analysis', 'reports', 'config', 'shared', 'docs'],
        files: [
          {
            path: 'README.md',
            content: this.getCollaborationReadmeTemplate()
          },
          {
            path: 'docs/CONTRIBUTING.md',
            content: '# 贡献指南\n\n如何为这个项目做贡献的说明。'
          }
        ],
        settings: {
          defaultSampleRate: 1000000,
          defaultChannelCount: 8,
          autoBackup: true,
          compressionEnabled: true,
          collaborationEnabled: true
        }
      }
    ];
  }

  /**
   * 获取项目统计信息
   */
  async getProjectStatistics(): Promise<{
    fileCount: number;
    totalSize: number;
    sessionCount: number;
    lastActivity: string;
    storageUsage: { [type: string]: number };
  }> {
    if (!this.projectRoot) {
      throw new Error('没有打开的项目');
    }

    const files = await this.getProjectFiles();
    const sessionFiles = files.filter(f => f.type === FileType.Session);

    const storageUsage: { [type: string]: number } = {};
    let totalSize = 0;

    for (const file of files) {
      totalSize += file.size;
      storageUsage[file.type] = (storageUsage[file.type] || 0) + file.size;
    }

    const lastActivity = files.length > 0 ?
      Math.max(...files.map(f => new Date(f.updatedAt).getTime())) :
      new Date().getTime();

    return {
      fileCount: files.length,
      totalSize,
      sessionCount: sessionFiles.length,
      lastActivity: new Date(lastActivity).toISOString(),
      storageUsage
    };
  }

  // 私有方法

  /**
   * 设置工作区监听器
   */
  private setupWorkspaceWatchers(): void {
    // 监听工作区变化
    vscode.workspace.onDidChangeWorkspaceFolders(event => {
      if (event.added.length > 0) {
        this.initializeCurrentProject();
      }
      if (event.removed.length > 0) {
        this.closeProject();
      }
    });
  }

  /**
   * 初始化当前项目
   */
  private async initializeCurrentProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const configPath = path.join(workspaceFolder.uri.fsPath, this.PROJECT_CONFIG_FILE);
    if (await this.fileExists(configPath)) {
      try {
        await this.openProject(workspaceFolder.uri.fsPath);
      } catch (error) {
        console.error('初始化项目失败:', error);
      }
    }
  }

  /**
   * 应用项目模板
   */
  private async applyProjectTemplate(projectPath: string, templateName: string): Promise<void> {
    const template = this.getProjectTemplates().find(t => t.name === templateName);
    if (!template) return;

    // 创建目录结构
    for (const dir of template.structure) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }

    // 创建模板文件
    for (const file of template.files) {
      const filePath = path.join(projectPath, file.path);
      const fileDir = path.dirname(filePath);
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf8');
    }
  }

  /**
   * 创建项目结构
   */
  private async createProjectStructure(
    projectPath: string,
    config: ProjectConfiguration
  ): Promise<void> {
    for (const dir of Object.values(config.structure)) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }
  }

  /**
   * 保存项目配置
   */
  private async saveProjectConfiguration(
    projectPath: string,
    config: ProjectConfiguration
  ): Promise<void> {
    const configPath = path.join(projectPath, this.PROJECT_CONFIG_FILE);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  /**
   * 加载项目配置
   */
  private async loadProjectConfiguration(projectPath: string): Promise<ProjectConfiguration> {
    const configPath = path.join(projectPath, this.PROJECT_CONFIG_FILE);
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * 验证项目结构
   */
  private async validateProjectStructure(
    projectPath: string,
    config: ProjectConfiguration
  ): Promise<void> {
    for (const [key, dir] of Object.entries(config.structure)) {
      const dirPath = path.join(projectPath, dir);
      if (!await this.fileExists(dirPath)) {
        await fs.mkdir(dirPath, { recursive: true });
        console.warn(`重新创建缺失的目录: ${dir}`);
      }
    }
  }

  /**
   * 设置文件监听器
   */
  private setupFileWatchers(projectPath: string): void {
    this.stopFileWatchers(); // 清理旧的监听器

    const patterns = [
      path.join(projectPath, '**/*.lacsession'),
      path.join(projectPath, '**/*.lac'),
      path.join(projectPath, this.PROJECT_CONFIG_FILE)
    ];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidCreate(uri => this.emit('fileCreated', uri.fsPath));
      watcher.onDidChange(uri => this.emit('fileChanged', uri.fsPath));
      watcher.onDidDelete(uri => this.emit('fileDeleted', uri.fsPath));

      this.fileWatchers.set(pattern, watcher);
    }
  }

  /**
   * 停止文件监听器
   */
  private stopFileWatchers(): void {
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }
    this.fileWatchers.clear();
  }

  /**
   * 启动自动备份
   */
  private startAutoBackup(): void {
    this.stopAutoBackup();

    // 每24小时自动备份一次
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup(false); // 不包含大数据文件
      } catch (error) {
        console.error('自动备份失败:', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 停止自动备份
   */
  private stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }

  /**
   * 清理临时文件
   */
  private async cleanupTempFiles(): Promise<void> {
    if (!this.projectRoot || !this.currentProject) return;

    const tempDir = path.join(this.projectRoot, this.currentProject.structure.tempDir);
    if (await this.fileExists(tempDir)) {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        try {
          await fs.unlink(path.join(tempDir, file));
        } catch (error) {
          // 忽略删除失败，继续清理其他文件
          console.warn(`删除临时文件失败: ${file}`, error);
        }
      }
    }
  }

  /**
   * 扫描目录获取文件列表
   */
  private async scanDirectory(dirPath: string, type?: FileType): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(dirPath, entry.name);
          const stats = await fs.stat(filePath);
          const fileType = this.detectFileType(entry.name);

          if (!type || fileType === type) {
            files.push({
              id: this.generateFileId(),
              name: entry.name,
              path: path.relative(this.projectRoot!, filePath),
              type: fileType,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              updatedAt: stats.mtime.toISOString(),
              tags: []
            });
          }
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${dirPath}`, error);
    }

    return files;
  }

  /**
   * 检测文件类型
   */
  private detectFileType(fileName: string): FileType {
    const ext = path.extname(fileName).toLowerCase();

    switch (ext) {
      case '.lacsession':
        return FileType.Session;
      case '.lac':
      case '.csv':
        return FileType.Data;
      case '.json':
        if (fileName.includes('config')) return FileType.Config;
        return FileType.Data;
      case '.html':
      case '.pdf':
        return FileType.Report;
      case '.js':
      case '.ts':
      case '.py':
        return FileType.Script;
      default:
        return FileType.Data;
    }
  }

  /**
   * 根据文件类型获取目录
   */
  private getDirectoryForFileType(type: FileType): string {
    if (!this.currentProject) return '';

    switch (type) {
      case FileType.Session:
        return this.currentProject.structure.sessionsDir;
      case FileType.Data:
        return this.currentProject.structure.dataDir;
      case FileType.Analysis:
        return this.currentProject.structure.analysisDir;
      case FileType.Report:
        return this.currentProject.structure.reportsDir;
      case FileType.Config:
        return this.currentProject.structure.configDir;
      default:
        return this.currentProject.structure.dataDir;
    }
  }

  /**
   * 生成文件ID
   */
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 创建项目锁文件
   */
  private async createProjectLock(projectPath: string): Promise<void> {
    const lockPath = path.join(projectPath, this.PROJECT_LOCK_FILE);
    const lockData = {
      pid: process.pid,
      user: process.env.USERNAME || process.env.USER || 'unknown',
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(lockPath, JSON.stringify(lockData), 'utf8');
  }

  /**
   * 移除项目锁文件
   */
  private async removeProjectLock(projectPath: string): Promise<void> {
    const lockPath = path.join(projectPath, this.PROJECT_LOCK_FILE);
    try {
      await fs.unlink(lockPath);
    } catch (error) {
      // 忽略删除失败
    }
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

  // 模板内容生成方法

  private getReadmeTemplate(): string {
    return `# Logic Analyzer Project

这是一个使用VSCode Logic Analyzer插件创建的项目。

## 项目结构

- \`sessions/\` - 采集会话文件
- \`data/\` - 原始数据文件
- \`analysis/\` - 分析结果
- \`reports/\` - 生成的报告
- \`config/\` - 配置文件

## 使用方法

1. 在VSCode中安装Logic Analyzer插件
2. 打开命令面板 (Ctrl+Shift+P)
3. 运行 "Logic Analyzer: Open"

## 开始分析

你可以从连接逻辑分析器设备开始，或者加载已有的采集数据。
`;
  }

  private getProtocolAnalysisReadmeTemplate(): string {
    return `# 协议分析项目

专门用于协议分析的Logic Analyzer项目。

## 特性

- 支持多种标准协议（I2C, SPI, UART等）
- 自定义协议解码器
- 高级时序分析
- 协议合规性检查

## 目录说明

- \`protocols/\` - 协议定义文件
- \`decoders/\` - 自定义解码器
- \`sessions/\` - 采集会话
- \`analysis/\` - 分析结果

## 使用指南

1. 将协议定义放在 \`protocols/\` 目录
2. 自定义解码器放在 \`decoders/\` 目录
3. 开始分析前配置好协议参数
`;
  }

  private getCollaborationReadmeTemplate(): string {
    return `# 团队协作项目

支持团队协作的Logic Analyzer项目。

## 协作功能

- 共享采集会话
- 版本控制集成
- 分析结果同步
- 团队报告生成

## 目录说明

- \`shared/\` - 共享文件
- \`docs/\` - 项目文档
- \`sessions/\` - 采集会话
- \`reports/\` - 团队报告

## 协作指南

请参阅 \`docs/CONTRIBUTING.md\` 了解如何贡献。
`;
  }

  private getGitignoreTemplate(): string {
    return `# Logic Analyzer项目忽略文件

# 临时文件
temp/
*.tmp
*.temp

# 大数据文件
*.bigdata
data/*.raw

# 系统文件
.DS_Store
Thumbs.db

# 编译输出
*.compiled
build/

# 日志文件
*.log
logs/

# 缓存文件
.cache/
*.cache
`;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopFileWatchers();
    this.stopAutoBackup();
    this.removeAllListeners();
  }
}

// 导出单例实例
export const workspaceManager = new WorkspaceManager();
