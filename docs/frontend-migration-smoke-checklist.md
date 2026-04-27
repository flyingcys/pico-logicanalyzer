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
