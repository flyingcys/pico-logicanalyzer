/**
 * 解码器注册中心
 * 负责注册所有可用的解码器（常规和流式）
 */

import { decoderManager } from './DecoderManager';
import { decoderDebugLog } from './StreamingDecoder';
import { I2CDecoder } from './protocols/I2CDecoder';
import { SPIDecoder } from './protocols/SPIDecoder';
import { UARTDecoder } from './protocols/UARTDecoder';
import { StreamingI2CDecoder } from './protocols/StreamingI2CDecoder';
import { CANDecoder } from './protocols/CANDecoder';
import { LINDecoder } from './protocols/LINDecoder';
import { I2SDecoder } from './protocols/I2SDecoder';

const regularDecoderDefinitions = [
  { id: 'i2c', label: 'I²C 解码器', decoderClass: I2CDecoder },
  { id: 'spi', label: 'SPI 解码器', decoderClass: SPIDecoder },
  { id: 'uart', label: 'UART 解码器', decoderClass: UARTDecoder },
  { id: 'can', label: 'CAN 解码器', decoderClass: CANDecoder },
  { id: 'lin', label: 'LIN 解码器', decoderClass: LINDecoder },
  { id: 'i2s', label: 'I2S 解码器', decoderClass: I2SDecoder }
] as const;

const streamingDecoderDefinitions = [
  { id: 'streaming_i2c', label: 'I²C 流式解码器', decoderClass: StreamingI2CDecoder }
] as const;

/**
 * 注册所有解码器
 */
export function registerAllDecoders(): void {
  decoderDebugLog('📋 开始注册解码器...');

  try {
    // 注册常规与流式解码器
    for (const decoder of regularDecoderDefinitions) {
      decoderManager.registerDecoder(decoder.id, decoder.decoderClass);
    }
    for (const decoder of streamingDecoderDefinitions) {
      decoderManager.registerStreamingDecoder(decoder.id, decoder.decoderClass);
    }

    decoderDebugLog('✅ 解码器注册完成:');
    for (const decoder of [...regularDecoderDefinitions, ...streamingDecoderDefinitions]) {
      decoderDebugLog(`  - ${decoder.label} (${decoder.id})`);
    }

    // 获取统计信息
    const stats = decoderManager.getStatistics();
    decoderDebugLog('📊 解码器注册统计:');
    decoderDebugLog(`  - 常规解码器: ${stats.registeredDecoders}个`);
    decoderDebugLog(`  - 流式解码器: ${stats.registeredStreamingDecoders}个`);
    decoderDebugLog(`  - 可用解码器总数: ${stats.availableDecoders}个`);

  } catch (error) {
    console.error('❌ 解码器注册失败:', error);
    throw error;
  }
}

/**
 * 获取解码器注册信息
 */
export function getDecoderRegistryInfo(): {
  regularDecoders: string[];
  streamingDecoders: string[];
  totalCount: number;
} {
  const regularDecoders = regularDecoderDefinitions.map(decoder => decoder.id);
  const streamingDecoders = streamingDecoderDefinitions.map(decoder => decoder.id);

  return {
    regularDecoders,
    streamingDecoders,
    totalCount: regularDecoders.length + streamingDecoders.length
  };
}

/**
 * 检查解码器是否已注册
 */
export function isDecoderRegistered(decoderId: string): boolean {
  try {
    const decoder = decoderManager.getDecoder(decoderId);
    const streamingDecoder = decoderManager.getStreamingDecoder(decoderId);
    return decoder !== null || streamingDecoder !== null;
  } catch {
    return false;
  }
}

/**
 * 检查解码器是否支持流式处理
 */
export function isStreamingSupported(decoderId: string): boolean {
  return decoderManager.isStreamingSupported(decoderId);
}
