/**
 * BurstInfo 单元测试
 * 测试突发信息功能，特别是时间格式化
 */

import { BurstInfo } from '../../../src/models/CaptureModels';

describe('BurstInfo', () => {
    let burstInfo: BurstInfo;
    
    beforeEach(() => {
        burstInfo = new BurstInfo();
    });
    
    describe('构造函数和默认值', () => {
        it('应该设置正确的默认值', () => {
            expect(burstInfo.burstSampleStart).toBe(0);
            expect(burstInfo.burstSampleEnd).toBe(0);
            expect(burstInfo.burstSampleGap).toBe(0);
            expect(burstInfo.burstTimeGap).toBe(0);
        });
    });
    
    describe('属性设置', () => {
        it('应该能设置所有属性', () => {
            burstInfo.burstSampleStart = 1000;
            burstInfo.burstSampleEnd = 2000;
            burstInfo.burstSampleGap = 500;
            burstInfo.burstTimeGap = 25000; // 25微秒
            
            expect(burstInfo.burstSampleStart).toBe(1000);
            expect(burstInfo.burstSampleEnd).toBe(2000);
            expect(burstInfo.burstSampleGap).toBe(500);
            expect(burstInfo.burstTimeGap).toBe(25000);
        });
        
        it('应该处理大数值', () => {
            burstInfo.burstSampleStart = 4294967295; // uint最大值
            burstInfo.burstSampleEnd = 4294967295;
            burstInfo.burstSampleGap = 4294967295;
            burstInfo.burstTimeGap = 4294967295;
            
            expect(burstInfo.burstSampleStart).toBe(4294967295);
            expect(burstInfo.burstSampleEnd).toBe(4294967295);
            expect(burstInfo.burstSampleGap).toBe(4294967295);
            expect(burstInfo.burstTimeGap).toBe(4294967295);
        });
    });
    
    describe('getTime方法 - 时间格式化', () => {
        describe('纳秒级时间', () => {
            it('应该格式化小于1000纳秒的时间', () => {
                burstInfo.burstTimeGap = 500;
                expect(burstInfo.getTime()).toBe('500 ns');
            });
            
            it('应该格式化999纳秒的时间', () => {
                burstInfo.burstTimeGap = 999;
                expect(burstInfo.getTime()).toBe('999 ns');
            });
            
            it('应该处理0纳秒', () => {
                burstInfo.burstTimeGap = 0;
                expect(burstInfo.getTime()).toBe('0 ns');
            });
        });
        
        describe('微秒级时间', () => {
            it('应该格式化1微秒', () => {
                burstInfo.burstTimeGap = 1000; // 1000纳秒 = 1微秒
                expect(burstInfo.getTime()).toBe('1.000 µs');
            });
            
            it('应该格式化小数微秒', () => {
                burstInfo.burstTimeGap = 1500; // 1.5微秒
                expect(burstInfo.getTime()).toBe('1.500 µs');
            });
            
            it('应该格式化整数微秒', () => {
                burstInfo.burstTimeGap = 25000; // 25微秒
                expect(burstInfo.getTime()).toBe('25.000 µs');
            });
            
            it('应该格式化接近毫秒的微秒', () => {
                burstInfo.burstTimeGap = 999999; // 999.999微秒
                expect(burstInfo.getTime()).toBe('999.999 µs');
            });
        });
        
        describe('毫秒级时间', () => {
            it('应该格式化1毫秒', () => {
                burstInfo.burstTimeGap = 1000000; // 1毫秒
                expect(burstInfo.getTime()).toBe('1.000 ms');
            });
            
            it('应该格式化小数毫秒', () => {
                burstInfo.burstTimeGap = 1500000; // 1.5毫秒
                expect(burstInfo.getTime()).toBe('1.500 ms');
            });
            
            it('应该格式化整数毫秒', () => {
                burstInfo.burstTimeGap = 50000000; // 50毫秒
                expect(burstInfo.getTime()).toBe('50.000 ms');
            });
            
            it('应该格式化接近秒的毫秒', () => {
                burstInfo.burstTimeGap = 999999999; // 999.999999毫秒，舍入后为1000.000ms
                expect(burstInfo.getTime()).toBe('1000.000 ms');
            });
        });
        
        describe('秒级时间', () => {
            it('应该格式化1秒', () => {
                burstInfo.burstTimeGap = 1000000000; // 1秒
                expect(burstInfo.getTime()).toBe('1.000 s');
            });
            
            it('应该格式化小数秒', () => {
                burstInfo.burstTimeGap = 1500000000; // 1.5秒
                expect(burstInfo.getTime()).toBe('1.500 s');
            });
            
            it('应该格式化大整数秒', () => {
                burstInfo.burstTimeGap = 60000000000; // 60秒
                expect(burstInfo.getTime()).toBe('60.000 s');
            });
            
            it('应该格式化非常大的秒数', () => {
                burstInfo.burstTimeGap = 3600000000000; // 3600秒 = 1小时
                expect(burstInfo.getTime()).toBe('3600.000 s');
            });
        });
        
        describe('边界值测试', () => {
            it('应该处理边界值999纳秒', () => {
                burstInfo.burstTimeGap = 999;
                expect(burstInfo.getTime()).toBe('999 ns');
            });
            
            it('应该处理边界值1000纳秒', () => {
                burstInfo.burstTimeGap = 1000;
                expect(burstInfo.getTime()).toBe('1.000 µs');
            });
            
            it('应该处理边界值999999纳秒', () => {
                burstInfo.burstTimeGap = 999999;
                expect(burstInfo.getTime()).toBe('999.999 µs');
            });
            
            it('应该处理边界值1000000纳秒', () => {
                burstInfo.burstTimeGap = 1000000;
                expect(burstInfo.getTime()).toBe('1.000 ms');
            });
            
            it('应该处理边界值999999999纳秒', () => {
                burstInfo.burstTimeGap = 999999999;
                expect(burstInfo.getTime()).toBe('1000.000 ms'); // 舍入后为1000.000ms
            });
            
            it('应该处理边界值1000000000纳秒', () => {
                burstInfo.burstTimeGap = 1000000000;
                expect(burstInfo.getTime()).toBe('1.000 s');
            });
        });
        
        describe('精度测试', () => {
            it('应该保持3位小数精度（微秒）', () => {
                burstInfo.burstTimeGap = 1234; // 1.234微秒
                expect(burstInfo.getTime()).toBe('1.234 µs');
            });
            
            it('应该保持3位小数精度（毫秒）', () => {
                burstInfo.burstTimeGap = 1234567; // 1.234567毫秒，应该显示为1.235ms
                expect(burstInfo.getTime()).toBe('1.235 ms');
            });
            
            it('应该保持3位小数精度（秒）', () => {
                burstInfo.burstTimeGap = 1234567890; // 1.23456789秒，应该显示为1.235s
                expect(burstInfo.getTime()).toBe('1.235 s');
            });
            
            it('应该正确舍入微秒', () => {
                burstInfo.burstTimeGap = 1999; // 1.999微秒
                expect(burstInfo.getTime()).toBe('1.999 µs');
            });
        });
    });
    
    describe('toString方法', () => {
        it('应该返回包含所有信息的格式化字符串', () => {
            burstInfo.burstSampleStart = 1000;
            burstInfo.burstSampleEnd = 2000;
            burstInfo.burstSampleGap = 500;
            burstInfo.burstTimeGap = 25000000; // 25毫秒
            
            const result = burstInfo.toString();
            
            expect(result).toContain('Burst: 1000 to 2000');
            expect(result).toContain('Gap: 25.000 ms (500 samples)');
        });
        
        it('应该处理零值', () => {
            const result = burstInfo.toString();
            
            expect(result).toContain('Burst: 0 to 0');
            expect(result).toContain('Gap: 0 ns (0 samples)');
        });
        
        it('应该正确显示不同时间单位', () => {
            // 纳秒级
            burstInfo.burstSampleStart = 100;
            burstInfo.burstSampleEnd = 200;
            burstInfo.burstSampleGap = 50;
            burstInfo.burstTimeGap = 500;
            
            let result = burstInfo.toString();
            expect(result).toContain('Gap: 500 ns (50 samples)');
            
            // 微秒级
            burstInfo.burstTimeGap = 1500; // 1.5微秒
            result = burstInfo.toString();
            expect(result).toContain('Gap: 1.500 µs (50 samples)');
            
            // 毫秒级
            burstInfo.burstTimeGap = 1500000; // 1.5毫秒
            result = burstInfo.toString();
            expect(result).toContain('Gap: 1.500 ms (50 samples)');
            
            // 秒级
            burstInfo.burstTimeGap = 1500000000; // 1.5秒
            result = burstInfo.toString();
            expect(result).toContain('Gap: 1.500 s (50 samples)');
        });
        
        it('应该包含换行符分隔信息', () => {
            burstInfo.burstSampleStart = 1000;
            burstInfo.burstSampleEnd = 2000;
            burstInfo.burstSampleGap = 500;
            burstInfo.burstTimeGap = 25000000;
            
            const result = burstInfo.toString();
            expect(result).toMatch(/Burst: \d+ to \d+\nGap: .+/);
        });
    });
    
    describe('实际应用场景测试', () => {
        it('应该正确处理典型的I2C突发时间', () => {
            // 典型I2C在100kHz时钟下的突发间隔
            burstInfo.burstSampleStart = 1000;
            burstInfo.burstSampleEnd = 1100;
            burstInfo.burstSampleGap = 240; // 240个样本间隔
            burstInfo.burstTimeGap = 10000; // 10微秒
            
            expect(burstInfo.getTime()).toBe('10.000 µs');
            
            const result = burstInfo.toString();
            expect(result).toContain('Burst: 1000 to 1100');
            expect(result).toContain('Gap: 10.000 µs (240 samples)');
        });
        
        it('应该正确处理典型的SPI突发时间', () => {
            // 典型SPI高速传输的突发间隔
            burstInfo.burstSampleStart = 2000;
            burstInfo.burstSampleEnd = 2064;
            burstInfo.burstSampleGap = 1000; // 1000个样本间隔
            burstInfo.burstTimeGap = 1000; // 1微秒
            
            expect(burstInfo.getTime()).toBe('1.000 µs');
            
            const result = burstInfo.toString();
            expect(result).toContain('Burst: 2000 to 2064');
            expect(result).toContain('Gap: 1.000 µs (1000 samples)');
        });
        
        it('应该正确处理长时间间隔的突发', () => {
            // 长时间间隔的突发，比如系统休眠唤醒
            burstInfo.burstSampleStart = 0;
            burstInfo.burstSampleEnd = 1000;
            burstInfo.burstSampleGap = 24000000; // 2400万个样本
            burstInfo.burstTimeGap = 2000000000; // 2秒
            
            expect(burstInfo.getTime()).toBe('2.000 s');
            
            const result = burstInfo.toString();
            expect(result).toContain('Burst: 0 to 1000');
            expect(result).toContain('Gap: 2.000 s (24000000 samples)');
        });
    });
    
    describe('性能测试', () => {
        it('getTime方法应该高效', () => {
            burstInfo.burstTimeGap = 1500000; // 1.5毫秒
            
            const startTime = Date.now();
            
            for (let i = 0; i < 10000; i++) {
                burstInfo.getTime();
            }
            
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100); // 10000次调用在100ms内完成
        });
        
        it('toString方法应该高效', () => {
            burstInfo.burstSampleStart = 1000;
            burstInfo.burstSampleEnd = 2000;
            burstInfo.burstSampleGap = 500;
            burstInfo.burstTimeGap = 25000000;
            
            const startTime = Date.now();
            
            for (let i = 0; i < 1000; i++) {
                burstInfo.toString();
            }
            
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100); // 1000次调用在100ms内完成
        });
    });
    
    describe('兼容性验证', () => {
        it('应该与C# BurstInfo兼容', () => {
            // 验证默认值与C#版本一致
            expect(burstInfo.burstSampleStart).toBe(0);
            expect(burstInfo.burstSampleEnd).toBe(0);
            expect(burstInfo.burstSampleGap).toBe(0);
            expect(burstInfo.burstTimeGap).toBe(0);
        });
        
        it('getTime应该与C#版本算法一致', () => {
            // 验证时间转换算法与C#版本一致
            const testCases = [
                { nanoseconds: 500, expected: '500 ns' },
                { nanoseconds: 1000, expected: '1.000 µs' },
                { nanoseconds: 1500, expected: '1.500 µs' },
                { nanoseconds: 1000000, expected: '1.000 ms' },
                { nanoseconds: 1500000, expected: '1.500 ms' },
                { nanoseconds: 1000000000, expected: '1.000 s' },
                { nanoseconds: 1500000000, expected: '1.500 s' }
            ];
            
            testCases.forEach(({ nanoseconds, expected }) => {
                burstInfo.burstTimeGap = nanoseconds;
                expect(burstInfo.getTime()).toBe(expected);
            });
        });
        
        it('toString格式应该与C#版本一致', () => {
            burstInfo.burstSampleStart = 1000;
            burstInfo.burstSampleEnd = 2000;
            burstInfo.burstSampleGap = 500;
            burstInfo.burstTimeGap = 25000000; // 25毫秒
            
            const result = burstInfo.toString();
            
            // 验证格式符合C#版本的格式
            expect(result).toBe('Burst: 1000 to 2000\nGap: 25.000 ms (500 samples)');
        });
        
        it('应该正确处理C#中的ulong范围', () => {
            // C#中ulong的最大值约为18,446,744,073,709,551,615
            // JavaScript的Number.MAX_SAFE_INTEGER为9,007,199,254,740,991
            // 我们测试在安全范围内的大数值
            const largeValue = Number.MAX_SAFE_INTEGER;
            
            burstInfo.burstSampleStart = largeValue;
            burstInfo.burstSampleEnd = largeValue;
            burstInfo.burstSampleGap = largeValue;
            burstInfo.burstTimeGap = largeValue;
            
            expect(burstInfo.burstSampleStart).toBe(largeValue);
            expect(burstInfo.burstSampleEnd).toBe(largeValue);
            expect(burstInfo.burstSampleGap).toBe(largeValue);
            expect(burstInfo.burstTimeGap).toBe(largeValue);
            
            // 验证仍能正确格式化时间
            expect(burstInfo.getTime()).toContain('s'); // 应该是秒级别
        });
    });
    
    describe('边界和错误处理', () => {
        it('应该处理极小值', () => {
            burstInfo.burstTimeGap = 1;
            expect(burstInfo.getTime()).toBe('1 ns');
        });
        
        it('应该处理数学运算精度', () => {
            // 测试可能导致精度问题的值
            burstInfo.burstTimeGap = 1001; // 1.001微秒
            expect(burstInfo.getTime()).toBe('1.001 µs');
            
            burstInfo.burstTimeGap = 1000001; // 1.000001毫秒
            expect(burstInfo.getTime()).toBe('1.000 ms'); // 应该正确舍入
        });
        
        it('应该处理样本范围逻辑错误', () => {
            // 虽然这在逻辑上不正确，但代码应该能处理
            burstInfo.burstSampleStart = 2000;
            burstInfo.burstSampleEnd = 1000; // end < start
            burstInfo.burstSampleGap = 100;
            burstInfo.burstTimeGap = 5000;
            
            const result = burstInfo.toString();
            expect(result).toContain('Burst: 2000 to 1000');
            expect(result).toContain('Gap: 5.000 µs (100 samples)');
        });
    });
});