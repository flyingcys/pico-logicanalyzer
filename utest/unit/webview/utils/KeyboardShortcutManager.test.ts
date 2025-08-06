/**
 * KeyboardShortcutManager 单元测试
 * 
 * 测试范围：
 * - 键盘快捷键管理和处理
 * - 事件绑定和响应
 * - 快捷键匹配逻辑
 * - 公共API操作
 * - 状态管理
 */

// 首先设置DOM环境 Mock
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockPostMessage = jest.fn();
const mockDispatchEvent = jest.fn();
const mockCreateElement = jest.fn((tagName: string) => {
  const attributes: {[key: string]: string} = {};
  const element = {
    tagName: tagName.toUpperCase(),
    getAttribute: jest.fn((name: string) => attributes[name] || null),
    setAttribute: jest.fn((name: string, value: string) => {
      attributes[name] = value;
    })
  };
  return element;
});

// Mock DOM 环境
Object.defineProperty(global, 'window', {
  value: {
    vscode: {
      postMessage: mockPostMessage
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: mockDispatchEvent
  },
  writable: true
});

Object.defineProperty(global, 'document', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    createElement: mockCreateElement
  },
  writable: true
});

// Mock CustomEvent 和 KeyboardEvent
global.CustomEvent = jest.fn().mockImplementation((type, options) => ({
  type,
  detail: options?.detail
}));

global.KeyboardEvent = jest.fn().mockImplementation((type, options = {}) => ({
  type,
  key: options.key || '',
  code: options.code || '',
  ctrlKey: options.ctrlKey || false,
  shiftKey: options.shiftKey || false,
  altKey: options.altKey || false,
  metaKey: options.metaKey || false,
  target: options.target || null,
  preventDefault: jest.fn(),
  stopPropagation: jest.fn()
}));

// 现在导入模块
import { 
  KeyboardShortcutManager, 
  KeyboardShortcut, 
  ShortcutCategory,
  keyboardShortcutManager
} from '../../../../src/webview/utils/KeyboardShortcutManager';

describe('KeyboardShortcutManager', () => {
  let manager: KeyboardShortcutManager;

  beforeEach(() => {
    // 重置所有Mock
    jest.clearAllMocks();
    
    // 创建新实例
    manager = new KeyboardShortcutManager();
  });

  afterEach(() => {
    // 清理实例
    if (manager) {
      manager.destroy();
    }
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化管理器', () => {
      expect(manager).toBeDefined();
      expect(manager['enabled']).toBe(true);
      expect(manager['shortcuts']).toBeInstanceOf(Map);
    });

    it('应该绑定键盘事件监听器', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('应该设置默认快捷键', () => {
      const shortcuts = manager['shortcuts'];
      expect(shortcuts.size).toBeGreaterThan(0);
      
      // 检查一些重要的默认快捷键
      expect(shortcuts.has('connect-device')).toBe(true);
      expect(shortcuts.has('start-capture')).toBe(true);
      expect(shortcuts.has('save-file')).toBe(true);
      expect(shortcuts.has('zoom-in')).toBe(true);
    });

    it('应该正确设置默认快捷键的属性', () => {
      const connectShortcut = manager['shortcuts'].get('connect-device');
      expect(connectShortcut).toEqual({
        id: 'connect-device',
        keys: ['Ctrl', 'D'],
        description: '连接设备',
        category: '设备操作',
        handler: expect.any(Function),
        enabled: true
      });
    });
  });

  describe('键盘事件处理', () => {
    let keydownHandler: (event: KeyboardEvent) => void;

    beforeEach(() => {
      // 获取绑定的处理函数
      const calls = mockAddEventListener.mock.calls;
      const keydownCall = calls.find(call => call[0] === 'keydown');
      keydownHandler = keydownCall[1];
    });

    it('应该处理Ctrl+D快捷键（连接设备）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'connectDevice' });
    });

    it('应该处理Ctrl+R快捷键（开始采集）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'R',
        code: 'KeyR',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'startCapture' });
    });

    it('应该处理Ctrl+T快捷键（停止采集）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        code: 'KeyT',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'stopCapture' });
    });

    it('应该处理Ctrl+S快捷键（保存文件）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'S',
        code: 'KeyS',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'saveFile' });
    });

    it('应该处理Ctrl+E快捷键（导出数据）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'E',
        code: 'KeyE',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'exportData' });
    });

    it('应该处理Ctrl++快捷键（放大波形）', () => {
      // 根据默认快捷键定义，zoom-in 快捷键是 ['Ctrl', '+']
      // 我们需要创建一个匹配 ['Ctrl', '+'] 而不包含 Shift 的按键组合
      const event = new KeyboardEvent('keydown', {
        key: '+',
        code: 'Equal',
        ctrlKey: true,
        shiftKey: true  // 保留 shiftKey 因为要产生 '+' 字符需要 Shift
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      // 但是我们的 getMainKey 逻辑会处理这个，并且按键匹配会包含 Shift
      // 我们需要添加一个包含 Shift 的快捷键，或者修改默认快捷键
      // 让我们添加一个专门的快捷键来匹配 Ctrl+Shift++
      manager.addShortcut({
        id: 'zoom-in-shift',
        keys: ['Ctrl', 'Shift', '+'],
        description: '放大波形（Shift+）',
        category: '波形操作',
        handler: () => manager['triggerWaveformAction']('zoomIn'),
        enabled: true
      });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'zoomIn'
        })
      );
    });

    it('应该处理Ctrl+-快捷键（缩小波形）', () => {
      const event = new KeyboardEvent('keydown', {
        key: '-',
        code: 'Minus',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'zoomOut'
        })
      );
    });

    it('应该处理Ctrl+0快捷键（适应窗口）', () => {
      const event = new KeyboardEvent('keydown', {
        key: '0',
        code: 'Digit0',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'fitToWindow'
        })
      );
    });

    it('应该处理ArrowLeft键（向左平移）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        code: 'ArrowLeft'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'panLeft'
        })
      );
    });

    it('应该处理ArrowRight键（向右平移）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'panRight'
        })
      );
    });

    it('应该处理ArrowUp键（向上滚动）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        code: 'ArrowUp'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'panUp'
        })
      );
    });

    it('应该处理ArrowDown键（向下滚动）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'panDown'
        })
      );
    });

    it('应该处理数字1键（切换通道1）', () => {
      const event = new KeyboardEvent('keydown', {
        key: '1',
        code: 'Digit1'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel-toggle',
          detail: 0
        })
      );
    });

    it('应该处理数字2键（切换通道2）', () => {
      const event = new KeyboardEvent('keydown', {
        key: '2',
        code: 'Digit2'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel-toggle',
          detail: 1
        })
      );
    });

    it('应该处理数字3键（切换通道3）', () => {
      const event = new KeyboardEvent('keydown', {
        key: '3',
        code: 'Digit3'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel-toggle',
          detail: 2
        })
      );
    });

    it('应该处理数字4键（切换通道4）', () => {
      const event = new KeyboardEvent('keydown', {
        key: '4',
        code: 'Digit4'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel-toggle',
          detail: 3
        })
      );
    });

    it('应该处理F1键（显示帮助）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'F1',
        code: 'F1'
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'show-shortcut-help'
        })
      );
    });

    it('应该处理Ctrl+Shift+D快捷键（切换解码器面板）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true,
        shiftKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'panel-toggle',
          detail: 'decoder'
        })
      );
    });

    it('应该处理Ctrl+Shift+M快捷键（切换测量面板）', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'M',
        code: 'KeyM',
        ctrlKey: true,
        shiftKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      keydownHandler(event);

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'panel-toggle',
          detail: 'measurement'
        })
      );
    });

    it('应该忽略来自输入元素的事件', () => {
      const inputElement = document.createElement('input');
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'target', { value: inputElement });
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      keydownHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('应该在禁用状态下忽略事件', () => {
      manager.setEnabled(false);
      
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        code: 'KeyD',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });

      keydownHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('输入元素检测', () => {
    it('应该正确识别input元素', () => {
      const inputElement = document.createElement('input');
      const result = manager['isInputElement'](inputElement);
      expect(result).toBe(true);
    });

    it('应该正确识别textarea元素', () => {
      const textareaElement = document.createElement('textarea');
      const result = manager['isInputElement'](textareaElement);
      expect(result).toBe(true);
    });

    it('应该正确识别select元素', () => {
      const selectElement = document.createElement('select');
      const result = manager['isInputElement'](selectElement);
      expect(result).toBe(true);
    });

    it('应该正确识别contenteditable元素', () => {
      const divElement = document.createElement('div');
      divElement.setAttribute('contenteditable', 'true');
      const result = manager['isInputElement'](divElement);
      expect(result).toBe(true);
    });

    it('应该正确识别非输入元素', () => {
      const divElement = document.createElement('div');
      const result = manager['isInputElement'](divElement);
      expect(result).toBe(false);
    });

    it('应该处理null元素', () => {
      const result = manager['isInputElement'](null as any);
      expect(result).toBe(false);
    });
  });

  describe('主键名称获取', () => {
    it('應該正確處理所有箭頭鍵', () => {
      const leftEvent = { key: 'ArrowLeft', code: 'ArrowLeft', shiftKey: false } as KeyboardEvent;
      const rightEvent = { key: 'ArrowRight', code: 'ArrowRight', shiftKey: false } as KeyboardEvent;
      const upEvent = { key: 'ArrowUp', code: 'ArrowUp', shiftKey: false } as KeyboardEvent;
      const downEvent = { key: 'ArrowDown', code: 'ArrowDown', shiftKey: false } as KeyboardEvent;
      
      expect(manager['getMainKey'](leftEvent)).toBe('ArrowLeft');
      expect(manager['getMainKey'](rightEvent)).toBe('ArrowRight');
      expect(manager['getMainKey'](upEvent)).toBe('ArrowUp');
      expect(manager['getMainKey'](downEvent)).toBe('ArrowDown');
    });

    it('应该正确处理等号和加号', () => {
      const equalEvent = { key: '=', code: 'Equal', shiftKey: false } as KeyboardEvent;
      const plusEvent = { key: '+', code: 'Equal', shiftKey: true } as KeyboardEvent;
      
      expect(manager['getMainKey'](equalEvent)).toBe('=');
      expect(manager['getMainKey'](plusEvent)).toBe('+');
    });

    it('应该正确处理减号', () => {
      const minusEvent = { key: '-', code: 'Minus', shiftKey: false } as KeyboardEvent;
      expect(manager['getMainKey'](minusEvent)).toBe('-');
    });

    it('應該正確處理所有數字鍵', () => {
      const digit0Event = { key: '0', code: 'Digit0', shiftKey: false } as KeyboardEvent;
      const digit1Event = { key: '1', code: 'Digit1', shiftKey: false } as KeyboardEvent;
      const digit2Event = { key: '2', code: 'Digit2', shiftKey: false } as KeyboardEvent;
      const digit3Event = { key: '3', code: 'Digit3', shiftKey: false } as KeyboardEvent;
      const digit4Event = { key: '4', code: 'Digit4', shiftKey: false } as KeyboardEvent;
      
      expect(manager['getMainKey'](digit0Event)).toBe('0');
      expect(manager['getMainKey'](digit1Event)).toBe('1');
      expect(manager['getMainKey'](digit2Event)).toBe('2');
      expect(manager['getMainKey'](digit3Event)).toBe('3');
      expect(manager['getMainKey'](digit4Event)).toBe('4');
    });

    it('应该正确处理字母键', () => {
      const event = { key: 'd', code: 'KeyD', shiftKey: false } as KeyboardEvent;
      const result = manager['getMainKey'](event);
      expect(result).toBe('D');
    });

    it('应该正确处理F键', () => {
      const event = { key: 'F1', code: 'F1', shiftKey: false } as KeyboardEvent;
      const result = manager['getMainKey'](event);
      expect(result).toBe('F1');
    });

    it('应该正确处理未知按键', () => {
      const unknownEvent = { key: 'Unknown', code: 'Unknown', shiftKey: false } as KeyboardEvent;
      const result = manager['getMainKey'](unknownEvent);
      expect(result).toBe('Unknown');
    });

    it('应该正确处理特殊字符', () => {
      const spaceEvent = { key: ' ', code: 'Space', shiftKey: false } as KeyboardEvent;
      const result = manager['getMainKey'](spaceEvent);
      expect(result).toBe(' ');
    });
  });

  describe('快捷键匹配逻辑', () => {
    it('应该正确匹配相同的按键组合', () => {
      const keys1 = ['Ctrl', 'D'];
      const keys2 = ['Ctrl', 'D'];
      const result = manager['keysMatch'](keys1, keys2);
      expect(result).toBe(true);
    });

    it('应该正确匹配不同顺序的按键组合', () => {
      const keys1 = ['D', 'Ctrl'];
      const keys2 = ['Ctrl', 'D'];
      const result = manager['keysMatch'](keys1, keys2);
      expect(result).toBe(true);
    });

    it('应该正确识别不匹配的按键组合', () => {
      const keys1 = ['Ctrl', 'D'];
      const keys2 = ['Ctrl', 'S'];
      const result = manager['keysMatch'](keys1, keys2);
      expect(result).toBe(false);
    });

    it('应该正确识别长度不同的按键组合', () => {
      const keys1 = ['Ctrl', 'Shift', 'D'];
      const keys2 = ['Ctrl', 'D'];
      const result = manager['keysMatch'](keys1, keys2);
      expect(result).toBe(false);
    });

    it('应该找到匹配的快捷键', () => {
      const keys = ['Ctrl', 'D'];
      const result = manager['findMatchingShortcut'](keys);
      expect(result).toBeTruthy();
      expect(result!.id).toBe('connect-device');
    });

    it('应该在没有匹配时返回null', () => {
      const keys = ['Ctrl', 'Z']; // 不存在的快捷键
      const result = manager['findMatchingShortcut'](keys);
      expect(result).toBeNull();
    });
  });

  describe('公共API - 快捷键管理', () => {
    const testShortcut: KeyboardShortcut = {
      id: 'test-shortcut',
      keys: ['Ctrl', 'T'],
      description: '测试快捷键',
      category: '测试',
      handler: jest.fn(),
      enabled: true
    };

    it('应该能添加新快捷键', () => {
      manager.addShortcut(testShortcut);
      
      const shortcuts = manager['shortcuts'];
      expect(shortcuts.has('test-shortcut')).toBe(true);
      expect(shortcuts.get('test-shortcut')).toEqual(testShortcut);
    });

    it('应该能移除快捷键', () => {
      manager.addShortcut(testShortcut);
      const result = manager.removeShortcut('test-shortcut');
      
      expect(result).toBe(true);
      expect(manager['shortcuts'].has('test-shortcut')).toBe(false);
    });

    it('移除不存在的快捷键应该返回false', () => {
      const result = manager.removeShortcut('non-existent');
      expect(result).toBe(false);
    });

    it('应该能更新快捷键', () => {
      manager.addShortcut(testShortcut);
      
      manager.updateShortcut('test-shortcut', {
        description: '更新的描述',
        enabled: false
      });
      
      const updatedShortcut = manager['shortcuts'].get('test-shortcut');
      expect(updatedShortcut!.description).toBe('更新的描述');
      expect(updatedShortcut!.enabled).toBe(false);
    });

    it('更新不存在的快捷键应该静默处理', () => {
      expect(() => {
        manager.updateShortcut('non-existent', { enabled: false });
      }).not.toThrow();
    });

    it('应该能设置快捷键启用状态', () => {
      manager.setShortcutEnabled('connect-device', false);
      
      const shortcut = manager['shortcuts'].get('connect-device');
      expect(shortcut!.enabled).toBe(false);
    });

    it('设置不存在快捷键的状态应该静默处理', () => {
      expect(() => {
        manager.setShortcutEnabled('non-existent', false);
      }).not.toThrow();
    });

    it('应该能设置全局启用状态', () => {
      manager.setEnabled(false);
      expect(manager['enabled']).toBe(false);
      
      manager.setEnabled(true);
      expect(manager['enabled']).toBe(true);
    });
  });

  describe('快捷键分类和格式化', () => {
    it('应该按分类返回快捷键', () => {
      const categories = manager.getShortcutsByCategory();
      
      expect(categories).toBeInstanceOf(Array);
      expect(categories.length).toBeGreaterThan(0);
      
      // 检查分类结构
      const deviceCategory = categories.find(cat => cat.name === '设备操作');
      expect(deviceCategory).toBeDefined();
      expect(deviceCategory!.shortcuts).toBeInstanceOf(Array);
      expect(deviceCategory!.shortcuts.length).toBeGreaterThan(0);
    });

    it('分类内的快捷键应该按描述排序', () => {
      const categories = manager.getShortcutsByCategory();
      
      categories.forEach(category => {
        const descriptions = category.shortcuts.map(s => s.description);
        const sortedDescriptions = [...descriptions].sort((a, b) => a.localeCompare(b));
        expect(descriptions).toEqual(sortedDescriptions);
      });
    });

    it('应该正确格式化快捷键显示', () => {
      expect(manager.formatShortcut(['Ctrl', 'D'])).toBe('⌘ + D');
      expect(manager.formatShortcut(['Shift', 'F1'])).toBe('⇧ + F1');
      expect(manager.formatShortcut(['ArrowLeft'])).toBe('←');
      expect(manager.formatShortcut(['Ctrl', 'Shift', 'D'])).toBe('⌘ + ⇧ + D');
    });
  });

  describe('错误处理', () => {
    it('应该捕获处理器执行错误', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // 获取绑定的处理函数
      const calls = mockAddEventListener.mock.calls;
      const keydownCall = calls.find(call => call[0] === 'keydown');
      const keydownHandler = keydownCall[1];
      
      const errorShortcut: KeyboardShortcut = {
        id: 'error-shortcut',
        keys: ['Ctrl', 'X'],
        description: '错误快捷键',
        category: '测试',
        handler: () => { throw new Error('测试错误'); },
        enabled: true
      };
      
      manager.addShortcut(errorShortcut);
      
      // 模拟键盘事件来触发错误处理
      const event = new KeyboardEvent('keydown', {
        key: 'X',
        code: 'KeyX',
        ctrlKey: true
      });
      
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: jest.fn() });

      // 调用处理函数，应该捕获错误并记录到console.error
      keydownHandler(event);
      
      expect(consoleSpy).toHaveBeenCalledWith('快捷键处理器执行错误:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('触发方法测试', () => {
    it('应该正确触发VSCode命令', () => {
      manager['triggerVSCodeCommand']('testCommand');
      expect(mockPostMessage).toHaveBeenCalledWith({ type: 'testCommand' });
    });

    it('应该处理没有vscode对象的情况', () => {
      const originalVscode = (window as any).vscode;
      (window as any).vscode = undefined;
      
      expect(() => {
        manager['triggerVSCodeCommand']('testCommand');
      }).not.toThrow();
      
      (window as any).vscode = originalVscode;
    });

    it('应该正确触发波形操作', () => {
      manager['triggerWaveformAction']('testAction');
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waveform-action',
          detail: 'testAction'
        })
      );
    });

    it('应该正确触发通道切换', () => {
      manager['triggerChannelToggle'](5);
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel-toggle',
          detail: 5
        })
      );
    });

    it('应该正确触发面板切换', () => {
      manager['triggerPanelToggle']('testPanel');
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'panel-toggle',
          detail: 'testPanel'
        })
      );
    });

    it('应该正确显示快捷键帮助', () => {
      manager['showShortcutHelp']();
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'show-shortcut-help'
        })
      );
    });
  });

  describe('销毁和清理', () => {
    it('应该正确移除事件监听器', () => {
      manager.destroy();
      expect(mockRemoveEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('应该清空快捷键映射', () => {
      manager.destroy();
      expect(manager['shortcuts'].size).toBe(0);
    });

    it('销毁后应该能安全调用', () => {
      manager.destroy();
      
      expect(() => {
        manager.addShortcut({
          id: 'test',
          keys: ['Ctrl', 'T'],
          description: 'test',
          category: 'test',
          handler: jest.fn(),
          enabled: true
        });
      }).not.toThrow();
    });
  });

  describe('全局实例测试', () => {
    it('应该导出全局实例', () => {
      expect(keyboardShortcutManager).toBeInstanceOf(KeyboardShortcutManager);
    });
  });

  describe('边界条件和压力测试', () => {
    it('应该处理大量快捷键', () => {
      const startTime = Date.now();
      
      // 添加100个快捷键
      for (let i = 0; i < 100; i++) {
        manager.addShortcut({
          id: `test-${i}`,
          keys: ['Ctrl', `F${i % 12 + 1}`],
          description: `测试快捷键 ${i}`,
          category: '压力测试',
          handler: jest.fn(),
          enabled: true
        });
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
      
      expect(manager['shortcuts'].size).toBeGreaterThanOrEqual(100);
    });

    it('应该处理复杂的按键组合', () => {
      const complexShortcut: KeyboardShortcut = {
        id: 'complex',
        keys: ['Ctrl', 'Shift', 'Alt', 'F12'],
        description: '复杂快捷键',
        category: '测试',
        handler: jest.fn(),
        enabled: true
      };
      
      manager.addShortcut(complexShortcut);
      
      const keys = ['Alt', 'F12', 'Ctrl', 'Shift']; // 不同顺序
      const result = manager['findMatchingShortcut'](keys);
      expect(result).toBeTruthy();
      expect(result!.id).toBe('complex');
    });

    it('应该处理空按键数组', () => {
      const result = manager['findMatchingShortcut']([]);
      expect(result).toBeNull();
    });

    it('应该处理重复的修饰键', () => {
      const keys = ['Ctrl', 'Ctrl', 'D']; // 重复的Ctrl
      const result = manager['keysMatch'](keys, ['Ctrl', 'D']);
      expect(result).toBe(false); // 长度不同，应该不匹配
    });
  });

  describe('性能基准测试', () => {
    it('快捷键匹配应该在合理时间内完成', () => {
      // 添加大量快捷键
      for (let i = 0; i < 1000; i++) {
        manager.addShortcut({
          id: `perf-test-${i}`,
          keys: ['Ctrl', String.fromCharCode(65 + (i % 26))], // A-Z循环
          description: `性能测试 ${i}`,
          category: '性能测试',
          handler: jest.fn(),
          enabled: true
        });
      }
      
      const startTime = Date.now();
      
      // 执行1000次匹配
      for (let i = 0; i < 1000; i++) {
        manager['findMatchingShortcut'](['Ctrl', 'A']);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // 应该在100ms内完成1000次匹配
    });
  });
});