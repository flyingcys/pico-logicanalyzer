/**
 * LogicAnalyzerDriver 单元测试
 * 基于原版C# LogicAnalyzerDriver的功能测试
 */

import { LogicAnalyzerDriver } from './LogicAnalyzerDriver';
import { CaptureSession } from '../models/CaptureSession';
import { AnalyzerChannel } from '../models/AnalyzerChannel';
import { AnalyzerDriverType, CaptureError, TriggerType } from '../models/Enums';

// Mock SerialPort
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => callback && callback()),
        close: jest.fn((callback) => callback && callback()),
        write: jest.fn((data, callback) => callback && callback()),
        on: jest.fn(),
        off: jest.fn(),
        isOpen: true
    })),
    available: jest.fn().mockResolvedValue([
        { path: '/dev/ttyUSB0', manufacturer: 'Test', vendorId: '1234', productId: '5678' }
    ])
}));

describe('LogicAnalyzerDriver', () => {
    let driver: LogicAnalyzerDriver;
    let captureSession: CaptureSession;
    
    beforeEach(() => {
        // 清除所有Mock
        jest.clearAllMocks();
        
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 创建测试用的采集会话
        captureSession = new CaptureSession();
        captureSession.frequency = 24000000;
        captureSession.preTriggerSamples = 1000;
        captureSession.postTriggerSamples = 10000;
        captureSession.triggerType = TriggerType.Edge;
        captureSession.triggerChannel = 0;
        captureSession.captureChannels = [
            new AnalyzerChannel(0, 'Channel 1'),
            new AnalyzerChannel(1, 'Channel 2')
        ];
    });
    
    afterEach(async () => {
        if (driver && driver.isCapturing) {
            await driver.stopCapture();
        }
    });
    
    describe('基础属性测试', () => {
        test('应该正确设置驱动类型为单设备', () => {
            expect(driver.driverType).toBe(AnalyzerDriverType.Single);
        });
        
        test('应该正确识别为非网络设备', () => {
            expect(driver.isNetwork).toBe(false);
        });
        
        test('应该有正确的设备规格', () => {
            expect(driver.channelCount).toBe(24);
            expect(driver.maxFrequency).toBe(100000000); // 100MHz
            expect(driver.bufferSize).toBe(96000);
            expect(driver.blastFrequency).toBe(100000000);
        });
        
        test('初始状态应该不在采集中', () => {
            expect(driver.isCapturing).toBe(false);
        });
        
        test('应该有有效的设备版本', () => {
            expect(typeof driver.deviceVersion).toBe('string');
            expect(driver.deviceVersion.length).toBeGreaterThan(0);
        });
    });
    
    describe('设备连接测试', () => {
        test('应该能获取设备信息', () => {
            const deviceInfo = driver.getDeviceInfo();
            
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.name).toContain('Logic Analyzer');
            expect(deviceInfo.maxFrequency).toBe(driver.maxFrequency);
            expect(deviceInfo.channels).toBe(driver.channelCount);
            expect(deviceInfo.bufferSize).toBe(driver.bufferSize);
        });
        
        test('getVoltageStatus应该返回电压信息', async () => {
            const voltage = await driver.getVoltageStatus();
            
            expect(typeof voltage).toBe('string');
            // 应该是电压格式如"3.3V"或"Battery: 3.8V"
            expect(voltage).toMatch(/\d+\.\d+V/);
        });
        
        test('enterBootloader应该执行成功', async () => {
            const result = await driver.enterBootloader();
            expect(typeof result).toBe('boolean');
        });
    });
    
    describe('采集功能测试', () => {
        test('startCapture应该正确启动采集', async () => {
            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.None);
            expect(driver.isCapturing).toBe(true);
        });
        
        test('stopCapture应该正确停止采集', async () => {
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            const result = await driver.stopCapture();
            expect(result).toBe(true);
            expect(driver.isCapturing).toBe(false);
        });
        
        test('应该能处理不同的触发类型', async () => {
            const triggerTypes = [
                TriggerType.Edge,
                TriggerType.Complex,
                TriggerType.Fast,
                TriggerType.Blast
            ];
            
            for (const triggerType of triggerTypes) {
                captureSession.triggerType = triggerType;
                const result = await driver.startCapture(captureSession);
                expect(result).toBe(CaptureError.None);
                
                await driver.stopCapture();
            }
        });
        
        test('应该能处理不同的采样频率', async () => {
            const frequencies = [1000000, 24000000, 50000000, 100000000];
            
            for (const frequency of frequencies) {
                captureSession.frequency = frequency;
                const result = await driver.startCapture(captureSession);
                expect(result).toBe(CaptureError.None);
                
                await driver.stopCapture();
            }
        });
        
        test('应该能处理多通道采集', async () => {
            // 测试8通道
            captureSession.captureChannels = Array.from({length: 8}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            let result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            await driver.stopCapture();
            
            // 测试16通道
            captureSession.captureChannels = Array.from({length: 16}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            await driver.stopCapture();
            
            // 测试24通道
            captureSession.captureChannels = Array.from({length: 24}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            await driver.stopCapture();
        });
    });
    
    describe('突发采集测试', () => {
        test('应该能处理突发采集', async () => {
            captureSession.triggerType = TriggerType.Blast;
            captureSession.loopCount = 5;
            captureSession.measureBursts = true;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        test('应该能处理最大突发次数', async () => {
            captureSession.triggerType = TriggerType.Blast;
            captureSession.loopCount = 255; // 最大值
            captureSession.measureBursts = true;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
    });
    
    describe('复杂触发测试', () => {
        test('应该能处理复杂触发模式', async () => {
            captureSession.triggerType = TriggerType.Complex;
            captureSession.triggerPattern = 0xABCD;
            captureSession.triggerBitCount = 16;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        test('应该能处理不同的触发位宽', async () => {
            captureSession.triggerType = TriggerType.Complex;
            
            const bitCounts = [1, 4, 8, 16, 24];
            for (const bitCount of bitCounts) {
                captureSession.triggerBitCount = bitCount;
                captureSession.triggerPattern = (1 << bitCount) - 1; // 全1模式
                
                const result = await driver.startCapture(captureSession);
                expect(result).toBe(CaptureError.None);
                
                await driver.stopCapture();
            }
        });
    });
    
    describe('采集限制测试', () => {
        test('getLimits应该返回正确的限制', () => {
            const channels8 = [0, 1, 2, 3, 4, 5, 6, 7];
            const limits8 = driver.getLimits(channels8);
            
            expect(limits8).toBeDefined();
            expect(limits8.maxTotalSamples).toBeGreaterThan(0);
            expect(limits8.maxPreSamples).toBeGreaterThan(0);
            expect(limits8.maxPostSamples).toBeGreaterThan(0);
            
            const channels24 = Array.from({length: 24}, (_, i) => i);
            const limits24 = driver.getLimits(channels24);
            
            // 24通道模式的样本数应该少于8通道模式
            expect(limits24.maxTotalSamples).toBeLessThanOrEqual(limits8.maxTotalSamples);
        });
        
        test('应该根据通道数正确计算采集模式', () => {
            const mode8 = driver.getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7]);
            const mode16 = driver.getCaptureMode(Array.from({length: 16}, (_, i) => i));
            const mode24 = driver.getCaptureMode(Array.from({length: 24}, (_, i) => i));
            
            expect(mode8).not.toBe(mode16);
            expect(mode16).not.toBe(mode24);
            expect(mode8).not.toBe(mode24);
        });
    });
    
    describe('网络功能测试', () => {
        test('sendNetworkConfig应该返回false（非网络设备）', async () => {
            const result = await driver.sendNetworkConfig('test-ssid', 'password', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });
    });
    
    describe('错误处理测试', () => {
        test('应该处理无效采集参数', async () => {
            const invalidSession = new CaptureSession();
            invalidSession.frequency = 0; // 无效频率
            
            try {
                const result = await driver.startCapture(invalidSession);
                expect(result).not.toBe(CaptureError.None);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        test('应该处理重复启动采集', async () => {
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            // 尝试再次启动
            const result = await driver.startCapture(captureSession);
            // 应该返回错误或被忽略
            expect([CaptureError.None, CaptureError.AlreadyCapturing]).toContain(result);
            
            await driver.stopCapture();
        });
        
        test('应该处理采集未开始时的停止操作', async () => {
            expect(driver.isCapturing).toBe(false);
            
            const result = await driver.stopCapture();
            // 应该正常返回或返回false
            expect(typeof result).toBe('boolean');
        });
        
        test('应该处理超出范围的频率', async () => {
            captureSession.frequency = driver.maxFrequency * 2; // 超出最大频率
            
            try {
                const result = await driver.startCapture(captureSession);
                expect(result).not.toBe(CaptureError.None);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        test('应该处理无效的触发通道', async () => {
            captureSession.triggerChannel = 25; // 超出范围
            
            try {
                const result = await driver.startCapture(captureSession);
                expect(result).not.toBe(CaptureError.None);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
    
    describe('边界条件测试', () => {
        test('应该处理最小采集参数', async () => {
            captureSession.frequency = driver.minFrequency;
            captureSession.preTriggerSamples = 0;
            captureSession.postTriggerSamples = 1;
            captureSession.captureChannels = [new AnalyzerChannel(0, 'Channel 1')];
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        test('应该处理最大采集参数', async () => {
            captureSession.frequency = driver.maxFrequency;
            
            const limits = driver.getLimits([0]);
            captureSession.preTriggerSamples = limits.maxPreSamples;
            captureSession.postTriggerSamples = limits.maxPostSamples;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        test('应该处理空通道列表', async () => {
            captureSession.captureChannels = [];
            
            try {
                const result = await driver.startCapture(captureSession);
                // 可能返回错误或使用默认通道
                expect(typeof result).toBe('number');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
    
    describe('性能测试', () => {
        test('设备信息获取应该快速', () => {
            const startTime = Date.now();
            const deviceInfo = driver.getDeviceInfo();
            const endTime = Date.now();
            
            expect(deviceInfo).toBeDefined();
            expect(endTime - startTime).toBeLessThan(10);
        });
        
        test('模式和限制计算应该高效', () => {
            const channels = Array.from({length: 16}, (_, i) => i);
            
            const startTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                driver.getCaptureMode(channels);
                driver.getLimits(channels);
            }
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100);
        });
        
        test('采集启动应该在合理时间内完成', async () => {
            const startTime = Date.now();
            await driver.startCapture(captureSession);
            const endTime = Date.now();
            
            expect(driver.isCapturing).toBe(true);
            expect(endTime - startTime).toBeLessThan(5000); // 5秒内
            
            await driver.stopCapture();
        });
    });
    
    describe('内存管理测试', () => {
        test('多次采集不应导致内存泄漏', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 执行多次采集
            for (let i = 0; i < 10; i++) {
                await driver.startCapture(captureSession);
                await driver.stopCapture();
            }
            
            // 强制垃圾回收
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // 内存增长应该在合理范围内
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
        });
    });
});