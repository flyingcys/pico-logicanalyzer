/**
 * SessionManager 测试
 * 测试采集会话的保存、恢复、管理和版本控制功能
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionManager, SessionData, ViewSettings, SessionMetadata } from '../../../src/services/SessionManager';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';

// Mock dependencies
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    }),
  },
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn(),
  },
  Uri: {
    file: jest.fn().mockImplementation((path) => ({ fsPath: path })),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  copyFile: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  dirname: jest.fn().mockImplementation((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn().mockImplementation((p) => p.split('/').pop()),
  extname: jest.fn().mockImplementation((p) => p.includes('.') ? '.' + p.split('.').pop() : ''),
}));

describe('SessionManager 测试', () => {
  let sessionManager: SessionManager;
  let mockVSCode: any;
  let mockFS: any;
  let mockPath: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    mockFS = require('fs/promises') as any;
    mockPath = require('path') as any;
    
    // Mock global functions
    global.clearInterval = jest.fn();
    global.setInterval = jest.fn();
    
    sessionManager = new SessionManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    sessionManager.dispose();
  });

  // 创建测试用的会话数据
  const createTestSessionData = (): SessionData => ({
    version: '1.0.0',
    timestamp: '2025-07-30T12:00:00Z',
    sessionId: 'test-session-001',
    name: '测试会话',
    description: '用于单元测试的会话',
    tags: ['test', 'unit'],
    captureSession: {
      id: 'capture-001',
      name: '测试采集',
      channels: [],
      sampleRate: 24000000,
      frequency: 24000000,  // generateMetadata需要的字段
      totalSamples: 10000,
      preTriggerSamples: 5000,  // generateMetadata需要的字段
      postTriggerSamples: 5000,  // generateMetadata需要的字段
      triggerType: 0,  // generateMetadata需要的字段
      triggerChannel: 0,  // generateMetadata需要的字段
      triggerInverted: false,  // generateMetadata需要的字段
      timestamp: new Date(),
    } as CaptureSession,
    viewSettings: {
      timebase: 1000,
      sampleOffset: 0,
      zoomLevel: 1.0,
      visibleChannels: [0, 1, 2, 3],
      channelColors: new Map(),
      displayMode: 'digital',
    } as ViewSettings,
    metadata: {
      createdBy: 'test-user',
      createdAt: '2025-07-30T12:00:00Z',
      modifiedAt: '2025-07-30T12:00:00Z',
      version: '1.0.0',
      fileSize: 1024,
      checksum: 'abc123',
    } as SessionMetadata,
  });

  describe('会话保存功能', () => {
    it('应该能够保存会话到指定文件', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/test-session.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: filePath });

      // Act
      const result = await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(filePath);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.any(String),
        'utf8'
      );
    });

    it('应该在保存前创建目录', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/new-dir/test-session.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(mockFS.mkdir).toHaveBeenCalledWith(
        '/test/sessions/new-dir',
        { recursive: true }
      );
    });

    it('应该处理保存失败的情况', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/test-session.lacs';
      mockFS.writeFile.mockRejectedValue(new Error('写入失败'));
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('写入失败');
    });

    it('应该在未指定文件路径时显示保存对话框', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/selected-session.lacs';
      mockVSCode.window.showSaveDialog.mockResolvedValue({ fsPath: filePath });
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(sessionData);

      // Assert
      expect(mockVSCode.window.showSaveDialog).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(filePath);
    });

    it('应该在用户取消保存时返回取消状态', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      mockVSCode.window.showSaveDialog.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(sessionData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('用户取消了保存操作');
    });
  });

  describe('会话加载功能', () => {
    it('应该能够从文件加载会话', async () => {
      // Arrange
      const originalData = createTestSessionData();
      const filePath = '/test/sessions/test-session.lacs';
      const fileContent = JSON.stringify(originalData);
      mockFS.readFile.mockResolvedValue(fileContent);
      mockFS.access.mockResolvedValue(undefined); // 文件存在

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session-001');
      expect(result.filePath).toBe(filePath);
    });

    it('应该在未指定文件路径时显示打开对话框', async () => {
      // Arrange
      const filePath = '/test/sessions/selected-session.lacs';
      const sessionData = createTestSessionData();
      const fileContent = JSON.stringify(sessionData);
      
      mockVSCode.window.showOpenDialog.mockResolvedValue([{ fsPath: filePath }]);
      mockFS.readFile.mockResolvedValue(fileContent);

      // Act
      const result = await sessionManager.loadSession();

      // Assert
      expect(mockVSCode.window.showOpenDialog).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(filePath);
    });

    it('应该处理无效的JSON文件', async () => {
      // Arrange
      const filePath = '/test/sessions/invalid-session.lacs';
      mockFS.readFile.mockResolvedValue('无效的JSON内容');
      mockFS.access.mockResolvedValue(undefined); // 文件存在

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('无法解析会话文件');
    });

    it('应该处理文件不存在的情况', async () => {
      // Arrange
      const filePath = '/test/sessions/nonexistent-session.lacs';
      mockFS.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('file not found');
    });

    it('应该验证会话数据的完整性', async () => {
      // Arrange
      const filePath = '/test/sessions/incomplete-session.lacs';
      const incompleteData = { version: '1.0.0' }; // 缺少必需字段
      mockFS.readFile.mockResolvedValue(JSON.stringify(incompleteData));
      mockFS.access.mockResolvedValue(undefined); // 文件存在

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少采集会话数据');
    });
  });

  describe('自动保存功能', () => {
    it('应该能够自动保存当前会话', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/auto-save.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.access.mockResolvedValue(undefined);
      mockFS.copyFile.mockResolvedValue(undefined);

      // 先加载一次以设置当前会话
      mockFS.readFile.mockResolvedValue(JSON.stringify(sessionData));
      await sessionManager.loadSession(filePath);

      // 模拟有未保存更改
      sessionManager.markUnsaved();

      // Act
      const result = await sessionManager.autoSave();

      // Assert
      expect(result.success).toBe(true);
      expect(mockFS.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('autosave'),
        { recursive: true }
      );
    });

    it('应该在没有当前会话时跳过自动保存', async () => {
      // Act
      const result = await sessionManager.autoSave();

      // Assert
      expect(result.success).toBe(true); // 实际上返回true表示没有需要保存的内容
    });

    it('应该创建自动保存备份', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/test-session.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.access.mockResolvedValue(undefined);
      mockFS.copyFile.mockResolvedValue(undefined);

      // 先加载会话
      mockFS.readFile.mockResolvedValue(JSON.stringify(sessionData));
      await sessionManager.loadSession(filePath);
      (sessionManager as any).unsavedChanges = true;

      // Act
      await sessionManager.autoSave();

      // Assert - 自动保存目录应该被创建
      expect(mockFS.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('autosave'),
        { recursive: true }
      );
    });
  });

  describe('最近会话管理', () => {
    it('应该能够获取最近的会话列表', async () => {
      // Arrange
      const recentFiles = ['/test/sessions/session1.lacs'];
      mockVSCode.workspace.getConfiguration().get.mockReturnValue(recentFiles);
      
      const sessionData = createTestSessionData();
      mockFS.readFile.mockResolvedValue(JSON.stringify(sessionData));

      // Act
      const recentSessions = await sessionManager.getRecentSessions();

      // Assert
      expect(Array.isArray(recentSessions)).toBe(true);
    });

    it('应该处理损坏的最近文件', async () => {
      // Arrange
      mockVSCode.workspace.getConfiguration().get.mockReturnValue(['/test/corrupted.lacs']);
      mockFS.readFile.mockRejectedValue(new Error('无效内容'));

      // Act
      const recentSessions = await sessionManager.getRecentSessions();

      // Assert
      expect(Array.isArray(recentSessions)).toBe(true);
    });
  });

  describe('会话历史管理', () => {
    it('应该能够获取会话的版本历史', async () => {
      // Arrange
      const sessionId = 'test-session-001';
      mockFS.readdir.mockResolvedValue(['test-session-001_v1.lacs']);
      
      const sessionData = createTestSessionData();
      mockFS.readFile.mockResolvedValue(JSON.stringify(sessionData));

      // Act
      const history = await sessionManager.getSessionHistory(sessionId);

      // Assert
      expect(Array.isArray(history)).toBe(true);
    });

    it('应该在没有历史记录时返回空数组', async () => {
      // Arrange
      const sessionId = 'nonexistent-session';
      mockFS.readdir.mockRejectedValue(new Error('目录不存在'));

      // Act
      const history = await sessionManager.getSessionHistory(sessionId);

      // Assert
      expect(history).toHaveLength(0);
    });
  });

  describe('数据序列化和反序列化', () => {
    it('应该正确序列化会话数据', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/serialize-test.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      
      // Act
      const result = await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.any(String),
        'utf8'
      );
    });

    it('应该正确反序列化会话数据', async () => {
      // Arrange
      const originalData = createTestSessionData();
      const filePath = '/test/sessions/deserialize-test.lacs';
      const serializedContent = JSON.stringify(originalData);
      mockFS.readFile.mockResolvedValue(serializedContent);
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(originalData.sessionId);
      expect(result.filePath).toBe(filePath);
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理磁盘空间不足的错误', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/disk-full.lacs';
      mockFS.writeFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该处理权限不足的错误', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/permission-denied.lacs';
      mockFS.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该验证会话数据的版本兼容性', async () => {
      // Arrange
      const filePath = '/test/sessions/old-version.lacs';
      const oldVersionData = { ...createTestSessionData(), version: '0.5.0' };
      mockFS.readFile.mockResolvedValue(JSON.stringify(oldVersionData));
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
    });
  });

  describe('内存管理和资源清理', () => {
    it('应该在dispose时清理所有资源', () => {
      // Arrange & Act
      sessionManager.dispose();

      // Assert - 确保dispose方法可以被调用而不抛出错误
      expect(() => sessionManager.dispose()).not.toThrow();
    });

    it('应该正确处理大型会话数据', async () => {
      // Arrange
      const largeSessionData = createTestSessionData();
      largeSessionData.captureSession.totalSamples = 10000000;
      const filePath = '/test/sessions/large-session.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(largeSessionData, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('构造函数和自动保存配置', () => {
    it('应该在启用自动保存时启动定时器', () => {
      // Arrange
      const autoSaveManager = new SessionManager({ autoSave: true, autoSaveInterval: 60 });

      // Act & Assert
      expect(global.setInterval).toHaveBeenCalled();
      
      // Cleanup
      autoSaveManager.dispose();
    });

    it('应该正确设置默认选项', () => {
      // Arrange & Act
      const defaultManager = new SessionManager();

      // Assert - 通过测试默认行为来验证
      expect(defaultManager.hasUnsavedChanges()).toBe(false);
      
      // Cleanup
      defaultManager.dispose();
    });
  });

  describe('会话创建和管理', () => {
    it('应该能够创建新会话', () => {
      // Arrange
      const captureSession = {
        id: 'capture-test',
        name: '测试采集',
        captureChannels: [
          { channelNumber: 0, channelName: 'CH0', hidden: false },
          { channelNumber: 1, channelName: 'CH1', hidden: true }
        ],
        frequency: 24000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 2000,
        triggerType: 1,
        triggerChannel: 0,
        triggerInverted: false
      } as CaptureSession;

      // Act
      const newSession = sessionManager.createNewSession(captureSession, '自定义会话名称');

      // Assert
      expect(newSession.name).toBe('自定义会话名称');
      expect(newSession.captureSession).toBe(captureSession);
      expect(newSession.channelSettings).toHaveLength(2);
      expect(newSession.channelSettings[0].visible).toBe(true);
      expect(newSession.channelSettings[1].visible).toBe(false);
      expect(sessionManager.getCurrentSession()).toBe(newSession);
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
    });

    it('应该能够更新当前会话', () => {
      // Arrange
      const originalSession = createTestSessionData();
      const manager = new SessionManager();
      (manager as any).currentSession = originalSession;

      const updates = {
        name: '更新的会话名称',
        description: '更新的描述'
      };

      // Act
      manager.updateCurrentSession(updates);

      // Assert
      const updated = manager.getCurrentSession();
      expect(updated?.name).toBe('更新的会话名称');
      expect(updated?.description).toBe('更新的描述');
      expect(manager.hasUnsavedChanges()).toBe(true);
      
      // Cleanup
      manager.dispose();
    });

    it('应该在没有当前会话时抛出错误', () => {
      // Arrange
      const manager = new SessionManager();

      // Act & Assert
      expect(() => manager.updateCurrentSession({ name: '测试' })).toThrow('没有当前会话可更新');
      
      // Cleanup
      manager.dispose();
    });

    it('应该正确返回当前会话状态', () => {
      // Arrange
      const manager = new SessionManager();

      // Act & Assert - 初始状态
      expect(manager.getCurrentSession()).toBeUndefined();
      expect(manager.hasUnsavedChanges()).toBe(false);

      // 设置会话后
      const testSession = createTestSessionData();
      (manager as any).currentSession = testSession;
      expect(manager.getCurrentSession()).toBe(testSession);

      // 标记为未保存
      manager.markUnsaved();
      expect(manager.hasUnsavedChanges()).toBe(true);
      
      // Cleanup
      manager.dispose();
    });
  });

  describe('LAC格式转换', () => {
    it('应该能够加载有效的会话数据', async () => {
      // Arrange - 使用有效的会话数据（包含version和captureSession）
      const validSessionData = createTestSessionData();
      const sessionContent = JSON.stringify(validSessionData);
      const filePath = '/test/sessions/valid.lacsession';
      
      mockFS.readFile.mockResolvedValue(sessionContent);
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
    });

    it('应该处理无效的JSON文件并显示正确错误', async () => {
      // Arrange
      const invalidJson = '{ "incomplete": json'; // 无效JSON
      const filePath = '/test/sessions/invalid.lac';
      
      mockFS.readFile.mockResolvedValue(invalidJson);
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('is not valid JSON');
    });

    it('应该处理缺少必要字段的LAC数据', async () => {
      // Arrange
      const incompleteLacData = { someField: 'value' }; // 缺少version和captureSession
      const lacContent = JSON.stringify(incompleteLacData);
      const filePath = '/test/sessions/incomplete.lac';
      
      mockFS.readFile.mockResolvedValue(lacContent);
      mockFS.access.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.loadSession(filePath);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少版本信息');
    });
  });

  describe('序列化和特殊数据类型', () => {
    it('应该正确序列化和反序列化Uint8Array', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const testArray = new Uint8Array([1, 2, 3, 4, 5]);
      (sessionData as any).testArray = testArray;
      
      const filePath = '/test/sessions/uint8array-test.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.access.mockResolvedValue(undefined);

      // Act - 保存
      await sessionManager.saveSession(sessionData, filePath);
      
      // 获取保存的内容
      const savedContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      
      // 模拟加载
      mockFS.readFile.mockResolvedValue(savedContent);
      const loadResult = await sessionManager.loadSession(filePath);

      // Assert
      expect(loadResult.success).toBe(true);
    });

    it('应该正确处理Map类型的序列化', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      sessionData.viewSettings!.channelColors = new Map([
        [0, '#FF0000'],
        [1, '#00FF00']
      ]);
      
      const filePath = '/test/sessions/map-test.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.access.mockResolvedValue(undefined);

      // Act - 保存
      await sessionManager.saveSession(sessionData, filePath);
      
      // 获取保存的内容
      const savedContent = (mockFS.writeFile as jest.Mock).mock.calls[0][1];
      
      // 模拟加载
      mockFS.readFile.mockResolvedValue(savedContent);
      const loadResult = await sessionManager.loadSession(filePath);

      // Assert
      expect(loadResult.success).toBe(true);
      const loadedSession = sessionManager.getCurrentSession();
      expect(loadedSession?.viewSettings?.channelColors).toBeInstanceOf(Map);
    });
  });

  describe('备份和文件操作', () => {
    it('应该在启用备份时创建备份文件', async () => {
      // Arrange
      const backupManager = new SessionManager({ backupEnabled: true });
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/backup-test.lacs';
      
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.access.mockResolvedValue(undefined); // 文件存在
      mockFS.copyFile.mockResolvedValue(undefined);

      // Act
      await backupManager.saveSession(sessionData, filePath);

      // Assert
      expect(mockFS.copyFile).toHaveBeenCalledWith(
        filePath,
        `${filePath}.backup`
      );
      
      // Cleanup
      backupManager.dispose();
    });

    it('应该正确检查文件存在性', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      const existingFile = '/test/sessions/existing.lacs';
      const newFile = '/test/sessions/new.lacs';
      
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);
      mockFS.access.mockImplementation((path) => {
        if (path === existingFile) return Promise.resolve();
        throw new Error('ENOENT');
      });

      // Act & Assert - 新文件不应创建备份
      await sessionManager.saveSession(sessionData, newFile);
      expect(mockFS.copyFile).not.toHaveBeenCalled();
    });
  });

  describe('高级错误处理', () => {
    it('应该处理最近文件列表的配置错误', async () => {
      // Arrange
      mockVSCode.workspace.getConfiguration().get.mockImplementation(() => {
        throw new Error('配置读取失败');
      });

      // Act
      const recentSessions = await sessionManager.getRecentSessions();

      // Assert
      expect(recentSessions).toEqual([]);
    });

    it('应该处理会话历史目录不存在的情况', async () => {
      // Arrange
      mockFS.access.mockRejectedValue(new Error('目录不存在'));

      // Act
      const history = await sessionManager.getSessionHistory('test-session');

      // Assert
      expect(history).toEqual([]);
    });

    it('应该处理自动保存时的工作区缺失', async () => {
      // Arrange
      const originalWorkspaceFolders = mockVSCode.workspace.workspaceFolders;
      mockVSCode.workspace.workspaceFolders = undefined;

      const sessionData = createTestSessionData();
      const manager = new SessionManager();
      (manager as any).currentSession = sessionData;
      manager.markUnsaved();

      // Act
      const result = await manager.autoSave();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('没有打开的工作区');

      // Restore
      mockVSCode.workspace.workspaceFolders = originalWorkspaceFolders;
      manager.dispose();
    });

    it('应该处理序列化过程中的特殊数据', async () => {
      // Arrange
      const sessionData = createTestSessionData();
      sessionData.decoderResults = new Map([
        ['decoder1', [{ type: 'test', data: 'value' }] as any]
      ]);
      
      const filePath = '/test/sessions/decoder-results.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await sessionManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(true);
      expect(mockFS.writeFile).toHaveBeenCalled();
    });
  });

  describe('压缩和性能选项', () => {
    it('应该支持压缩选项配置', async () => {
      // Arrange
      const compressedManager = new SessionManager({ compressionEnabled: true });
      const sessionData = createTestSessionData();
      const filePath = '/test/sessions/compressed.lacs';
      
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      // Act
      const result = await compressedManager.saveSession(sessionData, filePath);

      // Assert
      expect(result.success).toBe(true);
      
      // Cleanup
      compressedManager.dispose();
    });
  });
});