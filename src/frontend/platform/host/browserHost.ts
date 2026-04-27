import type {
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
  HostAdapter,
  HostCommandResult,
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

function createInvalidLacError(): HostInboundMessage {
  return {
    type: 'error',
    payload: {
      message: '解析文件失败: 无效的.lac文件格式'
    }
  };
}

function parseLacPayload(payload: unknown): { content: string; parsed: unknown } | null {
  if (typeof payload === 'string') {
    try {
      return {
        content: payload,
        parsed: JSON.parse(payload)
      };
    } catch {
      return null;
    }
  }

  return {
    content: JSON.stringify(payload ?? {}, null, 2),
    parsed: payload ?? {}
  };
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
      const parsedDocument = parseLacPayload(payload);
      if (!parsedDocument) {
        emit(createInvalidLacError());
        return;
      }

      documentData = {
        ...documentData,
        content: parsedDocument.content
      };

      emit({
        type: 'documentUpdate',
        payload: parsedDocument.parsed
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
    async sendCommand<T = unknown>(command, payload): Promise<HostCommandResult<T>> {
      switch (command) {
        case 'export':
        case 'exportData':
          this.exportData(payload);
          return { success: true } as HostCommandResult<T>;
        case 'connectDevice':
          this.connectDevice();
          return { success: true } as HostCommandResult<T>;
        case 'startCapture':
          this.startCapture();
          return { success: true } as HostCommandResult<T>;
        default:
          emit({
            type: 'hostCommand',
            payload: {
              command,
              payload
            }
          });

          return {
            success: false,
            error: `HTML host 不支持命令: ${command}`
          } as HostCommandResult<T>;
      }
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
  const bootstrap = typeof window === 'undefined'
    ? undefined
    : (window as Window & typeof globalThis & {
        __FRONTEND_BOOTSTRAP__?: FrontendBootstrapData;
      }).__FRONTEND_BOOTSTRAP__;

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
