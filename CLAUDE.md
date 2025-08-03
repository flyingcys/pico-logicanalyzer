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

### 2. 测试约束

- **所有测试文件都放到项目根目录下的 tests 目录下**

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

[... 文件的其余部分保持不变 ...]