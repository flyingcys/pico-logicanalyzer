// 临时入口:用现成 browserHost 验证 vite 能编译整个 frontend。Task 4 替换为 webHost。
import '@frontend-shared/styles/html.css';
import { createFrontendApp } from '@frontend-platform/bootstrap/createFrontendApp';
import { createBrowserHost, readBrowserBootstrap } from '@frontend-platform/host/browserHost';

const host = createBrowserHost();
const bootstrap = readBrowserBootstrap();
const context = createFrontendApp({ host, bootstrap });

context.app.mount('#app');
context.host.ready();
