import { normalizeHostMessage } from './messageBridge';
import type {
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
  HostAdapter,
  HostCommandResult,
  HostMessageHandler,
  VsCodeApiLike
} from './types';

const defaultCapabilities: FrontendCapabilities = {
  canSave: true,
  canExport: true,
  canStartCapture: true,
  canConnectDevice: true
};

export const HOST_COMMAND_TIMEOUT_MS = 10000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getWindowBootstrap(): FrontendBootstrapData | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as Window & typeof globalThis & {
    __FRONTEND_BOOTSTRAP__?: FrontendBootstrapData;
  }).__FRONTEND_BOOTSTRAP__;
}

function getWindowLike(): (Window & typeof globalThis & {
  vscode?: VsCodeApiLike;
}) | undefined {
  return typeof window === 'undefined' ? undefined : window as Window & typeof globalThis & {
    vscode?: VsCodeApiLike;
  };
}

function postVsCodeMessage(message: Record<string, unknown>): void {
  const api: VsCodeApiLike | undefined = getWindowLike()?.vscode;
  api?.postMessage?.(message);
}

export function createVsCodeHost(): HostAdapter {
  let requestSequence = 0;
  const pendingCommands = new Map<
    string,
    {
      resolve: (result: HostCommandResult<any>) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();
  let removeCommandResultListener: (() => void) | undefined;

  const cleanupCommandResultListener = () => {
    if (pendingCommands.size === 0 && removeCommandResultListener) {
      removeCommandResultListener();
      removeCommandResultListener = undefined;
    }
  };

  const ensureCommandResultListener = () => {
    if (removeCommandResultListener || typeof window === 'undefined') {
      return;
    }

    const listener = (event: MessageEvent<unknown>) => {
      const raw = event.data;
      if (
        !isRecord(raw) ||
        raw.type !== 'hostCommandResult' ||
        typeof raw.requestId !== 'string' ||
        !pendingCommands.has(raw.requestId)
      ) {
        return;
      }

      const pending = pendingCommands.get(raw.requestId);
      pendingCommands.delete(raw.requestId);
      clearTimeout(pending?.timeoutId);
      cleanupCommandResultListener();

      pending?.resolve({
        success: raw.success === true,
        data: raw.data,
        error: typeof raw.error === 'string' ? raw.error : undefined
      });
    };

    window.addEventListener('message', listener);
    removeCommandResultListener = () => {
      window.removeEventListener('message', listener);
    };
  };

  return {
    ready() {
      return postVsCodeMessage({ type: 'ready' });
    },
    loadInitialDocument() {
      return readVsCodeBootstrap().document;
    },
    saveDocument(payload) {
      return postVsCodeMessage({ type: 'save', data: payload });
    },
    exportData(payload) {
      return postVsCodeMessage({ type: 'export', data: payload });
    },
    connectDevice() {
      return postVsCodeMessage({ type: 'connectDevice' });
    },
    startCapture() {
      return postVsCodeMessage({ type: 'startCapture' });
    },
    sendCommand<T = unknown>(command, payload) {
      const windowLike = getWindowLike();
      if (!windowLike?.vscode?.postMessage) {
        return Promise.resolve({
          success: false,
          error: 'VSCode host 不可用'
        } as HostCommandResult<T>);
      }

      ensureCommandResultListener();

      return new Promise<HostCommandResult<T>>(resolve => {
        const requestId = `host-command-${++requestSequence}`;
        const timeoutId = setTimeout(() => {
          const pending = pendingCommands.get(requestId);
          if (!pending) {
            return;
          }

          pendingCommands.delete(requestId);
          cleanupCommandResultListener();
          pending.resolve({
            success: false,
            error: `Host command timed out: ${command}`
          });
        }, HOST_COMMAND_TIMEOUT_MS);

        pendingCommands.set(requestId, {
          resolve: result => resolve(result as HostCommandResult<T>),
          timeoutId
        });

        postVsCodeMessage({
          type: 'hostCommand',
          command,
          payload,
          requestId
        });
      });
    },
    onMessage(handler: HostMessageHandler) {
      if (typeof window === 'undefined') {
        return () => undefined;
      }

      const listener = (event: MessageEvent<unknown>) => {
        if (isRecord(event.data) && event.data.type === 'hostCommandResult') {
          return;
        }

        const message = normalizeHostMessage(event.data);
        if (message) {
          handler(message);
        }
      };

      window.addEventListener('message', listener);

      return () => {
        window.removeEventListener('message', listener);
      };
    }
  };
}

export function readVsCodeBootstrap(): FrontendBootstrapData {
  const bootstrap = getWindowBootstrap();
  if (bootstrap?.host === 'vscode') {
    return {
      ...bootstrap,
      capabilities: {
        ...defaultCapabilities,
        ...bootstrap.capabilities
      }
    };
  }

  return {
    host: 'vscode',
    document: undefined,
    capabilities: defaultCapabilities
  };
}
