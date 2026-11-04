/**
 * @jest-environment jsdom
 */

import { createPinia, setActivePinia } from 'pinia';
import { bindShortcutEvents } from '../../../src/frontend/core/services/bootstrapService';
import { useUiStore } from '../../../src/frontend/core/stores/uiStore';

/**
 * 快捷键事件接线（P0-1a）：
 * - F1 派发 `show-shortcut-help`，必须打开帮助弹窗
 * - Ctrl+Shift+D 派发 `panel-toggle('decoder')`，必须在 decoder / performance 之间**双向切换**
 *   （默认 activeTab 就是 decoder，只断言「变成 decoder」会恒真假绿）
 * - 卸载清理函数必须让事件失效，避免重复挂载时状态被多个监听器覆盖
 */
describe('bindShortcutEvents / 快捷键事件接线', () => {
  let stop: (() => void) | null = null;

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    stop?.();
    stop = null;
  });

  it('F1 / show-shortcut-help 事件应打开帮助弹窗', () => {
    const uiStore = useUiStore();
    stop = bindShortcutEvents();

    expect(uiStore.showShortcutHelp).toBe(false);

    window.dispatchEvent(new CustomEvent('show-shortcut-help'));

    expect(uiStore.showShortcutHelp).toBe(true);
  });

  it('panel-toggle(decoder) 应从 decoder 切到 performance（非恒真）', () => {
    const uiStore = useUiStore();
    stop = bindShortcutEvents();

    expect(uiStore.activeTab).toBe('decoder');

    window.dispatchEvent(new CustomEvent('panel-toggle', { detail: 'decoder' }));

    expect(uiStore.activeTab).toBe('performance');
  });

  it('panel-toggle(decoder) 应从 performance 切回 decoder（反方向）', () => {
    const uiStore = useUiStore();
    uiStore.activeTab = 'performance';
    stop = bindShortcutEvents();

    window.dispatchEvent(new CustomEvent('panel-toggle', { detail: 'decoder' }));

    expect(uiStore.activeTab).toBe('decoder');
  });

  it('stop() 清理后两个事件都不再影响 uiStore', () => {
    const uiStore = useUiStore();
    const dispose = bindShortcutEvents();

    dispose();

    window.dispatchEvent(new CustomEvent('show-shortcut-help'));
    window.dispatchEvent(new CustomEvent('panel-toggle', { detail: 'decoder' }));

    expect(uiStore.showShortcutHelp).toBe(false);
    expect(uiStore.activeTab).toBe('decoder');
  });
});
