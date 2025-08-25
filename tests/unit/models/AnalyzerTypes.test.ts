/**
 * AnalyzerTypes.ts 单元测试
 * 测试逻辑分析器类型定义、枚举值、常量和接口约束
 */

import {
  AnalyzerDriverType,
  CaptureMode,
  CaptureError,
  TriggerType,
  TriggerCondition,
  TriggerDelays,
  CaptureLimits,
  AnalyzerDeviceInfo,
  DeviceInfo,
  HardwareCapabilities,
  NetworkCapability,
  ConnectionParams,
  ConnectionResult,
  CaptureConfiguration,
  CaptureResult,
  CaptureSession,
  AnalyzerChannel,
  BurstInfo,
  DeviceStatus,
  CaptureEventArgs,
  CaptureCompletedHandler
} from '../../../src/models/AnalyzerTypes';

describe('AnalyzerTypes', () => {
  describe('枚举类型测试', () => {
    describe('AnalyzerDriverType', () => {
      it('应该包含所有预期的驱动类型', () => {
        expect(AnalyzerDriverType.Serial).toBe('Serial');
        expect(AnalyzerDriverType.Network).toBe('Network');
        expect(AnalyzerDriverType.Multi).toBe('Multi');
        expect(AnalyzerDriverType.Emulated).toBe('Emulated');
        expect(AnalyzerDriverType.Single).toBe('Single');
      });

      it('应该能够枚举所有值', () => {
        const values = Object.values(AnalyzerDriverType);
        expect(values).toHaveLength(5);
        expect(values).toContain('Serial');
        expect(values).toContain('Network');
        expect(values).toContain('Multi');
        expect(values).toContain('Emulated');
        expect(values).toContain('Single');
      });
    });

    describe('CaptureMode', () => {
      it('应该包含正确的通道数枚举', () => {
        expect(CaptureMode.Channels_8).toBe(0);
        expect(CaptureMode.Channels_16).toBe(1);
        expect(CaptureMode.Channels_24).toBe(2);
      });

      it('枚举值应该是连续的数字', () => {
        const values = Object.values(CaptureMode);
        const numericValues = values.filter(v => typeof v === 'number') as number[];
        expect(numericValues.sort()).toEqual([0, 1, 2]);
      });
    });

    describe('CaptureError', () => {
      it('应该包含所有预期的错误类型', () => {
        expect(CaptureError.None).toBe('None');
        expect(CaptureError.Busy).toBe('Busy');
        expect(CaptureError.BadParams).toBe('BadParams');
        expect(CaptureError.HardwareError).toBe('HardwareError');
        expect(CaptureError.UnexpectedError).toBe('UnexpectedError');
      });

      it('错误类型应该是字符串', () => {
        const values = Object.values(CaptureError);
        values.forEach(value => {
          expect(typeof value).toBe('string');
        });
      });
    });

    describe('TriggerType', () => {
      it('应该包含所有触发类型', () => {
        expect(TriggerType.Edge).toBe(0);
        expect(TriggerType.Complex).toBe(1);
        expect(TriggerType.Fast).toBe(2);
        expect(TriggerType.Blast).toBe(3);
      });

      it('触发类型值应该是连续递增的', () => {
        expect(TriggerType.Complex).toBe(TriggerType.Edge + 1);
        expect(TriggerType.Fast).toBe(TriggerType.Complex + 1);
        expect(TriggerType.Blast).toBe(TriggerType.Fast + 1);
      });
    });
  });

  describe('类型别名测试', () => {
    describe('TriggerCondition', () => {
      it('应该接受所有有效的触发条件值', () => {
        const validConditions: TriggerCondition[] = [
          'rising', 'falling', 'high', 'low', 'any', 'none'
        ];

        validConditions.forEach(condition => {
          // 应该能够赋值而不报错
          const testCondition: TriggerCondition = condition;
          expect(testCondition).toBe(condition);
        });
      });
    });

    describe('CaptureCompletedHandler', () => {
      it('应该是一个函数类型', () => {
        const mockHandler: CaptureCompletedHandler = (args: CaptureEventArgs) => {
          // Mock implementation
        };

        expect(typeof mockHandler).toBe('function');
      });

      it('函数应该接受CaptureEventArgs参数', () => {
        const mockArgs: CaptureEventArgs = {
          success: true,
          session: {} as CaptureSession
        };

        const handler: CaptureCompletedHandler = (args) => {
          expect(args).toBe(mockArgs);
        };

        handler(mockArgs);
      });
    });
  });

  describe('常量测试', () => {
    describe('TriggerDelays', () => {
      it('应该包含正确的触发延迟常量', () => {
        expect(TriggerDelays.ComplexTriggerDelay).toBe(5);
        expect(TriggerDelays.FastTriggerDelay).toBe(3);
      });

      it('常量应该是只读的', () => {
        // TypeScript编译时检查只读性，运行时测试常量值不变
        const originalComplex = TriggerDelays.ComplexTriggerDelay;
        const originalFast = TriggerDelays.FastTriggerDelay;

        expect(TriggerDelays.ComplexTriggerDelay).toBe(originalComplex);
        expect(TriggerDelays.FastTriggerDelay).toBe(originalFast);
      });

      it('触发延迟值应该是正数', () => {
        expect(TriggerDelays.ComplexTriggerDelay).toBeGreaterThan(0);
        expect(TriggerDelays.FastTriggerDelay).toBeGreaterThan(0);
      });

      it('复杂触发延迟应该大于快速触发延迟', () => {
        expect(TriggerDelays.ComplexTriggerDelay).toBeGreaterThan(TriggerDelays.FastTriggerDelay);
      });
    });
  });

  describe('接口实现测试', () => {
    describe('CaptureLimits', () => {
      it('应该能正确实现CaptureLimits接口', () => {
        const limits: CaptureLimits = {
          minPreSamples: 100,
          maxPreSamples: 1000,
          minPostSamples: 100,
          maxPostSamples: 1000,
          maxTotalSamples: 2000
        };

        expect(limits.minPreSamples).toBe(100);
        expect(limits.maxPreSamples).toBe(1000);
        expect(limits.minPostSamples).toBe(100);
        expect(limits.maxPostSamples).toBe(1000);
        expect(limits.maxTotalSamples).toBe(2000);
      });

      it('最大样本数应该大于或等于最小样本数', () => {
        const limits: CaptureLimits = {
          minPreSamples: 100,
          maxPreSamples: 1000,
          minPostSamples: 200,
          maxPostSamples: 2000,
          maxTotalSamples: 3000
        };

        expect(limits.maxPreSamples).toBeGreaterThanOrEqual(limits.minPreSamples);
        expect(limits.maxPostSamples).toBeGreaterThanOrEqual(limits.minPostSamples);
      });
    });

    describe('HardwareCapabilities', () => {
      it('应该能正确实现HardwareCapabilities接口', () => {
        const capabilities: HardwareCapabilities = {
          channels: {
            digital: 16,
            analog: 4,
            mixed: true,
            maxVoltage: 5.0,
            inputImpedance: 1000000
          },
          sampling: {
            maxRate: 100000000,
            minRate: 1000,
            supportedRates: [1000, 10000, 100000, 1000000, 10000000, 100000000],
            bufferSize: 1048576,
            streamingSupport: true
          },
          triggers: {
            types: [TriggerType.Edge, TriggerType.Complex, TriggerType.Fast],
            maxChannels: 16,
            patternWidth: 32,
            sequentialSupport: true,
            conditions: ['rising', 'falling', 'high', 'low']
          },
          connectivity: {
            interfaces: ['usb', 'ethernet'],
            protocols: ['custom', 'sigrok']
          },
          features: {
            signalGeneration: true,
            powerSupply: false,
            i2cSniffer: true,
            canSupport: false,
            customDecoders: true,
            voltageMonitoring: true
          }
        };

        expect(capabilities.channels.digital).toBe(16);
        expect(capabilities.sampling.maxRate).toBeGreaterThan(capabilities.sampling.minRate);
        expect(capabilities.triggers.maxChannels).toBeGreaterThan(0);
        expect(capabilities.connectivity.interfaces).toContain('usb');
        expect(capabilities.features.signalGeneration).toBe(true);
      });

      it('采样率数组应该包含有效值', () => {
        const capabilities: HardwareCapabilities = {
          channels: {
            digital: 8,
            maxVoltage: 3.3,
            inputImpedance: 1000000
          },
          sampling: {
            maxRate: 1000000,
            minRate: 1000,
            supportedRates: [1000, 10000, 100000, 1000000],
            bufferSize: 4096,
            streamingSupport: false
          },
          triggers: {
            types: [TriggerType.Edge],
            maxChannels: 8,
            patternWidth: 8,
            sequentialSupport: false,
            conditions: ['rising', 'falling']
          },
          connectivity: {
            interfaces: ['usb'],
            protocols: ['custom']
          },
          features: {}
        };

        expect(capabilities.sampling.supportedRates.length).toBeGreaterThan(0);
        capabilities.sampling.supportedRates.forEach(rate => {
          expect(rate).toBeGreaterThan(0);
          expect(rate).toBeGreaterThanOrEqual(capabilities.sampling.minRate);
          expect(rate).toBeLessThanOrEqual(capabilities.sampling.maxRate);
        });
      });
    });

    describe('ConnectionParams', () => {
      it('应该支持设备路径连接', () => {
        const params: ConnectionParams = {
          devicePath: '/dev/ttyUSB0',
          autoDetect: false
        };

        expect(params.devicePath).toBe('/dev/ttyUSB0');
        expect(params.autoDetect).toBe(false);
      });

      it('应该支持网络连接配置', () => {
        const params: ConnectionParams = {
          networkConfig: {
            host: '192.168.1.100',
            port: 8080,
            timeout: 5000
          },
          autoDetect: false
        };

        expect(params.networkConfig).toBeDefined();
        expect(params.networkConfig!.host).toBe('192.168.1.100');
        expect(params.networkConfig!.port).toBe(8080);
        expect(params.networkConfig!.timeout).toBe(5000);
      });

      it('应该支持串口连接配置', () => {
        const params: ConnectionParams = {
          serialConfig: {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
          }
        };

        expect(params.serialConfig).toBeDefined();
        expect(params.serialConfig!.baudRate).toBe(115200);
        expect(params.serialConfig!.dataBits).toBe(8);
        expect(params.serialConfig!.stopBits).toBe(1);
        expect(params.serialConfig!.parity).toBe('none');
      });
    });

    describe('CaptureConfiguration', () => {
      it('应该包含所有必需的配置参数', () => {
        const config: CaptureConfiguration = {
          frequency: 1000000,
          preTriggerSamples: 1000,
          postTriggerSamples: 9000,
          triggerType: TriggerType.Edge,
          triggerChannel: 0,
          triggerInverted: false,
          triggerPattern: 0x01,
          triggerBitCount: 1,
          loopCount: 1,
          measureBursts: false,
          captureChannels: [0, 1, 2, 3],
          captureMode: CaptureMode.Channels_8
        };

        expect(config.frequency).toBe(1000000);
        expect(config.preTriggerSamples).toBe(1000);
        expect(config.postTriggerSamples).toBe(9000);
        expect(config.triggerType).toBe(TriggerType.Edge);
        expect(config.triggerChannel).toBe(0);
        expect(config.triggerInverted).toBe(false);
        expect(config.loopCount).toBe(1);
        expect(config.measureBursts).toBe(false);
        expect(config.captureChannels).toHaveLength(4);
        expect(config.captureMode).toBe(CaptureMode.Channels_8);
      });

      it('频率应该是正数', () => {
        const config: CaptureConfiguration = {
          frequency: 1000000,
          preTriggerSamples: 100,
          postTriggerSamples: 900,
          triggerType: TriggerType.Edge,
          triggerChannel: 0,
          triggerInverted: false,
          loopCount: 1,
          measureBursts: false,
          captureChannels: [0]
        };

        expect(config.frequency).toBeGreaterThan(0);
      });

      it('样本数应该是非负数', () => {
        const config: CaptureConfiguration = {
          frequency: 1000000,
          preTriggerSamples: 0,
          postTriggerSamples: 1000,
          triggerType: TriggerType.Edge,
          triggerChannel: 0,
          triggerInverted: false,
          loopCount: 1,
          measureBursts: false,
          captureChannels: [0]
        };

        expect(config.preTriggerSamples).toBeGreaterThanOrEqual(0);
        expect(config.postTriggerSamples).toBeGreaterThanOrEqual(0);
      });
    });

    describe('DeviceInfo', () => {
      it('应该包含设备基本信息', () => {
        const deviceInfo: DeviceInfo = {
          name: 'Test Logic Analyzer',
          version: '1.0.0',
          type: AnalyzerDriverType.Serial,
          connectionPath: '/dev/ttyUSB0',
          isNetwork: false,
          capabilities: {
            channels: {
              digital: 8,
              maxVoltage: 3.3,
              inputImpedance: 1000000
            },
            sampling: {
              maxRate: 24000000,
              minRate: 1000,
              supportedRates: [1000, 10000, 100000, 1000000, 10000000, 24000000],
              bufferSize: 8192,
              streamingSupport: false
            },
            triggers: {
              types: [TriggerType.Edge, TriggerType.Complex],
              maxChannels: 8,
              patternWidth: 8,
              sequentialSupport: false,
              conditions: ['rising', 'falling', 'high', 'low']
            },
            connectivity: {
              interfaces: ['usb'],
              protocols: ['custom']
            },
            features: {}
          }
        };

        expect(deviceInfo.name).toBe('Test Logic Analyzer');
        expect(deviceInfo.version).toBe('1.0.0');
        expect(deviceInfo.type).toBe(AnalyzerDriverType.Serial);
        expect(deviceInfo.isNetwork).toBe(false);
        expect(deviceInfo.capabilities).toBeDefined();
      });

      it('网络设备应该正确标识', () => {
        const networkDevice: DeviceInfo = {
          name: 'Network Logic Analyzer',
          type: AnalyzerDriverType.Network,
          isNetwork: true,
          capabilities: {
            channels: { digital: 16, maxVoltage: 5.0, inputImpedance: 1000000 },
            sampling: { maxRate: 100000000, minRate: 1000, supportedRates: [1000000], bufferSize: 1024, streamingSupport: true },
            triggers: { types: [TriggerType.Edge], maxChannels: 16, patternWidth: 16, sequentialSupport: false, conditions: ['rising'] },
            connectivity: { interfaces: ['ethernet'], protocols: ['scpi'] },
            features: {}
          }
        };

        expect(networkDevice.type).toBe(AnalyzerDriverType.Network);
        expect(networkDevice.isNetwork).toBe(true);
      });
    });

    describe('ConnectionResult', () => {
      it('成功连接应该包含设备信息', () => {
        const result: ConnectionResult = {
          success: true,
          deviceInfo: {
            name: 'Connected Device',
            type: AnalyzerDriverType.Serial,
            isNetwork: false,
            capabilities: {
              channels: { digital: 8, maxVoltage: 3.3, inputImpedance: 1000000 },
              sampling: { maxRate: 1000000, minRate: 1000, supportedRates: [1000000], bufferSize: 1024, streamingSupport: false },
              triggers: { types: [TriggerType.Edge], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: ['rising'] },
              connectivity: { interfaces: ['usb'], protocols: ['custom'] },
              features: {}
            }
          }
        };

        expect(result.success).toBe(true);
        expect(result.deviceInfo).toBeDefined();
        expect(result.deviceInfo!.name).toBe('Connected Device');
        expect(result.error).toBeUndefined();
      });

      it('失败连接应该包含错误信息', () => {
        const result: ConnectionResult = {
          success: false,
          error: 'Device not found'
        };

        expect(result.success).toBe(false);
        expect(result.error).toBe('Device not found');
        expect(result.deviceInfo).toBeUndefined();
      });
    });

    describe('CaptureResult', () => {
      it('成功采集应该包含会话信息', () => {
        const result: CaptureResult = {
          success: true,
          session: {
            frequency: 1000000,
            preTriggerSamples: 1000,
            postTriggerSamples: 9000,
            get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
            triggerType: TriggerType.Edge,
            triggerChannel: 0,
            triggerInverted: false,
            loopCount: 1,
            measureBursts: false,
            captureChannels: [],
            clone: function() { return this; },
            cloneSettings: function() { return this; }
          }
        };

        expect(result.success).toBe(true);
        expect(result.session).toBeDefined();
        expect(result.session!.totalSamples).toBe(10000);
        expect(result.error).toBeUndefined();
      });

      it('失败采集应该包含错误信息', () => {
        const result: CaptureResult = {
          success: false,
          error: CaptureError.HardwareError
        };

        expect(result.success).toBe(false);
        expect(result.error).toBe(CaptureError.HardwareError);
        expect(result.session).toBeUndefined();
      });
    });

    describe('DeviceStatus', () => {
      it('应该正确表示设备状态', () => {
        const status: DeviceStatus = {
          isConnected: true,
          isCapturing: false,
          batteryVoltage: '3.7V',
          temperature: 25.5,
          errorStatus: undefined
        };

        expect(status.isConnected).toBe(true);
        expect(status.isCapturing).toBe(false);
        expect(status.batteryVoltage).toBe('3.7V');
        expect(status.temperature).toBe(25.5);
        expect(status.errorStatus).toBeUndefined();
      });

      it('应该能表示错误状态', () => {
        const errorStatus: DeviceStatus = {
          isConnected: false,
          isCapturing: false,
          errorStatus: 'Connection timeout'
        };

        expect(errorStatus.isConnected).toBe(false);
        expect(errorStatus.errorStatus).toBe('Connection timeout');
      });
    });

    describe('CaptureEventArgs', () => {
      it('应该包含采集结果和会话信息', () => {
        const mockSession: CaptureSession = {
          frequency: 1000000,
          preTriggerSamples: 100,
          postTriggerSamples: 900,
          get totalSamples() { return this.preTriggerSamples + this.postTriggerSamples; },
          triggerType: TriggerType.Edge,
          triggerChannel: 0,
          triggerInverted: false,
          loopCount: 1,
          measureBursts: false,
          captureChannels: [],
          clone: function() { return this; },
          cloneSettings: function() { return this; }
        };

        const eventArgs: CaptureEventArgs = {
          success: true,
          session: mockSession
        };

        expect(eventArgs.success).toBe(true);
        expect(eventArgs.session).toBe(mockSession);
        expect(eventArgs.session.totalSamples).toBe(1000);
      });
    });
  });

  describe('接口继承和扩展测试', () => {
    it('应该能扩展基础接口', () => {
      interface ExtendedDeviceInfo extends DeviceInfo {
        serialNumber: string;
        firmwareVersion: string;
      }

      const extendedInfo: ExtendedDeviceInfo = {
        name: 'Extended Device',
        type: AnalyzerDriverType.Serial,
        isNetwork: false,
        serialNumber: 'SN123456',
        firmwareVersion: '2.1.0',
        capabilities: {
          channels: { digital: 8, maxVoltage: 3.3, inputImpedance: 1000000 },
          sampling: { maxRate: 1000000, minRate: 1000, supportedRates: [1000000], bufferSize: 1024, streamingSupport: false },
          triggers: { types: [TriggerType.Edge], maxChannels: 8, patternWidth: 8, sequentialSupport: false, conditions: ['rising'] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      expect(extendedInfo.name).toBe('Extended Device');
      expect(extendedInfo.serialNumber).toBe('SN123456');
      expect(extendedInfo.firmwareVersion).toBe('2.1.0');
    });
  });

  describe('类型兼容性测试', () => {
    it('枚举值应该与数字兼容', () => {
      const triggerValue: number = TriggerType.Complex;
      expect(triggerValue).toBe(1);

      const modeValue: number = CaptureMode.Channels_16;
      expect(modeValue).toBe(1);
    });

    it('字符串枚举应该与字符串兼容', () => {
      const driverType: string = AnalyzerDriverType.Network;
      expect(driverType).toBe('Network');

      const errorType: string = CaptureError.BadParams;
      expect(errorType).toBe('BadParams');
    });

    it('联合类型应该接受所有有效值', () => {
      const conditions: TriggerCondition[] = [
        'rising', 'falling', 'high', 'low', 'any', 'none'
      ];

      conditions.forEach(condition => {
        const testCondition: TriggerCondition = condition;
        expect(['rising', 'falling', 'high', 'low', 'any', 'none']).toContain(testCondition);
      });
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空数组和可选属性', () => {
      const minimalCapabilities: HardwareCapabilities = {
        channels: {
          digital: 1,
          maxVoltage: 3.3,
          inputImpedance: 1000000
        },
        sampling: {
          maxRate: 1000,
          minRate: 1000,
          supportedRates: [],
          bufferSize: 128,
          streamingSupport: false
        },
        triggers: {
          types: [],
          maxChannels: 0,
          patternWidth: 0,
          sequentialSupport: false,
          conditions: []
        },
        connectivity: {
          interfaces: [],
          protocols: []
        },
        features: {}
      };

      expect(minimalCapabilities.channels.digital).toBe(1);
      expect(minimalCapabilities.sampling.supportedRates).toHaveLength(0);
      expect(minimalCapabilities.triggers.types).toHaveLength(0);
      expect(minimalCapabilities.connectivity.interfaces).toHaveLength(0);
    });

    it('应该处理可选字段', () => {
      const minimalDeviceInfo: DeviceInfo = {
        name: 'Minimal Device',
        type: AnalyzerDriverType.Single,
        isNetwork: false,
        capabilities: {
          channels: { digital: 1, maxVoltage: 3.3, inputImpedance: 1000000 },
          sampling: { maxRate: 1000, minRate: 1000, supportedRates: [1000], bufferSize: 128, streamingSupport: false },
          triggers: { types: [TriggerType.Edge], maxChannels: 1, patternWidth: 1, sequentialSupport: false, conditions: ['rising'] },
          connectivity: { interfaces: ['usb'], protocols: ['custom'] },
          features: {}
        }
      };

      expect(minimalDeviceInfo.version).toBeUndefined();
      expect(minimalDeviceInfo.connectionPath).toBeUndefined();
    });
  });
});