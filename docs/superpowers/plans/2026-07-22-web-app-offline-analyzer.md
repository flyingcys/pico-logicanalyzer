# web-app 离线分析版 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立 `web-app/` vite 工程,在浏览器离线打开 `.lac` 文件、渲染波形、下载保存,与 vscode 插件共享 `src/frontend` 全部业务代码。

**Architecture:** web-app 是独立 vite 工程,通过路径别名直引 `../src/frontend`(零复制)。新增代码仅:入口 `main-web.ts`、根组件 `WebRoot.vue`、`createWebHost()`(HostAdapter 的离线实现)、`fileLoader.ts`(File→文档)、`FileDropLayer.vue`(拖拽/选择 UI)。数据流复用现有:`sessionStore.applyDocument(doc)` → `AppWaveformStage` 自动渲染波形。

**Tech Stack:** Vite 5 + Vue 3 + Pinia + Element Plus + vue-i18n(版本对齐根 `package.json`)+ Vitest(测试,jsdom)。frontend 代码用现有 TypeScript。

## Global Constraints

- **零侵入共享层**:不改 `src/frontend/`、`src/extension/`、`src/providers/`、`webpack.config.js`、根 `package.json`。所有新代码只在 `web-app/` 下。
- **路径别名复用**:`@frontend`、`@frontend-app`、`@frontend-core`、`@frontend-platform`、`@frontend-shared` 在 vite alias 与 web-app tsconfig paths 中映射到 `../src/frontend/...`,使 frontend 代码 import 路径零改动。
- **不引 Node API**:`web-app/` 下代码不得 `import` 任何 Node 专属模块(`fs`/`path`/`serialport`/`child_process` 等)。
- **依赖版本对齐根**:vue `^3.2.45`、pinia `^2.0.28`、element-plus `^2.2.26`、typescript `^4.9.4`(根值)。新增 vite/vitest/vue-tsc/jsdom/@vue/test-utils/@element-plus/icons-vue/vue-i18n 用兼容的较新稳定版,`@element-plus/icons-vue` 与 `vue-i18n` 实现时核对根 `package.json` 精确版本对齐。
- **MVP 导出范围**:`webHost` 的导出仅实现 `format='lac'`(下载原文)。CSV/JSON/VCD 等格式需移植扩展进程的导出逻辑,属 Phase 2,MVP 返回明确 unsupported 提示。
- **不碰硬件**:`canStartCapture=false`、`canConnectDevice=false`,采集/设备相关命令一律返回 `{success:false, error:'...'}`。

---

## File Structure

| 文件 | 职责 | 创建/修改 |
|---|---|---|
| `web-app/package.json` | 依赖、scripts(dev/build/test) | Create |
| `web-app/vite.config.ts` | vite + vue 插件 + alias + vitest 配置 | Create |
| `web-app/tsconfig.json` | extends 根 tsconfig + paths 别名 | Create |
| `web-app/index.html` | 入口 HTML(`<div id="app">` + `<script>`) | Create |
| `web-app/src/main-web.ts` | 入口:组装 app、provide host/bootstrap、挂载 | Create |
| `web-app/src/createWebApp.ts` | 复刻 `createFrontendApp` 逻辑,根组件换 `WebRoot` | Create |
| `web-app/src/WebRoot.vue` | 根:`<App/>` + `<FileDropLayer/>` | Create |
| `web-app/src/webHost.ts` | `createWebHost()` + `readWebBootstrap()` | Create |
| `web-app/src/fileLoader.ts` | `fileToDocument(file)` | Create |
| `web-app/src/FileDropLayer.vue` | 拖拽 + 文件选择按钮 UI | Create |
| `web-app/src/fileLoader.test.ts` | fileLoader 单测 | Create |
| `web-app/src/webHost.test.ts` | webHost 单测 | Create |

**分解理由**:`webHost.ts` 与 `fileLoader.ts` 是纯逻辑,可独立 TDD;`createWebApp.ts` 复刻 bootstrap 逻辑(39 行)换取零侵入共享层(不給 `createFrontendApp` 加参数);`WebRoot.vue`/`FileDropLayer.vue` 是 web 专属 UI 壳,与共享 `App.vue` 组合。

---

### Task 1: web-app vite 工程脚手架 + 验证 vite 能编译 frontend(关键风险)

**目标**:搭起 vite 工程,入口临时复用现成 `browserHost`(模拟器)+ `createFrontendApp` + `App.vue`,证明 vite 能完整编译 `src/frontend`。这是 spec §12 头号风险。

**Files:**
- Create: `web-app/package.json`
- Create: `web-app/vite.config.ts`
- Create: `web-app/tsconfig.json`
- Create: `web-app/index.html`
- Create: `web-app/src/main-web.ts`(临时版,Task 4 替换)

**Interfaces:**
- Consumes: `createFrontendApp`(`@frontend-platform/bootstrap/createFrontendApp`)、`createBrowserHost`/`readBrowserBootstrap`(`@frontend-platform/host/browserHost`)
- Produces: 可 `npm run dev`/`npm run build` 的 vite 工程

- [ ] **Step 1: 创建 `web-app/package.json`**

```json
{
  "name": "pico-logicanalyzer-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:check": "vue-tsc --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "vue": "^3.2.45",
    "pinia": "^2.0.28",
    "element-plus": "^2.2.26",
    "@element-plus/icons-vue": "^2.2.0",
    "vue-i18n": "^9.2.2"
  },
  "devDependencies": {
    "typescript": "^4.9.4",
    "vite": "^5.4.0",
    "@vitejs/plugin-vue": "^5.0.5",
    "vue-tsc": "^2.0.26",
    "vitest": "^2.0.5",
    "jsdom": "^24.1.0",
    "@vue/test-utils": "^2.4.6"
  }
}
```
> 实现时核对根 `package.json` 的 `vue`/`pinia`/`element-plus`/`@element-plus/icons-vue`/`vue-i18n` 精确版本,改为对齐。

- [ ] **Step 2: 创建 `web-app/vite.config.ts`**

```ts
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
```

- [ ] **Step 3: 创建 `web-app/tsconfig.json`**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@frontend-app/*": ["../src/frontend/app/*"],
      "@frontend-core/*": ["../src/frontend/core/*"],
      "@frontend-platform/*": ["../src/frontend/platform/*"],
      "@frontend-shared/*": ["../src/frontend/shared/*"],
      "@frontend/*": ["../src/frontend/*"]
    }
  },
  "include": ["src", "../src/frontend"]
}
```
> 若 extends 引入的根 tsconfig 项(如 `types: ["node"]`)干扰浏览器构建,在 `compilerOptions` 里局部覆盖。MVP 不阻塞:类型检查走 `npm run build:check`,失败则降级为仅 `vite build`(见 Step 7 备注)。

- [ ] **Step 4: 创建 `web-app/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Logic Analyzer (Web)</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main-web.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 创建临时 `web-app/src/main-web.ts`**

```ts
// 临时入口:用现成 browserHost 验证 vite 能编译整个 frontend。Task 4 替换为 webHost。
import '@frontend-shared/styles/html.css';
import { createFrontendApp } from '@frontend-platform/bootstrap/createFrontendApp';
import { createBrowserHost, readBrowserBootstrap } from '@frontend-platform/host/browserHost';

const host = createBrowserHost();
const bootstrap = readBrowserBootstrap();
const context = createFrontendApp({ host, bootstrap });

context.app.mount('#app');
context.host.ready();
```

- [ ] **Step 6: 安装依赖并启动 dev,验证 vite 能编译 frontend**

Run:
```bash
cd web-app && npm install && npm run dev
```
Expected: vite 启动,输出 `Local: http://localhost:5173/`,**无编译错误**。浏览器打开 5173,看到应用界面(browserHost 模拟数据渲染出波形/界面)。

> 若出现编译错误(如 frontend 某处用了 webpack-only API、或动态 `require`),记录错误,在本任务内修复或回报:这是 spec §12 风险点,可能需要小幅调整 frontend(届时单独走 impact 分析)。**修复前不进入 Task 2。**

- [ ] **Step 7: 验证生产构建**

Run:
```bash
cd web-app && npm run build
```
Expected: 产出 `web-app/dist/`(`index.html` + `assets/`),无错误。

> 类型检查 `npm run build:check`(vue-tsc)若因 frontend 历史 TS 写法报错,记录但不阻塞 MVP——`build` 脚本仅 `vite build` 不含类型检查。类型问题列入后续清理。

- [ ] **Step 8: 提交**

```bash
git add web-app
git commit -m "feat(web-app): 初始化 vite 工程并验证可编译共享 frontend

临时入口复用 browserHost + createFrontendApp 挂载 App.vue,
验证 vite 能完整编译 src/frontend(多平台抽象复用的关键风险点)。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: fileLoader(File → FrontendDocumentData)TDD

**目标**:把用户选中的 `.lac` 文件读成 `FrontendDocumentData`(`{uri, fileName, content}`)。

**Files:**
- Create: `web-app/src/fileLoader.ts`
- Test: `web-app/src/fileLoader.test.ts`

**Interfaces:**
- Consumes: `FrontendDocumentData`(`@frontend-platform/host/types`,字段 `uri: string; fileName: string; content: string`)
- Produces: `fileToDocument(file: File): Promise<FrontendDocumentData>`

- [ ] **Step 1: 写失败测试 `web-app/src/fileLoader.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fileToDocument } from './fileLoader';

describe('fileLoader', () => {
  it('拒绝非 .lac 扩展名', async () => {
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    await expect(fileToDocument(file)).rejects.toThrow(/仅支持 .lac/);
  });

  it('把 .lac 文件读成 FrontendDocumentData', async () => {
    const content = JSON.stringify({
      settings: { frequency: 1000, captureChannels: [] },
    });
    const file = new File([content], 'demo.lac', { type: 'application/json' });
    const doc = await fileToDocument(file);
    expect(doc.fileName).toBe('demo.lac');
    expect(doc.uri).toContain('demo.lac');
    expect(doc.content).toBe(content);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web-app && npm test -- fileLoader`
Expected: FAIL,`Cannot find module './fileLoader'`

- [ ] **Step 3: 实现 `web-app/src/fileLoader.ts`**

```ts
import type { FrontendDocumentData } from '@frontend-platform/host/types';

const LAC_EXT = /\.lac$/i;

/**
 * 把浏览器 File 读成 FrontendDocumentData。
 * 用 FileReader(而非 file.text())以保证 jsdom 测试环境兼容。
 */
export function fileToDocument(file: File): Promise<FrontendDocumentData> {
  return new Promise((resolve, reject) => {
    if (!LAC_EXT.test(file.name)) {
      reject(new Error(`仅支持 .lac 文件,收到: ${file.name}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        uri: `file:///${file.name}`,
        fileName: file.name,
        content: String(reader.result ?? ''),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web-app && npm test -- fileLoader`
Expected: PASS(2 用例)

- [ ] **Step 5: 提交**

```bash
git add web-app/src/fileLoader.ts web-app/src/fileLoader.test.ts
git commit -m "feat(web-app): 新增 fileLoader 将 .lac File 读成文档数据

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: webHost(HostAdapter 离线实现)TDD

**目标**:实现 `createWebHost()` 与 `readWebBootstrap()`。`loadInitialDocument` 初始返回 undefined;`loadDocument(doc)` 更新内部文档并 emit `documentLoaded`;`saveFile`/`exportData(lac)` 触发浏览器下载;其余命令返回 unsupported。

**Files:**
- Create: `web-app/src/webHost.ts`
- Test: `web-app/src/webHost.test.ts`

**Interfaces:**
- Consumes: `HostAdapter`、`HostCommandResult`、`FrontendBootstrapData`、`FrontendCapabilities`、`FrontendDocumentData`、`HostMessageHandler`、`HostInboundMessage`(均来自 `@frontend-platform/host/types`)
- Produces: `readWebBootstrap(): FrontendBootstrapData`、`createWebHost(): WebHost`,其中 `WebHost extends HostAdapter` 多一个 `loadDocument(doc: FrontendDocumentData): void`

- [ ] **Step 1: 写失败测试 `web-app/src/webHost.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWebHost, readWebBootstrap } from './webHost';
import type { HostInboundMessage } from '@frontend-platform/host/types';

describe('readWebBootstrap', () => {
  it('声明 html host 与离线能力', () => {
    const b = readWebBootstrap();
    expect(b.host).toBe('html');
    expect(b.document).toBeUndefined();
    expect(b.capabilities).toEqual({
      canSave: true,
      canExport: true,
      canStartCapture: false,
      canConnectDevice: false,
    });
  });
});

describe('createWebHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loadInitialDocument 初始为 undefined', () => {
    expect(createWebHost().loadInitialDocument()).toBeUndefined();
  });

  it('loadDocument 更新文档并 emit documentLoaded', () => {
    const host = createWebHost();
    const messages: HostInboundMessage[] = [];
    host.onMessage((m) => messages.push(m));
    const doc = { uri: 'file:///a.lac', fileName: 'a.lac', content: '{}' };
    host.loadDocument(doc);
    expect(host.loadInitialDocument()).toEqual(doc);
    expect(messages.some((m) => m.type === 'documentLoaded')).toBe(true);
  });

  it('未支持的命令返回失败', async () => {
    const r = await createWebHost().sendCommand('startCapture');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/不支持/);
  });

  it('saveFile 触发浏览器下载', async () => {
    const host = createWebHost();
    host.loadDocument({
      uri: 'file:///a.lac',
      fileName: 'a.lac',
      content: '{"x":1}',
    });
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
      }
      return {} as HTMLElement;
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    const r = await host.sendCommand('saveFile', '{"x":1}');
    expect(r.success).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('exportData 非 lac 格式 emit error', async () => {
    const host = createWebHost();
    host.loadDocument({
      uri: 'file:///a.lac',
      fileName: 'a.lac',
      content: '{}',
    });
    const errors: HostInboundMessage[] = [];
    host.onMessage((m) => errors.push(m));
    await host.sendCommand('exportData', { format: 'csv' });
    expect(errors.some((m) => m.type === 'error')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd web-app && npm test -- webHost`
Expected: FAIL,`Cannot find module './webHost'`

- [ ] **Step 3: 实现 `web-app/src/webHost.ts`**

```ts
import type {
  HostAdapter,
  HostCommandResult,
  HostInboundMessage,
  HostMessageHandler,
  FrontendBootstrapData,
  FrontendCapabilities,
  FrontendDocumentData,
} from '@frontend-platform/host/types';

const webCapabilities: FrontendCapabilities = {
  canSave: true,
  canExport: true,
  canStartCapture: false,
  canConnectDevice: false,
};

/** WebHost 在 HostAdapter 之上多一个 loadDocument,供 FileDropLayer 打开文件时灌入。 */
export interface WebHost extends HostAdapter {
  loadDocument(doc: FrontendDocumentData): void;
}

export function readWebBootstrap(): FrontendBootstrapData {
  return {
    host: 'html',
    document: undefined,
    capabilities: webCapabilities,
  };
}

function downloadText(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function createWebHost(): WebHost {
  let currentDocument: FrontendDocumentData | undefined;
  const handlers = new Set<HostMessageHandler>();

  const emit = (message: HostInboundMessage): void => {
    handlers.forEach((h) => h(message));
  };

  const host: WebHost = {
    ready() {
      // 无宿主握手,空实现
    },
    loadInitialDocument() {
      return currentDocument;
    },
    loadDocument(doc: FrontendDocumentData) {
      currentDocument = doc;
      emit({ type: 'documentLoaded', payload: doc } as HostInboundMessage);
    },
    saveDocument(payload: unknown) {
      const content =
        typeof payload === 'string' ? payload : JSON.stringify(payload);
      downloadText(
        currentDocument?.fileName ?? 'document.lac',
        content,
        'application/json',
      );
    },
    exportData(payload: unknown) {
      const format =
        (payload as { format?: string } | undefined)?.format ?? 'lac';
      if (format === 'lac' && currentDocument) {
        downloadText(
          currentDocument.fileName,
          currentDocument.content,
          'application/json',
        );
        return;
      }
      emit({
        type: 'error',
        payload: { message: `web 版暂不支持导出格式: ${format}` },
      } as HostInboundMessage);
    },
    connectDevice() {
      // 离线模式不支持
    },
    startCapture() {
      // 离线模式不支持
    },
    async sendCommand<T = unknown>(
      command: string,
      payload?: unknown,
    ): Promise<HostCommandResult<T>> {
      switch (command) {
        case 'export':
        case 'exportData':
          host.exportData(payload);
          return { success: true };
        case 'saveFile':
          host.saveDocument(payload);
          return { success: true };
        default:
          return {
            success: false,
            error: `web 版不支持命令: ${command}`,
          };
      }
    },
    onMessage(handler: HostMessageHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };

  return host;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd web-app && npm test -- webHost`
Expected: PASS(5 用例)

- [ ] **Step 5: 提交**

```bash
git add web-app/src/webHost.ts web-app/src/webHost.test.ts
git commit -m "feat(web-app): 新增 webHost 离线 HostAdapter 实现

loadDocument 灌入文件文档;saveFile/exportData(lac) 触发浏览器下载;
采集/设备命令返回 unsupported。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: createWebApp + WebRoot + 替换入口为 webHost

**目标**:用 web 专属根组件 `WebRoot.vue`(`<App/>` + `<FileDropLayer/>` 挂载点)替换临时 browserHost 入口,正式用 `createWebHost`。验证空文档状态下 App 能渲染。

**Files:**
- Create: `web-app/src/createWebApp.ts`
- Create: `web-app/src/WebRoot.vue`
- Modify: `web-app/src/main-web.ts`(替换 Task 1 临时版)

**Interfaces:**
- Consumes: `createWebHost`/`readWebBootstrap`(Task 3)、`App.vue`(`@frontend-app/App.vue`)、`HostAdapter`/`FrontendBootstrapData`
- Produces: 挂载 webHost + WebRoot 的运行应用

> 说明:`createFrontendApp`(共享层)硬编码 `createApp(App.vue)`,无法注入 web 专属根组件。为遵守"零侵入共享层",本任务复刻其 bootstrap 逻辑为 `createWebApp`,根组件改为 `WebRoot`。逻辑与 `src/frontend/platform/bootstrap/createFrontendApp.ts` 一致(pinia + element-plus 全量 + i18n + provide host/bootstrap),实现时对照源文件保持同步。

- [ ] **Step 1: 创建 `web-app/src/createWebApp.ts`**

对照 `src/frontend/platform/bootstrap/createFrontendApp.ts:1-39` 复刻:

```ts
import { createApp, type App as VueApp } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import i18n from '@frontend-shared/i18n';
import type {
  HostAdapter,
  FrontendBootstrapData,
} from '@frontend-platform/host/types';
import WebRoot from './WebRoot.vue';

export interface WebAppContext {
  app: VueApp;
  pinia: Pinia;
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}

export function createWebApp({
  host,
  bootstrap,
}: {
  host: HostAdapter;
  bootstrap: FrontendBootstrapData;
}): WebAppContext {
  const app = createApp(WebRoot);
  const pinia = createPinia();
  app.use(pinia);
  app.use(ElementPlus);
  app.use(i18n);
  app.provide('host', host);
  app.provide('bootstrap', bootstrap);
  return { app, pinia, host, bootstrap };
}
```

- [ ] **Step 2: 创建 `web-app/src/WebRoot.vue`(含 FileDropLayer 挂载点)**

```vue
<template>
  <App />
  <FileDropLayer />
</template>

<script setup lang="ts">
import App from '@frontend-app/App.vue';
import FileDropLayer from './FileDropLayer.vue';
</script>
```

> `FileDropLayer.vue` 在 Task 5 创建。本步先建空壳占位,避免编译断裂:

`web-app/src/FileDropLayer.vue`(占位,Task 5 替换):
```vue
<template><div /></template>
<script setup lang="ts"></script>
```

- [ ] **Step 3: 替换 `web-app/src/main-web.ts`**

```ts
import '@frontend-shared/styles/html.css';
import { createWebApp } from './createWebApp';
import { createWebHost, readWebBootstrap } from './webHost';

const host = createWebHost();
const bootstrap = readWebBootstrap();
const context = createWebApp({ host, bootstrap });

// 暴露 host 完整实例(含 loadDocument),供 FileDropLayer 通过 window 取用
if (typeof window !== 'undefined') {
  (window as unknown as { __WEB_HOST__?: typeof host }).__WEB_HOST__ = host;
}

context.app.mount('#app');
context.host.ready();
```

- [ ] **Step 4: 启动 dev 验证 webHost 下 App 能渲染(空文档)**

Run: `cd web-app && npm run dev`
Expected: 浏览器打开 5173,应用界面渲染(空文档状态,无波形,顶部工具栏可见)。控制台无 vite 编译错误。`host.loadInitialDocument()` 返回 undefined → `sessionStore.applyDocument(undefined)` 不报错。

> 若空文档态下 `App.vue` 因缺数据抛错,记录调用栈;`applyDocument` 应能处理 undefined(见 `src/frontend/core/stores/sessionStore.ts:327-376`),若不能则属于共享层需小修,单独走 impact 分析。

- [ ] **Step 5: 提交**

```bash
git add web-app/src/createWebApp.ts web-app/src/WebRoot.vue web-app/src/FileDropLayer.vue web-app/src/main-web.ts
git commit -m "feat(web-app): 用 createWebApp + WebRoot 替换临时入口,接入 webHost

复刻 createFrontendApp bootstrap 逻辑(根组件换 WebRoot)以零侵入共享层。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: FileDropLayer(拖拽 + 选择文件 → 渲染波形)

**目标**:实现文件拖拽与"打开文件"按钮。选中 `.lac` → `fileLoader` 读成文档 → `webHost.loadDocument` + `sessionStore.applyDocument` → `AppWaveformStage` 自动渲染波形。

**Files:**
- Modify: `web-app/src/FileDropLayer.vue`(替换 Task 4 占位)

**Interfaces:**
- Consumes: `fileToDocument`(Task 2)、`useSessionStore`(`@frontend-core/stores/sessionStore`,其 `applyDocument(doc?: FrontendDocumentData): void`)、`WebHost.loadDocument`(Task 3,经 `window.__WEB_HOST__`)
- Produces: 浏览器内拖拽/选择打开 `.lac` 并渲染波形的交互

- [ ] **Step 1: 实现 `web-app/src/FileDropLayer.vue`**

```vue
<template>
  <div
    class="web-drop-layer"
    :class="{ 'is-dragover': dragover }"
    @dragover.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="fileInput"
      type="file"
      accept=".lac,application/json"
      class="web-drop-layer__input"
      @change="onPick"
    />
    <button class="web-drop-layer__btn" @click="openPicker">打开 .lac 文件</button>
    <p v-if="empty" class="web-drop-layer__hint">
      拖拽 <strong>.lac</strong> 文件到此处,或点击上方按钮选择
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useSessionStore } from '@frontend-core/stores/sessionStore';
import { fileToDocument } from './fileLoader';
import type { WebHost } from './webHost';
import type { FrontendDocumentData } from '@frontend-platform/host/types';

const sessionStore = useSessionStore();
const fileInput = ref<HTMLInputElement | null>(null);
const dragover = ref(false);
const empty = computed(() => !sessionStore.hasData);

function getHost(): WebHost | undefined {
  return (window as unknown as { __WEB_HOST__?: WebHost }).__WEB_HOST__;
}

function openPicker() {
  fileInput.value?.click();
}

async function loadFile(file: File) {
  try {
    const doc: FrontendDocumentData = await fileToDocument(file);
    getHost()?.loadDocument(doc);
    sessionStore.applyDocument(doc);
    ElMessage.success(`已加载 ${doc.fileName}`);
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载文件失败');
  }
}

function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) void loadFile(file);
  // 允许重复选同一文件
  if (fileInput.value) fileInput.value.value = '';
}

function onDrop(e: DragEvent) {
  dragover.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadFile(file);
}

onMounted(() => {
  // 全局拖拽兜底:防止浏览器默认打开文件
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
});
</script>

<style scoped>
.web-drop-layer {
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 6px;
}
.web-drop-layer.is-dragover {
  border-color: var(--el-color-primary, #409eff);
}
.web-drop-layer__input {
  display: none;
}
.web-drop-layer__btn {
  cursor: pointer;
}
.web-drop-layer__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--el-text-color-secondary, #909399);
}
</style>
```

- [ ] **Step 2: 浏览器端到端验证(打开文件 → 波形渲染)**

Run: `cd web-app && npm run dev`
验证步骤:
1. 浏览器打开 5173,右上见"打开 .lac 文件"按钮
2. 用仓库内真实 fixture:`tests/fixtures/lac/current-lowercase-samples.lac`,拖拽进页面 或 点按钮选择
3. Expected:波形区渲染出通道波形(`sessionStore.applyDocument` 解析成功 → `AppWaveformStage` 自动渲染)
4. 拖入 `note.txt`:Expected ElMessage 报错"仅支持 .lac 文件"

> 若拖入 `.lac` 后波形未渲染:检查 `sessionStore.hasData` 是否变 true(applyDocument 是否成功);检查 `AppWaveformStage` 是否监听 sessionStore 变化触发 `loadCaptureContext`。若 store 字段名不符(`hasData`/`applyDocument`),对照 `src/frontend/core/stores/sessionStore.ts` 修正。

- [ ] **Step 3: 提交**

```bash
git add web-app/src/FileDropLayer.vue
git commit -m "feat(web-app): FileDropLayer 实现拖拽/选择打开 .lac 并渲染波形

选中文件 → fileToDocument → webHost.loadDocument + sessionStore.applyDocument,
复用 AppWaveformStage 自动渲染。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 保存/导出闭环 + 生产构建冒烟

**目标**:端到端验证保存(下载 `.lac`)闭环,并确认 `vite build` 产出可静态部署。

**Files:**
- 无新建文件(验证 Task 3 webHost 下载逻辑的端到端表现 + 构建产物)

**Interfaces:**
- Consumes: Task 3 webHost(saveFile/exportData)、Task 5 FileDropLayer

- [ ] **Step 1: 浏览器验证保存闭环**

Run: `cd web-app && npm run dev`
验证步骤:
1. 打开 `tests/fixtures/lac/current-lowercase-samples.lac`,波形渲染
2. 触发保存:通过 App.vue 现有保存入口(若 UI 有保存按钮则点击;若保存走命令面板/快捷键,则确认 `dispatchHostCommand('saveFile')` 链路在 web 版可达)
3. Expected:浏览器下载一个 `.lac` 文件,内容为合并 regions 后的 JSON
4. 触发导出(CSV):Expected ElMessage 或 host error 提示"web 版暂不支持导出格式: csv"(MVP 设计行为)

> 若 App.vue 的保存/导出按钮在 web 版未渲染:确认 `capabilities`(canSave=true)被 UI 正确读取。若按钮依赖 vscode 专属条件(非 capabilities),记录——可能需在共享层用 capabilities 收敛(单独走 impact 分析,非本任务)。

- [ ] **Step 2: 生产构建 + 预览冒烟**

Run:
```bash
cd web-app && npm run build && npm run preview
```
Expected:
- `npm run build` 产出 `web-app/dist/`(`index.html` + `assets/`),无错误
- `npm run preview` 起静态服务器(默认 4173),浏览器打开可见应用,重复 Step 1 的打开文件流程正常工作

- [ ] **Step 3: 回归确认 vscode 侧零影响**

Run:
```bash
cd /Users/cys/ai-coding/pico-logicanalyzer && npm run build
```
Expected: 根 webpack 构建正常(产物 `out/extension.js`、`out/webview/`),web-app 新增未影响 vscode 插件构建。

- [ ] **Step 4: 提交(若有验证中产生的小修;否则跳过)**

```bash
git add -A web-app
git commit -m "test(web-app): 保存/导出闭环与生产构建冒烟通过

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 验收对照(spec §13)

- [x] `cd web-app && npm install && npm run dev` 起服务、浏览器见界面 → Task 1 Step 6
- [x] 拖拽/选择真实 `.lac` 波形正确渲染 → Task 5 Step 2
- [x] 导出/保存产生文件下载(lac 格式)→ Task 6 Step 1
- [x] `npm run build` 产 `dist/`,静态托管可用 → Task 6 Step 2
- [x] `src/frontend` 与 vscode webpack 零改动、零回归 → Global Constraints + Task 6 Step 3
- [x] 采集/设备 UI 被 capabilities 禁用 → Task 3 capabilities(canStartCapture/canConnectDevice=false)

## 风险与回退

| 风险 | 触发任务 | 回退/处理 |
|---|---|---|
| vite 无法编译 frontend(webpack-only API) | Task 1 Step 6 | 本任务内定位修复;若需改共享层,单独 impact 分析 |
| `applyDocument(undefined)` 空文档态报错 | Task 4 Step 4 | 确认 sessionStore 处理空文档;必要时共享层小修 |
| `sessionStore` 字段名/方法不符 | Task 5 Step 2 | 对照 `sessionStore.ts:22-35, 327-376` 修正引用 |
| 保存/导出按钮 web 版不渲染 | Task 6 Step 1 | 确认 UI 读 capabilities;若硬编码 vscode 条件,共享层用 capabilities 收敛(impact 分析) |
| TS 版本冲突(`build:check`) | Task 1 Step 7 | MVP 降级为仅 `vite build`,类型问题列入清理 |
