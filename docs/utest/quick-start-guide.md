# 🚀 测试框架快速上手指南

**目标**: 5分钟掌握新测试标准，10分钟写出高质量测试

---

## ⚡ 快速开始

### 1️⃣ 环境检查（30秒）
```bash
# 确认环境
node --version  # 需要 >= 16.0.0
npm --version   # 需要 >= 8.0.0

# 安装依赖
npm install
```

### 2️⃣ 运行核心测试（1分钟）
```bash
# 运行所有核心测试
npm run test:unit

# 运行特定模块测试
npx jest utest/unit/drivers/LogicAnalyzerDriver.core.test.ts --verbose
npx jest utest/unit/services/ConfigurationManager.basic.test.ts --verbose
```

### 3️⃣ 生成测试报告（30秒）
```bash
# 生成可视化仪表板
node scripts/generate-test-dashboard.js

# 在浏览器中查看
open test-dashboard.html
```

---

## 📝 创建新测试（5分钟教程）

### 🎯 步骤1：选择测试类型

根据模块重要性选择：

| 模块类型 | 测试策略 | 示例 |
|----------|----------|------|
| **核心模块** | 必须测试 | LogicAnalyzerDriver, ConfigurationManager |
| **次要模块** | 按需测试 | UtilsModule, ThemeManager |
| **UI组件** | 集成测试 | WebView, Dashboard |

### 🎯 步骤2：复制测试模板

```bash
# 复制模板文件
cp docs/utest/templates/module-template.test.ts utest/unit/your-module/YourModule.core.test.ts
```

### 🎯 步骤3：快速替换

```typescript
// 1. 替换模块名称
import { YourModule } from '../../../src/path/YourModule';

// 2. 替换测试描述
describe('YourModule 核心功能测试', () => {

// 3. 替换核心测试
it('应该能够执行核心业务功能', async () => {
  // Arrange
  const testInput = createTestData();
  
  // Act  
  const result = await yourModule.coreMethod(testInput);
  
  // Assert
  expect(result).toBeDefined();
});
```

### 🎯 步骤4：运行测试
```bash
# 运行新测试
npx jest utest/unit/your-module/YourModule.core.test.ts --verbose

# 检查质量标准
git add utest/unit/your-module/YourModule.core.test.ts
git commit -m "feat: add YourModule core tests"
# Pre-commit hook会自动检查文件大小和Mock数量
```

---

## 🛡️ 质量标准速查

### ✅ 必须遵循
- [ ] **文件大小** < 200行
- [ ] **Mock数量** < 5个
- [ ] **测试真实功能**（而非Mock行为）
- [ ] **清晰的测试命名**
- [ ] **完整的setup/teardown**

### 🎯 推荐实践
- [ ] 使用AAA模式（Arrange-Act-Assert）
- [ ] 一个测试只验证一个功能点
- [ ] 包含错误处理测试
- [ ] Mock最小化，专注业务逻辑

---

## 🔧 常用命令速查

### 测试执行
```bash
# 核心测试套件
npm run test:unit                    # 所有单元测试
node scripts/ci-test-runner.js      # CI测试运行器

# 特定测试
npx jest path/to/test.ts --verbose  # 运行特定测试
npx jest --watch                    # 监视模式
npx jest --coverage                 # 覆盖率报告
```

### 质量检查
```bash
# 手动质量检查
node scripts/test-quality-check.js

# Git hooks（自动执行）
git add test-file.ts
git commit -m "message"  # 自动触发质量检查
```

### 报告生成
```bash
# 测试仪表板
node scripts/generate-test-dashboard.js

# CI测试报告
node scripts/ci-test-runner.js      # 生成 ci-test-report.json
```

---

## 🏆 成功模式示例

### ✅ 标准测试结构
```typescript
/**
 * ConfigurationManager 基础功能测试
 * 遵循质量标准: <200行, <5个Mock, 测试真实功能
 */

// 简化Mock - 只Mock必要的依赖
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn(() => ({ get: jest.fn(), update: jest.fn() }))
  }
}));

import { ConfigurationManager } from '../../../src/services/ConfigurationManager';

describe('ConfigurationManager 基础功能测试', () => {
  let configManager: ConfigurationManager;

  beforeEach(async () => {
    jest.clearAllMocks();
    configManager = new ConfigurationManager();
    await configManager.initialize();
  });

  afterEach(async () => {
    await configManager?.dispose();
  });

  describe('基础配置读写', () => {
    it('应该能够获取默认配置值', () => {
      // Arrange - 准备测试数据
      const defaultRate = 24000000;
      
      // Act - 执行功能
      const rate = configManager.getNumber('defaultSampleRate');
      
      // Assert - 验证结果
      expect(rate).toBe(defaultRate);
    });

    it('应该能够设置配置值', async () => {
      // Arrange
      const testKey = 'general.autoSave';
      const newValue = false;
      
      // Act
      await configManager.set(testKey, newValue);
      const result = configManager.getBoolean(testKey);
      
      // Assert
      expect(result).toBe(newValue);
    });
  });

  describe('错误处理', () => {
    it('应该处理未知配置键', () => {
      // Act
      const value = configManager.get('unknown.key', 'default');
      
      // Assert
      expect(value).toBe('default');
    });
  });
});
```

### 🎯 核心要点
1. **Mock最小化**: 只Mock外部依赖，不Mock被测试模块
2. **真实功能测试**: 验证业务逻辑，不验证Mock调用
3. **清晰结构**: describe分组，it描述具体行为
4. **完整生命周期**: beforeEach/afterEach确保隔离
5. **错误处理**: 包含异常和边界情况测试

---

## 🚫 常见错误避免

### ❌ 错误示例1：Mock过多
```typescript
// 错误：Mock了被测试模块的内部方法
const mockSave = jest.spyOn(configManager, 'save');
const mockValidate = jest.spyOn(configManager, 'validate');
const mockNotify = jest.spyOn(configManager, 'notify');
// ... 更多Mock
```

### ✅ 正确做法：最小Mock
```typescript
// 正确：只Mock外部依赖
jest.mock('vscode', () => mockVSCode);
jest.mock('fs', () => mockFS);
```

### ❌ 错误示例2：测试Mock行为
```typescript
// 错误：测试Mock是否被调用
it('should call save method', () => {
  const saveSpy = jest.spyOn(service, 'save');
  service.operation();
  expect(saveSpy).toHaveBeenCalled(); // 这是测试Mock，不是功能
});
```

### ✅ 正确做法：测试结果
```typescript
// 正确：测试业务结果
it('应该保存配置数据', async () => {
  await service.operation();
  const saved = service.getData();
  expect(saved.isValid).toBe(true); // 测试真实结果
});
```

---

## 📋 检查清单

### 提交前自检
- [ ] 文件大小 < 200行
- [ ] Mock数量 < 5个  
- [ ] 所有测试通过
- [ ] 测试命名清晰
- [ ] 包含错误处理测试
- [ ] TypeScript编译无错误

### Code Review检查
- [ ] 测试逻辑简单直接
- [ ] 没有测试Mock行为
- [ ] 使用AAA模式
- [ ] 断言具体有意义
- [ ] 遵循项目命名约定

---

## 🆘 故障排除

### 常见问题解决

#### Q: Pre-commit Hook失败
```bash
# 问题：文件大小超出限制
❌ 文件过大: 315 行 (限制: 200 行)

# 解决：拆分文件
cp large-file.test.ts basic.test.ts
cp large-file.test.ts advanced.test.ts
# 编辑拆分内容
```

#### Q: Mock数量超限
```bash
# 问题：Mock过多
❌ Mock过多: 8 个 (限制: 5 个)

# 解决：使用简化Mock
// 替换复杂Mock为简单版本
import { mockVSCode } from '../../mocks/simple-mocks';
```

#### Q: 测试超时
```bash
# 问题：测试运行超时
Test timeout

# 解决：检查异步清理
afterEach(async () => {
  await service?.dispose(); // 确保正确清理
});
```

#### Q: TypeScript错误
```bash
# 问题：类型不匹配
Property 'method' does not exist

# 解决：检查导入和类型
import { CorrectType } from '../../../src/path/Module';
```

---

## 🎯 下一步学习

### 进阶主题
1. **集成测试编写**（P2阶段）
2. **性能基准测试**（P2阶段）  
3. **E2E测试策略**（后续规划）
4. **测试数据管理**（高级主题）

### 推荐资源
- [测试质量标准详细版](./test-quality-standards.md)
- [CI/CD集成指南](../ci/ci-integration-guide.md)
- [测试架构设计文档](./test-architecture-design.md)

---

## 🎉 成功指标

完成快速上手后，你应该能够：

✅ **5分钟内**: 创建符合质量标准的新测试文件  
✅ **10分钟内**: 编写包含核心功能和错误处理的测试  
✅ **15分钟内**: 运行测试、生成报告、通过质量检查  

**恭喜！你已经掌握了我们的高质量测试标准！** 🎊

---

*📅 文档版本: v1.0 | 最后更新: 2025-08-13*  
*💡 问题反馈: 请提交Issue或联系测试团队*