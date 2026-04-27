export const WEBVIEW_ASSET_MANIFEST_FILE = 'webview-manifest.json';
export const WEBVIEW_VSCODE_SCRIPT_KEY = 'main-vscode.js';
export const WEBVIEW_HTML_SCRIPT_KEY = 'main-html.js';
export const WEBVIEW_HTML_PAGE_KEY = 'html/index.html';

export interface WebviewAssetManifest {
  [assetKey: string]: string | undefined;
}
