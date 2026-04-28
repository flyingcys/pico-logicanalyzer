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
export {
  getDecoderExtensionPlan,
  getDecoderExtensionRoadmap,
  getExternalSigrokProtocolIds
} from './DecoderSigrokParity';
export type {
  DecoderExtensionPlan,
  DecoderGoldenCase,
  DecoderGoldenCategory,
  DecoderGoldenExpectedSegment,
  DecoderGoldenInputKind,
  DecoderGoldenProtocol,
  DecoderImplementationStrategy
} from './DecoderSigrokParity';

// 协议解码器
export { I2CDecoder } from './protocols/I2CDecoder';
export { SPIDecoder } from './protocols/SPIDecoder';
export { UARTDecoder } from './protocols/UARTDecoder';
export { CANDecoder } from './protocols/CANDecoder';
export { LINDecoder } from './protocols/LINDecoder';
export { I2SDecoder } from './protocols/I2SDecoder';

// 导入解码器类用于注册
import { I2CDecoder } from './protocols/I2CDecoder';
import { SPIDecoder } from './protocols/SPIDecoder';
import { UARTDecoder } from './protocols/UARTDecoder';
import { CANDecoder } from './protocols/CANDecoder';
import { LINDecoder } from './protocols/LINDecoder';
import { I2SDecoder } from './protocols/I2SDecoder';
import { decoderManager } from './DecoderManager';

/**
 * 初始化解码器系统
 * 注册所有内置解码器
 */
export function initializeDecoders(): void {
  // 注册内置解码器
  const manager = decoderManager;
  manager.registerDecoder('i2c', I2CDecoder);
  manager.registerDecoder('spi', SPIDecoder);
  manager.registerDecoder('uart', UARTDecoder);
  manager.registerDecoder('can', CANDecoder);
  manager.registerDecoder('lin', LINDecoder);
  manager.registerDecoder('i2s', I2SDecoder);

  console.log('Decoder system initialized with I2C, SPI, UART, CAN, LIN, and I2S decoders');
}

/**
 * 获取解码器系统统计信息
 */
export function getDecoderSystemStats() {
  const manager = decoderManager;
  return {
    ...manager.getStatistics(),
    availableProtocols: ['I2C', 'SPI', 'UART', 'CAN', 'LIN', 'I2S'],
    supportedInputs: ['logic'],
    supportedOutputs: ['i2c', 'spi', 'uart', 'can', 'lin', 'i2s']
  };
}

// 默认导出解码器管理器
export default decoderManager;
