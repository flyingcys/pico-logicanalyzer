import { createFrontendApp } from '../platform/bootstrap/createFrontendApp';
import { createVsCodeHost, readVsCodeBootstrap } from '../platform/host/vscodeHost';

const host = createVsCodeHost();
const bootstrap = readVsCodeBootstrap();
const context = createFrontendApp({ host, bootstrap });

context.app.mount('#app');
context.host.ready();

export default context;
