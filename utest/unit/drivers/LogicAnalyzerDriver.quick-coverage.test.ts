/**
 * LogicAnalyzerDriver 快速覆盖率测试
 * 2025-08-03 专门解决超时问题的简化版本
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, CaptureMode, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');

describe('LogicAnalyzerDriver - 快速覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let captureSession: CaptureSession;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockLineParser: jest.Mocked<ReadlineParser>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.setTimeout(5000);

        // 创建简单mock对象
        mockSerialPort = {
            isOpen: false,
            open: jest.fn().mockImplementation((callback) => callback && callback()),
            close: jest.fn().mockImplementation((callback) => callback && callback()),
            write: jest.fn().mockReturnValue(true),
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockSocket = {
            connect: jest.fn().mockReturnThis(),
            write: jest.fn().mockReturnValue(true),
            on: jest.fn(),
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
        test('构造函数初始化', () => {
            expect(driver.isNetwork).toBe(false);
            expect(driver.deviceId).toBe('COM3');
            expect(driver.deviceVersion).toBeNull();
        });

        test('网络设备初始化', () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            expect(networkDriver.isNetwork).toBe(true);
        });
    });

    describe('连接功能测试', () => {
        test('串口连接成功', async () => {
            mockSerialPort.isOpen = true;
            const result = await driver.connect();
            expect(result.success).toBe(true);
        });

        test('网络连接模拟', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 简化网络连接测试
            mockSocket.on.mockImplementation((event, callback) => {
                if (event === 'connect') {
                    setImmediate(callback);
                }
                return mockSocket;
            });

            const result = await networkDriver.connect();
            expect(result.success).toBe(true);
        });
    });

    describe('采集功能测试', () => {
        beforeEach(async () => {
            mockSerialPort.isOpen = true;
            await driver.connect();
            (driver as any)._maxFrequency = 1000000;
            (driver as any)._channelCount = 24;
        });

        test('启动采集 - 基本流程', async () => {
            // Mock关键方法
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {
                // 立即模拟完成
                setImmediate(() => {
                    driver.emit('captureCompleted', { success: true });
                });
            });

            const handler = jest.fn();
            const result = await driver.startCapture(captureSession, handler);
            
            expect(result).toBe(CaptureError.None);
            expect(driver.capturing).toBe(true);
        });

        test('停止采集 - 模拟重连', async () => {
            // 先启动采集
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});
            await driver.startCapture(captureSession);

            // Mock重连
            jest.spyOn(driver as any, 'reconnectDevice').mockResolvedValue(undefined);

            const result = await driver.stopCapture();
            expect(result).toBe(true);
        });
    });

    describe('设备信息和状态测试', () => {
        beforeEach(async () => {
            mockSerialPort.isOpen = true;
            await driver.connect();
        });

        test('设备信息读取', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockImplementation(() => {
                return Promise.resolve('FREQ:1000000');
            });

            const result = await (driver as any).readDeviceInfo();
            expect(result).toBe(true);
        });

        test('电压状态获取', async () => {
            const voltage = await driver.getVoltage();
            expect(voltage).toBe(3.3); // 串口设备默认值
        });

        test('引导加载程序', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('BOOTLOADER');

            const result = await driver.enterBootloader();
            expect(result).toBe(true);
        });
    });

    describe('数据读取功能测试', () => {
        test('数据读取初始化', () => {
            jest.spyOn(driver as any, 'readCapture').mockResolvedValue({
                data: new Uint8Array([1, 2, 3]),
                timestamps: new BigUint64Array([100n]),
                bursts: []
            });

            (driver as any).startDataReading(captureSession);
            expect(driver.capturing).toBe(true);
        });

        test('网络数据读取', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._currentStream = mockLineParser;

            jest.spyOn(networkDriver as any, 'readNetworkCaptureData').mockImplementation((session, mode, totalSamples, resolve) => {
                resolve({
                    data: new Uint8Array([1, 2, 3]),
                    timestamps: new BigUint64Array([100n]),
                    bursts: []
                });
            });

            const result = await (networkDriver as any).readCapture(captureSession);
            expect(result).toBeDefined();
        });
    });

    describe('网络功能测试', () => {
        test('网络配置发送', async () => {
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('SETTINGS SAVED');

            const result = await driver.sendNetworkConfig('192.168.1.100', 8080);
            expect(result).toBe(true);
        });

        test('网络电压查询', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._currentStream = mockLineParser;

            jest.spyOn(networkDriver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(networkDriver as any, 'waitForResponse').mockResolvedValue('VOLTAGE:5.0');

            const voltage = await networkDriver.getVoltage();
            expect(voltage).toBe(5.0);
        });
    });

    describe('错误处理测试', () => {
        test('设备未连接错误', async () => {
            const unconnectedDriver = new LogicAnalyzerDriver('COM4');
            const result = await unconnectedDriver.startCapture(captureSession);
            expect(result).toBe(CaptureError.DeviceNotConnected);
        });

        test('采集异常处理', async () => {
            mockSerialPort.isOpen = true;
            await driver.connect();
            
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('Write failed'));
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.UnexpectedError);
        });

        test('无效地址格式', async () => {
            const networkDriver = new LogicAnalyzerDriver('invalid-address');
            const result = await networkDriver.connect();
            expect(result.success).toBe(false);
        });
    });

    describe('资源管理测试', () => {
        test('串口断开连接', async () => {
            mockSerialPort.isOpen = true;
            await driver.connect();
            await driver.disconnect();
            expect(mockSerialPort.close).toHaveBeenCalled();
        });

        test('网络断开连接', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            (networkDriver as any)._isNetwork = true;
            (networkDriver as any)._tcpSocket = mockSocket;

            await networkDriver.disconnect();
            expect(mockSocket.end).toHaveBeenCalled();
        });

        test('资源清理', () => {
            (driver as any)._serialPort = mockSerialPort;
            driver.dispose();
            expect(mockSerialPort.removeAllListeners).toHaveBeenCalled();
        });
    });

    describe('设备重连测试', () => {
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

    describe('综合验证测试', () => {
        test('设备能力描述', () => {
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 1000000;
            (driver as any)._bufferSize = 512000;

            const capabilities = driver.getCapabilities();
            expect(capabilities.channels.digital).toBe(24);
            expect(capabilities.sampling.maxRate).toBe(1000000);
        });

        test('完整流程验证', async () => {
            // 连接
            mockSerialPort.isOpen = true;
            const connectResult = await driver.connect();
            expect(connectResult.success).toBe(true);

            // 采集
            (driver as any)._maxFrequency = 1000000;
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});
            
            const captureResult = await driver.startCapture(captureSession);
            expect(captureResult).toBe(CaptureError.None);

            // 断开
            await driver.disconnect();
            expect(mockSerialPort.close).toHaveBeenCalled();
        });
    });
});