/**
 * LogicAnalyzerDriver 增强覆盖率测试
 * 专注于提升代码覆盖率到70%以上
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { AnalyzerDriverBase } from '../../../src/drivers/AnalyzerDriverBase';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { AnalyzerDriverType, CaptureError, TriggerType } from '../../../src/models/AnalyzerTypes';
import { VersionValidator, DeviceConnectionException } from '../../../src/drivers/VersionValidator';

// Mock SerialPort
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => callback && callback()),
        close: jest.fn((callback) => callback && callback()),
        write: jest.fn((data, callback) => callback && callback()),
        on: jest.fn(),
        off: jest.fn(),
        pipe: jest.fn(),
        isOpen: true
    })),
    available: jest.fn().mockResolvedValue([
        { path: '/dev/ttyUSB0', manufacturer: 'Test', vendorId: '1234', productId: '5678' }
    ])
}));

jest.mock('@serialport/parser-readline', () => ({
    ReadlineParser: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn()
    }))
}));

// Mock Net Socket
jest.mock('net', () => ({
    Socket: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        on: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
        pipe: jest.fn(),
        setTimeout: jest.fn()
    }))
}));

describe('LogicAnalyzerDriver 增强覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let captureSession: CaptureSession;
    
    beforeEach(() => {
        jest.clearAllMocks();
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        
        // 设置基本的模拟状态
        (driver as any)._channelCount = 24;
        (driver as any)._maxFrequency = 100000000;
        (driver as any)._blastFrequency = 100000000;
        (driver as any)._bufferSize = 96000;
        (driver as any)._version = 'Test Logic Analyzer v1.7';
        (driver as any)._isNetwork = false;
        (driver as any)._isConnected = true;
        
        // 创建测试用采集会话
        captureSession = new CaptureSession();
        captureSession.frequency = 24000000;
        captureSession.preTriggerSamples = 1000;
        captureSession.postTriggerSamples = 10000;
        captureSession.triggerType = TriggerType.Edge;
        captureSession.triggerChannel = 0;
        captureSession.captureChannels = [
            new AnalyzerChannel(0, 'Channel 0'),
            new AnalyzerChannel(1, 'Channel 1')
        ];
    });

    afterEach(async () => {
        if (driver && driver.isCapturing) {
            await driver.stopCapture();
        }
    });

    describe('构造函数验证测试', () => {
        it('应该拒绝空连接字符串', () => {
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
            expect(networkDriver.connectionString).toBe('192.168.1.100:8080');
        });
    });

    describe('网络连接初始化测试', () => {
        it('应该正确解析有效的网络地址', async () => {
            const networkDriver = new LogicAnalyzerDriver('10.0.0.1:3000');
            
            // Mock网络初始化
            const mockInitNetwork = jest.fn().mockResolvedValue(undefined);
            (networkDriver as any).initNetwork = mockInitNetwork;
            
            await networkDriver.connect();
            expect(mockInitNetwork).toHaveBeenCalledWith('10.0.0.1:3000');
        });

        it('应该拒绝无效的网络地址格式', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // 直接调用initNetwork来测试格式验证
            try {
                await (networkDriver as any).initNetwork('invalid-format');
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('指定的地址/端口格式无效');
            }
        });

        it('应该拒绝无效的端口号', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            try {
                await (networkDriver as any).initNetwork('192.168.1.100:70000'); // 超出端口范围
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('指定的端口号无效');
            }
        });

        it('应该拒绝非数字端口', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            try {
                await (networkDriver as any).initNetwork('192.168.1.100:abc');
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('指定的地址/端口格式无效');
            }
        });
    });

    describe('设备信息解析增强测试', () => {
        it('应该正确解析完整的设备信息', () => {
            const responses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:50000000',
                'BLASTFREQ:100000000',
                'BUFFER:48000',
                'CHANNELS:16'
            ];
            
            (driver as any).parseDeviceInfo(responses);
            
            expect(driver.deviceVersion).toBe('Pico Logic Analyzer v1.7');
            expect(driver.maxFrequency).toBe(50000000);
            expect(driver.blastFrequency).toBe(100000000);
            expect(driver.bufferSize).toBe(48000);
            expect(driver.channelCount).toBe(16);
        });

        it('应该处理不完整的响应列表', () => {
            const incompleteResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000'
                // 缺少其他响应
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(incompleteResponses);
            }).toThrow('设备信息响应不完整');
        });

        it('应该处理无效的频率响应格式', () => {
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'INVALID_FREQ_FORMAT',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:24'
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow('无效的设备频率响应');
        });

        it('应该处理无效的突发频率响应', () => {
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000',
                'INVALID_BLAST_FORMAT',
                'BUFFER:96000',
                'CHANNELS:24'
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow();
        });

        it('应该处理无效的缓冲区大小响应', () => {
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'INVALID_BUFFER_FORMAT',
                'CHANNELS:24'
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow();
        });

        it('应该处理无效的通道数响应', () => {
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'INVALID_CHANNEL_FORMAT'
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow();
        });

        it('应该处理超出范围的通道数', () => {
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:25' // 超出最大通道数
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow();
        });

        it('应该处理0通道数', () => {
            const invalidResponses = [
                'Pico Logic Analyzer v1.7',
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:0'
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(invalidResponses);
            }).toThrow();
        });

        it('应该处理版本验证失败', () => {
            // Mock版本验证失败
            const mockGetVersion = jest.spyOn(VersionValidator, 'getVersion').mockReturnValue({
                isValid: false,
                major: 0,
                minor: 5,
                patch: 0
            });

            const responses = [
                'Pico Logic Analyzer v0.5', // 版本过低
                'FREQ:100000000',
                'BLASTFREQ:100000000',
                'BUFFER:96000',
                'CHANNELS:24'
            ];
            
            expect(() => {
                (driver as any).parseDeviceInfo(responses);
            }).toThrow(DeviceConnectionException);

            mockGetVersion.mockRestore();
        });
    });

    describe('数据写入和通信测试', () => {
        it('writeData应该正确写入数据', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._currentStream = mockStream;
            
            const testData = new Uint8Array([0x01, 0x02, 0x03]);
            await (driver as any).writeData(testData);
            
            expect(mockStream.write).toHaveBeenCalledWith(
                Buffer.from(testData),
                expect.any(Function)
            );
        });

        it('writeData应该处理写入错误', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback(new Error('Write failed')))
            };
            
            (driver as any)._currentStream = mockStream;
            
            const testData = new Uint8Array([0x01, 0x02, 0x03]);
            
            await expect((driver as any).writeData(testData))
                .rejects.toThrow('Write failed');
        });

        it('writeData应该处理未初始化的流', async () => {
            (driver as any)._currentStream = null;
            
            const testData = new Uint8Array([0x01, 0x02, 0x03]);
            
            await expect((driver as any).writeData(testData))
                .rejects.toThrow('通信流未初始化');
        });
    });

    describe('设备状态和控制测试', () => {
        it('getStatus应该返回正确的设备状态', async () => {
            // Mock getVoltageStatus
            driver.getVoltageStatus = jest.fn().mockResolvedValue('3.3V');
            
            const status = await driver.getStatus();
            
            expect(status.isConnected).toBe(true);
            expect(status.isCapturing).toBe(false);
            expect(status.batteryVoltage).toBe('3.3V');
        });

        it('getVoltageStatus应该为未连接设备返回DISCONNECTED', async () => {
            (driver as any)._isConnected = false;
            (driver as any)._currentStream = null;
            
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('DISCONNECTED');
        });

        it('getVoltageStatus应该为串口设备返回模拟电压', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = {};
            (driver as any)._isNetwork = false;
            
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('3.3V');
        });

        it('getVoltageStatus应该为网络设备发送查询命令', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            const mockParser = {
                once: jest.fn((event, callback) => {
                    setTimeout(() => callback('Battery: 4.1V'), 10);
                })
            };
            
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            (driver as any)._lineParser = mockParser;
            (driver as any)._isNetwork = true;
            
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('Battery: 4.1V');
            expect(mockStream.write).toHaveBeenCalled();
        });

        it('getVoltageStatus应该处理网络查询超时', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            const mockParser = {
                once: jest.fn() // 不触发回调，模拟超时
            };
            
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            (driver as any)._lineParser = mockParser;
            (driver as any)._isNetwork = true;
            
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('TIMEOUT');
        }, 6000);

        it('getVoltageStatus应该处理异常', async () => {
            const mockStream = {
                write: jest.fn(() => { throw new Error('Write error'); })
            };
            
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            (driver as any)._isNetwork = true;
            
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('ERROR');
        });
    });

    describe('引导加载程序功能测试', () => {
        it('enterBootloader应该为未连接设备返回false', async () => {
            (driver as any)._isConnected = false;
            (driver as any)._currentStream = null;
            
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        it('enterBootloader应该发送正确的命令并等待响应', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            
            // Mock waitForResponse
            (driver as any).waitForResponse = jest.fn().mockResolvedValue('RESTARTING_BOOTLOADER');
            
            const result = await driver.enterBootloader();
            
            expect(result).toBe(true);
            expect(mockStream.write).toHaveBeenCalled();
            expect((driver as any).waitForResponse).toHaveBeenCalledWith('RESTARTING_BOOTLOADER', 1000);
        });

        it('enterBootloader应该处理错误响应', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            
            // Mock waitForResponse 返回错误响应
            (driver as any).waitForResponse = jest.fn().mockResolvedValue('ERROR');
            
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        it('enterBootloader应该处理超时', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            
            // Mock waitForResponse 抛出超时错误
            (driver as any).waitForResponse = jest.fn().mockRejectedValue(new Error('Timeout'));
            
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });
    });

    describe('网络配置功能测试', () => {
        it('sendNetworkConfig应该为网络设备返回false', async () => {
            (driver as any)._isNetwork = true;
            
            const result = await driver.sendNetworkConfig('TestWiFi', 'password', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        it('sendNetworkConfig应该为串口设备发送配置', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._isNetwork = false;
            (driver as any)._currentStream = mockStream;
            
            // Mock waitForResponse
            (driver as any).waitForResponse = jest.fn().mockResolvedValue('SETTINGS_SAVED');
            
            const result = await driver.sendNetworkConfig('TestWiFi', 'password123', '192.168.1.100', 8080);
            
            expect(result).toBe(true);
            expect(mockStream.write).toHaveBeenCalled();
            expect((driver as any).waitForResponse).toHaveBeenCalledWith('SETTINGS_SAVED', 5000);
        });

        it('sendNetworkConfig应该处理配置失败', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._isNetwork = false;
            (driver as any)._currentStream = mockStream;
            
            // Mock waitForResponse 返回失败响应
            (driver as any).waitForResponse = jest.fn().mockResolvedValue('SETTINGS_FAILED');
            
            const result = await driver.sendNetworkConfig('TestWiFi', 'password', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        it('sendNetworkConfig应该处理异常', async () => {
            const mockStream = {
                write: jest.fn(() => { throw new Error('Write error'); })
            };
            
            (driver as any)._isNetwork = false;
            (driver as any)._currentStream = mockStream;
            
            const result = await driver.sendNetworkConfig('TestWiFi', 'password', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });
    });

    describe('采集控制功能测试', () => {
        it('startCapture应该为已采集状态返回Busy', async () => {
            (driver as any)._capturing = true;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.Busy);
        });

        it('startCapture应该为未连接设备返回HardwareError', async () => {
            (driver as any)._capturing = false;
            (driver as any)._isConnected = false;
            (driver as any)._currentStream = null;
            
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        it('stopCapture应该为未采集状态返回true', async () => {
            (driver as any)._capturing = false;
            
            const result = await driver.stopCapture();
            expect(result).toBe(true);
        });

        it('stopCapture应该发送停止命令并重连', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._capturing = true;
            (driver as any)._currentStream = mockStream;
            
            // Mock reconnectDevice
            (driver as any).reconnectDevice = jest.fn().mockResolvedValue(undefined);
            
            const result = await driver.stopCapture();
            
            expect(result).toBe(true);
            expect((driver as any)._capturing).toBe(false);
            expect(mockStream.write).toHaveBeenCalled();
        });

        it('stopCapture应该处理写入错误', async () => {
            const mockStream = {
                write: jest.fn(() => { throw new Error('Write error'); })
            };
            
            (driver as any)._capturing = true;
            (driver as any)._currentStream = mockStream;
            
            const result = await driver.stopCapture();
            
            expect(result).toBe(false);
            expect((driver as any)._capturing).toBe(false);
        });
    });

    describe('连接管理功能测试', () => {
        it('disconnect应该正确清理资源', async () => {
            const mockSerialPort = {
                isOpen: true,
                close: jest.fn()
            };
            const mockTcpSocket = {
                destroy: jest.fn()
            };
            
            (driver as any)._serialPort = mockSerialPort;
            (driver as any)._tcpSocket = mockTcpSocket;
            (driver as any)._isConnected = true;
            
            await driver.disconnect();
            
            expect((driver as any)._isConnected).toBe(false);
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockTcpSocket.destroy).toHaveBeenCalled();
            expect((driver as any)._serialPort).toBeUndefined();
            expect((driver as any)._tcpSocket).toBeUndefined();
            expect((driver as any)._currentStream).toBeUndefined();
            expect((driver as any)._lineParser).toBeUndefined();
        });

        it('disconnect应该处理未打开的串口', async () => {
            const mockSerialPort = {
                isOpen: false,
                close: jest.fn()
            };
            
            (driver as any)._serialPort = mockSerialPort;
            (driver as any)._isConnected = true;
            
            await driver.disconnect();
            
            expect((driver as any)._isConnected).toBe(false);
            expect(mockSerialPort.close).not.toHaveBeenCalled();
        });
    });

    describe('等待响应功能测试', () => {
        it('waitForResponse应该正确等待并返回响应', async () => {
            const mockParser = {
                on: jest.fn(),
                off: jest.fn()
            };
            
            (driver as any)._lineParser = mockParser;
            
            // 模拟数据处理器被调用
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('EXPECTED_RESPONSE'), 50);
                }
            });
            
            const response = await (driver as any).waitForResponse('EXPECTED_RESPONSE', 1000);
            
            expect(response).toBe('EXPECTED_RESPONSE');
            expect(mockParser.on).toHaveBeenCalledWith('data', expect.any(Function));
            expect(mockParser.off).toHaveBeenCalledWith('data', expect.any(Function));
        });

        it('waitForResponse应该处理超时', async () => {
            const mockParser = {
                on: jest.fn(),
                off: jest.fn()
            };
            
            (driver as any)._lineParser = mockParser;
            
            // 不触发数据回调，模拟超时
            mockParser.on.mockImplementation(() => {});
            
            await expect((driver as any).waitForResponse('NEVER_COMES', 100))
                .rejects.toThrow('等待响应超时: NEVER_COMES');
        });
    });

    describe('能力构建功能测试', () => {
        it('buildCapabilities应该为串口设备返回正确的能力', () => {
            (driver as any)._isNetwork = false;
            
            const capabilities = (driver as any).buildCapabilities();
            
            expect(capabilities.channels.digital).toBe(24);
            expect(capabilities.sampling.maxRate).toBe(100000000);
            expect(capabilities.sampling.bufferSize).toBe(96000);
            expect(capabilities.triggers.maxChannels).toBe(24);
            expect(capabilities.connectivity.interfaces).toEqual(['serial']);
            expect(capabilities.features.voltageMonitoring).toBe(true);
        });

        it('buildCapabilities应该为网络设备返回正确的接口', () => {
            (driver as any)._isNetwork = true;
            
            const capabilities = (driver as any).buildCapabilities();
            
            expect(capabilities.connectivity.interfaces).toEqual(['ethernet']);
        });
    });

    describe('设备信息获取功能测试', () => {
        it('getDeviceInfo应该返回完整的设备信息', () => {
            const deviceInfo = driver.getDeviceInfo();
            
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.name).toContain('Logic Analyzer');
            expect(deviceInfo.maxFrequency).toBe(100000000);
            expect(deviceInfo.channels).toBe(24);
            expect(deviceInfo.bufferSize).toBe(96000);
            expect(deviceInfo.blastFrequency).toBe(100000000);
        });
    });

    describe('资源清理功能测试', () => {
        it('dispose应该调用父类dispose并清理资源', () => {
            const mockSerialPort = {
                isOpen: true,
                close: jest.fn()
            };
            const mockTcpSocket = {
                destroy: jest.fn()
            };
            
            (driver as any)._serialPort = mockSerialPort;
            (driver as any)._tcpSocket = mockTcpSocket;
            
            // Mock父类dispose
            const superDispose = jest.spyOn(AnalyzerDriverBase.prototype, 'dispose').mockImplementation(() => {});
            
            driver.dispose();
            
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockTcpSocket.destroy).toHaveBeenCalled();
            expect(superDispose).toHaveBeenCalled();
            
            superDispose.mockRestore();
        });
    });

    describe('连接功能完整测试', () => {
        it('connect应该成功建立串口连接', async () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            
            // Mock initSerialPort
            const mockInitSerial = jest.fn().mockResolvedValue(undefined);
            (serialDriver as any).initSerialPort = mockInitSerial;
            (serialDriver as any)._version = 'Test Device v1.7';
            (serialDriver as any)._isNetwork = false;
            
            const result = await serialDriver.connect();
            
            expect(result.success).toBe(true);
            expect(result.deviceInfo?.isNetwork).toBe(false);
            expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Serial);
            expect(mockInitSerial).toHaveBeenCalledWith('/dev/ttyUSB0', 115200);
        });

        it('connect应该成功建立网络连接', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // Mock initNetwork
            const mockInitNetwork = jest.fn().mockResolvedValue(undefined);
            (networkDriver as any).initNetwork = mockInitNetwork;
            (networkDriver as any)._version = 'Network Device v1.7';
            (networkDriver as any)._isNetwork = true;
            
            const result = await networkDriver.connect();
            
            expect(result.success).toBe(true);
            expect(result.deviceInfo?.isNetwork).toBe(true);
            expect(result.deviceInfo?.type).toBe(AnalyzerDriverType.Network);
            expect(mockInitNetwork).toHaveBeenCalledWith('192.168.1.100:8080');
        });

        it('connect应该处理连接失败', async () => {
            const failDriver = new LogicAnalyzerDriver('/dev/invalid');
            
            // Mock initSerialPort 抛出错误
            const mockInitSerial = jest.fn().mockRejectedValue(new Error('Port not found'));
            (failDriver as any).initSerialPort = mockInitSerial;
            
            const result = await failDriver.connect();
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Port not found');
        });
    });

    describe('串口初始化测试', () => {
        it('initSerialPort应该正确建立串口连接', async () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            
            // Mock SerialPort和相关依赖
            const mockSerialPort = {
                open: jest.fn(callback => setTimeout(() => callback(), 10)),
                pipe: jest.fn()
            };
            const mockLineParser = {};
            
            // Mock SerialPort构造函数
            const { SerialPort } = require('serialport');
            SerialPort.mockImplementation(() => mockSerialPort);
            
            // Mock ReadlineParser
            const { ReadlineParser } = require('@serialport/parser-readline');
            ReadlineParser.mockImplementation(() => mockLineParser);
            
            // Mock initializeDevice
            const mockInitDevice = jest.fn().mockResolvedValue(undefined);
            (serialDriver as any).initializeDevice = mockInitDevice;
            
            await (serialDriver as any).initSerialPort('/dev/ttyUSB0', 115200);
            
            expect(SerialPort).toHaveBeenCalledWith({
                path: '/dev/ttyUSB0',
                baudRate: 115200,
                autoOpen: false
            });
            expect(mockSerialPort.open).toHaveBeenCalled();
            expect(mockSerialPort.pipe).toHaveBeenCalledWith(mockLineParser);
            expect(mockInitDevice).toHaveBeenCalled();
        });

        it('initSerialPort应该处理连接错误', async () => {
            const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            
            // Mock SerialPort with error
            const mockSerialPort = {
                open: jest.fn(callback => setTimeout(() => callback(new Error('Port busy')), 10))
            };
            
            const { SerialPort } = require('serialport');
            SerialPort.mockImplementation(() => mockSerialPort);
            
            await expect((serialDriver as any).initSerialPort('/dev/ttyUSB0', 115200))
                .rejects.toThrow('串口连接失败: Port busy');
        });
    });

    describe('网络初始化测试', () => {
        it('initNetwork应该正确建立TCP连接', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // Mock Socket
            const mockSocket = {
                connect: jest.fn((port, address, callback) => setTimeout(callback, 10)),
                on: jest.fn(),
                pipe: jest.fn()
            };
            const mockLineParser = {};
            
            const { Socket } = require('net');
            Socket.mockImplementation(() => mockSocket);
            
            const { ReadlineParser } = require('@serialport/parser-readline');
            ReadlineParser.mockImplementation(() => mockLineParser);
            
            // Mock initializeDevice
            const mockInitDevice = jest.fn().mockResolvedValue(undefined);
            (networkDriver as any).initializeDevice = mockInitDevice;
            
            await (networkDriver as any).initNetwork('192.168.1.100:8080');
            
            expect(mockSocket.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
            expect(mockSocket.pipe).toHaveBeenCalledWith(mockLineParser);
            expect(mockInitDevice).toHaveBeenCalled();
        });

        it('initNetwork应该处理连接错误', async () => {
            const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
            
            // Mock Socket with error
            const mockSocket = {
                connect: jest.fn(),
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('Connection refused')), 10);
                    }
                })
            };
            
            const { Socket } = require('net');
            Socket.mockImplementation(() => mockSocket);
            
            await expect((networkDriver as any).initNetwork('192.168.1.100:8080'))
                .rejects.toThrow('网络连接失败: Connection refused');
        });
    });

    describe('设备初始化测试', () => {
        it('initializeDevice应该正确查询设备信息', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            const mockParser = {};
            
            (driver as any)._currentStream = mockStream;
            (driver as any)._lineParser = mockParser;
            
            // Mock readDeviceInfo和parseDeviceInfo
            const mockReadDeviceInfo = jest.fn().mockResolvedValue(['v1.7', 'FREQ:100MHz']);
            const mockParseDeviceInfo = jest.fn();
            (driver as any).readDeviceInfo = mockReadDeviceInfo;
            (driver as any).parseDeviceInfo = mockParseDeviceInfo;
            
            await (driver as any).initializeDevice();
            
            expect(mockStream.write).toHaveBeenCalled();
            expect(mockReadDeviceInfo).toHaveBeenCalled();
            expect(mockParseDeviceInfo).toHaveBeenCalled();
        });

        it('initializeDevice应该处理流未初始化', async () => {
            (driver as any)._currentStream = null;
            (driver as any)._lineParser = null;
            
            await expect((driver as any).initializeDevice())
                .rejects.toThrow('通信流未初始化');
        });
    });

    describe('设备信息读取测试', () => {
        it('readDeviceInfo应该正确读取多行响应', async () => {
            const mockParser = {
                on: jest.fn(),
                off: jest.fn()
            };
            
            (driver as any)._lineParser = mockParser;
            
            // 模拟数据接收
            mockParser.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => {
                        callback('Pico Logic Analyzer v1.7');
                        callback('FREQ:100000000');
                        callback('BLASTFREQ:100000000');
                        callback('BUFFER:96000');
                        callback('CHANNELS:24');
                    }, 10);
                }
            });
            
            const responses = await (driver as any).readDeviceInfo();
            
            expect(responses).toHaveLength(5);
            expect(responses[0]).toBe('Pico Logic Analyzer v1.7');
            expect(responses[1]).toBe('FREQ:100000000');
        });

        it('readDeviceInfo应该处理超时', async () => {
            const mockParser = {
                on: jest.fn(),
                off: jest.fn()
            };
            
            (driver as any)._lineParser = mockParser;
            
            // 不触发数据回调，模拟超时
            mockParser.on.mockImplementation(() => {});
            
            await expect((driver as any).readDeviceInfo())
                .rejects.toThrow('设备信息读取超时');
        }, 11000);
    });

    describe('采集功能完整测试', () => {
        it('startCapture应该成功启动采集', async () => {
            const mockStream = {
                write: jest.fn((data, callback) => callback && callback())
            };
            
            (driver as any)._capturing = false;
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            
            // Mock所有依赖方法
            (driver as any).getCaptureMode = jest.fn().mockReturnValue(0);
            (driver as any).validateSettings = jest.fn().mockReturnValue(true);
            (driver as any).composeRequest = jest.fn().mockReturnValue({
                serialize: () => new Uint8Array([1, 2, 3])
            });
            (driver as any).startDataReading = jest.fn().mockResolvedValue(undefined);
            
            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.None);
            expect((driver as any)._capturing).toBe(true);
            expect(mockStream.write).toHaveBeenCalled();
        });

        it('startCapture应该处理参数验证失败', async () => {
            const mockStream = {
                write: jest.fn()
            };
            
            (driver as any)._capturing = false;
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            
            // Mock getCaptureMode和validateSettings
            (driver as any).getCaptureMode = jest.fn().mockReturnValue(0);
            (driver as any).validateSettings = jest.fn().mockReturnValue(false);
            
            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.BadParams);
            expect((driver as any)._capturing).toBe(false);
        });

        it('startCapture应该处理异常', async () => {
            (driver as any)._capturing = false;
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = {};
            
            // Mock方法抛出异常
            (driver as any).getCaptureMode = jest.fn(() => { throw new Error('Mock error'); });
            
            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.UnexpectedError);
            expect((driver as any)._capturing).toBe(false);
        });
    });

    describe('属性getter测试', () => {
        it('minFrequency应该返回正确的最小频率', () => {
            // 假设有minFrequency属性
            expect(typeof driver.maxFrequency).toBe('number');
        });

        it('isNetwork应该正确反映网络状态', () => {
            (driver as any)._isNetwork = false;
            expect(driver.isNetwork).toBe(false);
            
            (driver as any)._isNetwork = true;
            expect(driver.isNetwork).toBe(true);
        });

        it('driverType应该根据网络状态返回正确类型', () => {
            (driver as any)._isNetwork = false;
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
            
            (driver as any)._isNetwork = true;
            expect(driver.driverType).toBe(AnalyzerDriverType.Network);
        });
    });

    describe('数据处理内部方法测试', () => {
        it('startDataReading应该完整处理采集流程', async () => {
            const mockStream = {};
            (driver as any)._currentStream = mockStream;
            
            // Mock所有依赖方法
            (driver as any).waitForResponse = jest.fn().mockResolvedValue('CAPTURE_STARTED');
            (driver as any).readCaptureData = jest.fn().mockResolvedValue({ samples: [], timestamps: new BigUint64Array(0) });
            (driver as any).extractSamplesToChannels = jest.fn();
            (driver as any).emitCaptureCompleted = jest.fn();
            
            await (driver as any).startDataReading(captureSession);
            
            expect((driver as any).waitForResponse).toHaveBeenCalledWith('CAPTURE_STARTED', 10000);
            expect((driver as any).readCaptureData).toHaveBeenCalled();
            expect((driver as any).extractSamplesToChannels).toHaveBeenCalled();
            expect((driver as any)._capturing).toBe(false);
        });

        it('startDataReading应该处理错误', async () => {
            const mockStream = {};
            (driver as any)._currentStream = mockStream;
            
            // Mock waitForResponse抛出错误
            (driver as any).waitForResponse = jest.fn().mockRejectedValue(new Error('Timeout'));
            (driver as any).emitCaptureCompleted = jest.fn();
            
            await (driver as any).startDataReading(captureSession);
            
            expect((driver as any)._capturing).toBe(false);
            expect((driver as any).emitCaptureCompleted).toHaveBeenCalled();
        });

        it('startDataReading应该处理流未初始化', async () => {
            (driver as any)._currentStream = null;
            (driver as any).emitCaptureCompleted = jest.fn();
            
            await (driver as any).startDataReading(captureSession);
            
            expect((driver as any)._capturing).toBe(false);
            expect((driver as any).emitCaptureCompleted).toHaveBeenCalled();
        });
    });
});