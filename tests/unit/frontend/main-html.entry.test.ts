/**
 * @jest-environment jsdom
 *
 * main-html 入口启动回归测试。
 *
 * 回归保护目标（对应 src/frontend/app/main-html.ts 的既有行为）：
 *  1. 调用 createBrowserHost() 创建浏览器宿主；
 *  2. 调用 readBrowserBootstrap() 读取引导数据；
 *  3. 调用 createFrontendApp({ host, bootstrap }) 创建前端应用上下文；
 *  4. context.app.mount('#app') 挂载到 #app；
 *  5. context.host.ready() 标记宿主就绪；
 *  6. 把 context 挂到 window.__LOGIC_ANALYZER_FRONTEND__ 供外部调试使用。
 *
 * 入口需访问 window 对象，故使用 jsdom 环境（jest-environment-jsdom 已在 devDependencies）。
 */

// mock 浏览器宿主工厂：拦截真实宿主创建，避免触碰 DOM / 硬件
jest.mock('../../../src/frontend/platform/host/browserHost', () => ({
  createBrowserHost: jest.fn(),
  readBrowserBootstrap: jest.fn(),
}));

// mock 前端应用工厂：拦截 Vue/Pinia/ElementPlus 的真实初始化
jest.mock('../../../src/frontend/platform/bootstrap/createFrontendApp', () => ({
  createFrontendApp: jest.fn(),
}));

import { createBrowserHost, readBrowserBootstrap } from '../../../src/frontend/platform/host/browserHost';
import { createFrontendApp } from '../../../src/frontend/platform/bootstrap/createFrontendApp';

describe('main-html 入口', () => {
  // 共享的宿主/应用桩：createFrontendApp 原样回传这些引用，便于断言调用情况
  const host = { ready: jest.fn() };
  const bootstrap = { source: 'html' };
  const app = { mount: jest.fn() };
  const context = { app, host, pinia: {}, bootstrap };

  beforeEach(() => {
    // 注：不调用 jest.resetModules()——它会清空模块缓存，导致下次 import 时
    // jest.mock 工厂重新执行并生成全新的 jest.fn()，与顶部静态 import 拿到的
    // mock 函数不再是同一引用，mockReturnValue 设置会失效（context 变 undefined）。
    // 本文件仅一个用例，无需重置缓存。

    (createBrowserHost as jest.Mock).mockReturnValue(host);
    (readBrowserBootstrap as jest.Mock).mockReturnValue(bootstrap);
    (createFrontendApp as jest.Mock).mockReturnValue(context);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // 清理 window 上的调试挂载点，避免用例间污染
    delete (window as Window & { __LOGIC_ANALYZER_FRONTEND__?: unknown }).__LOGIC_ANALYZER_FRONTEND__;
  });

  it('创建宿主、读取引导数据、组装应用、挂载 #app、宿主就绪并挂载到 window', async () => {
    // 触发入口顶层副作用（import 被 mock 后不会真正创建 Vue 应用）
    await import('../../../src/frontend/app/main-html');

    // 1. 宿主与引导数据各创建一次
    expect(createBrowserHost).toHaveBeenCalledTimes(1);
    expect(readBrowserBootstrap).toHaveBeenCalledTimes(1);

    // 2. createFrontendApp 收到包含 host 与 bootstrap 的对象
    expect(createFrontendApp).toHaveBeenCalledWith({ host, bootstrap });

    // 3. 应用挂载到 #app
    expect(app.mount).toHaveBeenCalledWith('#app');
    expect(app.mount).toHaveBeenCalledTimes(1);

    // 4. 宿主标记就绪
    expect(host.ready).toHaveBeenCalledTimes(1);

    // 5. 调试挂载点赋值为入口导出的上下文
    expect(
      (window as Window & { __LOGIC_ANALYZER_FRONTEND__?: typeof context }).__LOGIC_ANALYZER_FRONTEND__
    ).toBe(context);
  });
});
