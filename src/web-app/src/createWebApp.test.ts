import { describe, it, expect } from 'vitest';
import { createWebApp } from './createWebApp';
import { createWebHost, readWebBootstrap } from './webHost';

describe('createWebApp', () => {
  // 复刻 createFrontendApp 的 bootstrap 逻辑(根组件换 WebRoot)。
  // 核心契约:返回 {app, pinia, host, bootstrap} 且 host/bootstrap 原样透传。
  const host = createWebHost();
  const bootstrap = readWebBootstrap();
  const ctx = createWebApp({ host, bootstrap });

  it('返回包含 app/pinia/host/bootstrap 四个键的上下文', () => {
    expect(ctx).toHaveProperty('app');
    expect(ctx).toHaveProperty('pinia');
    expect(ctx).toHaveProperty('host');
    expect(ctx).toHaveProperty('bootstrap');
  });

  it('host 与 bootstrap 原样透传(===)', () => {
    expect(ctx.host).toBe(host);
    expect(ctx.bootstrap).toBe(bootstrap);
  });

  it('app 是 Vue 应用实例(具备 mount/use/provide 接口)', () => {
    expect(typeof ctx.app.mount).toBe('function');
    expect(typeof ctx.app.use).toBe('function');
    expect(typeof ctx.app.provide).toBe('function');
  });

  it('pinia 是 Pinia 实例(具备 install 接口)', () => {
    expect(typeof (ctx.pinia as unknown as { install: unknown }).install).toBe(
      'function',
    );
  });
});
