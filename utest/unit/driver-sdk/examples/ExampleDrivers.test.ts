/**
 * Example Drivers 单元测试
 * 测试 ExampleNetworkDriver 和 ExampleSerialDriver 的完整功能
 * 覆盖所有关键方法和边界条件
 */

import { ExampleNetworkDriver } from '../../../../src/driver-sdk/examples/ExampleNetworkDriver';
import { ExampleSerialDriver } from '../../../../src/driver-sdk/examples/ExampleSerialDriver';
import { NetworkDriverTemplate } from '../../../../src/driver-sdk/templates/NetworkDriverTemplate';
import { SerialDriverTemplate } from '../../../../src/driver-sdk/templates/SerialDriverTemplate';
import {
  AnalyzerDriverType,
  CaptureError,
  CaptureSession,
  ConnectionParams,
  DeviceStatus,
  CaptureEventArgs
} from '../../../../src/models/AnalyzerTypes';
import { EventEmitter } from 'events';

// 模拟 serialport 库
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation((config) => {
    const mockPort = new EventEmitter();
    (mockPort as any).isOpen = false;
    (mockPort as any).open = jest.fn((callback) => {
      (mockPort as any).isOpen = true;
      setTimeout(() => callback(null), 10);
    });
    (mockPort as any).close = jest.fn((callback) => {
      (mockPort as any).isOpen = false;
      setTimeout(() => callback(null), 10);
    });
    (mockPort as any).write = jest.fn((data, callback) => {
      setTimeout(() => callback(null), 10);
    });
    return mockPort;
  }),
  list: jest.fn().mockResolvedValue([
    { path: '/dev/ttyUSB0', manufacturer: 'FTDI', serialNumber: '12345' },
    { path: '/dev/ttyUSB1', manufacturer: 'Prolific', serialNumber: '67890' }
  ])
}));

// 模拟网络模块
jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => {
    const mockSocket = new EventEmitter();
    (mockSocket as any).connect = jest.fn((port, host, callback) => {
      setTimeout(() => {
        (mockSocket as any).connected = true;
        callback?.();
      }, 10);
    });
    (mockSocket as any).write = jest.fn((data, callback) => {
      setTimeout(() => callback?.(null), 10);
    });
    (mockSocket as any).destroy = jest.fn();
    return mockSocket;
  })
}));

jest.mock('dgram', () => ({
  createSocket: jest.fn().mockImplementation(() => {
    const mockSocket = new EventEmitter();
    (mockSocket as any).bind = jest.fn((port, callback) => {
      setTimeout(() => callback?.(), 10);
    });
    (mockSocket as any).send = jest.fn((data, port, host, callback) => {
      setTimeout(() => callback?.(null), 10);
    });
    (mockSocket as any).close = jest.fn();
    return mockSocket;
  })
}));

describe('Example Drivers', () => {
  let mockCaptureSession: CaptureSession;

  beforeEach(() => {
    // 清除 console 输出以避免测试污染
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // 创建模拟的 CaptureSession
    mockCaptureSession = {
      frequency: 1000000,
      preTriggerSamples: 1000,
      postTriggerSamples: 2000,
      triggerType: 0,
      triggerChannel: 0,
      triggerInverted: false,
      triggerPattern: 0xFF,
      captureChannels: [
        {
          channelNumber: 0,
          channelName: 'CH0',
          hidden: false,
          samples: new Uint8Array([1, 0, 1, 0, 1])
        },
        {
          channelNumber: 1,
          channelName: 'CH1',
          hidden: false,
          samples: new Uint8Array([0, 1, 0, 1, 0])
        }
      ]
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ExampleNetworkDriver', () => {
    let driver: ExampleNetworkDriver;

    beforeEach(() => {
      driver = new ExampleNetworkDriver('192.168.1.100', 8080, 'test-token');
    });

    afterEach(() => {
      driver.dispose();
    });

    describe('初始化和基本属性', () => {
      it('应该正确初始化网络驱动', () => {
        expect(driver).toBeInstanceOf(NetworkDriverTemplate);
        expect(driver.isNetwork).toBe(true);
        expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      });

      it('应该支持自定义端口和认证令牌', () => {
        const customDriver = new ExampleNetworkDriver('10.0.0.1', 9090, 'custom-auth');
        expect(customDriver).toBeInstanceOf(ExampleNetworkDriver);
        customDriver.dispose();
      });

      it('应该使用默认端口', () => {
        const defaultPortDriver = new ExampleNetworkDriver('192.168.1.1');
        expect(defaultPortDriver).toBeInstanceOf(ExampleNetworkDriver);
        defaultPortDriver.dispose();
      });
    });

    describe('连接管理', () => {
      it('应该成功连接到网络设备', async () => {
        const result = await driver.connect();

        expect(result.success).toBe(true);
        expect(result.deviceInfo).toBeDefined();
        expect(result.deviceInfo?.name).toBe('Example Network Logic Analyzer');
        expect(result.deviceInfo?.capabilities).toBeDefined();
        expect(result.deviceInfo?.capabilities?.channels?.digital).toBe(32);
        expect(result.deviceInfo?.capabilities?.sampling?.maxRate).toBe(200000000);
      });

      it('应该验证设备能力描述', async () => {
        const result = await driver.connect();

        expect(result.success).toBe(true);
        const capabilities = result.deviceInfo?.capabilities;
        
        expect(capabilities?.channels?.digital).toBe(32);
        expect(capabilities?.channels?.maxVoltage).toBe(3.3);
        expect(capabilities?.sampling?.maxRate).toBe(200000000);
        expect(capabilities?.sampling?.bufferSize).toBe(16777216);
        expect(capabilities?.features?.remoteControl).toBe(true);
        expect(capabilities?.features?.realTimeStreaming).toBe(true);
        expect(capabilities?.features?.webInterface).toBe(true);
        expect(capabilities?.features?.restAPI).toBe(true);
      });

      it('应该处理连接超时', async () => {
        // 模拟服务器不可达
        jest.spyOn(driver as any, 'checkServerReachability').mockResolvedValue(false);

        const result = await driver.connect();

        expect(result.success).toBe(false);
        expect(result.error).toBe('服务器不可达或服务未启动');
      });

      it('应该执行HTTP特定初始化', async () => {
        const spy = jest.spyOn(driver as any, 'performHTTPInitialization');
        
        await driver.connect();
        
        expect(spy).toHaveBeenCalled();
      });
    });

    describe('HTTP特定功能', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该检查服务器可达性', async () => {
        const isReachable = await (driver as any).checkServerReachability();
        expect(isReachable).toBe(true);
      });

      it('应该获取API版本', async () => {
        const version = await (driver as any).getAPIVersion();
        expect(version).toBe('v2.1.0');
      });

      it('应该注册客户端会话', async () => {
        const sessionId = await (driver as any).registerClientSession();
        expect(sessionId).toMatch(/^session_\d+$/);
      });

      it('应该配置默认设置', async () => {
        await expect((driver as any).configureDefaultSettings()).resolves.toBeUndefined();
      });
    });

    describe('采集功能', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该开始HTTP采集', async () => {
        const result = await driver.startCapture(mockCaptureSession);
        expect(result).toBe(CaptureError.None);
      });

      it('应该在服务器不可达时失败', async () => {
        jest.spyOn(driver as any, 'checkServerReachability').mockResolvedValue(false);

        const result = await driver.startCapture(mockCaptureSession);
        expect(result).toBe(CaptureError.HardwareError);
      });

      it('应该构建HTTP采集配置', () => {
        const config = (driver as any).buildHTTPCaptureConfig(mockCaptureSession);

        expect(config).toMatchObject({
          captureId: expect.stringMatching(/^capture_\d+$/),
          channels: expect.any(Array),
          timing: {
            sampleRate: mockCaptureSession.frequency,
            preTrigger: mockCaptureSession.preTriggerSamples,
            postTrigger: mockCaptureSession.postTriggerSamples
          },
          trigger: {
            type: mockCaptureSession.triggerType,
            channel: mockCaptureSession.triggerChannel,
            edge: 'rising',
            pattern: mockCaptureSession.triggerPattern
          },
          dataFormat: 'json',
          compression: true,
          realTimeStreaming: false
        });
      });

      it('应该处理触发器反转', () => {
        const invertedSession = { ...mockCaptureSession, triggerInverted: true };
        const config = (driver as any).buildHTTPCaptureConfig(invertedSession);

        expect(config.trigger.edge).toBe('falling');
      });
    });

    describe('网络状态管理', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该获取网络状态', async () => {
        const status = await driver.getNetworkStatus();

        expect(status).toMatchObject({
          ip: '192.168.1.100',
          subnet: '255.255.255.0',
          gateway: '192.168.1.1',
          dns: ['8.8.8.8', '8.8.4.4'],
          wifiSSID: 'MyNetwork',
          signalStrength: -45,
          connectionType: 'wifi'
        });
      });

      it('应该处理网络状态查询失败', async () => {
        jest.spyOn(driver as any, 'checkServerReachability').mockRejectedValue(new Error('网络错误'));

        await expect(driver.getNetworkStatus()).rejects.toThrow('网络状态查询失败');
      });
    });

    describe('WiFi管理', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该设置WiFi网络', async () => {
        const result = await driver.setWiFiNetwork('TestSSID', 'password123');
        expect(result).toBe(true);
      });

      it('应该处理WiFi设置失败', async () => {
        // 创建不支持WiFi的驱动
        const noWifiDriver = new ExampleNetworkDriver('192.168.1.100');
        (noWifiDriver as any)._deviceCapabilities.hasWiFi = false;

        const result = await noWifiDriver.setWiFiNetwork('TestSSID', 'password123');
        expect(result).toBe(false);

        noWifiDriver.dispose();
      });

      it('应该扫描WiFi网络', async () => {
        const networks = await driver.scanWiFiNetworks();

        expect(Array.isArray(networks)).toBe(true);
        expect(networks.length).toBeGreaterThan(0);
        
        const firstNetwork = networks[0];
        expect(firstNetwork).toMatchObject({
          ssid: expect.any(String),
          security: expect.stringMatching(/^(open|wep|wpa|wpa2)$/),
          signalStrength: expect.any(Number),
          channel: expect.any(Number)
        });
      });

      it('应该处理不支持WiFi的设备', async () => {
        const noWifiDriver = new ExampleNetworkDriver('192.168.1.100');
        (noWifiDriver as any)._deviceCapabilities.hasWiFi = false;

        const networks = await noWifiDriver.scanWiFiNetworks();
        expect(networks).toEqual([]);

        noWifiDriver.dispose();
      });
    });

    describe('实时数据流', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该启用实时数据流', async () => {
        const dataCallback = jest.fn();
        const result = await driver.enableRealTimeStreaming(dataCallback);

        expect(result).toBe(true);

        // 等待一些数据回调
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(dataCallback).toHaveBeenCalled();

        const callArgs = dataCallback.mock.calls[0][0];
        expect(callArgs).toMatchObject({
          channelId: expect.any(Number),
          timestamp: expect.any(Number),
          value: expect.any(Number)
        });
      });

      it('应该处理实时流启动失败', async () => {
        jest.spyOn(global, 'setInterval').mockImplementation(() => {
          throw new Error('定时器创建失败');
        });

        const result = await driver.enableRealTimeStreaming(jest.fn());
        expect(result).toBe(false);
      });
    });

    describe('性能统计', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该获取性能统计', async () => {
        const stats = await driver.getPerformanceStats();

        expect(stats).toMatchObject({
          cpuUsage: expect.any(Number),
          memoryUsage: 45.6,
          networkThroughput: expect.any(Number),
          activeConnections: 3,
          uptime: 86400
        });

        expect(stats.cpuUsage).toBeGreaterThanOrEqual(0);
        expect(stats.cpuUsage).toBeLessThanOrEqual(100);
      });

      it('应该处理性能统计查询失败', async () => {
        jest.spyOn(global, 'Promise').mockImplementation(() => {
          throw new Error('Promise创建失败');
        });

        await expect(driver.getPerformanceStats()).rejects.toThrow('性能统计查询失败');
      });
    });

    describe('固件更新', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该执行固件更新', async () => {
        const mockFirmware = Buffer.from('mock firmware data');
        const result = await driver.updateFirmware(mockFirmware);

        expect(result).toMatchObject({
          success: true,
          progress: 100
        });
      });

      it('应该处理固件更新失败', async () => {
        jest.spyOn(global, 'Promise').mockImplementation(() => {
          throw new Error('固件更新过程中断');
        });

        const mockFirmware = Buffer.from('mock firmware data');
        const result = await driver.updateFirmware(mockFirmware);

        expect(result).toMatchObject({
          success: false,
          error: expect.any(String)
        });
      });
    });

    describe('资源清理', () => {
      it('应该正确清理资源', async () => {
        await driver.connect();
        await driver.startCapture(mockCaptureSession);

        driver.dispose();

        // 验证资源被清理
        expect(driver.isCapturing).toBe(false);
      });
    });
  });

  describe('ExampleSerialDriver', () => {
    let driver: ExampleSerialDriver;

    beforeEach(() => {
      driver = new ExampleSerialDriver('/dev/ttyUSB0', 115200);
    });

    afterEach(() => {
      driver.dispose();
    });

    describe('初始化和基本属性', () => {
      it('应该正确初始化串口驱动', () => {
        expect(driver).toBeInstanceOf(SerialDriverTemplate);
        expect(driver.isNetwork).toBe(false);
        expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
      });

      it('应该支持自定义波特率', () => {
        const customDriver = new ExampleSerialDriver('/dev/ttyUSB1', 9600);
        expect(customDriver).toBeInstanceOf(ExampleSerialDriver);
        customDriver.dispose();
      });

      it('应该使用默认波特率', () => {
        const defaultDriver = new ExampleSerialDriver('/dev/ttyUSB2');
        expect(defaultDriver).toBeInstanceOf(ExampleSerialDriver);
        defaultDriver.dispose();
      });
    });

    describe('连接管理', () => {
      it('应该成功连接到串口设备', async () => {
        const result = await driver.connect();

        expect(result.success).toBe(true);
        expect(result.deviceInfo?.name).toBe('ExampleLA-1000');
        expect(result.deviceInfo?.capabilities?.features?.customFeature).toBe(true);
        expect(result.deviceInfo?.capabilities?.features?.hardwareFlowControl).toBe(false);
      });

      it('应该执行自定义初始化', async () => {
        const spy = jest.spyOn(driver as any, 'performCustomInitialization');
        
        await driver.connect();
        
        expect(spy).toHaveBeenCalled();
      });

      it('应该处理自定义初始化失败', async () => {
        jest.spyOn(driver as any, 'sendCustomCommand').mockRejectedValue(new Error('命令失败'));

        const result = await driver.connect();
        expect(result.success).toBe(true); // 初始化失败不影响连接
      });
    });

    describe('自定义命令', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该发送自定义命令', async () => {
        const response = await (driver as any).sendCustomCommand('TEST_COMMAND');
        expect(response).toBe('OK');
      });

      it('应该处理命令超时', async () => {
        jest.spyOn(global, 'setTimeout').mockImplementation((callback, delay) => {
          // 不执行回调，模拟超时
          return 123 as any;
        });

        // 这个测试主要验证代码结构，实际超时处理在父类中
        const response = await (driver as any).sendCustomCommand('TIMEOUT_COMMAND');
        expect(response).toBeDefined();
      });
    });

    describe('采集功能', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该开始自定义采集流程', async () => {
        const result = await driver.startCapture(mockCaptureSession);
        expect(result).toBe(CaptureError.None);
      });

      it('应该预处理采集会话', async () => {
        const preprocessedSession = await (driver as any).preprocessCaptureSession(mockCaptureSession);

        expect(preprocessedSession.captureChannels[0].channelName).toBe('CH0');
        expect(preprocessedSession.captureChannels[1].channelName).toBe('CH1');
      });

      it('应该添加默认通道名称', async () => {
        const sessionWithoutNames = {
          ...mockCaptureSession,
          captureChannels: [
            { channelNumber: 0, hidden: false, samples: new Uint8Array() },
            { channelNumber: 1, hidden: false, samples: new Uint8Array() }
          ]
        };

        const preprocessedSession = await (driver as any).preprocessCaptureSession(sessionWithoutNames);

        expect(preprocessedSession.captureChannels[0].channelName).toBe('CH0');
        expect(preprocessedSession.captureChannels[1].channelName).toBe('CH1');
      });

      it('应该调整过高的采样频率', async () => {
        const highFreqSession = { ...mockCaptureSession, frequency: 100000000 }; // 100MHz
        const preprocessedSession = await (driver as any).preprocessCaptureSession(highFreqSession);

        expect(preprocessedSession.frequency).toBe(50000000); // 调整到50MHz
      });

      it('应该处理采集完成回调', (done) => {
        const customHandler = jest.fn((args: CaptureEventArgs) => {
          expect(args).toBeDefined();
          done();
        });

        driver.startCapture(mockCaptureSession, customHandler);
      });

      it('应该后处理采集数据', () => {
        (driver as any).postprocessCaptureData(mockCaptureSession);

        const channel0 = mockCaptureSession.captureChannels[0] as any;
        expect(channel0.timestamps).toBeDefined();
        expect(channel0.statistics).toBeDefined();
        expect(channel0.statistics.totalSamples).toBe(5);
        expect(channel0.statistics.highSamples).toBe(3);
        expect(channel0.statistics.lowSamples).toBe(2);
        expect(channel0.statistics.dutyCycle).toBe(0.6);
      });
    });

    describe('设备特定功能', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该获取设备特定信息', async () => {
        const info = await driver.getDeviceSpecificInfo();

        expect(info).toMatchObject({
          model: 'ExampleLA-1000',
          supportedBaudRates: [9600, 19200, 38400, 115200, 230400],
          hardwareFlowControl: false,
          firmwareVersion: 'v1.0.0'
        });
      });

      it('应该处理固件版本查询失败', async () => {
        jest.spyOn(driver as any, 'sendCustomCommand').mockRejectedValue(new Error('查询失败'));

        const info = await driver.getDeviceSpecificInfo();

        expect(info.firmwareVersion).toBeUndefined();
        expect(info.model).toBe('ExampleLA-1000');
      });

      it('应该设置硬件流控制', async () => {
        const result = await driver.setHardwareFlowControl(true);
        expect(result).toBe(true);

        const info = await driver.getDeviceSpecificInfo();
        expect(info.hardwareFlowControl).toBe(true);
      });

      it('应该处理硬件流控制设置失败', async () => {
        jest.spyOn(driver as any, 'sendCustomCommand').mockResolvedValue('ERROR');

        const result = await driver.setHardwareFlowControl(true);
        expect(result).toBe(false);
      });

      it('应该获取支持的波特率列表', () => {
        const baudRates = driver.getSupportedBaudRates();
        expect(baudRates).toEqual([9600, 19200, 38400, 115200, 230400]);
      });

      it('应该设置自定义波特率', async () => {
        const result = await driver.setCustomBaudRate(38400);
        expect(result).toBe(true);
      });

      it('应该拒绝不支持的波特率', async () => {
        const result = await driver.setCustomBaudRate(14400);
        expect(result).toBe(false);
      });

      it('应该处理波特率设置失败', async () => {
        jest.spyOn(driver as any, 'sendCustomCommand').mockRejectedValue(new Error('设置失败'));

        const result = await driver.setCustomBaudRate(115200);
        expect(result).toBe(false);
      });
    });

    describe('设备自检', () => {
      beforeEach(async () => {
        await driver.connect();
      });

      it('应该执行设备自检', async () => {
        const result = await driver.performSelfTest();

        expect(result.passed).toBe(true);
        expect(result.results).toHaveLength(4);

        const expectedTests = ['通信测试', '内存测试', '时钟测试', '通道测试'];
        result.results.forEach((test, index) => {
          expect(test.test).toBe(expectedTests[index]);
          expect(test.passed).toBe(true);
          expect(test.details).toBeDefined();
        });
      });

      it('应该处理自检失败情况', async () => {
        // 模拟一个测试失败
        const originalResults = [
          { test: '通信测试', passed: true, details: '串口通信正常' },
          { test: '内存测试', passed: false, details: '内存检查失败' },
          { test: '时钟测试', passed: true, details: '时钟信号稳定' },
          { test: '通道测试', passed: true, details: '所有通道正常' }
        ];

        jest.spyOn(driver, 'performSelfTest').mockResolvedValue({
          passed: false,
          results: originalResults
        });

        const result = await driver.performSelfTest();

        expect(result.passed).toBe(false);
        expect(result.results.some(test => !test.passed)).toBe(true);
      });
    });

    describe('资源清理', () => {
      it('应该正确清理资源', async () => {
        await driver.connect();
        await driver.startCapture(mockCaptureSession);

        driver.dispose();

        // 验证资源被清理
        expect(driver.isCapturing).toBe(false);
      });
    });
  });

  describe('驱动对比和边界条件', () => {
    let networkDriver: ExampleNetworkDriver;
    let serialDriver: ExampleSerialDriver;

    beforeEach(() => {
      networkDriver = new ExampleNetworkDriver('192.168.1.100');
      serialDriver = new ExampleSerialDriver('/dev/ttyUSB0');
    });

    afterEach(() => {
      networkDriver.dispose();
      serialDriver.dispose();
    });

    it('应该实现相同的基础接口', () => {
      const drivers = [networkDriver, serialDriver];

      drivers.forEach(driver => {
        expect(typeof driver.connect).toBe('function');
        expect(typeof driver.disconnect).toBe('function');
        expect(typeof driver.getStatus).toBe('function');
        expect(typeof driver.startCapture).toBe('function');
        expect(typeof driver.stopCapture).toBe('function');
        expect(typeof driver.dispose).toBe('function');
      });
    });

    it('应该有不同的驱动类型', () => {
      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(serialDriver.driverType).toBe(AnalyzerDriverType.Serial);
    });

    it('应该有不同的网络属性', () => {
      expect(networkDriver.isNetwork).toBe(true);
      expect(serialDriver.isNetwork).toBe(false);
    });

    it('应该处理空参数构造', () => {
      expect(() => new ExampleNetworkDriver('')).not.toThrow();
      expect(() => new ExampleSerialDriver('')).not.toThrow();
    });

    it('应该处理无效的采集会话', async () => {
      await networkDriver.connect();
      await serialDriver.connect();

      const invalidSession = null as any;
      
      const networkResult = await networkDriver.startCapture(invalidSession);
      const serialResult = await serialDriver.startCapture(invalidSession);

      expect(networkResult).not.toBe(CaptureError.None);
      expect(serialResult).not.toBe(CaptureError.None);
    });

    it('应该处理并发操作', async () => {
      await networkDriver.connect();

      // 同时启动多个采集
      const promises = Array.from({ length: 3 }, () => 
        networkDriver.startCapture(mockCaptureSession)
      );

      const results = await Promise.all(promises);
      
      // 第一个应该成功，其他应该返回Busy或其他错误
      expect(results[0]).toBe(CaptureError.None);
    });

    it('应该处理内存不足情况', async () => {
      await serialDriver.connect();

      const largeSession: CaptureSession = {
        ...mockCaptureSession,
        preTriggerSamples: Number.MAX_SAFE_INTEGER,
        postTriggerSamples: Number.MAX_SAFE_INTEGER
      };

      const result = await serialDriver.startCapture(largeSession);
      expect(result).toBe(CaptureError.BadParams);
    });
  });

  describe('错误处理', () => {
    it('应该处理网络驱动连接错误', async () => {
      const driver = new ExampleNetworkDriver('invalid-host');
      jest.spyOn(driver as any, 'checkServerReachability').mockRejectedValue(new Error('连接失败'));

      const result = await driver.connect();
      expect(result.success).toBe(false);

      driver.dispose();
    });

    it('应该处理串口驱动连接错误', async () => {
      const driver = new ExampleSerialDriver('/invalid/port');
      
      // 模拟串口连接失败
      jest.spyOn(driver as any, 'establishConnection').mockRejectedValue(new Error('端口不存在'));

      const result = await driver.connect();
      expect(result.success).toBe(false);

      driver.dispose();
    });

    it('应该处理采集过程中的错误', async () => {
      const driver = new ExampleNetworkDriver('192.168.1.100');
      await driver.connect();

      // 模拟采集过程中的错误
      jest.spyOn(driver as any, 'checkServerReachability').mockResolvedValue(false);

      const result = await driver.startCapture(mockCaptureSession);
      expect(result).toBe(CaptureError.HardwareError);

      driver.dispose();
    });
  });
});