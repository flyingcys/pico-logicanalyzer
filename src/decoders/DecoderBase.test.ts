/**
 * DecoderBase 单元测试
 * 基于原版Python解码器API的TypeScript实现测试
 */

import { DecoderBase } from './DecoderBase';
import { AnalyzerChannel } from '../models/AnalyzerChannel';
import { DecoderChannel, DecoderOption, DecoderOptionValue, DecoderResult, WaitCondition, WaitResult } from './types';

// 创建测试用的具体解码器实现
class TestDecoder extends DecoderBase {
    readonly id = 'test-decoder';
    readonly name = 'Test Decoder';
    readonly longname = 'Test Protocol Decoder';
    readonly desc = 'A test decoder for unit testing';
    readonly license = 'gplv2+';
    readonly inputs = ['logic'];
    readonly outputs = ['test'];
    
    readonly channels: DecoderChannel[] = [
        { id: 'clk', name: 'CLK', desc: 'Clock signal' },
        { id: 'data', name: 'DATA', desc: 'Data signal' }
    ];
    
    readonly options: DecoderOption[] = [
        { id: 'bitorder', desc: 'Bit order', default: 'msb-first', values: ['msb-first', 'lsb-first'] }
    ];
    
    readonly annotations: string[][] = [
        ['start', 'Start', 'S'],
        ['data', 'Data', 'D'],
        ['stop', 'Stop', 'P']
    ];
    
    decode(sampleRate: number, channels: AnalyzerChannel[], options: DecoderOptionValue[]): DecoderResult[] {
        this.sampleRate = sampleRate;
        this.channelData = channels.map(ch => ch.samples || new Uint8Array());
        this.results = [];
        this.sampleIndex = 0;
        
        // 简单的测试解码逻辑
        if (this.channelData.length >= 2 && this.channelData[0].length > 0) {
            try {
                // 等待时钟上升沿
                const clockRise = this.wait({ 0: 'rising' });
                
                // 读取数据位
                const dataBit = clockRise.pins[1];
                
                // 输出解码结果
                this.put(clockRise.sampleNumber, clockRise.sampleNumber + 1, {
                    type: 'data',
                    values: [`Data: ${dataBit}`],
                    rawData: dataBit
                });
                
            } catch (error) {
                // 忽略"无更多样本"错误
            }
        }
        
        return this.results;
    }
}

describe('DecoderBase', () => {
    let decoder: TestDecoder;
    let channels: AnalyzerChannel[];
    
    beforeEach(() => {
        decoder = new TestDecoder();
        
        // 创建测试通道数据
        const clkChannel = new AnalyzerChannel(0, 'CLK');
        clkChannel.samples = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]); // 时钟信号
        
        const dataChannel = new AnalyzerChannel(1, 'DATA');
        dataChannel.samples = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]); // 数据信号
        
        channels = [clkChannel, dataChannel];
    });
    
    describe('基础属性测试', () => {
        test('应该有正确的元数据', () => {
            expect(decoder.id).toBe('test-decoder');
            expect(decoder.name).toBe('Test Decoder');
            expect(decoder.longname).toBe('Test Protocol Decoder');
            expect(decoder.desc).toBe('A test decoder for unit testing');
            expect(decoder.license).toBe('gplv2+');
            expect(decoder.inputs).toEqual(['logic']);
            expect(decoder.outputs).toEqual(['test']);
        });
        
        test('应该有正确的通道定义', () => {
            expect(decoder.channels).toBeDefined();
            expect(decoder.channels.length).toBe(2);
            expect(decoder.channels[0].id).toBe('clk');
            expect(decoder.channels[0].name).toBe('CLK');
            expect(decoder.channels[1].id).toBe('data');
            expect(decoder.channels[1].name).toBe('DATA');
        });
        
        test('应该有正确的选项定义', () => {
            expect(decoder.options).toBeDefined();
            expect(decoder.options.length).toBe(1);
            expect(decoder.options[0].id).toBe('bitorder');
            expect(decoder.options[0].default).toBe('msb-first');
            expect(decoder.options[0].values).toEqual(['msb-first', 'lsb-first']);
        });
        
        test('应该有正确的注释定义', () => {
            expect(decoder.annotations).toBeDefined();
            expect(decoder.annotations.length).toBe(3);
            expect(decoder.annotations[0]).toEqual(['start', 'Start', 'S']);
            expect(decoder.annotations[1]).toEqual(['data', 'Data', 'D']);
            expect(decoder.annotations[2]).toEqual(['stop', 'Stop', 'P']);
        });
    });
    
    describe('wait方法测试', () => {
        test('应该能等待上升沿', () => {
            decoder['sampleRate'] = 1000000;
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 0;
            decoder['results'] = [];
            
            const result = decoder['wait']({ 0: 'rising' });
            
            expect(result).toBeDefined();
            expect(result.sampleNumber).toBe(1); // 第一个上升沿在索引1
            expect(result.pins).toEqual([1, 1]); // 在上升沿时刻的引脚状态
        });
        
        test('应该能等待下降沿', () => {
            decoder['sampleRate'] = 1000000;
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 0;
            decoder['results'] = [];
            
            const result = decoder['wait']({ 0: 'falling' });
            
            expect(result).toBeDefined();
            expect(result.sampleNumber).toBe(2); // 第一个下降沿在索引2
            expect(result.pins).toEqual([0, 0]);
        });
        
        test('应该能等待高电平', () => {
            decoder['sampleRate'] = 1000000;
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 0;
            decoder['results'] = [];
            
            const result = decoder['wait']({ 0: 'high' });
            
            expect(result).toBeDefined();
            expect(result.sampleNumber).toBe(1); // 第一个高电平在索引1
            expect(result.pins).toEqual([1, 1]);
        });
        
        test('应该能等待低电平', () => {
            decoder['sampleRate'] = 1000000;
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 1; // 从索引1开始
            decoder['results'] = [];
            
            const result = decoder['wait']({ 0: 'low' });
            
            expect(result).toBeDefined();
            expect(result.sampleNumber).toBe(2); // 下一个低电平在索引2
            expect(result.pins).toEqual([0, 0]);
        });
        
        test('应该能等待多通道条件', () => {
            decoder['sampleRate'] = 1000000;
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 0;
            decoder['results'] = [];
            
            // 等待CLK高电平且DATA高电平
            const result = decoder['wait']({ 0: 'high', 1: 'high' });
            
            expect(result).toBeDefined();
            expect(result.sampleNumber).toBe(1);
            expect(result.pins).toEqual([1, 1]);
        });
        
        test('应该在没有更多样本时抛出异常', () => {
            decoder['sampleRate'] = 1000000;
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 100; // 超出样本范围
            decoder['results'] = [];
            
            expect(() => {
                decoder['wait']({ 0: 'rising' });
            }).toThrow('End of samples reached');
        });
    });
    
    describe('put方法测试', () => {
        test('应该能正确输出解码结果', () => {
            decoder['results'] = [];
            
            decoder['put'](10, 20, {
                type: 'data',
                values: ['Test Data'],
                rawData: 0xAB
            });
            
            expect(decoder['results'].length).toBe(1);
            expect(decoder['results'][0].startSample).toBe(10);
            expect(decoder['results'][0].endSample).toBe(20);
            expect(decoder['results'][0].annotationType).toBe('data');
            expect(decoder['results'][0].values).toEqual(['Test Data']);
            expect(decoder['results'][0].rawData).toBe(0xAB);
        });
        
        test('应该能输出多个解码结果', () => {
            decoder['results'] = [];
            
            decoder['put'](0, 5, {
                type: 'start',
                values: ['Start'],
                rawData: null
            });
            
            decoder['put'](5, 15, {
                type: 'data',
                values: ['Data: 0x42'],
                rawData: 0x42
            });
            
            decoder['put'](15, 20, {
                type: 'stop',
                values: ['Stop'],
                rawData: null
            });
            
            expect(decoder['results'].length).toBe(3);
            expect(decoder['results'][0].annotationType).toBe('start');
            expect(decoder['results'][1].annotationType).toBe('data');
            expect(decoder['results'][2].annotationType).toBe('stop');
        });
    });
    
    describe('辅助方法测试', () => {
        test('hasMoreSamples应该正确判断是否有更多样本', () => {
            decoder['channelData'] = channels.map(ch => ch.samples!);
            decoder['sampleIndex'] = 0;
            
            expect(decoder['hasMoreSamples']()).toBe(true);
            
            decoder['sampleIndex'] = 7;
            expect(decoder['hasMoreSamples']()).toBe(true);
            
            decoder['sampleIndex'] = 8;
            expect(decoder['hasMoreSamples']()).toBe(false);
        });
        
        test('getCurrentPins应该返回当前样本的引脚状态', () => {
            decoder['channelData'] = channels.map(ch => ch.samples!);
            
            decoder['sampleIndex'] = 0;
            expect(decoder['getCurrentPins']()).toEqual([0, 1]);
            
            decoder['sampleIndex'] = 1;
            expect(decoder['getCurrentPins']()).toEqual([1, 1]);
            
            decoder['sampleIndex'] = 2;
            expect(decoder['getCurrentPins']()).toEqual([0, 0]);
        });
    });
    
    describe('decode方法测试', () => {
        test('应该能完成完整的解码流程', () => {
            const sampleRate = 1000000;
            const options: DecoderOptionValue[] = [
                { id: 'bitorder', value: 'msb-first' }
            ];
            
            const results = decoder.decode(sampleRate, channels, options);
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            
            // 验证第一个结果
            const firstResult = results[0];
            expect(firstResult.annotationType).toBe('data');
            expect(firstResult.values[0]).toContain('Data:');
            expect(firstResult.startSample).toBe(1);
            expect(firstResult.endSample).toBe(2);
        });
        
        test('应该正确设置内部状态', () => {
            const sampleRate = 2000000;
            const options: DecoderOptionValue[] = [];
            
            decoder.decode(sampleRate, channels, options);
            
            expect(decoder['sampleRate']).toBe(sampleRate);
            expect(decoder['channelData'].length).toBe(2);
            expect(decoder['channelData'][0]).toEqual(channels[0].samples);
            expect(decoder['channelData'][1]).toEqual(channels[1].samples);
        });
        
        test('应该处理空通道数据', () => {
            const emptyChannels: AnalyzerChannel[] = [];
            
            const results = decoder.decode(1000000, emptyChannels, []);
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
        
        test('应该处理无效样本数据', () => {
            const invalidChannels = [
                new AnalyzerChannel(0, 'CLK'),
                new AnalyzerChannel(1, 'DATA')
            ];
            // 不设置samples数据
            
            const results = decoder.decode(1000000, invalidChannels, []);
            
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
    });
    
    describe('条件匹配测试', () => {
        test('matchesCondition应该正确匹配各种条件', () => {
            // 测试数据: 从低到高
            const currentPins = [1, 0];
            const previousPins = [0, 1];
            
            // 模拟内部状态
            decoder['previousPins'] = previousPins;
            
            // 测试高电平匹配
            expect(decoder['matchesCondition'](currentPins, { 0: 'high' })).toBe(true);
            expect(decoder['matchesCondition'](currentPins, { 1: 'high' })).toBe(false);
            
            // 测试低电平匹配
            expect(decoder['matchesCondition'](currentPins, { 0: 'low' })).toBe(false);
            expect(decoder['matchesCondition'](currentPins, { 1: 'low' })).toBe(true);
            
            // 测试上升沿匹配
            expect(decoder['matchesCondition'](currentPins, { 0: 'rising' })).toBe(true);
            expect(decoder['matchesCondition'](currentPins, { 1: 'rising' })).toBe(false);
            
            // 测试下降沿匹配
            expect(decoder['matchesCondition'](currentPins, { 0: 'falling' })).toBe(false);
            expect(decoder['matchesCondition'](currentPins, { 1: 'falling' })).toBe(true);
        });
        
        test('应该正确处理复合条件', () => {
            const currentPins = [1, 1];
            const previousPins = [0, 0];
            
            decoder['previousPins'] = previousPins;
            
            // 两个通道都是上升沿
            expect(decoder['matchesCondition'](currentPins, { 0: 'rising', 1: 'rising' })).toBe(true);
            
            // 混合条件
            expect(decoder['matchesCondition'](currentPins, { 0: 'high', 1: 'rising' })).toBe(true);
            expect(decoder['matchesCondition'](currentPins, { 0: 'low', 1: 'rising' })).toBe(false);
        });
    });
    
    describe('性能测试', () => {
        test('大数据量解码应该高效', () => {
            // 创建大量样本数据
            const largeClkData = new Uint8Array(10000);
            const largeDataData = new Uint8Array(10000);
            
            for (let i = 0; i < 10000; i++) {
                largeClkData[i] = i % 2; // 交替的时钟信号
                largeDataData[i] = Math.floor(i / 2) % 2; // 较慢变化的数据
            }
            
            const largeChannels = [
                new AnalyzerChannel(0, 'CLK'),
                new AnalyzerChannel(1, 'DATA')
            ];
            largeChannels[0].samples = largeClkData;
            largeChannels[1].samples = largeDataData;
            
            const startTime = Date.now();
            const results = decoder.decode(1000000, largeChannels, []);
            const endTime = Date.now();
            
            expect(results).toBeDefined();
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });
        
        test('频繁的条件检查应该高效', () => {
            const pins = [1, 0, 1, 1];
            decoder['previousPins'] = [0, 1, 0, 0];
            
            const startTime = Date.now();
            
            for (let i = 0; i < 10000; i++) {
                decoder['matchesCondition'](pins, { 0: 'rising', 1: 'falling', 2: 'high', 3: 'low' });
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
        });
    });
    
    describe('边界条件测试', () => {
        test('应该处理单样本数据', () => {
            const singleSampleChannels = [
                new AnalyzerChannel(0, 'CLK'),
                new AnalyzerChannel(1, 'DATA')
            ];
            singleSampleChannels[0].samples = new Uint8Array([1]);
            singleSampleChannels[1].samples = new Uint8Array([0]);
            
            const results = decoder.decode(1000000, singleSampleChannels, []);
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
        
        test('应该处理全零数据', () => {
            const zeroChannels = [
                new AnalyzerChannel(0, 'CLK'),
                new AnalyzerChannel(1, 'DATA')
            ];
            zeroChannels[0].samples = new Uint8Array(100).fill(0);
            zeroChannels[1].samples = new Uint8Array(100).fill(0);
            
            const results = decoder.decode(1000000, zeroChannels, []);
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
        
        test('应该处理全一数据', () => {
            const oneChannels = [
                new AnalyzerChannel(0, 'CLK'),
                new AnalyzerChannel(1, 'DATA')
            ];
            oneChannels[0].samples = new Uint8Array(100).fill(1);
            oneChannels[1].samples = new Uint8Array(100).fill(1);
            
            const results = decoder.decode(1000000, oneChannels, []);
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
    });
});