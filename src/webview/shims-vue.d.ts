declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface Window {
  vscode?: import('../frontend/platform/host/types').VsCodeApiLike;
  documentData?: import('../frontend/core/protocol/window').FrontendWindowDocumentData;
  __FRONTEND_BOOTSTRAP__?: import('../frontend/platform/host/types').FrontendBootstrapData;
}
