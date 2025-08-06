/**
 * i18n 模块覆盖率测试
 * 专门用于确保达到95%+的代码覆盖率
 * 
 * @jest-environment node
 */

// Mock console.warn
const mockConsoleWarn = jest.fn();
global.console.warn = mockConsoleWarn;

// Mock vue-i18n
const mockI18nInstance = {
  global: {
    locale: { value: 'zh-CN' }
  }
};

jest.mock('vue-i18n', () => ({
  createI18n: jest.fn().mockReturnValue(mockI18nInstance)
}));

// Mock locale files
jest.mock('../../../../src/webview/i18n/locales/zh-CN', () => ({
  common: { test: '测试' }
}));

jest.mock('../../../../src/webview/i18n/locales/en-US', () => ({
  common: { test: 'test' }
}));

describe('i18n 模块覆盖率测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it.skip('应该处理 localStorage.getItem 错误', async () => {
    // Mock localStorage 抛出错误
    const mockGetItem = jest.fn().mockImplementation(() => {
      throw new Error('localStorage not available');
    });
    
    Object.defineProperty(global, 'localStorage', {
      value: { getItem: mockGetItem },
      writable: true,
      configurable: true
    });

    // Mock navigator
    Object.defineProperty(global, 'navigator', {
      value: { language: 'en-US' },
      writable: true,
      configurable: true
    });

    // 重新导入模块，使用动态导入确保重新执行
    jest.resetModules();
    
    // 使用动态导入来触发模块重新加载
    await import('../../../../src/webview/i18n/index');

    // 验证 console.warn 被调用
    expect(mockConsoleWarn).toHaveBeenCalledWith('无法访问 localStorage:', expect.any(Error));
  });

  it.skip('应该处理 localStorage.setItem 错误', async () => {
    // 设置正常的 localStorage.getItem
    const mockGetItem = jest.fn().mockReturnValue(null);
    const mockSetItem = jest.fn().mockImplementation(() => {
      throw new Error('localStorage quota exceeded');
    });
    
    Object.defineProperty(global, 'localStorage', {
      value: { 
        getItem: mockGetItem,
        setItem: mockSetItem
      },
      writable: true,
      configurable: true
    });

    // Mock document
    const mockDocument = {
      documentElement: { lang: 'zh-CN' }
    };
    
    Object.defineProperty(global, 'document', {
      value: mockDocument,
      writable: true,
      configurable: true
    });

    // 重新导入模块
    jest.resetModules();
    const module = await import('../../../../src/webview/i18n/index');

    // 调用 switchLocale，应该处理 localStorage 错误
    module.switchLocale('en-US');

    // 验证 console.warn 被调用
    expect(mockConsoleWarn).toHaveBeenCalledWith('无法保存语言设置到 localStorage:', expect.any(Error));
    
    // 验证 i18n.global.locale.value 仍然被设置
    expect(mockI18nInstance.global.locale.value).toBe('en-US');
    
    // 验证 document.documentElement.lang 被设置
    expect(mockDocument.documentElement.lang).toBe('en-US');
  });

  it('应该处理 document 对象不存在的情况', () => {
    // 设置正常的 localStorage
    Object.defineProperty(global, 'localStorage', {
      value: { 
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn()
      },
      writable: true,
      configurable: true
    });

    // 移除 document 对象
    Object.defineProperty(global, 'document', {
      value: undefined,
      writable: true,
      configurable: true
    });

    // 导入模块
    const module = require('../../../../src/webview/i18n/index');

    // 调用 switchLocale，应该优雅处理 document 不存在的情况
    expect(() => module.switchLocale('en-US')).not.toThrow();
    
    // 验证 i18n.global.locale.value 仍然被设置
    expect(mockI18nInstance.global.locale.value).toBe('en-US');
  });

  it('应该处理 document.documentElement 不存在的情况', () => {
    // 设置正常的 localStorage
    Object.defineProperty(global, 'localStorage', {
      value: { 
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn()
      },
      writable: true,
      configurable: true
    });

    // 设置 document 但没有 documentElement
    Object.defineProperty(global, 'document', {
      value: {},
      writable: true,
      configurable: true
    });

    // 导入模块
    const module = require('../../../../src/webview/i18n/index');

    // 调用 switchLocale，应该优雅处理 documentElement 不存在的情况
    expect(() => module.switchLocale('en-US')).not.toThrow();
    
    // 验证 i18n.global.locale.value 仍然被设置
    expect(mockI18nInstance.global.locale.value).toBe('en-US');
  });

  it('应该测试英文语言检测分支', () => {
    // 设置无 localStorage 保存的语言
    Object.defineProperty(global, 'localStorage', {
      value: { 
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn()
      },
      writable: true,
      configurable: true
    });

    // 设置浏览器语言为英文，触发 browserLang.startsWith('en') 分支
    Object.defineProperty(global, 'navigator', {
      value: { 
        language: 'en-GB',  // 使用 en-GB 来测试英文分支
        languages: ['en-GB', 'en-US']
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(global, 'document', {
      value: {
        documentElement: { lang: 'zh-CN' }
      },
      writable: true,
      configurable: true
    });

    // 导入模块，应该使用英文
    const { createI18n } = require('vue-i18n');
    require('../../../../src/webview/i18n/index');

    // 验证创建时使用了 en-US（这会覆盖第 26 行 return 'en-US';）
    expect(createI18n).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en-US'
      })
    );
  });

  it('应该测试不支持语言的默认分支', () => {
    // 设置无 localStorage 保存的语言
    Object.defineProperty(global, 'localStorage', {
      value: { 
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn()
      },
      writable: true,
      configurable: true
    });

    // 设置浏览器语言为不支持的语言，触发默认分支
    Object.defineProperty(global, 'navigator', {
      value: { 
        language: 'fr-FR',  // 法语，不支持的语言
        languages: ['fr-FR']
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(global, 'document', {
      value: {
        documentElement: { lang: 'zh-CN' }
      },
      writable: true,
      configurable: true
    });

    // 导入模块，应该回退到中文
    const { createI18n } = require('vue-i18n');
    require('../../../../src/webview/i18n/index');

    // 验证创建时使用了 zh-CN（这会覆盖第 32 行 return 'zh-CN';）
    expect(createI18n).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'zh-CN'
      })
    );
  });

  it('应该验证所有函数都可以正常调用', () => {
    // 重置 mockI18nInstance 状态为中文
    mockI18nInstance.global.locale.value = 'zh-CN';
    
    // 设置完整的环境
    Object.defineProperty(global, 'localStorage', {
      value: { 
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn()
      },
      writable: true,
      configurable: true
    });

    Object.defineProperty(global, 'navigator', {
      value: { language: 'zh-CN' },
      writable: true,
      configurable: true
    });

    Object.defineProperty(global, 'document', {
      value: {
        documentElement: { lang: 'zh-CN' }
      },
      writable: true,
      configurable: true
    });

    // 重新导入模块
    jest.resetModules();
    const module = require('../../../../src/webview/i18n/index');

    // 验证所有导出的函数和对象
    expect(module.default).toBeDefined();
    expect(module.switchLocale).toBeDefined();
    expect(module.getCurrentLocale).toBeDefined();
    expect(module.supportedLocales).toBeDefined();

    // 测试正常功能
    expect(module.getCurrentLocale()).toBe('zh-CN');
    module.switchLocale('en-US');
    expect(module.getCurrentLocale()).toBe('en-US');
    
    expect(module.supportedLocales).toHaveLength(2);
    expect(module.supportedLocales[0].code).toBe('zh-CN');
    expect(module.supportedLocales[1].code).toBe('en-US');
  });
});