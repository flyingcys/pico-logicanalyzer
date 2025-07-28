/**
 * 硬件兼容性数据库模块
 * 提供逻辑分析器硬件设备兼容性管理功能
 */

// 核心数据库类
export { 
  HardwareCompatibilityDatabase,
  DeviceCompatibilityEntry,
  CompatibilityQuery
} from './HardwareCompatibilityDatabase';

// 数据库管理器
export { DatabaseManager } from './DatabaseManager';

// 数据库集成工具
export { DatabaseIntegration } from './DatabaseIntegration';

// 默认导出数据库集成单例
export { DatabaseIntegration as default } from './DatabaseIntegration';