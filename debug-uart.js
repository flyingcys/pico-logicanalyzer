/**
 * 快速调试UART解码器
 */

// 生成测试数据
function generateUARTFrame(data, baudrate = 115200, sampleRate = 1000000) {
  const bitWidth = Math.floor(sampleRate / baudrate);
  const samples = [];

  console.log(`Generating UART frame: data=0x${data.toString(16)}, bitWidth=${bitWidth}`);

  // 空闲状态
  for (let i = 0; i < bitWidth; i++) {
    samples.push(1);
  }

  // 起始位
  for (let i = 0; i < bitWidth; i++) {
    samples.push(0);
  }

  // 数据位 (LSB first)
  console.log(`Data bits:`);
  for (let bit = 0; bit < 8; bit++) {
    const bitValue = (data >> bit) & 1;
    console.log(`Bit ${bit}: ${bitValue}`);
    for (let i = 0; i < bitWidth; i++) {
      samples.push(bitValue);
    }
  }

  // 停止位
  for (let i = 0; i < bitWidth; i++) {
    samples.push(1);
  }

  console.log(`Generated ${samples.length} samples`);
  return new Uint8Array(samples);
}

// 生成0x41('A')的UART帧
const testData = generateUARTFrame(0x41);
console.log('Sample data preview:', Array.from(testData.slice(0, 50)));

// 检查模式
let found = false;
for (let i = 0; i < testData.length - 1; i++) {
  if (testData[i] === 1 && testData[i + 1] === 0) {
    console.log(`Found potential start bit at index ${i} -> ${i + 1}`);
    found = true;
    
    // 检查接下来的数据
    console.log('Next 20 samples:', Array.from(testData.slice(i, i + 20)));
    break;
  }
}

if (!found) {
  console.log('No start bit pattern found!');
}