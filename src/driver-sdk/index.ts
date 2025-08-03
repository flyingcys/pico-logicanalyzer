/**
 * VSCode 逻辑分析器驱动开发工具包 (Driver SDK)
 * 为第三方开发者提供完整的驱动开发支持
 */

// 导出核心基类和接口
export { AnalyzerDriverBase } from '../drivers/AnalyzerDriverBase';
export * from '../models/AnalyzerTypes';

// 导出开发工具
export { DriverValidator } from './tools/DriverValidator';
export { DriverTester } from './tools/DriverTester';
export { HardwareCapabilityBuilder } from './tools/HardwareCapabilityBuilder';
export { ProtocolHelper } from './tools/ProtocolHelper';

// 导出驱动模板
export { GenericDriverTemplate } from './templates/GenericDriverTemplate';
export { SerialDriverTemplate } from './templates/SerialDriverTemplate';
export { NetworkDriverTemplate } from './templates/NetworkDriverTemplate';

// 导出示例驱动
export { ExampleSerialDriver } from './examples/ExampleSerialDriver';
export { ExampleNetworkDriver } from './examples/ExampleNetworkDriver';

// 导出工具函数
export {
  createDriverPackage,
  validateDriverImplementation,
  testDriverFunctionality,
  generateDriverDocumentation
} from './utils/DriverUtils';

/**
 * 驱动SDK版本信息
 */
export const SDK_VERSION = '1.0.0';
export const SUPPORTED_API_VERSION = '1.0.0';

/**
 * 驱动开发最佳实践常量
 */
export const DRIVER_CONSTANTS = {
  // 连接超时
  DEFAULT_CONNECTION_TIMEOUT: 5000,
  // 命令超时
  DEFAULT_COMMAND_TIMEOUT: 10000,
  // 数据传输超时
  DEFAULT_DATA_TIMEOUT: 30000,
  // 最大重试次数
  MAX_RETRY_ATTEMPTS: 3,
  // 缓冲区大小建议
  RECOMMENDED_BUFFER_SIZE: 1024 * 1024, // 1MB
  // 采样率限制
  MIN_SAMPLE_RATE: 1000, // 1kHz
  MAX_SAMPLE_RATE: 1000000000 // 1GHz
};

/**
 * 支持的设备类型
 */
export enum SupportedDeviceTypes {
  USB_SERIAL = 'usb-serial',
  NETWORK_TCP = 'network-tcp',
  NETWORK_UDP = 'network-udp',
  BLUETOOTH = 'bluetooth',
  USB_HID = 'usb-hid',
  SPI = 'spi',
  I2C = 'i2c'
}

/**
 * 驱动质量等级
 */
export enum DriverQualityLevel {
  EXPERIMENTAL = 'experimental',  // 实验性驱动
  BETA = 'beta',                  // 测试版驱动
  STABLE = 'stable',              // 稳定版驱动
  CERTIFIED = 'certified'         // 认证驱动
}
