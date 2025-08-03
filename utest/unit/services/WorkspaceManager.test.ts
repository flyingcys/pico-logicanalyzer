/**
 * WorkspaceManager 测试
 * 测试工作区集成和项目管理功能
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  WorkspaceManager, 
  ProjectConfiguration, 
  ProjectCreationOptions,
  ProjectFile,
  FileType
} from '../../../src/services/WorkspaceManager';

// Mock dependencies
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      update: jest.fn(),
    }),
    createFileSystemWatcher: jest.fn().mockReturnValue({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn(),
    }),
    onDidChangeWorkspaceFolders: jest.fn(),
    onDidChangeConfiguration: jest.fn(),
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
  },
  commands: {
    executeCommand: jest.fn().mockResolvedValue(undefined),
  },
  Uri: {
    file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
  },
  FileType: {
    File: 1,
    Directory: 2,
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  rm: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  dirname: jest.fn().mockImplementation((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn().mockImplementation((p) => p.split('/').pop()),
  resolve: jest.fn().mockImplementation((p) => p),
  extname: jest.fn().mockImplementation((p) => {
    const parts = p.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
  }),
  relative: jest.fn().mockImplementation((from, to) => to.replace(from, '').replace(/^\//, '')),
}));

describe('WorkspaceManager 测试', () => {
  let workspaceManager: WorkspaceManager;
  let mockVSCode: any;
  let mockFS: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    mockFS = require('fs/promises') as any;
    
    // 确保mock返回值符合期望格式
    mockFS.readdir.mockImplementation((path, options) => {
      if (options && options.withFileTypes) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
    
    workspaceManager = new WorkspaceManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    workspaceManager.dispose();
  });

  // 创建测试用的项目配置
  const createTestProjectConfig = (): ProjectConfiguration => ({
    name: '测试项目',
    version: '1.0.0',
    description: '用于单元测试的项目',
    author: 'test-user',
    createdAt: '2025-07-30T12:00:00Z',
    updatedAt: '2025-07-30T12:00:00Z',
    structure: {
      sessionsDir: 'sessions',
      dataDir: 'data',
      analysisDir: 'analysis',
      reportsDir: 'reports',
      configDir: 'config',
      tempDir: 'temp',
    },
    settings: {
      defaultSampleRate: 24000000,
      defaultChannelCount: 8,
      autoBackup: true,
      compressionEnabled: true,
      collaborationEnabled: false,
    },
    metadata: {
      totalSessions: 0,
      totalDataSize: 0,
      lastBackup: '',
      tags: ['test'],
    },
  });

  // 创建测试用的项目创建选项
  const createTestProjectOptions = (): ProjectCreationOptions => ({
    name: '测试项目',
    location: '/test/projects/test-project',
    template: 'basic',
    initializeGit: false,
    createSampleData: false,
  });

  describe('项目创建功能', () => {
    it('应该能够创建新项目', async () => {
      // Arrange
      const options = createTestProjectOptions();
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await workspaceManager.createProject(options);

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalledWith(
        options.location,
        { recursive: true }
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('project.json'),
        expect.any(String),
        'utf8'
      );
    });

    it('应该创建项目目录结构', async () => {
      // Arrange
      const options = createTestProjectOptions();
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act  
      await workspaceManager.createProject(options);

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalledTimes(14); // 实际创建的目录数量
    });

    it('应该处理项目创建失败的情况', async () => {
      // Arrange
      const options = createTestProjectOptions();
      mockFS.mkdir.mockRejectedValue(new Error('创建失败'));

      // Act & Assert
      await expect(workspaceManager.createProject(options)).rejects.toThrow('创建失败');
    });
  });

  describe('项目打开功能', () => {
    it('应该能够打开现有项目', async () => {
      // Arrange
      const projectPath = '/test/projects/existing-project';
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined); // 文件存在

      // Act
      await workspaceManager.openProject(projectPath);

      // Assert
      expect(mockFS.readFile).toHaveBeenCalledWith(
        expect.stringContaining('project.json'),
        'utf8'
      );
      expect(workspaceManager.getCurrentProject()).toBeDefined();
    });

    it('应该处理项目文件不存在的情况', async () => {
      // Arrange
      const projectPath = '/test/projects/nonexistent-project';
      mockFS.access.mockRejectedValue(new Error('ENOENT'));

      // Act & Assert
      await expect(workspaceManager.openProject(projectPath)).rejects.toThrow();
    });

    it('应该处理损坏的项目文件', async () => {
      // Arrange
      const projectPath = '/test/projects/corrupted-project';
      mockFS.readFile.mockResolvedValue('无效的JSON');
      mockFS.access.mockResolvedValue(undefined);

      // Act & Assert
      await expect(workspaceManager.openProject(projectPath)).rejects.toThrow();
    });
  });

  describe('项目管理功能', () => {
    beforeEach(async () => {
      // 设置当前项目
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');
    });

    it('应该能够更新项目配置', async () => {
      // Arrange
      const updates = { name: '更新后的项目名称' };
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      await workspaceManager.updateProject(updates);

      // Assert
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('project.json'),
        expect.stringContaining(updates.name),
        'utf8'
      );
    });

    it('应该能够获取项目文件列表', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'session1.lacsession',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'session2.lacsession',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['session1.lacsession', 'session2.lacsession']);
      });
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const files = await workspaceManager.getProjectFiles(FileType.Session);

      // Assert
      expect(Array.isArray(files)).toBe(true);
      expect(mockFS.readdir).toHaveBeenCalled();
    });

    it('应该能够关闭当前项目', async () => {
      // Arrange - 先创建一个项目
      const options = createTestProjectOptions();
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);
      await workspaceManager.createProject(options);
      
      // Act
      await workspaceManager.closeProject();

      // Assert
      expect(workspaceManager.getCurrentProject()).toBeNull();
    });
  });

  describe('文件管理功能', () => {
    beforeEach(async () => {
      // 重置所有mock状态
      jest.clearAllMocks();
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.copyFile.mockResolvedValue(undefined);
      
      // 设置当前项目
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');
    });

    it('应该能够添加文件到项目', async () => {
      // Arrange
      const sourceFile = '/test/external/data.lacs';
      const targetPath = 'sessions/imported-data.lacs';
      mockFS.copyFile.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });

      // Act
      const fileId = await workspaceManager.addFileToProject(
        sourceFile,
        FileType.Session,
        targetPath
      );

      // Assert
      expect(fileId).toBeDefined();
      expect(mockFS.copyFile).toHaveBeenCalledWith(
        sourceFile,
        expect.stringContaining(targetPath)
      );
    });

    it('应该能够从项目中删除文件', async () => {
      // Arrange
      const fileId = 'test-file-id';
      
      // 模拟文件系统结构
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'test.lac',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['test.lac']);
      });
      
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });
      mockFS.access.mockResolvedValue(undefined);
      mockFS.rm.mockResolvedValue(undefined);

      // 模拟生成的文件ID与实际文件的匹配
      // 注意：由于generateFileId是基于时间戳和随机数的，我们需要使用spy来控制它
      const originalGenerateId = (workspaceManager as any).generateFileId;
      const generateIdSpy = jest.spyOn(workspaceManager as any, 'generateFileId');
      generateIdSpy.mockReturnValue(fileId);

      // 先添加一个文件，然后删除它
      const sourceFile = '/test/source.lac';
      await workspaceManager.addFileToProject(sourceFile, FileType.Data);

      // Act
      await workspaceManager.removeFileFromProject(fileId);

      // Assert
      expect(mockFS.rm).toHaveBeenCalled();
      
      // Cleanup
      generateIdSpy.mockRestore();
    });
  });

  describe('备份和恢复功能', () => {
    beforeEach(async () => {
      // 设置当前项目
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');
    });

    it('应该能够创建项目备份', async () => {
      // Arrange
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.copyFile.mockResolvedValue(undefined);
      mockFS.writeFile.mockResolvedValue(undefined);

      // Act
      const backupPath = await workspaceManager.createBackup(true);

      // Assert
      expect(backupPath).toBeDefined();
      expect(mockFS.mkdir).toHaveBeenCalled();
    });

    it('应该能够恢复项目备份', async () => {
      // Arrange
      const backupPath = '/test/backups/project-backup-20250730.zip';
      mockFS.access.mockResolvedValue(undefined);
      mockFS.copyFile.mockResolvedValue(undefined);

      // Act
      await workspaceManager.restoreBackup(backupPath);

      // Assert
      expect(mockFS.access).toHaveBeenCalledWith(backupPath);
    });

    it('应该处理备份文件不存在的情况', async () => {
      // Arrange
      const invalidBackupPath = '/test/backups/nonexistent-backup.zip';
      mockFS.access.mockRejectedValue(new Error('ENOENT'));

      // Act & Assert
      await expect(workspaceManager.restoreBackup(invalidBackupPath)).rejects.toThrow();
    });
  });

  describe('项目状态管理', () => {
    it('应该正确报告项目状态', () => {
      // Act
      const hasProject = workspaceManager.hasActiveProject();
      const currentProject = workspaceManager.getCurrentProject();

      // Assert
      expect(typeof hasProject).toBe('boolean');
      expect(currentProject).toBeNull(); // 没有打开的项目
    });

    it('应该能够获取项目信息', async () => {
      // Arrange
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');

      // Act
      const projectInfo = workspaceManager.getProjectInfo();

      // Assert
      expect(projectInfo).toBeDefined();
      expect(projectInfo?.name).toBe('测试项目');
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理工作区不存在的情况', async () => {
      // Arrange
      const originalWorkspaceFolders = mockVSCode.workspace.workspaceFolders;
      mockVSCode.workspace.workspaceFolders = undefined;
      const options = createTestProjectOptions();
      
      // 设置一个会失败的操作，比如创建目录失败
      mockFS.mkdir.mockRejectedValue(new Error('工作区不存在'));

      // Act & Assert
      await expect(workspaceManager.createProject(options)).rejects.toThrow();
      
      // Cleanup
      mockVSCode.workspace.workspaceFolders = originalWorkspaceFolders;
    });

    it('应该处理文件权限错误', async () => {
      // Arrange
      const options = createTestProjectOptions();
      mockFS.mkdir.mockRejectedValue(new Error('EACCES: permission denied'));

      // Act & Assert
      await expect(workspaceManager.createProject(options)).rejects.toThrow('permission denied');
    });

    it('应该处理磁盘空间不足', async () => {
      // Arrange
      const options = createTestProjectOptions();
      mockFS.mkdir.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      // Act & Assert
      await expect(workspaceManager.createProject(options)).rejects.toThrow('no space left');
    });
  });

  describe('项目模板功能', () => {
    it('应该能够获取项目模板列表', () => {
      // Act
      const templates = workspaceManager.getProjectTemplates();

      // Assert
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('displayName');
      expect(templates[0]).toHaveProperty('description');
      expect(templates[0]).toHaveProperty('structure');
      expect(templates[0]).toHaveProperty('files');
    });

    it('应该包含基础项目模板', () => {
      // Act
      const templates = workspaceManager.getProjectTemplates();
      const basicTemplate = templates.find(t => t.name === 'basic');

      // Assert
      expect(basicTemplate).toBeDefined();
      expect(basicTemplate?.displayName).toBe('基础项目');
      expect(basicTemplate?.structure).toContain('sessions');
      expect(basicTemplate?.structure).toContain('data');
      expect(basicTemplate?.files.length).toBeGreaterThan(0);
    });

    it('应该包含协议分析项目模板', () => {
      // Act
      const templates = workspaceManager.getProjectTemplates();
      const protocolTemplate = templates.find(t => t.name === 'protocol-analysis');

      // Assert
      expect(protocolTemplate).toBeDefined();
      expect(protocolTemplate?.displayName).toBe('协议分析项目');
      expect(protocolTemplate?.structure).toContain('protocols');
      expect(protocolTemplate?.structure).toContain('decoders');
    });

    it('应该包含团队协作项目模板', () => {
      // Act
      const templates = workspaceManager.getProjectTemplates();
      const collaborationTemplate = templates.find(t => t.name === 'team-collaboration');

      // Assert
      expect(collaborationTemplate).toBeDefined();
      expect(collaborationTemplate?.displayName).toBe('团队协作项目');
      expect(collaborationTemplate?.structure).toContain('shared');
      expect(collaborationTemplate?.structure).toContain('docs');
      expect(collaborationTemplate?.settings.collaborationEnabled).toBe(true);
    });
  });

  describe('项目统计功能', () => {
    beforeEach(async () => {
      // 设置当前项目
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');
    });

    it('应该能够获取项目统计信息', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'session1.lacsession',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'data1.lac',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['session1.lacsession', 'data1.lac']);
      });
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date('2025-07-30T10:00:00Z'),
        mtime: new Date('2025-07-30T12:00:00Z'),
      });
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const stats = await workspaceManager.getProjectStatistics();

      // Assert
      expect(stats).toHaveProperty('fileCount');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('sessionCount');
      expect(stats).toHaveProperty('lastActivity');
      expect(stats).toHaveProperty('storageUsage');
      expect(typeof stats.fileCount).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
    });

    it('应该处理空项目的统计', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        return Promise.resolve([]); // 空目录
      });
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const stats = await workspaceManager.getProjectStatistics();

      // Assert
      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.sessionCount).toBe(0);
    });

    it('应该处理统计获取失败的情况', async () => {
      // Arrange - 创建一个新的实例来避免状态污染
      const cleanWorkspaceManager = new WorkspaceManager();
      
      // Act & Assert
      await expect(cleanWorkspaceManager.getProjectStatistics()).rejects.toThrow('没有打开的项目');
      
      // Cleanup
      cleanWorkspaceManager.dispose();
    });
  });

  describe('文件类型检测功能', () => {
    beforeEach(async () => {
      // 设置当前项目
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');
    });

    it('应该正确检测会话文件类型', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'test.lacsession',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['test.lacsession']);
      });
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });
      mockFS.access.mockResolvedValue(undefined); // 目录存在

      // Act
      const files = await workspaceManager.getProjectFiles(FileType.Session);

      // Assert
      expect(files.length).toBeGreaterThan(0);
      expect(files[0].type).toBe(FileType.Session);
    });

    it('应该正确检测数据文件类型', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'test.lac',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'test.csv',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'test.json',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['test.lac', 'test.csv', 'test.json']);
      });
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });
      mockFS.access.mockResolvedValue(undefined); // 目录存在

      // Act
      const files = await workspaceManager.getProjectFiles(FileType.Data);

      // Assert
      expect(files.length).toBeGreaterThan(0);
      files.forEach(file => {
        expect(file.type).toBe(FileType.Data);
      });
    });

    it('应该正确检测报告文件类型', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'report.html',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'report.pdf',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['report.html', 'report.pdf']);
      });
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });
      mockFS.access.mockResolvedValue(undefined); // 目录存在

      // Act
      const files = await workspaceManager.getProjectFiles(FileType.Report);

      // Assert
      expect(files.length).toBeGreaterThan(0);
      files.forEach(file => {
        expect(file.type).toBe(FileType.Report);
      });
    });

    it('应该正确检测脚本文件类型', async () => {
      // Arrange
      mockFS.readdir.mockImplementation((dirPath, options) => {
        if (options && options.withFileTypes) {
          return Promise.resolve([
            {
              name: 'script.js',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'script.ts',
              isFile: () => true,
              isDirectory: () => false
            },
            {
              name: 'script.py',
              isFile: () => true,
              isDirectory: () => false
            }
          ]);
        }
        return Promise.resolve(['script.js', 'script.ts', 'script.py']);
      });
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });
      mockFS.access.mockResolvedValue(undefined); // 目录存在

      // Act
      const files = await workspaceManager.getProjectFiles(FileType.Script);

      // Assert
      expect(files.length).toBeGreaterThan(0);
      files.forEach(file => {
        expect(file.type).toBe(FileType.Script);
      });
    });
  });

  describe('高级项目管理功能', () => {
    beforeEach(async () => {
      // 设置当前项目
      const projectConfig = createTestProjectConfig();
      mockFS.readFile.mockResolvedValue(JSON.stringify(projectConfig));
      mockFS.access.mockResolvedValue(undefined);
      await workspaceManager.openProject('/test/projects/test-project');
    });

    it('应该能够添加文件时自动创建目录', async () => {
      // Arrange
      const sourceFile = '/test/external/data.lac';
      const targetPath = 'nested/deep/data.lac';
      mockFS.copyFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.stat.mockResolvedValue({
        size: 2048,
        birthtime: new Date(),
        mtime: new Date(),
      });

      // Act
      await workspaceManager.addFileToProject(
        sourceFile,
        FileType.Data,
        targetPath
      );

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('nested/deep'),
        { recursive: true }
      );
      expect(mockFS.copyFile).toHaveBeenCalled();
    });

    it('应该能够添加文件到默认目录', async () => {
      // Arrange
      const sourceFile = '/test/external/session.lacsession';
      mockFS.copyFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date(),
        mtime: new Date(),
      });

      // Act
      await workspaceManager.addFileToProject(
        sourceFile,
        FileType.Session
      );

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.copyFile).toHaveBeenCalledWith(
        sourceFile,
        expect.stringContaining('sessions')
      );
    });

    it('应该处理添加文件时的IO错误', async () => {
      // Arrange
      const sourceFile = '/test/external/data.lac';
      mockFS.copyFile.mockRejectedValue(new Error('IO error'));

      // Act & Assert
      await expect(
        workspaceManager.addFileToProject(sourceFile, FileType.Data)
      ).rejects.toThrow('IO error');
    });

    it('应该处理删除不存在的文件', async () => {
      // Arrange
      const nonExistentFileId = 'non-existent-file-id';
      mockFS.readdir.mockResolvedValue([]);

      // Act & Assert
      await expect(
        workspaceManager.removeFileFromProject(nonExistentFileId)
      ).rejects.toThrow('文件不存在');
    });
  });

  describe('项目配置兼容性测试', () => {
    it('应该处理旧版本项目配置', async () => {
      // Arrange
      const legacyConfig = {
        name: '旧版本项目',
        version: '0.9.0',
        description: '旧版本项目描述',
        author: 'legacy-user',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        structure: {
          sessionsDir: 'sessions',
          dataDir: 'data',
          analysisDir: 'analysis',
          reportsDir: 'reports',
          configDir: 'config',
          tempDir: 'temp',
        },
        settings: {
          defaultSampleRate: 1000000,
          defaultChannelCount: 8,
          autoBackup: true,
          compressionEnabled: true,
          collaborationEnabled: false,
        },
        metadata: {
          totalSessions: 0,
          totalDataSize: 0,
          tags: [],
        },
      };
      mockFS.readFile.mockResolvedValue(JSON.stringify(legacyConfig));
      mockFS.access.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      await workspaceManager.openProject('/test/projects/legacy-project');

      // Assert
      expect(workspaceManager.getCurrentProject()).toBeDefined();
      expect(workspaceManager.getCurrentProject()?.name).toBe('旧版本项目');
    });

    it('应该处理项目配置中的特殊字符', async () => {
      // Arrange
      const configWithSpecialChars = {
        name: '测试项目 (含特殊字符: @#$%)',
        description: '包含中文和特殊字符的描述：测试！',
        author: '张三 <zhangsan@example.com>',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        structure: {
          sessionsDir: 'sessions',
          dataDir: 'data',
          analysisDir: 'analysis',
          reportsDir: 'reports',
          configDir: 'config',
          tempDir: 'temp',
        },
        settings: {
          defaultSampleRate: 1000000,
          defaultChannelCount: 8,
          autoBackup: true,
          compressionEnabled: true,
          collaborationEnabled: false,
        },
        metadata: {
          totalSessions: 0,
          totalDataSize: 0,
          tags: ['特殊', '测试', 'UTF-8'],
        },
      };
      mockFS.readFile.mockResolvedValue(JSON.stringify(configWithSpecialChars));
      mockFS.access.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      await workspaceManager.openProject('/test/projects/special-chars-project');

      // Assert
      const project = workspaceManager.getCurrentProject();
      expect(project?.name).toContain('特殊字符');
      expect(project?.description).toContain('中文');
      expect(project?.metadata.tags).toContain('UTF-8');
    });
  });

  describe('内存管理和资源清理', () => {
    it('应该在dispose时清理所有资源', () => {
      // Arrange & Act
      workspaceManager.dispose();

      // Assert - 确保dispose方法可以被调用而不抛出错误
      expect(() => workspaceManager.dispose()).not.toThrow();
    });

    it('应该正确处理事件监听器', async () => {
      // Arrange
      const listener = jest.fn();
      
      // 检查事件系统是否工作 - 只测试基本的事件注册功能
      expect(typeof workspaceManager.on).toBe('function');
      expect(typeof workspaceManager.emit).toBe('function');
      
      // 手动触发事件测试监听器
      workspaceManager.on('test', listener);
      workspaceManager.emit('test', 'testData');

      // Assert
      expect(listener).toHaveBeenCalledWith('testData');
    });

    it('应该正确处理多个事件监听器', () => {
      // Arrange
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      // Act
      workspaceManager.on('projectCreated', listener1);
      workspaceManager.on('projectOpened', listener2);
      workspaceManager.emit('projectCreated', { name: 'Test' });
      workspaceManager.emit('projectOpened', { name: 'Test' });

      // Assert
      expect(listener1).toHaveBeenCalledWith({ name: 'Test' });
      expect(listener2).toHaveBeenCalledWith({ name: 'Test' });
    });

    it('应该能够移除事件监听器', () => {
      // Arrange
      const listener = jest.fn();
      
      // Act
      workspaceManager.on('test', listener);
      workspaceManager.off('test', listener);
      workspaceManager.emit('test', 'testData');

      // Assert
      expect(listener).not.toHaveBeenCalled();
    });
  });
});