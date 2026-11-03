/**
 * main-vscode 入口启动回归测试。
 *
 * 回归保护目标（对应 src/frontend/app/main-vscode.ts 的既有行为）：
 *  1. 调用 createVsCodeHost() 创建 VSCode 宿主；
 *  2. 调用 readVsCodeBootstrap() 读取引导数据；
 *  3. 调用 createFrontendApp({ host, bootstrap }) 创建前端应用上下文；
 *  4. context.app.mount('#app') 挂载到 #app；
 *  5. context.host.ready() 标记宿主就绪。
 *
 * 入口未直接访问 window，默认 node 环境即可。
 * vscode 模块由 jest.config.js 的 moduleNameMapper 映射到 tests/fixtures/mocks/vscode.ts，
 * 而宿主工厂本身被整体 mock，不会真正加载 vscode 依赖。
 */

// mock VSCode 宿主工厂：拦截真实宿主创建，避免依赖 vscode 运行时
jest.mock('../../../src/frontend/platform/host/vscodeHost', () => ({
  createVsCodeHost: jest.fn(),
  readVsCodeBootstrap: jest.fn(),
}));

// mock 前端应用工厂：拦截 Vue/Pinia/ElementPlus 的真实初始化
jest.mock('../../../src/frontend/platform/bootstrap/createFrontendApp', () => ({
  createFrontendApp: jest.fn(),
}));

import { createVsCodeHost, readVsCodeBootstrap } from '../../../src/frontend/platform/host/vscodeHost';
import { createFrontendApp } from '../../../src/frontend/platform/bootstrap/createFrontendApp';

describe('main-vscode 入口', () => {
  // 共享的宿主/应用桩：createFrontendApp 原样回传这些引用，便于断言调用情况
  const host = { ready: jest.fn() };
  const bootstrap = { source: 'vscode' };
  const app = { mount: jest.fn() };
  const context = { app, host, pinia: {}, bootstrap };

  beforeEach(() => {
    // 注：不调用 jest.resetModules()——它会清空模块缓存，导致下次 import 时
    // jest.mock 工厂重新执行并生成全新的 jest.fn()，与顶部静态 import 拿到的
    // mock 函数不再是同一引用，mockReturnValue 设置会失效（context 变 undefined）。
    // 本文件仅一个用例，无需重置缓存。

    (createVsCodeHost as jest.Mock).mockReturnValue(host);
    (readVsCodeBootstrap as jest.Mock).mockReturnValue(bootstrap);
    (createFrontendApp as jest.Mock).mockReturnValue(context);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('创建宿主、读取引导数据、组装应用、挂载 #app 并宿主就绪', async () => {
    // 触发入口顶层副作用（import 被 mock 后不会真正创建 Vue 应用）
    await import('../../../src/frontend/app/main-vscode');

    // 1. 宿主与引导数据各创建一次
    expect(createVsCodeHost).toHaveBeenCalledTimes(1);
    expect(readVsCodeBootstrap).toHaveBeenCalledTimes(1);

    // 2. createFrontendApp 收到包含 host 与 bootstrap 的对象
    expect(createFrontendApp).toHaveBeenCalledWith({ host, bootstrap });

    // 3. 应用挂载到 #app
    expect(app.mount).toHaveBeenCalledWith('#app');
    expect(app.mount).toHaveBeenCalledTimes(1);

    // 4. 宿主标记就绪
    expect(host.ready).toHaveBeenCalledTimes(1);
  });
});
