import type {
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
  HostAdapter,
  HostInboundMessage,
  HostMessageHandler
} from './types';

const defaultCapabilities: FrontendCapabilities = {
  canSave: false,
  canExport: true,
  canStartCapture: false,
  canConnectDevice: false
};

function cloneDocument(document?: FrontendDocumentData): FrontendDocumentData | undefined {
  return document ? { ...document } : undefined;
}

function createDefaultDocument(): FrontendDocumentData {
  return {
    uri: 'memory://logic-analyzer/demo.lac',
    fileName: 'demo.lac',
    content: '{\n  "channels": []\n}'
  };
}

export function createBrowserHost(): HostAdapter {
  const bootstrap = readBrowserBootstrap();
  const handlers = new Set<HostMessageHandler>();
  let documentData = cloneDocument(bootstrap.document) ?? createDefaultDocument();

  const emit = (message: HostInboundMessage) => {
    handlers.forEach(handler => handler(message));
  };

  return {
    ready() {},
    loadInitialDocument() {
      return cloneDocument(documentData);
    },
    saveDocument(payload) {
      const content =
        typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}, null, 2);

      documentData = {
        ...documentData,
        content
      };

      emit({
        type: 'documentUpdate',
        payload: cloneDocument(documentData)
      });
    },
    exportData(payload) {
      emit({
        type: 'export',
        payload
      });
    },
    connectDevice() {
      emit({
        type: 'connectDevice'
      });
    },
    startCapture() {
      emit({
        type: 'startCapture'
      });
    },
    sendCommand(command, payload) {
      emit({
        type: command,
        payload
      });
    },
    onMessage(handler: HostMessageHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}

export function readBrowserBootstrap(): FrontendBootstrapData {
  const bootstrap = typeof window === 'undefined' ? undefined : window.__FRONTEND_BOOTSTRAP__;

  if (bootstrap?.host === 'html') {
    return {
      ...bootstrap,
      capabilities: {
        ...defaultCapabilities,
        ...bootstrap.capabilities
      }
    };
  }

  return {
    host: 'html',
    document: createDefaultDocument(),
    capabilities: defaultCapabilities
  };
}
