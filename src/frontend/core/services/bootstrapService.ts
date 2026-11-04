import { getActivePinia } from 'pinia';
import { useSessionStore } from '../stores/sessionStore';
import { useUiStore } from '../stores/uiStore';
import type {
  FrontendDocumentData,
  HostAdapter,
  HostInboundMessage
} from '../../platform/host/types';

function isFrontendDocumentData(payload: unknown): payload is FrontendDocumentData {
  return typeof payload === 'object'
    && payload !== null
    && typeof (payload as FrontendDocumentData).uri === 'string'
    && typeof (payload as FrontendDocumentData).fileName === 'string'
    && typeof (payload as FrontendDocumentData).content === 'string';
}

export function bindHostDocumentUpdates(
  host: Pick<HostAdapter, 'onMessage'>,
  applyDocument: (document: FrontendDocumentData) => void
): () => void {
  const unsubscribe = host.onMessage((message: HostInboundMessage) => {
    if (
      (message.type === 'documentUpdate' || message.type === 'documentLoaded')
      && isFrontendDocumentData(message.payload)
    ) {
      applyDocument(message.payload);
    }
  });

  return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
}

/**
 * 绑定 KeyboardShortcutManager 派发的两个全局事件到 uiStore。
 *
 * `panel-toggle('decoder')` 采用 toggle 语义：当前在解码面板则退到性能面板，
 * 反之切回解码面板。快捷键声明是「切换解码器面板」，且默认 activeTab 就是
 * decoder —— 若实现成「直接赋值 decoder」，按了等于没按（判据恒真）。
 */
export function bindShortcutEvents(pinia = getActivePinia()): () => void {
  if (!pinia) {
    return () => undefined;
  }

  const uiStore = useUiStore(pinia);

  const handleShowShortcutHelp = () => {
    uiStore.showShortcutHelp = true;
  };

  const handlePanelToggle = (event: Event) => {
    const panel = (event as CustomEvent<string>).detail;
    if (panel === 'decoder') {
      uiStore.activeTab = uiStore.activeTab === 'decoder' ? 'performance' : 'decoder';
    }
  };

  window.addEventListener('show-shortcut-help', handleShowShortcutHelp);
  window.addEventListener('panel-toggle', handlePanelToggle);

  return () => {
    window.removeEventListener('show-shortcut-help', handleShowShortcutHelp);
    window.removeEventListener('panel-toggle', handlePanelToggle);
  };
}

export async function initializeFrontend(host: HostAdapter): Promise<void> {
  const pinia = getActivePinia();
  if (!pinia) {
    throw new Error('Pinia 尚未初始化');
  }

  const initialDocument = await host.loadInitialDocument();
  const sessionStore = useSessionStore(pinia);
  sessionStore.applyDocument(initialDocument);
}
