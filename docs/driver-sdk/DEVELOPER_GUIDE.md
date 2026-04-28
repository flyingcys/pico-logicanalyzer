# VSCode 逻辑分析器驱动开发指南

欢迎使用VSCode逻辑分析器驱动开发工具包(Driver SDK)！本指南将帮助您快速上手，创建高质量的逻辑分析器驱动。

## 目录

- [快速开始](#快速开始)
- [架构概述](#架构概述)
- [开发工具](#开发工具)
- [驱动模板](#驱动模板)
- [最佳实践](#最佳实践)
- [测试和验证](#测试和验证)
- [发布和分发](#发布和分发)

## 快速开始

### 环境准备

确保您的开发环境满足以下要求：

- Node.js 16+ 
- TypeScript 4.9+
- VSCode（推荐）

### 安装SDK

```bash
npm install @pico-logicanalyzer/driver-sdk
```

### 创建第一个驱动

使用SDK工具快速创建驱动包：

```typescript
import { DriverUtils } from '@pico-logicanalyzer/driver-sdk';

await DriverUtils.createDriverPackage('my-analyzer-driver', './output', {
  author: 'Your Name',
  description: 'My custom logic analyzer driver',
  driverType: 'serial', // 或 'network', 'generic'
  includeTests: true,
  includeExamples: true,
  includeDocs: true
});
```

这将创建一个完整的驱动项目结构：

```
my-analyzer-driver/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   └── MyAnalyzerDriverDriver.ts
├── tests/
│   └── MyAnalyzerDriverDriver.test.ts
├── examples/
│   └── basic-usage.ts
└── docs/
    └── api.md
```

## 架构概述

### 核心组件

驱动SDK基于以下核心概念构建：

```
┌─────────────────────────────────────────────────────────────┐
│                    Driver SDK 架构                         │
├─────────────────────────────────────────────────────────────┤
│  开发工具             │  驱动模板           │  示例和文档     │
│  ├─ DriverValidator   │  ├─ GenericTemplate │  ├─ Examples   │
│  ├─ DriverTester     │  ├─ SerialTemplate  │  ├─ Tutorials  │
│  ├─ CapabilityBuilder│  └─ NetworkTemplate │  └─ API Docs   │
│  └─ ProtocolHelper   │                     │                │
├─────────────────────────────────────────────────────────────┤
│                    抽象基类层                               │
│                AnalyzerDriverBase                          │
├─────────────────────────────────────────────────────────────┤
│                   设备通信层                               │
│            Serial │ Network │ USB │ Other                  │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
设备 ↔ 驱动实现 ↔ AnalyzerDriverBase ↔ HardwareDriverManager ↔ 前端UI
```

## 开发工具

SDK提供了完整的开发工具链：

### 1. 驱动验证器 (DriverValidator)

自动验证驱动实现是否符合规范：

```typescript
import { DriverValidator } from '@pico-logicanalyzer/driver-sdk';

const validator = new DriverValidator();
const report = await validator.validateDriver(myDriver);

console.log(`验证评分: ${report.score}/100`);
console.log(`状态: ${report.overallStatus}`);

if (report.errors.length > 0) {
  console.log('错误:', report.errors);
}
```

### 2. 驱动测试器 (DriverTester)

自动化功能测试：

```typescript
import { DriverTester } from '@pico-logicanalyzer/driver-sdk';

const tester = new DriverTester(true); // 模拟模式
const report = await tester.runAllTests(myDriver);

console.log(`测试结果: ${report.passedTests}/${report.totalTests} 通过`);
```

### 3. 硬件能力构建器 (HardwareCapabilityBuilder)

标准化硬件能力描述：

```typescript
import { HardwareCapabilityBuilder, HardwareTemplate } from '@pico-logicanalyzer/driver-sdk';

const capability = new HardwareCapabilityBuilder(HardwareTemplate.BASIC_USB_LA)
  .setChannelCapability({
    digital: 16,
    maxVoltage: 5.0,
    inputImpedance: 1000000
  })
  .setSamplingCapability({
    maxRate: 100000000,
    minRate: 1000,
    bufferSize: 1000000,
    streamingSupport: false
  })
  .build();
```

### 4. 协议助手 (ProtocolHelper)

常用通信协议的工具函数：

```typescript
import { ProtocolHelper } from '@pico-logicanalyzer/driver-sdk';

// SCPI协议
const command = ProtocolHelper.scpi.buildCommand('*IDN?');
const response = ProtocolHelper.scpi.parseResponse(deviceResponse);

// JSON协议
const jsonCmd = ProtocolHelper.json.createCommand('get_status', { verbose: true });

// 二进制协议
const packet = ProtocolHelper.binary.createPacket(0x01, Buffer.from('hello'));
```

## 驱动模板

SDK提供三种驱动模板，覆盖不同的使用场景：

### 能力边界

驱动模板分为两类口径：

| 类型 | 含义 | 发布要求 |
| --- | --- | --- |
| 模板待实现 | 提供类结构、连接外壳、测试骨架和注释说明 | 不得作为真实设备能力发布 |
| 可运行示例 | 仅演示 SDK 调用形态，可能需要 mock 或替换连接参数 | 不得替代硬件认证记录 |

`DriverUtils.createDriverPackage()` 生成的包默认质量等级为 `experimental`。发布或分发前必须完成设备协议、采集解析、停止/断线处理、自动化测试和真实硬件或 fixture 验证。

### 1. 通用驱动模板 (GenericDriverTemplate)

适用于搭建驱动骨架，设备连接、状态查询和采集解析需要按目标硬件补全：

```typescript
import { GenericDriverTemplate } from '@pico-logicanalyzer/driver-sdk';

export class MyDriver extends GenericDriverTemplate {
  constructor(connectionString: string) {
    super(connectionString);
  }

  // 按目标设备补全初始化、状态查询和采集解析
  protected async initializeDevice(): Promise<void> {
    // 设备特定的初始化逻辑
  }
}
```

### 2. 串口驱动模板 (SerialDriverTemplate)

专门用于串口连接设备的脚手架。串口打开、命令队列和错误处理有参考实现，包格式解析和采集数据解析仍需补全：

```typescript
import { SerialDriverTemplate } from '@pico-logicanalyzer/driver-sdk';

export class MySerialDriver extends SerialDriverTemplate {
  constructor(portPath: string, baudRate: number = 115200) {
    super(portPath, baudRate);
  }

  // 按设备协议补全命令、响应包和采集数据解析
}
```

### 3. 网络驱动模板 (NetworkDriverTemplate)

专门用于网络连接设备的脚手架。网络连接外壳已有参考实现，设备握手、鉴权、协议解析和采集数据解析仍需补全：

```typescript
import { NetworkDriverTemplate } from '@pico-logicanalyzer/driver-sdk';

export class MyNetworkDriver extends NetworkDriverTemplate {
  constructor(host: string, port: number = 8080) {
    super(host, port, ProtocolType.HTTP);
  }

  // 按设备协议补全握手、鉴权和采集数据解析
}
```

## 最佳实践

### 1. 驱动命名规范

- 类名使用PascalCase：`MyDeviceDriver`
- 文件名使用PascalCase：`MyDeviceDriver.ts`
- 包名使用kebab-case：`my-device-driver`

### 2. 错误处理

始终提供详细的错误信息：

```typescript
async connect(): Promise<ConnectionResult> {
  try {
    // 连接逻辑
    return { success: true, deviceInfo: ... };
  } catch (error) {
    return {
      success: false,
      error: `连接失败: ${error instanceof Error ? error.message : error}`
    };
  }
}
```

### 3. 日志记录

使用一致的日志格式：

```typescript
console.log(`[${this.constructor.name}] 正在连接设备: ${connectionString}`);
console.warn(`[${this.constructor.name}] 配置警告: ${warningMessage}`);
console.error(`[${this.constructor.name}] 操作失败: ${error}`);
```

### 4. 资源管理

始终正确清理资源：

```typescript
override dispose(): void {
  // 清理设备特定资源
  if (this._device) {
    this._device.close();
    this._device = null;
  }

  // 调用父类清理
  super.dispose();
}
```

### 5. 异步操作

正确使用Promise和async/await：

```typescript
async startCapture(session: CaptureSession): Promise<CaptureError> {
  try {
    this._capturing = true;
    
    // 异步配置设备
    await this.configureDevice(session);
    
    // 异步启动采集
    await this.startDeviceCapture();
    
    return CaptureError.None;
  } catch (error) {
    this._capturing = false;
    return CaptureError.UnexpectedError;
  }
}
```

## 测试和验证

### 单元测试

为每个公共方法编写测试：

```typescript
describe('MyDriver', () => {
  let driver: MyDriver;

  beforeEach(() => {
    driver = new MyDriver('test-connection');
  });

  afterEach(() => {
    driver.dispose();
  });

  it('应该正确初始化', () => {
    expect(driver.channelCount).toBeGreaterThan(0);
    expect(driver.maxFrequency).toBeGreaterThan(0);
  });

  it('应该支持连接', async () => {
    const result = await driver.connect();
    expect(result).toHaveProperty('success');
  });
});
```

### 集成测试

测试与真实硬件或可复现 fixture 的交互：

```typescript
describe('MyDriver Integration', () => {
  it('应该与真实设备正常通信', async () => {
    const driver = new MyDriver('real-device-connection');
    
    const connectionResult = await driver.connect();
    expect(connectionResult.success).toBe(true);
    
    const status = await driver.getStatus();
    expect(status.isConnected).toBe(true);
    
    await driver.disconnect();
  });
});
```

### 驱动验证

在发布前运行完整验证：

```typescript
import { validateDriverImplementation } from '@pico-logicanalyzer/driver-sdk';

const report = await validateDriverImplementation(new MyDriver('test'));

if (report.overallStatus === 'fail') {
  console.error('驱动验证失败，请修复以下问题:');
  report.errors.forEach(error => console.error(`- ${error.message}`));
  process.exit(1);
}
```

## 性能优化

### 1. 连接池管理

对于网络设备，使用连接池：

```typescript
class ConnectionPool {
  private connections = new Map<string, Connection>();
  
  async getConnection(host: string, port: number): Promise<Connection> {
    const key = `${host}:${port}`;
    if (!this.connections.has(key)) {
      this.connections.set(key, await this.createConnection(host, port));
    }
    return this.connections.get(key)!;
  }
}
```

### 2. 数据缓存

缓存设备信息和配置：

```typescript
private _deviceInfoCache: DeviceInfo | null = null;
private _cacheExpiry: number = 0;

async getDeviceInfo(): Promise<DeviceInfo> {
  if (this._deviceInfoCache && Date.now() < this._cacheExpiry) {
    return this._deviceInfoCache;
  }
  
  this._deviceInfoCache = await this.queryDeviceInfo();
  this._cacheExpiry = Date.now() + 60000; // 1分钟缓存
  
  return this._deviceInfoCache;
}
```

### 3. 批量操作

合并小的命令请求：

```typescript
private _commandQueue: Command[] = [];
private _batchTimer: NodeJS.Timeout | null = null;

queueCommand(command: Command): void {
  this._commandQueue.push(command);
  
  if (!this._batchTimer) {
    this._batchTimer = setTimeout(() => {
      this.executeBatch();
      this._batchTimer = null;
    }, 10);
  }
}
```

## 发布和分发

### 1. 包准备

确保包含所有必要文件：

```json
{
  "name": "my-analyzer-driver",
  "version": "0.1.0",
  "qualityLevel": "experimental",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "validate": "node scripts/validate.js"
  }
}
```

### 2. 文档准备

提供完整的文档：

- README.md：基本说明和快速开始
- API.md：详细的API文档
- CHANGELOG.md：版本变更历史
- LICENSE：许可证文件

### 3. 质量检查

发布前检查清单：

- [ ] 所有测试通过
- [ ] 驱动验证通过（评分 > 80）
- [ ] 代码覆盖率 > 80%
- [ ] 文档说明模板待实现项和硬件限制
- [ ] 示例代码可运行，且已标注是否依赖 mock、fixture 或真实设备
- [ ] 真实硬件或 fixture 验证记录已归档
- [ ] 版本号正确更新

### 4. 发布流程

```bash
# 1. 运行测试
npm test

# 2. 验证驱动
npm run validate

# 3. 构建
npm run build

# 4. 发布
npm publish
```

## 支持和社区

### 获取帮助

- 查看[API文档](api.md)
- 参考[示例代码](../examples/)
- 提交[Issue](https://github.com/your-repo/issues)

### 贡献指南

欢迎贡献代码和文档：

1. Fork项目
2. 创建特性分支
3. 编写测试
4. 提交Pull Request

### 许可证

本SDK采用MIT许可证，详见[LICENSE](../LICENSE)文件。

---

**祝您开发愉快！** 🚀

如果您有任何问题或建议，请随时联系我们。
