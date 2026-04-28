/**
 * 解码器注册中心
 * 负责注册所有可用的解码器（常规和流式）
 */

import { decoderManager } from './DecoderManager';
import { StreamingI2CDecoder } from './protocols/StreamingI2CDecoder';
import { CANDecoder } from './protocols/CANDecoder';
import { LINDecoder } from './protocols/LINDecoder';
import { I2SDecoder } from './protocols/I2SDecoder';

/**
 * 注册所有解码器
 */
export function registerAllDecoders(): void {
  console.log('📋 开始注册解码器...');

  try {
    // 注册流式解码器
    decoderManager.registerDecoder('can', CANDecoder);
    decoderManager.registerDecoder('lin', LINDecoder);
    decoderManager.registerDecoder('i2s', I2SDecoder);
    decoderManager.registerStreamingDecoder('streaming_i2c', StreamingI2CDecoder);

    console.log('✅ 解码器注册完成:');
    console.log('  - CAN 解码器 (can)');
    console.log('  - LIN 解码器 (lin)');
    console.log('  - I2S 解码器 (i2s)');
    console.log('  - I²C 流式解码器 (streaming_i2c)');

    // 获取统计信息
    const stats = decoderManager.getStatistics();
    console.log('📊 解码器注册统计:');
    console.log(`  - 常规解码器: ${stats.registeredDecoders}个`);
    console.log(`  - 流式解码器: ${stats.registeredStreamingDecoders}个`);
    console.log(`  - 可用解码器总数: ${stats.availableDecoders}个`);

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
  const stats = decoderManager.getStatistics();

  return {
    regularDecoders: ['i2c', 'spi', 'uart', 'can', 'lin', 'i2s'],
    streamingDecoders: ['streaming_i2c'],
    totalCount: stats.registeredDecoders + stats.registeredStreamingDecoders
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
