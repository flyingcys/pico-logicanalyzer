/**
 * WorkspaceManager 100%完美覆盖率测试
 * 专门针对未覆盖的代码路径进行精准测试
 * 未覆盖行号：159-187,201-202,218-354,1003-1006
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: undefined,
        onDidChangeWorkspaceFolders: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        createFileSystemWatcher: jest.fn().mockReturnValue({
            onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            dispose: jest.fn()
        })
    },
    Uri: {
        file: jest.fn().mockReturnValue({ fsPath: '/test/path' })
    },
    commands: {
        executeCommand: jest.fn().mockResolvedValue(undefined)
    },
    window: {
        showInformationMessage: jest.fn().mockResolvedValue(undefined)
    }
}));

jest.mock('fs/promises');
jest.mock('path');

// 在所有mock设置完成后导入WorkspaceManager
import { WorkspaceManager } from '../../../src/services/WorkspaceManager';

describe('WorkspaceManager - 100%完美覆盖率测试', () => {
    let workspaceManager: WorkspaceManager;
    let mockFs: jest.Mocked<typeof fs>;
    let mockPath: jest.Mocked<typeof path>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockFs = fs as jest.Mocked<typeof fs>;
        mockPath = path as jest.Mocked<typeof path>;

        // 基础Mock设置
        mockPath.join.mockImplementation((...args) => args.join('/'));
        mockPath.basename.mockImplementation((filepath) => filepath.split('/').pop() || '');
        mockPath.dirname.mockImplementation((filepath) => filepath.split('/').slice(0, -1).join('/'));
        mockPath.relative.mockImplementation((from, to) => to);
        mockPath.extname.mockImplementation((filepath) => {
            const parts = filepath.split('.');
            return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
        });

        workspaceManager = new WorkspaceManager();
        
        // 确保fileWatchers为空Map，避免dispose错误
        (workspaceManager as any).fileWatchers = new Map();
    });

    afterEach(async () => {
        // 清理fileWatchers避免dispose错误
        (workspaceManager as any).fileWatchers = new Map();
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('服务生命周期方法测试 - 覆盖行159-187', () => {
        it('应该执行onInitialize方法 - 覆盖行159-164', async () => {
            const options = { timeout: 5000 };
            
            // 设置初始状态
            (workspaceManager as any).currentProject = { name: '测试项目' };
            (workspaceManager as any).projectRoot = '/test/project';
            (workspaceManager as any).fileWatchers = new Map([['test', {} as any]]);

            // 执行初始化
            await (workspaceManager as any).onInitialize(options);

            // 验证元数据更新
            const metadata = (workspaceManager as any).getMetadata();
            expect(metadata.hasCurrentProject).toBe(true);
            expect(metadata.projectRoot).toBe('/test/project');
            expect(metadata.fileWatchersCount).toBe(1);
        });

        it('应该执行onDispose方法 - 覆盖行169-187', async () => {
            const options = { force: true };
            
            // 设置需要清理的状态
            const mockWatcher = { dispose: jest.fn() };
            (workspaceManager as any).fileWatchers = new Map([['test-watcher', mockWatcher]]);
            (workspaceManager as any).backupTimer = setTimeout(() => {}, 1000);
            (workspaceManager as any).currentProject = { name: '测试项目' };
            (workspaceManager as any).projectRoot = '/test/project';
            
            // 模拟事件监听器
            const mockListener = jest.fn();
            workspaceManager.on('test-event', mockListener);

            // 执行销毁
            await (workspaceManager as any).onDispose(options);

            // 验证清理结果
            expect(mockWatcher.dispose).toHaveBeenCalled();
            expect((workspaceManager as any).fileWatchers.size).toBe(0);
            expect((workspaceManager as any).backupTimer).toBeUndefined();
            expect((workspaceManager as any).currentProject).toBeUndefined();
            expect((workspaceManager as any).projectRoot).toBeUndefined();
        });
    });

    describe('EventEmitter方法测试 - 覆盖行201-202', () => {
        it('应该执行off方法 - 覆盖行201-202', () => {
            const listener = jest.fn();
            
            // 添加监听器
            workspaceManager.on('test-event', listener);
            
            // 移除监听器
            const result = workspaceManager.off('test-event', listener);
            
            // 验证返回值和链式调用
            expect(result).toBe(workspaceManager);
            
            // 验证监听器被移除
            workspaceManager.emit('test-event', 'test-data');
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('工作区核心方法测试 - 覆盖行218-354', () => {
        beforeEach(() => {
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue('{}');
        });

        it('应该创建新工作区 - 覆盖行218-263', async () => {
            const workspaceDir = '/test/workspace';
            const config = {
                name: '测试工作区',
                description: '测试描述',
                settings: { customSetting: true }
            };

            const workspaceId = await workspaceManager.createWorkspace(workspaceDir, config);

            // 验证目录创建
            expect(mockFs.mkdir).toHaveBeenCalledWith(workspaceDir, { recursive: true });
            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/workspace/sessions', { recursive: true });
            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/workspace/data', { recursive: true });
            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/workspace/exports', { recursive: true });

            // 验证配置保存
            expect(mockFs.writeFile).toHaveBeenCalled();
            
            // 验证返回值
            expect(workspaceId).toMatch(/^workspace-\d+-[a-z0-9]+$/);
            
            // 验证内部状态
            expect((workspaceManager as any).currentProject).toBeDefined();
            expect((workspaceManager as any).projectRoot).toBe(workspaceDir);
        });

        it('应该获取工作区信息 - 覆盖行269-270', async () => {
            const testProject = { name: '测试项目' };
            (workspaceManager as any).currentProject = testProject;

            const result = await workspaceManager.getWorkspaceInfo('test-id');

            expect(result).toBe(testProject);
        });

        it('应该获取工作区会话列表 - 覆盖行276-279', async () => {
            const sessions = await workspaceManager.getSessions('test-workspace-id');

            expect(sessions).toEqual([]);
        });

        it('应该添加会话到工作区 - 覆盖行285-290', async () => {
            const testProject = {
                name: '测试项目',
                metadata: { totalSessions: 5 },
                updatedAt: '2023-01-01T00:00:00.000Z'
            };
            (workspaceManager as any).currentProject = testProject;

            await workspaceManager.addSession('workspace-id', 'session-id');

            expect(testProject.metadata.totalSessions).toBe(6);
            expect(testProject.updatedAt).not.toBe('2023-01-01T00:00:00.000Z');
        });

        it('应该保存工作区 - 覆盖行296-300', async () => {
            const testProject = { name: '测试项目' };
            (workspaceManager as any).currentProject = testProject;
            (workspaceManager as any).projectRoot = '/test/project';

            await workspaceManager.saveWorkspace('workspace-id');

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                '/test/project/logicanalyzer-project.json',
                JSON.stringify(testProject, null, 2)
            );
        });

        it('应该加载工作区 - 覆盖行306-310', async () => {
            const result = await workspaceManager.loadWorkspace('workspace-id');

            expect(result).toEqual({ sessions: [] });
        });

        it('应该迁移工作区 - 覆盖行316-354', async () => {
            const legacyConfig = {
                name: '旧工作区',
                createdAt: '2022-01-01T00:00:00.000Z',
                sessions: [1, 2, 3]
            };
            
            mockFs.readFile.mockResolvedValue(JSON.stringify(legacyConfig));

            const workspaceId = await workspaceManager.migrateWorkspace('/path/to/legacy.json');

            // 验证迁移结果
            expect(workspaceId).toMatch(/^migrated-workspace-\d+$/);
            
            // 验证项目配置
            const migratedProject = (workspaceManager as any).currentProject;
            expect(migratedProject).toBeDefined();
            expect(migratedProject.name).toBe('旧工作区');
            expect(migratedProject.version).toBe('2.0.0');
            expect(migratedProject.description).toBe('Migrated from legacy format');
            expect(migratedProject.metadata.totalSessions).toBe(3);
        });

        it('应该处理没有currentProject时的保存 - 覆盖边界条件', async () => {
            (workspaceManager as any).currentProject = null;
            (workspaceManager as any).projectRoot = null;

            await workspaceManager.saveWorkspace('workspace-id');

            // 不应该抛出错误，也不应该调用writeFile
            expect(mockFs.writeFile).not.toHaveBeenCalled();
        });

        it('应该处理没有sessions时的迁移 - 覆盖边界条件', async () => {
            const legacyConfigWithoutSessions = {
                name: '无会话工作区'
            };
            
            mockFs.readFile.mockResolvedValue(JSON.stringify(legacyConfigWithoutSessions));

            const workspaceId = await workspaceManager.migrateWorkspace('/path/to/legacy.json');

            const migratedProject = (workspaceManager as any).currentProject;
            expect(migratedProject.metadata.totalSessions).toBe(0);
        });
    });

    describe('自动备份错误处理测试 - 覆盖行1003-1006', () => {
        it('应该处理自动备份过程中的错误 - 覆盖行1003-1006', async () => {
            // 设置项目状态
            (workspaceManager as any).currentProject = {
                name: '测试项目',
                settings: { autoBackup: true }
            };
            (workspaceManager as any).projectRoot = '/test/project';

            // Mock console.error来捕获错误日志
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Mock createBackup方法抛出错误
            const originalCreateBackup = workspaceManager.createBackup;
            workspaceManager.createBackup = jest.fn().mockRejectedValue(new Error('备份失败'));

            // 启动自动备份
            (workspaceManager as any).startAutoBackup();

            // 手动触发备份函数来测试错误处理
            const backupFunction = (workspaceManager as any).backupTimer._onTimeout;
            if (backupFunction) {
                await backupFunction();
            }

            // 验证错误被正确处理
            expect(consoleSpy).toHaveBeenCalledWith('自动备份失败:', expect.any(Error));

            // 恢复原始方法
            workspaceManager.createBackup = originalCreateBackup;
            consoleSpy.mockRestore();
        });

        it('应该正确清理自动备份定时器', () => {
            // 启动备份
            (workspaceManager as any).startAutoBackup();
            expect((workspaceManager as any).backupTimer).toBeDefined();

            // 停止备份
            (workspaceManager as any).stopAutoBackup();
            expect((workspaceManager as any).backupTimer).toBeUndefined();

            // 重复停止不应该出错
            (workspaceManager as any).stopAutoBackup();
            expect((workspaceManager as any).backupTimer).toBeUndefined();
        });
    });

    describe('集成测试 - 验证完整覆盖', () => {
        it('应该覆盖所有未覆盖的代码路径', () => {
            // 验证关键方法存在
            expect(typeof workspaceManager.createWorkspace).toBe('function');
            expect(typeof workspaceManager.getWorkspaceInfo).toBe('function');
            expect(typeof workspaceManager.getSessions).toBe('function');
            expect(typeof workspaceManager.addSession).toBe('function');
            expect(typeof workspaceManager.saveWorkspace).toBe('function');
            expect(typeof workspaceManager.loadWorkspace).toBe('function');
            expect(typeof workspaceManager.migrateWorkspace).toBe('function');
            expect(typeof workspaceManager.off).toBe('function');

            // 验证内部方法存在
            expect(typeof (workspaceManager as any).onInitialize).toBe('function');
            expect(typeof (workspaceManager as any).onDispose).toBe('function');
            expect(typeof (workspaceManager as any).startAutoBackup).toBe('function');
            expect(typeof (workspaceManager as any).stopAutoBackup).toBe('function');
        });

        it('应该正确处理事件监听器生命周期', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            // 添加监听器
            workspaceManager.on('test', listener1);
            workspaceManager.on('test', listener2);

            // 触发事件
            workspaceManager.emit('test', 'data');
            expect(listener1).toHaveBeenCalledWith('data');
            expect(listener2).toHaveBeenCalledWith('data');

            // 移除特定监听器
            workspaceManager.off('test', listener1);
            
            // 再次触发
            listener1.mockClear();
            listener2.mockClear();
            workspaceManager.emit('test', 'data2');
            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledWith('data2');

            // 移除所有监听器
            workspaceManager.removeAllListeners('test');
            
            // 最后触发
            listener2.mockClear();
            workspaceManager.emit('test', 'data3');
            expect(listener2).not.toHaveBeenCalled();
        });
    });

    describe('项目创建和管理功能测试 - 覆盖行372-850', () => {
        beforeEach(() => {
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);
            mockFs.access.mockResolvedValue(undefined);
            mockFs.stat.mockResolvedValue({
                size: 1024,
                birthtime: new Date(),
                mtime: new Date()
            } as any);
        });

        it('应该使用选项创建项目 - 覆盖行372-390', async () => {
            const options = {
                name: '测试项目',
                location: '/test/project',
                template: 'basic',
                initializeGit: true,
                createSampleData: true,
                description: '测试描述',
                author: '测试作者'
            };

            await workspaceManager.createProject(options);

            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project', { recursive: true });
            expect(mockFs.writeFile).toHaveBeenCalled();
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openFolder', expect.any(Object));
        });

        it('应该使用参数创建项目 - 覆盖行401-466', async () => {
            const projectPath = '/test/project2';
            const config = {
                name: '参数项目',
                description: '参数描述',
                author: '参数作者'
            };

            await workspaceManager.createProject(projectPath, config, 'protocol-analysis');

            expect(mockFs.mkdir).toHaveBeenCalledWith(projectPath, { recursive: true });
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('项目 "参数项目" 创建成功');
        });

        it('应该处理项目创建失败 - 覆盖错误处理', async () => {
            mockFs.mkdir.mockRejectedValue(new Error('权限不足'));

            await expect(workspaceManager.createProject('/test/failed', {}))
                .rejects.toThrow('创建项目失败: Error: 权限不足');
        });

        it('应该打开现有项目 - 覆盖行471-502', async () => {
            // Mock文件存在和项目配置
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);
            (workspaceManager as any).loadProjectConfiguration = jest.fn().mockResolvedValue({
                name: '现有项目',
                structure: {
                    sessionsDir: 'sessions',
                    dataDir: 'data',
                    analysisDir: 'analysis',
                    reportsDir: 'reports',
                    configDir: 'config',
                    tempDir: 'temp'
                },
                settings: { autoBackup: true }
            });
            (workspaceManager as any).validateProjectStructure = jest.fn().mockResolvedValue(undefined);
            (workspaceManager as any).setupFileWatchers = jest.fn();
            (workspaceManager as any).startAutoBackup = jest.fn();

            const projectEventSpy = jest.fn();
            workspaceManager.on('projectOpened', projectEventSpy);

            await workspaceManager.openProject('/test/existing');

            expect(projectEventSpy).toHaveBeenCalled();
            expect((workspaceManager as any).currentProject).toBeDefined();
        });

        it('应该处理打开不存在的项目 - 覆盖错误处理', async () => {
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(false);

            await expect(workspaceManager.openProject('/test/nonexistent'))
                .rejects.toThrow('打开项目失败: Error: 不是有效的Logic Analyzer项目目录');
        });

        it('应该关闭当前项目 - 覆盖行507-535', async () => {
            // 设置当前项目状态
            (workspaceManager as any).currentProject = { name: '测试项目' };
            (workspaceManager as any).projectRoot = '/test/project';
            (workspaceManager as any).stopFileWatchers = jest.fn();
            (workspaceManager as any).stopAutoBackup = jest.fn();
            (workspaceManager as any).cleanupTempFiles = jest.fn().mockResolvedValue(undefined);
            (workspaceManager as any).removeProjectLock = jest.fn().mockResolvedValue(undefined);

            const closeEventSpy = jest.fn();
            workspaceManager.on('projectClosed', closeEventSpy);

            await workspaceManager.closeProject();

            expect(closeEventSpy).toHaveBeenCalled();
            expect((workspaceManager as any).currentProject).toBeUndefined();
        });

        it('应该获取当前项目状态 - 覆盖行540-556', () => {
            // 测试没有项目时
            expect(workspaceManager.getCurrentProject()).toBeNull();
            expect(workspaceManager.hasActiveProject()).toBe(false);
            expect(workspaceManager.getProjectInfo()).toBeNull();

            // 设置项目后
            const testProject = { name: '测试项目' };
            (workspaceManager as any).currentProject = testProject;

            expect(workspaceManager.getCurrentProject()).toBe(testProject);
            expect(workspaceManager.hasActiveProject()).toBe(true);
            expect(workspaceManager.getProjectInfo()).toBe(testProject);
        });

        it('应该更新项目配置 - 覆盖行561-575', async () => {
            const testProject = { name: '原项目', metadata: { tags: [] } };
            (workspaceManager as any).currentProject = testProject;
            (workspaceManager as any).projectRoot = '/test/project';
            (workspaceManager as any).saveProjectConfiguration = jest.fn().mockResolvedValue(undefined);

            const updateEventSpy = jest.fn();
            workspaceManager.on('projectUpdated', updateEventSpy);

            const updates = { name: '更新项目', description: '新描述' };
            await workspaceManager.updateProject(updates);

            // updateProject创建新对象，所以检查currentProject
            expect((workspaceManager as any).currentProject.name).toBe('更新项目');
            expect((workspaceManager as any).currentProject.description).toBe('新描述');
            expect(updateEventSpy).toHaveBeenCalled();
        });

        it('应该在没有项目时抛出错误 - updateProject', async () => {
            (workspaceManager as any).currentProject = null;

            await expect(workspaceManager.updateProject({ name: '测试' }))
                .rejects.toThrow('没有打开的项目');
        });
    });

    describe('文件管理功能测试 - 覆盖行580-670', () => {
        beforeEach(() => {
            (workspaceManager as any).currentProject = {
                structure: {
                    sessionsDir: 'sessions',
                    dataDir: 'data',
                    analysisDir: 'analysis',
                    reportsDir: 'reports',
                    configDir: 'config',
                    tempDir: 'temp'
                }
            };
            (workspaceManager as any).projectRoot = '/test/project';
        });

        it('应该获取项目文件列表 - 覆盖行580-598', async () => {
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);
            
            // Mock scanDirectory 每次只返回一个文件，避免重复
            let callCount = 0;
            (workspaceManager as any).scanDirectory = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return [{ id: '1', name: 'test.lac', updatedAt: '2023-01-01T00:00:00.000Z' }];
                } else if (callCount === 2) {
                    return [{ id: '2', name: 'test2.lac', updatedAt: '2023-01-02T00:00:00.000Z' }];
                }
                return [];
            });

            const files = await workspaceManager.getProjectFiles();

            expect(files).toHaveLength(2);
            expect(files[0].name).toBe('test2.lac'); // 应该按时间倒序排列
        });

        it('应该添加文件到项目 - 覆盖行603-649', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.copyFile.mockResolvedValue(undefined);
            mockFs.stat.mockResolvedValue({
                size: 2048,
                birthtime: new Date('2023-01-01'),
                mtime: new Date('2023-01-02')
            } as any);

            const addEventSpy = jest.fn();
            workspaceManager.on('fileAdded', addEventSpy);

            const fileId = await workspaceManager.addFileToProject('/source/file.lac', 'data', 'custom/path.lac', { test: true });

            expect(mockFs.copyFile).toHaveBeenCalled();
            expect(addEventSpy).toHaveBeenCalled();
            expect(fileId).toMatch(/^file_\d+_[a-z0-9]+$/);
        });

        it('应该删除项目文件 - 覆盖行654-670', async () => {
            const mockFiles = [
                { id: 'file1', name: 'test.lac', path: 'data/test.lac' },
                { id: 'file2', name: 'test2.lac', path: 'data/test2.lac' }
            ];
            
            (workspaceManager as any).getProjectFiles = jest.fn().mockResolvedValue(mockFiles);
            mockFs.rm.mockResolvedValue(undefined);

            const removeEventSpy = jest.fn();
            workspaceManager.on('fileRemoved', removeEventSpy);

            await workspaceManager.removeFileFromProject('file1');

            expect(mockFs.rm).toHaveBeenCalledWith('/test/project/data/test.lac', { force: true });
            expect(removeEventSpy).toHaveBeenCalledWith(mockFiles[0]);
        });

        it('应该处理删除不存在的文件', async () => {
            (workspaceManager as any).getProjectFiles = jest.fn().mockResolvedValue([]);

            await expect(workspaceManager.removeFileFromProject('nonexistent'))
                .rejects.toThrow('文件不存在');
        });
    });

    describe('备份和统计功能测试 - 覆盖行675-857', () => {
        beforeEach(() => {
            (workspaceManager as any).currentProject = {
                name: '测试项目',
                metadata: { tags: [] }
            };
            (workspaceManager as any).projectRoot = '/test/project';
        });

        it('应该创建项目备份 - 覆盖行675-710', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);
            (workspaceManager as any).getProjectFiles = jest.fn().mockResolvedValue([
                { id: '1', name: 'test.lac', type: 'data', size: 1024 }
            ]);
            (workspaceManager as any).updateProject = jest.fn().mockResolvedValue(undefined);

            const backupEventSpy = jest.fn();
            workspaceManager.on('backupCreated', backupEventSpy);

            const backupPath = await workspaceManager.createBackup(true);

            expect(backupPath).toContain('backup_测试项目_');
            expect(backupEventSpy).toHaveBeenCalled();
        });

        it('应该恢复项目备份 - 覆盖行715-741', async () => {
            const backupData = {
                project: { name: '恢复项目', description: '恢复描述' },
                timestamp: '2023-01-01T00:00:00.000Z'
            };
            
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(backupData));
            (workspaceManager as any).updateProject = jest.fn().mockResolvedValue(undefined);

            const restoreEventSpy = jest.fn();
            workspaceManager.on('backupRestored', restoreEventSpy);

            await workspaceManager.restoreBackup('/test/backup.json');

            expect(restoreEventSpy).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('项目备份恢复成功');
        });

        it('应该处理备份文件不存在 - 覆盖行736-740', async () => {
            const error = new Error('文件不存在');
            (error as any).code = 'ENOENT';
            mockFs.access.mockRejectedValue(error);

            await expect(workspaceManager.restoreBackup('/nonexistent/backup.json'))
                .rejects.toThrow('备份文件不存在');
        });

        it('应该获取项目统计信息 - 覆盖行824-857', async () => {
            const mockFiles = [
                { type: 'session', size: 1024, updatedAt: '2023-01-01T00:00:00.000Z' },
                { type: 'data', size: 2048, updatedAt: '2023-01-02T00:00:00.000Z' },
                { type: 'session', size: 512, updatedAt: '2023-01-03T00:00:00.000Z' }
            ] as any[];
            
            (workspaceManager as any).getProjectFiles = jest.fn().mockResolvedValue(mockFiles);

            const stats = await workspaceManager.getProjectStatistics();

            expect(stats.fileCount).toBe(3);
            expect(stats.totalSize).toBe(3584);
            expect(stats.sessionCount).toBe(2);
            expect(stats.storageUsage.session).toBe(1536);
            expect(stats.storageUsage.data).toBe(2048);
        });

        describe('剩余未覆盖行的精准测试', () => {
            it('应该覆盖closeProject中的错误处理 - 行533', async () => {
                // 设置会触发错误的状态
                (workspaceManager as any).fileWatchers = new Map();
                (workspaceManager as any).fileWatchers.set('test', {
                    dispose: jest.fn().mockImplementation(() => {
                        throw new Error('Dispose error');
                    })
                });
                
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
                
                // 调用closeProject应该触发错误处理
                await workspaceManager.closeProject();
                
                expect(consoleSpy).toHaveBeenCalledWith('关闭项目时出错:', expect.any(Error));
                consoleSpy.mockRestore();
            });

            it('应该覆盖没有项目根目录的各种错误 - 行582,610,656,677,717,832', async () => {
                // 确保没有项目根目录
                (workspaceManager as any).projectRoot = null;
                (workspaceManager as any).currentProject = null;

                // 测试getProjectFiles - 行582
                await expect(workspaceManager.getProjectFiles()).rejects.toThrow('没有打开的项目');

                // 测试addFileToProject - 行610  
                await expect(workspaceManager.addFileToProject('/test/file', 'Data' as any)).rejects.toThrow('没有打开的项目');

                // 测试removeFileFromProject - 行656
                await expect(workspaceManager.removeFileFromProject('test-id')).rejects.toThrow('没有打开的项目');

                // 测试createBackup - 行677
                await expect(workspaceManager.createBackup()).rejects.toThrow('没有打开的项目');

                // 测试restoreBackup - 行717
                await expect(workspaceManager.restoreBackup('/test/backup')).rejects.toThrow('没有打开的项目');

                // 测试getProjectStatistics - 行832
                await expect(workspaceManager.getProjectStatistics()).rejects.toThrow('没有打开的项目');
            });

            it('应该覆盖addFileToProject的默认目录逻辑 - 行619-622', async () => {
                // 设置项目状态
                (workspaceManager as any).projectRoot = '/test/project';
                (workspaceManager as any).currentProject = {
                    structure: { dataDir: 'data' }
                };
                (workspaceManager as any).getDirectoryForFileType = jest.fn().mockReturnValue('data');

                // Mock fs operations
                jest.spyOn(mockFs, 'mkdir').mockResolvedValue(undefined);
                jest.spyOn(mockFs, 'copyFile').mockResolvedValue(undefined);

                // 不指定targetPath，应该使用默认目录
                await workspaceManager.addFileToProject('/source/test.lac', 'Data' as any);
                
                expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/data', { recursive: true });
                expect(mockFs.copyFile).toHaveBeenCalledWith('/source/test.lac', '/test/project/data/test.lac');
            });

            it('应该覆盖restoreBackup的错误处理 - 行739', async () => {
                (workspaceManager as any).projectRoot = '/test/project';
                
                // Mock fs.access to throw non-ENOENT error
                jest.spyOn(mockFs, 'access').mockRejectedValue(new Error('Permission denied'));
                
                await expect(workspaceManager.restoreBackup('/test/backup')).rejects.toThrow('恢复备份失败: Error: Permission denied');
            });

            it('应该覆盖loadProjectConfiguration方法 - 行941-943', async () => {
                const mockConfig = {
                    name: 'Test Project',
                    structure: { dataDir: 'data' }
                };
                
                jest.spyOn(mockFs, 'readFile').mockResolvedValue(JSON.stringify(mockConfig));
                
                const result = await (workspaceManager as any).loadProjectConfiguration('/test/project');
                expect(result).toEqual(mockConfig);
            });

            it('应该覆盖validateProjectStructure方法 - 行949-960', async () => {
                const config = {
                    structure: {
                        dataDir: 'data',
                        sessionsDir: 'sessions'
                    }
                };
                
                (workspaceManager as any).fileExists = jest.fn()
                    .mockResolvedValueOnce(false) // data目录不存在
                    .mockResolvedValueOnce(true);  // sessions目录存在
                
                jest.spyOn(mockFs, 'mkdir').mockResolvedValue(undefined);
                const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
                
                await (workspaceManager as any).validateProjectStructure('/test/project', config);
                
                expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/data', { recursive: true });
                expect(consoleSpy).toHaveBeenCalledWith('重新创建缺失的目录: data');
                
                consoleSpy.mockRestore();
            });

            it('应该覆盖setupFileWatchers方法 - 行965-982', () => {
                const mockWatcher = {
                    onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    dispose: jest.fn()
                };
                
                vscode.workspace.createFileSystemWatcher = jest.fn().mockReturnValue(mockWatcher);
                (workspaceManager as any).stopFileWatchers = jest.fn();
                
                (workspaceManager as any).setupFileWatchers('/test/project');
                
                expect((workspaceManager as any).stopFileWatchers).toHaveBeenCalled();
                expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(3);
            });

            it('应该覆盖cleanupTempFiles方法 - 行1025-1038', async () => {
                (workspaceManager as any).projectRoot = '/test/project';
                (workspaceManager as any).currentProject = {
                    structure: { tempDir: 'temp' }
                };
                
                (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);
                jest.spyOn(mockFs, 'readdir').mockResolvedValue(['temp1.txt', 'temp2.txt']);
                jest.spyOn(mockFs, 'unlink')
                    .mockResolvedValueOnce(undefined)
                    .mockRejectedValueOnce(new Error('Delete failed'));
                
                const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
                
                await (workspaceManager as any).cleanupTempFiles();
                
                expect(mockFs.unlink).toHaveBeenCalledTimes(2);
                expect(consoleSpy).toHaveBeenCalledWith('删除临时文件失败: temp2.txt', expect.any(Error));
                
                consoleSpy.mockRestore();
            });

            it('应该覆盖scanDirectory方法错误处理 - 行1070-1072', async () => {
                (workspaceManager as any).projectRoot = '/test/project';
                
                jest.spyOn(mockFs, 'readdir').mockRejectedValue(new Error('Access denied'));
                const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
                
                const result = await (workspaceManager as any).scanDirectory('/test/project/data');
                
                expect(result).toEqual([]);
                expect(consoleSpy).toHaveBeenCalledWith('扫描目录失败: /test/project/data', expect.any(Error));
                
                consoleSpy.mockRestore();
            });

            it('应该覆盖scanDirectory方法正常流程 - 行1044-1074', async () => {
                (workspaceManager as any).projectRoot = '/test/project';
                
                const mockEntries = [
                    { name: 'file1.lac', isFile: () => true },
                    { name: 'subdir', isFile: () => false }
                ];
                
                jest.spyOn(mockFs, 'readdir').mockResolvedValue(mockEntries);
                jest.spyOn(mockFs, 'stat').mockResolvedValue({
                    size: 1024,
                    birthtime: new Date('2023-01-01'),
                    mtime: new Date('2023-01-02')
                });
                
                (workspaceManager as any).detectFileType = jest.fn().mockReturnValue('Data');
                (workspaceManager as any).generateFileId = jest.fn().mockReturnValue('test-id');
                
                const result = await (workspaceManager as any).scanDirectory('/test/project/data', 'Data');
                
                expect(result).toHaveLength(1);
                expect(result[0].name).toBe('file1.lac');
            });

            it('应该覆盖detectFileType方法所有分支 - 行1080-1101', () => {
                // 测试所有文件类型分支 - 使用小写字符串，因为FileType是字符串枚举
                expect((workspaceManager as any).detectFileType('test.lacsession')).toBe('session');
                expect((workspaceManager as any).detectFileType('test.lac')).toBe('data');
                expect((workspaceManager as any).detectFileType('test.csv')).toBe('data');
                expect((workspaceManager as any).detectFileType('config.json')).toBe('config');
                expect((workspaceManager as any).detectFileType('data.json')).toBe('data');
                expect((workspaceManager as any).detectFileType('test.html')).toBe('report');
                expect((workspaceManager as any).detectFileType('test.pdf')).toBe('report');
                expect((workspaceManager as any).detectFileType('test.js')).toBe('script');
                expect((workspaceManager as any).detectFileType('test.ts')).toBe('script');
                expect((workspaceManager as any).detectFileType('test.py')).toBe('script');
                expect((workspaceManager as any).detectFileType('test.unknown')).toBe('data');
            });

            it('应该覆盖getDirectoryForFileType方法所有分支 - 行1107-1123', () => {
                // 重置currentProject以确保干净状态
                (workspaceManager as any).currentProject = null;
                
                // 没有当前项目时
                expect((workspaceManager as any).getDirectoryForFileType('data')).toBe('');
                
                // 有当前项目时
                (workspaceManager as any).currentProject = {
                    structure: {
                        sessionsDir: 'sessions',
                        dataDir: 'data',
                        analysisDir: 'analysis',
                        reportsDir: 'reports',
                        configDir: 'config'
                    }
                };
                
                expect((workspaceManager as any).getDirectoryForFileType('session')).toBe('sessions');
                expect((workspaceManager as any).getDirectoryForFileType('data')).toBe('data');
                expect((workspaceManager as any).getDirectoryForFileType('analysis')).toBe('analysis');
                expect((workspaceManager as any).getDirectoryForFileType('report')).toBe('reports');
                expect((workspaceManager as any).getDirectoryForFileType('config')).toBe('config');
                expect((workspaceManager as any).getDirectoryForFileType('unknown')).toBe('data');
            });

            it('应该覆盖removeProjectLock方法 - 行1151-1153', async () => {
                jest.spyOn(mockFs, 'unlink').mockResolvedValue(undefined);
                
                await (workspaceManager as any).removeProjectLock('/test/project');
                
                expect(mockFs.unlink).toHaveBeenCalledWith('/test/project/.logicanalyzer.lock');
            });

            it('应该覆盖fileExists方法返回true - 行1165', async () => {
                jest.spyOn(mockFs, 'access').mockResolvedValue(undefined);
                
                const result = await (workspaceManager as any).fileExists('/test/file');
                
                expect(result).toBe(true);
            });

            it('应该覆盖fileExists方法返回false - 行1167', async () => {
                jest.spyOn(mockFs, 'access').mockRejectedValue(new Error('File not found'));
                
                const result = await (workspaceManager as any).fileExists('/test/nonexistent');
                
                expect(result).toBe(false);
            });
        });
    });

    describe('工作区事件监听测试 - 覆盖行867-871', () => {
        it('应该处理工作区文件夹变化事件', () => {
            // 获取原始的onDidChangeWorkspaceFolders mock
            const mockCallback = (vscode.workspace.onDidChangeWorkspaceFolders as jest.Mock).mock.calls[0][0];
            
            // 模拟添加文件夹事件
            const addEvent = { added: [{ uri: { fsPath: '/new/workspace' } }], removed: [] };
            const spyInitialize = jest.spyOn(workspaceManager as any, 'initializeCurrentProject');
            
            mockCallback(addEvent);
            expect(spyInitialize).toHaveBeenCalled();

            // 模拟移除文件夹事件
            const removeEvent = { added: [], removed: [{ uri: { fsPath: '/removed/workspace' } }] };
            const spyClose = jest.spyOn(workspaceManager, 'closeProject');
            
            mockCallback(removeEvent);
            expect(spyClose).toHaveBeenCalled();
        });
    });

    describe('私有辅助方法测试 - 覆盖行883-1287', () => {
        it('应该初始化当前项目 - 覆盖行883-890', async () => {
            // Mock工作区文件夹
            (vscode.workspace as any).workspaceFolders = [
                { uri: { fsPath: '/test/workspace' } }
            ];
            
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);
            const spyOpenProject = jest.spyOn(workspaceManager, 'openProject').mockResolvedValue(undefined);

            await (workspaceManager as any).initializeCurrentProject();

            expect(spyOpenProject).toHaveBeenCalledWith('/test/workspace');
        });

        it('应该处理初始化项目失败', async () => {
            (vscode.workspace as any).workspaceFolders = [
                { uri: { fsPath: '/test/workspace' } }
            ];
            
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);
            jest.spyOn(workspaceManager, 'openProject').mockRejectedValue(new Error('初始化失败'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await (workspaceManager as any).initializeCurrentProject();

            expect(consoleSpy).toHaveBeenCalledWith('初始化项目失败:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('应该处理没有工作区文件夹的情况', async () => {
            (vscode.workspace as any).workspaceFolders = undefined;

            await (workspaceManager as any).initializeCurrentProject();

            // 不应该抛出错误，静默返回
        });
    });

    describe('私有辅助方法深度测试 - 覆盖剩余行', () => {
        beforeEach(() => {
            (workspaceManager as any).currentProject = {
                name: '测试项目',
                structure: {
                    sessionsDir: 'sessions',
                    dataDir: 'data',
                    analysisDir: 'analysis',
                    reportsDir: 'reports',
                    configDir: 'config',
                    tempDir: 'temp'
                }
            };
            (workspaceManager as any).projectRoot = '/test/project';
        });

        it('应该处理关闭项目时出错 - 覆盖行533', async () => {
            // 设置当前项目但没有项目根目录来触发错误处理
            (workspaceManager as any).currentProject = { name: '测试项目' };
            (workspaceManager as any).projectRoot = null;

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await workspaceManager.closeProject();

            // 即使出错也应该清理状态
            expect((workspaceManager as any).currentProject).toBeUndefined();
            consoleSpy.mockRestore();
        });

        it('应该处理getProjectFiles在没有项目时的错误 - 覆盖行582', async () => {
            (workspaceManager as any).projectRoot = null;

            await expect(workspaceManager.getProjectFiles())
                .rejects.toThrow('没有打开的项目');
        });

        it('应该处理addFileToProject在没有项目时的错误 - 覆盖行610', async () => {
            (workspaceManager as any).projectRoot = null;

            await expect(workspaceManager.addFileToProject('/test/file.lac', 'data'))
                .rejects.toThrow('没有打开的项目');
        });

        it('应该处理添加文件时使用默认目录 - 覆盖行619-622', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.copyFile.mockResolvedValue(undefined);
            mockFs.stat.mockResolvedValue({
                size: 1024,
                birthtime: new Date(),
                mtime: new Date()
            } as any);

            // 不指定targetPath，使用默认目录
            const fileId = await workspaceManager.addFileToProject('/source/test.lac', 'data');

            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/data', { recursive: true });
            expect(fileId).toMatch(/^file_\d+_[a-z0-9]+$/);
        });

        it('应该处理removeFileFromProject在没有项目时的错误 - 覆盖行656', async () => {
            (workspaceManager as any).projectRoot = null;

            await expect(workspaceManager.removeFileFromProject('file1'))
                .rejects.toThrow('没有打开的项目');
        });

        it('应该处理createBackup在没有项目时的错误 - 覆盖行677', async () => {
            (workspaceManager as any).projectRoot = null;
            (workspaceManager as any).currentProject = null;

            await expect(workspaceManager.createBackup())
                .rejects.toThrow('没有打开的项目');
        });

        it('应该处理restoreBackup在没有项目时的错误 - 覆盖行717', async () => {
            (workspaceManager as any).projectRoot = null;

            await expect(workspaceManager.restoreBackup('/test/backup.json'))
                .rejects.toThrow('没有打开的项目');
        });

        it('应该处理恢复备份时的其他错误 - 覆盖行739', async () => {
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockRejectedValue(new Error('读取失败'));

            await expect(workspaceManager.restoreBackup('/test/backup.json'))
                .rejects.toThrow('恢复备份失败: Error: 读取失败');
        });

        it('应该处理getProjectStatistics在没有项目时的错误 - 覆盖行832', async () => {
            (workspaceManager as any).projectRoot = null;

            await expect(workspaceManager.getProjectStatistics())
                .rejects.toThrow('没有打开的项目');
        });

        it('应该应用项目模板 - 覆盖行941-981', async () => {
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.writeFile.mockResolvedValue(undefined);

            const templates = workspaceManager.getProjectTemplates();
            const basicTemplate = templates.find(t => t.name === 'basic');

            await (workspaceManager as any).applyProjectTemplate('/test/project', 'basic');

            // 验证目录创建
            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/sessions', { recursive: true });
            expect(mockFs.mkdir).toHaveBeenCalledWith('/test/project/data', { recursive: true });

            // 验证文件创建
            expect(mockFs.writeFile).toHaveBeenCalledWith(
                '/test/project/README.md',
                expect.stringContaining('Logic Analyzer Project'),
                'utf8'
            );
        });

        it('应该处理不存在的模板 - 覆盖边界条件', async () => {
            await (workspaceManager as any).applyProjectTemplate('/test/project', 'nonexistent');

            // 不应该调用mkdir或writeFile
            expect(mockFs.mkdir).not.toHaveBeenCalled();
            expect(mockFs.writeFile).not.toHaveBeenCalled();
        });

        it('应该测试各种私有辅助方法 - 覆盖行1025-1122', async () => {
            // 测试cleanupTempFiles
            mockFs.readdir.mockResolvedValue(['temp1.tmp', 'temp2.tmp'] as any);
            mockFs.unlink.mockResolvedValue(undefined);
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);

            await (workspaceManager as any).cleanupTempFiles();

            expect(mockFs.unlink).toHaveBeenCalledTimes(2);

            // 测试fileExists - 先清理所有现有的spy
            jest.restoreAllMocks();
            
            // 测试文件存在的情况
            jest.spyOn(mockFs, 'access').mockResolvedValueOnce(undefined);
            const exists = await (workspaceManager as any).fileExists('/test/file');
            expect(exists).toBe(true);
            
            // 测试文件不存在的情况
            jest.spyOn(mockFs, 'access').mockRejectedValueOnce(new Error('not found'));
            const notExists = await (workspaceManager as any).fileExists('/test/nonexistent');
            expect(notExists).toBe(false);

            // 测试generateFileId
            const fileId = (workspaceManager as any).generateFileId();
            expect(fileId).toMatch(/^file_\d+_[a-z0-9]+$/);

            // 测试createProjectLock
            await (workspaceManager as any).createProjectLock('/test/project');
            expect(mockFs.writeFile).toHaveBeenCalledWith(
                '/test/project/.logicanalyzer.lock',
                expect.stringContaining('"pid"'),
                'utf8'
            );

            // 测试removeProjectLock
            await (workspaceManager as any).removeProjectLock('/test/project');
            expect(mockFs.unlink).toHaveBeenCalledWith('/test/project/.logicanalyzer.lock');

            // 测试removeProjectLock失败
            mockFs.unlink.mockRejectedValue(new Error('删除失败'));
            await (workspaceManager as any).removeProjectLock('/test/project'); // 不应该抛出错误
        });

        it('应该测试文件扫描和类型检测 - 覆盖行1044-1122', async () => {
            // 测试scanDirectory
            mockFs.readdir.mockResolvedValue([
                { name: 'test.lacsession', isFile: () => true },
                { name: 'data.lac', isFile: () => true },
                { name: 'config.json', isFile: () => true },
                { name: 'report.html', isFile: () => true },
                { name: 'script.js', isFile: () => true },
                { name: 'unknown.txt', isFile: () => true },
                { name: 'directory', isFile: () => false }
            ] as any);
            
            mockFs.stat.mockResolvedValue({
                size: 1024,
                birthtime: new Date('2023-01-01'),
                mtime: new Date('2023-01-02')
            } as any);

            const files = await (workspaceManager as any).scanDirectory('/test/dir');

            expect(files).toHaveLength(6); // 排除目录
            expect(files.some((f: any) => f.type === 'session')).toBe(true);
            expect(files.some((f: any) => f.type === 'data')).toBe(true);
            expect(files.some((f: any) => f.type === 'config')).toBe(true);
            expect(files.some((f: any) => f.type === 'report')).toBe(true);
            expect(files.some((f: any) => f.type === 'script')).toBe(true);

            // 测试detectFileType的各种情况
            expect((workspaceManager as any).detectFileType('test.lacsession')).toBe('session');
            expect((workspaceManager as any).detectFileType('data.lac')).toBe('data');
            expect((workspaceManager as any).detectFileType('data.csv')).toBe('data');
            expect((workspaceManager as any).detectFileType('config.json')).toBe('config');
            expect((workspaceManager as any).detectFileType('analysis.json')).toBe('data');
            expect((workspaceManager as any).detectFileType('report.html')).toBe('report');
            expect((workspaceManager as any).detectFileType('report.pdf')).toBe('report');
            expect((workspaceManager as any).detectFileType('script.js')).toBe('script');
            expect((workspaceManager as any).detectFileType('script.ts')).toBe('script');
            expect((workspaceManager as any).detectFileType('script.py')).toBe('script');
            expect((workspaceManager as any).detectFileType('unknown.txt')).toBe('data');
        });

        it('应该测试文件扫描错误处理', async () => {
            mockFs.readdir.mockRejectedValue(new Error('目录不存在'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const files = await (workspaceManager as any).scanDirectory('/nonexistent');

            expect(files).toHaveLength(0);
            expect(consoleSpy).toHaveBeenCalledWith('扫描目录失败: /nonexistent', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('应该测试临时文件清理错误处理', async () => {
            mockFs.readdir.mockResolvedValue(['temp1.tmp'] as any);
            mockFs.unlink.mockRejectedValue(new Error('删除失败'));
            (workspaceManager as any).fileExists = jest.fn().mockResolvedValue(true);

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            await (workspaceManager as any).cleanupTempFiles();

            expect(consoleSpy).toHaveBeenCalledWith('删除临时文件失败: temp1.tmp', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('应该测试getDirectoryForFileType的各种类型 - 覆盖行1107-1124', () => {
            expect((workspaceManager as any).getDirectoryForFileType('session')).toBe('sessions');
            expect((workspaceManager as any).getDirectoryForFileType('data')).toBe('data');
            expect((workspaceManager as any).getDirectoryForFileType('analysis')).toBe('analysis');
            expect((workspaceManager as any).getDirectoryForFileType('report')).toBe('reports');
            expect((workspaceManager as any).getDirectoryForFileType('config')).toBe('config');
            expect((workspaceManager as any).getDirectoryForFileType('template')).toBe('data'); // default
            expect((workspaceManager as any).getDirectoryForFileType('script')).toBe('data'); // default

            // 测试没有项目时
            (workspaceManager as any).currentProject = null;
            expect((workspaceManager as any).getDirectoryForFileType('session')).toBe('');
        });

        it('应该测试README模板内容', () => {
            const readme = (workspaceManager as any).getReadmeTemplate();
            expect(readme).toContain('Logic Analyzer Project');
            expect(readme).toContain('sessions/');

            const protocolReadme = (workspaceManager as any).getProtocolAnalysisReadmeTemplate();
            expect(protocolReadme).toContain('协议分析项目');

            const collabReadme = (workspaceManager as any).getCollaborationReadmeTemplate();
            expect(collabReadme).toContain('团队协作项目');

            const gitignore = (workspaceManager as any).getGitignoreTemplate();
            expect(gitignore).toContain('temp/');
        });
    });
});