import '../shared/styles/html.css';
import { createFrontendApp } from '../platform/bootstrap/createFrontendApp';
import { createBrowserHost, readBrowserBootstrap } from '../platform/host/browserHost';

const host = createBrowserHost();
const bootstrap = readBrowserBootstrap();
const context = createFrontendApp({ host, bootstrap });

if (typeof window !== 'undefined') {
  (window as Window & typeof globalThis & {
    __LOGIC_ANALYZER_FRONTEND__?: typeof context;
  }).__LOGIC_ANALYZER_FRONTEND__ = context;
}

context.app.mount('#app');
context.host.ready();

export default context;
