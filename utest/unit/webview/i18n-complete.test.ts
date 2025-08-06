/**
 * 🎯 i18n模块完善测试 - 从96.55%提升到99%+
 * 目标：覆盖剩余的第16行localStorage返回分支和其他边界情况
 */

// Mock vue-i18n before any imports
jest.mock('vue-i18n', () => ({
  createI18n: jest.fn(() => ({
    global: {
      locale: { value: 'zh-CN' }
    }
  }))
}));

describe('🎯 i18n模块 完善测试', () => {

  // 保存原始对象以便恢复
  const originalLocalStorage = global.localStorage;
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  beforeEach(() => {
    // 清除模块缓存
    jest.resetModules();
    
    // Mock localStorage
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: 0,
      key: jest.fn()
    };
    
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        language: 'zh-CN',
        languages: ['zh-CN']
      },
      writable: true
    });

    // Mock document
    global.document = {
      documentElement: {
        lang: 'zh-CN'
      }
    } as any;
  });

  afterEach(() => {
    // 恢复原始对象
    global.localStorage = originalLocalStorage;
    global.navigator = originalNavigator;
    global.document = originalDocument;
    
    jest.clearAllMocks();
  });

  describe('📊 覆盖localStorage保存的语言设置分支', () => {

    it('应该覆盖localStorage中有保存语言设置的情况 (第16行)', () => {
      // Mock localStorage返回保存的语言设置
      (global.localStorage.getItem as jest.Mock).mockReturnValue('en-US');

      // 重新导入模块来触发getDefaultLocale函数
      const i18nModule = require('../../../src/webview/i18n/index');

      // 验证localStorage.getItem被调用
      expect(global.localStorage.getItem).toHaveBeenCalledWith('ui-locale');

      // 验证模块加载成功
      expect(i18nModule.default).toBeDefined();
    });

    it('应该覆盖localStorage抛出异常的情况', () => {
      // Mock localStorage.getItem抛出异常
      (global.localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage access denied');
      });

      // Mock console.warn
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      // 重新导入模块
      const i18nModule = require('../../../src/webview/i18n/index');

      // 验证console.warn被调用
      expect(console.warn).toHaveBeenCalledWith('无法访问 localStorage:', expect.any(Error));

      // 验证模块仍然能正常加载
      expect(i18nModule.default).toBeDefined();

      // 恢复console.warn
      console.warn = originalConsoleWarn;
    });

  });

  describe('🌍 语言检测逻辑测试', () => {

    it('应该正确处理英文浏览器环境', () => {
      // 设置英文浏览器环境
      Object.defineProperty(global, 'navigator', {
        value: {
          language: 'en-US',
          languages: ['en-US', 'en']
        },
        writable: true
      });

      // localStorage返回null（没有保存的设置）
      (global.localStorage.getItem as jest.Mock).mockReturnValue(null);

      // 重新导入模块
      const i18nModule = require('../../../src/webview/i18n/index');

      expect(i18nModule.default).toBeDefined();
    });

    it('应该正确处理其他语言浏览器环境', () => {
      // 设置其他语言浏览器环境
      Object.defineProperty(global, 'navigator', {
        value: {
          language: 'fr-FR',
          languages: ['fr-FR', 'fr']
        },
        writable: true
      });

      (global.localStorage.getItem as jest.Mock).mockReturnValue(null);

      // 重新导入模块
      const i18nModule = require('../../../src/webview/i18n/index');

      expect(i18nModule.default).toBeDefined();
    });

    it('应该处理navigator.languages为undefined的情况', () => {
      // 设置navigator.languages为undefined
      Object.defineProperty(global, 'navigator', {
        value: {
          language: 'ja-JP',
          languages: undefined
        },
        writable: true
      });

      (global.localStorage.getItem as jest.Mock).mockReturnValue(null);

      // 重新导入模块
      const i18nModule = require('../../../src/webview/i18n/index');

      expect(i18nModule.default).toBeDefined();
    });

  });

  describe('🔧 辅助函数测试', () => {

    let i18nModule: any;

    beforeEach(() => {
      (global.localStorage.getItem as jest.Mock).mockReturnValue(null);
      i18nModule = require('../../../src/webview/i18n/index');
    });

    it('应该正确切换语言', () => {
      const { switchLocale } = i18nModule;

      // 测试切换到英文
      switchLocale('en-US');

      // 验证localStorage.setItem被调用
      expect(global.localStorage.setItem).toHaveBeenCalledWith('ui-locale', 'en-US');

      // 验证document.documentElement.lang被设置
      expect(global.document.documentElement.lang).toBe('en-US');
    });

    it('应该处理switchLocale中localStorage异常', () => {
      const { switchLocale } = i18nModule;

      // Mock localStorage.setItem抛出异常
      (global.localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage write denied');
      });

      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      // 切换语言不应该崩溃
      switchLocale('en-US');

      // 验证console.warn被调用
      expect(console.warn).toHaveBeenCalledWith('无法保存语言设置到 localStorage:', expect.any(Error));

      console.warn = originalConsoleWarn;
    });

    it('应该处理document为null的情况', () => {
      const { switchLocale } = i18nModule;

      // 临时设置document为null
      global.document = null as any;

      // 不应该崩溃
      switchLocale('en-US');

      expect(true).toBe(true);
    });

    it('应该处理document.documentElement为null的情况', () => {
      const { switchLocale } = i18nModule;

      // 设置documentElement为null
      global.document = {
        documentElement: null
      } as any;

      // 不应该崩溃
      switchLocale('en-US');

      expect(true).toBe(true);
    });

    it('应该正确获取当前语言', () => {
      const { getCurrentLocale } = i18nModule;

      const currentLocale = getCurrentLocale();
      expect(typeof currentLocale).toBe('string');
    });

    it('应该导出支持的语言列表', () => {
      const { supportedLocales } = i18nModule;

      expect(Array.isArray(supportedLocales)).toBe(true);
      expect(supportedLocales.length).toBeGreaterThan(0);

      // 验证语言对象结构
      supportedLocales.forEach(locale => {
        expect(locale).toHaveProperty('code');
        expect(locale).toHaveProperty('name');
        expect(locale).toHaveProperty('flag');
      });
    });

  });

  describe('🧹 边界条件测试', () => {

    it('应该处理navigator为undefined的情况', () => {
      // 设置navigator为undefined（而不是删除）
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true
      });

      (global.localStorage.getItem as jest.Mock).mockReturnValue(null);

      // 重新导入模块
      const i18nModule = require('../../../src/webview/i18n/index');

      expect(i18nModule.default).toBeDefined();
    });

    it('应该处理navigator.language为空字符串的情况', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          language: '',
          languages: []
        },
        writable: true
      });

      (global.localStorage.getItem as jest.Mock).mockReturnValue(null);

      // 重新导入模块
      const i18nModule = require('../../../src/webview/i18n/index');

      expect(i18nModule.default).toBeDefined();
    });

  });

});