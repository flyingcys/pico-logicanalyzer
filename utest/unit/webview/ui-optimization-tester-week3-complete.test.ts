/**
 * 🎯 第3周 Day 3-4: UIOptimizationTester工具类模块完善
 * 目标：从8.89%一点一点提升到80%+
 * 策略：深度思考，严格按照渐进式方法，慢慢一步一步到90%
 */

// 在导入之前设置全局mocks
const mockKeyboardShortcutManager = {
  formatShortcut: jest.fn(() => '⌘ + S'),
  getShortcutsByCategory: jest.fn(() => [
    {
      name: '测试分类',
      shortcuts: [
        {
          id: 'test-shortcut',
          description: '测试快捷键',
          keys: ['Ctrl', 'T'],
          category: '测试',
          handler: jest.fn(),
          enabled: true
        }
      ]
    }
  ]),
  addShortcut: jest.fn(),
  setShortcutEnabled: jest.fn(),
  removeShortcut: jest.fn()
};

const mockLayoutManager = {
  getCurrentLayout: jest.fn(() => ({
    version: '1.0',
    timestamp: new Date().toISOString(),
    name: '测试布局',
    description: '用于测试的布局',
    panels: {
      leftPanel: { id: 'left-panel', visible: true, width: 300, position: 'left', order: 0 },
      rightPanel: { id: 'right-panel', visible: true, width: 400, position: 'right', order: 1 },
      statusBar: { id: 'status-bar', visible: true, height: 32, position: 'bottom', order: 2 },
      toolbar: { id: 'toolbar', visible: true, height: 48, position: 'top', order: 0 }
    },
    waveform: {
      zoomLevel: 1,
      panOffset: 0,
      firstSample: 0,
      visibleSamples: 1000,
      channelHeight: 30,
      showGrid: true,
      showTimeAxis: true,
      showSamplePoints: false
    },
    channels: [],
    decoderPanel: {
      activeTab: 'decoder',
      expandedDecoders: [],
      selectedProtocols: []
    },
    window: { width: 1200, height: 800, maximized: false },
    preferences: {
      theme: 'auto' as const,
      language: 'zh-CN',
      autoSave: true,
      showTooltips: true,
      animationsEnabled: true
    }
  })),
  updateLayout: jest.fn(),
  updatePanelLayout: jest.fn(),
  updateWaveformState: jest.fn(),
  updateChannelVisibility: jest.fn(),
  saveCurrentLayout: jest.fn(() => true),
  getPresets: jest.fn(() => [
    {
      id: 'default',
      name: '默认布局',
      description: '默认布局描述',
      layout: {} as any,
      isDefault: true,
      isSystem: true
    }
  ]),
  applyPreset: jest.fn(() => true),
  saveAsPreset: jest.fn(() => 'test-preset-id'),
  deletePreset: jest.fn(() => true),
  exportLayout: jest.fn(() => '{"test": "export"}'),
  importLayout: jest.fn(() => true)
};

// Mock console methods
const originalConsole = global.console;
const mockConsole = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn()
};

// 设置全局console mock
global.console = mockConsole;

// Mock the imported modules
jest.mock('../../../src/webview/utils/KeyboardShortcutManager', () => ({
  keyboardShortcutManager: mockKeyboardShortcutManager
}));

jest.mock('../../../src/webview/utils/LayoutManager', () => ({
  layoutManager: mockLayoutManager
}));

// 现在可以安全地导入
import { UIOptimizationTester } from '../../../src/webview/utils/UIOptimizationTester';

describe('🎯 第3周 UIOptimizationTester 工具类模块深度测试', () => {

  let tester: UIOptimizationTester;

  beforeEach(() => {
    jest.clearAllMocks();
    tester = new UIOptimizationTester();
  });

  describe('📋 基础构造和初始化测试', () => {

    it('应该正确构造UIOptimizationTester实例', () => {
      expect(tester).toBeDefined();
      expect(typeof tester.runAllTests).toBe('function');
      expect(typeof tester.getTestResults).toBe('function');
    });

    it('应该正确初始化测试结果状态', () => {
      const initialResults = tester.getTestResults();
      expect(initialResults).toBeDefined();
      expect(typeof initialResults).toBe('object');
    });

  });

  describe('🎯 运行所有测试功能', () => {

    it('应该正确执行所有UI优化功能测试', async () => {
      const results = await tester.runAllTests();
      
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      
      // 验证所有测试类型都被执行
      expect(results).toHaveProperty('keyboardShortcuts');
      expect(results).toHaveProperty('layoutManager');
      expect(results).toHaveProperty('contextMenu');
      expect(results).toHaveProperty('notificationCenter');
      expect(results).toHaveProperty('shortcutHelp');
      
      // 验证所有测试都成功通过
      Object.values(results).forEach(result => {
        expect(result).toBe(true);
      });
    });

    it('应该正确处理测试过程中的异常', async () => {
      // 模拟键盘快捷键管理器抛出异常
      mockKeyboardShortcutManager.formatShortcut.mockImplementation(() => {
        throw new Error('测试异常');
      });
      
      const results = await tester.runAllTests();
      expect(results).toBeDefined();
      
      // 键盘快捷键测试应该失败
      expect(results.keyboardShortcuts).toBe(false);
      
      // 其他测试应该仍然能够执行
      expect(results.layoutManager).toBe(true);
      expect(results.contextMenu).toBe(true);
      expect(results.notificationCenter).toBe(true);
      expect(results.shortcutHelp).toBe(true);
    });

    it('应该正确打印测试开始消息', async () => {
      await tester.runAllTests();
      
      expect(mockConsole.log).toHaveBeenCalledWith('开始UI优化功能测试...');
    });

    it('应该正确处理整体测试异常', async () => {
      // 创建一个有问题的tester实例
      const problematicTester = new UIOptimizationTester();
      
      // 模拟整体异常（通过访问undefined方法）
      jest.spyOn(problematicTester as any, 'testKeyboardShortcuts').mockImplementation(() => {
        throw new Error('整体测试异常');
      });
      
      const results = await problematicTester.runAllTests();
      expect(results).toBeDefined();
    });

  });

  describe('⌨️ 键盘快捷键管理器测试', () => {

    it('应该正确测试键盘快捷键管理器的所有功能', async () => {
      const results = await tester.runAllTests();
      
      expect(results.keyboardShortcuts).toBe(true);
      
      // 验证所有相关方法都被调用
      expect(mockKeyboardShortcutManager.formatShortcut).toHaveBeenCalledWith(['Ctrl', 'S']);
      expect(mockKeyboardShortcutManager.getShortcutsByCategory).toHaveBeenCalled();
      expect(mockKeyboardShortcutManager.addShortcut).toHaveBeenCalledWith({
        id: 'test-shortcut',
        keys: ['Ctrl', 'T'],
        description: '测试快捷键',
        category: '测试',
        handler: expect.any(Function),
        enabled: true
      });
      expect(mockKeyboardShortcutManager.setShortcutEnabled).toHaveBeenCalledWith('test-shortcut', false);
      expect(mockKeyboardShortcutManager.setShortcutEnabled).toHaveBeenCalledWith('test-shortcut', true);
      expect(mockKeyboardShortcutManager.removeShortcut).toHaveBeenCalledWith('test-shortcut');
    });

    it('应该正确处理快捷键格式化失败', async () => {
      mockKeyboardShortcutManager.formatShortcut.mockReturnValue('');
      
      const results = await tester.runAllTests();
      expect(results.keyboardShortcuts).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('快捷键格式化失败');
    });

    it('应该正确处理快捷键分类获取失败', async () => {
      mockKeyboardShortcutManager.getShortcutsByCategory.mockReturnValue([]);
      
      const results = await tester.runAllTests();
      expect(results.keyboardShortcuts).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('获取快捷键分类失败');
    });

    it('应该正确处理快捷键分类为null的情况', async () => {
      mockKeyboardShortcutManager.getShortcutsByCategory.mockReturnValue(null);
      
      const results = await tester.runAllTests();
      expect(results.keyboardShortcuts).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('获取快捷键分类失败');
    });

    it('应该正确处理键盘快捷键测试异常', async () => {
      mockKeyboardShortcutManager.addShortcut.mockImplementation(() => {
        throw new Error('添加快捷键失败');
      });
      
      const results = await tester.runAllTests();
      expect(results.keyboardShortcuts).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('键盘快捷键管理器测试失败:', expect.any(Error));
    });

  });

  describe('🎛️ 布局管理器测试', () => {

    it('应该正确测试布局管理器的所有功能', async () => {
      const results = await tester.runAllTests();
      
      expect(results.layoutManager).toBe(true);
      
      // 验证所有相关方法都被调用
      expect(mockLayoutManager.getCurrentLayout).toHaveBeenCalled();
      expect(mockLayoutManager.updateLayout).toHaveBeenCalledWith({
        name: '测试布局',
        description: '用于测试的布局'
      });
      expect(mockLayoutManager.updatePanelLayout).toHaveBeenCalledWith('left-panel', {
        width: 350,
        visible: true
      });
      expect(mockLayoutManager.updateWaveformState).toHaveBeenCalledWith({
        zoomLevel: 2,
        firstSample: 100,
        visibleSamples: 2000
      });
      expect(mockLayoutManager.updateChannelVisibility).toHaveBeenCalledWith(0, {
        visible: false,
        color: '#ff0000'
      });
      expect(mockLayoutManager.saveCurrentLayout).toHaveBeenCalled();
      expect(mockLayoutManager.getPresets).toHaveBeenCalled();
      expect(mockLayoutManager.applyPreset).toHaveBeenCalledWith('default');
      expect(mockLayoutManager.saveAsPreset).toHaveBeenCalledWith('测试预设', '这是一个测试预设');
      expect(mockLayoutManager.deletePreset).toHaveBeenCalled();
      expect(mockLayoutManager.exportLayout).toHaveBeenCalled();
      expect(mockLayoutManager.importLayout).toHaveBeenCalled();
    });

    it('应该正确处理获取当前布局失败', async () => {
      mockLayoutManager.getCurrentLayout.mockReturnValue(null);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('获取当前布局失败');
    });

    it('应该正确处理保存布局失败', async () => {
      mockLayoutManager.saveCurrentLayout.mockReturnValue(false);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('保存布局失败');
    });

    it('应该正确处理获取预设失败', async () => {
      mockLayoutManager.getPresets.mockReturnValue([]);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('获取预设失败');
    });

    it('应该正确处理预设为null的情况', async () => {
      mockLayoutManager.getPresets.mockReturnValue(null);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('获取预设失败');
    });

    it('应该正确处理应用预设失败', async () => {
      mockLayoutManager.applyPreset.mockReturnValue(false);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('应用预设失败');
    });

    it('应该正确处理保存为预设失败', async () => {
      mockLayoutManager.saveAsPreset.mockReturnValue('');
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('保存为预设失败');
    });

    it('应该正确处理删除预设失败', async () => {
      mockLayoutManager.deletePreset.mockReturnValue(false);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('删除预设失败');
    });

    it('应该正确处理导出布局失败', async () => {
      mockLayoutManager.exportLayout.mockReturnValue('');
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('导出布局失败');
    });

    it('应该正确处理导入布局失败', async () => {
      mockLayoutManager.importLayout.mockReturnValue(false);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('导入布局失败');
    });

    it('应该正确处理布局管理器测试异常', async () => {
      mockLayoutManager.getCurrentLayout.mockImplementation(() => {
        throw new Error('布局管理器异常');
      });
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('布局管理器测试失败:', expect.any(Error));
    });

    it('应该正确处理没有默认预设的情况', async () => {
      mockLayoutManager.getPresets.mockReturnValue([
        {
          id: 'other-preset',
          name: '其他预设',
          description: '不是默认预设',
          layout: {} as any,
          isDefault: false,
          isSystem: false
        }
      ]);
      
      const results = await tester.runAllTests();
      expect(results.layoutManager).toBe(true); // 应该仍然通过，因为没有尝试应用默认预设
      expect(mockLayoutManager.applyPreset).not.toHaveBeenCalled();
    });

  });

  describe('🖱️ 右键菜单组件测试', () => {

    it('应该正确测试右键菜单组件功能', async () => {
      const results = await tester.runAllTests();
      
      expect(results.contextMenu).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith('测试右键菜单组件...');
      expect(mockConsole.log).toHaveBeenCalledWith('✓ 右键菜单组件测试通过');
    });

    it('应该正确处理右键菜单测试异常', async () => {
      // 创建一个会抛出异常的测试实例
      const problematicTester = new UIOptimizationTester();
      
      // 模拟异常
      jest.spyOn(problematicTester as any, 'testContextMenu').mockImplementation(() => {
        throw new Error('右键菜单测试异常');
      });
      
      const results = await problematicTester.runAllTests();
      // 由于异常被catch，应该返回false
      expect(results.contextMenu).toBe(false);
    });

    it('应该正确验证菜单项结构', async () => {
      const results = await tester.runAllTests();
      expect(results.contextMenu).toBe(true);
    });

    it('应该正确验证子菜单结构', async () => {
      const results = await tester.runAllTests();
      expect(results.contextMenu).toBe(true);
    });

  });

  describe('📢 通知系统测试', () => {

    it('应该正确测试通知系统功能', async () => {
      const results = await tester.runAllTests();
      
      expect(results.notificationCenter).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith('测试通知系统...');
      expect(mockConsole.log).toHaveBeenCalledWith('✓ 通知系统测试通过');
    });

    it('应该正确处理通知系统测试异常', async () => {
      const problematicTester = new UIOptimizationTester();
      
      jest.spyOn(problematicTester as any, 'testNotificationCenter').mockImplementation(() => {
        throw new Error('通知系统测试异常');
      });
      
      const results = await problematicTester.runAllTests();
      expect(results.notificationCenter).toBe(false);
    });

    it('应该正确验证通知数据结构', async () => {
      const results = await tester.runAllTests();
      expect(results.notificationCenter).toBe(true);
    });

    it('应该正确验证连接状态配置', async () => {
      const results = await tester.runAllTests();
      expect(results.notificationCenter).toBe(true);
    });

    it('应该正确验证性能警告级别', async () => {
      const results = await tester.runAllTests();
      expect(results.notificationCenter).toBe(true);
    });

  });

  describe('❓ 快捷键帮助测试', () => {

    it('应该正确测试快捷键帮助功能', async () => {
      const results = await tester.runAllTests();
      
      expect(results.shortcutHelp).toBe(true);
      expect(mockConsole.log).toHaveBeenCalledWith('测试快捷键帮助...');
      expect(mockConsole.log).toHaveBeenCalledWith('✓ 快捷键帮助测试通过');
    });

    it('应该正确处理快捷键分类获取失败', async () => {
      // 临时修改mock返回值
      const originalImplementation = mockKeyboardShortcutManager.getShortcutsByCategory;
      mockKeyboardShortcutManager.getShortcutsByCategory.mockReturnValue([]);
      
      const results = await tester.runAllTests();
      expect(results.shortcutHelp).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('快捷键分类获取失败');
      
      // 恢复原始实现
      mockKeyboardShortcutManager.getShortcutsByCategory.mockImplementation(originalImplementation);
    });

    it('应该正确处理分类为null的情况', async () => {
      const originalImplementation = mockKeyboardShortcutManager.getShortcutsByCategory;
      mockKeyboardShortcutManager.getShortcutsByCategory.mockReturnValue(null);
      
      const results = await tester.runAllTests();
      expect(results.shortcutHelp).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('快捷键分类获取失败');
      
      mockKeyboardShortcutManager.getShortcutsByCategory.mockImplementation(originalImplementation);
    });

    it('应该正确处理分类结构验证失败', async () => {
      const originalImplementation = mockKeyboardShortcutManager.getShortcutsByCategory;
      mockKeyboardShortcutManager.getShortcutsByCategory.mockReturnValue([
        {
          name: '', // 空名称会导致验证失败
          shortcuts: []
        }
      ]);
      
      const results = await tester.runAllTests();
      expect(results.shortcutHelp).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('快捷键分类结构验证失败');
      
      mockKeyboardShortcutManager.getShortcutsByCategory.mockImplementation(originalImplementation);
    });

    it('应该正确处理快捷键结构验证失败', async () => {
      const originalImplementation = mockKeyboardShortcutManager.getShortcutsByCategory;
      mockKeyboardShortcutManager.getShortcutsByCategory.mockReturnValue([
        {
          name: '测试分类',
          shortcuts: [
            {
              id: '', // 空ID会导致验证失败
              description: '测试快捷键',
              keys: ['Ctrl', 'T'],
              category: '测试',
              handler: jest.fn(),
              enabled: true
            }
          ]
        }
      ]);
      
      const results = await tester.runAllTests();
      expect(results.shortcutHelp).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith('快捷键结构验证失败');
      
      mockKeyboardShortcutManager.getShortcutsByCategory.mockImplementation(originalImplementation);
    });

    it('应该正确处理快捷键帮助测试异常', async () => {
      const problematicTester = new UIOptimizationTester();
      
      jest.spyOn(problematicTester as any, 'testShortcutHelp').mockImplementation(() => {
        throw new Error('快捷键帮助测试异常');
      });
      
      const results = await problematicTester.runAllTests();
      expect(results.shortcutHelp).toBe(false);
    });

  });

  describe('📊 测试结果管理', () => {

    it('应该正确获取测试结果', async () => {
      await tester.runAllTests();
      
      const results = tester.getTestResults();
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      
      // 验证结果包含所有测试项
      expect(results).toHaveProperty('keyboardShortcuts');
      expect(results).toHaveProperty('layoutManager');
      expect(results).toHaveProperty('contextMenu');
      expect(results).toHaveProperty('notificationCenter');
      expect(results).toHaveProperty('shortcutHelp');
    });

    it('应该正确打印测试结果统计', async () => {
      await tester.runAllTests();
      
      // 验证打印了测试结果头部
      expect(mockConsole.log).toHaveBeenCalledWith('\n=== UI优化功能测试结果 ===');
      
      // 验证打印了统计信息
      expect(mockConsole.log).toHaveBeenCalledWith('总测试数: 5');
      expect(mockConsole.log).toHaveBeenCalledWith('通过测试: 5');
      expect(mockConsole.log).toHaveBeenCalledWith('失败测试: 0');
      expect(mockConsole.log).toHaveBeenCalledWith('通过率: 100.0%');
      
      // 验证打印了详细结果
      expect(mockConsole.log).toHaveBeenCalledWith('\n详细结果:');
      expect(mockConsole.log).toHaveBeenCalledWith('  keyboardShortcuts: ✓ 通过');
      expect(mockConsole.log).toHaveBeenCalledWith('  layoutManager: ✓ 通过');
      expect(mockConsole.log).toHaveBeenCalledWith('  contextMenu: ✓ 通过');
      expect(mockConsole.log).toHaveBeenCalledWith('  notificationCenter: ✓ 通过');
      expect(mockConsole.log).toHaveBeenCalledWith('  shortcutHelp: ✓ 通过');
      
      // 验证打印了成功消息
      expect(mockConsole.log).toHaveBeenCalledWith('\n🎉 所有UI优化功能测试通过！');
    });

    it('应该正确处理部分测试失败的情况', async () => {
      // 模拟一个测试失败
      mockKeyboardShortcutManager.formatShortcut.mockReturnValue('');
      
      await tester.runAllTests();
      
      // 验证打印了失败统计
      expect(mockConsole.log).toHaveBeenCalledWith('通过测试: 4');
      expect(mockConsole.log).toHaveBeenCalledWith('失败测试: 1');
      expect(mockConsole.log).toHaveBeenCalledWith('通过率: 80.0%');
      
      // 验证打印了失败详细信息
      expect(mockConsole.log).toHaveBeenCalledWith('  keyboardShortcuts: ✗ 失败');
      
      // 验证打印了警告消息
      expect(mockConsole.log).toHaveBeenCalledWith('\n⚠️  1 个测试失败，请检查相关功能。');
    });

  });

  describe('🔧 边界条件和异常处理测试', () => {

    it('应该正确处理空的测试结果', () => {
      const newTester = new UIOptimizationTester();
      const results = newTester.getTestResults();
      
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(Object.keys(results)).toHaveLength(0);
    });

    it('应该正确处理所有测试都失败的情况', async () => {
      // 模拟所有依赖都失败
      mockKeyboardShortcutManager.formatShortcut.mockReturnValue('');
      mockLayoutManager.getCurrentLayout.mockReturnValue(null);
      
      const problematicTester = new UIOptimizationTester();
      
      // 模拟其他测试也失败
      jest.spyOn(problematicTester as any, 'testContextMenu').mockImplementation(() => {
        throw new Error('右键菜单失败');
      });
      jest.spyOn(problematicTester as any, 'testNotificationCenter').mockImplementation(() => {
        throw new Error('通知系统失败');
      });
      jest.spyOn(problematicTester as any, 'testShortcutHelp').mockImplementation(() => {
        throw new Error('帮助系统失败');
      });
      
      const results = await problematicTester.runAllTests();
      
      // 所有测试都应该失败
      expect(results.keyboardShortcuts).toBe(false);
      expect(results.layoutManager).toBe(false);
      expect(results.contextMenu).toBe(false);
      expect(results.notificationCenter).toBe(false);
      expect(results.shortcutHelp).toBe(false);
      
      // 应该打印0%通过率
      expect(mockConsole.log).toHaveBeenCalledWith('通过率: 0.0%');
      expect(mockConsole.log).toHaveBeenCalledWith('\n⚠️  5 个测试失败，请检查相关功能。');
    });

    it('应该正确处理console方法异常的情况', async () => {
      // 模拟console方法抛出异常
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = jest.fn(() => {
        throw new Error('Console log error');
      });
      console.error = jest.fn(() => {
        throw new Error('Console error error');
      });
      
      // 不应该抛出异常，应该能继续执行
      await expect(tester.runAllTests()).resolves.toBeDefined();
      
      // 恢复console方法
      console.log = originalLog;
      console.error = originalError;
    });

  });

  describe('⚡ 性能和集成测试', () => {

    it('应该在合理时间内完成所有测试', async () => {
      const startTime = Date.now();
      
      await tester.runAllTests();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 所有测试应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it('应该正确处理大量重复测试执行', async () => {
      const tester = new UIOptimizationTester();
      
      // 执行多次测试
      for (let i = 0; i < 10; i++) {
        const results = await tester.runAllTests();
        expect(Object.keys(results)).toHaveLength(5);
      }
      
      // 验证最终状态正确
      const finalResults = tester.getTestResults();
      expect(Object.keys(finalResults)).toHaveLength(5);
    });

    it('应该正确处理并发测试执行', async () => {
      const tester1 = new UIOptimizationTester();
      const tester2 = new UIOptimizationTester();
      
      // 并发执行测试
      const [results1, results2] = await Promise.all([
        tester1.runAllTests(),
        tester2.runAllTests()
      ]);
      
      // 两个测试结果都应该完整
      expect(Object.keys(results1)).toHaveLength(5);
      expect(Object.keys(results2)).toHaveLength(5);
      
      // 结果应该一致
      expect(results1).toEqual(results2);
    });

  });

});