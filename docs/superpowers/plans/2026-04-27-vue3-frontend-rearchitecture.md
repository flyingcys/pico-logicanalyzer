# Vue 3 前端重构与 HTML 复用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 `src/webview` 一次性重构为 `Vue 3 App + Core + Platform` 三层架构，建立 `VS Code Webview` 与独立 `HTML` 双入口，并消除组件对 `window.vscode` 的直接依赖。

**Architecture:** 保留现有 `Vue 3`、`Element Plus`、波形渲染引擎和主要组件资产，但重组目录为 `src/frontend/app`、`src/frontend/core`、`src/frontend/platform`、`src/frontend/shared`。所有宿主交互统一收口到 `HostAdapter`，由 `vscodeHost` 和 `browserHost` 分别实现；`Pinia` 负责应用状态分层，页面层只做装配和展示。

**Tech Stack:** TypeScript、Vue 3、Pinia、Element Plus、Webpack、VS Code Webview API、Jest

---

> **执行状态（2026-04-27）**：Task 1 到 Task 9 已按本计划完成实现。下方 checklist 保留为执行时的原始拆分记录，用于回溯，不再表示当前未完成状态。

## 文件结构总览

### 新增目录

- `src/frontend/app/`
- `src/frontend/app/components/`
- `src/frontend/app/composables/`
- `src/frontend/app/layouts/`
- `src/frontend/core/models/`
- `src/frontend/core/protocol/`
- `src/frontend/core/services/`
- `src/frontend/core/stores/`
- `src/frontend/platform/bootstrap/`
- `src/frontend/platform/host/`
- `src/frontend/shared/i18n/`
- `src/frontend/shared/styles/`

### 新增关键文件

- `src/frontend/app/main-vscode.ts`
- `src/frontend/app/main-html.ts`
- `src/frontend/app/App.vue`
- `src/frontend/platform/bootstrap/createFrontendApp.ts`
- `src/frontend/platform/host/types.ts`
- `src/frontend/platform/host/vscodeHost.ts`
- `src/frontend/platform/host/browserHost.ts`
- `src/frontend/platform/host/messageBridge.ts`
- `src/frontend/core/stores/sessionStore.ts`
- `src/frontend/core/stores/deviceStore.ts`
- `src/frontend/core/stores/waveformStore.ts`
- `src/frontend/core/stores/decoderStore.ts`
- `src/frontend/core/stores/uiStore.ts`
- `src/frontend/app/composables/useWaveformViewport.ts`
- `src/frontend/app/composables/useHost.ts`
- `src/frontend/shared/styles/webview.css`
- `src/frontend/shared/styles/html.css`

### 主要修改文件

- `webpack.config.js`
- `tsconfig.json`
- `src/providers/LACEditorProvider.ts`
- `src/webview/shims-vue.d.ts`
- `tests/unit/webview/main.test.ts`
- `tests/fixtures/mocks/styleMock.js`

### 待迁移的现有前端资产

- `src/webview/App.vue`
- `src/webview/components/*.vue`
- `src/webview/engines/*.ts`
- `src/webview/i18n/*.ts`
- `src/webview/utils/*.ts`

## Task 1: 建立新前端骨架与双入口

**Files:**
- Create: `src/frontend/app/main-vscode.ts`
- Create: `src/frontend/app/main-html.ts`
- Create: `src/frontend/app/App.vue`
- Create: `src/frontend/platform/bootstrap/createFrontendApp.ts`
- Modify: `tsconfig.json`
- Modify: `src/webview/shims-vue.d.ts`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 创建目标目录结构**

```bash
mkdir -p \
  src/frontend/app/components \
  src/frontend/app/composables \
  src/frontend/app/layouts \
  src/frontend/core/models \
  src/frontend/core/protocol \
  src/frontend/core/services \
  src/frontend/core/stores \
  src/frontend/platform/bootstrap \
  src/frontend/platform/host \
  src/frontend/shared/i18n \
  src/frontend/shared/styles
```

- [ ] **Step 2: 编写统一应用创建器**

```ts
// src/frontend/platform/bootstrap/createFrontendApp.ts
import { createApp, type App as VueApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import i18n from '../../shared/i18n';
import App from '../../app/App.vue';
import type { HostAdapter, FrontendBootstrapData } from '../host/types';

export interface FrontendAppContext {
  app: VueApp;
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}

export function createFrontendApp(
  host: HostAdapter,
  bootstrap: FrontendBootstrapData
): FrontendAppContext {
  const app = createApp(App);
  app.use(createPinia());
  app.use(ElementPlus);
  app.use(i18n);
  app.provide('host', host);
  app.provide('bootstrap', bootstrap);
  return { app, host, bootstrap };
}
```

- [ ] **Step 3: 建立两个入口文件**

```ts
// src/frontend/app/main-vscode.ts
import { createFrontendApp } from '../platform/bootstrap/createFrontendApp';
import { createVsCodeHost, readVsCodeBootstrap } from '../platform/host/vscodeHost';

const bootstrap = readVsCodeBootstrap();
const host = createVsCodeHost();
const { app } = createFrontendApp(host, bootstrap);
app.mount('#app');
host.ready();
```

```ts
// src/frontend/app/main-html.ts
import { createFrontendApp } from '../platform/bootstrap/createFrontendApp';
import { createBrowserHost, readBrowserBootstrap } from '../platform/host/browserHost';

const bootstrap = readBrowserBootstrap();
const host = createBrowserHost();
const { app } = createFrontendApp(host, bootstrap);
app.mount('#app');
host.ready();
```

- [ ] **Step 4: 暂时创建最小 App 壳**

```vue
<!-- src/frontend/app/App.vue -->
<script setup lang="ts">
import { useSessionStore } from '../core/stores/sessionStore';

const sessionStore = useSessionStore();
</script>

<template>
  <div class="logic-analyzer-app">
    <div class="app-shell">
      <header class="app-header">{{ sessionStore.fileName || 'Logic Analyzer' }}</header>
      <main class="app-main"></main>
    </div>
  </div>
</template>
```

- [ ] **Step 5: 调整 TypeScript 路径与 include**

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"],
      "@frontend/*": ["src/frontend/*"],
      "@frontend-app/*": ["src/frontend/app/*"],
      "@frontend-core/*": ["src/frontend/core/*"],
      "@frontend-platform/*": ["src/frontend/platform/*"],
      "@frontend-shared/*": ["src/frontend/shared/*"],
      "@drivers/*": ["src/drivers/*"],
      "@models/*": ["src/models/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

- [ ] **Step 6: 先让入口测试指向新入口**

```ts
// tests/unit/webview/main.test.ts
await import('../../../src/frontend/app/main-vscode');
```

- [ ] **Step 7: 运行入口单测，确认双入口骨架可加载**

Run: `npm run test -- tests/unit/webview/main.test.ts --runInBand`

Expected: `main-vscode` 成功创建 app，插件安装顺序与挂载点断言通过。

## Task 2: 定义宿主协议与 HostAdapter

**Files:**
- Create: `src/frontend/platform/host/types.ts`
- Create: `src/frontend/platform/host/messageBridge.ts`
- Create: `src/frontend/platform/host/vscodeHost.ts`
- Create: `src/frontend/platform/host/browserHost.ts`
- Modify: `src/providers/LACEditorProvider.ts`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 定义前端 bootstrap 与消息协议**

```ts
// src/frontend/platform/host/types.ts
export interface FrontendBootstrapData {
  host: 'vscode' | 'html';
  document?: {
    uri: string;
    fileName: string;
    content: string;
  };
  capabilities: {
    canSave: boolean;
    canExport: boolean;
    canStartCapture: boolean;
    canConnectDevice: boolean;
  };
}

export interface HostInboundMessage {
  type: string;
  payload?: unknown;
}

export interface HostAdapter {
  ready(): void;
  loadInitialDocument(): Promise<FrontendBootstrapData['document'] | null>;
  saveDocument(payload: unknown): Promise<void>;
  exportData(payload: unknown): Promise<void>;
  connectDevice(): Promise<void>;
  startCapture(): Promise<void>;
  sendCommand(command: string, payload?: unknown): Promise<void>;
  onMessage(handler: (message: HostInboundMessage) => void): () => void;
}
```

- [ ] **Step 2: 建立消息桥**

```ts
// src/frontend/platform/host/messageBridge.ts
import type { HostInboundMessage } from './types';

export function normalizeHostMessage(raw: unknown): HostInboundMessage {
  const source = (raw ?? {}) as { type?: unknown; data?: unknown; message?: unknown };
  return {
    type: typeof source.type === 'string' ? source.type : 'unknown',
    payload: source.data ?? source.message ?? undefined
  };
}
```

- [ ] **Step 3: 实现 VS Code 宿主适配器**

```ts
// src/frontend/platform/host/vscodeHost.ts
import { normalizeHostMessage } from './messageBridge';
import type { FrontendBootstrapData, HostAdapter, HostInboundMessage } from './types';

declare global {
  interface Window {
    vscode?: { postMessage(message: unknown): void };
    __FRONTEND_BOOTSTRAP__?: FrontendBootstrapData;
  }
}

export function readVsCodeBootstrap(): FrontendBootstrapData {
  return (
    window.__FRONTEND_BOOTSTRAP__ ?? {
      host: 'vscode',
      capabilities: {
        canSave: true,
        canExport: true,
        canStartCapture: true,
        canConnectDevice: true
      }
    }
  );
}

export function createVsCodeHost(): HostAdapter {
  return {
    ready() {
      window.vscode?.postMessage({ type: 'ready' });
    },
    async loadInitialDocument() {
      return readVsCodeBootstrap().document ?? null;
    },
    async saveDocument(payload) {
      window.vscode?.postMessage({ type: 'save', data: payload });
    },
    async exportData(payload) {
      window.vscode?.postMessage({ type: 'export', data: payload });
    },
    async connectDevice() {
      window.vscode?.postMessage({ type: 'connectDevice' });
    },
    async startCapture() {
      window.vscode?.postMessage({ type: 'startCapture' });
    },
    async sendCommand(command, payload) {
      window.vscode?.postMessage({ type: command, data: payload });
    },
    onMessage(handler) {
      const listener = (event: MessageEvent) => handler(normalizeHostMessage(event.data));
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    }
  };
}
```

- [ ] **Step 4: 实现 HTML 宿主适配器**

```ts
// src/frontend/platform/host/browserHost.ts
import type { FrontendBootstrapData, HostAdapter } from './types';

export function readBrowserBootstrap(): FrontendBootstrapData {
  return {
    host: 'html',
    document: {
      uri: 'demo://sample.lac',
      fileName: 'sample.lac',
      content: '{"sampleRate":24000000,"totalSamples":0,"channels":[]}'
    },
    capabilities: {
      canSave: true,
      canExport: true,
      canStartCapture: false,
      canConnectDevice: false
    }
  };
}

export function createBrowserHost(): HostAdapter {
  const listeners = new Set<(message: { type: string; payload?: unknown }) => void>();
  return {
    ready() {},
    async loadInitialDocument() {
      return readBrowserBootstrap().document ?? null;
    },
    async saveDocument() {},
    async exportData() {},
    async connectDevice() {},
    async startCapture() {},
    async sendCommand(command, payload) {
      listeners.forEach(listener => listener({ type: command, payload }));
    },
    onMessage(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }
  };
}
```

- [ ] **Step 5: 让 LACEditorProvider 注入统一 bootstrap，而不是散装全局变量**

```ts
// src/providers/LACEditorProvider.ts
const bootstrapData = {
  host: 'vscode',
  document: {
    uri: document.uri.toString(),
    fileName: path.basename(document.uri.fsPath),
    content: document.getText()
  },
  capabilities: {
    canSave: true,
    canExport: true,
    canStartCapture: true,
    canConnectDevice: true
  }
};
```

```html
<script nonce="${nonce}">
  window.vscode = acquireVsCodeApi();
  window.__FRONTEND_BOOTSTRAP__ = ${JSON.stringify(bootstrapData)};
</script>
```

- [ ] **Step 6: 更新入口测试 mock**

```ts
// tests/unit/webview/main.test.ts
delete (window as any).__FRONTEND_BOOTSTRAP__;
(window as any).__FRONTEND_BOOTSTRAP__ = {
  host: 'vscode',
  capabilities: {
    canSave: true,
    canExport: true,
    canStartCapture: true,
    canConnectDevice: true
  }
};
```

- [ ] **Step 7: 运行入口测试，确认 bootstrap 和 ready 行为稳定**

Run: `npm run test -- tests/unit/webview/main.test.ts --runInBand`

Expected: `window.__FRONTEND_BOOTSTRAP__` 被读取，`ready` 消息只经由 `HostAdapter` 发送。

## Task 3: 建立 Pinia 状态中心与初始化流程

**Files:**
- Create: `src/frontend/core/stores/sessionStore.ts`
- Create: `src/frontend/core/stores/deviceStore.ts`
- Create: `src/frontend/core/stores/waveformStore.ts`
- Create: `src/frontend/core/stores/decoderStore.ts`
- Create: `src/frontend/core/stores/uiStore.ts`
- Create: `src/frontend/core/services/bootstrapService.ts`
- Modify: `src/frontend/app/App.vue`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 建立 session store**

```ts
// src/frontend/core/stores/sessionStore.ts
import { defineStore } from 'pinia';

export const useSessionStore = defineStore('session', {
  state: () => ({
    fileName: '',
    sampleRate: 0,
    totalSamples: 0,
    hasData: false
  }),
  actions: {
    applyDocument(document: { fileName: string; content: string }) {
      this.fileName = document.fileName;
      const parsed = JSON.parse(document.content || '{}');
      this.sampleRate = parsed.sampleRate || 0;
      this.totalSamples = parsed.totalSamples || 0;
      this.hasData = !!parsed;
    }
  }
});
```

- [ ] **Step 2: 建立其他 store 的最小骨架**

```ts
// src/frontend/core/stores/deviceStore.ts
import { defineStore } from 'pinia';
export const useDeviceStore = defineStore('device', {
  state: () => ({
    isConnected: false,
    isConnecting: false,
    isCapturing: false,
    currentDevice: null as unknown
  })
});
```

```ts
// src/frontend/core/stores/waveformStore.ts
import { defineStore } from 'pinia';
export const useWaveformStore = defineStore('waveform', {
  state: () => ({
    zoomLevel: 1,
    panOffset: 0,
    viewRange: { firstSample: 0, visibleSamples: 1000 }
  })
});
```

```ts
// src/frontend/core/stores/decoderStore.ts
import { defineStore } from 'pinia';
export const useDecoderStore = defineStore('decoder', {
  state: () => ({
    activeDecoderConfigs: [] as unknown[],
    decoderErrors: [] as unknown[],
    channelConflicts: [] as unknown[]
  })
});
```

```ts
// src/frontend/core/stores/uiStore.ts
import { defineStore } from 'pinia';
export const useUiStore = defineStore('ui', {
  state: () => ({
    activeTab: 'decoder',
    showShortcutHelp: false
  })
});
```

- [ ] **Step 3: 创建 bootstrap 服务，负责读取初始文档并灌入 store**

```ts
// src/frontend/core/services/bootstrapService.ts
import type { HostAdapter } from '../../platform/host/types';
import { useSessionStore } from '../stores/sessionStore';

export async function initializeFrontend(host: HostAdapter): Promise<void> {
  const document = await host.loadInitialDocument();
  if (!document) return;
  const sessionStore = useSessionStore();
  sessionStore.applyDocument(document);
}
```

- [ ] **Step 4: 在 App 壳中调用初始化流程**

```vue
<script setup lang="ts">
import { inject, onMounted } from 'vue';
import { initializeFrontend } from '../core/services/bootstrapService';
import { useSessionStore } from '../core/stores/sessionStore';
import type { HostAdapter } from '../platform/host/types';

const host = inject<HostAdapter>('host')!;
const sessionStore = useSessionStore();

onMounted(async () => {
  await initializeFrontend(host);
});
</script>
```

- [ ] **Step 5: 入口测试新增 bootstrap 初始化断言**

```ts
expect(document.body.innerHTML).toContain('app');
```

- [ ] **Step 6: 运行入口测试，确认最小状态流成立**

Run: `npm run test -- tests/unit/webview/main.test.ts --runInBand`

Expected: 文档 bootstrap 能进入 `sessionStore`，`App.vue` 能读取到 `fileName`。

## Task 4: 拆分 App 壳与布局容器

**Files:**
- Create: `src/frontend/app/layouts/AnalyzerLayout.vue`
- Create: `src/frontend/app/components/AppHeader.vue`
- Create: `src/frontend/app/components/AppSidebarLeft.vue`
- Create: `src/frontend/app/components/AppSidebarRight.vue`
- Create: `src/frontend/app/components/AppStatusbar.vue`
- Modify: `src/frontend/app/App.vue`
- Modify: `src/webview/components/*.vue`（逐步迁移到 `src/frontend/app/components/`）
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 从旧 App.vue 中抽出总布局**

```vue
<!-- src/frontend/app/layouts/AnalyzerLayout.vue -->
<template>
  <div class="analyzer-layout">
    <slot name="header" />
    <div class="analyzer-layout__body">
      <slot name="left" />
      <slot />
      <slot name="right" />
    </div>
    <slot name="footer" />
  </div>
</template>
```

- [ ] **Step 2: 创建新的 App 组合壳**

```vue
<!-- src/frontend/app/App.vue -->
<script setup lang="ts">
import AnalyzerLayout from './layouts/AnalyzerLayout.vue';
import AppHeader from './components/AppHeader.vue';
import AppSidebarLeft from './components/AppSidebarLeft.vue';
import AppSidebarRight from './components/AppSidebarRight.vue';
import AppStatusbar from './components/AppStatusbar.vue';
</script>

<template>
  <AnalyzerLayout>
    <template #header><AppHeader /></template>
    <template #left><AppSidebarLeft /></template>
    <div class="waveform-stage"></div>
    <template #right><AppSidebarRight /></template>
    <template #footer><AppStatusbar /></template>
  </AnalyzerLayout>
</template>
```

- [ ] **Step 3: 先迁移纯展示容器，再迁移复杂组件**

```text
优先顺序：
1. StatusBar.vue
2. LanguageSwitcher.vue
3. NotificationCenter.vue
4. ShortcutHelpDialog.vue
5. DeviceManager.vue / DecoderPanel.vue / PerformanceAnalyzer.vue
```

- [ ] **Step 4: 保留旧组件实现，先通过新壳组合接入**

```vue
<!-- src/frontend/app/components/AppHeader.vue -->
<script setup lang="ts">
import LanguageSwitcher from '../../webview/components/LanguageSwitcher.vue';
</script>

<template>
  <header class="app-header">
    <LanguageSwitcher />
  </header>
</template>
```

- [ ] **Step 5: 运行入口测试和构建，确认页面装配无语法回归**

Run: `npm run build`

Expected: 新 `App.vue` 能参与打包；老组件仍可先通过桥接方式编译通过。

## Task 5: 把波形与交互生命周期迁移到 composable/service

**Files:**
- Create: `src/frontend/app/composables/useWaveformViewport.ts`
- Create: `src/frontend/core/services/waveformService.ts`
- Modify: `src/webview/engines/WaveformRenderer.ts`（如需类型导出）
- Modify: `src/webview/engines/InteractionEngine.ts`
- Modify: `src/frontend/app/components/AppWaveformStage.vue`
- Modify: `src/frontend/app/App.vue`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 抽取波形挂载 composable**

```ts
// src/frontend/app/composables/useWaveformViewport.ts
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { WaveformRenderer } from '../../webview/engines/WaveformRenderer';

export function useWaveformViewport() {
  const containerRef = ref<HTMLElement | null>(null);
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  let renderer: WaveformRenderer | null = null;

  onMounted(async () => {
    await nextTick();
    if (canvasRef.value) {
      renderer = new WaveformRenderer(canvasRef.value);
      renderer.resize();
    }
  });

  onUnmounted(() => {
    renderer?.dispose();
    renderer = null;
  });

  return { containerRef, canvasRef };
}
```

- [ ] **Step 2: 创建独立波形舞台组件**

```vue
<!-- src/frontend/app/components/AppWaveformStage.vue -->
<script setup lang="ts">
import { useWaveformViewport } from '../composables/useWaveformViewport';
const { containerRef, canvasRef } = useWaveformViewport();
</script>

<template>
  <section ref="containerRef" class="waveform-stage">
    <canvas ref="canvasRef" />
  </section>
</template>
```

- [ ] **Step 3: 从旧 App.vue 删除 renderer 生命周期代码，改由 composable 承担**

```text
迁移掉的旧职责：
- setupCanvas()
- cleanupCanvas()
- waveformCanvas / waveformContainer
- onMounted 内 renderer 初始化
```

- [ ] **Step 4: 运行构建，确认波形入口可编译**

Run: `npm run build`

Expected: `WaveformRenderer` 只在 composable 中绑定，页面层不再直接持有 renderer 生命周期。

## Task 6: 清理组件中的 `window.vscode` 直连

**Files:**
- Create: `src/frontend/app/composables/useHost.ts`
- Modify: `src/webview/components/NetworkConfigurationPanel.vue`
- Modify: `src/webview/components/DeviceManager.vue`
- Modify: `src/webview/components/DataExporter.vue`
- Modify: `src/webview/components/StatusBar.vue`
- Modify: `src/webview/utils/KeyboardShortcutManager.ts`
- Modify: `src/frontend/app/App.vue`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 创建 host 注入读取 composable**

```ts
// src/frontend/app/composables/useHost.ts
import { inject } from 'vue';
import type { HostAdapter } from '../../platform/host/types';

export function useHost(): HostAdapter {
  const host = inject<HostAdapter>('host');
  if (!host) throw new Error('HostAdapter 未注入');
  return host;
}
```

- [ ] **Step 2: 组件改为调用 host，而不是访问 window.vscode**

```ts
// 示例：NetworkConfigurationPanel.vue
const host = useHost();
await host.sendCommand('networkDiagnostics', payload);
```

- [ ] **Step 3: 键盘快捷键管理器接受命令发送函数注入**

```ts
// KeyboardShortcutManager.ts
export interface ShortcutCommandDispatcher {
  dispatch(command: string): void;
}
```

```ts
constructor(private readonly dispatcher?: ShortcutCommandDispatcher) {}
```

- [ ] **Step 4: 在 App 层注入快捷键 dispatcher**

```ts
host.sendCommand(command);
```

- [ ] **Step 5: 搜索并清零前端中的 `window.vscode` 直连**

Run: `rg -n "window\\.vscode" src/frontend src/webview`

Expected: 只允许 `src/frontend/platform/host/vscodeHost.ts` 和 `src/providers/LACEditorProvider.ts` 出现该关键字。

- [ ] **Step 6: 运行构建验证**

Run: `npm run build`

Expected: 组件已脱离宿主全局对象直接访问，构建通过。

## Task 7: 建立 HTML 入口与资源样式

**Files:**
- Create: `src/frontend/shared/styles/webview.css`
- Create: `src/frontend/shared/styles/html.css`
- Create: `src/frontend/app/index.html`
- Modify: `webpack.config.js`
- Modify: `src/providers/LACEditorProvider.ts`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 建立两套入口样式文件**

```css
/* src/frontend/shared/styles/webview.css */
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}
```

```css
/* src/frontend/shared/styles/html.css */
html,
body,
#app {
  min-height: 100vh;
  margin: 0;
  background: #111827;
}
```

- [ ] **Step 2: 为 HTML 模式准备模板**

```html
<!-- src/frontend/app/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Logic Analyzer</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

- [ ] **Step 3: 修改 webpack，增加双入口与静态页面输出**

```js
entry: {
  'main-vscode': './src/frontend/app/main-vscode.ts',
  'main-html': './src/frontend/app/main-html.ts'
}
```

```js
new HtmlWebpackPlugin({
  template: 'src/frontend/app/index.html',
  filename: 'html/index.html',
  chunks: ['main-html']
})
```

- [ ] **Step 4: 保留 Webview 构建，但不再依赖默认 main.js 文件名**

```text
目标：
- Webview 资源文件允许 contenthash
- 扩展端通过 manifest 或构建产物映射读取真实文件名
```

- [ ] **Step 5: 运行构建，确认双入口产物生成**

Run: `npm run build`

Expected: `out/webview` 下可见 Webview 入口产物；HTML 静态页面产物可独立打开。

## Task 8: 修复 Webview 资源装配契约

**Files:**
- Modify: `webpack.config.js`
- Modify: `src/providers/LACEditorProvider.ts`
- Create: `src/frontend/platform/bootstrap/assetManifest.ts`
- Test: `tests/unit/webview/main.test.ts`

- [ ] **Step 1: 为 Webview 构建生成资源映射**

```js
// webpack 插件思路
// 输出 webview-manifest.json:
// { "main-vscode.js": "main-vscode.abcd1234.js", "main-vscode.css": "main-vscode.abcd1234.css" }
```

- [ ] **Step 2: 在扩展端读取 manifest，而不是硬编码资源文件名**

```ts
// src/providers/LACEditorProvider.ts
const assetManifest = this.readWebviewAssetManifest();
const scriptName = assetManifest['main-vscode.js'];
const styleName = assetManifest['main-vscode.css'];
```

- [ ] **Step 3: 调整 HTML 拼接逻辑**

```ts
const scriptUri = webview.asWebviewUri(
  vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', scriptName)
);
```

- [ ] **Step 4: 为 manifest 缺失添加失败提示**

```ts
if (!scriptName) {
  throw new Error('Webview 资源清单缺失 main-vscode.js');
}
```

- [ ] **Step 5: 运行构建并手工检查产物**

Run: `npm run build`

Expected: `LACEditorProvider` 不再出现 `main.js` / `style.css` 字面量依赖。

## Task 9: 测试、清理与文档收尾

**Files:**
- Modify: `tests/unit/webview/main.test.ts`
- Modify: `jest.webview.config.js`
- Modify: `package.json`
- Modify: `docs/vue3-一次性迁移与HTML复用技术方案.md`
- Create: `docs/frontend-migration-smoke-checklist.md`

- [ ] **Step 1: 更新 Jest Webview 配置到当前测试目录**

```js
// jest.webview.config.js
setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.ts'],
testMatch: ['<rootDir>/tests/unit/webview/**/*.test.ts']
```

- [ ] **Step 2: 增加前端迁移 smoke 检查清单**

```md
# 前端迁移 Smoke Checklist

- VS Code 中打开 `.lac` 文件，Webview 正常加载
- HTML 入口可独立打开
- 设备连接按钮不直接依赖 `window.vscode`
- 导出入口、快捷键入口、消息链路正常
```

- [ ] **Step 3: 更新 package.json 脚本**

```json
{
  "scripts": {
    "build:webview": "webpack --mode development --config webpack.config.js",
    "build:frontend:html": "webpack --mode development --config webpack.config.js",
    "test:webview:unit": "jest --runInBand tests/unit/webview/main.test.ts"
  }
}
```

- [ ] **Step 4: 运行最小验证命令**

Run: `npm run build`

Expected: 扩展端与前端双入口同时完成打包。

Run: `npm run test -- tests/unit/webview/main.test.ts --runInBand`

Expected: 入口测试通过。

- [ ] **Step 5: 进行代码检索式验收**

Run: `rg -n "window\\.vscode|window\\.documentData" src/frontend src/webview`

Expected: `window.documentData` 不再出现；`window.vscode` 仅出现在平台适配层。

- [ ] **Step 6: Commit**

```bash
git add \
  src/frontend \
  src/providers/LACEditorProvider.ts \
  webpack.config.js \
  tsconfig.json \
  tests/unit/webview/main.test.ts \
  jest.webview.config.js \
  package.json \
  docs/vue3-一次性迁移与HTML复用技术方案.md \
  docs/frontend-migration-smoke-checklist.md
git commit -m "refactor: split frontend into app core and platform layers"
```

## 计划自检

### 需求覆盖

- `Vue 3` 规范化：覆盖于 Task 1、Task 3、Task 4。
- 脱离 VS Code 宿主直连：覆盖于 Task 2、Task 6。
- 后续可复用到 HTML：覆盖于 Task 2、Task 7、Task 8。
- 构建资源契约修复：覆盖于 Task 7、Task 8。

### 占位符扫描

- 未使用 `TODO`、`TBD`、`implement later` 之类占位语句。
- 每个任务都给出了明确文件、命令或代码骨架。

### 一致性检查

- 双入口统一命名为 `main-vscode.ts` / `main-html.ts`。
- 宿主接口统一命名为 `HostAdapter`。
- 状态中心统一落在 `src/frontend/core/stores/`。

## 执行说明

建议按任务顺序执行，不要先搬全部组件。先把入口、宿主协议、状态中心和资源契约建稳，再迁移 `App.vue` 与复杂组件；否则会在中途同时承受结构调整、宿主适配和构建回归三类风险。
