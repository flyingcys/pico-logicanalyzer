import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import i18n from '@frontend-shared/i18n';
import type {
  HostAdapter,
  FrontendBootstrapData,
} from '@frontend-platform/host/types';
import WebRoot from './WebRoot.vue';

// 复刻 src/frontend/platform/bootstrap/createFrontendApp.ts 的 bootstrap 逻辑
// (pinia + element-plus 全量 + i18n + provide host/bootstrap),根组件换 WebRoot,
// 以零侵入共享层的方式注入 web 专属根组件(App + FileDropLayer 挂载点)。
export interface WebAppContext {
  app: VueApp;
  pinia: Pinia;
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}

export function createWebApp({
  host,
  bootstrap,
}: {
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}): WebAppContext {
  const app = createApp(WebRoot);
  const pinia = createPinia();

  app.use(pinia);
  app.use(ElementPlus);
  app.use(i18n);

  app.provide('host', host);
  app.provide('bootstrap', bootstrap);

  return {
    app,
    pinia,
    host,
    bootstrap,
  };
}
