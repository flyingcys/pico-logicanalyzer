export interface FrontendDocumentData {
  uri?: string;
  fileName?: string;
  content?: string;
}

export interface FrontendBootstrap {
  mode: 'vscode' | 'browser';
  documentData?: FrontendDocumentData;
  [key: string]: unknown;
}

export interface FrontendHost {
  ready(): void | Promise<void>;
}
