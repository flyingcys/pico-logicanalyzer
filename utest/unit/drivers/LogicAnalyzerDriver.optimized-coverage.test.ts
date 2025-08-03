/**
 * LogicAnalyzerDriver 优化覆盖率测试
 * 2025-08-03 修复版本，专门提升覆盖率到70%+
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

describe('LogicAnalyzerDriver - 优化覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockLineParser: jest.Mocked<ReadlineParser>;
    let mockStream: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // 创建完整的mock流对象
        mockStream = {
            write: jest.fn().mockImplementation((data, callback) => {
                if (callback) callback(null);
                return true;
            }),
            on: jest.fn(),
            off: jest.fn(),
            pipe: jest.fn().mockReturnThis(),
            removeAllListeners: jest.fn()
        };

        // 创建完整的mock对象
        mockSerialPort = {
            isOpen: false,
            open: jest.fn(),
            close: jest.fn(),
            write: jest.fn().mockImplementation((data, callback) => {
                if (callback) callback(null);
                return true;
            }),
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockSocket = {
            connect: jest.fn().mockReturnThis(),
            write: jest.fn().mockImplementation((data, callback) => {
                if (callback) callback(null);
                return true;
            }),
            on: jest.fn(),
            off: jest.fn(),
            destroy: jest.fn(),
            end: jest.fn(),
            removeAllListeners: jest.fn(),
            pipe: jest.fn().mockReturnThis()
        } as any;

        mockLineParser = {
            on: jest.fn(),
            off: jest.fn(),
            once: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        // Mock构造函数
        (SerialPort as jest.MockedClass<typeof SerialPort>).mockImplementation(() => mockSerialPort);
        (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket);
        (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockLineParser);

        driver = new LogicAnalyzerDriver('COM3');
    });

    describe('基础功能覆盖测试', () => {
        test('所有属性getter覆盖', () => {
            // 覆盖34-37,43-52行
            expect(driver.deviceVersion).toBeNull();
            expect(driver.channelCount).toBe(0);
            expect(driver.maxFrequency).toBe(0);
            expect(driver.blastFrequency).toBe(0);
            expect(driver.bufferSize).toBe(0);
            expect(driver.isNetwork).toBe(false);
            expect(driver.isCapturing).toBe(false);
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
            
            // 网络设备
            (driver as any)._isNetwork = true;
            expect(driver.driverType).toBe(AnalyzerDriverType.Network);
        });

        test('构造函数异常处理', () => {
            // 覆盖80行
            expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
        });

        test('minFrequency计算', () => {
            (driver as any)._maxFrequency = 100000000;
            const expectedMin = Math.floor((100000000 * 2) / 65535);
            expect(driver.minFrequency).toBe(expectedMin);
        });
    });

    describe('连接功能覆盖', () => {
        test('连接错误处理', async () => {
            // 覆盖109行
            jest.spyOn(driver as any, 'initSerialPort').mockRejectedValue(new Error('连接失败'));
            
            const result = await driver.connect();
            expect(result.success).toBe(false);
            expect(result.error).toBe('连接失败');
        });

        test('disconnect完整覆盖', async () => {
            // 覆盖120-140行
            (driver as any)._isConnected = true;
            (driver as any)._serialPort = mockSerialPort;
            (driver as any)._tcpSocket = mockSocket;
            mockSerialPort.isOpen = true;

            await driver.disconnect();
            
            expect((driver as any)._isConnected).toBe(false);
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockSocket.destroy).toHaveBeenCalled();
            expect((driver as any)._serialPort).toBeUndefined();
            expect((driver as any)._tcpSocket).toBeUndefined();
        });
    });

    describe('采集功能完整覆盖', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            captureSession = {
                captureChannels: [
                    { channelNumber: 0, channelName: 'Channel 0' } as AnalyzerChannel
                ],
                frequency: 10000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                loopCount: 5,
                measureBursts: true,
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false
            } as CaptureSession;

            // 设置连接状态
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            (driver as any)._lineParser = mockLineParser;
        });

        test('startCapture完整流程覆盖', async () => {
            // 覆盖162-196行
            jest.spyOn(driver as any, 'getCaptureMode').mockReturnValue(1);
            jest.spyOn(driver as any, 'validateSettings').mockReturnValue(true);
            jest.spyOn(driver as any, 'composeRequest').mockReturnValue({});
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'startDataReading').mockImplementation(() => {
                // 模拟异步数据读取
                setTimeout(() => {
                    (driver as any)._capturing = false;
                    const eventArgs = { success: true, session: captureSession };
                    driver.emit('captureCompleted', eventArgs);
                }, 10);
            });

            const mockHandler = jest.fn();
            const result = await driver.startCapture(captureSession, mockHandler);
            
            expect(result).toBe(CaptureError.None);
            expect((driver as any)._capturing).toBe(true);
        });

        test('startCapture已在采集', async () => {
            // 覆盖155行
            (driver as any)._capturing = true;
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.Busy);
        });

        test('startCapture设备未连接', async () => {
            // 覆盖159行
            (driver as any)._isConnected = false;
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.HardwareError);
        });

        test('stopCapture异常处理', async () => {
            // 覆盖220-222行
            (driver as any)._capturing = true;
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('写入失败'));

            const result = await driver.stopCapture();
            expect(result).toBe(false);
            expect((driver as any)._capturing).toBe(false);
        });

        test('stopCapture正常流程', async () => {
            // 覆盖206行
            (driver as any)._capturing = true;
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'reconnectDevice').mockResolvedValue(undefined);

            const result = await driver.stopCapture();
            expect(result).toBe(true);
        });
    });

    describe('电压和引导程序覆盖', () => {
        test('enterBootloader设备未连接', async () => {
            // 覆盖236行
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        test('enterBootloader异常处理', async () => {
            // 覆盖249行
            (driver as any)._isConnected = true;
            (driver as any)._currentStream = mockStream;
            
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('写入失败'));
            
            const result = await driver.enterBootloader();
            expect(result).toBe(false);
        });

        test('getVoltageStatus设备未连接', async () => {
            // 覆盖258行
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('DISCONNECTED');
        });

        test('getVoltageStatus串口设备', async () => {
            // 覆盖265行
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = false;
            (driver as any)._currentStream = mockStream;
            
            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('3.3V');
        });

        test('getVoltageStatus网络设备', async () => {
            // 覆盖275-282行
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = true;
            (driver as any)._currentStream = mockStream;
            (driver as any)._lineParser = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);

            // 模拟响应
            mockLineParser.once.mockImplementation((event, callback) => {
                if (event === 'data') {
                    setTimeout(() => callback('4.2V'), 10);
                }
            });

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('4.2V');
        });

        test('getVoltageStatus异常处理', async () => {
            (driver as any)._isConnected = true;
            (driver as any)._isNetwork = true;
            (driver as any)._currentStream = mockStream;

            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('写入失败'));

            const voltage = await driver.getVoltageStatus();
            expect(voltage).toBe('ERROR');
        });
    });

    describe('网络配置覆盖', () => {
        test('sendNetworkConfig网络设备拒绝', async () => {
            // 覆盖300-349行
            (driver as any)._isNetwork = true;
            
            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });

        test('sendNetworkConfig串口设备成功', async () => {
            (driver as any)._isNetwork = false;
            (driver as any)._currentStream = mockStream;
            
            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);
            jest.spyOn(driver as any, 'waitForResponse').mockResolvedValue('SETTINGS_SAVED');

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(true);
        });

        test('sendNetworkConfig异常处理', async () => {
            (driver as any)._isNetwork = false;
            jest.spyOn(driver as any, 'writeData').mockRejectedValue(new Error('失败'));

            const result = await driver.sendNetworkConfig('TestAP', 'password123', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });
    });

    describe('设备初始化覆盖', () => {
        test('initializeDevice通信流未初始化', async () => {
            // 覆盖439行
            (driver as any)._currentStream = undefined;
            
            try {
                await (driver as any).initializeDevice();
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('通信流未初始化');
            }
        });

        test('readDeviceInfo超时', async () => {
            // 覆盖449行
            (driver as any)._currentStream = mockStream;
            (driver as any)._lineParser = mockLineParser;

            jest.spyOn(driver as any, 'writeData').mockResolvedValue(undefined);

            // 模拟超时
            const readPromise = (driver as any).readDeviceInfo();
            
            try {
                // 手动触发超时
                setTimeout(() => {
                    const handler = mockLineParser.on.mock.calls.find(call => call[0] === 'data')?.[1];
                    // 不调用handler，让它超时
                }, 1);
                
                await readPromise;
                fail('应该超时');
            } catch (error) {
                expect(error.message).toContain('设备信息读取超时');
            }
        }, 15000);

        test('parseDeviceInfo边界条件', () => {
            // 覆盖453-459,473行
            expect(() => {
                (driver as any).parseDeviceInfo(['Version 1.0.0']); // 响应不完整
            }).toThrow('设备信息响应不完整');

            expect(() => {
                (driver as any).parseDeviceInfo([
                    'Version 1.0.0',
                    'INVALID_FREQ:1000000',
                    'BLASTFREQ:50000000',
                    'BUFFER:512000',
                    'CHANNELS:24'
                ]);
            }).toThrow('无效的设备频率响应');
        });

        test('parseDeviceInfo数值验证', () => {
            // 覆盖496,506行
            expect(() => {
                (driver as any).parseDeviceInfo([
                    'Version 1.0.0',
                    'FREQ:0',
                    'BLASTFREQ:50000000',
                    'BUFFER:512000',
                    'CHANNELS:24'
                ]);
            }).toThrow('设备频率值无效');

            expect(() => {
                (driver as any).parseDeviceInfo([
                    'Version 1.0.0',
                    'FREQ:1000000',
                    'BLASTFREQ:50000000',
                    'BUFFER:512000',
                    'CHANNELS:25'
                ]);
            }).toThrow('设备通道数值无效');
        });
    });

    describe('数据处理覆盖', () => {
        test('writeData通信流未初始化', async () => {
            // 覆盖541行
            (driver as any)._currentStream = undefined;
            
            try {
                await (driver as any).writeData(new Uint8Array([1, 2, 3]));
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('通信流未初始化');
            }
        });

        test('writeData成功', async () => {
            (driver as any)._currentStream = mockStream;
            
            const result = await (driver as any).writeData(new Uint8Array([1, 2, 3]));
            expect(result).toBeUndefined();
            expect(mockStream.write).toHaveBeenCalled();
        });

        test('startDataReading通信流未初始化', async () => {
            // 覆盖556行
            (driver as any)._currentStream = undefined;
            
            const session = { captureChannels: [] } as CaptureSession;
            
            try {
                await (driver as any).startDataReading(session);
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('通信流未初始化');
            }
        });

        test('waitForResponse超时', async () => {
            // 覆盖561-587行
            (driver as any)._lineParser = mockLineParser;

            const responsePromise = (driver as any).waitForResponse('EXPECTED', 100);
            
            try {
                await responsePromise;
                fail('应该超时');
            } catch (error) {
                expect(error.message).toContain('等待响应超时');
            }
        });
    });

    describe('验证设置覆盖', () => {
        test('validateSettings各种触发类型', () => {
            // 覆盖大量验证逻辑
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 512000;

            const baseSession = {
                captureChannels: [{ channelNumber: 0 }],
                triggerChannel: 0,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                frequency: 10000000,
                loopCount: 5
            };

            // Edge触发
            const edgeSession = { ...baseSession, triggerType: TriggerType.Edge };
            expect((driver as any).validateSettings(edgeSession, 10000)).toBe(true);

            // Blast触发
            const blastSession = { ...baseSession, triggerType: TriggerType.Blast };
            expect((driver as any).validateSettings(blastSession, 10000)).toBe(true);

            // Complex触发
            const complexSession = { 
                ...baseSession, 
                triggerType: TriggerType.Complex,
                triggerBitCount: 8 
            };
            expect((driver as any).validateSettings(complexSession, 10000)).toBe(true);

            // Fast触发
            const fastSession = { 
                ...baseSession, 
                triggerType: TriggerType.Fast,
                triggerBitCount: 3 
            };
            expect((driver as any).validateSettings(fastSession, 10000)).toBe(true);
        });

        test('composeRequest不同触发类型', () => {
            // 覆盖1042-1061行
            (driver as any)._maxFrequency = 100000000;

            const baseSession = {
                triggerType: TriggerType.Edge,
                triggerChannel: 0,
                triggerInverted: false,
                captureChannels: [{ channelNumber: 0 }],
                frequency: 10000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 9000,
                loopCount: 5,
                measureBursts: true
            } as any;

            const request = (driver as any).composeRequest(baseSession, 10000, 1);
            expect(request).toBeDefined();

            // Complex触发
            const complexSession = {
                ...baseSession,
                triggerType: TriggerType.Complex,
                triggerBitCount: 8,
                triggerPattern: 0xFF
            };

            const complexRequest = (driver as any).composeRequest(complexSession, 10000, 1);
            expect(complexRequest).toBeDefined();
        });

        test('getLimits不同模式', () => {
            (driver as any)._bufferSize = 512000;

            // 8通道模式
            const limits8 = (driver as any).getLimits([0, 1, 2, 3]);
            expect(limits8.maxTotalSamples).toBe(512000);

            // 16通道模式
            const limits16 = (driver as any).getLimits(Array.from({length: 16}, (_, i) => i));
            expect(limits16.maxTotalSamples).toBe(256000);

            // 24通道模式
            const limits24 = (driver as any).getLimits(Array.from({length: 24}, (_, i) => i));
            expect(limits24.maxTotalSamples).toBe(128000);
        });
    });

    describe('资源管理覆盖', () => {
        test('dispose方法', () => {
            // 覆盖1166-1167行
            jest.spyOn(driver, 'disconnect').mockResolvedValue();
            
            driver.dispose();
            expect(driver.disconnect).toHaveBeenCalled();
        });

        test('buildCapabilities', () => {
            (driver as any)._channelCount = 24;
            (driver as any)._maxFrequency = 100000000;
            (driver as any)._bufferSize = 512000;
            (driver as any)._blastFrequency = 50000000;
            (driver as any)._isNetwork = false;

            const capabilities = (driver as any).buildCapabilities();
            expect(capabilities.channels.digital).toBe(24);
            expect(capabilities.sampling.maxRate).toBe(100000000);
            expect(capabilities.connectivity.interfaces).toEqual(['serial']);

            // 网络设备
            (driver as any)._isNetwork = true;
            const networkCapabilities = (driver as any).buildCapabilities();
            expect(networkCapabilities.connectivity.interfaces).toEqual(['ethernet']);
        });
    });

    describe('重连设备覆盖', () => {
        test('reconnectDevice网络设备', async () => {
            // 覆盖977-980,984行
            (driver as any)._isNetwork = true;
            (driver as any)._tcpSocket = mockSocket;
            (driver as any)._devAddr = '192.168.1.100';
            (driver as any)._devPort = 8080;

            mockSocket.connect.mockImplementation((port, host, callback) => {
                setTimeout(() => callback!(), 10);
                return mockSocket;
            });

            await (driver as any).reconnectDevice();
            expect(mockSocket.destroy).toHaveBeenCalled();
            expect(mockSocket.connect).toHaveBeenCalled();
        });

        test('reconnectDevice串口设备', async () => {
            // 覆盖998-1011行
            (driver as any)._isNetwork = false;
            (driver as any)._serialPort = mockSerialPort;
            mockSerialPort.isOpen = true;

            mockSerialPort.open.mockImplementation((callback) => {
                setTimeout(() => callback(null), 10);
            });

            await (driver as any).reconnectDevice();
            expect(mockSerialPort.close).toHaveBeenCalled();
            expect(mockSerialPort.open).toHaveBeenCalled();
        });
    });
});