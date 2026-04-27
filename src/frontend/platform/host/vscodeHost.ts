import { normalizeHostMessage } from './messageBridge';
import type {
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
  HostAdapter,
  HostMessageHandler,
  VsCodeApiLike
} from './types';

const defaultCapabilities: FrontendCapabilities = {
  canSave: true,
  canExport: true,
  canStartCapture: true,
  canConnectDevice: true
};

function isDocumentData(value: unknown): value is FrontendDocumentData {
  return typeof value === 'object' && value !== null;
}

function getWindowBootstrap(): FrontendBootstrapData | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.__FRONTEND_BOOTSTRAP__;
}

function postVsCodeMessage(type: string, data?: unknown): void {
  const api: VsCodeApiLike | undefined = typeof window === 'undefined' ? undefined : window.vscode;
  api?.postMessage?.(data === undefined ? { type } : { type, data });
}

export function createVsCodeHost(): HostAdapter {
  return {
    ready() {
      postVsCodeMessage('ready');
    },
    loadInitialDocument() {
      return readVsCodeBootstrap().document;
    },
    saveDocument(payload) {
      postVsCodeMessage('save', payload);
    },
    exportData(payload) {
      postVsCodeMessage('export', payload);
    },
    connectDevice() {
      postVsCodeMessage('connectDevice');
    },
    startCapture() {
      postVsCodeMessage('startCapture');
    },
    sendCommand(command, payload) {
      postVsCodeMessage(command, payload);
    },
    onMessage(handler: HostMessageHandler) {
      if (typeof window === 'undefined') {
        return () => undefined;
      }

      const listener = (event: MessageEvent<unknown>) => {
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

  const legacyDocument = typeof window === 'undefined' ? undefined : window.documentData;

  return {
    host: 'vscode',
    document: isDocumentData(legacyDocument)
      ? {
          uri: String(legacyDocument.uri ?? ''),
          fileName: String(legacyDocument.fileName ?? ''),
          content: String(legacyDocument.content ?? '')
        }
      : undefined,
    capabilities: defaultCapabilities
  };
}
