# web-app 离线分析版设计

- 日期:2026-07-22
- 状态:待审阅
- 作者:架构设计(基于代码摸底 + 需求澄清)

## 1. 背景与目标

当前 `src/frontend/` 已为多平台重构完成,具备成熟的平台抽象层(`platform/host/HostAdapter` 契约 + provide/inject + 工厂 `defaultHost.ts`),并已存在一个浏览器 host(`browserHost.ts`)+ 入口(`main-html.ts`)。但现有 `browserHost` 是**模拟器**(合成假数据,`driverType: 'browser-simulator'`),不是真实可用工具。

本设计目标:**新增一个独立 `web-app/` 工程,提供纯浏览器离线 `.lac` 文件分析器**,与 vscode 插件共享同一套 `src/frontend` 业务代码,最大化复用。

**核心场景**:用户在浏览器打开已采集的 `.lac` 文件 → 查看波形 → 导出。

## 2. 范围

### MVP 范围(本期)
- 独立 vite 工程 `web-app/`,可独立 `dev`/`build`/部署
- 浏览器打开 `.lac` 文件(拖拽 + 文件选择)
- 渲染波形(复用 `core/engines/WaveformRenderer` + 相关 store)
- 导出数据(复用 `exportRequestService` 链路,浏览器侧用 Blob 下载)
- 复用 `src/frontend/{core,app,shared,platform}` 全部代码,零复制

### 明确不做(YAGNI)
- WebSerial 真实硬件采集(浏览器无法直连,且非离线分析场景)
- 后端服务 / 多用户 / 远程硬件代理
- 在线采集 / 设备连接
- 用户账号 / 鉴权
- 协议解码(I2C/SPI/UART 等)—— 见 §10 Phase 2
- URL `?file=` 远程加载

## 3. 架构概览

```
                    ┌─────────────────────────────────────┐
                    │   src/frontend  (共享,平台无关)      │
                    │  core / app / shared / platform      │
                    │  (HostAdapter 契约 + 业务逻辑)        │
                    └───────────────┬─────────────────────┘
                                    │ 实现 HostAdapter
                ┌───────────────────┼────────────────────┐
                │                   │                    │
        vscodeHost.ts         browserHost.ts        webHost.ts (新增)
        (Node/扩展进程)        (现有模拟器)          (web-app 离线分析)
                │                   │                    │
        main-vscode.ts        main-html.ts          main-web.ts (新增)
                │                   │                    │
        webpack webview        webpack webview       vite (web-app/)
        → vscode 插件          → out/webview/html    → web-app/dist
```

web-app 通过路径别名直接引用 `../src/frontend`,**不复制任何业务代码**。新增的只有入口(`main-web.ts`)+ Host 实现(`webHost.ts`)+ 文件加载(`fileLoader.ts`)。

## 4. 目录结构

```
web-app/
  package.json          # vite + vue + pinia + element-plus,版本对齐根
  vite.config.ts        # 复用 @frontend/* 别名,target 浏览器
  tsconfig.json         # extend 根 tsconfig,paths 对齐
  index.html            # <div id="app"> + 引 main-web.ts
  src/
    main-web.ts         # 入口:建 WebHost + 挂 App
    webHost.ts          # createWebHost() + readWebBootstrap()
    fileLoader.ts       # .lac 拖拽/选择/解析
```

## 5. 工程配置

### 5.1 依赖版本(对齐根 `package.json`)
- `vue` ^3.2.45
- `pinia` ^2.0.28
- `element-plus` ^2.2.26
- `typescript` ^4.9.4(dev)
- 新增 dev:`vite`、`@vitejs/plugin-vue`、`vue-tsc`

### 5.2 路径别名
根 `tsconfig.json` 已定义完整别名,vite 直接复用,**frontend 代码 import 路径零改动**:
- `@frontend/*` → `src/frontend/*`
- `@frontend-app/*` → `src/frontend/app/*`
- `@frontend-core/*` → `src/frontend/core/*`
- `@frontend-platform/*` → `src/frontend/platform/*`
- `@frontend-shared/*` → `src/frontend/shared/*`

`vite.config.ts` 用 `resolve.alias` 把这些别名映射到 `../src/frontend/...`。

### 5.3 tsconfig
`web-app/tsconfig.json` extends 根 `tsconfig.json`,仅覆盖 `include`(指向 `src/` 与 `../src/frontend/`)与 `compilerOptions.outDir`。保持与 frontend 一致的严格度。

### 5.4 package.json scripts
- `dev` → `vite`
- `build` → `vue-tsc --noEmit && vite build`(输出 `dist/`)
- `preview` → `vite preview`

## 6. Host 层设计(createWebHost)

### 6.1 位置
新建 `web-app/src/webHost.ts`,**不放入 `src/frontend/platform`**(避免污染共享层;host 实现属于工程特定)。

### 6.2 实现策略
骨架参考 `browserHost.ts`,按离线分析场景改写:

| HostAdapter 方法 | webHost 实现 |
|---|---|
| `ready()` | no-op 或发就绪日志 |
| `loadInitialDocument()` | 读最近文件(可选,localStorage),否则空文档 |
| `saveDocument(payload)` | 浏览器 Blob 下载 `.lac` |
| `exportData(payload)` | 复用 export 逻辑,Blob 下载导出格式 |
| `connectDevice()` | 返回 unsupported 错误(`canConnectDevice=false`) |
| `startCapture()` | 返回 unsupported 错误(`canStartCapture=false`) |
| `sendCommand(...)` | 仅处理文档/导出类命令;采集/设备类拒绝 |
| `onMessage(handler)` | no-op(无宿主消息源) |

### 6.3 能力声明(FrontendCapabilities)
```
canSave=true, canExport=true, canConnectDevice=false, canStartCapture=false
```
UI 侧组件已根据 capabilities 隐藏/禁用采集相关按钮(现状机制),无需额外改 frontend。

### 6.4 Host Kind
`FrontendHostKind` 当前为 `'vscode' | 'html'`。web-app 独立工程有自己的入口与 host 工厂,**不经过 `defaultHost.ts`**(那是 webpack 双入口的运行时探测逻辑)。故 web-app 入口直接 `createWebHost()`,无需修改 `types.ts` 的 kind 联合类型。(若后续希望统一,可加 `'web'`,但 MVP 不必。)

## 7. 入口(main-web.ts)

参考 `main-html.ts` 结构:
```ts
import '@frontend-shared/styles/html.css';          // 复用现有样式
import { createFrontendApp } from '@frontend-platform/bootstrap/createFrontendApp';
import { createWebHost, readWebBootstrap } from './webHost';

const host = createWebHost();
const bootstrap = readWebBootstrap();
const context = createFrontendApp({ host, bootstrap });
context.app.mount('#app');
context.host.ready();
```
关键:只引 `createWebHost`,**绝不引 `vscodeHost`**(那是唯一含 `window.vscode` 的文件)。

## 8. `.lac` 文件加载流程

1. 用户拖拽 `.lac` 到页面,或点击"打开文件"按钮(`<input type="file">`)
2. `fileLoader.ts` 用 `FileReader` / `file.arrayBuffer()` 读取
3. 复用 frontend 现有 `.lac` 解析逻辑(需确认解析入口,实现时定位;预计在 `core/services` 或 `protocol`)
4. 填充 `sessionStore` / `waveformStore`
5. 触发 `WaveformRenderer` 渲染

错误处理:非 `.lac` / 损坏文件 → element-plus Message 提示。

## 9. 构建与部署

- `vite build` → `web-app/dist/`(纯静态:`index.html` + `assets/`)
- 部署:任意静态服务器 / GitHub Pages / Netlify / Vercel
- **vscode 侧 webpack 零改动**(独立工程,不影响 `out/extension.js` 与 `out/webview/`)
- CI:可加独立 job 构建 web-app/dist 并部署(非 MVP)

## 10. 共享代码约束

- `src/frontend` 必须持续保持平台无关。现状已满足:grep 确认 `window.vscode` / `acquireVsCodeApi` 仅在 `vscodeHost.ts`
- web-app 工程不得引入任何 Node API(`fs`/`path`/`serialport` 等)
- 类型直接复用 `@frontend-platform/host/types` 的 `HostAdapter` 等契约
- 若未来 frontend 出现对 web-app 不友好的依赖,优先在 host 抽象层隔离,不硬编码平台

## 11. Phase 2:协议解码(浏览器化,本期不做)

MVP 不支持解码。Phase 2 评估并实施:
- `src/decoders/DecoderManager` 核心是纯协议算法(I2C/SPI/UART/CAN/LIN/I2S),理论上可浏览器化
- 风险点:`DecoderManager` 当前由扩展进程 `LACEditorProvider.executeHostCommand` 调用,可能与扩展进程细节耦合;`DecoderSigrokParity` / `PythonDecoderAnalyzer` 可能依赖 Node/外部进程
- Phase 2 先做耦合评估 → 必要时把 DecoderManager 抽成平台无关包 → webHost 的 `runDecoder` 真接 DecoderManager(替换 browserHost 的 `createSyntheticI2CResults` 合成路径)

## 12. 风险与验证

| 风险 | 影响 | 缓解/验证 |
|---|---|---|
| frontend 代码含 webpack-only 特性(动态 import/特殊 loader) | vite 打包失败 | MVP 第一步:先用 vite 打包 `main-web.ts`(host 先用空实现)验证 frontend 整体能被 vite 编译;失败点逐个解决 |
| frontend 间接依赖 Node 模块 | 浏览器运行报错 | vite 构建期 + 浏览器冒烟测试暴露 |
| `.lac` 解析逻辑散落/耦合扩展进程 | 加载功能受阻 | 实现时用 GitNexus 定位解析入口,必要时小幅抽取(遵循 impact 分析) |
| element-plus 按需引入方式与 webpack 不同 | 样式/体积问题 | vite 用 `unplugin-vue-components` + `unplugin-auto-import` 或全量引入,体积可接受即可 |

**关键验证步骤(MVP 推进顺序)**:
1. vite 空壳工程能编译 + 引用 `@frontend-app/App.vue` 挂载成功
2. createWebHost 空实现,App 能渲染(可能因缺数据报错,预期)
3. fileLoader 接通 `.lac` 解析 → 波形渲染
4. 导出 Blob 下载闭环
5. 浏览器冒烟测试(参照 `tests/unit/webview/webview-browser-smoke.js` 思路)

## 13. 验收标准(MVP)

- [ ] `cd web-app && npm install && npm run dev` 起本地服务,浏览器打开见应用界面
- [ ] 拖拽或选择一个真实 `.lac` 文件,波形正确渲染
- [ ] 导出功能产生文件下载
- [ ] `npm run build` 产出 `dist/`,用静态服务器托管可正常使用
- [ ] `src/frontend` 与 vscode 侧 webpack 构建零改动、零回归
- [ ] 采集/设备连接相关 UI 在 web 版被正确禁用(capabilities 生效)

## 14. 对现有架构的影响

- **零侵入**:不改 `src/frontend`、不改 `src/extension`、不改 `webpack.config.js`
- 仅新增 `web-app/` 目录
- 若实现中发现必须小幅调整共享层(如抽取 `.lac` 解析),单独走 impact 分析 + 最小改动,不在本 spec 范围预定
