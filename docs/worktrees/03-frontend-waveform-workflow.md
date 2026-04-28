# 03 新 Vue3 前端真实波形工作流执行记录

## 当前基线

- 任务来源：`docs/parallel-worktrees-2026-04-28.md` 中 `.worktree/03`，分支 `parallel/03-frontend-waveform-workflow`。
- 目标：让新前端从 `.lac` 文档中装载真实通道样本，并提供可验证的波形查看体验。
- 启动状态：`## parallel/03-frontend-waveform-workflow`，无本 worktree 内已修改文件。
- 基线验证：`npm run test:webview:unit -- --runInBand` 通过，2 个测试套件、37 个测试。

## 范围内

- `src/frontend/core/stores/sessionStore.ts`：统一 root `Samples`、root `samples`、channel `Samples`、channel `samples` 的装载，并补齐样本数推导。
- `src/frontend/core/stores/waveformStore.ts`：消费真实通道样本，维持基础缩放、平移、选择和视口状态。
- `src/frontend/core/engines/WaveformRenderer.ts`：基础 canvas 波形渲染、可见范围、resize、marker、区域和选区覆盖层。
- `src/frontend/app/components/AppWaveformStage.vue`：样本/空文件/settings-only/invalid 状态显示，基础缩放、平移、fit 和预览条拖动。
- `tests/unit/webview/`：真实样本装载、视口操作、状态 UI 和渲染路径单元测试。
- 文档：功能状态矩阵和本执行记录。

## 范围外

- 不实现设备连接、网络扫描、开始/停止/重复采集命令链路；该范围归 `.worktree/04`。
- 不实现复杂编辑、回写 `.lac`、undo/redo 和完整 marker/measurement 原版迁移；该范围归 `.worktree/06`。
- 不改变 `.lac` 持久化格式和导出语义；该范围归 `.worktree/02`。
- 不修改真实硬件驱动协议和硬件认证矩阵。

## 接口契约

- 前端 session store 对 `.lac` 输入保持宽松兼容：
  - root 样本字段：`Samples`、`samples`。
  - 通道样本字段：`CaptureChannels[].Samples`、`captureChannels[].samples`。
  - 样本值支持 packed UInt128 字符串/数字，通道样本支持 `0/1` 数组和二进制字符串。
- 当 `.lac` 没有显式 `totalSamples`/`TotalSamples`，也无法由 pre/post/loop 推导时，`sessionStore.totalSamples` 使用 root 样本长度和通道样本最大长度中的较大值。
- `AppWaveformStage` 不直接调用 host 命令，只消费 `sessionStore` 和 `waveformStore`。
- 预览条拖动只改变 `waveformStore.viewRange.firstSample`，保留当前 `visibleSamples`。

## 执行日志

### 阶段 1：装载测试

- 新增 lowercase root `samples` 回归测试，覆盖缺少 `totalSamples` 时的样本数推导和 packed 样本解包。
- 红灯结果：测试失败，`sessionStore.totalSamples` 为 `0`。
- 修复：增加 root/channel 样本长度兜底推导。

### 阶段 2：状态和视口测试

- 新增 `AppWaveformStage` 状态测试，覆盖 empty、settings-only、invalid 和 samples 四种文档状态。
- 新增预览条拖动测试，验证从预览条中心跳转到对应视口。
- 红灯结果：状态层不存在，预览条拖动未改变视口。
- 修复：增加状态层、预览条 pointer 事件和视口换算。

### 阶段 3：渲染路径测试

- 新增 renderer 回归测试，覆盖首个通道无样本、后续通道有真实样本时仍然渲染。
- 红灯结果：renderer 依赖首个通道样本，提前返回。
- 修复：renderer 改为按可见且有样本的通道集合计算总样本数和渲染循环。

## 验收结论

- `npm run typecheck`：通过。
- `npm run test:webview:unit -- --runInBand`：通过，2 个测试套件、41 个测试。
- `npm run build:frontend:html`：通过，webpack webview 编译成功；开发构建产物体积有既有 big asset 提示。

## 限制和后续协调

- 当前非空渲染验收使用 jsdom canvas context 调用断言，属于像素级验收的自动化替代；真实浏览器截图可在合并前用 Playwright 或 VS Code Webview smoke 再补。
- 复杂编辑、持久化和 undo/redo 不在本 worktree 内展开，避免与 `.worktree/06` 交叉。
- 采集完成后的文档刷新和 host command 链路不在本 worktree 内展开，避免与 `.worktree/04` 交叉。
