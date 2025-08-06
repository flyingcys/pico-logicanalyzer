/**
 * Utils 模块增强测试
 * 专注于提高各个utils文件的代码覆盖率
 * @jest-environment jsdom
 */

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockStorage });

describe('Utils 模块增强测试 - 覆盖率提升', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('KeyboardShortcutManager 边界条件', () => {
    it('应该处理键盘事件的各种组合', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      
      // 测试不同的键盘组合
      expect(() => {
        keyboardShortcutManager.formatShortcut(['Ctrl', 'Alt', 'Shift', 'F1']);
        keyboardShortcutManager.formatShortcut(['Meta', 'Space']);
        keyboardShortcutManager.formatShortcut(['Escape']);
      }).not.toThrow();
    });

    it('应该处理错误的快捷键配置', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      
      expect(() => {
        keyboardShortcutManager.addShortcut({
          id: '',
          keys: [],
          description: '',
          category: '',
          handler: null,
          enabled: false
        });
      }).not.toThrow();
    });

    it('应该处理快捷键冲突检测', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      
      expect(() => {
        keyboardShortcutManager.addShortcut({
          id: 'test1',
          keys: ['Ctrl', 'S'],
          description: 'Test 1',
          category: 'test',
          handler: () => {},
          enabled: true
        });
        keyboardShortcutManager.addShortcut({
          id: 'test2',
          keys: ['Ctrl', 'S'], // 相同快捷键
          description: 'Test 2',
          category: 'test',
          handler: () => {},
          enabled: true
        });
      }).not.toThrow();
    });
  });

  describe('LayoutManager 边界条件', () => {
    it('应该处理无效的布局配置', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      expect(() => {
        layoutManager.updateLayout(null);
        layoutManager.updateLayout({});
        layoutManager.updateLayout({ invalid: true });
      }).not.toThrow();
    });

    it('应该处理存储失败的情况', () => {
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      expect(() => {
        layoutManager.saveCurrentLayout();
      }).not.toThrow();
    });

    it('应该处理JSON解析错误', () => {
      mockStorage.getItem.mockReturnValue('invalid json');
      
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      expect(() => {
        layoutManager.getCurrentLayout();
      }).not.toThrow();
    });

    it('应该处理面板布局的各种配置', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      expect(() => {
        layoutManager.updatePanelLayout('left', { width: 0, visible: false });
        layoutManager.updatePanelLayout('right', { width: -100, visible: true });
        layoutManager.updatePanelLayout('bottom', { height: 1000000, visible: true });
      }).not.toThrow();
    });

    it('应该处理波形状态的边界值', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      expect(() => {
        layoutManager.updateWaveformState({
          zoomLevel: 0,
          firstSample: -1,
          visibleSamples: 0
        });
        layoutManager.updateWaveformState({
          zoomLevel: 1000000,
          firstSample: Number.MAX_SAFE_INTEGER,
          visibleSamples: Number.MAX_SAFE_INTEGER
        });
      }).not.toThrow();
    });

    it('应该处理通道可见性的各种配置', () => {
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      expect(() => {
        layoutManager.updateChannelVisibility(-1, { visible: true, color: 'invalid' });
        layoutManager.updateChannelVisibility(999, { visible: false, color: '#gggggg' });
        layoutManager.updateChannelVisibility(0, null);
      }).not.toThrow();
    });
  });

  describe('UIOptimizationTester 错误路径', () => {
    it('应该处理Mock失败的情况', () => {
      // Mock keyboardShortcutManager 方法失败
      jest.doMock('../../../../src/webview/utils/KeyboardShortcutManager', () => ({
        keyboardShortcutManager: {
          formatShortcut: jest.fn().mockImplementation(() => {
            throw new Error('Mock error');
          }),
          getShortcutsByCategory: jest.fn().mockReturnValue([]),
          addShortcut: jest.fn(),
          setShortcutEnabled: jest.fn(),
          removeShortcut: jest.fn()
        }
      }));

      jest.doMock('../../../../src/webview/utils/LayoutManager', () => ({
        layoutManager: {
          getCurrentLayout: jest.fn().mockImplementation(() => {
            throw new Error('Layout error');
          }),
          updateLayout: jest.fn(),
          updatePanelLayout: jest.fn(),
          updateWaveformState: jest.fn(),
          updateChannelVisibility: jest.fn(),
          saveCurrentLayout: jest.fn().mockReturnValue(false),
          getPresets: jest.fn().mockReturnValue([]),
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
        return tester.runAllTests();
      }).not.toThrow();
    });

    it('应该处理空的测试结果', () => {
      const { UIOptimizationTester } = require('../../../../src/webview/utils/UIOptimizationTester');
      
      const tester = new UIOptimizationTester();
      
      expect(() => {
        const results = tester.getTestResults();
        expect(typeof results).toBe('object');
      }).not.toThrow();
    });
  });

  describe('模块加载和初始化', () => {
    it('应该能够重复加载模块', () => {
      for (let i = 0; i < 3; i++) {
        expect(() => {
          require('../../../../src/webview/utils/KeyboardShortcutManager');
          require('../../../../src/webview/utils/LayoutManager');
          require('../../../../src/webview/utils/UIOptimizationTester');
        }).not.toThrow();
      }
    });

    it('应该处理DOM不存在的情况', () => {
      const originalDocument = global.document;
      // @ts-ignore
      delete global.document;
      
      try {
        expect(() => {
          require('../../../../src/webview/utils/KeyboardShortcutManager');
          require('../../../../src/webview/utils/LayoutManager');
        }).not.toThrow();
      } finally {
        global.document = originalDocument;
      }
    });

    it('应该处理window对象不存在的情况', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      try {
        expect(() => {
          require('../../../../src/webview/utils/LayoutManager');
        }).not.toThrow();
      } finally {
        global.window = originalWindow;
      }
    });
  });

  describe('性能和内存测试', () => {
    it('应该在合理时间内完成各种操作', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      const { layoutManager } = require('../../../../src/webview/utils/LayoutManager');
      
      const startTime = performance.now();
      
      // 执行各种操作
      for (let i = 0; i < 100; i++) {
        keyboardShortcutManager.formatShortcut(['Ctrl', `Key${i}`]);
        layoutManager.updateWaveformState({ zoomLevel: i, firstSample: i * 100, visibleSamples: 1000 });
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该能够处理大量的快捷键注册', () => {
      const { keyboardShortcutManager } = require('../../../../src/webview/utils/KeyboardShortcutManager');
      
      expect(() => {
        for (let i = 0; i < 50; i++) {
          keyboardShortcutManager.addShortcut({
            id: `test_${i}`,
            keys: ['Ctrl', `F${i % 12 + 1}`],
            description: `Test shortcut ${i}`,
            category: 'test',
            handler: () => console.log(`Handler ${i}`),
            enabled: true
          });
        }
      }).not.toThrow();
    });
  });
});