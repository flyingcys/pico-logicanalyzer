export type FrontendHostKind = 'vscode' | 'html';

export interface FrontendDocumentData {
  uri: string;
  fileName: string;
  content: string;
}

export interface FrontendCapabilities {
  canSave: boolean;
  canExport: boolean;
  canStartCapture: boolean;
  canConnectDevice: boolean;
}

export interface FrontendBootstrapData {
  host: FrontendHostKind;
  document?: FrontendDocumentData;
  capabilities: FrontendCapabilities;
}

export interface HostInboundMessage<TPayload = unknown> {
  type: string;
  payload?: TPayload;
  raw?: unknown;
}

export type HostMessageHandler = (message: HostInboundMessage) => void;

export interface HostAdapter {
  ready(): void | Promise<void>;
  loadInitialDocument():
    | FrontendDocumentData
    | undefined
    | Promise<FrontendDocumentData | undefined>;
  saveDocument(payload: unknown): void | Promise<void>;
  exportData(payload: unknown): void | Promise<void>;
  connectDevice(): void | Promise<void>;
  startCapture(): void | Promise<void>;
  sendCommand(command: string, payload?: unknown): void | Promise<void>;
  onMessage(handler: HostMessageHandler): () => void;
}

export interface VsCodeApiLike {
  postMessage?: (message: unknown) => void;
}
