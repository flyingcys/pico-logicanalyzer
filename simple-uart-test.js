/**
 * 简化的UART解码器测试
 */

const fs = require('fs');
const path = require('path');

// 模拟导入解码器
const decoderPath = path.join(__dirname, 'src/decoders/protocols/UARTDecoder.ts');
console.log('Testing UART decoder structure...');

// 读取解码器文件检查结构
const decoderContent = fs.readFileSync(decoderPath, 'utf8');

console.log('✓ Found UARTDecoder file');

// 检查关键方法是否存在
const methods = [
  'decode',
  'runMainLoop',
  'decodeChannelSimple',
  'inspectSample',
  'waitForStartBit',
  'getStartBit',
  'getDataBits',
  'getParityBit',
  'getStopBits',
  'advanceState',
  'formatValue'
];

for (const method of methods) {
  if (decoderContent.includes(method)) {
    console.log(`✓ Found method: ${method}`);
  } else {
    console.log(`✗ Missing method: ${method}`);
  }
}

// 检查注释类型是否定义
const annotations = [
  'RX_DATA', 'TX_DATA', 'RX_START', 'TX_START', 
  'RX_PARITY_OK', 'TX_PARITY_OK', 'RX_PARITY_ERR', 'TX_PARITY_ERR',
  'RX_STOP', 'TX_STOP', 'RX_WARN', 'TX_WARN'
];

console.log('\nAnnotation types:');
for (const ann of annotations) {
  if (decoderContent.includes(ann)) {
    console.log(`✓ Found annotation: ${ann}`);
  } else {
    console.log(`✗ Missing annotation: ${ann}`);
  }
}

console.log('\nStructure check complete!');

// 检查是否包含put方法调用
const putCalls = decoderContent.match(/this\.put\(/g);
console.log(`Found ${putCalls ? putCalls.length : 0} put() method calls`);

// 检查是否包含解码输出
const outputTypes = decoderContent.match(/DecoderOutputType\.ANNOTATION/g);
console.log(`Found ${outputTypes ? outputTypes.length : 0} annotation outputs`);