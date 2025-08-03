/**
 * UIOptimizationTester 单元测试
 * 测试 UI 优化功能测试器的各种功能
 */

import { UIOptimizationTester } from '../../../../src/webview/utils/UIOptimizationTester';
import { keyboardShortcutManager } from '../../../../src/webview/utils/KeyboardShortcutManager';
import { layoutManager } from '../../../../src/webview/utils/LayoutManager';

// Mock 依赖模块
jest.mock('../../../../src/webview/utils/KeyboardShortcutManager', () => ({
  keyboardShortcutManager: {
    formatShortcut: jest.fn(),
    getShortcutsByCategory: jest.fn(),
    addShortcut: jest.fn(),
    setShortcutEnabled: jest.fn(),
    removeShortcut: jest.fn()
  }
}));

jest.mock('../../../../src/webview/utils/LayoutManager', () => ({
  layoutManager: {
    getCurrentLayout: jest.fn(),
    updateLayout: jest.fn(),
    updatePanelLayout: jest.fn(),
    updateWaveformState: jest.fn(),
    updateChannelVisibility: jest.fn(),
    saveCurrentLayout: jest.fn(),
    getPresets: jest.fn(),
    applyPreset: jest.fn(),
    saveAsPreset: jest.fn(),
    deletePreset: jest.fn(),
    exportLayout: jest.fn(),
    importLayout: jest.fn()
  }
}));

describe('UIOptimizationTester', () => {
  let tester: UIOptimizationTester;
  
  // Mock console methods
  const consoleSpy = {
    log: jest.spyOn(console, 'log').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation()
  };

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    tester = new UIOptimizationTester();
    
    // 重置 console mock
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    // 清理
    jest.clearAllMocks();
  });

  afterAll(() => {
    // 恢复 console
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('构造函数', () => {
    it('应该正确创建 UIOptimizationTester 实例', () => {
      expect(tester).toBeDefined();
      expect(tester).toBeInstanceOf(UIOptimizationTester);
    });

    it('应该初始化空的测试结果对象', () => {
      const results = tester.getTestResults();
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(Object.keys(results)).toHaveLength(0);
    });
  });

  describe('runAllTests', () => {
    it('应该运行所有测试并返回结果', async () => {
      // 设置所有 mock 返回成功
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      const results = await tester.runAllTests();

      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(Object.keys(results)).toContain('keyboardShortcuts');
      expect(Object.keys(results)).toContain('layoutManager');
      expect(Object.keys(results)).toContain('contextMenu');
      expect(Object.keys(results)).toContain('notificationCenter');
      expect(Object.keys(results)).toContain('shortcutHelp');
    });

    it('应该在出现异常时正确处理错误', async () => {
      // 模拟异常 - 让 runAllTests 中的 try-catch 捕获到异常
      const mockTester = new UIOptimizationTester();
      // 重写 testKeyboardShortcuts 方法来抛出异常
      (mockTester as any).testKeyboardShortcuts = jest.fn().mockImplementation(() => {
        throw new Error('测试异常');
      });

      const results = await mockTester.runAllTests();

      expect(results).toBeDefined();
      expect(consoleSpy.error).toHaveBeenCalledWith('UI优化功能测试失败:', expect.any(Error));
    });

    it('应该输出开始测试的日志', async () => {
      await tester.runAllTests();
      expect(consoleSpy.log).toHaveBeenCalledWith('开始UI优化功能测试...');
    });
  });

  describe('testKeyboardShortcuts', () => {
    it('应该成功测试键盘快捷键功能', async () => {
      // 设置 mock 返回值
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      (keyboardShortcutManager.addShortcut as jest.Mock).mockImplementation();
      (keyboardShortcutManager.setShortcutEnabled as jest.Mock).mockImplementation();
      (keyboardShortcutManager.removeShortcut as jest.Mock).mockImplementation();

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.keyboardShortcuts).toBe(true);
      expect(keyboardShortcutManager.formatShortcut).toHaveBeenCalledWith(['Ctrl', 'S']);
      expect(keyboardShortcutManager.getShortcutsByCategory).toHaveBeenCalled();
      expect(keyboardShortcutManager.addShortcut).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-shortcut',
          keys: ['Ctrl', 'T'],
          description: '测试快捷键'
        })
      );
    });

    it('应该在快捷键格式化失败时返回 false', async () => {
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue(''); // 空字符串是 falsy
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      // 设置其他必要的 mock 以避免后续测试干扰
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.keyboardShortcuts).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('快捷键格式化失败');
    });

    it('应该在获取快捷键分类失败时返回 false', async () => {
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([]);
      // 设置其他必要的 mock 以避免后续测试干扰
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.keyboardShortcuts).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('获取快捷键分类失败');
    });

    it('应该在出现异常时返回 false', async () => {
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockImplementation(() => {
        throw new Error('测试异常');
      });
      // 设置其他必要的 mock 以避免后续测试干扰
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.keyboardShortcuts).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('键盘快捷键管理器测试失败:', expect.any(Error));
    });
  });

  describe('testLayoutManager', () => {
    it('应该成功测试布局管理器功能', async () => {
      // 设置所有必要的 mock
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.layoutManager).toBe(true);
      expect(layoutManager.getCurrentLayout).toHaveBeenCalled();
      expect(layoutManager.updateLayout).toHaveBeenCalledWith({
        name: '测试布局',
        description: '用于测试的布局'
      });
      expect(layoutManager.updatePanelLayout).toHaveBeenCalledWith('left-panel', {
        width: 350,
        visible: true
      });
    });

    it('应该在获取当前布局失败时返回 false', async () => {
      // 设置键盘快捷键测试成功，避免干扰
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      // 设置布局管理器失败
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue(null);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.layoutManager).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('获取当前布局失败');
    });

    it('应该在保存布局失败时返回 false', async () => {
      // 设置键盘快捷键测试成功，避免干扰
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      // 设置布局管理器部分成功，保存失败
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(false);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.layoutManager).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('保存布局失败');
    });

    it('应该在获取预设失败时返回 false', async () => {
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([]);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.layoutManager).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('获取预设失败');
    });

    it('应该测试波形状态更新', async () => {
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      await tester.runAllTests();

      expect(layoutManager.updateWaveformState).toHaveBeenCalledWith({
        zoomLevel: 2,
        firstSample: 100,
        visibleSamples: 2000
      });
    });

    it('应该测试通道可见性更新', async () => {
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      await tester.runAllTests();

      expect(layoutManager.updateChannelVisibility).toHaveBeenCalledWith(0, {
        visible: false,
        color: '#ff0000'
      });
    });
  });

  describe('testContextMenu', () => {
    it('应该成功测试右键菜单组件', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.contextMenu).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith('测试右键菜单组件...');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ 右键菜单组件测试通过');
    });

    it('应该验证菜单项结构的完整性', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      // 验证测试通过，说明菜单项结构验证正确
      expect(results.contextMenu).toBe(true);
    });
  });

  describe('testNotificationCenter', () => {
    it('应该成功测试通知系统', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.notificationCenter).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith('测试通知系统...');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ 通知系统测试通过');
    });

    it('应该验证通知数据结构', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      // 验证测试通过，说明通知结构验证正确
      expect(results.notificationCenter).toBe(true);
    });

    it('应该验证连接状态配置', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      // 验证测试通过，说明连接状态配置验证正确
      expect(results.notificationCenter).toBe(true);
    });

    it('应该验证性能警告级别', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      // 验证测试通过，说明性能级别验证正确
      expect(results.notificationCenter).toBe(true);
    });
  });

  describe('testShortcutHelp', () => {
    it('应该成功测试快捷键帮助', async () => {
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        {
          name: '测试分类',
          shortcuts: [
            {
              id: 'test-shortcut',
              description: '测试快捷键',
              keys: ['Ctrl', 'T']
            }
          ]
        }
      ]);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.shortcutHelp).toBe(true);
      expect(consoleSpy.log).toHaveBeenCalledWith('测试快捷键帮助...');
      expect(consoleSpy.log).toHaveBeenCalledWith('✓ 快捷键帮助测试通过');
    });

    it('应该在快捷键分类获取失败时返回 false', async () => {
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([]);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.shortcutHelp).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('快捷键分类获取失败');
    });

    it('应该验证分类结构的完整性', async () => {
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        {
          name: '', // 缺少名称
          shortcuts: []
        }
      ]);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.shortcutHelp).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('快捷键分类结构验证失败');
    });

    it('应该验证快捷键结构的完整性', async () => {
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        {
          name: '测试分类',
          shortcuts: [
            {
              id: '', // 缺少 id
              description: '测试快捷键',
              keys: ['Ctrl', 'T']
            }
          ]
        }
      ]);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.shortcutHelp).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('快捷键结构验证失败');
    });
  });

  describe('printTestResults', () => {
    it('应该正确打印测试结果统计', async () => {
      // 运行测试以填充结果
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      await tester.runAllTests();

      expect(consoleSpy.log).toHaveBeenCalledWith('\n=== UI优化功能测试结果 ===');
      expect(consoleSpy.log).toHaveBeenCalledWith('总测试数: 5');
      expect(consoleSpy.log).toHaveBeenCalledWith('通过测试: 5');
      expect(consoleSpy.log).toHaveBeenCalledWith('失败测试: 0');
      expect(consoleSpy.log).toHaveBeenCalledWith('通过率: 100.0%');
    });

    it('应该在所有测试通过时显示成功消息', async () => {
      // 设置所有测试通过
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      await tester.runAllTests();

      expect(consoleSpy.log).toHaveBeenCalledWith('\n🎉 所有UI优化功能测试通过！');
    });

    it('应该在有测试失败时显示警告消息', async () => {
      // 设置部分测试失败
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue(null);

      await tester.runAllTests();

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringMatching(/⚠️.*个测试失败，请检查相关功能。/));
    });
  });

  describe('getTestResults', () => {
    it('应该返回测试结果对象', () => {
      const results = tester.getTestResults();
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
    });

    it('应该在运行测试后包含所有测试项', async () => {
      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results).toHaveProperty('keyboardShortcuts');
      expect(results).toHaveProperty('layoutManager');
      expect(results).toHaveProperty('contextMenu');
      expect(results).toHaveProperty('notificationCenter');
      expect(results).toHaveProperty('shortcutHelp');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理 layoutManager 中的空预设列表', async () => {
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue(null);

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.layoutManager).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('获取预设失败');
    });

    it('应该处理预设列表中没有默认预设的情况', async () => {
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'custom', name: '自定义预设' }
      ]);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      await tester.runAllTests();
      const results = tester.getTestResults();

      // 应该跳过应用默认预设的步骤，但其他测试应该通过
      expect(results.layoutManager).toBe(true);
    });

    it('应该处理异步操作中的异常', async () => {
      (layoutManager.getCurrentLayout as jest.Mock).mockImplementation(() => {
        throw new Error('异步操作异常');
      });

      await tester.runAllTests();
      const results = tester.getTestResults();

      expect(results.layoutManager).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalledWith('布局管理器测试失败:', expect.any(Error));
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成所有测试', async () => {
      // 设置成功的 mock
      (keyboardShortcutManager.formatShortcut as jest.Mock).mockReturnValue('Ctrl+S');
      (keyboardShortcutManager.getShortcutsByCategory as jest.Mock).mockReturnValue([
        { name: '测试分类', shortcuts: [] }
      ]);
      (layoutManager.getCurrentLayout as jest.Mock).mockReturnValue({ name: '默认布局' });
      (layoutManager.saveCurrentLayout as jest.Mock).mockReturnValue(true);
      (layoutManager.getPresets as jest.Mock).mockReturnValue([
        { id: 'default', name: '默认预设' }
      ]);
      (layoutManager.applyPreset as jest.Mock).mockReturnValue(true);
      (layoutManager.saveAsPreset as jest.Mock).mockReturnValue('test-preset-id');
      (layoutManager.deletePreset as jest.Mock).mockReturnValue(true);
      (layoutManager.exportLayout as jest.Mock).mockReturnValue('{}');
      (layoutManager.importLayout as jest.Mock).mockReturnValue(true);

      const startTime = Date.now();
      await tester.runAllTests();
      const endTime = Date.now();

      // 测试应该在 5 秒内完成
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});