import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from '../../app/App.vue';
import i18n from '../../shared/i18n';
import type { FrontendBootstrapData, HostAdapter } from '../host/types';

export interface FrontendAppContext {
  app: VueApp;
  pinia: Pinia;
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}

export function createFrontendApp({
  host,
  bootstrap
}: {
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}): FrontendAppContext {
  const app = createApp(App);
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
    bootstrap
  };
}
