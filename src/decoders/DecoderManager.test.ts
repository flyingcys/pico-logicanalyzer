/**
 * DecoderManager 单元测试
 * 基于原版SigrokProvider功能的TypeScript实现测试
 */

import { DecoderManager } from './DecoderManager';
import { DecoderBase } from './DecoderBase';
import { I2CDecoder } from './protocols/I2CDecoder';
import { SPIDecoder } from './protocols/SPIDecoder';
import { UARTDecoder } from './protocols/UARTDecoder';
import { AnalyzerChannel } from '../models/AnalyzerChannel';
import { DecoderChannel, DecoderOption, DecoderInfo, DecoderOptionValue, DecoderResult } from './types';

// 创建测试用的简单解码器
class TestSimpleDecoder extends DecoderBase {
    readonly id = 'test-simple';
    readonly name = 'Simple Test';
    readonly longname = 'Simple Test Decoder';
    readonly desc = 'A simple decoder for testing';
    readonly license = 'gplv2+';
    readonly inputs = ['logic'];
    readonly outputs = ['test'];
    
    readonly channels: DecoderChannel[] = [
        { id: 'data', name: 'DATA', desc: 'Data line' }
    ];
    
    readonly options: DecoderOption[] = [
        { id: 'threshold', desc: 'Threshold voltage', default: '1.4V', values: ['1.2V', '1.4V', '1.8V', '3.3V'] }
    ];
    
    readonly annotations: string[][] = [
        ['bit', 'Bit', 'B'],
        ['byte', 'Byte', 'BY']
    ];
    
    decode(sampleRate: number, channels: AnalyzerChannel[], options: DecoderOptionValue[]): DecoderResult[] {
        return [{
            startSample: 0,
            endSample: 10,
            annotationType: 'bit',
            values: ['Test bit'],
            rawData: 1
        }];
    }
}

class TestComplexDecoder extends DecoderBase {
    readonly id = 'test-complex';
    readonly name = 'Complex Test';
    readonly longname = 'Complex Test Decoder';
    readonly desc = 'A complex decoder for testing';
    readonly license = 'gplv3+';
    readonly inputs = ['logic'];
    readonly outputs = ['complex'];
    
    readonly channels: DecoderChannel[] = [
        { id: 'clk', name: 'CLK', desc: 'Clock signal' },
        { id: 'data', name: 'DATA', desc: 'Data signal' },
        { id: 'enable', name: 'EN', desc: 'Enable signal', optional: true }
    ];
    
    readonly options: DecoderOption[] = [
        { id: 'bitorder', desc: 'Bit order', default: 'msb-first', values: ['msb-first', 'lsb-first'] },
        { id: 'wordsize', desc: 'Word size', default: 8, values: [4, 8, 16, 32] }
    ];
    
    readonly annotations: string[][] = [
        ['start', 'Start', 'S'],
        ['data', 'Data', 'D'],
        ['stop', 'Stop', 'P']
    ];
    
    decode(sampleRate: number, channels: AnalyzerChannel[], options: DecoderOptionValue[]): DecoderResult[] {
        return [{
            startSample: 0,
            endSample: 20,
            annotationType: 'data',
            values: ['Complex data'],
            rawData: 0xAB
        }];
    }
}

describe('DecoderManager', () => {
    let manager: DecoderManager;
    
    beforeEach(() => {
        manager = new DecoderManager();
    });
    
    describe('解码器注册和管理', () => {
        test('应该能注册新的解码器', () => {
            const initialCount = manager.getAvailableDecoders().length;
            
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            
            const decoders = manager.getAvailableDecoders();
            expect(decoders.length).toBe(initialCount + 1);
            
            const testDecoder = decoders.find(d => d.id === 'test-simple');
            expect(testDecoder).toBeDefined();
            expect(testDecoder!.name).toBe('Simple Test');
        });
        
        test('应该能注册多个解码器', () => {
            const initialCount = manager.getAvailableDecoders().length;
            
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            manager.registerDecoder('test-complex', TestComplexDecoder);
            
            const decoders = manager.getAvailableDecoders();
            expect(decoders.length).toBe(initialCount + 2);
            
            const simpleDecoder = decoders.find(d => d.id === 'test-simple');
            const complexDecoder = decoders.find(d => d.id === 'test-complex');
            
            expect(simpleDecoder).toBeDefined();
            expect(complexDecoder).toBeDefined();
        });
        
        test('重复注册应该覆盖原有解码器', () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            const initialCount = manager.getAvailableDecoders().length;
            
            // 重复注册
            manager.registerDecoder('test-simple', TestComplexDecoder);
            
            const decoders = manager.getAvailableDecoders();
            expect(decoders.length).toBe(initialCount); // 数量不变
            
            const decoder = decoders.find(d => d.id === 'test-simple');
            expect(decoder).toBeDefined();
            expect(decoder!.name).toBe('Complex Test'); // 被覆盖
        });
        
        test('应该有内置的I2C/SPI/UART解码器', () => {
            const decoders = manager.getAvailableDecoders();
            
            const i2cDecoder = decoders.find(d => d.id === 'i2c');
            const spiDecoder = decoders.find(d => d.id === 'spi');
            const uartDecoder = decoders.find(d => d.id === 'uart');
            
            expect(i2cDecoder).toBeDefined();
            expect(spiDecoder).toBeDefined();
            expect(uartDecoder).toBeDefined();
        });
    });
    
    describe('解码器创建和实例化', () => {
        test('createDecoder应该能创建已注册的解码器', () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            
            const decoder = manager.createDecoder('test-simple');
            
            expect(decoder).toBeInstanceOf(TestSimpleDecoder);
            expect(decoder.id).toBe('test-simple');
            expect(decoder.name).toBe('Simple Test');
        });
        
        test('创建不存在的解码器应该抛出异常', () => {
            expect(() => {
                manager.createDecoder('non-existent-decoder');
            }).toThrow('Unknown decoder: non-existent-decoder');
        });
        
        test('每次创建应该返回新的实例', () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            
            const decoder1 = manager.createDecoder('test-simple');
            const decoder2 = manager.createDecoder('test-simple');
            
            expect(decoder1).not.toBe(decoder2); // 不同实例
            expect(decoder1.id).toBe(decoder2.id); // 相同类型
        });
        
        test('应该能创建内置解码器', () => {
            const i2cDecoder = manager.createDecoder('i2c');
            const spiDecoder = manager.createDecoder('spi');
            const uartDecoder = manager.createDecoder('uart');
            
            expect(i2cDecoder).toBeInstanceOf(I2CDecoder);
            expect(spiDecoder).toBeInstanceOf(SPIDecoder);
            expect(uartDecoder).toBeInstanceOf(UARTDecoder);
        });
    });
    
    describe('解码器信息查询', () => {
        test('getAvailableDecoders应该返回所有解码器信息', () => {
            const decoders = manager.getAvailableDecoders();
            
            expect(Array.isArray(decoders)).toBe(true);
            expect(decoders.length).toBeGreaterThan(0); // 至少有内置解码器
            
            decoders.forEach(decoder => {
                expect(decoder.id).toBeDefined();
                expect(decoder.name).toBeDefined();
                expect(decoder.description).toBeDefined();
                expect(Array.isArray(decoder.channels)).toBe(true);
                expect(Array.isArray(decoder.options)).toBe(true);
            });
        });
        
        test('getDecoderInfo应该返回特定解码器的详细信息', () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            
            const info = manager.getDecoderInfo('test-simple');
            
            expect(info).toBeDefined();
            expect(info!.id).toBe('test-simple');
            expect(info!.name).toBe('Simple Test');
            expect(info!.description).toBe('A simple decoder for testing');
            expect(info!.channels.length).toBe(1);
            expect(info!.options.length).toBe(1);
        });
        
        test('查询不存在的解码器应该返回undefined', () => {
            const info = manager.getDecoderInfo('non-existent');
            expect(info).toBeUndefined();
        });
        
        test('解码器信息应该包含完整的通道和选项信息', () => {
            manager.registerDecoder('test-complex', TestComplexDecoder);
            
            const info = manager.getDecoderInfo('test-complex');
            
            expect(info).toBeDefined();
            expect(info!.channels.length).toBe(3);
            expect(info!.channels[0].id).toBe('clk');
            expect(info!.channels[0].name).toBe('CLK');
            expect(info!.channels[2].optional).toBe(true);
            
            expect(info!.options.length).toBe(2);
            expect(info!.options[0].id).toBe('bitorder');
            expect(info!.options[1].id).toBe('wordsize');
        });
    });
    
    describe('解码器搜索和过滤', () => {
        beforeEach(() => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            manager.registerDecoder('test-complex', TestComplexDecoder);
        });
        
        test('searchDecoders应该能按名称搜索', () => {
            const results = manager.searchDecoders('Simple');
            
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('test-simple');
            expect(results[0].name).toBe('Simple Test');
        });
        
        test('搜索应该不区分大小写', () => {
            const results = manager.searchDecoders('simple');
            
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('test-simple');
        });
        
        test('搜索应该匹配描述信息', () => {
            const results = manager.searchDecoders('complex decoder');
            
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('test-complex');
        });
        
        test('搜索应该匹配ID', () => {
            const results = manager.searchDecoders('test-complex');
            
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('test-complex');
        });
        
        test('空搜索应该返回所有解码器', () => {
            const allDecoders = manager.getAvailableDecoders();
            const searchResults = manager.searchDecoders('');
            
            expect(searchResults.length).toBe(allDecoders.length);
        });
        
        test('没有匹配的搜索应该返回空数组', () => {
            const results = manager.searchDecoders('non-existent-protocol');
            expect(results.length).toBe(0);
        });
    });
    
    describe('解码器分类和标签', () => {
        test('getDecodersByCategory应该能按类别返回解码器', () => {
            const serialDecoders = manager.getDecodersByCategory('serial');
            const busDecoders = manager.getDecodersByCategory('bus');
            
            expect(Array.isArray(serialDecoders)).toBe(true);
            expect(Array.isArray(busDecoders)).toBe(true);
            
            // UART是串行协议
            const uartInSerial = serialDecoders.find(d => d.id === 'uart');
            expect(uartInSerial).toBeDefined();
            
            // I2C和SPI是总线协议
            const i2cInBus = busDecoders.find(d => d.id === 'i2c');
            const spiInBus = busDecoders.find(d => d.id === 'spi');
            expect(i2cInBus).toBeDefined();
            expect(spiInBus).toBeDefined();
        });
        
        test('getSupportedCategories应该返回所有支持的类别', () => {
            const categories = manager.getSupportedCategories();
            
            expect(Array.isArray(categories)).toBe(true);
            expect(categories.length).toBeGreaterThan(0);
            expect(categories).toContain('serial');
            expect(categories).toContain('bus');
        });
        
        test('getDecoderTags应该返回解码器的标签', () => {
            const i2cTags = manager.getDecoderTags('i2c');
            const spiTags = manager.getDecoderTags('spi');
            
            expect(Array.isArray(i2cTags)).toBe(true);
            expect(Array.isArray(spiTags)).toBe(true);
            
            expect(i2cTags).toContain('bus');
            expect(i2cTags).toContain('serial');
            expect(spiTags).toContain('bus');
            expect(spiTags).toContain('synchronous');
        });
    });
    
    describe('解码器执行和管理', () => {
        let channels: AnalyzerChannel[];
        
        beforeEach(() => {
            const clkChannel = new AnalyzerChannel(0, 'CLK');
            clkChannel.samples = new Uint8Array([0, 1, 0, 1, 0, 1]);
            
            const dataChannel = new AnalyzerChannel(1, 'DATA');
            dataChannel.samples = new Uint8Array([1, 1, 0, 0, 1, 1]);
            
            channels = [clkChannel, dataChannel];
        });
        
        test('executeDecoder应该能执行解码器并返回结果', async () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            
            const options: DecoderOptionValue[] = [
                { id: 'threshold', value: '3.3V' }
            ];
            
            const results = await manager.executeDecoder('test-simple', 1000000, channels, options);
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            
            const firstResult = results[0];
            expect(firstResult.annotationType).toBe('bit');
            expect(firstResult.values).toEqual(['Test bit']);
            expect(firstResult.rawData).toBe(1);
        });
        
        test('应该能并行执行多个解码器', async () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            manager.registerDecoder('test-complex', TestComplexDecoder);
            
            const simplePromise = manager.executeDecoder('test-simple', 1000000, channels, []);
            const complexPromise = manager.executeDecoder('test-complex', 1000000, channels, []);
            
            const [simpleResults, complexResults] = await Promise.all([simplePromise, complexPromise]);
            
            expect(simpleResults.length).toBeGreaterThan(0);
            expect(complexResults.length).toBeGreaterThan(0);
            expect(simpleResults[0].annotationType).toBe('bit');
            expect(complexResults[0].annotationType).toBe('data');
        });
        
        test('执行不存在的解码器应该抛出异常', async () => {
            await expect(manager.executeDecoder('non-existent', 1000000, channels, []))
                .rejects.toThrow('Unknown decoder: non-existent');
        });
    });
    
    describe('解码器状态管理', () => {
        test('应该能跟踪活跃的解码器', () => {
            expect(manager.getActiveDecoders().length).toBe(0);
            
            // 模拟添加活跃解码器
            const decoder = manager.createDecoder('i2c');
            manager['activeDecoders'].set('session-1', decoder);
            
            expect(manager.getActiveDecoders().length).toBe(1);
            expect(manager.isDecoderActive('session-1')).toBe(true);
        });
        
        test('应该能停止特定的解码器', () => {
            const decoder = manager.createDecoder('i2c');
            manager['activeDecoders'].set('session-1', decoder);
            
            expect(manager.isDecoderActive('session-1')).toBe(true);
            
            manager.stopDecoder('session-1');
            
            expect(manager.isDecoderActive('session-1')).toBe(false);
        });
        
        test('应该能停止所有解码器', () => {
            const decoder1 = manager.createDecoder('i2c');
            const decoder2 = manager.createDecoder('spi');
            
            manager['activeDecoders'].set('session-1', decoder1);
            manager['activeDecoders'].set('session-2', decoder2);
            
            expect(manager.getActiveDecoders().length).toBe(2);
            
            manager.stopAllDecoders();
            
            expect(manager.getActiveDecoders().length).toBe(0);
        });
    });
    
    describe('性能测试', () => {
        test('大量解码器注册应该高效', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
                manager.registerDecoder(`test-${i}`, TestSimpleDecoder);
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(100);
            
            expect(manager.getAvailableDecoders().length).toBeGreaterThanOrEqual(100);
        });
        
        test('解码器搜索应该高效', () => {
            // 注册大量解码器
            for (let i = 0; i < 1000; i++) {
                manager.registerDecoder(`test-${i}`, TestSimpleDecoder);
            }
            
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
                manager.searchDecoders('test');
                manager.searchDecoders('Simple');
                manager.searchDecoders('non-existent');
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(500);
        });
        
        test('解码器创建应该快速', () => {
            manager.registerDecoder('test-simple', TestSimpleDecoder);
            
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                const decoder = manager.createDecoder('test-simple');
                expect(decoder).toBeDefined();
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(200);
        });
    });
    
    describe('错误处理和边界条件', () => {
        test('应该处理空解码器ID', () => {
            expect(() => {
                manager.registerDecoder('', TestSimpleDecoder);
            }).toThrow();
        });
        
        test('应该处理null解码器类', () => {
            expect(() => {
                manager.registerDecoder('test', null as any);
            }).toThrow();
        });
        
        test('应该处理无效的搜索参数', () => {
            const results1 = manager.searchDecoders(null as any);
            const results2 = manager.searchDecoders(undefined as any);
            
            expect(Array.isArray(results1)).toBe(true);
            expect(Array.isArray(results2)).toBe(true);
        });
        
        test('应该处理无效的类别查询', () => {
            const results = manager.getDecodersByCategory('invalid-category');
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
    });
    
    describe('内存管理', () => {
        test('解码器管理器不应导致内存泄漏', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 大量操作
            for (let i = 0; i < 100; i++) {
                manager.registerDecoder(`test-${i}`, TestSimpleDecoder);
                const decoder = manager.createDecoder(`test-${i}`);
                manager.searchDecoders(`test-${i}`);
                manager.getDecoderInfo(`test-${i}`);
            }
            
            // 清理
            manager.stopAllDecoders();
            
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
        });
    });
});