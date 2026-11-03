import type {
  HostAdapter,
  HostCommandResult,
  HostInboundMessage,
  HostMessageHandler,
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
} from '@frontend-platform/host/types';

const webCapabilities: FrontendCapabilities = {
  canSave: true,
  canExport: true,
  canStartCapture: false,
  canConnectDevice: false,
};

/** WebHost 在 HostAdapter 之上多一个 loadDocument,供 FileDropLayer 打开文件时灌入。 */
export interface WebHost extends HostAdapter {
  loadDocument(doc: FrontendDocumentData): void;
}

export function readWebBootstrap(): FrontendBootstrapData {
  return {
    host: 'html',
    document: undefined,
    capabilities: webCapabilities,
  };
}

function downloadText(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function createWebHost(): WebHost {
  let currentDocument: FrontendDocumentData | undefined;
  const handlers = new Set<HostMessageHandler>();

  const emit = (message: HostInboundMessage): void => {
    handlers.forEach((h) => h(message));
  };

  const host: WebHost = {
    ready() {
      // 无宿主握手,空实现
    },
    loadInitialDocument() {
      return currentDocument;
    },
    loadDocument(doc: FrontendDocumentData) {
      currentDocument = doc;
      emit({ type: 'documentLoaded', payload: doc } as HostInboundMessage);
    },
    saveDocument(payload: unknown) {
      const content =
        typeof payload === 'string' ? payload : JSON.stringify(payload);
      downloadText(
        currentDocument?.fileName ?? 'document.lac',
        content,
        'application/json',
      );
    },
    exportData(payload: unknown) {
      const format =
        (payload as { format?: string } | undefined)?.format ?? 'lac';
      if (format === 'lac' && currentDocument) {
        downloadText(
          currentDocument.fileName,
          currentDocument.content,
          'application/json',
        );
        return;
      }
      emit({
        type: 'error',
        payload: { message: `web 版暂不支持导出格式: ${format}` },
      } as HostInboundMessage);
    },
    connectDevice() {
      // 离线模式不支持
    },
    startCapture() {
      // 离线模式不支持
    },
    async sendCommand<T = unknown>(
      command: string,
      payload?: unknown,
    ): Promise<HostCommandResult<T>> {
      switch (command) {
        case 'export':
        case 'exportData': {
          const format =
            (payload as { format?: string } | undefined)?.format ?? 'lac';
          if (format !== 'lac') {
            return {
              success: false,
              error: `web 版暂不支持导出格式: ${format}`,
            };
          }
          host.exportData(payload);
          return { success: true };
        }
        case 'saveFile':
          host.saveDocument(payload);
          return { success: true };
        default:
          return {
            success: false,
            error: `web 版不支持命令: ${command}`,
          };
      }
    },
    onMessage(handler: HostMessageHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };

  return host;
}
