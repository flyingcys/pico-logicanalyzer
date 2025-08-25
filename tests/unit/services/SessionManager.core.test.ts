/**
 * SessionManager 核心功能测试
 * 
 * 遵循新的测试质量标准:
 * - 文件大小 < 200行
 * - Mock数量 < 5个
 * - 测试真实功能而非Mock行为
 * - 专注核心数据流：创建→保存→加载→管理
 */

import { SessionManager, SessionData } from '../../../src/services/SessionManager';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType } from '../../../src/models/AnalyzerTypes';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn()
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => []),
      update: jest.fn()
    }))
  },
  Uri: { file: jest.fn(path => ({ fsPath: path })) },
  ConfigurationTarget: { Global: 1 }
}));

// Mock 文件系统
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(() => ({ mtime: new Date() })),
  access: jest.fn(),
  readdir: jest.fn(() => []),
  copyFile: jest.fn()
}));

describe('SessionManager 核心功能测试', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager({
      autoSave: false, // 禁用自动保存避免定时器干扰
      backupEnabled: true,
      compressionEnabled: false
    });
  });

  afterEach(async () => {
    await sessionManager.dispose();
  });

  describe('会话创建和管理', () => {
    it('应该能够创建新会话', async () => {
      const sessionId = await sessionManager.createSession({
        name: '测试会话',
        description: '这是一个测试会话'
      });

      expect(sessionId).toMatch(/^session-\d+-.+$/);
      
      const activeSession = await sessionManager.getActiveSession();
      expect(activeSession).toBeDefined();
      expect(activeSession!.name).toBe('测试会话');
      expect(activeSession!.description).toBe('这是一个测试会话');
    });

    it('应该能够创建带采集数据的新会话', () => {
      const captureSession = new CaptureSession();
      captureSession.frequency = 2000000;
      captureSession.preTriggerSamples = 200;
      captureSession.postTriggerSamples = 2000;
      captureSession.triggerType = TriggerType.Edge;
      captureSession.captureChannels = [
        new AnalyzerChannel(0, 'Clock'),
        new AnalyzerChannel(1, 'Data')
      ];

      const newSession = sessionManager.createNewSession(captureSession, '采集会话');

      expect(newSession.name).toBe('采集会话');
      expect(newSession.captureSession.frequency).toBe(2000000);
      expect(newSession.captureSession.captureChannels.length).toBe(2);
      expect(newSession.channelSettings?.length).toBe(2);
      expect(newSession.viewSettings?.visibleChannels).toEqual([0, 1]);
    });

    it('应该能够更新当前会话', () => {
      const captureSession = new CaptureSession();
      const session = sessionManager.createNewSession(captureSession);
      
      sessionManager.updateCurrentSession({
        name: '更新的会话',
        description: '已更新'
      });

      const current = sessionManager.getCurrentSession();
      expect(current?.name).toBe('更新的会话');
      expect(current?.description).toBe('已更新');
    });
  });

  describe('会话状态管理', () => {
    it('应该正确追踪未保存的更改', async () => {
      await sessionManager.createSession({ name: '测试' });
      
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
      
      // 模拟保存成功
      (vscode.window.showSaveDialog as jest.Mock).mockResolvedValue({ fsPath: '/test/session.lacsession' });
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.access as jest.Mock).mockRejectedValue(new Error('文件不存在'));
      
      const session = sessionManager.getCurrentSession()!;
      const result = await sessionManager.saveSession(session);
      
      expect(result.success).toBe(true);
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
    });

    it('应该能够获取会话状态', async () => {
      const sessionId = await sessionManager.createSession({ name: '状态测试' });
      
      const state = await sessionManager.getSessionState(sessionId);
      
      expect(state.isModified).toBe(true);
      expect(typeof state.lastModified).toBe('number');
    });

    it('应该能够同步会话状态', async () => {
      const sessionId = await sessionManager.createSession({ name: '同步测试' });
      
      const syncResult = await sessionManager.synchronizeSession(sessionId);
      
      expect(syncResult.success).toBe(true);
      expect(syncResult.conflictsResolved).toBe(0);
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('会话保存功能', () => {
    it('应该能够保存会话到指定路径', async () => {
      const captureSession = new CaptureSession();
      captureSession.frequency = 1000000;
      const sessionData = sessionManager.createNewSession(captureSession, '保存测试');
      
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.access as jest.Mock).mockRejectedValue(new Error('文件不存在'));
      
      const result = await sessionManager.saveSession(sessionData, '/test/save-test.lacsession');
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('/test/save-test.lacsession');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/save-test.lacsession',
        expect.any(String),
        'utf8'
      );
    });

    it('应该能够处理保存失败', async () => {
      const session = sessionManager.createNewSession(new CaptureSession());
      
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('磁盘空间不足'));
      
      const result = await sessionManager.saveSession(session, '/test/fail.lacsession');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('磁盘空间不足');
    });

    it('应该支持用户取消保存', async () => {
      const session = sessionManager.createNewSession(new CaptureSession());
      
      (vscode.window.showSaveDialog as jest.Mock).mockResolvedValue(undefined);
      
      const result = await sessionManager.saveSession(session);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('用户取消');
    });
  });

  describe('会话加载功能', () => {
    it('应该能够加载有效的会话文件', async () => {
      const testSessionData: SessionData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        sessionId: 'test-session-123',
        name: '加载测试',
        captureSession: new CaptureSession(),
        metadata: {
          captureSettings: {
            sampleRate: 1000000,
            totalSamples: 1000,
            duration: 0.001
          },
          fileInfo: { size: 1024 }
        }
      };
      
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(testSessionData));
      
      const result = await sessionManager.loadSession('/test/load-test.lacsession');
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session-123');
      
      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession?.name).toBe('加载测试');
    });

    it('应该能够处理加载失败', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('文件不存在'));
      
      const result = await sessionManager.loadSession('/test/nonexistent.lacsession');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件不存在');
    });

    it('应该支持用户取消加载', async () => {
      (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);
      
      const result = await sessionManager.loadSession();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('用户取消');
    });
  });

  describe('自动保存功能', () => {
    it('应该在没有未保存更改时跳过自动保存', async () => {
      const result = await sessionManager.autoSave();
      
      expect(result.success).toBe(true);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('应该能够执行自动保存', async () => {
      await sessionManager.createSession({ name: '自动保存测试' });
      
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      const result = await sessionManager.autoSave();
      
      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('会话历史管理', () => {
    it('应该能够获取空的会话历史', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('目录不存在'));
      
      const history = await sessionManager.getSessionHistory('test-session');
      
      expect(history).toEqual([]);
    });

    it('应该能够获取所有会话列表', async () => {
      const sessions = await sessionManager.getAllSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
    });
  });
});