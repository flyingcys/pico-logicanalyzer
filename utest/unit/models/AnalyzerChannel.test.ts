/**
 * AnalyzerChannel 单元测试
 * 测试分析器通道核心功能
 */

import { AnalyzerChannel } from '../../../src/models/CaptureModels';

describe('AnalyzerChannel', () => {
    let channel: AnalyzerChannel;
    
    describe('构造函数测试', () => {
        it('应该使用默认值创建通道', () => {
            channel = new AnalyzerChannel();
            
            expect(channel.channelNumber).toBe(0);
            expect(channel.channelName).toBe('Channel 1'); // 基于textualChannelNumber
            expect(channel.channelColor).toBeUndefined();
            expect(channel.hidden).toBe(false);
            expect(channel.samples).toBeUndefined();
        });
        
        it('应该使用提供的参数创建通道', () => {
            channel = new AnalyzerChannel(5, 'SDA');
            
            expect(channel.channelNumber).toBe(5);
            expect(channel.channelName).toBe('SDA');
            expect(channel.channelColor).toBeUndefined();
            expect(channel.hidden).toBe(false);
            expect(channel.samples).toBeUndefined();
        });
        
        it('应该在没有提供名称时使用默认名称', () => {
            channel = new AnalyzerChannel(3);
            
            expect(channel.channelNumber).toBe(3);
            expect(channel.channelName).toBe('Channel 4'); // channelNumber + 1
        });
        
        it('应该在提供空名称时使用默认名称', () => {
            channel = new AnalyzerChannel(7, '');
            
            expect(channel.channelNumber).toBe(7);
            expect(channel.channelName).toBe('Channel 8');
        });
        
        it('应该接受负通道号', () => {
            channel = new AnalyzerChannel(-1, 'Negative Channel');
            
            expect(channel.channelNumber).toBe(-1);
            expect(channel.channelName).toBe('Negative Channel');
        });
    });
    
    describe('textualChannelNumber属性测试', () => {
        it('应该为通道0返回"Channel 1"', () => {
            channel = new AnalyzerChannel(0);
            expect(channel.textualChannelNumber).toBe('Channel 1');
        });
        
        it('应该为通道23返回"Channel 24"', () => {
            channel = new AnalyzerChannel(23);
            expect(channel.textualChannelNumber).toBe('Channel 24');
        });
        
        it('应该为负通道号返回正确格式', () => {
            channel = new AnalyzerChannel(-1);
            expect(channel.textualChannelNumber).toBe('Channel 0');
        });
        
        it('应该为大通道号返回正确格式', () => {
            channel = new AnalyzerChannel(99);
            expect(channel.textualChannelNumber).toBe('Channel 100');
        });
    });
    
    describe('属性设置测试', () => {
        beforeEach(() => {
            channel = new AnalyzerChannel(5, 'Test Channel');
        });
        
        it('应该能设置通道颜色', () => {
            channel.channelColor = 0xFF0000; // 红色
            expect(channel.channelColor).toBe(0xFF0000);
        });
        
        it('应该能设置隐藏状态', () => {
            channel.hidden = true;
            expect(channel.hidden).toBe(true);
        });
        
        it('应该能修改通道名称', () => {
            channel.channelName = 'Modified Name';
            expect(channel.channelName).toBe('Modified Name');
        });
        
        it('应该能修改通道号', () => {
            channel.channelNumber = 10;
            expect(channel.channelNumber).toBe(10);
            // 注意：修改channelNumber不会自动更新channelName
            expect(channel.channelName).toBe('Test Channel');
        });
    });
    
    describe('样本数据管理', () => {
        beforeEach(() => {
            channel = new AnalyzerChannel(0, 'Data Channel');
        });
        
        it('应该能设置样本数据', () => {
            const sampleData = new Uint8Array([1, 0, 1, 1, 0, 1, 0, 0]);
            channel.samples = sampleData;
            
            expect(channel.samples).toBe(sampleData);
            expect(channel.samples?.length).toBe(8);
        });
        
        it('应该能处理空样本数据', () => {
            channel.samples = new Uint8Array([]);
            
            expect(channel.samples).toBeDefined();
            expect(channel.samples?.length).toBe(0);
        });
        
        it('应该能清除样本数据', () => {
            channel.samples = new Uint8Array([1, 0, 1, 0]);
            expect(channel.samples).toBeDefined();
            
            channel.samples = undefined;
            expect(channel.samples).toBeUndefined();
        });
        
        it('应该能处理大量样本数据', () => {
            const largeData = new Uint8Array(100000);
            for (let i = 0; i < largeData.length; i++) {
                largeData[i] = Math.random() > 0.5 ? 1 : 0;
            }
            
            channel.samples = largeData;
            expect(channel.samples?.length).toBe(100000);
        });
    });
    
    describe('toString方法测试', () => {
        it('应该返回自定义通道名称', () => {
            channel = new AnalyzerChannel(5, 'SDA Line');
            expect(channel.toString()).toBe('SDA Line');
        });
        
        it('应该在没有自定义名称时返回默认名称', () => {
            channel = new AnalyzerChannel(3);
            channel.channelName = ''; // 清空自定义名称
            expect(channel.toString()).toBe('Channel 4');
        });
        
        it('应该优先返回非空的自定义名称', () => {
            channel = new AnalyzerChannel(10, 'Custom Name');
            expect(channel.toString()).toBe('Custom Name');
        });
    });
    
    describe('克隆功能测试', () => {
        beforeEach(() => {
            channel = new AnalyzerChannel(7, 'Original Channel');
            channel.channelColor = 0x00FF00; // 绿色
            channel.hidden = true;
            channel.samples = new Uint8Array([1, 0, 1, 1, 0, 0, 1, 0]);
        });
        
        it('应该创建完整的深拷贝', () => {
            const cloned = channel.clone();
            
            expect(cloned).not.toBe(channel); // 不是同一对象
            expect(cloned.channelNumber).toBe(channel.channelNumber);
            expect(cloned.channelName).toBe(channel.channelName);
            expect(cloned.channelColor).toBe(channel.channelColor);
            expect(cloned.hidden).toBe(channel.hidden);
        });
        
        it('应该深拷贝样本数据', () => {
            const cloned = channel.clone();
            
            expect(cloned.samples).toEqual(channel.samples);
            expect(cloned.samples).not.toBe(channel.samples); // 不是同一数组对象
        });
        
        it('修改克隆对象不应影响原对象', () => {
            const cloned = channel.clone();
            
            // 修改克隆对象的属性
            cloned.channelNumber = 15;
            cloned.channelName = 'Modified Clone';
            cloned.channelColor = 0x0000FF; // 蓝色
            cloned.hidden = false;
            
            if (cloned.samples) {
                cloned.samples[0] = 0; // 修改样本数据
            }
            
            // 验证原对象未被修改
            expect(channel.channelNumber).toBe(7);
            expect(channel.channelName).toBe('Original Channel');
            expect(channel.channelColor).toBe(0x00FF00);
            expect(channel.hidden).toBe(true);
            expect(channel.samples![0]).toBe(1);
        });
        
        it('应该处理无样本数据的克隆', () => {
            channel.samples = undefined;
            
            const cloned = channel.clone();
            
            expect(cloned.samples).toBeUndefined();
            expect(cloned.channelNumber).toBe(7);
            expect(cloned.channelName).toBe('Original Channel');
        });
        
        it('应该处理空样本数组的克隆', () => {
            channel.samples = new Uint8Array([]);
            
            const cloned = channel.clone();
            
            expect(cloned.samples).toEqual(new Uint8Array([]));
            expect(cloned.samples).not.toBe(channel.samples);
        });
    });
    
    describe('边界条件测试', () => {
        it('应该处理最大通道号', () => {
            channel = new AnalyzerChannel(255);
            expect(channel.channelNumber).toBe(255);
            expect(channel.textualChannelNumber).toBe('Channel 256');
        });
        
        it('应该处理最小通道号', () => {
            channel = new AnalyzerChannel(0);
            expect(channel.channelNumber).toBe(0);
            expect(channel.textualChannelNumber).toBe('Channel 1');
        });
        
        it('应该处理极长的通道名称', () => {
            const longName = 'A'.repeat(1000);
            channel = new AnalyzerChannel(5, longName);
            
            expect(channel.channelName).toBe(longName);
            expect(channel.toString()).toBe(longName);
        });
        
        it('应该处理特殊字符的通道名称', () => {
            const specialName = '通道_#5@!中文名称';
            channel = new AnalyzerChannel(5, specialName);
            
            expect(channel.channelName).toBe(specialName);
            expect(channel.toString()).toBe(specialName);
        });
        
        it('应该处理最大颜色值', () => {
            channel = new AnalyzerChannel(0);
            channel.channelColor = 0xFFFFFFFF;
            
            expect(channel.channelColor).toBe(0xFFFFFFFF);
        });
    });
    
    describe('性能测试', () => {
        it('大量通道创建应该高效', () => {
            const startTime = Date.now();
            const channels: AnalyzerChannel[] = [];
            
            for (let i = 0; i < 1000; i++) {
                channels.push(new AnalyzerChannel(i, `Channel ${i + 1}`));
            }
            
            const endTime = Date.now();
            
            expect(channels.length).toBe(1000);
            expect(endTime - startTime).toBeLessThan(100); // 1000个通道在100ms内创建
        });
        
        it('克隆操作应该高效', () => {
            channel = new AnalyzerChannel(0, 'Performance Test');
            channel.samples = new Uint8Array(10000).fill(1);
            
            const startTime = Date.now();
            
            for (let i = 0; i < 100; i++) {
                channel.clone();
            }
            
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(500); // 100次克隆在500ms内完成
        });
        
        it('toString调用应该高效', () => {
            channel = new AnalyzerChannel(5, 'Performance Channel');
            
            const startTime = Date.now();
            
            for (let i = 0; i < 10000; i++) {
                channel.toString();
            }
            
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(50); // 10000次toString在50ms内完成
        });
    });
    
    describe('兼容性验证', () => {
        it('应该与C# AnalyzerChannel兼容', () => {
            // 验证默认值与C#版本一致
            channel = new AnalyzerChannel();
            
            expect(channel.channelNumber).toBe(0);
            expect(channel.channelName).toBe('Channel 1');
            expect(channel.channelColor).toBeUndefined(); // C#中的uint?
            expect(channel.hidden).toBe(false);
            expect(channel.samples).toBeUndefined(); // C#中的byte[]
        });
        
        it('textualChannelNumber应该与C#版本一致', () => {
            const testCases = [
                { input: 0, expected: 'Channel 1' },
                { input: 1, expected: 'Channel 2' },
                { input: 23, expected: 'Channel 24' },
                { input: 99, expected: 'Channel 100' }
            ];
            
            testCases.forEach(({ input, expected }) => {
                channel = new AnalyzerChannel(input);
                expect(channel.textualChannelNumber).toBe(expected);
            });
        });
        
        it('clone应该与C#版本行为一致', () => {
            // 创建包含所有属性的复杂通道
            channel = new AnalyzerChannel(15, 'Complex Channel');
            channel.channelColor = 0xABCDEF;
            channel.hidden = true;
            channel.samples = new Uint8Array([0, 1, 0, 1, 1, 0]);
            
            const cloned = channel.clone();
            
            // 验证所有属性都被正确复制
            expect(cloned.channelNumber).toBe(15);
            expect(cloned.channelName).toBe('Complex Channel');
            expect(cloned.channelColor).toBe(0xABCDEF);
            expect(cloned.hidden).toBe(true);
            expect(cloned.samples).toEqual(new Uint8Array([0, 1, 0, 1, 1, 0]));
            
            // 验证是深拷贝
            expect(cloned).not.toBe(channel);
            expect(cloned.samples).not.toBe(channel.samples);
        });
        
        it('toString应该与C#版本行为一致', () => {
            // 测试有自定义名称的情况
            channel = new AnalyzerChannel(5, 'Custom Name');
            expect(channel.toString()).toBe('Custom Name');
            
            // 测试没有自定义名称的情况
            channel = new AnalyzerChannel(5, '');
            expect(channel.toString()).toBe('Channel 6');
        });
    });
});