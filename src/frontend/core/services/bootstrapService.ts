import { getActivePinia } from 'pinia';
import { useSessionStore } from '../stores/sessionStore';
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

export async function initializeFrontend(host: HostAdapter): Promise<void> {
  const pinia = getActivePinia();
  if (!pinia) {
    throw new Error('Pinia 尚未初始化');
  }

  const initialDocument = await host.loadInitialDocument();
  const sessionStore = useSessionStore(pinia);
  sessionStore.applyDocument(initialDocument);
}
