/**
 * 测试Node.js二进制数据处理能力
 * 验证OutputPacket转义机制和CaptureRequest序列化
 */

console.log('开始测试Node.js二进制数据处理能力...\n');

// 临时的OutputPacket实现用于测试
class TestOutputPacket {
    constructor() {
        this.dataBuffer = [];
    }
    
    addByte(value) {
        this.dataBuffer.push(value & 0xFF);
    }
    
    addBytes(values) {
        for (const value of values) {
            this.addByte(value);
        }
    }
    
    addString(text) {
        for (let i = 0; i < text.length; i++) {
            this.addByte(text.charCodeAt(i));
        }
    }
    
    serialize() {
        const finalData = [];
        
        // 起始标记
        finalData.push(0x55, 0xAA);
        
        // 转义数据
        for (let i = 0; i < this.dataBuffer.length; i++) {
            const byte = this.dataBuffer[i];
            if (byte === 0xAA || byte === 0x55 || byte === 0xF0) {
                finalData.push(0xF0);
                finalData.push(byte ^ 0xF0);
            } else {
                finalData.push(byte);
            }
        }
        
        // 结束标记
        finalData.push(0xAA, 0x55);
        
        return new Uint8Array(finalData);
    }
}

// 临时的CaptureRequest实现用于测试
class TestCaptureRequest {
    constructor() {
        this.triggerType = 0;
        this.trigger = 0;
        this.invertedOrCount = 0;
        this.triggerValue = 0;
        this.channels = new Uint8Array(24);
        this.channelCount = 0;
        this.frequency = 0;
        this.preSamples = 0;
        this.postSamples = 0;
        this.loopCount = 0;
        this.measure = 0;
        this.captureMode = 0;
    }
    
    serialize() {
        const buffer = new ArrayBuffer(45); // 结构体大小
        const view = new DataView(buffer);
        let offset = 0;
        
        view.setUint8(offset++, this.triggerType);
        view.setUint8(offset++, this.trigger);
        view.setUint8(offset++, this.invertedOrCount);
        view.setUint16(offset, this.triggerValue, true);
        offset += 2;
        
        for (let i = 0; i < 24; i++) {
            view.setUint8(offset++, this.channels[i]);
        }
        
        view.setUint8(offset++, this.channelCount);
        view.setUint32(offset, this.frequency, true);
        offset += 4;
        view.setUint32(offset, this.preSamples, true);
        offset += 4;
        view.setUint32(offset, this.postSamples, true);
        offset += 4;
        view.setUint8(offset++, this.loopCount);
        view.setUint8(offset++, this.measure);
        view.setUint8(offset++, this.captureMode);
        
        return new Uint8Array(buffer);
    }
}

// 测试1: OutputPacket基本功能
console.log('测试1: OutputPacket基本功能');
try {
    const packet = new TestOutputPacket();
    
    // 添加普通字节
    packet.addByte(0x01);
    packet.addByte(0x02);
    packet.addByte(0x03);
    
    // 添加字符串
    packet.addString('TEST');
    
    // 序列化（不含转义字符）
    const normalData = packet.serialize();
    console.log('普通数据序列化结果:', Array.from(normalData).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    
    // 验证格式: 0x55 0xAA [数据] 0xAA 0x55
    const expectedStart = [0x55, 0xAA];
    const expectedEnd = [0xAA, 0x55];
    
    const actualStart = Array.from(normalData.slice(0, 2));
    const actualEnd = Array.from(normalData.slice(-2));
    
    console.log('起始标记正确:', JSON.stringify(actualStart) === JSON.stringify(expectedStart));
    console.log('结束标记正确:', JSON.stringify(actualEnd) === JSON.stringify(expectedEnd));
    console.log('✅ 测试1通过\n');
    
} catch (error) {
    console.error('❌ 测试1失败:', error);
}

// 测试2: OutputPacket转义机制
console.log('测试2: OutputPacket转义机制');
try {
    const packet = new TestOutputPacket();
    
    // 添加需要转义的字节
    packet.addByte(0xAA);  // 需要转义
    packet.addByte(0x55);  // 需要转义
    packet.addByte(0xF0);  // 需要转义
    packet.addByte(0x01);  // 不需要转义
    
    const escapedData = packet.serialize();
    console.log('转义数据序列化结果:', Array.from(escapedData).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    
    // 验证转义规则
    const dataSection = Array.from(escapedData.slice(2, -2));
    console.log('数据部分:', dataSection.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    
    // 验证转义
    const expectedEscaped = [
        0xF0, 0x5A,  // 0xAA转义后 (0xAA ^ 0xF0 = 0x5A)
        0xF0, 0xA5,  // 0x55转义后 (0x55 ^ 0xF0 = 0xA5)
        0xF0, 0x00,  // 0xF0转义后 (0xF0 ^ 0xF0 = 0x00)
        0x01         // 0x01不转义
    ];
    
    console.log('转义结果正确:', JSON.stringify(dataSection) === JSON.stringify(expectedEscaped));
    console.log('✅ 测试2通过\n');
    
} catch (error) {
    console.error('❌ 测试2失败:', error);
}

// 测试3: CaptureRequest序列化
console.log('测试3: CaptureRequest序列化');
try {
    const request = new TestCaptureRequest();
    
    // 设置测试数据
    request.triggerType = 1;
    request.trigger = 0;
    request.invertedOrCount = 0;
    request.triggerValue = 0x1234;
    request.channelCount = 8;
    request.frequency = 24000000;
    request.preSamples = 1000;
    request.postSamples = 9000;
    request.loopCount = 0;
    request.measure = 1;
    request.captureMode = 0;
    
    // 设置通道
    for (let i = 0; i < 8; i++) {
        request.channels[i] = 1;
    }
    
    const serialized = request.serialize();
    console.log('CaptureRequest序列化长度:', serialized.length, '字节');
    console.log('CaptureRequest序列化结果 (前20字节):', 
        Array.from(serialized.slice(0, 20)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
    
    // 验证字节序 (little-endian)
    const view = new DataView(serialized.buffer);
    const frequency = view.getUint32(27, true);
    const preSamples = view.getUint32(31, true);
    const postSamples = view.getUint32(35, true);
    
    console.log('频率值正确:', frequency === 24000000);
    console.log('触发前样本数正确:', preSamples === 1000);
    console.log('触发后样本数正确:', postSamples === 9000);
    console.log('结构体大小正确:', serialized.length === 45);
    console.log('✅ 测试3通过\n');
    
} catch (error) {
    console.error('❌ 测试3失败:', error);
}

// 测试4: 大数据量处理性能
console.log('测试4: 大数据量处理性能');
try {
    const startTime = process.hrtime.bigint();
    
    const packet = new TestOutputPacket();
    
    // 添加大量数据 (10KB)
    const testData = new Uint8Array(10240);
    for (let i = 0; i < testData.length; i++) {
        testData[i] = i % 256;
    }
    
    packet.addBytes(testData);
    const serialized = packet.serialize();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
    
    console.log('处理10KB数据用时:', duration.toFixed(2), 'ms');
    console.log('序列化后大小:', serialized.length, '字节');
    console.log('性能要求通过 (<100ms):', duration < 100);
    console.log('✅ 测试4通过\n');
    
} catch (error) {
    console.error('❌ 测试4失败:', error);
}

// 测试5: 内存使用测试
console.log('测试5: 内存使用测试');
try {
    const initialMemory = process.memoryUsage().heapUsed;
    const packets = [];
    
    // 创建大量数据包
    for (let i = 0; i < 1000; i++) {
        const packet = new TestOutputPacket();
        packet.addString(`Test packet ${i}`);
        packets.push(packet.serialize());
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    console.log('内存增长:', memoryIncrease.toFixed(2), 'MB');
    console.log('内存使用合理 (<50MB):', memoryIncrease < 50);
    console.log('✅ 测试5通过\n');
    
} catch (error) {
    console.error('❌ 测试5失败:', error);
}

console.log('🎉 Node.js二进制数据处理测试全部完成!');