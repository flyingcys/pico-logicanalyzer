/**
 * @jest-environment jsdom
 */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import ShortcutHelpDialog from '../../../src/frontend/app/components/ShortcutHelpDialog.vue';

jest.mock('element-plus', () => ({
  __esModule: true,
  ElMessage: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@element-plus/icons-vue', () => {
  const icon = { template: '<i />' };
  return {
    __esModule: true,
    Search: icon,
    InfoFilled: icon,
    Monitor: icon,
    Connection: icon,
    VideoPlay: icon,
    Document: icon,
    Grid: icon,
    Cpu: icon,
    Setting: icon,
    QuestionFilled: icon
  };
});

const stubs = {
  'el-dialog': {
    template: '<div class="dialog-stub"><slot /><slot name="footer" /></div>'
  },
  'el-input': { template: '<input />' },
  'el-button': { template: '<button><slot /></button>' },
  'el-icon': { template: '<i><slot /></i>' },
  'el-empty': { template: '<div />' }
};

/**
 * 帮助弹窗直接读 keyboardShortcutManager.getShortcutsByCategory() 渲染。
 * 「测量面板」不存在，因此用户看到的清单里不能出现这条虚假承诺。
 */
describe('ShortcutHelpDialog / 快捷键清单', () => {
  it('打开的清单不应出现「切换测量面板」，且仍保留「切换解码器面板」', async () => {
    const mountPoint = document.createElement('div');
    document.body.appendChild(mountPoint);

    const Parent = defineComponent({
      setup() {
        const show = ref(false);
        return { show };
      },
      render() {
        return h(ShortcutHelpDialog, {
          modelValue: this.show,
          'onUpdate:modelValue': (value: boolean) => { this.show = value; }
        });
      }
    });

    const app = createApp(Parent);
    for (const [name, stub] of Object.entries(stubs)) {
      app.component(name, stub);
    }
    const vm: any = app.mount(mountPoint);

    // watch(visible) 只在 false → true 时 loadShortcuts()，模拟用户按 F1 打开弹窗
    vm.show = true;
    await nextTick();

    const text = mountPoint.textContent ?? '';
    expect(text).not.toContain('切换测量面板');
    expect(text).toContain('切换解码器面板');

    app.unmount();
    mountPoint.remove();
  });
});
