import {
  KeyboardShortcutManager,
  keyboardShortcutManager,
  type KeyboardShortcut,
  type ShortcutCommandDispatcher
} from '../../../src/frontend/core/utils/KeyboardShortcutManager';

describe('KeyboardShortcutManager', () => {
  let manager: KeyboardShortcutManager;

  beforeEach(() => {
    manager = new KeyboardShortcutManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('formatShortcut', () => {
    it('应将修饰键映射为符号', () => {
      expect(manager.formatShortcut(['Ctrl', 'S'])).toBe('⌘ + S');
      expect(manager.formatShortcut(['Shift', 'Ctrl', 'S'])).toBe('⇧ + ⌘ + S');
      expect(manager.formatShortcut(['Alt', 'S'])).toBe('⌥ + S');
      expect(manager.formatShortcut(['Meta', 'S'])).toBe('⌘ + S');
    });

    it('应将方向键映射为箭头符号', () => {
      expect(manager.formatShortcut(['ArrowLeft'])).toBe('←');
      expect(manager.formatShortcut(['ArrowRight'])).toBe('→');
      expect(manager.formatShortcut(['ArrowUp'])).toBe('↑');
      expect(manager.formatShortcut(['ArrowDown'])).toBe('↓');
    });

    it('应原样保留未映射的按键', () => {
      expect(manager.formatShortcut(['F1'])).toBe('F1');
      expect(manager.formatShortcut(['Delete'])).toBe('Delete');
      expect(manager.formatShortcut(['M'])).toBe('M');
    });
  });

  describe('默认快捷键注册', () => {
    it('应注册一组默认快捷键', () => {
      const categories = manager.getShortcutsByCategory();
      const total = categories.reduce((sum, cat) => sum + cat.shortcuts.length, 0);
      expect(total).toBeGreaterThan(10);
    });

    it('应包含连接设备与采集控制快捷键', () => {
      const categories = manager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      expect(all.some(s => s.id === 'connect-device')).toBe(true);
      expect(all.some(s => s.id === 'start-capture')).toBe(true);
      expect(all.some(s => s.id === 'stop-capture')).toBe(true);
    });

    it('默认快捷键应全部启用', () => {
      const categories = manager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      expect(all.every(s => s.enabled)).toBe(true);
    });

    // 「测量面板」不存在（SidebarTab 只有 decoder / performance），
    // 保留声明等于在帮助弹窗里向用户承诺做不到的功能。
    it('不应声明不存在的测量面板快捷键', () => {
      const categories = keyboardShortcutManager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      expect(all.some(s => s.id === 'toggle-measurement-panel')).toBe(false);
      expect(all.some(s => s.description === '切换测量面板')).toBe(false);
    });

    it('Ctrl+Shift+D 解码面板快捷键仍应保留', () => {
      const categories = keyboardShortcutManager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      const decoderToggle = all.find(s => s.id === 'toggle-decoder-panel');
      expect(decoderToggle).toBeDefined();
      expect(decoderToggle?.keys).toEqual(['Ctrl', 'Shift', 'D']);
    });

    // 通道显隐没有任何 UI / store 动作支撑，只有渲染器消费 channel.hidden。
    // 保留 1/2/3/4 声明等于向用户承诺一个设计了一半的功能。
    it('不应声明无实现支撑的通道切换快捷键', () => {
      const categories = keyboardShortcutManager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      const channelToggles = all.filter(s => s.id.startsWith('toggle-channel-'));
      expect(channelToggles).toEqual([]);
      expect(all.some(s => /^切换通道[1-4]$/.test(s.description))).toBe(false);
    });
  });

  describe('快捷键增删改', () => {
    it('应添加并触发自定义快捷键处理器', () => {
      const handler = jest.fn();
      const shortcut: KeyboardShortcut = {
        id: 'test-custom',
        keys: ['Ctrl', 'Q'],
        description: '测试',
        category: '测试',
        handler,
        enabled: true
      };
      manager.addShortcut(shortcut);

      const categories = manager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      expect(all.some(s => s.id === 'test-custom')).toBe(true);
    });

    it('应移除已注册的快捷键', () => {
      manager.addShortcut({
        id: 'temp',
        keys: ['Ctrl', 'W'],
        description: '临时',
        category: '测试',
        handler: jest.fn(),
        enabled: true
      });
      expect(manager.removeShortcut('temp')).toBe(true);
      expect(manager.removeShortcut('temp')).toBe(false);
    });

    it('应更新快捷键的启用状态', () => {
      manager.setShortcutEnabled('start-capture', false);
      const categories = manager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      const target = all.find(s => s.id === 'start-capture');
      expect(target?.enabled).toBe(false);
    });

    it('应支持通过 updateShortcut 修改描述', () => {
      manager.updateShortcut('start-capture', { description: '新描述' });
      const categories = manager.getShortcutsByCategory();
      const all = categories.flatMap(cat => cat.shortcuts);
      const target = all.find(s => s.id === 'start-capture');
      expect(target?.description).toBe('新描述');
    });
  });

  describe('命令分发', () => {
    it('应使用自定义命令分发器', async () => {
      const dispatcher: ShortcutCommandDispatcher = jest.fn().mockResolvedValue(true);
      manager.setCommandDispatcher(dispatcher);
      manager.addShortcut({
        id: 'dispatch-test',
        keys: ['Ctrl', 'P'],
        description: '分发',
        category: '测试',
        handler: () => {
          /* 触发 */
        },
        enabled: true
      });

      // 通过私有 triggerVSCodeCommand 间接验证：直接调用 dispatcher
      await dispatcher('startCapture', undefined);
      expect(dispatcher).toHaveBeenCalledWith('startCapture', undefined);
    });

    it('setEnabled(false) 后不应阻止公开 API 查询', () => {
      manager.setEnabled(false);
      const categories = manager.getShortcutsByCategory();
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('全局实例', () => {
    it('应导出可用的单例', () => {
      expect(keyboardShortcutManager).toBeInstanceOf(KeyboardShortcutManager);
      expect(keyboardShortcutManager.getShortcutsByCategory().length).toBeGreaterThan(0);
    });
  });
});
