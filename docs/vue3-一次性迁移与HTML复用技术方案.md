# Vue 3 一次性迁移与 HTML 复用技术方案

## 1. 文档目的

本文用于明确当前项目 Webview 前端的真实技术现状，并给出一次性重构方案，使其满足以下目标：

- 形成规范的 `Vue 3` 前端架构。
- 摆脱对 `VS Code Webview` 宿主环境的直接耦合。
- 后续能够以较低成本复用到独立 `HTML` 页面或静态站点。

本文是技术方案文档，不是实施记录，也不是逐步任务清单。

## 2. 现状结论

当前项目并不是“还没有采用 Vue 3”，而是“已经引入 Vue 3，但尚未形成可复用的 Vue 3 应用架构”。

关键依据如下：

- [`package.json`](/home/share/samba/vscode-extension/pico-logicanalyzer/package.json:293) 已依赖 `vue`、[`package.json`](/home/share/samba/vscode-extension/pico-logicanalyzer/package.json:291) 已依赖 `pinia`、[`package.json`](/home/share/samba/vscode-extension/pico-logicanalyzer/package.json:290) 已依赖 `element-plus`。
- [`src/webview/main.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/main.ts:1) 已使用 `createApp(App)` 创建 `Vue 3` 应用。
- [`src/webview/App.vue`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/App.vue:1) 与 `src/webview/components/*.vue` 已普遍使用 `<script setup lang="ts">`。
- [`webpack.config.js`](/home/share/samba/vscode-extension/pico-logicanalyzer/webpack.config.js:89) 已配置 `vue-loader` 和 Webview 构建入口。

因此，本次工作的准确定位不是“升级到 Vue 3”，而是：

> 将当前已经基于 Vue 3 的 Webview 前端，一次性重构为“Vue 3 应用壳 + 可复用前端内核 + 宿主适配层”的双端架构。

## 3. 当前主要问题

### 3.1 宿主耦合过深

多个组件和页面逻辑直接调用 `window.vscode.postMessage(...)`，例如：

- [`src/webview/App.vue`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/App.vue:264)
- [`src/webview/components/NetworkConfigurationPanel.vue`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/components/NetworkConfigurationPanel.vue:116)
- [`src/webview/utils/KeyboardShortcutManager.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/utils/KeyboardShortcutManager.ts:308)

这会带来三个直接问题：

- 组件无法脱离 VS Code 运行。
- 单元测试必须 mock `window.vscode`，测试边界不清晰。
- 后续复用到独立 HTML 时，需要大面积逐个改组件。

### 3.2 页面壳承担了过多职责

[`src/webview/App.vue`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/App.vue:1) 当前同时承担：

- 页面布局与工具栏编排
- 文档初始化
- 宿主消息监听
- 波形渲染器创建与销毁
- 解码器状态协调
- 设备连接与采集命令触发
- 通知与交互反馈

这意味着 `App.vue` 既是页面壳，又是应用控制器，后续不利于：

- 分端入口复用
- Pinia 状态分层
- 功能模块独立测试
- 页面拆分和演进

### 3.3 已安装 Pinia，但未形成状态中心

[`src/webview/main.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/main.ts:2) 已安装 `Pinia`，但当前主要状态仍集中在 `App.vue` 的本地 `ref/computed` 中。结果是：

- 状态跨组件共享依赖 props / ref 暴露 / 直接方法调用。
- 消息驱动状态变更难以统一追踪。
- HTML 入口与 Webview 入口难以共享同一套应用状态装配。

### 3.4 构建产物引用方式不稳定

改造前，Webview 构建入口与扩展端资源引用之间没有稳定契约：构建配置和扩展端 HTML 拼接逻辑分别维护资源名，容易在入口改名、资源拆分或输出策略变化时失配。

当前实现已经做了第一步收口：

- Webview 逻辑入口为 `main-vscode.js`
- HTML 逻辑入口为 `main-html.js`
- [`webpack.config.js`](/home/share/samba/vscode-extension/pico-logicanalyzer/webpack.config.js:1) 会额外输出 `webview-manifest.json`
- [`src/providers/LACEditorProvider.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/providers/LACEditorProvider.ts:1) 已改为读取 manifest，而不是继续硬编码 `main.js` / `style.css`

这也说明，资源契约必须显式化，不能再依赖拼接约定或默认文件名。否则会继续带来这些问题：

- 生产构建资源名变化后，Webview 资源引用容易失效。
- 后续新增 `HTML` 入口时，扩展端资源装配逻辑会更混乱。
- 构建系统迁移到 `Vite` 或更换输出策略时成本上升。

### 3.5 “Webview 工程”而不是“前端工程”

当前目录主要按 `src/webview` 组织，重点是“运行在 VS Code 里”，而不是“哪些逻辑是前端可复用内核”。这会让以下能力混在一起：

- 页面视图
- 宿主消息协议
- 波形引擎
- 本地 UI 工具
- 文档生命周期
- 业务状态

从长期看，这会阻碍 HTML 复用、测试隔离和后续多人协作。

## 4. 本次一次性重构的目标

### 4.1 总体目标

一次性将前端重构为三层架构：

- `App` 层：Vue 3 页面壳与界面编排
- `Core` 层：业务状态、渲染协调、领域服务
- `Platform` 层：宿主适配，分别对接 `VS Code Webview` 与独立 `HTML`

### 4.2 具体目标

- 所有 Vue 组件不再直接访问 `window.vscode`。
- 所有宿主交互统一通过宿主适配接口完成。
- Webview 与 HTML 共享同一套核心状态和业务逻辑。
- `App.vue` 退化为页面装配壳，不再直接承担主要业务协调。
- Webview 构建资源引用与扩展端装配建立稳定契约。
- 同一套前端代码支持两个入口：
  - `VS Code Webview`
  - 独立 `HTML`

## 5. 不纳入本次范围的事项

为控制风险，本次不建议把以下内容混入迁移：

- 全量 UI 视觉重设计
- 波形渲染算法重写
- 全量替换 `Element Plus`
- 对所有现存功能缺口进行补完
- 扩展端非前端问题的大规模重构

原因很简单：本次核心目标是“架构迁移”和“复用边界建立”，不是产品全面重写。

## 6. 目标架构设计

### 6.1 三层架构

#### A. App 层

负责：

- Vue 3 应用初始化
- 页面布局和 UI 编排
- 组件装配
- 将 `store`、`host`、`i18n`、UI 框架注入应用

不负责：

- 直接访问 `window.vscode`
- 直接处理原始宿主消息
- 承担核心业务状态

#### B. Core 层

负责：

- 当前文档状态
- 采集状态
- 波形视图状态
- 解码器状态
- 导出状态
- 波形渲染服务编排
- 宿主消息到状态动作的映射

要求：

- 不依赖 `VS Code API`
- 不依赖浏览器全局宿主对象约定
- 可以被 `Webview` 和 `HTML` 共用

#### C. Platform 层

负责：

- 封装 `VS Code Webview` 通信
- 封装独立 HTML 运行模式下的数据获取方式
- 对外暴露统一的 `HostAdapter` 接口

这是实现“同一套前端内核同时支持两个宿主”的关键。

### 6.2 推荐目录结构

建议将当前 `src/webview` 重组为以下结构：

```text
src/
  frontend/
    app/
      App.vue
      main-vscode.ts
      main-html.ts
      layouts/
      pages/
      components/
      composables/
    core/
      models/
      stores/
      services/
      engines/
      protocol/
      commands/
    platform/
      bootstrap/
        createFrontendApp.ts
      host/
        types.ts
        vscodeHost.ts
        browserHost.ts
        messageBridge.ts
    shared/
      i18n/
      utils/
      styles/
```

说明如下：

- `app/`：所有 Vue 视图和界面编排
- `core/`：前端业务内核
- `platform/host/`：宿主适配实现
- `platform/bootstrap/`：双入口共用的应用创建逻辑
- `shared/`：通用样式、国际化、工具方法

## 7. 关键设计决策

### 7.1 统一宿主接口，禁止组件直连 `window.vscode`

定义统一宿主接口 `HostAdapter`，例如：

```ts
export interface HostAdapter {
  ready(): void;
  loadInitialDocument(): Promise<FrontendDocumentPayload | null>;
  saveDocument(payload: SaveDocumentPayload): Promise<void>;
  exportData(payload: ExportPayload): Promise<void>;
  connectDevice(): Promise<void>;
  startCapture(): Promise<void>;
  sendCommand(command: HostCommand): Promise<void>;
  onMessage(handler: (message: HostInboundMessage) => void): () => void;
}
```

设计原则：

- 组件只依赖 `store` 或 `useHost()`
- `store/action` 调用 `HostAdapter`
- `HostAdapter` 决定底层是 `postMessage` 还是浏览器本地实现

这样处理后：

- Webview 模式走 `vscodeHost.ts`
- HTML 模式走 `browserHost.ts`
- 组件和页面不需要知道自己运行在哪个宿主中

### 7.2 建立统一消息桥，而不是在页面内零散监听

当前 [`src/webview/App.vue`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/App.vue:192) 直接监听 `window.message`。重构后应改为：

- `vscodeHost.ts` 接收原始 `postMessage`
- `messageBridge.ts` 将原始消息转换为前端统一消息模型
- `store` 或 `service` 消费统一消息

好处：

- 通信协议变化只影响平台层
- 核心状态层不需要知道 VS Code 的消息细节
- HTML 模式可以构造同样的消息模型进行模拟

### 7.3 App 只保留装配职责

重构后 `App.vue` 应只负责：

- 页面主布局
- 工具栏、侧栏、主视图、状态栏的组合
- 从 `store` 读取状态，触发高层 action

以下能力应从 `App.vue` 移出：

- 宿主消息监听
- 文档初始化解析
- 波形渲染器的复杂生命周期编排
- 解码器系统初始化
- 导出命令细节

### 7.4 正式使用 Pinia 进行状态分层

推荐至少拆为以下几个 store：

#### `sessionStore`

负责：

- 当前文件信息
- `sampleRate`
- `totalSamples`
- 是否有数据
- 保存状态

#### `deviceStore`

负责：

- 连接状态
- 当前设备信息
- 采集状态
- 网络配置与扫描结果

#### `waveformStore`

负责：

- 当前视图范围
- 缩放等级
- 平移偏移
- 标记、区域、选区
- 画布相关高层状态

#### `decoderStore`

负责：

- 解码器配置
- 解码结果
- 冲突状态
- 性能告警与运行状态

#### `uiStore`

负责：

- 当前活动面板
- 布局设置
- 对话框显示状态
- 通知与全局交互反馈

这比把绝大部分状态塞在 `App.vue` 中更适合双入口复用。

### 7.5 渲染引擎保留，但通过服务接入

现有引擎模块具备继续复用价值，例如：

- [`src/webview/engines/WaveformRenderer.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/engines/WaveformRenderer.ts:1)
- [`src/webview/engines/InteractionEngine.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/engines/InteractionEngine.ts:31)
- [`src/webview/engines/ChannelLayoutManager.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/engines/ChannelLayoutManager.ts:43)
- [`src/webview/engines/VirtualizationRenderer.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/webview/engines/VirtualizationRenderer.ts:59)

但它们不应继续直接被 `App.vue` 绑定。建议引入 `waveformService` 或 `useWaveformViewport()` 之类的中间层，负责：

- 绑定 canvas
- 接收 `waveformStore` 状态
- 驱动 renderer 更新
- 在组件销毁时释放资源

这样可以保留已有引擎投资，同时降低页面层复杂度。

## 8. HTML 复用方案

### 8.1 复用目标的正确理解

这里的“复用到 HTML”不建议理解为：

- 把现有 Vue 页面拆成可以随便复制粘贴到任意原生 HTML 的脚本片段

更合理的目标应该是：

- 同一个前端工程支持 `Webview` 和 `HTML` 两个正式入口
- `HTML` 入口可以独立运行
- 两个入口共享同一套应用内核、状态层、渲染层和大部分组件

### 8.2 HTML 入口的推荐形态

建议 `HTML` 入口支持以下场景：

- 本地静态页面演示
- 独立开发调试页面
- 以后嵌入网站中的单页应用子页面

第一阶段不建议额外追求：

- 直接封装为 Web Component
- 直接输出零框架的嵌入片段

这些是后续可选增强，不应成为本次迁移的前置条件。

### 8.3 HTML 模式下的宿主实现

`browserHost.ts` 需要负责：

- 提供 demo/mock 文档加载
- 提供本地 JSON 导入导出或基于浏览器 API 的导出能力
- 提供设备命令的 mock 行为或后续接 HTTP/WebSocket API
- 向前端状态层提供与 Webview 相同的消息模型

这样 HTML 模式不再只是“看页面”，而是具备基本交互闭环。

## 9. 构建与资源装配方案

### 9.1 双入口

建议建立两个前端入口：

- `main-vscode.ts`
- `main-html.ts`

二者共用：

- `createFrontendApp.ts`
- `App.vue`
- `stores`
- `services`
- `engines`

差异只体现在宿主注入：

- `main-vscode.ts` 注入 `vscodeHost`
- `main-html.ts` 注入 `browserHost`

### 9.2 资源装配契约

必须解决当前 [`LACEditorProvider.ts`](/home/share/samba/vscode-extension/pico-logicanalyzer/src/providers/LACEditorProvider.ts:121) 对打包产物的硬编码问题。推荐方案：

- 前端构建输出 `manifest`
- 扩展端读取 `manifest` 获取真实脚本入口文件名
- `LACEditorProvider` 只负责把资源 URI 和 bootstrap 数据注入 Webview

扩展端不再假设存在固定的：

- `main.js`
- `style.css`

这是支持长期演进的必要条件。

### 9.3 Bootstrap 数据注入

建议把当前内联的：

- `window.vscode = acquireVsCodeApi()`
- `window.documentData = {...}`

收敛为统一 bootstrap 结构，例如：

```ts
interface FrontendBootstrapData {
  host: 'vscode' | 'html';
  document?: {
    uri: string;
    fileName: string;
    content: string;
  };
  capabilities?: {
    canSave: boolean;
    canExport: boolean;
    canStartCapture: boolean;
  };
}
```

然后由入口文件完成宿主初始化和数据分发，而不是由页面直接读取全局散装变量。

## 10. 一次性迁移的推荐范围

本次建议一次性纳入：

1. 前端目录整体重组
2. 宿主适配层抽象
3. 消息桥与统一协议模型
4. `App.vue` 拆分与职责收口
5. `Pinia` 状态中心正式落地
6. `Webview / HTML` 双入口建立
7. 构建资源装配契约修复

本次不纳入：

1. 视觉系统重做
2. 引擎算法重写
3. 全业务补完
4. 非前端模块的大规模顺手重构

## 11. 风险与对策

### 风险 1：`App.vue` 拆分时行为回归

原因：

- 当前逻辑高度集中。

对策：

- 先把逻辑迁出到 store/service，再拆模板结构。
- 对关键交互补充 smoke test。

### 风险 2：组件中存在较多隐式宿主依赖

原因：

- 目前 `window.vscode` 访问分散。

对策：

- 在迁移前先系统清点所有 `window.vscode` 调用点。
- 建立迁移清单，逐项切换到 `HostAdapter`。

### 风险 3：构建与 Webview 装配联动出错

原因：

- 当前扩展端与前端产物耦合方式脆弱。

对策：

- 优先建立 manifest 装配机制。
- 在 VS Code Webview 和独立 HTML 两个入口都做最小启动验证。

## 12. 验收标准

一次性迁移完成后，至少应满足以下验收标准：

### 架构验收

- Vue 组件中不再直接使用 `window.vscode`
- `App.vue` 不再承担宿主消息和主要业务编排职责
- `Pinia` 具备明确的状态分层
- 前端存在 `Webview` 与 `HTML` 两个正式入口

### 运行验收

- 在 VS Code 中可以正常打开 Webview
- 在 HTML 模式下可以独立加载页面并展示示例数据
- 文档加载、基础交互、导出入口、消息链路可正常运行

### 工程验收

- 扩展端不再硬编码前端打包资源文件名
- 前端打包产物与扩展端装配存在稳定契约
- 后续新增宿主时，不需要大面积修改 Vue 组件

## 13. 结论与建议

本项目当前已经使用 `Vue 3`，但还没有进入“可持续演进、可脱离宿主复用”的架构状态。继续在现有结构上做小修，只会不断加重 `Webview` 耦合，后续复用到独立 `HTML` 的成本会越来越高。

因此，推荐采用一次性规范化重构方案，核心策略是：

- 保留现有 `Vue 3`、`Element Plus`、波形引擎与已有组件资产
- 一次性拆出 `Core + Platform + App` 三层边界
- 用双入口替代单一 `Webview` 入口
- 用宿主适配层替代组件内的 `window.vscode` 直连

这条路线的投入高于局部修补，但能够一次性解决当前最核心的结构债，并为后续 HTML 复用建立稳定基础。

## 14. 当前落地说明（2026-04-27）

截至当前版本，方案中的关键工程化决策已经落地为以下形态：

- Webview 入口已切到 `src/frontend/app/main-vscode.ts`
- HTML 入口已切到 `src/frontend/app/main-html.ts`
- Webpack 已输出双入口产物，并生成 `out/webview/html/index.html`
- Webview 资源装配已从固定脚本名切换为读取 `out/webview/webview-manifest.json`
- 运行时依赖的是逻辑入口名 `main-vscode.js` / `main-html.js`，再由 manifest 映射到真实产物名；在生产构建中，真实文件名允许带 `contenthash`
- `LACEditorProvider` 不再依赖不存在的 `style.css` 文件
- 旧 `src/webview/main.ts` 和 `src/webview/App.vue` 已收敛为迁移兼容 shim
- Webview 单测已落地为独立配置：`jest.webview.config.js`

当前仍保留的后续工作主要集中在测试基础设施与历史遗留代码清理，而不是新 frontend 架构本身。
