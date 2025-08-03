/**
 * LogicAnalyzerDriver 超高覆盖率测试
 * 2025-08-03 专门针对未覆盖代码路径的精准测试
 * 目标：将覆盖率从59.67%提升到85%+
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';
import { BurstInfo } from '../../../src/drivers/types/AnalyzerTypes';
import { VersionValidator, DeviceConnectionException } from '../../../src/drivers/VersionValidator';
import { OutputPacket, CaptureRequest } from '../../../src/drivers/AnalyzerDriverBase';

// Mock VersionValidator
jest.mock('../../../src/drivers/VersionValidator', () => ({
    VersionValidator: {
        getVersion: jest.fn(),
        getMinimumVersionString: jest.fn(() => '1.0.0')
    },
    DeviceConnectionException: class extends Error {
        constructor(message: string, version?: string) {
            super(message);
            this.name = 'DeviceConnectionException';
        }
    }
}));

// Mock dependencies with advanced capabilities
const mockSerialPort = {
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
    write: jest.fn(),
    pipe: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
};

const mockSocket = {
    connect: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    pipe: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
};

const mockLineParser = {
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn()
};

jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => mockSerialPort)
}));

jest.mock('net', () => ({
    Socket: jest.fn().mockImplementation(() => mockSocket)
}));

jest.mock('@serialport/parser-readline', () => ({
    ReadlineParser: jest.fn().mockImplementation(() => mockLineParser)
}));

describe('LogicAnalyzerDriver 超高覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let captureSession: CaptureSession;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // 重置mock状态
        mockSerialPort.isOpen = false;
        mockLineParser.on = jest.fn();
        mockLineParser.off = jest.fn();
        mockLineParser.once = jest.fn();
        mockSocket.on = jest.fn();
        mockSocket.off = jest.fn();
        
        // 创建基础的CaptureSession用于测试
        captureSession = {
            captureChannels: [
                { channelNumber: 0, label: 'CH0', samples: new Uint8Array(0), enabled: true },
                { channelNumber: 1, label: 'CH1', samples: new Uint8Array(0), enabled: true }
            ] as AnalyzerChannel[],
            frequency: 1000000,
            preTriggerSamples: 1000,
            postTriggerSamples: 1000,
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 0,
            measureBursts: false,
            triggerBitCount: 1,
            triggerPattern: 0
        } as CaptureSession;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('构造函数边界条件测试', () => {
        it('应该抛出错误当连接字符串为空字符串', () => {
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        it('应该抛出错误当连接字符串为null', () => {
            expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
        });

        it('应该抛出错误当连接字符串为undefined', () => {
            expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow('连接字符串不能为空');
        });

        it('应该正确识别网络设备连接字符串', () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            expect(networkDriver.isNetwork).toBe(false); // 在连接前应该是false
        });

        it('应该正确识别串口设备连接字符串', () => {
            const serialDriver = new LogicAnalyzerDriver('COM3');
            expect(serialDriver.isNetwork).toBe(false);
        });
    });

    describe('设备初始化错误处理覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
        });

        it('应该处理网络地址格式无效的情况', async () => {
            const invalidDriver = new LogicAnalyzerDriver('invalid-address');
            const result = await invalidDriver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的地址/端口格式无效');
        });

        it('应该处理端口号无效的情况', async () => {
            const invalidPortDriver = new LogicAnalyzerDriver('192.168.1.100:99999');
            const result = await invalidPortDriver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的端口号无效');
        });

        it('应该处理端口号为负数的情况', async () => {
            const invalidPortDriver = new LogicAnalyzerDriver('192.168.1.100:-1');
            const result = await invalidPortDriver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的端口号无效');
        });

        it('应该处理设备信息响应不完整的情况', async () => {
            // 模拟网络连接成功
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            // 模拟设备信息响应不完整（只有3个响应而不是5个）
            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();

            // 模拟设备信息查询后的响应处理
            jest.advanceTimersByTime(100);

            // 模拟只收到3个响应（不完整）
            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:1000000');
                dataHandlerCallback('BLASTFREQ:100000');
                // 缺少BUFFER和CHANNELS响应
            }

            // 模拟超时
            jest.advanceTimersByTime(10000);

            const result = await connectPromise;
            expect(result.success).toBe(false);
        });

        it('应该处理无效的频率响应格式', async () => {
            // 模拟网络连接成功
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            // 模拟无效的频率响应
            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('INVALID_FREQ_RESPONSE'); // 无效格式
                dataHandlerCallback('BLASTFREQ:100000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('无效的设备频率响应');
        });

        it('应该处理频率值为零的情况', async () => {
            // 模拟网络连接成功
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            // 模拟频率值为零
            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:0'); // 零值
                dataHandlerCallback('BLASTFREQ:100000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('设备频率值无效');
        });

        it('应该处理无效的突发频率响应', async () => {
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:1000000');
                dataHandlerCallback('INVALID_BLAST_RESPONSE'); // 无效格式
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('无效的设备突发频率响应');
        });

        it('应该处理无效的缓冲区大小响应', async () => {
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:1000000');
                dataHandlerCallback('BLASTFREQ:100000');
                dataHandlerCallback('INVALID_BUFFER_RESPONSE'); // 无效格式
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('无效的设备缓冲区大小响应');
        });

        it('应该处理无效的通道数响应', async () => {
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:1000000');
                dataHandlerCallback('BLASTFREQ:100000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('INVALID_CHANNELS_RESPONSE'); // 无效格式
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('无效的设备通道数响应');
        });

        it('应该处理通道数超过24的情况', async () => {
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:1000000');
                dataHandlerCallback('BLASTFREQ:100000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:25'); // 超过24
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('设备通道数值无效');
        });

        it('应该处理版本验证失败的情况', async () => {
            // Mock版本验证失败
            (VersionValidator.getVersion as jest.Mock).mockReturnValue({
                isValid: false
            });

            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            if (dataHandlerCallback) {
                dataHandlerCallback('Version 0.5.0'); // 低版本
                dataHandlerCallback('FREQ:1000000');
                dataHandlerCallback('BLASTFREQ:100000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(false);
        });
    });

    describe('串口连接错误处理覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该处理串口打开失败的情况', async () => {
            mockSerialPort.open = jest.fn((callback) => {
                setImmediate(() => callback(new Error('端口打开失败')));
            });

            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('串口连接失败');
        });

        it('应该处理串口设备信息读取超时', async () => {
            mockSerialPort.open = jest.fn((callback) => {
                mockSerialPort.isOpen = true;
                setImmediate(callback);
            });

            // 模拟没有数据响应，导致超时
            mockLineParser.on = jest.fn();

            const connectPromise = driver.connect();

            // 模拟10秒超时
            jest.advanceTimersByTime(10000);

            const result = await connectPromise;
            expect(result.success).toBe(false);
        });
    });

    describe('采集功能错误处理覆盖', () => {
        beforeEach(async () => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 模拟成功连接
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            (VersionValidator.getVersion as jest.Mock).mockReturnValue({
                isValid: true
            });

            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            jest.advanceTimersByTime(100);

            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:100000000');
                dataHandlerCallback('BLASTFREQ:100000000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);
            await connectPromise;
        });

        it('应该拒绝已经在采集状态时的新采集请求', async () => {
            // 模拟设备已在采集状态
            (driver as any)._capturing = true;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.Busy);
        });

        it('应该拒绝设备未连接时的采集请求', async () => {
            // 模拟设备未连接
            (driver as any)._isConnected = false;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('应该拒绝通信流未初始化时的采集请求', async () => {
            // 模拟通信流未初始化
            (driver as any)._currentStream = undefined;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('应该处理无效采集参数的情况', async () => {
            // 创建无效的采集会话（通道号超出范围）
            const invalidSession = {
                ...captureSession,
                captureChannels: [
                    { channelNumber: 25, label: 'CH25', samples: new Uint8Array(0), enabled: true }
                ] as AnalyzerChannel[]
            };

            const result = await driver.startCapture(invalidSession);
            expect(result).toBe(CaptureError.BadParams);
        });

        it('应该处理写入数据失败的情况', async () => {
            // 模拟写入失败
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback(new Error('写入失败')));
            });

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.UnexpectedError);
        });
    });

    describe('复杂触发类型验证覆盖', () => {
        beforeEach(async () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            // 模拟成功连接（简化版本）
            mockSerialPort.open = jest.fn((callback) => {
                mockSerialPort.isOpen = true;
                setImmediate(callback);
            });

            (VersionValidator.getVersion as jest.Mock).mockReturnValue({
                isValid: true
            });

            // 设置私有属性模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._version = 'Version 1.0.0';
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._blastFrequency = 100000000;
            (driver as any)._bufferSize = 96000;
            (driver as any)._channelCount = 24;
        });

        it('应该正确验证Complex触发类型', async () => {
            const complexSession = {
                ...captureSession,
                triggerType: TriggerType.Complex,
                triggerChannel: 5,
                triggerBitCount: 8,
                triggerPattern: 0xFF
            };

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            const result = await driver.startCapture(complexSession);
            expect(result).toBe(CaptureError.None);
        });

        it('应该正确验证Fast触发类型', async () => {
            const fastSession = {
                ...captureSession,
                triggerType: TriggerType.Fast,
                triggerChannel: 2,
                triggerBitCount: 3,
                triggerPattern: 0x7
            };

            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            const result = await driver.startCapture(fastSession);
            expect(result).toBe(CaptureError.None);
        });

        it('应该正确验证Blast触发类型', async () => {
            const blastSession = {
                ...captureSession,
                triggerType: TriggerType.Blast,
                loopCount: 5,
                measureBursts: true
            };

            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            const result = await driver.startCapture(blastSession);
            expect(result).toBe(CaptureError.None);
        });

        it('应该拒绝Complex触发的无效参数', async () => {
            const invalidComplexSession = {
                ...captureSession,
                triggerType: TriggerType.Complex,
                triggerChannel: 15, // 超出范围
                triggerBitCount: 17 // 超过16位限制
            };

            const result = await driver.startCapture(invalidComplexSession);
            expect(result).toBe(CaptureError.BadParams);
        });

        it('应该拒绝Fast触发的无效参数', async () => {
            const invalidFastSession = {
                ...captureSession,
                triggerType: TriggerType.Fast,
                triggerChannel: 4, // 超出Fast触发的通道限制
                triggerBitCount: 6  // 超过5位限制
            };

            const result = await driver.startCapture(invalidFastSession);
            expect(result).toBe(CaptureError.BadParams);
        });
    });

    describe('电压状态查询错误处理覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
        });

        it('应该返回DISCONNECTED当设备未连接', async () => {
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('DISCONNECTED');
        });

        it('应该返回ERROR当写入失败', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSocket;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = true;

            // 模拟写入失败
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback(new Error('写入失败')));
            });

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('ERROR');
        });

        it('应该返回TIMEOUT当响应超时', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSocket;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = true;

            // 模拟写入成功但无响应
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            mockLineParser.once = jest.fn(); // 无响应

            const voltagePromise = driver.getVoltageStatus();

            // 模拟5秒超时
            jest.advanceTimersByTime(5000);

            const voltage = await voltagePromise;
            expect(voltage).toBe('TIMEOUT');
        });

        it('应该为串口设备返回模拟电压值', async () => {
            // 模拟串口连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = false;

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('3.3V');
        });
    });

    describe('网络配置功能覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
            // 模拟串口连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = false;
        });

        it('应该拒绝网络设备的网络配置', async () => {
            // 模拟网络设备
            (driver as any)._isNetwork = true;

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        it('应该处理网络配置写入失败', async () => {
            // 模拟写入失败
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback(new Error('写入失败')));
            });

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        it('应该处理网络配置响应超时', async () => {
            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟无响应
            let responseCallback: any;
            mockLineParser.once = jest.fn((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                }
            });

            const configPromise = driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);

            // 模拟超时
            jest.advanceTimersByTime(5000);

            const result = await configPromise;
            expect(result).toBe(false);
        });

        it('应该正确处理成功的网络配置', async () => {
            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟成功响应
            let responseCallback: any;
            mockLineParser.once = jest.fn((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                    // 立即返回成功响应
                    setImmediate(() => callback('SETTINGS_SAVED'));
                }
            });

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(true);
        });
    });

    describe('引导加载程序功能覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该拒绝未连接设备的引导加载程序请求', async () => {
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        it('应该处理写入失败的情况', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;

            // 模拟写入失败
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback(new Error('写入失败')));
            });

            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        it('应该处理响应超时的情况', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟无响应
            let responseCallback: any;
            mockLineParser.once = jest.fn((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                }
            });

            const bootloaderPromise = driver.enterBootloader();

            // 模拟超时
            jest.advanceTimersByTime(1000);

            const result = await bootloaderPromise;
            expect(result).toBe(false);
        });

        it('应该正确处理成功的引导加载程序响应', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟成功响应
            let responseCallback: any;
            mockLineParser.once = jest.fn((event, callback) => {
                if (event === 'data') {
                    responseCallback = callback;
                    setImmediate(() => callback('RESTARTING_BOOTLOADER'));
                }
            });

            const result = await driver.enterBootloader();
            expect(result).toBe(true);
        });
    });

    describe('停止采集和重连功能覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSocket;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = true;
            (driver as any)._devAddr = '192.168.1.100';
            (driver as any)._devPort = 8080;
            (driver as any)._tcpSocket = mockSocket;
        });

        it('应该处理未在采集状态时的停止请求', async () => {
            (driver as any)._capturing = false;

            const result = await driver.stopCapture();
            expect(result).toBe(true);
        });

        it('应该处理停止命令写入失败', async () => {
            (driver as any)._capturing = true;

            // 模拟写入失败
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback(new Error('写入失败')));
            });

            const result = await driver.stopCapture();
            expect(result).toBe(false);
            expect((driver as any)._capturing).toBe(false);
        });

        it('应该正确处理网络设备重连', async () => {
            (driver as any)._capturing = true;

            // 模拟写入成功
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟重连成功
            mockSocket.connect = jest.fn((port, host, callback) => {
                setImmediate(callback);
                return mockSocket;
            });

            const stopPromise = driver.stopCapture();

            // 快进时间以模拟等待和重连过程
            jest.advanceTimersByTime(2000);

            const result = await stopPromise;
            expect(result).toBe(true);
            expect(mockSocket.destroy).toHaveBeenCalled();
            expect(mockSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
        });

        it('应该处理网络重连失败', async () => {
            (driver as any)._capturing = true;

            // 模拟写入成功
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟重连失败
            mockSocket.connect = jest.fn();
            mockSocket.on = jest.fn((event, callback) => {
                if (event === 'error') {
                    setImmediate(() => callback(new Error('重连失败')));
                }
            });

            const stopPromise = driver.stopCapture();
            jest.advanceTimersByTime(2000);

            const result = await stopPromise;
            expect(result).toBe(false);
        });
    });

    describe('串口重连功能覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = false;
            (driver as any)._serialPort = mockSerialPort;
        });

        it('应该正确处理串口设备重连', async () => {
            (driver as any)._capturing = true;

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟串口关闭和重新打开
            mockSerialPort.isOpen = true;
            mockSerialPort.close = jest.fn((callback) => {
                mockSerialPort.isOpen = false;
                if (callback) setImmediate(callback);
            });
            mockSerialPort.open = jest.fn((callback) => {
                mockSerialPort.isOpen = true;
                setImmediate(callback);
            });

            const stopPromise = driver.stopCapture();
            jest.advanceTimersByTime(2000);

            const result = await stopPromise;
            expect(result).toBe(true);
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockSerialPort.open).toHaveBeenCalled();
        });

        it('应该处理串口重连失败', async () => {
            (driver as any)._capturing = true;

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟串口重新打开失败
            mockSerialPort.isOpen = true;
            mockSerialPort.close = jest.fn((callback) => {
                mockSerialPort.isOpen = false;
                if (callback) setImmediate(callback);
            });
            mockSerialPort.open = jest.fn((callback) => {
                setImmediate(() => callback(new Error('串口重连失败')));
            });

            const stopPromise = driver.stopCapture();
            jest.advanceTimersByTime(2000);

            const result = await stopPromise;
            expect(result).toBe(false);
        });
    });

    describe('属性访问器覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该返回正确的设备版本', () => {
            (driver as any)._version = 'Test Version 1.0.0';
            expect(driver.deviceVersion).toBe('Test Version 1.0.0');
        });

        it('应该返回null当版本未设置', () => {
            (driver as any)._version = null;
            expect(driver.deviceVersion).toBeNull();
        });

        it('应该返回正确的通道数', () => {
            (driver as any)._channelCount = 16;
            expect(driver.channelCount).toBe(16);
        });

        it('应该返回正确的最大频率', () => {
            (driver as any)._maxFrequency = 50000000;
            expect(driver.maxFrequency).toBe(50000000);
        });

        it('应该返回正确的突发频率', () => {
            (driver as any)._blastFrequency = 25000000;
            expect(driver.blastFrequency).toBe(25000000);
        });

        it('应该返回正确的缓冲区大小', () => {
            (driver as any)._bufferSize = 48000;
            expect(driver.bufferSize).toBe(48000);
        });

        it('应该返回正确的网络状态', () => {
            (driver as any)._isNetwork = true;
            expect(driver.isNetwork).toBe(true);

            (driver as any)._isNetwork = false;
            expect(driver.isNetwork).toBe(false);
        });

        it('应该返回正确的采集状态', () => {
            (driver as any)._capturing = true;
            expect(driver.isCapturing).toBe(true);

            (driver as any)._capturing = false;
            expect(driver.isCapturing).toBe(false);
        });

        it('应该返回正确的驱动类型', () => {
            (driver as any)._isNetwork = true;
            expect(driver.driverType).toBe(AnalyzerDriverType.Network);

            (driver as any)._isNetwork = false;
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
        });
    });

    describe('disconnect方法覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
        });

        it('应该正确清理串口连接', async () => {
            // 模拟串口连接状态
            (driver as any)._isConnected = true;
            (driver as any)._serialPort = mockSerialPort;
            (driver as any)._tcpSocket = undefined;
            mockSerialPort.isOpen = true;

            await driver.disconnect();

            expect((driver as any)._isConnected).toBe(false);
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect((driver as any)._serialPort).toBeUndefined();
            expect((driver as any)._currentStream).toBeUndefined();
            expect((driver as any)._lineParser).toBeUndefined();
        });

        it('应该正确清理网络连接', async () => {
            // 模拟网络连接状态
            (driver as any)._isConnected = true;
            (driver as any)._tcpSocket = mockSocket;
            (driver as any)._serialPort = undefined;

            await driver.disconnect();

            expect((driver as any)._isConnected).toBe(false);
            expect(mockSocket.destroy).toHaveBeenCalled();
            expect((driver as any)._tcpSocket).toBeUndefined();
            expect((driver as any)._currentStream).toBeUndefined();
            expect((driver as any)._lineParser).toBeUndefined();
        });

        it('应该正确处理串口未打开的情况', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._serialPort = mockSerialPort;
            mockSerialPort.isOpen = false;

            await driver.disconnect();

            expect((driver as any)._isConnected).toBe(false);
            expect(mockSerialPort.close).not.toHaveBeenCalled();
        });
    });

    describe('getStatus方法覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该返回正确的设备状态', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._capturing = false;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = false;

            const status = await driver.getStatus();

            expect(status.isConnected).toBe(true);
            expect(status.isCapturing).toBe(false);
            expect(status.batteryVoltage).toBe('3.3V');
        });
    });

    describe('dispose方法覆盖', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该正确调用disconnect和父类dispose', () => {
            const disconnectSpy = jest.spyOn(driver, 'disconnect');
            const superDisposeSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(driver)), 'dispose');

            driver.dispose();

            expect(disconnectSpy).toHaveBeenCalled();
            expect(superDisposeSpy).toHaveBeenCalled();
        });
    });
});