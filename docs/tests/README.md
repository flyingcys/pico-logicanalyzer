# 5层测试生态系统

**历史迁移记录日期**: 2025-08-13
**历史架构版本**: P2.3完整版
**统一测试目录**: `/tests`

---

## 当前校验状态（2026-04-30）

旧说明中的历史完成度结论已经过期。当前可验证事实：

- `tests` 目录保留 5 层测试结构：`unit`、`integration`、`performance`、`stress`、`e2e`。
- 集成、性能、压力和端到端测试中已清理旧 `utest/mocks/simple-mocks` 引用，统一使用 `tests/fixtures/mocks/simple-mocks`。
- `rtk npm run typecheck` 和 `rtk npm run typecheck:strict` 当前作为基础类型门禁；strict gate 已从 models/decoders 扩到少量 driver/service/frontend core 低耦合入口。
- `rtk npm run test:decoders -- --runInBand` 当前通过，10 个测试套件、196 个测试；解码器内部进度、注册和停止日志默认由 `PICO_DECODER_DEBUG` 开关静默。
- `rtk npm run test:ci:quick -- --skip-install` 当前通过，14 个 quick 核心测试文件、373 个测试。
- `rtk npm run test:ci:standard -- --skip-install` 当前通过，18 个测试文件、383 个测试。
- `rtk npm run test:ci:full -- --skip-install` 当前通过，22 个测试文件、393 个测试。
- `rtk npm run test:webview:unit -- --runInBand` 当前通过，3 个测试套件、98 个测试；`ts-jest isolatedModules` 配置 warning 已迁移处理。
- `rtk npm run test:unit -- --silent` 曾出现长时间无输出，当前不作为发布证据；应使用 quick/standard/full 分层命令定位。
- `rtk npm run test:unit` 脚本不再内置 `--maxWorkers`，调用方可按场景追加 `--runInBand` 或 `--maxWorkers`。
- Quick 层暂不阻断测试已收口为 0 个；`LogicAnalyzerDriver.core`、`CaptureModels.core`、`SessionManager.core`、`ConfigurationManager.basic` 已重新纳入 quick 阻断门禁。
- `rtk npm run package:dry` 通过；其中 `vsce ls` 会执行 `vscode:prepublish` 并间接触发 `build:production`，不能理解为 `package:dry` 脚本文本直接串联了生产构建。

下一步先处理测试基础设施：

1. 继续拆分运行 `tests/unit`，定位长耗时或未释放资源的测试文件。
2. 重新生成覆盖率报告后，再更新覆盖率数字和迁移结论。
3. Full 层目前依赖 `--forceExit` 收口长耗时测试，后续应继续清理未释放资源的根因。

---

## 📁 目录结构

```
tests/
├── unit/              📋 P0-P1层: 核心单元测试 (NEW!)
│   ├── drivers/       🔌 硬件驱动核心测试
│   │   └── LogicAnalyzerDriver.core.test.ts
│   ├── models/        📊 数据模型核心测试  
│   │   └── CaptureModels.core.test.ts
│   ├── services/      ⚙️ 服务层核心测试
│   │   ├── SessionManager.core.test.ts
│   │   └── ConfigurationManager.basic.test.ts
│   ├── framework/     🏗️ 单元测试基础框架
│   │   └── UnitTestBase.ts
│   └── [others]/      📁 其他模块单元测试
├── integration/       🔄 P2.1层: 集成测试框架
│   ├── framework/     
│   │   └── IntegrationTestBase.ts
│   └── scenarios/
├── performance/       ⚡ P2.2层: 性能基准测试
│   ├── framework/
│   │   ├── PerformanceTestBase.ts
│   │   └── BenchmarkRunner.ts
│   └── benchmarks/
├── stress/           💪 P2.3层: 压力测试+内存泄漏检测
│   ├── framework/
│   │   ├── StressTestBase.ts
│   │   ├── MemoryLeakDetector.ts
│   │   └── LongTermStressTest.ts
│   └── scenarios/
│       └── MemoryLeakDetection.stress.test.ts
├── e2e/              🌐 端到端测试
├── fixtures/         🛠️ 测试工具、数据、Mock
│   ├── data/         📊 测试数据
│   ├── mocks/        🎭 Mock文件 (从@utest迁移)
│   │   ├── simple-mocks.ts
│   │   └── vscode.ts
│   └── utils/        🔧 测试工具
```

---

## 测试分层 CI 目标预算

以下时间是分层预算，不是 2026-04-30 的实测耗时。当前是否可作为证据以上方“当前校验状态”和 release gate 为准。

### Quick层（目标预算 2 分钟）
```bash
# 核心单元测试和快速 CI 口径
rtk npm run test:ci:quick -- --skip-install
```

### Standard层（目标预算 10 分钟）
```bash
# 核心 + 集成 + 基础性能
rtk npm run test:ci:standard -- --skip-install
```

### Full层（目标预算 30 分钟）
```bash
# 核心 + 集成 + 性能 + 端到端 + 压力
rtk npm run test:ci:full -- --skip-install
```

---

## 历史迁移记录

以下内容来自历史迁移记录，只说明目录和文件来源，不单独作为当前测试通过、覆盖率或发布质量证据。

### 核心测试文件记录

**核心测试文件**（从 @utest 迁移的历史记录）:
- LogicAnalyzerDriver.core.test.ts（历史记录 256 行）
- CaptureModels.core.test.ts（历史记录 272 行）
- SessionManager.core.test.ts（历史记录 278 行）
- ConfigurationManager.basic.test.ts（历史记录 161 行）

**Fixture / stub 文件**（历史记录）:
- simple-mocks.ts（历史记录 75 行）
- vscode.ts（历史记录 37 行）

**测试框架**:
- UnitTestBase.ts（历史迁移记录）

### 历史架构记录

- **P0-P1层**: 核心单元测试目录仍存在，当前门禁覆盖以上方命令为准。
- **P2.1层**: 集成测试目录仍存在，当前门禁覆盖以上方命令为准。
- **P2.2层**: 性能基准测试目录仍存在，当前门禁覆盖以上方命令为准。
- **P2.3层**: 压力测试和内存泄漏检测目录仍存在，当前门禁覆盖以上方命令为准。
- **End-to-End**: 端到端测试目录仍存在，当前门禁覆盖以上方命令为准。

---

## 🎯 使用指南

### 新测试开发
所有新的测试文件都应该在`/tests`目录下创建：

```typescript
// 单元测试示例
import { UnitTestBase } from '../framework/UnitTestBase';

class MyModuleTest extends UnitTestBase {
  private module: MyModule;
  
  beforeEach(): void {
    super.beforeEach();
    this.module = new MyModule();
  }
  
  afterEach(): void {
    super.afterEach();
    this.cleanupMocks();
  }
}
```

### 质量标准
- 📏 文件大小: ≤300行
- 🎭 Mock使用: ≤5个/文件  
- ⚡ 执行时间: ≤5秒/测试
- 💾 内存使用: ≤10MB增长

---

## 📚 相关文档

- 📖 [发布门槛](../release-gate.md)
- 📋 [文档状态索引](../文档状态索引.md)
- 📚 [5层测试架构总览（历史分析）](../utest/test-architecture-comprehensive-overview.md)
- ⚙️ [分层CI执行策略（历史分析）](../utest/layered-ci-strategy-manual.md)

---

## ⚠️ 重要说明

### @utest状态
- 🚨 **@utest目录已弃用** - 不要在其中创建新测试
- 📅 **清理时间表**:
  - 2025-08-20: 停止使用@utest文件
  - 2025-08-27: 归档历史内容
  - 2025-09-03: 完全删除@utest目录

### 历史迁移标记与当前口径
- CI 覆盖的旧 `utest/mocks` 引用已迁移到 `tests/fixtures/mocks`。
- 5 层测试目录结构仍保留。
- Quick、Standard 和 Full 分层执行的当前状态以上方 2026-04-30 命令证据为准。
- ⚠️ 覆盖率报告仍需重新验证后再确认发布候选质量。

---

**让每一行测试代码都有价值，让每一次质量检查都有意义！**

*这里是VSCode逻辑分析器插件的统一测试中心 🚀*
