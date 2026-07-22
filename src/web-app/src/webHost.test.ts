import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWebHost, readWebBootstrap } from './webHost';
import type { HostInboundMessage } from '@frontend-platform/host/types';

describe('readWebBootstrap', () => {
  it('声明 html host 与离线能力', () => {
    const b = readWebBootstrap();
    expect(b.host).toBe('html');
    expect(b.document).toBeUndefined();
    expect(b.capabilities).toEqual({
      canSave: true,
      canExport: true,
      canStartCapture: false,
      canConnectDevice: false,
    });
  });
});

describe('createWebHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loadInitialDocument 初始为 undefined', () => {
    expect(createWebHost().loadInitialDocument()).toBeUndefined();
  });

  it('loadDocument 更新文档并 emit documentLoaded', () => {
    const host = createWebHost();
    const messages: HostInboundMessage[] = [];
    host.onMessage((m) => messages.push(m));
    const doc = { uri: 'file:///a.lac', fileName: 'a.lac', content: '{}' };
    host.loadDocument(doc);
    expect(host.loadInitialDocument()).toEqual(doc);
    expect(messages.some((m) => m.type === 'documentLoaded')).toBe(true);
  });

  it('未支持的命令返回失败', async () => {
    const r = await createWebHost().sendCommand('startCapture');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/不支持/);
  });

  it('saveFile 触发浏览器下载', async () => {
    const host = createWebHost();
    host.loadDocument({
      uri: 'file:///a.lac',
      fileName: 'a.lac',
      content: '{"x":1}',
    });
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
      }
      return {} as HTMLElement;
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    // jsdom 的 appendChild/removeChild 校验真实 Node;createElement mock 返回的是假对象,
    // 需顺手 stub body 的两个方法,使 brief 实现里的 appendChild/removeChild 不抛错。
    vi.spyOn(document.body, 'appendChild').mockImplementation((n: Node) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n: Node) => n);
    const r = await host.sendCommand('saveFile', '{"x":1}');
    expect(r.success).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('sendCommand exportData 非 lac 格式返回失败', async () => {
    const host = createWebHost();
    host.loadDocument({
      uri: 'file:///a.lac',
      fileName: 'a.lac',
      content: '{}',
    });
    const r = await host.sendCommand('exportData', { format: 'csv' });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/不支持导出格式/);
  });

  it('exportData 直接调用非 lac 格式 emit error', () => {
    const host = createWebHost();
    host.loadDocument({
      uri: 'file:///a.lac',
      fileName: 'a.lac',
      content: '{}',
    });
    const errors: HostInboundMessage[] = [];
    host.onMessage((m) => errors.push(m));
    host.exportData({ format: 'csv' });
    expect(errors.some((m) => m.type === 'error')).toBe(true);
  });
});
