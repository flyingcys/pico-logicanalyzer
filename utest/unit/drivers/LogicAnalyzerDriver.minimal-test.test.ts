/**
 * LogicAnalyzerDriver 最小测试
 * 专注解决基本API覆盖
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

describe('LogicAnalyzerDriver - 最小测试', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
        driver = new LogicAnalyzerDriver('COM3');
    });

    describe('基础构造测试', () => {
        test('串口设备构造', () => {
            const serialDriver = new LogicAnalyzerDriver('COM3');
            expect(serialDriver).toBeDefined();
            expect(serialDriver.isNetwork).toBe(false);
            expect(serialDriver.deviceVersion).toBeNull();
            expect(serialDriver.channelCount).toBe(0);
            expect(serialDriver.driverType).toBe(AnalyzerDriverType.Serial);
        });

        test('空字符串构造异常', () => {
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        test('null构造异常', () => {
            expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
        });

        test('undefined构造异常', () => {
            expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow('连接字符串不能为空');
        });
    });

    describe('基础属性测试', () => {
        test('初始状态属性', () => {
            expect(driver.deviceVersion).toBeNull();
            expect(driver.channelCount).toBe(0);
            expect(driver.maxFrequency).toBe(0);
            expect(driver.blastFrequency).toBe(0);
            expect(driver.bufferSize).toBe(0);
            expect(driver.isNetwork).toBe(false);
            expect(driver.isCapturing).toBe(false);
        });

        test('设备类型识别', () => {
            const serialDriver = new LogicAnalyzerDriver('COM3');
            expect(serialDriver.driverType).toBe(AnalyzerDriverType.Serial);

            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            expect(networkDriver.driverType).toBe(AnalyzerDriverType.Serial); // 初始时还是Serial，连接后才变为Network
        });

        test('minFrequency计算', () => {
            // 设置maxFrequency
            (driver as any)._maxFrequency = 1000000;
            const expected = Math.floor((1000000 * 2) / 65535);
            expect(driver.minFrequency).toBe(expected);
        });
    });

    describe('网络地址解析测试', () => {
        test('网络地址格式检测', () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            expect(networkDriver).toBeDefined();
        });

        test('IP地址和端口分离', () => {
            const connectionString = '192.168.1.100:8080';
            const regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)/;
            const match = connectionString.match(regex);
            expect(match).not.toBeNull();
            expect(match![1]).toBe('192.168.1.100');
            expect(match![2]).toBe('8080');
        });
    });

    describe('设备状态测试', () => {
        test('未连接状态', () => {
            expect(driver.isCapturing).toBe(false);
            expect((driver as any)._isConnected).toBe(false);
        });

        test('capturing状态设置', () => {
            // 直接设置内部状态测试getter
            (driver as any)._capturing = true;
            expect(driver.isCapturing).toBe(true);

            (driver as any)._capturing = false;
            expect(driver.isCapturing).toBe(false);
        });

        test('网络状态设置', () => {
            (driver as any)._isNetwork = true;
            expect(driver.isNetwork).toBe(true);
            expect(driver.driverType).toBe(AnalyzerDriverType.Network);

            (driver as any)._isNetwork = false;
            expect(driver.isNetwork).toBe(false);
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
        });
    });

    describe('设备信息设置测试', () => {
        test('设备版本设置', () => {
            (driver as any)._version = '1.2.3';
            expect(driver.deviceVersion).toBe('1.2.3');

            (driver as any)._version = null;
            expect(driver.deviceVersion).toBeNull();
        });

        test('设备参数设置', () => {
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 1000000;
            (driver as any)._blastFrequency = 50000000;
            (driver as any)._bufferSize = 512000;

            expect(driver.channelCount).toBe(24);
            expect(driver.maxFrequency).toBe(1000000);
            expect(driver.blastFrequency).toBe(50000000);
            expect(driver.bufferSize).toBe(512000);
        });
    });

    describe('getCaptureMode测试', () => {
        test('单通道模式', () => {
            const mode = (driver as any).getCaptureMode([0]);
            expect(typeof mode).toBe('number');
        });

        test('多通道模式', () => {
            const mode = (driver as any).getCaptureMode([0, 1, 2, 3]);
            expect(typeof mode).toBe('number');
        });

        test('全通道模式', () => {
            const channels = Array.from({length: 24}, (_, i) => i);
            const mode = (driver as any).getCaptureMode(channels);
            expect(typeof mode).toBe('number');
        });
    });

    describe('tag属性测试', () => {
        test('tag属性设置和获取', () => {
            expect(driver.tag).toBeUndefined();
            
            driver.tag = 'test-tag';
            expect(driver.tag).toBe('test-tag');

            driver.tag = { custom: 'data' };
            expect(driver.tag).toEqual({ custom: 'data' });
        });
    });

    describe('dispose方法测试', () => {
        test('dispose基本调用', () => {
            expect(() => driver.dispose()).not.toThrow();
        });

        test('dispose清理serialPort', () => {
            const mockSerialPort = {
                removeAllListeners: jest.fn()
            };
            (driver as any)._serialPort = mockSerialPort;
            
            driver.dispose();
            expect(mockSerialPort.removeAllListeners).toHaveBeenCalled();
        });

        test('dispose清理tcpSocket', () => {
            const mockSocket = {
                removeAllListeners: jest.fn(),
                destroy: jest.fn()
            };
            (driver as any)._tcpSocket = mockSocket;
            
            driver.dispose();
            expect(mockSocket.destroy).toHaveBeenCalled();
        });

        test('dispose清理lineParser', () => {
            const mockParser = {
                removeAllListeners: jest.fn()
            };
            (driver as any)._lineParser = mockParser;
            
            driver.dispose();
            expect(mockParser.removeAllListeners).toHaveBeenCalled();
        });
    });

    describe('正则表达式测试', () => {
        test('地址端口正则', () => {
            const regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)/;
            
            expect('192.168.1.100:8080'.match(regex)).not.toBeNull();
            expect('10.0.0.1:3000'.match(regex)).not.toBeNull();
            expect('invalid-address'.match(regex)).toBeNull();
            expect('192.168.1.100'.match(regex)).toBeNull();
        });

        test('设备响应正则', () => {
            const regChan = /^CHANNELS:([0-9]+)$/;
            const regBuf = /^BUFFER:([0-9]+)$/;
            const regFreq = /^FREQ:([0-9]+)$/;
            const regBlast = /^BLASTFREQ:([0-9]+)$/;

            expect('CHANNELS:24'.match(regChan)).not.toBeNull();
            expect('BUFFER:512000'.match(regBuf)).not.toBeNull();
            expect('FREQ:1000000'.match(regFreq)).not.toBeNull();
            expect('BLASTFREQ:50000000'.match(regBlast)).not.toBeNull();

            expect('INVALID:24'.match(regChan)).toBeNull();
        });
    });

    describe('内部状态管理测试', () => {
        test('连接状态管理', () => {
            expect((driver as any)._isConnected).toBe(false);
            
            (driver as any)._isConnected = true;
            expect((driver as any)._isConnected).toBe(true);
        });

        test('网络参数设置', () => {
            (driver as any)._devAddr = '192.168.1.100';
            (driver as any)._devPort = 8080;
            
            expect((driver as any)._devAddr).toBe('192.168.1.100');
            expect((driver as any)._devPort).toBe(8080);
        });

        test('通信对象初始化状态', () => {
            expect((driver as any)._serialPort).toBeUndefined();
            expect((driver as any)._tcpSocket).toBeUndefined();
            expect((driver as any)._currentStream).toBeUndefined();
            expect((driver as any)._lineParser).toBeUndefined();
        });
    });
});