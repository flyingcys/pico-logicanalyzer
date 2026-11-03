import {
  createBrowserHost,
  readBrowserBootstrap
} from '../../../src/frontend/platform/host/browserHost';
import {
  createVsCodeHost,
  readVsCodeBootstrap
} from '../../../src/frontend/platform/host/vscodeHost';
import { normalizeHostMessage } from '../../../src/frontend/platform/host/messageBridge';
import type { HostInboundMessage } from '../../../src/frontend/platform/host/types';

describe('browserHost', () => {
  it('loadInitialDocument 应返回默认文档', () => {
    const host = createBrowserHost();
    const doc = host.loadInitialDocument();
    expect(doc).toBeDefined();
    expect(doc?.fileName).toBe('demo.lac');
    expect(doc?.uri).toBe('memory://logic-analyzer/demo.lac');
  });

  it('getStatus 应返回未连接状态', async () => {
    const host = createBrowserHost();
    const result = await host.sendCommand('getStatus');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data as { isConnected: boolean }).isConnected).toBe(false);
  });

  it('connectDevice 后应进入已连接状态', async () => {
    const host = createBrowserHost();
    const connectResult = await host.sendCommand('connectDevice', { type: 'serial' });
    expect(connectResult.success).toBe(true);

    const status = await host.sendCommand('getStatus');
    expect((status.data as { isConnected: boolean }).isConnected).toBe(true);
  });

  it('detectDevices 应返回设备数组', async () => {
    const host = createBrowserHost();
    const result = await host.sendCommand('detectDevices');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('disconnectDevice 应清除设备连接', async () => {
    const host = createBrowserHost();
    await host.sendCommand('connectDevice', { type: 'serial' });
    const result = await host.sendCommand('disconnectDevice');
    expect(result.success).toBe(true);
    const status = await host.sendCommand('getStatus');
    expect((status.data as { isConnected: boolean }).isConnected).toBe(false);
  });

  it('startCapture 在未连接时应失败', async () => {
    const host = createBrowserHost();
    const result = await host.sendCommand('startCapture', {
      config: {
        frequency: 1000000,
        preTriggerSamples: 0,
        postTriggerSamples: 100,
        triggerChannel: 0,
        triggerType: 'Edge',
        channels: [{ number: 0, enabled: true }]
      }
    });
    expect(result.success).toBe(false);
  });

  it('onMessage 应接收文档更新消息', async () => {
    const host = createBrowserHost();
    const messages: HostInboundMessage[] = [];
    host.onMessage(msg => messages.push(msg));

    host.saveDocument('{ "channels": [] }');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some(m => m.type === 'documentUpdate')).toBe(true);
  });

  it('未知命令应返回失败', async () => {
    const host = createBrowserHost();
    const result = await host.sendCommand('unknownCommand' as never);
    expect(result.success).toBe(false);
  });

  it('readBrowserBootstrap 应返回 html host 类型', () => {
    const bootstrap = readBrowserBootstrap();
    expect(bootstrap.host).toBe('html');
    expect(bootstrap.document).toBeDefined();
  });
});

describe('vscodeHost', () => {
  afterEach(() => {
    // 清理 window.vscode mock
    delete (global.window as { vscode?: unknown }).vscode;
    delete (global.window as { __FRONTEND_BOOTSTRAP__?: unknown }).__FRONTEND_BOOTSTRAP__;
  });

  it('无 vscode API 时 sendCommand 应返回失败', async () => {
    delete (global.window as { vscode?: unknown }).vscode;
    const host = createVsCodeHost();
    const result = await host.sendCommand('getStatus');
    expect(result.success).toBe(false);
    expect(result.error).toContain('不可用');
  });

  it('有 vscode API 时 ready 应调用 postMessage', () => {
    const postMessage = jest.fn();
    (global.window as { vscode?: { postMessage: jest.Mock } }).vscode = { postMessage };
    const host = createVsCodeHost();
    host.ready();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }));
  });

  it('connectDevice 应发送 connectDevice 消息', () => {
    const postMessage = jest.fn();
    (global.window as { vscode?: { postMessage: jest.Mock } }).vscode = { postMessage };
    const host = createVsCodeHost();
    host.connectDevice();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'connectDevice' }));
  });

  it('readVsCodeBootstrap 无注入数据时应返回 vscode host 默认值', () => {
    delete (global.window as { __FRONTEND_BOOTSTRAP__?: unknown }).__FRONTEND_BOOTSTRAP__;
    const bootstrap = readVsCodeBootstrap();
    expect(bootstrap.host).toBe('vscode');
    expect(bootstrap.capabilities.canSave).toBe(true);
  });
});

describe('messageBridge normalizeHostMessage', () => {
  it('非对象输入应返回 null', () => {
    expect(normalizeHostMessage(null)).toBeNull();
    expect(normalizeHostMessage(undefined)).toBeNull();
    expect(normalizeHostMessage('string')).toBeNull();
    expect(normalizeHostMessage(42)).toBeNull();
  });

  it('无 type 字段应返回 null', () => {
    expect(normalizeHostMessage({ payload: 'x' })).toBeNull();
  });

  it('带 payload 的消息应保留 payload', () => {
    const result = normalizeHostMessage({ type: 'documentUpdate', payload: { a: 1 } });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('documentUpdate');
    expect(result?.payload).toEqual({ a: 1 });
  });

  it('带 data 的消息应映射为 payload', () => {
    const result = normalizeHostMessage({ type: 'custom', data: 'hello' });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('custom');
    expect(result?.payload).toBe('hello');
  });

  it('error 类型带 message 应归一化为 payload', () => {
    const result = normalizeHostMessage({ type: 'error', message: '出错了' });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('error');
    expect(result?.payload).toEqual({ message: '出错了' });
  });

  it('仅 type 的消息应返回无 payload 的结构', () => {
    const result = normalizeHostMessage({ type: 'ping' });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('ping');
    expect(result?.payload).toBeUndefined();
  });
});
