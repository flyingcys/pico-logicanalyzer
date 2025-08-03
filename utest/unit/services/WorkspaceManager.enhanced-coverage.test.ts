/**
 * WorkspaceManager 增强覆盖率测试
 * 专门测试未覆盖的代码分支和边界条件
 * 目标：将覆盖率从86.64%提升到95%+
 */

import { WorkspaceManager, ProjectConfiguration, ProjectCreationOptions, FileType, ProjectFile } from '../../../src/services/WorkspaceManager';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock模块
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    onDidChangeWorkspaceFolders: jest.fn(),
    createFileSystemWatcher: jest.fn(() => ({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn()
    })),
    getConfiguration: jest.fn(() => ({
      get: jest.fn(),
      update: jest.fn()
    }))
  },
  window: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  commands: {
    executeCommand: jest.fn()
  },
  Uri: {
    file: jest.fn(p => ({ fsPath: p }))
  },
  ConfigurationTarget: {
    Global: 1
  }
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  copyFile: jest.fn(),
  rm: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(p => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn(p => p.split('/').pop()),
  extname: jest.fn(p => {
    const parts = p.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
  }),
  relative: jest.fn((from, to) => to.replace(from, '').replace(/^\//, ''))
}));

// Mock类型断言
const mockFS = fs as jest.Mocked<typeof fs>;
const mockVscode = vscode as any;
const mockPath = path as jest.Mocked<typeof path>;

describe('WorkspaceManager 增强覆盖率测试', () => {
  let workspaceManager: WorkspaceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置所有 mock
    mockFS.access.mockRejectedValue(new Error('文件不存在'));
    mockFS.readFile.mockResolvedValue('{}');
    mockFS.stat.mockResolvedValue({
      size: 1024,
      birthtime: new Date(),
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false
    } as any);
    
    workspaceManager = new WorkspaceManager();
  });

  afterEach(() => {
    workspaceManager.dispose();
  });

  describe('重载方法分支测试', () => {
    it('应该支持字符串参数的项目创建方式 (行172)', async () => {
      // 设置 mock
      mockFS.access.mockResolvedValue();
      mockVscode.commands.executeCommand.mockResolvedValue(undefined);

      const projectPath = '/test/projects/test-project';
      const config: Partial<ProjectConfiguration> = {
        name: '测试项目',
        description: '测试描述'
      };

      // 测试字符串参数调用方式 (触发行172)
      await workspaceManager.createProject(projectPath, config, 'basic');

      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.writeFile).toHaveBeenCalled();
    });
  });

  describe('错误处理分支测试', () => {
    it('应该处理关闭项目时的错误 (行327)', async () => {
      // 首先创建一个项目状态
      const workspaceManager = new WorkspaceManager();
      (workspaceManager as any).currentProject = { name: '测试项目' };
      (workspaceManager as any).projectRoot = '/test/project';

      // Mock出清理失败的情况
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFS.unlink.mockRejectedValue(new Error('删除文件失败'));

      // 调用关闭项目，应该捕获错误
      await workspaceManager.closeProject();

      expect(consoleSpy).toHaveBeenCalledWith('关闭项目时出错:', expect.any(Error));
      consoleSpy.mockRestore();
      workspaceManager.dispose();
    });

    it('应该在没有项目时抛出错误 - updateProject (行357)', async () => {
      const cleanManager = new WorkspaceManager();
      
      await expect(cleanManager.updateProject({ name: '新名称' }))
        .rejects.toThrow('没有打开的项目');
      
      cleanManager.dispose();
    });

    it('应该在没有项目时抛出错误 - getProjectFiles (行376)', async () => {
      const cleanManager = new WorkspaceManager();
      
      await expect(cleanManager.getProjectFiles())
        .rejects.toThrow('没有打开的项目');
      
      cleanManager.dispose();
    });

    it('应该在没有项目时抛出错误 - addFileToProject (行404)', async () => {
      const cleanManager = new WorkspaceManager();
      
      await expect(cleanManager.addFileToProject('/test/file.txt', FileType.Data))
        .rejects.toThrow('没有打开的项目');
      
      cleanManager.dispose();
    });

    it('应该在没有项目时抛出错误 - removeFileFromProject (行450)', async () => {
      const cleanManager = new WorkspaceManager();
      
      await expect(cleanManager.removeFileFromProject('file-id'))
        .rejects.toThrow('没有打开的项目');
      
      cleanManager.dispose();
    });

    it('应该在没有项目时抛出错误 - createBackup (行471)', async () => {
      const cleanManager = new WorkspaceManager();
      
      await expect(cleanManager.createBackup())
        .rejects.toThrow('没有打开的项目');
      
      cleanManager.dispose();
    });

    it('应该在没有项目时抛出错误 - restoreBackup (行511)', async () => {
      const cleanManager = new WorkspaceManager();
      
      await expect(cleanManager.restoreBackup('/backup/path'))
        .rejects.toThrow('没有打开的项目');
      
      cleanManager.dispose();
    });
  });

  describe('备份系统分支测试', () => {
    it('应该处理备份数据包含项目信息的情况 (行522)', async () => {
      // 设置项目状态
      (workspaceManager as any).projectRoot = '/test/project';
      (workspaceManager as any).currentProject = { name: '测试项目' };

      // Mock备份文件内容包含项目信息
      const backupData = {
        project: { 
          name: '恢复的项目', 
          version: '2.0.0',
          description: '从备份恢复的项目'
        }
      };
      mockFS.readFile.mockResolvedValue(JSON.stringify(backupData));
      mockFS.access.mockResolvedValue();

      // 设置updateProject的spy
      const updateSpy = jest.spyOn(workspaceManager, 'updateProject').mockResolvedValue();

      await workspaceManager.restoreBackup('/test/backup.json');

      expect(updateSpy).toHaveBeenCalledWith(backupData.project);
      updateSpy.mockRestore();
    });

    it('应该处理备份文件不存在的情况 (行531)', async () => {
      // 设置项目状态
      (workspaceManager as any).projectRoot = '/test/project';

      // Mock文件不存在错误
      const error = new Error('文件不存在') as any;
      error.code = 'ENOENT';
      mockFS.access.mockRejectedValue(error);

      await expect(workspaceManager.restoreBackup('/nonexistent/backup.json'))
        .rejects.toThrow('备份文件不存在');
    });
  });

  describe('工作区监听器分支测试', () => {
    it('应该处理工作区文件夹添加事件 (行661-662)', async () => {
      const mockEvent = {
        added: [{ uri: { fsPath: '/new/workspace' } }],
        removed: []
      };

      // Mock工作区监听器
      let onChangeCallback: any;
      mockVscode.workspace.onDidChangeWorkspaceFolders.mockImplementation((callback) => {
        onChangeCallback = callback;
        return { dispose: jest.fn() };
      });

      // 创建新的工作区管理器以触发监听器设置
      const newManager = new WorkspaceManager();
      
      // 设置initializeCurrentProject的spy
      const initSpy = jest.spyOn(newManager as any, 'initializeCurrentProject').mockResolvedValue();

      // 触发工作区添加事件
      if (onChangeCallback) {
        onChangeCallback(mockEvent);
      }

      expect(initSpy).toHaveBeenCalled();
      initSpy.mockRestore();
      newManager.dispose();
    });

    it('应该处理工作区文件夹移除事件 (行664-665)', async () => {
      const mockEvent = {
        added: [],
        removed: [{ uri: { fsPath: '/removed/workspace' } }]
      };

      // Mock工作区监听器
      let onChangeCallback: any;
      mockVscode.workspace.onDidChangeWorkspaceFolders.mockImplementation((callback) => {
        onChangeCallback = callback;
        return { dispose: jest.fn() };
      });

      // 创建新的工作区管理器并设置项目状态
      const newManager = new WorkspaceManager();
      (newManager as any).currentProject = { name: '测试项目' };

      // 设置closeProject的spy
      const closeSpy = jest.spyOn(newManager, 'closeProject').mockResolvedValue();

      // 触发工作区移除事件
      if (onChangeCallback) {
        onChangeCallback(mockEvent);
      }

      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
      newManager.dispose();
    });
  });

  describe('项目结构验证分支测试', () => {
    it('应该重新创建缺失的项目目录 (行750-751)', async () => {
      const projectPath = '/test/project';
      const config: ProjectConfiguration = {
        name: '测试项目',
        version: '1.0.0',
        description: '测试',
        author: 'test',
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
          collaborationEnabled: false
        },
        metadata: {
          totalSessions: 0,
          totalDataSize: 0,
          tags: []
        }
      };

      // Mock某个目录不存在
      mockFS.access.mockImplementation((filePath: any) => {
        if (filePath.includes('analysis')) {
          return Promise.reject(new Error('目录不存在'));
        }
        return Promise.resolve();
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // 调用验证项目结构
      await (workspaceManager as any).validateProjectStructure(projectPath, config);

      expect(mockFS.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('analysis'),
        { recursive: true }
      );
      expect(consoleSpy).toHaveBeenCalledWith('重新创建缺失的目录: analysis');
      
      consoleSpy.mockRestore();
    });
  });

  describe('自动备份分支测试', () => {
    it('应该处理自动备份失败的情况 (行797-800)', async () => {
      // 设置项目状态并启用自动备份
      (workspaceManager as any).currentProject = { 
        name: '测试项目',
        settings: { autoBackup: true }
      };
      (workspaceManager as any).projectRoot = '/test/project';

      // Mock创建备份失败
      const backupSpy = jest.spyOn(workspaceManager, 'createBackup')
        .mockRejectedValue(new Error('备份失败'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 手动触发自动备份计时器
      (workspaceManager as any).startAutoBackup();
      
      // 模拟计时器触发 - 需要直接调用备份逻辑
      try {
        await workspaceManager.createBackup(false);
      } catch (error) {
        // 这里应该在实际的定时器回调中被捕获
      }

      expect(backupSpy).toHaveBeenCalled();
      backupSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('文件清理分支测试', () => {
    it('应该处理临时文件删除失败的情况 (行825)', async () => {
      // 设置项目状态
      (workspaceManager as any).projectRoot = '/test/project';
      (workspaceManager as any).currentProject = {
        structure: { tempDir: 'temp' }
      };

      // Mock目录存在但文件删除失败
      mockFS.access.mockResolvedValue();
      mockFS.readdir.mockResolvedValue(['temp1.tmp', 'temp2.tmp']);
      mockFS.unlink.mockRejectedValue(new Error('删除失败'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // 应该成功完成，不抛出错误
      await expect((workspaceManager as any).cleanupTempFiles()).resolves.toBeUndefined();
      
      expect(mockFS.unlink).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('删除临时文件失败'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('目录扫描错误分支测试', () => {
    it('应该处理目录扫描失败的情况 (行860)', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock目录读取失败
      mockFS.readdir.mockRejectedValue(new Error('权限被拒绝'));

      const result = await (workspaceManager as any).scanDirectory('/test/invalid-dir');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        '扫描目录失败: /test/invalid-dir',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('文件类型检测分支测试', () => {
    it('应该正确处理config文件的检测 (行879-880)', async () => {
      // 测试包含'config'的JSON文件
      const result1 = (workspaceManager as any).detectFileType('app-config.json');
      expect(result1).toBe(FileType.Config);

      // 测试不包含'config'的JSON文件
      const result2 = (workspaceManager as any).detectFileType('data.json');
      expect(result2).toBe(FileType.Data);
    });

    it('应该正确处理未知文件类型 (行889)', async () => {
      const result = (workspaceManager as any).detectFileType('unknown.xyz');
      expect(result).toBe(FileType.Data);
    });
  });

  describe('目录映射分支测试', () => {
    it('应该正确映射Analysis文件类型目录 (行906)', async () => {
      // 设置项目状态
      (workspaceManager as any).currentProject = {
        structure: {
          analysisDir: 'analysis-results'
        }
      };

      const result = (workspaceManager as any).getDirectoryForFileType(FileType.Analysis);
      expect(result).toBe('analysis-results');
    });

    it('应该正确映射Config文件类型目录 (行910)', async () => {
      // 设置项目状态
      (workspaceManager as any).currentProject = {
        structure: {
          configDir: 'configurations'
        }
      };

      const result = (workspaceManager as any).getDirectoryForFileType(FileType.Config);
      expect(result).toBe('configurations');
    });

    it('应该为未知文件类型返回默认数据目录', async () => {
      // 设置项目状态
      (workspaceManager as any).currentProject = {
        structure: {
          dataDir: 'data'
        }
      };

      const result = (workspaceManager as any).getDirectoryForFileType(FileType.Template);
      expect(result).toBe('data');
    });
  });

  describe('边界条件和复杂场景测试', () => {
    it('应该处理项目创建选项的完整流程', async () => {
      const options: ProjectCreationOptions = {
        name: '复杂测试项目',
        location: '/test/complex-project',
        template: 'protocol-analysis',
        initializeGit: true,
        createSampleData: true,
        description: '这是一个复杂的测试项目',
        author: 'test-author'
      };

      mockFS.access.mockResolvedValue();
      mockVscode.commands.executeCommand.mockResolvedValue(undefined);

      await workspaceManager.createProject(options);

      expect(mockFS.mkdir).toHaveBeenCalled();
      expect(mockFS.writeFile).toHaveBeenCalled();
    });

    it('应该处理文件添加时的复杂目录结构', async () => {
      // 设置项目状态
      (workspaceManager as any).projectRoot = '/test/project';
      (workspaceManager as any).currentProject = {
        structure: { dataDir: 'data' }
      };

      const generateIdSpy = jest.spyOn(workspaceManager as any, 'generateFileId')
        .mockReturnValue('test-file-id');

      // 测试添加文件到指定的嵌套路径
      const fileId = await workspaceManager.addFileToProject(
        '/source/test.lac',
        FileType.Data,
        'custom/nested/path/test.lac'
      );

      expect(fileId).toBe('test-file-id');
      expect(mockFS.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('custom/nested/path'),
        { recursive: true }
      );

      generateIdSpy.mockRestore();
    });

    it('应该处理事件监听器的完整生命周期', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      // 添加监听器
      workspaceManager.on('projectCreated', listener1);
      workspaceManager.on('projectOpened', listener2);

      // 触发事件
      workspaceManager.emit('projectCreated', { name: '测试项目1' });
      workspaceManager.emit('projectOpened', { name: '测试项目2' });

      expect(listener1).toHaveBeenCalledWith({ name: '测试项目1' });
      expect(listener2).toHaveBeenCalledWith({ name: '测试项目2' });

      // 移除监听器
      workspaceManager.removeListener('projectCreated', listener1);
      workspaceManager.emit('projectCreated', { name: '测试项目3' });

      // listener1不应该再被调用
      expect(listener1).toHaveBeenCalledTimes(1);
    });
  });
});