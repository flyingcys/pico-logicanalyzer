# VSCode 逻辑分析器插件 - 架构约束与开发指南

## 项目概述

**核心使命**: 构建硬件生态优先的开放式逻辑分析器平台，成为逻辑分析器领域的"通用平台"。

**战略目标**: 
- 支持10+主流逻辑分析器硬件品牌
- 提供统一的硬件抽象层和开发体验
- 建立第三方驱动开发者生态系统
- 打破硬件厂商锁定，为用户提供选择自由

## 核心架构约束

### 1. 纯TypeScript架构 🎯

**硬约束**: 项目必须采用纯TypeScript技术栈，避免多语言集成复杂性。

**技术栈限制**:
- ✅ **必须使用**: TypeScript + Node.js + Vue3 + Element Plus
- ❌ **禁止使用**: Python运行时、C#编译器、多进程架构
- ⚡ **性能目标**: V8引擎原生执行，零进程间通信开销

**代码架构要求**:
```typescript
// 所有模块必须使用TypeScript严格模式
// tsconfig.json必须配置strict: true
interface CoreModule {
  // 所有公共接口必须有完整类型定义
  readonly moduleId: string;
  readonly version: string;
  
  // 核心方法必须返回Promise以支持异步操作
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
```

### 2. 硬件抽象层 (HAL) 架构 🚀

**设计原则**: 从第一行代码开始就构建开放、可扩展的硬件生态。

**接口约束**:
```typescript
// 所有硬件驱动必须实现此接口
interface ILogicAnalyzer {
  readonly deviceInfo: DeviceInfo;
  readonly capabilities: HardwareCapabilities;
  readonly connectionStatus: ConnectionStatus;
  
  // 核心方法 - 不得修改签名
  connect(params: ConnectionParams): Promise<ConnectionResult>;
  startCapture(config: CaptureConfiguration): Promise<CaptureResult>;
  
  // 事件系统 - 必须支持
  on(event: 'data' | 'error' | 'status', callback: Function): void;
}
```

**硬件能力描述标准**:
```typescript
// 每个硬件驱动必须提供详细的能力描述
interface HardwareCapabilities {
  channels: {
    digital: number;           // 必填
    maxVoltage: number;        // 必填
  };
  sampling: {
    maxRate: number;           // 必填
    supportedRates: number[];  // 必填
    bufferSize: number;        // 必填
  };
  triggers: {
    types: TriggerType[];      // 必填
    maxChannels: number;       // 必填
  };
}
```

### 3. 统一数据格式约束 📊

**数据兼容性要求**: 必须与原@logicanalyzer/Software的.lac格式100%兼容。

**统一数据结构**:
```typescript
// 所有采集数据必须转换为此统一格式
interface UnifiedCaptureData {
  metadata: {
    deviceInfo: DeviceInfo;    // 必填 - 设备识别
    sampleRate: number;        // 必填 - 实际采样率
    totalSamples: number;      // 必填 - 总样本数
    triggerPosition?: number;  // 可选 - 触发位置
  };
  
  channels: ChannelInfo[];     // 必填 - 通道信息
  
  samples: {
    digital?: {
      data: Uint8Array[];      // 必填 - 二进制数据
      encoding: 'binary' | 'rle'; // 必填 - 编码格式
    };
  };
  
  quality: {
    lostSamples: number;       // 必填 - 质量监控
    errorRate: number;         // 必填 - 错误率
  };
}
```

### 4. 通信协议严格实现 ⚠️

**关键发现**: OutputPacket转义机制和精确的结构体布局极其重要。

**协议实现约束**:
```typescript
// 数据包封装必须精确匹配C#原实现
class OutputPacket {
  // 转义规则: 0xAA/0x55/0xF0 -> 0xF0 + (原值 ^ 0xF0)
  serialize(): Uint8Array {
    // 协议格式: 0x55 0xAA [转义后的数据] 0xAA 0x55
    // 此实现不得修改，必须与原软件完全一致
  }
}

// 采集请求结构必须精确匹配内存布局
interface CaptureRequest {
  triggerType: number;        // byte
  trigger: number;           // byte  
  triggerValue: number;      // ushort - 字节序很重要
  frequency: number;         // uint32 - 字节序很重要
  // ... 其他字段必须与C#结构体一致
}
```

### 5. 协议解码器零依赖架构 🔥

**重大架构决策**: 采用纯TypeScript实现，完全避免Python依赖。

**解码器基类约束**:
```typescript
// 所有解码器必须继承此基类
abstract class DecoderBase {
  // 元数据 - 必须实现
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly channels: DecoderChannel[];
  abstract readonly annotations: string[][];
  
  // 核心API - 不得修改签名
  protected wait(conditions: WaitCondition): WaitResult;
  protected put(startSample: number, endSample: number, data: DecoderOutput): void;
  
  // 主解码方法 - 必须实现
  abstract decode(
    sampleRate: number,
    channels: AnalyzerChannel[],
    options: DecoderOptionValue[]
  ): DecoderResult[];
}

// 优先级协议实现顺序
// 1. I2C (最高优先级)
// 2. SPI (高优先级) 
// 3. UART (高优先级)
// 4. 其他协议按需求优先级实现
```

### 6. 性能和质量约束 ⚡

**性能基准要求**:
- 插件启动时间: < 2秒
- 波形渲染: 支持100万数据点 @ 60fps
- 内存使用: 24小时运行无泄漏
- 多设备同步: 支持5设备 @ 100MHz

**代码质量要求**:
```typescript
// tsconfig.json 严格配置
{
  "compilerOptions": {
    "strict": true,              // 必须启用
    "noImplicitAny": true,       // 必须启用
    "strictNullChecks": true,    // 必须启用
    "noImplicitReturns": true    // 必须启用
  }
}

// 测试覆盖率要求
// 单元测试覆盖率 > 80%
// 集成测试必须覆盖关键流程
```

## 开发约束和规范

### 1. 项目结构约束

```
vscode-logicanalyzer/
├── src/
│   ├── drivers/               # 硬件驱动层 - 严格分离
│   │   ├── base/             # 抽象基类 - 不得修改接口
│   │   ├── adapters/         # 硬件适配器 - 标准化实现
│   │   └── protocols/        # 通信协议 - 精确实现
│   ├── decoders/             # 协议解码器 - 纯TS实现
│   │   ├── base/             # 解码器基类
│   │   └── protocols/        # 具体协议实现
│   ├── webview/              # Vue前端 - 现代化UI
│   └── models/               # 数据模型 - 类型安全
```

### 2. Vue组件开发约束

**组件设计原则**:
```vue
<!-- 所有组件必须使用组合式API -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 必须定义明确的接口
interface Props {
  deviceId: string
  isConnected: boolean
}

// 必须使用TypeScript类型
const props = defineProps<Props>()
const emit = defineEmits<{
  connect: [deviceId: string]
  disconnect: []
}>()

// 状态管理必须使用Pinia
const deviceStore = useDeviceStore()
</script>
```

### 3. 测试约束

**测试架构要求**:
```typescript
// 每个模块必须有对应的测试文件
// 文件命名: ModuleName.test.ts

describe('LogicAnalyzerDriver', () => {
  // 必须测试所有公共方法
  it('should connect to device successfully', async () => {
    // 测试代码必须覆盖成功和失败场景
  })
  
  // 必须有性能基准测试
  it('should handle large data capture within time limit', async () => {
    // 性能测试必须包含具体的时间限制
  })
})
```

## 开发流程约束

### 1. 分阶段开发策略

**硬约束**: 必须严格按照4周原型验证 + 22周系统开发的节奏执行。

**里程碑检查点**:
- Week 4: 原型验证通过才能进入系统开发
- Week 9: 多硬件驱动完成
- Week 15: 波形显示核心完成  
- Week 22: 协议解码器完成
- Week 26: 项目交付

### 2. 代码提交约束

**提交规范**:
```bash
# 提交信息必须遵循约定式提交
feat(drivers): add Saleae Logic analyzer driver
fix(decoder): correct I2C start condition detection
docs(hal): update hardware capability interface
test(core): add multi-device sync integration tests
```

**代码审查要求**:
- 所有代码必须通过TypeScript编译检查
- 所有代码必须通过ESLint检查
- 所有新功能必须包含单元测试
- 性能关键代码必须包含基准测试

### 3. 风险缓解约束

**技术风险控制**:
- 每个高风险技术点必须先进行原型验证
- 关键模块必须有备选实现方案
- 第三方依赖必须有版本锁定和兼容性测试

**项目风险控制**:
- 每周必须进行进度检查和风险评估
- 功能范围调整必须有明确的优先级判断
- 质量标准不能因进度压力而降低

## 禁止事项

### 严格禁止的技术选择

❌ **禁止使用Python运行时**: 会引入依赖复杂性和部署困难
❌ **禁止使用C#/.NET**: 与VSCode生态不兼容
❌ **禁止使用多进程架构**: 会增加通信复杂性和性能开销
❌ **禁止修改核心接口**: 会破坏兼容性和扩展性
❌ **禁止忽略性能约束**: 会影响用户体验

### 严格禁止的开发行为

❌ **禁止跳过原型验证阶段**: 会增加后期返工风险
❌ **禁止忽略测试覆盖率要求**: 会影响代码质量
❌ **禁止使用any类型**: 会破坏类型安全
❌ **禁止硬编码配置**: 会影响可扩展性
❌ **禁止忽略错误处理**: 会影响系统稳定性

## 成功标准

### 最终交付标准

✅ **技术指标**:
- 支持5+种不同品牌逻辑分析器
- 波形渲染60fps @ 100万数据点
- 插件启动时间 < 2秒
- 24小时稳定运行无内存泄漏

✅ **功能完整性**:
- 完整的设备管理和连接功能
- 实时数据采集和显示
- 核心协议解码器(I2C/SPI/UART)
- .lac文件格式100%兼容

✅ **生态建设**:
- 第三方驱动开发SDK
- 硬件兼容性数据库
- 开发者文档和工具

## 重要提醒

> **架构原则**: 这个项目不仅仅是一个VSCode插件，而是要建立逻辑分析器领域的开放生态系统。每一个技术决策都应该考虑生态扩展性和第三方开发者友好性。

> **质量第一**: 宁可适当延期也不能降低质量标准。硬件生态平台的可靠性是项目成功的基础。

> **用户体验**: 始终以用户体验为中心，提供直观、流畅、功能强大的逻辑分析工具。

---

**项目愿景**: "让每一个硬件都能发挥最大价值，让每一个开发者都能享受最佳体验。"