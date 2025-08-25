/**
 * LogicAnalyzerDriver 核心驱动逻辑测试
 * 
 * 基于深度思考方法论的精准测试:
 * - 专注@src源码的真实业务逻辑验证，不偏移方向
 * - 基于AnalyzerDriverBase完美突破经验，应用错误驱动学习
 * - 系统性覆盖7大核心功能模块：连接管理、设备初始化、采集控制、数据处理、协议通信、参数验证、网络配置
 * - 目标：从46.9%覆盖率实现向70%+的Drivers层继续突破
 * 
 * 测试重点：1165行复杂Pico逻辑分析器驱动的核心算法验证
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { AnalyzerDriverBase, OutputPacket, CaptureRequest } from '../../../src/drivers/AnalyzerDriverBase';
import { VersionValidator, DeviceConnectionException } from '../../../src/drivers/VersionValidator';
import {
  AnalyzerDriverType,
  TriggerType,
  CaptureMode,
  CaptureSession,
  AnalyzerChannel,
  ConnectionParams,
  ConnectionResult,
  DeviceStatus,
  CaptureError,
  CaptureEventArgs
} from '../../../src/models/AnalyzerTypes';

// Mock SerialPort - 功能性Mock避免过度抽象
const mockSerialPortInstance = {
  isOpen: false,
  open: jest.fn(),
  close: jest.fn(),
  write: jest.fn(),
  pipe: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

const mockReadlineParser = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn()
};

jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => mockSerialPortInstance)
}));

jest.mock('@serialport/parser-readline', () => ({
  ReadlineParser: jest.fn().mockImplementation(() => mockReadlineParser)
}));

// Mock Socket - 网络连接功能性Mock
const mockSocketInstance = {
  connect: jest.fn(),
  write: jest.fn(),
  pipe: jest.fn(),
  destroy: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => mockSocketInstance)
}));

describe('LogicAnalyzerDriver 核心驱动逻辑测试', () => {
  let driver: LogicAnalyzerDriver;

  // 测试工具函数：创建标准CaptureSession
  const createTestCaptureSession = (overrides: Partial<CaptureSession> = {}): CaptureSession => {
    // 创建符合AnalyzerChannel接口的测试通道
    const createTestChannel = (channelNum: number): AnalyzerChannel => ({
      channelNumber: channelNum,
      channelName: `Channel ${channelNum}`,
      textualChannelNumber: channelNum.toString(),
      hidden: false,
      samples: new Uint8Array(0),
      clone: jest.fn().mockReturnValue({})
    });

    return {
      sessionId: 'test-session',
      captureChannels: [createTestChannel(0), createTestChannel(1)],
      frequency: 24000000,
      preTriggerSamples: 1000,
      postTriggerSamples: 9000,
      triggerType: TriggerType.Edge,
      triggerChannel: 0,
      triggerInverted: false,
      loopCount: 0,
      measureBursts: false,
      get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
      clone: jest.fn().mockReturnValue({}),
      cloneSettings: jest.fn().mockReturnValue({}),
      ...overrides
    } as CaptureSession;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 重置Mock状态
    mockSerialPortInstance.isOpen = false;
    mockSerialPortInstance.open.mockClear();
    mockSerialPortInstance.close.mockClear();
    mockSerialPortInstance.write.mockClear();
    
    mockSocketInstance.connect.mockClear();
    mockSocketInstance.write.mockClear();
    mockSocketInstance.destroy.mockClear();
    
    mockReadlineParser.on.mockClear();
    mockReadlineParser.once.mockClear();
    mockReadlineParser.off.mockClear();
  });

  describe('构造函数和基础属性验证', () => {
    it('应该正确继承AnalyzerDriverBase', () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      expect(driver).toBeInstanceOf(AnalyzerDriverBase);
      expect(driver).toBeInstanceOf(LogicAnalyzerDriver);
    });

    it('应该正确设置连接字符串和初始状态', () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      expect(driver.isCapturing).toBe(false);
      expect(driver.isNetwork).toBe(false);
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
      expect(driver.deviceVersion).toBeNull();
      expect(driver.channelCount).toBe(0);
    });

    it('应该拒绝空连接字符串', () => {
      expect(() => new LogicAnalyzerDriver('')).toThrow('连接字符串不能为空');
      expect(() => new LogicAnalyzerDriver(null as any)).toThrow('连接字符串不能为空');
    });

    it('应该正确识别网络连接字符串格式', () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      // 连接前isNetwork为false（仅在连接后设置）
      expect(networkDriver.isNetwork).toBe(false);
    });
  });

  describe('连接管理系统核心测试', () => {
    describe('串口连接逻辑', () => {
      beforeEach(() => {
        driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      });

      it('应该成功建立串口连接', async () => {
        // Mock成功的串口打开
        mockSerialPortInstance.open.mockImplementation((callback) => {
          mockSerialPortInstance.isOpen = true;
          callback(null);
        });

        // Mock设备信息查询响应
        const deviceResponses = [
          'PicoLogicAnalyzer v1.2.3',
          'FREQ:100000000', 
          'BLASTFREQ:100000000',
          'BUFFER:96000',
          'CHANNELS:24'
        ];

        let responseIndex = 0;
        mockReadlineParser.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            // 模拟异步设备响应
            setTimeout(() => {
              for (let i = 0; i < deviceResponses.length; i++) {
                handler(deviceResponses[i]);
              }
            }, 10);
          }
        });

        const result = await driver.connect();

        expect(result.success).toBe(true);
        expect(result.deviceInfo).toBeTruthy();
        expect(result.deviceInfo!.name).toBe('PicoLogicAnalyzer v1.2.3');
        expect(result.deviceInfo!.type).toBe(AnalyzerDriverType.Serial);
        expect(result.deviceInfo!.connectionPath).toBe('/dev/ttyACM0');
        expect(driver.isNetwork).toBe(false);
      });

      it('应该处理串口打开失败', async () => {
        mockSerialPortInstance.open.mockImplementation((callback) => {
          callback(new Error('Port not found'));
        });

        const result = await driver.connect();

        expect(result.success).toBe(false);
        expect(result.error).toContain('串口连接失败');
      });

      it('应该正确清理串口连接', async () => {
        mockSerialPortInstance.isOpen = true;

        await driver.disconnect();

        expect(mockSerialPortInstance.close).toHaveBeenCalled();
        expect(driver.isNetwork).toBe(false);
      });
    });

    describe('网络连接逻辑', () => {
      beforeEach(() => {
        driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      });

      it('应该成功建立网络连接', async () => {
        // Mock成功的网络连接
        mockSocketInstance.connect.mockImplementation((port, host, callback) => {
          callback();
        });

        // Mock设备信息响应
        const deviceResponses = [
          'PicoNetworkAnalyzer v2.0.1',
          'FREQ:200000000',
          'BLASTFREQ:200000000', 
          'BUFFER:192000',
          'CHANNELS:24'
        ];

        mockReadlineParser.on.mockImplementation((event, handler) => {
          if (event === 'data') {
            setTimeout(() => {
              deviceResponses.forEach(response => handler(response));
            }, 10);
          }
        });

        const result = await driver.connect();

        expect(result.success).toBe(true);
        expect(result.deviceInfo!.type).toBe(AnalyzerDriverType.Network);
        expect(driver.isNetwork).toBe(true);
        expect(mockSocketInstance.connect).toHaveBeenCalledWith(8080, '192.168.1.100', expect.any(Function));
      });

      it('应该处理无效的网络地址格式', async () => {
        const invalidDriver = new LogicAnalyzerDriver('invalid-address');

        const result = await invalidDriver.connect();

        expect(result.success).toBe(false);
        expect(result.error).toContain('无效');
      });

      it('应该处理网络连接超时', async () => {
        mockSocketInstance.on.mockImplementation((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Connection timeout')), 10);
          }
        });

        const result = await driver.connect();

        expect(result.success).toBe(false);
        expect(result.error).toContain('网络连接失败');
      });

      it('应该正确清理网络连接', async () => {
        await driver.disconnect();

        expect(mockSocketInstance.destroy).toHaveBeenCalled();
      });
    });
  });

  describe('设备初始化系统核心测试', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
    });

    it('应该正确解析完整的设备信息', async () => {
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const deviceResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000', 
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await driver.connect();

      expect(driver.deviceVersion).toBe('PicoLogicAnalyzer v1.3.0');
      expect(driver.maxFrequency).toBe(100000000);
      expect(driver.blastFrequency).toBe(100000000);
      expect(driver.bufferSize).toBe(96000);
      expect(driver.channelCount).toBe(24);
    });

    it('应该处理无效的频率响应格式 - 错误驱动学习验证点', async () => {
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const invalidResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'INVALID_FREQ_FORMAT', // 无效频率格式
        'BLASTFREQ:100000000',
        'BUFFER:96000', 
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            invalidResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的设备频率响应');
    });

    it('应该处理版本验证失败', async () => {
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const responses = [
        'UnsupportedDevice v0.1.0', // 不支持的版本
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            responses.forEach(response => handler(response));
          }, 10);
        }
      });

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的设备版本');
    });

    it('应该处理设备信息读取超时', async () => {
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      // 不提供任何响应，触发超时
      mockReadlineParser.on.mockImplementation(() => {});

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('设备信息读取超时');
    });

    it('应该验证通道数的边界条件', async () => {
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const invalidChannelResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:25' // 超过最大24通道
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            invalidChannelResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      const result = await driver.connect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('设备通道数值无效');
    });
  });

  describe('设备状态管理测试', () => {
    beforeEach(async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      // 建立基础连接用于状态测试
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const deviceResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await driver.connect();
    });

    it('应该正确报告设备状态', async () => {
      const status = await driver.getStatus();

      expect(status.isConnected).toBe(true);
      expect(status.isCapturing).toBe(false);
      expect(status.batteryVoltage).toBeDefined();
    });

    it('应该正确获取串口设备的电压状态', async () => {
      const voltage = await driver.getVoltageStatus();

      // 串口设备应该返回模拟电压值
      expect(voltage).toBe('3.3V');
    });

    it('应该处理网络设备的电压查询', async () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      mockSocketInstance.connect.mockImplementation((port, host, callback) => {
        callback();
      });

      const deviceResponses = [
        'NetworkAnalyzer v2.0.0',
        'FREQ:200000000',
        'BLASTFREQ:200000000',
        'BUFFER:192000', 
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await networkDriver.connect();

      // Mock网络电压响应
      mockReadlineParser.once.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('4.1V'), 10);
        }
      });

      const voltage = await networkDriver.getVoltageStatus();

      expect(voltage).toBe('4.1V');
    });
  });

  describe('采集控制系统核心测试', () => {
    let captureSession: CaptureSession;

    beforeEach(async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      captureSession = createTestCaptureSession();

      // 建立连接
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const deviceResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await driver.connect();
    });

    it('应该正确启动Edge触发采集', async () => {
      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(null);
      });

      // Mock采集启动响应
      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('CAPTURE_STARTED'), 10);
        }
      });

      const result = await driver.startCapture(captureSession);

      expect(result).toBe(CaptureError.None);
      expect(driver.isCapturing).toBe(true);
      expect(mockSerialPortInstance.write).toHaveBeenCalled();
    });

    it('应该处理设备忙状态', async () => {
      // 手动设置为采集状态
      (driver as any)._capturing = true;

      const result = await driver.startCapture(captureSession);

      expect(result).toBe(CaptureError.Busy);
    });

    it('应该处理未连接状态的采集请求', async () => {
      const disconnectedDriver = new LogicAnalyzerDriver('/dev/ttyACM1');

      const result = await disconnectedDriver.startCapture(captureSession);

      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该正确停止采集', async () => {
      // 先启动采集
      (driver as any)._capturing = true;

      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(null);
      });

      // Mock重连过程
      mockSerialPortInstance.close.mockImplementation(() => {});
      mockSerialPortInstance.open.mockImplementation((callback) => {
        callback(null);
      });

      const result = await driver.stopCapture();

      expect(result).toBe(true);
      expect(driver.isCapturing).toBe(false);
    });

    it('应该验证复杂触发参数', async () => {
      const complexSession = createTestCaptureSession({
        triggerType: TriggerType.Complex,
        triggerBitCount: 4,
        triggerPattern: 0x0F,
        preTriggerSamples: 500,
        postTriggerSamples: 9500
      });

      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(null);
      });

      const result = await driver.startCapture(complexSession);

      expect(result).toBe(CaptureError.None);
    });
  });

  describe('参数验证系统测试', () => {
    beforeEach(async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      // 连接并初始化设备参数
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const deviceResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await driver.connect();
    });

    it('应该正确计算采集限制', () => {
      const channels = [0, 1, 2]; // 3通道，Mode 0
      const limits = driver.getLimits(channels);

      expect(limits.minPreSamples).toBe(2);
      expect(limits.minPostSamples).toBe(2);
      expect(limits.maxTotalSamples).toBeGreaterThan(0);
      expect(limits.maxPreSamples + limits.maxPostSamples).toBeLessThanOrEqual(limits.maxTotalSamples);
    });

    it('应该验证频率范围', async () => {
      const invalidSession = createTestCaptureSession({
        frequency: 200000000 // 超过maxFrequency
      });

      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(null);
      });

      const result = await driver.startCapture(invalidSession);

      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该验证通道范围', async () => {
      const invalidChannel: AnalyzerChannel = {
        channelNumber: 25,
        channelName: 'Invalid Channel',
        textualChannelNumber: '25',
        hidden: false,
        samples: new Uint8Array(0),
        clone: jest.fn().mockReturnValue({})
      };

      const invalidChannelSession = createTestCaptureSession({
        captureChannels: [invalidChannel]
      });

      const result = await driver.startCapture(invalidChannelSession);

      expect(result).toBe(CaptureError.BadParams);
    });

    it('应该验证采样数量', async () => {
      const invalidSampleSession = createTestCaptureSession({
        preTriggerSamples: 50000, // 超过限制
        postTriggerSamples: 50000
      });

      const result = await driver.startCapture(invalidSampleSession);

      expect(result).toBe(CaptureError.BadParams);
    });
  });

  describe('网络配置系统测试', () => {
    beforeEach(async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      // 建立串口连接
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const deviceResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await driver.connect();
    });

    it('应该成功发送网络配置', async () => {
      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(null);
      });

      // Mock配置保存成功响应
      const waitForResponse = jest.fn().mockResolvedValue('SETTINGS_SAVED');
      (driver as any).waitForResponse = waitForResponse;

      const result = await driver.sendNetworkConfig(
        'TestNetwork',
        'password123',
        '192.168.1.100',
        8080
      );

      expect(result).toBe(true);
      expect(mockSerialPortInstance.write).toHaveBeenCalled();
      expect(waitForResponse).toHaveBeenCalledWith('SETTINGS_SAVED', 5000);
    });

    it('应该拒绝网络设备的配置请求', async () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');

      const result = await networkDriver.sendNetworkConfig(
        'TestNetwork',
        'password123',
        '192.168.1.100',
        8080
      );

      expect(result).toBe(false);
    });

    it('应该处理配置发送失败', async () => {
      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(new Error('Write failed'));
      });

      const result = await driver.sendNetworkConfig(
        'TestNetwork',
        'password123',
        '192.168.1.100',
        8080
      );

      expect(result).toBe(false);
    });
  });

  describe('引导加载程序系统测试', () => {
    beforeEach(async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      // 建立连接
      mockSerialPortInstance.open.mockImplementation((callback) => {
        mockSerialPortInstance.isOpen = true;
        callback(null);
      });

      const deviceResponses = [
        'PicoLogicAnalyzer v1.3.0',
        'FREQ:100000000',
        'BLASTFREQ:100000000',
        'BUFFER:96000',
        'CHANNELS:24'
      ];

      mockReadlineParser.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => {
            deviceResponses.forEach(response => handler(response));
          }, 10);
        }
      });

      await driver.connect();
    });

    it('应该成功进入引导加载程序', async () => {
      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(null);
      });

      // Mock引导加载程序响应
      const waitForResponse = jest.fn().mockResolvedValue('RESTARTING_BOOTLOADER');
      (driver as any).waitForResponse = waitForResponse;

      const result = await driver.enterBootloader();

      expect(result).toBe(true);
      expect(mockSerialPortInstance.write).toHaveBeenCalled();
      expect(waitForResponse).toHaveBeenCalledWith('RESTARTING_BOOTLOADER', 1000);
    });

    it('应该处理进入引导加载程序失败', async () => {
      mockSerialPortInstance.write.mockImplementation((data, callback) => {
        callback(new Error('Command failed'));
      });

      const result = await driver.enterBootloader();

      expect(result).toBe(false);
    });

    it('应该处理未连接设备的引导加载程序请求', async () => {
      const disconnectedDriver = new LogicAnalyzerDriver('/dev/ttyACM1');

      const result = await disconnectedDriver.enterBootloader();

      expect(result).toBe(false);
    });
  });

  describe('资源管理和清理测试', () => {
    it('应该正确释放所有资源', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');
      
      // 模拟连接状态
      (driver as any)._serialPort = mockSerialPortInstance;
      mockSerialPortInstance.isOpen = true;

      driver.dispose();

      expect(mockSerialPortInstance.close).toHaveBeenCalled();
    });

    it('应该正确清理网络连接资源', async () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
      
      // 模拟网络连接状态
      (driver as any)._tcpSocket = mockSocketInstance;
      (driver as any)._isNetwork = true;

      await driver.disconnect();

      expect(mockSocketInstance.destroy).toHaveBeenCalled();
    });

    it('应该安全处理多次disconnect调用', async () => {
      driver = new LogicAnalyzerDriver('/dev/ttyACM0');

      await driver.disconnect();
      await driver.disconnect(); // 不应该抛出异常

      expect(mockSerialPortInstance.close).not.toHaveBeenCalled();
    });
  });
});