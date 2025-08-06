/**
 * LogicAnalyzerDriver 最终覆盖率测试
 * 简化版本，专门针对剩余未覆盖的代码行
 * 目标：达到100%覆盖率
 */

import { LogicAnalyzerDriver } from '../../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../../src/models/CaptureModels';
import { TriggerType, CaptureError } from '../../../../src/models/AnalyzerTypes';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');

// Mock VersionValidator
jest.mock('../../../../src/drivers/VersionValidator', () => ({
    VersionValidator: {
        getVersion: jest.fn().mockReturnValue({ isValid: true }),
        getMinimumVersionString: jest.fn(() => '1.0.0')
    },
    DeviceConnectionException: class extends Error {
        constructor(message: string, version?: string) {
            super(message);
            this.name = 'DeviceConnectionException';
        }
    }
}));

describe('LogicAnalyzerDriver - 最终覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let mockSocket: any;
    let mockSerialPort: any;
    let mockParser: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock SerialPort
        mockSerialPort = {
            open: jest.fn((callback) => setTimeout(callback, 1)),
            close: jest.fn(),
            write: jest.fn((data, callback) => setTimeout(callback, 1)),
            isOpen: false,
            pipe: jest.fn(),
            on: jest.fn(),
            off: jest.fn()
        };
        (SerialPort as any).mockImplementation(() => mockSerialPort);

        // Mock Socket
        mockSocket = {
            connect: jest.fn((port, host, callback) => setTimeout(callback, 1)),
            destroy: jest.fn(),
            pipe: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            write: jest.fn()
        };
        (Socket as any).mockImplementation(() => mockSocket);

        // Mock ReadlineParser
        mockParser = {
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn()
        };
        (ReadlineParser as any).mockImplementation(() => mockParser);
    });

    test('应该处理captureCompletedHandler注册', async () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 直接设置连接状态和必要属性
        (driver as any)._isConnected = true;
        (driver as any)._capturing = false;
        (driver as any)._currentStream = { 
            write: jest.fn((data, callback) => callback && callback())
        };
        (driver as any)._channelCount = 24;
        (driver as any)._maxFrequency = 100000000;
        (driver as any)._bufferSize = 96000;

        const session: CaptureSession = {
            captureChannels: [{ channelNumber: 0, samples: new Uint8Array(0) }],
            preTriggerSamples: 100,
            postTriggerSamples: 1000,
            frequency: 1000000,
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 0,
            measureBursts: false,
            bursts: []
        };

        // Mock startDataReading来验证它被调用
        const startDataReadingSpy = jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {});

        const captureCompletedHandler = jest.fn();

        // 这应该覆盖187行的handler注册
        const result = await driver.startCapture(session, captureCompletedHandler);

        expect(result).toBe(CaptureError.None);
        expect(startDataReadingSpy).toHaveBeenCalled();
    });

    test('应该处理网络设备电压查询', async () => {
        driver = new LogicAnalyzerDriver('192.168.1.100:23');
        
        // 设置网络设备状态
        (driver as any)._isConnected = true;
        (driver as any)._currentStream = { write: jest.fn() };
        (driver as any)._isNetwork = true;
        (driver as any)._lineParser = mockParser;

        // Mock writeData
        jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);

        // Mock parser的once方法 - 覆盖275-282行
        mockParser.once.mockImplementation((event: string, callback: Function) => {
            setTimeout(() => callback('3.7V'), 1);
        });

        const voltage = await driver.getVoltageStatus();
        expect(voltage).toBe('3.7V');
    });

    test('应该处理网络配置响应', async () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 设置设备状态（非网络设备）
        (driver as any)._isConnected = true;
        (driver as any)._currentStream = { write: jest.fn() };
        (driver as any)._isNetwork = false;

        // Mock writeData和waitForResponse
        jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
        jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('SETTINGS_SAVED');

        // 覆盖347行
        const result = await driver.sendNetworkConfig('test-ap', 'password', '192.168.1.100', 23);
        expect(result).toBe(true);
    });

    test('应该处理设备信息解析错误', () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');

        // 直接调用parseDeviceInfo方法，传入不完整响应 - 覆盖439行
        const incompleteResponses = ['1.2.3', 'FREQ:100000000'];
        
        expect(() => {
            (driver as any).parseDeviceInfo(incompleteResponses);
        }).toThrow('设备信息响应不完整');
    });

    test('应该处理频率响应格式错误', () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');

        // 覆盖496行
        const badResponses = ['1.2.3', 'INVALID_FREQ', 'BLASTFREQ:100000000', 'BUFFER:96000', 'CHANNELS:24'];
        
        expect(() => {
            (driver as any).parseDeviceInfo(badResponses);
        }).toThrow('无效的设备频率响应');
    });

    test('应该处理突发频率响应格式错误', () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');

        // 覆盖506行
        const badResponses = ['1.2.3', 'FREQ:100000000', 'INVALID_BLAST', 'BUFFER:96000', 'CHANNELS:24'];
        
        expect(() => {
            (driver as any).parseDeviceInfo(badResponses);
        }).toThrow('无效的设备突发频率响应');
    });

    test('应该处理版本验证失败', () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');

        // Mock版本验证失败
        const { VersionValidator } = require('../../../../src/drivers/VersionValidator');
        VersionValidator.getVersion.mockReturnValueOnce({ isValid: false });

        // 覆盖522行
        const badResponses = ['0.0.1', 'FREQ:100000000', 'BLASTFREQ:100000000', 'BUFFER:96000', 'CHANNELS:24'];
        
        expect(() => {
            (driver as any).parseDeviceInfo(badResponses);
        }).toThrow('无效的设备版本');
    });

    test('应该处理数据读取错误', async () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        const session: CaptureSession = {
            captureChannels: [{ channelNumber: 0, samples: new Uint8Array(0) }],
            preTriggerSamples: 100,
            postTriggerSamples: 1000,
            frequency: 1000000,
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 0,
            measureBursts: false,
            bursts: []
        };

        // Mock currentStream
        (driver as any)._currentStream = { write: jest.fn() };

        // Mock waitForResponse返回错误响应 - 覆盖556行
        jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('CAPTURE_FAILED');

        // Mock emitCaptureCompleted来捕获错误处理
        const emitSpy = jest.spyOn(driver as any, 'emitCaptureCompleted');

        await (driver as any).startDataReading(session);

        // 验证错误处理被调用
        expect(emitSpy).toHaveBeenCalledWith({
            success: false,
            session
        });
    });

    test('应该处理读取数据异常', async () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        const session: CaptureSession = {
            captureChannels: [{ channelNumber: 0, samples: new Uint8Array(0) }],
            preTriggerSamples: 100,
            postTriggerSamples: 1000,
            frequency: 1000000,
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 0,
            measureBursts: false,
            bursts: []
        };

        // Mock currentStream
        (driver as any)._currentStream = { write: jest.fn() };

        // Mock waitForResponse正常响应，但readCaptureData抛出异常
        jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('CAPTURE_STARTED');
        jest.spyOn(driver as any, 'readCaptureData').mockRejectedValue(new Error('数据读取失败'));

        // Mock emitCaptureCompleted来捕获错误处理 - 覆盖562行
        const emitSpy = jest.spyOn(driver as any, 'emitCaptureCompleted');

        await (driver as any).startDataReading(session);

        // 验证错误处理被调用
        expect(emitSpy).toHaveBeenCalledWith({
            success: false,
            session
        });
    });

    test('应该处理时间戳调整逻辑', () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');

        // 创建特殊的时间戳数据，触发868-872行的调整逻辑
        const timestamps = new BigUint64Array([
            0x80000000n,  // 第一个时间戳
            0x7FFFFFFFn,  // 第二个时间戳（小于前一个，会触发调整）
            0x80000001n   // 第三个时间戳
        ]);

        const session: CaptureSession = {
            captureChannels: [{ channelNumber: 0, samples: new Uint8Array(0) }],
            preTriggerSamples: 100,
            postTriggerSamples: 1000,
            frequency: 1000000,
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 3,
            measureBursts: true,
            bursts: []
        };

        const bursts: any[] = [];

        // 调用processBurstTimestamps - 覆盖868-872行
        (driver as any).processBurstTimestamps(timestamps, session, bursts);

        expect(bursts.length).toBeGreaterThan(0);
    });

    test('应该处理网络设备重连', async () => {
        driver = new LogicAnalyzerDriver('192.168.1.100:23');
        
        // 设置网络设备状态
        (driver as any)._isNetwork = true;
        (driver as any)._tcpSocket = mockSocket;
        (driver as any)._devAddr = '192.168.1.100';
        (driver as any)._devPort = 23;

        // 覆盖977-980行
        await (driver as any).reconnectDevice();

        expect(mockSocket.destroy).toHaveBeenCalled();
        expect(mockSocket.connect).toHaveBeenCalled();
    });

    test('应该处理串口设备重连', async () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 设置串口设备状态
        (driver as any)._isNetwork = false;
        (driver as any)._serialPort = mockSerialPort;
        mockSerialPort.isOpen = true;

        // 覆盖998-1011行
        await (driver as any).reconnectDevice();

        expect(mockSerialPort.close).toHaveBeenCalled();
        expect(mockSerialPort.open).toHaveBeenCalled();
    });

    test('应该处理网络重连错误', async () => {
        driver = new LogicAnalyzerDriver('192.168.1.100:23');
        
        // 设置网络设备状态
        (driver as any)._isNetwork = true;
        (driver as any)._tcpSocket = mockSocket;
        (driver as any)._devAddr = '192.168.1.100';
        (driver as any)._devPort = 23;

        // Mock连接错误 - 覆盖984行
        mockSocket.on.mockImplementation((event: string, callback: Function) => {
            if (event === 'error') {
                setTimeout(() => callback(new Error('连接失败')), 1);
            }
        });

        try {
            await (driver as any).reconnectDevice();
            expect(true).toBe(false); // 应该抛出错误
        } catch (error: any) {
            expect(error.message).toContain('网络重连失败');
        }
    });

    test('应该处理串口重连错误', async () => {
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 设置串口设备状态
        (driver as any)._isNetwork = false;
        (driver as any)._serialPort = mockSerialPort;

        // Mock串口打开失败
        mockSerialPort.open.mockImplementation((callback: Function) => {
            setTimeout(() => callback(new Error('端口打开失败')), 1);
        });

        try {
            await (driver as any).reconnectDevice();
            expect(true).toBe(false); // 应该抛出错误
        } catch (error: any) {
            expect(error.message).toContain('串口重连失败');
        }
    });
});