import '../shared/styles/webview.css';
import { createFrontendApp } from '../platform/bootstrap/createFrontendApp';
import { createVsCodeHost, readVsCodeBootstrap } from '../platform/host/vscodeHost';
import { setupScenarioListener } from '../platform/scenario/scenarioExecutor';

const host = createVsCodeHost();
const bootstrap = readVsCodeBootstrap();
const context = createFrontendApp({ host, bootstrap });

context.app.mount('#app');
setupScenarioListener();
context.host.ready();

export default context;
