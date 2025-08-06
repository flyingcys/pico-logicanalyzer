/**
 * LogicAnalyzerDriver - 100%覆盖率专项测试
 * 专门设计用于覆盖剩余的3.09%未覆盖代码，达到100%完美覆盖率
 * 
 * 目标覆盖未覆盖的代码行：277, 439, 449, 453-459, 496, 506, 556, 868-872
 */

import { LogicAnalyzerDriver } from '../../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../../src/models/AnalyzerTypes';
import { VersionValidator, DeviceConnectionException } from '../../../../src/drivers/VersionValidator';
import { ReadlineParser } from '@serialport/parser-readline';
import { SerialPort } from 'serialport';
import { Socket } from 'net';

// Mock 依赖
jest.mock('serialport');
jest.mock('@serialport/parser-readline');
jest.mock('../../../../src/drivers/VersionValidator');
jest.mock('net');

describe('LogicAnalyzerDriver - 100%覆盖率专项测试', () => {
    let driver: LogicAnalyzerDriver;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockParser: jest.Mocked<ReadlineParser>;

    beforeEach(() => {
        jest.clearAllMocks();

        // 模拟 SerialPort
        mockSerialPort = {
            open: jest.fn(),
            close: jest.fn(),
            write: jest.fn(),
            pipe: jest.fn(),
            isOpen: false,
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn(),
            emit: jest.fn()
        } as any;

        // 模拟 Socket
        mockSocket = {
            connect: jest.fn(),
            destroy: jest.fn(),
            write: jest.fn(),
            pipe: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn(),
            emit: jest.fn()
        } as any;

        // 模拟 ReadlineParser
        mockParser = {
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn(),
            pipe: jest.fn()
        } as any;

        (SerialPort as jest.MockedClass<typeof SerialPort>).mockImplementation(() => mockSerialPort);
        (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket);
        (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockParser);

        // 模拟 VersionValidator
        (VersionValidator.getVersion as jest.Mock).mockReturnValue({ isValid: true });
        (VersionValidator.getMinimumVersionString as jest.Mock).mockReturnValue('1.0.0');

        driver = new LogicAnalyzerDriver('COM3');
    });

    afterEach(() => {
        if (driver) {
            driver.dispose();
        }
    });

    describe('100%覆盖率专项测试 - 未覆盖代码行', () => {
        
        // 覆盖第277行：getVoltageStatus超时处理
        test('getVoltageStatus - 网络设备超时处理 (覆盖第277行)', async () => {
            // 设置为网络模式，已连接状态
            driver = new LogicAnalyzerDriver('192.168.1.100:502');
            (driver as any)._isNetwork = true;
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSocket;
            (driver as any)._lineParser = mockParser;

            // 模拟网络连接
            mockSocket.connect.mockImplementation((port, host, callback) => {
                if (callback) callback();
            });

            // 模拟写入成功
            mockSocket.write.mockImplementation((data, callback) => {
                if (callback) callback();
                return true;
            });

            // 模拟超时情况 - 不触发数据事件，让超时机制生效
            mockParser.once.mockImplementation((event, callback) => {
                // 不调用callback，让超时触发
            });

            const result = await driver.getVoltageStatus();
            expect(result).toBe('TIMEOUT'); // 覆盖第277行
        });

        // 覆盖第449行和第453-459行：readDeviceInfo超时和数据处理
        test('initializeDevice - readDeviceInfo超时处理 (覆盖第449, 453-459行)', async () => {
            driver = new LogicAnalyzerDriver('COM3');

            // 模拟串口连接成功
            mockSerialPort.open.mockImplementation((callback) => {
                callback(null);
            });

            // 模拟写入成功
            mockSerialPort.write.mockImplementation((data, callback) => {
                if (callback) callback();
                return true;
            });

            // 模拟第一次调用readDeviceInfo时超时
            let callCount = 0;
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callCount++;
                    if (callCount === 1) {
                        // 第一次调用时不触发数据事件，导致超时（覆盖第449行）
                        return;
                    }
                }
            });

            await expect(driver.connect()).rejects.toThrow('设备信息读取超时'); // 覆盖第449行
        });

        // 覆盖第453-459行：readDeviceInfo正常数据处理流程
        test('initializeDevice - readDeviceInfo正常数据收集 (覆盖第453-459行)', async () => {
            driver = new LogicAnalyzerDriver('COM3');

            // 模拟串口连接成功
            mockSerialPort.open.mockImplementation((callback) => {
                callback(null);
            });

            // 模拟写入成功
            mockSerialPort.write.mockImplementation((data, callback) => {
                if (callback) callback();
                return true;
            });

            // 模拟接收5行设备信息数据
            let dataHandler: any;
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    dataHandler = callback;
                    // 模拟逐个接收5行数据（覆盖第453-459行）
                    setTimeout(() => {
                        callback('Logic Analyzer v1.0.0'); // 第1行
                        callback('FREQ:100000000'); // 第2行  
                        callback('BLASTFREQ:200000000'); // 第3行
                        callback('BUFFER:96000'); // 第4行
                        callback('CHANNELS:24'); // 第5行 - 达到5行后自动resolve（覆盖第456-459行）
                    }, 10);
                }
            });

            // 模拟off方法
            mockParser.off.mockImplementation(() => {});

            const result = await driver.connect();
            expect(result.success).toBe(true);
        });

        // 覆盖第496行：突发频率值无效错误处理
        test('parseDeviceInfo - 突发频率值无效 (覆盖第496行)', async () => {
            driver = new LogicAnalyzerDriver('COM3');

            // 模拟串口连接成功
            mockSerialPort.open.mockImplementation((callback) => {
                callback(null);
            });

            // 模拟写入成功
            mockSerialPort.write.mockImplementation((data, callback) => {
                if (callback) callback();
                return true;
            });

            // 模拟接收无效的突发频率数据
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => {
                        callback('Logic Analyzer v1.0.0'); // 版本
                        callback('FREQ:100000000'); // 频率
                        callback('BLASTFREQ:0'); // 无效的突发频率值（0）
                        callback('BUFFER:96000'); // 缓冲区
                        callback('CHANNELS:24'); // 通道数
                    }, 10);
                }
            });

            mockParser.off.mockImplementation(() => {});

            await expect(driver.connect()).rejects.toThrow('设备突发频率值无效'); // 覆盖第496行
        });

        // 覆盖第506行：缓冲区大小值无效错误处理
        test('parseDeviceInfo - 缓冲区大小值无效 (覆盖第506行)', async () => {
            driver = new LogicAnalyzerDriver('COM3');

            // 模拟串口连接成功
            mockSerialPort.open.mockImplementation((callback) => {
                callback(null);
            });

            // 模拟写入成功
            mockSerialPort.write.mockImplementation((data, callback) => {
                if (callback) callback();
                return true;
            });

            // 模拟接收无效的缓冲区大小数据
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => {
                        callback('Logic Analyzer v1.0.0'); // 版本
                        callback('FREQ:100000000'); // 频率
                        callback('BLASTFREQ:200000000'); // 突发频率
                        callback('BUFFER:-1'); // 无效的缓冲区大小值（负数）
                        callback('CHANNELS:24'); // 通道数
                    }, 10);
                }
            });

            mockParser.off.mockImplementation(() => {});

            await expect(driver.connect()).rejects.toThrow('设备缓冲区大小值无效'); // 覆盖第506行
        });

        // 覆盖第556行：startDataReading通信流未初始化错误处理
        test('startDataReading - 通信流未初始化 (覆盖第556行)', async () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            // 创建模拟的采集会话
            const mockSession: CaptureSession = {
                captureChannels: [
                    { channelNumber: 0, samples: new Uint8Array(0) } as AnalyzerChannel
                ],
                frequency: 1000000,
                preTriggerSamples: 100,
                postTriggerSamples: 1000,
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false,
                loopCount: 0,
                measureBursts: false
            } as CaptureSession;

            // 设置为已连接但无通信流的状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = null; // 通信流未初始化

            // 直接调用startDataReading方法，应该抛出错误
            await expect((driver as any).startDataReading(mockSession))
                .rejects.toThrow('通信流未初始化'); // 覆盖第556行
        });

        // 覆盖第868-872行：processBurstTimestamps时间戳调整逻辑
        test('processBurstTimestamps - 时间戳调整逻辑 (覆盖第868-872行)', () => {
            driver = new LogicAnalyzerDriver('COM3');

            // 创建模拟的采集会话（带突发测量）
            const mockSession: CaptureSession = {
                frequency: 1000000,
                preTriggerSamples: 100,
                postTriggerSamples: 1000,
                loopCount: 2,
                measureBursts: true
            } as CaptureSession;

            // 创建需要调整的时间戳数据
            // 设计时间戳使得top - timestamps[i-1] <= ticksPerBurst，触发调整逻辑
            const timestamps = new BigUint64Array([
                1000000n,  // 第一个时间戳
                1000100n,  // 第二个时间戳（差异很小，会触发调整）
                1000200n,  // 第三个时间戳
                1000300n   // 第四个时间戳
            ]);

            const bursts: any[] = [];

            // 直接调用processBurstTimestamps方法
            (driver as any).processBurstTimestamps(timestamps, mockSession, bursts);

            // 验证时间戳被调整了（覆盖第868-872行）
            expect(timestamps[1]).toBeGreaterThan(1000100n); // 时间戳应该被调整
            expect(timestamps[2]).toBeGreaterThan(1000200n); // 后续时间戳也被调整
            expect(timestamps[3]).toBeGreaterThan(1000300n); // 后续时间戳也被调整
            expect(bursts.length).toBeGreaterThan(0); // 生成了突发信息
        });

        // 覆盖第439行：initializeDevice中parseDeviceInfo调用的错误情况
        test('initializeDevice - parseDeviceInfo异常处理 (覆盖第439行)', async () => {
            driver = new LogicAnalyzerDriver('COM3');

            // 模拟串口连接成功
            mockSerialPort.open.mockImplementation((callback) => {
                callback(null);
            });

            // 模拟写入成功
            mockSerialPort.write.mockImplementation((data, callback) => {
                if (callback) callback();
                return true;
            });

            // 模拟接收不完整的设备信息（少于5行）
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => {
                        callback('Logic Analyzer v1.0.0'); // 只返回1行数据
                        // 不返回其他4行数据，导致parseDeviceInfo抛出异常
                    }, 10);
                }
            });

            // 模拟10秒后触发超时
            setTimeout(() => {
                const timeoutCallback = mockParser.on.mock.calls.find(call => call[0] === 'data')?.[1];
                // 模拟超时，readDeviceInfo会reject
            }, 100);

            await expect(driver.connect()).rejects.toThrow(); // 覆盖第439行相关的错误处理
        });
    });

    describe('边界条件和特殊场景测试', () => {
        
        // 测试空时间戳数组的情况
        test('processBurstTimestamps - 空时间戳数组', () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            const mockSession: CaptureSession = {
                frequency: 1000000,
                postTriggerSamples: 1000
            } as CaptureSession;

            const timestamps = new BigUint64Array(0); // 空数组
            const bursts: any[] = [];

            // 应该正常处理空数组，不抛出异常
            expect(() => {
                (driver as any).processBurstTimestamps(timestamps, mockSession, bursts);
            }).not.toThrow();

            expect(bursts.length).toBe(0);
        });

        // 测试只有2个时间戳的情况
        test('processBurstTimestamps - 只有2个时间戳', () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            const mockSession: CaptureSession = {
                frequency: 1000000,
                postTriggerSamples: 1000
            } as CaptureSession;

            const timestamps = new BigUint64Array([1000000n, 2000000n]); // 只有2个时间戳
            const bursts: any[] = [];

            // 应该正常处理，但不会进行复杂的时间戳调整
            expect(() => {
                (driver as any).processBurstTimestamps(timestamps, mockSession, bursts);
            }).not.toThrow();
        });

        // 测试时间戳回绕的情况
        test('processBurstTimestamps - 时间戳回绕处理', () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            const mockSession: CaptureSession = {
                frequency: 1000000,
                preTriggerSamples: 100,
                postTriggerSamples: 1000,
                loopCount: 1,
                measureBursts: true
            } as CaptureSession;

            // 创建时间戳回绕的情况（后一个时间戳小于前一个）
            const timestamps = new BigUint64Array([
                0xFFFFFFFFn, // 接近最大值
                0x00000100n, // 回绕后的小值
                0x00000200n
            ]);

            const bursts: any[] = [];

            expect(() => {
                (driver as any).processBurstTimestamps(timestamps, mockSession, bursts);
            }).not.toThrow();

            expect(bursts.length).toBeGreaterThan(0);
        });
    });
});