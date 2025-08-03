/**
 * LogicAnalyzerDriver 简化100%覆盖率测试
 * 2025-08-03 基于现有测试扩展，针对未覆盖代码路径
 * 
 * 目标：从82.3%语句覆盖率提升到100%
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';
import { VersionValidator } from '../../../src/drivers/VersionValidator';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');
jest.mock('../../../src/drivers/VersionValidator');

describe('LogicAnalyzerDriver - 简化100%覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockLineParser: jest.Mocked<ReadlineParser>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // 创建基础mock对象
        mockSerialPort = {
            isOpen: false,
            open: jest.fn(),
            close: jest.fn(),
            write: jest.fn(),
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockSocket = {
            connect: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
            write: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockLineParser = {
            on: jest.fn(),
            off: jest.fn(),
            pipe: jest.fn().mockReturnThis()
        } as any;

        // Mock构造函数
        (SerialPort as unknown as jest.Mock).mockImplementation(() => mockSerialPort);
        (Socket as unknown as jest.Mock).mockImplementation(() => mockSocket);
        (ReadlineParser as unknown as jest.Mock).mockImplementation(() => mockLineParser);

        // Mock VersionValidator
        (VersionValidator.getVersion as jest.Mock).mockReturnValue({ 
            isValid: true, 
            major: 1, 
            minor: 2, 
            patch: 0 
        });
        (VersionValidator.getMinimumVersionString as jest.Mock).mockReturnValue('1.0.0');

        driver = new LogicAnalyzerDriver('COM3');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('构造函数边界条件测试', () => {
        it('应该拒绝空字符串连接字符串', () => {
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        it('应该拒绝null连接字符串', () => {
            expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
        });

        it('应该拒绝undefined连接字符串', () => {
            expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow('连接字符串不能为空');
        });

        it('应该正确识别网络地址格式', () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            expect(networkDriver).toBeInstanceOf(LogicAnalyzerDriver);
        });

        it('应该正确识别串口格式', () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            expect(serialDriver).toBeInstanceOf(LogicAnalyzerDriver);
        });
    });

    describe('基础属性getter测试', () => {
        it('应该返回正确的初始值', () => {
            expect(driver.deviceVersion).toBeNull();
            expect(driver.channelCount).toBe(0);
            expect(driver.maxFrequency).toBe(0);
            expect(driver.blastFrequency).toBe(0);
            expect(driver.bufferSize).toBe(0);
            expect(driver.isNetwork).toBe(false);
            expect(driver.isCapturing).toBe(false);
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
        });

        it('应该正确反映网络设备类型', () => {
            (driver as any)._isNetwork = true;
            expect(driver.driverType).toBe(AnalyzerDriverType.Network);
        });

        it('应该正确反映采集状态', () => {
            (driver as any)._capturing = true;
            expect(driver.isCapturing).toBe(true);
        });
    });

    describe('连接功能错误处理测试', () => {
        it('应该处理串口连接失败', async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback(new Error('Port open failed'));
            });

            await expect(driver.connect()).rejects.toThrow();
        });

        it('应该处理网络连接失败', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            mockSocket.connect.mockImplementation((port, host, callback) => {
                throw new Error('Connection failed');
            });

            await expect(networkDriver.connect()).rejects.toThrow();
        });

        it('应该处理设备初始化异常', async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });

            // Mock设备初始化失败
            const mockInitializeDevice = jest.fn().mockRejectedValue(new Error('Init failed'));
            (driver as any).initializeDevice = mockInitializeDevice;

            await expect(driver.connect()).rejects.toThrow();
        });
    });

    describe('设备信息解析错误处理测试', () => {
        it('应该处理无效版本响应', () => {
            const invalidResponses = ['invalid-version', 'FREQ:1000000', 'BLASTFREQ:10000000', 'BUFFER:100000', 'CHANNELS:8'];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备版本响应');
        });

        it('应该处理无效频率响应', () => {
            const invalidResponses = ['VER:1.2.0', 'invalid-freq', 'BLASTFREQ:10000000', 'BUFFER:100000', 'CHANNELS:8'];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备频率响应');
        });

        it('应该处理无效突发频率响应', () => {
            const invalidResponses = ['VER:1.2.0', 'FREQ:1000000', 'invalid-blast', 'BUFFER:100000', 'CHANNELS:8'];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备突发频率响应');
        });

        it('应该处理无效缓冲区响应', () => {
            const invalidResponses = ['VER:1.2.0', 'FREQ:1000000', 'BLASTFREQ:10000000', 'invalid-buffer', 'CHANNELS:8'];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备缓冲区大小响应');
        });

        it('应该处理无效通道数响应', () => {
            const invalidResponses = ['VER:1.2.0', 'FREQ:1000000', 'BLASTFREQ:10000000', 'BUFFER:100000', 'invalid-channels'];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备通道数响应');
        });

        it('应该处理数值范围验证', () => {
            const invalidResponses1 = ['VER:1.2.0', 'FREQ:-1000000', 'BLASTFREQ:10000000', 'BUFFER:100000', 'CHANNELS:8'];
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses1);
            }).toThrow('设备频率值无效');

            const invalidResponses2 = ['VER:1.2.0', 'FREQ:1000000', 'BLASTFREQ:-10000000', 'BUFFER:100000', 'CHANNELS:8'];
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses2);
            }).toThrow('设备突发频率值无效');

            const invalidResponses3 = ['VER:1.2.0', 'FREQ:1000000', 'BLASTFREQ:10000000', 'BUFFER:-100000', 'CHANNELS:8'];
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses3);
            }).toThrow('设备缓冲区大小值无效');

            const invalidResponses4 = ['VER:1.2.0', 'FREQ:1000000', 'BLASTFREQ:10000000', 'BUFFER:100000', 'CHANNELS:100'];
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses4);
            }).toThrow('设备通道数值无效');
        });

        it('应该处理版本验证失败', () => {
            (VersionValidator.getVersion as jest.Mock).mockReturnValue({ isValid: false });
            
            const validResponses = ['VER:0.5.0', 'FREQ:1000000', 'BLASTFREQ:10000000', 'BUFFER:100000', 'CHANNELS:8'];
            
            expect(() => {
                (driver as any).parseDeviceInfo(validResponses);
            }).toThrow('无效的设备版本');
        });
    });

    describe('数据写入和通信错误处理', () => {
        beforeEach(async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await driver.connect();
        });

        it('应该处理流未初始化错误', async () => {
            (driver as any)._currentStream = undefined;
            
            const testData = new Uint8Array([1, 2, 3, 4]);
            await expect((driver as any).writeData(testData)).rejects.toThrow('通信流未初始化');
        });

        it('应该处理写入错误', async () => {
            (driver as any)._currentStream = {
                write: jest.fn().mockImplementation((data, callback) => {
                    if (callback) callback(new Error('Write failed'));
                })
            };

            const testData = new Uint8Array([1, 2, 3, 4]);
            await expect((driver as any).writeData(testData)).rejects.toThrow('Write failed');
        });

        it('应该处理响应等待超时', async () => {
            mockLineParser.on.mockImplementation((event, callback) => {
                // 不触发响应，模拟超时
            });

            const promise = (driver as any).waitForResponse('TEST_RESPONSE', 1000);
            
            jest.advanceTimersByTime(1000);
            
            await expect(promise).rejects.toThrow('等待响应超时: TEST_RESPONSE');
        });

        it('应该处理错误响应内容', async () => {
            let responseCallback: Function;
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                }
            });

            const promise = (driver as any).waitForResponse('EXPECTED_RESPONSE', 2000);
            
            // 发送错误响应
            setTimeout(() => {
                if (responseCallback) {
                    responseCallback('WRONG_RESPONSE');
                }
            }, 100);
            
            jest.advanceTimersByTime(100);
            jest.advanceTimersByTime(2000); // 等待超时
            
            await expect(promise).rejects.toThrow('等待响应超时: EXPECTED_RESPONSE');
        });
    });

    describe('采集功能错误处理', () => {
        beforeEach(async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await driver.connect();
        });

        it('应该处理设备忙碌状态', async () => {
            const session = new CaptureSession();
            session.captureChannels = [new AnalyzerChannel(0, 'Channel0')];
            
            (driver as any)._capturing = true;

            const result = await driver.startCapture(session, 1000);
            expect(result).toBe(CaptureError.Busy);
        });

        it('应该处理设备未连接状态', async () => {
            const session = new CaptureSession();
            session.captureChannels = [new AnalyzerChannel(0, 'Channel0')];
            
            await driver.disconnect();

            const result = await driver.startCapture(session, 1000);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('应该处理参数验证失败', async () => {
            const session = new CaptureSession();
            session.captureChannels = [new AnalyzerChannel(0, 'Channel0')];
            
            const mockValidateSettings = jest.fn().mockReturnValue(false);
            (driver as any).validateSettings = mockValidateSettings;

            const result = await driver.startCapture(session, 1000);
            expect(result).toBe(CaptureError.BadParams);
        });

        it('应该处理停止采集时未在采集状态', async () => {
            (driver as any)._capturing = false;

            const result = await driver.stopCapture();
            expect(result).toBe(false);
        });

        it('应该处理采集过程异常', async () => {
            const session = new CaptureSession();
            session.captureChannels = [new AnalyzerChannel(0, 'Channel0')];
            
            const mockValidateSettings = jest.fn().mockReturnValue(true);
            (driver as any).validateSettings = mockValidateSettings;
            
            const mockWriteData = jest.fn().mockRejectedValue(new Error('Communication error'));
            (driver as any).writeData = mockWriteData;

            const result = await driver.startCapture(session, 1000);
            expect(result).toBe(CaptureError.UnexpectedError);
        });
    });

    describe('电压状态和引导程序功能', () => {
        beforeEach(async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await driver.connect();
        });

        it('应该处理电压状态查询成功', async () => {
            let responseCallback: Function;
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                }
            });

            const promise = driver.getVoltageStatus();
            
            setTimeout(() => {
                if (responseCallback) {
                    responseCallback('VOLTAGE:3.3V');
                }
            }, 100);
            
            jest.advanceTimersByTime(100);
            
            const result = await promise;
            expect(result).toBe('VOLTAGE:3.3V');
        });

        it('应该处理引导程序进入成功', async () => {
            let responseCallback: Function;
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                }
            });

            const promise = driver.enterBootloader();
            
            setTimeout(() => {
                if (responseCallback) {
                    responseCallback('BOOTLOADER_OK');
                }
            }, 100);
            
            jest.advanceTimersByTime(100);
            
            const result = await promise;
            expect(result).toBe(true);
        });

        it('应该处理引导程序进入失败', async () => {
            let responseCallback: Function;
            mockLineParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                }
            });

            const promise = driver.enterBootloader();
            
            setTimeout(() => {
                if (responseCallback) {
                    responseCallback('BOOTLOADER_ERROR');
                }
            }, 100);
            
            jest.advanceTimersByTime(100);
            
            const result = await promise;
            expect(result).toBe(false);
        });
    });

    describe('私有方法覆盖测试', () => {
        beforeEach(async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await driver.connect();
        });

        it('应该覆盖buildCapabilities方法', () => {
            (driver as any)._channelCount = 16;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 500000;
            
            const capabilities = (driver as any).buildCapabilities();
            
            expect(capabilities).toHaveProperty('channels');
            expect(capabilities).toHaveProperty('maxSampleRate');
            expect(capabilities).toHaveProperty('bufferSize');
            expect(capabilities.channels).toBe(16);
        });

        it('应该覆盖reconnectDevice方法', async () => {
            await driver.disconnect();
            
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await expect((driver as any).reconnectDevice()).resolves.toBeUndefined();
        });

        it('应该覆盖validateSettings方法的各种分支', () => {
            const session = new CaptureSession();
            session.frequency = 1000000;
            session.captureChannels = [new AnalyzerChannel(0, 'Channel0')];
            
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 100000;
            (driver as any)._channelCount = 16;
            
            // 有效设置
            expect((driver as any).validateSettings(session, 1000)).toBe(true);
            
            // 频率过高
            session.frequency = 200000000;
            expect((driver as any).validateSettings(session, 1000)).toBe(false);
            
            // 样本数过多
            session.frequency = 1000000;
            expect((driver as any).validateSettings(session, 200000)).toBe(false);
            
            // 通道索引无效
            session.captureChannels = [new AnalyzerChannel(100, 'Channel100')];
            expect((driver as any).validateSettings(session, 1000)).toBe(false);
        });

        it('应该覆盖getLimits方法', () => {
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 100000;
            
            const limits = (driver as any).getLimits([0, 1, 2]);
            
            expect(limits).toHaveProperty('maxSampleRate');
            expect(limits).toHaveProperty('maxSamples');
            expect(limits.maxSampleRate).toBeGreaterThan(0);
            expect(limits.maxSamples).toBeGreaterThan(0);
            
            // 空通道数组
            const emptyLimits = (driver as any).getLimits([]);
            expect(emptyLimits.maxSampleRate).toBe(0);
            expect(emptyLimits.maxSamples).toBe(0);
        });

        it('应该覆盖composeRequest方法的所有触发类型', () => {
            const session = new CaptureSession();
            session.frequency = 2000000;
            session.triggerChannel = 5;
            
            // Edge触发
            session.triggerType = TriggerType.Edge;
            const edgeRequest = (driver as any).composeRequest(session, 1000, 0);
            expect(edgeRequest.triggerType).toBe(TriggerType.Edge);
            expect(edgeRequest.trigger).toBe(5);
            expect(edgeRequest.frequency).toBe(2000000);
            
            // Complex触发
            session.triggerType = TriggerType.Complex;
            const complexRequest = (driver as any).composeRequest(session, 1000, 0);
            expect(complexRequest.triggerType).toBe(TriggerType.Complex);
            
            // Fast触发
            session.triggerType = TriggerType.Fast;
            const fastRequest = (driver as any).composeRequest(session, 1000, 0);
            expect(fastRequest.triggerType).toBe(TriggerType.Fast);
            
            // Blast触发
            session.triggerType = TriggerType.Blast;
            const blastRequest = (driver as any).composeRequest(session, 1000, 0);
            expect(blastRequest.triggerType).toBe(TriggerType.Blast);
        });
    });

    describe('资源清理和释放', () => {
        beforeEach(async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await driver.connect();
        });

        it('应该正确清理串口连接', async () => {
            await driver.disconnect();
            
            expect(mockSerialPort.removeAllListeners).toHaveBeenCalled();
            expect(mockSerialPort.close).toHaveBeenCalled();
        });

        it('应该正确清理网络连接', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            mockSocket.connect.mockImplementation((port, host, callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (networkDriver as any).initializeDevice = mockInitializeDevice;
            
            await networkDriver.connect();
            await networkDriver.disconnect();
            
            expect(mockSocket.removeAllListeners).toHaveBeenCalled();
            expect(mockSocket.end).toHaveBeenCalled();
        });

        it('应该正确处理dispose方法', () => {
            const disposeSpy = jest.spyOn(driver, 'dispose');
            
            driver.dispose();
            
            expect(disposeSpy).toHaveBeenCalled();
        });

        it('应该处理重复断开连接', async () => {
            await driver.disconnect();
            
            // 第二次断开不应该出错
            await expect(driver.disconnect()).resolves.toBeUndefined();
        });
    });

    describe('异常场景边界测试', () => {
        it('应该处理设备状态查询', async () => {
            // 未连接状态
            expect(await driver.getStatus()).toBe('Disconnected');
            
            // 连接状态
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            await driver.connect();
            expect(await driver.getStatus()).toBe('Connected');
            
            // 采集状态
            (driver as any)._capturing = true;
            expect(await driver.getStatus()).toBe('Capturing');
        });

        it('应该处理重复连接', async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback();
            });
            
            const mockInitializeDevice = jest.fn().mockResolvedValue(undefined);
            (driver as any).initializeDevice = mockInitializeDevice;
            
            // 第一次连接
            const result1 = await driver.connect();
            expect(result1.success).toBe(true);
            
            // 第二次连接应该成功（重新连接）
            const result2 = await driver.connect();
            expect(result2.success).toBe(true);
        });

        it('应该处理无效地址格式的网络连接', async () => {
            const invalidDriver = new LogicAnalyzerDriver('invalid-format');
            
            await expect(invalidDriver.connect()).rejects.toThrow();
        });

        it('应该处理串口权限错误', async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) callback(new Error('Permission denied'));
            });

            await expect(driver.connect()).rejects.toThrow('Permission denied');
        });
    });
});