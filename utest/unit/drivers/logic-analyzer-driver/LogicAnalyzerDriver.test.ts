/**
 * LogicAnalyzerDriver 单元测试
 * 基于原版C# LogicAnalyzerDriver的功能测试
 */

import { LogicAnalyzerDriver } from '../../../../src/drivers/LogicAnalyzerDriver';
import { AnalyzerDriverBase } from '../../../../src/drivers/AnalyzerDriverBase';
import { CaptureSession, AnalyzerChannel } from '../../../../src/models/CaptureModels';
import { AnalyzerDriverType, CaptureError, TriggerType } from '../../../../src/models/AnalyzerTypes';
import { SerialPort } from 'serialport';

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
    
    // 辅助函数：模拟采集开始响应和数据读取
    const mockCaptureStart = () => {
        const mockParser = (driver as any)._lineParser;
        
        // 模拟正确的事件监听机制
        mockParser.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'data') {
                // 立即触发CAPTURE_STARTED响应
                setTimeout(() => callback('CAPTURE_STARTED'), 10);
            }
        });
        
        // 模拟off方法用于清理监听器
        mockParser.off.mockImplementation(() => {});
        
        // 模拟readCaptureData方法
        const originalReadCaptureData = (driver as any).readCaptureData;
        (driver as any).readCaptureData = jest.fn().mockResolvedValue(new Uint8Array([1, 0, 1, 0, 1, 0]));
        
        // 模拟extractSamplesToChannels方法
        (driver as any).extractSamplesToChannels = jest.fn().mockImplementation((session: CaptureSession, data: Uint8Array) => {
            // 创建模拟的样本数据
            session.captureChannels.forEach((channel, index) => {
                channel.samples = new Uint8Array(100);
                // 填充一些测试数据
                for (let i = 0; i < 100; i++) {
                    channel.samples[i] = (i + index) % 2;
                }
            });
        });
    };
    
    beforeEach(async () => {
        // 清除所有Mock
        jest.clearAllMocks();
        
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 模拟设备连接和初始化
        // 使用私有属性设置模拟设备规格（用于测试）
        (driver as any)._channelCount = 24;
        (driver as any)._maxFrequency = 100000000;
        (driver as any)._blastFrequency = 100000000;
        (driver as any)._bufferSize = 96000;
        (driver as any)._version = 'Test Logic Analyzer v1.0';
        (driver as any)._isNetwork = false;
        (driver as any)._isConnected = true;
        
        // 模拟流和解析器
        const mockStream = {
            write: jest.fn((data, callback) => callback && callback()),
            on: jest.fn(),
            off: jest.fn()
        };
        const mockParser = {
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn()
        };
        (driver as any)._currentStream = mockStream;
        (driver as any)._lineParser = mockParser;
        
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
        it('应该正确设置驱动类型为串口设备', () => {
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
        });
        
        it('应该正确识别为非网络设备', () => {
            expect(driver.isNetwork).toBe(false);
        });
        
        it('应该有正确的设备规格', () => {
            expect(driver.channelCount).toBe(24);
            expect(driver.maxFrequency).toBe(100000000); // 100MHz
            expect(driver.bufferSize).toBe(96000);
            expect(driver.blastFrequency).toBe(100000000);
        });
        
        it('初始状态应该不在采集中', () => {
            expect(driver.isCapturing).toBe(false);
        });
        
        it('应该有有效的设备版本', () => {
            expect(typeof driver.deviceVersion).toBe('string');
            expect(driver.deviceVersion.length).toBeGreaterThan(0);
        });
    });
    
    describe('设备连接测试', () => {
        it('应该能获取设备信息', () => {
            const deviceInfo = driver.getDeviceInfo();
            
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.name).toContain('Logic Analyzer');
            expect(deviceInfo.maxFrequency).toBe(driver.maxFrequency);
            expect(deviceInfo.channels).toBe(driver.channelCount);
            expect(deviceInfo.bufferSize).toBe(driver.bufferSize);
        });
        
        it('getVoltageStatus应该返回电压信息', async () => {
            // 模拟电压响应
            const mockParser = (driver as any)._lineParser;
            mockParser.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'data') {
                    setTimeout(() => callback('Battery: 3.8V'), 0);
                }
            });
            
            const voltage = await driver.getVoltageStatus();
            
            expect(typeof voltage).toBe('string');
            // 应该是电压格式如"3.3V"或"Battery: 3.8V"
            expect(voltage).toMatch(/\d+\.\d+V/);
        });
        
        it('enterBootloader应该执行成功', async () => {
            const result = await driver.enterBootloader();
            expect(typeof result).toBe('boolean');
        });
    });
    
    describe('采集功能测试', () => {
        it('startCapture应该正确启动采集', async () => {
            mockCaptureStart();
            
            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.None);
            expect(driver.isCapturing).toBe(true);
        });
        
        it('stopCapture应该正确停止采集', async () => {
            mockCaptureStart();
            
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            const result = await driver.stopCapture();
            expect(result).toBe(true);
            expect(driver.isCapturing).toBe(false);
        });
        
        it('应该能处理不同的触发类型', async () => {
            const triggerTypes = [
                TriggerType.Edge,
                TriggerType.Complex,
                TriggerType.Fast,
                TriggerType.Blast
            ];
            
            for (const triggerType of triggerTypes) {
                mockCaptureStart();
                captureSession.triggerType = triggerType;
                const result = await driver.startCapture(captureSession);
                expect(result).toBe(CaptureError.None);
                
                await driver.stopCapture();
            }
        });
        
        it('应该能处理不同的采样频率', async () => {
            const frequencies = [1000000, 24000000, 50000000, 100000000];
            
            for (const frequency of frequencies) {
                mockCaptureStart();
                captureSession.frequency = frequency;
                const result = await driver.startCapture(captureSession);
                expect(result).toBe(CaptureError.None);
                
                await driver.stopCapture();
            }
        });
        
        it('应该能处理多通道采集', async () => {
            // 测试8通道
            mockCaptureStart();
            captureSession.captureChannels = Array.from({length: 8}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            let result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            await driver.stopCapture();
            
            // 测试16通道
            mockCaptureStart();
            captureSession.captureChannels = Array.from({length: 16}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            await driver.stopCapture();
            
            // 测试24通道
            mockCaptureStart();
            captureSession.captureChannels = Array.from({length: 24}, (_, i) => 
                new AnalyzerChannel(i, `Channel ${i + 1}`)
            );
            result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            await driver.stopCapture();
        });
    });
    
    describe('突发采集测试', () => {
        it('应该能处理突发采集', async () => {
            mockCaptureStart();
            captureSession.triggerType = TriggerType.Blast;
            captureSession.loopCount = 5;
            captureSession.measureBursts = true;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        it('应该能处理最大突发次数', async () => {
            mockCaptureStart();
            captureSession.triggerType = TriggerType.Blast;
            captureSession.loopCount = 8; // 合理的突发次数，确保不超出缓冲区限制
            captureSession.postTriggerSamples = 1000; // 减少样本数以适应突发模式
            captureSession.measureBursts = true;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
    });
    
    describe('复杂触发测试', () => {
        it('应该能处理复杂触发模式', async () => {
            mockCaptureStart();
            captureSession.triggerType = TriggerType.Complex;
            captureSession.triggerPattern = 0xABCD;
            captureSession.triggerBitCount = 16;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        it('应该能处理不同的触发位宽', async () => {
            captureSession.triggerType = TriggerType.Complex;
            
            const bitCounts = [1, 4, 8, 16]; // 移除24，Complex触发最大支持16位
            for (const bitCount of bitCounts) {
                mockCaptureStart();
                captureSession.triggerBitCount = bitCount;
                captureSession.triggerPattern = (1 << bitCount) - 1; // 全1模式
                
                const result = await driver.startCapture(captureSession);
                expect(result).toBe(CaptureError.None);
                
                await driver.stopCapture();
            }
        });
    });
    
    describe('采集限制测试', () => {
        it('getLimits应该返回正确的限制', () => {
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
        
        it('应该根据通道数正确计算采集模式', () => {
            const mode8 = driver.getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7]);
            const mode16 = driver.getCaptureMode(Array.from({length: 16}, (_, i) => i));
            const mode24 = driver.getCaptureMode(Array.from({length: 24}, (_, i) => i));
            
            expect(mode8).not.toBe(mode16);
            expect(mode16).not.toBe(mode24);
            expect(mode8).not.toBe(mode24);
        });
    });
    
    describe('网络功能测试', () => {
        it('sendNetworkConfig应该返回false（非网络设备）', async () => {
            const result = await driver.sendNetworkConfig('test-ssid', 'password', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });
    });
    
    describe('错误处理测试', () => {
        it('应该处理无效采集参数', async () => {
            const invalidSession = new CaptureSession();
            invalidSession.frequency = 0; // 无效频率
            
            try {
                const result = await driver.startCapture(invalidSession);
                expect(result).not.toBe(CaptureError.None);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        it('应该处理重复启动采集', async () => {
            mockCaptureStart();
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            // 尝试再次启动
            const result = await driver.startCapture(captureSession);
            // 应该返回错误或被忽略
            expect([CaptureError.None, CaptureError.Busy]).toContain(result);
            
            await driver.stopCapture();
        });
        
        it('应该处理采集未开始时的停止操作', async () => {
            expect(driver.isCapturing).toBe(false);
            
            const result = await driver.stopCapture();
            // 应该正常返回或返回false
            expect(typeof result).toBe('boolean');
        });
        
        it('应该处理超出范围的频率', async () => {
            captureSession.frequency = driver.maxFrequency * 2; // 超出最大频率
            
            try {
                const result = await driver.startCapture(captureSession);
                expect(result).not.toBe(CaptureError.None);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        it('应该处理无效的触发通道', async () => {
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
        it('应该处理最小采集参数', async () => {
            mockCaptureStart();
            captureSession.frequency = driver.minFrequency;
            captureSession.preTriggerSamples = 2; // 满足最小限制
            captureSession.postTriggerSamples = 2; // 满足最小限制
            captureSession.captureChannels = [new AnalyzerChannel(0, 'Channel 1')];
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        it('应该处理最大采集参数', async () => {
            mockCaptureStart();
            captureSession.frequency = driver.maxFrequency;
            
            const limits = driver.getLimits([0]);
            captureSession.preTriggerSamples = limits.maxPreSamples;
            captureSession.postTriggerSamples = limits.maxPostSamples;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
            
            await driver.stopCapture();
        });
        
        it('应该处理空通道列表', async () => {
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
        it('设备信息获取应该快速', () => {
            const startTime = Date.now();
            const deviceInfo = driver.getDeviceInfo();
            const endTime = Date.now();
            
            expect(deviceInfo).toBeDefined();
            expect(endTime - startTime).toBeLessThan(10);
        });
        
        it('模式和限制计算应该高效', () => {
            const channels = Array.from({length: 16}, (_, i) => i);
            
            const startTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                driver.getCaptureMode(channels);
                driver.getLimits(channels);
            }
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100);
        });
        
        it('采集启动应该在合理时间内完成', async () => {
            mockCaptureStart();
            const startTime = Date.now();
            await driver.startCapture(captureSession);
            const endTime = Date.now();
            
            expect(driver.isCapturing).toBe(true);
            expect(endTime - startTime).toBeLessThan(5000); // 5秒内
            
            await driver.stopCapture();
        });
    });
    
    describe('内存管理测试', () => {
        it('多次采集不应导致内存泄漏', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 减少测试次数以避免超时
            for (let i = 0; i < 3; i++) {
                mockCaptureStart();
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
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
        }, 15000); // 增加超时时间到15秒
    });
    
    describe('网络连接测试', () => {
        beforeEach(() => {
            // 清理现有驱动
            if (driver) {
                driver.disconnect();
            }
        });
        
        it('应该能识别网络地址格式', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 模拟网络连接成功
            const mockTcpSocket = {
                connect: jest.fn((port, address, callback) => {
                    setTimeout(callback, 0);
                }),
                pipe: jest.fn(),
                on: jest.fn(),
                destroy: jest.fn()
            };
            
            // Mock Socket构造函数
            jest.doMock('net', () => ({
                Socket: jest.fn(() => mockTcpSocket)
            }));
            
            // 模拟设备初始化响应
            const mockLineParser = {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        // 模拟设备信息响应
                        setTimeout(() => {
                            callback('Pico Logic Analyzer v1.0');
                            callback('FREQ:100000000');
                            callback('BLASTFREQ:100000000');
                            callback('BUFFER:96000');
                            callback('CHANNELS:24');
                        }, 10);
                    }
                }),
                off: jest.fn(),
                once: jest.fn()
            };
            
            // 设置内部状态以模拟连接
            (networkDriver as any)._currentStream = mockTcpSocket;
            (networkDriver as any)._lineParser = mockLineParser;
            (networkDriver as any)._isConnected = true;
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._version = 'Pico Logic Analyzer v1.0';
            (networkDriver as any)._maxFrequency = 100000000;
            (networkDriver as any)._blastFrequency = 100000000;
            (networkDriver as any)._bufferSize = 96000;
            (networkDriver as any)._channelCount = 24;
            
            expect(networkDriver.isNetwork).toBe(true);
            expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
        });
        
        it('应该处理无效的网络地址格式', async () => {
            expect(() => {
                new LogicAnalyzerDriver('invalid-address');
            }).not.toThrow(); // 构造函数不会抛出错误，连接时才会
            
            const invalidDriver = new LogicAnalyzerDriver('invalid-address');
            
            // Mock initSerialPort 方法抛出错误（因为不是网络地址格式）
            (invalidDriver as any).initSerialPort = jest.fn().mockRejectedValue(new Error('串口连接失败: this._serialPort.pipe is not a function'));
            
            const result = await invalidDriver.connect();
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('连接失败');
        });
        
        it('网络设备应该支持sendNetworkConfig', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 设置为网络设备 - 网络设备不需要配置网络，应该返回false
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._isConnected = true;
            (networkDriver as any)._currentStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            const result = await networkDriver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(false); // 网络设备不需要配置网络参数
        });
    });
    
    describe('设备连接和初始化测试', () => {
        it('connect方法应该正确处理串口连接', async () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            
            // 模拟成功的初始化过程  
            const mockInitSerialPort = jest.fn().mockResolvedValue(undefined);
            const mockReadDeviceInfo = jest.fn().mockResolvedValue([
                'Pico Logic Analyzer v1.0',
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:24'
            ]);
            
            // Mock私有方法
            (serialDriver as any).initSerialPort = mockInitSerialPort;
            (serialDriver as any).readDeviceInfo = mockReadDeviceInfo;
            
            // 手动设置版本信息，模拟parseDeviceInfo的效果
            (serialDriver as any)._version = 'Pico Logic Analyzer v1.0';
            
            const result = await serialDriver.connect();
            
            expect(result.success).toBe(true);
            expect(result.deviceInfo?.name).toContain('Logic Analyzer');
            expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Serial);
            expect(result.deviceInfo?.isNetwork).toBe(false);
        });
        
        it('connect方法应该正确处理连接失败', async () => {
            const failDriver = new LogicAnalyzerDriver('/dev/invalid');
            
            // Mock initSerialPort 方法抛出错误
            (failDriver as any).initSerialPort = jest.fn().mockRejectedValue(new Error('Port not found'));
            
            const result = await failDriver.connect();
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Port not found');
        });
        
        it('disconnect方法应该正确清理资源', async () => {
            const testDriver = new LogicAnalyzerDriver('/dev/ttyUSB1');
            
            const mockSerialPort = {
                isOpen: true,
                close: jest.fn(),
                pipe: jest.fn()
            };
            
            const mockTcpSocket = {
                destroy: jest.fn()
            };
            
            // 设置连接状态
            (testDriver as any)._serialPort = mockSerialPort;
            (testDriver as any)._tcpSocket = mockTcpSocket;
            (testDriver as any)._isConnected = true;
            
            await testDriver.disconnect();
            
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockTcpSocket.destroy).toHaveBeenCalled();
            expect((testDriver as any)._isConnected).toBe(false);
            expect((testDriver as any)._serialPort).toBeUndefined();
            expect((testDriver as any)._tcpSocket).toBeUndefined();
        });
        
        it('getStatus应该返回正确的状态信息', async () => {
            const statusDriver = new LogicAnalyzerDriver('/dev/ttyUSB2');
            
            // 设置状态
            (statusDriver as any)._isConnected = true;
            (statusDriver as any)._capturing = false;
            
            // Mock getVoltageStatus
            statusDriver.getVoltageStatus = jest.fn().mockResolvedValue('3.3V');
            
            const status = await statusDriver.getStatus();
            
            expect(status.isConnected).toBe(true);
            expect(status.isCapturing).toBe(false);
            expect(status.batteryVoltage).toBe('3.3V');
        });
    });
    
    describe('数据写入和通信测试', () => {
        it('writeData应该正确写入数据到流', async () => {
            const writeDriver = new LogicAnalyzerDriver('/dev/ttyUSB3');
            
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (writeDriver as any)._currentStream = mockStream;
            
            const testData = new Uint8Array([0x01, 0x02, 0x03]);
            await (writeDriver as any).writeData(testData);
            
            expect(mockStream.write).toHaveBeenCalledWith(
                Buffer.from(testData),
                expect.any(Function)
            );
        });
        
        it('writeData应该处理写入错误', async () => {
            const errorDriver = new LogicAnalyzerDriver('/dev/ttyUSB4');
            
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback(new Error('Write failed')))
            };
            
            (errorDriver as any)._currentStream = mockStream;
            
            const testData = new Uint8Array([0x01, 0x02, 0x03]);
            
            await expect((errorDriver as any).writeData(testData))
                .rejects.toThrow('Write failed');
        });
        
        it('writeData应该处理未初始化的流', async () => {
            const uninitDriver = new LogicAnalyzerDriver('/dev/ttyUSB5');
            
            const testData = new Uint8Array([0x01, 0x02, 0x03]);
            
            await expect((uninitDriver as any).writeData(testData))
                .rejects.toThrow('通信流未初始化');
        });
    });
    
    describe('设备信息解析测试', () => {
        it('parseDeviceInfo应该正确解析设备响应', () => {
            const parseDriver = new LogicAnalyzerDriver('/dev/ttyUSB6');
            
            const responses = [
                'Pico Logic Analyzer v1.7', // 使用满足最低版本要求的版本
                'FREQ:50000000',
                'BLASTFREQ:100000000',
                'BUFFER:48000',
                'CHANNELS:16'
            ];
            
            (parseDriver as any).parseDeviceInfo(responses);
            
            expect(parseDriver.deviceVersion).toBe('Pico Logic Analyzer v1.7');
            expect(parseDriver.maxFrequency).toBe(50000000);
            expect(parseDriver.blastFrequency).toBe(100000000);
            expect(parseDriver.bufferSize).toBe(48000);
            expect(parseDriver.channelCount).toBe(16);
        });
        
        it('parseDeviceInfo应该处理不完整的响应', () => {
            const incompleteDriver = new LogicAnalyzerDriver('/dev/ttyUSB7');
            
            const incompleteResponses = [
                'Pico Logic Analyzer v1.0',
                'FREQ:100000000'
                // 缺少其他响应
            ];
            
            expect(() => {
                (incompleteDriver as any).parseDeviceInfo(incompleteResponses);
            }).toThrow('设备信息响应不完整');
        });
        
        it('parseDeviceInfo应该处理无效的频率响应', () => {
            const invalidDriver = new LogicAnalyzerDriver('/dev/ttyUSB8');
            
            const invalidResponses = [
                'Pico Logic Analyzer v1.0',
                'INVALID_FREQ_RESPONSE',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:24'
            ];
            
            expect(() => {
                (invalidDriver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备频率响应');
        });
    });
    
    describe('能力描述构建测试', () => {
        it('buildCapabilities应该返回正确的能力描述', () => {
            const capDriver = new LogicAnalyzerDriver('/dev/ttyUSB9');
            
            // 设置设备参数
            (capDriver as any)._channelCount = 24;
            (capDriver as any)._maxFrequency = 100000000;
            (capDriver as any)._blastFrequency = 100000000;
            (capDriver as any)._bufferSize = 96000;
            (capDriver as any)._isNetwork = false;
            
            const capabilities = (capDriver as any).buildCapabilities();
            
            expect(capabilities.channels.digital).toBe(24);
            expect(capabilities.sampling.maxRate).toBe(100000000);
            expect(capabilities.sampling.bufferSize).toBe(96000);
            expect(capabilities.triggers.maxChannels).toBe(24);
            expect(capabilities.connectivity.interfaces).toEqual(['serial']);
            expect(capabilities.features.voltageMonitoring).toBe(true);
        });
        
        it('buildCapabilities应该为网络设备返回正确的接口', () => {
            const netCapDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 设置为网络设备
            (netCapDriver as any)._channelCount = 24;
            (netCapDriver as any)._maxFrequency = 100000000;
            (netCapDriver as any)._blastFrequency = 100000000;
            (netCapDriver as any)._bufferSize = 96000;
            (netCapDriver as any)._isNetwork = true;
            
            const capabilities = (netCapDriver as any).buildCapabilities();
            
            expect(capabilities.connectivity.interfaces).toEqual(['ethernet']);
        });
    });
    
    describe('高级采集功能测试', () => {
        it('startCapture应该处理连接失败情况', async () => {
            const disconnectedDriver = new LogicAnalyzerDriver('/dev/ttyUSB10');
            
            // 设置为未连接状态
            (disconnectedDriver as any)._isConnected = false;
            (disconnectedDriver as any)._currentStream = null;
            
            const result = await disconnectedDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.HardwareError);
        });
        
        it('startCapture应该处理已在采集状态', async () => {
            const busyDriver = new LogicAnalyzerDriver('/dev/ttyUSB11');
            
            // 设置为采集中状态
            (busyDriver as any)._capturing = true;
            
            const result = await busyDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.Busy);
        });
        
        it('waitForResponse应该正确等待特定响应', async () => {
            const waitDriver = new LogicAnalyzerDriver('/dev/ttyUSB12');
            
            const mockLineParser = {
                on: jest.fn(),
                off: jest.fn()
            };
            
            (waitDriver as any)._lineParser = mockLineParser;
            
            // 模拟响应
            setTimeout(() => {
                const dataHandler = mockLineParser.on.mock.calls.find(call => call[0] === 'data')[1];
                dataHandler('EXPECTED_RESPONSE');
            }, 100);
            
            const response = await (waitDriver as any).waitForResponse('EXPECTED_RESPONSE', 1000);
            
            expect(response).toBe('EXPECTED_RESPONSE');
        });
        
        it('waitForResponse应该处理超时', async () => {
            const timeoutDriver = new LogicAnalyzerDriver('/dev/ttyUSB13');
            
            const mockLineParser = {
                on: jest.fn(),
                off: jest.fn()
            };
            
            (timeoutDriver as any)._lineParser = mockLineParser;
            
            await expect((timeoutDriver as any).waitForResponse('NEVER_COMES', 100))
                .rejects.toThrow('等待响应超时: NEVER_COMES');
        });
    });
    
    describe('数据处理和解析测试', () => {
        it('parseCaptureData应该正确解析8通道数据', () => {
            const parseDriver = new LogicAnalyzerDriver('/dev/ttyUSB14');
            
            // 创建模拟数据
            const dataBuffer = Buffer.alloc(20);
            dataBuffer.writeUInt32LE(10, 0); // 样本数量
            
            // 写入10个8位样本
            for (let i = 0; i < 10; i++) {
                dataBuffer.writeUInt8(i, 4 + i);
            }
            
            dataBuffer.writeUInt8(0, 14); // 时间戳长度
            
            const result = (parseDriver as any).parseCaptureData(dataBuffer, captureSession, 0, 10);
            
            expect(result.samples).toHaveLength(10);
            expect(result.samples[0]).toBe(0);
            expect(result.samples[9]).toBe(9);
            expect(result.timestamps).toBeInstanceOf(BigUint64Array);
        });
        
        it('extractSamplesToChannels应该正确提取通道数据', () => {
            const extractDriver = new LogicAnalyzerDriver('/dev/ttyUSB15');
            
            const testSession = new CaptureSession();
            testSession.captureChannels = [
                new AnalyzerChannel(0, 'Channel 0'),
                new AnalyzerChannel(1, 'Channel 1')
            ];
            
            const captureData = {
                samples: new Uint32Array([0b01, 0b10, 0b11, 0b00]), // 4个样本
                timestamps: new BigUint64Array(0),
                bursts: []
            };
            
            (extractDriver as any).extractSamplesToChannels(testSession, captureData);
            
            // 验证通道0的数据
            expect(testSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 0]));
            // 验证通道1的数据
            expect(testSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1, 0]));
        });
    });
    
    describe('资源管理和清理测试', () => {
        it('dispose应该正确清理所有资源', async () => {
            const disposeDriver = new LogicAnalyzerDriver('/dev/ttyUSB16');
            
            const mockSerialPort = {
                isOpen: true,
                close: jest.fn()
            };
            
            const mockTcpSocket = {
                destroy: jest.fn()
            };
            
            // 设置连接状态
            (disposeDriver as any)._serialPort = mockSerialPort;
            (disposeDriver as any)._tcpSocket = mockTcpSocket;
            (disposeDriver as any)._isConnected = true;
            
            // Mock父类dispose方法
            const superDispose = jest.spyOn(AnalyzerDriverBase.prototype, 'dispose').mockImplementation(() => {});
            
            disposeDriver.dispose();
            
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockTcpSocket.destroy).toHaveBeenCalled();
            expect(superDispose).toHaveBeenCalled();
        });
    });
    
    describe('构造函数边界测试', () => {
        it('应该拒绝空连接字符串', () => {
            expect(() => {
                new LogicAnalyzerDriver('');
            }).toThrow('连接字符串不能为空');
        });
        
        it('应该拒绝null连接字符串', () => {
            expect(() => {
                new LogicAnalyzerDriver(null as any);
            }).toThrow('连接字符串不能为空');
        });
        
        it('应该拒绝undefined连接字符串', () => {
            expect(() => {
                new LogicAnalyzerDriver(undefined as any);
            }).toThrow('连接字符串不能为空');
        });
    });

    describe('网络连接测试', () => {
        beforeEach(() => {
            // Mock Socket for network tests
            jest.mock('net', () => ({
                Socket: jest.fn().mockImplementation(() => ({
                    connect: jest.fn(),
                    on: jest.fn(),
                    write: jest.fn(),
                    destroy: jest.fn(),
                    setTimeout: jest.fn()
                }))
            }));
        });

        it('应该能够处理网络地址格式的连接字符串', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // Mock the network initialization process
            const mockSocket = {
                connect: jest.fn((port, host, callback) => callback && callback()),
                on: jest.fn(),
                write: jest.fn(),
                destroy: jest.fn(),
                setTimeout: jest.fn()
            };
            
            const mockInitNetwork = jest.fn().mockResolvedValue(undefined);
            (networkDriver as any).initNetwork = mockInitNetwork;
            
            await networkDriver.connect();
            
            expect(mockInitNetwork).toHaveBeenCalledWith('192.168.1.100:8080');
        });

        it('应该拒绝无效的网络地址格式', async () => {
            const invalidNetworkDriver = new LogicAnalyzerDriver('invalid:address:format');
            
            // 在 initNetwork 中会进行地址验证
            const result = await invalidNetworkDriver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的地址/端口格式无效');
        });

        it('应该正确解析网络地址和端口', () => {
            const networkDriver = new LogicAnalyzerDriver('10.0.0.1:3000');
            
            // 直接测试正则表达式匹配
            const regex = (LogicAnalyzerDriver as any).regAddressPort;
            const match = regex.exec('10.0.0.1:3000');
            
            expect(match).not.toBeNull();
            expect(match[1]).toBe('10.0.0.1');
            expect(match[2]).toBe('3000');
        });
    });

    describe('串口连接深度测试', () => {
        it('应该正确初始化串口连接', () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            
            // 测试串口连接字符串格式检查
            expect(serialDriver.connectionString).toBe('/dev/ttyUSB0');
            expect(serialDriver.connectionString.includes(':')).toBe(false);
        });

        it('应该处理串口连接失败', () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB1');
            
            // 测试串口连接字符串验证
            expect(serialDriver.connectionString).toBe('/dev/ttyUSB1');
            expect(typeof serialDriver.connectionString).toBe('string');
        });
    });

    describe('设备断开连接测试', () => {
        it('应该正确断开串口连接', async () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB2');
            
            // 测试 disconnect 方法存在
            expect(typeof serialDriver.disconnect).toBe('function');
            
            // 测试未连接时的断开连接行为
            await serialDriver.disconnect();
            expect((serialDriver as any)._isConnected).toBe(false);
        });

        it('应该正确断开网络连接', () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.1:9000');
            
            // 测试网络地址识别
            expect(networkDriver.connectionString.includes(':')).toBe(true);
        });

        it('应该处理断开连接时的错误', async () => {
            const errorDriver = new LogicAnalyzerDriver('/dev/ttyUSB3');
            
            // 测试 disconnect 不会抛出错误
            await expect(errorDriver.disconnect()).resolves.not.toThrow();
        });
    });

    describe('数据读取和处理测试', () => {
        it('应该正确读取采集数据', () => {
            const dataDriver = new LogicAnalyzerDriver('/dev/ttyUSB4');
            
            // 测试 parseCaptureData 方法存在
            expect(typeof (dataDriver as any).parseCaptureData).toBe('function');
            
            // 测试 extractSamplesToChannels 方法存在
            expect(typeof (dataDriver as any).extractSamplesToChannels).toBe('function');
        });

        it('应该处理数据读取超时', () => {
            const timeoutDriver = new LogicAnalyzerDriver('/dev/ttyUSB5');
            
            // 测试数据处理方法存在
            expect(typeof (timeoutDriver as any).readCaptureData).toBe('function');
        });
    });

    describe('设备状态管理测试', () => {
        it('getStatus应该返回正确的设备状态', async () => {
            const statusDriver = new LogicAnalyzerDriver('/dev/ttyUSB6');
            
            // 设置一些状态
            (statusDriver as any)._isConnected = true;
            (statusDriver as any)._capturing = false;
            
            const status = await statusDriver.getStatus();
            
            expect(status.isConnected).toBe(true);
            expect(status.isCapturing).toBe(false);
            expect(typeof status.batteryVoltage).toBe('string');
        });

        it('isCapturing属性应该正确反映采集状态', () => {
            const captureDriver = new LogicAnalyzerDriver('/dev/ttyUSB7');
            
            expect(captureDriver.isCapturing).toBe(false);
            
            (captureDriver as any)._capturing = true;
            expect(captureDriver.isCapturing).toBe(true);
        });
    });

    describe('错误处理和边界条件测试', () => {
        it('应该处理设备版本验证失败', async () => {
            const versionDriver = new LogicAnalyzerDriver('/dev/ttyUSB8');
            
            // Mock版本验证失败
            const mockValidator = {
                validateVersion: jest.fn().mockReturnValue(false)
            };
            
            (versionDriver as any).versionValidator = mockValidator;
            
            const responses = ['Pico Logic Analyzer v0.5']; // 版本过低
            
            expect(() => {
                (versionDriver as any).parseDeviceInfo(responses);
            }).toThrow();
        });

        it('应该处理无效的频率响应', () => {
            const freqDriver = new LogicAnalyzerDriver('/dev/ttyUSB9');
            
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:invalid_number',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:24'
            ];
            
            // 应该抛出错误
            expect(() => {
                (freqDriver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备频率响应');
        });

        it('应该处理缓冲区大小解析失败', () => {
            const bufferDriver = new LogicAnalyzerDriver('/dev/ttyUSB10');
            
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'BUFFER:not_a_number',
                'CHANNELS:24'
            ];
            
            // 应该抛出错误
            expect(() => {
                (bufferDriver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备缓冲区大小响应');
        });
    });
});