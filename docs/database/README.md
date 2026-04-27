# 硬件兼容性数据库

VSCode逻辑分析器的硬件兼容性数据库系统，提供设备兼容性管理、查询和维护功能。

## 概述

硬件兼容性数据库是一个集中化的系统，用于存储和管理逻辑分析器硬件设备的兼容性信息，包括：

- 设备识别信息
- 驱动兼容性数据
- 硬件能力描述
- 测试结果和认证状态
- 用户反馈和评分
- 连接配置参数

## 核心组件

### 1. HardwareCompatibilityDatabase
核心数据库类，提供基本的CRUD操作和查询功能。

```typescript
import { HardwareCompatibilityDatabase } from './HardwareCompatibilityDatabase';

const database = new HardwareCompatibilityDatabase();
await database.initialize();

// 查询设备
const devices = await database.queryDevices({
  manufacturer: 'Saleae',
  category: 'usb-la'
});

// 添加设备
await database.addOrUpdateDevice(deviceEntry);
```

### 2. DatabaseManager
高级数据库管理器，提供智能匹配和自动维护功能。

```typescript
import { DatabaseManager } from './DatabaseManager';

const manager = new DatabaseManager();
await manager.initialize();

// 智能设备匹配
const matchResult = await manager.smartDeviceMatching(deviceInfo);

// 自动设备发现
const discovery = await manager.discoverAndUpdateDevices();
```

### 3. DatabaseIntegration
数据库集成工具，提供驱动系统的集成接口。

```typescript
import { DatabaseIntegration } from './DatabaseIntegration';

const integration = DatabaseIntegration.getInstance();
await integration.initialize();

// 增强的设备发现
const discovery = await integration.enhancedDeviceDiscovery(deviceInfo);

// 性能预测
const prediction = await integration.predictDriverPerformance(driverName, deviceInfo);
```

## 数据结构

### DeviceCompatibilityEntry
设备兼容性条目的完整数据结构：

```typescript
interface DeviceCompatibilityEntry {
  // 基本信息
  deviceId: string;
  manufacturer: string;
  model: string;
  version: string;
  category: 'usb-la' | 'network-la' | 'benchtop' | 'mixed-signal' | 'protocol-analyzer';
  
  // 识别信息
  identifiers: {
    vendorId?: string;
    productId?: string;
    serialPattern?: string;
    networkSignature?: string;
    scpiIdnResponse?: string;
  };
  
  // 驱动兼容性
  driverCompatibility: {
    primaryDriver: string;
    alternativeDrivers: string[];
    driverVersion: string;
    compatibilityLevel: 'full' | 'partial' | 'experimental';
    knownIssues: string[];
    workarounds: string[];
  };
  
  // 硬件能力
  capabilities: HardwareCapabilities;
  
  // 连接配置
  connectionOptions: {
    defaultConnectionString: string;
    alternativeConnections: string[];
    connectionParameters: Record<string, any>;
  };
  
  // 测试状态
  testStatus: {
    lastTested: Date;
    testResults: {
      driverValidation: number;
      functionalTests: number;
      performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
      reliability: 'excellent' | 'good' | 'fair' | 'poor';
    };
    certificationLevel: 'certified' | 'verified' | 'community' | 'experimental';
  };
  
  // 用户反馈
  communityFeedback: {
    userRating: number;
    reportCount: number;
    commonIssues: string[];
    userComments: string[];
  };
  
  // 元数据
  metadata: {
    addedDate: Date;
    lastUpdated: Date;
    maintainer: string;
    documentationUrl?: string;
    vendorUrl?: string;
    supportStatus: 'active' | 'legacy' | 'deprecated' | 'unsupported';
  };
}
```

## 命令行工具

使用内置的命令行工具管理数据库：

### 查询设备
```bash
# 查询所有Saleae设备
npm run db:query -- --manufacturer Saleae

# 查询特定类别的设备
npm run db:query -- --category usb-la --format table

# 按驱动查询
npm run db:query -- --driver SaleaeLogicDriver
```

### 数据库统计
```bash
# 显示数据库统计信息
npm run db:stats

# 导出统计到文件
npm run db:stats -- --output stats.json --format json
```

### 设备发现
```bash
# 自动发现设备
npm run db:discover

# 干运行模式（不实际更新）
npm run db:discover -- --dry-run
```

### 数据库验证
```bash
# 验证数据库完整性
npm run db:validate

# 验证并自动修复问题
npm run db:validate -- --fix
```

### 数据导入导出
```bash
# 导出数据库
npm run db:export -- backup.json

# 导出为CSV格式
npm run db:export -- backup.csv --format csv

# 导入数据
npm run db:import -- new-devices.json

# 替换现有数据
npm run db:import -- new-devices.json --replace
```

### 创建设备模板
```bash
# 创建USB逻辑分析器模板
npm run db:template -- usb-la --output my-device.json

# 创建网络设备模板
npm run db:template -- network-la --output network-device.json
```

## 使用示例

### 1. 查询兼容设备

```typescript
import { HardwareCompatibilityDatabase } from './database';

const database = new HardwareCompatibilityDatabase();
await database.initialize();

// 查找特定制造商的设备
const saleaeDevices = await database.queryDevices({
  manufacturer: 'Saleae',
  minValidationScore: 80
});

console.log(`找到 ${saleaeDevices.length} 个Saleae设备`);
```

### 2. 添加新设备

```typescript
const newDevice: DeviceCompatibilityEntry = {
  deviceId: 'my-analyzer-v1',
  manufacturer: 'MyCompany',
  model: 'USB Analyzer v1',
  version: '1.0',
  category: 'usb-la',
  // ... 其他必要字段
};

await database.addOrUpdateDevice(newDevice);
```

### 3. 智能设备匹配

```typescript
import { DatabaseManager } from './database';

const manager = new DatabaseManager();
await manager.initialize();

const deviceInfo = {
  manufacturer: 'Saleae',
  model: 'Logic 8',
  serialNumber: 'SL12345'
};

const matchResult = await manager.smartDeviceMatching(deviceInfo);

console.log('推荐驱动:', matchResult.recommendedDrivers);
console.log('匹配置信度:', matchResult.confidence);
```

### 4. 性能预测

```typescript
import { DatabaseIntegration } from './database';

const integration = DatabaseIntegration.getInstance();
await integration.initialize();

const prediction = await integration.predictDriverPerformance(
  'SaleaeLogicDriver',
  { manufacturer: 'Saleae', model: 'Logic 8' }
);

console.log('预期性能:', prediction.expectedPerformance);
console.log('风险因素:', prediction.riskFactors);
```

### 5. 更新测试结果

```typescript
await integration.updateTestResults('saleae-logic-8', 'SaleaeLogicDriver', {
  validationScore: 92,
  functionalScore: 88,
  performanceGrade: 'A',
  connectionTime: 1500,
  captureTime: 2000,
  reliability: 'excellent'
});
```

### 6. 提交用户反馈

```typescript
await integration.submitUserFeedback('saleae-logic-8', {
  rating: 4.5,
  comment: '设备工作稳定，功能强大',
  issues: [],
  setupDifficulty: 'easy',
  performanceSatisfaction: 5
});
```

## 数据文件

### 默认数据位置
- 主数据库文件: `./data/hardware-compatibility.json`
- 示例数据: `./data/sample-devices.json`
- 备份文件: `./data/hardware-compatibility-backup.json`

### 数据版本控制
数据库文件包含版本信息，支持向后兼容：

```json
{
  "version": "2.0",
  "lastUpdated": "2024-01-15T10:00:00.000Z",
  "entries": [...]
}
```

## 集成指南

### 与驱动系统集成

```typescript
// 在HardwareDriverManager中集成
import { DatabaseIntegration } from '../database';

class HardwareDriverManager {
  private dbIntegration: DatabaseIntegration;
  
  constructor() {
    this.dbIntegration = DatabaseIntegration.getInstance();
  }
  
  async discoverDevices(): Promise<DeviceInfo[]> {
    const devices = await this.scanForDevices();
    
    // 使用数据库增强设备信息
    for (const device of devices) {
      const discovery = await this.dbIntegration.enhancedDeviceDiscovery(device);
      device.recommendedDrivers = discovery.recommendedDrivers;
      device.setupInstructions = discovery.setupInstructions;
    }
    
    return devices;
  }
}
```

### 与测试框架集成

```typescript
// 在测试完成后自动更新数据库
class TestFramework {
  async runFullTestSuite(driver: AnalyzerDriverBase): Promise<TestSummary> {
    const summary = await this.executeTests(driver);
    
    // 更新数据库中的测试结果
    const integration = DatabaseIntegration.getInstance();
    await integration.updateTestResults(
      driver.deviceId,
      driver.constructor.name,
      {
        validationScore: summary.validation.score,
        functionalScore: summary.functional.coverage,
        performanceGrade: summary.overall.grade,
        // ... 其他测试结果
      }
    );
    
    return summary;
  }
}
```

## 最佳实践

### 1. 数据维护
- 定期运行数据库验证：`npm run db:validate`
- 定期备份数据库：`npm run db:export`
- 监控数据库大小和性能

### 2. 设备条目管理
- 使用标准化的设备ID命名规范
- 保持设备信息的准确性和时效性
- 及时更新测试结果和用户反馈

### 3. 查询优化
- 使用索引字段进行查询
- 避免过于复杂的查询条件
- 合理使用分页和限制

### 4. 扩展性考虑
- 设计时考虑未来的字段扩展
- 保持向后兼容性
- 使用版本控制管理数据结构变更

## 故障排除

### 常见问题

1. **数据库加载失败**
   - 检查文件权限
   - 验证JSON格式是否正确
   - 确保目录存在

2. **查询结果为空**
   - 检查查询条件是否正确
   - 验证索引是否正确构建
   - 确认数据库中有相关数据

3. **性能问题**
   - 定期清理过期数据
   - 优化查询条件
   - 考虑数据库分片

### 调试工具

```typescript
// 启用调试日志
process.env.DEBUG = 'database:*';

// 查看数据库统计
const stats = await database.getStatistics();
console.log('数据库统计:', stats);

// 验证数据完整性
const validation = await manager.validateDatabaseIntegrity();
console.log('验证结果:', validation);
```

## 贡献指南

欢迎贡献新设备的兼容性数据：

1. 使用模板创建设备条目
2. 完整测试设备功能
3. 提供准确的能力描述
4. 包含详细的设置说明
5. 提交Pull Request

## 许可证

本数据库系统采用MIT许可证，详见项目根目录的LICENSE文件。