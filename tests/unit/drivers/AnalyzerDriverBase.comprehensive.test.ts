/**
 * AnalyzerDriverBase 精准业务逻辑测试
 * 
 * 基于深度思考方法论和Drivers层突破成功经验:
 * - 专注测试@src源码真实业务逻辑，不偏移方向
 * - 最小化Mock使用，验证核心抽象类算法
 * - 应用错误驱动学习，发现真实接口行为
 * - 系统性覆盖4大核心组件：AnalyzerDriverBase + OutputPacket + CaptureRequest + NetConfig
 * 
 * 目标: 基于MultiAnalyzerDriver和NetworkLogicAnalyzerDriver成功经验
 * 将AnalyzerDriverBase覆盖率从52.08%提升，实现Drivers层进一步突破
 */

import { AnalyzerDriverBase, OutputPacket, CaptureRequest, NetConfig } from '../../../src/drivers/AnalyzerDriverBase';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureMode,
  TriggerType,
  CaptureSession,
  AnalyzerChannel,
  CaptureConfiguration,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus,
  CaptureEventArgs,
  CaptureCompletedHandler
} from '../../../src/models/AnalyzerTypes';

const asciiTrim = (bytes: Uint8Array): string => Buffer.from(bytes).toString('ascii').replace(/\0+$/, '');

// 创建具体实现用于测试抽象类
class ConcreteAnalyzerDriver extends AnalyzerDriverBase {
  private _deviceVersion: string | null = 'TestDriver-v1.2.3';
  private _channelCount: number = 24;
  private _maxFrequency: number = 100000000; // 100MHz
  private _blastFrequency: number = 200000000; // 200MHz  
  private _bufferSize: number = 24000;
  private _isCapturing: boolean = false;

  get deviceVersion(): string | null { return this._deviceVersion; }
  get channelCount(): number { return this._channelCount; }
  get maxFrequency(): number { return this._maxFrequency; }
  get blastFrequency(): number { return this._blastFrequency; }
  get bufferSize(): number { return this._bufferSize; }
  get isNetwork(): boolean { return false; }
  get isCapturing(): boolean { return this._isCapturing; }
  get driverType(): AnalyzerDriverType { return AnalyzerDriverType.Serial; }

  // 设置方法，用于测试不同配置
  setDeviceProperties(options: {
    deviceVersion?: string | null;
    channelCount?: number;
    maxFrequency?: number;
    blastFrequency?: number;
    bufferSize?: number;
  }): void {
    if (options.deviceVersion !== undefined) this._deviceVersion = options.deviceVersion;
    if (options.channelCount !== undefined) this._channelCount = options.channelCount;
    if (options.maxFrequency !== undefined) this._maxFrequency = options.maxFrequency;
    if (options.blastFrequency !== undefined) this._blastFrequency = options.blastFrequency;
    if (options.bufferSize !== undefined) this._bufferSize = options.bufferSize;
  }

  setCapturingState(capturing: boolean): void {
    this._isCapturing = capturing;
  }

  // 抽象方法的简单实现
  async startCapture(session: CaptureSession, handler?: CaptureCompletedHandler): Promise<CaptureError> {
    this._isCapturing = true;
    // 模拟异步操作
    setTimeout(() => {
      const eventArgs: CaptureEventArgs = { success: true, session };
      if (handler) handler(eventArgs);
      this.emitCaptureCompleted(eventArgs);
      this._isCapturing = false;
    }, 10);
    return CaptureError.None;
  }

  async stopCapture(): Promise<boolean> {
    this._isCapturing = false;
    return true;
  }

  async enterBootloader(): Promise<boolean> {
    return true;
  }

  async connect(params: ConnectionParams): Promise<ConnectionResult> {
    return { success: true };
  }

  async disconnect(): Promise<void> {
    // 简单实现
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      isConnected: true,
      isCapturing: this._isCapturing,
      batteryVoltage: '3.3V'
    };
  }
}

describe('AnalyzerDriverBase 精准业务逻辑测试', () => {
  let driver: ConcreteAnalyzerDriver;

  // 创建测试用的真实采集会话数据
  const createTestSession = (overrides: Partial<CaptureSession> = {}): CaptureSession => ({
    frequency: 1000000,
    preTriggerSamples: 1000,
    postTriggerSamples: 1000,
    triggerType: TriggerType.Complex,
    triggerChannel: 0,
    triggerInverted: false,
    loopCount: 1,
    measureBursts: false,
    captureChannels: [
      createTestChannel(0),
      createTestChannel(1),
      createTestChannel(15),
      createTestChannel(23)
    ],
    get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
    clone() { return { ...this }; },
    cloneSettings() { return { ...this }; },
    ...overrides
  });

  // 创建测试通道
  const createTestChannel = (channelNumber: number): AnalyzerChannel => ({
    channelNumber,
    channelName: `Channel ${channelNumber}`,
    textualChannelNumber: channelNumber.toString(),
    hidden: false,
    channelColor: 0xFF0000,
    enabled: true,
    minimized: false,
    clone() { return { ...this }; }
  });

  beforeEach(() => {
    driver = new ConcreteAnalyzerDriver();
  });

  describe('AnalyzerDriverBase 抽象类核心属性和方法', () => {
    it('应该正确实现所有抽象属性', () => {
      expect(driver.deviceVersion).toBe('TestDriver-v1.2.3');
      expect(driver.channelCount).toBe(24);
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(200000000);
      expect(driver.bufferSize).toBe(24000);
      expect(driver.isNetwork).toBe(false);
      expect(driver.isCapturing).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该正确计算minFrequency属性', () => {
      // minFrequency = Math.floor((maxFrequency * 2) / 65535)
      const expectedMinFreq = Math.floor((100000000 * 2) / 65535);
      expect(driver.minFrequency).toBe(expectedMinFreq);
    });

    it('应该支持tag可选属性', () => {
      expect(driver.tag).toBeUndefined();
      
      driver.tag = 'test-tag';
      expect(driver.tag).toBe('test-tag');
      
      driver.tag = { id: 123, name: 'test' };
      expect(driver.tag).toEqual({ id: 123, name: 'test' });
    });

    it('应该正确处理不同的设备配置', () => {
      driver.setDeviceProperties({
        deviceVersion: 'CustomDriver-v2.0',
        channelCount: 16,
        maxFrequency: 50000000,
        bufferSize: 16000
      });

      expect(driver.deviceVersion).toBe('CustomDriver-v2.0');
      expect(driver.channelCount).toBe(16);
      expect(driver.maxFrequency).toBe(50000000);
      expect(driver.bufferSize).toBe(16000);
      
      // minFrequency应该根据新的maxFrequency重新计算
      const expectedMinFreq = Math.floor((50000000 * 2) / 65535);
      expect(driver.minFrequency).toBe(expectedMinFreq);
    });
  });

  describe('getCaptureMode 通道模式计算核心算法', () => {
    it('应该正确识别8通道模式', () => {
      const channels8 = [0, 1, 2, 3, 4, 5, 6, 7];
      expect(driver.getCaptureMode(channels8)).toBe(CaptureMode.Channels_8);
      
      const channelsPartial = [0, 2, 5];
      expect(driver.getCaptureMode(channelsPartial)).toBe(CaptureMode.Channels_8);
      
      const channelsMax7 = [7];
      expect(driver.getCaptureMode(channelsMax7)).toBe(CaptureMode.Channels_8);
    });

    it('应该正确识别16通道模式', () => {
      const channels16 = [0, 5, 8, 12, 15];
      expect(driver.getCaptureMode(channels16)).toBe(CaptureMode.Channels_16);
      
      const channelsMax15 = [15];
      expect(driver.getCaptureMode(channelsMax15)).toBe(CaptureMode.Channels_16);
      
      const channelsMin8 = [8];
      expect(driver.getCaptureMode(channelsMin8)).toBe(CaptureMode.Channels_16);
    });

    it('应该正确识别24通道模式', () => {
      const channels24 = [0, 8, 16, 20, 23];
      expect(driver.getCaptureMode(channels24)).toBe(CaptureMode.Channels_24);
      
      const channelsMax23 = [23];
      expect(driver.getCaptureMode(channelsMax23)).toBe(CaptureMode.Channels_24);
      
      const channelsMin16 = [16];
      expect(driver.getCaptureMode(channelsMin16)).toBe(CaptureMode.Channels_24);
    });

    it('应该处理空通道列表', () => {
      const emptyChannels: number[] = [];
      expect(driver.getCaptureMode(emptyChannels)).toBe(CaptureMode.Channels_8);
    });

    it('应该处理通道数组中的极值', () => {
      const channelsWithNegative = [-1, 5, 10];
      expect(driver.getCaptureMode(channelsWithNegative)).toBe(CaptureMode.Channels_16);
      
      const channelsLarge = [0, 100]; // 超出范围的通道
      expect(driver.getCaptureMode(channelsLarge)).toBe(CaptureMode.Channels_24);
    });
  });

  describe('getLimits 采集限制计算核心算法', () => {
    it('应该正确计算8通道模式的限制', () => {
      const channels = [0, 1, 2, 3];
      const limits = driver.getLimits(channels);
      
      // divisor = 1 for Channels_8, totalSamples = 24000 / 1 = 24000
      expect(limits.minPreSamples).toBe(2);
      expect(limits.maxPreSamples).toBe(2400); // totalSamples / 10
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPostSamples).toBe(23998); // totalSamples - 2
      expect(limits.maxTotalSamples).toBe(24000); // minPreSamples + maxPostSamples
    });

    it('应该正确计算16通道模式的限制', () => {
      const channels = [0, 8, 15];
      const limits = driver.getLimits(channels);
      
      // divisor = 2 for Channels_16, totalSamples = 24000 / 2 = 12000
      expect(limits.minPreSamples).toBe(2);
      expect(limits.maxPreSamples).toBe(1200); // totalSamples / 10
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPostSamples).toBe(11998); // totalSamples - 2
      expect(limits.maxTotalSamples).toBe(12000);
    });

    it('应该正确计算24通道模式的限制', () => {
      const channels = [0, 16, 23];
      const limits = driver.getLimits(channels);
      
      // divisor = 4 for Channels_24, totalSamples = 24000 / 4 = 6000
      expect(limits.minPreSamples).toBe(2);
      expect(limits.maxPreSamples).toBe(600); // totalSamples / 10
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxPostSamples).toBe(5998); // totalSamples - 2
      expect(limits.maxTotalSamples).toBe(6000);
    });

    it('应该根据不同缓冲区大小调整限制', () => {
      driver.setDeviceProperties({ bufferSize: 48000 });
      
      const channels = [0, 1, 2]; // 8通道模式
      const limits = driver.getLimits(channels);
      
      // totalSamples = 48000 / 1 = 48000
      expect(limits.maxPreSamples).toBe(4800); // 48000 / 10
      expect(limits.maxPostSamples).toBe(47998); // 48000 - 2
      expect(limits.maxTotalSamples).toBe(48000);
    });

    it('应该验证maxTotalSamples getter的正确性', () => {
      const channels = [0, 1];
      const limits = driver.getLimits(channels);
      
      // 验证getter函数计算
      const expectedTotal = limits.minPreSamples + limits.maxPostSamples;
      expect(limits.maxTotalSamples).toBe(expectedTotal);
    });
  });

  describe('getDeviceInfo 设备信息构建核心算法', () => {
    it('应该构建完整的设备信息', () => {
      const deviceInfo = driver.getDeviceInfo();
      
      expect(deviceInfo.name).toBe('TestDriver-v1.2.3');
      expect(deviceInfo.maxFrequency).toBe(100000000);
      expect(deviceInfo.blastFrequency).toBe(200000000);
      expect(deviceInfo.channels).toBe(24);
      expect(deviceInfo.bufferSize).toBe(24000);
      expect(deviceInfo.modeLimits).toHaveLength(3); // 8, 16, 24通道模式
    });

    it('应该为所有通道模式生成正确的限制信息', () => {
      const deviceInfo = driver.getDeviceInfo();
      const [limits8, limits16, limits24] = deviceInfo.modeLimits;
      
      // 8通道模式限制 (divisor=1)
      expect(limits8.maxPreSamples).toBe(2400); // 24000/10
      expect(limits8.maxPostSamples).toBe(23998); // 24000-2
      
      // 16通道模式限制 (divisor=2) 
      expect(limits16.maxPreSamples).toBe(1200); // 12000/10
      expect(limits16.maxPostSamples).toBe(11998); // 12000-2
      
      // 24通道模式限制 (divisor=4)
      expect(limits24.maxPreSamples).toBe(600); // 6000/10
      expect(limits24.maxPostSamples).toBe(5998); // 6000-2
    });

    it('应该处理null设备版本', () => {
      driver.setDeviceProperties({ deviceVersion: null });
      
      const deviceInfo = driver.getDeviceInfo();
      expect(deviceInfo.name).toBe('Unknown');
    });

    it('应该根据设备配置变化更新设备信息', () => {
      driver.setDeviceProperties({
        deviceVersion: 'AdvancedDriver-v3.0',
        maxFrequency: 200000000,
        blastFrequency: 400000000,
        channelCount: 16,
        bufferSize: 32000
      });

      const deviceInfo = driver.getDeviceInfo();
      
      expect(deviceInfo.name).toBe('AdvancedDriver-v3.0');
      expect(deviceInfo.maxFrequency).toBe(200000000);
      expect(deviceInfo.blastFrequency).toBe(400000000);
      expect(deviceInfo.channels).toBe(16);
      expect(deviceInfo.bufferSize).toBe(32000);
    });
  });

  describe('网络方法默认实现', () => {
    it('应该返回默认的电压状态', async () => {
      const voltage = await driver.getVoltageStatus();
      expect(voltage).toBe('UNSUPPORTED');
    });

    it('应该返回默认的网络配置结果', async () => {
      const result = await driver.sendNetworkConfig('test-ap', 'password', '192.168.1.1', 8080);
      expect(result).toBe(false);
    });
  });

  describe('事件系统和生命周期管理', () => {
    it('应该正确触发captureCompleted事件', (done) => {
      const testSession = createTestSession();
      const expectedArgs: CaptureEventArgs = { success: true, session: testSession };
      
      driver.on('captureCompleted', (args: CaptureEventArgs) => {
        expect(args.success).toBe(true);
        expect(args.session).toBe(testSession);
        done();
      });

      driver.startCapture(testSession);
    });

    it('应该正确触发error事件', (done) => {
      const testError = new Error('Test error');
      
      driver.on('error', (error: Error) => {
        expect(error).toBe(testError);
        expect(error.message).toBe('Test error');
        done();
      });

      // 使用protected方法触发错误事件
      (driver as any).emitError(testError);
    });

    it('应该正确触发statusChanged事件', (done) => {
      const testStatus: DeviceStatus = {
        isConnected: true,
        isCapturing: false,
        batteryVoltage: '4.2V'
      };
      
      driver.on('statusChanged', (status: DeviceStatus) => {
        expect(status).toBe(testStatus);
        expect(status.batteryVoltage).toBe('4.2V');
        done();
      });

      // 使用protected方法触发状态变化事件
      (driver as any).emitStatusChanged(testStatus);
    });

    it('应该正确清理所有事件监听器', () => {
      let captureEventCount = 0;
      let errorEventCount = 0;
      
      driver.on('captureCompleted', () => { captureEventCount++; });
      driver.on('error', () => { errorEventCount++; });
      
      // 验证事件监听器已添加
      expect(driver.listenerCount('captureCompleted')).toBe(1);
      expect(driver.listenerCount('error')).toBe(1);
      
      // 调用dispose清理
      driver.dispose();
      
      // 验证所有监听器已被移除
      expect(driver.listenerCount('captureCompleted')).toBe(0);
      expect(driver.listenerCount('error')).toBe(0);
    });
  });

  describe('采集流程集成验证', () => {
    it('应该正确处理完整的采集流程', async () => {
      const testSession = createTestSession();
      let captureCompleted = false;
      
      driver.on('captureCompleted', (args: CaptureEventArgs) => {
        captureCompleted = true;
        expect(args.success).toBe(true);
        expect(args.session).toBe(testSession);
      });

      expect(driver.isCapturing).toBe(false);
      
      const result = await driver.startCapture(testSession);
      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);
      
      // 等待异步事件完成
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(captureCompleted).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });

    it('应该支持采集处理器回调', (done) => {
      const testSession = createTestSession();
      
      const handler: CaptureCompletedHandler = (args: CaptureEventArgs) => {
        expect(args.success).toBe(true);
        expect(args.session).toBe(testSession);
        done();
      };

      driver.startCapture(testSession, handler);
    });
  });
});

describe('OutputPacket 数据包处理核心算法', () => {
  let packet: OutputPacket;

  beforeEach(() => {
    packet = new OutputPacket();
  });

  describe('基础数据添加功能', () => {
    it('应该正确添加单个字节', () => {
      packet.addByte(0x42);
      packet.addByte(0xFF);
      packet.addByte(0x00);

      const serialized = packet.serialize();
      // 起始标记(2) + 数据(3) + 结束标记(2) = 7字节
      expect(serialized.length).toBe(7);
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[2]).toBe(0x42);
      expect(serialized[3]).toBe(0xFF);
      expect(serialized[4]).toBe(0x00);
      expect(serialized[5]).toBe(0xAA);
      expect(serialized[6]).toBe(0x55);
    });

    it('应该正确处理字节值溢出', () => {
      packet.addByte(256); // 超出byte范围，应该被截取为0
      packet.addByte(257); // 应该被截取为1
      packet.addByte(-1);  // 应该被截取为255

      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0x00); // 256 & 0xFF = 0
      expect(serialized[3]).toBe(0x01); // 257 & 0xFF = 1  
      expect(serialized[4]).toBe(0xFF); // -1 & 0xFF = 255
    });

    it('应该正确添加字节数组', () => {
      const data = [0x10, 0x20, 0x30];
      packet.addBytes(data);

      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0x10);
      expect(serialized[3]).toBe(0x20);
      expect(serialized[4]).toBe(0x30);
    });

    it('应该正确添加Uint8Array', () => {
      const data = new Uint8Array([0xA0, 0xB0, 0xC0]);
      packet.addBytes(data);

      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0xA0);
      expect(serialized[3]).toBe(0xB0);
      expect(serialized[4]).toBe(0xC0);
    });

    it('应该正确添加ASCII字符串', () => {
      packet.addString('ABC');

      const serialized = packet.serialize();
      expect(serialized[2]).toBe(65);  // 'A'
      expect(serialized[3]).toBe(66);  // 'B'
      expect(serialized[4]).toBe(67);  // 'C'
    });

    it('应该支持清空数据缓冲区', () => {
      packet.addByte(0x42);
      packet.addString('test');
      
      let serialized = packet.serialize();
      expect(serialized.length).toBeGreaterThan(2); // 有数据
      
      packet.clear();
      serialized = packet.serialize();
      expect(serialized.length).toBe(4); // 只有起始和结束标记
    });
  });

  describe('转义机制核心算法验证', () => {
    it('应该正确转义0xAA字节', () => {
      packet.addByte(0xAA);

      const serialized = packet.serialize();
      // 起始: 0x55 0xAA, 转义数据: 0xF0 0x5A (0xAA ^ 0xF0), 结束: 0xAA 0x55
      expect(serialized.length).toBe(6);
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      expect(serialized[2]).toBe(0xF0);
      expect(serialized[3]).toBe(0x5A); // 0xAA ^ 0xF0 = 0x5A
      expect(serialized[4]).toBe(0xAA);
      expect(serialized[5]).toBe(0x55);
    });

    it('应该正确转义0x55字节', () => {
      packet.addByte(0x55);

      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0xF0);
      expect(serialized[3]).toBe(0xA5); // 0x55 ^ 0xF0 = 0xA5
    });

    it('应该正确转义0xF0字节', () => {
      packet.addByte(0xF0);

      const serialized = packet.serialize();
      expect(serialized[2]).toBe(0xF0);
      expect(serialized[3]).toBe(0x00); // 0xF0 ^ 0xF0 = 0x00
    });

    it('应该正确处理多个需要转义的字节', () => {
      packet.addByte(0xAA);
      packet.addByte(0x42); // 不需要转义
      packet.addByte(0x55);
      packet.addByte(0xF0);

      const serialized = packet.serialize();
      // 起始标记: 2字节
      // 0xAA转义: 2字节 (0xF0 0x5A)
      // 0x42普通: 1字节
      // 0x55转义: 2字节 (0xF0 0xA5)
      // 0xF0转义: 2字节 (0xF0 0x00)
      // 结束标记: 2字节
      // 总计: 11字节
      expect(serialized.length).toBe(11);
      
      let offset = 2; // 跳过起始标记
      expect(serialized[offset++]).toBe(0xF0);
      expect(serialized[offset++]).toBe(0x5A); // 0xAA转义
      expect(serialized[offset++]).toBe(0x42); // 普通字节
      expect(serialized[offset++]).toBe(0xF0);
      expect(serialized[offset++]).toBe(0xA5); // 0x55转义
      expect(serialized[offset++]).toBe(0xF0);
      expect(serialized[offset++]).toBe(0x00); // 0xF0转义
    });

    it('应该处理不需要转义的普通数据', () => {
      const normalData = [0x01, 0x02, 0x10, 0x20, 0x30, 0xFE];
      packet.addBytes(normalData);

      const serialized = packet.serialize();
      // 起始标记(2) + 普通数据(6) + 结束标记(2) = 10字节
      expect(serialized.length).toBe(10);
      
      for (let i = 0; i < normalData.length; i++) {
        expect(serialized[i + 2]).toBe(normalData[i]);
      }
    });
  });

  describe('结构体序列化功能', () => {
    it('应该正确序列化实现serialize方法的结构体', () => {
      const mockStruct = {
        serialize(): Uint8Array {
          return new Uint8Array([0x10, 0x20, 0x30]);
        }
      };

      packet.addStruct(mockStruct);
      const serialized = packet.serialize();
      
      expect(serialized[2]).toBe(0x10);
      expect(serialized[3]).toBe(0x20);
      expect(serialized[4]).toBe(0x30);
    });

    it('应该处理空结构体序列化结果', () => {
      const emptyStruct = {
        serialize(): Uint8Array {
          return new Uint8Array(0);
        }
      };

      expect(() => {
        packet.addStruct(emptyStruct);
      }).not.toThrow();

      const serialized = packet.serialize();
      expect(serialized.length).toBe(4); // 只有起始和结束标记
    });

    it('应该拒绝null或undefined结构体', () => {
      expect(() => {
        packet.addStruct(null);
      }).toThrow('结构体不能为null或undefined');

      expect(() => {
        packet.addStruct(undefined);
      }).toThrow('结构体不能为null或undefined');
    });

    it('应该拒绝没有serialize方法的结构体', () => {
      const invalidStruct = { data: 'test' };

      expect(() => {
        packet.addStruct(invalidStruct);
      }).toThrow('结构体必须实现serialize方法');
    });

    it('应该拒绝serialize方法返回非Uint8Array的结构体', () => {
      const invalidStruct = {
        serialize(): string {
          return 'invalid';
        }
      };

      expect(() => {
        packet.addStruct(invalidStruct);
      }).toThrow('结构体serialize方法必须返回Uint8Array');
    });
  });

  describe('复杂数据包构建验证', () => {
    it('应该正确构建包含多种数据类型的数据包', () => {
      packet.addByte(0x01);
      packet.addString('TEST');
      packet.addBytes([0xAA, 0x55]); // 需要转义的数据
      packet.addByte(0xFF);

      const serialized = packet.serialize();
      
      // 验证起始标记
      expect(serialized[0]).toBe(0x55);
      expect(serialized[1]).toBe(0xAA);
      
      let offset = 2;
      expect(serialized[offset++]).toBe(0x01);
      expect(serialized[offset++]).toBe(84);   // 'T'
      expect(serialized[offset++]).toBe(69);   // 'E'
      expect(serialized[offset++]).toBe(83);   // 'S'  
      expect(serialized[offset++]).toBe(84);   // 'T'
      expect(serialized[offset++]).toBe(0xF0); // 0xAA转义前缀
      expect(serialized[offset++]).toBe(0x5A); // 0xAA转义值
      expect(serialized[offset++]).toBe(0xF0); // 0x55转义前缀
      expect(serialized[offset++]).toBe(0xA5); // 0x55转义值
      expect(serialized[offset++]).toBe(0xFF);

      // 验证结束标记
      expect(serialized[offset++]).toBe(0xAA);
      expect(serialized[offset++]).toBe(0x55);
    });
  });
});

describe('CaptureRequest 采集请求结构核心算法', () => {
  describe('构造函数和基本属性', () => {
    it('应该正确初始化默认值', () => {
      const request = new CaptureRequest();
      
      expect(request.triggerType).toBe(0);
      expect(request.trigger).toBe(0);
      expect(request.invertedOrCount).toBe(0);
      expect(request.triggerValue).toBe(0);
      expect(request.channelCount).toBe(0);
      expect(request.frequency).toBe(0);
      expect(request.preSamples).toBe(0);
      expect(request.postSamples).toBe(0);
      expect(request.loopCount).toBe(0);
      expect(request.measure).toBe(0);
      expect(request.captureMode).toBe(0);
      expect(request.channels).toBeInstanceOf(Uint8Array);
      expect(request.channels.length).toBe(24);
    });
  });

  describe('fromConfiguration 静态工厂方法', () => {
    it('应该正确从配置创建采集请求', () => {
      const config: CaptureConfiguration = {
        triggerType: TriggerType.Complex,
        triggerChannel: 5,
        triggerInverted: true,
        triggerPattern: 0xABCD,
        captureChannels: [0, 5, 15, 23],
        frequency: 10000000,
        preTriggerSamples: 1000,
        postTriggerSamples: 2000,
        loopCount: 3,
        measureBursts: true,
        captureMode: CaptureMode.Channels_16
      };

      const request = CaptureRequest.fromConfiguration(config);
      
      expect(request.triggerType).toBe(TriggerType.Complex);
      expect(request.trigger).toBe(5);
      expect(request.invertedOrCount).toBe(1); // true -> 1
      expect(request.triggerValue).toBe(0xABCD);
      expect(request.channelCount).toBe(4);
      expect(request.frequency).toBe(10000000);
      expect(request.preSamples).toBe(1000);
      expect(request.postSamples).toBe(2000);
      expect(request.loopCount).toBe(3);
      expect(request.measure).toBe(1); // true -> 1
      expect(request.captureMode).toBe(CaptureMode.Channels_16);
    });

    it('应该正确设置通道数组', () => {
      const config: CaptureConfiguration = {
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        captureChannels: [1, 5, 10, 20],
        frequency: 5000000,
        preTriggerSamples: 500,
        postTriggerSamples: 1500,
        loopCount: 1,
        measureBursts: false
      };

      const request = CaptureRequest.fromConfiguration(config);
      
      // C# 固件协议要求通道数组写入捕获通道号列表，不是 bit mask。
      expect(Array.from(request.channels.slice(0, 4))).toEqual([1, 5, 10, 20]);
      expect(Array.from(request.channels.slice(4))).toEqual(new Array(20).fill(0));
    });

    it('应该处理边界情况的通道索引', () => {
      const config: CaptureConfiguration = {
        triggerType: TriggerType.Edge,
        triggerChannel: 0,
        triggerInverted: false,
        captureChannels: [-1, 0, 23, 24, 100], // 包含无效索引
        frequency: 1000000,
        preTriggerSamples: 100,
        postTriggerSamples: 900,
        loopCount: 1,
        measureBursts: false
      };

      const request = CaptureRequest.fromConfiguration(config);
      
      // 有效通道保留在原始位置，无效索引保持为0，不再作为 bit mask 写入。
      expect(Array.from(request.channels.slice(0, 5))).toEqual([0, 0, 23, 0, 0]);
      expect(request.channelCount).toBe(5); // 所有提供的通道都被计数，包括无效的
    });

    it('应该处理缺失的可选参数', () => {
      const config: CaptureConfiguration = {
        triggerType: TriggerType.Edge,
        triggerChannel: 2,
        triggerInverted: false,
        captureChannels: [0, 1],
        frequency: 8000000,
        preTriggerSamples: 800,
        postTriggerSamples: 1200,
        loopCount: 1,
        measureBursts: false
        // 缺少triggerPattern和captureMode
      };

      const request = CaptureRequest.fromConfiguration(config);
      
      expect(request.triggerValue).toBe(0); // triggerPattern默认值
      expect(request.captureMode).toBe(CaptureMode.Channels_8); // 默认值
    });
  });

  describe('序列化核心算法验证', () => {
    it('应该生成正确大小的字节数组', () => {
      const request = new CaptureRequest();
      const serialized = request.serialize();
      
      // 验证结构体大小：45字节
      expect(serialized.length).toBe(45);
    });

    it('应该正确序列化所有字段的字节布局', () => {
      const request = new CaptureRequest();
      request.triggerType = 0x12;
      request.trigger = 0x34;
      request.invertedOrCount = 0x56;
      request.triggerValue = 0xABCD;
      request.channelCount = 8;
      request.frequency = 0x12345678;
      request.preSamples = 0x87654321;
      request.postSamples = 0xFEDCBA98;
      request.loopCount = 0x9A;
      request.measure = 0xBC;
      request.captureMode = 0xDE;
      
      // 设置通道数据
      request.channels[0] = 0x11;
      request.channels[1] = 0x22;
      request.channels[23] = 0x33;

      const serialized = request.serialize();
      const view = new DataView(serialized.buffer);
      
      let offset = 0;
      expect(view.getUint8(offset++)).toBe(0x12); // triggerType
      expect(view.getUint8(offset++)).toBe(0x34); // trigger
      expect(view.getUint8(offset++)).toBe(0x56); // invertedOrCount
      expect(view.getUint16(offset, true)).toBe(0xABCD); // triggerValue (little-endian)
      offset += 2;
      
      // 验证通道数组
      expect(view.getUint8(offset)).toBe(0x11); // channels[0]
      expect(view.getUint8(offset + 1)).toBe(0x22); // channels[1]
      expect(view.getUint8(offset + 23)).toBe(0x33); // channels[23]
      offset += 24;
      
      expect(view.getUint8(offset++)).toBe(8); // channelCount
      expect(view.getUint32(offset, true)).toBe(0x12345678); // frequency (little-endian)
      offset += 4;
      expect(view.getUint32(offset, true)).toBe(0x87654321); // preSamples (little-endian)
      offset += 4;
      expect(view.getUint32(offset, true)).toBe(0xFEDCBA98); // postSamples (little-endian)
      offset += 4;
      expect(view.getUint8(offset++)).toBe(0x9A); // loopCount
      expect(view.getUint8(offset++)).toBe(0xBC); // measure
      expect(view.getUint8(offset++)).toBe(0xDE); // captureMode
      
      expect(offset).toBe(45); // 验证总大小
    });

    it('应该正确处理字节溢出截断', () => {
      const request = new CaptureRequest();
      request.triggerType = 256; // 溢出，应该截断为0
      request.trigger = 511;     // 溢出，应该截断为255
      request.channelCount = 300; // 溢出，应该截断为44
      
      const serialized = request.serialize();
      const view = new DataView(serialized.buffer);
      
      expect(view.getUint8(0)).toBe(0);   // 256 & 0xFF
      expect(view.getUint8(1)).toBe(255); // 511 & 0xFF
      expect(view.getUint8(29)).toBe(44); // 300 & 0xFF (offset 29 = channelCount位置)
    });

    it('应该正确处理little-endian字节序', () => {
      const request = new CaptureRequest();
      request.triggerValue = 0x1234;
      request.frequency = 0x12345678;
      
      const serialized = request.serialize();
      const view = new DataView(serialized.buffer);
      
      // triggerValue (offset 3-4) - little-endian
      expect(view.getUint8(3)).toBe(0x34); // 低字节
      expect(view.getUint8(4)).toBe(0x12); // 高字节
      
      // frequency (offset 30-33) - little-endian  
      expect(view.getUint8(30)).toBe(0x78); // 最低字节
      expect(view.getUint8(31)).toBe(0x56);
      expect(view.getUint8(32)).toBe(0x34);
      expect(view.getUint8(33)).toBe(0x12); // 最高字节
    });

    it('应该确保与C#版本的精确兼容性', () => {
      // 创建一个典型的采集请求，验证结构布局
      const request = new CaptureRequest();
      request.triggerType = TriggerType.Complex;
      request.trigger = 5;
      request.invertedOrCount = 1;
      request.triggerValue = 0x00FF;
      request.channelCount = 4;
      request.frequency = 25000000;
      request.preSamples = 1000;
      request.postSamples = 4000;
      request.loopCount = 1;
      request.measure = 0;
      request.captureMode = CaptureMode.Channels_8;
      
      request.channels[0] = 1;
      request.channels[5] = 1;
      request.channels[10] = 1;
      request.channels[15] = 1;

      const serialized = request.serialize();
      
      // 验证关键字段的位置和值
      expect(serialized[0]).toBe(TriggerType.Complex);
      expect(serialized[1]).toBe(5);
      expect(serialized[2]).toBe(1);
      expect(serialized[5]).toBe(1); // channels[0]
      expect(serialized[10]).toBe(1); // channels[5]
      expect(serialized[29]).toBe(4); // channelCount
      
      // 验证频率的little-endian编码
      const freqBytes = serialized.slice(30, 34);
      const frequency = new DataView(freqBytes.buffer).getUint32(0, true);
      expect(frequency).toBe(25000000);
    });
  });
});

describe('NetConfig 网络配置结构核心算法', () => {
  describe('构造函数和基本属性', () => {
    it('应该正确初始化默认值', () => {
      const config = new NetConfig();
      
      expect(config.accessPointName).toBe('');
      expect(config.password).toBe('');
      expect(config.ipAddress).toBe('');
      expect(config.port).toBe(0);
    });

    it('应该正确设置构造参数', () => {
      const config = new NetConfig('TestAP', 'password123', '192.168.1.100', 8080);
      
      expect(config.accessPointName).toBe('TestAP');
      expect(config.password).toBe('password123');
      expect(config.ipAddress).toBe('192.168.1.100');
      expect(config.port).toBe(8080);
    });
  });

  describe('序列化核心算法验证', () => {
    it('应该生成正确大小的字节数组', () => {
      const config = new NetConfig();
      const serialized = config.serialize();
      
      // 验证结构体大小：115字节 (33 + 64 + 16 + 2)
      expect(serialized.length).toBe(115);
    });

    it('应该正确序列化所有字段到固定长度', () => {
      const config = new NetConfig('MyWiFi', 'secret', '10.0.0.1', 9090);
      const serialized = config.serialize();
      
      // 验证AccessPointName字段 (33字节)
      const apNameBytes = serialized.slice(0, 33);
      const apName = asciiTrim(apNameBytes);
      expect(apName).toBe('MyWiFi');

      // 验证Password字段 (64字节)
      const passwordBytes = serialized.slice(33, 97);
      const password = asciiTrim(passwordBytes);
      expect(password).toBe('secret');

      // 验证IPAddress字段 (16字节)
      const ipBytes = serialized.slice(97, 113);
      const ipAddress = asciiTrim(ipBytes);
      expect(ipAddress).toBe('10.0.0.1');
      
      // 验证Port字段 (2字节, little-endian)
      const portBytes = serialized.slice(113, 115);
      const port = new DataView(portBytes.buffer, portBytes.byteOffset, 2).getUint16(0, true);
      expect(port).toBe(9090);
    });

    it('应该正确处理长字符串的截断', () => {
      const longAP = 'A'.repeat(50);      // 超过33字节限制
      const longPassword = 'P'.repeat(80); // 超过64字节限制
      const longIP = '192.168.1.100.extended'; // 超过16字节限制
      
      const config = new NetConfig(longAP, longPassword, longIP, 12345);
      const serialized = config.serialize();
      
      // 验证字段被正确截断到固定长度
      const apNameBytes = serialized.slice(0, 33);
      const actualAP = asciiTrim(apNameBytes);
      expect(actualAP.length).toBeLessThanOrEqual(33);
      expect(actualAP).toBe('A'.repeat(33));

      const passwordBytes = serialized.slice(33, 97);
      const actualPassword = asciiTrim(passwordBytes);
      expect(actualPassword.length).toBeLessThanOrEqual(64);
      expect(actualPassword).toBe('P'.repeat(64));

      const ipBytes = serialized.slice(97, 113);
      const actualIP = asciiTrim(ipBytes);
      expect(actualIP.length).toBeLessThanOrEqual(16);
      expect(actualIP).toBe('192.168.1.100.ex'); // 截断到16字节
    });

    it('应该正确填充短字符串的空字节', () => {
      const config = new NetConfig('AP', 'pw', '1.1.1.1', 80);
      const serialized = config.serialize();
      
      // 验证AccessPointName填充
      expect(serialized[0]).toBe(65);  // 'A'
      expect(serialized[1]).toBe(80);  // 'P'
      expect(serialized[2]).toBe(0);   // 填充字节
      expect(serialized[32]).toBe(0);  // 最后的填充字节
      
      // 验证Password填充
      expect(serialized[33]).toBe(112); // 'p'
      expect(serialized[34]).toBe(119); // 'w'
      expect(serialized[35]).toBe(0);   // 填充字节
      expect(serialized[96]).toBe(0);   // 最后的填充字节
      
      // 验证IPAddress填充
      const ipStart = 97;
      const ipString = '1.1.1.1';
      for (let i = 0; i < ipString.length; i++) {
        expect(serialized[ipStart + i]).toBe(ipString.charCodeAt(i));
      }
      for (let i = ipString.length; i < 16; i++) {
        expect(serialized[ipStart + i]).toBe(0); // 填充字节
      }
    });

    it('应该正确处理端口号的little-endian编码', () => {
      const config = new NetConfig('AP', 'pass', '192.168.1.1', 0x1234);
      const serialized = config.serialize();
      
      // Port字段在offset 113-114 (little-endian)
      expect(serialized[113]).toBe(0x34); // 低字节
      expect(serialized[114]).toBe(0x12); // 高字节
    });

    it('应该处理极端端口值', () => {
      const config1 = new NetConfig('AP', 'pass', '192.168.1.1', 0);
      const config2 = new NetConfig('AP', 'pass', '192.168.1.1', 65535);
      
      const serialized1 = config1.serialize();
      const serialized2 = config2.serialize();
      
      // 端口0
      expect(serialized1[113]).toBe(0);
      expect(serialized1[114]).toBe(0);
      
      // 端口65535
      expect(serialized2[113]).toBe(255); // 0xFF
      expect(serialized2[114]).toBe(255); // 0xFF
    });

    it('应该确保与C#版本的精确兼容性', () => {
      // 创建一个典型的网络配置，验证结构布局
      const config = new NetConfig('HomeWiFi', 'mypassword', '192.168.0.100', 8080);
      const serialized = config.serialize();
      
      // 验证总大小
      expect(serialized.length).toBe(115);
      
      // 验证字段边界
      expect(serialized[32]).toBe(0);  // AccessPointName最后一个字节应该是填充
      expect(serialized[96]).toBe(0);  // Password最后一个字节应该是填充
      expect(serialized[112]).toBe(0); // IPAddress最后一个字节应该是填充
      
      // 验证端口编码
      const portView = new DataView(serialized.buffer, 113, 2);
      expect(portView.getUint16(0, true)).toBe(8080);
    });

    it('应该处理Unicode字符的UTF-8编码', () => {
      const config = new NetConfig('WiFi测试', 'password🔐', '127.0.0.1', 3000);
      const serialized = config.serialize();
      
      // UTF-8编码的字符可能占用多个字节，应该正确处理
      expect(serialized.length).toBe(115);
      
      // 验证基本结构完整性
      expect(serialized[32]).toBe(0);  // AccessPointName边界
      expect(serialized[96]).toBe(0);  // Password边界  
      expect(serialized[112]).toBe(0); // IPAddress边界
      
      // 验证端口号正确编码
      const port = new DataView(serialized.buffer, 113, 2).getUint16(0, true);
      expect(port).toBe(3000);
    });
  });
});
