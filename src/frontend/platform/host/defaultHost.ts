import { createBrowserHost } from './browserHost';
import type { FrontendHostKind, HostAdapter } from './types';
import { createVsCodeHost } from './vscodeHost';

let cachedHosts: Partial<Record<FrontendHostKind, HostAdapter>> = {};

function getWindowLike(): (Window & typeof globalThis & {
  __FRONTEND_BOOTSTRAP__?: { host?: FrontendHostKind };
  vscode?: { postMessage?: (message: unknown) => unknown };
}) | undefined {
  return typeof window === 'undefined' ? undefined : window as Window & typeof globalThis & {
    __FRONTEND_BOOTSTRAP__?: { host?: FrontendHostKind };
    vscode?: { postMessage?: (message: unknown) => unknown };
  };
}

export function detectDefaultHostKind(): FrontendHostKind {
  const windowLike = getWindowLike();
  if (!windowLike) {
    return 'html';
  }

  const bootstrapHost = windowLike.__FRONTEND_BOOTSTRAP__?.host;
  if (bootstrapHost === 'vscode' || bootstrapHost === 'html') {
    return bootstrapHost;
  }

  if (windowLike.vscode?.postMessage) {
    return 'vscode';
  }

  return 'html';
}

export function createDefaultHost(kind: FrontendHostKind = detectDefaultHostKind()): HostAdapter {
  return kind === 'vscode' ? createVsCodeHost() : createBrowserHost();
}

export function getDefaultHost(kind: FrontendHostKind = detectDefaultHostKind()): HostAdapter {
  if (!cachedHosts[kind]) {
    cachedHosts[kind] = createDefaultHost(kind);
  }

  return cachedHosts[kind]!;
}

export function resetDefaultHostsForTest(): void {
  cachedHosts = {};
}
