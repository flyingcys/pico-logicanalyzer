import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWebHost: vi.fn(),
  readWebBootstrap: vi.fn(),
  createWebApp: vi.fn(),
}));

vi.mock('./webHost', () => ({
  createWebHost: mocks.createWebHost,
  readWebBootstrap: mocks.readWebBootstrap,
}));

vi.mock('./createWebApp', () => ({
  createWebApp: mocks.createWebApp,
}));

describe('main-web 入口', () => {
  const host = { ready: vi.fn() };
  const bootstrap = { host: 'html' };
  const app = { mount: vi.fn() };

  beforeEach(() => {
    vi.resetModules();
    mocks.createWebHost.mockReturnValue(host);
    mocks.readWebBootstrap.mockReturnValue(bootstrap);
    mocks.createWebApp.mockReturnValue({ app, host });
    document.body.innerHTML = '<div id="app"></div>';
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as Window & { __WEB_HOST__?: typeof host }).__WEB_HOST__;
  });

  it('初始化宿主、挂载应用并标记暗色主题', async () => {
    await import('./main-web');

    expect(mocks.createWebApp).toHaveBeenCalledWith({ host, bootstrap });
    expect(app.mount).toHaveBeenCalledWith('#app');
    expect(host.ready).toHaveBeenCalledOnce();
    expect((window as Window & { __WEB_HOST__?: typeof host }).__WEB_HOST__).toBe(host);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
