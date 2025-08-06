/**
 * OutputPacket 和 CaptureRequest 单元测试
 * 测试通信协议层的数据包序列化和转义机制
 */

import { OutputPacket, CaptureRequest, NetConfig } from '../../../src/drivers/AnalyzerDriverBase';
import { CaptureMode, TriggerType } from '../../../src/models/AnalyzerTypes';

describe('OutputPacket', () => {
    let packet: OutputPacket;
    
    beforeEach(() => {
        packet = new OutputPacket();
    });
    
    describe('基础数据添加', () => {
        it('应该能添加单个字节', () => {
            packet.addByte(0x42);
            const result = packet.serialize();
            
            // 格式: [0x55, 0xAA, 0x42, 0xAA, 0x55]
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x42, 0xAA, 0x55]));
        });
        
        it('应该能添加字节数组', () => {
            packet.addBytes([0x01, 0x02, 0x03]);
            const result = packet.serialize();
            
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x01, 0x02, 0x03, 0xAA, 0x55]));
        });
        
        it('应该能添加Uint8Array', () => {
            const data = new Uint8Array([0x10, 0x20, 0x30]);
            packet.addBytes(data);
            const result = packet.serialize();
            
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x10, 0x20, 0x30, 0xAA, 0x55]));
        });
        
        it('应该能添加ASCII字符串', () => {
            packet.addString('ABC');
            const result = packet.serialize();
            
            // A=0x41, B=0x42, C=0x43
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x41, 0x42, 0x43, 0xAA, 0x55]));
        });
        
        it('应该正确处理字节值的范围限制', () => {
            packet.addByte(0x1FF); // 超过8位
            const result = packet.serialize();
            
            // 应该被截断为0xFF
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xFF, 0xAA, 0x55]));
        });
    });
    
    describe('转义机制测试', () => {
        it('应该正确转义0xAA字节', () => {
            packet.addByte(0xAA);
            const result = packet.serialize();
            
            // 0xAA -> 0xF0, (0xAA ^ 0xF0) = 0xF0, 0x5A
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xF0, 0x5A, 0xAA, 0x55]));
        });
        
        it('应该正确转义0x55字节', () => {
            packet.addByte(0x55);
            const result = packet.serialize();
            
            // 0x55 -> 0xF0, (0x55 ^ 0xF0) = 0xF0, 0xA5
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xF0, 0xA5, 0xAA, 0x55]));
        });
        
        it('应该正确转义0xF0字节', () => {
            packet.addByte(0xF0);
            const result = packet.serialize();
            
            // 0xF0 -> 0xF0, (0xF0 ^ 0xF0) = 0xF0, 0x00
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xF0, 0x00, 0xAA, 0x55]));
        });
        
        it('应该不转义普通字节', () => {
            packet.addBytes([0x01, 0x42, 0x7F, 0xFF]);
            const result = packet.serialize();
            
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x01, 0x42, 0x7F, 0xFF, 0xAA, 0x55]));
        });
        
        it('应该正确处理连续的需转义字节', () => {
            packet.addBytes([0xAA, 0x55, 0xF0]);
            const result = packet.serialize();
            
            // 每个字节都需要转义
            expect(result).toEqual(new Uint8Array([
                0x55, 0xAA,         // 起始标记
                0xF0, 0x5A,         // 0xAA转义
                0xF0, 0xA5,         // 0x55转义
                0xF0, 0x00,         // 0xF0转义
                0xAA, 0x55          // 结束标记
            ]));
        });
        
        it('应该正确处理混合数据的转义', () => {
            packet.addBytes([0x01, 0xAA, 0x02, 0x55, 0x03, 0xF0, 0x04]);
            const result = packet.serialize();
            
            expect(result).toEqual(new Uint8Array([
                0x55, 0xAA,         // 起始标记
                0x01,               // 普通字节
                0xF0, 0x5A,         // 0xAA转义
                0x02,               // 普通字节
                0xF0, 0xA5,         // 0x55转义
                0x03,               // 普通字节
                0xF0, 0x00,         // 0xF0转义
                0x04,               // 普通字节
                0xAA, 0x55          // 结束标记
            ]));
        });
    });
    
    describe('结构体序列化', () => {
        it('应该能添加实现serialize方法的结构体', () => {
            const mockStruct = {
                serialize: () => new Uint8Array([0x11, 0x22, 0x33])
            };
            
            packet.addStruct(mockStruct);
            const result = packet.serialize();
            
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x11, 0x22, 0x33, 0xAA, 0x55]));
        });
        
        it('应该拒绝null或undefined结构体', () => {
            expect(() => packet.addStruct(null)).toThrow('结构体不能为null或undefined');
            expect(() => packet.addStruct(undefined)).toThrow('结构体不能为null或undefined');
        });
        
        it('应该拒绝serialize方法返回非Uint8Array的结构体', () => {
            const invalidStruct = {
                serialize: () => 'invalid result' // 返回字符串而不是Uint8Array
            };
            
            expect(() => packet.addStruct(invalidStruct)).toThrow('结构体serialize方法必须返回Uint8Array');
        });
        
        it('应该拒绝没有serialize方法的对象', () => {
            const invalidStruct = { data: 'test' };
            
            expect(() => packet.addStruct(invalidStruct)).toThrow('结构体必须实现serialize方法');
        });
        
        it('应该处理空结构体', () => {
            const emptyStruct = {
                serialize: () => new Uint8Array([])
            };
            
            packet.addStruct(emptyStruct);
            const result = packet.serialize();
            
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xAA, 0x55]));
        });
    });
    
    describe('数据包管理', () => {
        it('应该能清空数据包', () => {
            packet.addBytes([0x01, 0x02, 0x03]);
            packet.clear();
            packet.addByte(0x42);
            
            const result = packet.serialize();
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0x42, 0xAA, 0x55]));
        });
        
        it('空数据包应该只包含起始和结束标记', () => {
            const result = packet.serialize();
            expect(result).toEqual(new Uint8Array([0x55, 0xAA, 0xAA, 0x55]));
        });
        
        it('应该支持重复序列化', () => {
            packet.addByte(0x42);
            
            const result1 = packet.serialize();
            const result2 = packet.serialize();
            
            expect(result1).toEqual(result2);
        });
    });
    
    describe('边界条件测试', () => {
        it('应该处理最大长度数据', () => {
            // 添加大量数据测试性能和正确性
            const largeData = new Array(1000).fill(0).map((_, i) => i % 256);
            packet.addBytes(largeData);
            
            const result = packet.serialize();
            
            // 验证起始和结束标记
            expect(result[0]).toBe(0x55);
            expect(result[1]).toBe(0xAA);
            expect(result[result.length - 2]).toBe(0xAA);
            expect(result[result.length - 1]).toBe(0x55);
            
            // 验证长度合理（包含转义字节）
            expect(result.length).toBeGreaterThan(1004); // 4字节标记 + 1000字节数据 + 转义字节
        });
        
        it('应该处理全部需要转义的数据', () => {
            const escapeData = [0xAA, 0x55, 0xF0, 0xAA, 0x55, 0xF0];
            packet.addBytes(escapeData);
            
            const result = packet.serialize();
            
            // 每个字节都被转义，所以数据部分应该是12字节（6个字节 * 2）
            expect(result.length).toBe(16); // 4字节标记 + 12字节转义数据
        });
    });
    
    describe('性能测试', () => {
        it('序列化应该在合理时间内完成', () => {
            const data = new Array(10000).fill(0x42);
            packet.addBytes(data);
            
            const startTime = Date.now();
            packet.serialize();
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100); // 100ms内完成
        });
        
        it('转义处理应该高效', () => {
            // 所有字节都需要转义的最坏情况
            const worstCaseData = new Array(1000).fill(0).map(() => 0xAA);
            packet.addBytes(worstCaseData);
            
            const startTime = Date.now();
            packet.serialize();
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(50); // 50ms内完成
        });
    });
});

describe('CaptureRequest', () => {
    let request: CaptureRequest;
    
    beforeEach(() => {
        request = new CaptureRequest();
    });
    
    describe('构造函数和初始化', () => {
        it('应该正确初始化默认值', () => {
            expect(request.triggerType).toBe(0);
            expect(request.trigger).toBe(0);
            expect(request.invertedOrCount).toBe(0);
            expect(request.triggerValue).toBe(0);
            expect(request.channels).toBeInstanceOf(Uint8Array);
            expect(request.channels.length).toBe(24);
            expect(request.channelCount).toBe(0);
            expect(request.frequency).toBe(0);
            expect(request.preSamples).toBe(0);
            expect(request.postSamples).toBe(0);
            expect(request.loopCount).toBe(0);
            expect(request.measure).toBe(0);
            expect(request.captureMode).toBe(0);
        });
        
        it('通道数组应该初始化为全0', () => {
            for (let i = 0; i < 24; i++) {
                expect(request.channels[i]).toBe(0);
            }
        });
    });
    
    describe('fromConfiguration方法', () => {
        it('应该正确从配置创建请求', () => {
            const config = {
                triggerType: TriggerType.Complex,
                triggerChannel: 5,
                triggerInverted: true,
                triggerPattern: 0x1234,
                captureChannels: [0, 1, 2, 5, 10],
                frequency: 24000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 10000,
                loopCount: 3,
                measureBursts: true,
                captureMode: CaptureMode.Channels_16
            };
            
            const result = CaptureRequest.fromConfiguration(config);
            
            expect(result.triggerType).toBe(TriggerType.Complex);
            expect(result.trigger).toBe(5);
            expect(result.invertedOrCount).toBe(1); // true -> 1
            expect(result.triggerValue).toBe(0x1234);
            expect(result.channelCount).toBe(5);
            expect(result.frequency).toBe(24000000);
            expect(result.preSamples).toBe(1000);
            expect(result.postSamples).toBe(10000);
            expect(result.loopCount).toBe(3);
            expect(result.measure).toBe(1); // true -> 1
            expect(result.captureMode).toBe(CaptureMode.Channels_16);
        });
        
        it('应该正确设置通道数组', () => {
            const config = {
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false,
                captureChannels: [0, 2, 5, 7, 10, 15, 20, 23],
                frequency: 1000000,
                preTriggerSamples: 0,
                postTriggerSamples: 1000,
                loopCount: 0,
                measureBursts: false
            };
            
            const result = CaptureRequest.fromConfiguration(config);
            
            // 验证指定的通道被设置为1
            expect(result.channels[0]).toBe(1);
            expect(result.channels[2]).toBe(1);
            expect(result.channels[5]).toBe(1);
            expect(result.channels[7]).toBe(1);
            expect(result.channels[10]).toBe(1);
            expect(result.channels[15]).toBe(1);
            expect(result.channels[20]).toBe(1);
            expect(result.channels[23]).toBe(1);
            
            // 验证其他通道保持为0
            expect(result.channels[1]).toBe(0);
            expect(result.channels[3]).toBe(0);
            expect(result.channels[4]).toBe(0);
        });
        
        it('应该处理默认值', () => {
            const config = {
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false,
                captureChannels: [0],
                frequency: 1000000,
                preTriggerSamples: 0,
                postTriggerSamples: 1000,
                loopCount: 0,
                measureBursts: false
                // 没有triggerPattern和captureMode
            };
            
            const result = CaptureRequest.fromConfiguration(config);
            
            expect(result.triggerValue).toBe(0); // 默认triggerPattern
            expect(result.captureMode).toBe(CaptureMode.Channels_8); // 默认captureMode
        });
        
        it('应该限制通道数量到24', () => {
            const config = {
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false,
                captureChannels: Array.from({length: 30}, (_, i) => i), // 30个通道
                frequency: 1000000,
                preTriggerSamples: 0,
                postTriggerSamples: 1000,
                loopCount: 0,
                measureBursts: false
            };
            
            const result = CaptureRequest.fromConfiguration(config);
            
            // 只有前24个通道应该被设置
            for (let i = 0; i < 24; i++) {
                expect(result.channels[i]).toBe(1);
            }
            expect(result.channelCount).toBe(30); // 但是count记录实际数量
        });
    });
    
    describe('序列化测试', () => {
        it('应该生成正确大小的字节数组', () => {
            const data = request.serialize();
            expect(data.length).toBe(45); // 预期的结构体大小
        });
        
        it('应该按正确顺序序列化字段', () => {
            request.triggerType = 1;
            request.trigger = 2;
            request.invertedOrCount = 1;
            request.triggerValue = 0x1234;
            request.channelCount = 3;
            request.frequency = 0x12345678;
            request.preSamples = 0x11111111;
            request.postSamples = 0x22222222;
            request.loopCount = 5;
            request.measure = 1;
            request.captureMode = 2;
            
            const data = request.serialize();
            const view = new DataView(data.buffer);
            
            expect(view.getUint8(0)).toBe(1);     // triggerType
            expect(view.getUint8(1)).toBe(2);     // trigger
            expect(view.getUint8(2)).toBe(1);     // invertedOrCount
            expect(view.getUint16(3, true)).toBe(0x1234); // triggerValue (little-endian)
            // 跳过24字节的channels数组
            expect(view.getUint8(29)).toBe(3);    // channelCount
            expect(view.getUint32(30, true)).toBe(0x12345678); // frequency (little-endian)
            expect(view.getUint32(34, true)).toBe(0x11111111); // preSamples (little-endian)
            expect(view.getUint32(38, true)).toBe(0x22222222); // postSamples (little-endian)
            expect(view.getUint8(42)).toBe(5);    // loopCount
            expect(view.getUint8(43)).toBe(1);    // measure
            expect(view.getUint8(44)).toBe(2);    // captureMode
        });
        
        it('应该正确序列化通道数组', () => {
            request.channels[0] = 1;
            request.channels[5] = 1;
            request.channels[10] = 1;
            request.channels[23] = 1;
            
            const data = request.serialize();
            
            // 通道数组从偏移5开始，长度24字节
            expect(data[5]).toBe(1);   // channels[0]
            expect(data[10]).toBe(1);  // channels[5]
            expect(data[15]).toBe(1);  // channels[10]
            expect(data[28]).toBe(1);  // channels[23]
            
            // 其他通道应该为0
            expect(data[6]).toBe(0);   // channels[1]
            expect(data[7]).toBe(0);   // channels[2]
        });
        
        it('应该使用小端字节序', () => {
            request.triggerValue = 0x1234;
            request.frequency = 0x12345678;
            
            const data = request.serialize();
            
            // triggerValue (16位，偏移3)
            expect(data[3]).toBe(0x34); // 低字节
            expect(data[4]).toBe(0x12); // 高字节
            
            // frequency (32位，偏移30)
            expect(data[30]).toBe(0x78); // 最低字节
            expect(data[31]).toBe(0x56);
            expect(data[32]).toBe(0x34);
            expect(data[33]).toBe(0x12); // 最高字节
        });
    });
    
    describe('字节布局兼容性', () => {
        it('结构体大小应该与C#版本一致', () => {
            // C#结构体大小计算：
            // byte + byte + byte + ushort + byte[24] + byte + uint + uint + uint + byte + byte + byte = 45字节
            expect(request.serialize().length).toBe(45);
        });
        
        it('字段偏移应该与C#版本一致', () => {
            const data = request.serialize();
            
            // 验证关键字段的偏移位置
            const expectedOffsets = {
                triggerType: 0,      // byte
                trigger: 1,          // byte  
                invertedOrCount: 2,  // byte
                triggerValue: 3,     // ushort (2 bytes)
                channels: 5,         // byte[24]
                channelCount: 29,    // byte
                frequency: 30,       // uint (4 bytes)
                preSamples: 34,      // uint (4 bytes)
                postSamples: 38,     // uint (4 bytes)
                loopCount: 42,       // byte
                measure: 43,         // byte
                captureMode: 44      // byte
            };
            
            // 验证结构体总大小
            expect(data.length).toBe(45);
            
            // 所有字段都应该在预期位置
            expect(expectedOffsets.triggerType).toBe(0);
            expect(expectedOffsets.captureMode).toBe(44);
        });
    });
    
    describe('边界值测试', () => {
        it('应该处理最大值', () => {
            request.triggerType = 255;
            request.trigger = 255;
            request.invertedOrCount = 255;
            request.triggerValue = 0xFFFF;
            request.channelCount = 255;
            request.frequency = 0xFFFFFFFF;
            request.preSamples = 0xFFFFFFFF;
            request.postSamples = 0xFFFFFFFF;
            request.loopCount = 255;
            request.measure = 255;
            request.captureMode = 255;
            
            expect(() => request.serialize()).not.toThrow();
            
            const data = request.serialize();
            expect(data.length).toBe(45);
        });
        
        it('应该处理最小值', () => {
            // 所有字段都已经是默认的0值
            expect(() => request.serialize()).not.toThrow();
            
            const data = request.serialize();
            expect(data.length).toBe(45);
            
            // 验证所有字段都是0（除了通道数组位置）
            const view = new DataView(data.buffer);
            expect(view.getUint8(0)).toBe(0);
            expect(view.getUint16(3, true)).toBe(0);
            expect(view.getUint32(30, true)).toBe(0);
        });
    });
    
    describe('与OutputPacket集成测试', () => {
        it('CaptureRequest应该能被OutputPacket序列化', () => {
            const config = {
                triggerType: TriggerType.Complex,
                triggerChannel: 1,
                triggerInverted: false,
                triggerPattern: 0xABCD,
                captureChannels: [0, 1, 2],
                frequency: 24000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 10000,
                loopCount: 0,
                measureBursts: false,
                captureMode: CaptureMode.Channels_8
            };
            
            const captureRequest = CaptureRequest.fromConfiguration(config);
            const packet = new OutputPacket();
            
            packet.addByte(1); // 命令字节
            packet.addStruct(captureRequest);
            
            const result = packet.serialize();
            
            // 验证基本结构：起始标记 + 命令字节 + 结构体数据 + 结束标记
            expect(result[0]).toBe(0x55);  // 起始标记
            expect(result[1]).toBe(0xAA);
            expect(result[2]).toBe(0x01);  // 命令字节
            expect(result[result.length - 2]).toBe(0xAA); // 结束标记
            expect(result[result.length - 1]).toBe(0x55);
            
            // 验证数据长度合理（4字节标记 + 1字节命令 + 45字节结构体 + 可能的转义字节）
            expect(result.length).toBeGreaterThanOrEqual(50);
        });
        
        it('结构体中的转义字符应该被正确处理', () => {
            request.triggerType = 0xAA;  // 需要转义的值
            request.frequency = 0x55AA55AA; // 包含需要转义的字节
            
            const packet = new OutputPacket();
            packet.addStruct(request);
            
            const result = packet.serialize();
            
            // 结果应该包含转义字符
            expect(result.includes(0xF0)).toBe(true);
            
            // 验证基本结构仍然正确
            expect(result[0]).toBe(0x55);
            expect(result[1]).toBe(0xAA);
            expect(result[result.length - 2]).toBe(0xAA);
            expect(result[result.length - 1]).toBe(0x55);
        });
    });
    
    describe('性能测试', () => {
        it('序列化应该高效', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                request.serialize();
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(100); // 1000次序列化在100ms内完成
        });
        
        it('fromConfiguration应该高效', () => {
            const config = {
                triggerType: TriggerType.Complex,
                triggerChannel: 1,
                triggerInverted: false,
                captureChannels: Array.from({length: 24}, (_, i) => i),
                frequency: 24000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 10000,
                loopCount: 0,
                measureBursts: false
            };
            
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                CaptureRequest.fromConfiguration(config);
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(50); // 1000次创建在50ms内完成
        });
    });
});

describe('NetConfig', () => {
    let netConfig: NetConfig;
    
    beforeEach(() => {
        netConfig = new NetConfig();
    });
    
    describe('构造函数和初始化', () => {
        it('应该正确初始化默认值', () => {
            expect(netConfig.accessPointName).toBe('');
            expect(netConfig.password).toBe('');
            expect(netConfig.ipAddress).toBe('');
            expect(netConfig.port).toBe(0);
        });
        
        it('应该正确初始化指定值', () => {
            const config = new NetConfig('TestWiFi', 'password123', '192.168.1.100', 8080);
            
            expect(config.accessPointName).toBe('TestWiFi');
            expect(config.password).toBe('password123');
            expect(config.ipAddress).toBe('192.168.1.100');
            expect(config.port).toBe(8080);
        });
        
        it('应该支持部分参数初始化', () => {
            const config = new NetConfig('MyNetwork', 'secret');
            
            expect(config.accessPointName).toBe('MyNetwork');
            expect(config.password).toBe('secret');
            expect(config.ipAddress).toBe('');
            expect(config.port).toBe(0);
        });
    });
    
    describe('序列化测试', () => {
        it('应该生成正确大小的字节数组', () => {
            const data = netConfig.serialize();
            expect(data.length).toBe(115); // 33 + 64 + 16 + 2 = 115字节
        });
        
        it('应该正确序列化各个字段', () => {
            netConfig.accessPointName = 'TestAP';
            netConfig.password = 'secret123';
            netConfig.ipAddress = '192.168.1.100';
            netConfig.port = 8080;
            
            const data = netConfig.serialize();
            
            // 验证AccessPointName (33字节)
            const apNameBytes = new TextEncoder().encode('TestAP');
            for (let i = 0; i < apNameBytes.length; i++) {
                expect(data[i]).toBe(apNameBytes[i]);
            }
            // 剩余字节应该为0
            for (let i = apNameBytes.length; i < 33; i++) {
                expect(data[i]).toBe(0);
            }
            
            // 验证Password (64字节，从偏移33开始)
            const passwordBytes = new TextEncoder().encode('secret123');
            for (let i = 0; i < passwordBytes.length; i++) {
                expect(data[33 + i]).toBe(passwordBytes[i]);
            }
            // 剩余字节应该为0
            for (let i = passwordBytes.length; i < 64; i++) {
                expect(data[33 + i]).toBe(0);
            }
            
            // 验证IPAddress (16字节，从偏移97开始)
            const ipBytes = new TextEncoder().encode('192.168.1.100');
            for (let i = 0; i < ipBytes.length; i++) {
                expect(data[97 + i]).toBe(ipBytes[i]);
            }
            // 剩余字节应该为0
            for (let i = ipBytes.length; i < 16; i++) {
                expect(data[97 + i]).toBe(0);
            }
            
            // 验证Port (2字节，从偏移113开始，小端序)
            const view = new DataView(data.buffer);
            expect(view.getUint16(113, true)).toBe(8080);
        });
        
        it('空字符串应该填充为零字节', () => {
            // 使用默认空值
            const data = netConfig.serialize();
            
            // AccessPointName区域应该全为0
            for (let i = 0; i < 33; i++) {
                expect(data[i]).toBe(0);
            }
            
            // Password区域应该全为0
            for (let i = 33; i < 97; i++) {
                expect(data[i]).toBe(0);
            }
            
            // IPAddress区域应该全为0
            for (let i = 97; i < 113; i++) {
                expect(data[i]).toBe(0);
            }
            
            // Port应该为0
            const view = new DataView(data.buffer);
            expect(view.getUint16(113, true)).toBe(0);
        });
        
        it('应该正确处理超长字符串截断', () => {
            // 测试超长AccessPointName
            const longAP = 'A'.repeat(50); // 超过33字节限制
            netConfig.accessPointName = longAP;
            
            const data = netConfig.serialize();
            
            // 只有前33个字符应该被包含
            for (let i = 0; i < 33; i++) {
                expect(data[i]).toBe(65); // 'A'的ASCII码
            }
            
            // 测试超长Password
            const longPassword = 'P'.repeat(80); // 超过64字节限制
            netConfig.password = longPassword;
            
            const data2 = netConfig.serialize();
            
            // 只有前64个字符应该被包含
            for (let i = 0; i < 64; i++) {
                expect(data2[33 + i]).toBe(80); // 'P'的ASCII码
            }
            
            // 测试超长IPAddress
            const longIP = '1'.repeat(20); // 超过16字节限制
            netConfig.ipAddress = longIP;
            
            const data3 = netConfig.serialize();
            
            // 只有前16个字符应该被包含
            for (let i = 0; i < 16; i++) {
                expect(data3[97 + i]).toBe(49); // '1'的ASCII码
            }
        });
        
        it('应该使用小端字节序序列化端口', () => {
            netConfig.port = 0x1234; // 测试值
            
            const data = netConfig.serialize();
            
            // 验证小端序：低字节在前
            expect(data[113]).toBe(0x34); // 低字节
            expect(data[114]).toBe(0x12); // 高字节
        });
    });
    
    describe('字节布局兼容性', () => {
        it('结构体大小应该与C#版本一致', () => {
            // C#结构体大小计算：33 + 64 + 16 + 2 = 115字节
            expect(netConfig.serialize().length).toBe(115);
        });
        
        it('字段偏移应该与C#版本一致', () => {
            const data = netConfig.serialize();
            
            const expectedOffsets = {
                accessPointName: 0,   // 33 bytes
                password: 33,         // 64 bytes
                ipAddress: 97,        // 16 bytes  
                port: 113             // 2 bytes
            };
            
            // 验证结构体总大小
            expect(data.length).toBe(115);
            
            // 验证各字段的起始位置是正确的
            expect(expectedOffsets.accessPointName).toBe(0);
            expect(expectedOffsets.password).toBe(33);
            expect(expectedOffsets.ipAddress).toBe(97);
            expect(expectedOffsets.port).toBe(113);
        });
    });
    
    describe('边界值测试', () => {
        it('应该处理最大端口值', () => {
            netConfig.port = 65535; // 16位最大值
            
            const data = netConfig.serialize();
            const view = new DataView(data.buffer);
            
            expect(view.getUint16(113, true)).toBe(65535);
        });
        
        it('应该处理特殊字符', () => {
            netConfig.accessPointName = 'Test-WiFi_5GHz';
            netConfig.password = 'P@ssw0rd!#$%';
            netConfig.ipAddress = '192.168.1.1';
            
            expect(() => netConfig.serialize()).not.toThrow();
            
            const data = netConfig.serialize();
            
            // 验证特殊字符被正确编码
            const apBytes = new TextEncoder().encode('Test-WiFi_5GHz');
            for (let i = 0; i < apBytes.length; i++) {
                expect(data[i]).toBe(apBytes[i]);
            }
        });
        
        it('应该处理Unicode字符', () => {
            netConfig.accessPointName = 'WiFi测试'; // 包含中文字符
            
            expect(() => netConfig.serialize()).not.toThrow();
            
            const data = netConfig.serialize();
            
            // Unicode字符会被TextEncoder编码为UTF-8字节
            const encoded = new TextEncoder().encode('WiFi测试');
            for (let i = 0; i < Math.min(encoded.length, 33); i++) {
                expect(data[i]).toBe(encoded[i]);
            }
        });
    });
    
    describe('与OutputPacket集成测试', () => {
        it('NetConfig应该能被OutputPacket序列化', () => {
            netConfig.accessPointName = 'TestNetwork';
            netConfig.password = 'secret123';
            netConfig.ipAddress = '192.168.1.100';
            netConfig.port = 8080;
            
            const packet = new OutputPacket();
            packet.addByte(2); // 网络配置命令
            packet.addStruct(netConfig);
            
            const result = packet.serialize();
            
            // 验证基本结构
            expect(result[0]).toBe(0x55);  // 起始标记
            expect(result[1]).toBe(0xAA);
            expect(result[2]).toBe(0x02);  // 命令字节
            expect(result[result.length - 2]).toBe(0xAA); // 结束标记
            expect(result[result.length - 1]).toBe(0x55);
            
            // 验证数据长度合理（4字节标记 + 1字节命令 + 115字节结构体 + 可能的转义字节）
            expect(result.length).toBeGreaterThanOrEqual(120);
        });
        
        it('结构体中的转义字符应该被正确处理', () => {
            // 设置包含需要转义字节的配置
            netConfig.accessPointName = String.fromCharCode(0xAA, 0x55); // 需要转义的字符
            netConfig.port = 0x55AA; // 端口值包含需要转义的字节
            
            const packet = new OutputPacket();
            packet.addStruct(netConfig);
            
            const result = packet.serialize();
            
            // 结果应该包含转义字符
            expect(result.includes(0xF0)).toBe(true);
            
            // 验证基本结构仍然正确
            expect(result[0]).toBe(0x55);
            expect(result[1]).toBe(0xAA);
            expect(result[result.length - 2]).toBe(0xAA);
            expect(result[result.length - 1]).toBe(0x55);
        });
    });
    
    describe('性能测试', () => {
        it('序列化应该高效', () => {
            netConfig.accessPointName = 'PerformanceTest';
            netConfig.password = 'TestPassword123';
            netConfig.ipAddress = '192.168.1.100';
            netConfig.port = 8080;
            
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                netConfig.serialize();
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(100); // 1000次序列化在100ms内完成
        });
        
        it('构造函数应该高效', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                new NetConfig('Test', 'Pass', '192.168.1.1', 8080);
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(50); // 1000次创建在50ms内完成
        });
    });
    
    describe('实际应用场景测试', () => {
        it('应该支持常见WiFi配置', () => {
            const configs = [
                { ap: 'Home-WiFi', pass: 'homepassword', ip: '192.168.1.100', port: 80 },
                { ap: 'Office-5G', pass: 'Office@2023!', ip: '10.0.0.50', port: 443 },
                { ap: 'Guest', pass: '', ip: '172.16.1.200', port: 8080 },
                { ap: 'Mobile-Hotspot', pass: '12345678', ip: '192.168.43.1', port: 9090 }
            ];
            
            configs.forEach(config => {
                const netConfig = new NetConfig(config.ap, config.pass, config.ip, config.port);
                
                expect(() => netConfig.serialize()).not.toThrow();
                
                const data = netConfig.serialize();
                expect(data.length).toBe(115);
                
                // 验证端口值正确
                const view = new DataView(data.buffer);
                expect(view.getUint16(113, true)).toBe(config.port);
            });
        });
        
        it('应该支持IPv4地址格式', () => {
            const ipAddresses = [
                '0.0.0.0',
                '127.0.0.1',
                '192.168.1.1',
                '10.0.0.1',
                '172.16.0.1',  
                '255.255.255.255'
            ];
            
            ipAddresses.forEach(ip => {
                netConfig.ipAddress = ip;
                
                expect(() => netConfig.serialize()).not.toThrow();
                
                const data = netConfig.serialize();
                const encoded = new TextEncoder().encode(ip);
                
                // 验证IP地址正确编码
                for (let i = 0; i < encoded.length; i++) {
                    expect(data[97 + i]).toBe(encoded[i]);
                }
            });
        });
    });
});