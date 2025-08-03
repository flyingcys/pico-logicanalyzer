/**
 * 解码器配置界面集成测试
 * 验证 DecoderPanel.vue 与 DecoderManager 的集成是否正常
 */

import { decoderManager } from './DecoderManager';
import { I2CDecoder } from './protocols/I2CDecoder';
import { SPIDecoder } from './protocols/SPIDecoder';
import { UARTDecoder } from './protocols/UARTDecoder';
import type { AnalyzerChannel } from '../models/AnalyzerTypes';
import type { ChannelData } from './types';

/**
 * 初始化解码器管理器
 */
export function initializeDecoders() {
  console.log('🔧 正在初始化解码器管理器...');

  // 注册解码器
  decoderManager.registerDecoder('i2c', I2CDecoder);
  decoderManager.registerDecoder('spi', SPIDecoder);
  decoderManager.registerDecoder('uart', UARTDecoder);

  const stats = decoderManager.getStatistics();
  console.log(`✅ 解码器管理器初始化完成: ${stats.registeredDecoders} 个解码器已注册`);

  return stats;
}

/**
 * 测试解码器信息获取
 */
export function testGetAvailableDecoders() {
  console.log('🔍 测试获取可用解码器信息...');

  const availableDecoders = decoderManager.getAvailableDecoders();
  console.log(`📋 找到 ${availableDecoders.length} 个可用解码器:`);

  availableDecoders.forEach(decoder => {
    console.log(`  - ${decoder.name} (${decoder.id}): ${decoder.description}`);
    console.log(`    通道: ${decoder.channels.length}个, 选项: ${decoder.options.length}个`);
  });

  return availableDecoders;
}

/**
 * 测试解码器执行
 */
export async function testDecoderExecution() {
  console.log('⚡ 测试解码器执行...');

  // 创建模拟通道数据
  const mockChannelData: ChannelData[] = [
    {
      channelNumber: 0,
      samples: new Uint8Array([1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1]) // 模拟I2C SCL
    },
    {
      channelNumber: 1,
      samples: new Uint8Array([1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1]) // 模拟I2C SDA
    }
  ];

  const sampleRate = 1000000; // 1MHz

  try {
    // 测试I2C解码器
    console.log('🔍 执行I2C解码器...');
    const i2cResult = await decoderManager.executeDecoder(
      'i2c',
      sampleRate,
      mockChannelData,
      [{ id: 'address_format', value: 'shifted' }], // 默认选项
      [
        { name: 'scl', channel: 0 },
        { name: 'sda', channel: 1 }
      ]
    );

    console.log(`I2C解码结果: ${i2cResult.success ? '成功' : '失败'}`);
    if (i2cResult.success) {
      console.log(`  执行时间: ${i2cResult.executionTime.toFixed(2)}ms`);
      console.log(`  结果数量: ${i2cResult.results.length}`);
    } else {
      console.log(`  错误信息: ${i2cResult.error}`);
    }

    return i2cResult;
  } catch (error) {
    console.error('❌ 解码器执行测试失败:', error);
    throw error;
  }
}

/**
 * 测试通道映射功能
 */
export function testChannelMapping() {
  console.log('🔗 测试通道映射功能...');

  // 获取I2C解码器信息
  const i2cDecoder = decoderManager.getDecoder('i2c');
  if (!i2cDecoder) {
    throw new Error('I2C解码器未找到');
  }

  const info = i2cDecoder.getInfo();
  console.log('📋 I2C解码器通道需求:');
  info.channels.forEach(channel => {
    console.log(`  - ${channel.name}: ${channel.desc} (${channel.required ? '必需' : '可选'})`);
  });

  // 测试通道映射验证
  const validMapping = [
    { name: 'scl', channel: 0 },
    { name: 'sda', channel: 1 }
  ];

  const invalidMapping = [
    { name: 'scl', channel: 0 }
    // 缺少必需的SDA通道
  ];

  const mockChannels: ChannelData[] = [
    { channelNumber: 0, samples: new Uint8Array([1, 0, 1]) },
    { channelNumber: 1, samples: new Uint8Array([1, 1, 0]) }
  ];

  console.log('✅ 测试有效映射:', i2cDecoder.validateOptions([], validMapping, mockChannels));
  console.log('❌ 测试无效映射:', i2cDecoder.validateOptions([], invalidMapping, mockChannels));

  return { validMapping, invalidMapping };
}

/**
 * 综合测试函数
 */
export async function runDecoderIntegrationTests() {
  console.log('🚀 开始解码器配置界面集成测试...\n');

  try {
    // 1. 初始化解码器
    const stats = initializeDecoders();
    console.log('');

    // 2. 测试获取解码器信息
    const availableDecoders = testGetAvailableDecoders();
    console.log('');

    // 3. 测试通道映射
    const mappingTest = testChannelMapping();
    console.log('');

    // 4. 测试解码器执行
    const executionResult = await testDecoderExecution();
    console.log('');

    console.log('✅ 解码器配置界面集成测试完成!');
    console.log('📊 测试结果汇总:');
    console.log(`  - 注册解码器: ${stats.registeredDecoders}个`);
    console.log(`  - 可用解码器: ${availableDecoders.length}个`);
    console.log(`  - 执行测试: ${executionResult.success ? '通过' : '失败'}`);

    return {
      success: true,
      stats,
      availableDecoders,
      executionResult
    };

  } catch (error) {
    console.error('❌ 解码器集成测试失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runDecoderIntegrationTests().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}
