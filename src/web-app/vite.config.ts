/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const frontend = (rel: string) =>
  fileURLToPath(new URL(`../frontend/${rel}`, import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // web-app/node_modules 与根 node_modules 各有一份 pinia/vue,
    // 两份的 piniaSymbol 不同会导致挂载使用 store 的组件时
    // 报 "getActivePinia() ... no active Pinia"。dedupe 强制单副本。
    dedupe: ['pinia', 'vue'],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      include: ['src/**/*.{ts,vue}'],
      thresholds: {
        branches: 65,
        functions: 75,
        lines: 85,
        statements: 85,
        'src/main-web.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  },
});
