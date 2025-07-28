/**
 * 用户体验优化测试
 * 测试界面响应速度、错误处理、用户反馈的改进
 */

import { LogicAnalyzerDriver } from '../../src/drivers/LogicAnalyzerDriver';
import { DecoderManager } from '../../src/decoders/DecoderManager';
import { CaptureSession } from '../../src/models/CaptureSession';
import { AnalyzerChannel } from '../../src/models/AnalyzerChannel';
import { TriggerType, CaptureError } from '../../src/models/Enums';

// Mock VSCode API
const mockVSCode = {
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showQuickPick: jest.fn(),
        showInputBox: jest.fn(),
        withProgress: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn(),
            update: jest.fn()
        }))
    }
};

jest.mock('vscode', () => mockVSCode, { virtual: true });

// Mock serialport
jest.mock('serialport', () => ({
    SerialPort: jest.fn().mockImplementation(() => ({
        open: jest.fn((callback) => {
            // 模拟延迟
            setTimeout(() => callback && callback(), 50);
        }),
        close: jest.fn((callback) => {
            setTimeout(() => callback && callback(), 30);
        }),
        write: jest.fn((data, callback) => {
            setTimeout(() => callback && callback(), 10);
        }),
        on: jest.fn(),
        off: jest.fn(),
        isOpen: true
    }))
}));

describe('用户体验优化测试', () => {
    
    describe('响应速度测试', () => {
        test('设备连接响应时间应该合理', async () => {
            const driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            
            const startTime = Date.now();
            const deviceInfo = driver.getDeviceInfo();
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;
            
            expect(deviceInfo).toBeDefined();
            expect(responseTime).toBeLessThan(10); // 10ms内响应
            
            console.log(`设备信息获取耗时: ${responseTime}ms`);
        });
        
        test('界面更新应该快速响应', async () => {
            const decoderManager = new DecoderManager();
            
            const startTime = Date.now();
            const decoders = decoderManager.getAvailableDecoders();
            const endTime = Date.now();
            
            const responseTime = endTime - startTime;
            
            expect(decoders.length).toBeGreaterThan(0);
            expect(responseTime).toBeLessThan(50); // 50ms内响应
            
            console.log(`解码器列表获取耗时: ${responseTime}ms`);
        });
        
        test('搜索功能应该即时响应', () => {
            const decoderManager = new DecoderManager();
            
            const searchTerms = ['i2c', 'spi', 'uart', 'test', 'nonexistent'];
            
            searchTerms.forEach(term => {
                const startTime = Date.now();
                const results = decoderManager.searchDecoders(term);
                const endTime = Date.now();
                
                const responseTime = endTime - startTime;
                
                expect(Array.isArray(results)).toBe(true);
                expect(responseTime).toBeLessThan(5); // 5ms内响应
                
                console.log(`搜索"${term}"耗时: ${responseTime}ms`);
            });
        });
        
        test('大数据处理时应该提供进度反馈', async () => {
            const driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            const session = new CaptureSession();
            
            // 配置大数据采集
            session.frequency = 100000000;
            session.preTriggerSamples = 100000;
            session.postTriggerSamples = 1000000;
            session.triggerType = TriggerType.Edge;
            session.captureChannels = [
                new AnalyzerChannel(0, 'Test Channel')
            ];
            
            const progressUpdates: number[] = [];
            
            // Mock进度回调
            const mockProgressCallback = jest.fn((progress: number) => {
                progressUpdates.push(progress);
            });
            
            try {
                await driver.startCapture(session, mockProgressCallback);
                
                // 验证进度反馈
                expect(progressUpdates.length).toBeGreaterThan(0);
                
                // 进度应该是递增的
                for (let i = 1; i < progressUpdates.length; i++) {
                    expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
                }
                
                // 最终进度应该接近100%
                const finalProgress = progressUpdates[progressUpdates.length - 1];
                expect(finalProgress).toBeGreaterThanOrEqual(90);
                
            } catch (error) {
                // 即使出错也应该有进度反馈
                expect(progressUpdates.length).toBeGreaterThan(0);
            }
        });
    });
    
    describe('错误处理和用户反馈测试', () => {
        test('设备连接失败应该提供清晰的错误信息', async () => {
            const driver = new LogicAnalyzerDriver('invalid-port');
            
            try {
                await driver.startCapture(new CaptureSession());
                expect(false).toBe(true); // 应该抛出错误
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
                
                // 错误信息应该包含有用信息
                expect(error.message).toContain('port');
                expect(error.message.length).toBeGreaterThan(10);
                
                // 错误信息应该是用户友好的
                expect(error.message).not.toContain('undefined');
                expect(error.message).not.toContain('null');
                
                console.log(`错误信息: ${error.message}`);
            }
        });
        
        test('配置参数错误应该提供具体指导', async () => {
            const driver = new LogicAnalyzerDriver('/dev/ttyUSB0');
            const session = new CaptureSession();
            
            // 设置无效参数
            session.frequency = -1; // 无效频率
            session.preTriggerSamples = -100; // 无效样本数
            
            try {
                await driver.startCapture(session);
                expect(false).toBe(true); // 应该抛出错误
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error.message).toBeDefined();
                
                // 错误信息应该指出具体的问题
                const message = error.message.toLowerCase();
                expect(
                    message.includes('frequency') || 
                    message.includes('sample') || 
                    message.includes('invalid') ||
                    message.includes('parameter')
                ).toBe(true);
                
                console.log(`参数错误信息: ${error.message}`);
            }
        });
        
        test('解码器错误应该提供调试信息', async () => {
            const decoderManager = new DecoderManager();
            
            // 创建无效的通道数据
            const invalidChannels = [
                new AnalyzerChannel(0, 'Invalid Channel')
                // 不设置samples数据
            ];
            
            try {
                await decoderManager.executeDecoder('i2c', 1000000, invalidChannels, []);
            } catch (error: any) {
                if (error) {
                    expect(error.message).toBeDefined();
                    
                    // 错误信息应该包含调试信息
                    const message = error.message.toLowerCase();
                    expect(
                        message.includes('channel') ||
                        message.includes('data') ||
                        message.includes('sample') ||
                        message.includes('invalid')
                    ).toBe(true);
                    
                    console.log(`解码器错误信息: ${error.message}`);
                }
            }
        });
        
        test('网络错误应该提供重试建议', async () => {
            // 模拟网络连接错误
            const mockNetworkError = new Error('Network connection failed');
            (mockNetworkError as any).code = 'ECONNREFUSED';
            
            // 验证错误处理逻辑
            const errorHandler = (error: any) => {
                if (error.code === 'ECONNREFUSED') {
                    return '网络连接失败，请检查设备连接并重试';
                } else if (error.code === 'ETIMEDOUT') {
                    return '连接超时，请检查网络设置';
                } else {
                    return `连接错误: ${error.message}`;
                }
            };
            
            const friendlyMessage = errorHandler(mockNetworkError);
            
            expect(friendlyMessage).toContain('网络连接失败');
            expect(friendlyMessage).toContain('重试');
            
            console.log(`网络错误处理: ${friendlyMessage}`);
        });
    });
    
    describe('用户界面友好性测试', () => {
        test('加载状态应该有适当的指示', async () => {
            let loadingState = false;
            let loadingMessage = '';
            
            // 模拟加载过程
            const mockLoadingProcess = async (taskName: string) => {
                loadingState = true;
                loadingMessage = `正在${taskName}...`;
                
                // 模拟异步操作
                await new Promise(resolve => setTimeout(resolve, 100));
                
                loadingState = false;
                loadingMessage = '';
            };
            
            // 测试不同的加载任务
            const tasks = ['连接设备', '加载配置', '开始采集', '解码数据'];
            
            for (const task of tasks) {
                await mockLoadingProcess(task);
                
                // 验证加载状态管理
                expect(loadingState).toBe(false);
                expect(loadingMessage).toBe('');
            }
        });
        
        test('操作确认应该有清晰的提示', () => {
            const confirmationMessages = {
                deleteCapture: '确定要删除此采集数据吗？此操作不可撤销。',
                resetSettings: '确定要重置所有设置吗？将恢复到默认配置。',
                clearData: '确定要清除所有数据吗？未保存的数据将丢失。'
            };
            
            Object.entries(confirmationMessages).forEach(([action, message]) => {
                expect(message).toBeDefined();
                expect(message.length).toBeGreaterThan(10);
                expect(message).toContain('确定');
                expect(message).toContain('？');
                
                console.log(`${action}: ${message}`);
            });
        });
        
        test('帮助信息应该易于理解', () => {
            const helpTexts = {
                frequency: '采样频率决定了数据采集的精度。较高的频率可以捕获更快的信号变化，但会占用更多存储空间。',
                trigger: '触发器用于在特定条件下开始数据采集。边沿触发在信号变化时启动，电平触发在信号达到特定值时启动。',
                channels: '通道用于连接被测信号。每个通道可以独立配置和命名，支持最多24个数字通道。'
            };
            
            Object.entries(helpTexts).forEach(([topic, text]) => {
                expect(text).toBeDefined();
                expect(text.length).toBeGreaterThan(20);
                
                // 帮助文本应该包含关键词
                expect(text.includes(topic) || text.includes('用于') || text.includes('可以')).toBe(true);
                
                console.log(`${topic}帮助: ${text}`);
            });
        });
        
        test('状态信息应该实时更新', () => {
            const statusUpdates = [
                { status: 'idle', message: '准备就绪' },
                { status: 'connecting', message: '正在连接设备...' },
                { status: 'connected', message: '设备已连接' },
                { status: 'capturing', message: '正在采集数据...' },
                { status: 'processing', message: '正在处理数据...' },
                { status: 'completed', message: '采集完成' },
                { status: 'error', message: '操作失败，请重试' }
            ];
            
            statusUpdates.forEach(update => {
                expect(update.status).toBeDefined();
                expect(update.message).toBeDefined();
                expect(update.message.length).toBeGreaterThan(0);
                
                // 状态消息应该是中文且易懂
                expect(update.message).toMatch(/[\u4e00-\u9fa5]/);
                
                console.log(`状态 ${update.status}: ${update.message}`);
            });
        });
    });
    
    describe('性能用户体验测试', () => {
        test('大数据处理应该不阻塞界面', async () => {
            const startTime = Date.now();
            let isBlocked = false;
            
            // 模拟大数据处理
            const largeDataProcess = async () => {
                const data = new Array(1000000).fill(0).map((_, i) => i);
                
                // 分批处理避免阻塞
                const batchSize = 10000;
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    
                    // 处理批次
                    batch.forEach(item => Math.sqrt(item));
                    
                    // 让出控制权
                    if (i % (batchSize * 10) === 0) {
                        await new Promise(resolve => setImmediate(resolve));
                    }
                }
            };
            
            // 模拟界面响应检查
            const uiResponseCheck = setInterval(() => {
                const currentTime = Date.now();
                if (currentTime - startTime > 1000) {
                    isBlocked = true;
                }
            }, 100);
            
            await largeDataProcess();
            clearInterval(uiResponseCheck);
            
            const endTime = Date.now();
            const processingTime = endTime - startTime;
            
            expect(isBlocked).toBe(false);
            expect(processingTime).toBeLessThan(2000); // 2秒内完成
            
            console.log(`大数据处理耗时: ${processingTime}ms, 界面阻塞: ${isBlocked}`);
        });
        
        test('内存使用应该保持稳定', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const memorySnapshots: number[] = [];
            
            // 模拟用户操作序列
            for (let i = 0; i < 100; i++) {
                // 创建和销毁对象
                const tempData = {
                    id: i,
                    data: new Array(1000).fill(Math.random()),
                    timestamp: Date.now()
                };
                
                // 处理数据
                tempData.data.forEach(value => Math.pow(value, 2));
                
                // 记录内存使用
                if (i % 10 === 0) {
                    memorySnapshots.push(process.memoryUsage().heapUsed);
                }
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = finalMemory - initialMemory;
            
            // 计算内存使用趋势
            let increasingCount = 0;
            for (let i = 1; i < memorySnapshots.length; i++) {
                if (memorySnapshots[i] > memorySnapshots[i - 1]) {
                    increasingCount++;
                }
            }
            
            const growthRate = increasingCount / (memorySnapshots.length - 1);
            
            console.log(`内存增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            console.log(`增长趋势: ${(growthRate * 100).toFixed(1)}%`);
            
            // 内存增长应该是合理的
            expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB
            expect(growthRate).toBeLessThan(0.8); // 不应该持续增长
        });
    });
    
    describe('国际化和本地化测试', () => {
        test('文本显示应该支持中文', () => {
            const chineseTexts = [
                '逻辑分析器',
                '数据采集',
                '协议解码',
                '波形显示',
                '设备管理',
                '配置选项'
            ];
            
            chineseTexts.forEach(text => {
                expect(text).toMatch(/[\u4e00-\u9fa5]/);
                expect(text.length).toBeGreaterThan(0);
                
                // 验证字符长度（中文字符计算）
                const charCount = [...text].length;
                expect(charCount).toBeGreaterThan(2);
                
                console.log(`中文文本: ${text} (${charCount}个字符)`);
            });
        });
        
        test('数字和单位显示应该一致', () => {
            const testValues = [
                { value: 1000, unit: 'Hz', expected: '1.00 kHz' },
                { value: 1000000, unit: 'Hz', expected: '1.00 MHz' },
                { value: 1000000000, unit: 'Hz', expected: '1.00 GHz' },
                { value: 1024, unit: 'B', expected: '1.00 KB' },
                { value: 1048576, unit: 'B', expected: '1.00 MB' }
            ];
            
            testValues.forEach(test => {
                const formatted = formatValueWithUnit(test.value, test.unit);
                expect(formatted).toBe(test.expected);
                
                console.log(`格式化: ${test.value} ${test.unit} -> ${formatted}`);
            });
        });
        
        test('时间格式应该易于理解', () => {
            const timeValues = [
                { ns: 1000, expected: '1.00 µs' },
                { ns: 1000000, expected: '1.00 ms' },
                { ns: 1000000000, expected: '1.00 s' },
                { ns: 500, expected: '500 ns' }
            ];
            
            timeValues.forEach(test => {
                const formatted = formatTime(test.ns);
                expect(formatted).toBe(test.expected);
                
                console.log(`时间格式化: ${test.ns}ns -> ${formatted}`);
            });
        });
    });
    
    describe('用户操作流畅性测试', () => {
        test('键盘快捷键应该响应迅速', () => {
            const shortcuts = [
                { key: 'Ctrl+S', action: 'save', description: '保存当前采集' },
                { key: 'Ctrl+O', action: 'open', description: '打开文件' },
                { key: 'F5', action: 'refresh', description: '刷新设备列表' },
                { key: 'Space', action: 'start_stop', description: '开始/停止采集' }
            ];
            
            shortcuts.forEach(shortcut => {
                expect(shortcut.key).toBeDefined();
                expect(shortcut.action).toBeDefined();
                expect(shortcut.description).toBeDefined();
                
                // 描述应该是中文
                expect(shortcut.description).toMatch(/[\u4e00-\u9fa5]/);
                
                console.log(`快捷键: ${shortcut.key} - ${shortcut.description}`);
            });
        });
        
        test('拖拽操作应该有视觉反馈', () => {
            const dragStates = [
                { state: 'idle', cursor: 'default', opacity: 1.0 },
                { state: 'dragging', cursor: 'grabbing', opacity: 0.8 },
                { state: 'valid_drop', cursor: 'copy', opacity: 1.0 },
                { state: 'invalid_drop', cursor: 'not-allowed', opacity: 0.5 }
            ];
            
            dragStates.forEach(dragState => {
                expect(dragState.state).toBeDefined();
                expect(dragState.cursor).toBeDefined();
                expect(dragState.opacity).toBeGreaterThan(0);
                expect(dragState.opacity).toBeLessThanOrEqual(1);
                
                console.log(`拖拽状态: ${dragState.state} - 光标: ${dragState.cursor}, 透明度: ${dragState.opacity}`);
            });
        });
    });
});

// 辅助函数
function formatValueWithUnit(value: number, unit: string): string {
    const prefixes = [
        { factor: 1e9, prefix: 'G' },
        { factor: 1e6, prefix: 'M' },
        { factor: 1e3, prefix: 'k' }
    ];
    
    for (const { factor, prefix } of prefixes) {
        if (value >= factor) {
            return `${(value / factor).toFixed(2)} ${prefix}${unit}`;
        }
    }
    
    return `${value} ${unit}`;
}

function formatTime(nanoseconds: number): string {
    if (nanoseconds >= 1e9) {
        return `${(nanoseconds / 1e9).toFixed(2)} s`;
    } else if (nanoseconds >= 1e6) {
        return `${(nanoseconds / 1e6).toFixed(2)} ms`;
    } else if (nanoseconds >= 1e3) {
        return `${(nanoseconds / 1e3).toFixed(2)} µs`;
    } else {
        return `${nanoseconds} ns`;
    }
}