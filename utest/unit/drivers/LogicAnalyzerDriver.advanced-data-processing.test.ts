/**
 * LogicAnalyzerDriver 高级数据处理覆盖率测试
 * 2025-08-03 专门覆盖623-924行数据读取解析链路
 * 目标：从54.32%提升到70%+覆盖率
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { TriggerType } from '../../../src/models/AnalyzerTypes';
import { BurstInfo } from '../../../src/drivers/types/AnalyzerTypes';
import { Socket } from 'net';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// Mock dependencies
jest.mock('net');
jest.mock('serialport');
jest.mock('@serialport/parser-readline');

describe('LogicAnalyzerDriver - 高级数据处理覆盖率测试', () => {
    let driver: LogicAnalyzerDriver;
    let mockSerialPort: jest.Mocked<SerialPort>;
    let mockSocket: jest.Mocked<Socket>;
    let mockLineParser: jest.Mocked<ReadlineParser>;
    let mockStream: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // 创建更完整的mock流对象
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

        mockSerialPort = {
            isOpen: false,
            open: jest.fn(),
            close: jest.fn(),
            write: jest.fn(),
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn()
        } as any;

        mockSocket = {
            connect: jest.fn().mockReturnThis(),
            write: jest.fn(),
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

        (SerialPort as jest.MockedClass<typeof SerialPort>).mockImplementation(() => mockSerialPort);
        (Socket as jest.MockedClass<typeof Socket>).mockImplementation(() => mockSocket);
        (ReadlineParser as jest.MockedClass<typeof ReadlineParser>).mockImplementation(() => mockLineParser);

        driver = new LogicAnalyzerDriver('COM3');
    });

    describe('数据读取完整流程测试 - 覆盖623-639行', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            captureSession = {
                captureChannels: [
                    { channelNumber: 0, channelName: 'Channel 0' } as AnalyzerChannel,
                    { channelNumber: 1, channelName: 'Channel 1' } as AnalyzerChannel
                ],
                frequency: 10000000,
                preTriggerSamples: 1000,
                postTriggerSamples: 4000,
                loopCount: 3,
                measureBursts: true,
                triggerType: TriggerType.Edge,
                triggerChannel: 0
            } as CaptureSession;

            (driver as any)._currentStream = mockStream;
        });

        test('readCaptureData - 通信流未初始化', async () => {
            // 覆盖624-626行
            (driver as any)._currentStream = undefined;
            
            try {
                await (driver as any).readCaptureData(captureSession);
                fail('应该抛出错误');
            } catch (error) {
                expect(error.message).toContain('通信流未初始化');
            }
        });

        test('readCaptureData - 网络模式分支', async () => {
            // 覆盖629-637行
            (driver as any)._isNetwork = true;
            
            const mockReadNetworkCaptureData = jest.spyOn(driver as any, 'readNetworkCaptureData')
                .mockImplementation((session, mode, totalSamples, resolve) => {
                    resolve({ samples: new Uint32Array([1, 2, 3]), timestamps: new BigUint64Array(), bursts: [] });
                });

            const result = await (driver as any).readCaptureData(captureSession);
            
            expect(mockReadNetworkCaptureData).toHaveBeenCalled();
            expect(result.samples).toBeDefined();
        });

        test('readCaptureData - 串口模式分支', async () => {
            // 覆盖629-637行
            (driver as any)._isNetwork = false;
            
            const mockReadSerialCaptureData = jest.spyOn(driver as any, 'readSerialCaptureData')
                .mockImplementation((session, mode, totalSamples, resolve) => {
                    resolve({ samples: new Uint32Array([1, 2, 3]), timestamps: new BigUint64Array(), bursts: [] });
                });

            const result = await (driver as any).readCaptureData(captureSession);
            
            expect(mockReadSerialCaptureData).toHaveBeenCalled();
            expect(result.samples).toBeDefined();
        });

        test('readCaptureData - 采集模式和总样本数计算', async () => {
            // 覆盖629-630行的计算逻辑
            const getCaptureModeSpy = jest.spyOn(driver as any, 'getCaptureMode').mockReturnValue(1);
            jest.spyOn(driver as any, 'readSerialCaptureData').mockImplementation((session, mode, totalSamples, resolve) => {
                expect(mode).toBe(1);
                expect(totalSamples).toBe(1000 + 4000 * (3 + 1)); // preTriggerSamples + postTriggerSamples * (loopCount + 1)
                resolve({ samples: new Uint32Array(), timestamps: new BigUint64Array(), bursts: [] });
            });

            await (driver as any).readCaptureData(captureSession);
            expect(getCaptureModeSpy).toHaveBeenCalledWith([0, 1]); // channelNumbers
        });
    });

    describe('网络模式数据读取完整测试 - 覆盖645-691行', () => {
        let mockResolve: jest.MockedFunction<any>;
        let mockReject: jest.MockedFunction<any>;
        let captureSession: CaptureSession;

        beforeEach(() => {
            mockResolve = jest.fn();
            mockReject = jest.fn();
            captureSession = {
                captureChannels: [{ channelNumber: 0 } as AnalyzerChannel],
                loopCount: 2,
                measureBursts: true
            } as CaptureSession;

            (driver as any)._currentStream = mockStream;
        });

        test('readNetworkCaptureData - 完整数据流程', () => {
            // 覆盖652-691行
            const mode = 1; // 16通道模式
            const totalSamples = 1000;
            
            // 模拟parseCaptureData方法
            jest.spyOn(driver as any, 'parseCaptureData').mockReturnValue({
                samples: new Uint32Array([0x1234, 0x5678]),
                timestamps: new BigUint64Array([100n, 200n]),
                bursts: []
            });

            (driver as any).readNetworkCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            // 模拟接收数据
            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            expect(dataHandler).toBeDefined();

            // 第一次数据 - 头部信息
            const headerChunk = Buffer.alloc(8);
            headerChunk.writeUInt32LE(1000, 0); // dataLength
            headerChunk.writeUInt16LE(0x1234, 4); // 第一个样本
            dataHandler(headerChunk);

            // 验证头部读取逻辑 (660-663行)
            expect(mockStream.off).not.toHaveBeenCalled(); // 还没收完数据

            // 第二次数据 - 完整数据
            const dataChunk = Buffer.alloc(2010);
            dataChunk.writeUInt16LE(0x5678, 0); // 第二个样本
            dataChunk.writeUInt8(8, 1996); // 时间戳长度
            // 添加时间戳数据
            dataChunk.writeUInt32LE(100, 1997);
            dataChunk.writeUInt32LE(200, 2001);
            dataHandler(dataChunk);

            expect(mockStream.off).toHaveBeenCalledWith('data', dataHandler);
            expect(mockResolve).toHaveBeenCalled();
        });

        test('readNetworkCaptureData - 数据长度计算', () => {
            // 覆盖665-670行的计算逻辑
            const mode = 0; // 8通道模式
            const totalSamples = 100;
            
            (driver as any).readNetworkCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            // 发送头部数据
            const headerChunk = Buffer.alloc(4);
            headerChunk.writeUInt32LE(100, 0);
            dataHandler(headerChunk);

            // 验证expectedTotalLength计算
            // bytesPerSample = 1 (mode 0)
            // timestampBytes = (2 + 2) * 4 = 16 (loopCount=2, measureBursts=true)
            // expectedTotalLength = 4 + 100*1 + 1 + 16 = 121
            
            const completeChunk = Buffer.alloc(117); // 121 - 4 (header)
            dataHandler(completeChunk);

            expect(mockResolve).toHaveBeenCalled();
        });

        test('readNetworkCaptureData - 无时间戳数据', () => {
            // 覆盖668-669行分支
            captureSession.loopCount = 0;
            captureSession.measureBursts = false;

            const mode = 2; // 24通道模式
            const totalSamples = 50;

            (driver as any).readNetworkCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            // 发送头部
            const headerChunk = Buffer.alloc(4);
            headerChunk.writeUInt32LE(50, 0);
            dataHandler(headerChunk);

            // timestampBytes = 0 (无时间戳)
            // expectedTotalLength = 4 + 50*4 + 1 + 0 = 205
            const completeChunk = Buffer.alloc(201); // 205 - 4
            dataHandler(completeChunk);

            expect(mockResolve).toHaveBeenCalled();
        });

        test('readNetworkCaptureData - 解析异常处理', () => {
            // 覆盖675-679行错误处理
            const mode = 1;
            const totalSamples = 100;
            
            jest.spyOn(driver as any, 'parseCaptureData').mockImplementation(() => {
                throw new Error('解析失败');
            });

            (driver as any).readNetworkCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            // 发送完整数据触发解析
            const headerChunk = Buffer.alloc(4);
            headerChunk.writeUInt32LE(100, 0);
            dataHandler(headerChunk);

            const dataChunk = Buffer.alloc(300);
            dataHandler(dataChunk);

            expect(mockReject).toHaveBeenCalledWith(expect.any(Error));
        });

        test('readNetworkCaptureData - 超时处理', () => {
            // 覆盖684-688行超时逻辑
            const mode = 1;
            const totalSamples = 100;

            jest.useFakeTimers();

            (driver as any).readNetworkCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            // 快进到超时
            jest.advanceTimersByTime(60001);

            expect(mockStream.off).toHaveBeenCalled();
            expect(mockReject).toHaveBeenCalledWith(expect.objectContaining({
                message: '网络数据读取超时'
            }));

            jest.useRealTimers();
        });
    });

    describe('串口模式数据读取完整测试 - 覆盖697-763行', () => {
        let mockResolve: jest.MockedFunction<any>;
        let mockReject: jest.MockedFunction<any>;
        let captureSession: CaptureSession;

        beforeEach(() => {
            mockResolve = jest.fn();
            mockReject = jest.fn();
            captureSession = {
                captureChannels: [{ channelNumber: 0 }],
                loopCount: 1,
                measureBursts: true
            } as CaptureSession;

            (driver as any)._currentStream = mockStream;
        });

        test('readSerialCaptureData - 缓冲区长度计算', () => {
            // 覆盖704-713行缓冲区长度计算
            const mode = 1; // 16通道模式
            const totalSamples = 200;

            // measureBursts=true, loopCount=1 的情况
            (driver as any).readSerialCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            // bytesPerSample = 2
            // bufferLength = 200 * 2 + 1 + (1 + 2) * 4 = 400 + 1 + 12 = 413

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            // 发送头部数据
            const headerChunk = Buffer.alloc(4);
            headerChunk.writeUInt32LE(200, 0);
            dataHandler(headerChunk);

            // 发送完整数据
            const dataChunk = Buffer.alloc(413);
            dataHandler(dataChunk);

            expect(mockResolve).toHaveBeenCalled();
        });

        test('readSerialCaptureData - 无时间戳分支', () => {
            // 覆盖709-710行分支
            captureSession.loopCount = 0;
            captureSession.measureBursts = false;

            const mode = 0; // 8通道模式
            const totalSamples = 100;

            (driver as any).readSerialCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            // bufferLength = 100 * 1 + 1 = 101 (只有时间戳长度字节)

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            const headerChunk = Buffer.alloc(4);
            headerChunk.writeUInt32LE(100, 0);
            dataHandler(headerChunk);

            const dataChunk = Buffer.alloc(101);
            dataHandler(dataChunk);

            expect(mockResolve).toHaveBeenCalled();
        });

        test('readSerialCaptureData - 分片头部接收', () => {
            // 覆盖720-735行头部分片接收逻辑
            const mode = 2;
            const totalSamples = 50;

            (driver as any).readSerialCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            // 分片发送头部 - 第一部分 (2字节)
            const headerChunk1 = Buffer.alloc(2);
            headerChunk1.writeUInt16LE(50, 0);
            dataHandler(headerChunk1);

            // 分片发送头部 - 第二部分 (2字节) + 部分数据
            const headerChunk2 = Buffer.alloc(10);
            headerChunk2.writeUInt16LE(0, 0); // 剩余的头部数据
            headerChunk2.writeUInt32LE(0x12345678, 2); // 部分样本数据
            dataHandler(headerChunk2);

            // 验证头部接收逻辑和剩余数据处理 (728-734行)
            expect(mockStream.off).not.toHaveBeenCalled(); // 数据还没收完
        });

        test('readSerialCaptureData - 解析异常处理', () => {
            // 覆盖750-752行错误处理
            const mode = 1;
            const totalSamples = 100;

            jest.spyOn(driver as any, 'parseCaptureData').mockImplementation(() => {
                throw new Error('串口解析失败');
            });

            (driver as any).readSerialCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            const dataHandler = mockStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
            
            // 发送完整数据触发解析
            const headerChunk = Buffer.alloc(4);
            headerChunk.writeUInt32LE(100, 0);
            dataHandler(headerChunk);

            const dataChunk = Buffer.alloc(300);
            dataHandler(dataChunk);

            expect(mockReject).toHaveBeenCalledWith(expect.any(Error));
        });

        test('readSerialCaptureData - 串口超时处理', () => {
            // 覆盖757-760行超时逻辑
            const mode = 1;
            const totalSamples = 100;

            jest.useFakeTimers();

            (driver as any).readSerialCaptureData(captureSession, mode, totalSamples, mockResolve, mockReject);

            // 快进到超时
            jest.advanceTimersByTime(60001);

            expect(mockStream.off).toHaveBeenCalled();
            expect(mockReject).toHaveBeenCalledWith(expect.objectContaining({
                message: '串口数据读取超时'
            }));

            jest.useRealTimers();
        });
    });

    describe('数据解析完整测试 - 覆盖769-829行', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            captureSession = {
                frequency: 10000000,
                loopCount: 2,
                measureBursts: true,
                preTriggerSamples: 1000,
                postTriggerSamples: 4000
            } as CaptureSession;

            // Mock processBurstTimestamps method
            jest.spyOn(driver as any, 'processBurstTimestamps').mockImplementation((timestamps, session, bursts) => {
                // 简单的mock实现
                bursts.push({ burstSampleStart: 0, burstSampleEnd: 100 });
            });
        });

        test('parseCaptureData - 8通道模式解析', () => {
            // 覆盖784-788行
            const mode = 0;
            const sampleCount = 4;
            
            // 构造测试数据: 4字节长度 + 4字节样本数据 + 1字节时间戳长度 + 时间戳数据
            const data = Buffer.alloc(5 + 16); // 4 + 4 + 1 + 16
            data.writeUInt32LE(sampleCount, 0); // 长度字段
            data.writeUInt8(0x12, 4); // 样本1
            data.writeUInt8(0x34, 5); // 样本2  
            data.writeUInt8(0x56, 6); // 样本3
            data.writeUInt8(0x78, 7); // 样本4
            data.writeUInt8(16, 8);   // 时间戳长度

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(result.samples[0]).toBe(0x12);
            expect(result.samples[1]).toBe(0x34);
            expect(result.samples[2]).toBe(0x56);
            expect(result.samples[3]).toBe(0x78);
        });

        test('parseCaptureData - 16通道模式解析', () => {
            // 覆盖790-794行
            const mode = 1;
            const sampleCount = 3;
            
            const data = Buffer.alloc(4 + 6 + 1 + 16);
            data.writeUInt32LE(sampleCount, 0);
            data.writeUInt16LE(0x1234, 4);
            data.writeUInt16LE(0x5678, 6);
            data.writeUInt16LE(0x9ABC, 8);
            data.writeUInt8(16, 10);

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(result.samples[0]).toBe(0x1234);
            expect(result.samples[1]).toBe(0x5678);
            expect(result.samples[2]).toBe(0x9ABC);
        });

        test('parseCaptureData - 24通道模式解析', () => {
            // 覆盖796-801行
            const mode = 2;
            const sampleCount = 2;
            
            const data = Buffer.alloc(4 + 8 + 1 + 16);
            data.writeUInt32LE(sampleCount, 0);
            data.writeUInt32LE(0x12345678, 4);
            data.writeUInt32LE(0x9ABCDEF0, 8);
            data.writeUInt8(16, 12);

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(result.samples[0]).toBe(0x12345678);
            expect(result.samples[1]).toBe(0x9ABCDEF0);
        });

        test('parseCaptureData - 时间戳读取', () => {
            // 覆盖804-822行时间戳处理
            const mode = 0;
            const sampleCount = 2;
            
            const data = Buffer.alloc(4 + 2 + 1 + 16);
            data.writeUInt32LE(sampleCount, 0);
            data.writeUInt8(0x12, 4);
            data.writeUInt8(0x34, 5);
            data.writeUInt8(16, 6); // 时间戳长度
            // 写入4个时间戳 (loopCount=2 -> timestampCount=4)
            data.writeUInt32LE(100, 7);
            data.writeUInt32LE(200, 11);
            data.writeUInt32LE(300, 15);
            data.writeUInt32LE(400, 19);

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(result.timestamps.length).toBe(4);
            expect(result.timestamps[0]).toBe(100n);
            expect(result.timestamps[1]).toBe(200n);
            expect(result.timestamps[2]).toBe(300n);
            expect(result.timestamps[3]).toBe(400n);
        });

        test('parseCaptureData - 无时间戳场景', () => {
            // 覆盖808-809行无时间戳分支
            captureSession.loopCount = 0;
            captureSession.measureBursts = false;

            const mode = 0;
            const sampleCount = 2;
            
            const data = Buffer.alloc(4 + 2 + 1);
            data.writeUInt32LE(sampleCount, 0);
            data.writeUInt8(0x12, 4);
            data.writeUInt8(0x34, 5);
            data.writeUInt8(0, 6); // 时间戳长度为0

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(result.timestamps.length).toBe(0);
            expect(result.bursts.length).toBe(0);
        });

        test('parseCaptureData - 时间戳数据不足处理', () => {
            // 覆盖816-821行边界检查
            const mode = 0;
            const sampleCount = 2;
            
            // 构造数据不足的Buffer
            const data = Buffer.alloc(4 + 2 + 1 + 8); // 只有2个时间戳的空间
            data.writeUInt32LE(sampleCount, 0);
            data.writeUInt8(0x12, 4);
            data.writeUInt8(0x34, 5);
            data.writeUInt8(16, 6); // 声称有16字节时间戳
            data.writeUInt32LE(100, 7);
            data.writeUInt32LE(200, 11);
            // 没有更多数据

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(result.timestamps.length).toBe(4); // timestampCount=4
            expect(result.timestamps[0]).toBe(100n);
            expect(result.timestamps[1]).toBe(200n);
            expect(result.timestamps[2]).toBe(0n); // 默认值
            expect(result.timestamps[3]).toBe(0n); // 默认值
        });

        test('parseCaptureData - processBurstTimestamps调用', () => {
            // 覆盖825行的方法调用
            const mode = 0;
            const sampleCount = 2;
            
            const data = Buffer.alloc(4 + 2 + 1 + 16);
            data.writeUInt32LE(sampleCount, 0);
            data.writeUInt8(0x12, 4);
            data.writeUInt8(0x34, 5);
            data.writeUInt8(16, 6);
            data.writeUInt32LE(100, 7);

            const processBurstTimestampsSpy = jest.spyOn(driver as any, 'processBurstTimestamps');

            const result = (driver as any).parseCaptureData(data, captureSession, mode, sampleCount);

            expect(processBurstTimestampsSpy).toHaveBeenCalledWith(
                expect.any(BigUint64Array),
                captureSession,
                expect.any(Array)
            );
        });
    });

    describe('时间戳处理完整测试 - 覆盖835-900行', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            captureSession = {
                frequency: 10000000,
                postTriggerSamples: 1000,
                preTriggerSamples: 500
            } as CaptureSession;
        });

        test('processBurstTimestamps - 空时间戳处理', () => {
            // 覆盖840行早期返回
            const timestamps = new BigUint64Array(0);
            const bursts: any[] = [];

            (driver as any).processBurstTimestamps(timestamps, captureSession, bursts);

            expect(bursts.length).toBe(0);
        });

        test('processBurstTimestamps - 时间戳数量不足', () => {
            // 覆盖843行早期返回
            const timestamps = new BigUint64Array([100n, 200n]); // 只有2个
            const bursts: any[] = [];

            (driver as any).processBurstTimestamps(timestamps, captureSession, bursts);

            expect(bursts.length).toBe(0);
        });

        test('processBurstTimestamps - 完整时间戳处理流程', () => {
            // 覆盖847-899行完整流程
            const originalTimestamps = new BigUint64Array([
                0x12345678n,
                0x23456789n,
                0x34567890n,
                0x45678901n
            ]);
            const bursts: any[] = [];

            // Mock BurstInfo constructor
            (global as any).BurstInfo = class {
                burstSampleStart: number = 0;
                burstSampleEnd: number = 0;
                burstSampleGap: bigint = 0n;
                burstTimeGap: bigint = 0n;
            };

            (driver as any).processBurstTimestamps(originalTimestamps, captureSession, bursts);

            // 验证时间戳反转逻辑 (847-850行)
            expect(originalTimestamps[0]).toBe((0x12345678n & 0xFF000000n) | (0x00FFFFFFn - (0x12345678n & 0x00FFFFFFn)));

            // 验证burst信息创建 (891-899行)
            expect(bursts.length).toBe(3); // timestamps.length - 1
        });

        test('processBurstTimestamps - 时间单位计算', () => {
            // 覆盖852-857行时间单位计算
            captureSession.frequency = 20000000; // 20MHz
            captureSession.postTriggerSamples = 2000;

            const timestamps = new BigUint64Array([100n, 200n, 300n]);
            const bursts: any[] = [];

            (global as any).BurstInfo = class {
                burstSampleStart: number = 0;
                burstSampleEnd: number = 0;
                burstSampleGap: bigint = 0n;
                burstTimeGap: bigint = 0n;
            };

            (driver as any).processBurstTimestamps(timestamps, captureSession, bursts);

            // nsPerSample = 1000000000.0 / 20000000 = 50
            // ticksPerSample = 50 / 5.0 = 10
            // nsPerBurst = 50 * 2000 = 100000
            // ticksPerBurst = 100000 / 5.0 = 20000

            expect(bursts.length).toBe(2);
        });

        test('processBurstTimestamps - 计数器回绕处理', () => {
            // 覆盖862-864行和881-883行回绕逻辑
            const timestamps = new BigUint64Array([
                0xFFFFFFFEn, // 大值
                0x00000001n, // 小值 (模拟回绕)
                0x00000002n
            ]);
            const bursts: any[] = [];

            (global as any).BurstInfo = class {
                burstSampleStart: number = 0;
                burstSampleEnd: number = 0;
                burstSampleGap: bigint = 0n;
                burstTimeGap: bigint = 0n;
            };

            (driver as any).processBurstTimestamps(timestamps, captureSession, bursts);

            // 验证回绕处理逻辑
            expect(bursts.length).toBe(2);
        });

        test('processBurstTimestamps - 抖动补偿调整', () => {
            // 覆盖866-874行抖动补偿逻辑
            const timestamps = new BigUint64Array([
                1000n,
                1010n,  // 差异很小，触发抖动补偿
                1020n,
                1030n
            ]);
            const bursts: any[] = [];

            (global as any).BurstInfo = class {
                burstSampleStart: number = 0;
                burstSampleEnd: number = 0;
                burstSampleGap: bigint = 0n;
                burstTimeGap: bigint = 0n;
            };

            (driver as any).processBurstTimestamps(timestamps, captureSession, bursts);

            expect(bursts.length).toBe(3);
        });

        test('processBurstTimestamps - 延迟计算', () => {
            // 覆盖878-887行延迟计算
            const timestamps = new BigUint64Array([
                0n,
                10000n,
                25000n,
                40000n
            ]);
            const bursts: any[] = [];

            (global as any).BurstInfo = class {
                burstSampleStart: number = 0;
                burstSampleEnd: number = 0;
                burstSampleGap: bigint = 0n;
                burstTimeGap: bigint = 0n;
            };

            (driver as any).processBurstTimestamps(timestamps, captureSession, bursts);

            // 验证delays数组长度 = timestamps.length - 2 = 2
            expect(bursts.length).toBe(3);
        });
    });

    describe('样本数据提取测试 - 覆盖906-926行', () => {
        let captureSession: CaptureSession;

        beforeEach(() => {
            captureSession = {
                captureChannels: [
                    { channelNumber: 0, channelName: 'Channel 0', samples: undefined } as any,
                    { channelNumber: 1, channelName: 'Channel 1', samples: undefined } as any,
                    { channelNumber: 2, channelName: 'Channel 2', samples: undefined } as any
                ]
            } as CaptureSession;
        });

        test('extractSamplesToChannels - 基本样本提取', () => {
            // 覆盖910-920行样本提取逻辑
            const captureData = {
                samples: new Uint32Array([0b101, 0b010, 0b111, 0b000]), // 4个样本
                timestamps: new BigUint64Array(),
                bursts: []
            };

            (driver as any).extractSamplesToChannels(captureSession, captureData);

            // 验证通道0 (bit 0)
            expect(captureSession.captureChannels[0].samples).toEqual(new Uint8Array([1, 0, 1, 0]));
            
            // 验证通道1 (bit 1)  
            expect(captureSession.captureChannels[1].samples).toEqual(new Uint8Array([0, 1, 1, 0]));
            
            // 验证通道2 (bit 2)
            expect(captureSession.captureChannels[2].samples).toEqual(new Uint8Array([1, 0, 1, 0]));
        });

        test('extractSamplesToChannels - 位掩码计算', () => {
            // 覆盖914行位掩码计算
            const captureData = {
                samples: new Uint32Array([0xFF]), // 所有位为1
                timestamps: new BigUint64Array(),
                bursts: []
            };

            (driver as any).extractSamplesToChannels(captureSession, captureData);

            // channelIndex=0 -> mask = 1 << 0 = 1
            // channelIndex=1 -> mask = 1 << 1 = 2  
            // channelIndex=2 -> mask = 1 << 2 = 4

            expect(captureSession.captureChannels[0].samples[0]).toBe(1);
            expect(captureSession.captureChannels[1].samples[0]).toBe(1);
            expect(captureSession.captureChannels[2].samples[0]).toBe(1);
        });

        test('extractSamplesToChannels - 突发信息设置', () => {
            // 覆盖922-925行突发信息设置
            const burstInfo = { burstSampleStart: 0, burstSampleEnd: 100 };
            const captureData = {
                samples: new Uint32Array([1]),
                timestamps: new BigUint64Array(),
                bursts: [burstInfo]
            };

            (driver as any).extractSamplesToChannels(captureSession, captureData);

            expect(captureSession.bursts).toEqual([burstInfo]);
        });

        test('extractSamplesToChannels - 无突发信息', () => {
            // 覆盖922-925行的else分支(空bursts数组)
            const captureData = {
                samples: new Uint32Array([1]),
                timestamps: new BigUint64Array(),
                bursts: [] // 空数组
            };

            (driver as any).extractSamplesToChannels(captureSession, captureData);

            expect(captureSession.bursts).toBeUndefined();
        });

        test('extractSamplesToChannels - 大样本数据处理', () => {
            // 测试大量样本的处理性能
            const sampleCount = 10000;
            const samples = new Uint32Array(sampleCount);
            
            // 生成测试模式
            for (let i = 0; i < sampleCount; i++) {
                samples[i] = i % 8; // 生成0-7的循环模式
            }

            const captureData = {
                samples,
                timestamps: new BigUint64Array(),
                bursts: []
            };

            (driver as any).extractSamplesToChannels(captureSession, captureData);

            // 验证每个通道都有正确的样本数
            captureSession.captureChannels.forEach(channel => {
                expect(channel.samples).toBeDefined();
                expect(channel.samples!.length).toBe(sampleCount);
            });

            // 验证几个特定位置的数据
            expect(captureSession.captureChannels[0].samples![0]).toBe(0); // 0 & 1 = 0
            expect(captureSession.captureChannels[0].samples![1]).toBe(1); // 1 & 1 = 1
            expect(captureSession.captureChannels[1].samples![2]).toBe(1); // 2 & 2 = 2 -> 1
            expect(captureSession.captureChannels[2].samples![4]).toBe(1); // 4 & 4 = 4 -> 1
        });
    });
});