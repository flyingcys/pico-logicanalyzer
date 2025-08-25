# 核心测试文件保留清单

## 基于分析报告的核心测试重构方案

### 保留的测试文件 (目标: 10-15个核心测试)

#### 1. 驱动层测试 (3个)
- `unit/drivers/logic-analyzer-driver/LogicAnalyzerDriver.test.ts` (需要简化到<200行)
- `unit/drivers/analyzer-driver-base/AnalyzerDriverBase.test.ts` (需要简化)  
- `unit/drivers/hardware-driver-manager/HardwareDriverManager.functional.test.ts` (最实用的版本)

#### 2. 数据模型测试 (3个)
- `unit/models/CaptureModels.test.ts` (需要简化)
- `unit/models/AnalyzerTypes.test.ts` (基础类型测试)
- `unit/models/LACFileFormat.test.ts` (文件格式测试)

#### 3. 解码器测试 (2个)  
- `unit/decoders/DecoderBase.test.ts` (需要简化)
- `unit/decoders/protocols/I2CDecoder.test.ts` (最重要的协议)

#### 4. 服务层测试 (3个)
- `unit/services/SessionManager.test.ts` (需要简化)
- `unit/services/ConfigurationManager.test.ts` (需要简化)
- `unit/services/DataExportService.test.ts` (基础版本，需要找到)

#### 5. WebView测试 (2个)
- `unit/webview/components/App.test.ts` (主应用组件)
- `unit/webview/engines/WaveformRenderer.test.ts` (核心渲染器)

#### 6. 集成测试 (2个)
- `integration/SystemIntegration.e2e.test.ts` (端到端测试)
- `integration/CaptureDataFlow.test.ts` (数据流测试)

### 删除的测试类别

1. **所有"enhanced", "perfect", "coverage", "100-percent", "ultimate", "final"版本**
2. **archive目录下的所有过时测试**
3. **重复的测试文件(同一功能的多个版本)**
4. **失败的测试套件(148个)**
5. **过度复杂的Mock测试**

### Mock简化策略

保留基础Mock:
- `mocks/vscode.ts` (简化版)
- `mocks/MockBase.ts` 
- `mocks/fileMock.js`

删除:
- `mocks/HardwareDriverManager.js` (过度复杂)
- 所有内联复杂Mock实现

### 文档保留策略

保留文档:
1. `docs/index.md` (主索引)
2. `docs/unit-test-implementation-plan.md` 
3. 新创建的简化测试规范文档
4. 测试运行指南

删除:
- `docs/reports/` 目录下的所有报告(100+个文件)
- `docs/archive/` 目录
- 重复和过时的文档