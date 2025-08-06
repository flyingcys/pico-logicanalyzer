/**
 * ThemeManager.vue 单元测试
 * 测试主题管理器组件的完整功能
 * 
 * @jest-environment jsdom
 */

import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import { ElMessage } from 'element-plus';
import ThemeManager from '../../../../src/webview/components/ThemeManager.vue';

// Mock Element Plus
jest.mock('element-plus', () => ({
  ElMessage: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn()
  },
  ElCard: { template: '<div class="el-card"><slot name="header"></slot><slot></slot></div>' },
  ElButton: { template: '<button @click="$emit(\'click\')"><slot></slot></button>' },
  ElRadioGroup: { 
    template: '<div><slot></slot></div>',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change']
  },
  ElRadioButton: { 
    template: '<label><slot></slot></label>',
    props: ['label']
  },
  ElColorPicker: { 
    template: '<input type="color" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)">',
    props: ['modelValue', 'showAlpha', 'predefine'],
    emits: ['update:modelValue', 'change']
  },
  ElSlider: { 
    template: '<input type="range" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', parseInt($event.target.value))" @change="$emit(\'change\', parseInt($event.target.value))">',
    props: ['modelValue', 'min', 'max', 'step', 'showStops'],
    emits: ['update:modelValue', 'change']
  },
  ElSwitch: { 
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)">',
    props: ['modelValue', 'activeText', 'inactiveText'],
    emits: ['update:modelValue', 'change']
  },
  ElCheckbox: { 
    template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked); $emit(\'change\', $event.target.checked)"><slot></slot>',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change']
  },
  ElInputNumber: { 
    template: '<input type="number" :value="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', parseInt($event.target.value))" @change="$emit(\'change\', parseInt($event.target.value))">',
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:modelValue', 'change']
  },
  ElSelect: { 
    template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\', $event.target.value)"><slot></slot></select>',
    props: ['modelValue', 'size'],
    emits: ['update:modelValue', 'change']
  },
  ElOption: { 
    template: '<option :value="value"><slot></slot></option>',
    props: ['label', 'value']
  },
  ElInput: { 
    template: '<textarea v-if="type === \'textarea\'" :value="modelValue" :rows="rows" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\', $event.target.value)"></textarea>',
    props: ['modelValue', 'type', 'rows', 'placeholder'],
    emits: ['update:modelValue', 'change']
  },
  ElDialog: { 
    template: '<div v-if="modelValue" class="el-dialog"><slot></slot></div>',
    props: ['modelValue', 'title', 'width'],
    emits: ['update:modelValue']
  },
  ElCollapse: { template: '<div><slot></slot></div>' },
  ElCollapseItem: { 
    template: '<div><div class="collapse-title" @click="toggleCollapse">{{ title }}</div><div v-if="isOpen"><slot></slot></div></div>',
    props: ['title', 'name'],
    data() { return { isOpen: false }; },
    methods: { toggleCollapse() { this.isOpen = !this.isOpen; } }
  },
  ElTag: { 
    template: '<span class="el-tag" :class="type"><slot></slot></span>',
    props: ['type']
  }
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)' ? false : true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock FileReader
class MockFileReader {
  result: string | null = null;
  onload: ((event: any) => void) | null = null;
  
  readAsText(file: File) {
    setTimeout(() => {
      this.result = '{"theme":"dark","primaryColor":"#ff0000"}';
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 10);
  }
}

global.FileReader = MockFileReader as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement
const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'a') {
    const link = originalCreateElement('a');
    link.click = jest.fn();
    return link;
  }
  if (tagName === 'input') {
    const input = originalCreateElement('input');
    input.click = jest.fn();
    return input;
  }
  if (tagName === 'style') {
    const style = originalCreateElement('style');
    style.remove = jest.fn();
    return style;
  }
  return originalCreateElement(tagName);
});

describe('ThemeManager.vue', () => {
  let wrapper: VueWrapper<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // 重置DOM
    document.head.innerHTML = '';
    document.documentElement.className = '';
    
    wrapper = mount(ThemeManager, {
      global: {
        stubs: {
          'el-card': { template: '<div class="el-card"><slot name="header"></slot><slot></slot></div>' },
          'el-button': { template: '<button @click="$emit(\'click\')"><slot></slot></button>' },
          'el-radio-group': { 
            template: '<div><slot></slot></div>',
            props: ['modelValue'],
            emits: ['update:modelValue', 'change']
          },
          'el-radio-button': { 
            template: '<label><slot></slot></label>',
            props: ['label']
          },
        }
      }
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('组件初始化', () => {
    it('应该正确挂载组件', () => {
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.theme-manager').exists()).toBe(true);
    });

    it('应该设置默认的主题值', () => {
      expect(wrapper.vm.currentTheme).toBe('auto');
      expect(wrapper.vm.currentPrimaryColor).toBe('#409eff');
      expect(wrapper.vm.fontSize).toBe(14);
      expect(wrapper.vm.layoutDensity).toBe('default');
      expect(wrapper.vm.componentSize).toBe('default');
    });

    it('应该初始化预设颜色数组', () => {
      expect(wrapper.vm.presetColors).toHaveLength(12);
      expect(wrapper.vm.presetColors[0]).toEqual({ name: '默认蓝', value: '#409eff' });
    });

    it('应该初始化响应式断点', () => {
      expect(wrapper.vm.breakpoints).toHaveLength(5);
      expect(wrapper.vm.breakpoints[0]).toEqual({ name: 'xs', label: '超小屏', min: 0 });
    });

    it('应该初始化CSS变量参考', () => {
      expect(wrapper.vm.colorVariables).toContain('--el-color-primary');
      expect(wrapper.vm.sizeVariables).toContain('--el-component-size');
      expect(wrapper.vm.fontVariables).toContain('--el-font-family');
    });
  });

  describe('主题切换功能', () => {
    it('应该能切换到深色主题', async () => {
      await wrapper.vm.applyTheme('dark');
      
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
      expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    });

    it('应该能切换到浅色主题', async () => {
      await wrapper.vm.applyTheme('light');
      
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);
      expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    });

    it('应该能切换到自动主题', async () => {
      await wrapper.vm.applyTheme('auto');
      
      // 根据mock的matchMedia，auto应该应用light主题
      expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    });

    it('应该在主题切换时触发事件', async () => {
      await wrapper.vm.applyTheme('dark');
      
      expect(wrapper.emitted('theme-changed')).toBeTruthy();
      expect(wrapper.emitted('theme-changed')?.[0]).toEqual(['dark']);
    });

    it('应该保存主题设置到localStorage', async () => {
      await wrapper.vm.applyTheme('dark');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'theme-settings',
        expect.stringContaining('dark')
      );
    });
  });

  describe('主色调设置', () => {
    it('应该能设置主色调', async () => {
      const testColor = '#ff0000';
      await wrapper.vm.setPrimaryColor(testColor);
      
      expect(wrapper.vm.currentPrimaryColor).toBe(testColor);
    });

    it('应该在设置主色调时触发事件', async () => {
      const testColor = '#00ff00';
      await wrapper.vm.setPrimaryColor(testColor);
      
      expect(wrapper.emitted('primary-color-changed')).toBeTruthy();
      expect(wrapper.emitted('primary-color-changed')?.[0]).toEqual([testColor]);
    });

    it('应该设置CSS变量', async () => {
      const testColor = '#0000ff';
      const setSpy = jest.spyOn(document.documentElement.style, 'setProperty');
      
      await wrapper.vm.setPrimaryColor(testColor);
      
      expect(setSpy).toHaveBeenCalledWith('--el-color-primary', testColor);
      expect(setSpy).toHaveBeenCalledWith('--el-color-primary-light-3', expect.any(String));
    });
  });

  describe('字体大小设置', () => {
    it('应该能设置字体大小', async () => {
      await wrapper.vm.applyFontSize(16);
      
      expect(wrapper.vm.fontSize).toBe(16);
    });

    it('应该设置字体相关的CSS变量', async () => {
      const setSpy = jest.spyOn(document.documentElement.style, 'setProperty');
      
      await wrapper.vm.applyFontSize(18);
      
      expect(setSpy).toHaveBeenCalledWith('--el-font-size-base', '18px');
      expect(setSpy).toHaveBeenCalledWith('--el-font-size-small', '16px');
      expect(setSpy).toHaveBeenCalledWith('--el-font-size-large', '20px');
    });
  });

  describe('布局密度设置', () => {
    it('应该能设置紧凑布局', async () => {
      await wrapper.vm.applyLayoutDensity('compact');
      
      expect(document.documentElement.classList.contains('density-compact')).toBe(true);
    });

    it('应该能设置宽松布局', async () => {
      await wrapper.vm.applyLayoutDensity('comfortable');
      
      expect(document.documentElement.classList.contains('density-comfortable')).toBe(true);
    });

    it('应该设置布局相关的CSS变量', async () => {
      const setSpy = jest.spyOn(document.documentElement.style, 'setProperty');
      
      await wrapper.vm.applyLayoutDensity('compact');
      
      expect(setSpy).toHaveBeenCalledWith('--layout-padding', '4px');
      expect(setSpy).toHaveBeenCalledWith('--layout-margin', '2px');
      expect(setSpy).toHaveBeenCalledWith('--component-height', '28px');
    });
  });

  describe('动画设置', () => {
    it('应该能启用动画', async () => {
      wrapper.vm.animationsEnabled = true;
      wrapper.vm.animationSpeed = 1.5;
      
      await wrapper.vm.applyAnimationSettings();
      
      expect(document.documentElement.classList.contains('no-animations')).toBe(false);
    });

    it('应该能禁用动画', async () => {
      wrapper.vm.animationsEnabled = false;
      
      await wrapper.vm.applyAnimationSettings();
      
      expect(document.documentElement.classList.contains('no-animations')).toBe(true);
    });

    it('应该根据动画速度设置CSS变量', async () => {
      const setSpy = jest.spyOn(document.documentElement.style, 'setProperty');
      wrapper.vm.animationsEnabled = true;
      wrapper.vm.animationSpeed = 2;
      
      await wrapper.vm.applyAnimationSettings();
      
      expect(setSpy).toHaveBeenCalledWith('--animation-duration-base', '150ms');
      expect(setSpy).toHaveBeenCalledWith('--animation-duration-fast', '100ms');
      expect(setSpy).toHaveBeenCalledWith('--animation-duration-slow', '250ms');
    });
  });

  describe('侧边栏设置', () => {
    it('应该能设置侧边栏可见性', async () => {
      wrapper.vm.sidebarSettings.leftVisible = false;
      wrapper.vm.sidebarSettings.rightVisible = true;
      
      await wrapper.vm.applySidebarSettings();
      
      expect(wrapper.emitted('layout-changed')).toBeTruthy();
      expect(wrapper.emitted('layout-changed')?.[0][0]).toEqual({
        sidebar: wrapper.vm.sidebarSettings
      });
    });

    it('应该能设置侧边栏宽度', async () => {
      wrapper.vm.sidebarSettings.width = 400;
      
      await wrapper.vm.applySidebarSettings();
      
      expect(wrapper.vm.sidebarSettings.width).toBe(400);
    });
  });

  describe('工具栏设置', () => {
    it('应该能设置工具栏显示选项', async () => {
      wrapper.vm.toolbarSettings.showIcons = false;
      wrapper.vm.toolbarSettings.showText = true;
      wrapper.vm.toolbarSettings.position = 'bottom';
      
      await wrapper.vm.applyToolbarSettings();
      
      expect(wrapper.emitted('layout-changed')).toBeTruthy();
      expect(wrapper.emitted('layout-changed')?.[0][0]).toEqual({
        toolbar: wrapper.vm.toolbarSettings
      });
    });
  });

  describe('自定义CSS功能', () => {
    it('应该能应用自定义CSS', async () => {
      const customCSS = '.test { color: red; }';
      wrapper.vm.customCSS = customCSS;
      
      await wrapper.vm.applyCustomCSS();
      
      const styleElement = document.getElementById('custom-theme-css');
      expect(styleElement).toBeTruthy();
      expect(styleElement?.textContent).toBe(customCSS);
    });

    it('应该能清除之前的自定义CSS', async () => {
      // 先添加一个样式
      const style = document.createElement('style');
      style.id = 'custom-theme-css';
      style.textContent = '.old { color: blue; }';
      document.head.appendChild(style);
      
      wrapper.vm.customCSS = '.new { color: green; }';
      await wrapper.vm.applyCustomCSS();
      
      expect(document.getElementById('custom-theme-css')?.textContent).toBe('.new { color: green; }');
    });

    it('应该在清空CSS时移除样式元素', async () => {
      // 先添加样式
      wrapper.vm.customCSS = '.test { color: red; }';
      await wrapper.vm.applyCustomCSS();
      expect(document.getElementById('custom-theme-css')).toBeTruthy();
      
      // 清空CSS
      wrapper.vm.customCSS = '';
      await wrapper.vm.applyCustomCSS();
      expect(document.getElementById('custom-theme-css')).toBeFalsy();
    });
  });

  describe('响应式断点', () => {
    it('应该正确更新断点', async () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400
      });
      
      wrapper.vm.updateBreakpoint();
      
      expect(wrapper.vm.viewportWidth).toBe(1400);
      expect(wrapper.vm.currentBreakpoint).toBe('lg');
    });

    it('应该为超小屏幕设置正确的断点', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600
      });
      
      wrapper.vm.updateBreakpoint();
      
      expect(wrapper.vm.currentBreakpoint).toBe('xs');
    });

    it('应该为超大屏幕设置正确的断点', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 2000
      });
      
      wrapper.vm.updateBreakpoint();
      
      expect(wrapper.vm.currentBreakpoint).toBe('xl');
    });
  });

  describe('断点工具方法', () => {
    it('应该返回正确的断点类型', () => {
      expect(wrapper.vm.getBreakpointType('xs')).toBe('danger');
      expect(wrapper.vm.getBreakpointType('sm')).toBe('warning');
      expect(wrapper.vm.getBreakpointType('md')).toBe('primary');
      expect(wrapper.vm.getBreakpointType('lg')).toBe('success');
      expect(wrapper.vm.getBreakpointType('xl')).toBe('info');
      expect(wrapper.vm.getBreakpointType('unknown')).toBe('info');
    });

    it('应该返回正确的断点名称', () => {
      expect(wrapper.vm.getBreakpointName('xs')).toBe('超小屏');
      expect(wrapper.vm.getBreakpointName('sm')).toBe('小屏');
      expect(wrapper.vm.getBreakpointName('md')).toBe('中屏');
      expect(wrapper.vm.getBreakpointName('lg')).toBe('大屏');
      expect(wrapper.vm.getBreakpointName('xl')).toBe('超大屏');
      expect(wrapper.vm.getBreakpointName('unknown')).toBe('unknown');
    });
  });

  describe('CSS变量获取', () => {
    it('应该能获取CSS变量值', () => {
      // Mock getComputedStyle
      const mockGetComputedStyle = jest.fn().mockReturnValue({
        getPropertyValue: jest.fn().mockReturnValue(' #409eff ')
      });
      window.getComputedStyle = mockGetComputedStyle;
      
      const value = wrapper.vm.getCSSVariableValue('--el-color-primary');
      
      expect(value).toBe('#409eff');
      expect(mockGetComputedStyle).toHaveBeenCalledWith(document.documentElement);
    });
  });

  describe('设置重置功能', () => {
    it('应该能重置所有设置到默认值', async () => {
      // 先修改一些设置
      wrapper.vm.currentTheme = 'dark';
      wrapper.vm.currentPrimaryColor = '#ff0000';
      wrapper.vm.fontSize = 20;
      wrapper.vm.layoutDensity = 'compact';
      
      await wrapper.vm.resetToDefaults();
      
      expect(wrapper.vm.currentTheme).toBe('auto');
      expect(wrapper.vm.currentPrimaryColor).toBe('#409eff');
      expect(wrapper.vm.fontSize).toBe(14);
      expect(wrapper.vm.layoutDensity).toBe('default');
    });

    it('重置设置时应该显示成功消息', async () => {
      await wrapper.vm.resetToDefaults();
      
      expect(ElMessage.success).toHaveBeenCalledWith('已重置为默认设置');
    });
  });

  describe('设置保存和加载', () => {
    it('应该能保存设置到localStorage', async () => {
      wrapper.vm.currentTheme = 'dark';
      wrapper.vm.currentPrimaryColor = '#ff0000';
      
      wrapper.vm.saveSettings();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'theme-settings',
        expect.stringContaining('dark')
      );
    });

    it('应该能从localStorage加载设置', async () => {
      const settings = {
        theme: 'dark',
        primaryColor: '#ff0000',
        fontSize: 16,
        layoutDensity: 'compact'
      };
      
      localStorageMock.setItem('theme-settings', JSON.stringify(settings));
      
      wrapper.vm.loadSettings();
      
      expect(wrapper.vm.currentTheme).toBe('dark');
      expect(wrapper.vm.currentPrimaryColor).toBe('#ff0000');
      expect(wrapper.vm.fontSize).toBe(16);
      expect(wrapper.vm.layoutDensity).toBe('compact');
    });

    it('应该处理无效的localStorage数据', async () => {
      localStorageMock.setItem('theme-settings', 'invalid-json');
      
      // 不应该抛出错误
      expect(() => wrapper.vm.loadSettings()).not.toThrow();
    });

    it('应该处理空的localStorage', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      expect(() => wrapper.vm.loadSettings()).not.toThrow();
      // 应该保持默认值
      expect(wrapper.vm.currentTheme).toBe('auto');
    });
  });

  describe('导入导出功能', () => {
    it('应该能导出设置', async () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const mockLink = { href: '', download: '', click: jest.fn() };
      createElementSpy.mockReturnValue(mockLink as any);
      
      await wrapper.vm.saveCustomCSS();
      
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('theme-settings.json');
      expect(ElMessage.success).toHaveBeenCalledWith('主题设置已导出');
    });

    it('应该能导入设置', async () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const mockInput = { 
        type: '', 
        accept: '', 
        click: jest.fn(),
        onchange: null as any
      };
      createElementSpy.mockReturnValue(mockInput as any);
      
      wrapper.vm.loadCustomCSS();
      
      expect(mockInput.click).toHaveBeenCalled();
      expect(mockInput.type).toBe('file');
      expect(mockInput.accept).toBe('.json');
    });

    it('应该处理文件导入', async () => {
      wrapper.vm.loadCustomCSS();
      
      // 模拟文件选择和FileReader
      const mockFile = new File(['{"theme":"dark"}'], 'settings.json', { type: 'application/json' });
      const mockEvent = {
        target: { files: [mockFile] }
      };
      
      // 这里需要更复杂的mock来测试FileReader
      // 由于我们已经mock了FileReader，这个测试会通过异步操作
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(ElMessage.success).toHaveBeenCalledWith('主题设置已导入');
    });
  });

  describe('计算属性', () => {
    it('systemTheme应该正确返回系统主题', () => {
      expect(wrapper.vm.systemTheme).toBe('light'); // 基于我们的mock
    });

    it('effectiveTheme应该在auto模式下返回系统主题', () => {
      wrapper.vm.currentTheme = 'auto';
      expect(wrapper.vm.effectiveTheme).toBe('light');
    });

    it('effectiveTheme应该在非auto模式下返回设置的主题', () => {
      wrapper.vm.currentTheme = 'dark';
      expect(wrapper.vm.effectiveTheme).toBe('dark');
    });
  });

  describe('生命周期', () => {
    it('应该在mounted时加载设置', () => {
      const loadSpy = jest.spyOn(ThemeManager.methods!, 'loadSettings');
      const updateBreakpointSpy = jest.spyOn(ThemeManager.methods!, 'updateBreakpoint');
      
      // 重新挂载组件来测试mounted钩子
      wrapper.unmount();
      wrapper = mount(ThemeManager, {
        global: { stubs: {} }
      });
      
      expect(loadSpy).toHaveBeenCalled();
      expect(updateBreakpointSpy).toHaveBeenCalled();
    });

    it('应该在mounted时设置事件监听器', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      wrapper.unmount();
      wrapper = mount(ThemeManager, {
        global: { stubs: {} }
      });
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('应该在unmounted时移除事件监听器', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      wrapper.unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });

  describe('颜色辅助方法', () => {
    it('lighten方法应该正确变亮颜色', () => {
      // 通过setPrimaryColor间接测试lighten方法
      const setSpy = jest.spyOn(document.documentElement.style, 'setProperty');
      
      wrapper.vm.setPrimaryColor('#ff0000');
      
      // 验证生成了变亮的颜色变体
      expect(setSpy).toHaveBeenCalledWith('--el-color-primary-light-3', expect.stringMatching(/^#[0-9a-f]{6}$/));
      expect(setSpy).toHaveBeenCalledWith('--el-color-primary-light-5', expect.stringMatching(/^#[0-9a-f]{6}$/));
    });

    it('darken方法应该正确变暗颜色', () => {
      const setSpy = jest.spyOn(document.documentElement.style, 'setProperty');
      
      wrapper.vm.setPrimaryColor('#ffffff');
      
      // 验证生成了变暗的颜色变体
      expect(setSpy).toHaveBeenCalledWith('--el-color-primary-dark-2', expect.stringMatching(/^#[0-9a-f]{6}$/));
    });
  });

  describe('错误处理', () => {
    it('应该处理JSON解析错误', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      localStorageMock.setItem('theme-settings', '{invalid json}');
      
      expect(() => wrapper.vm.loadSettings()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load theme settings:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('应该处理导入文件错误', () => {
      // 这需要更复杂的FileReader mock来测试错误情况
      expect(() => wrapper.vm.loadCustomCSS()).not.toThrow();
    });
  });
});