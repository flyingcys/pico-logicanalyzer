import { getActivePinia } from 'pinia';
import { useSessionStore } from '../stores/sessionStore';
import type { HostAdapter } from '../../platform/host/types';

export async function initializeFrontend(host: HostAdapter): Promise<void> {
  const pinia = getActivePinia();
  if (!pinia) {
    throw new Error('Pinia 尚未初始化');
  }

  const initialDocument = await host.loadInitialDocument();
  const sessionStore = useSessionStore(pinia);
  sessionStore.applyDocument(initialDocument);
}
