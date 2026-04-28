# 前端迁移 Smoke Checklist

## Webview

- 在 VS Code 中打开 `.lac` 文件
- 确认 Webview 正常加载，没有空白页
- 确认标题区能显示当前文件名
- 确认顶部语言切换器可以正常展开
- 确认波形区能看到画布容器，不报初始化错误

## 宿主命令

- 设备扫描入口不再直接依赖 `window.vscode`
- 网络配置面板通过 host command 正常返回结果
- 快捷键命令通过 dispatcher/host abstraction 正常发送
- `connectDevice` / `startCapture` / `exportData` 命令链路可达

## HTML 入口

- 打开 `out/webview/html/index.html`
- 确认页面能独立加载
- 确认标题、左右侧栏、波形区、状态栏均可见
- 确认页面样式由 `main-html.js` 注入，不依赖独立 `style.css`

## 任务 04 浏览器 Smoke 记录

- 日期：2026-04-28
- 构建命令：`npm run build:frontend:html`
- 浏览器命令：`NODE_PATH=/tmp/pico-logicanalyzer-pw/node_modules node tests/unit/webview/webview-browser-smoke.js`
- empty：显示“未加载捕获文件”
- settings-only：显示“当前文件只有采集设置”
- invalid：显示“文件内容无效”
- samples：画布加载，导出按钮可点击
- 设备错误路径：未连接设备直接采集返回“请先连接逻辑分析器设备”
- 区域保存边界：Webview 当前只把区域写回 `.lac` 的 `SelectedRegions`；marker 和测量结果只随导出请求发送，不写入 `.lac`

## 资源契约

- `out/webview/webview-manifest.json` 存在
- manifest 至少包含 `main-vscode.js`
- `LACEditorProvider` 不再硬编码 `main.js` 或 `style.css`

## 检索式验收

- `src/frontend` 中 `window.vscode` 仅保留在 host 适配层
- `src/frontend` 中不再出现 `window.documentData`
- `src/frontend` 主路径中不再直接访问 `window.vscode`
- `src/frontend` 主路径中不再直接访问 `window.documentData`
- 旧 `src/webview` 兼容壳仅保留转发/兼容职责
