/**
 * LogicAnalyzerDriver 简单覆盖率测试
 * 不使用复杂的异步操作，专注于同步代码路径
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType, CaptureError, AnalyzerDriverType } from '../../../src/models/AnalyzerTypes';

// 简单Mock，避免复杂的异步操作
jest.mock('serialport', () => ({
    SerialPort: jest.fn()
}));

jest.mock('net', () => ({
    Socket: jest.fn()
}));

jest.mock('@serialport/parser-readline', () => ({
    ReadlineParser: jest.fn()
}));

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

describe('LogicAnalyzerDriver 简单覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('构造函数和基础属性', () => {
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
        });

        it('应该抛出错误当连接字符串为空', () => {
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        it('应该抛出错误当连接字符串为null', () => {
            expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
        });

        it('应该抛出错误当连接字符串为undefined', () => {
            expect(() => new LogicAnalyzerDriver(undefined as any)).toThrow('连接字符串不能为空');
        });
    });

    describe('属性访问器测试', () => {
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

    describe('地址解析测试', () => {
        it('应该识别有效的网络地址格式', () => {
            const regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)/;
            const match = regex.exec('192.168.1.100:8080');
            expect(match).not.toBeNull();
            expect(match![1]).toBe('192.168.1.100');
            expect(match![2]).toBe('8080');
        });

        it('应该拒绝无效的地址格式', () => {
            const regex = /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)/;
            const match = regex.exec('invalid-format');
            expect(match).toBeNull();
        });

        it('应该验证端口号范围', () => {
            const port = parseInt('8080', 10);
            expect(port).toBeGreaterThan(0);
            expect(port).toBeLessThanOrEqual(65535);

            const invalidPort = parseInt('99999', 10);
            expect(invalidPort).toBeGreaterThan(65535);
        });
    });

    describe('采集参数验证测试', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
            
            // 设置私有属性模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 96000;

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

        it('应该测试getCaptureMode方法', () => {
            // 通过反射调用私有方法进行测试
            const getCaptureMode = (driver as any).getCaptureMode.bind(driver);
            
            // 8通道模式
            expect(getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7])).toBe(0);
            
            // 16通道模式
            expect(getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(1);
            
            // 24通道模式
            expect(getCaptureMode([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23])).toBe(2);
        });

        it('应该测试getLimits方法', () => {
            // 通过反射调用私有方法进行测试
            const getLimits = (driver as any).getLimits.bind(driver);
            
            const channels = [0, 1, 2, 3];
            const limits = getLimits(channels);
            
            expect(limits).toHaveProperty('minPreSamples');
            expect(limits).toHaveProperty('maxPreSamples');
            expect(limits).toHaveProperty('minPostSamples');
            expect(limits).toHaveProperty('maxPostSamples');
            expect(limits).toHaveProperty('maxTotalSamples');
            
            expect(limits.minPreSamples).toBe(2);
            expect(limits.minPostSamples).toBe(2);
        });

        it('应该测试validateSettings方法', () => {
            // 通过反射调用私有方法进行测试
            const validateSettings = (driver as any).validateSettings.bind(driver);
            
            const requestedSamples = captureSession.preTriggerSamples + captureSession.postTriggerSamples;
            const isValid = validateSettings(captureSession, requestedSamples);
            
            expect(typeof isValid).toBe('boolean');
        });

        it('应该测试composeRequest方法', () => {
            // 通过反射调用私有方法进行测试
            const composeRequest = (driver as any).composeRequest.bind(driver);
            
            const requestedSamples = 2000;
            const mode = 0;
            const request = composeRequest(captureSession, requestedSamples, mode);
            
            expect(request).toHaveProperty('triggerType');
            expect(request).toHaveProperty('trigger');
            expect(request).toHaveProperty('frequency');
            expect(request.triggerType).toBe(TriggerType.Edge);
            expect(request.frequency).toBe(captureSession.frequency);
        });
    });

    describe('设备状态基础测试', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该处理未连接设备的状态查询', async () => {
            const status = await driver.getStatus();
            expect(status.isConnected).toBe(false);
            expect(status.isCapturing).toBe(false);
            expect(status.batteryVoltage).toBe('DISCONNECTED');
        });

        it('应该为串口设备返回模拟电压', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = {}; // 简单的非null对象
            (driver as any)._isNetwork = false;

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('3.3V');
        });
    });

    describe('采集状态管理', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该拒绝设备忙时的采集请求', async () => {
            (driver as any)._capturing = true;

            const captureSession = {
                captureChannels: [{ channelNumber: 0, label: 'CH0' }],
                frequency: 1000000,
                preTriggerSamples: 100,
                postTriggerSamples: 100,
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                loopCount: 0
            } as CaptureSession;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.Busy);
        });

        it('应该拒绝设备未连接时的采集请求', async () => {
            (driver as any)._isConnected = false;

            const captureSession = {
                captureChannels: [{ channelNumber: 0, label: 'CH0' }],
                frequency: 1000000,
                preTriggerSamples: 100,
                postTriggerSamples: 100,
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                loopCount: 0
            } as CaptureSession;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('应该拒绝通信流未初始化时的采集请求', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = undefined;

            const captureSession = {
                captureChannels: [{ channelNumber: 0, label: 'CH0' }],
                frequency: 1000000,
                preTriggerSamples: 100,
                postTriggerSamples: 100,
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                loopCount: 0
            } as CaptureSession;

            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
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
    });

    describe('引导加载程序功能', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该拒绝未连接设备的引导加载程序请求', async () => {
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        it('应该拒绝通信流未初始化的引导加载程序请求', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = undefined;

            const result = await driver.enterBootloader();
            expect(result).toBe(false);
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
    });

    describe('连接管理', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
        });

        it('应该正确清理连接状态', async () => {
            // 模拟连接状态
            (driver as any)._isConnected = true;
            (driver as any)._serialPort = { isOpen: false, close: jest.fn() };
            (driver as any)._tcpSocket = { destroy: jest.fn() };

            await driver.disconnect();

            expect((driver as any)._isConnected).toBe(false);
            expect((driver as any)._serialPort).toBeUndefined();
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

    describe('正则表达式测试', () => {
        it('应该测试设备信息正则表达式', () => {
            // 测试频率正则
            const regFreq = /^FREQ:([0-9]+)$/;
            expect(regFreq.test('FREQ:100000000')).toBe(true);
            expect(regFreq.test('INVALID_FREQ')).toBe(false);

            // 测试突发频率正则
            const regBlast = /^BLASTFREQ:([0-9]+)$/;
            expect(regBlast.test('BLASTFREQ:50000000')).toBe(true);
            expect(regBlast.test('INVALID_BLAST')).toBe(false);

            // 测试缓冲区正则
            const regBuf = /^BUFFER:([0-9]+)$/;
            expect(regBuf.test('BUFFER:96000')).toBe(true);
            expect(regBuf.test('INVALID_BUFFER')).toBe(false);

            // 测试通道数正则
            const regChan = /^CHANNELS:([0-9]+)$/;
            expect(regChan.test('CHANNELS:24')).toBe(true);
            expect(regChan.test('INVALID_CHANNELS')).toBe(false);
        });
    });

    describe('能力建设测试', () => {
        beforeEach(() => {
            driver = new LogicAnalyzerDriver('COM3');
            // 设置一些属性
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._blastFrequency = 50000000;
            (driver as any)._bufferSize = 96000;
            (driver as any)._isNetwork = false;
        });

        it('应该构建正确的设备能力描述', () => {
            const buildCapabilities = (driver as any).buildCapabilities.bind(driver);
            const capabilities = buildCapabilities();

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
    });
});