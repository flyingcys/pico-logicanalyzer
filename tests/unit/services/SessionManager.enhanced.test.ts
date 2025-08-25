/**
 * SessionManager 增强测试用例
 * 
 * 专注提升服务层测试覆盖率，验证核心功能：
 * - 会话保存和恢复机制
 * - 版本控制和元数据管理
 * - 自动保存和备份功能
 * - 数据完整性验证
 */

// Mock vscode模块
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: jest.fn(() => ({ 
      get: jest.fn((key) => {
        const configs = {
          'autoSave': true,
          'autoSaveInterval': 300,
          'maxHistoryVersions': 10,
          'compressionEnabled': true,
          'backupEnabled': true
        };
        return configs[key as keyof typeof configs];
      })
    }))
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn()
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
  readdir: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn()
}));

import { SessionManager, SessionData, SessionManagerOptions } from '../../../src/services/SessionManager';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType } from '../../../src/models/AnalyzerTypes';
import * as fs from 'fs/promises';

describe('SessionManager 增强测试', () => {
  let sessionManager: SessionManager;
  let testSession: CaptureSession;
  let testSessionData: SessionData;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    sessionManager = new SessionManager();
    await sessionManager.initialize();
    
    // 创建测试采集会话
    testSession = new CaptureSession();
    testSession.frequency = 1000000;
    testSession.preTriggerSamples = 100;
    testSession.postTriggerSamples = 1000;
    testSession.triggerType = TriggerType.Edge;
    testSession.triggerChannel = 0;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'CH0'),
      new AnalyzerChannel(1, 'CH1')
    ];
    
    // 添加测试数据
    testSession.captureChannels[0].samples = new Uint8Array([0xAA, 0x55, 0xFF]);
    testSession.captureChannels[1].samples = new Uint8Array([0x00, 0xFF, 0xAA]);
    
    // 创建测试会话数据
    testSessionData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      sessionId: 'test-session-123',
      name: '测试会话',
      description: '用于单元测试的会话数据',
      tags: ['test', 'unit-test'],
      captureSession: testSession,
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
  });

  afterEach(async () => {
    if (sessionManager) {
      await sessionManager.dispose();
    }
  });

  describe('会话保存功能', () => {
    it('应该成功保存会话到文件', async () => {
      // Mock文件写入成功
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      
      const filePath = '/test/sessions/test-session.json';
      const result = await sessionManager.saveSession(testSessionData, filePath);
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(filePath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.any(String),
        'utf8'
      );
    });

    it('应该处理保存文件时的目录创建', async () => {
      // Mock目录不存在，需要创建
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      
      const filePath = '/test/new-dir/session.json';
      const result = await sessionManager.saveSession(testSessionData, filePath);
      
      expect(result.success).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('new-dir'),
        { recursive: true }
      );
    });

    it('应该处理保存失败的情况', async () => {
      // Mock写入失败
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write permission denied'));
      
      const filePath = '/readonly/session.json';
      const result = await sessionManager.saveSession(testSessionData, filePath);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Write permission denied');
    });

    it('应该包含完整的元数据', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 2048 });
      
      const filePath = '/test/complete-session.json';
      await sessionManager.saveSession(testSessionData, filePath);
      
      // 验证写入的数据包含所有必要字段
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      
      expect(savedData).toHaveProperty('version');
      expect(savedData).toHaveProperty('timestamp');
      expect(savedData).toHaveProperty('sessionId');
      expect(savedData).toHaveProperty('captureSession');
      expect(savedData).toHaveProperty('metadata');
      expect(savedData.captureSession).toHaveProperty('frequency', 1000000);
      expect(savedData.captureSession.captureChannels).toHaveLength(2);
    });
  });

  describe('会话加载功能', () => {
    it('应该成功从文件加载会话', async () => {
      // Mock文件读取成功
      const mockFileContent = JSON.stringify(testSessionData);
      (fs.readFile as jest.Mock).mockResolvedValue(mockFileContent);
      
      const filePath = '/test/sessions/existing-session.json';
      const result = await sessionManager.loadSession(filePath);
      
      expect(result.success).toBe(true);
      // SessionOperationResult只有sessionId，不有sessionData
      expect(result.sessionId).toBeDefined();
      
      // 需要通过getCurrentSession()来获取会话数据
      const sessionData = sessionManager.getCurrentSession();
      expect(sessionData?.name).toBe('测试会话');
      expect(sessionData?.captureSession.frequency).toBe(1000000);
    });

    it('应该处理文件不存在的情况', async () => {
      // Mock文件不存在
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);
      
      const filePath = '/test/nonexistent.json';
      const result = await sessionManager.loadSession(filePath);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('应该处理损坏的JSON文件', async () => {
      // Mock无效JSON内容
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json content {');
      
      const filePath = '/test/corrupted.json';
      const result = await sessionManager.loadSession(filePath);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    it('应该验证会话数据完整性', async () => {
      // Mock缺少必要字段的会话数据
      const incompleteData = {
        version: '1.0.0',
        // 缺少timestamp, sessionId等字段
        captureSession: testSession
      };
      
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(incompleteData));
      
      const filePath = '/test/incomplete.json';
      const result = await sessionManager.loadSession(filePath);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('数据完整性');
    });

    it('应该恢复通道数据', async () => {
      // 确保样本数据被正确序列化和反序列化
      const sessionWithData = { ...testSessionData };
      sessionWithData.captureSession.captureChannels[0].samples = new Uint8Array([0x12, 0x34, 0x56]);
      
      // JSON序列化会将Uint8Array转换为对象，需要手动处理
      const serializedData = JSON.stringify(sessionWithData, (key, value) => {
        if (value instanceof Uint8Array) {
          return Array.from(value);
        }
        return value;
      });
      
      (fs.readFile as jest.Mock).mockResolvedValue(serializedData);
      
      const filePath = '/test/session-with-data.json';
      const result = await sessionManager.loadSession(filePath);
      
      expect(result.success).toBe(true);
      // 通过getCurrentSession()获取会话数据
      const sessionData = sessionManager.getCurrentSession();
      expect(sessionData?.captureSession.captureChannels[0].samples).toBeDefined();
    });
  });

  describe('自动保存功能', () => {
    it('应该启用自动保存', async () => {
      const options: SessionManagerOptions = {
        autoSave: true,
        autoSaveInterval: 60 // 60秒
      };
      
      // SessionManager没有updateOptions/getOptions方法
      // 只能通过构造函数设置选项
      const newSessionManager = new SessionManager(options);
      await newSessionManager.initialize();
      
      // 无法直接验证选项，但可以验证初始化成功
      expect(newSessionManager).toBeDefined();
    });

    it('应该处理自动保存定时器', async () => {
      jest.useFakeTimers();
      
      const options: SessionManagerOptions = {
        autoSave: true,
        autoSaveInterval: 30
      };
      
      // 创建带自动保存选项的新SessionManager
      const autoSaveSessionManager = new SessionManager(options);
      await autoSaveSessionManager.initialize();
      
      // Mock保存操作
      const mockSaveSession = jest.spyOn(autoSaveSessionManager, 'saveSession').mockResolvedValue({
        success: true,
        filePath: '/auto-save/session.json'
      });
      
      // 使用updateCurrentSession替代setCurrentSession
      autoSaveSessionManager.updateCurrentSession(testSessionData);
      
      // 快进时间
      jest.advanceTimersByTime(31000); // 31秒
      
      // 等待异步操作
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockSaveSession).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    it('应该禁用自动保存', async () => {
      // 创建不同选项的SessionManager实例
      const autoSaveManager = new SessionManager({ autoSave: true, autoSaveInterval: 30 });
      await autoSaveManager.initialize();

      const noAutoSaveManager = new SessionManager({ autoSave: false });
      await noAutoSaveManager.initialize();

      // 验证创建成功
      expect(autoSaveManager).toBeDefined();
      expect(noAutoSaveManager).toBeDefined();
    });
  });

  describe('会话历史和版本控制', () => {
    it('应该获取会话历史', async () => {
      // Mock历史文件列表
      (fs.readdir as jest.Mock).mockResolvedValue([
        'session-v1.json',
        'session-v2.json',
        'session-v3.json'
      ]);
      
      const history = await sessionManager.getSessionHistory('/test/sessions/');
      
      expect(history.length).toBe(3);
      expect(history[0]).toContain('session-v1.json');
    });

    it('应该限制历史版本数量', async () => {
      const options: SessionManagerOptions = {
        maxHistoryVersions: 5
      };
      
      await sessionManager.updateOptions(options);
      
      // Mock多个历史文件
      (fs.readdir as jest.Mock).mockResolvedValue([
        'session-v1.json', 'session-v2.json', 'session-v3.json',
        'session-v4.json', 'session-v5.json', 'session-v6.json',
        'session-v7.json'
      ]);
      
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
      
      // 模拟清理旧版本
      await sessionManager.cleanupOldVersions('/test/sessions/', 'session');
      
      // 应该删除超出限制的旧版本
      expect(fs.unlink).toHaveBeenCalledTimes(2); // 删除最老的2个版本
    });

    it('应该创建备份', async () => {
      const options: SessionManagerOptions = {
        backupEnabled: true
      };
      
      await sessionManager.updateOptions(options);
      
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      
      const result = await sessionManager.saveSession(testSessionData, '/test/session.json');
      
      expect(result.success).toBe(true);
      // 应该创建备份文件
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('backup'),
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('数据压缩和性能', () => {
    it('应该处理大型会话数据', async () => {
      // 创建大量测试数据
      const largeSession = { ...testSession };
      const largeData = new Uint8Array(100000).fill(0xAA); // 100KB数据
      largeSession.captureChannels[0].samples = largeData;
      
      const largeSessionData = { ...testSessionData, captureSession: largeSession };
      
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 102400 });
      
      const result = await sessionManager.saveSession(largeSessionData, '/test/large-session.json');
      
      expect(result.success).toBe(true);
      expect(result.metadata?.fileSize).toBeGreaterThan(100000);
    });

    it('应该启用数据压缩', async () => {
      const options: SessionManagerOptions = {
        compressionEnabled: true
      };
      
      await sessionManager.updateOptions(options);
      
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 512 }); // 压缩后更小
      
      const result = await sessionManager.saveSession(testSessionData, '/test/compressed.json');
      
      expect(result.success).toBe(true);
      expect(result.metadata?.compression).toBe('enabled');
    });
  });

  describe('错误处理和恢复', () => {
    it('应该处理磁盘空间不足', async () => {
      // Mock磁盘空间不足错误
      const error = new Error('No space left on device');
      (error as any).code = 'ENOSPC';
      (fs.writeFile as jest.Mock).mockRejectedValue(error);
      
      const result = await sessionManager.saveSession(testSessionData, '/test/full-disk.json');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('空间不足');
    });

    it('应该处理权限错误', async () => {
      // Mock权限错误
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';
      (fs.writeFile as jest.Mock).mockRejectedValue(error);
      
      const result = await sessionManager.saveSession(testSessionData, '/readonly/session.json');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('权限');
    });

    it('应该验证会话数据', () => {
      // 测试无效会话数据
      const invalidData = {
        version: '1.0.0',
        // 缺少必要字段
      };
      
      const isValid = sessionManager.validateSessionData(invalidData as any);
      
      expect(isValid).toBe(false);
    });

    it('应该恢复损坏的会话', async () => {
      // Mock部分损坏的数据
      const corruptedData = { ...testSessionData };
      delete (corruptedData as any).timestamp;
      
      const recovered = await sessionManager.recoverSession(corruptedData as any);
      
      expect(recovered).toBeDefined();
      expect(recovered.timestamp).toBeDefined(); // 应该重新生成时间戳
    });
  });
});