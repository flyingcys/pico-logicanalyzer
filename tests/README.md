# 🧪 5层测试生态系统

**迁移完成**: 2025-08-13  
**架构版本**: P2.3完整版  
**统一测试目录**: `/tests`

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

## 🚀 测试分层CI执行策略

### Quick层 (2分钟)
```bash
# 仅执行P0-P1层核心单元测试
npm test -- tests/unit/
```

### Standard层 (10分钟)  
```bash
# 执行核心+集成+性能测试
npm test -- tests/unit/ tests/integration/ tests/performance/
```

### Full层 (30分钟)
```bash
# 完整测试生态系统
npm test -- tests/
```

---

## 📊 迁移状态

### ✅ 已迁移内容

**核心测试文件** (从@utest迁移):
- ✅ LogicAnalyzerDriver.core.test.ts (256行, 高质量)
- ✅ CaptureModels.core.test.ts (272行, 高质量)  
- ✅ SessionManager.core.test.ts (278行, 高质量)
- ✅ ConfigurationManager.basic.test.ts (161行, 基础功能)

**Mock文件** (精选迁移):
- ✅ simple-mocks.ts (75行, 简洁实用)
- ✅ vscode.ts (37行, VSCode Mock)

**测试框架**:
- ✅ UnitTestBase.ts (新建, 统一标准)

### 🔄 架构完整性

- ✅ **P0-P1层**: 核心单元测试 (新建完成)
- ✅ **P2.1层**: 集成测试框架 (已存在)
- ✅ **P2.2层**: 性能基准测试 (已存在)  
- ✅ **P2.3层**: 压力测试+内存泄漏检测 (已存在)
- ✅ **End-to-End**: 端到端测试 (已存在)

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

- 📖 [5层测试架构总览](../docs/utest/test-architecture-comprehensive-overview.md)
- 📋 [测试最佳实践指南](../docs/utest/testing-best-practices-guide.md)
- ⚙️ [分层CI执行策略](../docs/utest/layered-ci-strategy-manual.md)  
- 🔍 [内存泄漏检测指南](../docs/utest/memory-leak-detection-guide.md)
- 📁 [迁移行动计划](../tests-docs/migration-action-plan.md)

---

## ⚠️ 重要说明

### @utest状态
- 🚨 **@utest目录已弃用** - 不要在其中创建新测试
- 📅 **清理时间表**: 
  - 2025-08-20: 停止使用@utest文件
  - 2025-08-27: 归档历史内容  
  - 2025-09-03: 完全删除@utest目录

### 迁移完成标志
- ✅ 核心测试100%迁移完成
- ✅ 5层测试架构完整建立
- ✅ CI分层执行正常运行
- ✅ 团队完全切换到@tests目录

---

**让每一行测试代码都有价值，让每一次质量检查都有意义！**

*这里是VSCode逻辑分析器插件的统一测试中心 🚀*