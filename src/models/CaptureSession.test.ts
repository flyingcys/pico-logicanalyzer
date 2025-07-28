/**
 * CaptureSession 单元测试
 * 基于原版C# CaptureSession的功能测试
 */

import { CaptureSession } from './CaptureSession';
import { AnalyzerChannel } from './AnalyzerChannel';
import { BurstInfo } from './BurstInfo';
import { TriggerType } from './Enums';

describe('CaptureSession', () => {
    let session: CaptureSession;
    
    beforeEach(() => {
        session = new CaptureSession();
    });
    
    describe('基础属性测试', () => {
        test('应该有正确的默认值', () => {
            expect(session.frequency).toBe(24000000); // 24MHz默认
            expect(session.preTriggerSamples).toBe(1000);
            expect(session.postTriggerSamples).toBe(10000);
            expect(session.triggerType).toBe(TriggerType.Edge);
            expect(session.triggerChannel).toBe(0);
            expect(session.triggerInverted).toBe(false);
            expect(session.triggerPattern).toBe(0);
            expect(session.triggerBitCount).toBe(1);
            expect(session.loopCount).toBe(0);
            expect(session.measureBursts).toBe(false);
            expect(Array.isArray(session.captureChannels)).toBe(true);
            expect(session.captureChannels.length).toBe(0);
        });
        
        test('totalSamples应该正确计算', () => {
            session.preTriggerSamples = 1000;
            session.postTriggerSamples = 10000;
            session.loopCount = 0;
            
            // 基于原版公式: preTriggerSamples + postTriggerSamples * (loopCount + 1)
            const expectedTotal = 1000 + 10000 * (0 + 1);
            expect(session.totalSamples).toBe(expectedTotal);
        });
        
        test('totalSamples应该在有loopCount时正确计算', () => {
            session.preTriggerSamples = 1000;
            session.postTriggerSamples = 5000;
            session.loopCount = 3;
            
            const expectedTotal = 1000 + 5000 * (3 + 1); // 1000 + 20000 = 21000
            expect(session.totalSamples).toBe(expectedTotal);
        });
    });
    
    describe('参数设置和验证', () => {
        test('应该能正确设置采样频率', () => {
            const frequencies = [1000000, 24000000, 100000000];
            
            frequencies.forEach(freq => {
                session.frequency = freq;
                expect(session.frequency).toBe(freq);
            });
        });
        
        test('应该能正确设置触发参数', () => {
            session.triggerType = TriggerType.Complex;
            session.triggerChannel = 5;
            session.triggerInverted = true;
            session.triggerPattern = 0xABCD;
            session.triggerBitCount = 16;
            
            expect(session.triggerType).toBe(TriggerType.Complex);
            expect(session.triggerChannel).toBe(5);
            expect(session.triggerInverted).toBe(true);
            expect(session.triggerPattern).toBe(0xABCD);
            expect(session.triggerBitCount).toBe(16);
        });
        
        test('应该能正确设置突发采集参数', () => {
            session.loopCount = 10;
            session.measureBursts = true;
            
            expect(session.loopCount).toBe(10);
            expect(session.measureBursts).toBe(true);
        });
        
        test('触发通道应该在有效范围内', () => {
            // 测试边界值
            session.triggerChannel = 0;
            expect(session.triggerChannel).toBe(0);
            
            session.triggerChannel = 23;
            expect(session.triggerChannel).toBe(23);
        });
        
        test('loopCount应该在有效范围内', () => {
            // 基于原版: loopCount范围0-255
            session.loopCount = 0;
            expect(session.loopCount).toBe(0);
            
            session.loopCount = 255;
            expect(session.loopCount).toBe(255);
        });
    });
    
    describe('通道管理', () => {
        test('应该能添加和管理通道', () => {
            const channel1 = new AnalyzerChannel(0, 'Channel 1');
            const channel2 = new AnalyzerChannel(1, 'Channel 2');
            
            session.captureChannels = [channel1, channel2];
            
            expect(session.captureChannels.length).toBe(2);
            expect(session.captureChannels[0]).toBe(channel1);
            expect(session.captureChannels[1]).toBe(channel2);
        });
        
        test('应该能处理空通道列表', () => {
            session.captureChannels = [];
            expect(session.captureChannels.length).toBe(0);
            expect(Array.isArray(session.captureChannels)).toBe(true);
        });
        
        test('应该能添加大量通道', () => {
            const channels = Array.from({length: 24}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            
            session.captureChannels = channels;
            expect(session.captureChannels.length).toBe(24);
        });
    });
    
    describe('突发信息管理', () => {
        test('应该能正确设置突发信息', () => {
            const burst1 = new BurstInfo();
            burst1.burstSampleStart = 1000;
            burst1.burstSampleEnd = 2000;
            burst1.burstSampleGap = 500;
            burst1.burstTimeGap = 20833; // 纳秒
            
            const burst2 = new BurstInfo();
            burst2.burstSampleStart = 3000;
            burst2.burstSampleEnd = 4000;
            burst2.burstSampleGap = 800;
            burst2.burstTimeGap = 33333;
            
            session.bursts = [burst1, burst2];
            
            expect(session.bursts).toBeDefined();
            expect(session.bursts!.length).toBe(2);
            expect(session.bursts![0]).toBe(burst1);
            expect(session.bursts![1]).toBe(burst2);
        });
        
        test('突发信息应该可以为空', () => {
            expect(session.bursts).toBeUndefined();
            
            session.bursts = [];
            expect(session.bursts).toBeDefined();
            expect(session.bursts!.length).toBe(0);
        });
    });
    
    describe('克隆功能测试', () => {
        test('clone应该创建包含样本数据的完整副本', () => {
            // 设置原始session
            session.frequency = 50000000;
            session.preTriggerSamples = 2000;
            session.postTriggerSamples = 20000;
            session.triggerType = TriggerType.Complex;
            session.triggerChannel = 5;
            session.triggerInverted = true;
            session.loopCount = 2;
            session.measureBursts = true;
            
            const channel1 = new AnalyzerChannel(0, 'Test Channel 1');
            channel1.samples = new Uint8Array([1, 0, 1, 1, 0]);
            const channel2 = new AnalyzerChannel(1, 'Test Channel 2');
            channel2.samples = new Uint8Array([0, 1, 0, 1, 1]);
            
            session.captureChannels = [channel1, channel2];
            
            const burst = new BurstInfo();
            burst.burstSampleStart = 100;
            burst.burstSampleEnd = 200;
            session.bursts = [burst];
            
            // 执行克隆
            const cloned = session.clone();
            
            // 验证基础属性
            expect(cloned.frequency).toBe(session.frequency);
            expect(cloned.preTriggerSamples).toBe(session.preTriggerSamples);
            expect(cloned.postTriggerSamples).toBe(session.postTriggerSamples);
            expect(cloned.triggerType).toBe(session.triggerType);
            expect(cloned.triggerChannel).toBe(session.triggerChannel);
            expect(cloned.triggerInverted).toBe(session.triggerInverted);
            expect(cloned.loopCount).toBe(session.loopCount);
            expect(cloned.measureBursts).toBe(session.measureBursts);
            
            // 验证通道数据被复制
            expect(cloned.captureChannels.length).toBe(2);
            expect(cloned.captureChannels[0].channelNumber).toBe(0);
            expect(cloned.captureChannels[0].channelName).toBe('Test Channel 1');
            expect(cloned.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 1, 0]));
            
            // 验证突发信息被复制
            expect(cloned.bursts).toBeDefined();
            expect(cloned.bursts!.length).toBe(1);
            expect(cloned.bursts![0].burstSampleStart).toBe(100);
            
            // 验证是深拷贝，不是引用
            expect(cloned).not.toBe(session);
            expect(cloned.captureChannels).not.toBe(session.captureChannels);
            expect(cloned.captureChannels[0]).not.toBe(session.captureChannels[0]);
            expect(cloned.bursts).not.toBe(session.bursts);
        });
        
        test('cloneSettings应该只复制设置，不包含样本数据', () => {
            // 设置原始session
            session.frequency = 50000000;
            session.preTriggerSamples = 2000;
            session.postTriggerSamples = 20000;
            session.triggerType = TriggerType.Fast;
            session.triggerChannel = 3;
            session.loopCount = 1;
            
            const channel1 = new AnalyzerChannel(0, 'Test Channel 1');
            channel1.samples = new Uint8Array([1, 0, 1, 1, 0]);
            const channel2 = new AnalyzerChannel(1, 'Test Channel 2');
            channel2.samples = new Uint8Array([0, 1, 0, 1, 1]);
            
            session.captureChannels = [channel1, channel2];
            
            const burst = new BurstInfo();
            session.bursts = [burst];
            
            // 执行设置克隆
            const cloned = session.cloneSettings();
            
            // 验证基础设置被复制
            expect(cloned.frequency).toBe(session.frequency);
            expect(cloned.preTriggerSamples).toBe(session.preTriggerSamples);
            expect(cloned.postTriggerSamples).toBe(session.postTriggerSamples);
            expect(cloned.triggerType).toBe(session.triggerType);
            expect(cloned.triggerChannel).toBe(session.triggerChannel);
            expect(cloned.loopCount).toBe(session.loopCount);
            
            // 验证通道结构被复制，但不包含样本数据
            expect(cloned.captureChannels.length).toBe(2);
            expect(cloned.captureChannels[0].channelNumber).toBe(0);
            expect(cloned.captureChannels[0].channelName).toBe('Test Channel 1');
            expect(cloned.captureChannels[0].samples).toBeUndefined(); // 样本数据不应被复制
            
            // 验证突发信息不被复制
            expect(cloned.bursts).toBeUndefined();
            
            // 验证是深拷贝
            expect(cloned).not.toBe(session);
            expect(cloned.captureChannels).not.toBe(session.captureChannels);
        });
        
        test('克隆空session应该正常工作', () => {
            const emptySession = new CaptureSession();
            
            const cloned = emptySession.clone();
            expect(cloned).toBeDefined();
            expect(cloned.captureChannels.length).toBe(0);
            expect(cloned.bursts).toBeUndefined();
            
            const clonedSettings = emptySession.cloneSettings();
            expect(clonedSettings).toBeDefined();
            expect(clonedSettings.captureChannels.length).toBe(0);
        });
    });
    
    describe('边界条件测试', () => {
        test('应该处理极小样本数', () => {
            session.preTriggerSamples = 0;
            session.postTriggerSamples = 1;
            session.loopCount = 0;
            
            expect(session.totalSamples).toBe(1);
        });
        
        test('应该处理极大样本数', () => {
            session.preTriggerSamples = 100000;
            session.postTriggerSamples = 1000000;
            session.loopCount = 10;
            
            const expectedTotal = 100000 + 1000000 * 11;
            expect(session.totalSamples).toBe(expectedTotal);
        });
        
        test('应该处理零频率', () => {
            session.frequency = 0;
            expect(session.frequency).toBe(0);
        });
        
        test('应该处理负数触发通道', () => {
            session.triggerChannel = -1;
            expect(session.triggerChannel).toBe(-1); // 允许但在使用时应验证
        });
    });
    
    describe('性能测试', () => {
        test('totalSamples计算应该高效', () => {
            const startTime = Date.now();
            
            for (let i = 0; i < 10000; i++) {
                session.preTriggerSamples = i;
                session.postTriggerSamples = i * 2;
                session.loopCount = i % 10;
                const total = session.totalSamples;
                expect(total).toBeGreaterThan(0);
            }
            
            const endTime = Date.now();
            expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
        });
        
        test('克隆大量通道应该高效', () => {
            // 创建包含大量通道的session
            const channels = Array.from({length: 24}, (_, i) => {
                const channel = new AnalyzerChannel(i, `Channel ${i + 1}`);
                channel.samples = new Uint8Array(10000).fill(Math.random() > 0.5 ? 1 : 0);
                return channel;
            });
            
            session.captureChannels = channels;
            
            const startTime = Date.now();
            const cloned = session.clone();
            const endTime = Date.now();
            
            expect(cloned.captureChannels.length).toBe(24);
            expect(endTime - startTime).toBeLessThan(500); // 应该在500ms内完成
        });
    });
});