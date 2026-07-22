/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const frontend = (rel: string) =>
  fileURLToPath(new URL(`../src/frontend/${rel}`, import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // 长前缀在前,避免被 '@frontend' 短别名先吞掉
      { find: '@frontend-app', replacement: frontend('app') },
      { find: '@frontend-core', replacement: frontend('core') },
      { find: '@frontend-platform', replacement: frontend('platform') },
      { find: '@frontend-shared', replacement: frontend('shared') },
      { find: '@frontend', replacement: frontend('') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
