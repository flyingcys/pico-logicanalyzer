/**
 * 键盘快捷键管理器
 * 提供全局快捷键支持，增强用户交互体验
 */

export interface KeyboardShortcut {
  id: string;
  keys: string[]; // 组合键，如 ['Ctrl', 'S']
  description: string;
  category: string;
  handler: () => void;
  enabled: boolean;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: KeyboardShortcut[];
}

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private keydownHandler: (_event: KeyboardEvent) => void;
  private enabled = true;

  constructor() {
    this.keydownHandler = this.handleKeydown.bind(this);
    this.setupDefaultShortcuts();
    this.bindEvents();
  }

  /**
   * 设置默认快捷键
   */
  private setupDefaultShortcuts() {
    const defaultShortcuts: KeyboardShortcut[] = [
      {
        id: 'connect-device',
        keys: ['Ctrl', 'D'],
        description: '连接设备',
        category: '设备操作',
        handler: () => this.triggerVSCodeCommand('connectDevice'),
        enabled: true
      },
      {
        id: 'start-capture',
        keys: ['Ctrl', 'R'],
        description: '开始采集',
        category: '采集控制',
        handler: () => this.triggerVSCodeCommand('startCapture'),
        enabled: true
      },
      {
        id: 'stop-capture',
        keys: ['Ctrl', 'T'],
        description: '停止采集',
        category: '采集控制',
        handler: () => this.triggerVSCodeCommand('stopCapture'),
        enabled: true
      },
      {
        id: 'save-file',
        keys: ['Ctrl', 'S'],
        description: '保存文件',
        category: '文件操作',
        handler: () => this.triggerVSCodeCommand('saveFile'),
        enabled: true
      },
      {
        id: 'export-data',
        keys: ['Ctrl', 'E'],
        description: '导出数据',
        category: '文件操作',
        handler: () => this.triggerVSCodeCommand('exportData'),
        enabled: true
      },
      {
        id: 'zoom-in',
        keys: ['Ctrl', '+'],
        description: '放大波形',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('zoomIn'),
        enabled: true
      },
      {
        id: 'zoom-out',
        keys: ['Ctrl', '-'],
        description: '缩小波形',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('zoomOut'),
        enabled: true
      },
      {
        id: 'fit-window',
        keys: ['Ctrl', '0'],
        description: '适应窗口',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('fitToWindow'),
        enabled: true
      },
      {
        id: 'pan-left',
        keys: ['ArrowLeft'],
        description: '向左移动',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('panLeft'),
        enabled: true
      },
      {
        id: 'pan-right',
        keys: ['ArrowRight'],
        description: '向右移动',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('panRight'),
        enabled: true
      },
      {
        id: 'pan-up',
        keys: ['ArrowUp'],
        description: '向上滚动',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('panUp'),
        enabled: true
      },
      {
        id: 'pan-down',
        keys: ['ArrowDown'],
        description: '向下滚动',
        category: '波形操作',
        handler: () => this.triggerWaveformAction('panDown'),
        enabled: true
      },
      {
        id: 'toggle-channel-1',
        keys: ['1'],
        description: '切换通道1',
        category: '通道控制',
        handler: () => this.triggerChannelToggle(0),
        enabled: true
      },
      {
        id: 'toggle-channel-2',
        keys: ['2'],
        description: '切换通道2',
        category: '通道控制',
        handler: () => this.triggerChannelToggle(1),
        enabled: true
      },
      {
        id: 'toggle-channel-3',
        keys: ['3'],
        description: '切换通道3',
        category: '通道控制',
        handler: () => this.triggerChannelToggle(2),
        enabled: true
      },
      {
        id: 'toggle-channel-4',
        keys: ['4'],
        description: '切换通道4',
        category: '通道控制',
        handler: () => this.triggerChannelToggle(3),
        enabled: true
      },
      {
        id: 'show-help',
        keys: ['F1'],
        description: '显示帮助',
        category: '帮助',
        handler: () => this.showShortcutHelp(),
        enabled: true
      },
      {
        id: 'toggle-decoder-panel',
        keys: ['Ctrl', 'Shift', 'D'],
        description: '切换解码器面板',
        category: '面板控制',
        handler: () => this.triggerPanelToggle('decoder'),
        enabled: true
      },
      {
        id: 'toggle-measurement-panel',
        keys: ['Ctrl', 'Shift', 'M'],
        description: '切换测量面板',
        category: '面板控制',
        handler: () => this.triggerPanelToggle('measurement'),
        enabled: true
      }
    ];

    defaultShortcuts.forEach(shortcut => {
      this.shortcuts.set(shortcut.id, shortcut);
    });
  }

  /**
   * 绑定事件监听器
   */
  private bindEvents() {
    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * 处理键盘按下事件
   */
  private handleKeydown(event: KeyboardEvent) {
    if (!this.enabled) return;

    // 忽略输入框中的按键
    if (this.isInputElement(event.target as Element)) {
      return;
    }

    // 构建按键组合
    const keys: string[] = [];
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.altKey) keys.push('Alt');
    if (event.metaKey) keys.push('Meta');

    // 添加主键
    const mainKey = this.getMainKey(event);
    if (mainKey) {
      keys.push(mainKey);
    }

    // 查找匹配的快捷键
    const matchedShortcut = this.findMatchingShortcut(keys);
    if (matchedShortcut && matchedShortcut.enabled) {
      event.preventDefault();
      event.stopPropagation();

      try {
        matchedShortcut.handler();
      } catch (error) {
        console.error('快捷键处理器执行错误:', error);
      }
    }
  }

  /**
   * 检查是否为输入元素
   */
  private isInputElement(element: Element): boolean {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['input', 'textarea', 'select', 'option'];

    return inputTypes.includes(tagName) ||
           element.getAttribute('contenteditable') === 'true';
  }

  /**
   * 获取主键名称
   */
  private getMainKey(event: KeyboardEvent): string {
    // 特殊键处理
    switch (event.code) {
      case 'ArrowLeft': return 'ArrowLeft';
      case 'ArrowRight': return 'ArrowRight';
      case 'ArrowUp': return 'ArrowUp';
      case 'ArrowDown': return 'ArrowDown';
      case 'Equal': return event.shiftKey ? '+' : '=';
      case 'Minus': return '-';
      case 'Digit0': return '0';
      case 'Digit1': return '1';
      case 'Digit2': return '2';
      case 'Digit3': return '3';
      case 'Digit4': return '4';
      case 'F1': return 'F1';
      default:
        // 字母键
        if (event.key.length === 1 && event.key.match(/[a-zA-Z]/)) {
          return event.key.toUpperCase();
        }
        return event.key;
    }
  }

  /**
   * 查找匹配的快捷键
   */
  private findMatchingShortcut(keys: string[]): KeyboardShortcut | null {
    for (const shortcut of this.shortcuts.values()) {
      if (this.keysMatch(keys, shortcut.keys)) {
        return shortcut;
      }
    }
    return null;
  }

  /**
   * 检查按键是否匹配
   */
  private keysMatch(keys1: string[], keys2: string[]): boolean {
    if (keys1.length !== keys2.length) return false;

    const sorted1 = [...keys1].sort();
    const sorted2 = [...keys2].sort();

    return sorted1.every((key, index) => key === sorted2[index]);
  }

  /**
   * 触发VSCode命令
   */
  private triggerVSCodeCommand(command: string) {
    if (window.vscode) {
      window.vscode.postMessage({ type: command });
    }
  }

  /**
   * 触发波形操作
   */
  private triggerWaveformAction(action: string) {
    window.dispatchEvent(new CustomEvent('waveform-action', { detail: action }));
  }

  /**
   * 触发通道切换
   */
  private triggerChannelToggle(channelIndex: number) {
    window.dispatchEvent(new CustomEvent('channel-toggle', { detail: channelIndex }));
  }

  /**
   * 触发面板切换
   */
  private triggerPanelToggle(panel: string) {
    window.dispatchEvent(new CustomEvent('panel-toggle', { detail: panel }));
  }

  /**
   * 显示快捷键帮助
   */
  private showShortcutHelp() {
    window.dispatchEvent(new CustomEvent('show-shortcut-help'));
  }

  /**
   * 添加快捷键
   */
  public addShortcut(shortcut: KeyboardShortcut) {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * 移除快捷键
   */
  public removeShortcut(id: string): boolean {
    return this.shortcuts.delete(id);
  }

  /**
   * 更新快捷键
   */
  public updateShortcut(id: string, updates: Partial<KeyboardShortcut>) {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      Object.assign(shortcut, updates);
    }
  }

  /**
   * 启用/禁用快捷键
   */
  public setShortcutEnabled(id: string, enabled: boolean) {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      shortcut.enabled = enabled;
    }
  }

  /**
   * 启用/禁用全局快捷键
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * 获取所有快捷键按分类
   */
  public getShortcutsByCategory(): ShortcutCategory[] {
    const categories = new Map<string, KeyboardShortcut[]>();

    for (const shortcut of this.shortcuts.values()) {
      if (!categories.has(shortcut.category)) {
        categories.set(shortcut.category, []);
      }
      categories.get(shortcut.category)!.push(shortcut);
    }

    return Array.from(categories.entries()).map(([name, shortcuts]) => ({
      name,
      shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description))
    }));
  }

  /**
   * 格式化快捷键显示
   */
  public formatShortcut(keys: string[]): string {
    const keyMap = {
      'Ctrl': '⌘',
      'Shift': '⇧',
      'Alt': '⌥',
      'Meta': '⌘',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'ArrowUp': '↑',
      'ArrowDown': '↓'
    };

    return keys.map(key => keyMap[key] || key).join(' + ');
  }

  /**
   * 销毁管理器
   */
  public destroy() {
    document.removeEventListener('keydown', this.keydownHandler);
    this.shortcuts.clear();
  }
}

// 全局实例
export const keyboardShortcutManager = new KeyboardShortcutManager();
