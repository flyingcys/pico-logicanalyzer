/**
 * MultiAnalyzerDriver 单元测试
 * 测试多设备同步逻辑分析器驱动功能
 */

import { MultiAnalyzerDriver } from '../../../../src/drivers/MultiAnalyzerDriver';
import { LogicAnalyzerDriver } from '../../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../../src/models/CaptureModels';
import { AnalyzerDriverType, CaptureError, TriggerType, CaptureMode } from '../../../../src/models/AnalyzerTypes';

// Mock LogicAnalyzerDriver
jest.mock('../../../../src/drivers/LogicAnalyzerDriver');

// Mock SerialPort
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => callback && callback()),
        close: jest.fn((callback) => callback && callback()),
        write: jest.fn((data, callback) => callback && callback()),
        on: jest.fn(),
        off: jest.fn(),
        isOpen: true
    })),
    available: jest.fn().mockResolvedValue([
        { path: '/dev/ttyUSB0', manufacturer: 'Test', vendorId: '1234', productId: '5678' }
    ])
}));

describe('MultiAnalyzerDriver', () => {
    let multiDriver: MultiAnalyzerDriver;
    let mockDevices: jest.Mocked<LogicAnalyzerDriver>[];
    let captureSession: CaptureSession;
    
    // 创建Mock LogicAnalyzerDriver
    const createMockDevice = (deviceIndex: number): jest.Mocked<LogicAnalyzerDriver> => {
        const mockDevice = {
            // 属性
            channelCount: 24,
            maxFrequency: 100000000,
            minFrequency: 1000000,
            blastFrequency: 100000000,
            bufferSize: 96000,
            isNetwork: false,
            isCapturing: false,
            deviceVersion: `Test Logic Analyzer V1_23`,
            driverType: AnalyzerDriverType.Serial,
            tag: deviceIndex,
            
            // 方法
            connect: jest.fn().mockResolvedValue({ success: true, deviceInfo: { name: 'Test Device' } }),
            disconnect: jest.fn().mockResolvedValue(undefined),
            getStatus: jest.fn().mockResolvedValue({ 
                isConnected: true, 
                isCapturing: false,
                batteryVoltage: '3.8V'
            }),
            startCapture: jest.fn().mockResolvedValue(CaptureError.None),
            stopCapture: jest.fn().mockResolvedValue(true),
            enterBootloader: jest.fn().mockResolvedValue(true),
            sendNetworkConfig: jest.fn().mockResolvedValue(false),
            getVoltageStatus: jest.fn().mockResolvedValue('3.8V'),
            getDeviceInfo: jest.fn().mockReturnValue({
                name: 'Test Device',
                maxFrequency: 100000000,
                channels: 24,
                bufferSize: 96000
            }),
            getCaptureMode: jest.fn().mockReturnValue(CaptureMode.Channels_24),
            getLimits: jest.fn().mockReturnValue({
                minPreSamples: 0,
                maxPreSamples: 32000,
                minPostSamples: 1,
                maxPostSamples: 64000,
                maxTotalSamples: 96000
            }),
            dispose: jest.fn(),
            
            // 事件系统
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn(),
            emit: jest.fn()
        } as any;

        return mockDevice;
    };
    
    beforeEach(() => {
        // 清除所有Mock
        jest.clearAllMocks();
        
        // Mock LogicAnalyzerDriver构造函数
        (LogicAnalyzerDriver as jest.MockedClass<typeof LogicAnalyzerDriver>).mockImplementation((connectionString: string) => {
            const deviceIndex = parseInt(connectionString.split('USB')[1] || '0');
            return createMockDevice(deviceIndex);
        });
        
        // 创建测试用的多设备驱动 (3个设备)
        const connectionStrings = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyUSB2'];
        multiDriver = new MultiAnalyzerDriver(connectionStrings);
        
        // 获取创建的Mock设备
        mockDevices = (multiDriver as any)._connectedDevices;
        
        // 创建测试用的采集会话
        captureSession = new CaptureSession();
        captureSession.frequency = 24000000;
        captureSession.preTriggerSamples = 1000;
        captureSession.postTriggerSamples = 10000;
        captureSession.triggerType = TriggerType.Complex;
        captureSession.triggerChannel = 0;
        captureSession.captureChannels = [
            new AnalyzerChannel(0, 'Channel 1'), // 设备0
            new AnalyzerChannel(24, 'Channel 25'), // 设备1
            new AnalyzerChannel(48, 'Channel 49') // 设备2
        ];
    });
    
    afterEach(() => {
        if (multiDriver) {
            multiDriver.dispose();
        }
    });
    
    describe('构造函数和初始化', () => {
        it('应该拒绝无效的设备数量', () => {
            expect(() => new MultiAnalyzerDriver([])).toThrow('无效的设备数量');
            expect(() => new MultiAnalyzerDriver(['/dev/ttyUSB0'])).toThrow('无效的设备数量');
            expect(() => new MultiAnalyzerDriver(Array(6).fill('/dev/ttyUSB'))).toThrow('无效的设备数量');
        });
        
        it('应该接受有效的设备数量（2-5个）', () => {
            expect(() => new MultiAnalyzerDriver(['/dev/ttyUSB0', '/dev/ttyUSB1'])).not.toThrow();
            expect(() => new MultiAnalyzerDriver(Array(5).fill('/dev/ttyUSB').map((p, i) => `${p}${i}`))).not.toThrow();
        });
        
        it('应该正确设置驱动类型为多设备', () => {
            expect(multiDriver.driverType).toBe(AnalyzerDriverType.Multi);
        });
        
        it('应该正确初始化所有设备', () => {
            expect(LogicAnalyzerDriver).toHaveBeenCalledTimes(3);
            expect(mockDevices).toHaveLength(3);
            expect(mockDevices[0].tag).toBe(0);
            expect(mockDevices[1].tag).toBe(1);
            expect(mockDevices[2].tag).toBe(2);
        });
        
        it('应该为所有设备设置事件监听器', () => {
            for (const device of mockDevices) {
                expect(device.on).toHaveBeenCalledWith('captureCompleted', expect.any(Function));
            }
        });
    });
    
    describe('设备连接和版本验证', () => {
        it('应该成功连接所有设备', async () => {
            const result = await multiDriver.connect();
            
            expect(result.success).toBe(true);
            expect(result.deviceInfo?.name).toContain('MULTI_ANALYZER');
            expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Multi);
            
            // 验证所有设备都被连接
            for (const device of mockDevices) {
                expect(device.connect).toHaveBeenCalled();
            }
        });
        
        it('应该处理设备连接失败', async () => {
            mockDevices[1].connect.mockResolvedValue({ success: false, error: '连接失败' });
            
            const result = await multiDriver.connect();
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('设备连接失败');
        });
        
        it('应该验证设备版本兼容性', async () => {
            // 设置不兼容的版本
            mockDevices[1].deviceVersion = 'Test Logic Analyzer V2_24';
            
            const result = await multiDriver.connect();
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('设备版本不兼容');
        });
        
        it('应该处理无效的设备版本', async () => {
            mockDevices[0].deviceVersion = 'Invalid Version';
            
            const result = await multiDriver.connect();
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('版本无效');
        });
        
        it('应该正确断开所有设备', async () => {
            await multiDriver.disconnect();
            
            for (const device of mockDevices) {
                expect(device.disconnect).toHaveBeenCalled();
            }
        });
    });
    
    describe('属性计算', () => {
        it('应该正确计算总通道数', () => {
            // 3个设备 × 24通道 = 72通道
            expect(multiDriver.channelCount).toBe(72);
        });
        
        it('应该返回所有设备的最小最大频率', () => {
            // 设置不同的最大频率
            mockDevices[0].maxFrequency = 100000000;
            mockDevices[1].maxFrequency = 80000000;
            mockDevices[2].maxFrequency = 120000000;
            
            expect(multiDriver.maxFrequency).toBe(80000000); // 最小值
        });
        
        it('应该返回所有设备的最大最小频率', () => {
            // 设置不同的最小频率
            mockDevices[0].minFrequency = 1000000;
            mockDevices[1].minFrequency = 2000000;
            mockDevices[2].minFrequency = 1500000;
            
            expect(multiDriver.minFrequency).toBe(2000000); // 最大值
        });
        
        it('应该返回0作为突发频率（不支持）', () => {
            expect(multiDriver.blastFrequency).toBe(0);
        });
        
        it('应该返回所有设备的最小缓冲区大小', () => {
            mockDevices[0].bufferSize = 96000;
            mockDevices[1].bufferSize = 64000;
            mockDevices[2].bufferSize = 128000;
            
            expect(multiDriver.bufferSize).toBe(64000); // 最小值
        });
        
        it('应该标识为非网络设备', () => {
            expect(multiDriver.isNetwork).toBe(false);
        });
        
        it('初始状态应该不在采集中', () => {
            expect(multiDriver.isCapturing).toBe(false);
        });
    });
    
    describe('设备状态查询', () => {
        it('应该返回综合设备状态', async () => {
            const status = await multiDriver.getStatus();
            
            expect(status.isConnected).toBe(true);
            expect(status.isCapturing).toBe(false);
            expect(status.batteryVoltage).toBe('N/A');
            expect(status.multiDeviceStatus).toHaveLength(3);
            
            // 验证所有设备状态都被查询
            for (const device of mockDevices) {
                expect(device.getStatus).toHaveBeenCalled();
            }
        });
        
        it('应该正确反映设备连接状态', async () => {
            mockDevices[1].getStatus.mockResolvedValue({ 
                isConnected: false, 
                isCapturing: false,
                batteryVoltage: '3.8V'
            });
            
            const status = await multiDriver.getStatus();
            
            expect(status.isConnected).toBe(false); // 有设备未连接
        });
    });
    
    describe('采集功能', () => {
        it('应该拒绝边沿触发', async () => {
            captureSession.triggerType = TriggerType.Edge;
            
            const result = await multiDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.BadParams);
        });
        
        it('应该拒绝空通道列表', async () => {
            captureSession.captureChannels = [];
            
            const result = await multiDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.BadParams);
        });
        
        it('应该处理正在采集状态', async () => {
            (multiDriver as any)._capturing = true;
            
            const result = await multiDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.Busy);
        });
        
        it('应该成功启动多设备同步采集', async () => {
            const result = await multiDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.None);
            expect(multiDriver.isCapturing).toBe(true);
            
            // 验证所有相关设备都启动了采集
            expect(mockDevices[0].startCapture).toHaveBeenCalled(); // 主设备
            expect(mockDevices[1].startCapture).toHaveBeenCalled(); // 从设备
            expect(mockDevices[2].startCapture).toHaveBeenCalled(); // 从设备
        });
        
        it('应该处理设备采集启动失败', async () => {
            mockDevices[1].startCapture.mockResolvedValue(CaptureError.HardwareError);
            
            const result = await multiDriver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.HardwareError);
            
            // 验证停止采集被调用
            expect(mockDevices[0].stopCapture).toHaveBeenCalled();
            expect(mockDevices[2].stopCapture).toHaveBeenCalled();
        });
        
        it('应该成功停止所有设备采集', async () => {
            (multiDriver as any)._capturing = true;
            
            const result = await multiDriver.stopCapture();
            
            expect(result).toBe(true);
            expect(multiDriver.isCapturing).toBe(false);
            
            // 验证所有设备停止采集
            for (const device of mockDevices) {
                expect(device.stopCapture).toHaveBeenCalled();
            }
        });
        
        it('应该处理未采集状态的停止操作', async () => {
            const result = await multiDriver.stopCapture();
            
            expect(result).toBe(true);
        });
    });
    
    describe('通道分配逻辑', () => {
        it('应该正确分配通道到各设备', () => {
            const channels = [0, 1, 24, 25, 48, 49]; // 跨3个设备的通道
            const result = (multiDriver as any).splitChannelsPerDevice(channels);
            
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual([0, 1]); // 设备0: 通道0-23映射为0-23
            expect(result[1]).toEqual([0, 1]); // 设备1: 通道24-47映射为0-23
            expect(result[2]).toEqual([0, 1]); // 设备2: 通道48-71映射为0-23
        });
        
        it('应该处理空设备通道', () => {
            const channels = [0, 1]; // 仅使用第一个设备
            const result = (multiDriver as any).splitChannelsPerDevice(channels);
            
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual([0, 1]);
            expect(result[1]).toEqual([]);
            expect(result[2]).toEqual([]);
        });
        
        it('应该正确计算采集模式', () => {
            const channels8 = [0, 1, 2, 3, 4, 5, 6, 7];
            expect(multiDriver.getCaptureMode(channels8)).toBe(CaptureMode.Channels_8);
            
            const channels16 = [0, 15, 24, 39];
            expect(multiDriver.getCaptureMode(channels16)).toBe(CaptureMode.Channels_16);
            
            const channels24 = [0, 23, 24, 47];
            expect(multiDriver.getCaptureMode(channels24)).toBe(CaptureMode.Channels_24);
        });
    });
    
    describe('会话创建', () => {
        it('应该创建正确的从设备会话', () => {
            const channels = [0, 1, 2];
            const offset = 5;
            const slaveSession = (multiDriver as any).createSlaveSession(captureSession, channels, offset);
            
            expect(slaveSession.triggerType).toBe(TriggerType.Edge);
            expect(slaveSession.triggerChannel).toBe(24); // 外部触发
            expect(slaveSession.preTriggerSamples).toBe(captureSession.preTriggerSamples + offset);
            expect(slaveSession.postTriggerSamples).toBe(captureSession.postTriggerSamples - offset);
            expect(slaveSession.loopCount).toBe(0);
            expect(slaveSession.measureBursts).toBe(false);
            expect(slaveSession.captureChannels).toHaveLength(3);
        });
        
        it('应该创建正确的主设备会话', () => {
            const channels = [0, 1, 2];
            const masterSession = (multiDriver as any).createMasterSession(captureSession, channels);
            
            expect(masterSession.triggerType).toBe(captureSession.triggerType);
            expect(masterSession.triggerChannel).toBe(captureSession.triggerChannel);
            expect(masterSession.preTriggerSamples).toBe(captureSession.preTriggerSamples);
            expect(masterSession.postTriggerSamples).toBe(captureSession.postTriggerSamples);
            expect(masterSession.captureChannels).toHaveLength(3);
        });
    });
    
    describe('采集限制计算', () => {
        it('应该返回最严格的采集限制', () => {
            // 设置不同设备的不同限制
            mockDevices[0].getLimits.mockReturnValue({
                minPreSamples: 0,
                maxPreSamples: 32000,
                minPostSamples: 1,
                maxPostSamples: 64000,
                maxTotalSamples: 96000
            });
            mockDevices[1].getLimits.mockReturnValue({
                minPreSamples: 10,
                maxPreSamples: 24000,
                minPostSamples: 5,
                maxPostSamples: 48000,
                maxTotalSamples: 72000
            });
            mockDevices[2].getLimits.mockReturnValue({
                minPreSamples: 5,
                maxPreSamples: 28000,
                minPostSamples: 2,
                maxPostSamples: 56000,
                maxTotalSamples: 84000
            });
            
            const channels = [0, 24, 48];
            const limits = multiDriver.getLimits(channels);
            
            expect(limits.minPreSamples).toBe(10); // 最大的最小值
            expect(limits.maxPreSamples).toBe(24000); // 最小的最大值
            expect(limits.minPostSamples).toBe(5); // 最大的最小值
            expect(limits.maxPostSamples).toBe(48000); // 最小的最大值
        });
    });
    
    describe('特殊功能', () => {
        it('应该拒绝网络配置', async () => {
            const result = await multiDriver.sendNetworkConfig('ssid', 'pass', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });
        
        it('应该返回不支持的电压状态', async () => {
            const voltage = await multiDriver.getVoltageStatus();
            expect(voltage).toBe('UNSUPPORTED');
        });
        
        it('应该在采集中时拒绝进入引导模式', async () => {
            (multiDriver as any)._capturing = true;
            
            const result = await multiDriver.enterBootloader();
            expect(result).toBe(false);
        });
        
        it('应该成功让所有设备进入引导模式', async () => {
            const result = await multiDriver.enterBootloader();
            
            expect(result).toBe(true);
            for (const device of mockDevices) {
                expect(device.enterBootloader).toHaveBeenCalled();
            }
        });
        
        it('应该处理部分设备引导模式失败', async () => {
            mockDevices[1].enterBootloader.mockResolvedValue(false);
            
            const result = await multiDriver.enterBootloader();
            expect(result).toBe(false);
        });
    });
    
    describe('采集完成事件处理', () => {
        it('应该处理单个设备采集完成', () => {
            // 模拟采集状态
            (multiDriver as any)._capturing = true;
            (multiDriver as any)._sourceSession = captureSession;
            (multiDriver as any)._deviceCaptures = [
                { completed: false, session: null },
                { completed: false, session: null },
                { completed: false, session: null }
            ];
            
            // 模拟设备1完成采集
            const mockSession = { ...captureSession, deviceTag: 1 };
            (multiDriver as any).handleDeviceCaptureCompleted({
                success: true,
                session: mockSession
            });
            
            const deviceCaptures = (multiDriver as any)._deviceCaptures;
            expect(deviceCaptures[1].completed).toBe(true);
            expect(deviceCaptures[1].session).toBe(mockSession);
        });
        
        it('应该处理设备采集失败', () => {
            (multiDriver as any)._capturing = true;
            (multiDriver as any)._sourceSession = captureSession;
            
            const stopCaptureSpy = jest.spyOn(multiDriver, 'stopCapture');
            
            (multiDriver as any).handleDeviceCaptureCompleted({
                success: false,
                session: captureSession
            });
            
            expect(stopCaptureSpy).toHaveBeenCalled();
        });
        
        it('应该在所有设备完成后合并结果', () => {
            const combineResultsSpy = jest.spyOn(multiDriver as any, 'combineDeviceResults');
            
            (multiDriver as any)._capturing = true;
            (multiDriver as any)._sourceSession = captureSession;
            (multiDriver as any)._deviceCaptures = [
                { completed: true, session: captureSession },
                { completed: true, session: captureSession },
                { completed: true, session: captureSession }
            ];
            
            (multiDriver as any).handleDeviceCaptureCompleted({
                success: true,
                session: { ...captureSession, deviceTag: 0 }
            });
            
            expect(combineResultsSpy).toHaveBeenCalled();
        });
    });
    
    describe('性能测试', () => {
        it('设备初始化应该快速完成', () => {
            const startTime = Date.now();
            const driver = new MultiAnalyzerDriver(['/dev/ttyUSB0', '/dev/ttyUSB1']);
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100);
            driver.dispose();
        });
        
        it('通道分配计算应该高效', () => {
            const channels = Array.from({length: 72}, (_, i) => i);
            
            const startTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                (multiDriver as any).splitChannelsPerDevice(channels);
            }
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100);
        });
        
        it('属性计算应该高效', () => {
            const startTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                multiDriver.channelCount;
                multiDriver.maxFrequency;
                multiDriver.bufferSize;
            }
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(50);
        });
    });
    
    describe('错误处理', () => {
        it('应该处理采集参数验证错误', async () => {
            // 设置无效的频率
            captureSession.frequency = 0;
            
            const result = await multiDriver.startCapture(captureSession);
            expect(result).toBe(CaptureError.BadParams);
        });
        
        it('应该处理超出范围的通道', async () => {
            captureSession.captureChannels = [
                new AnalyzerChannel(100, 'Invalid Channel') // 超出范围
            ];
            
            const result = await multiDriver.startCapture(captureSession);
            expect(result).toBe(CaptureError.BadParams);
        });
        
        it('应该处理采集启动异常', async () => {
            mockDevices[0].startCapture.mockRejectedValue(new Error('设备故障'));
            
            const result = await multiDriver.startCapture(captureSession);
            expect(result).toBe(CaptureError.UnexpectedError);
        });
    });
    
    describe('资源管理', () => {
        it('应该正确清理所有设备资源', () => {
            multiDriver.dispose();
            
            for (const device of mockDevices) {
                expect(device.dispose).toHaveBeenCalled();
            }
        });
        
        it('多次dispose应该安全', () => {
            multiDriver.dispose();
            expect(() => multiDriver.dispose()).not.toThrow();
        });
    });
    
    describe('边界条件', () => {
        it('应该处理最小设备数量（2个）', () => {
            const driver = new MultiAnalyzerDriver(['/dev/ttyUSB0', '/dev/ttyUSB1']);
            expect(driver.channelCount).toBe(48); // 2 × 24
            driver.dispose();
        });
        
        it('应该处理最大设备数量（5个）', () => {
            const connectionStrings = Array(5).fill('/dev/ttyUSB').map((p, i) => `${p}${i}`);
            const driver = new MultiAnalyzerDriver(connectionStrings);
            expect(driver.channelCount).toBe(120); // 5 × 24
            driver.dispose();
        });
        
        it('应该处理所有设备最小通道数不同的情况', () => {
            mockDevices[0].channelCount = 24;
            mockDevices[1].channelCount = 16;
            mockDevices[2].channelCount = 20;
            
            // 应该基于最小通道数计算
            expect(multiDriver.channelCount).toBe(48); // 3 × 16
        });
    });
    
    describe('版本解析边界条件', () => {
        it('应该处理null版本字符串', () => {
            const result = (multiDriver as any).parseVersion(null);
            
            expect(result.major).toBe(0);
            expect(result.minor).toBe(0);
            expect(result.isValid).toBe(false);
        });
        
        it('应该处理undefined版本字符串', () => {
            const result = (multiDriver as any).parseVersion(undefined);
            
            expect(result.major).toBe(0);
            expect(result.minor).toBe(0);
            expect(result.isValid).toBe(false);
        });
        
        it('应该处理空字符串版本', () => {
            const result = (multiDriver as any).parseVersion('');
            
            expect(result.major).toBe(0);
            expect(result.minor).toBe(0);
            expect(result.isValid).toBe(false);
        });
        
        it('应该正确解析有效版本字符串', () => {
            const result = (multiDriver as any).parseVersion('ANALYZER_V2_15');
            
            expect(result.major).toBe(2);
            expect(result.minor).toBe(15);
            expect(result.isValid).toBe(true);
        });
    });
    
    
    describe('边界测试增强', () => {
        it('应该正确获取deviceVersion属性', () => {
            // 设置版本
            (multiDriver as any)._version = 'MULTI_ANALYZER_V1_23';
            
            expect(multiDriver.deviceVersion).toBe('MULTI_ANALYZER_V1_23');
        });
        
        it('应该在版本为null时返回null', () => {
            (multiDriver as any)._version = null;
            
            expect(multiDriver.deviceVersion).toBeNull();
        });
        
        it('应该处理停止采集中的异常', async () => {
            (multiDriver as any)._capturing = true;
            
            // Mock设备停止采集失败
            mockDevices[0].stopCapture.mockRejectedValue(new Error('停止失败'));
            
            const result = await multiDriver.stopCapture();
            
            // 当有错误时应该返回false，并且capturing状态保持true（因为停止失败）
            expect(result).toBe(false);
            expect(multiDriver.isCapturing).toBe(true); // 停止失败后状态保持不变
        });
        
        it('应该处理进入引导模式时的异常', async () => {
            mockDevices[0].enterBootloader.mockRejectedValue(new Error('引导模式失败'));
            
            const result = await multiDriver.enterBootloader();
            
            expect(result).toBe(false);
        });
        
        it('应该处理采集完成时没有sourceSession的情况', () => {
            (multiDriver as any)._capturing = true;
            (multiDriver as any)._sourceSession = null;
            
            // 这应该直接返回，不做任何处理
            (multiDriver as any).handleDeviceCaptureCompleted({
                success: true,
                session: captureSession
            });
            
            // 验证状态没有改变
            expect(multiDriver.isCapturing).toBe(true);
        });
        
        it('应该处理采集完成时未在采集状态的情况', () => {
            (multiDriver as any)._capturing = false;
            (multiDriver as any)._sourceSession = captureSession;
            
            // 这应该直接返回，不做任何处理
            (multiDriver as any).handleDeviceCaptureCompleted({
                success: true,
                session: captureSession
            });
            
            // 验证状态没有改变
            expect(multiDriver.isCapturing).toBe(false);
        });
        
        it('应该正确处理combineDeviceResults中的数据合并', () => {
            // 设置模拟状态
            (multiDriver as any)._sourceSession = {
                ...captureSession,
                captureChannels: [
                    { channelNumber: 0, channelName: 'Channel 1', samples: null },
                    { channelNumber: 24, channelName: 'Channel 25', samples: null },
                    { channelNumber: 48, channelName: 'Channel 49', samples: null }
                ]
            };
            
            (multiDriver as any)._deviceCaptures = [
                {
                    completed: true,
                    session: {
                        captureChannels: [
                            { channelNumber: 0, samples: [1, 0, 1, 0] }
                        ]
                    }
                },
                {
                    completed: true,
                    session: {
                        captureChannels: [
                            { channelNumber: 0, samples: [0, 1, 0, 1] }
                        ]
                    }
                },
                {
                    completed: true,
                    session: {
                        captureChannels: [
                            { channelNumber: 0, samples: [1, 1, 0, 0] }
                        ]
                    }
                }
            ];
            
            (multiDriver as any)._capturing = true;
            
            // 模拟事件处理器
            const mockHandler = jest.fn();
            (multiDriver as any)._currentCaptureHandler = mockHandler;
            
            // 调用数据合并
            (multiDriver as any).combineDeviceResults();
            
            // 验证处理器被调用
            expect(mockHandler).toHaveBeenCalledWith({
                success: true,
                session: (multiDriver as any)._sourceSession
            });
            
            expect(multiDriver.isCapturing).toBe(false);
        });
    });
});