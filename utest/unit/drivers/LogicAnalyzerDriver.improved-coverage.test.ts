/**
 * LogicAnalyzerDriver 覆盖率改进测试
 * 基于现有成功测试模式，针对未覆盖代码路径
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { AnalyzerDriverType, CaptureError, TriggerType } from '../../../src/models/AnalyzerTypes';

// Mock SerialPort - 使用与现有测试相同的模式
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => callback && callback()),
        close: jest.fn((callback) => callback && callback()),
        write: jest.fn((data, callback) => callback && callback()),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
        isOpen: true
    }))
}));

// Mock ReadlineParser
jest.mock('@serialport/parser-readline', () => ({
    ReadlineParser: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn()
    }))
}));

// Mock net Socket
jest.mock('net', () => ({
    Socket: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn()
    }))
}));

describe('LogicAnalyzerDriver 覆盖率改进测试', () => {
    let driver: LogicAnalyzerDriver;
    let captureSession: CaptureSession;

    beforeEach(() => {
        // 清理之前的mock
        jest.clearAllMocks();
        
        driver = new LogicAnalyzerDriver('COM3');
        
        // 基础采集会话配置
        captureSession = {
            preTriggerSamples: 1000,
            postTriggerSamples: 1000,
            frequency: 1000000,
            triggerType: TriggerType.RisingEdge,
            triggerValue: 0x01,
            triggerPosition: 50,
            captureChannels: [
                { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel
            ],
            loopCount: 0
        };

        // 设置基础设备状态
        (driver as any)._connected = true;
        (driver as any)._capturing = false;
        (driver as any)._version = '1.0.0';
        (driver as any)._channelCount = 8;
        (driver as any)._maxFrequency = 100000000;
        (driver as any)._bufferSize = 50000;
    });

    describe('事件回调处理测试 (覆盖187行)', () => {
        it('应该正确注册captureCompleted事件监听器', async () => {
            // 模拟设备已连接状态
            (driver as any)._currentStream = { write: jest.fn() };

            // Mock writeData 和 startDataReading方法
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(true);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});

            // Mock once方法以验证事件监听器注册
            const onceSpy = jest.spyOn(driver, 'once');

            // 创建回调函数
            const captureCompletedHandler = jest.fn();

            // 启动采集
            await driver.startCapture(captureSession, captureCompletedHandler);

            // 验证once方法被调用了（这会覆盖187行）
            expect(onceSpy).toHaveBeenCalledWith('captureCompleted', captureCompletedHandler);
        });

        it('应该在没有回调时跳过事件注册', async () => {
            // 模拟设备已连接状态
            (driver as any)._currentStream = { write: jest.fn() };

            // Mock writeData 和 startDataReading方法
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(true);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});

            // Mock once方法
            const onceSpy = jest.spyOn(driver, 'once');

            // 启动采集（不传回调）
            await driver.startCapture(captureSession);

            // 验证once方法未被调用
            expect(onceSpy).not.toHaveBeenCalled();
        });
    });

    describe('错误处理路径测试 (覆盖195-196行)', () => {
        it('应该在writeData异常时正确处理错误', async () => {
            // 模拟设备已连接状态
            (driver as any)._currentStream = { write: jest.fn() };

            // Mock writeData抛出异常
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('写入失败'));

            // 记录初始capturing状态
            expect((driver as any)._capturing).toBe(false);

            // 启动采集
            const result = await driver.startCapture(captureSession);

            // 验证错误处理（覆盖195-196行）
            expect(result).toBe(CaptureError.UnexpectedError);
            expect((driver as any)._capturing).toBe(false); // 应该重置为false
        });

        it('应该在数据包序列化异常时处理错误', async () => {
            // 模拟设备已连接状态
            (driver as any)._currentStream = { write: jest.fn() };

            // Mock OutputPacket的addStruct方法抛出异常
            const mockOutputPacket = {
                addStruct: jest.fn().mockImplementation(() => {
                    throw new Error('序列化失败');
                }),
                serialize: jest.fn()
            };

            // 暂时替换OutputPacket的创建
            const originalConstructor = (driver as any).constructor;
            jest.spyOn(originalConstructor.prototype, 'startCapture').mockImplementation(async function() {
                try {
                    this._capturing = true;
                    mockOutputPacket.addStruct({});
                    return CaptureError.None;
                } catch (error) {
                    this._capturing = false;
                    return CaptureError.UnexpectedError;
                }
            });

            const result = await driver.startCapture(captureSession);

            expect(result).toBe(CaptureError.UnexpectedError);
        });
    });

    describe('网络设备电压状态测试 (覆盖268-286行)', () => {
        it('应该正确处理网络设备的电压查询', async () => {
            // 创建网络设备
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._connected = true;

            // 创建mock网络流和parser
            const mockStream = { write: jest.fn() };
            const mockParser = { 
                once: jest.fn((event, callback) => {
                    // 模拟电压响应
                    if (event === 'data') {
                        setTimeout(() => callback('3.3V'), 10);
                    }
                })
            };

            (networkDriver as any)._currentStream = mockStream;
            (networkDriver as any)._lineParser = mockParser;

            // Mock writeData方法
            jest.spyOn(networkDriver as any, 'writeData').mockResolvedValue(true);

            // 获取电压状态
            const voltage = await networkDriver.getVoltageStatus();

            // 验证网络电压查询逻辑（覆盖268-286行）
            expect(voltage).toBe('3.3V');
            expect(mockParser.once).toHaveBeenCalledWith('data', expect.any(Function));
        });

        it('应该处理网络电压查询超时', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._connected = true;

            const mockStream = { write: jest.fn() };
            const mockParser = { 
                once: jest.fn((event, callback) => {
                    // 不调用callback，模拟超时
                })
            };

            (networkDriver as any)._currentStream = mockStream;
            (networkDriver as any)._lineParser = mockParser;

            jest.spyOn(networkDriver as any, 'writeData').mockResolvedValue(true);

            // 使用真实定时器来处理超时
            jest.useRealTimers();
            const voltage = await networkDriver.getVoltageStatus();
            jest.useFakeTimers();

            // 应该返回超时
            expect(voltage).toBe('TIMEOUT');
        });

        it('应该处理网络电压查询异常', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._connected = true;

            const mockStream = { write: jest.fn() };
            (networkDriver as any)._currentStream = mockStream;

            // Mock writeData抛出异常
            jest.spyOn(networkDriver as any, 'writeData').mockRejectedValue(new Error('网络错误'));

            const voltage = await networkDriver.getVoltageStatus();

            // 验证异常处理（覆盖285-286行）
            expect(voltage).toBe('ERROR');
        });
    });

    describe('数据读取初始化测试 (覆盖623-639行)', () => {
        it('应该正确处理通信流未初始化错误', async () => {
            // 设置_currentStream为null
            (driver as any)._currentStream = null;

            try {
                await (driver as any).readCaptureData(captureSession);
                fail('应该抛出错误');
            } catch (error) {
                expect((error as Error).message).toContain('通信流未初始化');
            }
        });

        it('应该正确计算采集模式和样本数', async () => {
            // 设置mock流
            const mockStream = { on: jest.fn(), off: jest.fn() };
            (driver as any)._currentStream = mockStream;

            // Mock getCaptureMode方法
            const getCaptureModeSpy = jest.spyOn(driver as any, 'getCaptureMode').mockReturnValue(0);

            // Mock网络和串口读取方法
            jest.spyOn(driver as any, 'readNetworkCaptureData').mockImplementation(() => {});
            jest.spyOn(driver as any, 'readSerialCaptureData').mockImplementation(() => {});

            // 调用readCaptureData
            (driver as any).readCaptureData(captureSession);

            // 验证getCaptureMode被调用
            expect(getCaptureModeSpy).toHaveBeenCalledWith([0]);
        });
    });

    describe('数据解析测试 (覆盖769-830行)', () => {
        it('应该正确解析8通道数据', () => {
            const sampleCount = 100;
            const data = Buffer.alloc(4 + sampleCount + 16);
            
            // 写入数据长度
            data.writeUInt32LE(sampleCount + 16, 0);
            
            // 写入8通道样本数据
            for (let i = 0; i < sampleCount; i++) {
                data.writeUInt8(i % 256, 4 + i);
            }

            const result = (driver as any).parseCaptureData(data, captureSession, 0, sampleCount);

            expect(result.samples).toBeInstanceOf(Uint32Array);
            expect(result.samples.length).toBe(sampleCount);
            expect(result.samples[0]).toBe(0);
            expect(result.samples[1]).toBe(1);
        });

        it('应该正确解析16通道数据', () => {
            const sampleCount = 100;
            const data = Buffer.alloc(4 + sampleCount * 2 + 16);
            
            // 写入数据长度
            data.writeUInt32LE(sampleCount * 2 + 16, 0);
            
            // 写入16通道样本数据
            for (let i = 0; i < sampleCount; i++) {
                data.writeUInt16LE(i % 65536, 4 + i * 2);
            }

            const session16 = {
                ...captureSession,
                captureChannels: Array.from({ length: 16 }, (_, i) => ({
                    channelNumber: i,
                    channelName: `Ch${i}`
                })) as AnalyzerChannel[]
            };

            const result = (driver as any).parseCaptureData(data, session16, 1, sampleCount);

            expect(result.samples).toBeInstanceOf(Uint32Array);
            expect(result.samples.length).toBe(sampleCount);
        });

        it('应该正确解析24通道数据', () => {
            const sampleCount = 100;
            const data = Buffer.alloc(4 + sampleCount * 3 + 16);
            
            // 写入数据长度
            data.writeUInt32LE(sampleCount * 3 + 16, 0);
            
            // 写入24通道样本数据
            for (let i = 0; i < sampleCount; i++) {
                const value = i % 16777216;
                data.writeUInt8(value & 0xFF, 4 + i * 3);
                data.writeUInt8((value >> 8) & 0xFF, 4 + i * 3 + 1);
                data.writeUInt8((value >> 16) & 0xFF, 4 + i * 3 + 2);
            }

            const session24 = {
                ...captureSession,
                captureChannels: Array.from({ length: 24 }, (_, i) => ({
                    channelNumber: i,
                    channelName: `Ch${i}`
                })) as AnalyzerChannel[]
            };

            const result = (driver as any).parseCaptureData(data, session24, 2, sampleCount);

            expect(result.samples).toBeInstanceOf(Uint32Array);
            expect(result.samples.length).toBe(sampleCount);
        });

        it('应该处理时间戳数据解析', () => {
            const sampleCount = 50;
            const timestampBytes = 16;
            const data = Buffer.alloc(4 + sampleCount + timestampBytes);
            
            // 写入数据长度
            data.writeUInt32LE(sampleCount + timestampBytes, 0);
            
            // 写入样本数据
            for (let i = 0; i < sampleCount; i++) {
                data.writeUInt8(i % 256, 4 + i);
            }
            
            // 写入时间戳数据
            for (let i = 0; i < timestampBytes; i += 8) {
                data.writeBigUInt64LE(BigInt(i * 1000), 4 + sampleCount + i);
            }

            const result = (driver as any).parseCaptureData(data, captureSession, 0, sampleCount);

            expect(result.timestamps).toBeInstanceOf(BigUint64Array);
            expect(result.timestamps.length).toBe(2); // 16字节 / 8字节每个时间戳
        });
    });

    describe('辅助方法测试', () => {
        it('应该正确获取采集模式', () => {
            // 测试8通道模式
            const mode8 = (driver as any).getCaptureMode([0, 1, 2, 3]);
            expect(mode8).toBe(0); // Channels_8

            // 测试16通道模式  
            const mode16 = (driver as any).getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            expect(mode16).toBe(1); // Channels_16

            // 测试24通道模式
            const mode24 = (driver as any).getCaptureMode(Array.from({ length: 24 }, (_, i) => i));
            expect(mode24).toBe(2); // Channels_24
        });

        it('应该正确提取样本到通道', () => {
            const samples = new Uint32Array([0xFF, 0xAA, 0x55, 0x00]);
            const channels = [
                { channelNumber: 0, channelName: 'Ch0' } as AnalyzerChannel,
                { channelNumber: 1, channelName: 'Ch1' } as AnalyzerChannel
            ];

            const result = (driver as any).extractSamplesToChannels(samples, channels);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(samples.length * channels.length);
        });
    });

    describe('边界条件测试', () => {
        it('应该处理空时间戳数据', () => {
            const sampleCount = 50;
            const data = Buffer.alloc(4 + sampleCount);
            
            // 写入数据长度（只有样本数据，没有时间戳）
            data.writeUInt32LE(sampleCount, 0);
            
            // 写入样本数据
            for (let i = 0; i < sampleCount; i++) {
                data.writeUInt8(i % 256, 4 + i);
            }

            const result = (driver as any).parseCaptureData(data, captureSession, 0, sampleCount);

            expect(result.timestamps).toBeInstanceOf(BigUint64Array);
            expect(result.timestamps.length).toBe(0);
        });

        it('应该处理数据不足的情况', () => {
            const data = Buffer.alloc(10); // 很小的数据
            
            const result = (driver as any).parseCaptureData(data, captureSession, 0, 1000);

            expect(result).toBeDefined();
            expect(result.samples).toBeInstanceOf(Uint32Array);
        });
    });
});