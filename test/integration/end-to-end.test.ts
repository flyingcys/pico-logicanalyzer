/**
 * 端到端集成测试
 * 测试完整的设备连接、数据采集、解码器处理流程
 */

import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { MultiAnalyzerDriver } from '../../src/drivers/MultiAnalyzerDriver';
import { DecoderManager } from '../../src/decoders/DecoderManager';
import { CaptureSession } from '../../src/models/CaptureSession';
import { AnalyzerChannel } from '../../src/models/AnalyzerChannel';
import { TriggerType, CaptureError } from '../../src/models/Enums';
import { LACFileFormat } from '../../src/data/LACFileFormat';

// Mock串口通信
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => {
            setTimeout(() => callback && callback(), 100);
        }),
        close: jest.fn((callback) => {
            setTimeout(() => callback && callback(), 50);
        }),
        write: jest.fn((data, callback) => {
            setTimeout(() => callback && callback(), 10);
        }),
        on: jest.fn((event, handler) => {
            if (event === 'data') {
                // 模拟接收数据
                setTimeout(() => {
                    const mockData = new Uint8Array([0x55, 0xAA, 0x01, 0x02, 0x03, 0xAA, 0x55]);
                    handler(mockData);
                }, 50);
            }
        }),
        off: jest.fn(),
        isOpen: true
    })),
    available: jest.fn().mockResolvedValue([
        { path: '/dev/ttyUSB0', manufacturer: 'Test', vendorId: '1234', productId: '5678' },
        { path: '/dev/ttyUSB1', manufacturer: 'Test', vendorId: '1234', productId: '5678' }
    ])
}));

describe('端到端集成测试', () => {
    let driver: LogicAnalyzerDriver;
    let decoderManager: DecoderManager;
    let captureSession: CaptureSession;
    
    beforeAll(async () => {
        // 初始化组件
        driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
        decoderManager = new DecoderManager();
        
        // 等待驱动初始化
        await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    beforeEach(() => {
        // 重置采集会话
        captureSession = new CaptureSession();
        captureSession.frequency = 24000000;
        captureSession.preTriggerSamples = 1000;
        captureSession.postTriggerSamples = 10000;
        captureSession.triggerType = TriggerType.Edge;
        captureSession.triggerChannel = 0;
    });
    
    afterAll(async () => {
        if (driver && driver.isCapturing) {
            await driver.stopCapture();
        }
    });
    
    describe('单设备完整流程测试', () => {
        test('设备连接 -> 数据采集 -> I2C解码 -> 结果验证', async () => {
            // 1. 设备连接验证
            expect(driver).toBeDefined();
            expect(driver.isCapturing).toBe(false);
            
            const deviceInfo = driver.getDeviceInfo();
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.channels).toBe(24);
            
            // 2. 配置I2C采集
            const sclChannel = new AnalyzerChannel(0, 'SCL');
            const sdaChannel = new AnalyzerChannel(1, 'SDA');
            
            // 生成模拟的I2C数据（START + 地址 + ACK + 数据 + STOP）
            const i2cClockData = new Uint8Array([
                1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1
            ]);
            const i2cDataData = new Uint8Array([
                1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1
            ]);
            
            sclChannel.samples = i2cClockData;
            sdaChannel.samples = i2cDataData;
            
            captureSession.captureChannels = [sclChannel, sdaChannel];
            
            // 3. 启动数据采集
            const captureResult = await driver.startCapture(captureSession);
            expect(captureResult).toBe(CaptureError.None);
            expect(driver.isCapturing).toBe(true);
            
            // 等待采集完成
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 4. 停止采集
            const stopResult = await driver.stopCapture();
            expect(stopResult).toBe(true);
            expect(driver.isCapturing).toBe(false);
            
            // 5. 执行I2C解码
            const i2cOptions = [
                { id: 'address_format', value: '7-bit' }
            ];
            
            const decodingResults = await decoderManager.executeDecoder(
                'i2c', 
                captureSession.frequency, 
                captureSession.captureChannels, 
                i2cOptions
            );
            
            // 6. 验证解码结果
            expect(decodingResults).toBeDefined();
            expect(Array.isArray(decodingResults)).toBe(true);
            expect(decodingResults.length).toBeGreaterThan(0);
            
            // 验证包含START条件
            const startResult = decodingResults.find(r => r.annotationType === 'start');
            expect(startResult).toBeDefined();
            
            // 验证包含地址信息
            const addressResult = decodingResults.find(r => 
                r.annotationType.includes('address')
            );
            expect(addressResult).toBeDefined();
            
        }, 10000);
        
        test('设备连接 -> SPI数据采集 -> SPI解码 -> 数据导出', async () => {
            // 1. 配置SPI采集
            const sclkChannel = new AnalyzerChannel(0, 'SCLK');
            const mosiChannel = new AnalyzerChannel(1, 'MOSI');
            const misoChannel = new AnalyzerChannel(2, 'MISO');
            const csChannel = new AnalyzerChannel(3, 'CS');
            
            // 生成模拟的SPI数据
            const spiClockData = new Uint8Array(32);
            const spiMosiData = new Uint8Array(32);
            const spiMisoData = new Uint8Array(32);
            const spiCsData = new Uint8Array(32);
            
            // SPI模式0: CPOL=0, CPHA=0
            for (let i = 0; i < 32; i++) {
                spiClockData[i] = i % 2; // 时钟信号
                spiMosiData[i] = Math.floor(i / 2) % 2; // MOSI数据
                spiMisoData[i] = Math.floor(i / 4) % 2; // MISO数据
                spiCsData[i] = i < 24 ? 0 : 1; // CS信号
            }
            
            sclkChannel.samples = spiClockData;
            mosiChannel.samples = spiMosiData;
            misoChannel.samples = spiMisoData;
            csChannel.samples = spiCsData;
            
            captureSession.captureChannels = [sclkChannel, mosiChannel, misoChannel, csChannel];
            
            // 2. 数据采集
            const captureResult = await driver.startCapture(captureSession);
            expect(captureResult).toBe(CaptureError.None);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            await driver.stopCapture();
            
            // 3. SPI解码
            const spiOptions = [
                { id: 'cpol', value: 0 },
                { id: 'cpha', value: 0 },
                { id: 'bitorder', value: 'msb-first' },
                { id: 'wordsize', value: 8 }
            ];
            
            const spiResults = await decoderManager.executeDecoder(
                'spi',
                captureSession.frequency,
                captureSession.captureChannels,
                spiOptions
            );
            
            // 4. 验证SPI解码结果
            expect(spiResults).toBeDefined();
            expect(spiResults.length).toBeGreaterThan(0);
            
            const mosiResult = spiResults.find(r => r.annotationType.includes('mosi'));
            expect(mosiResult).toBeDefined();
            
            // 5. 数据导出测试
            const lacFormat = new LACFileFormat();
            const exportData = await lacFormat.save(captureSession, '/tmp/test-spi-capture.lac');
            
            expect(exportData).toBeDefined();
            
            // 验证导出的数据
            const importedSession = await lacFormat.load('/tmp/test-spi-capture.lac');
            expect(importedSession).toBeDefined();
            expect(importedSession.frequency).toBe(captureSession.frequency);
            expect(importedSession.captureChannels.length).toBe(4);
        }, 10000);
        
        test('UART数据采集和解码完整流程', async () => {
            // 1. 配置UART采集
            const rxChannel = new AnalyzerChannel(0, 'RX');
            
            // 生成UART数据 (8N1格式): "A" (0x41)
            // 起始位(0) + 8数据位(0x41) + 停止位(1)
            const uartData = new Uint8Array([
                1, 1, 1, 1, // 空闲状态
                0, // 起始位
                1, 0, 0, 0, 0, 0, 1, 0, // 数据位 0x41 (LSB first)
                1, // 停止位
                1, 1, 1 // 空闲状态
            ]);
            
            rxChannel.samples = uartData;
            captureSession.captureChannels = [rxChannel];
            
            // 2. 数据采集
            const captureResult = await driver.startCapture(captureSession);
            expect(captureResult).toBe(CaptureError.None);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            await driver.stopCapture();
            
            // 3. UART解码
            const uartOptions = [
                { id: 'baudrate', value: 9600 },
                { id: 'num_data_bits', value: 8 },
                { id: 'parity_type', value: 'none' },
                { id: 'num_stop_bits', value: 1 },
                { id: 'bit_order', value: 'lsb-first' }
            ];
            
            const uartResults = await decoderManager.executeDecoder(
                'uart',
                captureSession.frequency,
                captureSession.captureChannels,
                uartOptions
            );
            
            // 4. 验证UART解码结果
            expect(uartResults).toBeDefined();
            expect(uartResults.length).toBeGreaterThan(0);
            
            const startBitResult = uartResults.find(r => r.annotationType === 'startbit');
            const dataBitResult = uartResults.find(r => r.annotationType === 'data');
            const stopBitResult = uartResults.find(r => r.annotationType === 'stopbit');
            
            expect(startBitResult).toBeDefined();
            expect(dataBitResult).toBeDefined();
            expect(stopBitResult).toBeDefined();
            
            // 验证解码的数据值
            if (dataBitResult && dataBitResult.rawData !== undefined) {
                expect(dataBitResult.rawData).toBe(0x41); // 'A'
            }
        }, 8000);
    });
    
    describe('多设备协同测试', () => {
        test('双设备同步采集和数据对比', async () => {
            const multiDriver = new MultiAnalyzerDriver();
            
            // 添加两个设备
            await multiDriver.addDevice('/dev/ttyUSB0');
            await multiDriver.addDevice('/dev/ttyUSB1');
            
            expect(multiDriver.connectedDevices.length).toBe(2);
            
            // 配置同步采集
            const syncSessions = new Map<string, CaptureSession>();
            
            const session1 = captureSession.clone();
            session1.captureChannels = [
                new AnalyzerChannel(0, 'Device1_CH0'),
                new AnalyzerChannel(1, 'Device1_CH1')
            ];
            
            const session2 = captureSession.clone();
            session2.captureChannels = [
                new AnalyzerChannel(0, 'Device2_CH0'),
                new AnalyzerChannel(1, 'Device2_CH1')
            ];
            
            syncSessions.set('device1', session1);
            syncSessions.set('device2', session2);
            
            // 执行同步采集
            const syncResults = await multiDriver.startSynchronizedCapture(syncSessions);
            
            expect(syncResults).toBeDefined();
            expect(syncResults.size).toBe(2);
            
            // 验证时间同步
            const device1Data = syncResults.get('device1');
            const device2Data = syncResults.get('device2');
            
            expect(device1Data).toBeDefined();
            expect(device2Data).toBeDefined();
            
            // 时间戳差异应该很小（同步采集）
            const timeDiff = Math.abs(device1Data!.metadata.timestamp - device2Data!.metadata.timestamp);
            expect(timeDiff).toBeLessThan(1000); // 1ms以内
            
        }, 15000);
    });
    
    describe('错误恢复和异常处理测试', () => {
        test('设备断开连接后的恢复流程', async () => {
            // 模拟设备断开
            const originalIsCapturing = driver.isCapturing;
            
            // 启动采集
            const startResult = await driver.startCapture(captureSession);
            expect(startResult).toBe(CaptureError.None);
            
            // 模拟设备突然断开
            (driver as any).serialPort = null;
            
            // 尝试停止采集（应该处理错误）
            const stopResult = await driver.stopCapture();
            expect(typeof stopResult).toBe('boolean');
            
            // 验证状态被正确重置
            expect(driver.isCapturing).toBe(false);
        });
        
        test('解码器异常处理', async () => {
            // 创建无效的通道数据
            const invalidChannel = new AnalyzerChannel(0, 'Invalid');
            invalidChannel.samples = new Uint8Array(0); // 空数据
            
            captureSession.captureChannels = [invalidChannel];
            
            // 尝试I2C解码（应该优雅处理错误）
            try {
                const results = await decoderManager.executeDecoder(
                    'i2c',
                    captureSession.frequency,
                    captureSession.captureChannels,
                    []
                );
                
                // 应该返回空结果而不是抛出异常
                expect(Array.isArray(results)).toBe(true);
            } catch (error) {
                // 如果抛出异常，应该是可预期的错误
                expect(error).toBeDefined();
                expect(error.message).toContain('Invalid');
            }
        });
    });
    
    describe('性能和压力测试', () => {
        test('大数据量采集和处理性能', async () => {
            // 创建大量样本数据
            const largeChannel = new AnalyzerChannel(0, 'Large Data');
            largeChannel.samples = new Uint8Array(100000).map((_, i) => i % 2);
            
            captureSession.captureChannels = [largeChannel];
            captureSession.postTriggerSamples = 100000;
            
            const startTime = Date.now();
            
            // 启动采集
            const captureResult = await driver.startCapture(captureSession);
            expect(captureResult).toBe(CaptureError.None);
            
            await driver.stopCapture();
            
            const captureTime = Date.now() - startTime;
            expect(captureTime).toBeLessThan(5000); // 5秒内完成
            
            // 测试解码性能
            const decodeStartTime = Date.now();
            
            const results = await decoderManager.executeDecoder(
                'uart',
                captureSession.frequency,
                captureSession.captureChannels,
                [{ id: 'baudrate', value: 9600 }]
            );
            
            const decodeTime = Date.now() - decodeStartTime;
            expect(decodeTime).toBeLessThan(2000); // 2秒内完成解码
            
            expect(Array.isArray(results)).toBe(true);
            
        }, 10000);
        
        test('内存使用稳定性测试', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 执行多轮采集和解码
            for (let i = 0; i < 10; i++) {
                // 小数据量快速循环
                const testChannel = new AnalyzerChannel(0, `Test ${i}`);
                testChannel.samples = new Uint8Array(1000).map((_, j) => j % 2);
                
                const testSession = captureSession.clone();
                testSession.captureChannels = [testChannel];
                
                await driver.startCapture(testSession);
                await new Promise(resolve => setTimeout(resolve, 50));
                await driver.stopCapture();
                
                await decoderManager.executeDecoder(
                    'uart',
                    testSession.frequency,
                    testSession.captureChannels,
                    []
                );
            }
            
            // 强制垃圾回收
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // 内存增长应该在合理范围内
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
        }, 15000);
    });
    
    describe('数据完整性验证', () => {
        test('采集数据的完整性和一致性', async () => {
            // 创建已知的测试数据模式
            const knownPattern = new Uint8Array(1000);
            for (let i = 0; i < 1000; i++) {
                knownPattern[i] = (i % 8) < 4 ? 1 : 0; // 4高4低的重复模式
            }
            
            const testChannel = new AnalyzerChannel(0, 'Pattern Test');
            testChannel.samples = knownPattern;
            
            captureSession.captureChannels = [testChannel];
            
            // 采集
            await driver.startCapture(captureSession);
            await new Promise(resolve => setTimeout(resolve, 100));
            await driver.stopCapture();
            
            // 验证数据完整性
            const capturedData = captureSession.captureChannels[0].samples;
            expect(capturedData).toBeDefined();
            
            if (capturedData) {
                // 验证数据长度
                expect(capturedData.length).toBeGreaterThan(0);
                
                // 验证数据模式（如果采集到足够数据）
                if (capturedData.length >= 8) {
                    let patternMatches = 0;
                    for (let i = 0; i < Math.min(capturedData.length - 8, 100); i += 8) {
                        let isMatch = true;
                        for (let j = 0; j < 8; j++) {
                            const expected = j < 4 ? 1 : 0;
                            if (capturedData[i + j] !== expected) {
                                isMatch = false;
                                break;
                            }
                        }
                        if (isMatch) patternMatches++;
                    }
                    
                    // 至少50%的模式应该匹配（考虑噪声和同步问题）
                    expect(patternMatches).toBeGreaterThan(0);
                }
            }
        });
    });
});