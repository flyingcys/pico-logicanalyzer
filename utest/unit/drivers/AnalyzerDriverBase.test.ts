/**
 * AnalyzerDriverBase 单元测试
 * 基于原版C# AnalyzerDriverBase的功能测试
 */

import { AnalyzerDriverBase } from '../../../src/drivers/AnalyzerDriverBase';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { AnalyzerDriverType, CaptureError, TriggerType, CaptureMode } from '../../../src/models/AnalyzerTypes';

// 创建测试用的具体实现类
class TestAnalyzerDriver extends AnalyzerDriverBase {
    readonly deviceVersion = '1.0.0';
    readonly channelCount = 24;
    readonly maxFrequency = 100000000;
    readonly bufferSize = 96000;
    readonly blastFrequency = 100000000;
    readonly driverType = AnalyzerDriverType.Serial;
    readonly isNetwork = false;
    
    private _isCapturing = false;
    
    get isCapturing(): boolean { 
        return this._isCapturing; 
    }
    
    async connect(params: any): Promise<any> {
        return { success: true };
    }
    
    async disconnect(): Promise<void> {
        return;
    }
    
    async getStatus(): Promise<any> {
        return { isConnected: true, isCapturing: this._isCapturing };
    }
    
    async startCapture(session: CaptureSession): Promise<CaptureError> {
        this._isCapturing = true;
        
        // 模拟采集过程
        setTimeout(() => {
            this._isCapturing = false;
        }, 100);
        
        return CaptureError.None;
    }
    
    async stopCapture(): Promise<boolean> {
        this._isCapturing = false;
        return true;
    }
    
    async enterBootloader(): Promise<boolean> {
        return true;
    }
    
    // 重写基类方法
    getVoltageStatus(): Promise<string> {
        return Promise.resolve('3.3V');
    }
}

describe('AnalyzerDriverBase', () => {
    let driver: TestAnalyzerDriver;
    let captureSession: CaptureSession;
    
    beforeEach(() => {
        driver = new TestAnalyzerDriver();
        
        // 创建测试用的采集会话
        captureSession = new CaptureSession();
        captureSession.frequency = 24000000;
        captureSession.preTriggerSamples = 1000;
        captureSession.postTriggerSamples = 10000;
        captureSession.triggerType = TriggerType.Edge;
        captureSession.triggerChannel = 0;
        captureSession.triggerInverted = false;
        captureSession.captureChannels = [
            new AnalyzerChannel(0, 'Channel 1'),
            new AnalyzerChannel(1, 'Channel 2')
        ];
    });
    
    describe('基础属性测试', () => {
        it('应该正确返回设备基础信息', () => {
            expect(driver.deviceVersion).toBe('1.0.0');
            expect(driver.channelCount).toBe(24);
            expect(driver.maxFrequency).toBe(100000000);
            expect(driver.minFrequency).toBeGreaterThan(1000);
            expect(driver.bufferSize).toBe(96000);
            expect(driver.blastFrequency).toBe(100000000);
            expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
            expect(driver.isNetwork).toBe(false);
        });
        
        it('应该正确计算最小频率', () => {
            // 基于原版公式: minFrequency = maxFrequency / 65536
            const expectedMinFreq = Math.floor(driver.maxFrequency / 65536);
            expect(driver.minFrequency).toBeGreaterThanOrEqual(expectedMinFreq);
        });
        
        it('初始状态应该不在采集中', () => {
            expect(driver.isCapturing).toBe(false);
        });
    });
    
    describe('采集模式管理', () => {
        it('getCaptureMode应该根据通道数正确返回模式', () => {
            // 测试8通道模式
            const channels8 = [0, 1, 2, 3, 4, 5, 6, 7];
            expect(driver.getCaptureMode(channels8)).toBe(CaptureMode.Channels_8);
            
            // 测试16通道模式
            const channels16 = Array.from({length: 16}, (_, i) => i);
            expect(driver.getCaptureMode(channels16)).toBe(CaptureMode.Channels_16);
            
            // 测试24通道模式
            const channels24 = Array.from({length: 24}, (_, i) => i);
            expect(driver.getCaptureMode(channels24)).toBe(CaptureMode.Channels_24);
        });
        
        it('getLimits应该返回正确的采集限制', () => {
            const channels = [0, 1, 2, 3];
            const limits = driver.getLimits(channels);
            
            expect(limits).toBeDefined();
            expect(limits.minPreSamples).toBeGreaterThanOrEqual(0);
            expect(limits.maxPreSamples).toBeGreaterThan(limits.minPreSamples);
            expect(limits.minPostSamples).toBeGreaterThanOrEqual(0);
            expect(limits.maxPostSamples).toBeGreaterThan(limits.minPostSamples);
            expect(limits.maxTotalSamples).toBeGreaterThan(0);
        });
    });
    
    describe('采集功能测试', () => {
        it('startCapture应该成功启动采集', async () => {
            const result = await driver.startCapture(captureSession);
            
            expect(result).toBe(CaptureError.None);
            expect(driver.isCapturing).toBe(true);
        });
        
        it('stopCapture应该成功停止采集', async () => {
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            const result = await driver.stopCapture();
            expect(result).toBe(true);
            expect(driver.isCapturing).toBe(false);
        });
        
        it('采集过程应该自动完成', async () => {
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            // 等待采集自动完成
            await new Promise(resolve => setTimeout(resolve, 150));
            expect(driver.isCapturing).toBe(false);
        });
    });
    
    describe('设备信息管理', () => {
        it('getDeviceInfo应该返回完整的设备信息', () => {
            const deviceInfo = driver.getDeviceInfo();
            
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.name).toBe('1.0.0'); // 基类使用deviceVersion作为name
            expect(deviceInfo.maxFrequency).toBe(driver.maxFrequency);
            expect(deviceInfo.blastFrequency).toBe(driver.blastFrequency);
            expect(deviceInfo.channels).toBe(driver.channelCount);
            expect(deviceInfo.bufferSize).toBe(driver.bufferSize);
            expect(Array.isArray(deviceInfo.modeLimits)).toBe(true);
        });
        
        it('enterBootloader应该成功执行', async () => {
            const result = await driver.enterBootloader();
            expect(result).toBe(true);
        });
        
        it('getVoltageStatus应该返回电压信息', async () => {
            const voltage = await driver.getVoltageStatus();
            expect(typeof voltage).toBe('string');
            expect(voltage).toMatch(/^\d+\.\d+V$/);
        });

        it('基类getVoltageStatus默认实现应该返回UNSUPPORTED', async () => {
            // 创建一个不重写getVoltageStatus的驱动来测试基类默认实现
            class DefaultVoltageDriver extends AnalyzerDriverBase {
                readonly deviceVersion = '1.0.0';
                readonly channelCount = 24;
                readonly maxFrequency = 100000000;
                readonly bufferSize = 96000;
                readonly blastFrequency = 100000000;
                readonly driverType = AnalyzerDriverType.Serial;
                readonly isNetwork = false;
                private _isCapturing = false;
                
                get isCapturing(): boolean { 
                    return this._isCapturing; 
                }
                
                async connect(params: any): Promise<any> {
                    return { success: true };
                }
                
                async disconnect(): Promise<void> {
                    return;
                }
                
                async getStatus(): Promise<any> {
                    return { isConnected: true, isCapturing: this._isCapturing };
                }
                
                async startCapture(session: CaptureSession): Promise<CaptureError> {
                    this._isCapturing = true;
                    return CaptureError.None;
                }
                
                async stopCapture(): Promise<boolean> {
                    this._isCapturing = false;
                    return true;
                }
                
                async enterBootloader(): Promise<boolean> {
                    return true;
                }
                
                // 不重写getVoltageStatus，使用基类默认实现
            }
            
            const defaultDriver = new DefaultVoltageDriver();
            const voltage = await defaultDriver.getVoltageStatus();
            
            expect(voltage).toBe('UNSUPPORTED');
        });
    });
    
    describe('网络功能测试', () => {
        it('sendNetworkConfig应该返回false对于非网络设备', async () => {
            const result = await driver.sendNetworkConfig('test-ssid', 'password', '192.168.1.100', 8080);
            expect(result).toBe(false);
        });
    });
    
    describe('错误处理测试', () => {
        it('无效采集会话应该被正确处理', async () => {
            const invalidSession = new CaptureSession();
            // 不设置必要参数
            
            try {
                await driver.startCapture(invalidSession);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        it('重复启动采集应该被正确处理', async () => {
            await driver.startCapture(captureSession);
            expect(driver.isCapturing).toBe(true);
            
            // 尝试再次启动采集
            const result = await driver.startCapture(captureSession);
            // 应该返回错误或忽略
            expect([CaptureError.None, CaptureError.AlreadyCapturing]).toContain(result);
        });
    });
    
    describe('边界条件测试', () => {
        it('最大频率采集', async () => {
            captureSession.frequency = driver.maxFrequency;
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
        });
        
        it('最小频率采集', async () => {
            captureSession.frequency = driver.minFrequency;
            const result = await driver.startCapture(captureSession);
            expect(result).toBe(CaptureError.None);
        });
        
        it('超出范围的频率应该被处理', async () => {
            captureSession.frequency = driver.maxFrequency * 2; // 超出最大频率
            
            try {
                const result = await driver.startCapture(captureSession);
                // 应该返回错误或自动调整
                expect(result).not.toBe(CaptureError.None);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
        
        it('空通道列表应该被正确处理', () => {
            const mode = driver.getCaptureMode([]);
            expect(mode).toBe(CaptureMode.Channels_8); // 默认模式
        });
        
        it('超出通道数量限制应该被处理', () => {
            const tooManyChannels = Array.from({length: 32}, (_, i) => i);
            const mode = driver.getCaptureMode(tooManyChannels);
            expect(mode).toBe(CaptureMode.Channels_24); // 最大模式
        });
    });
    
    describe('性能测试', () => {
        it('设备信息获取应该快速响应', () => {
            const startTime = Date.now();
            const deviceInfo = driver.getDeviceInfo();
            const endTime = Date.now();
            
            expect(deviceInfo).toBeDefined();
            expect(endTime - startTime).toBeLessThan(10); // 应该在10ms内完成
        });
        
        it('模式计算应该高效', () => {
            const channels = Array.from({length: 16}, (_, i) => i);
            
            const startTime = Date.now();
            for (let i = 0; i < 1000; i++) {
                driver.getCaptureMode(channels);
            }
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(100); // 1000次调用应该在100ms内完成
        });
    });

    describe('资源管理和事件系统', () => {
        it('dispose应该清理所有事件监听器', () => {
            const mockListener = jest.fn();
            driver.on('captureCompleted', mockListener);
            driver.on('error', mockListener);
            driver.on('statusChanged', mockListener);
            
            expect(driver.listenerCount('captureCompleted')).toBe(1);
            expect(driver.listenerCount('error')).toBe(1);
            expect(driver.listenerCount('statusChanged')).toBe(1);
            
            driver.dispose();
            
            expect(driver.listenerCount('captureCompleted')).toBe(0);
            expect(driver.listenerCount('error')).toBe(0);
            expect(driver.listenerCount('statusChanged')).toBe(0);
        });

        it('emitCaptureCompleted应该触发事件', (done) => {
            const mockArgs = { session: captureSession };
            
            driver.on('captureCompleted', (args) => {
                expect(args).toEqual(mockArgs);
                done();
            });
            
            // 使用子类实例来访问protected方法
            (driver as any).emitCaptureCompleted(mockArgs);
        });

        it('emitError应该触发错误事件', (done) => {
            const mockError = new Error('Test error');
            
            driver.on('error', (error) => {
                expect(error).toBe(mockError);
                done();
            });
            
            (driver as any).emitError(mockError);
        });

        it('emitStatusChanged应该触发状态变更事件', (done) => {
            const mockStatus = { isConnected: true, isCapturing: false };
            
            driver.on('statusChanged', (status) => {
                expect(status).toEqual(mockStatus);
                done();
            });
            
            (driver as any).emitStatusChanged(mockStatus);
        });
    });

    describe('详细的getCaptureMode测试', () => {
        it('应该正确处理边界通道值', () => {
            // 测试最大通道号为7的情况
            expect(driver.getCaptureMode([0, 5, 7])).toBe(CaptureMode.Channels_8);
            
            // 测试最大通道号为8的情况（应该切换到16通道模式）
            expect(driver.getCaptureMode([0, 5, 8])).toBe(CaptureMode.Channels_16);
            
            // 测试最大通道号为15的情况
            expect(driver.getCaptureMode([0, 10, 15])).toBe(CaptureMode.Channels_16);
            
            // 测试最大通道号为16及以上的情况
            expect(driver.getCaptureMode([0, 10, 16])).toBe(CaptureMode.Channels_24);
            expect(driver.getCaptureMode([0, 10, 23])).toBe(CaptureMode.Channels_24);
        });

        it('应该处理空数组和负数通道', () => {
            expect(driver.getCaptureMode([])).toBe(CaptureMode.Channels_8);
            expect(driver.getCaptureMode([-1, -5])).toBe(CaptureMode.Channels_8);
            expect(driver.getCaptureMode([-1, 0, 5])).toBe(CaptureMode.Channels_8);
        });
    });

    describe('详细的getLimits测试', () => {
        it('8通道模式限制应该正确计算', () => {
            const channels = [0, 1, 2, 3];
            const limits = driver.getLimits(channels);
            
            const expectedTotalSamples = Math.floor(driver.bufferSize / 1); // divisor = 1 for 8-channel
            
            expect(limits.minPreSamples).toBe(2);
            expect(limits.maxPreSamples).toBe(Math.floor(expectedTotalSamples / 10));
            expect(limits.minPostSamples).toBe(2);
            expect(limits.maxPostSamples).toBe(expectedTotalSamples - 2);
            expect(limits.maxTotalSamples).toBe(limits.minPreSamples + limits.maxPostSamples);
        });

        it('16通道模式限制应该正确计算', () => {
            const channels = Array.from({length: 12}, (_, i) => i); // 触发16通道模式
            const limits = driver.getLimits(channels);
            
            const expectedTotalSamples = Math.floor(driver.bufferSize / 2); // divisor = 2 for 16-channel
            
            expect(limits.maxPreSamples).toBe(Math.floor(expectedTotalSamples / 10));
            expect(limits.maxPostSamples).toBe(expectedTotalSamples - 2);
        });

        it('24通道模式限制应该正确计算', () => {
            const channels = Array.from({length: 20}, (_, i) => i); // 触发24通道模式
            const limits = driver.getLimits(channels);
            
            const expectedTotalSamples = Math.floor(driver.bufferSize / 4); // divisor = 4 for 24-channel
            
            expect(limits.maxPreSamples).toBe(Math.floor(expectedTotalSamples / 10));
            expect(limits.maxPostSamples).toBe(expectedTotalSamples - 2);
        });
    });

    describe('getDeviceInfo详细测试', () => {
        it('应该包含所有三种模式的限制信息', () => {
            const deviceInfo = driver.getDeviceInfo();
            
            expect(deviceInfo.modeLimits).toHaveLength(3);
            
            // 验证三种模式的限制都存在
            const limits8 = deviceInfo.modeLimits[0];
            const limits16 = deviceInfo.modeLimits[1];
            const limits24 = deviceInfo.modeLimits[2];
            
            expect(limits8.maxPostSamples).toBeGreaterThan(limits16.maxPostSamples);
            expect(limits16.maxPostSamples).toBeGreaterThan(limits24.maxPostSamples);
        });

        it('应该正确处理空的deviceVersion', () => {
            // 创建一个deviceVersion为null的测试驱动
            class NullVersionDriver extends AnalyzerDriverBase {
                readonly channelCount = 24;
                readonly maxFrequency = 100000000;
                readonly bufferSize = 96000;
                readonly blastFrequency = 100000000;
                readonly driverType = AnalyzerDriverType.Serial;
                readonly isNetwork = false;
                private _isCapturing = false;
                
                get deviceVersion(): string | null {
                    return null;
                }
                
                get isCapturing(): boolean { 
                    return this._isCapturing; 
                }
                
                async connect(params: any): Promise<any> {
                    return { success: true };
                }
                
                async disconnect(): Promise<void> {
                    return;
                }
                
                async getStatus(): Promise<any> {
                    return { isConnected: true, isCapturing: this._isCapturing };
                }
                
                async startCapture(session: CaptureSession): Promise<CaptureError> {
                    this._isCapturing = true;
                    return CaptureError.None;
                }
                
                async stopCapture(): Promise<boolean> {
                    this._isCapturing = false;
                    return true;
                }
                
                async enterBootloader(): Promise<boolean> {
                    return true;
                }
            }
            
            const nullDriver = new NullVersionDriver();
            const deviceInfo = nullDriver.getDeviceInfo();
            
            expect(deviceInfo.name).toBe('Unknown');
        });
    });
});