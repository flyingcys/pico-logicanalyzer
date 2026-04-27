# 测试框架说明

## 目标

当前项目的测试体系已重构为分层结构，目标是降低维护成本，并让主链路测试稳定可运行。

## 当前结构

- `Vitest`
  - 负责主链路测试。
  - 当前纳入默认入口的是：
    - `tests/unit/models/AnalyzerTypes.test.ts`
    - `tests/unit/models/CaptureModels.core.test.ts`
    - `tests/unit/services/ConfigurationManager.basic.test.ts`
    - `tests/unit/services/ConfigurationManager.accurate.test.ts`
    - `tests/unit/services/PulseTimingAnalyzer.comprehensive.test.ts`
    - `tests/unit/services/SignalMeasurementService.accurate.test.ts`
    - `tests/unit/services/NetworkStabilityService.simplified.test.ts`
    - `tests/unit/services/ExportPerformanceOptimizer.comprehensive.test.ts`
    - `tests/unit/services/DataExportService.accurate.test.ts`
    - `tests/unit/services/SessionManager.core.test.ts`
    - `tests/unit/services/WiFiDeviceDiscovery.comprehensive.test.ts`
    - `tests/unit/drivers/AnalyzerDriverBase.comprehensive.test.ts`
    - `tests/unit/drivers/HardwareDriverManager.simple.test.ts`
    - `tests/unit/drivers/LogicAnalyzerDriver.core.test.ts`
    - `tests/unit/drivers/NetworkLogicAnalyzerDriver.simple.test.ts`
    - `tests/unit/utils/MemoryManager.comprehensive.test.ts`
    - `tests/unit/webview/main.test.ts`

- `@vscode/test-electron`
  - 负责真实 VS Code 扩展宿主测试。
  - 当前提供最小烟雾测试，验证：
    - 扩展可激活
    - 关键命令已注册

## 主要命令

- `npm run test`
  - 运行默认完整测试链。
  - 当前等价于 `test:fast + test:extension-host`。

- `npm run test:fast`
  - 运行快速主链路测试。
  - 用于日常 TDD 的 red-green 循环。

- `npm run test:type-check`
  - 仅检查当前主链路测试涉及到的源码与测试文件。

- `npm run test:unit`
  - 通过目录发现运行当前纳入主链路的 unit 测试。
  - 新增测试文件会自动被发现，除非命中排除名单。
  - 当前覆盖模型、基础配置服务、完整配置管理服务、基础会话服务、数据导出服务、基础时序分析服务、基础信号测量服务、简化网络稳定性服务、WiFi 设备发现服务、导出性能优化服务、驱动抽象基类、基础驱动管理器、串口驱动核心逻辑、基础网络驱动解析逻辑、内存管理核心逻辑。

- `npm run test:webview`
  - 运行前端入口测试。

- `npm run test:extension-host`
  - 运行扩展宿主烟雾测试。
  - 在 Linux 环境下通过 `xvfb-run` 无头启动 Electron。

- `npm run test:ci`
  - CI 聚合入口。

- `npm run test:all`
  - 完整本地验证入口。
  - 当前等价于 `test:type-check + test`。

## 为什么没有继续沿用 Jest

旧测试体系把以下职责混在一起：

- TypeScript transform
- Vue transform
- Node 单元测试
- 伪集成测试
- 伪 E2E 测试
- 性能/压力脚本

这导致配置耦合严重，删除任一入口文件后整套测试都会失效。新的结构把“快反馈主链路”和“真实宿主验证”拆开，避免继续堆在同一个框架进程里。

## 当前明确不纳入默认主链路的内容

以下测试仍保留在仓库中，但暂时没有接入当前默认发现链路：

- `tests/unit/extension/**`
- `tests/unit/database/**`
- `tests/unit/decoders/**`
- `tests/unit/tools/**`
- `tests/integration/**`
- `tests/e2e/**`
- `tests/performance/**`
- `tests/stress/**`

另外，`tests/unit/services/**`、`tests/unit/drivers/**`、`tests/unit/models/**` 中仍有部分文件处于排除名单，不会被默认 `test:unit` 自动执行。
排除名单以 [vitest.config.ts](/home/share/samba/vscode-extension/pico-logicanalyzer/.worktree/test-framework-rebuild/vitest.config.ts) 和 [tsconfig.test.json](/home/share/samba/vscode-extension/pico-logicanalyzer/.worktree/test-framework-rebuild/tsconfig.test.json) 为准。

原因不是这些目录不重要，而是其中存在大量历史问题：

- 依赖旧 `utest` 路径
- 与当前源码签名不一致
- 以 mock 场景冒充真实集成/端到端
- 对 VS Code API 的 mock 过于简化
- 与 `src/frontend` / `src/webview` 的重构边界不一致

## 后续迁移建议

建议按下面顺序继续迁移：

1. `tests/unit/extension/**`
   - 逐步废弃，迁移到 `tests/extension-host/**`

2. `tests/unit/services/**`
   - 优先迁入 `Vitest`
   - 每次只纳入稳定子集
   - 迁入方式以“目录发现 + 缩小排除名单”为主，而不是继续扩充脚本里的硬编码文件名

3. `tests/unit/drivers/**`
   - 先整理 mock 与设备适配层边界
   - 再迁入 `Vitest`

4. `tests/integration/**` 与 `tests/e2e/**`
   - 重新分类
   - 只有真实宿主或真实交互链路才保留为 integration / e2e

5. `tests/performance/**` 与 `tests/stress/**`
   - 只接入单独脚本或夜间 CI
   - 不回到默认 `npm test`

## 被删除文件的处理原则

本次没有恢复以下旧文件的原始形态：

- `jest.config.js`
- `jest.config.simple.js`
- `jest.webview.config.js`
- `driver-testing.yml`

原因是这些文件对应的是旧测试架构。现在恢复的是“必要职责”而不是“旧文件原样”：

- 新测试配置入口：`vitest.config.ts`
- 新测试 TS 配置：`tsconfig.test.json`
- 新最小 CI：`.github/workflows/ci.yml`
- 新本地门禁：`.husky/pre-commit`

这样做的目的是避免把旧问题重新带回主链路。
