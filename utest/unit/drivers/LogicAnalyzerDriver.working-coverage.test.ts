/**
 * LogicAnalyzerDriver 工作覆盖率测试
 * 2025-08-03 基于正确API的功能测试
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');

describe('LogicAnalyzerDriver - 工作覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let captureSession: CaptureSession;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockLineParser: jest.Mocked<ReadlineParser>;

    beforeEach(() => {
        jest.clearAllMocks();

        // 创建简单mock对象
        mockSerialPort = {
            isOpen: false,
            open: jest.fn((callback) => {
                mockSerialPort.isOpen = true;
                if (callback) setImmediate(callback);
            }),
            close: jest.fn((callback) => {
                mockSerialPort.isOpen = false;
                if (callback) setImmediate(callback);
            }),
            write: jest.fn().mockReturnValue(true),
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockSocket = {
            connect: jest.fn((port, host, callback) => {
                if (callback) setImmediate(callback);
                return mockSocket;
            }),
            write: jest.fn().mockReturnValue(true),
            on: jest.fn((event, callback) => {
                if (event === 'connect') {
                    setImmediate(callback);
                }
                return mockSocket;
            }),
            off: jest.fn(),
            destroy: jest.fn(),
            end: jest.fn(),
            removeAllListeners: jest.fn()
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

        // 创建测试用的CaptureSession
        captureSession = {
            captureChannels: [
                { channelNumber: 0, channelName: 'Channel 0' } as AnalyzerChannel
            ],
            sampleRate: 1000000,
            preTriggerSamples: 1000,
            postTriggerSamples: 9000,
            loopCount: 0,
            triggerType: TriggerType.None,
            triggerChannel: 0,
            triggerEdge: true
        } as CaptureSession;

        driver = new LogicAnalyzerDriver('COM3');
    });

    describe('基础功能测试', () => {
        test('构造函数 - 串口设备', () => {
            const serialDriver = new LogicAnalyzerDriver('COM3');
            expect(serialDriver.isNetwork).toBe(false);
            expect(serialDriver.deviceVersion).toBeNull();
            expect(serialDriver.channelCount).toBe(0);
            expect(serialDriver.driverType).toBe(AnalyzerDriverType.Serial);
        });

        test('构造函数 - 网络设备', () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            // 网络检测在connect时进行，构造时未设置
            expect(networkDriver.deviceVersion).toBeNull();
        });

        test('构造函数 - 空连接字符串', () => {
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        test('构造函数 - null连接字符串', () => {
            expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
        });
    });

    describe('连接功能测试', () => {
        test('串口连接成功', async () => {
            const result = await driver.connect();
            expect(result.success).toBe(true);
            expect(mockSerialPort.open).toHaveBeenCalled();
        });

        test('网络连接成功', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            const result = await networkDriver.connect();
            expect(result.success).toBe(true);
        });

        test('串口连接失败', async () => {
            mockSerialPort.open.mockImplementation((callback) => {
                if (callback) setImmediate(() => callback(new Error('Port not found')));
            });

            const result = await driver.connect();
            expect(result.success).toBe(false);
        });

        test('网络连接失败', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setImmediate(() => callback(new Error('Connection failed')));
                }
                return mockSocket;
            });

            const result = await networkDriver.connect();
            expect(result.success).toBe(false);
        });

        test('无效网络地址', async () => {
            const networkDriver = new LogicAnalyzerDriver('invalid-address');
            const result = await networkDriver.connect();
            expect(result.success).toBe(false);
        });
    });

    describe('采集功能测试', () => {
        beforeEach(async () => {
            await driver.connect();
            // 设置设备状态
            (driver as any)._maxFrequency = 1000000;
            (driver as any)._channelCount = 24;
            (driver as any)._version = '1.0.0';
        });

        test('设备未连接时启动采集', async () => {
            const unconnectedDriver = new LogicAnalyzerDriver('COM4');
            const result = await unconnectedDriver.startCapture(captureSession);
            expect(result).toBe(CaptureError.DeviceNotConnected);
        });

        test('重复启动采集', async () => {
            // Mock必要方法避免实际执行
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});

            // 第一次启动
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);

            // 第二次启动应该失败
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.DeviceCapturing);
        });

        test('采集启动异常处理', async () => {
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('Write failed'));

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.UnexpectedError);
            expect(driver.isCapturing).toBe(false);
        });

        test('停止采集 - 未在采集状态', async () => {
            const result = await driver.stopCapture();
            expect(result).toBe(false);
        });

        test('停止采集 - 正常流程', async () => {
            // 先启动采集
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});
            await driver.startCapture(captureSession);

            // Mock重连
            jest.spyOn(driver as any, 'reconnectDevice').mockResolvedValue(undefined);

            const result = await driver.stopCapture();
            expect(result).toBe(true);
            expect(driver.isCapturing).toBe(false);
        });
    });

    describe('状态管理测试', () => {
        beforeEach(async () => {
            await driver.connect();
        });

        test('电压获取 - 串口设备', async () => {
            const voltage = await driver.getVoltage();
            expect(voltage).toBe(3.3);
        });

        test('电压获取 - 网络设备', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            await networkDriver.connect();
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._currentStream = mockLineParser;

            jest.spyOn(networkDriver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(networkDriver as any, 'waitForResponse').mockResolvedValue('VOLTAGE:5.0');

            const voltage = await networkDriver.getVoltage();
            expect(voltage).toBe(5.0);
        });

        test('电压获取 - 设备未连接', async () => {
            const unconnectedDriver = new LogicAnalyzerDriver('COM4');
            const voltage = await unconnectedDriver.getVoltage();
            expect(voltage).toBe(0);
        });

        test('引导加载程序', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('BOOTLOADER');

            const result = await driver.enterBootloader();
            expect(result).toBe(true);
        });

        test('引导加载程序 - 设备未连接', async () => {
            const unconnectedDriver = new LogicAnalyzerDriver('COM4');
            const result = await unconnectedDriver.enterBootloader();
            expect(result).toBe(false);
        });

        test('引导加载程序 - 响应错误', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('ERROR');

            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });
    });

    describe('网络功能测试', () => {
        beforeEach(async () => {
            await driver.connect();
        });

        test('网络配置发送 - 串口设备', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('SETTINGS SAVED');

            const result = await driver.sendNetworkConfig('192.168.1.100', 8080);
            expect(result).toBe(true);
        });

        test('网络配置发送 - 网络设备拒绝', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            await networkDriver.connect();
            (networkDriver as any)._isNetwork = true;

            const result = await networkDriver.sendNetworkConfig('192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        test('网络配置发送 - 设备未连接', async () => {
            const unconnectedDriver = new LogicAnalyzerDriver('COM4');
            const result = await unconnectedDriver.sendNetworkConfig('192.168.1.100', 8080);
            expect(result).toBe(false);
        });
    });

    describe('设备信息读取测试', () => {
        beforeEach(async () => {
            await driver.connect();
        });

        test('设备信息完整读取', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            
            let callCount = 0;
            jest.spyOn(driver as any, 'waitForResponse').mockImplementation(() => {
                const responses = [
                    'FREQ:1000000',
                    'BLASTFREQ:50000000',
                    'BUFFER:512000',
                    'CHANNELS:24',
                    'VERSION:1.0.0'
                ];
                return Promise.resolve(responses[callCount++] || '');
            });

            const result = await (driver as any).readDeviceInfo();
            expect(result).toBe(true);
            expect(driver.maxFrequency).toBe(1000000);
            expect(driver.blastFrequency).toBe(50000000);
            expect(driver.bufferSize).toBe(512000);
            expect(driver.channelCount).toBe(24);
            expect(driver.deviceVersion).toBe('1.0.0');
        });

        test('设备信息读取超时', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockRejectedValue(new Error('Timeout'));

            const result = await (driver as any).readDeviceInfo();
            expect(result).toBe(false);
        });
    });

    describe('资源管理测试', () => {
        test('串口断开连接', async () => {
            await driver.connect();
            await driver.disconnect();
            expect(mockSerialPort.close).toHaveBeenCalled();
        });

        test('网络断开连接', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            await networkDriver.connect();
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._tcpSocket = mockSocket;

            await networkDriver.disconnect();
            expect(mockSocket.end).toHaveBeenCalled();
        });

        test('dispose方法', () => {
            (driver as any)._serialPort = mockSerialPort;
            driver.dispose();
            // dispose应该清理资源
        });
    });

    describe('重连功能测试', () => {
        test('串口重连', async () => {
            jest.spyOn(driver, 'disconnect').mockResolvedValue();
            jest.spyOn(driver, 'connect').mockResolvedValue({ success: true, message: 'Connected' });

            await (driver as any).reconnectDevice();
            expect(driver.disconnect).toHaveBeenCalled();
            expect(driver.connect).toHaveBeenCalled();
        });

        test('网络重连', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._devAddr = '192.168.1.100';
            (networkDriver as any)._devPort = 8080;

            jest.spyOn(networkDriver, 'disconnect').mockResolvedValue();
            jest.spyOn(networkDriver, 'connect').mockResolvedValue({ success: true, message: 'Connected' });

            await (networkDriver as any).reconnectDevice();
            expect(networkDriver.disconnect).toHaveBeenCalled();
            expect(networkDriver.connect).toHaveBeenCalled();
        });
    });

    describe('采集设置处理器测试', () => {
        beforeEach(async () => {
            await driver.connect();
            (driver as any)._maxFrequency = 1000000;
            (driver as any)._channelCount = 24;
        });

        test('设置采集完成处理器', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {
                // 模拟数据读取完成
                setImmediate(() => {
                    driver.emit('captureCompleted', { success: true });
                });
            });

            const handler = jest.fn();
            await driver.startCapture(captureSession, handler);
            
            // 等待事件触发
            await new Promise(resolve => setImmediate(resolve));
            
            expect(handler).toHaveBeenCalledWith({ success: true });
        });

        test('无处理器的采集', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
        });
    });

    describe('数据读取初始化测试', () => {
        test('startDataReading调用', () => {
            const mockReadCapture = jest.spyOn(driver as any, 'readCapture').mockResolvedValue({
                data: new Uint8Array([1, 2, 3]),
                timestamps: new BigUint64Array([100n]),
                bursts: []
            });

            (driver as any).startDataReading(captureSession);
            
            // 验证异步调用
            expect(driver.isCapturing).toBe(true);
        });
    });
});