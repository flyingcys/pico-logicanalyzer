import { inject } from 'vue';
import type { HostAdapter } from '../../platform/host/types';
import { getDefaultHost } from '../../platform/host/defaultHost';

interface UseHostOptions {
  fallback?: 'auto';
}

export function useHost(options?: UseHostOptions): HostAdapter {
  const host = inject<HostAdapter | null>('host', null);
  if (host) {
    return host;
  }

  if (options?.fallback === 'auto') {
    return getDefaultHost();
  }

  throw new Error('未注入 host 适配器；旧路径请显式使用 useHost({ fallback: \'auto\' })。');
}
