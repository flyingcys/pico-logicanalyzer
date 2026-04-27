export type FrontendHostKind = 'vscode' | 'html';

export interface HostCommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

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

export interface HostMessageBase<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
  raw?: unknown;
}

export type HostDocumentMessage = HostMessageBase<'documentUpdate' | 'documentLoaded', unknown>;

export type HostErrorMessage = HostMessageBase<'error', { message: string }>;

export type HostCommandMessage = HostMessageBase<
  'export' | 'connectDevice' | 'startCapture' | 'testResponse',
  unknown
>;

export type HostCustomMessage = {
  type: string;
  payload?: unknown;
  raw?: unknown;
};

export type HostInboundMessage =
  | HostDocumentMessage
  | HostErrorMessage
  | HostCommandMessage
  | HostCustomMessage;

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
  sendCommand<T = unknown>(command: string, payload?: unknown): Promise<HostCommandResult<T>>;
  onMessage(handler: HostMessageHandler): () => void;
}

export interface VsCodeApiLike {
  postMessage?: (message: unknown) => unknown;
}
