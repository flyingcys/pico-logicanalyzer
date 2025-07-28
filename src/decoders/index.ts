/**
 * 解码器模块入口文件
 * 导出所有解码器相关的类型、类和函数
 */

// 基础类型定义
export * from './types';

// 核心解码器架构
export { DecoderBase } from './DecoderBase';
export { DecoderManager, decoderManager } from './DecoderManager';
export type { DecoderExecutionResult, DecodingBranch, DecodingTree } from './DecoderManager';

// 协议解码器
export { I2CDecoder } from './protocols/I2CDecoder';
export { SPIDecoder } from './protocols/SPIDecoder';
export { UARTDecoder } from './protocols/UARTDecoder';

// 测试框架
export { DecoderTestFramework, runDecoderTests } from './tests/DecoderTestFramework';
export type { DecoderTestCase, TestResult } from './tests/DecoderTestFramework';

/**
 * 初始化解码器系统
 * 注册所有内置解码器
 */
export function initializeDecoders(): void {
  // 注册内置解码器
  decoderManager.registerDecoder('i2c', I2CDecoder);
  decoderManager.registerDecoder('spi', SPIDecoder);
  decoderManager.registerDecoder('uart', UARTDecoder);

  console.log('Decoder system initialized with I2C, SPI, and UART decoders');
}

/**
 * 获取解码器系统统计信息
 */
export function getDecoderSystemStats() {
  return {
    ...decoderManager.getStatistics(),
    availableProtocols: ['I2C', 'SPI', 'UART'],
    supportedInputs: ['logic'],
    supportedOutputs: ['i2c', 'spi', 'uart']
  };
}

/**
 * 创建解码器测试实例
 */
export function createDecoderTester(): DecoderTestFramework {
  return new DecoderTestFramework();
}

// 默认导出解码器管理器
export default decoderManager;
