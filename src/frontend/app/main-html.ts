import { createFrontendApp } from '../platform/bootstrap/createFrontendApp';
import { createBrowserHost, readBrowserBootstrap } from '../platform/host/browserHost';

const host = createBrowserHost();
const bootstrap = readBrowserBootstrap();
const context = createFrontendApp({ host, bootstrap });

context.app.mount('#app');
context.host.ready();

export default context;
