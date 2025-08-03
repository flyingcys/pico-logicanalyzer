/**
 * LogicAnalyzerDriver 综合最终覆盖率测试
 * 2025-08-03 基于覆盖率分析，专门覆盖未测试的代码路径
 * 目标：从29.21%提升到80%+覆盖率
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType, CaptureMode } from '../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');

describe('LogicAnalyzerDriver - 综合最终覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockLineParser: jest.Mocked<ReadlineParser>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // 创建更完整的mock对象
        mockSerialPort = {
            isOpen: false,
            open: jest.fn(),
            close: jest.fn(),
            write: jest.fn().mockImplementation((data, callback) => {
                if (callback) callback(null);
                return true;
            }),
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockSocket = {
            connect: jest.fn().mockImplementation((port, host, callback) => {
                if (callback) setTimeout(callback, 10);
                return mockSocket;
            }),
            write: jest.fn().mockImplementation((data, callback) => {
                if (callback) callback(null);
                return true;
            }),
            on: jest.fn(),
            off: jest.fn(),
            destroy: jest.fn(),
            end: jest.fn(),
            removeAllListeners: jest.fn(),
            pipe: jest.fn().mockReturnThis()
        } as any;

        mockLineParser = {
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        // Mock构造函数
        (SerialPort as jest.MockedClass<typeof SerialPort>).mockImplementation(() => mockSerialPort);
        (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket);
        (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockLineParser);

        driver = new LogicAnalyzerDriver('COM3');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('完整连接功能测试 - 覆盖357-439行', () => {
        test('串口连接完整流程 - 成功', async () => {
            // 模拟成功的串口连接
            mockSerialPort.open.mockImplementation((callback) => {
                setTimeout(() => callback(null), 10);
            });

            // 模拟设备初始化成功
            jest.spyOn(driver as any, 'initializeDevice').mockResolvedValue(undefined);

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(50);
            
            const result = await connectPromise;
            expect(result.success).toBe(true);
            expect(mockSerialPort.open).toHaveBeenCalled();
        });

        test('串口连接失败', async () => {
            // 模拟串口连接失败
            mockSerialPort.open.mockImplementation((callback) => {
                setTimeout(() => callback(new Error('Port not found')), 10);
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(50);
            
            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('串口连接失败');
        });

        test('网络连接完整流程 - 成功', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 模拟成功的网络连接
            mockSocket.connect.mockImplementation((port, host, callback) => {
                setTimeout(() => callback!(), 10);
                return mockSocket;
            });

            // 模拟设备初始化成功
            jest.spyOn(networkDriver as any, 'initializeDevice').mockResolvedValue(undefined);

            const connectPromise = networkDriver.connect();
            jest.advanceTimersByTime(50);
            
            const result = await connectPromise;
            expect(result.success).toBe(true);
        });

        test('网络连接 - 无效地址格式', async () => {
            const invalidDriver = new LogicAnalyzerDriver('invalid:address:format');
            
            const result = await invalidDriver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('无效');
        });

        test('网络连接 - 无效端口号', async () => {
            const invalidDriver = new LogicAnalyzerDriver('192.168.1.100:999999');
            
            const result = await invalidDriver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('端口号无效');
        });

        test('网络连接失败', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 模拟网络连接失败
            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(new Error('Connection refused')), 10);
                }
            });

            const connectPromise = networkDriver.connect();
            jest.advanceTimersByTime(50);
            
            const result = await connectPromise;
            expect(result.success).toBe(false);
        });
    });

    describe('设备初始化完整测试 - 覆盖449-522行', () => {
        beforeEach(() => {
            // 设置连接状态
            (driver as any)._currentStream = mockLineParser;
            (driver as any)._lineParser = mockLineParser;
        });

        test('设备初始化 - 通信流未初始化', async () => {
            (driver as any)._currentStream = undefined;
            
            try {
                await (driver as any).initializeDevice();
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('通信流未初始化');
            }
        });

        test('设备信息读取超时', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            
            // 模拟读取超时
            mockLineParser.on.mockImplementation((event, callback) => {
                // 不调用callback，模拟超时
            });

            const initPromise = (driver as any).initializeDevice();
            jest.advanceTimersByTime(15000);
            
            try {
                await initPromise;
                fail('应该抛出超时错误');
            } catch (error) {
                expect(error.message).toContain('设备信息读取超时');
            }
        });

        test('设备信息解析 - 响应不完整', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            
            // 模拟不完整响应
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => {
                        callback('Version 1.0.0');
                        callback('FREQ:1000000');
                        // 少于5行响应
                    }, 10);
                }
            });

            const initPromise = (driver as any).initializeDevice();
            jest.advanceTimersByTime(50);
            
            try {
                await initPromise;
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('设备信息响应不完整');
            }
        });

        test('设备信息解析 - 频率响应无效', async () => {
            const responses = [
                'Version 1.0.0',
                'INVALID_FREQ:1000000',  // 无效格式
                'BLASTFREQ:50000000',
                'BUFFER:512000',
                'CHANNELS:24'
            ];

            try {
                (driver as any).parseDeviceInfo(responses);
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('无效的设备频率响应');
            }
        });

        test('设备信息解析 - 各种无效响应', async () => {
            // 测试突发频率无效
            const invalidBlastResponses = [
                'Version 1.0.0',
                'FREQ:1000000',
                'INVALID_BLAST:50000000',
                'BUFFER:512000',
                'CHANNELS:24'
            ];

            expect(() => {
                (driver as any).parseDeviceInfo(invalidBlastResponses);
            }).toThrow('无效的设备突发频率响应');

            // 测试缓冲区无效
            const invalidBufferResponses = [
                'Version 1.0.0',
                'FREQ:1000000',
                'BLASTFREQ:50000000',
                'INVALID_BUFFER:512000',
                'CHANNELS:24'
            ];

            expect(() => {
                (driver as any).parseDeviceInfo(invalidBufferResponses);
            }).toThrow('无效的设备缓冲区大小响应');

            // 测试通道数无效
            const invalidChannelResponses = [
                'Version 1.0.0',
                'FREQ:1000000',
                'BLASTFREQ:50000000',
                'BUFFER:512000',
                'INVALID_CHANNELS:24'
            ];

            expect(() => {
                (driver as any).parseDeviceInfo(invalidChannelResponses);
            }).toThrow('无效的设备通道数响应');
        });

        test('设备信息解析 - 数值边界条件', async () => {
            // 测试零频率
            const zeroFreqResponses = [
                'Version 1.0.0',
                'FREQ:0',
                'BLASTFREQ:50000000',
                'BUFFER:512000',
                'CHANNELS:24'
            ];

            expect(() => {
                (driver as any).parseDeviceInfo(zeroFreqResponses);
            }).toThrow('设备频率值无效');

            // 测试过大通道数
            const invalidChannelCountResponses = [
                'Version 1.0.0',
                'FREQ:1000000',
                'BLASTFREQ:50000000',
                'BUFFER:512000',
                'CHANNELS:25'  // 超过24
            ];

            expect(() => {
                (driver as any).parseDeviceInfo(invalidChannelCountResponses);
            }).toThrow('设备通道数值无效');
        });

        test('设备信息解析 - 版本验证失败', async () => {
            // Mock VersionValidator返回无效版本
            const VersionValidator = require('../../../src/drivers/VersionValidator').VersionValidator;
            jest.spyOn(VersionValidator, 'getVersion').mockReturnValue({ isValid: false });

            const responses = [
                'Version 0.1.0',  // 版本过低
                'FREQ:1000000',
                'BLASTFREQ:50000000',
                'BUFFER:512000',
                'CHANNELS:24'
            ];

            expect(() => {
                (driver as any).parseDeviceInfo(responses);
            }).toThrow('无效的设备版本');
        });

        test('设备信息解析 - 完整成功流程', async () => {
            // Mock VersionValidator返回有效版本
            const VersionValidator = require('../../../src/drivers/VersionValidator').VersionValidator;
            jest.spyOn(VersionValidator, 'getVersion').mockReturnValue({ isValid: true });

            const responses = [
                'Version 1.2.3',
                'FREQ:10000000',
                'BLASTFREQ:50000000',
                'BUFFER:512000',
                'CHANNELS:24'
            ];

            (driver as any).parseDeviceInfo(responses);

            expect((driver as any)._version).toBe('Version 1.2.3');
            expect((driver as any)._maxFrequency).toBe(10000000);
            expect((driver as any)._blastFrequency).toBe(50000000);
            expect((driver as any)._bufferSize).toBe(512000);
            expect((driver as any)._channelCount).toBe(24);
        });
    });

    describe('数据写入和响应等待测试 - 覆盖540-606行', () => {
        beforeEach(() => {
            (driver as any)._currentStream = mockLineParser;
            (driver as any)._lineParser = mockLineParser;
        });

        test('writeData - 通信流未初始化', async () => {
            (driver as any)._currentStream = undefined;
            
            try {
                await (driver as any).writeData(new Uint8Array([1, 2, 3]));
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('通信流未初始化');
            }
        });

        test('writeData - 写入成功', async () => {
            const testData = new Uint8Array([1, 2, 3]);
            
            const result = await (driver as any).writeData(testData);
            expect(result).toBeUndefined();
            expect(mockLineParser.write).toHaveBeenCalledWith(Buffer.from(testData), expect.any(Function));
        });

        test('writeData - 写入失败', async () => {
            const testData = new Uint8Array([1, 2, 3]);
            
            mockLineParser.write.mockImplementation((data, callback) => {
                callback(new Error('Write failed'));
                return false;
            });

            try {
                await (driver as any).writeData(testData);
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toBe('Write failed');
            }
        });

        test('waitForResponse - 成功接收预期响应', async () => {
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('EXPECTED_RESPONSE'), 10);
                }
            });

            const responsePromise = (driver as any).waitForResponse('EXPECTED_RESPONSE', 1000);
            jest.advanceTimersByTime(50);
            
            const result = await responsePromise;
            expect(result).toBe('EXPECTED_RESPONSE');
            expect(mockLineParser.off).toHaveBeenCalled();
        });

        test('waitForResponse - 超时', async () => {
            mockLineParser.on.mockImplementation((event, callback) => {
                // 不调用callback，模拟超时
            });

            const responsePromise = (driver as any).waitForResponse('EXPECTED_RESPONSE', 1000);
            jest.advanceTimersByTime(1500);
            
            try {
                await responsePromise;
                fail('应该超时');
            } catch (error) {
                expect(error.message).toContain('等待响应超时');
            }
        });

        test('waitForResponse - 接收到其他响应后接收到预期响应', async () => {
            let callCount = 0;
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => {
                        callCount++;
                        if (callCount === 1) {
                            callback('OTHER_RESPONSE');
                        } else if (callCount === 2) {
                            callback('EXPECTED_RESPONSE');
                        }
                    }, 10 * callCount);
                }
            });

            const responsePromise = (driver as any).waitForResponse('EXPECTED_RESPONSE', 1000);
            jest.advanceTimersByTime(100);
            
            const result = await responsePromise;
            expect(result).toBe('EXPECTED_RESPONSE');
        });
    });

    describe('完整采集功能测试 - 覆盖162-196行', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            captureSession = {
                captureChannels: [
                    { channelNumber: 0, channelName: 'Channel 0' } as AnalyzerChannel,
                    { channelNumber: 1, channelName: 'Channel 1' } as AnalyzerChannel
                ],
                frequency: 10000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                loopCount: 5,
                measureBursts: true,
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false
            } as CaptureSession;

            // 设置设备为已连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockLineParser;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 512000;
        });

        test('startCapture - 完整成功流程', async () => {
            jest.spyOn(driver as any, 'getCaptureMode').mockReturnValue(1);
            jest.spyOn(driver as any, 'validateSettings').mockReturnValue(true);
            jest.spyOn(driver as any, 'composeRequest').mockReturnValue({});
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockResolvedValue(undefined);

            const mockHandler = jest.fn();
            const result = await driver.startCapture(captureSession, mockHandler);
            
            expect(result).toBe(CaptureError.None);
            expect((driver as any)._capturing).toBe(true);
        });

        test('startCapture - 参数验证失败', async () => {
            jest.spyOn(driver as any, 'getCaptureMode').mockReturnValue(1);
            jest.spyOn(driver as any, 'validateSettings').mockReturnValue(false);

            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.BadParams);
            expect((driver as any)._capturing).toBe(false);
        });

        test('startCapture - 写入数据异常', async () => {
            jest.spyOn(driver as any, 'getCaptureMode').mockReturnValue(1);
            jest.spyOn(driver as any, 'validateSettings').mockReturnValue(true);
            jest.spyOn(driver as any, 'composeRequest').mockReturnValue({});
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('Write failed'));

            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.UnexpectedError);
            expect((driver as any)._capturing).toBe(false);
        });

        test('startCapture - 不同触发类型的采集模式计算', async () => {
            // 测试8通道模式
            const session8 = { ...captureSession };
            session8.captureChannels = Array.from({length: 8}, (_, i) => 
                ({ channelNumber: i, channelName: `Channel ${i}` } as AnalyzerChannel)
            );

            jest.spyOn(driver as any, 'validateSettings').mockReturnValue(true);
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);

            await driver.startCapture(session8);
            expect((driver as any).getCaptureMode).toHaveBeenCalledWith([0,1,2,3,4,5,6,7]);

            // 测试16通道模式
            const session16 = { ...captureSession };
            session16.captureChannels = Array.from({length: 16}, (_, i) => 
                ({ channelNumber: i, channelName: `Channel ${i}` } as AnalyzerChannel)
            );

            await driver.startCapture(session16);
            expect((driver as any).getCaptureMode).toHaveBeenCalledWith(Array.from({length: 16}, (_, i) => i));
        });
    });

    describe('电压状态完整测试 - 覆盖265,281-286行', () => {
        test('getVoltageStatus - 网络设备完整流程', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = true;
            (driver as any)._currentStream = mockLineParser;
            (driver as any)._lineParser = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);

            // 模拟延迟响应
            mockLineParser.once.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('5.0V'), 100);
                }
            });

            const voltagePromise = driver.getVoltageStatus();
            jest.advanceTimersByTime(200);
            
            const voltage = await voltagePromise;
            expect(voltage).toBe('5.0V');
        });

        test('getVoltageStatus - 网络设备超时', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = true;
            (driver as any)._currentStream = mockLineParser;
            (driver as any)._lineParser = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);

            // 不响应，模拟超时
            mockLineParser.once.mockImplementation(() => {});

            const voltagePromise = driver.getVoltageStatus();
            jest.advanceTimersByTime(6000);
            
            const voltage = await voltagePromise;
            expect(voltage).toBe('TIMEOUT');
        });

        test('getVoltageStatus - 串口设备模拟电压', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = false;
            (driver as any)._currentStream = mockLineParser;

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('3.3V');
        });

        test('getVoltageStatus - 异常处理', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = true;
            (driver as any)._currentStream = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('Write failed'));

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('ERROR');
        });
    });

    describe('停止采集完整测试 - 覆盖224-225行', () => {
        test('stopCapture - 写入停止命令失败', async () => {
            (driver as any)._capturing = true;
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('Write failed'));

            const result = await driver.stopCapture();
            expect(result).toBe(false);
            expect((driver as any)._capturing).toBe(false);
        });

        test('stopCapture - 重连失败', async () => {
            (driver as any)._capturing = true;
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'reconnectDevice').mockRejectedValue(new Error('Reconnect failed'));

            const resultPromise = driver.stopCapture();
            jest.advanceTimersByTime(3000);
            
            const result = await resultPromise;
            expect(result).toBe(false);
            expect((driver as any)._capturing).toBe(false);
        });
    });

    describe('引导程序完整测试 - 覆盖249行', () => {
        test('enterBootloader - 收到预期响应', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('RESTARTING_BOOTLOADER');

            const result = await driver.enterBootloader();
            expect(result).toBe(true);
        });

        test('enterBootloader - 收到意外响应', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('UNEXPECTED_RESPONSE');

            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        test('enterBootloader - 写入异常', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('Write failed'));

            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });
    });

    describe('重连设备完整测试 - 覆盖971-1116行', () => {
        test('reconnectDevice - 网络设备重连成功', async () => {
            (driver as any)._isNetwork = true;
            (driver as any)._tcpSocket = mockSocket;
            (driver as any)._devAddr = '192.168.1.100';
            (driver as any)._devPort = 8080;

            mockSocket.connect.mockImplementation((port, host, callback) => {
                setTimeout(() => callback!(), 10);
                return mockSocket;
            });

            const reconnectPromise = (driver as any).reconnectDevice();
            jest.advanceTimersByTime(50);
            
            await reconnectPromise;
            expect(mockSocket.destroy).toHaveBeenCalled();
            expect(mockSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
        });

        test('reconnectDevice - 网络设备重连失败', async () => {
            (driver as any)._isNetwork = true;
            (driver as any)._tcpSocket = mockSocket;
            (driver as any)._devAddr = '192.168.1.100';
            (driver as any)._devPort = 8080;

            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(new Error('Connection failed')), 10);
                }
            });

            const reconnectPromise = (driver as any).reconnectDevice();
            jest.advanceTimersByTime(50);
            
            try {
                await reconnectPromise;
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('网络重连失败');
            }
        });

        test('reconnectDevice - 串口设备重连成功', async () => {
            (driver as any)._isNetwork = false;
            (driver as any)._serialPort = mockSerialPort;
            mockSerialPort.isOpen = true;

            mockSerialPort.open.mockImplementation((callback) => {
                setTimeout(() => callback(null), 10);
            });

            const reconnectPromise = (driver as any).reconnectDevice();
            jest.advanceTimersByTime(50);
            
            await reconnectPromise;
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockSerialPort.open).toHaveBeenCalled();
        });

        test('reconnectDevice - 串口设备重连失败', async () => {
            (driver as any)._isNetwork = false;
            (driver as any)._serialPort = mockSerialPort;

            mockSerialPort.open.mockImplementation((callback) => {
                setTimeout(() => callback(new Error('Port open failed')), 10);
            });

            const reconnectPromise = (driver as any).reconnectDevice();
            jest.advanceTimersByTime(50);
            
            try {
                await reconnectPromise;
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('串口重连失败');
            }
        });
    });

    describe('验证设置完整测试 - 覆盖1072-1131行', () => {
        beforeEach(() => {
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 512000;
            (driver as any)._blastFrequency = 50000000;
        });

        test('validateSettings - Edge触发验证', () => {
            const session = {
                triggerType: TriggerType.Edge,
                captureChannels: [{ channelNumber: 0 }],
                triggerChannel: 0,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                frequency: 10000000,
                loopCount: 5
            } as any;

            const result = (driver as any).validateSettings(session, 10000);
            expect(result).toBe(true);
        });

        test('validateSettings - Blast触发验证', () => {
            const session = {
                triggerType: TriggerType.Blast,
                captureChannels: [{ channelNumber: 0 }],
                triggerChannel: 0,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                frequency: 50000000,
                loopCount: 255
            } as any;

            const result = (driver as any).validateSettings(session, 10000);
            expect(result).toBe(true);
        });

        test('validateSettings - Complex触发验证', () => {
            const session = {
                triggerType: TriggerType.Complex,
                captureChannels: [{ channelNumber: 0 }],
                triggerChannel: 0,
                triggerBitCount: 8,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                frequency: 10000000
            } as any;

            const result = (driver as any).validateSettings(session, 10000);
            expect(result).toBe(true);
        });

        test('validateSettings - Fast触发验证', () => {
            const session = {
                triggerType: TriggerType.Fast,
                captureChannels: [{ channelNumber: 0 }],
                triggerChannel: 0,
                triggerBitCount: 3,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                frequency: 10000000
            } as any;

            const result = (driver as any).validateSettings(session, 10000);
            expect(result).toBe(true);
        });

        test('validateSettings - 无效参数测试', () => {
            const invalidSession = {
                triggerType: TriggerType.Edge,
                captureChannels: [{ channelNumber: 25 }], // 超出范围
                triggerChannel: 0,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                frequency: 10000000,
                loopCount: 5
            } as any;

            const result = (driver as any).validateSettings(invalidSession, 10000);
            expect(result).toBe(false);
        });
    });

    describe('构建能力和限制测试', () => {
        beforeEach(() => {
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 512000;
            (driver as any)._blastFrequency = 50000000;
            (driver as any)._isNetwork = false;
        });

        test('buildCapabilities - 完整能力描述', () => {
            const capabilities = (driver as any).buildCapabilities();
            
            expect(capabilities).toHaveProperty('channels');
            expect(capabilities).toHaveProperty('sampling');
            expect(capabilities).toHaveProperty('triggers');
            expect(capabilities).toHaveProperty('connectivity');
            expect(capabilities).toHaveProperty('features');
            
            expect(capabilities.channels.digital).toBe(24);
            expect(capabilities.sampling.maxRate).toBe(100000000);
            expect(capabilities.triggers.maxChannels).toBe(24);
            expect(capabilities.connectivity.interfaces).toEqual(['serial']);
        });

        test('buildCapabilities - 网络设备', () => {
            (driver as any)._isNetwork = true;
            
            const capabilities = (driver as any).buildCapabilities();
            expect(capabilities.connectivity.interfaces).toEqual(['ethernet']);
        });

        test('getLimits - 不同模式的限制计算', () => {
            // 测试8通道模式
            const limits8 = (driver as any).getLimits([0, 1, 2, 3, 4, 5, 6, 7]);
            expect(limits8.maxTotalSamples).toBe(512000); // 1字节模式

            // 测试16通道模式  
            const limits16 = (driver as any).getLimits(Array.from({length: 16}, (_, i) => i));
            expect(limits16.maxTotalSamples).toBe(256000); // 2字节模式

            // 测试24通道模式
            const limits24 = (driver as any).getLimits(Array.from({length: 24}, (_, i) => i));
            expect(limits24.maxTotalSamples).toBe(128000); // 4字节模式
        });
    });
});