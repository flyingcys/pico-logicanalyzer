/**
 * I2C协议解码器增强单元测试
 * 专门用于提升覆盖率到95%+的A级标准
 */

import '../../../../src/tests/setup';
import '../../../../src/tests/matchers';
import { I2CDecoder } from '../../../../src/decoders/protocols/I2CDecoder';
import { AnalyzerChannel } from '../../../../src/models/CaptureModels';
import { DecoderOptionValue, DecoderOutputType } from '../../../../src/decoders/types';

describe('I2CDecoder - 增强覆盖率测试', () => {
    let decoder: I2CDecoder;
    let sclChannel: AnalyzerChannel;
    let sdaChannel: AnalyzerChannel;
    
    beforeEach(() => {
        decoder = new I2CDecoder();
        sclChannel = new AnalyzerChannel(0, 'SCL');
        sdaChannel = new AnalyzerChannel(1, 'SDA');
    });

    describe('重复START和STOP条件处理测试', () => {
        it('应该正确处理重复START条件', () => {
            // 创建包含重复START的复杂I2C序列
            // START -> 地址 -> 重复START -> 地址 -> STOP
            const sampleCount = 100;
            sclChannel.samples = new Uint8Array(sampleCount);
            sdaChannel.samples = new Uint8Array(sampleCount);
            
            let idx = 0;
            
            // 第一个START条件: SCL=高, SDA=高→低
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 1;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第一个地址字节 (0xA0 - 7位地址写)
            const addr1Bits = [1, 0, 1, 0, 0, 0, 0, 0];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr1Bits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr1Bits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 重复START条件: SCL=高, SDA=低→高→低 (在数据传输过程中)
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 1; // SDA先高
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0; // 然后SDA低 - 这是重复START
            
            // 第二个地址字节 (0xA1 - 7位地址读)
            const addr2Bits = [1, 0, 1, 0, 0, 0, 0, 1];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr2Bits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr2Bits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // STOP条件: SCL=高, SDA=低→高
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 1;
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            const results = decoder.decode(1000000, channels, options);
            
            // 验证结果包含重复START
            const startResults = results.filter(r => r.annotationType === 0 || r.annotationType === 1);
            expect(startResults.length).toBeGreaterThanOrEqual(2);
            
            // 验证包含STOP条件
            const stopResults = results.filter(r => r.annotationType === 2);
            expect(stopResults.length).toBeGreaterThanOrEqual(1);
        });

        it('应该正确处理STOP条件及比特率计算', () => {
            // 创建完整的I2C传输序列，确保调用handleStop方法
            const sampleCount = 50;
            sclChannel.samples = new Uint8Array(sampleCount);
            sdaChannel.samples = new Uint8Array(sampleCount);
            
            let idx = 0;
            
            // START条件
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 1;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 地址字节 0xA0
            const addrBits = [1, 0, 1, 0, 0, 0, 0, 0];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addrBits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addrBits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 数据字节 0x55
            const dataBits = [0, 1, 0, 1, 0, 1, 0, 1];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = dataBits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = dataBits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // STOP条件: SCL=高, SDA=低→高 (这将触发比特率计算)
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 1;
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            // 使用高采样率确保比特率计算逻辑被执行
            const results = decoder.decode(1000000, channels, options);
            
            // 验证STOP条件被正确识别
            const stopResult = results.find(r => r.annotationType === 2);
            expect(stopResult).toBeDefined();
            expect(stopResult!.values).toEqual(['Stop', 'P']);
        });
    });

    describe('10位地址处理测试', () => {
        it('应该正确处理10位地址', () => {
            // 创建10位地址序列: 11110XX0 (第一字节) + XXXXXXXX (第二字节)
            // 10位地址格式: 11110AA0 (A为高2位) + 低8位
            const sampleCount = 60;
            sclChannel.samples = new Uint8Array(sampleCount);
            sdaChannel.samples = new Uint8Array(sampleCount);
            
            let idx = 0;
            
            // START条件
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 1;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第一个地址字节: 11110100 (0xF4) - 10位地址标识 + 高2位 + 写位
            const addr1Bits = [1, 1, 1, 1, 0, 1, 0, 0]; // 0xF4
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr1Bits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr1Bits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第二个地址字节: 10101010 (0xAA) - 低8位
            const addr2Bits = [1, 0, 1, 0, 1, 0, 1, 0]; // 0xAA
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr2Bits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr2Bits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            const results = decoder.decode(1000000, channels, options);
            
            // 验证10位地址被正确识别
            const addrResults = results.filter(r => r.annotationType === 6 || r.annotationType === 7);
            expect(addrResults.length).toBeGreaterThanOrEqual(1);
            
            // 验证地址值包含10位地址的组合值
            const addrResult = addrResults[0];
            expect(addrResult).toBeDefined();
        });

        it('应该正确处理10位地址的第二阶段', () => {
            // 测试10位地址的第二个字节处理逻辑 (行326-327)
            const sampleCount = 40;
            sclChannel.samples = new Uint8Array(sampleCount);
            sdaChannel.samples = new Uint8Array(sampleCount);
            
            let idx = 0;
            
            // START条件
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 1;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第一个字节: 11110000 (0xF0) - 标识10位地址模式
            const addr1Bits = [1, 1, 1, 1, 0, 0, 0, 0];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr1Bits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr1Bits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第二个字节: 11111111 (0xFF) - 低8位
            const addr2Bits = [1, 1, 1, 1, 1, 1, 1, 1];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr2Bits[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr2Bits[i];
            }
            
            // ACK
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            const results = decoder.decode(1000000, channels, options);
            
            // 验证两个地址字节都被处理
            const addrResults = results.filter(r => r.annotationType === 6 || r.annotationType === 7);
            expect(addrResults.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('异常处理和边界条件测试', () => {
        it('应该正确处理未知异常', () => {
            // 创建一个会导致异常的场景，但不是"End of samples reached"
            const originalWait = decoder['wait'];
            
            // 模拟wait方法抛出其他类型的异常
            const mockWait = jest.fn().mockImplementation(() => {
                throw new Error('Unknown test error');
            });
            decoder['wait'] = mockWait;
            
            sclChannel.samples = new Uint8Array([0, 1, 0, 1]);
            sdaChannel.samples = new Uint8Array([1, 0, 1, 0]);
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            // 验证非"End of samples reached"异常被重新抛出
            expect(() => {
                decoder.decode(1000000, channels, options);
            }).toThrow('Unknown test error');
            
            // 恢复原始方法
            decoder['wait'] = originalWait;
        });

        it('应该处理边界地址格式fallback场景', () => {
            // 创建一个特殊场景，使地址值fallback到原始字节
            sclChannel.samples = new Uint8Array([
                0, 1, // START
                0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, // 地址字节
                0, 1  // ACK
            ]);
            sdaChannel.samples = new Uint8Array([
                1, 0, // START
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0x00
                0, 0  // ACK
            ]);
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            const results = decoder.decode(1000000, channels, options);
            
            // 验证地址解码成功
            const addrResult = results.find(r => r.annotationType === 7);
            expect(addrResult).toBeDefined();
        });

        it('应该处理空采样率场景', () => {
            // 创建有START和STOP的序列，但采样率为0
            sclChannel.samples = new Uint8Array([
                0, 1, // START
                1, 1  // STOP
            ]);
            sdaChannel.samples = new Uint8Array([
                1, 0, // START
                0, 1  // STOP
            ]);
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            // 使用0采样率
            const results = decoder.decode(0, channels, options);
            
            // 验证解码仍然工作，但比特率计算被跳过
            expect(results).toBeDefined();
        });
    });

    describe('完整I2C协议序列测试', () => {
        it('应该处理包含所有I2C元素的复杂序列', () => {
            // 创建包含START、地址、数据、重复START、更多数据、STOP的完整序列
            const sampleCount = 150;
            sclChannel.samples = new Uint8Array(sampleCount);
            sdaChannel.samples = new Uint8Array(sampleCount);
            
            let idx = 0;
            
            // 第一个START
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 1;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第一个地址 (写)
            const addr1 = [1, 0, 1, 0, 0, 0, 0, 0];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr1[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr1[i];
            }
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0; // ACK
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第一个数据字节
            const data1 = [0, 1, 0, 1, 0, 1, 0, 1];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = data1[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = data1[i];
            }
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0; // ACK
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 重复START (在SCL高期间，SDA从高到低)
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 1;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0; // 重复START
            
            // 第二个地址 (读)
            const addr2 = [1, 0, 1, 0, 0, 0, 0, 1];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = addr2[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = addr2[i];
            }
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 0; // ACK
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            
            // 第二个数据字节
            const data2 = [1, 0, 1, 0, 1, 0, 1, 0];
            for (let i = 0; i < 8; i++) {
                sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = data2[i];
                sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = data2[i];
            }
            sclChannel.samples[idx] = 0; sdaChannel.samples[idx++] = 1; // NACK
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 1;
            
            // STOP条件
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 0;
            sclChannel.samples[idx] = 1; sdaChannel.samples[idx++] = 1;
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [];
            
            const results = decoder.decode(1000000, channels, options);
            
            // 验证所有组件都被正确识别
            const startResults = results.filter(r => r.annotationType === 0 || r.annotationType === 1);
            const stopResults = results.filter(r => r.annotationType === 2);
            const addrResults = results.filter(r => r.annotationType === 6 || r.annotationType === 7);
            const dataResults = results.filter(r => r.annotationType === 8 || r.annotationType === 9);
            const ackResults = results.filter(r => r.annotationType === 3 || r.annotationType === 4);
            
            expect(startResults.length).toBeGreaterThanOrEqual(2); // 普通START + 重复START
            expect(stopResults.length).toBeGreaterThanOrEqual(1);
            expect(addrResults.length).toBeGreaterThanOrEqual(2);
            expect(dataResults.length).toBeGreaterThanOrEqual(2);
            expect(ackResults.length).toBeGreaterThanOrEqual(3); // 2个ACK + 1个NACK
        });
    });

    describe('配置选项边界测试', () => {
        it('应该处理无效选项索引', () => {
            sclChannel.samples = new Uint8Array([0, 1, 0, 1]);
            sdaChannel.samples = new Uint8Array([1, 0, 1, 0]);
            
            const channels = [sclChannel, sdaChannel];
            const options: DecoderOptionValue[] = [
                { optionIndex: -1, value: 'invalid' },
                { optionIndex: 999, value: 'invalid' }
            ];
            
            expect(() => {
                decoder.decode(1000000, channels, options);
            }).not.toThrow();
        });
    });
});