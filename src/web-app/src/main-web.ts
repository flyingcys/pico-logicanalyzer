import '@frontend-shared/styles/html.css';
import { createWebApp } from './createWebApp';
import { createWebHost, readWebBootstrap } from './webHost';

const host = createWebHost();
const bootstrap = readWebBootstrap();
const context = createWebApp({ host, bootstrap });

// 暴露 host 完整实例(含 loadDocument),供 FileDropLayer 通过 window 取用
if (typeof window !== 'undefined') {
  (window as unknown as { __WEB_HOST__?: typeof host }).__WEB_HOST__ = host;
}

context.app.mount('#app');
context.host.ready();
