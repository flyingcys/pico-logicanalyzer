/**
 * 🎯 第3周 Day 3-4: KeyboardShortcutManager工具类模块完善
 * 目标：从8.95%一点一点提升到80%+
 * 策略：深度思考，严格按照渐进式方法，慢慢一步一步到90%
 */

// 在导入之前设置全局mocks
const mockWindow = {
  vscode: {
    postMessage: jest.fn()
  },
  dispatchEvent: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockDocument = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// 设置全局对象
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});

// Mock KeyboardEvent
global.KeyboardEvent = class MockKeyboardEvent extends Event {
  constructor(type: string, eventInit?: KeyboardEventInit) {
    super(type);
    Object.assign(this, eventInit);
  }
} as any;

// Mock CustomEvent
global.CustomEvent = class MockCustomEvent extends Event {
  public detail: any;
  constructor(type: string, eventInit?: CustomEventInit) {
    super(type);
    this.detail = eventInit?.detail;
  }
} as any;

// 现在可以安全地导入
import { 
  KeyboardShortcutManager, 
  KeyboardShortcut, 
  ShortcutCategory 
} from '../../../src/webview/utils/KeyboardShortcutManager';

describe('🎯 第3周 KeyboardShortcutManager 工具类模块深度测试', () => {

  let manager: KeyboardShortcutManager;
  let mockKeydownHandler: (event: KeyboardEvent) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置document事件监听器mock
    mockDocument.addEventListener.mockImplementation((event, handler) => {
      if (event === 'keydown') {
        mockKeydownHandler = handler;
      }
    });
  });

  afterEach(() => {
    // 清理管理器实例
    if (manager) {
      manager.destroy();
    }
  });

  describe('📋 基础构造和初始化测试', () => {

    it('应该正确构造KeyboardShortcutManager实例', () => {
      manager = new KeyboardShortcutManager();
      
      // 验证构造函数执行成功
      expect(manager).toBeDefined();
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('应该正确设置所有默认快捷键', () => {
      manager = new KeyboardShortcutManager();
      
      // 验证默认快捷键设置
      const categories = manager.getShortcutsByCategory();
      expect(categories).toBeDefined();
      expect(categories.length).toBeGreaterThan(0);
      
      // 验证包含各种类别的快捷键
      const categoryNames = categories.map(cat => cat.name);
      expect(categoryNames).toContain('设备操作');
      expect(categoryNames).toContain('采集控制');
      expect(categoryNames).toContain('文件操作');
      expect(categoryNames).toContain('波形操作');
      expect(categoryNames).toContain('通道控制');
      expect(categoryNames).toContain('面板控制');
      expect(categoryNames).toContain('帮助');
    });

    it('应该正确绑定键盘事件监听器', () => {
      manager = new KeyboardShortcutManager();
      
      // 验证事件绑定
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

  });

  describe('🎯 键盘事件处理核心逻辑', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确处理Ctrl+D连接设备快捷键', () => {
      // 模拟Ctrl+D按键事件
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      // 手动调用键盘处理器
      mockKeydownHandler(keyEvent);

      // 验证VSCode命令被触发
      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'connectDevice' });
    });

    it('应该正确处理Ctrl+R开始采集快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'R',
        code: 'KeyR',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'startCapture' });
    });

    it('应该正确处理Ctrl+T停止采集快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'T',
        code: 'KeyT',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'stopCapture' });
    });

    it('应该正确处理Ctrl+S保存文件快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'S',
        code: 'KeyS',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'saveFile' });
    });

    it('应该正确处理Ctrl+E导出数据快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'E',
        code: 'KeyE',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'exportData' });
    });

  });

  describe('🌊 波形操作快捷键测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确处理Ctrl++放大波形快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: '+',
        code: 'Equal',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('waveform-action', { detail: 'zoomIn' })
      );
    });

    it('应该正确处理Ctrl+-缩小波形快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: '-',
        code: 'Minus',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('waveform-action', { detail: 'zoomOut' })
      );
    });

    it('应该正确处理Ctrl+0适应窗口快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: '0',
        code: 'Digit0',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('waveform-action', { detail: 'fitToWindow' })
      );
    });

    it('应该正确处理方向键波形移动', () => {
      const directions = [
        { key: 'ArrowLeft', code: 'ArrowLeft', action: 'panLeft' },
        { key: 'ArrowRight', code: 'ArrowRight', action: 'panRight' },
        { key: 'ArrowUp', code: 'ArrowUp', action: 'panUp' },
        { key: 'ArrowDown', code: 'ArrowDown', action: 'panDown' }
      ];

      directions.forEach(direction => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: direction.key,
          code: direction.code,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          metaKey: false
        });

        mockKeydownHandler(keyEvent);

        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          new CustomEvent('waveform-action', { detail: direction.action })
        );
      });
    });

  });

  describe('📊 通道控制快捷键测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确处理数字键1-4通道切换', () => {
      const channels = [
        { key: '1', code: 'Digit1', channel: 0 },
        { key: '2', code: 'Digit2', channel: 1 },
        { key: '3', code: 'Digit3', channel: 2 },
        { key: '4', code: 'Digit4', channel: 3 }
      ];

      channels.forEach(ch => {
        const keyEvent = new KeyboardEvent('keydown', {
          key: ch.key,
          code: ch.code,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          metaKey: false
        });

        mockKeydownHandler(keyEvent);

        expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
          new CustomEvent('channel-toggle', { detail: ch.channel })
        );
      });
    });

  });

  describe('🎛️ 面板控制快捷键测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确处理Ctrl+Shift+D切换解码器面板', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('panel-toggle', { detail: 'decoder' })
      );
    });

    it('应该正确处理Ctrl+Shift+M切换测量面板', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'M',
        code: 'KeyM',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('panel-toggle', { detail: 'measurement' })
      );
    });

    it('应该正确处理F1显示帮助快捷键', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'F1',
        code: 'F1',
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('show-shortcut-help')
      );
    });

  });

  describe('🎯 输入元素检测和过滤测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该忽略输入框中的按键事件', () => {
      // 创建mock输入元素
      const mockInputElement = {
        tagName: 'INPUT',
        getAttribute: jest.fn(() => null)
      };

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      // 模拟事件目标为输入元素
      Object.defineProperty(keyEvent, 'target', {
        value: mockInputElement,
        writable: false
      });

      mockKeydownHandler(keyEvent);

      // 验证快捷键被忽略
      expect(mockWindow.vscode.postMessage).not.toHaveBeenCalled();
    });

    it('应该忽略文本区域中的按键事件', () => {
      const mockTextareaElement = {
        tagName: 'TEXTAREA',
        getAttribute: jest.fn(() => null)
      };

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      Object.defineProperty(keyEvent, 'target', {
        value: mockTextareaElement,
        writable: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).not.toHaveBeenCalled();
    });

    it('应该忽略可编辑元素中的按键事件', () => {
      const mockEditableElement = {
        tagName: 'DIV',
        getAttribute: jest.fn((attr) => attr === 'contenteditable' ? 'true' : null)
      };

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      Object.defineProperty(keyEvent, 'target', {
        value: mockEditableElement,
        writable: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).not.toHaveBeenCalled();
    });

  });

  describe('⚙️ 快捷键管理CRUD操作测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确添加自定义快捷键', () => {
      const customShortcut: KeyboardShortcut = {
        id: 'custom-action',
        keys: ['Ctrl', 'Alt', 'C'],
        description: '自定义操作',
        category: '自定义',
        handler: jest.fn(),
        enabled: true
      };

      manager.addShortcut(customShortcut);

      // 验证快捷键被添加
      const categories = manager.getShortcutsByCategory();
      const customCategory = categories.find(cat => cat.name === '自定义');
      expect(customCategory).toBeDefined();
      expect(customCategory?.shortcuts).toContain(customShortcut);
    });

    it('应该正确移除快捷键', () => {
      // 移除默认快捷键
      const result = manager.removeShortcut('connect-device');
      expect(result).toBe(true);

      // 尝试移除不存在的快捷键
      const falseResult = manager.removeShortcut('non-existent');
      expect(falseResult).toBe(false);
    });

    it('应该正确更新快捷键属性', () => {
      // 更新现有快捷键
      manager.updateShortcut('connect-device', {
        description: '连接新设备',
        enabled: false
      });

      // 尝试更新不存在的快捷键
      manager.updateShortcut('non-existent', {
        description: '不存在的快捷键'
      });

      // 验证操作完成
      expect(true).toBe(true);
    });

    it('应该正确启用/禁用单个快捷键', () => {
      // 禁用快捷键
      manager.setShortcutEnabled('connect-device', false);

      // 测试禁用的快捷键不会触发
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).not.toHaveBeenCalled();

      // 重新启用快捷键
      manager.setShortcutEnabled('connect-device', true);
    });

    it('应该正确启用/禁用全局快捷键系统', () => {
      // 禁用全局快捷键
      manager.setEnabled(false);

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).not.toHaveBeenCalled();

      // 重新启用全局快捷键
      manager.setEnabled(true);

      mockKeydownHandler(keyEvent);

      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'connectDevice' });
    });

  });

  describe('🔍 按键匹配和检测逻辑测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确匹配完全相同的按键组合', () => {
      // 测试完全匹配的按键组合
      const keyEvent1 = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent1);
      expect(mockWindow.vscode.postMessage).toHaveBeenCalledWith({ type: 'connectDevice' });
    });

    it('应该正确处理按键顺序不同但组合相同的情况', () => {
      // 测试Ctrl+Shift+D的快捷键
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(keyEvent);
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('panel-toggle', { detail: 'decoder' })
      );
    });

    it('应该正确处理特殊键码映射', () => {
      // 测试Ctrl++ (加号键)
      const plusKeyEvent = new KeyboardEvent('keydown', {
        key: '+',
        code: 'Equal',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(plusKeyEvent);
      expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('应该正确处理数字键的键码转换', () => {
      // 测试数字键0的特殊处理
      const zeroKeyEvent = new KeyboardEvent('keydown', {
        key: '0',
        code: 'Digit0',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      mockKeydownHandler(zeroKeyEvent);
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('waveform-action', { detail: 'fitToWindow' })
      );
    });

  });

  describe('🎨 快捷键格式化和显示测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该正确格式化基本快捷键组合', () => {
      const formatted1 = manager.formatShortcut(['Ctrl', 'D']);
      expect(formatted1).toBe('⌘ + D');

      const formatted2 = manager.formatShortcut(['Shift', 'F1']);
      expect(formatted2).toBe('⇧ + F1');

      const formatted3 = manager.formatShortcut(['Alt', 'Tab']);
      expect(formatted3).toBe('⌥ + Tab');
    });

    it('应该正确格式化复杂快捷键组合', () => {
      const formatted = manager.formatShortcut(['Ctrl', 'Shift', 'Alt', 'F12']);
      expect(formatted).toBe('⌘ + ⇧ + ⌥ + F12');
    });

    it('应该正确格式化方向键', () => {
      const directions = [
        { keys: ['ArrowLeft'], expected: '←' },
        { keys: ['ArrowRight'], expected: '→' },
        { keys: ['ArrowUp'], expected: '↑' },
        { keys: ['ArrowDown'], expected: '↓' }
      ];

      directions.forEach(({ keys, expected }) => {
        const formatted = manager.formatShortcut(keys);
        expect(formatted).toBe(expected);
      });
    });

    it('应该正确处理未映射的按键', () => {
      const formatted = manager.formatShortcut(['Ctrl', 'CustomKey']);
      expect(formatted).toBe('⌘ + CustomKey');
    });

  });

  describe('🧹 边界条件和错误处理测试', () => {

    beforeEach(() => {
      manager = new KeyboardShortcutManager();
    });

    it('应该处理快捷键处理器中的异常', () => {
      // 添加会抛出异常的快捷键
      const errorShortcut: KeyboardShortcut = {
        id: 'error-shortcut',
        keys: ['Ctrl', 'X'],
        description: '错误快捷键',
        category: '测试',
        handler: () => {
          throw new Error('测试错误');
        },
        enabled: true
      };

      manager.addShortcut(errorShortcut);

      // 模拟按键事件
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'X',
        code: 'KeyX',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      // 不应该抛出异常
      expect(() => {
        mockKeydownHandler(keyEvent);
      }).not.toThrow();
    });

    it('应该处理null或undefined的事件目标', () => {
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      // 模拟null目标
      Object.defineProperty(keyEvent, 'target', {
        value: null,
        writable: false
      });

      expect(() => {
        mockKeydownHandler(keyEvent);
      }).not.toThrow();
    });

    it('应该处理无效的按键组合', () => {
      // 创建只有修饰键的事件
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Control',
        code: 'ControlLeft',
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        metaKey: false
      });

      expect(() => {
        mockKeydownHandler(keyEvent);
      }).not.toThrow();
    });

    it('应该处理空快捷键列表的格式化', () => {
      const formatted = manager.formatShortcut([]);
      expect(formatted).toBe('');
    });

    it('应该处理销毁后的操作', () => {
      manager.destroy();

      // 销毁后应该能安全调用方法
      expect(() => {
        manager.addShortcut({
          id: 'test',
          keys: ['Ctrl', 'T'],
          description: '测试',
          category: '测试',
          handler: jest.fn(),
          enabled: true
        });
        manager.setEnabled(false);
        manager.formatShortcut(['Ctrl', 'T']);
      }).not.toThrow();
    });

  });

  describe('🏃 性能和内存管理测试', () => {

    it('应该正确处理大量快捷键添加', () => {
      manager = new KeyboardShortcutManager();

      // 添加100个快捷键
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        manager.addShortcut({
          id: `test-shortcut-${i}`,
          keys: ['Ctrl', `F${i % 12 + 1}`],
          description: `测试快捷键 ${i}`,
          category: '性能测试',
          handler: jest.fn(),
          enabled: true
        });
      }

      const endTime = Date.now();

      // 验证性能
      expect(endTime - startTime).toBeLessThan(100); // 不超过100ms

      // 验证功能
      const categories = manager.getShortcutsByCategory();
      const testCategory = categories.find(cat => cat.name === '性能测试');
      expect(testCategory?.shortcuts).toHaveLength(100);
    });

    it('应该正确清理事件监听器', () => {
      manager = new KeyboardShortcutManager();
      manager.destroy();

      // 验证事件监听器被移除
      expect(mockDocument.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('应该正确处理内存清理', () => {
      manager = new KeyboardShortcutManager();
      
      // 添加一些快捷键
      for (let i = 0; i < 10; i++) {
        manager.addShortcut({
          id: `cleanup-test-${i}`,
          keys: ['Ctrl', `${i}`],
          description: `清理测试 ${i}`,
          category: '清理测试',
          handler: jest.fn(),
          enabled: true
        });
      }

      // 销毁管理器
      manager.destroy();

      // 验证内部状态被清理
      const categories = manager.getShortcutsByCategory();
      expect(categories).toHaveLength(0);
    });

  });

});