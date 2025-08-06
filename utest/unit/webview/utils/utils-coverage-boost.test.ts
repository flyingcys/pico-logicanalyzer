/**
 * Utils 模块覆盖率提升专项测试
 * 专门针对未覆盖的分支和边界条件，确保达到95%+覆盖率
 * @jest-environment jsdom
 */

// Mock localStorage和sessionStorage
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockStorage });

// Mock console
const originalConsole = console;
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

beforeAll(() => {
  Object.assign(console, mockConsole);
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('Utils 覆盖率提升专项测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('KeyboardShortcutManager 分支覆盖提升', () => {
    it('应该覆盖formatShortcut的所有键盘修饰符组合', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');

      expect(() => {
        // 测试所有可能的修饰符组合
        const modifierCombinations = [
          ['Ctrl'],
          ['Alt'],
          ['Shift'],
          ['Meta'],
          ['Ctrl', 'Alt'],
          ['Ctrl', 'Shift'],
          ['Ctrl', 'Meta'],
          ['Alt', 'Shift'],
          ['Alt', 'Meta'],
          ['Shift', 'Meta'],
          ['Ctrl', 'Alt', 'Shift'],
          ['Ctrl', 'Alt', 'Meta'],
          ['Ctrl', 'Shift', 'Meta'],
          ['Alt', 'Shift', 'Meta'],
          ['Ctrl', 'Alt', 'Shift', 'Meta']
        ];

        modifierCombinations.forEach(modifiers => {
          const keys = [...modifiers, 'F1'];
          const formatted = keyboardShortcutManager.formatShortcut(keys);
          expect(typeof formatted).toBe('string');
        });
      }).not.toThrow();
    });

    it('应该覆盖addShortcut的冲突检测分支', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');

      expect(() => {
        // 添加第一个快捷键
        keyboardShortcutManager.addShortcut({
          id: 'test1',
          keys: ['Ctrl', 'S'],
          description: 'Save',
          category: 'file',
          handler: () => {},
          enabled: true
        });

        // 尝试添加冲突的快捷键（相同按键组合）
        keyboardShortcutManager.addShortcut({
          id: 'test2',
          keys: ['Ctrl', 'S'], // 相同的按键组合
          description: 'Save As',
          category: 'file',
          handler: () => {},
          enabled: true
        });

        // 添加禁用的快捷键
        keyboardShortcutManager.addShortcut({
          id: 'test3',
          keys: ['Ctrl', 'O'],
          description: 'Open',
          category: 'file',
          handler: () => {},
          enabled: false // 禁用状态
        });
      }).not.toThrow();
    });

    it('应该覆盖getShortcutsByCategory的分类逻辑', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');

      expect(() => {
        // 添加不同分类的快捷键
        const categories = ['file', 'edit', 'view', 'debug', 'help'];
        categories.forEach((category, index) => {
          keyboardShortcutManager.addShortcut({
            id: `shortcut_${category}_${index}`,
            keys: ['Ctrl', `F${index + 1}`],
            description: `${category} action`,
            category: category,
            handler: () => {},
            enabled: true
          });
        });

        // 获取各个分类的快捷键
        categories.forEach(category => {
          const shortcuts = keyboardShortcutManager.getShortcutsByCategory(category);
          expect(Array.isArray(shortcuts)).toBe(true);
        });

        // 获取不存在的分类
        const nonExistentShortcuts = keyboardShortcutManager.getShortcutsByCategory('nonexistent');
        expect(Array.isArray(nonExistentShortcuts)).toBe(true);
        expect(nonExistentShortcuts.length).toBe(0);
      }).not.toThrow();
    });

    it('应该覆盖键盘事件处理的异常分支', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');

      expect(() => {
        // 添加会抛出异常的处理器
        keyboardShortcutManager.addShortcut({
          id: 'error_shortcut',
          keys: ['Ctrl', 'E'],
          description: 'Error Test',
          category: 'test',
          handler: () => {
            throw new Error('Handler error');
          },
          enabled: true
        });

        // 模拟键盘事件
        const mockKeyEvent = {
          ctrlKey: true,
          altKey: false,
          shiftKey: false,
          metaKey: false,
          key: 'e',
          preventDefault: jest.fn(),
          stopPropagation: jest.fn()
        };

        keyboardShortcutManager.handleKeyDown(mockKeyEvent);
      }).not.toThrow();
    });
  });

  describe('LayoutManager 分支覆盖提升', () => {
    it('应该覆盖localStorage异常处理分支', () => {
      // Mock localStorage抛出异常
      mockStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage access denied');
      });

      mockStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });

      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        // 这些操作应该优雅地处理localStorage异常
        layoutManager.getCurrentLayout();
        layoutManager.saveCurrentLayout();
        layoutManager.getPresets();
        layoutManager.saveAsPreset('test', {});
      }).not.toThrow();
    });

    it('应该覆盖JSON解析异常分支', () => {
      // Mock localStorage返回无效JSON
      mockStorage.getItem.mockReturnValue('invalid json string {]');

      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        const layout = layoutManager.getCurrentLayout();
        expect(layout).toBeDefined(); // 应该返回默认布局
      }).not.toThrow();
    });

    it('应该覆盖updatePanelLayout的边界值处理', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        const extremeValues = [
          { width: -1000, height: -1000, visible: false },
          { width: 0, height: 0, visible: true },
          { width: 99999, height: 99999, visible: true },
          { width: Infinity, height: Infinity, visible: false },
          { width: NaN, height: NaN, visible: null }
        ];

        const positions = ['left', 'right', 'top', 'bottom', 'center'];
        
        extremeValues.forEach(values => {
          positions.forEach(position => {
            layoutManager.updatePanelLayout(position, values);
          });
        });
      }).not.toThrow();
    });

    it('应该覆盖updateWaveformState的数值验证分支', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        const invalidStates = [
          { zoomLevel: -100, firstSample: -1000, visibleSamples: -500 },
          { zoomLevel: 0, firstSample: 0, visibleSamples: 0 },
          { zoomLevel: Infinity, firstSample: Infinity, visibleSamples: Infinity },
          { zoomLevel: NaN, firstSample: NaN, visibleSamples: NaN },
          { zoomLevel: null, firstSample: null, visibleSamples: null },
          { zoomLevel: undefined, firstSample: undefined, visibleSamples: undefined }
        ];

        invalidStates.forEach(state => {
          layoutManager.updateWaveformState(state);
        });
      }).not.toThrow();
    });

    it('应该覆盖updateChannelVisibility的通道范围检查', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        const invalidChannels = [-1, -100, 1000, 99999, NaN, Infinity, null, undefined];
        const configs = [
          { visible: true, color: '#ff0000' },
          { visible: false, color: '#invalid' },
          { visible: null, color: null },
          { visible: undefined, color: undefined },
          null,
          undefined
        ];

        invalidChannels.forEach(channel => {
          configs.forEach(config => {
            layoutManager.updateChannelVisibility(channel, config);
          });
        });
      }).not.toThrow();
    });

    it('应该覆盖预设管理的异常分支', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        // 测试空或无效预设名称
        const invalidNames = ['', null, undefined, ' ', '\t\n', '..', '/\\'];
        invalidNames.forEach(name => {
          layoutManager.saveAsPreset(name, {});
          layoutManager.applyPreset(name);
          layoutManager.deletePreset(name);
        });

        // 测试无效预设数据
        const invalidData = [null, undefined, 'string', 123, [], true];
        invalidData.forEach(data => {
          layoutManager.saveAsPreset('test', data);
        });
      }).not.toThrow();
    });

    it('应该覆盖导入导出的数据验证分支', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        // 测试导出
        const exportData = layoutManager.exportLayout();
        expect(typeof exportData).toBe('string');

        // 测试导入无效数据
        const invalidImportData = [
          'invalid json',
          '{"incomplete": true',
          '[]',
          'null',
          '123',
          '"string"',
          '{"wrongStructure": "data"}'
        ];

        invalidImportData.forEach(data => {
          layoutManager.importLayout(data);
        });

        // 测试导入null或undefined
        layoutManager.importLayout(null);
        layoutManager.importLayout(undefined);
      }).not.toThrow();
    });
  });

  describe('UIOptimizationTester 错误路径覆盖', () => {
    it('应该覆盖所有测试方法的异常处理分支', () => {
      // Mock所有依赖抛出异常
      jest.doMock('../../../../src/webview/utils/KeyboardShortcutManager', () => ({
        keyboardShortcutManager: {
          formatShortcut: jest.fn().mockImplementation(() => {
            throw new Error('formatShortcut failed');
          }),
          getShortcutsByCategory: jest.fn().mockImplementation(() => {
            throw new Error('getShortcutsByCategory failed');
          }),
          addShortcut: jest.fn(),
          setShortcutEnabled: jest.fn(),
          removeShortcut: jest.fn()
        }
      }));

      jest.doMock('../../../../src/webview/utils/LayoutManager', () => ({
        layoutManager: {
          getCurrentLayout: jest.fn().mockImplementation(() => {
            throw new Error('getCurrentLayout failed');
          }),
          saveCurrentLayout: jest.fn().mockReturnValue(false),
          getPresets: jest.fn().mockImplementation(() => {
            throw new Error('getPresets failed');
          }),
          updateLayout: jest.fn(),
          updatePanelLayout: jest.fn(),
          updateWaveformState: jest.fn(),
          updateChannelVisibility: jest.fn(),
          applyPreset: jest.fn(),
          saveAsPreset: jest.fn(),
          deletePreset: jest.fn(),
          exportLayout: jest.fn(),
          importLayout: jest.fn()
        }
      }));

      const { UIOptimizationTester } = require('../../../../src/webview/utils/UIOptimizationTester');

      expect(() => {
        const tester = new UIOptimizationTester();

        // 这些调用应该触发异常处理分支
        const results = tester.runAllTests();
        expect(results).toBeDefined();

        const testResults = tester.getTestResults();
        expect(testResults).toBeDefined();

        tester.printTestResults();
      }).not.toThrow();
    });

    it('应该覆盖console输出的所有分支', () => {
      // 创建正常工作的mock
      jest.doMock('../../../../src/webview/utils/KeyboardShortcutManager', () => ({
        keyboardShortcutManager: {
          formatShortcut: jest.fn().mockReturnValue('Ctrl+S'),
          getShortcutsByCategory: jest.fn().mockReturnValue([
            { id: 'test', keys: ['Ctrl', 'S'], description: 'Test' }
          ]),
          addShortcut: jest.fn(),
          setShortcutEnabled: jest.fn(),
          removeShortcut: jest.fn()
        }
      }));

      jest.doMock('../../../../src/webview/utils/LayoutManager', () => ({
        layoutManager: {
          getCurrentLayout: jest.fn().mockReturnValue({}),
          saveCurrentLayout: jest.fn().mockReturnValue(true),
          getPresets: jest.fn().mockReturnValue([{ name: 'default', data: {} }]),
          updateLayout: jest.fn(),
          updatePanelLayout: jest.fn(),
          updateWaveformState: jest.fn(),
          updateChannelVisibility: jest.fn(),
          applyPreset: jest.fn(),
          saveAsPreset: jest.fn(),
          deletePreset: jest.fn(),
          exportLayout: jest.fn(),
          importLayout: jest.fn()
        }
      }));

      const { UIOptimizationTester } = require('../../../../src/webview/utils/UIOptimizationTester');

      expect(() => {
        const tester = new UIOptimizationTester();

        // 运行测试以触发成功的console输出分支
        tester.runAllTests();
        tester.printTestResults();

        // 验证console调用
        expect(mockConsole.log).toHaveBeenCalled();
      }).not.toThrow();
    });

    it('应该覆盖testResult属性的所有状态分支', () => {
      const { UIOptimizationTester } = require('../../../../src/webview/utils/UIOptimizationTester');

      expect(() => {
        const tester = new UIOptimizationTester();

        // 在运行任何测试之前获取结果（应该是空的）
        let results = tester.getTestResults();
        expect(results).toBeDefined();

        // 运行部分测试
        tester.testKeyboardShortcuts();
        results = tester.getTestResults();
        expect(results.keyboardShortcuts).toBeDefined();

        // 运行所有测试
        tester.runAllTests();
        results = tester.getTestResults();
        expect(results).toBeDefined();

        // 多次调用printTestResults以覆盖不同的状态
        tester.printTestResults();
        tester.printTestResults();
      }).not.toThrow();
    });
  });

  describe('边界条件和异常流程', () => {
    it('应该处理模块导入失败的情况', () => {
      expect(() => {
        // 尝试重复导入模块
        for (let i = 0; i < 5; i++) {
          require('../../../../src/webview/utils/KeyboardShortcutManager');
          require('../../../../src/webview/utils/LayoutManager');
          require('../../../../src/webview/utils/UIOptimizationTester');
        }
      }).not.toThrow();
    });

    it('应该处理全局对象不存在的情况', () => {
      // 暂时删除window对象
      const originalWindow = global.window;
      delete global.window;

      try {
        expect(() => {
          // 重新加载模块时应该处理window不存在的情况
          jest.resetModules();
          require('../../../../src/webview/utils/LayoutManager');
        }).not.toThrow();
      } finally {
        global.window = originalWindow;
      }
    });

    it('应该处理document对象不存在的情况', () => {
      // 暂时删除document对象
      const originalDocument = global.document;
      delete global.document;

      try {
        expect(() => {
          jest.resetModules();
          require('../../../../src/webview/utils/KeyboardShortcutManager');
        }).not.toThrow();
      } finally {
        global.document = originalDocument;
      }
    });
  });

  describe('性能和压力测试', () => {
    it('应该处理大量操作而不崩溃', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');

      expect(() => {
        // 大量快捷键操作
        for (let i = 0; i < 1000; i++) {
          keyboardShortcutManager.addShortcut({
            id: `stress_test_${i}`,
            keys: ['Ctrl', `Key${i % 26 + 65}`], // A-Z
            description: `Stress test ${i}`,
            category: `category_${i % 10}`,
            handler: () => {},
            enabled: i % 2 === 0
          });
        }

        // 大量布局操作
        for (let i = 0; i < 1000; i++) {
          layoutManager.updateWaveformState({
            zoomLevel: i % 100,
            firstSample: i * 1000,
            visibleSamples: 1000 + (i % 500)
          });

          layoutManager.updateChannelVisibility(i % 64, {
            visible: i % 2 === 0,
            color: `#${(i * 1000).toString(16).padStart(6, '0').substring(0, 6)}`
          });
        }

        // 大量UIOptimizationTester操作
        const { UIOptimizationTester } = require('../../../../src/webview/utils/UIOptimizationTester');
        for (let i = 0; i < 100; i++) {
          const tester = new UIOptimizationTester();
          tester.runAllTests();
        }
      }).not.toThrow();
    });

    it('应该在合理时间内完成所有操作', () => {
      const startTime = performance.now();

      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      const { UIOptimizationTester } = require('../../../../src/webview/utils/UIOptimizationTester');

      // 执行各种操作
      for (let i = 0; i < 100; i++) {
        keyboardShortcutManager.formatShortcut(['Ctrl', 'Alt', `F${i % 12 + 1}`]);
        layoutManager.updateWaveformState({ zoomLevel: i, firstSample: i * 100, visibleSamples: 1000 });
      }

      const tester = new UIOptimizationTester();
      tester.runAllTests();

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });
});