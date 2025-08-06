/**
 * Vue i18n 国际化配置
 * 支持中英文切换
 */

import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

// 获取默认语言设置
const getDefaultLocale = (): string => {
  try {
    // 从localStorage获取用户设置的语言
    const savedLocale = localStorage.getItem('ui-locale');
    if (savedLocale) {
      return savedLocale;
    }
  } catch (error) {
    console.warn('无法访问 localStorage:', error);
  }

  // 根据浏览器语言自动检测
  const browserLang = navigator.language || navigator.languages?.[0] || 'zh-CN';

  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  } else if (browserLang.startsWith('en')) {
    return 'en-US';
  }

  // 默认使用中文
  return 'zh-CN';
};

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getDefaultLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
});

export default i18n;

// 切换语言的辅助函数
export const switchLocale = (locale: string) => {
  i18n.global.locale.value = locale;

  try {
    localStorage.setItem('ui-locale', locale);
  } catch (error) {
    console.warn('无法保存语言设置到 localStorage:', error);
  }

  // 更新HTML lang属性
  if (document && document.documentElement) {
    document.documentElement.lang = locale;
  }
};

// 获取当前语言
export const getCurrentLocale = () => {
  return i18n.global.locale.value;
};

// 支持的语言列表
export const supportedLocales = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' }
];
