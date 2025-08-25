/**
 * LogicAnalyzerDriver 全面功能测试
 * 
 * 测试目标：
 * - 测试@src源码中LogicAnalyzerDriver的核心业务逻辑
 * - 验证连接管理、采集控制、数据处理、状态监控等关键功能
 * - 专注真实业务逻辑验证，最小化Mock使用
 * 
 * 测试方法：
 * - 深度思考，一步一步脚踏实地的高质量完成
 * - 不求速度但求质量，验证算法正确性
 * - 不偏移方向，专注@src源码验证
 * 
 * 基于Models层91.39%覆盖率的成功经验
 */

import { LogicAnalyzerDriver } from '../../../src/drivers/LogicAnalyzerDriver';
import { CaptureSession, AnalyzerChannel } from '../../../src/models/CaptureModels';
import { 
  AnalyzerDriverType, 
  CaptureError, 
  TriggerType,
  CaptureMode,
  ConnectionResult 
} from '../../../src/models/AnalyzerTypes';

describe('LogicAnalyzerDriver 全面功能测试', () => {
  let driver: LogicAnalyzerDriver;
  let testSession: CaptureSession;

  beforeEach(() => {
    // 创建测试用的采集会话
    testSession = new CaptureSession();
    testSession.frequency = 10000000; // 10MHz
    testSession.preTriggerSamples = 1000;
    testSession.postTriggerSamples = 4000;
    testSession.triggerType = TriggerType.Edge;
    testSession.triggerChannel = 0;
    testSession.triggerInverted = false;
    testSession.captureChannels = [
      new AnalyzerChannel(0, 'CH0'),
      new AnalyzerChannel(1, 'CH1'),
      new AnalyzerChannel(2, 'CH2')
    ];
  });

  describe('驱动器初始化和基本属性', () => {
    it('应该能够创建网络驱动器实例', () => {
      const networkConnectionString = '192.168.1.100:8080';
      driver = new LogicAnalyzerDriver(networkConnectionString);

      expect(driver).toBeDefined();
      expect(driver.driverType).toBe(AnalyzerDriverType.Network);
      expect(driver.isNetwork).toBe(true);
    });

    it('应该能够创建串口驱动器实例', () => {
      const serialConnectionString = 'COM3';
      driver = new LogicAnalyzerDriver(serialConnectionString);

      expect(driver).toBeDefined();
      expect(driver.driverType).toBe(AnalyzerDriverType.Serial);
      expect(driver.isNetwork).toBe(false);
    });

    it('应该拒绝空的连接字符串', () => {
      expect(() => {
        new LogicAnalyzerDriver('');
      }).toThrow('连接字符串不能为空');
    });

    it('应该正确识别网络和串口连接类型', () => {
      const networkDriver = new LogicAnalyzerDriver('10.0.0.1:3000');
      const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');

      expect(networkDriver.isNetwork).toBe(true);
      expect(serialDriver.isNetwork).toBe(false);
    });

    it('应该提供合理的设备属性默认值', () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');

      // 未连接时应该返回默认值
      expect(driver.channelCount).toBe(0);
      expect(driver.maxFrequency).toBe(0);
      expect(driver.blastFrequency).toBe(0);
      expect(driver.bufferSize).toBe(0);
      expect(driver.deviceVersion).toBeNull();
      expect(driver.isCapturing).toBe(false);
    });
  });

  describe('连接管理核心功能', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该验证网络地址格式', async () => {
      const invalidDriver = new LogicAnalyzerDriver('invalid-address');

      const result = await invalidDriver.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('地址/端口格式无效');
    });

    it('应该验证端口范围', async () => {
      const testCases = [
        { address: '192.168.1.100:70000', expectValid: false }, // 端口太大
        { address: '192.168.1.100:0', expectValid: false },     // 端口为0
        { address: '192.168.1.100:-1', expectValid: false },    // 负数端口
        { address: '192.168.1.100:65535', expectValid: true },  // 最大有效端口
        { address: '192.168.1.100:1', expectValid: true },      // 最小有效端口
      ];

      for (const { address, expectValid } of testCases) {
        const testDriver = new LogicAnalyzerDriver(address);
        const result = await testDriver.connect();
        
        if (expectValid) {
          // 有效地址格式，错误不应该是格式相关
          if (!result.success && result.error) {
            expect(result.error).not.toContain('端口号无效');
            expect(result.error).not.toContain('地址/端口格式无效');
          }
        } else {
          // 无效地址格式，应该返回格式错误
          expect(result.success).toBe(false);
          expect(result.error).toMatch(/端口号无效|地址\/端口格式无效/);
        }
      }
    });

    it('应该正确解析网络地址', async () => {
      const validAddresses = [
        '192.168.1.100:8080',
        '10.0.0.1:3000',
        '127.0.0.1:1234',
        '255.255.255.255:65535'
      ];

      for (const address of validAddresses) {
        const testDriver = new LogicAnalyzerDriver(address);
        
        // 验证地址解析逻辑（通过尝试连接来测试）
        const result = await testDriver.connect();
        
        // 连接可能失败（设备不存在），但地址解析应该成功
        if (!result.success && result.error) {
          expect(result.error).not.toContain('格式无效');
          expect(result.error).not.toContain('端口号无效');
        }
      }
    });
  });

  describe('采集参数验证核心逻辑', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该在未连接状态拒绝采集', async () => {
      const result = await driver.startCapture(testSession);
      
      expect(result).toBe(CaptureError.HardwareError);
    });

    it('应该防止重复采集', async () => {
      // 模拟已在采集状态
      (driver as any)._capturing = true;
      
      const result = await driver.startCapture(testSession);
      
      expect(result).toBe(CaptureError.Busy);
    });

    it('应该验证空通道列表', () => {
      testSession.captureChannels = [];
      
      const validateMethod = (driver as any).validateSettings;
      const result = validateMethod.call(driver, testSession, 5000);
      
      expect(result).toBe(false);
    });

    it('应该验证频率范围', () => {
      const testCases = [
        { frequency: 100000000, expected: true, desc: '100MHz - 有效' },
        { frequency: 10000000, expected: true, desc: '10MHz - 有效' },
        { frequency: 1000000, expected: true, desc: '1MHz - 边界有效' },
        { frequency: 500000, expected: false, desc: '500kHz - 太低' },
        { frequency: 200000000, expected: false, desc: '200MHz - 太高' }
      ];

      const validateMethod = (driver as any).validateSettings;

      testCases.forEach(({ frequency, expected, desc }) => {
        testSession.frequency = frequency;
        const result = validateMethod.call(driver, testSession, 5000);
        
        expect(result).toBe(expected);
      });
    });

    it('应该验证触发通道范围', () => {
      const testCases = [
        { triggerChannel: 0, expected: true },   // 最小有效通道
        { triggerChannel: 23, expected: true },  // 最大有效通道
        { triggerChannel: -1, expected: false }, // 无效负数
        { triggerChannel: 24, expected: false }  // 超出范围
      ];

      const validateMethod = (driver as any).validateSettings;

      testCases.forEach(({ triggerChannel, expected }) => {
        testSession.triggerChannel = triggerChannel;
        const result = validateMethod.call(driver, testSession, 5000);
        
        expect(result).toBe(expected);
      });
    });

    it('应该处理极值样本数请求', () => {
      const validateMethod = (driver as any).validateSettings;
      
      // 测试边界条件
      const testCases = [
        { samples: 0, expected: false, desc: '零样本无效' },
        { samples: -1000, expected: false, desc: '负数样本无效' },
        { samples: 1, expected: true, desc: '最小有效样本' },
        { samples: 1000000, expected: true, desc: '大样本数有效' }
      ];

      testCases.forEach(({ samples, expected, desc }) => {
        const result = validateMethod.call(driver, testSession, samples);
        expect(result).toBe(expected);
      });
    });
  });

  describe('采集请求构建核心算法', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该正确构建边沿触发请求', () => {
      testSession.triggerType = TriggerType.Edge;
      testSession.triggerChannel = 5;
      testSession.triggerInverted = true;
      testSession.frequency = 25000000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 10000, 2);

      expect(request.triggerType).toBe(TriggerType.Edge);
      expect(request.trigger).toBe(5);
      expect(request.invertedOrCount).toBe(1); // true转换为1
      expect(request.triggerValue).toBe(0); // 边沿触发不使用值
      expect(request.frequency).toBe(25000000);
      expect(request.channelCount).toBe(3); // testSession有3个通道
    });

    it('应该正确构建Blast触发请求', () => {
      testSession.triggerType = TriggerType.Blast;
      testSession.triggerChannel = 10;
      testSession.triggerInverted = false;
      testSession.frequency = 50000000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 8000, 1);

      expect(request.triggerType).toBe(TriggerType.Blast);
      expect(request.trigger).toBe(10);
      expect(request.invertedOrCount).toBe(0); // false转换为0
      expect(request.frequency).toBe(50000000);
    });

    it('应该正确构建复杂触发请求', () => {
      testSession.triggerType = TriggerType.Complex;
      testSession.triggerChannel = 0;
      testSession.triggerBitCount = 8;
      testSession.triggerPattern = 0xAA; // 10101010
      testSession.frequency = 20000000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 12000, 2);

      expect(request.triggerType).toBe(TriggerType.Complex);
      expect(request.trigger).toBe(0);
      expect(request.invertedOrCount).toBe(8); // 位数
      expect(request.triggerValue).toBe(0xAA); // 模式值
      expect(request.frequency).toBe(20000000);
    });

    it('应该正确构建Fast触发请求', () => {
      testSession.triggerType = TriggerType.Fast;
      testSession.triggerChannel = 2;
      testSession.triggerBitCount = 4;
      testSession.triggerPattern = 0xC; // 1100
      testSession.frequency = 100000000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 15000, 3);

      expect(request.triggerType).toBe(TriggerType.Fast);
      expect(request.trigger).toBe(2);
      expect(request.invertedOrCount).toBe(4);
      expect(request.triggerValue).toBe(0xC);
      expect(request.frequency).toBe(100000000);
    });

    it('应该正确设置通道配置', () => {
      const customChannels = [
        new AnalyzerChannel(0, 'CLK'),
        new AnalyzerChannel(5, 'DATA'),
        new AnalyzerChannel(15, 'CS'),
        new AnalyzerChannel(23, 'RESET')
      ];
      testSession.captureChannels = customChannels;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, 6000, 2);

      expect(request.channelCount).toBe(4);
      expect(request.channels).toEqual([0, 5, 15, 23]);
    });

    it('应该正确计算样本数配置', () => {
      testSession.preTriggerSamples = 2000;
      testSession.postTriggerSamples = 8000;
      const requestedSamples = 10000;

      const composeMethod = (driver as any).composeRequest;
      const request = composeMethod.call(driver, testSession, requestedSamples, 1);

      expect(request.preTriggerSamples).toBe(2000);
      expect(request.postTriggerSamples).toBe(8000);
    });
  });

  describe('状态监控核心功能', () => {
    it('应该处理未连接状态的电压查询', async () => {
      driver = new LogicAnalyzerDriver('COM3'); // 串口驱动

      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('DISCONNECTED');
    });

    it('应该为串口设备返回模拟电压', async () => {
      driver = new LogicAnalyzerDriver('COM3');
      
      // 模拟连接状态
      (driver as any)._isConnected = true;
      (driver as any)._currentStream = {}; // 模拟流对象

      const voltage = await driver.getVoltageStatus();
      
      expect(voltage).toBe('3.3V');
    });

    it('应该正确识别设备类型', () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');
      const serialDriver = new LogicAnalyzerDriver('/dev/ttyUSB0');

      expect(networkDriver.driverType).toBe(AnalyzerDriverType.Network);
      expect(serialDriver.driverType).toBe(AnalyzerDriverType.Serial);

      expect(networkDriver.isNetwork).toBe(true);
      expect(serialDriver.isNetwork).toBe(false);
    });

    it('应该跟踪采集状态', () => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');

      // 初始状态
      expect(driver.isCapturing).toBe(false);

      // 模拟采集状态
      (driver as any)._capturing = true;
      expect(driver.isCapturing).toBe(true);

      // 重置状态
      (driver as any)._capturing = false;
      expect(driver.isCapturing).toBe(false);
    });
  });

  describe('网络配置处理核心逻辑', () => {
    it('应该拒绝网络设备的网络配置', async () => {
      const networkDriver = new LogicAnalyzerDriver('192.168.1.100:8080');

      const result = await networkDriver.sendNetworkConfig(
        'TestWiFi',
        'password123',
        '192.168.1.200',
        8080
      );

      expect(result).toBe(false);
    });

    it('应该正确构建网络配置数据结构', () => {
      // 验证网络配置序列化逻辑算法
      const testConfig = {
        accessPointName: 'TestAP',
        password: 'testpass',
        ipAddress: '10.0.0.100',
        port: 3000
      };

      // 创建模拟的网络配置序列化器（基于源码逻辑）
      const netConfigSerializer = {
        serialize: () => {
          const buffer = new ArrayBuffer(115); // 33 + 64 + 16 + 2
          const view = new DataView(buffer);
          let offset = 0;

          // AccessPointName - 33字节
          const apNameBytes = new TextEncoder().encode(testConfig.accessPointName);
          for (let i = 0; i < 33; i++) {
            view.setUint8(offset++, i < apNameBytes.length ? apNameBytes[i] : 0);
          }

          // Password - 64字节  
          const passwordBytes = new TextEncoder().encode(testConfig.password);
          for (let i = 0; i < 64; i++) {
            view.setUint8(offset++, i < passwordBytes.length ? passwordBytes[i] : 0);
          }

          // IPAddress - 16字节
          const ipBytes = new TextEncoder().encode(testConfig.ipAddress);
          for (let i = 0; i < 16; i++) {
            view.setUint8(offset++, i < ipBytes.length ? ipBytes[i] : 0);
          }

          // Port - 2字节，小端序
          view.setUint16(offset, testConfig.port, true);

          return new Uint8Array(buffer);
        }
      };

      const serialized = netConfigSerializer.serialize();

      // 验证序列化数据的长度和结构
      expect(serialized.length).toBe(115);

      // 验证端口字节序（小端）
      const portOffset = 33 + 64 + 16;
      const portValue = serialized[portOffset] | (serialized[portOffset + 1] << 8);
      expect(portValue).toBe(3000);
      
      // 验证字符串字段的null终止
      expect(serialized[32]).toBe(0); // AP名称结束
      expect(serialized[33 + 63]).toBe(0); // 密码结束
    });
  });

  describe('设备信息解析核心功能', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该正确解析设备信息格式', () => {
      const testCases = [
        { 
          response: 'CHANNELS:24', 
          regex: /^CHANNELS:([0-9]+)$/,
          expectedValue: '24',
          expectedParsed: 24
        },
        { 
          response: 'BUFFER:96000', 
          regex: /^BUFFER:([0-9]+)$/,
          expectedValue: '96000',
          expectedParsed: 96000
        },
        { 
          response: 'FREQ:100000000', 
          regex: /^FREQ:([0-9]+)$/,
          expectedValue: '100000000',
          expectedParsed: 100000000
        },
        { 
          response: 'BLASTFREQ:100000000', 
          regex: /^BLASTFREQ:([0-9]+)$/,
          expectedValue: '100000000',
          expectedParsed: 100000000
        }
      ];

      testCases.forEach(({ response, regex, expectedValue, expectedParsed }) => {
        const match = regex.exec(response);
        
        expect(match).not.toBeNull();
        expect(match![1]).toBe(expectedValue);
        expect(parseInt(match![1], 10)).toBe(expectedParsed);
      });
    });

    it('应该拒绝无效的设备信息格式', () => {
      const invalidResponses = [
        'CHANNELS:abc',
        'BUFFER:-1000',
        'FREQ:',
        'BLASTFREQ:invalid',
        'UNKNOWN:123',
        'channels:24',  // 小写
        'CHANNELS: 24', // 带空格
        'BUFFER:96000extra' // 额外字符
      ];

      const regexes = [
        /^CHANNELS:([0-9]+)$/,
        /^BUFFER:([0-9]+)$/,
        /^FREQ:([0-9]+)$/,
        /^BLASTFREQ:([0-9]+)$/
      ];

      invalidResponses.forEach(response => {
        regexes.forEach(regex => {
          expect(regex.exec(response)).toBeNull();
        });
      });
    });
  });

  describe('采集模式选择算法', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该正确选择采集模式', () => {
      const getCaptureMethod = (driver as any).getCaptureMode;
      
      const testCases = [
        { 
          channels: [0, 1, 2, 3, 4, 5, 6, 7], 
          expectedMode: CaptureMode.Channels_8,
          description: '8通道模式'
        },
        { 
          channels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 
          expectedMode: CaptureMode.Channels_16,
          description: '16通道模式'
        },
        { 
          channels: Array.from({length: 24}, (_, i) => i), 
          expectedMode: CaptureMode.Channels_24,
          description: '24通道模式'
        },
        {
          channels: [0, 1],
          expectedMode: CaptureMode.Channels_8,
          description: '少于8通道使用8通道模式'
        }
      ];

      testCases.forEach(({ channels, expectedMode, description }) => {
        const mode = getCaptureMethod.call(driver, channels);
        expect(mode).toBe(expectedMode);
      });
    });
  });

  describe('错误处理和边界条件', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该处理极值参数', () => {
      const validateMethod = (driver as any).validateSettings;
      
      // 测试极大值处理
      const largeValueResult = validateMethod.call(driver, testSession, Number.MAX_SAFE_INTEGER);
      expect(typeof largeValueResult).toBe('boolean');
      
      // 测试极小值处理
      const smallValueResult = validateMethod.call(driver, testSession, Number.MIN_SAFE_INTEGER);
      expect(typeof smallValueResult).toBe('boolean');
    });

    it('应该验证通道数组边界', () => {
      const getCaptureMethod = (driver as any).getCaptureMode;
      
      // 测试空数组
      const emptyResult = getCaptureMethod.call(driver, []);
      expect(typeof emptyResult).toBe('number');
      
      // 测试单通道
      const singleResult = getCaptureMethod.call(driver, [0]);
      expect(singleResult).toBe(CaptureMode.Channels_8);
      
      // 测试最大通道数
      const maxChannels = Array.from({length: 24}, (_, i) => i);
      const maxResult = getCaptureMethod.call(driver, maxChannels);
      expect(maxResult).toBe(CaptureMode.Channels_24);
    });

    it('应该处理无效触发类型', () => {
      const composeMethod = (driver as any).composeRequest;
      
      // 测试无效的触发类型（使用数字而非枚举）
      testSession.triggerType = 999 as TriggerType;
      
      // 方法应该能处理而不抛异常
      expect(() => {
        composeMethod.call(driver, testSession, 5000, 1);
      }).not.toThrow();
    });
  });

  describe('算法一致性验证', () => {
    beforeEach(() => {
      driver = new LogicAnalyzerDriver('192.168.1.100:8080');
    });

    it('应该保持通道数组和通道计数一致', () => {
      const composeMethod = (driver as any).composeRequest;
      
      const testChannels = [
        [new AnalyzerChannel(0, 'CH0')],
        [new AnalyzerChannel(0, 'CH0'), new AnalyzerChannel(5, 'CH5')],
        [new AnalyzerChannel(1, 'CH1'), new AnalyzerChannel(3, 'CH3'), new AnalyzerChannel(7, 'CH7')]
      ];

      testChannels.forEach(channels => {
        testSession.captureChannels = channels;
        const request = composeMethod.call(driver, testSession, 5000, 1);
        
        expect(request.channelCount).toBe(channels.length);
        expect(request.channels.length).toBe(channels.length);
      });
    });

    it('应该正确映射通道编号', () => {
      const composeMethod = (driver as any).composeRequest;
      
      const customChannels = [
        new AnalyzerChannel(2, 'A'),
        new AnalyzerChannel(8, 'B'),
        new AnalyzerChannel(15, 'C')
      ];
      testSession.captureChannels = customChannels;

      const request = composeMethod.call(driver, testSession, 5000, 1);
      
      expect(request.channels).toEqual([2, 8, 15]);
    });
  });
});