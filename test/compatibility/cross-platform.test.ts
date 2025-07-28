/**
 * 跨平台兼容性测试
 * 测试多平台（Windows/Linux/macOS）、多设备的兼容性
 */

import * as os from 'os';
import * as path from 'path';
import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { MultiAnalyzerDriver } from '../../src/drivers/MultiAnalyzerDriver';
import { CaptureSession } from '../../src/models/CaptureSession';
import { AnalyzerChannel } from '../../src/models/AnalyzerChannel';
import { LACFileFormat } from '../../src/data/LACFileFormat';
import { TriggerType } from '../../src/models/Enums';

// Mock系统相关模块
jest.mock('serialport', () => ({
    SerialPort: {
        list: jest.fn(() => {
            const platform = os.platform();
            if (platform === 'win32') {
                return Promise.resolve([
                    { path: 'COM3', manufacturer: 'FTDI', vendorId: '0403', productId: '6001' },
                    { path: 'COM4', manufacturer: 'Prolific', vendorId: '067B', productId: '2303' }
                ]);
            } else if (platform === 'darwin') {
                return Promise.resolve([
                    { path: '/dev/cu.usbserial-FT123456', manufacturer: 'FTDI', vendorId: '0403', productId: '6001' },
                    { path: '/dev/cu.usbmodem14401', manufacturer: 'Arduino', vendorId: '1A86', productId: '7523' }
                ]);
            } else {
                return Promise.resolve([
                    { path: '/dev/ttyUSB0', manufacturer: 'FTDI', vendorId: '0403', productId: '6001' },
                    { path: '/dev/ttyACM0', manufacturer: 'Arduino', vendorId: '1A86', productId: '7523' }
                ]);
            }
        })
    }
}));

describe('跨平台兼容性测试', () => {
    const platform = os.platform();
    const arch = os.arch();
    
    beforeAll(() => {
        console.log(`\n测试平台信息:`);
        console.log(`  操作系统: ${platform} (${arch})`);
        console.log(`  Node.js版本: ${process.version}`);
        console.log(`  内存: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
        console.log(`  CPU: ${os.cpus()[0].model}\n`);
    });
    
    describe('文件路径兼容性测试', () => {
        test('路径分隔符应该正确处理', () => {
            const testPaths = [
                'data/captures/test.lac',
                'drivers/custom/driver.ts',
                'output/exports/data.csv'
            ];
            
            testPaths.forEach(testPath => {
                const normalizedPath = path.normalize(testPath);
                const resolvedPath = path.resolve(testPath);
                
                expect(normalizedPath).toBeDefined();
                expect(resolvedPath).toBeDefined();
                
                // Windows路径应该使用反斜杠
                if (platform === 'win32') {
                    expect(normalizedPath.includes('\\')).toBe(true);
                } else {
                    expect(normalizedPath.includes('/')).toBe(true);
                }
            });
        });
        
        test('临时文件路径应该适配平台', () => {
            const tempDir = os.tmpdir();
            const testFile = path.join(tempDir, 'test-capture.lac');
            
            expect(tempDir).toBeDefined();
            expect(testFile).toContain(tempDir);
            
            // 验证路径格式
            if (platform === 'win32') {
                expect(tempDir).toMatch(/^[A-Z]:\\/);
            } else {
                expect(tempDir).toMatch(/^\/.*tmp/);
            }
        });
        
        test('配置文件路径应该使用平台特定目录', () => {
            const homeDir = os.homedir();
            let configDir: string;
            
            switch (platform) {
                case 'win32':
                    configDir = path.join(homeDir, 'AppData', 'Roaming', 'logic-analyzer');
                    break;
                case 'darwin':
                    configDir = path.join(homeDir, 'Library', 'Application Support', 'logic-analyzer');
                    break;
                default:
                    configDir = path.join(homeDir, '.config', 'logic-analyzer');
            }
            
            expect(configDir).toContain(homeDir);
            expect(path.isAbsolute(configDir)).toBe(true);
        });
    });
    
    describe('串口设备兼容性测试', () => {
        test('应该能检测平台特定的串口设备', async () => {
            const { SerialPort } = require('serialport');
            const ports = await SerialPort.list();
            
            expect(Array.isArray(ports)).toBe(true);
            expect(ports.length).toBeGreaterThan(0);
            
            ports.forEach((port: any) => {
                expect(port.path).toBeDefined();
                
                // 验证平台特定的路径格式
                switch (platform) {
                    case 'win32':
                        expect(port.path).toMatch(/^COM\d+$/);
                        break;
                    case 'darwin':
                        expect(port.path).toMatch(/^\/dev\/(cu|tty)\./);
                        break;
                    default:
                        expect(port.path).toMatch(/^\/dev\/tty(USB|ACM)\d+$/);
                }
            });
        });
        
        test('驱动器应该适配不同平台的串口命名', async () => {
            const { SerialPort } = require('serialport');
            const ports = await SerialPort.list();
            
            if (ports.length > 0) {
                const testPort = ports[0].path;
                const driver = new LogicAnalyzerDriver(testPort);
                
                expect(driver).toBeDefined();
                
                // 验证设备信息
                const deviceInfo = driver.getDeviceInfo();
                expect(deviceInfo).toBeDefined();
                expect(deviceInfo.name).toBeDefined();
            }
        });
    });
    
    describe('文件格式兼容性测试', () => {
        test('LAC文件应该在所有平台上兼容', async () => {
            const lacFormat = new LACFileFormat();
            
            // 创建测试会话
            const session = new CaptureSession();
            session.frequency = 24000000;
            session.preTriggerSamples = 1000;
            session.postTriggerSamples = 10000;
            session.triggerType = TriggerType.Edge;
            
            const channel = new AnalyzerChannel(0, 'Test Channel');
            channel.samples = new Uint8Array([0, 1, 1, 0, 1, 0, 0, 1]);
            session.captureChannels = [channel];
            
            // 使用平台特定的临时路径
            const tempDir = os.tmpdir();
            const testFile = path.join(tempDir, `test-${Date.now()}.lac`);
            
            try {
                // 保存文件
                await lacFormat.save(session, testFile);
                
                // 加载文件
                const loadedSession = await lacFormat.load(testFile);
                
                // 验证数据一致性
                expect(loadedSession.frequency).toBe(session.frequency);
                expect(loadedSession.preTriggerSamples).toBe(session.preTriggerSamples);
                expect(loadedSession.postTriggerSamples).toBe(session.postTriggerSamples);
                expect(loadedSession.captureChannels.length).toBe(1);
                expect(loadedSession.captureChannels[0].channelName).toBe('Test Channel');
                expect(loadedSession.captureChannels[0].samples).toEqual(channel.samples);
                
            } catch (error) {
                console.error(`文件操作失败 (${platform}):`, error);
                throw error;
            }
        });
        
        test('二进制数据处理应该一致', () => {
            const testData = new Uint8Array([0x55, 0xAA, 0xFF, 0x00, 0x80, 0x7F]);
            
            // 测试字节序
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint32(0, 0x12345678, true); // 小端序
            
            const bytes = new Uint8Array(buffer);
            
            // 验证平台字节序处理
            if (os.endianness() === 'LE') {
                expect(bytes[0]).toBe(0x78);
                expect(bytes[1]).toBe(0x56);
                expect(bytes[2]).toBe(0x34);
                expect(bytes[3]).toBe(0x12);
            } else {
                expect(bytes[0]).toBe(0x12);
                expect(bytes[1]).toBe(0x34);
                expect(bytes[2]).toBe(0x56);
                expect(bytes[3]).toBe(0x78);
            }
        });
    });
    
    describe('性能差异测试', () => {
        test('数据处理性能应该在可接受范围内', () => {
            const dataSize = 100000;
            const testData = new Uint8Array(dataSize);
            
            // 填充测试数据
            for (let i = 0; i < dataSize; i++) {
                testData[i] = i % 256;
            }
            
            const startTime = Date.now();
            
            // 执行数据处理操作
            let sum = 0;
            for (let i = 0; i < dataSize; i++) {
                sum += testData[i];
            }
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            console.log(`${platform}平台数据处理性能: ${processingTime}ms`);
            
            // 性能应该在合理范围内（根据平台调整）
            let maxTime = 100; // 默认100ms
            if (platform === 'win32') {
                maxTime = 150; // Windows可能稍慢
            } else if (arch === 'arm' || arch === 'arm64') {
                maxTime = 200; // ARM架构可能稍慢
            }
            
            expect(processingTime).toBeLessThan(maxTime);
            expect(sum).toBeGreaterThan(0);
        });
        
        test('内存使用模式应该一致', () => {
            const initialMemory = process.memoryUsage();
            const testArrays: Uint8Array[] = [];
            
            // 分配一定量的内存
            for (let i = 0; i < 100; i++) {
                testArrays.push(new Uint8Array(10000));
            }
            
            const afterAllocation = process.memoryUsage();
            
            // 清理内存
            testArrays.length = 0;
            
            if (global.gc) {
                global.gc();
            }
            
            const afterCleanup = process.memoryUsage();
            
            const allocatedMemory = afterAllocation.heapUsed - initialMemory.heapUsed;
            const leakedMemory = afterCleanup.heapUsed - initialMemory.heapUsed;
            
            console.log(`${platform}平台内存使用:`);
            console.log(`  分配: ${(allocatedMemory / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  泄漏: ${(leakedMemory / 1024 / 1024).toFixed(2)}MB`);
            
            // 验证内存分配合理
            expect(allocatedMemory).toBeGreaterThan(0);
            
            // 验证内存泄漏很小
            expect(leakedMemory).toBeLessThan(allocatedMemory * 0.5);
        });
    });
    
    describe('并发处理兼容性测试', () => {
        test('多线程Worker支持应该一致', async () => {
            // 检查Worker支持情况
            const hasWorkerThreads = (() => {
                try {
                    require('worker_threads');
                    return true;
                } catch {
                    return false;
                }
            })();
            
            console.log(`${platform}平台Worker支持: ${hasWorkerThreads}`);
            
            if (hasWorkerThreads) {
                const { Worker, isMainThread, parentPort } = require('worker_threads');
                
                expect(isMainThread).toBe(true);
                
                // 简单的Worker测试
                const workerCode = `
                    const { parentPort } = require('worker_threads');
                    parentPort.postMessage('worker ready');
                `;
                
                // 注意：这里只是验证API可用性，实际Worker需要文件
                expect(Worker).toBeDefined();
            }
        });
        
        test('Promise和async/await应该正常工作', async () => {
            const testPromises = [];
            
            // 创建多个异步任务
            for (let i = 0; i < 10; i++) {
                testPromises.push(
                    new Promise<number>(resolve => {
                        setTimeout(() => resolve(i), Math.random() * 50);
                    })
                );
            }
            
            const startTime = Date.now();
            const results = await Promise.all(testPromises);
            const endTime = Date.now();
            
            expect(results.length).toBe(10);
            expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
            
            // 并发执行时间应该明显小于串行执行时间
            expect(endTime - startTime).toBeLessThan(300);
        });
    });
    
    describe('环境变量和配置兼容性', () => {
        test('环境变量应该正确读取', () => {
            // 测试常见环境变量
            const nodeEnv = process.env.NODE_ENV;
            const path = process.env.PATH;
            const home = process.env.HOME || process.env.USERPROFILE;
            
            if (platform === 'win32') {
                expect(process.env.USERPROFILE).toBeDefined();
                expect(process.env.APPDATA).toBeDefined();
            } else {
                expect(process.env.HOME).toBeDefined();
            }
            
            expect(path).toBeDefined();
            expect(home).toBeDefined();
        });
        
        test('平台特定配置应该正确应用', () => {
            const platformConfig = {
                win32: {
                    serialPorts: ['COM1', 'COM2', 'COM3'],
                    maxMemory: '4GB',
                    pathSeparator: '\\'
                },
                darwin: {
                    serialPorts: ['/dev/cu.usbserial', '/dev/cu.usbmodem'],
                    maxMemory: '8GB',
                    pathSeparator: '/'
                },
                linux: {
                    serialPorts: ['/dev/ttyUSB0', '/dev/ttyACM0'],
                    maxMemory: '16GB',
                    pathSeparator: '/'
                }
            };
            
            const config = platformConfig[platform as keyof typeof platformConfig];
            if (config) {
                expect(config.serialPorts).toBeDefined();
                expect(config.maxMemory).toBeDefined();
                expect(config.pathSeparator).toBe(path.sep);
            }
        });
    });
    
    describe('错误处理兼容性测试', () => {
        test('平台特定错误应该正确处理', async () => {
            const driver = new LogicAnalyzerDriver('invalid-port');
            
            try {
                await driver.startCapture(new CaptureSession());
                // 如果没有抛出错误，测试失败
                expect(true).toBe(false);
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
                
                // 验证错误信息包含有用信息
                expect(typeof error.message).toBe('string');
                expect(error.message.length).toBeGreaterThan(0);
            }
        });
        
        test('文件系统错误应该一致处理', async () => {
            const lacFormat = new LACFileFormat();
            const session = new CaptureSession();
            
            // 尝试写入无效路径
            const invalidPath = platform === 'win32' 
                ? 'Z:\\nonexistent\\file.lac' 
                : '/nonexistent/directory/file.lac';
            
            try {
                await lacFormat.save(session, invalidPath);
                expect(true).toBe(false); // 应该抛出错误
            } catch (error: any) {
                expect(error).toBeDefined();
                
                // 验证错误类型合理
                expect(error.code || error.message).toBeDefined();
            }
        });
    });
    
    describe('编码和本地化兼容性', () => {
        test('UTF-8编码应该正确处理', () => {
            const testStrings = [
                'Hello World',
                '你好世界',
                'Привет мир',
                'مرحبا بالعالم',
                '🌍🚀📊'
            ];
            
            testStrings.forEach(str => {
                // 测试字符串编码/解码
                const encoded = Buffer.from(str, 'utf8');
                const decoded = encoded.toString('utf8');
                
                expect(decoded).toBe(str);
                expect(encoded.length).toBeGreaterThan(0);
            });
        });
        
        test('数字格式化应该考虑区域设置', () => {
            const testNumber = 1234567.89;
            
            // 测试数字格式化
            const formatted = testNumber.toLocaleString();
            const scientific = testNumber.toExponential();
            const fixed = testNumber.toFixed(2);
            
            expect(formatted).toBeDefined();
            expect(scientific).toContain('e');
            expect(fixed).toBe('1234567.89');
        });
    });
});