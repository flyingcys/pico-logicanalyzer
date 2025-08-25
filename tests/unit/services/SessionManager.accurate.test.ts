/**
 * SessionManager 精准业务逻辑测试
 * 
 * 基于@src源码深度分析的准确测试：
 * - 测试真实的SessionManager接口和方法
 * - 验证会话管理核心业务逻辑
 * - 避免Mock不存在的方法
 * - 专注核心数据流：创建→保存→加载→管理
 */

// Mock vscode模块
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({ 
      get: jest.fn().mockReturnValue(undefined)
    }))
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn()
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path }))
  }
}));

// Mock文件系统
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn().mockResolvedValue([])
}));

import { SessionManager, SessionData, SessionManagerOptions } from '../../../src/services/SessionManager';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType } from '../../../src/models/AnalyzerTypes';
import * as fs from 'fs/promises';

describe('SessionManager 精准业务逻辑测试', () => {
  let sessionManager: SessionManager;
  let testSession: CaptureSession;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // 使用默认选项创建SessionManager
    sessionManager = new SessionManager({
      autoSave: false,
      maxHistoryVersions: 5
    });
    await sessionManager.initialize();
    
    // 创建测试用的采集会话
    testSession = new CaptureSession();
    testSession.frequency = 1000000; // 1MHz
    testSession.preTriggerSamples = 100;
    testSession.postTriggerSamples = 1000;
    testSession.triggerType = TriggerType.Edge;
    testSession.triggerChannel = 0;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'Channel 0'),
      new AnalyzerChannel(1, 'Channel 1')
    ];
  });

  afterEach(async () => {
    if (sessionManager) {
      await sessionManager.dispose();
    }
  });

  describe('构造函数和初始化逻辑', () => {
    it('应该正确初始化默认选项', async () => {
      const manager = new SessionManager();
      await manager.initialize();
      
      expect(manager).toBeDefined();
      expect(manager.hasUnsavedChanges()).toBe(false);
      expect(manager.getCurrentSession()).toBeUndefined();
      
      await manager.dispose();
    });

    it('应该使用自定义选项初始化', async () => {
      const options: SessionManagerOptions = {
        autoSave: true,
        autoSaveInterval: 60,
        maxHistoryVersions: 10
      };
      
      const manager = new SessionManager(options);
      await manager.initialize();
      
      expect(manager).toBeDefined();
      
      await manager.dispose();
    });
  });

  describe('会话创建核心逻辑', () => {
    it('应该创建新会话', async () => {
      const sessionId = await sessionManager.createSession({
        name: '测试会话',
        description: '这是一个测试会话'
      });

      expect(typeof sessionId).toBe('string');
      expect(sessionId).toBeDefined();
    });

    it('应该创建包含采集数据的会话', () => {
      const sessionData = sessionManager.createNewSession(
        testSession,
        '新采集会话'
      );

      expect(sessionData.name).toBe('新采集会话');
      // createNewSession只接受2个参数，description需要另行设置
      expect(sessionData.description).toBeUndefined();
      expect(sessionData.captureSession).toBe(testSession);
      expect(sessionData.sessionId).toBeDefined();
      expect(sessionData.version).toBeDefined();
      expect(sessionData.timestamp).toBeDefined();
      expect(sessionData.metadata).toBeDefined();
    });
  });

  describe('会话状态管理逻辑', () => {
    it('应该正确管理当前会话状态', () => {
      // 初始状态：无当前会话
      expect(sessionManager.getCurrentSession()).toBeUndefined();
      expect(sessionManager.hasUnsavedChanges()).toBe(false);

      // 创建会话数据
      const sessionData = sessionManager.createNewSession(testSession, '测试会话');
      
      // 更新当前会话
      sessionManager.updateCurrentSession(sessionData);
      expect(sessionManager.getCurrentSession()).toBe(sessionData);
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
    });

    it('应该支持部分更新会话数据', () => {
      const sessionData = sessionManager.createNewSession(testSession, '原始会话');
      sessionManager.updateCurrentSession(sessionData);

      // 部分更新
      const updates = {
        name: '更新后的会话',
        description: '新的描述'
      };
      sessionManager.updateCurrentSession(updates);

      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession?.name).toBe('更新后的会话');
      expect(currentSession?.description).toBe('新的描述');
      expect(currentSession?.captureSession).toBe(testSession); // 保持不变
    });

    it('应该正确标记未保存状态', () => {
      expect(sessionManager.hasUnsavedChanges()).toBe(false);

      sessionManager.markUnsaved();
      expect(sessionManager.hasUnsavedChanges()).toBe(true);

      sessionManager.markAsModified();
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('会话保存核心算法', () => {
    it('应该保存会话到指定路径', async () => {
      // Mock成功写入
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const sessionData = sessionManager.createNewSession(testSession, '保存测试');
      const result = await sessionManager.saveSession(sessionData, '/test/save-test.lacsession');

      expect(result.success).toBe(true);
      expect(result.filePath).toBe('/test/save-test.lacsession');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('应该处理保存错误', async () => {
      // Mock写入失败
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

      const sessionData = sessionManager.createNewSession(testSession, '错误测试');
      const result = await sessionManager.saveSession(sessionData, '/test/error.lacsession');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Write failed');
    });

    it('应该生成正确的会话ID', () => {
      const sessionData1 = sessionManager.createNewSession(testSession, 'Session 1');
      const sessionData2 = sessionManager.createNewSession(testSession, 'Session 2');

      expect(sessionData1.sessionId).toBeDefined();
      expect(sessionData2.sessionId).toBeDefined();
      expect(sessionData1.sessionId).not.toBe(sessionData2.sessionId);
      expect(sessionData1.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });

  describe('会话加载核心算法', () => {
    beforeEach(() => {
      // Mock有效的会话文件内容
      const mockSessionData = {
        version: '1.0.0',
        sessionId: 'test-session-123',
        name: '测试会话',
        timestamp: new Date().toISOString(),
        captureSession: {
          frequency: 1000000,
          preTriggerSamples: 100,
          postTriggerSamples: 1000,
          triggerType: TriggerType.Edge,
          triggerChannel: 0,
          triggerInverted: false,
          triggerBitCount: 1,
          triggerPattern: 0,
          captureChannels: [
            { channelNumber: 0, name: 'Channel 0', samples: new Uint8Array([1, 0, 1, 0]) }
          ],
          loopCount: 0,
          measureBursts: false
        },
        metadata: {
          captureSettings: {
            sampleRate: 1000000,
            totalSamples: 1100,
            duration: 0.0011
          },
          fileInfo: {
            size: 1024
          }
        }
      };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockSessionData));
    });

    it('应该加载有效的会话文件', async () => {
      const result = await sessionManager.loadSession('/test/valid-session.lacsession');

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      
      const sessionData = sessionManager.getCurrentSession();
      expect(sessionData?.name).toBe('测试会话');
      expect(sessionData?.captureSession.frequency).toBe(1000000);
    });

    it('应该处理文件不存在错误', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await sessionManager.loadSession('/test/nonexistent.lacsession');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('应该处理无效JSON文件', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json {');

      const result = await sessionManager.loadSession('/test/invalid.lacsession');

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });
  });

  describe('会话历史和管理功能', () => {
    it('应该获取所有会话', async () => {
      const sessions = await sessionManager.getAllSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('应该获取最近会话列表', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['session1.lacsession', 'session2.lacsession']);
      (fs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });

      const recentSessions = await sessionManager.getRecentSessions();
      expect(Array.isArray(recentSessions)).toBe(true);
    });

    it('应该获取会话历史', async () => {
      const history = await sessionManager.getSessionHistory('test-session');
      expect(Array.isArray(history)).toBe(true);
    });

    it('应该获取会话状态', async () => {
      const state = await sessionManager.getSessionState('test-session');
      expect(state).toHaveProperty('lastModified');
      expect(state).toHaveProperty('hasUnsavedChanges');
      expect(state).toHaveProperty('version');
    });
  });

  describe('自动保存功能测试', () => {
    it('应该在没有未保存更改时跳过自动保存', async () => {
      const result = await sessionManager.autoSave();
      
      expect(result.success).toBe(true);
      expect(result.warnings).toContain('No unsaved changes');
    });

    it('应该在有未保存更改时执行自动保存', async () => {
      // Mock文件写入成功
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      
      // 设置当前会话并标记为未保存
      const sessionData = sessionManager.createNewSession(testSession, '自动保存测试');
      sessionManager.updateCurrentSession(sessionData);
      sessionManager.markUnsaved();

      const result = await sessionManager.autoSave();

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('采集数据保存功能', () => {
    it('应该保存采集数据到当前会话', async () => {
      const sessionData = sessionManager.createNewSession(testSession, '采集数据测试');
      sessionManager.updateCurrentSession(sessionData);

      const captureData = {
        samples: new Uint8Array([1, 0, 1, 0, 1]),
        timestamp: Date.now()
      };

      await sessionManager.saveCaptureData(sessionData.sessionId, captureData);

      // 验证会话被标记为未保存
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
    });

    it('应该忽略非当前会话的采集数据', async () => {
      const captureData = { samples: new Uint8Array([1, 0, 1]) };
      
      await sessionManager.saveCaptureData('non-existent-session', captureData);
      
      // 应该没有变化
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('会话同步功能', () => {
    it('应该同步会话数据', async () => {
      const result = await sessionManager.synchronizeSession('test-session');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('lastSyncTime');
    });

    it('应该设置活动会话', async () => {
      await sessionManager.setActiveSession('test-session-id');
      
      // 设置活动会话不会抛出错误
      expect(true).toBe(true);
    });

    it('应该获取活动会话', async () => {
      const activeSession = await sessionManager.getActiveSession();
      
      // 可能为undefined（如果没有活动会话）
      expect(activeSession === undefined || typeof activeSession === 'object').toBe(true);
    });
  });

  describe('服务生命周期管理', () => {
    it('应该正确初始化服务', async () => {
      const manager = new SessionManager();
      const result = await manager.initialize();
      
      expect(result).toBe(true);
      await manager.dispose();
    });

    it('应该正确清理资源', async () => {
      const manager = new SessionManager({ autoSave: true });
      await manager.initialize();
      
      const result = await manager.dispose();
      expect(result).toBe(true);
    });

    it('应该防止重复初始化', async () => {
      const manager = new SessionManager();
      await manager.initialize();
      
      // 重复初始化应该成功但不产生副作用
      const secondInit = await manager.initialize();
      expect(secondInit).toBe(true);
      
      await manager.dispose();
    });
  });
});