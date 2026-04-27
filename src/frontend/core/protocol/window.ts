export interface VsCodeApiLike {
  postMessage?: (message: unknown) => void;
}

export interface FrontendWindowDocumentData {
  uri?: string;
  fileName?: string;
  content?: string;
}
