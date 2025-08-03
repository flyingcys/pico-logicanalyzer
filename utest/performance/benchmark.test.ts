/**
 * 性能基准测试
 * 测试波形渲染、数据处理、内存使用的性能
 */

import { WaveformRenderer } from '../../src/webview/engines/WaveformRenderer';
import { DecoderManager } from '../../src/decoders/DecoderManager';
import { AnalyzerChannel } from '../../src/models/AnalyzerChannel';
import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession } from '../../src/models/CaptureSession';
import { DataCompression } from '../../src/data/DataCompression';
import { TriggerType } from '../../src/models/Enums';

// Mock DOM elements for canvas testing
class MockCanvas {
    width = 1920;
    height = 1080;
    
    getContext(type: string) {
        if (type === '2d') {
            return new MockCanvasRenderingContext2D();
        }
        return null;
    }
}

class MockCanvasRenderingContext2D {
    fillStyle = '#000000';
    strokeStyle = '#000000';
    lineWidth = 1;
    
    beginPath() {}
    moveTo(x: number, y: number) {}
    lineTo(x: number, y: number) {}
    stroke() {}
    fill() {}
    fillRect(x: number, y: number, width: number, height: number) {}
    clearRect(x: number, y: number, width: number, height: number) {}
    save() {}
    restore() {}
    translate(x: number, y: number) {}
    scale(x: number, y: number) {}
}

// Mock browser APIs
(global as any).HTMLCanvasElement = MockCanvas;
(global as any).CanvasRenderingContext2D = MockCanvasRenderingContext2D;

describe('性能基准测试', () => {
    let performanceResults: { [key: string]: number } = {};
    
    beforeAll(() => {
        // 启用高精度时间测量
        if (typeof performance === 'undefined') {
            (global as any).performance = {
                now: () => Date.now()
            };
        }
    });
    
    afterAll(() => {
        // 输出性能测试结果
        console.log('\n=== 性能基准测试结果 ===');
        Object.entries(performanceResults).forEach(([test, time]) => {
            console.log(`${test}: ${time.toFixed(2)}ms`);
        });
        console.log('========================\n');
    });
    
    describe('波形渲染性能测试', () => {
        let canvas: MockCanvas;
        let renderer: WaveformRenderer;
        
        beforeEach(() => {
            canvas = new MockCanvas();
            renderer = new WaveformRenderer(canvas as any);
        });
        
        it('小数据集渲染性能 (1K样本)', async () => {
            const channels = createTestChannels(1000);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 100; i++) {
                await renderer.renderWaveform(channels, {
                    startSample: 0,
                    endSample: 1000,
                    pixelsPerSample: 1,
                    samplesPerPixel: 1
                });
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 100;
            
            performanceResults['小数据集渲染 (1K样本)'] = averageTime;
            expect(averageTime).toBeLessThan(5); // 5ms
        });
        
        it('中等数据集渲染性能 (100K样本)', async () => {
            const channels = createTestChannels(100000);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 10; i++) {
                await renderer.renderWaveform(channels, {
                    startSample: 0,
                    endSample: 100000,
                    pixelsPerSample: 0.01,
                    samplesPerPixel: 100
                });
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 10;
            
            performanceResults['中等数据集渲染 (100K样本)'] = averageTime;
            expect(averageTime).toBeLessThan(50); // 50ms
        });
        
        it('大数据集渲染性能 (1M样本)', async () => {
            const channels = createTestChannels(1000000);
            
            const startTime = performance.now();
            
            // 只测试一次，大数据集测试
            await renderer.renderWaveform(channels, {
                startSample: 0,
                endSample: 1000000,
                pixelsPerSample: 0.001,
                samplesPerPixel: 1000
            });
            
            const endTime = performance.now();
            const renderTime = endTime - startTime;
            
            performanceResults['大数据集渲染 (1M样本)'] = renderTime;
            expect(renderTime).toBeLessThan(200); // 200ms
        });
        
        it('多通道渲染性能 (24通道)', async () => {
            const channels = Array.from({length: 24}, (_, i) => 
                createTestChannel(i, `Channel ${i + 1}`, 10000)
            );
            
            const startTime = performance.now();
            
            for (let i = 0; i < 10; i++) {
                await renderer.renderWaveform(channels, {
                    startSample: 0,
                    endSample: 10000,
                    pixelsPerSample: 0.1,
                    samplesPerPixel: 10
                });
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 10;
            
            performanceResults['多通道渲染 (24通道)'] = averageTime;
            expect(averageTime).toBeLessThan(100); // 100ms
        });
        
        it('缩放操作性能', async () => {
            const channels = createTestChannels(100000);
            
            const zoomLevels = [1, 10, 100, 1000, 10000];
            const startTime = performance.now();
            
            for (const zoomLevel of zoomLevels) {
                for (let i = 0; i < 20; i++) {
                    await renderer.renderWaveform(channels, {
                        startSample: 0,
                        endSample: 100000 / zoomLevel,
                        pixelsPerSample: zoomLevel * 0.01,
                        samplesPerPixel: Math.max(1, 100 / zoomLevel)
                    });
                }
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / (zoomLevels.length * 20);
            
            performanceResults['缩放操作'] = averageTime;
            expect(averageTime).toBeLessThan(10); // 10ms
        });
    });
    
    describe('解码器性能测试', () => {
        let decoderManager: DecoderManager;
        
        beforeEach(() => {
            decoderManager = new DecoderManager();
        });
        
        it('I2C解码器性能 (小数据集)', async () => {
            const channels = createI2CTestData(1000);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 50; i++) {
                await decoderManager.executeDecoder('i2c', 1000000, channels, []);
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 50;
            
            performanceResults['I2C解码 (1K样本)'] = averageTime;
            expect(averageTime).toBeLessThan(10); // 10ms
        });
        
        it('I2C解码器性能 (大数据集)', async () => {
            const channels = createI2CTestData(100000);
            
            const startTime = performance.now();
            
            await decoderManager.executeDecoder('i2c', 1000000, channels, []);
            
            const endTime = performance.now();
            const decodeTime = endTime - startTime;
            
            performanceResults['I2C解码 (100K样本)'] = decodeTime;
            expect(decodeTime).toBeLessThan(500); // 500ms
        });
        
        it('SPI解码器性能', async () => {
            const channels = createSPITestData(50000);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 10; i++) {
                await decoderManager.executeDecoder('spi', 1000000, channels, [
                    { id: 'cpol', value: 0 },
                    { id: 'cpha', value: 0 }
                ]);
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 10;
            
            performanceResults['SPI解码 (50K样本)'] = averageTime;
            expect(averageTime).toBeLessThan(100); // 100ms
        });
        
        it('UART解码器性能', async () => {
            const channels = createUARTTestData(20000);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 20; i++) {
                await decoderManager.executeDecoder('uart', 1000000, channels, [
                    { id: 'baudrate', value: 9600 }
                ]);
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 20;
            
            performanceResults['UART解码 (20K样本)'] = averageTime;
            expect(averageTime).toBeLessThan(50); // 50ms
        });
        
        it('并行解码器性能', async () => {
            const i2cChannels = createI2CTestData(10000);
            const spiChannels = createSPITestData(10000);
            const uartChannels = createUARTTestData(10000);
            
            const startTime = performance.now();
            
            const promises = [
                decoderManager.executeDecoder('i2c', 1000000, i2cChannels, []),
                decoderManager.executeDecoder('spi', 1000000, spiChannels, []),
                decoderManager.executeDecoder('uart', 1000000, uartChannels, [])
            ];
            
            await Promise.all(promises);
            
            const endTime = performance.now();
            const parallelTime = endTime - startTime;
            
            performanceResults['并行解码'] = parallelTime;
            expect(parallelTime).toBeLessThan(200); // 200ms
        });
    });
    
    describe('数据处理性能测试', () => {
        it('数据压缩性能 (RLE)', async () => {
            const testData = new Uint8Array(100000);
            // 创建有重复模式的数据（适合RLE压缩）
            for (let i = 0; i < 100000; i++) {
                testData[i] = Math.floor(i / 1000) % 2;
            }
            
            const compression = new DataCompression();
            
            const startTime = performance.now();
            
            for (let i = 0; i < 10; i++) {
                const compressed = await compression.compressRLE(testData);
                const decompressed = await compression.decompressRLE(compressed);
                expect(decompressed.length).toBe(testData.length);
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 10;
            
            performanceResults['RLE压缩/解压'] = averageTime;
            expect(averageTime).toBeLessThan(50); // 50ms
        });
        
        it('数据压缩性能 (Dictionary)', async () => {
            const testData = createRepeatingPatternData(50000, 8);
            const compression = new DataCompression();
            
            const startTime = performance.now();
            
            for (let i = 0; i < 5; i++) {
                const compressed = await compression.compressDictionary(testData);
                const decompressed = await compression.decompressDictionary(compressed);
                expect(decompressed.length).toBe(testData.length);
            }
            
            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 5;
            
            performanceResults['Dictionary压缩/解压'] = averageTime;
            expect(averageTime).toBeLessThan(100); // 100ms
        });
        
        it('大数据数组操作性能', () => {
            const size = 1000000;
            const data1 = new Uint8Array(size);
            const data2 = new Uint8Array(size);
            
            // 填充测试数据
            for (let i = 0; i < size; i++) {
                data1[i] = i % 256;
                data2[i] = (i * 2) % 256;
            }
            
            const startTime = performance.now();
            
            // 数组复制操作
            const copy = new Uint8Array(data1);
            
            // 数组合并操作
            const combined = new Uint8Array(size * 2);
            combined.set(data1, 0);
            combined.set(data2, size);
            
            // 数组切片操作
            const slice1 = data1.slice(0, size / 2);
            const slice2 = data1.slice(size / 2);
            
            // 数组查找操作
            let foundCount = 0;
            for (let i = 0; i < 100; i++) {
                const searchValue = i;
                if (data1.indexOf(searchValue) !== -1) {
                    foundCount++;
                }
            }
            
            const endTime = performance.now();
            const arrayOpTime = endTime - startTime;
            
            performanceResults['大数据数组操作'] = arrayOpTime;
            expect(arrayOpTime).toBeLessThan(200); // 200ms
            expect(copy.length).toBe(size);
            expect(combined.length).toBe(size * 2);
            expect(slice1.length).toBe(size / 2);
            expect(foundCount).toBeGreaterThan(0);
        });
    });
    
    describe('内存使用性能测试', () => {
        it('内存分配和释放性能', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const allocations: Uint8Array[] = [];
            
            const startTime = performance.now();
            
            // 分配内存
            for (let i = 0; i < 100; i++) {
                const buffer = new Uint8Array(100000); // 100KB每次
                buffer.fill(i % 256);
                allocations.push(buffer);
            }
            
            const allocEndTime = performance.now();
            const allocTime = allocEndTime - startTime;
            
            // 释放内存
            const freeStartTime = performance.now();
            allocations.length = 0; // 清空引用
            
            if (global.gc) {
                global.gc(); // 强制垃圾回收
            }
            
            const freeEndTime = performance.now();
            const freeTime = freeEndTime - freeStartTime;
            
            const finalMemory = process.memoryUsage().heapUsed;
            
            performanceResults['内存分配 (100x100KB)'] = allocTime;
            performanceResults['内存释放'] = freeTime;
            
            expect(allocTime).toBeLessThan(100); // 100ms内分配完成
            
            // 内存应该基本回到初始状态（允许一些差异）
            const memoryDiff = finalMemory - initialMemory;
            expect(Math.abs(memoryDiff)).toBeLessThan(50 * 1024 * 1024); // 50MB差异
        });
        
        it('内存泄漏检测', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 模拟反复操作
            for (let cycle = 0; cycle < 10; cycle++) {
                // 创建大量临时对象
                const tempData = [];
                for (let i = 0; i < 1000; i++) {
                    tempData.push({
                        id: i,
                        data: new Uint8Array(1000),
                        timestamp: Date.now()
                    });
                }
                
                // 处理数据
                tempData.forEach(item => {
                    item.data.fill(item.id % 256);
                });
                
                // 清理（模拟正常使用）
                tempData.length = 0;
            }
            
            // 强制垃圾回收
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            performanceResults['内存泄漏测试 (内存增长)'] = memoryIncrease / 1024 / 1024; // MB
            
            // 10轮操作后内存增长应该很小
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
        });
    });
    
    describe('综合性能测试', () => {
        it('完整工作流性能', async () => {
            const startTime = performance.now();
            
            // 1. 数据生成
            const channels = createTestChannels(50000);
            
            // 2. 数据压缩
            const compression = new DataCompression();
            const compressed = await compression.compressRLE(channels[0].samples!);
            
            // 3. 解码处理
            const decoderManager = new DecoderManager();
            const decodeResults = await decoderManager.executeDecoder('i2c', 1000000, channels, []);
            
            // 4. 波形渲染
            const canvas = new MockCanvas();
            const renderer = new WaveformRenderer(canvas as any);
            await renderer.renderWaveform(channels, {
                startSample: 0,
                endSample: 10000,
                pixelsPerSample: 0.1,
                samplesPerPixel: 10
            });
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            
            performanceResults['完整工作流'] = totalTime;
            
            expect(totalTime).toBeLessThan(1000); // 1秒内完成
            expect(compressed.length).toBeGreaterThan(0);
            expect(Array.isArray(decodeResults)).toBe(true);
        });
        
        it('并发处理性能', async () => {
            const startTime = performance.now();
            
            const tasks = [];
            
            // 创建多个并发任务
            for (let i = 0; i < 5; i++) {
                const channels = createTestChannels(10000);
                const decoderManager = new DecoderManager();
                
                const task = async () => {
                    const results = await decoderManager.executeDecoder('i2c', 1000000, channels, []);
                    return results;
                };
                
                tasks.push(task());
            }
            
            const results = await Promise.all(tasks);
            
            const endTime = performance.now();
            const concurrentTime = endTime - startTime;
            
            performanceResults['并发处理 (5任务)'] = concurrentTime;
            
            expect(concurrentTime).toBeLessThan(500); // 500ms
            expect(results.length).toBe(5);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });
        });
    });
});

// 辅助函数
function createTestChannels(sampleCount: number): AnalyzerChannel[] {
    return [
        createTestChannel(0, 'CLK', sampleCount),
        createTestChannel(1, 'DATA', sampleCount)
    ];
}

function createTestChannel(id: number, name: string, sampleCount: number): AnalyzerChannel {
    const channel = new AnalyzerChannel(id, name);
    const samples = new Uint8Array(sampleCount);
    
    // 生成测试模式：方波信号
    for (let i = 0; i < sampleCount; i++) {
        samples[i] = Math.floor(i / 4) % 2; // 每4个样本变化一次
    }
    
    channel.samples = samples;
    return channel;
}

function createI2CTestData(sampleCount: number): AnalyzerChannel[] {
    const sclChannel = new AnalyzerChannel(0, 'SCL');
    const sdaChannel = new AnalyzerChannel(1, 'SDA');
    
    const sclData = new Uint8Array(sampleCount);
    const sdaData = new Uint8Array(sampleCount);
    
    // 生成I2C时钟和数据模式
    for (let i = 0; i < sampleCount; i++) {
        sclData[i] = i % 2; // 时钟信号
        sdaData[i] = Math.floor(i / 8) % 2; // 较慢的数据变化
    }
    
    sclChannel.samples = sclData;
    sdaChannel.samples = sdaData;
    
    return [sclChannel, sdaChannel];
}

function createSPITestData(sampleCount: number): AnalyzerChannel[] {
    const sclkChannel = new AnalyzerChannel(0, 'SCLK');
    const mosiChannel = new AnalyzerChannel(1, 'MOSI');
    const misoChannel = new AnalyzerChannel(2, 'MISO');
    const csChannel = new AnalyzerChannel(3, 'CS');
    
    const channels = [sclkChannel, mosiChannel, misoChannel, csChannel];
    
    channels.forEach((channel, index) => {
        const samples = new Uint8Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
            switch (index) {
                case 0: // SCLK
                    samples[i] = i % 2;
                    break;
                case 1: // MOSI
                    samples[i] = Math.floor(i / 2) % 2;
                    break;
                case 2: // MISO
                    samples[i] = Math.floor(i / 4) % 2;
                    break;
                case 3: // CS
                    samples[i] = i < sampleCount * 0.8 ? 0 : 1;
                    break;
            }
        }
        channel.samples = samples;
    });
    
    return channels;
}

function createUARTTestData(sampleCount: number): AnalyzerChannel[] {
    const rxChannel = new AnalyzerChannel(0, 'RX');
    const samples = new Uint8Array(sampleCount);
    
    // 生成UART模式：起始位 + 8数据位 + 停止位
    for (let i = 0; i < sampleCount; i++) {
        const bitPosition = i % 10;
        if (bitPosition === 0) {
            samples[i] = 0; // 起始位
        } else if (bitPosition === 9) {
            samples[i] = 1; // 停止位
        } else {
            samples[i] = Math.floor(i / 80) % 2; // 数据位
        }
    }
    
    rxChannel.samples = samples;
    return [rxChannel];
}

function createRepeatingPatternData(size: number, patternLength: number): Uint8Array {
    const data = new Uint8Array(size);
    const pattern = new Uint8Array(patternLength);
    
    // 创建随机模式
    for (let i = 0; i < patternLength; i++) {
        pattern[i] = Math.floor(Math.random() * 256);
    }
    
    // 重复模式填充数据
    for (let i = 0; i < size; i++) {
        data[i] = pattern[i % patternLength];
    }
    
    return data;
}