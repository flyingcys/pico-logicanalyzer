/**
 * SessionManager 完美覆盖率测试
 * 专门针对未覆盖的代码路径进行测试，实现100%覆盖率
 * 目标：覆盖行142-306,697,733-754,845,849
 */

import { SessionManager, SessionData, SessionManagerOptions } from '../../../src/services/SessionManager';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/AnalyzerTypes';
import { ServiceInitOptions, ServiceDisposeOptions } from '../../../src/common/ServiceLifecycle';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

// Mock VSCode API
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  window: {
    showSaveDialog: jest.fn(),
    showOpenDialog: jest.fn()
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path }))
  },
  ConfigurationTarget: {
    Global: 1
  }
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  access: jest.fn(),
  copyFile: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
}));

describe('SessionManager - 完美覆盖率测试', () => {
  let sessionManager: SessionManager;
  let mockFs: jest.Mocked<typeof fs>;
  let mockVscode: jest.Mocked<typeof vscode>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFs = fs as jest.Mocked<typeof fs>;
    mockVscode = vscode as jest.Mocked<typeof vscode>;

    // Mock基本的vscode配置
    mockVscode.workspace.getConfiguration.mockReturnValue({
      get: jest.fn().mockReturnValue([]),
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

    sessionManager = new SessionManager();
  });

  afterEach(async () => {
    await sessionManager.dispose();
    jest.clearAllTimers();
  });

  describe('服务生命周期方法覆盖 - 行142-306', () => {
    it('应该覆盖onInitialize方法 - 行142-147', async () => {
      const initOptions: ServiceInitOptions = {};
      
      // 通过反射访问受保护的方法
      const sessionManagerAny = sessionManager as any;
      
      // Mock updateMetadata方法
      sessionManagerAny.updateMetadata = jest.fn();
      
      await sessionManagerAny.onInitialize(initOptions);
      
      expect(sessionManagerAny.updateMetadata).toHaveBeenCalledWith({
        autoSave: false, // 默认值
        autoSaveInterval: 300,
        compressionEnabled: true
      });
    });

    it('应该覆盖onDispose方法的完整路径 - 行152-173', async () => {
      const sessionManagerAny = sessionManager as any;
      
      // 场景1：有自动保存定时器但没有未保存更改
      sessionManagerAny.autoSaveTimer = setInterval(() => {}, 1000);
      
      const disposeOptions: ServiceDisposeOptions = { force: false };
      
      await sessionManagerAny.onDispose(disposeOptions);
      
      expect(sessionManagerAny.autoSaveTimer).toBeUndefined();
      expect(sessionManagerAny.currentSession).toBeUndefined();
      expect(sessionManagerAny.unsavedChanges).toBe(false);
    });

    it('应该覆盖onDispose中有未保存更改的情况 - 行160-168', async () => {
      const sessionManagerAny = sessionManager as any;
      
      // 设置有未保存更改的会话
      sessionManagerAny.currentSession = {
        sessionId: 'test-session',
        name: 'Test Session'
      };
      sessionManagerAny.unsavedChanges = true;
      
      // Mock saveCurrentSession方法
      sessionManagerAny.saveCurrentSession = jest.fn().mockResolvedValue(undefined);
      
      const disposeOptions: ServiceDisposeOptions = { force: false };
      
      await sessionManagerAny.onDispose(disposeOptions);
      
      expect(sessionManagerAny.saveCurrentSession).toHaveBeenCalled();
    });

    it('应该覆盖onDispose中force模式的错误处理 - 行164-167', async () => {
      const sessionManagerAny = sessionManager as any;
      
      sessionManagerAny.currentSession = { sessionId: 'test' };
      sessionManagerAny.unsavedChanges = true;
      
      // Mock saveCurrentSession抛出错误
      sessionManagerAny.saveCurrentSession = jest.fn().mockRejectedValue(new Error('保存失败'));
      
      const disposeOptionsForce: ServiceDisposeOptions = { force: true };
      
      // force模式应该不抛出错误
      await expect(sessionManagerAny.onDispose(disposeOptionsForce)).resolves.toBeUndefined();
      
      // 重新设置测试环境
      sessionManagerAny.currentSession = { sessionId: 'test' };
      sessionManagerAny.unsavedChanges = true;
      sessionManagerAny.saveCurrentSession = jest.fn().mockRejectedValue(new Error('保存失败'));
      
      // 非force模式应该抛出错误
      const disposeOptionsNonForce: ServiceDisposeOptions = { force: false };
      await expect(sessionManagerAny.onDispose(disposeOptionsNonForce)).rejects.toThrow('保存失败');
    });

    it('应该覆盖createSession方法 - 行178-208', async () => {
      const config = {
        name: 'Test Session',
        description: 'Test Description',
        captureSettings: {
          sampleRate: 2000000
        }
      };
      
      const sessionId = await sessionManager.createSession(config);
      
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
      
      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession).toBeDefined();
      expect(currentSession!.name).toBe('Test Session');
      expect(currentSession!.description).toBe('Test Description');
    });

    it('应该覆盖setActiveSession方法的各种路径 - 行213-244', async () => {
      // 场景1：设置相同的会话ID应该早期返回
      await sessionManager.createSession({ name: 'Current Session' });
      const currentSession = sessionManager.getCurrentSession();
      const sessionId = currentSession!.sessionId;
      
      await sessionManager.setActiveSession(sessionId);
      
      // 应该仍然是同一个会话
      expect(sessionManager.getCurrentSession()!.sessionId).toBe(sessionId);
      
      // 场景2：切换到不同的会话，且有未保存更改
      sessionManager.markUnsaved();
      
      // Mock saveCurrentSession方法
      const sessionManagerAny = sessionManager as any;
      sessionManagerAny.saveCurrentSession = jest.fn().mockResolvedValue(undefined);
      
      await sessionManager.setActiveSession('new-session-id');
      
      expect(sessionManagerAny.saveCurrentSession).toHaveBeenCalled();
      expect(sessionManager.getCurrentSession()!.sessionId).toBe('new-session-id');
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
    });

    it('应该覆盖getActiveSession方法 - 行249-251', async () => {
      const activeSession = await sessionManager.getActiveSession();
      expect(activeSession).toBeUndefined();
      
      await sessionManager.createSession({ name: 'Active Session' });
      const newActiveSession = await sessionManager.getActiveSession();
      expect(newActiveSession).toBeDefined();
      expect(newActiveSession!.name).toBe('Active Session');
    });

    it('应该覆盖getSessionState方法 - 行256-264', async () => {
      const sessionId = 'test-session';
      const state = await sessionManager.getSessionState(sessionId);
      
      expect(state).toHaveProperty('lastModified');
      expect(state).toHaveProperty('isModified');
      expect(typeof state.lastModified).toBe('number');
      expect(typeof state.isModified).toBe('boolean');
    });

    it('应该覆盖synchronizeSession方法 - 行269-283', async () => {
      const sessionId = 'test-session';
      
      // 设置未保存状态
      sessionManager.markUnsaved();
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
      
      const result = await sessionManager.synchronizeSession(sessionId);
      
      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(0);
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
    });

    it('应该覆盖saveCaptureData方法 - 行288-298', async () => {
      // 创建会话
      const sessionId = await sessionManager.createSession({ name: 'Capture Session' });
      
      const captureData = {
        metadata: {
          sampleRate: 1000000,
          totalSamples: 10000
        }
      };
      
      await sessionManager.saveCaptureData(sessionId, captureData);
      
      const currentSession = sessionManager.getCurrentSession();
      expect(currentSession!.metadata.captureSettings.sampleRate).toBe(1000000);
      expect(currentSession!.metadata.captureSettings.totalSamples).toBe(10000);
      expect(currentSession!.metadata.captureSettings.duration).toBe(0.01);
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
      
      // 测试不匹配的sessionId不会更新
      await sessionManager.saveCaptureData('wrong-id', captureData);
      // 应该没有额外的更改
    });

    it('应该覆盖getAllSessions方法 - 行303-307', async () => {
      // 没有当前会话时
      let sessions = await sessionManager.getAllSessions();
      expect(sessions).toEqual([]);
      
      // 有当前会话时
      await sessionManager.createSession({ name: 'Test Session' });
      sessions = await sessionManager.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Test Session');
    });
  });

  describe('Map类型恢复逻辑覆盖 - 行697', () => {
    it('应该覆盖decoderResults的Map恢复逻辑', async () => {
      const sessionManagerAny = sessionManager as any;
      
      // Mock文件内容包含decoderResults数组
      const mockContent = JSON.stringify({
        version: '1.0.0',
        sessionId: 'test',
        name: 'Test',
        captureSession: {},
        decoderResults: [['key1', 'value1'], ['key2', 'value2']],
        metadata: {
          captureSettings: { sampleRate: 1000, totalSamples: 100, duration: 0.1 },
          fileInfo: { size: 100 }
        }
      });
      
      const sessionData = await sessionManagerAny.deserializeSession(mockContent, 'test.lacsession');
      
      expect(sessionData.decoderResults).toBeInstanceOf(Map);
      expect(sessionData.decoderResults.get('key1')).toBe('value1');
      expect(sessionData.decoderResults.get('key2')).toBe('value2');
    });
  });

  describe('LAC格式转换覆盖 - 行733-754', () => {
    it('应该覆盖convertLegacyLacFormat方法的完整转换逻辑', async () => {
      const sessionManagerAny = sessionManager as any;
      
      // 创建有效的LAC格式数据
      const legacyLacContent = JSON.stringify({
        settings: {
          frequency: 1000000,
          preTriggerSamples: 5000,
          postTriggerSamples: 5000,
          captureChannels: []
        },
        selectedRegions: [{ start: 0, end: 100 }]
      });
      
      const convertedSession = sessionManagerAny.convertLegacyLacFormat(legacyLacContent);
      
      expect(convertedSession.version).toBe('1.0.0');
      expect(convertedSession.name).toBe('Imported LAC File');
      expect(convertedSession.captureSession.frequency).toBe(1000000);
      expect(convertedSession.selectedRegions).toHaveLength(1);
      expect(convertedSession.metadata.captureSettings.sampleRate).toBe(1000000);
      expect(convertedSession.metadata.captureSettings.totalSamples).toBe(10000);
      expect(convertedSession.metadata.captureSettings.duration).toBe(0.01);
      expect(convertedSession.metadata.fileInfo.size).toBeGreaterThan(0);
    });

    it('应该在LAC文件无效时抛出错误', async () => {
      const sessionManagerAny = sessionManager as any;
      
      // 无效的LAC数据（缺少settings）
      const invalidLacContent = JSON.stringify({
        someData: 'test'
      });
      
      expect(() => {
        sessionManagerAny.convertLegacyLacFormat(invalidLacContent);
      }).toThrow('无效的LAC文件格式');
    });

    it('应该在deserializeSession中处理LAC文件', async () => {
      const sessionManagerAny = sessionManager as any;
      
      // 创建一个JSON语法错误的内容，这样会进入catch块
      const invalidJsonContent = '{"settings": {"frequency": 2000000, "preTriggerSamples": 1000, "postTriggerSamples": 2000, "captureChannels": []';
      
      // Mock convertLegacyLacFormat方法
      sessionManagerAny.convertLegacyLacFormat = jest.fn().mockReturnValue({
        version: '1.0.0',
        name: 'Imported LAC File',
        captureSession: { frequency: 2000000 },
        sessionId: 'test-id',
        timestamp: new Date().toISOString(),
        metadata: {
          captureSettings: { sampleRate: 2000000, totalSamples: 3000, duration: 0.0015 },
          fileInfo: { size: 100 }
        }
      });
      
      // 模拟deserializeSession处理LAC文件的情况（当JSON解析失败时）
      const sessionData = await sessionManagerAny.deserializeSession(invalidJsonContent, 'test.lac');
      
      expect(sessionManagerAny.convertLegacyLacFormat).toHaveBeenCalledWith(invalidJsonContent);
      expect(sessionData.name).toBe('Imported LAC File');
      expect(sessionData.captureSession.frequency).toBe(2000000);
    });
  });

  describe('自动保存定时器逻辑覆盖 - 行845,849', () => {
    it('应该覆盖startAutoSave方法中的定时器清理逻辑 - 行845', async () => {
      const options: SessionManagerOptions = {
        autoSave: true,
        autoSaveInterval: 1 // 1秒用于快速测试
      };
      
      const managerWithAutoSave = new SessionManager(options);
      const managerAny = managerWithAutoSave as any;
      
      // 验证定时器已经设置
      expect(managerAny.autoSaveTimer).toBeDefined();
      
      // 模拟已有定时器的情况，再次调用startAutoSave
      const existingTimer = managerAny.autoSaveTimer;
      
      // 手动调用startAutoSave来覆盖行845的逻辑
      managerAny.startAutoSave();
      
      // 应该清理了旧的定时器并设置了新的
      expect(managerAny.autoSaveTimer).toBeDefined();
      expect(managerAny.autoSaveTimer).not.toBe(existingTimer);
      
      await managerWithAutoSave.dispose();
    });

    it('应该覆盖自动保存定时器的回调执行 - 行849', async () => {
      const options: SessionManagerOptions = {
        autoSave: true,
        autoSaveInterval: 0.1 // 100ms用于快速测试
      };
      
      const managerWithAutoSave = new SessionManager(options);
      const managerAny = managerWithAutoSave as any;
      
      // Mock autoSave方法
      managerAny.autoSave = jest.fn().mockResolvedValue({ success: true });
      
      // 等待定时器触发
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(managerAny.autoSave).toHaveBeenCalled();
      
      await managerWithAutoSave.dispose();
    });

    it('应该测试构造函数中自动保存的启动逻辑', () => {
      const optionsWithAutoSave: SessionManagerOptions = {
        autoSave: true,
        autoSaveInterval: 60
      };
      
      const managerWithAutoSave = new SessionManager(optionsWithAutoSave);
      const managerAny = managerWithAutoSave as any;
      
      expect(managerAny.autoSaveTimer).toBeDefined();
      
      managerWithAutoSave.dispose();
    });
  });

  describe('其他边界条件和错误处理', () => {
    it('应该处理空的LAC selectedRegions', async () => {
      const sessionManagerAny = sessionManager as any;
      
      const legacyLacContent = JSON.stringify({
        settings: {
          frequency: 1000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 1000,
          captureChannels: []
        }
        // 没有selectedRegions字段
      });
      
      const convertedSession = sessionManagerAny.convertLegacyLacFormat(legacyLacContent);
      
      expect(convertedSession.selectedRegions).toEqual([]);
    });

    it('应该处理deserializeSession中的各种数据类型恢复', async () => {
      const sessionManagerAny = sessionManager as any;
      
      const mockContent = JSON.stringify({
        version: '1.0.0',
        sessionId: 'test',
        name: 'Test',
        captureSession: {},
        viewSettings: {
          channelColors: {} // 空对象，应该转换为Map
        },
        metadata: {
          captureSettings: { sampleRate: 1000, totalSamples: 100, duration: 0.1 },
          fileInfo: { size: 100 }
        }
      });
      
      const sessionData = await sessionManagerAny.deserializeSession(mockContent, 'test.lacsession');
      
      expect(sessionData.viewSettings.channelColors).toBeInstanceOf(Map);
      expect(sessionData.viewSettings.channelColors.size).toBe(0);
    });
  });
});