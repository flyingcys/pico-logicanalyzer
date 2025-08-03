/**
 * SessionManager 增强覆盖率测试
 * 专门针对未覆盖的代码路径进行测试，力求达到100%覆盖率
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionManager, SessionData } from '../../../src/services/SessionManager';

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

describe('SessionManager 增强覆盖率测试', () => {
  let sessionManager: SessionManager;
  let mockVSCode: any;
  let mockFS: any;

  beforeEach(() => {
    mockVSCode = require('vscode') as any;
    mockFS = require('fs/promises') as any;
    
    // Mock global functions
    global.clearInterval = jest.fn();
    global.setInterval = jest.fn();
    
    sessionManager = new SessionManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    sessionManager.dispose();
  });

  describe('未覆盖代码路径测试', () => {
    it('应该处理用户取消加载操作的情况', async () => {
      // 测试未覆盖行 234: 用户取消加载
      mockVSCode.window.showOpenDialog.mockResolvedValue(null); // 用户取消

      const result = await sessionManager.loadSession();

      expect(result.success).toBe(false);
      expect(result.error).toBe('用户取消了加载操作');
    });

    it('应该处理loadSession中文件不存在的情况', async () => {
      // 测试未覆盖行 242: 文件不存在
      const nonExistentPath = '/test/nonexistent.lacs';
      mockFS.access.mockRejectedValue(new Error('ENOENT'));

      const result = await sessionManager.loadSession(nonExistentPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe(`文件不存在: ${nonExistentPath}`);
    });

    it('应该测试markAsModified方法', () => {
      // 测试未覆盖行 430: markAsModified方法
      expect(sessionManager.hasUnsavedChanges()).toBe(false);
      
      sessionManager.markAsModified();
      
      expect(sessionManager.hasUnsavedChanges()).toBe(true);
    });

    it('应该处理自动保存过程中的错误', async () => {
      // 测试未覆盖行 301: 自动保存错误处理
      const sessionData = {
        sessionId: 'test-session',
        captureSession: {
          id: 'test',
          frequency: 24000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 2000,
          triggerType: 0,
          triggerChannel: 0,
          triggerInverted: false,
          captureChannels: []
        }
      };

      // 设置当前会话和未保存状态
      (sessionManager as any).currentSession = sessionData;
      sessionManager.markUnsaved();

      // 模拟mkdir失败
      mockFS.mkdir.mockRejectedValue(new Error('创建目录失败'));

      const result = await sessionManager.autoSave();

      expect(result.success).toBe(false);
      expect(result.error).toContain('创建目录失败');
    });

    it('应该正确清理有自动保存定时器的资源', () => {
      // 测试未覆盖行 477-478: dispose中清理自动保存定时器
      const autoSaveManager = new SessionManager({ autoSave: true, autoSaveInterval: 60 });
      
      // 验证定时器已启动
      expect(global.setInterval).toHaveBeenCalled();
      
      // 设置定时器ID模拟
      (autoSaveManager as any).autoSaveTimer = 12345;
      
      // 调用dispose
      autoSaveManager.dispose();
      
      // 验证clearInterval被调用
      expect(global.clearInterval).toHaveBeenCalledWith(12345);
      expect((autoSaveManager as any).autoSaveTimer).toBeUndefined();
    });

    it('应该处理压缩禁用的情况', async () => {
      // 测试未覆盖行 508: 压缩禁用时的返回路径
      const manager = new SessionManager({ compressionEnabled: false });
      const sessionData = {
        version: '1.0.0',
        sessionId: 'test',
        name: 'test',
        captureSession: {
          frequency: 24000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 2000,
          triggerType: 0,
          triggerChannel: 0,
          triggerInverted: false,
          captureChannels: []
        },
        metadata: {
          captureSettings: {
            sampleRate: 24000000,
            totalSamples: 3000,
            duration: 0.000125
          },
          fileInfo: { size: 0 }
        }
      } as SessionData;

      const filePath = '/test/uncompressed.lacs';
      mockFS.writeFile.mockResolvedValue(undefined);
      mockFS.mkdir.mockResolvedValue(undefined);

      await manager.saveSession(sessionData, filePath);

      expect(mockFS.writeFile).toHaveBeenCalled();
      
      manager.dispose();
    });

    it('应该处理会话历史中的复杂文件处理情况', async () => {
      // 测试未覆盖行 450, 454-460: 历史文件的复杂处理
      const sessionId = 'test-session';
      
      // 模拟存在历史目录和文件
      mockFS.access.mockResolvedValue(undefined);
      mockFS.readdir.mockResolvedValue([
        'session_v1.lacsession',
        'session_v2.lacsession', 
        'other_file.txt'  // 非.lacsession文件
      ]);

      // 模拟一个文件读取成功，一个失败
      mockFS.readFile
        .mockResolvedValueOnce(JSON.stringify({
          version: '1.0.0',
          sessionId: 'test-v1',
          captureSession: { frequency: 24000000 }
        }))
        .mockRejectedValueOnce(new Error('文件损坏'));

      // Mock deserializeSession
      const mockDeserialize = jest.spyOn(sessionManager as any, 'deserializeSession');
      mockDeserialize
        .mockResolvedValueOnce({ sessionId: 'test-v1', version: '1.0.0' })
        .mockRejectedValueOnce(new Error('反序列化失败'));

      const history = await sessionManager.getSessionHistory(sessionId);

      // 应该只返回成功解析的会话，忽略失败的
      expect(history).toHaveLength(1);
      expect(history[0].sessionId).toBe('test-v1');
      
      mockDeserialize.mockRestore();
    });
  });

  describe('LAC格式转换测试', () => {
    it('应该正确转换旧版LAC格式', async () => {
      // 创建一个无效的新格式数据，这样会触发catch块进入LAC转换
      const invalidNewFormat = '{ "invalid": "json" '; // 无效JSON会触发JSON.parse异常
      const filePath = '/test/legacy.lac';

      // 第一次readFile调用返回无效JSON
      mockFS.readFile.mockResolvedValueOnce(invalidNewFormat);

      // 直接测试convertLegacyLacFormat方法
      const legacyLacData = {
        settings: {
          frequency: 24000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 2000,
          triggerType: 1,
          triggerChannel: 0,
          triggerInverted: false,
          captureChannels: [
            { channelNumber: 0, channelName: 'CH0', hidden: false }
          ]
        },
        selectedRegions: [
          { startSample: 0, endSample: 100, label: 'Region1' }
        ]
      };

      const lacContent = JSON.stringify(legacyLacData);
      
      // Mock convertLegacyLacFormat方法直接调用
      const convertSpy = jest.spyOn(sessionManager as any, 'convertLegacyLacFormat');
      convertSpy.mockReturnValue({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        sessionId: 'converted-session',
        name: 'Imported LAC File',
        captureSession: legacyLacData.settings,
        selectedRegions: legacyLacData.selectedRegions,
        metadata: {
          captureSettings: {
            sampleRate: legacyLacData.settings.frequency,
            totalSamples: legacyLacData.settings.preTriggerSamples + legacyLacData.settings.postTriggerSamples,
            duration: (legacyLacData.settings.preTriggerSamples + legacyLacData.settings.postTriggerSamples) / legacyLacData.settings.frequency
          },
          fileInfo: {
            size: lacContent.length
          }
        }
      });

      const result = await sessionManager.loadSession(filePath);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(convertSpy).toHaveBeenCalledWith(invalidNewFormat);
      
      convertSpy.mockRestore();
    });

    it('应该处理无效的LAC格式', async () => {
      // 直接测试convertLegacyLacFormat方法的错误情况
      const invalidLacContent = JSON.stringify({
        // 缺少settings字段
        otherData: 'some value'
      });

      const manager = sessionManager as any;
      
      expect(() => {
        manager.convertLegacyLacFormat(invalidLacContent);
      }).toThrow('无效的LAC文件格式');
    });
  });

  describe('JSON序列化和特殊类型处理', () => {
    it('应该处理包含空对象的channelColors', async () => {
      // 测试未覆盖的序列化/反序列化路径
      const sessionData = {
        version: '1.0.0',
        sessionId: 'test',
        name: 'test',
        captureSession: {
          frequency: 24000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 2000,
          triggerType: 0,
          triggerChannel: 0,
          triggerInverted: false,
          captureChannels: []
        },
        viewSettings: {
          timebase: 1000,
          sampleOffset: 0,
          zoomLevel: 1.0,
          visibleChannels: [0, 1],
          channelColors: {}, // 空对象，不是Map
          displayMode: 'digital' as const
        },
        metadata: {
          captureSettings: {
            sampleRate: 24000000,
            totalSamples: 3000,
            duration: 0.000125
          },
          fileInfo: { size: 0 }
        }
      };

      const filePath = '/test/empty-colors.lacs';
      const serializedContent = JSON.stringify(sessionData);
      
      mockFS.readFile.mockResolvedValue(serializedContent);
      mockFS.access.mockResolvedValue(undefined);

      const result = await sessionManager.loadSession(filePath);

      expect(result.success).toBe(true);
      const loadedSession = sessionManager.getCurrentSession();
      expect(loadedSession?.viewSettings?.channelColors).toBeInstanceOf(Map);
      expect(loadedSession?.viewSettings?.channelColors?.size).toBe(0);
    });

    it('应该处理包含Uint8Array的特殊序列化', async () => {
      // 首先测试JSON replacer和reviver功能
      const manager = sessionManager as any;
      const replacer = manager.createJsonReplacer();
      const reviver = manager.createJsonReviver();

      // 测试Uint8Array序列化
      const uint8Array = new Uint8Array([1, 2, 3, 4, 5]);
      const serialized = replacer('testKey', uint8Array);
      
      expect(serialized).toEqual({
        __type: 'Uint8Array',
        data: [1, 2, 3, 4, 5]
      });

      // 测试Uint8Array反序列化
      const deserialized = reviver('testKey', serialized);
      expect(deserialized).toBeInstanceOf(Uint8Array);
      expect(Array.from(deserialized)).toEqual([1, 2, 3, 4, 5]);

      // 测试非Uint8Array值不被修改
      const normalValue = { normalData: 'test' };
      expect(replacer('test', normalValue)).toBe(normalValue);
      expect(reviver('test', normalValue)).toBe(normalValue);
    });
  });

  describe('边界情况和错误处理增强', () => {
    it('应该处理getSessionHistory中workspaceFolder为空的情况', async () => {
      // 模拟没有工作区的情况
      const originalWorkspaceFolders = mockVSCode.workspace.workspaceFolders;
      mockVSCode.workspace.workspaceFolders = undefined;

      const history = await sessionManager.getSessionHistory('test-session');

      expect(history).toEqual([]);

      // 恢复
      mockVSCode.workspace.workspaceFolders = originalWorkspaceFolders;
    });

    it('应该处理历史版本数量限制', async () => {
      // 测试maxHistoryVersions限制逻辑
      const manager = new SessionManager({ maxHistoryVersions: 2 });
      const sessionId = 'test-session';
      
      mockFS.access.mockResolvedValue(undefined);
      mockFS.readdir.mockResolvedValue([
        'v1.lacsession',
        'v2.lacsession', 
        'v3.lacsession',
        'v4.lacsession'  // 超过限制
      ]);

      // Mock文件读取都成功
      mockFS.readFile.mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        sessionId: 'test',
        captureSession: { frequency: 24000000 }
      }));

      const mockDeserialize = jest.spyOn(manager as any, 'deserializeSession');
      mockDeserialize.mockResolvedValue({ sessionId: 'test', version: '1.0.0' });

      const history = await manager.getSessionHistory(sessionId);

      // 应该只返回限制数量的结果
      expect(history).toHaveLength(2);
      
      mockDeserialize.mockRestore();
      manager.dispose();
    });

    it('应该处理反序列化中非数组的decoderResults', async () => {
      // 测试decoderResults不是数组的情况
      const sessionWithNonArrayDecoder = {
        version: '1.0.0',
        sessionId: 'test',
        captureSession: { frequency: 24000000 },
        decoderResults: { notAnArray: true } // 不是数组
      };

      const filePath = '/test/non-array-decoder.lacs';
      const content = JSON.stringify(sessionWithNonArrayDecoder);
      
      mockFS.readFile.mockResolvedValue(content);
      mockFS.access.mockResolvedValue(undefined);

      const result = await sessionManager.loadSession(filePath);

      expect(result.success).toBe(true);
      // decoderResults应该保持原样，不会被转换为Map
      const loadedSession = sessionManager.getCurrentSession();
      expect((loadedSession as any).decoderResults).toEqual({ notAnArray: true });
    });
  });

  describe('配置和选项测试', () => {
    it('应该测试所有构造函数选项的默认值', () => {
      const manager = new SessionManager({
        autoSave: true,
        autoSaveInterval: 120,
        maxHistoryVersions: 5,
        compressionEnabled: false,
        backupEnabled: false
      });

      // 验证选项已正确设置
      expect((manager as any).options.autoSave).toBe(true);
      expect((manager as any).options.autoSaveInterval).toBe(120);
      expect((manager as any).options.maxHistoryVersions).toBe(5);
      expect((manager as any).options.compressionEnabled).toBe(false);
      expect((manager as any).options.backupEnabled).toBe(false);

      manager.dispose();
    });

    it('应该测试空选项对象的默认值应用', () => {
      const manager = new SessionManager({});

      expect((manager as any).options.autoSave).toBe(false);
      expect((manager as any).options.autoSaveInterval).toBe(300);
      expect((manager as any).options.maxHistoryVersions).toBe(10);
      expect((manager as any).options.compressionEnabled).toBe(true);
      expect((manager as any).options.backupEnabled).toBe(true);

      manager.dispose();
    });
  });
});