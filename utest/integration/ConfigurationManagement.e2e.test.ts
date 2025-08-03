/**
 * 配置管理系统端到端集成测试
 * 测试配置管理、工作区管理、会话管理的完整集成流程
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { WorkspaceManager } from '../../src/services/WorkspaceManager';
import { SessionManager } from '../../src/services/SessionManager';
import { DataExportService } from '../../src/services/DataExportService';
import { LACEditorProvider } from '../../src/providers/LACEditorProvider';

// Mock VSCode API
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn().mockResolvedValue('确定'),
    showErrorMessage: jest.fn().mockResolvedValue('确定'),
    showWarningMessage: jest.fn().mockResolvedValue('确定'),
    showSaveDialog: jest.fn().mockResolvedValue({
      fsPath: '/tmp/test-config.json'
    }),
    showOpenDialog: jest.fn().mockResolvedValue([{
      fsPath: '/tmp/test-session.lac'
    }]),
    createWebviewPanel: jest.fn(() => ({
      webview: {
        html: '',
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn()
      },
      onDidDispose: jest.fn(),
      dispose: jest.fn()
    }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const configs: Record<string, any> = {
          'logicAnalyzer.defaultSampleRate': 24000000,
          'logicAnalyzer.autoDetectDevices': true,
          'logicAnalyzer.exportFormat': 'csv',
          'logicAnalyzer.workspaceSettings.autoSave': true,
          'logicAnalyzer.workspaceSettings.sessionTimeout': 300000,
          'logicAnalyzer.ui.theme': 'dark',
          'logicAnalyzer.performance.bufferSize': 65536
        };
        return configs[key];
      }),
      update: jest.fn(),
      inspect: jest.fn(() => ({
        key: 'test',
        defaultValue: 'default',
        globalValue: 'global',
        workspaceValue: 'workspace'
      }))
    })),
    workspaceFolders: [{
      uri: { fsPath: '/tmp/test-workspace' },
      name: 'test-workspace',
      index: 0
    }],
    onDidChangeConfiguration: jest.fn(),
    onDidChangeWorkspaceFolders: jest.fn(),
    onDidSaveTextDocument: jest.fn(),
    onDidOpenTextDocument: jest.fn(),
    onDidCloseTextDocument: jest.fn(),
    findFiles: jest.fn().mockResolvedValue([]),
    saveAll: jest.fn().mockResolvedValue(true)
  },
  Uri: {
    file: jest.fn((path: string) => ({ fsPath: path })),
    parse: jest.fn((path: string) => ({ fsPath: path }))
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  },
  ViewColumn: {
    One: 1,
    Two: 2,
    Three: 3
  }
}));

describe('配置管理系统端到端集成测试', () => {
  let configManager: ConfigurationManager;
  let workspaceManager: WorkspaceManager;
  let sessionManager: SessionManager;
  let exportService: DataExportService;
  let editorProvider: LACEditorProvider;
  let testWorkspaceDir: string;

  beforeAll(async () => {
    // 设置测试环境
    testWorkspaceDir = '/tmp/logic-analyzer-test-' + Date.now();
    
    try {
      await fs.mkdir(testWorkspaceDir, { recursive: true });
      await fs.mkdir(path.join(testWorkspaceDir, '.vscode'), { recursive: true });
      await fs.mkdir(path.join(testWorkspaceDir, 'captures'), { recursive: true });
      await fs.mkdir(path.join(testWorkspaceDir, 'exports'), { recursive: true });
    } catch (error) {
      // 目录可能已存在，忽略错误
    }
  });

  beforeEach(async () => {
    // 初始化所有服务
    configManager = new ConfigurationManager();
    workspaceManager = new WorkspaceManager();
    sessionManager = new SessionManager();
    exportService = new DataExportService();
    editorProvider = new LACEditorProvider();

    // 等待服务初始化
    await configManager.initialize();
    // WorkspaceManager 和 SessionManager 在构造函数中自动初始化
  });

  afterEach(async () => {
    // 清理服务
    try {
      if (configManager && typeof configManager.dispose === 'function') {
        await configManager.dispose();
      }
      // WorkspaceManager 和 SessionManager 可能没有 dispose 方法
      // 进行手动清理
      if (workspaceManager) {
        (workspaceManager as any).fileWatchers?.clear?.();
        (workspaceManager as any).backupTimer && clearTimeout((workspaceManager as any).backupTimer);
      }
      if (sessionManager) {
        (sessionManager as any).autoSaveTimer && clearTimeout((sessionManager as any).autoSaveTimer);
      }
    } catch (error) {
      // 忽略清理错误
    }
  });

  afterAll(async () => {
    // 清理测试目录
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('配置管理完整流程', () => {
    it('应该成功创建、修改、保存、加载完整配置', async () => {
      // 1. 创建初始配置
      const initialConfig = {
        deviceSettings: {
          defaultSampleRate: 24000000,
          autoDetectDevices: true,
          connectionTimeout: 5000
        },
        uiSettings: {
          theme: 'dark',
          defaultLayout: 'horizontal',
          showGridLines: true
        },
        performanceSettings: {
          bufferSize: 65536,
          maxSamples: 1000000,
          enableOptimizations: true
        }
      };

      // 保存配置
      await configManager.saveConfiguration('project', initialConfig);

      // 2. 验证配置已保存
      const savedConfig = await configManager.loadConfiguration('project');
      expect(savedConfig).toBeDefined();
      expect(savedConfig.deviceSettings.defaultSampleRate).toBe(24000000);
      expect(savedConfig.uiSettings.theme).toBe('dark');

      // 3. 修改配置
      const updatedConfig = {
        ...savedConfig,
        deviceSettings: {
          ...savedConfig.deviceSettings,
          defaultSampleRate: 48000000,
          autoDetectDevices: false
        },
        uiSettings: {
          ...savedConfig.uiSettings,
          theme: 'light'
        }
      };

      await configManager.updateConfiguration('project', updatedConfig);

      // 4. 验证配置更新
      const reloadedConfig = await configManager.loadConfiguration('project');
      expect(reloadedConfig.deviceSettings.defaultSampleRate).toBe(48000000);
      expect(reloadedConfig.deviceSettings.autoDetectDevices).toBe(false);
      expect(reloadedConfig.uiSettings.theme).toBe('light');

      // 5. 测试配置验证
      const isValid = await configManager.validateConfiguration(reloadedConfig);
      expect(isValid).toBe(true);
    });

    it('应该正确处理多级配置继承和覆盖', async () => {
      // 1. 设置全局配置
      const globalConfig = {
        deviceSettings: {
          defaultSampleRate: 12000000,
          autoDetectDevices: true
        },
        uiSettings: {
          theme: 'system'
        }
      };

      await configManager.saveConfiguration('global', globalConfig);

      // 2. 设置工作区配置（覆盖部分全局配置）
      const workspaceConfig = {
        deviceSettings: {
          defaultSampleRate: 24000000
          // autoDetectDevices 继承全局配置
        },
        performanceSettings: {
          bufferSize: 131072
        }
      };

      await configManager.saveConfiguration('workspace', workspaceConfig);

      // 3. 获取合并后的有效配置
      const effectiveConfig = await configManager.getEffectiveConfiguration();

      // 4. 验证配置继承和覆盖
      expect(effectiveConfig.deviceSettings.defaultSampleRate).toBe(24000000); // 工作区覆盖
      expect(effectiveConfig.deviceSettings.autoDetectDevices).toBe(true); // 继承全局
      expect(effectiveConfig.uiSettings.theme).toBe('system'); // 继承全局
      expect(effectiveConfig.performanceSettings.bufferSize).toBe(131072); // 工作区独有
    });
  });

  describe('工作区管理完整流程', () => {
    it('应该成功创建、配置、管理工作区会话', async () => {
      // 1. 创建新工作区
      const workspaceConfig = {
        name: 'Test Project',
        description: 'Integration test workspace',
        settings: {
          autoSave: true,
          sessionTimeout: 300000,
          maxSessions: 10
        }
      };

      const workspaceId = await workspaceManager.createWorkspace(testWorkspaceDir, workspaceConfig);
      expect(workspaceId).toBeDefined();
      expect(typeof workspaceId).toBe('string');

      // 2. 验证工作区创建
      const workspaceInfo = await workspaceManager.getWorkspaceInfo(workspaceId);
      expect(workspaceInfo).toBeDefined();
      expect(workspaceInfo.name).toBe('Test Project');
      expect(workspaceInfo.settings.autoSave).toBe(true);

      // 3. 在工作区中创建多个会话
      const sessionIds: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const sessionConfig = {
          name: `Session ${i + 1}`,
          description: `Test session ${i + 1}`,
          captureSettings: {
            sampleRate: 24000000 + i * 1000000,
            channels: i + 1,
            duration: 1000 + i * 500
          }
        };

        const sessionId = await sessionManager.createSession(sessionConfig);
        sessionIds.push(sessionId);
        
        // 关联会话到工作区
        await workspaceManager.addSession(workspaceId, sessionId);
      }

      // 4. 验证工作区包含所有会话
      const workspaceSessions = await workspaceManager.getSessions(workspaceId);
      expect(workspaceSessions).toHaveLength(3);
      expect(workspaceSessions.map(s => s.id)).toEqual(expect.arrayContaining(sessionIds));

      // 5. 测试会话切换和状态管理
      await sessionManager.setActiveSession(sessionIds[1]);
      const activeSession = await sessionManager.getActiveSession();
      expect(activeSession).toBeDefined();
      expect(activeSession!.id).toBe(sessionIds[1]);
      expect(activeSession!.name).toBe('Session 2');

      // 6. 测试工作区持久化
      await workspaceManager.saveWorkspace(workspaceId);
      
      // 重新加载工作区
      const reloadedWorkspace = await workspaceManager.loadWorkspace(workspaceId);
      expect(reloadedWorkspace).toBeDefined();
      expect(reloadedWorkspace.sessions).toHaveLength(3);
    });

    it('应该正确处理工作区迁移和升级', async () => {
      // 1. 创建旧版本工作区结构
      const legacyWorkspaceData = {
        version: '1.0.0',
        name: 'Legacy Workspace',
        sessions: [
          {
            id: 'legacy-session-1',
            name: 'Legacy Session',
            data: 'legacy-format-data'
          }
        ]
      };

      const legacyConfigPath = path.join(testWorkspaceDir, 'legacy-workspace.json');
      await fs.writeFile(legacyConfigPath, JSON.stringify(legacyWorkspaceData, null, 2));

      // 2. 触发工作区迁移
      const migratedWorkspaceId = await workspaceManager.migrateWorkspace(legacyConfigPath);
      expect(migratedWorkspaceId).toBeDefined();

      // 3. 验证迁移结果
      const migratedWorkspace = await workspaceManager.getWorkspaceInfo(migratedWorkspaceId);
      expect(migratedWorkspace).toBeDefined();
      expect(migratedWorkspace.name).toBe('Legacy Workspace');
      expect(migratedWorkspace.version).not.toBe('1.0.0'); // 应该升级到新版本

      // 4. 验证会话数据迁移
      const migratedSessions = await workspaceManager.getSessions(migratedWorkspaceId);
      expect(migratedSessions).toHaveLength(1);
      expect(migratedSessions[0].name).toBe('Legacy Session');
    });
  });

  describe('数据导出集成流程', () => {
    it('应该完成从采集到导出的完整数据流', async () => {
      // 1. 创建模拟采集会话
      const sessionConfig = {
        name: 'Export Test Session',
        description: 'Complete export workflow test',
        captureSettings: {
          sampleRate: 24000000,
          channels: 4,
          duration: 2000
        }
      };

      const sessionId = await sessionManager.createSession(sessionConfig);
      await sessionManager.setActiveSession(sessionId);

      // 2. 模拟采集数据
      const mockCaptureData = {
        metadata: {
          deviceId: 'test-device',
          timestamp: Date.now(),
          sampleRate: 24000000,
          totalSamples: 48000,
          channels: 4
        },
        channels: [
          {
            id: 0,
            name: 'CLK',
            samples: new Uint8Array(48000).map((_, i) => i % 2)
          },
          {
            id: 1,
            name: 'DATA',
            samples: new Uint8Array(48000).map((_, i) => Math.floor(i / 8) % 2)
          },
          {
            id: 2,
            name: 'CS',
            samples: new Uint8Array(48000).map((_, i) => i < 40000 ? 0 : 1)
          },
          {
            id: 3,
            name: 'RESET',
            samples: new Uint8Array(48000).map((_, i) => i < 1000 ? 0 : 1)
          }
        ],
        annotations: [
          {
            start: 1000,
            end: 2000,
            type: 'start_condition',
            description: 'Communication start'
          },
          {
            start: 40000,
            end: 41000,
            type: 'stop_condition',
            description: 'Communication end'
          }
        ]
      };

      // 保存采集数据到会话
      await sessionManager.saveCaptureData(sessionId, mockCaptureData);

      // 3. 执行多种格式导出
      const exportFormats = ['csv', 'json', 'vcd', 'lac'];
      const exportResults: Record<string, any> = {};

      for (const format of exportFormats) {
        const exportPath = path.join(testWorkspaceDir, 'exports', `test-export.${format}`);
        
        const exportConfig = {
          format,
          includeMetadata: true,
          includeAnnotations: true,
          channelSelection: 'all',
          timeRange: 'all',
          compression: format === 'lac' ? 'gzip' : 'none'
        };

        const result = await exportService.exportData(mockCaptureData, exportPath, exportConfig);
        exportResults[format] = result;

        // 验证导出成功
        expect(result.success).toBe(true);
        expect(result.filePath).toBe(exportPath);
        expect(result.fileSize).toBeGreaterThan(0);
      }

      // 4. 验证导出文件存在且有效
      for (const format of exportFormats) {
        const filePath = exportResults[format].filePath;
        
        try {
          const stats = await fs.stat(filePath);
          expect(stats.isFile()).toBe(true);
          expect(stats.size).toBeGreaterThan(0);

          // 验证文件内容格式
          const content = await fs.readFile(filePath, 'utf-8');
          
          switch (format) {
            case 'csv':
              expect(content).toContain('timestamp');
              expect(content).toContain('CLK,DATA,CS,RESET');
              break;
            case 'json':
              const jsonData = JSON.parse(content);
              expect(jsonData.metadata).toBeDefined();
              expect(jsonData.channels).toHaveLength(4);
              break;
            case 'vcd':
              expect(content).toContain('$version');
              expect(content).toContain('$var wire');
              expect(content).toContain('$enddefinitions');
              break;
            case 'lac':
              // LAC格式是二进制，验证文件头
              const buffer = await fs.readFile(filePath);
              expect(buffer.length).toBeGreaterThan(100);
              break;
          }
        } catch (error) {
          fail(`Export file validation failed for ${format}: ${error}`);
        }
      }

      // 5. 测试导出配置持久化
      const exportProfile = {
        name: 'Standard Export',
        description: 'Default export settings',
        settings: {
          formats: ['csv', 'json'],
          includeMetadata: true,
          includeAnnotations: true
        }
      };

      await configManager.saveExportProfile('standard', exportProfile);
      const savedProfile = await configManager.loadExportProfile('standard');
      
      expect(savedProfile).toBeDefined();
      expect(savedProfile.name).toBe('Standard Export');
      expect(savedProfile.settings.formats).toEqual(['csv', 'json']);
    });
  });

  describe('WebView集成流程', () => {
    it('应该完成WebView编辑器的完整生命周期', async () => {
      // 1. 创建LAC文件编辑器
      const testLacFile = path.join(testWorkspaceDir, 'test-file.lac');
      
      // 创建模拟LAC文件
      const mockLacData = {
        version: '2.0.0',
        metadata: {
          deviceId: 'test-device',
          timestamp: Date.now(),
          sampleRate: 24000000
        },
        channels: [
          { id: 0, name: 'CLK', samples: new Uint8Array(1000) },
          { id: 1, name: 'DATA', samples: new Uint8Array(1000) }
        ]
      };

      await fs.writeFile(testLacFile, JSON.stringify(mockLacData));

      // 2. 通过编辑器提供器打开文件
      const mockUri = { fsPath: testLacFile } as vscode.Uri;
      const mockToken = { isCancellationRequested: false } as vscode.CancellationToken;

      const webviewPanel = await editorProvider.resolveCustomEditor(
        { viewType: 'logicAnalyzer.lacEditor' } as any,
        mockUri,
        mockToken
      );

      expect(webviewPanel).toBeDefined();

      // 3. 模拟WebView消息交互
      const messageHandlers: Array<(message: any) => void> = [];
      
      // Mock WebView消息系统
      const mockWebview = webviewPanel.webview as any;
      mockWebview.onDidReceiveMessage = jest.fn((handler) => {
        messageHandlers.push(handler);
      });

      // 4. 发送初始化消息
      const initMessage = {
        command: 'initialize',
        data: {
          fileUri: testLacFile,
          settings: await configManager.getEffectiveConfiguration()
        }
      };

      // 模拟从WebView接收消息
      messageHandlers.forEach(handler => handler(initMessage));

      // 5. 模拟数据更新
      const updateMessage = {
        command: 'updateData',
        data: {
          channels: [
            { id: 0, name: 'CLK_UPDATED', visible: true },
            { id: 1, name: 'DATA_UPDATED', visible: false }
          ],
          timeRange: { start: 0, end: 1000 },
          annotations: [
            { start: 100, end: 200, type: 'marker', text: 'Test marker' }
          ]
        }
      };

      messageHandlers.forEach(handler => handler(updateMessage));

      // 6. 模拟设置更改
      const settingsMessage = {
        command: 'updateSettings',
        data: {
          theme: 'light',
          gridLines: true,
          timeScale: 'microseconds'
        }
      };

      messageHandlers.forEach(handler => handler(settingsMessage));

      // 7. 验证WebView正确响应
      expect(mockWebview.postMessage).toHaveBeenCalled();
      
      // 检查是否发送了配置更新消息
      const postMessageCalls = (mockWebview.postMessage as jest.Mock).mock.calls;
      const configUpdateCall = postMessageCalls.find(call => 
        call[0]?.command === 'configurationUpdated'
      );
      expect(configUpdateCall).toBeDefined();
    });
  });

  describe('错误处理和恢复集成', () => {
    it('应该正确处理配置损坏和自动恢复', async () => {
      // 1. 创建损坏的配置文件
      const corruptConfigPath = path.join(testWorkspaceDir, 'corrupt-config.json');
      await fs.writeFile(corruptConfigPath, '{ invalid json content');

      // 2. 尝试加载损坏的配置
      let errorCaught = false;
      let recoveredConfig;

      try {
        await configManager.loadConfiguration('custom', corruptConfigPath);
      } catch (error) {
        errorCaught = true;
        
        // 触发自动恢复
        recoveredConfig = await configManager.recoverConfiguration('custom');
      }

      expect(errorCaught).toBe(true);
      expect(recoveredConfig).toBeDefined();

      // 3. 验证恢复的配置有效
      const isValid = await configManager.validateConfiguration(recoveredConfig);
      expect(isValid).toBe(true);
    });

    it('应该正确处理会话状态不一致和同步', async () => {
      // 1. 创建会话
      const sessionConfig = {
        name: 'Sync Test Session',
        description: 'Session state sync test'
      };

      const sessionId = await sessionManager.createSession(sessionConfig);
      
      // 2. 模拟状态不一致（外部修改）
      const sessionState = await sessionManager.getSessionState(sessionId);
      
      // 直接修改状态（模拟外部冲突）
      sessionState.lastModified = Date.now() - 60000; // 1分钟前
      sessionState.isModified = true;

      // 3. 触发状态同步
      const syncResult = await sessionManager.synchronizeSession(sessionId);
      
      expect(syncResult.success).toBe(true);
      expect(syncResult.conflictsResolved).toBeGreaterThanOrEqual(0);

      // 4. 验证同步后状态一致
      const syncedState = await sessionManager.getSessionState(sessionId);
      expect(syncedState.isModified).toBe(false);
      expect(syncedState.lastModified).toBeGreaterThan(sessionState.lastModified);
    });
  });

  describe('性能和扩展性集成', () => {
    it('应该支持大规模配置和会话管理', async () => {
      const startTime = Date.now();

      // 1. 创建大量配置项
      const configs: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        configs[`test-config-${i}`] = {
          id: i,
          name: `Test Config ${i}`,
          settings: {
            value1: Math.random(),
            value2: `string-${i}`,
            value3: i % 2 === 0
          }
        };
      }

      // 批量保存配置
      await configManager.saveBatchConfigurations(configs);

      // 2. 创建大量会话
      const sessionIds: string[] = [];
      const sessionPromises = [];

      for (let i = 0; i < 50; i++) {
        const sessionConfig = {
          name: `Bulk Session ${i}`,
          description: `Generated session ${i}`
        };

        sessionPromises.push(sessionManager.createSession(sessionConfig));
      }

      const results = await Promise.all(sessionPromises);
      sessionIds.push(...results);

      // 3. 验证性能
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 5秒内完成

      // 4. 验证数据完整性
      expect(sessionIds).toHaveLength(50);
      
      const allSessions = await sessionManager.getAllSessions();
      expect(allSessions.length).toBeGreaterThanOrEqual(50);

      // 5. 测试批量操作性能
      const bulkStartTime = Date.now();
      
      const loadedConfigs = await configManager.loadBatchConfigurations(
        Object.keys(configs)
      );
      
      const bulkDuration = Date.now() - bulkStartTime;
      expect(bulkDuration).toBeLessThan(1000); // 1秒内完成批量加载
      expect(Object.keys(loadedConfigs)).toHaveLength(100);
    });
  });
});