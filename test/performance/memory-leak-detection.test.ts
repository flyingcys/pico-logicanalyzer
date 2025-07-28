/**
 * 内存泄漏检测测试
 * 使用Node.js内存分析工具检测和修复内存泄漏
 */

import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { DecoderManager } from '../../src/decoders/DecoderManager';
import { CaptureSession } from '../../src/models/CaptureSession';
import { AnalyzerChannel } from '../../src/models/AnalyzerChannel';
import { TriggerType } from '../../src/models/Enums';

// Mock serialport
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => callback && callback()),
        close: jest.fn((callback) => callback && callback()),
        write: jest.fn((data, callback) => callback && callback()),
        on: jest.fn(),
        off: jest.fn(),
        isOpen: true
    }))
}));

describe('内存泄漏检测测试', () => {
    // 启用垃圾回收
    const forceGC = () => {
        if (global.gc) {
            global.gc();
        }
    };
    
    // 获取内存使用情况
    const getMemoryUsage = () => {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss
        };
    };
    
    // 等待一段时间让垃圾回收执行
    const waitForGC = () => new Promise(resolve => setTimeout(resolve, 100));
    
    describe('驱动器内存泄漏检测', () => {
        test('重复创建和销毁驱动器不应导致内存泄漏', async () => {
            const initialMemory = getMemoryUsage();
            const drivers: LogicAnalyzerDriver[] = [];
            
            // 创建多个驱动器实例
            for (let i = 0; i < 50; i++) {
                const driver = new LogicAnalyzerDriver(`/dev/ttyUSB${i}`);
                drivers.push(driver);
            }
            
            const afterCreationMemory = getMemoryUsage();
            
            // 销毁所有驱动器
            drivers.length = 0;
            
            // 强制垃圾回收
            forceGC();
            await waitForGC();
            
            const finalMemory = getMemoryUsage();
            
            // 计算内存增长
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            const creationMemory = afterCreationMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('驱动器内存测试:');
            console.log(`  初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  创建后内存: ${(afterCreationMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  最终内存: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  净增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 内存增长应该小于创建时内存的50%
            expect(memoryGrowth).toBeLessThan(creationMemory * 0.5);
        });
        
        test('重复采集操作不应导致内存泄漏', async () => {
            const driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            const initialMemory = getMemoryUsage();
            
            // 创建测试会话
            const session = new CaptureSession();
            session.frequency = 1000000;
            session.preTriggerSamples = 100;
            session.postTriggerSamples = 1000;
            session.triggerType = TriggerType.Edge;
            session.captureChannels = [
                new AnalyzerChannel(0, 'Test Channel')
            ];
            
            // 重复执行采集操作
            for (let i = 0; i < 20; i++) {
                await driver.startCapture(session);
                await driver.stopCapture();
            }
            
            // 强制垃圾回收
            forceGC();
            await waitForGC();
            
            const finalMemory = getMemoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('采集操作内存测试:');
            console.log(`  内存增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 20次采集操作的内存增长应该小于20MB
            expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);
        });
    });
    
    describe('解码器内存泄漏检测', () => {
        test('重复创建解码器不应导致内存泄漏', async () => {
            const initialMemory = getMemoryUsage();
            const decoderManager = new DecoderManager();
            
            // 重复创建和使用解码器
            for (let i = 0; i < 100; i++) {
                const decoder = decoderManager.createDecoder('i2c');
                
                // 创建测试数据
                const channels = [
                    createTestChannel(0, 'SCL', 100),
                    createTestChannel(1, 'SDA', 100)
                ];
                
                // 执行解码
                await decoderManager.executeDecoder('i2c', 1000000, channels, []);
            }
            
            // 强制垃圾回收
            forceGC();
            await waitForGC();
            
            const finalMemory = getMemoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('解码器内存测试:');
            console.log(`  内存增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 100次解码操作的内存增长应该小于50MB
            expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
        });
        
        test('大数据量解码不应导致内存爆炸', async () => {
            const decoderManager = new DecoderManager();
            const initialMemory = getMemoryUsage();
            
            // 创建大量测试数据
            const channels = [
                createTestChannel(0, 'SCL', 100000),
                createTestChannel(1, 'SDA', 100000)
            ];
            
            // 执行大数据量解码
            await decoderManager.executeDecoder('i2c', 1000000, channels, []);
            
            const afterDecodeMemory = getMemoryUsage();
            
            // 清理引用
            channels.length = 0;
            
            // 强制垃圾回收
            forceGC();
            await waitForGC();
            
            const finalMemory = getMemoryUsage();
            
            const peakMemoryGrowth = afterDecodeMemory.heapUsed - initialMemory.heapUsed;
            const finalMemoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('大数据解码内存测试:');
            console.log(`  峰值内存增长: ${(peakMemoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  最终内存增长: ${(finalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 峰值内存增长应该合理
            expect(peakMemoryGrowth).toBeLessThan(200 * 1024 * 1024); // 200MB
            
            // 清理后内存增长应该很小
            expect(finalMemoryGrowth).toBeLessThan(peakMemoryGrowth * 0.3);
        });
    });
    
    describe('数据结构内存泄漏检测', () => {
        test('大量CaptureSession创建和销毁', () => {
            const initialMemory = getMemoryUsage();
            const sessions: CaptureSession[] = [];
            
            // 创建大量会话
            for (let i = 0; i < 1000; i++) {
                const session = new CaptureSession();
                session.frequency = 1000000 + i;
                session.preTriggerSamples = 1000;
                session.postTriggerSamples = 10000;
                
                // 添加通道
                for (let j = 0; j < 8; j++) {
                    const channel = new AnalyzerChannel(j, `Channel ${j}`);
                    channel.samples = new Uint8Array(1000).fill(i % 256);
                    session.captureChannels.push(channel);
                }
                
                sessions.push(session);
            }
            
            const afterCreationMemory = getMemoryUsage();
            
            // 清理所有会话
            sessions.length = 0;
            
            // 强制垃圾回收
            forceGC();
            
            const finalMemory = getMemoryUsage();
            
            const creationGrowth = afterCreationMemory.heapUsed - initialMemory.heapUsed;
            const finalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('CaptureSession内存测试:');
            console.log(`  创建增长: ${(creationGrowth / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  最终增长: ${(finalGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 清理后内存增长应该小于创建时的20%
            expect(finalGrowth).toBeLessThan(creationGrowth * 0.2);
        });
        
        test('循环引用检测', () => {
            const initialMemory = getMemoryUsage();
            
            // 创建循环引用的对象
            const objects: any[] = [];
            for (let i = 0; i < 1000; i++) {
                const obj1 = { id: i, ref: null as any, data: new Uint8Array(1000) };
                const obj2 = { id: i + 1000, ref: null as any, data: new Uint8Array(1000) };
                
                obj1.ref = obj2;
                obj2.ref = obj1;
                
                objects.push(obj1, obj2);
            }
            
            const afterCreationMemory = getMemoryUsage();
            
            // 打破循环引用
            objects.forEach(obj => {
                if (obj.ref) {
                    obj.ref = null;
                }
            });
            
            // 清理数组
            objects.length = 0;
            
            // 强制垃圾回收
            forceGC();
            
            const finalMemory = getMemoryUsage();
            
            const creationGrowth = afterCreationMemory.heapUsed - initialMemory.heapUsed;
            const finalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('循环引用内存测试:');
            console.log(`  创建增长: ${(creationGrowth / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  最终增长: ${(finalGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 循环引用被正确清理
            expect(finalGrowth).toBeLessThan(creationGrowth * 0.3);
        });
    });
    
    describe('事件监听器内存泄漏检测', () => {
        test('事件监听器正确清理', () => {
            const initialMemory = getMemoryUsage();
            const emitters: any[] = [];
            
            // 创建大量事件发射器和监听器
            for (let i = 0; i < 100; i++) {
                const emitter = {
                    listeners: new Map(),
                    on(event: string, listener: Function) {
                        if (!this.listeners.has(event)) {
                            this.listeners.set(event, []);
                        }
                        this.listeners.get(event).push(listener);
                    },
                    off(event: string, listener: Function) {
                        if (this.listeners.has(event)) {
                            const listeners = this.listeners.get(event);
                            const index = listeners.indexOf(listener);
                            if (index !== -1) {
                                listeners.splice(index, 1);
                            }
                        }
                    },
                    removeAllListeners() {
                        this.listeners.clear();
                    }
                };
                
                // 添加大量监听器
                for (let j = 0; j < 10; j++) {
                    const listener = () => {
                        // 模拟一些工作
                        const data = new Array(100).fill(Math.random());
                        return data.reduce((a, b) => a + b, 0);
                    };
                    emitter.on(`event${j}`, listener);
                }
                
                emitters.push(emitter);
            }
            
            const afterCreationMemory = getMemoryUsage();
            
            // 清理所有监听器
            emitters.forEach(emitter => {
                emitter.removeAllListeners();
            });
            
            // 清理发射器数组
            emitters.length = 0;
            
            // 强制垃圾回收
            forceGC();
            
            const finalMemory = getMemoryUsage();
            
            const creationGrowth = afterCreationMemory.heapUsed - initialMemory.heapUsed;
            const finalGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log('事件监听器内存测试:');
            console.log(`  创建增长: ${(creationGrowth / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  最终增长: ${(finalGrowth / 1024 / 1024).toFixed(2)}MB`);
            
            // 监听器被正确清理
            expect(finalGrowth).toBeLessThan(creationGrowth * 0.3);
        });
    });
    
    describe('内存增长率监控', () => {
        test('长期运行内存增长率应该稳定', async () => {
            const decoderManager = new DecoderManager();
            const memorySnapshots: number[] = [];
            
            // 记录初始内存
            memorySnapshots.push(getMemoryUsage().heapUsed);
            
            // 模拟长期运行
            for (let cycle = 0; cycle < 20; cycle++) {
                // 执行一轮操作
                for (let i = 0; i < 10; i++) {
                    const channels = [
                        createTestChannel(0, 'SCL', 1000),
                        createTestChannel(1, 'SDA', 1000)
                    ];
                    
                    await decoderManager.executeDecoder('i2c', 1000000, channels, []);
                }
                
                // 强制垃圾回收
                if (cycle % 5 === 0) {
                    forceGC();
                    await waitForGC();
                }
                
                // 记录内存快照
                memorySnapshots.push(getMemoryUsage().heapUsed);
            }
            
            // 分析内存增长趋势
            const growthRates: number[] = [];
            for (let i = 1; i < memorySnapshots.length; i++) {
                const growth = memorySnapshots[i] - memorySnapshots[i - 1];
                growthRates.push(growth);
            }
            
            const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
            const maxGrowthRate = Math.max(...growthRates);
            
            console.log('长期内存增长监控:');
            console.log(`  平均增长率: ${(avgGrowthRate / 1024).toFixed(2)}KB/cycle`);
            console.log(`  最大增长率: ${(maxGrowthRate / 1024).toFixed(2)}KB/cycle`);
            console.log(`  总内存增长: ${((memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0]) / 1024 / 1024).toFixed(2)}MB`);
            
            // 平均增长率应该很小（接近0表示稳定）
            expect(Math.abs(avgGrowthRate)).toBeLessThan(1024 * 1024); // 1MB/cycle
            
            // 最大增长率不应该过大
            expect(maxGrowthRate).toBeLessThan(10 * 1024 * 1024); // 10MB/cycle
        });
    });
});

// 辅助函数
function createTestChannel(id: number, name: string, sampleCount: number): AnalyzerChannel {
    const channel = new AnalyzerChannel(id, name);
    const samples = new Uint8Array(sampleCount);
    
    // 生成测试数据
    for (let i = 0; i < sampleCount; i++) {
        samples[i] = Math.floor(i / 4) % 2;
    }
    
    channel.samples = samples;
    return channel;
}