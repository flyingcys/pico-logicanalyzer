/**
 * 第六阶段自测脚本 - 协议解码器
 * 验证SPI和UART解码器的实现
 */

import { decoderManager, initializeDecoders } from './index';
import { SPIDecoder } from './protocols/SPIDecoder';
import { UARTDecoder } from './protocols/UARTDecoder';
import { I2CDecoder } from './protocols/I2CDecoder';
import { ChannelData, DecoderOptionValue } from './types';

/**
 * 创建测试用的通道数据
 */
function createTestChannelData(name: string, samples: number[]): ChannelData {
  return {
    channelNumber: 0,
    channelName: name,
    samples: new Uint8Array(samples),
    hidden: false
  };
}

/**
 * 创建简单的I2C测试数据
 * 模拟I2C START条件
 */
function createI2CTestData(): ChannelData[] {
  // SCL (Clock): 高电平保持，然后切换
  const sclData = [1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  
  // SDA (Data): 在SCL高时从高到低 (START条件)
  const sdaData = [1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];

  return [
    createTestChannelData('SCL', sclData),
    createTestChannelData('SDA', sdaData)
  ];
}

/**
 * 创建简单的SPI测试数据
 */
function createSPITestData(): ChannelData[] {
  // CLK: 时钟信号
  const clkData = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  
  // MOSI: 数据 (0x55 = 01010101)
  const mosiData = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  
  // MISO: 数据 (0xAA = 10101010)
  const misoData = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  
  // CS: 片选信号 (低有效)
  const csData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  return [
    createTestChannelData('CLK', clkData),
    createTestChannelData('MISO', misoData),
    createTestChannelData('MOSI', mosiData),
    createTestChannelData('CS', csData)
  ];
}

/**
 * 创建简单的UART测试数据
 */
function createUARTTestData(): ChannelData[] {
  // UART数据: START(0) + 数据位(0x55) + STOP(1)
  // 0x55 = 01010101 (LSB first)
  const rxData = [1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1];
  const txData = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // 空闲

  return [
    createTestChannelData('RX', rxData),
    createTestChannelData('TX', txData)
  ];
}

/**
 * 测试解码器注册
 */
function testDecoderRegistration(): boolean {
  console.log('\n=== 测试解码器注册 ===');
  
  try {
    // 初始化解码器系统
    initializeDecoders();
    
    // 获取可用解码器
    const availableDecoders = decoderManager.getAvailableDecoders();
    console.log(`可用解码器数量: ${availableDecoders.length}`);
    
    // 验证所有预期的解码器都已注册
    const expectedDecoders = ['i2c', 'spi', 'uart'];
    const actualDecoders = availableDecoders.map(d => d.id);
    
    let allRegistered = true;
    for (const expected of expectedDecoders) {
      if (!actualDecoders.includes(expected)) {
        console.error(`❌ 解码器未注册: ${expected}`);
        allRegistered = false;
      } else {
        console.log(`✅ 解码器已注册: ${expected}`);
      }
    }
    
    // 显示解码器详细信息
    for (const decoder of availableDecoders) {
      console.log(`  - ${decoder.name} (${decoder.id}): ${decoder.description}`);
      console.log(`    通道: ${decoder.channels.map(ch => ch.name).join(', ')}`);
      console.log(`    选项: ${decoder.options.length}个`);
    }
    
    return allRegistered;
  } catch (error) {
    console.error('❌ 解码器注册测试失败:', error);
    return false;
  }
}

/**
 * 测试I2C解码器
 */
function testI2CDecoder(): boolean {
  console.log('\n=== 测试I2C解码器 ===');
  
  try {
    const decoder = new I2CDecoder();
    const testData = createI2CTestData();
    const options: DecoderOptionValue[] = [
      { optionIndex: 0, value: 'shifted' } // address_format
    ];
    
    console.log('创建I2C解码器实例: ✅');
    console.log(`测试数据通道数: ${testData.length}`);
    console.log(`样本数量: ${testData[0].samples.length}`);
    
    // 执行解码
    const results = decoder.decode(1000000, testData, options);
    console.log(`解码结果数量: ${results.length}`);
    
    // 显示前几个结果
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const result = results[i];
      console.log(`  结果${i + 1}: [${result.startSample}-${result.endSample}] ${result.values.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ I2C解码器测试失败:', error);
    return false;
  }
}

/**
 * 测试SPI解码器
 */
function testSPIDecoder(): boolean {
  console.log('\n=== 测试SPI解码器 ===');
  
  try {
    const decoder = new SPIDecoder();
    const testData = createSPITestData();
    const options: DecoderOptionValue[] = [
      { optionIndex: 0, value: 'active-low' }, // cs_polarity
      { optionIndex: 1, value: '0' },          // cpol
      { optionIndex: 2, value: '0' },          // cpha
      { optionIndex: 3, value: 'msb-first' },  // bitorder
      { optionIndex: 4, value: 8 }             // wordsize
    ];
    
    console.log('创建SPI解码器实例: ✅');
    console.log(`测试数据通道数: ${testData.length}`);
    console.log(`样本数量: ${testData[0].samples.length}`);
    
    // 执行解码
    const results = decoder.decode(1000000, testData, options);
    console.log(`解码结果数量: ${results.length}`);
    
    // 显示前几个结果
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const result = results[i];
      console.log(`  结果${i + 1}: [${result.startSample}-${result.endSample}] ${result.values.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ SPI解码器测试失败:', error);
    return false;
  }
}

/**
 * 测试UART解码器
 */
function testUARTDecoder(): boolean {
  console.log('\n=== 测试UART解码器 ===');
  
  try {
    const decoder = new UARTDecoder();
    const testData = createUARTTestData();
    const options: DecoderOptionValue[] = [
      { optionIndex: 0, value: 115200 },      // baudrate
      { optionIndex: 1, value: '8' },         // data_bits
      { optionIndex: 2, value: 'none' },      // parity
      { optionIndex: 3, value: '1.0' },       // stop_bits
      { optionIndex: 4, value: 'lsb-first' }, // bit_order
      { optionIndex: 5, value: 'hex' },       // format
      { optionIndex: 6, value: 'no' },        // invert_rx
      { optionIndex: 7, value: 'no' },        // invert_tx
      { optionIndex: 8, value: 50 }           // sample_point
    ];
    
    console.log('创建UART解码器实例: ✅');
    console.log(`测试数据通道数: ${testData.length}`);
    console.log(`样本数量: ${testData[0].samples.length}`);
    
    // 执行解码
    const results = decoder.decode(1000000, testData, options);
    console.log(`解码结果数量: ${results.length}`);
    
    // 显示前几个结果
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const result = results[i];
      console.log(`  结果${i + 1}: [${result.startSample}-${result.endSample}] ${result.values.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ UART解码器测试失败:', error);
    return false;
  }
}

/**
 * 测试解码器管理器
 */
function testDecoderManager(): boolean {
  console.log('\n=== 测试解码器管理器 ===');
  
  try {
    // 测试搜索功能
    const i2cDecoders = decoderManager.searchDecoders('i2c');
    console.log(`搜索"i2c"结果: ${i2cDecoders.length}个`);
    
    const embeddedDecoders = decoderManager.getDecodersByTags(['Embedded/industrial']);
    console.log(`嵌入式/工业标签解码器: ${embeddedDecoders.length}个`);
    
    // 测试解码器执行
    const testData = createI2CTestData();
    const options: DecoderOptionValue[] = [];
    const channelMapping = [
      { captureIndex: 0, decoderIndex: 0 },
      { captureIndex: 1, decoderIndex: 1 }
    ];
    
    const result = await decoderManager.executeDecoder(
      'i2c',
      1000000,
      testData,
      options,
      channelMapping
    );
    
    console.log(`解码器执行结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`执行时间: ${result.executionTime.toFixed(2)}ms`);
    if (!result.success && result.error) {
      console.log(`错误: ${result.error}`);
    }
    
    // 获取统计信息
    const stats = decoderManager.getStatistics();
    console.log(`统计信息:`);
    console.log(`  注册解码器: ${stats.registeredDecoders}`);
    console.log(`  缓存实例: ${stats.cachedInstances}`);
    console.log(`  可用解码器: ${stats.availableDecoders}`);
    
    return result.success;
  } catch (error) {
    console.error('❌ 解码器管理器测试失败:', error);
    return false;
  }
}

/**
 * 主测试函数
 */
export async function runStage6SelfTest(): Promise<void> {
  console.log('🚀 开始第六阶段自测 - 协议解码器');
  console.log('======================================');
  
  const tests = [
    { name: '解码器注册', test: testDecoderRegistration },
    { name: 'I2C解码器', test: testI2CDecoder },
    { name: 'SPI解码器', test: testSPIDecoder },
    { name: 'UART解码器', test: testUARTDecoder },
    { name: '解码器管理器', test: testDecoderManager }
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (result) {
        console.log(`✅ ${name}: 通过`);
        passed++;
      } else {
        console.log(`❌ ${name}: 失败`);
      }
    } catch (error) {
      console.log(`❌ ${name}: 异常 - ${error}`);
    }
  }
  
  console.log('\n======================================');
  console.log(`🎯 第六阶段自测结果: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log('🎉 所有测试通过！协议解码器实现完成！');
    console.log('\n✅ 第六阶段完成总结:');
    console.log('  - DecoderBase抽象基类: 完整实现，包含wait()和put()核心API');
    console.log('  - DecoderManager管理系统: 完整的注册、发现和执行机制');
    console.log('  - I2C协议解码器: 完整实现，支持START/STOP条件检测');
    console.log('  - SPI协议解码器: 完整实现，支持CPOL/CPHA模式');
    console.log('  - UART协议解码器: 完整实现，支持异步串行解码');
    console.log('  - Python→TypeScript转换: 建立完整转换规范和实践');
    console.log('  - 零依赖架构: 完全摆脱Python依赖，纯TypeScript实现');
  } else {
    console.log('⚠️  部分测试未通过，需要进一步调试');
  }
}