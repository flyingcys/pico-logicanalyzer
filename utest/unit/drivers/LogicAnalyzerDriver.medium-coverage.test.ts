/**
 * LogicAnalyzerDriver 中等覆盖率测试
 * 2025-08-03 专门针对关键代码路径的覆盖率提升
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

// Mock dependencies
const mockSerialPort = {
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
    write: jest.fn(),
    pipe: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
};

const mockSocket = {
    connect: jest.fn(),
    write: jest.fn(),
    destroy: jest.fn(),
    pipe: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
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

// Mock VersionValidator
jest.mock('../../../src/drivers/VersionValidator', () => ({
    VersionValidator: {
        getVersion: jest.fn().mockReturnValue({ isValid: true }),
        getMinimumVersionString: jest.fn(() => '1.0.0')
    },
    DeviceConnectionException: class extends Error {
        constructor(message: string, version?: string) {
            super(message);
        }
    }
}));

describe('LogicAnalyzerDriver 中等覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        // 重置mock状态
        mockSerialPort.isOpen = false;
        mockLineParser.on = jest.fn();
        mockLineParser.off = jest.fn();
        mockLineParser.once = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('基础功能测试', () => {
        it('应该正确创建串口驱动实例', () => {
            driver = new LogicAnalyzerDriver('COM3');
            expect(driver).toBeDefined();
            expect(driver.isNetwork).toBe(false);
            expect(driver.isCapturing).toBe(false);
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
        });

        it('应该正确创建网络驱动实例', () => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
            expect(driver).toBeDefined();
            expect(driver.isNetwork).toBe(false); // 连接前为false
        });

        it('应该测试所有属性访问器', () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            // 设置私有属性进行测试
            (driver as any)._version = 'Test Version 1.0.0';
            (driver as any)._channelCount = 16;
            (driver as any)._maxFrequency = 50000000;
            (driver as any)._blastFrequency = 25000000;
            (driver as any)._bufferSize = 48000;
            (driver as any)._isNetwork = true;
            (driver as any)._capturing = true;

            expect(driver.deviceVersion).toBe('Test Version 1.0.0');
            expect(driver.channelCount).toBe(16);
            expect(driver.maxFrequency).toBe(50000000);
            expect(driver.blastFrequency).toBe(25000000);
            expect(driver.bufferSize).toBe(48000);
            expect(driver.isNetwork).toBe(true);
            expect(driver.isCapturing).toBe(true);
            expect(driver.driverType).toBe(AnalyzerDriverType.Network);
        });
    });

    describe('连接功能测试', () => {
        it('应该处理网络地址格式错误', async () => {
            driver = new LogicAnalyzerDriver('invalid-format');
            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的地址/端口格式无效');
        });

        it('应该处理无效端口号', async () => {
            driver = new LogicAnalyzerDriver('192.168.1.100:99999');
            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的端口号无效');
        });

        it('应该成功解析有效的网络地址', async () => {
            driver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 模拟成功的网络连接
            mockSocket.connect = jest.fn((port, host, callback) => {
                expect(port).toBe(8080);
                expect(host).toBe('192.168.1.100');
                setImmediate(callback);
                return mockSocket;
            });

            // 模拟设备信息响应
            let dataHandlerCallback: any;
            mockLineParser.on = jest.fn((event, callback) => {
                if (event === 'data') {
                    dataHandlerCallback = callback;
                }
            });

            const connectPromise = driver.connect();
            
            // 推进时间以触发连接回调
            jest.advanceTimersByTime(100);

            // 模拟设备信息响应
            if (dataHandlerCallback) {
                dataHandlerCallback('Version 1.0.0');
                dataHandlerCallback('FREQ:100000000');
                dataHandlerCallback('BLASTFREQ:100000000');
                dataHandlerCallback('BUFFER:96000');
                dataHandlerCallback('CHANNELS:24');
            }

            jest.advanceTimersByTime(100);

            const result = await connectPromise;
            expect(result.success).toBe(true);
            expect(result.deviceInfo?.name).toBe('Version 1.0.0');
            expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Network);
        });

        it('应该处理串口连接失败', async () => {
            driver = new LogicAnalyzerDriver('COM3');
            
            // 模拟串口打开失败
            mockSerialPort.open = jest.fn((callback) => {
                setImmediate(() => callback(new Error('端口打开失败')));
            });

            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('串口连接失败');
        });
    });

    describe('设备状态和电压查询', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该返回正确的设备状态', async () => {
            const status = await driver.getStatus();
            expect(status.isConnected).toBe(false);
            expect(status.isCapturing).toBe(false);
            expect(status.batteryVoltage).toBe('DISCONNECTED');
        });

        it('应该为串口设备返回模拟电压', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = false;

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('3.3V');
        });

        it('应该处理网络设备电压查询超时', async () => {
            // 模拟网络连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSocket;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = true;

            // 模拟写入成功但无响应
            mockSocket.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            const voltagePromise = driver.getVoltageStatus();
            
            // 推进时间5秒以触发超时
            jest.advanceTimersByTime(5000);

            const voltage = await voltagePromise;
            expect(voltage).toBe('TIMEOUT');
        });
    });

    describe('采集功能基础测试', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
            
            // 创建基础采集会话
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
                measureBursts: false
            } as CaptureSession;
        });

        it('应该拒绝设备忙时的采集请求', async () => {
            (driver as any)._capturing = true;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.Busy);
        });

        it('应该拒绝设备未连接时的采集请求', async () => {
            (driver as any)._isConnected = false;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('应该拒绝通信流未初始化时的采集请求', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = undefined;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('应该处理写入数据失败', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 96000;

            // 模拟写入失败
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback(new Error('写入失败')));
            });

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.UnexpectedError);
        });
    });

    describe('停止采集功能', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该处理未采集状态的停止请求', async () => {
            (driver as any)._capturing = false;

            const result = await driver.stopCapture();
            expect(result).toBe(true);
        });

        it('应该处理采集状态的停止请求', async () => {
            (driver as any)._capturing = true;
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._isNetwork = false;
            (driver as any)._serialPort = mockSerialPort;

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟串口重连
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
            
            // 推进时间2秒以完成停止和重连过程
            jest.advanceTimersByTime(2000);

            const result = await stopPromise;
            expect(result).toBe(true);
            expect((driver as any)._capturing).toBe(false);
        });
    });

    describe('引导加载程序功能', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该拒绝未连接设备的引导加载程序请求', async () => {
            const result = await driver.enterBootloader();
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
            mockLineParser.once = jest.fn((event, callback) => {
                if (event === 'data') {
                    setImmediate(() => callback('RESTARTING_BOOTLOADER'));
                }
            });

            const result = await driver.enterBootloader();
            expect(result).toBe(true);
        });
    });

    describe('网络配置功能', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该拒绝网络设备的网络配置', async () => {
            (driver as any)._isNetwork = true;

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        it('应该正确处理成功的网络配置', async () => {
            // 模拟串口连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockSerialPort;
            (driver as any)._lineParser = mockLineParser;
            (driver as any)._isNetwork = false;

            // 模拟写入成功
            mockSerialPort.write = jest.fn().mockImplementation((data, callback) => {
                setImmediate(() => callback());
            });

            // 模拟成功响应
            mockLineParser.once = jest.fn((event, callback) => {
                if (event === 'data') {
                    setImmediate(() => callback('SETTINGS_SAVED'));
                }
            });

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(true);
        });
    });

    describe('连接清理功能', () => {
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

        it('应该正确调用dispose', () => {
            const disconnectSpy = jest.spyOn(driver, 'disconnect');
            const superDisposeSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(driver)), 'dispose');

            driver.dispose();

            expect(disconnectSpy).toHaveBeenCalled();
            expect(superDisposeSpy).toHaveBeenCalled();
        });
    });

    describe('错误边界条件测试', () => {
        it('应该处理空连接字符串', () => {
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        it('应该处理null连接字符串', () => {
            expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
        });

        it('应该处理undefined连接字符串', () => {
            expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow('连接字符串不能为空');
        });

        it('应该处理端口号为0的情况', async () => {
            driver = new LogicAnalyzerDriver('192.168.1.100:0');
            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的端口号无效');
        });

        it('应该处理端口号为负数的情况', async () => {
            driver = new LogicAnalyzerDriver('192.168.1.100:-1');
            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toContain('指定的端口号无效');
        });
    });
});