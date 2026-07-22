import 'element-plus/theme-chalk/dark/css-vars.css';
import '@frontend-shared/styles/html.css';
import './web-theme.css';
import { createWebApp } from './createWebApp';
import { createWebHost, readWebBootstrap } from './webHost';

const host = createWebHost();
const bootstrap = readWebBootstrap();
const context = createWebApp({ host, bootstrap });

// 暴露 host 完整实例(含 loadDocument),供 FileDropLayer 通过 window 取用
if (typeof window !== 'undefined') {
  (window as unknown as { __WEB_HOST__?: typeof host }).__WEB_HOST__ = host;
  // 激活 element-plus 暗色主题(dark/css-vars.css 的 html.dark 变量)
  document.documentElement.classList.add('dark');
}

context.app.mount('#app');
context.host.ready();
